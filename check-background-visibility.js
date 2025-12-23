import { chromium } from 'playwright';

async function checkBackgroundVisibility() {
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

    await page.waitForTimeout(3000);

    // Navigate to history section
    await page.evaluate(() => {
      window.scrollTo(0, 1200);
    });

    await page.waitForTimeout(2000);

    // Check background text styling
    const backgroundTextInfo = await page.evaluate(() => {
      const backgroundText = document.getElementById('scrolling-background-text');
      if (backgroundText) {
        const container = backgroundText.closest('[class*="opacity"]');
        const computedStyle = window.getComputedStyle(backgroundText);
        const containerStyle = container ? window.getComputedStyle(container) : null;

        // Get all text elements
        const textElements = backgroundText.querySelectorAll('h1, h2, h3');
        const textStyles = Array.from(textElements).map(el => {
          const style = window.getComputedStyle(el);
          return {
            tagName: el.tagName,
            text: el.textContent,
            color: style.color,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            visibility: style.visibility,
            display: style.display
          };
        });

        return {
          found: true,
          containerOpacity: containerStyle ? containerStyle.opacity : 'none',
          position: {
            top: backgroundText.getBoundingClientRect().top,
            right: backgroundText.getBoundingClientRect().right,
            width: backgroundText.getBoundingClientRect().width,
            height: backgroundText.getBoundingClientRect().height
          },
          textElements: textStyles,
          transform: computedStyle.transform
        };
      }
      return { found: false };
    });

    console.log('\n=== BACKGROUND TEXT VISIBILITY CHECK ===');
    if (backgroundTextInfo.found) {
      console.log(`Container opacity: ${backgroundTextInfo.containerOpacity}`);
      console.log(`Position - Top: ${backgroundTextInfo.position.top}, Right: ${backgroundTextInfo.position.right}`);
      console.log(`Size - Width: ${backgroundTextInfo.position.width}, Height: ${backgroundTextInfo.position.height}`);
      console.log(`Transform: ${backgroundTextInfo.transform}`);

      console.log('\nText elements:');
      backgroundTextInfo.textElements.forEach((el, i) => {
        console.log(`  ${i + 1}. ${el.tagName} - "${el.text}"`);
        console.log(`     Color: ${el.color}`);
        console.log(`     Font: ${el.fontSize}, Weight: ${el.fontWeight}`);
        console.log(`     Visibility: ${el.visibility}, Display: ${el.display}`);
      });
    } else {
      console.log('❌ Background text element not found!');
    }

    // Check what's behind the background text area
    const backgroundInfo = await page.evaluate(() => {
      // Get elements at the top-right corner where background text should be
      const rightSide = window.innerWidth - 100;
      const topSide = 200;

      const elementAtPosition = document.elementFromPoint(rightSide, topSide);
      const styles = elementAtPosition ? window.getComputedStyle(elementAtPosition) : null;

      return {
        elementTag: elementAtPosition?.tagName || 'none',
        elementClass: elementAtPosition?.className || 'none',
        backgroundColor: styles?.backgroundColor || 'none',
        color: styles?.color || 'none'
      };
    });

    console.log('\n=== BACKGROUND CONTEXT ===');
    console.log(`Element at position: ${backgroundInfo.elementTag}.${backgroundInfo.elementClass}`);
    console.log(`Background color: ${backgroundInfo.backgroundColor}`);
    console.log(`Text color: ${backgroundInfo.color}`);

    // Take screenshot for visual inspection
    await page.screenshot({
      path: 'background-text-visibility-check.png',
      fullPage: false
    });
    console.log('\nScreenshot saved for visual inspection');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

checkBackgroundVisibility();