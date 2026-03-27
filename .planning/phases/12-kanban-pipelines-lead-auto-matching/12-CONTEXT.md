# Phase 12: Kanban Pipelines & Lead Auto-Matching - Context

**Gathered:** 2026-03-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Kanban pipeline views are the central navigation theme of the CRM. Every major workflow should have a visual kanban board. This phase extends the existing sales property pipeline to include valuation stages at the entry point, builds a new lettings property pipeline (also starting from valuation), adds type filtering to the landlord lead pipeline, and creates a lead auto-matching engine that flags buyer/renter leads when properties complete their pipelines.

</domain>

<decisions>
## Implementation Decisions

### Valuation as Pipeline Entry Point
- Every property listing (sale or letting) starts from a valuation enquiry
- Valuation is NOT a separate pipeline -- it's the first stages of the sales and lettings property pipelines
- The existing PropertyPipeline.tsx must be extended to add valuation stages at the front

### Sales Property Pipeline (Extended)
- Valuation Enquiry → Valuation Booked → Valuation Completed → Instruction Signed → Listed → Under Offer → SSTC → Exchanged → Completed
- Extends the existing PropertyPipeline.tsx which currently starts at "Available" (equivalent to "Listed")
- Fallen Through and Withdrawn remain as terminal states reachable from any active stage

### Lettings Property Pipeline (New)
- Valuation Enquiry → Valuation Booked → Valuation Completed → Instruction Signed → Listed → Viewings → Holding Deposit → Tenancy Agreed → Move-in Complete
- New page, separate from sales pipeline
- Different stages after "Listed" reflect the lettings process

### Landlord Lead Pipeline
- Already exists as LandlordLeadPipeline.tsx with 7 stages
- Needs a type filter to distinguish letting owners from selling owners
- Single shared pipeline, not two separate ones

### Separate Page Designs Per Workflow
- Each pipeline gets its own dedicated page design
- NOT a shared/reusable KanbanBoard component -- each page is purpose-built for its workflow
- This allows workflow-specific features, card designs, and actions per stage

### Lead Auto-Matching Engine
- When a property hits "Listed" in either sales or lettings pipeline, auto-flag matching buyer/renter leads
- Matching criteria: budget range, bedrooms, area/postcode, property type
- Both: flag the match in CRM AND auto-send property details to matched leads
- Auto-send requires staff approval first (flag immediately, send after approval)
- Buyer leads matched against sales pipeline properties
- Renter leads matched against lettings pipeline properties

### What's NOT In Scope
- Tenant onboarding kanban -- existing step-by-step wizard is sufficient
- Managed property onboarding pipeline -- not needed
- Separate valuation pipeline -- valuation is part of sales/lettings pipelines

### Claude's Discretion
- Exact card design and information density per kanban column
- How property status field maps to the extended pipeline stages (may need schema additions for valuation stages)
- Auto-match scoring algorithm (exact match vs fuzzy/weighted)
- Staff approval UI for auto-send (inline on match card vs separate approval queue)
- Whether to add new schema columns or reuse existing workflow fields for valuation tracking

</decisions>

<specifics>
## Specific Ideas

- The kanban theme should feel like the central operating console for the agency -- every workflow visible at a glance
- Valuation enquiries flowing into the property pipeline creates a complete lifecycle view from first contact to completion
- Auto-matching makes buyer/renter leads automatically valuable -- staff don't need to manually search for matches
- The approval gate on auto-send prevents unwanted spam while keeping the system proactive
- Landlord type filter on the shared pipeline avoids duplicating navigation and logic

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PropertyPipeline.tsx`: Existing 7-stage sales kanban with drag-and-drop, timeline tracking
- `LandlordLeadPipeline.tsx`: Existing 7-stage landlord lead kanban
- `SourcingDashboard.tsx`: Most recent kanban implementation with approval workflow pattern
- `shared/schema.ts` property status enum: `'active', 'under_offer', 'sstc', 'exchanged', 'completed', 'fallen_through', 'withdrawn'`
- Property workflow dates/agents fields (lines 190-209): `listedAt`, `underOfferAt`, `sstcAt`, etc.
- `leads` table: buyer/renter leads with `budget_min`, `budget_max`, `lead_type`, `property_interest_ids`
- `properties` table: `is_listed_sale`, `is_listed_rental`, `bedrooms`, `price`, `rent_amount`, `postcode`

### Integration Points
- CRMLayout.tsx: sidebar navigation -- add lettings pipeline link, update sales pipeline section
- App.tsx: route registration (before /crm catch-all per wouter rules)
- Property status enum in schema.ts may need extending for valuation stages
- `crmRoutes.ts` or new route file for auto-match endpoints
- Email/WhatsApp via existing agent infrastructure for auto-send

### Established Patterns
- Kanban pages use TanStack Query for data fetching
- Status changes via useMutation with optimistic updates
- Shadcn/ui cards within column containers
- Brand colours: Purple (#791E75) and Gold (#F8B324)

</code_context>

<deferred>
## Deferred Ideas

None

</deferred>

---

*Phase: 12-kanban-pipelines-lead-auto-matching*
*Context gathered: 2026-03-27*
