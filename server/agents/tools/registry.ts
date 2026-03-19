import { z } from 'zod';
import type { AgentType } from '../types';
import type { ToolDefinition, ToolContext, ToolInvocationResult } from './types';

/**
 * Converts a Zod object schema to JSON Schema for OpenAI function calling.
 * Supports: z.string, z.number, z.boolean, z.enum, z.array, z.optional wrappers.
 */
function zodToJsonSchema(schema: z.ZodType): Record<string, unknown> {
  // Unwrap ZodOptional / ZodDefault
  if (schema instanceof z.ZodOptional || schema instanceof z.ZodDefault) {
    return zodToJsonSchema((schema as any)._def.innerType);
  }

  if (schema instanceof z.ZodString) {
    return { type: 'string' };
  }
  if (schema instanceof z.ZodNumber) {
    return { type: 'number' };
  }
  if (schema instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }
  if (schema instanceof z.ZodEnum) {
    return { type: 'string', enum: (schema as any)._def.values };
  }
  if (schema instanceof z.ZodArray) {
    return { type: 'array', items: zodToJsonSchema((schema as any)._def.type) };
  }
  if (schema instanceof z.ZodObject) {
    const shape = (schema as any).shape;
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(shape)) {
      const zodVal = value as z.ZodType;
      properties[key] = zodToJsonSchema(zodVal);
      // If NOT optional/default, it's required
      if (!(zodVal instanceof z.ZodOptional) && !(zodVal instanceof z.ZodDefault)) {
        required.push(key);
      }
    }

    const result: Record<string, unknown> = { type: 'object', properties };
    if (required.length > 0) {
      result.required = required;
    }
    return result;
  }

  // Fallback
  return {};
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.name, tool);
  }

  async invoke(name: string, rawInput: unknown, context: ToolContext): Promise<ToolInvocationResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    // Permission check
    if (!tool.permissions.includes(context.agentType)) {
      throw new Error(
        `Agent type '${context.agentType}' is not allowed to use tool '${name}'. ` +
        `Allowed: ${tool.permissions.join(', ')}`
      );
    }

    // Validate input via Zod
    const parsedInput = tool.inputSchema.parse(rawInput);

    // Execute
    const start = performance.now();
    const output = await tool.execute(parsedInput, context);
    const durationMs = Math.round(performance.now() - start);

    // Validate output
    tool.outputSchema.parse(output);

    return { output, durationMs, toolName: name };
  }

  getOpenAITools(agentType: AgentType): Array<{
    type: 'function';
    function: { name: string; description: string; parameters: Record<string, unknown> };
  }> {
    const result: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }> = [];

    for (const tool of this.tools.values()) {
      if (tool.permissions.includes(agentType)) {
        result.push({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: zodToJsonSchema(tool.inputSchema),
          },
        });
      }
    }

    return result;
  }

  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}

// Singleton registry instance - tools are registered after definitions are imported
export const toolRegistry = new ToolRegistry();
