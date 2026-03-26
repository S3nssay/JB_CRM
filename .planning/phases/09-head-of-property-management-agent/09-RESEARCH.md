# Phase 9: Head of Property Management Agent - Research

**Researched:** 2026-03-26
**Domain:** Supervisory AI agent for property management domain -- delegation, orchestration, portfolio monitoring, proactive alerting
**Confidence:** HIGH

## Summary

Phase 9 introduces a "Head of Property Management" agent -- a supervisory AI agent that sits above the existing PM domain specialists (Morgan for maintenance, Sarah for arrears, Sam for admin/documents, Taylor for finance) and provides a unified management layer. This agent does NOT replace any specialist; it delegates to them, monitors their activity, provides portfolio-level reporting, and handles proactive alerting for compliance, tenancy renewals, and portfolio health.

The existing codebase provides the complete foundation: four PM-domain specialist agents (Morgan, Sarah, Sam, Taylor) already handle operational workflows via the OpenAI Agents SDK with Supervisor handoff routing. The deal event bus (pg-boss-backed) enables lifecycle event subscriptions. The audit log tracks all agent actions. The cost ledger (Phase 7) and finance agent (Phase 8) provide financial visibility. What's missing is a coordination layer that thinks across these domains -- seeing that a property has an expiring gas safety cert, an upcoming rent review, and an active maintenance ticket simultaneously.

**Primary recommendation:** Build the Head of PM agent as a new OpenAI Agents SDK agent with handoff access to Morgan, Sarah, Sam, and Taylor. It registers in the existing Supervisor for routing (landlord portfolio queries, PM oversight requests). Its unique value is cross-domain awareness: it can query maintenance tickets, compliance status, arrears cases, financial data, and tenancy timelines in a single conversation. Add proactive monitoring via pg-boss cron jobs (daily compliance check, weekly portfolio health report, monthly KPI digest). Expose a staff-facing PM overview API for a unified dashboard.

<phase_requirements>
## Phase Requirements

Phase 9 has no pre-defined requirement IDs in REQUIREMENTS.md. Requirements are derived from the phase description and domain analysis:

| ID | Description | Research Support |
|----|-------------|-----------------|
| HPM-01 | Head of PM agent definition with supervisory persona and cross-domain tools | OpenAI Agents SDK pattern from pmAgent.ts/arrearsAgent.ts; handoff mechanism from supervisorAgent.ts |
| HPM-02 | Delegation to specialist agents (Morgan, Sarah, Sam, Taylor) via SDK handoffs | Supervisor handoff pattern already established; nested handoff chain supported by SDK |
| HPM-03 | Cross-domain portfolio query tools (maintenance + compliance + arrears + finance in one view) | Raw SQL aggregation pattern from pmWorkflowRoutes.ts, costLedgerRoutes.ts, financeRoutes.ts |
| HPM-04 | Proactive compliance monitoring (certification expiry alerts, tenancy renewal reminders) | pg-boss cron pattern from Phase 2-8; property_certification table has expiry_date |
| HPM-05 | Portfolio health reporting (per-property and per-landlord KPIs) | Extends PM dashboard summary pattern (pmWorkflowRoutes.ts); audit_log query for agent activity metrics |
| HPM-06 | Staff-facing PM overview API and dashboard enhancements | Express routes pattern; extends existing PM dashboard in CRM |
| HPM-07 | Registration in Supervisor for landlord portfolio queries and PM oversight routing | Supervisor handoff registration pattern from supervisorAgent.ts |
| HPM-08 | Landlord-facing conversational interface for portfolio-level questions | Agent persona pattern; tools wrapping cross-domain queries |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @openai/agents | (installed) | Head of PM agent definition, tools, handoffs | Established in Phase 2 for all agents |
| zod4 | (alias) | Tool parameter schemas for Agents SDK | Required by @openai/agents, project uses npm alias |
| pg-boss | (installed) | Cron jobs for proactive monitoring and alerting | Established in Phases 2-8 for all scheduled agent work |
| express | 4.x | API routes for PM overview dashboard | Project standard |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| auditLogger | (internal) | Agent action audit trail | Logging all Head of PM actions |
| emailService | (internal) | Compliance alert emails to staff | Proactive alerting |
| MessageSender | (internal) | Multi-channel landlord notifications | Portfolio updates to landlords |
| dealEventBus | (internal) | Lifecycle event subscription | Tenancy renewal, lease expiry triggers |
| costLedgerRoutes | (internal) | Cost data queries | Cross-domain financial visibility |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Single supervisory agent | Multiple micro-supervisor agents per domain | Single agent is simpler, avoids extra handoff layers, and this project has 4 PM specialists -- a single Head of PM can manage all |
| pg-boss cron for monitoring | Real-time event-driven monitoring only | Cron is simpler and sufficient for daily/weekly compliance checks; real-time is overkill for expiry monitoring |

