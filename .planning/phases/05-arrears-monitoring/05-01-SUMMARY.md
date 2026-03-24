---
phase: 05-arrears-monitoring
plan: 01
subsystem: agents
tags: [arrears, compliance, vulnerability-detection, pg-boss, openai-agents-sdk, twilio]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Tool registry, knowledge base, audit logger
  - phase: 02-text-channel-agents
    provides: Agent SDK pattern, messageSender, escalationService, scheduledMessages, contact_identity opt-out
provides:
  - ArrearsComplianceGuard with 6 hard-coded contact rules
  - VulnerabilityDetector for tenant message scanning
  - Arrears chasing agent (Sarah from Accounts) with 4 SDK tools
  - pg-boss arrears-chase scheduled worker
affects: [05-02, 05-03, 06-cross-agent-collaboration]

# Tech tracking
tech-stack:
  added: []
  patterns: [compliance-guard-as-code, vulnerability-keyword-detection, contact-rate-limiting]

key-files:
  created:
    - server/agents/services/arrearsComplianceGuard.ts
    - server/agents/services/vulnerabilityDetector.ts
    - server/agents/sdk/arrearsAgent.ts
    - tests/agents/complianceGuard.test.ts
    - tests/agents/arrearsAgent.test.ts
  modified:
    - server/agents/sdk/tools.ts
    - server/agents/services/scheduledMessages.ts
    - server/agents/types.ts

key-decisions:
  - "Compliance rules enforced in code (ArrearsComplianceGuard), not LLM prompts -- LLM cannot bypass contact limits"
  - "Vulnerability detection uses regex keyword matching by category (financial, mental_health, health, domestic, bereavement)"
  - "48-hour contact window applies per-type: messages (sms/whatsapp/email) share one window, phone_call has separate window"
  - "UK time enforcement uses Intl.DateTimeFormat with Europe/London timezone for DST-aware checks"
  - "Lazy imports for arrearsComplianceGuard and messageSender in tools.ts to avoid circular deps at module load"

patterns-established:
  - "Compliance guard pattern: code-level enforcement wrapping tool execution, not prompt-level instructions"
  - "Vulnerability detection: keyword regex by category with immediate escalation trigger"

requirements-completed: [PM-06, PM-08]

# Metrics
duration: 7min
completed: 2026-03-24
---

# Phase 5 Plan 1: Arrears Chasing Agent Summary

**Hard-coded ArrearsComplianceGuard enforcing 6 contact rules + VulnerabilityDetector + arrears agent (Sarah from Accounts) with compliance-gated send tool and pg-boss scheduled chasing**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-24T11:37:45Z
- **Completed:** 2026-03-24T11:45:00Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- ArrearsComplianceGuard enforces opt-out, vulnerability flag, time-of-day (09:00-20:00 UK), Sunday block, 3-contact escalation limit, and 48-hour contact window -- all in code
- VulnerabilityDetector catches financial hardship, mental health, health, domestic abuse, and bereavement keywords via regex
- Arrears agent (Sarah from Accounts) sends payment reminders only after compliance guard approval
- pg-boss arrears-chase worker handles scheduled outbound reminders with compliance check and auto-reschedule
- 29 tests across both test files covering all compliance rules, vulnerability detection, agent persona, tool execution, and compliance integration

## Task Commits

Each task was committed atomically:

1. **Task 1: Build ArrearsComplianceGuard and VulnerabilityDetector** - `de2c1d9` (feat)
2. **Task 2: Build Arrears Chasing Agent with SDK tools and pg-boss scheduling** - `53fc31a` (feat)

## Files Created/Modified
- `server/agents/services/arrearsComplianceGuard.ts` - Hard-coded compliance guard with canContact(), logContactAttempt(), getContactHistory()
- `server/agents/services/vulnerabilityDetector.ts` - Keyword-based vulnerability detection across 5 categories
- `server/agents/sdk/arrearsAgent.ts` - Arrears chasing agent (Sarah from Accounts) with empathetic persona
- `server/agents/sdk/tools.ts` - Added lookupArrearsCaseTool, sendPaymentReminderTool, escalateArrearsCaseTool
- `server/agents/services/scheduledMessages.ts` - Added arrears-chase pg-boss worker and scheduleArrearsChase method
- `server/agents/types.ts` - Added 'arrears' to AgentType union
- `tests/agents/complianceGuard.test.ts` - 18 tests for compliance guard and vulnerability detector
- `tests/agents/arrearsAgent.test.ts` - 11 tests for arrears agent, tools, and vulnerability integration

## Decisions Made
- Compliance rules enforced in code (ArrearsComplianceGuard), not LLM prompts -- LLM cannot bypass contact limits
- Vulnerability detection uses regex keyword matching by category (financial, mental_health, health, domestic, bereavement)
- 48-hour contact window applies per-type: messages (sms/whatsapp/email) share one window, phone_call has separate window
- UK time enforcement uses Intl.DateTimeFormat with Europe/London timezone for DST-aware checks
- Lazy imports for arrearsComplianceGuard and messageSender in tools.ts to avoid circular deps at module load

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added 'arrears' to AgentType union**
- **Found during:** Task 1 (ArrearsComplianceGuard)
- **Issue:** AgentType union in types.ts did not include 'arrears', needed for audit logging
- **Fix:** Added 'arrears' to the AgentType union type
- **Files modified:** server/agents/types.ts
- **Verification:** TypeScript compiles without errors
- **Committed in:** de2c1d9 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Minor type addition required for correctness. No scope creep.

## Issues Encountered
- Initial test mocking approach for Drizzle query chains was too simplistic -- rewrote with a sequential queryResults array pattern that tracks query order. Resolved in Task 1.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Arrears agent and compliance guard ready for integration with arrears monitoring dashboard (05-02)
- All contact rules are code-enforced and tested
- pg-boss worker ready for scheduled arrears chasing

---
*Phase: 05-arrears-monitoring*
*Completed: 2026-03-24*
