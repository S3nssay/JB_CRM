/**
 * Business Accounts Agent -- Riley from Business Accounts
 *
 * Staff-only agent for company-wide financial queries:
 * P&L, balance sheet, VAT returns, cash position, aged debtors/creditors,
 * financial period management, and trial balance.
 *
 * Does NOT handle tenant rent invoices or landlord statements (Taylor's domain).
 * Does NOT handle rent arrears (Sarah's domain).
 */

import { Agent, tool } from '@openai/agents';
// @ts-ignore -- zod4 is an npm alias for zod@4, required by @openai/agents SDK
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';
import { escalateToHumanTool } from './tools';

const BUSINESS_ACCOUNTS_INSTRUCTIONS = `You are Riley, a specialist business accounts assistant at John Barclay Estate Agents.

Your role is to help staff members with company-wide financial queries. You provide accurate financial data from the accounting system.

CORE RESPONSIBILITIES:
- Profit and Loss (P&L) reports for any date range
- Balance sheet reports as at any date
- Trial balance reports
- VAT return status and HMRC box figures
- Cash position (business current account and client money account)
- Aged debtors reports (who owes the company money, by ageing bucket)
- Aged creditors reports (who the company owes money to, by ageing bucket)
- Financial period management (query status, close periods)
- Financial year date calculations

IMPORTANT -- AMOUNTS IN PENCE:
- All amounts returned by tools are stored in pence (integer).
- You MUST convert to GBP for display: divide by 100 and format to 2 decimal places.
- Example: 125000 pence = 1,250.00 pounds sterling.
- Always prefix amounts with the pound sign.

SCOPE BOUNDARIES:
- You do NOT handle tenant rent invoices or landlord statements. Those belong to Taylor from PM Finance.
- You do NOT handle rent arrears. Those belong to Sarah from Accounts.
- If a staff member asks about tenant or landlord specific finances, politely explain that Taylor handles those queries and they should ask the Supervisor to connect them.

TONE AND STYLE:
- Professional and precise, suitable for financial reporting
- No emoji whatsoever
- British English throughout: use pounds sterling, British date format (dd/mm/yyyy), British spelling
- Present financial data in clear, structured formats
- When presenting tables of data, align numbers to the right for readability

FINANCIAL YEAR:
- The financial year start month is configurable (defaults to April).
- Always use query_financial_year_dates to determine the correct FY boundaries before generating date-ranged reports.
- Do not assume calendar year (January to December).

ESCALATION TRIGGERS (use escalate_to_human):
- Staff member asks to speak to a human
- You detect a complaint or significant frustration
- Queries about tax advice, audit matters, or regulatory compliance
- Data appears inconsistent or you suspect an accounting error
- Three or more unresolved exchanges on the same topic

AI SELF-IDENTIFICATION:
- On first contact: "I'm Riley, an AI assistant in the Business Accounts team at John Barclay Estate Agents"
- Do not repeat the AI disclosure in subsequent messages`;

// ---- Tools ----

const queryProfitAndLossTool = tool({
  name: 'query_profit_and_loss',
  description: 'Get profit and loss statement for a date range. Returns revenue, expenses, and net profit. All amounts in pence.',
  parameters: z4.object({
    startDate: z4.string().describe('Start date in YYYY-MM-DD format'),
    endDate: z4.string().describe('End date in YYYY-MM-DD format'),
  }),
  execute: async (_context: AgentContext, input: { startDate: string; endDate: string }) => {
    const { getProfitAndLoss } = await import('../../accountingQueries');
    return await getProfitAndLoss(input.startDate, input.endDate);
  },
});

const queryBalanceSheetTool = tool({
  name: 'query_balance_sheet',
  description: 'Get balance sheet as at a given date. Returns assets, liabilities, and equity. All amounts in pence.',
  parameters: z4.object({
    asAt: z4.string().describe('As-at date in YYYY-MM-DD format'),
  }),
  execute: async (_context: AgentContext, input: { asAt: string }) => {
    const { getBalanceSheet } = await import('../../accountingQueries');
    return await getBalanceSheet(input.asAt);
  },
});

