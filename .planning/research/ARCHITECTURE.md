# Architecture Patterns

**Domain:** Multi-specialist AI agent system for estate agency CRM
**Researched:** 2026-03-19

## Recommended Architecture

### High-Level Overview

The system follows a **Supervisor-Specialist** pattern with a **Channel Gateway** that normalises all inbound communications into a unified message format before routing to the agent layer. The existing codebase already has this skeleton (`AgentOrchestrator` -> `SupervisorAgent` -> specialist agents), but it needs three critical additions: (1) a real Channel Gateway connecting to live communication providers, (2) a Conversation Store that threads context across channels, and (3) a Tool Registry that gives agents the ability to take real CRM actions rather than just returning JSON decisions.

```
                                 INBOUND
                                   |
           +-------+-------+------+------+-------+
           |       |       |      |      |       |
        Twilio   Twilio  Twilio  SMTP  WhatsApp  Web
        Voice    SMS     (WA)   /IMAP  Business  Chat
           |       |       |      |      |       |
           +-------+-------+------+------+-------+
                           |
                   CHANNEL GATEWAY
                   (Normalises to IncomingMessage)
                           |
                   CONVERSATION STORE
                   (Thread lookup / create)
                           |
                   SUPERVISOR AGENT
                   (Intent classification + routing)
                           |
           +-------+-------+-------+-------+
           |       |       |       |       |
        Sales   Lettings   PM    Admin   LeadGen
        Agent    Agent   Agent   Agent    Agent
           |       |       |       |       |
           +-------+-------+-------+-------+
                           |
                    TOOL REGISTRY
                    (CRM actions, knowledge base queries,
                     booking, messaging, document generation)
                           |
                   RESPONSE DISPATCHER
                   (Routes outbound to correct channel)
                           |
           +-------+-------+------+------+
           |       |       |      |      |
        Voice   SMS    WhatsApp  Email   Web
        (Vapi)  (Twilio) (Twilio) (SMTP)  Chat
```

### Component Boundaries

| Component | Responsibility | Communicates With | Build Phase |
|-----------|---------------|-------------------|-------------|
| **Channel Gateway** | Receives webhooks from Twilio (SMS/WhatsApp/Voice), IMAP/SMTP, web chat. Normalises into `IncomingMessage` format. Identifies returning contacts by phone/email. | Conversation Store, Supervisor | Phase 1 |
| **Voice Provider Adapter** | Manages Vapi AI voice sessions. Handles tool-call webhooks from Vapi during live calls. Translates voice events into agent-compatible format. | Channel Gateway, Tool Registry | Phase 2 |
| **Conversation Store** | PostgreSQL-backed thread storage. Links messages across channels by contact identity. Provides conversation history to agents. Maintains per-contact memory. | All agents (read), Channel Gateway (write) | Phase 1 |
| **Supervisor Agent** | Classifies intent from normalised messages. Routes to the correct specialist. Handles re-routing on escalation. Exists already but needs real tool-calling and knowledge base access. | All specialist agents, Tool Registry | Phase 1 |
| **Specialist Agents** (Sales, Lettings, PM, Admin, LeadGen) | Domain-specific decision-making. Each has its own system prompt, tool access permissions, and escalation rules. Existing scaffolds need real tool bindings. | Tool Registry, Conversation Store, Supervisor (escalation) | Phase 2-3 |
| **Tool Registry** | Centralised registry of CRM actions agents can invoke. Each tool is a function with typed input/output. Tools include: search properties, book viewing, create lead, create maintenance ticket, send message, generate document, query knowledge base. | Database (Drizzle ORM), external services (DocuSign, Stripe) | Phase 1-2 |
| **Property Knowledge Base** | Per-property structured data: work history, systems inventory, certifications, expiry dates, contractor history. Queryable by agents during conversations. | Tool Registry (read), PM Agent (primary consumer) | Phase 1 |
| **Response Dispatcher** | Takes agent output (text response + actions taken) and sends via the correct channel. Handles SMS character limits, WhatsApp template requirements, email formatting. Logs all outbound in Conversation Store. | Channel Gateway (outbound), Conversation Store | Phase 1 |
| **Audit Logger** | Records every agent decision, tool invocation, and escalation. Immutable log for compliance. CRM dashboard reads from this. | All components (write), CRM Dashboard (read) | Phase 1 |
| **Agent Dashboard** | React UI showing agent activity, conversation threads, escalation queue, performance metrics. Staff can view/override agent decisions. | Audit Logger, Conversation Store, Orchestrator API | Phase 3 |

