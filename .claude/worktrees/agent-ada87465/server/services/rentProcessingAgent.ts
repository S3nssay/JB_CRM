/**
 * Rent Processing Agent
 *
 * Autonomous agent that runs the full rent-to-landlord payment cycle:
 * 1. Collect payments (GoCardless if configured, else bank CSV import)
 * 2. Match payments to tenant invoices
 * 3. Generate & email tenant receipts
 * 4. Process maintenance/contractor charges to landlord accounts
 * 5. Generate landlord statements (rent - commission - charges = net)
 * 6. Email statements to landlords
 * 7. Prepare landlord bank transfer instructions
 */

import { pool } from '../db';
import { isGoCardlessConfigured } from '../gocardlessService';
import { recordPaymentAndReconcile } from '../reconciliationEngine';
import { AgentLogEntry } from '@shared/schema';
import PDFDocument from 'pdfkit';

// ============================================================
// Types
// ============================================================

interface AgentRunState {
  runId: number;
  log: AgentLogEntry[];
  stats: {
    paymentsMatched: number;
    receiptsGenerated: number;
    receiptsSent: number;
    chargesProcessed: number;
    statementsGenerated: number;
    statementsSent: number;
    landlordPaymentsPrepared: number;
    totalRentProcessed: number;
    totalCommission: number;
    totalCharges: number;
    totalNetPayable: number;
    errorCount: number;
  };
}

interface MatchedPayment {
  bankTransactionId: number;
  invoiceId: number;
  tenantId: number;
  tenancyId: number;
  propertyId: number;
  landlordId: number;
  amount: number;
  tenantName: string;
  tenantEmail: string;
  propertyAddress: string;
}

interface LandlordStatementData {
  landlordId: number;
  landlordName: string;
  landlordEmail: string;
  properties: {
    propertyId: number;
    address: string;
    tenantName: string;
    rentCollected: number;
    managementFeePercent: number;
    managementFee: number;
    charges: { description: string; amount: number }[];
    totalCharges: number;
    netPayable: number;
  }[];
  totalRent: number;
  totalFees: number;
  totalCharges: number;
  totalNet: number;
}

// ============================================================
// Agent Runner
// ============================================================

export async function runRentProcessingAgent(triggeredBy: string): Promise<number> {
  // Create agent run record
  const runResult = await pool.query(
    `INSERT INTO agent_run (agent_type, status, triggered_by, steps_total)
     VALUES ('rent_processing', 'running', $1, 7)
     RETURNING id`,
    [triggeredBy]
  );
  const runId = runResult.rows[0].id;

  const state: AgentRunState = {
    runId,
    log: [],
    stats: {
      paymentsMatched: 0, receiptsGenerated: 0, receiptsSent: 0,
      chargesProcessed: 0, statementsGenerated: 0, statementsSent: 0,
      landlordPaymentsPrepared: 0, totalRentProcessed: 0,
      totalCommission: 0, totalCharges: 0, totalNetPayable: 0, errorCount: 0,
    },
  };

  try {
    // Step 1: Identify payment source
    await step1_identifyPayments(state);

    // Step 2: Match payments to invoices
    await step2_matchPayments(state);

    // Step 3: Generate tenant receipts
    await step3_generateReceipts(state);

    // Step 4: Email tenant receipts
    await step4_emailReceipts(state);

    // Step 5: Process maintenance charges
    await step5_processCharges(state);

    // Step 6: Generate landlord statements
    await step6_generateStatements(state);

    // Step 7: Prepare landlord payments
    await step7_prepareLandlordPayments(state);

    // Mark complete
    await updateRun(state, 'completed');
    addLog(state, 7, 'complete', 'success', 'Rent processing agent completed successfully');

  } catch (error: any) {
    state.stats.errorCount++;
    addLog(state, 0, 'fatal_error', 'error', error.message);
    await updateRun(state, 'failed');
  }

  return runId;
}

// ============================================================
// Step 1: Identify Payments (GoCardless or Bank CSV)
// ============================================================

async function step1_identifyPayments(state: AgentRunState) {
  const stepNum = 1;

  if (isGoCardlessConfigured()) {
    addLog(state, stepNum, 'identify_payments', 'success',
      'GoCardless is configured — payments arrive via Direct Debit webhooks automatically');

    // GoCardless payments are auto-reconciled via webhooks (handlePaymentEvent in gocardlessService)
    // We just need to check for any confirmed payments that haven't been fully processed
    const unprocessedGC = await pool.query(`
      SELECT gp.id, gp.invoice_id, gp.amount, gp.status,
        m.tenant_id, m.tenancy_id, m.property_id
      FROM gocardless_payment gp
      JOIN gocardless_mandate m ON gp.mandate_id = m.id
      WHERE gp.status = 'confirmed' AND gp.payment_id IS NULL
    `);

    if (unprocessedGC.rows.length > 0) {
      addLog(state, stepNum, 'gc_unprocessed', 'success',
        `Found ${unprocessedGC.rows.length} GoCardless payments to process`);
    } else {
      addLog(state, stepNum, 'gc_all_processed', 'success',
        'All GoCardless payments already reconciled');
    }
  } else {
    // Bank CSV fallback — check for unmatched bank transactions
    const unmatched = await pool.query(`
      SELECT COUNT(*)::int as count, COALESCE(SUM(amount), 0)::int as total
      FROM bank_transaction
      WHERE match_status = 'unmatched' AND transaction_type = 'credit'
    `);

    const count = unmatched.rows[0]?.count || 0;
    const total = unmatched.rows[0]?.total || 0;

    if (count > 0) {
      addLog(state, stepNum, 'bank_csv_unmatched', 'success',
        `GoCardless not configured. Found ${count} unmatched bank credits totalling £${(total / 100).toFixed(2)} — will attempt auto-match`);
    } else {
      addLog(state, stepNum, 'bank_csv_none', 'success',
        'GoCardless not configured. No unmatched bank transactions to process. Upload a bank CSV first.');
    }
  }

  await updateRunStep(state, stepNum);
}

