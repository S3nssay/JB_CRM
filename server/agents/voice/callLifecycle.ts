/**
 * Call Lifecycle Handler
 *
 * Processes Vapi end-of-call-report webhooks:
 * - Stores full transcript in ConversationStore (threaded by contact identity)
 * - Sends post-call SMS/WhatsApp summary to known callers
 * - Detects human transfers and creates escalation records
 * - Schedules follow-up reminders for booked viewings
 */

import { contactResolver } from '../channels/contactResolver';
import { conversationStore } from '../channels/conversationStore';
import { messageSender } from '../services/messageSender';
import { escalationService } from '../services/escalationService';
import { auditLogger } from '../middleware/auditLogger';
import type { VapiEndOfCallReport } from './types';
import type { CallContext } from './vapiWebhooks';
import type { NormalizedMessage, ResolvedContact } from '../channels/types';

// ---- Helpers ----

function calculateDurationMs(startedAt?: string, endedAt?: string): number {
  if (!startedAt || !endedAt) return 0;
  const start = new Date(startedAt).getTime();
  const end = new Date(endedAt).getTime();
  return Math.max(0, end - start);
}

// ---- Transcript processing ----

export interface EndOfCallResult {
  conversationId: number;
  messageCount: number;
  callerIdentified: boolean;
}

/**
 * Process a Vapi end-of-call-report: resolve caller, store transcript, audit log.
 */
export async function processEndOfCallReport(
  report: VapiEndOfCallReport,
  storedContext?: CallContext | null,
): Promise<EndOfCallResult> {
  const callerPhone = report.call?.customer?.number;
  const transcriptMessages = (report.artifact?.messages ?? []).filter(
    (m) => m.role === 'user' || m.role === 'assistant',
  );
  const callId = report.call?.id;

  // Resolve caller identity
  let contact: ResolvedContact;
  let callerIdentified = false;

  if (storedContext) {
    // Use pre-loaded context from assistant-request phase
    contact = {
      contactIdentityId: storedContext.contactId,
      contactId: storedContext.contactId,
      contactType: storedContext.contactType,
      identifierValue: callerPhone || 'unknown-voice-caller',
    };
    callerIdentified = storedContext.contactId !== 0;
  } else if (callerPhone) {
    contact = await contactResolver.resolve(callerPhone, 'phone');
    callerIdentified = contact.contactId !== 0;
  } else {
    // Unknown caller -- use placeholder identity
    contact = {
      contactIdentityId: 0,
      contactId: 0,
      contactType: 'unknown',
      identifierValue: 'unknown-voice-caller',
    };
    callerIdentified = false;
  }

  // Find or create conversation
  const conversation = await conversationStore.findOrCreateConversation(contact, 'phone');
  const conversationId = conversation.id;

  // Store each transcript message
  const callStartTime = report.call?.startedAt ? new Date(report.call.startedAt).getTime() : Date.now();

  for (let i = 0; i < transcriptMessages.length; i++) {
    const msg = transcriptMessages[i];
    const direction: 'inbound' | 'outbound' = msg.role === 'user' ? 'inbound' : 'outbound';
    const agentType = msg.role === 'assistant' ? 'supervisor' : undefined;

    // Derive timestamp from message time or offset from call start
    const timestamp = msg.time
      ? new Date(callStartTime + msg.time)
      : new Date(callStartTime + i * 1000);

    const normalizedMsg: NormalizedMessage = {
      from: direction === 'inbound' ? (callerPhone || 'caller') : 'agent',
      body: msg.content,
      channel: 'phone',
      timestamp,
      metadata: { callId },
    };

    await conversationStore.storeMessage(conversationId, normalizedMsg, direction, agentType);
  }

  // Audit log
  await auditLogger.logResponse({
    agentType: 'supervisor',
    conversationId,
    channel: 'phone',
    durationMs: calculateDurationMs(report.call?.startedAt, report.call?.endedAt),
  });

  return {
    conversationId,
    messageCount: transcriptMessages.length,
    callerIdentified,
  };
}

// ---- Post-call summary ----

/**
 * Send a post-call SMS/WhatsApp summary to the caller.
 * Fire-and-forget: errors are caught and logged.
 */