### Data Flow

**Inbound message (SMS example):**

```
1. Twilio sends POST /api/webhooks/twilio/sms with From, Body, etc.
2. Channel Gateway:
   a. Validates webhook signature
   b. Looks up contact by phone number in CRM (leads, tenants, landlords)
   c. Creates IncomingMessage { channel: 'sms', from: '+447...', body: '...', contactId: 42 }
3. Conversation Store:
   a. Finds or creates conversation thread for this contact
   b. Appends message to thread
   c. Loads last N messages as conversation history
4. Supervisor Agent:
   a. Receives IncomingMessage + conversation history
   b. Calls OpenAI with classification prompt
   c. Returns: { assignTo: 'maintenance', messageType: 'maintenance_request', priority: 'high' }
5. PM/Maintenance Agent:
   a. Receives task with full context
   b. Calls OpenAI with specialist prompt + conversation history + property knowledge base context
   c. OpenAI returns structured decision with tool calls:
      - tool: 'create_maintenance_ticket' { propertyId: 5, description: '...', priority: 'high' }
      - tool: 'send_message' { channel: 'sms', body: 'We have logged your repair...' }
6. Tool Registry:
   a. Executes create_maintenance_ticket -> inserts into DB
   b. Executes send_message -> passes to Response Dispatcher
7. Response Dispatcher:
   a. Sends SMS via Twilio
   b. Logs outbound message in Conversation Store
8. Audit Logger:
   a. Records: agent decision, tools invoked, outcome, duration
```

**Inbound voice call (Vapi):**

```
1. Twilio receives call -> forwards to Vapi via SIP/webhook
2. Vapi manages the real-time voice conversation using its own LLM
3. During conversation, Vapi calls tool webhooks on our Express server:
   a. POST /api/webhooks/vapi/tool-call { function: 'search_properties', args: {...} }
   b. Our server executes the CRM query and returns results
   c. Vapi speaks the results to the caller
4. On call end, Vapi sends POST /api/webhooks/vapi/call-end with transcript
5. Channel Gateway processes the transcript as a completed conversation:
   a. Creates/updates contact
   b. Logs full conversation in Conversation Store
   c. Creates follow-up tasks via Supervisor if needed
```

### Why This Architecture (Not Alternatives)

**Why Supervisor-Specialist (not flat routing):**
The existing codebase already implements this pattern. A supervisor that classifies intent before routing is simpler to debug than letting each agent self-select. It also provides a single point for logging and re-routing on failure.

**Why Vapi for voice (not building on Retell or raw OpenAI Realtime):**
- Vapi has an Express.js starter and webhook-based tool calling that fits the existing server architecture
- Vapi supports Twilio as a phone provider, which JB_CRM already uses
- Vapi handles the hard parts (speech-to-text, text-to-speech, interruption handling, turn-taking) while exposing tool calls as simple HTTP webhooks
- OpenAI Agents SDK has voice support (WebRTC/SIP) but requires managing audio streams directly -- too much infrastructure for this project
- Retell AI is also viable but Vapi's developer-first approach and Express.js compatibility make it the better fit for this codebase
- **Confidence: MEDIUM** -- voice provider choice needs hands-on testing with UK phone numbers before committing

