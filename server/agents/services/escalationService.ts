/**
 * Escalation Service
 *
 * Handles escalation to human staff with round-robin assignment per department.
 * When a staff member does not respond within 30 minutes, the escalation is
 * reassigned to the next available staff member. If all staff are exhausted,
 * a fallback message is sent to the contact.
 */

import { db } from '../../db';
import { staffProfiles, users, agentAuditLog } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { messageSender } from './messageSender';
import { auditLogger } from '../middleware/auditLogger';
import type { CommunicationChannel } from '../types';

// Round-robin counters per department (module-level state)
const departmentCounters = new Map<string, number>();

interface EscalateParams {
  conversationId: number;
  reason: string;
  urgency: 'normal' | 'high' | 'urgent';
  channel: CommunicationChannel;
  contactIdentifier?: string;
}

interface EscalateResult {
  escalationId: number | null;
  assignedTo: number | null;
  notified: boolean;
}

interface StaffRow {
  staffId: number;
  staffUserId: number;
  staffDepartment: string;
  userId: number;
  userEmail: string;
  userFullName: string;
}

/**
 * Map channel + reason to a department for staff lookup.
 */
function inferDepartment(reason: string, _channel: CommunicationChannel): string {
  const lower = reason.toLowerCase();
  if (/\b(buy|purchase|sale|offer|sales)\b/.test(lower)) return 'sales';
  if (/\b(rent|rental|let|lettings|tenant)\b/.test(lower)) return 'lettings';
  if (/\b(maintenance|repair|fix|broken|leak)\b/.test(lower)) return 'maintenance';
  return 'admin'; // Default department
}

export class EscalationService {
  /**
   * Escalate a conversation to a human staff member.
   * Uses round-robin within the inferred department.
   */
  async escalate(params: EscalateParams): Promise<EscalateResult> {
    const department = inferDepartment(params.reason, params.channel);

    // Query staff members in this department
    const staff: StaffRow[] = await db
      .select({
        staffId: staffProfiles.id,
        staffUserId: staffProfiles.userId,
        staffDepartment: staffProfiles.department,
        userId: users.id,
        userEmail: users.email,
        userFullName: users.fullName,
      })
      .from(staffProfiles)
      .innerJoin(users, eq(staffProfiles.userId, users.id))
      .where(
        and(
          eq(staffProfiles.department, department),
          eq(staffProfiles.isActive, true),
          eq(users.isActive, true),
        )
      )
      .limit(50);

    if (staff.length === 0) {
      // No staff available -- log and return null assignment
      await auditLogger.logEscalation({
        agentType: 'supervisor',
        reasoning: `No staff available in ${department} department. Reason: ${params.reason}`,
        conversationId: params.conversationId,
        channel: params.channel,
      });

      return { escalationId: null, assignedTo: null, notified: false };
    }

    // Round-robin assignment
    const currentIndex = departmentCounters.get(department) || 0;
    const assignedStaff = staff[currentIndex % staff.length];
    departmentCounters.set(department, (currentIndex + 1) % staff.length);

    // Log escalation
    await auditLogger.logEscalation({
      agentType: 'supervisor',
      reasoning: `Escalated to ${assignedStaff.userFullName} (${department}). Reason: ${params.reason}`,
      conversationId: params.conversationId,
      channel: params.channel,
    });

    // Notify assigned staff via email
    const notificationSubject = `[${params.urgency.toUpperCase()}] Escalation: ${params.reason.slice(0, 80)}`;
    const notificationBody = [
      `An AI agent has escalated a conversation that needs your attention.`,
      ``,
      `Reason: ${params.reason}`,
      `Urgency: ${params.urgency}`,
      `Channel: ${params.channel}`,
      `Conversation ID: ${params.conversationId}`,
      ``,
      `Please review the conversation in the CRM and respond to the contact.`,
    ].join('\n');

    let notified = false;
    try {
      notified = await messageSender.send('email', assignedStaff.userEmail, notificationBody, {
        subject: notificationSubject,
      });
    } catch {
      console.error(`[EscalationService] Failed to notify ${assignedStaff.userEmail}`);
    }

    // Schedule 30-minute follow-up via pg-boss (if available)
    try {
      const PgBoss = (await import('pg-boss')).default;
      const boss = new PgBoss(process.env.DATABASE_URL || '');
      await boss.send('escalation-followup', {
        escalationId: params.conversationId, // Using conversationId as a reference
        assignedUserId: assignedStaff.staffUserId,
        departmentStaff: staff,
        currentIndex: currentIndex % staff.length,
        conversationId: params.conversationId,
        channel: params.channel,
        contactIdentifier: params.contactIdentifier,
        reason: params.reason,
        attemptCount: 1,
      }, {
        startAfter: 30 * 60, // 30 minutes in seconds
      });
    } catch (err) {
      console.error('[EscalationService] Failed to schedule follow-up:', err);
      // Non-critical -- escalation still succeeds
    }

    return {
      escalationId: params.conversationId,
      assignedTo: assignedStaff.staffUserId,
      notified,
    };
  }

