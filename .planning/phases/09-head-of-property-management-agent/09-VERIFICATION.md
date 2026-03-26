---
phase: 09-head-of-property-management-agent
verified: 2026-03-26T20:40:00Z
status: gaps_found
score: 6/9 must-haves verified
gaps:
  - truth: "Proactive monitoring runs via pg-boss cron without manual trigger"
    status: partial
    reason: "registerPortfolioMonitorJobs is registered on startup in server/index.ts, but the weekly health report SQL query references a non-existent table 'maintenance_ticket' (should be... wait, maintenance_ticket IS in schema). The blocking issue is that both portfolioMonitorService.ts and pmOverviewRoutes.ts use 'properties' (plural) and 'landlords' (plural) as SQL table names, but the actual database tables are 'property' (singular) and 'landlord' (singular) per shared/schema.ts. Both cron jobs will throw SQL errors at runtime."
    artifacts:
      - path: "server/services/portfolioMonitorService.ts"
        issue: "Uses 'properties' (line 89, 198) and 'landlords' (line 90, 199) which do not exist in the database. Schema defines 'property' and 'landlord' (singular)."
    missing:
      - "Replace 'FROM properties' with 'FROM property' (lines 89, 198)"
      - "Replace 'JOIN properties' with 'JOIN property' (line 89)"
      - "Replace 'JOIN landlords' with 'JOIN landlord' (line 90, 199)"

  - truth: "PM overview API returns per-property health data, compliance alerts, and agent activity metrics"
    status: failed
    reason: "pmOverviewRoutes.ts uses 'properties' (plural) and 'landlords' (plural) as SQL table names throughout. The actual database tables are 'property' and 'landlord' (singular per shared/schema.ts lines 86, 850). All three endpoints will fail with PostgreSQL 'relation does not exist' errors at runtime."
    artifacts:
      - path: "server/pmOverviewRoutes.ts"
        issue: "Uses 'properties' (lines 36, 45, 93, 102, 111, 120, 128, 136) and 'landlords' (lines 37, 94) — neither table exists. Schema table is 'property' and 'landlord' (singular)."
      - path: "server/__tests__/pmOverview.test.ts"
        issue: "Static analysis tests validate the wrong table names — they assert 'JOIN properties' and 'JOIN landlords' are present, which masks the production bug."
    missing:
      - "Replace all 'properties' with 'property' in pmOverviewRoutes.ts SQL queries"
      - "Replace all 'landlords' with 'landlord' in pmOverviewRoutes.ts SQL queries"
      - "Update pmOverview.test.ts assertions to check for 'property' and 'landlord' (singular)"

  - truth: "Staff can view a PM overview with compliance alerts, portfolio health scores, and agent activity summary"
    status: partial
    reason: "The PMTrackingDashboard.tsx correctly fetches from the API endpoints and renders the widget data. The frontend is fully wired. However, the API endpoints it calls will return 500 errors at runtime due to the wrong table names in pmOverviewRoutes.ts. The UI renders loading spinners indefinitely when queries fail."
    artifacts:
      - path: "server/pmOverviewRoutes.ts"
        issue: "Runtime SQL failures mean the dashboard widgets cannot display data"
    missing:
      - "Fix table names in pmOverviewRoutes.ts so the API endpoints return valid data"
---

# Phase 9: Head of Property Management Agent — Verification Report

**Phase Goal:** Jamie, the Head of Property Management agent, provides a supervisory coordination layer over Morgan (maintenance), Sarah (arrears), Sam (admin), and Taylor (finance) — offering cross-domain portfolio awareness, proactive compliance monitoring with daily certification expiry checks, portfolio health scoring, and a landlord-facing conversational interface for portfolio-level questions.

