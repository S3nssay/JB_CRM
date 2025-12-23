import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { gsap } from 'gsap';
import { 
  Home,
  Calculator,
  TrendingUp,
  Clock,
  CheckCircle,
  MapPin,
  Star,
  Phone,
  Mail,
  Calendar,
  ArrowLeft
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import heroLogo from "@/assets/john-barclay-logo.png";
import { valuationRequestSchema, type ValuationRequestData } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function ValuationPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const heroRef = useRef(null);
  const formRef = useRef(null);
  const benefitsRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<ValuationRequestData>({
    resolver: zodResolver(valuationRequestSchema),
    defaultValues: {
      propertyType: 'house',
      bedrooms: 3,
      timeframe: 'just_curious'
    }
  });

  const submitValuation = useMutation({
    mutationFn: async (data: ValuationRequestData) => {
      const response = await apiRequest('/api/contacts', 'POST', {
        inquiryType: 'valuation',
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        propertyAddress: data.propertyAddress,
        postcode: data.postcode,
        propertyType: data.propertyType,
        bedrooms: data.bedrooms,
        message: `Valuation request - Timeframe: ${data.timeframe}`,
        timeframe: data.timeframe
      });
      return response;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      reset();
      toast({
        title: "Valuation request submitted!",
        description: "We'll be in touch within 24 hours with your free property valuation.",
      });
      // Invalidate contacts cache
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error submitting request",
        description: error.message,
        variant: "destructive",
      });
    },
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

    // Form animation
    gsap.fromTo(formRef.current, {
      opacity: 0,
      x: -50
    }, {
      opacity: 1,
      x: 0,
      duration: 1.2,
      delay: 0.3,
      ease: "power3.out"
    });

    // Benefits animation
    gsap.fromTo('.benefit-card', {
      opacity: 0,
      y: 80
    }, {
      opacity: 1,
      y: 0,
      duration: 1,
      stagger: 0.2,
      delay: 0.6,
      ease: "power3.out"
    });
  }, []);

  const onSubmit = (data: ValuationRequestData) => {
    submitValuation.mutate(data);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center px-6">
          <div className="bg-[#791E75] text-white 600 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6">
            Thank You!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Your valuation request has been submitted successfully. One of our expert valuers will contact you within 24 hours.
          </p>
          <div className="bg-slate-50 rounded-2xl p-6 mb-8 border border-slate-200">
            <h3 className="text-xl font-bold mb-4">What happens next?</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#791E75] text-white 600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">1</div>
                <span>We'll call you to discuss your property details</span>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#791E75] text-white 600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">2</div>
                <span>Schedule a convenient time for a property visit</span>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#791E75] text-white 600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">3</div>
                <span>Receive your detailed valuation report</span>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => setIsSubmitted(false)}
            className="bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white font-bold py-3 px-8 rounded-xl"
          >
            Request Another Valuation
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      
      {/* Hero Section */}
      <section ref={heroRef} className="relative py-20 px-6 overflow-hidden" style={{ backgroundColor: '#791E75' }}>
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-slate-300/20 to-slate-500/10 rounded-full blur-sm animate-float-slow"></div>
          <div className="absolute bottom-20 right-32 w-48 h-48 bg-gradient-to-br from-slate-400/15 to-[#791E75]/5 rounded-3xl rotate-45 blur-sm animate-float-reverse"></div>
        </div>
        
        {/* Navigation Buttons */}
        <div className="relative z-10 max-w-6xl mx-auto mb-8">
          <div className="flex justify-between items-center">
            <Button
              onClick={() => window.history.back()}
              className="bg-[#791E75] hover:bg-[#5d1759] text-white px-4 py-2 rounded-xl flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Link href="/">
              <Button className="bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white px-4 py-2 rounded-xl flex items-center">
                <Home className="mr-2 h-4 w-4" />
                Home
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="relative z-10 max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="mb-6">
              <img 
                src={heroLogo} 
                alt="John Barclay Estate & Management" 
                className="max-w-xl w-full h-auto mx-auto mb-4"
              />
            </div>
            <h1 className="text-5xl md:text-7xl font-black leading-none mb-6 text-white">
              FREE PROPERTY
              <span className="block text-white">VALUATION</span>
            </h1>
            <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto">
              Get an accurate, professional valuation of your property from London's luxury property experts
            </p>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16">
            
            {/* Valuation Form */}
            <div ref={formRef}>
              <div className="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm">
                <h2 className="text-3xl font-black mb-8 flex items-center text-[#5d1759]">
                  <Calculator className="h-8 w-8 text-[#791E75]600 mr-3" />
                  Get Your Free Valuation
                </h2>
                
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Property Address */}
                  <div>
                    <Label htmlFor="propertyAddress" className="text-gray-700 mb-2 block">
                      Property Address *
                    </Label>
                    <Input
                      {...register('propertyAddress')}
                      id="propertyAddress"
                      placeholder="Enter your full property address"
                      className="bg-white border-slate-300 text-gray-900 placeholder-gray-500"
                    />
                    {errors.propertyAddress && (
                      <p className="text-red-400 text-sm mt-1">{errors.propertyAddress.message}</p>
                    )}
                  </div>

                  {/* Postcode */}
                  <div>
                    <Label htmlFor="postcode" className="text-gray-700 mb-2 block">
                      Postcode *
                    </Label>
                    <Input
                      {...register('postcode')}
                      id="postcode"
                      placeholder="e.g. W2 1AA"
                      className="bg-white border-slate-300 text-gray-900 placeholder-gray-500"
                    />
                    {errors.postcode && (
                      <p className="text-red-400 text-sm mt-1">{errors.postcode.message}</p>
                    )}
                  </div>

                  {/* Property Type and Bedrooms */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700 mb-2 block">Property Type *</Label>
                      <Select onValueChange={(value) => setValue('propertyType', value as any)}>
                        <SelectTrigger className="bg-white border-slate-300 text-gray-900">
                          <SelectValue placeholder="Select property type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat</SelectItem>
                          <SelectItem value="house">House</SelectItem>
                          <SelectItem value="penthouse">Penthouse</SelectItem>
                          <SelectItem value="maisonette">Maisonette</SelectItem>
                          <SelectItem value="studio">Studio</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.propertyType && (
                        <p className="text-red-400 text-sm mt-1">{errors.propertyType.message}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-gray-700 mb-2 block">Bedrooms *</Label>
                      <Select onValueChange={(value) => setValue('bedrooms', parseInt(value))}>
                        <SelectTrigger className="bg-white border-slate-300 text-gray-900">
                          <SelectValue placeholder="Number of bedrooms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Bedroom</SelectItem>
                          <SelectItem value="2">2 Bedrooms</SelectItem>
                          <SelectItem value="3">3 Bedrooms</SelectItem>
                          <SelectItem value="4">4 Bedrooms</SelectItem>
                          <SelectItem value="5">5 Bedrooms</SelectItem>
                          <SelectItem value="6">6+ Bedrooms</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.bedrooms && (
                        <p className="text-red-400 text-sm mt-1">{errors.bedrooms.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div>
                    <Label htmlFor="fullName" className="text-gray-700 mb-2 block">
                      Full Name *
                    </Label>
                    <Input
                      {...register('fullName')}
                      id="fullName"
                      placeholder="Your full name"
                      className="bg-white border-slate-300 text-gray-900 placeholder-gray-500"
                    />
                    {errors.fullName && (
                      <p className="text-red-400 text-sm mt-1">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-gray-700 mb-2 block">
                        Email Address *
                      </Label>
                      <Input
                        {...register('email')}
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        className="bg-white border-slate-300 text-gray-900 placeholder-gray-500"
                      />
                      {errors.email && (
                        <p className="text-red-400 text-sm mt-1">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="phone" className="text-gray-700 mb-2 block">
                        Phone Number *
                      </Label>
                      <Input
                        {...register('phone')}
                        id="phone"
                        type="tel"
                        placeholder="07xxx xxx xxx"
                        className="bg-white border-slate-300 text-gray-900 placeholder-gray-500"
                      />
                      {errors.phone && (
                        <p className="text-red-400 text-sm mt-1">{errors.phone.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Timeframe */}
                  <div>
                    <Label className="text-gray-700 mb-2 block">When are you looking to sell? *</Label>
                    <Select onValueChange={(value) => setValue('timeframe', value as any)}>
                      <SelectTrigger className="bg-white border-slate-300 text-gray-900">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asap">As soon as possible</SelectItem>
                        <SelectItem value="1-3_months">Within 1-3 months</SelectItem>
                        <SelectItem value="3-6_months">Within 3-6 months</SelectItem>
                        <SelectItem value="just_curious">Just curious about value</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.timeframe && (
                      <p className="text-red-400 text-sm mt-1">{errors.timeframe.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit"
                    disabled={submitValuation.isPending}
                    className="w-full bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white font-bold py-4 text-lg rounded-xl transition-all duration-300 hover:scale-105"
                  >
                    {submitValuation.isPending ? 'Submitting...' : 'Get My Free Valuation'}
                  </Button>
                </form>
              </div>
            </div>

            {/* Benefits Section */}
            <div ref={benefitsRef}>
              <h2 className="text-3xl font-black mb-8 text-[#5d1759]">Why Choose Our Valuation Service?</h2>
              
              <div className="space-y-6">
                <div className="benefit-card bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] text-white 600 rounded-full p-3 mr-4">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">Accurate Market Analysis</h3>
                      <p className="text-gray-600">
                        Our expert valuers use the latest market data and comparable sales to provide the most accurate valuation possible.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="benefit-card bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] text-white 600 rounded-full p-3 mr-4">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">Quick & Professional</h3>
                      <p className="text-gray-600">
                        Receive your detailed valuation report within 24 hours of your property visit.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="benefit-card bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] text-white 600 rounded-full p-3 mr-4">
                      <Star className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">Award-Winning Service</h3>
                      <p className="text-gray-600">
                        Trusted by luxury property owners across West London for over a decade.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="benefit-card bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] text-white 600 rounded-full p-3 mr-4">
                      <Home className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">No Obligation</h3>
                      <p className="text-gray-600">
                        Our valuation service is completely free with no obligation to sell through us.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="mt-12 bg-[#791E75] rounded-2xl p-8">
                <h3 className="text-xl font-bold mb-6 text-white">Prefer to speak directly?</h3>
                <div className="space-y-4">
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-[#791E75]400 mr-3" />
                    <span className="text-white">020 7123 4567</span>
                  </div>
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 text-[#791E75]400 mr-3" />
                    <span className="text-white">valuations@johnbarclay.com</span>
                  </div>
                  <div className="flex items-center">
                    <Calendar className="h-5 w-5 text-[#791E75]400 mr-3" />
                    <span className="text-white">Mon - Fri: 9AM - 6PM</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}