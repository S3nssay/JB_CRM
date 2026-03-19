import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../../server/agents/tools/registry';
import type { ToolContext } from '../../server/agents/tools/types';

// Mock the database module
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
  },
}));

function createContext(): ToolContext {
  return {
    agentType: 'maintenance',
    conversationId: null,
    contactId: null,
    channel: 'email',
  };
}

describe('queryKnowledgeBase', () => {
  let registry: ToolRegistry;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Dynamically import after mocks are set
    const { queryKnowledgeBaseTool } = await import(
      '../../server/agents/tools/definitions/queryKnowledgeBase'
    );
    registry = new ToolRegistry();
    registry.register(queryKnowledgeBaseTool);
  });

  describe('certifications', () => {
    it('returns certification records with expiry dates (KB-01)', async () => {
      const { db } = await import('../../server/db');

      // Mock chain: db.select().from().where().limit()
      const mockCerts = [
        {
          id: 1,
          propertyId: 1,
          certificationType: 'gas_safety',
          certificateNumber: 'GS-001',
          issuedBy: 'Gas Safe Engineer',
          inspectionDate: new Date('2024-01-15'),
          issueDate: new Date('2024-01-15'),
          expiryDate: new Date('2025-01-15'),
          status: 'valid',
        },
      ];

      // Setup mock chain
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(mockCerts),
        }),
      });

      const result = await registry.invoke(
        'query_knowledge_base',
        { propertyId: 1, categories: ['certifications'] },
        createContext()
      );

      const output = result.output as any;
      expect(output.propertyId).toBe(1);
      expect(output.certifications).toHaveLength(1);
      expect(output.certifications[0].certificationType).toBe('gas_safety');
      expect(output.certifications[0].expiryDate).toBeDefined();
    });
  });

  describe('maintenance', () => {
    it('returns maintenance history linked to contractors (KB-03)', async () => {
      const { db } = await import('../../server/db');

      const mockTickets = [
        {
          id: 10,
          propertyId: 1,
          title: 'Boiler repair',
          category: 'heating',
          urgency: 'urgent',
          status: 'completed',
          createdAt: new Date('2024-06-01'),
          resolvedAt: new Date('2024-06-03'),
          assignedContractorId: 5,
        },
      ];

      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(mockTickets),
            }),
          }),
        }),
      });

      const result = await registry.invoke(
        'query_knowledge_base',
        { propertyId: 1, categories: ['maintenance_history'] },
        createContext()
      );

      const output = result.output as any;
      expect(output.propertyId).toBe(1);
      expect(output.recentMaintenance).toHaveLength(1);
      expect(output.recentMaintenance[0].title).toBe('Boiler repair');
      expect(output.recentMaintenance[0].status).toBe('completed');
    });
  });

  describe('performance', () => {
    it('query completes under 100ms (KB-04)', async () => {
      const { db } = await import('../../server/db');

      // Fast-resolving mocks
      (db.select as any).mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await registry.invoke(
        'query_knowledge_base',
        { propertyId: 1, categories: ['certifications'] },
        createContext()
      );

      expect(result.durationMs).toBeLessThan(100);
    });
  });
});
