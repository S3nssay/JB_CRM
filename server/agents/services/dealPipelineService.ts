/**
 * Deal Pipeline Service
 *
 * Pipeline definitions and step execution engine for deal lifecycle management.
 * Pipelines are code-defined (not database-stored). Steps have dependencies,
 * timeouts, and optional flags. The engine advances steps when dependencies
 * are met, handles failures, and escalates timeouts to staff.
 */

import { pool } from '../../db';
import { dealService } from './dealService';
import { dealEventBus, DEAL_EVENTS } from './dealEventBus';
import { escalationService } from './escalationService';

// ---- Pipeline Step Interface ----

export interface PipelineStep {
  id: string;
  name: string;
  agentType: 'admin' | 'lettings' | 'pm' | 'sales';
  dependsOn: string[];
  isOptional: boolean;
  timeoutHours: number;
}

// ---- Pipeline Templates ----

export const PIPELINE_TEMPLATES: Record<string, PipelineStep[]> = {
  lettings_agreed: [
    { id: 'right_to_rent', name: 'Right to Rent Check', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 48 },
    { id: 'ast_contract', name: 'AST Contract Generation', agentType: 'admin', dependsOn: ['right_to_rent'], isOptional: false, timeoutHours: 72 },
    { id: 'deposit_registration', name: 'Deposit Registration', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 72 },
    { id: 'inventory_report', name: 'Inventory Report', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 96 },
    { id: 'welcome_message', name: 'Welcome Message', agentType: 'pm', dependsOn: [], isOptional: false, timeoutHours: 24 },
    { id: 'checkin_inspection', name: 'Check-in Inspection', agentType: 'pm', dependsOn: [], isOptional: false, timeoutHours: 168 },
  ],

  tenancy_ending: [
    { id: 'offboarding_checklist', name: 'Offboarding Checklist', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 48 },
    { id: 'deposit_return', name: 'Deposit Return', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 72 },
    { id: 'checkout_inspection', name: 'Checkout Inspection', agentType: 'pm', dependsOn: [], isOptional: false, timeoutHours: 96 },
    { id: 'condition_report', name: 'Condition Report', agentType: 'pm', dependsOn: ['checkout_inspection'], isOptional: false, timeoutHours: 48 },
    { id: 'relist_property', name: 'Relist Property', agentType: 'lettings', dependsOn: ['checkout_inspection'], isOptional: true, timeoutHours: 72 },
  ],

  lease_renewal: [
    { id: 'tenant_contact', name: 'Contact Tenant About Renewal', agentType: 'lettings', dependsOn: [], isOptional: false, timeoutHours: 72 },
    { id: 'generate_ast', name: 'Generate Renewal AST', agentType: 'admin', dependsOn: ['tenant_contact'], isOptional: false, timeoutHours: 72 },
  ],

  rent_review: [
    { id: 'market_comparison', name: 'Market Comparison Analysis', agentType: 'lettings', dependsOn: [], isOptional: false, timeoutHours: 72 },
    { id: 'landlord_proposal', name: 'Landlord Rent Proposal', agentType: 'lettings', dependsOn: ['market_comparison'], isOptional: false, timeoutHours: 48 },
    { id: 'tenant_communication', name: 'Tenant Rent Communication', agentType: 'lettings', dependsOn: ['landlord_proposal'], isOptional: false, timeoutHours: 48 },
    { id: 'section_13_notice', name: 'Section 13 Notice Generation', agentType: 'admin', dependsOn: ['landlord_proposal'], isOptional: true, timeoutHours: 72 },
  ],

  sale_agreed: [
    { id: 'sales_memorandum', name: 'Sales Memorandum', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 48 },
    { id: 'solicitor_notification', name: 'Solicitor Notification', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 24 },
    { id: 'compliance_checklist', name: 'Compliance Checklist', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 72 },
    { id: 'delist_rental', name: 'Delist Rental Listing', agentType: 'lettings', dependsOn: [], isOptional: true, timeoutHours: 24 },
  ],

  sale_collapsed: [
    { id: 'relist_property', name: 'Relist Property', agentType: 'sales', dependsOn: [], isOptional: false, timeoutHours: 24 },
    { id: 'notify_interested_buyers', name: 'Notify Interested Buyers', agentType: 'sales', dependsOn: [], isOptional: false, timeoutHours: 48 },
    { id: 'cancel_in_progress', name: 'Cancel In-Progress Actions', agentType: 'admin', dependsOn: [], isOptional: false, timeoutHours: 24 },
  ],
};

