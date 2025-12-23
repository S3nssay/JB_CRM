import { chromium } from 'playwright';

async function investigateTextCutoff() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    console.log('Navigating to http://localhost:5173/...');
    await page.goto('http://localhost:5173/', {
      waitUntil: 'networkidle',
      timeout: 10000
    });

    // Wait for content to load
    await page.waitForTimeout(3000);

    // Navigate to history section
    console.log('\n=== NAVIGATING TO HISTORY SECTION ===');
    await page.evaluate(() => {
      window.scrollTo(0, 1200); // Scroll to history section
    });

    await page.waitForTimeout(2000);

    // Take screenshot of history section
    await page.screenshot({
      path: 'history-section-text-cutoff.png',
      fullPage: false
    });
    console.log('History section screenshot saved');

    // Analyze text elements and their containers
    console.log('\n=== ANALYZING TEXT ELEMENTS IN HISTORY SECTION ===');

    const textAnalysis = await page.evaluate(() => {
      const historySection = document.querySelector('section[style*="z-index: 20"]') ||
                           Array.from(document.querySelectorAll('section')).find(s =>
                             s.textContent.includes('PRIME') || s.textContent.includes('OUR STORY')
                           );

      if (!historySection) {
        return { found: false };
      }

      const results = {
        found: true,
        elements: []
      };

      // Find all text containers in the history section
      const textContainers = historySection.querySelectorAll('div, p, h1, h2, h3, h4');

      textContainers.forEach((element, index) => {
        const rect = element.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(element);
        const text = element.textContent?.trim();

        if (text && text.length > 10) { // Only analyze elements with meaningful text
          const isCutOff = rect.width > 0 && (
            element.scrollWidth > element.clientWidth ||
            element.scrollHeight > element.clientHeight ||
            rect.right > window.innerWidth ||
            rect.left < 0
          );

          results.elements.push({
            index,
            tagName: element.tagName,
            className: element.className,
            text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
            width: rect.width,
            height: rect.height,
            left: rect.left,
            right: rect.right,
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
            isCutOff,
            maxWidth: computedStyle.maxWidth,
            overflow: computedStyle.overflow,
            overflowX: computedStyle.overflowX,
            padding: computedStyle.padding,
            margin: computedStyle.margin
          });
        }
      });

      return results;
    });

    if (textAnalysis.found) {
      console.log('Text Elements Analysis:');
      textAnalysis.elements.forEach((element, i) => {
        console.log(`\nElement ${i} (${element.tagName}):`);
        console.log(`  Class: ${element.className}`);
        console.log(`  Text: ${element.text}`);
        console.log(`  Dimensions: ${element.width}x${element.height}`);
        console.log(`  Position: left=${element.left}, right=${element.right}`);
        console.log(`  Scroll vs Client: ${element.scrollWidth}x${element.scrollHeight} vs ${element.clientWidth}x${element.clientHeight}`);
        console.log(`  Cut Off: ${element.isCutOff}`);
        console.log(`  Max Width: ${element.maxWidth}`);
        console.log(`  Overflow: ${element.overflow}, OverflowX: ${element.overflowX}`);

        if (element.isCutOff) {
          console.log(`  ⚠️  TEXT IS CUT OFF!`);
        }
      });

      // Focus on cut-off elements
      const cutOffElements = textAnalysis.elements.filter(e => e.isCutOff);
      if (cutOffElements.length > 0) {
        console.log(`\n=== ${cutOffElements.length} ELEMENTS WITH TEXT CUT-OFF FOUND ===`);
        cutOffElements.forEach(element => {
          console.log(`- ${element.tagName}.${element.className}: "${element.text}"`);
        });
      } else {
        console.log('\n✅ No text cut-off detected');
      }
    } else {
      console.log('❌ Could not find history section');
    }

    // Check specific column widths
    console.log('\n=== CHECKING COLUMN WIDTHS ===');
    const columnAnalysis = await page.evaluate(() => {
      const columns = {
        topLeft: document.querySelector('.w-1\\/2.h-full.bg-black'),
        topRight: document.querySelector('.h-1\\/2 .w-1\\/2:nth-child(2)'),
        bottomLeft: document.querySelector('.h-1\\/2:nth-child(2) .w-1\\/2:first-child'),
        bottomRight: document.querySelector('.h-1\\/2:nth-child(2) .w-1\\/2:nth-child(2)')
      };

      const results = {};

      Object.entries(columns).forEach(([name, element]) => {
        if (element) {
          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          results[name] = {
            width: rect.width,
            height: rect.height,
            padding: computedStyle.padding,
            maxWidth: computedStyle.maxWidth,
            className: element.className
          };
        } else {
          results[name] = { found: false };
        }
      });

      return results;
    });

    console.log('Column Analysis:');
    Object.entries(columnAnalysis).forEach(([name, data]) => {
      if (data.found !== false) {
        console.log(`\n${name}:`);
        console.log(`  Width: ${data.width}px`);
        console.log(`  Height: ${data.height}px`);
        console.log(`  Padding: ${data.padding}`);
        console.log(`  Max Width: ${data.maxWidth}`);
        console.log(`  Classes: ${data.className}`);
      } else {
        console.log(`\n${name}: Not found`);
      }
    });

    // Test horizontal scrolling area
    console.log('\n=== TESTING HORIZONTAL SCROLL CONTENT ===');
    await page.evaluate(() => {
      const scrollArea = document.querySelector('.overflow-x-auto');
      if (scrollArea) {
        scrollArea.scrollLeft = 300; // Scroll horizontally to see panels
      }
    });

    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'history-section-horizontal-scrolled.png',
      fullPage: false
    });
    console.log('Horizontal scrolled screenshot saved');

  } catch (error) {
    console.error('Error during investigation:', error.message);
  } finally {
    await browser.close();
  }
}

investigateTextCutoff();