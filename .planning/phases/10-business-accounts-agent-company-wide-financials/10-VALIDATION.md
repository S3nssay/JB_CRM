---
phase: 10
slug: business-accounts-agent-company-wide-financials
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run server/__tests__/businessAccountsAgent.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/__tests__/businessAccountsAgent.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | BIZ-01 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "supervisor registration"` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | BIZ-02 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "profit and loss"` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | BIZ-03 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "balance sheet"` | ❌ W0 | ⬜ pending |
| 10-01-04 | 01 | 1 | BIZ-04 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "vat return"` | ❌ W0 | ⬜ pending |
| 10-01-05 | 01 | 1 | BIZ-05 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "period close"` | ❌ W0 | ⬜ pending |
| 10-02-01 | 02 | 2 | BIZ-06 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "recurring invoices"` | ❌ W0 | ⬜ pending |
| 10-02-02 | 02 | 2 | BIZ-07 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "aged debtors"` | ❌ W0 | ⬜ pending |
| 10-02-03 | 02 | 2 | BIZ-08 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "cash position"` | ❌ W0 | ⬜ pending |
| 10-02-04 | 02 | 2 | BIZ-09 | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "auto journal"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/__tests__/businessAccountsAgent.test.ts` — stubs for BIZ-01 through BIZ-09
- [ ] No new framework install needed (Vitest already configured)

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Supervisor routes to Riley for financial queries | BIZ-01 | Requires multi-turn conversation context | Send "What's our P&L?" via chat, verify Riley responds |
| PDF report generation renders correctly | BIZ-02/03 | Visual layout verification | Generate P&L PDF, check formatting |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