**Why OpenAI function calling for text agents (not OpenAI Agents SDK):**
- The existing agents already use `openai.chat.completions.create` with JSON mode
- OpenAI Agents SDK (TypeScript) adds handoffs, guardrails, and tracing but requires adopting a new framework
- For text channels (SMS, WhatsApp, email), the current pattern of direct OpenAI API calls with function calling is simpler and already proven in this codebase
- The Agents SDK handoff pattern is worth adopting later if agent complexity grows, but for initial production: keep it simple
- **Confidence: HIGH** -- direct function calling is well-documented, stable, and the codebase already uses it

**Why PostgreSQL for conversation store (not Redis or external service):**
- Already have PostgreSQL via Supabase
- Conversations need to persist for compliance (GDPR, audit trail)
- No need for sub-millisecond latency on conversation lookups
- Keeps the stack simple -- one database to manage
- **Confidence: HIGH**

## Patterns to Follow

### Pattern 1: Tool Registry with Typed Functions

**What:** Centralised registry where each CRM action is a typed function that agents can invoke. Tools are registered at startup and referenced by name in agent prompts.

**When:** Every agent needs to take real actions (not just return text).

**Why:** The existing agents return JSON decisions but nobody executes them. The `executeDecision` method in `BaseAgent` has stub implementations that return the decision data without actually performing CRM operations. A Tool Registry solves this by making each action a real, executable function.

**Example:**
```typescript
// server/agents/tools/registry.ts
interface Tool<TInput, TOutput> {
  name: string;
  description: string;  // Used in OpenAI function schema
  parameters: JSONSchema;  // OpenAI function calling schema
  permissions: AgentType[];  // Which agents can use this tool
  execute: (input: TInput, context: ToolContext) => Promise<TOutput>;
}

const toolRegistry = new Map<string, Tool<any, any>>();

// Register a tool
toolRegistry.set('search_properties', {
  name: 'search_properties',
  description: 'Search for available properties by area, bedrooms, price range',
  parameters: {
    type: 'object',
    properties: {
      area: { type: 'string', description: 'Postcode or area name' },
      minBedrooms: { type: 'number' },
      maxPrice: { type: 'number' },
      listingType: { type: 'string', enum: ['sale', 'rental'] }
    }
  },
  permissions: ['sales', 'rental', 'supervisor', 'lead_gen_sales', 'lead_gen_rentals'],
  execute: async (input, context) => {
    // Real database query using Drizzle ORM
    const results = await db.select().from(properties)
      .where(and(
        like(properties.postcode, `${input.area}%`),
        gte(properties.bedrooms, input.minBedrooms || 0),
        lte(properties.price, input.maxPrice || 999999999),
        input.listingType === 'rental'
          ? eq(properties.isListedRental, true)
          : eq(properties.isListedSale, true)
      ))
      .limit(5);
    return results;
  }
});
```

### Pattern 2: Channel-Agnostic Message Processing

**What:** All channels are normalised to `IncomingMessage` at the gateway level. Agents never know or care which channel the message came from. Response formatting is handled by the Response Dispatcher.

**When:** Always. This is the foundation of multi-channel support.

**Example:**
```typescript
// server/agents/channels/gateway.ts
class ChannelGateway {
  async processWebhook(channel: CommunicationChannel, rawPayload: any): Promise<IncomingMessage> {
    const adapter = this.adapters.get(channel);
    if (!adapter) throw new Error(`No adapter for channel: ${channel}`);

    // Normalise to IncomingMessage
    const message = adapter.normalise(rawPayload);

    // Identify contact
    message.contactId = await this.identifyContact(message.from, channel);

    // Thread into conversation
    message.conversationId = await this.conversationStore.threadMessage(message);

    return message;
  }
}
```

### Pattern 3: Conversation Threading by Contact Identity

**What:** Messages from the same person across different channels are linked into a single conversation thread, identified by phone number or email address.

