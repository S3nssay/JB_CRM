# JB CRM — AI Agents & Property Knowledge Base

## What This Is

An AI-powered extension to the existing John Barclay Estate Agents CRM platform. This milestone adds two major capabilities: (1) a structured property knowledge base that captures work history, systems, certifications, and documents for every managed property, and (2) a team of specialist AI employees that handle phone calls, WhatsApp, SMS, and email across sales, lettings, property management, and administration — acting as autonomous agents that interact with callers and take real actions in the CRM.

## Core Value

AI agents handle real inbound communications (calls, WhatsApp, SMS, email) autonomously — answering questions, booking viewings, managing maintenance, chasing arrears, and generating contracts — so the human team focuses on high-value work instead of routine queries.

## Requirements

### Validated

<!-- Existing capabilities confirmed from codebase -->

- ✓ Property CRUD with full detail management — existing
- ✓ Landlord and tenant management — existing
- ✓ Tenancy lifecycle (onboarding, contracts, deposits) — existing
- ✓ Lead tracking and pipeline management — existing
- ✓ Invoice and finance management — existing
- ✓ Twilio SMS/WhatsApp integration — existing
- ✓ Voice agent service (Retell AI) — existing (basic)
- ✓ OpenAI integration for AI features — existing
- ✓ DocuSign electronic signatures — existing
- ✓ Email integration (SMTP/IMAP + Microsoft 365) — existing
- ✓ Stripe/GoCardless payment processing — existing
- ✓ AI agent class hierarchy (BaseAgent, SupervisorAgent, specialists) — existing (scaffold)
- ✓ Contractor/supplier database — existing

### Active

<!-- New capabilities for this milestone -->

**Property Knowledge Base:**
- [ ] Structured knowledge base per property (work history, heating systems, certifications, expiry dates)
- [ ] Document and certification tracking with expiry alerts
- [ ] Property systems inventory (heating, plumbing, electrical, gas)
- [ ] Maintenance/work history log with contractor records
- [ ] Knowledge base queryable by AI agents for context during calls

**AI Receptionist (General):**
- [ ] Voice AI agent that answers all inbound calls with natural speech
- [ ] Routes callers to the correct specialist based on intent detection
- [ ] Answers general estate agency questions (opening hours, services, fees)
- [ ] Seamless handoff between phone, WhatsApp, SMS, and email channels

**AI Sales Specialist:**
- [ ] Answers property sale enquiries using live CRM data
- [ ] Books viewings — checks agent availability and books slots directly
- [ ] Captures buyer leads when slots unavailable
- [ ] Follows up with interested buyers across channels

**AI Lettings Specialist:**
- [ ] Answers rental property enquiries using live CRM data
- [ ] Books viewings — checks availability and books directly
- [ ] Captures tenant leads when slots unavailable
- [ ] Follows up with prospective tenants across channels

**AI Admin Specialist:**
- [ ] Generates tenancy agreements (AST contracts)
- [ ] Generates sales memorandums
- [ ] Generates management agreements
- [ ] Handles onboarding document workflows
- [ ] Handles offboarding processes

**AI Property Management Specialist:**
- [ ] Takes maintenance/fault reports from tenants via any channel
- [ ] Escalates issues to appropriate contractors using property knowledge base
- [ ] Books contractors and generates quotes
- [ ] Follows up to verify work completion
- [ ] Chases rent arrears with calls/messages to tenants
- [ ] Attempts to secure payment commitments from arrears tenants

**Multi-Channel Infrastructure:**
- [ ] Unified conversation threading across phone, WhatsApp, SMS, email
- [ ] Agent memory — context persists across interactions and channels
- [ ] Audit trail of all AI agent actions in the CRM

### Out of Scope

- Mobile app — web-first platform
- Video calls — voice and text channels only
- AI outbound cold-calling — agents respond to inbound only (except arrears chasing and follow-ups)
- Custom voice training — use provider's pre-built voices
- AI handling financial transactions directly — humans approve payments

## Context

The CRM already has a working AI agent class hierarchy (`server/agents/`) with BaseAgent, SupervisorAgent, and specialist stubs (Maintenance, Marketing, Sales, Rental, LeadGen, OfficeAdmin). These need to be evolved from scaffolds into production agents connected to real communication channels.

Retell AI is already integrated for voice (`server/voiceAgentService.ts`) but appears basic. The voice provider choice needs research — Retell may or may not be the best fit for UK estate agency use with multi-specialist routing.

Twilio handles SMS and WhatsApp already. DocuSign handles electronic signatures. These integrations are available for the AI agents to orchestrate.

The contractor database already exists in the CRM, so the PM specialist can look up and contact contractors directly.

## Constraints

- **Tech stack**: Must build within existing Express/React/PostgreSQL stack — no microservices
- **Voice provider**: Needs research — must support UK phone numbers, natural conversation, and tool-calling for CRM actions
- **Compliance**: AI agents must identify themselves as AI to callers (UK regulations)
- **Data privacy**: Property knowledge base must respect GDPR — tenant data handling requires care
- **Cost**: Voice AI has per-minute costs — need to understand pricing before committing to a provider

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Build property knowledge base before AI agents | Agents need property context to answer questions intelligently | — Pending |
| Research voice AI providers | Current Retell integration may not be optimal; need UK support + tool-calling | — Pending |
| Multi-channel from day one | User wants seamless phone/WhatsApp/SMS/email — not phased rollout | — Pending |
| Live deployment (not demo-first) | "Done" means real callers interact with AI agents | — Pending |

---
*Last updated: 2026-03-19 after initialization*
