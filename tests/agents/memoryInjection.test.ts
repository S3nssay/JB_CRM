/**
 * Memory Injection Tests
 *
 * Tests that conversation history from ConversationStore is correctly
 * injected into the agent runner, with proper role mapping and truncation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
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

const mockGetConversationHistory = vi.fn().mockResolvedValue([]);
const mockStoreMessage = vi.fn().mockResolvedValue(1);

vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: {
    getConversationHistory: mockGetConversationHistory,
    storeMessage: mockStoreMessage,
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

vi.mock('../../server/agents/middleware/aiIdentification', () => ({
  ensureAIIdentification: vi.fn((text: string, _isFirst: boolean) => text),
  isFirstAIMessage: vi.fn().mockResolvedValue(false),
}));

const mockRun = vi.fn().mockResolvedValue({ finalOutput: 'Test response' });

vi.mock('@openai/agents', () => ({
  Agent: vi.fn(),
  run: mockRun,
  tool: vi.fn(),
}));

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: {
    send: vi.fn().mockResolvedValue(true),
    sendPreferred: vi.fn().mockResolvedValue(true),
  },
}));

const defaultContext = {
  conversationId: 1,
  contactId: 2,
  channel: 'whatsapp' as const,
  isFirstMessage: false,
  agentType: 'supervisor' as const,
};

describe('Memory Injection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass conversation history + new message to run() when history exists', async () => {
    // 5 previous messages (newest first, as returned by store)
    mockGetConversationHistory.mockResolvedValueOnce([
      { id: 5, content: 'Agent reply 2', direction: 'outbound', createdAt: new Date('2026-03-20T10:04:00Z') },
      { id: 4, content: 'User msg 3', direction: 'inbound', createdAt: new Date('2026-03-20T10:03:00Z') },
      { id: 3, content: 'Agent reply 1', direction: 'outbound', createdAt: new Date('2026-03-20T10:02:00Z') },
      { id: 2, content: 'User msg 2', direction: 'inbound', createdAt: new Date('2026-03-20T10:01:00Z') },
      { id: 1, content: 'User msg 1', direction: 'inbound', createdAt: new Date('2026-03-20T10:00:00Z') },
    ]);

    const { runAgent } = await import('../../server/agents/sdk/runner');
    const mockAgent = {};

    await runAgent(mockAgent, 'New message', defaultContext);

    // run() should receive 6 messages (5 history + 1 new)
    expect(mockRun).toHaveBeenCalledTimes(1);
    const allMessages = mockRun.mock.calls[0][1];
    expect(allMessages).toHaveLength(6);
    expect(allMessages[allMessages.length - 1]).toEqual({ role: 'user', content: 'New message' });
  });

  it('should send only 1 message for new conversation with no history', async () => {
    mockGetConversationHistory.mockResolvedValueOnce([]);

    const { runAgent } = await import('../../server/agents/sdk/runner');
    const mockAgent = {};

    await runAgent(mockAgent, 'Hello', defaultContext);

    const allMessages = mockRun.mock.calls[0][1];
    expect(allMessages).toHaveLength(1);
    expect(allMessages[0]).toEqual({ role: 'user', content: 'Hello' });
  });

  it('should request at most 20 messages from conversation store', async () => {
    mockGetConversationHistory.mockResolvedValueOnce([]);

    const { runAgent } = await import('../../server/agents/sdk/runner');
    const mockAgent = {};

    await runAgent(mockAgent, 'Test', defaultContext);

    // getConversationHistory should be called with limit=20
    expect(mockGetConversationHistory).toHaveBeenCalledWith(1, 20);
  });

  it('should map inbound messages to user role and outbound to assistant role', async () => {
    mockGetConversationHistory.mockResolvedValueOnce([
      { id: 2, content: 'Agent response', direction: 'outbound', createdAt: new Date('2026-03-20T10:01:00Z') },
      { id: 1, content: 'User question', direction: 'inbound', createdAt: new Date('2026-03-20T10:00:00Z') },
    ]);

    const { runAgent } = await import('../../server/agents/sdk/runner');
    const mockAgent = {};

    await runAgent(mockAgent, 'Follow up', defaultContext);

    const allMessages = mockRun.mock.calls[0][1];
    // Reversed: oldest first
    expect(allMessages[0]).toEqual({ role: 'user', content: 'User question' });
    expect(allMessages[1]).toEqual({ role: 'assistant', content: 'Agent response' });
    expect(allMessages[2]).toEqual({ role: 'user', content: 'Follow up' });
  });
});
