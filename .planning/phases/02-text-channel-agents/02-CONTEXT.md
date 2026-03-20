# Phase 2: Text-Channel Agents - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

The Supervisor, Sales, Lettings, and Admin specialist agents handle real inbound messages on WhatsApp, SMS, and email — routing correctly, answering property questions from live data, booking viewings, capturing leads, and managing onboarding/offboarding document checklists. Voice channel is Phase 3. Property Management specialist is Phase 4.

</domain>

<decisions>
## Implementation Decisions

### Agent Personality & Tone
- Professional-friendly tone — warm but proper, like a well-trained receptionist
- No emoji at all — pure text carries the warmth
- AI disclosure in opening message only: "I'm an AI assistant for John Barclay Estate Agents." Don't repeat in subsequent messages
- Named by department — Sales: "Alex from Sales", Lettings: "Jordan from Lettings", Admin: "Sam from Admin"
- Subtle transition message when Supervisor routes to specialist: "I'm connecting you with Alex from our Sales team who can help with viewings."
- SMS: concise, max 2 segments (~320 chars). WhatsApp: can be longer with full property details and links
- Email: HTML branded template — John Barclay logo, purple header, footer with office details
- 24/7 availability — agents respond immediately any time, no business hours restrictions
- British conventions throughout — £1,850 pcm, 1st April 2026, ground floor, en-suite, UK spelling (colour, centre, organised)
- Match contact's language — agent detects and responds in the same language. OpenAI handles this
- Proactively helpful — suggest related properties, cross-sell naturally ("We also have a 2-bed in the same area at £1,650 pcm")
- Handle multiple properties naturally in one conversation thread
- Stale data (30+ days old): give the data with a caveat ("As of our last update... recommend confirming with our team")

### Ambiguity & Routing
- When intent is ambiguous (buy vs rent), ask to clarify before routing to a specialist
- Supervisor handles clarification, then routes with a transition message

### Negotiation (SCOPE OVERRIDE)
- Agents have FULL negotiation autonomy — can negotiate prices based on market data, property history, and landlord/vendor preferences
- This overrides the PROJECT.md out-of-scope rule "Autonomous offer negotiation"
- No floor/ceiling restrictions on agent negotiation — agent uses judgment

### Escalation & Handoff
- Broad safety net triggers: confidence below threshold, contact asks for human, complaint detected, legal/financial question outside domain, 3+ unresolved back-and-forth, negative sentiment detected, topic outside agent's domain
- Immediate connection first — for text channels: CRM notification + direct message to assigned staff member. For calls: forward the call (Phase 3)
- Staff sees: summary alert with escalation reason + link to full conversation thread
- If assigned staff doesn't respond: round-robin to next available staff member
- Fallback only if no one available: "Our team will be in touch with you shortly"

### Confirmation & Follow-up
- Viewing booked: (1) immediate confirmation on same channel, (2) reminder 24h before viewing, (3) "See you today" message morning of viewing
- Always email a summary after significant actions (viewing booked, lead captured) — even if conversation was on WhatsApp/SMS. Creates paper trail
- Lead follow-up sequence: Day 1 thanks, Day 3 similar properties, Day 7 check-in. Stop unless re-engaged
- Channel preference: WhatsApp preferred, SMS fallback if WhatsApp undelivered
- STOP keyword support — contact replies "STOP" or "unsubscribe" and all AI outreach stops (UK PECR compliance)

### Onboarding/Offboarding Checklists
- Onboarding trigger: automatic when new tenancy created in CRM (status active/pending)
- Checklist items: configurable per property type. Base items always included (Right to Rent, deposit registration, tenancy agreement, key handover). Additional items auto-added based on property type (e.g. HMO gets fire safety items, managed vs unmanaged gets different lists)
- Auto-chase with staff visibility: Admin agent chases tenants/landlords directly via WhatsApp/email for outstanding items, logs every chase in CRM. Staff can override or pause chasing per item. Escalates to staff after 3 unsuccessful chases
- Offboarding trigger: tenancy status changed to "ending" or "notice served". Items: checkout inspection, deposit return, key return, utility final readings, forwarding address, inventory check

### Claude's Discretion
- Exact agent persona names (Alex, Jordan, Sam are suggestions — Claude can pick appropriate names)
- Loading/processing indicators ("typing..." delays)
- Exact confidence threshold for escalation
- Follow-up message wording
- Checklist item categorisation and ordering
- Email template design details beyond branding requirements

</decisions>

<specifics>
## Specific Ideas

- Agents should feel like competent estate agency staff, not generic chatbots
- Negotiation is a key differentiator — agents that can actually negotiate rather than just deflect
- Round-robin escalation ensures no message gets lost even if individual staff are unavailable
- The 3-stage viewing confirmation (immediate + 24h + morning-of) mirrors what good human agents do

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChannelGateway` (server/agents/channels/gateway.ts): Normalises inbound messages, resolves contacts, threads conversations. SMS + WhatsApp adapters built
- `ContactResolver` (server/agents/channels/contactResolver.ts): Cross-channel identity resolution already working
- `ConversationStore` (server/agents/channels/conversationStore.ts): Conversation threading across channels
- `ToolRegistry` (server/agents/tools/registry.ts): 5 tools registered (searchProperties, queryKnowledgeBase, createLead, createMaintenanceTicket, bookViewing). Zod-to-JSON-Schema converter for OpenAI function calling
- `AuditLogger` (server/agents/middleware/auditLogger.ts): All tool calls logged to database
- `AIIdentification` (server/agents/middleware/aiIdentification.ts): UK compliance disclosure middleware
- `SupervisorAgent` (server/agents/SupervisorAgent.ts): Agent registry, routing logic scaffolded
- `SalesAgent`, `RentalAgent`, `OfficeAdminAgent` (server/agents/specialists/): Class scaffolds with OpenAI invocation
- `WhatsAppService` (server/whatsappService.ts): Twilio-based WhatsApp sending, already functional
- `SmsService` (server/smsService.ts): Twilio SMS sending
- `EmailService` (server/emailService.ts): Nodemailer/SendGrid email sending
- `tenancyChecklistItems` table: Already exists in schema for checklist tracking

### Established Patterns
- BaseAgent abstract class: specialists override `handleTask()` and `getSystemPrompt()`
- Tool permissions: each tool defines which agent types can use it
- Raw SQL for complex queries (pmWorkflowRoutes pattern), Drizzle for typed CRUD
- Webhook routes mounted in server/routes.ts

### Integration Points
- Webhook routes for WhatsApp/SMS: `/api/webhooks/whatsapp`, `/api/webhooks/twilio/sms` — need to wire to ChannelGateway
- Email inbound: IMAP polling already running — needs routing to agent system
- CRM notification: no existing real-time notification system for staff — will need to build
- Scheduled messages (viewing reminders, follow-ups): no existing scheduler for this — schedulerService.ts handles daily cron but not per-message scheduling

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-text-channel-agents*
*Context gathered: 2026-03-20*
