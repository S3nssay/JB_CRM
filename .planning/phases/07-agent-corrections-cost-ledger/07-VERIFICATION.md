---
phase: 07-agent-corrections-cost-ledger
verified: 2026-03-26T20:00:00Z
status: human_needed
score: 10/10 automated must-haves verified
re_verification:
  previous_status: human_needed
  previous_score: 9/9 automated
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Offers dashboard at /crm/offers renders with filter controls and offer table"
    expected: "Filter dropdowns for status and property search appear. Table shows columns: property address, offer amount (GBP format), buyer name, position badge, chain status, date, status badge."
    why_human: "React component rendering and visual layout cannot be verified programmatically"
  - test: "Accept / Reject / Counter actions work from offers dashboard"
    expected: "Accept button sends PATCH and refreshes table. Reject opens dialog for rejection reason. Counter opens dialog for counter amount input."
    why_human: "UI interaction flow and mutation feedback require browser testing"
  - test: "Property detail page shows Offers tab and Costs tab"
    expected: "ManagedPropertyCard has two new tabs: Offers (showing OffersSection) and Costs (showing CostLedger in property mode with maintenance/compliance breakdown)."
    why_human: "Tab rendering and layout require browser verification"
  - test: "Landlord detail page shows Costs tab with per-property breakdown"
    expected: "LandlordDetails has a Costs tab with CostLedger in landlord mode. Table shows each property with maintenance total, compliance total, combined total."
    why_human: "Tab rendering and data display require browser verification"
  - test: "CRM sidebar shows Offers navigation link"
    expected: "Handshake icon with 'Offers' label appears in the Deals section of the sidebar. Clicking navigates to /crm/offers."
    why_human: "Sidebar rendering and navigation require browser testing"
  - test: "GBP formatting throughout (pence converted to pounds)"
    expected: "All monetary amounts displayed as GBP (e.g. 350000 pence shown as £3,500.00). Applies to offers dashboard, offers section, and cost ledger."
    why_human: "Visual number formatting requires browser verification"
---

# Phase 7: Agent Corrections & Cost Ledger Verification Report

**Phase Goal:** Remove negotiation autonomy from Sales (Alex) and Lettings (Jordan) agents, replacing it with professional offer recording. Add offer management UI for staff. Add PM cost ledger tracking maintenance and compliance spend per property and per landlord with configurable threshold alerts.
**Verified:** 2026-03-26T20:00:00Z
**Status:** human_needed
**Re-verification:** Yes — re-verification of initial pass (previous status: human_needed, no gaps)

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sales agent (Alex) has no negotiation instructions and cannot negotiate prices | VERIFIED | salesAgent.ts has `OFFERS:` section (line 135), `recordOfferTool` imported (line 24) and in tools array (line 175). No "negotiate prices" / "full negotiation autonomy" text present. |
| 2 | Lettings agent (Jordan) has no negotiation instructions and cannot negotiate rent | VERIFIED | lettingsAgent.ts has `OFFERS:` section (line 66), `recordOfferTool` imported (line 21) and in tools array (line 113). No forbidden negotiation phrases present. |
| 3 | Both agents can record offers via the record_offer tool | VERIFIED | `recordOfferTool` exported from tools.ts (line 282). INSERT INTO property_offer confirmed in execute function (lines 318-341). agentPrompts.test.ts passes behavioral INSERT assertion. |
| 4 | propertyOffers table has lettings-specific columns (employment_status, rental_references, move_in_timeline) | VERIFIED | All three columns present in shared/schema.ts lines 623-625. `offer_source` also present. |
| 5 | propertyCertifications table has a cost column for compliance cost tracking | VERIFIED | `cost: integer("cost")` present in propertyCertifications at schema.ts line 1376. |
| 6 | property_cost_threshold table exists for configurable spend alerts | VERIFIED | `propertyCostThresholds` table defined in schema.ts lines 1383-1391 with id, propertyId, annualLimit, notificationEmail, lastAlertSent, createdAt, updatedAt. |
| 7 | New offer creates in-CRM notification for assigned agent/negotiator | VERIFIED | offerRoutes.ts INSERT INTO notification at lines 173-176. Agent fallback chain: agent_id -> property_manager_id -> first admin user. 21 static analysis tests pass. |
| 8 | New offer sends email to assigned negotiator with full details and CRM link | VERIFIED | offerRoutes.ts imports emailService (line 10), calls emailService.sendEmail at lines 249-252 within POST /offers handler. Email is non-blocking (try/catch). Tests verify email subject/body/CRM link. |
| 9 | Cost ledger aggregates maintenance costs (work_order.invoice_amount) and compliance costs (property_certification.cost) | VERIFIED | costLedgerRoutes.ts joins work_order with maintenance_request filtering invoice_amount IS NOT NULL (lines 37-43), queries property_certification on cost column (lines 47-53). LATERAL JOIN pattern for landlord view. 3 static analysis tests pass. |
| 10 | Cost threshold breach sends email to configured notification_email (not bell) | VERIFIED | costLedgerRoutes.ts calls emailService.sendEmail (line 244) for threshold breaches. Zero INSERT INTO notification in costLedgerRoutes.ts. COST-03 test confirms this explicitly. |
| 11 | Staff can view all offers across properties in a central dashboard | HUMAN NEEDED | OffersManagement.tsx exists (378 lines), useQuery at lines 50-55 fetches `/api/crm/offers`, has statusFilter and search state, useMutation for status updates. Visual rendering requires browser verification. |
| 12 | Staff can accept, reject, or counter an offer | HUMAN NEEDED | handleAccept/handleReject/handleCounter functions exist with PATCH mutations to `/api/crm/offers/:id/status`. Reject and Counter dialogs exist with input placeholders. Visual/interaction flow requires browser testing. |
| 13 | CRM sidebar Offers nav link accessible | HUMAN NEEDED | CRMLayout.tsx line 375 has Offers button with Handshake icon and setLocation('/crm/offers'). Route at App.tsx line 435 before /crm catch-all at line 442. Visual rendering requires browser verification. |

