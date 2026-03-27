import { chromium } from 'playwright';

async function inspectLogoSizing() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 INSPECTING JOHN BARCLAY LOGO SIZING\n');

    // Navigate to the website
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Find all John Barclay logos
    const logos = await page.locator('img[alt*="John Barclay"]').all();
    console.log(`Found ${logos.length} John Barclay logos:\n`);

    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      try {
        const boundingBox = await logo.boundingBox();
        const logoInfo = await logo.evaluate(el => {
          const computed = window.getComputedStyle(el);
          const parent = el.parentElement;
          const parentComputed = parent ? window.getComputedStyle(parent) : null;
          const rect = el.getBoundingClientRect();

          return {
            logo: {
              width: rect.width,
              height: rect.height,
              computedWidth: computed.width,
              computedHeight: computed.height,
              maxWidth: computed.maxWidth,
              objectFit: computed.objectFit,
              visibility: computed.visibility,
              display: computed.display,
              zIndex: computed.zIndex
            },
            container: parentComputed ? {
              width: parseFloat(parentComputed.width),
              height: parseFloat(parentComputed.height),
              minWidth: parentComputed.minWidth,
              maxWidth: parentComputed.maxWidth,
              zIndex: parentComputed.zIndex,
              position: parentComputed.position,
              transform: parentComputed.transform
            } : null,
            position: {
              top: rect.top,
              left: rect.left,
              right: rect.right,
              bottom: rect.bottom
            },
            isVisible: rect.top < window.innerHeight && rect.bottom > 0 && rect.left < window.innerWidth && rect.right > 0,
            className: el.className,
            src: el.src
          };
        });

        console.log(`Logo ${i + 1}:`);
        console.log(`  Source: ${logoInfo.src.split('/').pop()}`);
        console.log(`  Class: ${logoInfo.className}`);
        console.log(`  Actual size: ${logoInfo.logo.width.toFixed(1)}x${logoInfo.logo.height.toFixed(1)}px`);
        console.log(`  Computed size: ${logoInfo.logo.computedWidth} x ${logoInfo.logo.computedHeight}`);
        console.log(`  Max width: ${logoInfo.logo.maxWidth}`);
        console.log(`  Z-index: ${logoInfo.logo.zIndex}`);
        console.log(`  Position: ${logoInfo.position.left.toFixed(1)}, ${logoInfo.position.top.toFixed(1)}`);
        console.log(`  Visible: ${logoInfo.isVisible ? '✅' : '❌'}`);

        if (logoInfo.container) {
          console.log(`  Container:`);
          console.log(`    Size: ${logoInfo.container.width}x${logoInfo.container.height}px`);
          console.log(`    Min width: ${logoInfo.container.minWidth}`);
          console.log(`    Max width: ${logoInfo.container.maxWidth}`);
          console.log(`    Z-index: ${logoInfo.container.zIndex}`);
          console.log(`    Position: ${logoInfo.container.position}`);
          console.log(`    Transform: ${logoInfo.container.transform}`);
        }
        console.log('');

      } catch (error) {
        console.log(`  Logo ${i + 1}: Error - ${error.message}`);
      }
    }

    // Navigate to different sections to test
    console.log('\n📍 TESTING SECTION NAVIGATION:\n');

    const sections = ['hero', 'history', 'sales', 'rentals', 'commercial', 'team'];

    for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
      try {
        // Navigate to section
        await page.evaluate((index) => {
          const navigateToSection = (sectionIndex) => {
            const scrollProgress = sectionIndex / 6; // 6 sections total
            window.scrollTo(0, scrollProgress * (document.body.scrollHeight - window.innerHeight));
          };
          navigateToSection(index);
        }, sectionIndex);

        await page.waitForTimeout(1000);

        console.log(`Section ${sectionIndex + 1} (${sections[sectionIndex]}):`);

        // Check visible logos in this section
        const visibleLogos = await page.locator('img[alt*="John Barclay"]:visible').all();
        for (let j = 0; j < visibleLogos.length; j++) {
          const logo = visibleLogos[j];
          const box = await logo.boundingBox();
          if (box && box.width > 0 && box.height > 0) {
            console.log(`  Logo ${j + 1}: ${box.width.toFixed(1)}x${box.height.toFixed(1)}px at ${box.x.toFixed(1)}, ${box.y.toFixed(1)}`);
          }
        }
        console.log('');
      } catch (error) {
        console.log(`  Section ${sectionIndex + 1}: Error - ${error.message}`);
      }
    }

    // Take screenshot for verification
    await page.screenshot({
      path: 'logo-sizing-inspection.png',
      fullPage: true
    });

    console.log('📸 Screenshot saved: logo-sizing-inspection.png');
    console.log('✅ Logo sizing inspection completed!');

  } catch (error) {
    console.error('❌ Error during inspection:', error.message);

    try {
      await page.screenshot({ path: 'logo-inspection-error.png', fullPage: true });
    } catch (screenshotError) {
      console.log('Could not capture error screenshot');
    }
  }

  await browser.close();
}

inspectLogoSizing().catch(console.error);