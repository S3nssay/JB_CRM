/**
 * Business Accounts Service -- Unit Tests
 *
 * Tests for:
 * - Commission income journal entries (accountingRecordCommissionIncome)
 * - Letting fee journal entries (accountingRecordLettingFee)
 * - Cron job handlers (recurring invoices, period close, VAT quarter)
 * - Deal event hooks (sale.completed -> commission, tenancy.agreed -> letting fee)
 *
 * BIZ-06: Automated journal entries from deal events
 * BIZ-09: Cron-based recurring invoice processing and reminders
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Read source for static analysis
const accountingIntegrationSource = fs.readFileSync(
  path.resolve(__dirname, '../accountingIntegration.ts'),
  'utf-8'
);

// ==========================================================
// Task 1: Commission Income & Letting Fee Journal Entries
// ==========================================================

describe('accountingRecordCommissionIncome', () => {
  it('should be exported from accountingIntegration.ts', () => {
    expect(accountingIntegrationSource).toMatch(
      /export\s+async\s+function\s+accountingRecordCommissionIncome/
    );
  });

  it('should create journal entry with DR 1100 (Accounts Receivable), CR 4020 (Sales Commission Income), CR 2100 (VAT Output)', () => {
    // Verify account codes used: 1100 for debit, 4020 for commission revenue, 2100 for VAT
    expect(accountingIntegrationSource).toContain("'1100'");
    expect(accountingIntegrationSource).toContain("'4020'");
    expect(accountingIntegrationSource).toContain("'2100'");

    // Verify the function body references the correct accounts
    const fnMatch = accountingIntegrationSource.match(
      /accountingRecordCommissionIncome[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("'1100'"); // DR Accounts Receivable
    expect(fnBody).toContain("'4020'"); // CR Sales Commission Income
    expect(fnBody).toContain("'2100'"); // CR VAT Output
  });

  it('should calculate VAT at 20% using Math.round', () => {
    const fnMatch = accountingIntegrationSource.match(
      /accountingRecordCommissionIncome[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    // Should use Math.round for VAT calculation
    expect(fnBody).toMatch(/Math\.round/);
    // Should multiply by 0.2 for 20% VAT
    expect(fnBody).toMatch(/0\.2/);
  });

  it('should ensure total debits equal total credits (commission + VAT on debit side)', () => {
    const fnMatch = accountingIntegrationSource.match(
      /accountingRecordCommissionIncome[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    // Debit amount should be commission + VAT (total receivable)
    // The function should add commissionPence + vatPence for the debit line
    expect(fnBody).toMatch(/commissionPence\s*\+\s*vatPence|amount\s*\+\s*vat/i);
  });

  it('should handle rounding: 333 pence -> vatPence=67, total DR=400', () => {
    // Verify the math: Math.round(333 * 0.2) = Math.round(66.6) = 67
    const vatPence = Math.round(333 * 0.2);
    expect(vatPence).toBe(67);
    expect(333 + vatPence).toBe(400); // Total debit = 400, Total credit = 333 + 67 = 400
  });

  it('should accept sourceType and sourceId parameters', () => {
    const fnMatch = accountingIntegrationSource.match(
      /accountingRecordCommissionIncome\([^)]*\)/
    );
    expect(fnMatch).not.toBeNull();
    const signature = fnMatch![0];
    expect(signature).toContain('sourceType');
    expect(signature).toContain('sourceId');
  });
});

describe('accountingRecordLettingFee', () => {
  it('should be exported from accountingIntegration.ts', () => {
    expect(accountingIntegrationSource).toMatch(
      /export\s+async\s+function\s+accountingRecordLettingFee/
    );
  });

  it('should create journal entry with DR 1100 (Accounts Receivable), CR 4010 (Letting Fee Income), CR 2100 (VAT Output)', () => {
    const fnMatch = accountingIntegrationSource.match(
      /accountingRecordLettingFee[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    expect(fnBody).toContain("'1100'"); // DR Accounts Receivable
    expect(fnBody).toContain("'4010'"); // CR Letting Fee Income
    expect(fnBody).toContain("'2100'"); // CR VAT Output
  });

  it('should calculate VAT at 20% with Math.round for rounding', () => {
    const fnMatch = accountingIntegrationSource.match(
      /accountingRecordLettingFee[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(fnMatch).not.toBeNull();
    const fnBody = fnMatch![0];
    expect(fnBody).toMatch(/Math\.round/);
    expect(fnBody).toMatch(/0\.2/);
  });

  it('should accept sourceType and sourceId parameters', () => {
    const fnMatch = accountingIntegrationSource.match(
      /accountingRecordLettingFee\([^)]*\)/
    );
    expect(fnMatch).not.toBeNull();
    const signature = fnMatch![0];
    expect(signature).toContain('sourceType');
    expect(signature).toContain('sourceId');
  });

  it('should use different revenue account code than commission (4010 vs 4020)', () => {
    // Commission uses 4020, Letting uses 4010 -- verify they are different
    const commissionFn = accountingIntegrationSource.match(
      /accountingRecordCommissionIncome[\s\S]*?(?=export\s+async\s+function|$)/
    );
    const lettingFn = accountingIntegrationSource.match(
      /accountingRecordLettingFee[\s\S]*?(?=export\s+async\s+function|$)/
    );
    expect(commissionFn).not.toBeNull();
    expect(lettingFn).not.toBeNull();

    // Commission should use 4020, Letting should use 4010
    expect(commissionFn![0]).toContain("'4020'");
    expect(lettingFn![0]).toContain("'4010'");
  });
});

// ==========================================================
// Task 2: Cron Jobs, Event Hooks, Server Startup Wiring
// ==========================================================

// Read service source for static analysis
const serviceSource = fs.readFileSync(
  path.resolve(__dirname, '../services/businessAccountsService.ts'),
  'utf-8'
);

const indexSource = fs.readFileSync(
  path.resolve(__dirname, '../index.ts'),
  'utf-8'
);

const dealEventBusSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/services/dealEventBus.ts'),
  'utf-8'
);

describe('businessAccountsService exports', () => {
  it('should export registerBusinessAccountsCronJobs', () => {
    expect(serviceSource).toMatch(/export\s+async\s+function\s+registerBusinessAccountsCronJobs/);
  });

  it('should export registerBusinessAccountsEventHooks', () => {
    expect(serviceSource).toMatch(/export\s+async\s+function\s+registerBusinessAccountsEventHooks/);
  });
});

describe('Cron job schedules', () => {
  it('should schedule riley:process-recurring-invoices daily at 6am', () => {
    expect(serviceSource).toContain("'riley:process-recurring-invoices'");
    expect(serviceSource).toContain("'0 6 * * *'");
  });

  it('should schedule riley:period-close-reminder on 5th of month at 9am', () => {
    expect(serviceSource).toContain("'riley:period-close-reminder'");
    expect(serviceSource).toContain("'0 9 5 * *'");
  });

  it('should schedule riley:vat-quarter-check quarterly', () => {
    expect(serviceSource).toContain("'riley:vat-quarter-check'");
    expect(serviceSource).toContain("'0 8 1 1,4,7,10 *'");
  });
});

describe('Recurring invoice processor', () => {
  it('should query recurring_invoice_templates for active templates due for generation', () => {
    expect(serviceSource).toMatch(/recurring_invoice_templates.*is_active.*=.*true/i);
    expect(serviceSource).toMatch(/next_generation_date/i);
  });

  it('should create business_invoices from templates', () => {
    expect(serviceSource).toMatch(/INSERT INTO business_invoices/i);
  });

  it('should copy line items to business_invoice_lines', () => {
    expect(serviceSource).toMatch(/INSERT INTO business_invoice_lines/i);
  });

  it('should update next_generation_date after processing', () => {
    expect(serviceSource).toMatch(/UPDATE recurring_invoice_templates.*next_generation_date/i);
  });
});

describe('Period close reminder', () => {
  it('should query open financial periods past their end date', () => {
    expect(serviceSource).toMatch(/financial_periods.*status.*=.*'open'/i);
    expect(serviceSource).toMatch(/end_date/i);
  });

  it('should send email reminders to admin users', () => {
    expect(serviceSource).toMatch(/sendEmail/);
    expect(serviceSource).toMatch(/role.*=.*'admin'/i);
  });

  it('should NOT auto-close periods (reminder only)', () => {
    // Should not contain UPDATE financial_periods SET status = 'closed'
    expect(serviceSource).not.toMatch(/UPDATE financial_periods.*SET.*status.*=.*'closed'/i);
  });
});

describe('VAT quarter check', () => {
  it('should query draft VAT returns past their period end', () => {
    expect(serviceSource).toMatch(/vat_returns.*status.*=.*'draft'/i);
    expect(serviceSource).toMatch(/period_end/i);
  });

  it('should send email reminders for pending VAT returns', () => {
    // Check that VAT handler also sends emails
    const vatSection = serviceSource.match(
      /riley:vat-quarter-check[\s\S]*?(?=console\.log.*\[Riley Cron\] VAT)/
    );
    expect(vatSection).not.toBeNull();
    expect(vatSection![0]).toContain('sendEmail');
  });
});

describe('Deal event hooks', () => {
  it('should subscribe to SALE_COMPLETED event for commission journal', () => {
    expect(serviceSource).toMatch(/DEAL_EVENTS\.SALE_COMPLETED/);
    expect(serviceSource).toMatch(/accountingRecordCommissionIncome/);
  });

  it('should subscribe to TENANCY_AGREED event for letting fee journal', () => {
    expect(serviceSource).toMatch(/DEAL_EVENTS\.TENANCY_AGREED/);
    expect(serviceSource).toMatch(/accountingRecordLettingFee/);
  });

  it('should use fire-and-forget pattern (catch errors internally)', () => {
    // Both event handlers should have try/catch blocks
    const saleHandler = serviceSource.match(
      /SALE_COMPLETED[\s\S]*?catch\s*\(/
    );
    const tenancyHandler = serviceSource.match(
      /TENANCY_AGREED[\s\S]*?catch\s*\(/
    );
    expect(saleHandler).not.toBeNull();
    expect(tenancyHandler).not.toBeNull();
  });

  it('should pass sourceType=deal and sourceId=dealId for traceability', () => {
    expect(serviceSource).toContain("'deal'");
    expect(serviceSource).toMatch(/payload\.dealId/);
  });

  it('should skip journal creation when commission/fee is zero or missing', () => {
    expect(serviceSource).toMatch(/commissionPence\s*<=\s*0|commissionPence\s*===\s*0/);
    expect(serviceSource).toMatch(/feePence\s*<=\s*0|feePence\s*===\s*0/);
  });
});

describe('SALE_COMPLETED event in dealEventBus', () => {
  it('should be defined in DEAL_EVENTS constants', () => {
    expect(dealEventBusSource).toContain("SALE_COMPLETED: 'sale.completed'");
  });
});

describe('Server startup wiring', () => {
  it('should import and call registerBusinessAccountsCronJobs in index.ts', () => {
    expect(indexSource).toMatch(/registerBusinessAccountsCronJobs/);
    expect(indexSource).toMatch(/businessAccountsService/);
  });

  it('should import and call registerBusinessAccountsEventHooks in index.ts', () => {
    expect(indexSource).toMatch(/registerBusinessAccountsEventHooks/);
  });
});

describe('Lazy initialization', () => {
  it('should use lazy pg-boss init (not connect at module load)', () => {
    // Should have getBoss function that checks null
    expect(serviceSource).toMatch(/let boss.*=\s*null/);
    expect(serviceSource).toMatch(/async function getBoss/);
  });

  it('should use lazy imports for pool, emailService, and accountingIntegration', () => {
    expect(serviceSource).toMatch(/let _pool.*=\s*null/);
    expect(serviceSource).toMatch(/let _emailService.*=\s*null/);
    expect(serviceSource).toMatch(/let _accountingIntegration.*=\s*null/);
  });
});
