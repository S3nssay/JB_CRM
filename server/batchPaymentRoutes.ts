import { Router } from 'express';
import { pool } from './db';

export const batchPaymentRoutes = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  if (req.user.role !== 'admin' && req.user.role !== 'agent')
    return res.status(403).json({ error: 'Not authorized' });
  next();
};

// ============================================================
// BACS Payment Generation
// ============================================================

// GET /bacs/pending-payments
// List landlords with outstanding (credit) balances in client_account_transactions
batchPaymentRoutes.get('/bacs/pending-payments', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        l.id AS "landlordId",
        l.name AS "landlordName",
        l.bank_name AS "bankName",
        l.bank_account_number AS "accountNumber",
        l.bank_sort_code AS "sortCode",
        SUM(
          CASE WHEN cat.transaction_type = 'credit' THEN cat.amount
               WHEN cat.transaction_type = 'debit'  THEN -cat.amount
               ELSE 0
          END
        ) AS amount,
        CONCAT('BACS-', l.id, '-', TO_CHAR(NOW(), 'YYYYMMDD')) AS reference
      FROM landlord l
      JOIN client_account_transactions cat ON cat.landlord_id = l.id
      WHERE l.bank_account_number IS NOT NULL
        AND l.bank_sort_code IS NOT NULL
      GROUP BY l.id, l.name, l.bank_name, l.bank_account_number, l.bank_sort_code
      HAVING SUM(
        CASE WHEN cat.transaction_type = 'credit' THEN cat.amount
             WHEN cat.transaction_type = 'debit'  THEN -cat.amount
             ELSE 0
        END
      ) > 0
      ORDER BY l.name
    `);

    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching pending BACS payments:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /bacs/generate
// Generate a BACS Standard 18 text file for the given landlord IDs
batchPaymentRoutes.post('/bacs/generate', requireAgent, async (req, res) => {
  try {
    const { paymentIds } = req.body as { paymentIds: number[] };
    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({ error: 'paymentIds must be a non-empty array' });
    }

    const placeholders = paymentIds.map((_, i) => `$${i + 1}`).join(',');
    const result = await pool.query(`
      SELECT
        l.id AS "landlordId",
        l.name AS "landlordName",
        l.bank_account_number AS "accountNumber",
        l.bank_sort_code AS "sortCode",
        SUM(
          CASE WHEN cat.transaction_type = 'credit' THEN cat.amount
               WHEN cat.transaction_type = 'debit'  THEN -cat.amount
               ELSE 0
          END
        ) AS amount
      FROM landlord l
      JOIN client_account_transactions cat ON cat.landlord_id = l.id
      WHERE l.id IN (${placeholders})
        AND l.bank_account_number IS NOT NULL
        AND l.bank_sort_code IS NOT NULL
      GROUP BY l.id, l.name, l.bank_account_number, l.bank_sort_code
      HAVING SUM(
        CASE WHEN cat.transaction_type = 'credit' THEN cat.amount
             WHEN cat.transaction_type = 'debit'  THEN -cat.amount
             ELSE 0
        END
      ) > 0
      ORDER BY l.name
    `, paymentIds);

    // Build BACS Standard 18 file
    // Format per line: sortCode(6) + accountNumber(8) + amountPence + name(18 max) + reference
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const lines: string[] = [];

    for (const row of result.rows) {
      const sortCode = (row.sortCode as string).replace(/[-\s]/g, '').padEnd(6, '0').slice(0, 6);
      const accountNo = (row.accountNumber as string).replace(/[-\s]/g, '').padStart(8, '0').slice(0, 8);
      const amountPence = Math.round(Number(row.amount));
      const name = (row.landlordName as string).slice(0, 18).padEnd(18, ' ');
      const reference = `JBLETTING${row.landlordId}`.slice(0, 18).padEnd(18, ' ');
      lines.push(`${sortCode}${accountNo}${amountPence}${name}${reference}`);
    }

    const fileContent = lines.join('\r\n') + '\r\n';
    const filename = `BACS_${dateStr}.txt`;

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(fileContent);
  } catch (err: any) {
    console.error('Error generating BACS file:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /bacs/mark-paid
// Create debit transactions for each landlord to record the BACS payment sent
batchPaymentRoutes.post('/bacs/mark-paid', requireAgent, async (req, res) => {
  try {
    const { landlordIds, paymentDate, reference } = req.body as {
      landlordIds: number[];
      paymentDate: string;
      reference: string;
    };

    if (!Array.isArray(landlordIds) || landlordIds.length === 0) {
      return res.status(400).json({ error: 'landlordIds must be a non-empty array' });
    }

    const userId = (req as any).user.id;
    const txDate = paymentDate ? new Date(paymentDate) : new Date();
    const created: number[] = [];

    for (const landlordId of landlordIds) {
      // Get current balance for this landlord
      const balResult = await pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN transaction_type = 'credit' THEN amount
               WHEN transaction_type = 'debit'  THEN -amount
               ELSE 0
          END
        ), 0) AS balance
        FROM client_account_transactions
        WHERE landlord_id = $1
      `, [landlordId]);

      const balance = Math.round(Number(balResult.rows[0].balance));
      if (balance <= 0) continue;

      const insertResult = await pool.query(`
        INSERT INTO client_account_transactions
          (transaction_type, amount, description, reference, transaction_date,
           landlord_id, balance_after, category, created_by)
        VALUES
          ('debit', $1, $2, $3, $4, $5, 0, 'bacs_payment', $6)
        RETURNING id
      `, [
        balance,
        `BACS payment to landlord - ${reference || ''}`,
        reference || `BACS-${dateStr()}`,
        txDate,
        landlordId,
        userId
      ]);

      created.push(insertResult.rows[0].id);
    }

    res.json({ success: true, transactionsCreated: created.length, transactionIds: created });
  } catch (err: any) {
    console.error('Error marking BACS as paid:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Contractor Batch Payments
// ============================================================

// GET /batch/contractor-invoices
// List approved/unpaid purchase invoices for batch payment
batchPaymentRoutes.get('/batch/contractor-invoices', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        pi.id AS "invoiceId",
        pi.supplier_name AS "contractorName",
        pi.invoice_number AS "invoiceNumber",
        COALESCE(
          (SELECT STRING_AGG(pil.description, '; ')
           FROM purchase_invoice_lines pil
           WHERE pil.purchase_invoice_id = pi.id),
          pi.notes,
          ''
        ) AS description,
        pi.total_amount AS amount,
        pi.invoice_date AS date,
        pi.due_date AS "dueDate",
        pi.status
      FROM purchase_invoices pi
      WHERE pi.status = 'approved'
        AND (pi.amount_paid IS NULL OR pi.amount_paid < pi.total_amount)
      ORDER BY pi.due_date ASC, pi.invoice_date ASC
    `);

    res.json(result.rows);
  } catch (err: any) {
    console.error('Error fetching contractor invoices:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /batch/contractor-pay
// Mark selected purchase invoices as paid
batchPaymentRoutes.post('/batch/contractor-pay', requireAgent, async (req, res) => {
  try {
    const { invoiceIds, paymentDate, paymentMethod } = req.body as {
      invoiceIds: number[];
      paymentDate: string;
      paymentMethod: string;
    };

    if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
      return res.status(400).json({ error: 'invoiceIds must be a non-empty array' });
    }

    const paidAt = paymentDate ? new Date(paymentDate) : new Date();
    const userId = (req as any).user.id;
    const updated: number[] = [];

    for (const invoiceId of invoiceIds) {
      const invoiceResult = await pool.query(`
        SELECT id, total_amount, supplier_name FROM purchase_invoices WHERE id = $1
      `, [invoiceId]);

      if (invoiceResult.rows.length === 0) continue;
      const invoice = invoiceResult.rows[0];

      await pool.query(`
        UPDATE purchase_invoices
        SET status = 'paid',
            amount_paid = total_amount,
            paid_at = $1,
            updated_at = NOW()
        WHERE id = $2
      `, [paidAt, invoiceId]);

      updated.push(invoiceId);
    }

    res.json({
      success: true,
      invoicesPaid: updated.length,
      invoiceIds: updated,
      paymentDate: paidAt,
      paymentMethod
    });
  } catch (err: any) {
    console.error('Error processing contractor batch payment:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// Landlord Batch Receipts
// ============================================================

// POST /batch/landlord-receipts
// Record multiple landlord receipts as credit transactions
batchPaymentRoutes.post('/batch/landlord-receipts', requireAgent, async (req, res) => {
  try {
    const { receipts } = req.body as {
      receipts: Array<{
        landlordId: number;
        amount: number;
        reference: string;
        date: string;
      }>;
    };

    if (!Array.isArray(receipts) || receipts.length === 0) {
      return res.status(400).json({ error: 'receipts must be a non-empty array' });
    }

    const userId = (req as any).user.id;
    let processed = 0;

    for (const receipt of receipts) {
      const { landlordId, amount, reference, date } = receipt;
      if (!landlordId || !amount || amount <= 0) continue;

      const txDate = date ? new Date(date) : new Date();
      const amountPence = Math.round(Number(amount));

      // Get running balance
      const balResult = await pool.query(`
        SELECT COALESCE(SUM(
          CASE WHEN transaction_type = 'credit' THEN amount
               WHEN transaction_type = 'debit'  THEN -amount
               ELSE 0
          END
        ), 0) AS balance
        FROM client_account_transactions
        WHERE landlord_id = $1
      `, [landlordId]);

      const currentBalance = Math.round(Number(balResult.rows[0].balance));
      const balanceAfter = currentBalance + amountPence;

      await pool.query(`
        INSERT INTO client_account_transactions
          (transaction_type, amount, description, reference, transaction_date,
           landlord_id, balance_after, category, created_by)
        VALUES
          ('credit', $1, $2, $3, $4, $5, $6, 'rent', $7)
      `, [
        amountPence,
        `Batch receipt - ${reference || 'No reference'}`,
        reference || '',
        txDate,
        landlordId,
        balanceAfter,
        userId
      ]);

      processed++;
    }

    res.json({ success: true, processed });
  } catch (err: any) {
    console.error('Error recording batch receipts:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper
function dateStr(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}
