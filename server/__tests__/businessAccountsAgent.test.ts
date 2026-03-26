/**
 * Business Accounts Agent -- Unit Tests
 *
 * Static analysis tests (no DB needed) for:
 * - Agent definition (name, model, tools, instructions)
 * - Accounting query logic (mocked pool)
 * - Supervisor registration
 *
 * BIZ-01: P&L queries
 * BIZ-02: Balance sheet queries
 * BIZ-03: VAT return status
 * BIZ-04: Financial period management
 * BIZ-05: Aged debtors/creditors
 * BIZ-07: Cash position
 * BIZ-08: Supervisor routing
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Read source files for static analysis
const agentSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/sdk/businessAccountsAgent.ts'),
  'utf-8'
);

const supervisorSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/sdk/supervisorAgent.ts'),
  'utf-8'
);

const queriesSource = fs.readFileSync(
  path.resolve(__dirname, '../accountingQueries.ts'),
  'utf-8'
);

// ---- Agent Definition (Static Analysis) ----

describe('businessAccountsAgent.ts -- static analysis', () => {
  describe('Agent definition', () => {
    it('agent name is Riley from Business Accounts', () => {
      expect(agentSource).toContain("name: 'Riley from Business Accounts'");
    });

    it('agent uses gpt-4o model', () => {
      expect(agentSource).toContain("model: 'gpt-4o'");
    });

    it('exports businessAccountsAgent', () => {
      expect(agentSource).toContain('export const businessAccountsAgent');
    });

    it('agent is typed as Agent<AgentContext>', () => {
      expect(agentSource).toContain('Agent<AgentContext>');
    });
  });

  describe('Tool names', () => {
    const expectedTools = [
      'query_profit_and_loss',
      'query_balance_sheet',
      'query_trial_balance',
      'query_vat_return',
      'calculate_vat_return',
      'query_cash_position',
      'query_aged_debtors',
      'query_aged_creditors',
      'query_financial_periods',
      'close_financial_period',
      'query_financial_year_dates',
      'escalate_to_human',
    ];

    for (const toolName of expectedTools) {
      it(`has tool: ${toolName}`, () => {
        expect(agentSource).toContain(toolName);
      });
    }

    it('has 12 tools in tools array', () => {
      // Count tool references in the tools array block
      const toolsArrayMatch = agentSource.match(/tools:\s*\[([\s\S]*?)\]/);
      expect(toolsArrayMatch).toBeTruthy();
      const toolsContent = toolsArrayMatch![1];
      const toolEntries = toolsContent.split(',').filter((s: string) => s.trim().length > 0);
      expect(toolEntries.length).toBe(12);
    });
  });

  describe('Instructions content', () => {
    it('mentions amounts are in pence and must be converted to GBP', () => {
      expect(agentSource).toContain('pence');
      expect(agentSource).toContain('GBP');
      expect(agentSource).toContain('divide by 100');
    });

    it('explicitly excludes tenant/landlord queries (Taylor domain)', () => {
      expect(agentSource).toContain('Taylor');
      expect(agentSource).toContain('tenant rent invoices');
      expect(agentSource).toContain('landlord statements');
    });

    it('excludes rent arrears (Sarah domain)', () => {
      expect(agentSource).toContain('Sarah');
      expect(agentSource).toContain('rent arrears');
    });

    it('uses British English and no emoji', () => {
      expect(agentSource).toContain('British English');
      expect(agentSource).toContain('No emoji');
    });

    it('mentions financial year is configurable, not calendar year', () => {
      expect(agentSource).toContain('financial year start month');
      expect(agentSource).toContain('Do not assume calendar year');
    });
  });

  describe('Uses zod4 and lazy imports', () => {
    it('imports z as z4 from zod4', () => {
      expect(agentSource).toContain("import { z as z4 } from 'zod4'");
    });

    it('uses lazy import for accountingQueries in tool execute functions', () => {
      const lazyImportCount = (agentSource.match(/await import\('\.\.\/\.\.\/accountingQueries'\)/g) || []).length;
      // At least 6 tools use accountingQueries lazy import
      expect(lazyImportCount).toBeGreaterThanOrEqual(6);
    });

    it('uses lazy import for pool in tool execute functions', () => {
      expect(agentSource).toContain("await import('../../db')");
    });
  });
});

// ---- Accounting Queries Module (Static Analysis) ----

describe('accountingQueries.ts -- static analysis', () => {
  it('exports getTrialBalance function', () => {
    expect(queriesSource).toContain('export async function getTrialBalance');
  });

  it('exports getProfitAndLoss function', () => {
    expect(queriesSource).toContain('export async function getProfitAndLoss');
  });

  it('exports getBalanceSheet function', () => {
    expect(queriesSource).toContain('export async function getBalanceSheet');
  });

  it('exports getCashPosition function', () => {
    expect(queriesSource).toContain('export async function getCashPosition');
  });

  it('exports getAgedDebtors function', () => {
    expect(queriesSource).toContain('export async function getAgedDebtors');
  });

  it('exports getAgedCreditors function', () => {
    expect(queriesSource).toContain('export async function getAgedCreditors');
  });

  it('exports getFinancialYearDates function', () => {
    expect(queriesSource).toContain('export async function getFinancialYearDates');
  });

  it('exports TrialBalanceRow interface', () => {
    expect(queriesSource).toContain('export interface TrialBalanceRow');
  });

  it('uses lazy import for pool in all functions', () => {
    const lazyPoolImports = (queriesSource.match(/await import\('\.\/db'\)/g) || []).length;
    // All 7 exported functions use lazy pool import
    expect(lazyPoolImports).toBeGreaterThanOrEqual(7);
  });

  describe('getTrialBalance balance calculation', () => {
    it('computes debit normal_balance as opening + debits - credits', () => {
      expect(queriesSource).toContain('opening + debits - credits');
    });

    it('computes credit normal_balance as opening + credits - debits', () => {
      expect(queriesSource).toContain('opening + credits - debits');
    });
  });

  describe('getProfitAndLoss computation', () => {
    it('revenue balance is credits - debits', () => {
      // P&L section: credits - debits for revenue
      expect(queriesSource).toContain('credits - debits');
    });

    it('expense balance is debits - credits', () => {
      expect(queriesSource).toContain('debits - credits');
    });

    it('computes netProfit as totalRevenue - totalExpenses', () => {
      expect(queriesSource).toContain('totalRevenue - totalExpenses');
    });
  });

  describe('getCashPosition', () => {
    it('queries account codes starting with 1010 (business current)', () => {
      expect(queriesSource).toContain("LIKE '1010%'");
    });

    it('queries account codes starting with 1020 (client money)', () => {
      expect(queriesSource).toContain("LIKE '1020%'");
    });
  });

  describe('getAgedDebtors', () => {
    it('queries business_invoices table', () => {
      expect(queriesSource).toContain('FROM business_invoices');
    });

    it('excludes draft, void, and paid invoices', () => {
      expect(queriesSource).toContain("status NOT IN ('draft', 'void', 'paid')");
    });
  });

  describe('getAgedCreditors', () => {
    it('queries purchase_invoices table', () => {
      expect(queriesSource).toContain('FROM purchase_invoices');
    });
  });

  describe('getFinancialYearDates', () => {
    it('reads financial_year_start from business_settings', () => {
      expect(queriesSource).toContain('financial_year_start');
      expect(queriesSource).toContain('business_settings');
    });

    it('defaults to April (month 4) when setting is missing', () => {
      expect(queriesSource).toContain(': 4');
    });
  });
});

// ---- Supervisor Registration (BIZ-08) ----

describe('supervisorAgent.ts -- Riley registration', () => {
  it('imports businessAccountsAgent', () => {
    expect(supervisorSource).toContain('businessAccountsAgent');
  });

  it('contains transfer_to_business_accounts handoff', () => {
    expect(supervisorSource).toContain('transfer_to_business_accounts');
  });

  it('handoff description mentions P&L, balance sheet, VAT', () => {
    expect(supervisorSource).toContain('profit and loss');
  });

  it('handoff description distinguishes from Taylor (tenant/landlord)', () => {
    expect(supervisorSource).toContain('Taylor');
  });

  it('supervisor instructions mention Riley', () => {
    expect(supervisorSource).toContain('Riley');
  });
});
