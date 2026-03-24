/**
 * Tests for DealPipelineService - pipeline initialization, step advancement, and failure handling.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Hoisted mocks ----
const { mockCreateDealStep, mockUpdateDealStep, mockGetDealSteps, mockCreateDealEvent,
  mockUpdateDeal, mockGetDeal, mockEmit, mockSubscribe, mockEscalate, mockCreateNotification,
  mockPoolQuery, mockGenerateChecklist, mockSend, mockSendPreferred } = vi.hoisted(() => ({
  mockCreateDealStep: vi.fn(),
  mockUpdateDealStep: vi.fn(),
  mockGetDealSteps: vi.fn(),
  mockCreateDealEvent: vi.fn(),
  mockUpdateDeal: vi.fn(),
  mockGetDeal: vi.fn(),
  mockEmit: vi.fn().mockReturnValue(Promise.resolve('job-id')),
  mockSubscribe: vi.fn().mockReturnValue(Promise.resolve(undefined)),
  mockEscalate: vi.fn().mockReturnValue(Promise.resolve({ escalationId: 1, assignedTo: 1, notified: true })),
  mockCreateNotification: vi.fn(),
  mockPoolQuery: vi.fn().mockReturnValue(Promise.resolve({ rows: [] })),
  mockGenerateChecklist: vi.fn().mockReturnValue(Promise.resolve({ created: 3, items: ['item1', 'item2', 'item3'] })),
  mockSend: vi.fn().mockReturnValue(Promise.resolve(true)),
  mockSendPreferred: vi.fn().mockReturnValue(Promise.resolve(true)),
}));

vi.mock('../dealService', () => ({
  dealService: {
    createDealStep: mockCreateDealStep,
    updateDealStep: mockUpdateDealStep,
    getDealSteps: mockGetDealSteps,
    createDealEvent: mockCreateDealEvent,
    updateDeal: mockUpdateDeal,
    getDeal: mockGetDeal,
    createNotification: mockCreateNotification,
    getDealStepByStepId: vi.fn(),
  },
}));

vi.mock('../dealEventBus', () => ({
  dealEventBus: {
    emit: mockEmit,
    subscribe: mockSubscribe,
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

vi.mock('../../../db', () => ({
  pool: { query: mockPoolQuery },
}));

vi.mock('../checklistService', () => ({
  checklistService: {
    generateChecklist: mockGenerateChecklist,
  },
}));

vi.mock('../messageSender', () => ({
  messageSender: {
    send: mockSend,
    sendPreferred: mockSendPreferred,
  },
}));

// Prevent pg-boss from actually initializing
vi.mock('pg-boss', () => {
  class PgBossMock {
    start = vi.fn().mockReturnValue(Promise.resolve(undefined));
    send = vi.fn().mockReturnValue(Promise.resolve('job-id'));
    work = vi.fn().mockReturnValue(Promise.resolve(undefined));
    schedule = vi.fn().mockReturnValue(Promise.resolve(undefined));
  }
  return { default: PgBossMock };
});

import { dealPipelineService, PIPELINE_TEMPLATES } from '../dealPipelineService';

describe('Pipeline Templates', () => {
  it('LETTINGS_AGREED has 6 steps', () => {
    expect(PIPELINE_TEMPLATES.lettings_agreed).toHaveLength(6);
  });

  it('TENANCY_ENDING has 5 steps', () => {
    expect(PIPELINE_TEMPLATES.tenancy_ending).toHaveLength(5);
  });

  it('RENT_REVIEW has 4 steps: market_comparison, landlord_proposal, tenant_communication, section_13_notice', () => {
    const steps = PIPELINE_TEMPLATES.rent_review;
    expect(steps).toHaveLength(4);
    expect(steps.map(s => s.id)).toEqual([
      'market_comparison', 'landlord_proposal', 'tenant_communication', 'section_13_notice'
    ]);
  });

  it('RENT_REVIEW section_13_notice is optional and depends on landlord_proposal', () => {
    const s13 = PIPELINE_TEMPLATES.rent_review.find(s => s.id === 'section_13_notice')!;
    expect(s13.isOptional).toBe(true);
    expect(s13.dependsOn).toContain('landlord_proposal');
  });

  it('SALE_AGREED has 4 steps', () => {
    expect(PIPELINE_TEMPLATES.sale_agreed).toHaveLength(4);
  });

  it('SALE_COLLAPSED has 3 steps', () => {
    expect(PIPELINE_TEMPLATES.sale_collapsed).toHaveLength(3);
  });

  it('defines all 6 pipeline types', () => {
    const keys = Object.keys(PIPELINE_TEMPLATES);
    expect(keys).toContain('lettings_agreed');
    expect(keys).toContain('tenancy_ending');
    expect(keys).toContain('lease_renewal');
    expect(keys).toContain('rent_review');
    expect(keys).toContain('sale_agreed');
    expect(keys).toContain('sale_collapsed');
  });
});

describe('dealPipelineService.initializePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDealStep.mockImplementation(async (data: any) => ({
      id: Math.floor(Math.random() * 1000),
      ...data,
      status: data.dependsOn && data.dependsOn.length > 0 ? 'pending' : 'pending',
    }));
    mockCreateDealEvent.mockResolvedValue({ id: 1 });
    mockUpdateDealStep.mockImplementation(async (id: number, data: any) => ({ id, ...data }));
    mockUpdateDeal.mockResolvedValue({ id: 1 });
  });

  it('creates correct number of steps for lettings_agreed pipeline', async () => {
    await dealPipelineService.initializePipeline('lettings_agreed', { id: 1, property_id: 10, deal_type: 'lettings_agreed' });
    expect(mockCreateDealStep).toHaveBeenCalledTimes(6);
  });

  it('creates correct number of steps for rent_review pipeline', async () => {
    await dealPipelineService.initializePipeline('rent_review', { id: 2, property_id: 20, deal_type: 'rent_review' });
    expect(mockCreateDealStep).toHaveBeenCalledTimes(4);
  });

  it('starts steps with no dependencies immediately (status=in_progress)', async () => {
    await dealPipelineService.initializePipeline('lettings_agreed', { id: 1, property_id: 10, deal_type: 'lettings_agreed' });

    // Steps with no dependencies should be updated to in_progress
    const startedCalls = mockUpdateDealStep.mock.calls;
    expect(startedCalls.length).toBeGreaterThan(0);
    // At least one call should set status to in_progress
    const hasInProgress = startedCalls.some((call: any[]) => call[1]?.status === 'in_progress');
    expect(hasInProgress).toBe(true);
  });
});

describe('dealPipelineService.advanceStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDealEvent.mockResolvedValue({ id: 1 });
    mockUpdateDealStep.mockImplementation(async (id: number, data: any) => ({ id, ...data }));
    mockUpdateDeal.mockResolvedValue({ id: 1 });
    mockEmit.mockResolvedValue('job-id');
  });

  it('marks step completed and starts dependent steps whose ALL dependencies are met', async () => {
    // right_to_rent completed -> ast_contract (depends on right_to_rent) should start
    mockGetDealSteps.mockResolvedValue([
      { id: 1, step_id: 'right_to_rent', status: 'in_progress', depends_on: null, is_skipped: false },
      { id: 2, step_id: 'ast_contract', status: 'pending', depends_on: JSON.stringify(['right_to_rent']), is_skipped: false },
      { id: 3, step_id: 'deposit_registration', status: 'in_progress', depends_on: null, is_skipped: false },
    ]);

    await dealPipelineService.advanceStep(1, 'right_to_rent');

    // Should mark right_to_rent completed
    expect(mockUpdateDealStep).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'completed' }));
    // Should start ast_contract
    expect(mockUpdateDealStep).toHaveBeenCalledWith(2, expect.objectContaining({ status: 'in_progress' }));
  });

  it('does NOT start a step when only some dependencies are met', async () => {
    // Step depends on both A and B, but only A is completed
    mockGetDealSteps.mockResolvedValue([
      { id: 1, step_id: 'step_a', status: 'in_progress', depends_on: null, is_skipped: false },
      { id: 2, step_id: 'step_b', status: 'pending', depends_on: null, is_skipped: false },
      { id: 3, step_id: 'step_c', status: 'pending', depends_on: JSON.stringify(['step_a', 'step_b']), is_skipped: false },
    ]);

    await dealPipelineService.advanceStep(1, 'step_a');

    // step_c should NOT be started (step_b still pending)
    const updateCalls = mockUpdateDealStep.mock.calls;
    const step3Updates = updateCalls.filter((c: any[]) => c[0] === 3);
    const step3Started = step3Updates.some((c: any[]) => c[1]?.status === 'in_progress');
    expect(step3Started).toBe(false);
  });

  it('marks deal completed when all steps are completed or skipped', async () => {
    mockGetDealSteps.mockResolvedValue([
      { id: 1, step_id: 'step_a', status: 'completed', depends_on: null, is_skipped: false },
      { id: 2, step_id: 'step_b', status: 'in_progress', depends_on: null, is_skipped: false },
    ]);

    await dealPipelineService.advanceStep(1, 'step_b');

    expect(mockUpdateDeal).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'completed' }));
  });
});

describe('dealPipelineService.failStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDealSteps.mockResolvedValue([
      { id: 1, step_id: 'right_to_rent', status: 'in_progress', depends_on: null },
    ]);
    mockUpdateDealStep.mockImplementation(async (id: number, data: any) => ({ id, ...data }));
    mockUpdateDeal.mockResolvedValue({ id: 1 });
    mockCreateDealEvent.mockResolvedValue({ id: 1 });
  });

  it('marks step failed and pauses the deal', async () => {
    await dealPipelineService.failStep(1, 'right_to_rent', 'Document expired');

    expect(mockUpdateDealStep).toHaveBeenCalledWith(1, expect.objectContaining({
      status: 'failed',
      failureReason: 'Document expired',
    }));
    expect(mockUpdateDeal).toHaveBeenCalledWith(1, expect.objectContaining({
      status: 'paused',
    }));
  });
});

describe('dealPipelineService.skipStep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDealSteps.mockResolvedValue([
      { id: 1, step_id: 'step_a', status: 'completed', depends_on: null, is_skipped: false },
      { id: 2, step_id: 'optional_step', status: 'pending', depends_on: null, is_skipped: false },
    ]);
    mockUpdateDealStep.mockImplementation(async (id: number, data: any) => ({ id, ...data }));
    mockUpdateDeal.mockResolvedValue({ id: 1 });
    mockCreateDealEvent.mockResolvedValue({ id: 1 });
  });

  it('skips step and advances pipeline', async () => {
    await dealPipelineService.skipStep(1, 'optional_step', 42);

    expect(mockUpdateDealStep).toHaveBeenCalledWith(2, expect.objectContaining({
      isSkipped: true,
      overriddenBy: 42,
      overrideAction: 'skip',
    }));
    // Deal should complete since step_a is completed and optional_step is now skipped
    expect(mockUpdateDeal).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'completed' }));
  });
});

describe('Pipeline step actions fire during initializePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDealStep.mockImplementation(async (data: any) => ({
      id: Math.floor(Math.random() * 1000),
      ...data,
      status: 'pending',
    }));
    mockCreateDealEvent.mockResolvedValue({ id: 1 });
    mockUpdateDealStep.mockImplementation(async (id: number, data: any) => ({ id, ...data }));
    mockUpdateDeal.mockResolvedValue({ id: 1 });
    mockCreateNotification.mockResolvedValue({ id: 1 });
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it('initializePipeline triggers step action events for steps with no deps', async () => {
    await dealPipelineService.initializePipeline('lettings_agreed', {
      id: 1,
      property_id: 10,
      deal_type: 'lettings_agreed',
      tenant_id: 5,
      deal_data: { rentAmount: 150000, depositAmount: 50000, startDate: '2026-04-01' },
    });

    // Wait for fire-and-forget async IIFEs to settle
    await new Promise(resolve => setTimeout(resolve, 50));

    // Step actions should have created deal events and notifications
    // (right_to_rent, deposit_registration, inventory_report, welcome_message, checkin_inspection all have no deps)
    const eventCalls = mockCreateDealEvent.mock.calls;
    const hasStepActionEvents = eventCalls.some((c: any[]) => c[0]?.eventType === 'step.action');
    expect(hasStepActionEvents).toBe(true);
  });

  it('offboarding_checklist step calls checklistService.generateChecklist', async () => {
    await dealPipelineService.initializePipeline('tenancy_ending', {
      id: 2,
      property_id: 20,
      deal_type: 'tenancy_ending',
      tenancy_id: 15,
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    // checklistService.generateChecklist should have been called for offboarding
    expect(mockGenerateChecklist).toHaveBeenCalledWith(15, 'offboarding');
  });

  it('welcome_message step sends message via messageSender', async () => {
    mockPoolQuery
      .mockResolvedValueOnce({ rows: [] }) // property_systems_inventory
      .mockResolvedValueOnce({ rows: [] }) // property_certifications
      .mockResolvedValueOnce({ rows: [{ phone: '+447123456789', email: 'tenant@test.com' }] }); // tenant lookup

    await dealPipelineService.initializePipeline('lettings_agreed', {
      id: 3,
      property_id: 30,
      deal_type: 'lettings_agreed',
      tenant_id: 10,
      deal_data: { rentAmount: 150000, startDate: '2026-04-01' },
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // messageSender.sendPreferred should have been called for welcome message
    expect(mockSendPreferred).toHaveBeenCalled();
  });
});

describe('advanceStep triggers step actions for dependent steps', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDealEvent.mockResolvedValue({ id: 1 });
    mockUpdateDealStep.mockImplementation(async (id: number, data: any) => ({ id, ...data }));
    mockUpdateDeal.mockResolvedValue({ id: 1 });
    mockEmit.mockResolvedValue('job-id');
    mockCreateNotification.mockResolvedValue({ id: 1 });
    mockPoolQuery.mockResolvedValue({ rows: [] });
  });

  it('step action fires for ast_contract when right_to_rent completes', async () => {
    mockGetDealSteps.mockResolvedValue([
      { id: 1, step_id: 'right_to_rent', status: 'in_progress', depends_on: null, is_skipped: false },
      { id: 2, step_id: 'ast_contract', status: 'pending', depends_on: JSON.stringify(['right_to_rent']), is_skipped: false },
    ]);
    mockGetDeal.mockResolvedValue({ id: 1, property_id: 10, deal_type: 'lettings_agreed' });

    await dealPipelineService.advanceStep(1, 'right_to_rent');

    await new Promise(resolve => setTimeout(resolve, 50));

    // ast_contract step action should create a deal event
    const eventCalls = mockCreateDealEvent.mock.calls;
    const hasAstEvent = eventCalls.some((c: any[]) =>
      c[0]?.title?.includes('AST contract')
    );
    expect(hasAstEvent).toBe(true);
  });
});
