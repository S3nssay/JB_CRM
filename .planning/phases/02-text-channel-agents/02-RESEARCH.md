# Phase 2: Text-Channel Agents - Research

**Researched:** 2026-03-20
**Domain:** Multi-agent AI orchestration (OpenAI Agents SDK), real-time messaging channels (WhatsApp/SMS/email), tenancy lifecycle automation
**Confidence:** HIGH

## Summary

Phase 2 transforms the existing agent scaffold into production agents that handle real inbound messages. The foundation from Phase 1 (ChannelGateway, ConversationStore, ContactResolver, ToolRegistry, AuditLogger) provides all the infrastructure plumbing. The primary technical challenge is replacing the current ad-hoc `openai.chat.completions.create` calls in BaseAgent/SupervisorAgent with the OpenAI Agents SDK (`@openai/agents`), which provides native handoff patterns, Zod-based tool definitions, and a Runner that manages the classify-route-execute loop automatically.

The existing codebase has working Twilio WhatsApp/SMS sending, Nodemailer email sending, and IMAP polling for inbound email. Webhook routes for WhatsApp and SMS exist but are not wired to the ChannelGateway. The critical gap is: (1) no email adapter for the ChannelGateway, (2) no scheduled message system for viewing reminders and follow-up sequences, (3) no CRM staff notification system for escalations, and (4) the existing BaseAgent class uses raw OpenAI chat completions rather than the Agents SDK.

**Primary recommendation:** Replace the existing BaseAgent/SupervisorAgent implementation with `@openai/agents` SDK Agents using the handoff pattern. Keep the existing ToolRegistry tools but wrap them as SDK `tool()` definitions. Wire webhook routes to ChannelGateway, which feeds the Supervisor agent's `run()` loop.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Professional-friendly tone -- warm but proper, like a well-trained receptionist
- No emoji at all -- pure text carries the warmth
- AI disclosure in opening message only: "I'm an AI assistant for John Barclay Estate Agents." Don't repeat in subsequent messages
- Named by department -- Sales: "Alex from Sales", Lettings: "Jordan from Lettings", Admin: "Sam from Admin"
- Subtle transition message when Supervisor routes to specialist: "I'm connecting you with Alex from our Sales team who can help with viewings."
- SMS: concise, max 2 segments (~320 chars). WhatsApp: can be longer with full property details and links
- Email: HTML branded template -- John Barclay logo, purple header, footer with office details
- 24/7 availability -- agents respond immediately any time, no business hours restrictions
- British conventions throughout
- Match contact's language -- agent detects and responds in the same language
- Proactively helpful -- suggest related properties, cross-sell naturally
- Handle multiple properties naturally in one conversation thread
- Stale data (30+ days old): give the data with a caveat
- When intent is ambiguous (buy vs rent), ask to clarify before routing to a specialist
- Agents have FULL negotiation autonomy -- can negotiate prices based on market data, property history, and landlord/vendor preferences (overrides PROJECT.md out-of-scope rule)
- No floor/ceiling restrictions on agent negotiation
- Broad safety net triggers: confidence below threshold, contact asks for human, complaint detected, legal/financial question outside domain, 3+ unresolved back-and-forth, negative sentiment detected, topic outside agent's domain
- Immediate connection first -- CRM notification + direct message to assigned staff member; round-robin if no response; fallback message if no one available
- Viewing booked: (1) immediate confirmation on same channel, (2) reminder 24h before viewing, (3) "See you today" message morning of viewing
- Always email a summary after significant actions even if conversation was on WhatsApp/SMS
- Lead follow-up sequence: Day 1 thanks, Day 3 similar properties, Day 7 check-in. Stop unless re-engaged
- Channel preference: WhatsApp preferred, SMS fallback if WhatsApp undelivered
- STOP keyword support -- UK PECR compliance
- Onboarding trigger: automatic when new tenancy created in CRM (status active/pending)
- Checklist items: configurable per property type with base items always included
- Auto-chase with staff visibility: Admin agent chases tenants/landlords via WhatsApp/email, logs every chase, escalates after 3 unsuccessful chases
- Offboarding trigger: tenancy status changed to "ending" or "notice served"

