# Project Research Summary

**Project:** JB CRM — AI Agents Milestone
**Domain:** Multi-specialist AI agent system for UK estate agency (voice, text, property intelligence)
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH

## Executive Summary

This milestone adds a production-grade AI agent system to an existing CRM platform for John Barclay Estate Agents. The system must answer inbound calls 24/7, route callers to named specialist agents (Sales, Lettings, Property Management, Admin), query live CRM data to answer property questions, book viewings, capture leads, and handle maintenance requests. The property knowledge base — structured per-property records of systems, certifications, and maintenance history — is the intelligence layer that separates this from a generic chatbot and is the single most important foundational deliverable.

The recommended approach is: Vapi for voice AI (Squads feature maps directly to the receptionist-to-specialist routing pattern), OpenAI function calling for text channels (SMS, WhatsApp, email), and pgvector on the existing Supabase PostgreSQL for the knowledge base. The existing codebase already has scaffolded agent classes (BaseAgent, SupervisorAgent, specialists) and communication services (Twilio, SMTP/IMAP, WhatsApp) — the work is replacing scaffolding with real implementations, not building from scratch. Critically, the existing `voiceAgentService.ts` is entirely mocked, so switching from Retell to Vapi has zero switching cost.

The three highest risks are: (1) voice tool-call latency causing dead air and caller abandonment — mitigated by pre-loading call context and designing the knowledge base for sub-100ms retrieval; (2) multi-agent routing misclassifying intent and routing to the wrong specialist — mitigated by caller identity lookup before routing and a two-step receptionist-then-specialist pattern; and (3) conversation context being siloed per channel — mitigated by building a unified conversation store before any specialist agents go live. Both the property knowledge base schema and the unified conversation threading must exist before agents are built, not after.

## Key Findings

### Recommended Stack

The stack leverages the existing infrastructure heavily. Vapi (`@vapi-ai/server-sdk` v0.11.0) handles voice via Twilio (already integrated) and exposes tool calls as HTTP webhooks to the Express server — no audio stream management required. The OpenAI Agents SDK (`@openai/agents` v0.5.3) provides multi-agent handoffs, tracing, and conversation history management for text channels, replacing the homegrown `AgentOrchestrator`. pgvector (already available on Supabase) provides vector similarity search for the property knowledge base with no new infrastructure. pg-boss (PostgreSQL-backed job queue) is preferred over BullMQ to avoid a Redis dependency, given the expected workload is hundreds of tasks per day.

**Core technologies:**
- **Vapi** (`@vapi-ai/server-sdk` v0.11.0): Voice AI platform — Squads feature built for receptionist-to-specialist routing; uses existing Twilio; Express webhook-compatible
- **OpenAI Agents SDK** (`@openai/agents` v0.5.3): Multi-agent orchestration for text channels — replaces homegrown orchestrator with handoffs, tracing, retry logic
- **pgvector** (Supabase extension): Property knowledge base vector search — already available, no new infrastructure
- **text-embedding-3-small**: Property knowledge embeddings — $0.02/1M tokens, sufficient for property descriptions and maintenance records
- **pg-boss** (v10.x): Async job queue for follow-ups and scheduled tasks — PostgreSQL-backed, no Redis required
- **All communication services**: Twilio, SMTP/IMAP, WhatsApp, Microsoft Graph — all already integrated, no new providers needed

### Expected Features

**Must have (table stakes) — P1, launch blockers:**
- 24/7 inbound call answering with natural British English
- Intent detection and specialist routing (Supervisor agent)
- Property enquiry answering from live CRM data (Sales and Lettings agents)
- Viewing booking with availability checking
- Lead capture (name, phone, email, requirements, budget)
- Maintenance request intake with work order creation
- AI self-identification as AI (UK regulatory requirement)
- Human escalation/transfer path
- Database-persisted audit trail of all agent actions
- Property knowledge base schema (certifications, systems, maintenance history)

**Should have (competitive differentiators) — P2, add after core validated:**
- Multi-channel follow-ups (WhatsApp/SMS after voice calls)
- Cross-channel conversation memory (unified threading)
- Compliance certification tracking with expiry alerts (gas safety, EICR, EPC)
- Property systems inventory (boiler, electrical, heating per property)
- Contractor dispatch based on knowledge base
- Arrears chasing (outbound voice + SMS + WhatsApp, with strict frequency limits)

**Defer to v2+:**
- AI-generated contract assembly (AST, management agreements) — requires solicitor-reviewed templates and Renters' Rights Act 2025 compliance; high legal risk if rushed
- Predictive arrears detection — requires historical data and careful GDPR handling
- Multilingual support — provider-level capability, enable when English variant is battle-tested
- AI valuation assistance — requires market data integration and heavy legal caveats

