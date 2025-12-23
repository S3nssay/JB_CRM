import { Router } from 'express';
import { storage } from './storage';
import { db } from './db';
import {
  insertPropertySchema,
  portalCredentialsFormSchema,
  maintenanceTicketFormSchema,
  InsertProperty,
  supportTickets,
  contractorQuotes,
  ticketWorkflowEvents,
  contractors,
  propertyCertificates,
  insertPropertyCertificateSchema,
  managementFees,
  insertManagementFeeSchema,
  tenancyContracts,
  landlords,
  tenants,
  properties,
  complianceRequirements,
  complianceStatus,
  insertComplianceRequirementSchema,
  insertComplianceStatusSchema,
  maintenanceTickets
} from '@shared/schema';

import { eq, desc, and, sql } from 'drizzle-orm';
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
import { randomUUID } from 'crypto';

import { propertyImport } from './propertyImportService';

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

// ==========================================
// Property CRUD operations

crmRouter.get('/properties', requireAgent, async (req, res) => {
  try {
    const allProperties = await storage.getAllProperties();
    res.json(allProperties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

crmRouter.get('/rental-agreements', requireAgent, async (req, res) => {
  try {
    const allRentalAgreements = await storage.getAllRentalAgreements();
    res.json(allRentalAgreements);
  } catch (error) {
    console.error('Error fetching rental agreements:', error);
    res.status(500).json({ error: 'Failed to fetch rental agreements' });
  }
});

crmRouter.get('/managed-properties', requireAgent, async (req, res) => {
  try {
    const managedProps = await storage.getManagedPropertiesV3();

    // Enrich with property details
    const enriched = await Promise.all(managedProps.map(async (mp) => {
      const property = await storage.getProperty(mp.propertyId as number);
      const landlord = await storage.getUnifiedContact(mp.landlordId as number);

      return {
        ...mp,
        id: mp.id, // managed_properties ID
        propertyId: property?.id,
        propertyAddress: property ? `${property.addressLine1}, ${property.postcode}` : 'Unknown',
        postcode: property?.postcode,
        propertyType: property?.propertyType,
        bedrooms: property?.bedrooms,
        landlordId: landlord?.id,
        landlordName: landlord?.fullName,
        landlordEmail: landlord?.email,
        landlordMobile: landlord?.phone,
        managementFeePercent: mp.managementFeeType === 'percentage' ? mp.managementFeeValue : null,
        managementFeeFixed: mp.managementFeeType === 'fixed' ? mp.managementFeeValue : null,
        managementPeriod: 'Monthly',
        status: mp.status
      };
    }));

    res.json(enriched);
  } catch (error) {
    console.error('Error fetching managed properties v3:', error);
    res.status(500).json({ error: 'Failed to fetch managed properties' });
  }
});

crmRouter.get('/properties', requireAgent, async (req, res) => {
  try {
    const properties = await storage.getAllProperties();
    res.json(properties);
  } catch (error) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ error: 'Failed to fetch properties' });
  }
});

crmRouter.get('/properties/:id', requireAgent, async (req, res) => {
  try {
    const property = await storage.getProperty(parseInt(req.params.id));
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

    // Convert price to pence if provided
    if (updates.price) {
      updates.price = updates.price * 100;
    }
    if (updates.deposit) {
      updates.deposit = updates.deposit * 100;
    }

    const property = await storage.updateProperty(id, updates);
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
    if (updates.price) {
      updates.price = updates.price * 100;
    }
    if (updates.deposit) {
      updates.deposit = updates.deposit * 100;
    }

    const property = await storage.updateProperty(id, updates);
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

crmRouter.get('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const tenant = await storage.getTenant(parseInt(req.params.id));
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
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



// Import property from URL
crmRouter.post('/properties/import', requireAgent, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    const property = await propertyImport.importFromUrl(url, req.user?.id);
    res.json({ success: true, property });
  } catch (error: any) {
    console.error('Error importing property:', error);
    res.status(500).json({ error: error.message || 'Failed to import property' });
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
    const lettingsProperties = properties.filter(p => p.listingType === 'rental' && p.status === 'let');

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
// LANDLORD MANAGEMENT ROUTES
// ==========================================

// Get all landlords
crmRouter.get('/landlords', requireAgent, async (req, res) => {
  try {
    const landlordsList = await storage.getAllLandlords();
    res.json(landlordsList);
  } catch (error) {
    console.error('Error fetching landlords:', error);
    res.status(500).json({ error: 'Failed to fetch landlords' });
  }
});

// Get single landlord
crmRouter.get('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const landlord = await storage.getLandlord(id);

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
crmRouter.post('/landlords', requireAgent, async (req, res) => {
  try {
    const { name, email, mobile, bankAccountNo, sortCode } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const landlord = await storage.createLandlord({
      name,
      email: email || null,
      mobile: mobile || null,
      bankAccountNo: bankAccountNo || null,
      sortCode: sortCode || null,
      isActive: true
    });

    res.json(landlord);
  } catch (error) {
    console.error('Error creating landlord:', error);
    res.status(500).json({ error: 'Failed to create landlord' });
  }
});

// Update landlord
crmRouter.put('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const landlord = await storage.updateLandlord(id, updates);
    res.json(landlord);
  } catch (error) {
    console.error('Error updating landlord:', error);
    res.status(500).json({ error: 'Failed to update landlord' });
  }
});

// Delete landlord
crmRouter.delete('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteLandlord(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting landlord:', error);
    res.status(500).json({ error: 'Failed to delete landlord' });
  }
});

// ==========================================
// TENANT MANAGEMENT ROUTES
// ==========================================

// Get all tenants
crmRouter.get('/tenants', requireAgent, async (req, res) => {
  try {
    const allUsers = await storage.getAllUsers();
    const tenants = allUsers.filter(u => u.role === 'tenant');

    const tenantsWithoutPasswords = tenants.map(t => ({
      ...t,
      password: undefined
    }));

    res.json(tenantsWithoutPasswords);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get single tenant
crmRouter.get('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const tenant = await storage.getUser(id);

    if (!tenant || tenant.role !== 'tenant') {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ ...tenant, password: undefined });
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// Create tenant
crmRouter.post('/tenants', requireAgent, async (req, res) => {
  try {
    const { username, password, email, fullName, phone } = req.body;

    if (!username || !password || !email || !fullName) {
      return res.status(400).json({ error: 'Username, password, email, and full name are required' });
    }

    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const tenant = await storage.createUser({
      username,
      password,
      email,
      fullName,
      phone: phone || null,
      role: 'tenant',
      isActive: true
    });

    res.json({ ...tenant, password: undefined });
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Update tenant
crmRouter.put('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { fullName, email, phone, password, isActive } = req.body;

    const updates: any = {};
    if (fullName) updates.fullName = fullName;
    if (email) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (typeof isActive === 'boolean') updates.isActive = isActive;
    if (password) updates.password = password;

    const tenant = await storage.updateUser(id, updates);
    res.json({ ...tenant, password: undefined });
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
});

// Delete tenant (soft delete - deactivate)
crmRouter.delete('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.updateUser(id, { isActive: false });
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tenant:', error);
    res.status(500).json({ error: 'Failed to delete tenant' });
  }
});

// ==========================================
// RENTAL AGREEMENTS ROUTES
// ==========================================

// Get all rental agreements with joined data
crmRouter.get('/rental-agreements', requireAgent, async (req, res) => {
  try {
    const agreements = await storage.getAllRentalAgreements();
    res.json(agreements);
  } catch (error) {
    console.error('Error fetching rental agreements:', error);
    res.status(500).json({ error: 'Failed to fetch rental agreements' });
  }
});

// Get single rental agreement
crmRouter.get('/rental-agreements/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const agreement = await storage.getRentalAgreement(id);

    if (!agreement) {
      return res.status(404).json({ error: 'Rental agreement not found' });
    }

    res.json(agreement);
  } catch (error) {
    console.error('Error fetching rental agreement:', error);
    res.status(500).json({ error: 'Failed to fetch rental agreement' });
  }
});

// Create rental agreement
crmRouter.post('/rental-agreements', requireAgent, async (req, res) => {
  try {
    const {
      propertyId, landlordId, rentAmount, rentFrequency,
      managementFeePercent, tenancyStart, tenancyEnd,
      depositHeldBy, depositAmount
    } = req.body;

    if (!propertyId || !landlordId || !rentAmount || !rentFrequency) {
      return res.status(400).json({ error: 'Property ID, landlord ID, rent amount, and frequency are required' });
    }

    const agreement = await storage.createRentalAgreement({
      propertyId,
      landlordId,
      rentAmount,
      rentFrequency,
      managementFeePercent: managementFeePercent || null,
      tenancyStart: tenancyStart ? new Date(tenancyStart) : null,
      tenancyEnd: tenancyEnd ? new Date(tenancyEnd) : null,
      depositHeldBy: depositHeldBy || null,
      depositAmount: depositAmount || null,
      status: 'active'
    });

    res.json(agreement);
  } catch (error) {
    console.error('Error creating rental agreement:', error);
    res.status(500).json({ error: 'Failed to create rental agreement' });
  }
});

// Update rental agreement
crmRouter.put('/rental-agreements/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;

    const agreement = await storage.updateRentalAgreement(id, updates);
    res.json(agreement);
  } catch (error) {
    console.error('Error updating rental agreement:', error);
    res.status(500).json({ error: 'Failed to update rental agreement' });
  }
});

// Delete rental agreement
crmRouter.delete('/rental-agreements/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await storage.deleteRentalAgreement(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting rental agreement:', error);
    res.status(500).json({ error: 'Failed to delete rental agreement' });
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
      SELECT c.id FROM contractors c
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
      FROM support_tickets st
      LEFT JOIN users u ON st.tenant_id = u.id
      LEFT JOIN properties p ON st.property_id = p.id
      LEFT JOIN contractors c ON st.assigned_to_id = c.id
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

// Contractor data imported from Excel (uploads/contractors/Contractor List.xlsx)
const contractorData = [
  { id: 1, companyName: 'Gansukh', contactName: 'Gansukh', phone: '+447883580505', specializations: ['plumbing', 'gas', 'heating'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false },
  { id: 2, companyName: 'Mustapha', contactName: 'Mustapha', phone: '+447912041796', specializations: ['plumbing', 'gas', 'heating'], availableEmergency: true, responseTime: '4 hours', preferredContractor: true },
  { id: 3, companyName: "Ahmed's Plumber", contactName: 'Ahmed', phone: '+447925287198', specializations: ['plumbing', 'gas', 'heating'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false },
  { id: 4, companyName: 'Sarder (Oasis)', contactName: 'Sarder', phone: '+447717122229', specializations: ['removals'], availableEmergency: false, responseTime: '48 hours', preferredContractor: false },
  { id: 5, companyName: 'Elias', contactName: 'Elias', phone: '+447XXXXXXXXX', specializations: ['appliances'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false },
  { id: 6, companyName: 'George', contactName: 'George', phone: '+447XXXXXXXXX', specializations: ['electrical'], availableEmergency: true, responseTime: '4 hours', preferredContractor: true },
  { id: 7, companyName: 'Rilind', contactName: 'Rilind', phone: '+447XXXXXXXXX', specializations: ['electrical'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false },
  { id: 8, companyName: 'Quick Pest', contactName: 'Quick Pest', phone: '+447XXXXXXXXX', specializations: ['pest_control'], availableEmergency: true, responseTime: '4 hours', preferredContractor: true },
  { id: 9, companyName: 'Nadel', contactName: 'Nadel', phone: '+447XXXXXXXXX', specializations: ['general', 'handyman', 'roofing'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false },
  { id: 10, companyName: 'Assis', contactName: 'Assis', phone: '+447XXXXXXXXX', specializations: ['general', 'handyman'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false },
  { id: 11, companyName: 'Ericson', contactName: 'Ericson', phone: '+447XXXXXXXXX', specializations: ['general', 'handyman'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false },
  { id: 12, companyName: 'Said - Waldorf Carpet', contactName: 'Said', phone: '+447XXXXXXXXX', specializations: ['cleaning', 'carpet'], availableEmergency: false, responseTime: '48 hours', preferredContractor: false },
  { id: 13, companyName: 'Fatima - Waldorf Carpet', contactName: 'Fatima', phone: '+447XXXXXXXXX', specializations: ['cleaning', 'carpet'], availableEmergency: false, responseTime: '48 hours', preferredContractor: false },
  { id: 14, companyName: 'Tayz', contactName: 'Tayz', phone: '+447XXXXXXXXX', specializations: ['cleaning'], availableEmergency: false, responseTime: '24 hours', preferredContractor: false }
];

// Get all contractors for assignment dropdown
crmRouter.get('/contractors', requireAgent, async (req, res) => {
  try {
    const { specialization, available } = req.query;

    let filtered = [...contractorData];

    // Filter by specialization
    if (specialization) {
      filtered = filtered.filter(c =>
        c.specializations.some(s =>
          s.toLowerCase().includes((specialization as string).toLowerCase()) ||
          (specialization as string).toLowerCase().includes(s.toLowerCase())
        )
      );
    }

    // Filter for emergency availability
    if (available === 'emergency') {
      filtered = filtered.filter(c => c.availableEmergency);
    }

    // Sort preferred contractors first
    filtered.sort((a, b) => {
      if (a.preferredContractor && !b.preferredContractor) return -1;
      if (!a.preferredContractor && b.preferredContractor) return 1;
      return 0;
    });

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching contractors:', error);
    res.status(500).json({ error: 'Failed to fetch contractors' });
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

    let candidates = contractorData.filter(c =>
      c.specializations.some(s => requiredSpecs.includes(s))
    );

    // If emergency, prioritize emergency contractors
    if (emergency === 'true') {
      const emergencyContractors = candidates.filter(c => c.availableEmergency);
      if (emergencyContractors.length > 0) {
        candidates = emergencyContractors;
      }
    }

    // Sort by preferred status
    candidates.sort((a, b) => {
      if (a.preferredContractor && !b.preferredContractor) return -1;
      if (!a.preferredContractor && b.preferredContractor) return 1;
      return 0;
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
    const rentalProperties = allProperties.filter(p => p.listingType === 'rental');

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
    res.status(500).json({ error: 'Failed to update properties' });
  }
});

// ==========================================
// MANAGED PROPERTIES API ROUTES
// ==========================================

// Get all landlords
crmRouter.get('/landlords', requireAgent, async (req, res) => {
  try {
    const landlordsList = await storage.getAllLandlords();
    res.json(landlordsList);
  } catch (error) {
    console.error('Error fetching landlords:', error);
    res.status(500).json({ error: 'Failed to fetch landlords' });
  }
});

// Get single landlord
crmRouter.get('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const landlord = await storage.getLandlord(parseInt(req.params.id));
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
crmRouter.post('/landlords', requireAgent, async (req, res) => {
  try {
    const landlord = await storage.createLandlord(req.body);
    res.json(landlord);
  } catch (error) {
    console.error('Error creating landlord:', error);
    res.status(500).json({ error: 'Failed to create landlord' });
  }
});

// Update landlord
crmRouter.patch('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const landlord = await storage.updateLandlord(parseInt(req.params.id), req.body);
    res.json(landlord);
  } catch (error) {
    console.error('Error updating landlord:', error);
    res.status(500).json({ error: 'Failed to update landlord' });
  }
});

// Get all tenants
crmRouter.get('/tenants', requireAgent, async (req, res) => {
  try {
    const tenantsList = await storage.getAllTenants();
    res.json(tenantsList);
  } catch (error) {
    console.error('Error fetching tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// Get single tenant
crmRouter.get('/tenants/:id', requireAgent, async (req, res) => {
  try {
    const tenant = await storage.getTenant(parseInt(req.params.id));
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }
    res.json(tenant);
  } catch (error) {
    console.error('Error fetching tenant:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
});

// Create tenant
crmRouter.post('/tenants', requireAgent, async (req, res) => {
  try {
    const tenant = await storage.createTenant(req.body);
    res.json(tenant);
  } catch (error) {
    console.error('Error creating tenant:', error);
    res.status(500).json({ error: 'Failed to create tenant' });
  }
});

// Get all rental agreements with property, landlord, and tenant details
crmRouter.get('/rental-agreements', requireAgent, async (req, res) => {
  try {
    const agreements = await storage.getAllRentalAgreements();
    res.json(agreements);
  } catch (error) {
    console.error('Error fetching rental agreements:', error);
    res.status(500).json({ error: 'Failed to fetch rental agreements' });
  }
});

// Get single rental agreement
crmRouter.get('/rental-agreements/:id', requireAgent, async (req, res) => {
  try {
    const agreement = await storage.getRentalAgreement(parseInt(req.params.id));
    if (!agreement) {
      return res.status(404).json({ error: 'Rental agreement not found' });
    }
    res.json(agreement);
  } catch (error) {
    console.error('Error fetching rental agreement:', error);
    res.status(500).json({ error: 'Failed to fetch rental agreement' });
  }
});

// Create rental agreement
crmRouter.post('/rental-agreements', requireAgent, async (req, res) => {
  try {
    const agreement = await storage.createRentalAgreement(req.body);
    res.json(agreement);
  } catch (error) {
    console.error('Error creating rental agreement:', error);
    res.status(500).json({ error: 'Failed to create rental agreement' });
  }
});

// Update rental agreement
crmRouter.patch('/rental-agreements/:id', requireAgent, async (req, res) => {
  try {
    const agreement = await storage.updateRentalAgreement(parseInt(req.params.id), req.body);
    res.json(agreement);
  } catch (error) {
    console.error('Error updating rental agreement:', error);
    res.status(500).json({ error: 'Failed to update rental agreement' });
  }
});

// Get comprehensive managed properties list (properties with landlord, tenant, agreement details)
crmRouter.get('/managed-properties', requireAgent, async (req, res) => {
  try {
    // Get all properties with status='let'
    const allProperties = await storage.getAllProperties();
    const managedProperties = allProperties.filter(p => p.status === 'let');

    // Get all landlords and agreements
    const landlords = await storage.getAllLandlords();
    const tenants = await storage.getAllTenants();
    const agreements = await storage.getAllRentalAgreements();

    // Build comprehensive managed properties list
    const managedList = managedProperties.map(property => {
      // Find related agreement
      const agreement = agreements.find(a => a.propertyId === property.id);

      // Find related landlord
      const landlord = agreement ? landlords.find(l => l.id === agreement.landlordId) : null;

      // Find related tenant (from agreement or tenants table)
      const tenant = tenants.find(t => t.propertyId === property.id);

      return {
        id: property.id,
        propertyAddress: `${property.addressLine1}${property.addressLine2 ? ', ' + property.addressLine2 : ''}, ${property.postcode}`,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,

        // Landlord info
        landlordId: landlord?.id || null,
        landlordName: landlord?.name || 'Not assigned',
        landlordEmail: landlord?.email || null,
        landlordMobile: landlord?.mobile || null,
        landlordCompanyName: landlord?.companyName || null,

        // Tenant info
        tenantId: tenant?.id || null,
        tenantUserId: tenant?.userId || null,
        tenantMoveInDate: tenant?.moveInDate || null,
        tenantMoveOutDate: tenant?.moveOutDate || null,
        tenantStatus: tenant?.status || null,

        // Agreement/rental info
        agreementId: agreement?.id || null,
        rentAmount: agreement?.rentAmount || property.price || 0,
        rentFrequency: agreement?.rentFrequency || property.rentPeriod || 'Monthly',
        rentStartDate: agreement?.rentStartDate || agreement?.tenancyStart || null,
        rentEndDate: agreement?.rentEndDate || agreement?.tenancyEnd || null,

        // Deposit info
        depositAmount: agreement?.depositAmount || property.deposit || 0,
        depositHeldBy: agreement?.depositHeldBy || 'Not specified',
        depositProtectionRef: agreement?.depositProtectionRef || null,

        // Management info
        managementFeePercent: agreement?.managementFeePercent || null,
        managementFeeFixed: agreement?.managementFeeFixed || null,
        managementPeriod: agreement?.managementPeriod || 'Monthly',
        managementStartDate: agreement?.managementStartDate || null,
        managementEndDate: agreement?.managementEndDate || null,

        // Standing order
        standingOrderSetup: agreement?.standingOrderSetup || false,
        standingOrderRef: agreement?.standingOrderRef || null,

        // Checklist completion (placeholder - would need document tracking)
        checklistComplete: 0,
        checklistTotal: 17,

        createdAt: property.createdAt
      };
    });

    res.json(managedList);
  } catch (error) {
    console.error('Error fetching managed properties:', error);
    res.status(500).json({ error: 'Failed to fetch managed properties' });
  }
});

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

// Get managed properties with landlord, tenant, and contract details
crmRouter.get('/managed-properties', requireAgent, async (req, res) => {
  try {
    // Get all properties with their associated contracts, landlords, and tenants
    const allProperties = await db.select().from(properties);
    const allContracts = await db.select().from(tenancyContracts);
    const allLandlords = await db.select().from(landlords);
    const allTenants = await db.select().from(tenants);
    const allFees = await db.select().from(managementFees);
    const allCertificates = await db.select().from(propertyCertificates);

    // Build managed properties response
    const managedProperties = allProperties.map(property => {
      const propertyContracts = allContracts.filter(c => c.propertyId === property.id);
      const activeContract = propertyContracts.find(c => c.status === 'active');
      const propertyLandlord = activeContract ? allLandlords.find(l => l.id === activeContract.landlordId) : null;
      const propertyTenant = activeContract && activeContract.tenantId ? allTenants.find(t => t.id === activeContract.tenantId) : null;
      const propertyFees = allFees.filter(f => f.propertyId === property.id);
      const currentFee = propertyFees.find(f => !f.effectiveTo);
      const propertyCerts = allCertificates.filter(c => c.propertyId === property.id);
      const expiringSoonCerts = propertyCerts.filter(c => {
        if (!c.expiryDate) return false;
        const daysUntilExpiry = Math.floor((new Date(c.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
      });

      return {
        ...property,
        landlord: propertyLandlord,
        tenant: propertyTenant,
        activeContract,
        managementFee: currentFee?.feePercentage || null,
        certificates: propertyCerts,
        expiringSoonCertificates: expiringSoonCerts.length,
        complianceStatus: propertyCerts.every(c => c.status === 'valid') ? 'compliant' : 'attention_needed'
      };
    });

    res.json(managedProperties);
  } catch (error) {
    console.error('Error fetching managed properties:', error);
    res.status(500).json({ error: 'Failed to fetch managed properties' });
  }
});

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

// ==========================================
// LANDLORD ROUTES
// ==========================================

// Get all landlords
crmRouter.get('/landlords', requireAgent, async (req, res) => {
  try {
    const landlords = await storage.getLandlords();
    res.json(landlords);
  } catch (error) {
    console.error('Error fetching landlords:', error);
    res.status(500).json({ error: 'Failed to fetch landlords' });
  }
});

// Get single landlord
crmRouter.get('/landlords/:id', requireAgent, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const landlord = await storage.getLandlord(id);
    if (!landlord) {
      return res.status(404).json({ error: 'Landlord not found' });
    }
    res.json(landlord);
  } catch (error) {
    console.error('Error fetching landlord:', error);
    res.status(500).json({ error: 'Failed to fetch landlord' });
  }
});

// Set all properties as managed
crmRouter.post('/admin/set-all-managed', requireAdmin, async (req, res) => {
  try {
    // Update all properties to isManaged = true
    const result = await db.update(properties).set({ isManaged: true });
    res.json({ success: true, message: 'All properties set to managed' });
  } catch (error) {
    console.error('Error setting properties to managed:', error);
    res.status(500).json({ error: 'Failed to update properties' });
  }
});

// ==========================================
// V3 UNIFIED CONTACTS API ROUTES
// ==========================================

crmRouter.get('/contacts', requireAgent, async (req, res) => {
  try {
    const filters = {
      contactType: req.query.contactType as string,
      status: req.query.status as string
    };
    const contacts = await storage.getUnifiedContacts(filters);
    res.json(contacts);
  } catch (error) {
    console.error('Error fetching v3 contacts:', error);
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
