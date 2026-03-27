import { chromium } from 'playwright';

async function finalVerification() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });

  try {
    console.log('🎯 Final comprehensive verification of all fixes...\n');
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);

    // ✅ 1. Check John Barclay logo size and positioning
    console.log('1. 🏷️ John Barclay Logo Check:');
    const logos = await page.locator('img[alt="John Barclay Estate & Management"]').all();
    console.log(`   Found ${logos.length} logos`);

    for (let i = 0; i < Math.min(logos.length, 3); i++) {
      if (await logos[i].isVisible()) {
        const bounds = await logos[i].boundingBox();
        const isCentered = Math.abs(bounds.x + bounds.width/2 - 960) < 50;
        const isProperSize = bounds.height >= 60;
        console.log(`   Logo ${i + 1}: ${isCentered ? '✅' : '❌'} Centered, ${isProperSize ? '✅' : '❌'} Size (${bounds.width}x${bounds.height})`);
      }
    }

    // ✅ 2. Check postcode carousel position (should be at bottom)
    console.log('\n2. 🎠 Postcode Carousel Position:');
    const carousel = await page.locator('.team-card, [ref="carouselRef"], .carousel-container').first();
    if (await carousel.isVisible()) {
      const bounds = await carousel.boundingBox();
      const distanceFromBottom = 1080 - (bounds.y + bounds.height);
      const isAtBottom = distanceFromBottom < 200;
      console.log(`   ${isAtBottom ? '✅' : '❌'} Position: ${Math.round(distanceFromBottom)}px from bottom`);
    } else {
      console.log('   ❌ Carousel not found or not visible');
    }

    // ✅ 3. Check navigation section names visibility
    console.log('\n3. 🧭 Navigation Section Names:');
    const navLabels = await page.locator('.fixed.right-8 .whitespace-nowrap').all();
    console.log(`   Found ${navLabels.length} navigation labels`);

    if (navLabels.length > 0) {
      const firstLabel = navLabels[0];
      const isVisible = await firstLabel.isVisible();
      const opacity = await firstLabel.evaluate(el => window.getComputedStyle(el).opacity);
      console.log(`   ${isVisible && parseFloat(opacity) > 0.5 ? '✅' : '❌'} Labels visible (opacity: ${opacity})`);
    }

    // ✅ 4. Check history section vertical text
    console.log('\n4. 📜 History Section Vertical Text:');
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    const scrollingText = await page.locator('#scrolling-background-text').first();
    const isTextVisible = await scrollingText.isVisible();
    console.log(`   ${isTextVisible ? '✅' : '❌'} Scrolling text visible`);

    if (isTextVisible) {
      const textBounds = await scrollingText.boundingBox();
      const isPositioned = textBounds.x > 960 && textBounds.y > 0; // Right side, visible
      console.log(`   ${isPositioned ? '✅' : '❌'} Text positioned correctly`);
    }

    // ✅ 5. Check team cards consistency
    console.log('\n5. 👥 Team Section Card Consistency:');
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 6, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    const teamCards = await page.locator('.team-card').all();
    console.log(`   Found ${teamCards.length} team cards`);

    if (teamCards.length > 0) {
      const cardSizes = [];
      for (const card of teamCards) {
        if (await card.isVisible()) {
          const bounds = await card.boundingBox();
          cardSizes.push({ width: Math.round(bounds.width), height: Math.round(bounds.height) });
        }
      }

      const allSameSize = cardSizes.every(size =>
        Math.abs(size.width - cardSizes[0].width) < 10 &&
        Math.abs(size.height - cardSizes[0].height) < 10
      );

      console.log(`   ${allSameSize ? '✅' : '❌'} All cards same size: ${JSON.stringify(cardSizes)}`);
    }

    // ✅ 6. Check contact section timing
    console.log('\n6. ⏱️ Contact Section Scroll Timing:');

    // At team section - contact should not be visible yet
    const contactSection = await page.locator('[ref="contactRef"]').first();
    const contactAtTeam = await contactSection.isVisible() &&
                          (await contactSection.boundingBox()).y <= 50;
    console.log(`   ${!contactAtTeam ? '✅' : '❌'} Contact hidden during team section`);

    // Scroll further to trigger contact
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 9, behavior: 'smooth' }));
    await page.waitForTimeout(2000);

    const contactAfterScroll = await contactSection.isVisible() &&
                               (await contactSection.boundingBox()).y <= 50;
    console.log(`   ${contactAfterScroll ? '✅' : '❌'} Contact visible after full scroll`);

    // ✅ 7. Take final screenshots
    console.log('\n7. 📸 Taking final verification screenshots...');

    // Hero with repositioned carousel
    await page.goto('http://localhost:5173');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'final-hero-verification.png' });

    // History with vertical text
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 2, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'final-history-verification.png' });

    // Team section with consistent cards
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 6, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'final-team-verification.png' });

    // Contact section
    await page.evaluate(() => window.scrollTo({ top: window.innerHeight * 9, behavior: 'smooth' }));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'final-contact-verification.png' });

    console.log('\n🎉 Final verification complete!');
    console.log('📁 Check the final-*-verification.png screenshots for visual confirmation.');

  } catch (error) {
    console.error('❌ Error during final verification:', error);
  } finally {
    await browser.close();
  }
}

finalVerification();