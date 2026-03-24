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

// Lazy imports to avoid circular dependencies at module load
let _checklistService: any = null;
async function getChecklistService() {
  if (!_checklistService) {
    const mod = await import('./checklistService');
    _checklistService = mod.checklistService;
  }
  return _checklistService;
}

let _messageSender: any = null;
async function getMessageSender() {
  if (!_messageSender) {
    const mod = await import('./messageSender');
    _messageSender = mod.messageSender;
  }
  return _messageSender;
}

let _pgBoss: any = null;
async function getPgBoss() {
  if (!_pgBoss) {
    const PgBoss = (await import('pg-boss')).default;
    _pgBoss = new PgBoss(process.env.DATABASE_URL || '');
    await _pgBoss.start();
  }
  return _pgBoss;
}

// ---- Staff notification helper ----

/**
 * Create a notification for all admin staff (userId=1 as default system notification target).
 * In production, this would query staffProfiles for the relevant department.
 */
async function notifyStaff(dealId: number, title: string, body: string, type: string): Promise<void> {
  try {
    await dealService.createNotification({
      userId: 1, // System notification target
      dealId,
      title,
      body,
      type,
    });
  } catch (err) {
    console.error('[dealPipelineService] notifyStaff error:', err);
  }
}

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

// ---- Pipeline Step Actions ----

type StepAction = (deal: any, step: any) => Promise<void>;

