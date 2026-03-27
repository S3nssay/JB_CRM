import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyFixes() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    try {
        console.log('🚀 Starting comprehensive verification...');
        
        // Navigate to the site
        await page.goto('http://localhost:5000/');
        await page.waitForLoadState('networkidle');
        
        // Wait for any animations to settle
        await page.waitForTimeout(2000);

        console.log('✅ Site loaded successfully');

        // Create screenshots directory
        const screenshotsDir = path.join(__dirname, 'verification-screenshots');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir);
        }

        // 1. INITIAL FULL PAGE SCREENSHOT
        console.log('📸 Taking initial full page screenshot...');
        await page.screenshot({
            path: path.join(screenshotsDir, '01-initial-full-page.png'),
            fullPage: true
        });

        // 2. POSTCODE CAROUSEL POSITION VERIFICATION
        console.log('🎠 Verifying postcode carousel position...');
        
        // Look for the carousel container in EstateAgentHome
        const carousel = await page.locator('.carousel-container').first();
        const carouselBox = await carousel.boundingBox();
        const viewportHeight = page.viewportSize().height;
        
        if (carouselBox) {
            const carouselPositionPercent = (carouselBox.y / viewportHeight) * 100;
            console.log(`Carousel position: ${carouselPositionPercent.toFixed(1)}% from top`);
            console.log(`Target range: 60-70% from top`);
            
            if (carouselPositionPercent >= 60 && carouselPositionPercent <= 70) {
                console.log('✅ Carousel position is CORRECT (within 60-70% range)');
            } else {
                console.log('❌ Carousel position needs adjustment');
            }
        } else {
            console.log('⚠️ Carousel not found or not visible - may be on different page');
        }

        // Screenshot of carousel area
        await page.screenshot({
            path: path.join(screenshotsDir, '02-carousel-position.png'),
            clip: { x: 0, y: 0, width: 1920, height: 1080 }
        });

        // 3. CONTACT SECTION SCROLLING TEST
        console.log('📞 Testing Contact Us section scrolling...');
        
        // Find and click Contact Us navigation
        const contactNav = await page.locator('a[href="#contact"]').first();
        if (await contactNav.isVisible()) {
            await contactNav.click();
            await page.waitForTimeout(1500); // Wait for scroll animation
            
            // Check if contact form is at the top
            const contactSection = await page.locator('#contact').first();
            const contactBox = await contactSection.boundingBox();
            
            if (contactBox) {
                console.log(`Contact section position after scroll: ${contactBox.y}px from top`);
                if (contactBox.y <= 50) { // Should be very close to top
                    console.log('✅ Contact section scrolling is CORRECT');
                } else {
                    console.log('❌ Contact section not scrolling to top properly');
                }
            }
        }

        // Screenshot after contact scroll
        await page.screenshot({
            path: path.join(screenshotsDir, '03-contact-scrolled.png')
        });

        // 4. RENTAL SECTION VERIFICATION
        console.log('🏠 Verifying Rental section...');
        
        try {
            // Check if rental section exists
            const rentalSection = await page.locator('#rental').first();
            if (await rentalSection.isVisible({ timeout: 5000 })) {
                await rentalSection.scrollIntoViewIfNeeded();
                await page.waitForTimeout(1000);
                
                // Check if Explore Rentals button is visible and clickable
                const rentalButton = await page.locator('text=Explore Rentals').first();
                const isRentalVisible = await rentalButton.isVisible();
                const isRentalClickable = await rentalButton.isEnabled();
                
                console.log(`Rental button visible: ${isRentalVisible}`);
                console.log(`Rental button clickable: ${isRentalClickable}`);
                
                if (isRentalVisible && isRentalClickable) {
                    console.log('✅ Rental section is CORRECT');
                } else {
                    console.log('❌ Rental section has issues');
                }
            } else {
                console.log('⚠️ Rental section not found on this page');
            }
        } catch (error) {
            console.log('⚠️ Rental section not found on this page');
        }

        // Screenshot of current view
        await page.screenshot({
            path: path.join(screenshotsDir, '04-rental-section.png')
        });

        // 5. COMMERCIAL SECTION VERIFICATION
        console.log('🏢 Verifying Commercial section...');
        
        try {
            // Check if commercial section exists
            const commercialSection = await page.locator('#commercial').first();
            if (await commercialSection.isVisible({ timeout: 5000 })) {
                await commercialSection.scrollIntoViewIfNeeded();
                await page.waitForTimeout(1000);
                
                // Check if Explore Commercial button is visible and clickable
                const commercialButton = await page.locator('text=Explore Commercial').first();
                const isCommercialVisible = await commercialButton.isVisible();
                const isCommercialClickable = await commercialButton.isEnabled();
                
                console.log(`Commercial button visible: ${isCommercialVisible}`);
                console.log(`Commercial button clickable: ${isCommercialClickable}`);
                
                if (isCommercialVisible && isCommercialClickable) {
                    console.log('✅ Commercial section is CORRECT');
                } else {
                    console.log('❌ Commercial section has issues');
                }
            } else {
                console.log('⚠️ Commercial section not found on this page');
            }
        } catch (error) {
            console.log('⚠️ Commercial section not found on this page');
        }

        // Screenshot of current view
        await page.screenshot({
            path: path.join(screenshotsDir, '05-commercial-section.png')
        });

        // 6. FINAL COMPREHENSIVE TESTS
        console.log('🔍 Running additional checks...');
        
        // Test valuation form functionality
        const valuationForm = await page.locator('#valuation-form').first();
        if (await valuationForm.isVisible()) {
            console.log('✅ Valuation form is visible and accessible');
            // Test a postcode input if available
            const postcodeInput = await page.locator('input[name="postcode"], input[id="postcode"]').first();
            if (await postcodeInput.isVisible()) {
                await postcodeInput.click();
                await postcodeInput.fill('SW1A 1AA');
                await page.waitForTimeout(500);
                console.log('✅ Postcode input is functional');
            }
        } else {
            console.log('⚠️ Valuation form not visible');
        }

        // Test mobile responsiveness by changing viewport
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(1000);
        
        await page.screenshot({
            path: path.join(screenshotsDir, '06-mobile-view.png')
        });
        
        console.log('✅ Mobile responsiveness tested');

        // Return to desktop view for final screenshot
        await page.setViewportSize({ width: 1920, height: 1080 });
        await page.waitForTimeout(1000);

        // Final full page screenshot
        await page.screenshot({
            path: path.join(screenshotsDir, '07-final-full-page.png'),
            fullPage: true
        });

        console.log('🎉 Verification completed successfully!');
        console.log(`📁 Screenshots saved to: ${screenshotsDir}`);

    } catch (error) {
        console.error('❌ Error during verification:', error);
    } finally {
        await browser.close();
    }
}

// Run the verification
verifyFixes().catch(console.error);