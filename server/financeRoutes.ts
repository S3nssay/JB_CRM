import { Router } from 'express';
import { storage } from './storage';
import { pool } from './db';
import { insertInvoiceSchema, insertArrearsSchema, insertLandlordStatementSchema, insertPropertyTransactionSchema, insertRentReviewSchema } from '@shared/schema';
import { z } from 'zod';
import { importBankStatement, autoReconcile, manualMatch } from './bankReconciliationService';
import { recordPaymentAndReconcile } from './reconciliationEngine';
import { createRedirectFlow, completeRedirectFlow, collectPayment, cancelMandate, verifyWebhookSignature, processWebhookEvents, isGoCardlessConfigured } from './gocardlessService';
import multer from 'multer';
import { accountingRecordRentPayment, accountingRecordManagementFee, accountingRecordLandlordPayment, accountingRecordExpense } from './accountingIntegration';
import { generateMonthlyStatements, generateMonthlyInvoices } from './services/financeAgentService';
import { generateStatementPDF } from './services/pdfService';
import * as fs from 'fs';
import * as path from 'path';

export const financeRouter = Router();

// Middleware
const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent') return res.status(403).json({ error: 'Not authorized' });
  next();
};

// ==========================================
// INVOICE ROUTES
// ==========================================

financeRouter.get('/invoices', requireAgent, async (req: any, res) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.tenantId) filters.tenantId = parseInt(req.query.tenantId as string);
    if (req.query.landlordId) filters.landlordId = parseInt(req.query.landlordId as string);
    if (req.query.propertyId) filters.propertyId = parseInt(req.query.propertyId as string);
    const invoices = await storage.getAllInvoices(filters);
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

financeRouter.get('/invoices/overdue', requireAgent, async (req: any, res) => {
  try {
    const overdue = await storage.getOverdueInvoices();
    res.json(overdue);
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Failed to fetch overdue invoices' });
  }
});

