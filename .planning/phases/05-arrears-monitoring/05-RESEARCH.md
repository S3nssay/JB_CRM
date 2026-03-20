# Phase 5: Arrears Chasing & Monitoring — Research

**Researched:** 2026-03-20
**Confidence:** HIGH
**Phase Requirements:** PM-06, PM-07, PM-08

## Phase Boundary

Phase 5 delivers three capabilities:
1. An arrears chasing agent that contacts tenants via outbound SMS/WhatsApp/voice with hard-coded compliance rules
2. Payment commitment capture with payment link dispatch (Stripe + GoCardless)
3. A staff monitoring dashboard for all agent activity across the platform

**Depends on:** Phase 4 (PM Specialist — maintenance intake, contractor dispatch, work orders). Phase 5 extends the PM agent domain to cover arrears chasing.

## Existing Infrastructure (What We Build On)

### Schema — Already Exists
- `arrears` table: `id, tenant_id, property_id, tenancy_id, invoice_id, amount (pence), days_overdue, status, dunning_level (1-5), last_reminder_sent, next_reminder_due, notes, created_at, updated_at`
- `dunning_actions` table: `id, arrears_id, action_type (email/sms/letter/phone_call/legal_notice), template_id, sent_at, channel, status, response, notes, created_by, created_at`
- `payments` table: `id, payment_type, property_id, tenant_id, landlord_id, amount (pence), status, payment_method, stripe_payment_id, stripe_customer_id, due_date, paid_at, etc.`
- `payment_schedules` table: tracks recurring rent with `missed_payments` counter
- `gocardless_payments` table: direct debit integration
- `agent_audit_log` table: full audit trail for all agent actions
- `contact_identity` table: maps phone/email to CRM contacts with opt-out tracking
- `conversations` + `messages` tables: cross-channel threading

### Services — Already Exists
- `server/agents/sdk/runner.ts` — Agent execution pipeline (history, AI identification, audit logging)
- `server/agents/services/messageSender.ts` — Unified outbound dispatch (WhatsApp, SMS, email)
- `server/agents/services/escalationService.ts` — Round-robin escalation to human staff
- `server/agents/services/scheduledMessages.ts` — pg-boss job queue for scheduled messages (viewing reminders, follow-ups)
- `server/agents/middleware/auditLogger.ts` — Agent audit logging
- `server/paymentService.ts` — Stripe payment intent creation
- `server/gocardlessService.ts` — GoCardless mandate setup and payment collection
- `server/agents/channels/gateway.ts` — Channel gateway for inbound messages
- `server/agents/channels/contactResolver.ts` — Contact identity resolution

### Agent Pattern — Established in Phase 2
- OpenAI Agents SDK with zod4 for tool parameters
- Agent = persona instructions + domain tools + follow-up scheduling tool
- Supervisor handoff routing based on intent classification
- Tools wrap Phase 1 ToolRegistry or implement standalone logic
- All agents share `AgentContext` (conversationId, contactId, channel, agentType)

## New Infrastructure Required

### 1. Arrears Contact Compliance Guard (CRITICAL — Hard-Coded, Not Prompt-Based)

The compliance guard is the single most important component. Requirements PM-06 and PM-08 explicitly demand hard-coded frequency limits — not LLM prompt instructions.

**Contact rules (from Pitfall 4 in project research + roadmap success criteria):**
- Maximum 1 automated call per 48 hours per tenant
- Maximum 1 automated message (SMS/WhatsApp) per 48 hours per tenant
- No contact on Sundays (day-of-week check)
- No contact after 20:00 or before 09:00 (time-of-day check, UK timezone)
- After 3 unsuccessful automated contacts, auto-escalate to human case manager

**Implementation approach:**
- Standalone `ArrearsComplianceGuard` class — NOT part of agent instructions
- `canContact(tenantId, channel): { allowed: boolean, reason: string, nextAllowedAt: Date | null }`
- Queries `dunning_actions` table for recent contact history per tenant
- Returns denial with reason if any rule violated
- The agent runner calls this BEFORE allowing the arrears agent to send any outbound message
- This guard is the last line of defence — it blocks even if the LLM hallucinates urgency

### 2. Vulnerability Detection (Hard-Coded Keywords)

When a tenant mentions financial hardship, mental health, job loss, etc., the system must immediately stop automated chasing and escalate to a human.

**Keyword patterns (from FCA vulnerability guidance):**
- Financial: "can't afford", "lost my job", "redundant", "on benefits", "universal credit", "debt", "food bank"
- Mental health: "depressed", "anxiety", "mental health", "suicidal", "self-harm"
- Health: "hospital", "disability", "seriously ill", "cancer"
- Domestic: "domestic abuse", "violence", "fleeing"
- Bereavement: "died", "death", "bereavement", "funeral"

