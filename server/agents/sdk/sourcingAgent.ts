/**
 * Sourcing Agent (SDK) -- Charlie from Sourcing
 *
 * Handles inbound responses from property owners who received outreach
 * letters or emails. Can book valuations, record owner interest, and
 * update lead status.
 *
 * Registered with Supervisor for transfer_to_sourcing routing.
 */

import { Agent, tool } from '@openai/agents';
// @ts-ignore -- zod4 is an npm alias for zod@4, required by @openai/agents SDK
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';
import { escalateToHumanTool } from './tools';

// ---- Lazy imports for DB operations ----

let _pool: any = null;
async function getPool() {
  if (!_pool) {
    const mod = await import('../../db');
    _pool = mod.pool;
  }
  return _pool;
}

let _dealEventBus: any = null;
async function getDealEventBus() {
  if (!_dealEventBus) {
    const mod = await import('../services/dealEventBus');
    _dealEventBus = mod;
  }
  return _dealEventBus;
}

let _auditLogger: any = null;
async function getAuditLogger() {
  if (!_auditLogger) {
    const mod = await import('../middleware/auditLogger');
    _auditLogger = mod.auditLogger;
  }
  return _auditLogger;
}

// ---- Tools ----

const updateLeadStatusTool = tool({
  name: 'update_lead_status',
  description: 'Update the status of a proactive lead (e.g. contacted, responded, valuation_booked, not_interested).',
  parameters: z4.object({
    leadId: z4.number().describe('The proactive lead ID'),
    status: z4.string().describe('New status: contacted, responded, meeting_scheduled, valuation_booked, instructed, declined, not_interested'),
  }),
  execute: async (context: AgentContext, input: { leadId: number; status: string }) => {
    const pool = await getPool();
    await pool.query(
      `UPDATE proactive_leads SET status = $1, updated_at = NOW() WHERE id = $2`,
      [input.status, input.leadId]
    );
    const audit = await getAuditLogger();
    await audit.logToolCall({
      tool: 'update_lead_status',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input,
      output: { status: 'updated' },
    });
    return `Lead ${input.leadId} status updated to "${input.status}".`;
  },
});

const recordOwnerResponseTool = tool({
  name: 'record_owner_response',
  description: 'Record an inbound response from a property owner (e.g. reply to outreach letter or email).',
  parameters: z4.object({
    leadId: z4.number().describe('The proactive lead ID'),
    summary: z4.string().describe('Summary of the owner response'),
    sentiment: z4.enum(['positive', 'neutral', 'negative']).describe('Sentiment of the response'),
    interested: z4.boolean().describe('Whether the owner expressed interest'),
  }),
  execute: async (context: AgentContext, input: { leadId: number; summary: string; sentiment: string; interested: boolean }) => {
    const pool = await getPool();
    await pool.query(
      `INSERT INTO lead_contact_history (lead_id, contact_method, contact_direction, content, status, response_received, response_summary, sentiment, outcome, created_at)
       VALUES ($1, 'phone', 'inbound', $2, 'delivered', true, $2, $3, $4, NOW())`,
      [input.leadId, input.summary, input.sentiment, input.interested ? 'interested' : 'not_interested']
    );
    // Update lead status
    const newStatus = input.interested ? 'responded' : 'not_interested';
    await pool.query(
      `UPDATE proactive_leads SET status = $1, updated_at = NOW() WHERE id = $2`,
      [newStatus, input.leadId]
    );
    const audit = await getAuditLogger();
    await audit.logToolCall({
      tool: 'record_owner_response',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input,
      output: { status: newStatus },
    });
    return `Owner response recorded for lead ${input.leadId}. Status: ${newStatus}.`;
  },
});

