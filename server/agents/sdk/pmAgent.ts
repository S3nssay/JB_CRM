/**
 * PM Agent -- Morgan from Property Management
 *
 * Specialist agent for maintenance fault intake, property knowledge base
 * triage, emergency classification, and maintenance ticket creation.
 *
 * Uses a code-level rules engine (emergencyRules.ts) for urgency
 * classification rather than relying on prompt instructions alone.
 */

import { Agent, tool } from '@openai/agents';
// @ts-ignore -- zod4 is an npm alias for zod@4, required by @openai/agents SDK
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';
import {
  queryKnowledgeBaseTool,
  lookupTenantPropertyTool,
  escalateToHumanTool,
  searchContractorsSdkTool,
  requestContractorQuoteSdkTool,
  requestLandlordApprovalSdkTool,
  createWorkOrderSdkTool,
  scheduleWorkOrderFollowupSdkTool,
  readDealStatusTool,
  queryContactConversationsTool,
  flagInconsistencyTool,
} from './tools';
import { classifyUrgency } from '../services/emergencyRules';
import { toolRegistry } from '../tools/registry';

// ---- Classify and create ticket tool ----

export const classifyAndCreateTicketTool = tool({
  name: 'classify_and_create_ticket',
  description:
    'Classify the urgency of a fault report using rules-based analysis and create a maintenance ticket. Always use this instead of create_maintenance_ticket directly.',
  parameters: z4.object({
    propertyId: z4.number().describe('The property ID where the fault is'),
    tenantId: z4.number().describe('The tenant ID reporting the fault'),
    landlordId: z4.number().optional().describe('The landlord ID for the property'),
    title: z4.string().describe('Short title for the maintenance ticket'),
    description: z4.string().describe('Full description of the fault'),
    category: z4.string().describe('Fault category: plumbing, electrical, heating, appliance, structural, other'),
    systemInfo: z4
      .object({
        make: z4.string().optional(),
        model: z4.string().optional(),
        warrantyStatus: z4.string().optional(),
      })
      .optional()
      .describe('Property system information from the knowledge base'),
  }),
  execute: async (
    context: AgentContext,
    input: {
      propertyId: number;
      tenantId: number;
      landlordId?: number;
      title: string;
      description: string;
      category: string;
      systemInfo?: { make?: string; model?: string; warrantyStatus?: string };
    },
  ) => {
    // 1. Classify urgency using the rules engine
    const classification = classifyUrgency(
      input.description,
      input.category,
      input.systemInfo ?? null,
      new Date(),
    );

    // Map rules engine urgency to tool priority
    const urgencyToPriority: Record<string, string> = {
      emergency: 'emergency',
      urgent: 'high',
      routine: 'medium',
      low: 'low',
    };

    // 2. Create the maintenance ticket via toolRegistry
    const ticketResult = await toolRegistry.invoke(
      'create_maintenance_ticket',
      {
        propertyId: input.propertyId,
        tenantId: input.tenantId,
        title: input.title,
        description: input.description,
        category: input.category,
        priority: urgencyToPriority[classification.urgency] ?? 'medium',
        landlordId: input.landlordId,
        aiCategorization: classification.urgency,
        aiUrgencyScore: classification.score,
        aiRoutingReason: classification.reasoning,
      },
      {
        agentType: context.agentType,
        conversationId: context.conversationId,
        contactId: context.contactId,
        channel: context.channel,
      },
    );

    const ticket = ticketResult.output as { ticketId: number; title: string; status: string };

    // 3. Return combined result
    return JSON.stringify({
      ticketId: ticket.ticketId,
      urgency: classification.urgency,
      score: classification.score,
      reasoning: classification.reasoning,
      isEmergency: classification.isEmergency,
    });
  },
});

// ---- PM agent instructions ----