financeRouter.get('/invoices/:id', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

financeRouter.post('/invoices', requireAgent, async (req: any, res) => {
  try {
    const data = insertInvoiceSchema.parse(req.body);
    const invoice = await storage.createInvoice(data);
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid invoice data', details: error.errors });
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

financeRouter.put('/invoices/:id', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await storage.updateInvoice(id, req.body);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Auto-record transaction when invoice marked as paid
    if (req.body.status === 'paid' && invoice.propertyId) {
      const txn = await storage.createPropertyTransaction({
        propertyId: invoice.propertyId,
        landlordId: invoice.landlordId,
        transactionType: 'income',
        category: invoice.invoiceType || 'rent',
        description: `Invoice ${invoice.invoiceNumber} - ${invoice.invoiceType}`,
        amount: invoice.totalAmount,
        transactionDate: new Date(),
        invoiceId: invoice.id,
        paymentId: invoice.paymentId,
      });

      // Accounting integration: record rent payment journal entry
      try {
        const propResult = await pool.query('SELECT address_line1, postcode FROM property WHERE id = $1', [invoice.propertyId]);
        const propAddr = propResult.rows.length > 0
          ? [propResult.rows[0].address_line1, propResult.rows[0].postcode].filter(Boolean).join(', ')
          : `Property #${invoice.propertyId}`;
        await accountingRecordRentPayment(
          invoice.totalAmount,
          `Tenant #${invoice.tenantId}`,
          propAddr,
          invoice.invoiceNumber,
          new Date(),
          txn.id
        );
      } catch (e) {
        console.error('[Accounting] Error recording rent payment journal entry:', e);
      }
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

financeRouter.post('/invoices/generate-rent', requireAgent, async (req: any, res) => {
  try {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Find all active tenancies with tenant details
    const result = await pool.query(`
      SELECT
        tc.id as tenancy_id,
        tc.property_id,
        tc.landlord_id,
        tc.tenant_id,
        tc.rent_amount,
        tc.rent_frequency,
        tc.rent_due_day,
        tc.start_date,
        tc.end_date,
        t.name as tenant_name,
        t.email as tenant_email,
        p.address_line1 as property_address,
        p.postcode as property_postcode
      FROM tenancy tc
      JOIN tenant t ON t.id = tc.tenant_id
      JOIN property p ON p.id = tc.property_id
      WHERE tc.status = 'active'
        AND tc.tenant_id IS NOT NULL
        AND tc.rent_amount IS NOT NULL
        AND tc.rent_amount::numeric > 0
    `);

    const generated: any[] = [];
    const emailQueue: { invoiceId: number; tenantEmail: string; tenantName: string; amount: number; dueDate: string; propertyAddress: string; invoiceNumber: string }[] = [];

    for (const tenancy of result.rows) {
      // Calculate the next due date for this tenancy
      const rentDueDay = tenancy.rent_due_day || 1;
      let dueDate: Date;

      // If the due day hasn't passed this month, the due date is this month
      // Otherwise it's next month
      if (currentDay <= rentDueDay + 7) {
        // Due date is this month (or already past but within window)
        dueDate = new Date(currentYear, currentMonth, Math.min(rentDueDay, 28));
      } else {
        // Due date is next month
        dueDate = new Date(currentYear, currentMonth + 1, Math.min(rentDueDay, 28));
      }

      // Only generate if due date is within the next 7 days
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntilDue < 0 || daysUntilDue > 7) continue;

      // Check if tenancy has ended
      if (tenancy.end_date && new Date(tenancy.end_date) < now) continue;

      // Check if invoice already exists for this tenancy + due date (avoid duplicates)
      const dueDateStr = dueDate.toISOString().slice(0, 10);
      const existing = await pool.query(
        `SELECT id FROM invoice
         WHERE tenant_id = $1 AND property_id = $2
           AND invoice_type = 'rent'
           AND due_date::date = $3::date`,
        [tenancy.tenant_id, tenancy.property_id, dueDateStr]
      );
      if (existing.rows.length > 0) continue;

      // Convert rent_amount to pence (stored as decimal in tenancies, pence in invoices)
      const rentPounds = parseFloat(tenancy.rent_amount);
      const rentPence = Math.round(rentPounds * 100);

      const invoiceNumber = `INV-${now.toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`;

      const invoice = await storage.createInvoice({
        invoiceNumber,
        propertyId: tenancy.property_id,
        tenantId: tenancy.tenant_id,
        landlordId: tenancy.landlord_id,
        tenancyId: tenancy.tenancy_id,
        invoiceType: 'rent',
        amount: rentPence,
        vatAmount: 0,
        totalAmount: rentPence,
        dueDate,
        status: 'sent',
        sentAt: now,
      });
      generated.push(invoice);

      // Queue for email if tenant has an email address
      if (tenancy.tenant_email) {
        emailQueue.push({
          invoiceId: invoice.id,
          tenantEmail: tenancy.tenant_email,
          tenantName: tenancy.tenant_name,
          amount: rentPence,
          dueDate: dueDateStr,
          propertyAddress: [tenancy.property_address, tenancy.property_postcode].filter(Boolean).join(', '),
          invoiceNumber,
        });
      }
    }

    // Queue emails for generated invoices
    let emailsQueued = 0;
    if (emailQueue.length > 0) {
      // Find an active email connection to send from
      const connResult = await pool.query(
        `SELECT id, user_id FROM email_connection WHERE status = 'active' ORDER BY id LIMIT 1`
      );

      if (connResult.rows.length > 0) {
        const conn = connResult.rows[0];
        for (const item of emailQueue) {
          try {
            await pool.query(
              `INSERT INTO sent_email (connection_id, user_id, to_addresses, subject, body_html, status, linked_property_id)
               VALUES ($1, $2, $3, $4, $5, 'queued', $6)`,
              [
                conn.id,
                conn.user_id,
                [item.tenantEmail],
                `Rent Invoice ${item.invoiceNumber} - Due ${new Date(item.dueDate).toLocaleDateString('en-GB')}`,
                `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #791E75; padding: 20px; color: white; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">John Barclay</h1>
    <p style="margin: 5px 0 0; opacity: 0.9;">Rent Invoice</p>
  </div>
  <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb;">
    <p>Dear ${item.tenantName},</p>
    <p>Please find below the details of your rent invoice:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Invoice Number</td>
        <td style="padding: 10px 0; text-align: right; font-weight: 600;">${item.invoiceNumber}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Property</td>
        <td style="padding: 10px 0; text-align: right;">${item.propertyAddress}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Due Date</td>
        <td style="padding: 10px 0; text-align: right;">${new Date(item.dueDate).toLocaleDateString('en-GB')}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #6b7280; font-size: 18px;">Amount Due</td>
        <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: 700; color: #791E75;">&pound;${(item.amount / 100).toFixed(2)}</td>
      </tr>
    </table>
    <p>Please ensure payment is made by the due date. If you have already made this payment, please disregard this notice.</p>
    <p style="margin-top: 30px;">Kind regards,<br/><strong>John Barclay Property Management</strong></p>
  </div>
  <div style="padding: 15px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af; border: 1px solid #e5e7eb; border-top: none;">
    This is an automated invoice notification from John Barclay Estate &amp; Management Agents.
  </div>
</div>`,
                item.invoiceId,
              ]
            );
            emailsQueued++;
          } catch (emailErr) {
            console.error(`Failed to queue email for invoice ${item.invoiceNumber}:`, emailErr);
          }
        }
      } else {
        console.warn('[Generate Rent] No active email connection found - invoices created but emails not queued');
      }
    }

    res.json({
      generated: generated.length,
      emailsQueued,
      invoices: generated,
    });
  } catch (error) {
    console.error('Error generating rent invoices:', error);
    res.status(500).json({ error: 'Failed to generate rent invoices' });
  }
});

// ==========================================
// ARREARS ROUTES
// ==========================================

financeRouter.get('/arrears', requireAgent, async (req: any, res) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.propertyId) filters.propertyId = parseInt(req.query.propertyId as string);
    const result = await storage.getAllArrears(filters);
    res.json(result);
  } catch (error) {
    console.error('Error fetching arrears:', error);
    res.status(500).json({ error: 'Failed to fetch arrears' });
  }
});

financeRouter.get('/arrears/summary', requireAgent, async (req: any, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_cases,
        COALESCE(SUM(amount) FILTER (WHERE status = 'active'), 0) as total_outstanding,
        COALESCE(AVG(days_overdue) FILTER (WHERE status = 'active'), 0) as avg_days_overdue,
        COUNT(*) FILTER (WHERE dunning_level >= 4) as critical_cases
      FROM arrears
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching arrears summary:', error);
    res.status(500).json({ error: 'Failed to fetch arrears summary' });
  }
});

financeRouter.post('/arrears/detect', requireAgent, async (req: any, res) => {
  try {
    // Find overdue invoices that don't have an active arrears record
    const overdue = await pool.query(`
      SELECT i.*, t.name as tenant_name
      FROM invoice i
      LEFT JOIN tenant t ON t.id = i.tenant_id
      WHERE i.status IN ('sent', 'overdue')
        AND i.due_date < NOW()
        AND NOT EXISTS (
          SELECT 1 FROM arrears a WHERE a.invoice_id = i.id AND a.status = 'active'
        )
    `);

    const created: any[] = [];
    for (const inv of overdue.rows) {
      const daysOverdue = Math.floor((Date.now() - new Date(inv.due_date).getTime()) / (1000 * 60 * 60 * 24));
      let dunningLevel = 1;
      if (daysOverdue > 90) dunningLevel = 5;
      else if (daysOverdue > 60) dunningLevel = 4;
      else if (daysOverdue > 30) dunningLevel = 3;
      else if (daysOverdue > 14) dunningLevel = 2;

      // Update invoice status to overdue
      await storage.updateInvoice(inv.id, { status: 'overdue' });

      const record = await storage.createArrears({
        tenantId: inv.tenant_id,
        propertyId: inv.property_id,
        tenancyId: inv.tenancy_id,
        invoiceId: inv.id,
        amount: inv.total_amount,
        daysOverdue,
        dunningLevel,
        status: 'active',
      });
      created.push(record);
    }

    // Update existing arrears days_overdue
    await pool.query(`
      UPDATE arrears SET
        days_overdue = EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400,
        dunning_level = CASE
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 90 THEN 5
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 60 THEN 4
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 30 THEN 3
          WHEN EXTRACT(EPOCH FROM (NOW() - (SELECT due_date FROM invoice WHERE id = arrears.invoice_id))) / 86400 > 14 THEN 2
          ELSE 1
        END,
        updated_at = NOW()
      WHERE status = 'active' AND invoice_id IS NOT NULL
    `);

    res.json({ newCases: created.length, arrears: created });
  } catch (error) {
    console.error('Error detecting arrears:', error);
    res.status(500).json({ error: 'Failed to detect arrears' });
  }
});

financeRouter.post('/arrears/:id/remind', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const action = await storage.createDunningAction({
      arrearsId: id,
      actionType: req.body.actionType || 'email',
      channel: req.body.channel || 'email',
      status: 'sent',
      sentAt: new Date(),
      notes: req.body.notes,
      createdBy: req.user?.id,
    });
    await storage.updateArrears(id, { lastReminderSent: new Date() });
    res.json(action);
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

financeRouter.put('/arrears/:id', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateArrears(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Arrears record not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating arrears:', error);
    res.status(500).json({ error: 'Failed to update arrears' });
  }
});

financeRouter.get('/arrears/:id/actions', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const actions = await storage.getDunningActionsByArrears(id);
    res.json(actions);
  } catch (error) {
    console.error('Error fetching dunning actions:', error);
    res.status(500).json({ error: 'Failed to fetch dunning actions' });
  }
});

// ==========================================
// LANDLORD STATEMENT ROUTES
// ==========================================

