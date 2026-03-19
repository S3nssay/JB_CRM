import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db } from '../../../db';
import { propertyCertifications, propertySystemsInventory, maintenanceTickets } from '@shared/schema';
import type { ToolDefinition, ToolContext } from '../types';

const categoryEnum = z.enum(['certifications', 'systems', 'maintenance_history', 'all']);

const inputSchema = z.object({
  propertyId: z.number(),
  categories: z.array(categoryEnum).optional().default(['all']),
  limit: z.number().optional().default(10),
});

const certificationSchema = z.object({
  id: z.number(),
  certificationType: z.string(),
  certificateNumber: z.string().nullable(),
  issuedBy: z.string().nullable(),
  inspectionDate: z.any(),
  issueDate: z.any(),
  expiryDate: z.any(),
  status: z.string(),
});

const systemSchema = z.object({
  id: z.number(),
  systemType: z.string(),
  make: z.string().nullable(),
  model: z.string().nullable(),
  installedDate: z.any().nullable(),
  warrantyExpiryDate: z.any().nullable(),
  lastServiceDate: z.any().nullable(),
  nextServiceDue: z.any().nullable(),
  location: z.string().nullable(),
  notes: z.string().nullable(),
});

const maintenanceSchema = z.object({
  id: z.number(),
  title: z.string(),
  category: z.string(),
  urgency: z.string(),
  status: z.string(),
  createdAt: z.any(),
  resolvedAt: z.any().nullable(),
  assignedContractorId: z.number().nullable(),
});

const outputSchema = z.object({
  propertyId: z.number(),
  certifications: z.array(certificationSchema).optional(),
  systems: z.array(systemSchema).optional(),
  recentMaintenance: z.array(maintenanceSchema).optional(),
});

export const queryKnowledgeBaseTool: ToolDefinition<typeof inputSchema, typeof outputSchema> = {
  name: 'query_knowledge_base',
  description: 'Query the property knowledge base for certifications, systems inventory, and maintenance history. Returns structured data about a specific property.',
  inputSchema,
  outputSchema,
  permissions: ['supervisor', 'office_admin', 'sales', 'rental', 'maintenance', 'lead_gen_sales', 'lead_gen_rentals', 'marketing'],
  tier: 'autonomous',

  async execute(input, _context: ToolContext) {
    const cats = input.categories ?? ['all'];
    const includeAll = cats.includes('all');
    const result: any = { propertyId: input.propertyId };

    // Certifications
    if (includeAll || cats.includes('certifications')) {
      const certs = await db
        .select({
          id: propertyCertifications.id,
          certificationType: propertyCertifications.certificationType,
          certificateNumber: propertyCertifications.certificateNumber,
          issuedBy: propertyCertifications.issuedBy,
          inspectionDate: propertyCertifications.inspectionDate,
          issueDate: propertyCertifications.issueDate,
          expiryDate: propertyCertifications.expiryDate,
          status: propertyCertifications.status,
        })
        .from(propertyCertifications)
        .where(eq(propertyCertifications.propertyId, input.propertyId));

      result.certifications = certs;
    }

    // Systems inventory
    if (includeAll || cats.includes('systems')) {
      const systems = await db
        .select({
          id: propertySystemsInventory.id,
          systemType: propertySystemsInventory.systemType,
          make: propertySystemsInventory.make,
          model: propertySystemsInventory.model,
          installedDate: propertySystemsInventory.installedDate,
          warrantyExpiryDate: propertySystemsInventory.warrantyExpiryDate,
          lastServiceDate: propertySystemsInventory.lastServiceDate,
          nextServiceDue: propertySystemsInventory.nextServiceDue,
          location: propertySystemsInventory.location,
          notes: propertySystemsInventory.notes,
        })
        .from(propertySystemsInventory)
        .where(eq(propertySystemsInventory.propertyId, input.propertyId));

      result.systems = systems;
    }

    // Recent maintenance
    if (includeAll || cats.includes('maintenance_history')) {
      const tickets = await db
        .select({
          id: maintenanceTickets.id,
          title: maintenanceTickets.title,
          category: maintenanceTickets.category,
          urgency: maintenanceTickets.urgency,
          status: maintenanceTickets.status,
          createdAt: maintenanceTickets.createdAt,
          resolvedAt: maintenanceTickets.resolvedAt,
          assignedContractorId: maintenanceTickets.assignedContractorId,
        })
        .from(maintenanceTickets)
        .where(eq(maintenanceTickets.propertyId, input.propertyId))
        .orderBy(desc(maintenanceTickets.createdAt))
        .limit(input.limit ?? 10);

      result.recentMaintenance = tickets;
    }

    return result;
  },
};
