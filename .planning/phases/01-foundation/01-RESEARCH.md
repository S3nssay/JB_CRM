# Phase 1: Foundation - Research

**Researched:** 2026-03-19
**Domain:** Database schema design, conversation threading, tool registry architecture, audit logging
**Confidence:** HIGH

## Summary

Phase 1 builds the data and infrastructure foundation that every subsequent phase depends on. The good news: the existing codebase already has substantial schema for certifications (`propertyCertifications`, `propertyCertificates`, `complianceRequirements`, `complianceStatus`), maintenance (`maintenanceTickets`, `maintenanceRequests`, `workOrders`), conversations (`conversations`, `messages`), and a working agent class hierarchy (`BaseAgent`, `SupervisorAgent`, specialists). The work is therefore about extending and connecting what exists rather than building from scratch.

The critical gaps are: (1) no systems inventory table (heating type, boiler model, electrical board type) -- this data has no home; (2) the existing `conversations`/`messages` tables are for human CRM conversations and lack contact identity resolution or AI agent context fields; (3) the agent system returns JSON decisions but never executes CRM actions (no tool registry); (4) no audit logging for agent actions exists; (5) the existing Twilio SMS/WhatsApp services are outbound-only with no inbound webhook handling for AI agent routing.

**Primary recommendation:** Extend existing schema tables (add `property_systems_inventory` and `agent_audit_log` tables, extend `conversations`/`messages` with agent fields, add `contact_identities` table), build the Tool Registry as a new module under `server/agents/tools/`, and wire inbound Twilio webhooks through a Channel Gateway to the existing agent orchestrator.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| KB-01 | Property has structured certification records (gas safety, EICR, EPC) with expiry dates and status | Existing `propertyCertifications` and `propertyCertificates` tables already cover this. Need to verify they are populated and surfaced in UI. `complianceRequirements` + `complianceStatus` tables provide an additional layer. |
| KB-02 | Property has systems inventory (heating type, boiler make/model, electrical board, plumbing) | GAP: No systems inventory table exists. Need new `property_systems_inventory` table. |
| KB-03 | Property has maintenance/work history log linked to contractors and dates | Existing `maintenanceTickets`, `maintenanceRequests`, `workOrders` tables with `contractors` table. Already linked via FK fields. |
| KB-04 | Knowledge base is queryable by AI agents with sub-100ms retrieval for use during live calls | Need a `query_knowledge_base` tool in the Tool Registry that queries certifications + systems + maintenance via indexed SQL. No vector search needed for structured data -- direct indexed queries will be sub-100ms. |
| KB-05 | CRM UI allows staff to view and edit property knowledge base data | Need a new CRM page component aggregating certifications, systems inventory, and maintenance history per property. |
| AGENT-02 | All agents have access to live CRM data via a Tool Registry | GAP: Agents currently return JSON decisions but cannot execute CRM actions. Need Tool Registry framework. |
| AGENT-04 | Conversation state persists in database across interactions and channels | Existing `conversations`/`messages` tables need extension for AI agent fields (agent_type, tool_calls, contact identity resolution). |
| AGENT-05 | All AI agent actions logged to database audit trail | GAP: No audit table exists. Need new `agent_audit_log` table. |
| AGENT-06 | AI agents identify themselves as AI to callers (UK compliance) | Middleware pattern: inject AI self-identification into first message of every agent-initiated conversation. |
| CHAN-01 | Unified conversation threading across phone, WhatsApp, SMS, and email | Extend existing `conversations` table with multi-channel support; add `contact_identities` table for cross-channel identity linking. |
| CHAN-02 | Contact identity resolution (same person across phone number, email, WhatsApp) | GAP: No contact identity resolution exists. Need `contact_identities` table + resolution service. |
</phase_requirements>

## Standard Stack

### Core (Already in Project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.39.1 | Database ORM | Already the project ORM; all schema in `shared/schema.ts` |
| pg | 8.16.3 | PostgreSQL driver | Already in use; `pool` exported from `server/db.ts` for raw SQL |
| zod | 3.23.8 | Runtime validation | Already used for all schema validation; tool input/output validation |
| openai | 4.104.0 | LLM API client | Already integrated; agents use it for decisions |
| twilio | 5.5.1 | SMS/WhatsApp | Already integrated in `smsService.ts` and `whatsappService.ts` |

