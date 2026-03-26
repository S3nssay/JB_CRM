/**
 * Head of PM -- Cross-Domain Portfolio Query Tools
 *
 * Tools for Jamie (Head of Property Management) to query across
 * maintenance, compliance, arrears, finance, and tenancy domains.
 *
 * All tools use the lazy pool import pattern and raw SQL for
 * flexible cross-table queries.
 */

import { tool } from '@openai/agents';
// @ts-ignore -- zod4 is an npm alias for zod@4, required by @openai/agents SDK
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';

// ---- 1. Portfolio Overview ----

export const queryPortfolioOverviewTool = tool({
  name: 'query_portfolio_overview',
  description:
    'Get a holistic portfolio overview for a landlord: properties, compliance, maintenance, arrears, and tenancies.',
  parameters: z4.object({
    landlordId: z4.number().describe('The landlord ID to query portfolio for'),
  }),
  execute: async (_context: AgentContext, input: { landlordId: number }) => {
    const { pool } = await import('../../db');

    const [propertiesRes, complianceRes, maintenanceRes, arrearsRes, tenancyRes] =
      await Promise.all([
        // Properties for this landlord
        pool.query(
          `SELECT id, title, address_line1, postcode, status, property_type, bedrooms
           FROM property
           WHERE landlord_id = $1 AND is_managed = true
           ORDER BY id`,
          [input.landlordId],
        ),
        // Compliance certifications grouped by property
        pool.query(
          `SELECT pc.property_id, pc.certification_type, pc.expiry_date, pc.status
           FROM property_certification pc
           JOIN property p ON p.id = pc.property_id
           WHERE p.landlord_id = $1 AND p.is_managed = true
           ORDER BY pc.property_id, pc.expiry_date`,
          [input.landlordId],
        ),
        // Open maintenance tickets per property
        pool.query(
          `SELECT mr.property_id, mr.id, mr.title, mr.status, mr.priority, mr.reported_at
           FROM maintenance_request mr
           JOIN property p ON p.id = mr.property_id
           WHERE p.landlord_id = $1 AND p.is_managed = true
             AND mr.status NOT IN ('completed', 'closed')
           ORDER BY mr.property_id, mr.reported_at DESC`,
          [input.landlordId],
        ),
        // Active arrears per property
        pool.query(
          `SELECT a.property_id, a.id, a.amount, a.days_overdue, a.status, t.name AS tenant_name
           FROM arrears a
           JOIN property p ON p.id = a.property_id
           LEFT JOIN tenant t ON t.id = a.tenant_id
           WHERE p.landlord_id = $1 AND p.is_managed = true
             AND a.status IN ('active', 'partially_paid')
           ORDER BY a.property_id`,
          [input.landlordId],
        ),
        // Active/pending tenancies per property
        pool.query(
          `SELECT tn.property_id, tn.id, tn.status, tn.start_date, tn.end_date,
                  tn.rent_amount, t.name AS tenant_name
           FROM tenancy tn
           JOIN property p ON p.id = tn.property_id
           LEFT JOIN tenant t ON t.id = tn.tenant_id
           WHERE p.landlord_id = $1 AND p.is_managed = true
             AND tn.status IN ('active', 'pending')
           ORDER BY tn.property_id`,
          [input.landlordId],
        ),
      ]);

    return JSON.stringify({
      propertyCount: propertiesRes.rows.length,
      properties: propertiesRes.rows,
      complianceByProperty: complianceRes.rows,
      maintenanceByProperty: maintenanceRes.rows,
      arrearsByProperty: arrearsRes.rows,
      tenancies: tenancyRes.rows,
    });
  },
});

// ---- 2. Property Health ----

