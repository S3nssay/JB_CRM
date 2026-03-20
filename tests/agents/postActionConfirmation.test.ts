/**
 * Post-Action Confirmation Tests
 *
 * Tests that after agent actions (viewing booked, lead captured),
 * immediate confirmations are sent and follow-ups scheduled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  pool: { query: vi.fn() },
}));

vi.mock('@shared/schema', () => ({
  conversations: {},
  messages: { id: 'id', conversationId: 'conversation_id', direction: 'direction', isAiGenerated: 'is_ai_generated', createdAt: 'created_at' },
  agentAuditLog: { id: 'id', conversationId: 'conversation_id', action: 'action' },
  contactIdentities: { identifierValue: 'identifier_value', optedOut: 'opted_out' },
  staffProfiles: { id: 'id' },
  users: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  or: vi.fn(),
}));

const mockSendPreferred = vi.fn().mockResolvedValue(true);
const mockSend = vi.fn().mockResolvedValue(true);

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: {
    send: mockSend,
    sendPreferred: mockSendPreferred,
  },
}));

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logResponse: vi.fn().mockResolvedValue(undefined),
    logEscalation: vi.fn().mockResolvedValue(undefined),
    logToolCall: vi.fn().mockResolvedValue(undefined),
    logRouting: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockPgBossSend = vi.fn().mockResolvedValue('job-id-123');
const mockPgBossWork = vi.fn();
const mockPgBossStart = vi.fn();

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = mockPgBossSend;
    this.work = mockPgBossWork;
    this.start = mockPgBossStart;
  });
  return { default: MockPgBoss };
});

describe('Post-Action Confirmations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handlePostActions', () => {
    it('should send immediate confirmation on same channel after viewing booked', async () => {
      const { handlePostActions } = await import('../../server/agents/services/scheduledMessages');

      await handlePostActions({
        action: 'book_viewing',
        contactPhone: '+447700900000',
        channel: 'whatsapp',
        viewingId: 42,
        viewingDate: new Date('2026-04-01T14:00:00Z'),
        propertyAddress: '10 Downing Street',
      });

      // Immediate confirmation sent on same channel
      expect(mockSend).toHaveBeenCalledWith(
        'whatsapp',
        '+447700900000',
        expect.stringContaining('viewing'),
      );
    });

    it('should schedule 2 reminder jobs after viewing booked', async () => {
      const { handlePostActions } = await import('../../server/agents/services/scheduledMessages');

      await handlePostActions({
        action: 'book_viewing',
        contactPhone: '+447700900000',
        channel: 'whatsapp',
        viewingId: 42,
        viewingDate: new Date('2026-04-01T14:00:00Z'),
        propertyAddress: '10 Downing Street',
      });

      // 2 viewing reminder jobs scheduled (24h before + morning-of)
      const reminderCalls = mockPgBossSend.mock.calls.filter(
        (c: any[]) => c[0] === 'viewing-reminder'
      );
      expect(reminderCalls).toHaveLength(2);
    });

    it('should send email summary after viewing booked regardless of original channel', async () => {
      const { handlePostActions } = await import('../../server/agents/services/scheduledMessages');

      await handlePostActions({
        action: 'book_viewing',
        contactPhone: '+447700900000',
        contactEmail: 'test@example.com',
        channel: 'sms', // Original channel is SMS
        viewingId: 42,
        viewingDate: new Date('2026-04-01T14:00:00Z'),
        propertyAddress: '10 Downing Street',
      });

      // Email summary sent regardless of original channel
      expect(mockSend).toHaveBeenCalledWith(
        'email',
        'test@example.com',
        expect.any(String),
        expect.objectContaining({ subject: expect.stringContaining('Viewing') }),
      );
    });

    it('should send email summary after lead captured', async () => {
      const { handlePostActions } = await import('../../server/agents/services/scheduledMessages');

      await handlePostActions({
        action: 'create_lead',
        contactPhone: '+447700900001',
        contactEmail: 'lead@example.com',
        channel: 'whatsapp',
        leadName: 'Jane Smith',
        leadType: 'buyer',
      });

      expect(mockSend).toHaveBeenCalledWith(
        'email',
        'lead@example.com',
        expect.any(String),
        expect.objectContaining({ subject: expect.stringContaining('enquiry') }),
      );
    });
  });
});
