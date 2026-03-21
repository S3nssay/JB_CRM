import { z } from 'zod';
import { pool } from '../../../db';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  category: z.string(),
  postcode: z.string().optional(),
  emergency: z.boolean().optional(),
});

const outputSchema = z.object({
  contractors: z.array(
    z.object({
      id: z.number(),
      companyName: z.string(),
      contactName: z.string(),
      phone: z.string(),
      email: z.string(),
      specializations: z.array(z.string()),
      rating: z.number().nullable(),
      responseTime: z.string().nullable(),
      callOutFee: z.number().nullable(),
      hourlyRate: z.number().nullable(),
      preferredContractor: z.boolean(),
      availableEmergency: z.boolean(),
    }),
  ),
  count: z.number(),
});

/**
 * Map response_time text to numeric hours for sorting.
 */
function responseTimeToHours(rt: string | null): number {
  if (!rt) return 999;
  const map: Record<string, number> = {
    '1 hour': 1,
    '2 hours': 2,
    '4 hours': 4,
    '24 hours': 24,
    '48 hours': 48,
  };
  return map[rt.toLowerCase()] ?? 999;
}

export const searchContractorsTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'search_contractors',
  description:
    'Search for contractors by specialization, service area, and emergency capability. Returns a ranked list (preferred first, then by rating).',
  inputSchema,
  outputSchema,
  permissions: ['maintenance', 'supervisor'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    // Build query with filters
    const conditions: string[] = ['is_active = true'];
    const params: any[] = [];
    let paramIdx = 1;

    // Specialization filter (ANY match on the text array)
    conditions.push(`$${paramIdx} = ANY(specializations)`);
    params.push(input.category);
    paramIdx++;

    // Postcode / service area filter (first 2-4 chars match)
    if (input.postcode) {
      const prefix = input.postcode.replace(/\s/g, '').slice(0, 4).toUpperCase();
      conditions.push(`EXISTS (SELECT 1 FROM unnest(service_areas) sa WHERE UPPER(sa) LIKE $${paramIdx})`);
      params.push(`${prefix}%`);
      paramIdx++;
    }

    // Emergency filter
    if (input.emergency) {
      conditions.push('available_emergency = true');
    }

    const sql = `
      SELECT id, company_name, contact_name, phone, email,
             specializations, rating, response_time,
             call_out_fee, hourly_rate,
             preferred_contractor, available_emergency
      FROM contractor
      WHERE ${conditions.join(' AND ')}
      LIMIT 20
    `;

    const { rows } = await pool.query(sql, params);

    // Sort in JS: preferred DESC, rating DESC NULLS LAST, responseTime ASC
    const sorted = rows.sort((a: any, b: any) => {
      // Preferred first
      if (a.preferred_contractor !== b.preferred_contractor) {
        return a.preferred_contractor ? -1 : 1;
      }
      // Rating DESC (nulls last)
      const rA = a.rating ?? 0;
      const rB = b.rating ?? 0;
      if (rA !== rB) return rB - rA;
      // Response time ASC
      return responseTimeToHours(a.response_time) - responseTimeToHours(b.response_time);
    });

    // Limit to 5
    const top = sorted.slice(0, 5);

    const contractors = top.map((r: any) => ({
      id: r.id,
      companyName: r.company_name,
      contactName: r.contact_name,
      phone: r.phone,
      email: r.email,
      specializations: r.specializations || [],
      rating: r.rating,
      responseTime: r.response_time,
      callOutFee: r.call_out_fee,
      hourlyRate: r.hourly_rate,
      preferredContractor: r.preferred_contractor ?? false,
      availableEmergency: r.available_emergency ?? false,
    }));

    return { contractors, count: contractors.length };
  },
};
