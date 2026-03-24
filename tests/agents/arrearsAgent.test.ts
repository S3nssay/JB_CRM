/**
 * Arrears Agent -- Unit Tests
 *
 * Tests the arrears agent (Sarah from Accounts), SDK tools,
 * and vulnerability detection integration.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock('@shared/schema', () => ({
  arrears: { id: 'id', tenantId: 'tenant_id', status: 'status', notes: 'notes', amount: 'amount', daysOverdue: 'days_overdue', dunningLevel: 'dunning_level', propertyId: 'property_id', lastReminderSent: 'last_reminder_sent', updatedAt: 'updated_at' },
  dunningActions: { id: 'id', arrearsId: 'arrears_id', actionType: 'action_type', channel: 'channel', status: 'status', sentAt: 'sent_at', createdAt: 'created_at' },
  contactIdentities: { id: 'id', contactId: 'contact_id', contactType: 'contact_type', identifierType: 'identifier_type', identifierValue: 'identifier_value', isPrimary: 'is_primary', optedOut: 'opted_out' },
  tenant: { id: 'id', name: 'name' },
  properties: { id: 'id', address: 'address' },
  agentAuditLog: { id: 'id', conversationId: 'conversation_id', action: 'action' },
  staffProfiles: { id: 'id', userId: 'user_id', department: 'department', isActive: 'is_active' },
  users: { id: 'id', email: 'email', fullName: 'full_name', role: 'role', isActive: 'is_active' },
  conversations: {},
  messages: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  gte: vi.fn(),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({ type: 'sql', strings, values }),
    { join: vi.fn() }
  ),
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

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logResponse: vi.fn().mockResolvedValue(undefined),
    logEscalation: vi.fn().mockResolvedValue(undefined),
    logToolCall: vi.fn().mockResolvedValue(undefined),
    logRouting: vi.fn().mockResolvedValue(undefined),
  },
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

const mockCanContact = vi.fn();
const mockLogContactAttempt = vi.fn();
vi.mock('../../server/agents/services/arrearsComplianceGuard', () => ({
  arrearsComplianceGuard: {
    canContact: (...args: any[]) => mockCanContact(...args),
    logContactAttempt: (...args: any[]) => mockLogContactAttempt(...args),
    getContactHistory: vi.fn().mockResolvedValue([]),
  },
  ArrearsComplianceGuard: vi.fn(),
}));

vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: {
    getConversationHistory: vi.fn().mockResolvedValue([]),
    storeMessage: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../../server/agents/middleware/aiIdentification', () => ({
  ensureAIIdentification: vi.fn((text: string, isFirst: boolean) =>
    isFirst ? `I'm an AI assistant. ${text}` : text
  ),
  isFirstAIMessage: vi.fn().mockResolvedValue(false),
}));

// ---- Test context ----

const testContext = {
  conversationId: 1,
  contactId: 2,
  channel: 'whatsapp' as const,
  isFirstMessage: false,
  agentType: 'arrears' as const,
};

// ---- Tests ----

describe('Arrears Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be named "Sarah from Accounts"', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');
    expect(arrearsAgent.name).toBe('Sarah from Accounts');
  });

  it('should have exactly 4 tools', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');
    expect(arrearsAgent.tools).toHaveLength(4);
  });

  it('should include all required tools', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');
    const toolNames = arrearsAgent.tools.map((t: any) => t.name);
    expect(toolNames).toContain('lookup_arrears_case');
    expect(toolNames).toContain('send_payment_reminder');
    expect(toolNames).toContain('escalate_arrears_case');
    expect(toolNames).toContain('escalate_to_human');
  });

  it('instructions mention empathy and vulnerability', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');
    const instructions = arrearsAgent.instructions.toLowerCase();
    expect(instructions).toContain('empathetic');
    expect(instructions).toContain('vulnerability');
  });

  it('instructions prohibit threats and legal action discussion', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');
    const instructions = arrearsAgent.instructions.toLowerCase();
    expect(instructions).toContain('never threaten');
    expect(instructions).toContain('never discuss legal action');
  });

  it('instructions mention Sarah as AI assistant', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');
    expect(arrearsAgent.instructions).toContain('Sarah');
    expect(arrearsAgent.instructions).toContain('AI assistant');
  });
});

describe('lookupArrearsCaseTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns case details when arrears found', async () => {
    const { db } = await import('../../server/db');

    // Mock the chained queries to return data
    let limitCallCount = 0;
    (db.limit as any).mockImplementation(() => {
      limitCallCount++;
      if (limitCallCount === 1) return Promise.resolve([{ id: 1, name: 'John Doe' }]); // tenant
      if (limitCallCount === 2) return Promise.resolve([{ id: 5, address: '123 High St' }]); // property
      if (limitCallCount === 3) return Promise.resolve([]); // dunning actions
      return Promise.resolve([]);
    });

    // The arrears query uses where() without limit() -- make it thenable
    let whereCallCount = 0;
    (db.where as any).mockImplementation(() => {
      whereCallCount++;
      const chain = {
        limit: db.limit,
        orderBy: db.orderBy,
        then: (resolve: any) => {
          // First where call = arrears query
          if (whereCallCount === 1) {
            return resolve([{ id: 10, tenantId: 2, propertyId: 5, amount: 150000, daysOverdue: 14, dunningLevel: 1, status: 'active', lastReminderSent: null }]);
          }
          return resolve([]);
        },
      };
      return chain;
    });

    // Re-mock orderBy to chain to limit
    (db.orderBy as any).mockReturnValue({
      limit: db.limit,
    });

    const { lookupArrearsCaseTool } = await import('../../server/agents/sdk/tools');
    const result = await lookupArrearsCaseTool.execute(testContext, { tenantId: 2 });
    const parsed = JSON.parse(result);

    expect(parsed.found).toBe(true);
    expect(parsed.arrears.amount).toBe(150000);
    expect(parsed.arrears.amountFormatted).toBe('£1500.00');
  });
});

describe('sendPaymentReminderTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('checks compliance before sending', async () => {
    mockCanContact.mockResolvedValue({ allowed: true, reason: null, nextAllowedAt: null });
    mockLogContactAttempt.mockResolvedValue(undefined);

    const { db } = await import('../../server/db');

    // Mock arrears lookup
    (db.limit as any).mockImplementation(() => {
      return Promise.resolve([{ id: 10, tenantId: 2, amount: 50000 }]);
    });

    // Mock contact identity lookup
    let whereCallCount = 0;
    (db.where as any).mockImplementation(() => {
      whereCallCount++;
      return {
        limit: () => {
          if (whereCallCount === 1) return Promise.resolve([{ id: 10, tenantId: 2, amount: 50000 }]);
          return Promise.resolve([{ id: 1, identifierType: 'phone', identifierValue: '+447700900000', isPrimary: true }]);
        },
      };
    });

    const { messageSender } = await import('../../server/agents/services/messageSender');

    const { sendPaymentReminderTool } = await import('../../server/agents/sdk/tools');
    const result = await sendPaymentReminderTool.execute(testContext, {
      arrearsId: 10,
      channel: 'sms',
      message: 'Please pay your rent',
    });

    expect(mockCanContact).toHaveBeenCalled();
    expect(messageSender.send).toHaveBeenCalled();

    const parsed = JSON.parse(result);
    expect(parsed.sent).toBe(true);
  });

  it('blocks when compliance denies', async () => {
    mockCanContact.mockResolvedValue({ allowed: false, reason: 'Contact sent within 48 hours', nextAllowedAt: new Date('2026-01-07T10:00:00Z') });
    mockLogContactAttempt.mockResolvedValue(undefined);

    const { db } = await import('../../server/db');
    (db.where as any).mockImplementation(() => ({
      limit: () => Promise.resolve([{ id: 10, tenantId: 2, amount: 50000 }]),
    }));

    const { messageSender } = await import('../../server/agents/services/messageSender');

    const { sendPaymentReminderTool } = await import('../../server/agents/sdk/tools');
    const result = await sendPaymentReminderTool.execute(testContext, {
      arrearsId: 10,
      channel: 'sms',
      message: 'Please pay your rent',
    });

    expect(mockCanContact).toHaveBeenCalled();
    // messageSender.send should NOT have been called
    expect(messageSender.send).not.toHaveBeenCalled();

    const parsed = JSON.parse(result);
    expect(parsed.sent).toBe(false);
    expect(parsed.reason).toBe('Contact sent within 48 hours');
    // Blocked attempt should still be logged
    expect(mockLogContactAttempt).toHaveBeenCalledWith(
      10, 'sms', 'sms', 'blocked', expect.stringContaining('Blocked'),
    );
  });
});

describe('escalateArrearsCaseTool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls escalation service and updates dunning level', async () => {
    const { escalationService } = await import('../../server/agents/services/escalationService');
    const { db } = await import('../../server/db');

    (db.where as any).mockReturnValue(Promise.resolve(undefined));

    const { escalateArrearsCaseTool } = await import('../../server/agents/sdk/tools');
    const result = await escalateArrearsCaseTool.execute(testContext, {
      arrearsId: 10,
      reason: 'Tenant expressed financial hardship',
    });

    expect(escalationService.escalate).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: expect.stringContaining('Arrears case #10'),
        urgency: 'urgent',
      }),
    );

    expect(db.update).toHaveBeenCalled();
    expect(result).toContain('escalated');
  });
});

describe('Vulnerability integration', () => {
  it('vulnerability detected in tenant message triggers escalation path', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');

    // Simulate detecting vulnerability in a tenant message
    const message = "I can't afford to pay, I lost my job and I'm really struggling";
    const result = vulnerabilityDetector.detect(message);

    expect(result.detected).toBe(true);
    expect(result.category).toBe('financial');

    // In real flow, this detection would trigger escalateArrearsCaseTool
    // The agent's instructions mandate escalation when vulnerability is detected
    // The compliance guard also blocks future contact once VULNERABILITY_DETECTED is set
  });
});
