import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types';

const FOLLOWUP_INTERVAL_HOURS: Record<string, number> = {
  emergency: 24,
  urgent: 48,
  routine: 72,
  low: 96,
};

const inputSchema = z.object({
  workOrderId: z.number(),
  urgency: z.string(),
});

const outputSchema = z.object({
  scheduled: z.boolean(),
  followupsCount: z.number(),
  intervalHours: z.number(),
});

export const scheduleWorkOrderFollowupTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'schedule_work_order_followup',
  description:
    'Schedule automated follow-up checks for a work order. Queues contractor progress checks, tenant satisfaction checks, and completion verification.',
  inputSchema,
  outputSchema,
  permissions: ['maintenance', 'supervisor'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    // Lazy import to avoid DB connection at module load
    const { workOrderFollowupService } = await import('../../services/workOrderFollowup');

    await workOrderFollowupService.scheduleFollowups(input.workOrderId, input.urgency);

    const intervalHours = FOLLOWUP_INTERVAL_HOURS[input.urgency] ?? 72;

    return {
      scheduled: true,
      followupsCount: 3,
      intervalHours,
    };
  },
};
