import { chromium } from 'playwright';

async function verifyPositioning() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    console.log('🔍 Verifying positioning fixes...');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // 1. Check John Barclay logo positioning and size
    console.log('\n📊 Checking John Barclay logo positioning...');
    const logos = await page.locator('img[alt="John Barclay Estate & Management"]').all();
    for (let i = 0; i < logos.length; i++) {
      if (await logos[i].isVisible()) {
        const bounds = await logos[i].boundingBox();
        console.log(`Logo ${i + 1}:`, {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          centerX: bounds.x + bounds.width / 2
        });
      }
    }

    // 2. Check postcode carousel position
    console.log('\n🎠 Checking postcode carousel position...');
    const carousel = await page.locator('[ref="carouselRef"], .carousel-container').first();
    if (await carousel.isVisible()) {
      const carouselBounds = await carousel.boundingBox();
      console.log('Carousel bounds:', carouselBounds);

      // Check if it's near bottom of viewport
      const distanceFromBottom = 1080 - (carouselBounds.y + carouselBounds.height);
      console.log('Distance from bottom:', distanceFromBottom + 'px');
    }

    // 3. Check chatbot position for reference
    console.log('\n🤖 Checking chatbot position...');
    const chatElements = ['.chatbot', '[data-testid="chatbot"]', '.ai-chat'];
    for (const selector of chatElements) {
      const chatbot = await page.locator(selector).first();
      if (await chatbot.isVisible()) {
        const chatBounds = await chatbot.boundingBox();
        console.log('Chatbot bounds:', chatBounds);
        break;
      }
    }

    // 4. Scroll to history section and check vertical text
    console.log('\n📜 Checking history section vertical text...');
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    const scrollingText = await page.locator('#scrolling-background-text').first();
    if (await scrollingText.isVisible()) {
      const textBounds = await scrollingText.boundingBox();
      console.log('✅ Scrolling text is visible:', textBounds);

      // Take screenshot of history section with text
      await page.screenshot({
        path: 'history-with-text-verification.png',
        clip: { x: 0, y: 0, width: 1920, height: 1080 }
      });
      console.log('📸 History section verification screenshot saved');
    } else {
      console.log('❌ Scrolling text still not visible');
    }

    // 5. Test contact section timing
    console.log('\n⏱️ Testing contact section scroll timing...');

    // Scroll to team section
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 6, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    const contactSection = await page.locator('[ref="contactRef"]').first();
    if (await contactSection.isVisible()) {
      const contactBounds = await contactSection.boundingBox();
      console.log('Contact section at team position:', {
        y: contactBounds.y,
        visible: contactBounds.y < 1080
      });
    }

    // Scroll further to trigger contact
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 8, behavior: 'smooth' }));
    await page.waitForTimeout(1000);

    if (await contactSection.isVisible()) {
      const contactBounds = await contactSection.boundingBox();
      console.log('Contact section after scroll:', {
        y: contactBounds.y,
        fullyVisible: contactBounds.y <= 0
      });
    }

    // 6. Take final verification screenshots
    console.log('\n📸 Taking final verification screenshots...');

    // Hero section with repositioned carousel
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'hero-carousel-verification.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });

    // Sales section with logo
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 3, behavior: 'smooth' }));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'sales-logo-verification.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });

    // Team section
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 6, behavior: 'smooth' }));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'team-section-verification.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });

    console.log('\n✅ Position verification complete!');
    console.log('Check the generated verification screenshots for visual confirmation.');

  } catch (error) {
    console.error('❌ Error during verification:', error);
  } finally {
    await browser.close();
  }
}

verifyPositioning();