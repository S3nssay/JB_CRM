import { chromium, Browser, Page } from 'playwright';
import { db } from './db';
import { properties, InsertProperty } from '@shared/schema';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import { randomUUID } from 'crypto';

// Supported portals and their configurations
type PortalName = 'rightmove' | 'zoopla' | 'onthemarket' | 'johnbarclay' | 'auto';

interface ScrapedPropertyData {
    title: string;
    address: string;
    price: number;
    priceQualifier?: string;
    description: string;
    features: string[];
    bedrooms: number;
    bathrooms: number;
    sqft: number;
    images: string[];
    propertyType?: string;
    isRental?: boolean;
    epcRating?: string;
    tenure?: string;
    councilTaxBand?: string;
    floorplanUrl?: string;
    virtualTourUrl?: string;
    portalRef?: string;
}

interface ImportResult {
    success: boolean;
    property?: any;
    scraped?: ScrapedPropertyData;
    error?: string;
    portal?: string;
}

export class PropertyImportService {
    private browser: Browser | null = null;

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

    private detectPortal(url: string): PortalName {
        const urlLower = url.toLowerCase();
        if (urlLower.includes('rightmove.co.uk')) return 'rightmove';
        if (urlLower.includes('zoopla.co.uk')) return 'zoopla';
        if (urlLower.includes('onthemarket.com')) return 'onthemarket';
        if (urlLower.includes('johnbarclay.co.uk')) return 'johnbarclay';
        throw new Error('Unsupported property portal. Supported portals: Rightmove, Zoopla, OnTheMarket, John Barclay');
    }

    async previewImport(url: string): Promise<ImportResult> {
        console.log(`[PropertyImport] Preview import from ${url}`);

        try {
            const portal = this.detectPortal(url);
            const data = await this.scrapeProperty(url, portal);

            return {
                success: true,
                scraped: data,
                portal
            };
        } catch (error: any) {
            console.error('[PropertyImport] Preview error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async importFromUrl(url: string, userId?: number, saveToDb: boolean = true, isRentalOverride?: boolean): Promise<ImportResult> {
        console.log(`[PropertyImport] Starting import from ${url} | isRentalOverride=${isRentalOverride}`);

        try {
            const portal = this.detectPortal(url);
            const data = await this.scrapeProperty(url, portal);

            if (!saveToDb) {
                return { success: true, scraped: data, portal };
            }

            const downloadedImages = await this.downloadImages(data.images);

            console.log(`[PropertyImport] Scraped address: "${data.address}" | title: "${data.title}"`);
            const postcodeMatch = data.address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
            const postcode = postcodeMatch ? postcodeMatch[0].toUpperCase() : '';
            const addressLine1 = data.address.replace(postcode, '').trim().replace(/,\s*$/, '').replace(/\s+/g, ' ');
            console.log(`[PropertyImport] Parsed postcode: "${postcode}" | addressLine1: "${addressLine1}"`);

            const newProperty: InsertProperty = {
                title: data.title,
                description: data.description,
                address: data.address || data.title, // Full address (required)
                addressLine1: addressLine1 || data.title,
                postcode: postcode || 'UNKNOWN',
                price: data.price,
                bedrooms: data.bedrooms,
                bathrooms: data.bathrooms,
                squareFootage: data.sqft,
                propertyType: data.propertyType || this.inferPropertyType(data.title),
                isRental: isRentalOverride !== undefined ? isRentalOverride : (data.isRental ?? false),
                status: 'available',
                features: data.features,
                images: downloadedImages,
                agentId: userId,
                energyRating: data.epcRating || null,
                tenure: data.tenure || 'freehold',
                councilTaxBand: data.councilTaxBand || null,
                isListed: true, // Imported properties should show in CRM listings
                isResidential: true // Default to residential, can be changed manually
            };

            const [savedProperty] = await db.insert(properties).values(newProperty).returning();

            return {
                success: true,
                property: savedProperty,
                scraped: data,
                portal
            };

        } catch (error: any) {
            console.error('[PropertyImport] Error importing property:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    private async scrapeProperty(url: string, portal: PortalName): Promise<ScrapedPropertyData> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-GB,en;q=0.9'
        });

        try {
            await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
            await page.waitForTimeout(3000);

            let data: ScrapedPropertyData;

            switch (portal) {
                case 'rightmove':
                    data = await this.scrapeRightmove(page, url);
                    break;
                case 'zoopla':
                    data = await this.scrapeZoopla(page, url);
                    break;
                case 'onthemarket':
                    data = await this.scrapeOnTheMarket(page, url);
                    break;
                case 'johnbarclay':
                default:
                    data = await this.scrapeJohnBarclay(page, url);
                    break;
            }

            console.log(`[PropertyImport] Scraped from ${portal}: title="${data.title?.substring(0, 50)}", description=${data.description ? data.description.length + ' chars' : 'EMPTY'}, images=${data.images.length}, features=${data.features.length}`);
            return data;
        } finally {
            await page.close();
        }
    }

    private async scrapeRightmove(page: Page, url: string): Promise<ScrapedPropertyData> {
        const isRental = url.includes('/property-to-rent/') || url.includes('channel=RES_LET');

        // Use page.$eval and page.$$eval instead of page.evaluate to avoid __name issues
        const title = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');
        // Rightmove shows address in a separate element below the title
        const addressEl = await page.$eval(
            '[data-testid="address-label"], [itemprop="streetAddress"], address, ._1kck3jRw_SEvXEWGMhT__d, [class*="AddressLabel"], [data-testid="listing-summary-address"]',
            el => el.textContent?.trim() || ''
        ).catch(() => '');
        // Fallback: try structured data / meta tags
        const address = addressEl || await page.evaluate(() => {
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.textContent || '');
                    const addr = json.address || json?.mainEntity?.address;
                    if (addr?.streetAddress) {
                        return [addr.streetAddress, addr.addressLocality, addr.postalCode].filter(Boolean).join(', ');
                    }
                } catch {}
            }
            const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content') || '';
            if (ogTitle && /[A-Z]{1,2}[0-9]/.test(ogTitle)) return ogTitle;
            return '';
        }).catch(() => '') || title;

