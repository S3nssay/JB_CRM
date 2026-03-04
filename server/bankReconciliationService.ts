import { storage } from './storage';
import { recordPaymentAndReconcile } from './reconciliationEngine';
import { InsertBankTransaction } from '@shared/schema';
import { v4 as uuidv4 } from 'uuid';
import { db } from './db';
import { invoices, tenant } from '@shared/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

/**
 * Bank statement CSV parsing and auto-reconciliation service.
 * Supports 4 UK bank formats: Barclays, NatWest, HSBC, Lloyds.
 */

interface ParsedTransaction {
  date: Date;
  description: string;
  reference: string;
  amount: number; // pence (positive = credit, negative = debit)
  balance?: number; // pence
  type: 'credit' | 'debit';
}

interface BankFormat {
  name: string;
  detect: (headers: string[]) => boolean;
  parse: (row: string[], headers: string[]) => ParsedTransaction | null;
}

// Amount string to pence (handles £ sign, commas, negatives)
function parseCurrencyToPence(str: string): number {
  if (!str || str.trim() === '') return 0;
  const cleaned = str.replace(/[£,\s]/g, '').trim();
  return Math.round(parseFloat(cleaned) * 100);
}

function parseDate(str: string): Date | null {
  if (!str) return null;
  // Try DD/MM/YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (ddmmyyyy) {
    return new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
  }
  // Try YYYY-MM-DD
  const isoDate = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDate) {
    return new Date(parseInt(isoDate[1]), parseInt(isoDate[2]) - 1, parseInt(isoDate[3]));
  }
  // Fallback
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

const BANK_FORMATS: BankFormat[] = [
  {
    // Barclays: Date, Description, Amount, Balance
    name: 'Barclays',
    detect: (headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      return h.includes('date') && h.includes('amount') && (h.includes('memo') || h.includes('description'));
    },
    parse: (row, headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      const dateIdx = h.indexOf('date');
      const descIdx = h.findIndex(x => x === 'memo' || x === 'description');
      const amountIdx = h.indexOf('amount');
      const balanceIdx = h.indexOf('balance');
      if (dateIdx < 0 || amountIdx < 0) return null;
      const date = parseDate(row[dateIdx]);
      if (!date) return null;
      const amount = parseCurrencyToPence(row[amountIdx]);
      return {
        date,
        description: row[descIdx] || '',
        reference: row[descIdx] || '',
        amount: Math.abs(amount),
        balance: balanceIdx >= 0 ? parseCurrencyToPence(row[balanceIdx]) : undefined,
        type: amount >= 0 ? 'credit' : 'debit',
      };
    },
  },
  {
    // NatWest: Date, Type, Description, Value, Balance, Account Name, Account Number
    name: 'NatWest',
    detect: (headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      return h.includes('date') && h.includes('value') && h.includes('type') && h.includes('description');
    },
    parse: (row, headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      const dateIdx = h.indexOf('date');
      const descIdx = h.indexOf('description');
      const valueIdx = h.indexOf('value');
      const balanceIdx = h.indexOf('balance');
      if (dateIdx < 0 || valueIdx < 0) return null;
      const date = parseDate(row[dateIdx]);
      if (!date) return null;
      const amount = parseCurrencyToPence(row[valueIdx]);
      return {
        date,
        description: row[descIdx] || '',
        reference: row[descIdx] || '',
        amount: Math.abs(amount),
        balance: balanceIdx >= 0 ? parseCurrencyToPence(row[balanceIdx]) : undefined,
        type: amount >= 0 ? 'credit' : 'debit',
      };
    },
  },
  {
    // HSBC: Date, Description, Amount
    name: 'HSBC',
    detect: (headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      return h.includes('date') && (h.includes('credit amount') || h.includes('debit amount'));
    },
    parse: (row, headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      const dateIdx = h.indexOf('date');
      const descIdx = h.findIndex(x => x === 'description' || x === 'payment details');
      const creditIdx = h.indexOf('credit amount');
      const debitIdx = h.indexOf('debit amount');
      const balanceIdx = h.indexOf('balance');
      if (dateIdx < 0) return null;
      const date = parseDate(row[dateIdx]);
      if (!date) return null;
      const credit = creditIdx >= 0 ? parseCurrencyToPence(row[creditIdx]) : 0;
      const debit = debitIdx >= 0 ? parseCurrencyToPence(row[debitIdx]) : 0;
      const amount = credit > 0 ? credit : debit;
      if (amount === 0) return null;
      return {
        date,
        description: descIdx >= 0 ? row[descIdx] : '',
        reference: descIdx >= 0 ? row[descIdx] : '',
        amount,
        balance: balanceIdx >= 0 ? parseCurrencyToPence(row[balanceIdx]) : undefined,
        type: credit > 0 ? 'credit' : 'debit',
      };
    },
  },
  {
    // Lloyds: Transaction Date, Transaction Type, Sort Code, Account Number, Transaction Description, Debit Amount, Credit Amount, Balance
    name: 'Lloyds',
    detect: (headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      return h.includes('transaction date') && h.includes('transaction description');
    },
    parse: (row, headers) => {
      const h = headers.map(s => s.toLowerCase().trim());
      const dateIdx = h.indexOf('transaction date');
      const descIdx = h.indexOf('transaction description');
      const debitIdx = h.indexOf('debit amount');
      const creditIdx = h.indexOf('credit amount');
      const balanceIdx = h.indexOf('balance');
      if (dateIdx < 0) return null;
      const date = parseDate(row[dateIdx]);
      if (!date) return null;
      const credit = creditIdx >= 0 ? parseCurrencyToPence(row[creditIdx]) : 0;
      const debit = debitIdx >= 0 ? parseCurrencyToPence(row[debitIdx]) : 0;
      const amount = credit > 0 ? credit : debit;
      if (amount === 0) return null;
      return {
        date,
        description: descIdx >= 0 ? row[descIdx] : '',
        reference: descIdx >= 0 ? row[descIdx] : '',
        amount,
        balance: balanceIdx >= 0 ? parseCurrencyToPence(row[balanceIdx]) : undefined,
        type: credit > 0 ? 'credit' : 'debit',
      };
    },
  },
];

