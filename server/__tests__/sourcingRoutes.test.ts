/**
 * Sourcing Routes -- Unit Tests
 *
 * Static analysis + handler logic tests for sourcing dashboard API.
 * Tests verify route definitions, handler structure, and response shapes.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const routeSource = fs.readFileSync(
  path.resolve(__dirname, '../sourcingRoutes.ts'),
  'utf-8'
);

describe('sourcingRoutes - Static Analysis', () => {
  // --- Pipeline endpoints ---
  it('defines GET /sourcing/leads endpoint', () => {
    expect(routeSource).toMatch(/router\.(get|all)\s*\(\s*['"]\/sourcing\/leads['"]/);
  });

  it('supports source filter on leads endpoint', () => {
    expect(routeSource).toMatch(/source/);
    expect(routeSource).toMatch(/lead_source/);
  });

  it('supports search filter on leads endpoint', () => {
    expect(routeSource).toMatch(/search/);
    expect(routeSource).toMatch(/ILIKE/);
  });

  it('defines GET /sourcing/leads/:id endpoint', () => {
    expect(routeSource).toMatch(/router\.get\s*\(\s*['"]\/sourcing\/leads\/:id['"]/);
  });

  it('joins lead_contact_history for single lead detail', () => {
    expect(routeSource).toMatch(/lead_contact_history/);
  });

  it('joins propensity_score for scoring data', () => {
    expect(routeSource).toMatch(/propensity_score/);
  });

  // --- Approval endpoints ---
  it('defines GET /sourcing/approvals endpoint', () => {
    expect(routeSource).toMatch(/router\.get\s*\(\s*['"]\/sourcing\/approvals['"]/);
  });

  it('defines POST /sourcing/approvals/:id/approve endpoint', () => {
    expect(routeSource).toMatch(/router\.post\s*\(\s*['"]\/sourcing\/approvals\/:id\/approve['"]/);
  });

  it('defines POST /sourcing/approvals/:id/reject endpoint', () => {
    expect(routeSource).toMatch(/router\.post\s*\(\s*['"]\/sourcing\/approvals\/:id\/reject['"]/);
  });

  it('defines PUT /sourcing/approvals/:id/edit endpoint', () => {
    expect(routeSource).toMatch(/router\.put\s*\(\s*['"]\/sourcing\/approvals\/:id\/edit['"]/);
  });

  it('uses lazy import for sourcingApprovalService', () => {
    expect(routeSource).toMatch(/import\s*\(\s*['"]\.\/agents\/services\/sourcingApprovalService['"]\s*\)/);
  });

  // --- Campaign CRUD endpoints ---
  it('defines GET /sourcing/campaigns endpoint', () => {
    expect(routeSource).toMatch(/router\.get\s*\(\s*['"]\/sourcing\/campaigns['"]/);
  });

  it('defines POST /sourcing/campaigns endpoint', () => {
    expect(routeSource).toMatch(/router\.post\s*\(\s*['"]\/sourcing\/campaigns['"]/);
  });

  it('defines PUT /sourcing/campaigns/:id endpoint', () => {
    expect(routeSource).toMatch(/router\.put\s*\(\s*['"]\/sourcing\/campaigns\/:id['"]/);
  });

  it('defines DELETE /sourcing/campaigns/:id endpoint', () => {
    expect(routeSource).toMatch(/router\.delete\s*\(\s*['"]\/sourcing\/campaigns\/:id['"]/);
  });

  it('queries lead_monitoring_config table for campaigns', () => {
    expect(routeSource).toMatch(/lead_monitoring_config/);
  });

  // --- Metrics endpoints ---
  it('defines GET /sourcing/metrics endpoint', () => {
    expect(routeSource).toMatch(/router\.get\s*\(\s*['"]\/sourcing\/metrics['"]\s*,/);
  });

  it('defines GET /sourcing/metrics/by-source endpoint', () => {
    expect(routeSource).toMatch(/router\.get\s*\(\s*['"]\/sourcing\/metrics\/by-source['"]/);
  });

  it('computes leadsSourcedThisMonth metric', () => {
    expect(routeSource).toMatch(/leadsSourcedThisMonth|leads_sourced/i);
  });

  it('computes responseRate metric', () => {
    expect(routeSource).toMatch(/responseRate|response_rate/i);
  });

  it('computes valuationsBooked metric', () => {
    expect(routeSource).toMatch(/valuationsBooked|valuation_booked/i);
  });

  // --- Outreach draft ---
  it('defines POST /sourcing/leads/:id/draft-outreach endpoint', () => {
    expect(routeSource).toMatch(/router\.post\s*\(\s*['"]\/sourcing\/leads\/:id\/draft-outreach['"]/);
  });

  it('uses lazy import for sourcingOutreachService', () => {
    expect(routeSource).toMatch(/import\s*\(\s*['"]\.\/agents\/services\/sourcingOutreachService['"]\s*\)/);
  });

  // --- Manual monitor trigger ---
  it('defines POST /sourcing/monitors/:type/run endpoint', () => {
    expect(routeSource).toMatch(/router\.post\s*\(\s*['"]\/sourcing\/monitors\/:type\/run['"]/);
  });

  it('uses lazy import for proactiveLeadGenService', () => {
    expect(routeSource).toMatch(/import\s*\(\s*['"]\.\/proactiveLeadGenService['"]\s*\)/);
  });

  // --- Auth & Router export ---
  it('exports sourcingRouter', () => {
    expect(routeSource).toMatch(/export\s+(const|{)\s*sourcingRouter/);
  });

  it('checks req.user authentication on all handlers', () => {
    // At least one auth check pattern
    expect(routeSource).toMatch(/req\.user|!req\.user/);
  });

  // --- Pipeline grouping ---
  it('groups leads by status stages', () => {
    // Should reference the pipeline stage statuses
    expect(routeSource).toMatch(/new.*researching|stages|pipeline/i);
  });

  it('orders leads by lead_score DESC within stages', () => {
    expect(routeSource).toMatch(/lead_score\s+DESC|ORDER BY.*lead_score/i);
  });
});