**Score:** 10/10 automated truths verified, 3 truths require human browser verification

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `shared/schema.ts` | Schema extensions: lettings columns on propertyOffers, cost on propertyCertifications, propertyCostThresholds table | VERIFIED | employment_status/rental_references/move_in_timeline at lines 623-625, cost at line 1376, propertyCostThresholds at lines 1383-1391. |
| `server/agents/sdk/tools.ts` | recordOfferTool export | VERIFIED | Exported at line 282, 41 KB file with full INSERT and notification logic. |
| `server/agents/sdk/salesAgent.ts` | Updated prompt with OFFERS section replacing NEGOTIATION | VERIFIED | OFFERS: section at line 135, recordOfferTool imported and in tools array. No forbidden phrases. |
| `server/agents/sdk/lettingsAgent.ts` | Updated prompt with OFFERS section replacing NEGOTIATION | VERIFIED | OFFERS: section at line 66, recordOfferTool imported and in tools array. No forbidden phrases. |
| `server/agents/__tests__/agentPrompts.test.ts` | Unit tests for CORR-01 and CORR-02 | VERIFIED | 6 substantive tests: behavioral INSERT assertion + 4 static prompt checks. |
| `server/offerRoutes.ts` | Offer CRUD API with notification + email triggers | VERIFIED | 347 lines, 5 endpoints, offerRouter exported. Full notification + email logic present and wired. |
| `server/__tests__/offerRoutes.test.ts` | Unit tests for CORR-03 and CORR-04 | VERIFIED | 21 static analysis tests across 5 describe blocks. |
| `server/costLedgerRoutes.ts` | Cost aggregation endpoints and threshold management | VERIFIED | 276 lines, 6 endpoints, costLedgerRouter exported. SQL aggregation, UPSERT threshold, email alert all confirmed. |
| `server/__tests__/costLedger.test.ts` | Unit tests for COST-01, COST-02, COST-03 | VERIFIED | 3 tests verifying SQL patterns and email-not-bell behavior. |
| `client/src/pages/OffersManagement.tsx` | Central offers dashboard (min 100 lines) | VERIFIED | 378 lines. useQuery + useMutation wired to /api/crm/offers. Filter state, status actions, dialogs all present. |
| `client/src/components/OffersSection.tsx` | Reusable offers section (min 50 lines) | VERIFIED | 333 lines. Wired into ManagedPropertyCard.tsx (line 1226) with propertyId prop. |
| `client/src/components/CostLedger.tsx` | Reusable cost ledger component (min 80 lines) | VERIFIED | 352 lines. useQuery wired to /api/crm/properties/:id/costs and /api/crm/landlords/:id/costs. Threshold PUT mutation wired. |
| `client/src/App.tsx` | Route for /crm/offers BEFORE /crm catch-all | VERIFIED | Line 435 (/crm/offers) before line 442 (/crm catch-all). Correct wouter ordering confirmed. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| salesAgent.ts | tools.ts | recordOfferTool import | WIRED | Import at line 24, tools array at line 175 |
| lettingsAgent.ts | tools.ts | recordOfferTool import | WIRED | Import at line 21, tools array at line 113 |
| tools.ts recordOfferTool | property_offer table | INSERT INTO property_offer | WIRED | Lines 318-341 in tools.ts execute function |
| offerRoutes.ts | notification table | INSERT INTO notification on offer creation | WIRED | Lines 173-176, includes user_id, title, body, type ('info'), link_url ('/crm/offers') |
| offerRoutes.ts | emailService.ts | sendEmail for offer notification | WIRED | Import at line 10, sendEmail call at lines 249-252 |
| costLedgerRoutes.ts | work_order table | SQL aggregation JOIN maintenance_request | WIRED | Lines 37-43, JOINs work_order on maintenance_request_id, SUM(invoice_amount) |
| costLedgerRoutes.ts | property_certification table | SQL aggregation on cost column | WIRED | Lines 47-53, SUM(cost) with property_id filter confirmed |
| costLedgerRoutes.ts | emailService.ts | threshold breach email | WIRED | Import at line 13, sendEmail at line 244. Zero INSERT INTO notification present. |
| OffersManagement.tsx | /api/crm/offers | useQuery + useMutation | WIRED | useQuery at line 50-55, useMutation PATCH at line 59-66 |
| CostLedger.tsx | /api/crm/properties/:id/costs | useQuery | WIRED | Endpoint at line 28, useQuery at line 31 |
| CostLedger.tsx | /api/crm/landlords/:id/costs | useQuery | WIRED | Endpoint at line 29, useQuery at line 31 (mode='landlord' branch) |
| App.tsx | OffersManagement.tsx | Route path before /crm catch-all | WIRED | Line 435 (/crm/offers) before line 442 (/crm) — wouter ordering correct |
| routes.ts | offerRoutes.ts | offerRouter mounted at /api/crm | WIRED | Import at line 188, mount at line 211 |
| routes.ts | costLedgerRoutes.ts | costLedgerRouter mounted at /api/crm | WIRED | Import at line 187, mount at line 210 |
| ManagedPropertyCard.tsx | OffersSection | Offers tab | WIRED | Import at line 29, used at line 1226 with propertyId prop |
| ManagedPropertyCard.tsx | CostLedger | Costs tab | WIRED | Import at line 30, used at line 1231 (mode='property') |
| LandlordDetails.tsx | CostLedger | Costs tab | WIRED | Import at line 25, used at line 1157 (mode='landlord') |

