/**
 * Business Accounts Service -- Riley Automation
 *
 * pg-boss cron jobs:
 * - riley:process-recurring-invoices (daily 6am) -- auto-generate invoices from templates
 * - riley:period-close-reminder (5th of month, 9am) -- remind admin about overdue open periods
 * - riley:vat-quarter-check (quarterly 1st of Jan/Apr/Jul/Oct) -- remind about pending VAT returns
 *
 * Deal event hooks:
 * - sale.completed -> auto-create commission income journal entry
 * - tenancy.agreed -> auto-create letting fee journal entry
 *
 * Uses lazy initialization for all dependencies (no DB at module load).
 * All event handlers use fire-and-forget pattern (catch errors internally).
 */

import * as PgBossModule from 'pg-boss';
const PgBoss = (PgBossModule as any).default || PgBossModule;

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

let _pool: any = null;
async function getPool() {
  if (!_pool) {
    const mod = await import('../db');
    _pool = mod.pool;
  }
  return _pool;
}

let _auditLogger: any = null;
async function getAuditLogger() {
  if (!_auditLogger) {
    const mod = await import('../agents/middleware/auditLogger');
    _auditLogger = mod.auditLogger;
  }
  return _auditLogger;
}

let _emailService: any = null;
async function getEmailService() {
  if (!_emailService) {
    const mod = await import('../emailService');
    _emailService = (mod as any).emailService;
  }
  return _emailService;
}

let _accountingIntegration: any = null;
async function getAccountingIntegration() {
  if (!_accountingIntegration) {
    _accountingIntegration = await import('../accountingIntegration');
  }
  return _accountingIntegration;
}

let _dealEventBus: any = null;
async function getDealEventBus() {
  if (!_dealEventBus) {
    _dealEventBus = await import('../agents/services/dealEventBus');
  }
  return _dealEventBus;
}

// ====================================================
// CRON JOB REGISTRATION
// ====================================================

