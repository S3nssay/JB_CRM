# Phase 6: Cross-Agent Collaboration & Deal Lifecycle Automation - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire up inter-agent workflows so that when one specialist completes a stage (lettings agrees a tenancy, sales agrees a sale, tenancy approaches renewal, tenancy ends), downstream agents are automatically triggered to handle their part — contracts, onboarding, inspections, relisting — without human intervention. Includes a shared deal record, event bus, deal timeline UI, in-CRM notifications, and staff override controls.

</domain>

<decisions>
## Implementation Decisions

### Deal Lifecycle Triggers — Lettings

- **Tenancy agreed (tenant found, rent agreed):** Full auto pipeline — Admin auto-generates AST contract, deposit registration task, inventory report request, Right to Rent check. PM gets notified to schedule check-in inspection and sends tenant a welcome message with property-specific info (emergency contacts, bin day, parking, entry codes from knowledge base) plus 2-week check-in scheduled
- **Tenancy ending:** Admin triggers offboarding checklist + deposit return process. PM triggers checkout inspection + property condition report. Lettings auto-relists property if landlord preference allows
- **Lease approaching renewal (3 months before end):** Lettings agent contacts tenant to discuss renewal. If agreed, Admin generates new AST. If not renewing, triggers the tenancy-ending pipeline
- **Rent review due (annual):** Lettings agent does market comparison, proposes increase to landlord, then communicates to tenant. Admin generates Section 13 notice if needed

### Deal Lifecycle Triggers — Sales

- **Sale agreed (offer accepted):** Full auto pipeline — Admin auto-generates sales memorandum, sends to solicitors on both sides, creates compliance checklist (AML, ID verification). Lettings agent notified if property was also listed for rent (to delist)
- **Sale falls through:** Sales agent auto-relists property, notifies previous interested buyers from lead pipeline ("The property at X is back on the market"), Admin cancels in-progress memorandum/compliance tasks

### Agent-to-Agent Task Flow

- **Event bus architecture:** Agents emit domain events ('tenancy.agreed', 'sale.collapsed', 'tenancy.ending', 'lease.renewal_due', 'rent_review.due'). Other agents subscribe to events they care about. Uses pg-boss as event transport (already in use across Phases 2-4). Decoupled — adding new triggers doesn't require changing the emitting agent
- **Shared deal record:** A 'deal' or 'transaction' record tracks the overall lifecycle. Each agent reads/writes their status to it. Agents can check what other agents have done before acting
- **Defined dependencies:** Each deal type has a defined step order. Tasks only fire when their prerequisites are met (e.g., contract generation waits for Right to Rent check to pass)
- **Independent parallel work:** Where no dependency exists, agents work in parallel. They read the shared deal record for context but don't wait for each other unnecessarily
- **Staff-configurable steps:** Staff can toggle optional steps on/off per deal. Pipeline order stays fixed in code per deal type
- **Failure handling:** When an agent's task fails (e.g., incomplete tenant data), the originating agent is asked to collect the missing info from the contact. The deal pauses until resolved
- **Timeouts:** After 48hrs with no response, the deal step escalates to human staff. Staff can chase manually or override to continue the pipeline
- **Cross-referral:** Agents can emit cross-referral events. Lettings can flag a sales opportunity, PM can flag a lettings opportunity if tenant leaves, etc. Auto-creates leads in the relevant department

### Handover Data & Context

