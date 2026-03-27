# Phase 12: Kanban Pipelines & Lead Auto-Matching - Research

**Researched:** 2026-03-27
**Domain:** CRM kanban pipeline UI, property status workflow, lead matching engine
**Confidence:** HIGH

## Summary

Phase 12 extends the CRM's existing kanban pipeline infrastructure with two major changes: (1) extending property pipelines to cover the full lifecycle from valuation enquiry to completion/move-in, and (2) building an automated lead-property matching engine triggered when properties reach "Listed" status. The existing codebase provides strong foundations -- `PropertyPipeline.tsx` already implements a 7-stage sales kanban with status updates, and `LandlordLeadPipeline.tsx` handles a 7-stage landlord lead workflow. Both use raw SQL queries in `crmRoutes.ts`, TanStack Query for data fetching, and shadcn/ui Cards within scrollable column containers.

The primary technical challenge is schema evolution: the property `status` enum currently covers `active|under_offer|sstc|exchanged|completed|fallen_through|withdrawn` and has no valuation stages. The valuation stages need to be added (either as new status values or as a separate `pipeline_stage` field) without breaking existing pipeline routes. The lead auto-matching engine is a greenfield service that queries the `leads` table (which has `leadType`, `preferredBedrooms`, `preferredAreas[]`, `minBudget`, `maxBudget`, `preferredPropertyType`) against properties reaching "Listed" status.

**Primary recommendation:** Add new valuation stage values to the property `status` field (or add a `pipeline_stage` text column for the extended lifecycle), build the lettings pipeline as a new dedicated page, add `inquiry_type` filtering to the landlord lead pipeline, create a `lead_property_matches` table for the auto-matching engine, and wire the matching trigger into the property status update endpoint.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Valuation is the FIRST stages of the sales and lettings property pipelines, NOT a separate pipeline
- Sales Property Pipeline stages: Valuation Enquiry -> Valuation Booked -> Valuation Completed -> Instruction Signed -> Listed -> Under Offer -> SSTC -> Exchanged -> Completed
- Lettings Property Pipeline stages: Valuation Enquiry -> Valuation Booked -> Valuation Completed -> Instruction Signed -> Listed -> Viewings -> Holding Deposit -> Tenancy Agreed -> Move-in Complete
- Landlord Lead Pipeline: single shared pipeline with type filter (letting owners, selling owners, all) -- NOT two separate pipelines
- Each pipeline gets its own dedicated page design -- NOT a shared/reusable KanbanBoard component
- Lead auto-matching triggers when property hits "Listed" in either pipeline
- Matching criteria: budget range, bedrooms, area/postcode, property type
- Auto-send requires staff approval first (flag immediately, send after approval)
- Buyer leads matched against sales properties; renter leads matched against lettings properties
- Tenant onboarding kanban, managed property onboarding pipeline, and separate valuation pipeline are NOT in scope

### Claude's Discretion
- Exact card design and information density per kanban column
- How property status field maps to the extended pipeline stages (may need schema additions for valuation stages)
- Auto-match scoring algorithm (exact match vs fuzzy/weighted)
- Staff approval UI for auto-send (inline on match card vs separate approval queue)
- Whether to add new schema columns or reuse existing workflow fields for valuation tracking

### Deferred Ideas (OUT OF SCOPE)
None
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| KAN-01 | Sales PropertyPipeline starts from Valuation Enquiry through to Completed with all intermediate stages as kanban columns | Schema needs new valuation stages; existing PropertyPipeline.tsx extends from 7 to 9 stages; backend pipeline query needs to include valuation-stage properties |
| KAN-02 | New Lettings Property Pipeline page shows rental properties flowing from Valuation Enquiry through Move-in Complete | New page LettingsPropertyPipeline.tsx with 9 lettings-specific stages; new API endpoint filtering `is_rental=true`; new route and sidebar link |
| KAN-03 | LandlordLeadPipeline has type filter for letting owners, selling owners, or all | Existing `inquiry_type` filter already in API (supports 'valuation', 'selling', 'letting'); frontend needs filter UI upgrade from generic dropdown to letting/selling/all |
| KAN-04 | When property reaches "Listed" in either pipeline, matching buyer/renter leads are automatically flagged | New `lead_property_matches` table; matching service triggered on status update to 'listed'/'active'; queries `leads` table by `leadType`, budget, bedrooms, area |
| KAN-05 | Staff can approve auto-sending property details to matched leads; after approval, details sent via email/WhatsApp | Approval workflow on match records; send via existing `MessageSender` service and `emailService`; existing approval pattern from `sourcingApprovalService.ts` |
| KAN-06 | Each pipeline has its own dedicated page design with workflow-specific card content and actions | Three separate page files with unique card designs, stage-specific actions, and workflow-appropriate information density |
| KAN-07 | Fallen Through and Withdrawn remain as terminal states reachable from any active stage (sales) | Existing pattern in PropertyPipeline.tsx already supports this; extend to work with new valuation stages |
| KAN-08 | Lettings pipeline has lettings-specific stages after Listed (Viewings, Holding Deposit, Tenancy Agreed, Move-in Complete) | New lettings-specific status values needed in schema or pipeline_stage field |
</phase_requirements>

