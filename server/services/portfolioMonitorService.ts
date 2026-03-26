/**
 * Portfolio Monitor Service
 *
 * pg-boss cron jobs for proactive portfolio monitoring:
 * - Daily compliance check: identifies certifications expiring within 30 days
 * - Weekly health report: summarises per-landlord property health scores
 *
 * Handler functions are exported for unit testing without pg-boss.
 */

import PgBoss from 'pg-boss';

// ---- Lazy pg-boss init ----

let _boss: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (!_boss) {
    _boss = new PgBoss(process.env.DATABASE_URL || '');
    await _boss.start();
  }
  return _boss;
}

// ---- Configuration ----

const PM_STAFF_EMAIL = process.env.PM_STAFF_EMAIL || null;

// ---- Lazy imports (avoid DB connection at module load) ----

let _pool: any = null;
async function getPool() {
  if (!_pool) {
    const mod = await import('../db');
    _pool = mod.pool;
  }
  return _pool;
}

let _emailService: any = null;
async function getEmailService() {
  if (!_emailService) {
    const mod = await import('../emailService');
    _emailService = mod.emailService;
  }
  return _emailService;
}

// ---- Health score formula ----

export function calculateHealthScore(metrics: {
  expiredCerts: number;
  expiringCerts: number;
  openTickets: number;
  activeArrears: number;
  isVacant: boolean;
}): number {
  let score = 100;
  score -= metrics.expiredCerts * 20;
  score -= metrics.expiringCerts * 10;
  score -= metrics.openTickets * 5;
  score -= metrics.activeArrears * 15;
  if (metrics.isVacant) score -= 25;
  return Math.max(0, score);
}

// ---- Daily compliance check handler ----

export async function handleComplianceCheck(): Promise<void> {
  const pool = await getPool();

  // Query both certification tables for expiring/expired certs
  const { rows } = await pool.query(`
    SELECT
      pc.id AS cert_id,
      pc.certification_type AS cert_type,
      pc.expiry_date,
      pc.status,
      p.id AS property_id,
      p.address AS property_address,
      l.id AS landlord_id,
      l.name AS landlord_name,
      l.email AS landlord_email,
      CASE
        WHEN pc.expiry_date < CURRENT_DATE THEN 'expired'
        ELSE 'expiring_soon'
      END AS urgency
    FROM property_certification pc
    JOIN property p ON p.id = pc.property_id
    LEFT JOIN landlord l ON l.id = p.landlord_id
    WHERE pc.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
      AND pc.status NOT IN ('renewed', 'superseded')
    ORDER BY pc.expiry_date ASC
  `);

  if (rows.length === 0) {
    console.log('[PortfolioMonitor] Daily compliance check: no expiring certifications found');
    return;
  }

  // Group by urgency
  const expired = rows.filter((r: any) => r.urgency === 'expired');
  const expiringSoon = rows.filter((r: any) => r.urgency === 'expiring_soon');

  // Build email HTML
  const emailHtml = buildComplianceEmailHtml(expired, expiringSoon);
  const subject = `Compliance Alert: ${rows.length} certification(s) require attention`;

  // Determine recipient
  const recipientEmail = await getStaffEmail(pool);

  if (recipientEmail) {
    const emailService = await getEmailService();
    await emailService.sendEmail(recipientEmail, subject, emailHtml);
  }

  // Create notification records for each cert
  for (const cert of rows) {
    try {
      await pool.query(`
        INSERT INTO notification (user_id, title, body, type, created_at)
        VALUES (
          (SELECT id FROM users WHERE role = 'admin' LIMIT 1),
          $1, $2, 'compliance_alert', NOW()
        )
      `, [
        `${cert.urgency === 'expired' ? 'EXPIRED' : 'Expiring'}: ${cert.cert_type}`,
        `${cert.cert_type} for ${cert.property_address} ${cert.urgency === 'expired' ? 'has expired' : 'expires on ' + new Date(cert.expiry_date).toLocaleDateString('en-GB')}`,
      ]);
    } catch (err) {
      console.error('[PortfolioMonitor] Failed to create notification:', err);
    }
  }

  // Audit log
  try {
    await pool.query(`
      INSERT INTO agent_audit_log (agent_type, action, tool_input, created_at)
      VALUES ('system', 'compliance_check', $1, NOW())
    `, [JSON.stringify({ expiredCount: expired.length, expiringCount: expiringSoon.length })]);
  } catch (err) {
    console.error('[PortfolioMonitor] Failed to write audit log:', err);
  }

  console.log(`[PortfolioMonitor] Daily compliance check: ${expired.length} expired, ${expiringSoon.length} expiring soon`);
}

