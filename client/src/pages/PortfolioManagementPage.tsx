import { Button } from '@/components/ui/button';
import { Users, Home, ArrowLeft, MessageCircle, Wrench, Zap, Flame, Droplet, Sparkles, Settings, FileCheck } from 'lucide-react';
import { Link } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";
import { professionalServices, lettingServicePackages, certificatesAndCompliance } from '@shared/lettingServiceTerms';

export default function PortfolioManagementPage() {
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
              PORTFOLIO
              <span className="block text-[#F8B324]">MANAGEMENT</span>
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto mb-12">
            Comprehensive management services for commercial property portfolios
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
            <h2 className="text-3xl font-black mb-6 text-[#F8B324]">Professional Portfolio Management</h2>
            <div className="space-y-6 text-lg text-white/90">
              <p>
                Maximize returns and minimize hassle with our comprehensive commercial portfolio management services. We handle all aspects of property management, from tenant relations to financial reporting, so you can focus on growing your investment.
              </p>

              <h3 className="text-2xl font-bold text-white mt-8 mb-4">Our Services</h3>
              <ul className="space-y-3">
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Multi-property portfolio oversight</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Tenant acquisition & retention strategies</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Maintenance coordination & quality control</span>
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-3 text-2xl">•</span>
                  <span>Financial reporting & tax optimization</span>
                </li>
              </ul>

              <div className="mt-10 pt-8 border-t border-white/20">
                <h3 className="text-2xl font-bold text-white mb-6">Let Us Manage Your Portfolio</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="/commercial">
                    <Button className="bg-[#F8B324] hover:bg-[#d89b1f] text-black font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300">
                      <Users className="mr-2 h-5 w-5" />
                      Our Services
                    </Button>
                  </Link>
                  <a href="https://wa.me/447123456789?text=Hi%2C%20I%27d%20like%20to%20schedule%20a%20consultation" target="_blank" rel="noopener noreferrer">
                    <Button className="bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300">
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Schedule Consultation
                    </Button>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Professional Services Section */}
      <section className="py-20 bg-gradient-to-b from-black to-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4 text-white">
            Professional <span className="text-[#F8B324]">Services</span>
          </h2>
          <p className="text-xl text-gray-400 text-center mb-16 max-w-3xl mx-auto">
            Our fully qualified team offers a complete range of property maintenance and refurbishment services
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {professionalServices.map((service) => {
              const getServiceIcon = (id: string) => {
                switch (id) {
                  case 'refurbishments': return <Wrench className="h-8 w-8" />;
                  case 'epc-floorplans': return <FileCheck className="h-8 w-8" />;
                  case 'gas-safety': return <Flame className="h-8 w-8" />;
                  case 'plumbing': return <Droplet className="h-8 w-8" />;
                  case 'electrical': return <Zap className="h-8 w-8" />;
                  case 'cleaning': return <Sparkles className="h-8 w-8" />;
                  case 'property-admin': return <Settings className="h-8 w-8" />;
                  default: return <Wrench className="h-8 w-8" />;
                }
              };

              return (
                <div key={service.id} className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10 hover:border-[#F8B324]/50 transition-all duration-300 hover:transform hover:scale-105">
                  <div className="text-[#F8B324] mb-4">
                    {getServiceIcon(service.id)}
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3">{service.name}</h3>
                  <p className="text-gray-400 mb-4">{service.description}</p>
                  <ul className="space-y-2">
                    {service.features.slice(0, 4).map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm text-gray-300">
                        <span className="text-[#F8B324] mr-2">✓</span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  {service.teamQualifications && (
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Qualifications</p>
                      <p className="text-sm text-[#F8B324]">{service.teamQualifications.join(' • ')}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Management Packages Section */}
      <section className="py-20 bg-gray-900">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4 text-white">
            Letting <span className="text-[#F8B324]">Packages</span>
          </h2>
          <p className="text-xl text-gray-400 text-center mb-16 max-w-3xl mx-auto">
            Choose the right management package for your property portfolio
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {lettingServicePackages.map((pkg, idx) => (
              <div
                key={pkg.id}
                className={`rounded-2xl p-8 ${idx === 2 ? 'bg-[#791E75] border-2 border-[#F8B324]' : 'bg-white/5 border border-white/10'}`}
              >
                {idx === 2 && (
                  <div className="bg-[#F8B324] text-black text-xs font-bold px-3 py-1 rounded-full inline-block mb-4">
                    MOST POPULAR
                  </div>
                )}
                <h3 className="text-2xl font-bold text-white mb-2">{pkg.name}</h3>
                <div className="flex items-baseline mb-4">
                  <span className="text-5xl font-black text-[#F8B324]">{pkg.feePercentage}%</span>
                  <span className="text-gray-400 ml-2">{pkg.feeType === 'upfront' ? 'upfront' : 'monthly'}</span>
                </div>
                <p className="text-gray-300 mb-6">{pkg.description}</p>
                <ul className="space-y-3">
                  {pkg.services.map((service, serviceIdx) => (
                    <li key={serviceIdx} className="flex items-start text-sm text-gray-300">
                      <span className="text-[#F8B324] mr-2">✓</span>
                      {service}
                    </li>
                  ))}
                </ul>
                <Link href="/register-rental">
                  <Button className={`w-full mt-8 py-4 rounded-xl font-bold ${idx === 2 ? 'bg-[#F8B324] text-black hover:bg-[#d89b1f]' : 'bg-white/10 text-white hover:bg-white/20'}`}>
                    Get Started
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certificates Section */}
      <section className="py-20 bg-black">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-4xl md:text-5xl font-black text-center mb-4 text-white">
            Certificates & <span className="text-[#F8B324]">Compliance</span>
          </h2>
          <p className="text-xl text-gray-400 text-center mb-16 max-w-3xl mx-auto">
            We handle all the mandatory certifications and legal requirements for your rental property
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {certificatesAndCompliance.map((cert, idx) => (
              <div key={idx} className="bg-white/5 rounded-xl p-6 text-center hover:bg-white/10 transition-all">
                <div className="text-[#F8B324] text-3xl font-black mb-2">£{cert.price}</div>
                <h4 className="text-white font-semibold mb-2">{cert.name}</h4>
                <p className="text-gray-400 text-sm">{cert.description}</p>
                {cert.notes && (
                  <p className="text-xs text-[#F8B324] mt-3">{cert.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#791E75]">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6 text-white">
            Ready to Maximize Your Rental Income?
          </h2>
          <p className="text-xl text-white/80 mb-10">
            Contact us today for a free property valuation and consultation
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/register-rental">
              <Button className="bg-[#F8B324] hover:bg-[#d89b1f] text-black font-bold py-4 px-10 rounded-xl text-lg">
                Register Your Property
              </Button>
            </Link>
            <a href="https://wa.me/447123456789?text=Hi%2C%20I%27d%20like%20to%20enquire%20about%20your%20property%20management%20services" target="_blank" rel="noopener noreferrer">
              <Button className="bg-transparent border-2 border-white hover:bg-white hover:text-[#791E75] text-white font-bold py-4 px-10 rounded-xl text-lg">
                <MessageCircle className="mr-2 h-5 w-5" />
                Contact Us
              </Button>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
