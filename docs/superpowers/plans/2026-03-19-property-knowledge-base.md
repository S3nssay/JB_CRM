# Property Knowledge Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive per-property knowledge base that aggregates work history, specifications, documents, certifications, and expiry dates — structured for instant AI agent consumption.

**Architecture:** New `property_specifications` table for heating/building details, plus a `PropertyKnowledgeBaseService` that aggregates data from 8+ existing tables (properties, documents, maintenance tickets, work orders, certifications, inspections, compliance status, contractors) into a unified context object. A new API endpoint serves this to the agent system. A frontend UI lets staff view/edit the knowledge base per property.

**Tech Stack:** PostgreSQL/Drizzle ORM, Express.js, React/TypeScript, TanStack Query, shadcn/ui

---

## File Structure

| File | Responsibility |
|------|---------------|
| `shared/schema.ts` | Add `propertySpecifications` table definition |
| `server/services/propertyKnowledgeBase.ts` | Service to aggregate all property data into AI-ready context |
| `server/routes/propertyKnowledgeBaseRoutes.ts` | API endpoints for knowledge base CRUD + AI context |
| `client/src/pages/PropertyKnowledgeBase.tsx` | UI page for viewing/editing property knowledge base |
| `client/src/components/PropertySpecificationsForm.tsx` | Form component for property specifications |
| `client/src/components/PropertyKBTimeline.tsx` | Timeline view of work history, certifications, inspections |

---

### Task 1: Add Property Specifications Schema

**Files:**
- Modify: `shared/schema.ts` (append new table after existing property tables)

- [ ] **Step 1: Read the existing schema to find insertion point**

Run: `grep -n "propertyCertifications\|inspectionReports" shared/schema.ts | tail -5`
Find the line after the last property-related table definition.

- [ ] **Step 2: Add propertySpecifications table to schema.ts**

Add after the last property-related table:

```typescript
export const propertySpecifications = pgTable("property_specification", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").references(() => properties.id).notNull().unique(),

  // Heating System
  heatingType: text("heating_type"), // 'gas_central', 'electric', 'oil', 'heat_pump', 'underfloor', 'storage_heaters', 'district', 'none'
  heatingFuelType: text("heating_fuel_type"), // 'gas', 'electric', 'oil', 'lpg', 'biomass'
  boilerMake: text("boiler_make"),
  boilerModel: text("boiler_model"),
  boilerInstallDate: timestamp("boiler_install_date"),
  boilerLastServiceDate: timestamp("boiler_last_service_date"),
  boilerNextServiceDue: timestamp("boiler_next_service_due"),
  thermostatType: text("thermostat_type"), // 'manual', 'programmable', 'smart', 'none'
  radiatorCount: integer("radiator_count"),

  // Hot Water
  hotWaterSystem: text("hot_water_system"), // 'combi_boiler', 'system_boiler', 'immersion', 'instant', 'tank'
  hotWaterTankLocation: text("hot_water_tank_location"),

  // Electrical
  fuseBoxLocation: text("fuse_box_location"),
  fuseBoxType: text("fuse_box_type"), // 'modern_consumer_unit', 'old_fuse_box', 'mixed'
  electricMeterLocation: text("electric_meter_location"),
  electricMeterType: text("electric_meter_type"), // 'standard', 'prepayment', 'smart'

  // Gas
  gasMeterLocation: text("gas_meter_location"),
  gasMeterType: text("gas_meter_type"), // 'standard', 'prepayment', 'smart'
  gasSupplyType: text("gas_supply_type"), // 'mains', 'lpg_tank', 'none'

  // Water
  waterMeterLocation: text("water_meter_location"),
  waterSupplyType: text("water_supply_type"), // 'mains', 'borehole', 'well'
  stopcockLocation: text("stopcock_location"),
  drainageType: text("drainage_type"), // 'mains', 'septic_tank', 'cesspit'

  // Building Details
  constructionType: text("construction_type"), // 'brick', 'stone', 'timber_frame', 'concrete', 'steel_frame', 'mixed'
  roofType: text("roof_type"), // 'pitched_tiles', 'pitched_slate', 'flat', 'mixed'
  windowType: text("window_type"), // 'single_glazed', 'double_glazed', 'triple_glazed', 'mixed'
  insulationType: text("insulation_type"), // 'cavity_wall', 'solid_wall', 'loft', 'none', 'mixed'
  flooringTypes: text("flooring_types").array(), // ['carpet', 'hardwood', 'laminate', 'tile', 'vinyl']

  // Access & Keys
  keyStorageLocation: text("key_storage_location"),
  alarmSystem: text("alarm_system"), // 'none', 'wired', 'wireless', 'smart'
  alarmCode: text("alarm_code"),
  entrySystem: text("entry_system"), // 'key', 'fob', 'code', 'smart_lock', 'concierge'
  parkingType: text("parking_type"), // 'none', 'on_street', 'driveway', 'garage', 'allocated_space', 'underground'
  parkingDetails: text("parking_details"),

  // Garden & Exterior
  gardenType: text("garden_type"), // 'none', 'front', 'rear', 'both', 'communal', 'roof_terrace', 'balcony'
  gardenMaintenanceResponsibility: text("garden_maintenance_responsibility"), // 'tenant', 'landlord', 'management_company'
  binCollectionDay: text("bin_collection_day"),

  // Utilities & Services
  councilTaxBand: text("council_tax_band"),
  broadbandType: text("broadband_type"), // 'fibre', 'cable', 'adsl', 'none'
  broadbandProvider: text("broadband_provider"),

  // Special Notes
  accessNotes: text("access_notes"), // how to access the property
  specialInstructions: text("special_instructions"), // anything unusual
  knownIssues: text("known_issues"), // ongoing problems

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPropertySpecificationsSchema = createInsertSchema(propertySpecifications);
```

