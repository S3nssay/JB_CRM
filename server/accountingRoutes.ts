import { Router } from 'express';
import { pool } from './db';
import { accountingRecordBusinessInvoiceSent, accountingRecordBusinessInvoicePayment, accountingRecordPurchaseInvoice } from './accountingIntegration';

export const accountingRouter = Router();

// Middleware
const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Not authorized' });
  next();
};

// Helper for dynamic UPDATE queries
function buildUpdateQuery(table: string, fields: Record<string, any>, idValue: any): { sql: string; values: any[] } {
  const setClauses: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;
  for (const [key, value] of Object.entries(fields)) {
    setClauses.push(`"${key}" = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  }
  setClauses.push(`"updated_at" = NOW()`);
  values.push(idValue);
  const sql = `UPDATE ${table} SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
  return { sql, values };
}

// ==========================================
// BUSINESS SETTINGS
// ==========================================

accountingRouter.get('/accounting/business-settings', requireAgent, async (req: any, res) => {
  try {
    const result = await pool.query('SELECT * FROM business_settings LIMIT 1');
    if (result.rows.length === 0) {
      const insert = await pool.query('INSERT INTO business_settings DEFAULT VALUES RETURNING *');
      return res.json(insert.rows[0]);
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching business settings:', error);
    res.status(500).json({ error: 'Failed to fetch business settings' });
  }
});

accountingRouter.put('/accounting/business-settings', requireAgent, async (req: any, res) => {
  try {
    const fields = req.body;
    const existing = await pool.query('SELECT id FROM business_settings LIMIT 1');
    if (existing.rows.length === 0) {
      const cols = Object.keys(fields);
      const vals = Object.values(fields);
      const placeholders = vals.map((_: any, i: number) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `INSERT INTO business_settings (${cols.map((c: string) => `"${c}"`).join(", ")}) VALUES (${placeholders}) RETURNING *`,
        vals
      );
      return res.json(result.rows[0]);
    }
    const id = existing.rows[0].id;
    const { sql, values } = buildUpdateQuery('business_settings', fields, id);
    const result = await pool.query(sql, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating business settings:', error);
    res.status(500).json({ error: 'Failed to update business settings' });
  }
});

// ==========================================
// CHART OF ACCOUNTS
// ==========================================

accountingRouter.get('/accounting/chart-of-accounts', requireAgent, async (req: any, res) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (req.query.type) {
      conditions.push(`account_type = $${paramIndex++}`);
      params.push(req.query.type);
    }
    if (req.query.active !== undefined) {
      conditions.push(`is_active = $${paramIndex++}`);
      params.push(req.query.active === 'true');
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM chart_of_accounts ${where} ORDER BY sort_order, account_code`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching chart of accounts:', error);
    res.status(500).json({ error: 'Failed to fetch chart of accounts' });
  }
});

accountingRouter.get('/accounting/chart-of-accounts/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM chart_of_accounts WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching account:', error);
    res.status(500).json({ error: 'Failed to fetch account' });
  }
});

accountingRouter.post('/accounting/chart-of-accounts', requireAgent, async (req: any, res) => {
  try {
    const { account_code, account_name, account_type, parent_account_id, is_system_account, description, normal_balance, default_tax_rate_id, opening_balance, sort_order } = req.body;
    const result = await pool.query(
      `INSERT INTO chart_of_accounts (account_code, account_name, account_type, parent_account_id, is_system_account, description, normal_balance, default_tax_rate_id, opening_balance, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [account_code, account_name, account_type, parent_account_id || null, is_system_account || false, description || null, normal_balance || null, default_tax_rate_id || null, opening_balance || 0, sort_order || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating account:', error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

accountingRouter.put('/accounting/chart-of-accounts/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { sql, values } = buildUpdateQuery('chart_of_accounts', req.body, id);
    const result = await pool.query(sql, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating account:', error);
    res.status(500).json({ error: 'Failed to update account' });
  }
});

accountingRouter.delete('/accounting/chart-of-accounts/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE chart_of_accounts SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deactivating account:', error);
    res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

accountingRouter.post('/accounting/chart-of-accounts/seed', requireAgent, async (req: any, res) => {
  try {
    const defaults = [
      { code: '1000', name: 'Cash at Bank', type: 'asset', normal: 'debit', sort: 100, system: true },
      { code: '1001', name: 'Petty Cash', type: 'asset', normal: 'debit', sort: 101, system: true },
      { code: '1100', name: 'Accounts Receivable', type: 'asset', normal: 'debit', sort: 110, system: true },
      { code: '1200', name: 'Prepayments', type: 'asset', normal: 'debit', sort: 120, system: false },
      { code: '1300', name: 'Client Money Account', type: 'asset', normal: 'debit', sort: 130, system: true },
      { code: '1500', name: 'Fixed Assets', type: 'asset', normal: 'debit', sort: 150, system: false },
      { code: '1510', name: 'Accumulated Depreciation', type: 'asset', normal: 'credit', sort: 151, system: false },
      { code: '2000', name: 'Accounts Payable', type: 'liability', normal: 'credit', sort: 200, system: true },
      { code: '2100', name: 'VAT Payable', type: 'liability', normal: 'credit', sort: 210, system: true },
      { code: '2110', name: 'VAT Receivable', type: 'asset', normal: 'debit', sort: 211, system: true },
      { code: '2200', name: 'PAYE/NI Payable', type: 'liability', normal: 'credit', sort: 220, system: false },
      { code: '2300', name: 'Corporation Tax Payable', type: 'liability', normal: 'credit', sort: 230, system: false },
      { code: '2400', name: 'Client Deposits Held', type: 'liability', normal: 'credit', sort: 240, system: true },
      { code: '2500', name: 'Landlord Funds Held', type: 'liability', normal: 'credit', sort: 250, system: true },
      { code: '3000', name: 'Share Capital', type: 'equity', normal: 'credit', sort: 300, system: true },
      { code: '3100', name: 'Retained Earnings', type: 'equity', normal: 'credit', sort: 310, system: true },
      { code: '3200', name: 'Dividends', type: 'equity', normal: 'debit', sort: 320, system: false },
      { code: '4000', name: 'Management Fee Income', type: 'revenue', normal: 'credit', sort: 400, system: false },
      { code: '4010', name: 'Letting Fee Income', type: 'revenue', normal: 'credit', sort: 401, system: false },
      { code: '4020', name: 'Sales Commission Income', type: 'revenue', normal: 'credit', sort: 402, system: false },
      { code: '4030', name: 'Renewal Fee Income', type: 'revenue', normal: 'credit', sort: 403, system: false },
      { code: '4040', name: 'Inventory Fee Income', type: 'revenue', normal: 'credit', sort: 404, system: false },
      { code: '4050', name: 'Administration Fee Income', type: 'revenue', normal: 'credit', sort: 405, system: false },
      { code: '4100', name: 'Other Income', type: 'revenue', normal: 'credit', sort: 410, system: false },
      { code: '5000', name: 'Staff Costs', type: 'expense', normal: 'debit', sort: 500, system: false },
      { code: '5010', name: 'Employer NI', type: 'expense', normal: 'debit', sort: 501, system: false },
      { code: '5020', name: 'Pension Contributions', type: 'expense', normal: 'debit', sort: 502, system: false },
      { code: '6000', name: 'Office Rent', type: 'expense', normal: 'debit', sort: 600, system: false },
      { code: '6010', name: 'Office Utilities', type: 'expense', normal: 'debit', sort: 601, system: false },
      { code: '6020', name: 'Office Insurance', type: 'expense', normal: 'debit', sort: 602, system: false },
      { code: '6100', name: 'Marketing & Advertising', type: 'expense', normal: 'debit', sort: 610, system: false },
      { code: '6110', name: 'Portal Listings', type: 'expense', normal: 'debit', sort: 611, system: false },
      { code: '6200', name: 'Software & Subscriptions', type: 'expense', normal: 'debit', sort: 620, system: false },
      { code: '6300', name: 'Professional Fees', type: 'expense', normal: 'debit', sort: 630, system: false },
      { code: '6400', name: 'Travel & Motor', type: 'expense', normal: 'debit', sort: 640, system: false },
      { code: '6500', name: 'Telephone & Internet', type: 'expense', normal: 'debit', sort: 650, system: false },
      { code: '6600', name: 'Depreciation', type: 'expense', normal: 'debit', sort: 660, system: false },
      { code: '6700', name: 'Bank Charges', type: 'expense', normal: 'debit', sort: 670, system: false },
      { code: '6800', name: 'Sundry Expenses', type: 'expense', normal: 'debit', sort: 680, system: false },
      { code: '6900', name: 'Contractor Costs', type: 'expense', normal: 'debit', sort: 690, system: false },
    ];
    let seeded = 0;
    for (const acc of defaults) {
      const exists = await pool.query('SELECT id FROM chart_of_accounts WHERE account_code = $1', [acc.code]);
      if (exists.rows.length === 0) {
        await pool.query(
          `INSERT INTO chart_of_accounts (account_code, account_name, account_type, normal_balance, sort_order, is_system_account)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [acc.code, acc.name, acc.type, acc.normal, acc.sort, acc.system]
        );
        seeded++;
      }
    }
    res.json({ message: `Seeded ${seeded} accounts (${defaults.length - seeded} already existed)` });
  } catch (error) {
    console.error('Error seeding accounts:', error);
    res.status(500).json({ error: 'Failed to seed accounts' });
  }
});

accountingRouter.get('/accounting/chart-of-accounts/:id/balance', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const account = await pool.query('SELECT * FROM chart_of_accounts WHERE id = $1', [id]);
    if (account.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    const result = await pool.query(
      `SELECT COALESCE(SUM(jel.debit_amount), 0) as total_debits,
              COALESCE(SUM(jel.credit_amount), 0) as total_credits
       FROM journal_entry_lines jel
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       WHERE jel.account_id = $1 AND je.status = 'posted'`,
      [id]
    );
    const { total_debits, total_credits } = result.rows[0];
    const openingBalance = account.rows[0].opening_balance || 0;
    const normalBalance = account.rows[0].normal_balance;
    let balance: number;
    if (normalBalance === 'debit') {
      balance = openingBalance + parseInt(total_debits) - parseInt(total_credits);
    } else {
      balance = openingBalance + parseInt(total_credits) - parseInt(total_debits);
    }
    res.json({ account_id: parseInt(id), opening_balance: openingBalance, total_debits: parseInt(total_debits), total_credits: parseInt(total_credits), balance });
  } catch (error) {
    console.error('Error fetching account balance:', error);
    res.status(500).json({ error: 'Failed to fetch account balance' });
  }
});

// ==========================================
// TAX RATES
// ==========================================

accountingRouter.get('/accounting/tax-rates', requireAgent, async (req: any, res) => {
  try {
    const result = await pool.query('SELECT * FROM tax_rates ORDER BY name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tax rates:', error);
    res.status(500).json({ error: 'Failed to fetch tax rates' });
  }
});

accountingRouter.post('/accounting/tax-rates', requireAgent, async (req: any, res) => {
  try {
    const { name, rate, tax_type, is_default, description, effective_from, effective_to } = req.body;
    const result = await pool.query(
      `INSERT INTO tax_rates (name, rate, tax_type, is_default, description, effective_from, effective_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [name, rate, tax_type || null, is_default || false, description || null, effective_from || null, effective_to || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tax rate:', error);
    res.status(500).json({ error: 'Failed to create tax rate' });
  }
});

accountingRouter.put('/accounting/tax-rates/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { sql, values } = buildUpdateQuery('tax_rates', req.body, id);
    const result = await pool.query(sql, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tax rate not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tax rate:', error);
    res.status(500).json({ error: 'Failed to update tax rate' });
  }
});

accountingRouter.delete('/accounting/tax-rates/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE tax_rates SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tax rate not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deactivating tax rate:', error);
    res.status(500).json({ error: 'Failed to deactivate tax rate' });
  }
});
// ==========================================
// FINANCIAL PERIODS
// ==========================================

accountingRouter.get('/accounting/financial-periods', requireAgent, async (req: any, res) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (req.query.year) {
      conditions.push(`financial_year = $${paramIndex++}`);
      params.push(parseInt(req.query.year));
    }
    if (req.query.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM financial_periods ${where} ORDER BY start_date`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching financial periods:', error);
    res.status(500).json({ error: 'Failed to fetch financial periods' });
  }
});

accountingRouter.post('/accounting/financial-periods', requireAgent, async (req: any, res) => {
  try {
    const { name, start_date, end_date, period_type, financial_year } = req.body;
    const result = await pool.query(
      `INSERT INTO financial_periods (name, start_date, end_date, period_type, financial_year)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, start_date, end_date, period_type || 'monthly', financial_year || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating financial period:', error);
    res.status(500).json({ error: 'Failed to create financial period' });
  }
});

accountingRouter.put('/accounting/financial-periods/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { sql, values } = buildUpdateQuery('financial_periods', req.body, id);
    const result = await pool.query(sql, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Financial period not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating financial period:', error);
    res.status(500).json({ error: 'Failed to update financial period' });
  }
});

accountingRouter.post('/accounting/financial-periods/:id/close', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE financial_periods SET status = 'closed', closed_at = NOW(), closed_by_id = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'open' RETURNING *`,
      [id, req.user?.id || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Period not found or already closed' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error closing financial period:', error);
    res.status(500).json({ error: 'Failed to close financial period' });
  }
});

accountingRouter.post('/accounting/financial-periods/auto-generate', requireAgent, async (req: any, res) => {
  try {
    const { year, start_month } = req.body;
    const startMonth = start_month || 4;
    const periods: any[] = [];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    for (let i = 0; i < 12; i++) {
      const month = ((startMonth - 1 + i) % 12) + 1;
      const yr = month >= startMonth ? year : year + 1;
      const startDate = new Date(yr, month - 1, 1);
      const endDate = new Date(yr, month, 0);
      const name = `${monthNames[month - 1]} ${yr}`;
      const result = await pool.query(
        `INSERT INTO financial_periods (name, start_date, end_date, period_type, financial_year, status)
         VALUES ($1, $2, $3, 'monthly', $4, 'open')
         ON CONFLICT DO NOTHING RETURNING *`,
        [name, startDate.toISOString(), endDate.toISOString(), year]
      );
      if (result.rows.length > 0) periods.push(result.rows[0]);
    }
    res.status(201).json({ message: `Generated ${periods.length} periods for FY ${year}/${year + 1}`, periods });
  } catch (error) {
    console.error('Error auto-generating periods:', error);
    res.status(500).json({ error: 'Failed to auto-generate financial periods' });
  }
});

// ==========================================
// JOURNAL ENTRIES
// ==========================================

accountingRouter.get('/accounting/journal-entries', requireAgent, async (req: any, res) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (req.query.status) {
      conditions.push(`je.status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    if (req.query.accountId) {
      conditions.push(`je.id IN (SELECT journal_entry_id FROM journal_entry_lines WHERE account_id = $${paramIndex++})`);
      params.push(parseInt(req.query.accountId));
    }
    if (req.query.from) {
      conditions.push(`je.entry_date >= $${paramIndex++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conditions.push(`je.entry_date <= $${paramIndex++}`);
      params.push(req.query.to);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT je.*,
              COALESCE(json_agg(json_build_object(
                'id', jel.id, 'account_id', jel.account_id, 'description', jel.description,
                'debit_amount', jel.debit_amount, 'credit_amount', jel.credit_amount,
                'tax_rate_id', jel.tax_rate_id, 'tax_amount', jel.tax_amount
              )) FILTER (WHERE jel.id IS NOT NULL), '[]') as lines
       FROM journal_entries je
       LEFT JOIN journal_entry_lines jel ON je.id = jel.journal_entry_id
       ${where}
       GROUP BY je.id
       ORDER BY je.entry_date DESC, je.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

accountingRouter.get('/accounting/journal-entries/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const entry = await pool.query('SELECT * FROM journal_entries WHERE id = $1', [id]);
    if (entry.rows.length === 0) return res.status(404).json({ error: 'Journal entry not found' });
    const lines = await pool.query(
      `SELECT jel.*, coa.account_code, coa.account_name
       FROM journal_entry_lines jel
       LEFT JOIN chart_of_accounts coa ON jel.account_id = coa.id
       WHERE jel.journal_entry_id = $1
       ORDER BY jel.id`,
      [id]
    );
    res.json({ ...entry.rows[0], lines: lines.rows });
  } catch (error) {
    console.error('Error fetching journal entry:', error);
    res.status(500).json({ error: 'Failed to fetch journal entry' });
  }
});

accountingRouter.post('/accounting/journal-entries', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { entry, lines } = req.body;
    const totalDebits = lines.reduce((sum: number, l: any) => sum + (l.debit_amount || 0), 0);
    const totalCredits = lines.reduce((sum: number, l: any) => sum + (l.credit_amount || 0), 0);
    if (totalDebits !== totalCredits) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Debits (${totalDebits}) must equal credits (${totalCredits})` });
    }
    const settings = await client.query('SELECT journal_entry_prefix, journal_entry_next_number FROM business_settings LIMIT 1');
    let prefix = 'JE';
    let nextNum = 1;
    if (settings.rows.length > 0) {
      prefix = settings.rows[0].journal_entry_prefix || 'JE';
      nextNum = settings.rows[0].journal_entry_next_number || 1;
    }
    const entryNumber = entry.entry_number || `${prefix}-${String(nextNum).padStart(5, '0')}`;
    const entryResult = await client.query(
      `INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id, financial_period_id, status, notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [entryNumber, entry.entry_date, entry.description, entry.source_type || 'manual', entry.source_id || null, entry.financial_period_id || null, entry.status || 'draft', entry.notes || null, req.user?.id || null]
    );
    const journalEntryId = entryResult.rows[0].id;
    const insertedLines: any[] = [];
    for (const line of lines) {
      const lineResult = await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, tax_rate_id, tax_amount, property_id, landlord_id, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [journalEntryId, line.account_id, line.description || null, line.debit_amount || 0, line.credit_amount || 0, line.tax_rate_id || null, line.tax_amount || 0, line.property_id || null, line.landlord_id || null, line.tenant_id || null]
      );
      insertedLines.push(lineResult.rows[0]);
    }
    if (settings.rows.length > 0) {
      await client.query('UPDATE business_settings SET journal_entry_next_number = journal_entry_next_number + 1');
    }
    await client.query('COMMIT');
    res.status(201).json({ ...entryResult.rows[0], lines: insertedLines });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: 'Failed to create journal entry' });
  } finally {
    client.release();
  }
});

accountingRouter.post('/accounting/journal-entries/:id/post', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE journal_entries SET status = 'posted', posted_at = NOW(), posted_by_id = $2, updated_at = NOW()
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [id, req.user?.id || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Entry not found or not in draft status' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error posting journal entry:', error);
    res.status(500).json({ error: 'Failed to post journal entry' });
  }
});

accountingRouter.post('/accounting/journal-entries/:id/reverse', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const original = await client.query("SELECT * FROM journal_entries WHERE id = $1 AND status = 'posted'", [id]);
    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Posted entry not found' });
    }
    const originalLines = await client.query('SELECT * FROM journal_entry_lines WHERE journal_entry_id = $1', [id]);
    const settings = await client.query('SELECT journal_entry_prefix, journal_entry_next_number FROM business_settings LIMIT 1');
    let prefix = 'JE';
    let nextNum = 1;
    if (settings.rows.length > 0) {
      prefix = settings.rows[0].journal_entry_prefix || 'JE';
      nextNum = settings.rows[0].journal_entry_next_number || 1;
    }
    const entryNumber = `${prefix}-${String(nextNum).padStart(5, '0')}`;
    const reversal = await client.query(
      `INSERT INTO journal_entries (entry_number, entry_date, description, source_type, source_id, financial_period_id, status, posted_at, posted_by_id, reversed_entry_id, notes, created_by_id)
       VALUES ($1, NOW(), $2, 'manual', NULL, $3, 'posted', NOW(), $4, $5, $6, $4) RETURNING *`,
      [entryNumber, `Reversal of ${original.rows[0].entry_number}: ${original.rows[0].description}`, original.rows[0].financial_period_id, req.user?.id || null, id, `Auto-reversal of entry ${original.rows[0].entry_number}`]
    );
    for (const line of originalLines.rows) {
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, tax_rate_id, tax_amount, property_id, landlord_id, tenant_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [reversal.rows[0].id, line.account_id, line.description, line.credit_amount, line.debit_amount, line.tax_rate_id, line.tax_amount, line.property_id, line.landlord_id, line.tenant_id]
      );
    }
    await client.query(
      `UPDATE journal_entries SET status = 'reversed', reversed_entry_id = $2, updated_at = NOW() WHERE id = $1`,
      [id, reversal.rows[0].id]
    );
    if (settings.rows.length > 0) {
      await client.query('UPDATE business_settings SET journal_entry_next_number = journal_entry_next_number + 1');
    }
    await client.query('COMMIT');
    res.status(201).json(reversal.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reversing journal entry:', error);
    res.status(500).json({ error: 'Failed to reverse journal entry' });
  } finally {
    client.release();
  }
});

// ==========================================
// GENERAL LEDGER & TRIAL BALANCE
// ==========================================

accountingRouter.get('/accounting/general-ledger/:accountId', requireAgent, async (req: any, res) => {
  try {
    const { accountId } = req.params;
    const account = await pool.query('SELECT * FROM chart_of_accounts WHERE id = $1', [accountId]);
    if (account.rows.length === 0) return res.status(404).json({ error: 'Account not found' });
    const conditions: string[] = ['jel.account_id = $1', "je.status = 'posted'"];
    const params: any[] = [accountId];
    let paramIndex = 2;
    if (req.query.from) {
      conditions.push(`je.entry_date >= $${paramIndex++}`);
      params.push(req.query.from);
    }
    if (req.query.to) {
      conditions.push(`je.entry_date <= $${paramIndex++}`);
      params.push(req.query.to);
    }
    const result = await pool.query(
      `SELECT jel.*, je.entry_number, je.entry_date, je.description as entry_description, je.source_type
       FROM journal_entry_lines jel
       JOIN journal_entries je ON jel.journal_entry_id = je.id
       WHERE ${conditions.join(' AND ')}
       ORDER BY je.entry_date, je.id, jel.id`,
      params
    );
    const openingBalance = account.rows[0].opening_balance || 0;
    const normalBalance = account.rows[0].normal_balance;
    let runningBalance = openingBalance;
    const ledgerLines = result.rows.map((row: any) => {
      if (normalBalance === 'debit') {
        runningBalance += (row.debit_amount || 0) - (row.credit_amount || 0);
      } else {
        runningBalance += (row.credit_amount || 0) - (row.debit_amount || 0);
      }
      return { ...row, running_balance: runningBalance };
    });
    res.json({ account: account.rows[0], opening_balance: openingBalance, entries: ledgerLines, closing_balance: runningBalance });
  } catch (error) {
    console.error('Error fetching general ledger:', error);
    res.status(500).json({ error: 'Failed to fetch general ledger' });
  }
});

accountingRouter.get('/accounting/trial-balance', requireAgent, async (req: any, res) => {
  try {
    const dateCondition = req.query.asAt ? `AND je.entry_date <= $1` : '';
    const params = req.query.asAt ? [req.query.asAt] : [];
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
    const accounts = result.rows.map((row: any) => {
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
      return { ...row, total_debits: debits, total_credits: credits, balance };
    });
    res.json({ accounts, total_debit_balances: totalDebitBalances, total_credit_balances: totalCreditBalances });
  } catch (error) {
    console.error('Error fetching trial balance:', error);
    res.status(500).json({ error: 'Failed to fetch trial balance' });
  }
});
// ==========================================
// BUSINESS INVOICES (SALES)
// ==========================================

accountingRouter.get('/accounting/business-invoices', requireAgent, async (req: any, res) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (req.query.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    if (req.query.customerType) {
      conditions.push(`customer_type = $${paramIndex++}`);
      params.push(req.query.customerType);
    }
    if (req.query.customerId) {
      conditions.push(`customer_id = $${paramIndex++}`);
      params.push(parseInt(req.query.customerId));
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM business_invoices ${where} ORDER BY invoice_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching business invoices:', error);
    res.status(500).json({ error: 'Failed to fetch business invoices' });
  }
});

accountingRouter.get('/accounting/business-invoices/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const invoice = await pool.query('SELECT * FROM business_invoices WHERE id = $1', [id]);
    if (invoice.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    const lines = await pool.query(
      `SELECT bil.*, coa.account_code, coa.account_name, tr.name as tax_rate_name, tr.rate as tax_rate_value
       FROM business_invoice_lines bil
       LEFT JOIN chart_of_accounts coa ON bil.account_id = coa.id
       LEFT JOIN tax_rates tr ON bil.tax_rate_id = tr.id
       WHERE bil.business_invoice_id = $1
       ORDER BY bil.sort_order, bil.id`,
      [id]
    );
    res.json({ ...invoice.rows[0], lines: lines.rows });
  } catch (error) {
    console.error('Error fetching business invoice:', error);
    res.status(500).json({ error: 'Failed to fetch business invoice' });
  }
});

accountingRouter.post('/accounting/business-invoices', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { invoice, lines } = req.body;
    const settings = await client.query('SELECT sales_invoice_prefix, sales_invoice_next_number FROM business_settings LIMIT 1');
    let prefix = 'JBINV';
    let nextNum = 1;
    if (settings.rows.length > 0) {
      prefix = settings.rows[0].sales_invoice_prefix || 'JBINV';
      nextNum = settings.rows[0].sales_invoice_next_number || 1;
    }
    const invoiceNumber = invoice.invoice_number || `${prefix}-${String(nextNum).padStart(5, '0')}`;
    const subtotal = lines.reduce((sum: number, l: any) => sum + (l.line_total || 0), 0);
    const vatAmount = lines.reduce((sum: number, l: any) => sum + (l.tax_amount || 0), 0);
    const totalAmount = subtotal + vatAmount;
    const invoiceResult = await client.query(
      `INSERT INTO business_invoices (invoice_number, invoice_date, due_date, customer_type, customer_id, customer_name, customer_email, customer_address, customer_vat_number, subtotal, vat_amount, total_amount, status, property_id, notes, internal_notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING *`,
      [invoiceNumber, invoice.invoice_date, invoice.due_date, invoice.customer_type || null, invoice.customer_id || null, invoice.customer_name, invoice.customer_email || null, invoice.customer_address || null, invoice.customer_vat_number || null, subtotal, vatAmount, totalAmount, invoice.status || 'draft', invoice.property_id || null, invoice.notes || null, invoice.internal_notes || null, req.user?.id || null]
    );
    const invoiceId = invoiceResult.rows[0].id;
    const insertedLines: any[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineResult = await client.query(
        `INSERT INTO business_invoice_lines (business_invoice_id, description, quantity, unit_price, line_total, tax_rate_id, tax_amount, account_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [invoiceId, line.description, line.quantity || 1, line.unit_price, line.line_total, line.tax_rate_id || null, line.tax_amount || 0, line.account_id || null, line.sort_order || i]
      );
      insertedLines.push(lineResult.rows[0]);
    }
    if (settings.rows.length > 0) {
      await client.query('UPDATE business_settings SET sales_invoice_next_number = sales_invoice_next_number + 1');
    }
    await client.query('COMMIT');
    res.status(201).json({ ...invoiceResult.rows[0], lines: insertedLines });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating business invoice:', error);
    res.status(500).json({ error: 'Failed to create business invoice' });
  } finally {
    client.release();
  }
});

accountingRouter.put('/accounting/business-invoices/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT status FROM business_invoices WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });
    if (check.rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be edited' });
    const { sql, values } = buildUpdateQuery('business_invoices', req.body, id);
    const result = await pool.query(sql, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating business invoice:', error);
    res.status(500).json({ error: 'Failed to update business invoice' });
  }
});

accountingRouter.post('/accounting/business-invoices/:id/send', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE business_invoices SET status = 'sent', sent_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status = 'draft' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Draft invoice not found' });
    const inv = result.rows[0];

    // Accounting integration: create AR journal entry when invoice is sent
    try {
      await accountingRecordBusinessInvoiceSent(
        inv.subtotal || 0,
        inv.vat_amount || 0,
        inv.customer_name || `Customer #${inv.customer_id}`,
        inv.invoice_number,
        undefined, // auto-detect revenue account
        inv.id
      );
    } catch (e) {
      console.error('[Accounting] Error recording business invoice sent journal entry:', e);
    }

    res.json(inv);
  } catch (error) {
    console.error('Error sending business invoice:', error);
    res.status(500).json({ error: 'Failed to send business invoice' });
  }
});

accountingRouter.post('/accounting/business-invoices/:id/void', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE business_invoices SET status = 'void', voided_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status NOT IN ('void', 'paid') RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found or cannot be voided' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error voiding business invoice:', error);
    res.status(500).json({ error: 'Failed to void business invoice' });
  }
});

