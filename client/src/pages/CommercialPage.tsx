import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { 
  Building2, 
  MapPin,
  Maximize,
  Search,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  Users,
  PoundSterling,
  Home,
  Key
} from 'lucide-react';
import { Link } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";
import AISearchBubble from '@/components/AISearchBubble';
import { PropertyChatInterface } from '@/components/PropertyChatInterface';

gsap.registerPlugin(ScrollTrigger);

interface CommercialProperty {
  id: number;
  listingType: string;
  title: string;
  description: string;
  price: number;
  propertyType: string;
  squareFootage?: number;
  addressLine1: string;
  postcode: string;
  images: string[];
  features: string[];
  areaName?: string;
  status: string;
  businessType?: string;
  leaseLength?: number;
  serviceCharge?: number;
}

export default function CommercialPage() {
  const [searchForm, setSearchForm] = useState({
    location: '',
    propertyType: '',
    minSize: '',
    maxPrice: '',
    businessType: ''
  });

  const heroRef = useRef(null);
  const featuredRef = useRef(null);
  const searchRef = useRef(null);

  // Fetch featured commercial properties
  const { data: featuredProperties = [], isLoading: featuredLoading } = useQuery({
    queryKey: ['/api/properties', 'featured', 'commercial'],
    queryFn: async () => {
      const response = await fetch('/api/properties?listingType=commercial&featured=true&limit=6');
      return response.json();
    }
  });

  // Fetch all commercial properties
  const { data: allProperties = [], isLoading: allLoading } = useQuery({
    queryKey: ['/api/properties', 'commercial', searchForm],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('listingType', 'commercial');
      if (searchForm.location) params.set('location', searchForm.location);
      if (searchForm.propertyType) params.set('propertyType', searchForm.propertyType);
      if (searchForm.minSize) params.set('minSize', searchForm.minSize);
      if (searchForm.maxPrice) params.set('maxPrice', searchForm.maxPrice);
      if (searchForm.businessType) params.set('businessType', searchForm.businessType);
      
      const response = await fetch(`/api/properties?${params.toString()}`);
      return response.json();
    }
  });

  // GSAP Animations
  useEffect(() => {
    // Hero animation
    gsap.fromTo(heroRef.current, {
      opacity: 0,
      y: 50
    }, {
      opacity: 1,
      y: 0,
      duration: 1.5,
      ease: "power4.out"
    });

    // Featured properties animation
    gsap.fromTo('.featured-card', {
      opacity: 0,
      y: 100,
      scale: 0.9
    }, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.2,
      stagger: 0.1,
      ease: "power4.out",
      scrollTrigger: {
        trigger: featuredRef.current,
        start: "top 80%"
      }
    });

    // Property cards animation
    gsap.fromTo('.property-card', {
      opacity: 0,
      y: 80
    }, {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.1,
      ease: "power3.out",
      scrollTrigger: {
        trigger: '.properties-grid',
        start: "top 80%"
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, [featuredProperties, allProperties]);

  const formatPrice = (price: number, isRental?: boolean) => {
    if (isRental) {
      return `£${price.toLocaleString()} pcm`;
    }
    return `£${price.toLocaleString()}`;
  };

  const handleSearch = () => {
    // Search is handled by the query refetch
  };

  const handleNaturalLanguageSearch = async (query: string) => {
    try {
      // Send natural language query to backend for parsing
      const response = await fetch('/api/search/natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, listingType: 'commercial' })
      });

      if (response.ok) {
        const searchCriteria = await response.json();
        // Update the search form with parsed criteria
        setSearchForm({
          location: searchCriteria.location || '',
          propertyType: searchCriteria.propertyType || '',
          minSize: searchCriteria.minSize || '',
          maxPrice: searchCriteria.maxPrice || '',
          businessType: searchCriteria.businessType || ''
        });
      }
    } catch (error) {
      console.error('Natural language search failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      
      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pt-16 pb-8" style={{ backgroundColor: '#791E75' }}>
        <div className="relative z-10 text-center max-w-6xl mx-auto px-6">
          <div className="mb-6">
            <img 
              src={heroLogo} 
              alt="John Barclay Estate & Management" 
              className="max-w-xl w-full h-auto mx-auto mb-4"
            />
            <h1 className="text-5xl md:text-7xl font-black leading-none mb-6 text-white">
              COMMERCIAL
              <span className="block text-white">PROPERTIES</span>
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto mb-8">
            Prime commercial spaces in London's most dynamic business districts
          </p>
          
          {/* Navigation Buttons */}
          <div className="flex justify-center gap-4 mb-8">
            <Link href="/">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl" data-testid="button-home">
                <Home className="mr-2 h-5 w-5" />
                HOME
              </Button>
            </Link>
            <Link href="/sales">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl" data-testid="button-sales">
                <Building2 className="mr-2 h-5 w-5" />
                SALES
              </Button>
            </Link>
            <Link href="/rentals">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl" data-testid="button-rentals">
                <Key className="mr-2 h-5 w-5" />
                RENTALS
              </Button>
            </Link>
          </div>
          
          {/* Advanced Search Bar */}
          <div ref={searchRef} className="bg-white/10 backdrop-blur-md rounded-2xl p-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-1">
                <input
                  type="text"
                  placeholder="Enter Postcode or Area"
                  value={searchForm.location}
                  onChange={(e) => setSearchForm({...searchForm, location: e.target.value})}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/60 focus:outline-none focus:ring-2 focus:ring-[#F8B324]"
                />
              </div>
              
              <div className="relative">
                <select
                  value={searchForm.propertyType}
                  onChange={(e) => setSearchForm({...searchForm, propertyType: e.target.value})}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#F8B324]"
                >
                  <option value="" className="text-gray-900 bg-white">Property Type</option>
                  <option value="office" className="text-gray-900 bg-white">Office</option>
                  <option value="retail" className="text-gray-900 bg-white">Retail</option>
                  <option value="warehouse" className="text-gray-900 bg-white">Warehouse</option>
                  <option value="industrial" className="text-gray-900 bg-white">Industrial</option>
                  <option value="restaurant" className="text-gray-900 bg-white">Restaurant</option>
                  <option value="mixed_use" className="text-gray-900 bg-white">Mixed Use</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
              </div>
              
              <div className="relative">
                <select
                  value={searchForm.minSize}
                  onChange={(e) => setSearchForm({...searchForm, minSize: e.target.value})}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#F8B324]"
                >
                  <option value="" className="text-gray-900 bg-white">Min Size</option>
                  <option value="500" className="text-gray-900 bg-white">500+ sq ft</option>
                  <option value="1000" className="text-gray-900 bg-white">1,000+ sq ft</option>
                  <option value="2500" className="text-gray-900 bg-white">2,500+ sq ft</option>
                  <option value="5000" className="text-gray-900 bg-white">5,000+ sq ft</option>
                  <option value="10000" className="text-gray-900 bg-white">10,000+ sq ft</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
              </div>
              
              <div className="relative">
                <select
                  value={searchForm.maxPrice}
                  onChange={(e) => setSearchForm({...searchForm, maxPrice: e.target.value})}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#F8B324]"
                >
                  <option value="" className="text-gray-900 bg-white">Max Price</option>
                  <option value="2000" className="text-gray-900 bg-white">£2,000 pcm</option>
                  <option value="5000" className="text-gray-900 bg-white">£5,000 pcm</option>
                  <option value="10000" className="text-gray-900 bg-white">£10,000 pcm</option>
                  <option value="25000" className="text-gray-900 bg-white">£25,000 pcm</option>
                  <option value="50000" className="text-gray-900 bg-white">£50,000+ pcm</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
              </div>
              
              <div className="relative">
                <select
                  value={searchForm.businessType}
                  onChange={(e) => setSearchForm({...searchForm, businessType: e.target.value})}
                  className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-[#F8B324]"
                >
                  <option value="" className="text-gray-900 bg-white">Business Type</option>
                  <option value="professional_services" className="text-gray-900 bg-white">Professional Services</option>
                  <option value="creative_industries" className="text-gray-900 bg-white">Creative Industries</option>
                  <option value="technology" className="text-gray-900 bg-white">Technology</option>
                  <option value="finance" className="text-gray-900 bg-white">Finance</option>
                  <option value="healthcare" className="text-gray-900 bg-white">Healthcare</option>
                  <option value="hospitality" className="text-gray-900 bg-white">Hospitality</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-white/60 pointer-events-none" />
              </div>
              
              <Button
                onClick={handleSearch}
                className="bg-[#791E75] hover:bg-[#5d1759] text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center"
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Commercial Services Section - 4 Main Services */}
      <section className="py-20 px-6 bg-gradient-to-b from-black to-[#1a1a1a]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-black mb-6">COMMERCIAL SERVICES</h2>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Complete commercial property solutions for every business need
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            {/* Commercial Sales */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-10 hover:bg-white/10 transition-all duration-300 border border-[#F8B324]/20">
              <Building2 className="h-16 w-16 text-[#F8B324] mb-6" />
              <h3 className="text-2xl md:text-3xl font-black mb-4">COMMERCIAL SALES</h3>
              <p className="text-white/80 mb-6 text-lg">
                Buy or sell commercial properties with our expert sales team. From offices to retail spaces, we handle every aspect of the transaction.
              </p>
              <ul className="text-white/70 mb-6 space-y-2">
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  Office buildings & business parks
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  Retail units & shopping centers
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  Industrial warehouses & logistics
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  Mixed-use developments
                </li>
              </ul>
              <Link href="/commercial-sales">
                <Button className="bg-[#F8B324] hover:bg-[#d89b1f] text-black font-bold transition-all duration-300" data-testid="button-commercial-sales">
                  Explore Sales Listings
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Commercial Lettings */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-10 hover:bg-white/10 transition-all duration-300 border border-[#791E75]/20">
              <Building2 className="h-16 w-16 text-[#791E75] mb-6" />
              <h3 className="text-2xl md:text-3xl font-black mb-4">COMMERCIAL LETTINGS</h3>
              <p className="text-white/80 mb-6 text-lg">
                Flexible leasing options for businesses of all sizes. Find the perfect commercial space or let your property with confidence.
              </p>
              <ul className="text-white/70 mb-6 space-y-2">
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Flexible lease terms & serviced offices
                </li>
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Co-working & shared spaces
                </li>
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Restaurant & hospitality units
                </li>
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Tenant representation services
                </li>
              </ul>
              <Link href="/commercial-lettings">
                <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white font-bold transition-all duration-300" data-testid="button-commercial-lettings">
                  View Lettings
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Investment Opportunities */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-10 hover:bg-white/10 transition-all duration-300 border border-[#F8B324]/20">
              <TrendingUp className="h-16 w-16 text-[#F8B324] mb-6" />
              <h3 className="text-2xl md:text-3xl font-black mb-4">INVESTMENT OPPORTUNITIES</h3>
              <p className="text-white/80 mb-6 text-lg">
                Strategic commercial property investments with proven returns. Access exclusive off-market deals and development opportunities.
              </p>
              <ul className="text-white/70 mb-6 space-y-2">
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  High-yield investment properties
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  Development & redevelopment sites
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  Off-market exclusive deals
                </li>
                <li className="flex items-start">
                  <span className="text-[#F8B324] mr-2">•</span>
                  ROI analysis & market insights
                </li>
              </ul>
              <Link href="/investment-opportunities">
                <Button className="bg-[#F8B324] hover:bg-[#d89b1f] text-black font-bold transition-all duration-300" data-testid="button-investment-opportunities">
                  View Opportunities
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            {/* Portfolio Management */}
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-10 hover:bg-white/10 transition-all duration-300 border border-[#791E75]/20">
              <Users className="h-16 w-16 text-[#791E75] mb-6" />
              <h3 className="text-2xl md:text-3xl font-black mb-4">PORTFOLIO MANAGEMENT</h3>
              <p className="text-white/80 mb-6 text-lg">
                Comprehensive management services for commercial property portfolios. Maximize returns while we handle the day-to-day operations.
              </p>
              <ul className="text-white/70 mb-6 space-y-2">
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Multi-property portfolio oversight
                </li>
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Tenant relations & lease management
                </li>
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Maintenance coordination & compliance
                </li>
                <li className="flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  Financial reporting & tax optimization
                </li>
              </ul>
              <Link href="/portfolio-management">
                <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white font-bold transition-all duration-300" data-testid="button-portfolio-management">
                  Portfolio Services
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Properties Section */}
      <section ref={featuredRef} className="py-20 px-6 bg-black">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-4">
              <h2 className="text-4xl md:text-5xl font-black">PREMIUM COMMERCIAL SPACES</h2>
            </div>
            <p className="text-xl text-white/70 max-w-2xl mx-auto">
              Strategically located commercial properties for forward-thinking businesses
            </p>
          </div>

          {featuredLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white/5 rounded-2xl h-96 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.map((property: CommercialProperty) => (
                <Link 
                  key={property.id}
                  href={`/property/${property.id}`}
                  className="featured-card group block"
                >
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:-translate-y-2 border border-white/20">
                    {/* Property Image */}
                    <div className="relative h-64 overflow-hidden">
                      <img 
                        src={property.images?.[0] || '/api/placeholder/400/300'}
                        alt={property.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="bg-[#F8B324] text-black px-3 py-1 rounded-full text-sm font-bold flex items-center">
                          <Building2 className="h-3 w-3 mr-1" />
                          FEATURED
                        </span>
                      </div>
                      <div className="absolute bottom-4 right-4">
                        <span className="bg-black/80 text-white px-3 py-2 rounded-full text-lg font-bold">
                          {formatPrice(property.price, property.listingType === 'rental')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Property Details */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-[#F8B324] transition-colors duration-300">
                        {property.title}
                      </h3>
                      
                      <div className="flex items-center text-white/60 mb-4">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>{property.addressLine1}, {property.postcode}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-white/80 mb-4">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-1" />
                          <span>{property.propertyType?.replace('_', ' ')}</span>
                        </div>
                        {property.squareFootage && (
                          <div className="flex items-center">
                            <Maximize className="h-4 w-4 mr-1" />
                            <span>{property.squareFootage.toLocaleString()} sq ft</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-white/60 text-sm mb-4 line-clamp-2">
                        {property.description}
                      </p>
                      
                      <Button className="w-full bg-[#791E75] hover:bg-[#5d1759] text-white font-bold py-2 rounded-lg transition-all duration-300">
                        View Details
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* All Properties Section */}
      <section className="py-20 px-6 bg-gradient-to-b from-black to-[#1a1a1a]">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h2 className="text-3xl md:text-4xl font-black mb-4">ALL COMMERCIAL PROPERTIES</h2>
            </div>
            <div className="flex items-center text-[#F8B324]">
              <TrendingUp className="h-5 w-5 mr-2" />
              <span className="font-medium">Prime locations available</span>
            </div>
          </div>

          {allLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(9)].map((_, i) => (
                <div key={i} className="bg-white/5 rounded-2xl h-96 animate-pulse"></div>
              ))}
            </div>
          ) : (
            <div className="properties-grid grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {allProperties.map((property: CommercialProperty) => (
                <Link 
                  key={property.id}
                  href={`/property/${property.id}`}
                  className="property-card group block"
                >
                  <div className="bg-white/5 backdrop-blur-sm rounded-2xl overflow-hidden hover:bg-white/10 transition-all duration-500 hover:scale-105 hover:-translate-y-2">
                    {/* Property Image */}
                    <div className="relative h-64 overflow-hidden">
                      <img 
                        src={property.images?.[0] || '/api/placeholder/400/300'}
                        alt={property.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute top-4 left-4">
                        <span className="bg-[#791E75] text-white px-3 py-1 rounded-full text-sm font-bold">
                          {property.propertyType?.toUpperCase().replace('_', ' ')}
                        </span>
                      </div>
                      <div className="absolute bottom-4 right-4">
                        <span className="bg-black/80 text-white px-3 py-1 rounded-full text-lg font-bold">
                          {formatPrice(property.price, property.listingType === 'rental')}
                        </span>
                      </div>
                    </div>
                    
                    {/* Property Details */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold mb-2 group-hover:text-[#F8B324] transition-colors duration-300">
                        {property.title}
                      </h3>
                      
                      <div className="flex items-center text-white/60 mb-4">
                        <MapPin className="h-4 w-4 mr-2" />
                        <span>{property.addressLine1}, {property.postcode}</span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-white/80 mb-4">
                        <div className="flex items-center">
                          <Building2 className="h-4 w-4 mr-1" />
                          <span>{property.propertyType?.replace('_', ' ')}</span>
                        </div>
                        {property.squareFootage && (
                          <div className="flex items-center">
                            <Maximize className="h-4 w-4 mr-1" />
                            <span>{property.squareFootage.toLocaleString()} sq ft</span>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-white/60 text-sm mb-4 line-clamp-2">
                        {property.description}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                          {property.features?.slice(0, 2).map((feature, index) => (
                            <span key={index} className="bg-white/10 text-white/80 px-2 py-1 rounded text-xs">
                              {feature.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                        
                        <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white font-bold px-4 py-2 rounded-lg transition-all duration-300">
                          View Details
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          
          {!allLoading && allProperties.length === 0 && (
            <div className="text-center py-16">
              <Building2 className="h-16 w-16 text-white/40 mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-4">No commercial properties found</h3>
              <p className="text-white/60 max-w-md mx-auto">
                Try adjusting your search criteria or check back later for new listings.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#791E75] to-[#791E75]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-6">
            Need Commercial Property Advice?
          </h2>
          <p className="text-xl text-white/80 mb-8 max-w-2xl mx-auto">
            Our commercial property experts are ready to help your business find the perfect space
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/contact">
              <Button className="bg-[#F8B324] hover:bg-white text-black font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300 hover:scale-105">
                Speak to an Expert
              </Button>
            </Link>
            <Link href="/valuation">
              <Button className="bg-transparent border-2 border-white hover:bg-white hover:text-black text-white font-bold py-4 px-8 rounded-xl text-lg transition-all duration-300">
                Get Property Valuation
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Floating Bubbles */}
      <AISearchBubble />
      <PropertyChatInterface />
    </div>
  );
}