### Claude's Discretion
- Exact agent persona names (Alex, Jordan, Sam are suggestions -- Claude can pick appropriate names)
- Loading/processing indicators ("typing..." delays)
- Exact confidence threshold for escalation
- Follow-up message wording
- Checklist item categorisation and ordering
- Email template design details beyond branding requirements

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AGENT-01 | Supervisor agent detects caller intent and routes to correct specialist | OpenAI Agents SDK handoff pattern; Supervisor as triage agent with handoffs to Sales/Lettings/Admin |
| AGENT-03 | All agents can take actions in the CRM (create leads, book viewings, create work orders) | Existing ToolRegistry tools (book_viewing, create_lead, search_properties, etc.) wrapped as SDK tool() definitions |
| AGENT-07 | Clear escalation path to transfer to human staff when AI cannot handle a query | Confidence-gated escalation in agent instructions + escalation tool + CRM notification system |
| SALES-01 | Answers property sale enquiries using live CRM data | search_properties tool + query_knowledge_base tool provide live data; SDK agent formats responses |
| SALES-02 | Books viewings by checking agent availability and creating viewing appointments | book_viewing tool already implemented in Phase 1; SDK agent orchestrates conversation flow |
| SALES-03 | Captures buyer leads when viewings unavailable | create_lead tool with leadType 'purchase'; agent detects no availability and pivots to capture |
| SALES-04 | Follows up with interested buyers across channels | Scheduled message system (new) + WhatsApp/SMS/email sending services (existing) |
| LETT-01 | Answers rental property enquiries using live CRM data | Same tools as SALES-01 with rental filter; SDK agent formats with pcm pricing |
| LETT-02 | Books viewings by checking availability and creating viewing appointments | Same book_viewing tool; agent handles rental-specific conversation flow |
| LETT-03 | Captures tenant leads when viewings unavailable | create_lead tool with leadType 'rental' |
| LETT-04 | Follows up with prospective tenants across channels | Same scheduled message system as SALES-04 |
| ADMIN-01 | Generates onboarding document checklists for new tenancies | tenancyChecklistItems table + tenancyChecklistItemMeta already in schema; new tool to generate items |
| ADMIN-02 | Generates offboarding document checklists for ending tenancies | Same schema; filter by workflow 'end_of_tenancy' in tenancyChecklistItemMeta |
| ADMIN-03 | Tracks document completion status and chases outstanding items | Query checklist items by tenancy; chase via WhatsApp/email; log chases in audit log |
| CHAN-03 | Agent memory -- context from previous interactions injected into current conversation | ConversationStore.getConversationHistory() + inputFilter on handoff to inject last N messages |
| CHAN-04 | WhatsApp/SMS confirmations sent automatically after call actions | Post-action hook in agent execution flow; use existing WhatsApp/SMS services |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@openai/agents` | ^0.7.2 | Multi-agent orchestration, handoffs, tool calling | Official OpenAI SDK for agent workflows; native handoff pattern replaces custom routing; Zod-based tool definitions match existing ToolRegistry pattern |
| `openai` | ^4.104.0 | Already installed -- underlying LLM client | Required dependency of @openai/agents |
| `zod` | Already installed | Input/output validation for tools | Already used throughout ToolRegistry |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg-boss` | ^10.x | PostgreSQL-based job queue for scheduled messages | Viewing reminders (24h, morning-of), follow-up sequences (Day 1/3/7), checklist chasing. Uses existing PostgreSQL -- no new infra |
| `twilio` | Already installed | WhatsApp and SMS sending | All outbound WhatsApp/SMS messages |
| `nodemailer` | Already installed | Email sending | Email confirmations and branded HTML templates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pg-boss | BullMQ + Redis | BullMQ needs Redis -- new infrastructure; pg-boss uses existing PostgreSQL |
| pg-boss | node-cron + custom table | Simpler but no retry, no backpressure, no job deduplication |
| @openai/agents | Raw OpenAI chat completions (current) | Current approach works but requires manual handoff routing, tool loop, conversation management -- SDK handles all this natively |

**Installation:**
```bash
npm install @openai/agents pg-boss
```

