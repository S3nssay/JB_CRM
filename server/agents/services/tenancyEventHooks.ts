/**
 * Tenancy Event Hooks
 *
 * Fire-and-forget hooks called from tenancy routes to trigger
 * automatic checklist generation on tenancy creation and status changes.
 * Errors are caught and logged -- never thrown to the caller.
 */

import { checklistService } from './checklistService';
import { auditLogger } from '../middleware/auditLogger';

/**
 * Called after a new tenancy is created.
 * Generates an onboarding checklist if the tenancy status is 'active' or 'pending'.
 */
export async function onTenancyCreated(tenancyId: number, status: string): Promise<void> {
  try {
    if (status === 'active' || status === 'pending') {
      await checklistService.generateChecklist(tenancyId, 'onboarding');

      await auditLogger.logToolCall({
        agentType: 'admin',
        toolName: 'auto_checklist_trigger',
        toolInput: { tenancyId, trigger: 'tenancy_created', workflow: 'onboarding' },
        toolOutput: { triggered: true },
        durationMs: 0,
      });
    }
  } catch (err) {
    console.error('[tenancy event hook] onTenancyCreated error:', err);
  }
}

/**
 * Called after a tenancy status changes.
 * Generates offboarding checklist when status becomes 'ending' or 'notice_served'.
 * Generates onboarding checklist when status becomes 'active' from non-active (late activation).
 */
export async function onTenancyStatusChanged(
  tenancyId: number,
  oldStatus: string | null,
  newStatus: string,
): Promise<void> {
  try {
    if (newStatus === 'ending' || newStatus === 'notice_served') {
      await checklistService.generateChecklist(tenancyId, 'offboarding');

      await auditLogger.logToolCall({
        agentType: 'admin',
        toolName: 'auto_checklist_trigger',
        toolInput: { tenancyId, trigger: 'status_changed', oldStatus, newStatus, workflow: 'offboarding' },
        toolOutput: { triggered: true },
        durationMs: 0,
      });
    } else if (newStatus === 'active' && oldStatus !== 'active') {
      await checklistService.generateChecklist(tenancyId, 'onboarding');

      await auditLogger.logToolCall({
        agentType: 'admin',
        toolName: 'auto_checklist_trigger',
        toolInput: { tenancyId, trigger: 'status_changed', oldStatus, newStatus, workflow: 'onboarding' },
        toolOutput: { triggered: true },
        durationMs: 0,
      });
    }
  } catch (err) {
    console.error('[tenancy event hook] onTenancyStatusChanged error:', err);
  }
}
