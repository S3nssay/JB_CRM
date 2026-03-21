/**
 * Contractor Dispatch Pipeline -- Unit Tests
 *
 * Tests for: searchContractors, requestContractorQuote, landlordApproval, createWorkOrder
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  pool: {
    query: vi.fn().mockResolvedValue({ rows: [] }),
  },
}));

vi.mock('@shared/schema', () => ({
  contractors: { id: 'id', companyName: 'company_name', isActive: 'is_active', specializations: 'specializations', serviceAreas: 'service_areas', availableEmergency: 'available_emergency', preferredContractor: 'preferred_contractor', rating: 'rating' },
  contractorQuotes: { id: 'id', ticketId: 'ticket_id', contractorId: 'contractor_id', status: 'status', sentAt: 'sent_at', approvedAt: 'approved_at', approvalNotes: 'approval_notes' },
  workOrders: { id: 'id', maintenanceRequestId: 'maintenance_request_id', contractorId: 'contractor_id', workOrderNumber: 'work_order_number', status: 'status' },
  maintenanceTickets: { id: 'id', propertyId: 'property_id', tenantId: 'tenant_id', title: 'title', status: 'status', assignedContractorId: 'assigned_contractor_id' },
  landlords: { id: 'id', name: 'name', email: 'email', mobile: 'mobile', phone: 'phone' },
  properties: { id: 'id', address: 'address' },
  tenant: { id: 'id', name: 'name' },
  agentAuditLog: { id: 'id' },
  conversations: {},
  messages: { id: 'id' },
  staffProfiles: { id: 'id' },
  users: { id: 'id' },
  propertyCertifications: { id: 'id' },
  propertySystemsInventory: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('zod4', async () => {
  return await import('zod');
});

vi.mock('@openai/agents', () => {
  class MockAgent {
    name: string;
    model: string;
    instructions: string;
    tools: any[];
    handoffs: any[];
    constructor(config: any) {
      this.name = config.name;
      this.model = config.model;
      this.instructions = config.instructions;
      this.tools = config.tools || [];
      this.handoffs = config.handoffs || [];
    }
  }
  return {
    Agent: MockAgent,
    tool: (config: any) => ({
      type: 'function',
      name: config.name,
      description: config.description,
      parameters: config.parameters,
      execute: config.execute,
    }),
    handoff: vi.fn().mockImplementation((agent: any, options?: any) => ({
      type: 'handoff',
      agent,
      ...options,
    })),
    run: vi.fn().mockResolvedValue({ finalOutput: 'Test response' }),
  };
});

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logResponse: vi.fn().mockResolvedValue(undefined),
    logEscalation: vi.fn().mockResolvedValue(undefined),
    logToolCall: vi.fn().mockResolvedValue(undefined),
    logRouting: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: {
    send: vi.fn().mockResolvedValue(true),
    sendPreferred: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: {
    getConversationHistory: vi.fn().mockResolvedValue([]),
    storeMessage: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: {
    escalate: vi.fn().mockResolvedValue({ escalationId: 1, assignedTo: 5, notified: true }),
  },
}));

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = vi.fn().mockResolvedValue('job-id-123');
    this.work = vi.fn();
    this.start = vi.fn();
  });
  return { default: MockPgBoss };
});

// ---- searchContractors tests ----

describe('searchContractors tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be registered in the ToolRegistry', async () => {
    const { toolRegistry } = await import('../../server/agents/tools/registry');
    expect(toolRegistry.hasTool('search_contractors')).toBe(true);
  });

  it('should return contractors sorted by preferred first, then rating DESC', async () => {
    const { pool } = await import('../../server/db');
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        { id: 1, company_name: 'A Heating', contact_name: 'Alice', phone: '07700900001', email: 'a@test.com', specializations: ['heating'], rating: 4, response_time: '4 hours', call_out_fee: 5000, hourly_rate: 4000, preferred_contractor: true, available_emergency: true },
        { id: 2, company_name: 'B Heating', contact_name: 'Bob', phone: '07700900002', email: 'b@test.com', specializations: ['heating'], rating: 5, response_time: '1 hour', call_out_fee: 8000, hourly_rate: 6000, preferred_contractor: false, available_emergency: true },
        { id: 3, company_name: 'C Heating', contact_name: 'Charlie', phone: '07700900003', email: 'c@test.com', specializations: ['heating'], rating: 3, response_time: '24 hours', call_out_fee: 4000, hourly_rate: 3500, preferred_contractor: false, available_emergency: false },
      ],
    });

    const { searchContractorsTool } = await import('../../server/agents/tools/definitions/searchContractors');
    const result = await searchContractorsTool.execute(
      { category: 'heating', postcode: 'SE24' },
      { agentType: 'maintenance', conversationId: null, contactId: null, channel: 'whatsapp' },
    );

    expect(result.contractors.length).toBeGreaterThan(0);
    // Preferred contractor should be first
    expect(result.contractors[0].preferredContractor).toBe(true);
    // Non-preferred sorted by rating DESC
    if (result.contractors.length > 1) {
      const nonPreferred = result.contractors.filter((c: any) => !c.preferredContractor);
      for (let i = 1; i < nonPreferred.length; i++) {
        expect(nonPreferred[i - 1].rating).toBeGreaterThanOrEqual(nonPreferred[i].rating);
      }
    }
  });

  it('should filter to emergency-capable only when emergency=true', async () => {
    const { pool } = await import('../../server/db');
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        { id: 1, company_name: 'A Heating', contact_name: 'Alice', phone: '07700900001', email: 'a@test.com', specializations: ['heating'], rating: 4, response_time: '1 hour', call_out_fee: 5000, hourly_rate: 4000, preferred_contractor: true, available_emergency: true },
      ],
    });

    const { searchContractorsTool } = await import('../../server/agents/tools/definitions/searchContractors');
    const result = await searchContractorsTool.execute(
      { category: 'heating', emergency: true },
      { agentType: 'maintenance', conversationId: null, contactId: null, channel: 'whatsapp' },
    );

    // All returned contractors must be emergency-capable
    for (const c of result.contractors) {
      expect(c.availableEmergency).toBe(true);
    }
  });

  it('should return count matching contractor list length', async () => {
    const { pool } = await import('../../server/db');
    (pool.query as any).mockResolvedValueOnce({
      rows: [
        { id: 1, company_name: 'A Plumbing', contact_name: 'Alice', phone: '07700900001', email: 'a@test.com', specializations: ['plumbing'], rating: 4, response_time: '4 hours', call_out_fee: 5000, hourly_rate: 4000, preferred_contractor: false, available_emergency: false },
      ],
    });

    const { searchContractorsTool } = await import('../../server/agents/tools/definitions/searchContractors');
    const result = await searchContractorsTool.execute(
      { category: 'plumbing', postcode: 'SW9' },
      { agentType: 'maintenance', conversationId: null, contactId: null, channel: 'whatsapp' },
    );

    expect(result.count).toBe(result.contractors.length);
  });
});

// ---- requestContractorQuote tests ----

describe('requestContractorQuote tool', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should be registered in the ToolRegistry', async () => {
    const { toolRegistry } = await import('../../server/agents/tools/registry');
    expect(toolRegistry.hasTool('request_contractor_quote')).toBe(true);
  });

  it('should create a quote record and contact contractor', async () => {
    const { pool } = await import('../../server/db');
    // Mock contractor lookup
    (pool.query as any)
      .mockResolvedValueOnce({
        rows: [{ id: 5, company_name: 'Test Plumber', contact_name: 'John', phone: '07700900005', email: 'john@test.com' }],
      })
      // Mock quote insert
      .mockResolvedValueOnce({
        rows: [{ id: 10 }],
      });

    const { messageSender } = await import('../../server/agents/services/messageSender');

    const { requestContractorQuoteTool } = await import('../../server/agents/tools/definitions/requestContractorQuote');
    const result = await requestContractorQuoteTool.execute(
      { ticketId: 1, contractorId: 5, jobDescription: 'Boiler repair', propertyAddress: '42 High St', urgencyLevel: 'urgent' },
      { agentType: 'maintenance', conversationId: null, contactId: null, channel: 'whatsapp' },
    );

    expect(result.quoteId).toBeDefined();
    expect(result.status).toBe('pending');
    expect(result.contractorContacted).toBe(true);
    expect(messageSender.sendPreferred).toHaveBeenCalled();
  });

  it('should include ticket ID and property address in contractor message', async () => {
    const { pool } = await import('../../server/db');
    (pool.query as any)
      .mockResolvedValueOnce({
        rows: [{ id: 5, company_name: 'Test Plumber', contact_name: 'John', phone: '07700900005', email: 'john@test.com' }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: 10 }],
      });

    const { messageSender } = await import('../../server/agents/services/messageSender');

    const { requestContractorQuoteTool } = await import('../../server/agents/tools/definitions/requestContractorQuote');
    await requestContractorQuoteTool.execute(
      { ticketId: 42, contractorId: 5, jobDescription: 'Leaking pipe', propertyAddress: '10 Baker Street' },
      { agentType: 'maintenance', conversationId: null, contactId: null, channel: 'whatsapp' },
    );

    const callArgs = (messageSender.sendPreferred as any).mock.calls[0];
    const message = callArgs[1];
    expect(message).toContain('MT-42');
    expect(message).toContain('10 Baker Street');
    expect(message).toContain('Leaking pipe');
  });
});
