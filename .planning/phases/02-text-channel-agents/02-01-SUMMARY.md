---
phase: 02-text-channel-agents
plan: 01
subsystem: agents
tags: [openai-agents-sdk, pg-boss, zod4, whatsapp, sms, email, escalation, round-robin, twilio]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: ToolRegistry, ChannelGateway, ConversationStore, AuditLogger, AIIdentification, SMS/WhatsApp adapters
provides:
  - SDK tool wrappers for all 5 Phase 1 tools + escalate_to_human
  - AgentContext type for SDK agents
  - runAgent executor with conversation history and AI identification
  - Supervisor agent with Sales/Lettings/Admin handoff stubs
  - MessageSender for unified outbound dispatch (WhatsApp/SMS/email)
  - EscalationService with round-robin staff assignment and 30-min follow-up
  - EmailAdapter for ChannelGateway
  - Webhook routes at /api/webhooks/{whatsapp,sms,email}
  - EmailProcessor routing enquiry emails through agent pipeline
affects: [02-text-channel-agents, 03-voice-agents]

# Tech tracking
tech-stack:
  added: ["@openai/agents@0.7.2", "pg-boss", "zod4 (zod v4 alias)"]
  patterns: ["SDK tool wrapping via wrapRegistryTool", "zod v4 alias for SDK compat alongside zod v3", "async webhook processing with per-conversation locking", "round-robin staff escalation with pg-boss follow-up"]

key-files:
  created:
    - server/agents/sdk/context.ts
    - server/agents/sdk/tools.ts
    - server/agents/sdk/runner.ts
    - server/agents/sdk/supervisorAgent.ts
    - server/agents/services/messageSender.ts
    - server/agents/services/escalationService.ts
    - server/agents/channels/adapters/emailAdapter.ts
    - server/agentWebhooks.ts
    - scripts/fix-zod-resolution.cjs
    - tests/agents/toolExecution.test.ts
    - tests/agents/escalation.test.ts
    - tests/agents/supervisorRouting.test.ts
  modified:
    - server/agents/channels/gateway.ts
    - server/services/email/emailProcessor.ts
    - server/routes.ts
    - package.json

key-decisions:
  - "Used zod4 npm alias (zod v4) for SDK tool parameters alongside existing zod v3 -- agents SDK requires zod v4 peer dep"
  - "Added postinstall script to fix zod resolution in zod-to-json-schema (agents SDK dependency chain issue)"
  - "Webhooks return 200 immediately and process asynchronously to prevent Twilio timeouts"
  - "Per-conversation Map-based locking to prevent race conditions on concurrent messages"
  - "STOP keyword detection at webhook level for UK PECR compliance"
  - "Round-robin escalation uses module-level Map counters per department"

patterns-established:
  - "SDK tool wrapping: use wrapRegistryTool(name, desc, z4Schema) to bridge Phase 1 tools to SDK"
  - "Agent execution: runAgent(agent, message, context) handles history, AI ID, storage, logging"
  - "Webhook pattern: return 200, process async, send reply via messageSender"

requirements-completed: [AGENT-01, AGENT-03, AGENT-07]

# Metrics
duration: 22min
completed: 2026-03-20
---

# Phase 02 Plan 01: SDK Foundation, Supervisor Agent, and Webhook Wiring Summary

**OpenAI Agents SDK integration with Supervisor triage agent, escalation service with round-robin staff assignment, and webhook wiring for WhatsApp/SMS/email channels**

## Performance

- **Duration:** 22 min
- **Started:** 2026-03-20T01:24:33Z
- **Completed:** 2026-03-20T01:47:00Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Installed @openai/agents SDK with zod v4 compatibility (alias approach for coexistence with zod v3)
- 6 SDK tool wrappers (5 Phase 1 tools + escalate_to_human) bridging ToolRegistry to OpenAI Agents SDK
- Supervisor agent classifies intent and routes to Sales, Lettings, or Admin specialist stubs with handoff
- EscalationService assigns staff round-robin from staffProfiles table, sends email notification, schedules 30-min pg-boss follow-up, reassigns on timeout, sends fallback message when all staff exhausted
- MessageSender unified dispatch: WhatsApp (Twilio), SMS (truncated to 320 chars), email (Nodemailer)
- Webhook routes at /api/webhooks/{whatsapp,sms,email} return 200 immediately, process async
- EmailProcessor routes enquiry-type emails (create_enquiry, create_viewing) through agent pipeline
- 22 passing unit tests across 3 test files

