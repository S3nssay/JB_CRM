---
phase: 12-kanban-pipelines-lead-auto-matching
verified: 2026-03-27T21:30:00Z
status: human_needed
score: 6/6 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Drag a property card between columns in the Sales Property Pipeline"
    expected: "Card moves immediately (optimistic update), stage is persisted, PATCH returns 200, toast confirms. If property moves to 'Listed' and a matching lead exists, toast shows the match count."
    why_human: "Cannot verify visual drag-and-drop interaction or optimistic UI update programmatically."
  - test: "Open /crm/lettings-property-pipeline"
    expected: "9 kanban columns render side-by-side: Valuation Enquiry, Valuation Booked, Valuation Completed, Instruction Signed, Listed, Viewings, Holding Deposit, Tenancy Agreed, Move-in Complete. Rent displayed as e.g. '£1,200 pcm'. Empty state message appears if no properties."
    why_human: "Visual layout and column-scroll behaviour require browser render."
  - test: "Open /crm/lead-matches with at least one pending match present"
    expected: "Match card shows property address/price, lead name/email, score badge (colour-coded), reason badges (Budget match, Bedroom match, etc.), 'Approve & Send Details' and 'Dismiss Match' buttons. Approve button triggers email send."
    why_human: "Match card rendering, badge colours, and email delivery require live browser + mail sink."
  - test: "Select multiple pending matches via checkboxes and click 'Approve Selected'"
    expected: "Bulk approve bar appears when at least one checkbox is ticked. Clicking the button fires POST /api/crm/lead-matches/bulk-approve. Toast shows count approved/failed."
    why_human: "Multi-select checkbox state and bulk action toast require browser interaction."
  - test: "Open /crm/landlord-lead-pipeline and change owner type filter to 'Letting Owners'"
    expected: "Only leads with inquiry_type='letting' are shown. Switching to 'Selling Owners' shows only selling leads. Switching back to 'All Owners' shows all."
    why_human: "Filter behaviour requires live data and browser interaction to verify server-side re-fetch."
---

# Phase 12: Kanban Pipelines & Lead Auto-Matching — Verification Report

**Phase Goal:** Kanban pipeline boards for sales (valuation to completion), lettings (valuation to move-in), and landlord leads (with owner-type filtering). Auto-match new listings to leads, with staff approval UI.
**Verified:** 2026-03-27T21:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Sales PropertyPipeline starts from Valuation Enquiry through to Completed with all 9 stages as kanban columns | VERIFIED | `PIPELINE_STAGES` in `PropertyPipeline.tsx` defines all 9 stages starting at `valuation_enquiry`. Page title is "Sales Property Pipeline". `pipeline_stage` used for grouping. |
| 2 | A new Lettings Property Pipeline page shows rental properties from Valuation Enquiry through Move-in Complete | VERIFIED | `LettingsPropertyPipeline.tsx` exists, defines `LETTINGS_PIPELINE_STAGES` with 9 entries ending at `move_in_complete`. Fetches from `/api/crm/lettings-pipeline`. |
| 3 | LandlordLeadPipeline has a type filter to show letting owners, selling owners, or all | VERIFIED | `LandlordLeadPipeline.tsx` has `selectedInquiryType` state with SelectItems for "All Owners", "Letting Owners", "Selling Owners". Query key includes `selectedInquiryType` for server-side filtering. |
| 4 | When a property reaches "Listed" in either pipeline, matching buyer/renter leads are automatically flagged in the CRM | VERIFIED | `crmRoutes.ts` line 2967-2973 fires `createMatchesForProperty` on stage='listed'. `leadMatchingService.ts` inserts rows into `lead_property_match` with status='pending'. |
| 5 | Staff can approve auto-sending property details to matched leads; after approval, details are sent via email | VERIFIED | `LeadMatches.tsx` has approve/dismiss/bulk-approve mutations wired to the API. `approveMatch` in `leadMatchingService.ts` sends a branded HTML email via `emailService.sendEmail`. Note: Success Criterion 5 mentions "email/WhatsApp" but only email is implemented; WhatsApp is not wired. |
| 6 | Each pipeline has its own dedicated page design with workflow-specific card content and actions | VERIFIED | `PropertyPipeline.tsx` (sales) and `LettingsPropertyPipeline.tsx` (lettings) are separate standalone files. Lettings shows rent as "pcm", sales shows price. Terminal Fallen Through/Withdrawn actions exist only on sales. |

