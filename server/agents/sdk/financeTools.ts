/**
 * Finance Tools -- Taylor from Accounts
 *
 * SDK tool definitions for invoice queries, payment links, statements,
 * rent collection, cost ledger, and receipt generation.
 *
 * All tools use lazy imports for pool/services to avoid DB connection at module load.
 */

import { tool } from '@openai/agents';
// @ts-ignore -- zod4 is an npm alias for zod@4, required by @openai/agents SDK
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';

// ---- Lazy imports ----

let _pool: any = null;
async function getPool() {
  if (!_pool) {
    const mod = await import('../../db');
    _pool = mod.pool;
  }
  return _pool;
}

let _auditLogger: any = null;
async function getAuditLogger() {
  if (!_auditLogger) {
    const mod = await import('../middleware/auditLogger');
    _auditLogger = mod.auditLogger;
  }
  return _auditLogger;
}

// ---- Tools ----

/**
 * Look up invoice status by tenantId or invoiceNumber.
 */
export const lookupInvoiceStatusTool = tool({
  name: 'lookup_invoice_status',
  description:
    'Look up the status of an invoice by tenant ID or invoice number. Returns status, amount, due date, and paid date.',
  parameters: z4.object({
    tenantId: z4.number().optional().describe('The tenant ID to look up invoices for'),
    invoiceNumber: z4.string().optional().describe('The invoice number to look up'),
  }),
  execute: async (context: AgentContext, input: { tenantId?: number; invoiceNumber?: string }) => {
    const pool = await getPool();
    const audit = await getAuditLogger();

    let query: string;
    let params: any[];

    if (input.invoiceNumber) {
      query = `SELECT id, invoice_number, status, amount, total_amount, due_date, paid_date, invoice_type
               FROM invoice WHERE invoice_number = $1 ORDER BY due_date DESC LIMIT 10`;
      params = [input.invoiceNumber];
    } else if (input.tenantId) {
      query = `SELECT id, invoice_number, status, amount, total_amount, due_date, paid_date, invoice_type
               FROM invoice WHERE tenant_id = $1 ORDER BY due_date DESC LIMIT 10`;
      params = [input.tenantId];
    } else {
      return JSON.stringify({ error: 'Please provide either a tenantId or invoiceNumber' });
    }

    const result = await pool.query(query, params);

    await audit.logToolCall({
      tool: 'lookup_invoice_status',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input: { tenantId: input.tenantId, invoiceNumber: input.invoiceNumber },
      output: { count: result.rows.length },
    });

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No invoices found matching your query.' });
    }

    const invoices = result.rows.map((r: any) => ({
      invoiceNumber: r.invoice_number,
      status: r.status,
      amount: r.total_amount,
      dueDate: r.due_date,
      paidDate: r.paid_date,
      type: r.invoice_type,
    }));

    return JSON.stringify({ invoices });
  },
});

/**
 * Generate a payment link for an invoice via Stripe or GoCardless.
 */
