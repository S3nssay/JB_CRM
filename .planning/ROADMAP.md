# Roadmap: JB CRM — AI Agents & Property Knowledge Base

## Overview

Five phases build a production AI agent system on top of the existing CRM. Phase 1 lays the database and infrastructure foundation — the property knowledge base, conversation store, tool registry, and audit trail — that every subsequent phase depends on. Phase 2 brings the text-channel specialist agents (Sales, Lettings, Admin, Supervisor) live on WhatsApp, SMS, and email. Phase 3 adds voice via Vapi, making agents available on inbound calls 24/7. Phase 4 delivers the Property Management specialist — the most complex agent, requiring both the knowledge base and proven channel infrastructure. Phase 5 adds arrears chasing (high-compliance, high-risk) and staff monitoring dashboards, after the core system has accumulated audit data.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Property knowledge base schema, conversation store, tool registry, and audit trail (completed 2026-03-19)
- [x] **Phase 2: Text-Channel Agents** - Supervisor, Sales, Lettings, and Admin specialists live on WhatsApp/SMS/email (completed 2026-03-20)
- [ ] **Phase 3: Voice Integration** - Voice AI (Vapi) answering inbound calls 24/7 with specialist routing
- [x] **Phase 4: Property Management Specialist** - Maintenance intake, contractor dispatch, work order management (completed 2026-03-22)
- [ ] **Phase 5: Arrears Chasing & Monitoring** - Compliant rent arrears outreach and staff agent monitoring dashboard

## Phase Details

### Phase 1: Foundation
**Goal**: The data schema, conversation threading, tool registry, and audit infrastructure exist so that agents can act on live CRM data and leave an immutable record of every action.
**Depends on**: Nothing (first phase)
**Requirements**: KB-01, KB-02, KB-03, KB-04, KB-05, AGENT-02, AGENT-04, AGENT-05, AGENT-06, CHAN-01, CHAN-02
**Success Criteria** (what must be TRUE):
  1. A staff member can open a managed property in the CRM and see certification records (gas safety, EICR, EPC) with expiry dates, systems inventory, and maintenance history
  2. A tool call to `query_knowledge_base` from an agent returns correct property data in under 100ms
  3. When any inbound WhatsApp or SMS arrives, it is stored in a conversation thread linked to a resolved contact identity — visible in the database — regardless of which channel the contact used before
  4. Every agent action (tool invocation, decision, escalation) is written to an audit log table with timestamp, channel, action, and reasoning
  5. Any voice or text interaction where an agent speaks first contains an AI self-identification statement
**Plans**: 5 plans

Plans:
- [ ] 01-01-PLAN.md — Schema foundation: new tables (systems inventory, audit log, contact identities), extend conversations/messages, install Vitest, create all test stubs
- [ ] 01-02-PLAN.md — Conversation store and contact identity resolution: Channel Gateway with SMS/WhatsApp adapters, contact resolver, conversation threading
- [ ] 01-03-PLAN.md — Tool Registry framework: typed CRM action functions with permission tiers, 5 tools (search_properties, book_viewing, create_lead, create_maintenance_ticket, query_knowledge_base)
- [ ] 01-04-PLAN.md — Audit logger and AI self-identification middleware
- [ ] 01-05-PLAN.md — Property Knowledge Base CRM UI: staff view and edit per-property KB data

