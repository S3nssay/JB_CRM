import { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft,
  Bed,
  Bath,
  Home,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Mail
} from 'lucide-react';
import { Link, useParams } from 'wouter';

interface Property {
  id: number;
  listingType: string;
  title: string;
  description: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  receptions?: number;
  squareFootage?: number;
  addressLine1: string;
  addressLine2?: string;
  postcode: string;
  images: string[];
  features: string[];
  amenities: string[];
  tenure: string;
  councilTaxBand?: string;
  energyRating?: string;
  yearBuilt?: number;
  areaName?: string;
  rentPeriod?: string;
  furnished?: string;
  deposit?: number;
}

export default function PropertyDetailPage() {
  const { id } = useParams();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const thumbnailContainerRef = useRef<HTMLDivElement>(null);
  
  const VISIBLE_THUMBNAILS = 3;

  const { data: property, isLoading } = useQuery<Property>({
    queryKey: ['/api/properties', id],
    queryFn: async () => {
      const response = await fetch(`/api/properties/${id}`);
      if (!response.ok) throw new Error('Property not found');
      return response.json();
    }
  });

  const formatPrice = (price: number) => {
    if (property?.listingType === 'rental') {
      const weekly = Math.round(price / 4.33);
      return `£${weekly.toLocaleString()} /pw`;
    }
    return `£${price.toLocaleString()}`;
  };

  const nextImage = () => {
    if (property?.images) {
      const newIndex = (currentImageIndex + 1) % property.images.length;
      setCurrentImageIndex(newIndex);
      if (newIndex >= thumbnailStartIndex + VISIBLE_THUMBNAILS) {
        setThumbnailStartIndex(Math.min(newIndex, property.images.length - VISIBLE_THUMBNAILS));
      } else if (newIndex < thumbnailStartIndex) {
        setThumbnailStartIndex(newIndex);
      }
    }
  };

  const prevImage = () => {
    if (property?.images) {
      const newIndex = (currentImageIndex - 1 + property.images.length) % property.images.length;
      setCurrentImageIndex(newIndex);
      if (newIndex < thumbnailStartIndex) {
        setThumbnailStartIndex(newIndex);
      } else if (newIndex >= thumbnailStartIndex + VISIBLE_THUMBNAILS) {
        setThumbnailStartIndex(Math.max(0, newIndex - VISIBLE_THUMBNAILS + 1));
      }
    }
  };

  const scrollThumbnailsUp = () => {
    if (thumbnailStartIndex > 0) {
      setThumbnailStartIndex(thumbnailStartIndex - 1);
    }
  };

  const scrollThumbnailsDown = () => {
    if (property?.images && thumbnailStartIndex < property.images.length - VISIBLE_THUMBNAILS) {
      setThumbnailStartIndex(thumbnailStartIndex + 1);
    }
  };

  const selectThumbnail = (index: number) => {
    setCurrentImageIndex(index);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#791E75] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-700 text-lg">Loading property details...</p>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Property Not Found</h1>
          <p className="text-gray-600 mb-8">The property you're looking for doesn't exist.</p>
          <Link href="/sales">
            <Button className="bg-[#791E75] hover:bg-[#5d1759] text-white font-bold">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Listings
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const visibleThumbnails = property.images?.slice(thumbnailStartIndex, thumbnailStartIndex + VISIBLE_THUMBNAILS) || [];
  const canScrollUp = thumbnailStartIndex > 0;
  const canScrollDown = property.images && thumbnailStartIndex < property.images.length - VISIBLE_THUMBNAILS;

  return (
    <div className="min-h-screen bg-white">
      {/* Back Button */}
      <div className="bg-gray-100 px-4 py-2">
        <Link href={`/${property.listingType === 'rental' ? 'rentals' : 'sales'}`}>
          <Button variant="ghost" className="text-gray-700 hover:text-gray-900" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Listings
          </Button>
        </Link>
      </div>

      {/* Top Info Bar */}
      <div className="bg-[#791E75] text-white">
        <div className="max-w-7xl mx-auto flex items-center">
          <div className="flex items-center gap-1 px-6 py-4 border-r border-white/20">
            <Bed className="h-5 w-5 mr-2" />
            <span className="font-medium">{property.bedrooms} Bed</span>
          </div>
          <div className="flex items-center gap-1 px-6 py-4 border-r border-white/20">
            <Bath className="h-5 w-5 mr-2" />
            <span className="font-medium">{property.bathrooms} Bath</span>
          </div>
          <div className="flex items-center gap-1 px-6 py-4 border-r border-white/20">
            <Home className="h-5 w-5 mr-2" />
            <span className="font-medium capitalize">{property.propertyType}</span>
          </div>
          <div className="px-6 py-4 bg-[#F8B324] text-black font-bold flex-grow text-center text-xl" data-testid="text-price">
            Price: {formatPrice(property.price)}
          </div>
          <Button 
            className="bg-[#F8B324] hover:bg-[#d89b1f] text-black font-bold px-8 py-6 rounded-none h-full"
            data-testid="button-enquiry"
          >
            <Mail className="mr-2 h-5 w-5" />
            Make Enquiry
          </Button>
        </div>
      </div>

      {/* Main Image Gallery Section */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-4">
          {/* Main Image */}
          <div className="flex-grow relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '500px' }}>
            <img 
              src={property.images?.[currentImageIndex] || '/api/placeholder/1200/800'}
              alt={property.title}
              className="w-full h-full object-cover"
              data-testid="img-main"
            />
            
            {/* Navigation Arrows */}
            {property.images && property.images.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-[#791E75]/80 hover:bg-[#791E75] text-white rounded-md p-3 transition-colors"
                  data-testid="button-prev"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-[#791E75]/80 hover:bg-[#791E75] text-white rounded-md p-3 transition-colors"
                  data-testid="button-next"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Thumbnail Strip (Right Side) */}
          {property.images && property.images.length > 1 && (
            <div className="flex flex-col items-center w-40" style={{ height: '500px' }}>
              {/* Up Arrow */}
              <button
                onClick={scrollThumbnailsUp}
                disabled={!canScrollUp}
                className={`w-full py-2 flex justify-center bg-[#e8d4e7] rounded-t-lg transition-colors ${
                  canScrollUp ? 'hover:bg-[#d4b8d3] text-[#791E75]' : 'text-gray-400 cursor-not-allowed'
                }`}
                data-testid="button-thumb-up"
              >
                <ChevronUp className="w-6 h-6" />
              </button>

              {/* Thumbnails Container */}
              <div 
                ref={thumbnailContainerRef}
                className="flex-grow flex flex-col gap-2 py-2 bg-[#e8d4e7] w-full px-2"
              >
                {visibleThumbnails.map((image, idx) => {
                  const actualIndex = thumbnailStartIndex + idx;
                  return (
                    <button
                      key={actualIndex}
                      onClick={() => selectThumbnail(actualIndex)}
                      className={`w-full aspect-[4/3] rounded-lg overflow-hidden border-4 transition-all ${
                        currentImageIndex === actualIndex 
                          ? 'border-[#791E75]' 
                          : 'border-transparent hover:border-[#791E75]/50'
                      }`}
                      data-testid={`button-thumb-${actualIndex}`}
                    >
                      <img 
                        src={image}
                        alt={`Thumbnail ${actualIndex + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  );
                })}
              </div>

              {/* Down Arrow */}
              <button
                onClick={scrollThumbnailsDown}
                disabled={!canScrollDown}
                className={`w-full py-2 flex justify-center bg-[#e8d4e7] rounded-b-lg transition-colors ${
                  canScrollDown ? 'hover:bg-[#d4b8d3] text-[#791E75]' : 'text-gray-400 cursor-not-allowed'
                }`}
                data-testid="button-thumb-down"
              >
                <ChevronDown className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Property Description and Key Features */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Property Description */}
          <div>
            <h2 className="text-2xl font-bold text-[#791E75] mb-4" data-testid="heading-description">
              Property Description
            </h2>
            <p className="text-gray-700 leading-relaxed" data-testid="text-description">
              {property.description}
            </p>
          </div>

          {/* Key Features */}
          <div>
            <h2 className="text-2xl font-bold text-[#791E75] mb-4" data-testid="heading-features">
              Key Features
            </h2>
            <ul className="space-y-2" data-testid="list-features">
              {property.features?.map((feature, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-[#791E75] mt-1.5">&#8226;</span>
                  <span className="text-gray-700 capitalize">{feature.replace(/_/g, ' ')}</span>
                </li>
              ))}
              {property.furnished && (
                <li className="flex items-start gap-2">
                  <span className="text-[#791E75] mt-1.5">&#8226;</span>
                  <span className="text-gray-700 capitalize">{property.furnished.replace(/_/g, ' ')}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Additional Details Section */}
      <div className="max-w-7xl mx-auto px-4 py-8 border-t border-gray-200">
        <h2 className="text-2xl font-bold text-[#791E75] mb-6">Property Details</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Address:</span>
              <span className="text-gray-900 font-medium">{property.addressLine1}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Postcode:</span>
              <span className="text-gray-900 font-medium">{property.postcode}</span>
            </div>
            {property.areaName && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Area:</span>
                <span className="text-gray-900 font-medium">{property.areaName}</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Property Type:</span>
              <span className="text-gray-900 font-medium capitalize">{property.propertyType}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100">
              <span className="text-gray-600">Tenure:</span>
              <span className="text-gray-900 font-medium capitalize">{property.tenure}</span>
            </div>
            {property.squareFootage && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Size:</span>
                <span className="text-gray-900 font-medium">{property.squareFootage} sq ft</span>
              </div>
            )}
          </div>
          <div className="space-y-3">
            {property.councilTaxBand && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Council Tax:</span>
                <span className="text-gray-900 font-medium">Band {property.councilTaxBand}</span>
              </div>
            )}
            {property.energyRating && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">EPC Rating:</span>
                <span className="text-gray-900 font-medium">{property.energyRating}</span>
              </div>
            )}
            {property.deposit && (
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Deposit:</span>
                <span className="text-gray-900 font-medium">£{property.deposit.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
