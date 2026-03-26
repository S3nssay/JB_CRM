---
phase: 07-agent-corrections-cost-ledger
plan: 01
subsystem: agents
tags: [openai-agents-sdk, schema, offers, negotiation-removal, compliance-costs]

# Dependency graph
requires:
  - phase: 02-text-channel-agents
    provides: "Sales agent (Alex), Lettings agent (Jordan), tools.ts SDK wrappers"
  - phase: 06-cross-agent-collaboration-deal-lifecycle-automation
    provides: "Deal lifecycle tools (emitDealEvent, readDealStatus, emitCrossReferral)"
provides:
  - "recordOfferTool in tools.ts for agent-driven offer recording"
  - "Lettings columns on propertyOffers table (employment_status, rental_references, move_in_timeline, offer_source)"
  - "Cost column on propertyCertifications table"
  - "propertyCostThresholds table for configurable spend alerts"
  - "Corrected agent prompts: OFFERS section replaces NEGOTIATION in both agents"
affects: [07-02, 07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Agents as offer intake (not negotiators) -- staff handles all negotiation"
    - "recordOfferTool uses raw SQL with pool.query for direct property_offer INSERT"

key-files:
  created:
    - server/agents/__tests__/agentPrompts.test.ts
  modified:
    - shared/schema.ts
    - server/agents/sdk/tools.ts
    - server/agents/sdk/salesAgent.ts
    - server/agents/sdk/lettingsAgent.ts

key-decisions:
  - "recordOfferTool uses pool.query raw SQL (consistent with emitCrossReferralTool pattern)"
  - "Notification falls back to first admin user when no agent_id assigned to property"
  - "Mock SDK tool() function in tests to avoid zod4 schema validation at import time"

patterns-established:
  - "Agent offer recording: tool inserts offer + creates notification for assigned negotiator"
  - "Agent prompt correction tests: read source files as strings, assert forbidden phrases absent"

requirements-completed: [CORR-01, CORR-02]

# Metrics
duration: 8min
completed: 2026-03-26
---

# Phase 7 Plan 1: Agent Corrections and Schema Extensions Summary

**recordOfferTool replaces negotiation autonomy in Sales/Lettings agents; schema extended with lettings offer fields, certification costs, and cost thresholds table**

## Performance

- **Duration:** 8 min
- **Started:** 2026-03-26T14:50:23Z
- **Completed:** 2026-03-26T14:58:14Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Removed negotiation autonomy from Sales (Alex) and Lettings (Jordan) agents, replacing with offer recording flow
- Added recordOfferTool to tools.ts that inserts into property_offer and notifies assigned negotiator
- Extended propertyOffers table with lettings-specific columns (employment_status, rental_references, move_in_timeline, offer_source)
- Added cost column to propertyCertifications and created propertyCostThresholds table
- 6 unit tests passing: structural + behavioral CORR-01, prompt verification CORR-02

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema extensions for offers, certifications, and cost thresholds** - `f932578` (feat)
2. **Task 2: Remove negotiation autonomy, add recordOffer tool, and write unit tests** - `bc46d66` (feat)

## Files Created/Modified
- `shared/schema.ts` - Added 4 lettings columns to propertyOffers, cost to propertyCertifications, new propertyCostThresholds table
- `server/agents/sdk/tools.ts` - Added recordOfferTool with INSERT + notification logic
- `server/agents/sdk/salesAgent.ts` - OFFERS section replaces NEGOTIATION, recordOfferTool in tools array
- `server/agents/sdk/lettingsAgent.ts` - OFFERS section replaces NEGOTIATION, recordOfferTool in tools array
- `server/agents/__tests__/agentPrompts.test.ts` - 6 tests for CORR-01 and CORR-02

## Decisions Made
- Used raw SQL (pool.query) for recordOfferTool execute function, consistent with emitCrossReferralTool pattern in same file
- Notification falls back to first admin user when property has no agent_id assigned
- Mocked @openai/agents SDK tool() function in tests to avoid zod4 schema validation errors at module import time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Vitest tests timed out initially because importing tools.ts triggered SDK zod4 validation errors on existing emitDealEventTool. Fixed by mocking the @openai/agents SDK tool() function.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- recordOfferTool available for use by both Sales and Lettings agents
- propertyCostThresholds table ready for Morgan cost ledger (Plan 07-03)
- Schema supports lettings offer tracking for subsequent plans

---
*Phase: 07-agent-corrections-cost-ledger*
*Completed: 2026-03-26*
