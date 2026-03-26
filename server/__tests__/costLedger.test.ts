/**
 * Cost Ledger -- Static Analysis Tests
 *
 * Verifies that costLedgerRoutes.ts contains the correct SQL patterns
 * and uses emailService (not notification table) for threshold alerts.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const routeSource = fs.readFileSync(
  path.resolve(__dirname, '../costLedgerRoutes.ts'),
  'utf-8'
);

describe('Cost Ledger Routes -- Static Analysis', () => {
  it('COST-01: aggregates maintenance costs from work_order.invoice_amount', () => {
    // Must JOIN work_order with maintenance_request
    expect(routeSource).toMatch(/work_order\s+wo/i);
    expect(routeSource).toMatch(/maintenance_request\s+mr/i);
    expect(routeSource).toMatch(/wo\.maintenance_request_id/i);
    // Must reference invoice_amount
    expect(routeSource).toMatch(/invoice_amount/i);
    // Must aggregate with SUM
    expect(routeSource).toMatch(/SUM\(wo\.invoice_amount\)/i);
  });

  it('COST-02: aggregates compliance costs from property_certification.cost', () => {
    // Must reference property_certification table
    expect(routeSource).toMatch(/property_certification/i);
    // Must reference cost column
    expect(routeSource).toMatch(/SUM\(cost\)/i);
    // Must filter by property_id
    expect(routeSource).toMatch(/pc\.property_id/i);
  });

  it('COST-03: threshold email uses emailService not notification table', () => {
    // Must import and use emailService
    expect(routeSource).toMatch(/emailService/);
    expect(routeSource).toMatch(/emailService\.sendEmail/);
    // Must NOT insert into notification table for threshold alerts
    expect(routeSource).not.toMatch(/INSERT\s+INTO\s+notification/i);
  });
});
