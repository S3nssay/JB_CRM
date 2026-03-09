import { Router } from 'express';
import { pool } from './db';

const tenantRouter = Router();

// Helper: get tenant record from logged-in user
async function getTenantFromUser(userId: number) {
  const result = await pool.query(
    `SELECT t.*, p.address_line1 as property_address, p.postcode as property_postcode
     FROM tenant t
     LEFT JOIN property p ON p.id = t.property_id
     WHERE t.user_id = $1`,
    [userId]
  );
  return result.rows[0] || null;
}

// GET /tickets - list tenant's tickets
tenantRouter.get('/tickets', async (req: any, res) => {
  try {
    const tenant = await getTenantFromUser(req.user.id);
    if (!tenant) {
      return res.json([]);
    }

    const result = await pool.query(
      `SELECT st.*, p.address_line1 as property_address, p.postcode as property_postcode
       FROM support_ticket st
       LEFT JOIN property p ON p.id = st.property_id
       WHERE st.tenant_id = $1
       ORDER BY st.created_at DESC`,
      [tenant.id]
    );

    const tickets = await Promise.all(result.rows.map(async (ticket: any) => {
      const commentsResult = await pool.query(
        `SELECT tc.*, u.full_name as user_full_name
         FROM ticket_comment tc
         LEFT JOIN "user" u ON u.id = tc.user_id
         WHERE tc.ticket_id = $1
         ORDER BY tc.created_at ASC`,
        [ticket.id]
      );
      return { ...ticket, comments: commentsResult.rows };
    }));

    res.json(tickets);
  } catch (error) {
    console.error('Error fetching tenant tickets:', error);
    res.status(500).json({ error: 'Failed to fetch tickets' });
  }
});

// GET /property - get tenant's property details
tenantRouter.get('/property', async (req: any, res) => {
  try {
    const tenant = await getTenantFromUser(req.user.id);
    if (!tenant || !tenant.property_id) {
      return res.json(null);
    }
    const result = await pool.query(`SELECT * FROM property WHERE id = $1`, [tenant.property_id]);
    res.json(result.rows[0] || null);
  } catch (error) {
    console.error('Error fetching tenant property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// POST /tickets - create a ticket
tenantRouter.post('/tickets', async (req: any, res) => {
  try {
    const { category, subject, description, priority } = req.body;

    if (!category || !subject || !description) {
      return res.status(400).json({ error: 'category, subject, and description are required' });
    }

    const tenant = await getTenantFromUser(req.user.id);
    if (!tenant) {
      return res.status(400).json({ error: 'No tenant record linked to your account. Please contact management.' });
    }

    const prefix = 'JB';
    const date = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const ticketNumber = prefix + date + random;

    const result = await pool.query(
      `INSERT INTO support_ticket (tenant_id, property_id, ticket_number, category, subject, description, priority, status, workflow_status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 'new', NOW(), NOW())
       RETURNING *`,
      [tenant.id, tenant.property_id, ticketNumber, category, subject, description, priority || 'medium']
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating tenant ticket:', error);
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

// POST /tickets/:ticketId/comments
tenantRouter.post('/tickets/:ticketId/comments', async (req: any, res) => {
  try {
    const { ticketId } = req.params;
    const { comment } = req.body;

    const tenant = await getTenantFromUser(req.user.id);
    if (!tenant) {
      return res.status(400).json({ error: 'No tenant record linked to your account' });
    }

    const ticketResult = await pool.query(
      `SELECT id FROM support_ticket WHERE id = $1 AND tenant_id = $2`,
      [ticketId, tenant.id]
    );
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const result = await pool.query(
      `INSERT INTO ticket_comment (ticket_id, user_id, comment, is_internal, created_at)
       VALUES ($1, $2, $3, false, NOW())
       RETURNING *`,
      [ticketId, req.user.id, comment]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// POST /tickets/:ticketId/satisfaction
tenantRouter.post('/tickets/:ticketId/satisfaction', async (req: any, res) => {
  try {
    const { ticketId } = req.params;
    const { rating } = req.body;

    const tenant = await getTenantFromUser(req.user.id);
    if (!tenant) {
      return res.status(400).json({ error: 'No tenant record linked to your account' });
    }

    const ticketResult = await pool.query(
      `SELECT id FROM support_ticket WHERE id = $1 AND tenant_id = $2`,
      [ticketId, tenant.id]
    );
    if (ticketResult.rows.length === 0) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    await pool.query(
      `UPDATE support_ticket SET satisfaction_rating = $1, updated_at = NOW() WHERE id = $2`,
      [rating, ticketId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Error rating ticket:', error);
    res.status(500).json({ error: 'Failed to rate ticket' });
  }
});

export default tenantRouter;
