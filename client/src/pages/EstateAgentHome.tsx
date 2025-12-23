import { useState, useRef, useEffect, useCallback, useMemo, ComponentProps, ReactNode, isValidElement, cloneElement } from 'react';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, MapPin, Phone, MessageCircle, Home, Building, Users, ArrowRight, ExternalLink, ArrowUp, Facebook, Instagram, Twitter, Menu, X, LogIn } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import ContactSection from '@/components/ContactSection';
import { PropertyChatInterface } from '@/components/PropertyChatInterface';
import AISearchBubble from '@/components/AISearchBubble';
import { GlobalSpotlight, useMobileDetection } from '@/components/MagicBento';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import logoWhite from '@/assets/john-barclay-full-logo-unstacked.png';
import { ShaderAnimation } from '@/components/ui/shader-animation';
import heroLogo from '@/assets/john-barclay-hero-logo.png';
import teamAslam from '@/assets/generated_images/Aslam_Noor_professional_headshot_15403d62.png';
import teamIury from '@/assets/generated_images/Iury_Campos_professional_headshot_dc928d52.png';
import teamMayssaa from '@/assets/generated_images/Mayssaa_Sabrah_professional_headshot_f6227228.png';
import lettingsTeam from '@/assets/generated_images/Lettings_team_group_photo_f04de92e.png';
import salesLeftImage from '@/assets/sales-left-rectangle.png';
import salesRightImage from '@/assets/sales-right-image.png';
import rentalsLeftImage from '@/assets/rentals-left-image.jpg';
import rentalsRightImage from '@/assets/rentals-right-image.png';
import commercialLeftImage from '@/assets/commercial-left-image.jpeg';
import commercialRightImage from '@/assets/commercial-right-image.webp';

gsap.registerPlugin(ScrollTrigger);

