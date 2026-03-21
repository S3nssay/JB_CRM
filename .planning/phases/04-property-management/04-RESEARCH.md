# Phase 4: Property Management Specialist - Research

**Researched:** 2026-03-21
**Domain:** Maintenance fault intake, property knowledge base triage, contractor dispatch, work order lifecycle, landlord approval workflows, automated follow-up scheduling
**Confidence:** HIGH

## Summary

Phase 4 builds the Property Management (PM) specialist agent on top of the proven agent infrastructure from Phases 1-2. The PM agent is the most complex specialist because it orchestrates a multi-party workflow: tenant reports fault -> agent triages using property KB -> agent creates work order -> agent selects and contacts contractor -> landlord approves (non-emergency) -> agent follows up to verify completion. Every step touches the database and triggers outbound messages.

The good news: nearly all infrastructure already exists. The `maintenance_ticket`, `work_order`, `contractor`, `contractor_quote`, `property_systems_inventory`, and `property_certification` tables are defined in `shared/schema.ts`. The `create_maintenance_ticket` and `query_knowledge_base` tools exist in the Tool Registry. The agent SDK patterns (Agent, tool, handoff, runner), message sender, audit logger, escalation service, and pg-boss scheduled messages are all battle-tested from Phase 2. The contact identity system resolves tenants across WhatsApp/SMS/email.

**Plan 04-01 has been executed.** The PM agent (Morgan from Property Management), emergency rules engine, tenant-to-property lookup tool, and supervisor routing are all implemented and tested. The remaining work is Plans 04-02 (contractor dispatch) and 04-03 (work order follow-up).

**Primary recommendation:** Build contractor dispatch tools (search, quote, landlord approval, work order) following the existing `wrapRegistryTool` pattern, then add pg-boss follow-up workers following the `scheduledMessages.ts` pattern.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PM-01 | Takes maintenance/fault reports from tenants via any channel and creates work orders | Plan 04-01 COMPLETE: pmAgent.ts with classifyAndCreateTicketTool, lookupTenantPropertyTool, supervisor handoff |
| PM-02 | Triages faults using property knowledge base (what system, warranty status, last service) | Plan 04-01 COMPLETE: emergencyRules.ts rules engine + queryKnowledgeBaseTool integration in PM agent workflow |
| PM-03 | Contacts appropriate contractor based on property KB and fault type | Plan 04-02: searchContractors tool (filter by specialization, service area, emergency capability) + requestContractorQuote tool (sends job details via preferred channel) |
| PM-04 | Books contractors and generates quotes for landlord approval | Plan 04-02: requestLandlordApproval tool (emergency bypass / non-emergency approval request) + createWorkOrder tool (WO number generation, contractor notification) |
| PM-05 | Follows up with contractors to verify work completion | Plan 04-03: pg-boss workers (wo-contractor-followup, wo-tenant-followup, wo-completion-check) with configurable urgency-based intervals and audit logging |
</phase_requirements>

## Existing Infrastructure (from Phase 1, 2, and 04-01)

### Database Tables (all exist in schema.ts -- verified)

| Table | Drizzle Name | Key Columns | Status |
|-------|-------------|-------------|--------|
| `maintenance_ticket` | `maintenanceTickets` | propertyId, tenantId, landlordId, category, urgency, status, assignedContractorId, estimatedCost, actualCost, aiCategorization, aiUrgencyScore, aiRoutingReason | Exists |
| `maintenance_ticket_update` | `maintenanceTicketUpdates` | ticketId, updateType, message, previousStatus, newStatus | Exists |
| `maintenance_category` | `maintenanceCategories` | name, keywords, defaultUrgency, defaultAssigneeId, escalationHours | Exists |
| `work_order` | `workOrders` | maintenanceRequestId, contractorId, workOrderNumber, scope, scheduledStart, scheduledEnd, actualStart, actualEnd, status, quotedAmount, followUpRequired, followUpNotes, completionReport | Exists |
| `contractor` | `contractors` | companyName, contactName, email, phone, emergencyPhone, specializations (text[]), serviceAreas (text[]), availableEmergency, responseTime, callOutFee (pence), hourlyRate (pence), rating (1-5), preferredContractor, isActive | Exists |
| `contractor_quote` | `contractorQuotes` | ticketId, contractorId, quoteAmount (pence), quoteDescription, estimatedDuration, availableDate, status, sentAt, respondedAt, contractorResponse, approvedById, approvedAt, approvalNotes, scheduledDate, scheduledTimeSlot | Exists |
| `property_systems_inventory` | `propertySystemsInventory` | propertyId, systemType, make, model, warrantyExpiryDate, lastServiceDate, contractorId | Exists |
| `property_certification` | `propertyCertifications` | propertyId, certificationType, expiryDate, status | Exists |

