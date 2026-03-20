/**
 * Checklist Service
 *
 * Generates onboarding/offboarding checklists from tenancyChecklistItemMeta,
 * tracks outstanding items, chases contacts for missing documents, and
 * escalates to staff after 3 failed chases.
 */

import { db } from '../../db';
import {
  tenancyChecklistItems,
  tenancyChecklistItemMeta,
  tenancyChecklistItemLabels,
  agentAuditLog,
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { auditLogger } from '../middleware/auditLogger';
import { messageSender } from './messageSender';
import type { CommunicationChannel } from '../types';

// Lazy import to avoid circular dependency
let _escalationService: any = null;
async function getEscalationService() {
  if (!_escalationService) {
    const mod = await import('./escalationService');
    _escalationService = mod.escalationService;
  }
  return _escalationService;
}

/** Workflow filter mapping */
const WORKFLOW_FILTERS: Record<string, string[]> = {
  onboarding: ['onboarding', 'compliance', 'general'],
  offboarding: ['end_of_tenancy'],
};

export class ChecklistService {
  /**
   * Generate checklist items for a tenancy based on workflow type.
   * Inserts items from tenancyChecklistItemMeta matching the workflow filter.
   */
  async generateChecklist(
    tenancyId: number,
    workflow: 'onboarding' | 'offboarding',
  ): Promise<{ created: number; items: string[] }> {
    const allowedWorkflows = WORKFLOW_FILTERS[workflow];

    // Filter meta entries by workflow
    const matchingItems = Object.entries(tenancyChecklistItemMeta)
      .filter(([_, meta]) => allowedWorkflows.includes(meta.workflow))
      .map(([itemType]) => itemType);

    if (matchingItems.length === 0) {
      return { created: 0, items: [] };
    }

    // Batch insert all matching items
    const insertValues = matchingItems.map((itemType) => ({
      tenancyId,
      itemType,
      isCompleted: false,
    }));

    await db.insert(tenancyChecklistItems).values(insertValues);

    return { created: matchingItems.length, items: matchingItems };
  }

  /**
   * Get outstanding (incomplete) checklist items for a tenancy.
   */
  async getOutstandingItems(tenancyId: number) {
    const items = await db
      .select()
      .from(tenancyChecklistItems)
      .where(
        and(
          eq(tenancyChecklistItems.tenancyId, tenancyId),
          eq(tenancyChecklistItems.isCompleted, false),
        ),
      );

    return items.map((item) => ({
      id: item.id,
      itemType: item.itemType,
      label: tenancyChecklistItemLabels[item.itemType as keyof typeof tenancyChecklistItemLabels] || item.itemType,
      tenancyId: item.tenancyId,
    }));
  }

  /**
   * Chase a contact for an outstanding checklist item.
   * Sends a message via the specified channel and logs to audit.
   * Escalates to staff after 3 previous chases.
   */
  async chaseItem(
    itemId: number,
    channel: CommunicationChannel,
    contactValue: string,
    tenancyId: number,
  ): Promise<{ chased: boolean; escalated: boolean; chaseCount: number }> {
    // Look up the item
    const [item] = await db
      .select()
      .from(tenancyChecklistItems)
      .where(eq(tenancyChecklistItems.id, itemId));

    if (!item) {
      return { chased: false, escalated: false, chaseCount: 0 };
    }

    const label = tenancyChecklistItemLabels[item.itemType as keyof typeof tenancyChecklistItemLabels] || item.itemType;

    // Count previous chases from audit log
    const chaseRecords = await db
      .select()
      .from(agentAuditLog)
      .where(
        and(
          eq(agentAuditLog.action, 'tool_call'),
        ),
      )
      .limit(100);

    // Filter for chases matching this item (checking toolInput metadata)
    const previousChases = chaseRecords.filter((r: any) => {
      try {
        const input = typeof r.toolInput === 'string' ? JSON.parse(r.toolInput) : r.toolInput;
        return input?.toolName === 'chase_checklist_item' && input?.itemId === itemId;
      } catch {
        return false;
      }
    });

    const chaseCount = previousChases.length;

    if (chaseCount >= 3) {
      // Escalate to staff
      const escService = await getEscalationService();
      await escService.escalate({
        conversationId: tenancyId,
        reason: `Checklist item overdue after 3 chases: ${label} (item #${itemId})`,
        urgency: 'high',
        channel,
      });

      await auditLogger.logToolCall({
        agentType: 'admin',
        toolName: 'chase_checklist_item',
        toolInput: { itemId, channel, contactValue, tenancyId, toolName: 'chase_checklist_item' },
        toolOutput: { escalated: true, chaseCount },
        durationMs: 0,
      });

      return { chased: false, escalated: true, chaseCount };
    }

    // Send chase message
    const message = `We still need your ${label} for your tenancy. Please submit at your earliest convenience.`;
    await messageSender.send(channel, contactValue, message, undefined);

    // Log to audit
    await auditLogger.logToolCall({
      agentType: 'admin',
      toolName: 'chase_checklist_item',
      toolInput: { itemId, channel, contactValue, tenancyId, toolName: 'chase_checklist_item' },
      toolOutput: { chased: true, chaseCount: chaseCount + 1 },
      durationMs: 0,
    });

    return { chased: true, escalated: false, chaseCount: chaseCount + 1 };
  }
}

/** Singleton instance */
export const checklistService = new ChecklistService();