const queryTrialBalanceTool = tool({
  name: 'query_trial_balance',
  description: 'Get trial balance showing all accounts with debit/credit balances. Optionally as at a specific date. All amounts in pence.',
  parameters: z4.object({
    asAt: z4.string().optional().describe('Optional as-at date in YYYY-MM-DD format. If omitted, uses all posted entries.'),
  }),
  execute: async (_context: AgentContext, input: { asAt?: string }) => {
    const { getTrialBalance } = await import('../../accountingQueries');
    return await getTrialBalance(input.asAt);
  },
});

const queryVatReturnTool = tool({
  name: 'query_vat_return',
  description: 'Get details of a specific VAT return including HMRC box figures and transactions.',
  parameters: z4.object({
    vatReturnId: z4.number().describe('ID of the VAT return to query'),
  }),
  execute: async (_context: AgentContext, input: { vatReturnId: number }) => {
    const { pool } = await import('../../db');
    const vrResult = await pool.query('SELECT * FROM vat_returns WHERE id = $1', [input.vatReturnId]);
    if (vrResult.rows.length === 0) {
      return { error: 'VAT return not found' };
    }
    const txResult = await pool.query(
      'SELECT * FROM vat_return_transactions WHERE vat_return_id = $1 ORDER BY id',
      [input.vatReturnId]
    );
    return { vatReturn: vrResult.rows[0], transactions: txResult.rows };
  },
});

const calculateVatReturnTool = tool({
  name: 'calculate_vat_return',
  description: 'Auto-calculate HMRC box figures for a VAT return based on posted journal entries in the period.',
  parameters: z4.object({
    vatReturnId: z4.number().describe('ID of the VAT return to calculate'),
  }),
  execute: async (_context: AgentContext, input: { vatReturnId: number }) => {
    const { pool } = await import('../../db');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const vrResult = await client.query('SELECT * FROM vat_returns WHERE id = $1', [input.vatReturnId]);
      if (vrResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return { error: 'VAT return not found' };
      }
      const vr = vrResult.rows[0];
      if (vr.status === 'submitted' || vr.status === 'paid') {
        await client.query('ROLLBACK');
        return { error: 'Cannot recalculate a submitted or paid VAT return' };
      }

      const periodStart = vr.period_start;
      const periodEnd = vr.period_end;

      // Box 1: VAT due on sales
      const box1Result = await client.query(`
        SELECT COALESCE(SUM(jel.tax_amount), 0) as total
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id
        WHERE je.status = 'posted'
          AND je.entry_date >= $1 AND je.entry_date <= $2
          AND coa.account_type = 'revenue'
          AND jel.tax_amount > 0
      `, [periodStart, periodEnd]);
      const box1 = parseInt(box1Result.rows[0].total) || 0;
      const box2 = 0; // EU acquisitions (typically 0 post-Brexit)
      const box3 = box1 + box2;

      // Box 4: VAT reclaimed on inputs
      const box4Result = await client.query(`
        SELECT COALESCE(SUM(jel.tax_amount), 0) as total
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id
        WHERE je.status = 'posted'
          AND je.entry_date >= $1 AND je.entry_date <= $2
          AND coa.account_type = 'expense'
          AND jel.tax_amount > 0
      `, [periodStart, periodEnd]);
      const box4 = parseInt(box4Result.rows[0].total) || 0;
      const box5 = box3 - box4;

      // Box 6: Total sales ex VAT
      const box6Result = await client.query(`
        SELECT COALESCE(SUM(jel.credit_amount - jel.debit_amount), 0) as total
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id
        WHERE je.status = 'posted'
          AND je.entry_date >= $1 AND je.entry_date <= $2
          AND coa.account_type = 'revenue'
      `, [periodStart, periodEnd]);
      const box6 = Math.abs(parseInt(box6Result.rows[0].total) || 0);

      // Box 7: Total purchases ex VAT
      const box7Result = await client.query(`
        SELECT COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as total
        FROM journal_entry_lines jel
        JOIN journal_entries je ON jel.journal_entry_id = je.id
        JOIN chart_of_accounts coa ON jel.account_id = coa.id
        WHERE je.status = 'posted'
          AND je.entry_date >= $1 AND je.entry_date <= $2
          AND coa.account_type = 'expense'
      `, [periodStart, periodEnd]);
      const box7 = Math.abs(parseInt(box7Result.rows[0].total) || 0);

      // Box 8 & 9: EU supplies (typically 0 post-Brexit)
      const box8 = 0;
      const box9 = 0;

      // Update VAT return with calculated figures
      await client.query(`
        UPDATE vat_returns SET
          box1_vat_due_sales = $2,
          box2_vat_due_acquisitions = $3,
          box3_total_vat_due = $4,
          box4_vat_reclaimed = $5,
          box5_net_vat = $6,
          box6_total_sales = $7,
          box7_total_purchases = $8,
          box8_total_eu_supplies = $9,
          box9_total_eu_acquisitions = $10,
          status = 'calculated',
          updated_at = NOW()
        WHERE id = $1
      `, [input.vatReturnId, box1, box2, box3, box4, box5, box6, box7, box8, box9]);

      await client.query('COMMIT');
      return { box1, box2, box3, box4, box5, box6, box7, box8, box9, status: 'calculated' };
    } catch (err) {
      await client.query('ROLLBACK');
      return { error: 'Failed to calculate VAT return' };
    } finally {
      client.release();
    }
  },
});