## Standard Stack

### Core (Already in Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React 18 | 18.x | UI framework | Project standard |
| TanStack Query 5 | 5.x | Server state management | Project standard for all API data |
| shadcn/ui | latest | UI components (Card, Badge, Select, Button, Tooltip) | Project standard |
| Express 4 | 4.x | Backend API | Project standard |
| PostgreSQL | via Supabase | Database | Project standard |
| date-fns | latest | Date formatting | Already used in both pipeline pages |
| lucide-react | latest | Icons | Already used in pipeline pages |

### Supporting (Already in Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| MessageSender | internal | Send WhatsApp/SMS/email | Auto-send property details to matched leads |
| emailService | internal | Email dispatch | Send property detail emails after approval |
| wouter | latest | Client routing | New page routes (before /crm catch-all) |

### No New Dependencies Required
This phase uses exclusively existing project libraries. No new npm packages needed.

## Architecture Patterns

### Recommended Project Structure
```
client/src/pages/
  PropertyPipeline.tsx          # MODIFY: Extend with valuation stages (sales)
  LettingsPropertyPipeline.tsx  # NEW: Lettings-specific pipeline page
  LandlordLeadPipeline.tsx      # MODIFY: Add type filter UI
  LeadMatches.tsx               # NEW: Approval queue for auto-matched leads

server/
  crmRoutes.ts                  # MODIFY: Extend pipeline endpoints, add lettings pipeline
  leadMatchingService.ts        # NEW: Auto-matching engine
  leadMatchingRoutes.ts         # NEW: Match management API (or add to crmRoutes)

shared/
  schema.ts                     # MODIFY: Add new status values or pipeline_stage column
```

### Pattern 1: Property Status Extension for Valuation Stages
**What:** The property `status` field currently uses: `active|under_offer|sstc|exchanged|completed|fallen_through|withdrawn`. It needs valuation stages prepended.
**When to use:** When a property is created from a valuation enquiry before it reaches the "Listed" stage.
**Recommendation:** Add a `pipeline_stage` text column to the `property` table rather than modifying the existing `status` enum. This preserves backward compatibility -- `status` continues to mean "listing status" while `pipeline_stage` tracks the full lifecycle. The stages would be:
- Sales: `valuation_enquiry|valuation_booked|valuation_completed|instruction_signed|listed|under_offer|sstc|exchanged|completed`
- Lettings: `valuation_enquiry|valuation_booked|valuation_completed|instruction_signed|listed|viewings|holding_deposit|tenancy_agreed|move_in_complete`

**Alternative (simpler):** Extend the `status` field directly with new values. This is simpler but means the existing `WHERE p.status = 'active'` queries across the codebase need auditing.

**Recommended approach:** Use `pipeline_stage` as the authoritative stage tracker for kanban views. Map to `status` for backward compatibility (e.g., `pipeline_stage='listed'` maps to `status='active'`, `pipeline_stage='under_offer'` maps to `status='under_offer'`). This avoids breaking any existing queries while enabling the full lifecycle view.

### Pattern 2: Lettings-Specific Status Values
**What:** Lettings pipeline diverges from sales after "Listed" -- different stages reflect the lettings process.
**When to use:** When displaying rental properties in their pipeline.
**Key insight:** The `is_rental` flag on the property determines which pipeline stages apply. A property with `is_rental=true` uses lettings stages; `is_rental=false` (or `is_listed_sale=true`) uses sales stages.

### Pattern 3: Lead Auto-Matching Engine
**What:** When a property status changes to "Listed", query the `leads` table for matching buyer/renter leads.
**Matching fields (from schema):**
- `leads.leadType` = 'purchase' for sales, 'rental' for lettings (also 'both')
- `leads.minBudget` / `leads.maxBudget` vs `properties.price` (sales) or `properties.rentAmount` (lettings)
- `leads.preferredBedrooms` vs `properties.bedrooms`
- `leads.preferredAreas[]` (text array) vs `properties.postcode` (prefix match)
- `leads.preferredPropertyType` vs `properties.propertyType`

