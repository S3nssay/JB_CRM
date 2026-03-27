/**
 * Sourcing Agent (Charlie) -- Unit Tests
 *
 * Static analysis tests (no DB needed) for:
 * - SourcingAgent BaseAgent definition
 * - SDK sourcingAgent definition
 * - Supervisor registration with transfer_to_sourcing handoff
 * - AgentOrchestrator registration
 * - AgentType union includes 'sourcing'
 * - lead_contact_history schema includes approval fields
 * - Cron jobs and deal event bus wiring
 *
 * SRC-01, SRC-02, SRC-03, SRC-08, SRC-09, SRC-10, SRC-11
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// ---- Read source files for static analysis ----

const typesSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/types.ts'),
  'utf-8'
);

const sourcingAgentSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/specialists/SourcingAgent.ts'),
  'utf-8'
);

const orchestratorSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/AgentOrchestrator.ts'),
  'utf-8'
);

const sdkSourcingSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/sdk/sourcingAgent.ts'),
  'utf-8'
);

const supervisorSource = fs.readFileSync(
  path.resolve(__dirname, '../agents/sdk/supervisorAgent.ts'),
  'utf-8'
);

const schemaSource = fs.readFileSync(
  path.resolve(__dirname, '../../shared/schema.ts'),
  'utf-8'
);

// ---- Task 1: Agent definition tests ----

describe('AgentType union', () => {
  it('includes sourcing type', () => {
    expect(typesSource).toMatch(/['"]sourcing['"]/);
  });
});

describe('SourcingAgent (BaseAgent)', () => {
  it('has id sourcing', () => {
    expect(sourcingAgentSource).toContain("id: 'sourcing'");
  });

  it('name contains Charlie', () => {
    expect(sourcingAgentSource).toContain('Charlie');
  });

  it('handlesTaskTypes includes process_proactive_lead', () => {
    expect(sourcingAgentSource).toContain('process_proactive_lead');
  });

  it('handlesTaskTypes includes run_monitor', () => {
    expect(sourcingAgentSource).toContain('run_monitor');
  });

  it('exports sourcingAgent singleton', () => {
    expect(sourcingAgentSource).toContain('export const sourcingAgent');
  });
});

describe('AgentOrchestrator registration', () => {
  it('imports sourcingAgent', () => {
    expect(orchestratorSource).toContain('sourcingAgent');
  });

  it('registers sourcingAgent with supervisor', () => {
    expect(orchestratorSource).toContain('registerAgent(sourcingAgent)');
  });
});

describe('SDK sourcingAgent', () => {
  it('name contains Charlie', () => {
    expect(sdkSourcingSource).toContain('Charlie');
  });

  it('uses gpt-4o model', () => {
    expect(sdkSourcingSource).toContain("model: 'gpt-4o'");
  });

  it('instructions mention West London', () => {
    expect(sdkSourcingSource).toContain('West London');
  });

  it('instructions mention premium local expert', () => {
    expect(sdkSourcingSource).toContain('premium local expert');
  });

  it('instructions mention staff approval required', () => {
    expect(sdkSourcingSource).toMatch(/staff approval/i);
  });

  it('exports sourcingAgent', () => {
    expect(sdkSourcingSource).toContain('export const sourcingAgent');
  });

  it('is typed as Agent<AgentContext>', () => {
    expect(sdkSourcingSource).toContain('Agent<AgentContext>');
  });
});

describe('Supervisor routing', () => {
  it('contains transfer_to_sourcing handoff', () => {
    expect(supervisorSource).toContain('transfer_to_sourcing');
  });

  it('imports sourcingAgent', () => {
    expect(supervisorSource).toContain('sourcingAgent');
  });
});

describe('lead_contact_history schema', () => {
  it('includes approval_status column', () => {
    // Extract the lead_contact_history table definition
    const tableMatch = schemaSource.match(/lead_contact_history[\s\S]*?\}\);/);
    expect(tableMatch).not.toBeNull();
    const tableDef = tableMatch![0];
    expect(tableDef).toContain('approval_status');
  });

  it('includes approved_by_id column', () => {
    const tableMatch = schemaSource.match(/lead_contact_history[\s\S]*?\}\);/);
    const tableDef = tableMatch![0];
    expect(tableDef).toContain('approved_by_id');
  });

  it('includes approved_at column', () => {
    const tableMatch = schemaSource.match(/lead_contact_history[\s\S]*?\}\);/);
    const tableDef = tableMatch![0];
    expect(tableDef).toContain('approved_at');
  });

  it('includes rejection_reason column', () => {
    const tableMatch = schemaSource.match(/lead_contact_history[\s\S]*?\}\);/);
    const tableDef = tableMatch![0];
    expect(tableDef).toContain('rejection_reason');
  });
});

// ---- Task 2: Cron and event bus tests (added later) ----

describe('sourcingCronJobs.ts', () => {
  it('exports registerSourcingCronJobs function', () => {
    const cronSource = fs.readFileSync(
      path.resolve(__dirname, '../agents/services/sourcingCronJobs.ts'),
      'utf-8'
    );
    expect(cronSource).toContain('export async function registerSourcingCronJobs');
  });
});

describe('dealEventBus.ts', () => {
  it('contains VALUATION_BOOKED event', () => {
    const eventBusSource = fs.readFileSync(
      path.resolve(__dirname, '../agents/services/dealEventBus.ts'),
      'utf-8'
    );
    expect(eventBusSource).toContain('VALUATION_BOOKED');
  });
});

describe('server/index.ts startup wiring', () => {
  it('contains registerSourcingCronJobs import', () => {
    const indexSource = fs.readFileSync(
      path.resolve(__dirname, '../index.ts'),
      'utf-8'
    );
    expect(indexSource).toContain('registerSourcingCronJobs');
  });
});
