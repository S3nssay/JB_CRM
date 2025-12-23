import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PropertyMiniMap } from './PropertyMap';
import { PropertyQRCode } from './PropertyQRCode';
import {
  Home, Bed, Bath, Square, Eye, Edit, Share2, Trash2,
  MapPin, Building2, Tag, Calendar, MoreVertical, QrCode, MessageCircle
} from 'lucide-react';
import { Link } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export interface PropertyCardData {
  id: number;
  title: string;
  addressLine1?: string;
  addressLine2?: string;
  postcode: string;
  area?: string;
  propertyType: string;
  listingType: 'sale' | 'rental' | 'commercial';
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  status: string;
  primaryImage?: string;
  sqft?: number;
  status: string;
  primaryImage?: string;
  createdAt?: string;
  latitude?: number | null;
  longitude?: number | null;
}

interface PropertyCardProps {
  property: PropertyCardData;
  onView?: (id: number, listingType?: string) => void;
  onEdit?: (id: number) => void;
  onShare?: (property: PropertyCardData) => void;
  onDelete?: (id: number) => void;
  showMap?: boolean;
  compact?: boolean;
}

export function PropertyCard({
  property,
  onView,
  onEdit,
  onShare,
  onDelete,
  showMap = true,
  compact = false
}: PropertyCardProps) {
  const formatPrice = (price: number, type: string) => {
    const formatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(price);
    return type === 'rental' ? `${formatted}/mo` : formatted;
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
      case 'available':
        return 'bg-green-100 text-green-800';
      case 'under offer':
      case 'let agreed':
        return 'bg-yellow-100 text-yellow-800';
      case 'sold':
      case 'let':
        return 'bg-blue-100 text-blue-800';
      case 'withdrawn':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'sale':
        return 'bg-[#791E75] text-white';
      case 'rental':
        return 'bg-[#F8B324] text-black';
      case 'commercial':
        return 'bg-purple-600 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  if (compact) {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex gap-4">
            {/* Map/Image */}
            <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100">
              {showMap ? (
                <PropertyMiniMap
                  postcode={property.postcode}
                  latitude={property.latitude}
                  longitude={property.longitude}
                  className="w-full h-full"
                />
              ) : property.primaryImage ? (
                <img
                  src={property.primaryImage}
                  alt={property.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Building2 className="h-8 w-8 text-gray-300" />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-sm truncate">{property.title}</h3>
                <Badge className={`text-xs flex-shrink-0 ${getTypeColor(property.listingType)}`}>
                  {property.listingType === 'sale' ? 'Sale' : property.listingType === 'rental' ? 'Rent' : 'Commercial'}
                </Badge>
              </div>

              <div className="flex items-center text-xs text-gray-500 mt-1">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="truncate">{property.postcode}</span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-[#791E75]">
                  {formatPrice(property.price, property.listingType)}
                </span>
                <Badge variant="outline" className={`text-xs ${getStatusColor(property.status)}`}>
                  {property.status}
                </Badge>
              </div>
            </div>

            {/* Actions */}
            <div className="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {onView && (
                    <DropdownMenuItem onClick={() => onView(property.id, property.listingType)}>
                      <Eye className="h-4 w-4 mr-2" /> View
                    </DropdownMenuItem>
                  )}
                  {onEdit && (
                    <DropdownMenuItem onClick={() => onEdit(property.id)}>
                      <Edit className="h-4 w-4 mr-2" /> Edit
                    </DropdownMenuItem>
                  )}
                  {onShare && (
                    <DropdownMenuItem onClick={() => onShare(property)}>
                      <Share2 className="h-4 w-4 mr-2" /> Share
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href={`/crm/communications?propertyId=${property.id}`}>
                      <MessageCircle className="h-4 w-4 mr-2" /> Communications
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <div className="w-full">
                      <PropertyQRCode
                        propertyId={property.id}
                        propertyTitle={property.title}
                        postcode={property.postcode}
                        listingType={property.listingType}
                        variant="button"
                      />
                    </div>
                  </DropdownMenuItem>
                  {onDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onDelete(property.id)} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" /> Delete
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-lg transition-shadow overflow-hidden">
      {/* Map/Image Header */}
      <div className="relative h-40 bg-gray-100">
        {showMap ? (
          <PropertyMiniMap
            postcode={property.postcode}
            latitude={property.latitude}
            longitude={property.longitude}
            className="w-full h-full"
          />
        ) : property.primaryImage ? (
          <img
            src={property.primaryImage}
            alt={property.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Building2 className="h-12 w-12 text-gray-300" />
          </div>
        )}

        {/* Type Badge */}
        <Badge className={`absolute top-3 left-3 ${getTypeColor(property.listingType)}`}>
          {property.listingType === 'sale' ? 'For Sale' : property.listingType === 'rental' ? 'To Rent' : 'Commercial'}
        </Badge>

        {/* Status Badge */}
        <Badge className={`absolute top-3 right-3 ${getStatusColor(property.status)}`}>
          {property.status}
        </Badge>

        {/* Price Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <span className="text-white font-bold text-lg">
            {formatPrice(property.price, property.listingType)}
          </span>
        </div>
      </div>

      <CardContent className="p-4">
        {/* Title & Address */}
        <h3 className="font-semibold text-base mb-1 truncate">{property.title}</h3>
        <div className="flex items-center text-sm text-gray-500 mb-3">
          <MapPin className="h-4 w-4 mr-1 flex-shrink-0" />
          <span className="truncate">
            {property.addressLine1 ? `${property.addressLine1}, ` : ''}{property.postcode}
          </span>
        </div>

        {/* Property Details */}
        <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
          {property.bedrooms !== undefined && (
            <div className="flex items-center">
              <Bed className="h-4 w-4 mr-1" />
              <span>{property.bedrooms}</span>
            </div>
          )}
          {property.bathrooms !== undefined && (
            <div className="flex items-center">
              <Bath className="h-4 w-4 mr-1" />
              <span>{property.bathrooms}</span>
            </div>
          )}
          {property.sqft !== undefined && (
            <div className="flex items-center">
              <Square className="h-4 w-4 mr-1" />
              <span>{property.sqft} sqft</span>
            </div>
          )}
          <div className="flex items-center">
            <Home className="h-4 w-4 mr-1" />
            <span className="capitalize">{property.propertyType}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {onView && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onView(property.id, property.listingType)}
            >
              <Eye className="h-4 w-4 mr-1" /> View
            </Button>
          )}
          {onEdit && (
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => onEdit(property.id)}
            >
              <Edit className="h-4 w-4 mr-1" /> Edit
            </Button>
          )}
          {onShare && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onShare(property)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
          <Link href={`/crm/communications?propertyId=${property.id}`}>
            <Button variant="ghost" size="sm" title="Communication History">
              <MessageCircle className="h-4 w-4" />
            </Button>
          </Link>
          <PropertyQRCode
            propertyId={property.id}
            propertyTitle={property.title}
            postcode={property.postcode}
            listingType={property.listingType}
            variant="button"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default PropertyCard;