**Implementation:** A `vulnerabilityDetector.detect(messageText): { detected: boolean, keywords: string[], category: string }` function that scans inbound tenant messages. If detected → immediate escalation, arrears case flagged as `vulnerability_detected`, all automated chasing suspended.

### 3. Arrears Chasing Agent (PM Sub-Specialist)

A new SDK agent focused specifically on arrears conversations. It is NOT the same as the PM maintenance agent from Phase 4.

**Agent identity:** "Sarah from Accounts" at John Barclay Estate Agents
**Tools:**
- `lookupArrearsCase(tenantId)` — Get arrears details, payment history, contact history
- `sendPaymentReminder(arrearsId, channel)` — Send reminder (guarded by compliance check)
- `capturePaymentCommitment(arrearsId, commitDate, commitAmount)` — Log a commitment
- `generatePaymentLink(arrearsId, amount)` — Create Stripe/GoCardless payment link
- `escalateArrearsCase(arrearsId, reason)` — Escalate to human case manager

**Behaviour:**
- Polite, empathetic, professional tone (UK convention)
- Explains the amount owed and offers payment options
- If tenant agrees to pay: captures commitment date and sends payment link
- If tenant shows vulnerability: immediately escalates
- Never threatens or uses aggressive language
- Respects opt-out (checked via contact_identity.opted_out)

### 4. Payment Link Generation

**Stripe Payment Links:** Use `stripe.paymentLinks.create()` for one-off arrears payments. Returns a URL that can be sent via WhatsApp/SMS. The existing `paymentService.ts` only creates payment intents (for embedded checkout) — need to add payment link generation.

**GoCardless:** For tenants with existing mandates, use `gcRequest('POST', '/payments')` to collect against the mandate. For tenants without mandates, generate a redirect flow URL for mandate setup.

**Audit:** Every payment link generated must be logged to `agent_audit_log` and the `dunning_actions` table.

### 5. Agent Monitoring Dashboard

A React page at `/crm/agent-monitoring` providing:

**Conversation thread viewer:**
- List all agent conversations with filters (channel, agent type, date range, status)
- Click to view full thread with all messages and tool calls
- Highlight escalated conversations

**Escalation queue:**
- Pending escalations requiring human action
- Assignee, reason, urgency, time waiting
- Click to review conversation and take action

**Per-agent metrics:**
- Conversations handled today/week/month
- Average response time
- Escalation rate
- Tool usage counts

**Audit log:**
- Searchable audit log (agent_audit_log table)
- Filter by agent type, action, date range
- Export capability

**Cost tracking:**
- OpenAI API cost per agent type (from audit log duration and model info)
- Twilio/WhatsApp message costs (count outbound messages)

**Data sources:** All data comes from existing tables (`conversations`, `messages`, `agent_audit_log`). No new schema required for the dashboard — it's a read-only view.

## Validation Architecture

### Testing Strategy

**Unit tests (vitest):**
- ArrearsComplianceGuard: all rule enforcement (48h window, Sunday block, time-of-day, contact count escalation)
- VulnerabilityDetector: keyword detection across all categories
- Payment link generation (mock Stripe/GoCardless)
- Arrears agent tool execution (mock DB)

**Integration tests:**
- Compliance guard blocks contact when recent dunning action exists
- Vulnerability detection triggers escalation flow
- Payment commitment creates follow-up job in pg-boss
- Dashboard API endpoints return correct aggregated data

**Manual verification:**
- Dashboard UI renders correctly with real data
- Payment links are functional (Stripe test mode)
- WhatsApp/SMS delivery works end-to-end

### Key Risk: UK Compliance

The STATE.md notes: "Arrears chasing compliance rules (UK Pre-Action Protocol, FCA vulnerability guidance) need professional legal review before Phase 5 planning. Research flags this as a gap."

**Mitigation in implementation:**
- All compliance rules are hard-coded in the ComplianceGuard, making them auditable and easily adjustable
- Conservative defaults (48h between contacts, no Sunday contact, 9am-8pm window only)
- Vulnerability detection errs on the side of caution (escalate if in doubt)
- Full audit trail of every contact attempt (successful or blocked)
- The system can be tightened further after legal review — loosening is harder

## Wave Structure

| Wave | Plans | Rationale |
|------|-------|-----------|
| 1 | 05-01 (Arrears agent) | Compliance guard + agent + outbound chasing — core capability |
| 2 | 05-02 (Payment links) | Builds on arrears agent — adds payment capture and link dispatch |
| 3 | 05-03 (Dashboard) | Read-only dashboard — depends on data from Waves 1-2 being generated |

## RESEARCH COMPLETE

All three plans can proceed to planning. The existing infrastructure (schema, agent SDK, messaging, audit trail, payment services) provides a strong foundation. The primary new work is the compliance guard, vulnerability detector, arrears-specific agent, payment link generation, and the monitoring dashboard.

---
*Phase: 05-arrears-monitoring*
*Researched: 2026-03-20*