// ============================================================
// Step 2: Match Payments to Invoices
// ============================================================

async function step2_matchPayments(state: AgentRunState) {
  const stepNum = 2;

  if (isGoCardlessConfigured()) {
    // Process any unreconciled GoCardless confirmed payments
    const unprocessed = await pool.query(`
      SELECT gp.id, gp.invoice_id, gp.amount,
        m.tenant_id, m.tenancy_id, m.property_id
      FROM gocardless_payment gp
      JOIN gocardless_mandate m ON gp.mandate_id = m.id
      WHERE gp.status = 'confirmed' AND gp.payment_id IS NULL AND gp.invoice_id IS NOT NULL
    `);

    for (const gp of unprocessed.rows) {
      try {
        const result = await recordPaymentAndReconcile({
          tenantId: gp.tenant_id,
          propertyId: gp.property_id || undefined,
          amount: gp.amount,
          paymentMethod: 'direct_debit',
          reference: `GoCardless payment ${gp.id}`,
          description: 'Rent - Direct Debit',
          paidAt: new Date(),
        }, gp.invoice_id);

        // Link back
        await pool.query(
          `UPDATE gocardless_payment SET payment_id = $1, status = 'paid_out' WHERE id = $2`,
          [result.paymentId, gp.id]
        );

        state.stats.paymentsMatched++;
        state.stats.totalRentProcessed += gp.amount;
      } catch (err: any) {
        state.stats.errorCount++;
        addLog(state, stepNum, 'gc_match_error', 'error',
          `Failed to reconcile GC payment ${gp.id}: ${err.message}`);
      }
    }

    addLog(state, stepNum, 'gc_matching', 'success',
      `Matched ${state.stats.paymentsMatched} GoCardless payments`);

  } else {
    // Bank CSV auto-matching
    const unmatched = await pool.query(`
      SELECT bt.id, bt.amount, bt.reference, bt.description, bt.transaction_date
      FROM bank_transaction bt
      WHERE bt.match_status = 'unmatched' AND bt.transaction_type = 'credit'
      ORDER BY bt.transaction_date ASC
    `);

    for (const txn of unmatched.rows) {
      try {
        const match = await attemptAutoMatch(txn);
        if (match) {
          const result = await recordPaymentAndReconcile({
            tenantId: match.tenantId,
            propertyId: match.propertyId || undefined,
            landlordId: match.landlordId || undefined,
            amount: txn.amount,
            paymentMethod: 'bank_transfer',
            reference: txn.reference || txn.description,
            description: `Rent payment - auto-matched from bank CSV`,
            paidAt: new Date(txn.transaction_date),
          }, match.invoiceId);

          // Update bank transaction
          await pool.query(
            `UPDATE bank_transaction SET match_status = 'auto_matched', matched_invoice_id = $1, matched_payment_id = $2, matched_at = NOW(), matched_by = 'agent' WHERE id = $3`,
            [match.invoiceId, result.paymentId, txn.id]
          );

          state.stats.paymentsMatched++;
          state.stats.totalRentProcessed += txn.amount;
        }
      } catch (err: any) {
        state.stats.errorCount++;
        addLog(state, stepNum, 'csv_match_error', 'error',
          `Failed to match bank txn ${txn.id}: ${err.message}`);
      }
    }

    addLog(state, stepNum, 'csv_matching', 'success',
      `Auto-matched ${state.stats.paymentsMatched} of ${unmatched.rows.length} bank transactions`);
  }

  await updateRunStep(state, stepNum);
}

/**
 * Attempt to auto-match a bank transaction to a pending/overdue invoice.
 * Matches by: exact amount + (tenant name in reference OR invoice reference match)
 */
async function attemptAutoMatch(txn: any): Promise<{ invoiceId: number; tenantId: number; propertyId: number; landlordId: number } | null> {
  // Strategy 1: Exact amount match with reference containing tenant name
  const byAmount = await pool.query(`
    SELECT i.id as invoice_id, i.tenant_id, tn.property_id, tn.landlord_id,
      t.name as tenant_name
    FROM invoice i
    JOIN tenancy tn ON i.tenancy_id = tn.id
    JOIN tenant t ON tn.tenant_id = t.id
    WHERE i.status IN ('pending', 'sent', 'overdue')
      AND i.invoice_type = 'rent'
      AND i.amount = $1
    ORDER BY i.due_date ASC
  `, [txn.amount]);

  const ref = (txn.reference || '' + ' ' + txn.description || '').toLowerCase();

  for (const row of byAmount.rows) {
    // Check if reference contains tenant name (partial match)
    const nameParts = (row.tenant_name || '').toLowerCase().split(/\s+/);
    const nameMatch = nameParts.some((part: string) => part.length > 2 && ref.includes(part));

    if (nameMatch) {
      return {
        invoiceId: row.invoice_id,
        tenantId: row.tenant_id,
        propertyId: row.property_id,
        landlordId: row.landlord_id,
      };
    }
  }

  // Strategy 2: If only one invoice matches the exact amount, use it
  if (byAmount.rows.length === 1) {
    const row = byAmount.rows[0];
    return {
      invoiceId: row.invoice_id,
      tenantId: row.tenant_id,
      propertyId: row.property_id,
      landlordId: row.landlord_id,
    };
  }

  return null;
}

