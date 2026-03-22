---
phase: 04-property-management
verified: 2026-03-22T00:15:00Z
status: gaps_found
score: 12/13 must-haves verified
gaps:
  - truth: "After a work order is created, the PM agent schedules automated follow-ups via pg-boss"
    status: partial
    reason: "registerWorkOrderFollowupWorkers() is defined and exported in workOrderFollowup.ts but is never called at server startup. The workers are declared but not registered with any running pg-boss instance, so follow-up jobs queued by the PM agent via schedule_work_order_followup will never be picked up."
    artifacts:
      - path: "server/agents/services/workOrderFollowup.ts"
        issue: "registerWorkOrderFollowupWorkers() exported but not wired into any server startup path"
    missing:
      - "Call registerWorkOrderFollowupWorkers(boss) at server startup -- in the same initialisation block that calls scheduledMessageService.start() or in a dedicated agents startup module"
      - "The plan (04-03 Task 2, Step 6) explicitly required registering workers in server/index.ts or the agents services init block -- this step was not completed"
human_verification: []
---

# Phase 04: Property Management Verification Report

**Phase Goal:** Tenants can report maintenance faults via any channel and the PM agent triages the issue using the property knowledge base, contacts the right contractor, creates a work order, and follows up to verify completion -- all without staff handling the routine flow.
**Verified:** 2026-03-22T00:15:00Z
**Status:** gaps_found
**Re-verification:** No -- initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | WhatsApp fault report is routed by Supervisor to PM agent via handoff | VERIFIED | `supervisorAgent.ts` wires `handoff(pmAgent, { toolNameOverride: 'transfer_to_property_management' })`; supervisor instructions list Morgan for maintenance/faults |
| 2 | PM agent creates maintenance ticket with AI categorization, urgency score, routing reason from rules-based code | VERIFIED | `classifyAndCreateTicketTool` in `pmAgent.ts` calls `classifyUrgency()` then `toolRegistry.invoke('create_maintenance_ticket', { aiCategorization, aiUrgencyScore, aiRoutingReason })`; `createMaintenanceTicket.ts` inserts these fields |
| 3 | Emergency faults classified by code-level rules engine with urgency + reasoning | VERIFIED | `emergencyRules.ts` pure function with 10 pattern categories, ordered by severity; no DB calls; returns `{ urgency, score, reasoning, isEmergency }` |
| 4 | Non-emergency faults classified with routine/low urgency levels | VERIFIED | Patterns for dripping/minor (low score 2), appliances (routine score 3), cosmetic (low score 1); default fallback is routine score 3 |
| 5 | Tenant property and landlord auto-resolved from contact identity | VERIFIED | `lookupTenantProperty.ts` queries tenant table by phone/mobile/email with Drizzle ORM, enriches with property address and landlord name |
| 6 | PM agent searches contractors matching fault category and service area, ranked list | VERIFIED | `searchContractors.ts` filters by specialization ANY, service area LIKE, emergency flag; JS-side sort: preferred DESC, rating DESC, responseTime ASC; limit 5 |
| 7 | PM agent requests quote from contractor via preferred channel | VERIFIED | `requestContractorQuote.ts` inserts contractor_quote record, calls `messageSender.sendPreferred(phone)` then email fallback; message includes ticket ref, property, urgency, fault |
| 8 | Non-emergency: landlord receives approval prompt before work scheduled | VERIFIED | `landlordApproval.ts` `handleStandardApproval()` sends "Reply APPROVE to proceed or REJECT" via WhatsApp/SMS + email |
| 9 | Emergency: landlord approval bypassed, contractor dispatched immediately, bypass audit-logged | VERIFIED | `landlordApproval.ts` `handleEmergencyApproval()` updates quote status to 'approved', sends notification (not request), calls `auditLogger.logToolCall()` with bypass reason |
| 10 | Work order created with WO-YYYYMMDD-XXXX number after approval | VERIFIED | `createWorkOrder.ts` generates number via MAX query on today's prefix; inserts into work_order table; updates maintenance_ticket status to 'assigned'; notifies contractor |
| 11 | PM agent schedules follow-up tool after work order creation | VERIFIED | `scheduleWorkOrderFollowup.ts` tool definition delegates to `workOrderFollowupService.scheduleFollowups()`; PM_INSTRUCTIONS include "ALWAYS use schedule_work_order_followup" after work order creation |
| 12 | Follow-up messages sent to contractor and tenant at urgency-based intervals | VERIFIED | `workOrderFollowup.ts` defines workers: contractor check-in (WO progress), tenant satisfaction (issue resolved), completion check at scheduled end; intervals 24h/48h/72h/96h by urgency |
| 13 | Follow-up workers registered at server startup to process queued pg-boss jobs | FAILED | `registerWorkOrderFollowupWorkers()` is defined in `workOrderFollowup.ts` but never called from any server startup path. Jobs enqueued by `scheduleWorkOrderFollowup` tool will never be dequeued and executed. |