export async function registerBusinessAccountsCronJobs(): Promise<void> {
  const b = await getBoss();
  const audit = await getAuditLogger();

  // 1. Daily recurring invoice processing -- 6am
  await b.schedule('riley:process-recurring-invoices', '0 6 * * *', {}, {});

  await b.work('riley:process-recurring-invoices', async () => {
    try {
      const pool = await getPool();
      const today = new Date().toISOString().slice(0, 10);

      // Find active templates due for generation
      const templates = await pool.query(
        `SELECT * FROM recurring_invoice_templates WHERE is_active = true AND next_generation_date <= $1`,
        [today]
      );

      let generated = 0;

      for (const t of templates.rows) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');

          // Get invoice number settings
          const settings = await client.query('SELECT sales_invoice_prefix, sales_invoice_next_number FROM business_settings LIMIT 1');
          let prefix = 'JBINV';
          let nextNum = 1;
          if (settings.rows.length > 0) {
            prefix = settings.rows[0].sales_invoice_prefix || 'JBINV';
            nextNum = settings.rows[0].sales_invoice_next_number || 1;
          }
          const invoiceNumber = `${prefix}-${String(nextNum).padStart(5, '0')}`;

          const now = new Date();
          const dueDate = new Date(now);
          dueDate.setDate(dueDate.getDate() + 30);

          // Create business invoice
          const invoiceResult = await client.query(
            `INSERT INTO business_invoices (invoice_number, invoice_date, due_date, customer_type, customer_id, customer_name, subtotal, vat_amount, total_amount, status, property_id, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'draft', $10, $11) RETURNING id`,
            [invoiceNumber, now.toISOString(), dueDate.toISOString(), t.customer_type, t.customer_id, t.customer_name, t.subtotal || 0, t.vat_amount || 0, t.total_amount || 0, t.property_id, `Generated from template: ${t.template_name}`]
          );
          const invoiceId = invoiceResult.rows[0].id;

          // Copy line items
          const lineItems = typeof t.line_items === 'string' ? JSON.parse(t.line_items) : (t.line_items || []);
          for (let i = 0; i < lineItems.length; i++) {
            const line = lineItems[i];
            await client.query(
              `INSERT INTO business_invoice_lines (business_invoice_id, description, quantity, unit_price, line_total, tax_rate_id, tax_amount, account_id, sort_order)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
              [invoiceId, line.description, line.quantity || 1, line.unit_price || 0, line.line_total || 0, line.tax_rate_id || null, line.tax_amount || 0, line.account_id || t.account_id || null, i]
            );
          }

          // Update template tracking -- calculate next generation date
          let nextGenDate: Date | null = null;
          if (t.frequency === 'weekly') { nextGenDate = new Date(now); nextGenDate.setDate(nextGenDate.getDate() + 7); }
          else if (t.frequency === 'monthly') { nextGenDate = new Date(now); nextGenDate.setMonth(nextGenDate.getMonth() + 1); }
          else if (t.frequency === 'quarterly') { nextGenDate = new Date(now); nextGenDate.setMonth(nextGenDate.getMonth() + 3); }
          else if (t.frequency === 'annually') { nextGenDate = new Date(now); nextGenDate.setFullYear(nextGenDate.getFullYear() + 1); }

          await client.query(
            'UPDATE recurring_invoice_templates SET last_generated_date = NOW(), next_generation_date = $2, updated_at = NOW() WHERE id = $1',
            [t.id, nextGenDate ? nextGenDate.toISOString() : null]
          );

          // Increment invoice number
          if (settings.rows.length > 0) {
            await client.query('UPDATE business_settings SET sales_invoice_next_number = sales_invoice_next_number + 1');
          }

          await client.query('COMMIT');
          generated++;
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`[Riley Cron] Failed to generate invoice from template ${t.id}:`, err);
        } finally {
          client.release();
        }
      }

      await audit.logToolCall({
        tool: 'riley:process-recurring-invoices',
        conversationId: 0,
        contactId: 0,
        input: { date: today },
        output: { templatesFound: templates.rows.length, generated },
      });

      console.log(`[Riley Cron] Recurring invoices: ${generated}/${templates.rows.length} templates processed`);
    } catch (err) {
      console.error('[Riley Cron] Recurring invoice processing failed:', err);
    }
  });

  // 2. Period close reminder -- 5th of each month at 9am
  await b.schedule('riley:period-close-reminder', '0 9 5 * *', {}, {});

  await b.work('riley:period-close-reminder', async () => {
    try {
      const pool = await getPool();

      // Find open periods whose end_date is before the first of this month
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

      const overdue = await pool.query(
        `SELECT * FROM financial_periods WHERE status = 'open' AND end_date < $1`,
        [firstOfMonth]
      );

      if (overdue.rows.length > 0) {
        // Get admin users for notification
        const admins = await pool.query(
          `SELECT email, name FROM users WHERE role = 'admin' AND email IS NOT NULL LIMIT 10`
        );

        const email = await getEmailService();
        const periodList = overdue.rows
          .map((p: any) => `${p.name || p.period_name || 'Unnamed'} (ends ${p.end_date})`)
          .join(', ');

        for (const admin of admins.rows) {
          try {
            await email.sendEmail(
              admin.email,
              'Financial Period Close Reminder - John Barclay',
              `<p>Dear ${admin.name || 'Admin'},</p>
               <p>The following financial periods are still open past their end date and should be reviewed for closing:</p>
               <p><strong>${periodList}</strong></p>
               <p>Please review and close these periods at your earliest convenience.</p>
               <p>Kind regards,<br>Riley - Business Accounts</p>`
            );
          } catch (emailErr) {
            console.warn(`[Riley Cron] Failed to send period reminder to ${admin.email}:`, emailErr);
          }
        }
      }

      await audit.logToolCall({
        tool: 'riley:period-close-reminder',
        conversationId: 0,
        contactId: 0,
        input: { firstOfMonth },
        output: { overdueCount: overdue.rows.length },
      });

      console.log(`[Riley Cron] Period close reminder: ${overdue.rows.length} overdue periods found`);
    } catch (err) {
      console.error('[Riley Cron] Period close reminder failed:', err);
    }
  });

  // 3. VAT quarter check -- 1st of Jan, Apr, Jul, Oct at 8am
  await b.schedule('riley:vat-quarter-check', '0 8 1 1,4,7,10 *', {}, {});

  await b.work('riley:vat-quarter-check', async () => {
    try {
      const pool = await getPool();
      const today = new Date().toISOString().slice(0, 10);

      const pending = await pool.query(
        `SELECT * FROM vat_returns WHERE status = 'draft' AND period_end < $1`,
        [today]
      );

      if (pending.rows.length > 0) {
        const admins = await pool.query(
          `SELECT email, name FROM users WHERE role = 'admin' AND email IS NOT NULL LIMIT 10`
        );

        const email = await getEmailService();
        const vatList = pending.rows
          .map((v: any) => `Period ${v.period_start} to ${v.period_end}`)
          .join(', ');

        for (const admin of admins.rows) {
          try {
            await email.sendEmail(
              admin.email,
              'VAT Return Reminder - John Barclay',
              `<p>Dear ${admin.name || 'Admin'},</p>
               <p>The following VAT returns are in draft status and their period has ended:</p>
               <p><strong>${vatList}</strong></p>
               <p>Please review and submit these VAT returns.</p>
               <p>Kind regards,<br>Riley - Business Accounts</p>`
            );
          } catch (emailErr) {
            console.warn(`[Riley Cron] Failed to send VAT reminder to ${admin.email}:`, emailErr);
          }
        }
      }

      await audit.logToolCall({
        tool: 'riley:vat-quarter-check',
        conversationId: 0,
        contactId: 0,
        input: { today },
        output: { pendingCount: pending.rows.length },
      });

      console.log(`[Riley Cron] VAT quarter check: ${pending.rows.length} pending returns found`);
    } catch (err) {
      console.error('[Riley Cron] VAT quarter check failed:', err);
    }
  });

  console.log('[Riley Cron] Business accounts cron jobs registered');
}

// ====================================================
// DEAL EVENT HOOK REGISTRATION
// ====================================================

export async function registerBusinessAccountsEventHooks(): Promise<void> {
  const { DEAL_EVENTS, dealEventBus } = await getDealEventBus();
  const audit = await getAuditLogger();

  // 1. Sale completed -> auto-create commission income journal entry
  await dealEventBus.subscribe(DEAL_EVENTS.SALE_COMPLETED, async (payload: any) => {
    try {
      const accounting = await getAccountingIntegration();
      const commissionPence = payload.commissionAmount || payload.commission || 0;

      if (commissionPence <= 0) {
        console.warn(`[Riley Event] sale.completed for deal ${payload.dealId} has no commission amount, skipping journal entry`);
        return;
      }

      const description = `Sales commission - Deal ${payload.dealId} - Property ${payload.propertyId}`;
      const entryId = await accounting.accountingRecordCommissionIncome(
        payload.propertyId,
        commissionPence,
        description,
        'deal',
        payload.dealId
      );

      await audit.logToolCall({
        tool: 'riley:sale-commission-journal',
        conversationId: 0,
        contactId: 0,
        input: { dealId: payload.dealId, propertyId: payload.propertyId, commissionPence },
        output: { journalEntryId: entryId },
      });

      console.log(`[Riley Event] Commission journal entry ${entryId} created for deal ${payload.dealId}`);
    } catch (err) {
      console.error(`[Riley Event] Failed to create commission journal for deal ${payload.dealId}:`, err);
    }
  });

  // 2. Tenancy agreed -> auto-create letting fee journal entry
  await dealEventBus.subscribe(DEAL_EVENTS.TENANCY_AGREED, async (payload: any) => {
    try {
      const accounting = await getAccountingIntegration();
      const feePence = payload.lettingFee || payload.feeAmount || 0;

      if (feePence <= 0) {
        console.warn(`[Riley Event] tenancy.agreed for deal ${payload.dealId} has no letting fee, skipping journal entry`);
        return;
      }

      const description = `Letting fee - Deal ${payload.dealId} - Property ${payload.propertyId}`;
      const entryId = await accounting.accountingRecordLettingFee(
        payload.propertyId,
        feePence,
        description,
        'deal',
        payload.dealId
      );

      await audit.logToolCall({
        tool: 'riley:letting-fee-journal',
        conversationId: 0,
        contactId: 0,
        input: { dealId: payload.dealId, propertyId: payload.propertyId, feePence },
        output: { journalEntryId: entryId },
      });

      console.log(`[Riley Event] Letting fee journal entry ${entryId} created for deal ${payload.dealId}`);
    } catch (err) {
      console.error(`[Riley Event] Failed to create letting fee journal for deal ${payload.dealId}:`, err);
    }
  });

  console.log('[Riley Event] Business accounts event hooks registered');
}