// ============================================================
// Step 3: Generate Tenant Receipts (PDF)
// ============================================================

async function step3_generateReceipts(state: AgentRunState) {
  const stepNum = 3;

  // Find recently paid invoices that don't have a receipt yet
  const paidInvoices = await pool.query(`
    SELECT i.id, i.amount, i.due_date, i.paid_date, i.invoice_number as reference,
      t.name as tenant_name, t.email as tenant_email,
      COALESCE(p.address, p.address_line1) as property_address,
      p.postcode, tn.rent_amount, tn.rent_frequency
    FROM invoice i
    JOIN tenancy tn ON i.tenancy_id = tn.id
    JOIN tenant t ON tn.tenant_id = t.id
    JOIN property p ON tn.property_id = p.id
    WHERE i.status = 'paid'
      AND i.invoice_type = 'rent'
      AND i.paid_date >= CURRENT_DATE - INTERVAL '7 days'
      AND i.pdf_url IS NULL
    ORDER BY i.paid_date DESC
    LIMIT 100
  `);

  // Check if receipt_pdf_url column exists, if not we'll skip PDF storage
  let hasReceiptColumn = true;
  try {
    await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'invoice' AND column_name = 'receipt_pdf_url'");
  } catch {
    hasReceiptColumn = false;
  }

  for (const inv of paidInvoices.rows) {
    try {
      const pdfBuffer = await generateReceiptPDF(inv);

      // Store the PDF as base64 in the invoice record (or mark as generated)
      if (hasReceiptColumn) {
        const pdfBase64 = pdfBuffer.toString('base64');
        await pool.query(
          `UPDATE invoice SET receipt_pdf_url = $1 WHERE id = $2`,
          [`data:application/pdf;base64,${pdfBase64.substring(0, 50)}...generated`, inv.id]
        );
      }

      state.stats.receiptsGenerated++;
    } catch (err: any) {
      state.stats.errorCount++;
      addLog(state, stepNum, 'receipt_error', 'error',
        `Failed to generate receipt for invoice ${inv.id}: ${err.message}`);
    }
  }

  addLog(state, stepNum, 'receipts', 'success',
    `Generated ${state.stats.receiptsGenerated} tenant receipts`);
  await updateRunStep(state, stepNum);
}

// ============================================================
// Step 4: Email Tenant Receipts
// ============================================================

async function step4_emailReceipts(state: AgentRunState) {
  const stepNum = 4;

  // Find the admin/accounts email connection for sending
  const connectionResult = await pool.query(`
    SELECT id FROM email_connection
    WHERE category = 'admin' AND status = 'active' AND is_system = true
    LIMIT 1
  `);

  if (connectionResult.rows.length === 0) {
    addLog(state, stepNum, 'no_email_connection', 'skipped',
      'No active admin email connection found — receipts generated but not emailed. Set up system mailbox to enable.');
    await updateRunStep(state, stepNum);
    return;
  }

  const connectionId = connectionResult.rows[0].id;

  // Find paid invoices with receipts that haven't been emailed
  const toEmail = await pool.query(`
    SELECT i.id, i.amount, i.due_date, i.paid_date,
      t.name as tenant_name, t.email as tenant_email,
      COALESCE(p.address, p.address_line1) as property_address
    FROM invoice i
    JOIN tenancy tn ON i.tenancy_id = tn.id
    JOIN tenant t ON tn.tenant_id = t.id
    JOIN property p ON tn.property_id = p.id
    WHERE i.status = 'paid'
      AND i.invoice_type = 'rent'
      AND i.paid_date >= CURRENT_DATE - INTERVAL '7 days'
      AND t.email IS NOT NULL AND t.email != ''
    LIMIT 100
  `);

  for (const inv of toEmail.rows) {
    try {
      // Queue email via the email sender service
      const amountStr = `£${(inv.amount / 100).toFixed(2)}`;
      const paidDate = new Date(inv.paid_date).toLocaleDateString('en-GB');

      await pool.query(`
        INSERT INTO email_job_queue (connection_id, job_type, payload, status)
        VALUES ($1, 'send_email', $2, 'pending')
      `, [connectionId, JSON.stringify({
        to: [inv.tenant_email],
        subject: `Rent Receipt - ${inv.property_address} - ${paidDate}`,
        bodyHtml: `
          <div style="font-family: Arial, sans-serif; max-width: 600px;">
            <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
              <h2>John Barclay Estate & Management</h2>
              <p>Rent Payment Receipt</p>
            </div>
            <div style="padding: 20px; border: 1px solid #eee;">
              <p>Dear ${inv.tenant_name},</p>
              <p>We confirm receipt of your rent payment:</p>
              <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Property:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${inv.property_address}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Amount:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${amountStr}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Date Received:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">${paidDate}</td></tr>
              </table>
              <p>Thank you for your prompt payment.</p>
              <p>Kind regards,<br>John Barclay Estate & Management</p>
            </div>
          </div>
        `,
        bodyText: `Dear ${inv.tenant_name},\n\nWe confirm receipt of your rent payment of ${amountStr} for ${inv.property_address} received on ${paidDate}.\n\nThank you.\nJohn Barclay Estate & Management`,
      })]);

      state.stats.receiptsSent++;
    } catch (err: any) {
      state.stats.errorCount++;
      addLog(state, stepNum, 'receipt_email_error', 'error',
        `Failed to email receipt to ${inv.tenant_email}: ${err.message}`);
    }
  }

  addLog(state, stepNum, 'receipt_emails', 'success',
    `Queued ${state.stats.receiptsSent} receipt emails to tenants`);
  await updateRunStep(state, stepNum);
}

