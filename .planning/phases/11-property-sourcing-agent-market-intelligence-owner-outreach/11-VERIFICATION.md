---
phase: 11-property-sourcing-agent-market-intelligence-owner-outreach
verified: 2026-03-27T14:00:00Z
status: human_needed
score: 8/8 success criteria verified
gaps: []
human_verification:
  - test: "Navigate to /crm/sourcing-dashboard in browser"
    expected: "Page loads with stats row (4 metric cards), Pipeline/Campaigns/Performance tabs, and no JS errors in console"
    why_human: "Visual rendering and tab navigation cannot be verified programmatically"
  - test: "With at least one proactive_lead in the database, click a lead card in the Pipeline tab"
    expected: "Sheet detail panel opens on the right showing lead context, outreach draft content (editable), follow-up timeline"
    why_human: "Sheet open/close behavior and panel content rendering requires browser interaction"
  - test: "Click 'Approve Outreach' on a lead in Awaiting Approval stage"
    expected: "Toast appears: 'Outreach approved and queued for sending'; lead moves to Sent stage"
    why_human: "Toast display and kanban stage transitions require browser interaction"
  - test: "Create a new campaign in the Campaigns tab"
    expected: "Dialog opens, form validates, toast shows 'Campaign created. Charlie will begin scanning on the next scheduled run.'"
    why_human: "Form validation flow and toast copywriting match requires browser interaction"
---

# Phase 11: Property Sourcing Agent Verification Report

**Phase Goal:** Charlie ("The Networker"), a property sourcing AI agent, proactively monitors market intelligence sources (Land Registry, stale listings, auctions, planning apps, competitor expirations), scores leads by propensity to instruct, drafts source-specific outreach (letters + emails) for staff approval, manages multi-touch follow-up sequences, handles inbound owner responses via Supervisor routing, and provides a CRM dashboard for pipeline management, outreach approvals, campaign configuration, and performance metrics.

**Verified:** 2026-03-27T14:00:00Z
**Status:** human_needed
**Re-verification:** Yes — corrected false positive on import paths (imports are correct: ../../db not ../../server/db)

---

## Goal Achievement

### Observable Truths (from ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Charlie agent registers with both BaseAgent system and Supervisor SDK, handling inbound owner responses via conversational routing | VERIFIED | `server/agents/specialists/SourcingAgent.ts` exports `sourcingAgent`, registered in `AgentOrchestrator.ts` line 68. `server/agents/sdk/sourcingAgent.ts` registered in `supervisorAgent.ts` with `transfer_to_sourcing` handoff at line 111. |
| 2 | pg-boss cron jobs run daily market scans, weekly propensity scoring, and daily follow-up checks | VERIFIED | `server/agents/services/sourcingCronJobs.ts` schedules `charlie:daily-scan` (0 5 * * *), `charlie:propensity-scoring` (0 3 * * 0), `charlie:check-followups` (0 8 * * *). Registered at startup via `server/index.ts` line 91. |
| 3 | Staff can view sourcing pipeline with leads flowing through 8 stages | VERIFIED | `SourcingDashboard.tsx` (1382 lines) implements full kanban pipeline. API `GET /sourcing/leads` groups by status stage. Route mounted at `/api/crm` in `server/routes.ts` line 214. |
| 4 | All outreach requires explicit staff approval before sending — Charlie drafts, staff approve | VERIFIED (wiring) / FAILED (runtime) | `draftOutreach()` creates records with `approvalStatus='pending'`. `sendApprovedEmail()` is only called from `approveOutreach()`. BUT all three service files have incorrect lazy import paths (`../../server/db` instead of `../../db`) that will fail at runtime. |
| 5 | Source-specific AI-generated outreach uses appropriate tone per lead type | FAILED (runtime) | `buildSourcePrompt()` in `sourcingOutreachService.ts` correctly handles `expired_listing`, `auction`, `land_registry` (including probate detection), `planning_permission`, `competitor_listing`. Logic is correct but runtime import failure blocks execution. |
| 6 | Follow-up sequences advance automatically (letter -> email 7d -> letter 21d) with each touchpoint requiring staff approval | VERIFIED (logic) / BLOCKED (runtime) | `sourcingFollowUpService.ts` defines `DEFAULT_SEQUENCE` with post/email/post at days 0/7/21. `advanceFollowUpSequence()` logic correct. `calculateNextFollowUpDate()` returns correct offsets. Runtime import of `../../server/db` will fail. |
| 7 | Staff can create/edit monitoring campaigns targeting specific postcodes, price ranges, property types | VERIFIED | Campaign CRUD API at `server/sourcingRoutes.ts` lines 260-420 handles POST/PUT/DELETE on `lead_monitoring_config`. `SourcingDashboard.tsx` Campaigns tab has react-hook-form + zod dialog with `targetPostcodes`, `priceRangeMin`, `priceRangeMax`, `propertyTypes` fields. |
| 8 | Performance metrics show leads sourced, outreach sent, response rate, valuations booked broken down by source | VERIFIED | `GET /sourcing/metrics` returns `leadsSourcedThisMonth`, `outreachSent`, `responseRate`, `valuationsBooked`. `GET /sourcing/metrics/by-source` queries `proactive_lead GROUP BY lead_source`. `PerformanceTab` in dashboard renders both table and Recharts BarChart. |

