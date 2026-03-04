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

/** Per-portal configuration for login URLs, form selectors, etc. */
interface PortalConfig {
  name: string;
  loginUrl: string;
  dashboardUrl: string;
  addListingUrl: string;
  editListingUrlTemplate: string;
  statsUrlTemplate: string;
  cookieSelectors: string[];
  loginSelectors: {
    usernameField: string;
    passwordField: string;
    submitButton: string;
    dashboardIndicator: string;
    errorIndicator: string;
  };
  formSelectors: {
    propertyType: string;
    addressLine1: string;
    postcode: string;
    price: string;
    bedrooms: string;
    bathrooms: string;
    description: string;
    submitButton: string;
    listingType?: string;
    tenure?: string;
    energyRating?: string;
  };
  statsSelectors: {
    views: string;
    enquiries: string;
  };
  removeSelectors: {
    removeButton: string;
    confirmButton: string;
  };
  listingIdPattern: RegExp;
  rateLimit: number;
}

/**
 * Portal Syndication Service
 * Handles automated property listing to Zoopla, Rightmove, and OnTheMarket using browser automation
 */
export class PortalSyndicationService {
  private browser: Browser | null = null;
  private contexts: Map<string, BrowserContext> = new Map();

  /** Portal configuration registry */
  private static readonly PORTAL_CONFIG: Record<string, PortalConfig> = {
    zoopla: {
      name: 'Zoopla',
      loginUrl: 'https://www.zoopla.co.uk/agent-login/',
      dashboardUrl: 'https://www.zoopla.co.uk/agent-dashboard/',
      addListingUrl: 'https://www.zoopla.co.uk/agent-dashboard/listings/add',
      editListingUrlTemplate: 'https://www.zoopla.co.uk/agent-dashboard/listings/{listingId}/edit',
      statsUrlTemplate: 'https://www.zoopla.co.uk/agent-dashboard/listings/{listingId}/stats',
      cookieSelectors: [
        '[data-testid="cookie-consent-accept"]',
        '#onetrust-accept-btn-handler',
        'button:has-text("Accept")'
      ],
      loginSelectors: {
        usernameField: 'input[name="email"], input[type="email"]',
        passwordField: 'input[name="password"], input[type="password"]',
        submitButton: 'button[type="submit"]',
        dashboardIndicator: '[data-testid="dashboard"], .dashboard, .agent-dashboard',
        errorIndicator: '.error-message, .login-error, [role="alert"]'
      },
      formSelectors: {
        propertyType: 'select[name="propertyType"], select[name="property_type"], #propertyType',
        addressLine1: 'input[name="address"], input[name="addressLine1"], #addressLine1',
        postcode: 'input[name="postcode"], #postcode',
        price: 'input[name="price"], #price',
        bedrooms: 'input[name="bedrooms"], select[name="bedrooms"], #bedrooms',
        bathrooms: 'input[name="bathrooms"], select[name="bathrooms"], #bathrooms',
        description: 'textarea[name="description"], #description',
        submitButton: 'button[type="submit"]'
      },
      statsSelectors: {
        views: '.stat-views, [data-stat="views"]',
        enquiries: '.stat-enquiries, [data-stat="enquiries"]'
      },
      removeSelectors: {
        removeButton: 'button[data-action="remove"], .remove-listing, .withdraw-listing',
        confirmButton: 'button[data-confirm="remove"], .confirm-remove'
      },
      listingIdPattern: /listing[s]?\/(\d+)/,
      rateLimit: 2000
    },
    rightmove: {
      name: 'Rightmove',
      loginUrl: 'https://www.rightmoveplus.co.uk/authenticate.html',
      dashboardUrl: 'https://www.rightmoveplus.co.uk/dashboard/',
      addListingUrl: 'https://www.rightmoveplus.co.uk/properties/add',
      editListingUrlTemplate: 'https://www.rightmoveplus.co.uk/properties/{listingId}/edit',
      statsUrlTemplate: 'https://www.rightmoveplus.co.uk/properties/{listingId}/performance',
      cookieSelectors: [
        '#onetrust-accept-btn-handler',
        'button[id*="cookie"]',
        '.cookie-consent-accept',
        'button:has-text("Accept All")',
        'button:has-text("Accept")'
      ],
      loginSelectors: {
        usernameField: 'input[name="email"], input[name="username"], input[type="email"], #email',
        passwordField: 'input[name="password"], input[type="password"], #password',
        submitButton: 'button[type="submit"], input[type="submit"], .login-button',
        dashboardIndicator: '.dashboard, .rmp-dashboard, [class*="dashboard"], [class*="Dashboard"]',
        errorIndicator: '.error-message, .login-error, [role="alert"], .alert-danger'
      },
      formSelectors: {
        propertyType: 'select[name="propertyType"], select[name="property_type"], #propertyType',
        listingType: 'select[name="channel"], input[name="channel"]',
        addressLine1: 'input[name="addressLine1"], input[name="address1"], #addressLine1',
        postcode: 'input[name="postcode"], #postcode',
        price: 'input[name="price"], #price',
        bedrooms: 'input[name="bedrooms"], select[name="bedrooms"], #bedrooms',
        bathrooms: 'input[name="bathrooms"], select[name="bathrooms"], #bathrooms',
        description: 'textarea[name="description"], #description',
        submitButton: 'button[type="submit"], input[type="submit"]',
        tenure: 'select[name="tenure"], #tenure',
        energyRating: 'select[name="epcRating"], #epcRating'
      },
      statsSelectors: {
        views: '.views-count, [data-stat="views"], .property-views',
        enquiries: '.enquiries-count, [data-stat="enquiries"], .property-enquiries'
      },
      removeSelectors: {
        removeButton: 'button[data-action="remove"], .remove-property, .withdraw-button, a:has-text("Remove")',
        confirmButton: 'button[data-confirm], .confirm-remove, button:has-text("Confirm")'
      },
      listingIdPattern: /propert(?:y|ies)\/(\d+)/,
      rateLimit: 2000
    },
    onthemarket: {
      name: 'OnTheMarket',
      loginUrl: 'https://agents.onthemarket.com/login',
      dashboardUrl: 'https://agents.onthemarket.com/dashboard',
      addListingUrl: 'https://agents.onthemarket.com/properties/add',
      editListingUrlTemplate: 'https://agents.onthemarket.com/properties/{listingId}/edit',
      statsUrlTemplate: 'https://agents.onthemarket.com/properties/{listingId}/analytics',
      cookieSelectors: [
        '#onetrust-accept-btn-handler',
        'button[id*="cookie"]',
        '.cookie-accept',
        'button:has-text("Accept All")',
        'button:has-text("Accept")'
      ],
      loginSelectors: {
        usernameField: 'input[name="email"], input[name="username"], input[type="email"], #email',
        passwordField: 'input[name="password"], input[type="password"], #password',
        submitButton: 'button[type="submit"], input[type="submit"], .btn-login',
        dashboardIndicator: '.dashboard, [class*="dashboard"], [class*="Dashboard"], .agent-home',
        errorIndicator: '.error-message, .login-error, [role="alert"], .alert-error'
      },
      formSelectors: {
        propertyType: 'select[name="propertyType"], select[name="property_type"], #propertyType',
        listingType: 'select[name="listingType"], input[name="listingType"]',
        addressLine1: 'input[name="addressLine1"], input[name="address1"], #addressLine1',
        postcode: 'input[name="postcode"], #postcode',
        price: 'input[name="price"], #price',
        bedrooms: 'input[name="bedrooms"], select[name="bedrooms"], #bedrooms',
        bathrooms: 'input[name="bathrooms"], select[name="bathrooms"], #bathrooms',
        description: 'textarea[name="description"], #description',
        submitButton: 'button[type="submit"], input[type="submit"]',
        tenure: 'select[name="tenure"], #tenure',
        energyRating: 'select[name="epcRating"], select[name="energyRating"], #epcRating'
      },
      statsSelectors: {
        views: '.views-count, [data-stat="views"], .property-views',
        enquiries: '.enquiries-count, [data-stat="enquiries"], .property-enquiries'
      },
      removeSelectors: {
        removeButton: 'button[data-action="remove"], .remove-property, a:has-text("Remove"), a:has-text("Withdraw")',
        confirmButton: 'button[data-confirm], .confirm-remove, button:has-text("Confirm")'
      },
      listingIdPattern: /propert(?:y|ies)\/(\d+)/,
      rateLimit: 2000
    }
  };