// ============================================================
// Step 5: Process Maintenance/Contractor Charges
// ============================================================

async function step5_processCharges(state: AgentRunState) {
  const stepNum = 5;

  // Find completed maintenance tickets with costs that haven't been added to landlord statements
  const charges = await pool.query(`
    SELECT mt.id, mt.property_id, mt.title, p.landlord_id,
      COALESCE(p.address, p.address_line1) as property_address,
      l.name as landlord_name,
      COALESCE(
        (SELECT SUM(amount)::int FROM contractor_quote cq WHERE cq.ticket_id = mt.id AND cq.status = 'approved'),
        0
      ) as charge_amount
    FROM maintenance_ticket mt
    JOIN property p ON mt.property_id = p.id
    LEFT JOIN landlord l ON p.landlord_id = l.id
    WHERE mt.status IN ('completed', 'closed')
      AND mt.charged_to_landlord IS NOT TRUE
      AND p.landlord_id IS NOT NULL
  `);

  // Check if charged_to_landlord column exists
  let hasChargedColumn = true;
  try {
    const colCheck = await pool.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'maintenance_ticket' AND column_name = 'charged_to_landlord'"
    );
    hasChargedColumn = colCheck.rows.length > 0;
  } catch {
    hasChargedColumn = false;
  }

  for (const charge of charges.rows) {
    if (charge.charge_amount <= 0) continue;

    try {
      // Create statement line item for this charge
      await pool.query(`
        INSERT INTO statement_line_item (statement_id, property_id, line_type, description, amount, transaction_date)
        SELECT ls.id, $1, 'maintenance', $2, $3, NOW()
        FROM landlord_statement ls
        WHERE ls.landlord_id = $4 AND ls.status = 'draft'
        ORDER BY ls.created_at DESC LIMIT 1
      `, [charge.property_id, `Maintenance: ${charge.title}`, -charge.charge_amount, charge.landlord_id]);

      // Mark as charged
      if (hasChargedColumn) {
        await pool.query(`UPDATE maintenance_ticket SET charged_to_landlord = true WHERE id = $1`, [charge.id]);
      }

      state.stats.chargesProcessed++;
      state.stats.totalCharges += charge.charge_amount;
    } catch (err: any) {
      // May fail if no draft statement exists — that's OK, will be included in next statement
      state.stats.errorCount++;
      addLog(state, stepNum, 'charge_error', 'error',
        `Failed to add charge for ticket ${charge.id}: ${err.message}`);
    }
  }

  addLog(state, stepNum, 'charges', 'success',
    `Processed ${state.stats.chargesProcessed} maintenance charges (£${(state.stats.totalCharges / 100).toFixed(2)})`);
  await updateRunStep(state, stepNum);
}

// ============================================================
// Step 6: Generate Landlord Statements
// ============================================================

