/**
 * Scheduled Message Service
 *
 * pg-boss job queue for viewing reminders, follow-up sequences,
 * checklist chases, and post-action confirmation hooks.
 *
 * Workers check opt-out status before sending and log delivery via auditLogger.
 */

import PgBoss from 'pg-boss';
import { messageSender } from './messageSender';
import { auditLogger } from '../middleware/auditLogger';
import { db } from '../../db';
import { contactIdentities } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

// ---- Types ----

export interface PostActionParams {
  action: 'book_viewing' | 'create_lead';
  contactPhone: string;
  contactEmail?: string;
  channel: 'whatsapp' | 'sms' | 'email';

  // Viewing-specific
  viewingId?: number;
  viewingDate?: Date;
  propertyAddress?: string;

  // Lead-specific
  leadName?: string;
  leadType?: string;
}

export interface FollowUpJobData {
  contactPhone: string;
  channel: string;
  leadType: string;
  propertyIds: number[];
  messageType: string;
}

interface ViewingReminderJobData {
  viewingId: number;
  contactPhone: string;
  channel: string;
  type: '24h' | 'morning';
  propertyAddress?: string;
}

// ---- Service ----

export class ScheduledMessageService {
  private boss: PgBoss;

  constructor() {
    this.boss = new PgBoss(process.env.DATABASE_URL || '');
  }

  /**
   * Initialize pg-boss and register all workers.
   */
  async start(): Promise<void> {
    await this.boss.start();

    // Register workers
    await this.boss.work('viewing-reminder', async (job: any) => {
      const data = job.data as ViewingReminderJobData;
      if (await this.checkOptOut(data.contactPhone)) {
        console.log(`[ScheduledMessages] Skipping viewing reminder for opted-out contact ${data.contactPhone}`);
        return;
      }

      const message = data.type === '24h'
        ? `Reminder: You have a viewing tomorrow at ${data.propertyAddress || 'the property'}. We look forward to seeing you.`
        : `Good morning. Just a reminder about your viewing today at ${data.propertyAddress || 'the property'}. We look forward to seeing you.`;

      await messageSender.sendPreferred(data.contactPhone, message);

      await auditLogger.logToolCall({
        agentType: 'supervisor',
        toolName: 'scheduled_message',
        toolInput: { type: 'viewing-reminder', subType: data.type, contactPhone: data.contactPhone },
        toolOutput: { sent: true },
        durationMs: 0,
      }).catch(() => {});
    });

    await this.boss.work('follow-up-thanks', async (job: any) => {
      await this.processFollowUpJob({ ...job.data, messageType: 'follow-up-thanks' });
    });

    await this.boss.work('follow-up-similar', async (job: any) => {
      await this.processFollowUpJob({ ...job.data, messageType: 'follow-up-similar' });
    });

    await this.boss.work('follow-up-checkin', async (job: any) => {
      await this.processFollowUpJob({ ...job.data, messageType: 'follow-up-checkin' });
    });

    await this.boss.work('checklist-chase', async (job: any) => {
      const data = job.data;
      if (await this.checkOptOut(data.contactPhone)) {
        return;
      }
      try {
        const { checklistService } = await import('./checklistService');
        await checklistService.chaseItem(data.tenancyId, data.itemId);
      } catch (err) {
        console.error('[ScheduledMessages] Checklist chase failed:', err);
      }
    });
  }

  /**
   * Schedule viewing reminder jobs: 24h before + morning-of.
   */
  async scheduleViewingReminders(
    viewingId: number,
    contactPhone: string,
    channel: string,
    viewingDate: Date,
  ): Promise<void> {
    // 24h before
    const twentyFourBefore = new Date(viewingDate.getTime() - 24 * 60 * 60 * 1000);

    // Morning-of (9:00 AM same day)
    const morningOf = new Date(viewingDate);
    morningOf.setUTCHours(9, 0, 0, 0);

    await this.boss.send('viewing-reminder', {
      viewingId,
      contactPhone,
      channel,
      type: '24h' as const,
    }, {
      startAfter: twentyFourBefore.toISOString(),
      retryLimit: 3,
      retryDelay: 300,
    });

    await this.boss.send('viewing-reminder', {
      viewingId,
      contactPhone,
      channel,
      type: 'morning' as const,
    }, {
      startAfter: morningOf.toISOString(),
      retryLimit: 3,
      retryDelay: 300,
    });
  }