- [ ] **Step 3: Push schema to database**

Run: `node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\`CREATE TABLE IF NOT EXISTS property_specification (id SERIAL PRIMARY KEY, property_id INTEGER NOT NULL UNIQUE REFERENCES property(id), heating_type TEXT, heating_fuel_type TEXT, boiler_make TEXT, boiler_model TEXT, boiler_install_date TIMESTAMP, boiler_last_service_date TIMESTAMP, boiler_next_service_due TIMESTAMP, thermostat_type TEXT, radiator_count INTEGER, hot_water_system TEXT, hot_water_tank_location TEXT, fuse_box_location TEXT, fuse_box_type TEXT, electric_meter_location TEXT, electric_meter_type TEXT, gas_meter_location TEXT, gas_meter_type TEXT, gas_supply_type TEXT, water_meter_location TEXT, water_supply_type TEXT, stopcock_location TEXT, drainage_type TEXT, construction_type TEXT, roof_type TEXT, window_type TEXT, insulation_type TEXT, flooring_types TEXT[], key_storage_location TEXT, alarm_system TEXT, alarm_code TEXT, entry_system TEXT, parking_type TEXT, parking_details TEXT, garden_type TEXT, garden_maintenance_responsibility TEXT, bin_collection_day TEXT, council_tax_band TEXT, broadband_type TEXT, broadband_provider TEXT, access_notes TEXT, special_instructions TEXT, known_issues TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())\`).then(()=>{console.log('Created');p.end()}).catch(e=>{console.error(e);p.end()})"`

- [ ] **Step 4: Verify table exists**

Run: `node -e "const{Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query(\"SELECT column_name FROM information_schema.columns WHERE table_name='property_specification' ORDER BY ordinal_position\").then(r=>{console.log(r.rows.map(r=>r.column_name));p.end()}).catch(e=>{console.error(e);p.end()})"`

- [ ] **Step 5: Commit**

```bash
git add shared/schema.ts
git commit -m "feat: add property_specification table for knowledge base"
```

---

### Task 2: Build Property Knowledge Base Service

**Files:**
- Create: `server/services/propertyKnowledgeBase.ts`

This is the core service. It aggregates data from 8+ tables into a single structured context object that AI agents can consume.

- [ ] **Step 1: Create the PropertyKnowledgeBase service**