// ---- Weekly health report handler ----

export async function handleWeeklyHealthReport(): Promise<void> {
  const pool = await getPool();

  // Get all managed properties with aggregated health data
  const { rows } = await pool.query(`
    SELECT
      p.id AS property_id,
      p.address AS property_address,
      l.id AS landlord_id,
      l.name AS landlord_name,
      -- Compliance: expired certs
      COALESCE((
        SELECT COUNT(*) FROM property_certification pc
        WHERE pc.property_id = p.id
          AND pc.expiry_date < CURRENT_DATE
          AND pc.status NOT IN ('renewed', 'superseded')
      ), 0)::int AS expired_certs,
      -- Compliance: expiring within 30 days
      COALESCE((
        SELECT COUNT(*) FROM property_certification pc
        WHERE pc.property_id = p.id
          AND pc.expiry_date >= CURRENT_DATE
          AND pc.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
          AND pc.status NOT IN ('renewed', 'superseded')
      ), 0)::int AS expiring_certs,
      -- Maintenance: open tickets
      COALESCE((
        SELECT COUNT(*) FROM maintenance_ticket mt
        WHERE mt.property_id = p.id
          AND mt.status NOT IN ('completed', 'closed', 'cancelled')
      ), 0)::int AS open_tickets,
      -- Arrears: active cases and total outstanding
      COALESCE((
        SELECT COUNT(*) FROM arrears a
        WHERE a.property_id = p.id
          AND a.status = 'active'
      ), 0)::int AS active_arrears,
      COALESCE((
        SELECT SUM(a.amount) FROM arrears a
        WHERE a.property_id = p.id
          AND a.status = 'active'
      ), 0)::int AS total_outstanding_pence,
      -- Vacancy: no active tenancy
      NOT EXISTS (
        SELECT 1 FROM tenancy_contract tc
        WHERE tc.property_id = p.id
          AND tc.status = 'active'
      ) AS is_vacant
    FROM property p
    LEFT JOIN landlord l ON l.id = p.landlord_id
    WHERE p.is_managed = true
    ORDER BY l.name, p.address
  `);

  if (rows.length === 0) {
    console.log('[PortfolioMonitor] Weekly health report: no managed properties found');
    return;
  }

  // Calculate health scores and group by landlord
  const landlordGroups: Record<string, Array<{
    propertyAddress: string;
    healthScore: number;
    expiredCerts: number;
    expiringCerts: number;
    openTickets: number;
    activeArrears: number;
    totalOutstanding: number;
    isVacant: boolean;
  }>> = {};

  for (const row of rows) {
    const landlordName = row.landlord_name || 'Unassigned';
    if (!landlordGroups[landlordName]) {
      landlordGroups[landlordName] = [];
    }

    const healthScore = calculateHealthScore({
      expiredCerts: row.expired_certs,
      expiringCerts: row.expiring_certs,
      openTickets: row.open_tickets,
      activeArrears: row.active_arrears,
      isVacant: row.is_vacant,
    });

    landlordGroups[landlordName].push({
      propertyAddress: row.property_address,
      healthScore,
      expiredCerts: row.expired_certs,
      expiringCerts: row.expiring_certs,
      openTickets: row.open_tickets,
      activeArrears: row.active_arrears,
      totalOutstanding: row.total_outstanding_pence,
      isVacant: row.is_vacant,
    });
  }

  // Build and send email
  const emailHtml = buildHealthReportHtml(landlordGroups);
  const subject = `Weekly Portfolio Health Report: ${rows.length} managed properties`;

  const recipientEmail = await getStaffEmail(pool);

  if (recipientEmail) {
    const emailService = await getEmailService();
    await emailService.sendEmail(recipientEmail, subject, emailHtml);
  }

  // Audit log
  try {
    await pool.query(`
      INSERT INTO agent_audit_log (agent_type, action, tool_input, created_at)
      VALUES ('system', 'weekly_health_report', $1, NOW())
    `, [JSON.stringify({ propertyCount: rows.length, landlordCount: Object.keys(landlordGroups).length })]);
  } catch (err) {
    console.error('[PortfolioMonitor] Failed to write audit log:', err);
  }

  console.log(`[PortfolioMonitor] Weekly health report: ${rows.length} properties across ${Object.keys(landlordGroups).length} landlords`);
}

// ---- Registration ----

