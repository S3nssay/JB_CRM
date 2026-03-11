/**
 * Message Router Agent
 *
 * Reads incoming messages (emails, form submissions, internal notes) and determines
 * which PM agent should handle them:
 *
 * 1. Start of Tenancy Agent - New tenant onboarding, deposit protection, move-in tasks
 * 2. Rent Processing Agent - Rent payments, bank statements, receipts, landlord statements
 * 3. End of Tenancy Agent - Move-out, checkout, deposit returns, final accounts
 *
 * Uses keyword matching and contextual analysis to classify messages and route them
 * to the appropriate workflow.
 */

import { Router } from "express";
import { pool } from "../db";
import { runRentProcessingAgent } from "./rentProcessingAgent";

export const router = Router();

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) return res.status(401).json({ error: "Not authenticated" });
  if (req.user.role !== "admin" && req.user.role !== "agent") return res.status(403).json({ error: "Not authorized" });
  next();
};

// ============================================================
// Classification Types
// ============================================================

export type AgentType = 'start_of_tenancy' | 'rent_processing' | 'end_of_tenancy' | 'unclassified';

interface ClassificationResult {
  agent: AgentType;
  confidence: number; // 0-1
  matchedKeywords: string[];
  reasoning: string;
  suggestedAction: string;
}

interface IncomingMessage {
  id?: number;
  source: 'email' | 'form' | 'internal' | 'manual';
  subject?: string;
  body: string;
  senderEmail?: string;
  senderName?: string;
  receivedAt?: string;
  tenancyId?: number;
  propertyId?: number;
}

interface RoutedMessage {
  id: number;
  message: IncomingMessage;
  classification: ClassificationResult;
  status: 'pending' | 'routed' | 'actioned' | 'dismissed';
  routedAt: string;
  actionedAt?: string;
  actionedBy?: string;
  agentRunId?: number;
}

// ============================================================
// Keyword Dictionaries for Classification
// ============================================================

const TENANCY_START_KEYWORDS = [
  'new tenant', 'new tenancy', 'move in', 'move-in', 'moving in',
  'applicant', 'application', 'onboarding', 'start date',
  'deposit protection', 'protect deposit', 'dps registration',
  'tenancy agreement', 'sign contract', 'contract signing',
  'referencing', 'reference check', 'credit check',
  'guarantor', 'right to rent', 'identity verification',
  'key handover', 'gas safety', 'epc', 'eicr',
  'inventory check-in', 'check-in', 'check in report',
  'standing order', 'set up rent', 'first payment',
  'welcome pack', 'tenant welcome', 'new let',
  'commission', 'management fee', 'instruction',
];

const RENT_PROCESSING_KEYWORDS = [
  'rent received', 'rent payment', 'rent paid', 'rent due',
  'bank statement', 'bank transfer', 'bacs', 'standing order received',
  'payment received', 'payment confirmation',
  'tenant receipt', 'rent receipt', 'receipt generated',
  'landlord statement', 'landlord payment', 'pay landlord',
  'commission deducted', 'management fee deducted',
  'contractor charge', 'maintenance charge', 'maintenance invoice',
  'net payable', 'rent arrears', 'arrears', 'overdue',
  'late payment', 'payment reminder', 'chase rent',
  'reconciliation', 'bank reconciliation', 'unmatched payment',
  'gocardless', 'direct debit', 'csv import',
];

const END_OF_TENANCY_KEYWORDS = [
  'end of tenancy', 'end-of-tenancy', 'move out', 'move-out', 'moving out',
  'notice served', 'notice period', 'section 21', 'section 8',
  'tenant notice', 'gave notice', 'vacate', 'leaving',
  'checkout', 'check-out', 'check out inspection',
  'meter reading', 'final meter', 'meter readings',
  'deposit return', 'deposit deduction', 'deposit claim',
  'dps claim', 'deposit dispute', 'dilapidations',
  'cleaning charge', 'damage assessment', 'inventory report',
  'key return', 'keys returned', 'handed keys',
  'forwarding address', 'forward post',
  'final account', 'closing account', 'close tenancy',
  'utility transfer', 'council tax notification',
];

// ============================================================
// Classification Engine
// ============================================================