```typescript
// server/services/propertyKnowledgeBase.ts
import { db } from "../db";
import { eq, desc, and, gte, lte, sql } from "drizzle-orm";
import {
  properties,
  propertySpecifications,
  document,
  propertyCertifications,
  maintenanceTickets,
  maintenanceRequests,
  workOrders,
  inspectionReports,
  complianceStatus,
  complianceRequirements,
  contractors,
  contractorQuotes,
  tenancies,
  tenant,
  landlords,
  communications,
} from "@shared/schema";

export interface PropertyKnowledgeContext {
  property: {
    id: number;
    address: string;
    postcode: string;
    propertyType: string | null;
    bedrooms: number | null;
    bathrooms: number | null;
    status: string | null;
    isManaged: boolean | null;
    landlordName: string | null;
    landlordPhone: string | null;
    landlordEmail: string | null;
  };
  specifications: {
    heating: string;
    hotWater: string;
    electrical: string;
    gas: string;
    water: string;
    building: string;
    access: string;
    knownIssues: string | null;
  } | null;
  certifications: Array<{
    type: string;
    status: string;
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    certificateNumber: string | null;
    issuedBy: string | null;
  }>;
  recentMaintenance: Array<{
    id: number;
    title: string;
    category: string | null;
    status: string | null;
    urgency: string | null;
    createdAt: string;
    resolvedAt: string | null;
    cost: number | null;
    contractorName: string | null;
  }>;
  workHistory: Array<{
    id: number;
    scope: string | null;
    status: string | null;
    contractorName: string | null;
    scheduledStart: string | null;
    actualEnd: string | null;
    invoiceAmount: number | null;
    completionReport: string | null;
  }>;
  inspections: Array<{
    type: string | null;
    date: string | null;
    overallCondition: string | null;
    issuesFound: unknown;
    maintenanceRequired: boolean | null;
  }>;
  complianceOverview: Array<{
    requirement: string;
    status: string | null;
    expiryDate: string | null;
  }>;
  activeTenancy: {
    tenantName: string | null;
    tenantPhone: string | null;
    tenantEmail: string | null;
    rentAmount: string | null;
    startDate: string | null;
    endDate: string | null;
    status: string | null;
  } | null;
  documents: Array<{
    name: string | null;
    type: string | null;
    status: string | null;
    expiryDate: string | null;
    uploadedAt: string;
  }>;
  summary: string; // AI-ready text summary of everything
}

class PropertyKnowledgeBaseService {
  /**
   * Get the full knowledge context for a property.
   * This is what AI agents consume when answering queries.
   */
  async getPropertyContext(propertyId: number): Promise<PropertyKnowledgeContext | null> {
    // 1. Get property + landlord
    const [prop] = await db
      .select()
      .from(properties)
      .where(eq(properties.id, propertyId))
      .limit(1);

    if (!prop) return null;

    let landlordInfo = null;
    if (prop.landlordId) {
      const [ll] = await db
        .select()
        .from(landlords)
        .where(eq(landlords.id, prop.landlordId))
        .limit(1);
      landlordInfo = ll || null;
    }

    // 2. Get specifications
    const [specs] = await db
      .select()
      .from(propertySpecifications)
      .where(eq(propertySpecifications.propertyId, propertyId))
      .limit(1);

    // 3. Get certifications
    const certs = await db
      .select()
      .from(propertyCertifications)
      .where(eq(propertyCertifications.propertyId, propertyId))
      .orderBy(desc(propertyCertifications.expiryDate));

    // 4. Get recent maintenance (last 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

    const maintenance = await db
      .select({
        ticket: maintenanceTickets,
        contractorName: contractors.contactName,
      })
      .from(maintenanceTickets)
      .leftJoin(contractors, eq(maintenanceTickets.assignedContractorId, contractors.id))
      .where(
        and(
          eq(maintenanceTickets.propertyId, propertyId),
          gte(maintenanceTickets.createdAt, twoYearsAgo)
        )
      )
      .orderBy(desc(maintenanceTickets.createdAt))
      .limit(20);

    // 5. Get work orders
    const works = await db
      .select({
        wo: workOrders,
        contractorName: contractors.contactName,
      })
      .from(workOrders)
      .innerJoin(maintenanceRequests, eq(workOrders.maintenanceRequestId, maintenanceRequests.id))
      .leftJoin(contractors, eq(workOrders.contractorId, contractors.id))
      .where(eq(maintenanceRequests.propertyId, propertyId))
      .orderBy(desc(workOrders.createdAt))
      .limit(20);

    // 6. Get inspections
    const inspections = await db
      .select()
      .from(inspectionReports)
      .where(eq(inspectionReports.propertyId, propertyId))
      .orderBy(desc(inspectionReports.inspectionDate))
      .limit(10);

    // 7. Get compliance status
    const compliance = await db
      .select({
        cs: complianceStatus,
        reqName: complianceRequirements.name,
      })
      .from(complianceStatus)
      .innerJoin(complianceRequirements, eq(complianceStatus.requirementId, complianceRequirements.id))
      .where(eq(complianceStatus.propertyId, propertyId));

    // 8. Get active tenancy + tenant
    const activeTenancy = await db
      .select({
        tenancy: tenancies,
        tenantName: tenant.name,
        tenantPhone: tenant.phone,
        tenantEmail: tenant.email,
      })
      .from(tenancies)
      .leftJoin(tenant, eq(tenancies.tenantId, tenant.id))
      .where(
        and(
          eq(tenancies.propertyId, propertyId),
          eq(tenancies.status, "active")
        )
      )
      .limit(1);

    // 9. Get documents
    const docs = await db
      .select()
      .from(document)
      .where(eq(document.propertyId, propertyId))
      .orderBy(desc(document.createdAt))
      .limit(30);

    // Build context object
    const now = new Date();

    const context: PropertyKnowledgeContext = {
      property: {
        id: prop.id,
        address: [prop.addressLine1, prop.addressLine2, prop.city, prop.postcode].filter(Boolean).join(", "),
        postcode: prop.postcode || "",
        propertyType: prop.propertyType,
        bedrooms: prop.bedrooms,
        bathrooms: prop.bathrooms,
        status: prop.status,
        isManaged: prop.isManaged,
        landlordName: landlordInfo?.name || null,
        landlordPhone: landlordInfo?.phone || landlordInfo?.mobile || null,
        landlordEmail: landlordInfo?.email || null,
      },
      specifications: specs
        ? {
            heating: [specs.heatingType, specs.heatingFuelType, specs.boilerMake, specs.boilerModel]
              .filter(Boolean)
              .join(" - ") || "Not recorded",
            hotWater: specs.hotWaterSystem || "Not recorded",
            electrical: [specs.fuseBoxType, `Meter: ${specs.electricMeterType || "unknown"}`]
              .join(", "),
            gas: [specs.gasSupplyType, `Meter: ${specs.gasMeterType || "unknown"}`].join(", "),
            water: [specs.waterSupplyType, specs.drainageType].filter(Boolean).join(", ") || "Not recorded",
            building: [specs.constructionType, specs.roofType, specs.windowType, specs.insulationType]
              .filter(Boolean)
              .join(", ") || "Not recorded",
            access: [specs.entrySystem, specs.keyStorageLocation, specs.alarmSystem ? `Alarm: ${specs.alarmSystem}` : null]
              .filter(Boolean)
              .join(", ") || "Not recorded",
            knownIssues: specs.knownIssues,
          }
        : null,
      certifications: certs.map((c) => {
        const expiry = c.expiryDate ? new Date(c.expiryDate) : null;
        const daysUntil = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return {
          type: c.certificationType || "unknown",
          status: c.status || "unknown",
          expiryDate: c.expiryDate?.toISOString().split("T")[0] || null,
          daysUntilExpiry: daysUntil,
          certificateNumber: c.certificateNumber,
          issuedBy: c.issuedBy,
        };
      }),
      recentMaintenance: maintenance.map((m) => ({
        id: m.ticket.id,
        title: m.ticket.title || "",
        category: m.ticket.category,
        status: m.ticket.status,
        urgency: m.ticket.urgency,
        createdAt: m.ticket.createdAt?.toISOString().split("T")[0] || "",
        resolvedAt: m.ticket.resolvedAt?.toISOString().split("T")[0] || null,
        cost: m.ticket.actualCost,
        contractorName: m.contractorName,
      })),
      workHistory: works.map((w) => ({
        id: w.wo.id,
        scope: w.wo.scope,
        status: w.wo.status,
        contractorName: w.contractorName,
        scheduledStart: w.wo.scheduledStart?.toISOString().split("T")[0] || null,
        actualEnd: w.wo.actualEnd?.toISOString().split("T")[0] || null,
        invoiceAmount: w.wo.invoiceAmount,
        completionReport: w.wo.completionReport,
      })),
      inspections: inspections.map((i) => ({
        type: i.inspectionType,
        date: i.inspectionDate?.toISOString().split("T")[0] || null,
        overallCondition: i.overallCondition,
        issuesFound: i.issuesFound,
        maintenanceRequired: i.maintenanceRequired,
      })),
      complianceOverview: compliance.map((c) => ({
        requirement: c.reqName || "Unknown",
        status: c.cs.status,
        expiryDate: c.cs.expiryDate?.toISOString().split("T")[0] || null,
      })),
      activeTenancy:
        activeTenancy.length > 0
          ? {
              tenantName: activeTenancy[0].tenantName,
              tenantPhone: activeTenancy[0].tenantPhone,
              tenantEmail: activeTenancy[0].tenantEmail,
              rentAmount: activeTenancy[0].tenancy.rentAmount?.toString() || null,
              startDate: activeTenancy[0].tenancy.startDate?.toISOString().split("T")[0] || null,
              endDate: activeTenancy[0].tenancy.endDate?.toISOString().split("T")[0] || null,
              status: activeTenancy[0].tenancy.status,
            }
          : null,
      documents: docs.map((d) => ({
        name: d.name,
        type: d.documentType,
        status: d.status,
        expiryDate: d.expiryDate?.toISOString().split("T")[0] || null,
        uploadedAt: d.createdAt?.toISOString().split("T")[0] || "",
      })),
      summary: "", // Generated below
    };

    // Generate AI-ready text summary
    context.summary = this.generateTextSummary(context);

    return context;
  }

  /**
   * Generate a plain-text summary for AI agent context injection.
   */
  private generateTextSummary(ctx: PropertyKnowledgeContext): string {
    const lines: string[] = [];

    lines.push(`PROPERTY: ${ctx.property.address}`);
    lines.push(`Type: ${ctx.property.propertyType || "N/A"}, Beds: ${ctx.property.bedrooms || "N/A"}, Baths: ${ctx.property.bathrooms || "N/A"}`);
    lines.push(`Status: ${ctx.property.status || "N/A"}, Managed: ${ctx.property.isManaged ? "Yes" : "No"}`);

    if (ctx.property.landlordName) {
      lines.push(`Landlord: ${ctx.property.landlordName} (${ctx.property.landlordPhone || "no phone"})`);
    }

    if (ctx.activeTenancy) {
      lines.push(`Current Tenant: ${ctx.activeTenancy.tenantName || "N/A"}, Rent: £${ctx.activeTenancy.rentAmount || "N/A"}, Lease: ${ctx.activeTenancy.startDate} to ${ctx.activeTenancy.endDate}`);
    }

    if (ctx.specifications) {
      lines.push(`\nSPECIFICATIONS:`);
      lines.push(`Heating: ${ctx.specifications.heating}`);
      lines.push(`Hot Water: ${ctx.specifications.hotWater}`);
      lines.push(`Electrical: ${ctx.specifications.electrical}`);
      lines.push(`Gas: ${ctx.specifications.gas}`);
      lines.push(`Building: ${ctx.specifications.building}`);
      lines.push(`Access: ${ctx.specifications.access}`);
      if (ctx.specifications.knownIssues) {
        lines.push(`Known Issues: ${ctx.specifications.knownIssues}`);
      }
    }

    if (ctx.certifications.length > 0) {
      lines.push(`\nCERTIFICATIONS:`);
      for (const c of ctx.certifications) {
        const urgency =
          c.daysUntilExpiry !== null && c.daysUntilExpiry <= 30
            ? " [EXPIRING SOON]"
            : c.daysUntilExpiry !== null && c.daysUntilExpiry <= 0
            ? " [EXPIRED]"
            : "";
        lines.push(`- ${c.type}: ${c.status}, expires ${c.expiryDate || "N/A"}${urgency}`);
      }
    }

    if (ctx.recentMaintenance.length > 0) {
      lines.push(`\nRECENT MAINTENANCE (last 2 years):`);
      for (const m of ctx.recentMaintenance.slice(0, 10)) {
        lines.push(`- [${m.status}] ${m.title} (${m.category}, ${m.urgency}) - ${m.createdAt}${m.cost ? `, £${(m.cost / 100).toFixed(2)}` : ""}`);
      }
    }

    if (ctx.inspections.length > 0) {
      lines.push(`\nINSPECTIONS:`);
      for (const i of ctx.inspections.slice(0, 5)) {
        lines.push(`- ${i.type} on ${i.date}: ${i.overallCondition}${i.maintenanceRequired ? " [MAINTENANCE NEEDED]" : ""}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Save or update property specifications.
   */
  async upsertSpecifications(propertyId: number, data: Record<string, unknown>) {
    const [existing] = await db
      .select()
      .from(propertySpecifications)
      .where(eq(propertySpecifications.propertyId, propertyId))
      .limit(1);

    if (existing) {
      await db
        .update(propertySpecifications)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(propertySpecifications.propertyId, propertyId));
      return existing.id;
    } else {
      const [inserted] = await db
        .insert(propertySpecifications)
        .values({ propertyId, ...data })
        .returning({ id: propertySpecifications.id });
      return inserted.id;
    }
  }

  /**
   * Get specifications only (for the form).
   */
  async getSpecifications(propertyId: number) {
    const [specs] = await db
      .select()
      .from(propertySpecifications)
      .where(eq(propertySpecifications.propertyId, propertyId))
      .limit(1);
    return specs || null;
  }

  /**
   * Get expiring certifications across all properties (for dashboard alerts).
   */
  async getExpiringCertifications(daysAhead: number = 60) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    return db
      .select({
        cert: propertyCertifications,
        propertyAddress: properties.addressLine1,
        propertyPostcode: properties.postcode,
      })
      .from(propertyCertifications)
      .innerJoin(properties, eq(propertyCertifications.propertyId, properties.id))
      .where(
        and(
          lte(propertyCertifications.expiryDate, futureDate),
          sql`${propertyCertifications.status} != 'expired'`
        )
      )
      .orderBy(propertyCertifications.expiryDate);
  }
}