financeRouter.post('/statements/generate', requireAgent, async (req: any, res) => {
  try {
    const { landlordId, periodStart, periodEnd } = req.body;
    if (!landlordId || !periodStart || !periodEnd) {
      return res.status(400).json({ error: 'landlordId, periodStart, and periodEnd are required' });
    }

    const start = new Date(periodStart);
    const end = new Date(periodEnd);

    // Get rent collected for this landlord in period
    const rentResult = await pool.query(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM payment
      WHERE landlord_id = $1 AND payment_type = 'rent' AND status = 'completed'
        AND paid_at >= $2 AND paid_at <= $3
    `, [landlordId, start, end]);

    // Get maintenance costs
    const maintenanceResult = await pool.query(`
      SELECT COALESCE(SUM(actual_cost), 0) as total
      FROM maintenance_ticket
      WHERE landlord_id = $1 AND status = 'completed'
        AND updated_at >= $2 AND updated_at <= $3
    `, [landlordId, start, end]);

    const totalRent = parseInt(rentResult.rows[0]?.total || '0');
    const maintenanceCosts = parseInt(maintenanceResult.rows[0]?.total || '0');

    // Calculate management fees from properties
    const feeResult = await pool.query(`
      SELECT management_fee_type, management_fee_value FROM property
      WHERE landlord_id = $1 AND is_managed = true
    `, [landlordId]);

    let totalFees = 0;
    for (const prop of feeResult.rows) {
      if (prop.management_fee_type === 'percentage' && prop.management_fee_value) {
        totalFees += Math.round(totalRent * (parseFloat(prop.management_fee_value) / 100));
      } else if (prop.management_fee_type === 'fixed' && prop.management_fee_value) {
        totalFees += Math.round(parseFloat(prop.management_fee_value) * 100); // convert to pence
      }
    }

    const vatOnFees = Math.round(totalFees * 0.2);
    const netPayable = totalRent - totalFees - vatOnFees - maintenanceCosts;

    const statement = await storage.createStatement({
      landlordId,
      statementPeriodStart: start,
      statementPeriodEnd: end,
      totalRentCollected: totalRent,
      managementFees: totalFees,
      maintenanceDeductions: maintenanceCosts,
      otherDeductions: 0,
      vatOnFees,
      netPayable,
      status: 'draft',
    });

    // Create line items
    await storage.createStatementLineItem({
      statementId: statement.id,
      lineType: 'rent_collected',
      description: 'Total rent collected',
      amount: totalRent,
      transactionDate: end,
    });

    if (totalFees > 0) {
      await storage.createStatementLineItem({
        statementId: statement.id,
        lineType: 'management_fee',
        description: 'Management fees',
        amount: -totalFees,
        transactionDate: end,
      });
    }

    if (vatOnFees > 0) {
      await storage.createStatementLineItem({
        statementId: statement.id,
        lineType: 'other_deduction',
        description: 'VAT on management fees',
        amount: -vatOnFees,
        transactionDate: end,
      });
    }

    if (maintenanceCosts > 0) {
      await storage.createStatementLineItem({
        statementId: statement.id,
        lineType: 'maintenance',
        description: 'Maintenance deductions',
        amount: -maintenanceCosts,
        transactionDate: end,
      });
    }

    // Accounting integration: record management fee journal entry
    if (totalFees > 0) {
      try {
        const llResult = await pool.query('SELECT name FROM landlord WHERE id = $1', [landlordId]);
        const llName = llResult.rows.length > 0 ? llResult.rows[0].name : `Landlord #${landlordId}`;
        const periodDesc = `${start.toLocaleDateString('en-GB')} - ${end.toLocaleDateString('en-GB')}`;
        await accountingRecordManagementFee(totalFees, vatOnFees, llName, periodDesc, statement.id);
      } catch (e) {
        console.error('[Accounting] Error recording management fee journal entry:', e);
      }
    }

    res.status(201).json(statement);
  } catch (error) {
    console.error('Error generating statement:', error);
    res.status(500).json({ error: 'Failed to generate statement' });
  }
});

financeRouter.get('/landlords/:landlordId/statements', requireAgent, async (req: any, res) => {
  try {
    const landlordId = parseInt(req.params.landlordId);
    const statements = await storage.getStatementsByLandlord(landlordId);
    res.json(statements);
  } catch (error) {
    console.error('Error fetching statements:', error);
    res.status(500).json({ error: 'Failed to fetch statements' });
  }
});

financeRouter.get('/statements/:id', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const statement = await storage.getStatement(id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });
    const lineItems = await storage.getStatementLineItems(id);
    res.json({ ...statement, lineItems });
  } catch (error) {
    console.error('Error fetching statement:', error);
    res.status(500).json({ error: 'Failed to fetch statement' });
  }
});

financeRouter.put('/statements/:id/approve', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateStatement(id, { status: 'approved' });
    if (!updated) return res.status(404).json({ error: 'Statement not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error approving statement:', error);
    res.status(500).json({ error: 'Failed to approve statement' });
  }
});

financeRouter.put('/statements/:id/mark-paid', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateStatement(id, {
      status: 'paid',
      paidAt: new Date(),
      paymentReference: req.body.paymentReference,
    });
    if (!updated) return res.status(404).json({ error: 'Statement not found' });

    // Accounting integration: record landlord payment journal entry
    try {
      const llResult = await pool.query('SELECT name FROM landlord WHERE id = $1', [updated.landlordId]);
      const llName = llResult.rows.length > 0 ? llResult.rows[0].name : `Landlord #${updated.landlordId}`;
      await accountingRecordLandlordPayment(
        updated.netPayable,
        llName,
        req.body.paymentReference || `STMT-${id}`,
        id
      );
    } catch (e) {
      console.error('[Accounting] Error recording landlord payment journal entry:', e);
    }

    res.json(updated);
  } catch (error) {
    console.error('Error marking statement paid:', error);
    res.status(500).json({ error: 'Failed to mark statement paid' });
  }
});

// ==========================================
// LANDLORDS WITH STATEMENTS (aggregated view)
// ==========================================

financeRouter.get('/landlords-with-statements', requireAgent, async (req: any, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id, l.name, l.email, l.phone, l.status,
        ls.id as statement_id,
        ls.statement_period_start,
        ls.statement_period_end,
        ls.total_rent_collected,
        ls.management_fees,
        ls.maintenance_deductions,
        ls.vat_on_fees,
        ls.net_payable,
        ls.status as statement_status,
        ls.sent_at as statement_sent_at,
        ls.paid_at as statement_paid_at,
        ls.created_at as statement_created_at,
        (SELECT COUNT(*) FROM property WHERE landlord_id = l.id AND is_managed = true) as managed_property_count
      FROM landlord l
      LEFT JOIN LATERAL (
        SELECT * FROM landlord_statement WHERE landlord_id = l.id
        ORDER BY statement_period_end DESC LIMIT 1
      ) ls ON true
      WHERE EXISTS (SELECT 1 FROM property WHERE landlord_id = l.id AND is_managed = true)
      ORDER BY l.name ASC
    `);

    const landlords = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      managedPropertyCount: parseInt(row.managed_property_count) || 0,
      lastStatement: row.statement_id ? {
        id: row.statement_id,
        periodStart: row.statement_period_start,
        periodEnd: row.statement_period_end,
        totalRentCollected: row.total_rent_collected,
        managementFees: row.management_fees,
        maintenanceDeductions: row.maintenance_deductions,
        vatOnFees: row.vat_on_fees,
        netPayable: row.net_payable,
        status: row.statement_status,
        sentAt: row.statement_sent_at,
        paidAt: row.statement_paid_at,
        createdAt: row.statement_created_at,
      } : null,
    }));

    res.json(landlords);
  } catch (error) {
    console.error('Error fetching landlords with statements:', error);
    res.status(500).json({ error: 'Failed to fetch landlords with statements' });
  }
});

// ==========================================
// STATEMENT EMAIL
// ==========================================

financeRouter.post('/statements/:id/send-email', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const statement = await storage.getStatement(id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });

    // Get landlord details
    const landlordResult = await pool.query(`SELECT name, email FROM landlord WHERE id = $1`, [statement.landlordId]);
    if (landlordResult.rows.length === 0) return res.status(404).json({ error: 'Landlord not found' });
    const landlord = landlordResult.rows[0];

    if (!landlord.email) return res.status(400).json({ error: 'Landlord has no email address' });

    // Find active email connection
    const connResult = await pool.query(
      `SELECT id, user_id FROM email_connection WHERE status = 'active' ORDER BY id LIMIT 1`
    );
    if (connResult.rows.length === 0) return res.status(400).json({ error: 'No active email connection configured' });
    const conn = connResult.rows[0];

    const periodStart = new Date(statement.statementPeriodStart).toLocaleDateString('en-GB');
    const periodEnd = new Date(statement.statementPeriodEnd).toLocaleDateString('en-GB');
    const fmt = (pence: number) => `&pound;${(pence / 100).toFixed(2)}`;

    const bodyHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #791E75; padding: 20px; color: white; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">John Barclay</h1>
    <p style="margin: 5px 0 0; opacity: 0.9;">Landlord Statement</p>
  </div>
  <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb;">
    <p>Dear ${landlord.name},</p>
    <p>Please find below your statement for the period <strong>${periodStart}</strong> to <strong>${periodEnd}</strong>:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Rent Collected</td>
        <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #16a34a;">${fmt(statement.totalRentCollected)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Management Fees</td>
        <td style="padding: 10px 0; text-align: right; color: #ea580c;">-${fmt(statement.managementFees)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">VAT on Fees</td>
        <td style="padding: 10px 0; text-align: right; color: #ea580c;">-${fmt(statement.vatOnFees)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Maintenance Deductions</td>
        <td style="padding: 10px 0; text-align: right; color: #dc2626;">-${fmt(statement.maintenanceDeductions)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #6b7280; font-size: 18px;">Net Payable</td>
        <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: 700; color: #791E75;">${fmt(statement.netPayable)}</td>
      </tr>
    </table>
    <p>Payment will be made to your registered bank account.</p>
    <p style="margin-top: 30px;">Kind regards,<br/><strong>John Barclay Estate &amp; Management Agents</strong></p>
  </div>
  <div style="padding: 15px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af; border: 1px solid #e5e7eb; border-top: none;">
    This is an automated statement from John Barclay Estate &amp; Management Agents.
  </div>
</div>`;

    await pool.query(
      `INSERT INTO sent_email (connection_id, user_id, to_addresses, subject, body_html, status)
       VALUES ($1, $2, $3, $4, $5, 'queued')`,
      [
        conn.id,
        conn.user_id,
        [landlord.email],
        `Landlord Statement - ${periodStart} to ${periodEnd}`,
        bodyHtml,
      ]
    );

    // Update statement status to sent
    await storage.updateStatement(id, { status: 'sent', sentAt: new Date() });

    res.json({ success: true, message: `Statement email queued for ${landlord.email}` });
  } catch (error) {
    console.error('Error sending statement email:', error);
    res.status(500).json({ error: 'Failed to send statement email' });
  }
});

