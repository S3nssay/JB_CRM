/**
 * Email Integration API Routes
 *
 * Provides REST endpoints for Microsoft 365 email integration.
 * Handles OAuth flow, email sending/receiving, and webhook notifications.
 */

import { Router, Request, Response } from 'express';
import { db, pool } from '../db';
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
import { decryptToken, encryptToken } from '../lib/encryption';
import { SmtpSender, ImapPoller } from '../services/email/smtpTransport';
import { imapPollingService } from '../services/email/imapPollingService';

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
      smtpAvailable: true, // SMTP always available (no admin setup required)
      redirectUri: authStatus.redirectUri,
      connections: connections.map((c) => ({
        id: c.id,
        provider: c.provider,
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
      return res.redirect(`/crm/my-desk?error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code || !state) {
      return res.redirect('/crm/my-desk?error=Missing authorization code or state');
    }

    // Get user ID from state
    const userId = graphAuthService.getUserIdFromState(state as string);
    if (!userId) {
      return res.redirect('/crm/my-desk?error=Invalid or expired state');
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

      return res.redirect('/crm/my-desk?success=Email connection updated');
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

    res.redirect('/crm/my-desk?success=Email connected successfully');
  } catch (error) {
    console.error('OAuth callback error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    res.redirect(`/crm/my-desk?error=${encodeURIComponent(errorMessage)}`);
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

    // Get subscription status for M365 connections only
    const connectionsWithSubs = await Promise.all(
      connections.map(async (conn) => {
        if (conn.provider === 'microsoft') {
          const subs = await subscriptionManager.getSubscriptionsForConnection(conn.id);
          return {
            ...conn,
            subscriptions: subs.map((s) => ({
              id: s.id,
              status: s.status,
              expiresAt: s.expiresAt,
            })),
          };
        }
        return { ...conn, subscriptions: [] };
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

    // Delete webhook subscriptions (only for M365 connections)
    if (connection.provider === 'microsoft') {
      const subs = await subscriptionManager.getSubscriptionsForConnection(connectionId);
      for (const sub of subs) {
        await subscriptionManager.deleteSubscription(sub.id);
      }
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

    // Enqueue sync job based on provider
    if (connection.provider === 'smtp') {
      // SMTP: poll via IMAP
      await imapPollingService.pollSingleConnection(connectionId);
      res.json({ success: true, message: 'IMAP sync completed' });
    } else {
      // M365: enqueue Graph folder sync
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
    }
  } catch (error) {
    console.error('Error triggering sync:', error);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});

// ==========================================
// SMTP/IMAP CONNECTION
// ==========================================

/**
 * POST /api/email-integration/test-smtp
 * Tests SMTP and IMAP credentials without saving
 */
router.post('/test-smtp', requireAgent, async (req: Request, res: Response) => {
  try {
    const {
      smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure,
      imapHost, imapPort, imapUser, imapPassword, imapTls,
    } = req.body;

    const results: any = { smtp: false, imap: false, smtpError: null, imapError: null };

    // Test SMTP
    if (smtpHost && smtpUser && smtpPassword) {
      const sender = new SmtpSender();
      const smtpResult = await sender.testRawConnection({
        host: smtpHost,
        port: smtpPort || 587,
        user: smtpUser,
        password: smtpPassword,
        secure: smtpSecure || false,
      });
      results.smtp = smtpResult.success;
      results.smtpError = smtpResult.error || null;
    }

    // Test IMAP
    if (imapHost && imapUser && imapPassword) {
      const poller = new ImapPoller();
      const imapResult = await poller.testRawConnection({
        host: imapHost,
        port: imapPort || 993,
        user: imapUser,
        password: imapPassword,
        tls: imapTls !== false,
      });
      results.imap = imapResult.success;
      results.imapError = imapResult.error || null;
    }

    res.json(results);
  } catch (error) {
    console.error('Error testing SMTP/IMAP:', error);
    res.status(500).json({ error: 'Connection test failed' });
  }
});

/**
 * POST /api/email-integration/connect-smtp
 * Creates an SMTP/IMAP email connection
 */
router.post('/connect-smtp', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const {
      smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure,
      imapHost, imapPort, imapUser, imapPassword, imapTls,
    } = req.body;

    // Validate required fields
    if (!smtpHost || !smtpUser || !smtpPassword) {
      return res.status(400).json({ error: 'SMTP host, user, and password are required' });
    }
    if (!imapHost || !imapUser || !imapPassword) {
      return res.status(400).json({ error: 'IMAP host, user, and password are required' });
    }

    // Test SMTP connection
    const sender = new SmtpSender();
    const smtpResult = await sender.testRawConnection({
      host: smtpHost,
      port: smtpPort || 587,
      user: smtpUser,
      password: smtpPassword,
      secure: smtpSecure || false,
    });
    if (!smtpResult.success) {
      return res.status(400).json({ error: `SMTP connection failed: ${smtpResult.error}` });
    }

    // Test IMAP connection
    const poller = new ImapPoller();
    const imapResult = await poller.testRawConnection({
      host: imapHost,
      port: imapPort || 993,
      user: imapUser,
      password: imapPassword,
      tls: imapTls !== false,
    });
    if (!imapResult.success) {
      return res.status(400).json({ error: `IMAP connection failed: ${imapResult.error}` });
    }

    // Encrypt credentials
    const encryptedSmtpPassword = encryptToken(smtpPassword);
    const encryptedImapPassword = encryptToken(imapPassword);

    // Create connection record
    const [connection] = await db
      .insert(emailConnections)
      .values({
        userId: user.id,
        provider: 'smtp',
        mailboxUpn: smtpUser, // Use SMTP username as display email
        status: 'active',
        syncEnabled: true,
        syncFolders: ['inbox'],
        errorCount: 0,
        smtpHost,
        smtpPort: smtpPort || 587,
        smtpUser,
        smtpPassword: encryptedSmtpPassword,
        smtpSecure: smtpSecure || false,
        imapHost,
        imapPort: imapPort || 993,
        imapUser,
        imapPassword: encryptedImapPassword,
        imapTls: imapTls !== false,
      })
      .returning();

    console.log(`Created SMTP connection ${connection.id} for user ${user.id} (${smtpUser})`);

    // Trigger initial IMAP poll
    try {
      await imapPollingService.pollSingleConnection(connection.id);
    } catch (pollErr) {
      console.error('Initial IMAP poll failed:', pollErr);
      // Non-fatal - connection is still valid
    }

    res.json({
      success: true,
      connectionId: connection.id,
      mailboxUpn: connection.mailboxUpn,
    });
  } catch (error) {
    console.error('Error creating SMTP connection:', error);
    res.status(500).json({ error: 'Failed to create SMTP connection' });
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
// SYSTEM / DEPARTMENT MAILBOXES
// ==========================================

/**
 * GET /api/email-integration/system-mailboxes
 * Lists all system department mailboxes
 */
router.get('/system-mailboxes', requireAgent, async (req: Request, res: Response) => {
  try {
    const connections = await db
      .select({
        id: emailConnections.id,
        provider: emailConnections.provider,
        mailboxUpn: emailConnections.mailboxUpn,
        mailboxCategory: emailConnections.mailboxCategory,
        mailboxDisplayName: emailConnections.mailboxDisplayName,
        status: emailConnections.status,
        lastSyncAt: emailConnections.lastSyncAt,
        errorCount: emailConnections.errorCount,
        lastError: emailConnections.lastError,
        syncEnabled: emailConnections.syncEnabled,
        smtpHost: emailConnections.smtpHost,
        smtpPort: emailConnections.smtpPort,
        imapHost: emailConnections.imapHost,
        imapPort: emailConnections.imapPort,
      })
      .from(emailConnections)
      .where(eq(emailConnections.isSystemMailbox, true))
      .orderBy(emailConnections.mailboxCategory);

    res.json(connections);
  } catch (error) {
    console.error('Error listing system mailboxes:', error);
    res.status(500).json({ error: 'Failed to list system mailboxes' });
  }
});

/**
 * POST /api/email-integration/system-mailbox
 * Creates a system/department mailbox (admin only)
 */
router.post('/system-mailbox', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure,
      imapHost, imapPort, imapUser, imapPassword, imapTls,
      category, displayName,
    } = req.body;

    // Validate category
    if (!category || !['sales', 'lettings', 'maintenance', 'admin'].includes(category)) {
      return res.status(400).json({ error: 'category must be one of: sales, lettings, maintenance, admin' });
    }

    // Validate required fields
    if (!smtpHost || !smtpUser || !smtpPassword) {
      return res.status(400).json({ error: 'SMTP host, user, and password are required' });
    }
    if (!imapHost || !imapUser || !imapPassword) {
      return res.status(400).json({ error: 'IMAP host, user, and password are required' });
    }

    // Check if a system mailbox for this category already exists
    const existing = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: `A ${category} system mailbox already exists (${existing[0].mailboxUpn})`,
        existingId: existing[0].id,
      });
    }

    // Test SMTP connection
    const sender = new SmtpSender();
    const smtpResult = await sender.testRawConnection({
      host: smtpHost,
      port: smtpPort || 465,
      user: smtpUser,
      password: smtpPassword,
      secure: smtpSecure !== false,
    });
    if (!smtpResult.success) {
      return res.status(400).json({ error: `SMTP connection failed: ${smtpResult.error}` });
    }

    // Test IMAP connection
    const poller = new ImapPoller();
    const imapResult = await poller.testRawConnection({
      host: imapHost,
      port: imapPort || 993,
      user: imapUser,
      password: imapPassword,
      tls: imapTls !== false,
    });
    if (!imapResult.success) {
      return res.status(400).json({ error: `IMAP connection failed: ${imapResult.error}` });
    }

    // Encrypt credentials
    const encryptedSmtpPassword = encryptToken(smtpPassword);
    const encryptedImapPassword = encryptToken(imapPassword);

    // Derive display name if not provided
    const derivedDisplayName = displayName || {
      sales: 'Sales Enquiries',
      lettings: 'Lettings Enquiries',
      maintenance: 'Maintenance Requests',
    }[category];

    // Create connection record
    const [connection] = await db
      .insert(emailConnections)
      .values({
        userId: user.id, // Admin user as owner for FK purposes
        provider: 'smtp',
        mailboxUpn: smtpUser,
        status: 'active',
        syncEnabled: true,
        syncFolders: ['inbox'],
        errorCount: 0,
        smtpHost,
        smtpPort: smtpPort || 465,
        smtpUser,
        smtpPassword: encryptedSmtpPassword,
        smtpSecure: smtpSecure !== false,
        imapHost,
        imapPort: imapPort || 993,
        imapUser,
        imapPassword: encryptedImapPassword,
        imapTls: imapTls !== false,
        isSystemMailbox: true,
        mailboxCategory: category,
        mailboxDisplayName: derivedDisplayName,
      })
      .returning();

    console.log(`Created system mailbox ${connection.id}: ${category} (${smtpUser})`);

    // Trigger initial IMAP poll
    try {
      await imapPollingService.pollSingleConnection(connection.id);
    } catch (pollErr) {
      console.error('Initial IMAP poll failed:', pollErr);
    }

    res.json({
      success: true,
      connectionId: connection.id,
      mailboxUpn: connection.mailboxUpn,
      category: connection.mailboxCategory,
      displayName: connection.mailboxDisplayName,
    });
  } catch (error) {
    console.error('Error creating system mailbox:', error);
    res.status(500).json({ error: 'Failed to create system mailbox' });
  }
});

/**
 * PATCH /api/email-integration/system-mailbox/:category
 * Update an existing system/department mailbox (admin only)
 */
router.patch('/system-mailbox/:category', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { category } = req.params;
    if (!['sales', 'lettings', 'maintenance', 'admin'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const {
      smtpHost, smtpPort, smtpUser, smtpPassword, smtpSecure,
      imapHost, imapPort, imapUser, imapPassword, imapTls,
      displayName,
    } = req.body;

    // Find existing mailbox
    const [existing] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: `No ${category} system mailbox found` });
    }

    // Validate required fields
    if (!smtpHost || !smtpUser || !smtpPassword) {
      return res.status(400).json({ error: 'SMTP host, user, and password are required' });
    }
    if (!imapHost || !imapUser || !imapPassword) {
      return res.status(400).json({ error: 'IMAP host, user, and password are required' });
    }

    // Test SMTP connection
    const sender = new SmtpSender();
    const smtpResult = await sender.testRawConnection({
      host: smtpHost,
      port: smtpPort || 465,
      user: smtpUser,
      password: smtpPassword,
      secure: smtpSecure !== false,
    });
    if (!smtpResult.success) {
      return res.status(400).json({ error: `SMTP connection failed: ${smtpResult.error}` });
    }

    // Test IMAP connection
    const poller = new ImapPoller();
    const imapResult = await poller.testRawConnection({
      host: imapHost,
      port: imapPort || 993,
      user: imapUser,
      password: imapPassword,
      tls: imapTls !== false,
    });
    if (!imapResult.success) {
      return res.status(400).json({ error: `IMAP connection failed: ${imapResult.error}` });
    }

    // Encrypt credentials
    const encryptedSmtpPassword = encryptToken(smtpPassword);
    const encryptedImapPassword = encryptToken(imapPassword);

    // Update connection record
    const [updated] = await db
      .update(emailConnections)
      .set({
        mailboxUpn: smtpUser,
        smtpHost,
        smtpPort: smtpPort || 465,
        smtpUser,
        smtpPassword: encryptedSmtpPassword,
        smtpSecure: smtpSecure !== false,
        imapHost,
        imapPort: imapPort || 993,
        imapUser,
        imapPassword: encryptedImapPassword,
        imapTls: imapTls !== false,
        mailboxDisplayName: displayName || existing.mailboxDisplayName,
        status: 'active',
        errorCount: 0,
        lastError: null,
      })
      .where(eq(emailConnections.id, existing.id))
      .returning();

    console.log(`Updated system mailbox ${updated.id}: ${category} (${smtpUser})`);

    res.json({
      success: true,
      connectionId: updated.id,
      mailboxUpn: updated.mailboxUpn,
      category: updated.mailboxCategory,
      displayName: updated.mailboxDisplayName,
    });
  } catch (error) {
    console.error('Error updating system mailbox:', error);
    res.status(500).json({ error: 'Failed to update system mailbox' });
  }
});

/**
 * DELETE /api/email-integration/system-mailbox/:category
 * Removes a system/department mailbox (admin only)
 */
router.delete('/system-mailbox/:category', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { category } = req.params;
    if (!['sales', 'lettings', 'maintenance', 'admin'].includes(category)) {
      return res.status(400).json({ error: 'Invalid category' });
    }

    const [connection] = await db
      .select({ id: emailConnections.id })
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: `No ${category} system mailbox found` });
    }

    await db.delete(emailConnections).where(eq(emailConnections.id, connection.id));

    console.log(`Deleted system mailbox: ${category} (id: ${connection.id})`);
    res.json({ success: true, deletedId: connection.id });
  } catch (error) {
    console.error('Error deleting system mailbox:', error);
    res.status(500).json({ error: 'Failed to delete system mailbox' });
  }
});

/**
 * GET /api/email-integration/department-emails/:category
 * Lists emails for a department mailbox (no userId filter - role-based access)
 */
router.get('/department-emails/:category', requireAgent, async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    // Find the system connection for this category
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: `No ${category} mailbox configured` });
    }

    const emails = await db
      .select({
        id: processedEmails.id,
        connectionId: processedEmails.connectionId,
        fromAddress: processedEmails.fromAddress,
        fromName: processedEmails.fromName,
        toAddresses: processedEmails.toAddresses,
        subject: processedEmails.subject,
        bodyPreview: processedEmails.bodyPreview,
        receivedAt: processedEmails.receivedAt,
        isRead: processedEmails.isRead,
        hasAttachments: processedEmails.hasAttachments,
        importance: processedEmails.importance,
        aiCategory: processedEmails.aiCategory,
        aiPriority: processedEmails.aiPriority,
        aiSummary: processedEmails.aiSummary,
        aiAgentActionType: processedEmails.aiAgentActionType,
        processingStatus: processedEmails.processingStatus,
        linkedTicketId: processedEmails.linkedTicketId,
        linkedEnquiryId: processedEmails.linkedEnquiryId,
        linkedContactId: processedEmails.linkedContactId,
      })
      .from(processedEmails)
      .where(eq(processedEmails.connectionId, connection.id))
      .orderBy(desc(processedEmails.receivedAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    res.json({
      emails,
      connectionId: connection.id,
      mailboxUpn: connection.mailboxUpn,
      displayName: connection.mailboxDisplayName,
    });
  } catch (error) {
    console.error('Error listing department emails:', error);
    res.status(500).json({ error: 'Failed to list department emails' });
  }
});

/**
 * GET /api/email-integration/department-emails/:category/:emailId
 * Gets a specific department email with full content
 */
router.get('/department-emails/:category/:emailId', requireAgent, async (req: Request, res: Response) => {
  try {
    const { category, emailId } = req.params;

    // Find the system connection for this category
    const [connection] = await db
      .select({ id: emailConnections.id })
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: `No ${category} mailbox configured` });
    }

    const [email] = await db
      .select()
      .from(processedEmails)
      .where(
        and(
          eq(processedEmails.id, parseInt(emailId, 10)),
          eq(processedEmails.connectionId, connection.id)
        )
      )
      .limit(1);

    if (!email) {
      return res.status(404).json({ error: 'Email not found' });
    }

    // Mark as read
    if (!email.isRead) {
      await db
        .update(processedEmails)
        .set({ isRead: true, updatedAt: new Date() })
        .where(eq(processedEmails.id, email.id));
    }

    res.json(email);
  } catch (error) {
    console.error('Error getting department email:', error);
    res.status(500).json({ error: 'Failed to get department email' });
  }
});

/**
 * POST /api/email-integration/department-send
 * Sends an email from a department mailbox
 */
router.post('/department-send', requireAgent, async (req: Request, res: Response) => {
  try {
    const user = req.user as any;
    const {
      category,
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      importance,
      replyTo,
      inReplyToMessageId,
      linkedContactId,
      linkedPropertyId,
      linkedConversationId,
    } = req.body;

    // Validate
    if (!category || !['sales', 'lettings', 'maintenance', 'admin'].includes(category)) {
      return res.status(400).json({ error: 'Valid category required' });
    }
    if (!to || !Array.isArray(to) || to.length === 0 || !subject) {
      return res.status(400).json({ error: 'Missing required fields: to, subject' });
    }

    // Find the system connection for this category
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: `No ${category} mailbox configured` });
    }

    const sendRequest: SendEmailRequest = {
      connectionId: connection.id,
      userId: user.id, // Track who sent it for audit
      to,
      cc,
      bcc,
      subject,
      bodyText,
      bodyHtml,
      importance,
      replyTo,
      inReplyToMessageId,
      linkedContactId: linkedContactId || undefined,
      linkedPropertyId: linkedPropertyId || undefined,
      linkedConversationId: linkedConversationId || undefined,
    };

    const result = await emailSender.sendImmediate(sendRequest);

    if (!result.success) {
      return res.status(500).json({ error: result.error });
    }

    res.json({ success: true, sentEmailId: result.sentEmailId });
  } catch (error) {
    console.error('Error sending department email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

/**
 * POST /api/email-integration/system-mailboxes/:category/sync
 * Manually triggers sync for a department mailbox
 */
router.post('/system-mailboxes/:category/sync', requireAgent, async (req: Request, res: Response) => {
  try {
    const { category } = req.params;

    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: `No ${category} mailbox configured` });
    }

    if (connection.status !== 'active') {
      return res.status(400).json({ error: 'Mailbox connection is not active' });
    }

    await imapPollingService.pollSingleConnection(connection.id);
    res.json({ success: true, message: 'Sync completed' });
  } catch (error) {
    console.error('Error syncing department mailbox:', error);
    res.status(500).json({ error: 'Failed to sync mailbox' });
  }
});

/**
 * GET /api/email-integration/system-mailbox-counts
 * Gets unread email counts per department for sidebar badges
 */
router.get('/system-mailbox-counts', requireAgent, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT
        ec.mailbox_category as category,
        COUNT(pe.id)::int as unread_count
      FROM email_connection ec
      LEFT JOIN processed_email pe
        ON pe.connection_id = ec.id AND pe.is_read = false
      WHERE ec.is_system_mailbox = true
        AND ec.status = 'active'
      GROUP BY ec.mailbox_category
    `);

    const counts: Record<string, number> = {};
    for (const row of result.rows) {
      if (row.category) {
        counts[row.category] = row.unread_count;
      }
    }

    res.json(counts);
  } catch (error) {
    console.error('Error getting mailbox counts:', error);
    res.status(500).json({ error: 'Failed to get counts' });
  }
});