**Installation:**
No new npm packages needed. Everything required is already installed.

## Architecture Patterns

### Recommended Project Structure
```
server/
  agents/sdk/
    headOfPMAgent.ts          # Head of PM agent definition + unique tools
    supervisorAgent.ts        # Add Head of PM handoff (modify)
  services/
    portfolioMonitorService.ts  # Proactive monitoring: compliance, renewals, health
  pmOverviewRoutes.ts           # Staff-facing PM overview API endpoints
```

### Pattern 1: Supervisory Agent with Specialist Handoffs
**What:** The Head of PM agent has handoff access to Morgan, Sarah, Sam, and Taylor, so it can delegate operational tasks while retaining conversational control for portfolio-level discussions.
**When to use:** When a landlord asks a portfolio question that spans multiple domains (e.g., "How are my properties doing?") -- the Head of PM answers from aggregated data and can hand off to a specialist for operational follow-up.
**Example:**
```typescript
// server/agents/sdk/headOfPMAgent.ts
import { Agent, handoff } from '@openai/agents';
import type { AgentContext } from './context';
import { pmAgent } from './pmAgent';
import { arrearsAgent } from './arrearsAgent';
import { adminAgent } from './adminAgent';
// Taylor import from Phase 8
// import { financeAgent } from './financeAgent';

const HEAD_OF_PM_INSTRUCTIONS = `You are Jamie, the Head of Property Management at John Barclay Estate Agents...`;

export const headOfPMAgent = new Agent<AgentContext>({
  name: 'Jamie from Property Management',
  model: 'gpt-4o',
  instructions: HEAD_OF_PM_INSTRUCTIONS,
  tools: [
    queryPortfolioOverviewTool,
    queryPropertyHealthTool,
    queryComplianceStatusTool,
    queryMaintenanceActivityTool,
    queryArrearsOverviewTool,
    queryFinancialSummaryTool,
    queryTenancyTimelineTool,
    escalateToHumanTool,
  ],
  handoffs: [
    handoff(pmAgent, {
      toolNameOverride: 'delegate_to_maintenance',
      toolDescription: 'Delegate to Morgan for a specific maintenance fault, repair, or work order task',
    }),
    handoff(arrearsAgent, {
      toolNameOverride: 'delegate_to_arrears',
      toolDescription: 'Delegate to Sarah for a specific arrears case or rent chasing task',
    }),
    handoff(adminAgent, {
      toolNameOverride: 'delegate_to_admin',
      toolDescription: 'Delegate to Sam for a specific document, checklist, or tenancy paperwork task',
    }),
    // handoff(financeAgent, { ... }) -- from Phase 8
  ],
});
```

### Pattern 2: Supervisor Registration (Two-Level Routing)
**What:** The Supervisor routes to the Head of PM for portfolio/oversight queries; the Head of PM then either answers directly or delegates to a specialist.
**When to use:** Inbound messages about landlord portfolios, PM oversight, property health, compliance status.
**Key consideration:** The existing Supervisor already routes directly to Morgan for maintenance faults. This must NOT change -- Morgan handles operational fault intake directly. The Head of PM handles strategic/portfolio queries.
**Example:**
```typescript
// In supervisorAgent.ts, add to handoffs array:
handoff(headOfPMAgent, {
  toolNameOverride: 'transfer_to_head_of_pm',
  toolDescription: 'Transfer to Head of Property Management for portfolio overviews, compliance questions, property health reports, landlord portfolio queries, multi-property questions, and any strategic PM query that spans maintenance, arrears, and finance',
}),
// KEEP existing transfer_to_property_management for Morgan (operational faults)
```

