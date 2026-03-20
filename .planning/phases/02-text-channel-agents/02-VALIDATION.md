---
phase: 2
slug: text-channel-agents
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (already configured) |
| **Config file** | `vitest.config.ts` |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npx vitest run --reporter=verbose` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --reporter=verbose`
- **After every plan wave:** Run `npx vitest run --reporter=verbose`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | AGENT-01 | unit | `npx vitest run tests/agents/supervisorRouting.test.ts -t "routing"` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | AGENT-03 | unit | `npx vitest run tests/agents/toolExecution.test.ts -t "tool"` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | AGENT-07 | unit | `npx vitest run tests/agents/escalation.test.ts -t "escalation"` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | SALES-01 | integration | `npx vitest run tests/agents/salesAgent.test.ts -t "enquiry"` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | SALES-02 | integration | `npx vitest run tests/agents/salesAgent.test.ts -t "viewing"` | ❌ W0 | ⬜ pending |
| 02-02-03 | 02 | 2 | SALES-03 | integration | `npx vitest run tests/agents/salesAgent.test.ts -t "lead"` | ❌ W0 | ⬜ pending |
| 02-02-04 | 02 | 2 | SALES-04 | unit | `npx vitest run tests/agents/followUp.test.ts -t "follow-up"` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | LETT-01 | integration | `npx vitest run tests/agents/lettingsAgent.test.ts -t "enquiry"` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | LETT-02 | integration | `npx vitest run tests/agents/lettingsAgent.test.ts -t "viewing"` | ❌ W0 | ⬜ pending |
| 02-03-03 | 03 | 2 | LETT-03 | integration | `npx vitest run tests/agents/lettingsAgent.test.ts -t "lead"` | ❌ W0 | ⬜ pending |
| 02-03-04 | 03 | 2 | LETT-04 | unit | `npx vitest run tests/agents/followUp.test.ts -t "follow-up"` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | ADMIN-01 | unit | `npx vitest run tests/agents/adminChecklist.test.ts -t "onboarding"` | ❌ W0 | ⬜ pending |
| 02-04-02 | 04 | 2 | ADMIN-02 | unit | `npx vitest run tests/agents/adminChecklist.test.ts -t "offboarding"` | ❌ W0 | ⬜ pending |
| 02-04-03 | 04 | 2 | ADMIN-03 | unit | `npx vitest run tests/agents/adminChecklist.test.ts -t "chase"` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 3 | CHAN-03 | unit | `npx vitest run tests/agents/memoryInjection.test.ts -t "memory"` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 3 | CHAN-04 | unit | `npx vitest run tests/agents/postActionConfirmation.test.ts -t "confirmation"` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/agents/supervisorRouting.test.ts` — covers AGENT-01 (mock SDK Agent, verify handoff selection)
- [ ] `tests/agents/toolExecution.test.ts` — covers AGENT-03 (mock tool calls through SDK wrapper)
- [ ] `tests/agents/escalation.test.ts` — covers AGENT-07 (verify escalation tool invoked, notification created)
- [ ] `tests/agents/salesAgent.test.ts` — covers SALES-01/02/03 (mock search, booking, lead capture flows)
- [ ] `tests/agents/lettingsAgent.test.ts` — covers LETT-01/02/03 (mirror of sales tests for rentals)
- [ ] `tests/agents/followUp.test.ts` — covers SALES-04/LETT-04 (verify pg-boss job scheduling)
- [ ] `tests/agents/adminChecklist.test.ts` — covers ADMIN-01/02/03 (checklist generation, chase scheduling)
- [ ] `tests/agents/memoryInjection.test.ts` — covers CHAN-03 (verify history loaded and injected)
- [ ] `tests/agents/postActionConfirmation.test.ts` — covers CHAN-04 (verify confirmation sent after booking)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| WhatsApp message delivery | CHAN-04 | Requires live Twilio sandbox | Send test message from WhatsApp sandbox number, verify delivery |
| SMS delivery | CHAN-04 | Requires live Twilio credentials | Send test SMS to verified number, confirm receipt |
| Email branded template rendering | CHAN-04 | Visual check of HTML template | Send test email, open in Gmail/Outlook, verify JB branding |
| End-to-end inbound flow | All | Requires live webhook | Forward Twilio webhook to local via ngrok, send WhatsApp message, verify agent response |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
