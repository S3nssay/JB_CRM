# Phase 5: Arrears Chasing & Monitoring - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

The PM agent contacts tenants in rent arrears via outbound WhatsApp, SMS, phone call, and email — with hard-coded contact rules (frequency limits, time-of-day restrictions, vulnerability escalation). Payment commitments are captured and payment links dispatched. Staff get a monitoring dashboard covering ALL AI agent activity (not just arrears) with conversation threads, escalation queue, per-agent metrics, and audit log.

</domain>

<decisions>
## Implementation Decisions

### Agent Identity & Tone
- Dedicated arrears agent name: "Chris from Accounts" — first name only, consistent with Alex from Sales, Jordan from Lettings pattern
- Empathy-first tone: soft, understanding opening ("We noticed your rent payment hasn't come through yet — is everything okay?"). Assumes good faith
- Agent stays focused on payment — does NOT proactively offer support resources. If tenant raises hardship, THEN agent acknowledges and escalates to human case manager
- Tone does NOT escalate with dunning level — empathy-first throughout. Broken commitment history logged for staff visibility but doesn't change agent behaviour
- British conventions, no emoji (carry forward from Phase 2)
- AI self-identification in first message only (carry forward from Phase 2)

### Channel Strategy
- Contact sequence: WhatsApp first (less intrusive), then outbound phone call if no response within 48hrs, then SMS as final fallback
- Outbound voice calls via Vapi (Phase 3 infrastructure) — agent makes outbound calls as part of the arrears escalation sequence
- If phone call not answered: leave voicemail ("Hi, this is Chris from John Barclay regarding your account. Please call us back or reply to the message we've sent."), then send SMS
- Payment links always sent via BOTH WhatsApp AND email — regardless of conversation channel. Double coverage for clickability + paper trail
- Full property and amount details in messages (no vague/privacy-first approach): "Your rent of £1,850 for 42 Kensington Gardens is overdue"

### Arrears Presentation
- Itemised arrears: when tenant has multiple arrears, reference each individually ("You have 2 outstanding payments: £1,850 due 1st Feb and £1,850 due 1st March"), not combined
- Separate payment links possible per arrears case

### Negotiation & Commitments
- Accept commitments only — agent records what tenant promises ("I'll pay Friday") and sends payment link for the full amount
- NO instalment plan negotiation — instalment requests escalated to human
- Written confirmation always after commitment: "Just to confirm, you've agreed to pay £1,850 by Friday 28th March. We'll send a payment link shortly." Creates audit trail
- Payment link sent immediately after commitment — "Here's your payment link so it's ready when you are"
- If tenant misses commitment date: follow up the next day (not same-day, not 48hrs)

### Post-Escalation Behaviour
- After escalation to human case manager (3 failed contacts), AI continues sending periodic payment reminders but human leads all conversations and negotiations
- When payment received and arrears cleared: send "Thank you for your payment of £1,850. Your account is now up to date" confirmation

### Landlord Communication
- No proactive notification to landlord about arrears chasing — landlord sees arrears status on their dashboard/portal
- Staff see everything on the monitoring dashboard

### Arrears Contact Rules (NOT "compliance" — that term means document compliance in this project)
- Staff-configurable frequency limits via a settings UI (not hard-coded constants). Default: 1 call + 1 message per 48-hour window per tenant
- Contact hours: 9am–8pm Monday–Saturday only. No Sundays, no UK bank holidays
- Limits are per-TENANT, not per-arrears-case. Tenant with 2 properties in arrears gets ONE call + ONE message per 48hrs covering all their cases
- When a scheduled message falls into a blackout window (Sunday, after 8pm, bank holiday): queue for next available slot (9am next valid day). Nothing is lost
- No hard cap on total contact attempts — the 3-attempt escalation to human is sufficient. After escalation, AI continues reminders but human leads
- STOP/opt-out keyword blocks MARKETING messages only. Arrears messages are transactional — STOP does not apply. Agent continues arrears contact regardless of opt-out status

### Vulnerability Detection
- Keyword detection triggers a gentle probe: "I want to make sure you're okay — are you experiencing any difficulties beyond the payment?"
- If tenant confirms difficulty: immediate escalation to human case manager
- Keywords: financial hardship, mental health, domestic abuse, bereavement, health/disability (same categories as existing plan)
- Detection is keyword + explicit confirmation, NOT keyword-only. Reduces false positives

