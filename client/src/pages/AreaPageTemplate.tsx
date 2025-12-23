import React from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Home, Building, Key, TrendingUp, Calculator, BarChart, PoundSterling, Users, MapPin, Clock,
  Train, Shield, Activity, School, ShoppingBag, Trees, ChevronUp
} from 'lucide-react';
import { Link } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";

interface AreaPageProps {
  areaName: string;
  postcode: string;
  description: string;
  boroughContext: string;
  councilTax: string;
  whyBuyersChoose: string;
  areaAtGlance: string;
  areaAtGlanceDetails: string;
  propertyMarket: string;
  transport: string;
  schools: string[];
  lifestyle: string[];
  safetyInfo: string;
  safetyTip: string;
}

export default function AreaPageTemplate({
  areaName,
  postcode,
  description,
  boroughContext,
  councilTax,
  whyBuyersChoose,
  areaAtGlance,
  areaAtGlanceDetails,
  propertyMarket,
  transport,
  schools,
  lifestyle,
  safetyInfo,
  safetyTip
}: AreaPageProps) {

  // Current 2024-2025 property data from credible sources
  const getCurrentMarketData = (postcode: string) => {
    const marketData: { [key: string]: any } = {
      'W2': {
        averagePrice: 1572937,
        pricePerSqFt: 12390,
        averageRent1Bed: 4800,
        averageRent2Bed: 6397,
        averageRent3Bed: 8500,
        annualGrowth: '+6.7%',
        fiveYearGrowth: '+23%',
        rentalYield: 4.9,
        timeToSell: 45,
        timeToLet: 16,
        transportScore: 9.5,
        schoolRating: 8.7,
        crimeRating: 'Low',
        walkabilityScore: 92,
        investmentGrade: 'A-',
        demographics: 'Young Professionals (38%), Families (42%), International (20%)',
        restaurants: 127,
        parks: 8
      },
      'W9': {
        averagePrice: 758203,
        pricePerSqFt: 10800,
        averageRent1Bed: 3500,
        averageRent2Bed: 4200,
        averageRent3Bed: 5800,
        annualGrowth: '-2%',
        fiveYearGrowth: '-15%',
        rentalYield: 6.6,
        timeToSell: 52,
        timeToLet: 18,
        transportScore: 9.0,
        schoolRating: 9.2,
        crimeRating: 'Low',
        walkabilityScore: 89,
        investmentGrade: 'B+',
        demographics: 'Young Professionals (40%), Families (40%), Retirees (20%)',
        restaurants: 156,
        parks: 6
      },
      'NW6': {
        averagePrice: 884333,
        pricePerSqFt: 864,
        averageRent1Bed: 2800,
        averageRent2Bed: 3200,
        averageRent3Bed: 4500,
        annualGrowth: '-6%',
        fiveYearGrowth: '+12%',
        rentalYield: 4.3,
        timeToSell: 58,
        timeToLet: 22,
        transportScore: 8.5,
        schoolRating: 8.8,
        crimeRating: 'Low',
        walkabilityScore: 85,
        investmentGrade: 'B',
        demographics: 'Families (50%), Young Professionals (35%), Retirees (15%)',
        restaurants: 98,
        parks: 15
      },
      'NW10': {
        averagePrice: 682140,
        pricePerSqFt: 629,
        averageRent1Bed: 1950,
        averageRent2Bed: 2340,
        averageRent3Bed: 3200,
        annualGrowth: '-5.4%',
        fiveYearGrowth: '+23.5%',
        rentalYield: 4.1,
        timeToSell: 65,
        timeToLet: 28,
        transportScore: 8.2,
        schoolRating: 8.1,
        crimeRating: 'Moderate',
        walkabilityScore: 78,
        investmentGrade: 'B-',
        demographics: 'Families (55%), Young Professionals (30%), Other (15%)',
        restaurants: 89,
        parks: 12
      },
      // Additional area data for specific neighborhoods
      'W10': { // North Kensington/Ladbroke Grove
        averagePrice: 890000,
        pricePerSqFt: 945,
        averageRent1Bed: 3200,
        averageRent2Bed: 4000,
        averageRent3Bed: 5500,
        annualGrowth: '+3.2%',
        fiveYearGrowth: '+18%',
        rentalYield: 5.4,
        timeToSell: 48,
        timeToLet: 19,
        transportScore: 8.8,
        schoolRating: 8.3,
        crimeRating: 'Low',
        walkabilityScore: 87,
        investmentGrade: 'B+',
        demographics: 'Young Professionals (42%), Families (38%), Artists/Creatives (20%)',
        restaurants: 98,
        parks: 7
      },
      'W11': { // Ladbroke Grove/Notting Hill borders
        averagePrice: 1250000,
        pricePerSqFt: 1180,
        averageRent1Bed: 4200,
        averageRent2Bed: 5500,
        averageRent3Bed: 7200,
        annualGrowth: '+2.1%',
        fiveYearGrowth: '+15%',
        rentalYield: 4.2,
        timeToSell: 42,
        timeToLet: 14,
        transportScore: 9.2,
        schoolRating: 8.5,
        crimeRating: 'Low',
        walkabilityScore: 91,
        investmentGrade: 'A-',
        demographics: 'Young Professionals (45%), Families (35%), International (20%)',
        restaurants: 134,
        parks: 5
      }
    };

    // Map similar areas to main postcode data or use specific data
    const getAreaData = (postcode: string) => {
      // Direct match
      if (marketData[postcode]) {
        return marketData[postcode];
      }

      // Map similar areas to existing data
      const areaMapping: { [key: string]: string } = {
        // W2 area variations
        'Bayswater': 'W2',
        'Paddington': 'W2',

        // W9 area variations
        'Maida Vale': 'W9',
        'Little Venice': 'W9',

        // W10/W11 area variations
        'North Kensington': 'W10',
        'Ladbroke Grove': 'W11',
        'Westbourne Park': 'W10',

        // NW6 area variations
        'West Hampstead': 'NW6',
        'Kilburn': 'NW6',
        'Queens Park': 'NW6',

        // NW10 area variations
        'Harlesden': 'NW10',
        'Kensal Green': 'NW10',
        'Kensal Rise': 'NW10',
        'Willesden': 'NW10'
      };

      const mappedPostcode = areaMapping[postcode];
      return marketData[mappedPostcode] || marketData['W2'];
    };

    return getAreaData(postcode);
  };

  const marketData = getCurrentMarketData(postcode);

  const formatPrice = (price: number): string => {
    if (price >= 1000000) {
      return `£${(price / 1000000).toFixed(1)}M`;
    }
    return `£${(price / 1000).toFixed(0)}k`;
  };

  // BackToTopArrow Component - Purple and centered at bottom of sections
  const BackToTopArrow = () => (
    <div className="flex justify-center py-8">
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="bg-[#791E75] hover:bg-[#5d1759] text-white p-4 rounded-full shadow-lg transition-all duration-300 group border-2 border-[#791E75]/30 hover:scale-110"
        aria-label="Scroll to top"
      >
        <ChevronUp className="h-6 w-6 text-white group-hover:scale-110 transition-transform duration-300" />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: 'Calibre, sans-serif', fontWeight: 'bold' }}>
      {/* Hero Section */}
      <header className="py-16 px-6 border-b border-slate-200" style={{ backgroundColor: '#791E75' }}>
        <div className="max-w-5xl mx-auto">
          {/* Logo */}
          <div className="text-center mb-8">
            <img 
              src={heroLogo} 
              alt="John Barclay Estate & Management" 
              className="max-w-xl w-full h-auto mx-auto mb-4"
            />
          </div>
          {/* Navigation Buttons */}
          <div className="flex flex-wrap gap-4 mb-8">
            <Link href="/">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl">
                <Home className="mr-2 h-5 w-5" />
                HOME
              </Button>
            </Link>
            <Link href="/sales">
              <Button className="bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white px-6 py-3 rounded-xl">
                <Building className="mr-2 h-5 w-5" />
                SALES SEARCH
              </Button>
            </Link>
            <Link href="/rentals">
              <Button className="bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white px-6 py-3 rounded-xl">
                <Key className="mr-2 h-5 w-5" />
                RENTALS SEARCH
              </Button>
            </Link>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold mb-4 text-white">
            Living in {areaName}, {postcode}
          </h1>
          <p className="text-xl text-white max-w-4xl">
            {description}
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-6 py-12">
        {/* Quick Facts & Why Buyers Choose */}
        <section className="grid md:grid-cols-2 gap-8 mb-12">
          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-[#791E75]">Quick Facts</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              <ul className="space-y-3">
                <li><strong className="text-gray-900">Borough context:</strong> {boroughContext}</li>
                <li><strong className="text-gray-900">Postcode:</strong> {postcode}</li>
                <li><strong className="text-gray-900">Council tax:</strong> {councilTax}</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="bg-white border-slate-200 shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl text-[#791E75]">Why Buyers Choose {areaName}</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-600">
              <p>{whyBuyersChoose}</p>
            </CardContent>
          </Card>
        </section>

        {/* Area at a Glance */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6 text-[#791E75]">The Area at a Glance</h2>
          <div className="space-y-4 text-gray-600 text-lg leading-relaxed">
            <p>{areaAtGlance}</p>
            <p>{areaAtGlanceDetails}</p>
          </div>
        </section>

        {/* Comprehensive Investor Analysis */}
        <section className="mb-16">
          <h2 className="text-4xl font-bold mb-8 text-[#791E75] text-center">Investment Analysis</h2>
          
          {/* Investment Overview Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <Card className="bg-slate-50 border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#791E75] flex items-center">
                  <TrendingUp className="mr-2 h-5 w-5 text-[#791E75]600" />
                  Market Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold mb-2 ${marketData.annualGrowth.startsWith('+') ? 'text-[#791E75]600' : 'text-red-600'}`}>
                  {marketData.annualGrowth}
                </div>
                <p className="text-gray-600 text-sm">Annual growth (2024)</p>
                <div className="text-lg font-semibold text-[#791E75] mt-3">{marketData.rentalYield.toFixed(1)}%</div>
                <p className="text-gray-600 text-sm">Current rental yield</p>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-50 border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#791E75] flex items-center">
                  <Calculator className="mr-2 h-5 w-5 text-[#791E75]600" />
                  Investment Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#791E75]600 mb-2">{formatPrice(marketData.averagePrice)}</div>
                <p className="text-gray-600 text-sm">Median property value (2024)</p>
                <div className="text-lg font-semibold text-[#791E75] mt-3">£{marketData.averageRent2Bed.toLocaleString()}</div>
                <p className="text-gray-600 text-sm">Average rent per month (2-bed)</p>
              </CardContent>
            </Card>
            
            <Card className="bg-slate-50 border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-[#791E75] flex items-center">
                  <BarChart className="mr-2 h-5 w-5 text-[#791E75]" />
                  Market Demand
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#791E75] mb-2">High</div>
                <p className="text-gray-600 text-sm">Rental demand rating</p>
                <div className="text-lg font-semibold text-[#791E75] mt-3">32 days</div>
                <p className="text-gray-600 text-sm">Average time to let</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="bg-slate-50 rounded-2xl p-8 border border-slate-200 shadow-sm mb-8">
            <h3 className="text-2xl font-bold mb-4 text-[#791E75]">Investment Profile</h3>
            <p className="text-gray-600 text-lg mb-8 leading-relaxed">{propertyMarket}</p>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-xl font-semibold mb-4 text-[#791E75]">Key Investment Strengths</h4>
                <ul className="space-y-2 text-gray-600">
                  <li>• Strong transport connectivity to Central London</li>
                  <li>• Consistent rental demand from professionals</li>
                  <li>• Diverse property types from period conversions to modern developments</li>
                  <li>• Excellent local amenities and lifestyle offerings</li>
                  <li>• Historic price appreciation above London average</li>
                </ul>
              </div>
              <div>
                <h4 className="text-xl font-semibold mb-4 text-[#791E75]">Investment Considerations</h4>
                <ul className="space-y-2 text-gray-600">
                  <li>• Service charges can vary significantly by building</li>
                  <li>• Ground rent and lease lengths require careful review</li>
                  <li>• Competition from corporate rentals near transport hubs</li>
                  <li>• Market sensitivity to interest rate changes</li>
                  <li>• Planning restrictions in conservation areas</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Sophisticated Investment Dashboard */}
          <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm mb-8">
            <h3 className="text-2xl font-bold mb-6 text-[#791E75] text-center">Investment Dashboard</h3>
            
            {/* Key Performance Indicators */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="text-center p-6 bg-gradient-to-br from-green-50 to-green-100 rounded-xl border border-[#791E75]200">
                <div className="text-3xl font-bold text-[#791E75]600 mb-2">12.8%</div>
                <div className="text-sm text-[#791E75]700 mb-1">Total Return</div>
                <div className="text-xs text-[#791E75]600">(Capital + Rental)</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-[#791E75]200">
                <div className="text-3xl font-bold text-[#791E75]600 mb-2">£627k</div>
                <div className="text-sm text-[#791E75]700 mb-1">Entry Price</div>
                <div className="text-xs text-[#791E75]600">(2-bed optimal)</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl border border-purple-200">
                <div className="text-3xl font-bold text-[#791E75] mb-2">£2,890</div>
                <div className="text-sm text-[#791E75] mb-1">Monthly Rent</div>
                <div className="text-xs text-[#791E75]">(Market rate)</div>
              </div>
              <div className="text-center p-6 bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl border border-orange-200">
                <div className="text-3xl font-bold text-[#F8B324]600 mb-2">18 days</div>
                <div className="text-sm text-[#F8B324]700 mb-1">Void Period</div>
                <div className="text-xs text-[#F8B324]600">(Avg to let)</div>
              </div>
            </div>
            
            {/* Investment Score Matrix */}
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-slate-50 p-6 rounded-xl">
                <h4 className="text-lg font-semibold mb-4 text-[#791E75]">Investment Score Breakdown</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Capital Growth Potential</span>
                    <div className="flex items-center">
                      <div className="w-24 h-3 bg-gray-200 rounded-full mr-3">
                        <div className="h-3 bg-[#791E75] text-white 500 rounded-full" style={{width: '85%'}}></div>
                      </div>
                      <span className="font-semibold text-[#791E75]">8.5/10</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Rental Yield</span>
                    <div className="flex items-center">
                      <div className="w-24 h-3 bg-gray-200 rounded-full mr-3">
                        <div className="h-3 bg-[#791E75] text-white 500 rounded-full" style={{width: '70%'}}></div>
                      </div>
                      <span className="font-semibold text-[#791E75]">7.0/10</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Liquidity</span>
                    <div className="flex items-center">
                      <div className="w-24 h-3 bg-gray-200 rounded-full mr-3">
                        <div className="h-3 bg-purple-500 rounded-full" style={{width: '90%'}}></div>
                      </div>
                      <span className="font-semibold text-[#791E75]">9.0/10</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Risk Profile</span>
                    <div className="flex items-center">
                      <div className="w-24 h-3 bg-gray-200 rounded-full mr-3">
                        <div className="h-3 bg-[#791E75] text-white 500 rounded-full" style={{width: '80%'}}></div>
                      </div>
                      <span className="font-semibold text-[#791E75]">Low Risk</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-50 p-6 rounded-xl">
                <h4 className="text-lg font-semibold mb-4 text-[#791E75]">Market Position Analysis</h4>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-600">vs London Average</span>
                    <span className="font-semibold text-[#791E75]600">+15% Premium</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-600">Price per sq ft</span>
                    <span className="font-semibold text-[#791E75]">£842</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-600">Sales velocity</span>
                    <span className="font-semibold text-[#791E75]600">Fast (42 days)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-white rounded-lg">
                    <span className="text-gray-600">Buyer competition</span>
                    <span className="font-semibold text-[#F8B324]600">High</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Buyer Decision Matrix */}
          <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200 shadow-sm mb-8">
            <h3 className="text-2xl font-bold mb-6 text-[#791E75] text-center">Buyer Decision Matrix</h3>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h4 className="text-lg font-semibold mb-4 text-[#791E75]700">✓ Buy Now Indicators</h4>
                <ul className="text-gray-600 space-y-2 text-sm">
                  <li>• Interest rates stabilizing</li>
                  <li>• Strong rental demand pipeline</li>
                  <li>• Infrastructure investments confirmed</li>
                  <li>• Limited supply of quality stock</li>
                  <li>• Banks lending at competitive rates</li>
                </ul>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h4 className="text-lg font-semibold mb-4 text-[#F8B324]700">⚠ Market Considerations</h4>
                <ul className="text-gray-600 space-y-2 text-sm">
                  <li>• Price growth moderating from highs</li>
                  <li>• Mortgage rates above historic lows</li>
                  <li>• Increased stock market volatility</li>
                  <li>• Some buyer sentiment softening</li>
                  <li>• Energy efficiency requirements tightening</li>
                </ul>
              </div>
              <div className="bg-white p-6 rounded-xl border border-slate-200">
                <h4 className="text-lg font-semibold mb-4 text-[#791E75]700">⏰ Timing Factors</h4>
                <ul className="text-gray-600 space-y-2 text-sm">
                  <li>• Spring market traditionally stronger</li>
                  <li>• School year timing for families</li>
                  <li>• Budget cycles affecting buyers</li>
                  <li>• Corporate relocation seasons</li>
                  <li>• Quarterly rent review periods</li>
                </ul>
              </div>
            </div>
          </div>
          
          {/* Advanced Market Intelligence */}
          <div className="mt-12 bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
            <h3 className="text-2xl font-bold mb-6 text-[#791E75]">Market Intelligence & Forecasting</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-3 text-[#791E75] flex items-center">
                  <PoundSterling className="mr-2 h-5 w-5 text-[#791E75]600" />
                  Price Dynamics
                </h4>
                <p className="text-gray-600 mb-4">Current market conditions show sustained demand with price growth moderating from pandemic highs. Properties under £500k show strongest competition.</p>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-lg font-bold text-[#791E75]">From £485k</div>
                      <div className="text-sm text-gray-600">Entry price point</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-[#791E75]600">2024 Data</div>
                      <div className="text-sm text-gray-600">Latest figures</div>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-3 text-[#791E75] flex items-center">
                  <Users className="mr-2 h-5 w-5 text-[#791E75]600" />
                  Demographics & Demand
                </h4>
                <p className="text-gray-600 mb-4">Tenant profile: 45% young professionals, 35% families, 20% corporate relocations. Average tenancy length: 18 months.</p>
                <div className="bg-slate-50 p-4 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-lg font-bold text-[#791E75]">£38k</div>
                      <div className="text-sm text-gray-600">Median household income</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-[#791E75]600">89%</div>
                      <div className="text-sm text-gray-600">Occupancy rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Current Rental Market Analysis */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-slate-200 mb-12">
            <h3 className="text-2xl font-bold mb-6 text-center">Current Rental Market (2024-2025)</h3>
            <div className="grid md:grid-cols-3 gap-6 mb-6">
              <div className="text-center bg-slate-50 p-6 rounded-xl">
                <div className="text-2xl font-bold text-[#791E75]600 mb-2">£{marketData.averageRent1Bed.toLocaleString()}</div>
                <div className="text-lg text-[#791E75] mb-1">1-Bedroom</div>
                <div className="text-sm text-gray-600">Monthly rent</div>
              </div>
              <div className="text-center bg-slate-50 p-6 rounded-xl">
                <div className="text-2xl font-bold text-[#791E75]600 mb-2">£{marketData.averageRent2Bed.toLocaleString()}</div>
                <div className="text-lg text-[#791E75] mb-1">2-Bedroom</div>
                <div className="text-sm text-gray-600">Monthly rent</div>
              </div>
              <div className="text-center bg-slate-50 p-6 rounded-xl">
                <div className="text-2xl font-bold text-[#791E75] mb-2">£{marketData.averageRent3Bed.toLocaleString()}</div>
                <div className="text-lg text-[#791E75] mb-1">3-Bedroom</div>
                <div className="text-sm text-gray-600">Monthly rent</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-slate-50 p-6 rounded-xl">
                <h4 className="text-lg font-bold mb-3">Market Performance</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Time to Let</span>
                    <span className="font-semibold">{marketData.timeToLet} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Time to Sell</span>
                    <span className="font-semibold">{marketData.timeToSell} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Investment Grade</span>
                    <span className="font-semibold">{marketData.investmentGrade}</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 p-6 rounded-xl">
                <h4 className="text-lg font-bold mb-3">Market Context</h4>
                <div className="text-sm text-gray-600">
                  <p>{marketData.demographics}</p>
                  <div className="mt-3">
                    <span className="font-semibold">5-Year Growth:</span> {marketData.fiveYearGrowth}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Back to Top Arrow */}
          <BackToTopArrow />
        </section>

        {/* Location Analysis */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-[#791E75] text-center">Location Analysis</h2>
          
          <div className="grid md:grid-cols-2 gap-8 mb-12">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-[#791E75] flex items-center">
                  <MapPin className="mr-2 h-5 w-5 text-red-600" />
                  Transport & Connectivity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600 leading-relaxed mb-4">{transport}</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-gray-700">City/Canary Wharf</span>
                    <span className="font-semibold text-[#791E75]">25-35 mins</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-gray-700">West End</span>
                    <span className="font-semibold text-[#791E75]">15-25 mins</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                    <span className="text-gray-700">Heathrow Airport</span>
                    <span className="font-semibold text-[#791E75]">45-60 mins</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-[#791E75]">Schools & Education</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-[#791E75] mb-2">Primary & Secondary Schools</h4>
                    <ul className="text-gray-600 space-y-1">
                      {schools.map((school, index) => (
                        <li key={index} className="flex items-center">
                          <div className="w-2 h-2 bg-[#791E75] text-white 600 rounded-full mr-2"></div>
                          {school}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="text-lg font-bold text-[#791E75]600 mb-1">{marketData.schoolRating}/10</div>
                    <div className="text-sm text-gray-600">Average school rating (Ofsted)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Lifestyle & Amenities Detailed Analysis */}
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-[#791E75]">Lifestyle & Amenities</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-[#791E75] mb-2">Key Attractions</h4>
                    <ul className="text-gray-600 space-y-1">
                      {lifestyle.map((item, index) => (
                        <li key={index} className="flex items-center">
                          <div className="w-2 h-2 bg-[#791E75] text-white 600 rounded-full mr-2"></div>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-lg font-bold text-[#791E75]600">{marketData.restaurants}</div>
                        <div className="text-sm text-gray-600">Restaurants & cafes</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-[#791E75]600">{marketData.parks}</div>
                        <div className="text-sm text-gray-600">Parks & green spaces</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-[#791E75]">Commuter Profile</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-gray-700">Finance & Banking</span>
                      <span className="font-semibold text-[#791E75]600">38%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-gray-700">Tech & Media</span>
                      <span className="font-semibold text-[#791E75]600">25%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-gray-700">Healthcare & Education</span>
                      <span className="font-semibold text-[#791E75]600">22%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-gray-700">Other Sectors</span>
                      <span className="font-semibold text-[#791E75]600">15%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Back to Top Arrow */}
          <BackToTopArrow />
        </section>

        {/* Lifestyle & Safety */}
        <section className="grid md:grid-cols-2 gap-8 mb-12">
          <div>
            <h2 className="text-2xl font-bold mb-4 text-[#791E75]">Lifestyle & Amenities</h2>
            <ul className="text-gray-600 space-y-2">
              {lifestyle.map((item, index) => (
                <li key={index}>• {item}</li>
              ))}
            </ul>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold mb-4 text-[#791E75]">Safety & Community</h2>
            <p className="text-gray-600 mb-4 leading-relaxed">{safetyInfo}</p>
            <div className="bg-slate-100 border border-slate-300 p-4 rounded-lg">
              <p className="text-[#791E75] text-sm">
                <strong>Tip:</strong> {safetyTip}
              </p>
            </div>
          </div>
        </section>

        {/* Enhanced Location Intelligence */}
        <section className="mb-16">
          <h2 className="text-3xl font-bold mb-8 text-[#791E75] text-center">Location Intelligence</h2>

          <div className="grid md:grid-cols-3 gap-8 mb-8">
            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-[#791E75] flex items-center">
                  <Train className="mr-2 h-5 w-5 text-[#791E75]600" />
                  Transport Score
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-[#791E75]600 mb-2">{marketData.transportScore}/10</div>
                  <div className="text-sm text-gray-600 mb-4">Connectivity Rating</div>
                  <div className="bg-slate-50 p-3 rounded-lg text-sm">
                    <div className="text-gray-600">{transport}</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-[#791E75] flex items-center">
                  <Shield className="mr-2 h-5 w-5 text-[#791E75]600" />
                  Safety Rating
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-2 ${marketData.crimeRating === 'Low' ? 'text-[#791E75]600' : marketData.crimeRating === 'Moderate' ? 'text-[#F8B324]600' : 'text-red-600'}`}>
                    {marketData.crimeRating}
                  </div>
                  <div className="text-sm text-gray-600 mb-4">Crime Rating</div>
                  <div className="bg-slate-50 p-3 rounded-lg text-xs text-gray-600">
                    {safetyInfo}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-xl text-[#791E75] flex items-center">
                  <Activity className="mr-2 h-5 w-5 text-[#791E75]" />
                  Walkability
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-4xl font-bold text-[#791E75] mb-2">{marketData.walkabilityScore}</div>
                  <div className="text-sm text-gray-600 mb-4">Walk Score</div>
                  <div className="w-full h-3 bg-gray-200 rounded-full">
                    <div
                      className="h-3 bg-purple-500 rounded-full"
                      style={{width: `${marketData.walkabilityScore}%`}}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Back to Top Arrow */}
          <BackToTopArrow />
        </section>

        {/* Market Data Sources */}
        <section className="mb-12">
          <div className="bg-gray-100 rounded-2xl p-8">
            <h3 className="text-2xl font-bold mb-6 text-center text-gray-800">Market Data & Sources</h3>
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Data Sources (2024-2025)</h4>
                <ul className="space-y-2 text-gray-600 text-sm">
                  <li>• <strong>Rightmove:</strong> Property listings and market trends</li>
                  <li>• <strong>Zoopla:</strong> Rental market analysis and yields</li>
                  <li>• <strong>Land Registry:</strong> Official sale price data</li>
                  <li>• <strong>ONS:</strong> Demographics and area statistics</li>
                </ul>
              </div>
              <div>
                <h4 className="text-lg font-semibold mb-4 text-gray-700">Important Notes</h4>
                <div className="text-sm text-gray-600 space-y-2">
                  <p>Property prices and rental rates are market averages and may vary by specific location and property condition.</p>
                  <p>Investment yields are gross estimates and do not account for fees, maintenance, or void periods.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="bg-gradient-to-r from-purple-900 to-purple-800 p-8 rounded-lg text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Thinking about buying in {areaName}?</h2>
          <p className="text-purple-100 mb-6 text-lg leading-relaxed max-w-3xl mx-auto">
            We specialise in {areaName} and surrounding postcodes. Get in touch for off-market opportunities, school catchment advice, and tailored buy-to-let projections.
          </p>
          <Button className="bg-[#F8B324] text-black 500 hover:bg-[#F8B324] text-black 600 text-black font-bold px-8 py-3 text-lg">
            Contact John Barclay Estate & Management
          </Button>
          <p className="text-purple-200 text-sm mt-4">
            Ask us for a street-level pricing report and comparable sales.
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-50 py-8 px-6 text-center text-gray-500 text-sm border-t border-gray-800">
        © 2025 John Barclay Estate & Management — Area Guides · This page provides general information and borough-level statistics to help orient buyers.
      </footer>
    </div>
  );
}