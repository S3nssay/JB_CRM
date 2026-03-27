---
phase: 02-text-channel-agents
verified: 2026-03-20T03:00:00Z
status: gaps_found
score: 14/16 must-haves verified
re_verification: false
gaps:
  - truth: "After a viewing is booked, the contact receives an immediate confirmation on the same channel"
    status: failed
    reason: "handlePostActions() is imported in server/agentWebhooks.ts but never called after runAgent() completes. The function exists and is tested in isolation, but is not wired into the webhook processing pipeline."
    artifacts:
      - path: "server/agentWebhooks.ts"
        issue: "handlePostActions imported on line 16 but zero calls to it exist in the file. processInbound() runs the agent and sends the reply but does not invoke handlePostActions."
    missing:
      - "Call handlePostActions() inside processInbound() after messageSender.send() with action='book_viewing' or 'create_lead' when the agent response indicates these tool calls were made, OR wire handlePostActions() into the runAgent/tool execution layer so it fires automatically"
  - truth: "WhatsApp/SMS confirmations are sent automatically after agent actions (viewing booked, lead captured)"
    status: failed
    reason: "Same root cause as above. handlePostActions() which provides confirmations is never invoked from the webhook pipeline. Only the agent text reply is sent; no separate post-action confirmation or reminder scheduling is triggered."
    artifacts:
      - path: "server/agentWebhooks.ts"
        issue: "processInbound() ends at line 85 with messageSender.send(channel, fromAddress, response) — no post-action hooks fired"
    missing:
      - "Wire handlePostActions() call into processInbound() or use a tool call intercept pattern to detect book_viewing/create_lead and trigger the confirmation + scheduling"
human_verification:
  - test: "Send a WhatsApp message requesting a viewing"
    expected: "Supervisor routes to Sales/Lettings agent, agent books viewing, immediate confirmation message arrives on WhatsApp, followed by viewing reminders at 24h before and morning-of"
    why_human: "Cannot verify end-to-end Twilio delivery or pg-boss job execution without a live environment"
  - test: "Send STOP via SMS"
    expected: "No further outbound messages are sent to that number, including scheduled follow-ups"
    why_human: "Requires real Twilio webhook + database opt-out state verification"
  - test: "Send an email enquiry to the IMAP-polled mailbox"
    expected: "Email is classified as enquiry, routed through agent pipeline, AI responds to sender"
    why_human: "Requires live IMAP polling and email send verification"
  - test: "Create a new tenancy with status 'active' in CRM"
    expected: "Onboarding checklist items are automatically inserted in tenancy_checklist_item table"
    why_human: "Requires live database and tenancy creation flow through the CRM UI"
---

# Phase 02: Text-Channel Agents Verification Report

**Phase Goal:** The Supervisor, Sales, Lettings, and Admin specialist agents handle real inbound messages on WhatsApp, SMS, and email — routing correctly, answering property questions from live data, booking viewings, capturing leads, and managing onboarding/offboarding document checklists.
**Verified:** 2026-03-20T03:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Inbound WhatsApp/SMS routed through ChannelGateway to Supervisor | VERIFIED | agentWebhooks.ts calls channelGateway.processInbound() then runAgent(supervisorAgent, ...) |
| 2 | Agent can search properties, book viewings, and capture leads | VERIFIED | salesAgent.ts and lettingsAgent.ts have searchPropertiesTool, bookViewingTool, createLeadTool wired via toolRegistry.invoke() |
| 3 | Low confidence / human request creates escalation with round-robin assignment | VERIFIED | escalationService.escalate() queries staffProfiles + users, assigns round-robin, notifies via email, schedules 30-min pg-boss follow-up |
| 4 | Inbound enquiry emails routed through agent pipeline | VERIFIED | emailProcessor.ts imports channelGateway and calls processInbound('email', ...) for create_enquiry/create_viewing action types |
| 5 | Prospect asking about a sale property receives live CRM data | VERIFIED | salesAgent has search_properties tool wired to toolRegistry, instructions require using search_properties tool |
| 6 | Prospect can book viewing through Sales agent with confirmation | PARTIAL | book_viewing tool present and wired; immediate post-booking confirmation via handlePostActions NOT called from webhook pipeline |
| 7 | Sales agent captures buyer lead when no viewing available | VERIFIED | create_lead tool present in salesAgent tools array with correct leadType enum |
| 8 | Follow-up sequence Day 1/3/7 scheduled via pg-boss | VERIFIED | scheduleFollowUpTool queues follow-up-thanks/similar/checkin jobs; scheduledMessages.ts workers registered |
| 9 | Rental prospect receives live CRM data with pcm pricing | VERIFIED | lettingsAgent has search_properties tool, instructions specify "£X,XXX pcm" format |
| 10 | Rental viewing booking with confirmation | PARTIAL | Same gap as truth #6 — post-action confirmation not wired from webhook layer |
| 11 | Tenant lead capture when no viewing available | VERIFIED | create_lead tool with leadType='tenant' in lettingsAgent instructions |
| 12 | New tenancy triggers onboarding checklist automatically | VERIFIED | crmRoutes.ts calls onTenancyCreated() after tenancy insert; tenancyEventHooks.ts generates checklist for 'active'/'pending' status |
| 13 | Tenancy ending triggers offboarding checklist automatically | VERIFIED | pmWorkflowRoutes.ts calls onTenancyStatusChanged() after status='ending'; crmRoutes.ts also hooks PATCH endpoint |
| 14 | Outstanding checklist items chased with audit logging | VERIFIED | checklistService.chaseItem() sends via messageSender and logs via auditLogger |
| 15 | After 3 chases, escalated to staff | VERIFIED | checklistService counts previous chases from agentAuditLog; calls escalationService.escalate() at chaseCount >= 3 |
| 16 | STOP keyword halts all AI outreach | VERIFIED | agentWebhooks.ts detects STOP keywords, calls setOptOut() to update contact_identity.opted_out; scheduledMessages workers check checkOptOut() before sending |

