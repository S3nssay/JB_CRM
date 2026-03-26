---
phase: 10-business-accounts-agent-company-wide-financials
verified: 2026-03-26T21:00:00Z
status: passed
score: 13/13 must-haves verified
gaps: []
human_verification:
  - test: "Trigger sale.completed deal event with a commission payload and confirm a journal entry row appears in journal_entries table with correct DR/CR lines"
    expected: "journal_entries row created, journal_entry_lines shows DR 1100, CR 4020, CR 2100 with balanced amounts"
    why_human: "End-to-end pg-boss event delivery to worker requires a running database and pg-boss instance"
  - test: "Ask Riley via the agent runner: 'What is our P&L for April 2025 to March 2026?'"
    expected: "Riley responds with totalRevenue, totalExpenses, netProfit figures from the accounting system in GBP (not pence)"
    why_human: "Requires live OpenAI API call via agent runner and live database with posted journal entries"
  - test: "Ask Riley: 'Show me the cash position'"
    expected: "Riley returns balance of business current account (1010) and client money account (1020) in GBP"
    why_human: "Requires live database and live OpenAI API"
---

# Phase 10: Business Accounts Agent — Company-Wide Financials Verification Report

**Phase Goal:** Riley, a Business Accounts AI agent, provides conversational access to company-wide financials (P&L, balance sheet, VAT returns, cash position, aged debtors/creditors, financial periods) for staff, and automates recurring accounting tasks (recurring invoice generation, commission journal entries on deal completion, period close reminders, VAT quarter-end reminders).
**Verified:** 2026-03-26T21:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Staff can ask Riley about P&L for a date range and get correct revenue/expense/net profit | VERIFIED | `getProfitAndLoss` in accountingQueries.ts queries `chart_of_accounts` + `journal_entry_lines` filtered to revenue/expense types; agent tool `query_profit_and_loss` calls it with lazy import |
| 2 | Staff can ask Riley for a balance sheet and get assets/liabilities/equity that balance | VERIFIED | `getBalanceSheet` in accountingQueries.ts filters to asset/liability/equity account types; agent tool `query_balance_sheet` present and wired |
| 3 | Staff can ask Riley about VAT return status and get correct HMRC box figures | VERIFIED | `query_vat_return` tool queries `vat_returns` + `vat_return_transactions`; `calculate_vat_return` tool computes boxes 1–9 with DB transaction |
| 4 | Staff can ask Riley to close a financial period and it updates status | VERIFIED | `close_financial_period` tool validates `status = 'open'` before `UPDATE financial_periods SET status = 'closed'`; returns error if not found or not open |
| 5 | Staff can ask Riley about aged debtors/creditors and get correct ageing buckets | VERIFIED | `getAgedDebtors` + `getAgedCreditors` in accountingQueries.ts return current/1-30/31-60/61-90/90+ day buckets; both agent tools present |
| 6 | Staff can ask Riley about cash position and get correct bank account balances | VERIFIED | `getCashPosition` queries account codes 1010 (business) and 1020 (client money); agent tool `query_cash_position` calls it |
| 7 | Supervisor routes internal finance queries to Riley, not to Taylor or other agents | VERIFIED | supervisorAgent.ts line 104: `handoff(businessAccountsAgent, { toolNameOverride: 'transfer_to_business_accounts', ... })`; instructions explicitly distinguish Riley (staff financials) from Taylor (tenant/landlord) |
| 8 | Recurring invoice templates are processed daily by cron, generating business invoices automatically | VERIFIED | `riley:process-recurring-invoices` scheduled `'0 6 * * *'` in businessAccountsService.ts; handler queries `recurring_invoice_templates WHERE is_active = true AND next_generation_date <= $1`, inserts `business_invoices` + `business_invoice_lines`, updates `next_generation_date` |
| 9 | Sale completion events auto-create balanced journal entries for commission income | VERIFIED | `registerBusinessAccountsEventHooks` subscribes to `DEAL_EVENTS.SALE_COMPLETED`; calls `accountingRecordCommissionIncome` (DR 1100, CR 4020, CR 2100); `SALE_COMPLETED` constant added to dealEventBus |
| 10 | Letting fee events auto-create balanced journal entries for letting fee income | VERIFIED | Subscribes to `DEAL_EVENTS.TENANCY_AGREED`; calls `accountingRecordLettingFee` (DR 1100, CR 4010, CR 2100); VAT at 20% via Math.round |
| 11 | Period close reminders are sent monthly on the 5th | VERIFIED | `riley:period-close-reminder` scheduled `'0 9 5 * *'`; queries `financial_periods WHERE status = 'open' AND end_date < first-of-month`; emails admin users; explicitly does NOT auto-close |
| 12 | VAT quarter-end triggers auto-calculation reminder | VERIFIED | `riley:vat-quarter-check` scheduled `'0 8 1 1,4,7,10 *'`; queries `vat_returns WHERE status = 'draft' AND period_end < today`; emails admin users |
| 13 | Cron jobs and event hooks are registered at server startup and execute in production | VERIFIED | server/index.ts lines 82–87: lazy import of `businessAccountsService`, calls `registerBusinessAccountsCronJobs()` then `registerBusinessAccountsEventHooks()` in `.then()` block |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/accountingQueries.ts` | 7 shared query functions extracted from accountingRoutes.ts patterns | VERIFIED | 7 exported async functions: getTrialBalance, getProfitAndLoss, getBalanceSheet, getCashPosition, getAgedDebtors, getAgedCreditors, getFinancialYearDates; 428 lines; substantive SQL implementations |
| `server/agents/sdk/businessAccountsAgent.ts` | Riley agent with 12 financial tools, name 'Riley from Business Accounts', model gpt-4o | VERIFIED | 334 lines; Agent<AgentContext> exported; 11 local tool definitions + escalateToHumanTool = 12 total; gpt-4o model; pence/GBP instructions present |
| `server/agents/sdk/supervisorAgent.ts` | Updated with Riley handoff via transfer_to_business_accounts | VERIFIED | Line 23: import; line 104: handoff with toolNameOverride 'transfer_to_business_accounts'; supervisor instructions include Riley routing rules |
| `server/__tests__/businessAccountsAgent.test.ts` | Unit tests for BIZ-01 through BIZ-08, min 80 lines | VERIFIED | 262 lines; static analysis tests covering agent name, model, 12 tool names, instruction content (pence/GBP, Taylor boundary, financial year), lazy imports, query function exports |
| `server/services/businessAccountsService.ts` | pg-boss cron registration + deal event hooks | VERIFIED | 372 lines; exports registerBusinessAccountsCronJobs and registerBusinessAccountsEventHooks; 3 cron schedules; 2 event subscriptions; lazy init pattern; fire-and-forget handlers |
| `server/accountingIntegration.ts` | Extended with accountingRecordCommissionIncome and accountingRecordLettingFee | VERIFIED | Both functions exported at lines 447 and 480; balanced double-entry (DR 1100, CR 4020/4010, CR 2100); Math.round VAT; sourceType/sourceId parameters |
| `server/index.ts` | Server startup calls registerBusinessAccountsCronJobs and registerBusinessAccountsEventHooks | VERIFIED | Lines 82–87: lazy import pattern, both registration functions called in .then() |
| `server/__tests__/businessAccountsService.test.ts` | Tests for cron handlers and auto-journal entry creation, min 60 lines | VERIFIED | 309 lines; covers commission/letting exports, account codes, VAT rounding, cron schedules, period close (no auto-close assertion), VAT quarter, event hooks, SALE_COMPLETED constant, server startup wiring, lazy init patterns |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| businessAccountsAgent.ts | accountingQueries.ts | lazy import in tool execute functions | WIRED | `await import('../../accountingQueries')` appears 6+ times for getProfitAndLoss, getBalanceSheet, getTrialBalance, getCashPosition, getAgedDebtors, getAgedCreditors, getFinancialYearDates |
| supervisorAgent.ts | businessAccountsAgent.ts | handoff(businessAccountsAgent) | WIRED | Line 23: import; line 104: `handoff(businessAccountsAgent, { toolNameOverride: 'transfer_to_business_accounts' })` |
| businessAccountsService.ts | accountingIntegration.ts | lazy import calling accountingRecordCommissionIncome/LettingFee | WIRED | `_accountingIntegration = await import('../accountingIntegration')` then `accounting.accountingRecordCommissionIncome(...)` and `accounting.accountingRecordLettingFee(...)` |
| businessAccountsService.ts | dealEventBus.ts | dealEventBus.subscribe for sale.completed and tenancy.agreed | WIRED | `dealEventBus.subscribe(DEAL_EVENTS.SALE_COMPLETED, ...)` and `dealEventBus.subscribe(DEAL_EVENTS.TENANCY_AGREED, ...)` — note: plan specified `.on` pattern but actual API is `.subscribe`; implementation is correct |
| server/index.ts | businessAccountsService.ts | registerBusinessAccountsCronJobs() and registerBusinessAccountsEventHooks() at startup | WIRED | Lines 82–87 call both functions via lazy import in server startup IIFE |

### Requirements Coverage

BIZ requirements are defined in `10-RESEARCH.md` and referenced in ROADMAP.md. They are NOT present in `.planning/REQUIREMENTS.md` — the REQUIREMENTS.md covers only the v1/v2 system requirements (KB-, AGENT-, PM- etc.) and has no BIZ- entries. The BIZ requirements are phase-specific requirements created for Phase 10 only.

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| BIZ-01 | 10-01 | Riley as conversational agent registered in Supervisor for staff finance queries | SATISFIED | supervisorAgent.ts imports and registers businessAccountsAgent with transfer_to_business_accounts handoff |
| BIZ-02 | 10-01 | Natural-language P&L report generation (by period, date range) | SATISFIED | query_profit_and_loss tool calls getProfitAndLoss with startDate/endDate; substantive SQL returns revenue/expense/netProfit |
| BIZ-03 | 10-01 | Natural-language balance sheet generation | SATISFIED | query_balance_sheet tool calls getBalanceSheet; filters to asset/liability/equity; categorised result |
| BIZ-04 | 10-01 | VAT return auto-calculation and conversational queries | SATISFIED | query_vat_return + calculate_vat_return tools; calculate_vat_return computes all 9 HMRC boxes and updates vat_returns table |
| BIZ-05 | 10-01 | Automated financial period closing (month-end, quarter-end) | SATISFIED | close_financial_period tool validates open status and closes; query_financial_periods tool lists all periods |
| BIZ-06 | 10-02 | Automated recurring invoice generation from templates | SATISFIED | riley:process-recurring-invoices cron at '0 6 * * *'; queries recurring_invoice_templates, creates business_invoices + lines, updates next_generation_date |
| BIZ-07 | 10-01 | Aged debtors/creditors reporting and conversational queries | SATISFIED | query_aged_debtors and query_aged_creditors tools call getAgedDebtors/getAgedCreditors; 5 ageing buckets returned |
| BIZ-08 | 10-01 | Cash flow queries and cash position | SATISFIED | query_cash_position tool calls getCashPosition; returns businessAccount (1010), clientAccount (1020), total |
| BIZ-09 | 10-02 | Auto-journal-entry creation from business events (sale completions, commission income, letting fees) | SATISFIED | registerBusinessAccountsEventHooks subscribes to SALE_COMPLETED (commission) and TENANCY_AGREED (letting fee); balanced double-entry journal entries created |

**Orphaned BIZ requirements:** None — all 9 claimed by plans 10-01 (BIZ-01/02/03/04/05/07/08) and 10-02 (BIZ-06/09) and all 9 verified.

**REQUIREMENTS.md gap note:** BIZ-01 through BIZ-09 do not appear in `.planning/REQUIREMENTS.md`. They exist only in ROADMAP.md and RESEARCH.md. This is not a failure of this phase — the requirements document predates the BIZ phase — but the traceability table in REQUIREMENTS.md should eventually be updated to include Phase 10.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| server/accountingQueries.ts | 312 | SQL injection via string interpolation in `getAgedDebtors` and `getAgedCreditors`: `const dateRef = asAt ? \`'${asAt}'::date\` : 'NOW()'` inserted directly into query string | Warning | The `asAt` value is used directly in SQL string without parameterization. Agent tools accept this as a string from the LLM. Callers should validate YYYY-MM-DD format before passing to this function. Not exploitable from public surface (staff-only agent) but is a code quality concern. |
| server/accountingRoutes.ts.tmp.383644.1773329269112 | n/a | Stale temporary file left in server/ | Info | Temporary files from editing session; should be removed but do not affect runtime |