**Score:** 12/13 truths verified

---

## Required Artifacts

### Plan 01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/agents/sdk/pmAgent.ts` | PM specialist agent with Morgan persona, fault intake, KB triage, ticket creation, emergency classification | VERIFIED | 203 lines; Agent named "Morgan from Property Management"; model gpt-4o; 9 tools including classifyAndCreateTicketTool; full PM_INSTRUCTIONS with emergency guidance |
| `server/agents/services/emergencyRules.ts` | Rules-based urgency classification engine | VERIFIED | 175 lines; pure function `classifyUrgency()`; 10 pattern categories; seasonal override for heating; exports `EmergencyClassification` interface |
| `server/agents/tools/definitions/lookupTenantProperty.ts` | Tool to resolve contact to tenant+property+landlord | VERIFIED | 121 lines; Drizzle ORM query on tenant table; enriches with property address and landlord name; handles no-match and multi-match cases |

### Plan 02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/agents/tools/definitions/searchContractors.ts` | Search contractors by specialization, area, emergency capability | VERIFIED | 125 lines; raw SQL with ANY(specializations), LIKE service area, emergency filter; JS-side ranking |
| `server/agents/tools/definitions/requestContractorQuote.ts` | Create quote record and contact contractor via preferred channel | VERIFIED | 85 lines; inserts contractor_quote; calls messageSender.sendPreferred() then email fallback; message includes MT-ID, address, urgency, fault |
| `server/agents/services/landlordApproval.ts` | Landlord approval workflow: emergency bypass with audit logging | VERIFIED | 187 lines; LandlordApprovalService class; handleEmergencyApproval() auto-approves + notifies + audit-logs; handleStandardApproval() sends APPROVE/REJECT request |
| `server/agents/tools/definitions/requestLandlordApproval.ts` | Tool wrapping landlord approval service | VERIFIED | 37 lines; delegates to landlordApprovalService.requestApproval() |
| `server/agents/tools/definitions/createWorkOrder.ts` | Creates work order with WO-YYYYMMDD-XXXX, updates ticket, notifies contractor | VERIFIED | 144 lines; generateWorkOrderNumber() uses MAX query; inserts work_order; updates maintenance_ticket to 'assigned'; sends confirmation message to contractor |

### Plan 03 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/agents/services/workOrderFollowup.ts` | pg-boss workers for contractor/tenant follow-ups, completion check, escalation | VERIFIED (partial) | 378 lines; WorkOrderFollowupService class; 3 worker handlers; audit logging in every handler; escalation after MAX_FOLLOWUP_ATTEMPTS=2; `registerWorkOrderFollowupWorkers()` exported but not called at startup |
| `server/agents/tools/definitions/scheduleWorkOrderFollowup.ts` | Tool to schedule follow-up jobs for a work order | VERIFIED | 45 lines; delegates to workOrderFollowupService.scheduleFollowups(); returns {scheduled, followupsCount, intervalHours} |

---

## Key Link Verification

### Plan 01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pmAgent.ts` | `tools.ts` | SDK tools array | VERIFIED | Imports: queryKnowledgeBaseTool, lookupTenantPropertyTool, escalateToHumanTool, searchContractorsSdkTool, requestContractorQuoteSdkTool, requestLandlordApprovalSdkTool, createWorkOrderSdkTool, scheduleWorkOrderFollowupSdkTool |
| `supervisorAgent.ts` | `pmAgent.ts` | handoff(pmAgent) | VERIFIED | `handoff(pmAgent, { toolNameOverride: 'transfer_to_property_management' })` in handoffs array; supervisor instructions mention Morgan |
| `pmAgent.ts` | `emergencyRules.ts` | import classifyUrgency | VERIFIED | Line 25: `import { classifyUrgency } from '../services/emergencyRules'`; called in classifyAndCreateTicketTool execute() |