- **Full conversation data flow:** All details captured during agent conversations (tenant details, agreed terms, special conditions, solicitor info) flow automatically to downstream agents. Admin never needs to re-ask the tenant for info lettings already captured
- **Auto-save to CRM:** When agents capture structured data during conversations (employer, references, agreed rent, etc.), these are automatically written to the relevant CRM records (tenant, tenancy, property). Downstream agents and staff both see it in the CRM
- **PM welcome context:** PM reads property knowledge base (heating system, emergency contacts, bin collection day, parking info) plus tenancy details (move-in date, rent amount, deposit scheme) for comprehensive tenant welcome messages
- **Sales-to-Admin data:** Full deal context flows — agreed price, buyer details, solicitor details, any conditions (chain-free, subject to survey), fixtures/fittings discussed, completion timeline. All from conversation
- **Cross-agent conversation access:** Any agent can query the full conversation history for a contact across all agent types. Admin can read what lettings discussed. Full context sharing
- **Inconsistency detection:** Agents compare incoming info against existing CRM data and prior conversations. Discrepancies are flagged to staff with both data points (e.g., tenant told lettings no pets but PM conversation mentions a cat)

### Staff Visibility & Override

- **Visual deal timeline:** Each deal has a timeline page showing every agent action in order (lettings agreed rent, admin generated contract, PM scheduled inspection). Staff can see progress at a glance
- **Navigation:** Dedicated top-level 'Deals' section with list of all active deals and their pipelines, PLUS timeline widget on property detail page for quick access
- **Full staff control:** Staff can pause the pipeline, skip steps, manually complete steps, reassign to a different agent, or cancel the entire deal. All actions logged to audit trail
- **In-CRM notifications:** Notification bell/badge in the CRM header. Staff see pipeline events for deals they're involved in. Click to jump to the deal timeline

### Claude's Discretion

- Event naming conventions and pg-boss queue structure
- Deal record schema design (tables, columns, relationships)
- Dependency graph representation in code
- Timeline UI component design and layout
- Notification system implementation (polling vs WebSocket vs SSE)
- Cross-agent conversation query API design
- Inconsistency detection algorithm and thresholds

</decisions>

<specifics>
## Specific Ideas

- The agents should work together like a real estate agency team — when one person finishes their part, the next person automatically picks up theirs
- The lettings-to-admin-to-PM pipeline should feel seamless: tenant agrees rent → contract appears → inspection scheduled → welcome message sent — all without staff intervention
- Cross-referral between departments mirrors how good estate agents naturally spot opportunities ("Your landlord mentioned they might sell — shall I pass them to our sales team?")
- Staff should feel in control despite the automation — they can see everything happening and intervene at any point

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tenancyEventHooks.ts`: Fire-and-forget event pattern (Phase 2) — extend this pattern to all lifecycle events
- `pg-boss`: Already used in 5 files for scheduled messages, work order follow-ups, escalation follow-ups — natural fit for event bus
- `ConversationStore` (channels/conversationStore.ts): Already stores all conversations — can be queried cross-agent
- `AuditLogger` (middleware/auditLogger.ts): All agent actions already logged — timeline can read from this
- `EscalationService` (services/escalationService.ts): Round-robin staff assignment — reuse for timeout escalations
- `MessageSender` (services/messageSender.ts): Multi-channel send — reuse for notifications and agent-to-contact messages
- `ChecklistService` (services/checklistService.ts): Generates onboarding/offboarding checklists — integrate into deal pipeline
- `SupervisorAgent` with handoff(): Conversation routing already works — extend with event emission on deal-stage changes

### Established Patterns
- OpenAI Agents SDK with handoff() for conversation routing (Phase 2)
- Fire-and-forget async hooks from routes (tenancyEventHooks pattern)
- Lazy pg-boss init in tool definitions (Phase 2-4 pattern)
- Raw SQL for complex cross-table queries (pmWorkflowRoutes pattern)

### Integration Points
- Agent tools: Each specialist needs new tools to emit deal events and read deal records
- Routes: New deal/transaction routes for CRUD + timeline data
- CRM pages: New Deals section + property page timeline widget + notification component
- App.tsx: New routes (BEFORE /crm catch-all per wouter rules)
- CRMLayout.tsx: New sidebar section for Deals

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-cross-agent-collaboration-deal-lifecycle-automation*
*Context gathered: 2026-03-24*
