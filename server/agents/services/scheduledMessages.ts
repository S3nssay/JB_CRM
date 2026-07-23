/**
 * Scheduled Message Service
 *
 * pg-boss job queue for viewing reminders, follow-up sequences,
 * checklist chases, and post-action confirmation hooks.
 *
 * Workers check opt-out status before sending and log delivery via auditLogger.
 */

import * as PgBossModule from 'pg-boss';
const PgBoss = (PgBossModule as any).default || PgBossModule;
import { messageSender } from './messageSender';
import { auditLogger } from '../middleware/auditLogger';
import { db } from '../../db';
import { contactIdentities } from '@shared/schema';
import { eq, or } from 'drizzle-orm';

// ---- Types ----

export interface ArrearsChaseJobData {
  arrearsId: number;
  tenantId: number;
  contactPhone: string;
  channel: 'whatsapp' | 'sms';
}

export interface PaymentCommitmentFollowUpData {
  arrearsId: number;
  tenantId: number;
  contactPhone: string;
  channel: 'whatsapp' | 'sms';
  commitAmount: number; // pence
  commitDate: string; // ISO date
  attemptNumber: number; // starts at 1
}

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

    await this.boss.work('arrears-chase', async (job: any) => {
      const data = job.data as ArrearsChaseJobData;
      if (await this.checkOptOut(data.contactPhone)) {
        console.log(`[ScheduledMessages] Skipping arrears chase for opted-out contact ${data.contactPhone}`);
        return;
      }

      try {
        const { arrearsComplianceGuard } = await import('./arrearsComplianceGuard');
        const { arrears } = await import('@shared/schema');
        const { eq } = await import('drizzle-orm');

        const check = await arrearsComplianceGuard.canContact(data.tenantId, data.channel);

        if (!check.allowed) {
          // Log blocked attempt
          await arrearsComplianceGuard.logContactAttempt(
            data.arrearsId,
            data.channel,
            data.channel,
            'blocked',
            `Scheduled chase blocked: ${check.reason}`,
          );

          // Reschedule for next allowed time if available
          if (check.nextAllowedAt) {
            await this.boss.send('arrears-chase', data, {
              startAfter: check.nextAllowedAt.toISOString(),
              retryLimit: 3,
              retryDelay: 300,
            });
            console.log(`[ScheduledMessages] Arrears chase rescheduled for ${check.nextAllowedAt.toISOString()}`);
          }
          return;
        }

        // Get arrears amount for message
        const arrearsRows = await db
          .select()
          .from(arrears)
          .where(eq(arrears.id, data.arrearsId))
          .limit(1);

        const amount = arrearsRows.length > 0
          ? `£${(arrearsRows[0].amount / 100).toFixed(2)}`
          : 'your outstanding balance';

        const message = `This is a reminder from John Barclay Estate Agents regarding your outstanding rent balance of ${amount}. Please contact us to arrange payment.`;

        await messageSender.sendPreferred(data.contactPhone, message);

        await arrearsComplianceGuard.logContactAttempt(
          data.arrearsId,
          data.channel,
          data.channel,
          'sent',
          'Scheduled arrears chase sent',
        );

        await auditLogger.logToolCall({
          agentType: 'supervisor',
          toolName: 'scheduled_message',
          toolInput: { type: 'arrears-chase', tenantId: data.tenantId, arrearsId: data.arrearsId },
          toolOutput: { sent: true },
          durationMs: 0,
        }).catch(() => {});
      } catch (err) {
        console.error('[ScheduledMessages] Arrears chase failed:', err);
      }
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

    await this.boss.work('payment-commitment-followup', async (job: any) => {
      const data = job.data as PaymentCommitmentFollowUpData;

      // Check opt-out
      if (await this.checkOptOut(data.contactPhone)) {
        console.log(`[ScheduledMessages] Skipping payment follow-up for opted-out contact ${data.contactPhone}`);
        return;
      }

      try {
        const { arrears, payments } = await import('@shared/schema');
        const { eq, and, gte, lte } = await import('drizzle-orm');
        const { arrearsComplianceGuard } = await import('./arrearsComplianceGuard');

        // Check if payment was received (within date range around commitment date)
        const commitDate = new Date(data.commitDate);
        const searchStart = new Date(commitDate.getTime() - 1 * 24 * 60 * 60 * 1000); // 1 day before
        const searchEnd = new Date(commitDate.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 days after

        const paymentRows = await db
          .select()
          .from(payments)
          .where(
            and(
              eq(payments.tenantId, data.tenantId),
              eq(payments.status, 'completed'),
              gte(payments.paidAt, searchStart),
              lte(payments.paidAt, searchEnd),
            ),
          )
          .limit(1);

        if (paymentRows.length > 0) {
          const payment = paymentRows[0];
          const paidAmount = payment.amount;

          // Log success
          await auditLogger.logToolCall({
            agentType: 'supervisor',
            action: 'payment_commitment_verified',
            toolName: 'payment_commitment_followup',
            toolInput: { arrearsId: data.arrearsId, tenantId: data.tenantId },
            toolOutput: { arrearsId: data.arrearsId, amountPaid: paidAmount },
            durationMs: 0,
          } as any).catch(() => {});

          // Check arrears to determine status
          const arrearsRows = await db
            .select()
            .from(arrears)
            .where(eq(arrears.id, data.arrearsId))
            .limit(1);

          if (arrearsRows.length > 0) {
            const arrearsCase = arrearsRows[0];
            const newStatus = paidAmount >= arrearsCase.amount ? 'cleared' : 'partially_paid';
            const newAmount = newStatus === 'cleared' ? 0 : arrearsCase.amount - paidAmount;

            await db
              .update(arrears)
              .set({
                status: newStatus,
                amount: newAmount,
                updatedAt: new Date(),
              })
              .where(eq(arrears.id, data.arrearsId));
          }

          // Payment resolved -- do not send any message
          return;
        }

        // Payment NOT received

        // If 3+ attempts, escalate regardless
        if (data.attemptNumber >= 3) {
          const { escalationService } = await import('./escalationService');
          await escalationService.escalate({
            conversationId: 0,
            reason: `Payment commitment follow-up: Arrears #${data.arrearsId} - ${data.attemptNumber} follow-up attempts exhausted, no payment received`,
            urgency: 'urgent',
            channel: data.channel,
          });

          await auditLogger.logToolCall({
            agentType: 'supervisor',
            toolName: 'payment_commitment_followup',
            toolInput: { arrearsId: data.arrearsId, attemptNumber: data.attemptNumber },
            toolOutput: { escalated: true, reason: 'Max follow-up attempts reached' },
            durationMs: 0,
          }).catch(() => {});

          return;
        }

        // Check compliance before sending follow-up
        const check = await arrearsComplianceGuard.canContact(data.tenantId, data.channel);

        if (!check.allowed) {
          if (check.reason && check.reason.includes('escalate')) {
            // Escalation required
            const { escalationService } = await import('./escalationService');
            await escalationService.escalate({
              conversationId: 0,
              reason: `Payment commitment follow-up: Arrears #${data.arrearsId} - ${check.reason}`,
              urgency: 'urgent',
              channel: data.channel,
            });
            return;
          }

          if (check.nextAllowedAt) {
            // Reschedule for next allowed time
            await this.boss.send('payment-commitment-followup', data, {
              startAfter: check.nextAllowedAt.toISOString(),
              retryLimit: 3,
              retryDelay: 300,
            });
            return;
          }

          // Blocked with no next time -- log and stop
          return;
        }

        // Send follow-up message
        const amountFormatted = `£${(data.commitAmount / 100).toFixed(2)}`;
        const followUpMsg = `We noticed your committed payment of ${amountFormatted} was due on ${data.commitDate}. Can you confirm when we should expect this?`;

        await messageSender.sendPreferred(data.contactPhone, followUpMsg);

        // Log the contact attempt
        await arrearsComplianceGuard.logContactAttempt(
          data.arrearsId,
          data.channel,
          data.channel,
          'sent',
          'Payment commitment follow-up sent',
        );

        // Schedule another follow-up in 48 hours
        const fortyEightHours = new Date(Date.now() + 48 * 60 * 60 * 1000);
        await this.boss.send('payment-commitment-followup', {
          ...data,
          attemptNumber: data.attemptNumber + 1,
        }, {
          startAfter: fortyEightHours.toISOString(),
          retryLimit: 3,
          retryDelay: 300,
        });

        await auditLogger.logToolCall({
          agentType: 'supervisor',
          toolName: 'payment_commitment_followup',
          toolInput: { arrearsId: data.arrearsId, attemptNumber: data.attemptNumber },
          toolOutput: { followUpSent: true },
          durationMs: 0,
        }).catch(() => {});
      } catch (err) {
        console.error('[ScheduledMessages] Payment commitment follow-up failed:', err);
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
   * Schedule an arrears chase job for a future time.
   */
  async scheduleArrearsChase(data: ArrearsChaseJobData, runAt: Date): Promise<void> {
    await this.boss.send('arrears-chase', data, {
      startAfter: runAt.toISOString(),
      retryLimit: 3,
      retryDelay: 300,
    });
  }

  /**
   * Schedule a payment commitment follow-up job.
   */
  async schedulePaymentFollowUp(data: PaymentCommitmentFollowUpData, runAt: Date): Promise<string> {
    const jobId = await this.boss.send('payment-commitment-followup', data, {
      startAfter: runAt.toISOString(),
      retryLimit: 3,
      retryDelay: 300,
    });
    return jobId;
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
