import { Router } from 'express';
import { pool } from './db';
import { generateExcel } from './lib/excelExporter';

const router = Router();

// ==========================================
// AUTH MIDDLEWARE
// ==========================================
const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'agent') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
};

// ==========================================
// HELPER: sendReport
// ==========================================
async function sendReport(
  res: any,
  data: any[],
  reportName: string,
  format: string,
  dateRange?: { from: string; to: string }
) {
  if (format === 'xlsx') {
    const buffer = generateExcel(data, {
      title: reportName,
      sheetName: reportName.substring(0, 31),
      dateRange,
    });
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${reportName.replace(/\s+/g, '_')}.xlsx"`
    );
    return res.send(buffer);
  }
  return res.json({ reportName, count: data.length, dateRange, data });
}

// ==========================================
// REPORT INDEX
// ==========================================
router.get('/reports/index', requireAgent, (_req, res) => {
  const index = {
    tabs: [
      {
        id: 'property',
        label: 'Property',
        reports: [
          { id: 'complete-list', name: 'Complete Property List', endpoint: '/api/crm/reports/property/complete-list', filters: [] },
          { id: 'let-list', name: 'Let List', endpoint: '/api/crm/reports/property/let-list', filters: [{ name: 'detail', type: 'select', options: ['brief', 'detailed'], label: 'Detail Level' }] },
          { id: 'to-let', name: 'Properties To Let', endpoint: '/api/crm/reports/property/to-let', filters: [] },
          { id: 'under-application', name: 'Under Application', endpoint: '/api/crm/reports/property/under-application', filters: [] },
          { id: 'becoming-available', name: 'Becoming Available', endpoint: '/api/crm/reports/property/becoming-available', filters: [{ name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' }] },
          { id: 'by-category', name: 'Properties By Category', endpoint: '/api/crm/reports/property/by-category', filters: [{ name: 'category', type: 'select', options: ['hmo', 'student', 'holiday', 'council'], label: 'Category' }] },
          { id: 'arrears', name: 'Properties In Arrears', endpoint: '/api/crm/reports/property/arrears', filters: [] },
          { id: 'rent-reviews', name: 'Rent Reviews Due', endpoint: '/api/crm/reports/property/rent-reviews', filters: [] },
        ],
      },
      {
        id: 'landlord',
        label: 'Landlords',
        reports: [
          { id: 'by-type', name: 'Landlords By Type', endpoint: '/api/crm/reports/landlord/by-type', filters: [{ name: 'type', type: 'select', options: ['managed', 'let_and_collect', 'let_only', 'overseas', 'dormant', 'all'], label: 'Type' }] },
          { id: 'occupancy-rents', name: 'Occupancy & Rents', endpoint: '/api/crm/reports/landlord/occupancy-rents', filters: [] },
          { id: 'contacts', name: 'Landlord Contacts', endpoint: '/api/crm/reports/landlord/contacts', filters: [] },
        ],
      },
      {
        id: 'tenant',
        label: 'Tenants',
        reports: [
          { id: 'accommodated', name: 'Accommodated Tenants', endpoint: '/api/crm/reports/tenant/accommodated', filters: [] },
          { id: 'past', name: 'Past Tenants', endpoint: '/api/crm/reports/tenant/past', filters: [] },
          { id: 'vacating', name: 'Vacating Tenants', endpoint: '/api/crm/reports/tenant/vacating', filters: [{ name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' }] },
          { id: 'arrears', name: 'Tenants In Arrears', endpoint: '/api/crm/reports/tenant/arrears', filters: [] },
          { id: 'renewals-due', name: 'Renewals Due', endpoint: '/api/crm/reports/tenant/renewals-due', filters: [{ name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' }] },
        ],
      },
      {
        id: 'applicant',
        label: 'Applicants',
        reports: [
          { id: 'registered', name: 'Registered Applicants', endpoint: '/api/crm/reports/applicant/registered', filters: [{ name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' }] },
          { id: 'not-contacted', name: 'Not Contacted', endpoint: '/api/crm/reports/applicant/not-contacted', filters: [{ name: 'since', type: 'date', label: 'Not contacted since' }] },
          { id: 'media', name: 'Lead Source Breakdown', endpoint: '/api/crm/reports/applicant/media', filters: [] },
        ],
      },
      {
        id: 'general',
        label: 'General',
        reports: [
          { id: 'contractors', name: 'Contractor List', endpoint: '/api/crm/reports/general/contractors', filters: [] },
          { id: 'rental-collections', name: 'Rental Collections', endpoint: '/api/crm/reports/general/rental-collections', filters: [{ name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' }] },
          { id: 'property-registrations', name: 'Property Registrations', endpoint: '/api/crm/reports/general/property-registrations', filters: [{ name: 'from', type: 'date', label: 'From' }, { name: 'to', type: 'date', label: 'To' }] },
        ],
      },
      {
        id: 'accounting',
        label: 'Accounting',
        reports: [
          { id: 'landlord-balances', name: 'Landlord Balances', endpoint: '/api/crm/reports/accounting/landlord-balances', filters: [] },
          { id: 'deposits-held', name: 'Deposits Held', endpoint: '/api/crm/reports/accounting/deposits-held', filters: [] },
          { id: 'landlords-in-arrears', name: 'Landlords In Arrears', endpoint: '/api/crm/reports/accounting/landlords-in-arrears', filters: [] },
        ],
      },
    ],
  };
  res.json(index);
});

// ==========================================
// PROPERTY REPORTS
// ==========================================

// Complete property list
router.get('/reports/property/complete-list', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        p.id,
        p.title,
        p.address_line1,
        p.address_line2,
        p.postcode,
        p.city,
        p.property_type,
        p.bedrooms,
        p.bathrooms,
        p.status,
        p.management_status,
        p.management_type,
        p.rent_amount,
        p.price,
        p.is_managed,
        p.is_rental,
        p.is_listed,
        l.name AS landlord_name,
        l.email AS landlord_email,
        t.name AS tenant_name,
        t.email AS tenant_email,
        p.created_at
      FROM property p
      LEFT JOIN landlord l ON l.id = p.landlord_id
      LEFT JOIN tenant t ON t.property_id = p.id AND t.status = 'active'
      ORDER BY p.created_at DESC
    `);
    await sendReport(res, result.rows, 'Complete Property List', format);
  } catch (err) {
    console.error('[Report] complete-list error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Let list
router.get('/reports/property/let-list', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const detail = (req.query.detail as string) || 'brief';
  try {
    const cols = detail === 'detailed'
      ? `p.id, p.title, p.address_line1, p.postcode, p.city, p.property_type, p.bedrooms,
         p.rent_amount, p.management_type, p.management_fee_value,
         l.name AS landlord_name, l.email AS landlord_email, l.phone AS landlord_phone,
         t.name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone,
         tn.start_date AS tenancy_start, tn.end_date AS tenancy_end,
         tn.rent_amount AS tenancy_rent, tn.deposit_amount, tn.deposit_scheme`
      : `p.id, p.title, p.address_line1, p.postcode, p.rent_amount,
         l.name AS landlord_name, t.name AS tenant_name, tn.start_date, tn.end_date`;

    const result = await pool.query(`
      SELECT ${cols}
      FROM property p
      LEFT JOIN landlord l ON l.id = p.landlord_id
      LEFT JOIN tenancy tn ON tn.property_id = p.id AND tn.status = 'active'
      LEFT JOIN tenant t ON t.id = tn.tenant_id
      WHERE p.is_managed = true AND p.management_status = 'occupied'
      ORDER BY p.address_line1
    `);
    await sendReport(res, result.rows, 'Let List', format);
  } catch (err) {
    console.error('[Report] let-list error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// To-let (available)
router.get('/reports/property/to-let', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.address_line1, p.postcode, p.city,
        p.property_type, p.bedrooms, p.bathrooms,
        p.rent_amount, p.available_from,
        l.name AS landlord_name, l.phone AS landlord_phone
      FROM property p
      LEFT JOIN landlord l ON l.id = p.landlord_id
      WHERE p.is_managed = true
        AND (p.management_status = 'void' OR p.status = 'un_let')
      ORDER BY p.available_from ASC NULLS LAST
    `);
    await sendReport(res, result.rows, 'Properties To Let', format);
  } catch (err) {
    console.error('[Report] to-let error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Under application
router.get('/reports/property/under-application', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.address_line1, p.postcode, p.property_type, p.bedrooms,
        p.rent_amount, p.status,
        l.name AS landlord_name,
        t.name AS applicant_name, t.email AS applicant_email
      FROM property p
      LEFT JOIN landlord l ON l.id = p.landlord_id
      LEFT JOIN tenant t ON t.property_id = p.id AND t.status = 'applicant'
      WHERE p.status = 'under_application'
      ORDER BY p.updated_at DESC
    `);
    await sendReport(res, result.rows, 'Under Application', format);
  } catch (err) {
    console.error('[Report] under-application error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Becoming available (tenancies ending in date range)
router.get('/reports/property/becoming-available', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.address_line1, p.postcode, p.property_type, p.bedrooms,
        p.rent_amount,
        l.name AS landlord_name, l.phone AS landlord_phone,
        t.name AS tenant_name,
        tn.end_date, tn.notice_served_date, tn.notice_type, tn.rent_amount AS tenancy_rent
      FROM tenancy tn
      JOIN property p ON p.id = tn.property_id
      LEFT JOIN landlord l ON l.id = tn.landlord_id
      LEFT JOIN tenant t ON t.id = tn.tenant_id
      WHERE tn.end_date BETWEEN $1 AND $2
        AND tn.status = 'active'
      ORDER BY tn.end_date ASC
    `, [from, to]);
    await sendReport(res, result.rows, 'Becoming Available', format, { from, to });
  } catch (err) {
    console.error('[Report] becoming-available error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// By category (hmo, student, holiday, council)
router.get('/reports/property/by-category', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const category = (req.query.category as string) || 'hmo';

  const categoryMap: Record<string, string> = {
    hmo: 'is_hmo = true',
    student: 'is_student_let = true',
    holiday: 'is_holiday_let = true',
    council: 'is_council_let = true',
  };

  const filter = categoryMap[category] || 'is_hmo = true';
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.address_line1, p.postcode, p.property_type, p.bedrooms,
        p.rent_amount, p.status, p.management_status,
        l.name AS landlord_name
      FROM property p
      LEFT JOIN landlord l ON l.id = p.landlord_id
      WHERE ${filter}
      ORDER BY p.address_line1
    `);
    await sendReport(res, result.rows, `Properties By Category: ${category}`, format);
  } catch (err) {
    console.error('[Report] by-category error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Properties with arrears
router.get('/reports/property/arrears', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.address_line1, p.postcode,
        l.name AS landlord_name, l.phone AS landlord_phone,
        t.name AS tenant_name, t.email AS tenant_email, t.phone AS tenant_phone,
        a.amount AS arrears_amount_pence,
        ROUND(a.amount::numeric / 100, 2) AS arrears_amount_pounds,
        a.days_overdue, a.status AS arrears_status, a.dunning_level,
        a.created_at AS arrears_since
      FROM arrears a
      JOIN property p ON p.id = a.property_id
      LEFT JOIN landlord l ON l.id = p.landlord_id
      LEFT JOIN tenant t ON t.id = a.tenant_id
      WHERE a.status = 'active'
      ORDER BY a.days_overdue DESC
    `);
    await sendReport(res, result.rows, 'Properties In Arrears', format);
  } catch (err) {
    console.error('[Report] property-arrears error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Rent reviews (tenancies ending within 3 months)
router.get('/reports/property/rent-reviews', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const now = new Date();
  const threeMonths = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.address_line1, p.postcode,
        l.name AS landlord_name,
        t.name AS tenant_name,
        tn.rent_amount AS current_rent_pence,
        ROUND(tn.rent_amount::numeric / 100, 2) AS current_rent_pounds,
        tn.end_date, tn.rent_frequency,
        tn.is_periodic
      FROM tenancy tn
      JOIN property p ON p.id = tn.property_id
      LEFT JOIN landlord l ON l.id = tn.landlord_id
      LEFT JOIN tenant t ON t.id = tn.tenant_id
      WHERE tn.status = 'active'
        AND tn.end_date BETWEEN $1 AND $2
      ORDER BY tn.end_date ASC
    `, [now.toISOString(), threeMonths.toISOString()]);
    await sendReport(res, result.rows, 'Rent Reviews Due', format);
  } catch (err) {
    console.error('[Report] rent-reviews error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ==========================================
// LANDLORD REPORTS
// ==========================================

// Landlords by type
router.get('/reports/landlord/by-type', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const type = (req.query.type as string) || 'all';

  let whereClause = '';
  if (type === 'managed') whereClause = `AND p.management_type = 'full'`;
  else if (type === 'let_and_collect') whereClause = `AND p.management_type = 'let_and_collect'`;
  else if (type === 'let_only') whereClause = `AND p.management_type = 'let_only'`;
  else if (type === 'overseas') whereClause = `AND l.is_overseas = true`;
  else if (type === 'dormant') whereClause = `AND l.is_active = false`;

  try {
    const result = await pool.query(`
      SELECT
        l.id, l.name, l.email, l.phone, l.mobile,
        l.landlord_type, l.is_corporate, l.is_overseas, l.is_active,
        l.address_line1, l.postcode, l.city,
        COUNT(DISTINCT p.id) AS property_count,
        SUM(p.rent_amount) AS total_rent_pence,
        ROUND(SUM(p.rent_amount)::numeric / 100, 2) AS total_rent_pounds
      FROM landlord l
      LEFT JOIN property p ON p.landlord_id = l.id AND p.is_managed = true
      WHERE 1=1 ${whereClause}
      GROUP BY l.id
      ORDER BY l.name
    `);
    await sendReport(res, result.rows, `Landlords: ${type}`, format);
  } catch (err) {
    console.error('[Report] landlord-by-type error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Landlord occupancy & rents
router.get('/reports/landlord/occupancy-rents', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        l.id, l.name, l.email, l.phone,
        COUNT(DISTINCT p.id) AS total_properties,
        COUNT(DISTINCT CASE WHEN p.management_status = 'occupied' THEN p.id END) AS occupied,
        COUNT(DISTINCT CASE WHEN p.management_status = 'void' THEN p.id END) AS void_properties,
        COUNT(DISTINCT CASE WHEN p.management_status = 'dormant' THEN p.id END) AS dormant_properties,
        CASE WHEN COUNT(DISTINCT p.id) > 0
          THEN ROUND(COUNT(DISTINCT CASE WHEN p.management_status = 'occupied' THEN p.id END)::numeric / COUNT(DISTINCT p.id) * 100, 1)
          ELSE 0
        END AS occupancy_pct,
        SUM(CASE WHEN p.management_status = 'occupied' THEN p.rent_amount ELSE 0 END) AS income_pence,
        ROUND(SUM(CASE WHEN p.management_status = 'occupied' THEN p.rent_amount ELSE 0 END)::numeric / 100, 2) AS income_pounds
      FROM landlord l
      LEFT JOIN property p ON p.landlord_id = l.id AND p.is_managed = true
      WHERE l.is_active = true
      GROUP BY l.id
      ORDER BY l.name
    `);
    await sendReport(res, result.rows, 'Landlord Occupancy & Rents', format);
  } catch (err) {
    console.error('[Report] occupancy-rents error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Landlord contacts
router.get('/reports/landlord/contacts', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        l.id, l.name, l.email, l.phone, l.mobile,
        l.address_line1, l.address_line2, l.city, l.postcode,
        l.landlord_type, l.is_corporate, l.is_overseas,
        l.bank_name, l.bank_account_number, l.bank_sort_code,
        l.is_active, l.created_at
      FROM landlord l
      ORDER BY l.name
    `);
    await sendReport(res, result.rows, 'Landlord Contacts', format);
  } catch (err) {
    console.error('[Report] landlord-contacts error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ==========================================
// TENANT REPORTS
// ==========================================

// Accommodated (active) tenants
router.get('/reports/tenant/accommodated', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.email, t.phone, t.mobile,
        t.status, t.move_in_date,
        p.title AS property_title, p.address_line1, p.postcode,
        l.name AS landlord_name,
        tn.rent_amount AS rent_pence,
        ROUND(tn.rent_amount::numeric / 100, 2) AS rent_pounds,
        tn.start_date, tn.end_date, tn.deposit_amount
      FROM tenant t
      LEFT JOIN property p ON p.id = t.property_id
      LEFT JOIN landlord l ON l.id = p.landlord_id
      LEFT JOIN tenancy tn ON tn.tenant_id = t.id AND tn.status = 'active'
      WHERE t.status = 'active'
      ORDER BY t.name
    `);
    await sendReport(res, result.rows, 'Accommodated Tenants', format);
  } catch (err) {
    console.error('[Report] accommodated error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Past tenants
router.get('/reports/tenant/past', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.email, t.phone,
        t.status, t.move_in_date, t.move_out_date,
        p.title AS property_title, p.address_line1, p.postcode,
        tn.start_date, tn.end_date,
        tn.rent_amount AS rent_pence,
        ROUND(tn.rent_amount::numeric / 100, 2) AS rent_pounds
      FROM tenant t
      LEFT JOIN property p ON p.id = t.property_id
      LEFT JOIN tenancy tn ON tn.tenant_id = t.id
      WHERE t.status IN ('moved_out', 'evicted')
      ORDER BY t.move_out_date DESC NULLS LAST
    `);
    await sendReport(res, result.rows, 'Past Tenants', format);
  } catch (err) {
    console.error('[Report] past-tenants error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Vacating tenants (tenancies ending in range)
router.get('/reports/tenant/vacating', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.email, t.phone, t.mobile,
        p.title AS property_title, p.address_line1, p.postcode,
        l.name AS landlord_name,
        tn.end_date, tn.notice_served_date, tn.notice_type,
        tn.rent_amount AS rent_pence,
        ROUND(tn.rent_amount::numeric / 100, 2) AS rent_pounds,
        tn.deposit_amount, tn.deposit_return_status
      FROM tenancy tn
      JOIN tenant t ON t.id = tn.tenant_id
      JOIN property p ON p.id = tn.property_id
      LEFT JOIN landlord l ON l.id = tn.landlord_id
      WHERE tn.end_date BETWEEN $1 AND $2
        AND tn.status = 'active'
      ORDER BY tn.end_date ASC
    `, [from, to]);
    await sendReport(res, result.rows, 'Vacating Tenants', format, { from, to });
  } catch (err) {
    console.error('[Report] vacating error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Tenants in arrears
router.get('/reports/tenant/arrears', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.email, t.phone, t.mobile,
        p.title AS property_title, p.address_line1, p.postcode,
        l.name AS landlord_name,
        a.amount AS arrears_pence,
        ROUND(a.amount::numeric / 100, 2) AS arrears_pounds,
        a.days_overdue, a.dunning_level, a.status AS arrears_status,
        a.last_reminder_sent, a.next_reminder_due
      FROM arrears a
      JOIN tenant t ON t.id = a.tenant_id
      JOIN property p ON p.id = a.property_id
      LEFT JOIN landlord l ON l.id = p.landlord_id
      WHERE a.status = 'active'
      ORDER BY a.amount DESC
    `);
    await sendReport(res, result.rows, 'Tenants In Arrears', format);
  } catch (err) {
    console.error('[Report] tenant-arrears error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Renewals due
router.get('/reports/tenant/renewals-due', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const from = (req.query.from as string) || new Date().toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.name, t.email, t.phone,
        p.title AS property_title, p.address_line1, p.postcode,
        l.name AS landlord_name,
        tn.start_date, tn.end_date,
        tn.rent_amount AS rent_pence,
        ROUND(tn.rent_amount::numeric / 100, 2) AS rent_pounds,
        tn.rent_frequency, tn.is_periodic
      FROM tenancy tn
      JOIN tenant t ON t.id = tn.tenant_id
      JOIN property p ON p.id = tn.property_id
      LEFT JOIN landlord l ON l.id = tn.landlord_id
      WHERE tn.end_date BETWEEN $1 AND $2
        AND tn.status = 'active'
        AND tn.is_periodic = false
      ORDER BY tn.end_date ASC
    `, [from, to]);
    await sendReport(res, result.rows, 'Renewals Due', format, { from, to });
  } catch (err) {
    console.error('[Report] renewals-due error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ==========================================
// APPLICANT REPORTS
// ==========================================

// Registered applicants in date range
router.get('/reports/applicant/registered', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      SELECT
        id, full_name, email, phone, mobile,
        lead_type, status, source, source_detail,
        preferred_property_type, preferred_bedrooms,
        min_budget, max_budget,
        created_at, last_contacted_at
      FROM lead
      WHERE created_at BETWEEN $1 AND $2
      ORDER BY created_at DESC
    `, [from, to]);
    await sendReport(res, result.rows, 'Registered Applicants', format, { from, to });
  } catch (err) {
    console.error('[Report] registered error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Not contacted since date
router.get('/reports/applicant/not-contacted', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const since = (req.query.since as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      SELECT
        id, full_name, email, phone, mobile,
        lead_type, status, source,
        created_at, last_contacted_at, next_follow_up_date
      FROM lead
      WHERE (last_contacted_at IS NULL OR last_contacted_at < $1)
        AND status NOT IN ('converted', 'lost', 'archived')
      ORDER BY created_at ASC
    `, [since]);
    await sendReport(res, result.rows, 'Not Contacted Applicants', format);
  } catch (err) {
    console.error('[Report] not-contacted error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Lead source breakdown
router.get('/reports/applicant/media', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        source,
        lead_type,
        COUNT(*) AS total_leads,
        COUNT(CASE WHEN status = 'converted' THEN 1 END) AS converted,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) AS lost,
        COUNT(CASE WHEN status NOT IN ('converted', 'lost', 'archived') THEN 1 END) AS active,
        CASE WHEN COUNT(*) > 0
          THEN ROUND(COUNT(CASE WHEN status = 'converted' THEN 1 END)::numeric / COUNT(*) * 100, 1)
          ELSE 0
        END AS conversion_rate_pct
      FROM lead
      GROUP BY source, lead_type
      ORDER BY total_leads DESC
    `);
    await sendReport(res, result.rows, 'Lead Source Breakdown', format);
  } catch (err) {
    console.error('[Report] media error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ==========================================
// GENERAL REPORTS
// ==========================================

// Contractor list
router.get('/reports/general/contractors', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        id, company_name, contact_name, email, phone, emergency_phone,
        contractor_type, specializations, service_areas,
        available_emergency, response_time,
        ROUND(call_out_fee::numeric / 100, 2) AS call_out_fee_pounds,
        ROUND(hourly_rate::numeric / 100, 2) AS hourly_rate_pounds,
        rating, completed_jobs, is_active, preferred_contractor,
        insurance_expiry_date, gas_registration_number, electrical_cert_number
      FROM contractor
      WHERE is_active = true
      ORDER BY company_name
    `);
    await sendReport(res, result.rows, 'Contractor List', format);
  } catch (err) {
    console.error('[Report] contractors error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Rental collections in period
router.get('/reports/general/rental-collections', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      SELECT
        i.id, i.invoice_number, i.invoice_type,
        i.amount AS amount_pence,
        ROUND(i.amount::numeric / 100, 2) AS amount_pounds,
        i.due_date, i.paid_date, i.status,
        p.title AS property_title, p.address_line1, p.postcode,
        l.name AS landlord_name,
        t.name AS tenant_name
      FROM invoice i
      LEFT JOIN property p ON p.id = i.property_id
      LEFT JOIN landlord l ON l.id = i.landlord_id
      LEFT JOIN tenant t ON t.id = i.tenant_id
      WHERE i.invoice_type = 'rent'
        AND i.paid_date BETWEEN $1 AND $2
      ORDER BY i.paid_date DESC
    `, [from, to]);
    await sendReport(res, result.rows, 'Rental Collections', format, { from, to });
  } catch (err) {
    console.error('[Report] rental-collections error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Property registrations in period
router.get('/reports/general/property-registrations', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  const from = (req.query.from as string) || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const to = (req.query.to as string) || new Date().toISOString().split('T')[0];
  try {
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.address_line1, p.postcode, p.city,
        p.property_type, p.bedrooms,
        p.rent_amount, p.price, p.is_managed, p.is_rental,
        p.management_type, p.status,
        l.name AS landlord_name,
        p.created_at
      FROM property p
      LEFT JOIN landlord l ON l.id = p.landlord_id
      WHERE p.created_at BETWEEN $1 AND $2
      ORDER BY p.created_at DESC
    `, [from, to]);
    await sendReport(res, result.rows, 'Property Registrations', format, { from, to });
  } catch (err) {
    console.error('[Report] property-registrations error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// ==========================================
// ACCOUNTING REPORTS
// ==========================================

// Landlord balances
router.get('/reports/accounting/landlord-balances', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        l.id, l.name, l.email, l.phone,
        COUNT(DISTINCT p.id) AS property_count,
        COALESCE(SUM(CASE WHEN i.status = 'paid' AND i.invoice_type = 'rent' THEN i.amount ELSE 0 END), 0) AS total_collected_pence,
        ROUND(COALESCE(SUM(CASE WHEN i.status = 'paid' AND i.invoice_type = 'rent' THEN i.amount ELSE 0 END), 0)::numeric / 100, 2) AS total_collected_pounds,
        COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.amount ELSE 0 END), 0) AS outstanding_pence,
        ROUND(COALESCE(SUM(CASE WHEN i.status = 'overdue' THEN i.amount ELSE 0 END), 0)::numeric / 100, 2) AS outstanding_pounds
      FROM landlord l
      LEFT JOIN property p ON p.landlord_id = l.id
      LEFT JOIN invoice i ON i.landlord_id = l.id
      WHERE l.is_active = true
      GROUP BY l.id
      ORDER BY l.name
    `);
    await sendReport(res, result.rows, 'Landlord Balances', format);
  } catch (err) {
    console.error('[Report] landlord-balances error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Deposits held
router.get('/reports/accounting/deposits-held', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        tn.id AS tenancy_id,
        p.title AS property_title, p.address_line1, p.postcode,
        l.name AS landlord_name,
        t.name AS tenant_name, t.email AS tenant_email,
        tn.deposit_amount AS deposit_pence,
        ROUND(tn.deposit_amount::numeric / 100, 2) AS deposit_pounds,
        tn.deposit_scheme, tn.deposit_holder_type,
        tn.deposit_certificate_number, tn.deposit_protected_date,
        tn.start_date, tn.end_date, tn.status AS tenancy_status,
        tn.deposit_return_status
      FROM tenancy tn
      JOIN property p ON p.id = tn.property_id
      LEFT JOIN landlord l ON l.id = tn.landlord_id
      LEFT JOIN tenant t ON t.id = tn.tenant_id
      WHERE tn.deposit_amount IS NOT NULL
        AND tn.deposit_amount > 0
        AND tn.status = 'active'
      ORDER BY p.address_line1
    `);
    await sendReport(res, result.rows, 'Deposits Held', format);
  } catch (err) {
    console.error('[Report] deposits-held error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// Landlords in arrears
router.get('/reports/accounting/landlords-in-arrears', requireAgent, async (req: any, res) => {
  const format = (req.query.format as string) || 'json';
  try {
    const result = await pool.query(`
      SELECT
        l.id, l.name, l.email, l.phone,
        COUNT(DISTINCT a.id) AS arrears_records,
        SUM(a.amount) AS total_arrears_pence,
        ROUND(SUM(a.amount)::numeric / 100, 2) AS total_arrears_pounds,
        MAX(a.days_overdue) AS max_days_overdue,
        MAX(a.dunning_level) AS max_dunning_level,
        ARRAY_AGG(DISTINCT p.address_line1) AS properties
      FROM arrears a
      JOIN property p ON p.id = a.property_id
      JOIN landlord l ON l.id = p.landlord_id
      WHERE a.status = 'active'
      GROUP BY l.id
      ORDER BY total_arrears_pence DESC
    `);
    await sendReport(res, result.rows, 'Landlords In Arrears', format);
  } catch (err) {
    console.error('[Report] landlords-in-arrears error:', err);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export { router as reportCenterRouter };