**When:** A tenant texts about a boiler issue, then calls about the same issue. The agent needs both interactions.

**Example:**
```typescript
// Conversation store schema additions
// conversations table: id, contact_id, status, created_at, updated_at, last_channel
// conversation_messages table: id, conversation_id, channel, direction, body,
//   agent_type, tool_calls, created_at
// contact_identities table: id, contact_id, identifier_type (phone/email),
//   identifier_value, verified
```

### Pattern 4: Agent Tool Permissions

**What:** Each agent type has an explicit allowlist of tools it can invoke. The Sales Agent can search properties and book viewings but cannot create maintenance tickets. The PM Agent can create maintenance tickets and dispatch contractors but cannot process offers.

**When:** Always. Prevents agents from taking actions outside their domain.

**Why:** Without permissions, a misclassified message could lead to a sales agent creating maintenance tickets, or a PM agent booking viewings.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Agents Deciding Without Acting

**What:** The current pattern where agents return a JSON `AgentDecision` with `action: 'respond'` and `suggestedResponse: '...'` but nobody actually sends the response.

**Why bad:** Every decision requires a human or another system to execute it. The whole point of autonomous agents is end-to-end execution.

**Instead:** Use the Tool Registry pattern. Agents call tools that actually execute actions. The `suggestedResponse` becomes a `send_message` tool call that the Tool Registry executes via the Response Dispatcher.

### Anti-Pattern 2: Polling-Based Task Queue

**What:** The current `AgentOrchestrator` processes tasks via `setInterval` every 2 seconds, polling the queue.

**Why bad:** Adds 0-2 second latency to every message. For SMS/email this is tolerable. For voice or WhatsApp where users expect instant responses, it is unacceptable.

**Instead:** Process messages synchronously on webhook receipt. The webhook handler should: normalise -> thread -> classify -> route -> execute -> respond, all in a single request/response cycle. Only use the queue for deferred tasks (follow-ups, scheduled actions).

### Anti-Pattern 3: In-Memory State for Conversations

**What:** The current agents store activities in `this.activities` array in memory. The orchestrator stores tasks in `Map<string, AgentTask>`.

**Why bad:** Server restart loses all conversation context and task state. No audit trail. Cannot scale horizontally.

**Instead:** All conversation state, task state, and agent activities go into PostgreSQL. The in-memory structures become caches at most.

### Anti-Pattern 4: Single LLM Call for Classification + Response

**What:** Having the supervisor classify intent AND generate a response in one call, then passing to a specialist who generates another response.

**Why bad:** Double LLM calls, inconsistent responses, and wasted tokens.

**Instead:** Supervisor does classification only (fast, low-token call with `temperature: 0.1`). Specialist does the actual response generation with full context and tool calling.

### Anti-Pattern 5: Voice Agent as Separate System

**What:** Running voice (Vapi) and text agents (internal) as two completely separate systems with no shared context.

**Why bad:** A caller who previously texted about a property gets no continuity on the phone. Two separate knowledge bases, two separate conversation histories.

**Instead:** Voice call transcripts and text messages share the same Conversation Store. Vapi tool calls hit the same Tool Registry. When a voice call ends, the transcript feeds into the same conversation thread.

## Scalability Considerations

| Concern | At 10 calls/day | At 100 calls/day | At 1000 calls/day |
|---------|-----------------|-------------------|---------------------|
| **Voice costs** | ~$5/day (Vapi) | ~$50/day | ~$500/day -- review pricing tiers |
| **LLM costs** | ~$2/day (GPT-4o-mini for classification, GPT-4o for specialist responses) | ~$15/day | ~$100/day -- consider caching common responses |
| **Database load** | Negligible | Negligible | Index conversation_messages on contact_id, created_at |
| **Webhook throughput** | Single Express instance | Single Express instance | Consider separating webhook handling into worker process |
| **Conversation context** | Load full history | Load last 20 messages | Load last 10 messages + summary of older |

