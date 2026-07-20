import { Router } from 'express';
import { pool } from './db';

// KeyData parity: Mortgage Management
// Mirrors KeyData "Property Accounting → Mortgage (Process / Payments / Future)".
// Tracks landlord/property buy-to-let mortgages and their payment schedule so the
// agency can pay lenders out of collected rent.

export const mortgageRoutes = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Not authorized' });
  next();
};

const toDate = (v: any) => (v ? new Date(v) : null);
const toInt = (v: any) => (v === null || v === undefined || v === '' ? null : parseInt(v));

// ─── LIST MORTGAGES ─────────────────────────────────────────────────────────────
// GET /api/crm/mortgages?status=&propertyId=&landlordId=
mortgageRoutes.get('/mortgages', requireAgent, async (req: any, res: any) => {
  const { status, propertyId, landlordId } = req.query as Record<string, string>;
  try {
    const conditions: string[] = [];
    const params: any[] = [];
    if (status) { params.push(status); conditions.push(`m.status = $${params.length}`); }
    if (propertyId) { params.push(parseInt(propertyId)); conditions.push(`m.property_id = $${params.length}`); }
    if (landlordId) { params.push(parseInt(landlordId)); conditions.push(`m.landlord_id = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT m.id, m.property_id AS "propertyId", m.landlord_id AS "landlordId",
              m.lender_name AS "lenderName", m.account_number AS "accountNumber",
              m.mortgage_type AS "mortgageType", m.monthly_payment AS "monthlyPayment",
              m.interest_rate_bps AS "interestRateBps", m.term_months AS "termMonths",
              m.start_date AS "startDate", m.deal_expiry_date AS "dealExpiryDate",
              m.end_date AS "endDate", m.outstanding_balance AS "outstandingBalance",
              m.next_payment_date AS "nextPaymentDate", m.pay_from_rent AS "payFromRent",
              m.payee_sort_code AS "payeeSortCode", m.payee_account_number AS "payeeAccountNumber",
              m.payee_reference AS "payeeReference", m.status, m.notes,
              p.address AS "propertyAddress", l.name AS "landlordName"
       FROM property_mortgage m
       LEFT JOIN property p ON p.id = m.property_id
       LEFT JOIN landlord l ON l.id = m.landlord_id
       ${where}
       ORDER BY m.next_payment_date NULLS LAST, m.id DESC`,
      params
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('[mortgages] list error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── SUMMARY ────────────────────────────────────────────────────────────────────
// GET /api/crm/mortgages/summary
mortgageRoutes.get('/mortgages/summary', requireAgent, async (_req: any, res: any) => {
  try {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')                                   AS "activeCount",
         COUNT(*) FILTER (WHERE status = 'in_arrears')                               AS "arrearsCount",
         COALESCE(SUM(monthly_payment) FILTER (WHERE status = 'active'), 0)          AS "totalMonthly",
         COALESCE(SUM(outstanding_balance) FILTER (WHERE status = 'active'), 0)      AS "totalOutstanding",
         COUNT(*) FILTER (WHERE status = 'active' AND deal_expiry_date IS NOT NULL
                          AND deal_expiry_date <= NOW() + INTERVAL '90 days')        AS "dealsExpiringSoon"
       FROM property_mortgage`
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('[mortgages] summary error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── UPCOMING PAYMENTS (KeyData "Mortgage Future") ───────────────────────────────
// GET /api/crm/mortgages/upcoming?days=30
mortgageRoutes.get('/mortgages/upcoming', requireAgent, async (req: any, res: any) => {
  const days = parseInt((req.query.days as string) || '30');
  try {
    const result = await pool.query(
      `SELECT mp.id, mp.mortgage_id AS "mortgageId", mp.due_date AS "dueDate",
              mp.amount, mp.status, mp.payment_method AS "paymentMethod",
              m.lender_name AS "lenderName", p.address AS "propertyAddress"
       FROM mortgage_payment mp
       JOIN property_mortgage m ON m.id = mp.mortgage_id
       LEFT JOIN property p ON p.id = m.property_id
       WHERE mp.status IN ('scheduled','overdue')
         AND mp.due_date <= NOW() + ($1 || ' days')::interval
       ORDER BY mp.due_date ASC`,
      [days]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('[mortgages] upcoming error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── PAYMENT HISTORY (KeyData "Mortgage Payments") ───────────────────────────────
// GET /api/crm/mortgages/:id/payments
mortgageRoutes.get('/mortgages/:id/payments', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const result = await pool.query(
      `SELECT id, mortgage_id AS "mortgageId", due_date AS "dueDate", amount,
              paid_date AS "paidDate", status, payment_method AS "paymentMethod",
              reference, notes
       FROM mortgage_payment
       WHERE mortgage_id = $1
       ORDER BY due_date DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('[mortgages] payments error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE MORTGAGE ─────────────────────────────────────────────────────────────
mortgageRoutes.post('/mortgages', requireAgent, async (req: any, res: any) => {
  const b = req.body || {};
  if (!b.propertyId || !b.lenderName) {
    return res.status(400).json({ error: 'propertyId and lenderName are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO property_mortgage
         (property_id, landlord_id, lender_name, account_number, mortgage_type,
          monthly_payment, interest_rate_bps, term_months, start_date, deal_expiry_date,
          end_date, outstanding_balance, next_payment_date, pay_from_rent,
          payee_sort_code, payee_account_number, payee_reference, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
       RETURNING id`,
      [
        parseInt(b.propertyId), toInt(b.landlordId), b.lenderName, b.accountNumber || null,
        b.mortgageType || 'buy_to_let', toInt(b.monthlyPayment) || 0, toInt(b.interestRateBps),
        toInt(b.termMonths), toDate(b.startDate), toDate(b.dealExpiryDate), toDate(b.endDate),
        toInt(b.outstandingBalance), toDate(b.nextPaymentDate), b.payFromRent === true,
        b.payeeSortCode || null, b.payeeAccountNumber || null, b.payeeReference || null,
        b.status || 'active', b.notes || null, req.user?.id || null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    console.error('[mortgages] create error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE MORTGAGE ─────────────────────────────────────────────────────────────
mortgageRoutes.put('/mortgages/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const b = req.body || {};
  try {
    await pool.query(
      `UPDATE property_mortgage SET
         property_id = COALESCE($2, property_id),
         landlord_id = $3, lender_name = COALESCE($4, lender_name), account_number = $5,
         mortgage_type = COALESCE($6, mortgage_type), monthly_payment = COALESCE($7, monthly_payment),
         interest_rate_bps = $8, term_months = $9, start_date = $10, deal_expiry_date = $11,
         end_date = $12, outstanding_balance = $13, next_payment_date = $14,
         pay_from_rent = COALESCE($15, pay_from_rent), payee_sort_code = $16,
         payee_account_number = $17, payee_reference = $18, status = COALESCE($19, status),
         notes = $20, updated_at = NOW()
       WHERE id = $1`,
      [
        id, toInt(b.propertyId), toInt(b.landlordId), b.lenderName || null, b.accountNumber || null,
        b.mortgageType || null, toInt(b.monthlyPayment), toInt(b.interestRateBps), toInt(b.termMonths),
        toDate(b.startDate), toDate(b.dealExpiryDate), toDate(b.endDate), toInt(b.outstandingBalance),
        toDate(b.nextPaymentDate), typeof b.payFromRent === 'boolean' ? b.payFromRent : null,
        b.payeeSortCode || null, b.payeeAccountNumber || null, b.payeeReference || null,
        b.status || null, b.notes || null,
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('[mortgages] update error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE MORTGAGE ─────────────────────────────────────────────────────────────
mortgageRoutes.delete('/mortgages/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query('DELETE FROM mortgage_payment WHERE mortgage_id = $1', [id]);
    await pool.query('DELETE FROM property_mortgage WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[mortgages] delete error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── RECORD A PAYMENT (KeyData "Mortgage Process") ───────────────────────────────
// POST /api/crm/mortgages/:id/payments  { dueDate, amount, paidDate, status, paymentMethod, reference }
// Advances the mortgage's next_payment_date by one month when a payment is recorded as paid.
mortgageRoutes.post('/mortgages/:id/payments', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const b = req.body || {};
  if (!b.amount || !b.dueDate) return res.status(400).json({ error: 'dueDate and amount are required' });
  try {
    const result = await pool.query(
      `INSERT INTO mortgage_payment
         (mortgage_id, due_date, amount, paid_date, status, payment_method, reference, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        id, toDate(b.dueDate), toInt(b.amount), toDate(b.paidDate),
        b.status || (b.paidDate ? 'paid' : 'scheduled'), b.paymentMethod || null,
        b.reference || null, b.notes || null, req.user?.id || null,
      ]
    );
    // When marked paid, roll the mortgage's next payment date forward by a month.
    if ((b.status || (b.paidDate ? 'paid' : '')) === 'paid') {
      await pool.query(
        `UPDATE property_mortgage
         SET next_payment_date = (COALESCE(next_payment_date, $2::timestamp) + INTERVAL '1 month'),
             updated_at = NOW()
         WHERE id = $1`,
        [id, toDate(b.dueDate)]
      );
    }
    res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    console.error('[mortgages] record payment error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── UPDATE A PAYMENT (mark paid / edit) ─────────────────────────────────────────
mortgageRoutes.put('/mortgages/payments/:paymentId', requireAgent, async (req: any, res: any) => {
  const paymentId = parseInt(req.params.paymentId);
  if (isNaN(paymentId)) return res.status(400).json({ error: 'Invalid paymentId' });
  const b = req.body || {};
  try {
    await pool.query(
      `UPDATE mortgage_payment SET
         due_date = COALESCE($2, due_date), amount = COALESCE($3, amount),
         paid_date = $4, status = COALESCE($5, status), payment_method = $6,
         reference = $7, notes = $8, updated_at = NOW()
       WHERE id = $1`,
      [
        paymentId, toDate(b.dueDate), toInt(b.amount), toDate(b.paidDate),
        b.status || null, b.paymentMethod || null, b.reference || null, b.notes || null,
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('[mortgages] update payment error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE A PAYMENT ────────────────────────────────────────────────────────────
mortgageRoutes.delete('/mortgages/payments/:paymentId', requireAgent, async (req: any, res: any) => {
  const paymentId = parseInt(req.params.paymentId);
  if (isNaN(paymentId)) return res.status(400).json({ error: 'Invalid paymentId' });
  try {
    await pool.query('DELETE FROM mortgage_payment WHERE id = $1', [paymentId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[mortgages] delete payment error', err);
    res.status(500).json({ error: err.message });
  }
});
