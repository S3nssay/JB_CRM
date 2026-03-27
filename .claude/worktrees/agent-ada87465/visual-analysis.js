import { chromium } from 'playwright';
import fs from 'fs';

async function analyzeVisualIssues() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  // Set viewport size
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    // Navigate to the local development server
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Wait for initial load
    await page.waitForTimeout(2000);

    console.log('📸 Taking screenshots to analyze visual issues...');

    // 1. Hero section with postcode carousel
    await page.screenshot({
      path: 'hero-section.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('✅ Hero section screenshot saved');

    // Check logo positioning in hero section
    const heroLogo = await page.locator('img[alt="John Barclay Estate & Management"]').first();
    if (await heroLogo.isVisible()) {
      const logoBounds = await heroLogo.boundingBox();
      console.log('🏷️ Hero logo bounds:', logoBounds);
    }

    // 2. Scroll to history section
    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'history-section.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('✅ History section screenshot saved');

    // Check for scrolling background text in history section
    const scrollingText = await page.locator('#scrolling-background-text');
    if (await scrollingText.isVisible()) {
      const textBounds = await scrollingText.boundingBox();
      console.log('📜 Scrolling text bounds:', textBounds);
    } else {
      console.log('❌ Scrolling background text not found');
    }

    // 3. Scroll to sales section
    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 3, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'sales-section.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('✅ Sales section screenshot saved');

    // 4. Scroll to team section
    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 6, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'team-section.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('✅ Team section screenshot saved');

    // 5. Scroll to contact section timing
    await page.evaluate(() => {
      window.scrollTo({ top: window.innerHeight * 7, behavior: 'smooth' });
    });
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'contact-section.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });
    console.log('✅ Contact section screenshot saved');

    // Check postcode carousel position
    const postcodeCarousel = await page.locator('.postcode-carousel').first();
    if (await postcodeCarousel.isVisible()) {
      const carouselBounds = await postcodeCarousel.boundingBox();
      console.log('🎠 Postcode carousel bounds:', carouselBounds);
    }

    // Check chatbot icon position
    const chatbot = await page.locator('.chatbot-icon, [data-testid="chatbot"], .ai-chat').first();
    if (await chatbot.isVisible()) {
      const chatBounds = await chatbot.boundingBox();
      console.log('🤖 Chatbot bounds:', chatBounds);
    }

    console.log('🔍 Visual analysis complete. Check the generated screenshots.');

  } catch (error) {
    console.error('❌ Error during analysis:', error);
  } finally {
    await browser.close();
  }
}

analyzeVisualIssues();