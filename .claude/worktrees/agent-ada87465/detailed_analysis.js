import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function detailedAnalysis() {
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
    await page.goto('https://www.oilstainlab.com', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for initial load
    await page.waitForTimeout(5000);
    
    const screenshotsDir = path.join(__dirname, 'oilstainlab_detailed');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
    
    // Slow scroll through the page to capture different sections
    console.log('Starting detailed scroll capture...');
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log('Total page height:', pageHeight);
    
    const scrollSteps = 20;
    const stepSize = Math.floor(pageHeight / scrollSteps);
    
    for (let i = 0; i <= scrollSteps; i++) {
      const scrollPosition = i * stepSize;
      console.log(`Scrolling to position: ${scrollPosition}px`);
      
      await page.evaluate((scrollY) => {
        window.scrollTo({
          top: scrollY,
          behavior: 'smooth'
        });
      }, scrollPosition);
      
      // Wait for scroll and any animations
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, `scroll_${i.toString().padStart(2, '0')}_${scrollPosition}px.png`),
        fullPage: false 
      });
    }
    
    // Try to find and screenshot specific sections
    console.log('Looking for specific content sections...');
    
    // Look for sections containing specific keywords
    const keywords = ['mission', 'about', 'heritage', 'maniacs', 'timemachine'];
    
    for (const keyword of keywords) {
      try {
        const elements = await page.locator(`text=${keyword}`).all();
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with "${keyword}"`);
          
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            try {
              await elements[i].scrollIntoViewIfNeeded();
              await page.waitForTimeout(1500);
              
              await page.screenshot({ 
                path: path.join(screenshotsDir, `section_${keyword}_${i + 1}.png`),
                fullPage: false 
              });
            } catch (e) {
              console.log(`Could not screenshot ${keyword} section ${i + 1}:`, e.message);
            }
          }
        }
      } catch (error) {
        console.log(`Could not find ${keyword}:`, error.message);
      }
    }
    
    // Get detailed content analysis
    const contentAnalysis = await page.evaluate(() => {
      const analysis = {
        splitScreenSections: [],
        backgroundImages: [],
        colorBlocks: [],
        layoutPatterns: []
      };
      
      // Find elements that might be split-screen layouts
      const sections = document.querySelectorAll('section, div[class*="split"], div[class*="row"], div[class*="grid"], div[class*="two-col"]');
      
      sections.forEach((section, index) => {
        const computedStyle = window.getComputedStyle(section);
        const rect = section.getBoundingClientRect();
        
        // Check if it has children that might be side-by-side
        const children = Array.from(section.children);
        const hasGrid = computedStyle.display.includes('grid');
        const hasFlex = computedStyle.display.includes('flex');
        
        if (children.length >= 2 || hasGrid || hasFlex) {
          analysis.splitScreenSections.push({
            index,
            className: section.className,
            id: section.id,
            display: computedStyle.display,
            gridTemplateColumns: computedStyle.gridTemplateColumns,
            flexDirection: computedStyle.flexDirection,
            childrenCount: children.length,
            width: rect.width,
            height: rect.height,
            backgroundColor: computedStyle.backgroundColor,
            backgroundImage: computedStyle.backgroundImage
          });
        }
      });
      
      // Find background images
      const allElements = document.querySelectorAll('*');
      allElements.forEach((el, index) => {
        const style = window.getComputedStyle(el);
        if (style.backgroundImage && style.backgroundImage !== 'none') {
          analysis.backgroundImages.push({
            index,
            tag: el.tagName,
            className: el.className,
            backgroundImage: style.backgroundImage,
            backgroundSize: style.backgroundSize,
            backgroundPosition: style.backgroundPosition
          });
        }
      });
      
      return analysis;
    });
    
    // Save detailed analysis
    fs.writeFileSync(
      path.join(screenshotsDir, 'detailed_analysis.json'), 
      JSON.stringify(contentAnalysis, null, 2)
    );
    
    console.log('Detailed analysis complete!');
    console.log('Screenshots saved to:', screenshotsDir);
    console.log('Split-screen sections found:', contentAnalysis.splitScreenSections.length);
    console.log('Background images found:', contentAnalysis.backgroundImages.length);
    
  } catch (error) {
    console.error('Error during detailed analysis:', error);
  } finally {
    await browser.close();
  }
}

detailedAnalysis().catch(console.error);