**Score:** 14/16 truths verified (2 partial — shared root cause)

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/agents/sdk/context.ts` | AgentContext type | VERIFIED | Interface defined with conversationId, contactId, channel, isFirstMessage, agentType |
| `server/agents/sdk/tools.ts` | 5 registry wrappers + escalate_to_human + generateChecklist + chaseChecklist | VERIFIED | 8 tools exported: all 5 registry tools + escalateToHumanTool + generateChecklistTool + chaseChecklistItemTool |
| `server/agents/sdk/runner.ts` | Agent runner with history, AI ID, audit logging | VERIFIED | Loads history (20 msgs), applies AI identification, stores outbound, logs via auditLogger |
| `server/agents/sdk/supervisorAgent.ts` | Supervisor with Sales/Lettings/Admin handoffs (real agents, no stubs) | VERIFIED | Imports salesAgent, lettingsAgent, adminAgent; no stubs remain |
| `server/agents/sdk/salesAgent.ts` | Alex from Sales with 6 tools + follow-up scheduling | VERIFIED | 6 tools, negotiation autonomy in instructions, scheduleFollowUpTool present |
| `server/agents/sdk/lettingsAgent.ts` | Jordan from Lettings with pcm pricing, 6 tools | VERIFIED | Reuses scheduleFollowUpTool, instructions include pcm format, 6 tools |
| `server/agents/sdk/adminAgent.ts` | Sam from Admin with 3 tools | VERIFIED | generateChecklistTool + chaseChecklistItemTool + escalateToHumanTool |
| `server/agents/services/messageSender.ts` | Unified WhatsApp/SMS/email dispatch | VERIFIED | Dispatches to Twilio WhatsApp/SMS + Nodemailer email; SMS truncated to 320 chars; sendPreferred tries WhatsApp then falls back to SMS |
| `server/agents/services/escalationService.ts` | Round-robin staff assignment, 30-min follow-up, fallback | VERIFIED | Queries staffProfiles + users, round-robin counter per department, pg-boss 30-min follow-up, reassignment, fallback message |
| `server/agents/services/checklistService.ts` | Checklist generation from schema metadata | VERIFIED | Filters tenancyChecklistItemMeta by workflow, inserts into tenancyChecklistItems, chase with escalation after 3 failures |
| `server/agents/services/tenancyEventHooks.ts` | Fire-and-forget hooks for tenancy lifecycle | VERIFIED | onTenancyCreated + onTenancyStatusChanged exported; both wrapped in try/catch |
| `server/agents/services/scheduledMessages.ts` | pg-boss workers + handlePostActions | PARTIAL | Service fully implemented with workers, scheduleViewingReminders, scheduleFollowUp, checkOptOut. handlePostActions function implemented and tested — but orphaned from webhook pipeline |
| `server/agents/channels/adapters/emailAdapter.ts` | Email adapter for ChannelGateway | VERIFIED | Implements ChannelAdapter, normalizes email payload to NormalizedMessage |
| `server/agentWebhooks.ts` | Webhook routes for WhatsApp/SMS/email | VERIFIED | /webhooks/whatsapp, /webhooks/sms, /webhooks/email routes; returns 200 immediately; async processing; per-conversation locking; STOP detection |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| server/agentWebhooks.ts | server/agents/channels/gateway.ts | channelGateway.processInbound() | WIRED | Line 65 in agentWebhooks.ts calls processInbound(); gateway.ts registers EmailAdapter |
| server/agents/sdk/tools.ts | server/agents/tools/registry.ts | toolRegistry.invoke() | WIRED | wrapRegistryTool() calls toolRegistry.invoke(name, input, toolContext) at line 51 |
| server/agents/sdk/supervisorAgent.ts | salesAgent, lettingsAgent, adminAgent | handoff() | WIRED | Three handoff() calls at lines 68, 72, 76 using real agent imports |
| server/agents/services/escalationService.ts | shared/schema.ts | staffProfiles + users query | WIRED | Queries staffProfiles joined with users at lines 63-81 |
| server/services/email/emailProcessor.ts | server/agents/channels/gateway.ts | channelGateway.processInbound('email', ...) | WIRED | Lines 218-228 and 507-513 call channelGateway.processInbound for create_enquiry/create_viewing |
| server/agents/services/checklistService.ts | shared/schema.ts | tenancyChecklistItems insert | WIRED | db.insert(tenancyChecklistItems) at line 64 |
| server/agents/sdk/adminAgent.ts | server/agents/sdk/tools.ts | generateChecklistTool, chaseChecklistItemTool | WIRED | Both tools imported from tools.ts and present in tools array |
| server/agents/sdk/supervisorAgent.ts | server/agents/sdk/adminAgent.ts | handoff(adminAgent) | WIRED | Line 76 |
| server/agents/services/checklistService.ts | server/agents/services/messageSender.ts | messageSender.send() for chase | WIRED | Line 160 calls messageSender.send() |
| server/crmRoutes.ts | server/agents/services/tenancyEventHooks.ts | onTenancyCreated() | WIRED | Line 13304 calls onTenancyCreated() after tenancy insert |
| server/crmRoutes.ts | server/agents/services/tenancyEventHooks.ts | onTenancyStatusChanged() | WIRED | Line 13354 calls onTenancyStatusChanged() on PATCH |
| server/pmWorkflowRoutes.ts | server/agents/services/tenancyEventHooks.ts | onTenancyStatusChanged() | WIRED | Line 270 calls onTenancyStatusChanged() in end-of-tenancy start |
| server/agentWebhooks.ts | server/agents/services/scheduledMessages.ts | handlePostActions() | NOT_WIRED | handlePostActions imported at line 16 but never called in processInbound() or anywhere else in the file |
| server/agents/sdk/runner.ts | server/agents/channels/conversationStore.ts | getConversationHistory() | WIRED | Lines 34-37 call conversationStore.getConversationHistory(context.conversationId, 20) |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AGENT-01 | 02-01 | Supervisor routes to correct specialist | SATISFIED | supervisorAgent.ts with three handoff() calls; tests in supervisorRouting.test.ts |
| AGENT-03 | 02-01 | Agents can take CRM actions | SATISFIED | toolRegistry.invoke() wires all 5 action tools (create_lead, book_viewing, create_maintenance_ticket, etc.) |
| AGENT-07 | 02-01 | Escalation path to human staff | SATISFIED | escalationService with round-robin, 30-min follow-up, fallback message |
| SALES-01 | 02-02 | Sale enquiries answered with live CRM data | SATISFIED | searchPropertiesTool wired to toolRegistry which queries properties table |
| SALES-02 | 02-02 | Books viewings with availability check | SATISFIED | bookViewingTool present; instructions direct agent to use it |
| SALES-03 | 02-02 | Captures buyer leads when no viewing | SATISFIED | createLeadTool with leadType='buyer' in salesAgent tools |
| SALES-04 | 02-02, 02-05 | Follow-up across channels | PARTIAL | scheduleFollowUpTool queues pg-boss jobs; handlePostActions exists; BUT handlePostActions not called from webhook pipeline — post-action confirmations not automatically triggered |
| LETT-01 | 02-03 | Rental enquiries with live CRM data (pcm) | SATISFIED | searchPropertiesTool in lettingsAgent; instructions specify pcm format |
| LETT-02 | 02-03 | Books rental viewings | SATISFIED | bookViewingTool in lettingsAgent tools |
| LETT-03 | 02-03 | Captures tenant leads | SATISFIED | createLeadTool with leadType='tenant' in lettingsAgent instructions |
| LETT-04 | 02-03, 02-05 | Follow-up for prospective tenants | PARTIAL | Same gap as SALES-04 — scheduleFollowUpTool works; post-action hook not wired |
| ADMIN-01 | 02-04 | Onboarding checklists for new tenancies | SATISFIED | checklistService.generateChecklist('onboarding') generates from metadata; triggered automatically via onTenancyCreated |
| ADMIN-02 | 02-04 | Offboarding checklists for ending tenancies | SATISFIED | checklistService.generateChecklist('offboarding') triggered via onTenancyStatusChanged for 'ending'/'notice_served' |
| ADMIN-03 | 02-04 | Tracks and chases outstanding items | SATISFIED | checklistService.chaseItem() sends messages, escalates after 3 chases |
| CHAN-03 | 02-05 | Conversation memory injected into agent | SATISFIED | runner.ts loads last 20 messages from conversationStore, prepends as history |
| CHAN-04 | 02-05 | Auto confirmations after agent actions | BLOCKED | handlePostActions() implemented but not called from processInbound() — zero automatic confirmations sent after viewing bookings or lead captures via webhook channel |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/agentWebhooks.ts | 16 | `handlePostActions` imported but never called | Blocker | CHAN-04 / SALES-04 / LETT-04 post-action confirmation and reminder scheduling never fires when a viewing is booked or lead captured via webhook |

---

## Human Verification Required

### 1. End-to-end WhatsApp viewing booking

**Test:** Send a WhatsApp message to the Twilio number: "I'd like to book a viewing for a 3-bed in Brixton"
**Expected:** Agent responds with properties, books viewing, immediate WhatsApp confirmation is received, two reminder messages arrive (24h before, morning-of viewing)
**Why human:** Cannot verify Twilio message delivery, pg-boss job scheduling execution, or actual database viewing record creation without a live environment

### 2. Email IMAP enquiry routing

**Test:** Send an email to the configured IMAP mailbox with a property enquiry
**Expected:** Email classified as 'create_enquiry', routed through channelGateway, Supervisor agent responds via email reply
**Why human:** Requires live IMAP polling, Microsoft Graph API connection, and email send verification

### 3. STOP keyword opt-out enforcement

**Test:** Send "STOP" via SMS to the Twilio number, then wait for a scheduled follow-up
**Expected:** No follow-up messages sent; opted_out flag visible in database
**Why human:** Requires live Twilio webhook, real pg-boss scheduled job execution, and database inspection

### 4. Automatic onboarding checklist on tenancy creation

**Test:** Create a new tenancy with status 'active' in CRM
**Expected:** tenancy_checklist_item rows are immediately inserted for all onboarding/compliance/general workflow types
**Why human:** Requires live database; also needs to verify the fire-and-forget hook does not race or duplicate against the existing hardcoded checklist insertion that was intentionally left in crmRoutes.ts (dual-write for validation)

---

## Gaps Summary

Two truths fail from a single root cause: `handlePostActions()` is imported but orphaned in `server/agentWebhooks.ts`.

The function is correctly implemented in `server/agents/services/scheduledMessages.ts` and tested thoroughly in `tests/agents/postActionConfirmation.test.ts`. It sends immediate confirmations on the same channel after viewing bookings, schedules 24h/morning-of reminders, and sends email summaries. However, `processInbound()` in `agentWebhooks.ts` ends after calling `messageSender.send(channel, fromAddress, response)` at line 85 with no call to `handlePostActions`.

This means:
- After a viewing is booked via WhatsApp/SMS: the agent's text response is sent, but no separate confirmation message and no reminder jobs are queued
- After a lead is captured: the agent text response is sent, but no email summary is dispatched

The fix requires one of:
1. Adding logic to detect tool calls in the agent run result and trigger `handlePostActions()` accordingly within `processInbound()`
2. Alternatively, integrating post-action hooks directly into the tool execution layer (e.g., in bookViewingTool.execute and createLeadTool.execute) so they fire regardless of the calling path

All other requirements (AGENT-01, AGENT-03, AGENT-07, SALES-01 through 03, LETT-01 through 03, ADMIN-01 through 03, CHAN-03) are fully satisfied with substantial, wired implementations.

---

_Verified: 2026-03-20T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