export const queryPropertyHealthTool = tool({
  name: 'query_property_health',
  description:
    'Get the health status of a single property: compliance, maintenance, arrears, and tenancy.',
  parameters: z4.object({
    propertyId: z4.number().describe('The property ID to check health for'),
  }),
  execute: async (_context: AgentContext, input: { propertyId: number }) => {
    const { pool } = await import('../../db');
    const now = new Date();

    const [complianceRes, maintenanceRes, arrearsRes, tenancyRes] = await Promise.all([
      pool.query(
        `SELECT id, certification_type, expiry_date, status
         FROM property_certification
         WHERE property_id = $1
         ORDER BY expiry_date`,
        [input.propertyId],
      ),
      pool.query(
        `SELECT id, title, status, priority, reported_at
         FROM maintenance_request
         WHERE property_id = $1 AND status NOT IN ('completed', 'closed')
         ORDER BY reported_at DESC`,
        [input.propertyId],
      ),
      pool.query(
        `SELECT a.id, a.amount AS amount_outstanding, a.status, a.days_overdue,
                t.name AS tenant_name
         FROM arrears a
         LEFT JOIN tenant t ON t.id = a.tenant_id
         WHERE a.property_id = $1 AND a.status IN ('active', 'partially_paid')`,
        [input.propertyId],
      ),
      pool.query(
        `SELECT tn.id, tn.status, tn.start_date, tn.end_date, tn.rent_amount,
                t.name AS tenant_name
         FROM tenancy tn
         LEFT JOIN tenant t ON t.id = tn.tenant_id
         WHERE tn.property_id = $1 AND tn.status IN ('active', 'pending')
         ORDER BY tn.start_date DESC
         LIMIT 1`,
        [input.propertyId],
      ),
    ]);

    // Add health flag to compliance entries
    const compliance = complianceRes.rows.map((cert: any) => {
      const expiry = new Date(cert.expiry_date);
      const daysUntilExpiry = Math.floor(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      let healthFlag = 'valid';
      if (daysUntilExpiry < 0) healthFlag = 'expired';
      else if (daysUntilExpiry <= 30) healthFlag = 'expiring_soon';
      return { ...cert, healthFlag, daysUntilExpiry };
    });

    return JSON.stringify({
      compliance,
      activeMaintenanceTickets: maintenanceRes.rows,
      activeArrears: arrearsRes.rows,
      currentTenancy: tenancyRes.rows[0] || null,
    });
  },
});

// ---- 3. Compliance Status ----

export const queryComplianceStatusTool = tool({
  name: 'query_compliance_status',
  description:
    'Get compliance certification status for a landlord portfolio or specific property. Returns certifications with expiry health flags.',
  parameters: z4.object({
    landlordId: z4.number().optional().describe('Landlord ID to get all property certifications'),
    propertyId: z4.number().optional().describe('Property ID to get certifications for a single property'),
  }),
  execute: async (
    _context: AgentContext,
    input: { landlordId?: number; propertyId?: number },
  ) => {
    const { pool } = await import('../../db');
    const now = new Date();

    let query: string;
    let params: any[];

    if (input.propertyId) {
      query = `SELECT pc.id, pc.property_id, pc.certification_type, pc.expiry_date, pc.status,
                      p.address_line1, p.postcode
               FROM property_certification pc
               JOIN property p ON p.id = pc.property_id
               WHERE pc.property_id = $1
               ORDER BY pc.expiry_date`;
      params = [input.propertyId];
    } else if (input.landlordId) {
      query = `SELECT pc.id, pc.property_id, pc.certification_type, pc.expiry_date, pc.status,
                      p.address_line1, p.postcode
               FROM property_certification pc
               JOIN property p ON p.id = pc.property_id
               WHERE p.landlord_id = $1 AND p.is_managed = true
               ORDER BY pc.property_id, pc.expiry_date`;
      params = [input.landlordId];
    } else {
      return JSON.stringify({ error: 'Either landlordId or propertyId is required' });
    }

    const result = await pool.query(query, params);

    const certifications = result.rows.map((cert: any) => {
      const expiry = new Date(cert.expiry_date);
      const daysUntilExpiry = Math.floor(
        (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      let healthFlag = 'valid';
      if (daysUntilExpiry < 0) healthFlag = 'expired';
      else if (daysUntilExpiry <= 30) healthFlag = 'expiring_soon';
      return { ...cert, healthFlag, daysUntilExpiry };
    });

    return JSON.stringify({
      total: certifications.length,
      expired: certifications.filter((c: any) => c.healthFlag === 'expired').length,
      expiringSoon: certifications.filter((c: any) => c.healthFlag === 'expiring_soon').length,
      valid: certifications.filter((c: any) => c.healthFlag === 'valid').length,
      certifications,
    });
  },
});

// ---- 4. Maintenance Activity ----

export const queryMaintenanceActivityTool = tool({
  name: 'query_maintenance_activity',
  description:
    'Get maintenance request activity for a landlord portfolio or property within a date range.',
  parameters: z4.object({
    landlordId: z4.number().optional().describe('Landlord ID for portfolio-wide maintenance'),
    propertyId: z4.number().optional().describe('Property ID for single property maintenance'),
    dateRangeDays: z4.number().optional().describe('Number of days to look back (default 30)'),
  }),
  execute: async (
    _context: AgentContext,
    input: { landlordId?: number; propertyId?: number; dateRangeDays?: number },
  ) => {
    const { pool } = await import('../../db');
    const days = input.dateRangeDays ?? 30;

    let whereClause: string;
    let params: any[];

    if (input.propertyId) {
      whereClause = 'mr.property_id = $1';
      params = [input.propertyId];
    } else if (input.landlordId) {
      whereClause = 'p.landlord_id = $1 AND p.is_managed = true';
      params = [input.landlordId];
    } else {
      return JSON.stringify({ error: 'Either landlordId or propertyId is required' });
    }

    const result = await pool.query(
      `SELECT mr.id, mr.property_id, mr.title, mr.status, mr.priority,
              mr.reported_at, mr.completed_at,
              p.address_line1, p.postcode
       FROM maintenance_request mr
       JOIN property p ON p.id = mr.property_id
       WHERE ${whereClause}
         AND mr.reported_at >= NOW() - INTERVAL '${days} days'
       ORDER BY mr.reported_at DESC`,
      params,
    );

    // Count by status
    const statusCounts: Record<string, number> = {};
    for (const row of result.rows) {
      statusCounts[row.status] = (statusCounts[row.status] || 0) + 1;
    }

    return JSON.stringify({
      total: result.rows.length,
      dateRangeDays: days,
      statusCounts,
      requests: result.rows,
    });
  },
});

// ---- 5. Arrears Overview ----

export const queryArrearsOverviewTool = tool({
  name: 'query_arrears_overview',
  description:
    'Get active arrears cases for a landlord portfolio or property, with tenant details and days overdue.',
  parameters: z4.object({
    landlordId: z4.number().optional().describe('Landlord ID for portfolio-wide arrears'),
    propertyId: z4.number().optional().describe('Property ID for single property arrears'),
  }),
  execute: async (
    _context: AgentContext,
    input: { landlordId?: number; propertyId?: number },
  ) => {
    const { pool } = await import('../../db');

    let whereClause: string;
    let params: any[];

    if (input.propertyId) {
      whereClause = 'a.property_id = $1';
      params = [input.propertyId];
    } else if (input.landlordId) {
      whereClause = 'p.landlord_id = $1 AND p.is_managed = true';
      params = [input.landlordId];
    } else {
      return JSON.stringify({ error: 'Either landlordId or propertyId is required' });
    }

    const result = await pool.query(
      `SELECT a.id, a.property_id, a.amount AS amount_outstanding, a.days_overdue,
              a.status, a.last_reminder_sent, a.dunning_level,
              t.name AS tenant_name, t.email AS tenant_email,
              p.address_line1, p.postcode
       FROM arrears a
       JOIN property p ON p.id = a.property_id
       LEFT JOIN tenant t ON t.id = a.tenant_id
       WHERE ${whereClause}
         AND a.status IN ('active', 'partially_paid')
       ORDER BY a.days_overdue DESC`,
      params,
    );

    const totalOutstanding = result.rows.reduce(
      (sum: number, row: any) => sum + (row.amount_outstanding || 0),
      0,
    );

    return JSON.stringify({
      totalCases: result.rows.length,
      totalOutstandingPence: totalOutstanding,
      totalOutstandingPounds: (totalOutstanding / 100).toFixed(2),
      cases: result.rows,
    });
  },
});

// ---- 6. Tenancy Timeline ----

export const queryTenancyTimelineTool = tool({
  name: 'query_tenancy_timeline',
  description:
    'Get tenancy details for a landlord portfolio or property. Highlights upcoming renewals (end date within 90 days).',
  parameters: z4.object({
    landlordId: z4.number().optional().describe('Landlord ID for portfolio-wide tenancies'),
    propertyId: z4.number().optional().describe('Property ID for single property tenancies'),
  }),
  execute: async (
    _context: AgentContext,
    input: { landlordId?: number; propertyId?: number },
  ) => {
    const { pool } = await import('../../db');
    const now = new Date();

    let whereClause: string;
    let params: any[];

    if (input.propertyId) {
      whereClause = 'tn.property_id = $1';
      params = [input.propertyId];
    } else if (input.landlordId) {
      whereClause = 'p.landlord_id = $1 AND p.is_managed = true';
      params = [input.landlordId];
    } else {
      return JSON.stringify({ error: 'Either landlordId or propertyId is required' });
    }

    const result = await pool.query(
      `SELECT tn.id, tn.property_id, tn.status, tn.start_date, tn.end_date,
              tn.rent_amount, tn.rent_frequency,
              t.name AS tenant_name,
              p.address_line1, p.postcode
       FROM tenancy tn
       JOIN property p ON p.id = tn.property_id
       LEFT JOIN tenant t ON t.id = tn.tenant_id
       WHERE ${whereClause}
       ORDER BY tn.start_date DESC`,
      params,
    );

    const tenancies = result.rows.map((tn: any) => {
      let renewalFlag = 'none';
      if (tn.end_date) {
        const endDate = new Date(tn.end_date);
        const daysUntilEnd = Math.floor(
          (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysUntilEnd < 0) renewalFlag = 'expired';
        else if (daysUntilEnd <= 90) renewalFlag = 'upcoming_renewal';
      }
      return { ...tn, renewalFlag };
    });

    const upcomingRenewals = tenancies.filter(
      (tn: any) => tn.renewalFlag === 'upcoming_renewal',
    );

    return JSON.stringify({
      total: tenancies.length,
      upcomingRenewals: upcomingRenewals.length,
      tenancies,
    });
  },
});

// ---- 7. Landlord Portfolio Lookup ----

export const lookupLandlordPortfolioTool = tool({
  name: 'lookup_landlord_portfolio',
  description:
    'Find a landlord by phone number or email address. Entry point for inbound landlord conversations.',
  parameters: z4.object({
    phoneOrEmail: z4
      .string()
      .describe('Phone number or email address to search for the landlord'),
  }),
  execute: async (_context: AgentContext, input: { phoneOrEmail: string }) => {
    const { pool } = await import('../../db');

    const searchValue = input.phoneOrEmail.trim();

    const landlordRes = await pool.query(
      `SELECT l.id, l.name, l.email, l.phone, l.mobile,
              (SELECT COUNT(*) FROM property p WHERE p.landlord_id = l.id AND p.is_managed = true) AS property_count
       FROM landlord l
       WHERE l.phone = $1 OR l.mobile = $1 OR l.email = $1
       LIMIT 5`,
      [searchValue],
    );

    if (landlordRes.rows.length === 0) {
      return JSON.stringify({
        found: false,
        message: 'No landlord found matching that phone number or email address.',
      });
    }

    return JSON.stringify({
      found: true,
      landlords: landlordRes.rows.map((l: any) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        propertyCount: parseInt(l.property_count, 10),
      })),
    });
  },
});
