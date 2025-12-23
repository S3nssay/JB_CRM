import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { db } from './db';
import { eq, and, gte, lte, sql, desc } from 'drizzle-orm';

/**
 * Stale Listing Interface
 */
export interface StaleListing {
  id?: number;
  portal: 'zoopla' | 'rightmove';
  portalListingId: string;
  address: string;
  postcode: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  daysOnMarket: number;
  listedDate: string;
  agentName: string;
  agentPhone?: string;
  lastPriceChange?: string;
  priceHistory: { date: string; price: number }[];
  status: 'new' | 'contacted' | 'responded' | 'declined' | 'converted';
  contactAttempts: number;
  lastContactDate?: string;
  notes?: string;
  estimatedMarketValue: number;
  cashOfferPrice: number;
  ownerName?: string;
  ownerAddress?: string;
}

/**
 * Monitor Settings Interface
 */
export interface MonitorSettings {
  enabled: boolean;
  portals: string[];
  postcodeAreas: string[];
  minDaysOnMarket: number;
  maxDaysOnMarket: number;
  minPrice: number;
  maxPrice: number;
  propertyTypes: string[];
  autoContact: boolean;
  contactMethod: 'post' | 'email' | 'both';
  cashOfferPercent: number;
  completionDays: number;
  scanFrequency: 'hourly' | 'daily' | 'weekly';
}

/**
 * Lead Generation Service
 * Monitors property portals for stale listings and manages cash offer campaigns
 */
export class LeadGenerationService {
  private browser: Browser | null = null;
  private staleListings: Map<string, StaleListing> = new Map();
  private settings: MonitorSettings = {
    enabled: true,
    portals: ['zoopla', 'rightmove'],
    postcodeAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10', 'W2'],
    minDaysOnMarket: 90,
    maxDaysOnMarket: 365,
    minPrice: 200000,
    maxPrice: 5000000,
    propertyTypes: ['house', 'flat', 'maisonette'],
    autoContact: false,
    contactMethod: 'post',
    cashOfferPercent: 85,
    completionDays: 7,
    scanFrequency: 'daily'
  };

  constructor() {
    console.log('Lead Generation Service initialized');
  }

  /**
   * Initialize browser for scraping
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
    }
    return this.browser;
  }

  /**
   * Update monitor settings
   */
  updateSettings(newSettings: Partial<MonitorSettings>): void {
    this.settings = { ...this.settings, ...newSettings };
    console.log('Lead generation settings updated:', this.settings);
  }

  /**
   * Get current settings
   */
  getSettings(): MonitorSettings {
    return this.settings;
  }

  /**
   * Calculate cash offer price
   */
  calculateCashOffer(marketValue: number): number {
    return Math.round(marketValue * (this.settings.cashOfferPercent / 100));
  }

  /**
   * Estimate market value based on listed price and days on market
   */
  estimateMarketValue(listedPrice: number, daysOnMarket: number, priceReductions: number): number {
    // Properties on market 90+ days typically need 5-15% reduction
    let discountFactor = 1;

    if (daysOnMarket > 180) {
      discountFactor = 0.90; // 10% below asking
    } else if (daysOnMarket > 120) {
      discountFactor = 0.93; // 7% below asking
    } else if (daysOnMarket > 90) {
      discountFactor = 0.95; // 5% below asking
    }

    // Additional discount if price has been reduced multiple times
    if (priceReductions > 2) {
      discountFactor -= 0.03;
    } else if (priceReductions > 0) {
      discountFactor -= 0.02;
    }

    return Math.round(listedPrice * discountFactor);
  }

