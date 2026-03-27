---
phase: 12
slug: kanban-pipelines-lead-auto-matching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-27
---

# Phase 12 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (if added) / manual verification via dev server |
| **Config file** | none — Wave 0 installs if needed |
| **Quick run command** | `npx tsc --noEmit` |
| **Full suite command** | `npx tsc --noEmit && npm run build` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx tsc --noEmit`
- **After every plan wave:** Run `npx tsc --noEmit && npm run build`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 12-01-01 | 01 | 1 | KAN-01 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 12-01-02 | 01 | 1 | KAN-02 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 12-02-01 | 02 | 1 | KAN-03 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 12-02-02 | 02 | 1 | KAN-04 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 12-03-01 | 03 | 2 | KAN-05 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 12-03-02 | 03 | 2 | KAN-06 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 12-04-01 | 04 | 2 | KAN-07 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |
| 12-04-02 | 04 | 2 | KAN-08 | type-check + manual | `npx tsc --noEmit` | ⬜ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- Existing infrastructure covers all phase requirements. TypeScript type-checking via `tsc --noEmit` provides automated verification. Manual UI verification via dev server for kanban drag-and-drop and lead matching flows.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Kanban drag-and-drop moves property between stages | KAN-01, KAN-02 | UI interaction requires visual verification | Drag a property card from one column to another, verify stage updates in DB |
| Lead auto-matching flags correct leads | KAN-05, KAN-06 | Matching logic depends on live property + lead data | Move property to "Listed", verify matching leads appear in notification panel |
| Staff approval triggers email/WhatsApp send | KAN-07 | Requires external service integration | Approve a matched lead, verify email/WhatsApp sent (check logs) |
| Pipeline type filter toggles correctly | KAN-04 | UI state interaction | Toggle between letting/selling/all in landlord pipeline, verify filtered results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
