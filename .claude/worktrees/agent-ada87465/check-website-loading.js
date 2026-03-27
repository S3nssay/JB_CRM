import { chromium } from 'playwright';

async function checkWebsiteLoading() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    console.log('🌐 Testing website loading at http://localhost:5000...');

    // Navigate to the website with less strict waiting
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Check if the page title was updated correctly
    const title = await page.title();
    console.log(`📄 Page title: "${title}"`);

    // Check if main elements are present
    const heroSection = await page.locator('.hero-section').count();
    console.log(`🏠 Hero section found: ${heroSection > 0 ? 'Yes' : 'No'}`);

    // Check console errors
    const messages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        messages.push(`❌ Console error: ${msg.text()}`);
      }
    });

    // Wait a bit to catch any async errors
    await page.waitForTimeout(3000);

    // Check if contact form is present
    const contactForm = await page.locator('form').count();
    console.log(`📝 Contact forms found: ${contactForm}`);

    // Take a screenshot
    await page.screenshot({ path: 'website-check.png', fullPage: true });
    console.log('📸 Screenshot saved as website-check.png');

    // Log any errors found
    if (messages.length > 0) {
      console.log('\n🚨 Errors found:');
      messages.forEach(msg => console.log(msg));
    } else {
      console.log('✅ No console errors detected');
    }

    console.log('\n✅ Website loading test completed successfully');

  } catch (error) {
    console.error('❌ Error testing website:', error.message);

    // Try to get network errors
    try {
      await page.screenshot({ path: 'website-error.png', fullPage: true });
      console.log('📸 Error screenshot saved as website-error.png');
    } catch (screenshotError) {
      console.log('Could not capture error screenshot');
    }
  }

  await browser.close();
}

checkWebsiteLoading().catch(console.error);