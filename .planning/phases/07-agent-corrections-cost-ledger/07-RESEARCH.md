# Phase 7: Agent Corrections & Cost Ledger - Research

**Researched:** 2026-03-24
**Domain:** Agent prompt/tool modification, offer recording, cost aggregation
**Confidence:** HIGH

## Summary

Phase 7 has two distinct workstreams: (1) removing negotiation autonomy from Alex (Sales) and Jordan (Lettings) agents and replacing it with an offer recording flow, and (2) adding Morgan's PM cost ledger for tracking maintenance and compliance spend per property and per landlord.

The codebase is well-prepared for both. The `propertyOffers` table already exists with all needed columns (offerAmount, buyerName, buyerPosition, conditions, counterOfferAmount, status). Work orders have `invoiceAmount` and `quotedAmount` columns, and property certifications track inspection costs implicitly through contractor references. The Phase 6 notification system (bell + SSE + `notification` table) and `emailService.ts` provide all infrastructure for offer alerts and cost threshold emails.

**Primary recommendation:** Split into 3-4 plans: (1) agent prompt corrections + recordOffer tool, (2) offer management API + staff UI, (3) cost ledger API + property/landlord UI sections, (4) cost threshold alerting.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Agent captures offer details and writes to `propertyOffers` table
- Agent notifies assigned staff negotiator via in-CRM notification bell + email
- Agent gives neutral acknowledgement only -- no commentary on competitiveness or vendor willingness
- Staff delivers accept/reject/counter decisions manually -- agent NOT involved after recording
- Staff handles all counter-offers entirely -- no agent involvement in back-and-forth
- Alex proactively captures full buyer position: chain status, mortgage approval, solicitor details, proposed completion timeline
- Jordan captures equivalent lettings details: employment status, references, move-in timeline
- Guardrails apply to BOTH Alex AND Jordan consistently
- Agents CAN share listed/asking price and general market context
- Agents CANNOT comment on flexibility, willingness to negotiate, or what vendor/landlord would accept
- When pushed for negotiation, agent encourages formal offer with scripted deflection
- Cost ledger tracks maintenance costs (work orders) AND compliance costs (certifications)
- Costs logged when actual invoice/payment recorded -- not estimated at booking time
- Cost summary visible on BOTH property detail page AND landlord detail page
- Property view: running total + category breakdown + individual expense table
- Landlord view: total costs across all properties, broken down per property
- Configurable spend thresholds per property -- email-only alerts (NOT in-CRM bell)
- New offer triggers: in-CRM notification bell (Phase 6) + email to assigned agent/negotiator
- Notification email includes full details + direct CRM link
- Offer management in TWO places: property detail page offers section + dedicated central offers dashboard
- Property page: list of all offers with status, buyer details, accept/reject/counter actions
- Offers dashboard: all active offers across all properties, filterable by property, status, date

### Claude's Discretion
- Offer notification email template design
- Offers dashboard layout and filter controls
- Cost ledger UI component design on property and landlord pages
- Cost threshold default values
- Cost category taxonomy (how to categorize different maintenance/compliance expenses)
- How to modify agent prompt instructions (exact wording for negotiation removal)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @openai/agents | existing | Agent SDK for tool definitions | Already used for all specialist agents |
| zod4 | existing alias | Tool parameter schemas | Required by @openai/agents SDK |
| pg (pool.query) | existing | Raw SQL for aggregation queries | Project pattern for PM routes |
| nodemailer | existing | Email sending | Used by emailService.ts |
| TanStack React Query | 5 | Server state for offers/costs | Project standard |
| shadcn/ui | existing | UI components (Table, Card, Badge, Dialog) | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| date-fns | existing | Date formatting in cost ledger | Already imported in many pages |
| lucide-react | existing | Icons for offer/cost UI | Project standard icon library |

### Alternatives Considered
None needed -- everything required is already in the project stack.

## Architecture Patterns