**Score:** 6/6 truths verified at the code level. One truth (SC-5) has a partial gap — WhatsApp send is not implemented, only email. Flagged as warning, not blocker, since email path is fully wired.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `shared/schema.ts` | `pipeline_stage` column on properties table | VERIFIED | Line 212: `pipelineStage: text("pipeline_stage").default("listed")` |
| `shared/schema.ts` | Valuation/lettings timestamp columns on properties | VERIFIED | Lines 219-240: all 8 new timestamp + agent columns present |
| `shared/schema.ts` | `leadPropertyMatches` table | VERIFIED | Lines 5793-5806: full table definition with score, reasons, status, approval fields |
| `server/leadMatchingService.ts` | Lead auto-matching engine | VERIFIED | 239 lines. Exports `findMatchingLeads`, `createMatchesForProperty`, `approveMatch`, `dismissMatch`. Scoring: budget 40, bedrooms 25, area 25, type 10. Threshold >= 50. |
| `server/crmRoutes.ts` | Lettings pipeline GET, extended PATCH, lead-matches CRUD | VERIFIED | `/lettings-pipeline` at line 2843, extended PATCH at 2894, lead-matches GET/PATCH/POST at lines 2988-3090+ |
| `client/src/pages/PropertyPipeline.tsx` | 9-stage sales kanban | VERIFIED | PIPELINE_STAGES has 9 entries. Uses `pipeline_stage` for grouping. Terminal actions wired. matchCount toast on Listed. |
| `client/src/pages/LettingsPropertyPipeline.tsx` | 9-stage lettings kanban | VERIFIED | LETTINGS_PIPELINE_STAGES has 9 entries. Fetches from `/api/crm/lettings-pipeline`. Rent displayed as "pcm". |
| `client/src/pages/LandlordLeadPipeline.tsx` | Owner type filter | VERIFIED | Server-side filter with All/Letting/Selling Owners options. Query key includes selected type. |
| `client/src/pages/LeadMatches.tsx` | Lead matches approval page | VERIFIED | 400+ lines. Status filter tabs, match cards with score + reason badges, approve/dismiss/bulk-approve mutations. |
| `client/src/components/CRMLayout.tsx` | Sidebar links for new pages | VERIFIED | "Sales Pipeline" (renamed), "Lettings Pipeline", "Lead Matches" all present. Target icon imported. |
| `client/src/App.tsx` | Route registrations for new pages | VERIFIED | Lines 346-347 register `/crm/lettings-property-pipeline` and `/crm/lead-matches` both BEFORE the `/crm` catch-all at line 454. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/crmRoutes.ts` | `server/leadMatchingService.ts` | lazy `import('./leadMatchingService')` on stage='listed' | WIRED | Line 2969: `const { createMatchesForProperty } = await import('./leadMatchingService')` |
| `server/leadMatchingService.ts` | `shared/schema.ts` / DB | `pool.query` on `lead_property_match` table | WIRED | Lines 47-52 query `lead_property_match` for duplicate check; lines 124-128 insert new matches |
| `client/src/pages/PropertyPipeline.tsx` | `/api/crm/property-pipeline` | `useQuery` fetch | WIRED | Line 104-108: query key and fetchFn both use `/api/crm/property-pipeline` |
| `client/src/pages/LettingsPropertyPipeline.tsx` | `/api/crm/lettings-pipeline` | `useQuery` fetch | WIRED | Lines 94-99: query key and fetchFn use `/api/crm/lettings-pipeline` |
| `client/src/pages/PropertyPipeline.tsx` | `/api/crm/property-pipeline/:id/status` | `useMutation` PATCH | WIRED | Lines 114-119: PATCH with `{ status }` field |
| `client/src/pages/LettingsPropertyPipeline.tsx` | `/api/crm/property-pipeline/:id/status` | `useMutation` PATCH | WIRED | Same endpoint reused for lettings stage updates |
| `client/src/pages/LeadMatches.tsx` | `/api/crm/lead-matches` | `useQuery` + `useMutation` | WIRED | Lines 81-92 fetch; lines 106-152 approve/dismiss/bulk-approve mutations |
| `client/src/pages/LandlordLeadPipeline.tsx` | `/api/crm/landlord-leads?inquiryType=` | `useQuery` with dynamic query key | WIRED | Lines 77-90: query key includes `selectedInquiryType`, URL constructed with URLSearchParams |
| `client/src/App.tsx` | `LettingsPropertyPipeline.tsx` | Route import | WIRED | Line 79 import, line 346 route |
| `client/src/App.tsx` | `LeadMatches.tsx` | Route import | WIRED | Line 80 import, line 347 route |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `PropertyPipeline.tsx` | `properties` array | GET `/api/crm/property-pipeline` | Yes — queries `property` table with `is_rental = false` filter, returns pipeline_stage + timestamps | FLOWING |
| `LettingsPropertyPipeline.tsx` | `properties` array | GET `/api/crm/lettings-pipeline` | Yes — queries `property` table with `is_rental = true` filter | FLOWING |
| `LeadMatches.tsx` | `matches` array | GET `/api/crm/lead-matches` | Yes — queries `lead_property_match` JOIN `lead` JOIN `property` with optional status filter | FLOWING |
| `LeadMatches.tsx` | `stats` array | GET `/api/crm/lead-matches/stats` | Yes — `SELECT status, COUNT(*)` GROUP BY on `lead_property_match` | FLOWING |
| `LandlordLeadPipeline.tsx` | `leads` array | GET `/api/crm/landlord-leads?inquiryType=` | Yes — server already supported `inquiryType` query param (line 2377 per PLAN context) | FLOWING |

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — server must be running to test API responses. All data paths verified at code level above.

---

### Requirements Coverage

The KAN-01..KAN-08 identifiers are used in all three PLAN frontmatters and in ROADMAP.md Phase 12, but are **NOT defined anywhere in REQUIREMENTS.md** and do not appear in its Traceability table. This is the only gap found.

The ROADMAP.md Success Criteria (used as the 6 observable truths above) are the functional contract and all 6 are verified. The gap is purely a traceability/documentation issue, not a functional gap.

| Requirement | Source Plan | Description (from ROADMAP SC) | Status | Evidence |
|-------------|------------|-------------------------------|--------|---------|
| KAN-01 | 12-02, 12-03 | Sales pipeline extends to valuation stages | SATISFIED | PropertyPipeline.tsx, 9-stage PIPELINE_STAGES |
| KAN-02 | 12-02, 12-03 | New lettings pipeline page | SATISFIED | LettingsPropertyPipeline.tsx exists and wired |
| KAN-03 | 12-03 | Landlord lead pipeline owner type filter | SATISFIED | LandlordLeadPipeline.tsx All/Letting/Selling filter |
| KAN-04 | 12-01 | pipeline_stage column + DB schema | SATISFIED | schema.ts line 212, DB migration confirmed by SUMMARY |
| KAN-05 | 12-01, 12-02, 12-03 | Lead auto-matching on Listed | SATISFIED | leadMatchingService.ts + crmRoutes.ts auto-match trigger |
| KAN-06 | 12-02, 12-03 | Dedicated page design per pipeline | SATISFIED | Separate files, different stage sets and card content |
| KAN-07 | 12-01, 12-02 | Match count toast on Listed | SATISFIED | PropertyPipeline.tsx line 125-127 matchCount toast |
| KAN-08 | 12-01, 12-02 | lead_property_match table + CRUD API | SATISFIED | schema.ts leadPropertyMatches + crmRoutes lead-matches endpoints |
| **ORPHANED** | none | KAN-01..KAN-08 not in REQUIREMENTS.md | FAILED | REQUIREMENTS.md has no KAN section and no traceability rows for Phase 12 |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `server/leadMatchingService.ts` | 152-156 | `approveMatch` queries `l.full_name` from the `lead` table | INFO | Correct — the `lead` table schema defines `fullName: text("full_name")` at line 5678. This is valid. |
| Success Criterion 5 | — | SC-5 mentions "email/WhatsApp" but only email is implemented in `approveMatch` | WARNING | WhatsApp delivery path not present. `approveMatch` only calls `emailService.sendEmail`. No WhatsApp send path exists. Not a blocker since the primary delivery channel (email) is fully wired. |

No stub patterns found. No TODO/FIXME comments in phase-created files. No empty return `null` or `[]` without data source. All components fetch from real API endpoints.

---

### Human Verification Required

#### 1. Kanban Card Drag/Advance in Sales Pipeline

**Test:** Open `/crm/property-pipeline`. Advance a property card from one column to the next using the "Move to X" button. Advance a pre-listed property to "Listed".
**Expected:** Card moves immediately; PATCH request returns 200; if any lead matches, toast shows "Property moved. N lead(s) matched!"
**Why human:** Optimistic UI update and toast timing require live browser.

#### 2. Lettings Pipeline Visual Layout

**Test:** Open `/crm/lettings-property-pipeline`.
**Expected:** 9 horizontally-scrolling columns. Rental properties appear in appropriate stage column. Rent shown as "£X,XXX pcm". Empty state message visible if no rental properties in pipeline.
**Why human:** Column layout and horizontal scroll require browser render.

#### 3. Lead Matches Approval Flow

**Test:** Open `/crm/lead-matches` (ensure a pending match exists first by advancing a property to Listed). Click "Approve & Send Details" on a match where the lead has an email address.
**Expected:** Match card updates to "sent" status; toast confirms; lead receives email with property details, price, image, and "View Property" link.
**Why human:** Email delivery requires a mail sink or SMTP configuration to verify receipt.

#### 4. Bulk Approve

**Test:** Select 2+ pending matches via checkboxes, click "Approve Selected (N)".
**Expected:** Bulk approve bar appears with count; POST `/api/crm/lead-matches/bulk-approve` fires; all selected matches change status; toast reports "N matches approved, 0 failed."
**Why human:** Checkbox multi-select state and async batch result require browser interaction.

#### 5. Landlord Lead Owner Type Filter

**Test:** Open `/crm/landlord-lead-pipeline`, switch filter to "Letting Owners", then "Selling Owners", then back to "All Owners".
**Expected:** Each selection triggers a new API call with the appropriate `inquiryType` param; the displayed leads change accordingly.
**Why human:** Server-side filter correctness requires live data with both letting and selling leads in the database.

---

### Gaps Summary

**Functional gaps: None.** All 6 observable truths derived from the ROADMAP.md Success Criteria are verified. Every artifact exists, is substantive, and is wired to real data sources. Route ordering in App.tsx is correct (new routes before catch-all).

**Documentation gap (1 item):** KAN-01 through KAN-08 requirement IDs are referenced in all three PLANs and in ROADMAP.md but are completely absent from REQUIREMENTS.md. The REQUIREMENTS.md traceability table ends at Phase 10 (BIZ-09). Phase 12 requirements are neither described nor tracked in the requirements document. This means the requirements are orphaned — traceable to plans but not to a requirements definition.

**Minor warning:** Success Criterion 5 states "details are sent via email/WhatsApp" but only email is implemented. The WhatsApp delivery path (`approveMatch` in `leadMatchingService.ts`) only calls `emailService.sendEmail`. This is not a blocker — email is the primary channel stated in the Plan decisions — but the ROADMAP success criterion overstates the implementation.

---

_Verified: 2026-03-27T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
