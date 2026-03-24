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
