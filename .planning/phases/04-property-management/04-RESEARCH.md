# Phase 4: Property Management Specialist - Research

**Researched:** 2026-03-20
**Domain:** Maintenance fault intake, property knowledge base triage, contractor dispatch, work order lifecycle, landlord approval workflows, automated follow-up scheduling
**Confidence:** HIGH

## Summary

Phase 4 builds the Property Management (PM) specialist agent on top of the proven agent infrastructure from Phases 1-2. The PM agent is the most complex specialist because it orchestrates a multi-party workflow: tenant reports fault -> agent triages using property KB -> agent creates work order -> agent selects and contacts contractor -> landlord approves (non-emergency) -> agent follows up to verify completion. Every step touches the database and triggers outbound messages.

The good news: nearly all infrastructure already exists. The `maintenance_ticket`, `work_order`, `contractor`, `contractor_quote`, `property_systems_inventory`, and `property_certification` tables are defined in `shared/schema.ts`. The `create_maintenance_ticket` and `query_knowledge_base` tools exist in the Tool Registry. The agent SDK patterns (Agent, tool, handoff, runner), message sender, audit logger, escalation service, and pg-boss scheduled messages are all battle-tested from Phase 2. The contact identity system resolves tenants across WhatsApp/SMS/email.

The primary gaps are:
1. **No PM specialist agent** -- the `maintenance` agent type is defined in `AgentType` but no SDK agent exists (only a legacy `MaintenanceAgent.ts` in `server/agents/specialists/` which is unused)
2. **No contractor-facing tools** -- need tools to search contractors, request quotes, dispatch work orders, and contact contractors via their preferred channel
3. **No landlord approval workflow** -- need a tool to send approval requests to landlords and track their responses
4. **No emergency detection** -- need rules-based urgency classification (not just prompt-based) to decide emergency vs non-emergency dispatch
5. **No work order follow-up system** -- need pg-boss jobs for automated follow-up at configurable intervals
6. **No property-to-tenant resolution** -- when a tenant messages, we need to look up their property and landlord from the `tenant` table

## Existing Infrastructure (from Phase 1 and 2)

### Database Tables (all exist in schema.ts)

| Table | Drizzle Name | Key Columns | Status |
|-------|-------------|-------------|--------|
| `maintenance_ticket` | `maintenanceTickets` | propertyId, tenantId, landlordId, category, urgency, status, assignedContractorId, estimatedCost, actualCost | Exists |
| `maintenance_ticket_update` | `maintenanceTicketUpdates` | ticketId, updateType, message, previousStatus, newStatus | Exists |
| `maintenance_category` | `maintenanceCategories` | name, keywords, defaultUrgency, defaultAssigneeId, escalationHours | Exists |
| `work_order` | `workOrders` | maintenanceRequestId, contractorId, workOrderNumber, scope, scheduledStart, status, quotedAmount | Exists |
| `contractor` | `contractors` | companyName, contactName, email, phone, emergencyPhone, specializations, serviceAreas, availableEmergency, responseTime, callOutFee, hourlyRate, rating, preferredContractor | Exists |
| `contractor_quote` | `contractorQuotes` | ticketId, contractorId, quoteAmount, quoteDescription, status (pending/quoted/approved/scheduled/completed), approvedById | Exists |
| `property_systems_inventory` | `propertySystemsInventory` | propertyId, systemType, make, model, warrantyExpiryDate, lastServiceDate, contractorId | Exists |
| `property_certification` | `propertyCertifications` | propertyId, certificationType, expiryDate, status | Exists |

### Existing SDK Tools

| Tool | File | Permissions | What it does |
|------|------|-------------|-------------|
| `create_maintenance_ticket` | `server/agents/tools/definitions/createMaintenanceTicket.ts` | supervisor, maintenance, office_admin | Creates a ticket with propertyId, title, description, category, urgency |
| `query_knowledge_base` | `server/agents/tools/definitions/queryKnowledgeBase.ts` | All agent types | Queries certifications, systems inventory, maintenance history by propertyId |
| `search_properties` | `server/agents/tools/definitions/searchProperties.ts` | Multiple | Searches properties |
| `escalate_to_human` | `server/agents/sdk/tools.ts` | All via SDK | Escalates conversation to human staff |

### Existing Services

| Service | File | What it provides |
|---------|------|-----------------|
| Message Sender | `server/agents/services/messageSender.ts` | Sends via WhatsApp/SMS/email with channel fallback |
| Scheduled Messages | `server/agents/services/scheduledMessages.ts` | pg-boss job queue for deferred messages |
| Escalation Service | `server/agents/services/escalationService.ts` | Round-robin staff escalation |
| Audit Logger | `server/agents/middleware/auditLogger.ts` | Logs all tool calls, responses, escalations |
| Agent Runner | `server/agents/sdk/runner.ts` | Runs agent with conversation history, AI identification |

