import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock contactResolver and conversationStore
vi.mock('../../server/agents/channels/contactResolver', () => ({
  contactResolver: {
    resolve: vi.fn(),
  },
  ContactResolver: vi.fn(),
}));

vi.mock('../../server/agents/channels/conversationStore', () => ({
  conversationStore: {
    findOrCreateConversation: vi.fn(),
    storeMessage: vi.fn(),
  },
  ConversationStore: vi.fn(),
}));

import { ChannelGateway } from '../../server/agents/channels/gateway';
import { contactResolver } from '../../server/agents/channels/contactResolver';
import { conversationStore } from '../../server/agents/channels/conversationStore';
import type { ResolvedContact } from '../../server/agents/channels/types';

describe('Channel Gateway', () => {
  let gateway: ChannelGateway;

  const mockContact: ResolvedContact = {
    contactIdentityId: 1,
    contactId: 42,
    contactType: 'tenant',
    identifierValue: '+447700900000',
  };

  beforeEach(() => {
    gateway = new ChannelGateway();
    vi.clearAllMocks();

    // Default mocks
    (contactResolver.resolve as any).mockResolvedValue(mockContact);
    (conversationStore.findOrCreateConversation as any).mockResolvedValue({ id: 10, isNew: true });
    (conversationStore.storeMessage as any).mockResolvedValue(100);
  });

  describe('SMS processing', () => {
    const twilioSmsPayload = {
      From: '+447700900000',
      Body: 'Hello, I need help',
      MessageSid: 'SM123abc',
      To: '+441234567890',
    };

    it('normalises SMS payload and stores message (CHAN-01)', async () => {
      const result = await gateway.processInbound('sms', twilioSmsPayload);

      expect(result.conversationId).toBe(10);
      expect(result.messageId).toBe(100);
      expect(result.contact).toEqual(mockContact);
      expect(result.isNewConversation).toBe(true);
    });

    it('resolves contact from SMS sender phone', async () => {
      await gateway.processInbound('sms', twilioSmsPayload);

      expect(contactResolver.resolve).toHaveBeenCalledWith('+447700900000', 'sms');
    });

    it('stores message with correct channel and content', async () => {
      await gateway.processInbound('sms', twilioSmsPayload);

      expect(conversationStore.storeMessage).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          from: '+447700900000',
          body: 'Hello, I need help',
          channel: 'sms',
          externalId: 'SM123abc',
        }),
        'inbound',
      );
    });
  });

  describe('WhatsApp processing', () => {
    const twilioWhatsAppPayload = {
      From: 'whatsapp:+447700900000',
      Body: 'WhatsApp message here',
      MessageSid: 'WA456def',
      To: 'whatsapp:+441234567890',
    };

    it('normalises WhatsApp payload stripping whatsapp: prefix (CHAN-01)', async () => {
      await gateway.processInbound('whatsapp', twilioWhatsAppPayload);

      // Should strip "whatsapp:" prefix before resolving
      expect(contactResolver.resolve).toHaveBeenCalledWith('+447700900000', 'whatsapp');
    });

    it('stores WhatsApp message with correct fields', async () => {
      const result = await gateway.processInbound('whatsapp', twilioWhatsAppPayload);

      expect(result.conversationId).toBe(10);
      expect(conversationStore.storeMessage).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          from: '+447700900000',
          body: 'WhatsApp message here',
          channel: 'whatsapp',
          externalId: 'WA456def',
        }),
        'inbound',
      );
    });
  });

  describe('threading', () => {
    it('threads SMS into existing conversation (CHAN-01)', async () => {
      (conversationStore.findOrCreateConversation as any).mockResolvedValue({ id: 5, isNew: false });

      const result = await gateway.processInbound('sms', {
        From: '+447700900000',
        Body: 'Follow-up message',
        MessageSid: 'SM789',
        To: '+441234567890',
      });

      expect(result.conversationId).toBe(5);
      expect(result.isNewConversation).toBe(false);
    });

    it('threads WhatsApp into existing conversation (CHAN-01)', async () => {
      (conversationStore.findOrCreateConversation as any).mockResolvedValue({ id: 5, isNew: false });

      const result = await gateway.processInbound('whatsapp', {
        From: 'whatsapp:+447700900000',
        Body: 'Another message',
        MessageSid: 'WA101',
        To: 'whatsapp:+441234567890',
      });

      expect(result.conversationId).toBe(5);
      expect(result.isNewConversation).toBe(false);
    });

    it('same phone via different channels resolves to same contact', async () => {
      await gateway.processInbound('sms', {
        From: '+447700900000',
        Body: 'SMS message',
        MessageSid: 'SM001',
        To: '+441234567890',
      });

      await gateway.processInbound('whatsapp', {
        From: 'whatsapp:+447700900000',
        Body: 'WhatsApp message',
        MessageSid: 'WA001',
        To: 'whatsapp:+441234567890',
      });

      // Both calls should resolve with the same phone number
      const calls = (contactResolver.resolve as any).mock.calls;
      expect(calls[0][0]).toBe('+447700900000');
      expect(calls[1][0]).toBe('+447700900000');
    });

    it('creates new conversation for unknown sender (CHAN-01)', async () => {
      const unknownContact: ResolvedContact = {
        contactIdentityId: 99,
        contactId: 0,
        contactType: 'unknown',
        identifierValue: '+447999999999',
      };
      (contactResolver.resolve as any).mockResolvedValue(unknownContact);
      (conversationStore.findOrCreateConversation as any).mockResolvedValue({ id: 20, isNew: true });

      const result = await gateway.processInbound('sms', {
        From: '+447999999999',
        Body: 'Who am I?',
        MessageSid: 'SM999',
        To: '+441234567890',
      });

      expect(result.isNewConversation).toBe(true);
      expect(result.contact.contactType).toBe('unknown');
    });
  });
});
