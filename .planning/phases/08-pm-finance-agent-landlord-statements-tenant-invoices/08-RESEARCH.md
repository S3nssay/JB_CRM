# Phase 8: PM Finance Agent -- Landlord Statements & Tenant Invoices - Research

**Researched:** 2026-03-26
**Domain:** AI agent (Taylor) for automated finance operations -- invoicing, statements, reconciliation, conversational finance queries
**Confidence:** HIGH

## Summary

Phase 8 introduces Taylor, a PM Finance AI agent that auto-generates monthly landlord statements (per-property, staff-approved before sending) and tenant rent invoices (7 days before due, auto-sent). Taylor also handles auto-reconciliation of incoming payments and serves as a conversational agent for finance queries from tenants and landlords.

The existing codebase provides strong foundations: the `invoices`, `landlordStatements`, `statementLineItems`, and `propertyTransactions` tables are already defined in `shared/schema.ts`. PDFKit is already installed and used in `rentProcessingAgent.ts`. The OpenAI Agents SDK pattern with zod4, the Supervisor handoff system, the DealEventBus, and pg-boss cron scheduling are all established from Phases 2-6. The reconciliationEngine already handles payment-to-invoice matching.

**Primary recommendation:** Build Taylor as an OpenAI Agents SDK agent following the exact patterns from pmAgent.ts (Morgan) and arrearsAgent.ts (Sarah). The heavy lifting is in the service layer: a `financeAgentService.ts` that generates statements/invoices via raw SQL aggregation, a `pdfService.ts` for branded PDF generation via PDFKit, and pg-boss cron jobs for scheduled monthly runs. Taylor registers in the Supervisor for inbound finance queries.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Monthly auto-generation on 1st of each month for the previous month's activity
- One statement per property (not consolidated per landlord)
- Staff must explicitly approve each statement before it is sent to the landlord
- Properties with zero rent collected that month are flagged as 'attention needed' for staff review rather than auto-sending or skipping
- Branded PDF generated for each statement (John Barclay logo, purple/gold colours), attached to email and downloadable from CRM
- Line items include: rent collected, management fees deducted, maintenance/work order costs deducted, compliance costs (gas safety, EICR, EPC), VAT on fees
- Management fees calculated from letting service terms (lettingServiceTerms.ts fee schedules based on service level)
- Net payable calculated but actual landlord payment is manual by accounts staff -- Taylor does not trigger payments
- Auto-generate monthly rent invoices for each active tenancy
- Invoices sent 7 days before rent due date
- Covers rent + service charges (where applicable for leasehold properties)
- Each invoice includes dual payment links: Stripe (card/Apple Pay/Google Pay) + GoCardless (direct debit) -- same pattern as Phase 5 arrears
- All tenants receive invoices including those on standing orders (consistent paper trail)
- Invoice delivered via email (branded PDF attachment) + WhatsApp notification with payment link
- Auto-reconcile incoming rent payments against outstanding invoices when payment arrives via Stripe/GoCardless webhooks or bank reconciliation
- No pre-due-date reminders -- invoice only. Overdue chasing is Chris's domain (Phase 5)
- Dual trigger model: monthly pg-boss cron jobs for scheduled generation + deal events from Phase 6 (tenancy.agreed triggers first invoice, tenancy.ending triggers final statement)
- Tenant invoices sent automatically (routine, low risk)
- Landlord statements require staff approval before sending (higher stakes, financial commitments)
- Taylor is a full conversational agent registered in the Supervisor for routing
- Tenant queries handled: invoice status, payment link requests, payment confirmation, receipt/proof-of-payment generation
- Landlord queries handled: statement queries, rent collection status, maintenance cost queries (from Phase 7 cost ledger), payment timing queries
- Transparent on payment timing: tells landlord truthfully that statement is with accounts team for review if not yet approved
- Statements sent via email with branded PDF attachment only (no WhatsApp for statements)
- No real-time rent collection notifications to landlords -- rent collection appears on monthly statement
- Taylor handles invoicing, statements, reconciliation, and finance queries
- Chris/Sarah (Phase 5) handles arrears chasing and overdue rent outreach
- Morgan (Phase 4) handles maintenance intake and work orders
- Clear handoff: Taylor's invoice goes overdue -> Chris takes over chasing
- Taylor can query Phase 7 cost ledger data to answer landlord cost questions

