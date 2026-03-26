---
phase: 9
slug: head-of-property-management-agent
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured) |
| **Config file** | vitest.config.ts (or inline in package.json) |
| **Quick run command** | `npx vitest run server/__tests__/headOfPM.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/__tests__/headOfPM.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | HPM-01 | unit (static analysis) | `npx vitest run server/__tests__/headOfPM.test.ts -t "agent definition"` | W0 | pending |
| 09-01-02 | 01 | 1 | HPM-02 | unit (static analysis) | `npx vitest run server/__tests__/headOfPM.test.ts -t "handoffs"` | W0 | pending |
| 09-01-03 | 01 | 1 | HPM-03 | unit | `npx vitest run server/__tests__/headOfPM.test.ts -t "portfolio tools"` | W0 | pending |
| 09-02-01 | 02 | 1 | HPM-04 | unit | `npx vitest run server/__tests__/portfolioMonitor.test.ts -t "compliance check"` | W0 | pending |
| 09-02-02 | 02 | 1 | HPM-05 | unit | `npx vitest run server/__tests__/portfolioMonitor.test.ts -t "health report"` | W0 | pending |
| 09-03-01 | 03 | 2 | HPM-06 | unit | `npx vitest run server/__tests__/pmOverview.test.ts` | W0 | pending |
| 09-03-02 | 03 | 2 | HPM-06 | grep (UI integration) | `grep -c "compliance-alerts\|portfolio-health\|agent-activity" client/src/pages/PMTrackingDashboard.tsx` | n/a | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `server/__tests__/headOfPM.test.ts` -- stubs for HPM-01, HPM-02, HPM-03
- [ ] `server/__tests__/portfolioMonitor.test.ts` -- stubs for HPM-04, HPM-05
- [ ] `server/__tests__/pmOverview.test.ts` -- stubs for HPM-06 (response shape tests)
- No new framework install needed (Vitest already configured)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Agent responds correctly to natural language queries in chat | HPM-01 | Requires LLM interaction | Send test queries via agent chat UI, verify routing and response quality |
| Dashboard displays portfolio health data | HPM-05 | UI rendering | Navigate to PM dashboard, verify KPI cards and charts render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
