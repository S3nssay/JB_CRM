---
phase: 06-cross-agent-collaboration-deal-lifecycle-automation
plan: 01
subsystem: api
tags: [pg-boss, pipeline-engine, deal-lifecycle, event-bus, postgresql]

# Dependency graph
requires:
  - phase: 04-property-management-specialist
    provides: "escalationService, workOrderFollowup pg-boss patterns"
provides:
  - "deal, deal_step, deal_event, notification tables"
  - "DealEventBus singleton for domain event pub/sub via pg-boss"
  - "DealService CRUD for deals, steps, events, notifications"
  - "DealPipelineService with 6 pipeline templates and step dependency engine"
  - "Timeout escalation via checkTimeouts"
affects: [06-02, 06-03, 06-04]

# Tech tracking
tech-stack:
  added: []
  patterns: ["pipeline-template-as-code", "step-dependency-resolution", "timeout-escalation-loop"]

key-files:
  created:
    - server/agents/services/dealEventBus.ts
    - server/agents/services/dealService.ts
    - server/agents/services/dealPipelineService.ts
    - server/agents/services/__tests__/dealEventBus.test.ts
    - server/agents/services/__tests__/dealPipeline.test.ts
    - server/agents/services/__tests__/dealTimeout.test.ts
  modified:
    - shared/schema.ts
    - vitest.config.ts

key-decisions:
  - "Pipeline templates defined as code constants (not database-stored) per user decision"
  - "dependsOn stored as JSON string in text column (simple parsing, no array column needed)"
  - "Lazy pg-boss init via singleton pattern (same as workOrderFollowup.ts)"
  - "sourceEventId in event payloads to prevent circular event loops"
  - "Raw SQL for dealService CRUD (consistent with pmWorkflowRoutes pattern)"

patterns-established:
  - "Pipeline template pattern: const arrays of PipelineStep with id, name, agentType, dependsOn, isOptional, timeoutHours"
  - "Step dependency resolution: build completedSet, check all deps met before starting"
  - "vi.hoisted() for mock function declarations in vitest v4 tests"

requirements-completed: [DEAL-01, DEAL-02, DEAL-03]

# Metrics
duration: 8min
completed: 2026-03-24
---

# Phase 6 Plan 1: Deal Lifecycle Core Summary

**Deal lifecycle data model with 4 tables, pg-boss event bus, pipeline engine supporting 6 deal types with step dependencies and timeout escalation**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-24T12:18:57Z
- **Completed:** 2026-03-24T12:27:14Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 4 new database tables: deal, deal_step, deal_event, notification
- DealEventBus singleton with 10 domain event names and pg-boss queue integration
- DealPipelineService with 6 pipeline templates (lettings_agreed, tenancy_ending, lease_renewal, rent_review, sale_agreed, sale_collapsed)
- Rent review pipeline: market_comparison -> landlord_proposal -> tenant_communication + section_13_notice (optional)
- Step dependency resolution engine with timeout escalation to human staff
- 25 unit tests covering event bus, CRUD service, pipeline engine, and timeout handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema + DealService + DealEventBus** - `c4f8dec` (feat)
2. **Task 2: Pipeline Engine with Step Dependencies and Timeouts** - `5cf791a` (feat)

## Files Created/Modified
- `shared/schema.ts` - Added deals, dealSteps, dealEvents, notifications table definitions + types
- `server/agents/services/dealEventBus.ts` - Singleton event bus wrapping pg-boss send/work with sourceEventId
- `server/agents/services/dealService.ts` - CRUD for deals, steps, events, notifications via raw SQL
- `server/agents/services/dealPipelineService.ts` - Pipeline templates and step execution engine
- `server/agents/services/__tests__/dealEventBus.test.ts` - 7 tests for event bus and service CRUD
- `server/agents/services/__tests__/dealPipeline.test.ts` - 15 tests for pipeline templates and step advancement
- `server/agents/services/__tests__/dealTimeout.test.ts` - 3 tests for timeout escalation
- `vitest.config.ts` - Added server/__tests__ path to include pattern

## Decisions Made
- Pipeline templates defined as code constants (not database-stored) per user decision
- dependsOn stored as JSON string in text column (simpler than postgres array for step ID parsing)
- Lazy pg-boss init via singleton pattern (consistent with workOrderFollowup.ts)
- sourceEventId added to event payloads to prevent circular event loops (per research pitfall #2)
- Raw SQL for dealService CRUD (consistent with pmWorkflowRoutes pattern)
- Used vi.hoisted() for mock function declarations in vitest v4 (required for hoisted vi.mock factories)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed vitest mock hoisting with vi.hoisted()**
- **Found during:** Task 1 (test execution)
- **Issue:** vi.mock factories are hoisted above variable declarations, causing "Cannot access before initialization" error
- **Fix:** Used vi.hoisted() to declare mock functions, which are hoisted alongside vi.mock
- **Files modified:** server/agents/services/__tests__/dealEventBus.test.ts
- **Verification:** All 7 tests pass
- **Committed in:** c4f8dec (Task 1 commit)

**2. [Rule 3 - Blocking] Fixed pg-boss constructor mock for class instantiation**
- **Found during:** Task 1 (test execution)
- **Issue:** vi.fn().mockImplementation() doesn't work as constructor; `new PgBoss()` throws "not a constructor"
- **Fix:** Used class-based mock (class PgBossMock with method properties) instead of mockImplementation
- **Files modified:** server/agents/services/__tests__/dealEventBus.test.ts
- **Verification:** emit/subscribe tests pass with correct pg-boss queue names
- **Committed in:** c4f8dec (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes were test infrastructure issues. No scope creep.

## Issues Encountered
None beyond the auto-fixed test mock issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Deal lifecycle infrastructure ready for agent integration (Plan 02)
- Pipeline templates define step ordering for all 6 deal types
- Event bus ready for agent-to-agent communication
- Timeout escalation ready for human-in-the-loop workflow

---
*Phase: 06-cross-agent-collaboration-deal-lifecycle-automation*
*Completed: 2026-03-24*