**Scoring approach (weighted):**
```
score = 0
if budget_match: score += 40       (property price within min-max range)
if bedrooms_match: score += 25     (exact match or +/- 1)
if area_match: score += 25         (postcode prefix match, e.g., SW2 matches SW2 1AB)
if property_type_match: score += 10 (exact match)
```
Threshold: flag leads with score >= 50.

### Pattern 4: Approval Workflow for Auto-Send
**What:** Matches are flagged immediately but property details are only sent after staff approval.
**Existing pattern:** `sourcingApprovalService.ts` implements this exact pattern -- drafts are created, staff approves, then send is triggered.
**Implementation:**
1. `lead_property_matches` table stores each match with status `pending|approved|sent|rejected`
2. Staff sees pending matches in a queue (or inline on the pipeline card)
3. On approval, system sends property details via email (and optionally WhatsApp) using `MessageSender`

### Anti-Patterns to Avoid
- **Shared KanbanBoard component:** User explicitly decided against this. Each pipeline page is purpose-built.
- **Modifying `status` enum without auditing consumers:** The `status` field is read by many backend routes and frontend components. Adding new values to it requires checking every consumer.
- **Synchronous matching on status update:** The matching query could be slow with many leads. Run it asynchronously (fire-and-forget after HTTP response).
- **Auto-sending without approval:** Violates user decision. Always require staff gate.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-channel message dispatch | Custom email/WhatsApp sender | `MessageSender` service | Already handles WhatsApp, SMS, email with proper formatting |
| Email sending | Raw nodemailer calls | `emailService.sendEmail()` | Already configured with SMTP, handles errors |
| Staff approval workflow | Custom state machine | Pattern from `sourcingApprovalService.ts` | Proven pattern: pending -> approved -> sent/rejected |
| Date formatting | Manual date string manipulation | `date-fns` format() | Already imported in pipeline pages |

## Common Pitfalls

### Pitfall 1: Wouter Route Order
**What goes wrong:** New pipeline routes return 404 because `/crm` catch-all in App.tsx matches first.
**Why it happens:** Wouter's `<Switch>` matches the FIRST matching route top-to-bottom.
**How to avoid:** Add all new routes BEFORE the `<Route path="/crm">` catch-all in App.tsx. This is documented in CLAUDE.md and MEMORY.md.
**Warning signs:** Page loads but shows the CRM dashboard instead of the pipeline.

### Pitfall 2: Schema Column Names
**What goes wrong:** Code references column names that don't exist in the schema.
**Why it happens:** Guessing column names instead of checking `shared/schema.ts`.
**How to avoid:** ALWAYS grep schema.ts before writing any database query. This is a mandatory rule from CLAUDE.md.
**Warning signs:** "column does not exist" errors at runtime.

### Pitfall 3: Price in Pence
**What goes wrong:** Budget/price comparisons fail because values are in different units.
**Why it happens:** All monetary values in the database are stored in pence (integer). The leads `minBudget`, `maxBudget` and property `price`, `rentAmount` are all in pence.
**How to avoid:** Compare pence to pence. Format to pounds only for display.
**Warning signs:** Matches that make no sense (comparing pence to pounds).

### Pitfall 4: Landlord Leads Are in the `contact` Table
**What goes wrong:** Code tries to query a `landlord_leads` table that doesn't exist.
**Why it happens:** The pipeline is called "Landlord Lead Pipeline" but the data lives in the `contact` table where `inquiry_type IN ('valuation', 'selling', 'letting')`.
**How to avoid:** Check the existing route at crmRoutes.ts line 2108 -- it queries `FROM contact c WHERE c.inquiry_type IN ('valuation', 'selling', 'letting')`.
**Warning signs:** SQL errors about missing tables.

### Pitfall 5: Lettings vs Sales Pipeline Stage Divergence
**What goes wrong:** Lettings properties showing sales-specific stages or vice versa.
**Why it happens:** Using a single `pipeline_stage` column for both workflows without checking `is_rental`.
**How to avoid:** Filter by `is_rental` when querying for each pipeline. Sales pipeline: `is_rental = false` (or `is_listed_sale = true`). Lettings pipeline: `is_rental = true` (or `is_listed_rental = true`).
**Warning signs:** Rental properties appearing in sales pipeline.