### New for Phase 1

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | Phase 1 requires no new npm dependencies. All work uses existing libraries. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Indexed SQL for KB queries | pgvector + embeddings | pgvector adds complexity; structured property data (certifications, systems) is better served by direct indexed queries. pgvector useful later for free-text search across maintenance notes -- defer to Phase 2+. |
| Extending existing `conversations` table | New `agent_conversations` table | Separate table avoids breaking existing conversation features but creates data fragmentation. Better to extend the existing table with nullable AI-specific columns. |
| Direct Drizzle queries in tools | Separate data access layer | Tools should use Drizzle directly for simplicity; the existing `storage.ts` pattern is too coupled to REST endpoint shapes. |

## Architecture Patterns

### Recommended Project Structure

```
server/
  agents/
    tools/
      registry.ts           # Tool registry + base types
      definitions/
        searchProperties.ts  # search_properties tool
        bookViewing.ts       # book_viewing tool
        createLead.ts        # create_lead tool
        createMaintenanceTicket.ts  # create_maintenance_ticket tool
        queryKnowledgeBase.ts       # query_knowledge_base tool
    channels/
      gateway.ts            # Channel Gateway (normalises inbound messages)
      adapters/
        smsAdapter.ts       # Twilio SMS normalisation
        whatsappAdapter.ts  # Twilio WhatsApp normalisation
    middleware/
      auditLogger.ts        # Audit logging middleware
      aiIdentification.ts   # AI self-identification injection
    types.ts                # Extended with new types (existing file)
```

### Pattern 1: Tool Registry with Zod-Validated Functions

**What:** Each CRM action is a typed function with Zod input/output schemas, registered by name in a central Map. Agents reference tools by name; the registry validates inputs, executes the function, logs the result to the audit trail, and returns typed output.

**When to use:** Every agent tool invocation.

**Example:**
```typescript
// server/agents/tools/registry.ts
import { z } from 'zod';

interface ToolDefinition<TInput extends z.ZodType, TOutput extends z.ZodType> {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  permissions: AgentType[];  // Which agent types may invoke
  tier: 'autonomous' | 'confirm' | 'human_only';
  execute: (input: z.infer<TInput>, context: ToolContext) => Promise<z.infer<TOutput>>;
}

interface ToolContext {
  agentType: AgentType;
  conversationId: number | null;
  contactId: number | null;
  channel: CommunicationChannel;
}

class ToolRegistry {
  private tools = new Map<string, ToolDefinition<any, any>>();

  register<TI extends z.ZodType, TO extends z.ZodType>(tool: ToolDefinition<TI, TO>) {
    this.tools.set(tool.name, tool);
  }

  async invoke(name: string, rawInput: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (!tool.permissions.includes(context.agentType)) {
      throw new Error(`Agent ${context.agentType} lacks permission for tool ${name}`);
    }
    const input = tool.inputSchema.parse(rawInput);
    const startTime = Date.now();
    const output = await tool.execute(input, context);
    const duration = Date.now() - startTime;
    // Audit logging happens here
    await this.logAudit(name, input, output, context, duration);
    return tool.outputSchema.parse(output);
  }

  // Returns OpenAI function-calling schema for a set of tools
  getOpenAITools(agentType: AgentType): OpenAI.Chat.ChatCompletionTool[] {
    return [...this.tools.values()]
      .filter(t => t.permissions.includes(agentType))
      .map(t => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: zodToJsonSchema(t.inputSchema),
        }
      }));
  }
}

export const toolRegistry = new ToolRegistry();
```

### Pattern 2: Channel Gateway with Contact Identity Resolution

**What:** Inbound webhooks from Twilio (SMS/WhatsApp) are normalised into a common `IncomingMessage` format. The gateway resolves the sender's identity by looking up their phone number in `contact_identities`, then threads the message into an existing or new conversation.

**When to use:** Every inbound message from any channel.