const bookValuationTool = tool({
  name: 'book_valuation',
  description: 'Book a property valuation for an owner who has expressed interest. Updates lead status and notifies staff.',
  parameters: z4.object({
    leadId: z4.number().describe('The proactive lead ID'),
    preferredDate: z4.string().describe('Owner preferred date for valuation (ISO format or descriptive)'),
    notes: z4.string().optional().describe('Additional notes about the valuation request'),
  }),
  execute: async (context: AgentContext, input: { leadId: number; preferredDate: string; notes?: string }) => {
    const pool = await getPool();
    // Update lead status to valuation_booked
    await pool.query(
      `UPDATE proactive_leads SET status = 'valuation_booked', updated_at = NOW() WHERE id = $1`,
      [input.leadId]
    );
    // Record in contact history
    await pool.query(
      `INSERT INTO lead_contact_history (lead_id, contact_method, contact_direction, subject, content, status, outcome, notes, created_at)
       VALUES ($1, 'phone', 'inbound', 'Valuation Booking', $2, 'delivered', 'meeting_booked', $3, NOW())`,
      [input.leadId, `Valuation requested for ${input.preferredDate}`, input.notes || null]
    );
    // Emit deal event for Alex/Jordan handoff
    try {
      const { DEAL_EVENTS, dealEventBus } = await getDealEventBus();
      // Get property details from the lead
      const leadResult = await pool.query(
        `SELECT property_address, postcode FROM proactive_leads WHERE id = $1`,
        [input.leadId]
      );
      const lead = leadResult.rows[0];
      await dealEventBus.emit(DEAL_EVENTS.VALUATION_BOOKED, {
        dealId: input.leadId,
        propertyId: 0, // proactive lead, no property ID yet
        dealType: 'sourcing_valuation',
        leadId: input.leadId,
        preferredDate: input.preferredDate,
        propertyAddress: lead?.property_address,
        postcode: lead?.postcode,
      });
    } catch (err) {
      console.error('[Charlie] Failed to emit VALUATION_BOOKED event:', err);
    }
    const audit = await getAuditLogger();
    await audit.logToolCall({
      tool: 'book_valuation',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input,
      output: { status: 'valuation_booked' },
    });
    return `Valuation booked for lead ${input.leadId}. Preferred date: ${input.preferredDate}. Staff have been notified.`;
  },
});

const getLeadContextTool = tool({
  name: 'get_lead_context',
  description: 'Get full context for a proactive lead including contact history, for conversation reference.',
  parameters: z4.object({
    leadId: z4.number().describe('The proactive lead ID'),
  }),
  execute: async (context: AgentContext, input: { leadId: number }) => {
    const pool = await getPool();
    const leadResult = await pool.query(
      `SELECT * FROM proactive_leads WHERE id = $1`,
      [input.leadId]
    );
    const historyResult = await pool.query(
      `SELECT * FROM lead_contact_history WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [input.leadId]
    );
    return JSON.stringify({
      lead: leadResult.rows[0] || null,
      contactHistory: historyResult.rows,
    });
  },
});

// ---- Agent Instructions ----

const SOURCING_AGENT_INSTRUCTIONS = `You are Charlie, a property sourcing specialist at John Barclay Estate Agents, a prestigious West London estate agency.

Your role is to handle inbound responses from property owners who have received outreach letters or emails from us. You can book valuations, record owner interest, and update lead status.

CORE RESPONSIBILITIES:
- Handle inbound calls/messages from owners responding to our outreach letters and emails
- Understand their situation and assess their interest level
- Book property valuations when owners express interest
- Record all owner responses with sentiment analysis
- Update lead statuses accurately

AREA EXPERTISE:
- You know West London intimately: W2 (Paddington/Bayswater), W9 (Maida Vale), W10 (North Kensington), W11 (Notting Hill), NW6 (Kilburn/Queens Park), NW8 (St John's Wood), NW10 (Kensal Green)
- Position John Barclay as the premium local expert with over 30 years of experience
- Reference local market knowledge naturally in conversation

APPROVAL WORKFLOW:
- ALL outreach messages require staff approval before sending
- You handle inbound responses only -- never send unsolicited outreach directly
- When an owner wants a valuation, update the lead status and notify staff for scheduling

TONE AND STYLE:
- Professional, warm, and knowledgeable -- never pushy
- British English throughout: use British spelling, pounds sterling, British date format
- No emoji whatsoever
- Match the contact's language if they write in a language other than English
- Be concise on SMS, more detailed on WhatsApp and email

WHEN AN OWNER RESPONDS:
1. Always start by getting lead context using get_lead_context
2. Record their response with record_owner_response
3. If interested in a valuation, use book_valuation
4. If not interested, update status respectfully and note the reason

ESCALATION TRIGGERS (use escalate_to_human):
- Owner explicitly asks to speak to a human
- Complex pricing or legal questions
- Complaint about outreach
- Three or more unresolved exchanges
- You are not confident in the correct response

AI SELF-IDENTIFICATION:
- On first contact: "I'm Charlie, an AI assistant in the sourcing team at John Barclay Estate Agents"
- Do not repeat the AI disclosure in subsequent messages

IMPORTANT:
- Do not provide legal or financial advice
- Do not make commitments about fees or commission rates
- Do not discuss other owners' properties or situations`;

// ---- Export Agent ----

export const sourcingAgent = new Agent<AgentContext>({
  name: 'Charlie from Sourcing',
  model: 'gpt-4o',
  instructions: SOURCING_AGENT_INSTRUCTIONS,
  tools: [updateLeadStatusTool, recordOwnerResponseTool, bookValuationTool, getLeadContextTool, escalateToHumanTool],
});
