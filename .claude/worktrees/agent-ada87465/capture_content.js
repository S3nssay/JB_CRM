import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureContent() {
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
    
    await page.waitForTimeout(3000);
    
    const screenshotsDir = path.join(__dirname, 'oilstainlab_content');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir);
    }
    
    // Take initial screenshot
    await page.screenshot({ 
      path: path.join(screenshotsDir, '01_initial.png'),
      fullPage: false 
    });
    
    // Scroll to the very bottom to bypass parallax
    console.log('Scrolling to bottom...');
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: path.join(screenshotsDir, '02_bottom.png'),
      fullPage: false 
    });
    
    // Get the page height and create scroll positions
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    console.log('Page height:', pageHeight);
    
    // Now scroll back up gradually to capture content sections
    const scrollPositions = [
      pageHeight * 0.9,
      pageHeight * 0.8,
      pageHeight * 0.7,
      pageHeight * 0.6,
      pageHeight * 0.5,
      pageHeight * 0.4,
      pageHeight * 0.3,
      pageHeight * 0.2,
      pageHeight * 0.1
    ];
    
    for (let i = 0; i < scrollPositions.length; i++) {
      const scrollPos = await page.evaluate((pos) => {
        const actualPos = Math.floor(pos);
        window.scrollTo(0, actualPos);
        return actualPos;
      }, scrollPositions[i]);
      
      console.log(`Scrolled to: ${scrollPos}px`);
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: path.join(screenshotsDir, `03_content_${i + 1}_${scrollPos}px.png`),
        fullPage: false 
      });
    }
    
    // Try to force visibility of hidden content by injecting CSS
    console.log('Attempting to reveal hidden content...');
    await page.addStyleTag({
      content: `
        * {
          position: static !important;
          transform: none !important;
          opacity: 1 !important;
          visibility: visible !important;
        }
        .section {
          display: block !important;
          position: relative !important;
        }
      `
    });
    
    await page.waitForTimeout(2000);
    
    // Take full page screenshot with forced visibility
    await page.screenshot({ 
      path: path.join(screenshotsDir, '04_forced_visibility.png'),
      fullPage: true 
    });
    
    // Get page content structure
    const contentStructure = await page.evaluate(() => {
      const structure = {
        allText: [],
        sections: [],
        images: [],
        layoutInfo: []
      };
      
      // Get all text content
      const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span');
      textElements.forEach(el => {
        const text = el.textContent.trim();
        if (text && text.length > 2) {
          structure.allText.push({
            tag: el.tagName,
            text: text,
            className: el.className,
            id: el.id
          });
        }
      });
      
      // Get sections with their computed styles
      const sections = document.querySelectorAll('section, div[class*="section"], main, article');
      sections.forEach((section, index) => {
        const style = window.getComputedStyle(section);
        const rect = section.getBoundingClientRect();
        
        structure.sections.push({
          index,
          tag: section.tagName,
          className: section.className,
          id: section.id,
          display: style.display,
          position: style.position,
          backgroundColor: style.backgroundColor,
          width: rect.width,
          height: rect.height,
          top: rect.top,
          left: rect.left,
          textContent: section.textContent.trim().substring(0, 200)
        });
      });
      
      // Get images
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        structure.images.push({
          src: img.src,
          alt: img.alt,
          className: img.className,
          width: img.width,
          height: img.height
        });
      });
      
      return structure;
    });
    
    // Save content structure
    fs.writeFileSync(
      path.join(screenshotsDir, 'content_structure.json'), 
      JSON.stringify(contentStructure, null, 2)
    );
    
    console.log('Content capture complete!');
    console.log('Screenshots saved to:', screenshotsDir);
    console.log('Text elements found:', contentStructure.allText.length);
    console.log('Sections found:', contentStructure.sections.length);
    console.log('Images found:', contentStructure.images.length);
    
  } catch (error) {
    console.error('Error during content capture:', error);
  } finally {
    await browser.close();
  }
}

captureContent().catch(console.error);