**Example:**
```typescript
// server/agents/channels/gateway.ts
class ChannelGateway {
  async processInbound(channel: CommunicationChannel, payload: unknown): Promise<void> {
    const adapter = this.adapters.get(channel);
    const normalized = adapter.normalize(payload);

    // Resolve contact identity
    const identity = await this.resolveContact(normalized.from, channel);

    // Thread into conversation
    const conversation = await this.findOrCreateConversation(identity, channel);

    // Store message
    const messageId = await this.storeMessage(conversation.id, normalized, channel);

    // Route to agent (synchronous on webhook)
    await this.routeToAgent(conversation, normalized, messageId);
  }

  private async resolveContact(identifier: string, channel: CommunicationChannel) {
    // Look up in contact_identities table
    // Check leads, tenant, landlords tables by phone/email
    // Create new identity if unknown
  }
}
```

### Pattern 3: Audit Logger as Middleware

**What:** Every tool invocation, agent decision, and escalation is logged to `agent_audit_log` with timestamp, agent type, action, tool name, inputs/outputs (redacted), and reasoning. The logger is called within the Tool Registry's `invoke` method and also directly by agents for non-tool actions (classification decisions, escalations).

**When to use:** Every agent action, including classification and routing decisions.

### Pattern 4: AI Self-Identification Injection

**What:** A middleware function wraps every agent response to ensure the first message in any conversation contains an AI self-identification statement. This is checked at the conversation level (not per-message) to avoid repetitive identification.

**When to use:** First outbound message in every agent-initiated conversation.

**Example:**
```typescript
const AI_IDENTIFICATION = "I'm an AI assistant at John Barclay Estate Agents.";

function ensureAIIdentification(
  conversationId: number,
  agentResponse: string,
  isFirstMessage: boolean
): string {
  if (isFirstMessage) {
    return `${AI_IDENTIFICATION} ${agentResponse}`;
  }
  return agentResponse;
}
```

### Anti-Patterns to Avoid

- **In-memory task queues:** The existing `AgentOrchestrator` stores tasks in `Map<string, AgentTask>` in memory. All new conversation state and task state MUST go to PostgreSQL. The in-memory Map is acceptable only as a transient processing cache.
- **Polling-based message processing:** Do NOT use `setInterval` to poll for new messages. Process inbound webhooks synchronously in the request handler. The webhook receives the message, processes it through the gateway, routes to agent, gets response, and replies -- all in one request cycle.
- **Separate agent-only tables for conversations:** Do NOT create a parallel `agent_conversations` table. Extend the existing `conversations` and `messages` tables with nullable columns for AI agent metadata.
- **Agents Deciding Without Acting:** The current pattern where agents return `AgentDecision` JSON but nothing executes the decision. Phase 1 tools MUST actually execute CRM actions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OpenAI function schema generation | Manual JSON Schema construction | `zod-to-json-schema` (or manual but keep schemas in Zod) | Zod schemas are already the project standard; deriving JSON Schema from Zod ensures tools and validation stay in sync |
| Twilio webhook signature validation | Manual HMAC comparison | `twilio.webhook()` Express middleware | Twilio SDK already in project; their middleware handles signature validation correctly |
| Contact phone number normalization | Regex-based parsing | Twilio's E.164 format (already handled by Twilio SDK) | Phone numbers from Twilio webhooks arrive in E.164; store and compare in that format |
| Conversation threading logic | Custom session windowing | Database-level contact identity + conversation state machine | The database is the source of truth; don't try to window sessions by time |

**Key insight:** Phase 1 is almost entirely database schema + typed TypeScript modules. There are no new external services to integrate -- Twilio, OpenAI, and PostgreSQL are already connected. The work is wiring them together through the Tool Registry and Channel Gateway patterns.

## Common Pitfalls

### Pitfall 1: Duplicate Certification Tables
**What goes wrong:** The schema already has THREE certification-related table groups: `propertyCertifications` (line 1330), `propertyCertificates` (line 4734), and `complianceRequirements`/`complianceStatus` (line 5401/5420). Adding a fourth for "knowledge base" would create data fragmentation.
**Why it happens:** The schema has grown organically without consolidation.
**How to avoid:** Do NOT create new certification tables. The `query_knowledge_base` tool should query the existing `propertyCertifications` table (the most complete one, with expiry dates, reminder tracking, and contractor references). Map the CRM UI to this existing table.
**Warning signs:** Creating any new `pgTable` with "cert" in the name.