export async function sendPostCallSummary(
  phone: string,
  report: VapiEndOfCallReport,
  conversationId: number,
): Promise<void> {
  try {
    // Build summary
    const summary =
      report.analysis?.summary ||
      report.artifact?.messages
        ?.filter((m) => m.role === 'assistant')
        .slice(-1)
        .map((m) => m.content)
        .join('') ||
      'your enquiry';

    const message = `Thanks for calling John Barclay Estate Agents. ${summary}. If you need anything else, reply to this message or call us back.`;

    await messageSender.sendPreferred(phone, message);

    // Store outbound summary in conversation
    const outboundMsg: NormalizedMessage = {
      from: 'agent',
      body: message,
      channel: 'phone',
      timestamp: new Date(),
      metadata: { type: 'post-call-summary' },
    };
    await conversationStore.storeMessage(conversationId, outboundMsg, 'outbound', 'supervisor');
  } catch (err) {
    console.error('[CallLifecycle] Failed to send post-call summary:', err);
    // Non-critical -- do not propagate
  }
}

// ---- Transfer detection and escalation ----

/**
 * Detect if the call was transferred to a human and create escalation record.
 */
export async function processCallTransfer(
  callId: string,
  conversationId: number,
  callerPhone: string,
  report: VapiEndOfCallReport,
): Promise<void> {
  try {
    // Detect transfer: check endedReason or transcript for transfer indicators
    const wasTransferred =
      report.endedReason === 'assistant-forwarded-call' ||
      (report.artifact?.messages ?? []).some(
        (m) =>
          m.role === 'assistant' &&
          /transferring you|transfer(?:ring)? (?:you|your call|to)/i.test(m.content),
      );

    if (!wasTransferred) return;

    await escalationService.escalate({
      conversationId,
      reason: 'Voice call transferred to human',
      urgency: 'normal',
      channel: 'phone',
      contactIdentifier: callerPhone,
    });

    console.log(`[CallLifecycle] Voice call escalation recorded for call ${callId}`);
  } catch (err) {
    console.error('[CallLifecycle] Failed to process call transfer:', err);
  }
}

// ---- Post-call follow-up scheduling ----

/**
 * Schedule follow-up actions for viewings/leads created during the call.
 * Uses lazy pg-boss import pattern from Phase 2.
 */
export async function triggerPostCallFollowUps(
  report: VapiEndOfCallReport,
  conversationId: number,
  callerPhone: string,
): Promise<void> {
  try {
    const messages = report.artifact?.messages ?? [];

    // Detect viewing bookings from assistant messages
    const hasViewingBooked = messages.some(
      (m) =>
        m.role === 'assistant' &&
        /\b(booked|confirmed|scheduled)\b.*\b(viewing|appointment|visit)\b/i.test(m.content),
    );

    if (hasViewingBooked && callerPhone) {
      // Schedule viewing reminder via pg-boss (lazy init)
      try {
        const PgBoss = (await import('pg-boss')).default;
        const boss = new PgBoss(process.env.DATABASE_URL || '');
        await boss.send(
          'voice-viewing-reminder',
          {
            conversationId,
            callerPhone,
            source: 'voice-call',
            callId: report.call?.id,
          },
          {
            startAfter: 60 * 60 * 24, // 24 hours
          },
        );
        console.log(`[CallLifecycle] Scheduled viewing reminder for ${callerPhone}`);
      } catch (err) {
        console.error('[CallLifecycle] Failed to schedule viewing reminder:', err);
      }
    }

    // Detect lead creation from assistant messages
    const hasLeadCreated = messages.some(
      (m) =>
        m.role === 'assistant' &&
        /\b(registered|created|noted)\b.*\b(interest|enquiry|details)\b/i.test(m.content),
    );

    if (hasLeadCreated && callerPhone) {
      try {
        const PgBoss = (await import('pg-boss')).default;
        const boss = new PgBoss(process.env.DATABASE_URL || '');
        await boss.send(
          'voice-lead-followup',
          {
            conversationId,
            callerPhone,
            source: 'voice-call',
            callId: report.call?.id,
          },
          {
            startAfter: 60 * 60 * 24, // 24 hours
          },
        );
        console.log(`[CallLifecycle] Scheduled lead follow-up for ${callerPhone}`);
      } catch (err) {
        console.error('[CallLifecycle] Failed to schedule lead follow-up:', err);
      }
    }
  } catch (err) {
    console.error('[CallLifecycle] Failed to trigger post-call follow-ups:', err);
  }
}
