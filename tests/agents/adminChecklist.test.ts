/**
 * Admin Agent & Checklist Service — Unit Tests
 *
 * Tests for onboarding/offboarding checklist generation, chase mechanism,
 * escalation after 3 chases, and Admin agent configuration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies -- chainable db mock
const mockWhere = vi.fn();
const mockLimit = vi.fn().mockResolvedValue([]);

function createChainableSelect() {
  const chain: any = {
    from: vi.fn().mockImplementation(() => ({
      where: (...args: any[]) => mockWhere(...args),
      orderBy: vi.fn().mockReturnThis(),
      limit: mockLimit,
    })),
  };
  return chain;
}

const mockInsert = vi.fn().mockImplementation(() => ({
  values: vi.fn().mockImplementation(() => ({
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    then: (resolve: any) => resolve(undefined),
  })),
}));

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => createChainableSelect()),
    insert: (...args: any[]) => mockInsert(...args),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  pool: { query: vi.fn() },
}));

vi.mock('@shared/schema', async () => {
  const actual = await vi.importActual('@shared/schema');
  return {
    ...actual,
    agentAuditLog: { id: 'id', conversationId: 'conversation_id', action: 'action' },
    staffProfiles: { id: 'id', userId: 'user_id', department: 'department', isActive: 'is_active' },
    users: { id: 'id', email: 'email', fullName: 'full_name', role: 'role', isActive: 'is_active' },
  };
});

vi.mock('drizzle-orm', async () => {
  const actual = await vi.importActual('drizzle-orm');
  return {
    ...actual,
    eq: vi.fn(),
    and: vi.fn(),
    desc: vi.fn(),
  };
});

vi.mock('zod4', async () => {
  return await import('zod');
});

const mockAuditLogger = {
  logResponse: vi.fn().mockResolvedValue(undefined),
  logEscalation: vi.fn().mockResolvedValue(undefined),
  logToolCall: vi.fn().mockResolvedValue(undefined),
  logRouting: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: mockAuditLogger,
}));

const mockMessageSender = {
  send: vi.fn().mockResolvedValue(true),
  sendPreferred: vi.fn().mockResolvedValue(true),
};

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: mockMessageSender,
}));

const mockEscalationService = {
  escalate: vi.fn().mockResolvedValue({ escalationId: 1, assignedTo: 5, notified: true }),
};

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: mockEscalationService,
}));

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

vi.mock('../../server/agents/middleware/aiIdentification', () => ({
  ensureAIIdentification: vi.fn((text: string, isFirst: boolean) =>
    isFirst ? `I'm an AI assistant at John Barclay Estate Agents. ${text}` : text
  ),
  isFirstAIMessage: vi.fn().mockResolvedValue(false),
}));

describe('ChecklistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWhere.mockReturnValue({ limit: mockLimit });
    mockLimit.mockResolvedValue([]);
  });

  it('should generate onboarding checklist with onboarding, compliance, and general items', async () => {
    const { checklistService } = await import('../../server/agents/services/checklistService');

    const result = await checklistService.generateChecklist(100, 'onboarding');

    expect(result.created).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    // Should include onboarding items
    expect(result.items).toContain('tenancy_agreement');
    // Should include compliance items
    expect(result.items).toContain('right_to_rent_check');
    // Should include general items
    expect(result.items).toContain('keys_given_to_tenant');
    // Should NOT include end_of_tenancy items
    expect(result.items).not.toContain('serve_notice');
    expect(result.items).not.toContain('checkout_inspection');

    // Verify db.insert was called
    expect(mockInsert).toHaveBeenCalled();
  });

  it('should generate offboarding checklist with end_of_tenancy items', async () => {
    const { checklistService } = await import('../../server/agents/services/checklistService');

    const result = await checklistService.generateChecklist(200, 'offboarding');

    expect(result.created).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThan(0);
    // Should include end_of_tenancy items
    expect(result.items).toContain('serve_notice');
    expect(result.items).toContain('checkout_inspection');
    expect(result.items).toContain('key_return');
    // Should NOT include onboarding items
    expect(result.items).not.toContain('tenancy_agreement');
    expect(result.items).not.toContain('standing_order');
  });

  it('should chase an item: send message and log to audit', async () => {
    // First call: item lookup returns the item
    // Second call: audit log chase count returns empty (no previous chases)
    let callCount = 0;
    mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Item lookup - must be thenable (awaitable)
        return Promise.resolve([{ id: 42, itemType: 'tenancy_agreement', tenancyId: 100, isCompleted: false }]);
      }
      // Audit log query - needs .limit()
      return { limit: vi.fn().mockResolvedValue([]) };
    });

    const { checklistService } = await import('../../server/agents/services/checklistService');

    const result = await checklistService.chaseItem(42, 'whatsapp', '+447700900000', 100);

    expect(result.chased).toBe(true);
    expect(result.escalated).toBe(false);
    expect(mockMessageSender.send).toHaveBeenCalledWith(
      'whatsapp',
      '+447700900000',
      expect.stringContaining('Tenancy Agreement'),
      undefined,
    );
    expect(mockAuditLogger.logToolCall).toHaveBeenCalled();
  });

  it('should escalate after 3 previous chases', async () => {
    let callCount = 0;
    mockWhere.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // Item lookup - must be thenable
        return Promise.resolve([{ id: 42, itemType: 'gas_safety_certificate', tenancyId: 100, isCompleted: false }]);
      }
      // Audit log query - return 3 chase records matching this item
      return {
        limit: vi.fn().mockResolvedValue([
          { toolInput: JSON.stringify({ toolName: 'chase_checklist_item', itemId: 42 }) },
          { toolInput: JSON.stringify({ toolName: 'chase_checklist_item', itemId: 42 }) },
          { toolInput: JSON.stringify({ toolName: 'chase_checklist_item', itemId: 42 }) },
        ]),
      };
    });

    const { checklistService } = await import('../../server/agents/services/checklistService');

    const result = await checklistService.chaseItem(42, 'email', 'landlord@example.com', 100);

    expect(result.escalated).toBe(true);
    expect(result.chased).toBe(false);
    expect(mockEscalationService.escalate).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining('overdue'),
        urgency: 'high',
      }),
    );
  });
});

describe('Admin Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be named "Sam from Admin"', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    expect(adminAgent.name).toBe('Sam from Admin');
  });

  it('should use gpt-4o model', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    expect(adminAgent.model).toBe('gpt-4o');
  });

  it('should have exactly 3 tools', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    expect(adminAgent.tools).toHaveLength(3);
  });

  it('should include generate_checklist tool', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    const toolNames = adminAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('generate_checklist');
  });

  it('should include chase_checklist_item tool', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    const toolNames = adminAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('chase_checklist_item');
  });

  it('should include escalate_to_human tool', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    const toolNames = adminAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('escalate_to_human');
  });

  it('should mention Sam in instructions', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    expect(adminAgent.instructions).toContain('Sam');
  });

  it('should mention British conventions in instructions', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    const instructions = adminAgent.instructions.toLowerCase();
    expect(instructions).toContain('british');
  });

  it('should mention checklist/document management in instructions', async () => {
    const { adminAgent } = await import('../../server/agents/sdk/adminAgent');
    const instructions = adminAgent.instructions.toLowerCase();
    expect(instructions).toContain('checklist');
    expect(instructions).toContain('document');
  });
});
