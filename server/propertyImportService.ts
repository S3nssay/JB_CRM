import { chromium, Browser, Page } from 'playwright';
import { db } from './db';
import { properties, InsertProperty } from '@shared/schema';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import { randomUUID } from 'crypto';

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

    async importFromUrl(url: string, userId?: number): Promise<any> {
        console.log(`[PropertyImport] Starting import from ${url}`);

        // Validate URL
        if (!url.includes('johnbarclay.co.uk')) {
            throw new Error('Only johnbarclay.co.uk URLs are supported at this time.');
        }

        try {
            const browser = await this.getBrowser();
            const page = await browser.newPage();

            await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

            // Scrape details based on John Barclay website structure
            // Note: Selectors need to be verified against the actual site
            const data = await page.evaluate(() => {
                // Helper to clean price
                const parsePrice = (priceStr: string) => {
                    return parseInt(priceStr.replace(/[^0-9]/g, '')) || 0;
                };

                const title = document.querySelector('h1')?.textContent?.trim() || '';
                const address = document.querySelector('.address, .property-address')?.textContent?.trim() || title;
                const priceStr = document.querySelector('.price, .property-price')?.textContent?.trim() || '0';
                const description = document.querySelector('.description, .property-description')?.textContent?.trim() || '';

                // Extract features
                const featureElements = document.querySelectorAll('.features li, .property-features li');
                const features = Array.from(featureElements).map(el => el.textContent?.trim() || '').filter(Boolean);

                // Extract basic stats
                const bedStr = document.querySelector('.bedrooms, .icon-bed')?.textContent || '0';
                const bathStr = document.querySelector('.bathrooms, .icon-bath')?.textContent || '0';
                const sqftStr = document.querySelector('.sqft, .icon-ruler')?.textContent || '0';

                // Extract images
                const imageElements = document.querySelectorAll('.gallery img, .property-gallery img');
                const images = Array.from(imageElements).map((img: any) => img.src).filter((src: string) => src && !src.includes('placeholder'));

                return {
                    title,
                    address,
                    price: parsePrice(priceStr) * 100, // Convert to pence
                    description,
                    features,
                    bedrooms: parseInt(bedStr.replace(/[^0-9]/g, '')) || 0,
                    bathrooms: parseInt(bathStr.replace(/[^0-9]/g, '')) || 0,
                    sqft: parseInt(sqftStr.replace(/[^0-9]/g, '')) || 0,
                    images
                };
            });

            // Close page immediately after scraping
            await page.close();

            console.log(`[PropertyImport] Scraped data:`, { title: data.title, images: data.images.length });

            // Download images
            const downloadedImages = await this.downloadImages(data.images);
            const primaryImage = downloadedImages.length > 0 ? downloadedImages[0] : null;

            // Determine listing type based on price/url
            const listingType = url.includes('let') || url.includes('rent') ? 'rental' : 'sale';

            // Assume postcode from address (simplified)
            const postcodeMatch = data.address.match(/[A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2}/i);
            const postcode = postcodeMatch ? postcodeMatch[0] : '';
            const addressLine1 = data.address.replace(postcode, '').trim().replace(/,\s*$/, '');

            // Prepare Property Object
            const newProperty: InsertProperty = {
                title: data.title,
                description: data.description,
                addressLine1: addressLine1,
                postcode: postcode || 'UNKNOWN',
                price: data.price,
                bedrooms: data.bedrooms,
                bathrooms: data.bathrooms,
                sqft: data.sqft,
                propertyType: data.title.toLowerCase().includes('flat') || data.title.toLowerCase().includes('apartment') ? 'flat' : 'house',
                listingType: listingType,
                status: 'available',
                features: data.features,
                images: downloadedImages,
                primaryImage: primaryImage,
                agentId: userId
            };

            // Save to DB
            const [savedProperty] = await db.insert(properties).values(newProperty).returning();

            return savedProperty;

        } catch (error) {
            console.error('[PropertyImport] Error importing property:', error);
            throw error;
        }
    }

    private async downloadImages(urls: string[]): Promise<string[]> {
        const downloadDir = path.join(process.cwd(), 'uploads', 'properties');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }

        const savedPaths: string[] = [];

        // Limit to 5 images for speed
        for (const url of urls.slice(0, 5)) {
            try {
                const filename = `import-${randomUUID()}${path.extname(url) || '.jpg'}`;
                const filepath = path.join(downloadDir, filename);

                await this.downloadFile(url, filepath);
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
            https.get(url, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(dest, () => { }); // Delete the file async. (But we don't check the result) - fixed for simplicity
                reject(err);
            });
        });
    }
}

export const propertyImport = new PropertyImportService();
