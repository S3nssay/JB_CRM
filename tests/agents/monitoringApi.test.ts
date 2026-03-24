/**
 * Agent Monitoring API -- Unit Tests
 *
 * Tests monitoring endpoints for conversations, escalations,
 * metrics, and audit log.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
  },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  },
}));

vi.mock('@shared/schema', () => ({
  conversations: { id: 'id', source: 'source', agentType: 'agent_type', lastChannel: 'last_channel', status: 'status', priority: 'priority', contactName: 'contact_name', lastMessageAt: 'last_message_at', lastMessagePreview: 'last_message_preview', createdAt: 'created_at', updatedAt: 'updated_at', assignedToId: 'assigned_to_id' },
  messages: { id: 'id', conversationId: 'conversation_id', channel: 'channel', direction: 'direction', content: 'content', subject: 'subject', fromAddress: 'from_address', toAddress: 'to_address', createdAt: 'created_at', agentType: 'agent_type', status: 'status' },
  agentAuditLog: { id: 'id', conversationId: 'conversation_id', agentType: 'agent_type', action: 'action', toolName: 'tool_name', toolInput: 'tool_input', toolOutput: 'tool_output', reasoning: 'reasoning', durationMs: 'duration_ms', channel: 'channel', createdAt: 'created_at', error: 'error' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: any[]) => ({ type: 'and', args })),
  or: vi.fn((...args: any[]) => ({ type: 'or', args })),
  desc: vi.fn((col: any) => ({ type: 'desc', col })),
  asc: vi.fn((col: any) => ({ type: 'asc', col })),
  gte: vi.fn((...args: any[]) => ({ type: 'gte', args })),
  lte: vi.fn((...args: any[]) => ({ type: 'lte', args })),
  sql: Object.assign(vi.fn((strings: any, ...values: any[]) => ({ strings, values })), {
    raw: vi.fn((s: string) => s),
  }),
  count: vi.fn(() => 'count_expr'),
  inArray: vi.fn((...args: any[]) => ({ type: 'inArray', args })),
  isNull: vi.fn(),
}));

// ---- Import the module under test ----
import { pool } from '../../server/db';

describe('Agent Monitoring API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /agent-monitoring/conversations', () => {
    it('returns paginated agent conversations with default params', async () => {
      const mockPool = pool as any;
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, contact_name: 'John Doe', agent_type: 'arrears', last_channel: 'sms', status: 'open', last_message_at: '2026-03-24T10:00:00Z', last_message_preview: 'Hello', created_at: '2026-03-24T09:00:00Z' },
          { id: 2, contact_name: 'Jane Smith', agent_type: 'sales', last_channel: 'email', status: 'resolved', last_message_at: '2026-03-24T09:00:00Z', last_message_preview: 'Hi', created_at: '2026-03-24T08:00:00Z' },
        ],
        rowCount: 2,
      }).mockResolvedValueOnce({
        rows: [{ total: '5' }],
        rowCount: 1,
      });

      const { getAgentConversations } = await import('../../server/agentMonitoringRoutes');
      const result = await getAgentConversations({ page: 1, limit: 20 });

      expect(result).toHaveProperty('conversations');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
    });

    it('applies channel, agentType, and status filters', async () => {
      const mockPool = pool as any;
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      const { getAgentConversations } = await import('../../server/agentMonitoringRoutes');
      const result = await getAgentConversations({
        page: 1, limit: 20,
        channel: 'sms', agentType: 'arrears', status: 'open',
      });

      expect(result.conversations).toEqual([]);
      expect(mockPool.query).toHaveBeenCalled();
      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('last_channel');
      expect(queryCall[0]).toContain('agent_type');
      expect(queryCall[0]).toContain('status');
    });
  });

  describe('GET /agent-monitoring/conversations/:id/thread', () => {
    it('returns merged message and audit timeline ordered by timestamp', async () => {
      const mockPool = pool as any;
      // Conversation query
      mockPool.query.mockResolvedValueOnce({
        rows: [{ id: 1, contact_name: 'John Doe', status: 'open', agent_type: 'arrears' }],
        rowCount: 1,
      });
      // Messages query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 10, content: 'Hello', direction: 'inbound', created_at: '2026-03-24T10:00:00Z', channel: 'sms' },
          { id: 11, content: 'Response', direction: 'outbound', created_at: '2026-03-24T10:05:00Z', channel: 'sms' },
        ],
        rowCount: 2,
      });
      // Audit log query
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 100, action: 'classify', agent_type: 'supervisor', created_at: '2026-03-24T10:00:01Z', tool_name: null },
          { id: 101, action: 'tool_call', agent_type: 'arrears', created_at: '2026-03-24T10:04:00Z', tool_name: 'checkArrearsStatus' },
        ],
        rowCount: 2,
      });

      const { getConversationThread } = await import('../../server/agentMonitoringRoutes');
      const result = await getConversationThread(1);

      expect(result).toHaveProperty('conversation');
      expect(result).toHaveProperty('timeline');
      expect(result.timeline.length).toBe(4);
      const timestamps = result.timeline.map((e: any) => new Date(e.timestamp).getTime());
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i - 1]);
      }
      expect(result.timeline[0].type).toBe('message');
      expect(result.timeline[1].type).toBe('audit');
    });
  });

  describe('GET /agent-monitoring/escalations', () => {
    it('returns urgent/high open conversations sorted by wait time', async () => {
      const mockPool = pool as any;
      mockPool.query.mockResolvedValueOnce({
        rows: [
          {
            id: 1, contact_name: 'Jane', priority: 'urgent', status: 'open',
            agent_type: 'arrears', created_at: '2026-03-24T08:00:00Z',
            escalation_reason: 'Vulnerability detected', escalation_at: '2026-03-24T08:01:00Z',
            assigned_to_id: 5,
          },
          {
            id: 2, contact_name: 'Bob', priority: 'high', status: 'open',
            agent_type: 'maintenance', created_at: '2026-03-24T09:00:00Z',
            escalation_reason: 'Emergency repair', escalation_at: '2026-03-24T09:30:00Z',
            assigned_to_id: null,
          },
        ],
        rowCount: 2,
      });

      const { getEscalations } = await import('../../server/agentMonitoringRoutes');
      const result = await getEscalations();

      expect(result).toHaveProperty('escalations');
      expect(result).toHaveProperty('count');
      expect(result.escalations.length).toBe(2);
      expect(result.escalations[0].contactName).toBe('Jane');
    });
  });

  describe('GET /agent-monitoring/metrics', () => {
    it('returns per-agent aggregations for date range', async () => {
      const mockPool = pool as any;
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { agent_type: 'arrears', conversation_count: '15', total_actions: '120', escalation_count: '3', avg_duration_ms: '450', tool_call_count: '60' },
          { agent_type: 'sales', conversation_count: '25', total_actions: '200', escalation_count: '5', avg_duration_ms: '320', tool_call_count: '90' },
        ],
        rowCount: 2,
      }).mockResolvedValueOnce({
        rows: [
          { tool_name: 'checkArrearsStatus', usage_count: '45' },
          { tool_name: 'sendPaymentLink', usage_count: '30' },
        ],
        rowCount: 2,
      });

      const { getAgentMetrics } = await import('../../server/agentMonitoringRoutes');
      const result = await getAgentMetrics({});

      expect(result).toHaveProperty('agents');
      expect(result).toHaveProperty('topTools');
      expect(result).toHaveProperty('period');
      expect(result.agents.length).toBe(2);
      expect(result.topTools.length).toBe(2);
    });
  });

  describe('GET /agent-monitoring/audit-log', () => {
    it('returns filtered paginated audit log entries', async () => {
      const mockPool = pool as any;
      mockPool.query.mockResolvedValueOnce({
        rows: [
          { id: 1, agent_type: 'supervisor', action: 'classify', tool_name: null, channel: 'sms', duration_ms: 120, reasoning: 'Classified as arrears', created_at: '2026-03-24T10:00:00Z' },
          { id: 2, agent_type: 'arrears', action: 'tool_call', tool_name: 'checkArrearsStatus', channel: 'sms', duration_ms: 350, reasoning: null, created_at: '2026-03-24T10:01:00Z' },
        ],
        rowCount: 2,
      }).mockResolvedValueOnce({
        rows: [{ total: '50' }],
        rowCount: 1,
      });

      const { getAuditLog } = await import('../../server/agentMonitoringRoutes');
      const result = await getAuditLog({ page: 1, limit: 50 });

      expect(result).toHaveProperty('entries');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page');
      expect(result).toHaveProperty('limit');
      expect(result.entries.length).toBe(2);
    });

    it('applies agentType and action filters', async () => {
      const mockPool = pool as any;
      mockPool.query.mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [{ total: '0' }], rowCount: 1 });

      const { getAuditLog } = await import('../../server/agentMonitoringRoutes');
      const result = await getAuditLog({ page: 1, limit: 50, agentType: 'arrears', action: 'escalate' });

      const queryCall = mockPool.query.mock.calls[0];
      expect(queryCall[0]).toContain('agent_type');
      expect(queryCall[0]).toContain('action');
      expect(result.entries).toEqual([]);
    });
  });
});
