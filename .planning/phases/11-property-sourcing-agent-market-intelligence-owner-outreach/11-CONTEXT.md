# Phase 11: Property Sourcing Agent — Market Intelligence & Owner Outreach - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

An AI property sourcing agent (Charlie) that proactively identifies new business opportunities by monitoring market intelligence sources, scoring leads by propensity to instruct, drafting source-specific outreach (letters + emails) for staff approval, managing follow-up sequences, and handling inbound responses from owners. Charlie operates both autonomously (cron-based monitoring) and conversationally (Supervisor-routed responses). Includes a CRM dashboard for pipeline management, outreach approvals, campaign configuration, and performance metrics.

</domain>

<decisions>
## Implementation Decisions

### Intelligence Sources
- **D-01:** Monitor the full suite of market intelligence sources: Land Registry transactions (new purchases, probate transfers, long-term owners), portal stale listings (Zoopla, Rightmove, OnTheMarket), auction results (unsold/withdrawn lots), planning applications, and competitor listing expirations
- **D-02:** Stale listing threshold remains at 90+ days on market (current `LeadGenerationService` default). Properties listed 90-365 days are flagged as opportunities
- **D-03:** AI-powered propensity scoring using OpenAI — rank leads by likelihood to instruct based on multiple signals (ownership duration, local market conditions, property type, price movement, listing history). Store scores in existing `propensity_scores` table

### Outreach Strategy
- **D-04:** All outreach is staff-approved before sending — Charlie identifies, scores, and drafts messages, but a staff member reviews and approves each outreach before it goes out
- **D-05:** Outreach channels are letter (physical mail) + email. Letters for initial approach (premium feel, high open rate), email for follow-ups. Existing `emailService` handles email; letter templates need print/mail integration or PDF generation for manual posting
- **D-06:** Source-specific outreach templates — AI generates tailored messaging per lead source: "we have active buyers" for stale listings, sensitive approach for probate transfers, "quick private sale" for failed auction lots, "new to the area?" for recent purchases, etc.
- **D-07:** Automated follow-up sequences — Charlie manages a multi-touch cadence per lead (e.g., letter → email 7 days later → second letter 21 days later). Each touchpoint is staff-approved but Charlie queues them automatically and reminds staff when next action is due

### Agent Identity & Hierarchy
- **D-08:** Agent name is Charlie — "The Networker". Proactive, market-savvy, persuasive but not pushy. Knows the local West London area intimately. Positions John Barclay as the premium local expert
- **D-09:** Charlie operates in dual mode: autonomous cron-based monitoring (scans sources daily, scores leads, queues outreach drafts) AND Supervisor-routed conversational (handles inbound responses from owners who received outreach letters/emails — Supervisor recognises "I received your letter" patterns)
- **D-10:** Charlie handles the journey from sourcing through to booking a valuation appointment. Once valuation is booked, the deal pipeline event bus triggers handoff to Alex (sales) or Jordan (lettings) to manage the instruction onward
- **D-11:** Charlie integrates with existing agent infrastructure: extends BaseAgent, registers with Supervisor for routing, uses Tool Registry for CRM actions, logs to agent audit trail

### Sourcing Dashboard
- **D-12:** Dashboard prioritises pipeline view with approval workflow: leads flow through stages (new → scored → outreach drafted → awaiting approval → sent → responded → valuation booked → instructed). Staff primarily use it to approve/reject outreach drafts and track conversion
- **D-13:** Full campaign configuration UI — staff can create/edit monitoring campaigns: target postcodes, price ranges, property types, stale thresholds, scan frequency. Backed by existing `lead_monitoring_configs` table
- **D-14:** Key performance metrics displayed: leads sourced this month, outreach sent count, response rate, valuations booked, instructions won. Breakdown by source (Land Registry, stale listings, auctions, planning apps, competitors)

### Claude's Discretion
- Exact cron scheduling for monitoring scans
- Letter template design and PDF generation approach
- Follow-up cadence timing (exact day intervals)
- Propensity scoring model prompt engineering
- Dashboard layout and component choices
- How to handle duplicate leads across sources

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Existing Agent Infrastructure
- `server/agents/BaseAgent.ts` — Base agent class all specialists extend
- `server/agents/SupervisorAgent.ts` — Supervisor routing logic, intent detection patterns
- `server/agents/AgentOrchestrator.ts` — Agent registration and orchestration
- `server/agents/specialists/LeadGenAgent.ts` — Existing LeadGen agent scaffold (will be evolved into Charlie)
- `server/agents/types.ts` — Agent type definitions, task types, config interfaces

### Existing Lead Generation Services
- `server/proactiveLeadGenService.ts` — Land Registry monitoring, portal scraping, auction tracking, social media mentions, propensity scoring (substantial existing code)
- `server/leadGenerationService.ts` — Stale listing monitoring, cash offer campaigns, monitor settings

### Schema Tables
- `shared/schema.ts` — Tables: `proactive_leads` (line ~4100), `lead_monitoring_configs` (line ~4201), `propensity_scores` (line ~4396), `seasonal_campaigns` (line ~4292), `social_media_mentions` (line ~4452)

### Agent Collaboration
- `server/agents/services/dealPipelineService.ts` — Deal pipeline event bus for handoff to Sales/Lettings agents
- `server/collaborationHubService.ts` — Cross-agent collaboration patterns

### Communication Services
- `server/emailService.ts` — Email sending (used for outreach emails)
- `server/whatsappService.ts` — WhatsApp integration (for future outreach channel expansion)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ProactiveLeadGenService` — Already has Land Registry, portal, auction, social media monitoring scaffolds. Needs to be connected to Charlie agent and production APIs
- `LeadGenerationService` — Stale listing detection with configurable thresholds. Has `MonitorSettings` interface ready for dashboard config
- `LeadGenSalesAgent` / `LeadGenLettingsAgent` — Existing agent scaffolds with value propositions, qualification questions, and personality configs
- `proactive_leads` table — Full lead tracking with source, score, status, contact history fields
- `lead_monitoring_configs` table — Configurable monitoring parameters per source type
- `propensity_scores` table — Ready for AI scoring storage with score, factors, confidence fields

### Established Patterns
- All agents extend `BaseAgent` and register with `AgentOrchestrator`
- Supervisor uses intent detection to route messages to specialist agents
- Agent actions logged to audit trail (existing pattern from phases 1-10)
- Cron jobs via pg-boss (established in Phase 10 for Riley's scheduled tasks)
- Deal pipeline events trigger cross-agent handoffs (Phase 6 event bus)
- Staff approval pattern exists in Taylor (PM Finance) for landlord statements

### Integration Points
- Supervisor routing: add Charlie intent patterns for "received your letter", "valuation request from outreach"
- Deal pipeline: emit `valuation_booked` event for Alex/Jordan handoff
- CRM navigation: add Sourcing Dashboard to CRMLayout sidebar
- App.tsx: add route for `/crm/sourcing-dashboard`

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-property-sourcing-agent-market-intelligence-owner-outreach*
*Context gathered: 2026-03-27*
