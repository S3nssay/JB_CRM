import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  Home,
  MapPin,
  Bed,
  Bath,
  Maximize,
  Search,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Star,
  Calendar,
  Key,
  Building2,
  SlidersHorizontal
} from 'lucide-react';
import { Link } from 'wouter';
import { PropertySearchResults } from '@/components/PropertySearchResults';
import AISearchBubble from '@/components/AISearchBubble';
import { PropertyChatInterface } from '@/components/PropertyChatInterface';
import { PropertyListing, propertyListingsService } from '@/services/propertyListingsService';
import heroLogo from "@/assets/john-barclay-logo.png";

gsap.registerPlugin(ScrollTrigger);

interface Property {
  id: number;
  listingType: string;
  title: string;
  description: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  squareFootage?: number;
  addressLine1: string;
  postcode: string;
  images: string[];
  features: string[];
  areaName?: string;
  status: string;
  furnished?: string;
  availableFrom?: string;
  minimumTenancy?: number;
}

export default function RentalsPage() {
  const [searchForm, setSearchForm] = useState({
    location: '',
    propertyType: '',
    minBeds: '',
    maxBeds: '',
    maxPrice: '',
    furnished: '',
    houseType: '',
    garden: false,
    driveway: false,
    garage: false,
    balcony: false,
    floorLevel: ''
  });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const heroRef = useRef(null);
  const featuredRef = useRef(null);
  const searchRef = useRef(null);

  // Fetch featured properties
  const { data: featuredProperties = [], isLoading: featuredLoading } = useQuery<PropertyListing[]>({
    queryKey: ['/api/properties', 'featured', 'rental'],
    queryFn: async () => {
      const response = await fetch('/api/properties?listingType=rental&featured=true&limit=6');
      const data = await response.json();
      return data.map((prop: any) => propertyListingsService['convertToPropertyListing'](prop));
    }
  });

  // Fetch all rental properties
  const { data: allProperties = [], isLoading: allLoading } = useQuery<PropertyListing[]>({
    queryKey: ['/api/properties', 'rental', searchForm],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('listingType', 'rental');
      if (searchForm.location) params.set('location', searchForm.location);
      if (searchForm.propertyType) params.set('propertyType', searchForm.propertyType);
      if (searchForm.minBeds) params.set('minBedrooms', searchForm.minBeds);
      if (searchForm.maxBeds) params.set('maxBedrooms', searchForm.maxBeds);
      if (searchForm.maxPrice) params.set('maxPrice', searchForm.maxPrice);
      if (searchForm.furnished) params.set('furnished', searchForm.furnished);

      // Advanced filters
      if (searchForm.houseType) params.set('houseType', searchForm.houseType);
      if (searchForm.floorLevel) params.set('floorLevel', searchForm.floorLevel);

      // Build comma-separated features list
      const featuresList: string[] = [];
      if (searchForm.garden) featuresList.push('garden');
      if (searchForm.driveway) featuresList.push('driveway');
      if (searchForm.garage) featuresList.push('garage');
      if (searchForm.balcony) featuresList.push('balcony');
      if (featuresList.length > 0) params.set('features', featuresList.join(','));

      const response = await fetch(`/api/properties?${params.toString()}`);
      const data = await response.json();
      return data.map((prop: any) => propertyListingsService['convertToPropertyListing'](prop));
    }
  });

  // GSAP Animations
  useEffect(() => {
    // Cleanup GSAP triggers on unmount
    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  const formatPrice = (price: number) => {
    return `£${price.toLocaleString()} pcm`;
  };

  const resultsRef = useRef<HTMLDivElement>(null);

  const handleSearch = () => {
    // Scroll to results section
    if (resultsRef.current) {
      resultsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNaturalLanguageSearch = async (query: string) => {
    try {
      // Send natural language query to backend for parsing
      const response = await fetch('/api/search/natural-language', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, listingType: 'rental' })
      });

      if (response.ok) {
        const searchCriteria = await response.json();
        // Update the search form with parsed criteria
        setSearchForm(prev => ({
          ...prev,
          location: searchCriteria.location || '',
          propertyType: searchCriteria.propertyType || '',
          minBeds: searchCriteria.bedrooms || '',
          maxPrice: searchCriteria.maxPrice || '',
          furnished: ''
        }));
      }
    } catch (error) {
      console.error('Natural language search failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Hero Section */}
      <section ref={heroRef} className="relative min-h-[85vh] flex items-center justify-center overflow-hidden pb-16" style={{ backgroundColor: '#791E75' }}>
        <div className="relative z-10 text-center max-w-6xl mx-auto px-6">
          <div className="mb-6">
            <img
              src={heroLogo}
              alt="John Barclay Estate & Management"
              className="max-w-xl w-full h-auto mx-auto mb-4"
            />
            <h1 className="text-4xl md:text-5xl font-black leading-none mb-6 text-white">
              RENTALS
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto mb-8">
            Find your next home to rent in West London
          </p>

          {/* Navigation Buttons */}
          <div className="flex justify-center gap-4 mb-8">
            <Link href="/">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl">
                <Home className="mr-2 h-5 w-5" />
                HOME
              </Button>
            </Link>
            <Link href="/sales">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl">
                <Key className="mr-2 h-5 w-5" />
                SALES
              </Button>
            </Link>
            <Link href="/commercial">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl">
                <Building2 className="mr-2 h-5 w-5" />
                COMMERCIAL
              </Button>
            </Link>
          </div>

          {/* Advanced Search Bar */}
          <div ref={searchRef} className="bg-white/90 backdrop-blur-md rounded-2xl p-6 max-w-5xl mx-auto border border-slate-200 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              <div className="md:col-span-1">
                <input
                  type="text"
                  placeholder="Enter Postcode or Town Name"
                  value={searchForm.location}
                  onChange={(e) => setSearchForm({ ...searchForm, location: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                />
              </div>

              <div className="relative">
                <select
                  value={searchForm.propertyType}
                  onChange={(e) => setSearchForm({ ...searchForm, propertyType: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">Property Type</option>
                  <option value="flat">Flat</option>
                  <option value="house">House</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={searchForm.minBeds}
                  onChange={(e) => setSearchForm({ ...searchForm, minBeds: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500"
                  data-testid="select-min-beds"
                >
                  <option value="">Min Beds</option>
                  <option value="0">Studio</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                  <option value="5">5+</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={searchForm.maxBeds}
                  onChange={(e) => setSearchForm({ ...searchForm, maxBeds: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500"
                  data-testid="select-max-beds"
                >
                  <option value="">Max Beds</option>
                  <option value="0">Studio</option>
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6+</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={searchForm.maxPrice}
                  onChange={(e) => setSearchForm({ ...searchForm, maxPrice: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">Max Price</option>
                  <option value="1500">£1,500 pcm</option>
                  <option value="2500">£2,500 pcm</option>
                  <option value="4000">£4,000 pcm</option>
                  <option value="6000">£6,000 pcm</option>
                  <option value="10000">£10,000 pcm</option>
                  <option value="20000">£20,000+ pcm</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={searchForm.furnished}
                  onChange={(e) => setSearchForm({ ...searchForm, furnished: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 appearance-none focus:outline-none focus:ring-2 focus:ring-slate-500"
                >
                  <option value="">Furnished</option>
                  <option value="furnished">Furnished</option>
                  <option value="unfurnished">Unfurnished</option>
                  <option value="part_furnished">Part Furnished</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>

              <Button
                onClick={handleSearch}
                className="bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center"
              >
                <Search className="h-5 w-5 mr-2" />
                Search
              </Button>
            </div>

            {/* More Filters Toggle - only show when property type is selected */}
            {searchForm.propertyType && (
              <button
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="flex items-center gap-2 mt-3 text-[#791E75] hover:text-[#5d1759] text-sm font-medium transition-colors"
                data-testid="button-more-filters"
              >
                <SlidersHorizontal className="h-4 w-4" />
                {searchForm.propertyType === 'house' ? 'House Features' : 'Flat Features'}
                {showAdvancedFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}

            {/* Advanced Filters Panel - contextual based on property type */}
            {showAdvancedFilters && searchForm.propertyType && (
              <div className="flex flex-wrap items-center gap-3 mt-3">
                {/* House Features - only when house is selected */}
                {searchForm.propertyType === 'house' && (
                  <>
                    <div className="relative">
                      <select
                        value={searchForm.houseType}
                        onChange={(e) => setSearchForm({ ...searchForm, houseType: e.target.value })}
                        className="bg-white/90 border-0 rounded-full px-4 py-2 pr-8 text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#791E75]/50"
                        data-testid="select-house-type"
                      >
                        <option value="">House Type</option>
                        <option value="detached">Detached</option>
                        <option value="semi-detached">Semi-Detached</option>
                        <option value="terraced">Terraced</option>
                        <option value="end-terrace">End Terrace</option>
                        <option value="town-house">Town House</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
                    </div>

                    <label className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm cursor-pointer transition-all ${searchForm.garden ? 'bg-[#791E75] text-white' : 'bg-white/90 text-gray-700 hover:bg-white'}`}>
                      <input type="checkbox" checked={searchForm.garden} onChange={(e) => setSearchForm({ ...searchForm, garden: e.target.checked })} className="sr-only" data-testid="checkbox-garden" />
                      Garden
                    </label>

                    <label className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm cursor-pointer transition-all ${searchForm.driveway ? 'bg-[#791E75] text-white' : 'bg-white/90 text-gray-700 hover:bg-white'}`}>
                      <input type="checkbox" checked={searchForm.driveway} onChange={(e) => setSearchForm({ ...searchForm, driveway: e.target.checked })} className="sr-only" data-testid="checkbox-driveway" />
                      Driveway
                    </label>

                    <label className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm cursor-pointer transition-all ${searchForm.garage ? 'bg-[#791E75] text-white' : 'bg-white/90 text-gray-700 hover:bg-white'}`}>
                      <input type="checkbox" checked={searchForm.garage} onChange={(e) => setSearchForm({ ...searchForm, garage: e.target.checked })} className="sr-only" data-testid="checkbox-garage" />
                      Garage
                    </label>
                  </>
                )}

                {/* Flat Features - only when flat type is selected */}
                {(searchForm.propertyType === 'flat' || searchForm.propertyType === 'penthouse' || searchForm.propertyType === 'maisonette' || searchForm.propertyType === 'studio') && (
                  <>
                    <label className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm cursor-pointer transition-all ${searchForm.balcony ? 'bg-[#791E75] text-white' : 'bg-white/90 text-gray-700 hover:bg-white'}`}>
                      <input type="checkbox" checked={searchForm.balcony} onChange={(e) => setSearchForm({ ...searchForm, balcony: e.target.checked })} className="sr-only" data-testid="checkbox-balcony" />
                      Balcony
                    </label>

                    <div className="relative">
                      <select
                        value={searchForm.floorLevel}
                        onChange={(e) => setSearchForm({ ...searchForm, floorLevel: e.target.value })}
                        className="bg-white/90 border-0 rounded-full px-4 py-2 pr-8 text-sm text-gray-700 appearance-none focus:outline-none focus:ring-2 focus:ring-[#791E75]/50"
                        data-testid="select-floor-level"
                      >
                        <option value="">Floor Level</option>
                        <option value="ground">Ground</option>
                        <option value="first">First</option>
                        <option value="second">Second</option>
                        <option value="upper">Upper (3+)</option>
                        <option value="top">Top Floor</option>
                      </select>
                      <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-3 w-3 text-gray-500 pointer-events-none" />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Search Results Section - appears immediately after search */}
      <section ref={resultsRef} className="py-12 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          {allLoading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-slate-100 rounded-2xl h-96 animate-pulse"></div>
              ))}
            </div>
          ) : allProperties.length === 0 ? (
            <div className="text-center py-12">
              <Home className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-600 mb-2">No properties found</h3>
              <p className="text-gray-500">Try adjusting your search criteria</p>
            </div>
          ) : (
            <PropertySearchResults
              results={allProperties}
              showHeader={false}
              className="properties-grid property-card"
            />
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#791E75] to-[#5d1759]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-white">
            Ready to Let Your Property?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Register your property with us for expert lettings management and guaranteed rent
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/register-rental">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white font-bold py-4 px-10 rounded-xl text-lg transition-all duration-300 hover:scale-105">
                Register Your Property
              </Button>
            </Link>
            <span className="text-white/60 hidden sm:block">or</span>
            <Link href="/valuation">
              <Button className="bg-transparent border-2 border-white hover:bg-white hover:text-[#5d1759] text-white font-medium py-3 px-6 rounded-xl transition-all duration-300">
                Get Valuation
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