### Claude's Discretion
- Invoice and statement PDF template design (layout, formatting)
- Service charge data model and sourcing (may need schema additions)
- Supervisor routing rules for Taylor (intent classification keywords)
- pg-boss cron job configuration and retry strategies
- Auto-reconciliation matching algorithm (exact match vs fuzzy)
- Tenant receipt/proof-of-payment PDF format
- Taylor's agent persona instructions and tone

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

Phase 8 has no pre-defined requirement IDs in REQUIREMENTS.md. Requirements are derived from CONTEXT.md decisions:

| ID | Description | Research Support |
|----|-------------|-----------------|
| FIN-01 | Monthly landlord statement generation (per-property, 1st of month) | Schema exists (`landlordStatements`, `statementLineItems`); needs `propertyId` addition to statements table; raw SQL aggregation pattern from financeRoutes.ts |
| FIN-02 | Statement approval workflow (draft -> approved -> sent) | Status field already in schema; needs API routes + approval UI |
| FIN-03 | Branded PDF generation for statements and invoices | PDFKit already installed; `rentProcessingAgent.ts` has PDF generation pattern |
| FIN-04 | Monthly tenant rent invoice auto-generation (7 days before due) | `invoices` table exists; `tenancies` has `rentDueDay` for scheduling; pg-boss cron pattern established |
| FIN-05 | Dual payment links (Stripe + GoCardless) on invoices | `paymentService.ts` (Stripe) and `gocardlessService.ts` already exist from Phase 5 |
| FIN-06 | Invoice delivery via email + WhatsApp notification | `MessageSender` + `emailService` from Phase 2; email with PDF attachment, WhatsApp with payment link |
| FIN-07 | Auto-reconciliation of payments against invoices | `reconciliationEngine.ts` already handles this; extend webhook handlers to check for Taylor-generated invoices |
| FIN-08 | Taylor as conversational agent registered in Supervisor | OpenAI Agents SDK pattern from pmAgent.ts; Supervisor handoff registration pattern established |
| FIN-09 | Deal event triggers (tenancy.agreed -> first invoice, tenancy.ending -> final statement) | `DealEventBus` + `DEAL_EVENTS` from Phase 6 |
| FIN-10 | Management fee calculation from letting service terms | `lettingServiceTerms.ts` has fee schedules; property `managementType` field maps to service package |
| FIN-11 | Taylor can answer finance queries (invoice status, payment confirmation, statement queries, cost ledger data) | Agent tools wrapping raw SQL queries against invoices/statements/propertyTransactions tables |
| FIN-12 | Receipt/proof-of-payment generation for tenants | PDFKit receipt PDF; new tool for Taylor |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @openai/agents | (installed) | Taylor agent definition, tools, handoff | Established in Phase 2 for all agents |
| zod4 | (alias) | Tool parameter schemas for Agents SDK | Required by @openai/agents, project uses npm alias |
| pdfkit | 0.17.2 | Branded PDF generation (statements, invoices, receipts) | Already installed and used in rentProcessingAgent.ts |
| pg-boss | (installed) | Cron jobs for monthly generation + event-driven scheduling | Established in Phase 2-6 for all scheduled agent work |
| express | 4.x | API routes for statement/invoice management | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| reconciliationEngine | (internal) | Payment-to-invoice matching | Auto-reconciliation on webhook events |
| paymentService | (internal) | Stripe payment link generation | Generating invoice payment links |
| gocardlessService | (internal) | GoCardless direct debit links | DD payment link on invoices |
| MessageSender | (internal) | Multi-channel message dispatch | WhatsApp notification with payment link |
| emailService | (internal) | Email with PDF attachment | Sending statements and invoices |
| lettingServiceTerms | (internal) | Fee schedule data | Calculating management fees per service level |
| dealEventBus | (internal) | Lifecycle event subscription | tenancy.agreed / tenancy.ending triggers |
| auditLogger | (internal) | Agent action audit trail | Logging all Taylor actions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| PDFKit | Puppeteer/Chrome | PDFKit is already installed, lighter weight, no headless browser dependency; Puppeteer better for complex HTML templates but overkill here |

**Installation:**
No new npm packages needed. Everything required is already installed.

## Architecture Patterns

### Recommended Project Structure
```
server/
├── agents/sdk/
│   ├── financeAgent.ts          # Taylor agent definition + tools
│   └── supervisorAgent.ts       # Add Taylor handoff (modify)
├── services/
│   ├── financeAgentService.ts   # Statement/invoice generation logic
│   └── pdfService.ts            # Branded PDF generation (statements, invoices, receipts)
├── financeRoutes.ts             # Extend with statement approval, Taylor-specific endpoints
└── ...
```

