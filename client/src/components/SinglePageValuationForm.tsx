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
  Home, Bed, Building, BadgeCheck, PenTool, 
  MapPin, User, Mail, Phone, CalendarClock, Sparkles, Loader2
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

const SinglePageValuationForm = ({ onSubmit, isSubmitting = false }: ValuationFormProps) => {
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
      propertyType: undefined,
      bedrooms: undefined,
      condition: undefined,
      hasExtensions: 'no',
      hasAlterations: 'no',
      exchangeTimeframe: '28_days',
      timeframe: 'asap',
      agreeToTerms: false
    }
  });

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

  const handleSelectAddress = (index: number) => {
    setSelectedAddressIndex(index);
    const address = foundAddresses[index];
    form.setValue('addressLine1', address.addressLine1);
    if (address.town) form.setValue('town', address.town);
    form.setValue('postcode', address.postcode || form.getValues('postcode'));
    
    toast({
      title: "Address selected",
      description: "Address details have been filled in for you.",
    });
  };

  return (
    <Form {...form}>
      <form id="valuation-form" onSubmit={form.handleSubmit(onSubmit)} className="bg-white p-6 rounded-xl shadow-lg border-2 border-[#0E6BFF] fun-card">
        <div className="text-center mb-6">
          <h2 className="font-bold text-[#0E6BFF]" style={{ fontSize: '30px' }}>Get Your Free Property Valuation</h2>
          <p className="text-neutral-600 mt-2 text-xl">Takes just 2 minutes • 100% Free • No obligations</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Property Location Section */}
          <div className="space-y-5 md:border-r md:pr-6">
            <h3 className="font-bold text-2xl text-[#0E6BFF] mb-2">Property Details</h3>
            <p className="text-sm text-neutral-500 mb-4">We use a combination of tools to arrive at the highest possible valuation</p>
            
            {/* Postcode with validation */}
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="postcode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-primary" /> 
                      Postcode
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          placeholder="E.g., SW1A 1AA" 
                          className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                          {...field} 
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        className="shrink-0 fun-button rounded-lg bg-[#0E6BFF] text-white hover:bg-[#0E6BFF]/90" 
                        onClick={handleFindAddress}
                        disabled={isSearchingAddress}
                      >
                        {isSearchingAddress ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <MapPin className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Address selection */}
              {foundAddresses.length > 0 && (
                <div className="mt-2 border border-neutral-200 rounded-lg overflow-hidden">
                  <div className="bg-neutral-50 p-2 border-b border-neutral-200">
                    <h4 className="font-medium text-sm">Select your address:</h4>
                  </div>
                  <div className="max-h-32 overflow-y-auto">
                    {foundAddresses.map((address, index) => (
                      <div 
                        key={index}
                        className={cn(
                          "p-2 cursor-pointer border-b border-neutral-100 hover:bg-[#791E75] text-white 50 transition-colors",
                          selectedAddressIndex === index ? "bg-[#791E75] text-white 50" : ""
                        )}
                        onClick={() => handleSelectAddress(index)}
                      >
                        <div className="flex items-start">
                          <div className="pr-2">
                            {selectedAddressIndex === index ? (
                              <BadgeCheck className="h-4 w-4 text-primary" />
                            ) : (
                              <Home className="h-4 w-4 text-neutral-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{address.addressLine1}</p>
                            <p className="text-xs text-neutral-500">{address.town}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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
                name="town"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium">Town/City</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="E.g., London" 
                        className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
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
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {propertyTypeOptions.map(option => (
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
              
              <FormField
                control={form.control}
                name="bedrooms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium flex items-center gap-1">
                      <Bed className="h-4 w-4 text-primary" /> 
                      Bedrooms
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                          <SelectValue placeholder="How many?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {bedroomOptions.map(option => (
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
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="condition"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium flex items-center gap-1">
                      <Home className="h-4 w-4 text-primary" /> 
                      Condition
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                          <SelectValue placeholder="What condition?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {conditionOptions.map(option => (
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
              
              <FormField
                control={form.control}
                name="exchangeTimeframe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium flex items-center gap-1">
                      <CalendarClock className="h-4 w-4 text-primary" /> 
                      Exchange Timeframe
                    </FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                          <SelectValue placeholder="Select timeframe" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {exchangeTimeframeOptions.map(option => (
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
            </div>
          </div>
          
          {/* Contact Details Section */}
          <div className="space-y-5">
            <h3 className="font-bold text-2xl text-[#0E6BFF] mb-2">Your Contact Details</h3>
            <p className="text-sm text-neutral-500 mb-4">Receive your valuation via email and SMS</p>
            
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
                    <Input 
                      placeholder="E.g., John Smith" 
                      className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium flex items-center gap-1">
                      <Mail className="h-4 w-4 text-primary" /> 
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="E.g., john@example.com" 
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
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-medium flex items-center gap-1">
                      <Phone className="h-4 w-4 text-primary" /> 
                      Phone
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="E.g., 07123 456789" 
                        className="fun-card rounded-lg border-neutral-300 focus:border-primary" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="timeframe"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium flex items-center gap-1">
                    <CalendarClock className="h-4 w-4 text-primary" /> 
                    When are you looking to sell?
                  </FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="fun-card rounded-lg border-neutral-300 focus:border-primary">
                        <SelectValue placeholder="Select timeframe" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timeframeOptions.map(option => (
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
            
            <FormField
              control={form.control}
              name="agreeToTerms"
              render={({ field }) => (
                <FormItem className="flex items-start gap-2 pt-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      className="mt-[0.3rem] border-neutral-300 data-[state=checked]:bg-[#0E6BFF] data-[state=checked]:border-[#0E6BFF]"
                    />
                  </FormControl>
                  <div className="leading-none">
                    <label
                      htmlFor="terms"
                      className="text-sm font-medium leading-tight text-neutral-700 block"
                    >
                      I agree to the terms and conditions
                    </label>
                    <p className="text-xs text-neutral-500 mt-1">
                      We respect your privacy and will only use your data to provide property services
                    </p>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
            
            <Button 
              type="submit" 
              className="w-full mt-6 fun-button bg-[#0E6BFF] hover:bg-[#0E6BFF]/90 text-white text-xl py-6" 
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing...
                </>
              ) : (
                <>
                  Get My Free Valuation <Sparkles className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
            
            <div className="text-center bg-[#791E75] text-white 50 px-4 py-2 rounded-lg text-sm text-[#791E75]700 flex items-center justify-center mt-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
              </svg>
              Using a combination of tools for the highest possible valuation
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default SinglePageValuationForm;