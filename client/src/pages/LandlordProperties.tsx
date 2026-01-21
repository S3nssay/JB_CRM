import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, MapPin, Bed, Bath, Square, Eye } from 'lucide-react';
import type { Property, Landlord, RentalAgreement } from '@shared/schema';

export default function LandlordProperties() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const landlordId = parseInt(id || '0');

  const { data: landlord, isLoading: landlordLoading } = useQuery<Landlord>({
    queryKey: ['/api/crm/landlords', landlordId],
    enabled: !!landlordId,
  });

  const { data: agreements = [], isLoading: agreementsLoading } = useQuery<RentalAgreement[]>({
    queryKey: ['/api/crm/rental-agreements'],
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ['/api/crm/properties'],
  });

  const landlordAgreements = agreements.filter(a => a.landlordId === landlordId);
  const landlordPropertyIds = new Set(landlordAgreements.map(a => a.propertyId));
  const landlordProperties = properties.filter(p => landlordPropertyIds.has(p.id));

  if (landlordLoading || agreementsLoading || propertiesLoading) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-64 bg-muted rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setLocation('/crm/landlords')}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">
              Properties for {landlord?.fullName || `Landlord #${landlordId}`}
            </h1>
            <p className="text-muted-foreground">
              {landlordProperties.length} {landlordProperties.length === 1 ? 'property' : 'properties'} found
            </p>
          </div>
        </div>

        {landlordProperties.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Home className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No Properties Found</h3>
              <p className="text-muted-foreground text-center">
                This landlord doesn't have any properties assigned yet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {landlordProperties.map((property) => (
              <Card key={property.id} className="hover-elevate cursor-pointer" data-testid={`card-property-${property.id}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">{property.title}</CardTitle>
                    <Badge variant={property.status === 'active' ? 'default' : 'secondary'}>
                      {property.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm line-clamp-1">{property.addressLine1}, {property.postcode}</span>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      {property.bedrooms && (
                        <div className="flex items-center gap-1">
                          <Bed className="h-4 w-4 text-muted-foreground" />
                          <span>{property.bedrooms}</span>
                        </div>
                      )}
                      {property.bathrooms && (
                        <div className="flex items-center gap-1">
                          <Bath className="h-4 w-4 text-muted-foreground" />
                          <span>{property.bathrooms}</span>
                        </div>
                      )}
                      {property.squareFootage && (
                        <div className="flex items-center gap-1">
                          <Square className="h-4 w-4 text-muted-foreground" />
                          <span>{property.squareFootage} sqft</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-semibold text-lg">
                        {property.price ? `£${property.price.toLocaleString()}` : 'Price on request'}
                        {property.listingType === 'rental' && <span className="text-sm font-normal text-muted-foreground">/month</span>}
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={() => setLocation(`/crm/property-management`)}
                        data-testid={`button-view-property-${property.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
