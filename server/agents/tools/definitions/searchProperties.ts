import { z } from 'zod';
import { eq, ilike, gte, lte, and, sql } from 'drizzle-orm';
import { db } from '../../../db';
import { properties } from '@shared/schema';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  area: z.string().optional(),
  postcode: z.string().optional(),
  type: z.enum(['rental', 'sale', 'any']),
  minBedrooms: z.number().optional(),
  maxPrice: z.number().optional(),
  limit: z.number().optional().default(5),
});

const propertyResultSchema = z.object({
  id: z.number(),
  address: z.string().nullable(),
  postcode: z.string(),
  bedrooms: z.number(),
  bathrooms: z.number(),
  price: z.number(),
  rentAmount: z.number().nullable(),
  propertyType: z.string(),
  status: z.string(),
});

const outputSchema = z.object({
  properties: z.array(propertyResultSchema),
});

export const searchPropertiesTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'search_properties',
  description: 'Search CRM properties by area, postcode, type (rental/sale), bedrooms, and price. Returns matching properties with address, price, and details.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'office_admin', 'sales', 'rental', 'maintenance', 'lead_gen_sales', 'lead_gen_rentals', 'marketing'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    const conditions: any[] = [];

    // Filter by rental vs sale
    // Schema uses isRental (boolean) and isListed (boolean)
    if (input.type === 'rental') {
      conditions.push(eq(properties.isRental, true));
    } else if (input.type === 'sale') {
      conditions.push(eq(properties.isRental, false));
    }

    // Filter by area/postcode using ILIKE
    if (input.postcode) {
      conditions.push(ilike(properties.postcode, `${input.postcode}%`));
    } else if (input.area) {
      // Search in postcode and address fields
      conditions.push(
        sql`(${properties.postcode} ILIKE ${`%${input.area}%`} OR ${properties.address} ILIKE ${`%${input.area}%`} OR ${properties.addressLine1} ILIKE ${`%${input.area}%`} OR ${properties.city} ILIKE ${`%${input.area}%`})`
      );
    }

    // Filter by minimum bedrooms
    if (input.minBedrooms !== undefined) {
      conditions.push(gte(properties.bedrooms, input.minBedrooms));
    }

    // Filter by max price (price is in pence)
    if (input.maxPrice !== undefined) {
      conditions.push(lte(properties.price, input.maxPrice));
    }

    const query = db
      .select({
        id: properties.id,
        address: properties.address,
        postcode: properties.postcode,
        bedrooms: properties.bedrooms,
        bathrooms: properties.bathrooms,
        price: properties.price,
        rentAmount: properties.rentAmount,
        propertyType: properties.propertyType,
        status: properties.status,
      })
      .from(properties)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .limit(input.limit ?? 5);

    const results = await query;

    return {
      properties: results.map((r) => ({
        id: r.id,
        address: r.address,
        postcode: r.postcode,
        bedrooms: r.bedrooms,
        bathrooms: r.bathrooms,
        price: r.price,
        rentAmount: r.rentAmount ?? null,
        propertyType: r.propertyType,
        status: r.status,
      })),
    };
  },
};