### Payment Flow
- Tenant chooses payment method: Stripe (card/Apple Pay/Google Pay for one-off) OR GoCardless (direct debit). Send both options
- Payment links expire after 30 days
- CRM task created for property manager on every payment commitment ("Check payment from [tenant] due [date]") PLUS logged in arrears audit trail
- Auto-reconcile on payment received: Stripe/GoCardless webhook triggers automatic arrears clearance, no human confirmation needed
- Partial payment: acknowledge and continue chasing remainder ("Thank you for your payment of £1,000. There's still £850 outstanding. When can you pay the rest?")
- GoCardless direct debit setup does NOT stop future arrears monitoring — DD could fail, so continue monitoring
- On payment received: auto-cancel all pending pg-boss contact jobs for that tenant AND send thank-you confirmation
- Broken commitment history tracked in audit trail for staff visibility but does not change agent tone

### Monitoring Dashboard
- All-agents dashboard (not arrears-only): covers sales, lettings, PM, admin, and arrears agent activity
- 4-tab layout as planned: Conversations, Escalations, Metrics, Audit Log
- Filterable by channel, agent type, and date range (per success criteria)
- Auto-refresh every 15 minutes (not real-time, not 30s)
- Access restricted to managers only (manager/admin role or appropriate security clearance level)
- Conversation thread viewer shows merged timeline of messages + tool calls + audit entries

### Claude's Discretion
- Exact vulnerability keyword regex patterns
- Dashboard responsive layout breakpoints
- Exact voicemail script wording beyond the template given
- Arrears reminder message wording beyond the empathy-first constraint
- pg-boss queue naming and retry strategies
- Stripe Payment Link configuration details (after_completion redirect URL, etc.)
- GoCardless payment collection API specifics

</decisions>

<specifics>
## Specific Ideas

- "Chris from Accounts" — dedicated identity separate from the PM specialist who handles maintenance
- The agent should feel like a competent, empathetic accounts person — not a debt collector
- Empathy-first doesn't mean weak — the agent is clear about amounts, dates, and consequences
- Payment links always via WhatsApp + email gives the tenant no excuse for "I didn't get the link"
- Per-tenant limits prevent a landlord with multiple properties from overwhelming a tenant with contacts

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `arrears` table (shared/schema.ts): Already has tenantId, propertyId, amount, daysOverdue, dunningLevel 1-5, lastReminderSent, nextReminderDue
- `dunningActions` table: arrearsId, actionType (email/sms/phone_call/letter), channel, status, response, notes
- `agentAuditLog` table: Full audit trail infrastructure from Phase 1
- `schedulerService.ts`: Already detects arrears daily (overdue invoices → creates arrears records)
- `EscalationService` (server/agents/services/escalationService.ts): From Phase 2, handles human handoff
- `MessageSender` (server/agents/services/messageSender.ts): Multi-channel send from Phase 2
- `ChannelGateway` + adapters: WhatsApp/SMS/email/voice from Phases 2-3
- `pg-boss`: Already in use for scheduled messages and follow-ups (5 files)
- `paymentService.ts`: Stripe integration exists
- `gocardlessService.ts`: GoCardless integration exists
- `reconciliationEngine.ts`: Already clears arrears on payment (arrearsCleared flag)
- `storage.ts`: Has createArrears, getActiveArrears, getArrearsByTenant, filterArrears, updateArrears methods
- `PMTrackingDashboard.tsx`: Reference for dashboard page pattern with tabs, tables, filters

### Established Patterns
- OpenAI Agents SDK with zod4 alias for tool schemas (Phase 2 pattern)
- Lazy pg-boss init in tool definitions (Phase 2-4 pattern)
- Webhooks return 200 immediately, process async (Phase 2 pattern)
- Agent registration in SupervisorAgent for routing
- Raw SQL for complex aggregation queries (pmWorkflowRoutes pattern)

### Integration Points
- Vapi outbound calling for arrears (new — existing infrastructure handles inbound only)
- Stripe Payment Links API (new — existing integration handles payment intents)
- GoCardless payment collection against existing mandates (new path)
- Dashboard route at /crm/agent-monitoring → App.tsx (BEFORE /crm catch-all per wouter rules)
- Sidebar link in CRMLayout.tsx PM section

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-arrears-monitoring*
*Context gathered: 2026-03-23*
