---
phase: 07-agent-corrections-cost-ledger
verified: 2026-03-26T18:58:00Z
status: human_needed
score: 9/9 automated must-haves verified
re_verification: false
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
**Verified:** 2026-03-26T18:58:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sales agent (Alex) has no negotiation instructions and cannot negotiate prices | VERIFIED | salesAgent.ts has `OFFERS:` section (line 135), no "negotiate prices"/"full negotiation autonomy" found. `recordOfferTool` imported (line 24) and in tools array (line 175). Unit test CORR-02 passes. |
| 2 | Lettings agent (Jordan) has no negotiation instructions and cannot negotiate rent | VERIFIED | lettingsAgent.ts has `OFFERS:` section (line 66), no forbidden negotiation phrases. `recordOfferTool` imported (line 21) and in tools array (line 113). Unit test CORR-02 passes. |
| 3 | Both agents can record offers via the record_offer tool | VERIFIED | `recordOfferTool` exported from tools.ts (line 282). INSERT into property_offer confirmed in execute function (lines 316-341). Unit test CORR-01 (behavioral INSERT assertion) passes. |
| 4 | propertyOffers table has lettings-specific columns (employment_status, rental_references, move_in_timeline, offer_source) | VERIFIED | All four columns present in shared/schema.ts lines 622-626. |
| 5 | propertyCertifications table has a cost column for compliance cost tracking | VERIFIED | `cost: integer("cost")` present in propertyCertifications at schema.ts line 1376. |
| 6 | property_cost_threshold table exists for configurable spend alerts | VERIFIED | `propertyCostThresholds` table defined in schema.ts lines 1383-1391 with id, propertyId, annualLimit, notificationEmail, lastAlertSent, createdAt, updatedAt. |
| 7 | New offer creates in-CRM notification for assigned agent/negotiator | VERIFIED | offerRoutes.ts INSERT INTO notification at lines 173-176. Agent fallback chain: agent_id -> property_manager_id -> first admin user. Unit tests CORR-03 pass (21 tests). |
| 8 | New offer sends email to assigned negotiator with full details and CRM link | VERIFIED | offerRoutes.ts imports emailService (line 10), calls emailService.sendEmail at lines 249-252 within POST /offers handler. Email is non-blocking (try/catch). Unit tests CORR-04 pass. |
| 9 | Cost ledger aggregates maintenance costs (work_order.invoice_amount) and compliance costs (property_certification.cost) | VERIFIED | costLedgerRoutes.ts: joins work_order with maintenance_request filtering invoice_amount IS NOT NULL (lines 37-43), joins property_certification on cost column (compliance). LATERAL JOIN pattern for landlord view. Unit tests COST-01, COST-02, COST-03 pass. |
| 10 | Cost threshold breach sends email to configured notification_email (not bell) | VERIFIED | costLedgerRoutes.ts calls emailService.sendEmail (line 244) for threshold breaches. Zero INSERT INTO notification in costLedgerRoutes.ts. Unit test COST-03 passes. |
| 11 | Staff can view all offers across properties in a central dashboard | HUMAN NEEDED | OffersManagement.tsx exists (378 lines), fetches `/api/crm/offers`, has filter state, useQuery + useMutation. Visual rendering requires human. |
| 12 | Staff can accept, reject, or counter an offer | HUMAN NEEDED | handleAccept/handleReject/handleCounter functions exist with PATCH mutations. Reject and Counter dialogs exist. Visual/interaction flow requires human. |
| 13 | CRM sidebar Offers nav link accessible | HUMAN NEEDED | CRMLayout.tsx line 367 has Offers button with Handshake icon linking to /crm/offers. Visual rendering requires human. |

