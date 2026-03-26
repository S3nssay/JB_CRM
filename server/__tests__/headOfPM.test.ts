/**
 * Head of PM Agent -- Tests
 *
 * Static analysis tests for the headOfPMTools and headOfPMAgent modules.
 * Verifies exports, tool structure, agent definition, and supervisor wiring.
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock the @openai/agents SDK so we can inspect tool/agent definitions
// without triggering zod4 validation at import time.
vi.mock('@openai/agents', () => {
  const toolFn = (config: any) => ({ ...config, __type: 'tool' });
  const AgentClass = class {
    name: string;
    model: string;
    instructions: string;
    tools: any[];
    handoffs: any[];
    constructor(config: any) {
      this.name = config.name;
      this.model = config.model;
      this.instructions = config.instructions;
      this.tools = config.tools || [];
      this.handoffs = config.handoffs || [];
    }
  };
  const handoffFn = (agent: any, opts?: any) => ({
    __type: 'handoff',
    agent,
    toolNameOverride: opts?.toolNameOverride,
    toolDescription: opts?.toolDescription,
  });
  return { tool: toolFn, Agent: AgentClass, handoff: handoffFn };
});

// ---- headOfPMTools static analysis ----

describe('headOfPMTools.ts -- static analysis', () => {
  const toolsSource = fs.readFileSync(
    path.resolve(__dirname, '../agents/sdk/headOfPMTools.ts'),
    'utf-8',
  );

  const expectedToolNames = [
    'queryPortfolioOverviewTool',
    'queryPropertyHealthTool',
    'queryComplianceStatusTool',
    'queryMaintenanceActivityTool',
    'queryArrearsOverviewTool',
    'queryTenancyTimelineTool',
    'lookupLandlordPortfolioTool',
  ];

  it('exports all 7 tool names', () => {
    for (const name of expectedToolNames) {
      expect(toolsSource).toContain(`export const ${name}`);
    }
  });

  it('each tool has name, description, parameters, and execute', () => {
    // Each tool() call must include these keys
    const toolCallCount = (toolsSource.match(/tool\(\{/g) || []).length;
    expect(toolCallCount).toBe(7);

    // Each call should have name, description, parameters, execute
    expect((toolsSource.match(/name:/g) || []).length).toBeGreaterThanOrEqual(7);
    expect((toolsSource.match(/description:/g) || []).length).toBeGreaterThanOrEqual(7);
    expect((toolsSource.match(/parameters:/g) || []).length).toBeGreaterThanOrEqual(7);
    expect((toolsSource.match(/execute:/g) || []).length).toBeGreaterThanOrEqual(7);
  });

  it('uses lazy pool import pattern', () => {
    const lazyImports = (toolsSource.match(/await import\('\.\.\/\.\.\/db'\)/g) || []).length;
    expect(lazyImports).toBeGreaterThanOrEqual(7);
  });

  it('queries the correct table names from schema', () => {
    expect(toolsSource).toContain('FROM property');
    expect(toolsSource).toContain('property_certification');
    expect(toolsSource).toContain('maintenance_request');
    expect(toolsSource).toContain('FROM arrears');
    expect(toolsSource).toContain('FROM tenancy');
    expect(toolsSource).toContain('FROM landlord');
  });

  // Todo stubs for query logic integration tests
  it.todo('queryPortfolioOverviewTool returns structured portfolio data');
  it.todo('queryPropertyHealthTool returns compliance with health flags');
  it.todo('queryComplianceStatusTool filters by landlordId or propertyId');
  it.todo('queryMaintenanceActivityTool applies date range filter');
  it.todo('queryArrearsOverviewTool calculates total outstanding');
  it.todo('queryTenancyTimelineTool flags upcoming renewals within 90 days');
  it.todo('lookupLandlordPortfolioTool resolves landlord by phone or email');
});

// ---- headOfPMAgent static analysis ----

describe('headOfPMAgent.ts -- static analysis', () => {
  const agentSource = fs.readFileSync(
    path.resolve(__dirname, '../agents/sdk/headOfPMAgent.ts'),
    'utf-8',
  );

  it('exports headOfPMAgent with name "Jamie from Property Management"', () => {
    expect(agentSource).toContain("export const headOfPMAgent");
    expect(agentSource).toContain("name: 'Jamie from Property Management'");
  });

  it('has 8 tools (7 query + escalateToHuman)', () => {
    // Count tool references in the tools array
    expect(agentSource).toContain('queryPortfolioOverviewTool');
    expect(agentSource).toContain('queryPropertyHealthTool');
    expect(agentSource).toContain('queryComplianceStatusTool');
    expect(agentSource).toContain('queryMaintenanceActivityTool');
    expect(agentSource).toContain('queryArrearsOverviewTool');
    expect(agentSource).toContain('queryTenancyTimelineTool');
    expect(agentSource).toContain('lookupLandlordPortfolioTool');
    expect(agentSource).toContain('escalateToHumanTool');
  });

  it('has 3 active handoffs (maintenance, arrears, admin) -- Taylor deferred to Phase 8', () => {
    // Active (non-commented) handoffs
    expect(agentSource).toContain("'delegate_to_maintenance'");
    expect(agentSource).toContain("'delegate_to_arrears'");
    expect(agentSource).toContain("'delegate_to_admin'");
    // Finance handoff is commented out
    expect(agentSource).toMatch(/\/\/.*delegate_to_finance/);
  });

  it('instructions contain key persona phrases', () => {
    expect(agentSource).toContain('Jamie');
    expect(agentSource).toContain('Head of Property Management');
    expect(agentSource).toContain('Morgan');
    expect(agentSource).toContain('Sarah');
    expect(agentSource).toContain('Sam');
  });

  it('has commented-out finance handoff for Phase 8', () => {
    expect(agentSource).toContain('// import { financeAgent }');
    expect(agentSource).toContain("// Phase 8 -- Taylor handoff deferred until financeAgent exists");
  });
});

// ---- supervisorAgent wiring ----

describe('supervisorAgent.ts -- Head of PM wiring', () => {
  const supervisorSource = fs.readFileSync(
    path.resolve(__dirname, '../agents/sdk/supervisorAgent.ts'),
    'utf-8',
  );

  it('imports headOfPMAgent', () => {
    expect(supervisorSource).toContain("import { headOfPMAgent } from './headOfPMAgent'");
  });

  it('has transfer_to_head_of_pm handoff', () => {
    expect(supervisorSource).toContain("'transfer_to_head_of_pm'");
    expect(supervisorSource).toContain('headOfPMAgent');
  });

  it('preserves transfer_to_property_management for Morgan', () => {
    expect(supervisorSource).toContain("'transfer_to_property_management'");
    expect(supervisorSource).toContain('pmAgent');
  });

  it('includes Jamie in SUPERVISOR_INSTRUCTIONS roster', () => {
    expect(supervisorSource).toContain('Jamie, Head of Property Management');
    expect(supervisorSource).toContain('portfolio overviews');
  });
});
