/**
 * Tenancy Event Hooks
 *
 * Fire-and-forget hooks called from tenancy routes to trigger
 * automatic checklist generation on tenancy creation and status changes.
 * Extended with deal pipeline triggering for lettings_agreed, tenancy_ending,
 * lease_renewal, and rent_review pipelines.
 * Errors are caught and logged -- never thrown to the caller.
 */

import { pool } from '../../db';
import { checklistService } from './checklistService';
import { auditLogger } from '../middleware/auditLogger';

// Lazy imports to avoid circular dependencies at module load
let _dealService: any = null;
async function getDealService() {
  if (!_dealService) {
    const mod = await import('./dealService');
    _dealService = mod.dealService;
  }
  return _dealService;
}

let _dealPipelineService: any = null;
async function getDealPipelineService() {
  if (!_dealPipelineService) {
    const mod = await import('./dealPipelineService');
    _dealPipelineService = mod.dealPipelineService;
  }
  return _dealPipelineService;
}

let _dealEventBus: any = null;
let _DEAL_EVENTS: any = null;
async function getDealEventBus() {
  if (!_dealEventBus) {
    const mod = await import('./dealEventBus');
    _dealEventBus = mod.dealEventBus;
    _DEAL_EVENTS = mod.DEAL_EVENTS;
  }
  return { dealEventBus: _dealEventBus, DEAL_EVENTS: _DEAL_EVENTS };
}

/**
 * Called after a new tenancy is created.
 * Generates an onboarding checklist if the tenancy status is 'active' or 'pending'.
 * Also triggers the lettings_agreed deal pipeline.
 */
export async function onTenancyCreated(
  tenancyId: number,
  status: string,
  tenancyData?: { propertyId?: number; landlordId?: number; tenantId?: number; rentAmount?: number; depositAmount?: number; startDate?: string; endDate?: string },
): Promise<void> {
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

      // Fire-and-forget: trigger lettings_agreed deal pipeline
      (async () => {
        try {
          const dealSvc = await getDealService();
          const pipelineSvc = await getDealPipelineService();
          const { dealEventBus, DEAL_EVENTS } = await getDealEventBus();

          // Look up tenancy details if not provided
          let data = tenancyData || {};
          if (!data.propertyId) {
            const tenancyResult = await pool.query(
              `SELECT property_id, landlord_id, tenant_id, rent_amount, deposit_amount, start_date, end_date
               FROM tenancy_contracts WHERE id = $1`,
              [tenancyId]
            );
            const row = tenancyResult.rows[0];
            if (row) {
              data = {
                propertyId: row.property_id,
                landlordId: row.landlord_id,
                tenantId: row.tenant_id,
                rentAmount: row.rent_amount,
                depositAmount: row.deposit_amount,
                startDate: row.start_date?.toISOString?.() || row.start_date,
                endDate: row.end_date?.toISOString?.() || row.end_date,
              };
            }
          }

          if (!data.propertyId) return; // Cannot proceed without property

          const deal = await dealSvc.createDeal({
            dealType: 'lettings_agreed',
            propertyId: data.propertyId,
            tenancyId,
            landlordId: data.landlordId,
            tenantId: data.tenantId,
            currentPipeline: 'lettings_agreed',
            dealData: {
              rentAmount: data.rentAmount,
              depositAmount: data.depositAmount,
              startDate: data.startDate,
              endDate: data.endDate,
            },
          });

          await pipelineSvc.initializePipeline('lettings_agreed', deal);

          await dealEventBus.emit(DEAL_EVENTS.TENANCY_AGREED, {
            dealId: deal.id,
            propertyId: data.propertyId,
            dealType: 'lettings_agreed',
            tenancyId,
            landlordId: data.landlordId,
            tenantId: data.tenantId,
          });
        } catch (err) {
          console.error('[tenancy event hook] deal pipeline trigger error:', err);
        }
      })();
    }
  } catch (err) {
    console.error('[tenancy event hook] onTenancyCreated error:', err);
  }
}

/**
 * Called after a tenancy status changes.
 * Generates offboarding checklist when status becomes 'ending' or 'notice_served'.
 * Also triggers the tenancy_ending deal pipeline.
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

      // Fire-and-forget: trigger tenancy_ending deal pipeline
      (async () => {
        try {
          const dealSvc = await getDealService();
          const pipelineSvc = await getDealPipelineService();
          const { dealEventBus, DEAL_EVENTS } = await getDealEventBus();

          const tenancyResult = await pool.query(
            `SELECT property_id, landlord_id, tenant_id FROM tenancy_contracts WHERE id = $1`,
            [tenancyId]
          );
          const row = tenancyResult.rows[0];
          if (!row?.property_id) return;

          const deal = await dealSvc.createDeal({
            dealType: 'tenancy_ending',
            propertyId: row.property_id,
            tenancyId,
            landlordId: row.landlord_id,
            tenantId: row.tenant_id,
            currentPipeline: 'tenancy_ending',
          });

          await pipelineSvc.initializePipeline('tenancy_ending', deal);

          await dealEventBus.emit(DEAL_EVENTS.TENANCY_ENDING, {
            dealId: deal.id,
            propertyId: row.property_id,
            dealType: 'tenancy_ending',
            tenancyId,
          });
        } catch (err) {
          console.error('[tenancy event hook] tenancy_ending pipeline trigger error:', err);
        }
      })();
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

/**
 * Daily pg-boss job handler: Check for tenancies approaching renewal (90 days before end_date)
 * and tenancies due for annual rent review (within 30 days of start_date anniversary).
 * Should be registered via pg-boss schedule at server startup.
 */
