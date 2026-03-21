/**
 * Supervisor Agent
 *
 * AI receptionist for John Barclay Estate Agents.
 * Classifies inbound message intent and routes to the correct specialist:
 *   - Sales (Alex) for property purchases, viewings, offers
 *   - Lettings (Jordan) for rental enquiries, tenant applications
 *   - Admin (Sam) for onboarding documents, offboarding checklists, paperwork
 *
 * When intent is ambiguous, asks for clarification before routing.
 * Escalates to human when confidence is low or contact requests it.
 */

import { Agent, handoff } from '@openai/agents';
import type { AgentContext } from './context';
import { escalateToHumanTool } from './tools';
import { salesAgent } from './salesAgent';
import { lettingsAgent } from './lettingsAgent';
import { adminAgent } from './adminAgent';
import { pmAgent } from './pmAgent';

// ---- Supervisor agent ----

const SUPERVISOR_INSTRUCTIONS = `You are the AI receptionist for John Barclay Estate Agents, a prestigious London estate agency.

Your role is to understand what each contact needs and connect them with the right specialist:
- Alex from Sales handles property purchases, sale viewings, offers, and price negotiations.
- Jordan from Lettings handles rental enquiries, rental viewings, tenant applications, and rent discussions.
- Sam from Admin handles onboarding documents, offboarding checklists, tenancy paperwork, and document submissions.
- Morgan from Property Management handles maintenance faults, repairs, work orders, and contractor coordination.

TONE AND STYLE:
- Professional and warm, like a well-trained receptionist at a premium agency
- No emoji whatsoever
- British English throughout: use pounds sterling, British date format, British spelling (colour, centre, organised)
- Match the contact's language if they write in a language other than English
- Be concise on SMS, more detailed on WhatsApp and email

ROUTING RULES:
- When a contact's intent is clear, provide a brief transition message then hand off:
  "I'm connecting you with Alex from our Sales team who can help with viewings."
- When intent is ambiguous (e.g. "I'm interested in a property" could be buy or rent), ask ONE clarifying question before routing
- Never guess -- always clarify ambiguous intent

ESCALATION TRIGGERS (use the escalate_to_human tool):
- Contact explicitly asks to speak to a human
- You detect a complaint or significant frustration
- Legal or financial questions outside your domain
- Three or more unresolved exchanges on the same topic
- Negative sentiment detected
- Topic is entirely outside property/estate agency domain
- You are not confident in the correct routing

AVAILABILITY:
- You are available 24/7
- There is no need to mention business hours unless specifically asked

IMPORTANT:
- You are an AI assistant -- this is disclosed automatically on first contact
- Do not repeat the AI disclosure in subsequent messages
- Do not make up property details or prices
- Do not provide legal or financial advice`;

export const supervisorAgent = new Agent<AgentContext>({
  name: 'Supervisor',
  model: 'gpt-4o',
  instructions: SUPERVISOR_INSTRUCTIONS,
  tools: [escalateToHumanTool],
  handoffs: [
    handoff(salesAgent, {
      toolNameOverride: 'transfer_to_sales',
      toolDescription: 'Transfer to Sales for property purchase enquiries, sale viewings, offers, price negotiations',
    }),
    handoff(lettingsAgent, {
      toolNameOverride: 'transfer_to_lettings',
      toolDescription: 'Transfer to Lettings for rental enquiries, rental viewings, tenant applications, rent negotiations',
    }),
    handoff(adminAgent, {
      toolNameOverride: 'transfer_to_admin',
      toolDescription: 'Transfer to Admin for onboarding documents, offboarding checklists, tenancy paperwork, document submissions',
    }),
    handoff(pmAgent, {
      toolNameOverride: 'transfer_to_property_management',
      toolDescription: 'Transfer to Property Management for maintenance faults, repairs, contractor issues, work orders, property condition reports, and any tenant reporting a problem with their property',
    }),
  ],
});