### Implemented Components (Plan 04-01 -- COMPLETE)

| Component | File | Status |
|-----------|------|--------|
| PM Agent (Morgan) | `server/agents/sdk/pmAgent.ts` | DONE -- Agent with classifyAndCreateTicketTool, queryKnowledgeBaseTool, lookupTenantPropertyTool, escalateToHumanTool |
| Emergency Rules Engine | `server/agents/services/emergencyRules.ts` | DONE -- classifyUrgency() with seasonal winter logic, gas/flood/electrical/security patterns |
| Tenant-to-Property Lookup | `server/agents/tools/definitions/lookupTenantProperty.ts` | DONE -- Resolves phone/email to tenant record with property and landlord |
| Supervisor Routing | `server/agents/sdk/supervisorAgent.ts` | DONE -- handoff to PM agent as transfer_to_property_management |
| Enhanced Maintenance Ticket | `server/agents/tools/definitions/createMaintenanceTicket.ts` | DONE -- Accepts landlordId, aiCategorization, aiUrgencyScore, aiRoutingReason |
| PM Agent Tests | `tests/agents/pmAgent.test.ts` | DONE -- Persona, tools, emergency guidance, supervisor routing |
| Emergency Rules Tests | `tests/agents/emergencyRules.test.ts` | DONE -- All urgency levels, winter/summer sensitivity |

### Existing Services (available for Plans 04-02 and 04-03)

| Service | File | What it provides |
|---------|------|-----------------|
| Message Sender | `server/agents/services/messageSender.ts` | `messageSender.send(channel, to, body)` and `messageSender.sendPreferred(phone, body)` |
| Scheduled Messages | `server/agents/services/scheduledMessages.ts` | pg-boss lazy init pattern, `registerScheduledMessageWorkers(boss)` |
| Escalation Service | `server/agents/services/escalationService.ts` | `escalationService.escalate({ conversationId, reason, urgency, channel })` |
| Audit Logger | `server/agents/middleware/auditLogger.ts` | `auditLogger.logToolCall({ agentType, toolName, toolInput, toolOutput, durationMs, channel })` |
| Agent Runner | `server/agents/sdk/runner.ts` | Runs agent with conversation history, AI identification |

### Agent Patterns Established (verified in codebase)

- **Agent creation:** `new Agent<AgentContext>({ name, model, instructions, tools })` with `gpt-4o` model
- **Supervisor handoff:** `handoff(agent, { toolNameOverride, toolDescription })`
- **Tool wrapping:** `wrapRegistryTool(name, description, z4Schema)` in `server/agents/sdk/tools.ts` for Phase 1 tools
- **SDK-native tools:** `tool({ name, description, parameters, execute })` for tools needing custom logic
- **Follow-up scheduling:** Lazy pg-boss instance, `boss.send(jobName, payload, { startAfter })` -- pattern from `scheduledMessages.ts`
- **Persona conventions:** Named agents ("Alex from Sales", "Jordan from Lettings", "Sam from Admin", "Morgan from Property Management"), British English, no emoji, channel-aware formatting

## Standard Stack

