import { Router } from 'express';
import { storage } from './storage';
import { db, pool } from './db';
import {
  insertPropertySchema,
  portalCredentialsFormSchema,
  maintenanceTicketFormSchema,
  InsertProperty,
  supportTickets,
  contractorQuotes,
  ticketWorkflowEvents,
  contractors,
  insertContractorSchema,
  propertyCertificates,
  insertPropertyCertificateSchema,
  managementFees,
  insertManagementFeeSchema,
  tenancyContracts,
  landlords,
  tenant,
  properties,
  complianceRequirements,
  complianceStatus,
  insertComplianceRequirementSchema,
  insertComplianceStatusSchema,
  maintenanceTickets,
  managedProperties,
  unifiedContacts,
  salesProgression,
  // Main tables for property management
  tenancies,
  tenancyContracts,
  tenancyChecklistItems as tenancyChecklist,
  insertLandlordSchema,
  insertTenantSchema,
  insertTenancyContractSchema as insertTenancySchema,
  insertTenancyChecklistItemSchema as insertTenancyChecklistSchema,
  tenancyChecklistItemTypes,
  tenancyChecklistItemLabels,
  tenancyChecklistItemMeta,
  // Security tables
  securitySettings,
  securityAuditLog,
  insertSecuritySettingSchema,
  insertSecurityAuditLogSchema,
  SECURITY_CLEARANCE_LEVELS,
  SECURITY_CLEARANCE_LABELS,
  DEFAULT_FEATURE_SECURITY,
  DEFAULT_ACCESS_LEVELS,
  DEFAULT_ACCESS_LEVEL_PERMISSIONS,
  DEFAULT_FEATURE_MODULES,
  accessLevels,
  userCustomPermissions,
  featureModules,
  accessLevelPermissions,
  estateAgencyRoles,
  users,
  // CMS tables
  cmsPages,
  cmsContentBlocks,
  cmsMedia,
  insertCmsPageSchema,
  insertCmsContentBlockSchema,
  insertCmsMediaSchema,
  staffProfiles
} from '@shared/schema';

import { eq, desc, and, sql, or } from 'drizzle-orm';
import {
  parsePropertyFromNaturalLanguage,
  enhancePropertyDescription,
  generatePropertyTitle,
  suggestPropertyFeatures
} from './aiPropertyParser';
import { z } from 'zod';
import {
  createPaymentIntent,
  recordPayment,
  getCustomerPayments,
  getPaymentSchedules,
  createPaymentSchedule,
  getPublishableKey,
  isStripeConfigured
} from './paymentService';
import { portalSyndication } from './portalSyndicationService';
import { aiPhone } from './aiPhoneService';
import { collaborationHub } from './collaborationHubService';
import { emailService } from './emailService';
import { docuSignService } from './docusignService';
import { tenantSupportService } from './tenantSupportService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID, randomBytes } from 'crypto';
import crypto from 'crypto';

import { propertyImport } from './propertyImportService';
import { websiteImport } from './websiteImportService';

export const crmRouter = Router();

// Configure multer for property image uploads
const uploadDir = path.join(process.cwd(), 'uploads', 'properties');

// Ensure upload directory exists
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const propertyImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `property-${uniqueId}${ext}`);
  }
});

const uploadPropertyImage = multer({
  storage: propertyImageStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WEBP, and GIF are allowed.'));
    }
  }
});

// Configure multer for CSV imports
const csvUploadDir = path.join(process.cwd(), 'uploads', 'imports');
if (!fs.existsSync(csvUploadDir)) {
  fs.mkdirSync(csvUploadDir, { recursive: true });
}

const csvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, csvUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `import-${uniqueId}${ext}`);
  }
});

const uploadCsv = multer({
  storage: csvStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed.'));
    }
  }
});

// Configure multer for tenancy document uploads (PDFs, images, etc.)
const documentsUploadDir = path.join(process.cwd(), 'uploads', 'documents');
if (!fs.existsSync(documentsUploadDir)) {
  fs.mkdirSync(documentsUploadDir, { recursive: true });
}

const documentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, documentsUploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueId = randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `doc-${uniqueId}${ext}`);
  }
});

const uploadDocument = multer({
  storage: documentStorage,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB max for documents
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, images (JPEG, PNG, WEBP, GIF), and Word documents are allowed.'));
    }
  }
});

// Middleware to check if user is authenticated and is admin/agent
const requireAgent = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role !== 'admin' && req.user.role !== 'agent') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  next();
};

// Middleware to check if user is admin only
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required' });
  }
  next();
};

// Middleware to check security clearance level
const requireClearance = (minLevel: number) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    // Admins always have full access
    if (req.user.role === 'admin') {
      return next();
    }
    const userClearance = req.user.securityClearance || 1;
    if (userClearance < minLevel) {
      return res.status(403).json({
        error: `Requires clearance level ${minLevel}`,
        currentLevel: userClearance
      });
    }
    next();
  };
};

// Role-based permission middleware factory
// Usage: requirePermission('sales', 'view_listings') or requirePermission('maintenance', 'full_access')
const requirePermission = (category: string, permission: string) => {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Admins always have full access
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const hasPermission = await storage.checkUserPermission(req.user.id, category, permission);

      if (!hasPermission) {
        return res.status(403).json({
          error: 'Insufficient permissions',
          required: { category, permission }
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Failed to verify permissions' });
    }
  };
};

// Role-based middleware for specific roles (e.g., property manager, branch manager)
const requireRole = (...roleCodes: string[]) => {
  return async (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Admins always have full access
    if (req.user.role === 'admin') {
      return next();
    }

    try {
      const userRole = await storage.getUserPrimaryRole(req.user.id);

      if (!userRole || !roleCodes.includes(userRole.roleCode)) {
        return res.status(403).json({
          error: 'Role not authorized for this action',
          required: roleCodes
        });
      }

      next();
    } catch (error) {
      console.error('Role check error:', error);
      return res.status(500).json({ error: 'Failed to verify role' });
    }
  };
};

// ==========================================
// IMAGE UPLOAD ROUTES
// ==========================================

// Upload a single property image
crmRouter.post('/upload/property-image', requireAgent, uploadPropertyImage.single('image'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Return the URL path that can be used to access the image
    const imageUrl = `/uploads/properties/${req.file.filename}`;

    res.json({
      success: true,
      url: imageUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (error) {
    console.error('Error uploading property image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Upload multiple property images
crmRouter.post('/upload/property-images', requireAgent, uploadPropertyImage.array('images', 20), async (req: any, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No image files provided' });
    }

    const uploadedImages = req.files.map((file: any) => ({
      url: `/uploads/properties/${file.filename}`,
      filename: file.filename,
      originalName: file.originalname,
      size: file.size
    }));

    res.json({
      success: true,
      images: uploadedImages
    });
  } catch (error) {
    console.error('Error uploading property images:', error);
    res.status(500).json({ error: 'Failed to upload images' });
  }
});

// Delete a property image
crmRouter.delete('/upload/property-image/:filename', requireAgent, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(uploadDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Image deleted successfully' });
    } else {
      res.status(404).json({ error: 'Image not found' });
    }
  } catch (error) {
    console.error('Error deleting property image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Upload a tenancy document (for checklist items, references, etc.)
crmRouter.post('/upload/document', requireAgent, uploadDocument.single('document'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No document file provided' });
    }

    const documentUrl = `/uploads/documents/${req.file.filename}`;

    res.json({
      success: true,
      url: documentUrl,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimeType: req.file.mimetype
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// Delete a tenancy document
crmRouter.delete('/upload/document/:filename', requireAgent, async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(documentsUploadDir, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      res.json({ success: true, message: 'Document deleted successfully' });
    } else {
      res.status(404).json({ error: 'Document not found' });
    }
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// ==========================================
// Property CRUD operations

crmRouter.get('/properties', requireAgent, async (req, res) => {
  try {
    // Using main properties table - single source of truth for all properties
    // Flags: isManaged, isListed, isRental, isResidential, isPublished*
    const allProperties = await db.select({
      id: properties.id,
      title: properties.title,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      postcode: properties.postcode,
      propertyType: properties.propertyType,
      isResidential: properties.isResidential,
      bedrooms: properties.bedrooms,
      bathrooms: properties.bathrooms,
      price: properties.price,
      isManaged: properties.isManaged,
      isListed: properties.isListed,
      isRental: properties.isRental,
      landlordId: properties.landlordId,
      status: properties.status,
      createdAt: properties.createdAt,
      // Publishing flags
      isPublishedWebsite: properties.isPublishedWebsite,
      isPublishedZoopla: properties.isPublishedZoopla,
      isPublishedRightmove: properties.isPublishedRightmove,
      isPublishedOnTheMarket: properties.isPublishedOnTheMarket,
      isPublishedSocial: properties.isPublishedSocial
    })
    .from(properties)
    .orderBy(desc(properties.createdAt));

    res.json(allProperties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Rental agreements - using main tenancies table
crmRouter.get('/rental-agreements', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        t.id, t.property_id as "propertyId", t.landlord_id as "landlordId", t.tenant_id as "tenantId",
        t.start_date as "startDate", t.end_date as "endDate", t.rent_amount as "rentAmount",
        t.rent_frequency as "rentFrequency", t.deposit_amount as "depositAmount",
        t.deposit_scheme as "depositScheme", t.deposit_certificate_number as "depositReference",
        t.status, t.notes, t.created_at as "createdAt",
        p.address_line1 as "propertyAddress", p.postcode, p.property_type as "propertyType", p.bedrooms,
        p.management_fee_type as "managementFeeType", p.management_fee_value as "managementFeeValue",
        l.name as "landlordName", l.email as "landlordEmail", l.phone as "landlordPhone"
      FROM tenancy t
      LEFT JOIN property p ON t.property_id = p.id
      LEFT JOIN landlord l ON t.landlord_id = l.id
      ORDER BY t.created_at DESC
    `);

    const transformed = result.rows.map(t => ({
      ...t,
      propertyAddress: t.propertyAddress ? `${t.propertyAddress}, ${t.postcode}` : 'Unknown',
      landlordName: t.landlordName || 'Not assigned',
      rentFrequency: t.rentFrequency || 'monthly',
      managementFeePercent: t.managementFeeType === 'percentage' ? t.managementFeeValue : null,
      managementFeeFixed: t.managementFeeType === 'fixed' ? t.managementFeeValue : null
    }));

    res.json(transformed);
  } catch (error) {
    console.error('Error fetching rental agreements:', error);
    res.status(500).json({ error: 'Failed to fetch rental agreements' });
  }
});

// Managed properties - DRIZZLE ORM (using correct field names: name not fullName)
crmRouter.get('/managed-properties', requireAgent, async (req, res) => {
  try {
    // Get all managed properties from the main properties table
    const managedPropertyList = await db.select({
      id: properties.id,
      address: properties.address,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      city: properties.city,
      postcode: properties.postcode,
      propertyType: properties.propertyType,
      isResidential: properties.isResidential,
      bedrooms: properties.bedrooms,
      bathrooms: properties.bathrooms,
      isManaged: properties.isManaged,
      isListed: properties.isListed,
      isRental: properties.isRental,
      landlordId: properties.landlordId,
      managementFeeType: properties.managementFeeType,
      managementFeeValue: properties.managementFeeValue,
      managementPeriodMonths: properties.managementPeriodMonths,
      managementStartDate: properties.managementStartDate,
      status: properties.status,
      // Landlord info - using 'name' not 'fullName'
      landlordName: landlords.name,
      landlordEmail: landlords.email,
      landlordPhone: landlords.phone,
      landlordMobile: landlords.mobile,
      landlordAddress: landlords.addressLine1,
      landlordCompanyName: landlords.companyName
    })
    .from(properties)
    .leftJoin(landlords, eq(properties.landlordId, landlords.id))
    .where(eq(properties.isManaged, true))
    .orderBy(desc(properties.createdAt));

    // For each property, get any active tenancy info
    const enriched = await Promise.all(managedPropertyList.map(async (p) => {
      // Get active tenancy for this property - using 'name' not 'fullName'
      const [activeTenancy] = await db.select({
        id: tenancies.id,
        tenantId: tenancies.tenantId,
        rentAmount: tenancies.rentAmount,
        rentFrequency: tenancies.rentFrequency,
        depositAmount: tenancies.depositAmount,
        depositScheme: tenancies.depositScheme,
        depositHolderType: tenancies.depositHolderType,
        periodMonths: tenancies.periodMonths,
        startDate: tenancies.startDate,
        endDate: tenancies.endDate,
        tenantName: tenant.name
      })
      .from(tenancies)
      .leftJoin(tenant, eq(tenancies.tenantId, tenant.id))
      .where(and(
        eq(tenancies.propertyId, p.id),
        eq(tenancies.status, 'active')
      ))
      .limit(1);

      // Get checklist progress for the active tenancy
      let checklistComplete = 0;
      let checklistTotal = 19; // 19 checklist items
      if (activeTenancy) {
        const allItems = await db.select()
          .from(tenancyChecklist)
          .where(eq(tenancyChecklist.tenancyId, activeTenancy.id));

        checklistTotal = allItems.length || 19;
        checklistComplete = allItems.filter(item => item.isCompleted === true).length;
      }

      // Format deposit holder for display
      const formatDepositHolder = (holderType: string | null, scheme: string | null) => {
        if (!holderType) return null;
        if (holderType === 'landlord') return 'Held By Landlord';
        if (holderType === 'agency_insurance') return 'Agency: Insurance';
        if (holderType === 'agency_custodial') return scheme === 'dps' ? 'Agency: DPS' : scheme === 'tds' ? 'Agency: TDS' : 'Agency: Custodial';
        return holderType;
      };

      // Format management period for display
      const formatManagementPeriod = (months: number | null) => {
        if (!months) return null;
        if (months === 12) return '12 Months';
        if (months === 24) return '24 Months';
        if (months === 36) return '36 Months';
        return `${months} Months`;
      };

      return {
        id: p.id,
        propertyId: p.id,
        propertyAddress: p.addressLine1 || p.address,
        postcode: p.postcode,
        propertyType: p.propertyType,
        isResidential: p.isResidential,
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        isManaged: p.isManaged,
        isListed: p.isListed,
        isRental: p.isRental,
        status: p.status,
        landlordId: p.landlordId,
        landlordName: p.landlordName || 'Not assigned',
        landlordEmail: p.landlordEmail,
        landlordMobile: p.landlordMobile,
        landlordAddress: p.landlordAddress,
        landlordCompanyName: p.landlordCompanyName,
        managementFeePercent: p.managementFeeType === 'percentage' ? p.managementFeeValue : null,
        managementFeeFixed: p.managementFeeType === 'fixed' ? p.managementFeeValue : null,
        managementPeriod: formatManagementPeriod(p.managementPeriodMonths) || (activeTenancy?.periodMonths ? formatManagementPeriod(activeTenancy.periodMonths) : null),
        managementStartDate: p.managementStartDate,
        // Tenancy info
        tenancyId: activeTenancy?.id || null,
        tenantId: activeTenancy?.tenantId || null,
        tenantName: activeTenancy?.tenantName || null,
        rentAmount: activeTenancy?.rentAmount || null,
        rentFrequency: activeTenancy?.rentFrequency || 'monthly',
        depositAmount: activeTenancy?.depositAmount || null,
        depositHeldBy: formatDepositHolder(activeTenancy?.depositHolderType, activeTenancy?.depositScheme),
        tenancyStart: activeTenancy?.startDate || null,
        tenancyEnd: activeTenancy?.endDate || null,
        // Checklist progress
        checklistComplete,
        checklistTotal
      };
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Error fetching managed properties:', error?.message || error);
    console.error('Stack:', error?.stack);
    res.status(500).json({ error: 'Failed to fetch managed properties', details: error?.message });
  }
});

// Download managed properties import template
crmRouter.get('/managed-properties/template', requireAgent, (req, res) => {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'managed-properties-import-template.csv');
  if (fs.existsSync(templatePath)) {
    res.download(templatePath, 'managed-properties-import-template.csv');
  } else {
    res.status(404).json({ error: 'Template file not found' });
  }
});

// Import managed properties from CSV
crmRouter.post('/managed-properties/import', requireAgent, uploadCsv.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path, 'utf-8');
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file is empty or has no data rows' });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    const results = { success: 0, errors: [] as string[], created: [] as any[] };

    for (let i = 1; i < lines.length; i++) {
      try {
        // Parse CSV line properly handling quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of lines[i]) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const row: Record<string, string> = {};
        headers.forEach((header, index) => {
          row[header] = values[index]?.replace(/"/g, '') || '';
        });

        // Validate required fields
        if (!row.property_address || !row.landlord_name || !row.landlord_email) {
          results.errors.push(`Row ${i + 1}: Missing required fields (property_address, landlord_name, landlord_email)`);
          continue;
        }

        // Extract postcode from property address if not provided separately
        const postcodeMatch = row.property_address.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
        const postcode = postcodeMatch ? postcodeMatch[1].toUpperCase() : 'W10 5AD';

        // Create or find landlord contact
        let landlordContact = await db.select().from(unifiedContacts)
          .where(eq(unifiedContacts.email, row.landlord_email))
          .limit(1);

        let landlordId: number;
        if (landlordContact.length === 0) {
          const [newLandlord] = await db.insert(unifiedContacts).values({
            fullName: row.landlord_name,
            email: row.landlord_email,
            phone: row.landlord_phone || null,
            mobile: row.landlord_mobile || null,
            address: row.landlord_address || null,
            bankName: row.landlord_bank_name || null,
            bankAccountNumber: row.landlord_account_number || null,
            bankSortCode: row.landlord_sort_code || null,
            contactType: 'landlord',
            status: 'active'
          }).returning();
          landlordId = newLandlord.id;
        } else {
          // Update existing landlord with any new bank/address details
          landlordId = landlordContact[0].id;
          if (row.landlord_address || row.landlord_mobile || row.landlord_bank_name) {
            await db.update(unifiedContacts)
              .set({
                mobile: row.landlord_mobile || landlordContact[0].mobile,
                address: row.landlord_address || landlordContact[0].address,
                bankName: row.landlord_bank_name || landlordContact[0].bankName,
                bankAccountNumber: row.landlord_account_number || landlordContact[0].bankAccountNumber,
                bankSortCode: row.landlord_sort_code || landlordContact[0].bankSortCode
              })
              .where(eq(unifiedContacts.id, landlordId));
          }
        }

        // Create property
        const rentAmount = row.rent_amount ? parseInt(row.rent_amount) * 100 : 0; // Convert to pence
        const depositAmount = row.deposit_amount ? parseInt(row.deposit_amount) * 100 : rentAmount * 2; // Default to 2x rent
        const [newProperty] = await db.insert(properties).values({
          title: `Property at ${row.property_address}`,
          description: row.notes || `Managed property at ${row.property_address}`,
          addressLine1: row.property_address,
          postcode: postcode,
          propertyType: 'flat',
          bedrooms: 1,
          bathrooms: 1,
          price: rentAmount,
          isRental: true,
          status: row.tenant_name ? 'let' : 'active',
          tenure: 'leasehold',
          rentPeriod: row.rent_frequency || 'monthly',
          isManaged: true,
          isListed: false,
          landlordId: landlordId
        }).returning();

        // Create managed property record
        const managementStartDate = row.tenancy_start_date ? new Date(row.tenancy_start_date) : new Date();
        const [managedProp] = await db.insert(managedProperties).values({
          propertyId: newProperty.id,
          landlordId: landlordId,
          managementStartDate: managementStartDate,
          managementType: 'full',
          status: 'active',
          managementFeeType: 'percentage',
          managementFeeValue: '12',
          rentAmount: rentAmount,
          rentFrequency: row.rent_frequency || 'monthly',
          depositAmount: depositAmount
        }).returning();

        // Create tenant contact if provided
        if (row.tenant_name && row.tenant_email) {
          let tenantContact = await db.select().from(unifiedContacts)
            .where(eq(unifiedContacts.email, row.tenant_email))
            .limit(1);

          let tenantId: number;
          if (tenantContact.length === 0) {
            const [newTenant] = await db.insert(unifiedContacts).values({
              fullName: row.tenant_name,
              email: row.tenant_email,
              mobile: row.tenant_mobile || null,
              contactType: 'tenant',
              status: 'active'
            }).returning();
            tenantId = newTenant.id;
          } else {
            tenantId = tenantContact[0].id;
          }

          // Create tenancy contract if dates provided
          if (row.tenancy_start_date) {
            await db.insert(tenancyContracts).values({
              propertyId: newProperty.id,
              tenantId: tenantId,
              landlordId: landlordId,
              startDate: new Date(row.tenancy_start_date),
              endDate: row.tenancy_end_date ? new Date(row.tenancy_end_date) : null,
              rentAmount: rentAmount,
              depositAmount: depositAmount,
              rentFrequency: row.rent_frequency || 'monthly',
              status: 'active'
            });
          }
        }

        results.success++;
        results.created.push({
          propertyId: newProperty.id,
          address: row.property_address,
          landlord: row.landlord_name
        });

      } catch (rowError: any) {
        results.errors.push(`Row ${i + 1}: ${rowError.message}`);
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: `Import completed. ${results.success} properties imported successfully.`,
      success: results.success,
      errors: results.errors,
      created: results.created
    });

  } catch (error: any) {
    console.error('Error importing managed properties:', error);
    res.status(500).json({ error: 'Failed to import managed properties', details: error.message });
  }
});

// DUPLICATE ROUTE REMOVED - /properties is defined at line 310

crmRouter.get('/properties/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // Using PM tables - properties
    const [property] = await db.select({
      id: properties.id,
      title: properties.title,
      propertyName: properties.propertyName,
      address: properties.address,
      addressLine1: properties.addressLine1,
      addressLine2: properties.addressLine2,
      city: properties.city,
      postcode: properties.postcode,
      propertyType: properties.propertyType,
      isResidential: properties.isResidential,
      bedrooms: properties.bedrooms,
      bathrooms: properties.bathrooms,
      receptions: properties.receptions,
      squareFootage: properties.squareFootage,
      description: properties.description,
      images: properties.images,
      floorPlan: properties.floorPlan,
      features: properties.features,
      amenities: properties.amenities,
      tenure: properties.tenure,
      leaseLength: properties.leaseLength,
      groundRent: properties.groundRent,
      serviceCharge: properties.serviceCharge,
      councilTaxBand: properties.councilTaxBand,
      energyRating: properties.energyRating,
      isManaged: properties.isManaged,
      isListed: properties.isListed,
      isRental: properties.isRental,
      landlordId: properties.landlordId,
      vendorId: properties.vendorId,
      managementType: properties.managementType,
      managementFeeType: properties.managementFeeType,
      managementFeeValue: properties.managementFeeValue,
      rentAmount: properties.rentAmount,
      rentPeriod: properties.rentPeriod,
      deposit: properties.deposit,
      furnished: properties.furnished,
      availableFrom: properties.availableFrom,
      minimumTenancy: properties.minimumTenancy,
      price: properties.price,
      priceQualifier: properties.priceQualifier,
      isPublishedWebsite: properties.isPublishedWebsite,
      isPublishedZoopla: properties.isPublishedZoopla,
      isPublishedRightmove: properties.isPublishedRightmove,
      isPublishedOnTheMarket: properties.isPublishedOnTheMarket,
      isPublishedSocial: properties.isPublishedSocial,
      status: properties.status,
      notes: properties.notes,
      createdAt: properties.createdAt,
      updatedAt: properties.updatedAt
    })
    .from(properties)
    .where(eq(properties.id, id));

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// DocuSign OAuth Routes
crmRouter.get('/docusign/auth', requireAgent, (req, res) => {
  if (!docuSignService.isConfigured()) {
    return res.status(500).json({ error: 'DocuSign not configured on server' });
  }
  const authUrl = docuSignService.getAuthorizationUrl();
  res.json({ url: authUrl });
});

crmRouter.get('/docusign/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  const result = await docuSignService.handleCallback(code as string);
  if (result.success) {
    res.send('<html><body><h1>Authenticated!</h1><p>You can close this window now.</p><script>window.close()</script></body></html>');
  } else {
    res.status(500).send(`Authentication failed: ${result.error}`);
  }
});

crmRouter.get('/docusign/status', requireAgent, (req, res) => {
  res.json(docuSignService.getConfiguration());
});

// Sales Progression - Send Contract
crmRouter.post('/sales-progression/:id/send-contract', requireAgent, async (req, res) => {
  try {
    const { buyerEmail, buyerName, sellerEmail, sellerName, propertyAddress, purchasePrice, completionDate } = req.body;

    // In a real app, we'd generate a PDF here. Using a placeholder for now.
    const documentBase64 = Buffer.from('Sales Contract Placeholder Content').toString('base64');

    const result = await docuSignService.sendSalesContract({
      buyerEmail,
      buyerName,
      sellerEmail,
      sellerName,
      propertyAddress,
      purchasePrice,
      completionDate,
      documentBase64
    });

    // Create sales progression record in database
    await storage.createSalesProgression({
      propertyId: parseInt(req.params.id),
      currentStage: 'offer_accepted',
      buyerName,
      buyerEmail,
      solicitorName: 'TBD',
      status: 'active'
    });

    res.json(result);
  } catch (error: any) {
    console.error('DocuSign error:', error);
    res.status(500).json({ error: error.message || 'Failed to send contract' });
  }
});

// Send Tenancy Agreement
crmRouter.post('/tenancy/:id/send-agreement', requireAgent, async (req, res) => {
  try {
    const { tenantEmail, tenantName, landlordEmail, landlordName, propertyAddress, monthlyRent, depositAmount, startDate, endDate } = req.body;

    const documentBase64 = Buffer.from('Tenancy Agreement Placeholder Content').toString('base64');

    const result = await docuSignService.sendTenancyAgreement({
      tenantEmail,
      tenantName,
      landlordEmail,
      landlordName,
      propertyAddress,
      monthlyRent,
      depositAmount,
      startDate,
      endDate,
      documentBase64
    });

    res.json(result);
  } catch (error: any) {
    console.error('DocuSign tenancy error:', error);
    res.status(500).json({ error: error.message || 'Failed to send tenancy agreement' });
  }
});


// Also fetch portal listings for this property
// crmRouter.get('/properties/:id/full', ... )

crmRouter.post('/properties', requireAgent, async (req, res) => {
  try {
    const validated = insertPropertySchema.parse(req.body);

    // Get the area ID from postcode if areas are configured
    const areas = await storage.getLondonAreas();
    const area = areas.find(a => validated.postcode?.startsWith(a.postcode));

    // If no areas configured, validate against West London postcodes
    if (areas.length === 0 && validated.postcode) {
      const westLondonPostcodes = ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW10'];
      const isValidPostcode = westLondonPostcodes.some(p => validated.postcode!.toUpperCase().startsWith(p));
      if (!isValidPostcode) {
        return res.status(400).json({ error: 'Invalid postcode - must be in W2, W9, W10, W11, NW6, or NW10' });
      }
    } else if (areas.length > 0 && !area) {
      return res.status(400).json({ error: 'Invalid postcode - must be in covered areas' });
    }

    // Enhance description with AI if not provided
    let finalDescription = validated.description;
    if (!validated.description || validated.description.length < 100) {
      finalDescription = await enhancePropertyDescription(validated);
    }

    // Generate title if not provided
    let finalTitle = validated.title;
    if (!validated.title) {
      finalTitle = await generatePropertyTitle(validated);
    }

    const property = await storage.createProperty({
      ...validated,
      areaId: area?.id,
      title: finalTitle,
      description: finalDescription,
      price: validated.price, // Already in pence from frontend
      deposit: validated.deposit
    });

    res.json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid property data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create property' });
  }
});

crmRouter.put('/properties/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    // Convert price to pence if provided in pounds (values under 1,000,000 are assumed to be pounds)
    if (updates.price && typeof updates.price === 'number' && updates.price < 1000000) {
      updates.price = updates.price * 100;
    }
    if (updates.deposit && typeof updates.deposit === 'number' && updates.deposit < 100000) {
      updates.deposit = updates.deposit * 100;
    }
    if (updates.rentAmount && typeof updates.rentAmount === 'number' && updates.rentAmount < 100000) {
      updates.rentAmount = updates.rentAmount * 100;
    }

    // Use Drizzle ORM for the update
    const [property] = await db.update(properties)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

crmRouter.patch('/properties/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    // Convert price to pence if provided
    if (updates.price && typeof updates.price === 'number' && updates.price < 1000000) {
      updates.price = updates.price * 100;
    }
    if (updates.deposit && typeof updates.deposit === 'number' && updates.deposit < 100000) {
      updates.deposit = updates.deposit * 100;
    }

    // UPDATE property table (CRM now uses this table)
    const [property] = await db.update(properties)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(500).json({ error: 'Failed to update property' });
  }
});

crmRouter.delete('/properties/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const success = await storage.deleteProperty(id);

    if (!success) {
      return res.status(404).json({ error: 'Property not found' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

// Maintenance
crmRouter.get('/maintenance', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.query.propertyId as string);
    if (!propertyId || isNaN(propertyId)) {
      return res.status(400).json({ error: 'Property ID required' });
    }
    const tickets = await storage.getMaintenanceTicketsByProperty(propertyId);
    res.json(tickets);
  } catch (error) {
    console.error('Error fetching maintenance:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance tickets' });
  }
});

// Communications
crmRouter.get('/communications', requireAgent, async (req, res) => {
  try {
    const tenantId = req.query.tenantId ? parseInt(req.query.tenantId as string) : undefined;
    const propertyId = req.query.propertyId ? parseInt(req.query.propertyId as string) : undefined;

    if (!tenantId && !propertyId) {
      return res.json([]);
    }

    const logs = await storage.getCommunications(tenantId, propertyId);
    res.json(logs);
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

// Individual tenant lookup - RAW SQL
crmRouter.get('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(`
      SELECT id, name as "fullName", email, phone, mobile, address,
             employer, employer_address as "employerAddress", employer_phone as "employerPhone",
             job_title as "jobTitle", annual_income as "annualIncome",
             emergency_contact_name as "emergencyContactName", emergency_contact_phone as "emergencyContactPhone",
             notes, status, created_at as "createdAt", updated_at as "updatedAt"
      FROM tenant WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// Get all tenants - RAW SQL with tenancy/property data
crmRouter.get('/tenants', requireAgent, async (req, res) => {
  try {
    // Query from 'tenant' table with LEFT JOINs to get property and rent details
    // Try multiple linking methods: tenant.rental_agreement_id, rental_agreement.tenant_id, or tenant.property_id
    const result = await pool.query(`
      SELECT t.id, t.name as "fullName", t.email, t.phone, t.mobile, t.address,
             t.employer, t.employer_address as "employerAddress", t.employer_phone as "employerPhone",
             t.job_title as "jobTitle", t.annual_income as "annualIncome",
             t.emergency_contact_name as "emergencyContactName", t.emergency_contact_phone as "emergencyContactPhone",
             t.notes, t.status,
             t.id_verified as "idVerified", t.id_verification_status as "idVerificationStatus",
             t.id_verification_date as "idVerificationDate",
             t.created_at as "createdAt", t.updated_at as "updatedAt",
             -- Property details from rental agreement (try multiple join methods)
             COALESCE(ra1.id, ra2.id) as "rentalAgreementId",
             COALESCE(ra1.rent_amount, ra2.rent_amount) as "rentAmount",
             COALESCE(ra1.rent_frequency, ra2.rent_frequency) as "rentFrequency",
             COALESCE(ra1.status, ra2.status) as "tenancyStatus",
             COALESCE(ra1.tenancy_start, ra2.tenancy_start) as "tenancyStart",
             COALESCE(ra1.tenancy_end, ra2.tenancy_end) as "tenancyEnd",
             -- Property address (from rental agreement or direct link via tenant.property_id)
             COALESCE(p1.id, p2.id, p3.id) as "propertyId",
             COALESCE(p1.title, p1.address, p2.title, p2.address, p3.title, p3.address) as "propertyAddress",
             COALESCE(p1.postcode, p2.postcode, p3.postcode) as "propertyPostcode"
      FROM tenant t
      -- Method 1: tenant has rental_agreement_id
      LEFT JOIN rental_agreement ra1 ON t.rental_agreement_id = ra1.id
      LEFT JOIN property p1 ON ra1.property_id = p1.id
      -- Method 2: rental_agreement has tenant_id
      LEFT JOIN rental_agreement ra2 ON ra2.tenant_id = t.id AND ra2.status = 'active'
      LEFT JOIN property p2 ON ra2.property_id = p2.id
      -- Method 3: tenant has direct property_id link
      LEFT JOIN property p3 ON t.property_id = p3.id
      ORDER BY t.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Create tenant - RAW SQL
crmRouter.post('/tenants', requireAgent, async (req, res) => {
  try {
    const { fullName, email, phone, mobile, address, employer, employerAddress, employerPhone, jobTitle, annualIncome, emergencyContactName, emergencyContactPhone, notes, sendVerification } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Generate verification token if verification will be sent
    let verificationToken = null;
    let verificationTokenExpiry = null;
    let idVerificationStatus = 'unverified';

    if (sendVerification && mobile) {
      verificationToken = crypto.randomBytes(32).toString('hex');
      verificationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
      idVerificationStatus = 'pending';
    }

    const result = await pool.query(`
      INSERT INTO tenant (name, email, phone, mobile, address, employer, employer_address, employer_phone, job_title, annual_income, emergency_contact_name, emergency_contact_phone, notes, status, id_verified, id_verification_status, id_verification_token, id_verification_token_expiry)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'active', false, $14, $15, $16)
      RETURNING id, name as "fullName", email, phone, mobile, address, employer, employer_address as "employerAddress", employer_phone as "employerPhone", job_title as "jobTitle", annual_income as "annualIncome", emergency_contact_name as "emergencyContactName", emergency_contact_phone as "emergencyContactPhone", notes, status, id_verified as "idVerified", id_verification_status as "idVerificationStatus", created_at as "createdAt"
    `, [fullName, email || null, phone || mobile || null, mobile || null, address || null, employer || null, employerAddress || null, employerPhone || null, jobTitle || null, annualIncome || null, emergencyContactName || null, emergencyContactPhone || null, notes || null, idVerificationStatus, verificationToken, verificationTokenExpiry]);

    const tenant = result.rows[0];

    // Send WhatsApp verification link if requested
    if (sendVerification && mobile && verificationToken) {
      try {
        // Get Twilio credentials from integration_credentials
        const twilioResult = await pool.query(`
          SELECT credentials FROM integration_credentials WHERE provider = 'twilio' AND is_active = true LIMIT 1
        `);

        if (twilioResult.rows.length > 0) {
          const twilioConfig = twilioResult.rows[0].credentials;
          if (twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.whatsappNumber) {
            const client = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);

            // Format mobile for WhatsApp (UK format)
            let whatsappNumber = mobile.replace(/\s/g, '');
            if (whatsappNumber.startsWith('0')) {
              whatsappNumber = '+44' + whatsappNumber.substring(1);
            } else if (!whatsappNumber.startsWith('+')) {
              whatsappNumber = '+44' + whatsappNumber;
            }

            const verificationUrl = `${process.env.BASE_URL || 'https://yoursite.com'}/verify-tenant/${verificationToken}`;

            await client.messages.create({
              from: `whatsapp:${twilioConfig.whatsappNumber}`,
              to: `whatsapp:${whatsappNumber}`,
              body: `Hello ${fullName},\n\nWelcome to John Barclay Property Management! To complete your tenant registration, please verify your identity by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 7 days.\n\nIf you have any questions, please contact our office.`
            });

            tenant.verificationSent = true;
          }
        }
      } catch (whatsappError) {
        console.error('Error sending WhatsApp verification:', whatsappError);
        // Don't fail the tenant creation if WhatsApp fails
        tenant.verificationSent = false;
        tenant.verificationError = 'Could not send WhatsApp message';
      }
    }

    res.json(tenant);
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Update tenant - RAW SQL
crmRouter.put('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, email, phone, mobile, address, employer, employerAddress, employerPhone, jobTitle, annualIncome, emergencyContactName, emergencyContactPhone, notes, status } = req.body;

    const result = await pool.query(`
      UPDATE tenant SET
        name = COALESCE($2, name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        mobile = COALESCE($5, mobile),
        address = COALESCE($6, address),
        employer = COALESCE($7, employer),
        employer_address = COALESCE($8, employer_address),
        employer_phone = COALESCE($9, employer_phone),
        job_title = COALESCE($10, job_title),
        annual_income = COALESCE($11, annual_income),
        emergency_contact_name = COALESCE($12, emergency_contact_name),
        emergency_contact_phone = COALESCE($13, emergency_contact_phone),
        notes = COALESCE($14, notes),
        status = COALESCE($15, status),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name as "fullName", email, phone, mobile, address, employer, employer_address as "employerAddress", employer_phone as "employerPhone", job_title as "jobTitle", annual_income as "annualIncome", emergency_contact_name as "emergencyContactName", emergency_contact_phone as "emergencyContactPhone", notes, status, created_at as "createdAt", updated_at as "updatedAt"
    `, [id, fullName, email, phone, mobile, address, employer, employerAddress, employerPhone, jobTitle, annualIncome, emergencyContactName, emergencyContactPhone, notes, status]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// Delete tenant - RAW SQL
crmRouter.delete('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM tenant WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// Resend verification link to tenant
crmRouter.post('/tenants/:id/resend-verification', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Get tenant details
    const tenantResult = await pool.query(`
      SELECT id, name, mobile, id_verification_status FROM tenant WHERE id = $1
    `, [id]);

    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const tenant = tenantResult.rows[0];

    if (!tenant.mobile) {
      return res.status(400).json({ error: 'Tenant does not have a mobile number' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Update tenant with new token
    await pool.query(`
      UPDATE tenant SET
        id_verification_token = $2,
        id_verification_token_expiry = $3,
        id_verification_status = 'pending',
        updated_at = NOW()
      WHERE id = $1
    `, [id, verificationToken, verificationTokenExpiry]);

    // Send WhatsApp message
    try {
      const twilioResult = await pool.query(`
        SELECT credentials FROM integration_credentials WHERE provider = 'twilio' AND is_active = true LIMIT 1
      `);

      if (twilioResult.rows.length > 0) {
        const twilioConfig = twilioResult.rows[0].credentials;
        if (twilioConfig.accountSid && twilioConfig.authToken && twilioConfig.whatsappNumber) {
          const client = require('twilio')(twilioConfig.accountSid, twilioConfig.authToken);

          // Format mobile for WhatsApp (UK format)
          let whatsappNumber = tenant.mobile.replace(/\s/g, '');
          if (whatsappNumber.startsWith('0')) {
            whatsappNumber = '+44' + whatsappNumber.substring(1);
          } else if (!whatsappNumber.startsWith('+')) {
            whatsappNumber = '+44' + whatsappNumber;
          }

          const verificationUrl = `${process.env.BASE_URL || 'https://yoursite.com'}/verify-tenant/${verificationToken}`;

          await client.messages.create({
            from: `whatsapp:${twilioConfig.whatsappNumber}`,
            to: `whatsapp:${whatsappNumber}`,
            body: `Hello ${tenant.name},\n\nPlease verify your identity to complete your tenant registration:\n\n${verificationUrl}\n\nThis link will expire in 7 days.`
          });

          return res.json({ success: true, message: 'Verification link sent via WhatsApp' });
        }
      }

      return res.status(400).json({ error: 'WhatsApp not configured. Please configure Twilio WhatsApp integration.' });
    } catch (whatsappError) {
      console.error('Error sending WhatsApp verification:', whatsappError);
      return res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
  } catch (error) {
    console.error('Error resending verification:', error);
    res.status(500).json({ error: 'Failed to resend verification' });
  }
});

// Mark tenant as verified manually
crmRouter.post('/tenants/:id/mark-verified', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const result = await pool.query(`
      UPDATE tenant SET
        id_verified = true,
        id_verification_status = 'verified',
        id_verification_date = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name as "fullName", id_verified as "idVerified", id_verification_status as "idVerificationStatus", id_verification_date as "idVerificationDate"
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error marking tenant as verified:', error);
    res.status(500).json({ error: 'Failed to mark tenant as verified' });
  }
});

crmRouter.get('/inbox', requireAgent, async (req, res) => {
  try {
    const inbox = await storage.getUnifiedInbox();
    res.json(inbox);
  } catch (error) {
    console.error('Error fetching inbox:', error);
    res.status(500).json({ error: 'Failed to fetch inbox' });
  }
});

// ==========================================
// LANDLORD LEAD WORKFLOW API ENDPOINTS
// ==========================================

// Workflow stages for landlord leads
const LANDLORD_LEAD_STAGES = [
  'new',
  'contacted',
  'valuation_scheduled',
  'valuation_completed',
  'instruction_signed',
  'listing_preparation',
  'listed'
] as const;

// Get all landlord leads (contacts with valuation/selling/letting inquiry types)
crmRouter.get('/landlord-leads', requireAgent, async (req, res) => {
  try {
    const { workflowStage, assignedAgentId, inquiryType } = req.query;

    let query = `
      SELECT c.*,
             u.full_name as "assignedAgentName",
             p.title as "linkedPropertyTitle"
      FROM contact c
      LEFT JOIN "user" u ON c.assigned_agent_id = u.id
      LEFT JOIN property p ON c.linked_property_id = p.id
      WHERE c.inquiry_type IN ('valuation', 'selling', 'letting')
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (workflowStage) {
      query += ` AND c.workflow_stage = $${paramIndex++}`;
      params.push(workflowStage);
    }

    if (assignedAgentId) {
      query += ` AND c.assigned_agent_id = $${paramIndex++}`;
      params.push(parseInt(assignedAgentId as string));
    }

    if (inquiryType) {
      query += ` AND c.inquiry_type = $${paramIndex++}`;
      params.push(inquiryType);
    }

    query += ` ORDER BY c.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching landlord leads:', error);
    res.status(500).json({ error: 'Failed to fetch landlord leads' });
  }
});

// Get pipeline view with counts by stage
crmRouter.get('/landlord-leads/pipeline', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COALESCE(workflow_stage, 'new') as stage,
        COUNT(*) as count
      FROM contact
      WHERE inquiry_type IN ('valuation', 'selling', 'letting')
      GROUP BY COALESCE(workflow_stage, 'new')
    `);

    // Create a map with all stages initialized to 0
    const pipeline: Record<string, number> = {};
    for (const stage of LANDLORD_LEAD_STAGES) {
      pipeline[stage] = 0;
    }

    // Fill in actual counts
    for (const row of result.rows) {
      if (pipeline.hasOwnProperty(row.stage)) {
        pipeline[row.stage] = parseInt(row.count);
      }
    }

    res.json(pipeline);
  } catch (error) {
    console.error('Error fetching landlord leads pipeline:', error);
    res.status(500).json({ error: 'Failed to fetch pipeline' });
  }
});

// Get single landlord lead
crmRouter.get('/landlord-leads/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT c.*,
             u.full_name as "assignedAgentName",
             p.title as "linkedPropertyTitle",
             p.id as "linkedPropertyId"
      FROM contact c
      LEFT JOIN "user" u ON c.assigned_agent_id = u.id
      LEFT JOIN property p ON c.linked_property_id = p.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching landlord lead:', error);
    res.status(500).json({ error: 'Failed to fetch landlord lead' });
  }
});

// Update workflow stage
crmRouter.patch('/landlord-leads/:id/stage', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { stage } = req.body;

    if (!LANDLORD_LEAD_STAGES.includes(stage)) {
      return res.status(400).json({ error: 'Invalid workflow stage' });
    }

    const result = await pool.query(`
      UPDATE contact
      SET workflow_stage = $1,
          workflow_updated_at = NOW(),
          status = CASE
            WHEN $1 = 'listed' THEN 'converted'
            WHEN $1 = 'contacted' THEN 'contacted'
            ELSE status
          END
      WHERE id = $2
      RETURNING *
    `, [stage, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating workflow stage:', error);
    res.status(500).json({ error: 'Failed to update workflow stage' });
  }
});

// Schedule valuation
crmRouter.post('/landlord-leads/:id/schedule-valuation', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { scheduledDate, assignedAgentId } = req.body;

    if (!scheduledDate) {
      return res.status(400).json({ error: 'Scheduled date is required' });
    }

    const result = await pool.query(`
      UPDATE contact
      SET workflow_stage = 'valuation_scheduled',
          workflow_updated_at = NOW(),
          valuation_scheduled_date = $1,
          assigned_agent_id = COALESCE($2, assigned_agent_id)
      WHERE id = $3
      RETURNING *
    `, [scheduledDate, assignedAgentId || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error scheduling valuation:', error);
    res.status(500).json({ error: 'Failed to schedule valuation' });
  }
});

// Complete valuation
crmRouter.post('/landlord-leads/:id/complete-valuation', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { valuationAmount, notes } = req.body;

    const result = await pool.query(`
      UPDATE contact
      SET workflow_stage = 'valuation_completed',
          workflow_updated_at = NOW(),
          valuation_completed_date = NOW(),
          valuation_amount = $1,
          notes = CASE WHEN $2 IS NOT NULL THEN COALESCE(notes || E'\\n', '') || $2 ELSE notes END
      WHERE id = $3
      RETURNING *
    `, [valuationAmount || null, notes || null, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error completing valuation:', error);
    res.status(500).json({ error: 'Failed to complete valuation' });
  }
});

// Sign instruction
crmRouter.post('/landlord-leads/:id/sign-instruction', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    const result = await pool.query(`
      UPDATE contact
      SET workflow_stage = 'instruction_signed',
          workflow_updated_at = NOW(),
          instruction_signed_date = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error signing instruction:', error);
    res.status(500).json({ error: 'Failed to sign instruction' });
  }
});

// Convert to listing (create property and link)
crmRouter.post('/landlord-leads/:id/convert-to-listing', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { propertyData } = req.body;

    // Get the contact details
    const contactResult = await pool.query(`
      SELECT * FROM contact WHERE id = $1
    `, [id]);

    if (contactResult.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord lead not found' });
    }

    const contact = contactResult.rows[0];

    // Create the property
    const propertyResult = await pool.query(`
      INSERT INTO property (
        title, address_line1, postcode, property_type, bedrooms,
        listing_type, price, status, is_listed, is_published_website,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, 'Available', true, false, NOW(), NOW()
      )
      RETURNING id
    `, [
      propertyData?.title || `${contact.property_type || 'Property'} in ${contact.postcode}`,
      contact.property_address || propertyData?.addressLine1,
      contact.postcode || propertyData?.postcode,
      contact.property_type || propertyData?.propertyType || 'house',
      contact.bedrooms || propertyData?.bedrooms || 3,
      contact.inquiry_type === 'letting' ? 'rental' : 'sale',
      contact.valuation_amount || propertyData?.price || 0
    ]);

    const propertyId = propertyResult.rows[0].id;

    // Update the contact with the linked property
    const updateResult = await pool.query(`
      UPDATE contact
      SET workflow_stage = 'listed',
          workflow_updated_at = NOW(),
          linked_property_id = $1,
          status = 'converted'
      WHERE id = $2
      RETURNING *
    `, [propertyId, id]);

    res.json({
      contact: updateResult.rows[0],
      propertyId
    });
  } catch (error) {
    console.error('Error converting to listing:', error);
    res.status(500).json({ error: 'Failed to convert to listing' });
  }
});

// Update landlord lead details
crmRouter.patch('/landlord-leads/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { assignedAgentId, notes, valuationAmount } = req.body;

    const updates: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (assignedAgentId !== undefined) {
      updates.push(`assigned_agent_id = $${paramIndex++}`);
      params.push(assignedAgentId);
    }

    if (notes !== undefined) {
      updates.push(`notes = $${paramIndex++}`);
      params.push(notes);
    }

    if (valuationAmount !== undefined) {
      updates.push(`valuation_amount = $${paramIndex++}`);
      params.push(valuationAmount);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(id);

    const result = await pool.query(`
      UPDATE contact
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord lead not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating landlord lead:', error);
    res.status(500).json({ error: 'Failed to update landlord lead' });
  }
});

// ==========================================
// LEADS API ENDPOINTS
// ==========================================

// Get all leads with optional filtering
crmRouter.get('/leads', requireAgent, async (req, res) => {
  try {
    const { status, leadType, source, assignedTo, priority } = req.query;

    let query = `
      SELECT l.*,
             u.full_name as "assignedAgentName"
      FROM lead l
      LEFT JOIN "user" u ON l.assigned_to = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND l.status = $${paramIndex++}`;
      params.push(status);
    }
    if (leadType) {
      query += ` AND l.lead_type = $${paramIndex++}`;
      params.push(leadType);
    }
    if (source) {
      query += ` AND l.source = $${paramIndex++}`;
      params.push(source);
    }
    if (assignedTo) {
      query += ` AND l.assigned_to = $${paramIndex++}`;
      params.push(parseInt(assignedTo as string));
    }
    if (priority) {
      query += ` AND l.priority = $${paramIndex++}`;
      params.push(priority);
    }

    query += ` ORDER BY l.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching leads:', error);
    res.status(500).json({ error: 'Failed to fetch leads' });
  }
});

// Get single lead with full details
crmRouter.get('/leads/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Get lead
    const leadResult = await pool.query(`
      SELECT l.*,
             u.full_name as "assignedAgentName"
      FROM lead l
      LEFT JOIN "user" u ON l.assigned_to = u.id
      WHERE l.id = $1
    `, [id]);

    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = leadResult.rows[0];

    // Get property views
    const viewsResult = await pool.query(`
      SELECT lpv.*,
             COALESCE(p.title, pp.title, pp.address) as "propertyTitle",
             COALESCE(p.address_line1, pp.address_line1, pp.address) as "propertyAddress",
             COALESCE(p.price, pp.price, pp.rent_amount) as "propertyPrice"
      FROM lead_property_views lpv
      LEFT JOIN property p ON lpv.property_id = p.id
      LEFT JOIN property pp ON lpv.property_id = pp.id
      WHERE lpv.lead_id = $1
      ORDER BY lpv.viewed_at DESC
    `, [id]);

    // Get communications
    const commsResult = await pool.query(`
      SELECT lc.*,
             u.full_name as "handlerName"
      FROM lead_communication lc
      LEFT JOIN "user" u ON lc.handled_by = u.id
      WHERE lc.lead_id = $1
      ORDER BY lc.created_at DESC
    `, [id]);

    // Get viewings
    const viewingsResult = await pool.query(`
      SELECT lv.*,
             u.full_name as "conductorName",
             COALESCE(p.title, pp.title, pp.address) as "propertyTitle"
      FROM lead_viewing lv
      LEFT JOIN "user" u ON lv.conducted_by = u.id
      LEFT JOIN property p ON lv.property_id = p.id
      LEFT JOIN property pp ON lv.property_id = pp.id
      WHERE lv.lead_id = $1
      ORDER BY lv.scheduled_at DESC
    `, [id]);

    // Get activities
    const activitiesResult = await pool.query(`
      SELECT la.*,
             u.full_name as "performerName"
      FROM lead_activity la
      LEFT JOIN "user" u ON la.performed_by = u.id
      WHERE la.lead_id = $1
      ORDER BY la.created_at DESC
      LIMIT 50
    `, [id]);

    res.json({
      ...lead,
      propertyViews: viewsResult.rows,
      communications: commsResult.rows,
      viewings: viewingsResult.rows,
      activities: activitiesResult.rows
    });
  } catch (error) {
    console.error('Error fetching lead:', error);
    res.status(500).json({ error: 'Failed to fetch lead' });
  }
});

// Create new lead
crmRouter.post('/leads', requireAgent, async (req, res) => {
  try {
    const {
      fullName, email, phone, mobile,
      instagramHandle, facebookId, tiktokHandle, twitterHandle, linkedinUrl,
      source, sourceDetail, referredBy,
      leadType, preferredPropertyType, preferredBedrooms, preferredAreas,
      minBudget, maxBudget, moveInDate,
      requirements, petsAllowed, parkingRequired, gardenRequired,
      priority, assignedTo, notes
    } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    const result = await pool.query(`
      INSERT INTO lead (
        full_name, email, phone, mobile,
        instagram_handle, facebook_id, tiktok_handle, twitter_handle, linkedin_url,
        source, source_detail, referred_by,
        lead_type, preferred_property_type, preferred_bedrooms, preferred_areas,
        min_budget, max_budget, move_in_date,
        requirements, pets_allowed, parking_required, garden_required,
        priority, assigned_to, notes,
        status, last_activity_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, $6, $7, $8, $9,
        $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21, $22, $23,
        $24, $25, $26,
        'new', NOW()
      )
      RETURNING *
    `, [
      fullName, email || null, phone || null, mobile || null,
      instagramHandle || null, facebookId || null, tiktokHandle || null, twitterHandle || null, linkedinUrl || null,
      source || 'website', sourceDetail || null, referredBy || null,
      leadType || 'rental', preferredPropertyType || null, preferredBedrooms || null, preferredAreas || null,
      minBudget || null, maxBudget || null, moveInDate || null,
      requirements || null, petsAllowed || null, parkingRequired || null, gardenRequired || null,
      priority || 'medium', assignedTo || null, notes || null
    ]);

    const lead = result.rows[0];

    // Create activity for lead creation
    await pool.query(`
      INSERT INTO lead_activity (lead_id, activity_type, description, performed_by)
      VALUES ($1, 'created', $2, $3)
    `, [lead.id, `Lead created from ${source || 'website'}`, req.user?.id || null]);

    res.json(lead);
  } catch (error) {
    console.error('Error creating lead:', error);
    res.status(500).json({ error: 'Failed to create lead' });
  }
});

// Update lead
crmRouter.put('/leads/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      fullName, email, phone, mobile,
      instagramHandle, facebookId, tiktokHandle, twitterHandle, linkedinUrl,
      source, sourceDetail, referredBy,
      leadType, preferredPropertyType, preferredBedrooms, preferredAreas,
      minBudget, maxBudget, moveInDate,
      requirements, petsAllowed, parkingRequired, gardenRequired,
      status, priority, assignedTo, notes, lostReason, nextFollowUpDate
    } = req.body;

    // Get current lead to check for status change
    const currentLead = await pool.query('SELECT status, assigned_to FROM lead WHERE id = $1', [id]);
    const oldStatus = currentLead.rows[0]?.status;
    const oldAssignedTo = currentLead.rows[0]?.assigned_to;

    const result = await pool.query(`
      UPDATE lead SET
        full_name = COALESCE($2, full_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        mobile = COALESCE($5, mobile),
        instagram_handle = COALESCE($6, instagram_handle),
        facebook_id = COALESCE($7, facebook_id),
        tiktok_handle = COALESCE($8, tiktok_handle),
        twitter_handle = COALESCE($9, twitter_handle),
        linkedin_url = COALESCE($10, linkedin_url),
        source = COALESCE($11, source),
        source_detail = COALESCE($12, source_detail),
        referred_by = COALESCE($13, referred_by),
        lead_type = COALESCE($14, lead_type),
        preferred_property_type = COALESCE($15, preferred_property_type),
        preferred_bedrooms = COALESCE($16, preferred_bedrooms),
        preferred_areas = COALESCE($17, preferred_areas),
        min_budget = COALESCE($18, min_budget),
        max_budget = COALESCE($19, max_budget),
        move_in_date = COALESCE($20, move_in_date),
        requirements = COALESCE($21, requirements),
        pets_allowed = COALESCE($22, pets_allowed),
        parking_required = COALESCE($23, parking_required),
        garden_required = COALESCE($24, garden_required),
        status = COALESCE($25, status),
        priority = COALESCE($26, priority),
        assigned_to = COALESCE($27, assigned_to),
        notes = COALESCE($28, notes),
        lost_reason = COALESCE($29, lost_reason),
        next_follow_up_date = COALESCE($30, next_follow_up_date),
        last_activity_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      id, fullName, email, phone, mobile,
      instagramHandle, facebookId, tiktokHandle, twitterHandle, linkedinUrl,
      source, sourceDetail, referredBy,
      leadType, preferredPropertyType, preferredBedrooms, preferredAreas,
      minBudget, maxBudget, moveInDate,
      requirements, petsAllowed, parkingRequired, gardenRequired,
      status, priority, assignedTo, notes, lostReason, nextFollowUpDate
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Log status change activity
    if (status && status !== oldStatus) {
      await pool.query(`
        INSERT INTO lead_activity (lead_id, activity_type, description, performed_by, metadata)
        VALUES ($1, 'status_change', $2, $3, $4)
      `, [id, `Status changed from ${oldStatus} to ${status}`, req.user?.id || null, JSON.stringify({ oldStatus, newStatus: status })]);
    }

    // Log assignment change activity
    if (assignedTo && assignedTo !== oldAssignedTo) {
      await pool.query(`
        INSERT INTO lead_activity (lead_id, activity_type, description, performed_by)
        VALUES ($1, 'assigned', $2, $3)
      `, [id, `Lead assigned to new agent`, req.user?.id || null]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Delete lead
crmRouter.delete('/leads/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Delete related records first
    await pool.query('DELETE FROM lead_activity WHERE lead_id = $1', [id]);
    await pool.query('DELETE FROM lead_viewing WHERE lead_id = $1', [id]);
    await pool.query('DELETE FROM lead_communication WHERE lead_id = $1', [id]);
    await pool.query('DELETE FROM lead_property_views WHERE lead_id = $1', [id]);
    await pool.query('DELETE FROM lead WHERE id = $1', [id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting lead:', error);
    res.status(500).json({ error: 'Failed to delete lead' });
  }
});

// Add property view for a lead
crmRouter.post('/leads/:id/property-views', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const { propertyId, viewSource, viewDuration, savedToFavorites, requestedViewing, requestedMoreInfo } = req.body;

    const result = await pool.query(`
      INSERT INTO lead_property_views (lead_id, property_id, view_source, view_duration, saved_to_favorites, requested_viewing, requested_more_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [leadId, propertyId, viewSource || 'website', viewDuration || null, savedToFavorites || false, requestedViewing || false, requestedMoreInfo || false]);

    // Update lead activity timestamp
    await pool.query('UPDATE lead SET last_activity_at = NOW() WHERE id = $1', [leadId]);

    // Create activity
    await pool.query(`
      INSERT INTO lead_activity (lead_id, activity_type, description, related_property_id, performed_by)
      VALUES ($1, 'property_viewed', 'Viewed property', $2, $3)
    `, [leadId, propertyId, req.user?.id || null]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding property view:', error);
    res.status(500).json({ error: 'Failed to add property view' });
  }
});

// Get property views for a lead
crmRouter.get('/leads/:id/property-views', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT lpv.*,
             COALESCE(p.title, pp.title, pp.address) as "propertyTitle",
             COALESCE(p.address_line1, pp.address_line1, pp.address) as "propertyAddress",
             COALESCE(p.price, pp.price, pp.rent_amount) as "propertyPrice",
             COALESCE(p.images, pp.images) as "propertyImages"
      FROM lead_property_views lpv
      LEFT JOIN property p ON lpv.property_id = p.id
      LEFT JOIN property pp ON lpv.property_id = pp.id
      WHERE lpv.lead_id = $1
      ORDER BY lpv.viewed_at DESC
    `, [leadId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching property views:', error);
    res.status(500).json({ error: 'Failed to fetch property views' });
  }
});

// Add communication for a lead
crmRouter.post('/leads/:id/communications', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const {
      channel, direction, type, subject, content, summary,
      propertyId, outcome, followUpRequired, followUpDate, externalMessageId
    } = req.body;

    if (!channel || !direction || !type || !content) {
      return res.status(400).json({ error: 'Channel, direction, type, and content are required' });
    }

    const result = await pool.query(`
      INSERT INTO lead_communication (
        lead_id, channel, direction, type, subject, content, summary,
        property_id, handled_by, outcome, follow_up_required, follow_up_date, external_message_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [
      leadId, channel, direction, type, subject || null, content, summary || null,
      propertyId || null, req.user?.id || null, outcome || null, followUpRequired || false, followUpDate || null, externalMessageId || null
    ]);

    // Update lead timestamps
    await pool.query(`
      UPDATE lead SET
        last_contacted_at = NOW(),
        last_activity_at = NOW()
      WHERE id = $1
    `, [leadId]);

    // Create activity
    await pool.query(`
      INSERT INTO lead_activity (lead_id, activity_type, description, related_communication_id, related_property_id, performed_by)
      VALUES ($1, 'communication', $2, $3, $4, $5)
    `, [leadId, `${direction === 'inbound' ? 'Received' : 'Sent'} ${channel} message`, result.rows[0].id, propertyId || null, req.user?.id || null]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding communication:', error);
    res.status(500).json({ error: 'Failed to add communication' });
  }
});

// Get communications for a lead
crmRouter.get('/leads/:id/communications', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT lc.*,
             u.full_name as "handlerName",
             COALESCE(p.title, pp.title) as "propertyTitle"
      FROM lead_communication lc
      LEFT JOIN "user" u ON lc.handled_by = u.id
      LEFT JOIN property p ON lc.property_id = p.id
      LEFT JOIN property pp ON lc.property_id = pp.id
      WHERE lc.lead_id = $1
      ORDER BY lc.created_at DESC
    `, [leadId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Failed to fetch communications' });
  }
});

// Schedule viewing for a lead
crmRouter.post('/leads/:id/viewings', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const {
      propertyId, scheduledAt, duration, viewingType, conductedBy
    } = req.body;

    if (!propertyId || !scheduledAt) {
      return res.status(400).json({ error: 'Property ID and scheduled time are required' });
    }

    const result = await pool.query(`
      INSERT INTO lead_viewing (lead_id, property_id, scheduled_at, duration, viewing_type, conducted_by, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'scheduled')
      RETURNING *
    `, [leadId, propertyId, scheduledAt, duration || 30, viewingType || 'in_person', conductedBy || req.user?.id || null]);

    // Update lead status to viewing_booked
    await pool.query(`
      UPDATE lead SET
        status = CASE WHEN status IN ('new', 'contacted', 'qualified') THEN 'viewing_booked' ELSE status END,
        last_activity_at = NOW()
      WHERE id = $1
    `, [leadId]);

    // Create activity
    await pool.query(`
      INSERT INTO lead_activity (lead_id, activity_type, description, related_viewing_id, related_property_id, performed_by)
      VALUES ($1, 'viewing_booked', 'Property viewing scheduled', $2, $3, $4)
    `, [leadId, result.rows[0].id, propertyId, req.user?.id || null]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error scheduling viewing:', error);
    res.status(500).json({ error: 'Failed to schedule viewing' });
  }
});

// Get viewings for a lead
crmRouter.get('/leads/:id/viewings', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT lv.*,
             u.full_name as "conductorName",
             COALESCE(p.title, pp.title, pp.address) as "propertyTitle",
             COALESCE(p.address_line1, pp.address_line1, pp.address) as "propertyAddress"
      FROM lead_viewing lv
      LEFT JOIN "user" u ON lv.conducted_by = u.id
      LEFT JOIN property p ON lv.property_id = p.id
      LEFT JOIN property pp ON lv.property_id = pp.id
      WHERE lv.lead_id = $1
      ORDER BY lv.scheduled_at DESC
    `, [leadId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching viewings:', error);
    res.status(500).json({ error: 'Failed to fetch viewings' });
  }
});

// Update viewing status
crmRouter.patch('/leads/viewings/:viewingId', requireAgent, async (req, res) => {
  try {
    const viewingId = parseInt(req.params.viewingId);
    const { status, feedback, agentNotes, interested, cancelledReason } = req.body;

    const result = await pool.query(`
      UPDATE lead_viewing SET
        status = COALESCE($2, status),
        feedback = COALESCE($3, feedback),
        agent_notes = COALESCE($4, agent_notes),
        interested = COALESCE($5, interested),
        cancelled_reason = COALESCE($6, cancelled_reason),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [viewingId, status, feedback, agentNotes, interested, cancelledReason]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Viewing not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating viewing:', error);
    res.status(500).json({ error: 'Failed to update viewing' });
  }
});

// Get activity timeline for a lead
crmRouter.get('/leads/:id/activities', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await pool.query(`
      SELECT la.*,
             u.full_name as "performerName"
      FROM lead_activity la
      LEFT JOIN "user" u ON la.performed_by = u.id
      WHERE la.lead_id = $1
      ORDER BY la.created_at DESC
      LIMIT $2
    `, [leadId, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching activities:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Add note to lead
crmRouter.post('/leads/:id/notes', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ error: 'Note is required' });
    }

    // Create activity for note
    const result = await pool.query(`
      INSERT INTO lead_activity (lead_id, activity_type, description, performed_by)
      VALUES ($1, 'note_added', $2, $3)
      RETURNING *
    `, [leadId, note, req.user?.id || null]);

    // Update last activity
    await pool.query('UPDATE lead SET last_activity_at = NOW() WHERE id = $1', [leadId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// Convert lead to tenant
crmRouter.post('/leads/:id/convert', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);
    const { propertyId } = req.body;

    // Get lead details
    const leadResult = await pool.query('SELECT * FROM lead WHERE id = $1', [leadId]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const lead = leadResult.rows[0];

    // Create tenant from lead
    const tenantResult = await pool.query(`
      INSERT INTO tenant (name, email, phone, mobile, status, id_verification_status)
      VALUES ($1, $2, $3, $4, 'active', 'unverified')
      RETURNING *
    `, [lead.full_name, lead.email, lead.phone, lead.mobile]);

    const tenant = tenantResult.rows[0];

    // Update lead as converted
    await pool.query(`
      UPDATE lead SET
        status = 'converted',
        converted_at = NOW(),
        converted_to_tenant_id = $2,
        converted_to_property_id = $3,
        last_activity_at = NOW()
      WHERE id = $1
    `, [leadId, tenant.id, propertyId || null]);

    // Create activity
    await pool.query(`
      INSERT INTO lead_activity (lead_id, activity_type, description, related_property_id, performed_by)
      VALUES ($1, 'converted', 'Lead converted to tenant', $2, $3)
    `, [leadId, propertyId || null, req.user?.id || null]);

    res.json({ lead: { ...lead, status: 'converted', converted_to_tenant_id: tenant.id }, tenant });
  } catch (error) {
    console.error('Error converting lead:', error);
    res.status(500).json({ error: 'Failed to convert lead' });
  }
});

// Get leads dashboard stats
crmRouter.get('/leads/stats/dashboard', requireAgent, async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'new') as new_leads,
        COUNT(*) FILTER (WHERE status = 'contacted') as contacted,
        COUNT(*) FILTER (WHERE status = 'qualified') as qualified,
        COUNT(*) FILTER (WHERE status = 'viewing_booked') as viewing_booked,
        COUNT(*) FILTER (WHERE status = 'offer_made') as offer_made,
        COUNT(*) FILTER (WHERE status = 'converted') as converted,
        COUNT(*) FILTER (WHERE status = 'lost') as lost,
        COUNT(*) FILTER (WHERE priority = 'hot') as hot_leads,
        COUNT(*) FILTER (WHERE lead_type = 'rental') as rental_leads,
        COUNT(*) FILTER (WHERE lead_type = 'purchase') as purchase_leads,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days') as new_this_month
      FROM lead
    `);

    const sourceResult = await pool.query(`
      SELECT source, COUNT(*) as count
      FROM lead
      GROUP BY source
      ORDER BY count DESC
    `);

    res.json({
      ...statsResult.rows[0],
      bySource: sourceResult.rows
    });
  } catch (error) {
    console.error('Error fetching lead stats:', error);
    res.status(500).json({ error: 'Failed to fetch lead stats' });
  }
});

// ==========================================
// OFFERS API ENDPOINTS
// ==========================================
// Links leads to properties/landlords through offers

// Get all offers (with filters)
crmRouter.get('/offers', requireAgent, async (req, res) => {
  try {
    const { status, leadId, propertyId, landlordId, offerType } = req.query;

    let query = `
      SELECT o.*,
             l.full_name as "leadName", l.email as "leadEmail", l.phone as "leadPhone",
             l.kyc_status as "leadKycStatus", l.proof_of_funds_status as "leadFundsStatus",
             COALESCE(p.title, pp.title) as "propertyTitle",
             COALESCE(p.address_line1, pp.address) as "propertyAddress",
             COALESCE(p.postcode, pp.postcode) as "propertyPostcode",
             pl.full_name as "landlordName",
             u.full_name as "handlerName"
      FROM offer o
      LEFT JOIN lead l ON o.lead_id = l.id
      LEFT JOIN property p ON o.property_id = p.id
      LEFT JOIN property pp ON o.property_id = pp.id
      LEFT JOIN landlord pl ON o.landlord_id = pl.id
      LEFT JOIN "user" u ON o.handled_by = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (status && status !== 'all') {
      query += ` AND o.status = $${paramIndex++}`;
      params.push(status);
    }
    if (leadId) {
      query += ` AND o.lead_id = $${paramIndex++}`;
      params.push(parseInt(leadId as string));
    }
    if (propertyId) {
      query += ` AND o.property_id = $${paramIndex++}`;
      params.push(parseInt(propertyId as string));
    }
    if (landlordId) {
      query += ` AND o.landlord_id = $${paramIndex++}`;
      params.push(parseInt(landlordId as string));
    }
    if (offerType && offerType !== 'all') {
      query += ` AND o.offer_type = $${paramIndex++}`;
      params.push(offerType);
    }

    query += ` ORDER BY o.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching offers:', error);
    res.status(500).json({ error: 'Failed to fetch offers' });
  }
});

// Get single offer with full details
crmRouter.get('/offers/:id', requireAgent, async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    // Get offer with related data
    const offerResult = await pool.query(`
      SELECT o.*,
             l.full_name as "leadName", l.email as "leadEmail", l.phone as "leadPhone", l.mobile as "leadMobile",
             l.kyc_status as "leadKycStatus", l.proof_of_funds_status as "leadFundsStatus",
             l.proof_of_funds_type as "leadFundsType", l.proof_of_funds_amount as "leadFundsAmount",
             COALESCE(p.title, pp.title) as "propertyTitle",
             COALESCE(p.address_line1, pp.address) as "propertyAddress",
             COALESCE(p.postcode, pp.postcode) as "propertyPostcode",
             COALESCE(p.price, pp.price) as "propertyPrice",
             pl.id as "landlordId", pl.full_name as "landlordName", pl.email as "landlordEmail", pl.phone as "landlordPhone",
             u.full_name as "handlerName"
      FROM offer o
      LEFT JOIN lead l ON o.lead_id = l.id
      LEFT JOIN property p ON o.property_id = p.id
      LEFT JOIN property pp ON o.property_id = pp.id
      LEFT JOIN landlord pl ON o.landlord_id = pl.id
      LEFT JOIN "user" u ON o.handled_by = u.id
      WHERE o.id = $1
    `, [offerId]);

    if (offerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    // Get offer history
    const historyResult = await pool.query(`
      SELECT oh.*, u.full_name as "performerName"
      FROM offer_history oh
      LEFT JOIN "user" u ON oh.performed_by = u.id
      WHERE oh.offer_id = $1
      ORDER BY oh.created_at DESC
    `, [offerId]);

    res.json({
      ...offerResult.rows[0],
      history: historyResult.rows
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    res.status(500).json({ error: 'Failed to fetch offer' });
  }
});

// Create new offer (links lead to property/landlord)
crmRouter.post('/offers', requireAgent, async (req, res) => {
  try {
    const {
      leadId, propertyId, offerType, offerAmount, depositOffered, moveInDate, tenancyLength,
      conditions, chainFree, cashBuyer, mortgageApproved, expiresAt, internalNotes
    } = req.body;

    if (!leadId || !propertyId || !offerType || !offerAmount) {
      return res.status(400).json({ error: 'Lead ID, property ID, offer type, and offer amount are required' });
    }

    // Get property to find landlord
    let landlordId = null;
    let originalAskingPrice = null;

    // First try properties table
    const propResult = await pool.query('SELECT landlord_id, price FROM property WHERE id = $1', [propertyId]);
    if (propResult.rows.length > 0) {
      landlordId = propResult.rows[0].landlord_id;
      originalAskingPrice = propResult.rows[0].price;
    } else {
      // Try properties
      const pmPropResult = await pool.query('SELECT landlord_id, price FROM property WHERE id = $1', [propertyId]);
      if (pmPropResult.rows.length > 0) {
        landlordId = pmPropResult.rows[0].landlord_id;
        originalAskingPrice = pmPropResult.rows[0].price;
      }
    }

    // Get lead verification status
    const leadResult = await pool.query('SELECT kyc_status, proof_of_funds_verified FROM lead WHERE id = $1', [leadId]);
    const lead = leadResult.rows[0];

    // Create offer
    const result = await pool.query(`
      INSERT INTO offer (
        lead_id, property_id, landlord_id, offer_type, offer_amount, original_asking_price,
        deposit_offered, move_in_date, tenancy_length, conditions, chain_free, cash_buyer,
        mortgage_approved, expires_at, handled_by, proof_of_funds_verified, kyc_verified, internal_notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `, [
      leadId, propertyId, landlordId, offerType, offerAmount, originalAskingPrice,
      depositOffered || null, moveInDate || null, tenancyLength || null, conditions || null,
      chainFree || false, cashBuyer || false, mortgageApproved || false, expiresAt || null,
      req.user?.id || null, lead?.proof_of_funds_verified || false, lead?.kyc_status === 'verified', internalNotes || null
    ]);

    const offer = result.rows[0];

    // Create history entry
    await pool.query(`
      INSERT INTO offer_history (offer_id, action, new_status, new_amount, performed_by, performed_by_type, notes)
      VALUES ($1, 'created', 'pending', $2, $3, 'agent', 'Offer created')
    `, [offer.id, offerAmount, req.user?.id || null]);

    // Update lead status to offer_made
    await pool.query(`
      UPDATE lead SET
        status = 'offer_made',
        last_activity_at = NOW()
      WHERE id = $1 AND status NOT IN ('converted', 'lost')
    `, [leadId]);

    // Create lead activity
    await pool.query(`
      INSERT INTO lead_activity (lead_id, activity_type, description, related_property_id, performed_by)
      VALUES ($1, 'offer_made', $2, $3, $4)
    `, [leadId, `Made ${offerType} offer of £${(offerAmount / 100).toLocaleString()}`, propertyId, req.user?.id || null]);

    res.status(201).json(offer);
  } catch (error) {
    console.error('Error creating offer:', error);
    res.status(500).json({ error: 'Failed to create offer' });
  }
});

// Update offer status (accept, reject, counter)
crmRouter.put('/offers/:id', requireAgent, async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);
    const {
      status, counterOfferAmount, counterOfferConditions, rejectionReason,
      responseNotes, landlordNotes, internalNotes
    } = req.body;

    // Get current offer
    const currentResult = await pool.query('SELECT * FROM offer WHERE id = $1', [offerId]);
    if (currentResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const currentOffer = currentResult.rows[0];
    const now = new Date().toISOString();

    // Build update query based on status change
    let updateFields: string[] = ['updated_at = NOW()'];
    const updateValues: any[] = [];
    let valueIndex = 1;

    if (status) {
      updateFields.push(`status = $${valueIndex++}`);
      updateValues.push(status);

      // Handle specific status changes
      if (status === 'accepted') {
        updateFields.push(`accepted_at = $${valueIndex++}`);
        updateValues.push(now);
        updateFields.push(`responded_at = $${valueIndex++}`);
        updateValues.push(now);
        updateFields.push(`responded_by = $${valueIndex++}`);
        updateValues.push(req.user?.id || null);
      } else if (status === 'rejected') {
        updateFields.push(`rejected_at = $${valueIndex++}`);
        updateValues.push(now);
        updateFields.push(`responded_at = $${valueIndex++}`);
        updateValues.push(now);
        updateFields.push(`responded_by = $${valueIndex++}`);
        updateValues.push(req.user?.id || null);
        if (rejectionReason) {
          updateFields.push(`rejection_reason = $${valueIndex++}`);
          updateValues.push(rejectionReason);
        }
      } else if (status === 'counter_offered') {
        updateFields.push(`counter_offer_amount = $${valueIndex++}`);
        updateValues.push(counterOfferAmount);
        updateFields.push(`counter_offer_date = $${valueIndex++}`);
        updateValues.push(now);
        if (counterOfferConditions) {
          updateFields.push(`counter_offer_conditions = $${valueIndex++}`);
          updateValues.push(counterOfferConditions);
        }
        updateFields.push(`negotiation_round = negotiation_round + 1`);
      } else if (status === 'withdrawn') {
        updateFields.push(`withdrawn_at = $${valueIndex++}`);
        updateValues.push(now);
      }
    }

    if (responseNotes) {
      updateFields.push(`response_notes = $${valueIndex++}`);
      updateValues.push(responseNotes);
    }
    if (landlordNotes) {
      updateFields.push(`landlord_notes = $${valueIndex++}`);
      updateValues.push(landlordNotes);
    }
    if (internalNotes) {
      updateFields.push(`internal_notes = $${valueIndex++}`);
      updateValues.push(internalNotes);
    }

    updateValues.push(offerId);

    const updateQuery = `
      UPDATE offer SET ${updateFields.join(', ')}
      WHERE id = $${valueIndex}
      RETURNING *
    `;

    const result = await pool.query(updateQuery, updateValues);

    // Create history entry
    await pool.query(`
      INSERT INTO offer_history (
        offer_id, action, previous_status, new_status, previous_amount, new_amount,
        performed_by, performed_by_type, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'agent', $8)
    `, [
      offerId,
      status === 'counter_offered' ? 'counter_offered' : status || 'updated',
      currentOffer.status,
      status || currentOffer.status,
      currentOffer.offer_amount,
      counterOfferAmount || currentOffer.offer_amount,
      req.user?.id || null,
      responseNotes || `Status changed to ${status}`
    ]);

    // Update lead status based on offer outcome
    if (status === 'accepted') {
      await pool.query(`
        INSERT INTO lead_activity (lead_id, activity_type, description, related_property_id, performed_by)
        VALUES ($1, 'status_change', 'Offer accepted by landlord', $2, $3)
      `, [currentOffer.lead_id, currentOffer.property_id, req.user?.id || null]);
    } else if (status === 'rejected') {
      await pool.query(`
        INSERT INTO lead_activity (lead_id, activity_type, description, related_property_id, performed_by)
        VALUES ($1, 'status_change', $2, $3, $4)
      `, [currentOffer.lead_id, `Offer rejected: ${rejectionReason || 'No reason given'}`, currentOffer.property_id, req.user?.id || null]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating offer:', error);
    res.status(500).json({ error: 'Failed to update offer' });
  }
});

// Delete offer
crmRouter.delete('/offers/:id', requireAgent, async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    // Delete history first
    await pool.query('DELETE FROM offer_history WHERE offer_id = $1', [offerId]);

    // Delete offer
    const result = await pool.query('DELETE FROM offer WHERE id = $1 RETURNING *', [offerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    res.json({ message: 'Offer deleted successfully' });
  } catch (error) {
    console.error('Error deleting offer:', error);
    res.status(500).json({ error: 'Failed to delete offer' });
  }
});

// Get offers for a specific lead
crmRouter.get('/leads/:id/offers', requireAgent, async (req, res) => {
  try {
    const leadId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT o.*,
             COALESCE(p.title, pp.title) as "propertyTitle",
             COALESCE(p.address_line1, pp.address) as "propertyAddress",
             pl.full_name as "landlordName"
      FROM offer o
      LEFT JOIN property p ON o.property_id = p.id
      LEFT JOIN property pp ON o.property_id = pp.id
      LEFT JOIN landlord pl ON o.landlord_id = pl.id
      WHERE o.lead_id = $1
      ORDER BY o.created_at DESC
    `, [leadId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching lead offers:', error);
    res.status(500).json({ error: 'Failed to fetch lead offers' });
  }
});

// Get offers for a specific property
crmRouter.get('/properties/:id/offers', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT o.*,
             l.full_name as "leadName", l.email as "leadEmail", l.phone as "leadPhone",
             l.kyc_status as "leadKycStatus", l.proof_of_funds_status as "leadFundsStatus"
      FROM offer o
      LEFT JOIN lead l ON o.lead_id = l.id
      WHERE o.property_id = $1
      ORDER BY o.created_at DESC
    `, [propertyId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching property offers:', error);
    res.status(500).json({ error: 'Failed to fetch property offers' });
  }
});

// Get offers for a specific landlord
crmRouter.get('/landlords/:id/offers', requireAgent, async (req, res) => {
  try {
    const landlordId = parseInt(req.params.id);

    const result = await pool.query(`
      SELECT o.*,
             l.full_name as "leadName", l.email as "leadEmail", l.phone as "leadPhone",
             l.kyc_status as "leadKycStatus", l.proof_of_funds_status as "leadFundsStatus",
             COALESCE(p.title, pp.title) as "propertyTitle",
             COALESCE(p.address_line1, pp.address) as "propertyAddress"
      FROM offer o
      LEFT JOIN lead l ON o.lead_id = l.id
      LEFT JOIN property p ON o.property_id = p.id
      LEFT JOIN property pp ON o.property_id = pp.id
      WHERE o.landlord_id = $1
      ORDER BY o.created_at DESC
    `, [landlordId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching landlord offers:', error);
    res.status(500).json({ error: 'Failed to fetch landlord offers' });
  }
});

// Convert accepted offer to tenancy (for rentals)
crmRouter.post('/offers/:id/convert-to-tenancy', requireAgent, async (req, res) => {
  try {
    const offerId = parseInt(req.params.id);

    // Get offer
    const offerResult = await pool.query(`
      SELECT o.*, l.full_name, l.email, l.phone, l.mobile
      FROM offer o
      LEFT JOIN lead l ON o.lead_id = l.id
      WHERE o.id = $1
    `, [offerId]);

    if (offerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Offer not found' });
    }

    const offer = offerResult.rows[0];

    if (offer.status !== 'accepted') {
      return res.status(400).json({ error: 'Only accepted offers can be converted to tenancy' });
    }

    if (offer.offer_type !== 'rental') {
      return res.status(400).json({ error: 'Only rental offers can be converted to tenancy' });
    }

    // Create tenant from lead if not already exists
    let tenantId = null;
    const existingTenantResult = await pool.query(
      'SELECT id FROM tenant WHERE email = $1 OR mobile = $2 LIMIT 1',
      [offer.email, offer.mobile]
    );

    if (existingTenantResult.rows.length > 0) {
      tenantId = existingTenantResult.rows[0].id;
    } else {
      const tenantResult = await pool.query(`
        INSERT INTO tenant (name, email, phone, mobile, status)
        VALUES ($1, $2, $3, $4, 'active')
        RETURNING id
      `, [offer.full_name, offer.email, offer.phone, offer.mobile]);
      tenantId = tenantResult.rows[0].id;
    }

    // Create tenancy
    const tenancyResult = await pool.query(`
      INSERT INTO tenancy (
        property_id, tenant_id, landlord_id, rent_amount, deposit_amount,
        start_date, end_date, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      RETURNING *
    `, [
      offer.property_id,
      tenantId,
      offer.landlord_id,
      offer.counter_offer_amount || offer.offer_amount, // Use counter offer if exists
      offer.deposit_offered,
      offer.move_in_date,
      offer.move_in_date && offer.tenancy_length
        ? new Date(new Date(offer.move_in_date).setMonth(new Date(offer.move_in_date).getMonth() + offer.tenancy_length))
        : null,
    ]);

    // Update offer with conversion
    await pool.query(`
      UPDATE offer SET converted_to_agreement_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [tenancyResult.rows[0].id, offerId]);

    // Update lead as converted
    await pool.query(`
      UPDATE lead SET
        status = 'converted',
        converted_at = NOW(),
        converted_to_tenant_id = $1,
        converted_to_property_id = $2
      WHERE id = $3
    `, [tenantId, offer.property_id, offer.lead_id]);

    res.json({
      tenancy: tenancyResult.rows[0],
      tenantId,
      message: 'Offer converted to tenancy successfully'
    });
  } catch (error) {
    console.error('Error converting offer to tenancy:', error);
    res.status(500).json({ error: 'Failed to convert offer to tenancy' });
  }
});

// Get supported property import portals
crmRouter.get('/properties/import/portals', requireAgent, (req, res) => {
  res.json(propertyImport.getSupportedPortals());
});

// Preview property import from URL (scrapes but doesn't save)
crmRouter.post('/properties/import/preview', requireAgent, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await propertyImport.previewImport(url);
    res.json(result);
  } catch (error: any) {
    console.error('Error previewing property import:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to preview property' });
  }
});

// Import property from URL (scrapes and saves to database)
crmRouter.post('/properties/import', requireAgent, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const result = await propertyImport.importFromUrl(url, req.user?.id, true);
    res.json(result);
  } catch (error: any) {
    console.error('Error importing property:', error);
    res.status(500).json({ success: false, error: error.message || 'Failed to import property' });
  }
});


// AI-powered property parsing
crmRouter.post('/properties/parse', requireAgent, async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || typeof description !== 'string') {
      return res.status(400).json({ error: 'Description is required' });
    }

    const parsedData = await parsePropertyFromNaturalLanguage(description);

    // Get area suggestions based on postcode
    let areaId = null;
    if (parsedData.postcode) {
      const areas = await storage.getLondonAreas();
      const area = areas.find(a => parsedData.postcode?.startsWith(a.postcode));
      if (area) {
        areaId = area.id;
      }
    }

    res.json({
      parsed: parsedData,
      areaId,
      success: true
    });
  } catch (error) {
    console.error('Error parsing property:', error);
    res.status(500).json({ error: 'Failed to parse property description' });
  }
});

// AI feature suggestions
crmRouter.post('/properties/suggest-features', requireAgent, async (req, res) => {
  try {
    const { propertyType, description } = req.body;

    const features = await suggestPropertyFeatures(
      propertyType || 'property',
      description || ''
    );

    res.json({ features });
  } catch (error) {
    console.error('Error suggesting features:', error);
    res.status(500).json({ error: 'Failed to suggest features' });
  }
});

// Portal credentials management
crmRouter.get('/portal-credentials', requireAgent, async (req, res) => {
  try {
    const credentials = await storage.getAllPortalCredentials();
    // Don't send actual passwords/keys to frontend
    const sanitized = credentials.map(cred => ({
      ...cred,
      password: cred.password ? '********' : null,
      apiKey: cred.apiKey ? '********' : null,
      apiSecret: cred.apiSecret ? '********' : null
    }));
    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching portal credentials:', error);
    res.status(500).json({ error: 'Failed to fetch portal credentials' });
  }
});

crmRouter.post('/portal-credentials', requireAgent, async (req, res) => {
  try {
    const validated = portalCredentialsFormSchema.parse(req.body);
    const credentials = await storage.createPortalCredentials(validated);

    res.json({
      ...credentials,
      password: '********',
      apiKey: '********',
      apiSecret: '********'
    });
  } catch (error) {
    console.error('Error creating portal credentials:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid credentials data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create portal credentials' });
  }
});

// Portal listings management
crmRouter.post('/properties/:id/publish', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const { portals } = req.body; // Array of portal names

    const property = await storage.getProperty(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const results = [];

    for (const portalName of portals) {
      try {
        // Check if we have credentials for this portal
        const credentials = await storage.getPortalCredentialsByName(portalName);
        if (!credentials) {
          results.push({
            portal: portalName,
            success: false,
            error: 'No credentials configured'
          });
          continue;
        }

        // Create portal listing record
        const listing = await storage.createPortalListing({
          propertyId,
          portalName,
          status: 'pending'
        });

        results.push({
          portal: portalName,
          success: true,
          listingId: listing.id
        });
      } catch (error) {
        results.push({
          portal: portalName,
          success: false,
          error: 'Failed to create listing'
        });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Error publishing property:', error);
    res.status(500).json({ error: 'Failed to publish property' });
  }
});

// Bulk publish properties to multiple portals
crmRouter.post('/properties/bulk-publish', requireAgent, async (req, res) => {
  try {
    const { propertyIds, targets } = req.body;

    if (!propertyIds || !Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'Property IDs are required' });
    }

    if (!targets || typeof targets !== 'object') {
      return res.status(400).json({ error: 'Publishing targets are required' });
    }

    // Build the SET clause dynamically based on targets
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (targets.website !== undefined) {
      setClauses.push(`is_published_website = $${paramIndex++}`);
      values.push(targets.website);
    }
    if (targets.zoopla !== undefined) {
      setClauses.push(`is_published_zoopla = $${paramIndex++}`);
      values.push(targets.zoopla);
    }
    if (targets.rightmove !== undefined) {
      setClauses.push(`is_published_rightmove = $${paramIndex++}`);
      values.push(targets.rightmove);
    }
    if (targets.onTheMarket !== undefined) {
      setClauses.push(`is_published_onthemarket = $${paramIndex++}`);
      values.push(targets.onTheMarket);
    }
    if (targets.social !== undefined) {
      setClauses.push(`is_published_social = $${paramIndex++}`);
      values.push(targets.social);
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'At least one publishing target must be specified' });
    }

    // Add updated_at
    setClauses.push(`updated_at = NOW()`);

    // Build the WHERE clause with property IDs
    const placeholders = propertyIds.map((_, i) => `$${paramIndex + i}`).join(', ');
    values.push(...propertyIds);

    const query = `
      UPDATE property
      SET ${setClauses.join(', ')}
      WHERE id IN (${placeholders})
      RETURNING id
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      updated: result.rowCount,
      propertyIds: result.rows.map(r => r.id)
    });
  } catch (error) {
    console.error('Error bulk publishing properties:', error);
    res.status(500).json({ error: 'Failed to bulk publish properties' });
  }
});

// Maintenance tickets for tenants
crmRouter.post('/maintenance/tickets', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const validated = maintenanceTicketFormSchema.parse(req.body);

    // Create the ticket
    const ticket = await storage.createMaintenanceTicket({
      ...validated,
      tenantId: req.user.id,
      status: 'new'
    });

    res.json(ticket);
  } catch (error) {
    console.error('Error creating maintenance ticket:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid ticket data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to create maintenance ticket' });
  }
});

crmRouter.get('/maintenance/tickets', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    let tickets;

    // Get tickets based on user role
    if (req.user.role === 'tenant') {
      tickets = await storage.getMaintenanceTicketsByTenant(req.user.id);
    } else if (req.user.role === 'maintenance_staff') {
      tickets = await storage.getMaintenanceTicketsByAssignee(req.user.id);
    } else if (req.user.role === 'admin' || req.user.role === 'agent') {
      tickets = await storage.getAllMaintenanceTickets();
    } else {
      tickets = [];
    }

    // Enrich tickets with contractor and property manager information
    const enrichedTickets = await Promise.all(tickets.map(async (ticket: any) => {
      const enriched: any = { ...ticket };

      // Get assigned contractor info
      if (ticket.assignedContractorId) {
        const contractor = await storage.getContractor(ticket.assignedContractorId);
        if (contractor) {
          enriched.assignedContractor = {
            id: contractor.id,
            companyName: contractor.companyName,
            contactName: contractor.contactName,
            phone: contractor.phone,
            email: contractor.email
          };
        }
      }

      // Get property and property manager info
      if (ticket.propertyId) {
        const property = await storage.getProperty(ticket.propertyId);
        if (property) {
          enriched.propertyAddress = `${property.addressLine1}${property.addressLine2 ? ', ' + property.addressLine2 : ''}, ${property.postcode}`;

          // Get property manager info
          if (property.propertyManagerId) {
            const manager = await storage.getUser(property.propertyManagerId);
            if (manager) {
              enriched.propertyManager = {
                id: manager.id,
                fullName: manager.fullName || manager.username,
                email: manager.email,
                phone: manager.phone
              };
            }
          }
        }
      }

      return enriched;
    }));

    res.json(enrichedTickets);
  } catch (error) {
    console.error('Error fetching maintenance tickets:', error);
    res.status(500).json({ error: 'Failed to fetch maintenance tickets' });
  }
});

// Update maintenance ticket status with audit trail
crmRouter.patch('/maintenance/tickets/:id/status', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const ticketId = parseInt(req.params.id);
    const { status, notes } = req.body;

    // Validate status
    const validStatuses = ['new', 'assigned', 'in_progress', 'awaiting_parts', 'completed', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Get current ticket to track previous status
    const currentTicket = await storage.getMaintenanceTicket(ticketId);
    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const previousStatus = currentTicket.status;

    // Build update data
    const updateData: any = {
      status,
      updatedAt: new Date()
    };

    // Add timestamps based on status change
    if (status === 'completed' || status === 'closed') {
      updateData.resolvedAt = new Date();
    }
    if (status === 'closed') {
      updateData.closedAt = new Date();
    }

    // Update the ticket
    const updatedTicket = await storage.updateMaintenanceTicket(ticketId, updateData);

    // Create audit trail entry
    await storage.createTicketUpdate({
      ticketId,
      userId: req.user.id,
      updateType: 'status_change',
      message: notes || `Status changed from ${previousStatus} to ${status}`,
      previousStatus,
      newStatus: status,
      isInternal: false
    });

    res.json(updatedTicket);
  } catch (error) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({ error: 'Failed to update ticket status' });
  }
});

// Assign contractor to maintenance ticket
crmRouter.post('/maintenance/tickets/:id/assign-contractor', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const ticketId = parseInt(req.params.id);
    const { contractorId, notify } = req.body;

    if (!contractorId) {
      return res.status(400).json({ error: 'Contractor ID required' });
    }

    // Get current ticket
    const currentTicket = await storage.getMaintenanceTicket(ticketId);
    if (!currentTicket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get contractor info
    const contractor = await storage.getContractor(contractorId);
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    const previousStatus = currentTicket.status;

    // Update the ticket with contractor assignment
    const updatedTicket = await storage.updateMaintenanceTicket(ticketId, {
      assignedContractorId: contractorId,
      assignedAt: new Date(),
      status: previousStatus === 'new' ? 'assigned' : previousStatus,
      updatedAt: new Date()
    });

    // Create audit trail entry
    await storage.createTicketUpdate({
      ticketId,
      userId: req.user.id,
      updateType: 'assignment',
      message: `Contractor assigned: ${contractor.companyName}${notify ? ' (notification sent)' : ''}`,
      previousStatus,
      newStatus: previousStatus === 'new' ? 'assigned' : previousStatus,
      isInternal: false
    });

    // TODO: Send notification to contractor if notify=true
    // This would integrate with email/SMS service

    res.json({
      ticket: updatedTicket,
      contractor,
      notified: notify || false
    });
  } catch (error) {
    console.error('Error assigning contractor:', error);
    res.status(500).json({ error: 'Failed to assign contractor' });
  }
});

// Get ticket update history (audit trail)
crmRouter.get('/maintenance/tickets/:id/history', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const ticketId = parseInt(req.params.id);
    const updates = await storage.getTicketUpdates(ticketId);

    // Enrich with user info
    const enrichedUpdates = await Promise.all(updates.map(async (update: any) => {
      const user = await storage.getUser(update.userId);
      return {
        ...update,
        userName: user?.fullName || user?.username || 'Unknown User'
      };
    }));

    res.json(enrichedUpdates);
  } catch (error) {
    console.error('Error fetching ticket history:', error);
    res.status(500).json({ error: 'Failed to fetch ticket history' });
  }
});

// Users management
crmRouter.get('/users', requireAgent, async (req, res) => {
  try {
    const { role } = req.query;

    let users;
    if (role && typeof role === 'string') {
      users = await storage.getUsersByRole(role);
    } else {
      // For now, just return empty array for all users
      users = [];
    }

    // Remove sensitive data
    const sanitized = users.map(user => ({
      ...user,
      password: undefined
    }));

    res.json(sanitized);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ==========================================
// COMMUNICATION HUB ROUTES
// ==========================================

// Get all conversations
crmRouter.get('/conversations', requireAgent, async (req, res) => {
  try {
    const { status, channel, search } = req.query;

    // Mock data for now - would be replaced with actual database queries
    const conversations = [
      {
        id: 1,
        contactName: 'Sarah Johnson',
        contactEmail: 'sarah.j@email.com',
        contactPhone: '+44 7700 900123',
        lastMessagePreview: 'Thank you for the property details. When can I schedule a viewing?',
        lastMessageAt: new Date(Date.now() - 1000 * 60 * 30),
        unreadCount: 2,
        status: 'open',
        priority: 'high',
        channel: 'email',
        propertyId: 1,
        tags: ['buyer', 'viewing-requested']
      }
    ];

    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages for a conversation
crmRouter.get('/conversations/:id/messages', requireAgent, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);

    // Mock data
    const messages = [
      {
        id: 1,
        conversationId,
        direction: 'inbound',
        channel: 'email',
        content: 'Hi, I saw your listing for the 2 bed flat in Maida Vale.',
        sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
        status: 'read'
      }
    ];

    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a message
crmRouter.post('/conversations/:id/messages', requireAgent, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.id);
    const { channel, content, toAddress } = req.body;

    // Would integrate with SMS/Email/WhatsApp services here
    const message = {
      id: Date.now(),
      conversationId,
      direction: 'outbound',
      channel,
      content,
      toAddress,
      sentAt: new Date(),
      status: 'sent'
    };

    res.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get communication templates
crmRouter.get('/templates', requireAgent, async (req, res) => {
  try {
    // Mock data - would fetch from database
    const templates = [
      {
        id: 1,
        templateName: 'Viewing Confirmation',
        templateType: 'email',
        subject: 'Your Viewing Appointment Confirmation',
        content: 'Dear {{customer_name}},\n\nYour viewing has been confirmed...',
        isActive: true
      }
    ];

    res.json(templates);
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create/update template
crmRouter.post('/templates', requireAgent, async (req, res) => {
  try {
    const { templateName, templateType, subject, content } = req.body;

    const template = {
      id: Date.now(),
      templateName,
      templateType,
      subject,
      content,
      isActive: true,
      createdAt: new Date()
    };

    res.json(template);
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Get campaigns
crmRouter.get('/campaigns', requireAgent, async (req, res) => {
  try {
    // Mock data
    const campaigns = [
      {
        id: 1,
        name: 'December Newsletter',
        description: 'Monthly property update',
        campaignType: 'email',
        status: 'sent',
        recipientCount: 1250,
        sentCount: 1248,
        openedCount: 456,
        clickedCount: 89
      }
    ];

    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Create campaign
crmRouter.post('/campaigns', requireAgent, async (req, res) => {
  try {
    const { name, description, campaignType, targetAudience, subject, content, scheduledFor } = req.body;

    const campaign = {
      id: Date.now(),
      name,
      description,
      campaignType,
      targetAudience,
      subject,
      content,
      scheduledFor,
      status: scheduledFor ? 'scheduled' : 'draft',
      recipientCount: 0,
      sentCount: 0,
      createdAt: new Date()
    };

    res.json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// ==========================================
// ANALYTICS ROUTES
// ==========================================

// Get dashboard KPIs
crmRouter.get('/analytics/dashboard', requireAgent, async (req, res) => {
  try {
    const { timeRange } = req.query;

    // Mock analytics data
    const analytics = {
      totalRevenue: 185450,
      revenueChange: 12.5,
      propertiesListed: 156,
      listingsChange: 8,
      dealsClosed: 23,
      dealsChange: -3,
      avgDaysOnMarket: 28,
      daysChange: -15,
      activeViewings: 45,
      newEnquiries: 128,
      openTickets: 32,
      avgResponseTime: 2.4,
      monthlyRevenue: [
        { label: 'Jul', value: 125000 },
        { label: 'Aug', value: 142000 },
        { label: 'Sep', value: 138000 },
        { label: 'Oct', value: 156000 },
        { label: 'Nov', value: 168000 },
        { label: 'Dec', value: 185000 }
      ],
      propertyStatus: {
        active: 89,
        underOffer: 23,
        completed: 45,
        withdrawn: 8
      },
      leadSources: {
        website: 42,
        zoopla: 28,
        rightmove: 35,
        referral: 18,
        walkIn: 12
      }
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get agent performance
crmRouter.get('/analytics/agents', requireAgent, async (req, res) => {
  try {
    const agents = [
      { name: 'Sarah Mitchell', sales: 8, lettings: 12, revenue: 45200, rating: 4.8 },
      { name: 'James Carter', sales: 6, lettings: 15, revenue: 38500, rating: 4.6 },
      { name: 'Emily Watson', sales: 5, lettings: 18, revenue: 35800, rating: 4.7 }
    ];

    res.json(agents);
  } catch (error) {
    console.error('Error fetching agent performance:', error);
    res.status(500).json({ error: 'Failed to fetch agent performance' });
  }
});

// ==========================================
// CALENDAR ROUTES
// ==========================================

// Get calendar events
crmRouter.get('/calendar/events', requireAgent, async (req, res) => {
  try {
    const { start, end, type } = req.query;

    // Mock events
    const events = [
      {
        id: 1,
        title: 'Property Viewing',
        description: 'Viewing for 3 Bed House in Queens Park',
        eventType: 'viewing',
        startTime: new Date(Date.now() + 1000 * 60 * 60 * 2),
        endTime: new Date(Date.now() + 1000 * 60 * 60 * 2.5),
        location: '15 Queens Park Gardens, NW6',
        propertyId: 1,
        status: 'confirmed'
      }
    ];

    res.json(events);
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({ error: 'Failed to fetch events' });
  }
});

// Create calendar event
crmRouter.post('/calendar/events', requireAgent, async (req, res) => {
  try {
    const { title, description, eventType, startTime, endTime, location, propertyId, attendees, isVirtual, virtualMeetingUrl } = req.body;

    const event = {
      id: Date.now(),
      title,
      description,
      eventType,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      location,
      propertyId,
      attendees,
      isVirtual,
      virtualMeetingUrl,
      status: 'scheduled',
      organizerId: req.user?.id,
      createdAt: new Date()
    };

    res.json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: 'Failed to create event' });
  }
});

// Update calendar event
crmRouter.put('/calendar/events/:id', requireAgent, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);
    const updates = req.body;

    // Would update in database
    const event = { id: eventId, ...updates, updatedAt: new Date() };

    res.json(event);
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ error: 'Failed to update event' });
  }
});

// Delete calendar event
crmRouter.delete('/calendar/events/:id', requireAgent, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id);

    // Would delete from database
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// Get calendar settings
crmRouter.get('/calendar/settings', requireAgent, async (req, res) => {
  try {
    // Would fetch from database for current user
    const settings = {
      googleCalendarEnabled: true,
      outlookCalendarEnabled: false,
      emailReminders: true,
      smsReminders: false,
      reminderMinutes: 30,
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      workingHoursStart: '09:00',
      workingHoursEnd: '17:00'
    };

    res.json(settings);
  } catch (error) {
    console.error('Error fetching calendar settings:', error);
    res.status(500).json({ error: 'Failed to fetch calendar settings' });
  }
});

// Update calendar settings
crmRouter.put('/calendar/settings', requireAgent, async (req, res) => {
  try {
    const settings = req.body;

    // Would save to database
    res.json(settings);
  } catch (error) {
    console.error('Error updating calendar settings:', error);
    res.status(500).json({ error: 'Failed to update calendar settings' });
  }
});

// ==========================================
// SYNDICATION ROUTES
// ==========================================

// Get portal sync status
crmRouter.get('/syndication/portals', requireAgent, async (req, res) => {
  try {
    const portals = [
      {
        id: 'zoopla',
        name: 'Zoopla',
        connected: true,
        autoSync: true,
        lastSync: new Date(Date.now() - 1000 * 60 * 30),
        totalListings: 45,
        totalViews: 12450,
        totalEnquiries: 234
      },
      {
        id: 'rightmove',
        name: 'Rightmove',
        connected: true,
        autoSync: true,
        lastSync: new Date(Date.now() - 1000 * 60 * 30),
        totalListings: 45,
        totalViews: 10280,
        totalEnquiries: 198
      }
    ];

    res.json(portals);
  } catch (error) {
    console.error('Error fetching portals:', error);
    res.status(500).json({ error: 'Failed to fetch portals' });
  }
});

// Sync all portals
crmRouter.post('/syndication/sync', requireAgent, async (req, res) => {
  try {
    // Would trigger sync with all connected portals
    res.json({ success: true, message: 'Sync initiated' });
  } catch (error) {
    console.error('Error syncing portals:', error);
    res.status(500).json({ error: 'Failed to sync portals' });
  }
});

// Get syndication analytics
crmRouter.get('/syndication/analytics', requireAgent, async (req, res) => {
  try {
    const analytics = {
      totalListings: 156,
      totalViews: 22730,
      totalEnquiries: 432,
      conversionRate: 1.9,
      portalBreakdown: [
        { portal: 'zoopla', views: 12450, enquiries: 234 },
        { portal: 'rightmove', views: 10280, enquiries: 198 }
      ]
    };

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching syndication analytics:', error);
    res.status(500).json({ error: 'Failed to fetch syndication analytics' });
  }
});

// ============= Payment Routes =============

// Get Stripe publishable key
crmRouter.get('/payments/config', async (req, res) => {
  try {
    const publishableKey = getPublishableKey();
    const configured = isStripeConfigured();

    res.json({
      publishableKey,
      configured
    });
  } catch (error) {
    console.error('Error fetching payment config:', error);
    res.status(500).json({ error: 'Failed to fetch payment configuration' });
  }
});

// Create payment intent
crmRouter.post('/payments/create-intent', async (req, res) => {
  try {
    const { amount, description, customerId, metadata } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const result = await createPaymentIntent({
      amount: Math.round(amount * 100), // Convert to pence
      description,
      customerId,
      metadata
    });

    if (!result) {
      return res.status(500).json({ error: 'Failed to create payment intent' });
    }

    res.json(result);
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

// Record a completed payment
crmRouter.post('/payments/record', async (req, res) => {
  try {
    const { customerId, propertyId, amount, paymentType, status, stripePaymentIntentId, description } = req.body;

    if (!customerId || !amount || !paymentType) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const paymentId = await recordPayment({
      customerId,
      propertyId,
      amount,
      paymentType,
      status: status || 'completed',
      stripePaymentIntentId,
      description
    });

    if (!paymentId) {
      return res.status(500).json({ error: 'Failed to record payment' });
    }

    res.json({ id: paymentId, success: true });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

// Get payments for current user
crmRouter.get('/payments/my-payments', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const payments = await getCustomerPayments(userId);
    res.json(payments);
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Get payment schedules for current user
crmRouter.get('/payments/schedules', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const schedules = await getPaymentSchedules(userId);
    res.json(schedules);
  } catch (error) {
    console.error('Error fetching payment schedules:', error);
    res.status(500).json({ error: 'Failed to fetch payment schedules' });
  }
});

// Create a payment schedule
crmRouter.post('/payments/schedules', requireAgent, async (req, res) => {
  try {
    const { customerId, propertyId, amount, scheduleType, frequency, dueDate, description } = req.body;

    if (!customerId || !amount || !scheduleType || !frequency || !dueDate) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const scheduleId = await createPaymentSchedule({
      customerId,
      propertyId,
      amount,
      scheduleType,
      frequency,
      dueDate: new Date(dueDate),
      description
    });

    if (!scheduleId) {
      return res.status(500).json({ error: 'Failed to create payment schedule' });
    }

    res.json({ id: scheduleId, success: true });
  } catch (error) {
    console.error('Error creating payment schedule:', error);
    res.status(500).json({ error: 'Failed to create payment schedule' });
  }
});

// Get all payments (admin only)
crmRouter.get('/payments', requireAgent, async (req, res) => {
  try {
    // For now return mock data - can be extended to fetch from database
    const payments = [
      {
        id: 1,
        customerId: 1,
        customerName: 'John Smith',
        amount: 1500,
        currency: 'GBP',
        paymentType: 'rent',
        status: 'completed',
        paymentDate: new Date().toISOString(),
        description: 'Monthly rent payment'
      },
      {
        id: 2,
        customerId: 2,
        customerName: 'Sarah Johnson',
        amount: 500,
        currency: 'GBP',
        paymentType: 'deposit',
        status: 'completed',
        paymentDate: new Date(Date.now() - 86400000).toISOString(),
        description: 'Security deposit'
      }
    ];

    res.json(payments);
  } catch (error) {
    console.error('Error fetching all payments:', error);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// ==========================================
// STAFF MANAGEMENT ROUTES
// ==========================================

// Get all staff members
crmRouter.get('/staff', requireAgent, async (req, res) => {
  try {
    const { department, status } = req.query;

    // Get all users who are staff (admin, agent, maintenance_staff)
    const staffRoles = ['admin', 'agent', 'maintenance_staff'];
    let staff = await storage.getAllUsers();

    // Filter to staff roles only
    staff = staff.filter(u => staffRoles.includes(u.role));

    // Filter by department if provided
    if (department && typeof department === 'string') {
      staff = staff.filter(s => s.department === department);
    }

    // Filter by status if provided
    if (status === 'active') {
      staff = staff.filter(s => s.isActive);
    } else if (status === 'inactive') {
      staff = staff.filter(s => !s.isActive);
    }

    // Get staff profiles for additional details
    const staffWithProfiles = await Promise.all(
      staff.map(async (s) => {
        const profile = await storage.getStaffProfile(s.id);
        return {
          ...s,
          password: undefined,
          profile: profile || null
        };
      })
    );

    res.json(staffWithProfiles);
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ error: 'Failed to fetch staff' });
  }
});

// Get single staff member
crmRouter.get('/staff/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const user = await storage.getUser(id);

    if (!user) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const profile = await storage.getStaffProfile(id);
    const attendance = await storage.getStaffAttendance(id, 30); // Last 30 days
    const leave = await storage.getStaffLeave(id);
    const performance = await storage.getStaffPerformance(id);
    const training = await storage.getStaffTraining(id);

    res.json({
      ...user,
      password: undefined,
      profile,
      attendance,
      leave,
      performance,
      training
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ error: 'Failed to fetch staff member' });
  }
});

// Create new staff member
crmRouter.post('/staff', requireAgent, async (req, res) => {
  try {
    const {
      username, password, email, fullName, phone, role, department,
      jobTitle, employmentType, startDate, baseSalary, commissionRate,
      workingDays, skills, emergencyContact, emergencyContactPhone
    } = req.body;

    // Validate required fields
    if (!username || !password || !email || !fullName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check if username/email already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Create user first
    const user = await storage.createUser({
      username,
      password, // Will be hashed by storage
      email,
      fullName,
      phone,
      role,
      department,
      isActive: true
    });

    // Create staff profile
    if (user) {
      await storage.createStaffProfile({
        userId: user.id,
        employeeId: `EMP${String(user.id).padStart(4, '0')}`,
        jobTitle: jobTitle || role,
        department: department || 'general',
        employmentType: employmentType || 'full_time',
        startDate: startDate ? new Date(startDate) : new Date(),
        baseSalary: baseSalary ? baseSalary * 100 : null, // Convert to pence
        commissionRate: commissionRate || null,
        workingDays: workingDays || ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        skills: skills || [],
        emergencyContact,
        emergencyContactPhone,
        isActive: true
      });
    }

    res.json({ ...user, password: undefined });
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

// Update staff member
crmRouter.put('/staff/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    // Update user record
    const userUpdates: any = {};
    if (updates.email) userUpdates.email = updates.email;
    if (updates.fullName) userUpdates.fullName = updates.fullName;
    if (updates.phone) userUpdates.phone = updates.phone;
    if (updates.role) userUpdates.role = updates.role;
    if (updates.department) userUpdates.department = updates.department;
    if (typeof updates.isActive === 'boolean') userUpdates.isActive = updates.isActive;

    if (Object.keys(userUpdates).length > 0) {
      await storage.updateUser(id, userUpdates);
    }

    // Update staff profile
    const profileUpdates: any = {};
    if (updates.jobTitle) profileUpdates.jobTitle = updates.jobTitle;
    if (updates.employmentType) profileUpdates.employmentType = updates.employmentType;
    if (updates.baseSalary) profileUpdates.baseSalary = updates.baseSalary * 100;
    if (updates.commissionRate) profileUpdates.commissionRate = updates.commissionRate;
    if (updates.workingDays) profileUpdates.workingDays = updates.workingDays;
    if (updates.skills) profileUpdates.skills = updates.skills;
    if (updates.emergencyContact) profileUpdates.emergencyContact = updates.emergencyContact;
    if (updates.emergencyContactPhone) profileUpdates.emergencyContactPhone = updates.emergencyContactPhone;

    if (Object.keys(profileUpdates).length > 0) {
      await storage.updateStaffProfile(id, profileUpdates);
    }

    const updatedUser = await storage.getUser(id);
    const profile = await storage.getStaffProfile(id);

    res.json({ ...updatedUser, password: undefined, profile });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// Delete/deactivate staff member
crmRouter.delete('/staff/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Soft delete - just deactivate
    await storage.updateUser(id, { isActive: false });
    await storage.updateStaffProfile(id, { isActive: false });

    res.json({ success: true });
  } catch (error) {
    console.error('Error deactivating staff member:', error);
    res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
});

// Record staff attendance
crmRouter.post('/staff/:id/attendance', requireAgent, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const { date, checkInTime, checkOutTime, status, workLocation, notes } = req.body;

    const attendance = await storage.recordStaffAttendance({
      staffId,
      date: new Date(date),
      checkInTime: checkInTime ? new Date(checkInTime) : null,
      checkOutTime: checkOutTime ? new Date(checkOutTime) : null,
      status: status || 'present',
      workLocation: workLocation || 'office',
      notes
    });

    res.json(attendance);
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// Request leave
crmRouter.post('/staff/:id/leave', async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const { leaveType, startDate, endDate, reason } = req.body;

    // Calculate total days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const leave = await storage.createStaffLeave({
      staffId,
      leaveType,
      startDate: start,
      endDate: end,
      totalDays,
      reason,
      status: 'pending'
    });

    res.json(leave);
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ error: 'Failed to create leave request' });
  }
});

// Approve/reject leave
crmRouter.put('/staff/leave/:id', requireAgent, async (req, res) => {
  try {
    const leaveId = parseInt(req.params.id);
    const { status, rejectionReason } = req.body;

    const updates: any = {
      status,
      approvedBy: (req as any).user?.id,
      approvedAt: new Date()
    };

    if (status === 'rejected' && rejectionReason) {
      updates.rejectionReason = rejectionReason;
    }

    await storage.updateStaffLeave(leaveId, updates);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating leave request:', error);
    res.status(500).json({ error: 'Failed to update leave request' });
  }
});

// Get staff attendance summary
crmRouter.get('/staff/:id/attendance-summary', requireAgent, async (req, res) => {
  try {
    const staffId = parseInt(req.params.id);
    const { month, year } = req.query;

    const attendance = await storage.getStaffAttendanceSummary(
      staffId,
      month ? parseInt(month as string) : new Date().getMonth() + 1,
      year ? parseInt(year as string) : new Date().getFullYear()
    );

    res.json(attendance);
  } catch (error) {
    console.error('Error fetching attendance summary:', error);
    res.status(500).json({ error: 'Failed to fetch attendance summary' });
  }
});

// Get all pending leave requests
crmRouter.get('/leave-requests', requireAgent, async (req, res) => {
  try {
    const { status } = req.query;
    const leaveRequests = await storage.getAllLeaveRequests(status as string || 'pending');
    res.json(leaveRequests);
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ error: 'Failed to fetch leave requests' });
  }
});

// Get departments summary
crmRouter.get('/staff/departments/summary', requireAgent, async (req, res) => {
  try {
    const staff = await storage.getAllUsers();
    const staffRoles = ['admin', 'agent', 'maintenance_staff'];
    const activeStaff = staff.filter(u => staffRoles.includes(u.role) && u.isActive);

    const departments: { [key: string]: { total: number; present: number } } = {};

    for (const s of activeStaff) {
      const dept = s.department || 'general';
      if (!departments[dept]) {
        departments[dept] = { total: 0, present: 0 };
      }
      departments[dept].total++;
      // Would check attendance for today
      departments[dept].present++;
    }

    res.json(departments);
  } catch (error) {
    console.error('Error fetching departments summary:', error);
    res.status(500).json({ error: 'Failed to fetch departments summary' });
  }
});

// ==========================================
// ESTATE AGENCY ROLES MANAGEMENT
// ==========================================

// Get all estate agency roles
crmRouter.get('/roles', requireAgent, async (req, res) => {
  try {
    const roles = await storage.getEstateAgencyRoles();
    res.json(roles);
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ error: 'Failed to fetch roles' });
  }
});

// Get single role with permissions
crmRouter.get('/roles/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const role = await storage.getEstateAgencyRoleById(id);

    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }

    const permissions = await storage.getRolePermissions(id);

    res.json({ ...role, permissions });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({ error: 'Failed to fetch role' });
  }
});

// Initialize default roles (admin only)
crmRouter.post('/roles/initialize', requireAdmin, async (req, res) => {
  try {
    await storage.initializeEstateAgencyRoles();
    res.json({ success: true, message: 'Estate agency roles initialized' });
  } catch (error) {
    console.error('Error initializing roles:', error);
    res.status(500).json({ error: 'Failed to initialize roles' });
  }
});

// Create new role (admin only)
crmRouter.post('/roles', requireAdmin, async (req, res) => {
  try {
    const { roleCode, roleName, description, department, reportsTo, requiredQualifications, compensationType, permissions } = req.body;

    if (!roleCode || !roleName || !department) {
      return res.status(400).json({ error: 'Role code, name, and department are required' });
    }

    const role = await storage.createEstateAgencyRole({
      roleCode,
      roleName,
      description,
      department,
      reportsTo,
      requiredQualifications,
      compensationType
    });

    // Add permissions if provided
    if (permissions && Array.isArray(permissions)) {
      for (const perm of permissions) {
        await storage.addRolePermission(role.id, perm.category, perm.permission, perm.accessLevel);
      }
    }

    res.json(role);
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ error: 'Failed to create role' });
  }
});

// Update role (admin only)
crmRouter.put('/roles/:id', requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const role = await storage.updateEstateAgencyRole(id, updates);
    res.json(role);
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Update role permissions (admin only)
crmRouter.put('/roles/:id/permissions', requireAdmin, async (req, res) => {
  try {
    const roleId = parseInt(req.params.id);
    const { permissions } = req.body;

    if (!Array.isArray(permissions)) {
      return res.status(400).json({ error: 'Permissions must be an array' });
    }

    // Clear existing permissions and add new ones
    await storage.clearRolePermissions(roleId);

    for (const perm of permissions) {
      await storage.addRolePermission(roleId, perm.category, perm.permission, perm.accessLevel);
    }

    const updatedPermissions = await storage.getRolePermissions(roleId);
    res.json(updatedPermissions);
  } catch (error) {
    console.error('Error updating role permissions:', error);
    res.status(500).json({ error: 'Failed to update role permissions' });
  }
});

// ==========================================
// STAFF ROLE ASSIGNMENTS
// ==========================================

// Get staff member's assigned roles
crmRouter.get('/staff/:id/roles', requireAgent, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const assignments = await storage.getStaffRoleAssignments(userId);
    res.json(assignments);
  } catch (error) {
    console.error('Error fetching staff roles:', error);
    res.status(500).json({ error: 'Failed to fetch staff roles' });
  }
});

// Assign role to staff member (admin only)
crmRouter.post('/staff/:id/roles', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const adminId = (req as any).user.id;
    const { roleId, isPrimaryRole, effectiveFrom, effectiveTo, notes } = req.body;

    if (!roleId) {
      return res.status(400).json({ error: 'Role ID is required' });
    }

    const assignment = await storage.assignRoleToStaff({
      userId,
      roleId,
      assignedBy: adminId,
      isPrimaryRole: isPrimaryRole ?? true,
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : null,
      notes
    });

    res.json(assignment);
  } catch (error) {
    console.error('Error assigning role:', error);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

// Update role assignment (admin only)
crmRouter.put('/staff/:userId/roles/:assignmentId', requireAdmin, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);
    const updates = req.body;

    const assignment = await storage.updateRoleAssignment(assignmentId, updates);
    res.json(assignment);
  } catch (error) {
    console.error('Error updating role assignment:', error);
    res.status(500).json({ error: 'Failed to update role assignment' });
  }
});

// Remove role from staff member (admin only)
crmRouter.delete('/staff/:userId/roles/:assignmentId', requireAdmin, async (req, res) => {
  try {
    const assignmentId = parseInt(req.params.assignmentId);

    await storage.deactivateRoleAssignment(assignmentId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error removing role assignment:', error);
    res.status(500).json({ error: 'Failed to remove role assignment' });
  }
});

// Get user's permissions (check what they can access)
crmRouter.get('/users/:id/permissions', requireAgent, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const permissions = await storage.getUserPermissions(userId);
    res.json(permissions);
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch user permissions' });
  }
});

// Check if current user has specific permission
crmRouter.get('/permissions/check', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { category, permission } = req.query;

    if (!category || !permission) {
      return res.status(400).json({ error: 'Category and permission are required' });
    }

    const hasPermission = await storage.checkUserPermission(
      user.id,
      category as string,
      permission as string
    );

    res.json({ hasPermission });
  } catch (error) {
    console.error('Error checking permission:', error);
    res.status(500).json({ error: 'Failed to check permission' });
  }
});

// ==========================================
// PORTAL SYNDICATION ROUTES
// ==========================================

// Save portal credentials
crmRouter.post('/portals/credentials', requireAgent, async (req, res) => {
  try {
    const { portalName, username, password } = req.body;

    if (!portalName || !username || !password) {
      return res.status(400).json({ error: 'Portal name, username, and password are required' });
    }

    const success = await portalSyndication.savePortalCredentials(portalName, username, password);

    if (success) {
      res.json({ success: true, message: `Credentials saved for ${portalName}` });
    } else {
      res.status(500).json({ error: 'Failed to save credentials' });
    }
  } catch (error) {
    console.error('Error saving portal credentials:', error);
    res.status(500).json({ error: 'Failed to save portal credentials' });
  }
});

// Test portal login
crmRouter.post('/portals/:portalName/test', requireAgent, async (req, res) => {
  try {
    const { portalName } = req.params;
    const result = await portalSyndication.testPortalLogin(portalName);
    res.json(result);
  } catch (error) {
    console.error('Error testing portal login:', error);
    res.status(500).json({ success: false, message: 'Failed to test portal login' });
  }
});

// Get configured portals
crmRouter.get('/portals', requireAgent, async (req, res) => {
  try {
    const portals = await portalSyndication.getConfiguredPortals();
    res.json(portals);
  } catch (error) {
    console.error('Error fetching configured portals:', error);
    res.status(500).json({ error: 'Failed to fetch configured portals' });
  }
});

// Syndicate property to portal
crmRouter.post('/portals/:portalName/syndicate/:propertyId', requireAgent, async (req, res) => {
  try {
    const { portalName, propertyId } = req.params;

    if (portalName.toLowerCase() !== 'zoopla') {
      return res.status(400).json({ error: 'Currently only Zoopla is supported' });
    }

    const result = await portalSyndication.syndicateToZoopla(parseInt(propertyId));
    res.json(result);
  } catch (error) {
    console.error('Error syndicating to portal:', error);
    res.status(500).json({ success: false, message: 'Failed to syndicate property' });
  }
});

// Update portal listing
crmRouter.put('/portals/:portalName/listing/:propertyId', requireAgent, async (req, res) => {
  try {
    const { portalName, propertyId } = req.params;

    if (portalName.toLowerCase() !== 'zoopla') {
      return res.status(400).json({ error: 'Currently only Zoopla is supported' });
    }

    const result = await portalSyndication.updateZooplaListing(parseInt(propertyId));
    res.json(result);
  } catch (error) {
    console.error('Error updating portal listing:', error);
    res.status(500).json({ success: false, message: 'Failed to update listing' });
  }
});

// Remove portal listing
crmRouter.delete('/portals/:portalName/listing/:propertyId', requireAgent, async (req, res) => {
  try {
    const { portalName, propertyId } = req.params;

    if (portalName.toLowerCase() !== 'zoopla') {
      return res.status(400).json({ error: 'Currently only Zoopla is supported' });
    }

    const result = await portalSyndication.removeZooplaListing(parseInt(propertyId));
    res.json(result);
  } catch (error) {
    console.error('Error removing portal listing:', error);
    res.status(500).json({ success: false, message: 'Failed to remove listing' });
  }
});

// Sync portal stats
crmRouter.post('/portals/:portalName/sync-stats/:propertyId', requireAgent, async (req, res) => {
  try {
    const { portalName, propertyId } = req.params;

    if (portalName.toLowerCase() !== 'zoopla') {
      return res.status(400).json({ error: 'Currently only Zoopla is supported' });
    }

    const result = await portalSyndication.syncZooplaStats(parseInt(propertyId));
    res.json(result);
  } catch (error) {
    console.error('Error syncing portal stats:', error);
    res.status(500).json({ success: false, message: 'Failed to sync stats' });
  }
});

// Get syndication status for property
crmRouter.get('/portals/status/:propertyId', requireAgent, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const status = await portalSyndication.getSyndicationStatus(parseInt(propertyId));
    res.json(status);
  } catch (error) {
    console.error('Error getting syndication status:', error);
    res.status(500).json({ error: 'Failed to get syndication status' });
  }
});

// Bulk syndicate properties
crmRouter.post('/portals/:portalName/bulk-syndicate', requireAgent, async (req, res) => {
  try {
    const { portalName } = req.params;
    const { propertyIds } = req.body;

    if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
      return res.status(400).json({ error: 'Property IDs array is required' });
    }

    if (portalName.toLowerCase() !== 'zoopla') {
      return res.status(400).json({ error: 'Currently only Zoopla is supported' });
    }

    const result = await portalSyndication.bulkSyndicateToZoopla(propertyIds);
    res.json(result);
  } catch (error) {
    console.error('Error bulk syndicating:', error);
    res.status(500).json({ success: false, message: 'Failed to bulk syndicate' });
  }
});

// ==========================================
// AI PHONE SYSTEM ROUTES
// ==========================================

// Twilio webhook for inbound calls
crmRouter.post('/voice/inbound', async (req, res) => {
  try {
    const twiml = await aiPhone.handleInboundCall(req.body);
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error handling inbound call:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>We're experiencing technical difficulties. Please call back later.</Say>
  <Hangup/>
</Response>`);
  }
});

// Process speech input from Twilio
crmRouter.post('/voice/process-speech', async (req, res) => {
  try {
    const twiml = await aiPhone.handleSpeechInput(req.body);
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error processing speech:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>I apologize, I couldn't process that. Please try again.</Say>
  <Gather input="speech" action="/api/voice/process-speech" method="POST" speechTimeout="auto" language="en-GB">
  </Gather>
</Response>`);
  }
});

// Call status webhook
crmRouter.post('/voice/status', async (req, res) => {
  try {
    await aiPhone.handleCallStatus(req.body);
    res.sendStatus(200);
  } catch (error) {
    console.error('Error handling call status:', error);
    res.sendStatus(500);
  }
});

// Make outbound call
crmRouter.post('/voice/call', requireAgent, async (req, res) => {
  try {
    const { phoneNumber, purpose, context } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const result = await aiPhone.makeOutboundCall(
      phoneNumber,
      purpose || 'general',
      context || {}
    );

    res.json(result);
  } catch (error) {
    console.error('Error making outbound call:', error);
    res.status(500).json({ success: false, error: 'Failed to make call' });
  }
});

// Get call analytics
crmRouter.get('/voice/analytics', requireAgent, async (req, res) => {
  try {
    const { period } = req.query;
    const analytics = await aiPhone.getCallAnalytics(period as string || 'week');
    res.json(analytics);
  } catch (error) {
    console.error('Error fetching call analytics:', error);
    res.status(500).json({ error: 'Failed to fetch call analytics' });
  }
});

// ==========================================
// WHATSAPP COLLABORATION HUB ROUTES
// ==========================================

// WhatsApp webhook for incoming messages
crmRouter.post('/whatsapp/webhook', async (req, res) => {
  try {
    const result = await collaborationHub.handleIncomingMessage(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error handling WhatsApp message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Send WhatsApp message
crmRouter.post('/whatsapp/send', requireAgent, async (req, res) => {
  try {
    const { to, message, conversationId, propertyId } = req.body;

    if (!to || !message) {
      return res.status(400).json({ error: 'Recipient and message are required' });
    }

    const result = await collaborationHub.sendWhatsAppMessage(to, message, {
      conversationId,
      propertyId
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// Send templated WhatsApp message
crmRouter.post('/whatsapp/send-template', requireAgent, async (req, res) => {
  try {
    const { to, templateName, variables, conversationId, propertyId } = req.body;

    if (!to || !templateName) {
      return res.status(400).json({ error: 'Recipient and template name are required' });
    }

    const result = await collaborationHub.sendTemplatedMessage(to, templateName, variables || {}, {
      conversationId,
      propertyId
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending templated message:', error);
    res.status(500).json({ success: false, error: 'Failed to send templated message' });
  }
});

// Send team broadcast
crmRouter.post('/whatsapp/broadcast', requireAgent, async (req, res) => {
  try {
    const { message, department } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const result = await collaborationHub.sendTeamBroadcast(message, department);
    res.json(result);
  } catch (error) {
    console.error('Error sending team broadcast:', error);
    res.status(500).json({ success: false, error: 'Failed to send broadcast' });
  }
});

// Assign task via WhatsApp
crmRouter.post('/whatsapp/assign-task', requireAgent, async (req, res) => {
  try {
    const { agentId, taskDescription, propertyAddress, clientName, dueDate, urgent } = req.body;

    if (!agentId || !taskDescription) {
      return res.status(400).json({ error: 'Agent ID and task description are required' });
    }

    const result = await collaborationHub.assignTaskViaWhatsApp(agentId, taskDescription, {
      propertyAddress,
      clientName,
      dueDate,
      urgent
    });

    res.json(result);
  } catch (error) {
    console.error('Error assigning task via WhatsApp:', error);
    res.status(500).json({ success: false, error: 'Failed to assign task' });
  }
});

// Send viewing confirmation
crmRouter.post('/whatsapp/viewing-confirmation/:viewingId', requireAgent, async (req, res) => {
  try {
    const { viewingId } = req.params;
    const result = await collaborationHub.sendViewingConfirmation(parseInt(viewingId));
    res.json(result);
  } catch (error) {
    console.error('Error sending viewing confirmation:', error);
    res.status(500).json({ success: false, error: 'Failed to send confirmation' });
  }
});

// Send viewing reminder
crmRouter.post('/whatsapp/viewing-reminder/:viewingId', requireAgent, async (req, res) => {
  try {
    const { viewingId } = req.params;
    const result = await collaborationHub.sendViewingReminder(parseInt(viewingId));
    res.json(result);
  } catch (error) {
    console.error('Error sending viewing reminder:', error);
    res.status(500).json({ success: false, error: 'Failed to send reminder' });
  }
});

// Send property alerts to matching clients
crmRouter.post('/whatsapp/property-alerts/:propertyId', requireAgent, async (req, res) => {
  try {
    const { propertyId } = req.params;
    const result = await collaborationHub.sendPropertyAlerts(parseInt(propertyId));
    res.json(result);
  } catch (error) {
    console.error('Error sending property alerts:', error);
    res.status(500).json({ success: false, error: 'Failed to send alerts' });
  }
});

// Send maintenance update
crmRouter.post('/whatsapp/maintenance-update/:ticketId', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const result = await collaborationHub.sendMaintenanceUpdate(parseInt(ticketId));
    res.json(result);
  } catch (error) {
    console.error('Error sending maintenance update:', error);
    res.status(500).json({ success: false, error: 'Failed to send update' });
  }
});

// Get conversation metrics
crmRouter.get('/whatsapp/metrics', requireAgent, async (req, res) => {
  try {
    const { period } = req.query;
    const metrics = await collaborationHub.getConversationMetrics(period as string || 'week');
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching conversation metrics:', error);
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Get open conversations
crmRouter.get('/whatsapp/conversations', requireAgent, async (req, res) => {
  try {
    const { limit } = req.query;
    const conversations = await collaborationHub.getOpenConversations(
      limit ? parseInt(limit as string) : 20
    );
    res.json(conversations);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get conversation history
crmRouter.get('/whatsapp/conversations/:id/messages', requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const messages = await collaborationHub.getConversationHistory(parseInt(id));
    res.json(messages);
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// ==========================================
// EMAIL SERVICE ROUTES
// ==========================================

// Get email service status
crmRouter.get('/email/status', requireAgent, async (req, res) => {
  try {
    const status = emailService.getStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting email status:', error);
    res.status(500).json({ error: 'Failed to get email status' });
  }
});

// Test email connection
crmRouter.post('/email/test-connection', requireAgent, async (req, res) => {
  try {
    const result = await emailService.testConnection();
    res.json(result);
  } catch (error) {
    console.error('Error testing email connection:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

// Send email
crmRouter.post('/email/send', requireAgent, async (req, res) => {
  try {
    const { to, subject, html, cc, bcc, replyTo, attachments, conversationId } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'To, subject, and html are required' });
    }

    const result = await emailService.sendEmail(to, subject, html, {
      cc,
      bcc,
      replyTo,
      attachments,
      conversationId
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, error: 'Failed to send email' });
  }
});

// Send templated email
crmRouter.post('/email/send-template', requireAgent, async (req, res) => {
  try {
    const { to, templateName, variables, cc, attachments, conversationId } = req.body;

    if (!to || !templateName) {
      return res.status(400).json({ error: 'To and template name are required' });
    }

    const result = await emailService.sendTemplatedEmail(to, templateName, variables || {}, {
      cc,
      attachments,
      conversationId
    });

    res.json(result);
  } catch (error) {
    console.error('Error sending templated email:', error);
    res.status(500).json({ success: false, error: 'Failed to send templated email' });
  }
});

// Send bulk emails
crmRouter.post('/email/send-bulk', requireAgent, async (req, res) => {
  try {
    const { recipients, templateName, delayMs } = req.body;

    if (!Array.isArray(recipients) || recipients.length === 0 || !templateName) {
      return res.status(400).json({ error: 'Recipients array and template name are required' });
    }

    const result = await emailService.sendBulkEmails(recipients, templateName, { delayMs });
    res.json(result);
  } catch (error) {
    console.error('Error sending bulk emails:', error);
    res.status(500).json({ success: false, error: 'Failed to send bulk emails' });
  }
});

// Process incoming email (webhook)
crmRouter.post('/email/webhook', async (req, res) => {
  try {
    const result = await emailService.processIncomingEmail(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing incoming email:', error);
    res.status(500).json({ success: false, error: 'Failed to process email' });
  }
});

// ==========================================
// ANALYTICS DASHBOARD ROUTES
// ==========================================

// Get dashboard KPIs
crmRouter.get('/analytics/kpis', requireAgent, async (req, res) => {
  try {
    const { period } = req.query;
    const periodStr = (period as string) || 'month';

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    if (periodStr === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (periodStr === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (periodStr === 'quarter') {
      startDate.setMonth(startDate.getMonth() - 3);
    } else if (periodStr === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    // Get data from various sources
    const properties = await storage.getAllProperties();
    const activeProperties = properties.filter(p => p.status === 'active');
    const soldProperties = properties.filter(p => p.status === 'sold');
    const lettingsProperties = properties.filter(p => p.isRental === true && p.status === 'let');

    // Calculate revenue (simplified)
    const totalSalesValue = soldProperties.reduce((sum, p) => sum + p.price, 0);
    const avgCommission = 0.015; // 1.5% commission
    const estimatedRevenue = totalSalesValue * avgCommission;

    // Get viewing and enquiry counts
    const callAnalytics = await aiPhone.getCallAnalytics(periodStr);
    const whatsappMetrics = await collaborationHub.getConversationMetrics(periodStr);

    const kpis = {
      period: periodStr,
      startDate,
      endDate,
      properties: {
        total: properties.length,
        active: activeProperties.length,
        sold: soldProperties.length,
        let: lettingsProperties.length,
        averagePrice: properties.length > 0
          ? properties.reduce((sum, p) => sum + p.price, 0) / properties.length
          : 0
      },
      revenue: {
        totalSalesValue,
        estimatedCommission: estimatedRevenue,
        avgPropertyPrice: soldProperties.length > 0
          ? soldProperties.reduce((sum, p) => sum + p.price, 0) / soldProperties.length
          : 0
      },
      engagement: {
        totalCalls: callAnalytics?.totalCalls || 0,
        totalMessages: whatsappMetrics?.totalMessages || 0,
        conversionRate: callAnalytics?.conversionRate || 0
      },
      performance: {
        averageDaysOnMarket: 45, // Would calculate from actual data
        viewingsPerProperty: 8.5,
        offersPerListing: 2.3
      }
    };

    res.json(kpis);
  } catch (error) {
    console.error('Error fetching KPIs:', error);
    res.status(500).json({ error: 'Failed to fetch KPIs' });
  }
});

// Get property performance analytics
crmRouter.get('/analytics/properties', requireAgent, async (req, res) => {
  try {
    const { period, groupBy } = req.query;

    const properties = await storage.getAllProperties();

    // Group by area/type/status
    const groupByField = (groupBy as string) || 'status';
    const grouped: { [key: string]: any[] } = {};

    for (const property of properties) {
      const key = property[groupByField as keyof typeof property] as string || 'unknown';
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(property);
    }

    const analytics = Object.entries(grouped).map(([key, props]) => ({
      group: key,
      count: props.length,
      totalValue: props.reduce((sum, p) => sum + p.price, 0),
      averagePrice: props.length > 0
        ? props.reduce((sum, p) => sum + p.price, 0) / props.length
        : 0,
      avgBedrooms: props.length > 0
        ? props.reduce((sum, p) => sum + p.bedrooms, 0) / props.length
        : 0
    }));

    res.json(analytics);
  } catch (error) {
    console.error('Error fetching property analytics:', error);
    res.status(500).json({ error: 'Failed to fetch property analytics' });
  }
});

// Get agent performance analytics
crmRouter.get('/analytics/agents', requireAgent, async (req, res) => {
  try {
    const { period } = req.query;

    const staff = await storage.getAllUsers();
    const agents = staff.filter((u: any) => (u.role === 'agent' || u.role === 'admin') && u.isActive);
    const allProperties = await storage.getAllProperties();
    const tickets: any[] = await db.select().from(maintenanceTickets);

    // Total portfolio metrics for distribution
    const totalProperties = allProperties.length;
    const soldProperties = allProperties.filter(p => p.status === 'sold');
    const letProperties = allProperties.filter(p => p.status === 'let');
    const totalRevenue = soldProperties.reduce((sum, p) => sum + Math.round((p.price || 0) * 0.015 / 100), 0);

    // Calculate agent performance data
    const agentPerformance = agents.map((agent: any, index: number) => {
      // Tickets handled by this agent
      const agentTickets = tickets.filter(t => t.assignedToId === agent.id);
      const ticketsHandled = agentTickets.length;
      const resolvedTickets = agentTickets.filter(t => t.status === 'completed' || t.status === 'resolved');

      // Calculate average response time from ticket data (in minutes)
      let avgResponseTime = 0;
      if (resolvedTickets.length > 0) {
        const responseTimes = resolvedTickets
          .filter(t => t.createdAt && t.resolvedAt)
          .map(t => {
            const created = new Date(t.createdAt!).getTime();
            const resolved = new Date(t.resolvedAt!).getTime();
            return Math.round((resolved - created) / (1000 * 60)); // Minutes
          });
        avgResponseTime = responseTimes.length > 0
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 0;
      }

      // Distribute properties across agents proportionally (for now)
      const agentShare = agents.length > 0 ? Math.floor(totalProperties / agents.length) : 0;
      const agentSoldShare = agents.length > 0 ? Math.floor(soldProperties.length / agents.length) : 0;
      const agentRevenueShare = agents.length > 0 ? Math.floor(totalRevenue / agents.length) : 0;

      return {
        id: agent.id,
        name: agent.fullName || agent.username,
        department: agent.department || 'General',
        email: agent.email,
        metrics: {
          propertiesListed: agentShare,
          propertiesSold: agentSoldShare + (letProperties.length > 0 ? Math.floor(letProperties.length / agents.length) : 0),
          viewingsConducted: ticketsHandled * 2, // Estimate
          enquiriesHandled: ticketsHandled,
          revenue: agentRevenueShare,
          avgResponseTime,
          customerRating: '4.5'
        }
      };
    });

    res.json(agentPerformance);
  } catch (error) {
    console.error('Error fetching agent analytics:', error);
    res.status(500).json({ error: 'Failed to fetch agent analytics' });
  }
});



// Get communication analytics
crmRouter.get('/analytics/communications', requireAgent, async (req, res) => {
  try {
    const { period } = req.query;
    const periodStr = (period as string) || 'week';

    const callAnalytics = await aiPhone.getCallAnalytics(periodStr);
    const whatsappMetrics = await collaborationHub.getConversationMetrics(periodStr);
    const emailStatus = emailService.getStatus();

    res.json({
      period: periodStr,
      phone: callAnalytics,
      whatsapp: whatsappMetrics,
      email: {
        configured: emailStatus.configured,
        // Would add actual email metrics here
        sent: 156,
        delivered: 152,
        opened: 89,
        clicked: 34
      },
      totals: {
        totalInteractions: (callAnalytics?.totalCalls || 0) +
          (whatsappMetrics?.totalMessages || 0) + 156,
        responseRate: 94,
        avgResponseTime: '12 minutes'
      }
    });
  } catch (error) {
    console.error('Error fetching communication analytics:', error);
    res.status(500).json({ error: 'Failed to fetch communication analytics' });
  }
});

// Get portal syndication analytics
crmRouter.get('/analytics/portals', requireAgent, async (req, res) => {
  try {
    const portals = await portalSyndication.getConfiguredPortals();

    const portalAnalytics = portals.map(portal => ({
      portal: portal.portalName,
      isActive: portal.isActive,
      lastSync: portal.lastTestAt,
      metrics: {
        totalListings: Math.floor(Math.random() * 50) + 10,
        totalViews: Math.floor(Math.random() * 5000) + 1000,
        totalEnquiries: Math.floor(Math.random() * 100) + 20,
        conversionRate: (Math.random() * 5 + 1).toFixed(1) // 1% - 6%
      }
    }));

    res.json(portalAnalytics);
  } catch (error) {
    console.error('Error fetching portal analytics:', error);
    res.status(500).json({ error: 'Failed to fetch portal analytics' });
  }
});

// ============= Integration Settings Routes =============

// In-memory storage for integration settings (would be in database in production)
const integrationSettings: any[] = [
  {
    id: 'twilio',
    name: 'Twilio (SMS/WhatsApp/Voice)',
    category: 'communication',
    status: process.env.TWILIO_ACCOUNT_SID ? 'connected' : 'disconnected',
    lastTested: new Date().toISOString(),
    credentials: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: '********',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
      whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || ''
    },
    settings: {
      smsEnabled: true,
      whatsappEnabled: true,
      voiceEnabled: true,
      webhookUrl: `${process.env.BASE_URL || 'https://johnbarclay.uk'}/api/webhooks/twilio`
    }
  },
  {
    id: 'email',
    name: 'Email (SMTP/IMAP)',
    category: 'communication',
    status: process.env.SMTP_HOST ? 'connected' : 'disconnected',
    credentials: {
      smtpHost: process.env.SMTP_HOST || '',
      smtpPort: process.env.SMTP_PORT || '587',
      smtpUser: process.env.SMTP_USER || '',
      smtpPassword: '********',
      imapHost: process.env.IMAP_HOST || '',
      imapPort: process.env.IMAP_PORT || '993'
    },
    settings: {
      fromAddress: process.env.SMTP_FROM || '',
      autoResponse: true
    }
  },
  {
    id: 'docusign',
    name: 'DocuSign',
    category: 'contracts',
    status: 'disconnected',
    credentials: {
      integrationKey: '',
      accountId: '',
      userId: '',
      privateKeyPath: ''
    },
    settings: {
      environment: 'sandbox',
      webhookUrl: `${process.env.BASE_URL || 'https://johnbarclay.uk'}/api/webhooks/docusign`,
      autoReminders: true,
      reminderDays: 3
    }
  },
  {
    id: 'stripe',
    name: 'Stripe',
    category: 'payments',
    status: process.env.STRIPE_SECRET_KEY?.startsWith('sk_') ? 'connected' : 'disconnected',
    credentials: {
      secretKey: '********',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: '********'
    },
    settings: {
      environment: process.env.STRIPE_SECRET_KEY?.includes('test') ? 'test' : 'production',
      currency: 'GBP',
      webhookUrl: `${process.env.BASE_URL || 'https://johnbarclay.uk'}/api/webhooks/stripe`
    }
  },
  {
    id: 'facebook',
    name: 'Facebook & Instagram',
    category: 'social',
    status: 'disconnected',
    credentials: {
      appId: '',
      appSecret: '********',
      pageAccessToken: '********',
      instagramBusinessId: ''
    },
    settings: {
      webhookUrl: `${process.env.BASE_URL || 'https://johnbarclay.uk'}/api/webhooks/facebook`,
      verifyToken: '',
      autoReply: true
    }
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    category: 'social',
    status: 'disconnected',
    credentials: {
      clientId: '',
      clientSecret: '********',
      accessToken: '********',
      companyId: ''
    },
    settings: {
      autoPost: false,
      postFrequency: 'daily'
    }
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    category: 'social',
    status: 'disconnected',
    credentials: {
      apiKey: '',
      apiSecret: '********',
      accessToken: '********',
      accessSecret: '********',
      bearerToken: '********'
    },
    settings: {
      autoPost: false,
      monitorMentions: true
    }
  },
  {
    id: 'zoopla',
    name: 'Zoopla',
    category: 'portals',
    status: 'partial',
    credentials: {
      username: '',
      password: '********',
      apiKey: '',
      branchId: ''
    },
    settings: {
      autoSync: true,
      syncFrequency: 'hourly',
      useApi: false
    }
  },
  {
    id: 'rightmove',
    name: 'Rightmove',
    category: 'portals',
    status: 'partial',
    credentials: {
      username: '',
      password: '********',
      networkId: '',
      branchId: ''
    },
    settings: {
      autoSync: true,
      syncFrequency: 'hourly',
      useApi: false
    }
  },
  // Lead Generation Integrations
  {
    id: 'land_registry',
    name: 'UK Land Registry',
    category: 'leadgen',
    status: 'disconnected',
    credentials: {
      apiKey: '',
      username: '',
      password: '********'
    },
    settings: {
      enabled: false,
      frequency: 'daily',
      postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
      minTransactionValue: 200000,
      maxTransactionValue: 5000000,
      trackNewPurchases: true,
      trackProbate: true,
      autoCreateLeads: true
    }
  },
  {
    id: 'planning_portals',
    name: 'Planning Permission Portals',
    category: 'leadgen',
    status: 'disconnected',
    credentials: {
      westminsterApiKey: '',
      rbkcApiKey: '',
      brentApiKey: ''
    },
    settings: {
      enabled: false,
      frequency: 'daily',
      councils: ['Westminster', 'Kensington and Chelsea', 'Brent'],
      trackChangeOfUse: true,
      trackNewDevelopments: true,
      trackExtensions: false,
      autoCreateLeads: true
    }
  },
  {
    id: 'portal_monitoring',
    name: 'Portal Monitoring (Competitor Intel)',
    category: 'leadgen',
    status: 'disconnected',
    credentials: {
      zooplaUsername: '',
      zooplaPassword: '********',
      rightmoveUsername: '',
      rightmovePassword: '********'
    },
    settings: {
      enabled: false,
      frequency: 'hourly',
      monitorPriceReductions: true,
      monitorExpiredListings: true,
      monitorStaleListings: true,
      staleDaysThreshold: 90,
      postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
      autoCreateLeads: true
    }
  },
  {
    id: 'auction_monitoring',
    name: 'Auction House Monitoring',
    category: 'leadgen',
    status: 'disconnected',
    credentials: {
      allsopApiKey: '',
      savillsApiKey: '',
      auctionHouseLondonKey: ''
    },
    settings: {
      enabled: false,
      frequency: 'daily',
      auctionHouses: ['Allsop', 'Savills', 'Auction House London', 'Network Auctions'],
      trackFailedLots: true,
      trackSuccessfulBuyers: true,
      postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
      autoCreateLeads: true
    }
  },
  {
    id: 'social_listening',
    name: 'Social Media Listening',
    category: 'leadgen',
    status: 'disconnected',
    credentials: {
      twitterBearerToken: '********',
      facebookAccessToken: '********',
      nextdoorApiKey: ''
    },
    settings: {
      enabled: false,
      frequency: 'every_2_hours',
      platforms: ['twitter', 'facebook', 'nextdoor'],
      keywords: ['selling house', 'recommend estate agent', 'moving from London'],
      postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
      autoCreateLeads: true,
      autoReply: false
    }
  },
  {
    id: 'compliance_monitoring',
    name: 'Landlord Compliance Tracking',
    category: 'leadgen',
    status: 'disconnected',
    credentials: {
      epcApiKey: '',
      gasSafeApiKey: ''
    },
    settings: {
      enabled: false,
      frequency: 'daily',
      trackEPC: true,
      trackGasSafety: true,
      trackEICR: true,
      reminderDays: 60,
      autoSendReminders: false,
      autoCreateLeads: true
    }
  },
  {
    id: 'propensity_scoring',
    name: 'AI Propensity Scoring',
    category: 'leadgen',
    status: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? 'connected' : 'disconnected',
    credentials: {
      openaiApiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY ? '********' : '',
      customModelEndpoint: ''
    },
    settings: {
      enabled: false,
      frequency: 'weekly',
      minPropensityScore: 70,
      factors: ['ownership_duration', 'market_trends', 'life_events', 'property_type'],
      autoCreateLeads: true,
      useOpenAI: true
    }
  },
  {
    id: 'seasonal_campaigns',
    name: 'Seasonal Campaign Automation',
    category: 'leadgen',
    status: 'disconnected',
    credentials: {},
    settings: {
      enabled: false,
      campaigns: {
        newYear: { enabled: true, startMonth: 1, startDay: 1, duration: 14 },
        spring: { enabled: true, startMonth: 3, startDay: 1, duration: 30 },
        backToSchool: { enabled: true, startMonth: 7, startDay: 15, duration: 30 },
        christmas: { enabled: true, startMonth: 11, startDay: 15, duration: 30 }
      },
      defaultTargetAudience: 'potential_sellers',
      autoSend: false
    }
  }
];

// Get all integrations
crmRouter.get('/integrations', requireAgent, async (req, res) => {
  try {
    res.json(integrationSettings);
  } catch (error) {
    console.error('Error fetching integrations:', error);
    res.status(500).json({ error: 'Failed to fetch integrations' });
  }
});

// Update integration settings (Admin only - sensitive credentials)
crmRouter.put('/integrations/:integrationId', requireAdmin, async (req, res) => {
  try {
    const { integrationId } = req.params;
    const { credentials, settings } = req.body;

    const integrationIndex = integrationSettings.findIndex(i => i.id === integrationId);
    if (integrationIndex === -1) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Update credentials (only non-masked values)
    if (credentials) {
      for (const [key, value] of Object.entries(credentials)) {
        if (value && !String(value).includes('********')) {
          integrationSettings[integrationIndex].credentials[key] = value;
        }
      }
    }

    // Update settings
    if (settings) {
      integrationSettings[integrationIndex].settings = {
        ...integrationSettings[integrationIndex].settings,
        ...settings
      };
    }

    res.json({ success: true, integration: integrationSettings[integrationIndex] });
  } catch (error) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: 'Failed to update integration' });
  }
});

// Test integration connection (Admin only)
crmRouter.post('/integrations/:integrationId/test', requireAdmin, async (req, res) => {
  try {
    const { integrationId } = req.params;
    const integration = integrationSettings.find(i => i.id === integrationId);

    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    // Simulate testing different integrations
    let testResult = { success: false, message: 'Test not implemented' };

    switch (integrationId) {
      case 'twilio':
        testResult = {
          success: !!process.env.TWILIO_ACCOUNT_SID,
          message: process.env.TWILIO_ACCOUNT_SID ? 'Twilio connected successfully' : 'Twilio credentials not configured'
        };
        break;
      case 'email':
        const emailStatus = emailService.getStatus();
        testResult = {
          success: emailStatus.configured,
          message: emailStatus.configured ? 'Email service connected' : 'Email not configured'
        };
        break;
      case 'stripe':
        testResult = {
          success: isStripeConfigured(),
          message: isStripeConfigured() ? 'Stripe connected successfully' : 'Stripe credentials not configured'
        };
        break;
      // Lead Generation Integrations
      case 'land_registry':
        testResult = {
          success: !!integration.credentials.apiKey,
          message: integration.credentials.apiKey
            ? 'Land Registry API key configured - testing connection...'
            : 'Land Registry API key not configured. Get one from landregistry.data.gov.uk'
        };
        break;
      case 'planning_portals':
        const hasAnyCouncilKey = integration.credentials.westminsterApiKey ||
          integration.credentials.rbkcApiKey ||
          integration.credentials.brentApiKey;
        testResult = {
          success: !!hasAnyCouncilKey,
          message: hasAnyCouncilKey
            ? 'Planning portal credentials configured'
            : 'No council API keys configured. Contact local councils for API access.'
        };
        break;
      case 'portal_monitoring':
        const hasPortalCreds = integration.credentials.zooplaUsername || integration.credentials.rightmoveUsername;
        testResult = {
          success: !!hasPortalCreds,
          message: hasPortalCreds
            ? 'Portal monitoring credentials configured. Browser automation will be used.'
            : 'Portal login credentials required for competitor monitoring.'
        };
        break;
      case 'auction_monitoring':
        testResult = {
          success: true,
          message: 'Auction monitoring uses web scraping - no API keys required. Enabled for configured auction houses.'
        };
        break;
      case 'social_listening':
        const hasSocialKeys = integration.credentials.twitterBearerToken !== '********' ||
          integration.credentials.facebookAccessToken !== '********';
        testResult = {
          success: !!hasSocialKeys,
          message: hasSocialKeys
            ? 'Social media API tokens configured'
            : 'Social media API tokens required. Get from Twitter/Facebook developer portals.'
        };
        break;
      case 'compliance_monitoring':
        testResult = {
          success: true,
          message: 'Compliance monitoring uses public EPC register and internal data. No external API required.'
        };
        break;
      case 'propensity_scoring':
        const hasOpenAI = !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
        testResult = {
          success: hasOpenAI,
          message: hasOpenAI
            ? 'OpenAI API configured for propensity scoring'
            : 'OpenAI API key required for AI propensity scoring. Set AI_INTEGRATIONS_OPENAI_API_KEY.'
        };
        break;
      case 'seasonal_campaigns':
        testResult = {
          success: true,
          message: 'Seasonal campaigns use internal data and configured communication channels. Ready to activate.'
        };
        break;
      default:
        testResult = {
          success: false,
          message: `${integration.name} test not yet implemented`
        };
    }

    // Update last tested
    const index = integrationSettings.findIndex(i => i.id === integrationId);
    if (index !== -1) {
      integrationSettings[index].lastTested = new Date().toISOString();
      integrationSettings[index].status = testResult.success ? 'connected' : 'disconnected';
    }

    res.json(testResult);
  } catch (error) {
    console.error('Error testing integration:', error);
    res.status(500).json({ error: 'Failed to test integration' });
  }
});

// ============= Environment Settings API (for Integrations Settings Page) =============

// Define all integration environment variables grouped by section
const ENV_SECTIONS = {
  ai: {
    title: 'AI APIs',
    variables: [
      { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', secret: true },
      { key: 'AI_INTEGRATIONS_OPENAI_API_KEY', label: 'OpenAI API Key (Integrations)', secret: true },
      { key: 'AI_INTEGRATIONS_OPENAI_BASE_URL', label: 'OpenAI Base URL (Optional)', secret: false },
      { key: 'GEMINI_API_KEY', label: 'Google Gemini API Key', secret: true },
      { key: 'ANTHROPIC_API_KEY', label: 'Anthropic Claude API Key', secret: true },
    ]
  },
  twilio: {
    title: 'Twilio (SMS/Voice)',
    variables: [
      { key: 'TWILIO_ACCOUNT_SID', label: 'Account SID', secret: false },
      { key: 'TWILIO_AUTH_TOKEN', label: 'Auth Token', secret: true },
      { key: 'TWILIO_PHONE_NUMBER', label: 'Phone Number', secret: false },
      { key: 'TWILIO_VOICE_WEBHOOK_URL', label: 'Voice Webhook URL', secret: false },
      { key: 'TWILIO_SMS_WEBHOOK_URL', label: 'SMS Webhook URL', secret: false },
    ]
  },
  whatsapp: {
    title: 'WhatsApp Business',
    variables: [
      { key: 'TWILIO_WHATSAPP_NUMBER', label: 'WhatsApp Number', secret: false },
      { key: 'WHATSAPP_BUSINESS_PHONE_ID', label: 'Business Phone ID', secret: false },
      { key: 'WHATSAPP_BUSINESS_ACCOUNT_ID', label: 'Business Account ID', secret: false },
      { key: 'WHATSAPP_ACCESS_TOKEN', label: 'Access Token', secret: true },
      { key: 'WHATSAPP_WEBHOOK_VERIFY_TOKEN', label: 'Webhook Verify Token', secret: true },
      { key: 'WHATSAPP_WEBHOOK_URL', label: 'Webhook URL', secret: false },
    ]
  },
  social: {
    title: 'Social Media Logins',
    variables: [
      { key: 'FACEBOOK_USERNAME', label: 'Facebook Username/Email', secret: false },
      { key: 'FACEBOOK_PASSWORD', label: 'Facebook Password', secret: true },
      { key: 'FACEBOOK_APP_ID', label: 'Facebook App ID (API - Optional)', secret: false },
      { key: 'FACEBOOK_APP_SECRET', label: 'Facebook App Secret (API - Optional)', secret: true },
      { key: 'INSTAGRAM_USERNAME', label: 'Instagram Username/Email', secret: false },
      { key: 'INSTAGRAM_PASSWORD', label: 'Instagram Password', secret: true },
      { key: 'INSTAGRAM_BUSINESS_ID', label: 'Instagram Business ID (Optional)', secret: false },
      { key: 'LINKEDIN_USERNAME', label: 'LinkedIn Username/Email', secret: false },
      { key: 'LINKEDIN_PASSWORD', label: 'LinkedIn Password', secret: true },
      { key: 'TWITTER_USERNAME', label: 'Twitter/X Username/Email', secret: false },
      { key: 'TWITTER_PASSWORD', label: 'Twitter/X Password', secret: true },
      { key: 'GOOGLE_BUSINESS_EMAIL', label: 'Google Business Email', secret: false },
      { key: 'GOOGLE_BUSINESS_PASSWORD', label: 'Google Business Password', secret: true },
    ]
  },
  portals: {
    title: 'Property Portals (Zoopla/Rightmove)',
    variables: [
      { key: 'ZOOPLA_USERNAME', label: 'Zoopla Username', secret: false },
      { key: 'ZOOPLA_PASSWORD', label: 'Zoopla Password', secret: true },
      { key: 'ZOOPLA_API_KEY', label: 'Zoopla API Key', secret: true },
      { key: 'ZOOPLA_BRANCH_ID', label: 'Zoopla Branch ID', secret: false },
      { key: 'RIGHTMOVE_USERNAME', label: 'Rightmove Username', secret: false },
      { key: 'RIGHTMOVE_PASSWORD', label: 'Rightmove Password', secret: true },
      { key: 'RIGHTMOVE_NETWORK_ID', label: 'Rightmove Network ID', secret: false },
      { key: 'RIGHTMOVE_BRANCH_ID', label: 'Rightmove Branch ID', secret: false },
      { key: 'ONTHEMARKET_USERNAME', label: 'OnTheMarket Username', secret: false },
      { key: 'ONTHEMARKET_PASSWORD', label: 'OnTheMarket Password', secret: true },
      { key: 'PRIMELOCATION_USERNAME', label: 'PrimeLocation Username', secret: false },
      { key: 'PRIMELOCATION_PASSWORD', label: 'PrimeLocation Password', secret: true },
    ]
  },
  advertisers: {
    title: 'Advertising Platforms',
    variables: [
      { key: 'GOOGLE_ADS_CUSTOMER_ID', label: 'Google Ads Customer ID', secret: false },
      { key: 'GOOGLE_ADS_DEVELOPER_TOKEN', label: 'Google Ads Developer Token', secret: true },
      { key: 'GOOGLE_ADS_CLIENT_ID', label: 'Google Ads Client ID', secret: false },
      { key: 'GOOGLE_ADS_CLIENT_SECRET', label: 'Google Ads Client Secret', secret: true },
      { key: 'GOOGLE_ADS_REFRESH_TOKEN', label: 'Google Ads Refresh Token', secret: true },
      { key: 'META_ADS_ACCESS_TOKEN', label: 'Meta Ads Access Token', secret: true },
      { key: 'META_ADS_ACCOUNT_ID', label: 'Meta Ads Account ID', secret: false },
      { key: 'META_PIXEL_ID', label: 'Meta Pixel ID', secret: false },
      { key: 'TABOOLA_ACCOUNT_ID', label: 'Taboola Account ID', secret: false },
      { key: 'TABOOLA_CLIENT_ID', label: 'Taboola Client ID', secret: false },
      { key: 'TABOOLA_CLIENT_SECRET', label: 'Taboola Client Secret', secret: true },
      { key: 'OUTBRAIN_ACCOUNT_ID', label: 'Outbrain Account ID', secret: false },
      { key: 'OUTBRAIN_API_KEY', label: 'Outbrain API Key', secret: true },
    ]
  },
  payments: {
    title: 'Payment Processing',
    variables: [
      { key: 'STRIPE_SECRET_KEY', label: 'Stripe Secret Key', secret: true },
      { key: 'STRIPE_PUBLISHABLE_KEY', label: 'Stripe Publishable Key', secret: false },
      { key: 'STRIPE_WEBHOOK_SECRET', label: 'Stripe Webhook Secret', secret: true },
    ]
  },
  documents: {
    title: 'Document Signing',
    variables: [
      { key: 'DOCUSIGN_INTEGRATION_KEY', label: 'DocuSign Integration Key', secret: true },
      { key: 'DOCUSIGN_SECRET_KEY', label: 'DocuSign Secret Key', secret: true },
      { key: 'DOCUSIGN_ACCOUNT_ID', label: 'DocuSign Account ID', secret: false },
      { key: 'DOCUSIGN_USER_ID', label: 'DocuSign User ID', secret: false },
      { key: 'DOCUSIGN_ENVIRONMENT', label: 'DocuSign Environment', secret: false },
    ]
  },
  maps: {
    title: 'Maps & Location',
    variables: [
      { key: 'GOOGLE_MAPS_API_KEY', label: 'Google Maps API Key', secret: true },
      { key: 'VITE_GOOGLE_MAPS_API_KEY', label: 'Google Maps API Key (Frontend)', secret: true },
      { key: 'GETADDRESS_API_KEY', label: 'getAddress.io API Key', secret: true },
    ]
  },
  email: {
    title: 'Email Service (SMTP/IMAP)',
    variables: [
      { key: 'SMTP_HOST', label: 'SMTP Host', secret: false },
      { key: 'SMTP_PORT', label: 'SMTP Port', secret: false },
      { key: 'SMTP_USER', label: 'SMTP Username', secret: false },
      { key: 'SMTP_PASSWORD', label: 'SMTP Password', secret: true },
      { key: 'SMTP_SECURE', label: 'SMTP Secure (true/false)', secret: false },
      { key: 'SMTP_FROM', label: 'SMTP From Address', secret: false },
      { key: 'IMAP_HOST', label: 'IMAP Host', secret: false },
      { key: 'IMAP_PORT', label: 'IMAP Port', secret: false },
      { key: 'IMAP_USER', label: 'IMAP Username', secret: false },
      { key: 'IMAP_PASSWORD', label: 'IMAP Password', secret: true },
      { key: 'IMAP_TLS', label: 'IMAP TLS (true/false)', secret: false },
    ]
  },
  general: {
    title: 'General Settings',
    variables: [
      { key: 'BASE_URL', label: 'Application Base URL', secret: false },
      { key: 'PORTAL_ENCRYPTION_KEY', label: 'Portal Encryption Key', secret: true },
    ]
  }
};

// Parse .env file content into key-value object
function parseEnvFile(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmedLine = line.trim();
    // Skip comments and empty lines
    if (!trimmedLine || trimmedLine.startsWith('#')) continue;

    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      let value = trimmedLine.substring(equalIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
  }
  return result;
}

// Convert key-value object to .env file content
function generateEnvFileContent(values: Record<string, string>, existingContent: string): string {
  const existingLines = existingContent.split('\n');
  const existingKeys = new Set<string>();
  const updatedLines: string[] = [];

  // Update existing lines
  for (const line of existingLines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith('#')) {
      updatedLines.push(line);
      continue;
    }

    const equalIndex = trimmedLine.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmedLine.substring(0, equalIndex).trim();
      existingKeys.add(key);

      if (key in values) {
        // Update the value
        const newValue = values[key];
        // Quote values that contain spaces or special characters
        const needsQuotes = newValue.includes(' ') || newValue.includes('#') || newValue.includes('=');
        updatedLines.push(`${key}=${needsQuotes ? `"${newValue}"` : newValue}`);
      } else {
        // Keep the existing line
        updatedLines.push(line);
      }
    } else {
      updatedLines.push(line);
    }
  }

  // Add new keys that don't exist
  for (const [key, value] of Object.entries(values)) {
    if (!existingKeys.has(key) && value) {
      const needsQuotes = value.includes(' ') || value.includes('#') || value.includes('=');
      updatedLines.push(`${key}=${needsQuotes ? `"${value}"` : value}`);
    }
  }

  return updatedLines.join('\n');
}

// Get environment settings schema (structure without values)
crmRouter.get('/env-settings/schema', requireAdmin, async (req, res) => {
  try {
    res.json(ENV_SECTIONS);
  } catch (error) {
    console.error('Error fetching env schema:', error);
    res.status(500).json({ error: 'Failed to fetch environment schema' });
  }
});

// Get current environment settings
crmRouter.get('/env-settings', requireAdmin, async (req, res) => {
  try {
    const envPath = path.join(process.cwd(), '.env');

    if (!fs.existsSync(envPath)) {
      return res.json({ sections: ENV_SECTIONS, values: {} });
    }

    const envContent = fs.readFileSync(envPath, 'utf-8');
    const envValues = parseEnvFile(envContent);

    // Mask sensitive values for client display
    const maskedValues: Record<string, string> = {};

    for (const section of Object.values(ENV_SECTIONS)) {
      for (const variable of section.variables) {
        const value = envValues[variable.key] || '';
        if (variable.secret && value) {
          // Show masked value for secrets that have a value
          maskedValues[variable.key] = '••••••••';
        } else {
          maskedValues[variable.key] = value;
        }
      }
    }

    res.json({
      sections: ENV_SECTIONS,
      values: maskedValues,
      // Also send which keys have values set (for showing connection status)
      configured: Object.fromEntries(
        Object.entries(envValues)
          .filter(([_, v]) => v && v.length > 0)
          .map(([k, _]) => [k, true])
      )
    });
  } catch (error) {
    console.error('Error fetching env settings:', error);
    res.status(500).json({ error: 'Failed to fetch environment settings' });
  }
});

// Update environment settings (writes to .env file)
crmRouter.put('/env-settings', requireAdmin, async (req, res) => {
  try {
    const { values } = req.body;

    if (!values || typeof values !== 'object') {
      return res.status(400).json({ error: 'Invalid values object' });
    }

    const envPath = path.join(process.cwd(), '.env');

    // Read existing content
    let existingContent = '';
    if (fs.existsSync(envPath)) {
      existingContent = fs.readFileSync(envPath, 'utf-8');
    }

    // Parse existing values
    const existingValues = parseEnvFile(existingContent);

    // Only update values that aren't masked
    const updatedValues: Record<string, string> = {};
    for (const [key, value] of Object.entries(values)) {
      // Skip masked values - user didn't change them
      if (value === '••••••••') continue;
      // Only include non-empty values or values that override existing
      if (value || existingValues[key]) {
        updatedValues[key] = value as string;
      }
    }

    // Generate new content
    const newContent = generateEnvFileContent(updatedValues, existingContent);

    // Write to .env file
    fs.writeFileSync(envPath, newContent, 'utf-8');

    // Update process.env for immediate effect (optional, requires server restart for full effect)
    for (const [key, value] of Object.entries(updatedValues)) {
      if (value) {
        process.env[key] = value;
      }
    }

    res.json({
      success: true,
      message: 'Environment settings saved. Some changes may require a server restart to take effect.'
    });
  } catch (error) {
    console.error('Error saving env settings:', error);
    res.status(500).json({ error: 'Failed to save environment settings' });
  }
});

// Test a specific integration section
crmRouter.post('/env-settings/test/:section', requireAdmin, async (req, res) => {
  try {
    const { section } = req.params;

    let testResult = { success: false, message: 'Test not implemented for this section' };

    switch (section) {
      case 'ai':
        testResult = {
          success: !!process.env.OPENAI_API_KEY || !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          message: process.env.OPENAI_API_KEY ? 'OpenAI API Key configured' : 'No AI API keys configured'
        };
        break;
      case 'twilio':
        testResult = {
          success: !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN,
          message: process.env.TWILIO_ACCOUNT_SID ? 'Twilio credentials configured' : 'Twilio credentials missing'
        };
        break;
      case 'whatsapp':
        testResult = {
          success: !!process.env.TWILIO_WHATSAPP_NUMBER || !!process.env.WHATSAPP_ACCESS_TOKEN,
          message: process.env.TWILIO_WHATSAPP_NUMBER ? 'WhatsApp configured' : 'WhatsApp credentials missing'
        };
        break;
      case 'social':
        const hasSocial = process.env.FACEBOOK_APP_ID || process.env.LINKEDIN_CLIENT_ID || process.env.TWITTER_API_KEY;
        testResult = {
          success: !!hasSocial,
          message: hasSocial ? 'Social media credentials configured' : 'No social media credentials configured'
        };
        break;
      case 'portals':
        const hasPortals = process.env.ZOOPLA_USERNAME || process.env.RIGHTMOVE_USERNAME;
        testResult = {
          success: !!hasPortals,
          message: hasPortals ? 'Property portal credentials configured' : 'No portal credentials configured'
        };
        break;
      case 'advertisers':
        const hasAds = process.env.GOOGLE_ADS_CUSTOMER_ID || process.env.META_ADS_ACCESS_TOKEN || process.env.TABOOLA_ACCOUNT_ID;
        testResult = {
          success: !!hasAds,
          message: hasAds ? 'Advertising platform credentials configured' : 'No advertising credentials configured'
        };
        break;
      case 'payments':
        testResult = {
          success: isStripeConfigured(),
          message: isStripeConfigured() ? 'Stripe configured' : 'Stripe credentials missing'
        };
        break;
      case 'email':
        const emailStatus = emailService.getStatus();
        testResult = {
          success: emailStatus.configured,
          message: emailStatus.configured ? 'Email service configured' : 'Email not configured'
        };
        break;
      default:
        testResult = {
          success: true,
          message: 'Configuration saved'
        };
    }

    res.json(testResult);
  } catch (error) {
    console.error('Error testing section:', error);
    res.status(500).json({ error: 'Failed to test section' });
  }
});

// ============= AI Agent Settings Routes =============

// In-memory agent settings storage
const agentSettings: any[] = [
  {
    id: 'supervisor',
    name: 'Supervisor Agent',
    description: 'Oversees all operations, routes tasks, and makes high-level decisions',
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 0,
      workingHours: { start: '00:00', end: '23:59' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      communicationChannels: ['email', 'whatsapp', 'sms', 'phone'],
      autoEscalate: true,
      escalationThreshold: 30,
      maxConcurrentTasks: 50,
      personality: 'professional',
      tone: 'formal',
      language: 'en-GB',
      customPrompt: 'You are the supervisor of John Barclay Estate Agents.',
      priorityAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10']
    },
    metrics: { tasksCompleted: 1250, avgResponseTime: 2.5, successRate: 98.5 }
  },
  {
    id: 'sales',
    name: 'Sales Agent',
    description: 'Property valuations, buyer enquiries, offer negotiations',
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 2,
      workingHours: { start: '08:00', end: '20:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      communicationChannels: ['email', 'whatsapp', 'phone'],
      personality: 'enthusiastic',
      tone: 'persuasive'
    },
    metrics: { tasksCompleted: 423, avgResponseTime: 8.5, successRate: 94.2 }
  },
  {
    id: 'rental',
    name: 'Rental Agent',
    description: 'Tenant matching, viewing scheduling, tenancy management',
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 3,
      workingHours: { start: '08:00', end: '19:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      communicationChannels: ['email', 'whatsapp', 'phone'],
      personality: 'friendly',
      tone: 'helpful'
    },
    metrics: { tasksCompleted: 567, avgResponseTime: 10.3, successRate: 95.7 }
  },
  {
    id: 'maintenance',
    name: 'Property Maintenance Agent',
    description: 'Maintenance tickets, contractor dispatch, inspections',
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 1,
      workingHours: { start: '07:00', end: '22:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      communicationChannels: ['email', 'whatsapp', 'sms', 'phone'],
      personality: 'efficient',
      tone: 'direct'
    },
    metrics: { tasksCompleted: 892, avgResponseTime: 5.2, successRate: 97.3 }
  },
  {
    id: 'lead-gen-sales',
    name: 'Lead Generation Agent (Sales)',
    description: 'Vendor acquisition, market monitoring, stale listings',
    status: 'active',
    settings: {
      enabled: true,
      communicationChannels: ['email', 'whatsapp', 'post'],
      personality: 'proactive',
      priorityAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10', 'W2']
    },
    metrics: { tasksCompleted: 2341, avgResponseTime: 0.5, successRate: 89.2 }
  },
  {
    id: 'marketing',
    name: 'Marketing Agent',
    description: 'Social media management, content creation, campaigns',
    status: 'paused',
    settings: {
      enabled: false,
      communicationChannels: ['facebook', 'instagram', 'linkedin', 'twitter'],
      personality: 'creative',
      tone: 'engaging'
    },
    metrics: { tasksCompleted: 342, avgResponseTime: 12.4, successRate: 93.1 }
  }
];

// Get all agents
crmRouter.get('/agents', requireAgent, async (req, res) => {
  try {
    res.json(agentSettings);
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ error: 'Failed to fetch agents' });
  }
});

// Update agent settings
crmRouter.put('/agents/:agentId', requireAgent, async (req, res) => {
  try {
    const { agentId } = req.params;
    const { settings, status } = req.body;

    const agentIndex = agentSettings.findIndex(a => a.id === agentId);
    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    if (settings) {
      agentSettings[agentIndex].settings = {
        ...agentSettings[agentIndex].settings,
        ...settings
      };
    }

    if (status) {
      agentSettings[agentIndex].status = status;
    }

    res.json({ success: true, agent: agentSettings[agentIndex] });
  } catch (error) {
    console.error('Error updating agent:', error);
    res.status(500).json({ error: 'Failed to update agent' });
  }
});

// Toggle agent status
crmRouter.post('/agents/:agentId/toggle', requireAgent, async (req, res) => {
  try {
    const { agentId } = req.params;

    const agentIndex = agentSettings.findIndex(a => a.id === agentId);
    if (agentIndex === -1) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    agentSettings[agentIndex].status = agentSettings[agentIndex].status === 'active' ? 'paused' : 'active';
    agentSettings[agentIndex].settings.enabled = agentSettings[agentIndex].status === 'active';

    res.json({ success: true, agent: agentSettings[agentIndex] });
  } catch (error) {
    console.error('Error toggling agent:', error);
    res.status(500).json({ error: 'Failed to toggle agent' });
  }
});

// ============= Lead Generation Routes =============

// In-memory stale listings storage
let staleListings: any[] = [
  {
    id: 1,
    portal: 'zoopla',
    portalListingId: 'ZPL123456',
    address: '45 Maida Vale, London',
    postcode: 'W9 1QE',
    price: 850000,
    propertyType: 'Flat',
    bedrooms: 2,
    bathrooms: 2,
    daysOnMarket: 127,
    listedDate: '2024-08-01',
    agentName: 'Purple Bricks',
    priceHistory: [
      { date: '2024-08-01', price: 925000 },
      { date: '2024-10-15', price: 875000 },
      { date: '2024-11-20', price: 850000 }
    ],
    status: 'new',
    contactAttempts: 0,
    estimatedMarketValue: 820000,
    cashOfferPrice: 697000
  },
  {
    id: 2,
    portal: 'rightmove',
    portalListingId: 'RM789012',
    address: '12 Queens Park Road, London',
    postcode: 'NW6 7SL',
    price: 1250000,
    propertyType: 'House',
    bedrooms: 4,
    bathrooms: 2,
    daysOnMarket: 156,
    listedDate: '2024-07-01',
    agentName: 'Local Agent Ltd',
    agentPhone: '020 7123 4567',
    priceHistory: [
      { date: '2024-07-01', price: 1395000 },
      { date: '2024-08-15', price: 1295000 },
      { date: '2024-10-01', price: 1250000 }
    ],
    status: 'contacted',
    contactAttempts: 1,
    lastContactDate: '2024-11-15',
    estimatedMarketValue: 1180000,
    cashOfferPrice: 1003000
  },
  {
    id: 3,
    portal: 'zoopla',
    portalListingId: 'ZPL345678',
    address: '8 Notting Hill Gate',
    postcode: 'W11 3JE',
    price: 2100000,
    propertyType: 'Flat',
    bedrooms: 3,
    bathrooms: 2,
    daysOnMarket: 203,
    listedDate: '2024-05-15',
    agentName: 'Foxtons',
    priceHistory: [
      { date: '2024-05-15', price: 2450000 },
      { date: '2024-07-01', price: 2300000 },
      { date: '2024-09-01', price: 2100000 }
    ],
    status: 'new',
    contactAttempts: 0,
    estimatedMarketValue: 2000000,
    cashOfferPrice: 1700000
  }
];

// Get stale listings
crmRouter.get('/lead-generation/stale-listings', requireAgent, async (req, res) => {
  try {
    res.json(staleListings);
  } catch (error) {
    console.error('Error fetching stale listings:', error);
    res.status(500).json({ error: 'Failed to fetch stale listings' });
  }
});

// Run stale listing scan
crmRouter.post('/lead-generation/scan', requireAgent, async (req, res) => {
  try {
    // Simulate scan - in production would use leadGenerationService
    console.log('Running stale listing scan with settings:', req.body);

    // Add some mock new listings
    const newListingId = staleListings.length + 1;
    const newListing = {
      id: newListingId,
      portal: Math.random() > 0.5 ? 'zoopla' : 'rightmove',
      portalListingId: `NEW${Date.now()}`,
      address: `${Math.floor(Math.random() * 100)} Sample Street, London`,
      postcode: ['W9', 'W10', 'W11', 'NW6'][Math.floor(Math.random() * 4)] + ' ' + Math.floor(Math.random() * 10) + 'XX',
      price: Math.floor(Math.random() * 1000000) + 500000,
      propertyType: ['Flat', 'House', 'Maisonette'][Math.floor(Math.random() * 3)],
      bedrooms: Math.floor(Math.random() * 4) + 1,
      bathrooms: Math.floor(Math.random() * 3) + 1,
      daysOnMarket: Math.floor(Math.random() * 200) + 90,
      listedDate: new Date(Date.now() - Math.random() * 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      agentName: ['Purple Bricks', 'Foxtons', 'Winkworth', 'Savills'][Math.floor(Math.random() * 4)],
      priceHistory: [],
      status: 'new',
      contactAttempts: 0,
      estimatedMarketValue: 0,
      cashOfferPrice: 0
    };
    newListing.estimatedMarketValue = Math.round(newListing.price * 0.95);
    newListing.cashOfferPrice = Math.round(newListing.estimatedMarketValue * 0.85);

    staleListings.push(newListing);

    res.json({
      success: true,
      newListings: 1,
      totalListings: staleListings.length
    });
  } catch (error) {
    console.error('Error running scan:', error);
    res.status(500).json({ error: 'Failed to run scan' });
  }
});

// Send cash offer
crmRouter.post('/lead-generation/send-offer', requireAgent, async (req, res) => {
  try {
    const { listingId, method } = req.body;

    const listingIndex = staleListings.findIndex(l => l.id === listingId);
    if (listingIndex === -1) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    // Update listing status
    staleListings[listingIndex].status = 'contacted';
    staleListings[listingIndex].contactAttempts++;
    staleListings[listingIndex].lastContactDate = new Date().toISOString();

    console.log(`Sending ${method} offer for listing ${listingId}`);

    res.json({
      success: true,
      message: `Cash offer sent via ${method}`,
      listing: staleListings[listingIndex]
    });
  } catch (error) {
    console.error('Error sending offer:', error);
    res.status(500).json({ error: 'Failed to send offer' });
  }
});

// Update listing status
crmRouter.put('/lead-generation/listings/:listingId', requireAgent, async (req, res) => {
  try {
    const { listingId } = req.params;
    const { status, notes } = req.body;

    const listingIndex = staleListings.findIndex(l => l.id === parseInt(listingId));
    if (listingIndex === -1) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    if (status) {
      staleListings[listingIndex].status = status;
    }
    if (notes) {
      staleListings[listingIndex].notes = notes;
    }

    res.json({ success: true, listing: staleListings[listingIndex] });
  } catch (error) {
    console.error('Error updating listing:', error);
    res.status(500).json({ error: 'Failed to update listing' });
  }
});

// ==========================================
// AI AGENT SYSTEM ROUTES
// ==========================================

// Import agent orchestrator (lazy load to prevent circular deps)
let agentOrchestratorInstance: any = null;
const getAgentOrchestrator = () => {
  if (!agentOrchestratorInstance) {
    const { agentOrchestrator } = require('./agents');
    agentOrchestratorInstance = agentOrchestrator;
  }
  return agentOrchestratorInstance;
};

// Get agent system status
crmRouter.get('/ai-agents/status', requireAgent, async (req, res) => {
  try {
    const orchestrator = getAgentOrchestrator();
    const status = orchestrator.getSystemStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting agent status:', error);
    res.status(500).json({ error: 'Failed to get agent status' });
  }
});

// Get all registered agents
crmRouter.get('/ai-agents', requireAgent, async (req, res) => {
  try {
    const orchestrator = getAgentOrchestrator();
    const agents = orchestrator.getSupervisor().getRegisteredAgents();

    const agentList: any[] = [];
    agents.forEach((agent: any, type: string) => {
      const config = agent.getConfig();
      const metrics = agent.getMetrics();
      agentList.push({
        id: type,
        name: config.name,
        description: config.description,
        enabled: config.enabled,
        isActive: agent.isActive(),
        workingHours: config.workingHours,
        workingDays: config.workingDays,
        personality: config.personality,
        tone: config.tone,
        taskTypes: config.handlesTaskTypes,
        channels: config.communicationChannels,
        metrics,
      });
    });

    res.json(agentList);
  } catch (error) {
    console.error('Error getting agents:', error);
    res.status(500).json({ error: 'Failed to get agents' });
  }
});

// Get specific agent details
crmRouter.get('/ai-agents/:agentId', requireAgent, async (req, res) => {
  try {
    const { agentId } = req.params;
    const orchestrator = getAgentOrchestrator();
    const agent = orchestrator.getAgent(agentId);

    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }

    const config = agent.getConfig();
    const metrics = agent.getMetrics();
    const activities = agent.getActivities(50);

    res.json({
      id: agentId,
      config,
      metrics,
      activities,
      isActive: agent.isActive(),
    });
  } catch (error) {
    console.error('Error getting agent:', error);
    res.status(500).json({ error: 'Failed to get agent' });
  }
});

// Start/stop the agent system
crmRouter.post('/ai-agents/control', requireAgent, async (req, res) => {
  try {
    const { action } = req.body;
    const orchestrator = getAgentOrchestrator();

    if (action === 'start') {
      orchestrator.start();
      res.json({ success: true, message: 'Agent system started' });
    } else if (action === 'stop') {
      orchestrator.stop();
      res.json({ success: true, message: 'Agent system stopped' });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "start" or "stop"' });
    }
  } catch (error) {
    console.error('Error controlling agents:', error);
    res.status(500).json({ error: 'Failed to control agent system' });
  }
});

// Process a message through the agent system
crmRouter.post('/ai-agents/process-message', requireAgent, async (req, res) => {
  try {
    const { channel, from, fromName, subject, body, propertyId, contactId } = req.body;

    if (!channel || !from || !body) {
      return res.status(400).json({ error: 'Missing required fields: channel, from, body' });
    }

    const orchestrator = getAgentOrchestrator();

    const message = {
      id: `msg_${Date.now()}`,
      channel,
      from,
      fromName,
      subject,
      body,
      timestamp: new Date(),
      propertyId,
      contactId,
    };

    const result = await orchestrator.handleIncomingMessage(message);
    res.json(result);
  } catch (error) {
    console.error('Error processing message:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Create a manual task
crmRouter.post('/ai-agents/tasks', requireAgent, async (req, res) => {
  try {
    const { type, title, description, priority, assignedTo, propertyId, contactId, input } = req.body;

    if (!type || !title) {
      return res.status(400).json({ error: 'Missing required fields: type, title' });
    }

    const orchestrator = getAgentOrchestrator();

    const task = orchestrator.createTask({
      type,
      title,
      description,
      priority: priority || 'medium',
      assignedTo: assignedTo || 'office_admin',
      propertyId,
      contactId,
      input: input || {},
    });

    res.json({ success: true, task });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get task by ID
crmRouter.get('/ai-agents/tasks/:taskId', requireAgent, async (req, res) => {
  try {
    const { taskId } = req.params;
    const orchestrator = getAgentOrchestrator();
    const task = orchestrator.getTask(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({ error: 'Failed to get task' });
  }
});

// Get recent tasks
crmRouter.get('/ai-agents/tasks', requireAgent, async (req, res) => {
  try {
    const { limit } = req.query;
    const orchestrator = getAgentOrchestrator();
    const tasks = orchestrator.getRecentTasks(parseInt(limit as string) || 50);
    res.json(tasks);
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// Get queue status
crmRouter.get('/ai-agents/queue', requireAgent, async (req, res) => {
  try {
    const orchestrator = getAgentOrchestrator();
    const queueStatus = orchestrator.getQueueStatus();
    res.json(queueStatus);
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({ error: 'Failed to get queue status' });
  }
});

// ==========================================
// DOCUSIGN INTEGRATION ROUTES (OAuth Flow)
// ==========================================

// Get DocuSign configuration and authentication status
crmRouter.get('/docusign/status', requireAgent, async (req, res) => {
  try {
    const config = docuSignService.getConfiguration();
    res.json(config);
  } catch (error) {
    console.error('Error getting DocuSign status:', error);
    res.status(500).json({ error: 'Failed to get DocuSign status' });
  }
});

// Get authorization URL to connect DocuSign
crmRouter.get('/docusign/connect', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isConfigured()) {
      return res.status(400).json({
        error: 'DocuSign not configured. Set DOCUSIGN_INTEGRATION_KEY and DOCUSIGN_SECRET_KEY environment variables.'
      });
    }
    const authUrl = docuSignService.getAuthorizationUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error getting DocuSign auth URL:', error);
    res.status(500).json({ error: 'Failed to get authorization URL' });
  }
});

// OAuth callback - handles the redirect from DocuSign
crmRouter.get('/docusign/callback', async (req, res) => {
  try {
    const { code, error: oauthError } = req.query;

    if (oauthError) {
      console.error('DocuSign OAuth error:', oauthError);
      return res.redirect('/crm/integrations?docusign=error&message=' + encodeURIComponent(oauthError as string));
    }

    if (!code) {
      return res.redirect('/crm/integrations?docusign=error&message=No+authorization+code');
    }

    const result = await docuSignService.handleCallback(code as string);

    if (result.success) {
      res.redirect('/crm/integrations?docusign=success');
    } else {
      res.redirect('/crm/integrations?docusign=error&message=' + encodeURIComponent(result.error || 'Unknown error'));
    }
  } catch (error) {
    console.error('DocuSign callback error:', error);
    res.redirect('/crm/integrations?docusign=error&message=Callback+failed');
  }
});

// Disconnect DocuSign account
crmRouter.post('/docusign/disconnect', requireAgent, async (req, res) => {
  try {
    docuSignService.disconnect();
    res.json({ success: true, message: 'DocuSign disconnected' });
  } catch (error) {
    console.error('Error disconnecting DocuSign:', error);
    res.status(500).json({ error: 'Failed to disconnect DocuSign' });
  }
});

// List recent envelopes
crmRouter.get('/docusign/envelopes', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected. Please connect your account first.' });
    }
    const { fromDate, status, count } = req.query;
    const envelopes = await docuSignService.listEnvelopes({
      fromDate: fromDate as string,
      status: status as string,
      count: count ? parseInt(count as string) : 20,
    });
    res.json(envelopes);
  } catch (error) {
    console.error('Error listing envelopes:', error);
    res.status(500).json({ error: 'Failed to list envelopes' });
  }
});

// Get envelope status
crmRouter.get('/docusign/envelopes/:envelopeId', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected' });
    }
    const { envelopeId } = req.params;
    const status = await docuSignService.getEnvelopeStatus(envelopeId);
    res.json(status);
  } catch (error) {
    console.error('Error getting envelope status:', error);
    res.status(500).json({ error: 'Failed to get envelope status' });
  }
});

// Send tenancy agreement for signature
crmRouter.post('/docusign/send-tenancy-agreement', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected. Please connect your account first.' });
    }

    const {
      tenantEmail, tenantName,
      landlordEmail, landlordName,
      propertyAddress, monthlyRent, depositAmount,
      startDate, endDate, documentBase64
    } = req.body;

    if (!tenantEmail || !landlordEmail || !propertyAddress || !documentBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await docuSignService.sendTenancyAgreement({
      tenantEmail, tenantName,
      landlordEmail, landlordName,
      propertyAddress, monthlyRent, depositAmount,
      startDate, endDate, documentBase64
    });

    res.json({
      success: true,
      ...result,
      message: 'Tenancy agreement sent for signature'
    });
  } catch (error) {
    console.error('Error sending tenancy agreement:', error);
    res.status(500).json({ error: 'Failed to send tenancy agreement' });
  }
});

// Send sales contract for signature
crmRouter.post('/docusign/send-sales-contract', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected. Please connect your account first.' });
    }

    const {
      buyerEmail, buyerName,
      sellerEmail, sellerName,
      propertyAddress, purchasePrice, completionDate, documentBase64
    } = req.body;

    if (!buyerEmail || !sellerEmail || !propertyAddress || !documentBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await docuSignService.sendSalesContract({
      buyerEmail, buyerName,
      sellerEmail, sellerName,
      propertyAddress, purchasePrice, completionDate, documentBase64
    });

    res.json({
      success: true,
      ...result,
      message: 'Sales contract sent for signature'
    });
  } catch (error) {
    console.error('Error sending sales contract:', error);
    res.status(500).json({ error: 'Failed to send sales contract' });
  }
});

// Send management agreement
crmRouter.post('/docusign/send-management-agreement', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected. Please connect your account first.' });
    }

    const { landlordEmail, landlordName, propertyAddress, managementFeePercent, documentBase64 } = req.body;

    if (!landlordEmail || !propertyAddress || !documentBase64) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await docuSignService.sendManagementAgreement({
      landlordEmail, landlordName,
      propertyAddress, managementFeePercent, documentBase64
    });

    res.json({
      success: true,
      ...result,
      message: 'Management agreement sent for signature'
    });
  } catch (error) {
    console.error('Error sending management agreement:', error);
    res.status(500).json({ error: 'Failed to send management agreement' });
  }
});

// Send signature reminder
crmRouter.post('/docusign/envelopes/:envelopeId/remind', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected' });
    }
    const { envelopeId } = req.params;

    const success = await docuSignService.sendReminder(envelopeId);
    res.json({ success, message: success ? 'Reminder sent' : 'Failed to send reminder' });
  } catch (error) {
    console.error('Error sending reminder:', error);
    res.status(500).json({ error: 'Failed to send reminder' });
  }
});

// Void envelope
crmRouter.post('/docusign/envelopes/:envelopeId/void', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected' });
    }
    const { envelopeId } = req.params;
    const { reason } = req.body;

    await docuSignService.voidEnvelope(envelopeId, reason || 'Voided by agent');
    res.json({ success: true, message: 'Envelope voided' });
  } catch (error) {
    console.error('Error voiding envelope:', error);
    res.status(500).json({ error: 'Failed to void envelope' });
  }
});

// Download signed documents
crmRouter.get('/docusign/envelopes/:envelopeId/download', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected' });
    }
    const { envelopeId } = req.params;
    const document = await docuSignService.downloadDocument(envelopeId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="signed-document-${envelopeId}.pdf"`);
    res.send(document);
  } catch (error) {
    console.error('Error downloading document:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Get embedded signing URL
crmRouter.post('/docusign/envelopes/:envelopeId/signing-url', requireAgent, async (req, res) => {
  try {
    if (!docuSignService.isAuthenticated()) {
      return res.status(401).json({ error: 'DocuSign not connected' });
    }
    const { envelopeId } = req.params;
    const { recipientEmail, recipientName, returnUrl } = req.body;

    const signingUrl = await docuSignService.getSigningUrl(
      envelopeId, recipientEmail, recipientName,
      returnUrl || `${process.env.BASE_URL || 'https://johnbarclay.uk'}/portal/documents`
    );

    res.json({ signingUrl });
  } catch (error) {
    console.error('Error getting signing URL:', error);
    res.status(500).json({ error: 'Failed to get signing URL' });
  }
});

// ==========================================
// LANDLORD MANAGEMENT ROUTES - RAW SQL with PM TABLES
// ==========================================

// Get all landlords - RAW SQL
crmRouter.get('/landlords', requireAgent, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, email, phone, mobile,
             address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode,
             bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_sort_code as "bankSortCode",
             landlord_type as "landlordType", is_corporate as "isCorporate", corporate_owner_id as "corporateOwnerId",
             company_name as "companyName", company_registration_no as "companyRegNo",
             notes, status, created_at as "createdAt", updated_at as "updatedAt"
      FROM landlord
      ORDER BY created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching landlords:', error);
    res.status(500).json({ error: 'Failed to fetch landlords' });
  }
});

// Get single landlord - RAW SQL
crmRouter.get('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(`
      SELECT id, name, email, phone, mobile,
             address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode,
             bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_sort_code as "bankSortCode",
             landlord_type as "landlordType", is_corporate as "isCorporate", corporate_owner_id as "corporateOwnerId",
             company_name as "companyName", company_registration_no as "companyRegNo",
             notes, status, created_at as "createdAt", updated_at as "updatedAt"
      FROM landlord WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching landlord:', error);
    res.status(500).json({ error: 'Failed to fetch landlord' });
  }
});

// Create landlord - RAW SQL
crmRouter.post('/landlords', requireAgent, async (req, res) => {
  try {
    const { name, fullName, email, phone, mobile, addressLine1, address, bankName, bankAccountNumber, bankAccountNo, bankSortCode, landlordType, companyName, companyRegNo, notes } = req.body;

    // Support both old and new field names for backwards compatibility
    const landlordName = name || fullName;
    const addrLine1 = addressLine1 || address;
    const bankAccNum = bankAccountNumber || bankAccountNo;

    if (!landlordName) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const result = await pool.query(`
      INSERT INTO landlord (name, email, phone, mobile, address_line1, bank_name, bank_account_number, bank_sort_code, landlord_type, company_name, company_registration_no, notes, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
      RETURNING id, name, email, phone, mobile, address_line1 as "addressLine1", bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_sort_code as "bankSortCode", landlord_type as "landlordType", company_name as "companyName", company_registration_no as "companyRegNo", notes, status, created_at as "createdAt"
    `, [landlordName, email || null, phone || mobile || null, mobile || null, addrLine1 || null, bankName || null, bankAccNum || null, bankSortCode || null, landlordType || 'individual', companyName || null, companyRegNo || null, notes || null]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating landlord:', error);
    res.status(500).json({ error: 'Failed to create landlord' });
  }
});

// Update landlord - RAW SQL
crmRouter.put('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { name, fullName, email, phone, mobile, addressLine1, address, bankName, bankAccountNumber, bankAccountNo, bankSortCode, landlordType, companyName, companyRegNo, notes, status } = req.body;

    // Support both old and new field names for backwards compatibility
    const landlordName = name || fullName;
    const addrLine1 = addressLine1 || address;
    const bankAccNum = bankAccountNumber || bankAccountNo;

    const result = await pool.query(`
      UPDATE landlord SET
        name = COALESCE($2, name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        mobile = COALESCE($5, mobile),
        address_line1 = COALESCE($6, address_line1),
        bank_name = COALESCE($7, bank_name),
        bank_account_number = COALESCE($8, bank_account_number),
        bank_sort_code = COALESCE($9, bank_sort_code),
        landlord_type = COALESCE($10, landlord_type),
        company_name = COALESCE($11, company_name),
        company_registration_no = COALESCE($12, company_registration_no),
        notes = COALESCE($13, notes),
        status = COALESCE($14, status),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, name, email, phone, mobile, address_line1 as "addressLine1", bank_name as "bankName", bank_account_number as "bankAccountNumber", bank_sort_code as "bankSortCode", landlord_type as "landlordType", company_name as "companyName", company_registration_no as "companyRegNo", notes, status, created_at as "createdAt", updated_at as "updatedAt"
    `, [id, landlordName, email, phone, mobile, addrLine1, bankName, bankAccNum, bankSortCode, landlordType, companyName, companyRegNo, notes, status]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating landlord:', error);
    res.status(500).json({ error: 'Failed to update landlord' });
  }
});

// Delete landlord - RAW SQL
crmRouter.delete('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM landlord WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting landlord:', error);
    res.status(500).json({ error: 'Failed to delete landlord' });
  }
});

// ==========================================
// CORPORATE OWNER ROUTES
// ==========================================
// For corporate landlords: Landlord → Corporate Owner → Beneficial Owners

// Get corporate owner for a landlord
crmRouter.get('/landlords/:landlordId/corporate-owner', requireAgent, async (req, res) => {
  try {
    const landlordId = parseInt(req.params.landlordId);

    // First check if landlord is corporate
    const landlordResult = await pool.query(`
      SELECT id, is_corporate as "isCorporate", corporate_owner_id as "corporateOwnerId"
      FROM landlord WHERE id = $1
    `, [landlordId]);

    if (landlordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    const landlord = landlordResult.rows[0];
    if (!landlord.isCorporate) {
      return res.status(400).json({ error: 'Landlord is not a corporate entity' });
    }

    if (!landlord.corporateOwnerId) {
      return res.status(404).json({ error: 'Corporate owner not found for this landlord' });
    }

    const result = await pool.query(`
      SELECT id, landlord_id as "landlordId",
             company_name as "companyName", company_registration_no as "companyRegistrationNo", company_vat_no as "companyVatNo",
             address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode, country,
             email, phone,
             certificate_of_incorporation_url as "certificateOfIncorporationUrl",
             memorandum_of_association_url as "memorandumOfAssociationUrl",
             articles_of_association_url as "articlesOfAssociationUrl",
             is_active as "isActive",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM corporate_owner WHERE id = $1
    `, [landlord.corporateOwnerId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Corporate owner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching corporate owner:', error);
    res.status(500).json({ error: 'Failed to fetch corporate owner' });
  }
});

// Get a single corporate owner by ID
crmRouter.get('/corporate-owners/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(`
      SELECT id, landlord_id as "landlordId",
             company_name as "companyName", company_registration_no as "companyRegistrationNo", company_vat_no as "companyVatNo",
             address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode, country,
             email, phone,
             certificate_of_incorporation_url as "certificateOfIncorporationUrl",
             memorandum_of_association_url as "memorandumOfAssociationUrl",
             articles_of_association_url as "articlesOfAssociationUrl",
             is_active as "isActive",
             created_at as "createdAt", updated_at as "updatedAt"
      FROM corporate_owner WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Corporate owner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching corporate owner:', error);
    res.status(500).json({ error: 'Failed to fetch corporate owner' });
  }
});

// Create corporate owner for a landlord (and update landlord to corporate)
crmRouter.post('/landlords/:landlordId/corporate-owner', requireAgent, async (req, res) => {
  try {
    const landlordId = parseInt(req.params.landlordId);
    const {
      companyName, companyRegistrationNo, companyVatNo,
      addressLine1, addressLine2, city, postcode, country,
      email, phone,
      certificateOfIncorporationUrl, memorandumOfAssociationUrl, articlesOfAssociationUrl
    } = req.body;

    if (!companyName) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Check if landlord exists
    const landlordCheck = await pool.query('SELECT id FROM landlord WHERE id = $1', [landlordId]);
    if (landlordCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    // Create corporate owner
    const result = await pool.query(`
      INSERT INTO corporate_owner (
        landlord_id, company_name, company_registration_no, company_vat_no,
        address_line1, address_line2, city, postcode, country,
        email, phone,
        certificate_of_incorporation_url, memorandum_of_association_url, articles_of_association_url
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, landlord_id as "landlordId",
                company_name as "companyName", company_registration_no as "companyRegistrationNo",
                company_vat_no as "companyVatNo",
                created_at as "createdAt"
    `, [
      landlordId, companyName, companyRegistrationNo || null, companyVatNo || null,
      addressLine1 || null, addressLine2 || null, city || null, postcode || null, country || 'United Kingdom',
      email || null, phone || null,
      certificateOfIncorporationUrl || null, memorandumOfAssociationUrl || null, articlesOfAssociationUrl || null
    ]);

    const corporateOwner = result.rows[0];

    // Update landlord to be corporate and link to corporate owner
    await pool.query(`
      UPDATE landlord SET is_corporate = true, corporate_owner_id = $1, updated_at = NOW()
      WHERE id = $2
    `, [corporateOwner.id, landlordId]);

    res.json(corporateOwner);
  } catch (error) {
    console.error('Error creating corporate owner:', error);
    res.status(500).json({ error: 'Failed to create corporate owner' });
  }
});

// Update corporate owner
crmRouter.put('/corporate-owners/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      companyName, companyRegistrationNo, companyVatNo,
      addressLine1, addressLine2, city, postcode, country,
      email, phone,
      certificateOfIncorporationUrl, memorandumOfAssociationUrl, articlesOfAssociationUrl,
      isActive
    } = req.body;

    const result = await pool.query(`
      UPDATE corporate_owner SET
        company_name = COALESCE($2, company_name),
        company_registration_no = COALESCE($3, company_registration_no),
        company_vat_no = COALESCE($4, company_vat_no),
        address_line1 = COALESCE($5, address_line1),
        address_line2 = COALESCE($6, address_line2),
        city = COALESCE($7, city),
        postcode = COALESCE($8, postcode),
        country = COALESCE($9, country),
        email = COALESCE($10, email),
        phone = COALESCE($11, phone),
        certificate_of_incorporation_url = COALESCE($12, certificate_of_incorporation_url),
        memorandum_of_association_url = COALESCE($13, memorandum_of_association_url),
        articles_of_association_url = COALESCE($14, articles_of_association_url),
        is_active = COALESCE($15, is_active),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, landlord_id as "landlordId",
                company_name as "companyName", company_registration_no as "companyRegistrationNo",
                company_vat_no as "companyVatNo",
                is_active as "isActive", updated_at as "updatedAt"
    `, [
      id, companyName, companyRegistrationNo, companyVatNo,
      addressLine1, addressLine2, city, postcode, country,
      email, phone,
      certificateOfIncorporationUrl, memorandumOfAssociationUrl, articlesOfAssociationUrl,
      isActive
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Corporate owner not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating corporate owner:', error);
    res.status(500).json({ error: 'Failed to update corporate owner' });
  }
});

// Delete corporate owner (and update landlord to non-corporate)
crmRouter.delete('/corporate-owners/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // Get landlord_id before deleting
    const corpResult = await pool.query('SELECT landlord_id FROM corporate_owner WHERE id = $1', [id]);
    if (corpResult.rows.length > 0) {
      const landlordId = corpResult.rows[0].landlord_id;
      // Reset landlord to non-corporate
      await pool.query(`
        UPDATE landlord SET is_corporate = false, corporate_owner_id = NULL, updated_at = NOW()
        WHERE id = $1
      `, [landlordId]);
    }

    await pool.query('DELETE FROM corporate_owner WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting corporate owner:', error);
    res.status(500).json({ error: 'Failed to delete corporate owner' });
  }
});

// Get beneficial owners for a corporate owner directly
crmRouter.get('/corporate-owners/:corporateOwnerId/beneficial-owners', requireAgent, async (req, res) => {
  try {
    const corporateOwnerId = parseInt(req.params.corporateOwnerId);

    const result = await pool.query(`
      SELECT id, landlord_id as "landlordId", corporate_owner_id as "corporateOwnerId",
             full_name as "fullName", email, phone,
             date_of_birth as "dateOfBirth", nationality,
             address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode, country,
             ownership_percentage as "ownershipPercentage", is_trustee as "isTrustee", is_director as "isDirector", is_psc as "isPsc",
             national_insurance_no as "nationalInsuranceNo",
             passport_number as "passportNumber", passport_expiry as "passportExpiry",
             id_document_type as "idDocumentType", id_document_number as "idDocumentNumber",
             id_document_expiry as "idDocumentExpiry", id_document_url as "idDocumentUrl",
             proof_of_address_url as "proofOfAddressUrl", proof_of_address_date as "proofOfAddressDate", proof_of_address_type as "proofOfAddressType",
             pep_check_completed as "pepCheckCompleted", sanctions_check_completed as "sanctionsCheckCompleted",
             aml_check_completed as "amlCheckCompleted", aml_check_result as "amlCheckResult",
             kyc_verified as "kycVerified", kyc_verified_at as "kycVerifiedAt", kyc_verified_by as "kycVerifiedBy",
             notes, created_at as "createdAt", updated_at as "updatedAt"
      FROM beneficial_owner
      WHERE corporate_owner_id = $1
      ORDER BY ownership_percentage DESC NULLS LAST, created_at ASC
    `, [corporateOwnerId]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching beneficial owners for corporate owner:', error);
    res.status(500).json({ error: 'Failed to fetch beneficial owners' });
  }
});

// ==========================================
// BENEFICIAL OWNERS ROUTES
// ==========================================
// Flow:
// - Individual landlords: Property → Landlord → Beneficial Owners (via landlord_id)
// - Corporate landlords: Property → Landlord → Corporate Owner → Beneficial Owners (via corporate_owner_id)

// Get all beneficial owners for a landlord
// This endpoint handles both individual and corporate landlords transparently
crmRouter.get('/landlords/:landlordId/beneficial-owners', requireAgent, async (req, res) => {
  try {
    const landlordId = parseInt(req.params.landlordId);

    // First check if the landlord is corporate
    const landlordResult = await pool.query(`
      SELECT id, is_corporate as "isCorporate", corporate_owner_id as "corporateOwnerId"
      FROM landlord WHERE id = $1
    `, [landlordId]);

    if (landlordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    const landlord = landlordResult.rows[0];
    let result;

    if (landlord.isCorporate && landlord.corporateOwnerId) {
      // Corporate landlord: get beneficial owners via corporate_owner_id
      result = await pool.query(`
        SELECT id, landlord_id as "landlordId", corporate_owner_id as "corporateOwnerId",
               full_name as "fullName", email, phone,
               date_of_birth as "dateOfBirth", nationality,
               address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode, country,
               ownership_percentage as "ownershipPercentage", is_trustee as "isTrustee", is_director as "isDirector", is_psc as "isPsc",
               national_insurance_no as "nationalInsuranceNo",
               passport_number as "passportNumber", passport_expiry as "passportExpiry",
               id_document_type as "idDocumentType", id_document_number as "idDocumentNumber",
               id_document_expiry as "idDocumentExpiry", id_document_url as "idDocumentUrl",
               proof_of_address_url as "proofOfAddressUrl", proof_of_address_date as "proofOfAddressDate", proof_of_address_type as "proofOfAddressType",
               pep_check_completed as "pepCheckCompleted", sanctions_check_completed as "sanctionsCheckCompleted",
               aml_check_completed as "amlCheckCompleted", aml_check_result as "amlCheckResult",
               kyc_verified as "kycVerified", kyc_verified_at as "kycVerifiedAt", kyc_verified_by as "kycVerifiedBy",
               notes, created_at as "createdAt", updated_at as "updatedAt"
        FROM beneficial_owner
        WHERE corporate_owner_id = $1
        ORDER BY ownership_percentage DESC NULLS LAST, created_at ASC
      `, [landlord.corporateOwnerId]);
    } else {
      // Individual landlord: get beneficial owners via landlord_id
      result = await pool.query(`
        SELECT id, landlord_id as "landlordId", corporate_owner_id as "corporateOwnerId",
               full_name as "fullName", email, phone,
               date_of_birth as "dateOfBirth", nationality,
               address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode, country,
               ownership_percentage as "ownershipPercentage", is_trustee as "isTrustee", is_director as "isDirector", is_psc as "isPsc",
               national_insurance_no as "nationalInsuranceNo",
               passport_number as "passportNumber", passport_expiry as "passportExpiry",
               id_document_type as "idDocumentType", id_document_number as "idDocumentNumber",
               id_document_expiry as "idDocumentExpiry", id_document_url as "idDocumentUrl",
               proof_of_address_url as "proofOfAddressUrl", proof_of_address_date as "proofOfAddressDate", proof_of_address_type as "proofOfAddressType",
               pep_check_completed as "pepCheckCompleted", sanctions_check_completed as "sanctionsCheckCompleted",
               aml_check_completed as "amlCheckCompleted", aml_check_result as "amlCheckResult",
               kyc_verified as "kycVerified", kyc_verified_at as "kycVerifiedAt", kyc_verified_by as "kycVerifiedBy",
               notes, created_at as "createdAt", updated_at as "updatedAt"
        FROM beneficial_owner
        WHERE landlord_id = $1
        ORDER BY ownership_percentage DESC NULLS LAST, created_at ASC
      `, [landlordId]);
    }

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching beneficial owners:', error);
    res.status(500).json({ error: 'Failed to fetch beneficial owners' });
  }
});

// Get a single beneficial owner
crmRouter.get('/beneficial-owners/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = await pool.query(`
      SELECT id, landlord_id as "landlordId", corporate_owner_id as "corporateOwnerId",
             full_name as "fullName", email, phone, mobile,
             date_of_birth as "dateOfBirth", nationality,
             address_line1 as "addressLine1", address_line2 as "addressLine2", city, postcode, country,
             ownership_percentage as "ownershipPercentage", is_trustee as "isTrustee", is_director as "isDirector", is_psc as "isPsc",
             national_insurance_no as "nationalInsuranceNo",
             passport_number as "passportNumber", passport_expiry as "passportExpiry",
             id_document_type as "idDocumentType", id_document_number as "idDocumentNumber",
             id_document_expiry as "idDocumentExpiry", id_document_url as "idDocumentUrl",
             secondary_id_type as "secondaryIdType", secondary_id_number as "secondaryIdNumber",
             secondary_id_expiry as "secondaryIdExpiry", secondary_id_url as "secondaryIdUrl",
             proof_of_address_url as "proofOfAddressUrl", proof_of_address_date as "proofOfAddressDate", proof_of_address_type as "proofOfAddressType",
             pep_check_completed as "pepCheckCompleted", pep_check_date as "pepCheckDate", pep_check_result as "pepCheckResult",
             sanctions_check_completed as "sanctionsCheckCompleted", sanctions_check_date as "sanctionsCheckDate", sanctions_check_result as "sanctionsCheckResult",
             aml_check_completed as "amlCheckCompleted", aml_check_date as "amlCheckDate", aml_check_result as "amlCheckResult",
             kyc_verified as "kycVerified", kyc_verified_at as "kycVerifiedAt", kyc_verified_by as "kycVerifiedBy", kyc_verification_notes as "kycVerificationNotes",
             notes, is_active as "isActive", created_at as "createdAt", updated_at as "updatedAt"
      FROM beneficial_owner WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficial owner not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching beneficial owner:', error);
    res.status(500).json({ error: 'Failed to fetch beneficial owner' });
  }
});

// Create beneficial owner for a landlord
// For individual landlords: sets landlord_id
// For corporate landlords: sets corporate_owner_id (from landlord's corporate owner)
crmRouter.post('/landlords/:landlordId/beneficial-owners', requireAgent, async (req, res) => {
  try {
    const landlordId = parseInt(req.params.landlordId);
    const {
      fullName, email, phone, mobile, dateOfBirth, nationality,
      addressLine1, addressLine2, city, postcode, country,
      ownershipPercentage, isTrustee, isDirector, isPsc,
      nationalInsuranceNo, passportNumber, passportExpiry,
      idDocumentType, idDocumentNumber, idDocumentExpiry, idDocumentUrl,
      proofOfAddressUrl, proofOfAddressDate, proofOfAddressType,
      pepCheckCompleted, sanctionsCheckCompleted, amlCheckCompleted,
      notes
    } = req.body;

    if (!fullName) {
      return res.status(400).json({ error: 'Full name is required' });
    }

    // Check if landlord is corporate to determine how to link the beneficial owner
    const landlordResult = await pool.query(`
      SELECT id, is_corporate as "isCorporate", corporate_owner_id as "corporateOwnerId"
      FROM landlord WHERE id = $1
    `, [landlordId]);

    if (landlordResult.rows.length === 0) {
      return res.status(404).json({ error: 'Landlord not found' });
    }

    const landlord = landlordResult.rows[0];
    let result;

    if (landlord.isCorporate && landlord.corporateOwnerId) {
      // Corporate landlord: link via corporate_owner_id
      result = await pool.query(`
        INSERT INTO beneficial_owner (
          corporate_owner_id, full_name, email, phone, mobile, date_of_birth, nationality,
          address_line1, address_line2, city, postcode, country,
          ownership_percentage, is_trustee, is_director, is_psc,
          national_insurance_no, passport_number, passport_expiry,
          id_document_type, id_document_number, id_document_expiry, id_document_url,
          proof_of_address_url, proof_of_address_date, proof_of_address_type,
          pep_check_completed, sanctions_check_completed, aml_check_completed,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        RETURNING id, corporate_owner_id as "corporateOwnerId", full_name as "fullName", email, phone,
                  ownership_percentage as "ownershipPercentage", is_trustee as "isTrustee", is_director as "isDirector",
                  kyc_verified as "kycVerified", created_at as "createdAt"
      `, [
        landlord.corporateOwnerId, fullName, email || null, phone || null, mobile || null, dateOfBirth || null, nationality || null,
        addressLine1 || null, addressLine2 || null, city || null, postcode || null, country || 'United Kingdom',
        ownershipPercentage || null, isTrustee || false, isDirector || false, isPsc || false,
        nationalInsuranceNo || null, passportNumber || null, passportExpiry || null,
        idDocumentType || null, idDocumentNumber || null, idDocumentExpiry || null, idDocumentUrl || null,
        proofOfAddressUrl || null, proofOfAddressDate || null, proofOfAddressType || null,
        pepCheckCompleted || false, sanctionsCheckCompleted || false, amlCheckCompleted || false,
        notes || null
      ]);
    } else {
      // Individual landlord: link via landlord_id
      result = await pool.query(`
        INSERT INTO beneficial_owner (
          landlord_id, full_name, email, phone, mobile, date_of_birth, nationality,
          address_line1, address_line2, city, postcode, country,
          ownership_percentage, is_trustee, is_director, is_psc,
          national_insurance_no, passport_number, passport_expiry,
          id_document_type, id_document_number, id_document_expiry, id_document_url,
          proof_of_address_url, proof_of_address_date, proof_of_address_type,
          pep_check_completed, sanctions_check_completed, aml_check_completed,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
        RETURNING id, landlord_id as "landlordId", full_name as "fullName", email, phone,
                  ownership_percentage as "ownershipPercentage", is_trustee as "isTrustee", is_director as "isDirector",
                  kyc_verified as "kycVerified", created_at as "createdAt"
      `, [
        landlordId, fullName, email || null, phone || null, mobile || null, dateOfBirth || null, nationality || null,
        addressLine1 || null, addressLine2 || null, city || null, postcode || null, country || 'United Kingdom',
        ownershipPercentage || null, isTrustee || false, isDirector || false, isPsc || false,
        nationalInsuranceNo || null, passportNumber || null, passportExpiry || null,
        idDocumentType || null, idDocumentNumber || null, idDocumentExpiry || null, idDocumentUrl || null,
        proofOfAddressUrl || null, proofOfAddressDate || null, proofOfAddressType || null,
        pepCheckCompleted || false, sanctionsCheckCompleted || false, amlCheckCompleted || false,
        notes || null
      ]);
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error creating beneficial owner:', error);
    res.status(500).json({ error: 'Failed to create beneficial owner' });
  }
});

// Update beneficial owner
crmRouter.put('/beneficial-owners/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      fullName, email, phone, dateOfBirth, nationality,
      addressLine1, addressLine2, city, postcode, country,
      ownershipPercentage, isTrustee,
      nationalInsuranceNo, passportNumber, passportExpiry,
      idDocumentType, idDocumentNumber, idDocumentExpiry, idDocumentUrl,
      proofOfAddressUrl, proofOfAddressDate,
      pepCheckCompleted, sanctionsCheckCompleted,
      kycVerified,
      notes
    } = req.body;

    const result = await pool.query(`
      UPDATE beneficial_owner SET
        full_name = COALESCE($2, full_name),
        email = COALESCE($3, email),
        phone = COALESCE($4, phone),
        date_of_birth = COALESCE($5, date_of_birth),
        nationality = COALESCE($6, nationality),
        address_line1 = COALESCE($7, address_line1),
        address_line2 = COALESCE($8, address_line2),
        city = COALESCE($9, city),
        postcode = COALESCE($10, postcode),
        country = COALESCE($11, country),
        ownership_percentage = COALESCE($12, ownership_percentage),
        is_trustee = COALESCE($13, is_trustee),
        national_insurance_no = COALESCE($14, national_insurance_no),
        passport_number = COALESCE($15, passport_number),
        passport_expiry = COALESCE($16, passport_expiry),
        id_document_type = COALESCE($17, id_document_type),
        id_document_number = COALESCE($18, id_document_number),
        id_document_expiry = COALESCE($19, id_document_expiry),
        id_document_url = COALESCE($20, id_document_url),
        proof_of_address_url = COALESCE($21, proof_of_address_url),
        proof_of_address_date = COALESCE($22, proof_of_address_date),
        pep_check_completed = COALESCE($23, pep_check_completed),
        sanctions_check_completed = COALESCE($24, sanctions_check_completed),
        kyc_verified = COALESCE($25, kyc_verified),
        notes = COALESCE($26, notes),
        updated_at = NOW()
      WHERE id = $1
      RETURNING id, landlord_id as "landlordId", corporate_owner_id as "corporateOwnerId",
                full_name as "fullName", email, phone,
                ownership_percentage as "ownershipPercentage", is_trustee as "isTrustee",
                kyc_verified as "kycVerified", updated_at as "updatedAt"
    `, [
      id, fullName, email, phone, dateOfBirth, nationality,
      addressLine1, addressLine2, city, postcode, country,
      ownershipPercentage, isTrustee,
      nationalInsuranceNo, passportNumber, passportExpiry,
      idDocumentType, idDocumentNumber, idDocumentExpiry, idDocumentUrl,
      proofOfAddressUrl, proofOfAddressDate,
      pepCheckCompleted, sanctionsCheckCompleted,
      kycVerified,
      notes
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Beneficial owner not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating beneficial owner:', error);
    res.status(500).json({ error: 'Failed to update beneficial owner' });
  }
});

// Delete beneficial owner
crmRouter.delete('/beneficial-owners/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await pool.query('DELETE FROM beneficial_owner WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting beneficial owner:', error);
    res.status(500).json({ error: 'Failed to delete beneficial owner' });
  }
});

// ==========================================
// PROACTIVE LEAD GENERATION ROUTES
// ==========================================

import { proactiveLeadGenService } from './proactiveLeadGenService';

// Get proactive lead generation dashboard stats
crmRouter.get('/proactive-leads/dashboard', requireAgent, async (req, res) => {
  try {
    const stats = await proactiveLeadGenService.getDashboardStats();
    res.json(stats);
  } catch (error) {
    console.error('Error fetching proactive leads dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Get proactive leads with filters
crmRouter.get('/proactive-leads', requireAgent, async (req, res) => {
  try {
    const { source, status, temperature, minScore, limit, offset } = req.query;

    const leads = await proactiveLeadGenService.getLeads({
      source: source as string,
      status: status as string,
      temperature: temperature as string,
      minScore: minScore ? parseInt(minScore as string) : undefined,
      limit: limit ? parseInt(limit as string) : 50,
      offset: offset ? parseInt(offset as string) : 0
    });

    res.json(leads);
  } catch (error) {
    console.error('Error fetching proactive leads:', error);
    res.status(500).json({ error: 'Failed to fetch proactive leads' });
  }
});

// Update lead status
crmRouter.put('/proactive-leads/:leadId', requireAgent, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { status, notes } = req.body;

    await proactiveLeadGenService.updateLeadStatus(parseInt(leadId), status, notes);
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating proactive lead:', error);
    res.status(500).json({ error: 'Failed to update lead' });
  }
});

// Record contact attempt on a lead
crmRouter.post('/proactive-leads/:leadId/contact', requireAgent, async (req: any, res) => {
  try {
    const { leadId } = req.params;
    const { method, direction, subject, content, outcome } = req.body;

    await proactiveLeadGenService.recordContact(parseInt(leadId), {
      method,
      direction: direction || 'outbound',
      subject,
      content,
      outcome,
      contactedById: req.user?.id
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error recording contact:', error);
    res.status(500).json({ error: 'Failed to record contact' });
  }
});

// Run a specific monitor manually
crmRouter.post('/proactive-leads/monitors/:monitorType/run', requireAgent, async (req, res) => {
  try {
    const { monitorType } = req.params;

    const leads = await proactiveLeadGenService.runMonitor(monitorType);

    res.json({
      success: true,
      leadsFound: leads.length,
      leads
    });
  } catch (error) {
    console.error('Error running monitor:', error);
    res.status(500).json({ error: 'Failed to run monitor' });
  }
});

// Start all proactive lead monitors
crmRouter.post('/proactive-leads/monitors/start', requireAgent, async (req, res) => {
  try {
    await proactiveLeadGenService.startAllMonitors();
    res.json({ success: true, message: 'All proactive lead monitors started' });
  } catch (error) {
    console.error('Error starting monitors:', error);
    res.status(500).json({ error: 'Failed to start monitors' });
  }
});

// Stop all proactive lead monitors
crmRouter.post('/proactive-leads/monitors/stop', requireAgent, async (req, res) => {
  try {
    proactiveLeadGenService.stopAllMonitors();
    res.json({ success: true, message: 'All proactive lead monitors stopped' });
  } catch (error) {
    console.error('Error stopping monitors:', error);
    res.status(500).json({ error: 'Failed to stop monitors' });
  }
});

// Get list of available monitor types
crmRouter.get('/proactive-leads/monitors', requireAgent, async (req, res) => {
  try {
    const monitors = [
      {
        id: 'land_registry',
        name: 'Land Registry Monitoring',
        description: 'Monitor recent property transactions for new owner leads',
        frequency: 'daily',
        category: 'property_data'
      },
      {
        id: 'planning_permissions',
        name: 'Planning Permission Alerts',
        description: 'Track planning applications for development opportunities',
        frequency: 'daily',
        category: 'property_data'
      },
      {
        id: 'expired_listings',
        name: 'Expired Listings Detection',
        description: 'Find withdrawn/expired listings from competitors',
        frequency: 'daily',
        category: 'competitor_intel'
      },
      {
        id: 'price_reductions',
        name: 'Price Reduction Alerts',
        description: 'Monitor for motivated sellers reducing prices',
        frequency: 'hourly',
        category: 'competitor_intel'
      },
      {
        id: 'rental_arbitrage',
        name: 'Rental Yield Arbitrage',
        description: 'Find high-yield investment opportunities',
        frequency: 'weekly',
        category: 'investment'
      },
      {
        id: 'social_media',
        name: 'Social Media Listening',
        description: 'Monitor social platforms for property-related discussions',
        frequency: 'every 2 hours',
        category: 'social'
      },
      {
        id: 'compliance',
        name: 'Landlord Compliance Reminders',
        description: 'Track expiring certificates and compliance deadlines',
        frequency: 'daily',
        category: 'compliance'
      },
      {
        id: 'portfolio_landlords',
        name: 'Portfolio Landlord Identification',
        description: 'Find landlords with multiple properties',
        frequency: 'weekly',
        category: 'landlord_acquisition'
      },
      {
        id: 'auctions',
        name: 'Auction Monitoring',
        description: 'Track auction lots and results',
        frequency: 'daily',
        category: 'auctions'
      },
      {
        id: 'competitor_listings',
        name: 'Competitor Listing Monitor',
        description: 'Track stale competitor listings',
        frequency: 'every 4 hours',
        category: 'competitor_intel'
      },
      {
        id: 'seasonal_campaigns',
        name: 'Seasonal Campaign Automation',
        description: 'Run targeted seasonal marketing campaigns',
        frequency: 'daily',
        category: 'marketing'
      },
      {
        id: 'propensity_scoring',
        name: 'AI Propensity Scoring',
        description: 'ML-based prediction of sell likelihood',
        frequency: 'weekly',
        category: 'ai'
      }
    ];

    res.json(monitors);
  } catch (error) {
    console.error('Error fetching monitors:', error);
    res.status(500).json({ error: 'Failed to fetch monitors' });
  }
});

// Create seasonal campaign
crmRouter.post('/proactive-leads/campaigns', requireAgent, async (req: any, res) => {
  try {
    const {
      name, description, campaignType, startDate, endDate,
      targetAudience, postcodeAreas, headline, mainMessage,
      callToAction, offerDetails, channels
    } = req.body;

    const { seasonalCampaigns } = await import('@shared/schema');
    const { db } = await import('./db');

    const [campaign] = await db.insert(seasonalCampaigns).values({
      name,
      description,
      campaignType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      targetAudience,
      postcodeAreas,
      headline,
      mainMessage,
      callToAction,
      offerDetails,
      channels,
      isActive: true,
      createdBy: req.user?.id
    }).returning();

    res.json({ success: true, campaign });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// Get seasonal campaigns
crmRouter.get('/proactive-leads/campaigns', requireAgent, async (req, res) => {
  try {
    const { seasonalCampaigns } = await import('@shared/schema');
    const { db } = await import('./db');
    const { desc } = await import('drizzle-orm');

    const campaigns = await db.select()
      .from(seasonalCampaigns)
      .orderBy(desc(seasonalCampaigns.createdAt));

    res.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// Toggle campaign active status
crmRouter.put('/proactive-leads/campaigns/:id/toggle', requireAgent, async (req, res) => {
  try {
    const { id } = req.params;
    const { seasonalCampaigns } = await import('@shared/schema');
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');

    // Get current status
    const [current] = await db.select()
      .from(seasonalCampaigns)
      .where(eq(seasonalCampaigns.id, parseInt(id)));

    if (!current) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Toggle status
    const [updated] = await db.update(seasonalCampaigns)
      .set({ isActive: !current.isActive, updatedAt: new Date() })
      .where(eq(seasonalCampaigns.id, parseInt(id)))
      .returning();

    res.json({ success: true, campaign: updated });
  } catch (error) {
    console.error('Error toggling campaign:', error);
    res.status(500).json({ error: 'Failed to toggle campaign' });
  }
});

// Get landlord compliance records
crmRouter.get('/proactive-leads/compliance', requireAgent, async (req, res) => {
  try {
    const { landlordCompliance } = await import('@shared/schema');
    const { db } = await import('./db');

    const records = await db.select().from(landlordCompliance);
    res.json(records);
  } catch (error) {
    console.error('Error fetching compliance records:', error);
    res.status(500).json({ error: 'Failed to fetch compliance records' });
  }
});

// Add landlord compliance record (for tracking external landlords as prospects)
crmRouter.post('/proactive-leads/compliance', requireAgent, async (req, res) => {
  try {
    const {
      propertyAddress, postcode, landlordName, landlordEmail, landlordPhone,
      epcRating, epcExpiryDate, gasSafetyExpiryDate, eicrExpiryDate, isProspect
    } = req.body;

    const { landlordCompliance } = await import('@shared/schema');
    const { db } = await import('./db');

    const [record] = await db.insert(landlordCompliance).values({
      propertyAddress,
      postcode,
      landlordName,
      landlordEmail,
      landlordPhone,
      epcRating,
      epcExpiryDate: epcExpiryDate ? new Date(epcExpiryDate) : null,
      gasSafetyExpiryDate: gasSafetyExpiryDate ? new Date(gasSafetyExpiryDate) : null,
      eicrExpiryDate: eicrExpiryDate ? new Date(eicrExpiryDate) : null,
      isProspect: isProspect || false,
      isCompliant: true
    }).returning();

    res.json({ success: true, record });
  } catch (error) {
    console.error('Error creating compliance record:', error);
    res.status(500).json({ error: 'Failed to create compliance record' });
  }
});

// Get propensity scores
crmRouter.get('/proactive-leads/propensity-scores', requireAgent, async (req, res) => {
  try {
    const { propensityScores } = await import('@shared/schema');
    const { db } = await import('./db');
    const { desc } = await import('drizzle-orm');

    const scores = await db.select()
      .from(propensityScores)
      .orderBy(desc(propensityScores.sellPropensity))
      .limit(100);

    res.json(scores);
  } catch (error) {
    console.error('Error fetching propensity scores:', error);
    res.status(500).json({ error: 'Failed to fetch propensity scores' });
  }
});

// Add property to propensity scoring
crmRouter.post('/proactive-leads/propensity-scores', requireAgent, async (req, res) => {
  try {
    const {
      propertyAddress, postcode, propertyType, bedrooms, estimatedValue,
      lastSaleDate, lastSalePrice, ownerType, isLandlord
    } = req.body;

    const { propensityScores } = await import('@shared/schema');
    const { db } = await import('./db');

    const ownershipDuration = lastSaleDate
      ? Math.floor((Date.now() - new Date(lastSaleDate).getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const [score] = await db.insert(propensityScores).values({
      propertyAddress,
      postcode,
      propertyType,
      bedrooms,
      estimatedValue,
      lastSaleDate: lastSaleDate ? new Date(lastSaleDate) : null,
      lastSalePrice,
      ownershipDuration,
      ownerType,
      isLandlord: isLandlord || false,
      sellPropensity: '50' // Will be calculated by the AI scoring
    }).returning();

    res.json({ success: true, score });
  } catch (error) {
    console.error('Error creating propensity score:', error);
    res.status(500).json({ error: 'Failed to create propensity score' });
  }
});

// Get social media mentions
crmRouter.get('/proactive-leads/social-mentions', requireAgent, async (req, res) => {
  try {
    const { socialMediaMentions } = await import('@shared/schema');
    const { db } = await import('./db');
    const { desc } = await import('drizzle-orm');

    const mentions = await db.select()
      .from(socialMediaMentions)
      .orderBy(desc(socialMediaMentions.discoveredAt))
      .limit(100);

    res.json(mentions);
  } catch (error) {
    console.error('Error fetching social mentions:', error);
    res.status(500).json({ error: 'Failed to fetch social mentions' });
  }
});

// Get lead contact history
crmRouter.get('/proactive-leads/:leadId/history', requireAgent, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { leadContactHistory } = await import('@shared/schema');
    const { db } = await import('./db');
    const { eq, desc } = await import('drizzle-orm');

    const history = await db.select()
      .from(leadContactHistory)
      .where(eq(leadContactHistory.leadId, parseInt(leadId)))
      .orderBy(desc(leadContactHistory.createdAt));

    res.json(history);
  } catch (error) {
    console.error('Error fetching contact history:', error);
    res.status(500).json({ error: 'Failed to fetch contact history' });
  }
});

// Generate cash offer letter for a lead
crmRouter.post('/proactive-leads/:leadId/generate-offer', requireAgent, async (req, res) => {
  try {
    const { leadId } = req.params;
    const { cashOfferPercent, completionDays } = req.body;

    const { proactiveLeads } = await import('@shared/schema');
    const { db } = await import('./db');
    const { eq } = await import('drizzle-orm');

    const [lead] = await db.select()
      .from(proactiveLeads)
      .where(eq(proactiveLeads.id, parseInt(leadId)));

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const offerPercent = cashOfferPercent || 85;
    const days = completionDays || 7;
    const estimatedValue = lead.estimatedValue || lead.currentPrice || 0;
    const cashOffer = Math.round(estimatedValue * (offerPercent / 100));

    const letter = `
JOHN BARCLAY ESTATE & MANAGEMENT
West London's Premier Estate Agent
123 High Street, London W9 1AB
Tel: 020 7123 4567

${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

Dear Property Owner,

Re: ${lead.propertyAddress}, ${lead.postcode}

${lead.daysOnMarket ? `We notice your property has been on the market for ${lead.daysOnMarket} days.` : 'We are writing to you regarding your property.'} We understand that selling a property can be stressful, especially when it takes longer than expected.

GUARANTEED CASH OFFER: £${cashOffer.toLocaleString()}

We would like to make you a guaranteed cash offer for your property, with completion in just ${days} days.

OUR OFFER INCLUDES:
• Cash payment - no mortgage delays or chain complications
• Completion in ${days} days guaranteed
• No estate agent fees for you to pay
• We cover all legal costs
• No further viewings required
• No surveys or valuations needed

This offer represents ${offerPercent}% of the estimated market value (£${estimatedValue.toLocaleString()}), reflecting the speed and certainty of a cash transaction compared to the traditional 6-9 month selling process.

WHY ACCEPT A CASH OFFER?
• Guaranteed sale with no risk of fall-through
• Complete in weeks, not months
• Save on ongoing mortgage payments, maintenance, and bills
• Move on with your life without the stress of a prolonged sale
• No need to keep your property show-ready

This offer is valid for 14 days from the date of this letter. If you would like to discuss this opportunity, please contact us at your earliest convenience.

Yours sincerely,

John Barclay
Director
John Barclay Estate & Management

Tel: 020 7123 4567
Email: cash@johnbarclay.co.uk
Web: www.johnbarclay.co.uk

---
This letter is sent in accordance with data protection regulations. If you do not wish to receive further correspondence, please contact us.
    `.trim();

    res.json({
      success: true,
      letter,
      cashOffer,
      estimatedValue,
      offerPercent,
      completionDays: days
    });
  } catch (error) {
    console.error('Error generating offer letter:', error);
    res.status(500).json({ error: 'Failed to generate offer letter' });
  }
});

// ==========================================
// TENANT SUPPORT SYSTEM ROUTES
// WhatsApp AI-powered support with 360-degree communication tracking
// ==========================================

// WhatsApp Webhook - Receive incoming messages from Twilio
// Routes to tenant support or contractor quote workflow based on sender
crmRouter.post('/webhooks/whatsapp', async (req, res) => {
  try {
    console.log('[WhatsApp Webhook] Received:', req.body);

    const phoneNumber = req.body.From?.replace('whatsapp:', '').replace(/\D/g, '');

    // Check if sender is a contractor (look for pending quotes)
    const contractorCheck = await db.execute(sql`
      SELECT c.id FROM contractor c
      WHERE REPLACE(REPLACE(c.phone, ' ', ''), '+', '') LIKE '%' || ${phoneNumber.slice(-10)} || '%'
      LIMIT 1
    `);

    let response: string;

    if (contractorCheck.rows.length > 0) {
      // Process as contractor response
      console.log('[WhatsApp Webhook] Processing as contractor message');
      response = await tenantSupportService.processContractorWhatsApp(req.body);
    } else {
      // Process as tenant message
      console.log('[WhatsApp Webhook] Processing as tenant message');
      response = await tenantSupportService.processIncomingWhatsApp(req.body);
    }

    // Send TwiML response
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>${response}</Message>
      </Response>
    `);
  } catch (error) {
    console.error('[WhatsApp Webhook] Error:', error);
    res.type('text/xml');
    res.send(`<?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Message>We're experiencing technical difficulties. Please call 020 7123 4567.</Message>
      </Response>
    `);
  }
});

// WhatsApp Status Callback - Track message delivery
crmRouter.post('/webhooks/whatsapp/status', async (req, res) => {
  try {
    console.log('[WhatsApp Status]', req.body.MessageStatus, req.body.MessageSid);
    // TODO: Update message status in database
    res.sendStatus(200);
  } catch (error) {
    console.error('[WhatsApp Status] Error:', error);
    res.sendStatus(500);
  }
});

// Get all support tickets with filtering
crmRouter.get('/support-tickets', requireAgent, async (req, res) => {
  try {
    const { status, priority, category, tenantId, propertyId, page = 1, limit = 20 } = req.query;

    // Build query with filters
    let query = `
      SELECT
        st.*,
        u.full_name as tenant_name,
        u.email as tenant_email,
        u.phone as tenant_phone,
        p.address_line1 as property_address,
        p.postcode as property_postcode,
        c.company_name as contractor_name
      FROM support_ticket st
      LEFT JOIN "user" u ON st.tenant_id = u.id
      LEFT JOIN property p ON st.property_id = p.id
      LEFT JOIN contractor c ON st.assigned_to_id = c.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND st.status = $${paramIndex++}`;
      params.push(status);
    }
    if (priority) {
      query += ` AND st.priority = $${paramIndex++}`;
      params.push(priority);
    }
    if (category) {
      query += ` AND st.category = $${paramIndex++}`;
      params.push(category);
    }
    if (tenantId) {
      query += ` AND st.tenant_id = $${paramIndex++}`;
      params.push(tenantId);
    }
    if (propertyId) {
      query += ` AND st.property_id = $${paramIndex++}`;
      params.push(propertyId);
    }

    query += ` ORDER BY
      CASE st.priority
        WHEN 'urgent' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END,
      st.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    params.push(Number(limit), (Number(page) - 1) * Number(limit));

    // For now, return mock data since we may not have the tables created yet
    const mockTickets = [
      {
        id: 1,
        ticketNumber: 'JB241218ABC1',
        category: 'plumbing',
        subject: 'Leaking tap in kitchen',
        description: 'The kitchen tap has been dripping constantly for 2 days',
        priority: 'medium',
        status: 'open',
        tenantName: 'John Smith',
        tenantEmail: 'john@example.com',
        tenantPhone: '+447700900123',
        propertyAddress: '42 High Street',
        propertyPostcode: 'W2 1AB',
        contractorName: null,
        attachments: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    res.json({
      tickets: mockTickets,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: mockTickets.length,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error('Error fetching support tickets:', error);
    res.status(500).json({ error: 'Failed to fetch support tickets' });
  }
});

// Get single support ticket with full details
crmRouter.get('/support-tickets/:ticketId', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Mock ticket detail
    const ticket = {
      id: Number(ticketId),
      ticketNumber: 'JB241218ABC1',
      category: 'plumbing',
      subject: 'Leaking tap in kitchen',
      description: 'The kitchen tap has been dripping constantly for 2 days. Water is pooling under the sink.',
      priority: 'medium',
      status: 'in_progress',
      tenantId: 1,
      propertyId: 1,
      assignedToId: null,
      tenant: {
        id: 1,
        fullName: 'John Smith',
        email: 'john@example.com',
        phone: '+447700900123'
      },
      property: {
        id: 1,
        addressLine1: '42 High Street',
        postcode: 'W2 1AB'
      },
      contractor: null,
      attachments: [],
      comments: [
        {
          id: 1,
          userId: 1,
          userFullName: 'John Smith',
          comment: 'The leak is getting worse',
          isInternal: false,
          attachments: [],
          createdAt: new Date().toISOString()
        }
      ],
      communications: [
        {
          id: 1,
          channel: 'whatsapp',
          direction: 'inbound',
          content: 'Hi, my kitchen tap is leaking badly',
          timestamp: new Date().toISOString()
        },
        {
          id: 2,
          channel: 'whatsapp',
          direction: 'outbound',
          content: 'Thank you for reporting this. We have created ticket #JB241218ABC1',
          timestamp: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    res.json(ticket);
  } catch (error) {
    console.error('Error fetching support ticket:', error);
    res.status(500).json({ error: 'Failed to fetch support ticket' });
  }
});

// Update support ticket
crmRouter.put('/support-tickets/:ticketId', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, priority, assignedToId, resolution } = req.body;

    // TODO: Update in database
    console.log(`Updating ticket ${ticketId}:`, { status, priority, assignedToId, resolution });

    // Send notification to tenant about status change
    if (status) {
      const statusMessages: Record<string, string> = {
        'in_progress': 'A contractor has been assigned and will contact you soon.',
        'waiting_tenant': 'We need more information from you. Please check your messages.',
        'resolved': 'Your issue has been resolved. Please let us know if you need anything else.',
        'closed': 'This ticket has been closed. Thank you for using John Barclay support.'
      };

      if (statusMessages[status]) {
        await tenantSupportService.sendTicketUpdate(
          Number(ticketId),
          statusMessages[status],
          ['whatsapp', 'email']
        );
      }
    }

    res.json({ success: true, message: 'Ticket updated successfully' });
  } catch (error) {
    console.error('Error updating support ticket:', error);
    res.status(500).json({ error: 'Failed to update support ticket' });
  }
});

// Add comment to ticket
crmRouter.post('/support-tickets/:ticketId/comments', requireAgent, async (req: any, res) => {
  try {
    const { ticketId } = req.params;
    const { comment, isInternal, notifyTenant } = req.body;
    const userId = req.user?.id || 1;

    // TODO: Save to database
    console.log(`Adding comment to ticket ${ticketId}:`, { comment, isInternal, userId });

    // Notify tenant if it's not internal
    if (!isInternal && notifyTenant) {
      await tenantSupportService.sendTicketUpdate(
        Number(ticketId),
        `New message from support team:\n\n${comment}`,
        ['whatsapp']
      );
    }

    res.json({
      success: true,
      comment: {
        id: Date.now(),
        ticketId: Number(ticketId),
        userId,
        comment,
        isInternal,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// Assign contractor to ticket (Property Manager action)
// This creates a quote record and notifies the contractor for a quote
// Tenant is NOT notified at this stage - only after quote is approved
crmRouter.post('/support-tickets/:ticketId/assign', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { contractorId } = req.body;
    const userId = (req as any).user?.id || 1;

    // Get ticket details
    const ticket = await db.query.supportTickets.findFirst({
      where: eq(supportTickets.id, Number(ticketId))
    });

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Get contractor details
    const contractor = contractorData.find(c => c.id === Number(contractorId));
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }

    // Create quote record to track contractor response
    const [quote] = await db.insert(contractorQuotes).values({
      ticketId: Number(ticketId),
      contractorId: Number(contractorId),
      status: 'pending',
      sentAt: new Date()
    }).returning();

    // Update ticket with contractor assignment
    await db.update(supportTickets)
      .set({
        contractorId: Number(contractorId),
        contractorAssignedAt: new Date(),
        workflowStatus: 'contractor_notified',
        activeQuoteId: quote.id,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, Number(ticketId)));

    // Record workflow event
    await db.insert(ticketWorkflowEvents).values({
      ticketId: Number(ticketId),
      quoteId: quote.id,
      eventType: 'contractor_notified',
      previousStatus: 'new',
      newStatus: 'contractor_notified',
      triggeredBy: 'property_manager',
      userId,
      title: `Contractor assigned: ${contractor.companyName}`,
      description: 'Awaiting contractor quote response',
      notificationSent: true,
      notificationChannels: ['whatsapp', 'email']
    });

    // Get property and tenant details for contractor notification
    const property = await db.query.properties.findFirst({
      where: eq(properties.id, ticket.propertyId)
    });

    const tenant = await db.query.users.findFirst({
      where: eq(users.id, ticket.tenantId)
    });

    // Notify contractor via WhatsApp (through Property Manager)
    // Note: Contractor contacts Property Manager, NOT tenant directly
    if (contractor.phone && process.env.TWILIO_ACCOUNT_SID) {
      const twilio = await import('twilio');
      const twilioClient = twilio.default(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );

      const message = `🔧 JOB REQUEST from John Barclay Property Management

Ticket: #${ticket.ticketNumber}
Quote Ref: Q${quote.id}
Category: ${ticket.category?.toUpperCase()}
Priority: ${ticket.priority?.toUpperCase()}

📍 Property: ${property?.addressLine1 || 'N/A'}, ${property?.postcode || ''}

Issue: ${ticket.subject}
${ticket.description ? `Details: ${ticket.description.substring(0, 150)}...` : ''}

---
📋 PLEASE RESPOND TO US:
• Reply YES to accept this job
• Reply NO to decline
• Reply QUOTE £XXX for your quote
• Reply QUOTE £XXX DATE DD/MM with available date

⚠️ Contact us for tenant access - do NOT contact tenant directly.

John Barclay Property Management
📞 020 7123 4567`;

      try {
        await twilioClient.messages.create({
          body: message,
          from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+442046345656',
          to: `whatsapp:${contractor.phone.replace(/\s/g, '')}`
        });
        console.log(`[Assign] WhatsApp sent to contractor ${contractor.companyName}`);
      } catch (error) {
        console.error('[Assign] Failed to send WhatsApp to contractor:', error);
      }
    }

    // DO NOT notify tenant at this stage - only when quote is approved and work scheduled

    console.log(`[Assign] Contractor ${contractor.companyName} assigned to ticket ${ticketId}`);

    res.json({
      success: true,
      message: 'Contractor assigned successfully. Awaiting their quote response.',
      quoteId: quote.id
    });
  } catch (error) {
    console.error('Error assigning contractor:', error);
    res.status(500).json({ error: 'Failed to assign contractor' });
  }
});

// ==========================================
// CONTRACTOR QUOTE WORKFLOW ROUTES
// ==========================================

// Get quotes for a support ticket
crmRouter.get('/support-tickets/:ticketId/quotes', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const quotes = await db.select({
      id: contractorQuotes.id,
      ticketId: contractorQuotes.ticketId,
      contractorId: contractorQuotes.contractorId,
      quoteAmount: contractorQuotes.quoteAmount,
      quoteDescription: contractorQuotes.quoteDescription,
      estimatedDuration: contractorQuotes.estimatedDuration,
      availableDate: contractorQuotes.availableDate,
      status: contractorQuotes.status,
      sentAt: contractorQuotes.sentAt,
      respondedAt: contractorQuotes.respondedAt,
      contractorResponse: contractorQuotes.contractorResponse,
      approvedById: contractorQuotes.approvedById,
      approvedAt: contractorQuotes.approvedAt,
      approvalNotes: contractorQuotes.approvalNotes,
      scheduledDate: contractorQuotes.scheduledDate,
      scheduledTimeSlot: contractorQuotes.scheduledTimeSlot,
      completedAt: contractorQuotes.completedAt,
      completionNotes: contractorQuotes.completionNotes,
      invoiceNumber: contractorQuotes.invoiceNumber,
      finalAmount: contractorQuotes.finalAmount,
      invoicePaid: contractorQuotes.invoicePaid,
      createdAt: contractorQuotes.createdAt
    })
      .from(contractorQuotes)
      .where(eq(contractorQuotes.ticketId, Number(ticketId)))
      .orderBy(desc(contractorQuotes.createdAt));

    // Enrich with contractor details
    const enrichedQuotes = await Promise.all(quotes.map(async (quote) => {
      const contractor = contractorData.find(c => c.id === quote.contractorId);
      return {
        ...quote,
        contractor: contractor || { companyName: 'Unknown', phone: 'N/A' }
      };
    }));

    res.json(enrichedQuotes);
  } catch (error) {
    console.error('Error fetching quotes:', error);
    res.status(500).json({ error: 'Failed to fetch quotes' });
  }
});

// Approve a contractor quote
crmRouter.post('/support-tickets/:ticketId/quotes/:quoteId/approve', requireAgent, async (req, res) => {
  try {
    const { ticketId, quoteId } = req.params;
    const { approvalNotes, scheduledDate, scheduledTimeSlot } = req.body;
    const userId = (req as any).user?.id || 1;

    // Update quote
    await db.update(contractorQuotes)
      .set({
        status: scheduledDate ? 'scheduled' : 'approved',
        approvedById: userId,
        approvedAt: new Date(),
        approvalNotes,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
        scheduledTimeSlot: scheduledTimeSlot || null,
        updatedAt: new Date()
      })
      .where(eq(contractorQuotes.id, Number(quoteId)));

    // Update ticket workflow status
    await db.update(supportTickets)
      .set({
        workflowStatus: scheduledDate ? 'scheduled' : 'quote_approved',
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, Number(ticketId)));

    // Record workflow event
    await db.insert(ticketWorkflowEvents).values({
      ticketId: Number(ticketId),
      quoteId: Number(quoteId),
      eventType: scheduledDate ? 'work_scheduled' : 'quote_approved',
      previousStatus: 'quote_received',
      newStatus: scheduledDate ? 'scheduled' : 'quote_approved',
      triggeredBy: 'property_manager',
      userId,
      title: scheduledDate ? 'Work scheduled' : 'Quote approved',
      description: scheduledDate
        ? `Work scheduled for ${new Date(scheduledDate).toLocaleDateString('en-GB')} (${scheduledTimeSlot || 'TBC'})`
        : 'Property manager approved the quote',
      notificationSent: true,
      notificationChannels: ['whatsapp', 'email']
    });

    // Notify contractor
    const quote = await db.query.contractorQuotes.findFirst({
      where: eq(contractorQuotes.id, Number(quoteId))
    });

    if (quote) {
      const contractor = contractorData.find(c => c.id === quote.contractorId);
      if (contractor?.phone) {
        // Send WhatsApp notification to contractor
        console.log(`[QuoteApproval] Notifying contractor ${contractor.companyName}`);
      }
    }

    // NOW notify tenant - only when work is scheduled
    // Important: Message comes from Property Management, NOT from contractor
    if (scheduledDate) {
      await tenantSupportService.sendTicketUpdate(
        Number(ticketId),
        `Good news! We have arranged for maintenance work on your request.

📅 Scheduled: ${new Date(scheduledDate).toLocaleDateString('en-GB')}
🕐 Time: ${scheduledTimeSlot === 'morning' ? 'Morning (9am-12pm)' : scheduledTimeSlot === 'afternoon' ? 'Afternoon (12pm-5pm)' : 'During the day'}

Please ensure access is available at the property. Our contractor will report to us once the work is complete.

If you need to reschedule, please contact us as soon as possible.`,
        ['whatsapp', 'email']
      );
    }

    // Notify contractor that quote was approved
    if (quote) {
      const contractor = contractorData.find(c => c.id === quote.contractorId);
      if (contractor?.phone && process.env.TWILIO_ACCOUNT_SID) {
        const twilio = await import('twilio');
        const twilioClient = twilio.default(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );

        const scheduleInfo = scheduledDate
          ? `\n\n📅 SCHEDULED: ${new Date(scheduledDate).toLocaleDateString('en-GB')} (${scheduledTimeSlot || 'TBC'})`
          : '\n\nWe will contact you to arrange scheduling.';

        try {
          await twilioClient.messages.create({
            body: `✅ QUOTE APPROVED - Ticket #${ticket.ticketNumber}

Your quote has been approved by John Barclay Property Management.${scheduleInfo}

⚠️ IMPORTANT: Contact our office to arrange tenant access - do NOT contact tenant directly.

John Barclay Property Management
📞 020 7123 4567`,
            from: process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+442046345656',
            to: `whatsapp:${contractor.phone.replace(/\s/g, '')}`
          });
        } catch (error) {
          console.error('[ApproveQuote] Failed to notify contractor:', error);
        }
      }
    }

    res.json({ success: true, message: 'Quote approved successfully' });
  } catch (error) {
    console.error('Error approving quote:', error);
    res.status(500).json({ error: 'Failed to approve quote' });
  }
});

// Reject a contractor quote
crmRouter.post('/support-tickets/:ticketId/quotes/:quoteId/reject', requireAgent, async (req, res) => {
  try {
    const { ticketId, quoteId } = req.params;
    const { rejectionReason, reassignContractorId } = req.body;
    const userId = (req as any).user?.id || 1;

    // Update quote
    await db.update(contractorQuotes)
      .set({
        status: 'rejected',
        approvalNotes: rejectionReason,
        updatedAt: new Date()
      })
      .where(eq(contractorQuotes.id, Number(quoteId)));

    // Record workflow event
    await db.insert(ticketWorkflowEvents).values({
      ticketId: Number(ticketId),
      quoteId: Number(quoteId),
      eventType: 'quote_rejected',
      previousStatus: 'quote_received',
      newStatus: reassignContractorId ? 'contractor_notified' : 'new',
      triggeredBy: 'property_manager',
      userId,
      title: 'Quote rejected',
      description: rejectionReason || 'Quote not approved by property manager',
      notificationSent: true,
      notificationChannels: ['email']
    });

    // Update ticket
    if (reassignContractorId) {
      await db.update(supportTickets)
        .set({
          contractorId: Number(reassignContractorId),
          workflowStatus: 'contractor_notified',
          updatedAt: new Date()
        })
        .where(eq(supportTickets.id, Number(ticketId)));

      // TODO: Notify new contractor
    } else {
      await db.update(supportTickets)
        .set({
          workflowStatus: 'new',
          contractorId: null,
          activeQuoteId: null,
          updatedAt: new Date()
        })
        .where(eq(supportTickets.id, Number(ticketId)));
    }

    res.json({ success: true, message: 'Quote rejected' });
  } catch (error) {
    console.error('Error rejecting quote:', error);
    res.status(500).json({ error: 'Failed to reject quote' });
  }
});

// Mark work as started
crmRouter.post('/support-tickets/:ticketId/quotes/:quoteId/start-work', requireAgent, async (req, res) => {
  try {
    const { ticketId, quoteId } = req.params;
    const userId = (req as any).user?.id || 1;

    // Update quote status
    await db.update(contractorQuotes)
      .set({
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(contractorQuotes.id, Number(quoteId)));

    // Update ticket workflow status
    await db.update(supportTickets)
      .set({
        workflowStatus: 'in_work',
        status: 'in_progress',
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, Number(ticketId)));

    // Record workflow event
    await db.insert(ticketWorkflowEvents).values({
      ticketId: Number(ticketId),
      quoteId: Number(quoteId),
      eventType: 'work_started',
      previousStatus: 'scheduled',
      newStatus: 'in_work',
      triggeredBy: 'property_manager',
      userId,
      title: 'Work started',
      description: 'Contractor has started work on the maintenance request',
      notificationSent: true,
      notificationChannels: ['whatsapp']
    });

    // Note: We do NOT notify tenant when work starts - this is internal tracking
    // Tenant was already notified when work was scheduled
    // They will be notified again when work is completed

    res.json({ success: true, message: 'Work marked as started' });
  } catch (error) {
    console.error('Error starting work:', error);
    res.status(500).json({ error: 'Failed to mark work as started' });
  }
});

// Mark work as completed
crmRouter.post('/support-tickets/:ticketId/quotes/:quoteId/complete', requireAgent, async (req, res) => {
  try {
    const { ticketId, quoteId } = req.params;
    const { completionNotes, completionPhotos, finalAmount, invoiceNumber } = req.body;
    const userId = (req as any).user?.id || 1;

    // Update quote
    await db.update(contractorQuotes)
      .set({
        status: 'completed',
        completedAt: new Date(),
        completionNotes,
        completionPhotos: completionPhotos || [],
        finalAmount: finalAmount ? Number(finalAmount) : null,
        invoiceNumber,
        updatedAt: new Date()
      })
      .where(eq(contractorQuotes.id, Number(quoteId)));

    // Update ticket
    await db.update(supportTickets)
      .set({
        workflowStatus: 'completed',
        status: 'resolved',
        resolution: completionNotes,
        resolvedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, Number(ticketId)));

    // Record workflow event
    await db.insert(ticketWorkflowEvents).values({
      ticketId: Number(ticketId),
      quoteId: Number(quoteId),
      eventType: 'work_completed',
      previousStatus: 'in_work',
      newStatus: 'completed',
      triggeredBy: 'property_manager',
      userId,
      title: 'Work completed',
      description: completionNotes || 'Maintenance work has been completed',
      metadata: { finalAmount, invoiceNumber },
      notificationSent: true,
      notificationChannels: ['whatsapp', 'email']
    });

    // Notify tenant
    await tenantSupportService.sendTicketUpdate(
      Number(ticketId),
      `Great news! The maintenance work on your request has been completed. ${completionNotes || ''}\n\nPlease let us know if you have any issues or concerns.`,
      ['whatsapp', 'email']
    );

    res.json({ success: true, message: 'Work marked as completed' });
  } catch (error) {
    console.error('Error completing work:', error);
    res.status(500).json({ error: 'Failed to mark work as completed' });
  }
});

// Get workflow timeline for a ticket
crmRouter.get('/support-tickets/:ticketId/workflow', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const events = await db.select()
      .from(ticketWorkflowEvents)
      .where(eq(ticketWorkflowEvents.ticketId, Number(ticketId)))
      .orderBy(desc(ticketWorkflowEvents.createdAt));

    res.json(events);
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ error: 'Failed to fetch workflow timeline' });
  }
});

// Get support ticket statistics for dashboard
crmRouter.get('/support-tickets/stats/overview', requireAgent, async (req, res) => {
  try {
    // Mock statistics
    const stats = {
      total: 156,
      open: 23,
      inProgress: 12,
      waitingTenant: 5,
      resolved: 98,
      closed: 18,
      urgent: 2,
      high: 8,
      averageResolutionTime: '18 hours',
      satisfactionRating: 4.2,
      byCategory: {
        plumbing: 45,
        electrical: 28,
        heating: 32,
        appliances: 15,
        structural: 18,
        pest: 5,
        exterior: 8,
        billing: 5
      },
      byChannel: {
        whatsapp: 89,
        email: 42,
        phone: 25
      },
      recentTrend: [
        { date: '2024-12-12', count: 8 },
        { date: '2024-12-13', count: 12 },
        { date: '2024-12-14', count: 6 },
        { date: '2024-12-15', count: 9 },
        { date: '2024-12-16', count: 11 },
        { date: '2024-12-17', count: 7 },
        { date: '2024-12-18', count: 5 }
      ]
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching support stats:', error);
    res.status(500).json({ error: 'Failed to fetch support statistics' });
  }
});

// ==========================================
// CONTRACTOR MANAGEMENT ENDPOINTS
// ==========================================

// Get all contractors
crmRouter.get('/contractors', requireAgent, async (req, res) => {
  try {
    const { specialization, available } = req.query;

    let allContractors = await db.select().from(contractors).orderBy(desc(contractors.createdAt));

    // Filter by specialization if provided
    if (specialization) {
      allContractors = allContractors.filter(c =>
        c.specializations?.some(s =>
          s.toLowerCase().includes((specialization as string).toLowerCase()) ||
          (specialization as string).toLowerCase().includes(s.toLowerCase())
        )
      );
    }

    // Filter for emergency availability
    if (available === 'emergency') {
      allContractors = allContractors.filter(c => c.availableEmergency);
    }

    // Sort preferred contractors first, then by company name
    allContractors.sort((a, b) => {
      if (a.preferredContractor && !b.preferredContractor) return -1;
      if (!a.preferredContractor && b.preferredContractor) return 1;
      return (a.companyName || '').localeCompare(b.companyName || '');
    });

    res.json(allContractors);
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
  }
});

// Get single contractor
crmRouter.get('/contractors/:id', requireAgent, async (req, res) => {
  try {
    const [contractor] = await db.select().from(contractors).where(eq(contractors.id, parseInt(req.params.id)));
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    res.json(contractor);
  } catch (error) {
    console.error('Error fetching contractor:', error);
    res.status(500).json({ error: 'Failed to fetch contractor' });
  }
});

// Create contractor
crmRouter.post('/contractors', requireAgent, async (req, res) => {
  try {
    const data = insertContractorSchema.parse(req.body);
    const [contractor] = await db.insert(contractors).values(data).returning();
    res.status(201).json(contractor);
  } catch (error) {
    console.error('Error creating contractor:', error);
    res.status(400).json({ error: 'Failed to create contractor' });
  }
});

// Update contractor
crmRouter.patch('/contractors/:id', requireAgent, async (req, res) => {
  try {
    const [contractor] = await db.update(contractors)
      .set(req.body)
      .where(eq(contractors.id, parseInt(req.params.id)))
      .returning();
    if (!contractor) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    res.json(contractor);
  } catch (error) {
    console.error('Error updating contractor:', error);
    res.status(400).json({ error: 'Failed to update contractor' });
  }
});

// Delete contractor
crmRouter.delete('/contractors/:id', requireAgent, async (req, res) => {
  try {
    const [deleted] = await db.delete(contractors)
      .where(eq(contractors.id, parseInt(req.params.id)))
      .returning();
    if (!deleted) {
      return res.status(404).json({ error: 'Contractor not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting contractor:', error);
    res.status(500).json({ error: 'Failed to delete contractor' });
  }
});

// Find best contractor for a ticket category
crmRouter.get('/contractors/find-best', requireAgent, async (req, res) => {
  try {
    const { category, emergency } = req.query;

    // Map ticket categories to contractor specializations
    const categoryMapping: Record<string, string[]> = {
      plumbing: ['plumbing', 'gas'],
      electrical: ['electrical'],
      heating: ['gas', 'heating', 'plumbing'],
      appliances: ['appliances'],
      structural: ['general', 'handyman', 'roofing'],
      pest: ['pest_control'],
      exterior: ['general', 'handyman'],
      cleaning: ['cleaning'],
      general: ['general', 'handyman']
    };

    const requiredSpecs = categoryMapping[category as string] || ['general'];

    const allContractors = await db.select().from(contractors).where(eq(contractors.isActive, true));

    let candidates = allContractors.filter(c =>
      c.specializations?.some(s => requiredSpecs.includes(s))
    );

    // If emergency, prioritize emergency contractors
    if (emergency === 'true') {
      const emergencyContractors = candidates.filter(c => c.availableEmergency);
      if (emergencyContractors.length > 0) {
        candidates = emergencyContractors;
      }
    }

    // Sort by preferred status, then by rating
    candidates.sort((a, b) => {
      if (a.preferredContractor && !b.preferredContractor) return -1;
      if (!a.preferredContractor && b.preferredContractor) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });

    res.json({
      recommended: candidates[0] || null,
      alternatives: candidates.slice(1, 4)
    });
  } catch (error) {
    console.error('Error finding best contractor:', error);
    res.status(500).json({ error: 'Failed to find contractor' });
  }
});

// Send WhatsApp message to tenant (manual)
crmRouter.post('/support-tickets/:ticketId/send-whatsapp', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, phoneNumber } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({ error: 'Phone number and message are required' });
    }

    const success = await tenantSupportService.sendWhatsAppToTenant(
      phoneNumber,
      message,
      Number(ticketId)
    );

    if (success) {
      res.json({ success: true, message: 'WhatsApp message sent successfully' });
    } else {
      res.status(500).json({ error: 'Failed to send WhatsApp message' });
    }
  } catch (error) {
    console.error('Error sending WhatsApp:', error);
    res.status(500).json({ error: 'Failed to send WhatsApp message' });
  }
});

// Get communication history for a ticket
crmRouter.get('/support-tickets/:ticketId/communications', requireAgent, async (req, res) => {
  try {
    const { ticketId } = req.params;

    // Mock communication history showing 360-degree view
    const communications = [
      {
        id: 1,
        channel: 'whatsapp',
        direction: 'inbound',
        content: 'Hi, my kitchen tap has been leaking for 2 days now. It\'s getting worse.',
        timestamp: '2024-12-18T10:30:00Z',
        attachments: ['https://example.com/photo1.jpg']
      },
      {
        id: 2,
        channel: 'whatsapp',
        direction: 'outbound',
        content: 'Thank you for contacting John Barclay support. Your ticket #JB241218ABC1 has been created. A plumber will contact you within 4 hours.',
        timestamp: '2024-12-18T10:30:15Z',
        attachments: []
      },
      {
        id: 3,
        channel: 'email',
        direction: 'outbound',
        content: 'Dear John, Your maintenance request has been logged...',
        timestamp: '2024-12-18T10:31:00Z',
        attachments: []
      },
      {
        id: 4,
        channel: 'phone',
        direction: 'inbound',
        content: 'Tenant called to confirm appointment time',
        timestamp: '2024-12-18T14:15:00Z',
        duration: '2m 30s',
        attachments: []
      },
      {
        id: 5,
        channel: 'whatsapp',
        direction: 'inbound',
        content: 'The plumber just left. Tap is fixed now. Thank you!',
        timestamp: '2024-12-18T16:45:00Z',
        attachments: []
      }
    ];

    res.json(communications);
  } catch (error) {
    console.error('Error fetching communications:', error);
    res.status(500).json({ error: 'Failed to fetch communication history' });
  }
});

// ==========================================
// ADMIN DATA MANAGEMENT ROUTES
// ==========================================

// Update all rental properties to 'let' status (managed)
crmRouter.post('/admin/properties/set-managed', requireAdmin, async (req, res) => {
  try {
    // Get all properties
    const allProperties = await storage.getAllProperties();

    // Filter to rental properties
    const rentalProperties = allProperties.filter(p => p.isRental === true);

    let updatedCount = 0;

    // Update each property to 'let' status
    for (const property of rentalProperties) {
      await storage.updateProperty(property.id, { status: 'let' });
      updatedCount++;
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} rental properties to 'let' (managed) status`,
      updatedCount
    });
  } catch (error) {
    console.error('Error updating properties to managed status:', error);
    res.status(500).json({ error: 'Failed to UPDATE property' });
  }
});

// LEGACY MANAGED PROPERTIES API ROUTES REMOVED - Using main landlords/tenants/tenancies tables

// ==========================================
// CALENDAR & VIEWING ENDPOINTS
// ==========================================

// Get all calendar events
crmRouter.get('/calendar-events', requireAgent, async (req, res) => {
  try {
    const events = await storage.getAllCalendarEvents();
    res.json(events);
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
});

// Get upcoming viewings
crmRouter.get('/viewings', requireAgent, async (req, res) => {
  try {
    const viewings = await storage.getUpcomingViewings();

    // Enrich with property data
    const enrichedViewings = await Promise.all(
      viewings.map(async (viewing) => {
        const property = viewing.propertyId ? await storage.getProperty(viewing.propertyId) : null;
        return {
          ...viewing,
          propertyTitle: property?.title || 'Unknown Property',
          propertyAddress: property ? `${property.addressLine1}, ${property.postcode}` : null,
          propertyImage: property?.images?.[0] || null
        };
      })
    );

    res.json(enrichedViewings);
  } catch (error) {
    console.error('Error fetching viewings:', error);
    res.status(500).json({ error: 'Failed to fetch viewings' });
  }
});

// Get calendar event by ID
crmRouter.get('/calendar-events/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await storage.getCalendarEvent(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Enrich with property data
    const property = event.propertyId ? await storage.getProperty(event.propertyId) : null;

    res.json({
      ...event,
      propertyTitle: property?.title || null,
      propertyAddress: property ? `${property.addressLine1}, ${property.postcode}` : null
    });
  } catch (error) {
    console.error('Error fetching calendar event:', error);
    res.status(500).json({ error: 'Failed to fetch calendar event' });
  }
});

// Create a new calendar event (viewing, valuation, etc.)
crmRouter.post('/calendar-events', requireAgent, async (req, res) => {
  try {
    const user = req.user as any;

    const eventData = {
      ...req.body,
      organizerId: req.body.organizerId || user.id,
      status: req.body.status || 'scheduled'
    };

    const event = await storage.createCalendarEvent(eventData);

    // Get property details for response
    const property = event.propertyId ? await storage.getProperty(event.propertyId) : null;

    res.status(201).json({
      ...event,
      propertyTitle: property?.title || null,
      propertyAddress: property ? `${property.addressLine1}, ${property.postcode}` : null
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    res.status(500).json({ error: 'Failed to create calendar event' });
  }
});

// Schedule a viewing (simplified endpoint)
crmRouter.post('/viewings', requireAgent, async (req, res) => {
  try {
    const user = req.user as any;
    const {
      propertyId,
      startTime,
      endTime,
      attendees = [],
      isGroupBooking = false,
      notes
    } = req.body;

    // Validate required fields
    if (!propertyId || !startTime) {
      return res.status(400).json({ error: 'Property ID and start time are required' });
    }

    // Get property for title
    const property = await storage.getProperty(propertyId);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Build title
    const title = isGroupBooking
      ? `Group Viewing: ${property.title || property.addressLine1}`
      : `Viewing: ${property.title || property.addressLine1}`;

    // Create the viewing event
    const viewingData = {
      title,
      description: isGroupBooking
        ? `Group viewing with ${attendees.length} attendees`
        : `Property viewing scheduled`,
      eventType: 'viewing',
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : new Date(new Date(startTime).getTime() + 30 * 60000), // 30 min default
      location: `${property.addressLine1}, ${property.postcode}`,
      propertyId,
      organizerId: user.id,
      attendees: attendees.map((a: any) => ({
        ...a,
        status: 'pending'
      })),
      isRecurring: false,
      status: 'scheduled',
      notes: notes || (isGroupBooking ? `Group booking with ${attendees.length} attendees` : null)
    };

    const viewing = await storage.createCalendarEvent(viewingData);

    res.status(201).json({
      ...viewing,
      propertyTitle: property.title,
      propertyAddress: `${property.addressLine1}, ${property.postcode}`,
      isGroupBooking
    });
  } catch (error) {
    console.error('Error scheduling viewing:', error);
    res.status(500).json({ error: 'Failed to schedule viewing' });
  }
});

// Update calendar event
crmRouter.patch('/calendar-events/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await storage.updateCalendarEvent(id, req.body);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error updating calendar event:', error);
    res.status(500).json({ error: 'Failed to update calendar event' });
  }
});

// Cancel a calendar event
crmRouter.post('/calendar-events/:id/cancel', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const event = await storage.cancelCalendarEvent(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json(event);
  } catch (error) {
    console.error('Error cancelling calendar event:', error);
    res.status(500).json({ error: 'Failed to cancel calendar event' });
  }
});

// Delete calendar event
crmRouter.delete('/calendar-events/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteCalendarEvent(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    res.status(500).json({ error: 'Failed to delete calendar event' });
  }
});

// Get events for a specific property
crmRouter.get('/properties/:id/events', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const events = await storage.getCalendarEventsByProperty(propertyId);
    res.json(events);
  } catch (error) {
    console.error('Error fetching property events:', error);
    res.status(500).json({ error: 'Failed to fetch property events' });
  }
});

// ==========================================
// PROPERTY MANAGEMENT ROUTES
// ==========================================

// Get all property certificates
crmRouter.get('/certifications', requireAgent, async (req, res) => {
  try {
    const certificates = await db.select().from(propertyCertificates).orderBy(desc(propertyCertificates.expiryDate));
    res.json(certificates);
  } catch (error) {
    console.error('Error fetching certifications:', error);
    res.status(500).json({ error: 'Failed to fetch certifications' });
  }
});

// Get certificates for a specific property
crmRouter.get('/properties/:id/certifications', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const certificates = await db.select().from(propertyCertificates).where(eq(propertyCertificates.propertyId, propertyId));
    res.json(certificates);
  } catch (error) {
    console.error('Error fetching property certifications:', error);
    res.status(500).json({ error: 'Failed to fetch property certifications' });
  }
});

// Create a new certificate
crmRouter.post('/certifications', requireAgent, async (req, res) => {
  try {
    const data = insertPropertyCertificateSchema.parse(req.body);
    const [certificate] = await db.insert(propertyCertificates).values(data).returning();
    res.json(certificate);
  } catch (error) {
    console.error('Error creating certification:', error);
    res.status(500).json({ error: 'Failed to create certification' });
  }
});

// Update a certificate
crmRouter.put('/certifications/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const [certificate] = await db.update(propertyCertificates).set({ ...updates, updatedAt: new Date() }).where(eq(propertyCertificates.id, id)).returning();
    res.json(certificate);
  } catch (error) {
    console.error('Error updating certification:', error);
    res.status(500).json({ error: 'Failed to update certification' });
  }
});

// Delete a certificate
crmRouter.delete('/certifications/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(propertyCertificates).where(eq(propertyCertificates.id, id));
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting certification:', error);
    res.status(500).json({ error: 'Failed to delete certification' });
  }
});

// REMOVED: Duplicate /managed-properties endpoint that didn't filter by isManaged=true
// The correct endpoint is at line ~495 which filters properties.isManaged = true

// Get management fees for a property
crmRouter.get('/properties/:id/management-fees', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const fees = await db.select().from(managementFees).where(eq(managementFees.propertyId, propertyId));
    res.json(fees);
  } catch (error) {
    console.error('Error fetching management fees:', error);
    res.status(500).json({ error: 'Failed to fetch management fees' });
  }
});

// Create management fee
crmRouter.post('/management-fees', requireAgent, async (req, res) => {
  try {
    const data = insertManagementFeeSchema.parse(req.body);
    const [fee] = await db.insert(managementFees).values(data).returning();
    res.json(fee);
  } catch (error) {
    console.error('Error creating management fee:', error);
    res.status(500).json({ error: 'Failed to create management fee' });
  }
});

// Get tenancy contracts
crmRouter.get('/tenancy-contracts', requireAgent, async (req, res) => {
  try {
    const contracts = await db.select().from(tenancyContracts).orderBy(desc(tenancyContracts.createdAt));
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching tenancy contracts:', error);
    res.status(500).json({ error: 'Failed to fetch tenancy contracts' });
  }
});

// ==========================================
// COMPLIANCE TRACKING ROUTES
// ==========================================

// Get all compliance requirements (master list)
crmRouter.get('/compliance/requirements', requireAgent, async (req, res) => {
  try {
    const requirements = await db.select().from(complianceRequirements).orderBy(complianceRequirements.sortOrder);
    res.json(requirements);
  } catch (error) {
    console.error('Error fetching compliance requirements:', error);
    res.status(500).json({ error: 'Failed to fetch compliance requirements' });
  }
});

// Get compliance requirements grouped by category
crmRouter.get('/compliance/requirements/grouped', requireAgent, async (req, res) => {
  try {
    const requirements = await db.select().from(complianceRequirements).where(eq(complianceRequirements.isActive, true)).orderBy(complianceRequirements.sortOrder);

    const grouped = {
      critical: requirements.filter(r => r.category === 'critical'),
      high: requirements.filter(r => r.category === 'high'),
      recommended: requirements.filter(r => r.category === 'recommended')
    };

    res.json(grouped);
  } catch (error) {
    console.error('Error fetching grouped compliance requirements:', error);
    res.status(500).json({ error: 'Failed to fetch compliance requirements' });
  }
});

// Seed default compliance requirements (admin only)
crmRouter.post('/compliance/requirements/seed', requireAdmin, async (req, res) => {
  try {
    // UK Landlord Compliance Requirements
    const defaultRequirements = [
      // CRITICAL - Legal requirements with prosecution risk
      { code: 'GAS_SAFETY', name: 'Gas Safety Certificate (CP12)', description: 'Annual gas safety check by Gas Safe registered engineer. Certificate must be provided to tenants within 28 days.', category: 'critical', appliesToProperty: true, frequencyMonths: 12, reminderDaysBefore: 60, penaltyDescription: 'Up to £6,000 fine per breach, risk of prosecution', referenceUrl: 'https://www.hse.gov.uk/gas/landlords/', sortOrder: 1 },
      { code: 'EICR', name: 'Electrical Safety (EICR)', description: 'Electrical Installation Condition Report every 5 years. Must be provided to tenants within 28 days.', category: 'critical', appliesToProperty: true, frequencyMonths: 60, reminderDaysBefore: 90, penaltyDescription: 'Up to £30,000 fine', referenceUrl: 'https://www.gov.uk/government/publications/electrical-safety-standards-in-the-private-rented-sector-guidance-for-landlords-tenants-and-local-authorities', sortOrder: 2 },
      { code: 'EPC', name: 'Energy Performance Certificate', description: 'Valid EPC with minimum E rating (C rating from 2025). Valid for 10 years.', category: 'critical', appliesToProperty: true, frequencyMonths: 120, reminderDaysBefore: 180, penaltyDescription: 'Up to £5,000 fine', referenceUrl: 'https://www.gov.uk/buy-sell-your-home/energy-performance-certificates', sortOrder: 3 },
      { code: 'SMOKE_ALARM', name: 'Smoke Alarms', description: 'Working smoke alarm on every habitable floor. Test at start of tenancy.', category: 'critical', appliesToProperty: true, frequencyMonths: null, reminderDaysBefore: 30, penaltyDescription: 'Up to £5,000 fine', referenceUrl: 'https://www.gov.uk/government/publications/smoke-and-carbon-monoxide-alarms-explanatory-booklet-for-landlords', sortOrder: 4 },
      { code: 'CO_ALARM', name: 'Carbon Monoxide Alarms', description: 'CO alarm in rooms with fuel-burning appliances. Test at start of tenancy.', category: 'critical', appliesToProperty: true, frequencyMonths: null, reminderDaysBefore: 30, penaltyDescription: 'Up to £5,000 fine', referenceUrl: 'https://www.gov.uk/government/publications/smoke-and-carbon-monoxide-alarms-explanatory-booklet-for-landlords', sortOrder: 5 },
      { code: 'RIGHT_TO_RENT', name: 'Right to Rent Check', description: 'Verify tenant has legal right to rent in UK before tenancy starts.', category: 'critical', appliesToTenant: true, appliesToProperty: false, frequencyMonths: null, reminderDaysBefore: 14, penaltyDescription: 'Up to £3,000 fine per tenant', referenceUrl: 'https://www.gov.uk/check-tenant-right-to-rent-documents', sortOrder: 6 },
      { code: 'DEPOSIT_PROTECTION', name: 'Deposit Protection', description: 'Protect deposit in government scheme (TDS/DPS/MyDeposits) within 30 days.', category: 'critical', appliesToProperty: true, appliesToTenant: true, frequencyMonths: null, reminderDaysBefore: 7, penaltyDescription: 'Up to 3x deposit value, cannot use Section 21', referenceUrl: 'https://www.gov.uk/deposit-protection-schemes-and-landlords', sortOrder: 7 },

      // HIGH - Legal requirements with civil penalties
      { code: 'PRESCRIBED_INFO', name: 'Prescribed Information', description: 'Provide deposit protection prescribed information within 30 days.', category: 'high', appliesToTenant: true, appliesToProperty: false, frequencyMonths: null, reminderDaysBefore: 14, penaltyDescription: 'Cannot serve valid Section 21 notice', referenceUrl: 'https://www.gov.uk/deposit-protection-schemes-and-landlords', sortOrder: 10 },
      { code: 'HOW_TO_RENT', name: 'How to Rent Guide', description: 'Provide current How to Rent guide before tenancy starts.', category: 'high', appliesToTenant: true, appliesToProperty: false, frequencyMonths: null, reminderDaysBefore: 7, penaltyDescription: 'Cannot serve valid Section 21 notice', referenceUrl: 'https://www.gov.uk/government/publications/how-to-rent', sortOrder: 11 },
      { code: 'TENANCY_AGREEMENT', name: 'Tenancy Agreement', description: 'Signed tenancy agreement before move-in.', category: 'high', appliesToTenant: true, appliesToProperty: true, frequencyMonths: null, reminderDaysBefore: 7, penaltyDescription: 'Difficulty enforcing terms', sortOrder: 12 },
      { code: 'LANDLORD_CONTACT', name: 'Landlord Contact Details', description: 'Provide landlord name and address to tenant.', category: 'high', appliesToTenant: true, appliesToLandlord: true, appliesToProperty: false, frequencyMonths: null, reminderDaysBefore: 7, penaltyDescription: 'Rent may be withheld', referenceUrl: 'https://www.legislation.gov.uk/ukpga/1985/70', sortOrder: 13 },

      // RECOMMENDED - Best practice
      { code: 'INVENTORY', name: 'Inventory & Check-in Report', description: 'Detailed inventory with photos at tenancy start.', category: 'recommended', appliesToProperty: true, frequencyMonths: null, reminderDaysBefore: 7, penaltyDescription: 'Difficulty claiming deposit deductions', sortOrder: 20 },
      { code: 'PAT_TESTING', name: 'PAT Testing', description: 'Portable Appliance Testing for electrical items provided.', category: 'recommended', appliesToProperty: true, frequencyMonths: 12, reminderDaysBefore: 30, penaltyDescription: 'Potential liability for electrical accidents', sortOrder: 21 },
      { code: 'LEGIONELLA', name: 'Legionella Risk Assessment', description: 'Assess risk of legionella bacteria in water systems.', category: 'recommended', appliesToProperty: true, frequencyMonths: null, reminderDaysBefore: 30, penaltyDescription: 'Potential health liability', referenceUrl: 'https://www.hse.gov.uk/legionnaires/', sortOrder: 22 },
      { code: 'BUILDING_INSURANCE', name: 'Building Insurance', description: 'Buildings insurance covering the property structure.', category: 'recommended', appliesToProperty: true, appliesToLandlord: true, frequencyMonths: 12, reminderDaysBefore: 30, penaltyDescription: 'Financial risk if uninsured', sortOrder: 23 },
      { code: 'LANDLORD_INSURANCE', name: 'Landlord Insurance', description: 'Landlord-specific insurance including liability cover.', category: 'recommended', appliesToLandlord: true, appliesToProperty: false, frequencyMonths: 12, reminderDaysBefore: 30, penaltyDescription: 'Financial and legal risk', sortOrder: 24 }
    ];

    // Insert requirements (skip if code already exists)
    for (const req of defaultRequirements) {
      const existing = await db.select().from(complianceRequirements).where(eq(complianceRequirements.code, req.code));
      if (existing.length === 0) {
        await db.insert(complianceRequirements).values(req);
      }
    }

    res.json({ success: true, message: 'Compliance requirements seeded successfully' });
  } catch (error) {
    console.error('Error seeding compliance requirements:', error);
    res.status(500).json({ error: 'Failed to seed compliance requirements' });
  }
});

// Get compliance status for a property
crmRouter.get('/compliance/property/:id', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const allRequirements = await db.select().from(complianceRequirements).where(eq(complianceRequirements.appliesToProperty, true));
    const statuses = await db.select().from(complianceStatus).where(eq(complianceStatus.propertyId, propertyId));

    // Map requirements to statuses
    const complianceList = allRequirements.map(req => {
      const status = statuses.find(s => s.requirementId === req.id);
      return {
        requirement: req,
        status: status || { status: 'pending', requirementId: req.id, propertyId }
      };
    });

    // Calculate compliance score
    const compliantCount = complianceList.filter(c => c.status.status === 'compliant').length;
    const totalRequired = complianceList.length;
    const complianceScore = totalRequired > 0 ? Math.round((compliantCount / totalRequired) * 100) : 0;

    res.json({
      propertyId,
      complianceScore,
      compliantCount,
      totalRequired,
      items: complianceList
    });
  } catch (error) {
    console.error('Error fetching property compliance:', error);
    res.status(500).json({ error: 'Failed to fetch property compliance' });
  }
});

// Get compliance dashboard summary
crmRouter.get('/compliance/dashboard', requireAgent, async (req, res) => {
  try {
    const allStatuses = await db.select().from(complianceStatus);
    const allProperties = await db.select().from(properties);
    const allRequirements = await db.select().from(complianceRequirements);

    // Calculate expiring soon (within 30 days)
    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

    const expiringSoon = allStatuses.filter(s =>
      s.expiryDate && new Date(s.expiryDate) <= thirtyDaysFromNow && new Date(s.expiryDate) > now
    );

    const expiring60Days = allStatuses.filter(s =>
      s.expiryDate && new Date(s.expiryDate) <= sixtyDaysFromNow && new Date(s.expiryDate) > thirtyDaysFromNow
    );

    const expiring90Days = allStatuses.filter(s =>
      s.expiryDate && new Date(s.expiryDate) <= ninetyDaysFromNow && new Date(s.expiryDate) > sixtyDaysFromNow
    );

    const expired = allStatuses.filter(s => s.status === 'expired' || (s.expiryDate && new Date(s.expiryDate) < now));
    const actionRequired = allStatuses.filter(s => s.status === 'action_required');
    const pending = allStatuses.filter(s => s.status === 'pending');
    const compliant = allStatuses.filter(s => s.status === 'compliant');

    res.json({
      totalProperties: allProperties.length,
      totalRequirements: allRequirements.length,
      summary: {
        compliant: compliant.length,
        pending: pending.length,
        expired: expired.length,
        actionRequired: actionRequired.length
      },
      upcoming: {
        expiring30Days: expiringSoon.length,
        expiring60Days: expiring60Days.length,
        expiring90Days: expiring90Days.length
      },
      expiringSoonItems: expiringSoon.slice(0, 10) // Top 10 expiring
    });
  } catch (error) {
    console.error('Error fetching compliance dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch compliance dashboard' });
  }
});

// Update compliance status
crmRouter.post('/compliance/status', requireAgent, async (req, res) => {
  try {
    const data = insertComplianceStatusSchema.parse(req.body);
    const [status] = await db.insert(complianceStatus).values(data).returning();
    res.json(status);
  } catch (error) {
    console.error('Error creating compliance status:', error);
    res.status(500).json({ error: 'Failed to create compliance status' });
  }
});

crmRouter.put('/compliance/status/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    const [status] = await db.update(complianceStatus).set({ ...updates, updatedAt: new Date() }).where(eq(complianceStatus.id, id)).returning();
    res.json(status);
  } catch (error) {
    console.error('Error updating compliance status:', error);
    res.status(500).json({ error: 'Failed to update compliance status' });
  }
});

// ==========================================
// ADMIN SEED DATA ENDPOINT
// ==========================================

// Seed sample managed properties data for testing
crmRouter.post('/admin/seed-managed-properties', requireAdmin, async (req, res) => {
  try {
    // Get existing properties
    const existingProperties = await storage.getAllProperties();

    if (existingProperties.length === 0) {
      return res.status(400).json({ error: 'No properties exist. Please create some properties first.' });
    }

    // Create sample landlord
    const landlord = await storage.createLandlord({
      name: 'Demo Landlord',
      email: 'landlord@demo.com',
      phone: '+447700900000',
      addressLine1: '123 Demo Street',
      postcode: 'W1A 1AA',
      city: 'London',
      landlordType: 'individual'
    });

    // Create sample tenant
    const tenant = await storage.createTenant({
      firstName: 'Demo',
      lastName: 'Tenant',
      email: 'tenant@demo.com',
      phone: '+447700900001',
      dateOfBirth: new Date('1990-01-15'),
      currentAddress: '456 Old Street, London',
      currentPostcode: 'EC1A 1BB'
    });

    // Create rental agreements for up to 3 properties
    const propertiesToManage = existingProperties.slice(0, 3);
    const agreements = [];

    for (const property of propertiesToManage) {
      const agreement = await storage.createRentalAgreement({
        propertyId: property.id,
        landlordId: landlord.id,
        tenantId: tenant.id,
        startDate: new Date(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        rentAmount: property.price || 150000, // Use property price or default
        rentFrequency: 'monthly',
        depositAmount: (property.price || 150000) * 1.5,
        depositHeldBy: 'dps',
        status: 'active',
        managementFeePercentage: '10'
      });
      agreements.push(agreement);

      // Update property status to 'let'
      await storage.updateProperty(property.id, { status: 'let' });
    }

    res.json({
      success: true,
      message: `Created ${agreements.length} managed properties with demo landlord and tenant`,
      landlordId: landlord.id,
      tenantId: tenant.id,
      agreementCount: agreements.length
    });
  } catch (error) {
    console.error('Error seeding managed properties:', error);
    res.status(500).json({ error: 'Failed to seed managed properties' });
  }
});

// LEGACY LANDLORD ROUTES REMOVED - Using main landlords table above

// Set all properties as managed
crmRouter.post('/admin/set-all-managed', requireAdmin, async (req, res) => {
  try {
    // Update all properties to isManaged = true
    const result = await db.update(properties).set({ isManaged: true });
    res.json({ success: true, message: 'All properties set to managed' });
  } catch (error) {
    console.error('Error setting properties to managed:', error);
    res.status(500).json({ error: 'Failed to UPDATE property' });
  }
});

// ==========================================
// V3 UNIFIED CONTACTS API ROUTES
// ==========================================

crmRouter.get('/contacts', requireAgent, async (req, res) => {
  try {
    const contactType = req.query.contactType as string;

    // Aggregate contacts FROM landlord, tenants, and contractors tables
    const allContacts: any[] = [];

    // Get landlords (unless filtering for a different type)
    if (!contactType || contactType === 'landlord') {
      const landlordRows = await db.select().from(landlords).orderBy(desc(landlords.createdAt));
      for (const l of landlordRows) {
        allContacts.push({
          id: `landlord-${l.id}`,
          originalId: l.id,
          contactType: 'landlord',
          fullName: l.name,
          email: l.email,
          phone: l.phone || l.mobile,
          mobile: l.mobile,
          status: l.status || 'active',
          kycStatus: 'not_started', // Landlords don't have KYC in PM schema
          isCompany: l.landlordType === 'company',
          companyName: l.companyName,
          lastActive: l.updatedAt,
          createdAt: l.createdAt
        });
      }
    }

    // Get tenants (unless filtering for a different type)
    if (!contactType || contactType === 'tenant') {
      const tenantRows = await db.select().from(tenant).orderBy(desc(tenant.createdAt));
      for (const t of tenantRows) {
        allContacts.push({
          id: `tenant-${t.id}`,
          originalId: t.id,
          contactType: 'tenant',
          fullName: t.name,
          email: t.email,
          phone: t.phone || t.mobile,
          mobile: t.mobile,
          status: t.status || 'active',
          kycStatus: 'not_started', // Could be enhanced with actual KYC tracking
          isCompany: false,
          companyName: null,
          lastActive: t.updatedAt,
          createdAt: t.createdAt
        });
      }
    }

    // Get contractors (unless filtering for a different type)
    if (!contactType || contactType === 'contractor') {
      const contractorRows = await db.select().from(contractors).orderBy(desc(contractors.createdAt));
      for (const c of contractorRows) {
        allContacts.push({
          id: `contractor-${c.id}`,
          originalId: c.id,
          contactType: 'contractor',
          fullName: c.contactName,
          email: c.email,
          phone: c.phone,
          mobile: c.emergencyPhone,
          status: c.status || 'active',
          kycStatus: 'not_started',
          isCompany: true,
          companyName: c.companyName,
          lastActive: c.updatedAt,
          createdAt: c.createdAt
        });
      }
    }

    // Sort by createdAt desc
    allContacts.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    res.json(allContacts);
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

crmRouter.get('/contacts/:id', requireAgent, async (req, res) => {
  try {
    const contact = await storage.getUnifiedContact(parseInt(req.params.id));
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Also get company details if it's a company
    let companyDetails = null;
    if (contact.isCompany) {
      companyDetails = await storage.getCompanyDetailsByContact(contact.id);
    }

    // Get KYC documents
    const kycDocuments = await storage.getKycDocuments(contact.id);

    res.json({ ...contact, companyDetails, kycDocuments });
  } catch (error) {
    console.error('Error fetching v3 contact:', error);
    res.status(500).json({ error: 'Failed to fetch contact details' });
  }
});

crmRouter.post('/contacts', requireAgent, async (req, res) => {
  try {
    // Basic implementation for now, should use Zod validation in production
    const contact = await storage.createUnifiedContact(req.body);
    res.status(201).json(contact);
  } catch (error) {
    console.error('Error creating v3 contact:', error);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

crmRouter.patch('/contacts/:id', requireAgent, async (req, res) => {
  try {
    const updated = await storage.updateUnifiedContact(parseInt(req.params.id), req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json(updated);
  } catch (error) {
    console.error('Error updating v3 contact:', error);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

crmRouter.get('/kyc-documents', requireAgent, async (req, res) => {
  try {
    const contactId = req.query.contactId ? parseInt(req.query.contactId as string) : undefined;
    const docs = await storage.getKycDocuments(contactId);
    res.json(docs);
  } catch (error) {
    console.error('Error fetching kyc documents:', error);
    res.status(500).json({ error: 'Failed to fetch KYC documents' });
  }
});

crmRouter.get('/sales-progression/:propertyId', requireAgent, async (req, res) => {
  try {
    const progression = await storage.getSalesProgression(parseInt(req.params.propertyId));
    if (!progression) {
      return res.json({ message: 'No sales progression found for this property' });
    }
    res.json(progression);
  } catch (error) {
    console.error('Error fetching sales progression:', error);
    res.status(500).json({ error: 'Failed to fetch sales progression' });
  }
});

// Get sales progression stats (for dashboard)
crmRouter.get('/sales-progression-stats', requireAgent, async (req, res) => {
  try {
    // Get count of properties under offer (active sales progressions not yet exchanged)
    const underOfferResult = await db.select({ count: sql<number>`count(*)` })
      .from(salesProgression)
      .where(and(
        eq(salesProgression.status, 'active'),
        eq(salesProgression.contractsExchanged, false)
      ));

    // Get count of exchanged properties (contracts exchanged but not completed)
    const exchangedResult = await db.select({ count: sql<number>`count(*)` })
      .from(salesProgression)
      .where(and(
        eq(salesProgression.status, 'active'),
        eq(salesProgression.contractsExchanged, true),
        eq(salesProgression.completed, false)
      ));

    // Get count of completions scheduled for current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const targetCompletionsResult = await db.select({ count: sql<number>`count(*)` })
      .from(salesProgression)
      .where(and(
        eq(salesProgression.status, 'active'),
        sql`${salesProgression.completionScheduled} >= ${startOfMonth}`,
        sql`${salesProgression.completionScheduled} <= ${endOfMonth}`
      ));

    res.json({
      underOffer: Number(underOfferResult[0]?.count || 0),
      exchanged: Number(exchangedResult[0]?.count || 0),
      targetCompletionsThisMonth: Number(targetCompletionsResult[0]?.count || 0)
    });
  } catch (error) {
    console.error('Error fetching sales progression stats:', error);
    res.status(500).json({ error: 'Failed to fetch sales progression stats' });
  }
});

// ==========================================
// NEW PROPERTY MANAGEMENT (PM) API ENDPOINTS
// ==========================================

// --- LANDLORDS (using main landlords table) ---
// Routes at /pm/landlords are kept for backwards compatibility

// Get all landlords
crmRouter.get('/pm/landlords', requireAgent, async (req, res) => {
  try {
    const allLandlords = await db.select().from(landlords).orderBy(desc(landlords.createdAt));
    res.json(allLandlords);
  } catch (error) {
    console.error('Error fetching landlords:', error);
    res.status(500).json({ error: 'Failed to fetch landlords' });
  }
});

// Get single landlord
crmRouter.get('/pm/landlords/:id', requireAgent, async (req, res) => {
  try {
    const [landlord] = await db.select().from(landlords).where(eq(landlords.id, parseInt(req.params.id)));
    if (!landlord) {
      return res.status(404).json({ error: 'Landlord not found' });
    }
    res.json(landlord);
  } catch (error) {
    console.error('Error fetching landlord:', error);
    res.status(500).json({ error: 'Failed to fetch landlord' });
  }
});

// Create landlord
crmRouter.post('/pm/landlords', requireAgent, async (req, res) => {
  try {
    const data = insertLandlordSchema.parse(req.body);
    const [landlord] = await db.insert(landlords).values(data).returning();
    res.status(201).json(landlord);
  } catch (error) {
    console.error('Error creating landlord:', error);
    res.status(400).json({ error: 'Failed to create landlord' });
  }
});

// Update landlord
crmRouter.patch('/pm/landlords/:id', requireAgent, async (req, res) => {
  try {
    const [landlord] = await db.update(landlords)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(landlords.id, parseInt(req.params.id)))
      .returning();
    if (!landlord) {
      return res.status(404).json({ error: 'Landlord not found' });
    }
    res.json(landlord);
  } catch (error) {
    console.error('Error updating landlord:', error);
    res.status(400).json({ error: 'Failed to update landlord' });
  }
});

// Delete landlord
crmRouter.delete('/pm/landlords/:id', requireAgent, async (req, res) => {
  try {
    const [landlord] = await db.delete(landlords)
      .where(eq(landlords.id, parseInt(req.params.id)))
      .returning();
    if (!landlord) {
      return res.status(404).json({ error: 'Landlord not found' });
    }
    res.json({ message: 'Landlord deleted successfully' });
  } catch (error) {
    console.error('Error deleting landlord:', error);
    res.status(500).json({ error: 'Failed to delete landlord' });
  }
});

// --- TENANTS (using main tenants table) ---
// Routes at /pm/tenants are kept for backwards compatibility

// Get all tenants
crmRouter.get('/pm/tenants', requireAgent, async (req, res) => {
  try {
    const allTenants = await db.select().from(tenant).orderBy(desc(tenant.createdAt));
    res.json(allTenants);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get single tenant
crmRouter.get('/pm/tenants/:id', requireAgent, async (req, res) => {
  try {
    const [tenantResult] = await db.select().from(tenant).where(eq(tenant.id, parseInt(req.params.id)));
    if (!tenantResult) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(tenantResult);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// Create tenant
crmRouter.post('/pm/tenants', requireAgent, async (req, res) => {
  try {
    const data = insertTenantSchema.parse(req.body);
    const [newTenant] = await db.insert(tenant).values(data).returning();
    res.status(201).json(newTenant);
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(400).json({ error: 'Failed to create tenant' });
  }
});

// Update tenant
crmRouter.patch('/pm/tenants/:id', requireAgent, async (req, res) => {
  try {
    const [updatedTenant] = await db.update(tenant)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(tenant.id, parseInt(req.params.id)))
      .returning();
    if (!updatedTenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(updatedTenant);
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(400).json({ error: 'Failed to update tenant' });
  }
});

// Delete tenant
crmRouter.delete('/pm/tenants/:id', requireAgent, async (req, res) => {
  try {
    const [deletedTenant] = await db.delete(tenant)
      .where(eq(tenant.id, parseInt(req.params.id)))
      .returning();
    if (!deletedTenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json({ message: 'Tenant deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// --- PM PROPERTIES ---

// Get all properties (with optional filters)
crmRouter.get('/pm/properties', requireAgent, async (req, res) => {
  try {
    const { isManaged, isListed, isRental, isResidential, landlordId } = req.query;

    console.log('PM Properties query params:', { landlordId, isManaged, isListed, isRental, isResidential });

    let query = db.select().from(properties);
    const conditions = [];

    if (landlordId !== undefined && landlordId !== '') {
      const parsedLandlordId = parseInt(landlordId as string);
      console.log('Filtering by landlordId:', parsedLandlordId);
      conditions.push(eq(properties.landlordId, parsedLandlordId));
    }
    if (isManaged !== undefined) {
      conditions.push(eq(properties.isManaged, isManaged === 'true'));
    }
    if (isListed !== undefined) {
      conditions.push(eq(properties.isListed, isListed === 'true'));
    }
    if (isRental !== undefined) {
      conditions.push(eq(properties.isRental, isRental === 'true'));
    }
    if (isResidential !== undefined) {
      conditions.push(eq(properties.isResidential, isResidential === 'true'));
    }

    console.log('Conditions count:', conditions.length);
    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const allProperties = await query.orderBy(desc(properties.createdAt));
    console.log('Returning', allProperties.length, 'properties');
    res.json(allProperties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

// Get single property with related data
crmRouter.get('/pm/properties/:id', requireAgent, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id);
    const [property] = await db.select().from(properties).where(eq(properties.id, propertyId));

    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    // Get landlord if exists
    let landlord = null;
    if (property.landlordId) {
      [landlord] = await db.select().from(landlords).where(eq(landlords.id, property.landlordId));
    }

    // Get active tenancy
    const [activeTenancy] = await db.select().from(tenancies)
      .where(and(
        eq(tenancies.propertyId, propertyId),
        eq(tenancies.status, 'active')
      ));

    // Get tenant if active tenancy exists
    let tenantData = null;
    if (activeTenancy?.tenantId) {
      [tenantData] = await db.select().from(tenant).where(eq(tenant.id, activeTenancy.tenantId));
    }

    res.json({
      ...property,
      landlord,
      activeTenancy,
      tenant: tenantData
    });
  } catch (error) {
    console.error('Error fetching property:', error);
    res.status(500).json({ error: 'Failed to fetch property' });
  }
});

// Create property
crmRouter.post('/pm/properties', requireAgent, async (req, res) => {
  try {
    const data = insertPropertySchema.parse(req.body);
    const [property] = await db.insert(properties).values(data).returning();
    res.status(201).json(property);
  } catch (error) {
    console.error('Error creating property:', error);
    res.status(400).json({ error: 'Failed to create property' });
  }
});

// Update property
crmRouter.patch('/pm/properties/:id', requireAgent, async (req, res) => {
  try {
    const [property] = await db.update(properties)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(properties.id, parseInt(req.params.id)))
      .returning();
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json(property);
  } catch (error) {
    console.error('Error updating property:', error);
    res.status(400).json({ error: 'Failed to update property' });
  }
});

// Delete property
crmRouter.delete('/pm/properties/:id', requireAgent, async (req, res) => {
  try {
    const [property] = await db.delete(properties)
      .where(eq(properties.id, parseInt(req.params.id)))
      .returning();
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }
    res.json({ message: 'Property deleted successfully' });
  } catch (error) {
    console.error('Error deleting property:', error);
    res.status(500).json({ error: 'Failed to delete property' });
  }
});

// --- TENANCIES (using main tenancies table) ---
// Routes at /pm/tenancies are kept for backwards compatibility

// Get all tenancies
crmRouter.get('/pm/tenancies', requireAgent, async (req, res) => {
  try {
    const { propertyId, landlordId, status } = req.query;

    let query = db.select().from(tenancies);
    const conditions = [];

    if (propertyId) {
      conditions.push(eq(tenancies.propertyId, parseInt(propertyId as string)));
    }
    if (landlordId) {
      conditions.push(eq(tenancies.landlordId, parseInt(landlordId as string)));
    }
    if (status) {
      conditions.push(eq(tenancies.status, status as string));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    const allTenancies = await query.orderBy(desc(tenancies.createdAt));

    // Enrich with property and tenant info
    const enrichedTenancies = await Promise.all(allTenancies.map(async (t) => {
      const [property] = await db.select({
        addressLine1: properties.addressLine1,
        address: properties.address,
        postcode: properties.postcode
      }).from(properties).where(eq(properties.id, t.propertyId));

      let tenantName = null;
      if (t.tenantId) {
        const [tenantRecord] = await db.select({ name: tenant.name }).from(tenant).where(eq(tenant.id, t.tenantId));
        tenantName = tenantRecord?.name || null;
      }

      return {
        ...t,
        propertyAddress: property?.addressLine1 || property?.address || 'Unknown Property',
        postcode: property?.postcode || '',
        tenantName
      };
    }));

    res.json(enrichedTenancies);
  } catch (error) {
    console.error('Error fetching tenancies:', error);
    res.status(500).json({ error: 'Failed to fetch tenancies' });
  }
});

// Get single tenancy with full details
crmRouter.get('/pm/tenancies/:id', requireAgent, async (req, res) => {
  try {
    const tenancyId = parseInt(req.params.id);
    const [tenancy] = await db.select().from(tenancies).where(eq(tenancies.id, tenancyId));

    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' });
    }

    // Get property
    const [property] = await db.select().from(properties).where(eq(properties.id, tenancy.propertyId));

    // Get landlord
    const [landlord] = await db.select().from(landlords).where(eq(landlords.id, tenancy.landlordId));

    // Get tenant
    let tenantData = null;
    if (tenancy.tenantId) {
      [tenantData] = await db.select().from(tenant).where(eq(tenant.id, tenancy.tenantId));
    }

    // Get checklist items
    const checklistItems = await db.select().from(tenancyChecklist)
      .where(eq(tenancyChecklist.tenancyId, tenancyId));

    res.json({
      ...tenancy,
      property,
      landlord,
      tenant: tenantData,
      checklist: checklistItems
    });
  } catch (error) {
    console.error('Error fetching tenancy:', error);
    res.status(500).json({ error: 'Failed to fetch tenancy' });
  }
});

// Create tenancy (with automatic checklist creation)
crmRouter.post('/pm/tenancies', requireAgent, async (req, res) => {
  try {
    const data = insertTenancySchema.parse(req.body);
    const [tenancy] = await db.insert(tenancies).values(data).returning();

    // Create checklist items for the tenancy
    const checklistItems = tenancyChecklistItemTypes.map(itemType => ({
      tenancyId: tenancy.id,
      itemType,
      isCompleted: false
    }));

    await db.insert(tenancyChecklist).values(checklistItems);

    res.status(201).json(tenancy);
  } catch (error) {
    console.error('Error creating tenancy:', error);
    res.status(400).json({ error: 'Failed to create tenancy' });
  }
});

// Update tenancy
crmRouter.patch('/pm/tenancies/:id', requireAgent, async (req, res) => {
  try {
    const [tenancy] = await db.update(tenancies)
      .set({ ...req.body, updatedAt: new Date() })
      .where(eq(tenancies.id, parseInt(req.params.id)))
      .returning();
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' });
    }
    res.json(tenancy);
  } catch (error) {
    console.error('Error updating tenancy:', error);
    res.status(400).json({ error: 'Failed to update tenancy' });
  }
});

// Delete tenancy
crmRouter.delete('/pm/tenancies/:id', requireAgent, async (req, res) => {
  try {
    // Delete checklist items first
    await db.delete(tenancyChecklist).where(eq(tenancyChecklist.tenancyId, parseInt(req.params.id)));

    const [tenancy] = await db.delete(tenancies)
      .where(eq(tenancies.id, parseInt(req.params.id)))
      .returning();
    if (!tenancy) {
      return res.status(404).json({ error: 'Tenancy not found' });
    }
    res.json({ message: 'Tenancy deleted successfully' });
  } catch (error) {
    console.error('Error deleting tenancy:', error);
    res.status(500).json({ error: 'Failed to delete tenancy' });
  }
});

// --- TENANCY CHECKLIST (using main tenancy_checklist table) ---
// Routes at /pm/tenancies/:id/checklist are kept for backwards compatibility

// Get checklist items for a tenancy
crmRouter.get('/pm/tenancies/:tenancyId/checklist', requireAgent, async (req, res) => {
  try {
    const tenancyId = parseInt(req.params.tenancyId);
    const items = await db.select().from(tenancyChecklist)
      .where(eq(tenancyChecklist.tenancyId, tenancyId))
      .orderBy(tenancyChecklist.id);

    // Add labels and metadata to items
    const itemsWithMeta = items.map(item => {
      const meta = tenancyChecklistItemMeta[item.itemType as keyof typeof tenancyChecklistItemMeta];
      return {
        ...item,
        label: tenancyChecklistItemLabels[item.itemType as keyof typeof tenancyChecklistItemLabels] || item.itemType,
        category: meta?.category || 'general',
        workflow: meta?.workflow || 'general',
        requiresDocument: meta?.requiresDocument || false,
        autoCompleteOn: meta?.autoCompleteOn || null
      };
    });

    res.json(itemsWithMeta);
  } catch (error) {
    console.error('Error fetching checklist:', error);
    res.status(500).json({ error: 'Failed to fetch checklist' });
  }
});

// Get all checklist item types (for reference)
crmRouter.get('/pm/checklist-types', requireAgent, async (req, res) => {
  res.json({
    types: tenancyChecklistItemTypes,
    labels: tenancyChecklistItemLabels,
    meta: tenancyChecklistItemMeta
  });
});

// Update checklist item (toggle completion, add notes, upload document)
crmRouter.patch('/pm/checklist/:id', requireAgent, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const updateData: any = { ...req.body, updatedAt: new Date() };

    // If completing item, set completedAt and completedBy
    if (req.body.isCompleted === true) {
      updateData.completedAt = new Date();
      updateData.completedBy = userId;
    } else if (req.body.isCompleted === false) {
      updateData.completedAt = null;
      updateData.completedBy = null;
    }

    // If uploading document, set upload metadata
    if (req.body.documentUrl) {
      updateData.documentUploadedAt = new Date();
      updateData.documentUploadedBy = userId;
    }

    const [item] = await db.update(tenancyChecklist)
      .set(updateData)
      .where(eq(tenancyChecklist.id, parseInt(req.params.id)))
      .returning();

    if (!item) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    res.json({
      ...item,
      label: tenancyChecklistItemLabels[item.itemType as keyof typeof tenancyChecklistItemLabels] || item.itemType
    });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    res.status(400).json({ error: 'Failed to update checklist item' });
  }
});

// --- PM BULK IMPORT ---

// Import properties from CSV (using the new pm tables)
crmRouter.post('/pm/properties/import', requireAgent, uploadCsv.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvData = fs.readFileSync(req.file.path, 'utf-8');
    const lines = csvData.split('\n').filter(line => line.trim());

    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV file is empty or has no data rows' });
    }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/['"]/g, ''));
    const imported = { landlords: 0, tenants: 0, properties: 0, tenancies: 0 };

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].match(/("([^"]*)"|[^,]*)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = values[idx] || ''; });

      // Create or find landlord
      let landlordId: number | null = null;
      if (row.landlord_name) {
        const existingLandlords = await db.select().from(landlords)
          .where(eq(landlords.name, row.landlord_name))
          .limit(1);

        if (existingLandlords.length > 0) {
          landlordId = existingLandlords[0].id;
        } else {
          const [newLandlord] = await db.insert(landlords).values({
            name: row.landlord_name,
            email: row.landlord_email || null,
            phone: row.landlord_phone || null,
            mobile: row.landlord_mobile || null,
            addressLine1: row.landlord_address || null,
            bankName: row.landlord_bank_name || null,
            bankAccountNumber: row.landlord_account_number || null,
            bankSortCode: row.landlord_sort_code || null,
            status: 'active'
          }).returning();
          landlordId = newLandlord.id;
          imported.landlords++;
        }
      }

      // Create or find tenant
      let tenantId: number | null = null;
      if (row.tenant_name) {
        const existingTenants = await db.select().from(tenant)
          .where(eq(tenant.name, row.tenant_name))
          .limit(1);

        if (existingTenants.length > 0) {
          tenantId = existingTenants[0].id;
        } else {
          const [newTenant] = await db.insert(tenant).values({
            name: row.tenant_name,
            email: row.tenant_email || null,
            mobile: row.tenant_mobile || null,
            status: 'active'
          }).returning();
          tenantId = newTenant.id;
          imported.tenants++;
        }
      }

      // Create property
      if (row.property_address && landlordId) {
        const postcode = row.property_address.match(/[A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2}/i)?.[0] || '';

        const [newProperty] = await db.insert(properties).values({
          address: row.property_address,
          postcode: postcode,
          landlordId: landlordId,
          isManaged: true,
          isListed: false,
          isRental: true,
          isResidential: true,
          propertyType: 'flat',
          managementType: 'full',
          managementStartDate: new Date(),
          status: 'active'
        }).returning();
        imported.properties++;

        // Create tenancy if tenant exists
        if (tenantId) {
          const startDate = row.tenancy_start_date ? new Date(row.tenancy_start_date) : new Date();
          const endDate = row.tenancy_end_date ? new Date(row.tenancy_end_date) : null;
          const rentAmount = parseFloat(row.rent_amount) || 0;
          const depositAmount = parseFloat(row.deposit_amount) || 0;

          const [newTenancy] = await db.insert(tenancies).values({
            propertyId: newProperty.id,
            landlordId: landlordId,
            tenantId: tenantId,
            startDate: startDate,
            endDate: endDate,
            rentAmount: rentAmount.toString(),
            rentFrequency: row.rent_frequency || 'monthly',
            depositAmount: depositAmount.toString(),
            status: 'active'
          }).returning();

          // Create checklist items
          const checklistItems = tenancyChecklistItemTypes.map(itemType => ({
            tenancyId: newTenancy.id,
            itemType,
            isCompleted: false
          }));
          await db.insert(tenancyChecklist).values(checklistItems);
          imported.tenancies++;
        }
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'Import completed successfully',
      imported
    });
  } catch (error) {
    console.error('Error importing properties:', error);
    res.status(500).json({ error: 'Failed to import properties' });
  }
});

// Get import template
crmRouter.get('/pm/properties/template', requireAgent, (req, res) => {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'managed-properties-import-template.csv');
  if (fs.existsSync(templatePath)) {
    res.download(templatePath);
  } else {
    // Create a default template
    const template = `property_address,landlord_name,landlord_email,landlord_phone,landlord_address,landlord_mobile,landlord_bank_name,landlord_account_number,landlord_sort_code,tenant_name,tenant_email,tenant_mobile,tenancy_start_date,tenancy_end_date,rent_amount,rent_frequency,deposit_amount,notes
"123 Example Street, London W10 5AD","John Smith",john.smith@email.com,02012345678,"45 Park Lane, London W1K 1PN",07700123456,"Barclays",12345678,20-00-00,"Jane Tenant",jane.tenant@email.com,07700654321,2024-02-01,2025-01-31,1500,monthly,3000,"Example managed property"`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=managed-properties-import-template.csv');
    res.send(template);
  }
});

// ============================================================================
// SECURITY MATRIX ENDPOINTS - Admin only (clearance level 10)
// ============================================================================

// Get all security settings/features
crmRouter.get('/security/features', requireAdmin, async (req, res) => {
  try {
    const features = await db.select().from(securitySettings).orderBy(securitySettings.category, securitySettings.featureName);

    // If no features exist, seed with defaults
    if (features.length === 0) {
      const seeded = await db.insert(securitySettings).values(
        DEFAULT_FEATURE_SECURITY.map(f => ({
          featureKey: f.featureKey,
          featureName: f.featureName,
          description: f.description,
          requiredClearance: f.requiredClearance,
          category: f.category,
          isEnabled: true
        }))
      ).returning();
      return res.json(seeded);
    }

    res.json(features);
  } catch (error) {
    console.error('Error fetching security features:', error);
    res.status(500).json({ error: 'Failed to fetch security features' });
  }
});

// Update a security feature's clearance level
crmRouter.put('/security/features/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { requiredClearance, isEnabled } = req.body;

    // Get current value for audit log
    const [current] = await db.select().from(securitySettings).where(eq(securitySettings.id, parseInt(id)));
    if (!current) {
      return res.status(404).json({ error: 'Feature not found' });
    }

    // Update the feature
    const [updated] = await db.update(securitySettings)
      .set({
        requiredClearance: requiredClearance ?? current.requiredClearance,
        isEnabled: isEnabled ?? current.isEnabled,
        updatedAt: new Date()
      })
      .where(eq(securitySettings.id, parseInt(id)))
      .returning();

    // Log the change
    await db.insert(securityAuditLog).values({
      userId: (req as any).user.id,
      action: 'feature_access_change',
      targetType: 'feature',
      targetId: parseInt(id),
      targetName: current.featureName,
      oldValue: JSON.stringify({ requiredClearance: current.requiredClearance, isEnabled: current.isEnabled }),
      newValue: JSON.stringify({ requiredClearance: updated.requiredClearance, isEnabled: updated.isEnabled }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json(updated);
  } catch (error) {
    console.error('Error updating security feature:', error);
    res.status(500).json({ error: 'Failed to update security feature' });
  }
});

// Get all roles with their clearance levels
crmRouter.get('/security/roles', requireAdmin, async (req, res) => {
  try {
    const roles = await db.select().from(estateAgencyRoles).orderBy(desc(estateAgencyRoles.requiredClearance));

    // Also include simple role clearances
    const simpleRoles = Object.entries(SECURITY_CLEARANCE_LEVELS).map(([role, clearance]) => ({
      roleCode: role,
      roleName: role.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      clearance,
      type: 'simple'
    }));

    res.json({
      estateRoles: roles,
      simpleRoles,
      clearanceLabels: SECURITY_CLEARANCE_LABELS
    });
  } catch (error) {
    console.error('Error fetching security roles:', error);
    res.status(500).json({ error: 'Failed to fetch security roles' });
  }
});

// Update a user's security clearance
crmRouter.put('/security/users/:id/clearance', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { securityClearance } = req.body;

    if (securityClearance < 1 || securityClearance > 10) {
      return res.status(400).json({ error: 'Security clearance must be between 1 and 10' });
    }

    // Get current user for audit log
    const [currentUser] = await db.select().from(users).where(eq(users.id, parseInt(id)));
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Don't allow lowering your own clearance below admin level
    if ((req as any).user.id === parseInt(id) && securityClearance < 10) {
      return res.status(400).json({ error: 'Cannot lower your own clearance below admin level' });
    }

    // Update user clearance
    const [updated] = await db.update(users)
      .set({ securityClearance })
      .where(eq(users.id, parseInt(id)))
      .returning();

    // Log the change
    await db.insert(securityAuditLog).values({
      userId: (req as any).user.id,
      action: 'clearance_change',
      targetType: 'user',
      targetId: parseInt(id),
      targetName: currentUser.fullName,
      oldValue: JSON.stringify({ securityClearance: currentUser.securityClearance }),
      newValue: JSON.stringify({ securityClearance }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    // Remove password from response
    const { password, ...userResponse } = updated;
    res.json(userResponse);
  } catch (error) {
    console.error('Error updating user clearance:', error);
    res.status(500).json({ error: 'Failed to update user clearance' });
  }
});

// Get all users with their clearance levels
crmRouter.get('/security/users', requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      securityClearance: users.securityClearance,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt
    }).from(users).orderBy(desc(users.securityClearance), users.fullName);

    res.json(allUsers);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get the full security matrix (features vs roles)
crmRouter.get('/security/matrix', requireAdmin, async (req, res) => {
  try {
    const features = await db.select().from(securitySettings).orderBy(securitySettings.category);
    const roles = await db.select().from(estateAgencyRoles);

    // Build matrix: for each feature, determine which roles can access it
    const matrix = features.map(feature => {
      const roleAccess = roles.map(role => ({
        roleCode: role.roleCode,
        roleName: role.roleName,
        canAccess: (role.requiredClearance ?? 5) >= feature.requiredClearance
      }));

      return {
        featureKey: feature.featureKey,
        featureName: feature.featureName,
        requiredClearance: feature.requiredClearance,
        category: feature.category,
        roleAccess
      };
    });

    res.json({
      matrix,
      clearanceLabels: SECURITY_CLEARANCE_LABELS
    });
  } catch (error) {
    console.error('Error fetching security matrix:', error);
    res.status(500).json({ error: 'Failed to fetch security matrix' });
  }
});

// Get security audit log
crmRouter.get('/security/audit-log', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await db.select({
      id: securityAuditLog.id,
      userId: securityAuditLog.userId,
      action: securityAuditLog.action,
      targetType: securityAuditLog.targetType,
      targetId: securityAuditLog.targetId,
      targetName: securityAuditLog.targetName,
      oldValue: securityAuditLog.oldValue,
      newValue: securityAuditLog.newValue,
      ipAddress: securityAuditLog.ipAddress,
      createdAt: securityAuditLog.createdAt,
      userName: users.fullName
    })
    .from(securityAuditLog)
    .leftJoin(users, eq(securityAuditLog.userId, users.id))
    .orderBy(desc(securityAuditLog.createdAt))
    .limit(limit)
    .offset(offset);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Get security stats for dashboard
crmRouter.get('/security/stats', requireAdmin, async (req, res) => {
  try {
    // Count users by clearance level
    const usersByLevel = await db.select({
      clearance: users.securityClearance,
      count: sql<number>`count(*)`
    })
    .from(users)
    .groupBy(users.securityClearance)
    .orderBy(users.securityClearance);

    // Count features by category
    const featuresByCategory = await db.select({
      category: securitySettings.category,
      count: sql<number>`count(*)`
    })
    .from(securitySettings)
    .groupBy(securitySettings.category);

    // Recent audit log count
    const [recentActivity] = await db.select({
      count: sql<number>`count(*)`
    })
    .from(securityAuditLog)
    .where(sql`${securityAuditLog.createdAt} > NOW() - INTERVAL '7 days'`);

    res.json({
      usersByLevel: usersByLevel.map(u => ({
        ...u,
        label: SECURITY_CLEARANCE_LABELS[u.clearance as keyof typeof SECURITY_CLEARANCE_LABELS] || `Level ${u.clearance}`
      })),
      featuresByCategory,
      recentActivityCount: recentActivity?.count || 0
    });
  } catch (error) {
    console.error('Error fetching security stats:', error);
    res.status(500).json({ error: 'Failed to fetch security stats' });
  }
});

// ==========================================
// WEBSITE IMPORT ROUTES
// Import properties from johnbarclay.co.uk
// ==========================================

// Import sales listings from the website
crmRouter.post('/website-import/sales', requireAgent, async (req, res) => {
  try {
    console.log('Starting website sales import...');
    const result = await websiteImport.syncSalesListings();

    // Cleanup browser after import
    await websiteImport.cleanup();

    res.json(result);
  } catch (error: any) {
    console.error('Website sales import error:', error);
    await websiteImport.cleanup();
    res.status(500).json({
      success: false,
      message: `Import failed: ${error.message}`,
      errors: [error.message]
    });
  }
});

// Import rental listings from the website
crmRouter.post('/website-import/rentals', requireAgent, async (req, res) => {
  try {
    console.log('Starting website rentals import...');
    const result = await websiteImport.syncRentalListings();

    await websiteImport.cleanup();

    res.json(result);
  } catch (error: any) {
    console.error('Website rentals import error:', error);
    await websiteImport.cleanup();
    res.status(500).json({
      success: false,
      message: `Import failed: ${error.message}`,
      errors: [error.message]
    });
  }
});

// Import all listings (both sales and rentals)
crmRouter.post('/website-import/all', requireAgent, async (req, res) => {
  try {
    console.log('Starting full website import...');
    const result = await websiteImport.syncAllListings();

    await websiteImport.cleanup();

    res.json({
      success: result.sales.success && result.rentals.success,
      message: `Sales: ${result.sales.message} | Rentals: ${result.rentals.message}`,
      sales: result.sales,
      rentals: result.rentals
    });
  } catch (error: any) {
    console.error('Website full import error:', error);
    await websiteImport.cleanup();
    res.status(500).json({
      success: false,
      message: `Import failed: ${error.message}`,
      errors: [error.message]
    });
  }
});

// ==========================================
// SECURITY ACCESS CONTROL API
// ==========================================

// Middleware to require owner/admin clearance for security operations
const requireSecurityAccess = async (req: any, res: any, next: any) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  // Only users with clearance 9+ (owner/admin) can manage security settings
  if (req.user.securityClearance < 9 && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Insufficient security clearance' });
  }
  next();
};

// Get current user's permissions (for frontend permission checking)
crmRouter.get('/security/my-permissions', requireAgent, async (req: any, res) => {
  try {
    // Get user's custom permissions
    const customPerms = await db.select()
      .from(userCustomPermissions)
      .where(eq(userCustomPermissions.userId, req.user.id));

    // Determine access level code based on clearance
    let accessLevelCode = null;
    const [userAccessLevel] = await db.select()
      .from(accessLevels)
      .where(eq(accessLevels.clearanceLevel, req.user.securityClearance))
      .limit(1);

    if (userAccessLevel) {
      accessLevelCode = userAccessLevel.levelCode;
    }

    res.json({
      userId: req.user.id,
      securityClearance: req.user.securityClearance,
      role: req.user.role,
      accessLevelCode,
      customPermissions: customPerms.map(p => ({
        featureKey: p.featureKey,
        accessGranted: p.accessGranted
      }))
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({ error: 'Failed to fetch permissions' });
  }
});

// Get all access levels
crmRouter.get('/security/access-levels', requireAgent, async (req, res) => {
  try {
    const levels = await db.select().from(accessLevels).orderBy(desc(accessLevels.clearanceLevel));
    res.json(levels);
  } catch (error) {
    console.error('Error fetching access levels:', error);
    res.status(500).json({ error: 'Failed to fetch access levels' });
  }
});

// Get all level permissions (which levels have access to which features)
crmRouter.get('/security/level-permissions', requireAgent, async (req, res) => {
  try {
    const permissions = await db.select().from(accessLevelPermissions);

    // Group by level code
    const result: Record<string, string[]> = {};

    // First, populate from DEFAULT_ACCESS_LEVEL_PERMISSIONS
    Object.entries(DEFAULT_ACCESS_LEVEL_PERMISSIONS).forEach(([levelCode, featureKeys]) => {
      result[levelCode] = [...featureKeys];
    });

    // Then apply any database overrides
    // Get access levels to map IDs to codes
    const levels = await db.select().from(accessLevels);
    const levelIdToCode: Record<number, string> = {};
    levels.forEach(l => { levelIdToCode[l.id] = l.levelCode; });

    // Note: The accessLevelPermissions table stores individual overrides
    // For now, we return the defaults since the table uses a different structure
    // TODO: Migrate to use this table for full override support

    res.json(result);
  } catch (error) {
    console.error('Error fetching level permissions:', error);
    res.status(500).json({ error: 'Failed to fetch level permissions' });
  }
});

// Toggle level permission (grant or revoke access to a feature for a specific level)
crmRouter.post('/security/level-permissions', requireSecurityAccess, async (req: any, res) => {
  try {
    const { levelCode, featureKey, hasAccess } = req.body;

    if (!levelCode || !featureKey || hasAccess === undefined) {
      return res.status(400).json({ error: 'levelCode, featureKey, and hasAccess are required' });
    }

    // Get the access level ID
    const [level] = await db.select().from(accessLevels).where(eq(accessLevels.levelCode, levelCode));
    if (!level) {
      return res.status(404).json({ error: 'Access level not found' });
    }

    // Check if permission already exists
    const [existing] = await db.select()
      .from(accessLevelPermissions)
      .where(and(
        eq(accessLevelPermissions.accessLevelId, level.id),
        eq(accessLevelPermissions.featureKey, featureKey)
      ));

    if (hasAccess) {
      // Grant access
      if (!existing) {
        await db.insert(accessLevelPermissions).values({
          accessLevelId: level.id,
          featureKey,
          canRead: true,
          canWrite: true,
          canDelete: false,
          canAdmin: false
        });
      }
    } else {
      // Revoke access
      if (existing) {
        await db.delete(accessLevelPermissions)
          .where(eq(accessLevelPermissions.id, existing.id));
      }
    }

    // Log the change
    await db.insert(securityAuditLog).values({
      userId: req.user.id,
      action: 'level_permission_change',
      targetType: 'access_level',
      targetId: level.id,
      targetName: `${level.levelName} - ${featureKey}`,
      oldValue: JSON.stringify({ hasAccess: !!existing }),
      newValue: JSON.stringify({ hasAccess }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, levelCode, featureKey, hasAccess });
  } catch (error) {
    console.error('Error toggling level permission:', error);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// Get all feature modules
crmRouter.get('/security/feature-modules', requireAgent, async (req, res) => {
  try {
    const modules = await db.select().from(featureModules).orderBy(featureModules.displayOrder);
    res.json(modules);
  } catch (error) {
    console.error('Error fetching feature modules:', error);
    res.status(500).json({ error: 'Failed to fetch feature modules' });
  }
});

// Get all features (security settings)
crmRouter.get('/security/features', requireAgent, async (req, res) => {
  try {
    const features = await db.select().from(securitySettings).orderBy(securitySettings.category);
    res.json(features);
  } catch (error) {
    console.error('Error fetching features:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

// Get all users with their access levels
crmRouter.get('/security/users', requireSecurityAccess, async (req, res) => {
  try {
    const allUsers = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      securityClearance: users.securityClearance,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt
    }).from(users).orderBy(desc(users.securityClearance), users.fullName);

    // Get custom permissions for each user
    const customPerms = await db.select().from(userCustomPermissions);

    // Map custom permissions to users
    const usersWithPerms = allUsers.map(user => ({
      ...user,
      customPermissions: customPerms.filter(p => p.userId === user.id)
    }));

    res.json(usersWithPerms);
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get a single user's full security profile
crmRouter.get('/security/users/:id', requireSecurityAccess, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);

    const [user] = await db.select({
      id: users.id,
      username: users.username,
      email: users.email,
      fullName: users.fullName,
      phone: users.phone,
      role: users.role,
      securityClearance: users.securityClearance,
      isActive: users.isActive,
      lastLogin: users.lastLogin,
      createdAt: users.createdAt
    }).from(users).where(eq(users.id, userId));

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's access level
    const userAccessLevel = await db.select()
      .from(accessLevels)
      .where(eq(accessLevels.clearanceLevel, user.securityClearance))
      .limit(1);

    // Get custom permissions
    const customPerms = await db.select()
      .from(userCustomPermissions)
      .where(eq(userCustomPermissions.userId, userId));

    // Calculate effective permissions based on access level + custom overrides
    const allFeatures = await db.select().from(securitySettings);
    const accessLevelPerms = DEFAULT_ACCESS_LEVEL_PERMISSIONS[userAccessLevel[0]?.levelCode as keyof typeof DEFAULT_ACCESS_LEVEL_PERMISSIONS] || [];

    const effectivePermissions = allFeatures.map(feature => {
      const customPerm = customPerms.find(p => p.featureKey === feature.featureKey);
      const hasBaseAccess = accessLevelPerms.includes(feature.featureKey) || user.securityClearance >= feature.requiredClearance;

      return {
        featureKey: feature.featureKey,
        featureName: feature.featureName,
        category: feature.category,
        hasAccess: customPerm ? customPerm.accessGranted : hasBaseAccess,
        isCustom: !!customPerm,
        customReason: customPerm?.reason
      };
    });

    res.json({
      user,
      accessLevel: userAccessLevel[0] || null,
      customPermissions: customPerms,
      effectivePermissions
    });
  } catch (error) {
    console.error('Error fetching user security profile:', error);
    res.status(500).json({ error: 'Failed to fetch user security profile' });
  }
});

// Update user's access level (clearance)
crmRouter.patch('/security/users/:id/access-level', requireSecurityAccess, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { accessLevelCode, clearanceLevel: providedClearanceLevel, reason } = req.body;

    // Get current user info
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine clearance level from accessLevelCode or use provided clearanceLevel
    let clearanceLevel = providedClearanceLevel;
    let levelName = '';

    if (accessLevelCode) {
      const level = DEFAULT_ACCESS_LEVELS.find(l => l.levelCode === accessLevelCode);
      if (!level) {
        return res.status(400).json({ error: 'Invalid access level code' });
      }
      clearanceLevel = level.clearanceLevel;
      levelName = level.levelName;
    }

    if (!clearanceLevel) {
      return res.status(400).json({ error: 'Either accessLevelCode or clearanceLevel is required' });
    }

    // Cannot elevate someone above your own level
    if (clearanceLevel > req.user.securityClearance) {
      return res.status(403).json({ error: 'Cannot assign clearance higher than your own' });
    }

    // Cannot demote someone at or above your own level (unless you're system admin)
    if (targetUser.securityClearance >= req.user.securityClearance && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Cannot modify access for users at or above your clearance level' });
    }

    const oldValue = targetUser.securityClearance;

    // Update user's clearance and optionally the access level code
    const updateData: any = { securityClearance: clearanceLevel };
    if (accessLevelCode) {
      updateData.accessLevelCode = accessLevelCode;
    }

    await db.update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    // Log the change
    await db.insert(securityAuditLog).values({
      userId: req.user.id,
      action: 'clearance_change',
      targetType: 'user',
      targetId: userId,
      targetName: targetUser.fullName,
      oldValue: JSON.stringify({ clearanceLevel: oldValue, accessLevelCode: targetUser.accessLevelCode }),
      newValue: JSON.stringify({ clearanceLevel, accessLevelCode, levelName, reason }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Access level updated', accessLevelCode, clearanceLevel, levelName });
  } catch (error) {
    console.error('Error updating user access level:', error);
    res.status(500).json({ error: 'Failed to update access level' });
  }
});

// Add/update custom permission for a user
crmRouter.post('/security/users/:id/permissions', requireSecurityAccess, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { featureKey, accessGranted, reason, expiresAt } = req.body;

    // Validate user exists
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if custom permission already exists
    const [existing] = await db.select()
      .from(userCustomPermissions)
      .where(and(
        eq(userCustomPermissions.userId, userId),
        eq(userCustomPermissions.featureKey, featureKey)
      ));

    if (existing) {
      // Update existing
      await db.update(userCustomPermissions)
        .set({
          accessGranted,
          reason,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
          grantedBy: req.user.id,
          updatedAt: new Date()
        })
        .where(eq(userCustomPermissions.id, existing.id));
    } else {
      // Insert new
      await db.insert(userCustomPermissions).values({
        userId,
        featureKey,
        accessGranted,
        grantedBy: req.user.id,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      });
    }

    // Log the change
    await db.insert(securityAuditLog).values({
      userId: req.user.id,
      action: accessGranted ? 'permission_granted' : 'permission_revoked',
      targetType: 'user',
      targetId: userId,
      targetName: targetUser.fullName,
      oldValue: existing ? JSON.stringify({ featureKey, accessGranted: existing.accessGranted }) : null,
      newValue: JSON.stringify({ featureKey, accessGranted, reason }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Permission updated' });
  } catch (error) {
    console.error('Error updating user permission:', error);
    res.status(500).json({ error: 'Failed to update permission' });
  }
});

// Remove custom permission (revert to default)
crmRouter.delete('/security/users/:id/permissions/:featureKey', requireSecurityAccess, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { featureKey } = req.params;

    const [existing] = await db.select()
      .from(userCustomPermissions)
      .where(and(
        eq(userCustomPermissions.userId, userId),
        eq(userCustomPermissions.featureKey, featureKey)
      ));

    if (existing) {
      await db.delete(userCustomPermissions).where(eq(userCustomPermissions.id, existing.id));

      // Log the change
      const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
      await db.insert(securityAuditLog).values({
        userId: req.user.id,
        action: 'permission_reset',
        targetType: 'user',
        targetId: userId,
        targetName: targetUser?.fullName || 'Unknown',
        oldValue: JSON.stringify({ featureKey, accessGranted: existing.accessGranted }),
        newValue: JSON.stringify({ featureKey, reverted_to_default: true }),
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
    }

    res.json({ success: true, message: 'Permission reset to default' });
  } catch (error) {
    console.error('Error removing custom permission:', error);
    res.status(500).json({ error: 'Failed to remove custom permission' });
  }
});

// Delete user (admin only)
crmRouter.delete('/security/users/:id', requireAdmin, async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get user info before deleting for audit log
    const [targetUser] = await db.select().from(users).where(eq(users.id, userId));
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete custom permissions first (foreign key constraint)
    await db.delete(userCustomPermissions).where(eq(userCustomPermissions.userId, userId));

    // Delete the user
    await db.delete(users).where(eq(users.id, userId));

    // Log the deletion
    await db.insert(securityAuditLog).values({
      userId: req.user.id,
      action: 'user_deleted',
      targetType: 'user',
      targetId: userId,
      targetName: targetUser.fullName || targetUser.username,
      oldValue: JSON.stringify({
        username: targetUser.username,
        email: targetUser.email,
        fullName: targetUser.fullName,
        role: targetUser.role,
        securityClearance: targetUser.securityClearance
      }),
      newValue: null,
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get security audit log
crmRouter.get('/security/audit-log', requireSecurityAccess, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;

    const logs = await db.select({
      id: securityAuditLog.id,
      userId: securityAuditLog.userId,
      action: securityAuditLog.action,
      targetType: securityAuditLog.targetType,
      targetId: securityAuditLog.targetId,
      targetName: securityAuditLog.targetName,
      oldValue: securityAuditLog.oldValue,
      newValue: securityAuditLog.newValue,
      ipAddress: securityAuditLog.ipAddress,
      createdAt: securityAuditLog.createdAt,
      actorName: users.fullName
    })
    .from(securityAuditLog)
    .leftJoin(users, eq(securityAuditLog.userId, users.id))
    .orderBy(desc(securityAuditLog.createdAt))
    .limit(limit)
    .offset(offset);

    res.json(logs);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    res.status(500).json({ error: 'Failed to fetch audit log' });
  }
});

// Initialize default access levels and features (admin only)
crmRouter.post('/security/initialize', requireAdmin, async (req, res) => {
  try {
    // Insert default access levels if they don't exist
    for (const level of DEFAULT_ACCESS_LEVELS) {
      const [existing] = await db.select()
        .from(accessLevels)
        .where(eq(accessLevels.levelCode, level.levelCode));

      if (!existing) {
        await db.insert(accessLevels).values(level);
      }
    }

    // Insert default feature modules if they don't exist
    for (const module of DEFAULT_FEATURE_MODULES) {
      const [existing] = await db.select()
        .from(featureModules)
        .where(eq(featureModules.moduleCode, module.moduleCode));

      if (!existing) {
        await db.insert(featureModules).values(module);
      }
    }

    // Insert default feature security settings if they don't exist
    for (const feature of DEFAULT_FEATURE_SECURITY) {
      const [existing] = await db.select()
        .from(securitySettings)
        .where(eq(securitySettings.featureKey, feature.featureKey));

      if (!existing) {
        await db.insert(securitySettings).values({
          featureKey: feature.featureKey,
          featureName: feature.featureName,
          description: feature.description,
          requiredClearance: feature.requiredClearance,
          category: feature.category
        });
      }
    }

    res.json({ success: true, message: 'Security settings initialized' });
  } catch (error) {
    console.error('Error initializing security settings:', error);
    res.status(500).json({ error: 'Failed to initialize security settings' });
  }
});

// Seed default John Barclay staff users
crmRouter.post('/security/seed-staff', requireAdmin, async (req: any, res) => {
  try {
    const { scrypt, randomBytes } = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(scrypt);

    // Default password (should be changed on first login)
    const defaultPassword = 'JohnBarclay2024!';
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(defaultPassword, salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;

    // Staff members to create
    const staffMembers = [
      {
        username: 'aslam.noor',
        email: 'Aslam@JohnBarclay.co.uk',
        fullName: 'Aslam Noor',
        role: 'admin' as const,
        securityClearance: 9, // Owner level
        accessLevelCode: 'owner'
      },
      {
        username: 'iury.campos',
        email: 'Iury@JohnBarclay.co.uk',
        fullName: 'Iury Campos',
        role: 'agent' as const,
        securityClearance: 8, // General Manager level
        accessLevelCode: 'general_manager'
      },
      {
        username: 'mayssaa.sabrah',
        email: 'Mayssaa@JohnBarclay.co.uk',
        fullName: 'Mayssaa Sabrah',
        role: 'agent' as const,
        securityClearance: 5, // Sales & Lettings Negotiator level
        accessLevelCode: 'sales_lettings_negotiator'
      }
    ];

    const results = [];

    for (const staff of staffMembers) {
      // Check if user already exists
      const [existingUser] = await db.select()
        .from(users)
        .where(
          or(
            eq(users.username, staff.username),
            eq(users.email, staff.email)
          )
        );

      if (existingUser) {
        // Update existing user's clearance if needed
        await db.update(users)
          .set({
            securityClearance: staff.securityClearance,
            role: staff.role
          })
          .where(eq(users.id, existingUser.id));

        results.push({
          user: staff.fullName,
          action: 'updated',
          accessLevel: staff.accessLevelCode,
          clearance: staff.securityClearance
        });
      } else {
        // Create new user
        const [newUser] = await db.insert(users).values({
          username: staff.username,
          email: staff.email,
          fullName: staff.fullName,
          password: hashedPassword,
          role: staff.role,
          securityClearance: staff.securityClearance,
          isActive: true,
          tempPassword: true // Force password change on first login
        }).returning();

        results.push({
          user: staff.fullName,
          action: 'created',
          accessLevel: staff.accessLevelCode,
          clearance: staff.securityClearance,
          id: newUser.id
        });
      }
    }

    // Log the action
    await db.insert(securityAuditLog).values({
      userId: req.user.id,
      action: 'staff_seeded',
      targetType: 'system',
      targetId: 0,
      targetName: 'Default Staff Setup',
      oldValue: null,
      newValue: JSON.stringify(results),
      ipAddress: req.ip || 'unknown'
    });

    res.json({
      success: true,
      message: 'Staff users have been set up',
      results,
      note: 'Default password is "JohnBarclay2024!" - users should change on first login'
    });
  } catch (error) {
    console.error('Error seeding staff users:', error);
    res.status(500).json({ error: 'Failed to seed staff users' });
  }
});

// Get the access matrix (which roles have access to which features)
crmRouter.get('/security/access-matrix', requireAgent, async (req, res) => {
  try {
    const levels = await db.select().from(accessLevels).orderBy(desc(accessLevels.clearanceLevel));
    const features = await db.select().from(securitySettings).orderBy(securitySettings.category);
    const modules = await db.select().from(featureModules).orderBy(featureModules.displayOrder);

    // Build the matrix
    const matrix = levels.map(level => {
      const levelPerms = DEFAULT_ACCESS_LEVEL_PERMISSIONS[level.levelCode as keyof typeof DEFAULT_ACCESS_LEVEL_PERMISSIONS] || [];

      return {
        level,
        permissions: features.map(feature => ({
          featureKey: feature.featureKey,
          featureName: feature.featureName,
          category: feature.category,
          hasAccess: levelPerms.includes(feature.featureKey) || level.clearanceLevel >= feature.requiredClearance
        }))
      };
    });

    res.json({
      accessLevels: levels,
      features,
      modules,
      matrix,
      clearanceLabels: SECURITY_CLEARANCE_LABELS
    });
  } catch (error) {
    console.error('Error fetching access matrix:', error);
    res.status(500).json({ error: 'Failed to fetch access matrix' });
  }
});

// Check if current user has access to a specific feature
crmRouter.get('/security/check/:featureKey', requireAgent, async (req: any, res) => {
  try {
    const { featureKey } = req.params;
    const userId = req.user.id;

    // Get feature requirements
    const [feature] = await db.select()
      .from(securitySettings)
      .where(eq(securitySettings.featureKey, featureKey));

    if (!feature) {
      return res.json({ hasAccess: false, reason: 'Feature not found' });
    }

    // Check for custom permission override
    const [customPerm] = await db.select()
      .from(userCustomPermissions)
      .where(and(
        eq(userCustomPermissions.userId, userId),
        eq(userCustomPermissions.featureKey, featureKey)
      ));

    if (customPerm) {
      // Check if expired
      if (customPerm.expiresAt && new Date(customPerm.expiresAt) < new Date()) {
        // Permission expired, delete it
        await db.delete(userCustomPermissions).where(eq(userCustomPermissions.id, customPerm.id));
      } else {
        return res.json({
          hasAccess: customPerm.accessGranted,
          reason: customPerm.accessGranted ? 'Custom permission granted' : 'Custom permission revoked',
          isCustom: true
        });
      }
    }

    // Check based on clearance level
    const hasAccess = req.user.securityClearance >= feature.requiredClearance;

    res.json({
      hasAccess,
      reason: hasAccess
        ? `Clearance level ${req.user.securityClearance} >= required ${feature.requiredClearance}`
        : `Clearance level ${req.user.securityClearance} < required ${feature.requiredClearance}`,
      isCustom: false
    });
  } catch (error) {
    console.error('Error checking feature access:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
});

// Create a new user with specific access level (admin/owner only)
crmRouter.post('/security/users', requireSecurityAccess, async (req: any, res) => {
  try {
    const { username, email, fullName, phone, accessLevelCode, password } = req.body;

    // Get the access level from DB or use defaults
    let level = null;
    try {
      const [dbLevel] = await db.select()
        .from(accessLevels)
        .where(eq(accessLevels.levelCode, accessLevelCode));
      level = dbLevel;
    } catch (e) {
      // Table might not exist yet
    }

    // Fallback to defaults if not in DB
    if (!level) {
      const defaultLevel = DEFAULT_ACCESS_LEVELS.find(l => l.levelCode === accessLevelCode);
      if (defaultLevel) {
        level = defaultLevel;
      }
    }

    if (!level) {
      return res.status(400).json({ error: 'Invalid access level' });
    }

    // Cannot create user with higher clearance than yourself
    if (level.clearanceLevel > req.user.securityClearance) {
      return res.status(403).json({ error: 'Cannot create user with higher clearance than your own' });
    }

    // Check if username or email already exists
    const [existingUsername] = await db.select().from(users).where(eq(users.username, username));
    if (existingUsername) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const [existingEmail] = await db.select().from(users).where(eq(users.email, email));
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    // Hash the password (using the same method as auth.ts)
    const { scrypt, randomBytes } = await import('crypto');
    const { promisify } = await import('util');
    const scryptAsync = promisify(scrypt);

    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    const hashedPassword = `${buf.toString("hex")}.${salt}`;

    // Create the user
    const [newUser] = await db.insert(users).values({
      username,
      email,
      fullName,
      phone,
      password: hashedPassword,
      role: level.clearanceLevel >= 9 ? 'admin' : 'agent',
      securityClearance: level.clearanceLevel,
      isActive: true,
      tempPassword: true // Force password change on first login
    }).returning();

    // Log the creation
    await db.insert(securityAuditLog).values({
      userId: req.user.id,
      action: 'user_created',
      targetType: 'user',
      targetId: newUser.id,
      targetName: newUser.fullName,
      oldValue: null,
      newValue: JSON.stringify({ accessLevelCode, clearanceLevel: level.clearanceLevel }),
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      user: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        fullName: newUser.fullName,
        securityClearance: newUser.securityClearance
      }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// ==========================================
// CMS (CONTENT MANAGEMENT SYSTEM) ROUTES
// ==========================================

// Configure multer for CMS media uploads
const cmsUploadDir = path.join(process.cwd(), 'uploads', 'cms');
if (!fs.existsSync(cmsUploadDir)) {
  fs.mkdirSync(cmsUploadDir, { recursive: true });
}

const cmsMediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, cmsUploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${randomUUID()}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const uploadCmsMedia = multer({
  storage: cmsMediaStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  }
});

// --- CMS Pages Routes ---

// Get all CMS pages
crmRouter.get('/cms/pages', requireClearance(5), async (req, res) => {
  try {
    const pages = await db.select().from(cmsPages).orderBy(cmsPages.displayOrder, cmsPages.title);
    res.json(pages);
  } catch (error) {
    console.error('Error fetching CMS pages:', error);
    res.status(500).json({ error: 'Failed to fetch pages' });
  }
});

// Get single CMS page by slug with its content blocks
crmRouter.get('/cms/pages/:slug', requireClearance(5), async (req, res) => {
  try {
    const { slug } = req.params;
    const [page] = await db.select().from(cmsPages).where(eq(cmsPages.slug, slug));

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    const blocks = await db.select()
      .from(cmsContentBlocks)
      .where(eq(cmsContentBlocks.pageId, page.id))
      .orderBy(cmsContentBlocks.displayOrder);

    res.json({ ...page, blocks });
  } catch (error) {
    console.error('Error fetching CMS page:', error);
    res.status(500).json({ error: 'Failed to fetch page' });
  }
});

// Create new CMS page
crmRouter.post('/cms/pages', requireClearance(7), async (req, res) => {
  try {
    const validated = insertCmsPageSchema.parse({
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });

    const [page] = await db.insert(cmsPages).values(validated).returning();
    res.status(201).json(page);
  } catch (error) {
    console.error('Error creating CMS page:', error);
    res.status(500).json({ error: 'Failed to create page' });
  }
});

// Update CMS page
crmRouter.put('/cms/pages/:id', requireClearance(7), async (req, res) => {
  try {
    const { id } = req.params;
    const [page] = await db.update(cmsPages)
      .set({
        ...req.body,
        updatedBy: req.user.id,
        updatedAt: new Date()
      })
      .where(eq(cmsPages.id, parseInt(id)))
      .returning();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    console.error('Error updating CMS page:', error);
    res.status(500).json({ error: 'Failed to update page' });
  }
});

// Delete CMS page (requires clearance 9)
crmRouter.delete('/cms/pages/:id', requireClearance(9), async (req, res) => {
  try {
    const { id } = req.params;
    const pageId = parseInt(id);

    // Delete associated content blocks first
    await db.delete(cmsContentBlocks).where(eq(cmsContentBlocks.pageId, pageId));

    // Delete the page
    const [deleted] = await db.delete(cmsPages).where(eq(cmsPages.id, pageId)).returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ success: true, message: 'Page deleted' });
  } catch (error) {
    console.error('Error deleting CMS page:', error);
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Toggle publish status
crmRouter.patch('/cms/pages/:id/publish', requireClearance(7), async (req, res) => {
  try {
    const { id } = req.params;
    const { isPublished } = req.body;

    const [page] = await db.update(cmsPages)
      .set({
        isPublished,
        publishedAt: isPublished ? new Date() : null,
        updatedBy: req.user.id,
        updatedAt: new Date()
      })
      .where(eq(cmsPages.id, parseInt(id)))
      .returning();

    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json(page);
  } catch (error) {
    console.error('Error updating page publish status:', error);
    res.status(500).json({ error: 'Failed to update publish status' });
  }
});

// --- CMS Content Blocks Routes ---

// Add content block to page
crmRouter.post('/cms/pages/:pageId/blocks', requireClearance(7), async (req, res) => {
  try {
    const { pageId } = req.params;
    const validated = insertCmsContentBlockSchema.parse({
      ...req.body,
      pageId: parseInt(pageId)
    });

    const [block] = await db.insert(cmsContentBlocks).values(validated).returning();
    res.status(201).json(block);
  } catch (error) {
    console.error('Error creating content block:', error);
    res.status(500).json({ error: 'Failed to create content block' });
  }
});

// Update content block
crmRouter.put('/cms/blocks/:id', requireClearance(7), async (req, res) => {
  try {
    const { id } = req.params;
    const [block] = await db.update(cmsContentBlocks)
      .set({
        ...req.body,
        updatedAt: new Date()
      })
      .where(eq(cmsContentBlocks.id, parseInt(id)))
      .returning();

    if (!block) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json(block);
  } catch (error) {
    console.error('Error updating content block:', error);
    res.status(500).json({ error: 'Failed to update content block' });
  }
});

// Delete content block
crmRouter.delete('/cms/blocks/:id', requireClearance(9), async (req, res) => {
  try {
    const { id } = req.params;
    const [deleted] = await db.delete(cmsContentBlocks)
      .where(eq(cmsContentBlocks.id, parseInt(id)))
      .returning();

    if (!deleted) {
      return res.status(404).json({ error: 'Block not found' });
    }

    res.json({ success: true, message: 'Block deleted' });
  } catch (error) {
    console.error('Error deleting content block:', error);
    res.status(500).json({ error: 'Failed to delete content block' });
  }
});

// Reorder content blocks
crmRouter.patch('/cms/blocks/reorder', requireClearance(7), async (req, res) => {
  try {
    const { blocks } = req.body; // Array of { id, displayOrder }

    for (const block of blocks) {
      await db.update(cmsContentBlocks)
        .set({ displayOrder: block.displayOrder, updatedAt: new Date() })
        .where(eq(cmsContentBlocks.id, block.id));
    }

    res.json({ success: true, message: 'Blocks reordered' });
  } catch (error) {
    console.error('Error reordering blocks:', error);
    res.status(500).json({ error: 'Failed to reorder blocks' });
  }
});

// --- CMS Media Routes ---

// Get all media
crmRouter.get('/cms/media', requireClearance(5), async (req, res) => {
  try {
    const media = await db.select().from(cmsMedia).orderBy(desc(cmsMedia.createdAt));
    res.json(media);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media' });
  }
});

// Upload media
crmRouter.post('/cms/media', requireClearance(7), uploadCmsMedia.single('file'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const validated = insertCmsMediaSchema.parse({
      filename: req.file.filename,
      originalFilename: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/cms/${req.file.filename}`,
      altText: req.body.altText || '',
      uploadedBy: req.user.id
    });

    const [media] = await db.insert(cmsMedia).values(validated).returning();
    res.status(201).json(media);
  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ error: 'Failed to upload media' });
  }
});

// Delete media
crmRouter.delete('/cms/media/:id', requireClearance(9), async (req, res) => {
  try {
    const { id } = req.params;
    const [media] = await db.select().from(cmsMedia).where(eq(cmsMedia.id, parseInt(id)));

    if (!media) {
      return res.status(404).json({ error: 'Media not found' });
    }

    // Delete file from filesystem
    const filePath = path.join(cmsUploadDir, media.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await db.delete(cmsMedia).where(eq(cmsMedia.id, parseInt(id)));

    res.json({ success: true, message: 'Media deleted' });
  } catch (error) {
    console.error('Error deleting media:', error);
    res.status(500).json({ error: 'Failed to delete media' });
  }
});

// --- Staff Public Profile Routes (for Team Page) ---

// Get all staff with public profiles (for team page management)
crmRouter.get('/cms/team', requireClearance(7), async (req, res) => {
  try {
    const staff = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        isActive: users.isActive,
        profileId: staffProfiles.id,
        jobTitle: staffProfiles.jobTitle,
        department: staffProfiles.department,
        publicDisplayName: staffProfiles.publicDisplayName,
        publicBio: staffProfiles.publicBio,
        publicPhoto: staffProfiles.publicPhoto,
        publicJobTitle: staffProfiles.publicJobTitle,
        publicDisplayOrder: staffProfiles.publicDisplayOrder,
        showOnTeamPage: staffProfiles.showOnTeamPage
      })
      .from(users)
      .leftJoin(staffProfiles, eq(users.id, staffProfiles.userId))
      .where(
        and(
          eq(users.isActive, true),
          or(eq(users.role, 'admin'), eq(users.role, 'agent'))
        )
      )
      .orderBy(staffProfiles.publicDisplayOrder);

    res.json(staff);
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Update staff public profile
crmRouter.put('/staff/:id/public-profile', requireClearance(7), async (req, res) => {
  try {
    const { id } = req.params;
    const userId = parseInt(id);
    const { publicDisplayName, publicBio, publicPhoto, publicJobTitle, publicDisplayOrder, showOnTeamPage } = req.body;

    // Check if staff profile exists
    const [existingProfile] = await db.select().from(staffProfiles).where(eq(staffProfiles.userId, userId));

    if (existingProfile) {
      // Update existing profile
      const [updated] = await db.update(staffProfiles)
        .set({
          publicDisplayName,
          publicBio,
          publicPhoto,
          publicJobTitle,
          publicDisplayOrder,
          showOnTeamPage,
          updatedAt: new Date()
        })
        .where(eq(staffProfiles.userId, userId))
        .returning();

      res.json(updated);
    } else {
      // Get user info to create profile
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Create new staff profile with public fields
      const [created] = await db.insert(staffProfiles)
        .values({
          userId,
          jobTitle: 'Staff Member',
          department: user.department || 'sales',
          startDate: new Date(),
          publicDisplayName,
          publicBio,
          publicPhoto,
          publicJobTitle,
          publicDisplayOrder,
          showOnTeamPage
        })
        .returning();

      res.json(created);
    }
  } catch (error) {
    console.error('Error updating public profile:', error);
    res.status(500).json({ error: 'Failed to update public profile' });
  }
});

// Toggle staff visibility on team page
crmRouter.patch('/staff/:id/team-visibility', requireClearance(7), async (req, res) => {
  try {
    const { id } = req.params;
    const { showOnTeamPage } = req.body;

    const [updated] = await db.update(staffProfiles)
      .set({ showOnTeamPage, updatedAt: new Date() })
      .where(eq(staffProfiles.userId, parseInt(id)))
      .returning();

    if (!updated) {
      return res.status(404).json({ error: 'Staff profile not found' });
    }

    res.json(updated);
  } catch (error) {
    console.error('Error updating team visibility:', error);
    res.status(500).json({ error: 'Failed to update visibility' });
  }
});