## Task Commits

Each task was committed atomically:

1. **Task 1: SDK tool wrappers, services, email adapter, IMAP wiring** - `258c15b` (feat)
2. **Task 2: Supervisor agent with handoff routing and webhook wiring** - `eb07ee0` (feat)

## Files Created/Modified

### Created
- `server/agents/sdk/context.ts` - AgentContext type definition
- `server/agents/sdk/tools.ts` - SDK tool wrappers for all 5 registry tools + escalate_to_human
- `server/agents/sdk/runner.ts` - Agent runner with history, AI identification, audit logging
- `server/agents/sdk/supervisorAgent.ts` - Supervisor agent with 3 handoff stubs
- `server/agents/services/messageSender.ts` - Unified outbound message dispatch
- `server/agents/services/escalationService.ts` - Round-robin staff escalation with pg-boss follow-up
- `server/agents/channels/adapters/emailAdapter.ts` - Email adapter for ChannelGateway
- `server/agentWebhooks.ts` - Webhook routes with async processing and STOP detection
- `scripts/fix-zod-resolution.cjs` - Postinstall fix for zod v4/v3 resolution conflict
- `tests/agents/toolExecution.test.ts` - 7 tests for SDK tool wrappers
- `tests/agents/escalation.test.ts` - 7 tests for escalation service and message sender
- `tests/agents/supervisorRouting.test.ts` - 9 tests for supervisor agent and runAgent

### Modified
- `server/agents/channels/gateway.ts` - Registered EmailAdapter
- `server/services/email/emailProcessor.ts` - Added agent pipeline routing for enquiry emails
- `server/routes.ts` - Mounted agentWebhooks router at /api
- `package.json` - Added @openai/agents, pg-boss, zod4, postinstall script

## Decisions Made
- Used `zod4` npm alias to install zod v4 alongside existing zod v3 (project-wide zod v3 cannot be upgraded without breaking all schema/tool definitions)
- Added `scripts/fix-zod-resolution.cjs` as postinstall hook to resolve transitive dependency conflict in `@openai/agents -> @modelcontextprotocol/sdk -> zod-to-json-schema` which requires `zod/v3` subpath only available in zod v4
- Webhooks return 200 immediately and process asynchronously to avoid Twilio 15-second timeout
- Per-conversation Map-based locking prevents concurrent messages from corrupting conversation state
- STOP keyword detection at webhook level before agent processing (UK PECR compliance)
- Supervisor agent uses `toolNameOverride` for handoff tool names (transfer_to_sales, etc.) for clarity

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed zod v4 / v3 compatibility for @openai/agents SDK**
- **Found during:** Task 1 (dependency installation)
- **Issue:** @openai/agents SDK requires zod v4 as peer dependency, but project uses zod v3. The SDK's dependency chain (`@modelcontextprotocol/sdk -> zod-to-json-schema@3.25`) tries to import `zod/v3` subpath which only exists in zod v4
- **Fix:** Installed `zod4` as npm alias for zod v4, created `scripts/fix-zod-resolution.cjs` postinstall script to copy zod v4 into `zod-to-json-schema/node_modules/` for correct resolution, used `zod4` import in SDK tool definitions
- **Files modified:** package.json, scripts/fix-zod-resolution.cjs, server/agents/sdk/tools.ts
- **Verification:** `require('@openai/agents')` loads successfully, all SDK functions (Agent, tool, run, handoff) available
- **Committed in:** 258c15b (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Essential for SDK to function. No scope creep.

## Issues Encountered
- zod v4/v3 incompatibility required dual-zod approach (documented above as deviation)
- pg-boss mock in tests required constructor pattern fix (mock returned function instead of class)

## User Setup Required
None - no external service configuration required. Twilio and email credentials use existing environment variables.

## Next Phase Readiness
- Supervisor agent and webhook routes ready for specialist agent implementation (Plans 02-04)
- Sales, Lettings, and Admin agent stubs exported and ready to be replaced
- runAgent, messageSender, and escalationService available for all specialist agents
- EmailProcessor wiring complete -- enquiry emails flow through agent pipeline

---
*Phase: 02-text-channel-agents*
*Completed: 2026-03-20*