### Core (all already in project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @openai/agents | SDK | Agent framework with tool calling | Already used for all specialist agents |
| pg-boss | latest | Job queue for scheduled follow-ups | Already used for scheduled messages, follow-ups |
| drizzle-orm | 0.39 | Database queries | Project ORM |
| zod4 | alias | SDK tool parameter schemas | Required by @openai/agents SDK |
| zod | 3.x | ToolRegistry input/output schemas | Project standard |

### Supporting

| Library | Purpose | When to Use |
|---------|---------|-------------|
| messageSender (internal) | Multi-channel messaging | All outbound to contractors, landlords, tenants |
| auditLogger (internal) | Audit trail | Every tool call, follow-up attempt, escalation |
| escalationService (internal) | Staff escalation | Non-response after max follow-up attempts |

## Architecture Patterns

### New Files for Plans 04-02 and 04-03

```
server/agents/
  tools/definitions/
    searchContractors.ts          # Plan 04-02: Search contractors by specialization/area
    requestContractorQuote.ts     # Plan 04-02: Create quote record + contact contractor
    requestLandlordApproval.ts    # Plan 04-02: Approval request or emergency bypass
    createWorkOrder.ts            # Plan 04-02: Create WO with generated number
    scheduleWorkOrderFollowup.ts  # Plan 04-03: Schedule pg-boss follow-up jobs
  services/
    landlordApproval.ts           # Plan 04-02: Approval workflow service
    workOrderFollowup.ts          # Plan 04-03: pg-boss workers for follow-ups
tests/agents/
    contractorDispatch.test.ts    # Plan 04-02 tests
    workOrderFollowup.test.ts     # Plan 04-03 tests
```

### Pattern: ToolRegistry Tool Definition

All new tools follow the existing pattern in `server/agents/tools/definitions/`:

```typescript
// Source: server/agents/tools/definitions/createMaintenanceTicket.ts (verified)
import { z } from 'zod';
import { db } from '../../../db';
import { tableName } from '@shared/schema';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({ /* fields */ });
const outputSchema = z.object({ /* fields */ });

export const myTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'tool_name',
  description: 'What it does',
  inputSchema,
  outputSchema,
  permissions: ['maintenance', 'supervisor'],
  tier: 'autonomous',
  async execute(input, _context: ToolContext) {
    // DB operations, return output matching outputSchema
  },
};
```

Then wrap in `server/agents/sdk/tools.ts`:
```typescript
export const mySDKTool = wrapRegistryTool(
  'tool_name',
  'Description for the LLM',
  z4.object({ /* z4 schema matching inputSchema */ }),
);
```

### Pattern: pg-boss Worker (for follow-ups)

```typescript
// Source: server/agents/services/scheduledMessages.ts (verified)
import PgBoss from 'pg-boss';

let _boss: PgBoss | null = null;
function getBoss(): PgBoss {
  if (!_boss) {
    _boss = new PgBoss(process.env.DATABASE_URL!);
  }
  return _boss;
}

export function registerMyWorkers(boss: PgBoss) {
  boss.work('job-name', async (job) => {
    // Process job.data
  });
}
```

### Anti-Patterns to Avoid

- **Prompt-only urgency classification:** Emergency detection MUST be code-level rules (emergencyRules.ts), not just prompt instructions. Already enforced by classifyAndCreateTicketTool.
- **Blocking webhook handlers:** All outbound messages (to contractors, landlords) should be fire-and-forget after the primary operation succeeds. Don't block the tool response on message delivery.
- **Hardcoded channel preference:** Use messageSender which handles channel fallback. Don't hardcode WhatsApp-only or SMS-only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Multi-channel messaging | Custom WhatsApp/SMS/email sending | `messageSender.send()` / `messageSender.sendPreferred()` | Handles channel fallback, opt-out checking |
| Job scheduling | Custom timers or cron | pg-boss with lazy init pattern | Already proven in scheduledMessages.ts, handles retries |
| Audit logging | Console.log or custom DB writes | `auditLogger.logToolCall()` | Consistent audit trail format across all agents |
| Staff escalation | Custom notification logic | `escalationService.escalate()` | Round-robin assignment, notification |

## Common Pitfalls

