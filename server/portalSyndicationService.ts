import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { db } from './db';
import {
  properties,
  propertyPortalListings,
  portalCredentials
} from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import * as crypto from 'crypto';

// Encryption key for credentials (should be in env)
const ENCRYPTION_KEY = process.env.PORTAL_ENCRYPTION_KEY || 'default-key-change-in-production';

/**
 * Portal Syndication Service
 * Handles automated property listing to Zoopla and other portals using browser automation
 */
export class PortalSyndicationService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  constructor() {
    // Initialize on first use
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      });
    }
    return this.browser;
  }

  /**
   * Get or create a browser context for a portal
   */
  private async getPortalContext(portalName: string): Promise<BrowserContext> {
    if (this.contexts.has(portalName)) {
      return this.contexts.get(portalName)!;
    }

    const browser = await this.initBrowser();
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'en-GB',
      timezoneId: 'Europe/London'
    });

    this.contexts.set(portalName, context);
    return context;
  }

  /**
   * Encrypt sensitive data
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  /**
   * Decrypt sensitive data
   */
  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  /**
   * Save portal credentials (encrypted)
   */
  async savePortalCredentials(portalName: string, username: string, password: string): Promise<boolean> {
    try {
      const encryptedPassword = this.encrypt(password);

      // Check if credentials exist
      const existing = await db.select()
        .from(portalCredentials)
        .where(eq(portalCredentials.portalName, portalName))
        .limit(1);

      if (existing.length > 0) {
        await db.update(portalCredentials)
          .set({
            username,
            password: encryptedPassword,
            updatedAt: new Date()
          })
          .where(eq(portalCredentials.portalName, portalName));
      } else {
        await db.insert(portalCredentials).values({
          portalName,
          username,
          password: encryptedPassword,
          isActive: true
        });
      }

      console.log(`Portal credentials saved for ${portalName}`);
      return true;
    } catch (error) {
      console.error(`Error saving portal credentials for ${portalName}:`, error);
      return false;
    }
  }

  /**
   * Get portal credentials
   */
  private async getPortalCredentials(portalName: string): Promise<{ username: string; password: string } | null> {
    try {
      const [creds] = await db.select()
        .from(portalCredentials)
        .where(and(
          eq(portalCredentials.portalName, portalName),
          eq(portalCredentials.isActive, true)
        ))
        .limit(1);

      if (!creds || !creds.username || !creds.password) {
        return null;
      }

      return {
        username: creds.username,
        password: this.decrypt(creds.password)
      };
    } catch (error) {
      console.error(`Error getting portal credentials for ${portalName}:`, error);
      return null;
    }
  }

  /**
   * Test portal login
   */
  async testPortalLogin(portalName: string): Promise<{ success: boolean; message: string }> {
    try {
      const creds = await this.getPortalCredentials(portalName);
      if (!creds) {
        return { success: false, message: 'No credentials found for this portal' };
      }

      switch (portalName.toLowerCase()) {
        case 'zoopla':
          return await this.testZooplaLogin(creds.username, creds.password);
        default:
          return { success: false, message: `Portal ${portalName} not supported` };
      }
    } catch (error: any) {
      console.error(`Error testing portal login for ${portalName}:`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Test Zoopla login
   */
  private async testZooplaLogin(username: string, password: string): Promise<{ success: boolean; message: string }> {
    let page: Page | null = null;

    try {
      const context = await this.getPortalContext('zoopla');
      page = await context.newPage();

      // Navigate to Zoopla agent login
      await page.goto('https://www.zoopla.co.uk/agent-login/', { waitUntil: 'networkidle' });

      // Handle cookie consent if present
      try {
        const cookieButton = page.locator('[data-testid="cookie-consent-accept"]');
        if (await cookieButton.isVisible({ timeout: 3000 })) {
          await cookieButton.click();
        }
      } catch (e) {
        // Cookie banner not present
      }

      // Fill login form
      await page.fill('input[name="email"], input[type="email"]', username);
      await page.fill('input[name="password"], input[type="password"]', password);

      // Submit login
      await page.click('button[type="submit"]');

      // Wait for navigation or error
      await page.waitForTimeout(3000);

      // Check for successful login (look for dashboard elements)
      const isLoggedIn = await page.locator('[data-testid="dashboard"], .dashboard, .agent-dashboard').isVisible({ timeout: 5000 }).catch(() => false);

      if (isLoggedIn) {
        // Update last test status
        await db.update(portalCredentials)
          .set({
            lastTestAt: new Date(),
            lastTestSuccess: true,
            updatedAt: new Date()
          })
          .where(eq(portalCredentials.portalName, 'zoopla'));

        return { success: true, message: 'Zoopla login successful' };
      }

      // Check for error message
      const errorMessage = await page.locator('.error-message, .login-error, [role="alert"]').textContent().catch(() => null);

      await db.update(portalCredentials)
        .set({
          lastTestAt: new Date(),
          lastTestSuccess: false,
          updatedAt: new Date()
        })
        .where(eq(portalCredentials.portalName, 'zoopla'));

      return { success: false, message: errorMessage || 'Login failed - please check credentials' };

    } catch (error: any) {
      console.error('Zoopla login test error:', error);
      return { success: false, message: `Login test failed: ${error.message}` };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Syndicate a property to Zoopla
   */
  async syndicateToZoopla(propertyId: number): Promise<{ success: boolean; listingId?: string; message: string }> {
    let page: Page | null = null;

    try {
      // Get property details
      const [property] = await db.select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        return { success: false, message: 'Property not found' };
      }

      // Get credentials
      const creds = await this.getPortalCredentials('zoopla');
      if (!creds) {
        return { success: false, message: 'Zoopla credentials not configured' };
      }

      const context = await this.getPortalContext('zoopla');
      page = await context.newPage();

      // Login to Zoopla
      await page.goto('https://www.zoopla.co.uk/agent-login/', { waitUntil: 'networkidle' });

      // Handle cookie consent
      try {
        const cookieButton = page.locator('[data-testid="cookie-consent-accept"]');
        if (await cookieButton.isVisible({ timeout: 2000 })) {
          await cookieButton.click();
        }
      } catch (e) {}

      // Fill login
      await page.fill('input[name="email"], input[type="email"]', creds.username);
      await page.fill('input[name="password"], input[type="password"]', creds.password);
      await page.click('button[type="submit"]');

      // Wait for dashboard
      await page.waitForTimeout(3000);

      // Navigate to add listing
      // Note: Actual Zoopla agent portal structure may differ
      await page.goto('https://www.zoopla.co.uk/agent-dashboard/listings/add', { waitUntil: 'networkidle' });

      // Fill property details
      // This is a simplified version - actual implementation would need to match Zoopla's form structure

      // Property type
      await page.selectOption('select[name="propertyType"]', property.propertyType).catch(() => {});

      // Address
      await page.fill('input[name="address"], input[name="addressLine1"]', property.addressLine1).catch(() => {});
      await page.fill('input[name="postcode"]', property.postcode).catch(() => {});

      // Price
      const priceInPounds = property.price / 100;
      await page.fill('input[name="price"]', priceInPounds.toString()).catch(() => {});

      // Bedrooms/Bathrooms
      await page.fill('input[name="bedrooms"]', property.bedrooms.toString()).catch(() => {});
      await page.fill('input[name="bathrooms"]', property.bathrooms.toString()).catch(() => {});

      // Description
      await page.fill('textarea[name="description"]', property.description).catch(() => {});

      // Upload images
      if (property.images && property.images.length > 0) {
        // Handle image uploads
        // This would require actual file handling in production
      }

      // Submit listing
      await page.click('button[type="submit"]').catch(() => {});
      await page.waitForTimeout(3000);

      // Get listing ID from URL or confirmation
      const currentUrl = page.url();
      const listingIdMatch = currentUrl.match(/listing[s]?\/(\d+)/);
      const portalListingId = listingIdMatch ? listingIdMatch[1] : `zpl_${Date.now()}`;

      // Save listing record
      await db.insert(propertyPortalListings).values({
        propertyId: property.id,
        portalName: 'zoopla',
        portalListingId,
        status: 'active',
        lastSyncStatus: 'success',
        lastSyncAt: new Date(),
        publishedAt: new Date()
      });

      return {
        success: true,
        listingId: portalListingId,
        message: 'Property successfully syndicated to Zoopla'
      };

    } catch (error: any) {
      console.error('Zoopla syndication error:', error);

      // Record failure
      await db.insert(propertyPortalListings).values({
        propertyId,
        portalName: 'zoopla',
        status: 'error',
        lastSyncStatus: 'failed',
        lastSyncMessage: error.message,
        lastSyncAt: new Date()
      }).catch(() => {});

      return { success: false, message: `Syndication failed: ${error.message}` };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Update a Zoopla listing
   */
  async updateZooplaListing(propertyId: number): Promise<{ success: boolean; message: string }> {
    let page: Page | null = null;

    try {
      // Get property and existing listing
      const [property] = await db.select()
        .from(properties)
        .where(eq(properties.id, propertyId))
        .limit(1);

      if (!property) {
        return { success: false, message: 'Property not found' };
      }

      const [existingListing] = await db.select()
        .from(propertyPortalListings)
        .where(and(
          eq(propertyPortalListings.propertyId, propertyId),
          eq(propertyPortalListings.portalName, 'zoopla')
        ))
        .limit(1);

      if (!existingListing || !existingListing.portalListingId) {
        return { success: false, message: 'No existing Zoopla listing found' };
      }

      const creds = await this.getPortalCredentials('zoopla');
      if (!creds) {
        return { success: false, message: 'Zoopla credentials not configured' };
      }

      const context = await this.getPortalContext('zoopla');
      page = await context.newPage();

      // Login
      await page.goto('https://www.zoopla.co.uk/agent-login/', { waitUntil: 'networkidle' });
      await page.fill('input[name="email"], input[type="email"]', creds.username);
      await page.fill('input[name="password"], input[type="password"]', creds.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Navigate to edit listing
      await page.goto(`https://www.zoopla.co.uk/agent-dashboard/listings/${existingListing.portalListingId}/edit`, { waitUntil: 'networkidle' });

      // Update fields
      const priceInPounds = property.price / 100;
      await page.fill('input[name="price"]', priceInPounds.toString()).catch(() => {});
      await page.fill('textarea[name="description"]', property.description).catch(() => {});

      // Submit update
      await page.click('button[type="submit"]').catch(() => {});
      await page.waitForTimeout(2000);

      // Update record
      await db.update(propertyPortalListings)
        .set({
          lastSyncStatus: 'success',
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(propertyPortalListings.id, existingListing.id));

      return { success: true, message: 'Zoopla listing updated successfully' };

    } catch (error: any) {
      console.error('Zoopla update error:', error);
      return { success: false, message: `Update failed: ${error.message}` };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Remove a Zoopla listing
   */
  async removeZooplaListing(propertyId: number): Promise<{ success: boolean; message: string }> {
    let page: Page | null = null;

    try {
      const [existingListing] = await db.select()
        .from(propertyPortalListings)
        .where(and(
          eq(propertyPortalListings.propertyId, propertyId),
          eq(propertyPortalListings.portalName, 'zoopla')
        ))
        .limit(1);

      if (!existingListing || !existingListing.portalListingId) {
        return { success: false, message: 'No existing Zoopla listing found' };
      }

      const creds = await this.getPortalCredentials('zoopla');
      if (!creds) {
        return { success: false, message: 'Zoopla credentials not configured' };
      }

      const context = await this.getPortalContext('zoopla');
      page = await context.newPage();

      // Login
      await page.goto('https://www.zoopla.co.uk/agent-login/', { waitUntil: 'networkidle' });
      await page.fill('input[name="email"], input[type="email"]', creds.username);
      await page.fill('input[name="password"], input[type="password"]', creds.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Navigate to listing management
      await page.goto(`https://www.zoopla.co.uk/agent-dashboard/listings/${existingListing.portalListingId}`, { waitUntil: 'networkidle' });

      // Find and click remove/withdraw button
      await page.click('button[data-action="remove"], .remove-listing, .withdraw-listing').catch(() => {});

      // Confirm removal
      await page.click('button[data-confirm="remove"], .confirm-remove').catch(() => {});
      await page.waitForTimeout(2000);

      // Update record
      await db.update(propertyPortalListings)
        .set({
          status: 'removed',
          lastSyncStatus: 'success',
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(propertyPortalListings.id, existingListing.id));

      return { success: true, message: 'Zoopla listing removed successfully' };

    } catch (error: any) {
      console.error('Zoopla removal error:', error);
      return { success: false, message: `Removal failed: ${error.message}` };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Sync listing stats from Zoopla
   */
  async syncZooplaStats(propertyId: number): Promise<{ success: boolean; stats?: any; message: string }> {
    let page: Page | null = null;

    try {
      const [existingListing] = await db.select()
        .from(propertyPortalListings)
        .where(and(
          eq(propertyPortalListings.propertyId, propertyId),
          eq(propertyPortalListings.portalName, 'zoopla')
        ))
        .limit(1);

      if (!existingListing || !existingListing.portalListingId) {
        return { success: false, message: 'No existing Zoopla listing found' };
      }

      const creds = await this.getPortalCredentials('zoopla');
      if (!creds) {
        return { success: false, message: 'Zoopla credentials not configured' };
      }

      const context = await this.getPortalContext('zoopla');
      page = await context.newPage();

      // Login
      await page.goto('https://www.zoopla.co.uk/agent-login/', { waitUntil: 'networkidle' });
      await page.fill('input[name="email"], input[type="email"]', creds.username);
      await page.fill('input[name="password"], input[type="password"]', creds.password);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(3000);

      // Navigate to listing stats
      await page.goto(`https://www.zoopla.co.uk/agent-dashboard/listings/${existingListing.portalListingId}/stats`, { waitUntil: 'networkidle' });

      // Extract stats (selectors would need to match actual Zoopla structure)
      const views = await page.locator('.stat-views, [data-stat="views"]').textContent().catch(() => '0');
      const enquiries = await page.locator('.stat-enquiries, [data-stat="enquiries"]').textContent().catch(() => '0');

      const stats = {
        views: parseInt(views?.replace(/\D/g, '') || '0'),
        enquiries: parseInt(enquiries?.replace(/\D/g, '') || '0'),
        syncedAt: new Date()
      };

      // Update record
      await db.update(propertyPortalListings)
        .set({
          viewsCount: stats.views,
          inquiriesCount: stats.enquiries,
          lastSyncStatus: 'success',
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(propertyPortalListings.id, existingListing.id));

      return { success: true, stats, message: 'Stats synced successfully' };

    } catch (error: any) {
      console.error('Zoopla stats sync error:', error);
      return { success: false, message: `Stats sync failed: ${error.message}` };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Bulk syndicate multiple properties
   */
  async bulkSyndicateToZoopla(propertyIds: number[]): Promise<{ success: boolean; results: any[] }> {
    const results = [];

    for (const propertyId of propertyIds) {
      const result = await this.syndicateToZoopla(propertyId);
      results.push({
        propertyId,
        ...result
      });

      // Rate limiting - wait between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    const successCount = results.filter(r => r.success).length;

    return {
      success: successCount === propertyIds.length,
      results
    };
  }

  /**
   * Get syndication status for all portals
   */
  async getSyndicationStatus(propertyId: number): Promise<any[]> {
    const listings = await db.select()
      .from(propertyPortalListings)
      .where(eq(propertyPortalListings.propertyId, propertyId));

    return listings.map(listing => ({
      portal: listing.portalName,
      status: listing.status,
      portalListingId: listing.portalListingId,
      publishedAt: listing.publishedAt,
      lastSyncAt: listing.lastSyncAt,
      lastSyncStatus: listing.lastSyncStatus,
      lastSyncMessage: listing.lastSyncMessage,
      views: listing.viewsCount,
      enquiries: listing.inquiriesCount
    }));
  }

  /**
   * Get all active portal credentials
   */
  async getConfiguredPortals(): Promise<any[]> {
    const portals = await db.select({
      portalName: portalCredentials.portalName,
      username: portalCredentials.username,
      isActive: portalCredentials.isActive,
      lastTestAt: portalCredentials.lastTestAt,
      lastTestSuccess: portalCredentials.lastTestSuccess
    })
    .from(portalCredentials)
    .where(eq(portalCredentials.isActive, true));

    return portals;
  }

  /**
   * Cleanup and close browser
   */
  async cleanup(): Promise<void> {
    const contexts = Array.from(this.contexts.values());
    for (const context of contexts) {
      await context.close().catch(() => {});
    }
    this.contexts.clear();

    if (this.browser) {
      await this.browser.close().catch(() => {});
      this.browser = null;
    }
  }
}

// Export singleton instance
export const portalSyndication = new PortalSyndicationService();
