/**
 * Finance Agent Service -- Tests
 *
 * Wave 0 test stubs + unit tests for pure calculation functions.
 * Tests calculateManagementFee, generateInvoiceNumber, generateStatementNumber.
 */
import { describe, it, expect } from 'vitest';

// Import will fail until service is created (RED phase)
import {
  calculateManagementFee,
  generateInvoiceNumber,
  generateStatementNumber,
} from '../services/financeAgentService';

describe('management fee calculation', () => {
  it('full-management at 150000 pence returns 13% fee + VAT', () => {
    const result = calculateManagementFee('full-management', 150000);
    expect(result).toEqual({ feePence: 19500, feePercentage: 13, vatPence: 3900 });
  });

  it('let-only returns zeros (upfront fee, no monthly deduction)', () => {
    const result = calculateManagementFee('let-only', 150000);
    expect(result).toEqual({ feePence: 0, feePercentage: 0, vatPence: 0 });
  });

  it('let-and-collect at 100000 pence returns 11% fee + VAT', () => {
    const result = calculateManagementFee('let-and-collect', 100000);
    expect(result).toEqual({ feePence: 11000, feePercentage: 11, vatPence: 2200 });
  });

  it('null management type returns zeros', () => {
    const result = calculateManagementFee(null, 150000);
    expect(result).toEqual({ feePence: 0, feePercentage: 0, vatPence: 0 });
  });
});

describe('invoice/statement number generation', () => {
  it('generateInvoiceNumber scoped by tenancyId', () => {
    const result = generateInvoiceNumber(42, new Date('2026-04-01'));
    expect(result).toBe('INV-202604-42');
  });

  it('generateStatementNumber scoped by propertyId', () => {
    const result = generateStatementNumber(42, new Date('2026-04-01'));
    expect(result).toBe('STMT-202604-42');
  });
});

describe('statement generation', () => {
  it.todo('FIN-01: aggregates rent collected from paid invoices in period');
  it.todo('FIN-01: calculates management fees per service package');
  it.todo('FIN-01: includes maintenance costs from work orders');
  it.todo('FIN-01: includes certification costs');
  it.todo('FIN-01: computes VAT on fees');
  it.todo('FIN-01: flags zero-rent properties as attention_needed');
  it.todo('FIN-01: creates statement_line_item rows for each component');
});

describe('invoice generation', () => {
  it.todo('FIN-04: finds active tenancies with rent due within 7 days');
  it.todo('FIN-04: creates invoice with correct amount from tenancy rentAmount');
  it.todo('FIN-04: adds service charge line item when property has serviceCharge > 0');
  it.todo('FIN-04: generates unique invoice number per tenancy');
  it.todo('FIN-04: skips tenancies already invoiced for period');
});

describe('approval workflow', () => {
  it.todo('FIN-02: draft statements can be approved');
  it.todo('FIN-02: approved statements can be sent');
  it.todo('FIN-02: sent statements can be marked paid');
});

describe('payment link generation', () => {
  it.todo('FIN-05: generatePaymentLinkTool returns Stripe URL');
  it.todo('FIN-05: generatePaymentLinkTool returns GoCardless URL');
  it.todo('FIN-05: payment link sent via WhatsApp when contact has WhatsApp');
});

describe('supervisor registration', () => {
  it.todo('FIN-08: Taylor agent registers with supervisor');
});

// ================================================================
// Plan 08-02: Static Analysis Tests -- Taylor Agent & Tooling
// ================================================================

import fs from 'fs';
import path from 'path';

const agentSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/sdk/financeAgent.ts'),
  'utf-8',
);

const toolsSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/sdk/financeTools.ts'),
  'utf-8',
);

const supervisorSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/sdk/supervisorAgent.ts'),
  'utf-8',
);

