/**
 * Lettings Agent — Unit Tests
 *
 * Tests that the Lettings agent (Jordan from Lettings) has the correct persona,
 * tools, instructions, and rental-specific behaviour.
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

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = vi.fn();
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

describe('Lettings Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be named "Jordan from Lettings"', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    expect(lettingsAgent.name).toBe('Jordan from Lettings');
  });

  it('should use gpt-4o model', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    expect(lettingsAgent.model).toBe('gpt-4o');
  });

  it('should have exactly 6 tools', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    expect(lettingsAgent.tools).toHaveLength(6);
  });

  it('should include search_properties tool for rental enquiries', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const toolNames = lettingsAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('search_properties');
  });

  it('should include book_viewing tool for rental viewings', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const toolNames = lettingsAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('book_viewing');
  });

  it('should include create_lead tool for tenant lead capture', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const toolNames = lettingsAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('create_lead');
  });

  it('should include query_knowledge_base tool', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const toolNames = lettingsAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('query_knowledge_base');
  });

  it('should include escalate_to_human tool', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const toolNames = lettingsAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('escalate_to_human');
  });

  it('should include schedule_follow_up tool (reused from Sales)', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const toolNames = lettingsAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('schedule_follow_up');
  });

  it('should mention pcm pricing in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    expect(lettingsAgent.instructions).toContain('pcm');
  });

  it('should mention rental in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    expect(lettingsAgent.instructions.toLowerCase()).toContain('rental');
  });

  it('should mention Jordan in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    expect(lettingsAgent.instructions).toContain('Jordan');
  });

  it('should mention negotiation in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    expect(lettingsAgent.instructions.toLowerCase()).toContain('negotiat');
  });

  it('should mention British conventions in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const instructions = lettingsAgent.instructions.toLowerCase();
    expect(instructions).toContain('british');
  });

  it('should mention channel-aware formatting in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const instructions = lettingsAgent.instructions.toLowerCase();
    expect(instructions).toContain('sms');
    expect(instructions).toContain('whatsapp');
  });

  it('should mention deposit in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const instructions = lettingsAgent.instructions.toLowerCase();
    expect(instructions).toContain('deposit');
  });

  it('should mention tenancy length in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const instructions = lettingsAgent.instructions.toLowerCase();
    expect(instructions).toContain('tenancy');
  });

  it('should mention escalation triggers in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const instructions = lettingsAgent.instructions.toLowerCase();
    expect(instructions).toContain('escalat');
  });

  it('should mention stale data handling in instructions', async () => {
    const { lettingsAgent } = await import('../../server/agents/sdk/lettingsAgent');
    const instructions = lettingsAgent.instructions.toLowerCase();
    expect(instructions).toContain('stale');
  });
});
