/**
 * Sourcing Cron Jobs
 *
 * Registers pg-boss cron schedules for Charlie's automated tasks:
 * - Daily market intelligence scan (5am)
 * - Weekly propensity scoring (Sunday 3am)
 * - Daily follow-up check (8am)
 *
 * Uses lazy imports for all service dependencies to avoid DB at module load.
 */

import PgBoss from 'pg-boss';

// ---- Lazy pg-boss init ----

let boss: PgBoss | null = null;

async function getBoss(): Promise<PgBoss> {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL || '');
    await boss.start();
  }
  return boss;
}

// ---- Lazy service imports ----

let _auditLogger: any = null;
async function getAuditLogger() {
  if (!_auditLogger) {
    const mod = await import('../middleware/auditLogger');
    _auditLogger = mod.auditLogger;
  }
  return _auditLogger;
}

let _proactiveLeadGenService: any = null;
async function getProactiveLeadGenService() {
  if (!_proactiveLeadGenService) {
    const mod = await import('../../proactiveLeadGenService');
    _proactiveLeadGenService = mod.proactiveLeadGenService;
  }
  return _proactiveLeadGenService;
}

let _pool: any = null;
async function getPool() {
  if (!_pool) {
    const mod = await import('../../db');
    _pool = mod.pool;
  }
  return _pool;
}

// ---- Monitor source types ----

const MONITOR_SOURCES = [
  'land_registry',
  'expired_listings',
  'auctions',
  'price_reductions',
  'planning_permissions',
  'competitor_listings',
] as const;

// ---- Register Cron Jobs ----

export async function registerSourcingCronJobs(): Promise<void> {
  const b = await getBoss();
  const audit = await getAuditLogger();

  // 1. Daily market intelligence scan -- every day at 5am
  await b.schedule('charlie:daily-scan', '0 5 * * *', {}, {});

  await b.work('charlie:daily-scan', async () => {
    const svc = await getProactiveLeadGenService();
    const results: Record<string, any> = {};

    for (const source of MONITOR_SOURCES) {
      try {
        const leads = await svc.runMonitor(source);
        results[source] = { count: leads?.length || 0, status: 'ok' };
      } catch (err) {
        console.error(`[Charlie Cron] Monitor ${source} failed:`, err);
        results[source] = { count: 0, status: 'error', error: String(err) };
      }
    }

    await audit.logToolCall({
      tool: 'charlie:daily-scan',
      conversationId: 0,
      contactId: 0,
      input: { sources: MONITOR_SOURCES },
      output: results,
    });

    console.log(`[Charlie Cron] Daily scan complete: ${JSON.stringify(results)}`);
  });

  // 2. Weekly propensity scoring -- Sunday at 3am
  await b.schedule('charlie:propensity-scoring', '0 3 * * 0', {}, {});

  await b.work('charlie:propensity-scoring', async () => {
    try {
      const svc = await getProactiveLeadGenService();
      const scored = await svc.runPropensityScoring();

      // Update leads scoring above threshold to ready_to_contact
      const pool = await getPool();
      const threshold = 60;
      if (scored && Array.isArray(scored)) {
        for (const lead of scored) {
          if (lead.leadScore >= threshold) {
            try {
              await pool.query(
                `UPDATE proactive_leads SET status = 'ready_to_contact', updated_at = NOW() WHERE id = $1 AND status IN ('new', 'researching')`,
                [lead.id]
              );
            } catch (updateErr) {
              console.error(`[Charlie Cron] Failed to update lead ${lead.id}:`, updateErr);
            }
          }
        }
      }

      await audit.logToolCall({
        tool: 'charlie:propensity-scoring',
        conversationId: 0,
        contactId: 0,
        input: { threshold },
        output: { scored: scored?.length || 0 },
      });

      console.log(`[Charlie Cron] Propensity scoring complete: ${scored?.length || 0} leads scored`);
    } catch (err) {
      console.error('[Charlie Cron] Propensity scoring failed:', err);
    }
  });

  // 3. Daily follow-up check -- every day at 8am
  await b.schedule('charlie:check-followups', '0 8 * * *', {}, {});

  await b.work('charlie:check-followups', async () => {
    try {
      const pool = await getPool();

      // Find leads with due follow-up dates
      const result = await pool.query(
        `SELECT id, property_address, postcode, lead_source, status, owner_name, owner_email
         FROM proactive_leads
         WHERE next_follow_up_date <= NOW()
           AND status IN ('contacted', 'responded')
         ORDER BY next_follow_up_date ASC
         LIMIT 50`
      );

      const dueLeads = result.rows;

      for (const lead of dueLeads) {
        try {
          // Get the last contact for this lead to determine sequence step
          const lastContact = await pool.query(
            `SELECT sequence_step, contact_method FROM lead_contact_history
             WHERE lead_id = $1
             ORDER BY created_at DESC LIMIT 1`,
            [lead.id]
          );

          const prevStep = lastContact.rows[0]?.sequence_step || 0;
          const nextStep = prevStep + 1;

          // Create draft outreach record for staff approval
          await pool.query(
            `INSERT INTO lead_contact_history (lead_id, contact_method, contact_direction, subject, status, approval_status, sequence_step, created_at)
             VALUES ($1, $2, 'outbound', $3, 'draft', 'pending', $4, NOW())`,
            [
              lead.id,
              nextStep <= 1 ? 'email' : nextStep <= 2 ? 'post' : 'phone',
              `Follow-up #${nextStep}: ${lead.property_address}`,
              nextStep,
            ]
          );
        } catch (leadErr) {
          console.error(`[Charlie Cron] Follow-up draft failed for lead ${lead.id}:`, leadErr);
        }
      }

      await audit.logToolCall({
        tool: 'charlie:check-followups',
        conversationId: 0,
        contactId: 0,
        input: {},
        output: { dueLeads: dueLeads.length },
      });

      console.log(`[Charlie Cron] Follow-up check: ${dueLeads.length} leads due`);
    } catch (err) {
      console.error('[Charlie Cron] Follow-up check failed:', err);
    }
  });

  console.log('[Charlie Cron] Sourcing cron jobs registered');
}
