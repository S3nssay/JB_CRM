/**
 * Sourcing Dashboard API Routes
 *
 * REST API for the property sourcing pipeline:
 * - Pipeline view (leads grouped by status stage)
 * - Approval workflow (approve/reject/edit outreach drafts)
 * - Campaign CRUD (monitoring configs)
 * - Metrics aggregation (dashboard stats + per-source breakdown)
 * - Manual monitor triggers
 *
 * All endpoints require authentication (req.user).
 * Uses lazy imports for Plan 02 services to avoid import-time dependencies.
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Pipeline stages matching proactive_lead.status enum
const PIPELINE_STAGES = [
  'new', 'researching', 'ready_to_contact', 'contacted', 'responded',
  'meeting_scheduled', 'valuation_booked', 'instructed'
] as const;

// Auth guard helper
function requireAuth(req: Request, res: Response): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  return true;
}

// ============================================================
// PIPELINE ENDPOINTS
// ============================================================

/**
 * GET /sourcing/leads
 * Returns leads grouped by pipeline stage with counts.
 * Supports ?source=, ?search=, ?status= filters.
 */
router.get('/sourcing/leads', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIdx = 0;

    if (req.query.source) {
      paramIdx++;
      whereClause += ` AND pl.lead_source = $${paramIdx}`;
      params.push(req.query.source);
    }

    if (req.query.search) {
      paramIdx++;
      whereClause += ` AND (pl.property_address ILIKE $${paramIdx} OR pl.owner_name ILIKE $${paramIdx})`;
      params.push(`%${req.query.search}%`);
    }

    if (req.query.status) {
      paramIdx++;
      whereClause += ` AND pl.status = $${paramIdx}`;
      params.push(req.query.status);
    }

    const result = await pool.query(`
      SELECT
        pl.*,
        ps.sell_propensity,
        ps.let_propensity,
        ps.score_confidence
      FROM proactive_lead pl
      LEFT JOIN propensity_score ps ON ps.lead_id = pl.id
      ${whereClause}
      ORDER BY pl.lead_score DESC NULLS LAST
    `, params);

    // Group by pipeline stages
    const stages: Record<string, { count: number; leads: any[] }> = {};
    for (const stage of PIPELINE_STAGES) {
      stages[stage] = { count: 0, leads: [] };
    }

    for (const row of result.rows) {
      const stage = row.status || 'new';
      if (stages[stage]) {
        stages[stage].count++;
        stages[stage].leads.push(row);
      }
    }

    res.json({ stages, total: result.rows.length });
  } catch (err: any) {
    console.error('Error fetching sourcing leads:', err);
    res.status(500).json({ error: 'Failed to fetch sourcing leads' });
  }
});

/**
 * GET /sourcing/leads/:id
 * Returns a single lead with contact history and propensity score.
 */
router.get('/sourcing/leads/:id', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');
    const leadId = parseInt(req.params.id, 10);

    // Fetch lead
    const leadResult = await pool.query(`
      SELECT * FROM proactive_lead WHERE id = $1
    `, [leadId]);

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Fetch contact history
    const historyResult = await pool.query(`
      SELECT * FROM lead_contact_history
      WHERE lead_id = $1
      ORDER BY created_at DESC
    `, [leadId]);

    // Fetch propensity score
    const scoreResult = await pool.query(`
      SELECT * FROM propensity_score
      WHERE lead_id = $1
      ORDER BY scored_at DESC
      LIMIT 1
    `, [leadId]);

    res.json({
      lead: leadResult.rows[0],
      contactHistory: historyResult.rows,
      propensityScore: scoreResult.rows[0] || null
    });
  } catch (err: any) {
    console.error('Error fetching lead detail:', err);
    res.status(500).json({ error: 'Failed to fetch lead detail' });
  }
});

/**
 * POST /sourcing/leads/:id/draft-outreach
 * Creates an outreach draft for a lead via sourcingOutreachService.
 */
router.post('/sourcing/leads/:id/draft-outreach', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { draftOutreach } = await import('./agents/services/sourcingOutreachService');
    const leadId = parseInt(req.params.id, 10);
    const { sequenceStep } = req.body || {};

    const draft = await draftOutreach(leadId, sequenceStep);
    res.json(draft);
  } catch (err: any) {
    console.error('Error drafting outreach:', err);
    res.status(500).json({ error: 'Failed to draft outreach' });
  }
});

// ============================================================
// APPROVAL ENDPOINTS
// ============================================================

/**
 * GET /sourcing/approvals
 * Returns pending approval records.
 */
