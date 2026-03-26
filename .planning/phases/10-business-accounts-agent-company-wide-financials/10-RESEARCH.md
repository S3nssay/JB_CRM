# Phase 10: Business Accounts Agent -- Company-Wide Financials - Research

**Researched:** 2026-03-26
**Domain:** AI agent (Riley) for company-wide financial operations -- double-entry accounting automation, VAT, P&L, cash flow, financial period management, and conversational finance queries for staff
**Confidence:** HIGH

## Summary

Phase 10 introduces Riley, a Business Accounts AI agent that automates and provides conversational access to the company-wide double-entry accounting system. Unlike Taylor (Phase 8) who handles PM-level invoicing and landlord statements, Riley operates at the business level: automating journal entry creation from business events, calculating VAT returns, closing financial periods, generating P&L and balance sheet reports on demand, managing aged debtors/creditors, and answering staff finance queries conversationally.

The existing codebase provides an extraordinarily strong foundation. A full double-entry accounting system is already built: `chartOfAccounts`, `journalEntries`, `journalEntryLines`, `businessInvoices`, `purchaseInvoices`, `creditNotes`, `paymentAllocations`, `vatReturns`, `vatReturnTransactions`, `financialPeriods`, `taxRates`, `recurringInvoiceTemplates`, and `businessSettings` tables are all defined in `shared/schema.ts`. The `accountingRoutes.ts` (1816 lines) provides full CRUD for all of these plus reports (trial balance, aged debtors/creditors, tax reports, dashboard). The `accountingIntegration.ts` service bridges PM finance operations to journal entries via functions like `accountingRecordRentPayment`, `accountingRecordManagementFee`, `accountingRecordBusinessInvoiceSent`, etc. The UI already has 20+ accounting pages with sidebar navigation.

Riley's job is to be the conversational AI layer on top of this existing accounting system, plus add automation for recurring tasks that are currently manual: auto-posting journal entries from business events, auto-calculating quarterly VAT returns, auto-closing financial periods, generating recurring invoices from templates, and providing natural-language access to financial reports.

**Primary recommendation:** Build Riley as an OpenAI Agents SDK agent following the established pattern. Riley wraps the existing `accountingRoutes.ts` query logic and `accountingIntegration.ts` functions as agent tools. New service logic is minimal -- the heavy lifting is wiring existing API functions as LLM-callable tools, adding pg-boss cron automation for recurring tasks, and registering Riley in the Supervisor for staff finance queries.

<phase_requirements>
## Phase Requirements

Phase 10 has no pre-defined requirement IDs in REQUIREMENTS.md. Requirements are derived from the phase description and existing system analysis:

