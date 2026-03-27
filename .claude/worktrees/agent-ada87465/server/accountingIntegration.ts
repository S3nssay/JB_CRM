import { pool } from './db';

/**
 * Accounting Integration Service
 *
 * Bridges the existing PM finance system (invoices, payments, property transactions,
 * landlord statements, bank reconciliation) with the new double-entry accounting system
 * (chart of accounts, journal entries, general ledger, VAT).
 *
 * Key account codes (from chart_of_accounts):
 *   1010 - Business Current Account
 *   1020 - Client Money Account
 *   1100 - Accounts Receivable
 *   1110 - Accounts Receivable - Landlords
 *   1120 - Accounts Receivable - Tenants
 *   2010 - Accounts Payable
 *   2100 - VAT Output
 *   2101 - VAT Input
 *   2400 - Client Money Liability
 *   4010 - Management Fee Income
 *   4020 - Letting Fee Income
 *   4060 - Maintenance Markup Income
 *   4080 - Other Income
 *   5010 - Contractor Costs
 *   6150 - Bank Charges
 */

// ==========================================
// HELPERS
// ==========================================

/** Get account ID by code, returns null if not found */
async function getAccountId(code: string): Promise<number | null> {
  const r = await pool.query('SELECT id FROM chart_of_accounts WHERE account_code = $1', [code]);
  return r.rows.length > 0 ? r.rows[0].id : null;
}

/** Get the next journal entry number (JE-YYYYMM-XXXX) */
async function getNextEntryNumber(): Promise<string> {
  const prefix = `JE-${new Date().toISOString().slice(0, 7).replace('-', '')}-`;
  const r = await pool.query(
    `SELECT entry_number FROM journal_entries WHERE entry_number LIKE $1 ORDER BY entry_number DESC LIMIT 1`,
    [prefix + '%']
  );
  let seq = 1;
  if (r.rows.length > 0) {
    const last = r.rows[0].entry_number;
    seq = parseInt(last.slice(-4)) + 1;
  }
  return prefix + String(seq).padStart(4, '0');
}

