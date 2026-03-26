/**
 * PM Overview Routes
 *
 * Aggregation endpoints for the Head of PM dashboard:
 * - Compliance alerts (expired / expiring certs)
 * - Portfolio health scores per property
 * - Agent activity summary from audit log
 */
import { Router, Request, Response } from 'express';
import pool from './db';

const router = Router();

// Middleware: require authenticated agent or admin
function requireAgent(req: Request, res: Response, next: Function) {
  if (!(req as any).user) return res.status(401).json({ error: 'Not authenticated' });
  const role = (req as any).user.role;
  if (role !== 'admin' && role !== 'agent')
    return res.status(403).json({ error: 'Not authorized' });
  next();
}

// ----------------------------------------------------------------
// GET /pm-overview/compliance-alerts
// ----------------------------------------------------------------
router.get('/pm-overview/compliance-alerts', requireAgent, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [certsResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT pc.id, pc.property_id, p.address AS property_address,
                pc.certification_type, pc.expiry_date, l.name AS landlord_name
         FROM property_certification pc
         JOIN property p ON p.id = pc.property_id
         LEFT JOIN landlord l ON l.id = p.landlord_id
         WHERE p.is_managed = true
           AND pc.expiry_date <= $1
         ORDER BY pc.expiry_date ASC`,
        [thirtyDays]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT p.id)::int AS total
         FROM property p WHERE p.is_managed = true`
      ),
    ]);

    const expired: any[] = [];
    const expiringSoon: any[] = [];

    for (const row of certsResult.rows) {
      const expiry = new Date(row.expiry_date);
      const urgency = expiry <= now ? 'expired' : 'expiring_soon';
      const entry = {
        propertyId: row.property_id,
        propertyAddress: row.property_address,
        certificationType: row.certification_type,
        expiryDate: row.expiry_date,
        landlordName: row.landlord_name,
        urgency,
      };
      if (urgency === 'expired') expired.push(entry);
      else expiringSoon.push(entry);
    }

    const totalProperties = totalResult.rows[0]?.total ?? 0;
    // Properties that have NO expired or expiring certs
    const affectedPropertyIds = new Set(certsResult.rows.map((r: any) => r.property_id));
    const compliantProperties = totalProperties - affectedPropertyIds.size;

    res.json({ expired, expiringSoon, totalProperties, compliantProperties });
  } catch (err: any) {
    console.error('PM overview compliance-alerts error:', err);
    res.status(500).json({ error: 'Failed to load compliance alerts' });
  }
});