// ==========================================
// INVOICE EMAIL
// ==========================================

financeRouter.post('/invoices/:id/send-email', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const invoice = await storage.getInvoice(id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    // Get tenant details
    let tenantEmail = '';
    let tenantName = 'Tenant';
    let propertyAddress = '';
    if (invoice.tenantId) {
      const tenantResult = await pool.query(`SELECT name, email FROM tenant WHERE id = $1`, [invoice.tenantId]);
      if (tenantResult.rows.length > 0) {
        tenantName = tenantResult.rows[0].name || 'Tenant';
        tenantEmail = tenantResult.rows[0].email || '';
      }
    }
    if (invoice.propertyId) {
      const propResult = await pool.query(`SELECT address_line1, postcode FROM property WHERE id = $1`, [invoice.propertyId]);
      if (propResult.rows.length > 0) {
        propertyAddress = [propResult.rows[0].address_line1, propResult.rows[0].postcode].filter(Boolean).join(', ');
      }
    }

    if (!tenantEmail) return res.status(400).json({ error: 'Tenant has no email address' });

    // Find active email connection
    const connResult = await pool.query(
      `SELECT id, user_id FROM email_connection WHERE status = 'active' ORDER BY id LIMIT 1`
    );
    if (connResult.rows.length === 0) return res.status(400).json({ error: 'No active email connection configured' });
    const conn = connResult.rows[0];

    const dueDate = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString('en-GB') : 'N/A';
    const amount = `&pound;${(invoice.totalAmount / 100).toFixed(2)}`;

    const bodyHtml = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #791E75; padding: 20px; color: white; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">John Barclay</h1>
    <p style="margin: 5px 0 0; opacity: 0.9;">Invoice</p>
  </div>
  <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb;">
    <p>Dear ${tenantName},</p>
    <p>Please find below the details of your invoice:</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Invoice Number</td>
        <td style="padding: 10px 0; text-align: right; font-weight: 600;">${invoice.invoiceNumber}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Type</td>
        <td style="padding: 10px 0; text-align: right; text-transform: capitalize;">${invoice.invoiceType}</td>
      </tr>
      ${propertyAddress ? `<tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Property</td>
        <td style="padding: 10px 0; text-align: right;">${propertyAddress}</td>
      </tr>` : ''}
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Due Date</td>
        <td style="padding: 10px 0; text-align: right;">${dueDate}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #6b7280; font-size: 18px;">Amount Due</td>
        <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: 700; color: #791E75;">${amount}</td>
      </tr>
    </table>
    <p>Please ensure payment is made by the due date. If you have already made this payment, please disregard this notice.</p>
    <p style="margin-top: 30px;">Kind regards,<br/><strong>John Barclay Property Management</strong></p>
  </div>
  <div style="padding: 15px; background: #f9fafb; text-align: center; font-size: 12px; color: #9ca3af; border: 1px solid #e5e7eb; border-top: none;">
    This is an automated invoice notification from John Barclay Estate &amp; Management Agents.
  </div>
</div>`;

    await pool.query(
      `INSERT INTO sent_email (connection_id, user_id, to_addresses, subject, body_html, status, linked_property_id)
       VALUES ($1, $2, $3, $4, $5, 'queued', $6)`,
      [
        conn.id,
        conn.user_id,
        [tenantEmail],
        `Invoice ${invoice.invoiceNumber} - Due ${dueDate}`,
        bodyHtml,
        invoice.propertyId,
      ]
    );

    // Update invoice status to sent
    await storage.updateInvoice(id, { status: 'sent', sentAt: new Date() });

    res.json({ success: true, message: `Invoice email queued for ${tenantEmail}` });
  } catch (error) {
    console.error('Error sending invoice email:', error);
    res.status(500).json({ error: 'Failed to send invoice email' });
  }
});

// ==========================================
// INVOICE PAYMENT RECONCILIATION
// ==========================================

financeRouter.post('/invoices/reconcile', requireAgent, async (req: any, res) => {
  try {
    // Find all unpaid invoices
    const unpaidResult = await pool.query(`
      SELECT id, tenant_id, property_id, amount, total_amount, due_date, invoice_number
      FROM invoice
      WHERE status IN ('sent', 'overdue')
        AND payment_id IS NULL
      ORDER BY due_date ASC
    `);

    let reconciled = 0;
    let totalReconciled = 0;
    const details: { invoiceNumber: string; amount: number; paymentRef: string }[] = [];

    for (const inv of unpaidResult.rows) {
      // Try to find a matching payment
      const paymentResult = await pool.query(`
        SELECT id, reference, amount, paid_at
        FROM payment
        WHERE status = 'completed'
          AND amount = $1
          AND (tenant_id = $2 OR ($2 IS NULL AND tenant_id IS NULL))
          AND id NOT IN (SELECT payment_id FROM invoice WHERE payment_id IS NOT NULL)
        ORDER BY paid_at DESC
        LIMIT 1
      `, [inv.total_amount, inv.tenant_id]);

      if (paymentResult.rows.length > 0) {
        const payment = paymentResult.rows[0];

        // Mark invoice as paid
        await storage.updateInvoice(inv.id, {
          status: 'paid',
          paidDate: payment.paid_at || new Date(),
          paymentId: payment.id,
        });

        // Record property transaction if property is linked
        if (inv.property_id) {
          await storage.createPropertyTransaction({
            propertyId: inv.property_id,
            landlordId: null,
            transactionType: 'income',
            category: 'rent',
            description: `Invoice ${inv.invoice_number} - reconciled payment`,
            amount: inv.total_amount,
            transactionDate: payment.paid_at || new Date(),
            invoiceId: inv.id,
            paymentId: payment.id,
          });
        }

        reconciled++;
        totalReconciled += inv.total_amount;
        details.push({
          invoiceNumber: inv.invoice_number,
          amount: inv.total_amount,
          paymentRef: payment.reference || `Payment #${payment.id}`,
        });
      }
    }

    // Also mark overdue invoices that are past due
    await pool.query(`
      UPDATE invoice SET status = 'overdue', updated_at = NOW()
      WHERE status = 'sent' AND due_date < NOW() AND payment_id IS NULL
    `);

    res.json({
      reconciled,
      totalReconciled,
      outstanding: unpaidResult.rows.length - reconciled,
      details,
    });
  } catch (error) {
    console.error('Error reconciling payments:', error);
    res.status(500).json({ error: 'Failed to reconcile payments' });
  }
});

