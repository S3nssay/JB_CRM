---
phase: 03-voice-integration
plan: 03
subsystem: voice, messaging
tags: [vapi, voice, transcript, conversation-store, escalation, pg-boss, sms, whatsapp]

# Dependency graph
requires:
  - phase: 03-01
    provides: Vapi provider adapter, squad config, voice types
  - phase: 03-02
    provides: Vapi webhook router, context loader, activeCallContexts
  - phase: 02-01
    provides: ChannelGateway, ConversationStore, ContactResolver, MessageSender
  - phase: 02-04
    provides: EscalationService, handlePostActions pattern
provides:
  - Voice call transcript threading into ConversationStore
  - VoiceAdapter for phone channel in ChannelGateway
  - Post-call SMS/WhatsApp summary to known callers
  - Call transfer detection and escalation records
  - Follow-up scheduling for voice-booked viewings via pg-boss
affects: [04-dashboard-integration, 05-arrears-chasing]

# Tech tracking
tech-stack:
  added: []
  patterns: [voice-transcript-threading, fire-and-forget-post-call-processing, transfer-detection-regex]

key-files:
  created:
    - server/agents/voice/callLifecycle.ts
    - server/agents/channels/adapters/voiceAdapter.ts
    - tests/voice/callLifecycle.test.ts
  modified:
    - server/agents/channels/gateway.ts
    - server/agents/voice/vapiWebhooks.ts

key-decisions:
  - "Transfer detection via endedReason field and transcript regex pattern matching"
  - "Post-call actions are fully fire-and-forget (async IIFE after webhook 200 response)"
  - "VoiceAdapter registered as 'phone' channel in ChannelGateway constructor"
  - "Unknown voice callers get contactId=0 placeholder (same pattern as text channels)"

patterns-established:
  - "Voice transcript threading: each turn stored as separate message with inbound/outbound direction"
  - "Post-call summary pattern: messageSender.sendPreferred + ConversationStore storage"
  - "Transfer detection: check endedReason + regex scan of assistant messages"

requirements-completed: [VOICE-01, VOICE-02, VOICE-03, VOICE-04]

# Metrics
duration: 7min
completed: 2026-03-20
---

# Phase 3 Plan 3: Call Lifecycle Summary

**Full call lifecycle handling: transcript threading in ConversationStore, post-call SMS/WhatsApp summaries, transfer escalation, and viewing follow-up scheduling via pg-boss**

## Performance

- **Duration:** 7 min
- **Started:** 2026-03-20T18:16:48Z
- **Completed:** 2026-03-20T18:24:04Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- Voice call transcripts threaded into ConversationStore (same table as WhatsApp/SMS/email), each turn stored as inbound/outbound message
- Post-call SMS/WhatsApp summary sent to callers with known phone numbers via messageSender.sendPreferred
- Human call transfers detected and escalation records created via EscalationService
- Viewing bookings and lead captures during voice calls schedule pg-boss follow-up jobs
- All post-call processing is async fire-and-forget (does not block Vapi webhook response)
- VoiceAdapter registered in ChannelGateway for 'phone' channel normalization
- 17 tests for call lifecycle, 201 total project tests pass with zero regressions

## Task Commits

Each task was committed atomically:

1. **Task 1: Voice adapter and end-of-call-report transcript threading** - `a8a60fd` (feat)
2. **Task 2: Post-call actions and webhook wiring** - `50abd47` (feat)

## Files Created/Modified
- `server/agents/voice/callLifecycle.ts` - processEndOfCallReport, sendPostCallSummary, processCallTransfer, triggerPostCallFollowUps
- `server/agents/channels/adapters/voiceAdapter.ts` - VoiceAdapter implementing ChannelAdapter for phone channel
- `server/agents/channels/gateway.ts` - Registered VoiceAdapter for 'phone' channel
- `server/agents/voice/vapiWebhooks.ts` - Wired end-of-call-report to callLifecycle functions (fire-and-forget)
- `tests/voice/callLifecycle.test.ts` - 17 unit tests covering transcript threading, post-call actions, escalation, follow-ups

## Decisions Made
- Transfer detection uses dual approach: check `endedReason === 'assistant-forwarded-call'` plus regex scan of assistant messages for "transferring you" patterns
- Post-call actions are fully fire-and-forget via async IIFE after sending webhook 200 response (same pattern as text channel webhooks)
- VoiceAdapter registered as 'phone' channel in ChannelGateway constructor (alongside sms, whatsapp, email)
- Unknown voice callers get contactId=0 placeholder identity (consistent with text channel unknown sender pattern)
- Post-call summary uses report.analysis.summary when available, falls back to last assistant message

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Voice integration phase is now complete (all 3 plans: adapter, webhooks, lifecycle)
- Voice calls produce the same conversation/message records as text channels
- Ready for Phase 4 dashboard integration (voice conversations visible alongside text channels)
- Vapi UK telephony configuration still needs hands-on testing (existing blocker from Phase 3 planning)

---
*Phase: 03-voice-integration*
*Completed: 2026-03-20*
