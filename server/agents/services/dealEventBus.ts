/**
 * Deal Event Bus
 *
 * Singleton event bus wrapping pg-boss send/work for deal lifecycle events.
 * Uses lazy initialization to avoid DB connection at module load.
 * Includes sourceEventId in payload to prevent circular event loops.
 */

import * as PgBossModule from 'pg-boss';
const PgBoss = (PgBossModule as any).default || PgBossModule;
import { randomUUID } from 'crypto';

// ---- Event Names ----

export const DEAL_EVENTS = {
  TENANCY_AGREED: 'tenancy.agreed',
  TENANCY_ENDING: 'tenancy.ending',
  LEASE_RENEWAL_DUE: 'lease.renewal_due',
  RENT_REVIEW_DUE: 'rent.review_due',
  SALE_AGREED: 'sale.agreed',
  SALE_COMPLETED: 'sale.completed',
  SALE_COLLAPSED: 'sale.collapsed',
  STEP_COMPLETED: 'step.completed',
  STEP_FAILED: 'step.failed',
  STEP_TIMED_OUT: 'step.timed_out',
  CROSS_REFERRAL: 'cross.referral',
  VALUATION_BOOKED: 'valuation.booked',
} as const;

export type DealEventName = typeof DEAL_EVENTS[keyof typeof DEAL_EVENTS];

// ---- Payload Interface ----

export interface DealEventPayload {
  dealId: number;
  propertyId: number;
  dealType: string;
  stepId?: string;
  sourceEventId?: string;
  [key: string]: any;
}

// ---- Lazy pg-boss init ----

let boss: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL || '');
    await boss.start();
  }
  return boss;
}

// ---- Event Bus Singleton ----

export const dealEventBus = {
  /**
   * Emit a deal event via pg-boss queue.
   * Adds sourceEventId to prevent circular event loops.
   */
  async emit(eventName: string, payload: DealEventPayload): Promise<string | null> {
    const b = await getBoss();
    const enrichedPayload = {
      ...payload,
      sourceEventId: payload.sourceEventId || randomUUID(),
    };
    return b.send(`deal-event.${eventName}`, enrichedPayload);
  },

  /**
   * Subscribe to a deal event. Registers a pg-boss worker on the queue.
   */
  async subscribe(
    eventName: string,
    handler: (payload: DealEventPayload) => Promise<void>
  ): Promise<void> {
    const b = await getBoss();
    await b.work(`deal-event.${eventName}`, async (job: any) => {
      await handler(job.data);
    });
  },
};
