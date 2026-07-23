/**
 * Finance Cron Jobs
 *
 * Registers pg-boss cron schedules for Taylor's automated tasks:
 * - Monthly landlord statement generation (1st of month, 6am)
 * - Daily invoice generation (7am)
 * - Deal event subscriptions for tenancy lifecycle triggers
 *
 * Uses lazy imports for all service dependencies to avoid DB at module load.
 */

import * as PgBossModule from 'pg-boss';
const PgBoss = (PgBossModule as any).default || PgBossModule;

// ---- Lazy pg-boss init (same pattern as dealEventBus.ts) ----

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

let _financeAgentService: any = null;
async function getFinanceAgentService() {
  if (!_financeAgentService) {
    const mod = await import('../../services/financeAgentService');
    _financeAgentService = mod;
  }
  return _financeAgentService;
}

let _dealEventBus: any = null;
async function getDealEventBus() {
  if (!_dealEventBus) {
    const mod = await import('./dealEventBus');
    _dealEventBus = mod;
  }
  return _dealEventBus;
}

// ---- Register Cron Jobs ----

export async function registerFinanceCronJobs(): Promise<void> {
  const b = await getBoss();
  const audit = await getAuditLogger();

  // 1. Monthly statement generation -- 1st of month at 6am
  await b.schedule('taylor:generate-statements', '0 6 1 * *', {}, {});

  await b.work('taylor:generate-statements', async () => {
    try {
      const svc = await getFinanceAgentService();
      const now = new Date();
      const prevMonth = now.getMonth() === 0 ? 12 : now.getMonth();
      const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

      const result = await svc.generateMonthlyStatements(prevYear, prevMonth);

      await audit.logToolCall({
        tool: 'taylor:generate-statements',
        conversationId: 0,
        contactId: 0,
        input: { year: prevYear, month: prevMonth },
        output: result,
      });

      console.log(`[Taylor Cron] Monthly statements generated: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error('[Taylor Cron] Statement generation failed:', err);
    }
  });

  // 2. Daily invoice generation -- every day at 7am
  await b.schedule('taylor:generate-invoices', '0 7 * * *', {}, {});

  await b.work('taylor:generate-invoices', async () => {
    try {
      const svc = await getFinanceAgentService();
      const result = await svc.generateMonthlyInvoices(new Date());

      // For each created invoice, attempt PDF generation and notification
      if (result?.invoices && Array.isArray(result.invoices)) {
        for (const inv of result.invoices) {
          try {
            // PDF generation (lazy import)
            const pdfMod = await import('../../services/rentProcessingAgent');
            if (pdfMod && typeof (pdfMod as any).generateInvoicePDF === 'function') {
              await (pdfMod as any).generateInvoicePDF(inv);
            }
          } catch (pdfErr) {
            console.warn(`[Taylor Cron] PDF generation failed for invoice ${inv.id}:`, pdfErr);
          }

          try {
            // Email notification (lazy import)
            const emailMod = await import('../../emailService');
            if (emailMod && typeof (emailMod as any).emailService?.sendEmail === 'function') {
              const { emailService } = emailMod as any;
              await emailService.sendEmail(
                inv.tenantEmail,
                `Invoice ${inv.invoiceNumber} - John Barclay Estate Agents`,
                `<p>Dear Tenant,</p><p>Your invoice ${inv.invoiceNumber} for £${(inv.totalAmount / 100).toFixed(2)} is now available. Due date: ${inv.dueDate}.</p><p>Kind regards,<br>John Barclay Estate Agents</p>`,
              );
            }
          } catch (emailErr) {
            console.warn(`[Taylor Cron] Email notification failed for invoice ${inv.id}:`, emailErr);
          }

          try {
            // WhatsApp notification with payment link (lazy import)
            const { messageSender } = await import('./messageSender');
            if (inv.tenantWhatsApp) {
              await messageSender.send({
                channel: 'whatsapp',
                to: inv.tenantWhatsApp,
                body: `Invoice ${inv.invoiceNumber} for £${(inv.totalAmount / 100).toFixed(2)} is due ${inv.dueDate}. Pay online: ${inv.paymentLink || 'Contact accounts for payment details.'}`,
                conversationId: 0,
              });
            }
          } catch (waErr) {
            console.warn(`[Taylor Cron] WhatsApp notification failed for invoice ${inv.id}:`, waErr);
          }
        }
      }

      await audit.logToolCall({
        tool: 'taylor:generate-invoices',
        conversationId: 0,
        contactId: 0,
        input: { date: new Date().toISOString() },
        output: result,
      });

      console.log(`[Taylor Cron] Daily invoices generated: ${JSON.stringify(result)}`);
    } catch (err) {
      console.error('[Taylor Cron] Invoice generation failed:', err);
    }
  });

  // 3. Deal event: TENANCY_AGREED -- generate first month's invoice
  const { DEAL_EVENTS, dealEventBus } = await getDealEventBus();

  await dealEventBus.subscribe(DEAL_EVENTS.TENANCY_AGREED, async (payload: any) => {
    try {
      const svc = await getFinanceAgentService();
      await svc.generateFirstInvoiceForTenancy(payload.dealId, payload.propertyId);

      await audit.logToolCall({
        tool: 'taylor:tenancy-agreed-invoice',
        conversationId: 0,
        contactId: 0,
        input: { dealId: payload.dealId, propertyId: payload.propertyId },
        output: { status: 'first_invoice_generated' },
      });

      console.log(`[Taylor Event] First invoice generated for tenancy deal ${payload.dealId}`);
    } catch (err) {
      console.error(`[Taylor Event] Failed to generate first invoice for deal ${payload.dealId}:`, err);
    }
  });

  // 4. Deal event: TENANCY_ENDING -- generate final statement
  await dealEventBus.subscribe(DEAL_EVENTS.TENANCY_ENDING, async (payload: any) => {
    try {
      const svc = await getFinanceAgentService();
      await svc.generateFinalStatement(payload.dealId, payload.propertyId);

      await audit.logToolCall({
        tool: 'taylor:tenancy-ending-statement',
        conversationId: 0,
        contactId: 0,
        input: { dealId: payload.dealId, propertyId: payload.propertyId },
        output: { status: 'final_statement_generated' },
      });

      console.log(`[Taylor Event] Final statement generated for tenancy deal ${payload.dealId}`);
    } catch (err) {
      console.error(`[Taylor Event] Failed to generate final statement for deal ${payload.dealId}:`, err);
    }
  });

  console.log('[Taylor Cron] Finance cron jobs and deal event subscriptions registered');
}
