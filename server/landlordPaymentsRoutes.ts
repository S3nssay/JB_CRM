import { Router } from 'express';
import { pool } from './db';
import { emailService } from './emailService';

// KeyData parity: Landlord Payments workbench (the "Payments Due -> Landlord Payments -> Generate
// Statement -> commit -> pay -> email" cycle). Mirrors John Barclay Workflow #2
// (Rent Received -> Processed to Landlord Account). Singular physical tables; money in pence.

export const landlordPaymentsRoutes = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Not authorized' });
  next();
};

// Default VAT rate applied to management fees. John Barclay is not VAT-registered on
// letting fees (their statements show £0 VAT), so this defaults to 0. Override per-request.
const DEFAULT_FEE_VAT_RATE = 0;

const monthBounds = (from?: string, to?: string) => {
  const now = new Date();
  const start = from ? new Date(from) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = to ? new Date(to) : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  return { start, end };
};

const feePctOf = (managementFeeValue: any): number => {
  const n = parseFloat(managementFeeValue);
  return isNaN(n) ? 0 : n; // stored as a percent, e.g. "13"
};

// Aggregate a single landlord's figures for a period. Reused by the due-list and drill-in.
async function computeLandlordPeriod(landlordId: number, start: Date, end: Date) {
  // Managed properties for this landlord
  const propsRes = await pool.query(
    `SELECT p.id, COALESCE(p.address, p.address_line1, p.title) AS address,
            p.rent_amount, p.management_fee_type, p.management_fee_value
     FROM property p
     WHERE p.landlord_id = $1 AND p.is_managed = true
     ORDER BY address`,
    [landlordId]
  );
  const properties: any[] = [];
  let expectedRent = 0, collected = 0, fee = 0;
  for (const p of propsRes.rows) {
    const pct = feePctOf(p.management_fee_value);
    // Rent collected this period = paid rent invoices for the property
    const rc = await pool.query(
      `SELECT COALESCE(SUM(total_amount),0) AS c
       FROM invoice
       WHERE property_id = $1 AND invoice_type = 'rent' AND status = 'paid'
         AND paid_date BETWEEN $2 AND $3`,
      [p.id, start, end]
    );
    const propCollected = parseInt(rc.rows[0].c, 10) || 0;
    const propExpected = parseInt(p.rent_amount, 10) || 0;
    const propFee = Math.round(propCollected * pct / 100);
    expectedRent += propExpected; collected += propCollected; fee += propFee;
    properties.push({
      propertyId: p.id, address: p.address, rentAmount: propExpected,
      collected: propCollected, feePct: pct, fee: propFee,
    });
  }

  // One-off charges flagged for the next statement (pending, not yet consumed)
  const chRes = await pool.query(
    `SELECT id, description, amount_gross AS amount, property_id
     FROM recurring_landlord_charge
     WHERE landlord_id = $1 AND charge_kind = 'one_off'
       AND on_next_statement = true AND charge_status = 'pending' AND statement_id IS NULL`,
    [landlordId]
  );
  const charges = chRes.rows.map((r: any) => ({ id: r.id, description: r.description, amount: parseInt(r.amount, 10) || 0, propertyId: r.property_id }));
  const chargesTotal = charges.reduce((s: number, c: any) => s + c.amount, 0);

  // Repairs/maintenance charged to the landlord this period.
  // Source: property_transaction (category 'maintenance'), which is where the
  // Support Tickets "Charge landlord" action and ticket-completion actually write
  // the recharge (the work_order lineage is AI-only and never populated by staff).
  let repairsTotal = 0; let repairs: any[] = [];
  try {
    const rp = await pool.query(
      `SELECT pt.id, pt.description, pt.amount, pt.property_id, p.address AS property_address
       FROM property_transaction pt
       LEFT JOIN property p ON p.id = pt.property_id
       WHERE pt.landlord_id = $1
         AND pt.category = 'maintenance'
         AND COALESCE(pt.transaction_type, 'expense') <> 'income'
         AND pt.transaction_date BETWEEN $2 AND $3`,
      [landlordId, start, end]
    );
    repairs = rp.rows.map((r: any) => ({ id: r.id, description: r.description || 'Maintenance', amount: Math.abs(parseInt(r.amount, 10) || 0), propertyId: r.property_id }));
    repairsTotal = repairs.reduce((s: number, r: any) => s + r.amount, 0);
  } catch { /* property_transaction variance — treat as no repairs */ }

  // Balance brought forward = most recent prior unpaid statement's net (else 0)
  const bbfRes = await pool.query(
    `SELECT net_payable FROM landlord_statement
     WHERE landlord_id = $1 AND status <> 'paid'
     ORDER BY created_at DESC LIMIT 1`,
    [landlordId]
  );
  const bbf = bbfRes.rows.length ? (parseInt(bbfRes.rows[0].net_payable, 10) || 0) : 0;

  // Landlord + NRL tax status
  const llRes = await pool.query(
    `SELECT id, name, email, is_overseas, tax_percentage, tax_exemption_certificate_no,
            tax_exemption_end_date, bank_account_number, bank_sort_code, bank_account_holder_name
     FROM landlord WHERE id = $1`,
    [landlordId]
  );
  const ll = llRes.rows[0] || {};
  const vatOnFees = 0; // DEFAULT_FEE_VAT_RATE applied at generate time
  const preTax = collected - fee - vatOnFees - chargesTotal - repairsTotal;
  const hasExemption = !!ll.tax_exemption_certificate_no &&
    (!ll.tax_exemption_end_date || new Date(ll.tax_exemption_end_date) >= end);
  const taxRate = ll.is_overseas && !hasExemption ? (parseFloat(ll.tax_percentage) || 20) : 0;
  const tax = taxRate > 0 ? Math.max(0, Math.round(preTax * taxRate / 100)) : 0;
  const net = bbf + preTax - tax;

  return {
    landlord: {
      id: ll.id, name: ll.name, email: ll.email, isOverseas: !!ll.is_overseas,
      hasBankDetails: !!(ll.bank_account_number && ll.bank_sort_code),
      bankAccountNumber: ll.bank_account_number, bankSortCode: ll.bank_sort_code,
      bankAccountHolder: ll.bank_account_holder_name,
    },
    properties, charges, repairs,
    bbf, expectedRent, collected, fee, vatOnFees,
    chargesTotal, repairsTotal, taxRate, tax, net,
  };
}