### Agent Patterns Established

- **Agent creation:** `new Agent<AgentContext>({ name, model, instructions, tools })` with `gpt-4o` model
- **Supervisor handoff:** `handoff(agent, { toolNameOverride, toolDescription })`
- **Tool wrapping:** `wrapRegistryTool(name, description, z4Schema)` for Phase 1 tools, `tool({ name, description, parameters, execute })` for SDK-native tools
- **Follow-up scheduling:** Lazy pg-boss instance, `boss.send(jobName, payload, { startAfter })` -- pattern from `salesAgent.ts`
- **Persona conventions:** Named agents ("Alex from Sales", "Jordan from Lettings", "Sam from Admin"), British English, no emoji, channel-aware formatting

## New Components Required

### Plan 04-01: PM Specialist Agent Core

**PM Agent ("Morgan from Property Management")**

New SDK agent at `server/agents/sdk/pmAgent.ts` that:
1. Receives fault reports from tenants via any channel (Supervisor routes maintenance_request intent to PM agent)
2. Looks up the tenant's property using a new `lookup_tenant_property` tool
3. Queries the property KB (systems inventory, certifications, maintenance history) using existing `query_knowledge_base`
4. Creates a maintenance ticket using existing `create_maintenance_ticket` (needs enhancement: should also set landlordId)
5. Classifies urgency using rules-based logic (not just prompt):
   - **Emergency**: gas leak, no heating (winter), flood/burst pipe, security breach, no hot water (with vulnerable tenant)
   - **Urgent**: boiler fault (non-winter), electrical fault, broken lock, pest infestation
   - **Routine**: dripping tap, minor repair, appliance issue, decoration
   - **Low**: cosmetic issue, planned improvement

**Tenant-to-Property Resolution:**
The `tenant` table has `property_id` and `landlord_id` columns. When a tenant messages, the contact identity resolves to a contact. We need a tool that, given a contact phone/email, looks up the tenant record to get propertyId and landlordId. This enables the PM agent to automatically know which property a fault report is about.

**Enhanced create_maintenance_ticket:**
Current tool doesn't set `landlordId` or `aiCategorization`/`aiUrgencyScore`/`aiRoutingReason`. Enhance to set these fields.

### Plan 04-02: Contractor Dispatch

**New tools needed:**

1. `search_contractors` -- Query contractors table by specialization, service area, availability, emergency capability. Returns ranked list (preferred first, then by rating, then by response time).

2. `request_contractor_quote` -- Create a `contractor_quote` record, send job details to contractor via their preferred channel (phone -> SMS/WhatsApp, email). Returns quote ID.

3. `request_landlord_approval` -- For non-emergency work: send the quote to the landlord via their preferred channel with approve/reject link or reply keyword. For emergency work: auto-approve and log the bypass reason.

4. `create_work_order` -- After landlord approval, create a `work_order` record linked to the maintenance ticket and contractor. Generate a work order number (WO-YYYYMMDD-XXXX format). Send job confirmation to contractor.

**Emergency vs non-emergency logic:**
- Emergency (urgency = 'emergency'): Skip landlord approval, dispatch immediately to emergency contractor, log bypass
- Non-emergency: Request quote from selected contractor, send to landlord for approval, wait for response

**Landlord approval workflow:**
- Send approval message via landlord's preferred channel (from `landlords` table: mobile -> WhatsApp/SMS, email)
- Include: fault description, contractor name, quoted amount, estimated duration
- Landlord replies "approve" or "reject" (or clicks link)
- Approval triggers work order creation and contractor dispatch
- Rejection triggers re-selection or escalation to staff
- 48-hour timeout: if no response, auto-escalate to staff

### Plan 04-03: Work Order Follow-up and Completion

**pg-boss scheduled follow-ups:**

1. After work order creation, schedule:
   - `wo-contractor-followup`: Check with contractor at configurable interval (default 24h for emergency, 48h for urgent, 72h for routine)
   - `wo-tenant-followup`: Check with tenant same schedule as contractor
   - `wo-completion-check`: At scheduled end date, check if completed

2. Follow-up message content:
   - To contractor: "Hi {name}, checking on work order {WO-number} at {address}. Is the work progressing as planned?"
   - To tenant: "Hi {name}, our contractor should have attended to the {issue} at your property. Has the issue been resolved?"

3. Response handling:
   - Tenant confirms resolved -> update work order status to 'completed', close ticket
   - Tenant says not resolved -> create follow-up ticket or re-dispatch
   - Contractor confirms complete -> update work order, await tenant confirmation
   - No response after 2 follow-ups -> escalate to staff

