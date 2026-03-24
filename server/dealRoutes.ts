/**
 * Deal Routes
 *
 * REST API for deal lifecycle management: CRUD, staff overrides
 * (pause/resume/cancel/skip/complete), SSE notifications, and
 * notification REST endpoints.
 */

import { Router, Request, Response } from 'express';
import { dealService } from './agents/services/dealService';
import { dealPipelineService } from './agents/services/dealPipelineService';

export const dealRouter = Router();

// ---- Auth Middleware ----

export const requireDealAuth = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent')
    return res.status(403).json({ error: 'Not authorized' });
  next();
};

// ---- SSE Infrastructure ----

const sseClients = new Map<number, Response>();

export function pushNotification(userId: number, notification: any): void {
  const client = sseClients.get(userId);
  if (!client) return;
  try {
    client.write(`data: ${JSON.stringify(notification)}\n\n`);
  } catch {
    sseClients.delete(userId);
  }
}

// Heartbeat every 30 seconds to keep SSE connections alive
const heartbeatInterval = setInterval(() => {
  for (const [userId, client] of sseClients.entries()) {
    try {
      client.write(':\n\n');
    } catch {
      sseClients.delete(userId);
    }
  }
}, 30_000);

// Clean up interval on process exit
if (typeof process !== 'undefined') {
  process.on('exit', () => clearInterval(heartbeatInterval));
}

// ---- Notify Deal Stakeholders Helper ----

export async function notifyDealStakeholders(
  dealId: number,
  event: { eventType: string; title: string; stepId?: string },
): Promise<void> {
  try {
    const deal = await dealService.getDeal(dealId);
    if (!deal) return;

    // Gather relevant staff IDs (property manager, agent)
    const staffIds: number[] = [];
    if (deal.property_manager_id) staffIds.push(deal.property_manager_id);
    if (deal.agent_id) staffIds.push(deal.agent_id);

    // De-duplicate
    const uniqueIds = [...new Set(staffIds)];

    for (const userId of uniqueIds) {
      const notification = await dealService.createNotification({
        userId,
        dealId,
        title: event.title,
        type: event.eventType,
        linkUrl: `/crm/deals/${dealId}`,
      });
      pushNotification(userId, notification);
    }
  } catch (error) {
    console.error('Error notifying deal stakeholders:', error);
  }
}

// ---- Route Handlers (exported for testing) ----

