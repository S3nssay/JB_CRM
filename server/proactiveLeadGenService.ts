/**
 * Proactive Lead Generation Service
 * Comprehensive system for actively finding and nurturing potential property leads
 * through multiple monitoring channels and intelligent outreach automation.
 */

import { chromium, Browser, Page } from 'playwright';
import { db } from './db';
import { eq, and, gte, lte, desc, lt, sql, or, isNull } from 'drizzle-orm';
import {
  proactiveLeads,
  leadMonitoringConfigs,
  leadContactHistory,
  seasonalCampaigns,
  landlordCompliance,
  propensityScores,
  socialMediaMentions,
  properties,
  customerEnquiries,
  InsertProactiveLead,
} from '@shared/schema';
import { openaiClient, isOpenAIConfigured } from './lib/openaiClient';

const openai = openaiClient;

// ==========================================
// INTERFACES
// ==========================================

interface LandRegistryTransaction {
  address: string;
  postcode: string;
  price: number;
  date: string;
  propertyType: string;
  newBuild: boolean;
  tenure: string;
}

interface PlanningApplication {
  reference: string;
  address: string;
  postcode: string;
  description: string;
  applicationType: string;
  status: string;
  decisionDate?: string;
  applicantName?: string;
}

interface PortalListing {
  id: string;
  portal: 'zoopla' | 'rightmove' | 'onthemarket';
  address: string;
  postcode: string;
  price: number;
  originalPrice?: number;
  listedDate: string;
  daysOnMarket: number;
  priceChanges: number;
  agentName: string;
  propertyType: string;
  bedrooms: number;
  status: 'active' | 'reduced' | 'sstc' | 'removed';
  url: string;
}

interface AuctionLot {
  lotNumber: string;
  auctionHouse: string;
  auctionDate: string;
  address: string;
  postcode: string;
  guidePrice: number;
  propertyType: string;
  tenure: string;
  result?: 'sold' | 'unsold' | 'withdrawn' | 'prior';
  soldPrice?: number;
  url: string;
}

interface SocialMention {
  platform: string;
  postId: string;
  content: string;
  authorName: string;
  authorHandle: string;
  postedAt: string;
  url: string;
}

// ==========================================
// MAIN SERVICE CLASS
// ==========================================

