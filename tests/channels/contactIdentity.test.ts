import { describe, it, expect } from 'vitest';

describe('Contact Identity Resolution', () => {
  it('sanity check', () => {
    expect(true).toBe(true);
  });

  it.todo('resolves known phone to existing contact - returns correct contactId (CHAN-02)');
  it.todo('creates new identity for unknown sender - new row created');
  it.todo('normalizes phone to E.164 - +44 and 07 formats resolve to same identity');
});
