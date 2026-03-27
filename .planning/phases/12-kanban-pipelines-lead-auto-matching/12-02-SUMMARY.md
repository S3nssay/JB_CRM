---
phase: 12-kanban-pipelines-lead-auto-matching
plan: 02
subsystem: ui
tags: [kanban, pipeline, react, sales, lettings, property-lifecycle]

requires:
  - phase: 12-01
    provides: pipeline_stage column, property-pipeline and lettings-pipeline API endpoints, PATCH status with matchCount
provides:
  - 9-stage sales kanban (Valuation Enquiry to Completed) with terminal actions
  - 9-stage lettings kanban (Valuation Enquiry to Move-in Complete) as standalone page
  - Match count toast on Listed stage advancement
affects: [12-03]

tech-stack:
  added: []
  patterns: [dedicated pipeline pages per workflow type, terminal stages as card actions not columns]

key-files:
  created:
    - client/src/pages/LettingsPropertyPipeline.tsx
  modified:
    - client/src/pages/PropertyPipeline.tsx

key-decisions:
  - "Separate pages for sales and lettings pipelines (not shared component) per user decision"
  - "Terminal stages (fallen_through, withdrawn) shown as collapsible section below stats, not kanban columns"
  - "Sales pipeline removes listing type filter (page is now sales-only; lettings has own page)"

patterns-established:
  - "Pipeline page pattern: header + filter bar + stats grid + horizontal kanban with 280px columns"
  - "Terminal stage pattern: card actions on any active-stage card, collapsible summary row"

requirements-completed: [KAN-01, KAN-02, KAN-06, KAN-07, KAN-08]

duration: 3min
completed: 2026-03-27
---

# Phase 12 Plan 02: Sales and Lettings Property Pipeline UI Summary

**9-stage sales kanban extended with valuation workflow and new standalone lettings pipeline page with lettings-specific stages from Valuation Enquiry to Move-in Complete**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-27T21:04:57Z
- **Completed:** 2026-03-27T21:08:49Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Extended sales PropertyPipeline.tsx from 7 to 9 active stages with 4 valuation stages prepended
- Created standalone LettingsPropertyPipeline.tsx with 9 lettings-specific stages (Viewings, Holding Deposit, Tenancy Agreed, Move-in Complete)
- Terminal stages (Fallen Through, Withdrawn) available as card actions on any active sales stage, with collapsible summary section
- Match count toast displays when property advanced to Listed stage

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend Sales PropertyPipeline.tsx with valuation stages** - `ab869ed` (feat)
2. **Task 2: Create Lettings Property Pipeline page** - `53e7e4e` (feat)

## Files Created/Modified
- `client/src/pages/PropertyPipeline.tsx` - Extended to 9-stage sales kanban with pipeline_stage grouping, terminal actions, matchCount toast
- `client/src/pages/LettingsPropertyPipeline.tsx` - New standalone lettings pipeline with 9 stages, rent pcm display, empty state

## Decisions Made
- Separate pages for sales and lettings (not shared component) per user decision in planning phase
- Terminal stages rendered as card action buttons (AlertTriangle for Fallen Through, XCircle for Withdrawn) on any non-completed card
- Collapsible terminal properties section below stats row shows fallen through/withdrawn counts with re-list capability
- Sales page removes listing type filter since it now only shows sales properties

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - both pages are fully wired to their respective API endpoints.

## Next Phase Readiness
- Sales and lettings pipeline pages ready for route registration in Plan 03
- Plan 03 will add routes in App.tsx and navigation links in CRMLayout.tsx

---
*Phase: 12-kanban-pipelines-lead-auto-matching*
*Completed: 2026-03-27*
