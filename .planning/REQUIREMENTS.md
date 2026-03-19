# Requirements: JB CRM — AI Agents & Property Knowledge Base

**Defined:** 2026-03-19
**Core Value:** AI agents handle real inbound communications autonomously — answering questions, booking viewings, managing maintenance, chasing arrears — so the human team focuses on high-value work.

## v1 Requirements

### Property Knowledge Base

- [ ] **KB-01**: Property has structured certification records (gas safety, EICR, EPC) with expiry dates and status
- [ ] **KB-02**: Property has systems inventory (heating type, boiler make/model, electrical board, plumbing)
- [ ] **KB-03**: Property has maintenance/work history log linked to contractors and dates
- [ ] **KB-04**: Knowledge base is queryable by AI agents with sub-100ms retrieval for use during live calls
- [ ] **KB-05**: CRM UI allows staff to view and edit property knowledge base data

### AI Agent Infrastructure

- [ ] **AGENT-01**: Supervisor agent detects caller intent and routes to correct specialist (sales/lettings/PM/admin/general)
- [ ] **AGENT-02**: All agents have access to live CRM data via a Tool Registry (read properties, leads, tenancies, contractors)
- [ ] **AGENT-03**: All agents can take actions in the CRM (create leads, book viewings, create work orders)
- [ ] **AGENT-04**: Conversation state persists in database across interactions and channels
- [ ] **AGENT-05**: All AI agent actions logged to database audit trail (timestamp, channel, action, reasoning)
- [ ] **AGENT-06**: AI agents identify themselves as AI to callers (UK compliance)
- [ ] **AGENT-07**: Clear escalation path to transfer to human staff when AI cannot handle a query

### Voice AI

- [ ] **VOICE-01**: Voice AI answers all inbound calls 24/7 with natural British English speech
- [ ] **VOICE-02**: Voice AI routes callers to correct specialist based on intent detection
- [ ] **VOICE-03**: Voice AI supports tool-calling to perform CRM actions during calls
- [ ] **VOICE-04**: Voice AI can transfer calls to human staff when escalation triggered

### Sales Specialist

- [ ] **SALES-01**: Answers property sale enquiries using live CRM data (price, availability, features, location)
- [ ] **SALES-02**: Books viewings by checking agent availability and creating viewing appointments
- [ ] **SALES-03**: Captures buyer leads (name, phone, email, requirements, budget) when viewings unavailable
- [ ] **SALES-04**: Follows up with interested buyers across channels (WhatsApp/SMS/email)

### Lettings Specialist

- [ ] **LETT-01**: Answers rental property enquiries using live CRM data (rent, availability, features, location)
- [ ] **LETT-02**: Books viewings by checking availability and creating viewing appointments
- [ ] **LETT-03**: Captures tenant leads (name, phone, email, requirements, budget) when viewings unavailable
- [ ] **LETT-04**: Follows up with prospective tenants across channels (WhatsApp/SMS/email)

### Property Management Specialist

- [ ] **PM-01**: Takes maintenance/fault reports from tenants via any channel and creates work orders
- [ ] **PM-02**: Triages faults using property knowledge base (what system, warranty status, last service)
- [ ] **PM-03**: Contacts appropriate contractor based on property knowledge base and fault type
- [ ] **PM-04**: Books contractors and generates quotes for landlord approval
- [ ] **PM-05**: Follows up with contractors to verify work completion
- [ ] **PM-06**: Chases rent arrears with outbound calls/SMS/WhatsApp to tenants
- [ ] **PM-07**: Attempts to secure payment commitments and sends payment links
- [ ] **PM-08**: Arrears chasing has hard-coded frequency limits and compliance rules (not prompt-only)

### Admin Specialist

- [ ] **ADMIN-01**: Generates onboarding document checklists for new tenancies
- [ ] **ADMIN-02**: Generates offboarding document checklists for ending tenancies
- [ ] **ADMIN-03**: Tracks document completion status and chases outstanding items

### Multi-Channel

- [ ] **CHAN-01**: Unified conversation threading across phone, WhatsApp, SMS, and email
- [ ] **CHAN-02**: Contact identity resolution (same person across phone number, email, WhatsApp)
- [ ] **CHAN-03**: Agent memory — context from previous interactions injected into current conversation
- [ ] **CHAN-04**: WhatsApp/SMS confirmations sent automatically after call actions (viewing booked, fault reported)

## v2 Requirements

### Contract Generation

- **CONTRACT-01**: Admin specialist generates tenancy agreements (AST) from solicitor-reviewed templates
- **CONTRACT-02**: Admin specialist generates sales memorandums from templates
- **CONTRACT-03**: Admin specialist generates management agreements from templates
- **CONTRACT-04**: Generated contracts sent for signature via DocuSign

### Advanced Features

- **ADV-01**: Predictive compliance alerts (auto-alert before certifications expire)
- **ADV-02**: Predictive arrears detection (ML model predicting which tenants will fall into arrears)
- **ADV-03**: Multilingual voice support (provider-level feature)
- **ADV-04**: AI-powered indicative valuation ranges from comparable data

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI handling financial transactions | PCI-DSS compliance risk; AI sends payment links, humans approve transactions |
| Custom voice training/cloning | Expensive, uncanny valley, consent issues; use provider pre-built British voices |
| AI outbound cold-calling | UK TPS regulations, GDPR consent, reputational risk for premium agency |
| Autonomous offer negotiation | Requires judgment and relationship sensitivity AI cannot reliably provide |
| AI-generated legal advice | Illegal in UK without qualification; AI provides factual info only |
| Video call AI agent | Massive complexity, limited value over voice + photos/videos via WhatsApp |
| Mobile app | Web-first platform |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| KB-01 | Phase 1 | Pending |
| KB-02 | Phase 1 | Pending |
| KB-03 | Phase 1 | Pending |
| KB-04 | Phase 1 | Pending |
| KB-05 | Phase 1 | Pending |
| AGENT-01 | Phase 2 | Pending |
| AGENT-02 | Phase 1 | Pending |
| AGENT-03 | Phase 2 | Pending |
| AGENT-04 | Phase 1 | Pending |
| AGENT-05 | Phase 1 | Pending |
| AGENT-06 | Phase 1 | Pending |
| AGENT-07 | Phase 2 | Pending |
| VOICE-01 | Phase 3 | Pending |
| VOICE-02 | Phase 3 | Pending |
| VOICE-03 | Phase 3 | Pending |
| VOICE-04 | Phase 3 | Pending |
| SALES-01 | Phase 2 | Pending |
| SALES-02 | Phase 2 | Pending |
| SALES-03 | Phase 2 | Pending |
| SALES-04 | Phase 2 | Pending |
| LETT-01 | Phase 2 | Pending |
| LETT-02 | Phase 2 | Pending |
| LETT-03 | Phase 2 | Pending |
| LETT-04 | Phase 2 | Pending |
| PM-01 | Phase 4 | Pending |
| PM-02 | Phase 4 | Pending |
| PM-03 | Phase 4 | Pending |
| PM-04 | Phase 4 | Pending |
| PM-05 | Phase 4 | Pending |
| PM-06 | Phase 5 | Pending |
| PM-07 | Phase 5 | Pending |
| PM-08 | Phase 5 | Pending |
| ADMIN-01 | Phase 2 | Pending |
| ADMIN-02 | Phase 2 | Pending |
| ADMIN-03 | Phase 2 | Pending |
| CHAN-01 | Phase 1 | Pending |
| CHAN-02 | Phase 1 | Pending |
| CHAN-03 | Phase 2 | Pending |
| CHAN-04 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-19 — traceability complete after roadmap creation*
