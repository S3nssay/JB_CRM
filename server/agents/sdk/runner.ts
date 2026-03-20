/**
 * Agent Runner
 *
 * Executes an OpenAI Agents SDK agent with conversation history,
 * AI identification (UK compliance), audit logging, and message storage.
 */

import { run } from '@openai/agents';
import { conversationStore } from '../channels/conversationStore';
import { auditLogger } from '../middleware/auditLogger';
import { ensureAIIdentification, isFirstAIMessage } from '../middleware/aiIdentification';
import type { AgentContext } from './context';

/**
 * Run an agent against a message with full conversation context.
 *
 * Pipeline:
 *  1. Load conversation history (last 20 messages) for context
 *  2. Format as OpenAI messages array
 *  3. Call SDK run() with history + new message
 *  4. Apply AI identification on first message (UK compliance)
 *  5. Store outbound message in ConversationStore
 *  6. Log response via AuditLogger
 *  7. Return the response text
 */
export async function runAgent(
  agent: any,
  messageText: string,
  context: AgentContext,
): Promise<string> {
  const start = performance.now();

  // 1. Load conversation history
  const history = await conversationStore.getConversationHistory(
    context.conversationId,
    20,
  );

  // 2. Format history as OpenAI messages (oldest first)
  const historyMessages = history
    .reverse() // getConversationHistory returns newest first
    .map((msg: any) => ({
      role: msg.direction === 'inbound' ? 'user' as const : 'assistant' as const,
      content: msg.content || '',
    }));

  // 3. Run the agent with history + new message
  const allMessages = [
    ...historyMessages,
    { role: 'user' as const, content: messageText },
  ];

  const result = await run(agent, allMessages, {
    context,
    maxTurns: 10,
  });

  let responseText = result.finalOutput || '';

  // 4. AI identification on first message (UK compliance)
  const isFirst = await isFirstAIMessage(context.conversationId);
  responseText = ensureAIIdentification(responseText, isFirst);

  // 5. Store outbound message
  await conversationStore.storeMessage(
    context.conversationId,
    {
      from: 'agent',
      body: responseText,
      channel: context.channel,
      timestamp: new Date(),
    },
    'outbound',
    context.agentType,
  );

  // 6. Audit log
  const durationMs = Math.round(performance.now() - start);
  await auditLogger.logResponse({
    agentType: context.agentType,
    conversationId: context.conversationId,
    channel: context.channel,
    durationMs,
  }).catch(() => {});

  // 7. Return response
  return responseText;
}
