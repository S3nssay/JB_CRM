/**
 * IMAP Polling Service
 *
 * Periodically polls IMAP inboxes for SMTP-connected email accounts.
 * Feeds new emails into the same processing pipeline as M365 Graph emails.
 */

import { db } from '../../db';
import { emailConnections } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { imapPoller } from './smtpTransport';
import { emailProcessor } from './emailProcessor';

const DEFAULT_POLL_INTERVAL_MS = 60000; // 1 minute

class ImapPollingService {
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private isPolling = false;

  /**
   * Start periodic IMAP polling for all active SMTP connections
   */
  start(intervalMs: number = DEFAULT_POLL_INTERVAL_MS) {
    if (this.intervalHandle) {
      console.log('[ImapPoller] Already running');
      return;
    }

    console.log(`[ImapPoller] Starting with ${intervalMs / 1000}s interval`);

    // Initial poll after a short delay (let DB be ready)
    setTimeout(() => {
      this.pollAllConnections();
    }, 15000);

    // Periodic polling
    this.intervalHandle = setInterval(() => {
      this.pollAllConnections();
    }, intervalMs);
  }

  /**
   * Stop polling
   */
  stop() {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
      console.log('[ImapPoller] Stopped');
    }
  }

  /**
   * Poll all active SMTP connections for new emails
   */
  async pollAllConnections() {
    if (this.isPolling) {
      console.log('[ImapPoller] Already polling, skipping');
      return;
    }

    this.isPolling = true;

    try {
      // Find all active SMTP connections with sync enabled
      const connections = await db
        .select()
        .from(emailConnections)
        .where(
          and(
            eq(emailConnections.provider, 'smtp'),
            eq(emailConnections.status, 'active'),
            eq(emailConnections.syncEnabled, true)
          )
        );

      if (connections.length === 0) {
        return; // No SMTP connections to poll
      }

      console.log(`[ImapPoller] Polling ${connections.length} SMTP connection(s)`);

      for (const connection of connections) {
        try {
          await this.pollSingleConnection(connection.id);
        } catch (error) {
          console.error(`[ImapPoller] Failed to poll connection ${connection.id}:`, error);
        }
      }
    } catch (error) {
      console.error('[ImapPoller] Error in pollAllConnections:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll a single SMTP connection for new emails
   */
  async pollSingleConnection(connectionId: number) {
    const [connection] = await db
      .select()
      .from(emailConnections)
      .where(eq(emailConnections.id, connectionId))
      .limit(1);

    if (!connection) {
      console.error(`[ImapPoller] Connection ${connectionId} not found`);
      return;
    }

    if (connection.provider !== 'smtp') {
      console.log(`[ImapPoller] Connection ${connectionId} is not SMTP, skipping`);
      return;
    }

    if (!connection.imapHost || !connection.imapUser || !connection.imapPassword) {
      console.error(`[ImapPoller] Connection ${connectionId} missing IMAP credentials`);
      return;
    }

    try {
      const { messages, highestUid } = await imapPoller.fetchNewEmails(
        {
          imapHost: connection.imapHost,
          imapPort: connection.imapPort || 993,
          imapUser: connection.imapUser,
          imapPassword: connection.imapPassword,
          imapTls: connection.imapTls !== false,
        },
        connection.lastImapUid
      );

      if (messages.length === 0) {
        return;
      }

      console.log(`[ImapPoller] Connection ${connectionId}: ${messages.length} new email(s)`);

      let processed = 0;
      for (const msg of messages) {
        try {
          await emailProcessor.processSmtpEmail(msg, connectionId, connection.userId, connection.mailboxCategory);
          processed++;
        } catch (error) {
          console.error(`[ImapPoller] Failed to process email UID ${msg.uid}:`, error);
        }
      }

      // Update the last seen UID
      await db
        .update(emailConnections)
        .set({
          lastImapUid: highestUid,
          lastSyncAt: new Date(),
          errorCount: 0,
          lastError: null,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));

      console.log(`[ImapPoller] Connection ${connectionId}: processed ${processed}/${messages.length} email(s)`);
    } catch (error: any) {
      console.error(`[ImapPoller] IMAP error for connection ${connectionId}:`, error.message);

      // Update error state
      await db
        .update(emailConnections)
        .set({
          errorCount: connection.errorCount + 1,
          lastError: error.message,
          updatedAt: new Date(),
        })
        .where(eq(emailConnections.id, connectionId));
    }
  }
}

export const imapPollingService = new ImapPollingService();