  /**
   * Handle a follow-up job: check if staff actioned the escalation,
   * reassign if not, or send fallback if all staff exhausted.
   */
  async handleFollowUp(job: { data: any }): Promise<void> {
    const {
      escalationId,
      assignedUserId,
      departmentStaff,
      currentIndex,
      conversationId,
      channel,
      contactIdentifier,
      reason,
      attemptCount,
    } = job.data;

    // Check if escalation has been actioned
    const resolved = await db
      .select()
      .from(agentAuditLog)
      .where(
        and(
          eq(agentAuditLog.conversationId, conversationId),
          eq(agentAuditLog.action, 'escalation_resolved'),
        )
      )
      .limit(1);

    if (resolved.length > 0) {
      // Already resolved, nothing to do
      return;
    }

    // Check if all staff have been tried
    if (attemptCount >= departmentStaff.length) {
      // All staff exhausted -- send fallback message to contact
      if (contactIdentifier && channel) {
        await messageSender.send(
          channel,
          contactIdentifier,
          'Our team will be in touch with you shortly. Thank you for your patience.',
          undefined,
        );
      }

      await auditLogger.logEscalation({
        agentType: 'supervisor',
        reasoning: `All staff exhausted for escalation. Sent fallback message. Reason: ${reason}`,
        conversationId,
        channel,
      });
      return;
    }

    // Reassign to next staff member
    const nextIndex = (currentIndex + 1) % departmentStaff.length;
    const nextStaff = departmentStaff[nextIndex];

    // Notify next staff member
    const notificationBody = [
      `An escalated conversation needs your attention (reassigned from another team member).`,
      ``,
      `Reason: ${reason}`,
      `Conversation ID: ${conversationId}`,
      ``,
      `Please review and respond.`,
    ].join('\n');

    await messageSender.send('email', nextStaff.userEmail, notificationBody, {
      subject: `[REASSIGNED] Escalation: ${(reason || '').slice(0, 80)}`,
    });

    await auditLogger.logEscalation({
      agentType: 'supervisor',
      reasoning: `Reassigned escalation to ${nextStaff.userFullName}. Previous assignee (${assignedUserId}) did not respond.`,
      conversationId,
      channel,
    });

    // Schedule another follow-up
    try {
      const PgBoss = (await import('pg-boss')).default;
      const boss = new PgBoss(process.env.DATABASE_URL || '');
      await boss.send('escalation-followup', {
        escalationId,
        assignedUserId: nextStaff.staffUserId,
        departmentStaff,
        currentIndex: nextIndex,
        conversationId,
        channel,
        contactIdentifier,
        reason,
        attemptCount: attemptCount + 1,
      }, {
        startAfter: 30 * 60,
      });
    } catch (err) {
      console.error('[EscalationService] Failed to schedule next follow-up:', err);
    }
  }
}

/** Singleton instance */
export const escalationService = new EscalationService();

/**
 * Register the pg-boss worker for escalation follow-ups.
 * Call this once during server startup when pg-boss is available.
 */
export async function startEscalationWorker(boss: any): Promise<void> {
  await boss.work('escalation-followup', async (job: any) => {
    await escalationService.handleFollowUp(job);
  });
  console.log('[EscalationService] Follow-up worker registered');
}
