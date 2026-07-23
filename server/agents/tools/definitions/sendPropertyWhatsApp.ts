import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types';
import { sendPropertyCardWhatsApp } from '../../../whatsappPropertyCard.js';

const inputSchema = z.object({
  propertyId: z.number().describe('The ID of the property to send details for'),
  phone: z.string().optional().describe('Phone number to send to. If not provided, uses the caller phone number from context.'),
});

const outputSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  error: z.string().optional(),
});

export const sendPropertyWhatsAppTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'send_property_whatsapp',
  description: 'Send property details as a WhatsApp message to the caller or a specified phone number. Use this when a caller expresses interest in a property and wants to receive the details. Say "I\'ll send you the details right now" before using this tool.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'sales', 'rental', 'lead_gen_sales', 'lead_gen_rentals'],
  tier: 'autonomous',

  async execute(input, context: ToolContext) {
    // Use provided phone or fall back to caller's number from context
    const phone = input.phone || context.metadata?.callerPhone;

    if (!phone) {
      return { success: false, error: 'No phone number available. Ask the caller for their phone number.' };
    }

    const result = await sendPropertyCardWhatsApp(input.propertyId, phone, {
      staffUserId: 0, // AI-initiated
      entityType: 'property',
      entityId: input.propertyId,
    });

    return result;
  },
};