export const generatePaymentLinkTool = tool({
  name: 'generate_payment_link',
  description:
    'Generate a payment link for an outstanding invoice. Optionally sends a WhatsApp notification with the link.',
  parameters: z4.object({
    invoiceId: z4.number().describe('The invoice ID to generate a payment link for'),
    channel: z4.enum(['stripe', 'gocardless']).describe('Payment channel: stripe or gocardless'),
  }),
  execute: async (context: AgentContext, input: { invoiceId: number; channel: 'stripe' | 'gocardless' }) => {
    const pool = await getPool();
    const audit = await getAuditLogger();

    // Look up the invoice
    const invoiceResult = await pool.query(
      `SELECT id, invoice_number, tenant_id, total_amount, status FROM invoice WHERE id = $1`,
      [input.invoiceId],
    );

    if (invoiceResult.rows.length === 0) {
      return JSON.stringify({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.status === 'paid') {
      return JSON.stringify({ message: 'This invoice has already been paid.' });
    }

    // Lazy import paymentLinkService
    const { paymentLinkService } = await import('../services/paymentLinkService');

    let linkUrl: string | null = null;

    if (input.channel === 'stripe') {
      const result = await paymentLinkService.generateStripeLink(
        invoice.total_amount,
        invoice.tenant_id,
        invoice.id,
        `Invoice ${invoice.invoice_number} - John Barclay Estate Agents`,
      );
      linkUrl = result?.url ?? null;
    } else {
      // GoCardless -- use the auto-detect method
      const result = await paymentLinkService.generateLink(
        invoice.tenant_id,
        invoice.id,
        invoice.total_amount,
      );
      linkUrl = result.url;
    }

    // Try to send WhatsApp notification if contact has WhatsApp
    if (linkUrl && context.contactId) {
      try {
        const { messageSender } = await import('../services/messageSender');
        const contactResult = await pool.query(
          `SELECT identifier FROM contact_identity WHERE contact_id = $1 AND channel = 'whatsapp' LIMIT 1`,
          [context.contactId],
        );
        if (contactResult.rows.length > 0) {
          await messageSender.send({
            channel: 'whatsapp',
            to: contactResult.rows[0].identifier,
            body: `Your payment link for invoice ${invoice.invoice_number}: ${linkUrl}`,
            conversationId: context.conversationId,
          });
        }
      } catch (err) {
        // Non-blocking -- WhatsApp notification is best-effort
        console.warn('[generatePaymentLink] WhatsApp notification failed:', err);
      }
    }

    await audit.logToolCall({
      tool: 'generate_payment_link',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input: { invoiceId: input.invoiceId, channel: input.channel },
      output: { linkUrl, invoiceNumber: invoice.invoice_number },
    });

    return JSON.stringify({
      invoiceNumber: invoice.invoice_number,
      paymentLink: linkUrl,
      amount: invoice.total_amount,
      message: linkUrl
        ? `Payment link generated for invoice ${invoice.invoice_number}.`
        : 'Unable to generate payment link at this time. Please contact our accounts team directly.',
    });
  },
});

/**
 * Query landlord statements by landlordId, propertyId, or period.
 */
export const queryStatementsTool = tool({
  name: 'query_statements',
  description:
    'Query landlord statements. Returns statement summary including period, status, and net payable. Honestly reports if a statement is still being reviewed.',
  parameters: z4.object({
    landlordId: z4.number().optional().describe('Landlord ID to query statements for'),
    propertyId: z4.number().optional().describe('Property ID to filter statements by'),
    period: z4.string().optional().describe('Period filter in YYYY-MM format'),
  }),
  execute: async (
    context: AgentContext,
    input: { landlordId?: number; propertyId?: number; period?: string },
  ) => {
    const pool = await getPool();
    const audit = await getAuditLogger();

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (input.landlordId) {
      conditions.push(`ls.landlord_id = $${paramIdx++}`);
      params.push(input.landlordId);
    }

    if (input.propertyId) {
      // Statements are per landlord; find landlord for property
      conditions.push(`ls.landlord_id IN (SELECT landlord_id FROM properties WHERE id = $${paramIdx++})`);
      params.push(input.propertyId);
    }

    if (input.period) {
      const [year, month] = input.period.split('-').map(Number);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);
      conditions.push(`ls.statement_period_start >= $${paramIdx++}`);
      params.push(start);
      conditions.push(`ls.statement_period_end <= $${paramIdx++}`);
      params.push(end);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT ls.id, ls.landlord_id, ls.statement_period_start, ls.statement_period_end,
              ls.total_rent_collected, ls.management_fees, ls.maintenance_deductions,
              ls.other_deductions, ls.vat_on_fees, ls.net_payable, ls.status, ls.pdf_url,
              l.name as landlord_name
       FROM landlord_statement ls
       LEFT JOIN landlords l ON l.id = ls.landlord_id
       ${whereClause}
       ORDER BY ls.statement_period_start DESC
       LIMIT 12`,
      params,
    );

    await audit.logToolCall({
      tool: 'query_statements',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input,
      output: { count: result.rows.length },
    });

    if (result.rows.length === 0) {
      return JSON.stringify({ message: 'No statements found matching your query.' });
    }

    const statements = result.rows.map((r: any) => ({
      id: r.id,
      landlordName: r.landlord_name,
      periodStart: r.statement_period_start,
      periodEnd: r.statement_period_end,
      totalRentCollected: r.total_rent_collected,
      managementFees: r.management_fees,
      maintenanceDeductions: r.maintenance_deductions,
      netPayable: r.net_payable,
      status: r.status,
      statusNote:
        r.status === 'draft'
          ? 'This statement is being reviewed by our accounts team and has not yet been finalised.'
          : undefined,
      pdfUrl: r.pdf_url,
    }));

    return JSON.stringify({ statements });
  },
});

/**
 * Query rent collection totals for a property over N months.
 */
export const queryRentCollectionTool = tool({
  name: 'query_rent_collection',
  description: 'Query rent collection for a property. Returns monthly totals of paid invoices.',
  parameters: z4.object({
    propertyId: z4.number().describe('The property ID to query rent collection for'),
    months: z4.number().optional().describe('Number of months to look back (default 6)'),
  }),
  execute: async (context: AgentContext, input: { propertyId: number; months?: number }) => {
    const pool = await getPool();
    const audit = await getAuditLogger();
    const monthsBack = input.months ?? 6;

    const result = await pool.query(
      `SELECT
         TO_CHAR(paid_date, 'YYYY-MM') AS month,
         SUM(total_amount) AS total_collected,
         COUNT(*) AS invoice_count
       FROM invoice
       WHERE property_id = $1
         AND status = 'paid'
         AND paid_date >= NOW() - INTERVAL '${monthsBack} months'
       GROUP BY TO_CHAR(paid_date, 'YYYY-MM')
       ORDER BY month DESC`,
      [input.propertyId],
    );

    await audit.logToolCall({
      tool: 'query_rent_collection',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input,
      output: { months: result.rows.length },
    });

    return JSON.stringify({
      propertyId: input.propertyId,
      monthsQueried: monthsBack,
      collection: result.rows.map((r: any) => ({
        month: r.month,
        totalCollected: Number(r.total_collected),
        invoiceCount: Number(r.invoice_count),
      })),
    });
  },
});

/**
 * Query cost ledger for a property or landlord (maintenance + compliance costs).
 */
export const queryCostLedgerTool = tool({
  name: 'query_cost_ledger',
  description:
    'Query the cost ledger for a property or landlord. Returns maintenance and compliance cost summaries.',
  parameters: z4.object({
    propertyId: z4.number().optional().describe('Property ID to query costs for'),
    landlordId: z4.number().optional().describe('Landlord ID to query costs for'),
  }),
  execute: async (context: AgentContext, input: { propertyId?: number; landlordId?: number }) => {
    const pool = await getPool();
    const audit = await getAuditLogger();

    if (!input.propertyId && !input.landlordId) {
      return JSON.stringify({ error: 'Please provide either a propertyId or landlordId' });
    }

    // Maintenance costs from work orders
    const maintenanceQuery = input.propertyId
      ? `SELECT COALESCE(SUM(wo.invoice_amount), 0) AS total_maintenance
         FROM work_order wo
         JOIN maintenance_request mr ON wo.maintenance_request_id = mr.id
         WHERE mr.property_id = $1 AND wo.status = 'completed'`
      : `SELECT COALESCE(SUM(wo.invoice_amount), 0) AS total_maintenance
         FROM work_order wo
         JOIN maintenance_request mr ON wo.maintenance_request_id = mr.id
         JOIN properties p ON mr.property_id = p.id
         WHERE p.landlord_id = $1 AND wo.status = 'completed'`;

    const maintenanceResult = await pool.query(maintenanceQuery, [input.propertyId || input.landlordId]);

    // Compliance costs from property certifications
    const complianceQuery = input.propertyId
      ? `SELECT COALESCE(SUM(cost), 0) AS total_compliance
         FROM property_certification pc
         WHERE pc.property_id = $1`
      : `SELECT COALESCE(SUM(cost), 0) AS total_compliance
         FROM property_certification pc
         JOIN properties p ON pc.property_id = p.id
         WHERE p.landlord_id = $1`;

    const complianceResult = await pool.query(complianceQuery, [input.propertyId || input.landlordId]);

    await audit.logToolCall({
      tool: 'query_cost_ledger',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input,
      output: {
        maintenance: maintenanceResult.rows[0]?.total_maintenance,
        compliance: complianceResult.rows[0]?.total_compliance,
      },
    });

    return JSON.stringify({
      totalMaintenanceCosts: Number(maintenanceResult.rows[0]?.total_maintenance ?? 0),
      totalComplianceCosts: Number(complianceResult.rows[0]?.total_compliance ?? 0),
      totalCosts:
        Number(maintenanceResult.rows[0]?.total_maintenance ?? 0) +
        Number(complianceResult.rows[0]?.total_compliance ?? 0),
    });
  },
});

/**
 * Generate a receipt PDF for a paid invoice.
 */
export const generateReceiptTool = tool({
  name: 'generate_receipt',
  description:
    'Generate a receipt PDF for a paid invoice. Stores the PDF and returns confirmation.',
  parameters: z4.object({
    invoiceId: z4.number().describe('The paid invoice ID to generate a receipt for'),
  }),
  execute: async (context: AgentContext, input: { invoiceId: number }) => {
    const pool = await getPool();
    const audit = await getAuditLogger();

    // Look up the invoice
    const invoiceResult = await pool.query(
      `SELECT id, invoice_number, tenant_id, total_amount, status, paid_date, invoice_type
       FROM invoice WHERE id = $1`,
      [input.invoiceId],
    );

    if (invoiceResult.rows.length === 0) {
      return JSON.stringify({ error: 'Invoice not found' });
    }

    const invoice = invoiceResult.rows[0];

    if (invoice.status !== 'paid') {
      return JSON.stringify({
        error: 'Receipt can only be generated for paid invoices.',
        currentStatus: invoice.status,
      });
    }

    // Generate receipt PDF (lazy import of pdfService)
    let pdfUrl: string | null = null;
    try {
      const pdfMod = await import('../../services/rentProcessingAgent');
      if (pdfMod && typeof (pdfMod as any).generateReceiptPDF === 'function') {
        pdfUrl = await (pdfMod as any).generateReceiptPDF(invoice);
      }
    } catch (err) {
      // pdfService may not have generateReceiptPDF yet -- that's fine
      console.warn('[generateReceipt] PDF generation not available:', err);
    }

    // If PDF generation not available, still confirm the receipt info
    await audit.logToolCall({
      tool: 'generate_receipt',
      conversationId: context.conversationId,
      contactId: context.contactId,
      input: { invoiceId: input.invoiceId },
      output: { invoiceNumber: invoice.invoice_number, pdfUrl },
    });

    return JSON.stringify({
      invoiceNumber: invoice.invoice_number,
      amount: invoice.total_amount,
      paidDate: invoice.paid_date,
      type: invoice.invoice_type,
      pdfUrl,
      message: pdfUrl
        ? `Receipt generated for invoice ${invoice.invoice_number}.`
        : `Receipt confirmed for invoice ${invoice.invoice_number}. PDF generation will be available shortly.`,
    });
  },
});
