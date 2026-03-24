# Phase 7: Agent Corrections & Cost Ledger - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove negotiation autonomy from Alex (Sales) and Jordan (Lettings) — they record offers and pass them to staff instead of negotiating independently. Add offer recording tools, staff offer management UI, and Morgan's (PM) cost ledger for tracking maintenance + compliance spend per property and per landlord.

</domain>

<decisions>
## Implementation Decisions

### Offer Recording Flow
- Agent captures offer details (amount, buyer/tenant name, contact, position) and writes to `propertyOffers` table
- Agent notifies assigned staff negotiator via in-CRM notification bell + email
- Agent confirms to buyer/tenant: neutral acknowledgement only — "Thank you, I've recorded your offer of £X and passed it to the team. They'll be in touch shortly."
- No commentary on competitiveness, likelihood, or vendor/landlord willingness
- Staff delivers accept/reject/counter decisions manually — agent is NOT involved after recording
- Staff handles all counter-offers entirely — no agent involvement in back-and-forth
- Alex proactively captures full buyer position: chain status, mortgage approval, solicitor details, proposed completion timeline — all saved to `propertyOffers`
- Jordan captures equivalent lettings details: employment status, references, move-in timeline

### Negotiation Guardrails
- Applies to BOTH Alex (Sales) AND Jordan (Lettings) — consistent approach
- Agents CAN share the listed/asking price and give general market context ("properties in this area typically go for...")
- Agents CANNOT comment on flexibility, willingness to negotiate, or what the vendor/landlord would accept
- When pushed for negotiation ("Would they take £X?"), agent encourages a formal offer: "I can't speak for the vendor/landlord on that, but I'd encourage you to put your offer forward and I'll make sure it's presented. Would you like to do that now?"
- No counter-offer delivery by agents — staff handles all negotiation communication

### PM Cost Ledger Scope
- Tracks maintenance costs (work order quotes, invoices, contractor payments) AND compliance costs (gas safety, EICR, EPC certification costs)
- Costs logged when actual invoice/payment is recorded — not estimated at booking time
- Cost summary visible on BOTH property detail page AND landlord detail page
- Property view: running total + category breakdown (maintenance vs compliance) + individual expense table
- Landlord view: total costs across all their properties, broken down per property
- Configurable spend thresholds per property — when breached, email sent to property manager (NOT in-CRM bell)
- Cost threshold alerts are email-only to keep the notification bell focused on deals and offers

### Staff Notification & Approval — Offers
- New offer triggers: in-CRM notification bell (Phase 6 system) + email to assigned agent/negotiator
- Notification email includes full details: offer amount, buyer name, position (cash/mortgage/chain), conditions, plus direct CRM link
- Offer management available in TWO places: offers section on property detail page + dedicated central offers dashboard
- Property page: list of all offers with status, buyer details, accept/reject/counter actions
- Offers dashboard: all active offers across all properties, filterable by property, status, date

### Claude's Discretion
- Offer notification email template design
- Offers dashboard layout and filter controls
- Cost ledger UI component design on property and landlord pages
- Cost threshold default values
- Cost category taxonomy (how to categorize different maintenance/compliance expenses)
- How to modify agent prompt instructions (exact wording for negotiation removal)

</decisions>

<specifics>
## Specific Ideas

- The offer flow should feel like a professional estate agency: agent takes the offer, presents it properly to the team, team handles the negotiation
- Market context is allowed because agents should still be knowledgeable and helpful — they just can't negotiate or advise on offers
- Cost ledger on both property and landlord views mirrors how a real PM company tracks spend — property managers check per-property, while accounts check per-landlord

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `propertyOffers` table (shared/schema.ts:586): Already has offerAmount, buyerName, buyerPosition, conditions, counterOfferAmount, status fields — can be used directly for offer recording
- `workOrders` table (shared/schema.ts:800): Has quotedAmount, invoiceAmount, invoiceNumber — core data for maintenance cost ledger
- `property_certifications` table: Has certification costs — core data for compliance cost ledger
- Phase 6 notification system: Bell + SSE stream — reuse for offer notifications
- `emailService.ts`: Email sending infrastructure — reuse for offer notification emails and cost threshold alerts
- `MessageSender` (agents/services/messageSender.ts): Multi-channel send from Phase 2

### Established Patterns
- Agent prompt instructions in `server/agents/sdk/salesAgent.ts` and `lettingsAgent.ts` — modify NEGOTIATION section
- Agent tools defined with zod4 schemas (Phase 2 pattern) — add `recordOffer` tool
- Raw SQL for aggregation queries (pmWorkflowRoutes pattern) — use for cost ledger summaries
- Phase 6 notification creation pattern — reuse for offer alerts

### Integration Points
- Sales agent prompt: Remove "full negotiation autonomy" from lines 134-139 of salesAgent.ts
- Lettings agent prompt: Remove "full negotiation autonomy" from lines 65-70 of lettingsAgent.ts
- Add `recordOffer` tool to both sales and lettings agent tool sets
- New offers dashboard page + route (App.tsx, before /crm catch-all)
- Property detail page: add offers section + cost ledger section
- Landlord detail page: add cost ledger section
- CRMLayout.tsx: add offers dashboard link

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-agent-corrections-cost-ledger*
*Context gathered: 2026-03-24*