### Pattern 3: Cross-Domain Query Tools
**What:** Tools that query across maintenance, compliance, arrears, and finance data in a single call to give the Head of PM agent holistic property/portfolio views.
**When to use:** Portfolio overview conversations with landlords or staff.
**Example:**
```typescript
export const queryPropertyHealthTool = tool({
  name: 'query_property_health',
  description: 'Get a comprehensive health report for a property: compliance status, active maintenance tickets, arrears, financial summary, tenancy timeline.',
  parameters: z4.object({
    propertyId: z4.number().describe('The property ID to check'),
  }),
  execute: async (_context: AgentContext, input: { propertyId: number }) => {
    const { pool } = await import('../../db');

    const [compliance, maintenance, arrears, tenancy] = await Promise.all([
      pool.query(`
        SELECT certification_type, expiry_date, status,
          CASE WHEN expiry_date < CURRENT_DATE THEN 'expired'
               WHEN expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
               ELSE 'valid' END as health
        FROM property_certification WHERE property_id = $1
        ORDER BY expiry_date ASC`, [input.propertyId]),
      pool.query(`
        SELECT id, title, status, priority, created_at
        FROM maintenance_request WHERE property_id = $1 AND status NOT IN ('completed', 'cancelled')
        ORDER BY created_at DESC LIMIT 10`, [input.propertyId]),
      pool.query(`
        SELECT a.id, a.amount_outstanding, a.status, t.name as tenant_name
        FROM arrears a JOIN tenant t ON a.tenant_id = t.id
        WHERE a.property_id = $1 AND a.status = 'active'`, [input.propertyId]),
      pool.query(`
        SELECT id, status, start_date, end_date, rent_amount
        FROM tenancy WHERE property_id = $1 AND status IN ('active', 'pending')
        ORDER BY start_date DESC LIMIT 1`, [input.propertyId]),
    ]);

    return JSON.stringify({
      compliance: compliance.rows,
      activeMaintenanceTickets: maintenance.rows,
      activeArrears: arrears.rows,
      currentTenancy: tenancy.rows[0] || null,
    });
  },
});
```

### Pattern 4: pg-boss Cron for Proactive Monitoring
**What:** Daily/weekly scheduled jobs that scan for compliance issues, upcoming renewals, and portfolio anomalies, then alert staff via email/notification.
**When to use:** Proactive alerting without waiting for someone to ask.
**Example:**
```typescript
// server/services/portfolioMonitorService.ts
export async function registerPortfolioMonitorJobs() {
  const b = await getBoss();

  // Daily: check for expiring certifications (30-day window)
  await b.schedule('pm:compliance-check', '0 8 * * *', {});
  // Weekly: portfolio health summary for PM team
  await b.schedule('pm:weekly-health-report', '0 9 * * 1', {});

  b.work('pm:compliance-check', async (job) => {
    const expiring = await pool.query(`
      SELECT pc.*, p.address, l.name as landlord_name, l.email as landlord_email
      FROM property_certification pc
      JOIN properties p ON pc.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE pc.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND pc.status != 'renewed'
      ORDER BY pc.expiry_date ASC`);

    if (expiring.rows.length > 0) {
      // Send alert email to PM staff
      await emailService.sendEmail(
        staffEmail,
        `Compliance Alert: ${expiring.rows.length} certifications expiring within 30 days`,
        formatComplianceAlertHtml(expiring.rows)
      );
    }
  });
}
```

