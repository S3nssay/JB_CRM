import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock toolRegistry before importing
vi.mock('../../server/agents/tools/registry', () => ({
  toolRegistry: {
    hasTool: vi.fn(),
    invoke: vi.fn(),
  },
}));

// Mock auditLogger
vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logToolCall: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock contactResolver
vi.mock('../../server/agents/channels/contactResolver', () => ({
  contactResolver: {
    resolve: vi.fn(),
  },
}));

// Mock conversationStore
vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: {
    findOrCreateConversation: vi.fn(),
    getConversationHistory: vi.fn(),
  },
}));

// Mock db
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  pool: { query: vi.fn().mockResolvedValue({ rows: [] }) },
}));

import { toolRegistry } from '../../server/agents/tools/registry';
import { contactResolver } from '../../server/agents/channels/contactResolver';
import { conversationStore } from '../../server/agents/channels/conversationStore';
import { pool } from '../../server/db';

// Helper to create mock request/response
function createMockReq(body: unknown, headers: Record<string, string> = {}) {
  return {
    body,
    headers,
  } as any;
}

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res;
}

// Helper to build a tool-calls payload
function buildToolCallPayload(
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
  callId = 'call_abc',
  customerNumber?: string,
) {
  return {
    message: {
      type: 'tool-calls',
      toolCallList: toolCalls.map((tc) => ({
        id: tc.id,
        type: 'function' as const,
        function: {
          name: tc.name,
          arguments: JSON.stringify(tc.args),
        },
      })),
      call: {
        id: callId,
        customer: customerNumber ? { number: customerNumber } : undefined,
      },
    },
  };
}

