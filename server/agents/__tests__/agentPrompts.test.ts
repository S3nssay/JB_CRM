/**
 * Agent prompt and tool tests for CORR-01 and CORR-02 requirements.
 *
 * CORR-01: recordOfferTool exists and inserts into property_offer table
 * CORR-02: Sales and Lettings agents have OFFERS section, no negotiation language
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Capture all tool definitions by mocking the SDK tool() function
const capturedTools: Record<string, { name: string; execute: Function }> = {};

vi.mock('@openai/agents', () => ({
  Agent: vi.fn().mockImplementation((config: any) => config),
  tool: vi.fn().mockImplementation((config: any) => {
    capturedTools[config.name] = config;
    return config;
  }),
}));

// Mock zod4 to return passthrough objects
vi.mock('zod4', () => {
  const createChain = (): any =>
    new Proxy(() => createChain(), {
      get: () => createChain(),
      apply: () => createChain(),
    });
  return { z: createChain() };
});

// Mock the database pool
const mockQuery = vi.fn();
vi.mock('../../db', () => ({
  pool: { query: mockQuery },
  db: {},
}));

// Mock all services
vi.mock('../services/escalationService', () => ({ escalationService: { escalate: vi.fn() } }));
vi.mock('../services/checklistService', () => ({ checklistService: { generateChecklist: vi.fn(), chaseItem: vi.fn() } }));
vi.mock('../services/paymentLinkService', () => ({ paymentLinkService: { generateLink: vi.fn() } }));
vi.mock('../services/scheduledMessages', () => ({ scheduledMessageService: { schedulePaymentFollowUp: vi.fn() } }));
vi.mock('../services/arrearsComplianceGuard', () => ({ arrearsComplianceGuard: { canContact: vi.fn(), logContactAttempt: vi.fn() } }));
vi.mock('../services/messageSender', () => ({ messageSender: { send: vi.fn() } }));
vi.mock('../services/dealEventBus', () => ({ dealEventBus: { emit: vi.fn() }, DEAL_EVENTS: {} }));
vi.mock('../services/dealService', () => ({ dealService: { getDeal: vi.fn(), getDealSteps: vi.fn(), listDeals: vi.fn(), createNotification: vi.fn(), createDealEvent: vi.fn() } }));
vi.mock('../channels/conversationStore', () => ({ conversationStore: { getConversationsForContact: vi.fn(), getConversationHistory: vi.fn() } }));
vi.mock('../tools/registry', () => ({ toolRegistry: { invoke: vi.fn().mockResolvedValue({ output: {} }) } }));
vi.mock('../middleware/auditLogger', () => ({ auditLogger: { logToolCall: vi.fn().mockResolvedValue(undefined), logEscalation: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('pg-boss', () => ({ default: vi.fn().mockImplementation(() => ({ send: vi.fn() })) }));

describe('CORR-01: recordOfferTool', () => {
  beforeEach(() => {
    mockQuery.mockReset();
  });

  it('is exported from tools.ts', async () => {
    const toolsModule = await import('../sdk/tools');
    expect(toolsModule.recordOfferTool).toBeDefined();
    expect(typeof toolsModule.recordOfferTool).toBe('object');
  });

  it('execute inserts into property_offer table', async () => {
    // Configure mock responses:
    // 1. INSERT into property_offer
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    // 2. SELECT agent_id, address from properties
    mockQuery.mockResolvedValueOnce({ rows: [{ agent_id: 5, address: '123 Test St' }] });
    // 3. INSERT into notification
    mockQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

    const toolsModule = await import('../sdk/tools');
    const recordTool = toolsModule.recordOfferTool;

    const context = {
      agentType: 'sales' as const,
      conversationId: 'test-conv-1',
      contactId: 100,
      channel: 'whatsapp' as const,
    };

    const input = {
      propertyId: 1,
      offerAmount: 500000,
      buyerName: 'Test Buyer',
      buyerEmail: 'test@test.com',
      buyerPhone: '07000000000',
    };

    const result = await (recordTool as any).execute(context, input);

    // Verify INSERT INTO property_offer was called
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO property_offer'),
      expect.any(Array),
    );

    expect(result).toContain('recorded');
    expect(result).toContain('123 Test St');
  }, 15000);
});

describe('CORR-02: Agent prompt corrections', () => {
  const salesPath = path.resolve(__dirname, '../sdk/salesAgent.ts');
  const lettingsPath = path.resolve(__dirname, '../sdk/lettingsAgent.ts');

  const salesContent = fs.readFileSync(salesPath, 'utf8');
  const lettingsContent = fs.readFileSync(lettingsPath, 'utf8');

  const forbiddenPhrases = [
    'full negotiation autonomy',
    'negotiate prices',
    'negotiate rent',
  ];

  it('sales agent prompt has no negotiation language', () => {
    for (const phrase of forbiddenPhrases) {
      expect(salesContent).not.toContain(phrase);
    }
  });

  it('sales agent prompt has OFFERS section and record_offer reference', () => {
    expect(salesContent).toContain('OFFERS:');
    expect(salesContent).toContain('record_offer');
  });

  it('lettings agent prompt has no negotiation language', () => {
    for (const phrase of forbiddenPhrases) {
      expect(lettingsContent).not.toContain(phrase);
    }
  });

  it('lettings agent prompt has OFFERS section and record_offer reference', () => {
    expect(lettingsContent).toContain('OFFERS:');
    expect(lettingsContent).toContain('record_offer');
  });
});
