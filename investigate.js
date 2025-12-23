import { chromium } from 'playwright';

async function investigate() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to http://localhost:5000/');

  try {
    await page.goto('http://localhost:5000/', { waitUntil: 'networkidle' });

    // Take a screenshot
    await page.screenshot({ path: 'investigation-screenshot.png', fullPage: true });
    console.log('Screenshot taken: investigation-screenshot.png');

    // Get page title
    const title = await page.title();
    console.log('Page title:', title);

    // Check if page has any visible content
    const bodyText = await page.locator('body').innerText();
    console.log('Body text length:', bodyText.length);
    console.log('First 200 characters:', bodyText.substring(0, 200));

    // Check for any errors in console
    page.on('console', msg => console.log('Browser console:', msg.text()));
    page.on('pageerror', error => console.log('Page error:', error.message));

    // Check if main elements are present
    const heroSection = await page.locator('[data-testid="hero-section"], .hero-section, #hero').count();
    console.log('Hero sections found:', heroSection);

    const mainContent = await page.locator('main, [role="main"], .main-content').count();
    console.log('Main content areas found:', mainContent);

    // Get all visible elements
    const visibleElements = await page.locator('*').filter({ hasText: /./ }).count();
    console.log('Visible elements with text:', visibleElements);

    // Check CSS loading
    const stylesheets = await page.locator('link[rel="stylesheet"]').count();
    console.log('Stylesheets loaded:', stylesheets);

    // Wait a bit to see if content loads dynamically
    await page.waitForTimeout(3000);

    // Take another screenshot after waiting
    await page.screenshot({ path: 'investigation-screenshot-after-wait.png', fullPage: true });
    console.log('Second screenshot taken: investigation-screenshot-after-wait.png');

  } catch (error) {
    console.error('Error during investigation:', error.message);

    // Take error screenshot
    await page.screenshot({ path: 'investigation-error-screenshot.png', fullPage: true });
  }

  await browser.close();
}

investigate();