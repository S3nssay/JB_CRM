---
phase: 7
slug: agent-corrections-cost-ledger
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-24
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 |
| **Config file** | `vitest.config.ts` |
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
| 07-01-01 | 01 | 1 | CORR-01 | unit | `npx vitest run server/agents/__tests__/recordOffer.test.ts -t "inserts offer"` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 1 | CORR-02 | unit | `npx vitest run server/agents/__tests__/agentPrompts.test.ts -t "no negotiation"` | ❌ W0 | ⬜ pending |
| 07-02-01 | 02 | 1 | CORR-03 | unit | `npx vitest run server/__tests__/offerRoutes.test.ts -t "creates notification"` | ❌ W0 | ⬜ pending |
| 07-02-02 | 02 | 1 | CORR-04 | unit | `npx vitest run server/__tests__/offerRoutes.test.ts -t "sends email"` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 2 | COST-01 | unit | `npx vitest run server/__tests__/costLedger.test.ts -t "aggregates maintenance"` | ❌ W0 | ⬜ pending |
| 07-03-02 | 03 | 2 | COST-02 | unit | `npx vitest run server/__tests__/costLedger.test.ts -t "aggregates compliance"` | ❌ W0 | ⬜ pending |
| 07-03-03 | 03 | 2 | COST-03 | unit | `npx vitest run server/__tests__/costLedger.test.ts -t "threshold email"` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | OFFER-UI | manual-only | Manual: test in browser | N/A | ⬜ pending |
| 07-04-02 | 04 | 2 | COST-UI | manual-only | Manual: test in browser | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/agents/__tests__/recordOffer.test.ts` — stubs for CORR-01, CORR-02
- [ ] `server/agents/__tests__/agentPrompts.test.ts` — stubs for CORR-02
- [ ] `server/__tests__/offerRoutes.test.ts` — stubs for CORR-03, CORR-04
- [ ] `server/__tests__/costLedger.test.ts` — stubs for COST-01, COST-02, COST-03

*Existing Vitest infrastructure covers framework install.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Offer management UI (accept/reject/counter) | OFFER-UI | Browser interaction, React component rendering | Navigate to property detail page, verify offers section shows, test accept/reject/counter buttons |
| Cost ledger renders on property and landlord pages | COST-UI | Browser interaction, React component rendering | Navigate to property and landlord pages, verify cost summary and expense table render |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
