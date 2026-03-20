/**
 * Follow-Up Scheduling Tests
 *
 * Tests for pg-boss job scheduling (follow-ups and viewing reminders),
 * opt-out checking, and audit logging of scheduled message delivery.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../server/db', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: 1 }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  pool: { query: vi.fn() },
}));

vi.mock('@shared/schema', () => ({
  conversations: {},
  messages: { id: 'id', conversationId: 'conversation_id', direction: 'direction', isAiGenerated: 'is_ai_generated', createdAt: 'created_at' },
  agentAuditLog: { id: 'id', conversationId: 'conversation_id', action: 'action' },
  contactIdentities: { identifierValue: 'identifier_value', optedOut: 'opted_out' },
  staffProfiles: { id: 'id' },
  users: { id: 'id' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  or: vi.fn(),
}));

const mockSendPreferred = vi.fn().mockResolvedValue(true);
const mockSend = vi.fn().mockResolvedValue(true);

vi.mock('../../server/agents/services/messageSender', () => ({
  messageSender: {
    send: mockSend,
    sendPreferred: mockSendPreferred,
  },
}));

const mockLogToolCall = vi.fn().mockResolvedValue(undefined);

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: {
    logResponse: vi.fn().mockResolvedValue(undefined),
    logEscalation: vi.fn().mockResolvedValue(undefined),
    logToolCall: mockLogToolCall,
    logRouting: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockPgBossSend = vi.fn().mockResolvedValue('job-id-123');
const mockPgBossWork = vi.fn();
const mockPgBossStart = vi.fn();

vi.mock('pg-boss', () => {
  const MockPgBoss = vi.fn().mockImplementation(function (this: any) {
    this.send = mockPgBossSend;
    this.work = mockPgBossWork;
    this.start = mockPgBossStart;
  });
  return { default: MockPgBoss };
});

describe('Follow-Up Scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scheduleFollowUp', () => {
    it('should queue 3 jobs with correct startAfter dates (Day 1/3/7)', async () => {
      const { scheduledMessageService } = await import('../../server/agents/services/scheduledMessages');

      await scheduledMessageService.scheduleFollowUp(
        '+447700900000',
        'whatsapp',
        'buyer',
        [10, 20],
      );

      expect(mockPgBossSend).toHaveBeenCalledTimes(3);

      const jobNames = mockPgBossSend.mock.calls.map((c: any[]) => c[0]);
      expect(jobNames).toContain('follow-up-thanks');
      expect(jobNames).toContain('follow-up-similar');
      expect(jobNames).toContain('follow-up-checkin');

      // Check startAfter options contain correct delays
      const thanksCall = mockPgBossSend.mock.calls.find((c: any[]) => c[0] === 'follow-up-thanks');
      const similarCall = mockPgBossSend.mock.calls.find((c: any[]) => c[0] === 'follow-up-similar');
      const checkinCall = mockPgBossSend.mock.calls.find((c: any[]) => c[0] === 'follow-up-checkin');

      // Day 1 = 86400 seconds
      expect(thanksCall![2]).toEqual(expect.objectContaining({ startAfter: 86400 }));
      // Day 3 = 259200 seconds
      expect(similarCall![2]).toEqual(expect.objectContaining({ startAfter: 259200 }));
      // Day 7 = 604800 seconds
      expect(checkinCall![2]).toEqual(expect.objectContaining({ startAfter: 604800 }));
    });
  });

  describe('scheduleViewingReminders', () => {
    it('should queue 2 jobs (24h before + morning-of)', async () => {
      const { scheduledMessageService } = await import('../../server/agents/services/scheduledMessages');

      const viewingDate = new Date('2026-04-01T14:00:00Z');

      await scheduledMessageService.scheduleViewingReminders(
        42,
        '+447700900000',
        'whatsapp',
        viewingDate,
      );

      const reminderCalls = mockPgBossSend.mock.calls.filter(
        (c: any[]) => c[0] === 'viewing-reminder'
      );
      expect(reminderCalls).toHaveLength(2);

      // Check job data includes viewingId and type
      const jobDatas = reminderCalls.map((c: any[]) => c[1]);
      const types = jobDatas.map((d: any) => d.type);
      expect(types).toContain('24h');
      expect(types).toContain('morning');
    });
  });

  describe('opt-out checking', () => {
    it('should skip sending if contact has opted out', async () => {
      const { scheduledMessageService } = await import('../../server/agents/services/scheduledMessages');

      // Mock checkOptOut to return true (opted out)
      vi.spyOn(scheduledMessageService, 'checkOptOut').mockResolvedValue(true);

      // Simulate a worker processing a follow-up job
      const skipped = await scheduledMessageService.processFollowUpJob({
        contactPhone: '+447700900000',
        channel: 'whatsapp',
        leadType: 'buyer',
        propertyIds: [],
        messageType: 'follow-up-thanks',
      });

      expect(skipped).toBe(false); // returns false = not sent
      expect(mockSendPreferred).not.toHaveBeenCalled();
    });
  });

  describe('audit logging', () => {
    it('should log delivery via auditLogger after sending scheduled message', async () => {
      const { scheduledMessageService } = await import('../../server/agents/services/scheduledMessages');

      vi.spyOn(scheduledMessageService, 'checkOptOut').mockResolvedValue(false);

      await scheduledMessageService.processFollowUpJob({
        contactPhone: '+447700900000',
        channel: 'whatsapp',
        leadType: 'buyer',
        propertyIds: [],
        messageType: 'follow-up-thanks',
      });

      expect(mockSendPreferred).toHaveBeenCalled();
      expect(mockLogToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          agentType: 'supervisor',
          toolName: 'scheduled_message',
        }),
      );
    });
  });
});
