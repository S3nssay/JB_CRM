---
phase: 5
slug: arrears-monitoring
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (existing) |
| **Quick run command** | `npx vitest run tests/agents/arrears*.test.ts tests/agents/compliance*.test.ts --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/agents/arrears*.test.ts tests/agents/compliance*.test.ts --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | PM-08 | unit | `npx vitest run tests/agents/complianceGuard.test.ts` | W0 | pending |
| 05-01-02 | 01 | 1 | PM-06, PM-08 | unit+integration | `npx vitest run tests/agents/arrearsAgent.test.ts` | W0 | pending |
| 05-02-01 | 02 | 2 | PM-07 | unit | `npx vitest run tests/agents/paymentLinks.test.ts` | W0 | pending |
| 05-02-02 | 02 | 2 | PM-07 | unit | `npx vitest run tests/agents/arrearsFollowUp.test.ts` | W0 | pending |
| 05-03-01 | 03 | 3 | PM-08 | integration | `npx vitest run tests/agents/monitoringApi.test.ts` | W0 | pending |
| 05-03-02 | 03 | 3 | PM-08 | visual | manual | N/A | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `tests/agents/complianceGuard.test.ts` — stubs for PM-08 compliance rules
- [ ] `tests/agents/arrearsAgent.test.ts` — stubs for PM-06 arrears chasing
- [ ] `tests/agents/paymentLinks.test.ts` — stubs for PM-07 payment links
- [ ] `tests/agents/arrearsFollowUp.test.ts` — stubs for PM-07 follow-ups
- [ ] `tests/agents/monitoringApi.test.ts` — stubs for dashboard API endpoints

*Existing vitest infrastructure covers framework setup. Only test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Dashboard UI renders correctly | PM-08 | Visual layout verification | Navigate to /crm/agent-monitoring, verify filters, table, thread viewer |
| Payment link opens in browser | PM-07 | External Stripe/GoCardless URL | Click generated payment link, verify Stripe checkout loads |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
