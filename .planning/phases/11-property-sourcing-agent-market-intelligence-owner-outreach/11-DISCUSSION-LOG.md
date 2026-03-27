# Phase 11: Property Sourcing Agent — Market Intelligence & Owner Outreach - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-27
**Phase:** 11-property-sourcing-agent-market-intelligence-owner-outreach
**Areas discussed:** Intelligence sources, Outreach strategy, Agent identity & persona, Sourcing dashboard

---

## Intelligence Sources

### Which market intelligence sources should the agent actively monitor?

| Option | Description | Selected |
|--------|-------------|----------|
| Full suite | All sources: Land Registry, portal stale listings, auction results, planning applications, competitor listing expirations | ✓ |
| Portal-focused | Mainly stale listings on portals + Land Registry. Skip auction monitoring and planning applications | |
| Land Registry + Portals | Just the two core sources: recent transactions and stale listings | |

**User's choice:** Full suite (Recommended)
**Notes:** None

### How should stale listings be defined?

| Option | Description | Selected |
|--------|-------------|----------|
| 90+ days (current) | Properties listed 90+ days are flagged as stale — existing threshold in LeadGenerationService | ✓ |
| 60+ days | More aggressive — catch vendors earlier | |
| You decide | Claude picks sensible default, configurable by staff | |

**User's choice:** 90+ days (current)
**Notes:** None

### Should the agent use propensity scoring to prioritise leads?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, AI-scored | Use OpenAI to generate propensity scores from multiple signals | ✓ |
| Simple rule-based | Score based on fixed rules, no AI scoring | |
| You decide | Claude picks approach based on existing architecture | |

**User's choice:** Yes, AI-scored (Recommended)
**Notes:** None

---

## Outreach Strategy

### Should outreach be automatic or staff-approved before sending?

| Option | Description | Selected |
|--------|-------------|----------|
| Staff-approved | Agent identifies and drafts, staff reviews and clicks 'Send' | ✓ |
| Auto for low-risk, approve high-value | Stale listing letters auto, high-value requires sign-off | |
| Fully automatic | Agent sends autonomously based on scoring thresholds | |

**User's choice:** Staff-approved (Recommended)
**Notes:** None

### What outreach channels should the agent use?

| Option | Description | Selected |
|--------|-------------|----------|
| Letter + email | Physical letter plus follow-up email | ✓ |
| Email only | Email outreach only | |
| Multi-channel | Letters, email, SMS, and phone calls | |

**User's choice:** Letter + email (Recommended)
**Notes:** None

### Should the agent generate different outreach templates based on lead source?

| Option | Description | Selected |
|--------|-------------|----------|
| Source-specific templates | AI generates tailored outreach per lead source | ✓ |
| One generic template | Single professional template for all scenarios | |
| You decide | Claude picks template strategy | |

**User's choice:** Source-specific templates (Recommended)
**Notes:** None

### Should the agent handle follow-up sequences?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, automated sequence | Multi-touch cadence, each touchpoint staff-approved, auto-queued | ✓ |
| Single touch only | One outreach attempt per lead | |
| You decide | Claude determines cadence | |

**User's choice:** Yes, automated sequence (Recommended)
**Notes:** None

---

## Agent Identity & Persona

### What should the Property Sourcing agent be named and what personality should it have?

| Option | Description | Selected |
|--------|-------------|----------|
| Charlie — The Networker | Proactive, market-savvy, persuasive but not pushy | ✓ |
| Reese — The Analyst | Data-driven, methodical, presents market evidence | |
| You decide | Claude picks name and personality | |

**User's choice:** Charlie — The Networker (Recommended)
**Notes:** None

### How should Charlie fit into the agent hierarchy?

| Option | Description | Selected |
|--------|-------------|----------|
| Autonomous + Supervisor-routed | Cron-based monitoring AND Supervisor-routed inbound responses | ✓ |
| Fully autonomous only | Background intelligence engine, not conversational | |
| You decide | Claude determines integration | |

**User's choice:** Autonomous + Supervisor-routed (Recommended)
**Notes:** None

### Should Charlie hand off to Sales/Lettings once an owner shows interest?

| Option | Description | Selected |
|--------|-------------|----------|
| Charlie to valuation, then handoff | Handles through valuation booking, then Alex/Jordan takes over | ✓ |
| Immediate handoff on interest | Creates lead, Sales/Lettings takes over immediately | |
| Charlie handles everything | Full lifecycle, no handoff | |

**User's choice:** Charlie to valuation, then handoff (Recommended)
**Notes:** None

---

## Sourcing Dashboard

### What should the sourcing dashboard prioritise showing staff?

| Option | Description | Selected |
|--------|-------------|----------|
| Pipeline + approvals | Lead pipeline view with approval workflow as primary interaction | ✓ |
| Market intelligence view | Map view of opportunities, market heat indicators | |
| Kanban board | Drag-and-drop kanban of sourced leads | |

**User's choice:** Pipeline + approvals (Recommended)
**Notes:** None

### Should the dashboard include campaign management configuration?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, full config UI | Staff create/edit monitoring campaigns with target postcodes, price ranges, etc. | ✓ |
| Basic settings only | Simple on/off toggles and postcode list | |
| You decide | Claude determines configurability level | |

**User's choice:** Yes, full config UI (Recommended)
**Notes:** None

### Should the dashboard show performance metrics?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, key metrics | Summary stats with breakdown by source | ✓ |
| Minimal stats | Just counts: total leads, sent, responded | |
| You decide | Claude picks sensible metrics | |

**User's choice:** Yes, key metrics (Recommended)
**Notes:** None

---

## Claude's Discretion

- Exact cron scheduling for monitoring scans
- Letter template design and PDF generation approach
- Follow-up cadence timing (exact day intervals)
- Propensity scoring model prompt engineering
- Dashboard layout and component choices
- How to handle duplicate leads across sources

## Deferred Ideas

None — discussion stayed within phase scope