### Pitfall 6: Auto-Match Trigger Placement
**What goes wrong:** Matches not created when property reaches "Listed".
**Why it happens:** Status update endpoint at crmRoutes.ts line 2578 updates status but has no hook for triggering the matching engine.
**How to avoid:** Add the matching trigger AFTER the status update succeeds, as a fire-and-forget async call. Ensure it runs for BOTH the sales pipeline status update AND any new lettings pipeline status update endpoint.
**Warning signs:** Properties at "Listed" with no matches in the matches table.

## Code Examples

### Existing Property Pipeline API (crmRoutes.ts:2544)
```typescript
// GET /api/crm/property-pipeline
// Queries property table with LEFT JOINs to user table for agent names
// Filters: WHERE p.is_listed = true
// Returns: property fields + workflow dates + agent names
```

### Existing Status Update Endpoint (crmRoutes.ts:2578)
```typescript
// PATCH /api/crm/property-pipeline/:id/status
// Maps status to date/agent columns (e.g., 'under_offer' -> under_offer_at, under_offer_by)
// Updates: SET status = $1, {dateCol} = NOW(), {agentCol} = $3
// This is where the auto-match trigger should be added
```

### Existing Landlord Lead Pipeline Query (crmRoutes.ts:2108)
```typescript
// GET /api/crm/landlord-leads?inquiryType=letting
// Queries: FROM contact c WHERE c.inquiry_type IN ('valuation', 'selling', 'letting')
// Already supports inquiryType query parameter for filtering
```

### Lead Matching Query Pattern
```sql
-- Find matching buyer leads for a newly listed sales property
SELECT l.id, l.full_name, l.email, l.phone, l.lead_type,
       l.min_budget, l.max_budget, l.preferred_bedrooms,
       l.preferred_areas, l.preferred_property_type
FROM lead l
WHERE l.lead_type IN ('purchase', 'both')
  AND l.status NOT IN ('converted', 'lost', 'archived')
  AND (l.min_budget IS NULL OR l.min_budget <= $1)  -- property price
  AND (l.max_budget IS NULL OR l.max_budget >= $1)
  AND (l.preferred_bedrooms IS NULL OR l.preferred_bedrooms = $2)
  -- postcode prefix match
  AND (l.preferred_areas IS NULL OR EXISTS (
    SELECT 1 FROM unnest(l.preferred_areas) AS area
    WHERE $3 LIKE area || '%'
  ))
```

### Schema Addition: lead_property_matches Table
```typescript
export const leadPropertyMatches = pgTable("lead_property_match", {
  id: serial("id").primaryKey(),
  leadId: integer("lead_id").notNull(),       // FK to leads
  propertyId: integer("property_id").notNull(), // FK to properties
  matchScore: integer("match_score").notNull(), // 0-100
  matchReasons: json("match_reasons"),          // { budget: true, bedrooms: true, ... }
  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'sent', 'rejected', 'dismissed'
  approvedBy: integer("approved_by"),           // FK to users
  approvedAt: timestamp("approved_at"),
  sentAt: timestamp("sent_at"),
  sentVia: text("sent_via"),                    // 'email', 'whatsapp', 'both'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
```