export const propertyKnowledgeBase = new PropertyKnowledgeBaseService();
```

- [ ] **Step 2: Verify the file was created**

Run: `ls -la server/services/propertyKnowledgeBase.ts`

- [ ] **Step 3: Commit**

```bash
git add server/services/propertyKnowledgeBase.ts
git commit -m "feat: add PropertyKnowledgeBaseService for AI-ready property context"
```

---

### Task 3: Add Knowledge Base API Routes

**Files:**
- Create: `server/routes/propertyKnowledgeBaseRoutes.ts`
- Modify: `server/routes.ts` (add route registration)

- [ ] **Step 1: Create the route file**

```typescript
// server/routes/propertyKnowledgeBaseRoutes.ts
import { Router } from "express";
import { propertyKnowledgeBase } from "../services/propertyKnowledgeBase";

const router = Router();

// GET /api/crm/properties/:id/knowledge-base
// Returns the full AI-ready knowledge context for a property
router.get("/properties/:id/knowledge-base", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: "Invalid property ID" });
    }

    const context = await propertyKnowledgeBase.getPropertyContext(propertyId);
    if (!context) {
      return res.status(404).json({ error: "Property not found" });
    }

    res.json(context);
  } catch (error) {
    console.error("Error fetching property knowledge base:", error);
    res.status(500).json({ error: "Failed to fetch property knowledge base" });
  }
});

