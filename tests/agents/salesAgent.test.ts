/**
 * Sales Agent — Unit Tests
 *
 * Tests that the Sales agent (Alex from Sales) has the correct persona,
 * tools, instructions, and follow-up scheduling behaviour.
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

// Track pg-boss send calls
const mockPgBossSend = vi.fn().mockResolvedValue('job-id-123');

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = mockPgBossSend;
    this.work = vi.fn();
    this.start = vi.fn();
  });
  return { default: MockPgBoss };
});

vi.mock('@openai/agents', () => {
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
    run: vi.fn().mockResolvedValue({ finalOutput: 'Test response' }),
  };
});

vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: {
    getConversationHistory: vi.fn().mockResolvedValue([]),
    storeMessage: vi.fn().mockResolvedValue(1),
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
  ensureAIIdentification: vi.fn((text: string, isFirst: boolean) =>
    isFirst ? `I'm an AI assistant at John Barclay Estate Agents. ${text}` : text
  ),
  isFirstAIMessage: vi.fn().mockResolvedValue(false),
}));

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: {
    send: vi.fn().mockResolvedValue(true),
    sendPreferred: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: {
    escalate: vi.fn().mockResolvedValue({ escalationId: 1, assignedTo: 5, notified: true }),
  },
}));

describe('Sales Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be named "Alex from Sales"', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    expect(salesAgent.name).toBe('Alex from Sales');
  });

  it('should use gpt-4o model', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    expect(salesAgent.model).toBe('gpt-4o');
  });

  it('should have exactly 9 tools', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    expect(salesAgent.tools).toHaveLength(9);
  });

  it('should include search_properties tool', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const toolNames = salesAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('search_properties');
  });

  it('should include book_viewing tool', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const toolNames = salesAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('book_viewing');
  });

  it('should include create_lead tool', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const toolNames = salesAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('create_lead');
  });

  it('should include query_knowledge_base tool', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const toolNames = salesAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('query_knowledge_base');
  });

  it('should include escalate_to_human tool', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const toolNames = salesAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('escalate_to_human');
  });

  it('should include schedule_follow_up tool', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const toolNames = salesAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('schedule_follow_up');
  });

  it('should mention Alex in instructions', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    expect(salesAgent.instructions).toContain('Alex');
  });

  it('should mention negotiation in instructions', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    expect(salesAgent.instructions.toLowerCase()).toContain('negotiat');
  });

  it('should mention British conventions in instructions', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const instructions = salesAgent.instructions.toLowerCase();
    expect(instructions).toContain('british');
  });

  it('should mention channel-aware formatting in instructions', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const instructions = salesAgent.instructions.toLowerCase();
    expect(instructions).toContain('sms');
    expect(instructions).toContain('whatsapp');
  });

  it('should mention stale data handling in instructions', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const instructions = salesAgent.instructions.toLowerCase();
    expect(instructions).toContain('stale');
  });

  it('should mention escalation triggers in instructions', async () => {
    const { salesAgent } = await import('../../server/agents/sdk/salesAgent');
    const instructions = salesAgent.instructions.toLowerCase();
    expect(instructions).toContain('escalat');
  });
});

describe('scheduleFollowUpTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should queue 3 pg-boss follow-up jobs', async () => {
    const { scheduleFollowUpTool } = await import('../../server/agents/sdk/salesAgent');

    const context = {
      conversationId: 1,
      contactId: 2,
      channel: 'whatsapp' as const,
      isFirstMessage: false,
      agentType: 'sales' as const,
    };

    const input = {
      contactPhone: '+447700900000',
      contactEmail: 'test@example.com',
      channel: 'whatsapp',
      leadType: 'buyer',
      propertyIds: [10, 20],
    };

    const result = await scheduleFollowUpTool.execute(context, input);

    expect(mockPgBossSend).toHaveBeenCalledTimes(3);

    // Verify job names
    const jobNames = mockPgBossSend.mock.calls.map((c: any[]) => c[0]);
    expect(jobNames).toContain('follow-up-thanks');
    expect(jobNames).toContain('follow-up-similar');
    expect(jobNames).toContain('follow-up-checkin');
  });

  it('should return confirmation message', async () => {
    const { scheduleFollowUpTool } = await import('../../server/agents/sdk/salesAgent');

    const context = {
      conversationId: 1,
      contactId: 2,
      channel: 'sms' as const,
      isFirstMessage: false,
      agentType: 'sales' as const,
    };

    const input = {
      contactPhone: '+447700900001',
      channel: 'sms',
      leadType: 'buyer',
    };

    const result = await scheduleFollowUpTool.execute(context, input);

    expect(typeof result).toBe('string');
    expect(result).toContain('follow-up');
  });
});
