---
phase: 04-property-management
plan: 03
subsystem: agents
tags: [pg-boss, work-orders, follow-ups, audit-logging, escalation, maintenance]

requires:
  - phase: 04-02
    provides: contractor dispatch pipeline (work orders, contractor search, quotes, landlord approval)
provides:
  - Automated work order follow-up lifecycle via pg-boss
  - Contractor progress check-in workers
  - Tenant satisfaction verification workers
  - Completion verification at scheduled end date
  - Escalation to staff after 2 unanswered follow-ups
  - schedule_work_order_followup tool for PM agent
affects: [05-arrears-chasing]

tech-stack:
  added: []
  patterns: [urgency-based follow-up intervals, completion verification loop, max-attempt escalation]

key-files:
  created:
    - server/agents/services/workOrderFollowup.ts
    - server/agents/tools/definitions/scheduleWorkOrderFollowup.ts
  modified:
    - server/agents/sdk/pmAgent.ts
    - server/agents/sdk/tools.ts
    - server/agents/tools/registry.ts
    - tests/agents/workOrderFollowup.test.ts

key-decisions:
  - "Urgency-based intervals: emergency=24h, urgent=48h, routine=72h, low=96h"
  - "MAX_FOLLOWUP_ATTEMPTS=2 before escalation to staff"
  - "Completion check reschedules at 24h intervals, max 3 checks before escalation"
  - "Lazy import for workOrderFollowupService in tool definition (avoid DB at module load)"

patterns-established:
  - "Work order follow-up pattern: schedule 3 jobs (contractor, tenant, completion) per work order"
  - "Max-attempt escalation: track attemptNumber in job data, escalate when threshold reached"

requirements-completed: [PM-05]

duration: 5min
completed: 2026-03-22
---

# Phase 4 Plan 3: Work Order Follow-up Summary

**Automated pg-boss follow-up lifecycle for work orders: urgency-based contractor/tenant check-ins, completion verification at scheduled end, and staff escalation after 2 unanswered attempts**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-21T23:57:42Z
- **Completed:** 2026-03-22T00:02:20Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Work order follow-up service with 3 pg-boss worker types: contractor check-in, tenant satisfaction, completion verification
- Every follow-up attempt audit-logged with workOrderId, ticketId, attemptNumber, followUpType
- Escalation to staff after 2 unanswered follow-ups per party
- PM agent automatically schedules follow-ups after every work order creation
- 31 tests passing across work order follow-up and PM agent test suites

## Task Commits

Each task was committed atomically:

1. **Task 1: Work order follow-up service with pg-boss workers** - `226df7e` (feat)
2. **Task 2: Follow-up scheduling tool and PM agent integration** - `1dce4b0` (feat)

## Files Created/Modified
- `server/agents/services/workOrderFollowup.ts` - Follow-up service with pg-boss workers for contractor/tenant/completion checks
- `server/agents/tools/definitions/scheduleWorkOrderFollowup.ts` - Tool definition for scheduling follow-ups
- `server/agents/tools/registry.ts` - Registered schedule_work_order_followup tool
- `server/agents/sdk/tools.ts` - SDK wrapper for schedule_work_order_followup
- `server/agents/sdk/pmAgent.ts` - Added follow-up tool and updated instructions
- `tests/agents/workOrderFollowup.test.ts` - 14 tests covering all follow-up scenarios

## Decisions Made
- Urgency-based follow-up intervals (emergency=24h through low=96h) matching the plan specification
- MAX_FOLLOWUP_ATTEMPTS=2 before escalation, matching plan requirements
- Completion check uses 24h recheck interval with max 3 checks before escalation as overdue
- Lazy import pattern for workOrderFollowupService in tool definition (consistent with existing patterns)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing test failure in supervisorRouting.test.ts (expects 3 handoffs, finds 4) -- out of scope, not caused by this plan's changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Full maintenance lifecycle complete: fault report -> ticket -> contractor dispatch -> work order -> automated follow-ups
- Phase 4 (Property Management) is now complete
- Ready for Phase 5 (Arrears Chasing)

---
*Phase: 04-property-management*
*Completed: 2026-03-22*
