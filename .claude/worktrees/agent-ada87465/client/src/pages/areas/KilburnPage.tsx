import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Home, MessageCircle, Search, Brain, ArrowRight } from 'lucide-react';
import { Link } from 'wouter';
import { PropertyChatInterface } from '@/components/PropertyChatInterface';
import AreaPageTemplate from '../AreaPageTemplate';

export default function KilburnPage() {
  const [showPropertySearch, setShowPropertySearch] = useState(false);

  const handleSearchResults = (results: any[], query: string) => {
    // Results will be displayed within the chat interface
    console.log(`Found ${results.length} properties for: ${query}`);
  };

  const openKilburnSearch = () => {
    setShowPropertySearch(true);
    // Auto-populate with Kilburn-specific search
    setTimeout(() => {
      const chatInput = document.querySelector('input[placeholder*="search"]') as HTMLInputElement;
      if (chatInput) {
        chatInput.value = "Show me properties for sale in Kilburn NW6";
        chatInput.focus();
      }
    }, 500);
  };

  return (
    <div className="relative">
      {/* Enhanced Navigation Bar */}
      <div className="fixed top-6 left-6 z-50 flex gap-4">
        <Link href="/">
          <Button className="bg-[#5d1759]/90 backdrop-blur hover:bg-[#791E75] text-white px-6 py-3 rounded-2xl font-semibold transition-all hover:scale-105 shadow-lg">
            <Home className="mr-2 h-5 w-5" />
            HOME
          </Button>
        </Link>

        <Button
          onClick={openKilburnSearch}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-2xl font-semibold transition-all hover:scale-105 shadow-lg"
        >
          <Brain className="mr-2 h-5 w-5" />
          AI Property Search
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* Floating Action Button for Property Search */}
      <div className="fixed bottom-8 left-8 z-50">
        <Button
          onClick={() => setShowPropertySearch(!showPropertySearch)}
          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white p-4 rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110"
          aria-label="Search Properties in Kilburn"
        >
          <Search className="h-6 w-6" />
        </Button>

        {/* Tooltip */}
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 px-4 py-2 bg-[#791E75] text-white text-sm rounded-lg opacity-0 hover:opacity-100 transition-opacity whitespace-nowrap">
          Search Properties in Kilburn
        </div>
      </div>

      {/* Enhanced Property Search Section */}
      {showPropertySearch && (
        <div className="fixed top-20 right-6 z-40 w-96 bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-green-600 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold flex items-center">
                  <Brain className="mr-2 h-6 w-6" />
                  Kilburn Property Search
                </h3>
                <p className="text-[#791E75]100 text-sm mt-1">
                  AI-powered search for NW6 properties
                </p>
              </div>
              <Button
                onClick={() => setShowPropertySearch(false)}
                className="bg-white/20 hover:bg-white/30 text-white p-2 rounded-lg"
              >
                ×
              </Button>
            </div>
          </div>

          <div className="p-4">
            <div className="mb-4">
              <h4 className="font-semibold text-gray-800 mb-2">Try asking:</h4>
              <div className="space-y-2">
                <div className="text-sm bg-gray-50 p-3 rounded-lg border-l-4 border-[#791E75]500">
                  💬 "Show me 2-bed flats for sale in Kilburn under £600k"
                </div>
                <div className="text-sm bg-gray-50 p-3 rounded-lg border-l-4 border-[#791E75]500">
                  🏠 "Find rental properties near Kilburn tube station"
                </div>
                <div className="text-sm bg-gray-50 p-3 rounded-lg border-l-4 border-purple-500">
                  ✨ "Victorian houses with gardens in NW6"
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI Property Chat Interface */}
      <PropertyChatInterface
        onSearchResults={handleSearchResults}
        className="kilburn-search"
      />

      {/* Original Area Page Content */}
      <AreaPageTemplate
        areaName="Kilburn"
        postcode="NW6"
        description="Your complete guide to property, lifestyle and investment in Kilburn, NW6 — updated September 2025."
        boroughContext="Brent/Camden/Westminster fringes (varies by street)"
        councilTax="Varies by borough; Brent Band D approx £2,133 (2025/26)"
        whyBuyersChoose="Check which borough for council tax/schooling; seek streets just off the High Road for quieter living."
        areaAtGlance="Bustling high streets with excellent transport meet quieter residential pockets of Victorian/Edwardian homes."
        areaAtGlanceDetails="Kilburn High Road's shops and eateries, Tricycle/Kiln Theatre, and quick hops to Queen's Park, West Hampstead and Maida Vale."
        propertyMarket="Good-value flats and terraces on the Brent side; Victorian conversion stock popular with first-time buyers; mansion blocks towards Maida Vale."
        transport="Jubilee (Kilburn), Overground (Brondesbury), Bakerloo (Kilburn Park) for West End/City access."
        schools={[
          "St Augustine's High",
          "Kingsgate Primary",
          "Multiple independent nurseries"
        ]}
        lifestyle={[
          "Kiln Theatre",
          "Queens Park (nearby)",
          "Gyms and supermarkets"
        ]}
        safetyInfo="Busy around transport hubs; quieter on residential avenues; neighbourhood watch groups active."
        safetyTip="crime figures are borough-wide and can be skewed by busy commercial zones; quiet residential streets often experience far fewer incidents."
      />
    </div>
  );
}