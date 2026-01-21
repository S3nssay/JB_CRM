/**
 * Email Sender Service
 *
 * Handles sending emails via Microsoft Graph API.
 * Manages draft creation, sending, and tracking.
 */

import { db } from '../../db';
import {
  emailConnections,
  sentEmails,
  InsertSentEmail,
  SentEmail,
} from '@shared/schema';
import { eq } from 'drizzle-orm';
import { graphAuthService } from '../microsoft/graphAuthService';
import { createGraphClient, SendEmailOptions } from '../microsoft/graphApiClient';
import { emailJobQueue } from './jobQueue';

export interface SendEmailRequest {
  connectionId: number;
  userId: number;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  importance?: 'low' | 'normal' | 'high';
  attachments?: {
    name: string;
    contentType: string;
    contentBase64: string;
  }[];
  replyTo?: string;
  inReplyToMessageId?: string;
  linkedConversationId?: number;
  linkedContactId?: number;
  linkedPropertyId?: number;
  templateUsed?: string;
}

export interface SendEmailResult {
  success: boolean;
  sentEmailId?: number;
  graphMessageId?: string;
  error?: string;
}

/**
 * Email Sender Service
 */
export class EmailSender {
  /**
   * Queues an email for sending.
   * Creates a database record and enqueues a job.
   */
  async queueEmail(request: SendEmailRequest): Promise<SendEmailResult> {
    try {
      // Validate connection
      const [connection] = await db
        .select()
        .from(emailConnections)
        .where(eq(emailConnections.id, request.connectionId))
        .limit(1);

      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      if (connection.status !== 'active') {
        return { success: false, error: 'Connection is not active' };
      }

      // Create sent email record
      const sentEmailData: InsertSentEmail = {
        connectionId: request.connectionId,
        userId: request.userId,
        toAddresses: request.to,
        ccAddresses: request.cc || null,
        bccAddresses: request.bcc || null,
        replyTo: request.replyTo || null,
        subject: request.subject,
        bodyText: request.bodyText || null,
        bodyHtml: request.bodyHtml || null,
        importance: request.importance || 'normal',
        hasAttachments: (request.attachments?.length || 0) > 0,
        attachments: request.attachments
          ? request.attachments.map((a) => ({
              name: a.name,
              contentType: a.contentType,
              size: Math.round((a.contentBase64.length * 3) / 4), // Approximate decoded size
              contentBytes: a.contentBase64,
            }))
          : null,
        status: 'queued',
        inReplyTo: request.inReplyToMessageId || null,
        linkedConversationId: request.linkedConversationId || null,
        linkedContactId: request.linkedContactId || null,
        linkedPropertyId: request.linkedPropertyId || null,
        templateUsed: request.templateUsed || null,
      };

      const [sentEmail] = await db
        .insert(sentEmails)
        .values(sentEmailData)
        .returning();

      // Enqueue job for sending
      await emailJobQueue.enqueue(
        'send_email',
        {
          connectionId: request.connectionId,
          userId: request.userId,
          sentEmailId: sentEmail.id,
        },
        { priority: 5 }
      );

      console.log(`Queued email ${sentEmail.id} for sending to ${request.to.join(', ')}`);

      return { success: true, sentEmailId: sentEmail.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to queue email:', errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sends a queued email immediately (called by worker)
   */
  async sendQueuedEmail(sentEmailId: number): Promise<SendEmailResult> {
    try {
      // Get the sent email record
      const [sentEmail] = await db
        .select()
        .from(sentEmails)
        .where(eq(sentEmails.id, sentEmailId))
        .limit(1);

      if (!sentEmail) {
        return { success: false, error: 'Sent email record not found' };
      }

      if (sentEmail.status === 'sent') {
        return { success: true, sentEmailId, graphMessageId: sentEmail.graphMessageId || undefined };
      }

      // Get the connection
      const [connection] = await db
        .select()
        .from(emailConnections)
        .where(eq(emailConnections.id, sentEmail.connectionId))
        .limit(1);

      if (!connection) {
        await this.markSendFailed(sentEmailId, 'Connection not found');
        return { success: false, error: 'Connection not found' };
      }

      if (connection.status !== 'active') {
        await this.markSendFailed(sentEmailId, 'Connection is not active');
        return { success: false, error: 'Connection is not active' };
      }

      // Update status to sending
      await db
        .update(sentEmails)
        .set({ status: 'sending', updatedAt: new Date() })
        .where(eq(sentEmails.id, sentEmailId));

      // Get valid access token
      const tokenResult = await graphAuthService.getValidAccessToken(
        connection.accessToken,
        connection.refreshToken,
        connection.tokenExpiresAt,
        connection.tenantId
      );

      // Update tokens if refreshed
      if (tokenResult.needsUpdate) {
        await db
          .update(emailConnections)
          .set({
            accessToken: tokenResult.newAccessToken!,
            refreshToken: tokenResult.newRefreshToken!,
            tokenExpiresAt: tokenResult.newExpiresAt!,
            updatedAt: new Date(),
          })
          .where(eq(emailConnections.id, connection.id));
      }

      // Prepare email options
      const sendOptions: SendEmailOptions = {
        to: sentEmail.toAddresses,
        cc: sentEmail.ccAddresses || undefined,
        bcc: sentEmail.bccAddresses || undefined,
        subject: sentEmail.subject,
        bodyText: sentEmail.bodyText || undefined,
        bodyHtml: sentEmail.bodyHtml || undefined,
        importance: sentEmail.importance as 'low' | 'normal' | 'high' | undefined,
        replyTo: sentEmail.replyTo || undefined,
        saveToSentItems: true,
      };

      // Add attachments if present
      if (sentEmail.attachments && Array.isArray(sentEmail.attachments)) {
        sendOptions.attachments = (sentEmail.attachments as any[]).map((a) => ({
          name: a.name,
          contentType: a.contentType,
          contentBytes: a.contentBytes,
        }));
      }

      // Send via Graph API
      const graphClient = createGraphClient(tokenResult.accessToken);
      await graphClient.sendEmail(sendOptions);

      // Mark as sent
      await db
        .update(sentEmails)
        .set({
          status: 'sent',
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(sentEmails.id, sentEmailId));

      console.log(`Successfully sent email ${sentEmailId} to ${sentEmail.toAddresses.join(', ')}`);

      return { success: true, sentEmailId };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to send email ${sentEmailId}:`, errorMessage);
      await this.markSendFailed(sentEmailId, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Sends an email immediately (bypasses queue)
   */
  async sendImmediate(request: SendEmailRequest): Promise<SendEmailResult> {
    const queueResult = await this.queueEmail(request);
    if (!queueResult.success || !queueResult.sentEmailId) {
      return queueResult;
    }

    return this.sendQueuedEmail(queueResult.sentEmailId);
  }

  /**
   * Marks an email as failed to send
   */
  private async markSendFailed(sentEmailId: number, reason: string): Promise<void> {
    await db
      .update(sentEmails)
      .set({
        status: 'failed',
        failedAt: new Date(),
        failureReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(sentEmails.id, sentEmailId));
  }

  /**
   * Gets sent emails for a user
   */
  async getSentEmails(
    userId: number,
    options: { limit?: number; offset?: number; status?: string } = {}
  ): Promise<SentEmail[]> {
    const { limit = 50, offset = 0, status } = options;

    let query = db.select().from(sentEmails).where(eq(sentEmails.userId, userId));

    if (status) {
      query = query.where(eq(sentEmails.status, status)) as any;
    }

    return query
      .orderBy(sentEmails.createdAt)
      .limit(limit)
      .offset(offset);
  }

  /**
   * Gets a specific sent email
   */
  async getSentEmail(sentEmailId: number, userId: number): Promise<SentEmail | null> {
    const [email] = await db
      .select()
      .from(sentEmails)
      .where(eq(sentEmails.id, sentEmailId))
      .limit(1);

    if (!email || email.userId !== userId) {
      return null;
    }

    return email;
  }

  /**
   * Retries a failed email
   */
  async retryFailedEmail(sentEmailId: number, userId: number): Promise<SendEmailResult> {
    const [email] = await db
      .select()
      .from(sentEmails)
      .where(eq(sentEmails.id, sentEmailId))
      .limit(1);

    if (!email || email.userId !== userId) {
      return { success: false, error: 'Email not found' };
    }

    if (email.status !== 'failed') {
      return { success: false, error: 'Email is not in failed status' };
    }

    // Reset status and re-queue
    await db
      .update(sentEmails)
      .set({
        status: 'queued',
        failedAt: null,
        failureReason: null,
        updatedAt: new Date(),
      })
      .where(eq(sentEmails.id, sentEmailId));

    await emailJobQueue.enqueue(
      'send_email',
      {
        connectionId: email.connectionId,
        userId: email.userId,
        sentEmailId: email.id,
      },
      { priority: 5 }
    );

    return { success: true, sentEmailId };
  }
}

// Export singleton instance
export const emailSender = new EmailSender();