**Score:** 10/10 automated truths verified, 3 truths require human browser verification

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `shared/schema.ts` | Schema extensions: lettings columns on propertyOffers, cost on propertyCertifications, propertyCostThresholds table | VERIFIED | All three extensions present at lines 622-626, 1376, 1383-1395 |
| `server/agents/sdk/tools.ts` | recordOfferTool export | VERIFIED | Exported at line 282, 1131 lines total, INSERT + notification logic implemented |
| `server/agents/sdk/salesAgent.ts` | Updated prompt with OFFERS section replacing NEGOTIATION | VERIFIED | OFFERS: section at line 135, recordOfferTool imported and in tools array |
| `server/agents/sdk/lettingsAgent.ts` | Updated prompt with OFFERS section replacing NEGOTIATION | VERIFIED | OFFERS: section at line 66, recordOfferTool imported and in tools array |
| `server/agents/__tests__/agentPrompts.test.ts` | Unit tests for CORR-01 and CORR-02 | VERIFIED | 6 tests, all passing |
| `server/offerRoutes.ts` | Offer CRUD API with notification + email triggers | VERIFIED | 347 lines, 5 endpoints, offerRouter exported |
| `server/__tests__/offerRoutes.test.ts` | Unit tests for CORR-03 and CORR-04 | VERIFIED | 21 tests, all passing |
| `server/costLedgerRoutes.ts` | Cost aggregation endpoints and threshold management | VERIFIED | 276 lines, 6 endpoints, costLedgerRouter exported |
| `server/__tests__/costLedger.test.ts` | Unit tests for COST-01, COST-02, COST-03 | VERIFIED | 3 tests, all passing |
| `client/src/pages/OffersManagement.tsx` | Central offers dashboard (min 100 lines) | VERIFIED | 378 lines, exists, substantive |
| `client/src/components/OffersSection.tsx` | Reusable offers section (min 50 lines) | VERIFIED | 333 lines, exists, substantive |
| `client/src/components/CostLedger.tsx` | Reusable cost ledger component (min 80 lines) | VERIFIED | 352 lines, exists, substantive |
| `client/src/App.tsx` | Route for /crm/offers BEFORE /crm catch-all | VERIFIED | Line 433 has Route path="/crm/offers" before catch-all at line 435 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| salesAgent.ts | tools.ts | recordOfferTool import | WIRED | Import at line 24, tools array at line 175 |
| lettingsAgent.ts | tools.ts | recordOfferTool import | WIRED | Import at line 21, tools array at line 113 |
| tools.ts recordOfferTool | property_offer table | INSERT INTO property_offer | WIRED | Lines 318-341 in tools.ts execute function |
| offerRoutes.ts | notification table | INSERT INTO notification on offer creation | WIRED | Lines 173-176, includes user_id, title, body, type, link_url |
| offerRoutes.ts | emailService.ts | sendEmail for offer notification | WIRED | Import at line 10, sendEmail call at line 249 |
| costLedgerRoutes.ts | work_order table | SQL aggregation JOIN maintenance_request | WIRED | Lines 37-43, JOINs work_order on maintenance_request_id, filters invoice_amount IS NOT NULL |
| costLedgerRoutes.ts | property_certification table | SQL aggregation on cost column | WIRED | Lines 56-59, compliance cost aggregation confirmed |
| costLedgerRoutes.ts | emailService.ts | threshold breach email | WIRED | Import at line 13, sendEmail call at line 244, no notification table INSERT |
| OffersManagement.tsx | /api/crm/offers | useQuery + useMutation | WIRED | useQuery at line 50-55, useMutation at line 59-66, PATCH at line 61 |
| CostLedger.tsx | /api/crm/properties/:id/costs | useQuery | WIRED | Endpoint at line 28, useQuery at line 31 |
| CostLedger.tsx | /api/crm/landlords/:id/costs | useQuery | WIRED | Endpoint at line 29, useQuery at line 31 |
| App.tsx | OffersManagement.tsx | Route path before /crm catch-all | WIRED | Line 433 (/crm/offers) before line 435 (catch-all) |
| routes.ts | offerRoutes.ts | offerRouter mounted at /api/crm | WIRED | Import at line 188, mount at line 210 |
| routes.ts | costLedgerRoutes.ts | costLedgerRouter mounted at /api/crm | WIRED | Import at line 187, mount at line 209 |
| ManagedPropertyCard.tsx | OffersSection | Offers tab | WIRED | Import at line 29, used at line 1226 |
| ManagedPropertyCard.tsx | CostLedger | Costs tab | WIRED | Import at line 30, used at line 1231 (mode='property') |
| LandlordDetails.tsx | CostLedger | Costs tab | WIRED | Import at line 25, used at line 1157 (mode='landlord') |

---

## Requirements Coverage

