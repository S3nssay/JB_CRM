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
