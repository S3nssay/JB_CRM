import { chromium } from 'playwright';

async function verifyLogoFix() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 Verifying logo fixes and section heights...\n');

    // Navigate to the website
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 1. Check header logo
    console.log('🏷️ CHECKING HEADER LOGO:');
    console.log('=' * 30);

    const headerLogo = await page.locator('header img[alt*="John Barclay"]').first();
    if (await headerLogo.count() > 0) {
      const headerBox = await headerLogo.boundingBox();
      const headerStyles = await headerLogo.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          width: computed.width,
          height: computed.height,
          maxWidth: computed.maxWidth,
          objectFit: computed.objectFit
        };
      });

      console.log(`Header logo:
  Bounding box: ${headerBox ? `${headerBox.width}x${headerBox.height}` : 'Not visible'}
  Styles:`, headerStyles);
    }

    // 2. Check section logos
    console.log('\n🏷️ CHECKING SECTION LOGOS:');
    console.log('=' * 30);

    const sectionLogos = await page.locator('section img[alt*="John Barclay"]').all();
    console.log(`Found ${sectionLogos.length} section logos:`);

    for (let i = 0; i < Math.min(sectionLogos.length, 5); i++) {
      const logo = sectionLogos[i];
      try {
        const box = await logo.boundingBox();
        const styles = await logo.evaluate(el => {
          const computed = window.getComputedStyle(el);
          const parent = el.parentElement;
          const parentComputed = parent ? window.getComputedStyle(parent) : null;
          return {
            logo: {
              width: computed.width,
              height: computed.height,
              maxWidth: computed.maxWidth,
              objectFit: computed.objectFit
            },
            container: parentComputed ? {
              width: parentComputed.width,
              overflow: parentComputed.overflow
            } : null
          };
        });

        console.log(`Section logo ${i + 1}:
  Bounding box: ${box ? `${box.width}x${box.height}` : 'Not visible'}
  Logo styles:`, styles.logo);
        console.log(`  Container styles:`, styles.container);
      } catch (error) {
        console.log(`  Section logo ${i + 1}: Error - ${error.message}`);
      }
    }

    // 3. Compare all section heights again
    console.log('\n📊 SECTION HEIGHT COMPARISON:');
    console.log('=' * 30);

    const sections = await page.locator('section').all();
    const sectionHeights = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      try {
        const box = await section.boundingBox();
        const className = await section.getAttribute('class');
        const identifier = className?.split(' ').find(c => c.includes('team') || c.includes('sales') || c.includes('hero')) || `section-${i + 1}`;

        if (box) {
          sectionHeights.push({ name: identifier, height: box.height });
          console.log(`${identifier}: ${box.height}px`);
        }
      } catch (error) {
        console.log(`Section ${i + 1}: Error getting dimensions`);
      }
    }

    // Find min and max heights
    if (sectionHeights.length > 0) {
      const heights = sectionHeights.map(s => s.height);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);
      const avgHeight = heights.reduce((a, b) => a + b, 0) / heights.length;

      console.log(`\nHeight Statistics:
  Min: ${minHeight}px
  Max: ${maxHeight}px
  Average: ${avgHeight.toFixed(1)}px
  Range: ${maxHeight - minHeight}px`);

      if (maxHeight - minHeight > 50) {
        console.log(`⚠️ Height inconsistency detected! Difference: ${maxHeight - minHeight}px`);
      } else {
        console.log(`✅ Section heights are consistent (within ${maxHeight - minHeight}px)`);
      }
    }

    // Take screenshots for verification
    await page.screenshot({
      path: 'logo-fix-verification.png',
      fullPage: true
    });

    await page.screenshot({
      path: 'header-logo-close.png',
      clip: { x: 0, y: 0, width: 1200, height: 100 }
    });

    console.log('\n📸 Screenshots saved for verification');
    console.log('✅ Verification completed!');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }

  await browser.close();
}

verifyLogoFix().catch(console.error);