### Schema Addition: Pipeline Stage on Properties
```typescript
// Option A: New column (recommended)
pipelineStage: text("pipeline_stage").default("listed"),
// Values: 'valuation_enquiry', 'valuation_booked', 'valuation_completed',
//         'instruction_signed', 'listed', 'under_offer', 'sstc', 'exchanged',
//         'completed', 'viewings', 'holding_deposit', 'tenancy_agreed', 'move_in_complete'

// Workflow tracking dates for new valuation stages
valuationEnquiryAt: timestamp("valuation_enquiry_at"),
valuationBookedAt: timestamp("valuation_booked_at"),
valuationCompletedAt2: timestamp("valuation_completed_at"), // Note: valuationDate already exists
instructionSignedAt: timestamp("instruction_signed_at"),
// Lettings-specific stage dates
viewingsAt: timestamp("viewings_at"),
holdingDepositAt: timestamp("holding_deposit_at"),
tenancyAgreedAt: timestamp("tenancy_agreed_at"),
moveInCompleteAt: timestamp("move_in_complete_at"),
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PropertyPipeline starts at "Available" | Extended to start at "Valuation Enquiry" | Phase 12 | Full lifecycle visibility from first contact |
| No auto-matching | Leads flagged when property listed | Phase 12 | Staff don't manually search for matching leads |
| Single property pipeline for sales+rentals | Separate sales and lettings pipelines | Phase 12 | Each workflow has appropriate stages |

## Open Questions

1. **Pipeline Stage vs Status Field**
   - What we know: `status` is used everywhere. Adding new values risks breaking existing queries.
   - What's unclear: Whether a new `pipeline_stage` column is cleaner than extending `status`.
   - Recommendation: Use `pipeline_stage` for the kanban view, keep `status` for backward compatibility. Map between them on status transitions. This adds complexity but avoids a risky migration.

2. **Existing Valuation Fields on Properties**
   - What we know: `valuationDate`, `valuationAmount`, `valuationReportUrl` already exist on the properties table.
   - What's unclear: Whether these are sufficient for the valuation stages or if we need `valuationEnquiryAt`, `valuationBookedAt` as separate timestamps.
   - Recommendation: The existing fields track a single valuation event. The pipeline needs timestamps for each stage transition. Add new stage-specific timestamp columns.

3. **Landlord Lead to Property Pipeline Handoff**
   - What we know: The landlord lead pipeline ends at "Listed" (in the `contact` table). The property pipeline picks up at "Listed" (in the `property` table). There's already a `linkedPropertyId` field on contacts.
   - What's unclear: Whether the new property pipeline valuation stages overlap with the landlord lead pipeline stages.
   - Recommendation: They DO overlap. The landlord lead pipeline tracks the lead journey (new lead -> contacted -> valuation -> instruction -> listed). The property pipeline valuation stages track the property journey. These are two views of the same process. The property pipeline valuation stages should be tracked on the property record from when the property is first created (which may be at valuation enquiry stage, not at listing). The landlord lead continues to track the lead's status separately.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KAN-01 | Sales pipeline has 9 stages from Valuation Enquiry to Completed | unit | `npx vitest run server/__tests__/salesPipeline.test.ts -x` | No - Wave 0 |
| KAN-02 | Lettings pipeline has 9 stages from Valuation Enquiry to Move-in Complete | unit | `npx vitest run server/__tests__/lettingsPipeline.test.ts -x` | No - Wave 0 |
| KAN-03 | Landlord lead pipeline supports inquiry_type filtering | unit | `npx vitest run server/__tests__/landlordLeadFilter.test.ts -x` | No - Wave 0 |
| KAN-04 | Auto-matching flags leads when property reaches Listed | unit | `npx vitest run server/__tests__/leadMatching.test.ts -x` | No - Wave 0 |
| KAN-05 | Staff approval triggers send via email/WhatsApp | unit | `npx vitest run server/__tests__/leadMatchApproval.test.ts -x` | No - Wave 0 |
| KAN-06 | Each pipeline has dedicated page design | manual-only | Visual inspection | N/A |
| KAN-07 | Fallen Through/Withdrawn reachable from any active sales stage | unit | `npx vitest run server/__tests__/salesPipeline.test.ts -x` | No - Wave 0 |
| KAN-08 | Lettings pipeline has correct post-Listed stages | unit | `npx vitest run server/__tests__/lettingsPipeline.test.ts -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/__tests__/leadMatching.test.ts` -- covers KAN-04, KAN-05
- [ ] `server/__tests__/pipelineStages.test.ts` -- covers KAN-01, KAN-02, KAN-07, KAN-08

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` lines 86-214 -- properties table definition with status field and workflow dates
- `shared/schema.ts` lines 5629-5739 -- leads table with preferences (leadType, preferredBedrooms, preferredAreas, minBudget, maxBudget)
- `shared/schema.ts` lines 2267-2312 -- contacts table (landlord leads) with inquiry_type and workflow_stage
- `client/src/pages/PropertyPipeline.tsx` -- existing 7-stage sales kanban
- `client/src/pages/LandlordLeadPipeline.tsx` -- existing 7-stage landlord lead kanban
- `server/crmRoutes.ts` lines 2108-2610 -- landlord leads API and property pipeline API
- `server/agents/services/sourcingApprovalService.ts` -- approval workflow pattern

### Secondary (MEDIUM confidence)
- CONTEXT.md decisions on pipeline stages and matching criteria

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all existing project libraries, no new dependencies
- Architecture: HIGH -- extending established patterns from PropertyPipeline.tsx and LandlordLeadPipeline.tsx
- Pitfalls: HIGH -- based on direct codebase examination and documented project rules (CLAUDE.md, MEMORY.md)
- Lead matching: MEDIUM -- matching algorithm is new but uses well-defined schema fields

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable domain, no external dependencies changing)
