---
phase: 6
slug: cross-agent-collaboration-deal-lifecycle-automation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (installed in Phase 1) |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | DEAL-01 | unit | `npx vitest run server/agents/services/__tests__/dealEventBus.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-01-02 | 01 | 1 | DEAL-02 | unit | `npx vitest run server/agents/services/__tests__/dealPipeline.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | DEAL-03 | unit | `npx vitest run server/agents/services/__tests__/dealTimeout.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-03-01 | 03 | 2 | DEAL-04 | integration | `npx vitest run server/__tests__/dealRoutes.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-04-01 | 04 | 2 | DEAL-05 | integration | `npx vitest run server/__tests__/notificationSSE.test.ts -x` | ❌ W0 | ⬜ pending |
| 06-05-01 | 05 | 3 | DEAL-06 | smoke | Manual -- verify UI renders | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/agents/services/__tests__/dealEventBus.test.ts` — stubs for DEAL-01
- [ ] `server/agents/services/__tests__/dealPipeline.test.ts` — stubs for DEAL-02, DEAL-03
- [ ] `server/__tests__/dealRoutes.test.ts` — stubs for DEAL-04
- [ ] `server/__tests__/notificationSSE.test.ts` — stubs for DEAL-05

*Existing Vitest infrastructure covers framework setup.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Deal timeline page renders step history | DEAL-06 | UI rendering requires browser | Navigate to /crm/deals, click a deal, verify timeline shows agent actions in order |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
