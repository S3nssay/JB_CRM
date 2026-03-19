import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock db module before importing
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

import {
  ensureAIIdentification,
  AI_IDENTIFICATION_STATEMENT,
  isFirstAIMessage,
} from '../../server/agents/middleware/aiIdentification';
import { db } from '../../server/db';

describe('AI Identification Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureAIIdentification', () => {
    it('prepends AI identification to first message in conversation (AGENT-06)', () => {
      const response = 'Thank you for your inquiry about the property.';
      const result = ensureAIIdentification(response, true);

      expect(result).toBe(`${AI_IDENTIFICATION_STATEMENT} ${response}`);
      expect(result).toContain("I'm an AI assistant at John Barclay Estate Agents.");
    });

    it('does not modify subsequent messages in conversation (AGENT-06)', () => {
      const response = 'The property has 3 bedrooms.';
      const result = ensureAIIdentification(response, false);

      expect(result).toBe(response);
      expect(result).not.toContain(AI_IDENTIFICATION_STATEMENT);
    });
  });

  describe('isFirstAIMessage', () => {
    it('returns true when no AI-generated outbound messages exist for conversation', async () => {
      // Mock: db.select().from().where() returns empty array
      const mockWhere = vi.fn().mockResolvedValue([]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await isFirstAIMessage(42);
      expect(result).toBe(true);
    });

    it('returns false when AI-generated outbound messages already exist', async () => {
      // Mock: db.select().from().where() returns a row
      const mockWhere = vi.fn().mockResolvedValue([{ id: 1 }]);
      const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
      (db.select as any).mockReturnValue({ from: mockFrom });

      const result = await isFirstAIMessage(42);
      expect(result).toBe(false);
    });
  });

  describe('AI_IDENTIFICATION_STATEMENT', () => {
    it('is a non-empty string containing John Barclay', () => {
      expect(AI_IDENTIFICATION_STATEMENT).toBeTruthy();
      expect(AI_IDENTIFICATION_STATEMENT).toContain('John Barclay');
      expect(AI_IDENTIFICATION_STATEMENT).toContain('AI');
    });
  });
});
