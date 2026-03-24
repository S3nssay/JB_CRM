---
phase: 05-arrears-monitoring
verified: 2026-03-24T13:00:00Z
status: passed
score: 4/4 must-haves verified
re_verification: false
---

# Phase 5: Arrears Chasing & Monitoring Verification Report

**Phase Goal:** The PM agent contacts tenants in rent arrears via outbound call/SMS/WhatsApp using hard-coded compliance rules (frequency limits, time-of-day restrictions, vulnerability escalation) — and staff have a dashboard to monitor all agent activity, review escalations, and track performance.
**Verified:** 2026-03-24T13:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A tenant in arrears receives no more than one automated call and one automated message per 48-hour window; no contact on Sundays or after 20:00 — enforced by code, not prompt instructions | VERIFIED | `arrearsComplianceGuard.ts` (317 lines): 6 hard-coded checks in `canContact()` including 48h window, Sunday block, time-of-day (09:00-20:00 UK via `Intl.DateTimeFormat`). Guard is called inside `sendPaymentReminderTool` execute before every send — LLM cannot bypass |
| 2 | A payment commitment is logged to the audit trail; a follow-up task is created; a payment link is sent via tenant's preferred channel | VERIFIED | `capturePaymentCommitmentTool` in `tools.ts` logs to `dunning_actions` and `auditLogger.logToolCall`, schedules pg-boss `payment-commitment-followup` job. `generatePaymentLinkTool` sends link via `messageSender`. `paymentLinkService.ts` auto-detects Stripe vs GoCardless |
| 3 | After 3 unsuccessful automated arrears contacts, the case is automatically escalated to a human case manager with full interaction history | VERIFIED | `canContact()` Check 5: counts `dunning_actions` with `status='sent'`; if count >= 3 returns `{ allowed: false, reason: 'Contact limit reached — escalate to human' }`. `payment-commitment-followup` worker in `scheduledMessages.ts` also escalates when `attemptNumber >= 3` |
| 4 | Staff can see a real-time dashboard of all agent conversations, escalation queue, per-agent metrics, and audit log — filterable by channel, agent type, and date range | VERIFIED | `AgentMonitoringDashboard.tsx` (713 lines): 4 tabs (Conversations, Escalations, Metrics, Audit Log) with filter bars. Backed by 5 API endpoints in `agentMonitoringRoutes.ts`. Accessible at `/crm/agent-monitoring`, linked from CRMLayout sidebar |

