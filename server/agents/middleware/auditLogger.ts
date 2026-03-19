/**
 * Audit Logger Service
 * Logs all agent actions to agent_audit_log for compliance, debugging, and monitoring.
 * All log methods are fire-and-forget -- errors are caught and logged, never thrown.
 */

import { db } from '../../db';
import { agentAuditLog } from '@shared/schema';
import type { AgentType, CommunicationChannel } from '../types';

// ---- Parameter interfaces ----

export interface ToolCallAuditParams {
  agentType: AgentType;
  toolName: string;
  toolInput: unknown;
  toolOutput: unknown;
  durationMs: number;
  conversationId?: number;
  messageId?: number;
  channel?: CommunicationChannel;
  error?: string;
}

export interface ClassificationAuditParams {
  agentType: AgentType;
  reasoning: string;
  confidence: number;
  conversationId?: number;
  messageId?: number;
  channel?: CommunicationChannel;
}

export interface RoutingAuditParams {
  agentType: AgentType;
  reasoning: string;
  conversationId?: number;
  messageId?: number;
  channel?: CommunicationChannel;
}

export interface EscalationAuditParams {
  agentType: AgentType;
  reasoning: string;
  conversationId?: number;
  messageId?: number;
  channel?: CommunicationChannel;
}

export interface ResponseAuditParams {
  agentType: AgentType;
  conversationId?: number;
  messageId?: number;
  channel?: CommunicationChannel;
  durationMs?: number;
}

interface GenericAuditParams {
  agentType: AgentType;
  action: string;
  conversationId?: number;
  messageId?: number;
  toolName?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  reasoning?: string;
  confidence?: number;
  durationMs?: number;
  channel?: CommunicationChannel;
  error?: string;
}

// ---- Sensitive field redaction ----

const SENSITIVE_KEYS = /password|token|secret|key/i;

function redactSensitive(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitive);

  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(k) && typeof v === 'string') {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = redactSensitive(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ---- AuditLogger class ----

export class AuditLogger {
  async logToolCall(params: ToolCallAuditParams): Promise<void> {
    return this.logAction({
      agentType: params.agentType,
      action: 'tool_call',
      toolName: params.toolName,
      toolInput: redactSensitive(params.toolInput),
      toolOutput: redactSensitive(params.toolOutput),
      durationMs: params.durationMs,
      conversationId: params.conversationId,
      messageId: params.messageId,
      channel: params.channel,
      error: params.error,
    });
  }

  async logClassification(params: ClassificationAuditParams): Promise<void> {
    return this.logAction({
      agentType: params.agentType,
      action: 'classify',
      reasoning: params.reasoning,
      confidence: params.confidence,
      conversationId: params.conversationId,
      messageId: params.messageId,
      channel: params.channel,
    });
  }

  async logRouting(params: RoutingAuditParams): Promise<void> {
    return this.logAction({
      agentType: params.agentType,
      action: 'route',
      reasoning: params.reasoning,
      conversationId: params.conversationId,
      messageId: params.messageId,
      channel: params.channel,
    });
  }

  async logEscalation(params: EscalationAuditParams): Promise<void> {
    return this.logAction({
      agentType: params.agentType,
      action: 'escalate',
      reasoning: params.reasoning,
      conversationId: params.conversationId,
      messageId: params.messageId,
      channel: params.channel,
    });
  }

  async logResponse(params: ResponseAuditParams): Promise<void> {
    return this.logAction({
      agentType: params.agentType,
      action: 'respond',
      conversationId: params.conversationId,
      messageId: params.messageId,
      channel: params.channel,
      durationMs: params.durationMs,
    });
  }

  private async logAction(params: GenericAuditParams): Promise<void> {
    try {
      await db.insert(agentAuditLog).values({
        agentType: params.agentType,
        action: params.action,
        conversationId: params.conversationId ?? null,
        messageId: params.messageId ?? null,
        toolName: params.toolName ?? null,
        toolInput: params.toolInput ?? null,
        toolOutput: params.toolOutput ?? null,
        reasoning: params.reasoning ?? null,
        confidence: params.confidence != null ? String(params.confidence) : null,
        durationMs: params.durationMs ?? null,
        channel: params.channel ?? null,
        error: params.error ?? null,
      });
    } catch (err) {
      console.error('[AuditLogger] Failed to log action:', params.action, err);
    }
  }
}

export const auditLogger = new AuditLogger();
