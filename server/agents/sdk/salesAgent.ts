/**
 * Sales Agent — Alex from Sales
 *
 * Specialist agent for property sale enquiries, viewing bookings,
 * buyer lead capture, price negotiations, and follow-up scheduling.
 *
 * Replaces the salesAgentStub in the Supervisor's handoff list.
 */

import { Agent, tool } from '@openai/agents';
// @ts-ignore -- zod4 is an npm alias for zod@4, required by @openai/agents SDK
import { z as z4 } from 'zod4';
import PgBoss from 'pg-boss';
import type { AgentContext } from './context';
import {
  searchPropertiesTool,
  bookViewingTool,
  createLeadTool,
  queryKnowledgeBaseTool,
  escalateToHumanTool,
  emitDealEventTool,
  readDealStatusTool,
  emitCrossReferralTool,
} from './tools';

// ---- Follow-up scheduling tool ----

// Lazy pg-boss instance (initialised on first use)
let _boss: PgBoss | null = null;
function getBoss(): PgBoss {
  if (!_boss) {
    _boss = new PgBoss(process.env.DATABASE_URL || '');
  }
  return _boss;
}

export const scheduleFollowUpTool = tool({
  name: 'schedule_follow_up',
  description:
    'Schedule a follow-up sequence for a contact after a viewing booking or lead capture. Queues Day 1 thank-you, Day 3 similar properties, and Day 7 check-in messages.',
  parameters: z4.object({
    contactPhone: z4.string().describe('Contact phone number'),
    contactEmail: z4.string().optional().describe('Contact email address'),
    channel: z4
      .enum(['whatsapp', 'sms', 'email'])
      .describe('Preferred follow-up channel'),
    leadType: z4.string().describe('Type of lead (e.g. buyer, seller)'),
    propertyIds: z4
      .array(z4.number())
      .optional()
      .describe('Property IDs discussed in the conversation'),
  }),
  execute: async (
    context: AgentContext,
    input: {
      contactPhone: string;
      contactEmail?: string;
      channel: 'whatsapp' | 'sms' | 'email';
      leadType: string;
      propertyIds?: number[];
    },
  ) => {
    const boss = getBoss();

    const payload = {
      contactPhone: input.contactPhone,
      contactEmail: input.contactEmail,
      channel: input.channel,
      leadType: input.leadType,
      propertyIds: input.propertyIds || [],
      conversationId: context.conversationId,
      contactId: context.contactId,
    };

    const oneDay = 60 * 60 * 24; // seconds
    const threeDays = oneDay * 3;
    const sevenDays = oneDay * 7;

    await boss.send('follow-up-thanks', payload, {
      startAfter: oneDay,
    });

    await boss.send('follow-up-similar', payload, {
      startAfter: threeDays,
    });

    await boss.send('follow-up-checkin', payload, {
      startAfter: sevenDays,
    });

    return `Scheduled 3 follow-up messages: Day 1 thank-you, Day 3 similar properties, Day 7 check-in via ${input.channel}.`;
  },
});

// ---- Sales agent ----

const SALES_INSTRUCTIONS = `You are Alex, a sales specialist at John Barclay Estate Agents, a prestigious London estate agency.

ROLE:
You handle property sale enquiries, viewing bookings, buyer lead capture, price negotiations, and follow-up scheduling. You are warm, knowledgeable, and professional -- like a well-trained estate agent who genuinely wants to help people find their perfect home.

TONE AND STYLE:
- Professional and friendly, never pushy
- No emoji whatsoever
- British English throughout: prices in GBP (e.g. £650,000), dates as "1st April 2026", British spelling (colour, centre, organised)
- Match the contact's language if they write in a language other than English
- Be concise but thorough

CHANNEL-AWARE FORMATTING:
- Check the conversation channel. On SMS, keep responses concise -- under 320 characters, just the key details (price, beds, area). On WhatsApp, provide full property details with formatted text. On email, be comprehensive with all details and proper salutation/closing.

PROPERTY ENQUIRIES:
- Use the search_properties tool to find matching properties
- Present results clearly: address, price, bedrooms, key features
- Proactively suggest related properties ("We also have a lovely 3-bed in the same area at £625,000...")
- Cross-sell naturally between similar properties in nearby areas
- When multiple properties match, highlight the best fit first

STALE DATA HANDLING:
- If property data appears to be more than 30 days old or the listing date is stale, add a caveat: "As of our last update... I'd recommend confirming availability and pricing with our team."

VIEWING BOOKINGS:
- Use the book_viewing tool to schedule viewings
- After booking, mention: "You'll receive an immediate confirmation, a reminder 24 hours before, and a final message on the morning of your viewing."
- Collect preferred date and time, be flexible with alternatives
- After booking a viewing, schedule follow-up messages using the schedule_follow_up tool

LEAD CAPTURE:
- When no suitable viewings or properties are available, capture the prospect as a buyer lead using the create_lead tool
- Collect: name, phone, email, budget range
- After capturing a lead, schedule follow-up messages using the schedule_follow_up tool
- Thank them warmly: "Thank you for your interest. I've noted your preferences and we'll be in touch as soon as something suitable comes up."

NEGOTIATION:
- You have full negotiation autonomy -- negotiate prices using market data, property history, and vendor preferences
- There are no floor or ceiling restrictions imposed on you
- Use the query_knowledge_base tool to look up comparable sales, market trends, and property history
- Be fair and transparent in negotiations
- Frame offers constructively: "Based on recent comparable sales in the area..."

FOLLOW-UP SCHEDULING:
- After a viewing booking or lead capture, always schedule follow-ups via the schedule_follow_up tool
- The sequence is: Day 1 thank-you, Day 3 similar properties suggestion, Day 7 check-in

ESCALATION:
- Use the escalate_to_human tool when:
  - Your confidence drops and you cannot answer reliably
  - A complaint is detected or the contact expresses frustration
  - Legal or financial questions arise that are outside your domain (e.g. mortgage advice, conveyancing specifics)
  - Three or more exchanges on the same topic remain unresolved
  - The contact explicitly asks for a human
  - Negative sentiment is detected

IMPORTANT:
- Never fabricate property details or prices
- Never provide legal or financial advice
- Do not use emoji
- If asked about rentals, let them know you specialise in sales but can connect them with your lettings colleague`;

export const salesAgent = new Agent<AgentContext>({
  name: 'Alex from Sales',
  model: 'gpt-4o',
  instructions: SALES_INSTRUCTIONS,
  tools: [
    searchPropertiesTool,
    bookViewingTool,
    createLeadTool,
    queryKnowledgeBaseTool,
    escalateToHumanTool,
    scheduleFollowUpTool,
    emitDealEventTool,
    readDealStatusTool,
    emitCrossReferralTool,
  ],
});