  /**
   * Schedule follow-up sequence: Day 1 thanks, Day 3 similar, Day 7 check-in.
   */
  async scheduleFollowUp(
    contactPhone: string,
    channel: string,
    leadType: string,
    propertyIds?: number[],
  ): Promise<void> {
    const payload = {
      contactPhone,
      channel,
      leadType,
      propertyIds: propertyIds || [],
    };

    const oneDay = 60 * 60 * 24; // seconds
    const threeDays = oneDay * 3;
    const sevenDays = oneDay * 7;

    await this.boss.send('follow-up-thanks', payload, { startAfter: oneDay });
    await this.boss.send('follow-up-similar', payload, { startAfter: threeDays });
    await this.boss.send('follow-up-checkin', payload, { startAfter: sevenDays });
  }

  /**
   * Process a follow-up job. Returns true if sent, false if skipped (opt-out).
   */
  async processFollowUpJob(data: FollowUpJobData): Promise<boolean> {
    if (await this.checkOptOut(data.contactPhone)) {
      console.log(`[ScheduledMessages] Skipping ${data.messageType} for opted-out contact ${data.contactPhone}`);
      return false;
    }

    const message = this.getFollowUpMessage(data.messageType, data.leadType, data.propertyIds);
    await messageSender.sendPreferred(data.contactPhone, message);

    await auditLogger.logToolCall({
      agentType: 'supervisor',
      toolName: 'scheduled_message',
      toolInput: { type: data.messageType, contactPhone: data.contactPhone },
      toolOutput: { sent: true },
      durationMs: 0,
    }).catch(() => {});

    return true;
  }

  /**
   * Check if a contact has opted out (STOP keyword).
   */
  async checkOptOut(contactPhone: string): Promise<boolean> {
    try {
      const results = await db
        .select()
        .from(contactIdentities)
        .where(
          or(
            eq(contactIdentities.identifierValue, contactPhone),
            eq(contactIdentities.identifierValue, contactPhone.replace('+', '')),
          ),
        )
        .limit(1);

      return results.length > 0 && results[0].optedOut === true;
    } catch {
      return false;
    }
  }

  /**
   * Get the message text for a follow-up type.
   */
  private getFollowUpMessage(type: string, leadType: string, propertyIds: number[]): string {
    switch (type) {
      case 'follow-up-thanks':
        return 'Thank you for your interest in our properties. We hope you found them to your liking. If you have any questions, please do not hesitate to get in touch.';
      case 'follow-up-similar':
        return propertyIds.length > 0
          ? `We thought you might also be interested in some similar properties we have available. Please let us know if you would like to arrange any viewings.`
          : 'We have some new properties that might suit your requirements. Would you like us to send you details?';
      case 'follow-up-checkin':
        return `Just checking in -- are you still looking for properties? We would love to help you find the right ${leadType === 'tenant' ? 'rental' : 'home'}. Do get in touch if we can assist.`;
      default:
        return 'Thank you for your interest in John Barclay Estate Agents. Please get in touch if we can help.';
    }
  }
}

/** Singleton instance */
export const scheduledMessageService = new ScheduledMessageService();

// ---- Post-action hooks ----

/**
 * Handle post-action confirmations and scheduling after agent tool calls.
 * Called from webhooks after runAgent completes.
 */
export async function handlePostActions(params: PostActionParams): Promise<void> {
  const { action, contactPhone, contactEmail, channel } = params;

  if (action === 'book_viewing') {
    const { viewingId, viewingDate, propertyAddress } = params;

    // 1. Immediate confirmation on same channel
    const confirmMsg = `Your viewing has been confirmed at ${propertyAddress || 'the property'}. You will receive a reminder 24 hours before and on the morning of your viewing.`;
    await messageSender.send(channel, contactPhone, confirmMsg);

    // 2. Schedule viewing reminders
    if (viewingId && viewingDate) {
      await scheduledMessageService.scheduleViewingReminders(
        viewingId,
        contactPhone,
        channel,
        viewingDate,
      );
    }

    // 3. Email summary (regardless of original channel)
    if (contactEmail) {
      const emailBody = `Your viewing at ${propertyAddress || 'the property'} has been confirmed for ${viewingDate ? viewingDate.toLocaleDateString('en-GB') : 'the scheduled date'}. You will receive reminders before the viewing.`;
      await messageSender.send('email', contactEmail, emailBody, {
        subject: `Viewing Confirmation - ${propertyAddress || 'John Barclay'}`,
      });
    }
  }

  if (action === 'create_lead') {
    const { leadName, leadType } = params;

    // Email summary of the enquiry
    if (contactEmail) {
      const emailBody = `Thank you for your enquiry${leadName ? `, ${leadName}` : ''}. We have registered your interest as a ${leadType || 'prospective'} client. A member of our team will be in touch shortly with properties matching your requirements.`;
      await messageSender.send('email', contactEmail, emailBody, {
        subject: 'Your enquiry with John Barclay Estate Agents',
      });
    }
  }
}