describe('Finance Agent -- Taylor Definition (static)', () => {
  it('defines Taylor persona with correct name', () => {
    expect(agentSource).toMatch(/name:\s*['"]Taylor from Accounts['"]/);
  });

  it('uses gpt-4o model', () => {
    expect(agentSource).toMatch(/model:\s*['"]gpt-4o['"]/);
  });

  it('includes finance specialist identity in instructions', () => {
    expect(agentSource).toMatch(/You are Taylor, a finance specialist/);
  });

  it('includes British English and no emoji directives', () => {
    expect(agentSource).toMatch(/British English/);
    expect(agentSource).toMatch(/No emoji/);
  });

  it('states Taylor does NOT chase overdue rent', () => {
    expect(agentSource).toMatch(/do NOT chase overdue rent/i);
  });

  it('states Taylor does NOT trigger landlord payments', () => {
    expect(agentSource).toMatch(/do NOT trigger landlord payments/i);
  });

  it('imports escalateToHumanTool from tools.ts', () => {
    expect(agentSource).toMatch(/import.*escalateToHumanTool.*from ['"]\.\/tools['"]/);
  });

  it('includes all 7 tools in the agent definition', () => {
    expect(agentSource).toMatch(/lookupInvoiceStatusTool/);
    expect(agentSource).toMatch(/generatePaymentLinkTool/);
    expect(agentSource).toMatch(/queryStatementsTool/);
    expect(agentSource).toMatch(/queryRentCollectionTool/);
    expect(agentSource).toMatch(/queryCostLedgerTool/);
    expect(agentSource).toMatch(/generateReceiptTool/);
    expect(agentSource).toMatch(/escalateToHumanTool/);
  });
});

describe('Finance Tools -- Lazy Imports (static)', () => {
  it('does not eagerly import pool at module level', () => {
    expect(toolsSource).not.toMatch(/^import\s+.*\bpool\b.*from/m);
    expect(toolsSource).toMatch(/async function getPool/);
  });

  it('uses lazy import for paymentLinkService', () => {
    expect(toolsSource).toMatch(/await import\(['"]\.\.\/services\/paymentLinkService['"]\)/);
  });

  it('uses lazy import for messageSender', () => {
    expect(toolsSource).toMatch(/await import\(['"]\.\.\/services\/messageSender['"]\)/);
  });

  it('defines all 6 finance-specific tools', () => {
    expect(toolsSource).toMatch(/export const lookupInvoiceStatusTool/);
    expect(toolsSource).toMatch(/export const generatePaymentLinkTool/);
    expect(toolsSource).toMatch(/export const queryStatementsTool/);
    expect(toolsSource).toMatch(/export const queryRentCollectionTool/);
    expect(toolsSource).toMatch(/export const queryCostLedgerTool/);
    expect(toolsSource).toMatch(/export const generateReceiptTool/);
  });
});

describe('Supervisor -- Taylor Registration (static)', () => {
  it('imports financeAgent', () => {
    expect(supervisorSource).toMatch(/import.*financeAgent.*from ['"]\.\/financeAgent['"]/);
  });

  it('has transfer_to_finance handoff', () => {
    expect(supervisorSource).toMatch(/handoff\(financeAgent/);
    expect(supervisorSource).toMatch(/transfer_to_finance/);
  });

  it('mentions Taylor from Accounts in routing instructions', () => {
    expect(supervisorSource).toMatch(/Taylor from Accounts/);
  });
});

describe('Finance Cron Jobs (static)', () => {
  let cronSource: string;

  try {
    cronSource = fs.readFileSync(
      path.resolve(__dirname, '../agents/services/financeCronJobs.ts'),
      'utf-8',
    );
  } catch {
    cronSource = '';
  }

  it('file exists', () => {
    expect(cronSource.length).toBeGreaterThan(0);
  });

  it('exports registerFinanceCronJobs', () => {
    expect(cronSource).toMatch(/export.*registerFinanceCronJobs/);
  });

  it('schedules monthly statement generation on 1st of month', () => {
    expect(cronSource).toMatch(/taylor:generate-statements/);
    expect(cronSource).toMatch(/0 6 1 \* \*/);
  });

  it('schedules daily invoice generation', () => {
    expect(cronSource).toMatch(/taylor:generate-invoices/);
    expect(cronSource).toMatch(/0 7 \* \* \*/);
  });

  it('subscribes to TENANCY_AGREED deal event', () => {
    expect(cronSource).toMatch(/TENANCY_AGREED|tenancy\.agreed/);
  });

  it('subscribes to TENANCY_ENDING deal event', () => {
    expect(cronSource).toMatch(/TENANCY_ENDING|tenancy\.ending/);
  });
});

describe('Server Startup -- Finance Cron Wiring (static)', () => {
  const indexSource = fs.readFileSync(
    path.resolve(__dirname, '../index.ts'),
    'utf-8',
  );

  it('imports registerFinanceCronJobs', () => {
    expect(indexSource).toMatch(/registerFinanceCronJobs/);
  });

  it('calls registerFinanceCronJobs at startup', () => {
    expect(indexSource).toMatch(/registerFinanceCronJobs\(\)/);
  });
});