**Verified:** 2026-03-26T20:40:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Jamie (headOfPMAgent) exports correctly with persona, tools, and handoffs | VERIFIED | headOfPMAgent.ts exports Jamie with 8 tools, 3 active handoffs, full persona instructions |
| 2 | Jamie has handoff access to Morgan, Sarah, and Sam (Taylor stub per design) | VERIFIED | delegate_to_maintenance, delegate_to_arrears, delegate_to_admin all present; financeAgent commented out with Phase 8 marker |
| 3 | Cross-domain query tools return structured data spanning maintenance, compliance, arrears, finance, and tenancy | VERIFIED | 7 tools in headOfPMTools.ts with real SQL queries using correct table names (property, landlord, maintenance_request, arrears, tenancy) |
| 4 | Supervisor routes portfolio/oversight queries to Jamie while keeping Morgan direct for fault reports | VERIFIED | supervisorAgent.ts imports headOfPMAgent, adds transfer_to_head_of_pm handoff, preserves transfer_to_property_management for Morgan |
| 5 | Landlord portfolio queries resolve by landlordId and return holistic property data | VERIFIED | lookupLandlordPortfolioTool searches phone/mobile/email; queryPortfolioOverviewTool takes landlordId and runs 5 parallel queries |
| 6 | Daily compliance check identifies certifications expiring within 30 days and sends email alert to PM staff | PARTIAL | handleComplianceCheck logic is correct, but the weekly health report uses wrong table name 'properties' (should be 'property') and 'landlords' (should be 'landlord'). The daily compliance check itself uses 'properties' (line 89) and 'landlords' (line 90) — both wrong. Both cron jobs will fail at runtime. |
| 7 | Weekly portfolio health report summarizes per-landlord property health scores | PARTIAL | Logic and formula are correct (calculateHealthScore exported and tested); runtime will fail due to wrong table names 'properties'/'landlords' in the SQL query |
| 8 | Proactive monitoring runs via pg-boss cron without manual trigger | PARTIAL | registerPortfolioMonitorJobs is registered via lazy import in server/index.ts (line 72); cron schedule strings are correct; but cron workers will fail at runtime due to wrong table names |
| 9 | Staff can view a PM overview with compliance alerts, portfolio health scores, and agent activity summary | PARTIAL | PMTrackingDashboard.tsx correctly fetches from /api/crm/pm-overview/* and renders substantive widgets; pmOverviewRoutes.ts will return 500 errors at runtime due to 'properties'/'landlords' table name bugs |

**Score:** 6/9 truths verified (5 VERIFIED, 4 PARTIAL — all 4 partials share the same root cause)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/agents/sdk/headOfPMAgent.ts` | Jamie agent definition with persona and handoffs | VERIFIED | 117 lines, exports headOfPMAgent with name 'Jamie from Property Management', 8 tools, 3 handoffs |
| `server/agents/sdk/headOfPMTools.ts` | 7 cross-domain portfolio query tools | VERIFIED | 451 lines, all 7 tools exported with real SQL using lazy pool import pattern. Correct table names: property, landlord, maintenance_request, arrears, tenancy, property_certification |
| `server/__tests__/headOfPM.test.ts` | Test coverage for agent definition and tool structure | VERIFIED | 13 passing tests + 7 todo stubs; static analysis approach avoids import chain timeouts |
| `server/services/portfolioMonitorService.ts` | pg-boss cron jobs for compliance and health monitoring | STUB-RUNTIME | File exists, exports registerPortfolioMonitorJobs, calculateHealthScore, handleComplianceCheck, handleWeeklyHealthReport — but SQL uses wrong table names 'properties'/'landlords' causing runtime failures |
| `server/__tests__/portfolioMonitor.test.ts` | Test coverage for monitoring logic | VERIFIED | 10 passing tests; mocked dependencies correctly; calculateHealthScore formula validated |
| `server/pmOverviewRoutes.ts` | PM overview API endpoints | STUB-RUNTIME | File exists, exports pmOverviewRouter, 3 endpoints defined — but SQL uses wrong table names 'properties'/'landlords' causing all 3 endpoints to fail at runtime |
| `server/__tests__/pmOverview.test.ts` | Unit tests for PM overview API response shapes | PARTIAL | 25 passing static analysis tests; however, the tests themselves assert 'JOIN properties' and 'JOIN landlords' — validating the wrong table names and masking the bug |
| `client/src/pages/PMTrackingDashboard.tsx` | Enhanced PM dashboard with compliance alert panel and health scores | VERIFIED | 3 overview widgets added above existing content; compliance alerts, portfolio health, agent activity all fetched via useQuery; substantive rendering with shadcn/ui components; responsive 3-col grid |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `headOfPMAgent.ts` | `pmAgent.ts` | handoff(pmAgent, { toolNameOverride: 'delegate_to_maintenance' }) | WIRED | Pattern 'handoff.*pmAgent' confirmed at lines 97-101 |
| `headOfPMAgent.ts` | `arrearsAgent.ts` | handoff(arrearsAgent, { toolNameOverride: 'delegate_to_arrears' }) | WIRED | Pattern 'handoff.*arrearsAgent' confirmed at lines 102-106 |
| `supervisorAgent.ts` | `headOfPMAgent.ts` | handoff(headOfPMAgent, { toolNameOverride: 'transfer_to_head_of_pm' }) | WIRED | Import at line 21, handoff at lines 96-99; Morgan's handoff preserved |
| `portfolioMonitorService.ts` | `server/db.ts` | lazy pool import for SQL queries | WIRED | getPool() function with lazy import('../db') pattern |
| `portfolioMonitorService.ts` | `server/emailService.ts` | emailService.sendEmail for alert dispatch | WIRED | getEmailService() with lazy import('../emailService'); sendEmail called in both handlers |
| `pmOverviewRoutes.ts` | `server/db.ts` | pool.query for cross-domain aggregation | WIRED | pool imported at line 10; pool.query used throughout all 3 endpoints |
| `PMTrackingDashboard.tsx` | `pmOverviewRoutes.ts` | useQuery fetching /api/crm/pm-overview/* | WIRED | 3 useQuery hooks at lines 136-149 fetching compliance-alerts, portfolio-health, agent-activity |
| `server/routes.ts` | `pmOverviewRoutes.ts` | app.use('/api/crm', pmOverviewRouter) | WIRED | Import at line 189, mounted at line 212 |
| `server/index.ts` | `portfolioMonitorService.ts` | lazy import for cron registration | WIRED | Lazy import at line 72, registerPortfolioMonitorJobs called on .then() |

---

## Requirements Coverage

The HPM-01 through HPM-08 requirement IDs are referenced in:
- `.planning/ROADMAP.md` (line 165)
- `09-01-PLAN.md` frontmatter (HPM-01, HPM-02, HPM-03, HPM-07, HPM-08)
- `09-02-PLAN.md` frontmatter (HPM-04, HPM-05)
- `09-03-PLAN.md` frontmatter (HPM-06)

**However, none of the HPM-XX requirements are defined in `.planning/REQUIREMENTS.md`.** The REQUIREMENTS.md file contains 39 requirements (KB, AGENT, VOICE, SALES, LETT, PM, ADMIN, CHAN prefixes) with traceability up to Phase 5. Phase 9 requirements were referenced in the ROADMAP but never added to REQUIREMENTS.md.

| Requirement | Source Plan | Status | Evidence |
|-------------|------------|--------|----------|
| HPM-01 (Head of PM agent) | 09-01-PLAN.md | SATISFIED by evidence | headOfPMAgent.ts exports Jamie with correct persona, tools, handoffs |
| HPM-02 (Specialist handoffs) | 09-01-PLAN.md | SATISFIED (with known stub) | delegate_to_maintenance/arrears/admin wired; Taylor deferred by design to Phase 8 |
| HPM-03 (Cross-domain portfolio tools) | 09-01-PLAN.md | SATISFIED | 7 query tools in headOfPMTools.ts with real SQL |
| HPM-04 (Daily compliance check) | 09-02-PLAN.md | PARTIALLY SATISFIED | Handler logic correct; runtime blocked by wrong table names |
| HPM-05 (Weekly health report) | 09-02-PLAN.md | PARTIALLY SATISFIED | Health score formula correct; runtime blocked by wrong table names |
| HPM-06 (PM overview dashboard) | 09-03-PLAN.md | PARTIALLY SATISFIED | Dashboard UI complete; API blocked by wrong table names |
| HPM-07 (Supervisor routing) | 09-01-PLAN.md | SATISFIED | Supervisor has transfer_to_head_of_pm alongside Morgan's handoff |
| HPM-08 (Landlord lookup) | 09-01-PLAN.md | SATISFIED | lookupLandlordPortfolioTool searches phone, mobile, email |

**ORPHANED requirements:** HPM-01 through HPM-08 — referenced in ROADMAP and PLANs but not defined in REQUIREMENTS.md. These requirements are missing from the traceability matrix.

---

## Anti-Patterns Found

| File | Line(s) | Pattern | Severity | Impact |
|------|---------|---------|----------|--------|
| `server/services/portfolioMonitorService.ts` | 89, 90, 198, 199 | Wrong SQL table names: `properties`, `landlords` (plural) — DB tables are `property`, `landlord` (singular) | BLOCKER | handleComplianceCheck and handleWeeklyHealthReport both fail at runtime with PostgreSQL "relation does not exist" error |
| `server/pmOverviewRoutes.ts` | 36, 37, 45, 93, 94, 102, 111, 120, 128, 136 | Wrong SQL table names: `properties`, `landlords` (plural) — DB tables are `property`, `landlord` (singular) | BLOCKER | All 3 PM overview endpoints return HTTP 500 at runtime |
| `server/__tests__/pmOverview.test.ts` | 23-24 | Static analysis tests assert 'JOIN properties' and 'JOIN landlords' — validating the wrong table names | WARNING | Tests pass but mask a production bug; false confidence |

**Root cause:** `portfolioMonitorService.ts` and `pmOverviewRoutes.ts` were written without checking `shared/schema.ts` for exact table names. The `headOfPMTools.ts` (Plan 01) correctly uses `property` and `landlord` (singular). Plans 02 and 03 did not follow the CLAUDE.md rule: "BEFORE ANY CODE THAT USES DATABASE FIELDS — grep shared/schema.ts for the EXACT column/table names."

---

## Human Verification Required

### 1. Jamie conversation routing — portfolio vs operational queries

**Test:** Log into the CRM with a PM agent account and send a WhatsApp/SMS message asking "Can you give me an overview of John Smith's portfolio?" — verify it routes to Jamie, not Morgan.
**Expected:** Supervisor routes to Jamie; Jamie calls queryPortfolioOverviewTool or lookupLandlordPortfolioTool; response is structured, no emoji, British English.
**Why human:** Routing intent detection requires live LLM evaluation and channel gateway testing.

### 2. Dashboard widget display — post-fix validation

**Test:** After fixing the table name bugs, load `/crm/pm-dashboard`. Verify the 3 new widgets (Compliance Alerts, Portfolio Health, Agent Activity) appear above existing content and display real data.
**Expected:** Compliance Alerts shows cert counts or "All Clear" badge; Portfolio Health shows numeric score with color coding; Agent Activity shows action counts per agent.
**Why human:** Cannot verify React rendering or data presentation quality programmatically.

### 3. pg-boss cron job execution

**Test:** After fixing table name bugs, trigger `handleComplianceCheck()` manually by adding a temporary route, or wait for the 8am cron to fire. Verify email arrives at PM staff address.
**Expected:** Email with correct HTML table listing expired/expiring certs; audit log entry created.
**Why human:** Requires real pg-boss infrastructure and email delivery verification.

---

## Gaps Summary

**Root cause of all 4 gaps is identical:** `portfolioMonitorService.ts` and `pmOverviewRoutes.ts` both use `properties` (plural) and `landlords` (plural) as SQL table names. The actual PostgreSQL tables are `property` and `landlord` (singular), as defined in `shared/schema.ts` lines 86 and 850. This will cause all runtime SQL queries in these two files to throw "relation 'properties' does not exist" PostgreSQL errors.

The agent definition (Plan 01) is fully correct — `headOfPMTools.ts` uses the right table names. The monitoring service (Plan 02) and dashboard API (Plan 03) both share this bug.

**Files to fix:**
1. `server/services/portfolioMonitorService.ts` — replace `properties` → `property`, `landlords` → `landlord` in all SQL queries (lines 89-199)
2. `server/pmOverviewRoutes.ts` — replace `properties` → `property`, `landlords` → `landlord` in all SQL queries (lines 36-136)
3. `server/__tests__/pmOverview.test.ts` — update static analysis assertions to check for `property` and `landlord` (singular) so tests catch this class of bug in future

**What works correctly:**
- Jamie agent definition (headOfPMAgent.ts) — fully correct and wired
- All 7 portfolio query tools (headOfPMTools.ts) — correct table names, correct SQL
- Supervisor wiring — Jamie routed for portfolio queries, Morgan preserved for fault reports
- PMTrackingDashboard.tsx — UI is complete, responsive, renders substantive widgets
- All test files — 48 tests pass (excluding the masked table name issue in pmOverview.test.ts)
- Server startup registration of cron jobs — correct lazy import pattern in server/index.ts

---

_Verified: 2026-03-26T20:40:00Z_
_Verifier: Claude (gsd-verifier)_
