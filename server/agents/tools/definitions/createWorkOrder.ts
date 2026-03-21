import { z } from 'zod';
import { pool } from '../../../db';
import { messageSender } from '../../services/messageSender';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  ticketId: z.number(),
  contractorId: z.number(),
  scope: z.string(),
  scheduledStart: z.string(),
  scheduledEnd: z.string().optional(),
  quotedAmount: z.number().optional(),
  accessInstructions: z.string().optional(),
  keyLocation: z.string().optional(),
  tenantPresenceRequired: z.boolean().optional(),
});

const outputSchema = z.object({
  workOrderId: z.number(),
  workOrderNumber: z.string(),
  status: z.string(),
});

/**
 * Generate a work order number in the format WO-YYYYMMDD-XXXX.
 * Queries the max existing WO number for today to determine the next sequence.
 */
async function generateWorkOrderNumber(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `WO-${dateStr}-`;

  const { rows } = await pool.query(
    `SELECT MAX(CAST(SUBSTRING(work_order_number FROM '\\d{4}$') AS INTEGER)) AS max_num
     FROM work_order
     WHERE work_order_number LIKE $1`,
    [`${prefix}%`],
  );

  const nextNum = (rows[0]?.max_num ?? 0) + 1;
  return `${prefix}${String(nextNum).padStart(4, '0')}`;
}

export const createWorkOrderTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'create_work_order',
  description:
    'Create a work order for approved maintenance work. Generates a WO number, updates the ticket, and notifies the contractor.',
  inputSchema,
  outputSchema,
  permissions: ['maintenance', 'supervisor'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    // 1. Generate work order number
    const workOrderNumber = await generateWorkOrderNumber();

    // 2. Insert work order
    const { rows: inserted } = await pool.query(
      `INSERT INTO work_order (
        maintenance_request_id, contractor_id, work_order_number, scope,
        scheduled_start, scheduled_end, quoted_amount,
        access_instructions, key_location, tenant_presence_required,
        status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'scheduled')
      RETURNING id, work_order_number, status`,
      [
        input.ticketId,
        input.contractorId,
        workOrderNumber,
        input.scope,
        input.scheduledStart,
        input.scheduledEnd || null,
        input.quotedAmount || null,
        input.accessInstructions || null,
        input.keyLocation || null,
        input.tenantPresenceRequired ?? false,
      ],
    );

    const workOrder = inserted[0];

    // 3. Update maintenance ticket status to 'assigned'
    await pool.query(
      `UPDATE maintenance_ticket SET status = 'assigned', assigned_contractor_id = $1, assigned_at = NOW()
       WHERE id = $2`,
      [input.contractorId, input.ticketId],
    );

    // 4. Look up contractor for notification
    const { rows: contractors } = await pool.query(
      'SELECT id, company_name, contact_name, phone, email FROM contractor WHERE id = $1',
      [input.contractorId],
    );

    // 5. Look up property address from ticket
    const { rows: properties } = await pool.query(
      `SELECT p.address FROM maintenance_ticket mt
       JOIN properties p ON p.id = mt.property_id
       WHERE mt.id = $1`,
      [input.ticketId],
    );

    const propertyAddress = properties[0]?.address ?? 'Address on file';

    // 6. Send confirmation to contractor
    if (contractors.length > 0) {
      const contractor = contractors[0];
      const scheduledDate = new Date(input.scheduledStart).toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      const message = [
        `Work Order ${workOrder.work_order_number}`,
        '',
        `Property: ${propertyAddress}`,
        `Scope: ${input.scope}`,
        `Scheduled: ${scheduledDate}`,
        input.accessInstructions ? `Access: ${input.accessInstructions}` : '',
        input.keyLocation ? `Key location: ${input.keyLocation}` : '',
        '',
        'Please confirm attendance.',
        '',
        'John Barclay Estate Agents',
      ].filter(Boolean).join('\n');

      if (contractor.phone) {
        await messageSender.sendPreferred(contractor.phone, message);
      } else if (contractor.email) {
        await messageSender.send('email', contractor.email, message, {
          subject: `Work Order ${workOrder.work_order_number}`,
        });
      }
    }

    return {
      workOrderId: workOrder.id,
      workOrderNumber: workOrder.work_order_number,
      status: workOrder.status,
    };
  },
};