// GET /api/crm/properties/:id/specifications
// Returns just the property specifications
router.get("/properties/:id/specifications", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: "Invalid property ID" });
    }

    const specs = await propertyKnowledgeBase.getSpecifications(propertyId);
    res.json(specs || {});
  } catch (error) {
    console.error("Error fetching specifications:", error);
    res.status(500).json({ error: "Failed to fetch specifications" });
  }
});

// PUT /api/crm/properties/:id/specifications
// Create or update property specifications
router.put("/properties/:id/specifications", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    if (isNaN(propertyId)) {
      return res.status(400).json({ error: "Invalid property ID" });
    }

    const id = await propertyKnowledgeBase.upsertSpecifications(propertyId, req.body);
    res.json({ id, message: "Specifications saved" });
  } catch (error) {
    console.error("Error saving specifications:", error);
    res.status(500).json({ error: "Failed to save specifications" });
  }
});

// GET /api/crm/certifications/expiring
// Returns certifications expiring within N days (default 60)
router.get("/certifications/expiring", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 60;
    const expiring = await propertyKnowledgeBase.getExpiringCertifications(days);
    res.json(expiring);
  } catch (error) {
    console.error("Error fetching expiring certifications:", error);
    res.status(500).json({ error: "Failed to fetch expiring certifications" });
  }
});