| ID | Description | Research Support |
|----|-------------|-----------------|
| BIZ-01 | Riley as conversational agent registered in Supervisor for staff finance queries | Agent SDK pattern from pmAgent.ts; Supervisor handoff pattern established |
| BIZ-02 | Natural-language P&L report generation (by period, date range, comparison) | Trial balance endpoint exists in accountingRoutes.ts; P&L page computes from trial balance data |
| BIZ-03 | Natural-language balance sheet generation | Same trial balance query, filtered by asset/liability/equity account types |
| BIZ-04 | VAT return auto-calculation and conversational queries | `/accounting/vat-returns/:id/calculate` endpoint already does the calculation; Riley wraps it |
| BIZ-05 | Automated financial period closing (month-end, quarter-end) | `financialPeriods` table with open/closed/locked status; closing endpoint exists |
| BIZ-06 | Automated recurring invoice generation from templates | `recurringInvoiceTemplates` table + `/recurring-templates/:id/run` endpoint exist; needs pg-boss cron scheduling |
| BIZ-07 | Aged debtors/creditors reporting and conversational queries | `/reports/aged-debtors` and `/reports/aged-creditors` endpoints exist |
| BIZ-08 | Cash flow queries and forecasting | Dashboard endpoint has cash balance, receivables, payables; needs new aggregation for cash flow over time |
| BIZ-09 | Auto-journal-entry creation from business events (sale completions, commission income, etc.) | `accountingIntegration.ts` has patterns; needs new event hooks for sales completions, letting fees |
| BIZ-10 | Purchase invoice approval workflow and conversational tracking | Purchase invoice CRUD + approve endpoint exist; Riley provides conversational access |
| BIZ-11 | Credit note management via conversational commands | Credit note CRUD + apply endpoints exist; Riley wraps as tools |
| BIZ-12 | Payment allocation via conversational commands | Payment allocation CRUD exists; Riley provides guided allocation |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @openai/agents | (installed) | Riley agent definition, tools, handoff | Established in Phase 2 for all agents |
| zod4 | (alias) | Tool parameter schemas for Agents SDK | Required by @openai/agents, project uses npm alias |
| pg-boss | (installed) | Cron jobs for recurring invoice generation, period closing, VAT calculation | Established across Phases 2-8 |
| express | 4.x | API routes (minimal new -- mostly extends accountingRoutes.ts) | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| accountingIntegration | (internal) | Journal entry creation from business events | Auto-posting from sale completions, commission income |
| accountingRoutes | (internal) | Existing CRUD + report queries | Riley's tools wrap these query patterns |
| dealEventBus | (internal) | Business event subscription | sale.completed, commission events |
| auditLogger | (internal) | Agent action audit trail | Logging all Riley actions |
| emailService | (internal) | Report delivery via email | Sending PDF reports to directors |
| pdfService | (internal, from Phase 8) | PDF report generation | P&L, balance sheet, VAT return PDFs |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Raw SQL queries | Drizzle ORM | Raw SQL established for all financial queries in this codebase; more efficient for complex aggregations |
| Custom report engine | Existing trial balance + aggregation | All financial reports derive from the existing trial balance query -- no need for a separate engine |

**Installation:**
No new npm packages needed. Everything required is already installed.

## Architecture Patterns

### Recommended Project Structure
```
server/
  agents/sdk/
    businessAccountsAgent.ts   # Riley agent definition + tools
    supervisorAgent.ts         # Add Riley handoff (modify)
  services/
    businessAccountsService.ts # Orchestration: cron jobs, event hooks, report aggregation
    pdfService.ts              # Extend with P&L, balance sheet, cash flow PDF templates
  accountingRoutes.ts          # Extend with Riley-specific endpoints (if any)
  accountingIntegration.ts     # Extend with new auto-journal patterns
```

### Pattern 1: Agent Definition (follow pmAgent.ts pattern)
**What:** Define Riley as an OpenAI Agents SDK agent with persona, tools, and instructions
**When to use:** Agent setup
**Example:**
```typescript
// server/agents/sdk/businessAccountsAgent.ts
import { Agent, tool } from '@openai/agents';
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';

const BUSINESS_ACCOUNTS_INSTRUCTIONS = `You are Riley, the Business Accounts specialist at John Barclay Estate Agents.

You handle company-wide financial queries for staff members:
- Profit & Loss reports (by period, date range, comparisons)
- Balance sheet queries
- VAT return status and calculations
- Cash flow and cash position queries
- Aged debtors and creditors reports
- Business invoice and purchase invoice tracking
- Payment allocation guidance
- Financial period status

You work with posted journal entries in a double-entry accounting system. All amounts are in pence internally but you present them in GBP (pounds and pence) to the user.

