# Phase 3: Voice Integration - Research

**Researched:** 2026-03-20
**Status:** Complete
**Requirements:** VOICE-01, VOICE-02, VOICE-03, VOICE-04

---

## Executive Summary

Phase 3 adds inbound voice AI via Vapi, building on the proven text-channel agent infrastructure from Phases 1-2. The key insight is that Vapi handles the entire speech pipeline (STT, LLM orchestration, TTS) externally, so the JB CRM server's role is limited to: (1) receiving webhook events, (2) executing tool calls against the existing Tool Registry, and (3) storing call transcripts. The existing ChannelGateway, ContactResolver, ConversationStore, ToolRegistry, EscalationService, and MessageSender are all reusable with minimal adaptation.

---

## Validation Architecture

### Test Strategy

| Behaviour | Requirement | Test Type | Approach |
|-----------|-------------|-----------|----------|
| Vapi Squad config generation | VOICE-01, VOICE-02 | Unit | Validate JSON structure against Vapi API schema |
| Tool-call webhook parsing | VOICE-03 | Unit | Mock Vapi webhook payloads, verify Tool Registry invocation + response format |
| Tool-call response format | VOICE-03 | Unit | Verify `{ results: [{ toolCallId, result }] }` format |
| Contact resolution from phone | VOICE-01 | Unit | Existing ContactResolver tests cover phone resolution |
| Transcript threading | VOICE-01 | Unit | Mock end-of-call-report, verify ConversationStore insertion |
| Call transfer (human escalation) | VOICE-04 | Unit | Verify transferCall tool config with correct destination numbers |
| Filler speech config | VOICE-03 | Unit | Validate assistant config includes correct backchannelEnabled and fillerInjection settings |
| HMAC webhook authentication | All | Unit | Verify signature validation logic |

### Framework
- **Vitest** (already installed and configured from Phase 1)
- Test dir: `tests/voice/`
- Quick run: `npx vitest run tests/voice/`

---

## Vapi Platform Architecture

### How Vapi Works

Vapi is a hosted voice AI platform. The speech pipeline runs entirely on Vapi's infrastructure:

```
Caller -> Twilio (SIP forward) -> Vapi
  Vapi: STT -> LLM (GPT-4o) -> TTS -> audio back to caller
  Vapi: When tool call needed -> POST to your server URL -> response back
  Vapi: On call end -> POST end-of-call-report to your server URL
```

**JB CRM does NOT run the LLM, STT, or TTS.** Vapi handles all of that. The CRM server is a webhook receiver that:
1. Responds to tool-call requests (search properties, book viewings, etc.)
2. Processes end-of-call reports (store transcripts, trigger follow-ups)
3. Handles call lifecycle events (start, end, transfer)

### What We Configure via Vapi API

1. **Assistants** - Each with instructions, model, voice, tools, and a server URL pointing back to our Express server
2. **Squad** - Groups assistants (receptionist + specialists) with handoff rules
3. **Phone Number** - Associates a Twilio number with the squad

---

## Vapi Squads: Receptionist-to-Specialist Routing

### Squad Structure for JB CRM

```json
{
  "name": "John Barclay Estate Agents",
  "members": [
    {
      "assistant": { /* Sarah - Receptionist */ },
      "assistantDestinations": [
        {
          "type": "assistant",
          "assistantName": "Sales Specialist",
          "message": "I'm connecting you with Alex from our Sales team.",
          "description": "Transfer when caller intent is property purchase, sale viewing, offer, or price enquiry"
        },
        {
          "type": "assistant",
          "assistantName": "Lettings Specialist",
          "message": "I'm connecting you with Jordan from our Lettings team.",
          "description": "Transfer when caller intent is rental enquiry, rental viewing, or tenant application"
        },
        {
          "type": "assistant",
          "assistantName": "Admin Specialist",
          "message": "I'm connecting you with Sam from our Admin team.",
          "description": "Transfer when caller intent is documents, onboarding, offboarding, or tenancy paperwork"
        }
      ]
    },
    { "assistant": { /* Alex - Sales */ } },
    { "assistant": { /* Jordan - Lettings */ } },
    { "assistant": { /* Sam - Admin */ } }
  ]
}
```