## Architecture Patterns

### Recommended Project Structure
```
server/agents/
  sdk/                           # NEW: OpenAI Agents SDK wrappers
    supervisorAgent.ts           # Supervisor triage agent with handoffs
    salesAgent.ts                # Sales specialist agent
    lettingsAgent.ts             # Lettings specialist agent
    adminAgent.ts                # Admin specialist agent
    tools.ts                     # Wrap existing ToolRegistry tools as SDK tool() definitions
    context.ts                   # Typed context (AgentContext) for shared services
    runner.ts                    # Thin wrapper around run() with error handling and audit
  channels/
    gateway.ts                   # EXISTING -- add email adapter
    adapters/
      emailAdapter.ts            # NEW: Normalize inbound email to NormalizedMessage
    conversationStore.ts         # EXISTING
    contactResolver.ts           # EXISTING
  middleware/
    auditLogger.ts               # EXISTING
    aiIdentification.ts          # EXISTING
  services/
    messageSender.ts             # NEW: Unified outbound message dispatch (WhatsApp/SMS/email)
    scheduledMessages.ts         # NEW: pg-boss queue for follow-ups, reminders, chases
    escalationService.ts         # NEW: Staff notification, round-robin assignment
    checklistService.ts          # NEW: Onboarding/offboarding checklist generation and chasing
```

### Pattern 1: OpenAI Agents SDK Handoff Architecture
**What:** Supervisor agent classifies intent and hands off to specialist agents via SDK's native handoff mechanism.
**When to use:** Every inbound message flow.
**Example:**
```typescript
// Source: @openai/agents official docs + project-specific adaptation
import { Agent, tool, handoff, run } from '@openai/agents';

interface AgentContext {
  conversationId: number;
  contactId: number;
  channel: 'whatsapp' | 'sms' | 'email';
  isFirstMessage: boolean;
}

const salesAgent = new Agent<AgentContext>({
  name: 'Alex from Sales',
  instructions: `You are Alex, a sales specialist at John Barclay Estate Agents...`,
  tools: [searchPropertiesTool, bookViewingTool, createLeadTool],
});

const lettingsAgent = new Agent<AgentContext>({
  name: 'Jordan from Lettings',
  instructions: `You are Jordan, a lettings specialist at John Barclay Estate Agents...`,
  tools: [searchPropertiesTool, bookViewingTool, createLeadTool],
});

const supervisorAgent = Agent.create({
  name: 'Supervisor',
  instructions: `You are the AI receptionist for John Barclay Estate Agents. Classify the contact's intent and route to the correct specialist...`,
  handoffs: [
    handoff(salesAgent, {
      description: 'Transfer to Sales for property purchase enquiries, sale viewings, offers',
      onHandoff: async (ctx) => {
        // Log routing decision to audit trail
      },
    }),
    handoff(lettingsAgent, {
      description: 'Transfer to Lettings for rental enquiries, rental viewings, tenant applications',
    }),
  ],
});
```

### Pattern 2: Inbound Message Pipeline
**What:** Webhook -> ChannelGateway -> ConversationStore -> Agent Runner -> Response -> Send
**When to use:** Every inbound WhatsApp/SMS/email.
**Example:**
```typescript
// Webhook route handler
app.post('/api/webhooks/whatsapp', async (req, res) => {
  // 1. Gateway normalizes and stores message
  const result = await channelGateway.processInbound('whatsapp', req.body);

  // 2. Load conversation history for agent memory (CHAN-03)
  const history = await conversationStore.getConversationHistory(result.conversationId, 20);

  // 3. Run agent with context
  const agentResult = await run(supervisorAgent, inboundMessage, {
    context: {
      conversationId: result.conversationId,
      contactId: result.contact.contactId,
      channel: 'whatsapp',
      isFirstMessage: result.isNewConversation,
    },
  });

  // 4. Apply AI identification if first message
  const response = ensureAIIdentification(agentResult.finalOutput, result.isNewConversation);

  // 5. Store outbound message
  await conversationStore.storeMessage(result.conversationId, outbound, 'outbound', agentType);

  // 6. Send via channel
  await messageSender.send('whatsapp', result.contact.identifierValue, response);

  res.sendStatus(200);
});
```

### Pattern 3: Scheduled Message Queue (pg-boss)
**What:** Durable job queue for delayed messages -- viewing reminders, follow-up sequences, checklist chasing.
**When to use:** Any message that needs to be sent at a future time.
**Example:**
```typescript
import PgBoss from 'pg-boss';

