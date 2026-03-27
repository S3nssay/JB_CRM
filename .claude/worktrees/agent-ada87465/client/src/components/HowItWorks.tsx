import { Home, MessageSquare, Banknote } from 'lucide-react';
import { Button } from '@/components/ui/button';

const HowItWorks = () => {
  const scrollToValuationForm = () => {
    const element = document.getElementById('valuation-form');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-neutral-100">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-primary mb-4">How It Works</h2>
          <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
            Selling your property has never been easier. Our straightforward process lets you sell your home quickly, with no hassle.
          </p>
        </div>
        
        <div className="grid md:grid-cols-3 gap-8">
          {/* Step 1 */}
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <div className="bg-secondary-light bg-opacity-20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Home className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="text-xl font-bold mb-3">1. Request Valuation</h3>
            <p className="text-neutral-600">
              Enter your postcode and property details to receive a free, no-obligation cash offer within 24 hours.
            </p>
          </div>
          
          {/* Step 2 */}
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <div className="bg-secondary-light bg-opacity-20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <MessageSquare className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="text-xl font-bold mb-3">2. Accept Our Offer</h3>
            <p className="text-neutral-600">
              Review our competitive cash offer and schedule a quick property assessment if you wish to proceed.
            </p>
          </div>
          
          {/* Step 3 */}
          <div className="bg-white p-6 rounded-xl shadow-sm text-center">
            <div className="bg-secondary-light bg-opacity-20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Banknote className="h-8 w-8 text-secondary" />
            </div>
            <h3 className="text-xl font-bold mb-3">3. Completion</h3>
            <p className="text-neutral-600">
              We handle all the paperwork and legal aspects. Sell in as little as 7 days with funds directly to your account.
            </p>
          </div>
        </div>
        
        <div className="mt-12 text-center">
          <Button
            onClick={scrollToValuationForm}
            className="bg-accent hover:bg-accent-light text-white"
          >
            Start Your Free Valuation
          </Button>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