const EstateAgentHome = () => {
  // All hooks and state must be declared first before inner components
  const [, setLocation] = useLocation();

  // Section refs
  const heroRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const propertiesRef = useRef<HTMLDivElement>(null);
  const bridgeBackgroundRef = useRef<HTMLDivElement>(null);
  const contactRef = useRef<HTMLDivElement>(null);
  const teamRef = useRef<HTMLDivElement>(null);

  // Animation refs for unified properties section
  const johnBarclayTextRef = useRef<HTMLDivElement>(null);
  const salesVerticalRef = useRef<HTMLDivElement>(null);
  const rentalsVerticalRef = useRef<HTMLDivElement>(null);
  const commercialVerticalRef = useRef<HTMLDivElement>(null);
  const propertiesLogoPlaceholderRef = useRef<HTMLDivElement>(null);

  // Enhanced carousel system
  const carouselRef = useRef<HTMLDivElement>(null);
  const carouselContainerRef = useRef<HTMLDivElement>(null);
  const carouselAnimationRef = useRef<number>();
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const isMobile = useMobileDetection();

  // Carousel interaction state
  const carouselStateRef = useRef({
    isPerpetualScrolling: true,
    isUserInteracting: false,
    hoverDirection: null as 'left' | 'right' | null,
    lastScrollPosition: 0
  });
  const rentalsLeftImageRef = useRef<HTMLDivElement>(null);
  const rentalsRightImageRef = useRef<HTMLDivElement>(null);
  const commercialLeftImageRef = useRef<HTMLDivElement>(null);
  const commercialRightImageRef = useRef<HTMLDivElement>(null);

  // Center title overlay refs for slower parallax
  const salesTitleRef = useRef<HTMLDivElement>(null);
  const rentalsTitleRef = useRef<HTMLDivElement>(null);
  const commercialTitleRef = useRef<HTMLDivElement>(null);

  // History section refs for scroll lock functionality
  const horizontalScrollRef = useRef<HTMLDivElement>(null);
  const [isHorizontalScrollComplete, setIsHorizontalScrollComplete] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isTeamScrollComplete, setIsTeamScrollComplete] = useState(false);

  // Team animation refs
  const teamTitleRef = useRef<HTMLDivElement>(null);
  const teamContainerRef = useRef<HTMLDivElement>(null);
  const teamHorizontalScrollRef = useRef<HTMLDivElement>(null);

  // Holographic foil mouse tracking
  const [holoMousePos, setHoloMousePos] = useState({ x: 0.5, y: 0.5 });
  const [isVideoLoaded, setIsVideoLoaded] = useState(false);
  
  // Animated logo refs
  const heroLogoRef = useRef<HTMLImageElement>(null);
  const propertiesLogoRef = useRef<HTMLImageElement>(null);

  // Master ScrollTrigger holder (used by navigateToSection and curtain system)
  const masterScrollTriggerRef = useRef<any>(null);

  // Additional property section image refs
  const salesLeftImageRef = useRef<HTMLDivElement>(null);

  // Section navigation state and functions
  const sections = ['hero', 'properties', 'history', 'team', 'contact'];
  const [currentSection, setCurrentSection] = useState(0);

  // Enhanced animation state management system
  const animationStatesRef = useRef({
    history: { state: 'reset', lastProgress: -1 },
    sales: { state: 'reset', lastProgress: -1 },
    rentals: { state: 'reset', lastProgress: -1 },
    commercial: { state: 'reset', lastProgress: -1 },
    team: { state: 'reset', lastProgress: -1 },
  });

  // Search dropdown refs & state
  const searchDropdownRef = useRef<HTMLDivElement>(null);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  const [searchLocation, setSearchLocation] = useState('');
  const [searchPropertyType, setSearchPropertyType] = useState('flat');
  const [searchListingType, setSearchListingType] = useState('sale');
  const [searchMinPrice, setSearchMinPrice] = useState('');
  const [searchMaxPrice, setSearchMaxPrice] = useState('');
  const [searchBedrooms, setSearchBedrooms] = useState('');
  const [searchDistance, setSearchDistance] = useState('1');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(event.target as Node)) {
        setIsSearchDropdownOpen(false);
      }
    };

    if (isSearchDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isSearchDropdownOpen]);

  // Animated logo reveal effect
  useEffect(() => {
    // Hero logo animation
    if (heroLogoRef.current) {
      gsap.fromTo(heroLogoRef.current,
        { clipPath: 'inset(0 100% 0 0)', opacity: 0 },
        { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: 1.5, ease: "power2.out", delay: 0.3 }
      );
    }
    // Properties section logo animation (triggered when section becomes visible)
    if (propertiesLogoRef.current) {
      gsap.set(propertiesLogoRef.current, { clipPath: 'inset(0 100% 0 0)', opacity: 0 });
    }
  }, []);

  // Handle search form submission
  const handleSearch = useCallback(() => {
    const params = new URLSearchParams();
    params.set('type', searchPropertyType);
    params.set('listingType', searchListingType === 'rent' ? 'rental' : searchListingType);
    if (searchLocation) params.set('location', searchLocation);
    if (searchDistance) params.set('distance', searchDistance);
    if (searchMinPrice) params.set('minPrice', searchMinPrice);
    if (searchMaxPrice) params.set('maxPrice', searchMaxPrice);
    if (searchBedrooms) params.set('bedrooms', searchBedrooms);

    setLocation(`/search?${params.toString()}`);
    setIsSearchDropdownOpen(false);
  }, [searchPropertyType, searchListingType, searchLocation, searchDistance, searchMinPrice, searchMaxPrice, searchBedrooms, setLocation]);

  // BackToTopArrow Component
  // Mobile Navigation Menu Component
  const MobileNavigation = () => {
    const sectionNames = {
      hero: 'HOME',
      history: 'OUR HISTORY',
      properties: 'PROPERTIES',
      team: 'MEET OUR TEAM',
      contact: 'CONTACT US'
    };

    return (
      <>
        {/* Mobile Menu Button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="md:hidden fixed top-4 left-4 z-[90] bg-gray-900/80 backdrop-blur-sm p-3 rounded-lg border border-white/20"
          aria-label="Toggle navigation menu"
        >
          {isMobileMenuOpen ? (
            <X className="h-6 w-6 text-white" />
          ) : (
            <Menu className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="md:hidden fixed inset-0 z-[85] bg-black/90 backdrop-blur-md">
            <div className="flex flex-col items-center justify-center h-full space-y-6">
              {sections.map((section, index) => (
                <button
                  key={section}
                  onClick={() => {
                    navigateToSection(index);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`text-xl font-medium px-6 py-3 rounded-lg transition-all duration-300 ${
                    currentSection === index
                      ? 'text-[#D4A04F] bg-white/10'
                      : 'text-white hover:text-[#D4A04F] hover:bg-white/5'
                  }`}
                >
                  {sectionNames[section as keyof typeof sectionNames]}
                </button>
              ))}
            </div>
          </div>
        )}
      </>
    );
  };

  const BackToTopArrow = ({ currentSection }: { currentSection: number }) => {
    // Hide arrow when in hero section (section 0)
    if (currentSection === 0) {
      return null;
    }
    
    return (
      <div className="fixed right-8 top-1/2 -translate-y-[200px] z-[80] opacity-60 hover:opacity-100 transition-opacity duration-300">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="bg-[#791E75] hover:bg-[#5d1759] text-white p-4 rounded-full shadow-lg transition-colors duration-300 group border-2 border-[#791E75]/30"
          aria-label="Scroll to top"
        >
          <ArrowUp className="h-6 w-6 text-white group-hover:text-white transition-colors duration-300" />
        </button>
      </div>
    );
  };

  // Social Media Buttons Component - memoized to prevent re-renders
  const SocialMediaButtons = useMemo(() => (
      <div className="fixed top-4 right-4 md:top-8 md:right-8 z-[80]">
        <div className="flex gap-2 md:gap-3 items-center">
          {/* Search Button with Dropdown */}
          <div className="relative" ref={searchDropdownRef}>
            <button
              onClick={() => setIsSearchDropdownOpen(!isSearchDropdownOpen)}
              className="group relative px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/30 flex items-center justify-center gap-2 hover:bg-white/20 hover:border-white/40 transition-all duration-300 shadow-lg"
            >
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-semibold bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">
                Search Properties
              </div>
              <Home className="w-4 h-4 md:w-4 md:h-4 text-white" />
              <span className="text-white text-sm md:text-base font-semibold">Search</span>
              <ChevronDown className={`w-4 h-4 text-white transition-transform duration-300 ${isSearchDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Panel */}
            {isSearchDropdownOpen && (
              <div className="absolute top-full mt-2 right-0 w-96 bg-white/95 backdrop-blur-lg rounded-xl shadow-2xl border border-white/30 p-6 z-[90] animate-in fade-in slide-in-from-top-2 duration-200">
                <h3 className="text-gray-900 font-semibold mb-4 text-lg">Search Properties</h3>

                <div className="space-y-4">
                  {/* Location Input */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
                      <input
                        type="text"
                        placeholder="e.g., Maida Vale, Paddington..."
                        value={searchLocation}
                        onChange={(e) => setSearchLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791E75] focus:border-transparent text-gray-900"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Distance from Location</label>
                      <select
                        value={searchDistance}
                        onChange={(e) => setSearchDistance(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791E75] focus:border-transparent text-gray-900"
                      >
                        <option value="0.5">Within 0.5 miles</option>
                        <option value="1">Within 1 mile</option>
                        <option value="2">Within 2 miles</option>
                        <option value="3">Within 3 miles</option>
                        <option value="5">Within 5 miles</option>
                        <option value="10">Within 10 miles</option>
                        <option value="15">Within 15 miles</option>
                        <option value="20">Within 20 miles</option>
                      </select>
                    </div>
                  </div>

                  {/* Property Type */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Property Type</label>
                      <select
                        value={searchPropertyType}
                        onChange={(e) => setSearchPropertyType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791E75] focus:border-transparent text-gray-900"
                        data-testid="select-property-type"
                      >
                        <option value="flat">Flats</option>
                        <option value="house">Houses</option>
                        <option value="commercial">Commercial</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Listing Type</label>
                      <select
                        value={searchListingType}
                        onChange={(e) => setSearchListingType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791E75] focus:border-transparent text-gray-900"
                      >
                        <option value="sale">For Sale</option>
                        <option value="rent">To Rent</option>
                      </select>
                    </div>
                  </div>

                  {/* Price Range */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Min Price</label>
                      <input
                        type="number"
                        placeholder="Min"
                        value={searchMinPrice}
                        onChange={(e) => setSearchMinPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791E75] focus:border-transparent text-gray-900"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Max Price</label>
                      <input
                        type="number"
                        placeholder="Max"
                        value={searchMaxPrice}
                        onChange={(e) => setSearchMaxPrice(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791E75] focus:border-transparent text-gray-900"
                      />
                    </div>
                  </div>

                  {/* Bedrooms */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bedrooms</label>
                    <select
                      value={searchBedrooms}
                      onChange={(e) => setSearchBedrooms(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#791E75] focus:border-transparent text-gray-900"
                    >
                      <option value="">Any</option>
                      <option value="1">1+</option>
                      <option value="2">2+</option>
                      <option value="3">3+</option>
                      <option value="4">4+</option>
                      <option value="5">5+</option>
                    </select>
                  </div>

                  {/* Search Button */}
                  <button
                    onClick={handleSearch}
                    className="w-full px-4 py-3 bg-[#791E75] hover:bg-[#5d1759] text-white font-semibold rounded-lg transition-colors duration-300 flex items-center justify-center gap-2"
                  >
                    <Home className="w-4 h-4" />
                    Search Properties
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Login Button */}
        <Link href="/login" className="group relative">
            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-semibold bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">
              Login
            </div>
            <div className="px-4 py-2 md:px-5 md:py-2.5 rounded-full bg-[#791E75] backdrop-blur-sm border border-[#791E75] flex items-center justify-center gap-2 hover:bg-[#5d1759] hover:border-[#5d1759] transition-all duration-300 shadow-lg">
              <LogIn className="w-4 h-4 md:w-4 md:h-4 text-white" />
              <span className="text-white text-sm md:text-base font-semibold">Login</span>
            </div>
        </Link>
        {/* Facebook */}
        <a
          href="https://facebook.com/johnbarclayestates"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative"
          aria-label="Follow us on Facebook"
        >
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-semibold bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">
            Facebook
          </div>
          <div className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-black/20 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-[#791E75] text-white 600 hover:border-[#791E75]600 transition-all duration-300 group">
            <Facebook className="w-5 h-5 md:w-5 md:h-5 text-white/80 group-hover:text-white" />
          </div>
        </a>

        {/* Instagram */}
        <a
          href="https://instagram.com/johnbarclayestates"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative"
          aria-label="Follow us on Instagram"
        >
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-semibold bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">
            Instagram
          </div>
          <div className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-black/20 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-gradient-to-r hover:from-[#D4A04F] hover:to-[#B8903E] hover:border-transparent transition-all duration-300 group">
            <Instagram className="w-5 h-5 md:w-5 md:h-5 text-white/80 group-hover:text-white" />
          </div>
        </a>

        {/* Twitter */}
        <a
          href="https://twitter.com/johnbarclayestates"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative"
          aria-label="Follow us on Twitter"
        >
          <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded text-xs font-semibold bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-300 whitespace-nowrap">
            Twitter
          </div>
          <div className="w-11 h-11 md:w-10 md:h-10 rounded-full bg-black/20 backdrop-blur-sm border border-white/20 flex items-center justify-center hover:bg-[#791E75] text-white 400 hover:border-[#791E75]400 transition-all duration-300 group">
            <Twitter className="w-5 h-5 md:w-5 md:h-5 text-white/80 group-hover:text-white" />
          </div>
        </a>
      </div>
    </div>
  ), [isSearchDropdownOpen, searchLocation, searchPropertyType, searchListingType, searchMinPrice, searchMaxPrice, searchBedrooms, searchDistance, handleSearch]);

  // Animation state machine: 'reset' -> 'entering' -> 'animating' -> 'completed' -> 'reset'
  const updateAnimationState = (section: string, newState: string, progress: number) => {
    const current = animationStatesRef.current[section as keyof typeof animationStatesRef.current];
    if (current) {
      current.state = newState;
      current.lastProgress = progress;
    }
  };

  const shouldTriggerAnimation = (section: string, progress: number, threshold: number) => {
    const current = animationStatesRef.current[section as keyof typeof animationStatesRef.current];
    return current && progress >= threshold && current.state === 'reset';
  };

  const shouldResetAnimation = (section: string, progress: number, minRange: number, maxRange: number) => {
    const current = animationStatesRef.current[section as keyof typeof animationStatesRef.current];
    if (!current) return false;
    
    // Reset if we re-enter the section or if we were completed and moved significantly
    const wasCompleted = current.state === 'completed';
    const hasMovedSignificantly = Math.abs(progress - current.lastProgress) > 0.3;
    const isInRange = progress >= minRange && progress <= maxRange;
    
    return isInRange && (wasCompleted && hasMovedSignificantly);
  };

  const resetSectionStates = () => {
    // Reset all animation states
    Object.keys(animationStatesRef.current).forEach(section => {
      const state = animationStatesRef.current[section as keyof typeof animationStatesRef.current];
      if (state) {
        state.state = 'reset';
        state.lastProgress = -1;
      }
    });

    // Heritage section simplified - no layer animations needed

    // Reset properties section verticals
    if (salesVerticalRef.current && rentalsVerticalRef.current && commercialVerticalRef.current) {
      gsap.set(salesVerticalRef.current, { opacity: 0, x: "-100%" });
      gsap.set(rentalsVerticalRef.current, { opacity: 0, y: "-100%" });
      gsap.set(commercialVerticalRef.current, { opacity: 0, x: "100%" });
    }

    if (teamTitleRef.current && teamContainerRef.current) {
      gsap.set(teamTitleRef.current, { opacity: 0 });
      gsap.set(teamContainerRef.current, { opacity: 0 });
      gsap.set(".team-card", { opacity: 0 });
    }
  };

  const navigateToSection = (sectionIndex: number) => {
    if (sectionIndex < 0 || sectionIndex >= sections.length) return;
    
    // Reset all animation states before navigating
    resetSectionStates();
    
    setCurrentSection(sectionIndex);
    
    // Map section indices to their scrollProgress values (0-13 scale)
    // Based on the scroll trigger ranges:
    // Hero: 0 - 1.2
    // History: 1.2 - 4.2
    // Properties: 4.2 - 7.2
    // Team: 7.2 - 9.7
    // Contact: 9.7+
    const sectionScrollProgressTargets = [
      0,      // Hero - at top
      2.7,    // History - middle of range (1.2 - 4.2)
      5.7,    // Properties - middle of range (4.2 - 7.2)
      8.5,    // Team - middle of range (7.2 - 9.7)
      10.5    // Contact - past start (9.7+)
    ];
    
    const targetScrollProgress = sectionScrollProgressTargets[sectionIndex];
    
    // Use the master ScrollTrigger's start/end to calculate exact scroll position
    if (masterScrollTriggerRef.current) {
      const trigger = masterScrollTriggerRef.current;
      const totalSections = 13;
      const targetProgress = targetScrollProgress / totalSections;
      const scrollRange = trigger.end - trigger.start;
      const targetScrollTop = trigger.start + (targetProgress * scrollRange);
      
      window.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    } else {
      // Fallback if trigger not available yet
      const progress = targetScrollProgress / 13;
      const targetScrollTop = (100 + (progress * 2000)) * window.innerHeight / 100;
      
      window.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth'
      });
    }
  };

  // Handle horizontal scroll progress tracking for heritage section
  const handleHorizontalScroll = () => {
    const container = horizontalScrollRef.current;
    if (!container) return;

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const maxScrollLeft = scrollWidth - clientWidth;
    const scrollProgress = maxScrollLeft <= 0 ? 1 : scrollLeft / maxScrollLeft;

    // Each panel is 50vw wide, so we have 4 panels total
    // Complete when we've scrolled through at least 3.5 panels (87.5% of total scroll)
    if (scrollProgress >= 0.875 && !isHorizontalScrollComplete) {
      setIsHorizontalScrollComplete(true);
    }

    // Update background text vertical position based on horizontal scroll
    const backgroundText = document.getElementById('scrolling-background-text');
    if (backgroundText) {
      // Map horizontal scroll (0 to 1) to vertical movement (-200px to 300px)
      const verticalOffset = -200 + (scrollProgress * 500);
      backgroundText.style.transform = `translateY(${verticalOffset}px)`;
    }
  };


  // Section Navigation Component
  const SectionNavigation = ({ sectionIndex }: { sectionIndex: number }) => {
    const sectionNames = {
      hero: 'Home',
      history: 'Heritage',
      properties: 'Properties',
      team: 'Team',
      contact: 'Contact'
    };

    const canGoUp = sectionIndex > 0;
    const canGoDown = sectionIndex < sections.length - 1;

    return (
      <div className="fixed top-1/2 right-2 md:right-6 z-[80] -translate-y-1/2">
        <div className="flex flex-col items-center gap-2 md:gap-3">
          {/* Up Arrow */}
          {canGoUp && (
            <button
              onClick={() => navigateToSection(sectionIndex - 1)}
              className="bg-[#791E75] hover:bg-[#5d1759] text-white p-2 rounded-full shadow-lg transition-all duration-300 group border-2 border-[#791E75]/30 hover:scale-110"
              aria-label="Go to previous section"
            >
              <ChevronUp className="h-4 w-4 text-white group-hover:text-white transition-colors duration-300" />
            </button>
          )}

          {/* Navigation Dots */}
          <div className="flex flex-col gap-3">
            {sections.map((section, index) => (
              <button
                key={section}
                onClick={() => navigateToSection(index)}
                className={`group relative flex items-center transition-all duration-300 ${
                  index === sectionIndex
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {/* Section dot indicator */}
                <div className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${
                  index === sectionIndex
                    ? 'bg-white border-white shadow-lg shadow-white/30'
                    : 'border-white/50 group-hover:border-white/80'
                }`} />

                {/* Section name tooltip */}
                <div className={`absolute right-5 bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-sm font-medium border border-white/20 transition-all duration-300 whitespace-nowrap ${
                  index === sectionIndex
                    ? 'opacity-100 translate-x-0'
                    : 'opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0'
                }`}>
                  {sectionNames[section as keyof typeof sectionNames]}
                </div>
              </button>
            ))}
          </div>

          {/* Down Arrow */}
          {canGoDown && (
            <button
              onClick={() => navigateToSection(sectionIndex + 1)}
              className="bg-[#791E75] hover:bg-[#5d1759] text-white p-2 rounded-full shadow-lg transition-all duration-300 group border-2 border-[#791E75]/30 hover:scale-110"
              aria-label="Go to next section"
            >
              <ChevronDown className="h-4 w-4 text-white group-hover:text-white transition-colors duration-300" />
            </button>
          )}
        </div>
      </div>
    );
  };

  // Coverage areas data
  const coverageAreas = [
    { name: "Bayswater", postcode: "W2", route: "/areas/bayswater" },
    { name: "Harlesden", postcode: "NW10", route: "/areas/harlesden" },
    { name: "Kensal Green", postcode: "NW10", route: "/areas/kensal-green" },
    { name: "Kensal Rise", postcode: "NW10", route: "/areas/kensal-rise" },
    { name: "Kilburn", postcode: "NW6", route: "/areas/kilburn" },
    { name: "Ladbroke Grove", postcode: "W10", route: "/areas/ladbroke-grove" },
    { name: "Maida Vale", postcode: "W9", route: "/areas/maida-vale" },
    { name: "North Kensington", postcode: "W10", route: "/areas/north-kensington" },
    { name: "Queens Park", postcode: "NW6", route: "/areas/queens-park" },
    { name: "Westbourne Park", postcode: "W10", route: "/areas/westbourne-park" },
    { name: "Willesden", postcode: "NW10", route: "/areas/willesden" }
  ];

  // Team members data
  const teamMembers = [
    {
      id: 1,
      name: "Aslam Noor",
      role: "Director of Lettings & Property Management",
      image: teamAslam,
      whatsapp: "+442077240000",
      description: "Leading our lettings division with over 15 years of experience in central London property management."
    },
    {
      id: 2,
      name: "Iury Campos",
      role: "Associate Partner & General Manager",
      image: teamIury,
      whatsapp: "+442077240000",
      description: "Overseeing operations and client relationships with expertise in both residential sales and commercial ventures."
    },
    {
      id: 3,
      name: "Mayssaa Sabrah",
      role: "Sales & Lettings Negotiator",
      image: teamMayssaa,
      whatsapp: "+442077240000",
      description: "Specializing in client negotiations and property matching services across prime London locations."
    }
  ];

  // Handle carousel arrow clicks with infinite scroll support
  const handleCarouselScroll = (direction: 'left' | 'right') => {
    if (carouselRef.current) {
      const container = carouselRef.current;
      const cardWidth = 128 + 16; // card width + gap
      const scrollWidth = container.scrollWidth;
      const realContentWidth = scrollWidth / 2; // Since content is duplicated
      
      if (direction === 'left') {
        if (container.scrollLeft <= cardWidth) {
          // If near the beginning, jump to end of real content
          container.scrollLeft = realContentWidth - cardWidth;
        } else {
          container.scrollBy({ left: -cardWidth, behavior: 'smooth' });
        }
      } else {
        if (container.scrollLeft >= realContentWidth - cardWidth) {
          // If near end of real content, jump to beginning
          container.scrollLeft = 0;
        } else {
          container.scrollBy({ left: cardWidth, behavior: 'smooth' });
        }
      }
    }
  };

  // Initialize animations and ScrollTrigger effects
  useEffect(() => {
    // Set initial positions for layered curtain effect
    // Hero starts visible and accessible, all others start below screen
    gsap.set(heroRef.current, { y: 0, visibility: "visible" });
    gsap.set(historyRef.current, { y: "100vh" });
    gsap.set(propertiesRef.current, { y: "100vh" });
    gsap.set(teamRef.current, { y: "100vh" });
    gsap.set(contactRef.current, { y: "100vh" });
    // Team animations are handled within the curtain roll system

    // Team horizontal scroll will be handled within the curtain roll system

    // Heritage section simplified - no layer elements to hide

    // Set Properties section verticals to be HIDDEN initially
    if (salesVerticalRef.current && rentalsVerticalRef.current && commercialVerticalRef.current) {
      gsap.set(salesVerticalRef.current, { opacity: 0, x: "-100%" });
      gsap.set(rentalsVerticalRef.current, { opacity: 0, y: "-100%" });
      gsap.set(commercialVerticalRef.current, { opacity: 0, x: "100%" });
    }

    // Set Team section elements to be HIDDEN initially
    if (teamTitleRef.current && teamContainerRef.current) {
      gsap.set(teamTitleRef.current, { opacity: 0 });
      gsap.set(teamContainerRef.current, { opacity: 0 });
      gsap.set(".team-card", { opacity: 0 });
    }

    // Set logo placeholder to be HIDDEN initially
    if (propertiesLogoPlaceholderRef.current) {
      gsap.set(propertiesLogoPlaceholderRef.current, { opacity: 0, scale: 0.8, rotation: 0 });
    }

    // Individual Section Animations - triggered when each section is fully revealed
    // Using refs so navigation can reset these flags

    // SVG path animation for section dividers
    setTimeout(() => {
      const paths = document.querySelectorAll('path[stroke-dasharray]');
      paths.forEach((p: any) => {
        const len = p.getTotalLength();
        p.style.setProperty('--len', len);
      });
    }, 100);

    // Layered Curtain Roll System - Each section climbs up to cover the previous layer

    // Create invisible spacer div to drive scroll
    const spacerDiv = document.createElement('div');
    spacerDiv.style.height = '600vh'; // Extra height to ensure full scroll range
    spacerDiv.style.position = 'absolute';
    spacerDiv.style.top = '100vh'; // Start after hero
    spacerDiv.style.width = '1px';
    spacerDiv.style.pointerEvents = 'none';
    spacerDiv.style.opacity = '0';
    document.body.appendChild(spacerDiv);

    // Master scroll trigger that controls all curtain animations
    // Each section takes exactly 1 scroll (100vh) to transition
    masterScrollTriggerRef.current = ScrollTrigger.create({
      trigger: spacerDiv,
      start: "top bottom", 
      end: "bottom bottom", // Changed to ensure full progress range is reachable
      scrub: 0.5, // Reduced lag for snappier response
      onUpdate: self => {
        const progress = self.progress;
        const totalSections = 5; // 5 equal sections
        
        // scrollProgress goes from 0 to 5 (one unit per section)
        const scrollProgress = progress * totalSections;
        let currentSectionIndex = 0;

        // Each section is exactly 1 unit
        if (scrollProgress < 1) {
          currentSectionIndex = 0; // Hero → Properties
        } else if (scrollProgress < 2) {
          currentSectionIndex = 1; // Properties → History
        } else if (scrollProgress < 3) {
          currentSectionIndex = 2; // History (with horizontal scroll)
        } else if (scrollProgress < 4) {
          currentSectionIndex = 3; // Team
        } else {
          currentSectionIndex = 4; // Contact
        }

        setCurrentSection(currentSectionIndex);
        
        // Hero section - visible until properties covers it
        if (scrollProgress < 1) {
          gsap.set(heroRef.current, { y: 0 });
        } else {
          gsap.set(heroRef.current, { y: "-100vh" });
        }
        
        // Properties section - slides up during scroll 0-1, stays until scroll 2
        if (scrollProgress <= 2) {
          const propertiesProgress = Math.min(scrollProgress, 1);
          gsap.set(propertiesRef.current, {
            y: (1 - propertiesProgress) * 100 + "vh"
          });
          
          // Animate verticals during entrance
          if (salesVerticalRef.current) {
            gsap.set(salesVerticalRef.current, { 
              x: -100 * (1 - propertiesProgress) + "%",
              opacity: propertiesProgress
            });
          }
          if (rentalsVerticalRef.current) {
            gsap.set(rentalsVerticalRef.current, { 
              y: -100 * (1 - propertiesProgress) + "%",
              opacity: propertiesProgress
            });
          }
          if (commercialVerticalRef.current) {
            gsap.set(commercialVerticalRef.current, { 
              x: 100 * (1 - propertiesProgress) + "%",
              opacity: propertiesProgress
            });
          }
          
          // Animate properties logo reveal when section is mostly visible
          if (propertiesLogoRef.current && propertiesProgress >= 0.7) {
            const logoProgress = (propertiesProgress - 0.7) / 0.3; // 0 to 1 over last 30%
            gsap.set(propertiesLogoRef.current, {
              clipPath: `inset(0 ${(1 - logoProgress) * 100}% 0 0)`,
              opacity: logoProgress
            });
          } else if (propertiesLogoRef.current) {
            gsap.set(propertiesLogoRef.current, { clipPath: 'inset(0 100% 0 0)', opacity: 0 });
          }
        } else {
          gsap.set(propertiesRef.current, { y: "100vh" });
          if (salesVerticalRef.current && rentalsVerticalRef.current && commercialVerticalRef.current) {
            gsap.set(salesVerticalRef.current, { opacity: 0, x: "-100%" });
            gsap.set(rentalsVerticalRef.current, { opacity: 0, y: "-100%" });
            gsap.set(commercialVerticalRef.current, { opacity: 0, x: "100%" });
          }
          // Reset properties logo
          if (propertiesLogoRef.current) {
            gsap.set(propertiesLogoRef.current, { clipPath: 'inset(0 100% 0 0)', opacity: 0 });
          }
        }
        
        // History section - slides up during scroll 1-2, horizontal scroll during 2-3
        if (scrollProgress >= 1 && scrollProgress <= 3) {
          if (scrollProgress <= 2) {
            // Entrance phase
            const historyProgress = scrollProgress - 1;
            gsap.set(historyRef.current, {
              y: (1 - historyProgress) * 100 + "vh",
              visibility: 'visible'
            });
            setIsHorizontalScrollComplete(false);
            if (horizontalScrollRef.current) {
              horizontalScrollRef.current.scrollLeft = 0;
            }
          } else {
            // Horizontal scroll phase (scroll 2-3)
            gsap.set(historyRef.current, { y: 0, visibility: 'visible' });
            const horizontalProgress = scrollProgress - 2; // 0 to 1
            
            if (horizontalScrollRef.current) {
              const container = horizontalScrollRef.current;
              const maxScrollLeft = container.scrollWidth - container.clientWidth;
              gsap.set(container, { scrollLeft: horizontalProgress * maxScrollLeft });
            }
          }
        } else if (scrollProgress > 3) {
          gsap.set(historyRef.current, { y: 0, visibility: 'visible' });
        } else {
          gsap.set(historyRef.current, { y: "100vh", visibility: 'visible' });
        }
        
        // Hide logo placeholder
        if (propertiesLogoPlaceholderRef.current) {
          gsap.set(propertiesLogoPlaceholderRef.current, { opacity: 0, visibility: 'hidden' });
        }
        
        // Team section - slides up during scroll 3-4
        if (scrollProgress >= 3 && scrollProgress <= 4) {
          const teamProgress = scrollProgress - 3;
          gsap.set(teamRef.current, { y: (1 - teamProgress) * 100 + "vh" });
          
          if (teamTitleRef.current) gsap.set(teamTitleRef.current, { opacity: teamProgress });
          if (teamContainerRef.current) {
            gsap.set(teamContainerRef.current, { opacity: teamProgress });
            document.querySelectorAll('.team-card').forEach((card) => {
              gsap.set(card, { opacity: teamProgress });
            });
          }
        } else if (scrollProgress > 4) {
          gsap.set(teamRef.current, { y: 0 });
          if (teamTitleRef.current) gsap.set(teamTitleRef.current, { opacity: 1 });
          if (teamContainerRef.current) {
            gsap.set(teamContainerRef.current, { opacity: 1 });
            document.querySelectorAll('.team-card').forEach((card) => {
              gsap.set(card, { opacity: 1 });
            });
          }
        } else {
          gsap.set(teamRef.current, { y: "100vh" });
          if (teamTitleRef.current) gsap.set(teamTitleRef.current, { opacity: 0 });
          if (teamContainerRef.current) {
            gsap.set(teamContainerRef.current, { opacity: 0 });
            document.querySelectorAll('.team-card').forEach((card) => {
              gsap.set(card, { opacity: 0 });
            });
          }
        }
        
        // Contact section - slides up during scroll 4-5
        if (scrollProgress >= 4 && scrollProgress <= 5) {
          const contactProgress = scrollProgress - 4;
          gsap.set(contactRef.current, { y: (1 - contactProgress) * 100 + "vh" });
        } else if (scrollProgress > 5) {
          gsap.set(contactRef.current, { y: 0 });
        } else {
          gsap.set(contactRef.current, { y: "100vh" });
        }
      }
    });

    return () => {
      ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    };
  }, []);

  // Enhanced carousel animation system with seamless infinite scroll
  useEffect(() => {
    const moveCarousel = () => {
      if (!carouselRef.current) return;
      
      const container = carouselRef.current;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const state = carouselStateRef.current;
      
      // Since we duplicate content, the real content width is half of scrollWidth
      const realContentWidth = scrollWidth / 2;
      const maxScroll = realContentWidth;
      
      // Handle user interaction (hover directions)
      if (state.isUserInteracting) {
        if (state.hoverDirection === 'left') {
          container.scrollLeft -= 8;
          // If scrolled too far left, wrap to the end of the real content
          if (container.scrollLeft <= 0) {
            container.scrollLeft = maxScroll;
          }
        } else if (state.hoverDirection === 'right') {
          container.scrollLeft += 8;
          // If scrolled past real content, wrap to beginning
          if (container.scrollLeft >= maxScroll) {
            container.scrollLeft = 0;
          }
        }
      } 
      // Handle perpetual scrolling when not interacting
      else if (state.isPerpetualScrolling) {
        container.scrollLeft += 1;
        
        // Seamless reset when we reach the end of real content
        if (container.scrollLeft >= maxScroll) {
          container.scrollLeft = 0;
        }
      }
      
      state.lastScrollPosition = container.scrollLeft;
      carouselAnimationRef.current = requestAnimationFrame(moveCarousel);
    };
    
    carouselAnimationRef.current = requestAnimationFrame(moveCarousel);
    
    return () => {
      if (carouselAnimationRef.current) {
        cancelAnimationFrame(carouselAnimationRef.current);
      }
    };
  }, []);

  // Carousel interaction handlers
  const handleCarouselInteraction = (direction: 'left' | 'right' | null, isInteracting: boolean) => {
    const state = carouselStateRef.current;
    state.hoverDirection = direction;
    state.isUserInteracting = isInteracting;
  };

  // Handle team horizontal scroll on mobile
  const handleTeamHorizontalScroll = () => {
    if (teamHorizontalScrollRef.current && window.innerWidth < 768) {
      const container = teamHorizontalScrollRef.current;
      const scrollLeft = container.scrollLeft;
      const scrollWidth = container.scrollWidth;
      const clientWidth = container.clientWidth;
      const maxScroll = scrollWidth - clientWidth;
      const scrollProgress = maxScroll <= 0 ? 1 : scrollLeft / maxScroll;
      
      // Mark complete when user has scrolled through 90% of the team section
      if (scrollProgress >= 0.9 && !isTeamScrollComplete) {
        setIsTeamScrollComplete(true);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white overflow-x-hidden">
      
      {/* Hero Section with Logo and Coverage Areas Carousel */}
      <section 
        ref={heroRef} 
        className="fixed top-0 left-0 w-full min-h-screen flex flex-col justify-start items-center bg-[#2A0A2A]" 
        style={{ zIndex: 10, perspective: '1000px', visibility: 'visible' }}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          setHoloMousePos({
            x: (e.clientX - rect.left) / rect.width,
            y: (e.clientY - rect.top) / rect.height
          });
        }}
      >
        {/* Animated Shader Background */}
        <div className="absolute inset-0" style={{ zIndex: 0 }}>
          <ShaderAnimation />
        </div>
        
        {/* Hero Video Background - Fades in once loaded */}
        <video
          autoPlay
          muted
          loop
          playsInline
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 pointer-events-none ${isVideoLoaded ? 'opacity-100' : 'opacity-0'}`}
          style={{ zIndex: 1 }}
          onError={(e) => {
            console.error('Video failed to load:', e);
            console.error('Video src:', '/hero-video.mp4');
            console.error('Video element:', e.currentTarget);
          }}
          onLoadedData={() => {
            console.log('Video loaded successfully');
            setIsVideoLoaded(true);
          }}
          onCanPlay={() => console.log('Video can play')}
        >
          <source src="/hero-video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        
        {/* Video Overlay */}
        <div className="absolute inset-0 bg-[#2A0A2A]/40 pointer-events-none" style={{ zIndex: 2 }}></div>
        
        {/* Logo and Tagline Content - Positioned at top */}
        <div className="text-center relative px-6 pt-16 sm:pt-20 md:pt-24 lg:pt-32" style={{ zIndex: 10 }}>
          <img
            ref={heroLogoRef}
            src={heroLogo}
            alt="John Barclay Estate & Management"
            className="max-w-[280px] sm:max-w-[380px] md:max-w-[450px] lg:max-w-[500px] w-full h-auto object-contain mx-auto mb-6 md:mb-8"
          />
          <p className="text-white text-sm sm:text-base md:text-xl lg:text-2xl font-light tracking-wide max-w-xl md:max-w-2xl lg:max-w-3xl mx-auto mb-8 md:mb-12 px-4">
            Over three decades of trusted property expertise across west and north west London
          </p>
          
          {/* Coverage Areas Carousel - Positioned at bottom of hero */}
        </div>

        {/* Coverage Areas Carousel - Moved outside and positioned at bottom */}
        <div ref={carouselContainerRef} className="absolute bottom-16 sm:bottom-20 md:bottom-24 left-0 right-0 w-full z-20 bento-section">
          <GlobalSpotlight 
            gridRef={carouselContainerRef}
            disableAnimations={isMobile}
            enabled={true}
            spotlightRadius={200}
            glowColor="212, 160, 79"
            cardSelector=".coverage-card"
          />
            {/* Left Arrow - Hide on mobile */}
            <button 
              className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-[#5A1A5A]/20 backdrop-blur-sm rounded-full p-3 text-[#D4A04F] hover:bg-[#4A1545]/20 transition-all duration-300 border border-[#D4A04F]/30"
              onClick={() => handleCarouselScroll('left')}
              onMouseEnter={() => handleCarouselInteraction('left', true)}
              onMouseLeave={() => handleCarouselInteraction(null, false)}
              aria-label="Scroll carousel left"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            
            {/* Right Arrow - Hide on mobile */}
            <button 
              className="hidden md:block absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-[#5A1A5A]/20 backdrop-blur-sm rounded-full p-3 text-[#D4A04F] hover:bg-[#4A1545]/20 transition-all duration-300 border border-[#D4A04F]/30"
              onClick={() => handleCarouselScroll('right')}
              onMouseEnter={() => handleCarouselInteraction('right', true)}
              onMouseLeave={() => handleCarouselInteraction(null, false)}
              aria-label="Scroll carousel right"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            
            {/* Carousel Container */}
            <div 
              ref={carouselRef}
              className="flex gap-2 sm:gap-3 md:gap-4 overflow-x-auto scroll-smooth px-4 md:px-12 carousel-container"
              onMouseMove={(e) => {
                // Don't interfere if hovering over a card
                const target = e.target as HTMLElement;
                const card = target.closest('.coverage-card');
                const link = target.closest('a[href^="/area/"]');

                if (card || link) {
                  // User is hovering over a card, don't trigger carousel scroll
                  console.log('Container detected card hover, skipping carousel scroll');
                  return;
                }

                console.log('Container onMouseMove - no card detected');

                const container = e.currentTarget;
                const rect = container.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const containerWidth = rect.width;
                const leftThreshold = containerWidth * 0.25; // Left 25%
                const rightThreshold = containerWidth * 0.75; // Right 75%

                if (x < leftThreshold) {
                  handleCarouselInteraction('left', true);
                } else if (x > rightThreshold) {
                  handleCarouselInteraction('right', true);
                } else {
                  handleCarouselInteraction(null, false);
                }
              }}
              onMouseLeave={() => handleCarouselInteraction(null, false)}
            >
              <style>{`
                .carousel-container {
                  scrollbar-width: none;
                  -ms-overflow-style: none;
                }
                .carousel-container::-webkit-scrollbar {
                  display: none;
                }
                .coverage-card {
                  width: 128px;
                  height: 96px;
                  min-width: 128px;
                  min-height: 96px;
                  flex-shrink: 0;
                }
              `}</style>
              
              {/* Coverage Area Cards */}
              {coverageAreas.map((area) => {
                const areaId = area.name.toLowerCase().replace(/\s+/g, '-');
                return (
                    <div
                      key={areaId}
                      className={`coverage-card magic-bento-card magic-bento-card--border-glow relative backdrop-blur-sm rounded-xl text-center transition-all duration-300 border border-[#D4A04F]/30 cursor-pointer flex-shrink-0 ${
                        hoveredCard === areaId
                          ? 'bg-[#D4A04F]/20 border-[#D4A04F]'
                          : 'bg-[#5A1A5A]/20 hover:bg-[#4A1545]/20'
                      }`}
                      style={{ '--glow-color': '212, 160, 79' } as React.CSSProperties}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Card clicked, navigating to:', area.route);
                        setLocation(area.route);
                      }}
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        console.log('Card hover ENTER:', areaId);
                        setHoveredCard(areaId);
                        // Pause perpetual scrolling when hovering card
                        carouselStateRef.current.isPerpetualScrolling = false;
                        carouselStateRef.current.isUserInteracting = true;
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        console.log('Card hover LEAVE');
                        setHoveredCard(null);
                        // Resume perpetual scrolling when leaving card
                        carouselStateRef.current.isPerpetualScrolling = true;
                        carouselStateRef.current.isUserInteracting = false;
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        
                        // Calculate which edge is closest
                        const distToTop = y;
                        const distToBottom = rect.height - y;
                        const distToLeft = x;
                        const distToRight = rect.width - x;
                        const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
                        
                        let edgeX, edgeY;
                        if (minDist === distToTop) {
                          edgeX = x;
                          edgeY = 0;
                        } else if (minDist === distToBottom) {
                          edgeX = x;
                          edgeY = rect.height;
                        } else if (minDist === distToLeft) {
                          edgeX = 0;
                          edgeY = y;
                        } else {
                          edgeX = rect.width;
                          edgeY = y;
                        }
                        
                        e.currentTarget.style.setProperty('--edge-x', `${edgeX}px`);
                        e.currentTarget.style.setProperty('--edge-y', `${edgeY}px`);
                        e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                        e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                      }}
                    >
                      {/* Bright white light sweep effect */}
                      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                        <div 
                          className="absolute w-20 h-20 rounded-full"
                          style={{
                            background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.2) 60%, transparent 100%)',
                            left: 'var(--edge-x, 50%)',
                            top: 'var(--edge-y, 50%)',
                            transform: 'translate(-50%, -50%)',
                            filter: 'blur(3px)',
                            boxShadow: '0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(255,255,255,0.4)'
                          }}
                        />
                        <div 
                          className="absolute w-8 h-8 rounded-full"
                          style={{
                            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
                            left: 'var(--edge-x, 50%)',
                            top: 'var(--edge-y, 50%)',
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 15px rgba(255,255,255,1)'
                          }}
                        />
                      </div>
                      <div className="absolute inset-0 flex flex-col justify-center items-center z-10">
                        {hoveredCard === areaId ? (
                          <>
                            <div className="text-sm font-gotham font-black text-black leading-none">MORE</div>
                            <div className="text-sm font-gotham font-black text-black leading-none">INFO</div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-gotham font-black text-[#D4A04F] leading-none">{area.postcode}</div>
                            <div className="text-xs text-white/80 font-gotham font-medium text-center leading-none mt-1">{area.name}</div>
                          </>
                        )}
                      </div>
                    </div>
                );
              })}
              
              {/* Duplicate Coverage Area Cards for Seamless Infinite Scroll */}
              {coverageAreas.map((area) => {
                const areaId = `${area.name.toLowerCase().replace(/\s+/g, '-')}-duplicate`;
                return (
                  <Link key={areaId} href={area.route}>
                    <div 
                      className={`coverage-card magic-bento-card magic-bento-card--border-glow relative backdrop-blur-sm rounded-xl text-center transition-all duration-300 border border-[#D4A04F]/30 cursor-pointer flex-shrink-0 ${
                        hoveredCard === areaId 
                          ? 'bg-[#D4A04F]/20 border-[#D4A04F]' 
                          : 'bg-[#5A1A5A]/20 hover:bg-[#4A1545]/20'
                      }`}
                      style={{ '--glow-color': '212, 160, 79' } as React.CSSProperties}
                      onMouseEnter={(e) => {
                        e.stopPropagation();
                        console.log('Card hover ENTER:', areaId);
                        setHoveredCard(areaId);
                      }}
                      onMouseLeave={(e) => {
                        e.stopPropagation();
                        console.log('Card hover LEAVE');
                        setHoveredCard(null);
                      }}
                      onMouseMove={(e) => {
                        e.stopPropagation();
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const y = e.clientY - rect.top;
                        
                        // Calculate which edge is closest
                        const distToTop = y;
                        const distToBottom = rect.height - y;
                        const distToLeft = x;
                        const distToRight = rect.width - x;
                        const minDist = Math.min(distToTop, distToBottom, distToLeft, distToRight);
                        
                        let edgeX, edgeY;
                        if (minDist === distToTop) {
                          edgeX = x;
                          edgeY = 0;
                        } else if (minDist === distToBottom) {
                          edgeX = x;
                          edgeY = rect.height;
                        } else if (minDist === distToLeft) {
                          edgeX = 0;
                          edgeY = y;
                        } else {
                          edgeX = rect.width;
                          edgeY = y;
                        }
                        
                        e.currentTarget.style.setProperty('--edge-x', `${edgeX}px`);
                        e.currentTarget.style.setProperty('--edge-y', `${edgeY}px`);
                        e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                        e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                      }}
                    >
                      {/* Bright white light sweep effect */}
                      <div className="absolute inset-0 opacity-0 hover:opacity-100 transition-opacity duration-150 pointer-events-none">
                        <div 
                          className="absolute w-20 h-20 rounded-full"
                          style={{
                            background: 'radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 30%, rgba(255,255,255,0.2) 60%, transparent 100%)',
                            left: 'var(--edge-x, 50%)',
                            top: 'var(--edge-y, 50%)',
                            transform: 'translate(-50%, -50%)',
                            filter: 'blur(3px)',
                            boxShadow: '0 0 30px rgba(255,255,255,0.8), 0 0 60px rgba(255,255,255,0.4)'
                          }}
                        />
                        <div 
                          className="absolute w-8 h-8 rounded-full"
                          style={{
                            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0.8) 50%, transparent 100%)',
                            left: 'var(--edge-x, 50%)',
                            top: 'var(--edge-y, 50%)',
                            transform: 'translate(-50%, -50%)',
                            boxShadow: '0 0 15px rgba(255,255,255,1)'
                          }}
                        />
                      </div>
                      <div className="absolute inset-0 flex flex-col justify-center items-center z-10">
                        {hoveredCard === areaId ? (
                          <>
                            <div className="text-sm font-gotham font-black text-black leading-none">MORE</div>
                            <div className="text-sm font-gotham font-black text-black leading-none">INFO</div>
                          </>
                        ) : (
                          <>
                            <div className="text-2xl font-gotham font-black text-[#D4A04F] leading-none">{area.postcode}</div>
                            <div className="text-xs text-white/80 font-gotham font-medium text-center leading-none mt-1">{area.name}</div>
                          </>
                        )}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
        </div>

        {/* Scroll Down Arrow */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30">
          <button 
            onClick={() => navigateToSection(1)}
            className="flex flex-col items-center text-white/70 hover:text-white transition-colors duration-300"
            aria-label="Scroll to next section"
            data-testid="button-scroll-down"
          >
            <span className="text-xs mb-1">Scroll Down</span>
            <ChevronDown className="h-6 w-6 animate-bounce" />
          </button>
        </div>

      </section>

      {/* Our History Section - Proper Split Screen with Oversized Text and Scrollable Story */}
      <section ref={historyRef} className="fixed top-0 left-0 w-full min-h-screen bg-white overflow-hidden" style={{ zIndex: 30 }}>

        {/* Hide horizontal scrollbar with CSS */}
        <style>{`
          .horizontal-scroll::-webkit-scrollbar {
            display: none;
          }
          .horizontal-scroll {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>

        {/* Background Text Layer - Centered in top half (desktop only) */}
        <div className="hidden md:flex absolute top-0 left-0 w-full h-1/2 pointer-events-none items-center justify-center" style={{zIndex: 5}}>
          <div id="scrolling-background-text" className="opacity-100">
            <div className="space-y-16 text-center">
              <h1 className="text-6xl lg:text-7xl font-black text-gray-300 leading-none tracking-tight">
                PRIME
                <br />
                LETTINGS
              </h1>
              <div className="w-20 h-px bg-gray-300/50 mx-auto"></div>
              <h2 className="text-6xl lg:text-7xl font-black text-gray-300 leading-none tracking-tight">
                LUXURY
                <br />
                SALES
              </h2>
              <div className="w-20 h-px bg-gray-300/50 mx-auto"></div>
              <h3 className="text-6xl lg:text-7xl font-black text-gray-300 leading-none tracking-tight">
                COMMERCIAL
                <br />
                PROPERTY
              </h3>
            </div>
          </div>
        </div>

        {/* Layout - Stack on mobile, split on desktop */}
        <div className="min-h-screen md:h-screen w-full relative flex flex-col md:block">
          {/* Top Section - Hidden on desktop, visible on mobile */}
          <div className="block md:hidden w-full bg-white py-8 px-6">
            <div className="text-center space-y-4">
              <h1 className="text-3xl font-black text-gray-300 leading-none tracking-tight">
                PRIME LETTINGS
              </h1>
              <div className="w-16 h-px bg-gray-300/50 mx-auto"></div>
              <h2 className="text-3xl font-black text-gray-300 leading-none tracking-tight">
                LUXURY SALES
              </h2>
              <div className="w-16 h-px bg-gray-300/50 mx-auto"></div>
              <h3 className="text-3xl font-black text-gray-300 leading-none tracking-tight">
                COMMERCIAL PROPERTY
              </h3>
            </div>
          </div>

          {/* Desktop Top Half - Empty white space */}
          <div className="hidden md:block md:h-1/2 w-full bg-white">
          </div>

          {/* Bottom Half / Mobile Full - Horizontal Scrolling */}
          <div
            ref={horizontalScrollRef}
            className="flex-1 md:h-1/2 w-full bg-gray-50 overflow-x-auto overflow-y-hidden relative z-10"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
            onScroll={handleHorizontalScroll}
          >
            {/* Scroll Indicator and Progress */}
            {!isHorizontalScrollComplete && (
              <>
                <div className="absolute top-4 right-4 z-20 bg-[#791E75]/80 text-white px-3 py-2 rounded-full text-sm font-medium animate-pulse">
                  Scroll right to continue →
                </div>
                <div className="absolute bottom-4 left-4 right-4 z-20">
                  <div className="bg-gray-200/50 h-1 rounded-full">
                    <div 
                      className="bg-[#791E75] h-1 rounded-full transition-all duration-300"
                      style={{ width: `${(horizontalScrollRef.current ? (horizontalScrollRef.current.scrollLeft / (horizontalScrollRef.current.scrollWidth - horizontalScrollRef.current.clientWidth)) : 0) * 100}%` }}
                    />
                  </div>
                </div>
              </>
            )}
            
            <div className="h-full flex snap-x snap-mandatory z-30 relative">
              
              {/* Panel 1 - Established Heritage */}
              <div className="h-full flex-shrink-0 bg-white snap-center flex items-center justify-center px-6 md:px-8 py-8 md:py-0 w-[85vw] md:w-[50vw]">
                <div className="max-w-lg md:max-w-2xl px-4">
                  <h2 className="text-xl sm:text-2xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-3 md:mb-6 leading-tight tracking-tight">
                    Established Heritage,
                    <br />
                    Modern Expertise
                  </h2>
                  <p className="text-sm sm:text-base md:text-lg text-gray-800 leading-relaxed font-medium">
                    Since 1988, John Barclay Estate & Management has delivered expert London property services built on discretion, professionalism, and unwavering quality.
                  </p>
                </div>
              </div>
              
              {/* Panel 2 - Local Expertise */}
              <div className="h-full flex-shrink-0 bg-white snap-center flex items-center justify-center px-6 md:px-8 w-[85vw] md:w-[50vw]">
                  <div className="max-w-lg md:max-w-2xl px-4">
                    <h4 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4 md:mb-6 leading-tight tracking-tight">
                      Local expertise defines our advantage.
                    </h4>
                    <p className="text-base md:text-lg lg:text-xl text-gray-700 leading-relaxed font-medium">
                      From Bayswater to St John's Wood, Ladbroke Grove to Kensal Rise, our decades of local expertise extend beyond property values to communities, transport, and lifestyle.
                    </p>
                  </div>
                </div>

                {/* Panel 3 - Modern Innovation - Full Width */}
                <div className="h-full flex-shrink-0 bg-gray-100 snap-center flex items-center justify-center px-6 md:px-8 w-[85vw] md:w-[80vw]">
                  <div className="max-w-lg md:max-w-2xl px-4">
                    <h4 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4 md:mb-6 leading-tight tracking-tight">
                      Modern innovation enhances our established practices.
                    </h4>
                    <p className="text-lg md:text-xl text-gray-700 leading-relaxed font-medium">
                      Our values remain constant while our methods evolve. We blend traditional relationship-building with modern market analysis, strategic negotiation with technology, and AI-powered property search.
                    </p>
                  </div>
                </div>

                {/* Panel 4 - Comprehensive Service - Full Width */}
                <div className="h-full flex-shrink-0 bg-white snap-center flex items-center justify-center px-6 md:px-8 w-[85vw] md:w-[80vw]">
                  <div className="max-w-lg md:max-w-2xl px-4">
                    <h4 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 mb-4 md:mb-6 leading-tight tracking-tight">
                      Our comprehensive service reflects integrated expertise.
                    </h4>
                    <p className="text-lg md:text-xl text-gray-700 leading-relaxed font-medium">
                      Our skilled team and in-house contractors deliver seamless solutions for vendors, investors, and tenants, with attention to detail that exceeds expectations.
                    </p>
                  </div>
                </div>

                {/* Panel 5 - Closing Statement - Full Width */}
                <div className="h-full flex-shrink-0 bg-[#791E75] text-white snap-center flex items-center justify-center px-6 md:px-8 w-[85vw] md:w-[80vw]">
                  <div className="max-w-lg md:max-w-2xl px-4">
                    <p className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold leading-relaxed italic tracking-tight">
                      At John Barclay Estate & Management, established heritage meets modern expertise—delivering truly personal service and exceptional results for over 35 years.
                    </p>
                  </div>
                </div>

                {/* Panel 6 - Company Stats */}
                <div className="h-full flex-shrink-0 bg-white w-[85vw] md:w-[400px]">
                  <div className="p-6 md:p-8 h-full flex flex-col justify-center">
                    <div className="space-y-6 md:space-y-8">
                      <div className="text-center">
                        <div className="text-5xl font-black text-[#791E75]">35+</div>
                        <div className="text-sm text-gray-600 uppercase tracking-widest font-bold">Years Since 1988</div>
                      </div>
                      <div className="text-center">
                        <div className="text-5xl font-black text-[#791E75]">1000+</div>
                        <div className="text-sm text-gray-600 uppercase tracking-widest font-bold">Properties Across London</div>
                      </div>
                      <div className="text-center">
                        <div className="text-5xl font-black text-[#791E75]">24/7</div>
                        <div className="text-sm text-gray-600 uppercase tracking-widest font-bold">Support Always Available</div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>
        </div>

      </section>

      {/* Logo Placeholder Animation - Appears between properties and history sections */}
      <div
        ref={propertiesLogoPlaceholderRef}
        className="fixed top-0 left-0 w-full h-screen flex flex-col items-center justify-center bg-white"
        style={{ zIndex: 25 }}
      >
        <div className="logo-reveal-container">
          <img
            src={heroLogo}
            alt="John Barclay Estate & Management"
            className="w-auto h-32 sm:h-40 md:h-48 lg:h-64 max-w-[80vw] object-contain"
            style={{ filter: 'brightness(0) saturate(100%) invert(27%) sepia(51%) saturate(2878%) hue-rotate(262deg) brightness(94%) contrast(97%)' }}
          />
        </div>
      </div>

      {/* Properties Section - Unified Sales, Rentals, and Commercial */}
      <section
        ref={propertiesRef}
        className="fixed top-0 left-0 w-full min-h-screen bg-gray-900 overflow-hidden"
        style={{ zIndex: 20, perspective: '1000px' }}
        data-testid="section-properties"
      >
        {/* John Barclay Logo */}
        <div className="absolute top-4 left-0 right-0 z-50 px-4 flex justify-center">
          <img
            ref={propertiesLogoRef}
            src={heroLogo}
            alt="John Barclay Estate & Management"
            className="h-24 sm:h-32 md:h-40 lg:h-48 w-auto max-w-[200px] sm:max-w-[400px] md:max-w-[500px] lg:max-w-[700px] object-contain opacity-85 hover:opacity-100 transition-opacity duration-300"
            style={{ filter: 'invert(1) brightness(0) saturate(100%) invert(1)' }}
          />
        </div>

        {/* Three Verticals Container */}
        <div className="absolute inset-0 flex flex-col md:flex-row">
          
          {/* Left Vertical - Sales - Enters from left */}
          <div 
            ref={salesVerticalRef}
            className="flex-1 relative bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${salesLeftImage})`,
              backgroundPosition: "center"
            }}
            data-testid="vertical-sales"
          >
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-6 py-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">SALES</h2>
              <p className="text-sm sm:text-base md:text-lg text-white/90 max-w-md mb-6 md:mb-8">
                Expert sales services in prime London locations with personalized approach and market expertise
              </p>
              <Link href="/sales">
                <Button
                  size="lg"
                  className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3"
                  data-testid="button-sales"
                >
                  Go to Sales
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Middle Vertical - Rentals - Enters from top */}
          <div 
            ref={rentalsVerticalRef}
            className="flex-1 relative bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${rentalsLeftImage})`,
              backgroundPosition: "center"
            }}
            data-testid="vertical-rentals"
          >
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-6 py-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">RENTALS</h2>
              <p className="text-sm sm:text-base md:text-lg text-white/90 max-w-md mb-6 md:mb-8">
                Comprehensive lettings and property management services with 24/7 support and maintenance
              </p>
              <Link href="/rentals">
                <Button
                  size="lg"
                  className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3"
                  data-testid="button-rentals"
                >
                  Go to Rentals
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Right Vertical - Commercial - Enters from right */}
          <div 
            ref={commercialVerticalRef}
            className="flex-1 relative bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${commercialLeftImage})`,
              backgroundPosition: "center"
            }}
            data-testid="vertical-commercial"
          >
            <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-6 py-12">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 md:mb-6">COMMERCIAL</h2>
              <p className="text-sm sm:text-base md:text-lg text-white/90 max-w-md mb-6 md:mb-8">
                Strategic commercial property solutions for businesses across Central and West London
              </p>
              <Link href="/commercial">
                <Button
                  size="lg"
                  className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3"
                  data-testid="button-commercial"
                >
                  Go to Commercial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* Team Section - Full Width Layout */}
      <section ref={teamRef} className="fixed top-0 left-0 w-full h-screen overflow-y-auto md:overflow-hidden bg-gradient-to-br from-gray-900 to-gray-800" style={{ zIndex: 60, perspective: '1000px' }}>

        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0 bg-gradient-to-r from-[#D4A04F]/20 via-transparent to-[#D4A04F]/20"></div>
        </div>
        
        <div className="relative z-10 h-auto md:h-full flex flex-col justify-start md:justify-center items-center">
          {/* Title Section */}
          <div ref={teamTitleRef} className="text-center py-6 md:py-12 px-6 mt-10 md:mt-20">
            <h2 className="text-3xl md:text-5xl lg:text-7xl font-bold text-white mb-4 md:mb-6">Meet Our Team</h2>
            <p className="text-xl text-white/80 max-w-4xl mx-auto">
              Our experienced professionals are dedicated to providing exceptional service
              and expertise in the London property market
            </p>
          </div>

          {/* Team Cards - Horizontal Scroll on Mobile, Grid on Desktop */}
          <div ref={teamContainerRef} className="flex-1 px-4 md:px-8 pb-32 md:pb-12 relative">
            {/* Mobile Scroll Indicator */}
            {!isTeamScrollComplete && (
              <div className="md:hidden absolute top-0 right-4 z-20 bg-[#D4A04F]/80 text-white px-3 py-2 rounded-full text-sm font-medium animate-pulse">
                Swipe left to see all team →
              </div>
            )}
            
            <div 
              ref={teamHorizontalScrollRef}
              className="flex overflow-x-auto md:overflow-visible md:flex-row gap-4 md:gap-8 md:justify-center md:items-center max-w-none snap-x snap-mandatory md:snap-none"
              onScroll={handleTeamHorizontalScroll}
              style={{
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                WebkitOverflowScrolling: 'touch'
              }}>
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  className="team-card group relative w-72 sm:w-80 md:w-80 h-auto md:h-[768px] min-h-[500px] md:min-h-[600px] flex-shrink-0 snap-center md:snap-none transform transition-all duration-500 hover:scale-105"
                >
                  {/* Sophisticated Background with Gradient */}
                  <div className="relative bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl rounded-3xl border border-white/20 group-hover:border-[#D4A04F]/50 transition-all duration-500 overflow-hidden h-full">
                    
                    {/* Animated background glow on hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[#D4A04F]/10 via-[#D4A04F]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    
                    {/* Profile Section */}
                    <div className="relative z-10 p-8 h-full flex flex-col">
                      <div className="relative mb-8">
                        {/* Profile Image with Elegant Frame */}
                        <div className="relative w-48 h-48 mx-auto">
                          {/* Outer decorative ring */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#D4A04F] via-[#E6B366] to-[#D4A04F] p-1 group-hover:scale-110 transition-transform duration-500">
                            <div className="w-full h-full rounded-full bg-gray-900 p-1">
                              <img
                                src={member.image}
                                alt={member.name}
                                className="w-full h-full object-cover rounded-full"
                              />
                            </div>
                          </div>

                          {/* Floating accent */}
                          <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-[#D4A04F] to-[#E6B366] rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        </div>
                      </div>

                      {/* Content Section - flexible */}
                      <div className="text-center flex-grow flex flex-col justify-between">
                        {/* Top content group */}
                        <div className="space-y-4">
                          {/* Name with enhanced typography */}
                          <div>
                            <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-[#D4A04F] transition-colors duration-300">{member.name}</h3>
                            <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-[#D4A04F] to-transparent mx-auto opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
                          </div>

                          {/* Role with sophisticated styling */}
                          <p className="text-[#D4A04F] text-base font-semibold tracking-wide uppercase">
                            {member.role}
                          </p>

                          {/* Description with better spacing */}
                          <p className="text-white/80 text-sm leading-relaxed px-2">
                            {member.description}
                          </p>
                        </div>

                        {/* Enhanced Contact Button - at bottom */}
                        <div className="pt-6">
                          <a 
                            href={`https://wa.me/${member.whatsapp.replace('+', '')}?text=Hi%20${member.name.replace(' ', '%20')}%2C%20I%20have%20a%20property%20enquiry.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group/btn inline-flex items-center justify-center bg-gradient-to-r from-[#25D366] to-[#20b954] hover:from-[#20b954] hover:to-[#1da851] text-white px-6 py-3 rounded-full transition-all duration-300 text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                          >
                            <MessageCircle className="mr-2 h-4 w-4 group-hover/btn:scale-110 transition-transform duration-300" />
                            Contact Me
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Group Team Photo Card - Enhanced Design */}
              <div className="team-card group relative w-72 sm:w-80 md:w-80 h-auto md:h-[768px] min-h-[500px] md:min-h-[600px] flex-shrink-0 snap-center md:snap-none transform transition-all duration-500 hover:scale-105">
                {/* Sophisticated Background */}
                <div className="relative bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl rounded-3xl border border-white/20 group-hover:border-[#D4A04F]/50 transition-all duration-500 overflow-hidden h-full">
                  
                  {/* Animated background glow on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-[#D4A04F]/10 via-[#D4A04F]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  
                  {/* Team Photo Section */}
                  <div className="relative z-10 p-8 h-full flex flex-col">
                    <div className="relative mb-8">
                      {/* Team Photo with Elegant Frame */}
                      <div className="relative w-full h-48 mx-auto">
                        {/* Outer decorative border */}
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#D4A04F] via-[#E6B366] to-[#D4A04F] p-1 group-hover:scale-105 transition-transform duration-500">
                          <div className="w-full h-full rounded-xl bg-gray-900 p-1">
                            <img 
                              src={lettingsTeam} 
                              alt="John Barclay Lettings Team"
                              className="w-full h-full object-cover rounded-lg"
                            />
                          </div>
                        </div>
                        
                        {/* Floating accent elements */}
                        <div className="absolute -top-2 -right-2 w-4 h-4 bg-gradient-to-br from-[#D4A04F] to-[#E6B366] rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                        <div className="absolute -bottom-2 -left-2 w-3 h-3 bg-gradient-to-br from-[#D4A04F] to-[#B8903E] rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
                      </div>
                    </div>
                    
                    {/* Content Section */}
                    <div className="text-center space-y-4 flex-grow flex flex-col justify-between">
                      {/* Team Name with enhanced typography */}
                      <div>
                        <h3 className="text-2xl font-bold text-white mb-1 group-hover:text-[#D4A04F] transition-colors duration-300">Our Lettings Team</h3>
                        <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-[#D4A04F] to-transparent mx-auto opacity-50 group-hover:opacity-100 transition-opacity duration-300"></div>
                      </div>
                      
                      {/* Tagline with sophisticated styling */}
                      <p className="text-[#D4A04F] text-base font-semibold tracking-wide uppercase">
                        Complete Property Solutions
                      </p>
                      
                      {/* Description with better spacing */}
                      <p className="text-white/80 text-sm leading-relaxed px-2">
                        Working together to provide comprehensive lettings, sales, and property management 
                        services across Central, North West and West London.
                      </p>
                      
                      {/* Enhanced Contact Button */}
                      <div className="pt-4">
                        <a 
                          href="https://wa.me/442077240000?text=Hi%20John%20Barclay%2C%20I%20have%20a%20property%20enquiry."
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group/btn inline-flex items-center justify-center bg-gradient-to-r from-[#25D366] to-[#20b954] hover:from-[#20b954] hover:to-[#1da851] text-white px-6 py-3 rounded-full transition-all duration-300 text-sm font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
                        >
                          <MessageCircle className="mr-2 h-4 w-4 group-hover/btn:scale-110 transition-transform duration-300" />
                          Contact Our Team
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </section>


      {/* Contact Section */}
      <section ref={contactRef} className="fixed top-0 left-0 w-full min-h-screen" style={{ zIndex: 70 }}>
        <ContactSection />

      </section>
      
      {/* Back to Top Arrow */}
      <BackToTopArrow currentSection={currentSection} />

      {/* Mobile Navigation */}
      <MobileNavigation />

      {/* Social Media Buttons */}
      {SocialMediaButtons}
      
      {/* Right-side Navigation Indicator - Hide on mobile, add backdrop for visibility */}
      <div className="hidden md:flex fixed right-8 top-1/2 -translate-y-1/2 z-[80] flex-col gap-3 bg-gray-900/60 backdrop-blur-sm p-3 rounded-lg">
        {sections.map((section, index) => {
          const isActive = currentSection === index;
          const sectionNames = {
            hero: 'HOME',
            history: 'HISTORY', 
            properties: 'PROPERTIES',
            team: 'TEAM',
            contact: 'CONTACT'
          };
          
          return (
            <div key={section} className="relative group">
              {/* Section Label */}
              <div className={`absolute right-full mr-4 top-1/2 -translate-y-1/2 px-3 py-1 text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                isActive
                  ? 'text-[#D4A04F] opacity-100 scale-100'
                  : 'text-white/50 opacity-80 group-hover:opacity-100 group-hover:text-white/80 scale-95 group-hover:scale-100'
              }`}>
                {sectionNames[section as keyof typeof sectionNames]}
              </div>
              
              {/* Navigation Dot - Larger and more visible */}
              <button
                onClick={() => navigateToSection(index)}
                className={`w-5 h-5 rounded-full border-2 transition-all duration-300 hover:scale-125 ${
                  isActive
                    ? 'bg-[#D4A04F] border-[#D4A04F] scale-125 shadow-lg shadow-[#D4A04F]/50'
                    : currentSection === 1
                      ? 'bg-transparent border-gray-700/60 hover:border-gray-800/80 hover:bg-gray-700/20'
                      : 'bg-transparent border-white/40 hover:border-white/80 hover:bg-white/20'
                }`}
                aria-label={`Go to ${section} section`}
              />
              
              {/* Connection Line */}
              {index < sections.length - 1 && (
                <div className={`absolute top-full left-1/2 -translate-x-1/2 w-0.5 h-6 transition-colors duration-300 ${
                  currentSection > index
                    ? 'bg-[#D4A04F]'
                    : currentSection === 1
                      ? 'bg-gray-700/40'
                      : 'bg-white/20'
                }`} />
              )}
            </div>
          );
        })}
        
      </div>

      {/* Floating Bubbles - AI Search and Help Chat */}
      <AISearchBubble />
      <PropertyChatInterface />

    </div>
  );
};

export default EstateAgentHome;