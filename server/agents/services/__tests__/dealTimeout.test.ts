/**
 * Tests for DealPipelineService timeout handling and escalation.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted mocks ----
const { mockQuery, mockUpdateDealStep, mockCreateDealEvent, mockEscalate, mockCreateNotification,
  mockGetDeal, mockEmit } = vi.hoisted(() => ({
  mockQuery: vi.fn(),
  mockUpdateDealStep: vi.fn(),
  mockCreateDealEvent: vi.fn().mockReturnValue(Promise.resolve({ id: 1 })),
  mockEscalate: vi.fn().mockReturnValue(Promise.resolve({ escalationId: 1, assignedTo: 1, notified: true })),
  mockCreateNotification: vi.fn().mockReturnValue(Promise.resolve({ id: 1 })),
  mockGetDeal: vi.fn(),
  mockEmit: vi.fn().mockReturnValue(Promise.resolve('job-id')),
}));

vi.mock('../../../db', () => ({
  pool: { query: mockQuery },
}));

vi.mock('../dealService', () => ({
  dealService: {
    updateDealStep: mockUpdateDealStep,
    createDealEvent: mockCreateDealEvent,
    createNotification: mockCreateNotification,
    getDeal: mockGetDeal,
    createDealStep: vi.fn(),
    getDealSteps: vi.fn(),
    updateDeal: vi.fn(),
    getDealStepByStepId: vi.fn(),
  },
}));

vi.mock('../dealEventBus', () => ({
  dealEventBus: {
    emit: mockEmit,
    subscribe: vi.fn().mockReturnValue(Promise.resolve(undefined)),
  },
  DEAL_EVENTS: {
    TENANCY_AGREED: 'tenancy.agreed',
    TENANCY_ENDING: 'tenancy.ending',
    LEASE_RENEWAL_DUE: 'lease.renewal_due',
    RENT_REVIEW_DUE: 'rent.review_due',
    SALE_AGREED: 'sale.agreed',
    SALE_COLLAPSED: 'sale.collapsed',
    STEP_COMPLETED: 'step.completed',
    STEP_FAILED: 'step.failed',
    STEP_TIMED_OUT: 'step.timed_out',
    CROSS_REFERRAL: 'cross.referral',
  },
}));

vi.mock('../escalationService', () => ({
  escalationService: {
    escalateToStaff: mockEscalate,
  },
}));

vi.mock('pg-boss', () => {
  class PgBossMock {
    start = vi.fn().mockReturnValue(Promise.resolve(undefined));
    send = vi.fn().mockReturnValue(Promise.resolve('job-id'));
    work = vi.fn().mockReturnValue(Promise.resolve(undefined));
    schedule = vi.fn().mockReturnValue(Promise.resolve(undefined));
  }
  return { default: PgBossMock };
});

import { dealPipelineService } from '../dealPipelineService';

describe('dealPipelineService.checkTimeouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('finds overdue steps and escalates them', async () => {
    const overdueSteps = [
      { id: 10, deal_id: 1, step_id: 'right_to_rent', step_name: 'Right to Rent', agent_type: 'admin', timeout_at: new Date('2025-01-01') },
    ];
    mockQuery.mockResolvedValueOnce({ rows: overdueSteps });
    mockGetDeal.mockResolvedValueOnce({ id: 1, property_id: 5, deal_type: 'lettings_agreed' });
    mockUpdateDealStep.mockResolvedValueOnce({ id: 10 });

    await dealPipelineService.checkTimeouts();

    // Should query for overdue steps
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('timeout_at'),
      expect.anything()
    );

    // Should escalate
    expect(mockEscalate).toHaveBeenCalled();

    // Should mark escalated_at on step
    expect(mockUpdateDealStep).toHaveBeenCalledWith(10, expect.objectContaining({
      escalatedAt: expect.any(Date),
    }));

    // Should create deal event for timeout
    expect(mockCreateDealEvent).toHaveBeenCalledWith(expect.objectContaining({
      dealId: 1,
      eventType: 'step.timed_out',
    }));
  });

  it('does not re-escalate already-escalated steps', async () => {
    // Query returns no rows (already-escalated are filtered by WHERE escalated_at IS NULL)
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await dealPipelineService.checkTimeouts();

    expect(mockEscalate).not.toHaveBeenCalled();
  });

  it('creates deal event with correct metadata for timeout', async () => {
    const overdueSteps = [
      { id: 20, deal_id: 2, step_id: 'market_comparison', step_name: 'Market Comparison', agent_type: 'lettings', timeout_at: new Date('2025-01-01') },
    ];
    mockQuery.mockResolvedValueOnce({ rows: overdueSteps });
    mockGetDeal.mockResolvedValueOnce({ id: 2, property_id: 15, deal_type: 'rent_review' });
    mockUpdateDealStep.mockResolvedValueOnce({ id: 20 });

    await dealPipelineService.checkTimeouts();

    expect(mockCreateDealEvent).toHaveBeenCalledWith(expect.objectContaining({
      dealId: 2,
      eventType: 'step.timed_out',
      stepId: 'market_comparison',
      title: expect.stringContaining('timed out'),
      actorType: 'system',
    }));
  });
});