accountingRouter.post('/accounting/business-invoices/:id/record-payment', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { amount, payment_method, payment_reference, payment_date } = req.body;
    const invoice = await client.query('SELECT * FROM business_invoices WHERE id = $1', [id]);
    if (invoice.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const inv = invoice.rows[0];
    const newAmountPaid = (inv.amount_paid || 0) + amount;
    const newStatus = newAmountPaid >= inv.total_amount ? 'paid' : 'partially_paid';
    await client.query(
      `UPDATE business_invoices SET amount_paid = $2, status = $3, paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $1`,
      [id, newAmountPaid, newStatus]
    );
    const allocation = await client.query(
      `INSERT INTO payment_allocations (payment_date, amount, payment_method, payment_reference, allocation_type, allocation_id, notes, created_by_id)
       VALUES ($1, $2, $3, $4, 'sales_invoice', $5, $6, $7) RETURNING *`,
      [payment_date || new Date().toISOString(), amount, payment_method || null, payment_reference || null, id, req.body.notes || null, req.user?.id || null]
    );
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM business_invoices WHERE id = $1', [id]);
    const updatedInv = updated.rows[0];

    // Accounting integration: record payment received journal entry
    try {
      await accountingRecordBusinessInvoicePayment(
        amount,
        updatedInv.invoice_number,
        updatedInv.customer_name || `Customer #${updatedInv.customer_id}`,
        updatedInv.id
      );
    } catch (e) {
      console.error('[Accounting] Error recording business invoice payment journal entry:', e);
    }

    res.json({ invoice: updatedInv, payment: allocation.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});

// ==========================================
// PURCHASE INVOICES
// ==========================================

accountingRouter.get('/accounting/purchase-invoices', requireAgent, async (req: any, res) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (req.query.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    if (req.query.supplierType) {
      conditions.push(`supplier_type = $${paramIndex++}`);
      params.push(req.query.supplierType);
    }
    if (req.query.supplierId) {
      conditions.push(`supplier_id = $${paramIndex++}`);
      params.push(parseInt(req.query.supplierId));
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM purchase_invoices ${where} ORDER BY invoice_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching purchase invoices:', error);
    res.status(500).json({ error: 'Failed to fetch purchase invoices' });
  }
});

accountingRouter.get('/accounting/purchase-invoices/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const invoice = await pool.query('SELECT * FROM purchase_invoices WHERE id = $1', [id]);
    if (invoice.rows.length === 0) return res.status(404).json({ error: 'Purchase invoice not found' });
    const lines = await pool.query(
      `SELECT pil.*, coa.account_code, coa.account_name, tr.name as tax_rate_name, tr.rate as tax_rate_value
       FROM purchase_invoice_lines pil
       LEFT JOIN chart_of_accounts coa ON pil.account_id = coa.id
       LEFT JOIN tax_rates tr ON pil.tax_rate_id = tr.id
       WHERE pil.purchase_invoice_id = $1
       ORDER BY pil.sort_order, pil.id`,
      [id]
    );
    res.json({ ...invoice.rows[0], lines: lines.rows });
  } catch (error) {
    console.error('Error fetching purchase invoice:', error);
    res.status(500).json({ error: 'Failed to fetch purchase invoice' });
  }
});

accountingRouter.post('/accounting/purchase-invoices', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { invoice, lines } = req.body;
    const settings = await client.query('SELECT purchase_invoice_prefix, purchase_invoice_next_number FROM business_settings LIMIT 1');
    let prefix = 'JBPI';
    let nextNum = 1;
    if (settings.rows.length > 0) {
      prefix = settings.rows[0].purchase_invoice_prefix || 'JBPI';
      nextNum = settings.rows[0].purchase_invoice_next_number || 1;
    }
    const invoiceNumber = invoice.invoice_number || `${prefix}-${String(nextNum).padStart(5, '0')}`;
    const subtotal = lines.reduce((sum: number, l: any) => sum + (l.line_total || 0), 0);
    const vatAmount = lines.reduce((sum: number, l: any) => sum + (l.tax_amount || 0), 0);
    const totalAmount = subtotal + vatAmount;
    const invoiceResult = await client.query(
      `INSERT INTO purchase_invoices (invoice_number, supplier_type, supplier_id, supplier_name, supplier_email, supplier_address, supplier_vat_number, invoice_date, due_date, subtotal, vat_amount, total_amount, status, property_id, landlord_id, is_rechargeable, notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18) RETURNING *`,
      [invoiceNumber, invoice.supplier_type || null, invoice.supplier_id || null, invoice.supplier_name, invoice.supplier_email || null, invoice.supplier_address || null, invoice.supplier_vat_number || null, invoice.invoice_date, invoice.due_date, subtotal, vatAmount, totalAmount, invoice.status || 'draft', invoice.property_id || null, invoice.landlord_id || null, invoice.is_rechargeable || false, invoice.notes || null, req.user?.id || null]
    );
    const invoiceId = invoiceResult.rows[0].id;
    const insertedLines: any[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineResult = await client.query(
        `INSERT INTO purchase_invoice_lines (purchase_invoice_id, description, quantity, unit_price, line_total, tax_rate_id, tax_amount, account_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
        [invoiceId, line.description, line.quantity || 1, line.unit_price, line.line_total, line.tax_rate_id || null, line.tax_amount || 0, line.account_id || null, line.sort_order || i]
      );
      insertedLines.push(lineResult.rows[0]);
    }
    if (settings.rows.length > 0) {
      await client.query('UPDATE business_settings SET purchase_invoice_next_number = purchase_invoice_next_number + 1');
    }
    await client.query('COMMIT');
    res.status(201).json({ ...invoiceResult.rows[0], lines: insertedLines });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating purchase invoice:', error);
    res.status(500).json({ error: 'Failed to create purchase invoice' });
  } finally {
    client.release();
  }
});

accountingRouter.put('/accounting/purchase-invoices/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const check = await pool.query('SELECT status FROM purchase_invoices WHERE id = $1', [id]);
    if (check.rows.length === 0) return res.status(404).json({ error: 'Purchase invoice not found' });
    if (check.rows[0].status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be edited' });
    const { sql, values } = buildUpdateQuery('purchase_invoices', req.body, id);
    const result = await pool.query(sql, values);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating purchase invoice:', error);
    res.status(500).json({ error: 'Failed to update purchase invoice' });
  }
});

accountingRouter.post('/accounting/purchase-invoices/:id/approve', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE purchase_invoices SET status = 'approved', approved_by_id = $2, approved_at = NOW(), updated_at = NOW()
       WHERE id = $1 AND status IN ('draft', 'awaiting_approval') RETURNING *`,
      [id, req.user?.id || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invoice not found or already approved' });
    const inv = result.rows[0];

    // Accounting integration: create AP journal entry when purchase invoice is approved
    try {
      await accountingRecordPurchaseInvoice(
        inv.subtotal || 0,
        inv.vat_amount || 0,
        inv.supplier_name || `Supplier #${inv.supplier_id}`,
        inv.invoice_number,
        undefined, // auto-detect expense account
        inv.id
      );
    } catch (e) {
      console.error('[Accounting] Error recording purchase invoice journal entry:', e);
    }

    res.json(inv);
  } catch (error) {
    console.error('Error approving purchase invoice:', error);
    res.status(500).json({ error: 'Failed to approve purchase invoice' });
  }
});

accountingRouter.post('/accounting/purchase-invoices/:id/record-payment', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { amount, payment_method, payment_reference, payment_date } = req.body;
    const invoice = await client.query('SELECT * FROM purchase_invoices WHERE id = $1', [id]);
    if (invoice.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Purchase invoice not found' });
    }
    const inv = invoice.rows[0];
    const newAmountPaid = (inv.amount_paid || 0) + amount;
    const newStatus = newAmountPaid >= inv.total_amount ? 'paid' : 'partially_paid';
    await client.query(
      `UPDATE purchase_invoices SET amount_paid = $2, status = $3, paid_at = CASE WHEN $3 = 'paid' THEN NOW() ELSE paid_at END, updated_at = NOW() WHERE id = $1`,
      [id, newAmountPaid, newStatus]
    );
    const allocation = await client.query(
      `INSERT INTO payment_allocations (payment_date, amount, payment_method, payment_reference, allocation_type, allocation_id, notes, created_by_id)
       VALUES ($1, $2, $3, $4, 'purchase_invoice', $5, $6, $7) RETURNING *`,
      [payment_date || new Date().toISOString(), amount, payment_method || null, payment_reference || null, id, req.body.notes || null, req.user?.id || null]
    );
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM purchase_invoices WHERE id = $1', [id]);
    res.json({ invoice: updated.rows[0], payment: allocation.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error recording purchase payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});
// ==========================================
// CREDIT NOTES
// ==========================================

accountingRouter.get('/accounting/credit-notes', requireAgent, async (req: any, res) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (req.query.status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(req.query.status);
    }
    if (req.query.customerId) {
      conditions.push(`customer_id = $${paramIndex++}`);
      params.push(parseInt(req.query.customerId));
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM credit_notes ${where} ORDER BY credit_note_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching credit notes:', error);
    res.status(500).json({ error: 'Failed to fetch credit notes' });
  }
});

accountingRouter.get('/accounting/credit-notes/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM credit_notes WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Credit note not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching credit note:', error);
    res.status(500).json({ error: 'Failed to fetch credit note' });
  }
});

accountingRouter.post('/accounting/credit-notes', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const body = req.body;
    const settings = await client.query('SELECT credit_note_prefix, credit_note_next_number FROM business_settings LIMIT 1');
    let prefix = 'JBCN';
    let nextNum = 1;
    if (settings.rows.length > 0) {
      prefix = settings.rows[0].credit_note_prefix || 'JBCN';
      nextNum = settings.rows[0].credit_note_next_number || 1;
    }
    const creditNoteNumber = body.credit_note_number || `${prefix}-${String(nextNum).padStart(5, '0')}`;
    const result = await client.query(
      `INSERT INTO credit_notes (credit_note_number, credit_note_date, original_invoice_id, customer_type, customer_id, customer_name, subtotal, vat_amount, total_amount, status, reason, notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [creditNoteNumber, body.credit_note_date, body.original_invoice_id || null, body.customer_type || null, body.customer_id || null, body.customer_name, body.subtotal || 0, body.vat_amount || 0, body.total_amount || 0, body.status || 'draft', body.reason || null, body.notes || null, req.user?.id || null]
    );
    if (settings.rows.length > 0) {
      await client.query('UPDATE business_settings SET credit_note_next_number = credit_note_next_number + 1');
    }
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating credit note:', error);
    res.status(500).json({ error: 'Failed to create credit note' });
  } finally {
    client.release();
  }
});

accountingRouter.post('/accounting/credit-notes/:id/apply', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const { invoice_id, amount } = req.body;
    const cn = await client.query('SELECT * FROM credit_notes WHERE id = $1', [id]);
    if (cn.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Credit note not found' });
    }
    const creditNote = cn.rows[0];
    const remaining = creditNote.total_amount - (creditNote.amount_applied || 0);
    if (amount > remaining) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Amount exceeds remaining credit (${remaining} pence available)` });
    }
    const newApplied = (creditNote.amount_applied || 0) + amount;
    const cnStatus = newApplied >= creditNote.total_amount ? 'fully_applied' : 'partially_applied';
    await client.query(
      'UPDATE credit_notes SET amount_applied = $2, status = $3, updated_at = NOW() WHERE id = $1',
      [id, newApplied, cnStatus]
    );
    // Reduce invoice balance
    const inv = await client.query('SELECT * FROM business_invoices WHERE id = $1', [invoice_id]);
    if (inv.rows.length > 0) {
      const newPaid = (inv.rows[0].amount_paid || 0) + amount;
      const invStatus = newPaid >= inv.rows[0].total_amount ? 'paid' : 'partially_paid';
      await client.query(
        `UPDATE business_invoices SET amount_paid = $2, status = $3, updated_at = NOW() WHERE id = $1`,
        [invoice_id, newPaid, invStatus]
      );
    }
    // Create allocation record
    await client.query(
      `INSERT INTO payment_allocations (payment_date, amount, payment_method, allocation_type, allocation_id, notes, created_by_id)
       VALUES (NOW(), $1, 'credit_note', 'credit_note', $2, $3, $4)`,
      [amount, id, `Applied to invoice #${invoice_id}`, req.user?.id || null]
    );
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM credit_notes WHERE id = $1', [id]);
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error applying credit note:', error);
    res.status(500).json({ error: 'Failed to apply credit note' });
  } finally {
    client.release();
  }
});

// ==========================================
// PAYMENT ALLOCATIONS
// ==========================================

accountingRouter.get('/accounting/payment-allocations', requireAgent, async (req: any, res) => {
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;
    if (req.query.type) {
      conditions.push(`allocation_type = $${paramIndex++}`);
      params.push(req.query.type);
    }
    if (req.query.id) {
      conditions.push(`allocation_id = $${paramIndex++}`);
      params.push(parseInt(req.query.id));
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT * FROM payment_allocations ${where} ORDER BY payment_date DESC`,
      params
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching payment allocations:', error);
    res.status(500).json({ error: 'Failed to fetch payment allocations' });
  }
});

accountingRouter.post('/accounting/payment-allocations', requireAgent, async (req: any, res) => {
  try {
    const { payment_date, amount, payment_method, payment_reference, allocation_type, allocation_id, bank_account_id, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO payment_allocations (payment_date, amount, payment_method, payment_reference, allocation_type, allocation_id, bank_account_id, notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [payment_date, amount, payment_method || null, payment_reference || null, allocation_type || null, allocation_id || null, bank_account_id || null, notes || null, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating payment allocation:', error);
    res.status(500).json({ error: 'Failed to create payment allocation' });
  }
});

accountingRouter.get('/accounting/unallocated-payments', requireAgent, async (req: any, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM payment_allocations WHERE allocation_type IS NULL OR allocation_id IS NULL ORDER BY payment_date DESC`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching unallocated payments:', error);
    res.status(500).json({ error: 'Failed to fetch unallocated payments' });
  }
});