// ==========================================
// P&L / PROPERTY TRANSACTION ROUTES
// ==========================================

financeRouter.get('/properties/:id/financials', requireAgent, async (req: any, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const fromDate = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = req.query.to ? new Date(req.query.to as string) : new Date();

    const pnl = await storage.getPropertyPnL(propertyId, fromDate, toDate);
    const transactions = await storage.getPropertyTransactions(propertyId, fromDate, toDate);

    res.json({ ...pnl, transactions });
  } catch (error) {
    console.error('Error fetching property financials:', error);
    res.status(500).json({ error: 'Failed to fetch property financials' });
  }
});

financeRouter.get('/financials/portfolio-summary', requireAgent, async (req: any, res) => {
  try {
    const fromDate = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
    const toDate = req.query.to ? new Date(req.query.to as string) : new Date();

    const portfolio = await storage.getPortfolioPnL(fromDate, toDate);
    const totals = portfolio.reduce(
      (acc, p) => ({
        totalIncome: acc.totalIncome + p.totalIncome,
        totalExpenses: acc.totalExpenses + p.totalExpenses,
        netProfit: acc.netProfit + p.netProfit,
      }),
      { totalIncome: 0, totalExpenses: 0, netProfit: 0 }
    );

    res.json({ properties: portfolio, totals });
  } catch (error) {
    console.error('Error fetching portfolio summary:', error);
    res.status(500).json({ error: 'Failed to fetch portfolio summary' });
  }
});

financeRouter.post('/property-transactions', requireAgent, async (req: any, res) => {
  try {
    const data = insertPropertyTransactionSchema.parse(req.body);
    const txn = await storage.createPropertyTransaction(data);

    // Accounting integration: record expense journal entry
    if (data.transactionType === 'expense') {
      try {
        await accountingRecordExpense(
          data.amount,
          data.category,
          data.description,
          false, // default to company expense; rechargeable flag could be added to the request
          txn.id,
          data.transactionDate
        );
      } catch (e) {
        console.error('[Accounting] Error recording expense journal entry:', e);
      }
    }

    res.status(201).json(txn);
  } catch (error) {
    console.error('Error creating transaction:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// ==========================================
// RENT REVIEW ROUTES
// ==========================================

financeRouter.get('/rent-reviews', requireAgent, async (req: any, res) => {
  try {
    const filters: any = {};
    if (req.query.status) filters.status = req.query.status as string;
    if (req.query.propertyId) filters.propertyId = parseInt(req.query.propertyId as string);
    const reviews = await storage.getAllRentReviews(filters);
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching rent reviews:', error);
    res.status(500).json({ error: 'Failed to fetch rent reviews' });
  }
});

financeRouter.post('/rent-reviews', requireAgent, async (req: any, res) => {
  try {
    const data = insertRentReviewSchema.parse(req.body);
    const review = await storage.createRentReview(data);
    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating rent review:', error);
    if (error instanceof z.ZodError) return res.status(400).json({ error: 'Invalid data', details: error.errors });
    res.status(500).json({ error: 'Failed to create rent review' });
  }
});

financeRouter.put('/rent-reviews/:id', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateRentReview(id, req.body);
    if (!updated) return res.status(404).json({ error: 'Rent review not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error updating rent review:', error);
    res.status(500).json({ error: 'Failed to update rent review' });
  }
});

financeRouter.post('/rent-reviews/:id/serve-notice', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await storage.updateRentReview(id, {
      status: 'notice_sent',
      noticeServedDate: new Date(),
    });
    if (!updated) return res.status(404).json({ error: 'Rent review not found' });
    res.json(updated);
  } catch (error) {
    console.error('Error serving notice:', error);
    res.status(500).json({ error: 'Failed to serve notice' });
  }
});

financeRouter.post('/rent-reviews/:id/implement', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const review = await storage.updateRentReview(id, {
      status: 'implemented',
      approvedBy: req.user?.id,
    });
    if (!review) return res.status(404).json({ error: 'Rent review not found' });

    // Update tenancy rent amount
    if (review.tenancyId) {
      await pool.query(
        `UPDATE tenancy SET rent_amount = $1, updated_at = NOW() WHERE id = $2`,
        [review.proposedRent / 100, review.tenancyId] // Convert pence to decimal
      );
    }

    res.json(review);
  } catch (error) {
    console.error('Error implementing rent review:', error);
    res.status(500).json({ error: 'Failed to implement rent review' });
  }
});

// ==========================================
// TAYLOR FINANCE AGENT: STATEMENT APPROVAL WORKFLOW
// ==========================================

// List pending (draft) statements with landlord and property details
financeRouter.get('/statements/pending', requireAgent, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM landlord_statement WHERE status = 'draft'`
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(`
      SELECT
        ls.*,
        l.name as landlord_name,
        l.email as landlord_email,
        p.address_line1 as property_address,
        p.postcode as property_postcode
      FROM landlord_statement ls
      LEFT JOIN landlord l ON l.id = ls.landlord_id
      LEFT JOIN property p ON p.id = ls.property_id
      WHERE ls.status = 'draft'
      ORDER BY ls.created_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    // Fetch line items for each statement
    const statements = [];
    for (const row of result.rows) {
      const lineItemsResult = await pool.query(
        `SELECT * FROM statement_line_item WHERE statement_id = $1 ORDER BY transaction_date`,
        [row.id]
      );
      statements.push({
        id: row.id,
        landlordId: row.landlord_id,
        propertyId: row.property_id,
        statementNumber: row.statement_number,
        attentionNeeded: row.attention_needed,
        statementPeriodStart: row.statement_period_start,
        statementPeriodEnd: row.statement_period_end,
        totalRentCollected: row.total_rent_collected,
        managementFees: row.management_fees,
        maintenanceDeductions: row.maintenance_deductions,
        otherDeductions: row.other_deductions,
        vatOnFees: row.vat_on_fees,
        netPayable: row.net_payable,
        status: row.status,
        pdfUrl: row.pdf_url,
        createdAt: row.created_at,
        landlordName: row.landlord_name,
        landlordEmail: row.landlord_email,
        propertyAddress: [row.property_address, row.property_postcode].filter(Boolean).join(', '),
        lineItems: lineItemsResult.rows.map((li: any) => ({
          id: li.id,
          lineType: li.line_type,
          description: li.description,
          amount: li.amount,
          transactionDate: li.transaction_date,
        })),
      });
    }

    res.json({ statements, total, page, limit });
  } catch (error) {
    console.error('Error fetching pending statements:', error);
    res.status(500).json({ error: 'Failed to fetch pending statements' });
  }
});

// Approve a draft statement (draft -> approved)
financeRouter.post('/statements/:id/approve', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const statement = await storage.getStatement(id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });
    if (statement.status !== 'draft') {
      return res.status(400).json({ error: `Cannot approve statement in '${statement.status}' status. Must be 'draft'.` });
    }

    const updated = await storage.updateStatement(id, { status: 'approved' });
    console.log(`[Finance] Statement ${id} approved by user ${req.user?.id}`);
    res.json(updated);
  } catch (error) {
    console.error('Error approving statement:', error);
    res.status(500).json({ error: 'Failed to approve statement' });
  }
});