export default router;
```

- [ ] **Step 2: Register routes in server/routes.ts**

Add import at top:
```typescript
import propertyKnowledgeBaseRoutes from "./routes/propertyKnowledgeBaseRoutes";
```

Add registration (near other CRM route registrations):
```typescript
app.use("/api/crm", propertyKnowledgeBaseRoutes);
```

- [ ] **Step 3: Verify server starts without errors**

Run: `npm run dev` (check for startup errors, then Ctrl+C)

- [ ] **Step 4: Commit**

```bash
git add server/routes/propertyKnowledgeBaseRoutes.ts server/routes.ts
git commit -m "feat: add property knowledge base API endpoints"
```

---

### Task 4: Build Property Knowledge Base UI Page

**Files:**
- Create: `client/src/pages/PropertyKnowledgeBase.tsx`
- Modify: `client/src/App.tsx` (add route)
- Modify: `client/src/components/CRMLayout.tsx` (add nav link)

- [ ] **Step 1: Create the PropertyKnowledgeBase page**

This page shows the full knowledge base for a property: specifications form, certifications timeline, maintenance history, documents, and compliance status.

```typescript
// client/src/pages/PropertyKnowledgeBase.tsx
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CRMLayout } from "@/components/CRMLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Thermometer, Zap, Droplets, Building2, Key, Shield,
  Wrench, FileText, ClipboardCheck, AlertTriangle, CheckCircle2
} from "lucide-react";

