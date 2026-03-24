/**
 * Agent Monitoring API
 *
 * Provides endpoints for staff to monitor AI agent conversations,
 * escalations, metrics, and audit logs.
 */
import { Router } from 'express';
import { pool } from './db';

const router = Router();

// ---- Shared helpers ----

function buildWhereClause(conditions: string[]): string {
  if (conditions.length === 0) return '';
  return ' AND ' + conditions.join(' AND ');
}

// ---- Exported query functions (for testability) ----

export interface ConversationFilters {
  page: number;
  limit: number;
  channel?: string;
  agentType?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: string;
}

export async function getAgentConversations(filters: ConversationFilters) {
  const { page, limit, channel, agentType, dateFrom, dateTo, status } = filters;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  // Always filter to AI agent conversations
  conditions.push(`source = 'ai_agent'`);

  if (channel) {
    conditions.push(`last_channel = $${paramIdx++}`);
    params.push(channel);
  }
  if (agentType) {
    conditions.push(`agent_type = $${paramIdx++}`);
    params.push(agentType);
  }
  if (dateFrom) {
    conditions.push(`created_at >= $${paramIdx++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`created_at <= $${paramIdx++}`);
    params.push(dateTo);
  }
  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const dataQuery = `
    SELECT id, contact_name, contact_email, contact_phone,
           agent_type, last_channel, status, priority,
           last_message_at, last_message_preview,
           assigned_to_id, created_at, updated_at
    FROM conversation
    ${whereClause}
    ORDER BY last_message_at DESC NULLS LAST
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const countQuery = `
    SELECT COUNT(*)::text as total FROM conversation ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...params, limit, offset]),
    pool.query(countQuery, params),
  ]);

  return {
    conversations: dataResult.rows,
    total: parseInt(countResult.rows[0]?.total || '0', 10),
    page,
    limit,
  };
}

export async function getConversationThread(conversationId: number) {
  // Get conversation
  const convResult = await pool.query(
    'SELECT * FROM conversation WHERE id = $1',
    [conversationId]
  );
  const conversation = convResult.rows[0] || null;

  // Get messages
  const msgResult = await pool.query(
    'SELECT * FROM message WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );

  // Get audit log entries
  const auditResult = await pool.query(
    'SELECT * FROM agent_audit_log WHERE conversation_id = $1 ORDER BY created_at ASC',
    [conversationId]
  );

  // Merge into unified timeline sorted by timestamp
  const timeline: Array<{ type: 'message' | 'audit'; timestamp: string; data: any }> = [];

  for (const msg of msgResult.rows) {
    timeline.push({
      type: 'message',
      timestamp: msg.created_at,
      data: msg,
    });
  }

  for (const entry of auditResult.rows) {
    timeline.push({
      type: 'audit',
      timestamp: entry.created_at,
      data: entry,
    });
  }

  timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return { conversation, timeline };
}

export async function getEscalations() {
  const result = await pool.query(`
    SELECT c.id, c.contact_name, c.priority, c.status,
           c.agent_type, c.assigned_to_id, c.created_at,
           aal.reasoning as escalation_reason,
           aal.created_at as escalation_at
    FROM conversation c
    LEFT JOIN LATERAL (
      SELECT reasoning, created_at
      FROM agent_audit_log
      WHERE conversation_id = c.id AND action = 'escalate'
      ORDER BY created_at DESC
      LIMIT 1
    ) aal ON true
    WHERE c.priority IN ('urgent', 'high')
      AND c.status = 'open'
      AND c.source = 'ai_agent'
    ORDER BY COALESCE(aal.created_at, c.created_at) ASC
  `);

  const now = Date.now();
  const escalations = result.rows.map((row: any) => {
    const escalationTime = new Date(row.escalation_at || row.created_at).getTime();
    const waitingMs = now - escalationTime;
    const waitingMinutes = Math.floor(waitingMs / 60000);
    const hours = Math.floor(waitingMinutes / 60);
    const mins = waitingMinutes % 60;
    const timeWaiting = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    return {
      id: row.id,
      contactName: row.contact_name,
      priority: row.priority,
      agentType: row.agent_type,
      reason: row.escalation_reason || 'No reason recorded',
      assignedToId: row.assigned_to_id,
      escalationAt: row.escalation_at || row.created_at,
      timeWaiting,
      waitingMs,
    };
  });

  return { escalations, count: escalations.length };
}

export interface MetricsFilters {
  dateFrom?: string;
  dateTo?: string;
}

export async function getAgentMetrics(filters: MetricsFilters) {
  const { dateFrom, dateTo } = filters;

  // Default to last 7 days
  const from = dateFrom || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const to = dateTo || new Date().toISOString();

  // Per-agent aggregation
  const agentResult = await pool.query(`
    SELECT
      agent_type,
      COUNT(DISTINCT conversation_id)::text as conversation_count,
      COUNT(*)::text as total_actions,
      COUNT(*) FILTER (WHERE action = 'escalate')::text as escalation_count,
      COALESCE(AVG(duration_ms) FILTER (WHERE action = 'respond'), 0)::text as avg_duration_ms,
      COUNT(*) FILTER (WHERE action = 'tool_call')::text as tool_call_count
    FROM agent_audit_log
    WHERE created_at >= $1 AND created_at <= $2
    GROUP BY agent_type
    ORDER BY COUNT(*) DESC
  `, [from, to]);

  // Top tools
  const toolsResult = await pool.query(`
    SELECT
      tool_name,
      COUNT(*)::text as usage_count
    FROM agent_audit_log
    WHERE action = 'tool_call'
      AND tool_name IS NOT NULL
      AND created_at >= $1 AND created_at <= $2
    GROUP BY tool_name
    ORDER BY COUNT(*) DESC
    LIMIT 10
  `, [from, to]);

  return {
    agents: agentResult.rows,
    topTools: toolsResult.rows,
    period: { from, to },
  };
}

export interface AuditLogFilters {
  page: number;
  limit: number;
  agentType?: string;
  action?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function getAuditLog(filters: AuditLogFilters) {
  const { page, limit, agentType, action, dateFrom, dateTo } = filters;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: any[] = [];
  let paramIdx = 1;

  if (agentType) {
    conditions.push(`agent_type = $${paramIdx++}`);
    params.push(agentType);
  }
  if (action) {
    conditions.push(`action = $${paramIdx++}`);
    params.push(action);
  }
  if (dateFrom) {
    conditions.push(`created_at >= $${paramIdx++}`);
    params.push(dateFrom);
  }
  if (dateTo) {
    conditions.push(`created_at <= $${paramIdx++}`);
    params.push(dateTo);
  }

  const whereClause = conditions.length > 0
    ? 'WHERE ' + conditions.join(' AND ')
    : '';

  const dataQuery = `
    SELECT id, conversation_id, message_id, agent_type, action,
           tool_name, tool_input, tool_output, reasoning,
           confidence, duration_ms, channel, error, created_at
    FROM agent_audit_log
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const countQuery = `
    SELECT COUNT(*)::text as total FROM agent_audit_log ${whereClause}
  `;

  const [dataResult, countResult] = await Promise.all([
    pool.query(dataQuery, [...params, limit, offset]),
    pool.query(countQuery, params),
  ]);

  return {
    entries: dataResult.rows,
    total: parseInt(countResult.rows[0]?.total || '0', 10),
    page,
    limit,
  };
}

// ---- Express route handlers ----

const requireAgent = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
};

router.get('/agent-monitoring/conversations', requireAgent, async (req, res) => {
  try {
    const result = await getAgentConversations({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 20,
      channel: req.query.channel as string | undefined,
      agentType: req.query.agentType as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      status: req.query.status as string | undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching agent conversations:', error);
    res.status(500).json({ error: 'Failed to fetch agent conversations' });
  }
});

router.get('/agent-monitoring/conversations/:id/thread', requireAgent, async (req, res) => {
  try {
    const result = await getConversationThread(parseInt(req.params.id));
    if (!result.conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching conversation thread:', error);
    res.status(500).json({ error: 'Failed to fetch conversation thread' });
  }
});

router.get('/agent-monitoring/escalations', requireAgent, async (req, res) => {
  try {
    const result = await getEscalations();
    res.json(result);
  } catch (error) {
    console.error('Error fetching escalations:', error);
    res.status(500).json({ error: 'Failed to fetch escalations' });
  }
});

router.get('/agent-monitoring/metrics', requireAgent, async (req, res) => {
  try {
    const result = await getAgentMetrics({
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching agent metrics:', error);
    res.status(500).json({ error: 'Failed to fetch agent metrics' });
  }
});

router.get('/agent-monitoring/audit-log', requireAgent, async (req, res) => {
  try {
    const result = await getAuditLog({
      page: parseInt(req.query.page as string) || 1,
      limit: parseInt(req.query.limit as string) || 50,
      agentType: req.query.agentType as string | undefined,
      action: req.query.action as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

export default router;
