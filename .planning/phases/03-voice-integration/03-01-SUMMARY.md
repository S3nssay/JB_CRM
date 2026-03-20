---
phase: 03-voice-integration
plan: 01
subsystem: voice
tags: [vapi, voice, squad, twilio, eleven-labs, gpt-4o]

# Dependency graph
requires:
  - phase: 02-text-channel-agents
    provides: "Persona instructions for Sales/Lettings/Admin agents, tool definitions"
provides:
  - "Vapi webhook payload types (VapiServerMessage, VapiToolCallMessage, VapiEndOfCallReport)"
  - "Vapi assistant config types (VapiAssistantConfig, VapiSquadConfig, VapiCustomTool)"
  - "Configuration builders for 4-assistant voice squad (receptionist + 3 specialists)"
  - "CRM tool definitions in JSON Schema format for Vapi function calling"
affects: [03-02-webhook-handler, 03-03-call-lifecycle]

# Tech tracking
tech-stack:
  added: ["@vapi-ai/server-sdk"]
  patterns: ["Vapi Squad configuration with assistant handoffs", "JSON Schema tool definitions with filler speech messages", "Voice-adapted persona instructions from text agents"]

key-files:
  created:
    - server/agents/voice/types.ts
    - server/agents/voice/vapiConfig.ts
    - tests/voice/vapiConfig.test.ts
  modified:
    - package.json

key-decisions:
  - "gpt-4o-mini for receptionist (faster routing, no complex reasoning), gpt-4o for specialists (property matching needs reasoning)"
  - "ElevenLabs rachel voice for all assistants (consistent British female voice across squad)"
  - "Receptionist has no CRM tools -- only routes to specialists via squad handoff destinations"
  - "All CRM tools have filler speech messages (request-start) for natural call experience"

patterns-established:
  - "Voice config builders: pure functions returning Vapi API JSON, testable without API calls"
  - "Tool definitions use JSON Schema (not Zod) matching ToolRegistry input schemas"
  - "Persona instructions adapted from text agents with voice-specific rules (concise, conversational)"

requirements-completed: [VOICE-01, VOICE-02]

# Metrics
duration: 12min
completed: 2026-03-20
---

# Phase 03 Plan 01: Vapi Provider Adapter Summary

**Vapi squad configuration with Sarah receptionist routing to Alex/Jordan/Sam specialists, ElevenLabs voice, CRM tool definitions with filler speech, and transferCall human escalation**

## Performance

- **Duration:** 12 min
- **Started:** 2026-03-20T17:59:49Z
- **Completed:** 2026-03-20T18:12:45Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Vapi Squad configuration with 4 members: Sarah (receptionist) routes to Alex (Sales), Jordan (Lettings), Sam (Admin)
- All CRM tool definitions with JSON Schema parameters and filler speech messages for natural call experience
- Receptionist greeting includes AI self-identification per compliance requirements
- TransferCall tool on all assistants enables human escalation at any point
- 22 unit tests validating configuration structure, tool presence, and squad composition

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Vapi types and install @vapi-ai/server-sdk** - `2d2b038` (test)
2. **Task 2: Build Vapi configuration builders for assistants and squad** - `9d15826` (feat)

## Files Created/Modified
- `server/agents/voice/types.ts` - Complete Vapi type definitions (webhook payloads, config types, tool types)
- `server/agents/voice/vapiConfig.ts` - Configuration builders for all assistants and squad
- `tests/voice/vapiConfig.test.ts` - 22 unit tests for configuration validation
- `package.json` - Added @vapi-ai/server-sdk dependency

## Decisions Made
- Used gpt-4o-mini for receptionist (fast routing) and gpt-4o for specialists (reasoning needed for property matching)
- ElevenLabs rachel voice for all assistants -- consistent British female voice
- Receptionist has only transferCall tool; no CRM tools (routes via squad handoff)
- JSON Schema format for tool parameters (Vapi requirement, not Zod)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated existing types.ts rather than creating from scratch**
- **Found during:** Task 1
- **Issue:** A prior types.ts existed with a different structure (from earlier research/planning)
- **Fix:** Overwrote with complete type definitions matching plan requirements (added VapiCustomTool, VapiTransferCallTool, VapiModel, VapiVoice, etc.)
- **Files modified:** server/agents/voice/types.ts
- **Verification:** Tests import all types successfully
- **Committed in:** 2d2b038

**2. [Rule 3 - Blocking] Worked around Dropbox file locking during npm install**
- **Found during:** Task 1
- **Issue:** Dropbox sync locked files during npm install of @vapi-ai/server-sdk (EBUSY rename errors)
- **Fix:** Installed package in C:/tmp first, then copied node_modules/@vapi-ai to project directory
- **Files modified:** package.json, node_modules/
- **Verification:** Package available for import
- **Committed in:** 2d2b038

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary to proceed. No scope creep.

## Issues Encountered
- Dropbox file sync caused EBUSY errors during npm install. Worked around by installing in tmp directory and copying.

## User Setup Required
None - no external service configuration required. Vapi API key will be needed at runtime (VAPI_API_KEY env var) but is handled by existing env var pattern.

## Next Phase Readiness
- Voice types and configuration builders ready for webhook handler (03-02)
- Squad config can be used to register with Vapi API via the server SDK
- Tool definitions ready for webhook-based tool execution

---
*Phase: 03-voice-integration*
*Completed: 2026-03-20*