function classifyMessage(message: IncomingMessage): ClassificationResult {
  const text = `${message.subject || ''} ${message.body}`.toLowerCase();

  // Score each agent category
  const scores: Record<AgentType, { score: number; matches: string[] }> = {
    start_of_tenancy: { score: 0, matches: [] },
    rent_processing: { score: 0, matches: [] },
    end_of_tenancy: { score: 0, matches: [] },
    unclassified: { score: 0, matches: [] },
  };

  for (const keyword of TENANCY_START_KEYWORDS) {
    if (text.includes(keyword)) {
      scores.start_of_tenancy.score += keyword.split(' ').length; // Multi-word matches score higher
      scores.start_of_tenancy.matches.push(keyword);
    }
  }

  for (const keyword of RENT_PROCESSING_KEYWORDS) {
    if (text.includes(keyword)) {
      scores.rent_processing.score += keyword.split(' ').length;
      scores.rent_processing.matches.push(keyword);
    }
  }

  for (const keyword of END_OF_TENANCY_KEYWORDS) {
    if (text.includes(keyword)) {
      scores.end_of_tenancy.score += keyword.split(' ').length;
      scores.end_of_tenancy.matches.push(keyword);
    }
  }

  // Determine winner
  const totalScore = scores.start_of_tenancy.score + scores.rent_processing.score + scores.end_of_tenancy.score;

  if (totalScore === 0) {
    return {
      agent: 'unclassified',
      confidence: 0,
      matchedKeywords: [],
      reasoning: 'No matching keywords found in message',
      suggestedAction: 'Review manually and assign to appropriate agent',
    };
  }

  // Find the highest scoring agent
  let bestAgent: AgentType = 'unclassified';
  let bestScore = 0;
  for (const [agent, data] of Object.entries(scores)) {
    if (agent !== 'unclassified' && data.score > bestScore) {
      bestScore = data.score;
      bestAgent = agent as AgentType;
    }
  }

  const confidence = Math.min(bestScore / Math.max(totalScore, 1), 1);
  const matchedKeywords = scores[bestAgent].matches;

  const actionMap: Record<AgentType, string> = {
    start_of_tenancy: 'Route to Start of Tenancy workflow - initiate onboarding pipeline',
    rent_processing: 'Route to Rent Processing Agent - process payment and generate statements',
    end_of_tenancy: 'Route to End of Tenancy workflow - initiate checkout process',
    unclassified: 'Review manually',
  };

  return {
    agent: bestAgent,
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords,
    reasoning: `Matched ${matchedKeywords.length} keyword(s) for ${bestAgent.replace(/_/g, ' ')} (score: ${bestScore}/${totalScore})`,
    suggestedAction: actionMap[bestAgent],
  };
}

// ============================================================
// API Routes
// ============================================================