**Anti-features (never build):**
- AI handling financial transactions directly (PCI-DSS, tenant dispute liability)
- AI cold-calling potential sellers/landlords (TPS register, GDPR)
- Fully autonomous offer negotiation (legal and reputational risk)
- AI providing legal advice (illegal in UK without qualification)

### Architecture Approach

The system follows a Supervisor-Specialist pattern with a Channel Gateway normalising all inbound communications into a unified `IncomingMessage` format. All channels (voice via Vapi, SMS, WhatsApp, email) share the same Tool Registry for CRM actions and the same Conversation Store for threading. The existing agent class hierarchy maps cleanly to this pattern — the primary work is replacing stub implementations with real tool bindings and replacing in-memory state with database persistence. Voice (Vapi) and text agents (OpenAI function calling) share the same Tool Registry to ensure consistent CRM behaviour regardless of channel.

**Major components:**
1. **Channel Gateway** — normalises webhooks from all communication providers into `IncomingMessage`; resolves contact identity by phone/email before routing
2. **Conversation Store** — PostgreSQL-backed conversation threading; links voice, SMS, WhatsApp, email for the same contact into one thread
3. **Tool Registry** — centralised registry of typed CRM action functions with permission tiers; shared by voice and text agents; enforces action classification (read-only, confirm-before-execute, human-approval-required)
4. **Supervisor Agent** — intent classification only (low-token, temperature 0.1 call); routes to correct specialist; falls back to receptionist if confidence below 70%
5. **Specialist Agents** (Sales, Lettings, PM, Admin) — domain-specific response generation with real tool bindings; existing scaffolds need real implementations
6. **Property Knowledge Base** — structured per-property data (certifications, systems, work history) with `last_verified_at` and `expires_at` on every dated record
7. **Voice Provider Adapter (Vapi)** — manages Vapi Squad configuration, handles tool-call webhooks during live calls, threads call transcripts into Conversation Store on call end
8. **Audit Logger** — immutable, database-persisted record of every agent decision, tool invocation, and escalation; compliance requirement

### Critical Pitfalls

1. **Voice tool-call latency causes caller abandonment** — Pre-load call context (tenant/landlord record, active tenancy, property details) before the voice agent picks up. Design knowledge base for sub-100ms indexed retrieval. Implement filler speech ("Let me check that for you") while tool calls execute. Target <2s end-to-end response for 95th percentile.

2. **Multi-agent routing black holes** — Identify caller by phone number before routing intent classification. Use a two-step pattern: receptionist gathers context, then routes. Deploy receptionist in logging-only mode for one week before connecting specialists. Fall back to receptionist for intent confidence below 70%.

3. **Stale knowledge base gives confidently wrong answers** — Every schema entity with a date must have `last_verified_at` and `expires_at` columns. Build automated staleness alerts. Agents should qualify uncertain data: "According to our records from [date]...". Build update triggers into existing contractor invoice and DocuSign workflows.

4. **AI agents taking destructive CRM actions** — Classify every tool into tiers: Tier 1 (autonomous: read, log notes, create leads), Tier 2 (confirm with caller: book viewings, create tickets), Tier 3 (human approval: modify bank details, cancel tenancies, generate legal documents). Never expose financial write operations as agent-callable tools.

5. **Arrears chasing triggers harassment claims** — Hard-code frequency limits (max 1 call + 1 message per 48 hours, no contact on Sundays or after 8pm) as code constraints, not prompt instructions. Vulnerability keyword detection must immediately escalate to human. Escalate to human case management after 3 unsuccessful automated contacts regardless.

## Implications for Roadmap

Based on the dependency graph in ARCHITECTURE.md and the pitfall-to-phase mapping in PITFALLS.md, the recommended phase sequence is:

### Phase 1: Foundation — Conversation Store, Contact Resolution, Tool Registry, Property Knowledge Base

**Rationale:** Agents cannot act without tools, and tools need the database schema. Unified conversation threading must exist before any specialist agent because every specialist depends on shared context. The knowledge base must be designed before agents are built because retrofitting indexed columns under live traffic is painful. This phase has no external provider dependencies — it is entirely within the existing stack.

**Delivers:** Database schema additions (conversations, conversation_messages, contact_identities, agent_audit_log, property_knowledge_base), Tool Registry framework with first 5 tools (search_properties, book_viewing, create_lead, create_maintenance_ticket, query_knowledge_base), Channel Gateway for SMS and WhatsApp normalisation, Response Dispatcher, Audit Logger.

**Addresses:** Cross-channel context loss pitfall, stale knowledge base pitfall, audit trail requirement, action tier classification.

**Avoids:** Building channels in isolation (which would require a rewrite to unify), skipping staleness detection (which means compliance failures).

### Phase 2: AI Receptionist and Text-Channel Agents

