import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { PropertyMiniMap } from './PropertyMap';
import { PropertyQRCode } from './PropertyQRCode';
import {
  Home, Bed, Bath, Square, Eye, Edit, Share2, Trash2,
  MapPin, Building2, Tag, Calendar, MoreVertical, QrCode, MessageCircle, Globe, Send
} from 'lucide-react';
import { Link } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

export interface PropertyCardData {
  id: number;
  title: string;
  addressLine1?: string;
  addressLine2?: string;
  postcode: string;
  area?: string;
  propertyType: string;
  isRental: boolean; // true = rental, false = sale
  isResidential?: boolean; // true = residential, false = commercial
  price: number;
  bedrooms?: number;
  bathrooms?: number;
  sqft?: number;
  status: string;
  primaryImage?: string;
  createdAt?: string;
  latitude?: number | null;
  longitude?: number | null;
  // Publishing flags
  isPublishedWebsite?: boolean;
  isPublishedZoopla?: boolean;
  isPublishedRightmove?: boolean;
  isPublishedOnTheMarket?: boolean;
  isPublishedSocial?: boolean;
}

interface PropertyCardProps {
  property: PropertyCardData;
  onView?: (id: number, isRental?: boolean) => void;
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
  const { toast } = useToast();
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishSettings, setPublishSettings] = useState({
    isPublishedWebsite: property.isPublishedWebsite ?? false,
    isPublishedZoopla: property.isPublishedZoopla ?? false,
    isPublishedRightmove: property.isPublishedRightmove ?? false,
    isPublishedOnTheMarket: property.isPublishedOnTheMarket ?? false,
    isPublishedSocial: property.isPublishedSocial ?? false,
  });

  const handleSavePublishSettings = async () => {
    setPublishing(true);
    try {
      await apiRequest(`/api/crm/properties/${property.id}`, 'PATCH', publishSettings);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      toast({
        title: "Publishing settings saved",
        description: "Property visibility has been updated.",
      });
      setPublishDialogOpen(false);
    } catch (error) {
      toast({
        title: "Failed to save",
        description: "Could not update publishing settings.",
        variant: "destructive"
      });
    } finally {
      setPublishing(false);
    }
  };

  const formatPrice = (price: number, isRental: boolean) => {
    const formatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(price);
    return isRental ? `${formatted}/mo` : formatted;
  };

  // Helper to get listing type label
  const getListingTypeLabel = (isRental: boolean, isResidential?: boolean) => {
    if (isResidential === false) return 'Commercial';
    return isRental ? 'Rent' : 'Sale';
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

  const getTypeColor = (isRental: boolean, isResidential?: boolean) => {
    if (isResidential === false) return 'bg-purple-600 text-white';
    return isRental ? 'bg-[#F8B324] text-black' : 'bg-[#791E75] text-white';
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
                <Badge className={`text-xs flex-shrink-0 ${getTypeColor(property.isRental, property.isResidential)}`}>
                  {getListingTypeLabel(property.isRental, property.isResidential)}
                </Badge>
              </div>

              <div className="flex items-center text-xs text-gray-500 mt-1">
                <MapPin className="h-3 w-3 mr-1" />
                <span className="truncate">{property.postcode}</span>
              </div>

              <div className="flex items-center justify-between mt-2">
                <span className="font-bold text-[#791E75]">
                  {formatPrice(property.price, property.isRental)}
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
                    <DropdownMenuItem onClick={() => onView(property.id, property.isRental)}>
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
                  <DropdownMenuItem onClick={() => setPublishDialogOpen(true)}>
                    <Globe className="h-4 w-4 mr-2" /> Publish Settings
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <div className="w-full">
                      <PropertyQRCode
                        propertyId={property.id}
                        propertyTitle={property.title}
                        postcode={property.postcode}
                        isRental={property.isRental}
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
        <Badge className={`absolute top-3 left-3 ${getTypeColor(property.isRental, property.isResidential)}`}>
          {property.isResidential === false ? 'Commercial' : property.isRental ? 'To Rent' : 'For Sale'}
        </Badge>

        {/* Status Badge */}
        <Badge className={`absolute top-3 right-3 ${getStatusColor(property.status)}`}>
          {property.status}
        </Badge>

        {/* Price Overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
          <span className="text-white font-bold text-lg">
            {formatPrice(property.price, property.isRental)}
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
              onClick={() => onView(property.id, property.isRental)}
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
          <Button variant="ghost" size="sm" onClick={() => setPublishDialogOpen(true)} title="Publish Settings">
            <Globe className="h-4 w-4" />
          </Button>
          <PropertyQRCode
            propertyId={property.id}
            propertyTitle={property.title}
            postcode={property.postcode}
            isRental={property.isRental}
            variant="button"
          />
        </div>
      </CardContent>

      {/* Publish Settings Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Settings</DialogTitle>
            <DialogDescription>
              Control where this property is visible
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="website"
                checked={publishSettings.isPublishedWebsite}
                onCheckedChange={(checked) => setPublishSettings(s => ({ ...s, isPublishedWebsite: !!checked }))}
              />
              <Label htmlFor="website" className="flex items-center gap-2 cursor-pointer">
                <Globe className="h-4 w-4 text-blue-600" />
                Company Website
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="zoopla"
                checked={publishSettings.isPublishedZoopla}
                onCheckedChange={(checked) => setPublishSettings(s => ({ ...s, isPublishedZoopla: !!checked }))}
              />
              <Label htmlFor="zoopla" className="flex items-center gap-2 cursor-pointer">
                <Send className="h-4 w-4 text-purple-600" />
                Zoopla
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="rightmove"
                checked={publishSettings.isPublishedRightmove}
                onCheckedChange={(checked) => setPublishSettings(s => ({ ...s, isPublishedRightmove: !!checked }))}
              />
              <Label htmlFor="rightmove" className="flex items-center gap-2 cursor-pointer">
                <Send className="h-4 w-4 text-green-600" />
                Rightmove
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="onthemarket"
                checked={publishSettings.isPublishedOnTheMarket}
                onCheckedChange={(checked) => setPublishSettings(s => ({ ...s, isPublishedOnTheMarket: !!checked }))}
              />
              <Label htmlFor="onthemarket" className="flex items-center gap-2 cursor-pointer">
                <Send className="h-4 w-4 text-orange-600" />
                OnTheMarket
              </Label>
            </div>
            <div className="flex items-center space-x-3">
              <Checkbox
                id="social"
                checked={publishSettings.isPublishedSocial}
                onCheckedChange={(checked) => setPublishSettings(s => ({ ...s, isPublishedSocial: !!checked }))}
              />
              <Label htmlFor="social" className="flex items-center gap-2 cursor-pointer">
                <Share2 className="h-4 w-4 text-pink-600" />
                Social Media
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePublishSettings} disabled={publishing}>
              {publishing ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default PropertyCard;
