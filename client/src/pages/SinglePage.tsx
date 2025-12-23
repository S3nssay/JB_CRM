import { useState, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';
import Header from '@/components/Header';
import FAQSection from '@/components/FAQ';
import videoBackground from '@/assets/Video_Transition_Homes_to_Flats.mp4';
import { getPropertyPriceInfo } from '@/lib/addressService';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// Forms and Validation
import SimpleHpiForm from '@/components/SimpleHpiForm';
import { PropertyValuationFormData } from '@shared/schema';

// Icons
import { 
  CheckCircle2, 
  Clock,
  PoundSterling,
  ShieldCheck,
  Home,
  Briefcase,
  Users,
  BarChart,
  ArrowRight,
  HeartHandshake,
  Truck,
  Building,
  FileText,
  Plane,
  UserCheck,
  SplitSquareVertical,
  AlertTriangle,
  Leaf,
  BookOpen,
  Banknote,
  HourglassIcon,
  HomeIcon,
  Award,
  BadgeCheck,
  Medal
} from 'lucide-react';

const SinglePage = () => {
  // State for managing form submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [valuationData, setValuationData] = useState<any>(null);
  const [propertyId, setPropertyId] = useState<number | null>(null);
  
  // Refs for scrolling to sections
  const valuationFormRef = useRef<HTMLDivElement>(null);
  const valuationResultRef = useRef<HTMLDivElement>(null);
  const solutionsRef = useRef<HTMLDivElement>(null);
  const reasonsRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const faqRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();

  // Navigation scroll functions
  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const navigationHandlers = {
    howItWorks: () => scrollToSection(howItWorksRef),
    benefits: () => scrollToSection(benefitsRef),
    testimonials: () => scrollToSection(solutionsRef), // Using solutions as testimonials section
    faq: () => scrollToSection(faqRef)
  };

  // Handler for simplified HPI form submission
  const handlePropertyValuation = async (data: any) => { // Accept any data type for form flexibility
    setIsSubmitting(true);
    
    try {
      console.log("Form data submitted:", data);
      
      // Use our new contact form endpoint
      const response = await apiRequest('/api/contact-form', 'POST', {
        addressLine1: data.addressLine1,
        postcode: data.postcode,
        propertyType: data.propertyType,
        bedrooms: data.bedrooms,
        email: data.email,
        phone: data.phone,
        name: 'Potential Customer' // Default name
      });
      
      if (!response || !response.success) {
        throw new Error('Failed to process valuation');
      }
      
      toast({
        title: "Valuation sent!",
        description: "Our team of professional valuers will be in touch with the best market value of your property within 24 hours.",
        variant: "default",
        duration: 7000,
      });
      
      // Reset form after successful submission
      setIsSubmitting(false);
      return;
      
      // The following code is left in place but won't execute (we're returning early)
      // This preserves your existing logic in case you want to revert back
      
      // Original code:
      const { priceInfo, offerDetails } = { 
        priceInfo: response.priceInfo, 
        offerDetails: response.offerDetails 
      };
      
      if (!priceInfo) {
        throw new Error('Could not get property valuation estimate');
      }
      
      // Create property
      const property = await apiRequest('/api/properties', 'POST', {
        postcode: data.postcode,
        addressLine1: data.addressLine1,
        town: data.town,
        propertyType: data.propertyType,
        bedrooms: parseInt(data.bedrooms),
        condition: data.condition,
        hasExtensions: data.hasExtensions,
        extensionDetails: data.extensionDetails || null,
        hasAlterations: data.hasAlterations,
        alterationDetails: data.alterationDetails || null,
        exchangeTimeframe: data.exchangeTimeframe
      });
      
      // Create contact
      const contact = await apiRequest('/api/contacts', 'POST', {
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        timeframe: data.timeframe,
        propertyId: property.id
      });
      
      // Use the API-provided values
      const estimatedValue = priceInfo.averagePrice;
      // Use the exact offer price if available, otherwise use the minOffer as a fallback
      const offerValue = offerDetails?.offerPrice || priceInfo.minOffer;
      
      const valuation = await apiRequest('/api/valuations', 'POST', {
        propertyId: property.id,
        contactId: contact.id,
        estimatedValue,
        offerValue,
        status: 'pending'
      });
      
      // Send SMS notification with the valuation result instead of showing it on the page
      await apiRequest('/api/valuation-request', 'POST', {
        propertyId: property.id,
        contactId: contact.id,
        address: `${data.addressLine1}, ${data.town}, ${data.postcode}`,
        marketValue: estimatedValue,
        offerPrice: offerValue,
        discountAmount: estimatedValue - offerValue,
        discountPercentage: 15,
        phoneNumber: data.phone,
        customerName: data.fullName
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['/api/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/valuations'] });
      
      // Show success message
      toast({
        title: "Valuation request submitted",
        description: "Thank you! We've sent your property valuation details via SMS. One of our property specialists will call you within 24 hours to discuss your valuation and answer any questions.",
      });
      
      // No need to reset form since we'll reload the page
      
      // Scroll to the top of the page
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error) {
      toast({
        title: "Error",
        description: "There was a problem processing your valuation request. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  // Helper function to calculate estimated value
  const calculateEstimatedValue = (propertyType: string, bedrooms: string, condition: string) => {
    let baseValue = 0;
    
    // Base value by property type
    switch (propertyType) {
      case 'detached':
        baseValue = 350000;
        break;
      case 'semi-detached':
        baseValue = 275000;
        break;
      case 'terraced':
        baseValue = 225000;
        break;
      case 'flat':
        baseValue = 200000;
        break;
      case 'bungalow':
        baseValue = 300000;
        break;
      default:
        baseValue = 250000;
    }
    
    // Adjust for bedrooms
    let bedroomMultiplier = 1.0;
    switch (bedrooms) {
      case '1':
        bedroomMultiplier = 0.8;
        break;
      case '2':
        bedroomMultiplier = 1.0;
        break;
      case '3':
        bedroomMultiplier = 1.2;
        break;
      case '4':
        bedroomMultiplier = 1.4;
        break;
      case '5+':
        bedroomMultiplier = 1.6;
        break;
    }
    
    // Adjust for condition
    let conditionMultiplier = 1.0;
    switch (condition) {
      case 'good':
        conditionMultiplier = 1.1;
        break;
      case 'average':
        conditionMultiplier = 1.0;
        break;
      case 'needs_work':
        conditionMultiplier = 0.85;
        break;
    }
    
    return Math.floor(baseValue * bedroomMultiplier * conditionMultiplier);
  };

  // Render valuation result if available
  const renderValuationResult = () => {
    if (!valuationData) return null;
    
    const { valuation } = valuationData;
    
    return (
      <div ref={valuationResultRef} className="bg-neutral-50 py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-white rounded-xl shadow-lg p-6 md:p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold text-primary mb-2">Your Property Valuation</h2>
              <p className="text-neutral-600">Based on the information you provided</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-neutral-50 p-6 rounded-lg">
                <h3 className="text-lg font-semibold text-primary mb-2">Market Value</h3>
                <p className="text-3xl font-bold text-neutral-800 mb-4">
                  {formatCurrency(valuation.estimatedValue)}
                </p>
                <div className="text-sm text-neutral-600">
                  <p>On average, properties similar to yours sell within 6-9 months through the traditional market.</p>
                </div>
              </div>
              
              <div className="bg-accent bg-opacity-10 p-6 rounded-lg border-2 border-accent">
                <h3 className="text-lg font-semibold text-accent mb-2">Our Cash Offer</h3>
                <p className="text-3xl font-bold text-accent mb-4">
                  {formatCurrency(valuation.offerValue)}
                </p>
                <div className="text-sm text-neutral-600">
                  <p className="font-medium text-accent mb-2">Complete in as little as 7-28 days</p>
                  <ul className="space-y-1">
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-[#791E75]500" />
                      <span>No estate agent fees</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-[#791E75]500" />
                      <span>No chain complications</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-[#791E75]500" />
                      <span>No viewings or repairs needed</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <p className="mb-4">Interested in our cash offer? Our property specialists will contact you shortly to discuss next steps.</p>
              <Button 
                size="lg" 
                className="bg-accent hover:bg-accent-light"
                onClick={() => {
                  if (solutionsRef.current) {
                    solutionsRef.current.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
              >
                Learn more about our process
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <Header navigationHandlers={navigationHandlers} />
      {/* Hero Section with Video Background */}
      <section className="py-24 md:py-32 px-4 text-white relative overflow-hidden">
        {/* Video Background */}
        <video
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          src={videoBackground}
        />
        
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-[#0E6BFF]/10"></div>
        
        <div className="container mx-auto relative z-10">
          <div className="text-center max-w-5xl mx-auto">
            <h1 className="font-inter text-5xl md:text-[65px] font-bold mb-10 text-white bg-black bg-opacity-30 px-6 py-4 rounded-lg">
              Sell your Property Fast, <span className="text-[#F7EF81]">Get Paid in 7 Days</span>
            </h1>
            
            <p className="font-roboto text-xl md:text-2xl mb-12 max-w-4xl mx-auto text-white font-bold bg-black bg-opacity-50 px-6 py-4 rounded-lg">
              Get a guaranteed fair cash offer based off the best valuation price of your property
            </p>
          </div>
          
          {/* Benefits section */}
          <div className="mt-16">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
              <div className="bg-[#F7EF81] bg-opacity-50 p-4 rounded-lg flex flex-col items-center text-center">
                <Clock className="h-10 w-10 mb-3 text-[#0E6BFF]" />
                <span className="font-semibold text-[#0E6BFF] text-xl">Fast Sale</span>
                <p className="text-sm text-[#0E6BFF] mt-1">7-28 days vs 6-9 months</p>
              </div>
              
              <div className="bg-[#F7EF81] bg-opacity-50 p-4 rounded-lg flex flex-col items-center text-center">
                <PoundSterling className="h-10 w-10 mb-3 text-[#0E6BFF]" />
                <span className="font-semibold text-[#0E6BFF] text-xl">Cash Buyers</span>
                <p className="text-sm text-[#0E6BFF] mt-1">No chain delays</p>
              </div>
              
              <div className="bg-[#F7EF81] bg-opacity-50 p-4 rounded-lg flex flex-col items-center text-center">
                <ShieldCheck className="h-10 w-10 mb-3 text-[#0E6BFF]" />
                <span className="font-semibold text-[#0E6BFF] text-xl">No Fees</span>
                <p className="text-sm text-[#0E6BFF] mt-1">Zero agent fees</p>
              </div>
              
              <div className="bg-[#F7EF81] bg-opacity-50 p-4 rounded-lg flex flex-col items-center text-center">
                <Building className="h-10 w-10 mb-3 text-[#0E6BFF]" />
                <span className="font-semibold text-[#0E6BFF] text-xl">Any Condition</span>
                <p className="text-sm text-[#0E6BFF] mt-1">No repairs needed</p>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Full-width Valuation Form Section */}
      <section id="valuationForm" ref={valuationFormRef} className="py-14 bg-white shadow-inner border-t border-b border-gray-100">
        <div className="container mx-auto max-w-4xl px-4">
          <div className="text-center mb-8">
            <h2 className="font-inter text-3xl font-bold text-[#0E6BFF]">Get Your Free Property Valuation</h2>
            <p className="text-lg text-gray-600 mt-2">Based on official UK Land Registry data</p>
          </div>
          <div className="bg-white p-8 rounded-xl shadow-lg border-2 border-[#0E6BFF]">
            <SimpleHpiForm onSubmit={handlePropertyValuation} isSubmitting={isSubmitting} />
          </div>
        </div>
      </section>
      
      {/* Render valuation result if available */}
      {valuationData && renderValuationResult()}
      
      {/* Benefits of Quick Sale */}
      <section ref={benefitsRef} className="py-16 md:py-24 px-4 bg-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="font-inter text-4xl font-bold text-[#0E6BFF] mb-6">The Benefits of a Quick Cash Sale</h2>
            <p className="font-roboto text-base md:text-lg max-w-3xl mx-auto">
              Choosing a quick cash sale offers numerous advantages over the traditional property market, especially if you need to sell your property promptly.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-[#F7EF81] border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="mb-6 text-[#0E6BFF]">
                  <Clock className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-[#0E6BFF]">Speed and Certainty</h3>
                <p className="text-[#0E6BFF]">
                  Eliminate the uncertainties of lengthy chains and potential buyer financing issues. A <strong>Fast Sale</strong> with <strong>Cash Buyers</strong> ensures a faster and more reliable transaction.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-[#F7EF81] border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="mb-6 text-[#0E6BFF]">
                  <PoundSterling className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-[#0E6BFF]">No Cost to you</h3>
                <p className="text-[#0E6BFF]">
                  We will buy your property at <strong>No Fees</strong> to you. Avoid estate agent commissions, ongoing mortgage payments, utility bills, and council tax during a prolonged sale period.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-[#F7EF81] border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="mb-6 text-[#0E6BFF]">
                  <HeartHandshake className="h-10 w-10" />
                </div>
                <h3 className="text-xl font-bold mb-4 text-[#0E6BFF]">Convenience</h3>
                <p className="text-[#0E6BFF]">
                  Sell your property in <strong>Any Condition</strong> without the need for repairs, renovations, staging, or accommodating dozens of viewings.
                </p>
              </CardContent>
            </Card>
          </div>
          
          <div ref={howItWorksRef} className="text-center mb-12 mt-16">
            <h2 className="font-inter text-4xl font-bold text-[#0E6BFF] mb-6">Our Simple 4-Step Process</h2>
            <p className="font-roboto text-base md:text-lg max-w-3xl mx-auto">
              We're completely transparent throughout the process of buying your home. Here's how it works:
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <Card className="bg-[#F7EF81] border-0 shadow-lg h-full">
              <CardContent className="pt-6">
                <div className="mb-6 text-[#0E6BFF]">
                  <FileText className="h-10 w-10" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">1</div>
                  <h3 className="text-xl font-bold text-[#0E6BFF]">Free Valuation</h3>
                </div>
                <p className="text-[#0E6BFF]">
                  Complete our online form for an instant property valuation without any obligation.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-[#F7EF81] border-0 shadow-lg h-full">
              <CardContent className="pt-6">
                <div className="mb-6 text-[#0E6BFF]">
                  <PoundSterling className="h-10 w-10" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">2</div>
                  <h3 className="text-xl font-bold text-[#0E6BFF]">Cash Offer</h3>
                </div>
                <p className="text-[#0E6BFF]">
                  We'll provide a competitive cash offer for your property with no commitment required.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-[#F7EF81] border-0 shadow-lg h-full">
              <CardContent className="pt-6">
                <div className="mb-6 text-[#0E6BFF]">
                  <Briefcase className="h-10 w-10" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">3</div>
                  <h3 className="text-xl font-bold text-[#0E6BFF]">Legal Process</h3>
                </div>
                <p className="text-[#0E6BFF]">
                  We handle all the necessary legal and survey processes for you, making it stress-free.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-[#F7EF81] border-0 shadow-lg h-full">
              <CardContent className="pt-6">
                <div className="mb-6 text-[#0E6BFF]">
                  <Banknote className="h-10 w-10" />
                </div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-xs">4</div>
                  <h3 className="text-xl font-bold text-[#0E6BFF]">Completion</h3>
                </div>
                <p className="text-[#0E6BFF]">
                  Receive your funds and complete the sale in as little as 7 days - much faster than traditional sales.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
      
      {/* Tailored Solutions */}
      <section ref={solutionsRef} className="py-16 md:py-24 px-4 bg-neutral-50">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0E6BFF] mb-6">Tailored Solutions for Different Sellers</h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
              Our quick property buying service caters to the unique needs of different property owners and professionals in the real estate market.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {/* First Row of Cards */}
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <Briefcase className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">For Landlords</h3>
              <p className="text-[#8D97A5] text-lg">
                Changing regulations, increased taxation, and rising interest rates have made property management more challenging. Selling quickly allows you to liquidate assets and reallocate resources efficiently.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <Users className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">For Estate Agents</h3>
              <p className="text-[#8D97A5] text-lg">
                Collaborating with a quick sale service can help resolve broken chains and expedite sales, enhancing client satisfaction and turnover.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <Home className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">For Property Owners</h3>
              <p className="text-[#8D97A5] text-lg">
                We are committed to providing a fair, transparent, and efficient selling process. Our goal is to ensure mutual success and satisfaction without the typical hassles of the traditional market.
              </p>
            </div>
          </div>
          
          {/* Second Row with Benefits */}
          <div className="grid md:grid-cols-3 gap-8 mt-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-[#791E75]500 flex-shrink-0 mt-0.5" />
                  <span>No tenancy issues or vacant property costs</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-[#791E75]500 flex-shrink-0 mt-0.5" />
                  <span>Avoid new EPC and compliance regulations</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-[#791E75]500 flex-shrink-0 mt-0.5" />
                  <span>Rescue deals affected by chain breakdowns</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-[#791E75]500 flex-shrink-0 mt-0.5" />
                  <span>Referral opportunities for hard-to-sell properties</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <ul className="space-y-2">
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-[#791E75]500 flex-shrink-0 mt-0.5" />
                  <span>No viewings, repairs, or staging needed</span>
                </li>
                <li className="flex items-start">
                  <CheckCircle2 className="h-5 w-5 mr-2 text-[#791E75]500 flex-shrink-0 mt-0.5" />
                  <span>Dedicated support throughout the entire process</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-10 text-center">
            <p className="text-sm text-neutral-500 italic">
              Please note: The information provided is for general guidance. Individual circumstances may vary, and it's advisable to seek professional advice tailored to your situation.
            </p>
          </div>
        </div>
      </section>
      
      {/* Compare Cash Sale to Traditional Estate Agent Route */}
      <section className="py-16 md:py-24 px-4 bg-white">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0E6BFF] mb-6">Compare Cash Sale to Traditional Estate Agent Route</h2>
            <p className="text-lg text-neutral-600 max-w-3xl mx-auto">
              See how our cash buying service compares financially to the traditional estate agent route when selling a £100,000 property.
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse shadow-xl">
              <thead>
                <tr className="bg-[#0E6BFF] text-white">
                  <th className="py-6 px-6 text-left font-semibold border-b border-[#C9CFD5]">Comparison</th>
                  <th className="py-6 px-6 text-center font-semibold border-b border-[#C9CFD5]">Traditional Estate Agent</th>
                  <th className="py-6 px-6 text-center font-semibold border-b border-[#C9CFD5] bg-[#0846a3]">Our Cash Purchase</th>
                </tr>
              </thead>
              <tbody>
                <tr className="even:bg-[#C9CFD5] bg-white">
                  <td className="py-4 px-6 border-b border-[#C9CFD5] font-medium text-[#8D97A5]">Original advertised price</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£107,000</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center bg-[#C9CFD5] bg-opacity-30 text-[#8D97A5]">N/A</td>
                </tr>
                <tr className="even:bg-[#C9CFD5] bg-white">
                  <td className="py-4 px-6 border-b border-[#C9CFD5] font-medium text-[#8D97A5]">True market value</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£100,000</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center bg-[#C9CFD5] bg-opacity-30 text-[#8D97A5]">£100,000</td>
                </tr>
                <tr className="even:bg-[#C9CFD5] bg-white">
                  <td className="py-4 px-6 border-b border-[#C9CFD5] font-medium text-[#8D97A5]">Agreed sale price</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£94,000</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center bg-[#C9CFD5] bg-opacity-30 text-[#8D97A5]">£85,000</td>
                </tr>
                <tr className="even:bg-[#C9CFD5] bg-white">
                  <td className="py-4 px-6 border-b border-[#C9CFD5] font-medium text-[#8D97A5]">Price after agent fees</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£90,710</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center bg-[#C9CFD5] bg-opacity-30 text-[#8D97A5]">£85,000</td>
                </tr>
                <tr className="even:bg-[#C9CFD5] bg-white">
                  <td className="py-4 px-6 border-b border-[#C9CFD5] font-medium text-[#8D97A5]">Price after utility bills</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£88,670</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center bg-[#C9CFD5] bg-opacity-30 text-[#8D97A5]">£85,000</td>
                </tr>
                <tr className="even:bg-[#C9CFD5] bg-white">
                  <td className="py-4 px-6 border-b border-[#C9CFD5] font-medium text-[#8D97A5]">Price after council tax</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£86,998</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center bg-[#C9CFD5] bg-opacity-30 text-[#8D97A5]">£85,000</td>
                </tr>
                <tr className="even:bg-[#C9CFD5] bg-white">
                  <td className="py-4 px-6 border-b border-[#C9CFD5] font-medium text-[#8D97A5]">Price after mortgage costs</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£84,712</td>
                  <td className="py-4 px-6 border-b border-[#C9CFD5] text-center bg-[#C9CFD5] bg-opacity-30 text-[#8D97A5]">£85,000</td>
                </tr>
                <tr className="bg-white font-bold">
                  <td className="py-5 px-6 border-b border-[#C9CFD5] text-[#0E6BFF]">Final amount you get</td>
                  <td className="py-5 px-6 border-b border-[#C9CFD5] text-center text-[#8D97A5]">£84,712</td>
                  <td className="py-5 px-6 border-b border-[#C9CFD5] text-center bg-[#F7EF81] text-[#0E6BFF]">£85,000</td>
                </tr>
              </tbody>
            </table>
          </div>
          
          <div className="mt-10 bg-[#F7EF81] p-8 rounded-lg shadow-lg">
            <h3 className="text-2xl font-semibold mb-4 text-[#0E6BFF]">Key Takeaway</h3>
            <p className="text-[#8D97A5] text-lg">
              While the initial offer through our cash purchase service may seem lower, when you factor in all the costs and time involved with a traditional sale, our service often provides comparable or better financial outcomes – with the added benefits of speed, certainty, and convenience.
            </p>
          </div>
        </div>
      </section>
      
      {/* Common Reasons for Selling */}
      <section ref={reasonsRef} className="py-20 md:py-32 px-4 bg-[#C9CFD5]/10">
        <div className="container mx-auto max-w-5xl">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-[#0E6BFF] mb-6">Why People Choose a Quick Sale</h2>
            <p className="text-xl text-white max-w-3xl mx-auto">
              Life can present unexpected situations that necessitate selling your property promptly. Here are some common reasons homeowners opt for a fast sale:
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <Plane className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Relocation</h3>
              <p className="text-[#8D97A5] text-lg">
                Whether you're moving abroad, retiring to the coast, or starting a new job in a different city, selling your home quickly can ease the transition.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <SplitSquareVertical className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Divorce or Separation</h3>
              <p className="text-[#8D97A5] text-lg">
                During challenging times, a swift and hassle-free sale can provide both parties with the financial clarity needed to move forward.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <AlertTriangle className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Environmental Concerns</h3>
              <p className="text-[#8D97A5] text-lg">
                If your property is in an area prone to flooding or other environmental risks, selling quickly can help you relocate to a safer location.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <BookOpen className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Inheritance</h3>
              <p className="text-[#8D97A5] text-lg">
                Inheriting a property can come with unforeseen responsibilities and costs. A quick sale can alleviate the burden of maintenance and legal fees.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <Building className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Facing Repossession</h3>
              <p className="text-[#8D97A5] text-lg">
                If you're at risk of repossession, selling your home swiftly can release equity and prevent further financial complications.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <Banknote className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Financial Difficulties</h3>
              <p className="text-[#8D97A5] text-lg">
                Accessing the equity tied up in your property can provide the funds needed to address pressing financial obligations.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <FileText className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Short Property Lease</h3>
              <p className="text-[#8D97A5] text-lg">
                Properties with diminishing lease terms can be challenging to sell through traditional routes. A quick sale can help you secure a fair price.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <UserCheck className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Lifestyle Changes</h3>
              <p className="text-[#8D97A5] text-lg">
                Health issues or changes in mobility might make your current home unsuitable. Selling quickly allows you to find a property that better fits your needs.
              </p>
            </div>
            
            <div className="bg-[#F7EF81] p-7 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <div className="mb-4 text-[#0E6BFF]">
                <HourglassIcon className="h-10 w-10" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-[#0E6BFF]">Time Constraints</h3>
              <p className="text-[#8D97A5] text-lg">
                When time is of the essence, our quick buying service can help you meet tight deadlines that the traditional market simply cannot accommodate.
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* CTA Section */}
      <section className="py-24 md:py-32 px-4 bg-[#0E6BFF] text-white">
        <div className="container mx-auto max-w-5xl text-center">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-8 text-white">Ready to Get Your Free Property Valuation?</h2>
          <p className="text-2xl mb-12 max-w-3xl mx-auto font-light">
            Take the first step towards a hassle-free property sale. Get your free, no-obligation cash offer today.
          </p>
          
          <Button 
            size="lg" 
            className="bg-[#F7EF81] hover:bg-[#f0e95a] text-[#0E6BFF] text-xl px-10 py-8 h-auto"
            onClick={() => {
              if (valuationFormRef.current) {
                valuationFormRef.current.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            Get Your Free Valuation Now
            <ArrowRight className="ml-3 h-6 w-6" />
          </Button>
        </div>
      </section>
      
      {/* FAQ Section */}
      <div ref={faqRef}>
        <FAQSection />
      </div>
      
      {/* Footer */}
      <footer className="bg-[#0E6BFF] text-white py-16 px-4">
        <div className="container mx-auto max-w-5xl">
          <div className="grid md:grid-cols-4 gap-10">
            <div>
              <h3 className="text-[#F7EF81] font-bold text-xl md:text-xl mb-4 break-words">Cash<wbr/>Property<wbr/>Buyers<wbr/>.uk</h3>
              <p className="text-sm md:text-base mb-6">We offer a fast, reliable way to sell your property without the hassle of the traditional market.</p>
              <div className="flex space-x-4">
                <a href="#" className="text-white hover:text-[#F7EF81] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" /></svg>
                </a>
                <a href="#" className="text-white hover:text-[#F7EF81] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" /></svg>
                </a>
                <a href="#" className="text-white hover:text-[#F7EF81] transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg>
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="text-[#F7EF81] font-semibold text-xl mb-6">Quick Links</h4>
              <ul className="space-y-3 text-base">
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">Home</a></li>
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">How It Works</a></li>
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">Testimonials</a></li>
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">Contact Us</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[#F7EF81] font-semibold text-xl mb-6">Help & Support</h4>
              <ul className="space-y-3 text-base">
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">FAQs</a></li>
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-[#F7EF81] transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-[#F7EF81] font-semibold text-xl mb-6">Contact Us</h4>
              <ul className="space-y-4 text-base">
                <li className="flex items-start">
                  <HomeIcon className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" />
                  <span>22 Bank Street, Castleford WF10 1JD</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                  </svg>
                  <span>01977 285 111</span>
                </li>
                <li className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-3 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                    <polyline points="22,6 12,13 2,6"></polyline>
                  </svg>
                  <span>support@cashpropertybuyers.uk</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-16 pt-10 border-t border-[#791E75]400 text-center">
            <p className="text-lg">&copy; {new Date().getFullYear()} CashPropertyBuyers.uk. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default SinglePage;