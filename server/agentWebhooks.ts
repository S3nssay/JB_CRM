/**
 * Agent Webhook Routes
 *
 * Receives inbound messages from WhatsApp, SMS, and email channels.
 * Returns 200 immediately (Twilio timeout protection), then processes
 * asynchronously through the agent pipeline.
 *
 * Flow: webhook -> ChannelGateway -> runAgent(Supervisor) -> messageSender
 */

import { Router, type Request, type Response } from 'express';
import { channelGateway } from './agents/channels/gateway';
import { runAgent } from './agents/sdk/runner';
import { supervisorAgent } from './agents/sdk/supervisorAgent';
import { messageSender } from './agents/services/messageSender';
import type { CommunicationChannel } from './agents/types';

const router = Router();

// Per-conversation processing lock to prevent race conditions (Pitfall 6)
const processingLocks = new Map<number, Promise<void>>();

// STOP keywords for UK PECR compliance
const STOP_KEYWORDS = new Set(['stop', 'unsubscribe', 'opt out', 'optout', 'cancel']);

function isStopKeyword(body: string): boolean {
  return STOP_KEYWORDS.has(body.trim().toLowerCase());
}

/**
 * Process an inbound message through the agent pipeline.
 * Runs asynchronously after returning 200 to the webhook caller.
 */
async function processInbound(
  channel: CommunicationChannel,
  payload: unknown,
  fromAddress: string,
  messageBody: string,
): Promise<void> {
  try {
    // Route through ChannelGateway (normalize, resolve contact, thread)
    const inbound = await channelGateway.processInbound(channel, payload);

    // Per-conversation locking
    const existingLock = processingLocks.get(inbound.conversationId);
    if (existingLock) {
      await existingLock;
    }

    const processingPromise = (async () => {
      try {
        // Run the Supervisor agent
        const response = await runAgent(supervisorAgent, messageBody, {
          conversationId: inbound.conversationId,
          contactId: inbound.contact.contactId,
          channel,
          isFirstMessage: inbound.isNewConversation,
          agentType: 'supervisor',
        });

        // Send reply via the same channel
        await messageSender.send(channel, fromAddress, response);
      } catch (err) {
        console.error(`[AgentWebhooks] Error processing ${channel} message:`, err);
      } finally {
        processingLocks.delete(inbound.conversationId);
      }
    })();

    processingLocks.set(inbound.conversationId, processingPromise);
    await processingPromise;
  } catch (err) {
    console.error(`[AgentWebhooks] Gateway processing failed for ${channel}:`, err);
  }
}

/**
 * POST /webhooks/whatsapp
 * Receives Twilio WhatsApp webhook callbacks.
 */
router.post('/webhooks/whatsapp', (req: Request, res: Response) => {
  // Return 200 immediately (Twilio 15s timeout protection)
  res.sendStatus(200);

  const body = req.body?.Body || '';
  const from = req.body?.From || '';

  // STOP keyword detection (UK PECR compliance)
  if (isStopKeyword(body)) {
    console.log(`[AgentWebhooks] STOP keyword received from ${from}, skipping agent processing`);
    return;
  }

  // Dedup check by MessageSid
  const messageSid = req.body?.MessageSid;
  if (!messageSid) {
    console.warn('[AgentWebhooks] WhatsApp webhook missing MessageSid');
    return;
  }

  // Strip whatsapp: prefix for reply address
  const replyTo = from.replace('whatsapp:', '');

  // Process async
  processInbound('whatsapp', req.body, replyTo, body).catch((err) => {
    console.error('[AgentWebhooks] WhatsApp async processing error:', err);
  });
});

/**
 * POST /webhooks/sms
 * Receives Twilio SMS webhook callbacks.
 */
router.post('/webhooks/sms', (req: Request, res: Response) => {
  res.sendStatus(200);

  const body = req.body?.Body || '';
  const from = req.body?.From || '';

  if (isStopKeyword(body)) {
    console.log(`[AgentWebhooks] STOP keyword received via SMS from ${from}`);
    return;
  }

  const messageSid = req.body?.MessageSid;
  if (!messageSid) {
    console.warn('[AgentWebhooks] SMS webhook missing MessageSid');
    return;
  }

  processInbound('sms', req.body, from, body).catch((err) => {
    console.error('[AgentWebhooks] SMS async processing error:', err);
  });
});

/**
 * POST /webhooks/email
 * Receives email webhook callbacks (for external integrations).
 */
router.post('/webhooks/email', (req: Request, res: Response) => {
  res.sendStatus(200);

  const from = req.body?.from || '';
  const body = req.body?.body || '';

  processInbound('email', req.body, from, body).catch((err) => {
    console.error('[AgentWebhooks] Email async processing error:', err);
  });
});

export default router;
