# Technology Stack: AI Voice Agents & Property Knowledge Base

**Project:** JB CRM - AI Agents Milestone
**Researched:** 2026-03-19
**Overall confidence:** MEDIUM-HIGH

## Recommended Stack

### Voice AI Platform

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Vapi** | Current (API) | Voice AI agent platform for real phone calls | Best-in-class multi-agent routing ("Squads"), native Express.js webhook integration, OpenAI-style function calling for CRM actions, UK numbers via existing Twilio integration. Squads feature maps directly to the receptionist-to-specialist routing architecture this project needs. |

**Confidence:** MEDIUM - Vapi is the strongest fit on paper for multi-specialist routing. Retell (already partially integrated) has agent transfer too, but Vapi's Squads are purpose-built for the exact "receptionist routes to sales/lettings/PM specialist" pattern. The existing Retell integration is scaffolded (mock connections, no real API calls), so switching costs are near zero.

**Why not Retell (existing)?** The current `voiceAgentService.ts` is entirely scaffolded - all Retell methods return mocks. No real integration exists. Retell supports agent transfer but it was added later and is less mature than Vapi's Squads. Retell's UK phone number provisioning is also reported as problematic by users.

**Why not Bland AI?** Bland excels at high-volume outbound campaigns (sales dialers, surveys). This project is primarily inbound receptionist + specialist routing. Bland's architecture is optimised for batch calling, not the multi-specialist handoff pattern needed here.

#### Vapi Integration Architecture

```
Inbound Call (Twilio) --> Vapi Squad
  |
  +--> Receptionist Assistant (intent detection, routing)
  |     |
  |     +--> Sales Specialist Assistant (handoff)
  |     +--> Lettings Specialist Assistant (handoff)
  |     +--> PM Specialist Assistant (handoff)
  |     +--> Admin Specialist Assistant (handoff)
  |     +--> Human Transfer (fallback)
  |
  +--> Each assistant calls back to Express server via webhook
       for CRM actions (book viewing, search properties, etc.)
```

#### Vapi SDK & Integration

| Package | Version | Purpose |
|---------|---------|---------|
| `@vapi-ai/server-sdk` | ^0.11.0 | Server-side Vapi API access (create assistants, squads, manage calls) |
| `@vapi-ai/web` | latest | Optional: browser-based voice for CRM dashboard "listen in" |

#### Vapi Pricing Reality

| Component | Cost | Notes |
|-----------|------|-------|
| Platform | $0.05/min | Base Vapi charge |
| Telephony | $0.008-0.014/min | Via existing Twilio - no new provider needed |
| LLM | Varies | Uses existing OpenAI key (gpt-4o-mini for routine, gpt-4o for complex) |
| STT/TTS | Included in platform | Deepgram STT + provider TTS |
| **Total estimate** | ~$0.15-0.25/min | Varies by LLM model choice |

### Agent Orchestration Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **OpenAI Agents SDK** | ^0.5.3 (`@openai/agents`) | Multi-agent orchestration for text channels (WhatsApp, SMS, email) | Lightweight, TypeScript-native, handoff primitives match the existing BaseAgent/SupervisorAgent architecture. Replaces the homegrown orchestrator with a production framework. |
| **OpenAI SDK** | existing (`openai`) | LLM calls, embeddings, function calling | Already integrated, continue using |

**Confidence:** MEDIUM - The OpenAI Agents SDK is new (launched March 2025, JS version more recent) but directly from OpenAI, well-maintained, and the simplest path since OpenAI is already the LLM provider. The existing agent class hierarchy (BaseAgent, SupervisorAgent, specialists) maps cleanly to the SDK's Agent + handoff primitives.

**Why not LangGraph?** LangGraph is more powerful but significantly more complex. The existing codebase uses direct OpenAI calls -- adding LangChain/LangGraph would introduce a large dependency tree and new abstractions for modest benefit. The agent workflows here (classify intent, route to specialist, execute CRM action) are not complex enough to warrant graph-based orchestration.

**Why not build from scratch (current approach)?** The existing `AgentOrchestrator` is functional but reinvents conversation history management, retry logic, handoff protocols, and tracing. The OpenAI Agents SDK provides these out of the box with better reliability.

#### Agent Architecture (Text Channels)

```
Incoming Message (WhatsApp/SMS/Email)
  |
  +--> Supervisor Agent (@openai/agents)
        |
        +--> handoff --> Sales Agent
        +--> handoff --> Lettings Agent
        +--> handoff --> PM Agent (maintenance, arrears)
        +--> handoff --> Admin Agent (documents, contracts)
        |
        Each agent has tools:
        - searchProperties()
        - bookViewing()
        - createLead()
        - logMaintenanceRequest()
        - generateDocument()
        - sendMessage() (cross-channel)
```

