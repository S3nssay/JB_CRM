/**
 * Shared Accounting Queries
 *
 * Reusable query functions extracted from accountingRoutes.ts patterns.
 * Used by the Business Accounts Agent (Riley) and potentially other consumers.
 *
 * All amounts are in pence (integer). Callers must convert to GBP for display.
 */

export interface TrialBalanceRow {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: 'debit' | 'credit';
  opening_balance: number;
  total_debits: number;
  total_credits: number;
  balance: number;
}

export interface TrialBalanceResult {
  accounts: TrialBalanceRow[];
  totalDebitBalances: number;
  totalCreditBalances: number;
}

export interface ProfitAndLossResult {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  revenueAccounts: TrialBalanceRow[];
  expenseAccounts: TrialBalanceRow[];
}

export interface BalanceSheetResult {
  assets: TrialBalanceRow[];
  liabilities: TrialBalanceRow[];
  equity: TrialBalanceRow[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
}

export interface CashPositionResult {
  businessAccount: number;
  clientAccount: number;
  total: number;
}

export interface AgedBucket {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_name?: string;
  supplier_name?: string;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  days_overdue: number;
}

export interface AgedReport {
  current: AgedBucket[];
  days_1_30: AgedBucket[];
  days_31_60: AgedBucket[];
  days_61_90: AgedBucket[];
  over_90: AgedBucket[];
  total_outstanding: number;
}

export interface FinancialYearDates {
  startDate: string;
  endDate: string;
  year: number;
}

/**
 * Get trial balance as at a given date.
 * Replicates the pattern from accountingRoutes.ts GET /accounting/trial-balance.
 */
export async function getTrialBalance(asAt?: string): Promise<TrialBalanceResult> {
  const { pool } = await import('./db');
  const dateCondition = asAt ? `AND je.entry_date <= $1` : '';
  const params = asAt ? [asAt] : [];
  const result = await pool.query(
    `SELECT coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance, coa.opening_balance,
            COALESCE(SUM(jel.debit_amount), 0) as total_debits,
            COALESCE(SUM(jel.credit_amount), 0) as total_credits
     FROM chart_of_accounts coa
     LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
     LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'posted' ${dateCondition}
     WHERE coa.is_active = true
     GROUP BY coa.id
     ORDER BY coa.account_code`,
    params
  );

  let totalDebitBalances = 0;
  let totalCreditBalances = 0;
  const accounts: TrialBalanceRow[] = result.rows.map((row: any) => {
    const opening = row.opening_balance || 0;
    const debits = parseInt(row.total_debits) || 0;
    const credits = parseInt(row.total_credits) || 0;
    let balance: number;
    if (row.normal_balance === 'debit') {
      balance = opening + debits - credits;
    } else {
      balance = opening + credits - debits;
    }
    if (balance >= 0 && row.normal_balance === 'debit') {
      totalDebitBalances += balance;
    } else if (balance >= 0 && row.normal_balance === 'credit') {
      totalCreditBalances += balance;
    } else if (balance < 0 && row.normal_balance === 'debit') {
      totalCreditBalances += Math.abs(balance);
    } else {
      totalDebitBalances += Math.abs(balance);
    }
    return {
      id: row.id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      normal_balance: row.normal_balance,
      opening_balance: opening,
      total_debits: debits,
      total_credits: credits,
      balance,
    };
  });

  return { accounts, totalDebitBalances, totalCreditBalances };
}

/**
 * Get profit and loss statement for a date range.
 * Filters trial balance to revenue + expense account types.
 */
export async function getProfitAndLoss(startDate: string, endDate: string): Promise<ProfitAndLossResult> {
  const { pool } = await import('./db');
  const result = await pool.query(
    `SELECT coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance, coa.opening_balance,
            COALESCE(SUM(jel.debit_amount), 0) as total_debits,
            COALESCE(SUM(jel.credit_amount), 0) as total_credits
     FROM chart_of_accounts coa
     LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
     LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
       AND je.status = 'posted'
       AND je.entry_date >= $1 AND je.entry_date <= $2
     WHERE coa.is_active = true
       AND coa.account_type IN ('revenue', 'expense')
     GROUP BY coa.id
     ORDER BY coa.account_code`,
    [startDate, endDate]
  );

  let totalRevenue = 0;
  let totalExpenses = 0;
  const revenueAccounts: TrialBalanceRow[] = [];
  const expenseAccounts: TrialBalanceRow[] = [];

  for (const row of result.rows) {
    const debits = parseInt(row.total_debits) || 0;
    const credits = parseInt(row.total_credits) || 0;
    const account: TrialBalanceRow = {
      id: row.id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      normal_balance: row.normal_balance,
      opening_balance: row.opening_balance || 0,
      total_debits: debits,
      total_credits: credits,
      balance: 0,
    };

    if (row.account_type === 'revenue') {
      account.balance = credits - debits;
      totalRevenue += account.balance;
      revenueAccounts.push(account);
    } else {
      account.balance = debits - credits;
      totalExpenses += account.balance;
      expenseAccounts.push(account);
    }
  }

  return {
    totalRevenue,
    totalExpenses,
    netProfit: totalRevenue - totalExpenses,
    revenueAccounts,
    expenseAccounts,
  };
}

/**
 * Get balance sheet as at a given date.
 * Filters trial balance to asset + liability + equity account types.
 */
export async function getBalanceSheet(asAt: string): Promise<BalanceSheetResult> {
  const { pool } = await import('./db');
  const result = await pool.query(
    `SELECT coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance, coa.opening_balance,
            COALESCE(SUM(jel.debit_amount), 0) as total_debits,
            COALESCE(SUM(jel.credit_amount), 0) as total_credits
     FROM chart_of_accounts coa
     LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
     LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'posted' AND je.entry_date <= $1
     WHERE coa.is_active = true
       AND coa.account_type IN ('asset', 'liability', 'equity')
     GROUP BY coa.id
     ORDER BY coa.account_code`,
    [asAt]
  );

  const assets: TrialBalanceRow[] = [];
  const liabilities: TrialBalanceRow[] = [];
  const equity: TrialBalanceRow[] = [];
  let totalAssets = 0;
  let totalLiabilities = 0;
  let totalEquity = 0;

  for (const row of result.rows) {
    const opening = row.opening_balance || 0;
    const debits = parseInt(row.total_debits) || 0;
    const credits = parseInt(row.total_credits) || 0;
    let balance: number;
    if (row.normal_balance === 'debit') {
      balance = opening + debits - credits;
    } else {
      balance = opening + credits - debits;
    }
    const account: TrialBalanceRow = {
      id: row.id,
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
      normal_balance: row.normal_balance,
      opening_balance: opening,
      total_debits: debits,
      total_credits: credits,
      balance,
    };

    if (row.account_type === 'asset') {
      totalAssets += balance;
      assets.push(account);
    } else if (row.account_type === 'liability') {
      totalLiabilities += balance;
      liabilities.push(account);
    } else {
      totalEquity += balance;
      equity.push(account);
    }
  }

  return { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity };
}

/**
 * Get cash position from bank accounts.
 * Business current (1010) and client money (1020) accounts.
 */
export async function getCashPosition(): Promise<CashPositionResult> {
  const { pool } = await import('./db');

  const businessResult = await pool.query(`
    SELECT COALESCE(SUM(
      CASE WHEN coa.normal_balance = 'debit'
        THEN coa.opening_balance + jel.debit_amount - jel.credit_amount
        ELSE coa.opening_balance + jel.credit_amount - jel.debit_amount
      END
    ), 0) as total
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'posted'
    WHERE coa.is_active = true AND coa.account_code LIKE '1010%'
  `);

  const clientResult = await pool.query(`
    SELECT COALESCE(SUM(
      CASE WHEN coa.normal_balance = 'debit'
        THEN coa.opening_balance + jel.debit_amount - jel.credit_amount
        ELSE coa.opening_balance + jel.credit_amount - jel.debit_amount
      END
    ), 0) as total
    FROM chart_of_accounts coa
    LEFT JOIN journal_entry_lines jel ON jel.account_id = coa.id
    LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id AND je.status = 'posted'
    WHERE coa.is_active = true AND coa.account_code LIKE '1020%'
  `);

  const businessAccount = parseInt(businessResult.rows[0].total) || 0;
  const clientAccount = parseInt(clientResult.rows[0].total) || 0;

  return {
    businessAccount,
    clientAccount,
    total: businessAccount + clientAccount,
  };
}

/**
 * Get aged debtors report.
 * Replicates accountingRoutes.ts GET /accounting/reports/aged-debtors.
 */
export async function getAgedDebtors(asAt?: string): Promise<AgedReport> {
  const { pool } = await import('./db');
  const dateRef = asAt ? `'${asAt}'::date` : 'NOW()';
  const result = await pool.query(`
    SELECT
      id,
      invoice_number,
      invoice_date,
      due_date,
      customer_name,
      COALESCE(customer_type, 'other') as customer_type,
      total_amount,
      amount_paid,
      (total_amount - amount_paid) as outstanding,
      GREATEST(0, EXTRACT(DAY FROM ${dateRef} - due_date)::integer) as days_overdue
    FROM business_invoices
    WHERE status NOT IN ('draft', 'void', 'paid')
      AND total_amount > amount_paid
    ORDER BY due_date ASC
  `);

  return categoriseAgedBuckets(result.rows, 'customer_name');
}

/**
 * Get aged creditors report.
 * Replicates accountingRoutes.ts GET /accounting/reports/aged-creditors.
 */
export async function getAgedCreditors(asAt?: string): Promise<AgedReport> {
  const { pool } = await import('./db');
  const dateRef = asAt ? `'${asAt}'::date` : 'NOW()';
  const result = await pool.query(`
    SELECT
      id,
      invoice_number,
      invoice_date,
      due_date,
      supplier_name,
      COALESCE(supplier_type, 'other') as supplier_type,
      total_amount,
      amount_paid,
      (total_amount - amount_paid) as outstanding,
      GREATEST(0, EXTRACT(DAY FROM ${dateRef} - due_date)::integer) as days_overdue
    FROM purchase_invoices
    WHERE status NOT IN ('draft', 'void', 'paid')
      AND total_amount > amount_paid
    ORDER BY due_date ASC
  `);

  return categoriseAgedBuckets(result.rows, 'supplier_name');
}

/**
 * Shared helper to categorise aged report rows into buckets.
 */
function categoriseAgedBuckets(rows: any[], nameField: string): AgedReport {
  const current: AgedBucket[] = [];
  const days_1_30: AgedBucket[] = [];
  const days_31_60: AgedBucket[] = [];
  const days_61_90: AgedBucket[] = [];
  const over_90: AgedBucket[] = [];
  let total_outstanding = 0;

  for (const entry of rows) {
    total_outstanding += parseInt(entry.outstanding) || 0;
    const daysOverdue = parseInt(entry.days_overdue) || 0;

    const row: AgedBucket = {
      id: entry.id,
      invoice_number: entry.invoice_number,
      invoice_date: entry.invoice_date,
      due_date: entry.due_date,
      [nameField]: entry[nameField],
      total_amount: parseInt(entry.total_amount) || 0,
      amount_paid: parseInt(entry.amount_paid) || 0,
      outstanding: parseInt(entry.outstanding) || 0,
      days_overdue: daysOverdue,
    };

    if (daysOverdue <= 0) current.push(row);
    else if (daysOverdue <= 30) days_1_30.push(row);
    else if (daysOverdue <= 60) days_31_60.push(row);
    else if (daysOverdue <= 90) days_61_90.push(row);
    else over_90.push(row);
  }

  return { current, days_1_30, days_31_60, days_61_90, over_90, total_outstanding };
}

/**
 * Get financial year start/end dates.
 * Reads business_settings.financial_year_start (defaults to 4 = April).
 * Offset: 0 = current FY, -1 = previous FY, +1 = next FY.
 */
export async function getFinancialYearDates(offset: number = 0): Promise<FinancialYearDates> {
  const { pool } = await import('./db');
  const settingsResult = await pool.query('SELECT financial_year_start FROM business_settings LIMIT 1');
  const fyStartMonth = settingsResult.rows.length > 0 && settingsResult.rows[0].financial_year_start
    ? parseInt(settingsResult.rows[0].financial_year_start)
    : 4; // Default April

  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentYear = now.getFullYear();

  // Determine which FY we are in
  let fyStartYear = currentMonth >= fyStartMonth ? currentYear : currentYear - 1;
  fyStartYear += offset;

  const startDate = `${fyStartYear}-${String(fyStartMonth).padStart(2, '0')}-01`;
  const endMonth = fyStartMonth === 1 ? 12 : fyStartMonth - 1;
  const endYear = fyStartMonth === 1 ? fyStartYear : fyStartYear + 1;
  // Last day of the end month
  const lastDay = new Date(endYear, endMonth, 0).getDate();
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  return { startDate, endDate, year: fyStartYear };
}
