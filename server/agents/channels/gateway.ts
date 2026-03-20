/**
 * Channel Gateway
 * Normalises inbound messages from any channel, resolves contacts,
 * threads conversations, and stores messages.
 *
 * This is the pure logic layer. Webhook Express routes are wired in Phase 2.
 */

import type { CommunicationChannel } from '../types';
import type { ChannelAdapter, InboundResult } from './types';
import { contactResolver } from './contactResolver';
import { conversationStore } from './conversationStore';
import { SmsAdapter } from './adapters/smsAdapter';
import { WhatsAppAdapter } from './adapters/whatsappAdapter';
import { EmailAdapter } from './adapters/emailAdapter';

export class ChannelGateway {
  private adapters: Map<CommunicationChannel, ChannelAdapter>;

  constructor() {
    this.adapters = new Map();
    this.adapters.set('sms', new SmsAdapter());
    this.adapters.set('whatsapp', new WhatsAppAdapter());
    this.adapters.set('email', new EmailAdapter());
  }

  /**
   * Process an inbound message from any supported channel.
   *
   * Pipeline: normalize -> resolve contact -> find/create conversation -> store message
   *
   * Returns conversation/message IDs and contact info for downstream agent routing.
   */
  async processInbound(
    channel: CommunicationChannel,
    payload: unknown,
  ): Promise<InboundResult> {
    // 1. Normalize via channel adapter
    const adapter = this.adapters.get(channel);
    if (!adapter) {
      throw new Error(`No adapter registered for channel: ${channel}`);
    }
    const normalizedMessage = adapter.normalize(payload);

    // 2. Resolve contact identity
    const contact = await contactResolver.resolve(normalizedMessage.from, channel);

    // 3. Find or create conversation thread
    const conversation = await conversationStore.findOrCreateConversation(contact, channel);

    // 4. Store the inbound message
    const messageId = await conversationStore.storeMessage(
      conversation.id,
      normalizedMessage,
      'inbound',
    );

    return {
      conversationId: conversation.id,
      messageId,
      contact,
      isNewConversation: conversation.isNew,
    };
  }

  /**
   * Register a custom adapter for a channel.
   */
  registerAdapter(channel: CommunicationChannel, adapter: ChannelAdapter): void {
    this.adapters.set(channel, adapter);
  }
}

/** Singleton instance */
export const channelGateway = new ChannelGateway();