        const priceStr = await page.$eval('[data-testid="price"], .propertyHeaderPrice, ._1gfnqJ3Vtd1z40MlC0MzXu span',
            el => el.textContent?.trim() || '0').catch(() => '0');
        const price = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;

        let priceQualifier = '';
        if (priceStr.toLowerCase().includes('pcm')) priceQualifier = 'pcm';
        else if (priceStr.toLowerCase().includes('pw')) priceQualifier = 'pw';

        // Click any "Read more" button to expand full description
        const readMoreSelectors = [
            '[data-testid="truncated_text_toggle"]',
            'button:has-text("Read more")',
            'a:has-text("Read more")',
            '[class*="ReadMore"]',
            'button:has-text("read more")',
            '[data-testid="expand-description"]',
            'button:has-text("Show full description")',
        ];
        for (const sel of readMoreSelectors) {
            await page.click(sel).catch(() => {});
        }
        await page.waitForTimeout(1000);

        // Try multiple selectors for description - portals change their HTML frequently
        const description = await page.evaluate(() => {
            // Strategy 1: data-testid selectors (Rightmove's test IDs - current and legacy)
            const testIdSelectors = [
                '[data-testid="truncated_text_container"]',
                '[data-testid="property-description"]',
                '[data-testid="listing-description"]',
                '[data-testid="description"]',
                '[data-testid="truncated_text"]',
            ];
            for (const sel of testIdSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim() && el.textContent.trim().length > 50) return el.textContent.trim();
            }

            // Strategy 2: Look for section with "About this property" or "Property description" heading
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
            for (const h of headings) {
                const text = h.textContent?.toLowerCase() || '';
                if (text.includes('about this property') || text.includes('property description') || text.includes('description') || text.includes('about this home')) {
                    // Get the parent section or the next sibling content
                    const section = h.closest('section') || h.closest('article') || h.parentElement;
                    if (section) {
                        // Get all text content excluding the heading itself
                        const paragraphs = Array.from(section.querySelectorAll('p, div:not(:has(h2)):not(:has(h3))'));
                        const desc = paragraphs.map(p => p.textContent?.trim()).filter(t => t && t.length > 20).join('\n\n');
                        if (desc && desc.length > 50) return desc;
                        // Fallback: get all text from section minus the heading
                        const fullText = section.textContent?.trim() || '';
                        const headingText = h.textContent?.trim() || '';
                        const remaining = fullText.replace(headingText, '').trim();
                        if (remaining && remaining.length > 50) return remaining;
                    }
                    // Try collecting siblings after the heading
                    let desc = '';
                    let next = h.nextElementSibling;
                    while (next && !['H1','H2','H3'].includes(next.tagName)) {
                        const t = next.textContent?.trim() || '';
                        if (t.length > 10) desc += (desc ? '\n\n' : '') + t;
                        next = next.nextElementSibling;
                    }
                    if (desc && desc.length > 50) return desc;
                }
            }

            // Strategy 3: Look for the description in the main content area by ID or class
            const idClassSelectors = [
                '#description', '#propertyDescription', '[id*="description" i]',
                '.property-description', '[class*="PropertyDescription"]',
                '[class*="description-text"]', '[class*="listing-description"]',
            ];
            for (const sel of idClassSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim() && el.textContent.trim().length > 50) return el.textContent.trim();
            }

