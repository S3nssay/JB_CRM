import { chromium } from 'playwright';

async function inspectLogoCropping() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 INSPECTING JOHN BARCLAY LOGO TEXT CROPPING\n');

    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to a section with logos visible
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight * 0.3); // Go to about 30% scroll
    });
    await page.waitForTimeout(1000);

    // Find visible John Barclay logos
    const logos = await page.locator('img[alt*="John Barclay"]:visible').all();
    console.log(`Found ${logos.length} visible John Barclay logos:\n`);

    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      try {
        const logoInfo = await logo.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const parent = el.parentElement;
          const parentRect = parent ? parent.getBoundingClientRect() : null;
          const parentStyle = parent ? window.getComputedStyle(parent) : null;

          // Get all potentially overlapping elements
          const elementsAtPosition = [];

          // Check left side (where "JO" would be)
          const leftX = rect.left + 10;
          const leftY = rect.top + rect.height/2;
          const leftElement = document.elementFromPoint(leftX, leftY);

          // Check right side (where "AY" would be)
          const rightX = rect.right - 10;
          const rightY = rect.top + rect.height/2;
          const rightElement = document.elementFromPoint(rightX, rightY);

          // Check center
          const centerX = rect.left + rect.width/2;
          const centerY = rect.top + rect.height/2;
          const centerElement = document.elementFromPoint(centerX, centerY);

          return {
            logo: {
              left: rect.left,
              right: rect.right,
              top: rect.top,
              bottom: rect.bottom,
              width: rect.width,
              height: rect.height,
              zIndex: window.getComputedStyle(el).zIndex,
              overflow: window.getComputedStyle(el).overflow,
              clipPath: window.getComputedStyle(el).clipPath
            },
            container: parentRect ? {
              left: parentRect.left,
              right: parentRect.right,
              top: parentRect.top,
              bottom: parentRect.bottom,
              width: parentRect.width,
              height: parentRect.height,
              overflow: parentStyle ? parentStyle.overflow : null,
              clipPath: parentStyle ? parentStyle.clipPath : null,
              zIndex: parentStyle ? parentStyle.zIndex : null
            } : null,
            overlappingElements: {
              leftSide: leftElement ? {
                tagName: leftElement.tagName,
                className: leftElement.className,
                zIndex: window.getComputedStyle(leftElement).zIndex,
                position: window.getComputedStyle(leftElement).position,
                isLogo: leftElement === el
              } : null,
              rightSide: rightElement ? {
                tagName: rightElement.tagName,
                className: rightElement.className,
                zIndex: window.getComputedStyle(rightElement).zIndex,
                position: window.getComputedStyle(rightElement).position,
                isLogo: rightElement === el
              } : null,
              center: centerElement ? {
                tagName: centerElement.tagName,
                className: centerElement.className,
                zIndex: window.getComputedStyle(centerElement).zIndex,
                position: window.getComputedStyle(centerElement).position,
                isLogo: centerElement === el
              } : null
            }
          };
        });

        console.log(`Logo ${i + 1}:`);
        console.log(`  Position: ${logoInfo.logo.left.toFixed(1)} to ${logoInfo.logo.right.toFixed(1)} (width: ${logoInfo.logo.width.toFixed(1)}px)`);
        console.log(`  Z-index: ${logoInfo.logo.zIndex}`);
        console.log(`  Logo overflow: ${logoInfo.logo.overflow}`);
        console.log(`  Logo clip-path: ${logoInfo.logo.clipPath}`);

        if (logoInfo.container) {
          console.log(`  Container: ${logoInfo.container.left.toFixed(1)} to ${logoInfo.container.right.toFixed(1)} (width: ${logoInfo.container.width.toFixed(1)}px)`);
          console.log(`  Container overflow: ${logoInfo.container.overflow}`);
          console.log(`  Container clip-path: ${logoInfo.container.clipPath}`);
          console.log(`  Container z-index: ${logoInfo.container.zIndex}`);

          // Check if logo extends beyond container
          const leftCropped = logoInfo.logo.left < logoInfo.container.left;
          const rightCropped = logoInfo.logo.right > logoInfo.container.right;

          if (leftCropped) {
            console.log(`  ❌ LEFT SIDE CROPPED: Logo starts at ${logoInfo.logo.left.toFixed(1)}, container starts at ${logoInfo.container.left.toFixed(1)}`);
          }
          if (rightCropped) {
            console.log(`  ❌ RIGHT SIDE CROPPED: Logo ends at ${logoInfo.logo.right.toFixed(1)}, container ends at ${logoInfo.container.right.toFixed(1)}`);
          }
          if (!leftCropped && !rightCropped) {
            console.log(`  ✅ Logo fits within container bounds`);
          }
        }

        // Check what elements are covering the logo
        console.log(`  Elements detected at logo positions:`);

        if (logoInfo.overlappingElements.leftSide) {
          const leftEl = logoInfo.overlappingElements.leftSide;
          console.log(`    Left side: ${leftEl.tagName}.${leftEl.className} (z-index: ${leftEl.zIndex}) ${leftEl.isLogo ? '✅ Logo itself' : '❌ Different element!'}`);
        }

        if (logoInfo.overlappingElements.rightSide) {
          const rightEl = logoInfo.overlappingElements.rightSide;
          console.log(`    Right side: ${rightEl.tagName}.${rightEl.className} (z-index: ${rightEl.zIndex}) ${rightEl.isLogo ? '✅ Logo itself' : '❌ Different element!'}`);
        }

        if (logoInfo.overlappingElements.center) {
          const centerEl = logoInfo.overlappingElements.center;
          console.log(`    Center: ${centerEl.tagName}.${centerEl.className} (z-index: ${centerEl.zIndex}) ${centerEl.isLogo ? '✅ Logo itself' : '❌ Different element!'}`);
        }

        console.log('');

      } catch (error) {
        console.log(`  Logo ${i + 1}: Error - ${error.message}`);
      }
    }

    // Take screenshot showing the cropping issue
    await page.screenshot({
      path: 'logo-cropping-inspection.png',
      fullPage: false,
      clip: { x: 0, y: 0, width: 1200, height: 300 }
    });

    console.log('📸 Screenshot saved: logo-cropping-inspection.png');
    console.log('✅ Logo cropping inspection completed!');

  } catch (error) {
    console.error('❌ Error during inspection:', error.message);
  }

  await browser.close();
}

inspectLogoCropping().catch(console.error);