export async function dailyTenancyCheckHandler(): Promise<void> {
  try {
    const dealSvc = await getDealService();
    const pipelineSvc = await getDealPipelineService();
    const { dealEventBus, DEAL_EVENTS } = await getDealEventBus();

    // ---- Lease Renewal Check (90 days before end_date) ----
    const renewalResult = await pool.query(
      `SELECT tc.id AS tenancy_id, tc.property_id, tc.landlord_id, tc.tenant_id, tc.end_date
       FROM tenancy_contracts tc
       WHERE tc.status = 'active'
         AND tc.end_date BETWEEN NOW() + INTERVAL '85 days' AND NOW() + INTERVAL '95 days'
         AND NOT EXISTS (
           SELECT 1 FROM deal d
           WHERE d.tenancy_id = tc.id
             AND d.deal_type = 'lease_renewal'
             AND d.status IN ('active', 'paused')
         )`
    );

    for (const row of renewalResult.rows) {
      try {
        const deal = await dealSvc.createDeal({
          dealType: 'lease_renewal',
          propertyId: row.property_id,
          tenancyId: row.tenancy_id,
          landlordId: row.landlord_id,
          tenantId: row.tenant_id,
          currentPipeline: 'lease_renewal',
        });

        await pipelineSvc.initializePipeline('lease_renewal', deal);

        await dealEventBus.emit(DEAL_EVENTS.LEASE_RENEWAL_DUE, {
          dealId: deal.id,
          propertyId: row.property_id,
          dealType: 'lease_renewal',
          tenancyId: row.tenancy_id,
        });
      } catch (err) {
        console.error(`[dailyTenancyCheck] lease renewal error for tenancy ${row.tenancy_id}:`, err);
      }
    }

    // ---- Rent Review Check (annual, within 30 days of start_date anniversary) ----
    const rentReviewResult = await pool.query(
      `SELECT tc.id AS tenancy_id, tc.property_id, tc.landlord_id, tc.tenant_id,
              tc.start_date, tc.rent_amount
       FROM tenancy_contracts tc
       WHERE tc.status = 'active'
         AND tc.start_date IS NOT NULL
         AND (
           -- Check if start_date anniversary is within the next 30 days
           (EXTRACT(MONTH FROM tc.start_date) * 100 + EXTRACT(DAY FROM tc.start_date))
           BETWEEN
           (EXTRACT(MONTH FROM NOW() + INTERVAL '1 day') * 100 + EXTRACT(DAY FROM NOW() + INTERVAL '1 day'))
           AND
           (EXTRACT(MONTH FROM NOW() + INTERVAL '30 days') * 100 + EXTRACT(DAY FROM NOW() + INTERVAL '30 days'))
         )
         AND NOT EXISTS (
           SELECT 1 FROM deal d
           WHERE d.tenancy_id = tc.id
             AND d.deal_type = 'rent_review'
             AND d.status IN ('active', 'paused')
         )`
    );

    for (const row of rentReviewResult.rows) {
      try {
        const deal = await dealSvc.createDeal({
          dealType: 'rent_review',
          propertyId: row.property_id,
          tenancyId: row.tenancy_id,
          landlordId: row.landlord_id,
          tenantId: row.tenant_id,
          currentPipeline: 'rent_review',
          dealData: {
            currentRentAmount: row.rent_amount,
            reviewTrigger: 'annual_anniversary',
          },
        });

        await pipelineSvc.initializePipeline('rent_review', deal);

        await dealEventBus.emit(DEAL_EVENTS.RENT_REVIEW_DUE, {
          dealId: deal.id,
          propertyId: row.property_id,
          dealType: 'rent_review',
          tenancyId: row.tenancy_id,
        });
      } catch (err) {
        console.error(`[dailyTenancyCheck] rent review error for tenancy ${row.tenancy_id}:`, err);
      }
    }
  } catch (err) {
    console.error('[dailyTenancyCheck] error:', err);
  }
}

/**
 * Register the daily tenancy check job with pg-boss.
 * Call once at server startup.
 */
export async function registerDailyTenancyCheck(boss: any): Promise<void> {
  try {
    await boss.schedule('daily-tenancy-check', '0 6 * * *'); // 6am daily
    await boss.work('daily-tenancy-check', async () => {
      await dailyTenancyCheckHandler();
    });
    console.log('[tenancyEventHooks] Daily tenancy check worker registered');
  } catch (err) {
    console.error('[tenancyEventHooks] Failed to register daily check:', err);
  }
}
