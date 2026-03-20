/**
 * Supervisor Agent Routing — Unit Tests
 *
 * Tests that the Supervisor classifies intent correctly, routes to the
 * right specialist agent, applies AI identification, and handles
 * ambiguous messages.
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
  staffProfiles: { id: 'id', userId: 'user_id', department: 'department', isActive: 'is_active' },
  users: { id: 'id', email: 'email', fullName: 'full_name', role: 'role', isActive: 'is_active' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('zod4', async () => {
  return await import('zod');
});

// Track what the mock run() returns for each test
let mockRunResult: any = { finalOutput: 'Test response' };

vi.mock('@openai/agents', () => {
  // Agent must be a proper constructor
  class MockAgent {
    name: string;
    model: string;
    instructions: string;
    tools: any[];
    handoffs: any[];
    constructor(config: any) {
      this.name = config.name;
      this.model = config.model;
      this.instructions = config.instructions;
      this.tools = config.tools || [];
      this.handoffs = config.handoffs || [];
    }
  }
  return {
    Agent: MockAgent,
    tool: (config: any) => ({
      type: 'function',
      name: config.name,
      description: config.description,
      parameters: config.parameters,
      execute: config.execute,
    }),
    handoff: vi.fn().mockImplementation((agent: any, options?: any) => ({
      type: 'handoff',
      agent,
      ...options,
    })),
    run: vi.fn().mockImplementation(async () => mockRunResult),
  };
});

const mockConversationStore = {
  getConversationHistory: vi.fn().mockResolvedValue([]),
  storeMessage: vi.fn().mockResolvedValue(1),
};

vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: mockConversationStore,
}));

const mockAuditLogger = {
  logResponse: vi.fn().mockResolvedValue(undefined),
  logEscalation: vi.fn().mockResolvedValue(undefined),
  logToolCall: vi.fn().mockResolvedValue(undefined),
  logRouting: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: mockAuditLogger,
}));

vi.mock('../../server/agents/middleware/aiIdentification', () => ({
  ensureAIIdentification: vi.fn((text: string, isFirst: boolean) =>
    isFirst ? `I'm an AI assistant at John Barclay Estate Agents. ${text}` : text
  ),
  isFirstAIMessage: vi.fn().mockResolvedValue(true),
}));

const mockMessageSender = {
  send: vi.fn().mockResolvedValue(true),
  sendPreferred: vi.fn().mockResolvedValue(true),
};

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: mockMessageSender,
}));

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: {
    escalate: vi.fn().mockResolvedValue({ escalationId: 1, assignedTo: 5, notified: true }),
  },
}));

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = vi.fn();
    this.work = vi.fn();
    this.start = vi.fn();
  });
  return { default: MockPgBoss };
});

describe('Supervisor Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunResult = { finalOutput: 'Test response' };
  });

  it('should be configured with correct name and model', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    expect(supervisorAgent).toBeDefined();
    expect(supervisorAgent.name).toBe('Supervisor');
    expect(supervisorAgent.model).toBe('gpt-4o');
  });

  it('should have handoffs to Sales, Lettings, and Admin', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    expect(supervisorAgent.handoffs).toBeDefined();
    expect(supervisorAgent.handoffs.length).toBe(3);
  });

  it('should hand off to real Lettings agent named "Jordan from Lettings"', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    const lettingsHandoff = supervisorAgent.handoffs.find(
      (h: any) => h.agent && h.agent.name === 'Jordan from Lettings',
    );
    expect(lettingsHandoff).toBeDefined();
    expect(lettingsHandoff.toolNameOverride).toBe('transfer_to_lettings');
    expect(lettingsHandoff.toolDescription).toContain('rental');
  });

  it('should hand off to real Sales agent named "Alex from Sales"', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    const salesHandoff = supervisorAgent.handoffs.find(
      (h: any) => h.agent && h.agent.name === 'Alex from Sales',
    );
    expect(salesHandoff).toBeDefined();
    expect(salesHandoff.toolNameOverride).toBe('transfer_to_sales');
    expect(salesHandoff.toolDescription).toContain('purchase');
  });

  it('should include escalateToHumanTool in tools', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    expect(supervisorAgent.tools).toBeDefined();
    const toolNames = supervisorAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('escalate_to_human');
  });

  it('should include instructions about professional tone and British conventions', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    expect(supervisorAgent.instructions).toContain('John Barclay');
    expect(supervisorAgent.instructions.toLowerCase()).toContain('professional');
  });
});

describe('runAgent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunResult = { finalOutput: 'I can help you with that property viewing.' };
  });

  it('should call run() and return the agent response', async () => {
    const { runAgent } = await import('../../server/agents/sdk/runner');
    const { run } = await import('@openai/agents');

    const context = {
      conversationId: 1,
      contactId: 2,
      channel: 'whatsapp' as const,
      isFirstMessage: false,
      agentType: 'supervisor' as const,
    };

    const result = await runAgent({}, 'Show me flats in Chelsea', context);

    expect(run).toHaveBeenCalled();
    expect(result).toContain('property viewing');
  });

  it('should prepend AI identification on first message', async () => {
    const { runAgent } = await import('../../server/agents/sdk/runner');
    const { isFirstAIMessage } = await import('../../server/agents/middleware/aiIdentification');
    (isFirstAIMessage as any).mockResolvedValue(true);

    const context = {
      conversationId: 1,
      contactId: 2,
      channel: 'whatsapp' as const,
      isFirstMessage: true,
      agentType: 'supervisor' as const,
    };

    const result = await runAgent({}, 'Hello', context);

    expect(result).toContain('AI assistant');
  });

  it('should NOT prepend AI identification on subsequent messages', async () => {
    const { runAgent } = await import('../../server/agents/sdk/runner');
    const { isFirstAIMessage } = await import('../../server/agents/middleware/aiIdentification');
    (isFirstAIMessage as any).mockResolvedValue(false);

    mockRunResult = { finalOutput: 'Here are some properties.' };

    const context = {
      conversationId: 1,
      contactId: 2,
      channel: 'whatsapp' as const,
      isFirstMessage: false,
      agentType: 'supervisor' as const,
    };

    const result = await runAgent({}, 'Show me more', context);

    expect(result).not.toContain('AI assistant');
    expect(result).toBe('Here are some properties.');
  });

  it('should store outbound message in ConversationStore', async () => {
    const { runAgent } = await import('../../server/agents/sdk/runner');

    const context = {
      conversationId: 5,
      contactId: 2,
      channel: 'sms' as const,
      isFirstMessage: false,
      agentType: 'supervisor' as const,
    };

    await runAgent({}, 'Any flats near Brixton?', context);

    expect(mockConversationStore.storeMessage).toHaveBeenCalledWith(
      5,
      expect.objectContaining({
        channel: 'sms',
        body: expect.any(String),
      }),
      'outbound',
      'supervisor',
    );
  });

  it('should load conversation history from ConversationStore', async () => {
    const { runAgent } = await import('../../server/agents/sdk/runner');

    mockConversationStore.getConversationHistory.mockResolvedValue([
      { direction: 'inbound', content: 'Hi there', createdAt: new Date() },
      { direction: 'outbound', content: 'Hello, how can I help?', createdAt: new Date() },
    ]);

    const context = {
      conversationId: 10,
      contactId: 3,
      channel: 'email' as const,
      isFirstMessage: false,
      agentType: 'supervisor' as const,
    };

    await runAgent({}, 'I want to view a property', context);

    expect(mockConversationStore.getConversationHistory).toHaveBeenCalledWith(10, 20);
  });
});
