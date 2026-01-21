/**
 * Subscription Manager Service
 *
 * Manages Microsoft Graph webhook subscriptions for email notifications.
 * Handles creation, renewal, and deletion of subscriptions.
 */

import { db } from '../../db';
import {
  emailConnections,
  emailWebhookSubscriptions,
  InsertEmailWebhookSubscription,
  EmailWebhookSubscription,
} from '@shared/schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { graphAuthService } from '../microsoft/graphAuthService';
import { createGraphClient } from '../microsoft/graphApiClient';
import { generateClientState } from '../../lib/encryption';
import { emailJobQueue } from './jobQueue';

// Microsoft Graph subscription limits
const MAX_SUBSCRIPTION_LIFETIME_MINUTES = 4230; // ~3 days for mail resources
const RENEWAL_BUFFER_MINUTES = 60; // Renew 1 hour before expiry

export interface CreateSubscriptionResult {
  success: boolean;
  subscriptionId?: number;
  error?: string;
}

export interface RenewSubscriptionResult {
  success: boolean;
  newExpirationDate?: Date;
  error?: string;
}

/**
 * Subscription Manager Service
 */
export class SubscriptionManager {
  /**
   * Creates a new webhook subscription for a user's mailbox
   */
  async createSubscription(connectionId: number): Promise<CreateSubscriptionResult> {
    try {
      // Get the connection
      const [connection] = await db
        .select()
        .from(emailConnections)
        .where(eq(emailConnections.id, connectionId))
        .limit(1);

      if (!connection) {
        return { success: false, error: 'Connection not found' };
      }

      if (connection.status !== 'active') {
        return { success: false, error: 'Connection is not active' };
      }

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
          .where(eq(emailConnections.id, connectionId));
      }

      // Prepare subscription parameters
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const notificationUrl = `${baseUrl}/api/email-integration/webhook`;
      const clientState = generateClientState();

      // Calculate expiration (max 3 days for mail)
      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(
        expirationDateTime.getMinutes() + MAX_SUBSCRIPTION_LIFETIME_MINUTES
      );

      // Resource to watch - inbox messages
      const resource = `users/${connection.microsoftUserId || 'me'}/mailFolders/inbox/messages`;

      // Create subscription via Graph API
      const graphClient = createGraphClient(tokenResult.accessToken);
      const graphSubscription = await graphClient.createSubscription({
        resource,
        changeType: 'created,updated',
        notificationUrl,
        expirationDateTime,
        clientState,
      });

      // Store subscription in database
      const subscriptionData: InsertEmailWebhookSubscription = {
        connectionId,
        userId: connection.userId,
        subscriptionId: graphSubscription.id,
        resource: graphSubscription.resource,
        changeType: graphSubscription.changeType,
        notificationUrl: graphSubscription.notificationUrl,
        expiresAt: new Date(graphSubscription.expirationDateTime),
        clientState,
        status: 'active',
        renewalAttempts: 0,
      };

      const [subscription] = await db
        .insert(emailWebhookSubscriptions)
        .values(subscriptionData)
        .returning();

      console.log(`Created webhook subscription ${subscription.id} for connection ${connectionId}`);

      // Schedule renewal job
      await this.scheduleRenewal(subscription.id, subscription.expiresAt);

      return { success: true, subscriptionId: subscription.id };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to create subscription for connection ${connectionId}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Renews an existing webhook subscription
   */
  async renewSubscription(subscriptionDbId: number): Promise<RenewSubscriptionResult> {
    try {
      // Get the subscription
      const [subscription] = await db
        .select()
        .from(emailWebhookSubscriptions)
        .where(eq(emailWebhookSubscriptions.id, subscriptionDbId))
        .limit(1);

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      // Get the connection
      const [connection] = await db
        .select()
        .from(emailConnections)
        .where(eq(emailConnections.id, subscription.connectionId))
        .limit(1);

      if (!connection) {
        await this.markSubscriptionError(subscriptionDbId, 'Connection not found');
        return { success: false, error: 'Connection not found' };
      }

      if (connection.status !== 'active') {
        await this.markSubscriptionError(subscriptionDbId, 'Connection is not active');
        return { success: false, error: 'Connection is not active' };
      }

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

      // Calculate new expiration
      const newExpirationDateTime = new Date();
      newExpirationDateTime.setMinutes(
        newExpirationDateTime.getMinutes() + MAX_SUBSCRIPTION_LIFETIME_MINUTES
      );

      // Renew via Graph API
      const graphClient = createGraphClient(tokenResult.accessToken);
      await graphClient.updateSubscription(
        subscription.subscriptionId,
        newExpirationDateTime
      );

      // Update in database
      await db
        .update(emailWebhookSubscriptions)
        .set({
          expiresAt: newExpirationDateTime,
          renewalAttempts: 0,
          lastError: null,
          status: 'active',
          updatedAt: new Date(),
        })
        .where(eq(emailWebhookSubscriptions.id, subscriptionDbId));

      console.log(`Renewed subscription ${subscriptionDbId} until ${newExpirationDateTime}`);

      // Schedule next renewal
      await this.scheduleRenewal(subscriptionDbId, newExpirationDateTime);

      return { success: true, newExpirationDate: newExpirationDateTime };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to renew subscription ${subscriptionDbId}:`, errorMessage);

      // Increment renewal attempts
      await db
        .update(emailWebhookSubscriptions)
        .set({
          renewalAttempts: sql`${emailWebhookSubscriptions.renewalAttempts} + 1`,
          lastError: errorMessage,
          updatedAt: new Date(),
        })
        .where(eq(emailWebhookSubscriptions.id, subscriptionDbId));

      // Check if subscription expired and needs recreation
      const [sub] = await db
        .select()
        .from(emailWebhookSubscriptions)
        .where(eq(emailWebhookSubscriptions.id, subscriptionDbId))
        .limit(1);

      if (sub && sub.expiresAt < new Date()) {
        // Subscription expired, mark as such and attempt recreation
        await db
          .update(emailWebhookSubscriptions)
          .set({ status: 'expired' })
          .where(eq(emailWebhookSubscriptions.id, subscriptionDbId));

        // Try to create a new subscription
        console.log(`Subscription ${subscriptionDbId} expired, creating new one`);
        const recreateResult = await this.createSubscription(sub.connectionId);
        if (recreateResult.success) {
          return { success: true, newExpirationDate: new Date() };
        }
      }

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Deletes a webhook subscription
   */
  async deleteSubscription(subscriptionDbId: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the subscription
      const [subscription] = await db
        .select()
        .from(emailWebhookSubscriptions)
        .where(eq(emailWebhookSubscriptions.id, subscriptionDbId))
        .limit(1);

      if (!subscription) {
        return { success: false, error: 'Subscription not found' };
      }

      // Get the connection for token
      const [connection] = await db
        .select()
        .from(emailConnections)
        .where(eq(emailConnections.id, subscription.connectionId))
        .limit(1);

      if (connection && connection.status === 'active') {
        try {
          const tokenResult = await graphAuthService.getValidAccessToken(
            connection.accessToken,
            connection.refreshToken,
            connection.tokenExpiresAt,
            connection.tenantId
          );

          const graphClient = createGraphClient(tokenResult.accessToken);
          await graphClient.deleteSubscription(subscription.subscriptionId);
        } catch (graphError) {
          console.warn(`Could not delete subscription from Graph API:`, graphError);
          // Continue to delete from database anyway
        }
      }

      // Delete from database
      await db
        .delete(emailWebhookSubscriptions)
        .where(eq(emailWebhookSubscriptions.id, subscriptionDbId));

      console.log(`Deleted subscription ${subscriptionDbId}`);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to delete subscription ${subscriptionDbId}:`, errorMessage);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Gets all subscriptions that need renewal soon
   */
  async getSubscriptionsNeedingRenewal(): Promise<EmailWebhookSubscription[]> {
    const renewalThreshold = new Date();
    renewalThreshold.setMinutes(renewalThreshold.getMinutes() + RENEWAL_BUFFER_MINUTES);

    return db
      .select()
      .from(emailWebhookSubscriptions)
      .where(
        and(
          eq(emailWebhookSubscriptions.status, 'active'),
          lte(emailWebhookSubscriptions.expiresAt, renewalThreshold)
        )
      );
  }

  /**
   * Schedules a job to renew the subscription before expiry
   */
  private async scheduleRenewal(subscriptionId: number, expiresAt: Date): Promise<void> {
    // Schedule renewal for 1 hour before expiry
    const renewalTime = new Date(expiresAt);
    renewalTime.setMinutes(renewalTime.getMinutes() - RENEWAL_BUFFER_MINUTES);

    // Don't schedule if renewal time is in the past
    if (renewalTime <= new Date()) {
      console.log(`Renewal time for subscription ${subscriptionId} is in the past, renewing now`);
      await emailJobQueue.enqueue(
        'renew_subscription',
        { subscriptionId, connectionId: 0 }, // connectionId will be looked up
        { priority: 10 }
      );
      return;
    }

    await emailJobQueue.enqueue(
      'renew_subscription',
      { subscriptionId, connectionId: 0 },
      {
        scheduledFor: renewalTime,
        priority: 10,
        idempotencyKey: `renew:${subscriptionId}:${renewalTime.getTime()}`,
      }
    );

    console.log(`Scheduled renewal for subscription ${subscriptionId} at ${renewalTime}`);
  }

  /**
   * Marks a subscription as having an error
   */
  private async markSubscriptionError(subscriptionId: number, error: string): Promise<void> {
    await db
      .update(emailWebhookSubscriptions)
      .set({
        status: 'error',
        lastError: error,
        updatedAt: new Date(),
      })
      .where(eq(emailWebhookSubscriptions.id, subscriptionId));
  }

  /**
   * Gets subscriptions for a connection
   */
  async getSubscriptionsForConnection(connectionId: number): Promise<EmailWebhookSubscription[]> {
    return db
      .select()
      .from(emailWebhookSubscriptions)
      .where(eq(emailWebhookSubscriptions.connectionId, connectionId));
  }

  /**
   * Runs a check for all subscriptions that need renewal
   * This can be called periodically (e.g., every 15 minutes)
   */
  async checkAndRenewSubscriptions(): Promise<void> {
    const subscriptions = await this.getSubscriptionsNeedingRenewal();

    console.log(`Found ${subscriptions.length} subscriptions needing renewal`);

    for (const subscription of subscriptions) {
      await emailJobQueue.enqueue(
        'renew_subscription',
        { subscriptionId: subscription.id, connectionId: subscription.connectionId },
        {
          priority: 10,
          idempotencyKey: `renew:${subscription.id}:${Date.now()}`,
        }
      );
    }
  }
}

// Export singleton instance
export const subscriptionManager = new SubscriptionManager();
