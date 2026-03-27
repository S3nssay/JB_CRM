import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function analyzeOilStainLab() {
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  
  const page = await context.newPage();
  
  try {
    console.log('Navigating to Oil Stain Lab website...');
    try {
      await page.goto('https://www.oilstainlab.com/#car-sound', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
    } catch (error) {
      console.log('Initial load with fragment failed, trying base URL...');
      await page.goto('https://www.oilstainlab.com', { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });
    }
    
    // Wait for page to fully load
    await page.waitForTimeout(3000);
    
    // Create screenshots directory
    const screenshotsDir = path.join(__dirname, 'oilstainlab_screenshots');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
    
    // Take full page screenshot
    console.log('Taking full page screenshot...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01_full_page.png'), 
      fullPage: true 
    });
    
    // Take viewport screenshot of hero section
    console.log('Taking hero section screenshot...');
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02_hero_section.png') 
    });
    
    // Scroll and capture different sections
    const sections = [
      { name: 'car-sound', selector: '#car-sound' },
      { name: 'about', selector: '[class*="about"], [id*="about"], section:has-text("about"), section:has-text("heritage")' },
      { name: 'mission', selector: 'section:has-text("mission"), [class*="mission"], [id*="mission"]' },
      { name: 'split-screen', selector: '[class*="split"], [class*="two-col"], .row, [class*="grid"]' }
    ];
    
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      console.log(`Looking for ${section.name} section...`);
      
      try {
        const element = await page.locator(section.selector).first();
        if (await element.isVisible()) {
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(1000);
          
          await page.screenshot({ 
            path: path.join(screenshotsDir, `03_${section.name}_section.png`) 
          });
          
          console.log(`Screenshot taken for ${section.name} section`);
        }
      } catch (error) {
        console.log(`Could not find ${section.name} section:`, error.message);
      }
    }
    
    // Scroll through the page to capture different sections
    console.log('Scrolling through page to capture various sections...');
    const scrollPositions = [0, 500, 1000, 1500, 2000, 2500, 3000];
    
    for (let i = 0; i < scrollPositions.length; i++) {
      await page.evaluate((scrollY) => window.scrollTo(0, scrollY), scrollPositions[i]);
      await page.waitForTimeout(1000);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, `04_scroll_${i + 1}_${scrollPositions[i]}px.png`) 
      });
    }
    
    // Capture page structure info
    console.log('Analyzing page structure...');
    const pageInfo = await page.evaluate(() => {
      const info = {
        title: document.title,
        headings: [],
        sections: [],
        colorScheme: [],
        fonts: []
      };
      
      // Get all headings
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(h => {
        const styles = window.getComputedStyle(h);
        info.headings.push({
          tag: h.tagName,
          text: h.textContent.trim(),
          fontSize: styles.fontSize,
          fontFamily: styles.fontFamily,
          color: styles.color,
          fontWeight: styles.fontWeight
        });
      });
      
      // Get section elements
      const sections = document.querySelectorAll('section, div[class*="section"], main, article');
      sections.forEach((section, index) => {
        const styles = window.getComputedStyle(section);
        info.sections.push({
          index,
          className: section.className,
          id: section.id,
          backgroundColor: styles.backgroundColor,
          height: section.offsetHeight + 'px',
          hasBackground: styles.backgroundImage !== 'none'
        });
      });
      
      // Get computed styles from body
      const bodyStyles = window.getComputedStyle(document.body);
      info.bodyFont = bodyStyles.fontFamily;
      info.bodyColor = bodyStyles.color;
      info.bodyBackground = bodyStyles.backgroundColor;
      
      return info;
    });
    
    // Save page analysis to JSON
    fs.writeFileSync(
      path.join(screenshotsDir, 'page_analysis.json'), 
      JSON.stringify(pageInfo, null, 2)
    );
    
    console.log('Analysis complete! Screenshots saved to:', screenshotsDir);
    console.log('Page title:', pageInfo.title);
    console.log('Number of headings found:', pageInfo.headings.length);
    console.log('Number of sections found:', pageInfo.sections.length);
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await browser.close();
  }
}

// Run the analysis
analyzeOilStainLab().catch(console.error);