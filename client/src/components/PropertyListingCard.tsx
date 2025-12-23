import { useState } from 'react';
import { PropertyListing, propertyListingsService } from '@/services/propertyListingsService';
import { Bed, Bath, MapPin, Tag, Calendar, User, MessageCircle, Home, FileText, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PropertyListingCardProps {
  property: PropertyListing;
  className?: string;
  onViewDetails?: (property: PropertyListing) => void;
}

export const PropertyListingCard: React.FC<PropertyListingCardProps> = ({
  property,
  className = '',
  onViewDetails
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleViewDetails = () => {
    if (onViewDetails) {
      onViewDetails(property);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (property.images.length > 0) {
      setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
    }
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (property.images.length > 0) {
      setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
    }
  };

  const selectImage = (index: number) => {
    setCurrentImageIndex(index);
  };

  const placeholderImage = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDQwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIiBmaWxsPSIjRjNGNEY2Ii8+CjxwYXRoIGQ9Ik0yMDAgMTIwVjE4MEgyNDBWMjQwSDI2MFYyMDBIMzAwVjE4MEgyNDBWMTIwSDIwMFoiIGZpbGw9IiM5Q0E5QjciLz4KPHRleHQgeD0iMjAwIiB5PSIyNzAiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZpbGw9IiM2QjczODAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCI+UHJvcGVydHkgSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';

  return (
    <div className={`bg-white dark:bg-gray-900 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 flex flex-col ${className}`}>
      {/* Image Gallery with Thumbnails */}
      <div className="flex flex-shrink-0">
        {/* Thumbnail Strip - Left Side */}
        {property.images.length > 1 && (
          <div className="w-16 bg-gray-100 dark:bg-gray-800 flex flex-col gap-1 p-1 overflow-y-auto max-h-64">
            {property.images.slice(0, 5).map((img, index) => (
              <button
                key={index}
                onClick={() => selectImage(index)}
                className={`relative flex-shrink-0 w-full aspect-square rounded overflow-hidden border-2 transition-colors ${
                  currentImageIndex === index 
                    ? 'border-[#791E75]' 
                    : 'border-transparent hover:border-gray-400'
                }`}
                data-testid={`button-thumbnail-${index}`}
              >
                <img
                  src={img}
                  alt={`${property.address} - ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = placeholderImage;
                  }}
                />
              </button>
            ))}
            {property.images.length > 5 && (
              <div className="flex-shrink-0 w-full aspect-square rounded bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-600 dark:text-gray-300">
                +{property.images.length - 5}
              </div>
            )}
            {property.floorPlan && (
              <button
                className="flex-shrink-0 w-full aspect-square rounded bg-gray-200 dark:bg-gray-700 flex flex-col items-center justify-center border-2 border-transparent hover:border-[#791E75] transition-colors"
                data-testid="button-floorplan"
              >
                <FileText className="w-4 h-4 text-[#791E75]" />
                <span className="text-[8px] font-semibold text-[#791E75] mt-0.5">Plan</span>
              </button>
            )}
          </div>
        )}

        {/* Main Image with Navigation */}
        <div className="relative flex-1 h-64 bg-gray-200 dark:bg-gray-800">
          {property.images.length > 0 ? (
            <img
              src={property.images[currentImageIndex]}
              alt={property.address}
              className="w-full h-full object-cover"
              data-testid="img-property-main"
              onError={(e) => {
                (e.target as HTMLImageElement).src = placeholderImage;
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-gray-500">
                <MapPin className="w-12 h-12 mx-auto mb-2" />
                <p>Property Image</p>
              </div>
            </div>
          )}

          {/* Navigation Arrows */}
          {property.images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-black/70 rounded-full p-1.5 shadow-lg hover:bg-white dark:hover:bg-black transition-colors"
                data-testid="button-prev-image"
              >
                <ChevronLeft className="w-5 h-5 text-gray-800 dark:text-white" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 dark:bg-black/70 rounded-full p-1.5 shadow-lg hover:bg-white dark:hover:bg-black transition-colors"
                data-testid="button-next-image"
              >
                <ChevronRight className="w-5 h-5 text-gray-800 dark:text-white" />
              </button>
            </>
          )}

          {/* Image Counter */}
          {property.images.length > 1 && (
            <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1 rounded text-sm">
              {currentImageIndex + 1}/{property.images.length}
            </div>
          )}

          {/* Listing Type Badge */}
          <div className={`absolute top-3 left-3 px-3 py-1 rounded text-sm font-semibold text-white ${
            property.listingType === 'sale' ? 'bg-[#791E75]' : 'bg-[#F8B324] text-black'
          }`}>
            {property.listingType === 'sale' ? 'FOR SALE' : 'TO LET'}
          </div>
        </div>
      </div>

      {/* Property Details */}
      <div className="p-5 flex flex-col flex-grow">
        {/* Address */}
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1" data-testid="text-property-address">
          {property.address}
        </h3>

        {/* Price */}
        <div className="mb-3">
          <span className="text-2xl font-bold text-[#791E75]" data-testid="text-property-price">
            {propertyListingsService.formatPrice(property.price, property.listingType)}
          </span>
        </div>

        {/* Property Stats */}
        <div className="grid grid-cols-4 gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">TYPE</div>
            <div className="flex items-center justify-center gap-1">
              <Home className="w-4 h-4 text-[#791E75]" />
              <span className="text-sm font-semibold capitalize text-gray-900 dark:text-white" data-testid="text-property-type">
                {propertyListingsService.getPropertyTypeLabel(property.propertyType)}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">BEDS</div>
            <div className="flex items-center justify-center gap-1">
              <Bed className="w-4 h-4 text-[#791E75]" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="text-property-bedrooms">
                {property.bedrooms}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">BATHS</div>
            <div className="flex items-center justify-center gap-1">
              <Bath className="w-4 h-4 text-[#791E75]" />
              <span className="text-sm font-semibold text-gray-900 dark:text-white" data-testid="text-property-bathrooms">
                {property.bathrooms}
              </span>
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">TENURE</div>
            <div className="flex items-center justify-center gap-1">
              <Tag className="w-4 h-4 text-[#791E75]" />
              <span className="text-sm font-semibold capitalize text-gray-900 dark:text-white" data-testid="text-property-tenure">
                {property.tenure}
              </span>
            </div>
          </div>
        </div>

        {/* Key Features Section */}
        {(property.keyFeatures && property.keyFeatures.length > 0) && (
          <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Key features</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {property.keyFeatures.slice(0, 4).map((feature, index) => (
                <li key={index} className="text-sm text-gray-700 dark:text-gray-300 flex items-start">
                  <span className="text-[#791E75] mr-2">•</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
            {property.epcRating && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Zap className="w-4 h-4 text-[#F8B324]" />
                <span className="font-semibold text-gray-900 dark:text-white">EPC:</span>
                <span className="bg-[#F8B324] text-black px-2 py-0.5 rounded font-bold">
                  {property.epcRating}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Description */}
        <div className="mb-4 flex-grow">
          <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">Description</h4>
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3" data-testid="text-property-description">
            {property.description}
          </p>
        </div>

        {/* Agent & Date */}
        <div className="flex flex-wrap justify-between items-center gap-2 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>Listed by {property.agent?.name || 'John Barclay Estate & Management'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>Added {formatDate(property.dateAdded)}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 mt-auto">
          <Button
            onClick={handleViewDetails}
            className="w-full bg-[#791E75] hover:bg-[#5d1759] text-white"
            data-testid="button-view-details"
          >
            View Full Details
          </Button>
          <Button
            variant="outline"
            className="w-full flex items-center justify-center gap-2 border-[#791E75] text-[#791E75] hover:bg-purple-50 dark:hover:bg-purple-900/20"
            data-testid="button-contact-agent"
            onClick={() => window.open(`https://wa.me/447123456789?text=${encodeURIComponent(`Hi, I'm interested in the property at: ${property.address}, ${property.postcode}`)}`, '_blank')}
          >
            <MessageCircle className="w-4 h-4" />
            Contact Agent
          </Button>
        </div>
      </div>
    </div>
  );
};