**Audit logging:**
Every follow-up attempt logged via auditLogger with:
- workOrderId, ticketId, followUpType (contractor/tenant), attempt number, response received, timestamp

## Technical Decisions

### Emergency Rules: Code, Not Prompt

The emergency detection MUST be rules-based in code, not prompt instructions. This matches the project pattern from Phase 5's PM-08 requirement ("hard-coded frequency limits and compliance rules, not prompt-only"). Create an `emergencyRules.ts` file with a `classifyUrgency(faultDescription, category, systemInfo)` function that returns urgency + reasoning.

**Emergency keyword patterns:**
- Gas: "gas leak", "smell gas", "carbon monoxide"
- Flood: "burst pipe", "flooding", "water pouring", "ceiling leaking"
- Heating (winter Oct-Mar): "no heating", "heating broken", "boiler not working"
- Security: "break-in", "door won't lock", "window smashed"
- Hot water (vulnerable): "no hot water" + tenant flagged as vulnerable

### Contractor Selection Algorithm

```
1. Filter by specialization matching ticket category
2. Filter by service area matching property postcode
3. If emergency: filter to availableEmergency = true
4. Sort: preferredContractor DESC, rating DESC, responseTime ASC
5. Return top 3 candidates
```

### Work Order Number Generation

Format: `WO-YYYYMMDD-XXXX` where XXXX is a daily sequential counter. Use a database sequence or MAX+1 query on same date.

### Supervisor Routing Update

The Supervisor agent needs a new handoff to the PM agent:
```typescript
handoff(pmAgent, {
  toolNameOverride: 'transfer_to_property_management',
  toolDescription: 'Transfer to Property Management for maintenance faults, repairs, contractor issues, work orders, and property condition reports',
})
```

### Tenant Identity Resolution

When a tenant messages about a fault, the system needs to resolve their identity to a property:
1. Contact identity (from Phase 1) resolves phone/email to a contactId
2. New tool `lookup_tenant_property` queries `tenant` table by contact phone/email
3. Returns: tenantId, propertyId, landlordId, property address, tenant name

This avoids asking the tenant "which property?" when they only manage one property. If a tenant has multiple properties (rare for tenants), ask which one.

## Validation Architecture

### Test Strategy

All three plans use Vitest (established in Phase 1). Test patterns:

1. **Unit tests** for emergency rules engine (pure function, no DB needed)
2. **Unit tests** for contractor selection algorithm (mock DB queries)
3. **Integration tests** for PM agent tool availability and persona
4. **Integration tests** for work order follow-up job scheduling

### Test Files

| Test | Plan | What it validates |
|------|------|-------------------|
| `tests/agents/pmAgent.test.ts` | 04-01 | PM agent tools, persona, emergency classification |
| `tests/agents/emergencyRules.test.ts` | 04-01 | Rules-based urgency classification |
| `tests/agents/contractorDispatch.test.ts` | 04-02 | Contractor search, quote request, landlord approval, work order creation |
| `tests/agents/workOrderFollowup.test.ts` | 04-03 | Follow-up scheduling, completion verification, audit logging |

### Verification Commands

- Quick: `npx vitest run tests/agents/pmAgent.test.ts tests/agents/emergencyRules.test.ts --reporter=verbose`
- Full: `npx vitest run tests/agents/ --reporter=verbose`

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Landlord approval timeout causing stuck work orders | Medium | 48-hour auto-escalation to staff; emergency bypasses approval entirely |
| Contractor not responding to quote request | Medium | Auto-escalate to next contractor in ranked list after 24h; max 3 attempts |
| Tenant identity resolution failure (unregistered phone) | Low | Fall back to asking tenant for property address/postcode; create ticket manually |
| Multiple tenants at same property | Low | Ask tenant to confirm which unit (for HMOs); single-tenant properties auto-resolve |
| Emergency misclassification | Low | Rules-based classification with keyword matching; all emergencies also audited for staff review |

## Dependencies

- **Phase 1:** Property KB tables, tool registry, conversation store, audit logger, contact identity -- all complete
- **Phase 2:** SDK agent patterns, supervisor routing, message sender, pg-boss scheduled messages, escalation service -- all complete
- **Phase 3:** Voice integration -- PM agent works on text channels regardless of Phase 3 completion; voice routing to PM can be added later

**Note on Phase 3 dependency:** The roadmap says Phase 4 depends on Phase 3. However, the PM agent's core functionality (text-channel fault intake, KB triage, contractor dispatch, follow-up) does not require voice. The dependency is because the success criteria mention "any channel" which includes voice once Phase 3 is done. Plans should be structured so that the PM agent works on text channels immediately, and voice routing is a configuration addition (adding PM handoff to voice Supervisor) after Phase 3.

## RESEARCH COMPLETE
