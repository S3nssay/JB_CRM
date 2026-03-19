---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-19
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (Vite-native, TypeScript-first) |
| **Config file** | none — Wave 0 installs |
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
| 01-01 | 01 | 1 | KB-01 | unit | `npx vitest run tests/tools/queryKnowledgeBase.test.ts -t "certifications"` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | KB-02 | unit | `npx vitest run tests/schema/propertySystemsInventory.test.ts` | ❌ W0 | ⬜ pending |
| 01-01 | 01 | 1 | KB-03 | unit | `npx vitest run tests/tools/queryKnowledgeBase.test.ts -t "maintenance"` | ❌ W0 | ⬜ pending |
| 01-03 | 03 | 1 | KB-04 | unit | `npx vitest run tests/tools/queryKnowledgeBase.test.ts -t "performance"` | ❌ W0 | ⬜ pending |
| 01-05 | 05 | 2 | KB-05 | manual-only | Manual: open managed property in CRM, verify KB tab | N/A | ⬜ pending |
| 01-03 | 03 | 1 | AGENT-02 | unit | `npx vitest run tests/tools/registry.test.ts` | ❌ W0 | ⬜ pending |
| 01-02 | 02 | 1 | AGENT-04 | unit | `npx vitest run tests/channels/conversationStore.test.ts` | ❌ W0 | ⬜ pending |
| 01-04 | 04 | 1 | AGENT-05 | unit | `npx vitest run tests/audit/auditLogger.test.ts` | ❌ W0 | ⬜ pending |
| 01-04 | 04 | 1 | AGENT-06 | unit | `npx vitest run tests/middleware/aiIdentification.test.ts` | ❌ W0 | ⬜ pending |
| 01-02 | 02 | 1 | CHAN-01 | unit | `npx vitest run tests/channels/gateway.test.ts -t "threading"` | ❌ W0 | ⬜ pending |
| 01-02 | 02 | 1 | CHAN-02 | unit | `npx vitest run tests/channels/contactIdentity.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `vitest` — install as dev dependency, create `vitest.config.ts`
- [ ] `tests/tools/queryKnowledgeBase.test.ts` — stubs for KB-01, KB-03, KB-04
- [ ] `tests/schema/propertySystemsInventory.test.ts` — stubs for KB-02
- [ ] `tests/tools/registry.test.ts` — stubs for AGENT-02
- [ ] `tests/channels/conversationStore.test.ts` — stubs for AGENT-04
- [ ] `tests/audit/auditLogger.test.ts` — stubs for AGENT-05
- [ ] `tests/middleware/aiIdentification.test.ts` — stubs for AGENT-06
- [ ] `tests/channels/gateway.test.ts` — stubs for CHAN-01
- [ ] `tests/channels/contactIdentity.test.ts` — stubs for CHAN-02

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| KB UI renders data per property | KB-05 | Requires browser rendering and CRM navigation | Open managed property in CRM, verify KB tab shows certifications, systems, maintenance history |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