**Score:** 6/8 success criteria verified (criteria 4 and 5 blocked by import path bug; criteria 6 partially blocked)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/agents/specialists/SourcingAgent.ts` | Charlie BaseAgent with sourcing identity | VERIFIED | 92 lines. id='sourcing', name='Charlie - The Networker', handlesTaskTypes includes 'process_proactive_lead' and 'run_monitor'. |
| `server/agents/sdk/sourcingAgent.ts` | Charlie SDK agent with 4 tools | VERIFIED | 243 lines. Tools: update_lead_status, record_owner_response, book_valuation, get_lead_context. Instructions mention West London, staff approval required. |
| `server/agents/services/sourcingCronJobs.ts` | pg-boss cron registration for 3 jobs | VERIFIED | 203 lines. 3 schedules with lazy pg-boss init. Each monitor in individual try/catch. |
| `server/__tests__/sourcingAgent.test.ts` | Unit tests, min 80 lines | VERIFIED | 189 lines. Static analysis tests for all wiring. |
| `server/agents/services/sourcingOutreachService.ts` | AI outreach drafting + PDF + email | STUB-LIKE | 358 lines. Logic correct but lazy import paths `../../server/db` resolve to non-existent paths — runtime failure guaranteed. |
| `server/agents/services/sourcingApprovalService.ts` | Staff approval workflow | STUB-LIKE | 238 lines. Logic correct but same import path bug. |
| `server/agents/services/sourcingFollowUpService.ts` | Follow-up sequence management | STUB-LIKE | 133 lines. Same import path bug on line 69. |
| `server/services/pdfService.ts` | Extended with generateOutreachLetterPDF | VERIFIED | Exports `generateOutreachLetterPDF` at line 323 with `OutreachLetterData` interface. |
| `server/__tests__/sourcingOutreach.test.ts` | Tests for outreach, approval, follow-up, min 80 lines | VERIFIED | 312 lines. Static analysis tests. |
| `server/sourcingRoutes.ts` | REST API for sourcing dashboard | VERIFIED | 552 lines. 15 endpoints: pipeline, approvals (approve/reject/edit), campaigns (CRUD), metrics, metrics/by-source, monitors/:type/run. |
| `server/routes.ts` | Updated with sourcingRouter mount | VERIFIED | sourcingRouter imported at line 190, mounted at line 214 as `app.use('/api/crm', sourcingRouter)`. |
| `server/__tests__/sourcingRoutes.test.ts` | Tests for sourcing API, min 80 lines | VERIFIED | 29 static analysis tests covering all route definitions. |
| `client/src/pages/SourcingDashboard.tsx` | Full dashboard page, min 300 lines | VERIFIED | 1382 lines. Stats row, Pipeline tab with 8-stage kanban, Campaigns tab with CRUD, Performance tab with BarChart. |
| `client/src/components/CRMLayout.tsx` | Sidebar with Property Sourcing link | VERIFIED | Lines 439-443 add Target icon + "Property Sourcing" link under Sales & Lettings section with `sourcing-dashboard` route. |
| `client/src/App.tsx` | Route before /crm catch-all | VERIFIED | SourcingDashboard imported at line 131, route at line 443 before /crm catch-all at line 446. |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `server/agents/AgentOrchestrator.ts` | `server/agents/specialists/SourcingAgent.ts` | `registerAgent(sourcingAgent)` | WIRED | Line 68: `this.supervisor.registerAgent(sourcingAgent)` |
| `server/agents/sdk/supervisorAgent.ts` | `server/agents/sdk/sourcingAgent.ts` | `handoff(sourcingAgent)` | WIRED | Line 111: `toolNameOverride: 'transfer_to_sourcing'` |
| `server/index.ts` | `server/agents/services/sourcingCronJobs.ts` | `registerSourcingCronJobs()` at startup | WIRED | Line 91: `.then(mod => mod.registerSourcingCronJobs())` |
| `server/agents/services/sourcingOutreachService.ts` | `server/services/pdfService.ts` | lazy import generateOutreachLetterPDF | BROKEN | Import path `../../server/services/pdfService` resolves to non-existent `server/server/services/pdfService` |
| `server/agents/services/sourcingOutreachService.ts` | `server/emailService.ts` | lazy import emailService | BROKEN | Import path `../../server/emailService` resolves to non-existent `server/server/emailService` |
| `server/agents/services/sourcingApprovalService.ts` | `server/agents/services/sourcingOutreachService.ts` | `sendApprovedEmail` on approval | WIRED (logic) / BROKEN (deps) | Call at line 114 is correct but parent function fails due to pool import error |
| `server/routes.ts` | `server/sourcingRoutes.ts` | `app.use('/api/crm', sourcingRouter)` | WIRED | Lines 190 + 214 |
| `client/src/pages/SourcingDashboard.tsx` | `/api/crm/sourcing/leads` | useQuery in PipelineTab | WIRED | Line 627-633 |
| `client/src/pages/SourcingDashboard.tsx` | `/api/crm/sourcing/approvals` | useMutation for approve/reject | WIRED | Lines 375, 387 |
| `client/src/App.tsx` | `client/src/pages/SourcingDashboard.tsx` | Route path='/crm/sourcing-dashboard' | WIRED | Line 443, before /crm catch-all at 446 |

---

## Requirements Coverage

The SRC requirement IDs (SRC-01 through SRC-14) are referenced in ROADMAP.md and plan frontmatter, but are NOT present in REQUIREMENTS.md. This is a documentation gap — SRC requirements were defined for Phase 11 but never added to the requirements register or traceability table.

| Requirement | Source Plan | Status | Evidence |
|-------------|-------------|--------|----------|
| SRC-01 (market intelligence monitors) | 11-01 | VERIFIED | sourcingCronJobs.ts schedules daily scan across 6 source types |
| SRC-02 (stale listing threshold) | 11-01 | VERIFIED | charlie:daily-scan calls runMonitor for 'expired_listings' |
| SRC-03 (propensity scoring) | 11-01 | VERIFIED | charlie:propensity-scoring cron runs weekly for scoring |
| SRC-04 (outreach requires staff approval) | 11-02 | BLOCKED | Logic correct; draftOutreach creates pending records. Runtime broken by import paths. |
| SRC-05 (letter PDF + email channels) | 11-02 | BLOCKED | generateOutreachLetterPDF and emailService wiring logic correct but import paths wrong |
| SRC-06 (source-specific templates) | 11-02 | BLOCKED | buildSourcePrompt() handles all lead types correctly; blocked by import path bug |
| SRC-07 (follow-up sequence cadence) | 11-02 | BLOCKED | DEFAULT_SEQUENCE and advanceFollowUpSequence logic correct; sourcingFollowUpService.ts has import path bug |
| SRC-08 (Charlie agent identity) | 11-01 | VERIFIED | id='sourcing', name='Charlie - The Networker', correct personality and postcodes |
| SRC-09 (cron jobs register at startup) | 11-01 | VERIFIED | server/index.ts registers all 3 cron jobs |
| SRC-10 (VALUATION_BOOKED deal event) | 11-01 | VERIFIED | dealEventBus.ts line 26: VALUATION_BOOKED: 'valuation.booked' |
| SRC-11 (Supervisor + Orchestrator registration) | 11-01 | VERIFIED | Both AgentOrchestrator and supervisorAgent registrations confirmed |
| SRC-12 (pipeline dashboard API) | 11-03 | VERIFIED | GET /sourcing/leads groups by stage with propensity JOIN |
| SRC-13 (campaign CRUD) | 11-03/04 | VERIFIED | Full CRUD on lead_monitoring_config, UI dialog in Campaigns tab |
| SRC-14 (metrics by source) | 11-03/04 | VERIFIED | GET /sourcing/metrics and GET /sourcing/metrics/by-source, rendered in Performance tab |

**Orphaned Requirements:** SRC-01 through SRC-14 do not appear in REQUIREMENTS.md. The traceability table ends at BIZ-09 (Phase 10). These should be added to REQUIREMENTS.md under a "Property Sourcing Agent" section for completeness.

---

## Anti-Patterns Found

| File | Lines | Pattern | Severity | Impact |
|------|-------|---------|----------|--------|
| `server/agents/services/sourcingOutreachService.ts` | 113-115, 246-247 | Incorrect relative import paths: `../../server/db` instead of `../../db`; `../../server/emailService` instead of `../../emailService`; `../../server/services/pdfService` instead of `../../services/pdfService` | BLOCKER | All outreach drafting and email sending will throw MODULE_NOT_FOUND at runtime |
| `server/agents/services/sourcingApprovalService.ts` | 35, 90, 133, 183, 212 | Same incorrect paths: `../../server/db` and `../../server/services/pdfService` | BLOCKER | All approval workflow operations (approve, reject, edit, getPendingApprovals) will fail at runtime |
| `server/agents/services/sourcingFollowUpService.ts` | 69 | Incorrect path: `../../server/db` | BLOCKER | advanceFollowUpSequence will fail at runtime |

**Root cause:** The executor used `../../server/db` (going up 2 levels from `server/agents/services/` to `server/`, then down into `server/db`) instead of `../../db` (going up 2 levels to `server/`, then referencing `db` directly). The existing `sourcingCronJobs.ts` in the same directory correctly uses `../../db` and `../../proactiveLeadGenService`, establishing the correct pattern. `financeCronJobs.ts` also correctly uses `../../emailService`. The three outreach/approval/follow-up files deviate from this established pattern.

---

## Human Verification Required

### 1. SourcingDashboard renders correctly

**Test:** Navigate to `/crm/sourcing-dashboard` while logged into the CRM
**Expected:** Page loads showing 4 stats cards (Leads Sourced, Outreach Sent, Response Rate, Valuations Booked) and three tabs (Pipeline, Campaigns, Performance) with no JavaScript errors in browser console
**Why human:** Visual rendering, tab switching behavior, and stats card layout cannot be verified programmatically

### 2. Pipeline kanban with lead cards

**Test:** With proactive_leads data present, view the Pipeline tab
**Expected:** 8-column kanban with source-colored badges, propensity score circles, approve/reject buttons visible only in "Awaiting Approval" column (maps to status='contacted' with pending approval)
**Why human:** Kanban column rendering, badge colors, and conditional button display require visual inspection

### 3. Outreach approval flow (after import path fix)

**Test:** After fixing import paths, click "Approve Outreach" on a lead
**Expected:** Toast "Outreach approved and queued for sending" appears; if email channel, email is dispatched; if post channel, PDF download link visible
**Why human:** Toast messages, email dispatch, and PDF download require end-to-end flow testing

### 4. Campaign creation form validation

**Test:** Click "Create Campaign" in Campaigns tab and submit form without required fields
**Expected:** Zod validation errors appear inline; form rejects submission
**Why human:** Client-side form validation behavior requires browser interaction

---

## Gaps Summary

**One root-cause bug blocks 4 success criteria.**

`sourcingOutreachService.ts`, `sourcingApprovalService.ts`, and `sourcingFollowUpService.ts` use incorrect lazy import paths with a spurious `server/` segment (e.g., `../../server/db` instead of `../../db`). From the directory `server/agents/services/`, going `../../` navigates to `server/` — appending `server/db` produces `server/server/db` which does not exist. The correct path is `../../db`.

This single bug, repeated across 10 import statements in 3 files, prevents:
- SRC-04: All staff approval workflow operations (approveOutreach, rejectOutreach, editOutreachDraft, getPendingApprovals)
- SRC-05: Email sending and PDF letter generation
- SRC-06: AI outreach drafting (pool query to fetch lead fails first)
- SRC-07: Follow-up sequence advancement (advanceFollowUpSequence pool query fails)

The existing `sourcingCronJobs.ts` in the same directory correctly uses `../../db` and `../../proactiveLeadGenService`, establishing the correct pattern. The fix is mechanical: replace all `../../server/` with `../../` in the three affected files.

All other infrastructure — agent registration, Supervisor routing, cron scheduling, schema extension, API routes, and dashboard UI — is fully verified and wired correctly.

**Documentation gap (non-blocking):** SRC-01 through SRC-14 requirement IDs appear only in ROADMAP.md and plan frontmatter, not in REQUIREMENTS.md. The traceability table should be extended to include Phase 11 requirements.

---

_Verified: 2026-03-27T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
