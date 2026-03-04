import { Bed, Bath, Home, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChatPropertyCardProps {
  property: {
    id: number;
    title?: string;
    addressLine1?: string;
    address?: string;
    postcode?: string;
    price?: number;
    rentAmount?: number;
    bedrooms?: number;
    bathrooms?: number;
    propertyType?: string;
    images?: string[];
    isRental?: boolean;
  };
  onBookViewing: (propertyId: number) => void;
  isCurrentProperty?: boolean;
}

export default function ChatPropertyCard({ property, onBookViewing, isCurrentProperty }: ChatPropertyCardProps) {
  const displayAddress = property.title || property.addressLine1 || property.address || 'Property';
  const displayPrice = property.isRental
    ? `£${Math.round((property.rentAmount || property.price || 0) / 4.33).toLocaleString()} /pw`
    : `£${(property.price || 0).toLocaleString()}`;
  const imageUrl = property.images?.[0] || '/api/placeholder/400/250';

  return (
    <div className={`rounded-lg border overflow-hidden bg-white shadow-sm ${isCurrentProperty ? 'ring-2 ring-[#791E75]' : ''}`}>
      <div className="relative h-36 bg-gray-100">
        <img
          src={imageUrl}
          alt={displayAddress}
          className="w-full h-full object-cover"
        />
        {isCurrentProperty && (
          <span className="absolute top-2 left-2 bg-[#791E75] text-white text-xs px-2 py-1 rounded">
            Your enquiry
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4 className="font-semibold text-sm text-gray-900 line-clamp-1">{displayAddress}</h4>
          <span className="text-sm font-bold text-[#791E75] whitespace-nowrap">{displayPrice}</span>
        </div>
        {property.postcode && (
          <p className="text-xs text-gray-500 flex items-center gap-1 mb-2">
            <MapPin className="h-3 w-3" />{property.postcode}
          </p>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-600 mb-3">
          {property.bedrooms && (
            <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{property.bedrooms} bed</span>
          )}
          {property.bathrooms && (
            <span className="flex items-center gap-1"><Bath className="h-3 w-3" />{property.bathrooms} bath</span>
          )}
          {property.propertyType && (
            <span className="flex items-center gap-1"><Home className="h-3 w-3" />{property.propertyType}</span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-[#791E75] hover:bg-[#631560] text-white text-xs"
            onClick={() => onBookViewing(property.id)}
          >
            Book Viewing
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => window.open(`/property/${property.id}`, '_blank')}
          >
            Details
          </Button>
        </div>
      </div>
    </div>
  );
}
