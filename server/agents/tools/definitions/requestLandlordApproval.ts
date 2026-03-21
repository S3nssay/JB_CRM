import { z } from 'zod';
import { landlordApprovalService } from '../../services/landlordApproval';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  ticketId: z.number(),
  landlordId: z.number(),
  quoteAmount: z.number(), // in pence
  contractorName: z.string(),
  faultDescription: z.string(),
  isEmergency: z.boolean(),
});

const outputSchema = z.object({
  status: z.string(),
  reason: z.string().optional(),
  landlordContacted: z.boolean(),
});

export const requestLandlordApprovalTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'request_landlord_approval',
  description:
    'Request landlord approval for maintenance work. For emergency work, auto-approves and notifies landlord. For non-emergency, sends approval request.',
  inputSchema,
  outputSchema,
  permissions: ['maintenance', 'supervisor'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    const result = await landlordApprovalService.requestApproval(input);
    return {
      status: result.status,
      reason: result.reason,
      landlordContacted: result.landlordContacted,
    };
  },
};