  /**
   * Scan Zoopla for stale listings
   */
  async scanZoopla(postcodeArea: string): Promise<StaleListing[]> {
    const listings: StaleListing[] = [];
    let page: Page | null = null;

    try {
      const browser = await this.initBrowser();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      page = await context.newPage();

      // Search URL for the postcode area
      const searchUrl = `https://www.zoopla.co.uk/for-sale/property/${postcodeArea.toLowerCase()}/?price_min=${this.settings.minPrice}&price_max=${this.settings.maxPrice}`;

      console.log(`Scanning Zoopla for ${postcodeArea}...`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for listings to load
      await page.waitForTimeout(2000);

      // Extract listing data
      const listingElements = await page.locator('[data-testid="search-result"]').all();

      for (const element of listingElements.slice(0, 20)) { // Limit to first 20 results
        try {
          const address = await element.locator('[data-testid="listing-title"]').textContent() || '';
          const priceText = await element.locator('[data-testid="listing-price"]').textContent() || '0';
          const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

          // Get listing link and ID
          const link = await element.locator('a').first().getAttribute('href') || '';
          const portalListingId = link.match(/details\/(\d+)/)?.[1] || `ZPL${Date.now()}`;

          // Check listed date (would need to visit detail page for accurate data)
          // For now, estimate based on available info
          const listedDateText = await element.locator('[data-testid="listing-date"]').textContent().catch(() => '');

          let daysOnMarket = 0;
          if (listedDateText?.includes('month')) {
            const months = parseInt(listedDateText.match(/(\d+)/)?.[1] || '0');
            daysOnMarket = months * 30;
          } else if (listedDateText?.includes('day')) {
            daysOnMarket = parseInt(listedDateText.match(/(\d+)/)?.[1] || '0');
          }

          // Only include if meets minimum days criteria
          if (daysOnMarket >= this.settings.minDaysOnMarket && price >= this.settings.minPrice && price <= this.settings.maxPrice) {
            const estimatedValue = this.estimateMarketValue(price, daysOnMarket, 0);

            listings.push({
              portal: 'zoopla',
              portalListingId,
              address: address.trim(),
              postcode: postcodeArea,
              price,
              propertyType: 'unknown',
              bedrooms: 0,
              bathrooms: 0,
              daysOnMarket,
              listedDate: new Date(Date.now() - daysOnMarket * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              agentName: 'Unknown Agent',
              priceHistory: [{ date: new Date().toISOString().split('T')[0], price }],
              status: 'new',
              contactAttempts: 0,
              estimatedMarketValue: estimatedValue,
              cashOfferPrice: this.calculateCashOffer(estimatedValue)
            });
          }
        } catch (err) {
          console.error('Error parsing listing:', err);
        }
      }

      await context.close();
      console.log(`Found ${listings.length} stale listings in ${postcodeArea} on Zoopla`);

    } catch (error) {
      console.error(`Error scanning Zoopla for ${postcodeArea}:`, error);
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }

    return listings;
  }

  /**
   * Scan Rightmove for stale listings
   */
  async scanRightmove(postcodeArea: string): Promise<StaleListing[]> {
    const listings: StaleListing[] = [];
    let page: Page | null = null;

    try {
      const browser = await this.initBrowser();
      const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      page = await context.newPage();

      // Search URL for the postcode area
      const searchUrl = `https://www.rightmove.co.uk/property-for-sale/find.html?searchLocation=${postcodeArea}&minPrice=${this.settings.minPrice}&maxPrice=${this.settings.maxPrice}`;

      console.log(`Scanning Rightmove for ${postcodeArea}...`);
      await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait for listings to load
      await page.waitForTimeout(2000);

      // Extract listing data
      const listingElements = await page.locator('.propertyCard').all();

      for (const element of listingElements.slice(0, 20)) { // Limit to first 20 results
        try {
          const address = await element.locator('.propertyCard-address').textContent() || '';
          const priceText = await element.locator('.propertyCard-priceValue').textContent() || '0';
          const price = parseInt(priceText.replace(/[^0-9]/g, '')) || 0;

          // Get listing ID
          const link = await element.locator('a').first().getAttribute('href') || '';
          const portalListingId = link.match(/properties\/(\d+)/)?.[1] || `RM${Date.now()}`;

          // Check added/reduced date
          const dateText = await element.locator('.propertyCard-branchSummary-addedOrReduced').textContent().catch(() => '');

          let daysOnMarket = 0;
          if (dateText?.toLowerCase().includes('added')) {
            // Parse the date
            const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (dateMatch) {
              const listedDate = new Date(`${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}`);
              daysOnMarket = Math.floor((Date.now() - listedDate.getTime()) / (24 * 60 * 60 * 1000));
            }
          }

          // Only include if meets minimum days criteria
          if (daysOnMarket >= this.settings.minDaysOnMarket && price >= this.settings.minPrice && price <= this.settings.maxPrice) {
            const estimatedValue = this.estimateMarketValue(price, daysOnMarket, 0);

            listings.push({
              portal: 'rightmove',
              portalListingId,
              address: address.trim(),
              postcode: postcodeArea,
              price,
              propertyType: 'unknown',
              bedrooms: 0,
              bathrooms: 0,
              daysOnMarket,
              listedDate: new Date(Date.now() - daysOnMarket * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              agentName: 'Unknown Agent',
              priceHistory: [{ date: new Date().toISOString().split('T')[0], price }],
              status: 'new',
              contactAttempts: 0,
              estimatedMarketValue: estimatedValue,
              cashOfferPrice: this.calculateCashOffer(estimatedValue)
            });
          }
        } catch (err) {
          console.error('Error parsing listing:', err);
        }
      }

      await context.close();
      console.log(`Found ${listings.length} stale listings in ${postcodeArea} on Rightmove`);

    } catch (error) {
      console.error(`Error scanning Rightmove for ${postcodeArea}:`, error);
    } finally {
      if (page) {
        await page.close().catch(() => {});
      }
    }

    return listings;
  }

  /**
   * Run full scan across all configured portals and postcode areas
   */
  async runFullScan(): Promise<{ newListings: number; totalListings: number }> {
    console.log('Starting full stale listing scan...');
    const allListings: StaleListing[] = [];

    for (const postcodeArea of this.settings.postcodeAreas) {
      if (this.settings.portals.includes('zoopla')) {
        const zooplaListings = await this.scanZoopla(postcodeArea);
        allListings.push(...zooplaListings);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
      }

      if (this.settings.portals.includes('rightmove')) {
        const rightmoveListings = await this.scanRightmove(postcodeArea);
        allListings.push(...rightmoveListings);
        await new Promise(resolve => setTimeout(resolve, 2000)); // Rate limiting
      }
    }

    // Deduplicate by address
    const uniqueListings = new Map<string, StaleListing>();
    for (const listing of allListings) {
      const key = `${listing.address}-${listing.postcode}`.toLowerCase();
      if (!uniqueListings.has(key)) {
        uniqueListings.set(key, listing);
      }
    }

    // Count new listings (not already in our map)
    let newCount = 0;
    const entries = Array.from(uniqueListings.entries());
    for (const [key, listing] of entries) {
      if (!this.staleListings.has(key)) {
        newCount++;
      }
      this.staleListings.set(key, listing);
    }

    console.log(`Scan complete: ${newCount} new listings, ${this.staleListings.size} total`);

    return {
      newListings: newCount,
      totalListings: this.staleListings.size
    };
  }

  /**
   * Get all stale listings
   */
  getStaleListings(): StaleListing[] {
    return Array.from(this.staleListings.values());
  }

  /**
   * Get stale listing by ID
   */
  getListingById(portalListingId: string): StaleListing | undefined {
    const listings = Array.from(this.staleListings.values());
    for (const listing of listings) {
      if (listing.portalListingId === portalListingId) {
        return listing;
      }
    }
    return undefined;
  }

  /**
   * Update listing status
   */
  updateListingStatus(portalListingId: string, status: StaleListing['status'], notes?: string): boolean {
    const entries = Array.from(this.staleListings.entries());
    for (const [key, listing] of entries) {
      if (listing.portalListingId === portalListingId) {
        listing.status = status;
        if (notes) listing.notes = notes;
        if (status === 'contacted') {
          listing.contactAttempts++;
          listing.lastContactDate = new Date().toISOString();
        }
        this.staleListings.set(key, listing);
        return true;
      }
    }
    return false;
  }

  /**
   * Generate cash offer letter content
   */
  generateOfferLetter(listing: StaleListing): string {
    const formattedPrice = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(listing.cashOfferPrice);

    const formattedMarketValue = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(listing.estimatedMarketValue);

    return `
JOHN BARCLAY ESTATE & MANAGEMENT
123 High Street, London W9 1AB
Tel: 020 7123 4567

${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}

Dear Property Owner,

Re: ${listing.address}, ${listing.postcode}

We notice your property has been on the market for ${listing.daysOnMarket} days. We understand that selling a property can be stressful, especially when it takes longer than expected.

CASH OFFER: ${formattedPrice}

We would like to make you a guaranteed cash offer for your property, with completion in just ${this.settings.completionDays} days.

OUR OFFER INCLUDES:
• Cash payment - no mortgage delays or chain complications
• Completion in ${this.settings.completionDays} days guaranteed
• No estate agent fees for you to pay
• We cover all legal costs
• No further viewings required
• No surveys or valuations needed

This offer represents ${this.settings.cashOfferPercent}% of the estimated market value (${formattedMarketValue}), reflecting the speed and certainty of a cash transaction compared to the traditional 6-9 month selling process.

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
  }

  /**
   * Record offer sent
   */
  recordOfferSent(portalListingId: string, method: 'post' | 'email' | 'whatsapp'): boolean {
    const listing = this.getListingById(portalListingId);
    if (listing) {
      return this.updateListingStatus(portalListingId, 'contacted', `Offer sent via ${method} on ${new Date().toISOString()}`);
    }
    return false;
  }

  /**
   * Cleanup browser resources
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

// Export singleton instance
export const leadGenerationService = new LeadGenerationService();
