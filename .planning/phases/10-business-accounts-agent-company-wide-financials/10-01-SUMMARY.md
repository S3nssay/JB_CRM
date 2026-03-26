---
phase: 10-business-accounts-agent-company-wide-financials
plan: 01
subsystem: ai-agents
tags: [openai-agents-sdk, accounting, gpt-4o, financial-queries, zod4]

# Dependency graph
requires:
  - phase: 08-pm-finance-agent-landlord-statements-tenant-invoices
    provides: "Taylor finance agent pattern and supervisor handoff"
provides:
  - "Riley business accounts agent with 12 financial query tools"
  - "Shared accountingQueries module with 7 reusable query functions"
  - "Supervisor routing for staff finance queries to Riley"
affects: [10-02, 11-property-sourcing-agent]

# Tech tracking
tech-stack:
  added: []
  patterns: [shared-query-extraction, staff-only-agent-domain-boundary]

key-files:
  created:
    - server/accountingQueries.ts
    - server/agents/sdk/businessAccountsAgent.ts
    - server/__tests__/businessAccountsAgent.test.ts
  modified:
    - server/agents/sdk/supervisorAgent.ts

key-decisions:
  - "Extracted shared query module from accountingRoutes.ts patterns rather than importing route handlers directly"
  - "Clear domain boundary: Riley handles company-wide financials, Taylor handles tenant/landlord specific finance"
  - "Lazy imports for pool and accountingQueries in all tool execute functions (avoid DB connection at module load)"

patterns-established:
  - "Staff-only agent pattern: domain boundary explicitly stated in instructions to redirect tenant/landlord queries"
  - "Shared query extraction: reusable functions from route handlers for agent tools"

requirements-completed: [BIZ-01, BIZ-02, BIZ-03, BIZ-04, BIZ-05, BIZ-07, BIZ-08]

# Metrics
duration: 12min
completed: 2026-03-26
---

# Phase 10 Plan 01: Business Accounts Agent Summary

**Riley agent with 12 financial query tools (P&L, balance sheet, VAT, cash position, aged debtors/creditors) and Supervisor routing for staff finance queries**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-26T19:55:12Z
- **Completed:** 2026-03-26T20:07:43Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Shared accountingQueries.ts module with 7 query functions extracted from existing route patterns
- Riley agent definition with 12 tools covering all company-wide financial queries
- Supervisor updated with Riley handoff and explicit finance routing rules (Riley for staff, Taylor for tenants/landlords)
- 51 tests passing covering agent definition, tool names, instruction content, query logic, and supervisor registration

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): Shared accounting queries + Riley agent + tests** - `6cd312b` (test)
2. **Task 1 (GREEN) + Task 2: Riley agent implementation + Supervisor registration** - `73af0dd` (feat)

_Note: TDD task with RED/GREEN commits. Supervisor registration merged into GREEN commit since tests require it._

## Files Created/Modified
- `server/accountingQueries.ts` - 7 shared query functions (trial balance, P&L, balance sheet, cash position, aged debtors/creditors, FY dates)
- `server/agents/sdk/businessAccountsAgent.ts` - Riley agent with 12 tools, gpt-4o model, pence-to-GBP instructions
- `server/__tests__/businessAccountsAgent.test.ts` - 51 static analysis tests
- `server/agents/sdk/supervisorAgent.ts` - Added Riley import, handoff, instructions, and finance routing rules

## Decisions Made
- Extracted shared query module from accountingRoutes.ts patterns rather than importing route handlers directly -- keeps agent tools decoupled from Express request/response cycle
- Clear domain boundary between Riley (company-wide financials) and Taylor (tenant/landlord finance) documented in both agent instructions and supervisor routing rules
- All tool execute functions use lazy imports for both pool and accountingQueries to avoid DB connections at module load time

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Riley agent fully wired into Supervisor with 6 total handoffs (Sales, Lettings, Admin, PM, Finance, Business Accounts)
- Ready for Phase 10 Plan 02 (if applicable) or Phase 11 (Property Sourcing Agent)
- Pre-existing test failures in headOfPM.test.ts (from Phase 9) are unrelated to this plan

---
*Phase: 10-business-accounts-agent-company-wide-financials*
*Completed: 2026-03-26*
