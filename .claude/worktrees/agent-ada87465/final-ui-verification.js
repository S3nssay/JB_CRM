import { chromium } from 'playwright';

async function finalUIVerification() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🎯 FINAL UI VERIFICATION: Logo and Team Section Fixes\n');

    // Navigate to the website
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // 1. Final Logo Check
    console.log('🏷️ FINAL LOGO VERIFICATION:');
    console.log('=' * 40);

    // Check header logo
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

      console.log(`✅ Header logo:
  Size: ${headerBox ? `${headerBox.width}x${headerBox.height}` : 'Not visible'}
  Max-width: ${headerStyles.maxWidth}
  Object-fit: ${headerStyles.objectFit}`);
    }

    // Check section logos
    const sectionLogos = await page.locator('section img[alt*="John Barclay"]').all();
    let logosCroppedCount = 0;
    let logosFixedCount = 0;

    for (let i = 0; i < Math.min(sectionLogos.length, 5); i++) {
      const logo = sectionLogos[i];
      try {
        const box = await logo.boundingBox();
        const styles = await logo.evaluate(el => {
          const computed = window.getComputedStyle(el);
          const parent = el.parentElement;
          const parentComputed = parent ? window.getComputedStyle(parent) : null;
          return {
            logoWidth: parseFloat(computed.width),
            containerWidth: parentComputed ? parseFloat(parentComputed.width) : 0,
            objectFit: computed.objectFit,
            maxWidth: computed.maxWidth
          };
        });

        // Check if logo has room to breathe (container is wider than logo)
        const hasRoom = styles.containerWidth > styles.logoWidth + 50; // 50px buffer
        const isContain = styles.objectFit === 'contain';

        if (hasRoom && isContain) {
          logosFixedCount++;
          console.log(`✅ Section logo ${i + 1}: FIXED
    Logo: ${styles.logoWidth}px, Container: ${styles.containerWidth}px
    Object-fit: ${styles.objectFit}`);
        } else {
          logosCroppedCount++;
          console.log(`❌ Section logo ${i + 1}: STILL CROPPED
    Logo: ${styles.logoWidth}px, Container: ${styles.containerWidth}px
    Object-fit: ${styles.objectFit}`);
        }
      } catch (error) {
        console.log(`⚠️ Section logo ${i + 1}: Could not verify`);
      }
    }

    // 2. Team Section Height Check
    console.log('\n📊 FINAL SECTION HEIGHT VERIFICATION:');
    console.log('=' * 40);

    const sections = await page.locator('section').all();
    const sectionHeights = [];

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      try {
        const box = await section.boundingBox();
        if (box) {
          sectionHeights.push({ index: i + 1, height: Math.round(box.height) });
        }
      } catch (error) {
        // Skip failed sections
      }
    }

    if (sectionHeights.length > 0) {
      const heights = sectionHeights.map(s => s.height);
      const minHeight = Math.min(...heights);
      const maxHeight = Math.max(...heights);
      const commonHeight = Math.round(window.innerHeight); // Expected viewport height

      console.log('Section Heights:');
      sectionHeights.forEach(s => {
        const isConsistent = Math.abs(s.height - commonHeight) < 50;
        const status = isConsistent ? '✅' : '⚠️';
        console.log(`  ${status} Section ${s.index}: ${s.height}px ${s.index === 6 ? '(Team Section)' : ''}`);
      });

      const maxVariation = maxHeight - minHeight;
      console.log(`\nHeight Analysis:
  Viewport: ${commonHeight}px
  Range: ${minHeight}px - ${maxHeight}px
  Variation: ${maxVariation}px
  Status: ${maxVariation < 100 ? '✅ CONSISTENT' : '⚠️ INCONSISTENT'}`);
    }

    // 3. Take Final Screenshots
    console.log('\n📸 CAPTURING FINAL VERIFICATION SCREENSHOTS:');

    // Header logo closeup
    await page.screenshot({
      path: 'final-header-logo.png',
      clip: { x: 0, y: 0, width: 1200, height: 120 }
    });

    // Full page
    await page.screenshot({
      path: 'final-full-page.png',
      fullPage: true
    });

    // Scroll to team section and capture
    try {
      const teamSection = await page.locator('section').nth(5); // 6th section (0-indexed)
      if (await teamSection.count() > 0) {
        await teamSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000);

        await page.screenshot({
          path: 'final-team-section.png',
          clip: { x: 0, y: 0, width: 1200, height: 720 }
        });
      }
    } catch (error) {
      console.log('Could not capture team section specifically');
    }

    // 4. Summary
    console.log('\n🎯 FINAL VERIFICATION SUMMARY:');
    console.log('=' * 40);
    console.log(`Logo Fixes: ${logosFixedCount}/${logosFixedCount + logosCroppedCount} section logos fixed`);
    console.log(`Section Heights: ${sectionHeights.length > 0 && (Math.max(...sectionHeights.map(s => s.height)) - Math.min(...sectionHeights.map(s => s.height))) < 100 ? 'CONSISTENT' : 'NEEDS REVIEW'}`);
    console.log('Screenshots saved: final-header-logo.png, final-full-page.png, final-team-section.png');

    if (logosFixedCount > logosCroppedCount) {
      console.log('\n✅ LOGO FIXES: SUCCESS - Most logos are no longer cropped');
    } else {
      console.log('\n❌ LOGO FIXES: NEEDS MORE WORK - Some logos still cropped');
    }

    console.log('\n✅ Verification completed!');

  } catch (error) {
    console.error('❌ Error during final verification:', error.message);
  }

  await browser.close();
}

finalUIVerification().catch(console.error);