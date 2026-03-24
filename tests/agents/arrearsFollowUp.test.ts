/**
 * Arrears Follow-Up Worker -- Unit Tests
 *
 * Tests the payment-commitment-followup pg-boss worker that verifies
 * payments on commitment dates and handles follow-up chains.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

const mockDb: any = vi.hoisted(() => {
  const db: any = {};
  db.select = vi.fn(function() { return db; });
  db.from = vi.fn(function() { return db; });
  db.where = vi.fn(function() { return db; });
  db.orderBy = vi.fn(function() { return db; });
  db.limit = vi.fn(function() { return Promise.resolve([]); });
  db.insert = vi.fn(function() { return db; });
  db.values = vi.fn(function() { return Promise.resolve(undefined); });
  db.update = vi.fn(function() { return db; });
  db.set = vi.fn(function() { return db; });
  db.returning = vi.fn(function() { return Promise.resolve([{ id: 99 }]); });
  return db;
});

vi.mock('../../server/db', () => ({
  db: mockDb,
}));

vi.mock('@shared/schema', () => ({
  arrears: { id: 'id', tenantId: 'tenant_id', status: 'status', notes: 'notes', amount: 'amount', daysOverdue: 'days_overdue', dunningLevel: 'dunning_level', propertyId: 'property_id', lastReminderSent: 'last_reminder_sent', updatedAt: 'updated_at' },
  dunningActions: { id: 'id', arrearsId: 'arrears_id', actionType: 'action_type', channel: 'channel', status: 'status', sentAt: 'sent_at', createdAt: 'created_at', notes: 'notes' },
  contactIdentities: { id: 'id', contactId: 'contact_id', contactType: 'contact_type', identifierType: 'identifier_type', identifierValue: 'identifier_value', isPrimary: 'is_primary', optedOut: 'opted_out' },
  payments: { id: 'id', tenantId: 'tenant_id', amount: 'amount', status: 'status', paidAt: 'paid_at' },
  gocardlessMandates: { id: 'id', tenantId: 'tenant_id', status: 'status' },
  agentAuditLog: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => args),
  and: vi.fn((...args: any[]) => args),
  gte: vi.fn((...args: any[]) => args),
  lte: vi.fn((...args: any[]) => args),
  or: vi.fn((...args: any[]) => args),
  desc: vi.fn((col: any) => col),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({ type: 'sql', strings, values }),
    { join: vi.fn() },
  ),
}));

// Use vi.hoisted to ensure mock objects are available at vi.mock time
const { mockAuditLogger, mockMessageSender, mockComplianceGuard, mockEscalationService, mockPgBossSend, mockPgBossWork } = vi.hoisted(() => ({
  mockAuditLogger: {
    logToolCall: vi.fn().mockResolvedValue(undefined),
    logEscalation: vi.fn().mockResolvedValue(undefined),
  },
  mockMessageSender: {
    send: vi.fn().mockResolvedValue(true),
    sendPreferred: vi.fn().mockResolvedValue(true),
  },
  mockComplianceGuard: {
    canContact: vi.fn().mockResolvedValue({ allowed: true, reason: null, nextAllowedAt: null }),
    logContactAttempt: vi.fn().mockResolvedValue(undefined),
  },
  mockEscalationService: {
    escalate: vi.fn().mockResolvedValue({ escalationId: 1, assignedTo: 5 }),
  },
  mockPgBossSend: vi.fn().mockResolvedValue('job-id-456'),
  mockPgBossWork: vi.fn(),
}));

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: mockAuditLogger,
  AuditLogger: vi.fn(),
}));

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: mockMessageSender,
  MessageSender: vi.fn(),
}));

vi.mock('../../server/agents/services/arrearsComplianceGuard', () => ({
  arrearsComplianceGuard: mockComplianceGuard,
  ArrearsComplianceGuard: vi.fn(),
}));

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: mockEscalationService,
}));

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = mockPgBossSend;
    this.work = mockPgBossWork;
    this.start = vi.fn();
  });
  return { default: MockPgBoss };
});

// ---- Import the service after mocks ----

import { ScheduledMessageService } from '../../server/agents/services/scheduledMessages';

// ---- Helpers ----

/**
 * Extract the worker handler registered for 'payment-commitment-followup' queue
 */
async function getFollowUpWorker(): Promise<(job: any) => Promise<void>> {
  const svc = new ScheduledMessageService();
  await svc.start();

  const call = mockPgBossWork.mock.calls.find((c: any[]) => c[0] === 'payment-commitment-followup');
  if (!call) throw new Error('payment-commitment-followup worker not registered');
  return call[1];
}

const baseJobData = {
  arrearsId: 7,
  tenantId: 42,
  contactPhone: '+447700900001',
  channel: 'sms' as const,
  commitAmount: 150000,
  commitDate: '2026-04-01',
  attemptNumber: 1,
};

// ---- Tests ----

