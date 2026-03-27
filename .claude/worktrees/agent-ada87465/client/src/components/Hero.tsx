import { ArrowRight, Check, ChevronDown, Clock, Coins, Home, Sparkles } from 'lucide-react';
import { Vortex } from '@/components/ui/vortex';

const Hero = () => {
  return (
    <section className="relative overflow-hidden">
      <Vortex
        backgroundColor="#581c87"
        rangeY={800}
        particleCount={500}
        baseHue={280}
        baseSpeed={0.1}
        rangeSpeed={1.2}
        baseRadius={1}
        rangeRadius={2}
        className="flex items-center justify-center min-h-[80vh] py-16 md:py-24 px-4"
        containerClassName="min-h-[80vh]"
      >
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-block bg-[#F7EF81] px-4 py-2 rounded-full mb-6 animate-bounce">
              <span className="flex items-center font-medium text-purple-900">
                <Sparkles className="h-5 w-5 mr-2" /> Quick & Hassle-Free!
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-white">
              Sell your Property Fast, <span className="underline decoration-4 decoration-[#F7EF81]">Get Paid Cash in 7 days</span>
            </h1>
            
            <p className="text-xl md:text-3xl mb-14 text-white/90 font-light">
              Get a guaranteed cash offer within 24 hours with no fees or hidden costs!
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-14 text-sm max-w-3xl mx-auto">
              <div className="bg-[#F7EF81] rounded-xl p-5 flex flex-col items-center">
                <div className="text-purple-900 p-3 rounded-full mb-3">
                  <Coins className="h-6 w-6" />
                </div>
                <span className="font-medium text-base text-purple-900">No Fees</span>
              </div>
              
              <div className="bg-[#F7EF81] rounded-xl p-5 flex flex-col items-center">
                <div className="text-purple-900 p-3 rounded-full mb-3">
                  <Home className="h-6 w-6" />
                </div>
                <span className="font-medium text-base text-purple-900">No Viewings</span>
              </div>
              
              <div className="bg-[#F7EF81] rounded-xl p-5 flex flex-col items-center">
                <div className="text-purple-900 p-3 rounded-full mb-3">
                  <Check className="h-6 w-6" />
                </div>
                <span className="font-medium text-base text-purple-900">No Chain</span>
              </div>
              
              <div className="bg-[#F7EF81] rounded-xl p-5 flex flex-col items-center">
                <div className="text-purple-900 p-3 rounded-full mb-3">
                  <Clock className="h-6 w-6" />
                </div>
                <span className="font-medium text-base text-purple-900">Fast Completion</span>
              </div>
            </div>
            
            <div className="mt-14">
              <a 
                href="#valuation-form" 
                className="bg-[#F7EF81] hover:bg-[#f0e95a] text-purple-900 text-xl px-10 py-8 h-auto inline-flex items-center rounded-full font-bold shadow-md transition-all duration-300 hover:shadow-lg transform hover:-translate-y-0.5"
                data-testid="link-hero-valuation"
              >
                Get Your Free Valuation <ArrowRight className="ml-3 h-6 w-6" />
              </a>
            </div>
            
            <div className="mt-16">
              <a 
                href="#valuation-form"
                className="inline-flex flex-col items-center text-white/70 hover:text-white transition-colors duration-300"
                data-testid="link-scroll-down"
              >
                <span className="text-sm mb-2">Scroll Down</span>
                <ChevronDown className="h-8 w-8 animate-bounce" />
              </a>
            </div>
          </div>
        </div>
      </Vortex>
    </section>
  );
};

export default Hero;
