# Feature Research

**Domain:** AI-powered estate agency agents with property knowledge base
**Researched:** 2026-03-19
**Confidence:** MEDIUM-HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features that every AI-enabled estate agency platform must have. Competitors like Nesti, EliseAI, and Dwelly already ship these. Missing any of these makes the AI agent system feel broken or unusable.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **24/7 inbound call answering** | Agents miss 5-10 calls/week per branch; 85% of callers never call back. Every AI estate agency competitor answers calls 24/7. | HIGH | Voice AI provider required (Retell already integrated as scaffold). Must handle natural British English conversation. |
| **Intent detection and specialist routing** | Callers expect to reach the right department. Nesti and EliseAI both auto-classify and route. Without this, AI is just a glorified voicemail. | MEDIUM | Supervisor agent already scaffolded in `SupervisorAgent.ts`. Needs real intent classification: sales vs lettings vs maintenance vs admin vs general. |
| **Property enquiry answering from live data** | If the AI cannot answer "How much is 42 Elgin Avenue?" or "Is that flat still available?", it fails its core purpose. Nesti, EliseAI, and Dwelly all query live listings. | MEDIUM | Agents need read access to `properties` table. Sales and Rental agent scaffolds exist but lack CRM data integration. |
| **Viewing booking** | 78% of buyers work with the first agent who responds. Booking viewings during the call (not "someone will call you back") is table stakes for AI receptionists. | MEDIUM | Requires availability/calendar system. `viewingAppointments` table exists in schema. Needs slot checking and conflict detection. |
| **Lead capture when no viewing available** | If the AI cannot book a viewing, it must at minimum capture name, phone, email, requirements, and budget. Every competitor does this. | LOW | `leads` table already exists with full schema. Straightforward insert from agent context. |
| **Multi-channel consistency** | EliseAI's core value prop: text, email, chat, voice all share context. Tenants and buyers expect to call, then get a WhatsApp confirmation, then email details. | HIGH | Requires unified conversation threading. Twilio (SMS/WhatsApp) and email (SMTP/IMAP/M365) already integrated. Need shared conversation state. |
| **Maintenance request intake** | Tenants expect to report issues via phone or WhatsApp and get acknowledgement + timeline. Dwelly reduced resolution from 50 to 20 days with AI triage. | MEDIUM | Maintenance agent scaffold exists with priority guidelines. Needs to create work orders and notify contractors. |
| **AI self-identification** | UK regulations require AI to identify itself as AI to callers. Not optional. | LOW | System prompt already says "Sarah" but must explicitly state it is an AI assistant. Simple prompt change. |
| **Escalation to human** | Every AI system must have a clear "transfer to a person" path. Users become hostile when trapped in AI loops. EliseAI hands off for sensitive/detailed questions. | LOW | Escalation action already defined in BaseAgent. Needs actual phone transfer or notification to human staff. |
| **Audit trail of AI actions** | Every action the AI takes in the CRM (booking, lead creation, status change) must be logged with timestamp, channel, and reasoning. Required for compliance and trust. | MEDIUM | Activity logging exists in BaseAgent (in-memory). Needs database persistence with full audit fields. |
| **Property knowledge base - compliance certifications** | Gas Safety (CP12, annual), EICR (5-yearly), EPC (10-yearly), smoke/CO alarms, fire safety. Missing expiry tracking = legal liability. Every PM platform tracks these. | MEDIUM | Need structured tables for certifications with expiry dates, auto-alerts, and status tracking. Some document tracking exists in `document` table. |
| **Property knowledge base - maintenance history** | When a tenant calls about a boiler, the AI needs to know: what boiler, last service date, who serviced it, warranty status. Without history, AI cannot triage intelligently. | MEDIUM | Need work history log per property linked to contractors. Contractor database already exists. |

### Differentiators (Competitive Advantage)

