import { chromium } from 'playwright';

async function investigateUIIssues() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🔍 Investigating UI issues on John Barclay website...\n');

    // Navigate to the website
    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });

    console.log('📄 Page loaded successfully\n');

    // 1. Investigate John Barclay logo issues
    console.log('🏷️ INVESTIGATING LOGO ISSUES:');
    console.log('=' * 50);

    // Find logo elements
    const logos = await page.locator('img[alt*="John"], img[alt*="Barclay"], img[alt*="logo"], .logo, [class*="logo"]').all();

    console.log(`Found ${logos.length} potential logo elements:`);

    for (let i = 0; i < logos.length; i++) {
      const logo = logos[i];
      try {
        const boundingBox = await logo.boundingBox();
        const styles = await logo.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            width: computed.width,
            height: computed.height,
            display: computed.display,
            overflow: computed.overflow,
            objectFit: computed.objectFit,
            maxWidth: computed.maxWidth,
            maxHeight: computed.maxHeight
          };
        });

        const parentStyles = await logo.evaluate(el => {
          const parent = el.parentElement;
          if (!parent) return null;
          const computed = window.getComputedStyle(parent);
          return {
            width: computed.width,
            height: computed.height,
            overflow: computed.overflow,
            display: computed.display,
            flexDirection: computed.flexDirection,
            alignItems: computed.alignItems,
            justifyContent: computed.justifyContent
          };
        });

        console.log(`\nLogo ${i + 1}:`);
        console.log(`  Bounding box: ${boundingBox ? `${boundingBox.width}x${boundingBox.height} at (${boundingBox.x}, ${boundingBox.y})` : 'Not visible'}`);
        console.log(`  Element styles:`, styles);
        console.log(`  Parent container styles:`, parentStyles);

        // Get the alt text or class name for identification
        const identifier = await logo.evaluate(el => el.alt || el.className || el.tagName);
        console.log(`  Identifier: ${identifier}`);

      } catch (error) {
        console.log(`  Error investigating logo ${i + 1}: ${error.message}`);
      }
    }

    // Take screenshot of header area
    await page.screenshot({
      path: 'logo-investigation.png',
      clip: { x: 0, y: 0, width: 1200, height: 150 }
    });
    console.log('\n📸 Header screenshot saved as logo-investigation.png');

    // 2. Investigate meet the team section
    console.log('\n\n👥 INVESTIGATING MEET THE TEAM SECTION:');
    console.log('=' * 50);

    // Find team section
    const teamSections = await page.locator('section[class*="team"], .team, [class*="Team"], section:has-text("team"), section:has-text("Team")').all();

    console.log(`Found ${teamSections.length} potential team sections:`);

    for (let i = 0; i < teamSections.length; i++) {
      const section = teamSections[i];
      try {
        const boundingBox = await section.boundingBox();
        const styles = await section.evaluate(el => {
          const computed = window.getComputedStyle(el);
          return {
            height: computed.height,
            minHeight: computed.minHeight,
            padding: computed.padding,
            margin: computed.margin,
            display: computed.display,
            flexDirection: computed.flexDirection
          };
        });

        console.log(`\nTeam Section ${i + 1}:`);
        console.log(`  Bounding box: ${boundingBox ? `${boundingBox.width}x${boundingBox.height} at (${boundingBox.x}, ${boundingBox.y})` : 'Not visible'}`);
        console.log(`  Styles:`, styles);

        // Get section content preview
        const textContent = await section.evaluate(el => el.textContent?.substring(0, 100) + '...');
        console.log(`  Content preview: ${textContent}`);

      } catch (error) {
        console.log(`  Error investigating team section ${i + 1}: ${error.message}`);
      }
    }

    // Compare with other sections
    console.log('\n📊 COMPARING SECTION HEIGHTS:');
    console.log('=' * 30);

    const allSections = await page.locator('section').all();
    console.log(`Found ${allSections.length} total sections:`);

    for (let i = 0; i < Math.min(allSections.length, 10); i++) { // Limit to first 10 sections
      const section = allSections[i];
      try {
        const boundingBox = await section.boundingBox();
        const className = await section.getAttribute('class');
        const id = await section.getAttribute('id');
        const identifier = className || id || `section-${i + 1}`;

        console.log(`  ${identifier}: ${boundingBox ? `${boundingBox.height}px height` : 'Not visible'}`);
      } catch (error) {
        console.log(`  Section ${i + 1}: Error getting dimensions`);
      }
    }

    // Take full page screenshot
    await page.screenshot({
      path: 'team-section-investigation.png',
      fullPage: true
    });
    console.log('\n📸 Full page screenshot saved as team-section-investigation.png');

    // Scroll to team section and take focused screenshot
    try {
      const teamSection = await page.locator('section[class*="team"], .team, [class*="Team"]').first();
      if (await teamSection.count() > 0) {
        await teamSection.scrollIntoViewIfNeeded();
        await page.waitForTimeout(1000); // Wait for scroll

        const teamBoundingBox = await teamSection.boundingBox();
        if (teamBoundingBox) {
          await page.screenshot({
            path: 'team-section-focused.png',
            clip: {
              x: 0,
              y: teamBoundingBox.y - 50,
              width: 1200,
              height: teamBoundingBox.height + 100
            }
          });
          console.log('📸 Team section focused screenshot saved as team-section-focused.png');
        }
      }
    } catch (error) {
      console.log('Could not capture team section focused screenshot:', error.message);
    }

    console.log('\n✅ Investigation completed! Check the screenshots for visual analysis.');

  } catch (error) {
    console.error('❌ Error during investigation:', error.message);

    // Take error screenshot
    try {
      await page.screenshot({ path: 'investigation-error.png', fullPage: true });
      console.log('📸 Error screenshot saved as investigation-error.png');
    } catch (screenshotError) {
      console.log('Could not capture error screenshot');
    }
  }

  await browser.close();
}

investigateUIIssues().catch(console.error);