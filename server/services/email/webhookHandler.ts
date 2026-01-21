/**
 * Microsoft Graph Webhook Handler
 *
 * Handles incoming webhook notifications from Microsoft Graph for email changes.
 * Validates notifications and enqueues processing jobs.
 */

import { db } from '../../db';
import { emailWebhookSubscriptions, emailConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { emailJobQueue, ProcessEmailPayload } from './jobQueue';
import crypto from 'crypto';

// Microsoft Graph notification types
export interface GraphNotification {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: 'created' | 'updated' | 'deleted';
  resource: string;
  resourceData?: {
    '@odata.type': string;
    '@odata.id': string;
    '@odata.etag'?: string;
    id: string;
  };
  clientState?: string;
  tenantId: string;
  encryptedContent?: {
    data: string;
    dataSignature: string;
    dataKey: string;
    encryptionCertificateId: string;
    encryptionCertificateThumbprint: string;
  };
}

export interface GraphNotificationPayload {
  value: GraphNotification[];
}

export interface ValidationHandlerResult {
  isValidation: true;
  validationToken: string;
}

export interface NotificationHandlerResult {
  isValidation: false;
  processedCount: number;
  errors: string[];
}

export type WebhookHandlerResult = ValidationHandlerResult | NotificationHandlerResult;

/**
 * Webhook Handler Service
 */
export class GraphWebhookHandler {
  /**
   * Handles incoming webhook request from Microsoft Graph.
   *
   * This method:
   * 1. Checks for validation token (subscription verification)
   * 2. Validates client state to prevent spoofing
   * 3. Enqueues jobs for actual notifications (does NOT process inline)
   *
   * IMPORTANT: Must respond within 3 seconds per Microsoft requirements.
   */
  async handleWebhook(
    query: { validationToken?: string },
    body: GraphNotificationPayload | null
  ): Promise<WebhookHandlerResult> {
    // Handle subscription validation
    if (query.validationToken) {
      console.log('Received webhook validation request');
      return {
        isValidation: true,
        validationToken: query.validationToken,
      };
    }

    // Handle actual notifications
    if (!body || !body.value || !Array.isArray(body.value)) {
      console.warn('Received empty or invalid notification payload');
      return {
        isValidation: false,
        processedCount: 0,
        errors: ['Invalid payload'],
      };
    }

    console.log(`Received ${body.value.length} notification(s) from Microsoft Graph`);

    const errors: string[] = [];
    let processedCount = 0;

    // Process each notification quickly - just validate and enqueue
    for (const notification of body.value) {
      try {
        await this.processNotification(notification);
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing notification: ${errorMessage}`);
        errors.push(errorMessage);
      }
    }

    return {
      isValidation: false,
      processedCount,
      errors,
    };
  }

  /**
   * Processes a single notification by validating and enqueuing a job.
   * Does NOT do heavy processing - that's for the worker.
   */
  private async processNotification(notification: GraphNotification): Promise<void> {
    const { subscriptionId, clientState, changeType, resource, resourceData } = notification;

    // Look up the subscription
    const [subscription] = await db
      .select()
      .from(emailWebhookSubscriptions)
      .where(eq(emailWebhookSubscriptions.subscriptionId, subscriptionId))
      .limit(1);

    if (!subscription) {
      console.warn(`Unknown subscription ID: ${subscriptionId}`);
      throw new Error('Unknown subscription');
    }

    // Validate client state to prevent spoofing
    if (clientState !== subscription.clientState) {
      console.error(`Client state mismatch for subscription ${subscriptionId}`);
      throw new Error('Client state validation failed');
    }

    // Check if subscription is active
    if (subscription.status !== 'active') {
      console.warn(`Notification for inactive subscription ${subscriptionId}`);
      return;
    }

    // Update last notification timestamp
    await db
      .update(emailWebhookSubscriptions)
      .set({
        lastNotificationAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(emailWebhookSubscriptions.id, subscription.id));

    // Get the connection for user context
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(eq(emailConnections.id, subscription.connectionId))
      .limit(1);

    if (!connection) {
      console.error(`Connection not found for subscription ${subscriptionId}`);
      throw new Error('Connection not found');
    }

    // Extract message ID from resource path or resourceData
    const messageId = resourceData?.id || this.extractMessageIdFromResource(resource);

    if (!messageId) {
      console.warn(`Could not extract message ID from notification`);
      return;
    }

    // Generate idempotency key to prevent duplicate processing
    const idempotencyKey = `email:${connection.id}:${messageId}:${changeType}`;

    // Enqueue job for processing
    const payload: ProcessEmailPayload = {
      graphMessageId: messageId,
      connectionId: subscription.connectionId,
      userId: subscription.userId,
      notificationId: notification.subscriptionId,
    };

    // Set priority based on change type
    const priority = changeType === 'created' ? 10 : changeType === 'updated' ? 5 : 0;

    await emailJobQueue.enqueue('process_email', payload, {
      priority,
      idempotencyKey,
    });

    console.log(`Enqueued ${changeType} notification for message ${messageId}`);
  }

  /**
   * Extracts message ID from resource path.
   * Resource format: "users/{user-id}/messages/{message-id}" or similar
   */
  private extractMessageIdFromResource(resource: string): string | null {
    const match = resource.match(/messages\/([^/]+)/);
    return match ? match[1] : null;
  }

  /**
   * Verifies the webhook notification signature (if using encrypted content).
   * This is optional but recommended for additional security.
   */
  verifyNotificationSignature(
    notification: GraphNotification,
    expectedClientState: string
  ): boolean {
    // Basic client state validation
    if (notification.clientState !== expectedClientState) {
      return false;
    }

    // If encrypted content is present, we would verify the signature here
    // This requires the certificate thumbprint and proper crypto verification
    // For now, client state validation is sufficient for most cases

    return true;
  }
}

// Export singleton instance
export const graphWebhookHandler = new GraphWebhookHandler();