### Plan 02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `pmAgent.ts` | `tools.ts` | SDK tools array for dispatch | VERIFIED | All 4 dispatch SDK tools present in pmAgent tools array: searchContractorsSdkTool, requestContractorQuoteSdkTool, requestLandlordApprovalSdkTool, createWorkOrderSdkTool |
| `requestContractorQuote.ts` | `messageSender.ts` | messageSender.send() | VERIFIED | Line 3: `import { messageSender } from '../../services/messageSender'`; called in execute() for both sendPreferred and send |
| `landlordApproval.ts` | `messageSender.ts` | messageSender.send() | VERIFIED | Line 10: `import { messageSender } from './messageSender'`; called in both handleEmergencyApproval and handleStandardApproval |

### Plan 03 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `workOrderFollowup.ts` | `messageSender.ts` | messageSender.send() | VERIFIED | Line 14: `import { messageSender } from './messageSender'`; called in all three worker handlers |
| `workOrderFollowup.ts` | `auditLogger.ts` | auditLogger.logToolCall() | VERIFIED | Line 15: `import { auditLogger } from '../middleware/auditLogger'`; called in every worker handler with workOrderId, ticketId, attemptNumber, followUpType |
| `workOrderFollowup.ts` | `escalationService.ts` | escalationService.escalate() | VERIFIED | Line 16: `import { escalationService } from './escalationService'`; called when attemptNumber >= MAX_FOLLOWUP_ATTEMPTS in contractor and tenant handlers |
| `registerWorkOrderFollowupWorkers()` | server startup | Called at boot | FAILED | Function exported from workOrderFollowup.ts but grep of server/ shows zero call sites outside the definition file itself. Plan 03 Task 2 Step 6 required this wiring. |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PM-01 | 04-01 | Takes maintenance/fault reports from tenants via any channel and creates work orders | SATISFIED | Supervisor routes maintenance messages to PM agent; PM agent uses classify_and_create_ticket to create maintenance tickets; lookupTenantProperty resolves contact identity |
| PM-02 | 04-01 | Triages faults using property knowledge base (system, warranty status, last service) | SATISFIED | PM_INSTRUCTIONS workflow step 2: "Use query_knowledge_base to check the property's systems (heating type, warranty status, last service date)"; queryKnowledgeBaseTool wired in agent |
| PM-03 | 04-02 | Contacts appropriate contractor based on property knowledge base and fault type | SATISFIED | searchContractors tool filters by specialization matching fault category; requestContractorQuote contacts contractor via preferred channel with fault details |
| PM-04 | 04-02 | Books contractors and generates quotes for landlord approval | SATISFIED | requestLandlordApproval tool with isEmergency gate; createWorkOrder generates WO-YYYYMMDD-XXXX numbers; landlord approval workflow fully wired |
| PM-05 | 04-03 | Follows up with contractors to verify work completion | PARTIAL | Follow-up workers defined and tested; tool wired to PM agent; but workers not registered at startup -- follow-up jobs queued by the tool will never execute in production |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `server/agents/services/workOrderFollowup.ts` | `registerWorkOrderFollowupWorkers()` exported but never called | Blocker | Follow-up jobs enqueued to pg-boss (wo-contractor-followup, wo-tenant-followup, wo-completion-check) will be queued but never dequeued and processed. The completion verification requirement (PM-05) cannot function. |

---

## Human Verification Required

None -- all items can be verified programmatically.

---

## Gaps Summary

One gap blocks full goal achievement.

The `registerWorkOrderFollowupWorkers()` function is fully implemented in `server/agents/services/workOrderFollowup.ts` and correctly registers three pg-boss workers. The `scheduleWorkOrderFollowupTool` tool definition correctly calls `workOrderFollowupService.scheduleFollowups()` which enqueues jobs. However, plan 04-03 Task 2 Step 6 explicitly required wiring `registerWorkOrderFollowupWorkers(boss)` into the server startup sequence -- this step was skipped.

The result is that the PM agent can schedule follow-up jobs (the tool runs without error), but those jobs sit indefinitely in the pg-boss queue because no worker process is polling for them. The contractor and tenant follow-up messages are never sent, and the completion check never runs.

The fix is small: call `registerWorkOrderFollowupWorkers(boss)` wherever the server initialises pg-boss workers (alongside any other `.work()` registrations). The implementation itself requires no changes.

**All other 12/13 must-haves are fully verified.** The 64-test suite for Phase 04 (emergencyRules, pmAgent, contractorDispatch, workOrderFollowup) passes with zero failures.

---

_Verified: 2026-03-22T00:15:00Z_
_Verifier: Claude (gsd-verifier)_