/** Check if accounting integration is enabled (business_settings exists and is configured) */
async function isAccountingEnabled(): Promise<boolean> {
  try {
    const r = await pool.query('SELECT id FROM business_settings LIMIT 1');
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

// ==========================================
// JOURNAL ENTRY CREATION HELPERS
// ==========================================

interface JournalLine {
  accountCode: string;
  description: string;
  debitAmount: number;   // pence
  creditAmount: number;  // pence
}

/**
 * Create a posted journal entry with multiple lines.
 * Returns the journal_entry_id or null if accounting is disabled / accounts not found.
 */
async function createJournalEntry(
  description: string,
  lines: JournalLine[],
  entryDate?: Date,
  reference?: string,
  sourceType?: string,
  sourceId?: number
): Promise<number | null> {
  if (!(await isAccountingEnabled())) return null;

  // Resolve account codes to IDs
  const resolvedLines: { accountId: number; description: string; debit: number; credit: number }[] = [];
  for (const line of lines) {
    const accountId = await getAccountId(line.accountCode);
    if (!accountId) {
      console.warn(`[Accounting Integration] Account code ${line.accountCode} not found, skipping journal entry`);
      return null;
    }
    resolvedLines.push({
      accountId,
      description: line.description,
      debit: line.debitAmount,
      credit: line.creditAmount,
    });
  }

  // Validate debits = credits
  const totalDebits = resolvedLines.reduce((s, l) => s + l.debit, 0);
  const totalCredits = resolvedLines.reduce((s, l) => s + l.credit, 0);
  if (totalDebits !== totalCredits) {
    console.error(`[Accounting Integration] Debits (${totalDebits}) != Credits (${totalCredits}) for "${description}"`);
    return null;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const entryNumber = await getNextEntryNumber();
    const date = entryDate || new Date();

    // Get current financial period
    const periodResult = await client.query(
      `SELECT id FROM financial_periods WHERE start_date <= $1 AND end_date >= $1 AND status = 'open' LIMIT 1`,
      [date.toISOString().slice(0, 10)]
    );
    const periodId = periodResult.rows.length > 0 ? periodResult.rows[0].id : null;

    const entryResult = await client.query(
      `INSERT INTO journal_entries (entry_number, entry_date, description, reference, source_type, source_id, status, total_debit, total_credit, period_id, posted_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'posted', $7, $8, $9, NOW()) RETURNING id`,
      [entryNumber, date.toISOString(), description, reference || null, sourceType || null, sourceId || null, totalDebits, totalCredits, periodId]
    );
    const journalEntryId = entryResult.rows[0].id;

    // Insert lines + general ledger entries
    for (let i = 0; i < resolvedLines.length; i++) {
      const line = resolvedLines[i];
      await client.query(
        `INSERT INTO journal_entry_lines (journal_entry_id, account_id, description, debit_amount, credit_amount, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [journalEntryId, line.accountId, line.description, line.debit, line.credit, i]
      );

      // General ledger entries
      if (line.debit > 0) {
        await client.query(
          `INSERT INTO general_ledger (journal_entry_id, account_id, entry_date, description, debit_amount, credit_amount, period_id)
           VALUES ($1, $2, $3, $4, $5, 0, $6)`,
          [journalEntryId, line.accountId, date.toISOString(), line.description, line.debit, periodId]
        );
      }
      if (line.credit > 0) {
        await client.query(
          `INSERT INTO general_ledger (journal_entry_id, account_id, entry_date, description, debit_amount, credit_amount, period_id)
           VALUES ($1, $2, $3, $4, 0, $5, $6)`,
          [journalEntryId, line.accountId, date.toISOString(), line.description, line.credit, periodId]
        );
      }
    }

    await client.query('COMMIT');
    return journalEntryId;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[Accounting Integration] Failed to create journal entry:', error);
    return null;
  } finally {
    client.release();
  }
}

// ==========================================
// PUBLIC INTEGRATION FUNCTIONS
// ==========================================

/**
 * Record a rent payment in the accounting system.
 * Called when a tenant rent payment is recorded/reconciled.
 *
 * Double entry:
 *   DR 1010 Business Current Account (or 1020 Client Money Account)
 *   CR 2400 Client Money Liability (rent held for landlord)
 *
 * Optionally link to the property_transaction via journal_entry_id.
 */
export async function accountingRecordRentPayment(
  amount: number,   // pence
  tenantName: string,
  propertyAddress: string,
  invoiceNumber: string,
  paymentDate?: Date,
  propertyTransactionId?: number
): Promise<number | null> {
  const description = `Rent received - ${tenantName} - ${propertyAddress}`;
  const journalEntryId = await createJournalEntry(
    description,
    [
      { accountCode: '1020', description: `Rent received into client account - ${invoiceNumber}`, debitAmount: amount, creditAmount: 0 },
      { accountCode: '2400', description: `Client money obligation - ${tenantName}`, debitAmount: 0, creditAmount: amount },
    ],
    paymentDate,
    invoiceNumber,
    'rent_payment',
    propertyTransactionId
  );

  // Link journal entry back to property transaction
  if (journalEntryId && propertyTransactionId) {
    await pool.query(
      'UPDATE property_transaction SET journal_entry_id = $1 WHERE id = $2',
      [journalEntryId, propertyTransactionId]
    );
  }

  return journalEntryId;
}

/**
 * Record management fee in the accounting system.
 * Called when a landlord statement is generated/approved.
 *
 * Double entry:
 *   DR 2400 Client Money Liability (deduct from client money owed)
 *   CR 4010 Management Fee Income
 *   CR 2100 VAT Output (if VAT registered)
 */
export async function accountingRecordManagementFee(
  feeAmount: number,    // pence (ex-VAT)
  vatAmount: number,     // pence
  landlordName: string,
  periodDesc: string,
  statementId?: number
): Promise<number | null> {
  const totalDeduction = feeAmount + vatAmount;
  const description = `Management fees - ${landlordName} - ${periodDesc}`;

  const lines: JournalLine[] = [
    { accountCode: '2400', description: `Deduct mgmt fee from client money - ${landlordName}`, debitAmount: totalDeduction, creditAmount: 0 },
    { accountCode: '4010', description: `Management fee income - ${landlordName}`, debitAmount: 0, creditAmount: feeAmount },
  ];

  if (vatAmount > 0) {
    lines.push({ accountCode: '2100', description: `VAT on management fees - ${landlordName}`, debitAmount: 0, creditAmount: vatAmount });
  }

  return createJournalEntry(description, lines, undefined, `STMT-${statementId || 'N/A'}`, 'landlord_statement', statementId);
}

/**
 * Record landlord payment (disbursement) in the accounting system.
 * Called when a landlord statement is marked as paid.
 *
 * Double entry:
 *   DR 2400 Client Money Liability (reduce obligation to landlord)
 *   CR 1020 Client Money Account (money leaves client account)
 */
export async function accountingRecordLandlordPayment(
  amount: number,      // pence
  landlordName: string,
  paymentRef: string,
  statementId?: number
): Promise<number | null> {
  const description = `Landlord payment - ${landlordName}`;
  return createJournalEntry(
    description,
    [
      { accountCode: '2400', description: `Clear client money obligation - ${landlordName}`, debitAmount: amount, creditAmount: 0 },
      { accountCode: '1020', description: `Payment to landlord - ${paymentRef}`, debitAmount: 0, creditAmount: amount },
    ],
    undefined,
    paymentRef,
    'landlord_payment',
    statementId
  );
}

/**
 * Record a maintenance expense in the accounting system.
 * Called when a property transaction of type 'expense' / category 'maintenance' is created.
 *
 * Double entry (rechargeable to landlord):
 *   DR 2400 Client Money Liability (charge back to landlord from client money)
 *   CR 1020 Client Money Account (paid from client account)
 *
 * Double entry (company expense):
 *   DR 5010 Contractor Costs
 *   CR 1010 Business Current Account
 */
export async function accountingRecordExpense(
  amount: number,      // pence
  category: string,
  description: string,
  isRechargeable: boolean,
  propertyTransactionId?: number,
  expenseDate?: Date
): Promise<number | null> {
  let lines: JournalLine[];

  if (isRechargeable) {
    // Rechargeable = paid from client money, charged to landlord
    lines = [
      { accountCode: '2400', description: `Rechargeable expense - ${description}`, debitAmount: amount, creditAmount: 0 },
      { accountCode: '1020', description: `Payment from client account - ${description}`, debitAmount: 0, creditAmount: amount },
    ];
  } else {
    // Company expense
    const expenseAccountCode = getExpenseAccountCode(category);
    lines = [
      { accountCode: expenseAccountCode, description, debitAmount: amount, creditAmount: 0 },
      { accountCode: '1010', description: `Payment from business account - ${description}`, debitAmount: 0, creditAmount: amount },
    ];
  }

  const journalEntryId = await createJournalEntry(
    description,
    lines,
    expenseDate,
    undefined,
    'expense',
    propertyTransactionId
  );

  if (journalEntryId && propertyTransactionId) {
    await pool.query(
      'UPDATE property_transaction SET journal_entry_id = $1 WHERE id = $2',
      [journalEntryId, propertyTransactionId]
    );
  }

  return journalEntryId;
}

/**
 * Record a business invoice being sent (accounts receivable).
 * Called when a business_invoice status changes to 'sent'.
 *
 * Double entry:
 *   DR 1100 Accounts Receivable
 *   CR 4010/4020/etc Revenue account (depends on invoice type)
 *   CR 2100 VAT Output (if applicable)
 */
export async function accountingRecordBusinessInvoiceSent(
  subtotal: number,     // pence
  vatAmount: number,     // pence
  customerName: string,
  invoiceNumber: string,
  revenueAccountCode?: string,
  businessInvoiceId?: number
): Promise<number | null> {
  const totalAmount = subtotal + vatAmount;
  const revenueCode = revenueAccountCode || '4080'; // Default to Other Income
  const description = `Invoice ${invoiceNumber} - ${customerName}`;

  const lines: JournalLine[] = [
    { accountCode: '1100', description: `Receivable - ${invoiceNumber}`, debitAmount: totalAmount, creditAmount: 0 },
    { accountCode: revenueCode, description: `Revenue - ${invoiceNumber}`, debitAmount: 0, creditAmount: subtotal },
  ];

  if (vatAmount > 0) {
    lines.push({ accountCode: '2100', description: `VAT - ${invoiceNumber}`, debitAmount: 0, creditAmount: vatAmount });
  }

  return createJournalEntry(
    description,
    lines,
    undefined,
    invoiceNumber,
    'business_invoice',
    businessInvoiceId
  );
}

/**
 * Record a business invoice payment received.
 *
 * Double entry:
 *   DR 1010 Business Current Account
 *   CR 1100 Accounts Receivable
 */
export async function accountingRecordBusinessInvoicePayment(
  amount: number,       // pence
  invoiceNumber: string,
  customerName: string,
  businessInvoiceId?: number
): Promise<number | null> {
  const description = `Payment received - ${invoiceNumber} - ${customerName}`;
  return createJournalEntry(
    description,
    [
      { accountCode: '1010', description: `Cash received - ${invoiceNumber}`, debitAmount: amount, creditAmount: 0 },
      { accountCode: '1100', description: `Clear receivable - ${invoiceNumber}`, debitAmount: 0, creditAmount: amount },
    ],
    undefined,
    invoiceNumber,
    'business_invoice_payment',
    businessInvoiceId
  );
}

/**
 * Record a purchase invoice (accounts payable).
 *
 * Double entry:
 *   DR 5010/6xxx Expense account
 *   DR 2101 VAT Input (if applicable)
 *   CR 2010 Accounts Payable
 */
export async function accountingRecordPurchaseInvoice(
  subtotal: number,
  vatAmount: number,
  supplierName: string,
  invoiceNumber: string,
  expenseAccountCode?: string,
  purchaseInvoiceId?: number
): Promise<number | null> {
  const totalAmount = subtotal + vatAmount;
  const expenseCode = expenseAccountCode || '6160'; // Default to Sundry Expenses
  const description = `Purchase invoice ${invoiceNumber} - ${supplierName}`;

  const lines: JournalLine[] = [
    { accountCode: expenseCode, description: `Expense - ${invoiceNumber}`, debitAmount: subtotal, creditAmount: 0 },
  ];

  if (vatAmount > 0) {
    lines.push({ accountCode: '2101', description: `VAT recoverable - ${invoiceNumber}`, debitAmount: vatAmount, creditAmount: 0 });
  }

  lines.push({ accountCode: '2010', description: `Payable - ${supplierName}`, debitAmount: 0, creditAmount: totalAmount });

  return createJournalEntry(
    description,
    lines,
    undefined,
    invoiceNumber,
    'purchase_invoice',
    purchaseInvoiceId
  );
}

// ==========================================
// EXPENSE CATEGORY MAPPING
// ==========================================

function getExpenseAccountCode(category: string): string {
  const mapping: Record<string, string> = {
    'maintenance': '5010',
    'contractor': '5010',
    'insurance': '6080',
    'utilities': '6050',
    'legal': '6100',
    'marketing': '6090',
    'office': '6070',
    'travel': '6110',
    'bank_charges': '6150',
    'depreciation': '6130',
    'bad_debt': '6140',
    'stationery': '6120',
    'telephone': '6060',
    'rent': '6040',
    'salaries': '6010',
    'portal_fees': '5020',
    'referencing': '5030',
  };
  return mapping[category] || '6160'; // Default to Sundry Expenses
}