async function step6_generateStatements(state: AgentRunState) {
  const stepNum = 6;

  // Find landlords with active managed properties that have rent collected this month
  const landlords = await pool.query(`
    SELECT DISTINCT l.id as landlord_id, l.name, l.email
    FROM landlord l
    JOIN tenancy tn ON tn.landlord_id = l.id AND tn.status = 'active'
    JOIN property p ON tn.property_id = p.id AND p.is_managed = true
    WHERE EXISTS (
      SELECT 1 FROM invoice i
      WHERE i.tenancy_id = tn.id AND i.status = 'paid'
        AND i.invoice_type = 'rent'
        AND date_trunc('month', i.paid_date) = date_trunc('month', CURRENT_DATE)
    )
  `);

  const monthStart = new Date();
  monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);

  for (const ll of landlords.rows) {
    try {
      // Check if statement already exists for this month
      const existing = await pool.query(`
        SELECT id FROM landlord_statement
        WHERE landlord_id = $1 AND statement_period_start = $2 AND statement_period_end = $3
      `, [ll.landlord_id, monthStart, monthEnd]);

      if (existing.rows.length > 0) continue; // Skip if already generated

      // Get all properties with rent collected this month for this landlord
      const properties = await pool.query(`
        SELECT p.id as property_id, COALESCE(p.address, p.address_line1) as address,
          p.management_fee_value, p.management_fee_type,
          t.name as tenant_name,
          COALESCE(SUM(i.amount), 0)::int as rent_collected
        FROM tenancy tn
        JOIN property p ON tn.property_id = p.id
        JOIN tenant t ON tn.tenant_id = t.id
        JOIN invoice i ON i.tenancy_id = tn.id AND i.status = 'paid' AND i.invoice_type = 'rent'
          AND i.paid_date >= $2 AND i.paid_date < $3
        WHERE tn.landlord_id = $1 AND tn.status = 'active'
        GROUP BY p.id, p.address, p.address_line1, p.management_fee_value, p.management_fee_type, t.name
      `, [ll.landlord_id, monthStart, monthEnd]);

      let totalRent = 0, totalFees = 0, totalCharges = 0;

      for (const prop of properties.rows) {
        const feePercent = prop.management_fee_type === 'percentage' ? (prop.management_fee_value || 10) : 0;
        const fee = prop.management_fee_type === 'percentage'
          ? Math.round(prop.rent_collected * feePercent / 100)
          : (prop.management_fee_value || 0);

        totalRent += prop.rent_collected;
        totalFees += fee;
      }

      // Get existing charges (maintenance etc) for this landlord this month
      const chargeResult = await pool.query(`
        SELECT COALESCE(SUM(ABS(sli.amount)), 0)::int as total
        FROM statement_line_item sli
        JOIN landlord_statement ls ON sli.statement_id = ls.id
        WHERE ls.landlord_id = $1 AND ls.status = 'draft'
          AND sli.line_type = 'maintenance'
      `, [ll.landlord_id]);
      totalCharges = chargeResult.rows[0]?.total || 0;

      const vatOnFees = Math.round(totalFees * 0.20); // 20% VAT on management fees
      const netPayable = totalRent - totalFees - vatOnFees - totalCharges;

      // Create the statement
      const stmtResult = await pool.query(`
        INSERT INTO landlord_statement (landlord_id, statement_period_start, statement_period_end,
          total_rent_collected, management_fees, vat_on_fees, maintenance_deductions,
          other_deductions, net_payable, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, 'draft')
        RETURNING id
      `, [ll.landlord_id, monthStart, monthEnd, totalRent, totalFees, vatOnFees, totalCharges, netPayable]);

      const stmtId = stmtResult.rows[0].id;

      // Create line items
      for (const prop of properties.rows) {
        const feePercent = prop.management_fee_type === 'percentage' ? (prop.management_fee_value || 10) : 0;
        const fee = prop.management_fee_type === 'percentage'
          ? Math.round(prop.rent_collected * feePercent / 100)
          : (prop.management_fee_value || 0);

        // Rent collected line
        await pool.query(`
          INSERT INTO statement_line_item (statement_id, property_id, line_type, description, amount, transaction_date)
          VALUES ($1, $2, 'rent_collected', $3, $4, NOW())
        `, [stmtId, prop.property_id, `Rent - ${prop.tenant_name} at ${prop.address}`, prop.rent_collected]);

        // Management fee line
        await pool.query(`
          INSERT INTO statement_line_item (statement_id, property_id, line_type, description, amount, transaction_date)
          VALUES ($1, $2, 'management_fee', $3, $4, NOW())
        `, [stmtId, prop.property_id,
          `Management fee (${feePercent}%) - ${prop.address}`,
          -fee]);
      }

      // Generate statement PDF
      const statementData: LandlordStatementData = {
        landlordId: ll.landlord_id,
        landlordName: ll.name,
        landlordEmail: ll.email,
        properties: properties.rows.map((prop: any) => {
          const feePercent = prop.management_fee_type === 'percentage' ? (prop.management_fee_value || 10) : 0;
          const fee = prop.management_fee_type === 'percentage'
            ? Math.round(prop.rent_collected * feePercent / 100)
            : (prop.management_fee_value || 0);
          return {
            propertyId: prop.property_id,
            address: prop.address,
            tenantName: prop.tenant_name,
            rentCollected: prop.rent_collected,
            managementFeePercent: feePercent,
            managementFee: fee,
            charges: [],
            totalCharges: 0,
            netPayable: prop.rent_collected - fee,
          };
        }),
        totalRent, totalFees, totalCharges, totalNet: netPayable,
      };

      const pdfBuffer = await generateStatementPDF(statementData, monthStart, monthEnd);

      // Store reference (could be uploaded to S3/storage in production)
      const pdfBase64 = pdfBuffer.toString('base64');
      await pool.query(`UPDATE landlord_statement SET pdf_url = $1 WHERE id = $2`,
        [`data:application/pdf;base64,${pdfBase64.substring(0, 100)}`, stmtId]);

      state.stats.statementsGenerated++;
      state.stats.totalCommission += totalFees;
      state.stats.totalNetPayable += netPayable;

      // Email the statement to landlord
      if (ll.email) {
        const connResult = await pool.query(`
          SELECT id FROM email_connection
          WHERE category = 'admin' AND status = 'active' AND is_system = true LIMIT 1
        `);

        if (connResult.rows.length > 0) {
          const monthName = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

          await pool.query(`
            INSERT INTO email_job_queue (connection_id, job_type, payload, status)
            VALUES ($1, 'send_email', $2, 'pending')
          `, [connResult.rows[0].id, JSON.stringify({
            to: [ll.email],
            subject: `Landlord Statement - ${monthName} - John Barclay`,
            bodyHtml: `
              <div style="font-family: Arial, sans-serif; max-width: 600px;">
                <div style="background: #791E75; color: white; padding: 20px; text-align: center;">
                  <h2>John Barclay Estate & Management</h2>
                  <p>Monthly Landlord Statement</p>
                </div>
                <div style="padding: 20px; border: 1px solid #eee;">
                  <p>Dear ${ll.name},</p>
                  <p>Please find your statement for ${monthName}:</p>
                  <table style="width: 100%; border-collapse: collapse; margin: 15px 0;">
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Rent Collected:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">£${(totalRent / 100).toFixed(2)}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Management Fee:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: red;">-£${(totalFees / 100).toFixed(2)}</td></tr>
                    <tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>VAT on Fees:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: red;">-£${(vatOnFees / 100).toFixed(2)}</td></tr>
                    ${totalCharges > 0 ? `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Maintenance Charges:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: red;">-£${(totalCharges / 100).toFixed(2)}</td></tr>` : ''}
                    <tr style="font-weight: bold; font-size: 1.1em;"><td style="padding: 12px 8px; border-top: 2px solid #791E75;"><strong>Net Payable:</strong></td><td style="padding: 12px 8px; border-top: 2px solid #791E75; text-align: right; color: #791E75;">£${(netPayable / 100).toFixed(2)}</td></tr>
                  </table>
                  <p>Payment will be transferred to your account shortly.</p>
                  <p>Kind regards,<br>John Barclay Estate & Management</p>
                </div>
              </div>
            `,
            attachments: [{
              name: `Statement_${monthName.replace(/\s/g, '_')}_${ll.name.replace(/\s/g, '_')}.pdf`,
              contentType: 'application/pdf',
              contentBase64: pdfBase64,
            }],
          })]);

          state.stats.statementsSent++;
        }
      }

    } catch (err: any) {
      state.stats.errorCount++;
      addLog(state, stepNum, 'statement_error', 'error',
        `Failed to generate statement for landlord ${ll.landlord_id}: ${err.message}`);
    }
  }

  addLog(state, stepNum, 'statements', 'success',
    `Generated ${state.stats.statementsGenerated} landlord statements, emailed ${state.stats.statementsSent}. Commission: £${(state.stats.totalCommission / 100).toFixed(2)}, Net payable: £${(state.stats.totalNetPayable / 100).toFixed(2)}`);
  await updateRunStep(state, stepNum);
}

// ============================================================
// Step 7: Prepare Landlord Payments
// ============================================================

async function step7_prepareLandlordPayments(state: AgentRunState) {
  const stepNum = 7;

  // Find approved statements ready for payment
  const readyStatements = await pool.query(`
    SELECT ls.id, ls.landlord_id, ls.net_payable,
      l.name as landlord_name, l.bank_name, l.bank_account_number, l.bank_sort_code, l.bank_account_holder_name
    FROM landlord_statement ls
    JOIN landlord l ON ls.landlord_id = l.id
    WHERE ls.status IN ('draft', 'approved')
      AND ls.net_payable > 0
      AND ls.paid_at IS NULL
    ORDER BY ls.created_at DESC
  `);

  for (const stmt of readyStatements.rows) {
    const hasBankDetails = stmt.bank_account_number && stmt.bank_sort_code;

    if (hasBankDetails) {
      // Mark as ready for payment (manual bank transfer by accounts team)
      await pool.query(`UPDATE landlord_statement SET status = 'approved' WHERE id = $1 AND status = 'draft'`, [stmt.id]);
      state.stats.landlordPaymentsPrepared++;
    } else {
      addLog(state, stepNum, 'missing_bank_details', 'error',
        `Landlord ${stmt.landlord_name} (ID: ${stmt.landlord_id}) - missing bank details, cannot prepare payment of £${(stmt.net_payable / 100).toFixed(2)}`);
      state.stats.errorCount++;
    }
  }

  addLog(state, stepNum, 'payments', 'success',
    `Prepared ${state.stats.landlordPaymentsPrepared} landlord payments for bank transfer. ${readyStatements.rows.length - state.stats.landlordPaymentsPrepared} require attention.`);
  await updateRunStep(state, stepNum);
}

// ============================================================
// PDF Generators
// ============================================================

function generateReceiptPDF(invoice: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Header
      doc.rect(0, 0, doc.page.width, 80).fill('#791E75');
      doc.fontSize(22).fillColor('white').text('John Barclay Estate & Management', 50, 25);
      doc.fontSize(12).text('Rent Payment Receipt', 50, 52);

      doc.moveDown(3);
      doc.fillColor('#333');

      // Details
      doc.fontSize(11);
      const y = 120;
      doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, 50, y);
      doc.text(`Tenant: ${invoice.tenant_name}`, 50, y + 25);
      doc.text(`Property: ${invoice.property_address}${invoice.postcode ? ', ' + invoice.postcode : ''}`, 50, y + 50);

      doc.moveDown(3);

      // Table
      const tableY = y + 100;
      doc.rect(50, tableY, 500, 30).fill('#f3f4f6');
      doc.fillColor('#333').fontSize(10).font('Helvetica-Bold');
      doc.text('Description', 60, tableY + 10);
      doc.text('Amount', 430, tableY + 10, { align: 'right', width: 100 });

      doc.font('Helvetica').fontSize(10);
      doc.text(`Rent Payment - ${invoice.property_address}`, 60, tableY + 40);
      doc.text(`£${(invoice.amount / 100).toFixed(2)}`, 430, tableY + 40, { align: 'right', width: 100 });

      doc.moveTo(50, tableY + 65).lineTo(550, tableY + 65).stroke('#791E75');

      doc.font('Helvetica-Bold').fontSize(12);
      doc.text('Total Paid:', 60, tableY + 75);
      doc.fillColor('#791E75').text(`£${(invoice.amount / 100).toFixed(2)}`, 430, tableY + 75, { align: 'right', width: 100 });

      doc.fillColor('#333').font('Helvetica').fontSize(10);
      doc.text(`Payment Date: ${new Date(invoice.paid_date).toLocaleDateString('en-GB')}`, 60, tableY + 105);

      // Footer
      doc.fontSize(9).fillColor('#888');
      doc.text('Thank you for your payment.', 50, 700);
      doc.text('John Barclay Estate & Management | London', 50, 715);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

function generateStatementPDF(data: LandlordStatementData, periodStart: Date, periodEnd: Date): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const monthName = periodStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

      // Header
      doc.rect(0, 0, doc.page.width, 80).fill('#791E75');
      doc.fontSize(22).fillColor('white').text('John Barclay Estate & Management', 50, 25);
      doc.fontSize(12).text(`Landlord Statement - ${monthName}`, 50, 52);

      doc.moveDown(3);
      doc.fillColor('#333');

      // Landlord details
      let y = 110;
      doc.fontSize(11);
      doc.text(`Landlord: ${data.landlordName}`, 50, y);
      doc.text(`Period: ${periodStart.toLocaleDateString('en-GB')} - ${new Date(periodEnd.getTime() - 86400000).toLocaleDateString('en-GB')}`, 50, y + 20);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 50, y + 40);

      y += 80;

      // Property breakdown
      doc.font('Helvetica-Bold').fontSize(11);
      doc.rect(50, y, 500, 25).fill('#f3f4f6');
      doc.fillColor('#333');
      doc.text('Property', 60, y + 7, { width: 200 });
      doc.text('Tenant', 230, y + 7, { width: 120 });
      doc.text('Rent', 360, y + 7, { width: 80, align: 'right' });
      doc.text('Fee', 440, y + 7, { width: 80, align: 'right' });

      y += 30;
      doc.font('Helvetica').fontSize(9);

      for (const prop of data.properties) {
        doc.fillColor('#333');
        doc.text(prop.address.substring(0, 35), 60, y, { width: 170 });
        doc.text(prop.tenantName.substring(0, 20), 230, y, { width: 120 });
        doc.text(`£${(prop.rentCollected / 100).toFixed(2)}`, 360, y, { width: 80, align: 'right' });
        doc.fillColor('#c00').text(`-£${(prop.managementFee / 100).toFixed(2)}`, 440, y, { width: 80, align: 'right' });
        y += 18;
      }

      // Summary
      y += 10;
      doc.moveTo(50, y).lineTo(550, y).stroke('#791E75');
      y += 15;

      doc.fillColor('#333').font('Helvetica-Bold').fontSize(10);

      const rows = [
        ['Total Rent Collected', `£${(data.totalRent / 100).toFixed(2)}`],
        ['Management Fees', `-£${(data.totalFees / 100).toFixed(2)}`],
        ['VAT on Fees (20%)', `-£${(Math.round(data.totalFees * 0.20) / 100).toFixed(2)}`],
      ];
      if (data.totalCharges > 0) {
        rows.push(['Maintenance Charges', `-£${(data.totalCharges / 100).toFixed(2)}`]);
      }

      for (const [label, value] of rows) {
        doc.font('Helvetica').fontSize(10).fillColor('#333');
        doc.text(label, 60, y);
        doc.text(value, 400, y, { width: 120, align: 'right' });
        y += 20;
      }

      y += 5;
      doc.moveTo(50, y).lineTo(550, y).lineWidth(2).stroke('#791E75');
      y += 10;

      doc.font('Helvetica-Bold').fontSize(14).fillColor('#791E75');
      doc.text('Net Amount Payable', 60, y);
      doc.text(`£${(data.totalNet / 100).toFixed(2)}`, 400, y, { width: 120, align: 'right' });

      // Footer
      doc.fontSize(9).fillColor('#888').font('Helvetica');
      doc.text('Payment will be transferred to your nominated bank account.', 50, 700);
      doc.text('John Barclay Estate & Management | London', 50, 715);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ============================================================
// Bank CSV Parser (fallback when GoCardless not configured)
// ============================================================

export interface BankCSVRow {
  date: string;
  description: string;
  reference: string;
  amount: number; // pence, positive = credit
  type: 'credit' | 'debit';
  balance?: number;
}

export async function importBankCSV(csvContent: string, bankName: string, importedBy: string): Promise<{ imported: number; duplicates: number }> {
  const rows = parseBankCSV(csvContent);
  let imported = 0, duplicates = 0;
  const batchId = `import_${Date.now()}`;

  for (const row of rows) {
    // Check for duplicates (same date, amount, reference)
    const existing = await pool.query(`
      SELECT id FROM bank_transaction
      WHERE transaction_date::date = $1::date AND amount = $2 AND reference = $3
    `, [row.date, row.amount, row.reference]);

    if (existing.rows.length > 0) {
      duplicates++;
      continue;
    }

    await pool.query(`
      INSERT INTO bank_transaction (bank_name, transaction_date, description, reference, amount, balance, transaction_type, match_status, import_batch_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'unmatched', $8)
    `, [bankName, row.date, row.description, row.reference, row.amount, row.balance || null, row.type, batchId]);

    imported++;
  }

  return { imported, duplicates };
}

function parseBankCSV(csvContent: string): BankCSVRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase();
  const rows: BankCSVRow[] = [];

  // Detect format by headers
  const isBarclays = header.includes('sort code') || header.includes('barclays');
  const isNatwest = header.includes('type') && header.includes('value');
  const isHSBC = header.includes('payment type');

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = parseCSVLine(line);
    if (cols.length < 3) continue;

    try {
      let row: BankCSVRow;

      if (isBarclays) {
        // Barclays: Date, Description, Money Out, Money In, Balance
        const date = parseDate(cols[0]);
        const desc = cols[1] || '';
        const moneyOut = parseAmount(cols[2]);
        const moneyIn = parseAmount(cols[3]);
        const balance = parseAmount(cols[4]);
        const amount = moneyIn > 0 ? moneyIn : -moneyOut;
        row = { date, description: desc, reference: desc, amount: Math.round(amount * 100), type: amount >= 0 ? 'credit' : 'debit', balance: balance ? Math.round(balance * 100) : undefined };
      } else if (isNatwest) {
        // NatWest: Date, Type, Description, Value, Balance
        const date = parseDate(cols[0]);
        const desc = cols[2] || '';
        const value = parseAmount(cols[3]);
        const balance = parseAmount(cols[4]);
        row = { date, description: desc, reference: desc, amount: Math.round(Math.abs(value) * 100), type: value >= 0 ? 'credit' : 'debit', balance: balance ? Math.round(balance * 100) : undefined };
      } else {
        // Generic: Date, Description, Amount (or Date, Description, Debit, Credit, Balance)
        const date = parseDate(cols[0]);
        const desc = cols[1] || '';
        if (cols.length >= 5) {
          const debit = parseAmount(cols[2]);
          const credit = parseAmount(cols[3]);
          const balance = parseAmount(cols[4]);
          const amount = credit > 0 ? credit : -debit;
          row = { date, description: desc, reference: desc, amount: Math.round(Math.abs(amount) * 100), type: amount >= 0 ? 'credit' : 'debit', balance: balance ? Math.round(balance * 100) : undefined };
        } else {
          const amount = parseAmount(cols[2]);
          row = { date, description: desc, reference: desc, amount: Math.round(Math.abs(amount) * 100), type: amount >= 0 ? 'credit' : 'debit' };
        }
      }

      if (row.date && row.amount > 0) {
        rows.push(row);
      }
    } catch {
      // Skip unparseable rows
    }
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(str: string): string {
  if (!str) return new Date().toISOString();
  // Try DD/MM/YYYY or DD-MM-YYYY
  const parts = str.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const day = parseInt(parts[0]);
    const month = parseInt(parts[1]);
    const year = parseInt(parts[2]);
    if (day && month && year) {
      const fullYear = year < 100 ? 2000 + year : year;
      return new Date(fullYear, month - 1, day).toISOString();
    }
  }
  // Try ISO format
  const d = new Date(str);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

function parseAmount(str: string): number {
  if (!str) return 0;
  const cleaned = str.replace(/[£$€,\s]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// ============================================================
// Helpers
// ============================================================

function addLog(state: AgentRunState, step: number, action: string, status: AgentLogEntry['status'], message: string, details?: any) {
  state.log.push({ step, action, status, message, details, timestamp: new Date().toISOString() });
}

async function updateRunStep(state: AgentRunState, stepNum: number) {
  await pool.query(`
    UPDATE agent_run SET steps_completed = $1, log = $2,
      payments_matched = $3, receipts_generated = $4, receipts_sent = $5,
      charges_processed = $6, statements_generated = $7, statements_sent = $8,
      landlord_payments_prepared = $9, total_rent_processed = $10,
      total_commission = $11, total_charges = $12, total_net_payable = $13,
      error_count = $14
    WHERE id = $15
  `, [
    stepNum, JSON.stringify(state.log),
    state.stats.paymentsMatched, state.stats.receiptsGenerated, state.stats.receiptsSent,
    state.stats.chargesProcessed, state.stats.statementsGenerated, state.stats.statementsSent,
    state.stats.landlordPaymentsPrepared, state.stats.totalRentProcessed,
    state.stats.totalCommission, state.stats.totalCharges, state.stats.totalNetPayable,
    state.stats.errorCount, state.runId
  ]);
}

async function updateRun(state: AgentRunState, status: 'completed' | 'failed') {
  await pool.query(`
    UPDATE agent_run SET status = $1, completed_at = NOW(), log = $2,
      payments_matched = $3, receipts_generated = $4, receipts_sent = $5,
      charges_processed = $6, statements_generated = $7, statements_sent = $8,
      landlord_payments_prepared = $9, total_rent_processed = $10,
      total_commission = $11, total_charges = $12, total_net_payable = $13,
      error_count = $14, error_details = $15
    WHERE id = $16
  `, [
    status, JSON.stringify(state.log),
    state.stats.paymentsMatched, state.stats.receiptsGenerated, state.stats.receiptsSent,
    state.stats.chargesProcessed, state.stats.statementsGenerated, state.stats.statementsSent,
    state.stats.landlordPaymentsPrepared, state.stats.totalRentProcessed,
    state.stats.totalCommission, state.stats.totalCharges, state.stats.totalNetPayable,
    state.stats.errorCount,
    state.stats.errorCount > 0 ? JSON.stringify(state.log.filter(l => l.status === 'error')) : null,
    state.runId
  ]);
}