### Knowledge Base / RAG

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **pgvector** | 0.8+ (Supabase extension) | Vector similarity search for property knowledge | Already on Supabase which has pgvector built-in. No new infrastructure. Store embeddings alongside relational property data in the same database. |
| **OpenAI text-embedding-3-small** | Current | Generate embeddings for property knowledge | 1536 dimensions, $0.02/1M tokens (extremely cheap). Sufficient quality for property descriptions, work histories, and system details. |

**Confidence:** HIGH - pgvector on Supabase is the obvious choice. The project already uses Supabase PostgreSQL. Adding a separate vector database (Pinecone, Weaviate) would be unnecessary infrastructure complexity for this use case.

#### Knowledge Base Schema (extends existing properties table)

```sql
-- Enable pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Property knowledge base entries
CREATE TABLE property_knowledge (
  id SERIAL PRIMARY KEY,
  property_id INTEGER REFERENCES properties(id),
  category TEXT NOT NULL, -- 'systems', 'certifications', 'work_history', 'notes'
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  embedding VECTOR(1536),
  metadata JSONB DEFAULT '{}',
  expiry_date TIMESTAMP, -- for certifications
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX ON property_knowledge
  USING hnsw (embedding vector_cosine_ops);
```

#### RAG Query Flow

```
Agent needs property info
  |
  +--> Embed query with text-embedding-3-small
  +--> Vector search property_knowledge WHERE property_id = X
  +--> Return top-K relevant chunks
  +--> Inject into agent context as tool response
```

### Multi-Channel Communication

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Twilio** | existing | SMS, WhatsApp, voice telephony | Already integrated. Vapi uses Twilio as telephony provider. |
| **Nodemailer/SMTP** | existing | Email sending | Already integrated |
| **IMAP Polling** | existing | Email receiving | Already integrated |
| **Microsoft Graph** | existing | Microsoft 365 email | Already integrated |

No new communication infrastructure needed. The AI agents orchestrate existing channels.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@vapi-ai/server-sdk` | ^0.11.0 | Vapi API access | Voice agent management, squad creation |
| `@openai/agents` | ^0.5.3 | Agent orchestration | Text channel agent routing and handoffs |
| `openai` | existing | LLM + embeddings | Already in project |
| `zod` | existing | Runtime validation | Validate agent tool inputs/outputs |
| `drizzle-orm` | existing | Database ORM | All database operations |
| `bullmq` | ^5.x | Job queue for async agent tasks | Background processing (follow-ups, document generation, scheduled calls) |
| `redis` / `ioredis` | ^5.x | BullMQ backend + conversation cache | Required by BullMQ; also caches active conversation state |

**Confidence on BullMQ:** MEDIUM - The existing codebase has a basic `jobQueue.ts` in the email service. BullMQ is the standard Node.js job queue for production workloads. Needed for: scheduled follow-up calls, arrears chasing schedules, document generation pipelines, retry logic for failed agent actions. Requires Redis, which is a new infrastructure dependency.

**Alternative if Redis is unwanted:** Use `pg-boss` (^10.x) instead -- PostgreSQL-backed job queue, no Redis needed. Slightly less performant but eliminates the Redis dependency. Given the project already uses Supabase PostgreSQL, pg-boss may be the pragmatic choice.

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `pg-boss` | ^10.x | PostgreSQL-backed job queue (alternative to BullMQ) | If Redis infrastructure is undesirable |

### Infrastructure (No Changes Needed)

| Technology | Status | Notes |
|------------|--------|-------|
| PostgreSQL (Supabase) | Existing | Add pgvector extension, new tables |
| Express.js | Existing | Add Vapi webhook routes |
| React frontend | Existing | Add agent dashboard pages |
| Docker/Render | Existing | No infrastructure changes |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Voice AI | Vapi | Retell AI | Existing integration is scaffolded (zero switching cost). Retell's multi-agent transfer is less mature. UK number provisioning issues reported. |
| Voice AI | Vapi | Bland AI | Bland optimised for outbound batch calling, not inbound multi-specialist routing |
| Voice AI | Vapi | Telnyx Voice AI | Newer, less ecosystem/documentation, fewer integrations |
| Agent Framework | OpenAI Agents SDK | LangGraph.js | Overengineered for this use case. Adds large dependency tree. Existing codebase uses OpenAI directly. |
| Agent Framework | OpenAI Agents SDK | Custom (current) | Current orchestrator reinvents solved problems (history, retries, tracing). SDK provides these free. |
| Vector DB | pgvector (Supabase) | Pinecone | Unnecessary separate service. pgvector handles this scale trivially. |
| Vector DB | pgvector (Supabase) | Weaviate | Same reason. Property knowledge base is thousands of entries, not millions. |
| Embeddings | text-embedding-3-small | text-embedding-3-large | 6.5x more expensive ($0.13 vs $0.02 per 1M tokens). Small model is sufficient for property descriptions and maintenance records. |
| Job Queue | pg-boss | BullMQ | BullMQ is faster but requires Redis. pg-boss uses existing PostgreSQL. For this workload (hundreds of tasks/day, not millions), pg-boss is sufficient and simpler. |

## Installation

```bash
# Voice AI
npm install @vapi-ai/server-sdk