/** Simple CSV parser that handles quoted fields */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/** Detect bank format from CSV headers */
export function detectBankFormat(headers: string[]): BankFormat | null {
  for (const format of BANK_FORMATS) {
    if (format.detect(headers)) return format;
  }
  return null;
}

/** Parse CSV content into normalized transactions */
export function parseCSV(csvContent: string, bankFormat?: string): { format: string; transactions: ParsedTransaction[] } {
  const lines = csvContent.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) {
    throw new Error('CSV must have at least a header row and one data row');
  }

  const headers = parseCSVLine(lines[0]);
  let format: BankFormat | null = null;

  if (bankFormat) {
    format = BANK_FORMATS.find(f => f.name.toLowerCase() === bankFormat.toLowerCase()) || null;
  }
  if (!format) {
    format = detectBankFormat(headers);
  }
  if (!format) {
    throw new Error(`Could not detect bank format. Headers: ${headers.join(', ')}. Supported: Barclays, NatWest, HSBC, Lloyds`);
  }

  const transactions: ParsedTransaction[] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length < 2) continue;
    const txn = format.parse(row, headers);
    if (txn) transactions.push(txn);
  }

  return { format: format.name, transactions };
}

/** Import bank statement: parse CSV + bulk insert as unmatched */
export async function importBankStatement(
  csvContent: string,
  bankName: string,
  accountNumber?: string,
  bankFormat?: string
): Promise<{ format: string; imported: number; batchId: string }> {
  const { format, transactions } = parseCSV(csvContent, bankFormat);
  const batchId = uuidv4();

  const records: InsertBankTransaction[] = transactions.map(txn => ({
    bankName: bankName || format,
    accountNumber: accountNumber || null,
    transactionDate: txn.date,
    description: txn.description,
    reference: txn.reference,
    amount: txn.type === 'credit' ? txn.amount : -txn.amount,
    balance: txn.balance != null ? txn.balance : null,
    transactionType: txn.type,
    matchStatus: 'unmatched',
    importBatchId: batchId,
    rawData: txn,
  }));

  await storage.createBankTransactionBatch(records);

  return { format, imported: records.length, batchId };
}

/**
 * Auto-reconcile unmatched bank credits against outstanding invoices.
 * Matching strategies (in priority order):
 * 1. Invoice number found in transaction reference/description
 * 2. Amount matches + tenant name found in description
 * 3. Amount matches + date within ±3 days of invoice due date
 */