router.get('/sourcing/approvals', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { getPendingApprovals } = await import('./agents/services/sourcingApprovalService');
    const approvals = await getPendingApprovals();
    res.json(approvals);
  } catch (err: any) {
    console.error('Error fetching approvals:', err);
    res.status(500).json({ error: 'Failed to fetch approvals' });
  }
});

/**
 * POST /sourcing/approvals/:id/approve
 * Approves an outreach draft.
 */
router.post('/sourcing/approvals/:id/approve', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { approveOutreach } = await import('./agents/services/sourcingApprovalService');
    const contactHistoryId = parseInt(req.params.id, 10);
    await approveOutreach(contactHistoryId, (req.user as any).id);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error approving outreach:', err);
    res.status(500).json({ error: 'Failed to approve outreach' });
  }
});

/**
 * POST /sourcing/approvals/:id/reject
 * Rejects an outreach draft with optional reason.
 */
router.post('/sourcing/approvals/:id/reject', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { rejectOutreach } = await import('./agents/services/sourcingApprovalService');
    const contactHistoryId = parseInt(req.params.id, 10);
    const { reason } = req.body || {};
    await rejectOutreach(contactHistoryId, (req.user as any).id, reason);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error rejecting outreach:', err);
    res.status(500).json({ error: 'Failed to reject outreach' });
  }
});

/**
 * PUT /sourcing/approvals/:id/edit
 * Edits an outreach draft's content/subject.
 */
router.put('/sourcing/approvals/:id/edit', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { editOutreachDraft } = await import('./agents/services/sourcingApprovalService');
    const contactHistoryId = parseInt(req.params.id, 10);
    const { content, subject } = req.body || {};

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    await editOutreachDraft(contactHistoryId, content, subject);
    res.json({ success: true });
  } catch (err: any) {
    console.error('Error editing outreach draft:', err);
    res.status(500).json({ error: 'Failed to edit outreach draft' });
  }
});

// ============================================================
// CAMPAIGN CRUD ENDPOINTS
// ============================================================

/**
 * GET /sourcing/campaigns
 * Returns all monitoring configs (campaigns).
 */