// ---- Pipeline Service ----

export const dealPipelineService = {
  /**
   * Initialize a pipeline for a deal. Creates all steps and starts those with no dependencies.
   */
  async initializePipeline(pipelineType: string, deal: any): Promise<void> {
    const template = PIPELINE_TEMPLATES[pipelineType];
    if (!template) {
      throw new Error(`Unknown pipeline type: ${pipelineType}`);
    }

    const createdSteps: any[] = [];

    // Create all steps
    for (const step of template) {
      const timeoutAt = new Date(Date.now() + step.timeoutHours * 60 * 60 * 1000);
      const created = await dealService.createDealStep({
        dealId: deal.id,
        stepId: step.id,
        stepName: step.name,
        agentType: step.agentType,
        dependsOn: step.dependsOn,
        isOptional: step.isOptional,
        timeoutAt,
      });
      createdSteps.push({ ...created, templateDeps: step.dependsOn });
    }

    // Start steps with no dependencies
    for (let i = 0; i < createdSteps.length; i++) {
      if (template[i].dependsOn.length === 0) {
        await dealService.updateDealStep(createdSteps[i].id, {
          status: 'in_progress',
          startedAt: new Date(),
        });
      }
    }

    // Record pipeline start event
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'pipeline.started',
      title: `Pipeline '${pipelineType}' initialized with ${template.length} steps`,
      actorType: 'system',
    });
  },

  /**
   * Advance a step to completed. Starts dependent steps whose ALL dependencies are met.
   * If all steps are completed/skipped, marks the deal as completed.
   */
  async advanceStep(dealId: number, stepId: string): Promise<void> {
    const steps = await dealService.getDealSteps(dealId);
    const currentStep = steps.find((s: any) => s.step_id === stepId);
    if (!currentStep) return;

    // Mark step completed
    await dealService.updateDealStep(currentStep.id, {
      status: 'completed',
      completedAt: new Date(),
    });

    await dealService.createDealEvent({
      dealId,
      eventType: 'step.completed',
      stepId,
      title: `Step '${stepId}' completed`,
      actorType: 'system',
    });

    // Build set of completed/skipped step IDs (including the one just completed)
    const completedSet = new Set<string>();
    for (const s of steps) {
      if (s.step_id === stepId || s.status === 'completed' || s.is_skipped) {
        completedSet.add(s.step_id);
      }
    }

    // Start dependent steps whose ALL dependencies are met
    for (const s of steps) {
      if (s.status !== 'pending') continue;
      const deps: string[] = s.depends_on ? JSON.parse(s.depends_on) : [];
      if (deps.length === 0) continue;
      const allDepsMet = deps.every((d: string) => completedSet.has(d));
      if (allDepsMet) {
        await dealService.updateDealStep(s.id, {
          status: 'in_progress',
          startedAt: new Date(),
        });
      }
    }

    // Check if all steps are now completed or skipped
    const updatedSteps = steps.map((s: any) => {
      if (s.step_id === stepId) return { ...s, status: 'completed' };
      return s;
    });
    const allDone = updatedSteps.every((s: any) =>
      s.status === 'completed' || s.is_skipped
    );
    if (allDone) {
      await dealService.updateDeal(dealId, {
        status: 'completed',
        completedAt: new Date(),
      });
      await dealService.createDealEvent({
        dealId,
        eventType: 'deal.completed',
        title: 'All pipeline steps completed',
        actorType: 'system',
      });
    }

    // Emit step completed event
    await dealEventBus.emit(DEAL_EVENTS.STEP_COMPLETED, {
      dealId,
      propertyId: 0,
      dealType: '',
      stepId,
    });
  },

  /**
   * Fail a step. Pauses the deal so the originating agent can collect missing info.
   */
  async failStep(dealId: number, stepId: string, reason: string): Promise<void> {
    const steps = await dealService.getDealSteps(dealId);
    const currentStep = steps.find((s: any) => s.step_id === stepId);
    if (!currentStep) return;

    await dealService.updateDealStep(currentStep.id, {
      status: 'failed',
      failedAt: new Date(),
      failureReason: reason,
    });

    await dealService.updateDeal(dealId, {
      status: 'paused',
      pausedAt: new Date(),
      pauseReason: `Step '${stepId}' failed: ${reason}`,
    });

    await dealService.createDealEvent({
      dealId,
      eventType: 'step.failed',
      stepId,
      title: `Step '${stepId}' failed: ${reason}`,
      actorType: 'system',
    });

    await dealEventBus.emit(DEAL_EVENTS.STEP_FAILED, {
      dealId,
      propertyId: 0,
      dealType: '',
      stepId,
    });
  },

  /**
   * Staff override: skip a step. Advances pipeline as if step completed.
   */
  async skipStep(dealId: number, stepId: string, userId: number): Promise<void> {
    const steps = await dealService.getDealSteps(dealId);
    const currentStep = steps.find((s: any) => s.step_id === stepId);
    if (!currentStep) return;

    await dealService.updateDealStep(currentStep.id, {
      isSkipped: true,
      overriddenBy: userId,
      overriddenAt: new Date(),
      overrideAction: 'skip',
    });

    await dealService.createDealEvent({
      dealId,
      eventType: 'step.skipped',
      stepId,
      title: `Step '${stepId}' skipped by staff (user ${userId})`,
      actorType: 'staff',
      actorId: userId,
    });

    // Advance pipeline (treat skip as completion for dependency resolution)
    // Build completed set including the skipped step
    const completedSet = new Set<string>();
    for (const s of steps) {
      if (s.step_id === stepId || s.status === 'completed' || s.is_skipped) {
        completedSet.add(s.step_id);
      }
    }

    // Start dependent steps
    for (const s of steps) {
      if (s.status !== 'pending') continue;
      const deps: string[] = s.depends_on ? JSON.parse(s.depends_on) : [];
      if (deps.length === 0) continue;
      if (deps.every((d: string) => completedSet.has(d))) {
        await dealService.updateDealStep(s.id, {
          status: 'in_progress',
          startedAt: new Date(),
        });
      }
    }

    // Check if all done
    const updatedSteps = steps.map((s: any) => {
      if (s.step_id === stepId) return { ...s, is_skipped: true };
      return s;
    });
    const allDone = updatedSteps.every((s: any) =>
      s.status === 'completed' || s.is_skipped
    );
    if (allDone) {
      await dealService.updateDeal(dealId, {
        status: 'completed',
        completedAt: new Date(),
      });
    }
  },

  /**
   * Staff manually completes a step. Advances pipeline.
   */
  async completeStepManually(dealId: number, stepId: string, userId: number): Promise<void> {
    const steps = await dealService.getDealSteps(dealId);
    const currentStep = steps.find((s: any) => s.step_id === stepId);
    if (!currentStep) return;

    await dealService.updateDealStep(currentStep.id, {
      status: 'completed',
      completedAt: new Date(),
      overriddenBy: userId,
      overriddenAt: new Date(),
      overrideAction: 'complete',
    });

    await dealService.createDealEvent({
      dealId,
      eventType: 'step.completed_manually',
      stepId,
      title: `Step '${stepId}' manually completed by staff (user ${userId})`,
      actorType: 'staff',
      actorId: userId,
    });

    // Use advanceStep logic for dependency resolution (call it directly)
    // Re-check completion using same logic
    await this.advanceStep(dealId, stepId);
  },

  /**
   * Check for timed-out steps and escalate to human staff.
   * Should be called periodically (every 15 minutes via pg-boss).
   */
  async checkTimeouts(): Promise<void> {
    const result = await pool.query(
      `SELECT * FROM deal_step
       WHERE status = 'in_progress'
         AND timeout_at < $1
         AND escalated_at IS NULL`,
      [new Date()]
    );

    for (const step of result.rows) {
      const deal = await dealService.getDeal(step.deal_id);

      // Escalate via escalation service
      await escalationService.escalateToStaff({
        conversationId: step.deal_id,
        reason: `Deal step '${step.step_name}' (${step.step_id}) has timed out`,
        urgency: 'high',
        channel: 'internal' as any,
        contactIdentifier: `deal-${step.deal_id}`,
      });

      // Mark escalated
      await dealService.updateDealStep(step.id, {
        escalatedAt: new Date(),
      });

      // Create timeline event
      await dealService.createDealEvent({
        dealId: step.deal_id,
        eventType: 'step.timed_out',
        stepId: step.step_id,
        title: `Step '${step.step_name}' timed out and escalated to staff`,
        actorType: 'system',
        metadata: {
          timeoutAt: step.timeout_at,
          agentType: step.agent_type,
          dealType: deal?.deal_type,
        },
      });

      // Emit timeout event
      await dealEventBus.emit(DEAL_EVENTS.STEP_TIMED_OUT, {
        dealId: step.deal_id,
        propertyId: deal?.property_id || 0,
        dealType: deal?.deal_type || '',
        stepId: step.step_id,
      });
    }
  },
};