// Send an approved statement (approved -> sent): generates PDF, emails landlord
financeRouter.post('/statements/:id/send', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const statement = await storage.getStatement(id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });
    if (statement.status !== 'approved') {
      return res.status(400).json({ error: `Cannot send statement in '${statement.status}' status. Must be 'approved'.` });
    }

    // Load landlord and property details
    const landlordResult = await pool.query(`SELECT name, email FROM landlord WHERE id = $1`, [statement.landlordId]);
    if (landlordResult.rows.length === 0) return res.status(404).json({ error: 'Landlord not found' });
    const landlord = landlordResult.rows[0];

    let propertyAddress = 'Property';
    if (statement.propertyId) {
      const propResult = await pool.query(`SELECT address_line1, postcode FROM property WHERE id = $1`, [statement.propertyId]);
      if (propResult.rows.length > 0) {
        propertyAddress = [propResult.rows[0].address_line1, propResult.rows[0].postcode].filter(Boolean).join(', ');
      }
    }

    // Load line items
    const lineItemsResult = await pool.query(
      `SELECT * FROM statement_line_item WHERE statement_id = $1 ORDER BY transaction_date`,
      [id]
    );

    // Generate PDF
    const pdfData = {
      statementNumber: statement.statementNumber || `STMT-${id}`,
      landlordName: landlord.name || 'Landlord',
      propertyAddress,
      periodStart: new Date(statement.statementPeriodStart),
      periodEnd: new Date(statement.statementPeriodEnd),
      lineItems: lineItemsResult.rows.map((li: any) => ({
        date: new Date(li.transaction_date || statement.statementPeriodEnd),
        description: li.description,
        amount: li.amount,
      })),
      totalRentCollected: statement.totalRentCollected,
      managementFees: statement.managementFees,
      maintenanceDeductions: statement.maintenanceDeductions,
      otherDeductions: statement.otherDeductions,
      vatOnFees: statement.vatOnFees,
      netPayable: statement.netPayable,
    };

    const pdfBuffer = await generateStatementPDF(pdfData);

    // Save PDF to uploads directory
    const periodStr = new Date(statement.statementPeriodEnd).toISOString().slice(0, 7).replace('-', '');
    const pdfFilename = `STMT-${periodStr}-${statement.propertyId || statement.landlordId}.pdf`;
    const pdfDir = path.join(process.cwd(), 'uploads', 'statements');
    if (!fs.existsSync(pdfDir)) {
      fs.mkdirSync(pdfDir, { recursive: true });
    }
    const pdfPath = path.join(pdfDir, pdfFilename);
    fs.writeFileSync(pdfPath, pdfBuffer);
    const pdfUrl = `/uploads/statements/${pdfFilename}`;

    // Update statement with PDF URL
    await storage.updateStatement(id, { pdfUrl });

    // Send email to landlord with PDF attachment
    if (landlord.email) {
      const connResult = await pool.query(
        `SELECT id, user_id FROM email_connection WHERE status = 'active' ORDER BY id LIMIT 1`
      );
      if (connResult.rows.length > 0) {
        const conn = connResult.rows[0];
        const periodStart = new Date(statement.statementPeriodStart).toLocaleDateString('en-GB');
        const periodEnd = new Date(statement.statementPeriodEnd).toLocaleDateString('en-GB');
        const fmt = (pence: number) => `&pound;${(pence / 100).toFixed(2)}`;

        await pool.query(
          `INSERT INTO sent_email (connection_id, user_id, to_addresses, subject, body_html, status)
           VALUES ($1, $2, $3, $4, $5, 'queued')`,
          [
            conn.id,
            conn.user_id,
            [landlord.email],
            `Landlord Statement - ${periodStart} to ${periodEnd}`,
            `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: #791E75; padding: 20px; color: white; text-align: center;">
    <h1 style="margin: 0; font-size: 24px;">John Barclay</h1>
    <p style="margin: 5px 0 0; opacity: 0.9;">Landlord Statement</p>
  </div>
  <div style="padding: 30px; background: #ffffff; border: 1px solid #e5e7eb;">
    <p>Dear ${landlord.name},</p>
    <p>Please find attached your statement for the period <strong>${periodStart}</strong> to <strong>${periodEnd}</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Rent Collected</td>
        <td style="padding: 10px 0; text-align: right; font-weight: 600; color: #16a34a;">${fmt(statement.totalRentCollected)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">Management Fees</td>
        <td style="padding: 10px 0; text-align: right; color: #ea580c;">-${fmt(statement.managementFees)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #e5e7eb;">
        <td style="padding: 10px 0; color: #6b7280;">VAT on Fees</td>
        <td style="padding: 10px 0; text-align: right; color: #ea580c;">-${fmt(statement.vatOnFees)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; font-size: 18px; color: #6b7280;">Net Payable</td>
        <td style="padding: 10px 0; text-align: right; font-size: 18px; font-weight: 700; color: #791E75;">${fmt(statement.netPayable)}</td>
      </tr>
    </table>
    <p>Payment will be made to your registered bank account.</p>
    <p style="margin-top: 30px;">Kind regards,<br/><strong>John Barclay Estate &amp; Management Agents</strong></p>
  </div>
</div>`,
          ]
        );
      }
    }

    // Update status to sent
    await storage.updateStatement(id, { status: 'sent', sentAt: new Date() });
    console.log(`[Finance] Statement ${id} sent to ${landlord.email || 'no-email'} by user ${req.user?.id}`);

    res.json({ success: true, pdfUrl, message: `Statement sent to ${landlord.email || 'landlord'}` });
  } catch (error) {
    console.error('Error sending statement:', error);
    res.status(500).json({ error: 'Failed to send statement' });
  }
});

// Reject (delete) a draft statement and its line items
financeRouter.post('/statements/:id/reject', requireAgent, async (req: any, res) => {
  try {
    const id = parseInt(req.params.id);
    const statement = await storage.getStatement(id);
    if (!statement) return res.status(404).json({ error: 'Statement not found' });
    if (statement.status !== 'draft') {
      return res.status(400).json({ error: `Cannot reject statement in '${statement.status}' status. Must be 'draft'.` });
    }

    const reason = req.body.reason || 'No reason provided';

    // Delete line items first, then statement
    await pool.query(`DELETE FROM statement_line_item WHERE statement_id = $1`, [id]);
    await pool.query(`DELETE FROM landlord_statement WHERE id = $1`, [id]);

    console.log(`[Finance] Statement ${id} rejected and deleted by user ${req.user?.id}. Reason: ${reason}`);
    res.json({ success: true, message: 'Statement rejected and deleted' });
  } catch (error) {
    console.error('Error rejecting statement:', error);
    res.status(500).json({ error: 'Failed to reject statement' });
  }
});

// Manual trigger: generate monthly statements via Taylor finance agent
financeRouter.post('/statements/generate-monthly', requireAgent, async (req: any, res) => {
  try {
    const { year, month } = req.body;
    if (!year || !month) {
      return res.status(400).json({ error: 'year and month are required' });
    }

    const result = await generateMonthlyStatements(parseInt(year), parseInt(month));
    console.log(`[Finance] Monthly statements generated: ${result.created} created, ${result.attentionNeeded} need attention`);
    res.json(result);
  } catch (error) {
    console.error('Error generating monthly statements:', error);
    res.status(500).json({ error: 'Failed to generate monthly statements' });
  }
});