---

## Requirements Coverage

Phase 07 requirement IDs are defined in PLAN frontmatter and ROADMAP.md. They do not appear in `.planning/REQUIREMENTS.md`, which uses a separate ID scheme (KB-xx, AGENT-xx, etc.) for earlier phases. No orphaned requirements exist.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CORR-01 | 07-01 | recordOfferTool exports and inserts into property_offer | SATISFIED | tools.ts line 282, INSERT logic lines 318-341, behavioral unit test passes |
| CORR-02 | 07-01 | Sales and Lettings agents have no negotiation language | SATISFIED | OFFERS: sections in both agents, no forbidden phrases, static analysis tests pass |
| CORR-03 | 07-02 | New offer creates in-CRM notification | SATISFIED | offerRoutes.ts INSERT INTO notification (lines 173-176), 4 tests verify columns and link |
| CORR-04 | 07-02 | New offer sends email to assigned negotiator | SATISFIED | offerRoutes.ts emailService.sendEmail (lines 249-252), 5 tests verify subject/body/CRM link |
| COST-01 | 07-03 | Cost ledger aggregates from work_order.invoice_amount | SATISFIED | costLedgerRoutes.ts SQL JOINs work_order, SUM(invoice_amount) confirmed |
| COST-02 | 07-03 | Cost ledger aggregates from property_certification.cost | SATISFIED | costLedgerRoutes.ts SUM(cost) from property_certification confirmed |
| COST-03 | 07-03 | Threshold breach sends email only (not bell notification) | SATISFIED | emailService.sendEmail in check-thresholds endpoint, zero INSERT INTO notification present |
| OFFER-UI | 07-04 | Offer management UI for staff (accept/reject/counter) | HUMAN NEEDED | OffersManagement.tsx (378 lines) + OffersSection.tsx (333 lines) exist and fully wired. Visual behavior requires browser verification. |
| COST-UI | 07-04 | Cost ledger UI on property and landlord pages | HUMAN NEEDED | CostLedger.tsx (352 lines), wired into ManagedPropertyCard and LandlordDetails. Visual rendering requires browser verification. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/costLedgerRoutes.ts | 163-166 | UPSERT uses `ON CONFLICT (property_id)` which requires a UNIQUE constraint on that column in the live database. The error handler catches constraint errors but does not retry. | Info | If the `ALTER TABLE property_cost_threshold ADD CONSTRAINT ... UNIQUE (property_id)` migration was not applied to the live database, the PUT threshold endpoint will return 500. Verify during human testing of the Costs tab. |

