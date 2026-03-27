---
phase: 12-kanban-pipelines-lead-auto-matching
plan: 01
subsystem: api, database
tags: [pipeline, kanban, lead-matching, scoring, postgres, raw-sql]

requires:
  - phase: none
    provides: existing properties/leads tables and property-pipeline endpoints
provides:
  - pipeline_stage column on properties table (14 lifecycle stages)
  - lead_property_match table for auto-matching
  - leadMatchingService with weighted scoring engine
  - Lettings pipeline GET endpoint
  - Extended PATCH status with auto-match trigger on 'listed'
  - Lead match CRUD endpoints (list, stats, approve, dismiss, bulk-approve)
affects: [12-02, 12-03]

tech-stack:
  added: []
  patterns: [lazy-import for leadMatchingService in route handler, fire-and-forget matching on stage change]

key-files:
  created:
    - server/leadMatchingService.ts
  modified:
    - shared/schema.ts
    - server/crmRoutes.ts

key-decisions:
  - "Lazy import for leadMatchingService in PATCH handler (consistent with project pattern, avoids circular deps)"
  - "Pipeline stage stored alongside legacy status for backward compatibility (dual-write)"
  - "Budget/bedrooms/area/type scoring weights: 40/25/25/10 with threshold >= 50"
  - "Email-only for match notifications (approveMatch sends branded HTML email)"

patterns-established:
  - "Pipeline stage dual-write: update both status (legacy) and pipeline_stage (new kanban)"
  - "Auto-match trigger: fire-and-forget createMatchesForProperty on 'listed' stage transition"

requirements-completed: [KAN-04, KAN-05, KAN-07, KAN-08]

duration: 5min
completed: 2026-03-27
---

# Phase 12 Plan 01: Schema Extensions, Lead Matching Service, and Pipeline API Endpoints Summary

**Pipeline stage lifecycle tracking with weighted lead auto-matching engine (budget 40, bedrooms 25, area 25, type 10) and full CRUD API for sales/lettings pipelines and match management**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-27T20:57:06Z
- **Completed:** 2026-03-27T21:02:25Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Extended properties table with pipeline_stage (14 lifecycle values) plus valuation/lettings timestamp and agent columns
- Created lead_property_match table and leadMatchingService with weighted scoring (threshold >= 50)
- Sales pipeline endpoint filters is_rental=false, lettings pipeline filters is_rental=true
- Auto-match trigger fires on 'listed' stage transition, creating pending matches for staff review
- Match management endpoints: list with filters, stats, approve (sends branded email), dismiss, bulk-approve

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema extensions and lead matching service** - `7fa4957` (feat)
2. **Task 2: Backend API endpoints for pipelines and lead matching** - `f89a67b` (feat)

## Files Created/Modified
- `shared/schema.ts` - Added pipeline_stage, valuation/lettings timestamps/agents to properties; added leadPropertyMatches table
- `server/leadMatchingService.ts` - Lead auto-matching engine with findMatchingLeads, createMatchesForProperty, approveMatch, dismissMatch
- `server/crmRoutes.ts` - Extended property-pipeline GET (sales-only), added lettings-pipeline GET, extended PATCH status for 18 stages, added lead-matches CRUD endpoints

## Decisions Made
- Lazy import for leadMatchingService in PATCH handler (consistent with project convention for avoiding circular deps)
- Pipeline stage stored alongside legacy status for backward compat (dual-write: status for old code, pipeline_stage for kanban views)
- Budget/bedrooms/area/type scoring weights: 40/25/25/10 with threshold >= 50 (budget gets highest weight as primary filter)
- Email-only for match notifications via approveMatch (branded HTML with property image, price, bedrooms, view link)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Sales pipeline frontend (Plan 02) can consume GET /api/crm/property-pipeline with pipeline_stage field
- Lettings pipeline frontend (Plan 03) can consume GET /api/crm/lettings-pipeline
- Both can use PATCH /api/crm/property-pipeline/:id/status with stage body field
- Lead match management UI can consume /api/crm/lead-matches/* endpoints

---
*Phase: 12-kanban-pipelines-lead-auto-matching*
*Completed: 2026-03-27*