export class ProactiveLeadGenService {
  private browser: Browser | null = null;
  private isRunning: boolean = false;
  private monitorIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    console.log('[ProactiveLeadGen] Service initialized');
  }

  // ==========================================
  // BROWSER MANAGEMENT
  // ==========================================

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
      });
    }
    return this.browser;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // ==========================================
  // 1. LAND REGISTRY MONITORING
  // ==========================================

  /**
   * Monitor Land Registry for recent property transactions
   * - New purchases (potential landlord clients)
   * - Long-term owners (potential sellers)
   * - Probate transfers (motivated sellers)
   */
  async monitorLandRegistry(postcodes: string[]): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Monitoring Land Registry for:', postcodes);
    const leads: InsertProactiveLead[] = [];

    try {
      // Land Registry Price Paid API
      // https://landregistry.data.gov.uk/app/ppd
      for (const postcode of postcodes) {
        const postcodePrefix = postcode.replace(/\s+/g, '').toUpperCase();

        // Fetch recent transactions (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // In production, this would call the actual Land Registry API
        // For now, we'll simulate with a placeholder
        const transactions = await this.fetchLandRegistryData(postcodePrefix, sixMonthsAgo);

        for (const tx of transactions) {
          // Score the lead based on transaction type
          const leadData = this.scoreLandRegistryLead(tx);

          // Check if we already have this property
          const existing = await db.select()
            .from(proactiveLeads)
            .where(and(
              eq(proactiveLeads.propertyAddress, tx.address),
              eq(proactiveLeads.leadSource, 'land_registry')
            ))
            .limit(1);

          if (existing.length === 0 && leadData.score >= 40) {
            const lead: InsertProactiveLead = {
              leadSource: 'land_registry',
              sourceId: `LR-${tx.date}-${tx.address.substring(0, 20)}`,
              propertyAddress: tx.address,
              postcode: tx.postcode,
              propertyType: tx.propertyType,
              estimatedValue: tx.price,
              transactionDate: new Date(tx.date),
              transactionPrice: tx.price,
              ownershipDuration: Math.floor((Date.now() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24)),
              leadScore: leadData.score,
              leadTemperature: leadData.temperature,
              aiRecommendation: leadData.recommendation,
              metadata: {
                tenure: tx.tenure,
                newBuild: tx.newBuild,
                transactionType: leadData.type
              },
              status: 'new'
            };

            leads.push(lead);
          }
        }
      }

      // Save leads to database
      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} Land Registry leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Land Registry monitoring error:', error);
    }

    return leads;
  }

  private async fetchLandRegistryData(postcodePrefix: string, since: Date): Promise<LandRegistryTransaction[]> {
    // In production, implement actual Land Registry API call
    // For now, return sample data structure
    // API: https://landregistry.data.gov.uk/app/ppd/ppd_data.csv

    try {
      const browser = await this.getBrowser();
      const page = await browser.newPage();

      // Land Registry Price Paid search
      const searchUrl = `https://landregistry.data.gov.uk/app/ppd?postcode=${postcodePrefix}*&min_date=${since.toISOString().split('T')[0]}`;

      // Note: In production, you'd use their API or scrape the results
      // For now, returning empty to show structure
      await page.close();

      return [];
    } catch (error) {
      console.error('[ProactiveLeadGen] Error fetching Land Registry data:', error);
      return [];
    }
  }

  private scoreLandRegistryLead(tx: LandRegistryTransaction): { score: number; temperature: 'hot' | 'warm' | 'cold'; recommendation: string; type: string } {
    let score = 50;
    let type = 'standard_purchase';
    let recommendation = '';

    // Recent buyers might need letting management
    const daysSincePurchase = Math.floor((Date.now() - new Date(tx.date).getTime()) / (1000 * 60 * 60 * 24));

    if (daysSincePurchase < 30) {
      score += 20;
      type = 'new_purchase';
      recommendation = 'Recent buyer - may need letting management or renovation services';
    } else if (daysSincePurchase > 730) { // 2+ years
      score += 15;
      type = 'potential_seller';
      recommendation = 'Owner for 2+ years - consider selling valuation outreach';
    }

    // High value properties = higher commission potential
    if (tx.price > 1000000) score += 15;
    else if (tx.price > 500000) score += 10;

    // Property type preferences
    if (tx.propertyType === 'F') score += 5; // Flats more likely rentals

    const temperature = score >= 70 ? 'hot' : score >= 50 ? 'warm' : 'cold';

    return { score, temperature, recommendation, type };
  }

  // ==========================================
  // 2. PLANNING PERMISSION MONITORING
  // ==========================================

  /**
   * Monitor local planning portals for:
   * - Extensions (investing owners, not selling soon)
   * - Change of use applications
   * - New developments (block management opportunities)
   */
  async monitorPlanningPermissions(councils: string[]): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Monitoring planning permissions');
    const leads: InsertProactiveLead[] = [];

    try {
      for (const council of councils) {
        const applications = await this.fetchPlanningApplications(council);

        for (const app of applications) {
          // Check if in our target areas
          if (!this.isInTargetArea(app.postcode)) continue;

          const leadData = this.scorePlanningLead(app);

          if (leadData.score >= 40) {
            const existing = await db.select()
              .from(proactiveLeads)
              .where(and(
                eq(proactiveLeads.sourceId, `PLAN-${app.reference}`),
                eq(proactiveLeads.leadSource, 'planning_permission')
              ))
              .limit(1);

            if (existing.length === 0) {
              const lead: InsertProactiveLead = {
                leadSource: 'planning_permission',
                sourceId: `PLAN-${app.reference}`,
                propertyAddress: app.address,
                postcode: app.postcode,
                ownerName: app.applicantName,
                leadScore: leadData.score,
                leadTemperature: leadData.temperature,
                aiRecommendation: leadData.recommendation,
                metadata: {
                  planningRef: app.reference,
                  applicationType: app.applicationType,
                  description: app.description,
                  status: app.status,
                  decisionDate: app.decisionDate
                },
                status: 'new'
              };

              leads.push(lead);
            }
          }
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} planning permission leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Planning permission monitoring error:', error);
    }

    return leads;
  }

  private async fetchPlanningApplications(council: string): Promise<PlanningApplication[]> {
    // Westminster: https://idoxpa.westminster.gov.uk/online-applications/
    // Kensington & Chelsea: https://www.rbkc.gov.uk/planning
    // Brent: https://pa.brent.gov.uk/online-applications/

    // In production, implement scraping for each council's planning portal
    return [];
  }

  private scorePlanningLead(app: PlanningApplication): { score: number; temperature: 'hot' | 'warm' | 'cold'; recommendation: string } {
    let score = 40;
    let recommendation = '';

    // Change of use to residential = high value
    if (app.applicationType.toLowerCase().includes('change of use')) {
      score += 30;
      recommendation = 'Change of use application - potential new residential property';
    }
    // New development = block management opportunity
    else if (app.description.toLowerCase().includes('new build') ||
             app.description.toLowerCase().includes('development')) {
      score += 25;
      recommendation = 'New development - block management opportunity';
    }
    // Extension = owner investing, track for future
    else if (app.description.toLowerCase().includes('extension')) {
      score += 10;
      recommendation = 'Extension approved - flag for future follow-up (owner investing)';
    }

    const temperature = score >= 70 ? 'hot' : score >= 50 ? 'warm' : 'cold';

    return { score, temperature, recommendation };
  }

  // ==========================================
  // 3. EXPIRED LISTINGS DETECTION
  // ==========================================

  /**
   * Find properties that were listed but removed without selling
   * These are frustrated vendors open to a new approach
   */
  async detectExpiredListings(postcodes: string[]): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Detecting expired listings');
    const leads: InsertProactiveLead[] = [];

    try {
      const browser = await this.getBrowser();

      for (const postcode of postcodes) {
        // Check Zoopla
        const zooplaExpired = await this.scanForExpiredListings('zoopla', postcode, browser);

        // Check Rightmove
        const rightmoveExpired = await this.scanForExpiredListings('rightmove', postcode, browser);

        const allExpired = [...zooplaExpired, ...rightmoveExpired];

        for (const listing of allExpired) {
          const existing = await db.select()
            .from(proactiveLeads)
            .where(and(
              eq(proactiveLeads.propertyAddress, listing.address),
              eq(proactiveLeads.leadSource, 'expired_listing')
            ))
            .limit(1);

          if (existing.length === 0) {
            const lead: InsertProactiveLead = {
              leadSource: 'expired_listing',
              sourceId: `EXP-${listing.portal}-${listing.id}`,
              sourceUrl: listing.url,
              propertyAddress: listing.address,
              postcode: listing.postcode,
              propertyType: listing.propertyType,
              bedrooms: listing.bedrooms,
              estimatedValue: listing.price,
              originalListingDate: new Date(listing.listedDate),
              daysOnMarket: listing.daysOnMarket,
              originalPrice: listing.originalPrice || listing.price,
              currentPrice: listing.price,
              priceReductions: listing.priceChanges,
              originalAgent: listing.agentName,
              leadScore: 75, // Expired listings are high value
              leadTemperature: 'hot',
              aiRecommendation: `Property was listed for ${listing.daysOnMarket} days with ${listing.agentName} before being withdrawn. Likely frustrated vendor open to new approach.`,
              metadata: {
                portal: listing.portal,
                listingId: listing.id,
                withdrawnDate: new Date().toISOString()
              },
              status: 'new'
            };

            leads.push(lead);
          }
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} expired listing leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Expired listings detection error:', error);
    }

    return leads;
  }

  private async scanForExpiredListings(portal: 'zoopla' | 'rightmove', postcode: string, browser: Browser): Promise<PortalListing[]> {
    // Compare current listings with our stored listings
    // Properties that were active but now missing = expired/withdrawn

    // This requires maintaining a snapshot of active listings
    // In production, run daily to compare against previous day's listings
    return [];
  }

  // ==========================================
  // 4. PRICE REDUCTION ALERTS
  // ==========================================

  /**
   * Monitor for properties that just reduced their price
   * Indicates motivated sellers
   */
  async monitorPriceReductions(postcodes: string[]): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Monitoring price reductions');
    const leads: InsertProactiveLead[] = [];

    try {
      const browser = await this.getBrowser();

      for (const postcode of postcodes) {
        // Zoopla has a "price reduced" filter
        const page = await browser.newPage();

        try {
          // Search with price reduced filter
          const searchUrl = `https://www.zoopla.co.uk/for-sale/property/${postcode.toLowerCase().replace(/\s+/g, '-')}/?price_change=reduced`;
          await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });
          await page.waitForTimeout(2000);

          // Extract reduced listings
          const listings = await page.evaluate(() => {
            const results: any[] = [];
            const cards = document.querySelectorAll('[data-testid="search-result"]');

            cards.forEach((card) => {
              const addressEl = card.querySelector('[data-testid="listing-title"]');
              const priceEl = card.querySelector('[data-testid="listing-price"]');
              const reducedEl = card.querySelector('[data-testid="price-reduction"]');
              const linkEl = card.querySelector('a');

              if (addressEl && priceEl && reducedEl) {
                results.push({
                  address: addressEl.textContent?.trim() || '',
                  price: priceEl.textContent?.trim() || '',
                  reduced: reducedEl.textContent?.trim() || '',
                  url: linkEl?.getAttribute('href') || ''
                });
              }
            });

            return results;
          });

          for (const listing of listings) {
            const priceNum = parseInt(listing.price.replace(/[^0-9]/g, '')) || 0;

            // Check if we already have this
            const existing = await db.select()
              .from(proactiveLeads)
              .where(and(
                eq(proactiveLeads.propertyAddress, listing.address),
                eq(proactiveLeads.leadSource, 'price_reduction')
              ))
              .limit(1);

            if (existing.length === 0 && priceNum > 0) {
              // Calculate score based on reduction amount
              const reductionMatch = listing.reduced.match(/(\d+)%/);
              const reductionPercent = reductionMatch ? parseInt(reductionMatch[1]) : 5;

              let score = 60;
              if (reductionPercent >= 10) score = 85;
              else if (reductionPercent >= 7) score = 75;
              else if (reductionPercent >= 5) score = 70;

              const lead: InsertProactiveLead = {
                leadSource: 'price_reduction',
                sourceId: `PR-${Date.now()}-${listing.address.substring(0, 20)}`,
                sourceUrl: listing.url.startsWith('http') ? listing.url : `https://www.zoopla.co.uk${listing.url}`,
                propertyAddress: listing.address,
                postcode: postcode,
                estimatedValue: priceNum,
                currentPrice: priceNum,
                leadScore: score,
                leadTemperature: score >= 75 ? 'hot' : 'warm',
                aiRecommendation: `Price reduced by ${listing.reduced}. Vendor likely motivated - contact within 48 hours.`,
                metadata: {
                  portal: 'zoopla',
                  reductionInfo: listing.reduced,
                  reductionPercent: reductionPercent
                },
                status: 'new'
              };

              leads.push(lead);
            }
          }

        } finally {
          await page.close();
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} price reduction leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Price reduction monitoring error:', error);
    }

    return leads;
  }

  // ==========================================
  // 5. RENTAL YIELD ARBITRAGE
  // ==========================================

  /**
   * Find properties for sale where rental yield exceeds mortgage costs
   * Target buy-to-let investors
   */
  async findRentalArbitrageOpportunities(postcodes: string[]): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Finding rental arbitrage opportunities');
    const leads: InsertProactiveLead[] = [];

    try {
      const browser = await this.getBrowser();

      for (const postcode of postcodes) {
        // Get sale listings
        const saleListings = await this.getSaleListings(postcode, browser);

        // For each, calculate potential rental yield
        for (const listing of saleListings) {
          const rentalEstimate = this.estimateRentalValue(listing);
          const yieldCalc = this.calculateYield(listing.price, rentalEstimate);

          // Only create lead if yield is attractive (>4%)
          if (yieldCalc.grossYield >= 4) {
            const existing = await db.select()
              .from(proactiveLeads)
              .where(and(
                eq(proactiveLeads.propertyAddress, listing.address),
                eq(proactiveLeads.leadSource, 'rental_arbitrage')
              ))
              .limit(1);

            if (existing.length === 0) {
              const lead: InsertProactiveLead = {
                leadSource: 'rental_arbitrage',
                sourceId: `RA-${listing.portal}-${listing.id}`,
                sourceUrl: listing.url,
                propertyAddress: listing.address,
                postcode: listing.postcode,
                propertyType: listing.propertyType,
                bedrooms: listing.bedrooms,
                estimatedValue: listing.price,
                currentPrice: listing.price,
                leadScore: yieldCalc.grossYield >= 5 ? 80 : 65,
                leadTemperature: yieldCalc.grossYield >= 5 ? 'hot' : 'warm',
                aiRecommendation: `Investment opportunity: ${yieldCalc.grossYield.toFixed(1)}% gross yield. Est. rent £${rentalEstimate}/month. Target BTL investors.`,
                metadata: {
                  estimatedMonthlyRent: rentalEstimate,
                  grossYield: yieldCalc.grossYield,
                  netYield: yieldCalc.netYield,
                  annualRent: rentalEstimate * 12,
                  targetAudience: 'btl_investor'
                },
                status: 'new'
              };

              leads.push(lead);
            }
          }
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} rental arbitrage leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Rental arbitrage error:', error);
    }

    return leads;
  }

  private async getSaleListings(postcode: string, browser: Browser): Promise<PortalListing[]> {
    // Fetch current sale listings from portals
    return [];
  }

  private estimateRentalValue(listing: PortalListing): number {
    // Estimate rental based on area averages and property characteristics
    // West London rental estimates per bedroom:
    const rentalPerBedroom: Record<string, number> = {
      'W9': 700,   // Maida Vale
      'W10': 650,  // North Kensington
      'W11': 800,  // Notting Hill
      'NW6': 600,  // Kilburn
      'NW10': 550, // Kensal Green
      'W2': 750,   // Bayswater
    };

    const postcodePrefix = listing.postcode.split(' ')[0].toUpperCase();
    const baseRate = rentalPerBedroom[postcodePrefix] || 600;

    return baseRate * Math.max(listing.bedrooms, 1);
  }

  private calculateYield(price: number, monthlyRent: number): { grossYield: number; netYield: number } {
    const annualRent = monthlyRent * 12;
    const grossYield = (annualRent / price) * 100;

    // Estimate costs at 20% of rent (management, maintenance, voids)
    const netRent = annualRent * 0.80;
    const netYield = (netRent / price) * 100;

    return { grossYield, netYield };
  }

  // ==========================================
  // 6. SOCIAL MEDIA LISTENING
  // ==========================================

  /**
   * Monitor social media for property-related discussions
   * - "Thinking of selling..."
   * - "Can anyone recommend an estate agent?"
   * - "Moving out of London..."
   */
  async monitorSocialMedia(keywords: string[], areas: string[]): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Monitoring social media');
    const leads: InsertProactiveLead[] = [];

    try {
      // Social media monitoring keywords
      const searchTerms = [
        'selling my house',
        'recommend estate agent',
        'moving out of',
        'thinking of selling',
        'looking for estate agent',
        'property valuation',
        'need to sell quickly',
        'relocating from London',
        ...keywords
      ];

      // In production, integrate with:
      // - Twitter/X API
      // - Facebook Graph API (for pages/groups)
      // - Nextdoor API (if available)
      // - Mention.com or similar social listening tool

      const mentions = await this.searchSocialPlatforms(searchTerms, areas);

      for (const mention of mentions) {
        // Use AI to classify the mention
        const classification = await this.classifySocialMention(mention);

        if (classification.isQualifiedLead) {
          // Store the mention
          await db.insert(socialMediaMentions).values({
            platform: mention.platform,
            postId: mention.postId,
            postUrl: mention.url,
            content: mention.content,
            authorName: mention.authorName,
            authorHandle: mention.authorHandle,
            mentionType: classification.type,
            extractedPostcode: classification.postcode,
            extractedArea: classification.area,
            sentiment: classification.sentiment,
            relevanceScore: classification.relevance.toString(),
            isQualifiedLead: true,
            postedAt: new Date(mention.postedAt)
          });

          // Create lead if we extracted location
          if (classification.postcode || classification.area) {
            const lead: InsertProactiveLead = {
              leadSource: 'social_media',
              sourceId: `SM-${mention.platform}-${mention.postId}`,
              sourceUrl: mention.url,
              propertyAddress: classification.area || 'Unknown',
              postcode: classification.postcode || '',
              ownerName: mention.authorName,
              leadScore: Math.round(classification.relevance * 100),
              leadTemperature: classification.relevance > 0.7 ? 'hot' : 'warm',
              aiRecommendation: classification.recommendation,
              metadata: {
                platform: mention.platform,
                postContent: mention.content.substring(0, 500),
                mentionType: classification.type,
                sentiment: classification.sentiment
              },
              status: 'new'
            };

            leads.push(lead);
          }
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} social media leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Social media monitoring error:', error);
    }

    return leads;
  }

  private async searchSocialPlatforms(keywords: string[], areas: string[]): Promise<SocialMention[]> {
    // In production, implement actual social media API integrations
    return [];
  }

  private async classifySocialMention(mention: SocialMention): Promise<{
    isQualifiedLead: boolean;
    type: string;
    postcode: string | null;
    area: string | null;
    sentiment: string;
    relevance: number;
    recommendation: string;
  }> {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{
          role: 'user',
          content: `Analyze this social media post for lead generation potential:

Platform: ${mention.platform}
Author: ${mention.authorName}
Content: "${mention.content}"

Determine:
1. Is this a qualified lead for an estate agent? (someone considering selling, buying, or renting property)
2. What type of mention is it? (selling_interest, letting_interest, agent_recommendation, moving_mention, valuation_interest, other)
3. Extract any postcodes or London areas mentioned (W9, Maida Vale, etc.)
4. What is the sentiment? (positive, neutral, negative)
5. Relevance score 0-1
6. Recommended action

Return JSON: {
  "isQualifiedLead": boolean,
  "type": string,
  "postcode": string or null,
  "area": string or null,
  "sentiment": string,
  "relevance": number,
  "recommendation": string
}`
        }],
        response_format: { type: 'json_object' }
      });

      return JSON.parse(response.choices[0].message.content || '{}');
    } catch (error) {
      return {
        isQualifiedLead: false,
        type: 'other',
        postcode: null,
        area: null,
        sentiment: 'neutral',
        relevance: 0,
        recommendation: ''
      };
    }
  }

  // ==========================================
  // 7. LANDLORD COMPLIANCE REMINDERS
  // ==========================================

  /**
   * Track compliance certificate expiry dates and reach out
   * - EPC (every 10 years)
   * - Gas Safety (annual)
   * - EICR (every 5 years)
   */
  async checkLandlordCompliance(): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Checking landlord compliance');
    const leads: InsertProactiveLead[] = [];

    try {
      const now = new Date();
      const sixtyDaysFromNow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

      // Find properties with expiring compliance
      const expiringCompliance = await db.select()
        .from(landlordCompliance)
        .where(or(
          and(
            gte(landlordCompliance.epcExpiryDate, now),
            lte(landlordCompliance.epcExpiryDate, sixtyDaysFromNow)
          ),
          and(
            gte(landlordCompliance.gasSafetyExpiryDate, now),
            lte(landlordCompliance.gasSafetyExpiryDate, sixtyDaysFromNow)
          ),
          and(
            gte(landlordCompliance.eicrExpiryDate, now),
            lte(landlordCompliance.eicrExpiryDate, sixtyDaysFromNow)
          )
        ));

      for (const record of expiringCompliance) {
        // Determine which certificates are expiring
        const expiringCerts: string[] = [];
        let earliestExpiry = sixtyDaysFromNow;

        if (record.epcExpiryDate && record.epcExpiryDate <= sixtyDaysFromNow) {
          expiringCerts.push('EPC');
          if (record.epcExpiryDate < earliestExpiry) earliestExpiry = record.epcExpiryDate;
        }
        if (record.gasSafetyExpiryDate && record.gasSafetyExpiryDate <= sixtyDaysFromNow) {
          expiringCerts.push('Gas Safety');
          if (record.gasSafetyExpiryDate < earliestExpiry) earliestExpiry = record.gasSafetyExpiryDate;
        }
        if (record.eicrExpiryDate && record.eicrExpiryDate <= sixtyDaysFromNow) {
          expiringCerts.push('EICR');
          if (record.eicrExpiryDate < earliestExpiry) earliestExpiry = record.eicrExpiryDate;
        }

        // Check if lead already exists
        const existing = await db.select()
          .from(proactiveLeads)
          .where(and(
            eq(proactiveLeads.propertyAddress, record.propertyAddress),
            eq(proactiveLeads.leadSource, 'compliance_reminder'),
            eq(proactiveLeads.status, 'new')
          ))
          .limit(1);

        if (existing.length === 0 && expiringCerts.length > 0) {
          const daysUntilExpiry = Math.floor((earliestExpiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          const lead: InsertProactiveLead = {
            leadSource: 'compliance_reminder',
            sourceId: `COMP-${record.id}`,
            propertyAddress: record.propertyAddress,
            postcode: record.postcode,
            ownerName: record.landlordName || undefined,
            ownerEmail: record.landlordEmail || undefined,
            ownerPhone: record.landlordPhone || undefined,
            complianceType: expiringCerts.join(', '),
            complianceExpiryDate: earliestExpiry,
            leadScore: daysUntilExpiry < 30 ? 80 : 60,
            leadTemperature: daysUntilExpiry < 30 ? 'hot' : 'warm',
            aiRecommendation: `${expiringCerts.join(', ')} expiring in ${daysUntilExpiry} days. Contact to offer renewal services and discuss management.`,
            metadata: {
              expiringCertificates: expiringCerts,
              daysUntilExpiry,
              isExistingClient: record.propertyId !== null,
              complianceRecordId: record.id
            },
            status: 'new'
          };

          leads.push(lead);
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} compliance reminder leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Compliance check error:', error);
    }

    return leads;
  }

  // ==========================================
  // 8. PORTFOLIO LANDLORD OUTREACH
  // ==========================================

  /**
   * Identify landlords with multiple properties
   * Offer consolidated management services
   */
  async identifyPortfolioLandlords(): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Identifying portfolio landlords');
    const leads: InsertProactiveLead[] = [];

    try {
      // In production, use Land Registry bulk data to identify
      // individuals/companies with multiple properties in target areas

      // Can also cross-reference with:
      // - Companies House for property investment companies
      // - Rental listings showing same agent for multiple properties

      // For now, analyze our existing compliance data
      const landlordsByAddress = await db.select({
        landlordName: landlordCompliance.landlordName,
        landlordEmail: landlordCompliance.landlordEmail,
        landlordPhone: landlordCompliance.landlordPhone,
        propertyCount: sql<number>`count(*)::int`,
      })
        .from(landlordCompliance)
        .where(eq(landlordCompliance.isProspect, true))
        .groupBy(
          landlordCompliance.landlordName,
          landlordCompliance.landlordEmail,
          landlordCompliance.landlordPhone
        )
        .having(sql`count(*) >= 2`);

      for (const landlord of landlordsByAddress) {
        if (!landlord.landlordName) continue;

        const existing = await db.select()
          .from(proactiveLeads)
          .where(and(
            eq(proactiveLeads.ownerName, landlord.landlordName),
            eq(proactiveLeads.leadSource, 'portfolio_landlord')
          ))
          .limit(1);

        if (existing.length === 0) {
          const lead: InsertProactiveLead = {
            leadSource: 'portfolio_landlord',
            sourceId: `PL-${landlord.landlordEmail || landlord.landlordName}`,
            propertyAddress: 'Multiple properties',
            postcode: '',
            ownerName: landlord.landlordName,
            ownerEmail: landlord.landlordEmail || undefined,
            ownerPhone: landlord.landlordPhone || undefined,
            leadScore: landlord.propertyCount >= 5 ? 90 : landlord.propertyCount >= 3 ? 75 : 60,
            leadTemperature: landlord.propertyCount >= 3 ? 'hot' : 'warm',
            aiRecommendation: `Portfolio landlord with ${landlord.propertyCount} properties. Offer consolidated management package with volume discount.`,
            metadata: {
              propertyCount: landlord.propertyCount,
              targetService: 'portfolio_management'
            },
            status: 'new'
          };

          leads.push(lead);
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} portfolio landlord leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Portfolio landlord identification error:', error);
    }

    return leads;
  }

  // ==========================================
  // 9. AUCTION MONITORING
  // ==========================================

  /**
   * Monitor property auctions for:
   * - Failed lots (motivated sellers)
   * - Successful buyers (may need management)
   */
  async monitorAuctions(): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Monitoring auctions');
    const leads: InsertProactiveLead[] = [];

    try {
      const browser = await this.getBrowser();

      // Major auction houses
      const auctionHouses = [
        { name: 'Allsop', url: 'https://www.allsop.co.uk/auctions/' },
        { name: 'Savills', url: 'https://www.savills.co.uk/auctions/' },
        { name: 'Auction House London', url: 'https://www.auctionhouse.co.uk/london/' },
        { name: 'Network Auctions', url: 'https://www.networkauctions.co.uk/' },
      ];

      for (const house of auctionHouses) {
        const lots = await this.scrapeAuctionLots(house.url, house.name, browser);

        for (const lot of lots) {
          // Filter to our target areas
          if (!this.isInTargetArea(lot.postcode)) continue;

          const leadData = this.scoreAuctionLead(lot);

          const existing = await db.select()
            .from(proactiveLeads)
            .where(and(
              eq(proactiveLeads.sourceId, `AUC-${lot.auctionHouse}-${lot.lotNumber}`),
              eq(proactiveLeads.leadSource, 'auction')
            ))
            .limit(1);

          if (existing.length === 0 && leadData.score >= 50) {
            const lead: InsertProactiveLead = {
              leadSource: 'auction',
              sourceId: `AUC-${lot.auctionHouse}-${lot.lotNumber}`,
              sourceUrl: lot.url,
              propertyAddress: lot.address,
              postcode: lot.postcode,
              propertyType: lot.propertyType,
              estimatedValue: lot.guidePrice,
              guidePrice: lot.guidePrice,
              auctionHouse: lot.auctionHouse,
              auctionDate: new Date(lot.auctionDate),
              auctionResult: lot.result,
              leadScore: leadData.score,
              leadTemperature: leadData.temperature,
              aiRecommendation: leadData.recommendation,
              metadata: {
                lotNumber: lot.lotNumber,
                tenure: lot.tenure,
                soldPrice: lot.soldPrice
              },
              status: 'new'
            };

            leads.push(lead);
          }
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} auction leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Auction monitoring error:', error);
    }

    return leads;
  }

  private async scrapeAuctionLots(url: string, auctionHouse: string, browser: Browser): Promise<AuctionLot[]> {
    // In production, implement scraping for each auction house
    return [];
  }

  private scoreAuctionLead(lot: AuctionLot): { score: number; temperature: 'hot' | 'warm' | 'cold'; recommendation: string } {
    let score = 50;
    let recommendation = '';

    if (lot.result === 'unsold') {
      score = 85;
      recommendation = 'Failed auction lot - highly motivated seller. Offer private sale alternative.';
    } else if (lot.result === 'withdrawn') {
      score = 75;
      recommendation = 'Withdrawn before auction - vendor may have changed mind. Worth approaching.';
    } else if (lot.result === 'sold') {
      score = 60;
      recommendation = 'Successful buyer - may need property management or renovation services.';
    } else {
      // Upcoming lot
      score = 55;
      recommendation = 'Upcoming auction lot - contact vendor to offer private sale as alternative.';
    }

    const temperature = score >= 75 ? 'hot' : score >= 60 ? 'warm' : 'cold';

    return { score, temperature, recommendation };
  }

  // ==========================================
  // 10. EMPTY PROPERTY DETECTION
  // ==========================================

  /**
   * Identify long-term empty properties
   * Owners may want to sell or let
   */
  async detectEmptyProperties(): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Detecting empty properties');
    const leads: InsertProactiveLead[] = [];

    try {
      // Sources for empty property data:
      // 1. Council tax records (empty property premium)
      // 2. Electoral roll (no registered voters)
      // 3. Utility data partnerships
      // 4. Visual inspection (via Street View or site visits)

      // In production, would integrate with council data or data providers
      // For now, placeholder implementation

    } catch (error) {
      console.error('[ProactiveLeadGen] Empty property detection error:', error);
    }

    return leads;
  }

  // ==========================================
  // 11. COMPETITOR LISTING MONITORING
  // ==========================================

  /**
   * Monitor competitor listings that:
   * - Have been on market too long
   * - Have had multiple price reductions
   * - Are approaching instruction end
   */
  async monitorCompetitorListings(postcodes: string[]): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Monitoring competitor listings');
    const leads: InsertProactiveLead[] = [];

    try {
      const browser = await this.getBrowser();

      for (const postcode of postcodes) {
        // Get all current listings
        const listings = await this.getAllPortalListings(postcode, browser);

        for (const listing of listings) {
          // Score based on stale listing criteria
          const isStale = listing.daysOnMarket >= 90;
          const hasMultipleReductions = listing.priceChanges >= 2;
          const isStruggling = isStale || hasMultipleReductions;

          if (isStruggling) {
            const existing = await db.select()
              .from(proactiveLeads)
              .where(and(
                eq(proactiveLeads.propertyAddress, listing.address),
                eq(proactiveLeads.leadSource, 'competitor_listing')
              ))
              .limit(1);

            if (existing.length === 0) {
              let score = 60;
              let recommendation = '';

              if (listing.daysOnMarket >= 180) {
                score = 90;
                recommendation = `On market ${listing.daysOnMarket} days with ${listing.agentName}. Likely very frustrated - offer fresh approach with guaranteed sale option.`;
              } else if (listing.daysOnMarket >= 120) {
                score = 80;
                recommendation = `On market ${listing.daysOnMarket} days with ${listing.agentName}. Vendor getting anxious - time to approach.`;
              } else if (hasMultipleReductions) {
                score = 75;
                recommendation = `${listing.priceChanges} price reductions with ${listing.agentName}. Pricing strategy failing - offer realistic valuation.`;
              } else {
                recommendation = `${listing.daysOnMarket} days on market. Monitor for further reductions.`;
              }

              const lead: InsertProactiveLead = {
                leadSource: 'competitor_listing',
                sourceId: `CL-${listing.portal}-${listing.id}`,
                sourceUrl: listing.url,
                propertyAddress: listing.address,
                postcode: listing.postcode,
                propertyType: listing.propertyType,
                bedrooms: listing.bedrooms,
                estimatedValue: listing.price,
                originalListingDate: new Date(listing.listedDate),
                daysOnMarket: listing.daysOnMarket,
                originalPrice: listing.originalPrice,
                currentPrice: listing.price,
                priceReductions: listing.priceChanges,
                originalAgent: listing.agentName,
                leadScore: score,
                leadTemperature: score >= 80 ? 'hot' : score >= 65 ? 'warm' : 'cold',
                aiRecommendation: recommendation,
                metadata: {
                  portal: listing.portal,
                  listingId: listing.id,
                  competitorAgent: listing.agentName
                },
                status: 'new'
              };

              leads.push(lead);
            }
          }
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} competitor listing leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Competitor listing monitoring error:', error);
    }

    return leads;
  }

  private async getAllPortalListings(postcode: string, browser: Browser): Promise<PortalListing[]> {
    // Combine listings from multiple portals
    return [];
  }

  // ==========================================
  // 12. SEASONAL CAMPAIGNS
  // ==========================================

  /**
   * Run seasonal outreach campaigns
   * - New Year: "New year, new home?"
   * - Spring: Peak selling season
   * - Back-to-school: Family moves
   * - Pre-Christmas: Quick completion
   */
  async runSeasonalCampaigns(): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Running seasonal campaigns');
    const leads: InsertProactiveLead[] = [];

    try {
      const now = new Date();

      // Find active campaigns
      const activeCampaigns = await db.select()
        .from(seasonalCampaigns)
        .where(and(
          eq(seasonalCampaigns.isActive, true),
          lte(seasonalCampaigns.startDate, now),
          gte(seasonalCampaigns.endDate, now)
        ));

      for (const campaign of activeCampaigns) {
        // Get target audience based on campaign type
        let targetLeads: any[] = [];

        switch (campaign.targetAudience) {
          case 'potential_sellers':
            // Target properties purchased 2-7 years ago
            targetLeads = await this.getOwnersByPurchaseDate(730, 2555, campaign.postcodeAreas || []);
            break;

          case 'landlords':
            // Target existing rental properties
            targetLeads = await this.getRentalProperties(campaign.postcodeAreas || []);
            break;

          case 'expired_listings':
            // Target previously withdrawn listings
            targetLeads = await db.select()
              .from(proactiveLeads)
              .where(and(
                eq(proactiveLeads.leadSource, 'expired_listing'),
                eq(proactiveLeads.status, 'declined')
              ));
            break;
        }

        for (const target of targetLeads) {
          const lead: InsertProactiveLead = {
            leadSource: 'seasonal_campaign',
            sourceId: `SC-${campaign.id}-${target.id || Date.now()}`,
            propertyAddress: target.address || target.propertyAddress,
            postcode: target.postcode,
            ownerName: target.ownerName,
            ownerEmail: target.ownerEmail,
            ownerPhone: target.ownerPhone,
            campaignId: campaign.id,
            campaignName: campaign.name,
            leadScore: 55,
            leadTemperature: 'warm',
            aiRecommendation: `${campaign.name} campaign target. Key message: ${campaign.headline}`,
            metadata: {
              campaignType: campaign.campaignType,
              targetAudience: campaign.targetAudience,
              offerDetails: campaign.offerDetails
            },
            status: 'new'
          };

          leads.push(lead);
        }

        // Update campaign metrics
        await db.update(seasonalCampaigns)
          .set({
            totalRecipients: (campaign.totalRecipients || 0) + leads.length,
            updatedAt: new Date()
          })
          .where(eq(seasonalCampaigns.id, campaign.id));
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} seasonal campaign leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Seasonal campaigns error:', error);
    }

    return leads;
  }

  private async getOwnersByPurchaseDate(minDays: number, maxDays: number, postcodes: string[]): Promise<any[]> {
    // Query Land Registry data for properties purchased within timeframe
    return [];
  }

  private async getRentalProperties(postcodes: string[]): Promise<any[]> {
    // Query rental listings in target areas
    return [];
  }

  // ==========================================
  // 13. AI PROPENSITY SCORING
  // ==========================================

  /**
   * Use ML to predict likelihood to sell
   * Based on ownership duration, property type, area trends, life events
   */
  async runPropensityScoring(): Promise<InsertProactiveLead[]> {
    console.log('[ProactiveLeadGen] Running propensity scoring');
    const leads: InsertProactiveLead[] = [];

    try {
      // Get all properties in our target areas that haven't been scored recently
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // In production, this would use a trained ML model
      // For now, use rule-based scoring with AI enhancement

      const existingScores = await db.select()
        .from(propensityScores)
        .where(or(
          isNull(propensityScores.scoredAt),
          lt(propensityScores.scoredAt, thirtyDaysAgo)
        ))
        .limit(100);

      for (const property of existingScores) {
        // Calculate propensity score
        const score = await this.calculatePropensityScore(property);

        // Update the score
        await db.update(propensityScores)
          .set({
            sellPropensity: score.sellPropensity.toString(),
            letPropensity: score.letPropensity?.toString(),
            scoreConfidence: score.confidence.toString(),
            scoredAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(propensityScores.id, property.id));

        // Create lead if high propensity
        if (score.sellPropensity >= 70 && !property.leadCreated) {
          const lead: InsertProactiveLead = {
            leadSource: 'propensity_score',
            sourceId: `PS-${property.id}`,
            propertyAddress: property.propertyAddress,
            postcode: property.postcode,
            propertyType: property.propertyType || undefined,
            bedrooms: property.bedrooms || undefined,
            estimatedValue: property.estimatedValue || undefined,
            propensityScore: score.sellPropensity.toString(),
            leadScore: Math.round(score.sellPropensity),
            leadTemperature: score.sellPropensity >= 85 ? 'hot' : 'warm',
            aiRecommendation: score.recommendation,
            metadata: {
              propensityScoreId: property.id,
              sellPropensity: score.sellPropensity,
              letPropensity: score.letPropensity,
              confidence: score.confidence,
              factors: score.factors
            },
            status: 'new'
          };

          leads.push(lead);

          // Mark as lead created
          await db.update(propensityScores)
            .set({ leadCreated: true })
            .where(eq(propensityScores.id, property.id));
        }
      }

      if (leads.length > 0) {
        await db.insert(proactiveLeads).values(leads);
        console.log(`[ProactiveLeadGen] Created ${leads.length} propensity score leads`);
      }

    } catch (error) {
      console.error('[ProactiveLeadGen] Propensity scoring error:', error);
    }

    return leads;
  }

  private async calculatePropensityScore(property: any): Promise<{
    sellPropensity: number;
    letPropensity?: number;
    confidence: number;
    recommendation: string;
    factors: string[];
  }> {
    let sellPropensity = 30; // Base score
    const factors: string[] = [];

    // Ownership duration factor
    if (property.ownershipDuration) {
      const years = property.ownershipDuration / 365;
      if (years >= 7 && years <= 10) {
        sellPropensity += 20;
        factors.push('Optimal ownership duration (7-10 years)');
      } else if (years >= 5 && years <= 15) {
        sellPropensity += 15;
        factors.push('Good ownership duration');
      } else if (years >= 2) {
        sellPropensity += 10;
      }
    }

    // Market trend factor
    if (property.localMarketTrend && parseFloat(property.localMarketTrend) > 0) {
      sellPropensity += 10;
      factors.push('Rising market - sellers motivated');
    }

    // Life event indicators
    if (property.probateFlag) {
      sellPropensity += 30;
      factors.push('Probate indicator - highly motivated');
    }
    if (property.recentPlanningApp) {
      sellPropensity -= 15; // Less likely to sell if investing
      factors.push('Recent planning application - investing owner');
    }

    // Landlord factor
    if (property.isLandlord) {
      sellPropensity -= 10; // Landlords less likely to sell
    }

    // Use AI to refine
    try {
      const aiResponse = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [{
          role: 'user',
          content: `Given these property factors, estimate sell propensity (0-100):
- Address: ${property.propertyAddress}
- Ownership: ${property.ownershipDuration ? Math.round(property.ownershipDuration / 365) : 'unknown'} years
- Type: ${property.propertyType}
- Estimated value: £${property.estimatedValue}
- Is landlord: ${property.isLandlord}
- Probate flag: ${property.probateFlag}
- Recent planning: ${property.recentPlanningApp}

Current factors: ${factors.join(', ')}
Current score: ${sellPropensity}

Return JSON: { "adjustedScore": number, "additionalFactors": string[], "recommendation": string }`
        }],
        response_format: { type: 'json_object' }
      });

      const aiData = JSON.parse(aiResponse.choices[0].message.content || '{}');

      if (aiData.adjustedScore) {
        sellPropensity = Math.round((sellPropensity + aiData.adjustedScore) / 2);
      }
      if (aiData.additionalFactors) {
        factors.push(...aiData.additionalFactors);
      }

      return {
        sellPropensity: Math.min(100, Math.max(0, sellPropensity)),
        confidence: 0.7,
        recommendation: aiData.recommendation || 'Contact for valuation discussion',
        factors
      };
    } catch (error) {
      return {
        sellPropensity: Math.min(100, Math.max(0, sellPropensity)),
        confidence: 0.5,
        recommendation: 'Review manually and consider outreach',
        factors
      };
    }
  }

  // ==========================================
  // UTILITY METHODS
  // ==========================================

  private isInTargetArea(postcode: string): boolean {
    const targetPrefixes = ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'];
    const prefix = postcode.replace(/\s+/g, '').toUpperCase().match(/^[A-Z]+\d+/)?.[0] || '';
    return targetPrefixes.includes(prefix);
  }

  // ==========================================
  // MONITORING SCHEDULE
  // ==========================================

  /**
   * Start all monitoring services
   */
  async startAllMonitors(): Promise<void> {
    console.log('[ProactiveLeadGen] Starting all monitors...');
    this.isRunning = true;

    const targetPostcodes = ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'];
    const councils = ['Westminster', 'Kensington and Chelsea', 'Brent'];

    // Price reductions - check every hour
    this.scheduleMonitor('price_reductions', 60 * 60 * 1000, async () => {
      await this.monitorPriceReductions(targetPostcodes);
    });

    // Competitor listings - check every 4 hours
    this.scheduleMonitor('competitor_listings', 4 * 60 * 60 * 1000, async () => {
      await this.monitorCompetitorListings(targetPostcodes);
    });

    // Land Registry - check daily
    this.scheduleMonitor('land_registry', 24 * 60 * 60 * 1000, async () => {
      await this.monitorLandRegistry(targetPostcodes);
    });

    // Planning permissions - check daily
    this.scheduleMonitor('planning_permissions', 24 * 60 * 60 * 1000, async () => {
      await this.monitorPlanningPermissions(councils);
    });

    // Expired listings - check daily
    this.scheduleMonitor('expired_listings', 24 * 60 * 60 * 1000, async () => {
      await this.detectExpiredListings(targetPostcodes);
    });

    // Rental arbitrage - check weekly
    this.scheduleMonitor('rental_arbitrage', 7 * 24 * 60 * 60 * 1000, async () => {
      await this.findRentalArbitrageOpportunities(targetPostcodes);
    });

    // Compliance reminders - check daily
    this.scheduleMonitor('compliance', 24 * 60 * 60 * 1000, async () => {
      await this.checkLandlordCompliance();
    });

    // Portfolio landlords - check weekly
    this.scheduleMonitor('portfolio_landlords', 7 * 24 * 60 * 60 * 1000, async () => {
      await this.identifyPortfolioLandlords();
    });

    // Auctions - check daily
    this.scheduleMonitor('auctions', 24 * 60 * 60 * 1000, async () => {
      await this.monitorAuctions();
    });

    // Propensity scoring - check weekly
    this.scheduleMonitor('propensity_scoring', 7 * 24 * 60 * 60 * 1000, async () => {
      await this.runPropensityScoring();
    });

    // Seasonal campaigns - check daily
    this.scheduleMonitor('seasonal_campaigns', 24 * 60 * 60 * 1000, async () => {
      await this.runSeasonalCampaigns();
    });

    // Social media - check every 2 hours
    this.scheduleMonitor('social_media', 2 * 60 * 60 * 1000, async () => {
      await this.monitorSocialMedia([], targetPostcodes);
    });

    console.log('[ProactiveLeadGen] All monitors started');
  }

  private scheduleMonitor(name: string, intervalMs: number, callback: () => Promise<void>): void {
    // Run immediately
    callback().catch(err => console.error(`[ProactiveLeadGen] ${name} error:`, err));

    // Schedule recurring
    const interval = setInterval(() => {
      if (this.isRunning) {
        callback().catch(err => console.error(`[ProactiveLeadGen] ${name} error:`, err));
      }
    }, intervalMs);

    this.monitorIntervals.set(name, interval);
  }

  /**
   * Stop all monitors
   */
  stopAllMonitors(): void {
    console.log('[ProactiveLeadGen] Stopping all monitors...');
    this.isRunning = false;

    for (const [name, interval] of this.monitorIntervals) {
      clearInterval(interval);
      console.log(`[ProactiveLeadGen] Stopped ${name} monitor`);
    }

    this.monitorIntervals.clear();
    this.closeBrowser();
  }

  /**
   * Run a single monitor manually
   */
  async runMonitor(monitorType: string): Promise<InsertProactiveLead[]> {
    const targetPostcodes = ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'];
    const councils = ['Westminster', 'Kensington and Chelsea', 'Brent'];

    switch (monitorType) {
      case 'land_registry':
        return this.monitorLandRegistry(targetPostcodes);
      case 'planning_permissions':
        return this.monitorPlanningPermissions(councils);
      case 'expired_listings':
        return this.detectExpiredListings(targetPostcodes);
      case 'price_reductions':
        return this.monitorPriceReductions(targetPostcodes);
      case 'rental_arbitrage':
        return this.findRentalArbitrageOpportunities(targetPostcodes);
      case 'social_media':
        return this.monitorSocialMedia([], targetPostcodes);
      case 'compliance':
        return this.checkLandlordCompliance();
      case 'portfolio_landlords':
        return this.identifyPortfolioLandlords();
      case 'auctions':
        return this.monitorAuctions();
      case 'competitor_listings':
        return this.monitorCompetitorListings(targetPostcodes);
      case 'seasonal_campaigns':
        return this.runSeasonalCampaigns();
      case 'propensity_scoring':
        return this.runPropensityScoring();
      default:
        throw new Error(`Unknown monitor type: ${monitorType}`);
    }
  }

  // ==========================================
  // LEAD MANAGEMENT
  // ==========================================

  /**
   * Get leads by source and status
   */
  async getLeads(filters: {
    source?: string;
    status?: string;
    temperature?: string;
    minScore?: number;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    let query = db.select().from(proactiveLeads);

    const conditions = [];
    if (filters.source) {
      conditions.push(eq(proactiveLeads.leadSource, filters.source));
    }
    if (filters.status) {
      conditions.push(eq(proactiveLeads.status, filters.status));
    }
    if (filters.temperature) {
      conditions.push(eq(proactiveLeads.leadTemperature, filters.temperature));
    }
    if (filters.minScore) {
      conditions.push(gte(proactiveLeads.leadScore, filters.minScore));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    return query
      .orderBy(desc(proactiveLeads.leadScore), desc(proactiveLeads.createdAt))
      .limit(filters.limit || 50)
      .offset(filters.offset || 0);
  }

  /**
   * Update lead status
   */
  async updateLeadStatus(leadId: number, status: string, notes?: string): Promise<void> {
    await db.update(proactiveLeads)
      .set({
        status,
        notes: notes || undefined,
        updatedAt: new Date()
      })
      .where(eq(proactiveLeads.id, leadId));
  }

  /**
   * Record contact attempt
   */
  async recordContact(leadId: number, contactData: {
    method: string;
    direction: string;
    subject?: string;
    content?: string;
    outcome?: string;
    contactedById?: number;
  }): Promise<void> {
    // Create contact history record
    await db.insert(leadContactHistory).values({
      leadId,
      contactMethod: contactData.method,
      contactDirection: contactData.direction,
      subject: contactData.subject,
      content: contactData.content,
      outcome: contactData.outcome,
      contactedById: contactData.contactedById,
      sentAt: new Date()
    });

    // Update lead
    await db.update(proactiveLeads)
      .set({
        contactAttempts: sql`${proactiveLeads.contactAttempts} + 1`,
        lastContactDate: new Date(),
        lastContactMethod: contactData.method,
        status: 'contacted',
        updatedAt: new Date()
      })
      .where(eq(proactiveLeads.id, leadId));
  }

  /**
   * Get dashboard statistics
   */
  async getDashboardStats(): Promise<{
    totalLeads: number;
    leadsBySource: Record<string, number>;
    leadsByTemperature: Record<string, number>;
    leadsByStatus: Record<string, number>;
    recentLeads: any[];
    conversionRate: number;
  }> {
    const allLeads = await db.select().from(proactiveLeads);

    const leadsBySource: Record<string, number> = {};
    const leadsByTemperature: Record<string, number> = {};
    const leadsByStatus: Record<string, number> = {};
    let conversions = 0;

    for (const lead of allLeads) {
      leadsBySource[lead.leadSource] = (leadsBySource[lead.leadSource] || 0) + 1;
      leadsByTemperature[lead.leadTemperature || 'unknown'] = (leadsByTemperature[lead.leadTemperature || 'unknown'] || 0) + 1;
      leadsByStatus[lead.status] = (leadsByStatus[lead.status] || 0) + 1;

      if (lead.status === 'instructed' || lead.conversionDate) {
        conversions++;
      }
    }

    const recentLeads = await db.select()
      .from(proactiveLeads)
      .orderBy(desc(proactiveLeads.createdAt))
      .limit(10);

    return {
      totalLeads: allLeads.length,
      leadsBySource,
      leadsByTemperature,
      leadsByStatus,
      recentLeads,
      conversionRate: allLeads.length > 0 ? (conversions / allLeads.length) * 100 : 0
    };
  }
}

// Export singleton instance
export const proactiveLeadGenService = new ProactiveLeadGenService();