No placeholder stubs, no empty return implementations, no TODO/FIXME comments blocking functionality in any phase 07 file.

---

## Human Verification Required

### 1. Offers Dashboard Renders and Filters

**Test:** Navigate to `/crm/offers` in the browser while logged in as a CRM user.
**Expected:** Page loads with filter controls (status dropdown: all/pending/under_review/accepted/rejected/withdrawn, property search field). Table shows offers with property address, formatted GBP amount, buyer name, position badge, chain status, date, status badge.
**Why human:** React component rendering and visual layout cannot be verified programmatically.

### 2. Accept / Reject / Counter Actions

**Test:** From `/crm/offers`, click Accept on a pending offer. Then test Reject (should open dialog for rejection reason). Then test Counter (should open dialog for counter amount input in GBP).
**Expected:** Accept immediately updates offer status. Reject dialog collects reason before submitting. Counter dialog collects GBP amount (converts to pence for API). Table refreshes after each action.
**Why human:** UI interaction flow, dialog behavior, and mutation feedback require browser testing.

### 3. Property Detail Offers Tab and Costs Tab

**Test:** Navigate to a managed property detail page. Verify two new tabs are visible: "Offers" and "Costs".
**Expected:** Offers tab shows OffersSection with same accept/reject/counter actions (without property address column). Costs tab shows maintenance expense table, compliance expense table, running totals, and threshold configuration section.
**Why human:** Tab rendering and data display require browser verification.

### 4. Landlord Detail Costs Tab

**Test:** Navigate to a landlord detail page. Verify "Costs" tab exists.
**Expected:** Costs tab shows CostLedger in landlord mode: per-property breakdown table with maintenance total, compliance total, and combined total per property. Grand total card at top.
**Why human:** Tab rendering and aggregated data display require browser verification.

### 5. Sidebar Offers Navigation Link

**Test:** Verify the CRM sidebar contains an "Offers" link with Handshake icon in the Deals section.
**Expected:** Link appears, navigates to `/crm/offers`, and active state highlights correctly with brand purple (#791E75).
**Why human:** Sidebar rendering and navigation require browser testing.

### 6. GBP Formatting Throughout

**Test:** If test data exists, verify all monetary amounts display in GBP format.
**Expected:** Offer amounts stored in pence (e.g. 35000000) display as £350,000.00. Cost ledger amounts display correctly (e.g. 25000 pence = £250.00). Threshold annual limit shows and saves correctly (input in GBP, stored as pence).
**Why human:** Visual number formatting and input/display conversion require browser verification.

---

## Gaps Summary

No blocking gaps found. All automated must-haves are verified across all four plans (07-01 through 07-04). The 6 human verification items are visual/interactive behaviors inherent to UI components that cannot be verified programmatically and should be checked manually before phase sign-off.

One operational note: the PUT `/properties/:id/cost-threshold` endpoint uses `ON CONFLICT (property_id)` which requires a `UNIQUE (property_id)` constraint on `property_cost_threshold` in the live database. If not applied, the threshold save action will return a 500 error. Verify as part of human testing item 3.

---

_Verified: 2026-03-26T20:00:00Z_
_Verifier: Claude (gsd-verifier)_
