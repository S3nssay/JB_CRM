# Phase 11: Property Sourcing Agent — Market Intelligence & Owner Outreach - Research

**Researched:** 2026-03-27
**Domain:** AI agent system, market intelligence monitoring, outreach automation, PDF generation
**Confidence:** HIGH

## Summary

Phase 11 builds Charlie ("The Networker"), a property sourcing agent that proactively monitors market intelligence sources and manages owner outreach. The codebase already has substantial scaffolding: `ProactiveLeadGenService` contains 12+ monitor implementations (Land Registry, auctions, planning applications, expired listings, price reductions, social media, propensity scoring), `LeadGenerationService` handles stale listing detection with Playwright-based scraping, and the `proactive_leads` / `lead_monitoring_configs` / `propensity_scores` schema tables are fully defined with all needed columns. The existing `ProactiveLeadGenAgent` in `LeadGenAgent.ts` has outreach logic, contact method determination, and lead processing.

The primary work involves: (1) creating Charlie as a proper agent extending BaseAgent with Supervisor registration, (2) migrating the existing `setInterval`-based scheduling in ProactiveLeadGenService to pg-boss cron (pattern established in Phase 10's `financeCronJobs.ts`), (3) building the staff approval workflow for outreach (adapting the `LandlordApprovalService` pattern), (4) adding letter PDF generation using the existing `pdfService.ts` + PDFKit pattern, (5) implementing follow-up sequence management, (6) building the sourcing dashboard with pipeline view and campaign configuration, and (7) emitting deal pipeline events for valuation-booked handoffs to Alex/Jordan.

**Primary recommendation:** Evolve the existing `ProactiveLeadGenAgent` into Charlie, wire it to ProactiveLeadGenService methods, replace `setInterval` scheduling with pg-boss cron, and build a thin approval layer + dashboard on top of the already-rich data model.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01: Monitor the full suite of market intelligence sources: Land Registry transactions (new purchases, probate transfers, long-term owners), portal stale listings (Zoopla, Rightmove, OnTheMarket), auction results (unsold/withdrawn lots), planning applications, and competitor listing expirations
- D-02: Stale listing threshold remains at 90+ days on market (current LeadGenerationService default). Properties listed 90-365 days are flagged as opportunities
- D-03: AI-powered propensity scoring using OpenAI -- rank leads by likelihood to instruct based on multiple signals (ownership duration, local market conditions, property type, price movement, listing history). Store scores in existing propensity_scores table
- D-04: All outreach is staff-approved before sending -- Charlie identifies, scores, and drafts messages, but a staff member reviews and approves each outreach before it goes out
- D-05: Outreach channels are letter (physical mail) + email. Letters for initial approach (premium feel, high open rate), email for follow-ups. Existing emailService handles email; letter templates need print/mail integration or PDF generation for manual posting
- D-06: Source-specific outreach templates with AI-generated messaging
- D-07: Automated follow-up sequences with multi-touch cadence (letter -> email -> letter). Each touchpoint is staff-approved but Charlie queues them automatically and reminds staff when next action is due
- D-08: Agent name is Charlie -- "The Networker". Proactive, market-savvy, persuasive but not pushy. Knows the local West London area intimately. Positions John Barclay as the premium local expert
- D-09: Charlie operates in dual mode: autonomous cron-based monitoring (scans sources daily, scores leads, queues outreach drafts) AND Supervisor-routed conversational (handles inbound responses from owners who received outreach letters/emails)
- D-10: Charlie handles the journey from sourcing through to booking a valuation appointment. Once valuation is booked, the deal pipeline event bus triggers handoff to Alex (sales) or Jordan (lettings)
- D-11: Charlie integrates with existing agent infrastructure: extends BaseAgent, registers with Supervisor for routing, uses Tool Registry for CRM actions, logs to agent audit trail
- D-12: Dashboard prioritises pipeline view with approval workflow: leads flow through stages (new -> scored -> outreach drafted -> awaiting approval -> sent -> responded -> valuation booked -> instructed). Staff primarily use it to approve/reject outreach drafts and track conversion
- D-13: Full campaign configuration UI -- staff can create/edit monitoring campaigns. Backed by existing lead_monitoring_configs table
- D-14: Key performance metrics displayed: leads sourced this month, outreach sent count, response rate, valuations booked, instructions won. Breakdown by source

### Claude's Discretion
- Exact cron scheduling for monitoring scans
- Letter template design and PDF generation approach
- Follow-up cadence timing (exact day intervals)
- Propensity scoring model prompt engineering
- Dashboard layout and component choices
- How to handle duplicate leads across sources

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PDFKit | (already installed) | Letter PDF generation | Already used in `server/services/pdfService.ts` for branded PDFs |
| pg-boss | (already installed) | Cron job scheduling | Already used in `server/agents/services/financeCronJobs.ts` and `dealEventBus.ts` |
| OpenAI SDK | (already installed) | Propensity scoring, outreach drafting | Already used across all agents via `server/lib/openaiClient.ts` |
| Drizzle ORM | 0.39 | Database access | Project standard, schema tables already defined |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Playwright | (already installed) | Portal scraping | Already used in ProactiveLeadGenService and LeadGenerationService |
| emailService | (internal) | Email outreach sending | Already exists at `server/emailService.ts` |
| pdfService | (internal) | Branded PDF generation | Already exists at `server/services/pdfService.ts`, extend for letter templates |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PDFKit for letters | Puppeteer HTML-to-PDF | PDFKit already in use, more control, no browser overhead |
| pg-boss for cron | node-cron / setInterval | pg-boss is persistent, survives restarts, already established pattern |

**Installation:**
No new packages needed. All dependencies already installed.

## Architecture Patterns

### Recommended Project Structure
```
server/
  agents/
    specialists/
      SourcingAgent.ts          # Charlie agent class (extends BaseAgent)
    services/
      sourcingCronJobs.ts       # pg-boss cron registration for monitors
      sourcingApprovalService.ts # Staff approval workflow for outreach
      sourcingOutreachService.ts # Outreach drafting, letter PDF gen, email sending
      sourcingFollowUpService.ts # Follow-up sequence management
  sourcingRoutes.ts             # API routes for dashboard
client/
  src/
    pages/
      SourcingDashboard.tsx     # Main dashboard page
```

### Pattern 1: Agent Registration (from AgentOrchestrator.ts:59-67)
**What:** All agents register with the Supervisor via the Orchestrator
**When to use:** Adding Charlie to the agent system
**Example:**
```typescript
// In AgentOrchestrator.ts registerAllAgents()
import { sourcingAgent } from './specialists/SourcingAgent';
this.supervisor.registerAgent(sourcingAgent);
```

The AgentType union in `server/agents/types.ts:7-16` must be extended:
```typescript
export type AgentType =
  | 'supervisor' | 'office_admin' | 'sales' | 'rental'
  | 'maintenance' | 'lead_gen_sales' | 'lead_gen_rentals'
  | 'marketing' | 'arrears'
  | 'sourcing';  // NEW
```

### Pattern 2: pg-boss Cron Registration (from financeCronJobs.ts:57-79)
**What:** Lazy pg-boss initialization + cron schedule registration
**When to use:** Replacing setInterval-based scheduling in ProactiveLeadGenService
**Example:**
```typescript
// server/agents/services/sourcingCronJobs.ts
import PgBoss from 'pg-boss';
let boss: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL || '');
    await boss.start();
  }
  return boss;
}

export async function registerSourcingCronJobs(): Promise<void> {
  const b = await getBoss();

  // Daily market scan at 5am
  await b.schedule('charlie:daily-scan', '0 5 * * *', {}, {});
  await b.work('charlie:daily-scan', async () => {
    // Call ProactiveLeadGenService monitors
  });
}
```

### Pattern 3: Deal Event Bus Emission (from dealEventBus.ts:55-67)
**What:** Emit deal events via pg-boss queue with sourceEventId loop prevention
**When to use:** When Charlie books a valuation, emit event for Alex/Jordan handoff
**Example:**
```typescript
import { dealEventBus, DEAL_EVENTS } from './dealEventBus';

// Add new event to DEAL_EVENTS:
// VALUATION_BOOKED: 'valuation.booked'

await dealEventBus.emit('valuation.booked', {
  dealId: newDealId,
  propertyId,
  dealType: 'sourcing',
  sourcingLeadId: lead.id,
  agentType: lead.leadSource.includes('rental') ? 'lettings' : 'sales',
});
```

### Pattern 4: Staff Approval (adapted from landlordApproval.ts)
**What:** Approval request -> staff notification -> approve/reject -> execute
**When to use:** Outreach approval before sending
**Example:**
```typescript
interface OutreachApproval {
  leadId: number;
  channel: 'email' | 'post';
  subject?: string;
  content: string;       // The drafted outreach text
  pdfUrl?: string;       // For letter channel, the generated PDF
  status: 'pending' | 'approved' | 'rejected';
}
```

### Pattern 5: Route Registration (from routes.ts:199-212)
**What:** Mount Express router at `/api/crm` prefix
**When to use:** Adding sourcing dashboard API routes
**Example:**
```typescript
// In routes.ts
import { sourcingRouter } from './sourcingRoutes';
app.use('/api/crm', sourcingRouter);
```

### Anti-Patterns to Avoid
- **setInterval for cron jobs:** ProactiveLeadGenService currently uses `setInterval` via `scheduleMonitor()` -- this does not survive server restarts. Use pg-boss cron instead.
- **Direct outreach sending without approval:** D-04 explicitly requires staff approval. Never auto-send outreach.
- **Duplicating ProactiveLeadGenService logic:** The service already has 12+ monitor implementations. Charlie should call these methods, not rewrite them.
- **Multiple pg-boss instances:** Each lazy init creates a new pg-boss. Consider sharing the boss instance or using the existing pattern of per-file lazy init (which pg-boss handles via connection pooling).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF generation | Custom HTML-to-PDF pipeline | PDFKit via existing `pdfService.ts` | Already branded with JB colors, tested, includes header/footer helpers |
| Email sending | Direct SMTP calls | `emailService.sendEmail(to, subject, html)` | Already configured with proper SMTP transport, error handling |
| Job scheduling | setInterval / node-cron | pg-boss (via financeCronJobs.ts pattern) | Persistent across restarts, database-backed, already proven in Phase 10 |
| Agent registration | Custom routing logic | BaseAgent + SupervisorAgent + AgentOrchestrator pattern | Established agent infrastructure from Phases 1-10 |
| Deal event handoff | Direct service calls | dealEventBus.emit() pattern | Decoupled, prevents circular deps, includes loop prevention |
| Lead scoring | Custom ML model | OpenAI API with structured prompts | Already used in ProactiveLeadGenService.calculatePropensityScore() |
| Lead deduplication | Complex matching algorithm | Address + source key in proactive_leads (existing pattern) | Service already checks for duplicates via `eq(proactiveLeads.propertyAddress, addr)` |

**Key insight:** 80%+ of the backend logic already exists in ProactiveLeadGenService and LeadGenerationService. The main value-add is the agent wrapper (Charlie), approval workflow, follow-up sequencing, PDF letter generation, and the dashboard UI.

## Common Pitfalls

### Pitfall 1: Agent Type Registration Gap
**What goes wrong:** Adding Charlie as agent type but forgetting to update the AgentType union in types.ts, or forgetting to register in AgentOrchestrator.registerAllAgents()
**Why it happens:** Type scattered across multiple files
**How to avoid:** Update all three: types.ts AgentType union, AgentOrchestrator import + registration, Supervisor classifyMessage prompt (to include sourcing routing)
**Warning signs:** TypeScript compile errors on agent type, messages not routing to Charlie

### Pitfall 2: Supervisor Routing Miss
**What goes wrong:** Inbound responses from outreach recipients ("I got your letter") don't route to Charlie
**Why it happens:** Supervisor's classifyMessage prompt (SupervisorAgent.ts:65-91) doesn't include sourcing/Charlie routing patterns
**How to avoid:** Update the Supervisor's agent routing options to include `sourcing: Property sourcing leads, outreach responses, valuation requests from letters/emails`
**Warning signs:** Outreach responses routed to office_admin instead of Charlie

### Pitfall 3: pg-boss Instance Proliferation
**What goes wrong:** Multiple pg-boss instances created across services, each opening DB connections
**Why it happens:** Each service file has its own lazy `getBoss()` init
**How to avoid:** Accept this pattern (it's established) -- pg-boss handles multiple instances via connection pooling. But don't create more than one per service file.
**Warning signs:** Too many DB connections, connection pool exhaustion

### Pitfall 4: Approval State Inconsistency
**What goes wrong:** Outreach appears approved but was actually sent before approval, or approval UI doesn't reflect current state
**Why it happens:** Missing status transitions or race conditions between Charlie queuing and staff approving
**How to avoid:** Use clear status machine: `drafted -> pending_approval -> approved -> sent` (or `rejected`). Store status in `lead_contact_history` table which already has a `status` field.
**Warning signs:** Outreach sent without appearing in approval queue

### Pitfall 5: Follow-up Sequence Timing
**What goes wrong:** Follow-ups queue up but don't fire because next_follow_up_date is not checked
**Why it happens:** No cron job checking for due follow-ups
**How to avoid:** Add a pg-boss cron job (e.g., `charlie:check-followups` running daily at 8am) that queries `proactive_leads.next_follow_up_date <= NOW()` and queues the next outreach draft
**Warning signs:** Follow-up dates pass without action

### Pitfall 6: Wouter Route Order
**What goes wrong:** New `/crm/sourcing-dashboard` route returns 404
**Why it happens:** The catch-all `<Route path="/crm">` in App.tsx swallows all `/crm/*` routes placed after it
**How to avoid:** Place the new route BEFORE the `/crm` catch-all in App.tsx (around line 243)
**Warning signs:** Page shows 404, component never renders

## Code Examples

### Agent Class Pattern (from BaseAgent.ts + LeadGenAgent.ts)
```typescript
// server/agents/specialists/SourcingAgent.ts
import { BaseAgent } from '../BaseAgent';
import { AgentTask, TaskContext, AgentConfig } from '../types';

export class SourcingAgent extends BaseAgent {
  constructor() {
    super({
      id: 'sourcing',
      name: 'Charlie - The Networker',
      description: 'Proactively identifies property sourcing opportunities through market intelligence monitoring, scores leads, drafts source-specific outreach, and manages follow-up sequences.',
      enabled: true,
      handlesMessageTypes: ['lead', 'inquiry', 'valuation_request', 'follow_up'],
      handlesTaskTypes: ['process_proactive_lead', 'run_monitor', 'send_outreach', 'follow_up_lead', 'respond_to_inquiry'],
      communicationChannels: ['email', 'post', 'phone'],
      personality: 'Proactive, market-savvy, persuasive but not pushy. Knows the local West London area intimately. Positions John Barclay as the premium local expert.',
      tone: 'professional',
      language: 'en-GB',
      workingHours: { start: '06:00', end: '22:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      responseDelaySeconds: 60,
      maxConcurrentTasks: 50,
      priorityPostcodes: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
    });
  }

  protected buildUserPrompt(task: AgentTask, context: TaskContext): string {
    // Charlie-specific prompt with sourcing guidelines
    return `TASK: ${task.type}...`;
  }
}

export const sourcingAgent = new SourcingAgent();
```

### pg-boss Cron Pattern (from financeCronJobs.ts)
```typescript
// server/agents/services/sourcingCronJobs.ts
export async function registerSourcingCronJobs(): Promise<void> {
  const b = await getBoss();

  // Daily market intelligence scan at 5am
  await b.schedule('charlie:daily-scan', '0 5 * * *', {}, {});
  await b.work('charlie:daily-scan', async () => {
    const svc = await getProactiveLeadGenService();
    await svc.runMonitor('land_registry');
    await svc.runMonitor('expired_listings');
    await svc.runMonitor('auctions');
    await svc.runMonitor('price_reductions');
    await svc.runMonitor('planning_permissions');
    await svc.runMonitor('competitor_listings');
  });

  // Weekly propensity scoring on Sunday at 3am
  await b.schedule('charlie:propensity-scoring', '0 3 * * 0', {}, {});
  await b.work('charlie:propensity-scoring', async () => {
    const svc = await getProactiveLeadGenService();
    await svc.runPropensityScoring();
  });

  // Daily follow-up check at 8am
  await b.schedule('charlie:check-followups', '0 8 * * *', {}, {});
  await b.work('charlie:check-followups', async () => {
    // Query proactive_leads where next_follow_up_date <= NOW() and status = 'contacted'
    // Draft next outreach for each, queue for approval
  });
}
```

### Letter PDF Generation (extending pdfService.ts pattern)
```typescript
// Extend pdfService.ts with outreach letter generation
export interface OutreachLetterData {
  recipientName: string;
  recipientAddress: string;
  propertyAddress: string;
  leadSource: string;
  personalizedMessage: string;
  callToAction: string;
}

export function generateOutreachLetter(data: OutreachLetterData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // JB branded header (reuse drawHeader from pdfService.ts)
    drawHeader(doc, 'Property Opportunity');

    // Letter body
    doc.fontSize(11).text(data.personalizedMessage);
    // ... standard letter format with CTA

    doc.end();
  });
}
```

### Route Pattern (from routes.ts)
```typescript
// server/sourcingRoutes.ts
import { Router } from 'express';
export const sourcingRouter = Router();

// Pipeline view
sourcingRouter.get('/sourcing/leads', async (req, res) => { ... });
sourcingRouter.get('/sourcing/leads/:id', async (req, res) => { ... });

// Approval workflow
sourcingRouter.get('/sourcing/approvals', async (req, res) => { ... });
sourcingRouter.post('/sourcing/approvals/:id/approve', async (req, res) => { ... });
sourcingRouter.post('/sourcing/approvals/:id/reject', async (req, res) => { ... });

// Campaign config
sourcingRouter.get('/sourcing/campaigns', async (req, res) => { ... });
sourcingRouter.post('/sourcing/campaigns', async (req, res) => { ... });
sourcingRouter.put('/sourcing/campaigns/:id', async (req, res) => { ... });

// Metrics
sourcingRouter.get('/sourcing/metrics', async (req, res) => { ... });
sourcingRouter.get('/sourcing/metrics/by-source', async (req, res) => { ... });

// Manual actions
sourcingRouter.post('/sourcing/monitors/:type/run', async (req, res) => { ... });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| setInterval scheduling (ProactiveLeadGenService) | pg-boss cron (Phase 10 pattern) | Phase 10 | Persistent, crash-safe scheduling |
| In-memory lead storage (LeadGenerationService.staleListings Map) | Database-backed proactive_leads table | Already exists | Persistent storage with full query capabilities |
| Single LeadGen agent | Specialized SourcingAgent (Charlie) | Phase 11 | Dedicated agent for sourcing with own personality and routing |

**Deprecated/outdated:**
- `ProactiveLeadGenService.startAllMonitors()` with `setInterval` -- replace with pg-boss cron jobs
- `LeadGenerationService.staleListings` in-memory Map -- use database via proactive_leads table
- `ProactiveLeadGenAgent` class in LeadGenAgent.ts -- evolve into SourcingAgent (Charlie)

## Research Findings by Question

### Q1: Agent Infrastructure Pattern
**Confidence: HIGH** (read source code directly)

All agents extend `BaseAgent` (server/agents/BaseAgent.ts) which provides:
- `processTask()` pipeline: buildContext -> makeDecision -> executeDecision
- OpenAI chat completion for decisions (JSON response format)
- Activity logging and metrics
- Abstract `buildUserPrompt()` method each specialist implements

Registration flow:
1. Agent class extends BaseAgent, exported as singleton
2. Imported in AgentOrchestrator.ts
3. `registerAllAgents()` calls `this.supervisor.registerAgent(agent)`
4. Supervisor stores in `agentRegistry` Map<AgentType, BaseAgent>

Supervisor routing (SupervisorAgent.ts:65-91):
- `classifyMessage()` uses OpenAI to route incoming messages
- Prompt includes agent type descriptions for routing decisions
- Returns `RoutingDecision` with assignTo, priority, messageType

Charlie needs: new AgentType in types.ts union, new specialist class, registration in Orchestrator, routing description in Supervisor prompt.

### Q2: ProactiveLeadGenService State
**Confidence: HIGH** (read full source code)

Substantial existing code with 12+ monitor implementations:
- **Land Registry** (line 136): Fetches transactions, scores leads, saves to proactive_leads. API call placeholder (returns empty array).
- **Planning Permissions** (line 270): Scrapes council portals. Placeholder implementation.
- **Expired Listings** (line 374): Compares portal snapshots. Placeholder for diff logic.
- **Price Reductions** (line 460): Zoopla price-reduced filter scraping. Has working page.evaluate() extraction.
- **Rental Arbitrage** (line 571): Calculates yield from sale listings. Placeholder for data.
- **Social Media** (line 683): AI classification via OpenAI for social mentions. Placeholder for API integrations.
- **Compliance** (~line 1100): Checks landlord certificate expiry dates.
- **Portfolio Landlords** (~line 1200): Identifies multi-property owners.
- **Auctions** (~line 1021): Scrapes major auction houses (Allsop, Savills, etc). Placeholder implementations.
- **Competitor Listings** (~line 1130): Monitors competitor stale listings.
- **Seasonal Campaigns** (~line 1300): Runs configured seasonal campaigns.
- **Propensity Scoring** (line 1375): Uses OpenAI for propensity scoring with rule-based + AI hybrid approach.

The `runMonitor(monitorType)` method at line 1668 provides a clean dispatch interface.

All methods save leads to `proactive_leads` table via Drizzle with duplicate detection.

**Scheduling:** Currently uses `setInterval` via `scheduleMonitor()` (line 1635). This MUST be replaced with pg-boss cron for persistence.

### Q3: Schema Tables Assessment
**Confidence: HIGH** (read schema.ts directly)

**proactive_leads** (schema.ts:4100-4198): Comprehensive table with 40+ columns covering:
- Lead source identification (leadSource, sourceId, sourceUrl)
- Property/owner info (address, postcode, owner name/email/phone)
- Lead scoring (leadScore, leadTemperature, propensityScore)
- Source-specific data (transaction date, days on market, auction house, etc.)
- Outreach tracking (status with full pipeline: new -> researching -> ready_to_contact -> contacted -> responded -> meeting_scheduled -> valuation_booked -> instructed -> declined)
- Contact tracking (contactAttempts, lastContactDate, lastContactMethod, nextFollowUpDate)
- Response tracking (responseReceived, responseDate, responseSummary)
- Conversion tracking (convertedToEnquiryId, convertedToPropertyId)
- AI analysis (aiAnalysis JSON, aiRecommendation)

**lead_monitoring_configs** (schema.ts:4201-4249): Campaign configuration with:
- Monitor type, name, description
- Schedule (frequency, lastRunAt, nextRunAt)
- Geographic targeting (postcodeAreas array)
- Filters (min/maxPrice, propertyTypes)
- Automation settings (autoContact, autoContactMethod, delay, templateId)
- Metrics (totalLeadsFound, totalLeadsContacted, totalLeadsConverted)

**lead_contact_history** (schema.ts:4252-4289): Contact log with:
- Contact method and direction
- Content (subject, content, templateUsed)
- Delivery status (draft, sent, delivered, failed, bounced)
- Response tracking with sentiment
- Outcome and next action

**propensity_scores** (schema.ts:4396-4449): AI scoring with:
- Property characteristics
- Owner characteristics
- Market signals
- Life event indicators
- Score fields (sellPropensity, letPropensity, moveOutPropensity)
- Model metadata

**seasonal_campaigns** (schema.ts:4292-4341): Campaign management with targeting, content, budget, and metrics.

**social_media_mentions** (schema.ts:4452-4489): Social monitoring storage.

**Schema gaps identified:**
- No dedicated `outreach_drafts` or `outreach_approvals` table -- need to extend `lead_contact_history` with approval fields OR create new table
- `lead_contact_history.status` has `draft` value but no `pending_approval`, `approved`, `rejected` states
- No `follow_up_sequences` table defining cadence templates (letter -> email -> letter timing)
- Consider adding `approved_by_id`, `approved_at`, `rejected_reason` to lead_contact_history

### Q4: Deal Pipeline Event Bus
**Confidence: HIGH** (read dealEventBus.ts directly)

The deal event bus (server/agents/services/dealEventBus.ts) uses pg-boss queues:
- `dealEventBus.emit(eventName, payload)` sends events
- `dealEventBus.subscribe(eventName, handler)` registers workers
- Payload includes `dealId`, `propertyId`, `dealType`, `sourceEventId` (loop prevention)

Existing events in `DEAL_EVENTS`:
- TENANCY_AGREED, TENANCY_ENDING, LEASE_RENEWAL_DUE, RENT_REVIEW_DUE
- SALE_AGREED, SALE_COMPLETED, SALE_COLLAPSED
- STEP_COMPLETED, STEP_FAILED, STEP_TIMED_OUT
- CROSS_REFERRAL

Charlie needs to add a new event: `VALUATION_BOOKED: 'valuation.booked'`

When a valuation is booked from sourcing:
1. Charlie emits `valuation.booked` with propertyId, dealType ('sourcing'), and the lead source info
2. A subscriber (in Alex/Jordan's cron setup) creates a new deal and assigns it

Alternatively, use `CROSS_REFERRAL` which already exists for cross-agent handoffs.

### Q5: Staff Approval Pattern
**Confidence: HIGH** (read landlordApproval.ts directly)

The `LandlordApprovalService` (server/agents/services/landlordApproval.ts) provides the pattern:
1. `requestApproval(params)` -- evaluates request, sends notification
2. For emergency: auto-approve + notify
3. For standard: send approval request to landlord (via messageSender)
4. `handleApprovalResponse(landlordId, 'approve'|'reject')` -- updates DB status

For Charlie's outreach approval, adapt this pattern:
- Charlie drafts outreach -> creates lead_contact_history record with status='draft'
- Queues for staff approval -> status='pending_approval'
- Staff reviews in dashboard -> approves (status='approved', trigger send) or rejects (status='rejected')
- On approval: emailService sends email or PDF is marked for printing/posting

The tool `requestLandlordApproval` in `server/agents/tools/definitions/requestLandlordApproval.ts` shows how tool-based approval works within the agent system.

### Q6: pg-boss Cron Setup Pattern
**Confidence: HIGH** (read financeCronJobs.ts directly)

Pattern from `server/agents/services/financeCronJobs.ts`:
1. Lazy pg-boss init with `getBoss()` function
2. Lazy service imports to avoid DB at module load
3. `registerFinanceCronJobs()` async function called at server startup
4. Uses `b.schedule(name, cron, data, options)` for cron definition
5. Uses `b.work(name, handler)` for job execution
6. Audit logging via `auditLogger.logToolCall()`

Cron expressions used:
- `'0 6 1 * *'` -- monthly at 6am on 1st
- `'0 7 * * *'` -- daily at 7am

This is the correct pattern to replace the setInterval-based scheduling in ProactiveLeadGenService.

### Q7: CRM Routes Pattern
**Confidence: HIGH** (read routes.ts directly)

Route mounting in `server/routes.ts:199-212`:
- All CRM routes mounted at `app.use('/api/crm', router)`
- Each route file exports a Router
- Example: `import { financeRouter } from './financeRoutes'; app.use('/api/crm', financeRouter);`

Route naming convention from crmRoutes.ts:
- RESTful: GET /leads, GET /leads/:id, POST /leads, PUT /leads/:id
- Action endpoints: POST /leads/:id/approve

For sourcing: create `server/sourcingRoutes.ts` exporting `sourcingRouter`, mount at `/api/crm`.

### Q8: Letter PDF Generation
**Confidence: HIGH** (read pdfService.ts directly)

Existing `server/services/pdfService.ts` uses PDFKit with JB branding:
- Brand colors: PURPLE (#791E75), GOLD (#F8B324)
- `drawHeader(doc, subtitle)` draws branded purple header bar with JB logo area
- Outputs Buffer via stream events
- Already generates statements, invoices, receipts

For outreach letters: extend pdfService.ts with a new `generateOutreachLetter()` function that:
1. Uses the same branded header
2. Formats as formal business letter (date, address, salutation)
3. Includes source-specific personalized content (AI-generated)
4. Adds JB contact details and call-to-action
5. Returns Buffer for download/print

## Open Questions

1. **Outreach approval table design**
   - What we know: lead_contact_history has status='draft' but lacks approval-specific fields
   - What's unclear: Whether to extend lead_contact_history with approval fields or create a dedicated outreach_approvals table
   - Recommendation: Extend lead_contact_history with `approval_status`, `approved_by_id`, `approved_at`, `rejection_reason` columns. Simpler, avoids join complexity.

2. **Follow-up sequence definition storage**
   - What we know: D-07 specifies multi-touch cadence (letter -> email -> letter with timing)
   - What's unclear: Whether sequences should be hardcoded, stored in lead_monitoring_configs.config JSON, or have a dedicated table
   - Recommendation: Store as JSON in lead_monitoring_configs.config field under a `followUpSequence` key. Example: `[{day: 0, channel: 'post'}, {day: 7, channel: 'email'}, {day: 21, channel: 'post'}]`. Simple, flexible, no new table needed.

3. **Duplicate lead handling across sources**
   - What we know: ProactiveLeadGenService checks for duplicates per source (same address + same leadSource)
   - What's unclear: How to handle same property appearing from different sources (e.g., stale listing + price reduction)
   - Recommendation: Allow multiple leads per property across sources (they represent different signals). Add a dashboard view that groups by address to show all signals for a property. The propensity scoring can aggregate signals.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | Monitor sources produce leads | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "monitors"` | Wave 0 |
| D-03 | Propensity scoring returns valid scores | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "propensity"` | Wave 0 |
| D-04 | Outreach requires approval before sending | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "approval"` | Wave 0 |
| D-07 | Follow-up sequence advances correctly | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "followup"` | Wave 0 |
| D-09 | Cron jobs register and fire | unit | `npx vitest run server/__tests__/sourcingCronJobs.test.ts` | Wave 0 |
| D-10 | Valuation booked emits deal event | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "handoff"` | Wave 0 |
| D-11 | Agent registers with Supervisor | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "registration"` | Wave 0 |
| D-12 | Dashboard API returns pipeline data | integration | `npx vitest run server/__tests__/sourcingRoutes.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run server/__tests__/sourcingAgent.test.ts --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/__tests__/sourcingAgent.test.ts` -- core agent + service tests
- [ ] `server/__tests__/sourcingCronJobs.test.ts` -- cron registration tests
- [ ] `server/__tests__/sourcingRoutes.test.ts` -- API endpoint tests

## Sources

### Primary (HIGH confidence)
- `server/agents/BaseAgent.ts` -- Agent base class pattern (424 lines)
- `server/agents/SupervisorAgent.ts` -- Supervisor routing, classifyMessage prompt structure
- `server/agents/AgentOrchestrator.ts` -- Agent registration pattern
- `server/agents/specialists/LeadGenAgent.ts` -- Existing ProactiveLeadGenAgent (lines 444-683), LeadGenSalesAgent, LeadGenRentalsAgent
- `server/agents/types.ts` -- AgentType union, TaskType, AgentConfig interface
- `server/proactiveLeadGenService.ts` -- 12+ monitor implementations, scheduling, duplicate detection
- `server/leadGenerationService.ts` -- Stale listing service with Playwright scraping, MonitorSettings
- `shared/schema.ts` -- proactive_leads (4100), lead_monitoring_configs (4201), lead_contact_history (4252), propensity_scores (4396), seasonal_campaigns (4292), social_media_mentions (4452)
- `server/agents/services/dealEventBus.ts` -- Deal event bus with DEAL_EVENTS, emit/subscribe
- `server/agents/services/dealPipelineService.ts` -- Pipeline templates, pg-boss lazy init
- `server/agents/services/financeCronJobs.ts` -- pg-boss cron registration pattern
- `server/agents/services/landlordApproval.ts` -- Approval workflow pattern
- `server/services/pdfService.ts` -- PDFKit branded PDF generation
- `server/routes.ts` -- Route mounting pattern
- `vitest.config.ts` -- Test framework configuration

### Secondary (MEDIUM confidence)
- `server/emailService.ts` -- Email sending via `sendEmail(to, subject, html, options)`

### Tertiary (LOW confidence)
- None -- all findings verified from source code

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and in use
- Architecture: HIGH -- patterns established across 10 prior phases, read from source
- Pitfalls: HIGH -- identified from actual code structure and known project patterns (MEMORY.md)

**Research date:** 2026-03-27
**Valid until:** 2026-04-27 (stable -- internal codebase patterns, no external API changes)
