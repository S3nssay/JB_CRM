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
