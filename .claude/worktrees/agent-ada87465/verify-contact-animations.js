import { chromium } from 'playwright';

async function verifyContactAnimations() {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log('🎬 VERIFYING CONTACT SECTION GSAP ANIMATIONS\n');

    await page.goto('http://localhost:5000', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForTimeout(2000);

    // Navigate to contact section
    await page.evaluate(() => {
      const contactSection = document.getElementById('contact');
      if (contactSection) {
        contactSection.scrollIntoView({ behavior: 'smooth' });
      }
    });

    await page.waitForTimeout(3000);

    // Check for GSAP animations in contact section
    const animationInfo = await page.evaluate(() => {
      const contactSection = document.getElementById('contact');
      if (!contactSection) return { error: 'Contact section not found' };

      // Check for animated elements
      const titleElement = contactSection.querySelector('h2');
      const subtitleElement = contactSection.querySelector('p');
      const phoneElement = contactSection.querySelector('[class*="phone"]');
      const emailElement = contactSection.querySelector('[class*="email"]');
      const locationElement = contactSection.querySelector('[class*="location"]');
      const whatsappButton = contactSection.querySelector('a[href*="wa.me"]');
      const workingHours = contactSection.querySelector('[class*="hours"]');

      // Check for GSAP animations
      const hasGsapElements = !!window.gsap;
      const hasScrollTrigger = !!window.ScrollTrigger;

      return {
        hasGsap: hasGsapElements,
        hasScrollTrigger,
        elements: {
          title: !!titleElement,
          subtitle: !!subtitleElement,
          phone: !!phoneElement,
          email: !!emailElement,
          location: !!locationElement,
          whatsapp: !!whatsappButton,
          workingHours: !!workingHours
        },
        contactSectionVisible: contactSection.offsetHeight > 0,
        contactSectionClass: contactSection.className
      };
    });

    console.log('Animation Library Status:');
    console.log(`  GSAP loaded: ${animationInfo.hasGsap ? '✅' : '❌'}`);
    console.log(`  ScrollTrigger loaded: ${animationInfo.hasScrollTrigger ? '✅' : '❌'}`);
    console.log('');

    console.log('Contact Section Elements:');
    console.log(`  Title: ${animationInfo.elements.title ? '✅' : '❌'}`);
    console.log(`  Subtitle: ${animationInfo.elements.subtitle ? '✅' : '❌'}`);
    console.log(`  Phone: ${animationInfo.elements.phone ? '✅' : '❌'}`);
    console.log(`  Email: ${animationInfo.elements.email ? '✅' : '❌'}`);
    console.log(`  Location: ${animationInfo.elements.location ? '✅' : '❌'}`);
    console.log(`  WhatsApp: ${animationInfo.elements.whatsapp ? '✅' : '❌'}`);
    console.log(`  Working Hours: ${animationInfo.elements.workingHours ? '✅' : '❌'}`);
    console.log('');

    console.log('Section Status:');
    console.log(`  Contact section visible: ${animationInfo.contactSectionVisible ? '✅' : '❌'}`);
    console.log(`  Section classes: ${animationInfo.contactSectionClass}`);
    console.log('');

    // Take screenshot of contact section
    await page.screenshot({
      path: 'contact-section-verification.png',
      fullPage: false
    });

    console.log('📸 Screenshot saved: contact-section-verification.png');
    console.log('✅ Contact section animation verification completed!');

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
  }

  await browser.close();
}

verifyContactAnimations().catch(console.error);