import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
  pool: {
    query: vi.fn(),
  },
}));

import { ConversationStore } from '../../server/agents/channels/conversationStore';
import type { ResolvedContact, NormalizedMessage } from '../../server/agents/channels/types';

describe('Conversation Store', () => {
  let store: ConversationStore;

  const mockContact: ResolvedContact = {
    contactIdentityId: 1,
    contactId: 42,
    contactType: 'tenant',
    identifierValue: '+447700900000',
  };

  const mockMessage: NormalizedMessage = {
    from: '+447700900000',
    body: 'Hello, I need help with my property',
    channel: 'sms',
    timestamp: new Date('2026-03-19T12:00:00Z'),
  };

  beforeEach(() => {
    store = new ConversationStore();
    vi.clearAllMocks();
  });

  describe('findOrCreateConversation', () => {
    it('creates conversation with AI agent fields - source, agentType persisted (AGENT-04)', async () => {
      const { db } = await import('../../server/db');

      // Mock: no existing conversation
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
      });
      (db as any).select = mockSelect;

      // Mock: insert new conversation
      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{
          id: 10,
          source: 'ai_agent',
          contactType: 'tenant',
          lastChannel: 'sms',
        }]),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: insertValues,
      });
      (db as any).insert = mockInsert;

      const result = await store.findOrCreateConversation(mockContact, 'sms');
      expect(result.id).toBe(10);
      expect(result.isNew).toBe(true);

      // Verify the inserted values include AI agent fields
      const insertedData = insertValues.mock.calls[0][0];
      expect(insertedData.source).toBe('ai_agent');
      expect(insertedData.contactType).toBe('tenant');
      expect(insertedData.lastChannel).toBe('sms');
    });

    it('continues existing conversation - messages append to same thread (AGENT-04)', async () => {
      const { db } = await import('../../server/db');

      // Mock: existing open conversation found
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{
                id: 5,
                status: 'open',
                lastChannel: 'sms',
              }]),
            }),
          }),
        }),
      });
      (db as any).select = mockSelect;

      // Mock: update lastChannel
      const mockUpdate = vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db as any).update = mockUpdate;

      const result = await store.findOrCreateConversation(mockContact, 'whatsapp');
      expect(result.id).toBe(5);
      expect(result.isNew).toBe(false);
    });
  });

  describe('storeMessage', () => {
    it('inserts a message row and returns message id', async () => {
      const { db } = await import('../../server/db');

      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: 100 }]),
        }),
      });
      (db as any).insert = mockInsert;

      const msgId = await store.storeMessage(10, mockMessage, 'inbound');
      expect(msgId).toBe(100);
    });

    it('stores message with correct fields from NormalizedMessage', async () => {
      const { db } = await import('../../server/db');

      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 101 }]),
      });
      const mockInsert = vi.fn().mockReturnValue({
        values: insertValues,
      });
      (db as any).insert = mockInsert;

      await store.storeMessage(10, mockMessage, 'inbound', 'office_admin');

      const stored = insertValues.mock.calls[0][0];
      expect(stored.conversationId).toBe(10);
      expect(stored.channel).toBe('sms');
      expect(stored.direction).toBe('inbound');
      expect(stored.content).toBe('Hello, I need help with my property');
      expect(stored.fromAddress).toBe('+447700900000');
      expect(stored.agentType).toBe('office_admin');
    });
  });
});
