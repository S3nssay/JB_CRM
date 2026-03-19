/**
 * AI Self-Identification Middleware
 * UK compliance requirement: first outbound AI message must identify itself as AI.
 * Subsequent messages in the same conversation are not prefixed.
 */

import { db } from '../../db';
import { messages } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * The AI self-identification statement prepended to first messages.
 */
export const AI_IDENTIFICATION_STATEMENT =
  "I'm an AI assistant at John Barclay Estate Agents.";

/**
 * Prepends AI identification to the response if this is the first AI message
 * in the conversation. Returns the response unchanged for subsequent messages.
 */
export function ensureAIIdentification(
  agentResponse: string,
  isFirstMessage: boolean
): string {
  if (isFirstMessage) {
    return `${AI_IDENTIFICATION_STATEMENT} ${agentResponse}`;
  }
  return agentResponse;
}

/**
 * Checks whether any AI-generated outbound messages exist for the given conversation.
 * Returns true if this would be the first AI message (no existing AI outbound messages).
 */
export async function isFirstAIMessage(conversationId: number): Promise<boolean> {
  const existing = await db
    .select({ id: messages.id })
    .from(messages)
    .where(
      and(
        eq(messages.conversationId, conversationId),
        eq(messages.direction, 'outbound'),
        eq(messages.isAiGenerated, true)
      )
    );

  return existing.length === 0;
}
