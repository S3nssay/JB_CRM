# Phase 8: PM Finance Agent -- Landlord Statements & Tenant Invoices - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A PM Finance AI agent (Taylor) that autonomously generates monthly landlord statements and tenant rent invoices, handles payment reconciliation, and serves as a full conversational agent for finance queries from both tenants and landlords. Taylor operates on scheduled cron jobs and deal lifecycle events, integrating with the existing financial infrastructure.

</domain>

<decisions>
## Implementation Decisions

### Statement Generation
- Monthly auto-generation on 1st of each month for the previous month's activity
- One statement per property (not consolidated per landlord)
- Staff must explicitly approve each statement before it is sent to the landlord
- Properties with zero rent collected that month are flagged as 'attention needed' for staff review rather than auto-sending or skipping
- Branded PDF generated for each statement (John Barclay logo, purple/gold colours), attached to email and downloadable from CRM
- Line items include: rent collected, management fees deducted, maintenance/work order costs deducted, compliance costs (gas safety, EICR, EPC), VAT on fees
- Management fees calculated from letting service terms (lettingServiceTerms.ts fee schedules based on service level)
- Net payable calculated but actual landlord payment is manual by accounts staff -- Taylor does not trigger payments

### Tenant Invoicing
- Auto-generate monthly rent invoices for each active tenancy
- Invoices sent 7 days before rent due date
- Covers rent + service charges (where applicable for leasehold properties)
- Each invoice includes dual payment links: Stripe (card/Apple Pay/Google Pay) + GoCardless (direct debit) -- same pattern as Phase 5 arrears
- All tenants receive invoices including those on standing orders (consistent paper trail)
- Invoice delivered via email (branded PDF attachment) + WhatsApp notification with payment link
- Auto-reconcile incoming rent payments against outstanding invoices when payment arrives via Stripe/GoCardless webhooks or bank reconciliation
- No pre-due-date reminders -- invoice only. Overdue chasing is Chris's domain (Phase 5)

### Agent Autonomy & Triggers
- Dual trigger model: monthly pg-boss cron jobs for scheduled generation + deal events from Phase 6 (tenancy.agreed triggers first invoice, tenancy.ending triggers final statement)
- Tenant invoices sent automatically (routine, low risk)
- Landlord statements require staff approval before sending (higher stakes, financial commitments)
- Taylor is a full conversational agent registered in the Supervisor for routing

### Taylor as Conversational Agent
- Registered in SupervisorAgent for intent routing (finance/accounts queries)
- Tenant queries handled: invoice status, payment link requests, payment confirmation, receipt/proof-of-payment generation
- Landlord queries handled: statement queries, rent collection status, maintenance cost queries (from Phase 7 cost ledger), payment timing queries
- Transparent on payment timing: tells landlord truthfully that statement is with accounts team for review if not yet approved
- Queries Taylor cannot answer are escalated to human staff

### Landlord Communication
- Statements sent via email with branded PDF attachment only (no WhatsApp for statements)
- No real-time rent collection notifications to landlords -- rent collection appears on monthly statement
- No payment reminders to landlords -- staff handles payment timing

### Role Boundaries
- Taylor handles invoicing, statements, reconciliation, and finance queries
- Chris (Phase 5) handles arrears chasing and overdue rent outreach
- Morgan (Phase 4) handles maintenance intake and work orders
- Clear handoff: Taylor's invoice goes overdue -> Chris takes over chasing
- Taylor can query Phase 7 cost ledger data to answer landlord cost questions

### Claude's Discretion
- Invoice and statement PDF template design (layout, formatting)
- Service charge data model and sourcing (may need schema additions)
- Supervisor routing rules for Taylor (intent classification keywords)
- pg-boss cron job configuration and retry strategies
- Auto-reconciliation matching algorithm (exact match vs fuzzy)
- Tenant receipt/proof-of-payment PDF format
- Taylor's agent persona instructions and tone

</decisions>

<specifics>
## Specific Ideas

- Taylor should feel like a competent accounts person -- professional, precise with numbers, transparent about processes
- The invoice + WhatsApp notification pattern mirrors how modern letting agencies communicate -- formal document by email, friendly nudge by WhatsApp
- Standing order tenants still get invoices because the paper trail matters for accounting and legal purposes
- Landlord statements are the most important output -- they represent the agency's financial accountability to property owners
- Clean role separation between Taylor (proactive finance) and Chris (reactive arrears) prevents duplicate contacts

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `landlordStatements` table (schema.ts:6663): Full schema already exists with draft/approved/sent/paid workflow
- `statementLineItems` table (schema.ts:6691): Line item types already defined (rent_collected, management_fee, maintenance, etc.)
- `invoices` table (schema.ts:6583): Full invoice schema with tenant/property/landlord references
- `propertyTransactions` table (schema.ts:6710): P&L tracking per property for cost queries
- `financeRoutes.ts`: Existing invoice CRUD, statement CRUD, and payment routes
- `accountingRoutes.ts`: Business invoice and accounting routes
- `reconciliationEngine.ts`: Already handles payment-to-arrears reconciliation
- `lettingServiceTerms.ts`: Fee schedule data for management fee calculation
- `paymentService.ts`: Stripe payment link generation
- `gocardlessService.ts`: GoCardless payment collection
- `emailService.ts`: Email sending infrastructure
- `MessageSender` (agents/services/messageSender.ts): Multi-channel send from Phase 2
- Phase 6 DealEventBus: Event subscription for tenancy lifecycle triggers

### Established Patterns
- OpenAI Agents SDK with zod4 alias for tool schemas (Phase 2 pattern)
- Agent persona with first-name identity (Alex, Jordan, Morgan, Chris -> Taylor)
- Lazy pg-boss init in tool definitions (Phase 2-4 pattern)
- Raw SQL for financial aggregation queries (financeRoutes pattern)
- Supervisor handoff routing for specialist agents (Phase 2 pattern)
- Fire-and-forget async hooks from deal events (Phase 6 pattern)

### Integration Points
- SupervisorAgent: Register Taylor for finance/accounts intent routing
- DealEventBus: Subscribe to tenancy.agreed, tenancy.ending events
- pg-boss: Monthly cron jobs for invoice and statement generation
- Stripe/GoCardless webhooks: Trigger auto-reconciliation
- CRM sidebar (CRMLayout.tsx): Finance section links
- App.tsx: New routes for any Taylor-specific UI (BEFORE /crm catch-all)

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 08-pm-finance-agent-landlord-statements-tenant-invoices*
*Context gathered: 2026-03-26*
