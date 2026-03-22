/**
 * Work Order Follow-up Service
 *
 * pg-boss workers for automated work order follow-ups:
 * - Contractor check-in: asks contractor about work progress
 * - Tenant satisfaction: asks tenant if issue is resolved
 * - Completion verification: checks at scheduled end date
 * - Audit logging of every follow-up attempt
 * - Escalation to staff after 2 unanswered follow-ups
 */

import PgBoss from 'pg-boss';
import { pool } from '../../db';
import { messageSender } from './messageSender';
import { auditLogger } from '../middleware/auditLogger';
import { escalationService } from './escalationService';

// ---- Configuration ----

/** Follow-up intervals by urgency (in seconds) */
const FOLLOWUP_INTERVALS: Record<string, number> = {
  emergency: 24 * 60 * 60,  // 24 hours
  urgent: 48 * 60 * 60,     // 48 hours
  routine: 72 * 60 * 60,    // 72 hours
  low: 96 * 60 * 60,        // 96 hours
};

const MAX_FOLLOWUP_ATTEMPTS = 2;
const MAX_COMPLETION_CHECKS = 3;
const COMPLETION_RECHECK_INTERVAL = 24 * 60 * 60; // 24 hours

// ---- Types ----

export interface FollowupJobData {
  workOrderId: number;
  ticketId: number;
  contractorId: number;
  tenantId: number;
  propertyId: number;
  urgency: string;
  attemptNumber: number;
}

// ---- Inactive statuses ----

const INACTIVE_STATUSES = ['completed', 'cancelled', 'failed'];

// ---- Service ----

export class WorkOrderFollowupService {
  private boss: PgBoss;

  constructor() {
    this.boss = new PgBoss(process.env.DATABASE_URL || '');
  }

  /**
   * Schedule all follow-up jobs for a work order.
   * Queues: contractor follow-up, tenant follow-up, and completion check.
   */
  async scheduleFollowups(workOrderId: number, urgency: string): Promise<void> {
    // 1. Look up work order
    const { rows: woRows } = await pool.query(
      `SELECT id, maintenance_request_id, contractor_id, work_order_number, scheduled_end, status
       FROM work_order WHERE id = $1`,
      [workOrderId],
    );

    if (woRows.length === 0) {
      throw new Error(`Work order ${workOrderId} not found`);
    }

    const wo = woRows[0];

    // 2. Look up ticket for tenant and property
    const { rows: ticketRows } = await pool.query(
      `SELECT id, tenant_id, property_id, title FROM maintenance_ticket WHERE id = $1`,
      [wo.maintenance_request_id],
    );

    if (ticketRows.length === 0) {
      throw new Error(`Maintenance ticket ${wo.maintenance_request_id} not found`);
    }

    const ticket = ticketRows[0];

    // 3. Calculate interval
    const interval = FOLLOWUP_INTERVALS[urgency] ?? FOLLOWUP_INTERVALS.routine;

    // 4. Build job data
    const jobData: FollowupJobData = {
      workOrderId,
      ticketId: ticket.id,
      contractorId: wo.contractor_id,
      tenantId: ticket.tenant_id,
      propertyId: ticket.property_id,
      urgency,
      attemptNumber: 1,
    };

    // 5. Queue jobs
    await this.boss.send('wo-contractor-followup', jobData, { startAfter: interval });
    await this.boss.send('wo-tenant-followup', jobData, { startAfter: interval });

    // Completion check at scheduled end (or interval if no end date)
    const completionStartAfter = wo.scheduled_end
      ? new Date(wo.scheduled_end).toISOString()
      : interval;

    await this.boss.send('wo-completion-check', jobData, { startAfter: completionStartAfter });
  }