### Key Squad Behaviours
- First member (Sarah) answers all calls
- Handoffs use Vapi's native `transferAssistant` mechanism (not our Phase 2 SDK handoff)
- Each assistant has its own `serverUrl` pointing to the same Express endpoint
- Conversation context transfers automatically between assistants in the squad
- `contextEngineeringPlan` can control what history transfers

---

## Twilio SIP Forwarding to Vapi

### Architecture

```
UK Phone Number (Twilio)
  -> Twilio SIP Trunk (Origination URI: sip:NUMBER@CREDENTIAL.sip.vapi.ai)
  -> Vapi receives call
  -> Vapi routes to Squad
```

### Configuration Steps

1. **Create Vapi Phone Number** via API, importing the existing Twilio number
2. **Create Twilio SIP Trunk** with origination URI pointing to Vapi
3. **Associate Twilio Number** with the SIP trunk
4. **Configure Vapi** to associate the phone number with the Squad

### Twilio SIP Trunk Settings
- **Origination URI:** `sip:{TWILIO_PHONE_NUMBER}@{VAPI_CREDENTIAL_ID}.sip.vapi.ai`
- **Vapi SIP IPs for outbound (whitelisting):** `44.229.228.186`, `44.238.177.138`
- **Codec:** G.711 (Twilio default, Vapi compatible)

### Existing Code Impact
- `server/routes.ts` lines 209-252: Current Twilio voice webhooks (`/api/voice/inbound`, `/api/voice/process-speech`, `/api/voice/status`) become **dead code** -- calls go to Vapi, not to Express TwiML
- `server/voiceAgentService.ts`: Entirely replaced (was Retell-based scaffold)
- `server/aiPhoneService.ts`: Entirely replaced (was TwiML-based scaffold)

---

## Tool-Call Webhook Endpoints

### How Vapi Tool Calls Work

When a Vapi assistant needs to call a tool during a live call:

1. Vapi sends POST to the assistant's `serverUrl` with message type `tool-calls`
2. Request body includes: `{ message: { type: "tool-calls", toolCallList: [...] } }`
3. Each tool call has: `{ id: "call_xxx", type: "function", function: { name: "search_properties", arguments: "{...}" } }`
4. Server must respond with: `{ results: [{ toolCallId: "call_xxx", result: "string" }] }`
5. **Both `result` and `error` MUST be strings** -- Vapi does not accept objects
6. **Always return HTTP 200** -- any other status code is ignored by Vapi

### Mapping to Existing Tool Registry

The existing `ToolRegistry` (Phase 1) already has all the tools we need:
- `search_properties` -- property search by area, type, bedrooms, price
- `book_viewing` -- book a viewing appointment
- `create_lead` -- create a CRM lead record
- `create_maintenance_ticket` -- create a maintenance request
- `query_knowledge_base` -- search property knowledge base

The webhook handler bridges Vapi's tool-call format to the ToolRegistry:

```
Vapi POST -> Parse tool-calls -> For each: toolRegistry.invoke(name, args, context) -> Format response -> Return { results: [...] }
```

### Pre-Call Context Loading

When Vapi sends a `call-start` or `assistant-request` event, the server can load context for known callers:

1. Extract caller phone number from the webhook payload
2. Use `ContactResolver.resolve(phone, 'phone')` to identify the caller
3. Load recent conversation history from `ConversationStore`
4. Return context that Vapi injects into the assistant's system prompt

This enables: "Hello Mr. Smith, I see you enquired about the flat on Herne Hill last week. How can I help you today?"

---

## Call Lifecycle Handling

### Webhook Event Types We Handle

| Event | When | Our Action |
|-------|------|------------|
| `assistant-request` | Before call starts | Return dynamic assistant config (optional) |
| `tool-calls` | During call | Execute Tool Registry tools, return results |
| `end-of-call-report` | After call ends | Store transcript, trigger post-call actions |
| `hang` | Call disconnected | Log call end, handle cleanup |
| `transfer-destination-request` | Assistant requests transfer | Return dynamic transfer destination |

### Transcript Threading

