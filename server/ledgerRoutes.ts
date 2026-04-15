import { Router } from 'express';
import { pool } from './db';

export const ledgerRoutes = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin" && req.user.role !== "agent") return res.status(403).json({ error: "Not authorized" });
  next();
};

// ─── LANDLORD LEDGER ───────────────────────────────────────────────────────────
// GET /api/crm/landlord-ledger/:landlordId?view=payment|charges|collections|repairs|reserve|audit|commission&from=&to=&propertyId=

ledgerRoutes.get('/landlord-ledger/:landlordId', requireAgent, async (req: any, res: any) => {
  const { landlordId } = req.params;
  const { view = 'audit', from, to, propertyId } = req.query as Record<string, string>;

  const lid = parseInt(landlordId);
  if (isNaN(lid)) return res.status(400).json({ error: 'Invalid landlordId' });

  const dateFrom = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const dateTo = to ? new Date(to) : new Date();

  try {
    let rows: any[] = [];

    if (view === 'payment') {
      // Landlord payment history — debits/withdrawals/transfers
      const result = await pool.query(
        `SELECT cat.id,
                cat.transaction_date AS date,
                cat.description,
                cat.amount,
                cat.reference,
                p.address AS property_address,
                cat.balance_after AS balance,
                cat.transaction_type AS status
         FROM client_account_transactions cat
         LEFT JOIN properties p ON p.id = cat.property_id
         WHERE cat.landlord_id = $1
           AND cat.transaction_type IN ('debit','withdrawal','transfer')
           AND cat.transaction_date BETWEEN $2 AND $3
           ${propertyId ? 'AND cat.property_id = $4' : ''}
         ORDER BY cat.transaction_date DESC`,
        propertyId ? [lid, dateFrom, dateTo, parseInt(propertyId)] : [lid, dateFrom, dateTo]
      );
      rows = result.rows;

    } else if (view === 'charges') {
      // Charges/credits — management fees, insurance, service charges, other
      const result = await pool.query(
        `SELECT cat.id,
                cat.transaction_date AS date,
                cat.description,
                cat.amount,
                cat.reference,
                p.address AS property_address,
                cat.balance_after AS balance,
                cat.category AS status
         FROM client_account_transactions cat
         LEFT JOIN properties p ON p.id = cat.property_id
         WHERE cat.landlord_id = $1
           AND cat.category IN ('management_fee','insurance','service_charge','other')
           AND cat.transaction_date BETWEEN $2 AND $3
           ${propertyId ? 'AND cat.property_id = $4' : ''}
         ORDER BY cat.transaction_date DESC`,
        propertyId ? [lid, dateFrom, dateTo, parseInt(propertyId)] : [lid, dateFrom, dateTo]
      );
      rows = result.rows;

    } else if (view === 'collections') {
      // Rent collections from invoices, joined with properties for this landlord
      const result = await pool.query(
        `SELECT inv.id,
                inv.due_date AS date,
                COALESCE(inv.description, 'Rent') AS description,
                inv.amount,
                CAST(inv.id AS text) AS reference,
                p.address AS property_address,
                0 AS balance,
                inv.status
         FROM invoices inv
         JOIN properties p ON p.id = inv.property_id
         WHERE p.landlord_id = $1
           AND inv.due_date BETWEEN $2 AND $3
           ${propertyId ? 'AND inv.property_id = $4' : ''}
         ORDER BY inv.due_date DESC`,
        propertyId ? [lid, dateFrom, dateTo, parseInt(propertyId)] : [lid, dateFrom, dateTo]
      );
      rows = result.rows;

    } else if (view === 'repairs') {
      // Repair/maintenance transactions
      const result = await pool.query(
        `SELECT cat.id,
                cat.transaction_date AS date,
                cat.description,
                cat.amount,
                cat.reference,
                p.address AS property_address,
                cat.balance_after AS balance,
                cat.category AS status
         FROM client_account_transactions cat
         LEFT JOIN properties p ON p.id = cat.property_id
         WHERE cat.landlord_id = $1
           AND cat.category = 'maintenance'
           AND cat.transaction_date BETWEEN $2 AND $3
           ${propertyId ? 'AND cat.property_id = $4' : ''}
         ORDER BY cat.transaction_date DESC`,
        propertyId ? [lid, dateFrom, dateTo, parseInt(propertyId)] : [lid, dateFrom, dateTo]
      );
      rows = result.rows;

    } else if (view === 'reserve') {
      // Reserve account transactions for this landlord's reserve account
      const result = await pool.query(
        `SELECT rat.id,
                rat.transaction_date AS date,
                rat.description,
                rat.amount,
                rat.reference,
                NULL AS property_address,
                rat.balance_after AS balance,
                rat.transaction_type AS status
         FROM reserve_account_transactions rat
         JOIN landlord_reserve_accounts lra ON lra.id = rat.reserve_account_id
         WHERE lra.landlord_id = $1
           AND rat.transaction_date BETWEEN $2 AND $3
         ORDER BY rat.transaction_date DESC`,
        [lid, dateFrom, dateTo]
      );
      rows = result.rows;

    } else if (view === 'audit') {
      // Complete audit trail — all client account transactions for this landlord
      const result = await pool.query(
        `SELECT cat.id,
                cat.transaction_date AS date,
                cat.description,
                cat.amount,
                cat.reference,
                p.address AS property_address,
                cat.balance_after AS balance,
                cat.transaction_type AS status
         FROM client_account_transactions cat
         LEFT JOIN properties p ON p.id = cat.property_id
         WHERE cat.landlord_id = $1
           AND cat.transaction_date BETWEEN $2 AND $3
           ${propertyId ? 'AND cat.property_id = $4' : ''}
         ORDER BY cat.transaction_date DESC`,
        propertyId ? [lid, dateFrom, dateTo, parseInt(propertyId)] : [lid, dateFrom, dateTo]
      );
      rows = result.rows;

    } else if (view === 'commission') {
      // Commission/management fee deductions — calculated from properties for this landlord
      const propsResult = await pool.query(
        `SELECT p.id AS property_id,
                p.address AS property_address,
                p.management_fee_type,
                p.management_fee_value,
                p.rent_amount
         FROM properties p
         WHERE p.landlord_id = $1
           AND p.is_managed = true
           ${propertyId ? 'AND p.id = $2' : ''}`,
        propertyId ? [lid, parseInt(propertyId)] : [lid]
      );

      // For each property, look up rent collected in period and compute commission
      for (const prop of propsResult.rows) {
        const invoicesResult = await pool.query(
          `SELECT COALESCE(SUM(amount), 0) AS rent_collected
           FROM invoices
           WHERE property_id = $1
             AND status = 'paid'
             AND paid_date BETWEEN $2 AND $3`,
          [prop.property_id, dateFrom, dateTo]
        );

        const rentCollected = parseInt(invoicesResult.rows[0]?.rent_collected ?? 0);
        let commissionNet = 0;

        if (prop.management_fee_type === 'percentage' && prop.management_fee_value) {
          commissionNet = Math.round((rentCollected * parseFloat(prop.management_fee_value)) / 100);
        } else if (prop.management_fee_type === 'fixed' && prop.management_fee_value) {
          // Count months in range
          const months = Math.max(1, Math.round((dateTo.getTime() - dateFrom.getTime()) / (30 * 24 * 60 * 60 * 1000)));
          commissionNet = Math.round(parseFloat(prop.management_fee_value) * months);
        }

        const vat = Math.round(commissionNet * 0.2);
        const gross = commissionNet + vat;

        rows.push({
          id: prop.property_id,
          date: dateTo.toISOString(),
          description: `Management commission`,
          amount: gross,
          reference: null,
          property_address: prop.property_address,
          balance: null,
          status: `Net: £${(commissionNet / 100).toFixed(2)} | VAT: £${(vat / 100).toFixed(2)} | Gross: £${(gross / 100).toFixed(2)} | Rent collected: £${(rentCollected / 100).toFixed(2)}`,
          rent_collected: rentCollected,
          commission_net: commissionNet,
          commission_vat: vat,
          commission_gross: gross,
        });
      }
    } else {
      return res.status(400).json({ error: 'Invalid view parameter' });
    }

    res.json({ view, landlordId: lid, from: dateFrom, to: dateTo, rows });
  } catch (err: any) {
    console.error('landlord-ledger error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── TENANT RENT BOOK ──────────────────────────────────────────────────────────
// GET /api/crm/tenant-rent-book/:tenantId?from=&to=

ledgerRoutes.get('/tenant-rent-book/:tenantId', requireAgent, async (req: any, res: any) => {
  const { tenantId } = req.params;
  const { from, to } = req.query as Record<string, string>;

  const tid = parseInt(tenantId);
  if (isNaN(tid)) return res.status(400).json({ error: 'Invalid tenantId' });

  const dateFrom = from ? new Date(from) : new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const dateTo = to ? new Date(to) : new Date();

  try {
    const result = await pool.query(
      `SELECT inv.id,
              inv.due_date,
              inv.amount AS amount_due,
              COALESCE(inv.paid_amount, inv.amount) AS payment_amount,
              inv.paid_date AS payment_date,
              inv.status,
              inv.description,
              inv.payment_method
       FROM invoices inv
       WHERE inv.tenant_id = $1
         AND inv.due_date BETWEEN $2 AND $3
       ORDER BY inv.due_date ASC`,
      [tid, dateFrom, dateTo]
    );

    let runningArrears = 0;
    const rows = result.rows.map((row: any) => {
      const amountDue = parseInt(row.amount_due ?? 0);
      const paymentAmount = row.status === 'paid' ? amountDue : parseInt(row.payment_amount ?? 0);
      const unpaid = amountDue - paymentAmount;
      runningArrears += unpaid;

      let itemStatus: string;
      if (row.status === 'paid') {
        itemStatus = 'paid';
      } else if (new Date(row.due_date) < new Date()) {
        itemStatus = runningArrears > 0 ? 'overdue' : 'paid';
      } else {
        itemStatus = amountDue > paymentAmount ? 'partial' : 'pending';
      }

      return {
        id: row.id,
        due_date: row.due_date,
        period_to: row.due_date, // due_date serves as period reference
        amount_due: amountDue,
        payment_amount: paymentAmount,
        payment_date: row.payment_date,
        running_arrears_balance: runningArrears,
        item_status: itemStatus,
        payment_method: row.payment_method ?? null,
        description: row.description,
      };
    });

    res.json({ tenantId: tid, from: dateFrom, to: dateTo, rows });
  } catch (err: any) {
    console.error('tenant-rent-book error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── RECURRING LANDLORD CHARGES ────────────────────────────────────────────────

// GET /api/crm/recurring-charges — list all active charges
ledgerRoutes.get('/recurring-charges', requireAgent, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT rlc.*,
              l.name AS landlord_name,
              p.address AS property_address
       FROM recurring_landlord_charge rlc
       LEFT JOIN landlords l ON l.id = rlc.landlord_id
       LEFT JOIN properties p ON p.id = rlc.property_id
       WHERE rlc.is_active = true
       ORDER BY rlc.next_due_date ASC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('recurring-charges list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/crm/recurring-charges/:id — single charge detail
ledgerRoutes.get('/recurring-charges/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await pool.query(
      `SELECT rlc.*,
              l.name AS landlord_name,
              p.address AS property_address
       FROM recurring_landlord_charge rlc
       LEFT JOIN landlords l ON l.id = rlc.landlord_id
       LEFT JOIN properties p ON p.id = rlc.property_id
       WHERE rlc.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('recurring-charges get error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/recurring-charges — create charge
ledgerRoutes.post('/recurring-charges', requireAgent, async (req: any, res: any) => {
  const {
    landlordId, propertyId, description, frequency,
    amountNet, amountVat, amountGross,
    nextDueDate, endDate, payeeName, category,
  } = req.body;

  if (!landlordId || !description || !frequency || amountNet === undefined || amountGross === undefined || !nextDueDate) {
    return res.status(400).json({ error: 'Missing required fields: landlordId, description, frequency, amountNet, amountGross, nextDueDate' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO recurring_landlord_charge
         (landlord_id, property_id, description, frequency, amount_net, amount_vat, amount_gross,
          next_due_date, end_date, is_active, payee_name, category, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, $10, $11, $12, NOW(), NOW())
       RETURNING *`,
      [
        landlordId,
        propertyId ?? null,
        description,
        frequency,
        amountNet,
        amountVat ?? 0,
        amountGross,
        new Date(nextDueDate),
        endDate ? new Date(endDate) : null,
        payeeName ?? null,
        category ?? null,
        req.user.id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('recurring-charges create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/crm/recurring-charges/:id — update charge
ledgerRoutes.put('/recurring-charges/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const {
    description, frequency, amountNet, amountVat, amountGross,
    nextDueDate, endDate, payeeName, category, isActive,
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE recurring_landlord_charge SET
         description   = COALESCE($1, description),
         frequency     = COALESCE($2, frequency),
         amount_net    = COALESCE($3, amount_net),
         amount_vat    = COALESCE($4, amount_vat),
         amount_gross  = COALESCE($5, amount_gross),
         next_due_date = COALESCE($6, next_due_date),
         end_date      = COALESCE($7, end_date),
         payee_name    = COALESCE($8, payee_name),
         category      = COALESCE($9, category),
         is_active     = COALESCE($10, is_active),
         updated_at    = NOW()
       WHERE id = $11
       RETURNING *`,
      [
        description ?? null,
        frequency ?? null,
        amountNet ?? null,
        amountVat ?? null,
        amountGross ?? null,
        nextDueDate ? new Date(nextDueDate) : null,
        endDate ? new Date(endDate) : null,
        payeeName ?? null,
        category ?? null,
        isActive !== undefined ? isActive : null,
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('recurring-charges update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/crm/recurring-charges/:id — deactivate (soft delete)
ledgerRoutes.delete('/recurring-charges/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await pool.query(
      `UPDATE recurring_landlord_charge SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deactivated', charge: result.rows[0] });
  } catch (err: any) {
    console.error('recurring-charges delete error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/recurring-charges/process — process all due charges
ledgerRoutes.post('/recurring-charges/process', requireAgent, async (req: any, res: any) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Find all active charges where next_due_date is on or before now and end_date has not passed
    const dueResult = await client.query(
      `SELECT rlc.*, l.name AS landlord_name
       FROM recurring_landlord_charge rlc
       LEFT JOIN landlords l ON l.id = rlc.landlord_id
       WHERE rlc.is_active = true
         AND rlc.next_due_date <= NOW()
         AND (rlc.end_date IS NULL OR rlc.end_date >= NOW())`
    );

    const processed: any[] = [];

    for (const charge of dueResult.rows) {
      // Get current balance for client account (last balance_after for this landlord)
      const balResult = await client.query(
        `SELECT balance_after FROM client_account_transactions
         WHERE landlord_id = $1
         ORDER BY transaction_date DESC, id DESC
         LIMIT 1`,
        [charge.landlord_id]
      );
      const currentBalance = parseInt(balResult.rows[0]?.balance_after ?? 0);
      const newBalance = currentBalance - charge.amount_gross;

      // Insert client_account_transaction
      const txResult = await client.query(
        `INSERT INTO client_account_transactions
           (transaction_type, amount, description, reference, transaction_date,
            property_id, landlord_id, balance_after, reconciled, category, created_by, created_at)
         VALUES ('debit', $1, $2, $3, NOW(), $4, $5, $6, false, $7, $8, NOW())
         RETURNING id`,
        [
          charge.amount_gross,
          charge.description,
          `recurring-${charge.id}`,
          charge.property_id,
          charge.landlord_id,
          newBalance,
          charge.category ?? 'management_fee',
          req.user.id,
        ]
      );

      // Calculate next due date based on frequency
      let nextDue: Date;
      const current = new Date(charge.next_due_date);
      if (charge.frequency === 'monthly') {
        nextDue = new Date(current);
        nextDue.setMonth(nextDue.getMonth() + 1);
      } else if (charge.frequency === 'quarterly') {
        nextDue = new Date(current);
        nextDue.setMonth(nextDue.getMonth() + 3);
      } else if (charge.frequency === 'annually') {
        nextDue = new Date(current);
        nextDue.setFullYear(nextDue.getFullYear() + 1);
      } else {
        // weekly fallback
        nextDue = new Date(current);
        nextDue.setDate(nextDue.getDate() + 7);
      }

      // Update last_processed_date and next_due_date
      await client.query(
        `UPDATE recurring_landlord_charge
         SET last_processed_date = NOW(), next_due_date = $1, updated_at = NOW()
         WHERE id = $2`,
        [nextDue, charge.id]
      );

      processed.push({
        chargeId: charge.id,
        description: charge.description,
        landlordId: charge.landlord_id,
        landlordName: charge.landlord_name,
        amountGross: charge.amount_gross,
        transactionId: txResult.rows[0].id,
        nextDueDate: nextDue,
      });
    }

    await client.query('COMMIT');
    res.json({ processed: processed.length, charges: processed });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('recurring-charges process error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── TENANT CREDIT ACCOUNTS ────────────────────────────────────────────────────

// GET /api/crm/tenant-credit/:tenantId — get credit account with transactions
ledgerRoutes.get('/tenant-credit/:tenantId', requireAgent, async (req: any, res: any) => {
  const tid = parseInt(req.params.tenantId);
  if (isNaN(tid)) return res.status(400).json({ error: 'Invalid tenantId' });

  try {
    // Get or create account
    let accountResult = await pool.query(
      `SELECT * FROM tenant_credit_account WHERE tenant_id = $1`,
      [tid]
    );

    let account = accountResult.rows[0] ?? null;

    // Fetch transactions if account exists
    let transactions: any[] = [];
    if (account) {
      const txResult = await pool.query(
        `SELECT * FROM tenant_credit_transaction
         WHERE tenant_credit_account_id = $1
         ORDER BY transaction_date DESC`,
        [account.id]
      );
      transactions = txResult.rows;
    }

    res.json({ account, transactions });
  } catch (err: any) {
    console.error('tenant-credit get error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/tenant-credit/:tenantId/transactions — add transaction, auto-create account
ledgerRoutes.post('/tenant-credit/:tenantId/transactions', requireAgent, async (req: any, res: any) => {
  const tid = parseInt(req.params.tenantId);
  if (isNaN(tid)) return res.status(400).json({ error: 'Invalid tenantId' });

  const { transactionType, amount, description, reference, transactionDate } = req.body;

  if (!transactionType || amount === undefined || !description) {
    return res.status(400).json({ error: 'Missing required fields: transactionType, amount, description' });
  }

  const validTypes = ['credit', 'debit', 'write_off', 'transfer'];
  if (!validTypes.includes(transactionType)) {
    return res.status(400).json({ error: `transactionType must be one of: ${validTypes.join(', ')}` });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Auto-create account if not exists
    let accountResult = await client.query(
      `SELECT * FROM tenant_credit_account WHERE tenant_id = $1 FOR UPDATE`,
      [tid]
    );

    let account = accountResult.rows[0];
    if (!account) {
      const newAccount = await client.query(
        `INSERT INTO tenant_credit_account (tenant_id, balance, created_at, updated_at)
         VALUES ($1, 0, NOW(), NOW()) RETURNING *`,
        [tid]
      );
      account = newAccount.rows[0];
    }

    // Calculate new balance
    const amountInt = parseInt(amount);
    let delta = 0;
    if (transactionType === 'credit') {
      delta = amountInt;
    } else if (transactionType === 'debit' || transactionType === 'write_off' || transactionType === 'transfer') {
      delta = -amountInt;
    }

    const newBalance = parseInt(account.balance) + delta;

    // Update account balance
    await client.query(
      `UPDATE tenant_credit_account SET balance = $1, updated_at = NOW() WHERE id = $2`,
      [newBalance, account.id]
    );

    // Insert transaction
    const txResult = await client.query(
      `INSERT INTO tenant_credit_transaction
         (tenant_credit_account_id, transaction_type, amount, description, reference,
          transaction_date, balance_after, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
       RETURNING *`,
      [
        account.id,
        transactionType,
        amountInt,
        description,
        reference ?? null,
        transactionDate ? new Date(transactionDate) : new Date(),
        newBalance,
        req.user.id,
      ]
    );

    await client.query('COMMIT');
    res.status(201).json({ account: { ...account, balance: newBalance }, transaction: txResult.rows[0] });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('tenant-credit transaction error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── GUARANTEED PAYMENTS ───────────────────────────────────────────────────────

// GET /api/crm/guaranteed-payments — list all active
ledgerRoutes.get('/guaranteed-payments', requireAgent, async (req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT gp.*,
              t.name AS tenant_name,
              p.address AS property_address
       FROM guaranteed_payment gp
       LEFT JOIN tenant t ON t.id = gp.tenant_id
       LEFT JOIN properties p ON p.id = gp.property_id
       WHERE gp.status = 'active'
       ORDER BY gp.start_date DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('guaranteed-payments list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/crm/guaranteed-payments — create
ledgerRoutes.post('/guaranteed-payments', requireAgent, async (req: any, res: any) => {
  const { tenantId, tenancyId, propertyId, schemeName, monthlyAmount, startDate, endDate, policyNumber, notes } = req.body;

  if (!tenantId || !schemeName || monthlyAmount === undefined || !startDate) {
    return res.status(400).json({ error: 'Missing required fields: tenantId, schemeName, monthlyAmount, startDate' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO guaranteed_payment
         (tenant_id, tenancy_id, property_id, scheme_name, monthly_amount,
          start_date, end_date, policy_number, status, notes, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active', $9, $10, NOW(), NOW())
       RETURNING *`,
      [
        tenantId,
        tenancyId ?? null,
        propertyId ?? null,
        schemeName,
        parseInt(monthlyAmount),
        new Date(startDate),
        endDate ? new Date(endDate) : null,
        policyNumber ?? null,
        notes ?? null,
        req.user.id,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('guaranteed-payments create error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/crm/guaranteed-payments/:id — update
ledgerRoutes.put('/guaranteed-payments/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

  const { schemeName, monthlyAmount, startDate, endDate, policyNumber, status, notes } = req.body;

  try {
    const result = await pool.query(
      `UPDATE guaranteed_payment SET
         scheme_name    = COALESCE($1, scheme_name),
         monthly_amount = COALESCE($2, monthly_amount),
         start_date     = COALESCE($3, start_date),
         end_date       = COALESCE($4, end_date),
         policy_number  = COALESCE($5, policy_number),
         status         = COALESCE($6, status),
         notes          = COALESCE($7, notes),
         updated_at     = NOW()
       WHERE id = $8
       RETURNING *`,
      [
        schemeName ?? null,
        monthlyAmount !== undefined ? parseInt(monthlyAmount) : null,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null,
        policyNumber ?? null,
        status ?? null,
        notes ?? null,
        id,
      ]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('guaranteed-payments update error:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/crm/guaranteed-payments/:id — cancel
ledgerRoutes.delete('/guaranteed-payments/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await pool.query(
      `UPDATE guaranteed_payment SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Cancelled', payment: result.rows[0] });
  } catch (err: any) {
    console.error('guaranteed-payments cancel error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── COMMISSION REPORT ─────────────────────────────────────────────────────────
// GET /api/crm/commission-report?from=&to=

ledgerRoutes.get('/commission-report', requireAgent, async (req: any, res: any) => {
  const { from, to } = req.query as Record<string, string>;

  const dateFrom = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const dateTo = to ? new Date(to) : new Date();

  try {
    const propsResult = await pool.query(
      `SELECT p.id AS property_id,
              p.address AS property_address,
              p.management_fee_type,
              p.management_fee_value,
              p.rent_amount,
              l.name AS landlord_name,
              l.id AS landlord_id
       FROM properties p
       LEFT JOIN landlords l ON l.id = p.landlord_id
       WHERE p.is_managed = true`
    );

    const rows: any[] = [];

    for (const prop of propsResult.rows) {
      const invoicesResult = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) AS rent_collected
         FROM invoices
         WHERE property_id = $1
           AND status = 'paid'
           AND paid_date BETWEEN $2 AND $3`,
        [prop.property_id, dateFrom, dateTo]
      );

      const rentCollected = parseInt(invoicesResult.rows[0]?.rent_collected ?? 0);
      if (rentCollected === 0 && prop.management_fee_type === 'percentage') continue;

      let commissionNet = 0;
      if (prop.management_fee_type === 'percentage' && prop.management_fee_value) {
        commissionNet = Math.round((rentCollected * parseFloat(prop.management_fee_value)) / 100);
      } else if (prop.management_fee_type === 'fixed' && prop.management_fee_value) {
        const months = Math.max(1, Math.round((dateTo.getTime() - dateFrom.getTime()) / (30 * 24 * 60 * 60 * 1000)));
        commissionNet = Math.round(parseFloat(prop.management_fee_value) * months);
      }

      const vat = Math.round(commissionNet * 0.2);
      const gross = commissionNet + vat;

      rows.push({
        property_id: prop.property_id,
        property_address: prop.property_address,
        landlord_id: prop.landlord_id,
        landlord_name: prop.landlord_name,
        rent_collected: rentCollected,
        commission_amount: commissionNet,
        vat,
        gross,
        invoice_date: dateTo.toISOString().split('T')[0],
      });
    }

    res.json({ from: dateFrom, to: dateTo, rows });
  } catch (err: any) {
    console.error('commission-report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── ACCOUNT MAINTENANCE ───────────────────────────────────────────────────────
// POST /api/crm/account-maintenance/:action

ledgerRoutes.post('/account-maintenance/:action', requireAgent, async (req: any, res: any) => {
  const { action } = req.params;
  const userId = req.user.id;

  if (action === 'delete-property-charge') {
    const { transactionId } = req.body;
    if (!transactionId) return res.status(400).json({ error: 'transactionId required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch transaction before deletion for audit
      const existing = await client.query(
        `SELECT * FROM client_account_transactions WHERE id = $1`,
        [transactionId]
      );
      if (existing.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Transaction not found' });
      }

      const tx = existing.rows[0];

      // Log audit entry
      await client.query(
        `INSERT INTO client_account_transactions
           (transaction_type, amount, description, reference, transaction_date,
            property_id, landlord_id, balance_after, reconciled, category, notes, created_by, created_at)
         VALUES ('debit', 0, $1, $2, NOW(), $3, $4, 0, false, 'audit', $5, $6, NOW())`,
        [
          `AUDIT: Deleted transaction #${transactionId} — ${tx.description}`,
          `delete-${transactionId}`,
          tx.property_id,
          tx.landlord_id,
          `Deleted by user ${userId}. Original amount: ${tx.amount}p on ${tx.transaction_date}`,
          userId,
        ]
      );

      // Delete the transaction
      await client.query(`DELETE FROM client_account_transactions WHERE id = $1`, [transactionId]);

      await client.query('COMMIT');
      res.json({ message: 'Transaction deleted', deletedId: transactionId });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('account-maintenance delete-property-charge error:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }

  } else if (action === 'reverse-invoice') {
    const { invoiceId, reason } = req.body;
    if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Fetch invoice
      const invResult = await client.query(
        `SELECT inv.*, p.landlord_id FROM invoices inv
         LEFT JOIN properties p ON p.id = inv.property_id
         WHERE inv.id = $1`,
        [invoiceId]
      );
      if (invResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Invoice not found' });
      }

      const inv = invResult.rows[0];

      // Get current balance
      const balResult = await client.query(
        `SELECT balance_after FROM client_account_transactions
         WHERE landlord_id = $1
         ORDER BY transaction_date DESC, id DESC
         LIMIT 1`,
        [inv.landlord_id]
      );
      const currentBalance = parseInt(balResult.rows[0]?.balance_after ?? 0);
      const newBalance = currentBalance + parseInt(inv.amount); // credit back

      // Create offsetting transaction
      const txResult = await client.query(
        `INSERT INTO client_account_transactions
           (transaction_type, amount, description, reference, transaction_date,
            property_id, landlord_id, balance_after, reconciled, category, notes, created_by, created_at)
         VALUES ('credit', $1, $2, $3, NOW(), $4, $5, $6, false, 'other', $7, $8, NOW())
         RETURNING *`,
        [
          inv.amount,
          `Reversal of invoice #${invoiceId}`,
          `reversal-inv-${invoiceId}`,
          inv.property_id,
          inv.landlord_id,
          newBalance,
          reason ?? 'No reason provided',
          userId,
        ]
      );

      // Mark invoice as reversed
      await client.query(
        `UPDATE invoices SET status = 'reversed', notes = COALESCE(notes, '') || $1 WHERE id = $2`,
        [` | Reversed by user ${userId}: ${reason ?? 'No reason'}`, invoiceId]
      );

      await client.query('COMMIT');
      res.json({ message: 'Invoice reversed', transaction: txResult.rows[0] });
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error('account-maintenance reverse-invoice error:', err);
      res.status(500).json({ error: err.message });
    } finally {
      client.release();
    }

  } else if (action === 'redraw-statement') {
    const { landlordId } = req.body;
    if (!landlordId) return res.status(400).json({ error: 'landlordId required' });

    try {
      // Placeholder — statement regeneration triggers an async job
      // Log the audit entry
      await pool.query(
        `INSERT INTO client_account_transactions
           (transaction_type, amount, description, reference, transaction_date,
            landlord_id, balance_after, reconciled, category, notes, created_by, created_at)
         VALUES ('debit', 0, $1, $2, NOW(), $3, 0, false, 'audit', $4, $5, NOW())`,
        [
          `AUDIT: Statement regeneration requested for landlord #${landlordId}`,
          `redraw-stmt-${landlordId}-${Date.now()}`,
          landlordId,
          `Triggered by user ${userId}`,
          userId,
        ]
      );

      res.json({ message: 'Statement regeneration queued', landlordId });
    } catch (err: any) {
      console.error('account-maintenance redraw-statement error:', err);
      res.status(500).json({ error: err.message });
    }

  } else {
    res.status(400).json({ error: `Unknown action: ${action}. Valid actions: delete-property-charge, reverse-invoice, redraw-statement` });
  }
});