  /**
   * Handle contractor follow-up job.
   * Sends progress check to contractor, logs audit, escalates after max attempts.
   */
  async handleContractorFollowup(job: { data: FollowupJobData }): Promise<void> {
    const data = job.data;

    // 1. Check work order status
    const { rows: woRows } = await pool.query(
      'SELECT id, status, work_order_number FROM work_order WHERE id = $1',
      [data.workOrderId],
    );

    if (woRows.length === 0) return;
    const wo = woRows[0];

    if (INACTIVE_STATUSES.includes(wo.status)) {
      // Work order done -- skip
      return;
    }

    // 2. Look up contractor
    const { rows: contractorRows } = await pool.query(
      'SELECT id, contact_name, phone FROM contractor WHERE id = $1',
      [data.contractorId],
    );

    // 3. Look up property address
    const { rows: propertyRows } = await pool.query(
      'SELECT address FROM properties WHERE id = $1',
      [data.propertyId],
    );

    const contractorName = contractorRows[0]?.contact_name ?? 'Contractor';
    const contractorPhone = contractorRows[0]?.phone;
    const address = propertyRows[0]?.address ?? 'the property';

    // 4. Send message
    if (contractorPhone) {
      const message = `Hi ${contractorName}, John Barclay Estate Agents checking on work order ${wo.work_order_number} at ${address}. Please confirm: Is the work progressing as planned? Reply with a status update.`;
      await messageSender.sendPreferred(contractorPhone, message);
    }

    // 5. Audit log
    await auditLogger.logToolCall({
      agentType: 'maintenance',
      toolName: 'wo-contractor-followup',
      toolInput: {
        workOrderId: data.workOrderId,
        ticketId: data.ticketId,
        attemptNumber: data.attemptNumber,
        followUpType: 'contractor',
      },
      toolOutput: { messageSent: !!contractorPhone },
      durationMs: 0,
      channel: 'system' as any,
    });

    // 6. Escalate or reschedule
    if (data.attemptNumber >= MAX_FOLLOWUP_ATTEMPTS) {
      await escalationService.escalate({
        conversationId: data.ticketId,
        reason: `No response from contractor after ${MAX_FOLLOWUP_ATTEMPTS} follow-up attempts for work order ${wo.work_order_number}`,
        urgency: 'high',
        channel: 'system' as any,
      });
    } else {
      // Schedule next attempt
      const interval = FOLLOWUP_INTERVALS[data.urgency] ?? FOLLOWUP_INTERVALS.routine;
      await this.boss.send('wo-contractor-followup', {
        ...data,
        attemptNumber: data.attemptNumber + 1,
      }, { startAfter: interval });
    }
  }

  /**
   * Handle tenant follow-up job.
   * Asks tenant if the issue has been resolved, logs audit, escalates after max attempts.
   */
  async handleTenantFollowup(job: { data: FollowupJobData }): Promise<void> {
    const data = job.data;

    // 1. Check work order status
    const { rows: woRows } = await pool.query(
      'SELECT id, status, work_order_number FROM work_order WHERE id = $1',
      [data.workOrderId],
    );

    if (woRows.length === 0) return;
    const wo = woRows[0];

    if (INACTIVE_STATUSES.includes(wo.status)) return;

    // 2. Look up tenant
    const { rows: tenantRows } = await pool.query(
      'SELECT id, name, phone, mobile FROM tenant WHERE id = $1',
      [data.tenantId],
    );

    // 3. Look up ticket title
    const { rows: ticketRows } = await pool.query(
      'SELECT title FROM maintenance_ticket WHERE id = $1',
      [data.ticketId],
    );

    // 4. Look up property address
    const { rows: propertyRows } = await pool.query(
      'SELECT address FROM properties WHERE id = $1',
      [data.propertyId],
    );

    const tenantName = tenantRows[0]?.name ?? 'Tenant';
    const tenantPhone = tenantRows[0]?.mobile || tenantRows[0]?.phone;
    const ticketTitle = ticketRows[0]?.title ?? 'the reported issue';
    const _address = propertyRows[0]?.address ?? 'your property';

    // 5. Send message
    if (tenantPhone) {
      const message = `Hi ${tenantName}, this is John Barclay Estate Agents. Our contractor was scheduled to attend to the ${ticketTitle} at your property. Has the issue been resolved? Please let us know.`;
      await messageSender.sendPreferred(tenantPhone, message);
    }

    // 6. Audit log
    await auditLogger.logToolCall({
      agentType: 'maintenance',
      toolName: 'wo-tenant-followup',
      toolInput: {
        workOrderId: data.workOrderId,
        ticketId: data.ticketId,
        attemptNumber: data.attemptNumber,
        followUpType: 'tenant',
      },
      toolOutput: { messageSent: !!tenantPhone },
      durationMs: 0,
      channel: 'system' as any,
    });

    // 7. Escalate or reschedule
    if (data.attemptNumber >= MAX_FOLLOWUP_ATTEMPTS) {
      await escalationService.escalate({
        conversationId: data.ticketId,
        reason: `No response from tenant after ${MAX_FOLLOWUP_ATTEMPTS} follow-up attempts for work order ${wo.work_order_number}`,
        urgency: 'normal',
        channel: 'system' as any,
      });
    } else {
      const interval = FOLLOWUP_INTERVALS[data.urgency] ?? FOLLOWUP_INTERVALS.routine;
      await this.boss.send('wo-tenant-followup', {
        ...data,
        attemptNumber: data.attemptNumber + 1,
      }, { startAfter: interval });
    }
  }