### Anti-Patterns to Avoid
- **Replacing the Supervisor:** The Head of PM is NOT a replacement for the existing Supervisor. It is a SPECIALIST that the Supervisor routes to -- similar to how Morgan is a specialist. The Supervisor remains the top-level router.
- **Intercepting Morgan's direct routing:** Tenants reporting faults should STILL route directly to Morgan via the Supervisor. Do NOT force all PM traffic through the Head of PM -- that adds latency for simple fault reports.
- **Duplicating specialist logic:** The Head of PM should NEVER implement maintenance triage, arrears compliance, or invoice generation. It delegates to specialists and queries their data.
- **Eager pg-boss initialization:** Always use lazy init pattern to avoid DB connection at module load.
- **One mega-query for everything:** Use parallel Promise.all for independent queries rather than one massive JOIN query. Matches the established pattern in pmWorkflowRoutes.ts.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Compliance expiry detection | Custom date scanning service | SQL query against property_certification table + pg-boss cron | Data already exists, just needs scheduling |
| Cross-domain data aggregation | Custom data warehouse | Raw SQL queries against existing tables with Promise.all | All data lives in the same PostgreSQL database already |
| Agent delegation | Custom task routing | OpenAI Agents SDK handoff() mechanism | Established pattern, handles conversation context transfer |
| Staff alerting | Custom notification system | emailService + notification table (Phase 6) | Both already exist and are used across the codebase |
| Audit logging | Custom logging | auditLogger middleware | Established across all agents |
| Tenancy lifecycle events | Custom event polling | DealEventBus (Phase 6) | pg-boss-backed event system already handles tenancy.agreed, tenancy.ending, lease.renewal_due, rent.review_due |

**Key insight:** This phase is primarily an *orchestration* and *aggregation* layer. No new operational capabilities are added -- the Head of PM's value is in providing a unified view across existing data and delegating to existing specialists. The new work is: (1) the agent definition with cross-domain tools, (2) portfolio health query tools, (3) proactive monitoring cron jobs, and (4) a staff-facing PM overview API.

## Common Pitfalls

### Pitfall 1: Routing Confusion Between Head of PM and Morgan
**What goes wrong:** If the Supervisor doesn't have clear intent classification rules, a tenant reporting a boiler fault could be routed to the Head of PM instead of directly to Morgan, adding unnecessary latency.
**Why it happens:** "Property management" is ambiguous -- it could mean operational (fault report) or strategic (portfolio review).
**How to avoid:** Supervisor routing instructions must clearly differentiate:
- Morgan: fault reports, repairs, maintenance, work orders, contractor issues (operational, tenant-initiated)
- Head of PM: portfolio overview, compliance status, property health, multi-property queries, landlord portfolio questions (strategic, typically landlord/staff-initiated)
**Warning signs:** Tenants being asked portfolio-level questions when they just want a boiler fixed.

### Pitfall 2: Circular Handoff Loops
**What goes wrong:** The Supervisor hands off to Head of PM, who then hands off to Morgan, who might try to hand back to the Supervisor.
**Why it happens:** The SDK handoff mechanism transfers conversational control. If Morgan reaches a portfolio-level question, it might try to escalate back up.
**How to avoid:** Specialist agents (Morgan, Sarah, Sam, Taylor) should NOT have a handoff back to the Head of PM. They should escalate to human if they cannot handle something. The Head of PM delegates DOWN only.
**Warning signs:** Conversations bouncing between agents without resolution.

### Pitfall 3: Data Inconsistency Across Domains
**What goes wrong:** The Head of PM queries maintenance data and finance data separately, but the timestamps or statuses don't align (e.g., a work order shows "completed" but the cost hasn't appeared in the cost ledger yet).
**Why it happens:** Different domains update at different speeds. Work order completion triggers cost ledger updates asynchronously.
**How to avoid:** The Head of PM should present data with appropriate caveats: "Based on the latest available data..." and avoid making strong claims about real-time financial figures. Use consistent snapshot queries.
**Warning signs:** Landlord complaining that the numbers don't add up.