### Recommended Project Structure
```
server/
  agents/sdk/
    salesAgent.ts          # MODIFY: Replace NEGOTIATION section, add recordOffer tool
    lettingsAgent.ts       # MODIFY: Replace NEGOTIATION section, add recordOffer tool
    tools.ts               # ADD: recordOffer tool wrapper
  offerRoutes.ts           # NEW: Offer management REST API
  costLedgerRoutes.ts      # NEW: Cost ledger aggregation API
client/src/
  pages/
    OffersManagement.tsx   # NEW: Central offers dashboard
  components/
    OffersSection.tsx      # NEW: Offers section for property detail page
    CostLedger.tsx         # NEW: Cost ledger component (property + landlord views)
```

### Pattern 1: Agent Tool Definition (recordOffer)
**What:** Add a new SDK tool that writes to `propertyOffers` table and creates a notification
**When to use:** When agent records an offer from a buyer/tenant
**Example:**
```typescript
// Follow existing pattern from tools.ts
export const recordOfferTool = tool({
  name: 'record_offer',
  description: 'Record a property offer from a buyer/tenant. Captures offer details and notifies the assigned negotiator.',
  parameters: z4.object({
    propertyId: z4.number(),
    offerAmount: z4.number(),
    buyerName: z4.string(),
    buyerEmail: z4.string(),
    buyerPhone: z4.string(),
    buyerPosition: z4.enum(['cash', 'mortgage_approved', 'mortgage_required', 'chain']).optional(),
    isInChain: z4.boolean().optional(),
    chainDetails: z4.string().optional(),
    conditions: z4.array(z4.string()).optional(),
    proposedCompletionDate: z4.string().optional(),
    // Lettings-specific fields
    employmentStatus: z4.string().optional(),
    references: z4.string().optional(),
    moveInTimeline: z4.string().optional(),
  }),
  execute: async (context: AgentContext, input) => {
    // 1. INSERT into property_offer table
    // 2. Create notification for assigned staff
    // 3. Send email with offer details + CRM link
    // Return confirmation string for agent to relay
  },
});
```

