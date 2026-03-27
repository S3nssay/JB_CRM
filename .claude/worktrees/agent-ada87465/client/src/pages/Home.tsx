import Hero from '@/components/Hero';
import TrustIndicators from '@/components/TrustIndicators';
import HowItWorks from '@/components/HowItWorks';
import Benefits from '@/components/Benefits';
import FeaturedProperties from '@/components/FeaturedProperties';
import Testimonials from '@/components/Testimonials';
import FAQ from '@/components/FAQ';
import CTASection from '@/components/CTASection';
import ContactSection from '@/components/ContactSection';
import { Helmet } from 'react-helmet';

const Home = () => {
  return (
    <>
      <Helmet>
        <title>QuickSell Properties | Fast & Fair Property Valuations</title>
        <meta name="description" content="Get a fast and fair cash offer for your property. Sell your house quickly with no fees and completion in as little as 7 days." />
      </Helmet>
      
      <Hero />
      <TrustIndicators />
      <HowItWorks />
      <Benefits />
      <FeaturedProperties />
      <Testimonials />
      <FAQ />
      <CTASection />
      <ContactSection />
    </>
  );
};

export default Home;
