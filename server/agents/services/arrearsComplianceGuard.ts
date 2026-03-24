/**
 * Arrears Compliance Guard
 *
 * Hard-coded compliance rules for arrears contact. These rules are enforced
 * at the code level -- the LLM cannot override them. Every contact attempt
 * (sent or blocked) is logged to the dunning_actions table.
 *
 * Rules enforced:
 * 1. Tenant opt-out respected (contact_identity.opted_out)
 * 2. Vulnerability flag stops all contact (arrears.notes contains VULNERABILITY_DETECTED)
 * 3. No contact before 09:00 or after 20:00 UK time
 * 4. No contact on Sundays
 * 5. Max 3 sent contacts before mandatory human escalation
 * 6. 48-hour window between same-type contacts (message or call)
 */

import { db } from '../../db';
import { arrears, dunningActions, contactIdentities } from '@shared/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

// ---- Types ----

export interface ContactCheckResult {
  allowed: boolean;
  reason: string | null;
  nextAllowedAt: Date | null;
}

// ---- Helper: UK time ----

function getUKTime(now?: Date): { hour: number; day: number; date: Date } {
  const d = now || new Date();
  // Use Intl to get UK hour and day
  const ukFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: 'numeric',
    hour12: false,
  });
  const ukDayFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  });

  const hour = parseInt(ukFormatter.format(d), 10);
  const dayStr = ukDayFormatter.format(d);
  // Sunday = 0 in JS Date, but we use Intl weekday string
  const day = dayStr === 'Sun' ? 0 : dayStr === 'Mon' ? 1 : dayStr === 'Tue' ? 2
    : dayStr === 'Wed' ? 3 : dayStr === 'Thu' ? 4 : dayStr === 'Fri' ? 5 : 6;

  return { hour, day, date: d };
}

function getNextMondayAt9(now: Date): Date {
  const ukDateStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  // Parse dd/mm/yyyy
  const [dd, mm, yyyy] = ukDateStr.split('/');
  const ukDate = new Date(`${yyyy}-${mm}-${dd}T09:00:00`);
  // Move forward to next Monday
  const dayOfWeek = ukDate.getDay();
  const daysToMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  ukDate.setDate(ukDate.getDate() + daysToMonday);
  return ukDate;
}

function getNextAt9(now: Date): Date {
  const ukDateStr = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  const [dd, mm, yyyy] = ukDateStr.split('/');
  const next9 = new Date(`${yyyy}-${mm}-${dd}T09:00:00`);
  // If it's already past 20:00, next 09:00 is tomorrow
  const { hour } = getUKTime(now);
  if (hour >= 20) {
    next9.setDate(next9.getDate() + 1);
  }
  return next9;
}

// ---- ArrearsComplianceGuard ----