// Manual trigger: generate monthly invoices via Taylor finance agent
financeRouter.post('/invoices/generate-monthly', requireAgent, async (req: any, res) => {
  try {
    const result = await generateMonthlyInvoices(new Date());
    console.log(`[Finance] Monthly invoices generated: ${result.created} created, ${result.sent} sent`);
    res.json(result);
  } catch (error) {
    console.error('Error generating monthly invoices:', error);
    res.status(500).json({ error: 'Failed to generate monthly invoices' });
  }
});

// Enhanced invoice listing with joins and filters
financeRouter.get('/invoices/list', requireAgent, async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = (page - 1) * limit;

    const conditions: string[] = [];
    const params: any[] = [];
    let paramIdx = 1;

    if (req.query.tenantId) {
      conditions.push(`i.tenant_id = $${paramIdx++}`);
      params.push(parseInt(req.query.tenantId as string));
    }
    if (req.query.propertyId) {
      conditions.push(`i.property_id = $${paramIdx++}`);
      params.push(parseInt(req.query.propertyId as string));
    }
    if (req.query.status) {
      conditions.push(`i.status = $${paramIdx++}`);
      params.push(req.query.status as string);
    }
    if (req.query.invoiceType) {
      conditions.push(`i.invoice_type = $${paramIdx++}`);
      params.push(req.query.invoiceType as string);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM invoice i ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(`
      SELECT
        i.*,
        t.name as tenant_name,
        p.address_line1 as property_address,
        p.postcode as property_postcode
      FROM invoice i
      LEFT JOIN tenant t ON t.id = i.tenant_id
      LEFT JOIN property p ON p.id = i.property_id
      ${whereClause}
      ORDER BY i.due_date DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `, [...params, limit, offset]);

    const invoices = result.rows.map((row: any) => ({
      id: row.id,
      invoiceNumber: row.invoice_number,
      propertyId: row.property_id,
      tenantId: row.tenant_id,
      landlordId: row.landlord_id,
      tenancyId: row.tenancy_id,
      invoiceType: row.invoice_type,
      amount: row.amount,
      vatAmount: row.vat_amount,
      totalAmount: row.total_amount,
      dueDate: row.due_date,
      paidDate: row.paid_date,
      status: row.status,
      sentAt: row.sent_at,
      createdAt: row.created_at,
      tenantName: row.tenant_name,
      propertyAddress: [row.property_address, row.property_postcode].filter(Boolean).join(', '),
    }));

    res.json({ invoices, total, page, limit });
  } catch (error) {
    console.error('Error fetching invoices list:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// ==========================================
// CSV EXPORT ROUTES
// ==========================================

financeRouter.get('/export/invoices', requireAgent, async (req: any, res) => {
  try {
    const invoices = await storage.getAllInvoices({
      status: req.query.status as string,
    });

    const csv = [
      'Invoice Number,Type,Tenant ID,Property ID,Amount (£),VAT (£),Total (£),Due Date,Status,Paid Date',
      ...invoices.map(i =>
        `${i.invoiceNumber},${i.invoiceType},${i.tenantId || ''},${i.propertyId || ''},${(i.amount / 100).toFixed(2)},${((i.vatAmount || 0) / 100).toFixed(2)},${(i.totalAmount / 100).toFixed(2)},${i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : ''},${i.status},${i.paidDate ? new Date(i.paidDate).toISOString().slice(0, 10) : ''}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting invoices:', error);
    res.status(500).json({ error: 'Failed to export invoices' });
  }
});

financeRouter.get('/export/payments', requireAgent, async (req: any, res) => {
  try {
    const result = await pool.query(`SELECT * FROM payment ORDER BY created_at DESC`);

    const csv = [
      'ID,Type,Amount (£),Status,Method,Payer,Payee,Reference,Due Date,Paid Date',
      ...result.rows.map((p: any) =>
        `${p.id},${p.payment_type || ''},${(p.amount / 100).toFixed(2)},${p.status},${p.payment_method || ''},${p.payer_name || ''},${p.payee_name || ''},${p.reference || ''},${p.due_date ? new Date(p.due_date).toISOString().slice(0, 10) : ''},${p.paid_at ? new Date(p.paid_at).toISOString().slice(0, 10) : ''}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting payments:', error);
    res.status(500).json({ error: 'Failed to export payments' });
  }
});

financeRouter.get('/export/statements', requireAgent, async (req: any, res) => {
  try {
    const landlordId = req.query.landlordId ? parseInt(req.query.landlordId as string) : undefined;
    let result;
    if (landlordId) {
      result = await pool.query(`SELECT * FROM landlord_statement WHERE landlord_id = $1 ORDER BY statement_period_end DESC`, [landlordId]);
    } else {
      result = await pool.query(`SELECT * FROM landlord_statement ORDER BY statement_period_end DESC`);
    }

    const csv = [
      'ID,Landlord ID,Period Start,Period End,Rent Collected (£),Mgmt Fees (£),Maintenance (£),VAT (£),Net Payable (£),Status',
      ...result.rows.map((s: any) =>
        `${s.id},${s.landlord_id},${new Date(s.statement_period_start).toISOString().slice(0, 10)},${new Date(s.statement_period_end).toISOString().slice(0, 10)},${(s.total_rent_collected / 100).toFixed(2)},${(s.management_fees / 100).toFixed(2)},${(s.maintenance_deductions / 100).toFixed(2)},${(s.vat_on_fees / 100).toFixed(2)},${(s.net_payable / 100).toFixed(2)},${s.status}`
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=statements.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting statements:', error);
    res.status(500).json({ error: 'Failed to export statements' });
  }
});

// ==========================================
// INVOICE PAYMENT RECORDING (Mark as Paid)
// ==========================================

financeRouter.post('/invoices/:id/record-payment', requireAgent, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.id);
    const { paymentMethod, reference, notes, paidAt } = req.body;

    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'paid') return res.status(400).json({ error: 'Invoice already paid' });
    if (!invoice.tenantId) return res.status(400).json({ error: 'Invoice has no tenant' });

    const result = await recordPaymentAndReconcile(
      {
        tenantId: invoice.tenantId,
        propertyId: invoice.propertyId || undefined,
        landlordId: invoice.landlordId || undefined,
        amount: invoice.totalAmount,
        paymentMethod: paymentMethod || 'bank_transfer',
        reference: reference || undefined,
        description: notes || `Payment for invoice ${invoice.invoiceNumber}`,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
      },
      invoiceId
    );

    res.json({
      success: true,
      paymentId: result.paymentId,
      invoiceUpdated: result.invoiceUpdated,
      arrearsCleared: result.arrearsCleared,
      transactionCreated: result.transactionCreated,
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// ==========================================
// BANK RECONCILIATION ROUTES
// ==========================================

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Import bank statement CSV
financeRouter.post('/bank-transactions/import', requireAgent, upload.single('file'), async (req, res) => {
  try {
    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const csvContent = file.buffer.toString('utf-8');
    const bankName = req.body.bankName || 'Unknown';
    const accountNumber = req.body.accountNumber;
    const bankFormat = req.body.bankFormat;

    const importResult = await importBankStatement(csvContent, bankName, accountNumber, bankFormat);

    // Auto-reconcile the imported batch
    const reconcileResult = await autoReconcile(importResult.batchId);

    res.json({
      success: true,
      format: importResult.format,
      imported: importResult.imported,
      batchId: importResult.batchId,
      matched: reconcileResult.matched,
      unmatched: reconcileResult.unmatched,
    });
  } catch (error: any) {
    console.error('Error importing bank statement:', error);
    res.status(400).json({ error: error.message || 'Failed to import bank statement' });
  }
});

// List bank transactions with filters
financeRouter.get('/bank-transactions', requireAgent, async (req, res) => {
  try {
    const filters: any = {};
    if (req.query.matchStatus) filters.matchStatus = req.query.matchStatus as string;
    if (req.query.bankName) filters.bankName = req.query.bankName as string;
    if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate as string);
    if (req.query.toDate) filters.toDate = new Date(req.query.toDate as string);

    const transactions = await storage.getAllBankTransactions(filters);
    res.json(transactions);
  } catch (error) {
    console.error('Error fetching bank transactions:', error);
    res.status(500).json({ error: 'Failed to fetch bank transactions' });
  }
});

// Get unmatched bank transactions (credits only)
financeRouter.get('/bank-transactions/unmatched', requireAgent, async (req, res) => {
  try {
    const unmatched = await storage.getUnmatchedBankTransactions();
    // Only return credits (incoming payments)
    const credits = unmatched.filter(t => t.transactionType === 'credit');
    res.json(credits);
  } catch (error) {
    console.error('Error fetching unmatched transactions:', error);
    res.status(500).json({ error: 'Failed to fetch unmatched transactions' });
  }
});

// Manual match a bank transaction to an invoice
financeRouter.post('/bank-transactions/:id/match', requireAgent, async (req, res) => {
  try {
    const bankTransactionId = parseInt(req.params.id);
    const { invoiceId } = req.body;

    if (!invoiceId) return res.status(400).json({ error: 'invoiceId required' });

    const result = await manualMatch(bankTransactionId, invoiceId);
    if (!result.success) return res.status(400).json({ error: result.error });

    res.json({ success: true, paymentId: result.paymentId });
  } catch (error) {
    console.error('Error matching transaction:', error);
    res.status(500).json({ error: 'Failed to match transaction' });
  }
});

// Exclude a bank transaction (mark as non-rent)
financeRouter.post('/bank-transactions/:id/exclude', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.updateBankTransaction(id, {
      matchStatus: 'excluded',
      matchedBy: 'manual',
      matchedAt: new Date(),
    });
    res.json({ success: true });
  } catch (error) {
    console.error('Error excluding transaction:', error);
    res.status(500).json({ error: 'Failed to exclude transaction' });
  }
});

// Bank transaction summary (counts by status)
financeRouter.get('/bank-transactions/summary', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT match_status, COUNT(*) as count,
             SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_credits,
             SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_debits
      FROM bank_transaction
      GROUP BY match_status
    `);

    const summary: Record<string, { count: number; totalCredits: number; totalDebits: number }> = {};
    for (const row of result.rows) {
      summary[row.match_status] = {
        count: parseInt(row.count),
        totalCredits: parseInt(row.total_credits || '0'),
        totalDebits: parseInt(row.total_debits || '0'),
      };
    }

    res.json(summary);
  } catch (error) {
    console.error('Error fetching bank transaction summary:', error);
    res.status(500).json({ error: 'Failed to fetch summary' });
  }
});

// Re-run auto-reconciliation
financeRouter.post('/bank-transactions/reconcile', requireAgent, async (req, res) => {
  try {
    const result = await autoReconcile();
    res.json({ success: true, matched: result.matched, unmatched: result.unmatched });
  } catch (error) {
    console.error('Error running reconciliation:', error);
    res.status(500).json({ error: 'Failed to run reconciliation' });
  }
});

// ==========================================
// GOCARDLESS ROUTES
// ==========================================

// Check GoCardless config
financeRouter.get('/gocardless/config', requireAgent, async (req, res) => {
  res.json({ configured: isGoCardlessConfigured() });
});

// Setup a mandate (create redirect flow)
financeRouter.post('/gocardless/setup-mandate', requireAgent, async (req, res) => {
  try {
    const { tenantId, tenancyId, propertyId, description, successRedirectUrl } = req.body;

    if (!tenantId) return res.status(400).json({ error: 'tenantId required' });

    const result = await createRedirectFlow(
      tenantId,
      tenancyId,
      propertyId,
      description || 'Monthly rent Direct Debit',
      successRedirectUrl || `${req.protocol}://${req.get('host')}/api/crm/gocardless/complete-redirect`
    );

    res.json({
      success: true,
      redirectUrl: result.redirectUrl,
      mandateId: result.mandateId,
    });
  } catch (error: any) {
    console.error('Error creating redirect flow:', error);
    res.status(500).json({ error: error.message || 'Failed to create redirect flow' });
  }
});

// Complete redirect flow (callback from GoCardless)
financeRouter.get('/gocardless/complete-redirect', async (req, res) => {
  try {
    const redirectFlowId = req.query.redirect_flow_id as string;
    if (!redirectFlowId) return res.status(400).json({ error: 'redirect_flow_id required' });

    const result = await completeRedirectFlow(redirectFlowId);

    // Redirect back to the app
    res.redirect(`/crm/direct-debits?setup=success&mandate=${result.mandateId}`);
  } catch (error: any) {
    console.error('Error completing redirect flow:', error);
    res.redirect('/crm/direct-debits?setup=error');
  }
});

// List all mandates
financeRouter.get('/gocardless/mandates', requireAgent, async (req, res) => {
  try {
    const mandates = await storage.getAllGocardlessMandates();
    res.json(mandates);
  } catch (error) {
    console.error('Error fetching mandates:', error);
    res.status(500).json({ error: 'Failed to fetch mandates' });
  }
});

// Get mandate for a specific tenant
financeRouter.get('/gocardless/mandates/tenant/:tenantId', requireAgent, async (req, res) => {
  try {
    const tenantId = parseInt(req.params.tenantId);
    const mandate = await storage.getGocardlessMandateByTenant(tenantId);
    res.json(mandate || null);
  } catch (error) {
    console.error('Error fetching mandate:', error);
    res.status(500).json({ error: 'Failed to fetch mandate' });
  }
});

// Collect payment for an invoice
financeRouter.post('/gocardless/collect/:invoiceId', requireAgent, async (req, res) => {
  try {
    const invoiceId = parseInt(req.params.invoiceId);
    const { mandateId, chargeDate } = req.body;

    const invoice = await storage.getInvoice(invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const result = await collectPayment(
      mandateId,
      invoiceId,
      invoice.totalAmount,
      `Rent payment - ${invoice.invoiceNumber}`,
      chargeDate
    );

    res.json({
      success: true,
      gcPaymentId: result.gcPaymentId,
      dbPaymentId: result.dbPaymentId,
    });
  } catch (error: any) {
    console.error('Error collecting payment:', error);
    res.status(500).json({ error: error.message || 'Failed to collect payment' });
  }
});

// Cancel a mandate
financeRouter.delete('/gocardless/mandates/:id', requireAgent, async (req, res) => {
  try {
    const mandateId = parseInt(req.params.id);
    await cancelMandate(mandateId);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error cancelling mandate:', error);
    res.status(500).json({ error: error.message || 'Failed to cancel mandate' });
  }
});

// Get DD payments for a mandate
financeRouter.get('/gocardless/mandates/:id/payments', requireAgent, async (req, res) => {
  try {
    const mandateId = parseInt(req.params.id);
    const payments = await storage.getGocardlessPaymentsByMandate(mandateId);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching mandate payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GoCardless webhook handler
financeRouter.post('/gocardless/webhooks', async (req, res) => {
  try {
    const signature = req.headers['webhook-signature'] as string;
    const body = JSON.stringify(req.body);

    if (!verifyWebhookSignature(body, signature || '')) {
      return res.status(498).json({ error: 'Invalid signature' });
    }

    const events = req.body.events || [];
    const result = await processWebhookEvents(events);

    console.log(`GoCardless webhook: processed ${result.processed}, errors ${result.errors}`);
    res.status(204).send();
  } catch (error) {
    console.error('Error handling GoCardless webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});