const boss = new PgBoss(process.env.DATABASE_URL!);
await boss.start();

// Queue a viewing reminder for 24h before
await boss.send('viewing-reminder', {
  conversationId: 123,
  viewingId: 456,
  contactPhone: '+447...',
  channel: 'whatsapp',
  message: 'Just a reminder of your viewing tomorrow...',
}, {
  startAfter: reminderDate, // 24h before viewing
  retryLimit: 3,
  retryDelay: 300, // 5 min retry
});

// Worker processes the queue
await boss.work('viewing-reminder', async (job) => {
  await messageSender.send(job.data.channel, job.data.contactPhone, job.data.message);
});
```

### Pattern 4: Wrapping Existing Tools for SDK
**What:** Bridge the existing ToolRegistry tool definitions to @openai/agents `tool()` format.
**When to use:** Each existing Phase 1 tool needs an SDK wrapper.
**Example:**
```typescript
import { tool } from '@openai/agents';
import { z } from 'zod';
import { toolRegistry } from '../tools/registry';

// Wrap existing tool for SDK consumption
const searchProperties = tool({
  name: 'search_properties',
  description: 'Search CRM properties by area, postcode, type, bedrooms, and price.',
  parameters: z.object({
    area: z.string().optional(),
    postcode: z.string().optional(),
    type: z.enum(['rental', 'sale', 'any']),
    minBedrooms: z.number().optional(),
    maxPrice: z.number().optional(),
    limit: z.number().optional().default(5),
  }),
  execute: async (input, ctx) => {
    // Delegate to existing registry for execution + audit logging
    const result = await toolRegistry.invoke('search_properties', input, {
      agentType: ctx.context.agentType,
      conversationId: ctx.context.conversationId,
      channel: ctx.context.channel,
    });
    return JSON.stringify(result.output);
  },
});
```

### Anti-Patterns to Avoid
- **Duplicating tool logic:** Do NOT rewrite tool execute() functions. Wrap the existing ToolRegistry calls. The registry handles audit logging, permission checks, and Zod validation.
- **Manual handoff routing:** Do NOT build custom if/else routing logic. The SDK's handoff mechanism handles this -- the LLM decides when to hand off based on tool descriptions.
- **Storing agent state in memory:** Do NOT keep conversation state in-memory Maps. Use ConversationStore (PostgreSQL) for all state. The server can restart without losing conversations.
- **Blocking webhook responses:** Do NOT await the full agent run() in the webhook handler if it takes >5s. Twilio webhooks timeout at 15s. Consider acknowledging receipt first, processing async, then sending reply.
- **Hardcoding working hours:** User decision is 24/7 availability. The existing BaseAgent.isActive() checks working hours -- this MUST be removed or overridden for all agents.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Agent routing/handoff | Custom if/else message classification | `@openai/agents` handoff pattern | LLM-powered classification with confidence; SDK manages conversation state across handoffs |
| Scheduled messages | setInterval/setTimeout + database polling | pg-boss | Crash-safe, retries, backpressure, deduplication, built on PostgreSQL (no Redis needed) |
| Tool calling loop | Manual tool call extraction + execution loop | `@openai/agents` run() | SDK handles multi-turn tool calling, retries, and conversation assembly |
| Message format adaptation | Custom per-channel formatters | Unified messageSender with channel-aware formatting | SMS needs truncation (~320 chars), WhatsApp supports rich text, email needs HTML template |
| STOP/unsubscribe | Custom regex matching | Dedicated opt-out check at gateway level | Must happen before agent processing; PECR compliance requires immediate cessation |

**Key insight:** The OpenAI Agents SDK eliminates ~70% of the custom orchestration code in the existing BaseAgent/SupervisorAgent by handling handoffs, tool loops, and conversation management natively. The existing code should be retained as legacy but the new SDK-based agents should be the primary path.

## Common Pitfalls

### Pitfall 1: Twilio Webhook Timeout
**What goes wrong:** Agent run() takes 5-15s (LLM call + tool calls). Twilio expects a response within 15 seconds. If the webhook times out, Twilio retries, causing duplicate processing.
**Why it happens:** OpenAI API latency + tool execution time exceeds webhook timeout.
**How to avoid:** Return 200 immediately on webhook receipt. Process the agent run asynchronously. Send the reply via the Twilio REST API (not the webhook response body). Use message deduplication (externalMessageId) to catch retries.
**Warning signs:** Duplicate messages, "message not delivered" errors, Twilio retry logs.

### Pitfall 2: Conversation Context Window Overflow
**What goes wrong:** Long conversations exceed model context window when full history is injected.
**Why it happens:** Each message adds tokens; after 30+ messages, history can be 10K+ tokens.
**How to avoid:** Limit history injection to last 15-20 messages. For older context, use a summary. The SDK's inputFilter on handoff is the right place to truncate.
**Warning signs:** Increasing latency, truncated responses, model errors about context length.

### Pitfall 3: Checklist Item Type Mismatch
**What goes wrong:** Admin agent creates checklist items with types not matching the schema's tenancyChecklistItemTypes enum.
**Why it happens:** The schema has a fixed set of item types (e.g., 'tenancy_agreement', 'right_to_rent_check', 'gas_safety_certificate'). If the agent generates freeform types, database inserts fail.
**How to avoid:** The checklist generation tool must use ONLY the types defined in `tenancyChecklistItemMeta`. Pass the valid types list to the tool definition so the agent can only select from valid options.
**Warning signs:** Database constraint violations on insert.

### Pitfall 4: Email Adapter Missing from ChannelGateway
**What goes wrong:** Email inbound messages bypass the agent system because there is no email adapter registered in ChannelGateway.
**Why it happens:** Phase 1 built SMS and WhatsApp adapters only. The existing IMAP polling service processes emails but routes them to the old email classification system, not the agent system.
**How to avoid:** Build an EmailAdapter implementing the ChannelAdapter interface. Wire the IMAP polling output to ChannelGateway.processInbound('email', payload).
**Warning signs:** Emails not appearing in conversation threads, agents not responding to email enquiries.

### Pitfall 5: WhatsApp 24-Hour Session Window
**What goes wrong:** Agent tries to send a proactive WhatsApp message (follow-up, reminder) outside the 24-hour session window. Message is rejected by WhatsApp Business API.
**Why it happens:** WhatsApp requires pre-approved message templates for messages sent outside the 24h window after last customer message.
**How to avoid:** For scheduled messages (reminders, follow-ups), check if the 24h window is still open. If not, fall back to SMS or use an approved WhatsApp template. Track last inbound message timestamp per contact.
**Warning signs:** Twilio "message failed" errors with code 63016 or similar.

### Pitfall 6: Race Condition on Concurrent Messages
**What goes wrong:** Contact sends two messages quickly. Both trigger agent runs. Both try to create the same lead or book the same viewing.
**Why it happens:** No locking on conversation processing. Two webhook requests arrive within milliseconds.
**How to avoid:** Use a per-conversation processing lock (pg advisory lock or simple database flag). Queue second message for processing after first completes.
**Warning signs:** Duplicate leads, duplicate viewings, inconsistent conversation state.

## Code Examples

### Wrapping Existing Tools for @openai/agents SDK
```typescript
// Source: @openai/agents docs + existing ToolRegistry pattern
import { tool } from '@openai/agents';
import { z } from 'zod';
import { toolRegistry } from '../tools/registry';

