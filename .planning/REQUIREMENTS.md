# Requirements: JB CRM — AI Agents & Property Knowledge Base

**Defined:** 2026-03-19
**Core Value:** AI agents handle real inbound communications autonomously — answering questions, booking viewings, managing maintenance, chasing arrears — so the human team focuses on high-value work.

## v1 Requirements

### Property Knowledge Base

- [x] **KB-01**: Property has structured certification records (gas safety, EICR, EPC) with expiry dates and status
- [x] **KB-02**: Property has systems inventory (heating type, boiler make/model, electrical board, plumbing)
- [x] **KB-03**: Property has maintenance/work history log linked to contractors and dates
- [x] **KB-04**: Knowledge base is queryable by AI agents with sub-100ms retrieval for use during live calls
- [x] **KB-05**: CRM UI allows staff to view and edit property knowledge base data

### AI Agent Infrastructure

- [x] **AGENT-01**: Supervisor agent detects caller intent and routes to correct specialist (sales/lettings/PM/admin/general)
- [x] **AGENT-02**: All agents have access to live CRM data via a Tool Registry (read properties, leads, tenancies, contractors)
- [x] **AGENT-03**: All agents can take actions in the CRM (create leads, book viewings, create work orders)
- [x] **AGENT-04**: Conversation state persists in database across interactions and channels
- [x] **AGENT-05**: All AI agent actions logged to database audit trail (timestamp, channel, action, reasoning)
- [x] **AGENT-06**: AI agents identify themselves as AI to callers (UK compliance)
- [x] **AGENT-07**: Clear escalation path to transfer to human staff when AI cannot handle a query

### Voice AI

- [x] **VOICE-01**: Voice AI answers all inbound calls 24/7 with natural British English speech
- [x] **VOICE-02**: Voice AI routes callers to correct specialist based on intent detection
- [x] **VOICE-03**: Voice AI supports tool-calling to perform CRM actions during calls
- [x] **VOICE-04**: Voice AI can transfer calls to human staff when escalation triggered

### Sales Specialist

- [x] **SALES-01**: Answers property sale enquiries using live CRM data (price, availability, features, location)
- [x] **SALES-02**: Books viewings by checking agent availability and creating viewing appointments
- [x] **SALES-03**: Captures buyer leads (name, phone, email, requirements, budget) when viewings unavailable
- [x] **SALES-04**: Follows up with interested buyers across channels (WhatsApp/SMS/email)

### Lettings Specialist

- [x] **LETT-01**: Answers rental property enquiries using live CRM data (rent, availability, features, location)
- [x] **LETT-02**: Books viewings by checking availability and creating viewing appointments
- [x] **LETT-03**: Captures tenant leads (name, phone, email, requirements, budget) when viewings unavailable
- [x] **LETT-04**: Follows up with prospective tenants across channels (WhatsApp/SMS/email)

### Property Management Specialist

- [x] **PM-01**: Takes maintenance/fault reports from tenants via any channel and creates work orders
- [x] **PM-02**: Triages faults using property knowledge base (what system, warranty status, last service)
- [x] **PM-03**: Contacts appropriate contractor based on property knowledge base and fault type
- [x] **PM-04**: Books contractors and generates quotes for landlord approval
- [x] **PM-05**: Follows up with contractors to verify work completion
- [x] **PM-06**: Chases rent arrears with outbound calls/SMS/WhatsApp to tenants
- [x] **PM-07**: Attempts to secure payment commitments and sends payment links
- [x] **PM-08**: Arrears chasing has hard-coded frequency limits and compliance rules (not prompt-only)

### Admin Specialist

- [x] **ADMIN-01**: Generates onboarding document checklists for new tenancies
- [x] **ADMIN-02**: Generates offboarding document checklists for ending tenancies
- [x] **ADMIN-03**: Tracks document completion status and chases outstanding items

### Multi-Channel

- [x] **CHAN-01**: Unified conversation threading across phone, WhatsApp, SMS, and email
- [x] **CHAN-02**: Contact identity resolution (same person across phone number, email, WhatsApp)
- [x] **CHAN-03**: Agent memory — context from previous interactions injected into current conversation
- [x] **CHAN-04**: WhatsApp/SMS confirmations sent automatically after call actions (viewing booked, fault reported)

