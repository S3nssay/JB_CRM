import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// Define a simple schema with just what's needed for UK HPI
const hpiFormSchema = z.object({
  addressLine1: z.string().min(5, "Please enter the first line of your address"),
  postcode: z.string()
    .min(5, "Please enter a valid UK postcode")
    .refine(
      (val) => /^[A-Z]{1,2}[0-9][A-Z0-9]?[0-9][A-Z]{2}$/i.test(val.replace(/\s+/g, '')),
      { message: "Please enter a valid UK postcode format" }
    ),
  propertyType: z.enum(["detached", "semi-detached", "terraced", "flat", "bungalow", "other"]),
  bedrooms: z.enum(["1", "2", "3", "4", "5+"]),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(10, "Please enter a valid phone number"),
});

type HpiFormData = z.infer<typeof hpiFormSchema>;

const propertyTypeOptions = [
  { value: "detached", label: "Detached" },
  { value: "semi-detached", label: "Semi-Detached" },
  { value: "terraced", label: "Terraced" },
  { value: "flat", label: "Flat/Apartment" },
  { value: "bungalow", label: "Bungalow" },
  { value: "other", label: "Other" }
];

const bedroomOptions = [
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5+", label: "5+" }
];

interface SimpleHpiFormProps {
  onSubmit: (data: HpiFormData) => Promise<void>;
  isSubmitting?: boolean;
}

const SimpleHpiForm = ({ onSubmit, isSubmitting = false }: SimpleHpiFormProps) => {
  const { toast } = useToast();
  
  const form = useForm<HpiFormData>({
    resolver: zodResolver(hpiFormSchema),
    defaultValues: {
      addressLine1: '',
      postcode: '',
      propertyType: undefined,
      bedrooms: undefined,
      email: '',
      phone: ''
    }
  });

  // Function to validate and format UK postcode
  const formatPostcode = (value: string) => {
    if (!value) return value;
    
    // Clean and format the postcode
    let cleanPostcode = value.replace(/\s+/g, '').toUpperCase();
    
    // Format with a space in the right position
    return cleanPostcode.replace(/^(.+?)([0-9][A-Z]{2})$/, '$1 $2');
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 p-6 bg-white rounded-lg shadow-md border border-[#0E6BFF]">
        <div className="text-center mb-4">
          <h2 className="text-2xl font-bold text-[#0E6BFF]">Free Property Valuation</h2>
        </div>
        
        <div className="space-y-4">
          <FormField
            control={form.control}
            name="addressLine1"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-medium">Address Line 1 *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g. 123 Main Street" 
                    className="border-gray-300" 
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
                <FormLabel className="font-medium">Postcode *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g. SW1A 1AA" 
                    className="border-gray-300" 
                    {...field} 
                    onBlur={(e) => {
                      // Format postcode on blur
                      const formatted = formatPostcode(e.target.value);
                      if (formatted !== e.target.value) {
                        field.onChange(formatted);
                      }
                      // Continue with default onBlur behavior
                      field.onBlur();
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="propertyType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Property Type *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Select property type" />
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
                  <FormLabel className="font-medium">Number of Bedrooms *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="border-gray-300">
                        <SelectValue placeholder="Select bedrooms" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bedroomOptions.map(option => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label} {parseInt(option.label) === 1 ? "Bedroom" : "Bedrooms"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-medium">Email Address *</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="your.email@example.com" 
                      className="border-gray-300" 
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
                  <FormLabel className="font-medium">Phone Number *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="07123 456789" 
                      className="border-gray-300" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <Button 
          type="submit" 
          className="w-full bg-[#0E6BFF] hover:bg-[#0E6BFF]/90 py-6 text-lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...
            </>
          ) : (
            <>
              Get My Free Valuation <Sparkles className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
        

      </form>
    </Form>
  );
};

export default SimpleHpiForm;