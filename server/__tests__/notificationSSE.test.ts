/**
 * SSE Notification Endpoint -- Unit Tests
 *
 * Tests SSE streaming, push notifications, client cleanup,
 * and notification REST endpoints.
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
  const listeners: Record<string, Function[]> = {};
  return {
    user: { id: 1, role: 'admin' },
    params: {},
    query: {},
    body: {},
    on(event: string, cb: Function) {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(cb);
    },
    emit(event: string) {
      (listeners[event] || []).forEach(cb => cb());
    },
    ...overrides,
  };
}

function mockRes(): any {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.writeHead = vi.fn();
  res.write = vi.fn().mockReturnValue(true);
  return res;
}

// ---- Tests ----

describe('SSE Notification Endpoint', () => {
  let handlers: Record<string, any>;
  let pushNotification: Function;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset module to clear sseClients state
    vi.resetModules();
    const mod = await import('../../server/dealRoutes');
    handlers = mod.routeHandlers;
    pushNotification = mod.pushNotification;
  });

  describe('GET /notifications/stream (SSE)', () => {
    it('sets correct SSE headers', () => {
      const req = mockReq();
      const res = mockRes();

      handlers.sseStream(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
    });

    it('pushNotification writes SSE-formatted data to connected client', () => {
      const req = mockReq({ user: { id: 42, role: 'admin' } });
      const res = mockRes();

      handlers.sseStream(req, res);

      const notification = { id: 1, title: 'Step completed', type: 'step.completed' };
      pushNotification(42, notification);

      expect(res.write).toHaveBeenCalledWith(
        `data: ${JSON.stringify(notification)}\n\n`
      );
    });

    it('client disconnect removes connection from sseClients', () => {
      const req = mockReq({ user: { id: 77, role: 'admin' } });
      const res = mockRes();

      handlers.sseStream(req, res);

      // Push should work before disconnect
      pushNotification(77, { test: true });
      expect(res.write).toHaveBeenCalledTimes(1);

      // Simulate disconnect
      req.emit('close');

      // Push after disconnect should not write
      res.write.mockClear();
      pushNotification(77, { test: true });
      expect(res.write).not.toHaveBeenCalled();
    });

    it('pushNotification is a no-op for unconnected users', () => {
      // No SSE connection opened for user 999
      pushNotification(999, { test: true });
      // Should not throw
    });
  });

  describe('GET /notifications', () => {
    it('returns notification list for authenticated user', async () => {
      const notifications = [
        { id: 1, title: 'Deal paused', is_read: false },
        { id: 2, title: 'Step completed', is_read: true },
      ];
      mockDealService.getNotifications.mockResolvedValue(notifications);

      const req = mockReq({ query: {} });
      const res = mockRes();

      await handlers.getNotifications(req, res);

      expect(mockDealService.getNotifications).toHaveBeenCalledWith(1, false);
      expect(res.json).toHaveBeenCalledWith(notifications);
    });

    it('filters unread only when query param set', async () => {
      mockDealService.getNotifications.mockResolvedValue([]);

      const req = mockReq({ query: { unreadOnly: 'true' } });
      const res = mockRes();

      await handlers.getNotifications(req, res);

      expect(mockDealService.getNotifications).toHaveBeenCalledWith(1, true);
    });
  });

  describe('POST /notifications/:id/read', () => {
    it('marks notification as read', async () => {
      mockDealService.markNotificationRead.mockResolvedValue({ id: 5, is_read: true });

      const req = mockReq({ params: { id: '5' } });
      const res = mockRes();

      await handlers.markNotificationRead(req, res);

      expect(mockDealService.markNotificationRead).toHaveBeenCalledWith(5);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('POST /notifications/read-all', () => {
    it('marks all notifications as read for user', async () => {
      mockDealService.markAllNotificationsRead.mockResolvedValue(undefined);

      const req = mockReq();
      const res = mockRes();

      await handlers.markAllNotificationsRead(req, res);

      expect(mockDealService.markAllNotificationsRead).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe('GET /notifications/unread-count', () => {
    it('returns unread count', async () => {
      mockDealService.getUnreadCount.mockResolvedValue(7);

      const req = mockReq();
      const res = mockRes();

      await handlers.getUnreadCount(req, res);

      expect(mockDealService.getUnreadCount).toHaveBeenCalledWith(1);
      expect(res.json).toHaveBeenCalledWith({ count: 7 });
    });
  });
});