  /**
   * Handle completion check job.
   * Verifies work order is completed; if not, follows up with both parties.
   */
  async handleCompletionCheck(job: { data: FollowupJobData }): Promise<void> {
    const data = job.data;

    // 1. Check work order status
    const { rows: woRows } = await pool.query(
      'SELECT id, status, work_order_number FROM work_order WHERE id = $1',
      [data.workOrderId],
    );

    if (woRows.length === 0) return;
    const wo = woRows[0];

    // 2. If completed, log and done
    if (wo.status === 'completed') {
      await auditLogger.logToolCall({
        agentType: 'maintenance',
        toolName: 'wo-completion-check',
        toolInput: { workOrderId: data.workOrderId, attemptNumber: data.attemptNumber },
        toolOutput: { status: 'completed', verified: true },
        durationMs: 0,
        channel: 'system' as any,
      });
      return;
    }

    // 3. If cancelled/failed, skip
    if (INACTIVE_STATUSES.includes(wo.status)) return;

    // 4. Not completed -- follow up with both parties
    const { rows: contractorRows } = await pool.query(
      'SELECT id, contact_name, phone FROM contractor WHERE id = $1',
      [data.contractorId],
    );

    const { rows: tenantRows } = await pool.query(
      'SELECT id, name, phone, mobile FROM tenant WHERE id = $1',
      [data.tenantId],
    );

    const contractorPhone = contractorRows[0]?.phone;
    const tenantPhone = tenantRows[0]?.mobile || tenantRows[0]?.phone;

    if (contractorPhone) {
      await messageSender.sendPreferred(
        contractorPhone,
        `Work order ${wo.work_order_number} was due for completion. Please provide a status update.`,
      );
    }

    if (tenantPhone) {
      await messageSender.sendPreferred(
        tenantPhone,
        `The scheduled maintenance at your property should now be complete. Has the issue been resolved?`,
      );
    }

    // 5. Audit log
    await auditLogger.logToolCall({
      agentType: 'maintenance',
      toolName: 'wo-completion-check',
      toolInput: { workOrderId: data.workOrderId, attemptNumber: data.attemptNumber },
      toolOutput: { status: wo.status, overdue: true },
      durationMs: 0,
      channel: 'system' as any,
    });

    // 6. Reschedule or escalate
    if (data.attemptNumber >= MAX_COMPLETION_CHECKS) {
      await escalationService.escalate({
        conversationId: data.ticketId,
        reason: `Work order ${wo.work_order_number} overdue after ${MAX_COMPLETION_CHECKS} completion checks`,
        urgency: 'urgent',
        channel: 'system' as any,
      });
    } else {
      await this.boss.send('wo-completion-check', {
        ...data,
        attemptNumber: data.attemptNumber + 1,
      }, { startAfter: COMPLETION_RECHECK_INTERVAL });
    }
  }
}

/** Singleton instance */
export const workOrderFollowupService = new WorkOrderFollowupService();

/**
 * Register pg-boss workers for work order follow-ups.
 * Call once during server startup when pg-boss is available.
 */
export async function registerWorkOrderFollowupWorkers(boss: PgBoss): Promise<void> {
  const service = new WorkOrderFollowupService();

  await boss.work('wo-contractor-followup', async (job: any) => {
    await service.handleContractorFollowup(job);
  });

  await boss.work('wo-tenant-followup', async (job: any) => {
    await service.handleTenantFollowup(job);
  });

  await boss.work('wo-completion-check', async (job: any) => {
    await service.handleCompletionCheck(job);
  });

  console.log('[WorkOrderFollowup] Workers registered');
}
