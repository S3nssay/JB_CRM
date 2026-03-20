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