### Pitfall 2: Breaking Existing Conversation Features
**What goes wrong:** The existing `conversations` and `messages` tables are used by the CRM for human agent conversations. Adding AI agent columns and changing query patterns could break existing conversation features.
**Why it happens:** Reusing tables without understanding downstream consumers.
**How to avoid:** Add new columns as NULLABLE so existing queries continue to work. Add a `source` column to distinguish human-created vs AI-created conversations. Test that existing conversation UI still works after schema changes.
**Warning signs:** Existing conversation list pages showing AI conversations mixed with human ones, or existing queries failing due to new NOT NULL constraints.

### Pitfall 3: Tool Registry Becomes a God Object
**What goes wrong:** The Tool Registry grows to handle validation, execution, audit logging, permission checking, rate limiting, and error handling all in one class.
**Why it happens:** "Just add one more responsibility" during Phase 1 development.
**How to avoid:** Keep the registry itself as a thin lookup + dispatch layer. Validation is handled by Zod schemas on each tool. Audit logging is a separate service called by the registry. Permission checking is a single guard at the top of `invoke()`.
**Warning signs:** The registry file exceeding 300 lines. Business logic appearing in the registry rather than in individual tool definitions.

### Pitfall 4: Contact Identity Resolution Creates Duplicates
**What goes wrong:** The same person (e.g., a tenant) has a phone number in the `tenant` table, a different phone in the `leads` table, and an email in the `conversations` table. The identity resolver creates a new contact for each, producing duplicate records.
**Why it happens:** Existing data has inconsistent phone formats (+44 vs 07), and the same person may exist across multiple tables (they were a lead before becoming a tenant).
**How to avoid:** Normalize all phone numbers to E.164 format before comparison. Check across `tenant`, `landlords`, `leads`, and `contacts` tables. Prefer matching to existing records over creating new ones. Store the resolution in `contact_identities` as a cross-reference table.
**Warning signs:** Multiple contact_identities rows pointing to different contact_id/contact_type combinations for the same phone number.

### Pitfall 5: Schema Column Names Don't Match (CLAUDE.md Rule)
**What goes wrong:** Code references `bankAccountNo` but the column is `bank_account_number`. Code references `fullName` but the column is `name`. This is the #1 cause of production errors per CLAUDE.md.
**Why it happens:** Writing code from memory instead of checking `shared/schema.ts`.
**How to avoid:** ALWAYS grep `shared/schema.ts` for exact column names before writing any database code. Copy-paste column names. Never type from memory. This is mandatory per CLAUDE.md and must be followed for every new table and every query.
**Warning signs:** TypeScript compilation errors referencing unknown properties. Runtime 500 errors with "column X does not exist" messages.

## Code Examples

### New Schema: Property Systems Inventory
```typescript
// In shared/schema.ts
export const propertySystemsInventory = pgTable("property_systems_inventory", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),

  // System category
  systemType: text("system_type").notNull(),
  // 'heating', 'hot_water', 'electrical', 'plumbing', 'ventilation', 'fire_safety', 'security', 'other'

  // System details
  make: text("make"),           // e.g., 'Vaillant', 'Worcester Bosch', 'Hive'
  model: text("model"),         // e.g., 'EcoTEC Plus 832'
  serialNumber: text("serial_number"),

  // Installation
  installedDate: timestamp("installed_date"),
  installedBy: text("installed_by"),     // Contractor name
  contractorId: integer("contractor_id"), // FK to contractors table

  // Warranty / service
  warrantyExpiryDate: timestamp("warranty_expiry_date"),
  lastServiceDate: timestamp("last_service_date"),
  nextServiceDue: timestamp("next_service_due"),
  serviceIntervalMonths: integer("service_interval_months"),

  // Location within property
  location: text("location"),    // e.g., 'Kitchen cupboard', 'Utility room', 'Loft'

  // Additional info
  notes: text("notes"),
  specifications: json("specifications"), // Flexible key-value for system-specific data

  // Staleness tracking
  lastVerifiedAt: timestamp("last_verified_at"),
  lastVerifiedBy: integer("last_verified_by"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow()
});
```

