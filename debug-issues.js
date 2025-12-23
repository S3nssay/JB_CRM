import { chromium } from 'playwright';

async function debugIssues() {
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
    console.log('Scrolling to history section...');
    await page.evaluate(() => {
      window.scrollTo(0, 1200);
    });

    await page.waitForTimeout(2000);

    // Take initial screenshot
    await page.screenshot({
      path: 'debug-history-section.png',
      fullPage: false
    });

    console.log('\n=== CHECKING BACKGROUND TEXT VISIBILITY ===');
    const textInfo = await page.evaluate(() => {
      const backgroundText = document.getElementById('scrolling-background-text');
      if (backgroundText) {
        const rect = backgroundText.getBoundingClientRect();
        const style = window.getComputedStyle(backgroundText);
        const parent = backgroundText.parentElement;
        const parentStyle = parent ? window.getComputedStyle(parent) : null;
        const grandParent = parent ? parent.parentElement : null;
        const grandParentStyle = grandParent ? window.getComputedStyle(grandParent) : null;

        // Get all text elements
        const textElements = backgroundText.querySelectorAll('h1, h2, h3');
        const texts = Array.from(textElements).map(el => ({
          tag: el.tagName,
          text: el.textContent,
          color: window.getComputedStyle(el).color,
          visibility: window.getComputedStyle(el).visibility,
          display: window.getComputedStyle(el).display,
          rect: el.getBoundingClientRect()
        }));

        return {
          found: true,
          position: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom },
          visibility: style.visibility,
          display: style.display,
          opacity: style.opacity,
          zIndex: style.zIndex,
          parentOpacity: parentStyle ? parentStyle.opacity : 'none',
          grandParentOpacity: grandParentStyle ? grandParentStyle.opacity : 'none',
          parentClass: parent ? parent.className : 'none',
          grandParentClass: grandParent ? grandParent.className : 'none',
          texts: texts
        };
      }
      return { found: false };
    });

    if (textInfo.found) {
      console.log('Background text element found:');
      console.log(`  Position: top=${textInfo.position.top}, right=${textInfo.position.right}`);
      console.log(`  Visibility: ${textInfo.visibility}, Display: ${textInfo.display}`);
      console.log(`  Opacity: ${textInfo.opacity}`);
      console.log(`  Z-Index: ${textInfo.zIndex}`);
      console.log(`  Parent opacity: ${textInfo.parentOpacity}, class: ${textInfo.parentClass}`);
      console.log(`  GrandParent opacity: ${textInfo.grandParentOpacity}, class: ${textInfo.grandParentClass}`);
      console.log('  Text elements:');
      textInfo.texts.forEach((text, i) => {
        console.log(`    ${i+1}. ${text.tag}: "${text.text}"`);
        console.log(`       Color: ${text.color}, Visible: ${text.visibility}`);
        console.log(`       Rect: top=${text.rect.top}, right=${text.rect.right}, width=${text.rect.width}`);
      });
    } else {
      console.log('❌ Background text element NOT FOUND!');
    }

    console.log('\n=== CHECKING HORIZONTAL SCROLL FUNCTIONALITY ===');
    const scrollInfo = await page.evaluate(() => {
      const scrollArea = document.querySelector('[onScroll]') || document.querySelector('.overflow-x-auto');
      if (scrollArea) {
        const rect = scrollArea.getBoundingClientRect();
        return {
          found: true,
          scrollWidth: scrollArea.scrollWidth,
          clientWidth: scrollArea.clientWidth,
          scrollLeft: scrollArea.scrollLeft,
          canScroll: scrollArea.scrollWidth > scrollArea.clientWidth,
          position: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          className: scrollArea.className,
          hasOnScroll: scrollArea.hasAttribute('onScroll') || scrollArea.onscroll !== null
        };
      }
      return { found: false };
    });

    if (scrollInfo.found) {
      console.log('Horizontal scroll area found:');
      console.log(`  Can scroll: ${scrollInfo.canScroll} (${scrollInfo.scrollWidth}px vs ${scrollInfo.clientWidth}px)`);
      console.log(`  Current scroll: ${scrollInfo.scrollLeft}px`);
      console.log(`  Has onScroll: ${scrollInfo.hasOnScroll}`);
      console.log(`  Position: top=${scrollInfo.position.top}, width=${scrollInfo.position.width}`);
      console.log(`  Class: ${scrollInfo.className}`);
    } else {
      console.log('❌ Horizontal scroll area NOT FOUND!');
    }

    // Test manual horizontal scroll
    console.log('\n=== TESTING MANUAL HORIZONTAL SCROLL ===');
    const scrollTest = await page.evaluate(() => {
      const scrollArea = document.querySelector('.overflow-x-auto');
      if (scrollArea) {
        const initialScroll = scrollArea.scrollLeft;
        scrollArea.scrollLeft = 500;
        const afterScroll = scrollArea.scrollLeft;

        // Check if background text moved
        const backgroundText = document.getElementById('scrolling-background-text');
        const backgroundTransform = backgroundText ? window.getComputedStyle(backgroundText).transform : 'none';

        return {
          scrollWorked: afterScroll !== initialScroll,
          initialScroll,
          afterScroll,
          backgroundTransform
        };
      }
      return { scrollWorked: false };
    });

    console.log(`Manual scroll test: ${scrollTest.scrollWorked ? 'WORKS' : 'FAILED'}`);
    if (scrollTest.scrollWorked) {
      console.log(`  Scroll moved from ${scrollTest.initialScroll}px to ${scrollTest.afterScroll}px`);
      console.log(`  Background transform: ${scrollTest.backgroundTransform}`);
    }

    // Take final screenshot
    await page.screenshot({
      path: 'debug-after-scroll-test.png',
      fullPage: false
    });

    console.log('\nScreenshots saved for visual inspection');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

debugIssues();