Features that go beyond what most competitors offer. These are where John Barclay can stand out as a premium AI-powered agency.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Specialist AI employees (not generic chatbot)** | Most competitors have one general AI. JB's approach of named specialists (Sales Agent, Lettings Agent, PM Agent, Admin Agent) with distinct personalities creates a premium feel. Callers interact with specialists, not a generic bot. | MEDIUM | Agent class hierarchy already scaffolded. Needs production prompts, CRM tool-calling, and personality tuning per specialist. |
| **Autonomous arrears chasing** | AI proactively contacts tenants with overdue rent via call, SMS, WhatsApp. Secures payment commitments. Most PM platforms send automated emails; few use voice AI for arrears. Dwelly does triage but not proactive outbound arrears calls. | HIGH | This is outbound AI (not just inbound). Needs rent ledger integration, payment tracking, escalation rules, and compliance with UK debt collection regulations. Sensitive area requiring careful tone. |
| **AI-powered contractor dispatch** | When maintenance is reported, AI looks up the property knowledge base (what system, warranty, preferred contractor), contacts the contractor, gets availability, and books. Most competitors stop at "we'll get someone to call you." | HIGH | Requires property systems inventory, contractor database integration, availability checking, and quote management. Contractor DB exists. |
| **Contract generation (AST, management agreements, sales memos)** | AI Admin agent generates tenancy agreements, management contracts, and sales memorandums from CRM data. DocuSign integration sends for signature. Most competitors require manual document prep. | HIGH | DocuSign already integrated. Need template system with variable injection from CRM data. CRITICAL: Must comply with Renters' Rights Act 2025/2026 -- templates must be legally reviewed. AI should assemble, not draft from scratch. |
| **Cross-channel conversation memory** | Caller phones about a property, gets WhatsApp with details, emails back with questions, calls again -- AI remembers the entire thread. EliseAI does this; most UK competitors do not. | HIGH | Requires unified contact record, conversation history across channels, and context injection into every agent interaction. |
| **Predictive compliance alerts** | AI monitors certification expiry dates and proactively alerts: "Gas safety certificate for 42 Elgin Ave expires in 30 days. Shall I book the Gas Safe engineer?" Mobysoft predicts arrears 3 months ahead with 87% accuracy. | MEDIUM | Once knowledge base has expiry dates, scheduling alerts is straightforward. The intelligence is in the data model, not the alerting. |
| **Property systems inventory** | Structured record of every system in a property: boiler make/model/install date, electrical board type, heating system, plumbing configuration. Powers intelligent maintenance triage. | MEDIUM | New data model needed. Not complex per property but comprehensive across portfolio. Feeds into contractor dispatch and compliance tracking. |
| **Multilingual support** | Nesti supports 16 languages. West London has diverse demographics. AI that handles enquiries in multiple languages captures leads competitors miss. | LOW | Modern voice AI providers (Retell, ElevenLabs) support multilingual. Mostly a provider capability, not custom code. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem appealing but create more problems than they solve.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **AI handling financial transactions** | "Let the AI take rent payments during arrears calls" | Massive compliance risk. PCI-DSS requirements. Tenant disputes. Chargebacks. One error = legal liability. | AI secures payment *commitments* and sends payment links (Stripe/GoCardless). Human approves actual transactions. |
| **Custom voice training/cloning** | "Make the AI sound like our actual receptionist" | Expensive, uncanny valley effect, consent issues, maintenance burden. Voice cloning regulations evolving. | Use provider's pre-built professional British voices. Focus on script quality, not voice mimicry. |
| **AI outbound cold-calling** | "Have the AI call potential sellers/landlords" | UK cold-calling regulations (TPS register), reputational risk, low conversion, GDPR consent issues. Aggressive and brand-damaging for a premium agency. | AI handles inbound + follow-ups with existing leads only. Outbound limited to arrears chasing and appointment confirmations. |
| **Fully autonomous offer negotiation** | "Let the AI negotiate between buyer and seller" | Negotiation requires judgment, relationship sensitivity, and legal awareness that AI cannot reliably provide. One bad negotiation = lost sale + reputation damage. | AI captures offers, presents to human agents with context, suggests counter-offer ranges based on comparables. Human decides. |
| **Real-time property valuation by AI** | "AI should give instant valuations on calls" | Inaccurate valuations create legal liability and unrealistic expectations. Automated Valuation Models (AVMs) have significant error margins. | AI books valuation appointments with human agents. Can provide *indicative* price ranges based on comparable sold data with heavy caveats. |
| **AI-generated legal advice** | "AI should explain tenancy rights to callers" | Providing legal advice without qualification is illegal in the UK. Misadvice creates liability. | AI provides factual information ("your tenancy agreement says X") and refers legal questions to qualified advisors. |
| **Video call AI agent** | "Add video calls for virtual viewings" | Massive complexity increase, bandwidth requirements, uncanny valley for AI video personas, limited value over voice + photos. | Send property photos/videos via WhatsApp during or after voice call. Book in-person or human-led video viewings. |

## Feature Dependencies

