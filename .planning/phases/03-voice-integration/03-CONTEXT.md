# Phase 3: Voice Integration - Context

**Gathered:** 2026-03-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Inbound calls answered 24/7 by a Vapi-powered voice AI receptionist that identifies itself as AI, routes callers to the correct specialist by intent, performs CRM tool calls during the call, and transfers to a human when escalation is needed. Reuses the same Tool Registry, specialist agents, Conversation Store, and escalation service from Phases 1-2. Text-channel decisions (tone, negotiation, escalation triggers, agent names, British conventions, language matching, follow-up sequences) all carry forward unchanged.

</domain>

<decisions>
## Implementation Decisions

### Voice Persona
- Warm British female voice — neutral British accent, professional and friendly
- Receptionist name: Sarah (matches existing aiPhoneService.ts persona)
- Specialists keep their text-channel names (Alex, Jordan, Sam) when handed off
- Detect caller language and switch — agent responds in caller's language (Vapi/provider TTS permitting)

### Live Call Experience
- Natural filler speech during CRM lookups: "Let me just check that for you" / "One moment while I look that up"
- Barge-in enabled: agent stops mid-sentence immediately when caller speaks (Vapi native)
- Property details: key highlights only (3-4 facts), then offer to go deeper or book viewing
- Opening greeting: "Good morning, John Barclay Estate Agents, this is Sarah, an AI assistant. How can I help you today?" (AI disclosure upfront, UK compliance)

### Unclear Speech Handling
- On first failure: "Sorry, I didn't quite catch that — could you repeat?"
- On second failure: "I'm having trouble hearing you clearly. Would you like me to send you a text so we can continue there?"
- Pivots to text channel (WhatsApp/SMS) if voice isn't working for the caller

### Claude's Discretion
- Exact Vapi Squad configuration details
- TTS voice model selection within "warm British female" constraint
- Filler speech variation and pacing
- Telephony failover behaviour (Vapi down)
- Office hours vs after-hours greeting variation
- Specialist handoff audio experience (transfer sound, voice change)
- Post-call transcript processing timing
- After-call WhatsApp/SMS summary content and triggers

</decisions>

<specifics>
## Specific Ideas

- All Phase 2 text-channel decisions carry forward to voice (tone, negotiation autonomy, escalation, British conventions, language matching, follow-up sequences, STOP keyword)
- Existing voiceAgentService.ts and aiPhoneService.ts are fully scaffolded/mocked — replacing, not extending
- Research decided Vapi with Squads for receptionist-to-specialist routing
- Existing Twilio numbers reused via SIP forwarding to Vapi

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChannelGateway` (server/agents/channels/gateway.ts): Normalises inbound messages — voice adapter needed
- `ContactResolver` (server/agents/channels/contactResolver.ts): Phone-based identity resolution already works
- `ConversationStore` (server/agents/channels/conversationStore.ts): Thread voice transcripts here
- `ToolRegistry` (server/agents/tools/registry.ts): Same 5+ tools used by voice agents
- `AuditLogger` (server/agents/middleware/auditLogger.ts): Log voice agent actions
- `AIIdentification` (server/agents/middleware/aiIdentification.ts): Voice greeting includes AI disclosure
- `EscalationService` (server/agents/services/escalationService.ts): Voice escalation = call transfer
- `MessageSender` (server/agents/services/messageSender.ts): Post-call confirmations
- `pg-boss` scheduler: Post-call follow-ups and reminders
- Specialist agents (Sales, Lettings, Admin): Same domain logic, voice just needs tool-call webhook bridge

### Established Patterns
- Webhook routes mounted in server/routes.ts
- Async processing: webhooks return 200 immediately, process asynchronously (Twilio pattern from Phase 2)
- Per-conversation locking via Map (Phase 2 pattern)

### Integration Points
- Twilio SIP forwarding → Vapi (new)
- Vapi tool-call webhooks → Express endpoints → Tool Registry (new)
- Call end → transcript → ConversationStore (new)
- Call end → post-call SMS/WhatsApp via MessageSender (new)
- `/api/voice/retell-webhook` exists — replace with Vapi webhook endpoint

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-voice-integration*
*Context gathered: 2026-03-20*