// ----------------------------------------------------------------
// GET /pm-overview/portfolio-health
// ----------------------------------------------------------------
router.get('/pm-overview/portfolio-health', requireAgent, async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Parallel queries for all data needed to compute health scores
    const [propertiesResult, expiredCertsResult, expiringCertsResult, openTicketsResult, arrearsResult, activeTenanciesResult] =
      await Promise.all([
        // All managed properties
        pool.query(
          `SELECT p.id, p.address, l.name AS landlord_name
           FROM property p
           LEFT JOIN landlord l ON l.id = p.landlord_id
           WHERE p.is_managed = true
           ORDER BY p.address`
        ),
        // Expired certifications per property
        pool.query(
          `SELECT pc.property_id, COUNT(*)::int AS cnt
           FROM property_certification pc
           JOIN property p ON p.id = pc.property_id
           WHERE p.is_managed = true AND pc.expiry_date < $1
           GROUP BY pc.property_id`,
          [now]
        ),
        // Expiring-soon certifications per property (within 30 days but not expired)
        pool.query(
          `SELECT pc.property_id, COUNT(*)::int AS cnt
           FROM property_certification pc
           JOIN property p ON p.id = pc.property_id
           WHERE p.is_managed = true AND pc.expiry_date >= $1 AND pc.expiry_date <= $2
           GROUP BY pc.property_id`,
          [now, thirtyDays]
        ),
        // Open maintenance tickets per property
        pool.query(
          `SELECT mt.property_id, COUNT(*)::int AS cnt
           FROM maintenance_ticket mt
           JOIN property p ON p.id = mt.property_id
           WHERE p.is_managed = true AND mt.status NOT IN ('completed', 'closed')
           GROUP BY mt.property_id`
        ),
        // Active arrears per property
        pool.query(
          `SELECT a.property_id, COUNT(*)::int AS cnt
           FROM arrears a
           JOIN property p ON p.id = a.property_id
           WHERE p.is_managed = true AND a.status = 'active'
           GROUP BY a.property_id`
        ),
        // Properties with active tenancies
        pool.query(
          `SELECT DISTINCT tc.property_id
           FROM tenancy_contract tc
           JOIN property p ON p.id = tc.property_id
           WHERE p.is_managed = true AND tc.status = 'active'`
        ),
      ]);

    // Build lookup maps
    const expiredMap = new Map<number, number>();
    for (const r of expiredCertsResult.rows) expiredMap.set(r.property_id, r.cnt);

    const expiringMap = new Map<number, number>();
    for (const r of expiringCertsResult.rows) expiringMap.set(r.property_id, r.cnt);

    const ticketMap = new Map<number, number>();
    for (const r of openTicketsResult.rows) ticketMap.set(r.property_id, r.cnt);

    const arrearsMap = new Map<number, number>();
    for (const r of arrearsResult.rows) arrearsMap.set(r.property_id, r.cnt);

    const activePropertyIds = new Set(activeTenanciesResult.rows.map((r: any) => r.property_id));

    // Calculate health scores
    const properties = propertiesResult.rows.map((p: any) => {
      let score = 100;
      const issues: string[] = [];

      const expiredCount = expiredMap.get(p.id) ?? 0;
      if (expiredCount > 0) {
        score -= 20 * expiredCount;
        issues.push(`${expiredCount} expired cert(s)`);
      }

      const expiringCount = expiringMap.get(p.id) ?? 0;
      if (expiringCount > 0) {
        score -= 10 * expiringCount;
        issues.push(`${expiringCount} cert(s) expiring soon`);
      }

      const ticketCount = ticketMap.get(p.id) ?? 0;
      if (ticketCount > 0) {
        score -= 5 * ticketCount;
        issues.push(`${ticketCount} open maintenance ticket(s)`);
      }

      const arrearsCount = arrearsMap.get(p.id) ?? 0;
      if (arrearsCount > 0) {
        score -= 15 * arrearsCount;
        issues.push(`${arrearsCount} active arrears case(s)`);
      }

      if (!activePropertyIds.has(p.id)) {
        score -= 25;
        issues.push('Vacant (no active tenancy)');
      }

      return {
        id: p.id,
        address: p.address,
        landlordName: p.landlord_name,
        healthScore: Math.max(0, score),
        issues,
      };
    });

    const totalScore = properties.reduce((sum: number, p: any) => sum + p.healthScore, 0);
    const averageScore = properties.length > 0 ? Math.round(totalScore / properties.length) : 100;
    const criticalCount = properties.filter((p: any) => p.healthScore < 50).length;

    res.json({ properties, averageScore, criticalCount });
  } catch (err: any) {
    console.error('PM overview portfolio-health error:', err);
    res.status(500).json({ error: 'Failed to load portfolio health' });
  }
});

// ----------------------------------------------------------------
// GET /pm-overview/agent-activity
// ----------------------------------------------------------------
router.get('/pm-overview/agent-activity', requireAgent, async (req: Request, res: Response) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const agentType = req.query.agentType as string | undefined;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - days);

    let query = `
      SELECT agent_type, action, COUNT(*)::int AS cnt
      FROM agent_audit_log
      WHERE created_at >= $1
    `;
    const params: any[] = [fromDate];

    if (agentType) {
      query += ` AND agent_type = $2`;
      params.push(agentType);
    }

    query += ` GROUP BY agent_type, action ORDER BY agent_type, cnt DESC`;

    const result = await pool.query(query, params);

    // Aggregate by agent type
    const byAgent: Record<string, { totalActions: number; topActions: { action: string; count: number }[] }> = {};
    let totalActions = 0;

    for (const row of result.rows) {
      if (!byAgent[row.agent_type]) {
        byAgent[row.agent_type] = { totalActions: 0, topActions: [] };
      }
      byAgent[row.agent_type].totalActions += row.cnt;
      byAgent[row.agent_type].topActions.push({ action: row.action, count: row.cnt });
      totalActions += row.cnt;
    }

    res.json({
      byAgent,
      totalActions,
      period: {
        days,
        from: fromDate.toISOString(),
        to: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('PM overview agent-activity error:', err);
    res.status(500).json({ error: 'Failed to load agent activity' });
  }
});

export { router as pmOverviewRouter };