**Rationale:** The receptionist (Supervisor) must be proven in isolation before specialists go live. ARCHITECTURE.md recommends deploying the receptionist in logging-only mode for one week before connecting specialists. Text-channel agents (SMS, WhatsApp, email) are lower stakes than voice — a misrouted text can be corrected; a misrouted live call damages trust.

**Delivers:** Real Supervisor Agent with intent classification and confidence-gated routing, Sales Agent with property search and viewing booking, Lettings Agent (mirrors Sales for rentals), PM/Maintenance Agent with ticket creation and knowledge base lookup, all wired to Channel Gateway for synchronous webhook processing.

**Uses:** OpenAI Agents SDK for handoffs and conversation management, Tool Registry from Phase 1.

**Implements:** Channel-agnostic message processing pattern, Agent tool permissions pattern, synchronous webhook processing (replacing polling).

**Avoids:** Polling-based task queue anti-pattern, agents deciding without acting anti-pattern, in-memory state anti-pattern.

### Phase 3: Voice Integration (Vapi)

**Rationale:** Voice depends on Phase 2 because Vapi tool calls need working specialist agents behind them. Voice is the highest-stakes channel — latency, routing errors, and personality all matter more on a live call. The foundation and agents must be battle-tested before voice goes live.

**Delivers:** Vapi Squad configuration with receptionist and specialist voice assistants, Vapi tool-call webhook endpoints (hitting the same Tool Registry from Phase 1), call lifecycle handling (start, end, transcript threading into Conversation Store), pre-call context loading for known callers, filler speech patterns.

**Uses:** Vapi `@vapi-ai/server-sdk`, existing Twilio phone numbers.

**Avoids:** Voice latency pitfall (pre-loaded context), voice agent as separate system anti-pattern (shared Tool Registry and Conversation Store).

### Phase 4: Agent Dashboard and Monitoring

**Rationale:** The dashboard can start development during Phase 3 but depends on the audit data accumulated during Phases 2-3. Staff need visibility into agent decisions, escalation queues, and cost tracking before the system handles volume.

**Delivers:** React UI for agent activity monitoring, conversation thread viewer with cross-channel history, escalation queue for human review, per-agent cost/performance metrics, staleness alerts for knowledge base entries.

**Implements:** Agent Dashboard component from ARCHITECTURE.md.

### Phase 5: Multi-Channel Extensions and Arrears Chasing

**Rationale:** Arrears chasing (outbound) and cross-channel follow-ups (WhatsApp after a voice call) are high-value but high-risk features that must be added after the core inbound system is proven reliable. Arrears chasing in particular has compliance requirements (harassment law, vulnerability protocols) that need the audit trail and monitoring from Phase 4 to be in place first.

**Delivers:** Outbound arrears chasing with hard-coded frequency limits, vulnerability escalation detection, WhatsApp/SMS follow-ups after voice interactions, compliance certification expiry alerts, property systems inventory CRUD.

**Avoids:** Arrears harassment pitfall (Phase 4 audit trail and monitoring required first).

### Phase Ordering Rationale

- Schema-first ordering mirrors the project's own development rules: database schema must precede any code that uses it
- The knowledge base is the "intelligence layer" that makes agents useful; agents without property context give generic answers — this validates Phase 1 priority
- The Conversation Store must precede all channels to avoid the "build in isolation then rewrite to unify" trap (identified in PITFALLS.md as one of the highest-cost technical debts)
- Voice is last among the core phases because it compounds every failure mode (latency, routing, personality) into a live caller experience
- Arrears chasing is Phase 5 because its compliance requirements (harassment law, vulnerability protocols) need proven monitoring infrastructure

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3 (Voice/Vapi):** Vapi Squads configuration for UK phone numbers and Twilio SIP integration needs hands-on testing before detailed planning. Voice provider choice (Vapi vs Retell) should be validated against a real UK number. ARCHITECTURE.md notes MEDIUM confidence on voice provider choice.

- **Phase 5 (Arrears Chasing):** UK Pre-Action Protocol for Possession Claims and FCA vulnerability guidance require specific compliance rules that should be reviewed by a property solicitor before implementation. The frequency limits and escalation rules in PITFALLS.md are a starting point, not a complete compliance specification.

Phases with standard patterns (skip research-phase):

- **Phase 1 (Foundation):** PostgreSQL schema design, Drizzle ORM, pgvector setup on Supabase — all well-documented with official sources. Patterns are established and the technology is already in use.

- **Phase 2 (Text Agents):** OpenAI function calling and the Supervisor-Specialist pattern are stable, well-documented, and already partially implemented in the codebase. The OpenAI Agents SDK is from the primary vendor with full TypeScript documentation.

