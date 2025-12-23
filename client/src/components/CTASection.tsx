import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { ArrowRight } from 'lucide-react';

const CTASection = () => {
  const [postcode, setPostcode] = useState('');
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!postcode) {
      toast({
        title: "Postcode required",
        description: "Please enter your postcode to continue",
        variant: "destructive"
      });
      return;
    }
    
    // Scroll to the valuation form and pre-fill the postcode
    const valuationForm = document.getElementById('valuation-form');
    if (valuationForm) {
      valuationForm.scrollIntoView({ behavior: 'smooth' });
      
      // Find the postcode input field and set its value
      const postcodeInput = document.querySelector('input[name="postcode"]') as HTMLInputElement;
      if (postcodeInput) {
        postcodeInput.value = postcode;
        postcodeInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  };

  return (
    <section className="py-16 md:py-24 bg-neutral-100">
      <div className="container mx-auto px-4">
        <div className="bg-primary rounded-xl p-8 md:p-12 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to Get Your Free Valuation?</h2>
          <p className="text-lg text-neutral-200 max-w-3xl mx-auto mb-8">
            Start your property selling journey today with our no-obligation valuation. Receive a fair cash offer within 24 hours.
          </p>
          
          <div className="bg-white p-6 rounded-lg md:max-w-md mx-auto text-neutral-800">
            <form onSubmit={handleSubmit}>
              <h3 className="text-xl font-bold mb-4 text-primary">Enter Your Postcode</h3>
              <div className="flex">
                <Input
                  type="text"
                  placeholder="e.g. SW1A 1AA"
                  value={postcode}
                  onChange={(e) => setPostcode(e.target.value)}
                  className="flex-1 rounded-r-none"
                />
                <Button 
                  type="submit" 
                  className="bg-[#F7EF81] hover:bg-[#F7EF81]/90 text-[#0E6BFF] rounded-l-none"
                >
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CTASection;
