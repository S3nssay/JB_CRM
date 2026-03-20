---
phase: 4
slug: property-management
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-03-20
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run tests/agents/pmAgent.test.ts tests/agents/emergencyRules.test.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run tests/agents/ --reporter=verbose` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/agents/pmAgent.test.ts tests/agents/emergencyRules.test.ts --reporter=verbose`
- **After every plan wave:** Run `npx vitest run tests/agents/ --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | PM-01, PM-02 | unit | `npx vitest run tests/agents/emergencyRules.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | PM-01, PM-02 | integration | `npx vitest run tests/agents/pmAgent.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | PM-03, PM-04 | unit | `npx vitest run tests/agents/contractorDispatch.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | PM-03, PM-04 | integration | `npx vitest run tests/agents/contractorDispatch.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 3 | PM-05 | unit | `npx vitest run tests/agents/workOrderFollowup.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |
| 04-03-02 | 03 | 3 | PM-05 | integration | `npx vitest run tests/agents/workOrderFollowup.test.ts --reporter=verbose` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending / ✅ green / ❌ red / ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/agents/emergencyRules.test.ts` — stubs for PM-01, PM-02 urgency classification
- [ ] `tests/agents/pmAgent.test.ts` — stubs for PM-01, PM-02 agent persona and tool availability
- [ ] `tests/agents/contractorDispatch.test.ts` — stubs for PM-03, PM-04 contractor search, quotes, approval
- [ ] `tests/agents/workOrderFollowup.test.ts` — stubs for PM-05 follow-up scheduling and completion

*Existing infrastructure (vitest, test config) covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Landlord receives WhatsApp/SMS approval prompt with quote details | PM-04 | Requires live Twilio/WhatsApp channel | Send test fault report, verify landlord receives message with correct quote amount and approve/reject options |
| Contractor contacted via preferred channel with work order details | PM-03 | Requires live messaging channels | Create work order, verify contractor receives message via correct channel |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
