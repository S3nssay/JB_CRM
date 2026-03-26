/**
 * Cost Ledger Routes
 *
 * Per-property and per-landlord cost aggregation endpoints.
 * Configurable spend threshold management with email alerts.
 *
 * Aggregates:
 *   - Maintenance costs from work_order.invoice_amount (via maintenance_request.property_id)
 *   - Compliance costs from property_certification.cost
 */
import { Router, Request, Response } from 'express';
import { pool } from './db';
import { emailService } from './emailService';

export const costLedgerRouter = Router();

// ---------- helpers ----------

function ensureAuth(req: Request, res: Response): boolean {
  if (!req.isAuthenticated?.()) {
    res.status(401).json({ error: 'Not authenticated' });
    return false;
  }
  return true;
}

// ---------- 1. GET /properties/:id/costs ----------

costLedgerRouter.get('/properties/:id/costs', async (req: Request, res: Response) => {
  if (!ensureAuth(req, res)) return;
  const propertyId = parseInt(req.params.id, 10);
  if (isNaN(propertyId)) return res.status(400).json({ error: 'Invalid property id' });

  try {
    const [maintenanceResult, complianceResult] = await Promise.all([
      pool.query(
        `SELECT wo.id, wo.work_order_number, wo.scope, wo.invoice_amount,
                wo.invoice_number, wo.status, wo.created_at,
                mr.title AS request_title, mr.issue_type
         FROM work_order wo
         JOIN maintenance_request mr ON mr.id = wo.maintenance_request_id
         WHERE mr.property_id = $1 AND wo.invoice_amount IS NOT NULL
         ORDER BY wo.created_at DESC`,
        [propertyId]
      ),
      pool.query(
        `SELECT id, certification_type, certificate_number,
                issued_by_company, inspection_date, cost
         FROM property_certification
         WHERE property_id = $1 AND cost IS NOT NULL
         ORDER BY inspection_date DESC`,
        [propertyId]
      ),
    ]);

    const maintenanceItems = maintenanceResult.rows;
    const complianceItems = complianceResult.rows;
    const maintenanceTotal = maintenanceItems.reduce((sum: number, r: any) => sum + (r.invoice_amount || 0), 0);
    const complianceTotal = complianceItems.reduce((sum: number, r: any) => sum + (r.cost || 0), 0);

    res.json({
      maintenance: { items: maintenanceItems, total: maintenanceTotal },
      compliance: { items: complianceItems, total: complianceTotal },
      grandTotal: maintenanceTotal + complianceTotal,
    });
  } catch (err: any) {
    console.error('Error fetching property costs:', err);
    res.status(500).json({ error: 'Failed to fetch property costs' });
  }
});

// ---------- 2. GET /landlords/:id/costs ----------

costLedgerRouter.get('/landlords/:id/costs', async (req: Request, res: Response) => {
  if (!ensureAuth(req, res)) return;
  const landlordId = parseInt(req.params.id, 10);
  if (isNaN(landlordId)) return res.status(400).json({ error: 'Invalid landlord id' });

  try {
    const result = await pool.query(
      `SELECT p.id AS property_id, p.address,
              COALESCE(SUM(wo.invoice_amount), 0) AS maintenance_total,
              COALESCE(cert_costs.total, 0) AS compliance_total
       FROM properties p
       LEFT JOIN maintenance_request mr ON mr.property_id = p.id
       LEFT JOIN work_order wo ON wo.maintenance_request_id = mr.id AND wo.invoice_amount IS NOT NULL
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(cost), 0) AS total
         FROM property_certification pc WHERE pc.property_id = p.id AND pc.cost IS NOT NULL
       ) cert_costs ON true
       WHERE p.landlord_id = $1
       GROUP BY p.id, p.address, cert_costs.total
       ORDER BY p.address`,
      [landlordId]
    );

    const properties = result.rows.map((r: any) => ({
      propertyId: r.property_id,
      address: r.address,
      maintenanceTotal: parseInt(r.maintenance_total, 10) || 0,
      complianceTotal: parseInt(r.compliance_total, 10) || 0,
    }));
    const grandTotal = properties.reduce(
      (sum: number, p: any) => sum + p.maintenanceTotal + p.complianceTotal,
      0
    );

    res.json({ properties, grandTotal });
  } catch (err: any) {
    console.error('Error fetching landlord costs:', err);
    res.status(500).json({ error: 'Failed to fetch landlord costs' });
  }
});

// ---------- 3. GET /properties/:id/cost-threshold ----------

costLedgerRouter.get('/properties/:id/cost-threshold', async (req: Request, res: Response) => {
  if (!ensureAuth(req, res)) return;
  const propertyId = parseInt(req.params.id, 10);
  if (isNaN(propertyId)) return res.status(400).json({ error: 'Invalid property id' });

  try {
    const result = await pool.query(
      `SELECT id, property_id, annual_limit, notification_email, last_alert_sent, created_at, updated_at
       FROM property_cost_threshold WHERE property_id = $1`,
      [propertyId]
    );
    res.json(result.rows[0] || null);
  } catch (err: any) {
    console.error('Error fetching cost threshold:', err);
    res.status(500).json({ error: 'Failed to fetch cost threshold' });
  }
});

// ---------- 4. PUT /properties/:id/cost-threshold ----------

