---
phase: 3
slug: voice-integration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-20
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | vitest.config.ts (existing from Phase 1) |
| **Quick run command** | `npx vitest run tests/voice/` |
| **Full suite command** | `npx vitest run` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run tests/voice/`
- **After every plan wave:** Run `npx vitest run`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | VOICE-01 | unit | `npx vitest run tests/voice/vapiConfig.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-02 | 01 | 1 | VOICE-01, VOICE-02 | unit | `npx vitest run tests/voice/vapiConfig.test.ts` | ❌ W0 | ⬜ pending |
| 03-01-03 | 01 | 1 | VOICE-01 | manual | N/A (Twilio SIP config) | N/A | ⬜ pending |
| 03-02-01 | 02 | 1 | VOICE-03 | unit | `npx vitest run tests/voice/vapiWebhooks.test.ts` | ❌ W0 | ⬜ pending |
| 03-02-02 | 02 | 1 | VOICE-03 | unit | `npx vitest run tests/voice/vapiWebhooks.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-01 | 03 | 2 | VOICE-01 | unit | `npx vitest run tests/voice/callLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-02 | 03 | 2 | VOICE-01 | unit | `npx vitest run tests/voice/callLifecycle.test.ts` | ❌ W0 | ⬜ pending |
| 03-03-03 | 03 | 2 | VOICE-03, VOICE-04 | unit | `npx vitest run tests/voice/callLifecycle.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/voice/vapiConfig.test.ts` — stubs for VOICE-01, VOICE-02 (config builders)
- [ ] `tests/voice/vapiWebhooks.test.ts` — stubs for VOICE-03 (tool-call webhook handling)
- [ ] `tests/voice/callLifecycle.test.ts` — stubs for VOICE-01, VOICE-04 (transcript threading, escalation)

*Existing infrastructure (vitest, test helpers) covers framework requirements.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Twilio SIP forwarding to Vapi | VOICE-01 | Requires live Twilio + Vapi accounts | Configure SIP trunk, make test call, verify Vapi receives it |
| Voice quality and accent | VOICE-01 | Subjective quality assessment | Make test calls, evaluate TTS voice clarity and accent |
| Squad handoff audio experience | VOICE-02 | Requires live call to assess transition | Call, trigger intent classification, verify smooth handoff |
| Live tool-call latency during call | VOICE-03 | Requires end-to-end call with real DB | Time from tool request to voice response during live call |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