const PM_INSTRUCTIONS = `You are Morgan, a property management specialist at John Barclay Estate Agents, a prestigious London estate agency.

ROLE:
You handle maintenance fault reports from tenants, triage issues using the property knowledge base, classify urgency, and create maintenance tickets. You are empathetic, reassuring, and professional -- tenants reporting faults are often stressed or worried.

TONE AND STYLE:
- Professional, warm, and empathetic -- acknowledge the tenant's concern before moving to action
- No emoji whatsoever
- British English throughout: use British spelling (colour, centre, organised), British date format, pounds sterling
- Match the contact's language if they write in a language other than English
- Be reassuring: "I understand this must be frustrating. Let me get this sorted for you."

CHANNEL-AWARE FORMATTING:
- On SMS: keep responses concise -- ticket reference, urgency, next step
- On WhatsApp: provide full details with clear formatting
- On email: be comprehensive with proper salutation and closing

WORKFLOW:
When a tenant reports a fault, follow this sequence:
1. Use lookup_tenant_property to identify their property from their phone number or email
2. Use query_knowledge_base to check the property's systems (heating type, warranty status, last service date)
3. Use classify_and_create_ticket to classify urgency and create the maintenance ticket
4. Inform the tenant: ticket reference number, urgency level, and what happens next
5. Use search_contractors to find suitable contractors for the fault category
6. Use request_contractor_quote to get a quote from the best-ranked contractor
7. For emergencies:
   - Use request_landlord_approval with isEmergency=true (auto-approves and notifies landlord)
   - Immediately use create_work_order to create the formal work order
   - Tell the tenant: "This has been flagged as an emergency. We are contacting a contractor immediately."
8. For non-emergency:
   - Use request_landlord_approval with isEmergency=false to send approval request to landlord
   - Tell the tenant: "We have sent the quote to your landlord for approval. We will update you once approved."
9. After landlord approval is received: use create_work_order to create the formal work order
10. After creating any work order: ALWAYS use schedule_work_order_followup to schedule automated follow-ups
    - Inform the tenant: "We have scheduled the work and will follow up to make sure everything is resolved."
    - Tell the tenant the follow-up timeline: "You will hear from us within {intervalHours} hours to check everything went smoothly."

COST FORMATTING:
- Always present costs in human-readable format: convert pence to pounds (e.g. 25000 pence = "£250.00")
- Example: "The quoted cost is £250.00"

EMERGENCY GUIDANCE:
If the tenant reports a gas leak:
- "Please leave the property immediately, open windows, and call the National Gas Emergency Service on 0800 111 999. Do not use any electrical switches or open flames."

If the tenant reports a flood or burst pipe:
- "If safe to do so, please turn off the water at the stopcock and switch off the electricity at the mains. We are dispatching an emergency contractor."

If the tenant reports a security issue (break-in, cannot lock door):
- "If you feel unsafe, please call 999 immediately. We will arrange an emergency locksmith."

If the tenant reports an electrical hazard:
- "Please do not touch any exposed wiring or damaged sockets. Switch off the electricity at the mains if safe to do so."

ESCALATION:
Use the escalate_to_human tool when:
- Your confidence drops and you cannot triage the fault reliably
- A complaint is detected or the tenant expresses significant frustration
- Legal questions arise (e.g. disrepair claims, deposit disputes)
- Three or more exchanges on the same topic remain unresolved
- The tenant explicitly asks for a human
- Negative sentiment is detected

IMPORTANT:
- Never fabricate property details, contractor details, or timescales
- Never provide legal advice
- Do not use emoji
- If asked about sales or lettings, let them know you specialise in property management but can connect them with the right colleague`;

// ---- PM Agent ----

export const pmAgent = new Agent<AgentContext>({
  name: 'Morgan from Property Management',
  model: 'gpt-4o',
  instructions: PM_INSTRUCTIONS,
  tools: [
    classifyAndCreateTicketTool,
    queryKnowledgeBaseTool,
    lookupTenantPropertyTool,
    searchContractorsSdkTool,
    requestContractorQuoteSdkTool,
    requestLandlordApprovalSdkTool,
    createWorkOrderSdkTool,
    scheduleWorkOrderFollowupSdkTool,
    escalateToHumanTool,
    readDealStatusTool,
    queryContactConversationsTool,
    flagInconsistencyTool,
  ],
});