### Pattern 2: Notification Creation (reuse Phase 6)
**What:** Insert into `notification` table + push via SSE
**When to use:** When a new offer is recorded
**Example:**
```typescript
// Reuse dealService.createNotification pattern
await pool.query(
  `INSERT INTO notification (user_id, deal_id, title, body, type, link_url)
   VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
  [assignedAgentId, null, `New offer: ${amount} on ${address}`, bodyText, 'info', `/crm/offers`]
);
// Then push to SSE clients map (same pattern as dealRoutes.ts)
```

### Pattern 3: Raw SQL Aggregation (cost ledger)
**What:** Use raw SQL with JOINs for cost summaries across work_order and property_certification tables
**When to use:** Cost ledger endpoints that aggregate across multiple tables
**Example:**
```typescript
// Per-property cost summary
const result = await pool.query(`
  SELECT
    'maintenance' AS category,
    COALESCE(SUM(wo.invoice_amount), 0) AS total_cost,
    COUNT(*) AS item_count
  FROM work_order wo
  JOIN maintenance_request mr ON wo.maintenance_request_id = mr.id
  WHERE mr.property_id = $1 AND wo.invoice_amount IS NOT NULL
  UNION ALL
  SELECT
    'compliance' AS category,
    0 AS total_cost,  -- certifications may need a cost column added
    COUNT(*) AS item_count
  FROM property_certification
  WHERE property_id = $1
`, [propertyId]);
```

### Anti-Patterns to Avoid
- **Agent doing negotiation logic:** The entire NEGOTIATION section must be replaced, not just softened. Agents must not have ANY negotiation-related tools or instructions.
- **Estimating costs at booking time:** Cost ledger only shows actual invoiced/paid amounts from `invoiceAmount` fields, not estimated/quoted amounts.
- **Using notification bell for cost alerts:** Cost threshold breaches are email-only per user decision. Do not create bell notifications for cost thresholds.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Notification delivery | Custom notification system | Phase 6 notification table + SSE pattern | Already battle-tested, has bell UI |
| Email sending | Custom SMTP logic | `emailService.sendEmail()` | Already configured with project SMTP |
| Offer status management | Complex state machine | Simple status field on `propertyOffers` table | Existing schema already has pending/under_review/accepted/rejected/withdrawn |
| Cost data sourcing | Separate cost tracking table | Aggregate from existing `work_order.invoice_amount` + `maintenance_request.actual_cost` | Data already exists, just needs aggregation |

## Common Pitfalls

### Pitfall 1: Forgetting to Remove ALL Negotiation References
**What goes wrong:** Agent still has partial negotiation instructions or tools
**Why it happens:** Only modifying the NEGOTIATION section but not checking other prompt sections for negotiation-related language
**How to avoid:** Search entire agent prompt for words like "negotiate", "counter", "floor", "ceiling", "flexibility", "willing to accept"
**Warning signs:** Agent still advises on pricing beyond stating the asking price

### Pitfall 2: Missing Lettings-Specific Fields on propertyOffers
**What goes wrong:** Jordan captures lettings details (employment, references, move-in) but nowhere to store them
**Why it happens:** The `propertyOffers` table was designed for sales -- it has `buyerPosition`, `chainDetails` but not lettings equivalents
**How to avoid:** Either add lettings columns to `propertyOffers` OR store lettings-specific data in the `conditions` text array field as structured entries. Adding columns is cleaner.
**Warning signs:** Lettings offer data silently lost or crammed into notes field

### Pitfall 3: Cost Ledger Missing Certification Costs
**What goes wrong:** Property certifications don't have a cost/amount column in the schema
**Why it happens:** `propertyCertifications` table tracks certificate details and dates but has no `cost` or `invoice_amount` column
**How to avoid:** Either add a `cost` column to `property_certification` table, or track certification costs through work orders linked to certifications. Adding a `cost` column is simpler.
**Warning signs:** Compliance section of cost ledger always shows zero

### Pitfall 4: Offer Notification Going to Wrong Staff Member
**What goes wrong:** Notification sent to generic admin instead of the property's assigned negotiator
**Why it happens:** `properties` table has `agent_id` and `property_manager_id` but no dedicated negotiator field
**How to avoid:** Use `agent_id` from properties table as the notification recipient. If no agent assigned, fall back to property manager or first admin user.
**Warning signs:** Offers pile up without anyone noticing

### Pitfall 5: Route Registration Order in App.tsx
**What goes wrong:** New offers page returns 404
**Why it happens:** Route added after the `/crm` catch-all in App.tsx Switch
**How to avoid:** Add `/crm/offers` route BEFORE the `/crm` catch-all route (before line ~243)
**Warning signs:** Page works in URL bar but navigating to it shows CRM dashboard

## Code Examples

### Agent Prompt Replacement (Sales)
```typescript
// BEFORE (salesAgent.ts lines 134-139):
// NEGOTIATION:
// - You have full negotiation autonomy...

