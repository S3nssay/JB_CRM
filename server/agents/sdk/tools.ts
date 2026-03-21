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
