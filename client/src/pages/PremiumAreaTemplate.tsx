import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  MapPin, TrendingUp, TrendingDown, School, Shield, Train, ShoppingBag, Trees, Building,
  Clock, Star, Users, Home, Heart, Camera, ChevronRight, Award, Activity,
  PoundSterling, Calculator, BarChart, Key, Phone, Mail, Globe
} from 'lucide-react';
import { Link } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";

gsap.registerPlugin(ScrollTrigger);

interface PremiumAreaData {
  postcode: string;
  areaName: string;
  description: string;

  // Current Market Data (2024-2025)
  averagePrice: number;
  pricePerSqFt: number;
  annualGrowth: string;
  fiveYearGrowth: string;
  averageRent1Bed: number;
  averageRent2Bed: number;
  averageRent3Bed: number;
  rentalYield: number;
  timeToSell: number;
  timeToLet: number;

  // Location Intelligence
  transportScore: number;
  schoolRating: number;
  crimeRating: string;
  walkabilityScore: number;

  // Demographics
  demographics: {
    youngProfessionals: number;
    families: number;
    retirees: number;
    international: number;
  };

  // Investment Analysis
  investmentGrade: string;
  capitalGrowthPotential: number;
  liquidityScore: number;
  riskProfile: string;

  // Lifestyle & Amenities
  restaurants: number;
  parks: number;
  gyms: number;
  supermarkets: number;

  // Transport Times
  transportTimes: {
    cityCanaryWharf: string;
    westEnd: string;
    heathrow: string;
    nearestTube: string;
    walkToTube: number;
  };

  // Schools
  primarySchools: string[];
  secondarySchools: string[];

  // Key Features
  keyAdvantages: string[];
  considerations: string[];

  // Market Context
  marketContext: string;
  investmentOutlook: string;
  rentalDemand: string;

  // Historical Context
  historicalBackground: string;
  architecturalStyle: string;

  // Future Developments
  plannedDevelopments: string[];
  infrastructureProjects: string[];
}

interface PremiumAreaTemplateProps {
  areaData: PremiumAreaData;
}