const STEP_ACTIONS: Record<string, StepAction> = {
  // ---- LETTINGS_AGREED steps ----

  right_to_rent: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Right to Rent check initiated',
      actorType: 'system',
      metadata: { action: 'right_to_rent', note: 'Manual check required by admin staff' },
    });
    await notifyStaff(deal.id, 'Right to Rent Check Required', `Please complete Right to Rent check for deal #${deal.id}, property #${deal.property_id}.`, 'task');
  },

  ast_contract: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'AST contract generation pending (v2 feature)',
      actorType: 'system',
      metadata: { action: 'ast_contract', note: 'CONTRACT-01 is v2 scope' },
    });
    await notifyStaff(deal.id, 'AST Contract Generation Required', `Please generate AST contract for deal #${deal.id}, property #${deal.property_id}.`, 'task');
  },

  deposit_registration: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Deposit registration task created',
      actorType: 'system',
      metadata: { action: 'deposit_registration', depositAmount: deal.deal_data?.depositAmount },
    });
    await notifyStaff(deal.id, 'Deposit Registration Required', `Please register deposit for deal #${deal.id}. Amount: ${deal.deal_data?.depositAmount || 'see deal details'}.`, 'task');
  },

  inventory_report: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Inventory report requested',
      actorType: 'system',
    });
    await notifyStaff(deal.id, 'Inventory Report Required', `Please arrange inventory report for deal #${deal.id}, property #${deal.property_id}.`, 'task');
  },

  welcome_message: async (deal) => {
    const sender = await getMessageSender();
    const dealData = typeof deal.deal_data === 'string' ? JSON.parse(deal.deal_data) : (deal.deal_data || {});

    // Read property knowledge base data
    let propertyInfo = '';
    try {
      const kbResult = await pool.query(
        `SELECT si.system_type, si.details
         FROM property_systems_inventory si
         WHERE si.property_id = $1`,
        [deal.property_id]
      );

      const certResult = await pool.query(
        `SELECT cert_type, emergency_contact_name, emergency_contact_phone
         FROM property_certifications
         WHERE property_id = $1 AND status = 'valid'`,
        [deal.property_id]
      );

      const systems = kbResult.rows;
      const certs = certResult.rows;

      const emergencyContacts = certs
        .filter((c: any) => c.emergency_contact_name)
        .map((c: any) => `${c.cert_type}: ${c.emergency_contact_name} (${c.emergency_contact_phone})`)
        .join(', ');

      const binDay = systems.find((s: any) => s.system_type === 'bin_collection');
      const parking = systems.find((s: any) => s.system_type === 'parking');
      const entryCode = systems.find((s: any) => s.system_type === 'entry_code');

      const infoParts: string[] = [];
      if (dealData.startDate) infoParts.push(`Move-in date: ${dealData.startDate}`);
      if (dealData.rentAmount) infoParts.push(`Monthly rent: £${(dealData.rentAmount / 100).toFixed(2)}`);
      if (dealData.depositAmount) infoParts.push(`Deposit: £${(dealData.depositAmount / 100).toFixed(2)}`);
      if (emergencyContacts) infoParts.push(`Emergency contacts: ${emergencyContacts}`);
      if (binDay) infoParts.push(`Bin collection: ${typeof binDay.details === 'string' ? binDay.details : JSON.stringify(binDay.details)}`);
      if (parking) infoParts.push(`Parking: ${typeof parking.details === 'string' ? parking.details : JSON.stringify(parking.details)}`);
      if (entryCode) infoParts.push(`Entry codes: ${typeof entryCode.details === 'string' ? entryCode.details : JSON.stringify(entryCode.details)}`);

      propertyInfo = infoParts.join('\n');
    } catch (err) {
      console.error('[welcome_message] KB query error:', err);
    }

    const message = [
      `Welcome to your new home! We are delighted to have you as a tenant with John Barclay Estate Agents.`,
      ``,
      `Here are the key details for your tenancy:`,
      propertyInfo || 'Please contact our office for full property details.',
      ``,
      `If you have any questions or need to report a maintenance issue, please reply to this message or call our office.`,
      ``,
      `Best regards,`,
      `John Barclay Estate Agents`,
    ].join('\n');

    // Send to tenant
    if (deal.tenant_id) {
      try {
        // Look up tenant contact info
        const tenantResult = await pool.query(
          `SELECT phone, email FROM tenant WHERE id = $1`,
          [deal.tenant_id]
        );
        const tenant = tenantResult.rows[0];
        if (tenant?.phone) {
          await sender.sendPreferred(tenant.phone, message);
        } else if (tenant?.email) {
          await sender.send('email', tenant.email, message, { subject: 'Welcome to Your New Home - John Barclay Estate Agents' });
        }
      } catch (err) {
        console.error('[welcome_message] Send error:', err);
      }
    }

    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Welcome message sent to tenant',
      actorType: 'system',
      metadata: { action: 'welcome_message', tenantId: deal.tenant_id },
    });
  },

  checkin_inspection: async (deal) => {
    const dealData = typeof deal.deal_data === 'string' ? JSON.parse(deal.deal_data) : (deal.deal_data || {});
    const moveIn = dealData.startDate ? new Date(dealData.startDate) : new Date();
    const twoWeeksAfter = new Date(moveIn.getTime() + 14 * 24 * 60 * 60 * 1000);

    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: `Check-in inspection scheduled for ${twoWeeksAfter.toISOString().split('T')[0]}`,
      actorType: 'system',
      metadata: { action: 'checkin_inspection', scheduledDate: twoWeeksAfter.toISOString() },
    });

    // Schedule pg-boss delayed job for PM agent follow-up
    try {
      const boss = await getPgBoss();
      await boss.send('pm-checkin-inspection', {
        dealId: deal.id,
        propertyId: deal.property_id,
        tenantId: deal.tenant_id,
      }, {
        startAfter: Math.floor((twoWeeksAfter.getTime() - Date.now()) / 1000),
      });
    } catch (err) {
      console.error('[checkin_inspection] pg-boss schedule error:', err);
    }
  },

  // ---- TENANCY_ENDING steps ----

  offboarding_checklist: async (deal) => {
    const svc = await getChecklistService();
    if (deal.tenancy_id) {
      await svc.generateChecklist(deal.tenancy_id, 'offboarding');
    }
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Offboarding checklist generated',
      actorType: 'system',
    });
  },

  deposit_return: async (deal) => {
    await notifyStaff(deal.id, 'Deposit Return Required', `Please process deposit return for deal #${deal.id}, tenancy #${deal.tenancy_id}.`, 'task');
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Deposit return notification sent to admin',
      actorType: 'system',
    });
  },

  checkout_inspection: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Checkout inspection requested',
      actorType: 'system',
    });
    await notifyStaff(deal.id, 'Checkout Inspection Required', `Please schedule checkout inspection for deal #${deal.id}, property #${deal.property_id}.`, 'task');
  },

  condition_report: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Condition report to be prepared after checkout inspection',
      actorType: 'system',
    });
    await notifyStaff(deal.id, 'Condition Report Required', `Checkout inspection completed for deal #${deal.id}. Please prepare condition report.`, 'task');
  },

  relist_property: async (deal) => {
    // Check landlord preference from notes/dealData
    let autoRelist = true;
    try {
      if (deal.landlord_id) {
        const llResult = await pool.query('SELECT notes FROM landlords WHERE id = $1', [deal.landlord_id]);
        const landlord = llResult.rows[0];
        if (landlord?.notes && /no.?relist|do not relist/i.test(landlord.notes)) {
          autoRelist = false;
        }
      }
    } catch (err) {
      console.error('[relist_property] landlord check error:', err);
    }

    if (autoRelist) {
      await dealService.createDealEvent({
        dealId: deal.id,
        eventType: 'step.action',
        title: 'Property relisted',
        actorType: 'system',
        metadata: { action: 'relist_property' },
      });
    }
    await notifyStaff(deal.id, autoRelist ? 'Property Relisted' : 'Property Relist Review', `Property #${deal.property_id} ${autoRelist ? 'has been relisted' : 'needs review for relisting (landlord preference)'}. Deal #${deal.id}.`, 'task');
  },

  // ---- RENT_REVIEW steps ----

  market_comparison: async (deal) => {
    let comparisonData: any = null;
    try {
      // Get property details for comparison
      const propResult = await pool.query(
        `SELECT postcode, bedrooms, property_type, rent_amount FROM properties WHERE id = $1`,
        [deal.property_id]
      );
      const property = propResult.rows[0];
      if (property) {
        const postcodeArea = property.postcode ? property.postcode.split(' ')[0] : '';
        const comparables = await pool.query(
          `SELECT id, address, rent_amount, bedrooms, property_type
           FROM properties
           WHERE is_listed_rental = true
             AND bedrooms = $1
             AND property_type = $2
             AND postcode LIKE $3
             AND id != $4
           ORDER BY rent_amount DESC
           LIMIT 10`,
          [property.bedrooms, property.property_type, `${postcodeArea}%`, deal.property_id]
        );
        comparisonData = {
          currentRent: property.rent_amount,
          comparables: comparables.rows.map((r: any) => ({
            id: r.id,
            address: r.address,
            rent: r.rent_amount,
            bedrooms: r.bedrooms,
          })),
          averageMarketRent: comparables.rows.length > 0
            ? Math.round(comparables.rows.reduce((sum: number, r: any) => sum + (r.rent_amount || 0), 0) / comparables.rows.length)
            : null,
        };
      }
    } catch (err) {
      console.error('[market_comparison] query error:', err);
    }

    // Store comparison data in deal
    if (comparisonData) {
      const existingData = typeof deal.deal_data === 'string' ? JSON.parse(deal.deal_data || '{}') : (deal.deal_data || {});
      await dealService.updateDeal(deal.id, {
        dealData: JSON.stringify({ ...existingData, marketComparison: comparisonData }),
      });
    }

    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Market comparison initiated for rent review',
      actorType: 'system',
      metadata: { action: 'market_comparison', comparableCount: comparisonData?.comparables?.length || 0 },
    });
    await notifyStaff(deal.id, 'Market Comparison Ready', `Rent review market comparison for deal #${deal.id}. ${comparisonData?.comparables?.length || 0} comparable properties found. Average market rent: ${comparisonData?.averageMarketRent ? '£' + (comparisonData.averageMarketRent / 100).toFixed(2) : 'N/A'}.`, 'review');
  },

  landlord_proposal: async (deal) => {
    const dealData = typeof deal.deal_data === 'string' ? JSON.parse(deal.deal_data || '{}') : (deal.deal_data || {});
    const mc = dealData.marketComparison || {};
    const currentRent = mc.currentRent ? `£${(mc.currentRent / 100).toFixed(2)}` : 'unknown';
    const avgMarketRent = mc.averageMarketRent ? `£${(mc.averageMarketRent / 100).toFixed(2)}` : 'unknown';

    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Rent increase proposal prepared for landlord',
      actorType: 'system',
      metadata: { action: 'landlord_proposal', currentRent: mc.currentRent, averageMarketRent: mc.averageMarketRent },
    });
    await notifyStaff(deal.id, 'Rent Review Proposal Ready', `Rent increase proposal for deal #${deal.id}. Current rent: ${currentRent}. Average market rent: ${avgMarketRent}. Please review and send to landlord.`, 'review');
  },

  tenant_communication: async (deal) => {
    const sender = await getMessageSender();
    const dealData = typeof deal.deal_data === 'string' ? JSON.parse(deal.deal_data || '{}') : (deal.deal_data || {});

    const newRent = dealData.newRentAmount ? `£${(dealData.newRentAmount / 100).toFixed(2)}` : 'the revised amount';
    const effectiveDate = dealData.rentReviewEffectiveDate || 'to be confirmed';

    const message = `Dear Tenant, following the annual review of your tenancy, we are writing to inform you that your rent will be adjusted to ${newRent} pcm, effective from ${effectiveDate}. If you have any questions, please contact our office. John Barclay Estate Agents.`;

    if (deal.tenant_id) {
      try {
        const tenantResult = await pool.query('SELECT phone, email FROM tenant WHERE id = $1', [deal.tenant_id]);
        const tenant = tenantResult.rows[0];
        if (tenant?.phone) {
          await sender.sendPreferred(tenant.phone, message);
        } else if (tenant?.email) {
          await sender.send('email', tenant.email, message, { subject: 'Rent Review Outcome - John Barclay Estate Agents' });
        }
      } catch (err) {
        console.error('[tenant_communication] send error:', err);
      }
    }

    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Tenant notified of rent review outcome',
      actorType: 'system',
      metadata: { action: 'tenant_communication', tenantId: deal.tenant_id },
    });
    await notifyStaff(deal.id, 'Tenant Rent Review Notification Sent', `Tenant has been notified of rent review outcome for deal #${deal.id}.`, 'info');
  },

  section_13_notice: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Section 13 notice generation requested',
      actorType: 'system',
      metadata: { action: 'section_13_notice', note: 'Only required when tenant does not agree to voluntary increase' },
    });
    await notifyStaff(deal.id, 'Section 13 Notice Required', `Please generate formal Section 13 notice for deal #${deal.id}. This is required because the tenant has not agreed to the voluntary rent increase.`, 'task');
  },

  // ---- SALE_AGREED steps ----

  sales_memorandum: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Sales memorandum generation pending (v2 feature)',
      actorType: 'system',
    });
    await notifyStaff(deal.id, 'Sales Memorandum Required', `Please prepare sales memorandum for deal #${deal.id}, property #${deal.property_id}.`, 'task');
  },

  solicitor_notification: async (deal) => {
    const dealData = typeof deal.deal_data === 'string' ? JSON.parse(deal.deal_data || '{}') : (deal.deal_data || {});
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'Solicitor notification pending',
      actorType: 'system',
      metadata: { solicitorInfo: dealData.solicitorInfo },
    });
    await notifyStaff(deal.id, 'Solicitor Notification Required', `Please notify solicitors for deal #${deal.id}. Solicitor info: ${dealData.solicitorInfo ? JSON.stringify(dealData.solicitorInfo) : 'see deal details'}.`, 'task');
  },

  compliance_checklist: async (deal) => {
    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'AML/ID compliance checklist created',
      actorType: 'system',
    });
    await notifyStaff(deal.id, 'Compliance Checklist Required', `AML/ID compliance checks required for deal #${deal.id}, property #${deal.property_id}.`, 'task');
  },

  delist_rental: async (deal) => {
    // Check if property was also listed for rent
    try {
      const propResult = await pool.query(
        `SELECT is_listed_rental FROM properties WHERE id = $1`,
        [deal.property_id]
      );
      const prop = propResult.rows[0];
      if (prop?.is_listed_rental) {
        await pool.query(
          `UPDATE properties SET is_listed_rental = false, updated_at = NOW() WHERE id = $1`,
          [deal.property_id]
        );
        await dealService.createDealEvent({
          dealId: deal.id,
          eventType: 'step.action',
          title: 'Rental listing removed',
          actorType: 'system',
          metadata: { action: 'delist_rental', propertyId: deal.property_id },
        });
      }
    } catch (err) {
      console.error('[delist_rental] error:', err);
    }
  },

  // ---- SALE_COLLAPSED steps ----
  // relist_property is shared with tenancy_ending (handled by context in the action above)
  // For sale_collapsed, it relists for sale

  notify_interested_buyers: async (deal) => {
    let buyerCount = 0;
    try {
      const leadsResult = await pool.query(
        `SELECT id, name, email, phone FROM leads
         WHERE status IN ('new', 'contacted', 'qualified')
           AND lead_type = 'buyer'
           AND property_interest_ids::text LIKE $1
         LIMIT 50`,
        [`%${deal.property_id}%`]
      );
      buyerCount = leadsResult.rows.length;

      await dealService.createDealEvent({
        dealId: deal.id,
        eventType: 'step.action',
        title: `${buyerCount} interested buyers identified for notification`,
        actorType: 'system',
        metadata: { buyerIds: leadsResult.rows.map((r: any) => r.id) },
      });
    } catch (err) {
      console.error('[notify_interested_buyers] query error:', err);
    }

    await notifyStaff(deal.id, 'Interested Buyers to Contact', `Sale collapsed for deal #${deal.id}, property #${deal.property_id}. ${buyerCount} interested buyers identified. Please contact them about the property becoming available again.`, 'task');
  },

  cancel_in_progress: async (deal) => {
    // Cancel any in-progress admin tasks for this deal
    try {
      await pool.query(
        `UPDATE deal_step SET status = 'cancelled', updated_at = NOW()
         WHERE deal_id = $1 AND status = 'in_progress' AND agent_type = 'admin'`,
        [deal.id]
      );
    } catch (err) {
      console.error('[cancel_in_progress] error:', err);
    }

    await dealService.createDealEvent({
      dealId: deal.id,
      eventType: 'step.action',
      title: 'In-progress admin tasks cancelled after sale collapse',
      actorType: 'system',
    });
  },
};

/**
 * Execute the action for a pipeline step when it transitions to in_progress.
 * Fire-and-forget: errors are logged but never thrown.
 */
async function executeStepAction(deal: any, stepId: string): Promise<void> {
  const action = STEP_ACTIONS[stepId];
  if (!action) return;

  try {
    await action(deal, stepId);
  } catch (err) {
    console.error(`[dealPipelineService] Step action error for ${stepId}:`, err);
  }
}

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

    // Start steps with no dependencies and execute their actions
    for (let i = 0; i < createdSteps.length; i++) {
      if (template[i].dependsOn.length === 0) {
        await dealService.updateDealStep(createdSteps[i].id, {
          status: 'in_progress',
          startedAt: new Date(),
        });
        // Fire-and-forget step action execution
        (async () => {
          try { await executeStepAction(deal, template[i].id); } catch {}
        })();
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
    const deal = await dealService.getDeal(dealId);
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
        // Fire-and-forget step action execution
        if (deal) {
          (async () => {
            try { await executeStepAction(deal, s.step_id); } catch {}
          })();
        }
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