### New Schema: Agent Audit Log
```typescript
// In shared/schema.ts
export const agentAuditLog = pgTable("agent_audit_log", {
  id: serial("id").primaryKey(),

  // Context
  conversationId: integer("conversation_id"),  // FK to conversations
  messageId: integer("message_id"),            // FK to messages (which triggered this)

  // Agent info
  agentType: text("agent_type").notNull(),     // 'supervisor', 'sales', 'rental', etc.

  // Action details
  action: text("action").notNull(),
  // 'classify', 'route', 'tool_call', 'respond', 'escalate', 'identify_ai'

  // Tool call details (nullable -- only for tool_call actions)
  toolName: text("tool_name"),
  toolInput: json("tool_input"),
  toolOutput: json("tool_output"),

  // Decision reasoning
  reasoning: text("reasoning"),
  confidence: numeric("confidence", { precision: 3, scale: 2 }),

  // Performance
  durationMs: integer("duration_ms"),

  // Channel context
  channel: text("channel"),  // 'sms', 'whatsapp', 'phone', 'email', 'web_chat'

  // Error tracking
  error: text("error"),

  // Immutable timestamp
  createdAt: timestamp("created_at").notNull().defaultNow()
});

// Index for efficient querying
// CREATE INDEX idx_audit_conversation ON agent_audit_log(conversation_id);
// CREATE INDEX idx_audit_agent_type ON agent_audit_log(agent_type, created_at);
// CREATE INDEX idx_audit_created ON agent_audit_log(created_at);
```

### New Schema: Contact Identities
```typescript
// In shared/schema.ts
export const contactIdentities = pgTable("contact_identity", {
  id: serial("id").primaryKey(),

  // Which CRM record this identity resolves to
  contactId: integer("contact_id").notNull(),
  contactType: text("contact_type").notNull(), // 'lead', 'tenant', 'landlord', 'user'

  // The identifier
  identifierType: text("identifier_type").notNull(), // 'phone', 'email', 'whatsapp'
  identifierValue: text("identifier_value").notNull(), // E.164 phone or email address

  isPrimary: boolean("is_primary").default(false),
  verified: boolean("verified").default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
  uniqueIdentifier: unique().on(table.identifierType, table.identifierValue),
}));
```

### Extended Conversations Table Columns
```typescript
// Add to existing conversations table definition in shared/schema.ts:
  // AI agent fields (all nullable to preserve existing functionality)
  source: text("source").default("human"), // 'human', 'ai_agent'
  agentType: text("agent_type"),           // Which agent is handling
  contactType: text("contact_type"),       // 'lead', 'tenant', 'landlord', 'unknown'
  lastChannel: text("last_channel"),       // Last channel used in this conversation
  resolvedContactId: integer("resolved_contact_id"), // Cross-ref contact_identities
```

### Extended Messages Table Columns
```typescript
// Add to existing messages table definition in shared/schema.ts:
  // AI agent fields (nullable)
  agentType: text("agent_type"),       // Which agent handled this message
  toolCalls: json("tool_calls"),       // Tools invoked during processing
  isAiGenerated: boolean("is_ai_generated").default(false),
```

