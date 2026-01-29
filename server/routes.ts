import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertPropertySchema, insertPropertyInquirySchema, insertContactSchema, insertValuationSchema, cmsPages, cmsContentBlocks, staffProfiles, users } from '@shared/schema';
import { db } from './db';
import { eq, and, desc } from 'drizzle-orm';
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { v4 as uuidv4 } from 'uuid';
import { randomUUID } from "crypto";
import { lookupAddressesUsingPostcodesIO, getLandRegistryPriceData, calculateOfferPrice, validateUkPostcode, geocodePostcode } from './ukPropertyDataNew';
import { sendPropertyOfferSMS, PropertyOfferDetails } from './smsService';
import { sendPropertyOfferWhatsApp, PropertyOfferWhatsAppDetails, sendPropertyDetailsWhatsApp, PropertyDetailsWhatsAppMessage, sendPropertyAlertWhatsApp, PropertyAlertWhatsAppMessage } from './whatsappService';
import { setupAuth } from './auth';
import { parseNaturalLanguageQuery } from './openai';
import { parseWithOpenAI } from './aiPropertySearch';
import { SearchFilters, ParsedIntent } from '@shared/schema';
import { aiPhone } from './aiPhoneService';

// Basic pattern matching for property queries (fallback)
function parseBasicQuery(query: string): ParsedIntent {
  const lowerQuery = query.toLowerCase();
  const filters: SearchFilters = {};
  let intent: 'conversation' | 'property_search' | 'unknown' = 'conversation';
  let explanation = '';

  // Check for greetings and conversational phrases
  if (/\b(hi|hello|hey|help|thanks?|valuation|worth|value)\b/i.test(query)) {
    intent = 'conversation';
    return {
      filters,
      intent,
      confidence: 0.9,
      explanation: 'Conversational query detected'
    };
  }

  // Check for property search indicators
  const hasPropertyKeywords = /\b(show|find|looking for|want|need|search|property|properties|flat|house|bedroom|bed|rent|rental|sale|buy)\b/i.test(lowerQuery);

  if (hasPropertyKeywords) {
    intent = 'property_search';

    // Parse listing type
    if (/\b(buy|purchase|sale|for sale|buying)\b/i.test(lowerQuery)) {
      filters.isRental = false;
      explanation += 'Looking for properties to buy. ';
    } else if (/\b(rent|rental|let|letting|renting|to let)\b/i.test(lowerQuery)) {
      filters.isRental = true;
      explanation += 'Looking for properties to rent. ';
    }

    // Parse property type
    const propertyTypes: string[] = [];
    if (/\b(house|houses|home|homes|terraced|detached|semi)\b/i.test(lowerQuery)) {
      propertyTypes.push('house');
    }
    if (/\b(flat|flats|apartment|apartments)\b/i.test(lowerQuery)) {
      propertyTypes.push('flat');
    }
    if (/\b(studio|studios|bedsit)\b/i.test(lowerQuery)) {
      propertyTypes.push('studio');
    }
    if (propertyTypes.length > 0) {
      filters.propertyType = propertyTypes;
      explanation += `Property type: ${propertyTypes.join(', ')}. `;
    }

    // Parse bedrooms
    const bedroomMatch = lowerQuery.match(/\b(\d+)\s*(bed|bedroom|bedrooms?|br)\b/i);
    if (bedroomMatch) {
      filters.bedrooms = parseInt(bedroomMatch[1]);
      explanation += `${filters.bedrooms}+ bedrooms. `;
    }

    // Parse price range
    const underMatch = lowerQuery.match(/\b(under|below|less than|up to|maximum|max)\s*£?([0-9,]+)k?\b/i);
    if (underMatch) {
      filters.maxPrice = parsePrice(underMatch[2]);
      explanation += `Maximum price: £${filters.maxPrice.toLocaleString()}. `;
    }

    const overMatch = lowerQuery.match(/\b(over|above|more than|minimum|min|from)\s*£?([0-9,]+)k?\b/i);
    if (overMatch) {
      filters.minPrice = parsePrice(overMatch[2]);
      explanation += `Minimum price: £${filters.minPrice.toLocaleString()}. `;
    }

    // Parse location - areas and postcodes with comprehensive knowledge base
    const areas: string[] = [];
    const areaMatches = [
      { pattern: /\b(bayswater)\b/i, area: 'Bayswater' },
      { pattern: /\b(harlesden)\b/i, area: 'Harlesden' },
      { pattern: /\b(kilburn)\b/i, area: 'Kilburn' },
      { pattern: /\b(ladbroke grove)\b/i, area: 'Ladbroke Grove' },
      { pattern: /\b(maida vale|maida hill|little venice)\b/i, area: 'Maida Vale' },
      { pattern: /\b(north kensington)\b/i, area: 'North Kensington' },
      { pattern: /\b(queen\'?s park)\b/i, area: 'Queen\'s Park' },
      { pattern: /\b(westbourne park|westbourne)\b/i, area: 'Westbourne Park' },
      { pattern: /\b(kensal green)\b/i, area: 'Kensal Green' },
      { pattern: /\b(kensal rise)\b/i, area: 'Kensal Rise' },
      { pattern: /\b(willesden)\b/i, area: 'Willesden' },
      // Legacy matches for backward compatibility
      { pattern: /\b(notting hill)\b/i, area: 'Ladbroke Grove' }, // Maps to Ladbroke Grove
      { pattern: /\b(holland park)\b/i, area: 'North Kensington' }, // Maps to North Kensington
      { pattern: /\b(kensington)\b/i, area: 'North Kensington' },
      { pattern: /\b(paddington)\b/i, area: 'Bayswater' }, // Maps to Bayswater
    ];

    areaMatches.forEach(({ pattern, area }) => {
      if (pattern.test(lowerQuery)) {
        areas.push(area);
      }
    });

    if (areas.length > 0) {
      filters.areas = areas;
      explanation += `Areas: ${areas.join(', ')}. `;
    }

    // Enhanced postcode matching with area mapping
    const postcodeAreaMap: { [key: string]: string } = {
      'W2': 'Bayswater',
      'W9': 'Maida Vale',
      'W10': 'Ladbroke Grove',
      'W11': 'Westbourne Park',
      'NW6': 'Queen\'s Park',
      'NW10': 'Harlesden'
    };

    const postcodeMatch = lowerQuery.match(/\b(W2|W9|W10|W11|NW6|NW10)\b/i);
    if (postcodeMatch) {
      const postcode = postcodeMatch[1].toUpperCase();
      filters.postcode = postcode;
      explanation += `Postcode: ${postcode}. `;

      // Also add the corresponding area if not already included
      const correspondingArea = postcodeAreaMap[postcode];
      if (correspondingArea && !areas.includes(correspondingArea)) {
        if (!filters.areas) filters.areas = [];
        filters.areas.push(correspondingArea);
        explanation += `Area: ${correspondingArea}. `;
      }
    }
  }

  return {
    filters,
    intent,
    confidence: intent === 'property_search' && Object.keys(filters).length > 0 ? 0.8 : 0.5,
    explanation: explanation.trim() || 'Basic query parsing'
  };
}

function parsePrice(priceStr: string): number {
  const cleanStr = priceStr.replace(/,/g, '');
  const num = parseInt(cleanStr);

  // Handle 'k' suffix (thousands)
  if (priceStr.toLowerCase().includes('k')) {
    return num * 1000;
  }

  // If number is small, assume it's in thousands
  if (num < 10000 && num > 100) {
    return num * 1000;
  }

  return num;
}


import { crmRouter } from './crmRoutes';
import emailIntegrationRoutes from './routes/emailIntegrationRoutes';
import path from 'path';
import express from 'express';

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);

  // Set up authentication
  setupAuth(app);

  // Register CRM router
  app.use('/api/crm', crmRouter);

  // ==========================================
  // TWILIO VOICE WEBHOOKS (at /api/voice/*)
  // These are called by Twilio for inbound calls
  // ==========================================

  // Twilio webhook for inbound calls
  app.post('/api/voice/inbound', async (req, res) => {
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
  app.post('/api/voice/process-speech', async (req, res) => {
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
  app.post('/api/voice/status', async (req, res) => {
    try {
      await aiPhone.handleCallStatus(req.body);
      res.sendStatus(200);
    } catch (error) {
      console.error('Error handling call status:', error);
      res.sendStatus(500);
    }
  });

  // Register Email Integration router (Microsoft 365)
  app.use('/api/email-integration', emailIntegrationRoutes);

  // Serve uploaded property images statically
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

  // Also add an /api/upload route for the frontend compatibility
  app.use('/api/upload', crmRouter);

  // Middleware to check if user is authenticated
  const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
    if (req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ error: "Not authenticated" });
  };

  // User valuations endpoints
  app.get('/api/user/valuations', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const valuations = await storage.getValuationsByUser(userId);

      // Get associated property details for each valuation
      const valuationsWithDetails = await Promise.all(
        valuations.map(async (valuation) => {
          const property = await storage.getProperty(valuation.propertyId);
          return {
            ...valuation,
            property
          };
        })
      );

      res.json(valuationsWithDetails);
    } catch (err) {
      console.error('Failed to retrieve user valuations:', err);
      res.status(500).json({ error: 'Failed to retrieve your valuations' });
    }
  });

  // Get user's properties
  app.get('/api/user/properties', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const properties = await storage.getPropertiesByUser(userId);
      res.json(properties);
    } catch (err) {
      console.error('Failed to retrieve user properties:', err);
      res.status(500).json({ error: 'Failed to retrieve your properties' });
    }
  });

  // Save valuation to user account
  app.post('/api/user/valuations', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      const { propertyId, contactId, estimatedValue, offerValue } = req.body;

      if (!propertyId || !contactId || !estimatedValue || !offerValue) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create valuation with user ID
      const valuation = await storage.createValuation({
        propertyId,
        contactId,
        userId,
        estimatedValue,
        offerValue,
        status: 'saved'
      });

      res.status(201).json(valuation);
    } catch (err) {
      console.error('Failed to save valuation:', err);
      res.status(500).json({ error: 'Failed to save valuation' });
    }
  });

  // Add a proper healthcheck endpoint for monitoring
  app.get('/api/healthcheck', (req: Request, res: Response) => {
    // Check services and dependencies

    const twilioConfig = {
      accountSid: process.env.TWILIO_ACCOUNT_SID ? 'Configured' : 'Not configured',
      authToken: process.env.TWILIO_AUTH_TOKEN ? 'Configured' : 'Not configured',
      phoneNumber: process.env.TWILIO_PHONE_NUMBER || 'Not configured',
    };

    res.json({
      status: 'online',
      time: new Date().toISOString(),
      services: {
        twilio: twilioConfig,
        whatsapp: twilioConfig,
        database: 'Connected'
      },
      version: '1.0.0'
    });
  });

  // Helper function to handle validation errors
  const validateRequest = (schema: any, data: any) => {
    try {
      return { data: schema.parse(data), error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { data: null, error: fromZodError(error).message };
      }
      return { data: null, error: 'Invalid request data' };
    }
  };

  // Postcode validation endpoint
  app.get('/api/addresses/lookup', async (req: Request, res: Response) => {
    const term = req.query.term as string || req.query.postcode as string;

    if (!term) {
      return res.status(400).json({ error: 'Postcode is required' });
    }

    console.log(`Validating postcode: ${term}`);

    // Use our validateUkPostcode function
    const validationResult = await validateUkPostcode(term);

    if (!validationResult.valid) {
      return res.json({
        valid: false,
        message: "This doesn't appear to be a valid UK postcode. Please check and try again."
      });
    }

    // Postcode is valid, try to fetch address data
    try {
      // Get address information for this postcode
      const addresses = await lookupAddressesUsingPostcodesIO(term);

      // Return postcode details from validation along with addresses
      return res.json({
        valid: true,
        postcode: validationResult.postcode,
        region: validationResult.region,
        district: validationResult.district,
        addresses: addresses, // This might be empty but that's ok
        message: addresses.length === 0 ? "No addresses found for this postcode. Please enter your address manually." : ""
      });
    } catch (error) {
      console.error(`Error looking up addresses for postcode '${term}':`, error);

      // If address lookup fails but postcode is valid, still return success
      // The user can always enter their address manually
      return res.json({
        valid: true,
        postcode: validationResult.postcode,
        region: validationResult.region,
        district: validationResult.district,
        message: "Please enter your full address."
      });
    }
  });

  // Property valuation estimate endpoint
  app.post('/api/valuations/estimate', async (req: Request, res: Response) => {
    const { postcode, propertyType, bedrooms, condition } = req.body;

    if (!postcode || !propertyType || !bedrooms) {
      return res.status(400).json({ error: 'Postcode, property type, and bedrooms are required' });
    }

    try {
      console.log(`Generating property valuation for ${postcode}, ${propertyType}, ${bedrooms} bedrooms`);

      // First validate the postcode
      const validationResult = await validateUkPostcode(postcode);

      if (!validationResult.valid) {
        return res.status(400).json({
          error: 'Invalid postcode. Please enter a valid UK postcode.',
          validationError: true
        });
      }

      // Get real property price data from Land Registry data
      const propertyPriceData = await getLandRegistryPriceData(
        postcode,
        propertyType,
        parseInt(bedrooms)
      );

      // Calculate the offer price (15% discount)
      const { offerPrice, discountAmount, discountPercentage } = calculateOfferPrice(propertyPriceData.averagePrice);

      // Format data for the client
      const valuation = {
        priceInfo: {
          postcode: validationResult.postcode,
          region: validationResult.region || '',
          propertyType,
          bedrooms: parseInt(bedrooms),
          condition,
          averagePrice: propertyPriceData.averagePrice,
          recentSales: propertyPriceData.recentSales,
          minPrice: propertyPriceData.minPrice,
          maxPrice: propertyPriceData.maxPrice,
          minOffer: offerPrice - 10000, // Range for negotiation
          maxOffer: offerPrice + 5000,  // Range for negotiation
          lastUpdated: propertyPriceData.lastUpdated,
          source: "UK Land Registry / HPI"
        },
        offerDetails: {
          offerPrice,
          discountAmount,
          discountPercentage
        }
      };

      console.log(`Valuation completed: £${propertyPriceData.averagePrice} market value, £${offerPrice} offer price`);
      res.json(valuation);

    } catch (err) {
      console.error('Valuation estimate error:', err);

      // Do not fall back to AI for a valuation
      // This would generate synthetic data rather than using real Land Registry data
      // Instead, return a specific error asking the user to try again
      return res.status(500).json({
        error: 'Unable to generate a property valuation at this time due to data access issues. Please try again later.',
        details: err instanceof Error ? err.message : String(err)
      });
    }
  });

  // Get all properties with filtering for estate agent website
  app.get('/api/properties', async (req: Request, res: Response) => {
    try {
      const { listingType, isRental, areaId, minPrice, maxPrice, minBedrooms, maxBedrooms, bedrooms, propertyType, postcode, status, features, houseType, floorLevel } = req.query;

      let properties;

      // Support both old listingType and new isRental query params for backwards compatibility
      if (isRental !== undefined) {
        properties = await storage.getPropertiesByRentalStatus(isRental === 'true');
      } else if (listingType && (listingType === 'sale' || listingType === 'rental')) {
        // Legacy support: listingType=sale means isRental=false, listingType=rental means isRental=true
        properties = await storage.getPropertiesByRentalStatus(listingType === 'rental');
      } else {
        properties = await storage.getAllProperties();
      }

      // Filter by status if provided (e.g., 'let' for managed properties)
      if (status && typeof status === 'string') {
        properties = properties.filter(p => p.status === status);
      }

      // Filter by minimum price
      if (minPrice && !isNaN(Number(minPrice))) {
        properties = properties.filter(p => p.price >= Number(minPrice));
      }

      // Filter by maximum price
      if (maxPrice && !isNaN(Number(maxPrice))) {
        properties = properties.filter(p => p.price <= Number(maxPrice));
      }

      // Filter by exact bedrooms
      if (bedrooms !== undefined && bedrooms !== '' && !isNaN(Number(bedrooms))) {
        properties = properties.filter(p => p.bedrooms === Number(bedrooms));
      }

      // Filter by minimum bedrooms
      if (minBedrooms !== undefined && minBedrooms !== '' && !isNaN(Number(minBedrooms))) {
        properties = properties.filter(p => p.bedrooms >= Number(minBedrooms));
      }

      // Filter by maximum bedrooms
      if (maxBedrooms !== undefined && maxBedrooms !== '' && !isNaN(Number(maxBedrooms))) {
        properties = properties.filter(p => p.bedrooms <= Number(maxBedrooms));
      }

      // Filter by property type (comma-separated list)
      if (propertyType && typeof propertyType === 'string') {
        const types = propertyType.split(',').map(t => t.trim().toLowerCase());
        properties = properties.filter(p => types.includes(p.propertyType.toLowerCase()));
      }

      // Filter by postcode (partial match)
      if (postcode && typeof postcode === 'string') {
        const postcodePrefix = postcode.toUpperCase().trim();
        properties = properties.filter(p => p.postcode.toUpperCase().startsWith(postcodePrefix));
      }

      // Helper function to normalize feature strings for matching
      const normalizeFeature = (f: string) => f.toLowerCase().replace(/[-_]/g, ' ').trim();

      // Filter by features (comma-separated list, must have all)
      if (features && typeof features === 'string') {
        const requiredFeatures = features.split(',').map(f => normalizeFeature(f));
        properties = properties.filter(p => {
          if (!p.features || !Array.isArray(p.features)) return false;
          const propFeatures = p.features.map((f: string) => normalizeFeature(f));
          // Also check description for feature keywords
          const descLower = (p.description || '').toLowerCase();
          return requiredFeatures.every(rf => {
            // Check features array
            const featureMatch = propFeatures.some((pf: string) => pf.includes(rf) || rf.includes(pf));
            // Check description for common variations
            const descMatch = descLower.includes(rf);
            return featureMatch || descMatch;
          });
        });
      }

      // Filter by house type (detached, semi-detached, terraced, etc.)
      if (houseType && typeof houseType === 'string') {
        const type = normalizeFeature(houseType);
        // Map house type to possible feature/description keywords
        const houseTypeKeywords: Record<string, string[]> = {
          'detached': ['detached'],
          'semi detached': ['semi detached', 'semi-detached', 'semidetached'],
          'terraced': ['terraced', 'terrace house', 'mid terrace', 'mid-terrace'],
          'end terrace': ['end terrace', 'end-terrace', 'end of terrace'],
          'town house': ['town house', 'townhouse', 'town-house']
        };
        const keywords = houseTypeKeywords[type] || [type];

        properties = properties.filter(p => {
          const propFeatures = (p.features || []).map((f: string) => normalizeFeature(f));
          const descLower = normalizeFeature(p.description || '');
          return keywords.some(kw =>
            propFeatures.some((pf: string) => pf.includes(kw)) || descLower.includes(kw)
          );
        });
      }

      // Filter by floor level (ground, first, second, upper, top)
      if (floorLevel && typeof floorLevel === 'string') {
        const level = normalizeFeature(floorLevel);
        // Map floor level to possible keywords
        const floorKeywords: Record<string, string[]> = {
          'ground': ['ground floor', 'ground-floor', 'ground level'],
          'first': ['first floor', 'first-floor', '1st floor'],
          'second': ['second floor', 'second-floor', '2nd floor'],
          'upper': ['upper floor', 'third floor', 'fourth floor', 'high floor', '3rd floor', '4th floor'],
          'top': ['top floor', 'top-floor', 'penthouse', 'uppermost']
        };
        const keywords = floorKeywords[level] || [level];

        properties = properties.filter(p => {
          const propFeatures = (p.features || []).map((f: string) => normalizeFeature(f));
          const descLower = normalizeFeature(p.description || '');
          return keywords.some(kw =>
            propFeatures.some((pf: string) => pf.includes(kw)) || descLower.includes(kw)
          );
        });
      }

      // Filter to only show properties that are:
      // 1. Listed in CRM (isListed = true) - only proper listings should appear
      // 2. Published on website (isPublishedWebsite = true) - explicitly marked for website
      properties = properties.filter(p => p.isListed === true && p.isPublishedWebsite === true);

      // Filter residential vs commercial for public pages
      // Sales and rentals pages should only show residential properties (isResidential !== false)
      // Commercial page should only show commercial properties (isResidential === false)
      if (listingType === 'sale' || listingType === 'rental') {
        // For sale/rental listings, only show residential properties (isResidential is true or undefined/null)
        properties = properties.filter(p => p.isResidential !== false);
      } else if (listingType === 'commercial') {
        // For commercial listings, only show commercial properties
        properties = properties.filter(p => p.isResidential === false);
      }

      // Add mock area name for display
      const propertiesWithAreaName = properties.map(property => ({
        ...property,
        areaName: property.areaId === 1 ? 'Notting Hill' :
          property.areaId === 2 ? 'Maida Vale' :
            property.areaId === 3 ? 'Paddington' : 'West London'
      }));

      res.json(propertiesWithAreaName);
    } catch (err) {
      console.error('Failed to retrieve properties:', err);
      res.status(500).json({ error: 'Failed to retrieve properties' });
    }
  });

  // Get property by ID for estate agent website
  app.get('/api/properties/:id', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    try {
      const property = await storage.getProperty(id);

      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }

      // Only show property if it's published on website (for public website)
      if (!property.isPublishedWebsite) {
        return res.status(404).json({ error: 'Property not found' });
      }

      // Add mock area name for display
      const propertyWithAreaName = {
        ...property,
        areaName: property.areaId === 1 ? 'Notting Hill' :
          property.areaId === 2 ? 'Maida Vale' :
            property.areaId === 3 ? 'Paddington' : 'West London'
      };

      res.json(propertyWithAreaName);
    } catch (err) {
      console.error('Failed to retrieve property:', err);
      res.status(500).json({ error: 'Failed to retrieve property' });
    }
  });

  // Create property endpoint (admin only)
  app.post('/api/properties', isAuthenticated, async (req: Request, res: Response) => {
    const { data, error } = validateRequest(insertPropertySchema, req.body);

    if (error) {
      return res.status(400).json({ error });
    }

    try {
      // Geocode the property if postcode is provided and no coordinates
      if (data.postcode && (!data.latitude || !data.longitude)) {
        const coordinates = await geocodePostcode(data.postcode);
        if (coordinates) {
          data.latitude = coordinates.lat;
          data.longitude = coordinates.lng;
        }
      }

      const property = await storage.createProperty(data);
      res.status(201).json(property);
    } catch (err) {
      console.error('Failed to create property:', err);
      res.status(500).json({ error: 'Failed to create property' });
    }
  });

  // Admin endpoint to backfill geocoding for existing properties
  app.post('/api/admin/geocode-backfill', isAuthenticated, async (req: Request, res: Response) => {
    try {
      // Only allow admin access ideally, but for now authenticated user is fine based on current auth
      const properties = await storage.getAllProperties();
      let updatedCount = 0;
      let failedCount = 0;

      for (const property of properties) {
        // Skip if already has coordinates
        if (property.latitude && property.longitude) continue;

        // Add a small delay to avoid hitting rate limits
        await new Promise(resolve => setTimeout(resolve, 200));

        const coordinates = await geocodePostcode(property.postcode);

        if (coordinates) {
          await storage.updateProperty(property.id, {
            latitude: coordinates.lat,
            longitude: coordinates.lng
          });
          updatedCount++;
        } else {
          failedCount++;
        }
      }

      res.json({
        message: 'Geocoding backfill completed',
        totalProcessed: properties.length,
        updated: updatedCount,
        failed: failedCount
      });
    } catch (err) {
      console.error('Failed to run geocoding backfill:', err);
      res.status(500).json({ error: 'Failed to run geocoding backfill' });
    }
  });

  // Natural language property search endpoint
  // Parse natural language query and return search criteria
  app.post('/api/search/natural-language', async (req: Request, res: Response) => {
    try {
      const { query, listingType } = req.body;

      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      // Parse natural language query using OpenAI
      const searchCriteria = await parseNaturalLanguageQuery(query, listingType);
      res.json(searchCriteria);
    } catch (error) {
      console.error('Natural language search parsing error:', error);
      res.status(500).json({ error: 'Failed to process search query' });
    }
  });

  app.post('/api/properties/natural-search', async (req: Request, res: Response) => {
    try {
      const { query, listingType } = req.body;

      if (!query || !query.trim()) {
        return res.status(400).json({ error: 'Search query is required' });
      }

      // Parse natural language query using OpenAI
      const searchCriteria = await parseNaturalLanguageQuery(query, listingType);

      // Get all properties based on listing type first
      let properties = listingType === 'rental'
        ? await storage.getPropertiesByRentalStatus(true)
        : await storage.getPropertiesByRentalStatus(false);

      // Apply filters based on parsed criteria
      if (searchCriteria.propertyType) {
        properties = properties.filter(p =>
          p.propertyType.toLowerCase() === searchCriteria.propertyType.toLowerCase()
        );
      }

      if (searchCriteria.bedrooms) {
        const bedroomCount = parseInt(searchCriteria.bedrooms);
        if (!isNaN(bedroomCount)) {
          properties = properties.filter(p => p.bedrooms === bedroomCount);
        }
      }

      if (searchCriteria.minPrice) {
        const minPriceStr = typeof searchCriteria.minPrice === 'string'
          ? searchCriteria.minPrice
          : searchCriteria.minPrice.toString();
        const minPrice = parseInt(minPriceStr.replace(/[£,]/g, ''));
        if (!isNaN(minPrice)) {
          properties = properties.filter(p => p.price >= minPrice);
        }
      }

      if (searchCriteria.maxPrice) {
        const maxPriceStr = typeof searchCriteria.maxPrice === 'string'
          ? searchCriteria.maxPrice
          : searchCriteria.maxPrice.toString();
        const maxPrice = parseInt(maxPriceStr.replace(/[£,]/g, ''));
        if (!isNaN(maxPrice)) {
          properties = properties.filter(p => p.price <= maxPrice);
        }
      }

      if (searchCriteria.location) {
        properties = properties.filter(p =>
          p.postcode.toLowerCase().includes(searchCriteria.location.toLowerCase()) ||
          p.addressLine1.toLowerCase().includes(searchCriteria.location.toLowerCase())
        );
      }

      // Add mock area name for display
      const propertiesWithAreaName = properties.map(property => ({
        ...property,
        areaName: property.areaId === 1 ? 'Notting Hill' :
          property.areaId === 2 ? 'Maida Vale' :
            property.areaId === 3 ? 'Paddington' : 'West London'
      }));

      res.json(propertiesWithAreaName);
    } catch (error) {
      console.error('Natural language search error:', error);
      res.status(500).json({ error: 'Failed to process search query' });
    }
  });

  // Search properties by postcode
  app.get('/api/properties/search/:postcode', async (req: Request, res: Response) => {
    const postcode = req.params.postcode;

    try {
      const properties = await storage.getPropertiesByPostcode(postcode);
      res.json(properties);
    } catch (err) {
      res.status(500).json({ error: 'Failed to search properties' });
    }
  });

  // Get all contacts (website leads)
  app.get('/api/contacts', async (req: Request, res: Response) => {
    try {
      const contactsList = await storage.getAllContacts();
      res.json(contactsList);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve contacts' });
    }
  });

  // Update contact status
  app.patch('/api/contacts/:id/status', async (req: Request, res: Response) => {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid contact ID' });
    }

    if (!status || typeof status !== 'string') {
      return res.status(400).json({ error: 'Status is required' });
    }

    try {
      const contact = await storage.updateContactStatus(id, status);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }
      res.json(contact);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update contact status' });
    }
  });

  // Create contact endpoint
  app.post('/api/contacts', async (req: Request, res: Response) => {
    const { data, error } = validateRequest(insertContactSchema, req.body);

    if (error) {
      return res.status(400).json({ error });
    }

    try {
      const contact = await storage.createContact(data);
      res.status(201).json(contact);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create contact' });
    }
  });

  // Create valuation endpoint
  app.post('/api/valuations', async (req: Request, res: Response) => {
    const { data, error } = validateRequest(insertValuationSchema, req.body);

    if (error) {
      return res.status(400).json({ error });
    }

    try {
      const valuation = await storage.createValuation(data);
      res.status(201).json(valuation);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create valuation' });
    }
  });

  // Get valuations by property ID
  app.get('/api/valuations/property/:propertyId', async (req: Request, res: Response) => {
    const propertyId = parseInt(req.params.propertyId);

    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    try {
      const valuations = await storage.getValuationsByProperty(propertyId);
      res.json(valuations);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve valuations' });
    }
  });

  // Create ownership endpoint
  app.post('/api/ownerships', async (req: Request, res: Response) => {
    const { data, error } = validateRequest(insertOwnershipSchema, req.body);

    if (error) {
      return res.status(400).json({ error });
    }

    try {
      const ownership = await storage.createOwnership(data);
      res.status(201).json(ownership);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create ownership record' });
    }
  });

  // Get ownership by property ID
  app.get('/api/ownerships/property/:propertyId', async (req: Request, res: Response) => {
    const propertyId = parseInt(req.params.propertyId);

    if (isNaN(propertyId)) {
      return res.status(400).json({ error: 'Invalid property ID' });
    }

    try {
      const ownership = await storage.getOwnershipByProperty(propertyId);

      if (!ownership) {
        return res.status(404).json({ error: 'Ownership record not found' });
      }

      res.json(ownership);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve ownership record' });
    }
  });

  // Create chat message endpoint (placeholder)
  app.post('/api/chat/messages', async (req: Request, res: Response) => {
    try {
      // Return success without storing - chat is handled in /api/chat endpoint
      res.status(201).json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to create chat message' });
    }
  });

  // Get chat messages by user ID (placeholder)
  app.get('/api/chat/messages/:userId', async (req: Request, res: Response) => {
    const userId = req.params.userId;

    try {
      // Return empty array since chat messages are not stored anymore
      res.json([]);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve chat messages' });
    }
  });



  // New simplified HPI valuation endpoint
  app.post('/api/contact-form', async (req: Request, res: Response) => {
    try {
      console.log('Contact form submission received:', req.body);

      // Validate the request body
      const { addressLine1, postcode, propertyType, bedrooms, email, phone, name } = req.body;

      if (!addressLine1 || !postcode || !propertyType || !bedrooms || !email || !phone) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      // Create property record
      const property = await storage.createProperty({
        title: `Property at ${addressLine1.trim()}`,
        description: `${propertyType} property with ${parseInt(bedrooms) || 3} bedrooms`,
        postcode: postcode.trim().toUpperCase(),
        isRental: false,
        price: 0,
        addressLine1: addressLine1.trim(),
        propertyType,
        bedrooms: parseInt(bedrooms) || 3,
        bathrooms: 1,
        areaId: 1,
        tenure: 'freehold',
        epcRating: 'C',
        councilTaxBand: 'D',
        features: [],
        images: [],
        userId: null
      });

      // Create contact record
      const contact = await storage.createContact({
        fullName: name || 'Property Inquiry',
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        inquiryType: 'valuation',
        timeframe: 'asap',
        message: `Property inquiry for ${addressLine1}, ${postcode}`,
        userId: null
      });

      // Send WhatsApp notification to customer
      const whatsappSent = await sendPropertyOfferWhatsApp({
        address: `${property.addressLine1}, ${property.postcode}`,
        marketValue: 0, // Will be calculated later
        offerPrice: 0, // Will be calculated later
        discountAmount: 0,
        discountPercentage: 0,
        phoneNumber: contact.phone,
        customerName: contact.fullName
      });

      console.log(`Contact saved - ID: ${contact.id}, WhatsApp sent: ${whatsappSent}`);

      res.json({
        success: true,
        message: 'Contact details saved and WhatsApp notification sent',
        contactId: contact.id,
        propertyId: property.id,
        whatsappSent
      });

    } catch (error) {
      console.error('Error processing contact form:', error);
      res.status(500).json({
        error: 'Failed to process contact form',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.post('/api/hpi-valuation', async (req: Request, res: Response) => {
    try {
      const {
        addressLine1,
        postcode,
        propertyType,
        bedrooms,
        email,
        phone,
        name = 'Potential Customer' // Default name if not provided
      } = req.body;

      // Validate required fields
      if (!addressLine1 || !postcode || !propertyType || !bedrooms || !email || !phone) {
        return res.status(400).json({
          error: 'Missing required fields (addressLine1, postcode, propertyType, bedrooms, email, phone)'
        });
      }

      console.log(`Processing valuation for: ${postcode}, ${propertyType}, ${bedrooms} beds`);

      // Get UK HPI data
      const hpiData = await getLandRegistryPriceData(postcode, propertyType, bedrooms);

      if (!hpiData || !hpiData.averagePrice) {
        return res.status(400).json({
          error: 'Unable to retrieve property data for the provided details'
        });
      }

      // Calculate the market value and cash offer amount
      const marketValue = hpiData.averagePrice;
      const offerDetails = calculateOfferPrice(marketValue);

      console.log(`Valuation generated: Market value £${marketValue}, Offer £${offerDetails.offerPrice}`);

      // Save contact to database
      const contact = await storage.createContact({
        fullName: name,
        email,
        phone,
        inquiryType: 'valuation',
        timeframe: 'ASAP'
      });

      // Save property to database with addressLine1
      const property = await storage.createProperty({
        title: `Property at ${addressLine1}`,
        description: `${propertyType} property with ${parseInt(bedrooms)} bedrooms`,
        addressLine1,
        postcode,
        isRental: false,
        price: marketValue || 0,
        propertyType,
        bedrooms: parseInt(bedrooms),
        bathrooms: 1,
        areaId: 1,
        tenure: 'freehold',
        epcRating: 'C',
        councilTaxBand: 'D',
        features: [],
        images: []
      });

      // Save valuation to database
      await storage.createValuation({
        postcode: property.postcode,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        propertyAddress: property.addressLine1,
        contactId: contact.id,
        estimatedValue: marketValue,
        offerValue: offerDetails.offerPrice
      });

      // Format address for notifications (use full address now)
      const address = `${addressLine1}, ${postcode}`;

      // Send WhatsApp notification with the valuation result
      const whatsappSuccess = await sendPropertyOfferWhatsApp({
        address,
        marketValue,
        offerPrice: offerDetails.offerPrice,
        discountAmount: offerDetails.discountAmount,
        discountPercentage: offerDetails.discountPercentage,
        phoneNumber: phone,
        customerName: name
      });

      // Send SMS notification as backup
      const smsSuccess = await sendPropertyOfferSMS({
        address,
        marketValue,
        offerPrice: offerDetails.offerPrice,
        discountAmount: offerDetails.discountAmount,
        discountPercentage: offerDetails.discountPercentage,
        phoneNumber: phone,
        customerName: name
      });

      // Return success response with notification statuses
      return res.status(200).json({
        success: true,
        priceInfo: hpiData,
        offerDetails,
        notifications: {
          whatsapp: whatsappSuccess,
          sms: smsSuccess
        }
      });

    } catch (error) {
      console.error('Error processing valuation request:', error);
      return res.status(500).json({
        error: 'An error occurred while processing your valuation request'
      });
    }
  });

  // Submit property valuation form
  app.post('/api/valuation-request', async (req: Request, res: Response) => {
    try {
      const {
        propertyId, contactId, address, marketValue, offerPrice,
        discountAmount, discountPercentage, phoneNumber, email, customerName
      } = req.body;

      let property, contact;

      // If propertyId and contactId are provided, use them directly
      if (propertyId && contactId) {
        property = await storage.getProperty(propertyId);
        contact = await storage.getContact(contactId);

        if (!property || !contact) {
          return res.status(404).json({ error: 'Property or contact not found' });
        }
      }

      // Save the valuation data first (to ensure it doesn't get lost if notifications fail)
      try {
        // Store property details in database regardless of notification success
        console.log('Storing property valuation data in database...');

        // Ensure we have a valid address to avoid DB not-null constraint issues
        const addressToStore = address || 'Unknown address';

        // Extract details from address if available
        let extractedPostcode = '';
        let extractedTown = '';

        // Very simple regex to try to extract a UK postcode from an address string
        if (addressToStore) {
          const postcodeRegex = /([A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2})/i;
          const postcodeMatch = addressToStore.match(postcodeRegex);
          if (postcodeMatch && postcodeMatch[1]) {
            extractedPostcode = postcodeMatch[1];
          }

          // Try to extract town name (crude approach, just for database constraint satisfaction)
          const parts = addressToStore.split(',');
          if (parts.length > 1) {
            extractedTown = parts[parts.length - 2]?.trim() || 'Unknown';
          }
        }

        // Create property if it doesn't exist
        if (!property) {
          property = await storage.createProperty({
            title: `Property at ${addressToStore}`,
            description: 'Property valuation request',
            addressLine1: addressToStore,
            postcode: extractedPostcode || 'Unknown',
            isRental: false,
            price: marketValue || 0,
            propertyType: 'house',
            bedrooms: 0,
            bathrooms: 1,
            areaId: 1,
            tenure: 'freehold',
            epcRating: 'C',
            councilTaxBand: 'D',
            features: [],
            images: []
          });
        }

        // Create contact if it doesn't exist
        if (!contact && (email || phoneNumber)) {
          contact = await storage.createContact({
            fullName: customerName || 'Anonymous',
            email: email || '',
            phone: phoneNumber || '',
            inquiryType: 'valuation',
            timeframe: '1-3 months',
            message: `Auto-generated from valuation request for ${addressToStore}`
          });
        }

        // Get user ID if authenticated
        const userId = req.isAuthenticated() ? req.user?.id : undefined;

        // Create valuation record with user ID if authenticated
        if (property && contact) {
          const valuation = await storage.createValuation({
            postcode: property.postcode,
            propertyType: property.propertyType,
            bedrooms: property.bedrooms,
            propertyAddress: property.addressLine1,
            contactId: contact.id,
            estimatedValue: marketValue || 0,
            offerValue: offerPrice || 0,
            status: 'pending'
          });
          console.log('✅ Valuation data stored successfully with IDs:', {
            propertyId: property.id,
            contactId: contact.id,
            userId: userId || 'not authenticated'
          });
        } else {
          console.warn('⚠️ Skipped creating valuation record due to missing property or contact');
        }
      } catch (storageErr) {
        console.error('Failed to store valuation data:', storageErr);
        // Continue to notifications even if storage fails
      }

      // Process notifications in parallel for better performance
      console.log('Processing notifications...');

      // Initialize notification promises
      const notificationPromises: Promise<void>[] = [];
      let smsSent = false;
      let emailSent = false;
      let notificationErrors: string[] = [];

      // Add SMS promise if phone number is provided
      if (phoneNumber) {
        notificationPromises.push(
          (async () => {
            try {
              console.log(`Sending SMS notification to ${phoneNumber}...`);
              smsSent = await sendPropertyOfferSMS({
                address,
                marketValue,
                offerPrice,
                discountAmount,
                discountPercentage,
                phoneNumber,
                customerName
              });

              if (smsSent) {
                console.log('✅ SMS notification sent successfully');
              } else {
                console.error('⚠️ SMS notification failed');
                notificationErrors.push('SMS delivery failed');
              }
            } catch (smsErr: any) {
              console.error('Error sending SMS:', smsErr);
              notificationErrors.push(`SMS error: ${smsErr?.message || 'Unknown error'}`);
            }
          })()
        );
      }

      // Add WhatsApp promise if phone number is provided
      if (phoneNumber) {
        notificationPromises.push(
          (async () => {
            try {
              console.log(`Sending WhatsApp notification to ${phoneNumber}...`);
              const whatsappSent = await sendPropertyOfferWhatsApp({
                address,
                marketValue,
                offerPrice,
                discountAmount,
                discountPercentage,
                phoneNumber,
                customerName
              });

              if (whatsappSent) {
                console.log('✅ WhatsApp notification sent successfully');
              } else {
                console.error('⚠️ WhatsApp notification failed');
                notificationErrors.push('WhatsApp delivery failed');
              }
            } catch (whatsappErr: any) {
              console.error('Error sending WhatsApp:', whatsappErr);
              notificationErrors.push(`WhatsApp error: ${whatsappErr?.message || 'Unknown error'}`);
            }
          })()
        );
      }

      // Wait for all notification attempts to complete
      await Promise.all(notificationPromises);

      // Return status with detailed information
      res.status(200).json({
        success: true,
        data: {
          propertyId: property?.id,
          contactId: contact?.id,
          address,
          marketValue,
          offerPrice
        },
        notifications: {
          smsSent,
          whatsappSent: true, // Will be set by WhatsApp promise
          errors: notificationErrors.length > 0 ? notificationErrors : undefined,
          message: !smsSent
            ? "We've received your valuation request but were unable to send SMS notifications. You should receive a WhatsApp message shortly."
            : "Your valuation request has been received. Please check your messages for details."
        }
      });

    } catch (err) {
      console.error('Valuation error:', err);
      res.status(500).json({
        error: 'Failed to process valuation request',
        message: "We apologize, but we couldn't process your valuation request at this time. Please try again later or contact us directly."
      });
    }
  });

  // AI Intent Parsing Endpoint - Clean separation of concerns
  app.post('/api/ai/parse', async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      let parsedIntent: ParsedIntent;

      // Try OpenAI parsing first
      if (process.env.OPENAI_API_KEY) {
        try {
          parsedIntent = await parseWithOpenAI(message);
        } catch (error) {
          console.warn('OpenAI parsing failed, using basic patterns:', error);
          parsedIntent = parseBasicQuery(message);
        }
      } else {
        parsedIntent = parseBasicQuery(message);
      }

      res.json(parsedIntent);

    } catch (err) {
      console.error('Parse error:', err);
      res.status(500).json({ error: 'Failed to parse message' });
    }
  });

  // Helper function to search area context for location-specific questions
  async function searchAreaContext(message: string): Promise<string | null> {
    const lowercaseMsg = message.toLowerCase();

    // Area knowledge base from AI search prompt
    const areaData = {
      'bayswater': {
        borough: 'Westminster',
        councilTax: '£1,017 Band D',
        character: 'Bordering Hyde Park, elegant stucco terraces, international food scene on Queensway',
        transport: 'Central/Circle/District at Queensway & Bayswater, Elizabeth/Bakerloo at Paddington',
        property: 'Period conversions 1-3 beds, mansion blocks, occasional mews houses',
        lifestyle: 'Hyde Park, Westbourne Grove boutiques, Whiteleys redevelopment'
      },
      'maida vale': {
        borough: 'Westminster',
        councilTax: '£1,017 Band D',
        character: 'Red-brick mansion blocks, wide tree-lined avenues, Little Venice canal charm',
        transport: 'Bakerloo at Maida Vale/Warwick Avenue, nearby Paddington Elizabeth Line',
        property: 'Mansion-block apartments 1-3 beds, townhouses and mews, canal premiums',
        lifestyle: 'Regent\'s Canal & Little Venice, Paddington Recreation Ground, Clifton Road cafés'
      },
      'queen\'s park': {
        borough: 'Split Westminster/Brent',
        councilTax: 'Westminster £1,017 / Brent £2,133 (address dependent)',
        character: 'Village atmosphere around park and Salusbury Road, family-friendly',
        transport: 'Bakerloo/Overground at Queen\'s Park, nearby Thameslink at West Hampstead',
        property: 'Victorian terraces, conversions, premiums near park, apartments as entry points',
        lifestyle: 'Queen\'s Park, Salusbury Road farmers\' markets, independent cafés'
      },
      'ladbroke grove': {
        borough: 'Kensington & Chelsea',
        councilTax: '£1,569 Band D',
        character: 'Bohemian Notting Hill character, classic stucco crescents, creative area',
        transport: 'Circle & H&C at Ladbroke Grove and Latimer Road',
        property: 'Strong demand for period flats and mews, family houses on garden squares',
        lifestyle: 'Portobello & Golborne markets, Holland Park nearby'
      },
      'harlesden': {
        borough: 'Brent',
        councilTax: '£2,133 Band D',
        character: 'Lively diverse area with Caribbean heritage, improving town centre',
        transport: 'Bakerloo/Overground at Harlesden, Willesden Junction connects to Elizabeth',
        property: 'Good-value Victorian terraces, conversions, investor interest for yields',
        lifestyle: 'Roundwood Park, Grand Union Canal, local markets'
      }
    };

    // Check for council tax questions
    if (lowercaseMsg.includes('council tax') || lowercaseMsg.includes('lowest council tax')) {
      const councilTaxInfo = Object.entries(areaData)
        .map(([area, data]) => `• ${area.charAt(0).toUpperCase() + area.slice(1)}: ${data.councilTax} (${data.borough})`)
        .join('\n');

      if (lowercaseMsg.includes('lowest')) {
        return `Based on our West London coverage areas, the lowest council tax is in Westminster Borough areas:\n\n• Bayswater: £1,017 Band D\n• Maida Vale: £1,017 Band D\n• Queen's Park (Westminster side): £1,017 Band D\n\nThese are significantly lower than Brent Borough areas (£2,133) and K&C areas (£1,569).`;
      } else {
        return `Here's the council tax information for our covered West London areas:\n\n${councilTaxInfo}\n\nWestminster Borough has the lowest rates at around £1,017 for Band D properties.`;
      }
    }

    // Check for specific area questions
    for (const [areaName, data] of Object.entries(areaData)) {
      if (lowercaseMsg.includes(areaName.replace('\'', ''))) {
        return `${areaName.charAt(0).toUpperCase() + areaName.slice(1)} Information:\n\n• Borough: ${data.borough}\n• Council Tax: ${data.councilTax}\n• Character: ${data.character}\n• Transport: ${data.transport}\n• Property Types: ${data.property}\n• Lifestyle: ${data.lifestyle}`;
      }
    }

    return null;
  }

  // Helper function to generate intelligent responses using OpenAI
  async function generateIntelligentResponse(message: string): Promise<string | null> {
    try {
      const { openaiClient, isOpenAIConfigured } = await import('./lib/openaiClient');

      if (!isOpenAIConfigured() || !openaiClient) {
        return null;
      }

      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant for John Barclay Estate & Management, a West London property company. Provide conversational, helpful responses about property, areas, and estate agent services. Keep responses concise and friendly."
          },
          { role: "user", content: message }
        ],
        max_tokens: 200
      });

      return response.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API error:', error);
      return null;
    }
  }

  // AI Conversation Endpoint - Pure chat responses only
  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const { message } = req.body;

      if (!message) {
        return res.status(400).json({ error: 'Message is required' });
      }

      // Step 1: Search area data first for location-specific questions
      let areaContextResponse = await searchAreaContext(message);

      if (areaContextResponse) {
        return res.json({
          message: areaContextResponse,
          id: randomUUID()
        });
      }

      // Step 2: Use OpenAI for intelligent conversational responses
      let aiResponse = await generateIntelligentResponse(message);

      if (!aiResponse) {
        // Step 3: Fallback to basic responses
        aiResponse = "Thanks for your message. How can I help you today?";

        const lowercaseMsg = message.toLowerCase();
        if (lowercaseMsg.includes('hello') || lowercaseMsg.includes('hi') || lowercaseMsg.includes('hey')) {
          aiResponse = "Hello! I'm here to help you with property questions and information about West London areas. You can ask me about council tax, transport links, local amenities, or search for specific properties. What would you like to know?";
        } else if (lowercaseMsg.includes('valuation') || lowercaseMsg.includes('worth') || lowercaseMsg.includes('value')) {
          aiResponse = "For property valuations, I can help you search our current listings to see market prices. If you need a valuation of your own property, please use our valuation form on the main page.";
        } else if (lowercaseMsg.includes('thank')) {
          aiResponse = "You're welcome! Feel free to ask me about any areas or properties you're interested in.";
        } else if (lowercaseMsg.includes('help')) {
          aiResponse = "I can help you with information about West London areas like Bayswater, Maida Vale, Queen's Park, and more. Ask me about council tax, transport, local amenities, or search for specific properties!";
        }
      }

      res.json({
        message: aiResponse,
        id: randomUUID()
      });

    } catch (err) {
      console.error('Chat error:', err);
      res.status(500).json({ error: 'Failed to process chat message' });
    }
  });


  // Test SMS configuration endpoint (admin use only)
  app.post('/api/test-sms', async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      console.log(`Testing SMS configuration by sending to: ${phoneNumber}`);

      // Create a test property offer
      const testOffer: PropertyOfferDetails = {
        address: "Test Property, 123 Test Street, Testville, UK",
        marketValue: 250000,
        offerPrice: 225000,
        discountAmount: 25000,
        discountPercentage: 10,
        phoneNumber: phoneNumber,
        customerName: "Test User"
      };

      // Try to send a very short direct test message instead of the full template
      // This is to isolate any potential content filter issues
      let debugInfo = {};
      let smsSent = false;

      try {
        if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
          throw new Error("Twilio credentials not properly configured");
        }

        // Format the phone number
        let toNumber = phoneNumber;
        if (toNumber.startsWith('0')) {
          toNumber = '+44' + toNumber.substring(1);
        } else if (!toNumber.startsWith('+')) {
          toNumber = '+44' + toNumber;
        }

        // Create a Twilio client directly
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        // Send a very simple test message first
        console.log(`Trying direct test SMS to: ${toNumber}`);
        const directResult = await client.messages.create({
          body: "Test SMS from CashPropertyBuyers.uk - This is a direct test message",
          from: process.env.TWILIO_PHONE_NUMBER,
          to: toNumber
        });

        console.log(`Direct SMS result: ${directResult.sid} (${directResult.status})`);
        debugInfo = {
          directMessageSid: directResult.sid,
          directMessageStatus: directResult.status,
          formatted_number: toNumber
        };

        // If that worked, try the full template
        const fullResult = await sendPropertyOfferSMS(testOffer);
        smsSent = fullResult;
      } catch (directErr) {
        console.error('Direct SMS test error:', directErr);
        const err = directErr as any; // Type assertion for error handling
        debugInfo = {
          ...debugInfo,
          direct_error: err instanceof Error ? err.message : 'Unknown error',
          error_code: err.code || 'N/A',
          error_status: err.status || 'N/A'
        };
      }

      // Try the regular template as a fallback
      if (!smsSent) {
        smsSent = await sendPropertyOfferSMS(testOffer);
      }

      if (smsSent) {
        return res.json({
          success: true,
          message: `Test SMS sent successfully to ${phoneNumber}. If you don't receive it within a few minutes, please check if your number is verified with Twilio (required for trial accounts).`,
          twilioConfig: {
            accountSid: process.env.TWILIO_ACCOUNT_SID ? '********' + process.env.TWILIO_ACCOUNT_SID.substring(process.env.TWILIO_ACCOUNT_SID.length - 4) : 'not set',
            fromNumber: process.env.TWILIO_PHONE_NUMBER || 'not set',
            debug: debugInfo
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to send test SMS. Check server logs for details.',
          debug: debugInfo,
          twilioConfig: {
            accountSid: process.env.TWILIO_ACCOUNT_SID ? '********' + process.env.TWILIO_ACCOUNT_SID.substring(process.env.TWILIO_ACCOUNT_SID.length - 4) : 'not set',
            fromNumber: process.env.TWILIO_PHONE_NUMBER || 'not set',
          }
        });
      }
    } catch (err) {
      console.error('Test SMS error:', err);
      res.status(500).json({
        error: 'Error while testing SMS configuration',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // Test WhatsApp configuration endpoint (admin use only)
  app.post('/api/test-whatsapp', async (req: Request, res: Response) => {
    try {
      const { phoneNumber } = req.body;

      if (!phoneNumber) {
        return res.status(400).json({ error: 'Phone number is required' });
      }

      console.log(`Testing WhatsApp configuration by sending to: ${phoneNumber}`);

      // Create a test property offer
      const testOffer: PropertyOfferWhatsAppDetails = {
        address: "Test Property, 123 Test Street, Testville, UK",
        marketValue: 250000,
        offerPrice: 225000,
        discountAmount: 25000,
        discountPercentage: 10,
        phoneNumber: phoneNumber,
        customerName: "Test User"
      };

      const whatsappSent = await sendPropertyOfferWhatsApp(testOffer);

      if (whatsappSent) {
        return res.json({
          success: true,
          message: `Test WhatsApp message sent successfully to ${phoneNumber}.`,
          twilioConfig: {
            accountSid: process.env.TWILIO_ACCOUNT_SID ? '********' + process.env.TWILIO_ACCOUNT_SID.substring(process.env.TWILIO_ACCOUNT_SID.length - 4) : 'not set',
            fromNumber: process.env.TWILIO_PHONE_NUMBER || 'not set'
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to send test WhatsApp message. Check server logs for details.',
          twilioConfig: {
            accountSid: process.env.TWILIO_ACCOUNT_SID ? '********' + process.env.TWILIO_ACCOUNT_SID.substring(process.env.TWILIO_ACCOUNT_SID.length - 4) : 'not set',
            fromNumber: process.env.TWILIO_PHONE_NUMBER || 'not set'
          }
        });
      }
    } catch (err) {
      console.error('Test WhatsApp error:', err);
      res.status(500).json({
        error: 'Error while testing WhatsApp configuration',
        message: err instanceof Error ? err.message : 'Unknown error'
      });
    }
  });

  // Send property details via WhatsApp
  app.post('/api/send-property-whatsapp', async (req: Request, res: Response) => {
    try {
      const { propertyId, phoneNumber, customerName } = req.body;

      if (!propertyId || !phoneNumber) {
        return res.status(400).json({ error: 'Property ID and phone number are required' });
      }

      // Get property details from database
      const property = await storage.getProperty(parseInt(propertyId));

      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }

      // Prepare WhatsApp message data
      const whatsappData: PropertyDetailsWhatsAppMessage = {
        propertyId: property.id,
        title: property.title,
        price: property.price,
        propertyType: property.propertyType,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        address: `${property.addressLine1}, ${property.postcode}`,
        description: property.description,
        features: property.features || [],
        phoneNumber,
        customerName
      };

      const success = await sendPropertyDetailsWhatsApp(whatsappData);

      if (success) {
        res.json({
          success: true,
          message: 'Property details sent via WhatsApp successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to send property details via WhatsApp'
        });
      }
    } catch (error) {
      console.error('Error sending property details via WhatsApp:', error);
      res.status(500).json({
        error: 'Failed to send property details via WhatsApp',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Set up property alert via WhatsApp
  app.post('/api/property-alert-whatsapp', async (req: Request, res: Response) => {
    try {
      const { phoneNumber, customerName, criteria } = req.body;

      if (!phoneNumber || !criteria) {
        return res.status(400).json({ error: 'Phone number and search criteria are required' });
      }

      // Prepare WhatsApp alert data
      const alertData: PropertyAlertWhatsAppMessage = {
        phoneNumber,
        customerName,
        criteria: {
          minPrice: criteria.minPrice,
          maxPrice: criteria.maxPrice,
          propertyType: criteria.propertyType,
          bedrooms: criteria.bedrooms,
          area: criteria.area
        }
      };

      const success = await sendPropertyAlertWhatsApp(alertData);

      if (success) {
        // TODO: Save alert preferences to database for future matching
        res.json({
          success: true,
          message: 'Property alert set up successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to set up property alert'
        });
      }
    } catch (error) {
      console.error('Error setting up property alert:', error);
      res.status(500).json({
        error: 'Failed to set up property alert',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Add/remove property from favourites
  app.post('/api/favourites/:propertyId', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const propertyId = parseInt(req.params.propertyId);
      const userId = req.user?.id;
      const { action } = req.body; // 'add' or 'remove'

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      if (isNaN(propertyId)) {
        return res.status(400).json({ error: 'Invalid property ID' });
      }

      // Check if property exists
      const property = await storage.getProperty(propertyId);
      if (!property) {
        return res.status(404).json({ error: 'Property not found' });
      }

      // TODO: Implement favourites functionality in storage
      // For now, return a placeholder response
      res.json({
        success: true,
        message: action === 'add' ? 'Property added to favourites' : 'Property removed from favourites',
        propertyId,
        userId,
        action
      });
    } catch (error) {
      console.error('Error managing favourites:', error);
      res.status(500).json({
        error: 'Failed to manage favourites',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get user's favourite properties
  app.get('/api/favourites', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'User not authenticated' });
      }

      // TODO: Implement favourites retrieval from storage
      // For now, return empty array
      res.json([]);
    } catch (error) {
      console.error('Error retrieving favourites:', error);
      res.status(500).json({
        error: 'Failed to retrieve favourites',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // ==========================================
  // PUBLIC CMS ENDPOINTS (No Auth Required)
  // ==========================================

  // Get published page content by slug
  app.get('/api/public/pages/:slug', async (req: Request, res: Response) => {
    try {
      const { slug } = req.params;
      const [page] = await db.select()
        .from(cmsPages)
        .where(and(eq(cmsPages.slug, slug), eq(cmsPages.isPublished, true)));

      if (!page) {
        return res.status(404).json({ error: 'Page not found' });
      }

      const blocks = await db.select()
        .from(cmsContentBlocks)
        .where(and(eq(cmsContentBlocks.pageId, page.id), eq(cmsContentBlocks.isActive, true)))
        .orderBy(cmsContentBlocks.displayOrder);

      res.json({ ...page, blocks });
    } catch (error) {
      console.error('Error fetching public page:', error);
      res.status(500).json({ error: 'Failed to fetch page' });
    }
  });

  // Get team members for public team page
  app.get('/api/public/team', async (_req: Request, res: Response) => {
    try {
      const team = await db
        .select({
          id: users.id,
          name: staffProfiles.publicDisplayName,
          fullName: users.fullName,
          jobTitle: staffProfiles.publicJobTitle,
          internalJobTitle: staffProfiles.jobTitle,
          bio: staffProfiles.publicBio,
          photo: staffProfiles.publicPhoto,
          department: staffProfiles.department,
          displayOrder: staffProfiles.publicDisplayOrder
        })
        .from(staffProfiles)
        .innerJoin(users, eq(staffProfiles.userId, users.id))
        .where(
          and(
            eq(staffProfiles.showOnTeamPage, true),
            eq(users.isActive, true)
          )
        )
        .orderBy(staffProfiles.publicDisplayOrder);

      // Transform to use publicDisplayName if set, otherwise fullName
      const formattedTeam = team.map(member => ({
        id: member.id,
        name: member.name || member.fullName,
        jobTitle: member.jobTitle || member.internalJobTitle,
        bio: member.bio || '',
        photo: member.photo || '',
        department: member.department,
        displayOrder: member.displayOrder
      }));

      res.json(formattedTeam);
    } catch (error) {
      console.error('Error fetching public team:', error);
      res.status(500).json({ error: 'Failed to fetch team' });
    }
  });

  // Get testimonials from CMS
  app.get('/api/public/testimonials', async (_req: Request, res: Response) => {
    try {
      // Get testimonials page
      const [page] = await db.select()
        .from(cmsPages)
        .where(and(eq(cmsPages.slug, 'testimonials'), eq(cmsPages.isPublished, true)));

      if (!page) {
        return res.json([]); // Return empty array if no testimonials page
      }

      // Get testimonial blocks
      const blocks = await db.select()
        .from(cmsContentBlocks)
        .where(
          and(
            eq(cmsContentBlocks.pageId, page.id),
            eq(cmsContentBlocks.blockType, 'testimonial'),
            eq(cmsContentBlocks.isActive, true)
          )
        )
        .orderBy(cmsContentBlocks.displayOrder);

      // Transform blocks to testimonial format
      const testimonials = blocks.map((block, index) => {
        const content = block.content as any;
        return {
          id: block.id,
          content: content.content || '',
          author: content.author || '',
          location: content.location || '',
          rating: content.rating || 5,
          image: content.image || null
        };
      });

      res.json(testimonials);
    } catch (error) {
      console.error('Error fetching testimonials:', error);
      res.status(500).json({ error: 'Failed to fetch testimonials' });
    }
  });

  // Get FAQ items from CMS
  app.get('/api/public/faq', async (_req: Request, res: Response) => {
    try {
      // Get FAQ page
      const [page] = await db.select()
        .from(cmsPages)
        .where(and(eq(cmsPages.slug, 'faq'), eq(cmsPages.isPublished, true)));

      if (!page) {
        return res.json([]); // Return empty array if no FAQ page
      }

      // Get FAQ blocks
      const blocks = await db.select()
        .from(cmsContentBlocks)
        .where(
          and(
            eq(cmsContentBlocks.pageId, page.id),
            eq(cmsContentBlocks.blockType, 'faq_item'),
            eq(cmsContentBlocks.isActive, true)
          )
        )
        .orderBy(cmsContentBlocks.displayOrder);

      // Transform blocks to FAQ format
      const faqItems = blocks.map((block) => {
        const content = block.content as any;
        return {
          id: block.id,
          question: content.question || '',
          answer: content.answer || ''
        };
      });

      res.json(faqItems);
    } catch (error) {
      console.error('Error fetching FAQ:', error);
      res.status(500).json({ error: 'Failed to fetch FAQ' });
    }
  });

  return httpServer;
}
