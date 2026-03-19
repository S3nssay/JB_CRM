---
phase: 01-foundation
plan: 03
subsystem: ai-agents
tags: [tool-registry, zod, openai-function-calling, drizzle, knowledge-base, tdd]

# Dependency graph
requires:
  - phase: 01-01
    provides: propertySystemsInventory table, propertyCertifications table, vitest config, test stubs
provides:
  - Tool Registry framework with Zod validation, permission checking, and OpenAI schema export
  - 5 CRM action tools: search_properties, query_knowledge_base, create_lead, create_maintenance_ticket, book_viewing
  - queryKnowledgeBase tool querying certifications, systems inventory, and maintenance history
  - zodToJsonSchema converter for OpenAI function-calling format
affects: [01-04, 01-05, 02-text-agents]

# Tech tracking
tech-stack:
  added: []
  patterns: [ToolDefinition interface with Zod schemas, singleton ToolRegistry, TDD red-green for tools]

key-files:
  created:
    - server/agents/tools/types.ts
    - server/agents/tools/registry.ts
    - server/agents/tools/definitions/searchProperties.ts
    - server/agents/tools/definitions/queryKnowledgeBase.ts
    - server/agents/tools/definitions/createLead.ts
    - server/agents/tools/definitions/createMaintenanceTicket.ts
    - server/agents/tools/definitions/bookViewing.ts
  modified:
    - tests/tools/registry.test.ts
    - tests/tools/queryKnowledgeBase.test.ts

key-decisions:
  - "Used z.any() for date fields in output schemas since Drizzle returns Date objects and Zod date validation is strict"
  - "Mapped plan priority values (low/medium/high/emergency) to schema urgency values (low/routine/urgent/emergency) in createMaintenanceTicket"
  - "Used schema's actual leadType values (rental/purchase/both/landlord/seller) instead of plan's values (buyer/tenant)"
  - "bookViewing creates lead if not found by email/phone, defaulting to rental leadType and ai_agent source"

patterns-established:
  - "Tool pattern: ToolDefinition with Zod input/output schemas, permissions array, tier, and execute function"
  - "Registry pattern: singleton toolRegistry with register/invoke/getOpenAITools methods"
  - "Schema-first tool development: grep schema.ts for exact column names before writing any tool"

requirements-completed: [AGENT-02, KB-04, KB-01, KB-03]

# Metrics
duration: 6min
completed: 2026-03-19
---

# Phase 1 Plan 03: Tool Registry & CRM Action Tools Summary

**Tool Registry framework with Zod validation, permission checking, OpenAI function schema export, and 5 CRM action tools (search, knowledge base, leads, maintenance, viewings)**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-19T13:57:46Z
- **Completed:** 2026-03-19T14:04:09Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Tool Registry with register, invoke (Zod validation + permission check), and getOpenAITools (JSON Schema export)
- 5 CRM action tools with real Drizzle ORM queries against properties, certifications, systems inventory, maintenance tickets, leads, and viewings tables
- queryKnowledgeBase returns certifications with expiry dates, systems inventory, and maintenance history -- sub-100ms with mocked DB
- All 10 tests pass (7 registry + 3 knowledge base)

## Task Commits

Each task was committed atomically:

1. **Task 1: Tool Registry framework and types** (TDD)
   - `f07b658` (test: failing registry tests -- RED)
   - `614f6a6` (feat: implement registry with types -- GREEN)
2. **Task 2: 5 CRM action tools** (TDD)
   - `f6ca314` (test: failing queryKnowledgeBase tests -- RED)
   - `1b146c9` (feat: implement 5 tools with registry integration -- GREEN)

## Files Created/Modified
- `server/agents/tools/types.ts` - ToolDefinition, ToolContext, ToolInvocationResult interfaces
- `server/agents/tools/registry.ts` - ToolRegistry class with zodToJsonSchema converter, singleton export, 5 tools registered
- `server/agents/tools/definitions/searchProperties.ts` - Property search by area/postcode/type/bedrooms/price
- `server/agents/tools/definitions/queryKnowledgeBase.ts` - Property certifications, systems, maintenance queries
- `server/agents/tools/definitions/createLead.ts` - Lead creation with CRM schema field mapping
- `server/agents/tools/definitions/createMaintenanceTicket.ts` - Maintenance ticket with priority-to-urgency mapping
- `server/agents/tools/definitions/bookViewing.ts` - Lead find-or-create + viewing scheduling
- `tests/tools/registry.test.ts` - 7 tests for registry register/invoke/permissions/validation/OpenAI export
- `tests/tools/queryKnowledgeBase.test.ts` - 3 tests for certifications, maintenance, and performance

## Decisions Made
- Used z.any() for date output fields -- Drizzle returns JS Date objects; strict Zod date parsing would reject DB results
- Mapped plan's priority enum to schema's urgency column (medium->routine, high->urgent)
- Used actual schema leadType values (rental/purchase/both/landlord/seller) instead of plan's (buyer/tenant/landlord)
- bookViewing auto-creates a lead if no match found by email/phone, keeping the viewing flow self-contained

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed leadType enum values to match schema**
- **Found during:** Task 2 (createLead tool)
- **Issue:** Plan specified leadType values as buyer/seller/tenant/landlord but schema uses rental/purchase/both/landlord/seller
- **Fix:** Used actual schema enum values in Zod input validation
- **Files modified:** server/agents/tools/definitions/createLead.ts
- **Verification:** Tool compiles, tests pass

**2. [Rule 1 - Bug] Fixed property filter flags to match schema**
- **Found during:** Task 2 (searchProperties tool)
- **Issue:** Plan referenced isListedRental/isListedSale but schema has isRental and isListed as separate booleans
- **Fix:** Used isRental boolean to differentiate rental vs sale
- **Files modified:** server/agents/tools/definitions/searchProperties.ts
- **Verification:** Tool compiles, tests pass

**3. [Rule 1 - Bug] Mapped priority to urgency for maintenance tickets**
- **Found during:** Task 2 (createMaintenanceTicket tool)
- **Issue:** Plan uses priority (low/medium/high/emergency) but schema column is urgency (low/routine/urgent/emergency)
- **Fix:** Added mapPriorityToUrgency function for translation
- **Files modified:** server/agents/tools/definitions/createMaintenanceTicket.ts
- **Verification:** Tool compiles, correct urgency values written

---

**Total deviations:** 3 auto-fixed (3 bug fixes for schema mismatch)
**Impact on plan:** All fixes required for correctness against actual DB schema. No scope creep.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Tool Registry ready for audit logging integration (Plan 04 will add auditLogger.logToolCall() to invoke method)
- 5 tools ready for agent orchestration in Phase 2 text channel agents
- getOpenAITools() export ready for OpenAI Agents SDK function calling

---
*Phase: 01-foundation*
*Completed: 2026-03-19*

## Self-Check: PASSED

All 9 files exist. All 4 commits verified.