### Phase 2: Text-Channel Agents
**Goal**: The Supervisor, Sales, Lettings, and Admin specialist agents handle real inbound messages on WhatsApp, SMS, and email — routing correctly, answering property questions from live data, booking viewings, capturing leads, and managing onboarding/offboarding document checklists.
**Depends on**: Phase 1
**Requirements**: AGENT-01, AGENT-03, AGENT-07, SALES-01, SALES-02, SALES-03, SALES-04, LETT-01, LETT-02, LETT-03, LETT-04, ADMIN-01, ADMIN-02, ADMIN-03, CHAN-03, CHAN-04
**Success Criteria** (what must be TRUE):
  1. An inbound WhatsApp asking about a rental property is classified by the Supervisor, handed to the Lettings agent, and receives a reply with live rent and availability data from the CRM — without human involvement
  2. A prospect who asks to book a viewing receives a confirmed appointment (or a lead capture prompt if no slots exist), and gets a WhatsApp/SMS confirmation automatically after the action completes
  3. A second message from the same contact continues in the same conversation thread with context from the previous interaction injected into the agent
  4. When a query exceeds agent capability or confidence, the conversation is flagged for human review with a clear escalation note, and the caller is told a human will follow up
  5. A new tenancy trigger causes the Admin agent to generate an onboarding document checklist; an ending tenancy trigger causes an offboarding checklist — both trackable in the CRM
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — SDK infrastructure, Supervisor agent with intent classification and handoff routing, webhook wiring, escalation service, message sender
- [ ] 02-02-PLAN.md — Sales specialist agent (property search, viewing booking, lead capture, negotiation, follow-up scheduling)
- [ ] 02-03-PLAN.md — Lettings specialist agent (rental enquiries, viewing booking, tenant lead capture, follow-up scheduling)
- [ ] 02-04-PLAN.md — Admin specialist agent (onboarding/offboarding checklists, document completion tracking, chase scheduling)
- [ ] 02-05-PLAN.md — Cross-channel memory injection, post-action confirmations, pg-boss scheduled messages (viewing reminders, follow-ups)

### Phase 3: Voice Integration
**Goal**: Inbound calls to the estate agency are answered 24/7 by a voice AI receptionist that identifies itself as AI, routes callers to the correct specialist by intent, performs CRM tool calls during the call, and transfers to a human when escalation is needed.
**Depends on**: Phase 2
**Requirements**: VOICE-01, VOICE-02, VOICE-03, VOICE-04
**Success Criteria** (what must be TRUE):
  1. A call to the estate agency number is answered immediately 24/7 by a voice agent that begins with an AI self-identification statement in natural British English
  2. A caller saying "I want to book a viewing for the flat in Herne Hill" is routed to the Sales or Lettings specialist voice agent, which looks up the property in the CRM and offers available slots — all within a single call
  3. A caller asking a question that requires a CRM lookup (property price, availability, active tenancy) receives a correct answer during the live call, without dead air beyond a natural "Let me check that for you" pause
  4. When a caller explicitly asks to speak to a person, or the agent's confidence drops below threshold, the call is transferred to a human staff member
**Plans**: TBD

Plans:
- [ ] 03-01: Vapi provider adapter (Squad configuration, receptionist and specialist voice assistants, Twilio SIP webhook forwarding for UK number)
- [ ] 03-02: Voice tool-call webhook endpoints (Vapi tool calls hitting same Tool Registry from Phase 1, pre-call context loading for known callers)
- [ ] 03-03: Call lifecycle handling (start, transcript threading into Conversation Store on end, filler speech patterns, latency optimisation)

### Phase 4: Property Management Specialist
**Goal**: Tenants can report maintenance faults via any channel and the PM agent triages the issue using the property knowledge base, contacts the right contractor, creates a work order, and follows up to verify completion — all without staff handling the routine flow.
**Depends on**: Phase 3
**Requirements**: PM-01, PM-02, PM-03, PM-04, PM-05
**Success Criteria** (what must be TRUE):
  1. A tenant WhatsApp message reporting a boiler fault triggers the PM agent to look up the property's heating system records, identify the correct contractor, and create a work order in the CRM — without staff involvement
  2. A landlord receives an approval prompt (with quote) before a contractor is booked for non-emergency work; emergency work (defined by system rules) is dispatched immediately
  3. After a work order is created, the assigned contractor is contacted via their preferred channel (SMS/email/WhatsApp) with the job details from the CRM
  4. The PM agent sends a follow-up to both tenant and contractor at a configurable interval after the work order is created, logging the verification attempt to the audit trail
**Plans**: TBD

Plans:
- [ ] 04-01: PM specialist agent core (fault intake from any channel, knowledge base triage — heating type, warranty status, last service date — work order creation)
- [ ] 04-02: Contractor dispatch (contractor selection from property KB + contractor database, quote generation, landlord approval workflow)
- [ ] 04-03: Work order follow-up and completion verification (automated follow-up scheduling via pg-boss, audit logging of all verification attempts)