export default function PropertyKnowledgeBase() {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id || "0");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: kb, isLoading } = useQuery({
    queryKey: ["property-kb", propertyId],
    queryFn: () => apiRequest(`/api/crm/properties/${propertyId}/knowledge-base`),
    enabled: propertyId > 0,
  });

  const { data: specs } = useQuery({
    queryKey: ["property-specs", propertyId],
    queryFn: () => apiRequest(`/api/crm/properties/${propertyId}/specifications`),
    enabled: propertyId > 0,
  });

  const saveSpecsMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiRequest(`/api/crm/properties/${propertyId}/specifications`, {
        method: "PUT",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["property-kb", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["property-specs", propertyId] });
      toast({ title: "Specifications saved" });
    },
  });

  if (isLoading) {
    return (
      <CRMLayout>
        <div className="flex items-center justify-center h-64">Loading...</div>
      </CRMLayout>
    );
  }

  if (!kb) {
    return (
      <CRMLayout>
        <div className="flex items-center justify-center h-64">Property not found</div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold">Property Knowledge Base</h1>
          <p className="text-muted-foreground">{kb.property.address}</p>
          <div className="flex gap-2 mt-2">
            <Badge>{kb.property.propertyType}</Badge>
            <Badge variant="outline">{kb.property.bedrooms} bed</Badge>
            <Badge variant={kb.property.isManaged ? "default" : "secondary"}>
              {kb.property.isManaged ? "Managed" : "Not Managed"}
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="specifications">Specifications</TabsTrigger>
            <TabsTrigger value="certifications">Certifications</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance History</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            {/* Landlord & Tenant */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-sm">Landlord</CardTitle></CardHeader>
                <CardContent>
                  <p className="font-medium">{kb.property.landlordName || "N/A"}</p>
                  <p className="text-sm text-muted-foreground">{kb.property.landlordPhone}</p>
                  <p className="text-sm text-muted-foreground">{kb.property.landlordEmail}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-sm">Active Tenancy</CardTitle></CardHeader>
                <CardContent>
                  {kb.activeTenancy ? (
                    <>
                      <p className="font-medium">{kb.activeTenancy.tenantName}</p>
                      <p className="text-sm text-muted-foreground">Rent: £{kb.activeTenancy.rentAmount}/month</p>
                      <p className="text-sm text-muted-foreground">
                        {kb.activeTenancy.startDate} - {kb.activeTenancy.endDate}
                      </p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">No active tenancy</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Certification Alerts */}
            {kb.certifications.filter((c: any) => c.daysUntilExpiry !== null && c.daysUntilExpiry <= 60).length > 0 && (
              <Card className="border-amber-500">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    Certification Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {kb.certifications
                    .filter((c: any) => c.daysUntilExpiry !== null && c.daysUntilExpiry <= 60)
                    .map((c: any, i: number) => (
                      <div key={i} className="flex justify-between items-center py-1">
                        <span>{c.type}</span>
                        <Badge variant={c.daysUntilExpiry <= 0 ? "destructive" : "outline"}>
                          {c.daysUntilExpiry <= 0 ? "EXPIRED" : `${c.daysUntilExpiry} days left`}
                        </Badge>
                      </div>
                    ))}
                </CardContent>
              </Card>
            )}

            {/* Quick Specs Summary */}
            {kb.specifications && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Property Specifications</CardTitle></CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Thermometer className="h-4 w-4 text-orange-500" />
                    <div>
                      <p className="text-muted-foreground">Heating</p>
                      <p>{kb.specifications.heating}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    <div>
                      <p className="text-muted-foreground">Electrical</p>
                      <p>{kb.specifications.electrical}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Droplets className="h-4 w-4 text-blue-500" />
                    <div>
                      <p className="text-muted-foreground">Water</p>
                      <p>{kb.specifications.water}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-gray-500" />
                    <div>
                      <p className="text-muted-foreground">Access</p>
                      <p>{kb.specifications.access}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Known Issues */}
            {kb.specifications?.knownIssues && (
              <Card className="border-red-300">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                    Known Issues
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{kb.specifications.knownIssues}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="specifications">
            <SpecificationsForm
              propertyId={propertyId}
              initialData={specs || {}}
              onSave={(data) => saveSpecsMutation.mutate(data)}
              isSaving={saveSpecsMutation.isPending}
            />
          </TabsContent>

          <TabsContent value="certifications" className="space-y-4">
            {kb.certifications.length === 0 ? (
              <p className="text-muted-foreground">No certifications recorded</p>
            ) : (
              kb.certifications.map((c: any, i: number) => (
                <Card key={i}>
                  <CardContent className="flex justify-between items-center py-4">
                    <div className="flex items-center gap-3">
                      <Shield className="h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{c.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {c.certificateNumber} - Issued by {c.issuedBy || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge
                        variant={
                          c.status === "valid" ? "default" :
                          c.status === "expiring_soon" ? "outline" : "destructive"
                        }
                      >
                        {c.status}
                      </Badge>
                      <p className="text-sm text-muted-foreground mt-1">
                        Expires: {c.expiryDate || "N/A"}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="maintenance" className="space-y-4">
            {kb.recentMaintenance.length === 0 ? (
              <p className="text-muted-foreground">No maintenance history</p>
            ) : (
              kb.recentMaintenance.map((m: any) => (
                <Card key={m.id}>
                  <CardContent className="flex justify-between items-center py-4">
                    <div className="flex items-center gap-3">
                      <Wrench className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{m.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {m.category} | {m.urgency} | {m.createdAt}
                          {m.contractorName ? ` | ${m.contractorName}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={m.status === "completed" || m.status === "closed" ? "default" : "outline"}>
                        {m.status}
                      </Badge>
                      {m.cost && (
                        <p className="text-sm text-muted-foreground mt-1">
                          £{(m.cost / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="documents" className="space-y-4">
            {kb.documents.length === 0 ? (
              <p className="text-muted-foreground">No documents</p>
            ) : (
              kb.documents.map((d: any, i: number) => (
                <Card key={i}>
                  <CardContent className="flex justify-between items-center py-4">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-sm text-muted-foreground">{d.type} | Uploaded: {d.uploadedAt}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={d.status === "active" ? "default" : "destructive"}>
                        {d.status}
                      </Badge>
                      {d.expiryDate && (
                        <p className="text-sm text-muted-foreground mt-1">Expires: {d.expiryDate}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </CRMLayout>
  );
}

function SpecificationsForm({
  propertyId,
  initialData,
  onSave,
  isSaving,
}: {
  propertyId: number;
  initialData: Record<string, any>;
  onSave: (data: Record<string, unknown>) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState(initialData);

  const update = (field: string, value: string) => {
    setForm((prev: Record<string, any>) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      {/* Heating */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Thermometer className="h-4 w-4" /> Heating System
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Heating Type</Label>
            <Select value={form.heatingType || ""} onValueChange={(v) => update("heatingType", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gas_central">Gas Central</SelectItem>
                <SelectItem value="electric">Electric</SelectItem>
                <SelectItem value="oil">Oil</SelectItem>
                <SelectItem value="heat_pump">Heat Pump</SelectItem>
                <SelectItem value="underfloor">Underfloor</SelectItem>
                <SelectItem value="storage_heaters">Storage Heaters</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Boiler Make</Label>
            <Input value={form.boilerMake || ""} onChange={(e) => update("boilerMake", e.target.value)} />
          </div>
          <div>
            <Label>Boiler Model</Label>
            <Input value={form.boilerModel || ""} onChange={(e) => update("boilerModel", e.target.value)} />
          </div>
          <div>
            <Label>Thermostat Type</Label>
            <Select value={form.thermostatType || ""} onValueChange={(v) => update("thermostatType", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="programmable">Programmable</SelectItem>
                <SelectItem value="smart">Smart</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Radiator Count</Label>
            <Input type="number" value={form.radiatorCount || ""} onChange={(e) => update("radiatorCount", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Access & Keys */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Key className="h-4 w-4" /> Access & Security
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Entry System</Label>
            <Select value={form.entrySystem || ""} onValueChange={(v) => update("entrySystem", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="key">Key</SelectItem>
                <SelectItem value="fob">Fob</SelectItem>
                <SelectItem value="code">Code</SelectItem>
                <SelectItem value="smart_lock">Smart Lock</SelectItem>
                <SelectItem value="concierge">Concierge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Key Storage Location</Label>
            <Input value={form.keyStorageLocation || ""} onChange={(e) => update("keyStorageLocation", e.target.value)} />
          </div>
          <div>
            <Label>Alarm System</Label>
            <Select value={form.alarmSystem || ""} onValueChange={(v) => update("alarmSystem", v)}>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="wired">Wired</SelectItem>
                <SelectItem value="wireless">Wireless</SelectItem>
                <SelectItem value="smart">Smart</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label>Access Notes</Label>
            <Textarea value={form.accessNotes || ""} onChange={(e) => update("accessNotes", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Known Issues */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Known Issues & Special Instructions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Known Issues</Label>
            <Textarea value={form.knownIssues || ""} onChange={(e) => update("knownIssues", e.target.value)} placeholder="Ongoing problems, quirks, things to be aware of..." />
          </div>
          <div>
            <Label>Special Instructions</Label>
            <Textarea value={form.specialInstructions || ""} onChange={(e) => update("specialInstructions", e.target.value)} placeholder="Anything unusual about accessing or managing this property..." />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => onSave(form)} disabled={isSaving}>
        {isSaving ? "Saving..." : "Save Specifications"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Add route in App.tsx**

Add import at top of App.tsx:
```typescript
import PropertyKnowledgeBase from "./pages/PropertyKnowledgeBase";
```

Add route BEFORE the `/crm` catch-all route:
```tsx
<Route path="/crm/properties/:id/knowledge-base" component={PropertyKnowledgeBase} />
```

- [ ] **Step 3: Add nav link in CRMLayout.tsx**

In the property management section of the sidebar, knowledge base links will be per-property (accessed from property detail pages), so add a note/link in the PM section pointing to the concept.

- [ ] **Step 4: Verify the page renders**

Run: `npm run dev`, navigate to `/crm/properties/1/knowledge-base`

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/PropertyKnowledgeBase.tsx client/src/App.tsx
git commit -m "feat: add Property Knowledge Base UI with specifications form and overview tabs"
```

---

### Task 5: Integrate Knowledge Base with Agent System

**Files:**
- Modify: `server/agents/BaseAgent.ts` (add knowledge base context injection)

- [ ] **Step 1: Import propertyKnowledgeBase in BaseAgent.ts**

Add at top:
```typescript
import { propertyKnowledgeBase } from "../services/propertyKnowledgeBase";
```

- [ ] **Step 2: Enhance buildContext method to include property knowledge**

In the `buildContext` method, after existing context assembly, add:

```typescript
// If task has a propertyId, inject full knowledge base context
if (task.propertyId) {
  const kbContext = await propertyKnowledgeBase.getPropertyContext(task.propertyId);
  if (kbContext) {
    context.propertyKnowledge = kbContext.summary;
  }
}
```

- [ ] **Step 3: Update buildUserPrompt in BaseAgent to include KB context**

In the user prompt construction, add after property info:

```typescript
if (context.propertyKnowledge) {
  prompt += `\n\nPROPERTY KNOWLEDGE BASE:\n${context.propertyKnowledge}\n`;
}
```

- [ ] **Step 4: Verify agents can access knowledge base**

Run: `npm run dev` and test by sending a maintenance request via the orchestrator.

- [ ] **Step 5: Commit**

```bash
git add server/agents/BaseAgent.ts
git commit -m "feat: inject property knowledge base context into AI agent decisions"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-03-19-property-knowledge-base.md`. This plan has 5 tasks covering schema, service, API, UI, and agent integration.

The second plan (AI Employee System) will be saved as a separate document.
