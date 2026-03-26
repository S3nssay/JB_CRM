---
phase: 8
slug: pm-finance-agent-landlord-statements-tenant-invoices
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1 |
| **Config file** | vitest.config.ts |
| **Quick run command** | `npx vitest run server/__tests__/financeAgent.test.ts` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run server/__tests__/financeAgent.test.ts`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 08-01-01 | 01 | 1 | FIN-01 | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "statement generation"` | ❌ W0 | ⬜ pending |
| 08-01-02 | 01 | 1 | FIN-02 | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "approval workflow"` | ❌ W0 | ⬜ pending |
| 08-01-03 | 01 | 1 | FIN-03 | unit | `npx vitest run server/__tests__/pdfService.test.ts` | ❌ W0 | ⬜ pending |
| 08-02-01 | 02 | 1 | FIN-04 | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "invoice generation"` | ❌ W0 | ⬜ pending |
| 08-02-02 | 02 | 1 | FIN-05 | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "payment links"` | ❌ W0 | ⬜ pending |
| 08-03-01 | 03 | 2 | FIN-08 | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "supervisor registration"` | ❌ W0 | ⬜ pending |
| 08-03-02 | 03 | 2 | FIN-10 | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "management fee"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/__tests__/financeAgent.test.ts` — stubs for FIN-01, FIN-02, FIN-04, FIN-05, FIN-08, FIN-10
- [ ] `server/__tests__/pdfService.test.ts` — stubs for FIN-03 (PDF generation)
- [ ] No new framework install needed (Vitest already configured)

*Existing infrastructure covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Branded PDF visual quality | FIN-03 | Visual inspection of layout/colors/logo | Generate sample PDF, open and verify branding |
| WhatsApp notification delivery | FIN-06 | Requires Twilio sandbox | Send test invoice, verify WhatsApp message arrives |
| Stripe/GoCardless payment link clickability | FIN-07 | Requires live payment provider | Click generated link, verify checkout page loads |
| Supervisor routing accuracy | FIN-09 | Requires conversational test | Send finance query via WhatsApp, verify Taylor handles it |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