describe('Vapi Webhook Router', () => {
  let handleVapiWebhook: (req: any, res: any) => Promise<void>;
  let validateVapiSecret: (req: any, res: any, next: any) => void;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.VAPI_SERVER_SECRET;

    const mod = await import('../../server/agents/voice/vapiWebhooks');
    handleVapiWebhook = mod.handleVapiWebhook;
    validateVapiSecret = mod.validateVapiSecret;
  });

  // ---- Authentication Tests ----

  describe('webhook authentication', () => {
    it('returns 401 when VAPI_SERVER_SECRET is set and header is missing', async () => {
      process.env.VAPI_SERVER_SECRET = 'test-secret-123';
      // Re-import to pick up env change
      vi.resetModules();
      const mod = await import('../../server/agents/voice/vapiWebhooks');

      const req = createMockReq(
        { message: { type: 'tool-calls', toolCallList: [] } },
        {},
      );
      const res = createMockRes();
      let nextCalled = false;

      mod.validateVapiSecret(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(nextCalled).toBe(false);
    });

    it('returns 401 when x-vapi-secret header has wrong value', async () => {
      process.env.VAPI_SERVER_SECRET = 'test-secret-123';
      vi.resetModules();
      const mod = await import('../../server/agents/voice/vapiWebhooks');

      const req = createMockReq(
        { message: { type: 'tool-calls', toolCallList: [] } },
        { 'x-vapi-secret': 'wrong-secret' },
      );
      const res = createMockRes();
      let nextCalled = false;

      mod.validateVapiSecret(req, res, () => { nextCalled = true; });

      expect(res.statusCode).toBe(401);
      expect(nextCalled).toBe(false);
    });

    it('calls next() when x-vapi-secret matches', async () => {
      process.env.VAPI_SERVER_SECRET = 'test-secret-123';
      vi.resetModules();
      const mod = await import('../../server/agents/voice/vapiWebhooks');

      const req = createMockReq(
        { message: { type: 'tool-calls', toolCallList: [] } },
        { 'x-vapi-secret': 'test-secret-123' },
      );
      const res = createMockRes();
      let nextCalled = false;

      mod.validateVapiSecret(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });

    it('allows requests when no VAPI_SERVER_SECRET is configured (dev mode)', () => {
      // env var already deleted in beforeEach
      const req = createMockReq({}, {});
      const res = createMockRes();
      let nextCalled = false;

      validateVapiSecret(req, res, () => { nextCalled = true; });

      expect(nextCalled).toBe(true);
    });
  });

  // ---- Tool Calls Tests ----

  describe('tool-calls handling', () => {
    it('returns 200 with results for search_properties tool call', async () => {
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke).mockResolvedValue({
        output: { properties: [{ id: 1, address: '123 High St' }] },
        durationMs: 50,
        toolName: 'search_properties',
      });

      const req = createMockReq(buildToolCallPayload([
        { id: 'call_123', name: 'search_properties', args: { query: '2 bed flat' } },
      ]));
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].toolCallId).toBe('call_123');
      const parsed = JSON.parse(res.body.results[0].result);
      expect(parsed.properties).toHaveLength(1);
    });

    it('returns 200 with results for book_viewing tool call', async () => {
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke).mockResolvedValue({
        output: { appointmentId: 1 },
        durationMs: 30,
        toolName: 'book_viewing',
      });

      const req = createMockReq(buildToolCallPayload([
        { id: 'call_456', name: 'book_viewing', args: { propertyId: 1 } },
      ]));
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.results[0].toolCallId).toBe('call_456');
      const parsed = JSON.parse(res.body.results[0].result);
      expect(parsed.appointmentId).toBe(1);
    });

    it('returns 200 with error message for unknown tool', async () => {
      vi.mocked(toolRegistry.hasTool).mockReturnValue(false);

      const req = createMockReq(buildToolCallPayload([
        { id: 'tc_unknown', name: 'xyz_nonexistent', args: {} },
      ]));
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.results[0].toolCallId).toBe('tc_unknown');
      expect(res.body.results[0].result).toContain('Unknown tool');
      expect(res.body.results[0].result).toContain('xyz_nonexistent');
    });

    it('handles multiple tool calls in a single request', async () => {
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke)
        .mockResolvedValueOnce({ output: { properties: [] }, durationMs: 10, toolName: 'search_properties' })
        .mockResolvedValueOnce({ output: { appointmentId: 5 }, durationMs: 20, toolName: 'book_viewing' });

      const req = createMockReq(buildToolCallPayload([
        { id: 'tc_1', name: 'search_properties', args: { query: 'flat' } },
        { id: 'tc_2', name: 'book_viewing', args: { propertyId: 5 } },
      ]));
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].toolCallId).toBe('tc_1');
      expect(res.body.results[1].toolCallId).toBe('tc_2');
    });

    it('returns 200 with error string when toolRegistry.invoke throws', async () => {
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke).mockRejectedValue(new Error('Database connection failed'));

      const req = createMockReq(buildToolCallPayload([
        { id: 'tc_fail', name: 'search_properties', args: {} },
      ]));
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      // MUST be 200 per Vapi requirement
      expect(res.statusCode).toBe(200);
      expect(res.body.results[0].toolCallId).toBe('tc_fail');
      expect(res.body.results[0].result).toContain('Error');
      expect(res.body.results[0].result).toContain('Database connection failed');
    });

    it('tool-call result is always a string, not an object', async () => {
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke).mockResolvedValue({
        output: { nested: { data: [1, 2, 3] } },
        durationMs: 5,
        toolName: 'test',
      });

      const req = createMockReq(buildToolCallPayload([
        { id: 'tc_str', name: 'search_properties', args: {} },
      ]));
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
      expect(typeof res.body.results[0].result).toBe('string');
    });
  });

  // ---- Other Event Types ----

  describe('other event types', () => {
    it('returns 200 for end-of-call-report type (placeholder)', async () => {
      const req = createMockReq({
        message: { type: 'end-of-call-report', call: { id: 'call_end' } },
      });
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('returns 200 for assistant-request type', async () => {
      const req = createMockReq({
        message: { type: 'assistant-request', call: { id: 'call_ar' } },
      });
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
    });

    it('returns 200 for unknown message type (graceful handling)', async () => {
      const req = createMockReq({
        message: { type: 'some-future-event', call: { id: 'call_x' } },
      });
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);
    });
  });

  // ---- Pre-call Context Loading (Task 2) ----

  describe('loadCallerContext', () => {
    let loadCallerContext: (phone: string) => Promise<any>;

    beforeEach(async () => {
      vi.resetModules();
      vi.clearAllMocks();
      delete process.env.VAPI_SERVER_SECRET;

      const mod = await import('../../server/agents/voice/contextLoader');
      loadCallerContext = mod.loadCallerContext;
    });

    it('returns context for a known tenant', async () => {
      vi.mocked(contactResolver.resolve).mockResolvedValue({
        contactIdentityId: 10,
        contactId: 5,
        contactType: 'tenant',
        identifierValue: '+447700900001',
      });

      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ name: 'Jane Smith' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as any);

      vi.mocked(conversationStore.findOrCreateConversation).mockResolvedValue({
        id: 42,
        isNew: false,
      });

      vi.mocked(conversationStore.getConversationHistory).mockResolvedValue([
        { content: 'I need my boiler fixed', direction: 'inbound', createdAt: new Date() },
        { content: 'We have scheduled a repair for Monday', direction: 'outbound', createdAt: new Date() },
      ] as any);

      const result = await loadCallerContext('+447700900001');

      expect(result).not.toBeNull();
      expect(result!.contactName).toBe('Jane Smith');
      expect(result!.contactType).toBe('tenant');
      expect(result!.contactId).toBe(5);
      expect(result!.conversationId).toBe(42);
      expect(result!.recentSummary).toBeTruthy();
    });

    it('returns context for a known landlord', async () => {
      vi.mocked(contactResolver.resolve).mockResolvedValue({
        contactIdentityId: 20,
        contactId: 8,
        contactType: 'landlord',
        identifierValue: '+447700900002',
      });

      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ name: 'Lord Pemberton' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as any);

      vi.mocked(conversationStore.findOrCreateConversation).mockResolvedValue({
        id: 55,
        isNew: true,
      });

      const result = await loadCallerContext('+447700900002');

      expect(result).not.toBeNull();
      expect(result!.contactName).toBe('Lord Pemberton');
      expect(result!.contactType).toBe('landlord');
      expect(result!.contactId).toBe(8);
    });

    it('returns null for an unknown caller (contactId === 0)', async () => {
      vi.mocked(contactResolver.resolve).mockResolvedValue({
        contactIdentityId: 99,
        contactId: 0,
        contactType: 'unknown',
        identifierValue: '+447700999999',
      });

      const result = await loadCallerContext('+447700999999');

      expect(result).toBeNull();
    });
  });

  describe('assistant-request with context', () => {
    it('stores context for known caller on assistant-request', async () => {
      vi.mocked(contactResolver.resolve).mockResolvedValue({
        contactIdentityId: 10,
        contactId: 5,
        contactType: 'tenant',
        identifierValue: '+447700900001',
      });

      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ name: 'Jane Smith' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as any);

      vi.mocked(conversationStore.findOrCreateConversation).mockResolvedValue({
        id: 42,
        isNew: false,
      });

      vi.mocked(conversationStore.getConversationHistory).mockResolvedValue([
        { content: 'About the boiler', direction: 'inbound', createdAt: new Date() },
      ] as any);

      const req = createMockReq({
        message: {
          type: 'assistant-request',
          call: { id: 'call_ctx_1', customer: { number: '+447700900001' } },
        },
      });
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      expect(res.statusCode).toBe(200);

      // Now verify that a subsequent tool-call for same call ID uses the stored context
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke).mockResolvedValue({
        output: { properties: [] },
        durationMs: 10,
        toolName: 'search_properties',
      });

      const toolReq = createMockReq(buildToolCallPayload(
        [{ id: 'tc_ctx', name: 'search_properties', args: {} }],
        'call_ctx_1',
        '+447700900001',
      ));
      const toolRes = createMockRes();

      await handleVapiWebhook(toolReq, toolRes);

      // Verify the tool was invoked with the stored context's conversationId and contactId
      expect(toolRegistry.invoke).toHaveBeenCalledWith(
        'search_properties',
        {},
        expect.objectContaining({
          conversationId: 42,
          contactId: 5,
          channel: 'phone',
        }),
      );
    });

    it('does not store context for unknown caller on assistant-request', async () => {
      vi.mocked(contactResolver.resolve).mockResolvedValue({
        contactIdentityId: 99,
        contactId: 0,
        contactType: 'unknown',
        identifierValue: '+447700999999',
      });

      const req = createMockReq({
        message: {
          type: 'assistant-request',
          call: { id: 'call_unknown_1', customer: { number: '+447700999999' } },
        },
      });
      const res = createMockRes();

      await handleVapiWebhook(req, res);

      // Now do a tool call -- should use null conversationId/contactId
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke).mockResolvedValue({
        output: {},
        durationMs: 5,
        toolName: 'test',
      });

      const toolReq = createMockReq(buildToolCallPayload(
        [{ id: 'tc_nocontext', name: 'search_properties', args: {} }],
        'call_unknown_1',
      ));
      const toolRes = createMockRes();

      await handleVapiWebhook(toolReq, toolRes);

      expect(toolRegistry.invoke).toHaveBeenCalledWith(
        'search_properties',
        {},
        expect.objectContaining({
          conversationId: null,
          contactId: null,
        }),
      );
    });
  });

  describe('call context cleanup', () => {
    it('cleans up activeCallContexts on hang event', async () => {
      // First store context
      vi.mocked(contactResolver.resolve).mockResolvedValue({
        contactIdentityId: 10,
        contactId: 5,
        contactType: 'tenant',
        identifierValue: '+447700900001',
      });

      vi.mocked(pool.query).mockResolvedValue({
        rows: [{ name: 'Test' }],
        command: 'SELECT',
        rowCount: 1,
        oid: 0,
        fields: [],
      } as any);

      vi.mocked(conversationStore.findOrCreateConversation).mockResolvedValue({ id: 1, isNew: true });

      const arReq = createMockReq({
        message: {
          type: 'assistant-request',
          call: { id: 'call_cleanup', customer: { number: '+447700900001' } },
        },
      });
      await handleVapiWebhook(arReq, createMockRes());

      // Now send hang event
      const hangReq = createMockReq({
        message: { type: 'hang', call: { id: 'call_cleanup' } },
      });
      await handleVapiWebhook(hangReq, createMockRes());

      // Subsequent tool call should NOT have stored context
      vi.mocked(toolRegistry.hasTool).mockReturnValue(true);
      vi.mocked(toolRegistry.invoke).mockResolvedValue({
        output: {},
        durationMs: 5,
        toolName: 'test',
      });

      const toolReq = createMockReq(buildToolCallPayload(
        [{ id: 'tc_after_hang', name: 'search_properties', args: {} }],
        'call_cleanup',
      ));
      await handleVapiWebhook(toolReq, createMockRes());

      expect(toolRegistry.invoke).toHaveBeenCalledWith(
        'search_properties',
        {},
        expect.objectContaining({
          conversationId: null,
          contactId: null,
        }),
      );
    });
  });
});