export async function registerPortfolioMonitorJobs(): Promise<void> {
  const boss = await getBoss();

  // Daily compliance check at 8am
  await boss.schedule('pm:daily-compliance-check', '0 8 * * *');
  await boss.work('pm:daily-compliance-check', async () => {
    try {
      await handleComplianceCheck();
    } catch (err) {
      console.error('[PortfolioMonitor] Daily compliance check failed:', err);
    }
  });

  // Weekly health report at 9am Monday
  await boss.schedule('pm:weekly-health-report', '0 9 * * 1');
  await boss.work('pm:weekly-health-report', async () => {
    try {
      await handleWeeklyHealthReport();
    } catch (err) {
      console.error('[PortfolioMonitor] Weekly health report failed:', err);
    }
  });

  console.log('[PortfolioMonitor] Cron jobs registered: daily compliance (8am), weekly health (Mon 9am)');
}

// ---- Helpers ----

async function getStaffEmail(pool: any): Promise<string | null> {
  if (PM_STAFF_EMAIL) return PM_STAFF_EMAIL;

  // Fall back to first admin user
  try {
    const { rows } = await pool.query(`
      SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL LIMIT 1
    `);
    return rows.length > 0 ? rows[0].email : null;
  } catch {
    return null;
  }
}

function buildComplianceEmailHtml(
  expired: any[],
  expiringSoon: any[],
): string {
  let html = `
    <h2 style="color: #791E75;">Compliance Alert</h2>
    <p>The following property certifications require attention:</p>
  `;

  if (expired.length > 0) {
    html += `
      <h3 style="color: #dc2626;">Expired (${expired.length})</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background: #fef2f2;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Property</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Certificate Type</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Expiry Date</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Landlord</th>
          </tr>
        </thead>
        <tbody>
          ${expired.map((r: any) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.property_address}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.cert_type}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${new Date(r.expiry_date).toLocaleDateString('en-GB')}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.landlord_name || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  if (expiringSoon.length > 0) {
    html += `
      <h3 style="color: #d97706;">Expiring Soon (${expiringSoon.length})</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background: #fffbeb;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Property</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Certificate Type</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Expiry Date</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Landlord</th>
          </tr>
        </thead>
        <tbody>
          ${expiringSoon.map((r: any) => `
            <tr>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.property_address}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.cert_type}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${new Date(r.expiry_date).toLocaleDateString('en-GB')}</td>
              <td style="border: 1px solid #ddd; padding: 8px;">${r.landlord_name || 'N/A'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  html += `<p style="color: #666; font-size: 12px; margin-top: 20px;">Generated by John Barclay CRM Portfolio Monitor</p>`;
  return html;
}

function buildHealthReportHtml(
  landlordGroups: Record<string, Array<{
    propertyAddress: string;
    healthScore: number;
    expiredCerts: number;
    expiringCerts: number;
    openTickets: number;
    activeArrears: number;
    totalOutstanding: number;
    isVacant: boolean;
  }>>,
): string {
  let html = `
    <h2 style="color: #791E75;">Weekly Portfolio Health Report</h2>
    <p>Managed property health summary grouped by landlord:</p>
  `;

  for (const [landlordName, properties] of Object.entries(landlordGroups)) {
    const avgScore = Math.round(
      properties.reduce((sum, p) => sum + p.healthScore, 0) / properties.length,
    );
    const scoreColor = avgScore >= 80 ? '#16a34a' : avgScore >= 50 ? '#d97706' : '#dc2626';

    html += `
      <h3>${landlordName} <span style="color: ${scoreColor};">(Avg Score: ${avgScore})</span></h3>
      <table style="border-collapse: collapse; width: 100%; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f3f4f6;">
            <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Property</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Score</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Expired Certs</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Expiring</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Open Tickets</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Arrears</th>
            <th style="border: 1px solid #ddd; padding: 8px; text-align: center;">Vacant</th>
          </tr>
        </thead>
        <tbody>
          ${properties.map((p) => {
            const color = p.healthScore >= 80 ? '#16a34a' : p.healthScore >= 50 ? '#d97706' : '#dc2626';
            return `
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">${p.propertyAddress}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center; color: ${color}; font-weight: bold;">${p.healthScore}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${p.expiredCerts}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${p.expiringCerts}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${p.openTickets}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${p.activeArrears > 0 ? `${p.activeArrears} (${(p.totalOutstanding / 100).toFixed(2)})` : '0'}</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${p.isVacant ? 'Yes' : 'No'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  html += `<p style="color: #666; font-size: 12px; margin-top: 20px;">Generated by John Barclay CRM Portfolio Monitor</p>`;
  return html;
}
