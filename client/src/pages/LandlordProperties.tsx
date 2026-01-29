import { useQuery } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Home, MapPin, Bed, Bath, Square, Eye } from 'lucide-react';

interface Landlord {
  id: number;
  fullName: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface Property {
  id: number;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  landlordId?: number;
  status?: string;
  monthlyRent?: number;
}

export default function LandlordProperties() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const landlordId = parseInt(id || '0');

  // Fetch landlord using the main landlords endpoint (which uses pm_landlords table)
  const { data: landlord, isLoading: landlordLoading } = useQuery<Landlord>({
    queryKey: ['/api/crm/landlords', landlordId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/landlords/${landlordId}`);
      if (!res.ok) throw new Error('Landlord not found');
      return res.json();
    },
    enabled: !!landlordId,
  });

  // Fetch properties for this landlord
  const { data: properties = [], isLoading: propertiesLoading } = useQuery<Property[]>({
    queryKey: ['/api/crm/pm/properties', 'landlord', landlordId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/pm/properties?landlordId=${landlordId}`);
      if (!res.ok) throw new Error('Failed to fetch properties');
      return res.json();
    },
    enabled: !!landlordId,
  });

  const landlordProperties = properties;

  if (landlordLoading || propertiesLoading) {
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
              Properties for {landlord?.fullName || landlord?.name || `Landlord #${landlordId}`}
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
              <Card
                key={property.id}
                className="hover-elevate cursor-pointer hover:shadow-lg transition-shadow"
                data-testid={`card-property-${property.id}`}
                onClick={() => setLocation(`/crm/managed-property/${property.id}`)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-lg line-clamp-1">
                      {property.address || property.addressLine1 || 'Property'}
                    </CardTitle>
                    <Badge variant={property.status === 'active' ? 'default' : 'secondary'}>
                      {property.status || 'active'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="text-sm line-clamp-1">
                        {property.addressLine1 || property.address}{property.postcode ? `, ${property.postcode}` : ''}
                      </span>
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
                      {property.propertyType && (
                        <div className="flex items-center gap-1 capitalize">
                          <span>{property.propertyType}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="font-semibold text-lg">
                        {property.monthlyRent ? `£${property.monthlyRent.toLocaleString()}` : 'Rent TBC'}
                        <span className="text-sm font-normal text-muted-foreground">/month</span>
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/crm/managed-property/${property.id}`);
                        }}
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
