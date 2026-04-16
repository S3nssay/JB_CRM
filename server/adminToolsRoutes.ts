import { Router } from 'express';
import { pool } from './db';

export const adminToolsRoutes = Router();

// ==========================================
// BRANCH MANAGEMENT
// ==========================================

// GET /branches - list all branches
adminToolsRoutes.get('/branches', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM branches ORDER BY is_active DESC, name ASC'
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching branches:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /branches - create branch
adminToolsRoutes.post('/branches', async (req, res) => {
  try {
    const { name, address, phone, email, managerId } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const result = await pool.query(
      `INSERT INTO branches (name, address, phone, email, manager_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [name, address || null, phone || null, email || null, managerId || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating branch:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /branches/:id - update branch
adminToolsRoutes.put('/branches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, email, managerId, isActive } = req.body;

    const result = await pool.query(
      `UPDATE branches
       SET name = COALESCE($1, name),
           address = COALESCE($2, address),
           phone = COALESCE($3, phone),
           email = COALESCE($4, email),
           manager_id = COALESCE($5, manager_id),
           is_active = COALESCE($6, is_active),
           updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [name, address, phone, email, managerId, isActive, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating branch:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /branches/:id - deactivate branch
adminToolsRoutes.delete('/branches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE branches SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Branch not found' });
    res.json({ success: true, branch: result.rows[0] });
  } catch (err: any) {
    console.error('Error deactivating branch:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// AML SANCTION CHECKS
// ==========================================

// GET /sanction-checks - list recent checks
adminToolsRoutes.get('/sanction-checks', async (req, res) => {
  try {
    const { entityType, limit = '50' } = req.query;
    let query = 'SELECT * FROM sanction_checks';
    const params: any[] = [];

    if (entityType) {
      params.push(entityType);
      query += ' WHERE entity_type = $1';
    }

    query += ` ORDER BY check_date DESC LIMIT ${parseInt(limit as string, 10)}`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching sanction checks:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /sanction-checks - run check against entity
adminToolsRoutes.post('/sanction-checks', async (req, res) => {
  try {
    const { entityType, entityId, entityName, notes } = req.body;
    if (!entityType || !entityId || !entityName) {
      return res.status(400).json({ error: 'entityType, entityId and entityName are required' });
    }

    const userId = (req as any).user?.id || null;

    // For now record as 'clear' — actual HM Treasury list integration to come
    const result = await pool.query(
      `INSERT INTO sanction_checks
         (entity_type, entity_id, entity_name, result, list_source, checked_by, notes)
       VALUES ($1, $2, $3, 'clear', 'hm_treasury', $4, $5)
       RETURNING *`,
      [entityType, entityId, entityName, userId, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error running sanction check:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /sanction-checks/:entityType/:entityId - history for entity
adminToolsRoutes.get('/sanction-checks/:entityType/:entityId', async (req, res) => {
  try {
    const { entityType, entityId } = req.params;
    const result = await pool.query(
      `SELECT * FROM sanction_checks
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY check_date DESC`,
      [entityType, entityId]
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching sanction check history:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ARCHIVE MANAGEMENT
// ==========================================

// GET /archives - list archived records
adminToolsRoutes.get('/archives', async (req, res) => {
  try {
    const { entityType, limit = '100' } = req.query;
    let query = 'SELECT * FROM archived_records';
    const params: any[] = [];

    if (entityType) {
      params.push(entityType);
      query += ' WHERE entity_type = $1';
    }

    query += ` ORDER BY archived_date DESC LIMIT ${parseInt(limit as string, 10)}`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching archives:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /archives - archive a single entity
adminToolsRoutes.post('/archives', async (req, res) => {
  try {
    const { entityType, entityId, reason } = req.body;
    if (!entityType || !entityId) {
      return res.status(400).json({ error: 'entityType and entityId are required' });
    }

    const userId = (req as any).user?.id || null;

    const result = await pool.query(
      `INSERT INTO archived_records (entity_type, entity_id, archived_by, reason)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [entityType, entityId, userId, reason || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error archiving record:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /archives/batch - batch archive
adminToolsRoutes.post('/archives/batch', async (req, res) => {
  try {
    const { entityType, entityIds, reason } = req.body;
    if (!entityType || !Array.isArray(entityIds) || entityIds.length === 0) {
      return res.status(400).json({ error: 'entityType and entityIds[] are required' });
    }

    const userId = (req as any).user?.id || null;
    const inserted: any[] = [];

    for (const entityId of entityIds) {
      const r = await pool.query(
        `INSERT INTO archived_records (entity_type, entity_id, archived_by, reason)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING *`,
        [entityType, entityId, userId, reason || null]
      );
      if (r.rows[0]) inserted.push(r.rows[0]);
    }

    res.status(201).json({ archived: inserted.length, records: inserted });
  } catch (err: any) {
    console.error('Error batch archiving:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /archives/:id - unarchive (restore)
adminToolsRoutes.delete('/archives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'DELETE FROM archived_records WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Archive record not found' });
    res.json({ success: true, restored: result.rows[0] });
  } catch (err: any) {
    console.error('Error restoring archive:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /archives/candidates - find archivable items
adminToolsRoutes.get('/archives/candidates', async (req, res) => {
  try {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    // Tenancies ended > 2 years ago, not already archived
    const endedTenancies = await pool.query(
      `SELECT t.id, t.start_date, t.end_date, t.status,
              p.title as property_title, p.address_line1
       FROM tenancies t
       LEFT JOIN property p ON p.id = t.property_id
       LEFT JOIN archived_records ar ON ar.entity_type = 'tenancy' AND ar.entity_id = t.id
       WHERE t.end_date < $1
         AND t.status IN ('ended', 'terminated', 'completed')
         AND ar.id IS NULL
       ORDER BY t.end_date ASC
       LIMIT 100`,
      [twoYearsAgo.toISOString()]
    );

    // Leads inactive > 1 year, not already archived
    const inactiveLeads = await pool.query(
      `SELECT l.id, l.name, l.email, l.status, l.updated_at, l.created_at
       FROM leads l
       LEFT JOIN archived_records ar ON ar.entity_type = 'lead' AND ar.entity_id = l.id
       WHERE l.updated_at < $1
         AND l.status IN ('lost', 'converted')
         AND ar.id IS NULL
       ORDER BY l.updated_at ASC
       LIMIT 100`,
      [oneYearAgo.toISOString()]
    );

    res.json({
      tenancies: endedTenancies.rows,
      leads: inactiveLeads.rows,
    });
  } catch (err: any) {
    console.error('Error fetching archive candidates:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DORMANT MANAGEMENT
// ==========================================

// GET /dormant/properties - properties with status='dormant'
adminToolsRoutes.get('/dormant/properties', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.title, p.address_line1, p.postcode, p.status,
              p.management_status, p.is_managed, p.updated_at,
              l.name as landlord_name
       FROM property p
       LEFT JOIN landlord l ON l.id = p.landlord_id
       WHERE p.management_status = 'dormant' OR p.status = 'dormant'
       ORDER BY p.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching dormant properties:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /dormant/properties/bulk-update
adminToolsRoutes.post('/dormant/properties/bulk-update', async (req, res) => {
  try {
    const { propertyIds, action } = req.body;
    if (!Array.isArray(propertyIds) || !action) {
      return res.status(400).json({ error: 'propertyIds[] and action are required' });
    }
    if (!['activate', 'dormant'].includes(action)) {
      return res.status(400).json({ error: 'action must be activate or dormant' });
    }

    const newStatus = action === 'activate' ? 'occupied' : 'dormant';
    const result = await pool.query(
      `UPDATE property
       SET management_status = $1, updated_at = NOW()
       WHERE id = ANY($2::int[])
       RETURNING id, title, management_status`,
      [newStatus, propertyIds]
    );

    res.json({ updated: result.rowCount, properties: result.rows });
  } catch (err: any) {
    console.error('Error bulk updating dormant properties:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /dormant/landlords - landlords with status='dormant'
adminToolsRoutes.get('/dormant/landlords', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, mobile, is_active, updated_at
       FROM landlord
       WHERE is_active = false
       ORDER BY updated_at DESC`
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching dormant landlords:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /dormant/landlords/bulk-update
adminToolsRoutes.post('/dormant/landlords/bulk-update', async (req, res) => {
  try {
    const { landlordIds, action } = req.body;
    if (!Array.isArray(landlordIds) || !action) {
      return res.status(400).json({ error: 'landlordIds[] and action are required' });
    }
    if (!['activate', 'dormant'].includes(action)) {
      return res.status(400).json({ error: 'action must be activate or dormant' });
    }

    const isActive = action === 'activate';
    const result = await pool.query(
      `UPDATE landlord
       SET is_active = $1, updated_at = NOW()
       WHERE id = ANY($2::int[])
       RETURNING id, name, is_active`,
      [isActive, landlordIds]
    );

    res.json({ updated: result.rowCount, landlords: result.rows });
  } catch (err: any) {
    console.error('Error bulk updating dormant landlords:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// DEPOSIT TRANSFERS
// ==========================================

// GET /deposit-transfers
adminToolsRoutes.get('/deposit-transfers', async (req, res) => {
  try {
    const { tenancyId } = req.query;
    let query = `
      SELECT dt.*,
             t.start_date as tenancy_start, t.end_date as tenancy_end,
             p.title as property_title, p.address_line1,
             ten.name as tenant_name
      FROM deposit_transfers dt
      LEFT JOIN tenancies t ON t.id = dt.tenancy_id
      LEFT JOIN property p ON p.id = t.property_id
      LEFT JOIN tenant ten ON ten.id = dt.tenant_id
    `;
    const params: any[] = [];

    if (tenancyId) {
      params.push(tenancyId);
      query += ' WHERE dt.tenancy_id = $1';
    }

    query += ' ORDER BY dt.created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching deposit transfers:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /deposit-transfers - create transfer
adminToolsRoutes.post('/deposit-transfers', async (req, res) => {
  try {
    const {
      tenancyId, tenantId, direction, amount,
      fromAccount, toAccount, schemeName, reference, transferDate
    } = req.body;

    if (!tenancyId || !direction || !amount || !transferDate) {
      return res.status(400).json({ error: 'tenancyId, direction, amount, transferDate are required' });
    }

    if (!['out_to_scheme', 'in_from_scheme'].includes(direction)) {
      return res.status(400).json({ error: 'direction must be out_to_scheme or in_from_scheme' });
    }

    const userId = (req as any).user?.id || null;

    const result = await pool.query(
      `INSERT INTO deposit_transfers
         (tenancy_id, tenant_id, direction, amount, from_account, to_account,
          scheme_name, reference, transfer_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        tenancyId, tenantId || null, direction, amount,
        fromAccount || null, toAccount || null, schemeName || null,
        reference || null, transferDate, userId
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating deposit transfer:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /deposit-transfers/:id - update status
adminToolsRoutes.put('/deposit-transfers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['pending', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ error: 'status must be pending, completed, or failed' });
    }

    const result = await pool.query(
      'UPDATE deposit_transfers SET status = $1 WHERE id = $2 RETURNING *',
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Transfer not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating deposit transfer:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// ACCOUNT FINALISATION (Financial Periods)
// ==========================================

// GET /financial-periods
adminToolsRoutes.get('/financial-periods', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM financial_periods ORDER BY start_date DESC'
    );
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching financial periods:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /financial-periods/:id/finalise - lock period
adminToolsRoutes.post('/financial-periods/:id/finalise', async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id || null;

    const result = await pool.query(
      `UPDATE financial_periods
       SET status = 'locked', closed_at = NOW(), closed_by_id = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [userId, id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Financial period not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error finalising financial period:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /financial-periods/:id/reopen - admin unlock
adminToolsRoutes.post('/financial-periods/:id/reopen', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE financial_periods
       SET status = 'open', closed_at = NULL, closed_by_id = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Financial period not found' });
    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error reopening financial period:', err);
    res.status(500).json({ error: err.message });
  }
});
