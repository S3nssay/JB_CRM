/**
 * Sourcing Agent -- Charlie "The Networker"
 *
 * Proactively identifies property sourcing opportunities through market intelligence
 * monitoring, scores leads by propensity to instruct, drafts source-specific outreach,
 * and manages follow-up sequences.
 *
 * BaseAgent registration for legacy orchestrator system.
 */

import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

export class SourcingAgent extends BaseAgent {
  constructor(customConfig?: Partial<AgentConfig>) {
    super({
      id: 'sourcing',
      name: 'Charlie - The Networker',
      description: 'Proactively identifies property sourcing opportunities through market intelligence monitoring, scores leads by propensity to instruct, drafts source-specific outreach, and manages follow-up sequences.',
      enabled: true,
      handlesMessageTypes: ['lead', 'inquiry', 'valuation_request', 'follow_up'],
      handlesTaskTypes: ['process_proactive_lead', 'run_monitor', 'send_outreach', 'follow_up_lead', 'respond_to_inquiry'],
      communicationChannels: ['email', 'post', 'phone'],
      personality: 'Proactive, market-savvy, persuasive but not pushy. Knows the local West London area intimately. Positions John Barclay as the premium local expert.',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '06:00', end: '22:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      responseDelaySeconds: 60,
      maxConcurrentTasks: 50,
      priorityPostcodes: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
      ...customConfig,
    });
  }

  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    return `
TASK: ${task.type}
Priority: ${task.priority}
Description: ${task.description}

${task.input.lead ? `
PROACTIVE LEAD DETAILS:
Source: ${task.input.lead.leadSource}
Address: ${task.input.lead.propertyAddress}
Postcode: ${task.input.lead.postcode}
Lead Score: ${task.input.lead.leadScore}/100
Temperature: ${task.input.lead.leadTemperature}
AI Recommendation: ${task.input.lead.aiRecommendation || 'None'}
` : ''}

${task.input.message ? `
INCOMING MESSAGE:
From: ${task.input.fromName || task.input.from}
Channel: ${task.input.channel}
Subject: ${task.input.subject || 'N/A'}
Content: ${task.input.body}
` : ''}

SOURCING GUIDELINES:

APPROACH:
- Proactive, market-savvy, persuasive but not pushy
- Position John Barclay as the premium local expert in West London
- All outreach requires staff approval before sending
- British English, professional tone, no emoji

FOCUS AREAS:
- W2 (Paddington/Bayswater), W9 (Maida Vale), W10 (North Kensington)
- W11 (Notting Hill), NW6 (Kilburn/Queens Park), NW8 (St John's Wood)
- NW10 (Kensal Green/Harlesden)

LEAD SOURCES:
- Expired listings from competitor agents
- Price reductions signalling motivated sellers
- Land Registry transfers (probate, long-term owners)
- Planning permissions (development opportunities)
- Auction results (unsold lots, new buyers)
- Competitor listings going stale

OUTREACH RULES:
- Draft all outreach for staff approval before sending
- Personalise messages based on lead source and property details
- Follow-up sequences: initial contact, then 7-day, 14-day, 30-day touchpoints
- Never be pushy -- position as offering a valuable service

Determine the best action based on the lead source and quality.
`;
  }
}

export const sourcingAgent = new SourcingAgent();