### Phase 5: Arrears Chasing & Monitoring
**Goal**: The PM agent contacts tenants in rent arrears via outbound call/SMS/WhatsApp using hard-coded compliance rules (frequency limits, time-of-day restrictions, vulnerability escalation) — and staff have a dashboard to monitor all agent activity, review escalations, and track performance.
**Depends on**: Phase 4
**Requirements**: PM-06, PM-07, PM-08
**Success Criteria** (what must be TRUE):
  1. A tenant flagged as in arrears receives no more than one automated call and one automated message per 48-hour window, with no contact on Sundays or after 8pm — enforced by code constraints, not prompt instructions
  2. A payment commitment secured by the PM agent during an arrears call is logged to the audit trail with a follow-up task created in the CRM; a payment link is sent via the tenant's preferred channel
  3. After 3 unsuccessful automated arrears contacts, the case is automatically escalated to a human case manager with a full interaction history in the audit trail
  4. Staff can see a real-time dashboard of all agent conversations, escalation queue, per-agent action counts, and audit log entries — filterable by channel, agent type, and date range
**Plans**: TBD

Plans:
- [ ] 05-01: Arrears chasing agent (outbound calls/SMS/WhatsApp, hard-coded frequency limits, time-of-day enforcement, vulnerability keyword detection and immediate escalation)
- [ ] 05-02: Payment commitment capture and payment link dispatch (pg-boss scheduled follow-ups, Stripe/GoCardless link generation, audit logging)
- [ ] 05-03: Agent monitoring dashboard (React UI — conversation thread viewer, escalation queue, per-agent metrics, audit log, cost tracking)

### Phase 6: Cross-Agent Collaboration & Deal Lifecycle Automation

**Goal:** Agents collaborate across deal lifecycles -- when one specialist completes a stage (tenancy agreed, sale agreed, renewal due, tenancy ending), downstream agents are automatically triggered via an event bus, with a shared deal record, visual timeline, real-time notifications, and full staff override controls.
**Requirements**: DEAL-01, DEAL-02, DEAL-03, DEAL-04, DEAL-05, DEAL-06
**Depends on:** Phase 5
**Plans:** 4/4 plans complete

Plans:
- [ ] 06-01-PLAN.md — Schema (deals, deal_steps, deal_events, notifications tables), DealEventBus (pg-boss), DealPipelineService (coded pipeline templates with dependency resolution), DealService (CRUD)
- [ ] 06-02-PLAN.md — Deal REST API routes (CRUD, staff overrides: pause/skip/complete/cancel), SSE notification endpoint, notification CRUD
- [ ] 06-03-PLAN.md — Pipeline step action wiring (checklistService, messageSender integration), tenancy/sale event hooks, agent deal tools (emit events, read status, cross-referral, inconsistency detection)
- [ ] 06-04-PLAN.md — Deal list page, deal timeline page, notification bell component, property timeline widget, CRM sidebar and route wiring

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 6/6 | Complete   | 2026-03-19 |
| 2. Text-Channel Agents | 5/5 | Complete | 2026-03-20 |
| 3. Voice Integration | 2/3 | In Progress|  |
| 4. Property Management Specialist | 3/3 | Complete   | 2026-03-22 |
| 5. Arrears Chasing & Monitoring | 2/3 | In Progress|  |
| 6. Cross-Agent Collaboration | 4/4 | Complete   | 2026-03-24 |

### Phase 7: Agent Corrections & Cost Ledger

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 7 to break down)

### Phase 8: PM Finance Agent — Landlord Statements & Tenant Invoices

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 7
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 8 to break down)

### Phase 9: Head of Property Management Agent

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 8
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 9 to break down)

### Phase 10: Business Accounts Agent — Company-Wide Financials

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 9
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 10 to break down)

### Phase 11: Property Sourcing Agent — Market Intelligence & Owner Outreach

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 10
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd:plan-phase 11 to break down)