### Cross-Agent Collaboration & Deal Lifecycle

- [x] **DEAL-01**: Shared deal record tracks lifecycle stages across agent handoffs
- [x] **DEAL-02**: Event bus triggers downstream agents when deal stages complete
- [x] **DEAL-03**: Visual deal timeline shows all events and agent actions
- [x] **DEAL-04**: Staff can override deal steps (pause, skip, complete, cancel)
- [x] **DEAL-05**: Real-time SSE notifications for deal events
- [x] **DEAL-06**: Cross-referral between Sales and Lettings agents on dual-interest leads

### Agent Corrections & Cost Ledger

- [x] **CORR-01**: Sales agent (Alex) records offers professionally instead of negotiating autonomously
- [x] **CORR-02**: Lettings agent (Jordan) records offers professionally instead of negotiating autonomously
- [x] **CORR-03**: New offers trigger email notification to assigned agent
- [x] **CORR-04**: New offers trigger email notification to assigned agent with offer details
- [x] **COST-01**: Cost ledger tracks maintenance and compliance spend per property
- [x] **COST-02**: Cost ledger tracks spend per landlord (aggregated across properties)
- [x] **COST-03**: Configurable cost threshold alerts sent via email when exceeded
- [x] **OFFER-UI**: Staff can view, accept, reject, and counter offers from CRM dashboard
- [x] **COST-UI**: Cost ledger visible on property and landlord detail pages

### PM Finance Agent

- [x] **FIN-01**: Monthly landlord statement generation (per-property, 1st of month) with rent, fees, deductions, VAT
- [x] **FIN-02**: Statement approval workflow (draft -> approved -> sent) with staff gate before landlord delivery
- [x] **FIN-03**: Branded PDF generation (John Barclay purple/gold) for statements and invoices
- [x] **FIN-04**: Monthly tenant rent invoice auto-generation 7 days before rent due date
- [x] **FIN-05**: Dual payment links (Stripe + GoCardless) included on each invoice
- [x] **FIN-06**: Invoice delivery via email (PDF attachment) + WhatsApp notification with payment link
- [x] **FIN-07**: Auto-reconciliation of incoming Stripe/GoCardless payments against outstanding invoices
- [x] **FIN-08**: Taylor registered as conversational finance agent in Supervisor for intent routing
- [x] **FIN-09**: Deal event triggers (tenancy.agreed -> first invoice, tenancy.ending -> final statement)
- [x] **FIN-10**: Management fee calculation from letting service terms (let-only=0 monthly, let-and-collect=11%, full-management=13%)

### Head of Property Management Agent

- [x] **HPM-01**: Jamie agent provides cross-domain portfolio query tools spanning maintenance, arrears, finance, and compliance
- [x] **HPM-02**: Jamie delegates operational tasks to specialist agents (Morgan, Sarah, Sam, Taylor) via handoffs
- [x] **HPM-03**: Jamie registered in Supervisor for landlord portfolio queries
- [x] **HPM-04**: Daily certification expiry checks with proactive email alerts
- [x] **HPM-05**: Weekly portfolio health report generation and email delivery
- [x] **HPM-06**: Portfolio health scoring per property (100 base minus penalty factors)
- [x] **HPM-07**: PM overview API with compliance alerts and health scores
- [x] **HPM-08**: Enhanced PM tracking dashboard with compliance and health widgets

### Business Accounts Agent

