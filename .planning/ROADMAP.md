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
- [x] **Phase 3: Voice Integration** - Voice AI (Vapi) answering inbound calls 24/7 with specialist routing (completed 2026-03-27)
- [x] **Phase 4: Property Management Specialist** - Maintenance intake, contractor dispatch, work order management (completed 2026-03-22)
- [x] **Phase 5: Arrears Chasing & Monitoring** - Compliant rent arrears outreach and staff agent monitoring dashboard (completed 2026-03-27)

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
**Plans:** 3/3 plans complete

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
| 3. Voice Integration | 2/3 | Complete    | 2026-03-27 |
| 4. Property Management Specialist | 3/3 | Complete   | 2026-03-22 |
| 5. Arrears Chasing & Monitoring | 2/3 | Complete    | 2026-03-27 |
| 6. Cross-Agent Collaboration | 4/4 | Complete   | 2026-03-24 |

### Phase 7: Agent Corrections & Cost Ledger

**Goal:** Remove negotiation autonomy from Sales (Alex) and Lettings (Jordan) agents, replacing it with professional offer recording. Add offer management UI for staff. Add PM cost ledger tracking maintenance and compliance spend per property and per landlord with configurable threshold alerts.
**Requirements**: CORR-01, CORR-02, CORR-03, CORR-04, COST-01, COST-02, COST-03, OFFER-UI, COST-UI
**Depends on:** Phase 6
**Plans:** 6 plans (4 complete + 2 gap closure)

Plans:
- [ ] 07-01-PLAN.md — Schema extensions (lettings offer fields, certification cost, cost thresholds), agent prompt corrections (remove negotiation, add OFFERS section), recordOffer tool
- [ ] 07-02-PLAN.md — Offer management REST API (CRUD, accept/reject/counter), notification bell + email triggers for new offers
- [ ] 07-03-PLAN.md — Cost ledger API (per-property and per-landlord aggregation from work orders + certifications), threshold management with email alerts
- [ ] 07-04-PLAN.md — Offers dashboard page, offers section on property page, cost ledger component on property + landlord pages, CRM sidebar and route wiring

### Phase 8: PM Finance Agent — Landlord Statements & Tenant Invoices

**Goal:** Taylor, a PM Finance AI agent, autonomously generates monthly per-property landlord statements (staff-approved before sending) and tenant rent invoices (7 days before due, auto-sent with dual payment links), handles payment auto-reconciliation, and serves as a conversational agent for finance queries from tenants and landlords via Supervisor routing.
**Requirements**: FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07, FIN-08, FIN-09, FIN-10
**Depends on:** Phase 7
**Plans:** 6 plans (4 complete + 2 gap closure)

Plans:
- [ ] 08-01-PLAN.md — Schema fix (propertyId on landlordStatements), financeAgentService (statement aggregation, invoice generation, management fee calculation), pdfService (branded PDF generation), Wave 0 test stubs
- [ ] 08-02-PLAN.md — Taylor agent definition (persona, finance tools), Supervisor registration with finance routing, pg-boss cron jobs (monthly statements, daily invoices), deal event hooks (tenancy.agreed/ending triggers)
- [ ] 08-03-PLAN.md — Finance API routes (statement approval workflow, invoice listing, manual triggers), auto-reconciliation wiring for Taylor-generated invoices
- [ ] 08-04-PLAN.md — Pending Statements approval page, Tenant Invoices page, CRM sidebar Finance section, App.tsx routing
- [ ] 08-05-PLAN.md — Gap closure: missing lifecycle trigger functions (generateFirstInvoiceForTenancy, generateFinalStatement), fix TenantInvoices endpoint, remove duplicate approve route
- [ ] 08-06-PLAN.md — Gap closure: add FIN-01..FIN-10 and Phase 6-10 requirement definitions to REQUIREMENTS.md

### Phase 9: Head of Property Management Agent

**Goal:** Jamie, the Head of Property Management agent, provides a supervisory coordination layer over Morgan (maintenance), Sarah (arrears), Sam (admin), and Taylor (finance) -- offering cross-domain portfolio awareness, proactive compliance monitoring with daily certification expiry checks, portfolio health scoring, and a landlord-facing conversational interface for portfolio-level questions.
**Requirements**: HPM-01, HPM-02, HPM-03, HPM-04, HPM-05, HPM-06, HPM-07, HPM-08
**Depends on:** Phase 8
**Plans:** 3/3 plans complete

