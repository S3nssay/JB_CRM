import { Star, StarHalf } from 'lucide-react';

const TrustIndicators = () => {
  return (
    <section className="py-8 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-neutral-600">Trusted by Thousands of UK Homeowners</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 items-center justify-items-center">
          <div className="flex flex-col items-center">
            <div className="text-secondary text-4xl font-bold">4.8/5</div>
            <div className="flex text-accent text-lg">
              <Star className="fill-current" />
              <Star className="fill-current" />
              <Star className="fill-current" />
              <Star className="fill-current" />
              <StarHalf className="fill-current" />
            </div>
            <div className="text-sm text-neutral-600 mt-1">Trustpilot Reviews</div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="text-secondary text-4xl font-bold">8,500+</div>
            <div className="text-sm text-neutral-600 mt-1">Properties Purchased</div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="text-secondary text-4xl font-bold">£100M+</div>
            <div className="text-sm text-neutral-600 mt-1">Property Value</div>
          </div>
          
          <div className="flex flex-col items-center">
            <div className="text-secondary text-4xl font-bold">9/10</div>
            <div className="text-sm text-neutral-600 mt-1">Would Recommend</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default TrustIndicators;
