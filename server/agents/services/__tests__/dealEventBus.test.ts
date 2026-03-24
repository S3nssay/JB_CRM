/**
 * Tests for DealEventBus, DealService, and DEAL_EVENTS constant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted mocks (vi.mock is hoisted, so mock fns must be too) ----
const { mockSend, mockWork, mockStart, mockQuery } = vi.hoisted(() => ({
  mockSend: vi.fn().mockReturnValue(Promise.resolve('job-id-123')),
  mockWork: vi.fn().mockReturnValue(Promise.resolve(undefined)),
  mockStart: vi.fn().mockReturnValue(Promise.resolve(undefined)),
  mockQuery: vi.fn(),
}));

vi.mock('pg-boss', () => {
  class PgBossMock {
    start = mockStart;
    send = mockSend;
    work = mockWork;
  }
  return { default: PgBossMock };
});

vi.mock('../../../db', () => ({
  pool: { query: mockQuery },
}));

// ---- Import after mocks ----
import { dealEventBus, DEAL_EVENTS, type DealEventPayload } from '../dealEventBus';
import { dealService } from '../dealService';

describe('DEAL_EVENTS constant', () => {
  it('contains all 10 event names', () => {
    const events = Object.values(DEAL_EVENTS);
    expect(events).toHaveLength(10);
    expect(events).toContain('tenancy.agreed');
    expect(events).toContain('tenancy.ending');
    expect(events).toContain('lease.renewal_due');
    expect(events).toContain('rent.review_due');
    expect(events).toContain('sale.agreed');
    expect(events).toContain('sale.collapsed');
    expect(events).toContain('step.completed');
    expect(events).toContain('step.failed');
    expect(events).toContain('step.timed_out');
    expect(events).toContain('cross.referral');
  });
});

describe('DealEventBus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('emit sends a pg-boss job to correct queue name', async () => {
    const payload: DealEventPayload = {
      dealId: 1,
      propertyId: 10,
      dealType: 'lettings_agreed',
    };
    await dealEventBus.emit('tenancy.agreed', payload);

    expect(mockSend).toHaveBeenCalledWith(
      'deal-event.tenancy.agreed',
      expect.objectContaining({
        dealId: 1,
        propertyId: 10,
        dealType: 'lettings_agreed',
        sourceEventId: expect.any(String),
      })
    );
  });

  it('subscribe registers a worker on correct queue name', async () => {
    const handler = vi.fn();
    await dealEventBus.subscribe('tenancy.agreed', handler);

    expect(mockWork).toHaveBeenCalledWith(
      'deal-event.tenancy.agreed',
      expect.any(Function)
    );
  });
});

describe('DealService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createDeal returns a deal with status active', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, deal_type: 'lettings_agreed', status: 'active', property_id: 10 }],
    });

    const deal = await dealService.createDeal({
      dealType: 'lettings_agreed',
      propertyId: 10,
    });

    expect(deal.status).toBe('active');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO deal'),
      expect.any(Array)
    );
  });

  it('createDealStep creates a step with status pending', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, deal_id: 1, step_id: 'right_to_rent', status: 'pending' }],
    });

    const step = await dealService.createDealStep({
      dealId: 1,
      stepId: 'right_to_rent',
      stepName: 'Right to Rent Check',
      agentType: 'admin',
    });

    expect(step.status).toBe('pending');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO deal_step'),
      expect.any(Array)
    );
  });

  it('createDealEvent creates a timeline event', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, deal_id: 1, event_type: 'pipeline.started', title: 'Pipeline started' }],
    });

    const event = await dealService.createDealEvent({
      dealId: 1,
      eventType: 'pipeline.started',
      title: 'Pipeline started',
      actorType: 'system',
    });

    expect(event.event_type).toBe('pipeline.started');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO deal_event'),
      expect.any(Array)
    );
  });

  it('createNotification creates a notification for a staff user', async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: 1, user_id: 5, title: 'Step timed out', type: 'timeout' }],
    });

    const notification = await dealService.createNotification({
      userId: 5,
      dealId: 1,
      title: 'Step timed out',
      type: 'timeout',
    });

    expect(notification.user_id).toBe(5);
    expect(notification.type).toBe('timeout');
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO notification'),
      expect.any(Array)
    );
  });
});