### Pitfall 1: Contractor specializations array matching
**What goes wrong:** The `specializations` column is `text[]`. SQL array containment requires `@>` operator or `ANY()` syntax.
**How to avoid:** Use raw SQL `WHERE $1 = ANY(specializations)` or Drizzle's array operators. Test with actual array data.
**Warning signs:** Empty results when contractors exist with matching specializations.

### Pitfall 2: Service area postcode matching
**What goes wrong:** Service areas stored as text array (e.g., `['SW', 'SE', 'W']` or `['SW1', 'SE24']`). Matching requires prefix comparison.
**How to avoid:** Extract first 2-4 characters of property postcode and check against each service area entry. Use LIKE or starts_with matching.
**Warning signs:** Contractors not found even when they cover the area.

### Pitfall 3: Amounts in pence
**What goes wrong:** `callOutFee`, `hourlyRate`, `quoteAmount`, `quotedAmount` are all stored in pence (integer). Display to humans must convert to pounds.
**How to avoid:** Always divide by 100 for display: `(amountPence / 100).toFixed(2)`. Always multiply by 100 for storage.
**Warning signs:** Displaying "25000" instead of "250.00".

### Pitfall 4: Work order number uniqueness
**What goes wrong:** Two concurrent work orders on the same date could generate the same WO number if using MAX+1.
**How to avoid:** Use a database sequence or add a unique constraint on `workOrderNumber`. The WO-YYYYMMDD-XXXX format needs atomic increment.
**Warning signs:** Duplicate key errors on work_order inserts.

### Pitfall 5: Follow-up on completed/cancelled work orders
**What goes wrong:** A scheduled follow-up fires after the work order was already completed or cancelled.
**How to avoid:** Every follow-up worker MUST check work order status first. If completed/cancelled, skip and log "skipped - already {status}".
**Warning signs:** Tenants receiving "has the issue been resolved?" after it was resolved days ago.

## Technical Decisions

### Emergency Rules: Code, Not Prompt
The emergency detection is rules-based in code (`emergencyRules.ts`), not prompt instructions. This is already implemented and matches the project pattern from PM-08 requirement ("hard-coded frequency limits and compliance rules, not prompt-only").

### Contractor Selection Algorithm
```
1. Filter by specialization matching ticket category
2. Filter by service area matching property postcode prefix
3. If emergency: filter to availableEmergency = true
4. Sort: preferredContractor DESC, rating DESC NULLS LAST
5. Limit to 5 results
```

### Work Order Number Generation
Format: `WO-YYYYMMDD-XXXX` where XXXX is a daily sequential counter. Use MAX+1 query scoped to same date prefix, or database sequence.

### Landlord Approval Workflow
- Emergency (urgency = 'emergency'): Skip approval, auto-approve, send notification to landlord, dispatch immediately, log bypass in audit trail
- Non-emergency: Send approval request to landlord via preferred channel, include fault description + contractor name + quoted amount. Landlord replies APPROVE or REJECT.
- 48-hour timeout: if no landlord response, escalate to staff

### Follow-up Intervals (configurable by urgency)
| Urgency | Contractor Follow-up | Tenant Follow-up |
|---------|---------------------|-----------------|
| Emergency | 24 hours | 24 hours |
| Urgent | 48 hours | 48 hours |
| Routine | 72 hours | 72 hours |
| Low | 96 hours | 96 hours |

Max 2 follow-up attempts before staff escalation.

