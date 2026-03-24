---
phase: 05-arrears-monitoring
plan: 02
subsystem: payments
tags: [stripe, gocardless, pg-boss, arrears, payment-links, compliance]

# Dependency graph
requires:
  - phase: 05-01
    provides: "Arrears chasing agent with compliance guard, dunning actions, vulnerability detection"
provides:
  - "PaymentLinkService with Stripe/GoCardless auto-detection"
  - "capturePaymentCommitmentTool for recording tenant payment promises"
  - "generatePaymentLinkTool for sending payment links via preferred channel"
  - "payment-commitment-followup pg-boss worker for verifying payments"
  - "schedulePaymentFollowUp scheduling method"
affects: [05-03, arrears-workflow, payment-processing]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Auto-detect payment method (GC mandate vs Stripe link)", "pg-boss follow-up chain with attempt counter and escalation"]

key-files:
  created:
    - server/agents/services/paymentLinkService.ts
    - tests/agents/paymentLinks.test.ts
    - tests/agents/arrearsFollowUp.test.ts
  modified:
    - server/agents/sdk/tools.ts
    - server/agents/sdk/arrearsAgent.ts
    - server/agents/services/scheduledMessages.ts
    - tests/agents/arrearsAgent.test.ts

key-decisions:
  - "Auto-detect payment method: GoCardless for tenants with active mandates, Stripe links for one-off"
  - "3 follow-up attempt limit before mandatory human escalation"
  - "Payment verification window: commitDate -1 day to +3 days"

patterns-established:
  - "Payment follow-up chain: pg-boss job with attemptNumber increment and compliance guard at each step"
  - "PaymentLinkService pattern: auto-detect then delegate to Stripe or GoCardless"

requirements-completed: [PM-07]

# Metrics
duration: 12min
completed: 2026-03-24
---

# Phase 5 Plan 2: Payment Commitment & Link Dispatch Summary

**PaymentLinkService with Stripe/GoCardless auto-detection, commitment capture tools, and pg-boss follow-up worker for payment verification**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-24T11:49:25Z
- **Completed:** 2026-03-24T12:01:00Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- PaymentLinkService auto-detects tenant's payment method (GoCardless mandate or Stripe link)
- capturePaymentCommitmentTool records promises with audit trail and schedules follow-up
- generatePaymentLinkTool sends payment links via SMS/WhatsApp/email
- payment-commitment-followup worker verifies payments, updates arrears status, and escalates after 3 attempts
- All 18 new tests pass, existing test suite updated

## Task Commits

Each task was committed atomically:

1. **Task 1: Build PaymentLinkService and add tools to arrears agent** - `63c2217` (feat)
2. **Task 2: Build payment commitment follow-up worker** - `e41db63` (feat)
3. **Fix: Update arrearsAgent test for 6 tools** - `59bf0de` (fix)

## Files Created/Modified
- `server/agents/services/paymentLinkService.ts` - Stripe/GoCardless payment link generation with auto-detection
- `server/agents/sdk/tools.ts` - capturePaymentCommitmentTool and generatePaymentLinkTool
- `server/agents/sdk/arrearsAgent.ts` - Updated to 6 tools with payment commitment instructions
- `server/agents/services/scheduledMessages.ts` - payment-commitment-followup worker and schedulePaymentFollowUp
- `tests/agents/paymentLinks.test.ts` - 10 tests for PaymentLinkService and tools
- `tests/agents/arrearsFollowUp.test.ts` - 8 tests for follow-up worker
- `tests/agents/arrearsAgent.test.ts` - Updated tool count assertion

## Decisions Made
- Auto-detect payment method: GoCardless for tenants with active mandates, Stripe payment links for one-off
- 3 follow-up attempt limit before mandatory human escalation (matches compliance guard's contact limit)
- Payment verification uses a window of commitDate -1 day to +3 days to account for processing delays
- Lazy imports for paymentLinkService and scheduledMessageService in tools.ts (avoid circular deps at module load)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated existing arrearsAgent test to expect 6 tools**
- **Found during:** Verification (full test suite)
- **Issue:** Existing test asserted 4 tools, now 6 after adding payment tools
- **Fix:** Updated assertion from 4 to 6
- **Files modified:** tests/agents/arrearsAgent.test.ts
- **Verification:** All tests pass
- **Committed in:** 59bf0de

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary test update from our changes. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required. Stripe and GoCardless use existing environment variables.

## Next Phase Readiness
- Payment commitment capture and verification complete
- Ready for Phase 05-03 (arrears reporting/dashboard if applicable)
- Escalation chain fully wired: compliance guard -> follow-up worker -> human escalation

---
*Phase: 05-arrears-monitoring*
*Completed: 2026-03-24*