### Tool Definition Example: query_knowledge_base
```typescript
// server/agents/tools/definitions/queryKnowledgeBase.ts
import { z } from 'zod';
import { db } from '../../../db';
import { propertyCertifications, propertySystemsInventory, maintenanceTickets } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const inputSchema = z.object({
  propertyId: z.number(),
  categories: z.array(z.enum([
    'certifications', 'systems', 'maintenance_history', 'all'
  ])).default(['all']),
  limit: z.number().optional().default(10),
});

const outputSchema = z.object({
  propertyId: z.number(),
  certifications: z.array(z.object({
    type: z.string(),
    status: z.string(),
    expiryDate: z.string().nullable(),
    issuedBy: z.string().nullable(),
  })).optional(),
  systems: z.array(z.object({
    type: z.string(),
    make: z.string().nullable(),
    model: z.string().nullable(),
    lastServiceDate: z.string().nullable(),
    warrantyExpiry: z.string().nullable(),
  })).optional(),
  recentMaintenance: z.array(z.object({
    title: z.string(),
    category: z.string(),
    status: z.string(),
    createdAt: z.string(),
  })).optional(),
});

export const queryKnowledgeBaseTool = {
  name: 'query_knowledge_base',
  description: 'Query property knowledge base for certifications, systems inventory, and maintenance history',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'sales', 'rental', 'maintenance', 'office_admin'] as AgentType[],
  tier: 'autonomous' as const,
  execute: async (input: z.infer<typeof inputSchema>, context: ToolContext) => {
    const { propertyId, categories, limit } = input;
    const includeAll = categories.includes('all');
    const result: any = { propertyId };

    if (includeAll || categories.includes('certifications')) {
      result.certifications = await db.select({
        type: propertyCertifications.certificationType,
        status: propertyCertifications.status,
        expiryDate: propertyCertifications.expiryDate,
        issuedBy: propertyCertifications.issuedBy,
      })
      .from(propertyCertifications)
      .where(eq(propertyCertifications.propertyId, propertyId))
      .limit(limit);
    }

    if (includeAll || categories.includes('systems')) {
      result.systems = await db.select({
        type: propertySystemsInventory.systemType,
        make: propertySystemsInventory.make,
        model: propertySystemsInventory.model,
        lastServiceDate: propertySystemsInventory.lastServiceDate,
        warrantyExpiry: propertySystemsInventory.warrantyExpiryDate,
      })
      .from(propertySystemsInventory)
      .where(eq(propertySystemsInventory.propertyId, propertyId))
      .limit(limit);
    }

    if (includeAll || categories.includes('maintenance_history')) {
      result.recentMaintenance = await db.select({
        title: maintenanceTickets.title,
        category: maintenanceTickets.category,
        status: maintenanceTickets.status,
        createdAt: maintenanceTickets.createdAt,
      })
      .from(maintenanceTickets)
      .where(eq(maintenanceTickets.propertyId, propertyId))
      .orderBy(desc(maintenanceTickets.createdAt))
      .limit(limit);
    }

    return result;
  }
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single `property_knowledge` table with embeddings (proposed in STACK.md research) | Structured relational tables (certifications, systems inventory, maintenance) queried directly | Phase 1 design decision | No pgvector dependency for Phase 1. Structured data is faster and more reliable for known-schema queries. Embeddings deferred to Phase 2+ for free-text search. |
| In-memory agent task queue (`AgentOrchestrator.taskQueue`) | Database-persisted conversation state | Phase 1 | Survives server restarts; enables audit trail; supports horizontal scaling |
| Agents return `AgentDecision` JSON without executing | Tool Registry executes CRM actions directly | Phase 1 | Agents become autonomous -- the core value proposition of the project |

**Deprecated/outdated patterns in existing code:**
- `AgentOrchestrator.taskQueue` (in-memory Map) -- must not be extended; conversation state goes to DB
- `BaseAgent.executeDecision()` -- returns decision data without acting; replaced by Tool Registry
- `processingInterval` (2-second polling) -- replaced by synchronous webhook processing

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (recommended -- Vite-native, TypeScript-first, compatible with existing Vite setup) |
| Config file | none -- see Wave 0 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| KB-01 | Certifications queryable with expiry dates | unit | `npx vitest run tests/tools/queryKnowledgeBase.test.ts -t "certifications"` | No -- Wave 0 |
| KB-02 | Systems inventory CRUD | unit | `npx vitest run tests/schema/propertySystemsInventory.test.ts` | No -- Wave 0 |
| KB-03 | Maintenance history linked to contractors | unit | `npx vitest run tests/tools/queryKnowledgeBase.test.ts -t "maintenance"` | No -- Wave 0 |
| KB-04 | Knowledge base query under 100ms | unit | `npx vitest run tests/tools/queryKnowledgeBase.test.ts -t "performance"` | No -- Wave 0 |
| KB-05 | UI renders KB data per property | manual-only | Manual: open managed property in CRM, verify KB tab shows data | N/A |
| AGENT-02 | Tool Registry invokes tools with permissions | unit | `npx vitest run tests/tools/registry.test.ts` | No -- Wave 0 |
| AGENT-04 | Conversation persists across messages | unit | `npx vitest run tests/channels/conversationStore.test.ts` | No -- Wave 0 |
| AGENT-05 | Audit log written for every tool call | unit | `npx vitest run tests/audit/auditLogger.test.ts` | No -- Wave 0 |
| AGENT-06 | AI self-identification in first message | unit | `npx vitest run tests/middleware/aiIdentification.test.ts` | No -- Wave 0 |
| CHAN-01 | Multi-channel threading | unit | `npx vitest run tests/channels/gateway.test.ts -t "threading"` | No -- Wave 0 |
| CHAN-02 | Contact identity resolution | unit | `npx vitest run tests/channels/contactIdentity.test.ts` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` -- Vitest configuration (integrate with existing Vite config)
- [ ] `tests/tools/registry.test.ts` -- Tool Registry unit tests
- [ ] `tests/tools/queryKnowledgeBase.test.ts` -- KB query tool tests
- [ ] `tests/channels/gateway.test.ts` -- Channel Gateway tests
- [ ] `tests/channels/contactIdentity.test.ts` -- Contact identity resolution tests
- [ ] `tests/audit/auditLogger.test.ts` -- Audit logger tests
- [ ] `tests/middleware/aiIdentification.test.ts` -- AI identification tests
- [ ] Framework install: `npm install -D vitest`

