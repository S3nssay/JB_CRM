import { useParams, useLocation } from 'wouter';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { formatCurrency } from '@/lib/utils';
import { Property, Valuation, Contact } from '@shared/schema';
import { AlertCircle, CheckCircle2, Calendar, Home, MapPin, Bed, Compass, Clipboard, ArrowRight, Clock3, PoundSterling, Link2, Ruler } from 'lucide-react';
import CostComparison from '@/components/CostComparison';

const ValuationResult = () => {
  const { id } = useParams<{ id: string }>();
  const valuationId = parseInt(id);
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [nextSteps, setNextSteps] = useState<number>(1);

  const { data: valuation, isLoading: isLoadingValuation, error: valuationError } = useQuery<Valuation>({
    queryKey: [`/api/valuations/${valuationId}`],
    enabled: !isNaN(valuationId),
  });

  const { data: property, isLoading: isLoadingProperty } = useQuery<Property>({
    queryKey: [`/api/properties/${valuation?.propertyId}`],
    enabled: !!valuation?.propertyId,
  });

  const { data: contact, isLoading: isLoadingContact } = useQuery<Contact>({
    queryKey: [`/api/contacts/${valuation?.contactId}`],
    enabled: !!valuation?.contactId,
  });

  useEffect(() => {
    if (valuationError) {
      toast({
        title: "Error",
        description: "Failed to load your valuation. Please try again.",
        variant: "destructive"
      });
    }
  }, [valuationError, toast]);

  // Simulate progress through next steps
  useEffect(() => {
    const timer = setInterval(() => {
      setNextSteps(prev => {
        if (prev < 100) return prev + 1;
        clearInterval(timer);
        return prev;
      });
    }, 100);
    
    return () => clearInterval(timer);
  }, []);

  const handleContinue = () => {
    if (property?.id) {
      navigate(`/property-ownership/${property.id}`);
    } else {
      toast({
        title: "Error",
        description: "Property information is missing. Please try again.",
        variant: "destructive"
      });
    }
  };

  const isLoading = isLoadingValuation || isLoadingProperty || isLoadingContact;

  const mapPropertyType = (type: string) => {
    const types: Record<string, string> = {
      'detached': 'Detached House',
      'semi-detached': 'Semi-Detached House',
      'terraced': 'Terraced House',
      'flat': 'Flat/Apartment',
      'bungalow': 'Bungalow',
      'other': 'Other Property Type'
    };
    return types[type] || type;
  };

  const mapCondition = (condition: string) => {
    const conditions: Record<string, string> = {
      'good': 'Good',
      'average': 'Average',
      'needs_work': 'Needs Work'
    };
    return conditions[condition] || condition;
  };

  const renderCompletionTimeline = () => {
    return (
      <div className="space-y-6 mt-6">
        <div>
          <div className="flex items-center mb-2">
            <div className="bg-[#791E75] text-white 100 text-[#791E75]600 w-8 h-8 rounded-full flex items-center justify-center mr-3">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold">Initial Valuation</h4>
              <p className="text-sm text-neutral-500">Completed today</p>
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex items-center mb-2">
            <div className="bg-secondary bg-opacity-10 text-secondary w-8 h-8 rounded-full flex items-center justify-center mr-3">
              <Clipboard className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold">Ownership Details</h4>
              <p className="text-sm text-neutral-500">Next step</p>
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex items-center mb-2">
            <div className="bg-neutral-100 text-neutral-400 w-8 h-8 rounded-full flex items-center justify-center mr-3">
              <Home className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold">Property Assessment</h4>
              <p className="text-sm text-neutral-500">Within 48 hours</p>
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex items-center mb-2">
            <div className="bg-neutral-100 text-neutral-400 w-8 h-8 rounded-full flex items-center justify-center mr-3">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold">Final Offer</h4>
              <p className="text-sm text-neutral-500">Within 72 hours</p>
            </div>
          </div>
        </div>
        
        <div>
          <div className="flex items-center mb-2">
            <div className="bg-neutral-100 text-neutral-400 w-8 h-8 rounded-full flex items-center justify-center mr-3">
              <PoundSterling className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-semibold">Sale Completion</h4>
              <p className="text-sm text-neutral-500">As soon as 7 days</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-neutral-100 py-12 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center">Loading Your Valuation...</CardTitle>
                <CardDescription className="text-center">Please wait while we retrieve your property details</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10">
                <div className="w-16 h-16 border-4 border-t-secondary rounded-full animate-spin"></div>
                <p className="mt-4 text-neutral-600">This should only take a moment</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!valuation || !property || !contact) {
    return (
      <div className="bg-neutral-100 py-12 md:py-24">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl text-center flex justify-center">
                  <AlertCircle className="mr-2 text-red-500" /> Valuation Not Found
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-center">We couldn't retrieve your property valuation. This may be due to an expired session or an invalid ID.</p>
              </CardContent>
              <CardFooter className="flex justify-center">
                <Button 
                  onClick={() => navigate('/')}
                  className="bg-accent hover:bg-accent-light"
                >
                  Return to Home
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-100 py-12 md:py-24">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          <Card className="mb-8">
            <CardHeader className="text-center bg-primary text-white rounded-t-lg">
              <CardTitle className="text-2xl md:text-3xl">Your Property Valuation</CardTitle>
              <CardDescription className="text-neutral-200">
                Based on the information you provided about your property
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-2 gap-8">
                <div>
                  <h3 className="text-xl font-bold text-primary mb-2">Estimated Market Value</h3>
                  <p className="text-3xl font-bold text-neutral-700 mb-6">
                    {formatCurrency(valuation.estimatedValue)}
                  </p>
                  
                  <h3 className="text-xl font-bold text-accent mb-2">Our Cash Offer</h3>
                  <div className="bg-accent bg-opacity-10 p-4 rounded-lg mb-6">
                    <p className="text-4xl font-bold text-accent">
                      {formatCurrency(valuation.offerValue)}
                    </p>
                    <p className="text-sm text-neutral-600 mt-1">
                      No fees, no chain, fast completion
                    </p>
                  </div>
                  
                  <div className="flex items-center text-sm text-neutral-600 mb-1">
                    <Clock3 className="h-4 w-4 mr-2 text-secondary" />
                    <span>Complete in as little as 7 days</span>
                  </div>
                  <div className="flex items-center text-sm text-neutral-600 mb-1">
                    <PoundSterling className="h-4 w-4 mr-2 text-secondary" />
                    <span>No estate agent or legal fees</span>
                  </div>
                  <div className="flex items-center text-sm text-neutral-600">
                    <CheckCircle2 className="h-4 w-4 mr-2 text-secondary" />
                    <span>Guaranteed purchase, no chain</span>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold text-primary mb-4">Property Details</h3>
                  <div className="space-y-4">
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 mr-2 text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Address</p>
                        <p className="text-neutral-600">
                          {property.addressLine1}
                          <br />
                          {property.town}, {property.postcode}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <Home className="h-5 w-5 mr-2 text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Property Type</p>
                        <p className="text-neutral-600">{mapPropertyType(property.propertyType)}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <Bed className="h-5 w-5 mr-2 text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Bedrooms</p>
                        <p className="text-neutral-600">{property.bedrooms}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start">
                      <Compass className="h-5 w-5 mr-2 text-secondary flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">Condition</p>
                        <p className="text-neutral-600">{mapCondition(property.condition)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator className="my-6" />
              
              <div>
                <h3 className="text-xl font-bold text-primary mb-4">Next Steps</h3>
                <p className="mb-4">
                  Thank you for requesting a valuation with cashpropertybuyers.uk. To proceed with your property sale and receive a formal offer, we need a few more details about your ownership.
                </p>
                
                <div className="mb-4">
                  <div className="flex justify-between mb-1 text-sm">
                    <span>Progress</span>
                    <span>{nextSteps}% Complete</span>
                  </div>
                  <Progress value={nextSteps} className="h-2" />
                </div>
                
                {renderCompletionTimeline()}
                
                <div className="mt-8 text-center">
                  <Button 
                    onClick={handleContinue}
                    className="bg-secondary hover:bg-secondary-light"
                    size="lg"
                  >
                    Continue to Ownership Details <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-xl">Traditional Sale vs. cashpropertybuyers.uk</CardTitle>
              <CardDescription>
                See how our cash offer compares to a traditional estate agent sale after accounting for all costs over a 6-month period
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CostComparison 
                marketValue={valuation?.estimatedValue || 300000} 
                cashOfferValue={valuation?.offerValue || 255000} 
              />
              
              <div className="mt-6 bg-[#791E75] text-white 50 p-4 rounded-md border border-[#791E75]200">
                <h4 className="font-bold text-[#791E75]800 mb-2">Why Our Offer Makes Sense</h4>
                <p className="text-[#791E75]700 mb-2">
                  While our initial offer may seem lower than the market value, when you consider all the costs of a traditional sale, you'll often end up with more money in your pocket with our hassle-free service.
                </p>
                <ul className="list-disc list-inside text-[#791E75]700 space-y-1">
                  <li><span className="font-semibold">No estate agent fees</span> - Save 1-3% of your property value</li>
                  <li><span className="font-semibold">No legal fees</span> - We cover all solicitor costs</li>
                  <li><span className="font-semibold">No utility bills during a lengthy sale</span> - Avoid 6+ months of ongoing costs</li>
                  <li><span className="font-semibold">No council tax while waiting</span> - Save hundreds of pounds</li>
                  <li><span className="font-semibold">No mortgage payments during sales process</span> - Avoid thousands in interest</li>
                </ul>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">How Our Valuation Works</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">
                Our valuation is calculated using a combination of factors:
              </p>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Factor</TableHead>
                    <TableHead>Impact on Valuation</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Location &amp; Postcode</TableCell>
                    <TableCell>High - Local market values vary significantly across regions</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Property Type</TableCell>
                    <TableCell>High - Detached homes typically valued higher than flats</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Number of Bedrooms</TableCell>
                    <TableCell>Medium - More bedrooms generally increases value</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Property Condition</TableCell>
                    <TableCell>Medium - Properties in good condition command better prices</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Recent Sales Data</TableCell>
                    <TableCell>High - We analyze recent comparable sales in your area</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <p className="mt-4 text-sm text-neutral-600">
                Note: This initial valuation is an estimate based on the information provided. Our final offer may be adjusted following a property assessment.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ValuationResult;
