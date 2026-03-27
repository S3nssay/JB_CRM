import { 
  Clock, 
  PoundSterling, 
  ShieldCheck, 
  Home, 
  Users, 
  HeadphonesIcon,
  Sparkles,
  ThumbsUp
} from 'lucide-react';

const Benefits = () => {
  return (
    <section id="benefits" className="py-20 md:py-32 bg-gradient-to-b from-white to-[#C9CFD5]/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-20">
          <div className="inline-flex items-center gap-2 bg-[#0E6BFF]/10 text-[#0E6BFF] px-5 py-3 rounded-full mb-6">
            <Sparkles className="h-5 w-5" />
            <span className="font-medium text-lg">Benefits You'll Love</span>
            <Sparkles className="h-5 w-5" />
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-[#0E6BFF]">Why Sellers Choose Us</h2>
          <p className="text-xl text-[#8D97A5] max-w-3xl mx-auto">
            Skip the stress of traditional selling! Our hassle-free approach makes selling your property a breeze.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          {/* Benefit 1 - Fast Sale */}
          <div className="bg-[#F7EF81] p-6 rounded-xl shadow-lg">
            <div className="flex">
              <div className="flex-shrink-0 mr-4">
                <Clock className="h-8 w-8 text-[#0E6BFF]" />
              </div>
              <div>
                <h3 className="font-bold text-2xl mb-2 text-[#0E6BFF]">Fast Sale</h3>
                <p className="text-lg text-gray-600">
                  7-28 days completion vs 6-9 months traditional sale
                </p>
              </div>
            </div>
          </div>
          
          {/* Benefit 2 - Cash Buyers */}
          <div className="bg-[#F7EF81] p-6 rounded-xl shadow-lg">
            <div className="flex">
              <div className="flex-shrink-0 mr-4">
                <PoundSterling className="h-8 w-8 text-[#0E6BFF]" />
              </div>
              <div>
                <h3 className="font-bold text-2xl mb-2 text-[#0E6BFF]">Cash Buyers</h3>
                <p className="text-lg text-gray-600">
                  No chain means no delays or fall-throughs
                </p>
              </div>
            </div>
          </div>
          
          {/* Benefit 3 - No Fees */}
          <div className="bg-[#F7EF81] p-6 rounded-xl shadow-lg">
            <div className="flex">
              <div className="flex-shrink-0 mr-4">
                <ShieldCheck className="h-8 w-8 text-[#0E6BFF]" />
              </div>
              <div>
                <h3 className="font-bold text-2xl mb-2 text-[#0E6BFF]">No Fees</h3>
                <p className="text-lg text-gray-600">
                  No estate agent or legal fees to pay
                </p>
              </div>
            </div>
          </div>
          
          {/* Benefit 4 - Any Condition */}
          <div className="bg-[#F7EF81] p-6 rounded-xl shadow-lg">
            <div className="flex">
              <div className="flex-shrink-0 mr-4">
                <Home className="h-8 w-8 text-[#0E6BFF]" />
              </div>
              <div>
                <h3 className="font-bold text-2xl mb-2 text-[#0E6BFF]">Any Condition</h3>
                <p className="text-lg text-gray-600">
                  We buy properties in any condition
                </p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Comparison Cards */}
        <div className="mt-28">
          <h3 className="text-3xl md:text-4xl font-bold mb-12 text-center text-[#0E6BFF] flex items-center justify-center gap-3">
            <ThumbsUp className="h-8 w-8 text-[#0E6BFF]" />
            <span>Us vs Traditional Estate Agents</span>
          </h3>
          
          <div className="grid md:grid-cols-2 gap-10">
            {/* Our Way */}
            <div className="fun-card bg-[#F7EF81] p-10 relative rounded-xl shadow-xl">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-[#0E6BFF] text-white font-bold py-3 px-8 rounded-full text-xl">
                Our Way
              </div>
              <ul className="space-y-6 mt-8">
                <li className="flex items-center text-[#0E6BFF]">
                  <div className="bg-white p-2 rounded-full mr-4 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="font-medium text-lg">Sell in just 7-28 days</span>
                </li>
                <li className="flex items-center text-[#0E6BFF]">
                  <div className="bg-white p-2 rounded-full mr-4 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="font-medium text-lg">£0 in fees - keep more money!</span>
                </li>
                <li className="flex items-center text-[#0E6BFF]">
                  <div className="bg-white p-2 rounded-full mr-4 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="font-medium text-lg">100% guaranteed sale</span>
                </li>
                <li className="flex items-center text-[#0E6BFF]">
                  <div className="bg-white p-2 rounded-full mr-4 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="font-medium text-lg">Just one viewing</span>
                </li>
                <li className="flex items-center text-[#0E6BFF]">
                  <div className="bg-white p-2 rounded-full mr-4 shadow-md">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <span className="font-medium text-lg">No repairs needed</span>
                </li>
              </ul>
            </div>
            
            {/* Traditional Way */}
            <div className="fun-card bg-white p-10 relative rounded-xl shadow-xl">
              <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 bg-[#8D97A5] text-white font-bold py-3 px-8 rounded-full text-xl">
                Traditional Way
              </div>
              <ul className="space-y-6 mt-8">
                <li className="flex items-center text-[#8D97A5]">
                  <div className="bg-[#C9CFD5] p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  <span className="font-medium text-lg">Wait 4-6 months to sell</span>
                </li>
                <li className="flex items-center text-[#8D97A5]">
                  <div className="bg-[#C9CFD5] p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  <span className="font-medium text-lg">1-3% agent fees + legal costs</span>
                </li>
                <li className="flex items-center text-[#8D97A5]">
                  <div className="bg-[#C9CFD5] p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  <span className="font-medium text-lg">Sales often fall through</span>
                </li>
                <li className="flex items-center text-[#8D97A5]">
                  <div className="bg-[#C9CFD5] p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  <span className="font-medium text-lg">10+ viewings on average</span>
                </li>
                <li className="flex items-center text-[#8D97A5]">
                  <div className="bg-[#C9CFD5] p-2 rounded-full mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </div>
                  <span className="font-medium text-lg">Costly repairs often needed</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;
