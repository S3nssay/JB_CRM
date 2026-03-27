---
phase: 11-property-sourcing-agent-market-intelligence-owner-outreach
plan: 02
subsystem: agents
tags: [openai, pdf-generation, outreach, approval-workflow, follow-up-sequence, charlie]

requires:
  - phase: 11-property-sourcing-agent-market-intelligence-owner-outreach
    provides: SourcingAgent infrastructure, lead_contact_history approval columns, proactive_leads schema
  - phase: 08-pm-finance-agent-landlord-statements-tenant-invoices
    provides: pdfService branded PDF pattern (drawHeader, drawFooter, collectBuffer)
provides:
  - AI-powered outreach drafting service with source-specific templates (expired listing, auction, land registry, probate, competitor, planning)
  - Branded letter PDF generation for post-channel outreach
  - Staff approval workflow (approve/reject/edit outreach drafts)
  - Follow-up sequence management with default 3-touch cadence (post->email->post)
  - Email sending only after explicit staff approval
affects: [11-03, 11-04]

tech-stack:
  added: []
  patterns: [source-specific-prompt-builder, approval-before-send-guard, follow-up-sequence-cadence]

key-files:
  created:
    - server/agents/services/sourcingOutreachService.ts
    - server/agents/services/sourcingApprovalService.ts
    - server/agents/services/sourcingFollowUpService.ts
  modified:
    - server/services/pdfService.ts
    - server/__tests__/sourcingOutreach.test.ts

key-decisions:
  - "Source-specific prompt builder as pure function mapping lead_source to OpenAI prompt context"
  - "gpt-4o-mini for outreach drafting (high volume, cost efficiency)"
  - "Probate leads get sensitive, respectful messaging with explicit test coverage"
  - "Default follow-up sequence: letter(day 0) -> email(day 7) -> letter(day 21)"
  - "Lazy imports for all pool/openai/emailService dependencies (avoid module-load side effects)"

patterns-established:
  - "Outreach approval guard: draftOutreach never calls emailService, only sendApprovedEmail does"
  - "Source-specific prompt builder: switch on lead_source to generate contextual AI prompts"
  - "Follow-up sequence: configurable cadence with default 3-step (post/email/post)"

requirements-completed: [SRC-04, SRC-05, SRC-06, SRC-07]

duration: 15min
completed: 2026-03-27
---

# Phase 11 Plan 02: Outreach Drafting & Approval Summary

**AI-powered source-specific outreach drafting with branded letter PDFs, staff approval workflow, and multi-touch follow-up sequence management for Charlie sourcing agent**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-27T10:31:38Z
- **Completed:** 2026-03-27T10:46:38Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- AI outreach drafting with source-specific templates for 6+ lead types (expired listing, auction, land registry/probate, competitor listing, planning permission)
- Branded outreach letter PDF generation extending existing pdfService pattern
- Staff approval workflow: approve triggers send, reject blocks outreach, edit regenerates PDF
- Follow-up sequence manager with default 3-touch cadence and campaign-specific overrides
- 49 static analysis tests covering all source types, approval guards, sequence logic

## Task Commits

Each task was committed atomically:

1. **Task 1: Outreach drafting service + letter PDF generation** - `6c11844` (feat)
2. **Task 2: Approval service + follow-up sequence management** - `f5b01ee` (feat)

## Files Created/Modified
- `server/agents/services/sourcingOutreachService.ts` - AI draft generation, PDF letter creation, email sending post-approval
- `server/agents/services/sourcingApprovalService.ts` - Approve/reject/edit workflow with channel-specific send triggers
- `server/agents/services/sourcingFollowUpService.ts` - Follow-up sequence management with default 3-step cadence
- `server/services/pdfService.ts` - Extended with generateOutreachLetterPDF for branded outreach letters
- `server/__tests__/sourcingOutreach.test.ts` - 49 static analysis tests for all services

## Decisions Made
- Source-specific prompt builder as pure function mapping lead_source to context-specific OpenAI prompts
- gpt-4o-mini for outreach drafting (high volume, cost-efficient)
- Probate leads receive sensitive, respectful messaging with explicit "difficult time" language
- Default follow-up sequence: letter(day 0) -> email(day 7) -> letter(day 21), overridable per campaign
- Lazy imports throughout for pool, openai, emailService (consistent with existing agent service patterns)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test regex for DEFAULT_SEQUENCE multi-line matching**
- **Found during:** Task 1 (TDD GREEN phase)
- **Issue:** Test regex `DEFAULT_SEQUENCE\s*[=:]\s*\[[\s\S]*?\]` used non-greedy match that stopped at first `]` inside object literal
- **Fix:** Changed regex to `DEFAULT_SEQUENCE[\s\S]*?\];` to match through the closing `];`
- **Files modified:** server/__tests__/sourcingOutreach.test.ts
- **Committed in:** 6c11844 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Test regex fix only, no scope creep.

## Issues Encountered
None beyond the test regex fix documented above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Outreach drafting, approval, and follow-up services ready for API routes (Plan 03)
- PDF generation tested and integrated into existing pdfService
- All services use lazy imports for safe module loading

## Self-Check: PASSED

- All 5 files exist on disk
- Commit 6c11844 (Task 1) verified in git log
- Commit f5b01ee (Task 2) verified in git log
- 49/49 tests pass

---
*Phase: 11-property-sourcing-agent-market-intelligence-owner-outreach*
*Completed: 2026-03-27*
