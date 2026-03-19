import { describe, it, expect } from 'vitest';

describe('Channel Gateway', () => {
  it('sanity check', () => {
    expect(true).toBe(true);
  });

  describe('threading', () => {
    it.todo('threads SMS into existing conversation (CHAN-01)');
    it.todo('threads WhatsApp into existing conversation (CHAN-01)');
  });

  it.todo('creates new conversation for unknown sender (CHAN-01)');
});