export default function PremiumAreaTemplate({ areaData }: PremiumAreaTemplateProps) {
  const heroRef = useRef(null);
  const statsRef = useRef(null);
  const investmentRef = useRef(null);
  const [activeTab, setActiveTab] = useState('overview');

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

    // Stats animation
    gsap.fromTo('.stat-card', {
      opacity: 0,
      y: 80,
      scale: 0.9
    }, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 1.2,
      stagger: 0.1,
      ease: "power4.out",
      scrollTrigger: {
        trigger: statsRef.current,
        start: "top 80%"
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  const formatPrice = (price: number): string => {
    if (price >= 1000000) {
      return `£${(price / 1000000).toFixed(1)}M`;
    }
    return `£${(price / 1000).toFixed(0)}k`;
  };

  const formatRent = (rent: number): string => {
    return `£${rent.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-white text-gray-900">

      {/* Premium Hero Section */}
      <section ref={heroRef} className="relative h-screen flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#791E75' }}>
        {/* Dynamic Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-br from-purple-400/20 to-purple-600/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-20 right-32 w-80 h-80 bg-gradient-to-br from-purple-500/15 to-purple-700/5 rounded-3xl rotate-45 blur-xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-purple-600/5 to-transparent rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 text-center max-w-7xl mx-auto px-6">
          {/* Premium Navigation */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link href="/">
              <Button className="bg-[#5d1759]/80 backdrop-blur hover:bg-[#791E75] text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all hover:scale-105">
                <Home className="mr-3 h-6 w-6" />
                HOME
              </Button>
            </Link>
            <Link href="/sales">
              <Button className="bg-[#791E75] text-white 600/80 backdrop-blur hover:bg-[#791E75] text-white 700 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all hover:scale-105">
                <Building className="mr-3 h-6 w-6" />
                SALES
              </Button>
            </Link>
            <Link href="/rentals">
              <Button className="bg-[#791E75] text-white 600/80 backdrop-blur hover:bg-[#791E75] text-white 700 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all hover:scale-105">
                <Key className="mr-3 h-6 w-6" />
                RENTALS
              </Button>
            </Link>
            <Link href="/valuation">
              <Button className="bg-[#F8B324] text-black 500/80 backdrop-blur hover:bg-[#F8B324] text-black 600 text-white px-8 py-4 rounded-2xl text-lg font-semibold transition-all hover:scale-105">
                <Calculator className="mr-3 h-6 w-6" />
                VALUATION
              </Button>
            </Link>
          </div>

          {/* Logo */}
          <div className="mb-8">
            <img
              src={heroLogo}
              alt="John Barclay Estate & Management"
              className="max-w-2xl w-full h-auto mx-auto mb-6"
            />
          </div>

          {/* Area Header */}
          <div className="flex items-center justify-center mb-8">
            <MapPin className="h-16 w-16 text-white mr-6" />
            <div className="text-6xl font-black text-white">{areaData.postcode}</div>
          </div>

          <h1 className="text-6xl md:text-8xl font-black leading-none mb-8 text-white">
            {areaData.areaName.toUpperCase()}
          </h1>

          <p className="text-2xl md:text-3xl text-white/90 max-w-4xl mx-auto mb-12 leading-relaxed">
            {areaData.description}
          </p>

          {/* Premium Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-6xl mx-auto">
            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="text-4xl font-black text-white mb-2">
                {formatPrice(areaData.averagePrice)}
              </div>
              <div className="text-white/80 text-lg">Median Price</div>
              <div className="text-white/60 text-sm mt-1">2024 Data</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className={`text-4xl font-black mb-2 ${areaData.annualGrowth.startsWith('+') ? 'text-[#791E75]400' : 'text-[#F8B324]400'}`}>
                {areaData.annualGrowth}
              </div>
              <div className="text-white/80 text-lg">Annual Growth</div>
              <div className="text-white/60 text-sm mt-1">Year on Year</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="text-4xl font-black text-[#791E75]400 mb-2">
                {areaData.rentalYield.toFixed(1)}%
              </div>
              <div className="text-white/80 text-lg">Rental Yield</div>
              <div className="text-white/60 text-sm mt-1">Gross Average</div>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover:bg-white/15 transition-all duration-300">
              <div className="text-4xl font-black text-purple-400 mb-2">
                {areaData.transportScore}/10
              </div>
              <div className="text-white/80 text-lg">Transport</div>
              <div className="text-white/60 text-sm mt-1">Connectivity</div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Investment Intelligence Hub */}
      <section ref={investmentRef} className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-8xl mx-auto">
          <div className="text-center mb-20">
            <h2 className="text-6xl font-black mb-6 bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              INVESTMENT INTELLIGENCE
            </h2>
            <p className="text-2xl text-gray-600 max-w-4xl mx-auto">
              Comprehensive market analysis and investment insights for {areaData.areaName}
            </p>
          </div>

          {/* Premium Investment Dashboard */}
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {/* Market Performance */}
            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-[#791E75]200 shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-[#791E75]800 flex items-center">
                  <TrendingUp className="mr-3 h-8 w-8" />
                  Market Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-black text-[#791E75]700">{areaData.annualGrowth}</div>
                    <div className="text-sm text-[#791E75]600">Annual Growth</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-black text-[#791E75]700">{areaData.fiveYearGrowth}</div>
                    <div className="text-sm text-[#791E75]600">5-Year Growth</div>
                  </div>
                </div>
                <div className="bg-white/60 p-4 rounded-xl">
                  <div className="text-lg font-semibold text-[#791E75]800 mb-2">Investment Grade</div>
                  <div className="text-2xl font-black text-[#791E75]700">{areaData.investmentGrade}</div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Metrics */}
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-[#791E75]200 shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-[#791E75]800 flex items-center">
                  <Calculator className="mr-3 h-8 w-8" />
                  Financial Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="bg-white/60 p-4 rounded-xl">
                    <div className="text-lg font-semibold text-[#791E75]800">Median Property Price</div>
                    <div className="text-3xl font-black text-[#791E75]700">{formatPrice(areaData.averagePrice)}</div>
                    <div className="text-sm text-[#791E75]600">£{areaData.pricePerSqFt}/sq ft</div>
                  </div>
                  <div className="bg-white/60 p-4 rounded-xl">
                    <div className="text-lg font-semibold text-[#791E75]800">Rental Yield</div>
                    <div className="text-3xl font-black text-[#791E75]700">{areaData.rentalYield.toFixed(1)}%</div>
                    <div className="text-sm text-[#791E75]600">Gross average</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Market Dynamics */}
            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 shadow-xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl text-[#791E75] flex items-center">
                  <BarChart className="mr-3 h-8 w-8" />
                  Market Dynamics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center bg-white/60 p-4 rounded-xl">
                    <div className="text-2xl font-black text-[#791E75]">{areaData.timeToSell} days</div>
                    <div className="text-sm text-[#791E75]">Time to Sell</div>
                  </div>
                  <div className="text-center bg-white/60 p-4 rounded-xl">
                    <div className="text-2xl font-black text-[#791E75]">{areaData.timeToLet} days</div>
                    <div className="text-sm text-[#791E75]">Time to Let</div>
                  </div>
                </div>
                <div className="bg-white/60 p-4 rounded-xl">
                  <div className="text-lg font-semibold text-[#791E75] mb-2">Liquidity Score</div>
                  <div className="text-2xl font-black text-[#791E75]">{areaData.liquidityScore}/10</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Rental Market Analysis */}
          <div className="bg-white rounded-3xl p-12 shadow-2xl border border-gray-200 mb-16">
            <h3 className="text-4xl font-bold mb-8 text-center">Rental Market Analysis</h3>

            <div className="grid md:grid-cols-3 gap-8 mb-8">
              <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl">
                <div className="text-3xl font-black text-gray-800 mb-2">{formatRent(areaData.averageRent1Bed)}</div>
                <div className="text-lg text-gray-600">1-Bedroom</div>
                <div className="text-sm text-gray-500 mt-1">per month</div>
              </div>
              <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl">
                <div className="text-3xl font-black text-gray-800 mb-2">{formatRent(areaData.averageRent2Bed)}</div>
                <div className="text-lg text-gray-600">2-Bedroom</div>
                <div className="text-sm text-gray-500 mt-1">per month</div>
              </div>
              <div className="text-center bg-gradient-to-br from-gray-50 to-gray-100 p-8 rounded-2xl">
                <div className="text-3xl font-black text-gray-800 mb-2">{formatRent(areaData.averageRent3Bed)}</div>
                <div className="text-lg text-gray-600">3-Bedroom</div>
                <div className="text-sm text-gray-500 mt-1">per month</div>
              </div>
            </div>

            <div className="bg-slate-50 p-8 rounded-2xl">
              <h4 className="text-2xl font-bold mb-4">Market Context</h4>
              <p className="text-gray-600 text-lg leading-relaxed">{areaData.rentalDemand}</p>
            </div>
          </div>

          {/* Investment Analysis */}
          <div className="bg-gradient-to-r from-[#791E75] to-[#5d1759] rounded-3xl p-12 text-white shadow-2xl">
            <h3 className="text-4xl font-bold mb-8 text-center">Professional Investment Analysis</h3>

            <div className="grid lg:grid-cols-2 gap-12">
              <div>
                <h4 className="text-2xl font-bold mb-6 text-slate-200">Investment Outlook</h4>
                <p className="text-slate-300 text-lg leading-relaxed mb-6">{areaData.investmentOutlook}</p>

                <div className="space-y-4">
                  <div className="bg-[#5d1759]/50 p-6 rounded-xl">
                    <h5 className="font-bold text-[#791E75]400 mb-3">Key Strengths</h5>
                    <ul className="space-y-2">
                      {areaData.keyAdvantages.map((advantage, index) => (
                        <li key={index} className="flex items-center text-slate-300">
                          <Star className="h-4 w-4 text-[#791E75]400 mr-2 flex-shrink-0" />
                          {advantage}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-2xl font-bold mb-6 text-slate-200">Market Context</h4>
                <p className="text-slate-300 text-lg leading-relaxed mb-6">{areaData.marketContext}</p>

                <div className="space-y-4">
                  <div className="bg-[#5d1759]/50 p-6 rounded-xl">
                    <h5 className="font-bold text-[#F8B324]400 mb-3">Considerations</h5>
                    <ul className="space-y-2">
                      {areaData.considerations.map((consideration, index) => (
                        <li key={index} className="flex items-center text-slate-300">
                          <ChevronRight className="h-4 w-4 text-[#F8B324]400 mr-2 flex-shrink-0" />
                          {consideration}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comprehensive Area Statistics */}
      <section ref={statsRef} className="py-24 px-6 bg-white">
        <div className="max-w-8xl mx-auto">
          <h2 className="text-5xl font-black mb-16 text-center">COMPREHENSIVE AREA GUIDE</h2>

          {/* Tab Navigation */}
          <div className="flex flex-wrap justify-center mb-16 bg-gray-100 p-2 rounded-2xl max-w-4xl mx-auto">
            {[
              { id: 'overview', label: 'Overview', icon: Home },
              { id: 'transport', label: 'Transport', icon: Train },
              { id: 'schools', label: 'Schools', icon: School },
              { id: 'lifestyle', label: 'Lifestyle', icon: Heart },
              { id: 'safety', label: 'Safety', icon: Shield }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center px-6 py-3 rounded-xl font-semibold transition-all ${
                  activeTab === id
                    ? 'bg-white text-gray-900 shadow-md'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="h-5 w-5 mr-2" />
                {label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-3xl shadow-2xl p-12 border border-gray-200">
            {activeTab === 'overview' && (
              <div className="space-y-12">
                <div>
                  <h3 className="text-3xl font-bold mb-6">About {areaData.areaName}</h3>
                  <p className="text-xl text-gray-600 leading-relaxed mb-8">{areaData.historicalBackground}</p>

                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="bg-slate-50 p-8 rounded-2xl">
                      <h4 className="text-xl font-bold mb-4">Demographics</h4>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span>Young Professionals</span>
                          <span className="font-semibold">{areaData.demographics.youngProfessionals}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Families</span>
                          <span className="font-semibold">{areaData.demographics.families}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Retirees</span>
                          <span className="font-semibold">{areaData.demographics.retirees}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>International Residents</span>
                          <span className="font-semibold">{areaData.demographics.international}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-slate-50 p-8 rounded-2xl">
                      <h4 className="text-xl font-bold mb-4">Architecture & Character</h4>
                      <p className="text-gray-600">{areaData.architecturalStyle}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'transport' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6">Transport & Connectivity</h3>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-2xl">
                    <h4 className="text-xl font-bold mb-6">Journey Times</h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center p-4 bg-white rounded-lg">
                        <span className="font-medium">City/Canary Wharf</span>
                        <span className="font-bold text-[#791E75]600">{areaData.transportTimes.cityCanaryWharf}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white rounded-lg">
                        <span className="font-medium">West End</span>
                        <span className="font-bold text-[#791E75]600">{areaData.transportTimes.westEnd}</span>
                      </div>
                      <div className="flex justify-between items-center p-4 bg-white rounded-lg">
                        <span className="font-medium">Heathrow Airport</span>
                        <span className="font-bold text-[#791E75]600">{areaData.transportTimes.heathrow}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-2xl">
                    <h4 className="text-xl font-bold mb-6">Local Transport</h4>
                    <div className="space-y-4">
                      <div className="bg-white p-4 rounded-lg">
                        <div className="font-medium mb-2">Nearest Tube Station</div>
                        <div className="text-2xl font-bold text-[#791E75]">{areaData.transportTimes.nearestTube}</div>
                        <div className="text-sm text-gray-600">{areaData.transportTimes.walkToTube} min walk</div>
                      </div>
                      <div className="bg-white p-4 rounded-lg">
                        <div className="font-medium mb-2">Transport Score</div>
                        <div className="text-3xl font-bold text-[#791E75]600">{areaData.transportScore}/10</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'schools' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6">Schools & Education</h3>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-2xl">
                    <h4 className="text-xl font-bold mb-6">Primary Schools</h4>
                    <ul className="space-y-3">
                      {areaData.primarySchools.map((school, index) => (
                        <li key={index} className="flex items-center bg-white p-3 rounded-lg">
                          <School className="h-5 w-5 text-[#791E75]600 mr-3" />
                          {school}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-2xl">
                    <h4 className="text-xl font-bold mb-6">Secondary Schools</h4>
                    <ul className="space-y-3">
                      {areaData.secondarySchools.map((school, index) => (
                        <li key={index} className="flex items-center bg-white p-3 rounded-lg">
                          <School className="h-5 w-5 text-[#791E75]600 mr-3" />
                          {school}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-blue-50 to-green-50 p-8 rounded-2xl text-center">
                  <h4 className="text-2xl font-bold mb-4">Overall School Rating</h4>
                  <div className="text-5xl font-black text-[#791E75]600 mb-2">{areaData.schoolRating}/10</div>
                  <div className="text-gray-600">Average Ofsted Rating</div>
                </div>
              </div>
            )}

            {activeTab === 'lifestyle' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6">Lifestyle & Amenities</h3>

                <div className="grid md:grid-cols-4 gap-6 mb-8">
                  <div className="text-center bg-slate-50 p-6 rounded-2xl">
                    <ShoppingBag className="h-12 w-12 text-[#F8B324]600 mx-auto mb-4" />
                    <div className="text-3xl font-bold text-gray-800">{areaData.restaurants}</div>
                    <div className="text-gray-600">Restaurants</div>
                  </div>
                  <div className="text-center bg-slate-50 p-6 rounded-2xl">
                    <Trees className="h-12 w-12 text-[#791E75]600 mx-auto mb-4" />
                    <div className="text-3xl font-bold text-gray-800">{areaData.parks}</div>
                    <div className="text-gray-600">Parks</div>
                  </div>
                  <div className="text-center bg-slate-50 p-6 rounded-2xl">
                    <Activity className="h-12 w-12 text-[#791E75] mx-auto mb-4" />
                    <div className="text-3xl font-bold text-gray-800">{areaData.gyms}</div>
                    <div className="text-gray-600">Gyms</div>
                  </div>
                  <div className="text-center bg-slate-50 p-6 rounded-2xl">
                    <Building className="h-12 w-12 text-[#791E75]600 mx-auto mb-4" />
                    <div className="text-3xl font-bold text-gray-800">{areaData.supermarkets}</div>
                    <div className="text-gray-600">Supermarkets</div>
                  </div>
                </div>

                <div className="bg-slate-50 p-8 rounded-2xl">
                  <h4 className="text-xl font-bold mb-4">Walkability Score</h4>
                  <div className="text-4xl font-bold text-[#791E75]600 mb-2">{areaData.walkabilityScore}/100</div>
                  <div className="text-gray-600">Daily errands can be accomplished on foot</div>
                </div>
              </div>
            )}

            {activeTab === 'safety' && (
              <div className="space-y-8">
                <h3 className="text-3xl font-bold mb-6">Safety & Security</h3>

                <div className="bg-gradient-to-r from-green-50 to-blue-50 p-8 rounded-2xl text-center mb-8">
                  <Shield className="h-16 w-16 text-[#791E75]600 mx-auto mb-4" />
                  <h4 className="text-2xl font-bold mb-4">Crime Rating</h4>
                  <div className="text-4xl font-black text-[#791E75]600 mb-2">{areaData.crimeRating}</div>
                  <div className="text-gray-600">Based on local crime statistics</div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="bg-slate-50 p-8 rounded-2xl">
                    <h4 className="text-xl font-bold mb-4">Safety Features</h4>
                    <ul className="space-y-2 text-gray-600">
                      <li>• Well-lit streets and public areas</li>
                      <li>• Regular police patrols</li>
                      <li>• CCTV coverage in main areas</li>
                      <li>• Active neighbourhood watch</li>
                      <li>• Good emergency services access</li>
                    </ul>
                  </div>

                  <div className="bg-slate-50 p-8 rounded-2xl">
                    <h4 className="text-xl font-bold mb-4">Community Safety</h4>
                    <p className="text-gray-600">
                      {areaData.areaName} has an active community with strong neighbourhood watch programs
                      and regular community meetings. The area benefits from good lighting, regular cleaning,
                      and well-maintained public spaces.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Future Developments */}
      <section className="py-24 px-6 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-black mb-16 text-center">FUTURE DEVELOPMENTS</h2>

          <div className="grid md:grid-cols-2 gap-12">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
              <h3 className="text-2xl font-bold mb-6 flex items-center">
                <Building className="h-6 w-6 text-[#791E75]600 mr-3" />
                Planned Developments
              </h3>
              <ul className="space-y-3">
                {areaData.plannedDevelopments.map((development, index) => (
                  <li key={index} className="flex items-start">
                    <ChevronRight className="h-5 w-5 text-[#791E75]600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{development}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
              <h3 className="text-2xl font-bold mb-6 flex items-center">
                <Train className="h-6 w-6 text-[#791E75]600 mr-3" />
                Infrastructure Projects
              </h3>
              <ul className="space-y-3">
                {areaData.infrastructureProjects.map((project, index) => (
                  <li key={index} className="flex items-start">
                    <ChevronRight className="h-5 w-5 text-[#791E75]600 mr-2 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-600">{project}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Premium CTA Section */}
      <section className="py-24 px-6 bg-gradient-to-r from-[#791E75] to-[#791E75]">
        <div className="max-w-6xl mx-auto text-center">
          <h2 className="text-5xl font-black mb-8 text-white">
            Ready to Invest in {areaData.areaName}?
          </h2>
          <p className="text-2xl text-white/90 mb-12 max-w-4xl mx-auto leading-relaxed">
            Access exclusive off-market properties, detailed investment projections, and expert local guidance
            from our {areaData.postcode} specialists.
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white/10 backdrop-blur p-6 rounded-2xl">
              <Phone className="h-8 w-8 text-white mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Call Direct</h3>
              <p className="text-white/80">Speak to our local experts</p>
            </div>
            <div className="bg-white/10 backdrop-blur p-6 rounded-2xl">
              <Mail className="h-8 w-8 text-white mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Email Inquiry</h3>
              <p className="text-white/80">Get detailed market reports</p>
            </div>
            <div className="bg-white/10 backdrop-blur p-6 rounded-2xl">
              <Globe className="h-8 w-8 text-white mx-auto mb-3" />
              <h3 className="text-xl font-bold text-white mb-2">Online Valuation</h3>
              <p className="text-white/80">Instant property estimates</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <Link href={`/sales?postcode=${areaData.postcode}`}>
              <Button className="bg-white hover:bg-gray-100 text-gray-900 font-bold py-6 px-12 rounded-2xl text-xl transition-all duration-300 hover:scale-105">
                <Building className="mr-3 h-6 w-6" />
                View Properties
              </Button>
            </Link>
            <Link href="/valuation">
              <Button className="bg-transparent border-2 border-white hover:bg-white hover:text-gray-900 text-white font-bold py-6 px-12 rounded-2xl text-xl transition-all duration-300 hover:scale-105">
                <Calculator className="mr-3 h-6 w-6" />
                Get Valuation
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}