// The SDK tool() returns an object that Agent accepts in its tools array.
// We delegate execution to the existing ToolRegistry which handles:
// - Zod validation, permission checks, audit logging

export function wrapRegistryTool(
  name: string,
  description: string,
  parameters: z.ZodObject<any>,
) {
  return tool({
    name,
    description,
    parameters,
    execute: async (input, ctx) => {
      const result = await toolRegistry.invoke(name, input, {
        agentType: ctx.context.agentType ?? 'supervisor',
        conversationId: ctx.context.conversationId,
        channel: ctx.context.channel,
      });
      return JSON.stringify(result.output);
    },
  });
}
```

### Escalation Tool (New -- Required for AGENT-07)
```typescript
const escalateToHuman = tool({
  name: 'escalate_to_human',
  description: 'Escalate the conversation to a human staff member. Use when: confidence is low, contact requests human, complaint detected, legal/financial question, 3+ unresolved exchanges, negative sentiment.',
  parameters: z.object({
    reason: z.string().describe('Why this conversation needs human attention'),
    urgency: z.enum(['normal', 'high', 'urgent']),
  }),
  execute: async (input, ctx) => {
    await escalationService.escalate({
      conversationId: ctx.context.conversationId,
      reason: input.reason,
      urgency: input.urgency,
      channel: ctx.context.channel,
    });
    return 'Escalation created. A staff member has been notified.';
  },
});
```

### Checklist Generation Tool (New -- Required for ADMIN-01, ADMIN-02)
```typescript
import { tenancyChecklistItemMeta, type TenancyChecklistItemType } from '@shared/schema';

