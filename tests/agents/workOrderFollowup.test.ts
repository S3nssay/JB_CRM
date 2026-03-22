/**
 * Work Order Follow-up Service -- Unit Tests
 *
 * Tests the automated follow-up system for work orders:
 * scheduling, contractor/tenant follow-ups, completion checks,
 * audit logging, and escalation after max attempts.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---- Mocks ----

const mockPoolQuery = vi.fn();

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
  },
  pool: { query: mockPoolQuery },
}));

vi.mock('@shared/schema', () => ({
  workOrders: { id: 'id', maintenanceRequestId: 'maintenance_request_id', status: 'status' },
  maintenanceTickets: { id: 'id', propertyId: 'property_id', tenantId: 'tenant_id', title: 'title' },
  contractors: { id: 'id', contactName: 'contact_name', phone: 'phone' },
  tenant: { id: 'id', name: 'name', phone: 'phone', mobile: 'mobile' },
  properties: { id: 'id', address: 'address' },
  agentAuditLog: {},
  staffProfiles: { id: 'id', userId: 'user_id', department: 'department', isActive: 'is_active' },
  users: { id: 'id', email: 'email', fullName: 'full_name', isActive: 'is_active' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  or: vi.fn(),
}));

const mockPgBossSend = vi.fn().mockResolvedValue('job-id-123');
const mockPgBossWork = vi.fn();

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = mockPgBossSend;
    this.work = mockPgBossWork;
    this.start = vi.fn();
  });
  return { default: MockPgBoss };
});

const mockSendPreferred = vi.fn().mockResolvedValue(true);

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: {
    send: vi.fn().mockResolvedValue(true),
    sendPreferred: mockSendPreferred,
  },
}));

const mockLogToolCall = vi.fn().mockResolvedValue(undefined);

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logToolCall: mockLogToolCall,
    logEscalation: vi.fn().mockResolvedValue(undefined),
    logRouting: vi.fn().mockResolvedValue(undefined),
    logResponse: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockEscalate = vi.fn().mockResolvedValue({ escalationId: 1, assignedTo: 5, notified: true });

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: {
    escalate: mockEscalate,
  },
}));

// ---- Tests ----

describe('WorkOrderFollowupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('scheduleFollowups', () => {
    it('should queue 3 jobs with correct intervals for emergency urgency (24h)', async () => {
      // Mock work order lookup
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            maintenance_request_id: 10,
            contractor_id: 20,
            work_order_number: 'WO-20260321-0001',
            scheduled_end: new Date('2026-03-25T17:00:00Z'),
            status: 'scheduled',
          }],
        })
        // Mock ticket lookup
        .mockResolvedValueOnce({
          rows: [{
            id: 10,
            tenant_id: 30,
            property_id: 40,
            title: 'Gas leak',
          }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.scheduleFollowups(1, 'emergency');

      // Should queue 3 jobs: contractor-followup, tenant-followup, completion-check
      expect(mockPgBossSend).toHaveBeenCalledTimes(3);

      // Contractor follow-up at 24h
      expect(mockPgBossSend).toHaveBeenCalledWith(
        'wo-contractor-followup',
        expect.objectContaining({
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'emergency',
          attemptNumber: 1,
        }),
        expect.objectContaining({ startAfter: 24 * 60 * 60 }),
      );

      // Tenant follow-up at 24h
      expect(mockPgBossSend).toHaveBeenCalledWith(
        'wo-tenant-followup',
        expect.objectContaining({ workOrderId: 1, attemptNumber: 1 }),
        expect.objectContaining({ startAfter: 24 * 60 * 60 }),
      );

      // Completion check at scheduledEnd
      expect(mockPgBossSend).toHaveBeenCalledWith(
        'wo-completion-check',
        expect.objectContaining({ workOrderId: 1, attemptNumber: 1 }),
        expect.objectContaining({ startAfter: expect.any(String) }),
      );
    });

    it('should queue 3 jobs with correct intervals for routine urgency (72h)', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{
            id: 2,
            maintenance_request_id: 11,
            contractor_id: 21,
            work_order_number: 'WO-20260321-0002',
            scheduled_end: new Date('2026-03-28T17:00:00Z'),
            status: 'scheduled',
          }],
        })
        .mockResolvedValueOnce({
          rows: [{
            id: 11,
            tenant_id: 31,
            property_id: 41,
            title: 'Dripping tap',
          }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.scheduleFollowups(2, 'routine');

      expect(mockPgBossSend).toHaveBeenCalledTimes(3);

      // Contractor follow-up at 72h
      expect(mockPgBossSend).toHaveBeenCalledWith(
        'wo-contractor-followup',
        expect.objectContaining({
          workOrderId: 2,
          urgency: 'routine',
          attemptNumber: 1,
        }),
        expect.objectContaining({ startAfter: 72 * 60 * 60 }),
      );

      // Tenant follow-up at 72h
      expect(mockPgBossSend).toHaveBeenCalledWith(
        'wo-tenant-followup',
        expect.objectContaining({ workOrderId: 2 }),
        expect.objectContaining({ startAfter: 72 * 60 * 60 }),
      );
    });
  });

  describe('handleContractorFollowup', () => {
    it('should send message to contractor and log audit', async () => {
      // Mock work order lookup (active)
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'scheduled', work_order_number: 'WO-20260321-0001' }],
        })
        // Mock contractor lookup
        .mockResolvedValueOnce({
          rows: [{ id: 20, contact_name: 'Bob Builder', phone: '+447000111222' }],
        })
        // Mock property address
        .mockResolvedValueOnce({
          rows: [{ address: '10 Downing Street, London' }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleContractorFollowup({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'emergency',
          attemptNumber: 1,
        },
      } as any);

      // Should send message to contractor
      expect(mockSendPreferred).toHaveBeenCalledWith(
        '+447000111222',
        expect.stringContaining('WO-20260321-0001'),
      );

      // Should log audit
      expect(mockLogToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'maintenance',
          toolName: 'wo-contractor-followup',
          toolInput: expect.objectContaining({
            workOrderId: 1,
            attemptNumber: 1,
          }),
        }),
      );
    });

    it('should skip completed work order', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed', work_order_number: 'WO-20260321-0001' }],
      });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleContractorFollowup({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'emergency',
          attemptNumber: 1,
        },
      } as any);

      // Should NOT send any message
      expect(mockSendPreferred).not.toHaveBeenCalled();
    });

    it('should escalate after MAX_FOLLOWUP_ATTEMPTS', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'scheduled', work_order_number: 'WO-20260321-0001' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 20, contact_name: 'Bob Builder', phone: '+447000111222' }],
        })
        .mockResolvedValueOnce({
          rows: [{ address: '10 Downing Street, London' }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleContractorFollowup({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'emergency',
          attemptNumber: 2, // MAX
        },
      } as any);

      // Should escalate to staff
      expect(mockEscalate).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining('contractor'),
        }),
      );

      // Should NOT schedule another follow-up
      expect(mockPgBossSend).not.toHaveBeenCalled();
    });
  });

  describe('handleTenantFollowup', () => {
    it('should send message to tenant and log audit', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'in_progress', work_order_number: 'WO-20260321-0001' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 30, name: 'Jane Doe', phone: '+447000333444', mobile: '+447000333444' }],
        })
        .mockResolvedValueOnce({
          rows: [{ title: 'Burst pipe in bathroom' }],
        })
        .mockResolvedValueOnce({
          rows: [{ address: '42 Baker Street, London' }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleTenantFollowup({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'urgent',
          attemptNumber: 1,
        },
      } as any);

      // Should send message to tenant
      expect(mockSendPreferred).toHaveBeenCalledWith(
        '+447000333444',
        expect.stringContaining('Burst pipe in bathroom'),
      );

      // Should log audit
      expect(mockLogToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'maintenance',
          toolName: 'wo-tenant-followup',
          toolInput: expect.objectContaining({
            workOrderId: 1,
            attemptNumber: 1,
          }),
        }),
      );
    });

    it('should escalate after MAX_FOLLOWUP_ATTEMPTS', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'scheduled', work_order_number: 'WO-20260321-0001' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 30, name: 'Jane Doe', phone: '+447000333444', mobile: null }],
        })
        .mockResolvedValueOnce({
          rows: [{ title: 'Broken window' }],
        })
        .mockResolvedValueOnce({
          rows: [{ address: '42 Baker Street' }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleTenantFollowup({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'emergency',
          attemptNumber: 2,
        },
      } as any);

      expect(mockEscalate).toHaveBeenCalledWith(
        expect.objectContaining({
          reason: expect.stringContaining('tenant'),
        }),
      );
    });
  });

  describe('handleCompletionCheck', () => {
    it('should log completion verified when status is completed', async () => {
      mockPoolQuery.mockResolvedValueOnce({
        rows: [{ id: 1, status: 'completed', work_order_number: 'WO-20260321-0001' }],
      });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleCompletionCheck({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'routine',
          attemptNumber: 1,
        },
      } as any);

      // Should log completion verified
      expect(mockLogToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'wo-completion-check',
          toolOutput: expect.objectContaining({ status: 'completed' }),
        }),
      );

      // Should NOT send any messages
      expect(mockSendPreferred).not.toHaveBeenCalled();
    });

    it('should follow up both parties when work is overdue', async () => {
      // Work order not completed
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'in_progress', work_order_number: 'WO-20260321-0001' }],
        })
        // Contractor lookup
        .mockResolvedValueOnce({
          rows: [{ id: 20, contact_name: 'Bob Builder', phone: '+447000111222' }],
        })
        // Tenant lookup
        .mockResolvedValueOnce({
          rows: [{ id: 30, name: 'Jane Doe', phone: '+447000333444', mobile: null }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleCompletionCheck({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'routine',
          attemptNumber: 1,
        },
      } as any);

      // Should send messages to both contractor and tenant
      expect(mockSendPreferred).toHaveBeenCalledTimes(2);

      // Should schedule another completion check
      expect(mockPgBossSend).toHaveBeenCalledWith(
        'wo-completion-check',
        expect.objectContaining({ attemptNumber: 2 }),
        expect.objectContaining({ startAfter: 24 * 60 * 60 }),
      );
    });
  });

  describe('Audit logging', () => {
    it('should include workOrderId, ticketId, attemptNumber, and followUpType in audit log entries', async () => {
      mockPoolQuery
        .mockResolvedValueOnce({
          rows: [{ id: 1, status: 'scheduled', work_order_number: 'WO-20260321-0001' }],
        })
        .mockResolvedValueOnce({
          rows: [{ id: 20, contact_name: 'Bob', phone: '+447000111222' }],
        })
        .mockResolvedValueOnce({
          rows: [{ address: '10 Downing Street' }],
        });

      const { WorkOrderFollowupService } = await import('../../server/agents/services/workOrderFollowup');
      const service = new WorkOrderFollowupService();

      await service.handleContractorFollowup({
        data: {
          workOrderId: 1,
          ticketId: 10,
          contractorId: 20,
          tenantId: 30,
          propertyId: 40,
          urgency: 'emergency',
          attemptNumber: 1,
        },
      } as any);

      expect(mockLogToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          toolInput: expect.objectContaining({
            workOrderId: 1,
            ticketId: 10,
            attemptNumber: 1,
            followUpType: 'contractor',
          }),
        }),
      );
    });
  });

  describe('registerWorkOrderFollowupWorkers', () => {
    it('should register 3 workers with pg-boss', async () => {
      const { registerWorkOrderFollowupWorkers } = await import('../../server/agents/services/workOrderFollowup');

      const mockBoss = {
        work: vi.fn(),
      };

      await registerWorkOrderFollowupWorkers(mockBoss as any);

      expect(mockBoss.work).toHaveBeenCalledTimes(3);
      expect(mockBoss.work).toHaveBeenCalledWith('wo-contractor-followup', expect.any(Function));
      expect(mockBoss.work).toHaveBeenCalledWith('wo-tenant-followup', expect.any(Function));
      expect(mockBoss.work).toHaveBeenCalledWith('wo-completion-check', expect.any(Function));
    });
  });
});
