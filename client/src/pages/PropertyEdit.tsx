import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useParams } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft, Save, Loader2, Home, Building2, MapPin,
  Bed, Bath, Square, Tag, Globe, Send, Share2, Upload, X, Image, FileText
} from 'lucide-react';

interface PropertyData {
  id: number;
  title: string;
  address?: string;
  description: string;
  isRental: boolean; // true = rental, false = sale
  isResidential: boolean;
  propertyType: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  receptions?: number;
  squareFootage?: number;
  addressLine1: string;
  addressLine2?: string;
  city?: string;
  postcode: string;
  status: string;
  tenure?: string;
  councilTaxBand?: string;
  energyRating?: string;
  features?: string[];
  furnished?: string;
  images?: string[];
  floorPlan?: string;
  isListed?: boolean;
  isManaged?: boolean;
  isPublishedWebsite?: boolean;
  isPublishedZoopla?: boolean;
  isPublishedRightmove?: boolean;
  isPublishedOnTheMarket?: boolean;
  isPublishedSocial?: boolean;
  rentAmount?: number;
  rentPeriod?: string;
  deposit?: number;
}

export default function PropertyEdit() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id: string }>();
  const propertyId = params.id;
  const { toast } = useToast();

  const [formData, setFormData] = useState<Partial<PropertyData>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImages, setIsUploadingImages] = useState(false);
  const [isUploadingFloorPlan, setIsUploadingFloorPlan] = useState(false);

  const { data: property, isLoading, error } = useQuery({
    queryKey: [`/api/crm/properties/${propertyId}`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch property');
      return res.json();
    },
    enabled: !!propertyId
  });

  useEffect(() => {
    if (property) {
      setFormData(property);
    }
  }, [property]);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<PropertyData>) => {
      return apiRequest(`/api/crm/properties/${propertyId}`, 'PATCH', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}`] });
      toast({
        title: "Property updated",
        description: "Changes have been saved successfully.",
      });
      setLocation('/crm/properties');
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update",
        description: error.message || "Could not save changes.",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync(formData);
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof PropertyData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImages(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          credentials: 'include',
          body: formDataUpload,
        });

        if (!response.ok) throw new Error('Upload failed');
        const data = await response.json();
        return data.url;
      });

      const newUrls = await Promise.all(uploadPromises);
      const currentImages = formData.images || [];
      updateField('images', [...currentImages, ...newUrls]);

      toast({
        title: "Images uploaded",
        description: `${newUrls.length} image(s) uploaded successfully.`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload one or more images.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingImages(false);
      event.target.value = '';
    }
  };

  const handleFloorPlanUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploadingFloorPlan(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        credentials: 'include',
        body: formDataUpload,
      });

      if (!response.ok) throw new Error('Upload failed');
      const data = await response.json();
      updateField('floorPlan', data.url);

      toast({
        title: "Floor plan uploaded",
        description: "Floor plan uploaded successfully.",
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "Failed to upload floor plan.",
        variant: "destructive"
      });
    } finally {
      setIsUploadingFloorPlan(false);
      event.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    const currentImages = formData.images || [];
    const newImages = currentImages.filter((_, i) => i !== index);
    updateField('images', newImages);
  };

  const removeFloorPlan = () => {
    updateField('floorPlan', null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  if (error || !property) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-red-600">Property not found or failed to load.</p>
            <Button onClick={() => setLocation('/crm/properties')} className="mt-4">
              Back to Properties
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <Button
        variant="ghost"
        onClick={() => setLocation('/crm/properties')}
        className="mb-4"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Properties
      </Button>

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Edit Property</h1>
          <p className="text-muted-foreground">Update property details and settings</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              Basic Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Property Title</Label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e) => updateField('title', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status || 'active'}
                  onValueChange={(value) => updateField('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="under_offer">Under Offer</SelectItem>
                    <SelectItem value="sold">Sold</SelectItem>
                    <SelectItem value="let">Let</SelectItem>
                    <SelectItem value="withdrawn">Withdrawn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={4}
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Listing Type</Label>
                <Select
                  value={formData.isRental ? 'rental' : 'sale'}
                  onValueChange={(value) => updateField('isRental', value === 'rental')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sale">For Sale</SelectItem>
                    <SelectItem value="rental">To Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Property Category</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={formData.isResidential !== false ? 'default' : 'outline'}
                    className={formData.isResidential !== false ? 'bg-[#791E75] hover:bg-[#60175d]' : ''}
                    onClick={() => updateField('isResidential', true)}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Residential
                  </Button>
                  <Button
                    type="button"
                    variant={formData.isResidential === false ? 'default' : 'outline'}
                    className={formData.isResidential === false ? 'bg-[#791E75] hover:bg-[#60175d]' : ''}
                    onClick={() => updateField('isResidential', false)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Commercial
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Property Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (£)</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price ? formData.price / 100 : ''}
                  onChange={(e) => updateField('price', Math.round(parseFloat(e.target.value) * 100))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bedrooms">Bedrooms</Label>
                <Input
                  id="bedrooms"
                  type="number"
                  value={formData.bedrooms || ''}
                  onChange={(e) => updateField('bedrooms', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bathrooms">Bathrooms</Label>
                <Input
                  id="bathrooms"
                  type="number"
                  value={formData.bathrooms || ''}
                  onChange={(e) => updateField('bathrooms', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="receptions">Receptions</Label>
                <Input
                  id="receptions"
                  type="number"
                  value={formData.receptions || ''}
                  onChange={(e) => updateField('receptions', parseInt(e.target.value))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="propertyType">Property Type</Label>
                <Select
                  value={formData.propertyType || 'flat'}
                  onValueChange={(value) => updateField('propertyType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {formData.isResidential !== false ? (
                      <>
                        <SelectItem value="flat">Flat</SelectItem>
                        <SelectItem value="house">House</SelectItem>
                        <SelectItem value="maisonette">Maisonette</SelectItem>
                        <SelectItem value="penthouse">Penthouse</SelectItem>
                        <SelectItem value="studio">Studio</SelectItem>
                        <SelectItem value="bungalow">Bungalow</SelectItem>
                        <SelectItem value="detached">Detached</SelectItem>
                        <SelectItem value="semi_detached">Semi-Detached</SelectItem>
                        <SelectItem value="terraced">Terraced</SelectItem>
                      </>
                    ) : (
                      <>
                        <SelectItem value="office">Office</SelectItem>
                        <SelectItem value="retail">Retail</SelectItem>
                        <SelectItem value="restaurant">Restaurant</SelectItem>
                        <SelectItem value="warehouse">Warehouse</SelectItem>
                        <SelectItem value="industrial">Industrial</SelectItem>
                        <SelectItem value="mixed_use">Mixed Use</SelectItem>
                        <SelectItem value="shop">Shop</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="squareFootage">Square Footage</Label>
                <Input
                  id="squareFootage"
                  type="number"
                  value={formData.squareFootage || ''}
                  onChange={(e) => updateField('squareFootage', parseInt(e.target.value))}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Address */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Address
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Address Line 1</Label>
                <Input
                  id="addressLine1"
                  value={formData.addressLine1 || ''}
                  onChange={(e) => updateField('addressLine1', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressLine2">Address Line 2</Label>
                <Input
                  id="addressLine2"
                  value={formData.addressLine2 || ''}
                  onChange={(e) => updateField('addressLine2', e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="postcode">Postcode</Label>
                <Input
                  id="postcode"
                  value={formData.postcode || ''}
                  onChange={(e) => updateField('postcode', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tenure">Tenure</Label>
                <Select
                  value={formData.tenure || 'leasehold'}
                  onValueChange={(value) => updateField('tenure', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="freehold">Freehold</SelectItem>
                    <SelectItem value="leasehold">Leasehold</SelectItem>
                    <SelectItem value="share_of_freehold">Share of Freehold</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="energyRating">EPC Rating</Label>
                <Select
                  value={formData.energyRating || ''}
                  onValueChange={(value) => updateField('energyRating', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rating" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">A</SelectItem>
                    <SelectItem value="B">B</SelectItem>
                    <SelectItem value="C">C</SelectItem>
                    <SelectItem value="D">D</SelectItem>
                    <SelectItem value="E">E</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="G">G</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Property Images */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Property Images
            </CardTitle>
            <CardDescription>Upload photos of the property (first image will be the main image)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Images */}
            {formData.images && formData.images.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {formData.images.map((imageUrl, index) => (
                  <div key={index} className="relative group">
                    <img
                      src={imageUrl}
                      alt={`Property image ${index + 1}`}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    {index === 0 && (
                      <span className="absolute top-2 left-2 bg-[#791E75] text-white text-xs px-2 py-1 rounded">
                        Main
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Upload Button */}
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#791E75] transition-colors">
              <input
                type="file"
                id="imageUpload"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                disabled={isUploadingImages}
              />
              <label htmlFor="imageUpload" className="cursor-pointer">
                {isUploadingImages ? (
                  <div className="flex flex-col items-center">
                    <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                    <span className="mt-2 text-sm text-gray-500">Uploading...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Upload className="h-8 w-8 text-gray-400" />
                    <span className="mt-2 text-sm text-gray-500">Click to upload images</span>
                    <span className="text-xs text-gray-400">PNG, JPG up to 10MB each</span>
                  </div>
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Floor Plan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Floor Plan
            </CardTitle>
            <CardDescription>Upload a floor plan image</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Floor Plan */}
            {formData.floorPlan && (
              <div className="relative inline-block">
                <img
                  src={formData.floorPlan}
                  alt="Floor plan"
                  className="max-w-full h-48 object-contain rounded-lg border"
                />
                <button
                  type="button"
                  onClick={removeFloorPlan}
                  className="absolute top-2 right-2 bg-red-600 text-white p-1 rounded-full"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Upload Button */}
            {!formData.floorPlan && (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#791E75] transition-colors">
                <input
                  type="file"
                  id="floorPlanUpload"
                  accept="image/*,.pdf"
                  onChange={handleFloorPlanUpload}
                  className="hidden"
                  disabled={isUploadingFloorPlan}
                />
                <label htmlFor="floorPlanUpload" className="cursor-pointer">
                  {isUploadingFloorPlan ? (
                    <div className="flex flex-col items-center">
                      <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                      <span className="mt-2 text-sm text-gray-500">Uploading...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center">
                      <Upload className="h-8 w-8 text-gray-400" />
                      <span className="mt-2 text-sm text-gray-500">Click to upload floor plan</span>
                      <span className="text-xs text-gray-400">PNG, JPG, or PDF</span>
                    </div>
                  )}
                </label>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Publishing Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              Publishing Settings
            </CardTitle>
            <CardDescription>Control where this property is visible</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="isListed"
                checked={formData.isListed ?? false}
                onCheckedChange={(checked) => updateField('isListed', !!checked)}
              />
              <Label htmlFor="isListed" className="cursor-pointer">
                Listed ({formData.isRental ? 'For Rent' : 'For Sale'})
              </Label>
            </div>

            <Separator />

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedWebsite"
                  checked={formData.isPublishedWebsite ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedWebsite', !!checked)}
                />
                <Label htmlFor="isPublishedWebsite" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="h-4 w-4 text-blue-600" />
                  Website
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedZoopla"
                  checked={formData.isPublishedZoopla ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedZoopla', !!checked)}
                />
                <Label htmlFor="isPublishedZoopla" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4 text-purple-600" />
                  Zoopla
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedRightmove"
                  checked={formData.isPublishedRightmove ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedRightmove', !!checked)}
                />
                <Label htmlFor="isPublishedRightmove" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4 text-green-600" />
                  Rightmove
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedOnTheMarket"
                  checked={formData.isPublishedOnTheMarket ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedOnTheMarket', !!checked)}
                />
                <Label htmlFor="isPublishedOnTheMarket" className="flex items-center gap-2 cursor-pointer">
                  <Send className="h-4 w-4 text-orange-600" />
                  OnTheMarket
                </Label>
              </div>
              <div className="flex items-center space-x-3">
                <Checkbox
                  id="isPublishedSocial"
                  checked={formData.isPublishedSocial ?? false}
                  onCheckedChange={(checked) => updateField('isPublishedSocial', !!checked)}
                />
                <Label htmlFor="isPublishedSocial" className="flex items-center gap-2 cursor-pointer">
                  <Share2 className="h-4 w-4 text-pink-600" />
                  Social Media
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setLocation('/crm/properties')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-[#791E75] hover:bg-[#60175d]"
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