export const routeHandlers = {
  async listDeals(req: any, res: any) {
    try {
      const { status, dealType, propertyId } = req.query;
      const deals = await dealService.listDeals({
        status: status || undefined,
        dealType: dealType || undefined,
        propertyId: propertyId ? parseInt(propertyId, 10) : undefined,
      });
      res.json(deals);
    } catch (error) {
      console.error('Error listing deals:', error);
      res.status(500).json({ error: 'Failed to list deals' });
    }
  },

  async getDeal(req: any, res: any) {
    try {
      const id = parseInt(req.params.id, 10);
      const deal = await dealService.getDeal(id);
      if (!deal) return res.status(404).json({ error: 'Deal not found' });

      const steps = await dealService.getDealSteps(id);
      const allEvents = await dealService.getDealEvents(id);
      const events = allEvents.slice(0, 50);

      res.json({ ...deal, steps, events });
    } catch (error) {
      console.error('Error getting deal:', error);
      res.status(500).json({ error: 'Failed to get deal' });
    }
  },

  async getDealEvents(req: any, res: any) {
    try {
      const dealId = parseInt(req.params.id, 10);
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);

      const allEvents = await dealService.getDealEvents(dealId);
      const paginated = allEvents.slice(offset, offset + limit);

      res.json({ events: paginated, total: allEvents.length });
    } catch (error) {
      console.error('Error getting deal events:', error);
      res.status(500).json({ error: 'Failed to get deal events' });
    }
  },

  async getDealSteps(req: any, res: any) {
    try {
      const dealId = parseInt(req.params.id, 10);
      const steps = await dealService.getDealSteps(dealId);
      res.json(steps);
    } catch (error) {
      console.error('Error getting deal steps:', error);
      res.status(500).json({ error: 'Failed to get deal steps' });
    }
  },

  async pauseDeal(req: any, res: any) {
    try {
      const dealId = parseInt(req.params.id, 10);
      const { reason } = req.body;
      const userId = req.user.id;

      const updated = await dealService.updateDeal(dealId, {
        status: 'paused',
        pausedAt: new Date(),
        pausedBy: userId,
        pauseReason: reason || 'Paused by staff',
      });

      await dealService.createDealEvent({
        dealId,
        eventType: 'deal.paused',
        title: `Deal paused: ${reason || 'No reason given'}`,
        actorType: 'staff',
        actorId: userId,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error pausing deal:', error);
      res.status(500).json({ error: 'Failed to pause deal' });
    }
  },

  async resumeDeal(req: any, res: any) {
    try {
      const dealId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      const updated = await dealService.updateDeal(dealId, {
        status: 'active',
        pausedAt: null,
        pausedBy: null,
        pauseReason: null,
      });

      await dealService.createDealEvent({
        dealId,
        eventType: 'deal.resumed',
        title: 'Deal resumed',
        actorType: 'staff',
        actorId: userId,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error resuming deal:', error);
      res.status(500).json({ error: 'Failed to resume deal' });
    }
  },

  async cancelDeal(req: any, res: any) {
    try {
      const dealId = parseInt(req.params.id, 10);
      const { reason } = req.body;
      const userId = req.user.id;

      const updated = await dealService.updateDeal(dealId, {
        status: 'cancelled',
        cancelledAt: new Date(),
        cancelledBy: userId,
        cancelReason: reason || 'Cancelled by staff',
      });

      await dealService.createDealEvent({
        dealId,
        eventType: 'deal.cancelled',
        title: `Deal cancelled: ${reason || 'No reason given'}`,
        actorType: 'staff',
        actorId: userId,
      });

      res.json(updated);
    } catch (error) {
      console.error('Error cancelling deal:', error);
      res.status(500).json({ error: 'Failed to cancel deal' });
    }
  },

  async skipStep(req: any, res: any) {
    try {
      const dealId = parseInt(req.params.id, 10);
      const { stepId } = req.params;
      const userId = req.user.id;

      await dealPipelineService.skipStep(dealId, stepId, userId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error skipping step:', error);
      res.status(500).json({ error: 'Failed to skip step' });
    }
  },

  async completeStep(req: any, res: any) {
    try {
      const dealId = parseInt(req.params.id, 10);
      const { stepId } = req.params;
      const userId = req.user.id;

      await dealPipelineService.completeStepManually(dealId, stepId, userId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error completing step:', error);
      res.status(500).json({ error: 'Failed to complete step' });
    }
  },

  // ---- Notification Endpoints ----

  async getNotifications(req: any, res: any) {
    try {
      const userId = req.user.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const notifications = await dealService.getNotifications(userId, unreadOnly);
      res.json(notifications);
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({ error: 'Failed to get notifications' });
    }
  },

  async getUnreadCount(req: any, res: any) {
    try {
      const userId = req.user.id;
      const count = await dealService.getUnreadCount(userId);
      res.json({ count });
    } catch (error) {
      console.error('Error getting unread count:', error);
      res.status(500).json({ error: 'Failed to get unread count' });
    }
  },

  async markNotificationRead(req: any, res: any) {
    try {
      const id = parseInt(req.params.id, 10);
      await dealService.markNotificationRead(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking notification read:', error);
      res.status(500).json({ error: 'Failed to mark notification read' });
    }
  },

  async markAllNotificationsRead(req: any, res: any) {
    try {
      const userId = req.user.id;
      await dealService.markAllNotificationsRead(userId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error marking all notifications read:', error);
      res.status(500).json({ error: 'Failed to mark all notifications read' });
    }
  },

  // ---- SSE Endpoint ----

  sseStream(req: any, res: any) {
    const userId = req.user.id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    sseClients.set(userId, res);

    req.on('close', () => {
      sseClients.delete(userId);
    });
  },
};

// ---- Register Routes ----

// Deal CRUD
dealRouter.get('/deals', requireDealAuth, routeHandlers.listDeals);
dealRouter.get('/deals/:id', requireDealAuth, routeHandlers.getDeal);
dealRouter.get('/deals/:id/events', requireDealAuth, routeHandlers.getDealEvents);
dealRouter.get('/deals/:id/steps', requireDealAuth, routeHandlers.getDealSteps);

// Staff overrides
dealRouter.post('/deals/:id/pause', requireDealAuth, routeHandlers.pauseDeal);
dealRouter.post('/deals/:id/resume', requireDealAuth, routeHandlers.resumeDeal);
dealRouter.post('/deals/:id/cancel', requireDealAuth, routeHandlers.cancelDeal);
dealRouter.post('/deals/:id/steps/:stepId/skip', requireDealAuth, routeHandlers.skipStep);
dealRouter.post('/deals/:id/steps/:stepId/complete', requireDealAuth, routeHandlers.completeStep);

// Notifications
dealRouter.get('/notifications', requireDealAuth, routeHandlers.getNotifications);
dealRouter.get('/notifications/unread-count', requireDealAuth, routeHandlers.getUnreadCount);
dealRouter.get('/notifications/stream', requireDealAuth, routeHandlers.sseStream);
dealRouter.post('/notifications/:id/read', requireDealAuth, routeHandlers.markNotificationRead);
dealRouter.post('/notifications/read-all', requireDealAuth, routeHandlers.markAllNotificationsRead);