## Voice Provider Integration Detail

### Vapi Architecture for this Project

```
Twilio Phone Number
    |
    | (SIP trunk or webhook forwarding)
    v
Vapi Cloud (manages the voice conversation)
    |
    | Tool call webhooks (HTTP POST)
    v
Express Server: POST /api/webhooks/vapi/tool-call
    |
    | Executes CRM actions via Tool Registry
    |
    v
Returns result to Vapi -> Vapi speaks it to caller
```

**Key integration points:**

1. **Twilio -> Vapi:** Configure Twilio phone number to forward calls to Vapi via SIP or webhook. Vapi provides the SIP URI.
2. **Vapi -> Express:** Vapi calls your webhook URL when the voice agent needs to execute a function (search properties, book viewing, etc.). Your Express server handles these as standard HTTP endpoints.
3. **Vapi -> Express (call lifecycle):** Vapi sends webhooks for call start, call end, and transcript events. Use these to create/update conversation records.
4. **Tools shared between voice and text:** The same Tool Registry serves both Vapi tool calls and text-based agent tool calls. This ensures consistent behavior regardless of channel.

### Voice-Specific Considerations

- **Latency:** Tool call responses must complete within 5 seconds or Vapi will time out and use a fallback response. Database queries through Drizzle ORM are fast enough. External API calls (DocuSign, Stripe) need async handling.
- **Concurrent calls:** Vapi handles concurrent voice sessions. Our webhook server needs to be stateless (no in-memory session data) to handle concurrent tool calls.
- **UK phone numbers:** Both Twilio and Vapi support UK numbers. Purchase via Twilio (already integrated) and connect to Vapi.
- **Voice personality:** Configure per-specialist voice and personality in Vapi. The Sales Agent might use a different voice than the PM Agent. Vapi supports dynamic agent switching during a call via the `transferCall` function.

## Database Schema Additions

The following new tables are needed to support the architecture:

```sql
-- Conversation threading
conversations (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER,  -- FK to leads, tenant, or landlords
  contact_type TEXT,    -- 'lead', 'tenant', 'landlord', 'unknown'
  status TEXT DEFAULT 'active',  -- active, resolved, escalated
  assigned_agent_type TEXT,
  last_channel TEXT,
  last_message_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual messages in a conversation
conversation_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id),
  channel TEXT NOT NULL,  -- sms, whatsapp, email, phone, web_chat
  direction TEXT NOT NULL,  -- inbound, outbound
  body TEXT,
  from_identifier TEXT,
  to_identifier TEXT,
  agent_type TEXT,  -- which agent handled this
  tool_calls JSONB,  -- tools invoked during this message
  metadata JSONB,  -- channel-specific data (call duration, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Contact identity resolution
contact_identities (
  id SERIAL PRIMARY KEY,
  contact_id INTEGER,
  contact_type TEXT,  -- 'lead', 'tenant', 'landlord'
  identifier_type TEXT,  -- 'phone', 'email'
  identifier_value TEXT,
  is_primary BOOLEAN DEFAULT false,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(identifier_type, identifier_value)
);

-- Agent activity audit log
agent_audit_log (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id),
  message_id INTEGER REFERENCES conversation_messages(id),
  agent_type TEXT NOT NULL,
  action TEXT NOT NULL,  -- classify, respond, tool_call, escalate, delegate
  tool_name TEXT,
  tool_input JSONB,
  tool_output JSONB,
  decision JSONB,
  confidence NUMERIC(3,2),
  duration_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Property knowledge base
property_knowledge_base (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  category TEXT NOT NULL,  -- 'heating', 'plumbing', 'electrical', 'gas',
                           -- 'certification', 'work_history', 'systems'
  title TEXT NOT NULL,
  description TEXT,
  data JSONB,  -- structured data specific to category
  expiry_date DATE,  -- for certifications
  contractor_id INTEGER,  -- who did the work / holds the cert
  document_id INTEGER REFERENCES document(id),  -- linked document
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Suggested Build Order

The dependency graph dictates this build sequence:

```
Phase 1: Foundation (no external provider dependencies)
  1. Conversation Store (DB tables + Drizzle schema)
  2. Contact Identity Resolution (lookup by phone/email)
  3. Tool Registry (framework + first 5 tools: search_properties,
     book_viewing, create_lead, create_maintenance_ticket, query_knowledge_base)
  4. Property Knowledge Base (DB tables + CRUD API + seed data)
  5. Audit Logger
  6. Channel Gateway (SMS + WhatsApp adapters using existing Twilio)
  7. Response Dispatcher (SMS + WhatsApp + Email outbound)