On `end-of-call-report`:

1. Extract `artifact.messages` array (full conversation transcript)
2. Resolve caller identity via `ContactResolver.resolve(callerPhone, 'phone')`
3. Create/update conversation via `ConversationStore.findOrCreateConversation(contact, 'phone')`
4. Store each transcript message via `ConversationStore.storeMessage()`
5. Log call metadata to `agentAuditLog` via `AuditLogger`

The transcript is stored as a series of messages (role: user/assistant) in the existing `messages` table, threaded under a conversation -- identical pattern to text channels.

### Post-Call Actions

After transcript storage:
1. **SMS/WhatsApp summary** -- Send caller a text summary of what was discussed/actioned (via `MessageSender.sendPreferred()`)
2. **Follow-up scheduling** -- If a viewing was booked or lead created, schedule follow-up via pg-boss (same `handlePostActions` from Phase 2)
3. **Escalation notification** -- If call was transferred to human, log the escalation

---

## Human Escalation (Call Transfer)

### Vapi transferCall Tool

Vapi has a built-in `transferCall` tool type. Configuration:

```json
{
  "type": "transferCall",
  "destinations": [
    {
      "type": "number",
      "number": "+442071234567",
      "message": "I'm transferring you to a member of our team now. Please hold."
    },
    {
      "type": "sip",
      "sipUri": "sip:office@jbarclay.com",
      "message": "Connecting you to our office now."
    }
  ]
}
```

### When Transfer Triggers
- Caller explicitly says "speak to a human" / "real person" / "transfer me"
- Agent confidence drops below threshold (handled by assistant instructions)
- Complaint or negative sentiment detected
- Three unresolved exchanges

### Transfer Modes
- **Cold transfer** (default): Caller is transferred, Vapi disconnects
- **Warm transfer** (experimental): Vapi dials destination, places caller on hold, connects when answered

For JB CRM, cold transfer is sufficient -- the human agent gets the conversation context via the CRM escalation notification (same EscalationService from Phase 2).

---

## Filler Speech & Latency

### Vapi Native Features

Vapi provides built-in filler injection and backchanneling:

- **Filler injection**: Adds natural fillers ("um", "so") to make speech more human
- **Backchanneling**: AI says "right", "I see", "got it" at appropriate moments while user speaks
- **Custom first message**: The opening greeting is spoken immediately (no LLM delay)
- **Endpointing**: Configurable silence detection (default 0.4s) before AI responds

### Latency Optimization

Key configuration levers:
- **Model selection**: GPT-4o-mini for receptionist (faster), GPT-4o for specialists (better reasoning)
- **First message**: Pre-configured, no LLM call needed for greeting
- **Tool call messages**: Vapi supports `messages` on tools -- while waiting for tool result, Vapi can say "Let me just check that for you"
- **Max response tokens**: Lower for voice (150-200 tokens) vs text (500+)
- **Streaming**: Vapi streams TTS from partial LLM output (built-in, no config needed)

### Tool-Specific Filler

On each tool definition, add a `messages` array:
```json
{
  "type": "request-start",
  "content": "Let me just check that for you."
}
```

This plays immediately when the tool call starts, filling the gap while the CRM runs the query.

---

## Voice Configuration

### TTS Voice Selection

Per CONTEXT.md: "Warm British female voice -- neutral British accent, professional and friendly"

Vapi supports multiple TTS providers. Best options for British female:
- **ElevenLabs**: `rachel` or `charlotte` voices with British accent
- **Deepgram**: `aura-asteria-en` (female, neutral)
- **PlayHT**: Various British female options

Recommendation: ElevenLabs with a pre-made British female voice for quality, or Deepgram Aura for lower latency.

### Language Detection

Per CONTEXT.md: "Detect caller language and switch"

Vapi supports `transcriber.language` configuration. For multilingual:
- Set transcriber language to `multi` (if supported by chosen STT provider)
- Or configure the assistant to detect language from initial speech and respond accordingly
- Practical limitation: TTS voice stays the same, but response content switches language

---

## Security

### Webhook Authentication

Vapi supports server authentication via:
1. **Custom credentials** with `credentialId` reference
2. **HMAC signature** verification on webhook payloads
3. **Secret header** validation

