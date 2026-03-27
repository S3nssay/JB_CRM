import { chromium } from 'playwright';

async function checkHeroSection() {
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

    // Scroll to the very top
    await page.evaluate(() => {
      window.scrollTo(0, 0);
    });

    // Wait a moment for content to load
    await page.waitForTimeout(3000);

    // Take a screenshot of the hero section
    await page.screenshot({
      path: 'hero-section.png',
      clip: { x: 0, y: 0, width: 1920, height: 1080 }
    });

    console.log('Hero section screenshot saved as hero-section.png');

    // Check for video element
    const hasVideo = await page.$('video') !== null;
    const videoSrc = hasVideo ? await page.$eval('video', el => el.src || el.querySelector('source')?.src || 'No src') : 'No video found';

    console.log('Video element found:', hasVideo);
    console.log('Video source:', videoSrc);

    // Check for John Barclay logo
    const logoElements = await page.$$('img[alt*="John"], img[alt*="Barclay"], img[src*="logo"]');
    console.log('Logo elements found:', logoElements.length);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkHeroSection();