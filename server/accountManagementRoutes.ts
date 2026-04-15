import { Router } from 'express';
import { pool } from './db';

export const accountManagementRoutes = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin" && req.user.role !== "agent") return res.status(403).json({ error: "Not authorized" });
  next();
};

// ==========================================
// CLIENT ACCOUNT
// ==========================================

// GET /client-account/transactions - list with date range + pagination
accountManagementRoutes.get('/client-account/transactions', requireAgent, async (req: any, res: any) => {
  try {
    const { from, to, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    const conditions: string[] = [];

    if (from) { params.push(from); conditions.push(`transaction_date >= $${params.length}`); }
    if (to)   { params.push(to);   conditions.push(`transaction_date <= $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const [txResult, balResult] = await Promise.all([
      pool.query(
        `SELECT * FROM client_account_transactions ${where} ORDER BY transaction_date DESC, id DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, parseInt(limit as string), parseInt(offset as string)]
      ),
      pool.query(
        `SELECT COALESCE((SELECT balance_after FROM client_account_transactions ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS current_balance`
      ),
    ]);

    res.json({
      transactions: txResult.rows,
      currentBalance: parseInt(balResult.rows[0].current_balance),
      total: txResult.rowCount,
    });
  } catch (err: any) {
    console.error('GET /client-account/transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch client account transactions' });
  }
});

