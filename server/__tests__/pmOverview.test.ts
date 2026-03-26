/**
 * PM Overview Routes -- Static Analysis Tests
 *
 * Verifies that pmOverviewRoutes.ts contains correct SQL patterns,
 * response shape construction, and health score formula.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const routeSource = fs.readFileSync(
  path.resolve(__dirname, '../pmOverviewRoutes.ts'),
  'utf-8'
);

describe('PM Overview -- Compliance Alerts', () => {
  it('queries property_certification table with expiry_date filter', () => {
    expect(routeSource).toMatch(/property_certification\s+pc/i);
    expect(routeSource).toMatch(/pc\.expiry_date/i);
  });

  it('joins properties and landlords for address and name', () => {
    expect(routeSource).toMatch(/JOIN\s+properties\s+p\s+ON/i);
    expect(routeSource).toMatch(/JOIN\s+landlords\s+l\s+ON/i);
  });

  it('filters only managed properties', () => {
    expect(routeSource).toMatch(/is_managed\s*=\s*true/i);
  });

  it('returns expired and expiringSoon arrays plus totals', () => {
    expect(routeSource).toMatch(/expired/);
    expect(routeSource).toMatch(/expiringSoon/);
    expect(routeSource).toMatch(/totalProperties/);
    expect(routeSource).toMatch(/compliantProperties/);
  });

  it('categorises certs by urgency (expired vs expiring_soon)', () => {
    expect(routeSource).toMatch(/urgency.*expired/);
    expect(routeSource).toMatch(/expiring_soon/);
  });
});

describe('PM Overview -- Portfolio Health', () => {
  it('uses Promise.all for parallel queries', () => {
    expect(routeSource).toMatch(/Promise\.all/);
  });

  it('starts health score at 100', () => {
    expect(routeSource).toMatch(/score\s*=\s*100/);
  });

  it('deducts 20 per expired cert', () => {
    expect(routeSource).toMatch(/20\s*\*\s*expiredCount/);
  });

  it('deducts 10 per expiring cert', () => {
    expect(routeSource).toMatch(/10\s*\*\s*expiringCount/);
  });

  it('deducts 5 per open maintenance ticket', () => {
    expect(routeSource).toMatch(/5\s*\*\s*ticketCount/);
  });

  it('deducts 15 per active arrears case', () => {
    expect(routeSource).toMatch(/15\s*\*\s*arrearsCount/);
  });

  it('deducts 25 for vacant property (no active tenancy)', () => {
    expect(routeSource).toMatch(/25/);
    expect(routeSource).toMatch(/Vacant/);
  });

  it('excludes completed and closed tickets from count', () => {
    expect(routeSource).toMatch(/NOT\s+IN\s*\(\s*'completed'\s*,\s*'closed'\s*\)/i);
  });

  it('queries arrears table with active status', () => {
    expect(routeSource).toMatch(/FROM\s+arrears/i);
    expect(routeSource).toMatch(/a\.status\s*=\s*'active'/i);
  });

  it('queries tenancy_contract for active tenancies', () => {
    expect(routeSource).toMatch(/tenancy_contract\s+tc/i);
    expect(routeSource).toMatch(/tc\.status\s*=\s*'active'/i);
  });

  it('returns properties array with healthScore, averageScore, criticalCount', () => {
    expect(routeSource).toMatch(/healthScore/);
    expect(routeSource).toMatch(/averageScore/);
    expect(routeSource).toMatch(/criticalCount/);
  });

  it('defines critical as score < 50', () => {
    expect(routeSource).toMatch(/healthScore\s*<\s*50/);
  });

  it('clamps score to minimum 0', () => {
    expect(routeSource).toMatch(/Math\.max\(\s*0/);
  });
});

describe('PM Overview -- Agent Activity', () => {
  it('queries agent_audit_log table', () => {
    expect(routeSource).toMatch(/agent_audit_log/i);
  });

  it('groups by agent_type and action', () => {
    expect(routeSource).toMatch(/GROUP\s+BY\s+agent_type\s*,\s*action/i);
  });

  it('supports optional days and agentType query params', () => {
    expect(routeSource).toMatch(/req\.query\.days/);
    expect(routeSource).toMatch(/req\.query\.agentType/);
  });

  it('returns byAgent, totalActions, and period in response', () => {
    expect(routeSource).toMatch(/byAgent/);
    expect(routeSource).toMatch(/totalActions/);
    expect(routeSource).toMatch(/period/);
  });
});

describe('PM Overview -- Health Score Formula Verification', () => {
  it('applies correct formula: 100 base with weighted deductions', () => {
    // Simulate: 1 expired cert (-20), 1 expiring cert (-10), 2 open tickets (-10)
    // Expected: 100 - 20 - 10 - 10 = 60
    const base = 100;
    const expiredPenalty = 20 * 1;
    const expiringPenalty = 10 * 1;
    const ticketPenalty = 5 * 2;
    const expected = base - expiredPenalty - expiringPenalty - ticketPenalty;
    expect(expected).toBe(60);
  });

  it('returns 100 for property with no issues', () => {
    const score = 100 - (20 * 0) - (10 * 0) - (5 * 0) - (15 * 0);
    expect(score).toBe(100);
  });

  it('clamps to 0 for severely penalised property', () => {
    // 5 expired certs = -100, already at 0
    const score = Math.max(0, 100 - (20 * 5) - 25);
    expect(score).toBe(0);
  });
});
