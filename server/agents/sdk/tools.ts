/**
 * SDK Tool Wrappers
 *
 * Wraps existing Phase 1 ToolRegistry tools as OpenAI Agents SDK tools,
 * plus the escalate_to_human tool.
 *
 * Note: SDK tool() requires zod v4 for parameter schemas (imported as 'zod4').
 * The toolRegistry internally uses zod v3 for validation -- no conflict since
 * the registry re-parses input with its own schemas.
 */

import { tool } from '@openai/agents';
// @ts-ignore -- zod4 is an npm alias for zod@4, required by @openai/agents SDK
import { z as z4 } from 'zod4';
import { toolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';
import type { AgentContext } from './context';
import { auditLogger } from '../middleware/auditLogger';

// Lazy import to avoid circular dependency at module load
let _escalationService: any = null;
async function getEscalationService() {
  if (!_escalationService) {
    const mod = await import('../services/escalationService');
    _escalationService = mod.escalationService;
  }
  return _escalationService;
}

/**
 * Helper: wrap a Phase 1 ToolRegistry tool as an SDK tool.
 * The SDK tool delegates execution to toolRegistry.invoke().
 */
function wrapRegistryTool(
  name: string,
  description: string,
  parameters: any,
) {
  return tool({
    name,
    description,
    parameters,
    execute: async (context: AgentContext, input: unknown) => {
      const toolContext: ToolContext = {
        agentType: context.agentType,
        conversationId: context.conversationId,
        contactId: context.contactId,
        channel: context.channel,
      };

      const result = await toolRegistry.invoke(name, input, toolContext);
      return JSON.stringify(result.output);
    },
  });
}

// ---- Wrapped Phase 1 tools ----

export const searchPropertiesTool = wrapRegistryTool(
  'search_properties',
  'Search available properties by area, type, bedrooms, and price. Returns matching property listings.',
  z4.object({
    area: z4.string().optional(),
    postcode: z4.string().optional(),
    type: z4.enum(['rental', 'sale', 'any']),
    minBedrooms: z4.number().optional(),
    maxPrice: z4.number().optional(),
    limit: z4.number().optional().default(5),
  }),
);

export const queryKnowledgeBaseTool = wrapRegistryTool(
  'query_knowledge_base',
  'Search the property knowledge base for information about properties, policies, and procedures.',
  z4.object({
    query: z4.string(),
    category: z4.enum([
      'property_details',
      'policies',
      'procedures',
      'pricing',
      'area_info',
      'general',
    ]).optional(),
    limit: z4.number().optional().default(3),
  }),
);

export const createLeadTool = wrapRegistryTool(
  'create_lead',
  'Create a new lead record in the CRM when a potential customer expresses interest.',
  z4.object({
    name: z4.string(),
    email: z4.string().optional(),
    phone: z4.string().optional(),
    source: z4.enum(['website', 'portal', 'referral', 'walk_in', 'phone', 'social', 'voice_agent']).optional(),
    leadType: z4.enum(['buyer', 'seller', 'tenant', 'landlord']),
    notes: z4.string().optional(),
    budgetMin: z4.number().optional(),
    budgetMax: z4.number().optional(),
  }),
);

export const createMaintenanceTicketTool = wrapRegistryTool(
  'create_maintenance_ticket',
  'Create a maintenance request ticket for a property issue.',
  z4.object({
    propertyId: z4.number(),
    title: z4.string(),
    description: z4.string(),
    urgency: z4.enum(['urgent', 'high', 'medium', 'low']).optional(),
    category: z4.string().optional(),
    reportedBy: z4.string().optional(),
    contactPhone: z4.string().optional(),
  }),
);

export const lookupTenantPropertyTool = wrapRegistryTool(
  'lookup_tenant_property',
  'Look up a tenant by phone number or email address. Returns tenant details with their property and landlord information.',
  z4.object({
    contactPhone: z4.string().optional(),
    contactEmail: z4.string().optional(),
  }),
);

export const bookViewingTool = wrapRegistryTool(
  'book_viewing',
  'Book a property viewing appointment for a prospective buyer or tenant.',
  z4.object({
    propertyId: z4.number(),
    contactName: z4.string(),
    contactPhone: z4.string().optional(),
    contactEmail: z4.string().optional(),
    preferredDate: z4.string(),
    preferredTime: z4.string().optional(),
    notes: z4.string().optional(),
  }),
);

// ---- Contractor dispatch tools ----

export const searchContractorsSdkTool = wrapRegistryTool(
  'search_contractors',
  'Search for contractors by specialization, service area, and emergency capability. Returns a ranked list (preferred first, then by rating).',
  z4.object({
    category: z4.string(),
    postcode: z4.string().optional(),
    emergency: z4.boolean().optional(),
  }),
);

export const requestContractorQuoteSdkTool = wrapRegistryTool(
  'request_contractor_quote',
  'Request a quote from a contractor for a maintenance job. Creates a quote record and contacts the contractor via their preferred channel.',
  z4.object({
    ticketId: z4.number(),
    contractorId: z4.number(),
    jobDescription: z4.string(),
    propertyAddress: z4.string(),
    urgencyLevel: z4.string().optional(),
  }),
);

export const requestLandlordApprovalSdkTool = wrapRegistryTool(
  'request_landlord_approval',
  'Request landlord approval for maintenance work. For emergency work, auto-approves and notifies landlord. For non-emergency, sends approval request.',
  z4.object({
    ticketId: z4.number(),
    landlordId: z4.number(),
    quoteAmount: z4.number(),
    contractorName: z4.string(),
    faultDescription: z4.string(),
    isEmergency: z4.boolean(),
  }),
);

export const createWorkOrderSdkTool = wrapRegistryTool(
  'create_work_order',
  'Create a work order for approved maintenance work. Generates a WO number, updates the ticket, and notifies the contractor.',
  z4.object({
    ticketId: z4.number(),
    contractorId: z4.number(),
    scope: z4.string(),
    scheduledStart: z4.string(),
    scheduledEnd: z4.string().optional(),
    quotedAmount: z4.number().optional(),
    accessInstructions: z4.string().optional(),
    keyLocation: z4.string().optional(),
    tenantPresenceRequired: z4.boolean().optional(),
  }),
);

// ---- Work order follow-up tool ----

export const scheduleWorkOrderFollowupSdkTool = wrapRegistryTool(
  'schedule_work_order_followup',
  'Schedule automated follow-up checks for a work order. Queues contractor progress checks, tenant satisfaction checks, and completion verification at urgency-based intervals.',
  z4.object({
    workOrderId: z4.number(),
    urgency: z4.string(),
  }),
);

// ---- Checklist tools ----

// Lazy import to avoid circular dependency at module load
let _checklistService: any = null;
async function getChecklistService() {
  if (!_checklistService) {
    const mod = await import('../services/checklistService');
    _checklistService = mod.checklistService;
  }
  return _checklistService;
}

export const generateChecklistTool = tool({
  name: 'generate_checklist',
  description: 'Generate a tenancy checklist (onboarding or offboarding). Creates checklist items from the standard template for the given tenancy.',
  parameters: z4.object({
    tenancyId: z4.number().describe('The tenancy ID to generate a checklist for'),
    workflow: z4.enum(['onboarding', 'offboarding']).describe('Whether to generate onboarding or offboarding checklist'),
  }),
  execute: async (_context: AgentContext, input: { tenancyId: number; workflow: 'onboarding' | 'offboarding' }) => {
    const svc = await getChecklistService();
    const result = await svc.generateChecklist(input.tenancyId, input.workflow);
    return JSON.stringify(result);
  },
});

export const chaseChecklistItemTool = tool({
  name: 'chase_checklist_item',
  description: 'Chase a contact for an outstanding checklist item. Sends a reminder via the specified channel. Automatically escalates to staff after 3 unsuccessful chases.',
  parameters: z4.object({
    itemId: z4.number().describe('The checklist item ID to chase'),
    channel: z4.enum(['whatsapp', 'sms', 'email']).describe('Communication channel to use'),
    contactValue: z4.string().describe('Phone number or email address of the contact'),
    tenancyId: z4.number().describe('The tenancy ID this item belongs to'),
  }),
  execute: async (_context: AgentContext, input: { itemId: number; channel: 'whatsapp' | 'sms' | 'email'; contactValue: string; tenancyId: number }) => {
    const svc = await getChecklistService();
    const result = await svc.chaseItem(input.itemId, input.channel, input.contactValue, input.tenancyId);
    return JSON.stringify(result);
  },
});

// ---- Escalation tool ----

export const escalateToHumanTool = tool({
  name: 'escalate_to_human',
  description: 'Escalate the conversation to a human staff member. Use when: confidence is low, contact asks for a human, complaint detected, legal/financial question outside domain, 3+ unresolved exchanges, or negative sentiment.',
  parameters: z4.object({
    reason: z4.string().describe('Why this conversation needs human attention'),
    urgency: z4.enum(['normal', 'high', 'urgent']).describe('How urgently a human is needed'),
  }),
  execute: async (context: AgentContext, input: { reason: string; urgency: 'normal' | 'high' | 'urgent' }) => {
    const escService = await getEscalationService();

    const result = await escService.escalate({
      conversationId: context.conversationId,
      reason: input.reason,
      urgency: input.urgency,
      channel: context.channel,
    });

    await auditLogger.logEscalation({
      agentType: context.agentType,
      reasoning: input.reason,
      conversationId: context.conversationId,
      channel: context.channel,
    });

    if (result.assignedTo) {
      return `Escalated to a staff member (ID: ${result.assignedTo}). A member of our team will be in touch shortly.`;
    }
    return 'Escalation recorded. Our team will be in touch with you shortly.';
  },
});

// ---- Record offer tool ----

export const recordOfferTool = tool({
  name: 'record_offer',
  description: 'Record a property offer from a buyer or tenant. Captures full offer details and notifies the assigned negotiator.',
  parameters: z4.object({
    propertyId: z4.number().describe('Property ID the offer is for'),
    offerAmount: z4.number().describe('Offer amount in pence'),
    buyerName: z4.string().describe('Name of the buyer or tenant'),
    buyerEmail: z4.string().describe('Email of the buyer or tenant'),
    buyerPhone: z4.string().describe('Phone number of the buyer or tenant'),
    buyerPosition: z4.enum(['cash', 'mortgage_approved', 'mortgage_required', 'chain']).optional().describe('Buyer position'),
    isInChain: z4.boolean().optional().describe('Whether the buyer is in a chain'),
    chainDetails: z4.string().optional().describe('Details of the chain if applicable'),
    conditions: z4.array(z4.string()).optional().describe('Conditions on the offer'),
    proposedCompletionDate: z4.string().optional().describe('Proposed completion date (ISO string)'),
    employmentStatus: z4.string().optional().describe('Tenant employment status (lettings)'),
    rentalReferences: z4.string().optional().describe('Rental references info (lettings)'),
    moveInTimeline: z4.string().optional().describe('Proposed move-in timeline (lettings)'),
  }),
  execute: async (_context: AgentContext, input: {
    propertyId: number;
    offerAmount: number;
    buyerName: string;
    buyerEmail: string;
    buyerPhone: string;
    buyerPosition?: string;
    isInChain?: boolean;
    chainDetails?: string;
    conditions?: string[];
    proposedCompletionDate?: string;
    employmentStatus?: string;
    rentalReferences?: string;
    moveInTimeline?: string;
  }) => {
    const { pool } = await import('../../db');

    // INSERT into property_offer table
    const insertResult = await pool.query(
      `INSERT INTO property_offer (
        property_id, offer_amount, buyer_name, buyer_email, buyer_phone,
        buyer_position, is_in_chain, chain_details, conditions,
        proposed_completion_date, status, offer_source,
        employment_status, rental_references, move_in_timeline,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', 'agent', $11, $12, $13, NOW(), NOW())
      RETURNING id`,
      [
        input.propertyId,
        input.offerAmount,
        input.buyerName,
        input.buyerEmail,
        input.buyerPhone,
        input.buyerPosition || null,
        input.isInChain || false,
        input.chainDetails || null,
        input.conditions || null,
        input.proposedCompletionDate ? new Date(input.proposedCompletionDate) : null,
        input.employmentStatus || null,
        input.rentalReferences || null,
        input.moveInTimeline || null,
      ],
    );

    // Look up assigned agent and property address
    const propResult = await pool.query(
      `SELECT agent_id, address FROM properties WHERE id = $1`,
      [input.propertyId],
    );

    const property = propResult.rows[0];
    const propertyAddress = property?.address || `Property #${input.propertyId}`;
    let notifyUserId = property?.agent_id;

    // Fall back to first admin user if no agent assigned
    if (!notifyUserId) {
      const adminResult = await pool.query(
        `SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`,
      );
      notifyUserId = adminResult.rows[0]?.id || 1;
    }

    // INSERT notification
    const amountFormatted = `£${(input.offerAmount / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`;
    await pool.query(
      `INSERT INTO notification (user_id, title, type, link_url, is_read, created_at)
       VALUES ($1, $2, 'info', '/crm/offers', false, NOW())`,
      [notifyUserId, `New offer: ${amountFormatted} on ${propertyAddress}`],
    );

    return `Offer of ${amountFormatted} recorded for ${propertyAddress}. The assigned negotiator has been notified.`;
  },
});

// ---- Payment link service (lazy import) ----

let _paymentLinkService: any = null;
async function getPaymentLinkService() {
  if (!_paymentLinkService) {
    const mod = await import('../services/paymentLinkService');
    _paymentLinkService = mod.paymentLinkService;
  }
  return _paymentLinkService;
}

let _scheduledMessageService: any = null;
async function getScheduledMessageService() {
  if (!_scheduledMessageService) {
    const mod = await import('../services/scheduledMessages');
    _scheduledMessageService = mod.scheduledMessageService;
  }
  return _scheduledMessageService;
}

// ---- Arrears tools ----

// Lazy imports to avoid circular dependencies at module load
let _arrearsComplianceGuard: any = null;
async function getArrearsComplianceGuard() {
  if (!_arrearsComplianceGuard) {
    const mod = await import('../services/arrearsComplianceGuard');
    _arrearsComplianceGuard = mod.arrearsComplianceGuard;
  }
  return _arrearsComplianceGuard;
}

let _messageSender: any = null;
async function getMessageSender() {
  if (!_messageSender) {
    const mod = await import('../services/messageSender');
    _messageSender = mod.messageSender;
  }
  return _messageSender;
}

export const lookupArrearsCaseTool = tool({
  name: 'lookup_arrears_case',
  description: 'Look up arrears case details for a tenant including amount owed, days overdue, and contact history',
  parameters: z4.object({
    tenantId: z4.number(),
  }),
  execute: async (_context: AgentContext, input: { tenantId: number }) => {
    const { db: database } = await import('../../db');
    const { arrears, dunningActions, tenant, properties } = await import('@shared/schema');
    const { eq, and, desc } = await import('drizzle-orm');

    // Get active arrears for tenant
    const arrearsRows = await database
      .select()
      .from(arrears)
      .where(
        and(
          eq(arrears.tenantId, input.tenantId),
          eq(arrears.status, 'active'),
        ),
      );

    if (arrearsRows.length === 0) {
      return JSON.stringify({ found: false, message: 'No active arrears case found for this tenant' });
    }

    const arrearsCase = arrearsRows[0];

    // Get tenant details
    const tenantRows = await database
      .select()
      .from(tenant)
      .where(eq(tenant.id, input.tenantId))
      .limit(1);

    // Get property details
    let propertyInfo = null;
    if (arrearsCase.propertyId) {
      const propRows = await database
        .select()
        .from(properties)
        .where(eq(properties.id, arrearsCase.propertyId))
        .limit(1);
      if (propRows.length > 0) {
        propertyInfo = { id: propRows[0].id, address: propRows[0].address };
      }
    }

    // Get last 5 dunning actions
    const recentActions = await database
      .select()
      .from(dunningActions)
      .where(eq(dunningActions.arrearsId, arrearsCase.id))
      .orderBy(desc(dunningActions.createdAt))
      .limit(5);

    return JSON.stringify({
      found: true,
      arrears: {
        id: arrearsCase.id,
        amount: arrearsCase.amount,
        amountFormatted: `£${(arrearsCase.amount / 100).toFixed(2)}`,
        daysOverdue: arrearsCase.daysOverdue,
        dunningLevel: arrearsCase.dunningLevel,
        status: arrearsCase.status,
        lastReminderSent: arrearsCase.lastReminderSent,
      },
      tenant: tenantRows.length > 0 ? { id: tenantRows[0].id, name: tenantRows[0].name } : null,
      property: propertyInfo,
      recentContacts: recentActions.map((a: any) => ({
        type: a.actionType,
        channel: a.channel,
        status: a.status,
        sentAt: a.sentAt,
      })),
    });
  },
});

export const sendPaymentReminderTool = tool({
  name: 'send_payment_reminder',
  description: 'Send a payment reminder to a tenant in arrears. Compliance rules are enforced automatically.',
  parameters: z4.object({
    arrearsId: z4.number(),
    channel: z4.enum(['sms', 'whatsapp', 'email']),
    message: z4.string(),
  }),
  execute: async (_context: AgentContext, input: { arrearsId: number; channel: 'sms' | 'whatsapp' | 'email'; message: string }) => {
    const { db: database } = await import('../../db');
    const { arrears, contactIdentities } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    const complianceGuard = await getArrearsComplianceGuard();
    const sender = await getMessageSender();

    // Look up the arrears case
    const arrearsRows = await database
      .select()
      .from(arrears)
      .where(eq(arrears.id, input.arrearsId))
      .limit(1);

    if (arrearsRows.length === 0) {
      return JSON.stringify({ sent: false, reason: 'Arrears case not found' });
    }

    const arrearsCase = arrearsRows[0];

    // Check compliance
    const check = await complianceGuard.canContact(arrearsCase.tenantId, input.channel);

    if (!check.allowed) {
      // Log the blocked attempt
      await complianceGuard.logContactAttempt(
        input.arrearsId,
        input.channel,
        input.channel,
        'blocked',
        `Blocked: ${check.reason}`,
      );

      return JSON.stringify({
        sent: false,
        reason: check.reason,
        nextAllowedAt: check.nextAllowedAt,
      });
    }

    // Look up contact info
    const contacts = await database
      .select()
      .from(contactIdentities)
      .where(
        and(
          eq(contactIdentities.contactId, arrearsCase.tenantId),
          eq(contactIdentities.contactType, 'tenant'),
        ),
      )
      .limit(5);

    const phoneContact = contacts.find((c: any) =>
      c.identifierType === 'phone' && c.isPrimary,
    ) || contacts.find((c: any) => c.identifierType === 'phone');

    const emailContact = contacts.find((c: any) =>
      c.identifierType === 'email' && c.isPrimary,
    ) || contacts.find((c: any) => c.identifierType === 'email');

    let sent = false;
    if (input.channel === 'email' && emailContact) {
      sent = await sender.send('email', emailContact.identifierValue, input.message, {
        subject: 'Outstanding Rent Balance - John Barclay Estate Agents',
      });
    } else if (phoneContact) {
      sent = await sender.send(input.channel, phoneContact.identifierValue, input.message);
    }

    // Log the attempt
    await complianceGuard.logContactAttempt(
      input.arrearsId,
      input.channel,
      input.channel,
      sent ? 'sent' : 'failed',
      sent ? 'Reminder sent successfully' : 'Failed to deliver message',
    );

    await auditLogger.logToolCall({
      agentType: 'arrears',
      toolName: 'send_payment_reminder',
      toolInput: { arrearsId: input.arrearsId, channel: input.channel },
      toolOutput: { sent },
      durationMs: 0,
    }).catch(() => {});

    return JSON.stringify({ sent, channel: input.channel });
  },
});

export const escalateArrearsCaseTool = tool({
  name: 'escalate_arrears_case',
  description: 'Escalate an arrears case to a human case manager. Use when: vulnerability detected, contact limit reached, or tenant situation requires human judgment.',
  parameters: z4.object({
    arrearsId: z4.number(),
    reason: z4.string(),
  }),
  execute: async (context: AgentContext, input: { arrearsId: number; reason: string }) => {
    const { db: database } = await import('../../db');
    const { arrears } = await import('@shared/schema');
    const { eq, sql } = await import('drizzle-orm');
    const escService = await getEscalationService();

    // Escalate
    const result = await escService.escalate({
      conversationId: context.conversationId,
      reason: `Arrears case #${input.arrearsId}: ${input.reason}`,
      urgency: 'urgent',
      channel: context.channel,
    });

    // Update dunning level (cap at 5)
    await database
      .update(arrears)
      .set({
        dunningLevel: sql`LEAST(${arrears.dunningLevel} + 1, 5)`,
        updatedAt: new Date(),
      })
      .where(eq(arrears.id, input.arrearsId));

    // Audit log
    await auditLogger.logEscalation({
      agentType: 'arrears',
      reasoning: `Arrears escalation: ${input.reason}`,
      conversationId: context.conversationId,
      channel: context.channel,
    });

    if (result.assignedTo) {
      return `Case escalated to a human case manager (staff ID: ${result.assignedTo}). They will review the situation and contact the tenant directly.`;
    }
    return 'Escalation recorded. A case manager will review this shortly.';
  },
});

// ---- Payment commitment & link tools ----

export const capturePaymentCommitmentTool = tool({
  name: 'capture_payment_commitment',
  description: 'Record a payment commitment made by a tenant. Schedules an automated follow-up to verify payment on the committed date.',
  parameters: z4.object({
    arrearsId: z4.number(),
    commitDate: z4.string().describe('ISO date string when tenant commits to pay'),
    commitAmount: z4.number().describe('Amount in pence the tenant commits to pay'),
    notes: z4.string().optional().describe('Any notes about the commitment'),
  }),
  execute: async (_context: AgentContext, input: { arrearsId: number; commitDate: string; commitAmount: number; notes?: string }) => {
    const { db: database } = await import('../../db');
    const { arrears, dunningActions, contactIdentities } = await import('@shared/schema');
    const { eq, and, sql } = await import('drizzle-orm');

    // Look up arrears case
    const arrearsRows = await database
      .select()
      .from(arrears)
      .where(eq(arrears.id, input.arrearsId))
      .limit(1);

    if (arrearsRows.length === 0) {
      return JSON.stringify({ captured: false, reason: 'Arrears case not found' });
    }

    const arrearsCase = arrearsRows[0];
    const commitDetails = `COMMITMENT: ${new Date().toISOString()} - Amount: ${input.commitAmount}p, Due: ${input.commitDate}${input.notes ? `, Notes: ${input.notes}` : ''}`;

    // Update arrears notes with commitment
    await database
      .update(arrears)
      .set({
        notes: arrearsCase.notes ? `${arrearsCase.notes}\n${commitDetails}` : commitDetails,
        updatedAt: new Date(),
      })
      .where(eq(arrears.id, input.arrearsId));

    // Log to dunning_actions
    await database.insert(dunningActions).values({
      arrearsId: input.arrearsId,
      actionType: 'payment_commitment',
      status: 'sent',
      notes: commitDetails,
      sentAt: new Date(),
    });

    // Audit log
    await auditLogger.logToolCall({
      agentType: 'arrears',
      toolName: 'capture_payment_commitment',
      toolInput: { arrearsId: input.arrearsId, commitDate: input.commitDate, commitAmount: input.commitAmount },
      toolOutput: { captured: true },
      durationMs: 0,
    }).catch(() => {});

    // Schedule pg-boss follow-up for the commitment date
    try {
      // Look up tenant contact for follow-up
      const contacts = await database
        .select()
        .from(contactIdentities)
        .where(
          and(
            eq(contactIdentities.contactId, arrearsCase.tenantId),
            eq(contactIdentities.contactType, 'tenant'),
          ),
        )
        .limit(5);

      const phoneContact = contacts.find((c: any) =>
        c.identifierType === 'phone' && c.isPrimary,
      ) || contacts.find((c: any) => c.identifierType === 'phone');

      const sms = await getScheduledMessageService();
      await sms.schedulePaymentFollowUp({
        arrearsId: input.arrearsId,
        tenantId: arrearsCase.tenantId,
        contactPhone: phoneContact?.identifierValue || '',
        channel: 'sms',
        commitAmount: input.commitAmount,
        commitDate: input.commitDate,
        attemptNumber: 1,
      }, new Date(input.commitDate));
    } catch (err) {
      console.error('[capturePaymentCommitment] Failed to schedule follow-up:', err);
    }

    return JSON.stringify({ captured: true, followUpScheduledFor: input.commitDate });
  },
});

export const generatePaymentLinkTool = tool({
  name: 'generate_payment_link',
  description: 'Generate a payment link (Stripe or GoCardless) for an arrears balance and send it to the tenant via their preferred channel.',
  parameters: z4.object({
    arrearsId: z4.number(),
    amount: z4.number().describe('Amount in pence'),
    channel: z4.enum(['sms', 'whatsapp', 'email']).describe('Channel to send the link'),
  }),
  execute: async (_context: AgentContext, input: { arrearsId: number; amount: number; channel: 'sms' | 'whatsapp' | 'email' }) => {
    const { db: database } = await import('../../db');
    const { arrears, dunningActions, contactIdentities } = await import('@shared/schema');
    const { eq, and } = await import('drizzle-orm');

    // Look up arrears to get tenantId
    const arrearsRows = await database
      .select()
      .from(arrears)
      .where(eq(arrears.id, input.arrearsId))
      .limit(1);

    if (arrearsRows.length === 0) {
      return JSON.stringify({ sent: false, reason: 'Arrears case not found' });
    }

    const arrearsCase = arrearsRows[0];
    const plService = await getPaymentLinkService();

    // Generate link (auto-detects Stripe vs GoCardless)
    const linkResult = await plService.generateLink(arrearsCase.tenantId, input.arrearsId, input.amount);

    // Look up contact info
    const contacts = await database
      .select()
      .from(contactIdentities)
      .where(
        and(
          eq(contactIdentities.contactId, arrearsCase.tenantId),
          eq(contactIdentities.contactType, 'tenant'),
        ),
      )
      .limit(5);

    const phoneContact = contacts.find((c: any) =>
      c.identifierType === 'phone' && c.isPrimary,
    ) || contacts.find((c: any) => c.identifierType === 'phone');

    const emailContact = contacts.find((c: any) =>
      c.identifierType === 'email' && c.isPrimary,
    ) || contacts.find((c: any) => c.identifierType === 'email');

    // Send message
    const sender = await getMessageSender();
    let sent = false;
    const amountFormatted = `£${(input.amount / 100).toFixed(2)}`;

    if (linkResult.method === 'gocardless') {
      // GoCardless: direct debit collection initiated
      const msg = `A direct debit collection of ${amountFormatted} has been initiated for your outstanding rent balance. This will be collected from your bank account on the next available date.`;
      if (input.channel === 'email' && emailContact) {
        sent = await sender.send('email', emailContact.identifierValue, msg, {
          subject: 'Direct Debit Collection - John Barclay Estate Agents',
        });
      } else if (phoneContact) {
        sent = await sender.send(input.channel, phoneContact.identifierValue, msg);
      }
    } else if (linkResult.url) {
      // Stripe: payment link
      const msg = `You can make a payment of ${amountFormatted} for your outstanding rent balance using this secure link: ${linkResult.url}`;
      if (input.channel === 'email' && emailContact) {
        sent = await sender.send('email', emailContact.identifierValue, msg, {
          subject: 'Payment Link - John Barclay Estate Agents',
        });
      } else if (phoneContact) {
        sent = await sender.send(input.channel, phoneContact.identifierValue, msg);
      }
    }

    // Log to dunning_actions
    await database.insert(dunningActions).values({
      arrearsId: input.arrearsId,
      actionType: 'payment_link',
      channel: input.channel,
      status: sent ? 'sent' : 'pending',
      notes: linkResult.url ? `Link: ${linkResult.url}` : `GoCardless payment: ${linkResult.paymentRef}`,
      sentAt: sent ? new Date() : null,
    });

    // Audit log
    await auditLogger.logToolCall({
      agentType: 'arrears',
      toolName: 'generate_payment_link',
      toolInput: { arrearsId: input.arrearsId, amount: input.amount, channel: input.channel },
      toolOutput: { method: linkResult.method, url: linkResult.url, sent },
      durationMs: 0,
    }).catch(() => {});

    return JSON.stringify({
      method: linkResult.method,
      url: linkResult.url,
      paymentRef: linkResult.paymentRef,
      sent,
    });
  },
});

// ---- Deal lifecycle tools ----

// Lazy imports for deal services
let _dealEventBus: any = null;
let _DEAL_EVENTS: any = null;
async function getDealEventBus() {
  if (!_dealEventBus) {
    const mod = await import('../services/dealEventBus');
    _dealEventBus = mod.dealEventBus;
    _DEAL_EVENTS = mod.DEAL_EVENTS;
  }
  return { dealEventBus: _dealEventBus, DEAL_EVENTS: _DEAL_EVENTS };
}

let _dealService: any = null;
async function getDealService() {
  if (!_dealService) {
    const mod = await import('../services/dealService');
    _dealService = mod.dealService;
  }
  return _dealService;
}

let _conversationStore: any = null;
async function getConversationStore() {
  if (!_conversationStore) {
    const mod = await import('../channels/conversationStore');
    _conversationStore = mod.conversationStore;
  }
  return _conversationStore;
}

/**
 * emitDealEventTool: Allows agents to emit domain events during conversations.
 */
export const emitDealEventTool = tool({
  name: 'emit_deal_event',
  description: 'Emit a deal lifecycle event. Use when you detect a deal-relevant change during a conversation (e.g., rent agreed with tenant, sale progressing).',
  parameters: z4.object({
    eventType: z4.string().describe('Event type (e.g., tenancy.agreed, sale.agreed, step.completed)'),
    dealId: z4.number().describe('The deal ID'),
    metadata: z4.record(z4.string(), z4.any()).optional().describe('Additional event metadata'),
  }),
  execute: async (_context: AgentContext, input: { eventType: string; dealId: number; metadata?: Record<string, any> }) => {
    const { dealEventBus } = await getDealEventBus();
    const dealSvc = await getDealService();

    const deal = await dealSvc.getDeal(input.dealId);
    if (!deal) {
      return JSON.stringify({ emitted: false, reason: 'Deal not found' });
    }

    await dealEventBus.emit(input.eventType, {
      dealId: input.dealId,
      propertyId: deal.property_id,
      dealType: deal.deal_type,
      ...input.metadata,
    });

    return JSON.stringify({ emitted: true, eventType: input.eventType, dealId: input.dealId });
  },
});

/**
 * readDealStatusTool: Allows agents to check deal progress.
 */
export const readDealStatusTool = tool({
  name: 'read_deal_status',
  description: 'Check the current status and progress of a deal, including all step statuses. Use to understand what other agents have done before acting.',
  parameters: z4.object({
    dealId: z4.number().optional().describe('Specific deal ID to look up'),
    propertyId: z4.number().optional().describe('Find deals for a property'),
  }),
  execute: async (_context: AgentContext, input: { dealId?: number; propertyId?: number }) => {
    const dealSvc = await getDealService();

    if (input.dealId) {
      const deal = await dealSvc.getDeal(input.dealId);
      if (!deal) return JSON.stringify({ found: false, reason: 'Deal not found' });

      const steps = await dealSvc.getDealSteps(input.dealId);
      return JSON.stringify({
        found: true,
        deal: {
          id: deal.id,
          dealType: deal.deal_type,
          status: deal.status,
          propertyId: deal.property_id,
          totalSteps: deal.total_steps,
          completedSteps: deal.completed_steps,
          failedSteps: deal.failed_steps,
        },
        steps: steps.map((s: any) => ({
          stepId: s.step_id,
          stepName: s.step_name,
          status: s.status,
          agentType: s.agent_type,
          isSkipped: s.is_skipped,
        })),
      });
    }

    if (input.propertyId) {
      const deals = await dealSvc.listDeals({ propertyId: input.propertyId });
      return JSON.stringify({
        found: deals.length > 0,
        deals: deals.map((d: any) => ({
          id: d.id,
          dealType: d.deal_type,
          status: d.status,
          createdAt: d.created_at,
        })),
      });
    }

    return JSON.stringify({ found: false, reason: 'Provide dealId or propertyId' });
  },
});

/**
 * queryContactConversationsTool: Cross-agent conversation access.
 */
export const queryContactConversationsTool = tool({
  name: 'query_contact_conversations',
  description: 'Query full conversation history for a contact across all agent types. Use to understand previous interactions before acting.',
  parameters: z4.object({
    contactId: z4.number().describe('Contact identity ID'),
    agentType: z4.string().optional().describe('Filter by agent type (e.g., lettings, sales, pm)'),
    limit: z4.number().optional().default(10).describe('Max conversations to return'),
  }),
  execute: async (_context: AgentContext, input: { contactId: number; agentType?: string; limit?: number }) => {
    const store = await getConversationStore();

    const convos = await store.getConversationsForContact(input.contactId, {
      agentType: input.agentType,
      limit: input.limit || 10,
    });

    // Get last message for each conversation
    const results = [];
    for (const convo of convos) {
      const history = await store.getConversationHistory(convo.id, 1);
      results.push({
        conversationId: convo.id,
        status: convo.status,
        lastChannel: convo.lastChannel,
        lastMessageAt: convo.lastMessageAt,
        lastMessagePreview: convo.lastMessagePreview,
        lastMessage: history.length > 0 ? {
          content: history[0].content?.slice(0, 200),
          direction: history[0].direction,
          agentType: history[0].agentType,
          sentAt: history[0].sentAt,
        } : null,
      });
    }

    return JSON.stringify({
      contactId: input.contactId,
      conversationCount: results.length,
      conversations: results,
    });
  },
});

/**
 * flagInconsistencyTool: Inconsistency detection across deal data.
 */
export const flagInconsistencyTool = tool({
  name: 'flag_inconsistency',
  description: 'Flag a data inconsistency found in deal information. Use when you detect conflicting values for critical fields (rent amount, deposit, pet policy, number of occupants).',
  parameters: z4.object({
    dealId: z4.number().describe('The deal ID where inconsistency was found'),
    field: z4.string().describe('The field name with conflicting values'),
    existingValue: z4.string().describe('The currently recorded value'),
    newValue: z4.string().describe('The new conflicting value'),
    source: z4.string().describe('Where the new value came from'),
  }),
  execute: async (_context: AgentContext, input: { dealId: number; field: string; existingValue: string; newValue: string; source: string }) => {
    const dealSvc = await getDealService();

    // Create notification for staff
    await dealSvc.createNotification({
      userId: 1,
      dealId: input.dealId,
      title: `Data Inconsistency: ${input.field}`,
      body: `Conflicting values detected for "${input.field}" on deal #${input.dealId}. Existing: "${input.existingValue}", New: "${input.newValue}" (source: ${input.source}). Please review and resolve.`,
      type: 'inconsistency',
    });

    // Create deal event
    await dealSvc.createDealEvent({
      dealId: input.dealId,
      eventType: 'inconsistency.detected',
      title: `Inconsistency flagged: ${input.field}`,
      actorType: 'agent',
      metadata: {
        field: input.field,
        existingValue: input.existingValue,
        newValue: input.newValue,
        source: input.source,
      },
    });

    return JSON.stringify({
      flagged: true,
      field: input.field,
      message: 'Inconsistency flagged and notification sent to staff for review.',
    });
  },
});

/**
 * emitCrossReferralTool: Cross-referral between departments.
 */
export const emitCrossReferralTool = tool({
  name: 'emit_cross_referral',
  description: 'Create a cross-referral lead from one department to another. Use when a contact in your department also needs services from another department (e.g., a lettings tenant interested in buying).',
  parameters: z4.object({
    fromDepartment: z4.string().describe('Your department (e.g., lettings, sales, pm)'),
    toDepartment: z4.string().describe('Target department for the referral'),
    contactId: z4.number().describe('Contact ID being referred'),
    reason: z4.string().describe('Why this referral is being made'),
    propertyId: z4.number().optional().describe('Related property ID if applicable'),
  }),
  execute: async (_context: AgentContext, input: { fromDepartment: string; toDepartment: string; contactId: number; reason: string; propertyId?: number }) => {
    const { dealEventBus, DEAL_EVENTS } = await getDealEventBus();
    const dealSvc = await getDealService();

    // Map department to lead type
    const deptToLeadType: Record<string, string> = {
      sales: 'buyer',
      lettings: 'tenant',
      pm: 'landlord',
    };

    // Create a lead in the target department
    const { pool: dbPool } = await import('../../db');
    const leadType = deptToLeadType[input.toDepartment] || 'buyer';

    let leadId = null;
    try {
      // Look up contact info
      const contactResult = await dbPool.query(
        `SELECT ci.identifier_value, ci.identifier_type, ci.contact_type
         FROM contact_identity ci WHERE ci.id = $1`,
        [input.contactId]
      );
      const contact = contactResult.rows[0];

      if (contact) {
        const leadResult = await dbPool.query(
          `INSERT INTO leads (name, phone, email, lead_type, source, notes, status)
           VALUES ($1, $2, $3, $4, 'referral', $5, 'new')
           RETURNING id`,
          [
            contact.identifier_value,
            contact.identifier_type === 'phone' ? contact.identifier_value : null,
            contact.identifier_type === 'email' ? contact.identifier_value : null,
            leadType,
            `Cross-referral from ${input.fromDepartment}: ${input.reason}`,
          ]
        );
        leadId = leadResult.rows[0]?.id;
      }
    } catch (err) {
      console.error('[emitCrossReferral] lead creation error:', err);
    }

    // Create notification for target department
    await dealSvc.createNotification({
      userId: 1,
      title: `Cross-Referral from ${input.fromDepartment}`,
      body: `A contact has been referred to ${input.toDepartment}. Reason: ${input.reason}. ${leadId ? `Lead #${leadId} created.` : ''}`,
      type: 'referral',
    });

    // Emit cross-referral event
    await dealEventBus.emit(DEAL_EVENTS.CROSS_REFERRAL, {
      dealId: 0,
      propertyId: input.propertyId || 0,
      dealType: 'cross_referral',
      fromDepartment: input.fromDepartment,
      toDepartment: input.toDepartment,
      contactId: input.contactId,
      leadId,
    });

    return JSON.stringify({
      referred: true,
      leadId,
      toDepartment: input.toDepartment,
      message: `Contact referred to ${input.toDepartment} department.${leadId ? ` Lead #${leadId} created.` : ''}`,
    });
  },
});
