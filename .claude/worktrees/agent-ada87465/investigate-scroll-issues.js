import { chromium } from 'playwright';

async function investigateScrollIssues() {
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

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Check section order and positioning
    console.log('\n=== INVESTIGATING SECTION ORDER AND POSITIONING ===');

    // Check all sections and their z-index values
    const sections = await page.$$eval('section', sections => {
      return sections.map((section, index) => {
        const rect = section.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(section);
        const ref = section.getAttribute('class') || section.textContent?.substring(0, 50) || `section-${index}`;

        return {
          index,
          ref: ref.substring(0, 100),
          zIndex: computedStyle.zIndex,
          position: computedStyle.position,
          top: computedStyle.top,
          height: computedStyle.height,
          minHeight: computedStyle.minHeight,
          visibility: computedStyle.visibility,
          transform: computedStyle.transform,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          visible: rect.height > 0 && computedStyle.visibility !== 'hidden'
        };
      });
    });

    console.log('Section Analysis:');
    sections.forEach((section, i) => {
      console.log(`\nSection ${i}:`);
      console.log(`  Ref: ${section.ref}`);
      console.log(`  Z-Index: ${section.zIndex}`);
      console.log(`  Position: ${section.position}`);
      console.log(`  CSS Top: ${section.top}`);
      console.log(`  CSS Height: ${section.height}`);
      console.log(`  Min Height: ${section.minHeight}`);
      console.log(`  Transform: ${section.transform}`);
      console.log(`  Rect Y: ${section.y}`);
      console.log(`  Visible: ${section.visible}`);
    });

    // Check scroll behavior
    console.log('\n=== TESTING SCROLL BEHAVIOR ===');

    // Take initial screenshot
    await page.screenshot({ path: 'scroll-test-initial.png' });
    console.log('Initial screenshot saved');

    // Test scrolling to different sections
    const scrollPositions = [0, 500, 1000, 1500, 2000, 3000, 4000, 5000];

    for (let scrollPos of scrollPositions) {
      await page.evaluate((pos) => {
        window.scrollTo(0, pos);
      }, scrollPos);

      await page.waitForTimeout(1000);

      const currentSection = await page.evaluate(() => {
        const sections = Array.from(document.querySelectorAll('section'));
        return sections.map((section, index) => {
          const rect = section.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(section);
          return {
            index,
            visible: rect.y >= -100 && rect.y <= window.innerHeight + 100,
            y: rect.y,
            transform: computedStyle.transform,
            zIndex: computedStyle.zIndex
          };
        }).filter(s => s.visible);
      });

      console.log(`Scroll position ${scrollPos}px - Visible sections:`, currentSection);

      await page.screenshot({ path: `scroll-test-${scrollPos}px.png` });
    }

    // Check for any console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    if (errors.length > 0) {
      console.log('\n=== CONSOLE ERRORS ===');
      errors.forEach(error => console.log(`ERROR: ${error}`));
    }

    // Check specific history section
    console.log('\n=== HISTORY SECTION ANALYSIS ===');
    const historySection = await page.evaluate(() => {
      const historySection = document.querySelector('[class*="history"]') ||
                           Array.from(document.querySelectorAll('section')).find(s =>
                             s.textContent.includes('PRIME') || s.textContent.includes('HISTORY') || s.textContent.includes('OUR STORY')
                           );

      if (historySection) {
        const rect = historySection.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(historySection);
        return {
          found: true,
          className: historySection.className,
          zIndex: computedStyle.zIndex,
          position: computedStyle.position,
          height: computedStyle.height,
          minHeight: computedStyle.minHeight,
          transform: computedStyle.transform,
          y: rect.y,
          width: rect.width,
          height: rect.height
        };
      }
      return { found: false };
    });

    console.log('History Section:', historySection);

  } catch (error) {
    console.error('Error during investigation:', error.message);
  } finally {
    await browser.close();
  }
}

investigateScrollIssues();