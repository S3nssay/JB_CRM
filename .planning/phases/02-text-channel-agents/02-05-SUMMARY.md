---
phase: 02-text-channel-agents
plan: 05
subsystem: agents
tags: [pg-boss, scheduled-messages, conversation-memory, viewing-reminders, follow-up, opt-out, vitest]

# Dependency graph
requires:
  - phase: 02-01
    provides: "Agent runner, message sender, webhook routes, conversation store"
  - phase: 02-02
    provides: "Sales agent with scheduleFollowUpTool pattern and pg-boss lazy init"
  - phase: 02-03
    provides: "Lettings agent reusing scheduleFollowUpTool"
  - phase: 02-04
    provides: "Admin agent with checklistService and tenancy event hooks"
provides:
  - "ScheduledMessageService with pg-boss workers for viewing reminders, follow-ups, and checklist chases"
  - "handlePostActions hook for immediate confirmations after agent tool calls"
  - "Opt-out flag on contact_identity for STOP keyword compliance"
  - "Memory injection test coverage for agent runner"
affects: [03-voice-integration, 04-property-management, 05-arrears-chasing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pg-boss scheduled message workers with opt-out check", "post-action hooks for immediate confirmations"]

key-files:
  created:
    - server/agents/services/scheduledMessages.ts
    - tests/agents/postActionConfirmation.test.ts
    - tests/agents/followUp.test.ts
    - tests/agents/memoryInjection.test.ts
  modified:
    - server/agentWebhooks.ts
    - shared/schema.ts

key-decisions:
  - "Opt-out stored on contact_identity table (opted_out + opted_out_at columns) rather than separate table"
  - "STOP keyword in webhooks now sets opt-out flag in addition to blocking agent processing"

patterns-established:
  - "Post-action hooks: handlePostActions called after agent tool calls for confirmations and scheduling"
  - "Scheduled message workers: check opt-out before every send, log via auditLogger"

requirements-completed: [CHAN-03, CHAN-04, SALES-04, LETT-04]

# Metrics
duration: 5min
completed: 2026-03-20
---

# Phase 2 Plan 5: Cross-Channel Memory & Scheduled Messages Summary

**pg-boss scheduled message service with viewing reminders (24h/morning-of), Day 1/3/7 follow-up sequences, post-action confirmation hooks, and STOP keyword opt-out enforcement**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-20T02:16:03Z
- **Completed:** 2026-03-20T02:21:05Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- ScheduledMessageService with pg-boss workers for viewing-reminder, follow-up-thanks/similar/checkin, and checklist-chase job types
- handlePostActions hook sends immediate confirmations on same channel + email summaries after viewing bookings and lead captures
- STOP keyword now sets opted_out flag on contact_identity, checked before every scheduled message send
- Memory injection tests verify runner loads last 20 messages with correct role mapping

## Task Commits

Each task was committed atomically:

1. **Task 1: Build scheduled message service with pg-boss and post-action confirmation hooks**
   - `9a8760d` (test) - Failing tests for post-action confirmations and follow-up scheduling
   - `88bd3f5` (feat) - Scheduled message service implementation with pg-boss workers and post-action hooks
2. **Task 2: Wire conversation memory injection into agent runner**
   - `e3eec2c` (test) - Memory injection tests verifying existing runner implementation

## Files Created/Modified
- `server/agents/services/scheduledMessages.ts` - pg-boss scheduled message service with workers, follow-up scheduling, opt-out checking, and post-action hooks
- `server/agentWebhooks.ts` - Added STOP keyword opt-out flag setting and handlePostActions import
- `shared/schema.ts` - Added opted_out and opted_out_at columns to contact_identity table
- `tests/agents/postActionConfirmation.test.ts` - 4 tests for immediate confirmations and email summaries
- `tests/agents/followUp.test.ts` - 4 tests for follow-up scheduling, viewing reminders, opt-out, and audit logging
- `tests/agents/memoryInjection.test.ts` - 4 tests for conversation history injection into agent runner

## Decisions Made
- Opt-out stored on contact_identity table (opted_out + opted_out_at columns) rather than a separate opt-out table -- keeps contact state co-located
- STOP keyword in webhooks now sets opt-out flag in addition to blocking agent processing, so scheduled messages also respect the opt-out

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added opted_out column to contact_identity schema**
- **Found during:** Task 1 (scheduled message service)
- **Issue:** Plan references checkOptOut querying contact_identity for opt-out flag, but the column did not exist
- **Fix:** Added opted_out (boolean) and opted_out_at (timestamp) columns to contact_identity in schema.ts
- **Files modified:** shared/schema.ts
- **Verification:** Tests pass, opt-out check works against mocked DB
- **Committed in:** 88bd3f5 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Schema extension required for opt-out checking to work. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 complete: all 5 plans executed
- Full agent pipeline operational: Supervisor routing, Sales/Lettings/Admin specialists, conversation memory, scheduled messages, post-action confirmations
- Ready for Phase 3 (Voice Integration) which builds on the text-channel agent infrastructure

---
*Phase: 02-text-channel-agents*
*Completed: 2026-03-20*
