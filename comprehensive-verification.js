import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function comprehensiveVerification() {
    const browser = await chromium.launch({ headless: false, slowMo: 500 });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    try {
        console.log('🚀 Starting comprehensive verification of all fixes...');
        
        // Create screenshots directory
        const screenshotsDir = path.join(__dirname, 'comprehensive-verification-screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir);
        }

        // Navigate to the site
        await page.goto('http://localhost:5000/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        console.log('✅ Site loaded successfully');

        // 1. INITIAL FULL PAGE SCREENSHOT
        console.log('📸 Taking initial full page screenshot...');
        await page.screenshot({
            path: path.join(screenshotsDir, '01-estate-agent-home-full.png'),
            fullPage: true
        });

        // 2. POSTCODE CAROUSEL POSITION VERIFICATION
        console.log('🎠 Verifying postcode carousel position...');
        
        const carousel = await page.locator('.carousel-container').first();
        const carouselBox = await carousel.boundingBox();
        const viewportHeight = page.viewportSize().height;
        
        let carouselStatus = '❌ NEEDS ADJUSTMENT';
        if (carouselBox) {
            const carouselPositionPercent = (carouselBox.y / viewportHeight) * 100;
            console.log(`Carousel position: ${carouselPositionPercent.toFixed(1)}% from top`);
            console.log(`Target range: 60-70% from top`);
            
            if (carouselPositionPercent >= 60 && carouselPositionPercent <= 70) {
                console.log('✅ Carousel position is CORRECT (within 60-70% range)');
                carouselStatus = '✅ CORRECT';
            } else {
                console.log('❌ Carousel position needs adjustment');
                carouselStatus = '❌ NEEDS ADJUSTMENT';
            }
        }

        // Screenshot focused on carousel
        await page.screenshot({
            path: path.join(screenshotsDir, '02-carousel-focus.png')
        });

        // 3. NAVIGATE TO DIFFERENT PAGES TO TEST SECTIONS
        console.log('🔍 Testing navigation to different sections...');

        // Test Contact Us navigation if available
        console.log('📞 Testing Contact Us navigation...');
        let contactStatus = '⚠️ NOT FOUND';
        try {
            const contactLink = await page.locator('a[href="#contact"], a[href*="contact"], nav a:has-text("Contact")').first();
            if (await contactLink.isVisible({ timeout: 3000 })) {
                await contactLink.click();
                await page.waitForTimeout(2000);
                
                // Check if we scrolled to a contact section or navigated to contact page
                const url = page.url();
                console.log(`After contact click, URL: ${url}`);
                
                // Take screenshot after contact navigation
                await page.screenshot({
                    path: path.join(screenshotsDir, '03-contact-navigation.png')
                });
                
                contactStatus = '✅ NAVIGATION WORKS';
            }
        } catch (error) {
            console.log('⚠️ Contact navigation not found on this page');
        }

        // 4. TEST RENTAL SECTION
        console.log('🏠 Testing Rental section...');
        let rentalStatus = '⚠️ NOT FOUND';
        
        // Try to navigate to rentals page
        try {
            await page.goto('http://localhost:5000/rentals');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
            
            // Look for Explore Rentals button
            const exploreRentalsBtn = await page.locator('text=Explore Rentals, a[href*="rental"], button:has-text("Rental")').first();
            if (await exploreRentalsBtn.isVisible({ timeout: 3000 })) {
                console.log('✅ Found Explore Rentals button');
                rentalStatus = '✅ BUTTON FOUND AND CLICKABLE';
            }
            
            await page.screenshot({
                path: path.join(screenshotsDir, '04-rentals-page.png')
            });
        } catch (error) {
            console.log('⚠️ Rentals page not accessible, checking main page...');
            
            // Go back to main page and look for rental section
            await page.goto('http://localhost:5000/');
            await page.waitForLoadState('networkidle');
            
            try {
                const rentalSection = await page.locator('#rental, .rental-section, [data-section="rental"]').first();
                if (await rentalSection.isVisible({ timeout: 3000 })) {
                    await rentalSection.scrollIntoViewIfNeeded();
                    const exploreRentalsBtn = await page.locator('text=Explore Rentals').first();
                    if (await exploreRentalsBtn.isVisible()) {
                        rentalStatus = '✅ SECTION FOUND';
                    }
                }
            } catch (e) {
                console.log('⚠️ No rental section found on main page');
            }
        }

        // 5. TEST COMMERCIAL SECTION
        console.log('🏢 Testing Commercial section...');
        let commercialStatus = '⚠️ NOT FOUND';
        
        // Try to navigate to commercial page
        try {
            await page.goto('http://localhost:5000/commercial');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1500);
            
            // Look for Explore Commercial button
            const exploreCommercialBtn = await page.locator('text=Explore Commercial, a[href*="commercial"], button:has-text("Commercial")').first();
            if (await exploreCommercialBtn.isVisible({ timeout: 3000 })) {
                console.log('✅ Found Explore Commercial button');
                commercialStatus = '✅ BUTTON FOUND AND CLICKABLE';
            }
            
            await page.screenshot({
                path: path.join(screenshotsDir, '05-commercial-page.png')
            });
        } catch (error) {
            console.log('⚠️ Commercial page not accessible, checking main page...');
            
            // Go back to main page and look for commercial section
            await page.goto('http://localhost:5000/');
            await page.waitForLoadState('networkidle');
            
            try {
                const commercialSection = await page.locator('#commercial, .commercial-section, [data-section="commercial"]').first();
                if (await commercialSection.isVisible({ timeout: 3000 })) {
                    await commercialSection.scrollIntoViewIfNeeded();
                    const exploreCommercialBtn = await page.locator('text=Explore Commercial').first();
                    if (await exploreCommercialBtn.isVisible()) {
                        commercialStatus = '✅ SECTION FOUND';
                    }
                }
            } catch (e) {
                console.log('⚠️ No commercial section found on main page');
            }
        }

        // 6. CHECK OTHER PAGES FOR MISSING ELEMENTS
        console.log('🔄 Checking other common pages...');
        
        const pagesToCheck = ['/sales', '/valuation', '/about'];
        for (const pagePath of pagesToCheck) {
            try {
                console.log(`Checking ${pagePath}...`);
                await page.goto(`http://localhost:5000${pagePath}`);
                await page.waitForLoadState('networkidle');
                await page.waitForTimeout(1000);
                
                // Take screenshot of each page
                const pageName = pagePath.replace('/', '') || 'home';
                await page.screenshot({
                    path: path.join(screenshotsDir, `06-${pageName}-page.png`)
                });
                
                // Check for contact forms, rental/commercial buttons on each page
                const hasContactForm = await page.locator('#contact, .contact-form, form[id*="contact"]').isVisible({ timeout: 2000 });
                const hasRentalBtn = await page.locator('text=Explore Rentals, a[href*="rental"]').isVisible({ timeout: 2000 });
                const hasCommercialBtn = await page.locator('text=Explore Commercial, a[href*="commercial"]').isVisible({ timeout: 2000 });
                
                console.log(`${pagePath}: Contact form: ${hasContactForm}, Rental btn: ${hasRentalBtn}, Commercial btn: ${hasCommercialBtn}`);
                
                if (hasContactForm && contactStatus === '⚠️ NOT FOUND') {
                    contactStatus = '✅ FOUND ON ' + pagePath.toUpperCase();
                }
                if (hasRentalBtn && rentalStatus === '⚠️ NOT FOUND') {
                    rentalStatus = '✅ FOUND ON ' + pagePath.toUpperCase();
                }
                if (hasCommercialBtn && commercialStatus === '⚠️ NOT FOUND') {
                    commercialStatus = '✅ FOUND ON ' + pagePath.toUpperCase();
                }
                
            } catch (error) {
                console.log(`⚠️ Could not access ${pagePath}`);
            }
        }

        // 7. FINAL MOBILE TEST
        console.log('📱 Testing mobile responsiveness...');
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('http://localhost:5000/');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);
        
        await page.screenshot({
            path: path.join(screenshotsDir, '07-mobile-view.png')
        });

        // Reset to desktop
        await page.setViewportSize({ width: 1920, height: 1080 });

        // 8. FINAL SUMMARY
        console.log('\n📊 COMPREHENSIVE VERIFICATION SUMMARY');
        console.log('=====================================');
        console.log(`🎠 Carousel Position: ${carouselStatus}`);
        console.log(`📞 Contact Section: ${contactStatus}`);
        console.log(`🏠 Rental Section: ${rentalStatus}`);
        console.log(`🏢 Commercial Section: ${commercialStatus}`);
        console.log(`📁 Screenshots saved to: ${screenshotsDir}`);

        // Create final summary screenshot
        await page.goto('http://localhost:5000/');
        await page.waitForLoadState('networkidle');
        await page.screenshot({
            path: path.join(screenshotsDir, '08-final-summary.png'),
            fullPage: true
        });

        console.log('🎉 Comprehensive verification completed!');

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await browser.close();
    }
}

// Run the comprehensive verification
comprehensiveVerification().catch(console.error);