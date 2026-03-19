import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing the resolver
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

import { ContactResolver, normalizePhone } from '../../server/agents/channels/contactResolver';

describe('Contact Identity Resolution', () => {
  let resolver: ContactResolver;

  beforeEach(() => {
    resolver = new ContactResolver();
    vi.clearAllMocks();
  });

  describe('normalizePhone', () => {
    it('converts UK mobile 07xxx to +447xxx', () => {
      expect(normalizePhone('07700900000')).toBe('+447700900000');
    });

    it('passes through already-E.164 numbers', () => {
      expect(normalizePhone('+447700900000')).toBe('+447700900000');
    });

    it('strips spaces and dashes', () => {
      expect(normalizePhone('077 0090-0000')).toBe('+447700900000');
    });

    it('converts 0044 prefix to +44', () => {
      expect(normalizePhone('00447700900000')).toBe('+447700900000');
    });

    it('handles numbers with parentheses', () => {
      expect(normalizePhone('(07700) 900000')).toBe('+447700900000');
    });
  });

  describe('resolve', () => {
    it('resolves known phone to existing contact identity (CHAN-02)', async () => {
      const { db } = await import('../../server/db');
      // Mock: contact_identity table has a match
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{
            id: 1,
            contactId: 42,
            contactType: 'tenant',
            identifierValue: '+447700900000',
          }]),
        }),
      });
      (db as any).select = mockSelect;

      const result = await resolver.resolve('+447700900000', 'sms');
      expect(result.contactIdentityId).toBe(1);
      expect(result.contactId).toBe(42);
      expect(result.contactType).toBe('tenant');
    });

    it('creates new identity for unknown sender (CHAN-02)', async () => {
      const { db } = await import('../../server/db');

      // Mock: no match in contact_identity
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });
      (db as any).select = mockSelect;

      // Mock: no match in CRM tables (pool.query for tenant, landlord, leads)
      const { pool } = await import('../../server/db');
      (pool.query as any).mockResolvedValue({ rows: [] });

      // Mock: insert returns new identity
      const mockInsert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{
            id: 99,
            contactId: 0,
            contactType: 'unknown',
            identifierValue: '+447700900000',
          }]),
        }),
      });
      (db as any).insert = mockInsert;

      const result = await resolver.resolve('+447700900000', 'sms');
      expect(result.contactIdentityId).toBe(99);
      expect(result.contactId).toBe(0);
      expect(result.contactType).toBe('unknown');
    });

    it('normalizes phone to E.164 before lookup - +44 and 07 resolve same (CHAN-02)', async () => {
      const { db } = await import('../../server/db');

      // Track what identifier is used for lookup
      const whereCalls: any[] = [];
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockImplementation((...args: any[]) => {
            whereCalls.push(args);
            return Promise.resolve([{
              id: 1,
              contactId: 42,
              contactType: 'tenant',
              identifierValue: '+447700900000',
            }]);
          }),
        }),
      });
      (db as any).select = mockSelect;

      const result1 = await resolver.resolve('07700900000', 'sms');
      const result2 = await resolver.resolve('+447700900000', 'whatsapp');

      // Both should resolve to the same contact
      expect(result1.contactIdentityId).toBe(result2.contactIdentityId);
      expect(result1.contactId).toBe(result2.contactId);
    });
  });
});
