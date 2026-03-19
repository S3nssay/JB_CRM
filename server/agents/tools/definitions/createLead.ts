import { z } from 'zod';
import { db } from '../../../db';
import { leads } from '@shared/schema';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  // Schema leadType values: 'rental', 'purchase', 'both', 'landlord', 'seller'
  leadType: z.enum(['rental', 'purchase', 'both', 'landlord', 'seller']),
  source: z.string(),
  notes: z.string().optional(),
  budgetMin: z.number().optional(),
  budgetMax: z.number().optional(),
});

const outputSchema = z.object({
  leadId: z.number(),
  name: z.string(),
});

export const createLeadTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'create_lead',
  description: 'Create a new lead in the CRM with contact details, lead type, and source information.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'sales', 'rental', 'lead_gen_sales', 'lead_gen_rentals'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    // Schema column: fullName (maps to full_name in DB)
    const [inserted] = await db
      .insert(leads)
      .values({
        fullName: input.name,
        email: input.email ?? null,
        phone: input.phone ?? null,
        leadType: input.leadType,
        source: input.source,
        notes: input.notes ?? null,
        minBudget: input.budgetMin ?? null,
        maxBudget: input.budgetMax ?? null,
        status: 'new',
      })
      .returning({ id: leads.id, fullName: leads.fullName });

    return {
      leadId: inserted.id,
      name: inserted.fullName,
    };
  },
};