# Agent orchestration
npm install @openai/agents

# Job queue (choose one)
npm install pg-boss        # PostgreSQL-backed (recommended - no Redis)
# OR
# npm install bullmq ioredis  # Redis-backed (if Redis already available)
```

### Environment Variables (New)

```bash
# Vapi
VAPI_API_KEY=           # Vapi dashboard API key
VAPI_SQUAD_ID=          # Created via API, stored for reference

# pgvector (no new env vars - uses existing DATABASE_URL)
# OpenAI embeddings (uses existing OPENAI_API_KEY)
```

### Database Setup

```bash
# Enable pgvector on Supabase (run in SQL editor or via migration)
CREATE EXTENSION IF NOT EXISTS vector;
```

## Key Integration Points with Existing Code

| Existing File | Integration |
|---------------|-------------|
| `server/voiceAgentService.ts` | Replace with Vapi-based implementation. Current file is entirely scaffolded. |
| `server/agents/BaseAgent.ts` | Adapt to use `@openai/agents` Agent class. Keep domain logic, replace infrastructure. |
| `server/agents/AgentOrchestrator.ts` | Replace queue/routing with `@openai/agents` Runner + handoffs. Keep CRM integration layer. |
| `server/agents/SupervisorAgent.ts` | Map to `@openai/agents` Agent with handoff tools to specialist agents. |
| `server/agents/specialists/*.ts` | Each becomes an `@openai/agents` Agent with CRM tool functions. |
| `shared/schema.ts` | Add property_knowledge table, conversation_threads table, agent_actions audit table. |
| `server/routes.ts` | Add Vapi webhook routes, agent API routes, knowledge base API routes. |

## Version Verification Notes

| Package | Verified Source | Date |
|---------|----------------|------|
| `@vapi-ai/server-sdk` 0.11.0 | npm registry | 2026-03-19 |
| `@openai/agents` 0.5.3 | npm registry | 2026-03-19 |
| pgvector on Supabase | Supabase docs | 2026-03-19 |
| text-embedding-3-small pricing ($0.02/1M) | OpenAI pricing page | 2026-03-19 |
| Vapi Squads feature | Vapi docs (docs.vapi.ai/squads) | 2026-03-19 |

## Sources

- [Vapi Squads Documentation](https://docs.vapi.ai/squads) - Multi-assistant routing
- [Vapi Custom Tools](https://docs.vapi.ai/tools/custom-tools) - Server-side function calling
- [Vapi Express Starter](https://github.com/VapiAI/vapi-express-starter) - Express.js webhook integration
- [Vapi Server SDK (npm)](https://www.npmjs.com/package/@vapi-ai/server-sdk) - TypeScript SDK
- [OpenAI Agents SDK (npm)](https://www.npmjs.com/package/@openai/agents) - Agent orchestration
- [OpenAI Agents SDK Docs](https://openai.github.io/openai-agents-js/) - TypeScript documentation
- [Supabase pgvector Docs](https://supabase.com/docs/guides/database/extensions/pgvector) - Vector embeddings setup
- [OpenAI Embeddings Models](https://platform.openai.com/docs/models/text-embedding-3-small) - Pricing and dimensions
- [Bland vs Vapi vs Retell Comparison](https://www.whitespacesolutions.ai/content/bland-ai-vs-vapi-vs-retell-comparison) - Provider comparison
- [Retell AI Pricing](https://www.retellai.com/pricing) - Pricing structure
- [Vapi Pricing](https://vapi.ai/pricing) - Pricing breakdown
- [AI Agent Frameworks Comparison (Langfuse)](https://langfuse.com/blog/2025-03-19-ai-agent-comparison) - Framework comparison
