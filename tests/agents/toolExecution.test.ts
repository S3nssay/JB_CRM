/**
 * SDK Tool Wrappers — Unit Tests
 *
 * Tests that wrapped SDK tools delegate to toolRegistry.invoke(),
 * and that escalateToHumanTool calls escalationService.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before imports
vi.mock('../../server/agents/tools/registry', () => ({
  toolRegistry: {
    invoke: vi.fn(),
  },
}));

vi.mock('../../server/agents/services/escalationService', () => ({
  escalationService: {
    escalate: vi.fn(),
  },
}));

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logEscalation: vi.fn().mockResolvedValue(undefined),
    logToolCall: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock the database module
vi.mock('../../server/db', () => ({
  db: {},
  pool: {},
}));

// Mock @openai/agents to avoid zod v4 resolution issues in tests
vi.mock('@openai/agents', () => ({
  tool: (config: any) => ({
    type: 'function',
    name: config.name,
    description: config.description,
    parameters: config.parameters,
    // Expose execute for direct testing
    execute: config.execute,
    invoke: async (_ctx: any, input: string) => {
      const parsed = JSON.parse(input);
      return config.execute({}, parsed);
    },
  }),
  Agent: vi.fn(),
  handoff: vi.fn(),
  run: vi.fn(),
}));

// Mock zod4 with regular zod (v3) for tests
vi.mock('zod4', async () => {
  return await import('zod');
});

import { toolRegistry } from '../../server/agents/tools/registry';
import { escalationService } from '../../server/agents/services/escalationService';
import { auditLogger } from '../../server/agents/middleware/auditLogger';

describe('SDK Tool Wrappers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('wrapRegistryTool', () => {
    it('should create a tool that delegates to toolRegistry.invoke', async () => {
      const { searchPropertiesTool } = await import('../../server/agents/sdk/tools');

      const mockResult = { output: { properties: [{ id: 1 }] }, durationMs: 50, toolName: 'search_properties' };
      (toolRegistry.invoke as any).mockResolvedValue(mockResult);

      const input = { type: 'rental', area: 'Brixton' };
      const context = { conversationId: 1, contactId: 2, channel: 'whatsapp', isFirstMessage: false, agentType: 'sales' };

      const result = await searchPropertiesTool.execute(context, input);

      expect(toolRegistry.invoke).toHaveBeenCalledWith(
        'search_properties',
        input,
        expect.objectContaining({
          agentType: 'sales',
          conversationId: 1,
          contactId: 2,
          channel: 'whatsapp',
        })
      );
      expect(result).toContain('properties');
    });

    it('should create a tool for query_knowledge_base', async () => {
      const { queryKnowledgeBaseTool } = await import('../../server/agents/sdk/tools');
      expect(queryKnowledgeBaseTool).toBeDefined();
      expect(queryKnowledgeBaseTool.name).toBe('query_knowledge_base');
    });

    it('should create a tool for create_lead', async () => {
      const { createLeadTool } = await import('../../server/agents/sdk/tools');
      expect(createLeadTool).toBeDefined();
      expect(createLeadTool.name).toBe('create_lead');
    });

    it('should create a tool for create_maintenance_ticket', async () => {
      const { createMaintenanceTicketTool } = await import('../../server/agents/sdk/tools');
      expect(createMaintenanceTicketTool).toBeDefined();
      expect(createMaintenanceTicketTool.name).toBe('create_maintenance_ticket');
    });

    it('should create a tool for book_viewing', async () => {
      const { bookViewingTool } = await import('../../server/agents/sdk/tools');
      expect(bookViewingTool).toBeDefined();
      expect(bookViewingTool.name).toBe('book_viewing');
    });
  });

  describe('escalateToHumanTool', () => {
    it('should call escalationService.escalate and auditLogger', async () => {
      const { escalateToHumanTool } = await import('../../server/agents/sdk/tools');

      (escalationService.escalate as any).mockResolvedValue({
        escalationId: 42,
        assignedTo: 5,
        notified: true,
      });

      const context = {
        conversationId: 10,
        contactId: 3,
        channel: 'whatsapp' as const,
        isFirstMessage: false,
        agentType: 'supervisor' as const,
      };

      const result = await escalateToHumanTool.execute(context, {
        reason: 'Customer wants to speak to a human',
        urgency: 'normal',
      });

      expect(escalationService.escalate).toHaveBeenCalledWith(
        expect.objectContaining({
          conversationId: 10,
          reason: 'Customer wants to speak to a human',
          urgency: 'normal',
          channel: 'whatsapp',
        })
      );
      expect(auditLogger.logEscalation).toHaveBeenCalled();
      expect(result).toContain('Escalated');
    });
  });
});