### Pattern 1: Agent Definition (follow pmAgent.ts pattern)
**What:** Define Taylor as an OpenAI Agents SDK agent with persona, tools, and instructions
**When to use:** Agent setup
**Example:**
```typescript
// server/agents/sdk/financeAgent.ts
import { Agent, tool } from '@openai/agents';
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';

const FINANCE_INSTRUCTIONS = `You are Taylor, a finance specialist at John Barclay Estate Agents...`;

export const financeAgent = new Agent<AgentContext>({
  name: 'Taylor from Accounts',
  model: 'gpt-4o',
  instructions: FINANCE_INSTRUCTIONS,
  tools: [
    lookupInvoiceStatusTool,
    generatePaymentLinkTool,
    queryStatementsTool,
    queryRentCollectionTool,
    queryCostLedgerTool,
    generateReceiptTool,
    escalateToHumanTool,
  ],
});
```

### Pattern 2: Supervisor Handoff Registration
**What:** Register Taylor in the Supervisor's handoffs array
**When to use:** Enabling inbound routing to Taylor
**Example:**
```typescript
// In supervisorAgent.ts, add to handoffs array:
handoff(financeAgent, {
  toolNameOverride: 'transfer_to_finance',
  toolDescription: 'Transfer to Finance for invoice queries, payment questions, statement enquiries, rent collection status, proof-of-payment requests, and any accounts-related questions',
}),
// Also update SUPERVISOR_INSTRUCTIONS to include Taylor in routing rules
```

### Pattern 3: pg-boss Cron Job (lazy init)
**What:** Monthly scheduled jobs for statement and invoice generation
**When to use:** Scheduled monthly runs
**Example:**
```typescript
// Lazy pg-boss init (Phase 2-4 pattern)
let boss: PgBoss | null = null;
async function getBoss() {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL || '');
    await boss.start();
  }
  return boss;
}

// Register cron jobs
export async function registerFinanceCronJobs() {
  const b = await getBoss();
  // Generate statements on 1st of each month at 6am
  await b.schedule('taylor:generate-statements', '0 6 1 * *', {});
  // Generate invoices: daily check for invoices due in 7 days
  await b.schedule('taylor:generate-invoices', '0 7 * * *', {});

  b.work('taylor:generate-statements', async (job) => { ... });
  b.work('taylor:generate-invoices', async (job) => { ... });
}
```

### Pattern 4: Raw SQL for Financial Aggregation
**What:** Use raw SQL (pool.query) for complex financial aggregation queries
**When to use:** Statement generation, cost queries, reconciliation
**Why:** Established pattern in financeRoutes.ts and reconciliationEngine.ts; more efficient for multi-table financial aggregation than Drizzle ORM
**Example:**
```typescript
// Aggregate rent collected for a property in a period
const rentResult = await pool.query(`
  SELECT COALESCE(SUM(p.amount), 0)::int as total_rent
  FROM payment p
  JOIN invoice i ON p.id = i.payment_id
  WHERE i.property_id = $1
    AND i.invoice_type = 'rent'
    AND i.status = 'paid'
    AND i.paid_date >= $2 AND i.paid_date < $3
`, [propertyId, periodStart, periodEnd]);
```

### Pattern 5: Deal Event Subscription (fire-and-forget)
**What:** Subscribe to tenancy lifecycle events for trigger-based actions
**When to use:** tenancy.agreed -> generate first invoice, tenancy.ending -> generate final statement
**Example:**
```typescript
// In tenancyEventHooks.ts or new financeEventHooks.ts
import { dealEventBus, DEAL_EVENTS } from './dealEventBus';

// Subscribe to events
dealEventBus.on(DEAL_EVENTS.TENANCY_AGREED, async (payload) => {
  // Fire-and-forget: generate first month's invoice
  generateFirstInvoice(payload.tenancyId, payload.propertyId).catch(console.error);
});
```