costLedgerRouter.put('/properties/:id/cost-threshold', async (req: Request, res: Response) => {
  if (!ensureAuth(req, res)) return;
  const propertyId = parseInt(req.params.id, 10);
  if (isNaN(propertyId)) return res.status(400).json({ error: 'Invalid property id' });

  const { annualLimit, notificationEmail } = req.body;
  if (typeof annualLimit !== 'number' || annualLimit <= 0) {
    return res.status(400).json({ error: 'annualLimit must be a positive integer (pence)' });
  }
  if (!notificationEmail || typeof notificationEmail !== 'string') {
    return res.status(400).json({ error: 'notificationEmail is required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO property_cost_threshold (property_id, annual_limit, notification_email, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (property_id) DO UPDATE SET
         annual_limit = EXCLUDED.annual_limit,
         notification_email = EXCLUDED.notification_email,
         updated_at = NOW()
       RETURNING *`,
      [propertyId, annualLimit, notificationEmail]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    // If unique constraint doesn't exist yet, try adding it and retry
    if (err.code === '42710' || err.message?.includes('there is no unique')) {
      console.error('property_cost_threshold unique constraint missing, attempting to add');
    }
    console.error('Error upserting cost threshold:', err);
    res.status(500).json({ error: 'Failed to set cost threshold' });
  }
});

// ---------- 5. DELETE /properties/:id/cost-threshold ----------

costLedgerRouter.delete('/properties/:id/cost-threshold', async (req: Request, res: Response) => {
  if (!ensureAuth(req, res)) return;
  const propertyId = parseInt(req.params.id, 10);
  if (isNaN(propertyId)) return res.status(400).json({ error: 'Invalid property id' });

  try {
    await pool.query('DELETE FROM property_cost_threshold WHERE property_id = $1', [propertyId]);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting cost threshold:', err);
    res.status(500).json({ error: 'Failed to delete cost threshold' });
  }
});

// ---------- 6. POST /costs/check-thresholds ----------

costLedgerRouter.post('/costs/check-thresholds', async (req: Request, res: Response) => {
  if (!ensureAuth(req, res)) return;

  try {
    // Get all thresholds
    const thresholds = await pool.query(
      `SELECT pct.*, p.address
       FROM property_cost_threshold pct
       JOIN properties p ON p.id = pct.property_id`
    );

    let alertsSent = 0;
    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;

    for (const threshold of thresholds.rows) {
      // Calculate current year's total costs for this property
      const [maintenanceCosts, complianceCosts] = await Promise.all([
        pool.query(
          `SELECT COALESCE(SUM(wo.invoice_amount), 0) AS total
           FROM work_order wo
           JOIN maintenance_request mr ON mr.id = wo.maintenance_request_id
           WHERE mr.property_id = $1
             AND wo.invoice_amount IS NOT NULL
             AND wo.created_at >= $2`,
          [threshold.property_id, yearStart]
        ),
        pool.query(
          `SELECT COALESCE(SUM(cost), 0) AS total
           FROM property_certification
           WHERE property_id = $1
             AND cost IS NOT NULL
             AND inspection_date >= $2`,
          [threshold.property_id, yearStart]
        ),
      ]);

      const maintenanceTotal = parseInt(maintenanceCosts.rows[0].total, 10) || 0;
      const complianceTotal = parseInt(complianceCosts.rows[0].total, 10) || 0;
      const totalSpend = maintenanceTotal + complianceTotal;

      if (totalSpend >= threshold.annual_limit) {
        // Check cooldown: only send if last_alert_sent is null or > 30 days ago
        const lastAlert = threshold.last_alert_sent ? new Date(threshold.last_alert_sent) : null;
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        if (!lastAlert || lastAlert < thirtyDaysAgo) {
          // Send email alert
          const formattedSpend = (totalSpend / 100).toFixed(2);
          const formattedLimit = (threshold.annual_limit / 100).toFixed(2);
          const formattedMaintenance = (maintenanceTotal / 100).toFixed(2);
          const formattedCompliance = (complianceTotal / 100).toFixed(2);

          await emailService.sendEmail(
            threshold.notification_email,
            `Cost Threshold Alert: ${threshold.address}`,
            `<div style="font-family: Arial, sans-serif; padding: 20px;">
              <h2 style="color: #791E75;">Cost Threshold Alert</h2>
              <p>The property at <strong>${threshold.address}</strong> has exceeded its annual cost threshold.</p>
              <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Current Spend</strong></td><td style="padding: 8px; border: 1px solid #ddd;">&pound;${formattedSpend}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Annual Limit</strong></td><td style="padding: 8px; border: 1px solid #ddd;">&pound;${formattedLimit}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Maintenance Costs</strong></td><td style="padding: 8px; border: 1px solid #ddd;">&pound;${formattedMaintenance}</td></tr>
                <tr><td style="padding: 8px; border: 1px solid #ddd;"><strong>Compliance Costs</strong></td><td style="padding: 8px; border: 1px solid #ddd;">&pound;${formattedCompliance}</td></tr>
              </table>
              <p>Please review the cost ledger for this property in the CRM.</p>
            </div>`
          );

          // Update last_alert_sent
          await pool.query(
            'UPDATE property_cost_threshold SET last_alert_sent = NOW() WHERE id = $1',
            [threshold.id]
          );

          alertsSent++;
        }
      }
    }

    res.json({ alertsSent });
  } catch (err: any) {
    console.error('Error checking cost thresholds:', err);
    res.status(500).json({ error: 'Failed to check cost thresholds' });
  }
});