describe('payment-commitment-followup worker', () => {
  beforeEach(() => {
    mockPgBossWork.mockClear();
    mockPgBossSend.mockClear();
    mockAuditLogger.logToolCall.mockClear();
    mockMessageSender.sendPreferred.mockClear();
    mockComplianceGuard.canContact.mockClear();
    mockComplianceGuard.logContactAttempt.mockClear();
    mockEscalationService.escalate.mockClear();
    mockDb.limit.mockClear();
    mockDb.update.mockClear();
    mockDb.set.mockClear();
    mockDb.insert.mockClear();
    mockDb.values.mockClear();
  });

  it('verifies payment received and clears arrears', async () => {
    const worker = await getFollowUpWorker();

    // Mock opt-out check (not opted out)
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{ optedOut: false }]));

    // Mock payment check -- payment was received
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{
      id: 100,
      tenantId: 42,
      amount: 150000,
      status: 'completed',
      paidAt: new Date('2026-04-01T10:00:00Z'),
    }]));

    // Mock arrears lookup for status update
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{
      id: 7,
      amount: 150000,
      status: 'active',
    }]));

    await worker({ data: baseJobData });

    // Verify audit log was called with success
    expect(mockAuditLogger.logToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'payment_commitment_verified',
      }),
    );

    // Verify arrears status was updated
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'cleared',
      }),
    );

    // Verify no message was sent (payment resolved)
    expect(mockMessageSender.sendPreferred).not.toHaveBeenCalled();
  });

  it('verifies partial payment and updates arrears', async () => {
    const worker = await getFollowUpWorker();

    // Opt-out check
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{ optedOut: false }]));

    // Payment check -- partial payment (75000 of 150000)
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{
      id: 101,
      tenantId: 42,
      amount: 75000,
      status: 'completed',
      paidAt: new Date('2026-04-01T10:00:00Z'),
    }]));

    // Arrears lookup
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{
      id: 7,
      amount: 150000,
      status: 'active',
    }]));

    await worker({ data: baseJobData });

    expect(mockDb.set).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'partially_paid',
      }),
    );
  });

  it('sends follow-up when payment not received and compliance allows', async () => {
    const worker = await getFollowUpWorker();

    // Opt-out check
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{ optedOut: false }]));

    // No payment found
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([]));

    // Compliance allows contact
    mockComplianceGuard.canContact.mockResolvedValueOnce({ allowed: true, reason: null, nextAllowedAt: null });

    await worker({ data: baseJobData });

    // Verify follow-up message sent
    expect(mockMessageSender.sendPreferred).toHaveBeenCalledWith(
      '+447700900001',
      expect.stringContaining('committed payment'),
    );

    // Verify compliance logged
    expect(mockComplianceGuard.logContactAttempt).toHaveBeenCalled();

    // Verify another follow-up scheduled (attemptNumber + 1)
    expect(mockPgBossSend).toHaveBeenCalledWith(
      'payment-commitment-followup',
      expect.objectContaining({
        attemptNumber: 2,
      }),
      expect.any(Object),
    );
  });

  it('escalates when payment not received and contact limit reached', async () => {
    const worker = await getFollowUpWorker();

    // Opt-out check
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{ optedOut: false }]));

    // No payment
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([]));

    // Compliance blocks with escalation reason
    mockComplianceGuard.canContact.mockResolvedValueOnce({
      allowed: false,
      reason: 'Contact limit reached — escalate to human',
      nextAllowedAt: null,
    });

    await worker({ data: baseJobData });

    expect(mockEscalationService.escalate).toHaveBeenCalled();
    expect(mockMessageSender.sendPreferred).not.toHaveBeenCalled();
  });

  it('reschedules when blocked by time-of-day', async () => {
    const worker = await getFollowUpWorker();

    // Opt-out check
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{ optedOut: false }]));

    // No payment
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([]));

    const nextAllowed = new Date('2026-04-02T09:00:00Z');
    mockComplianceGuard.canContact.mockResolvedValueOnce({
      allowed: false,
      reason: 'Outside contact hours (09:00-20:00)',
      nextAllowedAt: nextAllowed,
    });

    await worker({ data: baseJobData });

    // Should reschedule, not escalate
    expect(mockPgBossSend).toHaveBeenCalledWith(
      'payment-commitment-followup',
      expect.objectContaining({
        arrearsId: 7,
      }),
      expect.objectContaining({
        startAfter: nextAllowed.toISOString(),
      }),
    );
    expect(mockEscalationService.escalate).not.toHaveBeenCalled();
  });

  it('escalates after 3 follow-up attempts', async () => {
    const worker = await getFollowUpWorker();

    // Opt-out check
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{ optedOut: false }]));

    // No payment
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([]));

    await worker({ data: { ...baseJobData, attemptNumber: 3 } });

    expect(mockEscalationService.escalate).toHaveBeenCalled();
    expect(mockMessageSender.sendPreferred).not.toHaveBeenCalled();
  });

  it('skips for opted-out tenant', async () => {
    const worker = await getFollowUpWorker();

    // Opted out
    mockDb.limit.mockImplementationOnce(() => Promise.resolve([{ optedOut: true }]));

    await worker({ data: baseJobData });

    // Should not send anything or check payments
    expect(mockMessageSender.sendPreferred).not.toHaveBeenCalled();
    expect(mockComplianceGuard.canContact).not.toHaveBeenCalled();
  });
});

describe('schedulePaymentFollowUp', () => {
  it('submits job to pg-boss queue', async () => {
    mockPgBossWork.mockClear();
    mockPgBossSend.mockClear();

    const svc = new ScheduledMessageService();
    await svc.start();

    const runAt = new Date('2026-04-01T09:00:00Z');
    const jobId = await svc.schedulePaymentFollowUp(baseJobData, runAt);

    expect(jobId).toBeDefined();
    expect(mockPgBossSend).toHaveBeenCalledWith(
      'payment-commitment-followup',
      baseJobData,
      expect.objectContaining({
        startAfter: runAt.toISOString(),
      }),
    );
  });
});
