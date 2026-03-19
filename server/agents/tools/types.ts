import { z } from 'zod';
import type { AgentType, CommunicationChannel } from '../types';

export interface ToolDefinition<TInput extends z.ZodType = z.ZodType, TOutput extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  inputSchema: TInput;
  outputSchema: TOutput;
  permissions: AgentType[];
  tier: 'autonomous' | 'confirm' | 'human_only';
  execute: (input: z.infer<TInput>, context: ToolContext) => Promise<z.infer<TOutput>>;
}

export interface ToolContext {
  agentType: AgentType;
  conversationId: number | null;
  contactId: number | null;
  channel: CommunicationChannel;
}

export interface ToolInvocationResult {
  output: unknown;
  durationMs: number;
  toolName: string;
}