// AFTER:
// OFFERS:
// - When a buyer wants to make an offer, use the record_offer tool to capture it
// - Collect: offer amount, buyer name, email, phone, position (cash/mortgage/chain), chain details, solicitor, proposed completion
// - After recording, confirm neutrally: "Thank you, I've recorded your offer of [amount] and passed it to the team. They'll be in touch shortly."
// - Do NOT comment on competitiveness, likelihood of acceptance, or vendor willingness
// - Do NOT deliver counter-offers or negotiate on behalf of the vendor
// - If asked "Would they take X?", respond: "I can't speak for the vendor on that, but I'd encourage you to put your offer forward and I'll make sure it's presented."
// - You CAN share the asking price and general market context ("properties in this area typically go for...")
// - You CANNOT comment on flexibility or willingness to negotiate
```

### Offer Recording API Endpoint
```typescript
// POST /api/crm/offers
router.post('/offers', async (req, res) => {
  const { propertyId, offerAmount, buyerName, buyerEmail, buyerPhone,
          buyerPosition, isInChain, chainDetails, conditions, proposedCompletionDate } = req.body;

  const result = await pool.query(
    `INSERT INTO property_offer (property_id, offer_amount, buyer_name, buyer_email, buyer_phone,
     buyer_position, is_in_chain, chain_details, conditions, proposed_completion_date, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending') RETURNING *`,
    [propertyId, offerAmount, buyerName, buyerEmail, buyerPhone,
     buyerPosition, isInChain, chainDetails, conditions, proposedCompletionDate]
  );

  // Create notification + send email
  // ...
  res.json(result.rows[0]);
});
```

### Cost Ledger Aggregation
```typescript
// GET /api/crm/properties/:id/costs
router.get('/properties/:id/costs', async (req, res) => {
  const { id } = req.params;

  // Maintenance costs from work orders
  const maintenance = await pool.query(`
    SELECT wo.id, wo.work_order_number, wo.scope, wo.invoice_amount, wo.invoice_number,
           wo.actual_start, wo.status, mr.issue_type, mr.title
    FROM work_order wo
    JOIN maintenance_request mr ON wo.maintenance_request_id = mr.id
    WHERE mr.property_id = $1 AND wo.invoice_amount IS NOT NULL
    ORDER BY wo.created_at DESC
  `, [id]);

  // Compliance costs from certifications (needs cost column)
  const compliance = await pool.query(`
    SELECT id, certification_type, issued_by, inspection_date, cost
    FROM property_certification
    WHERE property_id = $1 AND cost IS NOT NULL
    ORDER BY inspection_date DESC
  `, [id]);

  res.json({
    maintenance: { items: maintenance.rows, total: maintenance.rows.reduce((s, r) => s + (r.invoice_amount || 0), 0) },
    compliance: { items: compliance.rows, total: compliance.rows.reduce((s, r) => s + (r.cost || 0), 0) },
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full negotiation autonomy for agents | Offer recording only, staff handles negotiation | Phase 7 | Agents become professional intake agents, not negotiators |
| No cost tracking per property | Aggregated cost ledger from existing data | Phase 7 | PM staff can see spend without manual spreadsheets |

## Schema Changes Required

### Additions to `property_certification` table
```sql
ALTER TABLE property_certification ADD COLUMN cost INTEGER; -- In pence, nullable
```

### Additions to `propertyOffers` table (for lettings)
```sql
ALTER TABLE property_offer ADD COLUMN employment_status TEXT;
ALTER TABLE property_offer ADD COLUMN rental_references TEXT;
ALTER TABLE property_offer ADD COLUMN move_in_timeline TEXT;
ALTER TABLE property_offer ADD COLUMN offer_source TEXT DEFAULT 'agent'; -- 'agent', 'direct', 'portal'
```

### New table: `property_cost_thresholds`
```sql
CREATE TABLE property_cost_threshold (
  id SERIAL PRIMARY KEY,
  property_id INTEGER NOT NULL,
  annual_limit INTEGER NOT NULL, -- In pence
  notification_email TEXT NOT NULL, -- Property manager email
  last_alert_sent TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

## Key Integration Points

### Files to Modify
| File | Change | Reason |
|------|--------|--------|
| `server/agents/sdk/salesAgent.ts` | Replace NEGOTIATION section (lines 134-139), add `recordOfferTool` import | Remove negotiation autonomy |
| `server/agents/sdk/lettingsAgent.ts` | Replace NEGOTIATION section (lines 65-70), add `recordOfferTool` import | Remove negotiation autonomy |
| `server/agents/sdk/tools.ts` | Add `recordOfferTool` export | New agent tool |
| `server/routes.ts` | Mount offerRoutes and costLedgerRoutes | New API endpoints |
| `client/src/App.tsx` | Add OffersManagement route BEFORE /crm catch-all | New offers page |
| `client/src/components/CRMLayout.tsx` | Add offers dashboard nav link | Navigation |
| `client/src/pages/ManagedPropertyCard.tsx` | Add Offers tab + Cost Ledger tab | Property detail sections |
| `client/src/pages/LandlordDetails.tsx` | Add Cost Ledger tab | Landlord cost view |
| `shared/schema.ts` | Add lettings columns to propertyOffers, cost column to propertyCertifications, new threshold table | Schema extensions |

### Files to Create
| File | Purpose |
|------|---------|
| `server/offerRoutes.ts` | Offer CRUD API + notification triggers |
| `server/costLedgerRoutes.ts` | Cost aggregation endpoints + threshold management |
| `client/src/pages/OffersManagement.tsx` | Central offers dashboard |
| `client/src/components/OffersSection.tsx` | Reusable offers section for property pages |
| `client/src/components/CostLedger.tsx` | Reusable cost ledger component |

## Open Questions

1. **Certification cost data source**
   - What we know: `property_certification` has no cost column currently
   - What's unclear: Whether certification costs should be added as a new column or tracked through a linked work order
   - Recommendation: Add `cost` column to `property_certification` -- simpler, certifications are not always tied to work orders

2. **Cost threshold defaults**
   - What we know: Thresholds are configurable per property, email-only alerts
   - What's unclear: What sensible default annual limit should be
   - Recommendation: Default 5000 GBP (500000 pence) annual threshold, adjustable per property. No default threshold created automatically -- staff sets them up.

3. **SSE channel reuse**
   - What we know: Phase 6 has SSE infrastructure in dealRoutes.ts with `sseClients` Map
   - What's unclear: Whether offer notifications should use the same SSE channel or a separate one
   - Recommendation: Reuse the same SSE channel and `notification` table. The bell already reads all notifications. Just insert with appropriate type.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CORR-01 | recordOffer tool inserts into property_offer table | unit | `npx vitest run server/agents/__tests__/recordOffer.test.ts -t "inserts offer"` | Wave 0 |
| CORR-02 | Agent prompt has no negotiation instructions | unit | `npx vitest run server/agents/__tests__/agentPrompts.test.ts -t "no negotiation"` | Wave 0 |
| CORR-03 | Offer creates notification for assigned agent | unit | `npx vitest run server/__tests__/offerRoutes.test.ts -t "creates notification"` | Wave 0 |
| CORR-04 | Offer sends email to assigned negotiator | unit | `npx vitest run server/__tests__/offerRoutes.test.ts -t "sends email"` | Wave 0 |
| COST-01 | Cost ledger aggregates work order invoices | unit | `npx vitest run server/__tests__/costLedger.test.ts -t "aggregates maintenance"` | Wave 0 |
| COST-02 | Cost ledger aggregates certification costs | unit | `npx vitest run server/__tests__/costLedger.test.ts -t "aggregates compliance"` | Wave 0 |
| COST-03 | Cost threshold breach sends email | unit | `npx vitest run server/__tests__/costLedger.test.ts -t "threshold email"` | Wave 0 |
| OFFER-UI | Offer management accept/reject/counter actions | manual-only | Manual: test in browser | N/A |
| COST-UI | Cost ledger renders on property and landlord pages | manual-only | Manual: test in browser | N/A |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/agents/__tests__/recordOffer.test.ts` -- covers CORR-01, CORR-02
- [ ] `server/__tests__/offerRoutes.test.ts` -- covers CORR-03, CORR-04
- [ ] `server/__tests__/costLedger.test.ts` -- covers COST-01, COST-02, COST-03

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` lines 586-624 -- `propertyOffers` table definition (verified columns: offerAmount, buyerName, buyerPosition, conditions, counterOfferAmount, status)
- `shared/schema.ts` lines 800-839 -- `workOrders` table definition (verified: invoiceAmount, quotedAmount columns)
- `shared/schema.ts` lines 1330-1371 -- `propertyCertifications` table definition (verified: NO cost column exists)
- `shared/schema.ts` lines 7891-7906 -- `notifications` table definition (verified: userId, dealId, title, body, type, linkUrl)
- `server/agents/sdk/salesAgent.ts` lines 134-139 -- Current NEGOTIATION section (verified: "full negotiation autonomy")
- `server/agents/sdk/lettingsAgent.ts` lines 65-70 -- Current NEGOTIATION section (verified: "full negotiation autonomy")
- `server/agents/sdk/tools.ts` -- Tool wrapping pattern with zod4 + wrapRegistryTool helper
- `server/agents/services/dealService.ts` lines 200-208 -- Notification creation pattern (raw SQL INSERT into notification)
- `server/dealRoutes.ts` -- SSE infrastructure pattern (sseClients Map, 30s heartbeat)
- `server/emailService.ts` -- Email sending infrastructure (nodemailer)

### Secondary (MEDIUM confidence)
- Project decision history in STATE.md confirming "full negotiation autonomy" was a Phase 2 decision now being reversed

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in project, no new dependencies
- Architecture: HIGH - Follows established patterns (tool wrapping, raw SQL aggregation, notification creation)
- Pitfalls: HIGH - Verified via direct schema inspection (missing cost column, missing lettings fields)
- Schema changes: HIGH - Verified exact current state of all relevant tables

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable domain, no external dependencies changing)
