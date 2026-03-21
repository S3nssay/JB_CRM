import { z } from 'zod';
import { pool } from '../../../db';
import { messageSender } from '../../services/messageSender';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  ticketId: z.number(),
  contractorId: z.number(),
  jobDescription: z.string(),
  propertyAddress: z.string(),
  urgencyLevel: z.string().optional(),
});

const outputSchema = z.object({
  quoteId: z.number(),
  status: z.string(),
  contractorContacted: z.boolean(),
});

export const requestContractorQuoteTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'request_contractor_quote',
  description:
    'Request a quote from a contractor for a maintenance job. Creates a quote record and contacts the contractor via their preferred channel.',
  inputSchema,
  outputSchema,
  permissions: ['maintenance', 'supervisor'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    // 1. Look up contractor contact details
    const { rows: contractors } = await pool.query(
      'SELECT id, company_name, contact_name, phone, email FROM contractor WHERE id = $1',
      [input.contractorId],
    );

    if (contractors.length === 0) {
      throw new Error(`Contractor not found: ${input.contractorId}`);
    }

    const contractor = contractors[0];

    // 2. Insert contractor quote record
    const { rows: inserted } = await pool.query(
      `INSERT INTO contractor_quote (ticket_id, contractor_id, status, sent_at)
       VALUES ($1, $2, 'pending', NOW())
       RETURNING id`,
      [input.ticketId, input.contractorId],
    );

    const quoteId = inserted[0].id;

    // 3. Compose message
    const urgency = input.urgencyLevel || 'routine';
    const message = [
      'John Barclay Estate Agents - Maintenance Request',
      '',
      `Ticket: MT-${input.ticketId}`,
      `Property: ${input.propertyAddress}`,
      `Urgency: ${urgency}`,
      '',
      `Fault: ${input.jobDescription}`,
      '',
      'Please reply with your quote, estimated duration, and earliest availability.',
    ].join('\n');

    // 4. Send via preferred channel (WhatsApp first, SMS fallback)
    let contacted = false;
    if (contractor.phone) {
      contacted = await messageSender.sendPreferred(contractor.phone, message);
    }

    // Fallback to email if phone contact failed or not available
    if (!contacted && contractor.email) {
      contacted = await messageSender.send('email', contractor.email, message, {
        subject: `Maintenance Quote Request - MT-${input.ticketId}`,
      });
    }

    return {
      quoteId,
      status: 'pending',
      contractorContacted: contacted,
    };
  },
};
