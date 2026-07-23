import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  phone: z.string().describe('Phone number to call'),
  reason: z.string().optional().describe('Reason for the callback, e.g. "discuss property viewing options"'),
  contactName: z.string().optional().describe('Name of the person to call'),
});

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  callSid: z.string().optional(),
  error: z.string().optional(),
});

export const initiateCallbackTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'initiate_callback',
  description: 'Initiate an outbound phone call to a customer. Use this when a WhatsApp conversation needs to be escalated to a voice call, or when a callback has been requested. The call will be routed through the office phone system.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'sales', 'rental', 'office_admin'],
  tier: 'supervised', // Requires confirmation as it initiates a real call

  async execute(input, _context: ToolContext) {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioNumber = process.env.TWILIO_PHONE_NUMBER;
      const officeNumber = process.env.OFFICE_PHONE_NUMBER || '+442071234567';

      if (!accountSid || !authToken || !twilioNumber) {
        return { success: false, error: 'Twilio not configured' };
      }

      const twilio = (await import('twilio')).default;
      const client = twilio(accountSid, authToken);

      const baseUrl = process.env.BASE_URL || process.env.VAPI_SERVER_URL?.replace('/api/voice/vapi-webhook', '') || '';

      // Create a call: ring the office first, then bridge to customer
      const call = await client.calls.create({
        to: officeNumber,
        from: twilioNumber,
        url: `${baseUrl}/api/crm/calls/bridge?to=${encodeURIComponent(input.phone)}`,
        statusCallback: `${baseUrl}/api/crm/calls/status`,
        statusCallbackEvent: ['completed', 'failed', 'busy', 'no-answer'],
      });

      // Log to communications table
      const { unifiedCommunicationService } = await import('../../../services/unifiedCommunicationService.js');
      await unifiedCommunicationService.logManual({
        channel: 'phone',
        direction: 'outbound',
        content: `AI-initiated callback to ${input.contactName || input.phone}${input.reason ? ': ' + input.reason : ''}`,
        entityType: 'lead',
        entityId: 0, // Will be linked later if lead is identified
        staffUserId: 0, // AI-initiated
        externalMessageId: call.sid,
      });

      // Push SSE notification to CRM
      try {
        const { notificationService } = await import('../../../services/notificationService.js');
        notificationService.pushToAll({
          type: 'outbound_call',
          phone: input.phone,
          contactName: input.contactName,
          reason: input.reason,
          callSid: call.sid,
        });
      } catch { /* SSE not critical */ }

      return {
        success: true,
        message: `Callback initiated to ${input.contactName || input.phone}. The office phone will ring first, then connect to the customer.`,
        callSid: call.sid,
      };
    } catch (error: any) {
      console.error('[InitiateCallback] Failed:', error.message);
      return { success: false, error: error.message };
    }
  },
};
