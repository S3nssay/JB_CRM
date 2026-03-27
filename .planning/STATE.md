---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed 12-01-PLAN.md
last_updated: "2026-03-27T21:03:20.264Z"
last_activity: 2026-03-27
progress:
  total_phases: 12
  completed_phases: 11
  total_plans: 46
  completed_plans: 44
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-19)

**Core value:** AI agents handle real inbound communications autonomously — answering questions, booking viewings, managing maintenance, chasing arrears — so the human team focuses on high-value work.
**Current focus:** Phase 12 — kanban-pipelines-lead-auto-matching

## Current Position

Phase: 12 (kanban-pipelines-lead-auto-matching) — EXECUTING
Plan: 2 of 3
Status: Ready to execute
Last activity: 2026-03-27

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 22
- Average duration: ~6 min
- Total execution time: ~118 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6 | 33min | 5.5min |
| 02 | 5 | 43min | 8.6min |
| 03 | 3 | 28min | 9.3min |

| 04 | 3 | 16min | 5.3min |

| 05 | 3 | 26min | 8.7min |

**Recent Trend:**

- Last 5 plans: 5min, 7min, 5min, 12min, 7min
- Trend: Phase 5 arrears monitoring complete

*Updated after each plan completion*
| Phase 01 P01 | 7min | 2 tasks | 11 files |
| Phase 01 P02 | 8min | 2 tasks | 10 files |
| Phase 01 P03 | 6min | 2 tasks | 9 files |
| Phase 01 P04 | 5min | 3 tasks | 6 files |
| Phase 01 P05 | 5min | 3 tasks | 4 files |
| Phase 01 P06 | 2min | 1 tasks | 1 files |
| Phase 02 P01 | 22min | 2 tasks | 16 files |
| Phase 02 P02 | 4min | 2 tasks | 4 files |
| Phase 02 P03 | 3min | 2 tasks | 4 files |
| Phase 02 P04 | 9min | 3 tasks | 10 files |
| Phase 02 P05 | 5min | 2 tasks | 6 files |
| Phase 03 P01 | 12min | 2 tasks | 4 files |
| Phase 03 P02 | 9min | 2 tasks | 5 files |
| Phase 03 P03 | 7min | 2 tasks | 5 files |
| Phase 04 P01 | 3min | 2 tasks | 9 files |
| Phase 04 P02 | 8min | 2 tasks | 9 files |
| Phase 04 P03 | 5min | 2 tasks | 6 files |
| Phase 05 P01 | 7min | 2 tasks | 8 files |
| Phase 05 P02 | 12min | 2 tasks | 7 files |
| Phase 05 P03 | 7min | 2 tasks | 6 files |
| Phase 06 P01 | 8min | 2 tasks | 8 files |
| Phase 06 P03 | 10min | 2 tasks | 14 files |
| Phase 06 P02 | 4min | 2 tasks | 4 files |
| Phase 06 P04 | 5min | 3 tasks | 8 files |
| Phase 07 P01 | 8min | 2 tasks | 5 files |
| Phase 07 P02 | 8min | 2 tasks | 3 files |
| Phase 07 P03 | 5min | 2 tasks | 3 files |
| Phase 07 P04 | 9min | 2 tasks | 7 files |
| Phase 09 P02 | 7min | 2 tasks | 3 files |
| Phase 08 P02 | 9min | 2 tasks | 6 files |
| Phase 08 P01 | 12min | 2 tasks | 5 files |
| Phase 10 P01 | 12 | 2 tasks | 4 files |
| Phase 09 P03 | 7min | 2 tasks | 4 files |
| Phase 10 P02 | 8min | 2 tasks | 5 files |
| Phase 09 P01 | 12 | 2 tasks | 4 files |
| Phase 08 P03 | 15min | 2 tasks | 4 files |
| Phase 08 P04 | 8min | 3 tasks | 4 files |
| Phase 11 P01 | 10min | 2 tasks | 10 files |
| Phase 11 P02 | 15min | 2 tasks | 5 files |
| Phase 08 P06 | 3min | 1 tasks | 1 files |
| Phase 08 P05 | 8min | 2 tasks | 3 files |
| Phase 11 P03 | 10min | 2 tasks | 3 files |
| Phase 11 P03 | 8min | 2 tasks | 3 files |
| Phase 11 P02 | 8min | 2 tasks | 5 files |
| Phase 11 P04 | 10min | 2 tasks | 3 files |
| Phase 11 P04 | 14min | 2 tasks | 3 files |
| Phase 12 P01 | 5min | 2 tasks | 3 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Roadmap]: Build property knowledge base before AI agents — agents need property context to answer intelligently
- [Roadmap]: Voice (Phase 3) after text-channel agents (Phase 2) — voice compounds every failure mode; text agents must be battle-tested first
- [Roadmap]: Arrears chasing deferred to Phase 5 — compliance requirements (harassment law, vulnerability protocols) need proven audit infrastructure from earlier phases
- [Research]: Use Vapi for voice (Squads maps to receptionist-to-specialist routing); switch from Retell has zero cost (existing voiceAgentService.ts is fully mocked)
- [Research]: Use OpenAI Agents SDK for text channels; pgvector on existing Supabase for knowledge base — no new infrastructure needed
- [Phase 01]: Used decimal instead of numeric for confidence field (project convention)
- [Phase 01]: Used direct SQL for schema push instead of db:push (interactive)
- [Phase 01-02]: Used raw SQL for cross-table CRM contact search (more efficient than 3 separate Drizzle queries)
- [Phase 01-02]: WhatsApp identifiers stored as phone type in contact_identity (same phone resolves across channels)
- [Phase 01-03]: Used z.any() for date output fields in tool schemas (Drizzle returns Date objects)
- [Phase 01-03]: Mapped plan priority values to schema urgency values in createMaintenanceTicket
- [Phase 01-03]: Used actual schema leadType values instead of plan's proposed values
- [Phase 01-04]: Confidence stored as string (decimal to string conversion) matching Drizzle decimal column
- [Phase 01-04]: Sensitive field redaction uses regex pattern matching on key names
- [Phase 01]: Read-only certifications/maintenance in KB page; CRUD only for systems inventory
- [Phase 01]: Moved /crm catch-all to after ALL CRM routes (not just knowledge-base) to fix all unreachable routes
- [Phase 02-01]: Used zod4 npm alias for SDK tool parameters (agents SDK requires zod v4, project uses zod v3)
- [Phase 02-01]: Added postinstall script for zod resolution fix in dependency chain
- [Phase 02-01]: Webhooks return 200 immediately, process asynchronously (Twilio timeout protection)
- [Phase 02-01]: Per-conversation Map-based locking prevents race conditions
- [Phase 02-01]: STOP keyword detection at webhook level (UK PECR compliance)
- [Phase 02-01]: Round-robin escalation uses module-level Map counters per department
- [Phase 02-02]: Full negotiation autonomy for Sales agent -- no floor/ceiling restrictions
- [Phase 02-02]: Lazy pg-boss init in scheduleFollowUpTool to avoid DB connection at module load
- [Phase 02-02]: Specialist agent pattern: persona instructions + domain tools + follow-up scheduling tool
- [Phase 02-03]: Reused scheduleFollowUpTool from Sales (import, not duplication) for Lettings agent
- [Phase 02-03]: Full negotiation autonomy for Lettings agent, same as Sales
- [Phase 02-04]: Fire-and-forget event hooks for tenancy lifecycle: route responds first, checklist generation async
- [Phase 02-04]: Dual-write: left existing hardcoded checklist insertion alongside new checklistService for safety
- [Phase 02-04]: Chase escalation count tracked via audit log query filtering by toolInput metadata
- [Phase 02-05]: Opt-out stored on contact_identity table (opted_out + opted_out_at columns) rather than separate table
- [Phase 02-05]: STOP keyword in webhooks now sets opt-out flag in addition to blocking agent processing
- [Phase 03-01]: gpt-4o-mini for receptionist (fast routing), gpt-4o for specialists (reasoning for property matching)
- [Phase 03-01]: ElevenLabs rachel voice for all assistants (consistent British female voice across squad)
- [Phase 03-01]: Receptionist has no CRM tools -- only routes via squad handoff destinations
- [Phase 03-01]: All CRM tools have filler speech messages (request-start) for natural call experience
- [Phase 03-02]: Always return HTTP 200 from Vapi webhooks -- errors encoded as strings in result field (Vapi protocol requirement)
- [Phase 03-02]: Call context stored in module-level Map keyed by Vapi call ID rather than overriding assistant config
- [Phase 03-02]: Created voice/types.ts as blocking dependency from Plan 03-01 (not yet executed)
- [Phase 03-03]: Transfer detection uses dual approach: endedReason field + transcript regex scan
- [Phase 03-03]: Post-call actions are fire-and-forget via async IIFE after webhook 200 response
- [Phase 03-03]: VoiceAdapter registered as 'phone' channel in ChannelGateway constructor
- [Phase 04-01]: Pure function classifyUrgency takes date parameter for winter/summer testability
- [Phase 04-01]: Combined classifyAndCreateTicketTool wraps rules engine + ticket creation in single tool call
- [Phase 04-01]: Winter defined as October-March for heating emergency escalation
- [Phase 04-02]: Raw SQL for contractor search (flexible array filtering with ANY/unnest)
- [Phase 04-02]: JS-side sorting for preferred+rating ranking (simpler than complex SQL ORDER BY)
- [Phase 04-02]: Emergency auto-approve updates quote status and audit-logs bypass via auditLogger
- [Phase 04-02]: WO number generation uses MAX query on today's date prefix for sequential numbering
- [Phase 04-03]: Urgency-based follow-up intervals: emergency=24h, urgent=48h, routine=72h, low=96h
- [Phase 04-03]: MAX_FOLLOWUP_ATTEMPTS=2 before escalation; completion check max 3 rechecks at 24h intervals
- [Phase 04-03]: Lazy import for workOrderFollowupService in tool definition (avoid DB at module load)
- [Phase 05-01]: Compliance rules enforced in code (ArrearsComplianceGuard), not LLM prompts -- LLM cannot bypass contact limits
- [Phase 05-01]: Vulnerability detection uses regex keyword matching by category (financial, mental_health, health, domestic, bereavement)
- [Phase 05-01]: 48-hour contact window per-type: messages share one window, phone_call has separate window
- [Phase 05-01]: UK time enforcement uses Intl.DateTimeFormat with Europe/London timezone for DST-aware checks
- [Phase 05-01]: Lazy imports for arrearsComplianceGuard and messageSender in tools.ts (avoid circular deps)
- [Phase 05-02]: Auto-detect payment method: GoCardless for existing mandates, Stripe links for one-off
- [Phase 05-02]: 3 follow-up attempt limit before mandatory human escalation
- [Phase 05-02]: Payment verification window: commitDate -1 day to +3 days for processing delays
- [Phase 05-03]: Raw SQL for monitoring queries (flexible aggregation, LATERAL joins for escalation reason)
- [Phase 05-03]: Exported query functions for testability without HTTP layer
- [Phase 06]: Pipeline templates defined as code constants, not database-stored
- [Phase 06]: dependsOn stored as JSON string in text column for step dependency tracking
- [Phase 06]: sourceEventId in deal event payloads prevents circular event loops
- [Phase 06-03]: Step actions implemented as STEP_ACTIONS record mapping stepId to async functions
- [Phase 06-03]: Cross-referral creates real lead records in leads table with source='referral'
- [Phase 06-03]: Daily tenancy check uses SQL date arithmetic for anniversary detection (rent review) and interval comparison (lease renewal)
- [Phase 06-02]: Exported routeHandlers object for direct unit testing without HTTP supertest
- [Phase 06-02]: SSE heartbeat at 30s interval with dead-connection cleanup on write errors
- [Phase 06]: SSE EventSource with withCredentials for session-based auth on notification stream
- [Phase 07-01]: recordOfferTool uses raw SQL pool.query consistent with emitCrossReferralTool pattern
- [Phase 07-01]: Notification falls back to first admin user when property has no assigned agent
- [Phase 07-01]: Mocked SDK tool() in tests to avoid zod4 validation errors at import time
- [Phase 07-02]: Static analysis tests for CORR-03/CORR-04 (verify code paths without DB)
- [Phase 07-02]: Non-blocking email: offer created even if email dispatch fails
- [Phase 07]: Email-only threshold alerts per user decision (not in-CRM notification bell)
- [Phase 07]: Offers nav link placed in Deals section of sidebar for logical grouping
- [Phase 07]: CostLedger uses dual mode prop (property/landlord) rather than separate components
- [Phase 09]: Used property_certification table for compliance queries (richer schema with reminder tracking)
- [Phase 09]: Health score formula: 100 base, -20 expired cert, -10 expiring, -5 open ticket, -15 active arrears, -25 vacant
- [Phase 08]: Lazy imports for all pool/service dependencies in finance tools (consistent with existing agent patterns)
- [Phase 08]: Finance cron dual-trigger: pg-boss cron for scheduled generation + deal event subscriptions for lifecycle triggers
- [Phase 08]: Invoice numbers scoped by tenancyId (not propertyId) to avoid UNIQUE constraint violations on multi-tenancy properties
- [Phase 08]: Let-only returns zero monthly fee (upfront fee type, no monthly deduction); VAT at 20% on management fees
- [Phase 10]: [Phase 10-01]: Extracted shared accountingQueries module from route patterns for agent tool reuse
- [Phase 10]: [Phase 10-01]: Clear domain boundary: Riley for company-wide financials, Taylor for tenant/landlord finance
- [Phase 10]: [Phase 10-02]: Account codes corrected: 4020=Sales Commission Income, 4010=Letting Fee Income (matching chart_of_accounts seed)
- [Phase 10]: [Phase 10-02]: Added SALE_COMPLETED to dealEventBus; commission triggers on completion not just agreement
- [Phase 10]: [Phase 10-02]: Fire-and-forget event handlers with zero-amount guard for journal entry creation
- [Phase 09]: Static source analysis for agent tests (avoids timeout from deep import chains)
- [Phase 09]: Taylor/finance handoff commented out pending Phase 8 financeAgent creation
- [Phase 09]: Supervisory agent pattern: query tools for read-only insights, handoffs for operational delegation
- [Phase 08]: [Phase 08-03]: Webhook-to-reconciliation pipeline: Stripe uses metadata.invoice_number, GoCardless uses regex fallback on description
- [Phase 11]: Dual registration: BaseAgent for legacy orchestrator + SDK Agent for Supervisor routing
- [Phase 11]: Static analysis tests for agent wiring (no DB needed)
- [Phase 11]: Source-specific prompt builder as pure function mapping lead_source to OpenAI prompts
- [Phase 11]: gpt-4o-mini for outreach drafting (high volume, cost efficiency)
- [Phase 11]: Default follow-up sequence: letter(day 0) -> email(day 7) -> letter(day 21)
- [Phase 08]: Corrected Phase 6-10 requirement count from 38 to 42 (6+9+10+8+9=42); grand total 81 requirements
- [Phase 08]: Final statements always set attention_needed=true for mandatory staff review
- [Phase 08]: First invoice due date: tenancy start_date if future, otherwise 1st of next month
- [Phase 11]: Lazy imports for cross-plan service dependencies (Plan 02 artifacts) in sourcingRoutes handlers
- [Phase 11]: Raw SQL COUNT FILTER for metrics aggregation (more efficient than Drizzle for analytics)
- [Phase 11]: Lazy imports for Plan 02 services (sourcingApprovalService, sourcingOutreachService) to avoid import-time dependency on parallel plan artifacts
- [Phase 11]: gpt-4o-mini for outreach drafting (cost efficiency at high volume)
- [Phase 11]: Default follow-up sequence: letter(day 0) -> email(day 7) -> letter(day 21)
- [Phase 11]: All sub-components in single SourcingDashboard file for cohesion
- [Phase 11]: UI stage names mapped to API status values with approval-based split for contacted leads
- [Phase 12]: Lazy import for leadMatchingService in PATCH handler (consistent with project convention)
- [Phase 12]: Pipeline stage dual-write: update both status (legacy) and pipeline_stage (new kanban) for backward compat
- [Phase 12]: Budget/bedrooms/area/type scoring weights: 40/25/25/10 with threshold >= 50

### Roadmap Evolution

- Phase 6 added: Cross-Agent Collaboration & Deal Lifecycle Automation
- Phase 7 added: Agent Corrections & Cost Ledger (remove negotiation autonomy from Alex/Jordan, add offer recording, Morgan cost ledger)
- Phase 8 added: PM Finance Agent — Landlord Statements & Tenant Invoices (Taylor)
- Phase 9 added: Head of Property Management Agent (delegation layer over Morgan/Sarah/Taylor)
- Phase 10 added: Business Accounts Agent — Company-Wide Financials (Riley)
- Phase 11 added: Property Sourcing Agent — Market Intelligence & Owner Outreach (Casey)

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 3]: Vapi UK telephony configuration (Twilio SIP/webhook forwarding for UK number) needs hands-on testing — exact configuration unverified. Validate during Phase 3 planning.
- [Phase 5]: Arrears chasing compliance rules (UK Pre-Action Protocol, FCA vulnerability guidance) need professional legal review before Phase 5 planning. Research flags this as a gap.

## Session Continuity

Last session: 2026-03-27T21:03:20.243Z
Stopped at: Completed 12-01-PLAN.md
Resume file: None