IMPORTANT: You do NOT handle:
- Tenant rent invoices or landlord statements (that's Taylor from Accounts)
- Rent arrears chasing (that's Sarah from Accounts)
- Property-level cost queries (that's the cost ledger in PM)

When asked about financial data, use your tools to query the accounting system. Present figures clearly with proper GBP formatting. If a financial period is still open, note that figures may change.`;

export const businessAccountsAgent = new Agent<AgentContext>({
  name: 'Riley from Business Accounts',
  model: 'gpt-4o',
  instructions: BUSINESS_ACCOUNTS_INSTRUCTIONS,
  tools: [
    queryProfitAndLossTool,
    queryBalanceSheetTool,
    queryTrialBalanceTool,
    queryVatReturnTool,
    calculateVatReturnTool,
    queryCashPositionTool,
    queryAgedDebtorsTool,
    queryAgedCreditorsTool,
    queryBusinessInvoiceTool,
    queryPurchaseInvoiceTool,
    queryFinancialPeriodsTool,
    closeFinancialPeriodTool,
    generateRecurringInvoicesTool,
    escalateToHumanTool,
  ],
});
```

### Pattern 2: Wrapping Existing Queries as Tools
**What:** Riley's tools wrap the SQL patterns already in accountingRoutes.ts
**When to use:** For every agent tool that reads financial data
**Why:** The queries are already written and tested -- Riley just needs to call them and format results
**Example:**
```typescript
const queryProfitAndLossTool = tool({
  name: 'query_profit_and_loss',
  description: 'Get profit and loss report for a date range',
  parameters: z4.object({
    startDate: z4.string().describe('Start date (YYYY-MM-DD)'),
    endDate: z4.string().describe('End date (YYYY-MM-DD)'),
  }),
  execute: async ({ startDate, endDate }) => {
    const { pool } = await import('../../db');
    // Same query pattern as trial-balance endpoint, filtered to revenue + expense accounts
    const result = await pool.query(`
      SELECT coa.account_code, coa.account_name, coa.account_type, coa.normal_balance,
             COALESCE(SUM(jel.debit_amount), 0) as total_debits,
             COALESCE(SUM(jel.credit_amount), 0) as total_credits
      FROM chart_of_accounts coa
      LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
      LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
        AND je.status = 'posted'
        AND je.entry_date >= $1 AND je.entry_date <= $2
      WHERE coa.is_active = true AND coa.account_type IN ('revenue', 'expense')
      GROUP BY coa.id ORDER BY coa.account_code
    `, [startDate, endDate]);

    const revenue = result.rows.filter(r => r.account_type === 'revenue');
    const expenses = result.rows.filter(r => r.account_type === 'expense');
    const totalRevenue = revenue.reduce((sum, r) =>
      sum + (parseInt(r.total_credits) - parseInt(r.total_debits)), 0);
    const totalExpenses = expenses.reduce((sum, r) =>
      sum + (parseInt(r.total_debits) - parseInt(r.total_credits)), 0);

    return {
      revenue: revenue.map(r => ({
        code: r.account_code, name: r.account_name,
        amount: parseInt(r.total_credits) - parseInt(r.total_debits)
      })),
      expenses: expenses.map(r => ({
        code: r.account_code, name: r.account_name,
        amount: parseInt(r.total_debits) - parseInt(r.total_credits)
      })),
      totalRevenue, totalExpenses,
      netProfit: totalRevenue - totalExpenses
    };
  },
});
```

### Pattern 3: pg-boss Cron for Recurring Operations
**What:** Scheduled jobs for recurring invoices, period closing reminders, VAT calculation triggers
**When to use:** Automated monthly/quarterly tasks
**Example:**
```typescript
export async function registerBusinessAccountsCronJobs() {
  const b = await getBoss();

  // Run recurring invoice templates on their schedule (daily check)
  await b.schedule('riley:process-recurring-invoices', '0 6 * * *', {});

  // Remind about period closing on 5th of each month
  await b.schedule('riley:period-close-reminder', '0 9 5 * *', {});

  // Auto-calculate VAT return when quarter ends (1st of Jan/Apr/Jul/Oct)
  await b.schedule('riley:vat-quarter-check', '0 8 1 1,4,7,10 *', {});

  b.work('riley:process-recurring-invoices', async () => {
    // Query recurring_invoice_templates where next_generation_date <= today and is_active
    // For each, call the existing /recurring-templates/:id/run logic
  });
}
```

### Pattern 4: Auto-Journal Entry from Business Events
**What:** Subscribe to deal events and auto-create journal entries
**When to use:** When sales complete, letting fees earned, commissions due
**Example:**
```typescript
// Extend accountingIntegration.ts or new businessAccountsEventHooks.ts
dealEventBus.on(DEAL_EVENTS.SALE_COMPLETED, async (payload) => {
  // Auto-create journal entry for commission income
  // DR: Accounts Receivable (1100) - commission amount
  // CR: Commission Income (4020/4010) - commission amount
  // CR: VAT Output (2100) - VAT on commission
  await accountingRecordCommissionIncome(payload.propertyId, payload.commissionAmount);
});
```

### Anti-Patterns to Avoid
- **Duplicating accounting queries:** accountingRoutes.ts has 1816 lines of working SQL queries. Riley's tools should call the same query patterns or extract shared functions -- do NOT rewrite the queries.
- **Riley handling tenant/landlord PM finance:** That is Taylor's domain (Phase 8). Riley handles company-level accounting only.
- **Auto-closing periods without staff awareness:** Period closing locks journal entries. Always notify staff before auto-closing; provide a reminder tool, not auto-execute.
- **Mixing pence and pounds in agent responses:** Internally everything is pence. Riley must convert to pounds for display: `(amount / 100).toFixed(2)`.
- **Eager pg-boss initialization:** Always use lazy init pattern.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Trial balance calculation | Custom aggregation | Existing trial-balance query in accountingRoutes.ts | Already handles opening balances, normal balance direction, debit/credit totals |
| VAT return calculation | Custom VAT logic | Existing `/vat-returns/:id/calculate` logic | Handles all 9 HMRC boxes correctly including post-Brexit zeroes |
| Journal entry creation | Manual SQL inserts | `createJournalEntry()` in accountingIntegration.ts | Handles entry numbering, line balancing, posting, account ID resolution |
| Aged debtors/creditors | Custom ageing logic | Existing `/reports/aged-debtors` and `/reports/aged-creditors` queries | 30/60/90/120+ day ageing buckets already implemented |
| Business invoice CRUD | New endpoints | Existing accountingRoutes.ts endpoints | Full lifecycle: create, send, record payment, void |
| Recurring invoice generation | Custom scheduler | Existing `/recurring-templates/:id/run` endpoint | Creates business invoice from template with proper numbering |
| PDF generation | New PDF library | pdfService.ts from Phase 8 | PDFKit already set up with branding; extend with report templates |
| Audit logging | Custom logging | `auditLogger` | Established across all agents |

**Key insight:** Phase 10 is a "thin agent" phase. The accounting system is already 95% built (schema, routes, UI, integration). Riley's value-add is: (1) conversational access for staff who do not want to navigate 20+ UI pages, (2) automation of recurring manual tasks via cron, and (3) auto-journal-entry creation from business events to keep the ledger current.

## Common Pitfalls

### Pitfall 1: Duplicating Query Logic
**What goes wrong:** Writing new SQL queries for P&L, balance sheet, etc. that subtly differ from the existing accountingRoutes.ts queries, causing Riley's answers to not match the UI.
**Why it happens:** The temptation to write "cleaner" queries for the agent tools.
**How to avoid:** Extract shared query functions from accountingRoutes.ts into a `accountingQueries.ts` module. Both the routes and Riley's tools call the same functions.
**Warning signs:** Riley reporting different figures than the AccountingDashboard page.

### Pitfall 2: Financial Period Boundaries
**What goes wrong:** Queries that do not respect financial period boundaries. The financial year starts in April (configurable via `businessSettings.financialYearStart`). "This year's P&L" means April-March, not January-December.
**Why it happens:** Assuming calendar year = financial year.
**How to avoid:** Always read `businessSettings.financialYearStart` when resolving "this year", "this quarter", "YTD" in natural language queries.
**Warning signs:** P&L for "this year" showing January-December instead of April-March.

### Pitfall 3: Unbalanced Journal Entries
**What goes wrong:** Auto-created journal entries where total debits do not equal total credits.
**Why it happens:** Rounding errors when calculating VAT (especially with 20% VAT on odd pence amounts).
**How to avoid:** The existing `createJournalEntry()` function in accountingIntegration.ts should validate balance before posting. Always calculate the last line as the remainder to avoid rounding drift.
**Warning signs:** Trial balance showing debits != credits.

### Pitfall 4: Amounts in Pence vs Display
**What goes wrong:** Riley telling a staff member "Your revenue is 15000000" instead of "150,000.00".
**Why it happens:** All DB amounts are in pence. The agent must format for human consumption.
**How to avoid:** In agent instructions, explicitly state all tool results are in pence and Riley must convert. Better: have tools return pre-formatted strings alongside raw values.
**Warning signs:** Agent responses with very large numbers lacking decimal points.

### Pitfall 5: Client Money vs Business Money Confusion
**What goes wrong:** Mixing up client money (rent collected, tenant deposits held in trust) with John Barclay's own business revenue.
**Why it happens:** The chart of accounts has both: 1010 (Business Current Account) and 1020 (Client Money Account), plus 2400 (Client Money Liability).
**How to avoid:** Riley's P&L must only include business revenue accounts (4xxx) and expense accounts (5xxx/6xxx). Client money flows are liability movements, not revenue/expense. Riley's instructions must make this distinction clear.
**Warning signs:** P&L showing inflated revenue because rent pass-through is counted as income.

### Pitfall 6: Staff-Only Agent
**What goes wrong:** Routing tenant or landlord finance queries to Riley instead of Taylor.
**Why it happens:** Supervisor misclassifying "I have a question about my invoice" as a business accounts query.
**How to avoid:** Riley's Supervisor handoff description must be explicitly for staff/internal queries only. Taylor handles all external-facing (tenant/landlord) finance queries. The Supervisor routing instructions must distinguish "staff asking about business P&L" from "tenant asking about their rent invoice".
**Warning signs:** Tenants getting routed to Riley who cannot help them.

## Code Examples

### Extracting Shared Query Functions
```typescript
// server/accountingQueries.ts (new file -- extract from accountingRoutes.ts)
import { pool } from './db';

export interface TrialBalanceRow {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  balance: number;
}

export async function getTrialBalance(asAt?: string): Promise<{
  accounts: TrialBalanceRow[];
  totalDebitBalances: number;
  totalCreditBalances: number;
}> {
  const dateCondition = asAt ? `AND je.entry_date <= $1` : '';
  const params = asAt ? [asAt] : [];
  const result = await pool.query(
    `SELECT coa.id, coa.account_code, coa.account_name, coa.account_type,
            coa.normal_balance, coa.opening_balance,
            COALESCE(SUM(jel.debit_amount), 0) as total_debits,
            COALESCE(SUM(jel.credit_amount), 0) as total_credits
     FROM chart_of_accounts coa
     LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
     LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
       AND je.status = 'posted' ${dateCondition}
     WHERE coa.is_active = true
     GROUP BY coa.id ORDER BY coa.account_code`,
    params
  );
  // ... same balance calculation as accountingRoutes.ts trial-balance endpoint
  let totalDebitBalances = 0;
  let totalCreditBalances = 0;
  const accounts = result.rows.map((row: any) => {
    const opening = row.opening_balance || 0;
    const debits = parseInt(row.total_debits) || 0;
    const credits = parseInt(row.total_credits) || 0;
    let balance: number;
    if (row.normal_balance === 'debit') balance = opening + debits - credits;
    else balance = opening + credits - debits;
    if (balance >= 0 && row.normal_balance === 'debit') totalDebitBalances += balance;
    else if (balance >= 0 && row.normal_balance === 'credit') totalCreditBalances += balance;
    else if (balance < 0 && row.normal_balance === 'debit') totalCreditBalances += Math.abs(balance);
    else totalDebitBalances += Math.abs(balance);
    return { ...row, total_debits: debits, total_credits: credits, balance };
  });
  return { accounts, totalDebitBalances, totalCreditBalances };
}

export function getProfitAndLoss(startDate: string, endDate: string) {
  // Filter trial balance to revenue + expense, compute net profit
}

export function getBalanceSheet(asAt: string) {
  // Filter trial balance to asset + liability + equity
}

export function getCashPosition() {
  // Sum balances of bank accounts (1010, 1020)
}
```

### Auto-Journal Entry for Commission Income
```typescript
// Extend accountingIntegration.ts
export async function accountingRecordCommissionIncome(
  propertyId: number,
  commissionPence: number,
  description: string,
  sourceType: string = 'sales_invoice',
  sourceId?: number
): Promise<number | null> {
  const vatPence = Math.round(commissionPence * 0.2); // 20% VAT
  const totalPence = commissionPence + vatPence;

  return createJournalEntry(
    description,
    [
      { accountCode: '1100', description: 'Commission receivable', debitAmount: totalPence, creditAmount: 0 },
      { accountCode: '4010', description: 'Management fee income', debitAmount: 0, creditAmount: commissionPence },
      { accountCode: '2100', description: 'VAT on commission', debitAmount: 0, creditAmount: vatPence },
    ],
    { sourceType, sourceId, propertyId }
  );
}
```

### Financial Year Resolver
```typescript
// server/services/businessAccountsService.ts
export async function getFinancialYearDates(offset: number = 0): Promise<{
  start: string;
  end: string;
  label: string;
}> {
  const settings = await pool.query('SELECT financial_year_start FROM business_settings LIMIT 1');
  const fyStartMonth = settings.rows[0]?.financial_year_start || 4; // Default April

  const now = new Date();
  let fyStartYear = now.getFullYear() + offset;
  // If current month is before FY start, the FY started last year
  if (now.getMonth() + 1 < fyStartMonth && offset === 0) fyStartYear--;

  const start = new Date(fyStartYear, fyStartMonth - 1, 1);
  const end = new Date(fyStartYear + 1, fyStartMonth - 1, 0, 23, 59, 59);

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    label: `FY ${fyStartYear}/${fyStartYear + 1}`,
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual journal entry creation | Auto-journal from business events + conversational creation | Phase 10 | Eliminates manual double-entry for routine transactions |
| Navigate 20+ UI pages for reports | Ask Riley in natural language | Phase 10 | Staff gets instant answers without navigating complex accounting UI |
| Manual VAT return calculation | Auto-calculated quarterly + conversational status check | Phase 10 | Quarterly VAT is automated, staff just reviews and submits |
| Manual recurring invoice generation | pg-boss cron runs templates automatically | Phase 10 | Recurring management fees, service charges auto-generated |
| Manual period closing | Reminder-driven with single-click close via Riley | Phase 10 | No more forgotten open periods |

**Key context:** The existing accounting system (chart of accounts, journal entries, VAT returns, business/purchase invoices, credit notes, payment allocations, reports) was built as traditional CRUD UI. Phase 10 adds an AI conversational layer + automation on top of this already-complete system.

## Open Questions

1. **Staff-Only vs Universal Routing**
   - What we know: Riley is for company-wide business financials. Staff members ask Riley about P&L, VAT, cash position. External contacts (tenants, landlords) use Taylor for their finance queries.
   - What's unclear: Should the Supervisor only route to Riley when the contact is identified as a staff member? Or should intent classification alone determine routing?
   - Recommendation: Route to Riley based on intent + context. If the query is clearly internal business finance ("what's our P&L this quarter?"), route to Riley regardless. If the contact is an external tenant/landlord, never route to Riley -- always Taylor.

2. **Report PDF Generation**
   - What we know: Phase 8 establishes pdfService.ts with PDFKit for branded documents. P&L and balance sheet pages exist as React UI.
   - What's unclear: Should Riley generate PDF reports for email delivery, or is conversational text sufficient?
   - Recommendation: Support both. Quick queries get text answers. Staff can say "email me the P&L for Q3" and Riley generates a PDF via pdfService and sends via emailService.

3. **Auto-Journal Scope**
   - What we know: accountingIntegration.ts handles rent payments, management fees, landlord payments, expenses, business invoice sent/paid, purchase invoices.
   - What's unclear: What additional business events should auto-generate journal entries? Sale completions, letting fees, finder's fees?
   - Recommendation: Add auto-journal for: (a) sale completion commission, (b) letting fee income (from lettingServiceTerms), (c) recurring invoice posting. Other entries remain manual.

4. **Financial Period Auto-Close**
   - What we know: `financialPeriods` supports open/closed/locked status. Closing a period prevents further journal entries in that period.
   - What's unclear: Should Riley auto-close periods or just remind staff?
   - Recommendation: Remind only. Auto-close is risky (late entries get rejected). Riley sends a reminder on the 5th of each month for the previous month's period, then staff confirms close.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | vitest.config.ts |
| Quick run command | `npx vitest run server/__tests__/businessAccountsAgent.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BIZ-01 | Riley registered in Supervisor with correct routing | unit (static analysis) | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "supervisor registration"` | No -- Wave 0 |
| BIZ-02 | P&L query tool returns correct revenue/expense/net profit | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "profit and loss"` | No -- Wave 0 |
| BIZ-03 | Balance sheet tool returns assets/liabilities/equity balanced | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "balance sheet"` | No -- Wave 0 |
| BIZ-04 | VAT return calculation tool calls correct aggregation | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "vat return"` | No -- Wave 0 |
| BIZ-05 | Financial period close tool updates status correctly | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "period close"` | No -- Wave 0 |
| BIZ-06 | Recurring invoice cron generates invoices from active templates | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "recurring invoices"` | No -- Wave 0 |
| BIZ-07 | Aged debtors tool returns correct ageing buckets | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "aged debtors"` | No -- Wave 0 |
| BIZ-08 | Cash position tool sums bank account balances | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "cash position"` | No -- Wave 0 |
| BIZ-09 | Sale completion event creates balanced journal entry | unit | `npx vitest run server/__tests__/businessAccountsAgent.test.ts -t "auto journal"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run server/__tests__/businessAccountsAgent.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/__tests__/businessAccountsAgent.test.ts` -- covers BIZ-01 through BIZ-09
- [ ] No new framework install needed (Vitest already configured)

## Sources

### Primary (HIGH confidence)
- `shared/schema.ts` lines 7331-7380 -- businessSettings table (financial year start, VAT config, invoice numbering)
- `shared/schema.ts` lines 7386-7405 -- chartOfAccounts table
- `shared/schema.ts` lines 7411-7427 -- taxRates table
- `shared/schema.ts` lines 7433-7449 -- financialPeriods table (open/closed/locked)
- `shared/schema.ts` lines 7455-7498 -- journalEntries + journalEntryLines tables
- `shared/schema.ts` lines 7504-7557 -- businessInvoices + businessInvoiceLines tables
- `shared/schema.ts` lines 7563-7618 -- purchaseInvoices + purchaseInvoiceLines tables
- `shared/schema.ts` lines 7624-7670 -- creditNotes + paymentAllocations tables
- `shared/schema.ts` lines 7676-7718 -- vatReturns + vatReturnTransactions tables
- `shared/schema.ts` lines 7724-7750 -- recurringInvoiceTemplates table
- `server/accountingRoutes.ts` (1816 lines) -- Full CRUD + reports for all accounting entities
- `server/accountingIntegration.ts` -- Journal entry creation bridge (7 exported functions)
- `server/agents/sdk/pmAgent.ts` -- Agent definition pattern
- `server/agents/sdk/supervisorAgent.ts` -- Supervisor handoff pattern (4 existing handoffs)
- `server/agents/sdk/arrearsAgent.ts` -- Finance-adjacent agent persona (Sarah from Accounts)
- `client/src/pages/AccountingDashboard.tsx` -- Existing dashboard (revenue, expenses, net profit, cash balance)
- `client/src/pages/ProfitAndLoss.tsx` -- Existing P&L page (client-side computation from trial balance)
- `client/src/pages/BalanceSheet.tsx` -- Existing balance sheet page
- `client/src/pages/VATReturns.tsx` -- Existing VAT returns page with HMRC box layout
- `client/src/components/CRMLayout.tsx` -- 20+ accounting sidebar navigation items already in place

### Secondary (MEDIUM confidence)
- Phase 8 research (08-RESEARCH.md) -- Taylor agent patterns, pdfService, pg-boss cron, lazy init

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in codebase
- Architecture: HIGH -- follows exact patterns from Phases 2-8; accounting system already 95% built
- Pitfalls: HIGH -- discovered through direct schema inspection and accounting routes analysis
- Requirements: MEDIUM -- no pre-defined requirement IDs; derived from phase description and existing system analysis

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- all dependencies already locked in project)