```
Property Knowledge Base (foundation)
    |
    |-- Compliance Certifications
    |       |-- Predictive Compliance Alerts
    |
    |-- Property Systems Inventory
    |       |-- Intelligent Maintenance Triage
    |               |-- Contractor Dispatch
    |
    |-- Maintenance History
            |-- Intelligent Maintenance Triage

AI Agent Infrastructure (foundation)
    |
    |-- Intent Detection & Routing (Supervisor)
    |       |
    |       |-- Sales Specialist
    |       |       |-- Property Enquiry Answering
    |       |       |-- Viewing Booking
    |       |       |-- Lead Capture
    |       |
    |       |-- Lettings Specialist
    |       |       |-- Property Enquiry Answering
    |       |       |-- Viewing Booking
    |       |       |-- Lead Capture
    |       |
    |       |-- PM Specialist
    |       |       |-- Maintenance Request Intake
    |       |       |-- Arrears Chasing (outbound)
    |       |       |-- Contractor Dispatch
    |       |
    |       |-- Admin Specialist
    |               |-- Contract Generation
    |                       |-- DocuSign Integration (existing)
    |
    |-- Multi-Channel Infrastructure
    |       |-- Unified Conversation Threading
    |       |-- Cross-Channel Memory
    |
    |-- Audit Trail (database persistence)

Voice AI Provider (external dependency)
    |-- 24/7 Call Answering
    |-- Specialist Routing (via tool-calling)
    |-- Human Escalation/Transfer
```

### Dependency Notes

- **Property Knowledge Base must come before AI agents:** Agents without property context give generic, unhelpful answers. The knowledge base is the foundation that makes agents intelligent. This is validated by the PROJECT.md decision.
- **Intent detection must come before specialists:** Without the supervisor routing correctly, specialist agents never receive tasks. This is the gateway.
- **Multi-channel infrastructure must come before cross-channel memory:** You cannot remember conversations across channels without unified conversation threading first.
- **Property systems inventory enables contractor dispatch:** Without knowing what boiler a property has, the AI cannot dispatch the right contractor or assess warranty.
- **Compliance certifications enable predictive alerts:** Cannot alert on expiry dates if expiry dates are not tracked.
- **Contract generation depends on Admin specialist + DocuSign:** Templates must exist, CRM data must be accessible, and DocuSign must handle signing. DocuSign is already integrated.

## MVP Definition

### Launch With (v1)

Minimum viable AI agent system. Prove the concept works with real callers.

- [ ] **Property knowledge base schema** -- structured tables for certifications, systems, maintenance history
- [ ] **24/7 inbound call answering** -- voice AI answers all calls with natural British English
- [ ] **Intent detection and routing** -- supervisor classifies caller intent and routes to specialist
- [ ] **Sales/Lettings property enquiry answering** -- agents query live CRM data to answer property questions
- [ ] **Viewing booking** -- agents check availability and book directly
- [ ] **Lead capture** -- agents capture contact details and requirements when viewings unavailable
- [ ] **Maintenance request intake** -- PM agent takes fault reports and creates work orders
- [ ] **AI self-identification and human escalation** -- compliance and safety net
- [ ] **Audit trail** -- database-persisted log of all AI actions

### Add After Validation (v1.x)

Features to add once core call handling is proven reliable.

- [ ] **Multi-channel consistency** -- WhatsApp/SMS follow-ups after calls, email confirmations
- [ ] **Cross-channel conversation memory** -- context persists when tenant calls then WhatsApps
- [ ] **Compliance certification tracking with alerts** -- gas safety, EICR, EPC expiry monitoring
- [ ] **Property systems inventory** -- boiler, electrical, heating system records per property
- [ ] **Contractor dispatch** -- AI contacts contractors based on property knowledge base
- [ ] **Arrears chasing** -- outbound calls/messages to tenants with overdue rent

### Future Consideration (v2+)

Features to defer until the agent system is battle-tested.

- [ ] **Contract generation** -- AST, management agreements, sales memos. Requires legal review of templates and Renters' Rights Act compliance. Defer because regulatory risk is high if done wrong.
- [ ] **Predictive arrears detection** -- ML model predicting which tenants will fall into arrears. Requires significant historical data and careful GDPR handling.
- [ ] **Multilingual support** -- valuable for West London demographics but adds testing complexity. Provider-level feature, can be enabled when ready.
- [ ] **AI-powered valuation assistance** -- indicative price ranges from comparable data. Requires market data integration and heavy caveats.

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Property knowledge base schema | HIGH | MEDIUM | P1 |
| 24/7 inbound call answering | HIGH | HIGH | P1 |
| Intent detection and routing | HIGH | MEDIUM | P1 |
| Property enquiry answering (sales/lettings) | HIGH | MEDIUM | P1 |
| Viewing booking | HIGH | MEDIUM | P1 |
| Lead capture | HIGH | LOW | P1 |
| Maintenance request intake | HIGH | MEDIUM | P1 |
| AI self-identification | HIGH | LOW | P1 |
| Human escalation | HIGH | LOW | P1 |
| Audit trail (DB-persisted) | HIGH | MEDIUM | P1 |
| Multi-channel follow-ups | HIGH | HIGH | P2 |
| Cross-channel conversation memory | MEDIUM | HIGH | P2 |
| Compliance certification tracking | HIGH | MEDIUM | P2 |
| Property systems inventory | MEDIUM | MEDIUM | P2 |
| Contractor dispatch | MEDIUM | HIGH | P2 |
| Arrears chasing (outbound) | HIGH | HIGH | P2 |
| Contract generation | MEDIUM | HIGH | P3 |
| Predictive arrears | MEDIUM | HIGH | P3 |
| Multilingual support | LOW | LOW | P3 |

