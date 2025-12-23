import { chromium } from 'playwright';

async function checkWidths() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.scrollTo(0, 1200));
    await page.waitForTimeout(1000);

    const info = await page.evaluate(() => {
      const scrollContainer = document.querySelector('.w-1\\/2.h-full.bg-gray-50.overflow-x-auto');
      const flexContainer = scrollContainer?.querySelector('.h-full.flex');
      const panels = flexContainer?.querySelectorAll('div[style*="width"]');

      if (scrollContainer && flexContainer && panels) {
        return {
          scrollContainer: {
            width: scrollContainer.getBoundingClientRect().width,
            scrollWidth: scrollContainer.scrollWidth,
            clientWidth: scrollContainer.clientWidth
          },
          flexContainer: {
            width: flexContainer.getBoundingClientRect().width,
            scrollWidth: flexContainer.scrollWidth
          },
          panelCount: panels.length,
          firstPanelStyle: panels[0]?.getAttribute('style'),
          firstPanelWidth: panels[0]?.getBoundingClientRect().width
        };
      }
      return { error: 'Elements not found' };
    });

    console.log('Width Analysis:', JSON.stringify(info, null, 2));

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkWidths();