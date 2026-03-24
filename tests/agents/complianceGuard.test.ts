/**
 * Compliance Guard & Vulnerability Detector -- Unit Tests
 *
 * Tests all hard-coded compliance rules for arrears contact
 * and vulnerability keyword detection.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Build a chainable mock that tracks query sequences ----

let queryResults: any[] = [];
let queryIndex = 0;

function createChainable(): any {
  const chain: any = {};
  const methods = ['select', 'from', 'where', 'orderBy', 'innerJoin'];
  for (const m of methods) {
    chain[m] = vi.fn((..._args: any[]) => chain);
  }
  // limit() is a terminal that returns the next queued result
  chain.limit = vi.fn((..._args: any[]) => {
    return Promise.resolve(queryResults[queryIndex++] || []);
  });
  // insert().values() chain
  chain.insert = vi.fn((..._args: any[]) => chain);
  chain.values = vi.fn((..._args: any[]) => Promise.resolve(undefined));
  // update().set().where() chain
  chain.update = vi.fn((..._args: any[]) => chain);
  chain.set = vi.fn((..._args: any[]) => chain);
  // For queries without .limit() -- make the chain itself thenable
  // so `await db.select().from().where()` resolves to the next result
  chain.then = (resolve: any, reject?: any) => {
    const result = queryResults[queryIndex++] || [];
    return Promise.resolve(result).then(resolve, reject);
  };
  return chain;
}

let dbMock: any;

vi.mock('../../server/db', () => {
  dbMock = createChainable();
  return { db: dbMock };
});

vi.mock('@shared/schema', () => ({
  arrears: { id: 'id', tenantId: 'tenant_id', status: 'status', notes: 'notes', lastReminderSent: 'last_reminder_sent', updatedAt: 'updated_at' },
  dunningActions: { id: 'id', arrearsId: 'arrears_id', actionType: 'action_type', channel: 'channel', status: 'status', sentAt: 'sent_at', createdAt: 'created_at' },
  contactIdentities: { id: 'id', contactId: 'contact_id', contactType: 'contact_type', optedOut: 'opted_out' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: any[]) => ({ type: 'and', args })),
  gte: vi.fn((...args: any[]) => ({ type: 'gte', args })),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: any[]) => ({ type: 'sql', strings, values }),
    { join: vi.fn((...args: any[]) => ({ type: 'sql_join', args })) }
  ),
}));

// ---- Tests ----

describe('VulnerabilityDetector', () => {
  it('detects financial hardship keywords', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');
    const result = vulnerabilityDetector.detect('I lost my job last week');
    expect(result.detected).toBe(true);
    expect(result.keywords).toContain('lost my job');
    expect(result.category).toBe('financial');
  });

  it('detects mental health keywords', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');
    const result = vulnerabilityDetector.detect("I'm really depressed about this");
    expect(result.detected).toBe(true);
    expect(result.keywords.some((k: string) => k.toLowerCase().includes('depress'))).toBe(true);
    expect(result.category).toBe('mental_health');
  });

  it('detects bereavement keywords', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');
    const result = vulnerabilityDetector.detect('My father died last month');
    expect(result.detected).toBe(true);
    expect(result.keywords).toContain('died');
    expect(result.category).toBe('bereavement');
  });

  it('detects domestic abuse keywords', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');
    const result = vulnerabilityDetector.detect("I'm in a domestic violence situation");
    expect(result.detected).toBe(true);
    expect(result.category).toBe('domestic');
  });

  it('detects health keywords', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');
    const result = vulnerabilityDetector.detect("I'm in hospital at the moment");
    expect(result.detected).toBe(true);
    expect(result.category).toBe('health');
  });

  it('does not flag normal payment discussion', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');
    const result = vulnerabilityDetector.detect("I'll pay on Friday");
    expect(result.detected).toBe(false);
    expect(result.keywords).toHaveLength(0);
    expect(result.category).toBeNull();
  });

  it('detects depressed even in longer sentences', async () => {
    const { vulnerabilityDetector } = await import('../../server/agents/services/vulnerabilityDetector');
    const result = vulnerabilityDetector.detect("I'm not depressed about deposits");
    expect(result.detected).toBe(true);
    expect(result.keywords.some((k: string) => k.toLowerCase().includes('depress'))).toBe(true);
  });
});

describe('ArrearsComplianceGuard', () => {
  let guard: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    queryResults = [];
    queryIndex = 0;

    // Re-setup the chainable mock
    dbMock = createChainable();
    // Patch the mock module
    const dbModule = await import('../../server/db');
    Object.assign(dbModule, { db: dbMock });

    const mod = await import('../../server/agents/services/arrearsComplianceGuard');
    guard = mod.arrearsComplianceGuard;
  });

  it('blocks contact when tenant opted out', async () => {
    // Query 1 (opt-out check, .limit()): returns opted-out contact
    queryResults = [
      [{ id: 1, optedOut: true }],
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Tenant opted out');
  });

  it('blocks contact when vulnerability detected in arrears notes', async () => {
    queryResults = [
      [],  // opt-out check: no opt-out
      [{ id: 10, notes: 'VULNERABILITY_DETECTED - financial hardship', status: 'active' }], // vulnerability check
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Vulnerability detected — case escalated');
  });

  it('blocks contact on Sundays', async () => {
    vi.useFakeTimers();
    // 2026-01-04 is a Sunday
    vi.setSystemTime(new Date('2026-01-04T14:00:00Z'));

    queryResults = [
      [],  // no opt-out
      [],  // no vulnerability (no active arrears with vulnerability flag)
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('No contact on Sundays');

    vi.useRealTimers();
  });

  it('blocks contact before 09:00 UK time', async () => {
    vi.useFakeTimers();
    // Monday 2026-01-05 at 07:30 UTC = 07:30 GMT (winter)
    vi.setSystemTime(new Date('2026-01-05T07:30:00Z'));

    queryResults = [
      [],  // no opt-out
      [],  // no vulnerability
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Outside contact hours (09:00-20:00)');

    vi.useRealTimers();
  });

  it('blocks contact after 20:00 UK time', async () => {
    vi.useFakeTimers();
    // Monday 2026-01-05 at 20:30 UTC = 20:30 GMT (winter)
    vi.setSystemTime(new Date('2026-01-05T20:30:00Z'));

    queryResults = [
      [],  // no opt-out
      [],  // no vulnerability
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Outside contact hours (09:00-20:00)');

    vi.useRealTimers();
  });

  it('blocks message when SMS/WhatsApp sent within 48 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T14:00:00Z'));

    queryResults = [
      [],  // opt-out: none
      [{ id: 10, notes: null, status: 'active' }],  // vulnerability check: active arrears, no vulnerability
      // The rest are thenable (no .limit()):
      [{ id: 10, tenantId: 1, status: 'active' }],  // arrears for remaining checks
      [{ id: 1 }],  // sent actions count: only 1 (under 3)
      [{ id: 1, sentAt: new Date('2026-01-05T10:00:00Z'), channel: 'sms' }],  // 48h window: recent message
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Contact sent within 48 hours');

    vi.useRealTimers();
  });

  it('blocks call when phone call made within 48 hours', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T14:00:00Z'));

    queryResults = [
      [],  // opt-out: none
      [{ id: 10, notes: null, status: 'active' }],  // vulnerability: no
      [{ id: 10, tenantId: 1, status: 'active' }],  // arrears
      [{ id: 1 }],  // sent count: 1 (under 3)
      [{ id: 1, sentAt: new Date('2026-01-05T10:00:00Z'), actionType: 'phone_call' }],  // recent call
    ];

    const result = await guard.canContact(1, 'phone_call');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Call made within 48 hours');

    vi.useRealTimers();
  });

  it('allows message when last contact was 49 hours ago', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T14:00:00Z'));

    queryResults = [
      [],  // opt-out: none
      [{ id: 10, notes: null, status: 'active' }],  // vulnerability: no
      [{ id: 10, tenantId: 1, status: 'active' }],  // arrears
      [{ id: 1 }],  // sent count: 1 (under 3)
      [],  // 48h window: no recent messages (49h ago = outside window)
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();

    vi.useRealTimers();
  });

  it('blocks contact and requires escalation after 3 sent actions', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T14:00:00Z'));

    queryResults = [
      [],  // opt-out: none
      [{ id: 10, notes: null, status: 'active' }],  // vulnerability: no
      [{ id: 10, tenantId: 1, status: 'active' }],  // arrears
      [{ id: 1 }, { id: 2 }, { id: 3 }],  // sent count: 3 (limit reached)
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe('Contact limit reached — escalate to human');

    vi.useRealTimers();
  });

  it('allows contact when all checks pass', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-05T14:00:00Z'));

    queryResults = [
      [],  // opt-out: none
      [{ id: 10, notes: null, status: 'active' }],  // vulnerability: no
      [{ id: 10, tenantId: 1, status: 'active' }],  // arrears
      [],  // sent count: 0
      [],  // 48h window: no recent contacts
    ];

    const result = await guard.canContact(1, 'sms');
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();

    vi.useRealTimers();
  });

  it('logContactAttempt inserts dunning action and updates arrears', async () => {
    queryResults = [];

    await guard.logContactAttempt(10, 'sms', 'sms', 'sent', 'Reminder sent');

    expect(dbMock.insert).toHaveBeenCalled();
    expect(dbMock.update).toHaveBeenCalled();
  });
});
