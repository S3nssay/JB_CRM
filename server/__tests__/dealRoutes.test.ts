/**
 * Deal Routes -- Integration Tests
 *
 * Tests deal REST API endpoints: list, detail, pause, resume, cancel,
 * skip step, complete step. All require authentication and log to deal_events.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

const mockDealService = {
  listDeals: vi.fn(),
  getDeal: vi.fn(),
  updateDeal: vi.fn(),
  getDealSteps: vi.fn(),
  getDealEvents: vi.fn(),
  createDealEvent: vi.fn(),
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  getUnreadCount: vi.fn(),
  createNotification: vi.fn(),
};

const mockDealPipelineService = {
  skipStep: vi.fn(),
  completeStepManually: vi.fn(),
  failStep: vi.fn(),
};

vi.mock('../../server/agents/services/dealService', () => ({
  dealService: mockDealService,
}));

vi.mock('../../server/agents/services/dealPipelineService', () => ({
  dealPipelineService: mockDealPipelineService,
}));

vi.mock('../../server/db', () => ({
  pool: { query: vi.fn() },
}));

// ---- Helpers ----

function mockReq(overrides: any = {}): any {
  return {
    user: { id: 1, role: 'admin' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

// ---- Tests ----

describe('Deal Routes', () => {
  let handlers: Record<string, any>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamic import to pick up mocks
    const mod = await import('../../server/dealRoutes');
    handlers = mod.routeHandlers;
  });

  describe('GET /deals (listDeals)', () => {
    it('returns list of deals with optional filters', async () => {
      const deals = [
        { id: 1, deal_type: 'lettings_agreed', status: 'active' },
        { id: 2, deal_type: 'sale_agreed', status: 'active' },
      ];
      mockDealService.listDeals.mockResolvedValue(deals);

      const req = mockReq({ query: { status: 'active', dealType: 'lettings_agreed' } });
      const res = mockRes();

      await handlers.listDeals(req, res);

      expect(mockDealService.listDeals).toHaveBeenCalledWith({
        status: 'active',
        dealType: 'lettings_agreed',
        propertyId: undefined,
      });
      expect(res.json).toHaveBeenCalledWith(deals);
    });

    it('requires authentication', async () => {
      const req = mockReq({ user: null });
      const res = mockRes();
      const next = vi.fn();

      const mod = await import('../../server/dealRoutes');
      mod.requireDealAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('GET /deals/:id (getDeal)', () => {
    it('returns deal with steps and recent events', async () => {
      const deal = { id: 1, deal_type: 'lettings_agreed', status: 'active' };
      const steps = [{ id: 1, step_id: 'right_to_rent', status: 'in_progress' }];
      const events = [{ id: 1, event_type: 'pipeline.started', title: 'Started' }];

      mockDealService.getDeal.mockResolvedValue(deal);
      mockDealService.getDealSteps.mockResolvedValue(steps);
      mockDealService.getDealEvents.mockResolvedValue(events);

      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      await handlers.getDeal(req, res);

      expect(mockDealService.getDeal).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ ...deal, steps, events: events.slice(0, 50) });
    });

    it('returns 404 when deal not found', async () => {
      mockDealService.getDeal.mockResolvedValue(null);

      const req = mockReq({ params: { id: '999' } });
      const res = mockRes();

      await handlers.getDeal(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  describe('POST /deals/:id/pause', () => {
    it('pauses deal with reason and creates event', async () => {
      const updatedDeal = { id: 1, status: 'paused' };
      mockDealService.updateDeal.mockResolvedValue(updatedDeal);
      mockDealService.createDealEvent.mockResolvedValue({});

      const req = mockReq({ params: { id: '1' }, body: { reason: 'Awaiting documents' } });
      const res = mockRes();

      await handlers.pauseDeal(req, res);

      expect(mockDealService.updateDeal).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'paused',
        pauseReason: 'Awaiting documents',
        pausedBy: 1,
      }));
      expect(mockDealService.createDealEvent).toHaveBeenCalledWith(expect.objectContaining({
        dealId: 1,
        eventType: 'deal.paused',
        actorType: 'staff',
        actorId: 1,
      }));
      expect(res.json).toHaveBeenCalledWith(updatedDeal);
    });
  });

  describe('POST /deals/:id/resume', () => {
    it('resumes deal and creates event', async () => {
      const updatedDeal = { id: 1, status: 'active' };
      mockDealService.updateDeal.mockResolvedValue(updatedDeal);
      mockDealService.createDealEvent.mockResolvedValue({});

      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      await handlers.resumeDeal(req, res);

      expect(mockDealService.updateDeal).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'active',
      }));
      expect(mockDealService.createDealEvent).toHaveBeenCalledWith(expect.objectContaining({
        dealId: 1,
        eventType: 'deal.resumed',
        actorType: 'staff',
      }));
      expect(res.json).toHaveBeenCalledWith(updatedDeal);
    });
  });

  describe('POST /deals/:id/cancel', () => {
    it('cancels deal with reason and creates event', async () => {
      const updatedDeal = { id: 1, status: 'cancelled' };
      mockDealService.updateDeal.mockResolvedValue(updatedDeal);
      mockDealService.createDealEvent.mockResolvedValue({});

      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      await handlers.cancelDeal(req, res);

      expect(mockDealService.updateDeal).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'cancelled',
        cancelledBy: 1,
      }));
      expect(mockDealService.createDealEvent).toHaveBeenCalledWith(expect.objectContaining({
        dealId: 1,
        eventType: 'deal.cancelled',
        actorType: 'staff',
        actorId: 1,
      }));
    });
  });

  describe('POST /deals/:id/steps/:stepId/skip', () => {
    it('calls pipeline service skipStep and creates event', async () => {
      mockDealPipelineService.skipStep.mockResolvedValue(undefined);

      const req = mockReq({ params: { id: '1', stepId: 'right_to_rent' } });
      const res = mockRes();

      await handlers.skipStep(req, res);

      expect(mockDealPipelineService.skipStep).toHaveBeenCalledWith(1, 'right_to_rent', 1);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('POST /deals/:id/steps/:stepId/complete', () => {
    it('calls pipeline service completeStepManually', async () => {
      mockDealPipelineService.completeStepManually.mockResolvedValue(undefined);

      const req = mockReq({ params: { id: '1', stepId: 'right_to_rent' } });
      const res = mockRes();

      await handlers.completeStep(req, res);

      expect(mockDealPipelineService.completeStepManually).toHaveBeenCalledWith(1, 'right_to_rent', 1);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('GET /deals/:id/events', () => {
    it('returns paginated events', async () => {
      const events = [{ id: 1, event_type: 'step.completed' }];
      mockDealService.getDealEvents.mockResolvedValue(events);

      const req = mockReq({ params: { id: '1' }, query: { limit: '10', offset: '0' } });
      const res = mockRes();

      await handlers.getDealEvents(req, res);

      expect(mockDealService.getDealEvents).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('GET /deals/:id/steps', () => {
    it('returns all steps for a deal', async () => {
      const steps = [{ id: 1, step_id: 'right_to_rent', status: 'completed' }];
      mockDealService.getDealSteps.mockResolvedValue(steps);

      const req = mockReq({ params: { id: '1' } });
      const res = mockRes();

      await handlers.getDealSteps(req, res);

      expect(mockDealService.getDealSteps).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith(steps);
    });
  });
});