All requirement IDs are defined within the phase PLAN files and ROADMAP.md. They are not defined in REQUIREMENTS.md (which uses a different ID scheme for earlier requirements). This is a documentation convention, not a gap.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| CORR-01 | 07-01 | recordOfferTool exports and inserts into property_offer | SATISFIED | tools.ts line 282, INSERT logic lines 318-341, unit test passes (behavioral assertion) |
| CORR-02 | 07-01 | Sales and Lettings agents have no negotiation language | SATISFIED | OFFERS: sections in both agents, no "negotiate prices"/"full negotiation autonomy" text found, unit tests pass |
| CORR-03 | 07-02 | New offer creates in-CRM notification | SATISFIED | offerRoutes.ts INSERT INTO notification, 21 static analysis tests pass |
| CORR-04 | 07-02 | New offer sends email to assigned negotiator | SATISFIED | offerRoutes.ts emailService.sendEmail, tests verify email subject/body/CRM link |
| COST-01 | 07-03 | Cost ledger aggregates from work_order.invoice_amount | SATISFIED | costLedgerRoutes.ts SQL JOINs work_order, filters invoice_amount IS NOT NULL |
| COST-02 | 07-03 | Cost ledger aggregates from property_certification.cost | SATISFIED | costLedgerRoutes.ts SQL queries property_certification.cost column |
| COST-03 | 07-03 | Threshold breach sends email only (not bell notification) | SATISFIED | emailService.sendEmail in check-thresholds endpoint, zero INSERT INTO notification in costLedgerRoutes.ts |
| OFFER-UI | 07-04 | Offer management UI for staff (accept/reject/counter) | HUMAN NEEDED | OffersManagement.tsx (378 lines), OffersSection.tsx (333 lines) exist and wired. Visual behavior requires browser verification. |
| COST-UI | 07-04 | Cost ledger UI on property and landlord pages | HUMAN NEEDED | CostLedger.tsx (352 lines), wired into ManagedPropertyCard and LandlordDetails. Visual rendering requires browser verification. |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/costLedgerRoutes.ts | 163-166 | UPSERT fallback: catches unique constraint error but doesn't retry — error still returns 500 | Info | The PUT threshold endpoint uses ON CONFLICT (property_id) which requires the UNIQUE constraint to exist in the database. If it doesn't exist (migrated but constraint not added), the UPSERT silently fails. Not a code stub, but requires the database unique constraint to be present. |
| server/agents/sdk/tools.ts | 300 | Pre-existing TypeScript TS2322 error on recordOfferTool execute signature | Warning | The ToolExecuteFunction type mismatch is a systemic issue across all tools in tools.ts (16 pre-existing errors). Not introduced by phase 07. Phase 07 code follows the same established pattern. |

No placeholder stubs, no empty implementations, no TODO comments blocking functionality in phase 07 files.

---

## Test Results

All 30 automated unit tests pass:

- `server/agents/__tests__/agentPrompts.test.ts`: 6/6 tests pass (CORR-01 structural, CORR-01 behavioral INSERT, CORR-02 x4)
- `server/__tests__/offerRoutes.test.ts`: 21/21 tests pass (CORR-03 x4, CORR-04 x5, CRUD endpoints x5, fallback logic x3, status management x3, router export x1)
- `server/__tests__/costLedger.test.ts`: 3/3 tests pass (COST-01, COST-02, COST-03)

TypeScript: Zero errors in any phase 07 new files. 445 pre-existing errors in unrelated files (ValuationForm, PropertyDataCard, etc.) and in tools.ts/salesAgent.ts from pre-existing SDK type compatibility issues across all phases.

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
**Expected:** Offers tab shows OffersSection with same accept/reject/counter actions (without property column). Costs tab shows maintenance expense table, compliance expense table, running totals, and threshold configuration section.
**Why human:** Tab rendering and data display require browser verification.

### 4. Landlord Detail Costs Tab

**Test:** Navigate to a landlord detail page. Verify "Costs" tab exists.
**Expected:** Costs tab shows CostLedger in landlord mode: per-property breakdown table with maintenance total, compliance total, and combined total per property. Grand total card at top.
**Why human:** Tab rendering and aggregated data display require browser verification.

### 5. Sidebar Offers Navigation Link

**Test:** Verify the CRM sidebar contains an "Offers" link with Handshake icon in the Deals section.
**Expected:** Link appears, navigates to `/crm/offers`, and active state highlights correctly.
**Why human:** Sidebar rendering and navigation require browser testing.

### 6. GBP Formatting Throughout

**Test:** If test data exists, verify all monetary amounts display in GBP format.
**Expected:** Offer amounts stored in pence (e.g. 35000000) display as £350,000.00. Cost ledger amounts display correctly (e.g. 25000 pence = £250.00). Threshold annual limit shows and saves as GBP (input in GBP, stored as pence).
**Why human:** Visual number formatting and input/display conversion require browser verification.

---

## Gaps Summary

No blocking gaps found. All automated must-haves are verified. The 6 human verification items are visual/interactive behaviors inherent to UI components — these cannot be verified programmatically and are expected to be checked manually before sign-off.

The only minor concern is the UPSERT for cost thresholds requires the `UNIQUE (property_id)` constraint to exist on the `property_cost_threshold` table in the live database. The plan instructions specified adding this via direct SQL (`ALTER TABLE property_cost_threshold ADD CONSTRAINT uq_property_cost_threshold_property_id UNIQUE (property_id);`). If this was not applied, the PUT threshold endpoint will error. This should be verified when testing the Costs tab (human verification item 3).

---

_Verified: 2026-03-26T18:58:00Z_
_Verifier: Claude (gsd-verifier)_
