import { chromium } from 'playwright';

async function investigateSpecificIssues() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 INVESTIGATING SPECIFIC UI ISSUES\n');

    // Navigate to the website
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });

    // Issue 1: Logo cropping problems
    console.log('1️⃣ LOGO CROPPING INVESTIGATION:');
    console.log('=' * 40);

    // Check all John Barclay logo instances
    const logos = await page.locator('img[alt*="John"], img[alt*="Barclay"]').all();
    console.log(`Found ${logos.length} John Barclay logo instances:`);

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
              width: parseFloat(computed.width),
              height: parseFloat(computed.height),
              maxWidth: computed.maxWidth,
              objectFit: computed.objectFit,
              actualWidth: rect.width,
              actualHeight: rect.height,
              visibility: computed.visibility,
              overflow: computed.overflow
            },
            container: parentComputed ? {
              width: parseFloat(parentComputed.width),
              height: parseFloat(parentComputed.height),
              overflow: parentComputed.overflow,
              display: parentComputed.display,
              minWidth: parentComputed.minWidth
            } : null,
            position: {
              top: rect.top,
              left: rect.left,
              right: rect.right,
              bottom: rect.bottom
            }
          };
        });

        console.log(`\nLogo ${i + 1}:`);
        console.log(`  Position: ${logoInfo.position.left.toFixed(1)}, ${logoInfo.position.top.toFixed(1)}`);
        console.log(`  Size: ${logoInfo.logo.actualWidth.toFixed(1)}x${logoInfo.logo.actualHeight.toFixed(1)}`);
        console.log(`  Container: ${logoInfo.container ? logoInfo.container.width + 'x' + logoInfo.container.height : 'N/A'}`);
        console.log(`  Object-fit: ${logoInfo.logo.objectFit}`);
        console.log(`  Max-width: ${logoInfo.logo.maxWidth}`);

        // Check for cropping
        const isCropped = logoInfo.container && (
          logoInfo.logo.actualWidth > logoInfo.container.width - 20 ||
          logoInfo.position.left < 0 ||
          logoInfo.position.right > window.innerWidth
        );

        console.log(`  Status: ${isCropped ? '❌ CROPPED' : '✅ OK'}`);

      } catch (error) {
        console.log(`  Logo ${i + 1}: Error - ${error.message}`);
      }
    }

    // Issue 2: Personnel cards investigation
    console.log('\n\n2️⃣ PERSONNEL CARDS INVESTIGATION:');
    console.log('=' * 40);

    // Check team member cards
    const teamCards = await page.locator('[class*="team"], .team-member, [data-testid*="team"]').all();
    console.log(`Found ${teamCards.length} potential team card containers`);

    // Also check for images that might be team members
    const teamImages = await page.locator('img[alt*="team"], img[alt*="Team"], img[src*="team"], img[src*="generated_images"]').all();
    console.log(`Found ${teamImages.length} potential team member images`);

    for (let i = 0; i < Math.min(teamImages.length, 5); i++) {
      const img = teamImages[i];
      try {
        const cardInfo = await img.evaluate(el => {
          const rect = el.getBoundingClientRect();
          const computed = window.getComputedStyle(el);
          const parent = el.parentElement;
          const parentRect = parent ? parent.getBoundingClientRect() : null;
          const parentComputed = parent ? window.getComputedStyle(parent) : null;

          return {
            image: {
              width: rect.width,
              height: rect.height,
              objectFit: computed.objectFit,
              alt: el.alt || 'No alt text'
            },
            container: parentRect ? {
              width: parentRect.width,
              height: parentRect.height,
              overflow: parentComputed ? parentComputed.overflow : 'unknown'
            } : null,
            visibility: {
              isVisible: rect.top < window.innerHeight && rect.bottom > 0,
              isFullyVisible: rect.top >= 0 && rect.bottom <= window.innerHeight
            }
          };
        });

        console.log(`\nTeam Card ${i + 1} (${cardInfo.image.alt}):`);
        console.log(`  Image size: ${cardInfo.image.width.toFixed(1)}x${cardInfo.image.height.toFixed(1)}`);
        console.log(`  Container: ${cardInfo.container ? cardInfo.container.width.toFixed(1) + 'x' + cardInfo.container.height.toFixed(1) : 'N/A'}`);
        console.log(`  Object-fit: ${cardInfo.image.objectFit}`);
        console.log(`  Visibility: ${cardInfo.visibility.isFullyVisible ? '✅ Fully visible' : cardInfo.visibility.isVisible ? '⚠️ Partially visible' : '❌ Not visible'}`);

        // Check if card is cut off
        const isCutOff = cardInfo.container && (
          cardInfo.image.height > cardInfo.container.height ||
          !cardInfo.visibility.isFullyVisible
        );

        console.log(`  Status: ${isCutOff ? '❌ CUT OFF' : '✅ OK'}`);

      } catch (error) {
        console.log(`  Team Card ${i + 1}: Error - ${error.message}`);
      }
    }

    // Issue 3: Section transition investigation
    console.log('\n\n3️⃣ SECTION TRANSITION INVESTIGATION:');
    console.log('=' * 40);

    // Find team and contact sections
    const teamSection = await page.locator('section').nth(5); // Assuming team is 6th section
    const contactSection = await page.locator('section').nth(6); // Contact might be 7th section

    if (await teamSection.count() > 0) {
      const teamInfo = await teamSection.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        return {
          height: rect.height,
          zIndex: computed.zIndex,
          position: computed.position,
          top: rect.top,
          bottom: rect.bottom
        };
      });

      console.log(`Team Section:
  Height: ${teamInfo.height}px
  Z-index: ${teamInfo.zIndex}
  Position: ${teamInfo.position}
  Top: ${teamInfo.top.toFixed(1)}px`);
    }

    if (await contactSection.count() > 0) {
      const contactInfo = await contactSection.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        return {
          height: rect.height,
          zIndex: computed.zIndex,
          position: computed.position,
          top: rect.top,
          bottom: rect.bottom
        };
      });

      console.log(`Contact Section:
  Height: ${contactInfo.height}px
  Z-index: ${contactInfo.zIndex}
  Position: ${contactInfo.position}
  Top: ${contactInfo.top.toFixed(1)}px`);
    }

    // Issue 4: Title and logo overlap
    console.log('\n\n4️⃣ TITLE/LOGO OVERLAP INVESTIGATION:');
    console.log('=' * 40);

    // Find "Meet Our Team" title
    const teamTitle = await page.locator('h2:has-text("Meet Our Team"), h1:has-text("Meet Our Team")').first();
    if (await teamTitle.count() > 0) {
      const titleInfo = await teamTitle.evaluate(el => {
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        return {
          top: rect.top,
          bottom: rect.bottom,
          height: rect.height,
          fontSize: computed.fontSize,
          marginTop: computed.marginTop,
          paddingTop: computed.paddingTop
        };
      });

      console.log(`"Meet Our Team" Title:
  Position: ${titleInfo.top.toFixed(1)} - ${titleInfo.bottom.toFixed(1)}px
  Height: ${titleInfo.height.toFixed(1)}px
  Font size: ${titleInfo.fontSize}
  Margin top: ${titleInfo.marginTop}
  Padding top: ${titleInfo.paddingTop}`);

      // Check if title overlaps with logo
      const teamSectionLogo = await page.locator('section img[alt*="John Barclay"]').nth(4); // 5th logo might be team section
      if (await teamSectionLogo.count() > 0) {
        const logoPos = await teamSectionLogo.boundingBox();
        if (logoPos) {
          const overlap = logoPos.y + logoPos.height > titleInfo.top && logoPos.y < titleInfo.bottom;
          console.log(`Logo overlap with title: ${overlap ? '❌ YES' : '✅ NO'}`);
          console.log(`Logo bottom: ${(logoPos.y + logoPos.height).toFixed(1)}px, Title top: ${titleInfo.top.toFixed(1)}px`);
        }
      }
    }

    // Take comprehensive screenshots
    await page.screenshot({
      path: 'comprehensive-issue-analysis.png',
      fullPage: true
    });

    // Take header specific screenshot
    await page.screenshot({
      path: 'header-logo-analysis.png',
      clip: { x: 0, y: 0, width: 1200, height: 150 }
    });

    // Scroll to team section and capture
    try {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.7));
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'team-section-analysis.png',
        clip: { x: 0, y: 0, width: 1200, height: 800 }
      });
    } catch (error) {
      console.log('Could not capture team section');
    }

    console.log('\n📸 Analysis screenshots saved');
    console.log('✅ Investigation completed!');

  } catch (error) {
    console.error('❌ Error during investigation:', error.message);

    try {
      await page.screenshot({ path: 'investigation-error.png', fullPage: true });
    } catch (screenshotError) {
      console.log('Could not capture error screenshot');
    }
  }

  await browser.close();
}

investigateSpecificIssues().catch(console.error);