### Anti-Patterns to Avoid
- **Consolidating statements per landlord:** User explicitly decided ONE statement PER PROPERTY. Do not group properties.
- **Taylor triggering payments:** Taylor calculates net payable but NEVER initiates bank transfers. Payments are manual by accounts staff.
- **Taylor chasing overdue invoices:** Once an invoice goes overdue, Chris/Sarah (arrears agent) handles it. Taylor only generates and sends.
- **Using Drizzle for complex aggregations:** Raw SQL is the established pattern for financial queries in this codebase.
- **Eager pg-boss initialization:** Always use lazy init pattern to avoid DB connection at module load.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Payment reconciliation | Custom matching logic | `reconciliationEngine.ts` | Already handles payment-to-invoice matching, arrears clearing, transaction creation |
| Stripe payment links | Custom Stripe integration | `paymentService.ts` | createPaymentIntent already exists |
| GoCardless collection | Custom GC integration | `gocardlessService.ts` | createRedirectFlow, collectPayment already exist |
| Message sending | Direct Twilio/email calls | `MessageSender` class | Handles WhatsApp/SMS/email with proper truncation and fallbacks |
| Audit logging | Custom logging | `auditLogger` | Established across all agents |
| Event emission | Custom event system | `dealEventBus` | pg-boss-backed, sourceEventId for loop prevention |
| Fee schedule lookup | Hardcoded fees | `lettingServiceTerms.ts` | Service packages with fee percentages already defined |

**Key insight:** This phase is primarily a *coordination* phase. Most building blocks exist. The new work is: (1) the service layer that orchestrates existing components into statement/invoice workflows, (2) PDF generation, (3) the Taylor agent with finance-specific tools, and (4) cron scheduling.

## Common Pitfalls

### Pitfall 1: Schema Gap -- landlordStatements Missing propertyId
**What goes wrong:** The `landlordStatements` table has `landlordId` but no `propertyId`. The user explicitly decided "one statement per property". Without `propertyId`, statements cannot be scoped to individual properties.
**Why it happens:** The schema was originally designed for landlord-level consolidation.
**How to avoid:** Add `propertyId` column to `landlordStatements` table. Check the live database first per CLAUDE.md rules. The child `statementLineItems` table already has `propertyId` on each line item.
**Warning signs:** Statement generation queries that JOIN on landlordId only will produce consolidated results.

### Pitfall 2: Management Fee Calculation Complexity
**What goes wrong:** The `managementType` field on properties maps to service packages in `lettingServiceTerms.ts`, but the fee types differ: `let-only` is `upfront` (10% of annual rent, paid once), while `let-and-collect` (11%) and `full-management` (13%) are `deducted_monthly`.
**Why it happens:** Not all management types have monthly fee deductions. A "let-only" property doesn't have monthly management fee deductions on statements.
**How to avoid:** Check the property's `managementType` -> look up the service package -> if `feeType === 'deducted_monthly'`, calculate monthly deduction as `(rentAmount * feePercentage / 100)`. If `feeType === 'upfront'`, no monthly deduction on statements.
**Warning signs:** Applying management fees uniformly across all service levels.

### Pitfall 3: Amounts in Pence vs Decimal
**What goes wrong:** The `invoices`, `payments`, and `statementLineItems` tables store amounts in pence (integer). The `tenancies` table stores `rentAmount` as decimal (string). Mixing these causes 100x errors.
**Why it happens:** Schema inconsistency between older (decimal) and newer (integer pence) tables.
**How to avoid:** Always convert: `const rentPence = Math.round(parseFloat(tenancy.rentAmount) * 100)`. Display: `(amount / 100).toFixed(2)`.
**Warning signs:** Invoices showing rent as 150000 instead of 1500.00.

### Pitfall 4: Sarah vs Chris Naming Confusion
**What goes wrong:** CONTEXT.md refers to the arrears agent as "Chris" but the implementation in `arrearsAgent.ts` names them "Sarah from Accounts". Using "Chris" in Taylor's instructions will create confusion.
**Why it happens:** Design document used different name from implementation.
**How to avoid:** Reference the arrears agent as "Sarah" in Taylor's instructions (matching implementation). Taylor should refer to "Sarah from Accounts" when discussing arrears escalation.
**Warning signs:** Taylor telling a tenant to "speak with Chris" when no Chris agent exists.

### Pitfall 5: Invoice Number Uniqueness
**What goes wrong:** The `invoices.invoiceNumber` column is `UNIQUE`. Generating bulk monthly invoices without a robust numbering scheme causes constraint violations.
**Why it happens:** No established format for auto-generated invoice numbers.
**How to avoid:** Use format: `INV-{YYYYMM}-{propertyId}-{seq}` e.g. `INV-202604-42-001`. Similarly for statements: `STMT-{YYYYMM}-{propertyId}`.
**Warning signs:** Unique constraint violations during bulk generation.

