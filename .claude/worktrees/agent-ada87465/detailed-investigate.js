import { chromium } from 'playwright';

async function detailedInvestigate() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const consoleMessages = [];
  const pageErrors = [];

  // Capture console messages
  page.on('console', msg => {
    const message = `${msg.type()}: ${msg.text()}`;
    console.log('CONSOLE:', message);
    consoleMessages.push(message);
  });

  // Capture page errors
  page.on('pageerror', error => {
    const errorMessage = error.message;
    console.log('PAGE ERROR:', errorMessage);
    pageErrors.push(errorMessage);
  });

  // Capture failed requests
  page.on('requestfailed', request => {
    console.log('FAILED REQUEST:', request.url(), request.failure()?.errorText);
  });

  console.log('Navigating to http://localhost:5000/');

  try {
    // Try without waiting for networkidle first
    await page.goto('http://localhost:5000/', { waitUntil: 'domcontentloaded', timeout: 10000 });

    console.log('Page loaded, taking screenshot...');
    await page.screenshot({ path: 'detailed-investigation-initial.png', fullPage: true });

    // Get page HTML
    const html = await page.content();
    console.log('HTML length:', html.length);
    console.log('HTML sample:', html.substring(0, 500));

    // Check if React root is present
    const reactRoot = await page.locator('#root').count();
    console.log('React root elements found:', reactRoot);

    // Check for specific elements
    const bodyContent = await page.locator('body').innerHTML();
    console.log('Body innerHTML length:', bodyContent.length);

    // Wait a bit for any dynamic content
    await page.waitForTimeout(5000);

    // Take another screenshot
    await page.screenshot({ path: 'detailed-investigation-after-wait.png', fullPage: true });

    // Try to find any visible text
    const visibleText = await page.locator('body').innerText();
    console.log('Visible text:', visibleText || 'NO VISIBLE TEXT');

  } catch (error) {
    console.error('Error during investigation:', error.message);
    await page.screenshot({ path: 'detailed-investigation-error.png', fullPage: true });
  }

  console.log('\n=== SUMMARY ===');
  console.log('Console messages:', consoleMessages.length);
  consoleMessages.forEach(msg => console.log('  ', msg));
  console.log('Page errors:', pageErrors.length);
  pageErrors.forEach(error => console.log('  ', error));

  await browser.close();
}

detailedInvestigate();