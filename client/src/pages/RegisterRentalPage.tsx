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
  Key,
  PoundSterling,
  Shield,
  Users,
  Clock,
  CheckCircle,
  Home,
  Phone,
  Mail,
  TrendingUp,
  Star
} from 'lucide-react';
import { contactFormSchema, type ContactFormData } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Link } from 'wouter';
import { z } from 'zod';
import {
  lettingServicePackages,
  additionalCharges,
  certificatesAndCompliance,
  calculatePackageFee,
  formatServicePrice
} from '@shared/lettingServiceTerms';

// Extended schema for rental registration
const rentalRegistrationSchema = contactFormSchema.extend({
  expectedRent: z.number().min(500, "Expected rent must be at least £500"),
  propertyCondition: z.enum(["excellent", "good", "fair", "needs_work"]),
  currentlyOccupied: z.enum(["yes", "no", "notice_given"]),
  managementType: z.enum(["full_management", "tenant_find_only", "rent_collection"]),
  furnishingLevel: z.enum(["furnished", "unfurnished", "part_furnished"])
});

type RentalRegistrationData = z.infer<typeof rentalRegistrationSchema>;

export default function RegisterRentalPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();
  const heroRef = useRef(null);
  const formRef = useRef(null);
  const servicesRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset
  } = useForm<RentalRegistrationData>({
    resolver: zodResolver(rentalRegistrationSchema),
    defaultValues: {
      inquiryType: 'letting',
      propertyType: 'flat',
      bedrooms: 2,
      timeframe: '1-3_months',
      propertyCondition: 'good',
      currentlyOccupied: 'no',
      managementType: 'full_management',
      furnishingLevel: 'unfurnished'
    }
  });

  const submitRegistration = useMutation({
    mutationFn: async (data: RentalRegistrationData) => {
      const response = await apiRequest('/api/contacts', 'POST', {
        inquiryType: 'letting',
        fullName: data.fullName,
        email: data.email,
        phone: data.phone,
        propertyAddress: data.propertyAddress,
        postcode: data.postcode,
        propertyType: data.propertyType,
        bedrooms: data.bedrooms,
        message: `Rental Registration - Expected Rent: £${data.expectedRent}, Condition: ${data.propertyCondition}, Currently Occupied: ${data.currentlyOccupied}, Management Type: ${data.managementType}, Furnishing: ${data.furnishingLevel}. Additional details: ${data.message || 'None'}`,
        timeframe: data.timeframe
      });
      return response;
    },
    onSuccess: () => {
      setIsSubmitted(true);
      reset();
      toast({
        title: "Registration submitted!",
        description: "We'll contact you within 24 hours to discuss your rental requirements.",
      });
      // Invalidate contacts cache
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error submitting registration",
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

    // Services animation
    gsap.fromTo('.service-card', {
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

  const onSubmit = (data: RentalRegistrationData) => {
    submitRegistration.mutate(data);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-white text-gray-900 flex items-center justify-center">
        <div className="max-w-2xl mx-auto text-center px-6">
          <div className="bg-[#791E75] text-white 600 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-8">
            <CheckCircle className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black mb-6 text-[#5d1759]">
            Registration Complete!
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Thank you for choosing John Barclay Estate & Management. We'll be in touch within 24 hours to discuss your rental property requirements.
          </p>
          <div className="bg-slate-50 backdrop-blur-sm rounded-2xl p-6 mb-8 border border-slate-200">
            <h3 className="text-xl font-bold mb-4 text-[#5d1759]">Your rental journey starts now:</h3>
            <div className="space-y-3 text-left">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#791E75] text-white 600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">1</div>
                <span className="text-gray-700">Property assessment and rental valuation</span>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#791E75] text-white 600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">2</div>
                <span className="text-gray-700">Professional photography and marketing setup</span>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#791E75] text-white 600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">3</div>
                <span className="text-gray-700">Tenant sourcing and reference checks</span>
              </div>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-[#791E75] text-white 600 text-white rounded-full flex items-center justify-center text-sm font-bold mr-4">4</div>
                <span className="text-gray-700">Ongoing property management and support</span>
              </div>
            </div>
          </div>
          <Button 
            onClick={() => setIsSubmitted(false)}
            className="bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white font-bold py-3 px-8 rounded-xl"
          >
            Register Another Property
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-900">
      
      {/* Hero Section */}
      <section ref={heroRef} className="relative h-[70vh] flex items-center justify-center overflow-hidden" style={{ backgroundColor: '#791E75' }}>
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-64 h-64 bg-gradient-to-br from-slate-300/20 to-slate-500/10 rounded-full blur-sm animate-float-slow"></div>
          <div className="absolute bottom-20 right-32 w-48 h-48 bg-gradient-to-br from-slate-400/15 to-[#791E75]/5 rounded-3xl rotate-45 blur-sm animate-float-reverse"></div>
        </div>
        
        <div className="relative z-10 text-center max-w-6xl mx-auto px-6">
          <div className="mb-6">
            <h1 className="text-4xl md:text-5xl font-black leading-none text-white mb-4">
              REGISTER YOUR RENTAL PROPERTY
            </h1>
          </div>
          <p className="text-xl md:text-2xl text-white max-w-3xl mx-auto mb-8">
            Maximize your rental income with London's premier lettings management service
          </p>
          
          {/* Navigation Buttons */}
          <div className="flex justify-center gap-4">
            <Link href="/">
              <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white px-6 py-3 rounded-xl">
                <Home className="mr-2 h-5 w-5" />
                HOME
              </Button>
            </Link>
            <Link href="/rentals">
              <Button className="bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white px-6 py-3 rounded-xl">
                <Key className="mr-2 h-5 w-5" />
                BACK TO RENTALS
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-20 px-6 bg-gradient-to-b from-white to-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16">
            
            {/* Registration Form */}
            <div ref={formRef}>
              <div className="bg-white backdrop-blur-sm rounded-2xl p-8 border border-slate-200 shadow-sm">
                <h2 className="text-3xl font-black mb-8 flex items-center text-[#5d1759]">
                  <Key className="h-8 w-8 text-[#791E75]600 mr-3" />
                  Property Registration
                </h2>
                
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                  {/* Property Details */}
                  <div>
                    <Label htmlFor="propertyAddress" className="text-gray-700 mb-2 block font-medium">
                      Property Address *
                    </Label>
                    <Input
                      {...register('propertyAddress')}
                      id="propertyAddress"
                      placeholder="Enter your full property address"
                      className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    {errors.propertyAddress && (
                      <p className="text-red-500 text-sm mt-1">{errors.propertyAddress.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="postcode" className="text-gray-700 mb-2 block font-medium">
                      Postcode *
                    </Label>
                    <Input
                      {...register('postcode')}
                      id="postcode"
                      placeholder="e.g. W2 1AA"
                      className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    {errors.postcode && (
                      <p className="text-red-500 text-sm mt-1">{errors.postcode.message}</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700 mb-2 block font-medium">Property Type *</Label>
                      <Select onValueChange={(value) => setValue('propertyType', value as any)}>
                        <SelectTrigger className="bg-white border border-slate-300 text-gray-900">
                          <SelectValue placeholder="Select property type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="flat">Flat</SelectItem>
                          <SelectItem value="house">House</SelectItem>
                          <SelectItem value="penthouse">Penthouse</SelectItem>
                          <SelectItem value="maisonette">Maisonette</SelectItem>
                          <SelectItem value="studio">Studio</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.propertyType && (
                        <p className="text-red-500 text-sm mt-1">{errors.propertyType.message}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-gray-700 mb-2 block font-medium">Bedrooms *</Label>
                      <Select onValueChange={(value) => setValue('bedrooms', parseInt(value))}>
                        <SelectTrigger className="bg-white border border-slate-300 text-gray-900">
                          <SelectValue placeholder="Number of bedrooms" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Studio</SelectItem>
                          <SelectItem value="1">1 Bedroom</SelectItem>
                          <SelectItem value="2">2 Bedrooms</SelectItem>
                          <SelectItem value="3">3 Bedrooms</SelectItem>
                          <SelectItem value="4">4 Bedrooms</SelectItem>
                          <SelectItem value="5">5+ Bedrooms</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.bedrooms && (
                        <p className="text-red-500 text-sm mt-1">{errors.bedrooms.message}</p>
                      )}
                    </div>
                  </div>

                  {/* Rental Details */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="expectedRent" className="text-gray-700 mb-2 block font-medium">
                        Expected Monthly Rent (£) *
                      </Label>
                      <Input
                        {...register('expectedRent', { valueAsNumber: true })}
                        id="expectedRent"
                        type="number"
                        placeholder="e.g. 2500"
                        className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                      {errors.expectedRent && (
                        <p className="text-red-500 text-sm mt-1">{errors.expectedRent.message}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-gray-700 mb-2 block font-medium">Property Condition *</Label>
                      <Select onValueChange={(value) => setValue('propertyCondition', value as any)}>
                        <SelectTrigger className="bg-white border border-slate-300 text-gray-900">
                          <SelectValue placeholder="Property condition" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="excellent">Excellent</SelectItem>
                          <SelectItem value="good">Good</SelectItem>
                          <SelectItem value="fair">Fair</SelectItem>
                          <SelectItem value="needs_work">Needs Work</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.propertyCondition && (
                        <p className="text-red-500 text-sm mt-1">{errors.propertyCondition.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700 mb-2 block font-medium">Currently Occupied? *</Label>
                      <Select onValueChange={(value) => setValue('currentlyOccupied', value as any)}>
                        <SelectTrigger className="bg-white border border-slate-300 text-gray-900">
                          <SelectValue placeholder="Occupancy status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes - Tenants in place</SelectItem>
                          <SelectItem value="no">No - Property is vacant</SelectItem>
                          <SelectItem value="notice_given">Notice has been given</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.currentlyOccupied && (
                        <p className="text-red-500 text-sm mt-1">{errors.currentlyOccupied.message}</p>
                      )}
                    </div>

                    <div>
                      <Label className="text-gray-700 mb-2 block font-medium">Furnishing Level *</Label>
                      <Select onValueChange={(value) => setValue('furnishingLevel', value as any)}>
                        <SelectTrigger className="bg-white border border-slate-300 text-gray-900">
                          <SelectValue placeholder="Furnishing level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="furnished">Fully Furnished</SelectItem>
                          <SelectItem value="part_furnished">Part Furnished</SelectItem>
                          <SelectItem value="unfurnished">Unfurnished</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.furnishingLevel && (
                        <p className="text-red-500 text-sm mt-1">{errors.furnishingLevel.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-700 mb-2 block font-medium">Management Service Required *</Label>
                    <Select onValueChange={(value) => setValue('managementType', value as any)}>
                      <SelectTrigger className="bg-white border border-slate-300 text-gray-900">
                        <SelectValue placeholder="Management type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_management">Full Property Management</SelectItem>
                        <SelectItem value="tenant_find_only">Tenant Find Only</SelectItem>
                        <SelectItem value="rent_collection">Rent Collection Service</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.managementType && (
                      <p className="text-red-500 text-sm mt-1">{errors.managementType.message}</p>
                    )}
                  </div>

                  {/* Contact Details */}
                  <div>
                    <Label htmlFor="fullName" className="text-gray-700 mb-2 block font-medium">
                      Full Name *
                    </Label>
                    <Input
                      {...register('fullName')}
                      id="fullName"
                      placeholder="Your full name"
                      className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                    />
                    {errors.fullName && (
                      <p className="text-red-500 text-sm mt-1">{errors.fullName.message}</p>
                    )}
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="email" className="text-gray-700 mb-2 block font-medium">
                        Email Address *
                      </Label>
                      <Input
                        {...register('email')}
                        id="email"
                        type="email"
                        placeholder="your.email@example.com"
                        className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                      {errors.email && (
                        <p className="text-red-500 text-sm mt-1">{errors.email.message}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="phone" className="text-gray-700 mb-2 block font-medium">
                        Phone Number *
                      </Label>
                      <Input
                        {...register('phone')}
                        id="phone"
                        type="tel"
                        placeholder="07xxx xxx xxx"
                        className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500"
                      />
                      {errors.phone && (
                        <p className="text-red-500 text-sm mt-1">{errors.phone.message}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label className="text-gray-700 mb-2 block font-medium">When would you like to start? *</Label>
                    <Select onValueChange={(value) => setValue('timeframe', value as any)}>
                      <SelectTrigger className="bg-white border border-slate-300 text-gray-900">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="asap">As soon as possible</SelectItem>
                        <SelectItem value="1-3_months">Within 1-3 months</SelectItem>
                        <SelectItem value="3-6_months">Within 3-6 months</SelectItem>
                        <SelectItem value="just_curious">Just exploring options</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.timeframe && (
                      <p className="text-red-500 text-sm mt-1">{errors.timeframe.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-gray-700 mb-2 block font-medium">
                      Additional Information
                    </Label>
                    <Textarea
                      {...register('message')}
                      id="message"
                      placeholder="Any additional details about your property or requirements..."
                      className="bg-white border border-slate-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-500 min-h-[100px]"
                    />
                    {errors.message && (
                      <p className="text-red-500 text-sm mt-1">{errors.message.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit"
                    disabled={submitRegistration.isPending}
                    className="w-full bg-[#791E75] text-white 600 hover:bg-[#791E75] text-white 700 text-white font-bold py-4 text-lg rounded-lg transition-all duration-300"
                  >
                    {submitRegistration.isPending ? 'Submitting...' : 'Register My Property'}
                  </Button>
                </form>
              </div>
            </div>

            {/* Services Section */}
            <div ref={servicesRef}>
              <h2 className="text-3xl font-black mb-8 text-[#5d1759]">Our Lettings Management Services</h2>
              
              <div className="space-y-6">
                <div className="service-card bg-white backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] text-white 600 rounded-full p-3 mr-4">
                      <PoundSterling className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">Maximum Rental Income</h3>
                      <p className="text-gray-600">
                        Our expert valuers ensure your property achieves the highest possible rental income in the current market.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="service-card bg-white backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] text-white 600 rounded-full p-3 mr-4">
                      <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">Quality Tenant Sourcing</h3>
                      <p className="text-gray-600">
                        Comprehensive reference checks and financial vetting to secure reliable, long-term tenants.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="service-card bg-white backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] rounded-full p-3 mr-4">
                      <Shield className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">Full Legal Protection</h3>
                      <p className="text-gray-600">
                        Complete legal compliance including safety certificates, tenancy agreements, and deposit protection.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="service-card bg-white backdrop-blur-sm rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all duration-300">
                  <div className="flex items-start">
                    <div className="bg-[#791E75] rounded-full p-3 mr-4">
                      <Clock className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-2 text-[#5d1759]">24/7 Property Management</h3>
                      <p className="text-gray-600">
                        Round-the-clock support for both landlords and tenants with emergency response services.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Letting Service Packages */}
              <div className="mt-12 bg-[#5d1759] rounded-2xl p-8">
                <h3 className="text-xl font-bold mb-6 text-white">Letting Service Packages</h3>
                <div className="space-y-4">
                  {lettingServicePackages.map((pkg) => (
                    <div key={pkg.id} className="flex justify-between items-start border-b border-gray-600 pb-4 last:border-0 last:pb-0">
                      <div className="flex-1">
                        <span className="text-white font-semibold">{pkg.name}</span>
                        <p className="text-gray-300 text-sm mt-1">{pkg.description}</p>
                      </div>
                      <span className="text-[#F8B324] font-bold ml-4">{pkg.feePercentage}%</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-600">
                  <h4 className="text-lg font-semibold mb-4 text-white">Additional Charges</h4>
                  <div className="grid gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Tenancy Administration Fee</span>
                      <span className="text-[#F8B324] font-bold">£250</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Renewal Fee</span>
                      <span className="text-[#F8B324] font-bold">£150</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Property Inspections</span>
                      <span className="text-[#F8B324] font-bold">£150</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-600">
                  <h4 className="text-lg font-semibold mb-4 text-white">Certificates & Compliance</h4>
                  <div className="grid gap-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Gas Safety Certificate (CP12)</span>
                      <span className="text-[#F8B324] font-bold">£120</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">EICR (Electrical Certificate)</span>
                      <span className="text-[#F8B324] font-bold">£175</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">EPC Certificate</span>
                      <span className="text-[#F8B324] font-bold">£95</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-300">Floor Plan</span>
                      <span className="text-[#F8B324] font-bold">£90</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-600">
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-[#F8B324] mr-3" />
                    <span className="text-white">020 7372 4334</span>
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