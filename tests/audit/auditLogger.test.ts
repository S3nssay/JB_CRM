import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module before importing auditLogger
vi.mock('../../server/db', () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

import { AuditLogger, auditLogger } from '../../server/agents/middleware/auditLogger';
import { db } from '../../server/db';

describe('Audit Logger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logToolCall inserts row with action="tool_call" and correct fields', async () => {
    await auditLogger.logToolCall({
      agentType: 'sales',
      toolName: 'searchProperties',
      toolInput: { query: 'SW1' },
      toolOutput: { results: [1, 2, 3] },
      durationMs: 42,
      conversationId: 10,
      channel: 'email',
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    const insertCall = (db.insert as any).mock.results[0].value;
    expect(insertCall.values).toHaveBeenCalledTimes(1);

    const insertedRow = insertCall.values.mock.calls[0][0];
    expect(insertedRow.action).toBe('tool_call');
    expect(insertedRow.agentType).toBe('sales');
    expect(insertedRow.toolName).toBe('searchProperties');
    expect(insertedRow.durationMs).toBe(42);
    expect(insertedRow.conversationId).toBe(10);
    expect(insertedRow.channel).toBe('email');
  });

  it('logClassification inserts row with action="classify" and reasoning', async () => {
    await auditLogger.logClassification({
      agentType: 'supervisor',
      reasoning: 'Inquiry about rental',
      confidence: 0.95,
      conversationId: 5,
      channel: 'whatsapp',
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    const insertCall = (db.insert as any).mock.results[0].value;
    const insertedRow = insertCall.values.mock.calls[0][0];
    expect(insertedRow.action).toBe('classify');
    expect(insertedRow.reasoning).toBe('Inquiry about rental');
    expect(insertedRow.confidence).toBe('0.95');
  });

  it('logRouting inserts row with action="route"', async () => {
    await auditLogger.logRouting({
      agentType: 'supervisor',
      reasoning: 'Route to sales agent',
      conversationId: 3,
      channel: 'email',
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    const insertCall = (db.insert as any).mock.results[0].value;
    const insertedRow = insertCall.values.mock.calls[0][0];
    expect(insertedRow.action).toBe('route');
    expect(insertedRow.reasoning).toBe('Route to sales agent');
  });

  it('logEscalation inserts row with action="escalate"', async () => {
    await auditLogger.logEscalation({
      agentType: 'rental',
      reasoning: 'Complex legal query',
      conversationId: 7,
      channel: 'phone',
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    const insertCall = (db.insert as any).mock.results[0].value;
    const insertedRow = insertCall.values.mock.calls[0][0];
    expect(insertedRow.action).toBe('escalate');
  });

  it('logResponse inserts row with action="respond"', async () => {
    await auditLogger.logResponse({
      agentType: 'sales',
      conversationId: 12,
      messageId: 99,
      channel: 'sms',
    });

    expect(db.insert).toHaveBeenCalledTimes(1);
    const insertCall = (db.insert as any).mock.results[0].value;
    const insertedRow = insertCall.values.mock.calls[0][0];
    expect(insertedRow.action).toBe('respond');
    expect(insertedRow.messageId).toBe(99);
  });

  it('redacts sensitive fields (password, token, secret, key) from toolInput/toolOutput', async () => {
    await auditLogger.logToolCall({
      agentType: 'sales',
      toolName: 'testTool',
      toolInput: { query: 'hello', password: 'secret123', apiToken: 'tok-abc' },
      toolOutput: { data: 'ok', secretKey: 'my-secret' },
      durationMs: 10,
    });

    const insertCall = (db.insert as any).mock.results[0].value;
    const insertedRow = insertCall.values.mock.calls[0][0];

    // toolInput should have password and apiToken redacted
    expect(insertedRow.toolInput.password).toBe('[REDACTED]');
    expect(insertedRow.toolInput.apiToken).toBe('[REDACTED]');
    expect(insertedRow.toolInput.query).toBe('hello');

    // toolOutput should have secretKey redacted
    expect(insertedRow.toolOutput.secretKey).toBe('[REDACTED]');
    expect(insertedRow.toolOutput.data).toBe('ok');
  });

  it('does not throw on logging errors -- catches and logs to console.error', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Make insert throw
    (db.insert as any).mockReturnValueOnce({
      values: vi.fn().mockRejectedValue(new Error('DB connection failed')),
    });

    // Should NOT throw
    await expect(
      auditLogger.logToolCall({
        agentType: 'sales',
        toolName: 'test',
        toolInput: {},
        toolOutput: {},
        durationMs: 0,
      })
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('exports a singleton instance', () => {
    expect(auditLogger).toBeInstanceOf(AuditLogger);
  });
});