## Open Questions

1. **Which certification table is canonical?**
   - What we know: Three overlapping cert table groups exist: `propertyCertifications` (line 1330), `propertyCertificates` (line 4734), and `complianceRequirements`/`complianceStatus` (line 5401). All have property_id, expiry dates, and status tracking.
   - What's unclear: Which is actively populated in the live database? Are all three used by different CRM features?
   - Recommendation: Query the live database to check row counts in each table. Use whichever has real data. `propertyCertifications` appears most complete (has contractor refs, reminder tracking, inspection scheduling). The `query_knowledge_base` tool should query the canonical one.

2. **Should the Channel Gateway handle email inbound?**
   - What we know: Email inbound already has its own subsystem (`server/services/email/imapPollingService.ts`, `emailProcessor.ts`). The requirements say "WhatsApp or SMS" for Phase 1 success criteria.
   - What's unclear: Whether email should also flow through the Channel Gateway now, or be added in Phase 2.
   - Recommendation: Phase 1 builds the Gateway for SMS and WhatsApp only. Email integration is a Phase 2 concern -- the existing email subsystem works independently.

3. **Existing `conversations`/`messages` -- are they used in production?**
   - What we know: The tables exist in the schema. CRM routes reference them.
   - What's unclear: Whether they have real data or are scaffolded like the agent system.
   - Recommendation: Check the live database before extending. If empty, can restructure more aggressively. If populated, must add columns as nullable.

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` -- All existing table definitions (7,718 lines, verified directly)
- `server/agents/types.ts` -- Existing agent type system (IncomingMessage, AgentType, CommunicationChannel)
- `server/agents/BaseAgent.ts`, `AgentOrchestrator.ts` -- Current agent architecture
- `server/smsService.ts`, `server/whatsappService.ts` -- Existing Twilio integration (outbound only)
- `server/crmRoutes.ts` -- Existing Twilio webhook endpoints (line 6310+)

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` -- Architecture patterns (conversation threading, tool registry design)
- `.planning/research/PITFALLS.md` -- Pitfalls research (voice latency, routing failures, stale KB)
- `.planning/research/STACK.md` -- Stack decisions (pgvector deferred, OpenAI Agents SDK for later phases)
- `.planning/codebase/CONVENTIONS.md` -- Code conventions (naming, imports, error handling)

### Tertiary (LOW confidence)
- Vitest compatibility with existing Vite config -- assumed based on Vite ecosystem; needs validation during Wave 0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- everything is already in the project
- Architecture: HIGH -- patterns derived from existing codebase analysis and proven multi-agent patterns
- Schema design: HIGH -- existing tables provide clear extension points; gaps (systems inventory, audit log) are straightforward
- Pitfalls: HIGH -- based on direct codebase analysis (duplicate cert tables, in-memory state, etc.)
- Test infrastructure: MEDIUM -- no test framework exists; Vitest recommendation based on Vite ecosystem fit

**Research date:** 2026-03-19
**Valid until:** 2026-04-19 (stable domain -- database schema and TypeScript patterns)
