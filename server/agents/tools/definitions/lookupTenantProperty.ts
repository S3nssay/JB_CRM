/**
 * Lookup Tenant Property Tool
 *
 * Resolves a contact phone or email to a tenant record with their
 * property and landlord details. Used by the PM agent to identify
 * which property a tenant is reporting a fault for.
 */
import { z } from 'zod';
import { eq, or } from 'drizzle-orm';
import { db } from '../../../db';
import { tenant, properties, landlords } from '@shared/schema';
import type { ToolDefinition, ToolContext } from '../types';

const inputSchema = z.object({
  contactPhone: z.string().optional(),
  contactEmail: z.string().optional(),
});

const tenantResultSchema = z.object({
  tenantId: z.number(),
  tenantName: z.string().nullable(),
  propertyId: z.number().nullable(),
  propertyAddress: z.string().nullable(),
  landlordId: z.number().nullable(),
  landlordName: z.string().nullable(),
});

const outputSchema = z.object({
  found: z.boolean(),
  message: z.string().optional(),
  tenants: z.array(tenantResultSchema).optional(),
});

export const lookupTenantPropertyTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'lookup_tenant_property',
  description: 'Look up a tenant by phone number or email address. Returns tenant details with their property and landlord information.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'maintenance'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    if (!input.contactPhone && !input.contactEmail) {
      return {
        found: false,
        message: 'No contact phone or email provided. Please ask the tenant for their contact details.',
      };
    }

    // Build conditions for matching
    const conditions: any[] = [];
    if (input.contactPhone) {
      conditions.push(eq(tenant.phone, input.contactPhone));
      conditions.push(eq(tenant.mobile, input.contactPhone));
    }
    if (input.contactEmail) {
      conditions.push(eq(tenant.email, input.contactEmail));
    }

    // Query tenants matching the contact details
    const matchedTenants = await db
      .select({
        tenantId: tenant.id,
        tenantName: tenant.name,
        propertyId: tenant.propertyId,
        landlordId: tenant.landlordId,
      })
      .from(tenant)
      .where(or(...conditions));

    if (matchedTenants.length === 0) {
      return {
        found: false,
        message: 'No tenant record found for the provided contact details. The tenant may need to be registered in the system.',
      };
    }

    // Enrich with property and landlord details
    const enrichedTenants = await Promise.all(
      matchedTenants.map(async (t) => {
        let propertyAddress: string | null = null;
        let landlordName: string | null = null;

        if (t.propertyId) {
          const [prop] = await db
            .select({ address: properties.address })
            .from(properties)
            .where(eq(properties.id, t.propertyId))
            .limit(1);
          if (prop) propertyAddress = prop.address;
        }

        if (t.landlordId) {
          const [ll] = await db
            .select({ name: landlords.name })
            .from(landlords)
            .where(eq(landlords.id, t.landlordId))
            .limit(1);
          if (ll) landlordName = ll.name;
        }

        return {
          tenantId: t.tenantId,
          tenantName: t.tenantName,
          propertyId: t.propertyId,
          propertyAddress,
          landlordId: t.landlordId,
          landlordName,
        };
      }),
    );

    return {
      found: true,
      tenants: enrichedTenants,
      ...(enrichedTenants.length > 1
        ? { message: `Found ${enrichedTenants.length} tenant records. Please ask which property the fault is for.` }
        : {}),
    };
  },
};