Phase 2: Agent Intelligence (requires Phase 1 tools + store)
  1. Refactor SupervisorAgent to use real classification with tool calling
  2. Build out SalesAgent with tool bindings (search, book viewing, create lead)
  3. Build out MaintenanceAgent with tool bindings (create ticket, query KB, dispatch)
  4. Build out LettingsAgent (mirrors Sales but for rentals)
  5. Build out AdminAgent (document generation, onboarding workflows)
  6. Wire agents to Channel Gateway -> process synchronously on webhook

Phase 3: Voice (requires Phase 2 agents + tools)
  1. Set up Vapi account and configure UK phone number
  2. Build Vapi webhook endpoints for tool calling
  3. Connect Vapi tools to same Tool Registry
  4. Configure voice personalities per specialist
  5. Implement call lifecycle webhooks (start, end, transcript)
  6. Thread voice transcripts into Conversation Store

Phase 4: Dashboard & Polish
  1. Agent activity dashboard (React)
  2. Conversation thread viewer
  3. Escalation queue for human review
  4. Performance metrics and cost tracking
```

**Phase ordering rationale:**
- Phase 1 must come first because agents cannot act without tools, and tools need the database schema
- Phase 2 depends on Phase 1's Tool Registry and Conversation Store
- Phase 3 (voice) depends on Phase 2 because Vapi tool calls need working agents behind them
- Phase 4 is independent UI work that can start during Phase 3

## Sources

- [OpenAI Agents SDK TypeScript](https://openai.github.io/openai-agents-js/) - Multi-agent framework with handoffs, voice support (WebRTC/SIP/WebSocket), TypeScript-first
- [Vapi AI Tools Documentation](https://docs.vapi.ai/tools) - Custom tools, code tools, webhook integration patterns
- [Vapi Express Starter](https://github.com/VapiAI/vapi-express-starter) - Express.js boilerplate for Vapi webhooks
- [Retell AI vs Vapi comparison](https://www.retellai.com/comparisons/retell-vs-vapi) - Pricing, features, latency comparison
- [Softcery Voice Platform Comparison](https://softcery.com/lab/choosing-the-right-voice-agent-platform-in-2025) - 11 platforms compared (Vapi, Retell, Bland, ElevenLabs, etc.)
- [OpenAI Function Calling](https://platform.openai.com/docs/guides/function-calling) - Core pattern for agent tool use
- [Plura Unified Inbox](https://www.plura.ai/unified-ai-inbox) - Reference architecture for multi-channel conversation threading
- [Multi-Agent Architecture Guide](https://collabnix.com/multi-agent-and-multi-llm-architecture-complete-guide-for-2025/) - Patterns for coordinator + specialist agents
- Existing codebase: `server/agents/` (BaseAgent, SupervisorAgent, AgentOrchestrator, specialist stubs)
- Existing codebase: `server/voiceAgentService.ts` (Retell AI scaffold with Twilio integration)
- Existing codebase: `server/smsService.ts`, `server/whatsappService.ts` (Twilio SMS/WhatsApp integrations)