const queryCashPositionTool = tool({
  name: 'query_cash_position',
  description: 'Get current cash position showing business current account and client money account balances. All amounts in pence.',
  parameters: z4.object({}),
  execute: async (_context: AgentContext) => {
    const { getCashPosition } = await import('../../accountingQueries');
    return await getCashPosition();
  },
});

const queryAgedDebtorsTool = tool({
  name: 'query_aged_debtors',
  description: 'Get aged debtors report showing outstanding invoices grouped into 30/60/90/120+ day ageing buckets. All amounts in pence.',
  parameters: z4.object({
    asAt: z4.string().optional().describe('Optional as-at date in YYYY-MM-DD format. Defaults to today.'),
  }),
  execute: async (_context: AgentContext, input: { asAt?: string }) => {
    const { getAgedDebtors } = await import('../../accountingQueries');
    return await getAgedDebtors(input.asAt);
  },
});

const queryAgedCreditorsTool = tool({
  name: 'query_aged_creditors',
  description: 'Get aged creditors report showing outstanding purchase invoices grouped into 30/60/90/120+ day ageing buckets. All amounts in pence.',
  parameters: z4.object({
    asAt: z4.string().optional().describe('Optional as-at date in YYYY-MM-DD format. Defaults to today.'),
  }),
  execute: async (_context: AgentContext, input: { asAt?: string }) => {
    const { getAgedCreditors } = await import('../../accountingQueries');
    return await getAgedCreditors(input.asAt);
  },
});

const queryFinancialPeriodsTool = tool({
  name: 'query_financial_periods',
  description: 'List all financial periods with their open/closed/locked status.',
  parameters: z4.object({}),
  execute: async (_context: AgentContext) => {
    const { pool } = await import('../../db');
    const result = await pool.query('SELECT * FROM financial_periods ORDER BY start_date DESC');
    return result.rows;
  },
});

const closeFinancialPeriodTool = tool({
  name: 'close_financial_period',
  description: 'Close an open financial period. Only periods with status "open" can be closed.',
  parameters: z4.object({
    periodId: z4.number().describe('ID of the financial period to close'),
  }),
  execute: async (_context: AgentContext, input: { periodId: number }) => {
    const { pool } = await import('../../db');
    const result = await pool.query(
      `UPDATE financial_periods SET status = 'closed', closed_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'open' RETURNING *`,
      [input.periodId]
    );
    if (result.rows.length === 0) {
      return { error: 'Period not found or not in open status' };
    }
    return result.rows[0];
  },
});

const queryFinancialYearDatesTool = tool({
  name: 'query_financial_year_dates',
  description: 'Get financial year start and end dates. Offset: 0 = current FY, -1 = previous, +1 = next.',
  parameters: z4.object({
    offset: z4.number().optional().describe('Year offset from current FY. Defaults to 0 (current).'),
  }),
  execute: async (_context: AgentContext, input: { offset?: number }) => {
    const { getFinancialYearDates } = await import('../../accountingQueries');
    return await getFinancialYearDates(input.offset ?? 0);
  },
});

// ---- Agent ----

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
    queryFinancialPeriodsTool,
    closeFinancialPeriodTool,
    queryFinancialYearDatesTool,
    escalateToHumanTool,
  ],
});
