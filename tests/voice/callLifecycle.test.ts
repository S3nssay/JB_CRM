import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock contactResolver
vi.mock('../../server/agents/channels/contactResolver', () => ({
  contactResolver: {
    resolve: vi.fn(),
  },
}));

// Mock conversationStore
vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: {
    findOrCreateConversation: vi.fn(),
    storeMessage: vi.fn(),
    getConversationHistory: vi.fn(),
  },
}));

// Mock messageSender
vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: {
    sendPreferred: vi.fn(),
    send: vi.fn(),
  },
}));

// Mock escalationService
vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: {
    escalate: vi.fn(),
  },
}));

// Mock auditLogger
vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logResponse: vi.fn().mockResolvedValue(undefined),
    logToolCall: vi.fn().mockResolvedValue(undefined),
    logEscalation: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock db
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: 1 }]) }) }),
  },
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

// Mock pg-boss
vi.mock('pg-boss', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockResolvedValue('job-id'),
      start: vi.fn().mockResolvedValue(undefined),
      work: vi.fn().mockResolvedValue(undefined),
    })),
  };
});

import { contactResolver } from '../../server/agents/channels/contactResolver';
import { conversationStore } from '../../server/agents/channels/conversationStore';
import { auditLogger } from '../../server/agents/middleware/auditLogger';
import { messageSender } from '../../server/agents/services/messageSender';
import { escalationService } from '../../server/agents/services/escalationService';

import type { VapiEndOfCallReport } from '../../server/agents/voice/types';

// Build a standard test report
function buildReport(overrides: Partial<VapiEndOfCallReport> = {}): VapiEndOfCallReport {
  return {
    type: 'end-of-call-report',
    artifact: {
      messages: [
        { role: 'user', content: 'Hello, I am looking for a flat in Chelsea.', time: 1000 },
        { role: 'assistant', content: 'Welcome to John Barclay. Let me help you with that.', time: 2000 },
        { role: 'user', content: 'Do you have any two-bedroom flats?', time: 3000 },
        { role: 'assistant', content: 'Yes, we have several options. Would you like to book a viewing?', time: 4000 },
        { role: 'user', content: 'Yes please, for Saturday.', time: 5000 },
        { role: 'assistant', content: 'I have booked a viewing for Saturday. Is there anything else?', time: 6000 },
      ],
    },
    analysis: {
      summary: 'Caller enquired about two-bedroom flats in Chelsea and booked a viewing for Saturday.',
    },
    call: {
      id: 'call-123',
      startedAt: '2026-03-20T10:00:00Z',
      endedAt: '2026-03-20T10:05:00Z',
      customer: { number: '+447700900123' },
    },
    ...overrides,
  };
}

describe('processEndOfCallReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mocks
    (contactResolver.resolve as ReturnType<typeof vi.fn>).mockResolvedValue({
      contactIdentityId: 42,
      contactId: 10,
      contactType: 'lead',
      identifierValue: '+447700900123',
    });

    (conversationStore.findOrCreateConversation as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: 100,
      isNew: true,
    });

    (conversationStore.storeMessage as ReturnType<typeof vi.fn>).mockResolvedValue(1);
  });

  it('stores each transcript message in the ConversationStore', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport();

    const result = await processEndOfCallReport(report);

    expect(conversationStore.storeMessage).toHaveBeenCalledTimes(6);
    expect(result.messageCount).toBe(6);
  });

  it('stores user role messages as inbound and assistant as outbound', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport();

    await processEndOfCallReport(report);

    const calls = (conversationStore.storeMessage as ReturnType<typeof vi.fn>).mock.calls;

    // First message is user -> inbound
    expect(calls[0][2]).toBe('inbound');
    // Second message is assistant -> outbound
    expect(calls[1][2]).toBe('outbound');
    // Third message is user -> inbound
    expect(calls[2][2]).toBe('inbound');
  });

  it('resolves caller identity via contactResolver when phone is known', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport();

    const result = await processEndOfCallReport(report);

    expect(contactResolver.resolve).toHaveBeenCalledWith('+447700900123', 'phone');
    expect(result.callerIdentified).toBe(true);
  });

  it('handles unknown caller (no phone number) gracefully', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport({
      call: { id: 'call-456', customer: {} },
    });

    // For unknown caller, contactResolver should not be called, contactId = 0
    const result = await processEndOfCallReport(report);

    expect(result.callerIdentified).toBe(false);
    expect(result.conversationId).toBe(100);
  });

  it('creates audit log entry with call duration', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport();

    await processEndOfCallReport(report);

    expect(auditLogger.logResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'supervisor',
        conversationId: 100,
        channel: 'phone',
      }),
    );
  });

  it('returns correct messageCount and callerIdentified flag', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport();

    const result = await processEndOfCallReport(report);

    expect(result.conversationId).toBe(100);
    expect(result.messageCount).toBe(6);
    expect(result.callerIdentified).toBe(true);
  });

  it('handles empty transcript gracefully', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport({
      artifact: { messages: [] },
    });

    const result = await processEndOfCallReport(report);

    expect(conversationStore.storeMessage).not.toHaveBeenCalled();
    expect(result.messageCount).toBe(0);
  });

  it('handles missing artifact gracefully', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport({
      artifact: undefined,
    });

    const result = await processEndOfCallReport(report);

    expect(conversationStore.storeMessage).not.toHaveBeenCalled();
    expect(result.messageCount).toBe(0);
  });

  it('uses stored CallerContext when provided', async () => {
    const { processEndOfCallReport } = await import('../../server/agents/voice/callLifecycle');
    const report = buildReport();
    const storedContext = {
      contactId: 55,
      contactType: 'landlord',
      contactName: 'Mr Smith',
      conversationId: 200,
      recentSummary: null,
    };

    const result = await processEndOfCallReport(report, storedContext);

    // Should NOT call contactResolver since we have stored context
    expect(contactResolver.resolve).not.toHaveBeenCalled();
    expect(result.callerIdentified).toBe(true);
  });
});