### Pitfall 6: Rent Due Day Edge Cases
**What goes wrong:** The `tenancies.rentDueDay` field defaults to 1 but could be 28, 29, 30, or 31. Months with fewer days need handling.
**Why it happens:** February has 28/29 days; some months have 30 days.
**How to avoid:** Use `Math.min(rentDueDay, daysInMonth)` for due date calculation. Invoice generation cron runs daily, checking for invoices due in 7 days.
**Warning signs:** Missing invoices for tenancies with rentDueDay > 28 in February.

## Code Examples

### Branded PDF Generation with PDFKit
```typescript
// server/services/pdfService.ts
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

const BRAND_PURPLE = '#791E75';
const BRAND_GOLD = '#F8B324';

export function generateStatementPDF(data: StatementData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Header with branding
    doc.rect(0, 0, doc.page.width, 80).fill(BRAND_PURPLE);
    doc.fontSize(20).fillColor('#FFFFFF')
       .text('John Barclay Estate & Management', 50, 25);
    doc.fontSize(10).fillColor(BRAND_GOLD)
       .text('Landlord Statement', 50, 50);

    // Statement details
    doc.fillColor('#333333');
    doc.moveDown(3);
    doc.fontSize(12).text(`Property: ${data.propertyAddress}`);
    doc.text(`Period: ${data.periodStart} - ${data.periodEnd}`);
    doc.text(`Landlord: ${data.landlordName}`);

    // Line items table
    doc.moveDown();
    // ... table rendering ...

    // Net payable
    doc.moveDown();
    doc.fontSize(14).fillColor(BRAND_PURPLE)
       .text(`Net Payable: ${formatCurrency(data.netPayable)}`);

    doc.end();
  });
}
```

### Management Fee Calculation
```typescript
// server/services/financeAgentService.ts
import { lettingServicePackages } from '@shared/lettingServiceTerms';

function calculateMonthlyManagementFee(
  managementType: string | null,
  monthlyRentPence: number
): { feePence: number; feePercentage: number; vatPence: number } {
  if (!managementType) return { feePence: 0, feePercentage: 0, vatPence: 0 };

  const pkg = lettingServicePackages.find(p => p.id === managementType);
  if (!pkg || pkg.feeType !== 'deducted_monthly') {
    return { feePence: 0, feePercentage: 0, vatPence: 0 };
  }

  const feePence = Math.round(monthlyRentPence * pkg.feePercentage / 100);
  const vatPence = Math.round(feePence * 0.2); // 20% UK VAT on management fees
  return { feePence, feePercentage: pkg.feePercentage, vatPence };
}
```

### Invoice Number Generation
```typescript
function generateInvoiceNumber(propertyId: number, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${yyyy}${mm}-${propertyId}`;
}

