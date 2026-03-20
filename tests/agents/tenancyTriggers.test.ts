/**
 * Tenancy Event Hooks -- Unit Tests
 *
 * Tests that tenancy creation and status changes trigger
 * automatic checklist generation via fire-and-forget hooks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock checklistService
const mockGenerateChecklist = vi.fn().mockResolvedValue({ created: 10, items: ['item1'] });

vi.mock('../../server/agents/services/checklistService', () => ({
  checklistService: {
    generateChecklist: (...args: any[]) => mockGenerateChecklist(...args),
  },
}));

const mockAuditLogger = {
  logToolCall: vi.fn().mockResolvedValue(undefined),
  logResponse: vi.fn().mockResolvedValue(undefined),
  logEscalation: vi.fn().mockResolvedValue(undefined),
  logRouting: vi.fn().mockResolvedValue(undefined),
};

vi.mock('../../server/agents/middleware/auditLogger', () => ({
  auditLogger: mockAuditLogger,
}));

describe('onTenancyCreated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call generateChecklist("onboarding") when status is "active"', async () => {
    const { onTenancyCreated } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyCreated(100, 'active');

    expect(mockGenerateChecklist).toHaveBeenCalledWith(100, 'onboarding');
  });

  it('should call generateChecklist("onboarding") when status is "pending"', async () => {
    const { onTenancyCreated } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyCreated(200, 'pending');

    expect(mockGenerateChecklist).toHaveBeenCalledWith(200, 'onboarding');
  });

  it('should NOT call generateChecklist when status is "draft"', async () => {
    const { onTenancyCreated } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyCreated(300, 'draft');

    expect(mockGenerateChecklist).not.toHaveBeenCalled();
  });

  it('should log the trigger event to audit', async () => {
    const { onTenancyCreated } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyCreated(100, 'active');

    expect(mockAuditLogger.logToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        agentType: 'admin',
        toolName: 'auto_checklist_trigger',
      }),
    );
  });
});

describe('onTenancyStatusChanged', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should call generateChecklist("offboarding") when newStatus is "ending"', async () => {
    const { onTenancyStatusChanged } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyStatusChanged(100, 'active', 'ending');

    expect(mockGenerateChecklist).toHaveBeenCalledWith(100, 'offboarding');
  });

  it('should call generateChecklist("offboarding") when newStatus is "notice_served"', async () => {
    const { onTenancyStatusChanged } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyStatusChanged(100, 'active', 'notice_served');

    expect(mockGenerateChecklist).toHaveBeenCalledWith(100, 'offboarding');
  });

  it('should call generateChecklist("onboarding") when newStatus is "active" and oldStatus was "pending"', async () => {
    const { onTenancyStatusChanged } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyStatusChanged(100, 'pending', 'active');

    expect(mockGenerateChecklist).toHaveBeenCalledWith(100, 'onboarding');
  });

  it('should NOT call generateChecklist when newStatus is "active" and oldStatus was also "active"', async () => {
    const { onTenancyStatusChanged } = await import('../../server/agents/services/tenancyEventHooks');

    await onTenancyStatusChanged(100, 'active', 'active');

    expect(mockGenerateChecklist).not.toHaveBeenCalled();
  });

  it('should catch and log errors without throwing', async () => {
    mockGenerateChecklist.mockRejectedValueOnce(new Error('DB connection failed'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { onTenancyStatusChanged } = await import('../../server/agents/services/tenancyEventHooks');

    // Should not throw
    await expect(onTenancyStatusChanged(100, 'active', 'ending')).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('tenancy event hook'),
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });
});