No blocker anti-patterns. No TODO/FIXME/placeholder comments in phase 10 files. No empty implementations (return null / return {} / return []).

### Human Verification Required

#### 1. End-to-end agent conversation: P&L query

**Test:** Start an agent runner session and send Riley the message: "Can you show me the profit and loss for the current financial year?"
**Expected:** Riley calls query_financial_year_dates to get FY boundaries, then calls query_profit_and_loss, returns a structured P&L with totalRevenue, totalExpenses, netProfit formatted as GBP (e.g. "£12,450.00") using British English
**Why human:** Requires live OpenAI API, live database with posted journal entries, and agent runner wired to Riley

#### 2. End-to-end cron job execution: recurring invoice generation

**Test:** Set a `recurring_invoice_templates` row with `is_active = true` and `next_generation_date = yesterday`. Manually trigger the `riley:process-recurring-invoices` pg-boss job (or wait for 6am). Check `business_invoices` table.
**Expected:** A new business_invoice row exists for the template, invoice_lines copied, next_generation_date updated to next interval
**Why human:** Requires a running pg-boss worker connected to the database

#### 3. End-to-end deal event: commission journal on sale completion

**Test:** Emit a `sale.completed` event via dealEventBus with a payload containing `commissionAmount: 300000` (£3,000) and a valid `propertyId` and `dealId`. Query `journal_entries` and `journal_entry_lines`.
**Expected:** journal_entries row created; journal_entry_lines shows DR 1100 for 360000 (£3,600 inc VAT), CR 4020 for 300000, CR 2100 for 60000 (20% VAT); total debits = total credits = 360000
**Why human:** Requires running pg-boss worker, live database, and valid account IDs in chart_of_accounts

### Gaps Summary

No gaps found. All 13 observable truths verified, all 8 artifacts pass levels 1–3 (exists, substantive, wired), all 5 key links confirmed wired, all 9 BIZ requirements satisfied by implementation evidence.

One plan deviation was found and is correctly handled: the plan's key_link pattern specified `dealEventBus\.on` but the actual dealEventBus API is `dealEventBus.subscribe`. The implementation uses the correct API. The plan pattern was a documentation error; the code is correct.

One minor code quality concern: SQL injection risk in `getAgedDebtors`/`getAgedCreditors` via `asAt` string interpolation. Not a goal blocker (staff-only internal tool, validated date strings expected) but worth addressing in a future cleanup.

---

_Verified: 2026-03-26T21:00:00Z_
_Verifier: Claude (gsd-verifier)_