  /** Get list of supported portal names */
  static get supportedPortals(): string[] {
    return Object.keys(PortalSyndicationService.PORTAL_CONFIG);
  }

  // ─── Browser Management ──────────────────────────────────────────

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

  // ─── Credential Encryption ───────────────────────────────────────

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(parts[1], 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  // ─── Credential Management ───────────────────────────────────────

  async savePortalCredentials(portalName: string, username: string, password: string): Promise<boolean> {
    try {
      const encryptedPassword = this.encrypt(password);

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

      console.log(`[PortalSyndication] Credentials saved for ${portalName}`);
      return true;
    } catch (error) {
      console.error(`[PortalSyndication] Error saving credentials for ${portalName}:`, error);
      return false;
    }
  }

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
      console.error(`[PortalSyndication] Error getting credentials for ${portalName}:`, error);
      return null;
    }
  }

  // ─── Reusable Browser Helpers ────────────────────────────────────

  /** Dismiss cookie consent banners */
  private async dismissCookieBanner(page: Page, portalName: string): Promise<void> {
    const config = PortalSyndicationService.PORTAL_CONFIG[portalName];
    if (!config) return;

    for (const selector of config.cookieSelectors) {
      try {
        const btn = page.locator(selector);
        if (await btn.isVisible({ timeout: 2000 })) {
          await btn.click();
          await page.waitForTimeout(500);
          return;
        }
      } catch {
        // Try next selector
      }
    }
  }

  /** Login to any configured portal */
  private async loginToPortal(
    page: Page,
    portalName: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; errorMessage?: string }> {
    const config = PortalSyndicationService.PORTAL_CONFIG[portalName];
    if (!config) {
      return { success: false, errorMessage: `No configuration for portal: ${portalName}` };
    }

    console.log(`[PortalSyndication] Logging in to ${config.name}...`);
    await page.goto(config.loginUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await this.dismissCookieBanner(page, portalName);

    // Fill login form
    await page.fill(config.loginSelectors.usernameField, username);
    await page.fill(config.loginSelectors.passwordField, password);
    await page.click(config.loginSelectors.submitButton);

    // Wait for navigation
    await page.waitForTimeout(3000);

    // Check for successful login
    const isLoggedIn = await page.locator(config.loginSelectors.dashboardIndicator)
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    if (isLoggedIn) {
      console.log(`[PortalSyndication] ${config.name} login successful`);
      return { success: true };
    }

    // Check for error message
    const errorMessage = await page.locator(config.loginSelectors.errorIndicator)
      .textContent()
      .catch(() => null);

    console.log(`[PortalSyndication] ${config.name} login failed: ${errorMessage || 'unknown error'}`);
    return {
      success: false,
      errorMessage: errorMessage || 'Login failed - please check credentials'
    };
  }

  /** Ensure we are logged in (reuses session cookies if possible) */
  private async ensureLoggedIn(portalName: string): Promise<Page> {
    const creds = await this.getPortalCredentials(portalName);
    if (!creds) {
      throw new Error(`${portalName} credentials not configured`);
    }

    const config = PortalSyndicationService.PORTAL_CONFIG[portalName];
    if (!config) {
      throw new Error(`No configuration for portal: ${portalName}`);
    }

    const context = await this.getPortalContext(portalName);
    const page = await context.newPage();

    // Try navigating to dashboard to check if session is still active
    await page.goto(config.dashboardUrl, { waitUntil: 'networkidle', timeout: 30000 });

    const alreadyLoggedIn = await page.locator(config.loginSelectors.dashboardIndicator)
      .isVisible({ timeout: 3000 })
      .catch(() => false);

    if (!alreadyLoggedIn) {
      const loginResult = await this.loginToPortal(page, portalName, creds.username, creds.password);
      if (!loginResult.success) {
        await page.close();
        throw new Error(`Login to ${config.name} failed: ${loginResult.errorMessage}`);
      }
    }

    return page;
  }

  /** Fill property form fields on any portal */
  private async fillPropertyForm(page: Page, portalName: string, property: any): Promise<void> {
    const config = PortalSyndicationService.PORTAL_CONFIG[portalName];
    if (!config) return;

    const s = config.formSelectors;

    // Property type
    if (s.propertyType && property.propertyType) {
      await page.selectOption(s.propertyType, property.propertyType).catch(() => {});
    }

    // Listing type (sale vs lettings)
    if (s.listingType && property.isRental !== undefined) {
      const channel = property.isRental ? 'lettings' : 'sales';
      await page.selectOption(s.listingType, channel).catch(() =>
        page.fill(s.listingType!, channel).catch(() => {})
      );
    }

    // Address
    if (property.addressLine1) {
      await page.fill(s.addressLine1, property.addressLine1).catch(() => {});
    }
    if (property.postcode) {
      await page.fill(s.postcode, property.postcode).catch(() => {});
    }

    // Price (stored in pence in DB, portals expect pounds)
    if (property.price) {
      const priceInPounds = property.price / 100;
      await page.fill(s.price, priceInPounds.toString()).catch(() => {});
    }

    // Bedrooms and bathrooms
    if (property.bedrooms != null) {
      await page.fill(s.bedrooms, property.bedrooms.toString()).catch(() =>
        page.selectOption(s.bedrooms, property.bedrooms.toString()).catch(() => {})
      );
    }
    if (property.bathrooms != null) {
      await page.fill(s.bathrooms, property.bathrooms.toString()).catch(() =>
        page.selectOption(s.bathrooms, property.bathrooms.toString()).catch(() => {})
      );
    }

    // Description
    if (property.description) {
      await page.fill(s.description, property.description).catch(() => {});
    }

    // Tenure
    if (s.tenure && property.tenure) {
      await page.selectOption(s.tenure, property.tenure).catch(() => {});
    }

    // EPC/Energy rating
    if (s.energyRating && property.energyRating) {
      await page.selectOption(s.energyRating, property.energyRating).catch(() => {});
    }

    console.log(`[PortalSyndication] Form fields filled for ${config.name}`);
  }

  /** Update the isPublished flag on the properties table */
  private async updatePublishFlag(portalName: string, propertyId: number, isPublished: boolean): Promise<void> {
    const flagMap: Record<string, Record<string, boolean>> = {
      zoopla: { isPublishedZoopla: isPublished },
      rightmove: { isPublishedRightmove: isPublished },
      onthemarket: { isPublishedOnthemarket: isPublished },
    };

    const updateData = flagMap[portalName.toLowerCase()];
    if (updateData) {
      await db.update(properties)
        .set({ ...updateData, updatedAt: new Date() } as any)
        .where(eq(properties.id, propertyId));
    }
  }

  // ─── Public API: Test Login ──────────────────────────────────────

  async testPortalLogin(portalName: string): Promise<{ success: boolean; message: string }> {
    const normalizedName = portalName.toLowerCase();
    const config = PortalSyndicationService.PORTAL_CONFIG[normalizedName];

    if (!config) {
      return { success: false, message: `Portal ${portalName} not supported. Supported: ${PortalSyndicationService.supportedPortals.join(', ')}` };
    }

    let page: Page | null = null;
    try {
      const creds = await this.getPortalCredentials(normalizedName);
      if (!creds) {
        return { success: false, message: 'No credentials found for this portal' };
      }

      const context = await this.getPortalContext(normalizedName);
      page = await context.newPage();

      const result = await this.loginToPortal(page, normalizedName, creds.username, creds.password);

      // Update last test status in DB
      await db.update(portalCredentials)
        .set({
          lastTestAt: new Date(),
          lastTestSuccess: result.success,
          updatedAt: new Date()
        })
        .where(eq(portalCredentials.portalName, normalizedName));

      return {
        success: result.success,
        message: result.success
          ? `${config.name} login successful`
          : result.errorMessage || 'Login failed'
      };
    } catch (error: any) {
      console.error(`[PortalSyndication] ${config.name} login test error:`, error);
      return { success: false, message: error.message };
    } finally {
      if (page) await page.close();
    }
  }

  // ─── Public API: Syndicate (Create Listing) ──────────────────────

  async syndicateToPortal(portalName: string, propertyId: number): Promise<{ success: boolean; listingId?: string; message: string }> {
    const normalizedName = portalName.toLowerCase();
    const config = PortalSyndicationService.PORTAL_CONFIG[normalizedName];
    if (!config) {
      return { success: false, message: `Portal ${portalName} not configured` };
    }

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

      console.log(`[PortalSyndication] Syndicating property ${propertyId} to ${config.name}...`);

      page = await this.ensureLoggedIn(normalizedName);

      // Navigate to add listing
      await page.goto(config.addListingUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Fill property form
      await this.fillPropertyForm(page, normalizedName, property);

      // Submit
      await page.click(config.formSelectors.submitButton).catch(() => {});
      await page.waitForTimeout(3000);

      // Extract listing ID from URL or confirmation page
      const currentUrl = page.url();
      const listingIdMatch = currentUrl.match(config.listingIdPattern);
      const portalListingId = listingIdMatch
        ? listingIdMatch[1]
        : `${normalizedName.substring(0, 3).toUpperCase()}_${Date.now()}`;

      // Save listing record
      await db.insert(propertyPortalListings).values({
        propertyId: property.id,
        portalName: normalizedName,
        portalListingId,
        status: 'active',
        lastSyncStatus: 'success',
        lastSyncAt: new Date(),
        publishedAt: new Date()
      });

      // Update the property's isPublished flag
      await this.updatePublishFlag(normalizedName, propertyId, true);

      console.log(`[PortalSyndication] Property ${propertyId} syndicated to ${config.name} (listing: ${portalListingId})`);

      return {
        success: true,
        listingId: portalListingId,
        message: `Property successfully syndicated to ${config.name}`
      };

    } catch (error: any) {
      console.error(`[PortalSyndication] ${config.name} syndication error:`, error);

      // Record failure
      await db.insert(propertyPortalListings).values({
        propertyId,
        portalName: normalizedName,
        status: 'error',
        lastSyncStatus: 'failed',
        lastSyncMessage: error.message,
        lastSyncAt: new Date()
      }).catch(() => {});

      return { success: false, message: `Syndication failed: ${error.message}` };
    } finally {
      if (page) await page.close();
    }
  }

  // ─── Public API: Update Listing ──────────────────────────────────

  async updatePortalListing(portalName: string, propertyId: number): Promise<{ success: boolean; message: string }> {
    const normalizedName = portalName.toLowerCase();
    const config = PortalSyndicationService.PORTAL_CONFIG[normalizedName];
    if (!config) {
      return { success: false, message: `Portal ${portalName} not configured` };
    }

    let page: Page | null = null;
    try {
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
          eq(propertyPortalListings.portalName, normalizedName)
        ))
        .limit(1);

      if (!existingListing || !existingListing.portalListingId) {
        return { success: false, message: `No existing ${config.name} listing found` };
      }

      console.log(`[PortalSyndication] Updating ${config.name} listing for property ${propertyId}...`);

      page = await this.ensureLoggedIn(normalizedName);

      // Navigate to edit listing
      const editUrl = config.editListingUrlTemplate.replace('{listingId}', existingListing.portalListingId);
      await page.goto(editUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Update fields
      await this.fillPropertyForm(page, normalizedName, property);

      // Submit update
      await page.click(config.formSelectors.submitButton).catch(() => {});
      await page.waitForTimeout(2000);

      // Update record
      await db.update(propertyPortalListings)
        .set({
          lastSyncStatus: 'success',
          lastSyncAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(propertyPortalListings.id, existingListing.id));

      console.log(`[PortalSyndication] ${config.name} listing updated for property ${propertyId}`);
      return { success: true, message: `${config.name} listing updated successfully` };

    } catch (error: any) {
      console.error(`[PortalSyndication] ${config.name} update error:`, error);
      return { success: false, message: `Update failed: ${error.message}` };
    } finally {
      if (page) await page.close();
    }
  }

  // ─── Public API: Remove Listing ──────────────────────────────────

  async removePortalListing(portalName: string, propertyId: number): Promise<{ success: boolean; message: string }> {
    const normalizedName = portalName.toLowerCase();
    const config = PortalSyndicationService.PORTAL_CONFIG[normalizedName];
    if (!config) {
      return { success: false, message: `Portal ${portalName} not configured` };
    }

    let page: Page | null = null;
    try {
      const [existingListing] = await db.select()
        .from(propertyPortalListings)
        .where(and(
          eq(propertyPortalListings.propertyId, propertyId),
          eq(propertyPortalListings.portalName, normalizedName)
        ))
        .limit(1);

      if (!existingListing || !existingListing.portalListingId) {
        return { success: false, message: `No existing ${config.name} listing found` };
      }

      console.log(`[PortalSyndication] Removing ${config.name} listing for property ${propertyId}...`);

      page = await this.ensureLoggedIn(normalizedName);

      // Navigate to listing
      const editUrl = config.editListingUrlTemplate.replace('{listingId}', existingListing.portalListingId);
      await page.goto(editUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Find and click remove/withdraw button
      await page.click(config.removeSelectors.removeButton).catch(() => {});
      await page.waitForTimeout(1000);

      // Confirm removal
      await page.click(config.removeSelectors.confirmButton).catch(() => {});
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

      // Update property flag
      await this.updatePublishFlag(normalizedName, propertyId, false);

      console.log(`[PortalSyndication] ${config.name} listing removed for property ${propertyId}`);
      return { success: true, message: `${config.name} listing removed successfully` };

    } catch (error: any) {
      console.error(`[PortalSyndication] ${config.name} removal error:`, error);
      return { success: false, message: `Removal failed: ${error.message}` };
    } finally {
      if (page) await page.close();
    }
  }

  // ─── Public API: Sync Stats ──────────────────────────────────────

  async syncPortalStats(portalName: string, propertyId: number): Promise<{ success: boolean; stats?: any; message: string }> {
    const normalizedName = portalName.toLowerCase();
    const config = PortalSyndicationService.PORTAL_CONFIG[normalizedName];
    if (!config) {
      return { success: false, message: `Portal ${portalName} not configured` };
    }

    let page: Page | null = null;
    try {
      const [existingListing] = await db.select()
        .from(propertyPortalListings)
        .where(and(
          eq(propertyPortalListings.propertyId, propertyId),
          eq(propertyPortalListings.portalName, normalizedName)
        ))
        .limit(1);

      if (!existingListing || !existingListing.portalListingId) {
        return { success: false, message: `No existing ${config.name} listing found` };
      }

      page = await this.ensureLoggedIn(normalizedName);

      // Navigate to listing stats
      const statsUrl = config.statsUrlTemplate.replace('{listingId}', existingListing.portalListingId);
      await page.goto(statsUrl, { waitUntil: 'networkidle', timeout: 30000 });

      // Extract stats
      const views = await page.locator(config.statsSelectors.views).textContent().catch(() => '0');
      const enquiries = await page.locator(config.statsSelectors.enquiries).textContent().catch(() => '0');

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

      console.log(`[PortalSyndication] ${config.name} stats synced for property ${propertyId}: ${stats.views} views, ${stats.enquiries} enquiries`);
      return { success: true, stats, message: 'Stats synced successfully' };

    } catch (error: any) {
      console.error(`[PortalSyndication] ${config.name} stats sync error:`, error);
      return { success: false, message: `Stats sync failed: ${error.message}` };
    } finally {
      if (page) await page.close();
    }
  }

  // ─── Public API: Bulk Syndicate ──────────────────────────────────

  async bulkSyndicateToPortal(portalName: string, propertyIds: number[]): Promise<{ success: boolean; results: any[] }> {
    const normalizedName = portalName.toLowerCase();
    const config = PortalSyndicationService.PORTAL_CONFIG[normalizedName];
    const results = [];

    for (const propertyId of propertyIds) {
      const result = await this.syndicateToPortal(normalizedName, propertyId);
      results.push({ propertyId, ...result });

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, config?.rateLimit || 2000));
    }

    const successCount = results.filter(r => r.success).length;
    return {
      success: successCount === propertyIds.length,
      results
    };
  }

  // ─── Public API: Status & Config ─────────────────────────────────

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

  // ─── Backward Compatibility Wrappers (Zoopla) ────────────────────

  async syndicateToZoopla(propertyId: number) {
    return this.syndicateToPortal('zoopla', propertyId);
  }

  async updateZooplaListing(propertyId: number) {
    return this.updatePortalListing('zoopla', propertyId);
  }

  async removeZooplaListing(propertyId: number) {
    return this.removePortalListing('zoopla', propertyId);
  }

  async syncZooplaStats(propertyId: number) {
    return this.syncPortalStats('zoopla', propertyId);
  }

  async bulkSyndicateToZoopla(propertyIds: number[]) {
    return this.bulkSyndicateToPortal('zoopla', propertyIds);
  }

  // ─── Cleanup ─────────────────────────────────────────────────────

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
