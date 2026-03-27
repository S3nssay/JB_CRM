# Phase 11: Property Sourcing Agent — Validation Architecture

**Phase:** 11-property-sourcing-agent-market-intelligence-owner-outreach
**Created:** 2026-03-27

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

## Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | Plan |
|--------|----------|-----------|-------------------|------|
| SRC-01 | Monitor sources produce leads in proactive_leads table | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "monitors"` | 01 |
| SRC-02 | Stale listing threshold defaults to 90 days | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "stale"` | 01 |
| SRC-03 | Propensity scoring returns valid scores via OpenAI | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "propensity"` | 01 |
| SRC-04 | Outreach requires staff approval before sending | unit | `npx vitest run server/__tests__/sourcingApproval.test.ts -t "approval"` | 02 |
| SRC-05 | Letter PDF and email outreach channels work | unit | `npx vitest run server/__tests__/sourcingOutreach.test.ts -t "channels"` | 02 |
| SRC-06 | Source-specific templates generate tailored content | unit | `npx vitest run server/__tests__/sourcingOutreach.test.ts -t "templates"` | 02 |
| SRC-07 | Follow-up sequences advance through cadence steps | unit | `npx vitest run server/__tests__/sourcingFollowUp.test.ts -t "sequence"` | 02 |
| SRC-08 | Charlie agent has correct identity and personality | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "identity"` | 01 |
| SRC-09 | Cron jobs register and fire for daily scan + follow-ups | unit | `npx vitest run server/__tests__/sourcingCronJobs.test.ts` | 01 |
| SRC-10 | Valuation booked emits deal pipeline event for handoff | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "handoff"` | 01 |
| SRC-11 | Agent registers with Supervisor and Orchestrator | unit | `npx vitest run server/__tests__/sourcingAgent.test.ts -t "registration"` | 01 |
| SRC-12 | Dashboard API returns pipeline leads grouped by stage | integration | `npx vitest run server/__tests__/sourcingRoutes.test.ts -t "pipeline"` | 03 |
| SRC-13 | Campaign CRUD endpoints manage monitoring configs | integration | `npx vitest run server/__tests__/sourcingRoutes.test.ts -t "campaign"` | 03 |
| SRC-14 | Metrics endpoint returns per-source performance data | integration | `npx vitest run server/__tests__/sourcingRoutes.test.ts -t "metrics"` | 03 |

## Sampling Rate

- **Per task commit:** `npx vitest run server/__tests__/sourcingAgent.test.ts --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

## Wave 0 Test Stubs

| File | Plan | Covers |
|------|------|--------|
| `server/__tests__/sourcingAgent.test.ts` | 01 | SRC-01, SRC-02, SRC-03, SRC-08, SRC-09, SRC-10, SRC-11 |
| `server/__tests__/sourcingApproval.test.ts` | 02 | SRC-04 |
| `server/__tests__/sourcingOutreach.test.ts` | 02 | SRC-05, SRC-06 |
| `server/__tests__/sourcingFollowUp.test.ts` | 02 | SRC-07 |
| `server/__tests__/sourcingCronJobs.test.ts` | 01 | SRC-09 |
| `server/__tests__/sourcingRoutes.test.ts` | 03 | SRC-12, SRC-13, SRC-14 |