**Score:** 4/4 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/agents/services/arrearsComplianceGuard.ts` | Hard-coded compliance guard with `canContact()`, `logContactAttempt()`, `getContactHistory()` | VERIFIED | 317 lines. All 6 contact rules enforced in code. Exports singleton `arrearsComplianceGuard` and class `ArrearsComplianceGuard` |
| `server/agents/services/vulnerabilityDetector.ts` | Keyword-based vulnerability detection with `detect()` method | VERIFIED | 82 lines. 5 category regex patterns (financial, mental_health, health, domestic, bereavement). Exports singleton `vulnerabilityDetector` and class `VulnerabilityDetector` |
| `server/agents/sdk/arrearsAgent.ts` | Arrears chasing specialist agent (Sarah from Accounts) with 6 tools | VERIFIED | 79 lines. `Agent<AgentContext>` named 'Sarah from Accounts', model gpt-4o, 6 tools: lookup, sendReminder, captureCommitment, generatePaymentLink, escalateCase, escalateToHuman |
| `server/agents/services/paymentLinkService.ts` | Payment link generation via Stripe and GoCardless, with mandate detection | VERIFIED | 222 lines. `generateStripeLink()`, `collectViaGoCardless()`, `generateLink()` (auto-detects). Exports singleton `paymentLinkService` |
| `server/agentMonitoringRoutes.ts` | API endpoints for agent monitoring (conversations, escalations, metrics, audit log) | VERIFIED | 377 lines (note: separate file from `crmRoutes.ts` — plan deviation, but functionally equivalent). 5 endpoints with raw SQL queries, filters, pagination. Registered on `/api/crm` in `routes.ts` |
| `client/src/pages/AgentMonitoringDashboard.tsx` | React dashboard with 4 tabs, filters, thread viewer | VERIFIED | 713 lines. Full implementation with Conversations, Escalations, Metrics, Audit Log tabs. Thread dialog with unified timeline. Auto-refetch every 30s for escalations |
| `tests/agents/complianceGuard.test.ts` | Tests for all compliance guard rules and vulnerability detector | VERIFIED | 313 lines, 71 test/describe blocks |
| `tests/agents/arrearsAgent.test.ts` | Tests for arrears agent tools and vulnerability integration | VERIFIED | 371 lines, 70 test/describe blocks |
| `tests/agents/paymentLinks.test.ts` | Tests for payment link generation and commitment capture | VERIFIED | 422 lines, 88 test/describe blocks |
| `tests/agents/arrearsFollowUp.test.ts` | Tests for follow-up scheduling after payment commitment | VERIFIED | 356 lines, 76 test/describe blocks |
| `tests/agents/monitoringApi.test.ts` | Tests for monitoring API endpoints | VERIFIED | 237 lines, 44 test/describe blocks |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `arrearsComplianceGuard.ts` | `shared/schema.ts` | `dunningActions` table query for contact history | WIRED | `import { arrears, dunningActions, contactIdentities } from '@shared/schema'`; Drizzle queries on lines 103, 125, 157, 179, 200, 222 |
| `arrearsComplianceGuard.ts` | `shared/schema.ts` | `arrears` table query for case status | WIRED | `eq(arrears.tenantId, tenantId)`, `eq(arrears.status, 'active')` in Checks 2 and 5 |
| `server/agents/sdk/tools.ts` | `arrearsComplianceGuard.ts` | `canContact()` check before sending reminders | WIRED | Lazy import at line 303-308; `complianceGuard.canContact(arrearsCase.tenantId, input.channel)` at line 430; `logContactAttempt` at lines 434, 479 |
| `server/agents/sdk/tools.ts` | `vulnerabilityDetector.ts` | `detect()` on inbound tenant messages | WIRED | Lazy import in tools.ts (confirmed via grep); `vulnerabilityDetector.detect` called within arrears tool context |
| `server/agents/sdk/tools.ts` | `escalationService.ts` | `escalate()` for vulnerability and max-contact escalation | WIRED | Lazy import at line 21-27; `auditLogger.logEscalation` at lines 266, 530 |
| `server/agents/sdk/tools.ts` | `messageSender.ts` | `send()` for outbound reminders | WIRED | Lazy import at lines 312-318; used in `sendPaymentReminderTool` and `generatePaymentLinkTool` |
| `paymentLinkService.ts` | `paymentService.ts` (Stripe) | Stripe SDK for payment link creation | WIRED | `import Stripe from 'stripe'`; `s.paymentLinks.create()` at line 80 |
| `paymentLinkService.ts` | `gocardlessService.ts` | GoCardless payment collection against existing mandates | WIRED | `gcRequest()` helper via dynamic import of gocardlessService; `gocardlessMandates` table queried for active mandates |
| `server/agentMonitoringRoutes.ts` | `shared/schema.ts` (conversations, messages, agentAuditLog) | Raw SQL queries on `conversation`, `message`, `agent_audit_log` tables | WIRED | Raw SQL in all 5 endpoint query functions; table names `conversation`, `message`, `agent_audit_log` confirmed |
| `AgentMonitoringDashboard.tsx` | `agentMonitoringRoutes.ts` | `GET /api/crm/agent-monitoring/*` endpoints | WIRED | All 5 endpoints called via `apiRequest()` and `useQuery` at lines 195-217 |
| `client/src/App.tsx` | `AgentMonitoringDashboard.tsx` | Route at `/crm/agent-monitoring` | WIRED | Line 423: `<Route path="/crm/agent-monitoring">` — placed BEFORE `/crm` catch-all at line 426 |
| `client/src/components/CRMLayout.tsx` | `/crm/agent-monitoring` | Sidebar nav link with BarChart3 icon | WIRED | Line 594: button with `isActive('/crm/agent-monitoring')` and `BarChart3` icon |
| `scheduledMessages.ts` | `arrearsComplianceGuard.ts` | Compliance check in `arrears-chase` and `payment-commitment-followup` workers | WIRED | `arrears-chase` worker at line 118 calls `arrearsComplianceGuard.canContact`; `payment-commitment-followup` worker at line 202 does the same |
| `scheduledMessages.ts` | `paymentLinkService.ts` | `payment-commitment-followup` worker checks payment status | WIRED | Worker registered at line 202; calls escalationService on 3+ failures; schedules follow-up at lines 315, 344 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PM-06 | 05-01 | Chases rent arrears with outbound calls/SMS/WhatsApp to tenants | SATISFIED | `arrearsAgent.ts` (Sarah from Accounts) sends reminders via `sendPaymentReminderTool` using `messageSender`; `arrears-chase` pg-boss worker handles scheduled outbound chasing |
| PM-07 | 05-02 | Attempts to secure payment commitments and sends payment links | SATISFIED | `capturePaymentCommitmentTool` records commitment, schedules follow-up; `generatePaymentLinkTool` sends Stripe/GoCardless links via preferred channel; `payment-commitment-followup` worker verifies payment on commitment date |
| PM-08 | 05-01, 05-03 | Arrears chasing has hard-coded frequency limits and compliance rules (not prompt-only) | SATISFIED | `ArrearsComplianceGuard.canContact()` enforces 6 rules in code; compliance guard called inside tool `execute` — LLM cannot bypass; Sunday block, time-of-day (09:00-20:00 UK), 48h window, 3-contact escalation limit all enforced at code level |

No orphaned requirements — all three requirements mapped to Phase 5 in REQUIREMENTS.md are claimed by plan frontmatter (PM-06/PM-08 by 05-01, PM-07 by 05-02, PM-08 also addressed by 05-03 monitoring).

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `paymentLinkService.ts` | 31, 36, 76, 105 | `return null` when Stripe/GoCardless not configured | INFO | Intentional — graceful degradation when payment services unconfigured. Not a stub. |

No blocking anti-patterns found. No TODO/FIXME/placeholder comments in phase artifacts.

---

### Deviations from Plan (Non-Blocking)

**Plan 03 specified adding monitoring endpoints to `server/crmRoutes.ts`** but the implementation created a separate `server/agentMonitoringRoutes.ts` module instead, then registered it in `routes.ts` on the `/api/crm` prefix. This is architecturally cleaner (separation of concerns) and functionally identical — the endpoints are served at the same paths. Not a gap.

---

### Human Verification Required

The following items cannot be verified programmatically:

**1. Dashboard rendering and tab switching**
- **Test:** Navigate to `/crm/agent-monitoring` in a browser when logged in
- **Expected:** Page loads with 4 tabs visible; summary cards show; Conversations tab shows table with filter controls; Escalations tab shows priority-sorted queue; Metrics shows per-agent cards; Audit Log shows filterable entries
- **Why human:** Visual rendering and interactive behavior cannot be verified by grep

**2. Arrears agent persona and tone**
- **Test:** Trigger an arrears agent conversation (real or mocked) and review the responses
- **Expected:** Empathetic tone, no threats, no legal discussion, AI self-identifies as "Sarah from Accounts", British English conventions
- **Why human:** LLM output quality requires subjective review

**3. Compliance guard in production time zones**
- **Test:** Verify the 09:00-20:00 UK time block correctly handles BST/GMT transitions
- **Expected:** Block applies in local UK time regardless of DST
- **Why human:** Time zone behaviour with DST edge cases needs runtime confirmation

---

### Gaps Summary

No gaps found. All four success criteria from the ROADMAP are verified. All artifacts exist, are substantive (not stubs), and are properly wired. All three requirements (PM-06, PM-07, PM-08) are satisfied with implementation evidence. No orphaned requirements.

---

_Verified: 2026-03-24T13:00:00Z_
_Verifier: Claude (gsd-verifier)_