- [x] **BIZ-01**: Riley agent provides conversational access to P&L, balance sheet, and cash position
- [x] **BIZ-02**: Riley can query VAT returns and aged debtors/creditors
- [x] **BIZ-03**: Riley registered in Supervisor for company-wide finance queries
- [x] **BIZ-04**: Shared accounting queries module for agent tool reuse
- [x] **BIZ-05**: Recurring invoice auto-generation via pg-boss cron
- [x] **BIZ-06**: Commission journal entries auto-created on deal completion events
- [x] **BIZ-07**: Financial period close reminders via pg-boss cron
- [x] **BIZ-08**: VAT quarter-end reminders via pg-boss cron
- [x] **BIZ-09**: Clear domain boundary between Riley (company financials) and Taylor (tenant/landlord finance)

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
| KB-01 | Phase 1 | Complete |
| KB-02 | Phase 1 | Complete |
| KB-03 | Phase 1 | Complete |
| KB-04 | Phase 1 | Complete |
| KB-05 | Phase 1 | Complete |
| AGENT-01 | Phase 2 | Complete |
| AGENT-02 | Phase 1 | Complete |
| AGENT-03 | Phase 2 | Complete |
| AGENT-04 | Phase 1 | Complete |
| AGENT-05 | Phase 1 | Complete |
| AGENT-06 | Phase 1 | Complete |
| AGENT-07 | Phase 2 | Complete |
| VOICE-01 | Phase 3 | Complete |
| VOICE-02 | Phase 3 | Complete |
| VOICE-03 | Phase 3 | Complete |
| VOICE-04 | Phase 3 | Complete |
| SALES-01 | Phase 2 | Complete |
| SALES-02 | Phase 2 | Complete |
| SALES-03 | Phase 2 | Complete |
| SALES-04 | Phase 2 | Complete |
| LETT-01 | Phase 2 | Complete |
| LETT-02 | Phase 2 | Complete |
| LETT-03 | Phase 2 | Complete |
| LETT-04 | Phase 2 | Complete |
| PM-01 | Phase 4 | Complete |
| PM-02 | Phase 4 | Complete |
| PM-03 | Phase 4 | Complete |
| PM-04 | Phase 4 | Complete |
| PM-05 | Phase 4 | Complete |
| PM-06 | Phase 5 | Complete |
| PM-07 | Phase 5 | Complete |
| PM-08 | Phase 5 | Complete |
| ADMIN-01 | Phase 2 | Complete |
| ADMIN-02 | Phase 2 | Complete |
| ADMIN-03 | Phase 2 | Complete |
| CHAN-01 | Phase 1 | Complete |
| CHAN-02 | Phase 1 | Complete |
| CHAN-03 | Phase 2 | Complete |
| CHAN-04 | Phase 2 | Complete |
| DEAL-01 | Phase 6 | Complete |
| DEAL-02 | Phase 6 | Complete |
| DEAL-03 | Phase 6 | Complete |
| DEAL-04 | Phase 6 | Complete |
| DEAL-05 | Phase 6 | Complete |
| DEAL-06 | Phase 6 | Complete |
| CORR-01 | Phase 7 | Complete |
| CORR-02 | Phase 7 | Complete |
| CORR-03 | Phase 7 | Complete |
| CORR-04 | Phase 7 | Complete |
| COST-01 | Phase 7 | Complete |
| COST-02 | Phase 7 | Complete |
| COST-03 | Phase 7 | Complete |
| OFFER-UI | Phase 7 | Complete |
| COST-UI | Phase 7 | Complete |
| FIN-01 | Phase 8 | Complete |
| FIN-02 | Phase 8 | Complete |
| FIN-03 | Phase 8 | Complete |
| FIN-04 | Phase 8 | Complete |
| FIN-05 | Phase 8 | Complete |
| FIN-06 | Phase 8 | Complete |
| FIN-07 | Phase 8 | Complete |
| FIN-08 | Phase 8 | Complete |
| FIN-09 | Phase 8 | Complete |
| FIN-10 | Phase 8 | Complete |
| HPM-01 | Phase 9 | Complete |
| HPM-02 | Phase 9 | Complete |
| HPM-03 | Phase 9 | Complete |
| HPM-04 | Phase 9 | Complete |
| HPM-05 | Phase 9 | Complete |
| HPM-06 | Phase 9 | Complete |
| HPM-07 | Phase 9 | Complete |
| HPM-08 | Phase 9 | Complete |
| BIZ-01 | Phase 10 | Complete |
| BIZ-02 | Phase 10 | Complete |
| BIZ-03 | Phase 10 | Complete |
| BIZ-04 | Phase 10 | Complete |
| BIZ-05 | Phase 10 | Complete |
| BIZ-06 | Phase 10 | Complete |
| BIZ-07 | Phase 10 | Complete |
| BIZ-08 | Phase 10 | Complete |
| BIZ-09 | Phase 10 | Complete |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39
- Unmapped: 0
- Phase 6-10 requirements: 42 total (all complete)
- Grand total: 81 requirements mapped

---
*Requirements defined: 2026-03-19*
*Last updated: 2026-03-27 -- added Phase 6-10 requirement definitions and traceability*