Recommended: Use Vapi's server secret feature -- configure a secret in Vapi dashboard, verify `x-vapi-secret` header on every incoming webhook.

### Twilio Webhook Signature

The existing Twilio voice webhooks at `/api/voice/*` should be deprecated/removed once Vapi is handling calls. The new Vapi webhook endpoint needs its own authentication (not Twilio signature validation).

---

## Existing Code Reuse Matrix

| Component | Phase Built | Reuse in Phase 3 | Adaptation Needed |
|-----------|-------------|-------------------|-------------------|
| ToolRegistry | 1 | Direct | None -- Vapi tool calls bridge to same registry |
| ContactResolver | 1 | Direct | Already handles phone-based resolution |
| ConversationStore | 1 | Direct | Store transcript messages same as text |
| AuditLogger | 1 | Direct | Log voice agent actions |
| AIIdentification | 1 | Indirect | Voice greeting in Vapi config, not middleware |
| EscalationService | 2 | Direct | Voice escalation = call transfer + notification |
| MessageSender | 2 | Direct | Post-call SMS/WhatsApp summaries |
| pg-boss scheduler | 2 | Direct | Post-call follow-ups |
| supervisorAgent (SDK) | 2 | None | Vapi has its own supervisor (Squad first member) |
| salesAgent (SDK) | 2 | Instructions only | Vapi assistant uses same persona/rules, different runtime |
| lettingsAgent (SDK) | 2 | Instructions only | Same as above |
| adminAgent (SDK) | 2 | Instructions only | Same as above |

### Key Architectural Insight

The text-channel agents (Phase 2) run on OpenAI Agents SDK inside the Express server. Voice agents run on Vapi's infrastructure externally. The two systems share:
- **Same Tool Registry** (via webhook bridge)
- **Same ConversationStore** (transcripts stored in same tables)
- **Same ContactResolver** (phone-based identity)
- **Same EscalationService** (voice transfer + notification)

But they have **separate agent runtimes**: SDK agents for text, Vapi assistants for voice.

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `server/agents/channels/adapters/voiceAdapter.ts` | Normalise Vapi webhook payloads to NormalizedMessage |
| `server/agents/voice/vapiConfig.ts` | Vapi assistant and squad JSON configuration builders |
| `server/agents/voice/vapiWebhooks.ts` | Express routes for Vapi server URL webhook handling |
| `server/agents/voice/callLifecycle.ts` | End-of-call-report processing, transcript threading |
| `tests/voice/vapiWebhooks.test.ts` | Webhook handler tests |
| `tests/voice/vapiConfig.test.ts` | Config builder tests |
| `tests/voice/callLifecycle.test.ts` | Transcript threading tests |

### Modified Files
| File | Change |
|------|--------|
| `server/routes.ts` | Mount Vapi webhook routes, deprecate old TwiML routes |
| `server/agents/channels/gateway.ts` | Register voice adapter |
| `server/agents/types.ts` | Ensure 'phone' channel type exists (already does) |

### Deprecated Files (No Longer Used)
| File | Reason |
|------|--------|
| `server/voiceAgentService.ts` | Retell-based scaffold, replaced by Vapi |
| `server/aiPhoneService.ts` | TwiML-based scaffold, replaced by Vapi |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vapi tool call latency adds dead air | Medium | High | Filler speech on tool `messages`, fast DB queries (already <100ms) |
| Twilio SIP forwarding misconfiguration | Medium | High | Test with Vapi CLI local webhook testing first |
| Vapi costs escalate unexpectedly | Low | Medium | Set per-call max duration, monitor usage |
| Voice quality issues (accent, clarity) | Low | Medium | Test multiple TTS voices before production |
| Squad handoff feels unnatural | Medium | Medium | Use warm transition messages, test conversation flow |

---

## RESEARCH COMPLETE

All requirements (VOICE-01 through VOICE-04) have clear implementation paths. The existing Phase 1-2 infrastructure provides strong foundations. The primary new work is: Vapi configuration management, webhook bridge to Tool Registry, and transcript threading into ConversationStore.
