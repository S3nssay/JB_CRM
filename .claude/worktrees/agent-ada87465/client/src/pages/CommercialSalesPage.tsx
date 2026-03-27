import { Button } from '@/components/ui/button';
import { Building2, Home, ArrowLeft, Phone } from 'lucide-react';
import { Link } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";

export default function CommercialSalesPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#791E75' }}>
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-purple-600/10 rounded-full blur-sm animate-float-slow"></div>
          <div className="absolute bottom-20 right-32 w-48 h-48 bg-gradient-to-br from-purple-500/15 to-purple-700/5 rounded-3xl rotate-45 blur-sm animate-float-reverse"></div>
        </div>
        
        <div className="relative z-10 text-center max-w-6xl mx-auto px-6">
          <div className="mb-6">
            <img 
              src={heroLogo} 
              alt="John Barclay Estate & Management" 
              className="max-w-xl w-full h-auto mx-auto mb-4"
            />
            <h1 className="text-5xl md:text-7xl font-black leading-none mb-6 text-white">
              COMMERCIAL
              <span className="block text-[#F8B324]">SALES</span>
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto mb-12">
            Expert commercial property sales services across London
          </p>
          
          {/* Navigation Buttons */}
          <div className="flex justify-center gap-4 mb-12">
            <Link href="/commercial">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl" data-testid="button-back">
                <ArrowLeft className="mr-2 h-5 w-5" />
                BACK
              </Button>
            </Link>
            <Link href="/">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl" data-testid="button-home">
                <Home className="mr-2 h-5 w-5" />
                HOME
              </Button>
            </Link>
          </div>

          {/* Content Section */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-10 max-w-4xl mx-auto text-left">
            <h2 className="text-3xl font-black mb-6 text-[#F8B324]">Our Commercial Sales Services</h2>
            <div className="space-y-6 text-lg text-white/90">
              <p>
                Our experienced commercial sales team specializes in buying and selling commercial properties across London. From office buildings to retail spaces, we handle every aspect of the transaction with professionalism and expertise.
              </p>
              
              <h3 className="text-2xl font-bold text-white mt-8 mb-4">Property Types</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Office buildings & business parks</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Retail units & shopping centers</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Industrial warehouses & logistics facilities</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Mixed-use developments</span>
                </li>
              </ul>

              <div className="mt-10 pt-8 border-t border-white/20">
                <h3 className="text-2xl font-bold text-white mb-6">Ready to Buy or Sell?</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/commercial">
                    <Button className="bg-[#F8B324] hover:bg-[#d89b1f] text-black font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300">
                      <Building2 className="mr-2 h-5 w-5" />
                      View Available Properties
                    </Button>
                  </Link>
                  <Link href="/">
                    <Button className="bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300">
                      <Phone className="mr-2 h-5 w-5" />
                      Contact Our Team
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
