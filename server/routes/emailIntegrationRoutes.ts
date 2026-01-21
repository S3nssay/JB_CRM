/**
 * Email Integration API Routes
 *
 * Provides REST endpoints for Microsoft 365 email integration.
 * Handles OAuth flow, email sending/receiving, and webhook notifications.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  emailConnections,
  emailWebhookSubscriptions,
  processedEmails,
  sentEmails,
  emailJobQueue,
} from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { graphAuthService } from '../services/microsoft/graphAuthService';
import { createGraphClient } from '../services/microsoft/graphApiClient';
import { graphWebhookHandler } from '../services/email/webhookHandler';
import { subscriptionManager } from '../services/email/subscriptionManager';
import { emailSender, SendEmailRequest } from '../services/email/emailSender';
import { emailJobQueue as jobQueueService } from '../services/email/jobQueue';
import { decryptToken } from '../lib/encryption';

const router = Router();

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Requires authenticated user
 */
const requireAuth = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

/**
 * Requires agent or admin role
 */
const requireAgent = (req: Request, res: Response, next: Function) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = req.user as any;
  if (user.role !== 'admin' && user.role !== 'agent') {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

// ==========================================
// CONFIGURATION STATUS
// ==========================================

/**
 * GET /api/email-integration/status
 * Returns the configuration status of the email integration
 */
router.get('/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const authStatus = graphAuthService.getStatus();
    const user = req.user as any;

    // Get user's connections
    const connections = await db
      .select()
      .from(emailConnections)
      .where(eq(emailConnections.userId, user.id));

    // Get job queue stats
    const queueStats = await jobQueueService.getStats();

    res.json({
      configured: authStatus.configured,
      redirectUri: authStatus.redirectUri,
      connections: connections.map((c) => ({
        id: c.id,
        mailboxUpn: c.mailboxUpn,
        status: c.status,
        lastSyncAt: c.lastSyncAt,
        errorCount: c.errorCount,
      })),
      queueStats,
    });
  } catch (error) {
    console.error('Error getting email integration status:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

// ==========================================
// OAUTH FLOW
// ==========================================

/**
 * GET /api/email-integration/oauth/authorize
 * Initiates the OAuth flow by returning the authorization URL
 */
router.get('/oauth/authorize', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { url, state } = graphAuthService.generateAuthorizationUrl(user.id);

    res.json({ authorizationUrl: url, state });
  } catch (error) {
    console.error('Error generating authorization URL:', error);
    res.status(500).json({ error: 'Failed to generate authorization URL' });
  }
});

/**
 * GET /api/email-integration/oauth/callback
 * Handles the OAuth callback from Microsoft
 */
router.get('/oauth/callback', async (req: Request, res: Response) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Handle errors from Microsoft
    if (error) {
      console.error('OAuth error:', error, error_description);
      return res.redirect(`/settings/integrations?error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/settings/integrations?error=Missing authorization code or state');
    }

    // Get user ID from state
    const userId = graphAuthService.getUserIdFromState(state as string);
    if (!userId) {
      return res.redirect('/settings/integrations?error=Invalid or expired state');
    }

    // Exchange code for tokens
    const result = await graphAuthService.exchangeCodeForTokens(code as string, state as string);

    // Check if connection already exists
    const existing = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.userId, userId),
          eq(emailConnections.mailboxUpn, result.user.userPrincipalName)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing connection
      await db
        .update(emailConnections)
        .set({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          tokenExpiresAt: result.expiresAt,
          scopes: result.scopes,
          status: 'active',
          errorCount: 0,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, existing[0].id));

      // Recreate subscription if needed
      const subs = await subscriptionManager.getSubscriptionsForConnection(existing[0].id);
      if (subs.length === 0 || subs.every(s => s.status !== 'active')) {
        await subscriptionManager.createSubscription(existing[0].id);
      }

      return res.redirect('/settings/integrations?success=Email connection updated');
    }

    // Create new connection
    const [connection] = await db
      .insert(emailConnections)
      .values({
        userId,
        provider: 'microsoft',
        tenantId: result.tenantId,
        mailboxUpn: result.user.userPrincipalName,
        microsoftUserId: result.user.id,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: result.expiresAt,
        scopes: result.scopes,
        status: 'active',
        syncEnabled: true,
      })
      .returning();

    // Create webhook subscription
    await subscriptionManager.createSubscription(connection.id);

    res.redirect('/settings/integrations?success=Email connected successfully');
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`/settings/integrations?error=${encodeURIComponent(errorMessage)}`);
  }
});

// ==========================================
// CONNECTION MANAGEMENT
// ==========================================

/**
 * GET /api/email-integration/connections
 * Lists user's email connections
 */
router.get('/connections', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;

    const connections = await db
      .select({
        id: emailConnections.id,
        provider: emailConnections.provider,
        mailboxUpn: emailConnections.mailboxUpn,
        status: emailConnections.status,
        lastSyncAt: emailConnections.lastSyncAt,
        errorCount: emailConnections.errorCount,
        lastError: emailConnections.lastError,
        syncEnabled: emailConnections.syncEnabled,
        createdAt: emailConnections.createdAt,
      })
      .from(emailConnections)
      .where(eq(emailConnections.userId, user.id))
      .orderBy(desc(emailConnections.createdAt));

    // Get subscription status for each connection
    const connectionsWithSubs = await Promise.all(
      connections.map(async (conn) => {
        const subs = await subscriptionManager.getSubscriptionsForConnection(conn.id);
        return {
          ...conn,
          subscriptions: subs.map((s) => ({
            id: s.id,
            status: s.status,
            expiresAt: s.expiresAt,
          })),
        };
      })
    );

    res.json(connectionsWithSubs);
  } catch (error) {
    console.error('Error listing connections:', error);
    res.status(500).json({ error: 'Failed to list connections' });
  }
});

/**
 * DELETE /api/email-integration/connections/:id
 * Disconnects an email connection
 */
router.delete('/connections/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const connectionId = parseInt(req.params.id, 10);

    // Verify ownership
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.id, connectionId),
          eq(emailConnections.userId, user.id)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    // Delete subscriptions
    const subs = await subscriptionManager.getSubscriptionsForConnection(connectionId);
    for (const sub of subs) {
      await subscriptionManager.deleteSubscription(sub.id);
    }

    // Mark connection as revoked (don't delete to preserve history)
    await db
      .update(emailConnections)
      .set({
        status: 'revoked',
        updatedAt: new Date(),
      })
      .where(eq(emailConnections.id, connectionId));

    res.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting:', error);
    res.status(500).json({ error: 'Failed to disconnect' });
  }
});

/**
 * POST /api/email-integration/connections/:id/sync
 * Manually triggers a sync for a connection
 */
router.post('/connections/:id/sync', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const connectionId = parseInt(req.params.id, 10);

    // Verify ownership
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.id, connectionId),
          eq(emailConnections.userId, user.id)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    if (connection.status !== 'active') {
      return res.status(400).json({ error: 'Connection is not active' });
    }

    // Enqueue sync job
    await jobQueueService.enqueue(
      'sync_folder',
      {
        connectionId,
        userId: user.id,
        folderId: 'inbox',
        folderName: 'Inbox',
      },
      { priority: 5 }
    );

    res.json({ success: true, message: 'Sync job queued' });
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// ==========================================
// WEBHOOK ENDPOINT
// ==========================================

/**
 * POST /api/email-integration/webhook
 * Receives webhook notifications from Microsoft Graph
 * Note: No authentication - validated via client state
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const result = await graphWebhookHandler.handleWebhook(
      req.query as { validationToken?: string },
      req.body
    );

    if (result.isValidation) {
      // Microsoft requires plain text response with validation token
      res.set('Content-Type', 'text/plain');
      return res.status(200).send(result.validationToken);
    }

    // Always respond 202 to acknowledge receipt
    res.status(202).json({
      processed: result.processedCount,
      errors: result.errors.length,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    // Still respond 202 to prevent Microsoft from retrying
    res.status(202).json({ error: 'Processing error' });
  }
});

// ==========================================
// EMAIL OPERATIONS
// ==========================================

/**
 * GET /api/email-integration/emails
 * Lists processed emails for the user
 */
router.get('/emails', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { limit = '50', offset = '0', connectionId } = req.query;

    let query = db
      .select({
        id: processedEmails.id,
        connectionId: processedEmails.connectionId,
        fromAddress: processedEmails.fromAddress,
        fromName: processedEmails.fromName,
        subject: processedEmails.subject,
        bodyPreview: processedEmails.bodyPreview,
        receivedAt: processedEmails.receivedAt,
        isRead: processedEmails.isRead,
        hasAttachments: processedEmails.hasAttachments,
        importance: processedEmails.importance,
        aiCategory: processedEmails.aiCategory,
        aiPriority: processedEmails.aiPriority,
        aiSummary: processedEmails.aiSummary,
        processingStatus: processedEmails.processingStatus,
        linkedConversationId: processedEmails.linkedConversationId,
        linkedContactId: processedEmails.linkedContactId,
      })
      .from(processedEmails)
      .where(eq(processedEmails.userId, user.id))
      .orderBy(desc(processedEmails.receivedAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    if (connectionId) {
      query = query.where(eq(processedEmails.connectionId, parseInt(connectionId as string, 10))) as any;
    }

    const emails = await query;

    res.json(emails);
  } catch (error) {
    console.error('Error listing emails:', error);
    res.status(500).json({ error: 'Failed to list emails' });
  }
});

/**
 * GET /api/email-integration/emails/:id
 * Gets a specific processed email with full content
 */
router.get('/emails/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const emailId = parseInt(req.params.id, 10);

    const [email] = await db
      .select()
      .from(processedEmails)
      .where(
        and(
          eq(processedEmails.id, emailId),
          eq(processedEmails.userId, user.id)
        )
      )
      .limit(1);

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    res.json(email);
  } catch (error) {
    console.error('Error getting email:', error);
    res.status(500).json({ error: 'Failed to get email' });
  }
});

/**
 * POST /api/email-integration/send
 * Sends an email via connected mailbox
 */
router.post('/send', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const {
      connectionId,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      importance,
      attachments,
      replyTo,
      inReplyToMessageId,
      linkedConversationId,
      linkedContactId,
      linkedPropertyId,
      templateUsed,
    } = req.body;

    // Validate required fields
    if (!connectionId || !to || !Array.isArray(to) || to.length === 0 || !subject) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, to, subject' });
    }

    // Verify connection ownership
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.id, connectionId),
          eq(emailConnections.userId, user.id)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const sendRequest: SendEmailRequest = {
      connectionId,
      userId: user.id,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      importance,
      attachments,
      replyTo,
      inReplyToMessageId,
      linkedConversationId,
      linkedContactId,
      linkedPropertyId,
      templateUsed,
    };

    const result = await emailSender.queueEmail(sendRequest);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, sentEmailId: result.sentEmailId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * POST /api/email-integration/send-immediate
 * Sends an email immediately (bypasses queue)
 */
router.post('/send-immediate', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const {
      connectionId,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      importance,
      attachments,
      replyTo,
    } = req.body;

    // Validate required fields
    if (!connectionId || !to || !Array.isArray(to) || to.length === 0 || !subject) {
      return res.status(400).json({ error: 'Missing required fields: connectionId, to, subject' });
    }

    // Verify connection ownership
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.id, connectionId),
          eq(emailConnections.userId, user.id)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: 'Connection not found' });
    }

    const sendRequest: SendEmailRequest = {
      connectionId,
      userId: user.id,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      importance,
      attachments,
      replyTo,
    };

    const result = await emailSender.sendImmediate(sendRequest);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, sentEmailId: result.sentEmailId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * GET /api/email-integration/sent
 * Lists sent emails for the user
 */
router.get('/sent', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const { limit = '50', offset = '0', status } = req.query;

    const emails = await emailSender.getSentEmails(user.id, {
      limit: parseInt(limit as string, 10),
      offset: parseInt(offset as string, 10),
      status: status as string | undefined,
    });

    res.json(emails);
  } catch (error) {
    console.error('Error listing sent emails:', error);
    res.status(500).json({ error: 'Failed to list sent emails' });
  }
});

/**
 * POST /api/email-integration/sent/:id/retry
 * Retries a failed sent email
 */
router.post('/sent/:id/retry', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const sentEmailId = parseInt(req.params.id, 10);

    const result = await emailSender.retryFailedEmail(sentEmailId, user.id);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error retrying email:', error);
    res.status(500).json({ error: 'Failed to retry email' });
  }
});

// ==========================================
// ADMIN ROUTES
// ==========================================

/**
 * GET /api/email-integration/admin/queue-stats
 * Gets job queue statistics (admin only)
 */
router.get('/admin/queue-stats', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const stats = await jobQueueService.getStats();

    // Get recent failed jobs
    const failedJobs = await jobQueueService.getJobsByStatus('failed', 10);
    const deadJobs = await jobQueueService.getJobsByStatus('dead', 10);

    res.json({
      stats,
      recentFailed: failedJobs,
      deadLetterQueue: deadJobs,
    });
  } catch (error) {
    console.error('Error getting queue stats:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

/**
 * POST /api/email-integration/admin/retry-dead/:jobId
 * Retries a dead letter job (admin only)
 */
router.post('/admin/retry-dead/:jobId', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const jobId = parseInt(req.params.jobId, 10);
    await jobQueueService.retryDeadJob(jobId);

    res.json({ success: true });
  } catch (error) {
    console.error('Error retrying dead job:', error);
    res.status(500).json({ error: 'Failed to retry job' });
  }
});

export default router;
