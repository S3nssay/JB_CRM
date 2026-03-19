import { z } from 'zod';
import { db } from '../../../db';
import { leadViewings, leads } from '@shared/schema';
import { eq } from 'drizzle-orm';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  propertyId: z.number(),
  contactName: z.string().min(1),
  contactPhone: z.string().optional(),
  contactEmail: z.string().email().optional(),
  preferredDate: z.string().optional(), // ISO date string
  notes: z.string().optional(),
});

const outputSchema = z.object({
  viewingId: z.number(),
  confirmed: z.boolean(),
  message: z.string(),
});

export const bookViewingTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'book_viewing',
  description: 'Book a property viewing for a contact. Creates or finds the lead, then schedules a viewing at the preferred date.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'sales', 'rental'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    // Try to find existing lead by email or phone, or create one
    let leadId: number | null = null;

    if (input.contactEmail) {
      const existing = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.email, input.contactEmail))
        .limit(1);
      if (existing.length > 0) {
        leadId = existing[0].id;
      }
    }

    if (!leadId && input.contactPhone) {
      const existing = await db
        .select({ id: leads.id })
        .from(leads)
        .where(eq(leads.phone, input.contactPhone))
        .limit(1);
      if (existing.length > 0) {
        leadId = existing[0].id;
      }
    }

    // Create lead if not found
    if (!leadId) {
      const [newLead] = await db
        .insert(leads)
        .values({
          fullName: input.contactName,
          email: input.contactEmail ?? null,
          phone: input.contactPhone ?? null,
          leadType: 'rental', // default, can be updated later
          source: 'ai_agent',
          status: 'new',
        })
        .returning({ id: leads.id });
      leadId = newLead.id;
    }

    // Schedule viewing in lead_viewings table
    const scheduledAt = input.preferredDate
      ? new Date(input.preferredDate)
      : new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // Default: 2 days from now

    const [viewing] = await db
      .insert(leadViewings)
      .values({
        leadId: leadId,
        propertyId: input.propertyId,
        scheduledAt: scheduledAt,
        status: 'scheduled',
        agentNotes: input.notes ?? null,
      })
      .returning({ id: leadViewings.id, status: leadViewings.status });

    return {
      viewingId: viewing.id,
      confirmed: viewing.status === 'scheduled',
      message: `Viewing scheduled for ${scheduledAt.toISOString().split('T')[0]} for ${input.contactName}`,
    };
  },
};