            // Strategy 4: Find the largest text block on the page (likely the description)
            const allParagraphs = Array.from(document.querySelectorAll('p'));
            let longestText = '';
            for (const p of allParagraphs) {
                const text = p.textContent?.trim() || '';
                if (text.length > longestText.length && text.length > 100) {
                    longestText = text;
                }
            }
            // Also try combining multiple substantial paragraphs
            const substantialPs = allParagraphs.filter(p => (p.textContent?.trim() || '').length > 40);
            if (substantialPs.length >= 2) {
                const combined = substantialPs.map(p => p.textContent?.trim()).join('\n\n');
                if (combined.length > longestText.length) return combined;
            }
            return longestText;
        }).catch(() => '');

        console.log(`[PropertyImport] Rightmove description extracted: ${description ? description.substring(0, 80) + '...' : 'EMPTY'}`);

        const features = await page.$$eval('._3mqo0D0b4I7jLjJpXwT4XH li, .lIhZ24u1NHMa5Y6gDH90A, [data-testid="key-features"] li, ul[class*="Feature"] li, section:has(h2:text-is("Key features")) li',
            els => els.map(el => el.textContent?.trim() || '').filter(Boolean)).catch(() => []);

        // Get bedroom/bathroom info from page text
        const pageText = await page.$eval('body', el => el.textContent || '').catch(() => '');
        const bedMatch = pageText.match(/(\d+)\s*bed/i);
        const bathMatch = pageText.match(/(\d+)\s*bath/i);
        const sqftMatch = pageText.match(/([\d,]+)\s*sq\.?\s*ft/i);

        const bedrooms = bedMatch ? parseInt(bedMatch[1]) : 0;
        const bathrooms = bathMatch ? parseInt(bathMatch[1]) : 0;
        const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : 0;

        // Get property type
        const propertyTypeMatch = pageText.match(/\b(flat|apartment|house|bungalow|maisonette|studio|detached|semi-detached|terraced|cottage)\b/i);
        const propertyType = propertyTypeMatch ? propertyTypeMatch[1].toLowerCase() : '';

        // Get images
        const images = await page.$$eval('img[src*="media.rightmove.co.uk"]', els => {
            return els.map(el => {
                const src = el.getAttribute('src') || '';
                return src.replace(/_\d+_\d+\./, '_1024_768.');
            }).filter(src => src && !src.includes('_max_'));
        }).catch(() => []);

        const refMatch = url.match(/property-(\d+)/);
        const portalRef = refMatch ? `RM${refMatch[1]}` : undefined;

        return {
            title,
            address,
            price,
            priceQualifier,
            description,
            features,
            bedrooms,
            bathrooms,
            sqft,
            images: images.slice(0, 10),
            propertyType,
            isRental,
            portalRef
        };
    }

    private async scrapeZoopla(page: Page, url: string): Promise<ScrapedPropertyData> {
        const isRental = url.includes('/to-rent/') || url.includes('is_letting_agreed=');

        const title = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');
        const address = await page.$eval('[data-testid="address-label"], address',
            el => el.textContent?.trim() || '').catch(() => title);

        const priceStr = await page.$eval('[data-testid="price"], .css-1e28vvi',
            el => el.textContent?.trim() || '0').catch(() => '0');
        const price = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;

        let priceQualifier = '';
        if (priceStr.toLowerCase().includes('pcm')) priceQualifier = 'pcm';
        else if (priceStr.toLowerCase().includes('pw')) priceQualifier = 'pw';

        // Click any "Read more" button to expand full description
        for (const sel of ['button:has-text("Read more")', '[data-testid="truncated_text_toggle"]', 'a:has-text("Read more")', 'button:has-text("read more")']) {
            await page.click(sel).catch(() => {});
        }
        await page.waitForTimeout(1000);

        // Try multiple selectors for description
        const description = await page.evaluate(() => {
            // Strategy 1: data-testid selectors (current + legacy)
            const testIdSelectors = [
                '[data-testid="listing_description"]',
                '[data-testid="description"]',
                '[data-testid="listing_summary_description"]',
                '[data-testid="truncated_text_container"]',
            ];
            for (const sel of testIdSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim() && el.textContent.trim().length > 50) return el.textContent.trim();
            }

            // Strategy 2: Look for description section heading
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
            for (const h of headings) {
                const text = h.textContent?.toLowerCase() || '';
                if (text.includes('about this') || text.includes('description') || text.includes('property details')) {
                    const section = h.closest('section') || h.closest('article') || h.parentElement;
                    if (section) {
                        const paragraphs = Array.from(section.querySelectorAll('p'));
                        const desc = paragraphs.map(p => p.textContent?.trim()).filter(t => t && t.length > 20).join('\n\n');
                        if (desc && desc.length > 50) return desc;
                        const fullText = section.textContent?.trim() || '';
                        const headingText = h.textContent?.trim() || '';
                        const remaining = fullText.replace(headingText, '').trim();
                        if (remaining && remaining.length > 50) return remaining;
                    }
                    // Try siblings
                    let desc = '';
                    let next = h.nextElementSibling;
                    while (next && !['H1','H2','H3'].includes(next.tagName)) {
                        const t = next.textContent?.trim() || '';
                        if (t.length > 10) desc += (desc ? '\n\n' : '') + t;
                        next = next.nextElementSibling;
                    }
                    if (desc && desc.length > 50) return desc;
                }
            }

            // Strategy 3: ID/class-based lookup
            const selectors = ['#description', '[id*="description" i]', '[class*="ListingDescription"]', '[class*="description-text"]'];
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim() && el.textContent.trim().length > 50) return el.textContent.trim();
            }

            // Strategy 4: Find largest text block
            const allParagraphs = Array.from(document.querySelectorAll('p'));
            let longestText = '';
            for (const p of allParagraphs) {
                const text = p.textContent?.trim() || '';
                if (text.length > longestText.length && text.length > 100) {
                    longestText = text;
                }
            }
            const substantialPs = allParagraphs.filter(p => (p.textContent?.trim() || '').length > 40);
            if (substantialPs.length >= 2) {
                const combined = substantialPs.map(p => p.textContent?.trim()).join('\n\n');
                if (combined.length > longestText.length) return combined;
            }
            return longestText;
        }).catch(() => '');

        console.log(`[PropertyImport] Zoopla description extracted: ${description ? description.substring(0, 80) + '...' : 'EMPTY'}`);

        const features = await page.$$eval('[data-testid="listing_features"] li, [data-testid="key-features"] li, section:has(h2:text-is("Features")) li, ul[class*="feature" i] li',
            els => els.map(el => el.textContent?.trim() || '').filter(Boolean)).catch(() => []);

        const pageText = await page.$eval('body', el => el.textContent || '').catch(() => '');
        const bedMatch = pageText.match(/(\d+)\s*bed/i);
        const bathMatch = pageText.match(/(\d+)\s*bath/i);
        const sqftMatch = pageText.match(/([\d,]+)\s*sq\.?\s*ft/i);

        const bedrooms = bedMatch ? parseInt(bedMatch[1]) : 0;
        const bathrooms = bathMatch ? parseInt(bathMatch[1]) : 0;
        const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : 0;

        const propertyTypeMatch = pageText.match(/\b(flat|apartment|house|bungalow|maisonette|studio|detached|semi-detached|terraced|cottage)\b/i);
        const propertyType = propertyTypeMatch ? propertyTypeMatch[1].toLowerCase() : '';

        const images = await page.$$eval('img[src*="lc.zoocdn.com"], img[src*="lid.zoocdn.com"]', els => {
            return els.map(el => {
                const src = el.getAttribute('src') || '';
                return src.replace(/\/\d+\/\d+\//, '/1024/768/');
            }).filter(Boolean);
        }).catch(() => []);

        const refMatch = url.match(/(\d{7,})/);
        const portalRef = refMatch ? `ZP${refMatch[1]}` : undefined;

        return {
            title,
            address,
            price,
            priceQualifier,
            description,
            features,
            bedrooms,
            bathrooms,
            sqft,
            images: images.slice(0, 10),
            propertyType,
            isRental,
            portalRef
        };
    }

    private async scrapeOnTheMarket(page: Page, url: string): Promise<ScrapedPropertyData> {
        const isRental = url.includes('/to-rent/') || url.includes('/rent/');

        const title = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');
        const address = await page.$eval('.property-address, [class*="address"]',
            el => el.textContent?.trim() || '').catch(() => title);

        const priceStr = await page.$eval('.property-price, [class*="price"]',
            el => el.textContent?.trim() || '0').catch(() => '0');
        const price = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;

        let priceQualifier = '';
        if (priceStr.toLowerCase().includes('pcm')) priceQualifier = 'pcm';
        else if (priceStr.toLowerCase().includes('pw')) priceQualifier = 'pw';

        // Click any "Read more" button to expand full description
        for (const sel of ['button:has-text("Read more")', 'a:has-text("Read more")', '[class*="ReadMore"]', 'button:has-text("read more")', 'button:has-text("Show full description")']) {
            await page.click(sel).catch(() => {});
        }
        await page.waitForTimeout(1000);

        // Try multiple selectors for description
        const description = await page.evaluate(() => {
            // Strategy 1: class-based selectors (current + legacy)
            const classSelectors = [
                '.property-description', '.description-text', '[class*="description-content"]',
                '[class*="FullDescription"]', '[class*="property-details-description"]',
                '[data-testid="description"]',
            ];
            for (const sel of classSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim() && el.textContent.trim().length > 50) return el.textContent.trim();
            }

            // Strategy 2: Look for description section heading
            const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'));
            for (const h of headings) {
                const text = h.textContent?.toLowerCase() || '';
                if (text.includes('description') || text.includes('about this') || text.includes('property details') || text.includes('full details')) {
                    const section = h.closest('section') || h.closest('article') || h.closest('div') || h.parentElement;
                    if (section) {
                        const paragraphs = Array.from(section.querySelectorAll('p'));
                        const desc = paragraphs.map(p => p.textContent?.trim()).filter(t => t && t.length > 20).join('\n\n');
                        if (desc && desc.length > 50) return desc;
                        const fullText = section.textContent?.trim() || '';
                        const headingText = h.textContent?.trim() || '';
                        const remaining = fullText.replace(headingText, '').trim();
                        if (remaining && remaining.length > 50) return remaining;
                    }
                    // Try siblings
                    let desc = '';
                    let next = h.nextElementSibling;
                    while (next && !['H1','H2','H3'].includes(next.tagName)) {
                        const t = next.textContent?.trim() || '';
                        if (t.length > 10) desc += (desc ? '\n\n' : '') + t;
                        next = next.nextElementSibling;
                    }
                    if (desc && desc.length > 50) return desc;
                }
            }

            // Strategy 3: Broad class/ID match
            const broadSelectors = ['[class*="description" i]', '#description', '[id*="description" i]'];
            for (const sel of broadSelectors) {
                const el = document.querySelector(sel);
                if (el?.textContent?.trim() && el.textContent.trim().length > 50) return el.textContent.trim();
            }

            // Strategy 4: Find largest text block
            const allParagraphs = Array.from(document.querySelectorAll('p'));
            let longestText = '';
            for (const p of allParagraphs) {
                const text = p.textContent?.trim() || '';
                if (text.length > longestText.length && text.length > 100) {
                    longestText = text;
                }
            }
            const substantialPs = allParagraphs.filter(p => (p.textContent?.trim() || '').length > 40);
            if (substantialPs.length >= 2) {
                const combined = substantialPs.map(p => p.textContent?.trim()).join('\n\n');
                if (combined.length > longestText.length) return combined;
            }
            return longestText;
        }).catch(() => '');

        console.log(`[PropertyImport] OnTheMarket description extracted: ${description ? description.substring(0, 80) + '...' : 'EMPTY'}`);

        const features = await page.$$eval('.property-features li, [class*="features"] li, .key-features li, section:has(h2:text-is("Key features")) li, ul[class*="feature" i] li',
            els => els.map(el => el.textContent?.trim() || '').filter(Boolean)).catch(() => []);

        const pageText = await page.$eval('body', el => el.textContent || '').catch(() => '');
        const bedMatch = pageText.match(/(\d+)\s*bed/i);
        const bathMatch = pageText.match(/(\d+)\s*bath/i);
        const sqftMatch = pageText.match(/([\d,]+)\s*sq\.?\s*ft/i);

        const bedrooms = bedMatch ? parseInt(bedMatch[1]) : 0;
        const bathrooms = bathMatch ? parseInt(bathMatch[1]) : 0;
        const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : 0;

        const propertyTypeMatch = pageText.match(/\b(flat|apartment|house|bungalow|maisonette|studio|detached|semi-detached|terraced|cottage)\b/i);
        const propertyType = propertyTypeMatch ? propertyTypeMatch[1].toLowerCase() : '';

        const images = await page.$$eval('.gallery img, [class*="gallery"] img, .carousel img', els => {
            return els.map(el => el.getAttribute('src') || el.getAttribute('data-src') || '')
                .filter(src => src && !src.includes('placeholder'));
        }).catch(() => []);

        const refMatch = url.match(/details\/(\d+)/);
        const portalRef = refMatch ? `OTM${refMatch[1]}` : undefined;

        return {
            title,
            address,
            price,
            priceQualifier,
            description,
            features,
            bedrooms,
            bathrooms,
            sqft,
            images: images.slice(0, 10),
            propertyType,
            isRental,
            portalRef
        };
    }

    private async scrapeJohnBarclay(page: Page, url: string): Promise<ScrapedPropertyData> {
        const isRental = url.includes('let') || url.includes('rent') || url.includes('to-let');

        // Title from H1 (e.g. "One Bedroom Flat in LONDON" or "Three Bedroom Flat in W6 9UF")
        const title = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');

        // Check if H1 already contains a UK postcode (some JB pages do, some don't)
        const postcodeInTitle = title.match(/[A-Z]{1,2}\d[\dA-Z]?\s?\d[A-Z]{2}/i);
        let address = title;

        if (!postcodeInTitle) {
            // H1 just says "in London" — get address from the listing page where the postcode is shown on the card
            const propertyIdMatch = url.match(/\/property\/(\d+)/);
            if (propertyIdMatch) {
                const propId = propertyIdMatch[1];
                console.log(`[PropertyImport] JB detail page has no postcode in H1, checking listing pages for property ${propId}...`);

                // Try both sale and rental listing pages
                const listingUrls = isRental
                    ? ['https://www.johnbarclay.co.uk/properties/for/rent', 'https://www.johnbarclay.co.uk/properties/for/sale']
                    : ['https://www.johnbarclay.co.uk/properties/for/sale', 'https://www.johnbarclay.co.uk/properties/for/rent'];

                for (const listingUrl of listingUrls) {
                    try {
                        await page.goto(listingUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
                        // Find the property card by its link href containing the property ID
                        const cardAddress = await page.evaluate((pid: string) => {
                            // Find all links that point to this property
                            const links = document.querySelectorAll(`a[href*="/property/${pid}/"]`);
                            for (const link of links) {
                                // The card's parent li or container should have an h3 with the address
                                const card = link.closest('li') || link.parentElement;
                                if (card) {
                                    const h3s = card.querySelectorAll('h3');
                                    for (const h3 of h3s) {
                                        const text = h3.textContent?.trim() || '';
                                        // The address h3 contains the postcode (e.g. "W10 4RG, London" or "Harrow Road, W9 3NF")
                                        if (/[A-Z]{1,2}\d[\dA-Z]?\s?\d[A-Z]{2}/i.test(text)) {
                                            return text;
                                        }
                                    }
                                }
                            }
                            return '';
                        }, propId).catch(() => '');

                        if (cardAddress) {
                            address = cardAddress;
                            console.log(`[PropertyImport] Found address from listing page: "${address}"`);
                            break;
                        }
                    } catch (e) {
                        console.log(`[PropertyImport] Failed to check listing page ${listingUrl}:`, e);
                    }
                }

                // Navigate back to the detail page for remaining scraping
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
            }
        } else {
            console.log(`[PropertyImport] JB H1 contains postcode: "${title}"`);
        }

        // Price from div.price-label (contains "Price: £427 /pw" with £ as &pound; and amount in <span>)
        const price = await page.evaluate(() => {
            const priceEl = document.querySelector('.price-label');
            if (priceEl) {
                const text = priceEl.textContent || '';
                const match = text.match(/[\d,]+/);
                if (match) return parseInt(match[0].replace(/,/g, ''));
            }
            // Fallback: search body text for £ amount
            const bodyText = document.body.textContent || '';
            const fallback = bodyText.match(/Price[:\s]*£?([\d,]+)/i) || bodyText.match(/£([\d,]+)/);
            return fallback ? parseInt(fallback[1].replace(/,/g, '')) : 0;
        }).catch(() => 0);

        // Price qualifier (pw = per week, pcm = per calendar month)
        const priceQualifier = await page.evaluate(() => {
            const abbr = document.querySelector('.price-label abbr');
            if (abbr) {
                const title = abbr.getAttribute('title') || abbr.textContent || '';
                if (title.toLowerCase().includes('week')) return 'per week';
                if (title.toLowerCase().includes('month')) return 'per month';
                return title;
            }
            return '';
        }).catch(() => '');

        // Description from div.property-desc (JB-specific class)
        const description = await page.evaluate(() => {
            // Strategy 1: Direct JB class selector
            const descEl = document.querySelector('.property-desc');
            if (descEl) {
                // Convert <br> tags to newlines for proper formatting
                const html = descEl.innerHTML || '';
                const formatted = html
                    .replace(/<br\s*\/?>\s*/gi, '\n')
                    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
                    .replace(/<[^>]+>/g, '')
                    .replace(/&nbsp;/gi, ' ')
                    .replace(/&amp;/gi, '&')
                    .replace(/&lt;/gi, '<')
                    .replace(/&gt;/gi, '>')
                    .replace(/\n{3,}/g, '\n\n')
                    .trim();
                if (formatted) return formatted;
            }

            // Strategy 2: Walk siblings after h2 "Property Description"
            const headings = Array.from(document.querySelectorAll('h2, h3'));
            for (const h of headings) {
                if (h.textContent?.toLowerCase().includes('description')) {
                    let desc = '';
                    let next = h.nextElementSibling;
                    while (next && next.tagName !== 'H2' && next.tagName !== 'H3') {
                        const text = next.textContent?.trim() || '';
                        if (text) {
                            desc += (desc ? '\n\n' : '') + text;
                        }
                        next = next.nextElementSibling;
                    }
                    if (desc) return desc;
                }
            }

            // Strategy 3: Largest text block fallback
            const allParagraphs = Array.from(document.querySelectorAll('p'));
            let longestText = '';
            for (const p of allParagraphs) {
                const text = p.textContent?.trim() || '';
                if (text.length > longestText.length && text.length > 80) {
                    longestText = text;
                }
            }
            return longestText;
        }).catch(() => '');

        console.log(`[PropertyImport] JohnBarclay description extracted: ${description ? description.substring(0, 100) + '...' : 'EMPTY'}`);

        // Features from ul.property-feature-list (JB splits into two columns, so multiple ULs)
        const features = await page.evaluate(() => {
            // Strategy 1: Direct JB class selector - get ALL feature lists
            const featureLists = document.querySelectorAll('.property-feature-list');
            if (featureLists.length > 0) {
                const items: string[] = [];
                featureLists.forEach(ul => {
                    ul.querySelectorAll('li').forEach(li => {
                        const text = li.textContent?.trim();
                        if (text) items.push(text);
                    });
                });
                if (items.length > 0) return items;
            }

            // Strategy 2: Walk from "Key Features" heading
            const headings = Array.from(document.querySelectorAll('h2'));
            for (const h of headings) {
                if (h.textContent?.toLowerCase().includes('feature')) {
                    // Features may be nested in divs, not direct siblings
                    const parent = h.parentElement;
                    if (parent) {
                        const lis = parent.querySelectorAll('li');
                        if (lis.length > 0) {
                            return Array.from(lis).map(li => li.textContent?.trim() || '').filter(Boolean);
                        }
                    }
                }
            }
            return [];
        }).catch(() => []);

        // Bedrooms/bathrooms from structured spec elements
        const { bedrooms, bathrooms, propertyType } = await page.evaluate(() => {
            let beds = 0, baths = 0, pType = '';

            // JB structured data: li.specs-beds, li.specs-baths, div.type-label
            const bedsEl = document.querySelector('.specs-beds');
            if (bedsEl) {
                const match = bedsEl.textContent?.match(/(\d+)/);
                if (match) beds = parseInt(match[1]);
            }

            const bathsEl = document.querySelector('.specs-baths');
            if (bathsEl) {
                const match = bathsEl.textContent?.match(/(\d+)/);
                if (match) baths = parseInt(match[1]);
            }

            const typeEl = document.querySelector('.type-label');
            if (typeEl) {
                pType = typeEl.textContent?.trim().toLowerCase() || '';
            }

            // Fallback: parse from body text
            if (!beds) {
                const bodyText = document.body.textContent || '';
                const wordToNum: Record<string, number> = {
                    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
                    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
                };
                const bedMatch = bodyText.match(/(\d+)\s*(?:bed(?:room)?s?)/i);
                if (bedMatch) {
                    beds = parseInt(bedMatch[1]);
                } else {
                    const bedWordMatch = bodyText.match(/(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:bed(?:room)?s?)/i);
                    if (bedWordMatch) beds = wordToNum[bedWordMatch[1].toLowerCase()] || 0;
                }
            }
            if (!baths) {
                const bodyText = document.body.textContent || '';
                const bathMatch = bodyText.match(/(\d+)\s*bath/i);
                if (bathMatch) baths = parseInt(bathMatch[1]);
            }
            if (!pType) {
                const bodyText = document.body.textContent || '';
                const typeMatch = bodyText.match(/\b(flat|apartment|house|bungalow|maisonette|studio|detached|semi-detached|terraced|cottage)\b/i);
                if (typeMatch) pType = typeMatch[1].toLowerCase();
            }

            return { bedrooms: beds, bathrooms: baths, propertyType: pType };
        }).catch(() => ({ bedrooms: 0, bathrooms: 0, propertyType: '' }));

        const sqftMatch = (await page.$eval('body', el => el.textContent || '').catch(() => '')).match(/([\d,]+)\s*sq\.?\s*ft/i);
        const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : 0;

        // Images: JB uses pattern /assets/content/properties/{id}/photos/{ref}_IMG_XX.jpg
        const propertyIdMatch = url.match(/\/property\/(\d+)/);
        const propertyId = propertyIdMatch ? propertyIdMatch[1] : null;

        let images: string[] = [];
        if (propertyId) {
            // Find all img tags with property photos
            images = await page.$$eval('img', (els, propId) => {
                const seen = new Set<string>();
                return els.map(el => el.getAttribute('src') || '')
                    .filter(src => {
                        if (!src || !src.includes(`/properties/${propId}/`) || !src.includes('/photos/')) return false;
                        if (seen.has(src)) return false;
                        seen.add(src);
                        return true;
                    });
            }, propertyId).catch(() => []);

            // Also check anchor hrefs for full-size images
            if (images.length === 0) {
                images = await page.$$eval('a', (els, propId) => {
                    const seen = new Set<string>();
                    return els.map(el => el.getAttribute('href') || '')
                        .filter(href => {
                            if (!href || !href.includes(`/properties/${propId}/`) || !href.includes('/photos/')) return false;
                            if (seen.has(href)) return false;
                            seen.add(href);
                            return true;
                        });
                }, propertyId).catch(() => []);
            }
        }

        // Make URLs absolute
        images = images.map(src => {
            if (src.startsWith('/')) return `https://johnbarclay.co.uk${src}`;
            return src;
        });

        return {
            title,
            address,
            price,
            priceQualifier: priceQualifier || undefined,
            description,
            features,
            bedrooms,
            bathrooms,
            sqft,
            images: images.slice(0, 15),
            propertyType,
            isRental
        };
    }

    private inferPropertyType(title: string): string {
        const titleLower = title.toLowerCase();
        if (titleLower.includes('flat') || titleLower.includes('apartment')) return 'flat';
        if (titleLower.includes('studio')) return 'studio';
        if (titleLower.includes('bungalow')) return 'bungalow';
        if (titleLower.includes('maisonette')) return 'maisonette';
        if (titleLower.includes('cottage')) return 'cottage';
        if (titleLower.includes('detached')) return 'detached';
        if (titleLower.includes('semi-detached') || titleLower.includes('semi detached')) return 'semi-detached';
        if (titleLower.includes('terraced') || titleLower.includes('terrace')) return 'terraced';
        if (titleLower.includes('house')) return 'house';
        return 'house';
    }

    private async downloadImages(urls: string[]): Promise<string[]> {
        const downloadDir = path.join(process.cwd(), 'uploads', 'properties');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const savedPaths: string[] = [];
        const seenSizes = new Set<number>(); // Track file sizes to detect duplicates

        for (const url of urls.slice(0, 10)) {
            try {
                const filename = `import-${randomUUID()}.jpg`;
                const filepath = path.join(downloadDir, filename);

                await this.downloadFile(url, filepath);

                // Check file size to detect duplicates (same image = same size)
                const stats = fs.statSync(filepath);
                if (stats.size < 1000) {
                    // Too small - probably an error page or placeholder
                    fs.unlinkSync(filepath);
                    continue;
                }

                if (seenSizes.has(stats.size)) {
                    // Duplicate image - same file size as one we already have
                    fs.unlinkSync(filepath);
                    continue;
                }

                seenSizes.add(stats.size);
                savedPaths.push(`/uploads/properties/${filename}`);
            } catch (e) {
                console.error(`Failed to download image ${url}:`, e);
            }
        }

        return savedPaths;
    }

    private downloadFile(url: string, dest: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            const protocol = url.startsWith('https') ? https : http;

            const request = protocol.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
                }
            }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        file.close();
                        fs.unlinkSync(dest);
                        return this.downloadFile(redirectUrl, dest).then(resolve).catch(reject);
                    }
                }

                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            });

            request.on('error', (err) => {
                fs.unlink(dest, () => {});
                reject(err);
            });

            request.setTimeout(15000, () => {
                request.destroy();
                reject(new Error('Download timeout'));
            });
        });
    }

    getSupportedPortals() {
        return [
            { id: 'rightmove', name: 'Rightmove', domain: 'rightmove.co.uk' },
            { id: 'zoopla', name: 'Zoopla', domain: 'zoopla.co.uk' },
            { id: 'onthemarket', name: 'OnTheMarket', domain: 'onthemarket.com' },
            { id: 'johnbarclay', name: 'John Barclay', domain: 'johnbarclay.co.uk' }
        ];
    }
}

export const propertyImport = new PropertyImportService();