- **Phase 4 (Dashboard):** Standard React + TanStack Query dashboard UI with existing shadcn/ui components. No novel patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Vapi and OpenAI Agents SDK verified on npm registry and official docs. pgvector on Supabase confirmed. Pricing verified. Main uncertainty is Vapi-Twilio-UK-number SIP configuration in production. |
| Features | MEDIUM-HIGH | Competitor analysis is multi-source (Nesti, EliseAI, Dwelly). UK compliance requirements (AI self-identification, tenant fees, arrears protocols) verified against sector-specific legal sources. |
| Architecture | HIGH | Supervisor-Specialist pattern is well-established. Build order validated by both ARCHITECTURE.md and FEATURES.md dependency graphs independently producing the same sequence. Direct function calling pattern is stable OpenAI API. |
| Pitfalls | HIGH | Multi-source verification: GitHub multi-agent failure analysis, UK property legal sources (Guild of Letting, LandlordZone), voice AI platform benchmarks. Pitfall-to-phase mapping gives actionable prevention steps. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Vapi UK telephony configuration:** Exact Twilio-to-Vapi SIP/webhook forwarding configuration for a UK number needs hands-on testing. The architecture is correct; the specific provider configuration needs validation during Phase 3 planning.

- **Renters' Rights Act 2025 AST template requirements:** Contract generation (Phase 5+) requires solicitor-reviewed templates. PITFALLS.md provides the risk framing; the specific clause requirements need professional legal input before Phase 5 planning.

- **Vulnerability keyword detection scope:** PITFALLS.md identifies this as required for arrears chasing but does not specify the keyword list or classification logic. This needs input from a debt-collection compliance specialist before Phase 5 implementation.

- **OpenAI Agents SDK maturity for text agents vs direct function calling:** ARCHITECTURE.md notes that direct OpenAI function calling (existing pattern) may be preferred over the Agents SDK for text channels because the codebase already uses it. STACK.md recommends the Agents SDK. This tension should be resolved during Phase 2 planning — the decision does not affect Phase 1.

## Sources

### Primary (HIGH confidence)
- [Vapi Squads Documentation](https://docs.vapi.ai/squads) — multi-assistant routing architecture
- [Vapi Server SDK (npm)](https://www.npmjs.com/package/@vapi-ai/server-sdk) — v0.11.0 verified
- [OpenAI Agents SDK (npm)](https://www.npmjs.com/package/@openai/agents) — v0.5.3 verified
- [OpenAI Agents SDK Docs](https://openai.github.io/openai-agents-js/) — TypeScript documentation
- [Supabase pgvector Docs](https://supabase.com/docs/guides/database/extensions/pgvector) — vector extension setup
- [OpenAI Embeddings Models](https://platform.openai.com/docs/models/text-embedding-3-small) — pricing and dimensions
- [The Dangers of Using AI to Draft Tenancy Agreements](https://www.guildofletting.com/blog/the-dangers-of-using-ai-to-draft-tenancy-agreements-why-professional-expertise-remains-essential) — Guild of Letting & Management
- [Multi-agent workflows often fail](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/) — GitHub failure analysis

### Secondary (MEDIUM confidence)
- [Nesti - AI for Estate & Letting Agents](https://www.nesti.io/) — competitor feature analysis
- [EliseAI - Industry Leading AI for Property Management](https://eliseai.com/) — competitor analysis
- [Dwelly raises $93M for AI-driven UK lettings](https://fortune.com/2026/02/25/dwelly-ai-roll-up-uk-lettings-agencies-real-estate-brokerages-93-million-new-venture-captial-funding-to-fuel-expansion/) — market context
- [Retell AI vs Vapi comparison](https://www.retellai.com/comparisons/retell-vs-vapi) — voice provider comparison
- [AI Compliance and Cost Pressures Reshape Estate Agency 2026](https://londonbusinessjournal.co.uk/2026/02/02/uk-estate-agents-2026-ai-compliance-efficiency/) — industry context
- [EICR, EPC & Gas Safety 2026 Obligations](https://www.ashworth-group.co.uk/news-blog/eicr-epc-gas-safety-explained-the-2026-landlords-obligations/) — compliance requirements
- [AI-enhanced rent collection: protecting vulnerable tenants](https://www.accesspaysuite.com/blog/ai-enhanced-rent-collection-protecting-vulnerable-tenants-without-sacrificing-revenue/) — arrears AI approaches

### Tertiary (LOW confidence — needs validation)
- [Bland vs Vapi vs Retell Comparison](https://www.whitespacesolutions.ai/content/bland-ai-vs-vapi-vs-retell-comparison) — vendor comparison (third-party blog, verify before committing to Vapi)
- [Vapi Pricing](https://vapi.ai/pricing) — $0.05/min base; verify against actual invoice at scale

---
*Research completed: 2026-03-19*
*Ready for roadmap: yes*
