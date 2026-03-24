/**
 * Conversation Store
 * Manages conversation persistence and message storage for the channel gateway.
 */

import { eq, and, desc } from 'drizzle-orm';
import { db } from '../../db';
import { conversations, messages } from '@shared/schema';
import type { CommunicationChannel } from '../types';
import type { ResolvedContact, NormalizedMessage } from './types';

export class ConversationStore {
  /**
   * Find an existing open conversation for a contact, or create a new one.
   * Returns the conversation id and whether it was newly created.
   */
  async findOrCreateConversation(
    contact: ResolvedContact,
    channel: CommunicationChannel,
  ): Promise<{ id: number; isNew: boolean }> {
    // Look for most recent open conversation for this contact
    const existing = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.resolvedContactId, contact.contactIdentityId),
          eq(conversations.status, 'open'),
        )
      )
      .orderBy(desc(conversations.updatedAt))
      .limit(1);

    if (existing.length > 0) {
      // Update lastChannel to reflect the channel of this new message
      await db
        .update(conversations)
        .set({
          lastChannel: channel,
          updatedAt: new Date(),
        })
        .where(eq(conversations.id, existing[0].id));

      return { id: existing[0].id, isNew: false };
    }

    // Create new conversation with AI agent fields
    const [newConversation] = await db
      .insert(conversations)
      .values({
        contactName: contact.identifierValue, // Use identifier as name until resolved
        contactPhone: contact.identifierValue,
        source: 'ai_agent',
        contactType: contact.contactType,
        lastChannel: channel,
        resolvedContactId: contact.contactIdentityId,
        status: 'open',
        priority: 'normal',
        unreadCount: 1,
      })
      .returning();

    return { id: newConversation.id, isNew: true };
  }

  /**
   * Store a message in the messages table.
   * Returns the new message id.
   */
  async storeMessage(
    conversationId: number,
    msg: NormalizedMessage,
    direction: 'inbound' | 'outbound',
    agentType?: string,
  ): Promise<number> {
    const [newMessage] = await db
      .insert(messages)
      .values({
        conversationId,
        channel: msg.channel,
        direction,
        fromAddress: msg.from,
        content: msg.body,
        status: direction === 'inbound' ? 'delivered' : 'sent',
        sentAt: msg.timestamp,
        externalMessageId: msg.externalId ?? null,
        metadata: msg.metadata ?? null,
        agentType: agentType ?? null,
        isAiGenerated: direction === 'outbound' && !!agentType,
      })
      .returning();

    // Update conversation's last message info
    await db
      .update(conversations)
      .set({
        lastMessageAt: msg.timestamp,
        lastMessagePreview: msg.body.slice(0, 200),
        updatedAt: new Date(),
      })
      .where(eq(conversations.id, conversationId));

    return newMessage.id;
  }

  /**
   * Get conversation history (messages) for a conversation.
   */
  async getConversationHistory(conversationId: number, limit: number = 50) {
    return db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(desc(messages.createdAt))
      .limit(limit);
  }

  /**
   * Get all conversations for a contact (by contact identity ID).
   * Optionally filter by agent type from the conversation's messages.
   */
  async getConversationsForContact(
    contactId: number,
    options?: { agentType?: string; limit?: number },
  ) {
    const limit = options?.limit ?? 20;

    // Query conversations for this contact identity
    let convos = await db
      .select()
      .from(conversations)
      .where(eq(conversations.resolvedContactId, contactId))
      .orderBy(desc(conversations.updatedAt))
      .limit(limit);

    // If agentType filter is specified, filter by conversations that have messages from that agent
    if (options?.agentType && convos.length > 0) {
      const convoIds = convos.map(c => c.id);
      const agentMessages = await db
        .select({ conversationId: messages.conversationId })
        .from(messages)
        .where(
          and(
            eq(messages.agentType, options.agentType),
          )
        )
        .limit(500);

      const agentConvoIds = new Set(agentMessages.map(m => m.conversationId));
      convos = convos.filter(c => agentConvoIds.has(c.id));
    }

    return convos;
  }
}

/** Singleton instance */
export const conversationStore = new ConversationStore();
