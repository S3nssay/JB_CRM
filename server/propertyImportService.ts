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

    async importFromUrl(url: string, userId?: number, saveToDb: boolean = true): Promise<ImportResult> {
        console.log(`[PropertyImport] Starting import from ${url}`);

        try {
            const portal = this.detectPortal(url);
            const data = await this.scrapeProperty(url, portal);

            if (!saveToDb) {
                return { success: true, scraped: data, portal };
            }

            const downloadedImages = await this.downloadImages(data.images);

            const postcodeMatch = data.address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
            const postcode = postcodeMatch ? postcodeMatch[0].toUpperCase() : '';
            const addressLine1 = data.address.replace(postcode, '').trim().replace(/,\s*$/, '').replace(/\s+/g, ' ');

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
                isRental: data.isRental ?? false,
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
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
            await page.waitForTimeout(2000);

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

            return data;
        } finally {
            await page.close();
        }
    }

    private async scrapeRightmove(page: Page, url: string): Promise<ScrapedPropertyData> {
        const isRental = url.includes('/property-to-rent/') || url.includes('channel=RES_LET');

        // Use page.$eval and page.$$eval instead of page.evaluate to avoid __name issues
        const title = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');
        const address = title;

        const priceStr = await page.$eval('[data-testid="price"], .propertyHeaderPrice, ._1gfnqJ3Vtd1z40MlC0MzXu span',
            el => el.textContent?.trim() || '0').catch(() => '0');
        const price = parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;

        let priceQualifier = '';
        if (priceStr.toLowerCase().includes('pcm')) priceQualifier = 'pcm';
        else if (priceStr.toLowerCase().includes('pw')) priceQualifier = 'pw';

        const description = await page.$eval('[data-testid="truncated_text_container"], .STw8udCxUaBUMfOOZu0iL',
            el => el.textContent?.trim() || '').catch(() => '');

        const features = await page.$$eval('._3mqo0D0b4I7jLjJpXwT4XH li, .lIhZ24u1NHMa5Y6gDH90A',
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

        const description = await page.$eval('[data-testid="listing_description"], .css-1b14d9v',
            el => el.textContent?.trim() || '').catch(() => '');

        const features = await page.$$eval('[data-testid="listing_features"] li, .css-58s6g2 li',
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

        const description = await page.$eval('.property-description, [class*="description"]',
            el => el.textContent?.trim() || '').catch(() => '');

        const features = await page.$$eval('.property-features li, [class*="features"] li, .key-features li',
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

        // John Barclay uses minimal CSS classes - semantic HTML only
        // Title is in H1
        const title = await page.$eval('h1', el => el.textContent?.trim() || '').catch(() => '');

        // Address is in the title or look for location context
        const address = title;

        // Price is in a paragraph containing "Price:" or "£" symbol
        const pageText = await page.$eval('body', el => el.textContent || '').catch(() => '');

        // Try to find price - look for "Price: £XXX" pattern
        const priceMatch = pageText.match(/Price[:\s]*£([\d,]+)/i) || pageText.match(/£([\d,]+(?:,\d{3})*)/);
        const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

        // Description follows "Property Description" heading
        const description = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('h2'));
            for (const h of headings) {
                if (h.textContent?.toLowerCase().includes('description')) {
                    // Get all following paragraph siblings
                    let desc = '';
                    let next = h.nextElementSibling;
                    while (next && next.tagName !== 'H2') {
                        if (next.tagName === 'P') {
                            desc += (desc ? ' ' : '') + (next.textContent?.trim() || '');
                        }
                        next = next.nextElementSibling;
                    }
                    return desc;
                }
            }
            return '';
        }).catch(() => '');

        // Features follow "Key Features" heading - may be a list
        const features = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('h2'));
            for (const h of headings) {
                if (h.textContent?.toLowerCase().includes('feature')) {
                    let next = h.nextElementSibling;
                    // Check for UL/OL list
                    if (next && (next.tagName === 'UL' || next.tagName === 'OL')) {
                        return Array.from(next.querySelectorAll('li')).map(li => li.textContent?.trim() || '').filter(Boolean);
                    }
                }
            }
            return [];
        }).catch(() => []);

        // Extract property details from page text
        // Handle both numeric (3 bed) and word-based (one bedroom) formats
        const wordToNum: Record<string, number> = {
            'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
            'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
        };

        // Try numeric first, then word-based
        let bedrooms = 0;
        const bedNumMatch = pageText.match(/(\d+)\s*(?:bed(?:room)?s?|double bedroom)/i);
        if (bedNumMatch) {
            bedrooms = parseInt(bedNumMatch[1]);
        } else {
            const bedWordMatch = pageText.match(/(one|two|three|four|five|six|seven|eight|nine|ten)\s*(?:bed(?:room)?s?|double bedroom)/i);
            if (bedWordMatch) {
                bedrooms = wordToNum[bedWordMatch[1].toLowerCase()] || 0;
            }
        }

        let bathrooms = 0;
        const bathNumMatch = pageText.match(/(\d+)\s*bath/i);
        if (bathNumMatch) {
            bathrooms = parseInt(bathNumMatch[1]);
        } else {
            const bathWordMatch = pageText.match(/(one|two|three|four|five)\s*bath/i);
            if (bathWordMatch) {
                bathrooms = wordToNum[bathWordMatch[1].toLowerCase()] || 0;
            }
        }

        const sqftMatch = pageText.match(/([\d,]+)\s*sq\.?\s*ft/i);
        const sqft = sqftMatch ? parseInt(sqftMatch[1].replace(',', '')) : 0;

        // Images on John Barclay are in anchor links, src pattern: /assets/content/properties/{id}/photos/{n}.JPG
        // Extract property ID from URL
        const propertyIdMatch = url.match(/\/property\/(\d+)/);
        const propertyId = propertyIdMatch ? propertyIdMatch[1] : null;

        let images: string[] = [];

        if (propertyId) {
            // Try to find images by pattern - check for img tags with the property ID in src
            images = await page.$$eval('img', (els, propId) => {
                return els.map(el => el.getAttribute('src') || '')
                    .filter(src => src && src.includes(`/properties/${propId}/`) && src.includes('/photos/'));
            }, propertyId).catch(() => []);

            // Also check anchor hrefs for full-size images
            if (images.length === 0) {
                images = await page.$$eval('a[href*="/photos/"]', (els, propId) => {
                    return els.map(el => el.getAttribute('href') || '')
                        .filter(href => href && href.includes(`/properties/${propId}/`));
                }, propertyId).catch(() => []);
            }

            // Fallback: construct image URLs directly if we know the pattern
            if (images.length === 0) {
                // Try fetching known image paths - John Barclay uses sequential numbering
                for (let i = 1; i <= 10; i++) {
                    images.push(`https://johnbarclay.co.uk/assets/content/properties/${propertyId}/photos/${i}.JPG`);
                }
            }
        }

        // Make URLs absolute
        images = images.map(src => {
            if (src.startsWith('/')) {
                return `https://johnbarclay.co.uk${src}`;
            }
            return src;
        });

        // Property type detection
        const propertyTypeMatch = pageText.match(/\b(flat|apartment|house|bungalow|maisonette|studio|detached|semi-detached|terraced|cottage)\b/i);
        const propertyType = propertyTypeMatch ? propertyTypeMatch[1].toLowerCase() : '';

        return {
            title,
            address,
            price,
            description,
            features,
            bedrooms,
            bathrooms,
            sqft,
            images: images.slice(0, 10),
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
