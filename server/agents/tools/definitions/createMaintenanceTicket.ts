import { z } from 'zod';
import { db } from '../../../db';
import { maintenanceTickets } from '@shared/schema';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  propertyId: z.number(),
  title: z.string().min(1),
  description: z.string().min(1),
  // Schema category values: 'plumbing', 'electrical', 'heating', 'appliance', 'structural', 'other'
  category: z.string(),
  // Schema urgency values: 'emergency', 'urgent', 'routine', 'low'
  priority: z.enum(['low', 'medium', 'high', 'emergency']),
  tenantId: z.number().optional(),
});

const outputSchema = z.object({
  ticketId: z.number(),
  title: z.string(),
  status: z.string(),
});

// Map plan's priority names to schema's urgency values
function mapPriorityToUrgency(priority: string): string {
  const map: Record<string, string> = {
    low: 'low',
    medium: 'routine',
    high: 'urgent',
    emergency: 'emergency',
  };
  return map[priority] ?? 'routine';
}

export const createMaintenanceTicketTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'create_maintenance_ticket',
  description: 'Create a maintenance ticket for a property. Requires property ID, title, description, category, and priority level.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'maintenance', 'office_admin'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    // Schema requires tenantId (NOT NULL). Use provided or default to 0 for agent-created tickets.
    const tenantId = input.tenantId ?? 0;

    const [inserted] = await db
      .insert(maintenanceTickets)
      .values({
        propertyId: input.propertyId,
        tenantId: tenantId,
        title: input.title,
        description: input.description,
        category: input.category,
        urgency: mapPriorityToUrgency(input.priority),
        status: 'new',
      })
      .returning({
        id: maintenanceTickets.id,
        title: maintenanceTickets.title,
        status: maintenanceTickets.status,
      });

    return {
      ticketId: inserted.id,
      title: inserted.title,
      status: inserted.status,
    };
  },
};