### Pitfall 4: Agent Name Collision
**What goes wrong:** Phase 8 introduced Taylor (finance). Earlier phases have Morgan, Sarah, Sam. If the Head of PM agent name conflicts with an existing name or is unclear.
**Why it happens:** Multiple agents need distinct identities.
**How to avoid:** Use a clearly distinct name. Recommendation: "Jamie" -- a British-sounding name that evokes management seniority. The agent introduces itself as "Jamie, Head of Property Management at John Barclay."
**Warning signs:** Contacts confused about who they're speaking to.

### Pitfall 5: Overloading the Agent with Too Many Tools
**What goes wrong:** Giving the Head of PM agent 20+ tools makes it slower and less accurate in tool selection.
**Why it happens:** The temptation to expose every possible query as a tool.
**How to avoid:** Keep tools at the aggregation level (portfolio overview, property health, compliance status) rather than granular operational level (individual ticket lookup, individual invoice lookup). For granular operations, delegate to the specialist via handoff.
**Warning signs:** Agent making wrong tool selections, increased latency, higher token usage.

### Pitfall 6: Sarah vs Chris Naming Confusion (Carried from Phase 8)
**What goes wrong:** CONTEXT.md for Phase 8 refers to the arrears agent as "Chris" but the implementation names them "Sarah from Accounts". The Head of PM instructions must use the correct name.
**Why it happens:** Design document used different name from implementation.
**How to avoid:** Always reference "Sarah from Accounts" for the arrears agent in the Head of PM's instructions.
**Warning signs:** Jamie telling a landlord to "speak with Chris" when no Chris agent exists.

## Code Examples

### Head of PM Agent Definition
```typescript
// server/agents/sdk/headOfPMAgent.ts
import { Agent, handoff, tool } from '@openai/agents';
import { z as z4 } from 'zod4';
import type { AgentContext } from './context';
import { pmAgent } from './pmAgent';
import { arrearsAgent } from './arrearsAgent';
import { adminAgent } from './adminAgent';
import { escalateToHumanTool } from './tools';
// import { financeAgent } from './financeAgent'; // Phase 8

const HEAD_OF_PM_INSTRUCTIONS = `You are Jamie, Head of Property Management at John Barclay Estate Agents, a prestigious London estate agency.

ROLE:
You oversee all property management operations. You are the go-to person for landlords who want to understand how their properties are performing, for staff who need a cross-domain PM view, and for anyone with strategic PM questions that span maintenance, compliance, finance, and tenancy administration.

You do NOT handle operational tasks directly. You have a team of specialists:
- Morgan handles maintenance faults, repairs, and work orders
- Sarah handles rent arrears conversations and payment chasing
- Sam handles tenancy documents, onboarding, and offboarding checklists
- Taylor handles invoicing, landlord statements, and finance queries

When a question is clearly operational (a specific fault report, a specific arrears case, a specific document request), delegate to the appropriate specialist. When it is strategic (portfolio overview, compliance status, property health, multi-property comparisons), answer it yourself using your portfolio tools.

TONE AND STYLE:
- Senior, authoritative but approachable -- like a competent department head
- No emoji whatsoever
- British English throughout
- Concise on SMS, detailed on WhatsApp and email
- When presenting data, use clear formatting with numbers

WORKFLOW:
1. For landlord portfolio queries: use query tools to gather data, present a clear summary
2. For specific property health: use query_property_health for a comprehensive view
3. For compliance questions: use query_compliance_status
4. For maintenance activity: use query_maintenance_activity
5. For financial summary: use query_financial_summary
6. When a landlord wants to take action (report a fault, chase arrears, request a document): delegate to the appropriate specialist
7. When you cannot answer confidently: escalate to human