**Priority key:**
- P1: Must have for launch -- the AI agent is not useful without these
- P2: Should have, add after core is validated -- these multiply the value of P1 features
- P3: Nice to have, future consideration -- valuable but high risk or low urgency

## Competitor Feature Analysis

| Feature | Nesti (UK) | EliseAI (US) | Dwelly (UK) | Our Approach |
|---------|-----------|-------------|-------------|--------------|
| Voice call answering | Yes, every call | Yes, multi-channel | Yes, chatbot triage | Yes, specialist routing |
| Lead qualification | Yes, structured questions | Yes, automated | Yes, 10 offers in 3 days | Yes, per-specialist qualification |
| Viewing booking | Yes, calendar integration | Yes, tour scheduling | Not primary focus | Yes, availability checking |
| Maintenance triage | Not primary focus | Yes, ResidentAI | Yes, reduced resolution 50->20 days | Yes, with property knowledge base context |
| Arrears chasing | No | Yes, delinquency outreach | Not reported | Yes, outbound voice + SMS + WhatsApp |
| Contract generation | No | Not reported | Not reported | Yes (v2), template-based with DocuSign |
| Property knowledge base | Listings + area info | Not reported | Not reported | Yes, deep per-property systems/certifications/history |
| Multi-channel | Voice + chat + WhatsApp | Text + email + chat + voice | Chat + email | Voice + WhatsApp + SMS + email |
| CRM integration | External CRMs | Own CRM | Own platform | Built into own CRM (major advantage) |
| Specialist agents | Single AI | Single AI | Single AI | Multiple named specialists (differentiator) |
| Languages | 16 | 7 voice, 51 text | Not reported | English first, multilingual via provider later |

**Key competitive insight:** Most competitors use a single generalist AI. JB's approach of multiple named specialist agents (Sales, Lettings, PM, Admin) with distinct personalities and deep CRM integration is a genuine differentiator. The property knowledge base (systems, certifications, maintenance history) is also unique -- competitors know listings but not the building itself.

**Biggest advantage:** The AI agents are built into the CRM, not bolted on. No data sync, no integration lag, no external platform dependency. Agents read and write directly to the same database the human team uses. This is what Dwelly builds when it acquires agencies -- JB already has it.

## Sources

- [Nesti - AI for Estate & Letting Agents](https://www.nesti.io/)
- [EliseAI - Industry Leading AI for Property Management](https://eliseai.com/)
- [Dwelly raises $93M for AI-driven UK lettings](https://fortune.com/2026/02/25/dwelly-ai-roll-up-uk-lettings-agencies-real-estate-brokerages-93-million-new-venture-captial-funding-to-fuel-expansion/)
- [AI Agents Transform UK Real Estate in 2026](https://toptenaiagents.co.uk/blog/ai-agents-uk-real-estate-proptech.html)
- [Conversational AI for Real Estate - Crescendo](https://www.crescendo.ai/blog/conversational-ai-for-real-estate)
- [AI Compliance and Cost Pressures Reshape Estate Agency 2026](https://londonbusinessjournal.co.uk/2026/02/02/uk-estate-agents-2026-ai-compliance-efficiency/)
- [Best AI Receptionist for Real Estate - CallBird](https://www.callbirdai.com/blog-best-ai-receptionist-real-estate)
- [Best AI Receptionist for Real Estate - Eden](https://ringeden.com/blog/best-ai-receptionist-for-real-estate-agents)
- [Predicting Tenant Arrears with AI - Access PaySuite](https://www.accesspaysuite.com/blog/predicting-tenant-arrears-in-real-time-with-ai/)
- [UK Property Management Trends 2025 - Wonderful](https://wonderful.co.uk/blog/uk-property-management-trends-challenges-smart-payments)
- [Landlord Compliance Checklist 2025](https://legalforlandlords.co.uk/avoid-costly-mistakes-essential-landlord-compliance-checklist-2025/)
- [EICR, EPC & Gas Safety 2026 Obligations](https://www.ashworth-group.co.uk/news-blog/eicr-epc-gas-safety-explained-the-2026-landlords-obligations/)
- [AI Contract Generation Risks with Renters' Rights Act](https://lendlord.io/why-your-12-month-contract-actually-ends-in-two-months)

---
*Feature research for: AI-powered estate agency agents with property knowledge base*
*Researched: 2026-03-19*