// ─── PAYMENTS DUE LIST (KeyData "Landlord Payments To Make") ──────────────────────
// GET /api/crm/landlord-payments/due?from=&to=
landlordPaymentsRoutes.get('/landlord-payments/due', requireAgent, async (req: any, res: any) => {
  const { start, end } = monthBounds(req.query.from, req.query.to);
  try {
    const lls = await pool.query(
      `SELECT DISTINCT l.id FROM landlord l
       JOIN property p ON p.landlord_id = l.id AND p.is_managed = true`
    );
    const rows: any[] = [];
    for (const { id } of lls.rows) {
      const d = await computeLandlordPeriod(id, start, end);
      rows.push({
        landlordId: id, landlordName: d.landlord.name, hasBankDetails: d.landlord.hasBankDetails,
        propertyCount: d.properties.length, expectedRent: d.expectedRent, collected: d.collected,
        fee: d.fee, charges: d.chargesTotal, repairs: d.repairsTotal, tax: d.tax, bbf: d.bbf, net: d.net,
      });
    }
    rows.sort((a, b) => b.net - a.net);
    res.json({ period: { from: start, to: end }, landlords: rows });
  } catch (err: any) {
    console.error('[landlord-payments] due error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── DRILL-IN DETAIL (KeyData "Landlord Payments") ───────────────────────────────
// GET /api/crm/landlord-payments/:landlordId/detail?from=&to=
landlordPaymentsRoutes.get('/landlord-payments/:landlordId/detail', requireAgent, async (req: any, res: any) => {
  const landlordId = parseInt(req.params.landlordId);
  if (isNaN(landlordId)) return res.status(400).json({ error: 'Invalid landlordId' });
  const { start, end } = monthBounds(req.query.from, req.query.to);
  try {
    const d = await computeLandlordPeriod(landlordId, start, end);
    res.json({ period: { from: start, to: end }, ...d });
  } catch (err: any) {
    console.error('[landlord-payments] detail error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── GENERATE STATEMENT (KeyData "Generate Statement") ───────────────────────────
// POST /api/crm/landlord-payments/:landlordId/generate-statement { from, to, paymentMethod, feeVatRate? }
landlordPaymentsRoutes.post('/landlord-payments/:landlordId/generate-statement', requireAgent, async (req: any, res: any) => {
  const landlordId = parseInt(req.params.landlordId);
  if (isNaN(landlordId)) return res.status(400).json({ error: 'Invalid landlordId' });
  const b = req.body || {};
  const { start, end } = monthBounds(b.from, b.to);
  const feeVatRate = b.feeVatRate != null ? Number(b.feeVatRate) : DEFAULT_FEE_VAT_RATE;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const d = await computeLandlordPeriod(landlordId, start, end);
    const vatOnFees = Math.round(d.fee * feeVatRate / 100);
    const net = d.bbf + d.collected - d.fee - vatOnFees - d.chargesTotal - d.repairsTotal - d.tax;

    // Per-landlord statement number via statement_sequences (no unique constraint — lock the row)
    const cur = await client.query(
      `SELECT id, last_statement_number FROM statement_sequences WHERE landlord_id=$1 FOR UPDATE`, [landlordId]);
    let seq: number;
    if (cur.rows.length) {
      seq = cur.rows[0].last_statement_number + 1;
      await client.query(`UPDATE statement_sequences SET last_statement_number=$2, updated_at=NOW() WHERE id=$1`, [cur.rows[0].id, seq]);
    } else {
      seq = 1;
      await client.query(`INSERT INTO statement_sequences (landlord_id, last_statement_number, updated_at) VALUES ($1,1,NOW())`, [landlordId]);
    }
    const statementNumber = `${landlordId}_${seq}`;

    const stmtRes = await client.query(
      `INSERT INTO landlord_statement
        (landlord_id, property_id, statement_number, attention_needed,
         statement_period_start, statement_period_end, balance_brought_forward,
         total_rent_collected, management_fees, maintenance_deductions, other_deductions,
         vat_on_fees, tax_deducted, net_payable, payment_method, status)
       VALUES ($1,NULL,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'draft')
       RETURNING id`,
      [
        landlordId, statementNumber, d.collected === 0,
        start, end, d.bbf,
        d.collected, d.fee, d.repairsTotal, d.chargesTotal,
        vatOnFees, d.tax, net, b.paymentMethod || null,
      ]
    );
    const statementId = stmtRes.rows[0].id;

    // Line items
    const items: any[] = [];
    if (d.bbf !== 0) items.push({ t: 'adjustment', desc: 'Balance brought forward', amt: d.bbf, pid: null });
    for (const p of d.properties) {
      if (p.collected > 0) items.push({ t: 'rent_collected', desc: `Rent collected — ${p.address}`, amt: p.collected, pid: p.propertyId });
      if (p.fee > 0) items.push({ t: 'management_fee', desc: `Management fee (${p.feePct}%) — ${p.address}`, amt: -p.fee, pid: p.propertyId });
    }
    if (vatOnFees > 0) items.push({ t: 'management_fee', desc: `VAT on fees (${feeVatRate}%)`, amt: -vatOnFees, pid: null });
    for (const c of d.charges) items.push({ t: 'other_deduction', desc: c.description || 'Landlord charge', amt: -c.amount, pid: c.propertyId });
    for (const r of d.repairs) items.push({ t: 'maintenance', desc: `Repair — ${r.description || ''}`.trim(), amt: -r.amount, pid: r.propertyId });
    if (d.tax > 0) items.push({ t: 'other_deduction', desc: `NRL tax withheld (${d.taxRate}%)`, amt: -d.tax, pid: null });

    for (const it of items) {
      await client.query(
        `INSERT INTO statement_line_item (statement_id, property_id, line_type, description, amount, transaction_date)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [statementId, it.pid, it.t, it.desc, it.amt, end]
      );
    }

    // Consume one-off charges onto this statement
    if (d.charges.length) {
      await client.query(
        `UPDATE recurring_landlord_charge SET charge_status='on_statement', statement_id=$1, updated_at=NOW()
         WHERE id = ANY($2::int[])`,
        [statementId, d.charges.map((c: any) => c.id)]
      );
    }

    // NRL tax deduction record
    if (d.tax > 0) {
      await client.query(
        `INSERT INTO landlord_tax_deductions
          (landlord_id, statement_id, tax_period_start, tax_period_end, rent_collected, tax_rate, tax_deducted, net_paid_to_landlord, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [landlordId, statementId, start, end, d.collected, d.taxRate, d.tax, net, req.user?.id || null]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ statementId, statementNumber, netPayable: net, collected: d.collected, fee: d.fee, charges: d.chargesTotal, repairs: d.repairsTotal, tax: d.tax, bbf: d.bbf });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[landlord-payments] generate error', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── STATEMENT: fetch one with line items ────────────────────────────────────────
landlordPaymentsRoutes.get('/landlord-payments/statements/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const s = await pool.query(
      `SELECT s.*, l.name AS landlord_name, l.email AS landlord_email
       FROM landlord_statement s LEFT JOIN landlord l ON l.id = s.landlord_id WHERE s.id = $1`, [id]);
    if (!s.rows.length) return res.status(404).json({ error: 'Statement not found' });
    const items = await pool.query(
      `SELECT li.*, p.address AS property_address FROM statement_line_item li
       LEFT JOIN property p ON p.id = li.property_id WHERE li.statement_id = $1 ORDER BY li.id`, [id]);
    res.json({ statement: s.rows[0], lineItems: items.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── COMMIT TO LEDGERS (KeyData "commit this statement to the accounting ledgers?") ─
landlordPaymentsRoutes.post('/landlord-payments/statements/:id/commit', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const s = await client.query(`SELECT * FROM landlord_statement WHERE id = $1`, [id]);
    if (!s.rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Statement not found' }); }
    if (s.rows[0].committed_to_ledger) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Already committed' }); }
    const st = s.rows[0];

    // Mark rent invoices in the period reconciled for this landlord's properties
    await client.query(
      `UPDATE invoice SET status = 'reconciled', updated_at = NOW()
       WHERE invoice_type = 'rent' AND status = 'paid'
         AND paid_date BETWEEN $1 AND $2
         AND property_id IN (SELECT id FROM property WHERE landlord_id = $3 AND is_managed = true)`,
      [st.statement_period_start, st.statement_period_end, st.landlord_id]
    ).catch(() => { /* 'reconciled' not a valid status in some deployments — non-fatal */ });

    // Mark one-off charges processed
    await client.query(
      `UPDATE recurring_landlord_charge SET charge_status = 'processed', updated_at = NOW()
       WHERE statement_id = $1 AND charge_status = 'on_statement'`, [id]);

    await client.query(
      `UPDATE landlord_statement SET committed_to_ledger = true, status = 'committed', updated_at = NOW() WHERE id = $1`, [id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[landlord-payments] commit error', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ─── EMAIL STATEMENT TO LANDLORD (KeyData "Key-Mail") ────────────────────────────
landlordPaymentsRoutes.post('/landlord-payments/statements/:id/send', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const s = await pool.query(
      `SELECT s.*, l.name AS landlord_name, l.email AS landlord_email
       FROM landlord_statement s LEFT JOIN landlord l ON l.id = s.landlord_id WHERE s.id = $1`, [id]);
    if (!s.rows.length) return res.status(404).json({ error: 'Statement not found' });
    const st = s.rows[0];
    const to = req.body?.to || st.landlord_email;
    if (!to) return res.status(400).json({ error: 'No landlord email on file' });
    const items = await pool.query(`SELECT description, amount FROM statement_line_item WHERE statement_id=$1 ORDER BY id`, [id]);
    const gbp = (p: number) => `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const rowsHtml = items.rows.map((r: any) => `<tr><td style="padding:4px 8px">${r.description}</td><td style="padding:4px 8px;text-align:right">${gbp(r.amount)}</td></tr>`).join('');
    const html = `<div style="font-family:Arial,sans-serif;color:#222">
      <h2 style="color:#791E75">Landlord Statement ${st.statement_number || ''}</h2>
      <p>Dear ${st.landlord_name || 'Landlord'},</p>
      <p>Please find your statement of account below.</p>
      <table style="border-collapse:collapse;width:100%;max-width:520px">${rowsHtml}
        <tr><td style="padding:8px;border-top:2px solid #791E75;font-weight:bold">Net paid to you</td>
        <td style="padding:8px;border-top:2px solid #791E75;text-align:right;font-weight:bold">${gbp(st.net_payable)}</td></tr>
      </table>
      <p style="margin-top:16px">Kind regards,<br/>John Barclay Estate &amp; Management</p></div>`;
    try {
      await emailService.sendEmail(to, `Statement of accounts ${st.statement_number || ''}`.trim(), html);
    } catch (e: any) {
      console.error('[landlord-payments] email send failed', e?.message);
      return res.status(502).json({ error: 'Email service failed: ' + (e?.message || 'unknown') });
    }
    await pool.query(`UPDATE landlord_statement SET status = CASE WHEN status='paid' THEN 'paid' ELSE 'sent' END, sent_at = NOW(), updated_at = NOW() WHERE id = $1`, [id]);
    res.json({ success: true, to });
  } catch (err: any) {
    console.error('[landlord-payments] send error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── MARK PAID (bank transfer to landlord) ───────────────────────────────────────
landlordPaymentsRoutes.post('/landlord-payments/statements/:id/pay', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const b = req.body || {};
  try {
    await pool.query(
      `UPDATE landlord_statement SET status='paid', paid_at = COALESCE($2, NOW()),
         payment_method = COALESCE($3, payment_method), payment_reference = $4, updated_at = NOW()
       WHERE id = $1`,
      [id, b.paidDate ? new Date(b.paidDate) : null, b.paymentMethod || null, b.reference || null]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ONE-OFF LANDLORD CHARGE (KeyData "Record Landlord Invoice", process on next statement) ─
// POST /api/crm/landlord-charges  { landlordId, propertyId?, description, amountNet, amountVat?, chargeDate, onNextStatement }
landlordPaymentsRoutes.post('/landlord-charges', requireAgent, async (req: any, res: any) => {
  const b = req.body || {};
  if (!b.landlordId || !b.description || b.amountNet == null) {
    return res.status(400).json({ error: 'landlordId, description and amountNet are required' });
  }
  const net = Math.round(Number(b.amountNet));
  const vat = b.amountVat != null ? Math.round(Number(b.amountVat)) : 0;
  const gross = net + vat;
  try {
    const r = await pool.query(
      `INSERT INTO recurring_landlord_charge
        (landlord_id, property_id, description, frequency, amount_net, amount_vat, amount_gross,
         next_due_date, is_active, category, charge_kind, on_next_statement, charge_status, created_by)
       VALUES ($1,$2,$3,'one_off',$4,$5,$6,$7,false,$8,'one_off',$9,'pending',$10)
       RETURNING id`,
      [
        parseInt(b.landlordId), b.propertyId ? parseInt(b.propertyId) : null, b.description,
        net, vat, gross, b.chargeDate ? new Date(b.chargeDate) : new Date(),
        b.category || 'other', b.onNextStatement !== false, req.user?.id || null,
      ]
    );
    res.status(201).json({ id: r.rows[0].id, amountGross: gross });
  } catch (err: any) {
    console.error('[landlord-charges] create error', err);
    res.status(500).json({ error: err.message });
  }
});

// List pending one-off charges for a landlord (for the drill-in / management)
landlordPaymentsRoutes.get('/landlord-charges/:landlordId', requireAgent, async (req: any, res: any) => {
  const landlordId = parseInt(req.params.landlordId);
  if (isNaN(landlordId)) return res.status(400).json({ error: 'Invalid landlordId' });
  try {
    const r = await pool.query(
      `SELECT rc.id, rc.description, rc.amount_net AS "amountNet", rc.amount_vat AS "amountVat",
              rc.amount_gross AS "amountGross", rc.next_due_date AS "chargeDate", rc.charge_status AS "status",
              rc.on_next_statement AS "onNextStatement", rc.statement_id AS "statementId",
              p.address AS "propertyAddress"
       FROM recurring_landlord_charge rc
       LEFT JOIN property p ON p.id = rc.property_id
       WHERE rc.landlord_id = $1 AND rc.charge_kind = 'one_off'
       ORDER BY rc.created_at DESC`,
      [landlordId]
    );
    res.json(r.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a pending one-off charge (only if not yet on a statement)
landlordPaymentsRoutes.delete('/landlord-charges/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const r = await pool.query(`DELETE FROM recurring_landlord_charge WHERE id=$1 AND charge_kind='one_off' AND charge_status='pending' RETURNING id`, [id]);
    if (!r.rows.length) return res.status(400).json({ error: 'Charge not found or already on a statement' });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
