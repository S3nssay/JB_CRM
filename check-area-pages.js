import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  const areas = [
    { name: 'Harlesden', url: 'http://localhost:5000/areas/harlesden', postcode: 'NW10' },
    { name: 'Bayswater', url: 'http://localhost:5000/areas/bayswater', postcode: 'W2' },
    { name: 'Maida Vale', url: 'http://localhost:5000/areas/maida-vale', postcode: 'W9' },
    { name: 'Kilburn', url: 'http://localhost:5000/areas/kilburn', postcode: 'NW6' }
  ];

  for (const area of areas) {
    try {
      console.log(`\n=== Checking ${area.name} (${area.postcode}) ===`);

      await page.goto(area.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(2000);

      // Check if page loaded
      const title = await page.textContent('h1');
      console.log(`Page title: ${title}`);

      // Check for updated market data
      const priceElements = await page.$$('[class*="font-bold text-blue-600"], [class*="text-2xl font-bold text-blue-600"]');
      if (priceElements.length > 0) {
        const price = await priceElements[0].textContent();
        console.log(`Average price found: ${price}`);
      } else {
        console.log('❌ No price data found');
      }

      // Check for purple back to top arrows
      const backToTopButtons = await page.$$('[class*="bg-[#8B4A9C]"]');
      console.log(`Back to top buttons found: ${backToTopButtons.length}`);

      // Check for rental data
      const rentalElements = await page.$$('text=/£.*bed/');
      console.log(`Rental data elements found: ${rentalElements.length}`);

      // Take screenshot
      await page.screenshot({ path: `${area.name.toLowerCase()}-check.png` });

    } catch (error) {
      console.log(`❌ Error checking ${area.name}: ${error.message}`);
    }
  }

  await browser.close();
})();