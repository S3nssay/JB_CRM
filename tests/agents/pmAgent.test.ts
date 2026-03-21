/**
 * PM Agent — Unit Tests
 *
 * Tests that the PM agent (Morgan from Property Management) has the correct
 * persona, tools, instructions, emergency guidance, and Supervisor routing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies (same pattern as salesAgent.test.ts)
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1, title: 'Test ticket', status: 'new' }]),
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
  maintenanceTickets: { id: 'id', propertyId: 'property_id', tenantId: 'tenant_id', title: 'title', status: 'status' },
  tenant: { id: 'id', name: 'name', email: 'email', phone: 'phone', mobile: 'mobile', propertyId: 'property_id', landlordId: 'landlord_id' },
  properties: { id: 'id', address: 'address' },
  landlords: { id: 'id', name: 'name' },
  propertyCertifications: { id: 'id', propertyId: 'property_id' },
  propertySystemsInventory: { id: 'id', propertyId: 'property_id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  desc: vi.fn(),
}));

vi.mock('zod4', async () => {
  return await import('zod');
});

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

describe('PM Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be named "Morgan from Property Management"', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.name).toBe('Morgan from Property Management');
  });

  it('should use gpt-4o model', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.model).toBe('gpt-4o');
  });

  it('should include classify_and_create_ticket tool', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    const toolNames = pmAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('classify_and_create_ticket');
  });

  it('should include query_knowledge_base tool', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    const toolNames = pmAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('query_knowledge_base');
  });

  it('should include lookup_tenant_property tool', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    const toolNames = pmAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('lookup_tenant_property');
  });

  it('should include escalate_to_human tool', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    const toolNames = pmAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('escalate_to_human');
  });

  it('should mention Morgan in instructions', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.instructions).toContain('Morgan');
  });

  it('should mention empathetic in instructions', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.instructions.toLowerCase()).toContain('empathetic');
  });

  it('should mention British conventions in instructions', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.instructions.toLowerCase()).toContain('british');
  });

  it('should contain gas emergency guidance', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.instructions).toContain('0800 111 999');
  });

  it('should contain flood emergency guidance', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.instructions.toLowerCase()).toContain('stopcock');
  });

  it('should contain security emergency guidance', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.instructions).toContain('999');
  });

  it('should mention escalation triggers in instructions', async () => {
    const { pmAgent } = await import('../../server/agents/sdk/pmAgent');
    expect(pmAgent.instructions.toLowerCase()).toContain('escalat');
  });
});

describe('Supervisor PM routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have handoff to PM agent (transfer_to_property_management)', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    const handoffNames = supervisorAgent.handoffs.map((h: any) => h.toolNameOverride);
    expect(handoffNames).toContain('transfer_to_property_management');
  });

  it('should mention Morgan from Property Management in supervisor instructions', async () => {
    const { supervisorAgent } = await import('../../server/agents/sdk/supervisorAgent');
    expect(supervisorAgent.instructions).toContain('Morgan from Property Management');
  });
});

describe('classifyAndCreateTicketTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call classifyUrgency and return classification data', async () => {
    const { classifyAndCreateTicketTool } = await import('../../server/agents/sdk/pmAgent');

    const context = {
      conversationId: 1,
      contactId: 2,
      channel: 'whatsapp' as const,
      isFirstMessage: false,
      agentType: 'maintenance' as const,
    };

    const input = {
      propertyId: 10,
      tenantId: 5,
      landlordId: 3,
      title: 'Gas leak in kitchen',
      description: 'I can smell gas in the kitchen near the boiler',
      category: 'heating',
    };

    const result = await classifyAndCreateTicketTool.execute(context, input);
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    expect(parsed.urgency).toBe('emergency');
    expect(parsed.score).toBe(10);
    expect(parsed.isEmergency).toBe(true);
    expect(parsed.reasoning).toBeTruthy();
    expect(parsed.ticketId).toBeDefined();
  });

  it('should classify dripping tap as low urgency', async () => {
    const { classifyAndCreateTicketTool } = await import('../../server/agents/sdk/pmAgent');

    const context = {
      conversationId: 1,
      contactId: 2,
      channel: 'sms' as const,
      isFirstMessage: false,
      agentType: 'maintenance' as const,
    };

    const input = {
      propertyId: 10,
      tenantId: 5,
      title: 'Dripping tap',
      description: 'The kitchen tap has been dripping for a few days',
      category: 'plumbing',
    };

    const result = await classifyAndCreateTicketTool.execute(context, input);
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;

    expect(parsed.urgency).toBe('low');
    expect(parsed.isEmergency).toBe(false);
  });
});
