import { Router } from 'express';
import { pool } from './db';

// KeyData parity: Block / Service-Charge Management
// Mirrors KeyData "Admin Tools → Block Management" and the "Block Management Company"
// concept. Manages blocks of flats: freeholder, leaseholder units, service-charge
// budgets and demands, ground rent and reserve/sinking fund.

export const blockManagementRoutes = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Not authorized' });
  next();
};

const toDate = (v: any) => (v ? new Date(v) : null);
const toInt = (v: any) => (v === null || v === undefined || v === '' ? null : parseInt(v));

// ─── LIST BLOCKS ─────────────────────────────────────────────────────────────────
// GET /api/crm/blocks?status=
blockManagementRoutes.get('/blocks', requireAgent, async (req: any, res: any) => {
  const { status } = req.query as Record<string, string>;
  try {
    const params: any[] = [];
    let where = '';
    if (status) { params.push(status); where = `WHERE b.status = $1`; }
    const result = await pool.query(
      `SELECT b.id, b.name, b.address_line1 AS "addressLine1", b.address_line2 AS "addressLine2",
              b.city, b.postcode, b.freeholder_name AS "freeholderName",
              b.freeholder_contact AS "freeholderContact", b.managing_agent_name AS "managingAgentName",
              b.number_of_units AS "numberOfUnits", b.service_charge_year_end AS "serviceChargeYearEnd",
              b.ground_rent_annual_total AS "groundRentAnnualTotal", b.reserve_fund_balance AS "reserveFundBalance",
              b.insurance_policy_ref AS "insurancePolicyRef", b.insurance_expiry AS "insuranceExpiry",
              b.status, b.notes,
              (SELECT COUNT(*) FROM block_unit u WHERE u.block_id = b.id) AS "unitCount",
              (SELECT COALESCE(SUM(d.amount - d.amount_paid), 0) FROM service_charge_demand d
                 WHERE d.block_id = b.id AND d.status IN ('issued','part_paid','overdue')) AS "outstandingDemands"
       FROM block b
       ${where}
       ORDER BY b.name ASC`,
      params
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('[blocks] list error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── BLOCK DETAIL (with units, budgets, demand summary) ──────────────────────────
blockManagementRoutes.get('/blocks/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    const block = await pool.query(
      `SELECT b.id, b.name, b.address_line1 AS "addressLine1", b.address_line2 AS "addressLine2",
              b.city, b.postcode, b.freeholder_name AS "freeholderName",
              b.freeholder_contact AS "freeholderContact", b.managing_agent_name AS "managingAgentName",
              b.number_of_units AS "numberOfUnits", b.service_charge_year_end AS "serviceChargeYearEnd",
              b.ground_rent_annual_total AS "groundRentAnnualTotal", b.reserve_fund_balance AS "reserveFundBalance",
              b.insurance_policy_ref AS "insurancePolicyRef", b.insurance_expiry AS "insuranceExpiry",
              b.status, b.notes
       FROM block b WHERE b.id = $1`,
      [id]
    );
    if (!block.rows.length) return res.status(404).json({ error: 'Block not found' });

    const units = await pool.query(
      `SELECT u.id, u.block_id AS "blockId", u.property_id AS "propertyId",
              u.unit_reference AS "unitReference", u.leaseholder_name AS "leaseholderName",
              u.leaseholder_contact AS "leaseholderContact", u.apportionment_bps AS "apportionmentBps",
              u.ground_rent_annual AS "groundRentAnnual", u.lease_end_date AS "leaseEndDate",
              p.address AS "propertyAddress"
       FROM block_unit u
       LEFT JOIN property p ON p.id = u.property_id
       WHERE u.block_id = $1 ORDER BY u.unit_reference ASC`,
      [id]
    );
    const budgets = await pool.query(
      `SELECT id, block_id AS "blockId", year_label AS "yearLabel", period_start AS "periodStart",
              period_end AS "periodEnd", total_budget AS "totalBudget",
              reserve_contribution AS "reserveContribution", status, notes
       FROM service_charge_budget WHERE block_id = $1 ORDER BY period_start DESC NULLS LAST, id DESC`,
      [id]
    );
    const demands = await pool.query(
      `SELECT d.id, d.block_id AS "blockId", d.unit_id AS "unitId", d.budget_id AS "budgetId",
              d.demand_type AS "demandType", d.description, d.demand_date AS "demandDate",
              d.due_date AS "dueDate", d.amount, d.amount_paid AS "amountPaid",
              d.paid_date AS "paidDate", d.status, d.notes,
              u.unit_reference AS "unitReference", u.leaseholder_name AS "leaseholderName"
       FROM service_charge_demand d
       LEFT JOIN block_unit u ON u.id = d.unit_id
       WHERE d.block_id = $1 ORDER BY d.demand_date DESC`,
      [id]
    );

    res.json({ ...block.rows[0], units: units.rows, budgets: budgets.rows, demands: demands.rows });
  } catch (err: any) {
    console.error('[blocks] detail error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── CREATE / UPDATE / DELETE BLOCK ──────────────────────────────────────────────
blockManagementRoutes.post('/blocks', requireAgent, async (req: any, res: any) => {
  const b = req.body || {};
  if (!b.name) return res.status(400).json({ error: 'name is required' });
  try {
    const result = await pool.query(
      `INSERT INTO block
         (name, address_line1, address_line2, city, postcode, freeholder_name, freeholder_contact,
          managing_agent_name, number_of_units, service_charge_year_end, ground_rent_annual_total,
          reserve_fund_balance, insurance_policy_ref, insurance_expiry, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        b.name, b.addressLine1 || null, b.addressLine2 || null, b.city || null, b.postcode || null,
        b.freeholderName || null, b.freeholderContact || null, b.managingAgentName || null,
        toInt(b.numberOfUnits) || 0, b.serviceChargeYearEnd || null, toInt(b.groundRentAnnualTotal) || 0,
        toInt(b.reserveFundBalance) || 0, b.insurancePolicyRef || null, toDate(b.insuranceExpiry),
        b.status || 'active', b.notes || null, req.user?.id || null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    console.error('[blocks] create error', err);
    res.status(500).json({ error: err.message });
  }
});

blockManagementRoutes.put('/blocks/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  const b = req.body || {};
  try {
    await pool.query(
      `UPDATE block SET
         name = COALESCE($2, name), address_line1 = $3, address_line2 = $4, city = $5, postcode = $6,
         freeholder_name = $7, freeholder_contact = $8, managing_agent_name = $9,
         number_of_units = COALESCE($10, number_of_units), service_charge_year_end = $11,
         ground_rent_annual_total = COALESCE($12, ground_rent_annual_total),
         reserve_fund_balance = COALESCE($13, reserve_fund_balance),
         insurance_policy_ref = $14, insurance_expiry = $15, status = COALESCE($16, status),
         notes = $17, updated_at = NOW()
       WHERE id = $1`,
      [
        id, b.name || null, b.addressLine1 || null, b.addressLine2 || null, b.city || null, b.postcode || null,
        b.freeholderName || null, b.freeholderContact || null, b.managingAgentName || null,
        toInt(b.numberOfUnits), b.serviceChargeYearEnd || null, toInt(b.groundRentAnnualTotal),
        toInt(b.reserveFundBalance), b.insurancePolicyRef || null, toDate(b.insuranceExpiry),
        b.status || null, b.notes || null,
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('[blocks] update error', err);
    res.status(500).json({ error: err.message });
  }
});

blockManagementRoutes.delete('/blocks/:id', requireAgent, async (req: any, res: any) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await pool.query('DELETE FROM service_charge_demand WHERE block_id = $1', [id]);
    await pool.query('DELETE FROM service_charge_budget WHERE block_id = $1', [id]);
    await pool.query('DELETE FROM block_unit WHERE block_id = $1', [id]);
    await pool.query('DELETE FROM block WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[blocks] delete error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── UNITS ───────────────────────────────────────────────────────────────────────
blockManagementRoutes.post('/blocks/:id/units', requireAgent, async (req: any, res: any) => {
  const blockId = parseInt(req.params.id);
  if (isNaN(blockId)) return res.status(400).json({ error: 'Invalid block id' });
  const b = req.body || {};
  if (!b.unitReference) return res.status(400).json({ error: 'unitReference is required' });
  try {
    const result = await pool.query(
      `INSERT INTO block_unit
         (block_id, property_id, unit_reference, leaseholder_name, leaseholder_contact,
          apportionment_bps, ground_rent_annual, lease_end_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        blockId, toInt(b.propertyId), b.unitReference, b.leaseholderName || null,
        b.leaseholderContact || null, toInt(b.apportionmentBps), toInt(b.groundRentAnnual) || 0,
        toDate(b.leaseEndDate),
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    console.error('[blocks] create unit error', err);
    res.status(500).json({ error: err.message });
  }
});

blockManagementRoutes.put('/blocks/units/:unitId', requireAgent, async (req: any, res: any) => {
  const unitId = parseInt(req.params.unitId);
  if (isNaN(unitId)) return res.status(400).json({ error: 'Invalid unit id' });
  const b = req.body || {};
  try {
    await pool.query(
      `UPDATE block_unit SET
         property_id = $2, unit_reference = COALESCE($3, unit_reference), leaseholder_name = $4,
         leaseholder_contact = $5, apportionment_bps = $6, ground_rent_annual = COALESCE($7, ground_rent_annual),
         lease_end_date = $8, updated_at = NOW()
       WHERE id = $1`,
      [
        unitId, toInt(b.propertyId), b.unitReference || null, b.leaseholderName || null,
        b.leaseholderContact || null, toInt(b.apportionmentBps), toInt(b.groundRentAnnual),
        toDate(b.leaseEndDate),
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('[blocks] update unit error', err);
    res.status(500).json({ error: err.message });
  }
});

blockManagementRoutes.delete('/blocks/units/:unitId', requireAgent, async (req: any, res: any) => {
  const unitId = parseInt(req.params.unitId);
  if (isNaN(unitId)) return res.status(400).json({ error: 'Invalid unit id' });
  try {
    await pool.query('DELETE FROM block_unit WHERE id = $1', [unitId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[blocks] delete unit error', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── BUDGETS ───────────────────────────────────────────────────────────────────────
blockManagementRoutes.post('/blocks/:id/budgets', requireAgent, async (req: any, res: any) => {
  const blockId = parseInt(req.params.id);
  if (isNaN(blockId)) return res.status(400).json({ error: 'Invalid block id' });
  const b = req.body || {};
  if (!b.yearLabel) return res.status(400).json({ error: 'yearLabel is required' });
  try {
    const result = await pool.query(
      `INSERT INTO service_charge_budget
         (block_id, year_label, period_start, period_end, total_budget, reserve_contribution, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        blockId, b.yearLabel, toDate(b.periodStart), toDate(b.periodEnd), toInt(b.totalBudget) || 0,
        toInt(b.reserveContribution) || 0, b.status || 'draft', b.notes || null, req.user?.id || null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    console.error('[blocks] create budget error', err);
    res.status(500).json({ error: err.message });
  }
});

blockManagementRoutes.put('/blocks/budgets/:budgetId', requireAgent, async (req: any, res: any) => {
  const budgetId = parseInt(req.params.budgetId);
  if (isNaN(budgetId)) return res.status(400).json({ error: 'Invalid budget id' });
  const b = req.body || {};
  try {
    await pool.query(
      `UPDATE service_charge_budget SET
         year_label = COALESCE($2, year_label), period_start = $3, period_end = $4,
         total_budget = COALESCE($5, total_budget), reserve_contribution = COALESCE($6, reserve_contribution),
         status = COALESCE($7, status), notes = $8, updated_at = NOW()
       WHERE id = $1`,
      [budgetId, b.yearLabel || null, toDate(b.periodStart), toDate(b.periodEnd),
       toInt(b.totalBudget), toInt(b.reserveContribution), b.status || null, b.notes || null]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('[blocks] update budget error', err);
    res.status(500).json({ error: err.message });
  }
});

blockManagementRoutes.delete('/blocks/budgets/:budgetId', requireAgent, async (req: any, res: any) => {
  const budgetId = parseInt(req.params.budgetId);
  if (isNaN(budgetId)) return res.status(400).json({ error: 'Invalid budget id' });
  try {
    await pool.query('DELETE FROM service_charge_budget WHERE id = $1', [budgetId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DEMANDS ─────────────────────────────────────────────────────────────────────
blockManagementRoutes.post('/blocks/:id/demands', requireAgent, async (req: any, res: any) => {
  const blockId = parseInt(req.params.id);
  if (isNaN(blockId)) return res.status(400).json({ error: 'Invalid block id' });
  const b = req.body || {};
  if (!b.amount || !b.demandDate) return res.status(400).json({ error: 'amount and demandDate are required' });
  try {
    const result = await pool.query(
      `INSERT INTO service_charge_demand
         (block_id, unit_id, budget_id, demand_type, description, demand_date, due_date,
          amount, amount_paid, paid_date, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [
        blockId, toInt(b.unitId), toInt(b.budgetId), b.demandType || 'service_charge',
        b.description || null, toDate(b.demandDate), toDate(b.dueDate), toInt(b.amount),
        toInt(b.amountPaid) || 0, toDate(b.paidDate), b.status || 'issued', b.notes || null,
        req.user?.id || null,
      ]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (err: any) {
    console.error('[blocks] create demand error', err);
    res.status(500).json({ error: err.message });
  }
});

// Bulk-issue a demand across all units, split by apportionment share.
// POST /api/crm/blocks/:id/demands/issue-all  { budgetId?, demandType, description, demandDate, dueDate, totalAmount }
blockManagementRoutes.post('/blocks/:id/demands/issue-all', requireAgent, async (req: any, res: any) => {
  const blockId = parseInt(req.params.id);
  if (isNaN(blockId)) return res.status(400).json({ error: 'Invalid block id' });
  const b = req.body || {};
  const total = toInt(b.totalAmount);
  if (!total || !b.demandDate) return res.status(400).json({ error: 'totalAmount and demandDate are required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const unitsRes = await client.query(
      `SELECT id, apportionment_bps FROM block_unit WHERE block_id = $1`, [blockId]
    );
    const units = unitsRes.rows;
    if (!units.length) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Block has no units to demand from' }); }

    const totalBps = units.reduce((s: number, u: any) => s + (u.apportionment_bps || 0), 0);
    let created = 0;
    for (const u of units) {
      // Split by apportionment where provided; otherwise split equally.
      const share = totalBps > 0
        ? Math.round(total * ((u.apportionment_bps || 0) / totalBps))
        : Math.round(total / units.length);
      if (share <= 0) continue;
      await client.query(
        `INSERT INTO service_charge_demand
           (block_id, unit_id, budget_id, demand_type, description, demand_date, due_date, amount, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'issued',$9)`,
        [blockId, u.id, toInt(b.budgetId), b.demandType || 'service_charge', b.description || null,
         toDate(b.demandDate), toDate(b.dueDate), share, req.user?.id || null]
      );
      created++;
    }
    await client.query('COMMIT');
    res.status(201).json({ created });
  } catch (err: any) {
    await client.query('ROLLBACK');
    console.error('[blocks] issue-all error', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

blockManagementRoutes.put('/blocks/demands/:demandId', requireAgent, async (req: any, res: any) => {
  const demandId = parseInt(req.params.demandId);
  if (isNaN(demandId)) return res.status(400).json({ error: 'Invalid demand id' });
  const b = req.body || {};
  try {
    await pool.query(
      `UPDATE service_charge_demand SET
         unit_id = $2, budget_id = $3, demand_type = COALESCE($4, demand_type), description = $5,
         demand_date = COALESCE($6, demand_date), due_date = $7, amount = COALESCE($8, amount),
         amount_paid = COALESCE($9, amount_paid), paid_date = $10, status = COALESCE($11, status),
         notes = $12, updated_at = NOW()
       WHERE id = $1`,
      [
        demandId, toInt(b.unitId), toInt(b.budgetId), b.demandType || null, b.description || null,
        toDate(b.demandDate), toDate(b.dueDate), toInt(b.amount), toInt(b.amountPaid),
        toDate(b.paidDate), b.status || null, b.notes || null,
      ]
    );
    res.json({ success: true });
  } catch (err: any) {
    console.error('[blocks] update demand error', err);
    res.status(500).json({ error: err.message });
  }
});

// Record a payment against a demand (updates amount_paid + status).
blockManagementRoutes.post('/blocks/demands/:demandId/pay', requireAgent, async (req: any, res: any) => {
  const demandId = parseInt(req.params.demandId);
  if (isNaN(demandId)) return res.status(400).json({ error: 'Invalid demand id' });
  const b = req.body || {};
  const payment = toInt(b.amount);
  if (!payment) return res.status(400).json({ error: 'amount is required' });
  try {
    const cur = await pool.query('SELECT amount, amount_paid FROM service_charge_demand WHERE id = $1', [demandId]);
    if (!cur.rows.length) return res.status(404).json({ error: 'Demand not found' });
    const newPaid = (cur.rows[0].amount_paid || 0) + payment;
    const status = newPaid >= cur.rows[0].amount ? 'paid' : 'part_paid';
    await pool.query(
      `UPDATE service_charge_demand SET amount_paid = $2, status = $3,
         paid_date = CASE WHEN $3 = 'paid' THEN COALESCE($4, NOW()) ELSE paid_date END,
         updated_at = NOW() WHERE id = $1`,
      [demandId, newPaid, status, toDate(b.paidDate)]
    );
    res.json({ success: true, amountPaid: newPaid, status });
  } catch (err: any) {
    console.error('[blocks] pay demand error', err);
    res.status(500).json({ error: err.message });
  }
});

blockManagementRoutes.delete('/blocks/demands/:demandId', requireAgent, async (req: any, res: any) => {
  const demandId = parseInt(req.params.demandId);
  if (isNaN(demandId)) return res.status(400).json({ error: 'Invalid demand id' });
  try {
    await pool.query('DELETE FROM service_charge_demand WHERE id = $1', [demandId]);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