// POST: Classify a message (preview without routing)
router.post("/message-router/classify", requireAgent, async (req, res) => {
  try {
    const message: IncomingMessage = req.body;
    if (!message.body) {
      return res.status(400).json({ error: "Message body is required" });
    }
    const classification = classifyMessage(message);
    res.json({ classification });
  } catch (error: any) {
    console.error("Error classifying message:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Route a message (classify + store + optionally trigger agent)
router.post("/message-router/route", requireAgent, async (req, res) => {
  try {
    const { message, autoExecute } = req.body as { message: IncomingMessage; autoExecute?: boolean };
    if (!message?.body) {
      return res.status(400).json({ error: "Message body is required" });
    }

    const classification = classifyMessage(message);

    // Store the routed message
    const result = await pool.query(
      `INSERT INTO routed_message (source, subject, body, sender_email, sender_name, agent_type, confidence, matched_keywords, reasoning, suggested_action, status, tenancy_id, property_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING id`,
      [
        message.source || 'manual',
        message.subject || null,
        message.body,
        message.senderEmail || null,
        message.senderName || null,
        classification.agent,
        classification.confidence,
        JSON.stringify(classification.matchedKeywords),
        classification.reasoning,
        classification.suggestedAction,
        'routed',
        message.tenancyId || null,
        message.propertyId || null,
      ]
    );
    const routedId = result.rows[0].id;

    let agentRunId: number | null = null;

    // Auto-execute if requested and confidence is high enough
    if (autoExecute && classification.confidence >= 0.6 && classification.agent !== 'unclassified') {
      agentRunId = await executeAgent(classification.agent, message, (req as any).user?.id);

      await pool.query(
        "UPDATE routed_message SET status = 'actioned', actioned_at = NOW(), actioned_by = $2, agent_run_id = $3 WHERE id = $1",
        [routedId, `user_${(req as any).user?.id}`, agentRunId]
      );
    }

    res.json({
      id: routedId,
      classification,
      agentRunId,
      autoExecuted: !!agentRunId,
    });
  } catch (error: any) {
    console.error("Error routing message:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Manually trigger an agent for a routed message
router.post("/message-router/:id/execute", requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { agentType } = req.body; // Allow overriding the classified agent

    const msgResult = await pool.query("SELECT * FROM routed_message WHERE id = $1", [id]);
    if (msgResult.rows.length === 0) return res.status(404).json({ error: "Routed message not found" });

    const msg = msgResult.rows[0];
    const targetAgent = (agentType || msg.agent_type) as AgentType;

    const agentRunId = await executeAgent(targetAgent, {
      source: msg.source,
      subject: msg.subject,
      body: msg.body,
      senderEmail: msg.sender_email,
      senderName: msg.sender_name,
      tenancyId: msg.tenancy_id,
      propertyId: msg.property_id,
    }, (req as any).user?.id);

    await pool.query(
      "UPDATE routed_message SET status = 'actioned', actioned_at = NOW(), actioned_by = $2, agent_run_id = $3, agent_type = $4 WHERE id = $1",
      [id, `user_${(req as any).user?.id}`, agentRunId, targetAgent]
    );

    res.json({ success: true, agentRunId });
  } catch (error: any) {
    console.error("Error executing agent:", error);
    res.status(500).json({ error: error.message });
  }
});

// GET: List routed messages with filters
router.get("/message-router/history", requireAgent, async (req, res) => {
  try {
    const { status, agent_type, limit: limitParam } = req.query;
    let sql = "SELECT * FROM routed_message";
    const params: any[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push(`status = $${params.length + 1}`);
      params.push(status);
    }
    if (agent_type) {
      conditions.push(`agent_type = $${params.length + 1}`);
      params.push(agent_type);
    }

    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY created_at DESC";
    sql += ` LIMIT $${params.length + 1}`;
    params.push(parseInt(limitParam as string) || 50);

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    console.error("Error fetching message history:", error);
    res.status(500).json({ error: error.message });
  }
});

// POST: Dismiss a routed message
router.post("/message-router/:id/dismiss", requireAgent, async (req, res) => {
  try {
    await pool.query(
      "UPDATE routed_message SET status = 'dismissed', actioned_at = NOW(), actioned_by = $2 WHERE id = $1",
      [req.params.id, `user_${(req as any).user?.id}`]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET: Agent stats summary
router.get("/message-router/stats", requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        agent_type,
        status,
        COUNT(*)::int as count
      FROM routed_message
      GROUP BY agent_type, status
      ORDER BY agent_type, status
    `);

    const stats: Record<string, Record<string, number>> = {};
    for (const row of result.rows) {
      if (!stats[row.agent_type]) stats[row.agent_type] = {};
      stats[row.agent_type][row.status] = row.count;
    }

    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Agent Execution
// ============================================================

async function executeAgent(
  agentType: AgentType,
  message: IncomingMessage,
  userId?: number
): Promise<number> {
  const triggeredBy = userId ? `user_${userId}` : 'message_router';

  switch (agentType) {
    case 'rent_processing': {
      // Trigger the full rent processing agent
      const runId = await runRentProcessingAgent(triggeredBy);
      return runId;
    }

    case 'start_of_tenancy': {
      // Log an agent run for tracking; the actual onboarding is handled via the onboarding pipeline UI
      const runResult = await pool.query(
        `INSERT INTO agent_run (agent_type, status, triggered_by, started_at, completed_at, steps_completed, steps_total, log)
         VALUES ('start_of_tenancy', 'completed', $1, NOW(), NOW(), 1, 1, $2) RETURNING id`,
        [
          triggeredBy,
          JSON.stringify([{
            step: 1, action: 'message_routed', status: 'success',
            message: `Message routed to Start of Tenancy: ${message.subject || message.body.substring(0, 100)}`,
            timestamp: new Date().toISOString()
          }])
        ]
      );
      return runResult.rows[0].id;
    }

    case 'end_of_tenancy': {
      // Log an agent run for tracking; actual EOT process handled via EOT UI
      const runResult = await pool.query(
        `INSERT INTO agent_run (agent_type, status, triggered_by, started_at, completed_at, steps_completed, steps_total, log)
         VALUES ('end_of_tenancy', 'completed', $1, NOW(), NOW(), 1, 1, $2) RETURNING id`,
        [
          triggeredBy,
          JSON.stringify([{
            step: 1, action: 'message_routed', status: 'success',
            message: `Message routed to End of Tenancy: ${message.subject || message.body.substring(0, 100)}`,
            timestamp: new Date().toISOString()
          }])
        ]
      );
      return runResult.rows[0].id;
    }

    default: {
      const runResult = await pool.query(
        `INSERT INTO agent_run (agent_type, status, triggered_by, started_at, completed_at, steps_completed, steps_total, log)
         VALUES ('unclassified', 'completed', $1, NOW(), NOW(), 1, 1, $2) RETURNING id`,
        [
          triggeredBy,
          JSON.stringify([{
            step: 1, action: 'message_unclassified', status: 'warning',
            message: `Message could not be classified: ${message.subject || message.body.substring(0, 100)}`,
            timestamp: new Date().toISOString()
          }])
        ]
      );
      return runResult.rows[0].id;
    }
  }
}

// Export for use in routes.ts
export const messageRouterAgent = { router, classifyMessage, executeAgent };
