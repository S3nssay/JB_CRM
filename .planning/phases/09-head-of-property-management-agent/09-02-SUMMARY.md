---
phase: 09-head-of-property-management-agent
plan: 02
subsystem: monitoring
tags: [pg-boss, cron, compliance, health-score, email-alerts, portfolio]

requires:
  - phase: 01-knowledge-base-property-context
    provides: property_certification schema and properties table
provides:
  - portfolioMonitorService with daily compliance check and weekly health report cron jobs
  - calculateHealthScore pure function for per-property health scoring
affects: [09-head-of-property-management-agent, pm-dashboard]

tech-stack:
  added: []
  patterns: [lazy-import pg-boss cron registration, exported handler functions for testability]

key-files:
  created:
    - server/services/portfolioMonitorService.ts
    - server/__tests__/portfolioMonitor.test.ts
  modified:
    - server/index.ts

key-decisions:
  - "Used property_certification table (not property_certificate) for compliance queries -- it has richer schema with reminder tracking"
  - "Health score formula: 100 base, -20 expired cert, -10 expiring cert, -5 open ticket, -15 active arrears, -25 vacant"
  - "Lazy imports for pool and emailService to avoid DB connection at module load"

patterns-established:
  - "Portfolio monitoring cron pattern: exported handler functions + registerXxxJobs for pg-boss scheduling"

requirements-completed: [HPM-04, HPM-05]

duration: 7min
completed: 2026-03-26
---

# Phase 9 Plan 02: Portfolio Monitor Service Summary

**pg-boss cron jobs for daily compliance checks (8am) and weekly landlord-grouped health reports (Mon 9am) with email alerts to PM staff**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-26T19:56:09Z
- **Completed:** 2026-03-26T20:03:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Daily compliance check queries property_certification for expiring/expired certs within 30 days and emails PM staff
- Weekly health report calculates per-property health scores (compliance, maintenance, arrears, vacancy) grouped by landlord
- Handler functions exported for direct unit testing without pg-boss infrastructure
- 10 unit tests covering health score calculation, email dispatch logic, landlord grouping, and empty-result handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create portfolio monitoring service with compliance and health cron jobs** - `e5e27d2` (feat)
2. **Task 2: Register portfolio monitor jobs in server startup** - `5243dd2` (feat)

## Files Created/Modified
- `server/services/portfolioMonitorService.ts` - Portfolio monitoring service with daily compliance check and weekly health report cron jobs
- `server/__tests__/portfolioMonitor.test.ts` - 10 unit tests for handler functions and health score calculation
- `server/index.ts` - Added lazy import registration for portfolio monitor jobs

## Decisions Made
- Used `property_certification` table (not `property_certificate`) for compliance queries as it has richer schema with reminder tracking fields
- Health score formula: start at 100, deduct per issue type (expired cert -20, expiring -10, open ticket -5, active arrears -15, vacant -25), floor at 0
- Lazy imports for pool and emailService to avoid database connection at module load time
- PM staff email configurable via PM_STAFF_EMAIL env var, falls back to first admin user query

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Optionally set `PM_STAFF_EMAIL` env var for dedicated PM notification recipient.

## Next Phase Readiness
- Portfolio monitoring service ready for integration with Head of PM agent
- Health score function available for reuse in dashboard components

---
*Phase: 09-head-of-property-management-agent*
*Completed: 2026-03-26*