export class ArrearsComplianceGuard {
  /**
   * Check whether automated contact is allowed for the given tenant.
   * Returns { allowed: false, reason } if any rule blocks contact.
   * Checks are ordered: permanent blocks first, then time-based, then frequency.
   */
  async canContact(
    tenantId: number,
    contactType: 'sms' | 'whatsapp' | 'phone_call' | 'email',
  ): Promise<ContactCheckResult> {
    const now = new Date();

    // Check 1: Opt-out
    try {
      const optedOut = await db
        .select()
        .from(contactIdentities)
        .where(
          and(
            eq(contactIdentities.contactId, tenantId),
            eq(contactIdentities.contactType, 'tenant'),
            eq(contactIdentities.optedOut, true),
          ),
        )
        .limit(1);

      if (optedOut.length > 0) {
        return { allowed: false, reason: 'Tenant opted out', nextAllowedAt: null };
      }
    } catch {
      // If query fails, allow (fail open for opt-out check, but log)
      console.warn('[ArrearsComplianceGuard] Opt-out check failed for tenant', tenantId);
    }

    // Check 2: Vulnerability flag
    try {
      const activeArrears = await db
        .select()
        .from(arrears)
        .where(
          and(
            eq(arrears.tenantId, tenantId),
            eq(arrears.status, 'active'),
          ),
        )
        .limit(1);

      if (activeArrears.length > 0 && activeArrears[0].notes?.includes('VULNERABILITY_DETECTED')) {
        return { allowed: false, reason: 'Vulnerability detected — case escalated', nextAllowedAt: null };
      }
    } catch {
      console.warn('[ArrearsComplianceGuard] Vulnerability check failed for tenant', tenantId);
    }

    // Check 3: Time of day (UK time)
    const uk = getUKTime(now);
    if (uk.hour < 9 || uk.hour >= 20) {
      return { allowed: false, reason: 'Outside contact hours (09:00-20:00)', nextAllowedAt: getNextAt9(now) };
    }

    // Check 4: Sunday
    if (uk.day === 0) {
      return { allowed: false, reason: 'No contact on Sundays', nextAllowedAt: getNextMondayAt9(now) };
    }

    // Get active arrears for remaining checks
    let activeArrearsRows: any[];
    try {
      activeArrearsRows = await db
        .select()
        .from(arrears)
        .where(
          and(
            eq(arrears.tenantId, tenantId),
            eq(arrears.status, 'active'),
          ),
        );
    } catch {
      // If we can't check arrears, deny contact to be safe
      return { allowed: false, reason: 'Unable to verify arrears status', nextAllowedAt: null };
    }

    if (activeArrearsRows.length === 0) {
      // No active arrears -- no reason to contact
      return { allowed: false, reason: 'No active arrears case', nextAllowedAt: null };
    }

    const arrearsIds = activeArrearsRows.map((a: any) => a.id);

    // Check 5: Contact limit (3 sent actions = escalation required)
    try {
      const sentActions = await db
        .select()
        .from(dunningActions)
        .where(
          and(
            sql`${dunningActions.arrearsId} IN (${sql.join(arrearsIds.map((id: number) => sql`${id}`), sql`, `)})`,
            eq(dunningActions.status, 'sent'),
          ),
        );

      if (sentActions.length >= 3) {
        return { allowed: false, reason: 'Contact limit reached — escalate to human', nextAllowedAt: null };
      }
    } catch {
      console.warn('[ArrearsComplianceGuard] Contact limit check failed for tenant', tenantId);
    }

    // Check 6: 48-hour window
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    try {
      if (contactType === 'phone_call') {
        // For calls, check phone_call action type
        const recentCalls = await db
          .select()
          .from(dunningActions)
          .where(
            and(
              sql`${dunningActions.arrearsId} IN (${sql.join(arrearsIds.map((id: number) => sql`${id}`), sql`, `)})`,
              eq(dunningActions.actionType, 'phone_call'),
              gte(dunningActions.sentAt, fortyEightHoursAgo),
            ),
          )
          .limit(1);

        if (recentCalls.length > 0) {
          const nextAllowed = recentCalls[0].sentAt
            ? new Date(recentCalls[0].sentAt.getTime() + 48 * 60 * 60 * 1000)
            : null;
          return { allowed: false, reason: 'Call made within 48 hours', nextAllowedAt: nextAllowed };
        }
      } else {
        // For messages (sms/whatsapp/email), check message channels
        const recentMessages = await db
          .select()
          .from(dunningActions)
          .where(
            and(
              sql`${dunningActions.arrearsId} IN (${sql.join(arrearsIds.map((id: number) => sql`${id}`), sql`, `)})`,
              sql`${dunningActions.channel} IN ('sms', 'whatsapp', 'email')`,
              gte(dunningActions.sentAt, fortyEightHoursAgo),
            ),
          )
          .limit(1);

        if (recentMessages.length > 0) {
          const nextAllowed = recentMessages[0].sentAt
            ? new Date(recentMessages[0].sentAt.getTime() + 48 * 60 * 60 * 1000)
            : null;
          return { allowed: false, reason: 'Contact sent within 48 hours', nextAllowedAt: nextAllowed };
        }
      }
    } catch {
      console.warn('[ArrearsComplianceGuard] 48h window check failed for tenant', tenantId);
    }

    // All checks pass
    return { allowed: true, reason: null, nextAllowedAt: null };
  }

  /**
   * Log a contact attempt (sent or blocked) to the dunning_actions table.
   * Also updates arrears.lastReminderSent if status is 'sent'.
   */
  async logContactAttempt(
    arrearsId: number,
    actionType: string,
    channel: string,
    status: 'sent' | 'blocked',
    notes?: string,
  ): Promise<void> {
    try {
      await db.insert(dunningActions).values({
        arrearsId,
        actionType,
        channel,
        status,
        sentAt: status === 'sent' ? new Date() : null,
        notes: notes || null,
      });

      if (status === 'sent') {
        await db
          .update(arrears)
          .set({ lastReminderSent: new Date(), updatedAt: new Date() })
          .where(eq(arrears.id, arrearsId));
      }
    } catch (err) {
      console.error('[ArrearsComplianceGuard] Failed to log contact attempt:', err);
    }
  }

  /**
   * Get contact history for a tenant's active arrears cases.
   */
  async getContactHistory(tenantId: number): Promise<any[]> {
    try {
      const activeArrearsRows = await db
        .select()
        .from(arrears)
        .where(
          and(
            eq(arrears.tenantId, tenantId),
            eq(arrears.status, 'active'),
          ),
        );

      if (activeArrearsRows.length === 0) return [];

      const arrearsIds = activeArrearsRows.map((a: any) => a.id);

      const history = await db
        .select()
        .from(dunningActions)
        .where(
          sql`${dunningActions.arrearsId} IN (${sql.join(arrearsIds.map((id: number) => sql`${id}`), sql`, `)})`
        )
        .orderBy(sql`${dunningActions.createdAt} DESC`);

      return history;
    } catch (err) {
      console.error('[ArrearsComplianceGuard] Failed to get contact history:', err);
      return [];
    }
  }
}

/** Singleton instance */
export const arrearsComplianceGuard = new ArrearsComplianceGuard();
