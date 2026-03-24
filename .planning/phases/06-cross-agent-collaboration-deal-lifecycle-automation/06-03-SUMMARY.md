---
phase: 06-cross-agent-collaboration-deal-lifecycle-automation
plan: 03
subsystem: agents
tags: [deal-lifecycle, pipeline-actions, event-hooks, cross-agent, sdk-tools, pg-boss]

# Dependency graph
requires:
  - phase: 06-01
    provides: "Deal tables, event bus, pipeline service, deal service"
provides:
  - "Pipeline step actions that call real services (checklistService, messageSender)"
  - "Tenancy event hooks that trigger deal pipelines on creation/status change"
  - "Sale event emission from crmRoutes on offer acceptance/withdrawal"
  - "Daily pg-boss job for lease renewal and annual rent review detection"
  - "5 new agent SDK tools: emitDealEvent, readDealStatus, queryContactConversations, flagInconsistency, emitCrossReferral"
  - "Cross-agent conversation access via conversationStore.getConversationsForContact"
affects: [06-04, deal-dashboard, agent-tools]

# Tech tracking
tech-stack:
  added: []
  patterns: ["fire-and-forget async IIFE for deal event emission from route handlers", "lazy import pattern for pipeline step action dependencies", "step action registry (STEP_ACTIONS map) for pipeline step execution"]

key-files:
  created: []
  modified:
    - server/agents/services/dealPipelineService.ts
    - server/agents/services/tenancyEventHooks.ts
    - server/crmRoutes.ts
    - server/agents/sdk/tools.ts
    - server/agents/sdk/adminAgent.ts
    - server/agents/sdk/lettingsAgent.ts
    - server/agents/sdk/salesAgent.ts
    - server/agents/sdk/pmAgent.ts
    - server/agents/channels/conversationStore.ts
    - server/agents/services/__tests__/dealPipeline.test.ts
    - tests/agents/adminChecklist.test.ts
    - tests/agents/lettingsAgent.test.ts
    - tests/agents/salesAgent.test.ts
    - tests/agents/supervisorRouting.test.ts

key-decisions:
  - "Step actions implemented as a STEP_ACTIONS record mapping stepId to async functions, called fire-and-forget during pipeline initialization and advancement"
  - "Welcome message reads property_systems_inventory and property_certifications tables for KB data"
  - "Daily tenancy check uses SQL date arithmetic for anniversary detection (rent review) and interval comparison (lease renewal)"
  - "Cross-referral creates actual lead records in the leads table with source='referral'"
  - "Inconsistency detection uses staff notifications (not blocking) -- simple exact field comparison for critical fields"

patterns-established:
  - "STEP_ACTIONS registry: map stepId -> async action function for pipeline step execution"
  - "Fire-and-forget deal pipeline triggering from route handlers via async IIFE"
  - "Agent tool role assignment: each specialist gets only relevant deal tools"

requirements-completed: [DEAL-01, DEAL-02]

# Metrics
duration: 10min
completed: 2026-03-24
---

# Phase 6 Plan 3: Deal Pipeline Actions & Agent Tools Summary

**Pipeline step actions wired to real services (checklistService, messageSender), deal event emission from tenancy/sale routes, 5 new agent SDK tools for cross-agent collaboration**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-24T12:30:13Z
- **Completed:** 2026-03-24T12:40:30Z
- **Tasks:** 2
- **Files modified:** 14

## Accomplishments
- All 6 pipeline types have concrete step actions that call real services (checklistService for offboarding, messageSender for welcome messages and tenant communications)
- Tenancy creation/status changes automatically trigger deal pipelines (lettings_agreed, tenancy_ending)
- Sale agreed/collapsed events fire from crmRoutes when offer status changes to accepted/withdrawn
- Daily pg-boss scheduled job detects lease renewals (90 days before end) and annual rent reviews
- 5 new agent tools enable cross-agent collaboration: deal event emission, status reading, conversation querying, inconsistency flagging, and cross-department referrals

## Task Commits

Each task was committed atomically:

1. **Task 1: Pipeline Step Actions and Event Hook Wiring** - `b0e142f` (feat)
2. **Task 2: Agent Deal Tools and Cross-Agent Conversation Access** - `9595024` (feat)

## Files Created/Modified
- `server/agents/services/dealPipelineService.ts` - Added STEP_ACTIONS registry with 18 step action implementations, executeStepAction helper, lazy service imports
- `server/agents/services/tenancyEventHooks.ts` - Extended with deal pipeline triggering, dailyTenancyCheckHandler, registerDailyTenancyCheck
- `server/crmRoutes.ts` - Added sale_agreed and sale_collapsed deal event emission in offer status update handler
- `server/agents/sdk/tools.ts` - Added 5 new deal lifecycle tools (emitDealEvent, readDealStatus, queryContactConversations, flagInconsistency, emitCrossReferral)
- `server/agents/sdk/adminAgent.ts` - Added readDealStatusTool (4 tools)
- `server/agents/sdk/lettingsAgent.ts` - Added emitDealEvent, readDealStatus, emitCrossReferral (9 tools)
- `server/agents/sdk/salesAgent.ts` - Added emitDealEvent, readDealStatus, emitCrossReferral (9 tools)
- `server/agents/sdk/pmAgent.ts` - Added readDealStatus, queryContactConversations, flagInconsistency (12 tools)
- `server/agents/channels/conversationStore.ts` - Added getConversationsForContact with agentType filter
- `server/agents/services/__tests__/dealPipeline.test.ts` - Added step action tests
- `tests/agents/adminChecklist.test.ts` - Updated tool count (3->4)
- `tests/agents/lettingsAgent.test.ts` - Updated tool count (6->9)
- `tests/agents/salesAgent.test.ts` - Updated tool count (6->9)
- `tests/agents/supervisorRouting.test.ts` - Updated handoff count (3->4)

## Decisions Made
- Step actions implemented as STEP_ACTIONS record mapping stepId to async functions (clean separation from pipeline engine)
- Welcome message reads property KB tables (property_systems_inventory, property_certifications) for tenant-specific info
- Rent review annual detection uses SQL date arithmetic for start_date anniversary comparison
- Cross-referral creates real lead records in leads table with source='referral'
- Supervisor handoff count test updated from 3 to 4 (PM agent was added in Phase 04)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated pre-existing agent tool count tests**
- **Found during:** Task 2
- **Issue:** Tests for admin (3), lettings (6), sales (6), supervisor (3 handoffs) hard-coded old tool counts that no longer match after adding deal tools
- **Fix:** Updated assertions to match new counts: admin 4, lettings 9, sales 9, supervisor 4 handoffs
- **Files modified:** tests/agents/adminChecklist.test.ts, lettingsAgent.test.ts, salesAgent.test.ts, supervisorRouting.test.ts
- **Verification:** All 368 tests pass
- **Committed in:** 9595024 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test assertion updates were necessary for correctness. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Deal lifecycle fully wired: events trigger pipelines, pipelines execute step actions, agents have deal tools
- Ready for 06-04 (deal dashboard UI) which will visualize pipeline progress and step statuses

---
*Phase: 06-cross-agent-collaboration-deal-lifecycle-automation*
*Completed: 2026-03-24*