/**
 * GET /api/email-integration/department-sent/:category
 * Lists sent emails from a department mailbox
 */
router.get('/department-sent/:category', requireAgent, async (req: Request, res: Response) => {
  try {
    const { category } = req.params;
    const { limit = '50', offset = '0' } = req.query;

    const [connection] = await db
      .select({ id: emailConnections.id })
      .from(emailConnections)
      .where(
        and(
          eq(emailConnections.isSystemMailbox, true),
          eq(emailConnections.mailboxCategory, category)
        )
      )
      .limit(1);

    if (!connection) {
      return res.status(404).json({ error: `No ${category} mailbox configured` });
    }

    const emails = await db
      .select({
        id: sentEmails.id,
        connectionId: sentEmails.connectionId,
        toAddresses: sentEmails.toAddresses,
        ccAddresses: sentEmails.ccAddresses,
        subject: sentEmails.subject,
        bodyPreview: sentEmails.bodyText,
        status: sentEmails.status,
        sentAt: sentEmails.sentAt,
        createdAt: sentEmails.createdAt,
        failureReason: sentEmails.failureReason,
      })
      .from(sentEmails)
      .where(eq(sentEmails.connectionId, connection.id))
      .orderBy(desc(sentEmails.createdAt))
      .limit(parseInt(limit as string, 10))
      .offset(parseInt(offset as string, 10));

    res.json(emails);
  } catch (error) {
    console.error('Error listing department sent emails:', error);
    res.status(500).json({ error: 'Failed to list sent emails' });
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

// ==========================================
// AI AGENT ADMIN ROUTES
// ==========================================

/**
 * GET /api/email-integration/admin/ai-agent-stats
 * Gets AI agent processing statistics
 */
router.get('/admin/ai-agent-stats', async (req, res) => {
  try {
    if (!req.user || (req.user as any).role !== 'admin' && (req.user as any).role !== 'agent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await pool.query(`
      SELECT
        ai_agent_action_type as action_type,
        COUNT(*)::int as count
      FROM processed_email
      WHERE ai_agent_action_type IS NOT NULL
      GROUP BY ai_agent_action_type
      ORDER BY count DESC
    `);

    const totalProcessed = await pool.query(`
      SELECT COUNT(*)::int as total FROM processed_email WHERE ai_agent_processed_at IS NOT NULL
    `);

    res.json({
      totalProcessed: totalProcessed.rows[0]?.total || 0,
      actionStats: stats.rows,
    });
  } catch (error) {
    console.error('Error fetching AI agent stats:', error);
    res.status(500).json({ error: 'Failed to fetch AI agent stats' });
  }
});

/**
 * GET /api/email-integration/admin/ai-agent-log
 * Gets recent AI agent actions for review
 */
router.get('/admin/ai-agent-log', async (req, res) => {
  try {
    if (!req.user || (req.user as any).role !== 'admin' && (req.user as any).role !== 'agent') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    const log = await pool.query(`
      SELECT
        id, from_address, from_name, subject,
        ai_category, ai_priority, ai_summary,
        ai_agent_action_type, ai_agent_action_details, ai_agent_processed_at,
        received_at
      FROM processed_email
      WHERE ai_agent_action_type IS NOT NULL
      ORDER BY ai_agent_processed_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json(log.rows);
  } catch (error) {
    console.error('Error fetching AI agent log:', error);
    res.status(500).json({ error: 'Failed to fetch AI agent log' });
  }
});

/**
 * POST /api/email-integration/admin/ai-agent-reprocess/:emailId
 * Manually re-triggers AI agent for a specific email
 */
router.post('/admin/ai-agent-reprocess/:emailId', async (req, res) => {
  try {
    if (!req.user || (req.user as any).role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const emailId = parseInt(req.params.emailId, 10);

    // Fetch the processed email
    const result = await pool.query(
      'SELECT * FROM processed_email WHERE id = $1',
      [emailId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Email not found' });
    }

    const email = result.rows[0];

    if (!email.ai_processed) {
      return res.status(400).json({ error: 'Email has not been AI-analyzed yet' });
    }

    // Import and run the AI agent
    const { emailAIAgent } = await import('../services/email/emailAIAgent');
    await emailAIAgent.processAction(email.id, {
      category: email.ai_category || 'other',
      sentiment: email.ai_sentiment || 'neutral',
      priority: email.ai_priority || 'normal',
      summary: email.ai_summary || '',
      extractedEntities: email.ai_extracted_entities || {},
      suggestedActions: email.ai_suggested_actions || [],
      classification: email.ai_classification || '',
      actionType: 'route_to_pm',
      senderType: 'unknown',
      existingTicketReference: null,
    }, {
      fromAddress: email.from_address,
      fromName: email.from_name || '',
      subject: email.subject || '',
      bodyText: email.body_text || '',
      bodyHtml: email.body_html || '',
      connectionId: email.connection_id,
      userId: email.user_id,
      graphMessageId: email.graph_message_id,
    });

    res.json({ success: true, message: 'Reprocessing complete' });
  } catch (error) {
    console.error('Error reprocessing email:', error);
    res.status(500).json({ error: 'Failed to reprocess email' });
  }
});

export default router;
