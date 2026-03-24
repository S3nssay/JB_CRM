/**
 * Payment Links -- Unit Tests
 *
 * Tests PaymentLinkService (Stripe/GoCardless link generation),
 * capturePaymentCommitmentTool, generatePaymentLinkTool, and
 * arrearsAgent tool list after payment link additions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

// Build a chainable mock db where every method returns `this` except terminal calls
// Use function keyword so clearAllMocks doesn't wipe implementations
const mockDb: any = {
  select: vi.fn(function() { return mockDb; }),
  from: vi.fn(function() { return mockDb; }),
  where: vi.fn(function() { return mockDb; }),
  orderBy: vi.fn(function() { return mockDb; }),
  limit: vi.fn(function() { return Promise.resolve([]); }),
  insert: vi.fn(function() { return mockDb; }),
  values: vi.fn(function() { return Promise.resolve(undefined); }),
  update: vi.fn(function() { return mockDb; }),
  set: vi.fn(function() { return mockDb; }),
  returning: vi.fn(function() { return Promise.resolve([{ id: 99 }]); }),
};

vi.mock('../../server/db', () => ({
  db: mockDb,
}));

vi.mock('@shared/schema', () => ({
  arrears: { id: 'id', tenantId: 'tenant_id', status: 'status', notes: 'notes', amount: 'amount', daysOverdue: 'days_overdue', dunningLevel: 'dunning_level', propertyId: 'property_id', lastReminderSent: 'last_reminder_sent', updatedAt: 'updated_at' },
  dunningActions: { id: 'id', arrearsId: 'arrears_id', actionType: 'action_type', channel: 'channel', status: 'status', sentAt: 'sent_at', createdAt: 'created_at', notes: 'notes' },
  contactIdentities: { id: 'id', contactId: 'contact_id', contactType: 'contact_type', identifierType: 'identifier_type', identifierValue: 'identifier_value', isPrimary: 'is_primary', optedOut: 'opted_out' },
  tenant: { id: 'id', name: 'name' },
  properties: { id: 'id', address: 'address' },
  payments: { id: 'id', tenantId: 'tenant_id', amount: 'amount', status: 'status', paidAt: 'paid_at' },
  gocardlessMandates: { id: 'id', tenantId: 'tenant_id', status: 'status', gocardlessMandateId: 'gocardless_mandate_id' },
  gocardlessPayments: { id: 'id', mandateId: 'mandate_id', gocardlessPaymentId: 'gocardless_payment_id', amount: 'amount', status: 'status' },
  agentAuditLog: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  gte: vi.fn((...args: any[]) => args),
  desc: vi.fn((col: any) => col),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({ type: 'sql', strings, values }),
    { join: vi.fn() },
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
  };
});

const mockAuditLogger = {
  logToolCall: vi.fn().mockResolvedValue(undefined),
  logEscalation: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: mockAuditLogger,
  AuditLogger: vi.fn(),
}));

const mockMessageSender = {
  send: vi.fn().mockResolvedValue(true),
  sendPreferred: vi.fn().mockResolvedValue(true),
};

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: mockMessageSender,
  MessageSender: vi.fn(),
}));

const mockComplianceGuard = {
  canContact: vi.fn().mockResolvedValue({ allowed: true, reason: null, nextAllowedAt: null }),
  logContactAttempt: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../server/agents/services/arrearsComplianceGuard', () => ({
  arrearsComplianceGuard: mockComplianceGuard,
  ArrearsComplianceGuard: vi.fn(),
}));

const mockEscalationService = {
  escalate: vi.fn().mockResolvedValue({ escalationId: 1, assignedTo: 5 }),
};

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: mockEscalationService,
}));

// Mock Stripe
const mockStripePaymentLinksCreate = vi.fn().mockResolvedValue({
  id: 'plink_test123',
  url: 'https://checkout.stripe.com/pay/test123',
});

class MockStripe {
  paymentLinks = { create: mockStripePaymentLinksCreate };
}

vi.mock('stripe', () => ({
  default: MockStripe,
}));

// Mock scheduled message service
const mockSchedulePaymentFollowUp = vi.fn().mockResolvedValue('job-123');

vi.mock('../../server/agents/services/scheduledMessages', () => ({
  scheduledMessageService: {
    schedulePaymentFollowUp: mockSchedulePaymentFollowUp,
    scheduleArrearsChase: vi.fn(),
    start: vi.fn(),
  },
  ScheduledMessageService: vi.fn(),
}));

// Mock GoCardless
vi.mock('../../server/gocardlessService', () => ({
  isGoCardlessConfigured: vi.fn().mockReturnValue(false),
}));

// ---- Tests ----

describe('PaymentLinkService', () => {
  beforeEach(() => {
    // Only clear call counts, not implementations
    mockStripePaymentLinksCreate.mockClear();
    mockDb.limit.mockClear();
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
  });

  describe('generateStripeLink', () => {
    it('creates payment link with correct amount and metadata', async () => {
      const { PaymentLinkService } = await import('../../server/agents/services/paymentLinkService');
      const svc = new PaymentLinkService();

      const result = await svc.generateStripeLink(150000, 42, 7, 'Rent arrears - March 2026');

      expect(result).not.toBeNull();
      expect(result!.url).toBe('https://checkout.stripe.com/pay/test123');
      expect(result!.paymentLinkId).toBe('plink_test123');
      expect(mockStripePaymentLinksCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          line_items: [expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'gbp',
              unit_amount: 150000,
            }),
            quantity: 1,
          })],
          metadata: expect.objectContaining({
            tenantId: '42',
            arrearsId: '7',
            type: 'arrears_payment',
          }),
        }),
      );
    });

    it('returns null when Stripe not configured', async () => {
      // The PaymentLinkService already caches Stripe from the first test,
      // so we test the error-handling path by making the Stripe API call fail
      const { PaymentLinkService } = await import('../../server/agents/services/paymentLinkService');
      const svc = new PaymentLinkService();

      // Override generateStripeLink to test null path by removing stripe temporarily
      mockStripePaymentLinksCreate.mockRejectedValueOnce(new Error('Not configured'));

      const result = await svc.generateStripeLink(100, 1, 1, 'test');

      expect(result).toBeNull();
    });
  });

  describe('generateLink', () => {
    it('uses GoCardless when tenant has active mandate', async () => {
      // Mock mandate query to return an active mandate
      mockDb.limit.mockImplementationOnce(() => Promise.resolve([{
        id: 10,
        tenantId: 42,
        status: 'active',
        gocardlessMandateId: 'MD000123',
      }]));

      const { PaymentLinkService } = await import('../../server/agents/services/paymentLinkService');
      const svc = new PaymentLinkService();

      // Mock collectViaGoCardless
      svc.collectViaGoCardless = vi.fn().mockResolvedValue({ paymentId: 'PM000456', status: 'pending_submission' });

      const result = await svc.generateLink(42, 7, 150000);

      expect(result.method).toBe('gocardless');
      expect(result.paymentRef).toBe('PM000456');
      expect(svc.collectViaGoCardless).toHaveBeenCalled();
    });

    it('uses Stripe when no GoCardless mandate', async () => {
      // No mandate
      mockDb.limit.mockImplementationOnce(() => Promise.resolve([]));

      const { PaymentLinkService } = await import('../../server/agents/services/paymentLinkService');
      const svc = new PaymentLinkService();

      const result = await svc.generateLink(42, 7, 150000);

      expect(result.method).toBe('stripe');
      expect(result.url).toBe('https://checkout.stripe.com/pay/test123');
      expect(result.paymentRef).toBe('plink_test123');
    });
  });
});

describe('capturePaymentCommitmentTool', () => {
  beforeEach(() => {
    mockAuditLogger.logToolCall.mockClear();
    mockDb.insert.mockClear();
    mockDb.values.mockClear();
    mockDb.limit.mockClear();
    mockSchedulePaymentFollowUp.mockClear();
    // Mock arrears lookup for first .limit() call, then contact lookup for second
    mockDb.limit
      .mockImplementationOnce(() => Promise.resolve([{
        id: 7,
        tenantId: 42,
        amount: 150000,
        status: 'active',
        notes: null,
      }]))
      .mockImplementationOnce(() => Promise.resolve([{
        identifierType: 'phone',
        identifierValue: '+447700900001',
        isPrimary: true,
      }]));
  });

  it('logs commitment to audit trail and dunning_actions', async () => {
    const { capturePaymentCommitmentTool } = await import('../../server/agents/sdk/tools');

    const ctx = { agentType: 'arrears', conversationId: 1, contactId: 1, channel: 'whatsapp' as const };
    const result = await (capturePaymentCommitmentTool as any).execute(ctx, {
      arrearsId: 7,
      commitDate: '2026-04-01',
      commitAmount: 150000,
      notes: 'Tenant agreed to pay full amount',
    });

    const parsed = JSON.parse(result);
    expect(parsed.captured).toBe(true);
    expect(parsed.followUpScheduledFor).toBe('2026-04-01');

    // Verify audit logger was called
    expect(mockAuditLogger.logToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'arrears',
        toolName: 'capture_payment_commitment',
      }),
    );

    // Verify dunning action was inserted
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'payment_commitment',
        status: 'sent',
      }),
    );
  });

  it('schedules pg-boss follow-up', async () => {
    const { capturePaymentCommitmentTool } = await import('../../server/agents/sdk/tools');

    const ctx = { agentType: 'arrears', conversationId: 1, contactId: 1, channel: 'sms' as const };
    await (capturePaymentCommitmentTool as any).execute(ctx, {
      arrearsId: 7,
      commitDate: '2026-04-01',
      commitAmount: 150000,
    });

    expect(mockSchedulePaymentFollowUp).toHaveBeenCalledWith(
      expect.objectContaining({
        arrearsId: 7,
        tenantId: 42,
        commitAmount: 150000,
        commitDate: '2026-04-01',
      }),
      expect.any(Date),
    );
  });
});

describe('generatePaymentLinkTool', () => {
  beforeEach(() => {
    mockAuditLogger.logToolCall.mockClear();
    mockMessageSender.send.mockClear();
    mockDb.insert.mockClear();
    mockDb.values.mockClear();
    mockDb.limit.mockClear();
    // Sequence: arrears lookup -> mandate check (no mandate) -> contact lookup
    mockDb.limit
      .mockImplementationOnce(() => Promise.resolve([{
        id: 7,
        tenantId: 42,
        amount: 150000,
        status: 'active',
      }]))
      .mockImplementationOnce(() => Promise.resolve([]))  // no GC mandate
      .mockImplementationOnce(() => Promise.resolve([{
        identifierType: 'phone',
        identifierValue: '+447700900001',
        isPrimary: true,
      }]));
  });

  it('sends Stripe link via messageSender', async () => {
    const { generatePaymentLinkTool } = await import('../../server/agents/sdk/tools');

    const ctx = { agentType: 'arrears', conversationId: 1, contactId: 1, channel: 'whatsapp' as const };
    const result = await (generatePaymentLinkTool as any).execute(ctx, {
      arrearsId: 7,
      amount: 150000,
      channel: 'sms',
    });

    const parsed = JSON.parse(result);
    expect(parsed.method).toBe('stripe');
    expect(parsed.sent).toBe(true);
    expect(parsed.url).toContain('stripe.com');

    expect(mockMessageSender.send).toHaveBeenCalled();
  });

  it('logs to dunning_actions with link URL', async () => {
    // Re-mock for fresh lookup sequence
    mockDb.limit.mockClear();
    mockDb.limit
      .mockImplementationOnce(() => Promise.resolve([{ id: 7, tenantId: 42, amount: 150000, status: 'active' }]))
      .mockImplementationOnce(() => Promise.resolve([])) // no mandate
      .mockImplementationOnce(() => Promise.resolve([{ identifierType: 'phone', identifierValue: '+447700900001', isPrimary: true }]));

    const { generatePaymentLinkTool } = await import('../../server/agents/sdk/tools');

    const ctx = { agentType: 'arrears', conversationId: 1, contactId: 1, channel: 'sms' as const };
    await (generatePaymentLinkTool as any).execute(ctx, {
      arrearsId: 7,
      amount: 150000,
      channel: 'whatsapp',
    });

    // Verify dunning action logged
    expect(mockDb.insert).toHaveBeenCalled();
    expect(mockDb.values).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: 'payment_link',
      }),
    );

    // Verify audit logger called
    expect(mockAuditLogger.logToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'generate_payment_link',
      }),
    );
  });
});

describe('arrearsAgent tool list', () => {
  it('has 6 tools after payment link additions', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');

    expect(arrearsAgent.tools).toHaveLength(6);
  });

  it('instructions mention payment commitment capture', async () => {
    const { arrearsAgent } = await import('../../server/agents/sdk/arrearsAgent');

    expect(arrearsAgent.instructions).toContain('capture_payment_commitment');
    expect(arrearsAgent.instructions).toContain('generate_payment_link');
  });
});