// GET /client-account/balance
accountManagementRoutes.get('/client-account/balance', requireAgent, async (_req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE((SELECT balance_after FROM client_account_transactions ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS current_balance`
    );
    res.json({ balance: parseInt(result.rows[0].current_balance) });
  } catch (err: any) {
    console.error('GET /client-account/balance error:', err);
    res.status(500).json({ error: 'Failed to fetch client account balance' });
  }
});

// POST /client-account/transactions
accountManagementRoutes.post('/client-account/transactions', requireAgent, async (req: any, res: any) => {
  try {
    const {
      transactionType, amount, description, reference,
      transactionDate, propertyId, landlordId, tenantId, category, notes,
    } = req.body;

    if (!transactionType || !amount || !description) {
      return res.status(400).json({ error: 'transactionType, amount, and description are required' });
    }

    const balResult = await pool.query(
      `SELECT COALESCE((SELECT balance_after FROM client_account_transactions ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS current_balance`
    );
    const currentBalance = parseInt(balResult.rows[0].current_balance);

    const creditTypes = ['credit', 'deposit_in', 'transfer_in', 'rent_received', 'landlord_payment_in'];
    const balanceAfter = creditTypes.includes(transactionType)
      ? currentBalance + parseInt(amount)
      : currentBalance - parseInt(amount);

    const result = await pool.query(
      `INSERT INTO client_account_transactions
        (transaction_type, amount, description, reference, transaction_date,
         property_id, landlord_id, tenant_id, balance_after, category, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        transactionType, parseInt(amount), description, reference || null,
        transactionDate || new Date(), propertyId || null, landlordId || null,
        tenantId || null, balanceAfter, category || null, notes || null,
        req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /client-account/transactions error:', err);
    res.status(500).json({ error: 'Failed to create client account transaction' });
  }
});

// ==========================================
// OFFICE ACCOUNT - CATEGORIES
// ==========================================

// GET /office-account/categories
accountManagementRoutes.get('/office-account/categories', requireAgent, async (_req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT * FROM office_account_categories WHERE is_active = true ORDER BY name`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('GET /office-account/categories error:', err);
    res.status(500).json({ error: 'Failed to fetch office account categories' });
  }
});

// POST /office-account/categories
accountManagementRoutes.post('/office-account/categories', requireAgent, async (req: any, res: any) => {
  try {
    const { code, name, description } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const result = await pool.query(
      `INSERT INTO office_account_categories (code, name, description, is_active)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [code, name, description || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /office-account/categories error:', err);
    res.status(500).json({ error: 'Failed to create office account category' });
  }
});

// PUT /office-account/categories/:id
accountManagementRoutes.put('/office-account/categories/:id', requireAgent, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { code, name, description, isActive } = req.body;

    const result = await pool.query(
      `UPDATE office_account_categories
       SET code = COALESCE($1, code),
           name = COALESCE($2, name),
           description = COALESCE($3, description),
           is_active = COALESCE($4, is_active),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [code || null, name || null, description || null,
       isActive !== undefined ? isActive : null, id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Category not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('PUT /office-account/categories/:id error:', err);
    res.status(500).json({ error: 'Failed to update office account category' });
  }
});

// ==========================================
// OFFICE ACCOUNT - TRANSACTIONS
// ==========================================

// GET /office-account/transactions
accountManagementRoutes.get('/office-account/transactions', requireAgent, async (req: any, res: any) => {
  try {
    const { from, to, categoryId, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    const conditions: string[] = [];

    if (from)       { params.push(from);       conditions.push(`t.transaction_date >= $${params.length}`); }
    if (to)         { params.push(to);         conditions.push(`t.transaction_date <= $${params.length}`); }
    if (categoryId) { params.push(categoryId); conditions.push(`t.category_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT t.*, c.name AS category_name, c.code AS category_code
       FROM office_account_transactions t
       LEFT JOIN office_account_categories c ON c.id = t.category_id
       ${where}
       ORDER BY t.transaction_date DESC, t.id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    const balResult = await pool.query(
      `SELECT COALESCE((SELECT balance_after FROM office_account_transactions ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS current_balance`
    );

    res.json({
      transactions: result.rows,
      currentBalance: parseInt(balResult.rows[0].current_balance),
      total: result.rowCount,
    });
  } catch (err: any) {
    console.error('GET /office-account/transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch office account transactions' });
  }
});

// GET /office-account/balance
accountManagementRoutes.get('/office-account/balance', requireAgent, async (_req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE((SELECT balance_after FROM office_account_transactions ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS current_balance`
    );
    res.json({ balance: parseInt(result.rows[0].current_balance) });
  } catch (err: any) {
    console.error('GET /office-account/balance error:', err);
    res.status(500).json({ error: 'Failed to fetch office account balance' });
  }
});

// POST /office-account/transactions
accountManagementRoutes.post('/office-account/transactions', requireAgent, async (req: any, res: any) => {
  try {
    const {
      transactionType, amount, description, reference,
      transactionDate, categoryId, supplierName, notes,
    } = req.body;

    if (!transactionType || !amount || !description) {
      return res.status(400).json({ error: 'transactionType, amount, and description are required' });
    }

    const balResult = await pool.query(
      `SELECT COALESCE((SELECT balance_after FROM office_account_transactions ORDER BY created_at DESC, id DESC LIMIT 1), 0) AS current_balance`
    );
    const currentBalance = parseInt(balResult.rows[0].current_balance);

    const creditTypes = ['credit', 'income', 'transfer_in', 'fee_received'];
    const balanceAfter = creditTypes.includes(transactionType)
      ? currentBalance + parseInt(amount)
      : currentBalance - parseInt(amount);

    const result = await pool.query(
      `INSERT INTO office_account_transactions
        (transaction_type, amount, description, reference, transaction_date,
         category_id, supplier_name, balance_after, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        transactionType, parseInt(amount), description, reference || null,
        transactionDate || new Date(), categoryId || null, supplierName || null,
        balanceAfter, notes || null, req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /office-account/transactions error:', err);
    res.status(500).json({ error: 'Failed to create office account transaction' });
  }
});

// GET /office-account/category-balances
accountManagementRoutes.get('/office-account/category-balances', requireAgent, async (_req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT
         c.id AS category_id,
         c.code,
         c.name,
         COALESCE(SUM(CASE WHEN t.transaction_type IN ('credit','income','transfer_in','fee_received') THEN t.amount ELSE -t.amount END), 0) AS net_amount,
         COALESCE(SUM(t.amount), 0) AS total_amount,
         COUNT(t.id) AS transaction_count
       FROM office_account_categories c
       LEFT JOIN office_account_transactions t ON t.category_id = c.id
       WHERE c.is_active = true
       GROUP BY c.id, c.code, c.name
       ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('GET /office-account/category-balances error:', err);
    res.status(500).json({ error: 'Failed to fetch category balances' });
  }
});

// ==========================================
// RESERVE ACCOUNTS
// ==========================================

// GET /reserve-accounts - list all with landlord names
accountManagementRoutes.get('/reserve-accounts', requireAgent, async (_req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT ra.*, l.name AS landlord_name, l.email AS landlord_email
       FROM landlord_reserve_accounts ra
       LEFT JOIN landlords l ON l.id = ra.landlord_id
       ORDER BY l.name`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('GET /reserve-accounts error:', err);
    res.status(500).json({ error: 'Failed to fetch reserve accounts' });
  }
});

// GET /reserve-accounts/:id - single reserve account with transactions
accountManagementRoutes.get('/reserve-accounts/:id', requireAgent, async (req: any, res: any) => {
  try {
    const { id } = req.params;

    const [accountResult, txResult] = await Promise.all([
      pool.query(
        `SELECT ra.*, l.name AS landlord_name, l.email AS landlord_email
         FROM landlord_reserve_accounts ra
         LEFT JOIN landlords l ON l.id = ra.landlord_id
         WHERE ra.id = $1`,
        [id]
      ),
      pool.query(
        `SELECT * FROM reserve_account_transactions WHERE reserve_account_id = $1 ORDER BY transaction_date DESC, id DESC`,
        [id]
      ),
    ]);

    if (!accountResult.rows.length) return res.status(404).json({ error: 'Reserve account not found' });

    res.json({
      ...accountResult.rows[0],
      transactions: txResult.rows,
    });
  } catch (err: any) {
    console.error('GET /reserve-accounts/:id error:', err);
    res.status(500).json({ error: 'Failed to fetch reserve account' });
  }
});

// POST /reserve-accounts - create
accountManagementRoutes.post('/reserve-accounts', requireAgent, async (req: any, res: any) => {
  try {
    const { landlordId, targetAmount, notes } = req.body;
    if (!landlordId) return res.status(400).json({ error: 'landlordId is required' });

    const result = await pool.query(
      `INSERT INTO landlord_reserve_accounts (landlord_id, balance, target_amount, notes)
       VALUES ($1, 0, $2, $3)
       RETURNING *`,
      [landlordId, targetAmount ? parseInt(targetAmount) : null, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /reserve-accounts error:', err);
    res.status(500).json({ error: 'Failed to create reserve account' });
  }
});

// PUT /reserve-accounts/:id - update target/notes
accountManagementRoutes.put('/reserve-accounts/:id', requireAgent, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { targetAmount, notes } = req.body;

    const result = await pool.query(
      `UPDATE landlord_reserve_accounts
       SET target_amount = COALESCE($1, target_amount),
           notes = COALESCE($2, notes),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [targetAmount !== undefined ? parseInt(targetAmount) : null, notes || null, id]
    );

    if (!result.rows.length) return res.status(404).json({ error: 'Reserve account not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('PUT /reserve-accounts/:id error:', err);
    res.status(500).json({ error: 'Failed to update reserve account' });
  }
});

// POST /reserve-accounts/:id/transactions - add transaction + update balance
accountManagementRoutes.post('/reserve-accounts/:id/transactions', requireAgent, async (req: any, res: any) => {
  try {
    const { id } = req.params;
    const { transactionType, amount, description, reference, transactionDate } = req.body;

    if (!transactionType || !amount || !description) {
      return res.status(400).json({ error: 'transactionType, amount, and description are required' });
    }

    const accountResult = await pool.query(
      `SELECT * FROM landlord_reserve_accounts WHERE id = $1`,
      [id]
    );
    if (!accountResult.rows.length) return res.status(404).json({ error: 'Reserve account not found' });

    const currentBalance = parseInt(accountResult.rows[0].balance);
    const creditTypes = ['transfer_in', 'credit'];
    const newBalance = creditTypes.includes(transactionType)
      ? currentBalance + parseInt(amount)
      : currentBalance - parseInt(amount);

    // Insert transaction and update account balance atomically
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const txResult = await client.query(
        `INSERT INTO reserve_account_transactions
          (reserve_account_id, transaction_type, amount, description, reference, transaction_date, balance_after, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         RETURNING *`,
        [
          id, transactionType, parseInt(amount), description,
          reference || null, transactionDate || new Date(),
          newBalance, req.user.id,
        ]
      );

      await client.query(
        `UPDATE landlord_reserve_accounts SET balance = $1, updated_at = NOW() WHERE id = $2`,
        [newBalance, id]
      );

      await client.query('COMMIT');
      res.status(201).json(txResult.rows[0]);
    } catch (txErr) {
      await client.query('ROLLBACK');
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('POST /reserve-accounts/:id/transactions error:', err);
    res.status(500).json({ error: 'Failed to add reserve account transaction' });
  }
});

// ==========================================
// DEPOSIT ACCOUNT
// ==========================================

// GET /deposit-account/transactions
accountManagementRoutes.get('/deposit-account/transactions', requireAgent, async (req: any, res: any) => {
  try {
    const { from, to, tenantId, propertyId, limit = '50', offset = '0' } = req.query;
    const params: any[] = [];
    const conditions: string[] = [];

    if (from)       { params.push(from);       conditions.push(`transaction_date >= $${params.length}`); }
    if (to)         { params.push(to);         conditions.push(`transaction_date <= $${params.length}`); }
    if (tenantId)   { params.push(tenantId);   conditions.push(`tenant_id = $${params.length}`); }
    if (propertyId) { params.push(propertyId); conditions.push(`property_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT * FROM deposit_account_transactions ${where}
       ORDER BY transaction_date DESC, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit as string), parseInt(offset as string)]
    );

    res.json({
      transactions: result.rows,
      total: result.rowCount,
    });
  } catch (err: any) {
    console.error('GET /deposit-account/transactions error:', err);
    res.status(500).json({ error: 'Failed to fetch deposit account transactions' });
  }
});

// GET /deposit-account/balance - total deposits held
accountManagementRoutes.get('/deposit-account/balance', requireAgent, async (_req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(
         CASE
           WHEN transaction_type IN ('deposit_in', 'credit') THEN amount
           WHEN transaction_type IN ('deposit_out', 'debit', 'refund') THEN -amount
           ELSE 0
         END
       ), 0) AS total_held
       FROM deposit_account_transactions`
    );
    res.json({ balance: parseInt(result.rows[0].total_held) });
  } catch (err: any) {
    console.error('GET /deposit-account/balance error:', err);
    res.status(500).json({ error: 'Failed to fetch deposit account balance' });
  }
});

// POST /deposit-account/transactions
accountManagementRoutes.post('/deposit-account/transactions', requireAgent, async (req: any, res: any) => {
  try {
    const {
      tenantId, tenancyId, propertyId, transactionType,
      amount, description, reference, transactionDate, notes,
    } = req.body;

    if (!transactionType || !amount || !description) {
      return res.status(400).json({ error: 'transactionType, amount, and description are required' });
    }

    // Calculate balance_after for this tenant/tenancy
    const balResult = await pool.query(
      `SELECT COALESCE((
         SELECT balance_after FROM deposit_account_transactions
         WHERE tenant_id = $1
         ORDER BY created_at DESC, id DESC LIMIT 1
       ), 0) AS current_balance`,
      [tenantId || null]
    );
    const currentBalance = parseInt(balResult.rows[0].current_balance);
    const creditTypes = ['deposit_in', 'credit'];
    const balanceAfter = creditTypes.includes(transactionType)
      ? currentBalance + parseInt(amount)
      : currentBalance - parseInt(amount);

    const result = await pool.query(
      `INSERT INTO deposit_account_transactions
        (tenant_id, tenancy_id, property_id, transaction_type, amount,
         description, reference, transaction_date, balance_after, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        tenantId || null, tenancyId || null, propertyId || null,
        transactionType, parseInt(amount), description, reference || null,
        transactionDate || new Date(), balanceAfter, notes || null, req.user.id,
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('POST /deposit-account/transactions error:', err);
    res.status(500).json({ error: 'Failed to create deposit account transaction' });
  }
});

// ==========================================
// STATEMENT SEQUENCES
// ==========================================

// GET /statement-sequences/:landlordId/next - peek next number without incrementing
accountManagementRoutes.get('/statement-sequences/:landlordId/next', requireAgent, async (req: any, res: any) => {
  try {
    const { landlordId } = req.params;

    const result = await pool.query(
      `SELECT COALESCE(last_statement_number, 0) + 1 AS next_number
       FROM statement_sequences
       WHERE landlord_id = $1`,
      [landlordId]
    );

    // If no row exists yet, next number is 1
    const nextNumber = result.rows.length ? parseInt(result.rows[0].next_number) : 1;
    res.json({ nextNumber });
  } catch (err: any) {
    console.error('GET /statement-sequences/:landlordId/next error:', err);
    res.status(500).json({ error: 'Failed to get next statement number' });
  }
});

// POST /statement-sequences/:landlordId/increment - increment and return new number
accountManagementRoutes.post('/statement-sequences/:landlordId/increment', requireAgent, async (req: any, res: any) => {
  try {
    const { landlordId } = req.params;

    const result = await pool.query(
      `INSERT INTO statement_sequences (landlord_id, last_statement_number, updated_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (landlord_id)
       DO UPDATE SET
         last_statement_number = statement_sequences.last_statement_number + 1,
         updated_at = NOW()
       RETURNING last_statement_number AS statement_number`,
      [landlordId]
    );

    res.json({ statementNumber: parseInt(result.rows[0].statement_number) });
  } catch (err: any) {
    console.error('POST /statement-sequences/:landlordId/increment error:', err);
    res.status(500).json({ error: 'Failed to increment statement number' });
  }
});
