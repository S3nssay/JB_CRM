import { chromium, Browser, Page } from 'playwright';
import { db } from './db';
import { properties } from '@shared/schema';
import { eq } from 'drizzle-orm';

/**
 * John Barclay Website Import Service
 * Scrapes properties from johnbarclay.co.uk and imports them into the database
 */

export interface ScrapedProperty {
  websiteId: string; // The ID from the website URL (e.g., "1263")
  isRental: boolean; // true = rental, false = sale
  title: string;
  description: string;
  price: number; // in pence
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  receptions: number;
  addressLine1: string;
  postcode: string;
  tenure?: string;
  leaseYears?: number;
  serviceCharge?: number;
  features: string[];
  images: string[];
  status: string; // 'active', 'under_offer', 'sold'
  latitude?: number;
  longitude?: number;
}

export interface ImportResult {
  success: boolean;
  message: string;
  totalFound: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

const BASE_URL = 'https://johnbarclay.co.uk';

export class WebsiteImportService {
  private browser: Browser | null = null;

  private async getBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  /**
   * Scrape all sales listings from the website
   */
  async scrapeSalesListings(): Promise<ScrapedProperty[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const allProperties: ScrapedProperty[] = [];

    try {
      // Fetch the sales page with 50 items per page
      const url = `${BASE_URL}/properties/for/sale/num_pages/50`;
      console.log(`Fetching: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      // Get all property links from the listing page
      const propertyLinks = await page.evaluate(() => {
        const links: string[] = [];
        // Find all links that go to /property/[id]/
        document.querySelectorAll('a[href*="/property/"]').forEach((el) => {
          const href = el.getAttribute('href');
          if (href && href.match(/\/property\/\d+/)) {
            // Extract just the /property/ID part
            const match = href.match(/\/property\/(\d+)/);
            if (match) {
              const propertyUrl = `/property/${match[1]}/`;
              if (!links.includes(propertyUrl)) {
                links.push(propertyUrl);
              }
            }
          }
        });
        return links;
      });

      console.log(`Found ${propertyLinks.length} property links`);

      // Scrape each property detail page
      for (const link of propertyLinks) {
        try {
          const property = await this.scrapePropertyDetail(page, link, 'sale');
          if (property) {
            allProperties.push(property);
            console.log(`Scraped: ${property.addressLine1} - £${property.price / 100}`);
          }
          // Be polite - wait between requests
          await page.waitForTimeout(500);
        } catch (err: any) {
          console.error(`Error scraping ${link}: ${err.message}`);
        }
      }

    } finally {
      await page.close();
    }

    return allProperties;
  }

  /**
   * Scrape all rental listings from the website
   */
  async scrapeRentalListings(): Promise<ScrapedProperty[]> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const allProperties: ScrapedProperty[] = [];

    try {
      const url = `${BASE_URL}/properties/for/rent/num_pages/50`;
      console.log(`Fetching: ${url}`);

      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);

      const propertyLinks = await page.evaluate(() => {
        const links: string[] = [];
        document.querySelectorAll('a[href*="/property/"]').forEach((el) => {
          const href = el.getAttribute('href');
          if (href && href.match(/\/property\/\d+/)) {
            const match = href.match(/\/property\/(\d+)/);
            if (match) {
              const propertyUrl = `/property/${match[1]}/`;
              if (!links.includes(propertyUrl)) {
                links.push(propertyUrl);
              }
            }
          }
        });
        return links;
      });

      console.log(`Found ${propertyLinks.length} rental property links`);

      for (const link of propertyLinks) {
        try {
          const property = await this.scrapePropertyDetail(page, link, 'rental');
          if (property) {
            allProperties.push(property);
            console.log(`Scraped: ${property.addressLine1} - £${property.price / 100}`);
          }
          await page.waitForTimeout(500);
        } catch (err: any) {
          console.error(`Error scraping ${link}: ${err.message}`);
        }
      }

    } finally {
      await page.close();
    }

    return allProperties;
  }

  /**
   * Scrape a single property detail page
   */
  private async scrapePropertyDetail(
    page: Page,
    propertyPath: string,
    isRental: boolean
  ): Promise<ScrapedProperty | null> {
    const fullUrl = `${BASE_URL}${propertyPath}`;
    await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    // Extract the website ID from the URL
    const idMatch = propertyPath.match(/\/property\/(\d+)/);
    const websiteId = idMatch ? idMatch[1] : '';

    if (!websiteId) {
      console.error(`Could not extract ID from ${propertyPath}`);
      return null;
    }

    // Scrape all the details from the page
    const data = await page.evaluate((baseUrl: string) => {
      const getText = (selector: string): string => {
        const el = document.querySelector(selector);
        return el?.textContent?.trim() || '';
      };

      const getAll = (selector: string): string[] => {
        return Array.from(document.querySelectorAll(selector))
          .map(el => el.textContent?.trim() || '')
          .filter(t => t);
      };

      // Get page content text for parsing
      const pageText = document.body.innerText || '';

      // Extract price - look for £ followed by numbers
      let price = 0;
      const priceMatch = pageText.match(/£([\d,]+)/);
      if (priceMatch) {
        price = parseInt(priceMatch[1].replace(/,/g, '')) * 100; // Convert to pence
      }

      // Extract bedrooms
      let bedrooms = 0;
      const bedMatch = pageText.match(/(\d+)\s*(?:bed|bedroom)/i);
      if (bedMatch) {
        bedrooms = parseInt(bedMatch[1]);
      }

      // Extract bathrooms
      let bathrooms = 0;
      const bathMatch = pageText.match(/(\d+)\s*(?:bath|bathroom)/i);
      if (bathMatch) {
        bathrooms = parseInt(bathMatch[1]);
      }

      // Extract receptions
      let receptions = 0;
      const recMatch = pageText.match(/(\d+)\s*(?:reception|living|lounge)/i);
      if (recMatch) {
        receptions = parseInt(recMatch[1]);
      }

      // Extract property type
      let propertyType = 'flat';
      if (pageText.toLowerCase().includes('house')) propertyType = 'house';
      else if (pageText.toLowerCase().includes('maisonette')) propertyType = 'maisonette';
      else if (pageText.toLowerCase().includes('studio')) propertyType = 'studio';
      else if (pageText.toLowerCase().includes('penthouse')) propertyType = 'penthouse';
      else if (pageText.toLowerCase().includes('bungalow')) propertyType = 'bungalow';

      // Extract postcode - UK postcode pattern
      let postcode = '';
      const postcodeMatch = pageText.match(/([A-Z]{1,2}\d{1,2}[A-Z]?\s*\d[A-Z]{2})/i);
      if (postcodeMatch) {
        postcode = postcodeMatch[1].toUpperCase();
      }

      // Extract address - usually near the postcode or in headings
      let addressLine1 = '';
      const h1 = document.querySelector('h1');
      const h2 = document.querySelector('h2');
      if (h1?.textContent) {
        addressLine1 = h1.textContent.trim();
      } else if (h2?.textContent) {
        addressLine1 = h2.textContent.trim();
      }
      // Clean up address
      if (!addressLine1 && postcode) {
        // Try to find text near the postcode
        const nearPostcode = pageText.match(new RegExp(`([^\\n]{5,50}${postcode})`, 'i'));
        if (nearPostcode) {
          addressLine1 = nearPostcode[1].replace(postcode, '').trim();
        }
      }

      // Extract description - look for the main description paragraph
      let description = '';
      const descEl = document.querySelector('.property-description, .description, [class*="description"]');
      if (descEl) {
        description = descEl.textContent?.trim() || '';
      } else {
        // Find paragraphs with substantial text
        const paragraphs = document.querySelectorAll('p');
        for (const p of paragraphs) {
          const text = p.textContent?.trim() || '';
          if (text.length > 100 && !text.includes('©') && !text.includes('cookie')) {
            description = text;
            break;
          }
        }
      }

      // Extract lease years
      let leaseYears: number | undefined;
      const leaseMatch = pageText.match(/(\d+)\s*years?\s*(?:remaining|lease)/i);
      if (leaseMatch) {
        leaseYears = parseInt(leaseMatch[1]);
      }

      // Extract service charge
      let serviceCharge: number | undefined;
      const serviceMatch = pageText.match(/service\s*charge[:\s]*£?([\d,]+)/i);
      if (serviceMatch) {
        serviceCharge = parseInt(serviceMatch[1].replace(/,/g, '')) * 100;
      }

      // Extract status
      let status = 'active';
      if (pageText.toLowerCase().includes('under offer')) status = 'under_offer';
      else if (pageText.toLowerCase().includes('sold')) status = 'sold';
      else if (pageText.toLowerCase().includes('let agreed')) status = 'let';

      // Extract images
      const images: string[] = [];
      document.querySelectorAll('img[src*="/properties/"]').forEach((img) => {
        let src = img.getAttribute('src') || '';
        // Convert thumbs to photos for full size
        src = src.replace('/thumbs/', '/photos/');
        if (src && !src.includes('logo') && !images.includes(src)) {
          // Make absolute URL
          if (src.startsWith('/')) {
            src = baseUrl + src;
          }
          images.push(src);
        }
      });

      // Also check for gallery images
      document.querySelectorAll('[data-src*="/properties/"], [href*="/properties/"]').forEach((el) => {
        let src = el.getAttribute('data-src') || el.getAttribute('href') || '';
        src = src.replace('/thumbs/', '/photos/');
        if (src && src.includes('/photos/') && !images.includes(src)) {
          if (src.startsWith('/')) {
            src = baseUrl + src;
          }
          images.push(src);
        }
      });

      // Extract features
      const features: string[] = [];
      document.querySelectorAll('li, .feature').forEach((el) => {
        const text = el.textContent?.trim() || '';
        if (text.length > 3 && text.length < 100 && !text.includes('£')) {
          features.push(text);
        }
      });

      // Extract coordinates if available
      let latitude: number | undefined;
      let longitude: number | undefined;
      const scripts = document.querySelectorAll('script');
      scripts.forEach((script) => {
        const content = script.textContent || '';
        const latMatch = content.match(/lat[itude]*['":\s]+(-?\d+\.?\d*)/i);
        const lngMatch = content.match(/lng|lon[gitude]*['":\s]+(-?\d+\.?\d*)/i);
        if (latMatch) latitude = parseFloat(latMatch[1]);
        if (lngMatch) longitude = parseFloat(lngMatch[1]);
      });

      return {
        price,
        bedrooms,
        bathrooms,
        receptions,
        propertyType,
        postcode,
        addressLine1,
        description,
        leaseYears,
        serviceCharge,
        status,
        images,
        features,
        latitude,
        longitude
      };
    }, BASE_URL);

    if (!data.price || !data.postcode) {
      console.warn(`Incomplete data for ${propertyPath}: price=${data.price}, postcode=${data.postcode}`);
    }

    return {
      websiteId,
      isRental,
      title: `${data.bedrooms} Bedroom ${data.propertyType} in ${data.postcode}`,
      description: data.description,
      price: data.price,
      propertyType: data.propertyType,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      receptions: data.receptions,
      addressLine1: data.addressLine1 || data.postcode,
      postcode: data.postcode,
      tenure: data.leaseYears ? 'leasehold' : undefined,
      leaseYears: data.leaseYears,
      serviceCharge: data.serviceCharge,
      features: data.features.slice(0, 20), // Limit features
      images: data.images.slice(0, 20), // Limit images
      status: data.status,
      latitude: data.latitude,
      longitude: data.longitude
    };
  }

  /**
   * Import scraped properties into the database
   */
  async importToDatabase(scrapedProperties: ScrapedProperty[]): Promise<ImportResult> {
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const prop of scrapedProperties) {
      try {
        // Check if property already exists by matching postcode and address
        const existing = await db.select()
          .from(properties)
          .where(eq(properties.postcode, prop.postcode))
          .limit(10);

        // Find exact match by address similarity
        const match = existing.find(e =>
          e.addressLine1.toLowerCase().includes(prop.addressLine1.toLowerCase()) ||
          prop.addressLine1.toLowerCase().includes(e.addressLine1.toLowerCase())
        );

        if (match) {
          // Update existing property
          await db.update(properties)
            .set({
              price: prop.price,
              status: prop.status,
              description: prop.description || match.description,
              bedrooms: prop.bedrooms || match.bedrooms,
              bathrooms: prop.bathrooms || match.bathrooms,
              images: prop.images.length > 0 ? prop.images : match.images,
              features: prop.features.length > 0 ? prop.features : match.features,
              updatedAt: new Date()
            })
            .where(eq(properties.id, match.id));
          updated++;
        } else {
          // Insert new property
          await db.insert(properties).values({
            isRental: prop.isRental,
            isResidential: true,
            status: prop.status,
            title: prop.title,
            description: prop.description || `${prop.bedrooms} bedroom ${prop.propertyType} ${prop.isRental ? 'to rent' : 'for sale'}`,
            price: prop.price,
            propertyType: prop.propertyType,
            bedrooms: prop.bedrooms,
            bathrooms: prop.bathrooms,
            receptions: prop.receptions,
            addressLine1: prop.addressLine1,
            postcode: prop.postcode,
            tenure: prop.tenure || 'leasehold',
            features: prop.features,
            images: prop.images,
            latitude: prop.latitude?.toString(),
            longitude: prop.longitude?.toString(),
            isListed: true
          });
          imported++;
        }
      } catch (err: any) {
        console.error(`Error importing ${prop.postcode}: ${err.message}`);
        errors.push(`${prop.postcode}: ${err.message}`);
        skipped++;
      }
    }

    return {
      success: errors.length === 0,
      message: `Import complete. Imported: ${imported}, Updated: ${updated}, Skipped: ${skipped}`,
      totalFound: scrapedProperties.length,
      imported,
      updated,
      skipped,
      errors
    };
  }

  /**
   * Full sync - scrape and import sales listings
   */
  async syncSalesListings(): Promise<ImportResult> {
    console.log('Starting sales listings sync...');

    try {
      const scraped = await this.scrapeSalesListings();
      console.log(`Scraped ${scraped.length} sales properties`);

      if (scraped.length === 0) {
        return {
          success: false,
          message: 'No properties found on the website',
          totalFound: 0,
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: ['No properties scraped from website']
        };
      }

      const result = await this.importToDatabase(scraped);
      return result;
    } catch (err: any) {
      return {
        success: false,
        message: `Sync failed: ${err.message}`,
        totalFound: 0,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [err.message]
      };
    }
  }

  /**
   * Full sync - scrape and import rental listings
   */
  async syncRentalListings(): Promise<ImportResult> {
    console.log('Starting rental listings sync...');

    try {
      const scraped = await this.scrapeRentalListings();
      console.log(`Scraped ${scraped.length} rental properties`);

      if (scraped.length === 0) {
        return {
          success: false,
          message: 'No properties found on the website',
          totalFound: 0,
          imported: 0,
          updated: 0,
          skipped: 0,
          errors: ['No properties scraped from website']
        };
      }

      const result = await this.importToDatabase(scraped);
      return result;
    } catch (err: any) {
      return {
        success: false,
        message: `Sync failed: ${err.message}`,
        totalFound: 0,
        imported: 0,
        updated: 0,
        skipped: 0,
        errors: [err.message]
      };
    }
  }

  /**
   * Sync both sales and rentals
   */
  async syncAllListings(): Promise<{ sales: ImportResult; rentals: ImportResult }> {
    const sales = await this.syncSalesListings();
    const rentals = await this.syncRentalListings();
    return { sales, rentals };
  }

  /**
   * Cleanup browser
   */
  async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

// Export singleton
export const websiteImport = new WebsiteImportService();
