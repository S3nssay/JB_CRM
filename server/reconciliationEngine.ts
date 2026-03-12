import { db, pool } from './db';
import { payments, invoices, arrears, propertyTransactions } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { storage } from './storage';
import { accountingRecordRentPayment } from './accountingIntegration';

/**
 * Shared reconciliation engine used by:
 * - Bank CSV reconciliation (auto-match)
 * - GoCardless webhooks (payment confirmed)
 * - Manual "Mark as Paid" on invoices
 *
 * Creates a payment record, links it to the invoice, clears arrears, and logs a property transaction.
 */

export interface ReconcilePaymentData {
  tenantId: number;
  propertyId?: number;
  landlordId?: number;
  amount: number; // pence
  paymentMethod: string; // 'bank_transfer', 'direct_debit', 'card', 'cash', 'cheque'
  reference?: string;
  description?: string;
  paidAt?: Date;
}

export interface ReconcileResult {
  paymentId: number;
  invoiceUpdated: boolean;
  arrearsCleared: boolean;
  transactionCreated: boolean;
}

/**
 * Record a payment and reconcile it against an invoice.
 * If an invoiceId is provided, the invoice is marked as paid, any linked arrears are cleared,
 * and a propertyTransaction income record is created.
 */
export async function recordPaymentAndReconcile(
  paymentData: ReconcilePaymentData,
  invoiceId?: number
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    paymentId: 0,
    invoiceUpdated: false,
    arrearsCleared: false,
    transactionCreated: false,
  };

  // 1. Create the payment record
  const payment = await storage.createPayment({
    tenantId: paymentData.tenantId,
    propertyId: paymentData.propertyId || null,
    landlordId: paymentData.landlordId || null,
    amount: paymentData.amount,
    currency: 'GBP',
    paymentType: 'rent',
    paymentMethod: paymentData.paymentMethod,
    status: 'completed',
    reference: paymentData.reference || null,
    description: paymentData.description || null,
    paidAt: paymentData.paidAt || new Date(),
  });
  result.paymentId = payment.id;

  // 2. If linked to an invoice, mark it as paid
  if (invoiceId) {
    try {
      const invoice = await storage.getInvoice(invoiceId);
      if (invoice && invoice.status !== 'paid') {
        await storage.updateInvoice(invoiceId, {
          status: 'paid',
          paidDate: paymentData.paidAt || new Date(),
          paymentId: payment.id,
        });
        result.invoiceUpdated = true;

        // Use invoice data for property transaction if not provided
        const propId = paymentData.propertyId || invoice.propertyId;
        const llId = paymentData.landlordId || invoice.landlordId;

        // 3. Clear any linked arrears
        try {
          const activeArrears = await storage.getAllArrears({ tenantId: paymentData.tenantId, status: 'active' });
          for (const ar of activeArrears) {
            if (ar.invoiceId === invoiceId) {
              await storage.updateArrears(ar.id, { status: 'cleared' });
              result.arrearsCleared = true;
            }
          }
        } catch (e) {
          console.error('Error clearing arrears during reconciliation:', e);
        }

        // 4. Create property transaction (income record)
        if (propId) {
          try {
            const txn = await storage.createPropertyTransaction({
              propertyId: propId,
              landlordId: llId || null,
              transactionType: 'income',
              category: 'rent',
              description: `Rent payment - Invoice ${invoice.invoiceNumber}`,
              amount: paymentData.amount,
              transactionDate: paymentData.paidAt || new Date(),
              invoiceId: invoiceId,
              paymentId: payment.id,
            });
            result.transactionCreated = true;

            // 5. Accounting integration: record rent payment journal entry
            try {
              const propResult = await pool.query('SELECT address_line1, postcode FROM property WHERE id = $1', [propId]);
              const propAddr = propResult.rows.length > 0
                ? [propResult.rows[0].address_line1, propResult.rows[0].postcode].filter(Boolean).join(', ')
                : `Property #${propId}`;
              await accountingRecordRentPayment(
                paymentData.amount,
                `Tenant #${paymentData.tenantId}`,
                propAddr,
                invoice.invoiceNumber,
                paymentData.paidAt || new Date(),
                txn.id
              );
            } catch (acctErr) {
              console.error('[Accounting] Error recording journal entry during reconciliation:', acctErr);
            }
          } catch (e) {
            console.error('Error creating property transaction during reconciliation:', e);
          }
        }
      }
    } catch (e) {
      console.error('Error updating invoice during reconciliation:', e);
    }
  }

  return result;
}
