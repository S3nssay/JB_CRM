---
phase: 02-text-channel-agents
plan: 02
subsystem: agents
tags: [openai-agents-sdk, sales-agent, pg-boss, follow-up-scheduling, property-search, viewing-booking, lead-capture, negotiation]

# Dependency graph
requires:
  - phase: 02-text-channel-agents
    plan: 01
    provides: SDK tool wrappers, AgentContext, runAgent executor, Supervisor agent with salesAgentStub, escalation service
provides:
  - Sales specialist agent (Alex from Sales) with 6 tools
  - scheduleFollowUpTool queuing Day 1/3/7 follow-ups via pg-boss
  - Real salesAgent wired into Supervisor handoffs (replacing stub)
affects: [02-text-channel-agents, 03-voice-agents]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Specialist agent pattern: persona instructions + domain tools + follow-up scheduling", "pg-boss lazy init for follow-up job queuing"]

key-files:
  created:
    - server/agents/sdk/salesAgent.ts
    - tests/agents/salesAgent.test.ts
  modified:
    - server/agents/sdk/supervisorAgent.ts
    - tests/agents/supervisorRouting.test.ts

key-decisions:
  - "Full negotiation autonomy for Sales agent -- no floor/ceiling restrictions, uses market data and property history"
  - "Lazy pg-boss initialisation in scheduleFollowUpTool to avoid connection at module load time"
  - "Fixed pg-boss mock constructor pattern across all agent test files for test reliability"

patterns-established:
  - "Specialist agent pattern: Agent with persona instructions, domain tools array, and follow-up scheduling tool"
  - "Follow-up sequence: Day 1 thank-you, Day 3 similar properties, Day 7 check-in via pg-boss jobs"

requirements-completed: [SALES-01, SALES-02, SALES-03, SALES-04]

# Metrics
duration: 4min
completed: 2026-03-20
---

# Phase 02 Plan 02: Sales Specialist Agent Summary

**Sales agent (Alex from Sales) with property search, viewing booking, lead capture, full negotiation autonomy, and Day 1/3/7 follow-up scheduling via pg-boss**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-20T01:50:11Z
- **Completed:** 2026-03-20T01:54:10Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Sales specialist agent with 6 tools: search_properties, book_viewing, create_lead, query_knowledge_base, escalate_to_human, schedule_follow_up
- scheduleFollowUpTool queues Day 1/3/7 follow-up messages via pg-boss with contact and property context
- Supervisor now routes sale enquiries to the real Sales agent instead of stub
- 40 passing agent tests across 4 test files (17 new for sales agent)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build Sales specialist agent with TDD** - `e7d902f` (feat)
2. **Task 2: Replace salesAgentStub in Supervisor** - `8e68d0c` (feat)

## Files Created/Modified

### Created
- `server/agents/sdk/salesAgent.ts` - Sales specialist agent with persona, 6 tools, channel-aware formatting, negotiation autonomy
- `tests/agents/salesAgent.test.ts` - 17 tests covering tools, persona, instructions, and follow-up scheduling

### Modified
- `server/agents/sdk/supervisorAgent.ts` - Replaced salesAgentStub with real salesAgent import
- `tests/agents/supervisorRouting.test.ts` - Added real agent handoff test, fixed pg-boss mock constructor

## Decisions Made
- Full negotiation autonomy for Sales agent with no floor/ceiling restrictions (per user decision from research phase)
- Lazy pg-boss initialisation to avoid database connection at module import time
- Fixed pg-boss mock constructor pattern using `vi.fn().mockImplementation(function(this) {...})` across all agent tests

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pg-boss mock constructor pattern in supervisor routing tests**
- **Found during:** Task 2 (wiring real salesAgent into Supervisor)
- **Issue:** pg-boss mock in supervisorRouting.test.ts used arrow function which cannot be called with `new`, causing "not a constructor" errors when salesAgent imports pg-boss
- **Fix:** Changed mock to use `vi.fn().mockImplementation(function(this) {...})` pattern that supports `new` operator
- **Files modified:** tests/agents/supervisorRouting.test.ts
- **Verification:** All 40 agent tests pass
- **Committed in:** 8e68d0c (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential for test compatibility. No scope creep.

## Issues Encountered
None beyond the pg-boss mock constructor fix documented above.

## User Setup Required
None - no external service configuration required. Uses existing DATABASE_URL for pg-boss.

## Next Phase Readiness
- Sales agent fully operational and wired into Supervisor handoffs
- Lettings and Admin stubs still in place, ready for Plans 03 and 04
- Follow-up scheduling pattern established and reusable for other specialist agents
- 40 comprehensive agent tests providing regression safety

---
*Phase: 02-text-channel-agents*
*Completed: 2026-03-20*
