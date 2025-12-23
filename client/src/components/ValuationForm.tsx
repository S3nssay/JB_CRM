import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  propertyValuationFormSchema, 
  type PropertyValuationFormData 
} from '@shared/schema';
import { 
  propertyTypeOptions, 
  bedroomOptions, 
  conditionOptions, 
  timeframeOptions,
  exchangeTimeframeOptions,
  yesNoOptions
} from '@/lib/utils';
import { 
  Home, Bed, Building, BadgeCheck, PenTool, ArrowLeft, ArrowRight, 
  TimerOff, MapPin, User, Mail, Phone, CalendarClock, Sparkles, PartyPopper, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  isValidUKPostcode,
  formatPostcode,
  findAddressesByPostcode,
  Address,
  AddressLookupResponse
} from '@/lib/addressService';
import { apiRequest } from '@/lib/queryClient';

interface ValuationFormProps {
  onSubmit: (data: PropertyValuationFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const ValuationForm = ({ onSubmit, isSubmitting = false }: ValuationFormProps) => {
  const [step, setStep] = useState(1);
  const [isSearchingAddress, setIsSearchingAddress] = useState(false);
  const [foundAddresses, setFoundAddresses] = useState<Address[]>([]);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<number | null>(null);
  const { toast } = useToast();
  
  const form = useForm<PropertyValuationFormData>({
    resolver: zodResolver(propertyValuationFormSchema),
    defaultValues: {
      postcode: '',
      addressLine1: '',
      town: '',
      hasExtensions: 'no',
      hasAlterations: 'no',
      exchangeTimeframe: '28_days',
      agreeToTerms: false
    }
  });

  const nextStep = async () => {
    if (step === 1) {
      // Only validate postcode and addressLine1 - town is now replaced by postcode
      const isValid = await form.trigger(['postcode', 'addressLine1']);
      
      // Auto-fill town with value from the postcode lookup or a default value
      if (selectedAddressIndex !== null && foundAddresses[selectedAddressIndex]?.town) {
        form.setValue('town', foundAddresses[selectedAddressIndex].town);
      } else if (!form.getValues('town')) {
        // Extract town from postcode if not set
        form.setValue('town', 'Town derived from postcode');
      }
      
      if (isValid) setStep(2);
    } else if (step === 2) {
      const isValid = await form.trigger([
        'propertyType',
        'bedrooms',
        'condition',
        'hasExtensions',
        'hasAlterations',
        'exchangeTimeframe',
      ]);
      
      // If extensions are selected, also validate the details if required
      if (form.getValues('hasExtensions') === 'yes') {
        await form.trigger('extensionDetails');
      }
      
      // If alterations are selected, also validate the details if required
      if (form.getValues('hasAlterations') === 'yes') {
        await form.trigger('alterationDetails');
      }
      
      if (isValid) setStep(3);
    }
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const handleFindAddress = async () => {
    const postcode = form.getValues('postcode');
    setFoundAddresses([]);
    setSelectedAddressIndex(null);
    
    if (!postcode) {
      form.setError('postcode', { 
        type: 'manual', 
        message: 'Please enter a postcode for your property valuation' 
      });
      return;
    }
    
    // Clean and format the postcode
    let cleanPostcode = postcode.replace(/\s+/g, '').toUpperCase();
    let formattedPostcode = formatPostcode(cleanPostcode);
    form.setValue('postcode', formattedPostcode);
    
    // Basic validation before API call
    if (cleanPostcode.length < 5 || cleanPostcode.length > 8) {
      toast({
        title: "Invalid postcode format",
        description: "UK postcodes should be between 5-7 characters. Please check and try again.",
        variant: "destructive"
      });
      return; // Don't proceed with invalid format
    }
    
    setIsSearchingAddress(true);
    
    try {
      // Call our updated function to validate the postcode and find addresses
      const result = await findAddressesByPostcode(formattedPostcode);
      
      if (!result.valid) {
        toast({
          title: "Invalid postcode",
          description: result.message || "This doesn't appear to be a valid UK postcode. Please check and try again.",
          variant: "destructive"
        });
        setIsSearchingAddress(false);
        return;
      }
      
      // Set addresses if any were found
      if (result.addresses && result.addresses.length > 0) {
        setFoundAddresses(result.addresses);
        toast({
          title: "Postcode validated",
          description: `We found ${result.addresses.length} properties at this postcode. Please select your address or enter manually.`,
        });
      } else {
        // No addresses but valid postcode
        toast({
          title: "Postcode validated",
          description: "Your postcode is valid for valuation. Please enter your address details manually below.",
        });
      }
      
      // If region is available, store it for valuation purposes
      if (result.region) {
        console.log(`Property located in region: ${result.region}, district: ${result.district || 'unknown'}`);
      }
      
    } catch (error) {
      console.error('Error validating postcode:', error);
      toast({
        title: "Postcode validation failed",
        description: "We were unable to validate your postcode. You can still continue with manual entry.",
        variant: "destructive"
      });
    } finally {
      setIsSearchingAddress(false);
    }
  };
  
  // Track if button should be highlighted after address selection
  const [highlightContinueButton, setHighlightContinueButton] = useState(false);

  const handleSelectAddress = (index: number) => {
    setSelectedAddressIndex(index);
    const address = foundAddresses[index];
    form.setValue('addressLine1', address.addressLine1);
    form.setValue('postcode', address.postcode || form.getValues('postcode'));
    
    toast({
      title: "Address selected",
      description: "Please continue to property details",
    });
    
    // Highlight the continue button to draw attention
    setHighlightContinueButton(true);
    
    // Remove highlight effect after a few seconds and focus the continue button
    setTimeout(() => {
      setHighlightContinueButton(false);
      
      // Find and focus the continue button
      const continueButton = document.querySelector('.continue-to-details-button') as HTMLButtonElement;
      if (continueButton) {
        continueButton.focus();
      }
    }, 3000);
  };

  return (
    <Form {...form}>
      <form id="valuation-form" onSubmit={form.handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl shadow-lg border-2 border-[#0E6BFF] fun-card">
        <div className="text-center mb-6">
          <p className="text-neutral-600 mt-2 text-2xl mb-8">Takes just 2 minutes • No obligations • 100% Free</p>
        </div>
        
        {/* Fun progress bar */}
        <div className="relative w-full bg-neutral-100 h-6 rounded-full mb-8 overflow-hidden">
          <div 
            className="fun-gradient h-6 rounded-full transition-all duration-500 flex items-center justify-center text-[10px] font-bold text-white"
            style={{ width: `${(step / 3) * 100}%` }}
          >
            {Math.round((step / 3) * 100)}%
          </div>
          <div className="absolute top-0 left-0 w-full h-full flex justify-between px-2 text-[10px] font-bold items-center">
            <span className={`${step >= 1 ? 'text-white' : 'text-neutral-400'} ml-2`}>Address</span>
            <span className={`${step >= 2 ? 'text-white' : 'text-neutral-400'}`}>Property</span>
            <span className={`${step >= 3 ? 'text-white' : 'text-neutral-400'} mr-2`}>Contact</span>
          </div>
        </div>
        
        {/* Step 1: Property Address */}
        {step === 1 && (
          <div className="space-y-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary text-white font-bold text-6xl mb-4">1</div>
              <h3 className="font-bold" style={{ fontSize: '35px' }}>Where is your property located?</h3>
              <p className="text-neutral-500 text-sm">We need this to provide an accurate valuation for your area</p>
            </div>
            
            <FormField
              control={form.control}
              name="postcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <MapPin className="h-4 w-4 text-primary" /> 
                    Postcode
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="E.g., SW1A 1AA" 
                        className="pl-10 fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                      <div className="absolute left-3 top-2.5 text-neutral-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                          <circle cx="12" cy="10" r="3"></circle>
                        </svg>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-neutral-500 mt-1">We will never share your data with third parties.</p>
                </FormItem>
              )}
            />
            
            <Button 
              type="button" 
              className="w-full fun-button rounded-lg bg-[#0E6BFF] text-white hover:bg-[#0E6BFF]/90" 
              onClick={handleFindAddress}
              disabled={isSearchingAddress}
            >
              {isSearchingAddress ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" /> Validating Postcode...
                </>
              ) : (
                <>
                  <MapPin className="mr-1 h-4 w-4" /> Validate Postcode For Valuation
                </>
              )}
            </Button>
            <p className="text-xs text-center text-neutral-500 mt-1">
              We use your postcode to fetch accurate property values from the UK Land Registry data
            </p>
            
            {/* Address selection */}
            {foundAddresses.length > 0 && (
              <div className="mt-4 border border-neutral-200 rounded-lg overflow-hidden">
                <div className="bg-neutral-50 p-3 border-b border-neutral-200">
                  <h4 className="font-medium text-sm">Select your address:</h4>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {foundAddresses.map((address, index) => (
                    <div 
                      key={index}
                      className={cn(
                        "p-3 cursor-pointer border-b border-neutral-100 hover:bg-[#791E75] text-white 50 transition-colors",
                        selectedAddressIndex === index ? "bg-[#791E75] text-white 50" : ""
                      )}
                      onClick={() => handleSelectAddress(index)}
                    >
                      <div className="flex items-start">
                        <div className="pr-2">
                          {selectedAddressIndex === index ? (
                            <BadgeCheck className="h-5 w-5 text-primary" />
                          ) : (
                            <Home className="h-5 w-5 text-neutral-400" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{address.addressLine1}</p>

                          <p className="text-sm text-neutral-500">{address.town}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="my-4 text-center flex items-center justify-center">
              <span className="border-t border-neutral-300 flex-1"></span>
              <span className="mx-4 text-sm bg-white px-3 text-neutral-500 font-medium">or enter manually</span>
              <span className="border-t border-neutral-300 flex-1"></span>
            </div>
            
            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Address Line 1</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="E.g., 10 Downing Street" 
                      className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="postcode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Postcode</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="E.g., SW1A 1AA" 
                      className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-sm text-neutral-500 mt-1">We will never share your data with third parties.</p>
                </FormItem>
              )}
            />
            
            <Button 
              type="button" 
              className={cn(
                "w-full fun-button bg-[#0E6BFF] hover:bg-[#0E6BFF]/90 text-white text-lg py-6 transition-all continue-to-details-button",
                highlightContinueButton ? "animate-pulse shadow-lg shadow-primary/50 ring-4 ring-primary/30" : ""
              )} 
              onClick={nextStep}
            >
              Continue to Property Details <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        )}
        
        {/* Step 2: Property Details */}
        {step === 2 && (
          <div className="space-y-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary text-white font-bold text-6xl mb-4">2</div>
              <h3 className="font-bold" style={{ fontSize: '35px' }}>Tell us about your property</h3>
              <p className="text-neutral-500 text-sm">These details help us calculate your cash offer value</p>
            </div>
          
            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <Building className="h-4 w-4 text-primary" /> 
                    Property Type
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                        <SelectValue placeholder="What type of property do you have?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {propertyTypeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center">
                            <Building className="mr-2 h-4 w-4 text-primary" />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="bedrooms"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <Bed className="h-4 w-4 text-primary" /> 
                    Number of Bedrooms
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                        <SelectValue placeholder="How many bedrooms?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bedroomOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center">
                            <Bed className="mr-2 h-4 w-4 text-primary" />
                            {option.label} {option.label === "1" ? "Bedroom" : "Bedrooms"}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <Home className="h-4 w-4 text-primary" /> 
                    Property Condition
                  </FormLabel>
                  <div className="grid grid-cols-3 gap-3">
                    {conditionOptions.map(option => (
                      <div 
                        key={option.value}
                        className={cn(
                          "border-2 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 hover:shadow-md",
                          field.value === option.value 
                            ? "border-primary bg-primary/5 shadow-md" 
                            : "border-neutral-200 hover:border-primary/30"
                        )}
                        onClick={() => form.setValue('condition', option.value, { shouldValidate: true })}
                      >
                        <div className="flex flex-col items-center">
                          <div className={cn(
                            "w-12 h-12 rounded-full flex items-center justify-center mb-2",
                            option.value === 'good' ? "bg-[#791E75] text-white 100" : "",
                            option.value === 'average' ? "bg-[#F8B324] text-black 100" : "",
                            option.value === 'needs_work' ? "bg-red-100" : "",
                          )}>
                            {option.value === 'good' && <Home className={cn("h-6 w-6", option.color)} />}
                            {option.value === 'average' && <Home className={cn("h-6 w-6", option.color)} />}
                            {option.value === 'needs_work' && <PenTool className={cn("h-6 w-6", option.color)} />}
                          </div>
                          <span className="font-medium">{option.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hasExtensions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <Building className="h-4 w-4 text-primary" /> 
                    Does the property have any extensions?
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {yesNoOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch('hasExtensions') === 'yes' && (
              <FormField
                control={form.control}
                name="extensionDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Extension Details</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Please provide details about your extension" 
                        className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="hasAlterations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <PenTool className="h-4 w-4 text-primary" /> 
                    Have you made any structural alterations to the property?
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                        <SelectValue placeholder="Select an option" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {yesNoOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            {form.watch('hasAlterations') === 'yes' && (
              <FormField
                control={form.control}
                name="alterationDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Alteration Details</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Please provide details about your alterations" 
                        className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="exchangeTimeframe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <CalendarClock className="h-4 w-4 text-primary" /> 
                    Preferred Exchange Timeframe
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                        <SelectValue placeholder="When would you like to exchange?" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {exchangeTimeframeOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="flex items-center">
                            <CalendarClock className="mr-2 h-4 w-4 text-primary" />
                            {option.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="flex gap-4 mt-6">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 fun-button rounded-lg py-6 text-neutral-700" 
                onClick={prevStep}
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </Button>
              <Button 
                type="button" 
                className="flex-1 fun-button bg-primary hover:bg-primary/90 text-white text-lg py-6" 
                onClick={nextStep}
              >
                Continue <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Step 3: Contact Information */}
        {step === 3 && (
          <div className="space-y-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-primary text-white font-bold text-6xl mb-4">3</div>
              <h3 className="font-bold" style={{ fontSize: '35px' }}>Almost there! Your details</h3>
              <p className="text-neutral-500 text-sm">We'll send your valuation to the details you provide</p>
            </div>
          
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <User className="h-4 w-4 text-primary" /> 
                    Full Name
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        placeholder="Enter your full name" 
                        className="pl-10 fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                      <div className="absolute left-3 top-2.5 text-neutral-400">
                        <User className="h-5 w-5" />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <Mail className="h-4 w-4 text-primary" /> 
                    Email Address
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="email" 
                        placeholder="Enter your email address" 
                        className="pl-10 fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                      <div className="absolute left-3 top-2.5 text-neutral-400">
                        <Mail className="h-5 w-5" />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <Phone className="h-4 w-4 text-primary" /> 
                    Phone Number
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type="tel" 
                        placeholder="Enter your phone number" 
                        className="pl-10 fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                      <div className="absolute left-3 top-2.5 text-neutral-400">
                        <Phone className="h-5 w-5" />
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="timeframe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <CalendarClock className="h-4 w-4 text-primary" /> 
                    When are you looking to sell?
                  </FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {timeframeOptions.map(option => (
                      <div 
                        key={option.value}
                        className={cn(
                          "border-2 rounded-xl p-4 text-center cursor-pointer transition-all duration-200 hover:shadow-md",
                          field.value === option.value 
                            ? "border-primary bg-primary/5 shadow-md" 
                            : "border-neutral-200 hover:border-primary/30"
                        )}
                        onClick={() => form.setValue('timeframe', option.value, { shouldValidate: true })}
                      >
                        <div className="flex items-center justify-center">
                          {option.value === 'asap' && 
                            <div className="bg-[#791E75] text-white 100 p-1.5 rounded-full mr-2">
                              <TimerOff className="h-4 w-4 text-[#791E75]500" />
                            </div>
                          }
                          {option.value === '1-3_months' && 
                            <div className="bg-[#791E75] text-white 100 p-1.5 rounded-full mr-2">
                              <CalendarClock className="h-4 w-4 text-[#791E75]500" />
                            </div>
                          }
                          {option.value === '3-6_months' && 
                            <div className="bg-[#F8B324] text-black 100 p-1.5 rounded-full mr-2">
                              <CalendarClock className="h-4 w-4 text-[#F8B324]500" />
                            </div>
                          }
                          {option.value === 'just_curious' && 
                            <div className="bg-purple-100 p-1.5 rounded-full mr-2">
                              <Sparkles className="h-4 w-4 text-purple-500" />
                            </div>
                          }
                          <span className="font-medium">{option.label}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 mt-4 p-4 bg-neutral-50 rounded-xl border border-neutral-200">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-1 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-sm text-neutral-600">
                      I agree to the <a href="#" className="text-primary underline font-medium">terms & conditions</a> and <a href="#" className="text-primary underline font-medium">privacy policy</a>
                    </FormLabel>
                    <p className="text-xs text-neutral-500 mt-1">
                      We'll use your information to provide property-related services and may contact you about our services. You can unsubscribe at any time.
                    </p>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            
            <div className="flex gap-4 mt-6">
              <Button 
                type="button" 
                variant="outline" 
                className="flex-1 fun-button rounded-lg py-6 text-neutral-700" 
                onClick={prevStep}
              >
                <ArrowLeft className="mr-2 h-5 w-5" /> Back
              </Button>
              <Button 
                type="submit" 
                className="flex-1 fun-button bg-primary hover:bg-primary/90 text-white text-lg py-6"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center">
                    Get Your Valuation <PartyPopper className="ml-2 h-5 w-5" />
                  </span>
                )}
              </Button>
            </div>

            <div className="flex justify-center items-center mt-4">
              <div className="text-center bg-[#791E75] text-white 50 px-4 py-2 rounded-full text-sm text-[#791E75]700 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
                Your data is secure and protected
              </div>
            </div>
          </div>
        )}
      </form>
    </Form>
  );
};

export default ValuationForm;
