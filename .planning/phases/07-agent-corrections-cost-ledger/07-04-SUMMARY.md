---
phase: 07-agent-corrections-cost-ledger
plan: 04
subsystem: ui
tags: [react, tanstack-query, shadcn, offers, cost-ledger, wouter]

requires:
  - phase: 07-02
    provides: Offer management API endpoints
  - phase: 07-03
    provides: Cost ledger API endpoints
provides:
  - Central offers management dashboard at /crm/offers
  - Reusable OffersSection component for property detail pages
  - Reusable CostLedger component for property and landlord pages
  - CRM sidebar navigation link for offers
affects: [08-pm-finance-agent]

tech-stack:
  added: []
  patterns: [pence-to-GBP formatting with Intl.NumberFormat, expandable table rows for detail views]

key-files:
  created:
    - client/src/pages/OffersManagement.tsx
    - client/src/components/OffersSection.tsx
    - client/src/components/CostLedger.tsx
  modified:
    - client/src/pages/ManagedPropertyCard.tsx
    - client/src/pages/LandlordDetails.tsx
    - client/src/components/CRMLayout.tsx
    - client/src/App.tsx

key-decisions:
  - "Offers nav link placed in Deals section of sidebar (logical grouping with deal lifecycle)"
  - "CostLedger uses dual mode prop (property/landlord) rather than separate components"
  - "ManagedPropertyCard tabs expanded from 5 to 7 columns for Offers and Costs"

patterns-established:
  - "Pence-to-GBP: formatGBP helper using Intl.NumberFormat('en-GB', {style:'currency',currency:'GBP'}).format(pence/100)"
  - "Status badges: color mapping record type for consistent offer/deal status display"

requirements-completed: [OFFER-UI, COST-UI]

duration: 9min
completed: 2026-03-26
---

# Phase 7 Plan 4: Offers Dashboard and Cost Ledger UI Summary

**Central offers dashboard with filter/accept/reject/counter actions, cost ledger component with property and landlord modes, and full route/navigation wiring**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-26T15:14:22Z
- **Completed:** 2026-03-26T15:23:09Z
- **Tasks:** 2 of 3 (Task 3 is human verification checkpoint)
- **Files modified:** 7

## Accomplishments
- OffersManagement page with filterable table, status/property search, and accept/reject/counter action dialogs
- OffersSection reusable component for property detail pages with lettings-specific fields
- CostLedger dual-mode component: property mode (maintenance/compliance breakdown + threshold config) and landlord mode (per-property totals)
- ManagedPropertyCard expanded with Offers and Costs tabs
- LandlordDetails expanded with Costs tab
- CRM sidebar Offers navigation link in Deals section
- /crm/offers route correctly placed before /crm catch-all in App.tsx

## Task Commits

Each task was committed atomically:

1. **Task 1: Offers dashboard page and offers section component** - `7ac57bd` (feat)
2. **Task 2: Cost ledger component, page wiring, and navigation** - `9b71a9a` (feat)

## Files Created/Modified
- `client/src/pages/OffersManagement.tsx` - Central offers dashboard with filters, table, accept/reject/counter dialogs
- `client/src/components/OffersSection.tsx` - Reusable offers section for property detail pages
- `client/src/components/CostLedger.tsx` - Dual-mode cost ledger (property/landlord) with threshold management
- `client/src/pages/ManagedPropertyCard.tsx` - Added Offers and Costs tabs
- `client/src/pages/LandlordDetails.tsx` - Added Costs tab with CostLedger in landlord mode
- `client/src/components/CRMLayout.tsx` - Added Offers navigation link with Handshake icon
- `client/src/App.tsx` - Added /crm/offers route before /crm catch-all

## Decisions Made
- Offers nav link grouped under Deals section in sidebar for logical proximity
- CostLedger uses single component with mode prop rather than two separate components
- ManagedPropertyCard grid expanded to 7 columns to accommodate new tabs
- LandlordDetails Costs tab uses same tab styling as existing tabs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 7 UI work complete
- Offers and cost ledger UIs connect to APIs from Plans 02 and 03
- Ready for Phase 8 (PM Finance Agent)

---
*Phase: 07-agent-corrections-cost-ledger*
*Completed: 2026-03-26*
