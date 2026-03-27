import { useParams, useLocation } from 'wouter';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  propertyOwnershipFormSchema, 
  type PropertyOwnershipFormData 
} from '@shared/schema';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage, 
  FormDescription 
} from '@/components/ui/form';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { 
  legalStatusOptions,
  ownershipLengthOptions,
  mortgageDetailsOptions,
  reasonForSellingOptions
} from '@/lib/utils';
import { 
  ClipboardList, 
  Clock, 
  ChartBarStacked, 
  FileText, 
  HelpCircle
} from 'lucide-react';

const PropertyOwnership = () => {
  const { id } = useParams<{ id: string }>();
  const propertyId = parseInt(id);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  
  const form = useForm<PropertyOwnershipFormData>({
    resolver: zodResolver(propertyOwnershipFormSchema),
    defaultValues: {
      legalStatus: undefined,
      ownershipLength: undefined,
      mortgageDetails: undefined,
      legalIssues: '',
      reasonForSelling: undefined
    }
  });

  const onSubmit = async (data: PropertyOwnershipFormData) => {
    if (isNaN(propertyId)) {
      toast({
        title: "Error",
        description: "Invalid property ID",
        variant: "destructive"
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      await apiRequest('/api/ownerships', 'POST', {
        ...data,
        propertyId
      });
      
      toast({
        title: "Information submitted",
        description: "Thank you for providing your property ownership details.",
      });
      
      // Redirect to the valuation result page
      navigate(`/valuation-result/${propertyId}`);
    } catch (error) {
      toast({
        title: "Error",
        description: "There was a problem submitting your information. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-neutral-100 py-12 md:py-16">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-primary mb-2">Property Ownership Details</h1>
            <p className="text-neutral-600 mb-6">
              Please provide some additional information about your ownership of the property. This helps us provide a more accurate valuation and offer.
            </p>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="legalStatus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <ClipboardList className="h-5 w-5 mr-2 text-secondary" />
                        Legal Status of Ownership
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your legal status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {legalStatusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How you legally own the property
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="ownershipLength"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <Clock className="h-5 w-5 mr-2 text-secondary" />
                        Length of Ownership
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select how long you've owned the property" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {ownershipLengthOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        How long you have owned the property
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="mortgageDetails"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <ChartBarStacked className="h-5 w-5 mr-2 text-secondary" />
                        Outstanding Mortgage Details
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your mortgage situation" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {mortgageDetailsOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Details about any outstanding mortgage on the property
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="legalIssues"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-secondary" />
                        Any Legal Issues or Easements (Optional)
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Please describe any legal issues, disputes, easements, or restrictive covenants affecting the property"
                          {...field}
                          rows={4}
                        />
                      </FormControl>
                      <FormDescription>
                        Information about any legal complications that might affect the sale
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="reasonForSelling"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center">
                        <HelpCircle className="h-5 w-5 mr-2 text-secondary" />
                        Reason for Selling
                      </FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your main reason for selling" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {reasonForSellingOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Your primary reason for wanting to sell the property
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="flex justify-end">
                  <Button 
                    type="submit" 
                    className="bg-secondary hover:bg-secondary-light"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Submitting...' : 'Submit Ownership Details'}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyOwnership;
