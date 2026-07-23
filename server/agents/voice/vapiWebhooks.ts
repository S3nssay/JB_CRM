/**
 * Vapi Webhook Router
 * Handles Vapi server URL webhook events: tool-calls, assistant-request,
 * end-of-call-report, hang, and other event types.
 *
 * Bridges Vapi's external voice AI platform to the CRM's internal Tool Registry.
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { toolRegistry } from '../tools/registry';
import type { ToolContext } from '../tools/types';
import type { AgentType } from '../types';
import type { VapiToolCallMessage, VapiToolCallResult } from './types';
import { loadCallerContext } from './contextLoader';
import {
  processEndOfCallReport,
  sendPostCallSummary,
  processCallTransfer,
  triggerPostCallFollowUps,
} from './callLifecycle';

// ---- Active call context cache ----
// Stores resolved caller context keyed by Vapi call ID.
// Populated on assistant-request, consumed on tool-calls, cleaned up on hang/end-of-call-report.
export interface CallContext {
  contactId: number;
  contactType: string;
  contactName: string | null;
  conversationId: number | null;
  recentSummary: string | null;
}

export const activeCallContexts = new Map<string, CallContext>();

// ---- Webhook authentication middleware ----

/**
 * Validates the x-vapi-secret header against VAPI_SERVER_SECRET env var.
 * If VAPI_SERVER_SECRET is not configured (dev mode), skips auth check.
 */
