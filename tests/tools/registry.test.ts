import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from '../../server/agents/tools/registry';
import type { ToolDefinition, ToolContext } from '../../server/agents/tools/types';

// Mock tool for testing
function createMockTool(overrides: Partial<ToolDefinition> = {}): ToolDefinition {
  return {
    name: 'mock_tool',
    description: 'A mock tool for testing',
    inputSchema: z.object({ query: z.string() }),
    outputSchema: z.object({ result: z.string() }),
    permissions: ['sales', 'rental'],
    tier: 'autonomous',
    execute: async (input: { query: string }) => ({ result: `found: ${input.query}` }),
    ...overrides,
  };
}

function createContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    agentType: 'sales',
    conversationId: null,
    contactId: null,
    channel: 'email',
    ...overrides,
  };
}

describe('Tool Registry', () => {
  let registry: ToolRegistry;

  beforeEach(() => {
    registry = new ToolRegistry();
  });

  it('registers a tool by name', () => {
    const tool = createMockTool();
    registry.register(tool);
    expect(registry.hasTool('mock_tool')).toBe(true);
    expect(registry.getToolNames()).toContain('mock_tool');
  });

  it('invokes a tool with valid input and returns typed output', async () => {
    const tool = createMockTool();
    registry.register(tool);
    const result = await registry.invoke('mock_tool', { query: 'test' }, createContext());
    expect(result.output).toEqual({ result: 'found: test' });
    expect(result.toolName).toBe('mock_tool');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('rejects unauthorized agent type (AGENT-02)', async () => {
    const tool = createMockTool({ permissions: ['maintenance'] });
    registry.register(tool);
    await expect(
      registry.invoke('mock_tool', { query: 'test' }, createContext({ agentType: 'sales' }))
    ).rejects.toThrow(/permission|unauthorized|not allowed/i);
  });

  it('validates input with Zod - invalid input throws ZodError (AGENT-02)', async () => {
    const tool = createMockTool();
    registry.register(tool);
    await expect(
      registry.invoke('mock_tool', { query: 123 }, createContext())
    ).rejects.toThrow(); // ZodError
  });

  it('throws for unknown tool name', async () => {
    await expect(
      registry.invoke('nonexistent_tool', {}, createContext())
    ).rejects.toThrow(/unknown tool/i);
  });

  it('getOpenAITools filters by agent type', () => {
    const salesTool = createMockTool({ name: 'sales_tool', permissions: ['sales'] });
    const maintenanceTool = createMockTool({ name: 'maint_tool', permissions: ['maintenance'] });
    registry.register(salesTool);
    registry.register(maintenanceTool);

    const salesTools = registry.getOpenAITools('sales');
    expect(salesTools).toHaveLength(1);
    expect(salesTools[0].type).toBe('function');
    expect(salesTools[0].function.name).toBe('sales_tool');
    expect(salesTools[0].function.parameters).toBeDefined();
  });

  it('getOpenAITools returns correct OpenAI function schema format', () => {
    const tool = createMockTool({
      inputSchema: z.object({
        name: z.string(),
        count: z.number().optional(),
        active: z.boolean(),
      }),
    });
    registry.register(tool);

    const tools = registry.getOpenAITools('sales');
    expect(tools).toHaveLength(1);
    const fn = tools[0].function;
    expect(fn.name).toBe('mock_tool');
    expect(fn.description).toBe('A mock tool for testing');
    expect(fn.parameters.type).toBe('object');
    expect(fn.parameters.properties.name).toEqual({ type: 'string' });
    expect(fn.parameters.properties.count).toEqual({ type: 'number' });
    expect(fn.parameters.properties.active).toEqual({ type: 'boolean' });
    expect(fn.parameters.required).toContain('name');
    expect(fn.parameters.required).toContain('active');
    expect(fn.parameters.required).not.toContain('count');
  });
});