// ==========================================
// RECURRING TEMPLATES
// ==========================================

accountingRouter.get('/accounting/recurring-templates', requireAgent, async (req: any, res) => {
  try {
    const result = await pool.query('SELECT * FROM recurring_invoice_templates ORDER BY template_name');
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching recurring templates:', error);
    res.status(500).json({ error: 'Failed to fetch recurring templates' });
  }
});

accountingRouter.post('/accounting/recurring-templates', requireAgent, async (req: any, res) => {
  try {
    const b = req.body;
    const result = await pool.query(
      `INSERT INTO recurring_invoice_templates (template_name, customer_type, customer_id, customer_name, frequency, day_of_month, line_items, subtotal, vat_amount, total_amount, property_id, account_id, tax_rate_id, next_generation_date, notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
      [b.template_name, b.customer_type || null, b.customer_id || null, b.customer_name, b.frequency, b.day_of_month || null, JSON.stringify(b.line_items || []), b.subtotal || 0, b.vat_amount || 0, b.total_amount || 0, b.property_id || null, b.account_id || null, b.tax_rate_id || null, b.next_generation_date || null, b.notes || null, req.user?.id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating recurring template:', error);
    res.status(500).json({ error: 'Failed to create recurring template' });
  }
});

accountingRouter.put('/accounting/recurring-templates/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const fields = { ...req.body };
    if (fields.line_items) fields.line_items = JSON.stringify(fields.line_items);
    const { sql, values } = buildUpdateQuery('recurring_invoice_templates', fields, id);
    const result = await pool.query(sql, values);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating recurring template:', error);
    res.status(500).json({ error: 'Failed to update recurring template' });
  }
});

accountingRouter.delete('/accounting/recurring-templates/:id', requireAgent, async (req: any, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'UPDATE recurring_invoice_templates SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error deactivating recurring template:', error);
    res.status(500).json({ error: 'Failed to deactivate recurring template' });
  }
});

accountingRouter.post('/accounting/recurring-templates/:id/run', requireAgent, async (req: any, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { id } = req.params;
    const tmpl = await client.query('SELECT * FROM recurring_invoice_templates WHERE id = $1 AND is_active = true', [id]);
    if (tmpl.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Active template not found' });
    }
    const t = tmpl.rows[0];
    const settings = await client.query('SELECT sales_invoice_prefix, sales_invoice_next_number FROM business_settings LIMIT 1');
    let prefix = 'JBINV';
    let nextNum = 1;
    if (settings.rows.length > 0) {
      prefix = settings.rows[0].sales_invoice_prefix || 'JBINV';
      nextNum = settings.rows[0].sales_invoice_next_number || 1;
    }
    const invoiceNumber = `${prefix}-${String(nextNum).padStart(5, '0')}`;
    const now = new Date();
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + 30);
    const invoiceResult = await client.query(
      `INSERT INTO business_invoices (invoice_number, invoice_date, due_date, customer_type, customer_id, customer_name, subtotal, vat_amount, total_amount, status, property_id, notes, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11, $12) RETURNING *`,
      [invoiceNumber, now.toISOString(), dueDate.toISOString(), t.customer_type, t.customer_id, t.customer_name, t.subtotal || 0, t.vat_amount || 0, t.total_amount || 0, t.property_id, `Generated from template: ${t.template_name}`, req.user?.id || null]
    );
    const invoiceId = invoiceResult.rows[0].id;
    const lineItems = typeof t.line_items === 'string' ? JSON.parse(t.line_items) : (t.line_items || []);
    for (let i = 0; i < lineItems.length; i++) {
      const line = lineItems[i];
      await client.query(
        `INSERT INTO business_invoice_lines (business_invoice_id, description, quantity, unit_price, line_total, tax_rate_id, tax_amount, account_id, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [invoiceId, line.description, line.quantity || 1, line.unit_price || 0, line.line_total || 0, line.tax_rate_id || null, line.tax_amount || 0, line.account_id || t.account_id || null, i]
      );
    }
    // Update template tracking
    let nextGenDate = null;
    if (t.frequency === 'weekly') { nextGenDate = new Date(now); nextGenDate.setDate(nextGenDate.getDate() + 7); }
    else if (t.frequency === 'monthly') { nextGenDate = new Date(now); nextGenDate.setMonth(nextGenDate.getMonth() + 1); }
    else if (t.frequency === 'quarterly') { nextGenDate = new Date(now); nextGenDate.setMonth(nextGenDate.getMonth() + 3); }
    else if (t.frequency === 'annually') { nextGenDate = new Date(now); nextGenDate.setFullYear(nextGenDate.getFullYear() + 1); }
    await client.query(
      'UPDATE recurring_invoice_templates SET last_generated_date = NOW(), next_generation_date = $2, updated_at = NOW() WHERE id = $1',
      [id, nextGenDate ? nextGenDate.toISOString() : null]
    );
    if (settings.rows.length > 0) {
      await client.query('UPDATE business_settings SET sales_invoice_next_number = sales_invoice_next_number + 1');
    }
    await client.query('COMMIT');
    res.status(201).json(invoiceResult.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error running recurring template:', error);
    res.status(500).json({ error: 'Failed to generate invoice from template' });
  } finally {
    client.release();
  }
});