export function validateVapiSecret(req: Request, res: Response, next: NextFunction): void {
  const secret = process.env.VAPI_SERVER_SECRET;

  if (!secret) {
    // Dev mode: no secret configured, skip auth
    console.warn('[VapiWebhook] No VAPI_SERVER_SECRET configured - skipping auth (dev mode)');
    next();
    return;
  }

  const headerSecret = req.headers['x-vapi-secret'] as string | undefined;

  if (!headerSecret || headerSecret !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}

// ---- Agent type mapping ----

/**
 * Map assistant name prefix to CRM agent type.
 * Vapi assistant names follow pattern: "Sarah (Receptionist)", "Alex (Sales)", etc.
 */
function mapAssistantToAgentType(assistantName?: string): AgentType {
  if (!assistantName) return 'supervisor';
  const lower = assistantName.toLowerCase();
  if (lower.includes('sales') || lower.includes('alex')) return 'sales';
  if (lower.includes('letting') || lower.includes('rental') || lower.includes('jordan')) return 'rental';
  if (lower.includes('admin') || lower.includes('sam')) return 'office_admin';
  return 'supervisor';
}

// ---- Main webhook handler ----

/**
 * Handles all Vapi webhook events.
 * Exported for direct testing (used by tests without supertest).
 */
export async function handleVapiWebhook(req: Request, res: Response): Promise<void> {
  const message = req.body?.message;
  const messageType = message?.type;

  switch (messageType) {
    case 'tool-calls':
      await handleToolCalls(message, req, res);
      break;

    case 'assistant-request':
      await handleAssistantRequest(message, res);
      break;

    case 'end-of-call-report':
      handleEndOfCallReport(message, res);
      break;

    case 'hang':
      handleHang(message, res);
      break;

    default:
      // Graceful handling of unknown/future event types
      console.log(`[VapiWebhook] Unhandled event type: ${messageType}`);
      res.status(200).json({});
      break;
  }
}

// ---- Tool-calls handler ----

async function handleToolCalls(
  message: VapiToolCallMessage,
  req: Request,
  res: Response,
): Promise<void> {
  const toolCallList = message.toolCallList || [];
  const callId = message.call?.id;
  const customerNumber = message.call?.customer?.number;

  // Look up any stored context for this call
  const storedContext = callId ? activeCallContexts.get(callId) : undefined;

  const results: VapiToolCallResult['results'] = [];

  for (const toolCall of toolCallList) {
    const { id: toolCallId, function: fn } = toolCall;
    const toolName = fn.name;

    try {
      // Parse arguments from JSON string
      let parsedArgs: unknown;
      try {
        parsedArgs = JSON.parse(fn.arguments || '{}');
      } catch {
        parsedArgs = {};
      }

      // Check if tool exists
      if (!toolRegistry.hasTool(toolName)) {
        results.push({
          toolCallId,
          result: `Error: Unknown tool: ${toolName}`,
        });
        continue;
      }

      // Build tool context (includes caller phone for cross-channel tools)
      const context: ToolContext = {
        agentType: 'supervisor' as AgentType,
        conversationId: storedContext?.conversationId ?? null,
        contactId: storedContext?.contactId ?? null,
        channel: 'phone',
        metadata: {
          callerPhone: customerNumber,
          callId,
          contactName: storedContext?.contactName,
        },
      };

      // Execute tool via registry
      const invocationResult = await toolRegistry.invoke(toolName, parsedArgs, context);

      // Stringify result (Vapi requires string results)
      const resultStr = typeof invocationResult.output === 'string'
        ? invocationResult.output
        : JSON.stringify(invocationResult.output);

      results.push({ toolCallId, result: resultStr });
    } catch (err: any) {
      // Always return 200 with error as string result (Vapi requirement)
      results.push({
        toolCallId,
        result: `Error: ${err.message || 'Unknown error'}`,
      });
    }
  }

  // ALWAYS return 200 per Vapi requirement
  res.status(200).json({ results });
}

// ---- Assistant-request handler ----

async function handleAssistantRequest(message: any, res: Response): Promise<void> {
  const callId = message.call?.id;
  const customerNumber = message.call?.customer?.number;

  // Load and store context for known callers
  if (callId && customerNumber) {
    try {
      const callerContext = await loadCallerContext(customerNumber);
      if (callerContext) {
        activeCallContexts.set(callId, {
          contactId: callerContext.contactId,
          contactType: callerContext.contactType,
          contactName: callerContext.contactName,
          conversationId: callerContext.conversationId,
          recentSummary: callerContext.recentSummary,
        });
        console.log(`[VapiWebhook] Loaded context for call ${callId}: ${callerContext.contactName} (${callerContext.contactType})`);
      }
    } catch (err: any) {
      // Context loading failure is non-critical -- proceed without context
      console.warn(`[VapiWebhook] Failed to load caller context: ${err.message}`);
    }

    // Push inbound call notification to CRM agents via SSE (for caller ID popup)
    try {
      const { unifiedCommunicationService } = await import('../../services/unifiedCommunicationService.js');
      const { notificationService } = await import('../../services/notificationService.js');

      const lookup = await unifiedCommunicationService.lookupContactByPhone(customerNumber);
      notificationService.pushToAll({
        type: 'inbound_call',
        phone: customerNumber,
        callId,
        contact: lookup.found ? lookup.contacts[0] : null,
        contacts: lookup.contacts,
        timestamp: new Date().toISOString(),
      });
      console.log(`[VapiWebhook] SSE notification pushed for inbound call from ${customerNumber}`);
    } catch (err: any) {
      // SSE push is non-critical
      console.warn(`[VapiWebhook] Failed to push SSE notification: ${err.message}`);
    }
  }

  // Return empty response to use default assistant config
  res.status(200).json({});
}

// ---- End-of-call-report handler ----

function handleEndOfCallReport(message: any, res: Response): void {
  const callId = message.call?.id;
  const storedContext = callId ? activeCallContexts.get(callId) : undefined;

  // Respond to Vapi immediately (don't block webhook)
  res.status(200).json({});

  // Process transcript and post-call actions asynchronously (fire-and-forget)
  (async () => {
    try {
      const result = await processEndOfCallReport(message, storedContext);
      const callerPhone = message.call?.customer?.number;

      if (callerPhone && result.callerIdentified) {
        await sendPostCallSummary(callerPhone, message, result.conversationId);
      }

      await processCallTransfer(callId || '', result.conversationId, callerPhone || '', message);
      await triggerPostCallFollowUps(message, result.conversationId, callerPhone || '');
    } catch (err) {
      console.error('[VapiWebhooks] Post-call processing error:', err);
    } finally {
      if (callId) {
        activeCallContexts.delete(callId);
      }
    }
  })();
}

// ---- Hang handler ----

function handleHang(message: any, res: Response): void {
  const callId = message.call?.id;
  if (callId) {
    activeCallContexts.delete(callId); // Cleanup
  }
  console.log(`[VapiWebhook] Call ended: ${callId}`);
  res.status(200).json({});
}

// ---- Express Router ----

export const vapiWebhookRouter = Router();
vapiWebhookRouter.post('/vapi-webhook', validateVapiSecret, handleVapiWebhook);