router.get('/sourcing/campaigns', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');
    const result = await pool.query(`
      SELECT * FROM lead_monitoring_config
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

/**
 * POST /sourcing/campaigns
 * Creates a new monitoring config.
 */
router.post('/sourcing/campaigns', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');
    const {
      name, monitorType, description, postcodeAreas,
      minPrice, maxPrice, propertyTypes, frequency,
      config, isEnabled, autoContact
    } = req.body;

    if (!name || !monitorType) {
      return res.status(400).json({ error: 'name and monitorType are required' });
    }

    // Default config with follow-up sequence if not provided
    const finalConfig = config || {
      followUpSequence: [
        { step: 0, channel: 'email', delay: 0 },
        { step: 1, channel: 'post', delay: 7 },
        { step: 2, channel: 'email', delay: 14 }
      ]
    };

    const result = await pool.query(`
      INSERT INTO lead_monitoring_config
        (name, monitor_type, description, postcode_areas, min_price, max_price,
         property_types, frequency, config, is_enabled, auto_contact, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      name, monitorType, description || null,
      postcodeAreas || null, minPrice || null, maxPrice || null,
      propertyTypes || null, frequency || 'daily',
      JSON.stringify(finalConfig), isEnabled !== false, autoContact || false,
      (req.user as any).id
    ]);

    res.status(201).json(result.rows[0]);
  } catch (err: any) {
    console.error('Error creating campaign:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

/**
 * PUT /sourcing/campaigns/:id
 * Updates a monitoring config.
 */
router.put('/sourcing/campaigns/:id', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');
    const campaignId = parseInt(req.params.id, 10);
    const {
      name, description, postcodeAreas, minPrice, maxPrice,
      propertyTypes, frequency, config, isEnabled, autoContact
    } = req.body;

    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIdx = 0;

    const addField = (col: string, val: any) => {
      if (val !== undefined) {
        paramIdx++;
        setClauses.push(`${col} = $${paramIdx}`);
        params.push(col === 'config' ? JSON.stringify(val) : val);
      }
    };

    addField('name', name);
    addField('description', description);
    addField('postcode_areas', postcodeAreas);
    addField('min_price', minPrice);
    addField('max_price', maxPrice);
    addField('property_types', propertyTypes);
    addField('frequency', frequency);
    addField('config', config);
    addField('is_enabled', isEnabled);
    addField('auto_contact', autoContact);

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Always update updated_at
    setClauses.push(`updated_at = NOW()`);

    paramIdx++;
    params.push(campaignId);

    const result = await pool.query(`
      UPDATE lead_monitoring_config
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIdx}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json(result.rows[0]);
  } catch (err: any) {
    console.error('Error updating campaign:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

/**
 * DELETE /sourcing/campaigns/:id
 * Deletes a monitoring config.
 */
router.delete('/sourcing/campaigns/:id', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');
    const campaignId = parseInt(req.params.id, 10);

    const result = await pool.query(`
      DELETE FROM lead_monitoring_config WHERE id = $1 RETURNING id
    `, [campaignId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting campaign:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// ============================================================
// METRICS ENDPOINTS
// ============================================================

/**
 * GET /sourcing/metrics
 * Returns aggregate dashboard stats for the current month.
 */
router.get('/sourcing/metrics', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Leads sourced this month
    const leadsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM proactive_lead
      WHERE created_at >= $1
    `, [startOfMonth]);
    const leadsSourcedThisMonth = parseInt(leadsResult.rows[0].count, 10);

    // Outreach sent this month
    const outreachResult = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent' OR status = 'delivered') as sent_count,
        COUNT(*) FILTER (WHERE response_received = true) as response_count
      FROM lead_contact_history
      WHERE created_at >= $1
    `, [startOfMonth]);
    const outreachSent = parseInt(outreachResult.rows[0].sent_count, 10);
    const responseCount = parseInt(outreachResult.rows[0].response_count, 10);
    const responseRate = outreachSent > 0 ? Math.round((responseCount / outreachSent) * 100) : 0;

    // Valuations booked this month
    const valuationsResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM proactive_lead
      WHERE status = 'valuation_booked' AND updated_at >= $1
    `, [startOfMonth]);
    const valuationsBooked = parseInt(valuationsResult.rows[0].count, 10);

    res.json({
      leadsSourcedThisMonth,
      outreachSent,
      responseRate,
      valuationsBooked
    });
  } catch (err: any) {
    console.error('Error fetching metrics:', err);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

/**
 * GET /sourcing/metrics/by-source
 * Returns per-source performance breakdown.
 */
router.get('/sourcing/metrics/by-source', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { pool } = await import('./db');

    const result = await pool.query(`
      SELECT
        pl.lead_source,
        COUNT(DISTINCT pl.id) as leads_found,
        COUNT(DISTINCT CASE WHEN lch.status IN ('sent', 'delivered') THEN lch.id END) as outreach_sent,
        COUNT(DISTINCT CASE WHEN lch.response_received = true THEN lch.id END) as responses,
        COUNT(DISTINCT CASE WHEN pl.status = 'valuation_booked' THEN pl.id END) as valuations,
        COUNT(DISTINCT CASE WHEN pl.status = 'instructed' THEN pl.id END) as instructions
      FROM proactive_lead pl
      LEFT JOIN lead_contact_history lch ON lch.lead_id = pl.id
      GROUP BY pl.lead_source
      ORDER BY leads_found DESC
    `);

    const sourceMetrics = result.rows.map(row => {
      const leadsFound = parseInt(row.leads_found, 10);
      const outreachSent = parseInt(row.outreach_sent, 10);
      const responses = parseInt(row.responses, 10);
      const valuations = parseInt(row.valuations, 10);
      const instructions = parseInt(row.instructions, 10);

      return {
        source: row.lead_source,
        leadsFound,
        outreachSent,
        responses,
        responseRate: outreachSent > 0 ? Math.round((responses / outreachSent) * 100) : 0,
        valuations,
        instructions,
        conversionRate: leadsFound > 0 ? Math.round((instructions / leadsFound) * 100) : 0
      };
    });

    res.json(sourceMetrics);
  } catch (err: any) {
    console.error('Error fetching metrics by source:', err);
    res.status(500).json({ error: 'Failed to fetch metrics by source' });
  }
});

// ============================================================
// MANUAL MONITOR TRIGGER
// ============================================================

/**
 * POST /sourcing/monitors/:type/run
 * Triggers a manual monitor scan.
 */
router.post('/sourcing/monitors/:type/run', async (req: Request, res: Response) => {
  if (!requireAuth(req, res)) return;

  try {
    const { proactiveLeadGenService } = await import('./proactiveLeadGenService');
    const monitorType = req.params.type;

    const leads = await proactiveLeadGenService.runMonitor(monitorType);
    res.json({
      success: true,
      message: 'Monitor scan triggered',
      leadsFound: leads.length
    });
  } catch (err: any) {
    console.error('Error triggering monitor:', err);
    res.status(500).json({ error: 'Failed to trigger monitor scan' });
  }
});

export const sourcingRouter = router;