const generateChecklist = tool({
  name: 'generate_checklist',
  description: 'Generate an onboarding or offboarding checklist for a tenancy.',
  parameters: z.object({
    tenancyId: z.number(),
    workflow: z.enum(['onboarding', 'offboarding']),
  }),
  execute: async (input) => {
    const workflowFilter = input.workflow === 'onboarding'
      ? ['onboarding', 'compliance', 'general']  // Include compliance + general for onboarding
      : ['end_of_tenancy'];

    const items = Object.entries(tenancyChecklistItemMeta)
      .filter(([_, meta]) => workflowFilter.includes(meta.workflow))
      .map(([type]) => type as TenancyChecklistItemType);

    // Insert checklist items into database
    for (const itemType of items) {
      await db.insert(tenancyChecklistItems).values({
        tenancyId: input.tenancyId,
        itemType,
        isCompleted: false,
      });
    }

    return JSON.stringify({ created: items.length, items });
  },
});
```

### Unified Message Sender
```typescript
// server/agents/services/messageSender.ts
import { sendWhatsAppMessage } from '../../whatsappService';
import { sendSMS } from '../../smsService';
import { emailService } from '../../emailService';

export class MessageSender {
  async send(
    channel: 'whatsapp' | 'sms' | 'email',
    to: string,
    body: string,
    options?: { subject?: string; htmlBody?: string },
  ): Promise<{ success: boolean; messageId?: string }> {
    switch (channel) {
      case 'whatsapp':
        // SMS max ~320 chars; WhatsApp can be longer
        const waResult = await sendWhatsAppMessage(to, body);
        return { success: !!waResult, messageId: waResult?.sid };

      case 'sms':
        // Truncate to ~320 chars for 2-segment limit
        const smsBody = body.length > 320 ? body.slice(0, 317) + '...' : body;
        const smsResult = await sendSMS(to, smsBody);
        return { success: !!smsResult, messageId: smsResult?.sid };

      case 'email':
        await emailService.sendEmail(to, options?.subject ?? 'John Barclay Estate Agents', options?.htmlBody ?? body);
        return { success: true };

      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  // Prefer WhatsApp, fall back to SMS if unavailable
  async sendPreferred(
    phone: string,
    body: string,
  ): Promise<{ channel: string; success: boolean }> {
    try {
      const result = await this.send('whatsapp', phone, body);
      if (result.success) return { channel: 'whatsapp', success: true };
    } catch {
      // WhatsApp failed, try SMS
    }
    const result = await this.send('sms', phone, body);
    return { channel: 'sms', success: result.success };
  }
}
```

## State of the Art

| Old Approach (current codebase) | Current Approach (Phase 2) | Impact |
|--------------------------------|---------------------------|--------|
| Raw `openai.chat.completions.create` in BaseAgent | `@openai/agents` Agent + run() | Eliminates manual tool call loop, conversation assembly, handoff routing |
| Custom SupervisorAgent.classifyMessage() | SDK handoff pattern with LLM-chosen routing | More flexible classification; handoff descriptions guide LLM decisions |
| In-memory agent activity logging | AuditLogger (already built Phase 1) | Durable, queryable audit trail |
| `gpt-4-turbo-preview` model reference | `gpt-4o` (faster, cheaper, multimodal) | Better latency for real-time messaging; lower cost per interaction |
| BaseAgent.isActive() working hours check | 24/7 availability (user decision) | Remove working hours gating from all agents |
| No scheduled messages | pg-boss job queue | Viewing reminders, follow-up sequences, checklist chasing all become durable scheduled jobs |

**Deprecated/outdated:**
- `gpt-4-turbo-preview`: Replaced by `gpt-4o` and `gpt-4o-mini`. Use `gpt-4o` for agents, `gpt-4o-mini` for simple classification if cost is a concern.
- Existing `BaseAgent.processTask()` / `BaseAgent.makeDecision()`: These manual OpenAI call patterns are superseded by the SDK's run() function. Keep the files for reference but build new agents using the SDK.

## Open Questions

1. **Existing BaseAgent: Replace or Wrap?**
   - What we know: The existing BaseAgent/SupervisorAgent classes use raw OpenAI calls. The @openai/agents SDK has its own Agent class.
   - What's unclear: Whether to replace the existing classes entirely or build SDK agents alongside them.
   - Recommendation: Build SDK agents in a new `server/agents/sdk/` directory. Keep existing classes untouched for backwards compatibility (other parts of the codebase may reference them). Once Phase 2 is proven, deprecate old classes.

2. **Email Inbound Routing**
   - What we know: IMAP polling exists in `server/services/email/imapPollingService.ts`. It processes emails through `emailProcessor.ts`.
   - What's unclear: The exact format of processed emails and how to hook them into the ChannelGateway without breaking existing email functionality.
   - Recommendation: Build an EmailAdapter that the IMAP polling service can optionally route to. Add a flag or heuristic to determine which emails should go to the AI agent system vs the existing email processing pipeline.

3. **Staff Notification Mechanism for Escalations**
   - What we know: No real-time notification system exists for staff (noted in CONTEXT.md code_context).
   - What's unclear: Whether staff should be notified via CRM UI, email, SMS, or all three.
   - Recommendation: Start with database-driven escalation records (queryable by CRM UI) + email notification to assigned staff member. Real-time WebSocket notifications can be added later.

4. **pg-boss Table Creation**
   - What we know: pg-boss auto-creates its own tables in the database on first start.
   - What's unclear: Whether Supabase allows pg-boss to create its pgboss schema and tables.
   - Recommendation: Test pg-boss initialisation against the Supabase database early in Plan 02-01. If it fails, use pg-boss with a custom schema name or create tables manually.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run --reporter=verbose` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | Supervisor classifies intent and routes to specialist | unit | `npx vitest run tests/agents/supervisorRouting.test.ts -t "routing"` | No -- Wave 0 |
| AGENT-03 | Agents take CRM actions via tools | unit | `npx vitest run tests/agents/toolExecution.test.ts -t "tool"` | No -- Wave 0 |
| AGENT-07 | Escalation to human when confidence low | unit | `npx vitest run tests/agents/escalation.test.ts -t "escalation"` | No -- Wave 0 |
| SALES-01 | Sales answers sale enquiries with live data | integration | `npx vitest run tests/agents/salesAgent.test.ts -t "enquiry"` | No -- Wave 0 |
| SALES-02 | Sales books viewings | integration | `npx vitest run tests/agents/salesAgent.test.ts -t "viewing"` | No -- Wave 0 |
| SALES-03 | Sales captures buyer leads | integration | `npx vitest run tests/agents/salesAgent.test.ts -t "lead"` | No -- Wave 0 |
| SALES-04 | Sales follows up across channels | unit | `npx vitest run tests/agents/followUp.test.ts -t "follow-up"` | No -- Wave 0 |
| LETT-01 | Lettings answers rental enquiries | integration | `npx vitest run tests/agents/lettingsAgent.test.ts -t "enquiry"` | No -- Wave 0 |
| LETT-02 | Lettings books viewings | integration | `npx vitest run tests/agents/lettingsAgent.test.ts -t "viewing"` | No -- Wave 0 |
| LETT-03 | Lettings captures tenant leads | integration | `npx vitest run tests/agents/lettingsAgent.test.ts -t "lead"` | No -- Wave 0 |
| LETT-04 | Lettings follows up across channels | unit | `npx vitest run tests/agents/followUp.test.ts -t "follow-up"` | No -- Wave 0 |
| ADMIN-01 | Generates onboarding checklist | unit | `npx vitest run tests/agents/adminChecklist.test.ts -t "onboarding"` | No -- Wave 0 |
| ADMIN-02 | Generates offboarding checklist | unit | `npx vitest run tests/agents/adminChecklist.test.ts -t "offboarding"` | No -- Wave 0 |
| ADMIN-03 | Tracks and chases outstanding items | unit | `npx vitest run tests/agents/adminChecklist.test.ts -t "chase"` | No -- Wave 0 |
| CHAN-03 | Context from previous interactions injected | unit | `npx vitest run tests/agents/memoryInjection.test.ts -t "memory"` | No -- Wave 0 |
| CHAN-04 | Automatic confirmations after actions | unit | `npx vitest run tests/agents/postActionConfirmation.test.ts -t "confirmation"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/agents/supervisorRouting.test.ts` -- covers AGENT-01 (mock SDK Agent, verify handoff selection)
- [ ] `tests/agents/toolExecution.test.ts` -- covers AGENT-03 (mock tool calls through SDK wrapper)
- [ ] `tests/agents/escalation.test.ts` -- covers AGENT-07 (verify escalation tool invoked, notification created)
- [ ] `tests/agents/salesAgent.test.ts` -- covers SALES-01/02/03 (mock search, booking, lead capture flows)
- [ ] `tests/agents/lettingsAgent.test.ts` -- covers LETT-01/02/03 (mirror of sales tests for rentals)
- [ ] `tests/agents/followUp.test.ts` -- covers SALES-04/LETT-04 (verify pg-boss job scheduling)
- [ ] `tests/agents/adminChecklist.test.ts` -- covers ADMIN-01/02/03 (checklist generation, chase scheduling)
- [ ] `tests/agents/memoryInjection.test.ts` -- covers CHAN-03 (verify history loaded and injected)
- [ ] `tests/agents/postActionConfirmation.test.ts` -- covers CHAN-04 (verify confirmation sent after booking)

## Sources

### Primary (HIGH confidence)
- OpenAI Agents SDK official docs: https://openai.github.io/openai-agents-js/ -- handoffs, agents, tools, runner
- OpenAI Agents SDK GitHub: https://github.com/openai/openai-agents-js -- v0.7.2, npm package `@openai/agents`
- Existing codebase: `server/agents/` -- all Phase 1 infrastructure (ChannelGateway, ToolRegistry, AuditLogger, ConversationStore, ContactResolver)
- Existing schema: `shared/schema.ts` -- conversations, messages, contactIdentities, tenancyChecklistItems, tenancyChecklistItemMeta, agentAuditLog

### Secondary (MEDIUM confidence)
- pg-boss: PostgreSQL-based job queue -- https://github.com/timgit/pg-boss -- well-established library for PostgreSQL job queues
- Twilio WhatsApp 24h session window: standard WhatsApp Business API limitation -- verified through Twilio documentation patterns

### Tertiary (LOW confidence)
- Exact pg-boss compatibility with Supabase managed PostgreSQL -- needs validation during implementation
- `@openai/agents` performance characteristics under load (concurrent conversations) -- limited production reports available

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- @openai/agents is the official OpenAI SDK with clear documentation; pg-boss is battle-tested on PostgreSQL
- Architecture: HIGH -- handoff pattern maps directly to the Supervisor-Specialist architecture; existing infrastructure handles 80% of plumbing
- Pitfalls: HIGH -- Twilio timeouts, WhatsApp session windows, and race conditions are well-documented production issues in messaging systems

**Research date:** 2026-03-20
**Valid until:** 2026-04-20 (30 days -- stable domain, @openai/agents is actively developed but core patterns are stable)