function generateStatementNumber(propertyId: number, date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `STMT-${yyyy}${mm}-${propertyId}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual statement creation | Auto-generated via cron + event triggers | Phase 8 | Eliminates monthly manual work for accounts staff |
| No rent invoicing | Auto-invoicing 7 days before due | Phase 8 | Consistent paper trail, dual payment links |
| Manual reconciliation only | Auto-reconciliation on webhook events + bank CSV | Phase 8 (extends existing) | Faster payment processing |
| rentProcessingAgent.ts (monolithic) | Taylor agent (conversational) + financeAgentService (logic) | Phase 8 | Adds conversational capability; Taylor can answer questions, not just process |

**Note on rentProcessingAgent.ts:** This existing file handles a similar workflow (rent collection -> statement generation -> landlord payment). Taylor's implementation should replace/supersede this with a more modular approach, but the existing code is a useful reference for SQL patterns and PDF generation.

## Open Questions

1. **Service Charge Data Model**
   - What we know: The `properties` table has `serviceCharge` (integer, annual pence). The `invoices` table supports `invoiceType: 'service_charge'`. The `paymentSchedules` table has `paymentType: 'service_charge'`.
   - What's unclear: How service charges should appear on tenant invoices -- as a separate line item on the rent invoice, or as a separate invoice entirely? Also, service charges are typically for leasehold properties -- should Taylor check property type?
   - Recommendation: Add service charge as a separate line item on the rent invoice (if property has a non-zero `serviceCharge` value). Calculate monthly: `Math.round(property.serviceCharge / 12)`.

2. **Reconciliation Matching Algorithm**
   - What we know: `reconciliationEngine.ts` matches by invoiceId (explicit link). Bank CSV auto-reconciliation in `bankReconciliationService.ts` does fuzzy matching.
   - What's unclear: For Taylor's auto-reconciliation, should we match by exact amount + tenant reference, or use fuzzy matching?
   - Recommendation: Use exact match first (Stripe/GC webhooks provide invoice reference). For bank transfers, use amount + tenant name fuzzy match with manual review queue for ambiguous matches.

3. **Statement Approval UI**
   - What we know: Statements have `status: draft | approved | sent | paid`. Staff must approve before sending.
   - What's unclear: Where does the approval UI live? Existing finance routes? New Taylor-specific page?
   - Recommendation: Add a "Pending Statements" view to the existing finance section. Simple list with approve/reject buttons per statement, with PDF preview.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | vitest.config.ts (or inline in package.json) |
| Quick run command | `npx vitest run server/__tests__/financeAgent.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FIN-01 | Statement generation aggregates rent/fees/deductions per property | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "statement generation"` | No -- Wave 0 |
| FIN-02 | Statement approval workflow transitions (draft->approved->sent) | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "approval workflow"` | No -- Wave 0 |
| FIN-03 | PDF generation produces valid buffer with branded content | unit | `npx vitest run server/__tests__/pdfService.test.ts` | No -- Wave 0 |
| FIN-04 | Invoice generation finds active tenancies and creates invoices 7 days before due | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "invoice generation"` | No -- Wave 0 |
| FIN-05 | Payment link generation (Stripe + GoCardless) | unit (static analysis) | `npx vitest run server/__tests__/financeAgent.test.ts -t "payment links"` | No -- Wave 0 |
| FIN-08 | Taylor registered in Supervisor with correct routing | unit (static analysis) | `npx vitest run server/__tests__/financeAgent.test.ts -t "supervisor registration"` | No -- Wave 0 |
| FIN-10 | Management fee calculation matches lettingServiceTerms | unit | `npx vitest run server/__tests__/financeAgent.test.ts -t "management fee"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run server/__tests__/financeAgent.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/__tests__/financeAgent.test.ts` -- covers FIN-01, FIN-02, FIN-04, FIN-05, FIN-08, FIN-10
- [ ] `server/__tests__/pdfService.test.ts` -- covers FIN-03 (PDF generation)
- [ ] No new framework install needed (Vitest already configured)

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` lines 6601-6748 -- invoices, arrears, landlordStatements, statementLineItems, propertyTransactions tables
- `shared/schema.ts` lines 4879-4929 -- tenancies table (rentAmount, rentDueDay, status)
- `shared/schema.ts` lines 164-168 -- properties managementType/managementFeeType/managementFeeValue
- `shared/lettingServiceTerms.ts` -- Service packages with fee percentages (let-only 10%, let-and-collect 11%, full-management 13%)
- `server/agents/sdk/pmAgent.ts` -- Agent definition pattern (tool imports, zod4, instructions)
- `server/agents/sdk/supervisorAgent.ts` -- Supervisor handoff registration pattern
- `server/agents/sdk/arrearsAgent.ts` -- Finance-adjacent agent persona pattern (Sarah from Accounts)
- `server/agents/sdk/context.ts` -- AgentContext interface
- `server/agents/sdk/tools.ts` -- Tool wrapping pattern (wrapRegistryTool, lazy imports)
- `server/agents/sdk/runner.ts` -- Agent execution pipeline
- `server/reconciliationEngine.ts` -- Payment reconciliation (recordPaymentAndReconcile)
- `server/services/rentProcessingAgent.ts` -- Existing rent processing with PDFKit usage
- `server/agents/services/dealEventBus.ts` -- Event bus pattern (DEAL_EVENTS, lazy pg-boss)
- `server/agents/services/tenancyEventHooks.ts` -- Event hook pattern (fire-and-forget)
- `server/paymentService.ts` -- Stripe payment intent creation
- `server/gocardlessService.ts` -- GoCardless mandate/payment handling
- `server/financeRoutes.ts` -- Existing invoice/statement CRUD routes
- `server/agents/services/messageSender.ts` -- Multi-channel message dispatch

### Secondary (MEDIUM confidence)
- PDFKit API (from installed version 0.17.2) -- text, rect, fillColor, font methods
- pg-boss schedule/work API -- cron expression format

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in codebase
- Architecture: HIGH -- follows exact patterns from Phases 2-7 (agent definition, Supervisor handoff, pg-boss cron, raw SQL)
- Pitfalls: HIGH -- discovered through direct schema inspection (propertyId gap, pence vs decimal, naming inconsistency)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- all dependencies already locked in project)