### Supervisor Routing Update (DONE)
The Supervisor agent already has the handoff to PM agent:
```typescript
handoff(pmAgent, {
  toolNameOverride: 'transfer_to_property_management',
  toolDescription: 'Transfer to Property Management for maintenance faults, repairs, contractor issues, work orders, and any tenant reporting a problem with their property',
})
```

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (established in Phase 1) |
| Config file | vitest implicit config (no config file, uses defaults) |
| Quick run command | `npx vitest run tests/agents/pmAgent.test.ts --reporter=verbose` |
| Full suite command | `npx vitest run tests/agents/ --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PM-01 | Fault intake and ticket creation via PM agent | unit | `npx vitest run tests/agents/pmAgent.test.ts -x` | Yes |
| PM-02 | Emergency rules engine triage | unit | `npx vitest run tests/agents/emergencyRules.test.ts -x` | Yes |
| PM-03 | Contractor search and quote request | unit | `npx vitest run tests/agents/contractorDispatch.test.ts -x` | No -- Wave 2 |
| PM-04 | Landlord approval and work order creation | unit | `npx vitest run tests/agents/contractorDispatch.test.ts -x` | No -- Wave 2 |
| PM-05 | Work order follow-up scheduling and audit | unit | `npx vitest run tests/agents/workOrderFollowup.test.ts -x` | No -- Wave 3 |

### Sampling Rate
- **Per task commit:** `npx vitest run tests/agents/pmAgent.test.ts tests/agents/emergencyRules.test.ts --reporter=verbose`
- **Per wave merge:** `npx vitest run tests/agents/ --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/agents/contractorDispatch.test.ts` -- covers PM-03, PM-04 (Plan 04-02)
- [ ] `tests/agents/workOrderFollowup.test.ts` -- covers PM-05 (Plan 04-03)

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Landlord approval timeout causing stuck work orders | Medium | 48-hour auto-escalation to staff; emergency bypasses approval entirely |
| Contractor not responding to quote request | Medium | Auto-escalate to next contractor in ranked list after 24h; max 3 attempts |
| Tenant identity resolution failure (unregistered phone) | Low | Fall back to asking tenant for property address/postcode; create ticket manually |
| Multiple tenants at same property | Low | Ask tenant to confirm which unit (for HMOs); single-tenant properties auto-resolve |
| Emergency misclassification | Low | Rules-based classification with keyword matching; all emergencies also audited for staff review |
| Work order number collision under concurrency | Low | Use database-level unique constraint on workOrderNumber; retry with increment on conflict |

## Dependencies

- **Phase 1:** Property KB tables, tool registry, conversation store, audit logger, contact identity -- all complete
- **Phase 2:** SDK agent patterns, supervisor routing, message sender, pg-boss scheduled messages, escalation service -- all complete
- **Phase 3:** Voice integration -- PM agent works on text channels regardless of Phase 3 completion; voice routing to PM can be added later
- **Plan 04-01:** PM agent core, emergency rules, tenant lookup, supervisor handoff -- COMPLETE

**Note on Phase 3 dependency:** The PM agent's core functionality (text-channel fault intake, KB triage, contractor dispatch, follow-up) does not require voice. The dependency is because the success criteria mention "any channel" which includes voice once Phase 3 is done. Plans are structured so that the PM agent works on text channels immediately, and voice routing is a configuration addition (adding PM handoff to voice Supervisor) after Phase 3.

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` -- Verified all table definitions: contractors (line 1285), contractorQuotes (line 1599), workOrders (line 800), maintenanceTickets, tenant, landlords, properties
- `server/agents/sdk/pmAgent.ts` -- Verified PM agent implementation with tools and persona
- `server/agents/sdk/tools.ts` -- Verified wrapRegistryTool pattern and all existing wrapped tools
- `server/agents/services/emergencyRules.ts` -- Verified rules engine implementation
- `server/agents/sdk/supervisorAgent.ts` -- Verified PM agent handoff
- `server/agents/services/scheduledMessages.ts` -- Verified pg-boss lazy init pattern
- `server/agents/services/messageSender.ts` -- Verified multi-channel send API
- `server/agents/middleware/auditLogger.ts` -- Verified logToolCall API
- `tests/agents/pmAgent.test.ts` -- Verified test patterns and mock setup

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in project, patterns proven across 3 phases
- Architecture: HIGH -- follows exact same patterns as existing agents, tools verified against schema
- Pitfalls: HIGH -- identified from actual schema column types and existing code patterns

**Research date:** 2026-03-21
**Valid until:** 2026-04-20 (stable -- no external dependencies changing)