Plans:
- [ ] 09-01-PLAN.md — Head of PM agent (Jamie) definition with cross-domain portfolio query tools (7 tools), specialist handoffs to Morgan/Sarah/Sam/Taylor, Supervisor registration
- [ ] 09-02-PLAN.md — Proactive portfolio monitoring service (pg-boss cron: daily compliance check, weekly health report), email alerting, server startup wiring
- [ ] 09-03-PLAN.md — PM overview API routes (compliance alerts, portfolio health scores, agent activity), enhanced PM tracking dashboard with new widgets

### Phase 10: Business Accounts Agent — Company-Wide Financials

**Goal:** Riley, a Business Accounts AI agent, provides conversational access to company-wide financials (P&L, balance sheet, VAT returns, cash position, aged debtors/creditors, financial periods) for staff, and automates recurring accounting tasks (recurring invoice generation, commission journal entries on deal completion, period close reminders, VAT quarter-end reminders).
**Requirements**: BIZ-01, BIZ-02, BIZ-03, BIZ-04, BIZ-05, BIZ-06, BIZ-07, BIZ-08, BIZ-09
**Depends on:** Phase 9
**Plans:** 2/2 plans complete

Plans:
- [ ] 10-01-PLAN.md — Shared accounting queries module, Riley agent definition with 12 financial tools, Supervisor registration with finance routing, unit tests
- [ ] 10-02-PLAN.md — pg-boss cron automation (recurring invoices, period close reminders, VAT quarter checks), auto-journal-entry creation from deal events (commission income, letting fees)

### Phase 11: Property Sourcing Agent — Market Intelligence & Owner Outreach

**Goal:** Charlie ("The Networker"), a property sourcing AI agent, proactively monitors market intelligence sources (Land Registry, stale listings, auctions, planning apps, competitor expirations), scores leads by propensity to instruct, drafts source-specific outreach (letters + emails) for staff approval, manages multi-touch follow-up sequences, handles inbound owner responses via Supervisor routing, and provides a CRM dashboard for pipeline management, outreach approvals, campaign configuration, and performance metrics.
**Requirements**: SRC-01, SRC-02, SRC-03, SRC-04, SRC-05, SRC-06, SRC-07, SRC-08, SRC-09, SRC-10, SRC-11, SRC-12, SRC-13, SRC-14
**Depends on:** Phase 10
**Success Criteria** (what must be TRUE):
  1. Charlie agent registers with both BaseAgent system and Supervisor SDK, handling inbound owner responses ("I got your letter") via conversational routing
  2. pg-boss cron jobs run daily market scans, weekly propensity scoring, and daily follow-up checks -- replacing all setInterval scheduling
  3. Staff can view a sourcing pipeline with leads flowing through stages (new -> scored -> draft ready -> awaiting approval -> sent -> responded -> valuation booked -> instructed)
  4. All outreach (letter + email) requires explicit staff approval before sending -- Charlie drafts, staff approve
  5. Source-specific AI-generated outreach uses appropriate tone per lead type (sensitive for probate, competitive for stale listings, welcoming for new purchases)
  6. Follow-up sequences advance automatically (letter -> email 7d -> letter 21d) with each touchpoint requiring staff approval
  7. Staff can create/edit monitoring campaigns targeting specific postcodes, price ranges, and property types
  8. Performance metrics show leads sourced, outreach sent, response rate, and valuations booked -- broken down by source
**Plans:** 1/4 plans executed

Plans:
- [x] 11-01-PLAN.md -- Schema extensions (approval fields on lead_contact_history), SourcingAgent classes (BaseAgent + SDK), Supervisor registration, pg-boss cron jobs, deal event bus VALUATION_BOOKED event, server startup wiring
- [ ] 11-02-PLAN.md -- Outreach drafting service (AI source-specific templates), letter PDF generation (extend pdfService), email sending via emailService, staff approval workflow, follow-up sequence management
- [ ] 11-03-PLAN.md -- REST API routes for sourcing dashboard (pipeline leads, approval actions, campaign CRUD, metrics aggregation, manual monitor triggers), route mounting
- [ ] 11-04-PLAN.md -- SourcingDashboard page (stats row, Pipeline tab with kanban + approval, Campaigns tab with CRUD, Performance tab with source breakdown + funnel chart), CRM sidebar link, App.tsx routing