export async function autoReconcile(batchId?: string): Promise<{ matched: number; unmatched: number }> {
  let unmatched = await storage.getUnmatchedBankTransactions();
  if (batchId) {
    unmatched = unmatched.filter(t => t.importBatchId === batchId);
  }

  // Only reconcile credits (incoming payments)
  const credits = unmatched.filter(t => t.transactionType === 'credit');

  // Fetch all unpaid invoices
  const unpaidInvoices = await storage.getAllInvoices({ status: 'sent' });
  const overdueInvoices = await storage.getAllInvoices({ status: 'overdue' });
  const allUnpaid = [...unpaidInvoices, ...overdueInvoices];

  // Fetch all tenants for name matching
  const allTenants = await db.select().from(tenant);
  const tenantMap = new Map(allTenants.map(t => [t.id, t]));

  let matched = 0;

  for (const txn of credits) {
    const txnDesc = (txn.description || '').toLowerCase();
    const txnRef = (txn.reference || '').toLowerCase();
    const txnAmount = txn.amount; // positive pence

    // Strategy 1: Invoice number in reference/description
    let matchedInvoice = allUnpaid.find(inv => {
      const invNum = inv.invoiceNumber.toLowerCase();
      return txnDesc.includes(invNum) || txnRef.includes(invNum);
    });

    // Strategy 2: Amount + tenant name in description
    if (!matchedInvoice) {
      matchedInvoice = allUnpaid.find(inv => {
        if (inv.totalAmount !== txnAmount) return false;
        const t = inv.tenantId ? tenantMap.get(inv.tenantId) : null;
        if (!t || !t.name) return false;
        const nameParts = t.name.toLowerCase().split(/\s+/);
        return nameParts.some(part => part.length > 2 && (txnDesc.includes(part) || txnRef.includes(part)));
      });
    }

    // Strategy 3: Amount + date within ±3 days
    if (!matchedInvoice) {
      const txnDate = new Date(txn.transactionDate).getTime();
      matchedInvoice = allUnpaid.find(inv => {
        if (inv.totalAmount !== txnAmount) return false;
        if (!inv.dueDate) return false;
        const dueDate = new Date(inv.dueDate).getTime();
        const daysDiff = Math.abs(txnDate - dueDate) / (1000 * 60 * 60 * 24);
        return daysDiff <= 3;
      });
    }

    if (matchedInvoice) {
      // Run reconciliation
      const tenantData = matchedInvoice.tenantId ? tenantMap.get(matchedInvoice.tenantId) : null;
      if (matchedInvoice.tenantId) {
        try {
          const reconcileResult = await recordPaymentAndReconcile(
            {
              tenantId: matchedInvoice.tenantId,
              propertyId: matchedInvoice.propertyId || undefined,
              landlordId: matchedInvoice.landlordId || undefined,
              amount: txnAmount,
              paymentMethod: 'bank_transfer',
              reference: txn.reference || txn.description || undefined,
              description: `Auto-matched from bank statement: ${txn.description}`,
              paidAt: new Date(txn.transactionDate),
            },
            matchedInvoice.id
          );

          // Update bank transaction with match
          await storage.updateBankTransaction(txn.id, {
            matchStatus: 'auto_matched',
            matchedPaymentId: reconcileResult.paymentId,
            matchedInvoiceId: matchedInvoice.id,
            matchedAt: new Date(),
            matchedBy: 'system',
          });

          // Remove from allUnpaid so it doesn't match again
          const idx = allUnpaid.indexOf(matchedInvoice);
          if (idx >= 0) allUnpaid.splice(idx, 1);

          matched++;
        } catch (e) {
          console.error(`Auto-reconcile error for bank txn ${txn.id}:`, e);
        }
      }
    }
  }

  return { matched, unmatched: credits.length - matched };
}

/**
 * Manually match a bank transaction to an invoice.
 */
export async function manualMatch(
  bankTransactionId: number,
  invoiceId: number
): Promise<{ success: boolean; paymentId?: number; error?: string }> {
  const txns = await storage.getAllBankTransactions();
  const txn = txns.find(t => t.id === bankTransactionId);
  if (!txn) return { success: false, error: 'Bank transaction not found' };
  if (txn.matchStatus !== 'unmatched') return { success: false, error: 'Transaction already matched' };

  const invoice = await storage.getInvoice(invoiceId);
  if (!invoice) return { success: false, error: 'Invoice not found' };
  if (!invoice.tenantId) return { success: false, error: 'Invoice has no tenant' };

  const reconcileResult = await recordPaymentAndReconcile(
    {
      tenantId: invoice.tenantId,
      propertyId: invoice.propertyId || undefined,
      landlordId: invoice.landlordId || undefined,
      amount: txn.amount,
      paymentMethod: 'bank_transfer',
      reference: txn.reference || txn.description || undefined,
      description: `Manually matched from bank statement: ${txn.description}`,
      paidAt: new Date(txn.transactionDate),
    },
    invoiceId
  );

  await storage.updateBankTransaction(bankTransactionId, {
    matchStatus: 'manually_matched',
    matchedPaymentId: reconcileResult.paymentId,
    matchedInvoiceId: invoiceId,
    matchedAt: new Date(),
    matchedBy: 'manual',
  });

  return { success: true, paymentId: reconcileResult.paymentId };
}
