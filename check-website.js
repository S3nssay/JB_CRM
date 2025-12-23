import { chromium } from 'playwright';

async function checkWebsite() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Wait a moment for any dynamic content
    await page.waitForTimeout(3000);

    // Take a screenshot
    await page.screenshot({
      path: 'website-current-state.png',
      fullPage: true
    });

    // Get the page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check what's in the body
    const bodyContent = await page.evaluate(() => {
      return document.body.innerText.substring(0, 500);
    });
    console.log('Body content (first 500 chars):', bodyContent);

    // Check for key elements
    const hasHeroSection = await page.$('.hero-section, [class*="hero"], video') !== null;
    const hasChatBot = await page.$('[class*="chat"], [class*="message"]') !== null;
    const hasJohnBarclayContent = await page.locator('text=John Barclay').count() > 0;

    console.log('Analysis:');
    console.log('- Has hero section/video:', hasHeroSection);
    console.log('- Has chat elements:', hasChatBot);
    console.log('- Has John Barclay content:', hasJohnBarclayContent);

    // Get all headings
    const headings = await page.$$eval('h1, h2, h3', elements =>
      elements.map(el => el.textContent.trim()).filter(text => text.length > 0)
    );
    console.log('Headings found:', headings);

  } catch (error) {
    console.error('Error checking website:', error.message);

    // Try to get any console errors from the page
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));
  } finally {
    await browser.close();
  }
}

checkWebsite();