ESCALATION TRIGGERS (use escalate_to_human tool):
- Legal questions
- Complaints about the agency
- Requests for rent reductions or fee negotiations
- Contact explicitly asks for a human
- Three or more unresolved exchanges
- You are not confident in the response`;

export const headOfPMAgent = new Agent<AgentContext>({
  name: 'Jamie from Property Management',
  model: 'gpt-4o',
  instructions: HEAD_OF_PM_INSTRUCTIONS,
  tools: [
    queryPortfolioOverviewTool,
    queryPropertyHealthTool,
    queryComplianceStatusTool,
    queryMaintenanceActivityTool,
    queryArrearsOverviewTool,
    queryTenancyTimelineTool,
    escalateToHumanTool,
  ],
  handoffs: [
    handoff(pmAgent, {
      toolNameOverride: 'delegate_to_maintenance',
      toolDescription: 'Delegate to Morgan for a specific maintenance fault, repair, or work order task',
    }),
    handoff(arrearsAgent, {
      toolNameOverride: 'delegate_to_arrears',
      toolDescription: 'Delegate to Sarah for a specific arrears case or rent chasing task',
    }),
    handoff(adminAgent, {
      toolNameOverride: 'delegate_to_admin',
      toolDescription: 'Delegate to Sam for a specific document, checklist, or tenancy paperwork task',
    }),
    // handoff(financeAgent, { ... }) -- Phase 8's Taylor
  ],
});
```

### Portfolio Overview Tool (Landlord-Scoped)
```typescript
export const queryPortfolioOverviewTool = tool({
  name: 'query_portfolio_overview',
  description: 'Get a portfolio overview for a landlord: all their properties with compliance, maintenance, arrears, and tenancy status summaries.',
  parameters: z4.object({
    landlordId: z4.number().describe('The landlord ID'),
  }),
  execute: async (_context: AgentContext, input: { landlordId: number }) => {
    const { pool } = await import('../../db');

    const [properties, compliance, maintenance, arrears, tenancies] = await Promise.all([
      pool.query(`
        SELECT id, address, postcode, status, is_managed
        FROM properties WHERE landlord_id = $1 AND is_managed = true
        ORDER BY address`, [input.landlordId]),
      pool.query(`
        SELECT pc.property_id, pc.certification_type, pc.expiry_date,
          CASE WHEN pc.expiry_date < CURRENT_DATE THEN 'expired'
               WHEN pc.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
               ELSE 'valid' END as health
        FROM property_certification pc
        JOIN properties p ON pc.property_id = p.id
        WHERE p.landlord_id = $1`, [input.landlordId]),
      pool.query(`
        SELECT mr.property_id, COUNT(*)::int as open_tickets
        FROM maintenance_request mr
        JOIN properties p ON mr.property_id = p.id
        WHERE p.landlord_id = $1 AND mr.status NOT IN ('completed', 'cancelled')
        GROUP BY mr.property_id`, [input.landlordId]),
      pool.query(`
        SELECT a.property_id, COUNT(*)::int as active_cases,
               COALESCE(SUM(a.amount_outstanding), 0)::numeric as total_outstanding
        FROM arrears a
        JOIN properties p ON a.property_id = p.id
        WHERE p.landlord_id = $1 AND a.status = 'active'
        GROUP BY a.property_id`, [input.landlordId]),
      pool.query(`
        SELECT t.property_id, t.status, t.start_date, t.end_date, t.rent_amount,
               te.name as tenant_name
        FROM tenancy t
        JOIN properties p ON t.property_id = p.id
        LEFT JOIN tenant te ON t.tenant_id = te.id
        WHERE p.landlord_id = $1 AND t.status IN ('active', 'pending')
        ORDER BY t.property_id`, [input.landlordId]),
    ]);

    return JSON.stringify({
      propertyCount: properties.rows.length,
      properties: properties.rows,
      complianceByProperty: compliance.rows,
      maintenanceByProperty: maintenance.rows,
      arrearsByProperty: arrears.rows,
      tenancies: tenancies.rows,
    });
  },
});
```

### Supervisor Registration
```typescript
// In supervisorAgent.ts, add to SUPERVISOR_INSTRUCTIONS:
// - Jamie, Head of Property Management, handles portfolio overviews, compliance status, property health reports, multi-property landlord queries, and strategic PM questions.

// Add to handoffs array:
handoff(headOfPMAgent, {
  toolNameOverride: 'transfer_to_head_of_pm',
  toolDescription: 'Transfer to Head of Property Management for portfolio overviews, compliance questions, property health reports, landlord portfolio queries, multi-property questions, and any strategic PM query that spans maintenance, arrears, and finance',
}),
```

### Proactive Compliance Monitor
```typescript
// server/services/portfolioMonitorService.ts
import PgBoss from 'pg-boss';
import { pool } from '../db';
import { emailService } from '../emailService';

let boss: PgBoss | null = null;
async function getBoss() {
  if (!boss) {
    boss = new PgBoss(process.env.DATABASE_URL || '');
    await boss.start();
  }
  return boss;
}

export async function registerPortfolioMonitorJobs() {
  const b = await getBoss();

  await b.schedule('pm:daily-compliance-check', '0 8 * * *', {});

  b.work('pm:daily-compliance-check', async () => {
    // Find certifications expiring within 30 days
    const result = await pool.query(`
      SELECT pc.id, pc.certification_type, pc.expiry_date,
             p.address, p.id as property_id,
             l.name as landlord_name, l.email as landlord_email
      FROM property_certification pc
      JOIN properties p ON pc.property_id = p.id
      LEFT JOIN landlords l ON p.landlord_id = l.id
      WHERE pc.expiry_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
        AND pc.status NOT IN ('renewed', 'superseded')
      ORDER BY pc.expiry_date ASC`);

    if (result.rows.length > 0) {
      // Group by urgency
      const expired = result.rows.filter((r: any) => new Date(r.expiry_date) < new Date());
      const expiringSoon = result.rows.filter((r: any) => new Date(r.expiry_date) >= new Date());

      // Email PM staff
      // ... format and send alert
    }
  });
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Separate specialist agents with no coordination layer | Head of PM agent orchestrates across domains | Phase 9 | Landlords get unified portfolio view; staff get cross-domain alerting |
| Reactive compliance monitoring (manual checks) | Proactive daily compliance scanning via pg-boss cron | Phase 9 | Certifications never silently expire |
| Tenant contacts specialist directly for every query type | Supervisor routes strategic PM queries to Head of PM | Phase 9 | Better routing for portfolio-level questions |
| No portfolio-level conversational interface | Jamie answers landlord portfolio questions conversationally | Phase 9 | Landlords can ask "How are my properties doing?" and get a comprehensive answer |

## Open Questions

1. **Tenancy Renewal Automation**
   - What we know: The deal event bus already has `LEASE_RENEWAL_DUE` and `RENT_REVIEW_DUE` events. The `tenancyEventHooks.ts` file handles tenancy lifecycle hooks.
   - What's unclear: Should the Head of PM agent proactively initiate renewal conversations with landlords, or just alert staff? Full renewal negotiation (rent increase discussion, term changes) involves judgment.
   - Recommendation: Alert-only for v1. The Head of PM should flag renewals coming up within 90 days to staff via email and the notification system. Actual renewal negotiation stays with human staff.

2. **Landlord Identity Resolution for Portfolio Queries**
   - What we know: The contact_identity system resolves tenants by phone/email. Landlords are in the `landlords` table with name, email, phone.
   - What's unclear: How does the Head of PM identify which landlord is contacting them? Via contact_identity resolution (if landlord's phone matches), or explicit lookup?
   - Recommendation: Use the existing `lookup_tenant_property` pattern but create a `lookup_landlord_portfolio` tool that resolves by phone or email against the `landlords` table.

3. **Dashboard Scope**
   - What we know: The PM dashboard exists in `pmWorkflowRoutes.ts` with tenancy summary, rent collection, deposit protection, compliance, and arrears data.
   - What's unclear: Should Phase 9 create a separate "Head of PM" dashboard page, or enhance the existing PM dashboard with new widgets?
   - Recommendation: Enhance the existing PM dashboard with new widgets: compliance alert panel, portfolio health scores, agent activity summary. Do not create a separate page -- it fragments the PM user experience.

4. **Agent Activity Monitoring**
   - What we know: The audit_log table tracks all agent tool calls with timestamps, agent types, and outcomes.
   - What's unclear: Should the Head of PM provide real-time agent activity metrics (how many tickets Morgan handled today, Sarah's arrears resolution rate)?
   - Recommendation: Include a simple `query_agent_activity` tool that queries audit_log by agent type and date range. Expose in the PM overview API but keep it lightweight -- this is not a full analytics platform.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (already configured) |
| Config file | vitest.config.ts (or inline in package.json) |
| Quick run command | `npx vitest run server/__tests__/headOfPM.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| HPM-01 | Head of PM agent exports correctly with expected tools and handoffs | unit (static analysis) | `npx vitest run server/__tests__/headOfPM.test.ts -t "agent definition"` | No -- Wave 0 |
| HPM-02 | Handoffs to Morgan, Sarah, Sam, Taylor are defined | unit (static analysis) | `npx vitest run server/__tests__/headOfPM.test.ts -t "handoffs"` | No -- Wave 0 |
| HPM-03 | Portfolio query tools return correctly structured data | unit | `npx vitest run server/__tests__/headOfPM.test.ts -t "portfolio tools"` | No -- Wave 0 |
| HPM-04 | Compliance monitoring job identifies expiring certifications | unit | `npx vitest run server/__tests__/portfolioMonitor.test.ts -t "compliance check"` | No -- Wave 0 |
| HPM-05 | Portfolio health API returns per-property KPIs | unit | `npx vitest run server/__tests__/headOfPM.test.ts -t "health report"` | No -- Wave 0 |
| HPM-06 | PM overview API routes return correct response shapes | unit | `npx vitest run server/__tests__/headOfPM.test.ts -t "API routes"` | No -- Wave 0 |
| HPM-07 | Agent registered in Supervisor handoffs | unit (static analysis) | `npx vitest run server/__tests__/headOfPM.test.ts -t "supervisor registration"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run server/__tests__/headOfPM.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `server/__tests__/headOfPM.test.ts` -- covers HPM-01, HPM-02, HPM-03, HPM-05, HPM-06, HPM-07
- [ ] `server/__tests__/portfolioMonitor.test.ts` -- covers HPM-04 (compliance monitoring)
- [ ] No new framework install needed (Vitest already configured)

## Sources

### Primary (HIGH confidence)
- `server/agents/sdk/pmAgent.ts` -- Morgan agent definition pattern, tool imports, instructions
- `server/agents/sdk/arrearsAgent.ts` -- Sarah agent definition pattern (finance-adjacent)
- `server/agents/sdk/adminAgent.ts` -- Sam agent definition pattern
- `server/agents/sdk/supervisorAgent.ts` -- Supervisor handoff registration, routing instructions
- `server/agents/sdk/context.ts` -- AgentContext interface
- `server/agents/sdk/tools.ts` -- Tool wrapping pattern (wrapRegistryTool, lazy imports, zod4)
- `server/agents/sdk/runner.ts` -- Agent execution pipeline (runAgent)
- `server/agents/services/dealEventBus.ts` -- DEAL_EVENTS constants, event subscription pattern
- `server/agents/services/tenancyEventHooks.ts` -- Fire-and-forget event hook pattern
- `server/agents/services/workOrderFollowup.ts` -- pg-boss lazy init, cron job registration pattern
- `server/pmWorkflowRoutes.ts` -- PM dashboard summary queries (Promise.all pattern)
- `server/costLedgerRoutes.ts` -- Cost aggregation query patterns
- `server/agents/middleware/auditLogger.ts` -- Audit logging for agent actions
- `.planning/phases/08-pm-finance-agent-landlord-statements-tenant-invoices/08-RESEARCH.md` -- Phase 8 Taylor agent context
- `shared/schema.ts` -- property_certification, maintenance_request, arrears, tenancy tables

### Secondary (MEDIUM confidence)
- OpenAI Agents SDK handoff() mechanism -- agent-to-agent conversation transfer
- pg-boss schedule/work API -- cron expression format

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and used in codebase
- Architecture: HIGH -- follows exact patterns from Phases 2-8 (agent definition, Supervisor handoff, pg-boss cron, raw SQL)
- Pitfalls: HIGH -- identified from direct codebase analysis (routing confusion, circular handoffs, naming issues)

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable -- all dependencies already locked in project)
