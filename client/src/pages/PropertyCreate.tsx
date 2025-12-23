import { useState, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, ArrowRight, Wand2, Save, Sparkles, Upload,
  Home, MapPin, Bed, Bath, Square, Check,
  Plus, X, Image, Trash2, Loader2, CheckCircle2
} from 'lucide-react';

type WizardStep = 'address' | 'details' | 'price' | 'images' | 'review';

interface ParsedProperty {
  title?: string;
  description?: string;
  listingType?: string;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  receptions?: number;
  squareFootage?: number;
  addressLine1?: string;
  addressLine2?: string;
  postcode?: string;
  tenure?: string;
  councilTaxBand?: string;
  energyRating?: string;
  features?: string[];
  furnished?: string;
}

export default function PropertyCreate() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [currentStep, setCurrentStep] = useState<WizardStep>('address');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [addressInput, setAddressInput] = useState('');
  const [parsedData, setParsedData] = useState<ParsedProperty | null>(null);
  const [features, setFeatures] = useState<string[]>([]);
  const [newFeature, setNewFeature] = useState('');
  
  const [price, setPrice] = useState('');
  const [listingType, setListingType] = useState<'sale' | 'rental'>('sale');
  
  const [images, setImages] = useState<{ file: File; preview: string; isPrimary: boolean }[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const steps: { key: WizardStep; label: string; icon: typeof Home }[] = [
    { key: 'address', label: 'Address', icon: MapPin },
    { key: 'details', label: 'Details', icon: Home },
    { key: 'price', label: 'Price', icon: Check },
    { key: 'images', label: 'Images', icon: Image },
    { key: 'review', label: 'Review', icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.key === currentStep);
  const progress = ((currentStepIndex + 1) / steps.length) * 100;

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newImages = files.map((file, index) => ({
      file,
      preview: URL.createObjectURL(file),
      isPrimary: images.length === 0 && index === 0
    }));
    setImages(prev => [...prev, ...newImages]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [images.length]);

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const newImages = prev.filter((_, i) => i !== index);
      if (prev[index].isPrimary && newImages.length > 0) {
        newImages[0].isPrimary = true;
      }
      URL.revokeObjectURL(prev[index].preview);
      return newImages;
    });
  };

  const handleSetPrimary = (index: number) => {
    setImages(prev => prev.map((img, i) => ({
      ...img,
      isPrimary: i === index
    })));
  };

  const uploadImages = async (): Promise<string[]> => {
    if (images.length === 0) return [];
    setIsUploading(true);
    const uploadedUrls: string[] = [];

    try {
      const sortedImages = [...images].sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0));
      for (const img of sortedImages) {
        const formData = new FormData();
        formData.append('image', img.file);
        const response = await fetch('/api/crm/upload/property-image', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error('Failed to upload image');
        const result = await response.json();
        uploadedUrls.push(result.url);
      }
      return uploadedUrls;
    } finally {
      setIsUploading(false);
    }
  };

  const handleParseAddress = async () => {
    if (!addressInput.trim()) {
      toast({
        title: "Please enter an address",
        description: "Enter the street address or property description",
        variant: "destructive"
      });
      return;
    }

    setIsProcessing(true);
    try {
      const result = await apiRequest('/api/crm/properties/parse', 'POST', {
        description: addressInput
      });

      if (result.parsed) {
        setParsedData(result.parsed);
        if (result.parsed.features) {
          setFeatures(result.parsed.features);
        }
        if (result.parsed.listingType) {
          setListingType(result.parsed.listingType as 'sale' | 'rental');
        }
        toast({
          title: "Property details generated!",
          description: "Review the details and enter the price",
        });
        setCurrentStep('details');
      }
    } catch (error) {
      toast({
        title: "Failed to process",
        description: "Could not extract property details. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddFeature = () => {
    if (newFeature.trim() && !features.includes(newFeature)) {
      setFeatures([...features, newFeature.trim()]);
      setNewFeature('');
    }
  };

  const handleRemoveFeature = (feature: string) => {
    setFeatures(features.filter(f => f !== feature));
  };

  const canProceedToImages = () => {
    return price && parseFloat(price) > 0;
  };

  const handleSubmit = async () => {
    if (!parsedData) return;

    setIsSubmitting(true);
    try {
      let imageUrls: string[] = [];
      if (images.length > 0) {
        toast({
          title: "Uploading images...",
          description: `Uploading ${images.length} image(s)`,
        });
        imageUrls = await uploadImages();
      }

      const propertyData = {
        listingType,
        propertyType: parsedData.propertyType || 'flat',
        title: parsedData.title || `${parsedData.bedrooms} Bed Property in ${parsedData.postcode}`,
        description: parsedData.description || '',
        price: Math.round(parseFloat(price) * 100),
        bedrooms: parsedData.bedrooms || 1,
        bathrooms: parsedData.bathrooms || 1,
        receptions: parsedData.receptions || 0,
        squareFootage: parsedData.squareFootage || 0,
        addressLine1: parsedData.addressLine1 || '',
        addressLine2: parsedData.addressLine2 || '',
        postcode: parsedData.postcode || '',
        tenure: parsedData.tenure || 'leasehold',
        councilTaxBand: parsedData.councilTaxBand || '',
        energyRating: parsedData.energyRating || '',
        features,
        furnished: parsedData.furnished || 'unfurnished',
        viewingArrangements: 'by_appointment',
        images: imageUrls,
        areaId: 1,
        status: 'active'
      };

      await apiRequest('/api/crm/properties', 'POST', propertyData);
      images.forEach(img => URL.revokeObjectURL(img.preview));

      toast({
        title: "Property created!",
        description: "The property has been successfully listed.",
      });

      setLocation('/crm/properties');
    } catch (error) {
      toast({
        title: "Failed to create property",
        description: "Please check the details and try again.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const goBack = () => {
    const idx = currentStepIndex;
    if (idx > 0) {
      setCurrentStep(steps[idx - 1].key);
    }
  };

  const goNext = () => {
    const idx = currentStepIndex;
    if (idx < steps.length - 1) {
      setCurrentStep(steps[idx + 1].key);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      <div className="bg-white dark:bg-card border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => setLocation('/crm/dashboard')}
                data-testid="button-back"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-xl font-semibold">Create New Property</h1>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {steps.map((step, idx) => (
              <div
                key={step.key}
                className={`flex items-center gap-2 ${
                  idx <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  idx < currentStepIndex 
                    ? 'bg-primary text-primary-foreground' 
                    : idx === currentStepIndex
                    ? 'bg-primary/20 text-primary border-2 border-primary'
                    : 'bg-muted text-muted-foreground'
                }`}>
                  {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span className="hidden sm:inline text-sm">{step.label}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {currentStep === 'address' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Enter the Property Address
              </CardTitle>
              <CardDescription>
                Enter the street address or describe the property location. Our AI will look up typical property details for that area.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Example: 42 Elgin Avenue, W9&#10;&#10;Or describe it: 2 bed Victorian flat on Elgin Avenue in Maida Vale, recently renovated with period features"
                className="min-h-[150px]"
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                data-testid="input-address"
              />
              
              <div className="flex justify-end">
                <Button
                  onClick={handleParseAddress}
                  disabled={isProcessing || !addressInput.trim()}
                  className="bg-gradient-to-r from-purple-600 to-blue-600"
                  data-testid="button-parse"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Details...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generate Property Details
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'details' && parsedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-5 w-5" />
                Review Property Details
              </CardTitle>
              <CardDescription>
                These details were generated based on the address. You can edit them if needed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <Input
                  value={parsedData.title || ''}
                  onChange={(e) => setParsedData({ ...parsedData, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Property Type</label>
                  <Select
                    value={parsedData.propertyType || 'flat'}
                    onValueChange={(v) => setParsedData({ ...parsedData, propertyType: v })}
                  >
                    <SelectTrigger data-testid="select-property-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat</SelectItem>
                      <SelectItem value="house">House</SelectItem>
                      <SelectItem value="maisonette">Maisonette</SelectItem>
                      <SelectItem value="penthouse">Penthouse</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Listing Type</label>
                  <Select
                    value={listingType}
                    onValueChange={(v) => setListingType(v as 'sale' | 'rental')}
                  >
                    <SelectTrigger data-testid="select-listing-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">For Sale</SelectItem>
                      <SelectItem value="rental">For Rent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                    <Bed className="h-4 w-4" /> Bedrooms
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={parsedData.bedrooms || 1}
                    onChange={(e) => setParsedData({ ...parsedData, bedrooms: parseInt(e.target.value) || 1 })}
                    data-testid="input-bedrooms"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                    <Bath className="h-4 w-4" /> Bathrooms
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={parsedData.bathrooms || 1}
                    onChange={(e) => setParsedData({ ...parsedData, bathrooms: parseInt(e.target.value) || 1 })}
                    data-testid="input-bathrooms"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 flex items-center gap-1">
                    <Square className="h-4 w-4" /> Sq Ft
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={parsedData.squareFootage || 0}
                    onChange={(e) => setParsedData({ ...parsedData, squareFootage: parseInt(e.target.value) || 0 })}
                    data-testid="input-sqft"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Address</label>
                <Input
                  value={parsedData.addressLine1 || ''}
                  onChange={(e) => setParsedData({ ...parsedData, addressLine1: e.target.value })}
                  placeholder="Street address"
                  className="mb-2"
                  data-testid="input-address-line1"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={parsedData.addressLine2 || ''}
                    onChange={(e) => setParsedData({ ...parsedData, addressLine2: e.target.value })}
                    placeholder="Address line 2"
                    data-testid="input-address-line2"
                  />
                  <Input
                    value={parsedData.postcode || ''}
                    onChange={(e) => setParsedData({ ...parsedData, postcode: e.target.value })}
                    placeholder="Postcode"
                    data-testid="input-postcode"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <Textarea
                  value={parsedData.description || ''}
                  onChange={(e) => setParsedData({ ...parsedData, description: e.target.value })}
                  className="min-h-[120px]"
                  data-testid="input-description"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Features</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {features.map((feature, idx) => (
                    <Badge key={idx} variant="secondary" className="gap-1">
                      {feature}
                      <button onClick={() => handleRemoveFeature(feature)}>
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newFeature}
                    onChange={(e) => setNewFeature(e.target.value)}
                    placeholder="Add a feature"
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddFeature())}
                    data-testid="input-new-feature"
                  />
                  <Button type="button" variant="outline" onClick={handleAddFeature} data-testid="button-add-feature">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={goBack} data-testid="button-back-step">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={goNext} data-testid="button-next-step">
                  Next: Enter Price <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'price' && (
          <Card>
            <CardHeader>
              <CardTitle>Set the Price</CardTitle>
              <CardDescription>
                {listingType === 'sale' 
                  ? 'Enter the asking price for this property'
                  : 'Enter the monthly rent for this property'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">
                  {listingType === 'sale' ? 'Asking Price' : 'Monthly Rent'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">£</span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="pl-8 text-2xl h-14"
                    placeholder={listingType === 'sale' ? '500000' : '2500'}
                    data-testid="input-price"
                  />
                </div>
                {listingType === 'rental' && (
                  <p className="text-sm text-muted-foreground mt-2">Per calendar month (PCM)</p>
                )}
              </div>

              {parsedData && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Property Summary</p>
                  <p className="text-sm text-muted-foreground">
                    {parsedData.bedrooms} bed {parsedData.propertyType} in {parsedData.postcode}
                  </p>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={goBack} data-testid="button-back-step">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button 
                  onClick={goNext} 
                  disabled={!canProceedToImages()}
                  data-testid="button-next-step"
                >
                  Next: Upload Images <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'images' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Image className="h-5 w-5" />
                Upload Property Images
              </CardTitle>
              <CardDescription>
                Add photos of the property. The first image will be used as the main photo.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">Click to upload images</p>
                <p className="text-sm text-muted-foreground">PNG, JPG, WEBP up to 10MB each</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                  data-testid="input-images"
                />
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {images.map((img, idx) => (
                    <div
                      key={idx}
                      className={`relative group rounded-lg overflow-hidden border-2 ${
                        img.isPrimary ? 'border-primary' : 'border-transparent'
                      }`}
                    >
                      <img
                        src={img.preview}
                        alt={`Property image ${idx + 1}`}
                        className="w-full h-32 object-cover"
                      />
                      {img.isPrimary && (
                        <Badge className="absolute top-2 left-2" variant="default">
                          Main Photo
                        </Badge>
                      )}
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {!img.isPrimary && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleSetPrimary(idx)}
                          >
                            Set as Main
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="destructive"
                          onClick={() => handleRemoveImage(idx)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={goBack} data-testid="button-back-step">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button onClick={goNext} data-testid="button-next-step">
                  Next: Review <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {currentStep === 'review' && parsedData && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Review & Create Listing
              </CardTitle>
              <CardDescription>
                Review all the details before creating the property listing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Title</p>
                  <p className="font-medium">{parsedData.title}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Price</p>
                  <p className="font-medium text-xl">
                    £{parseFloat(price).toLocaleString()}
                    {listingType === 'rental' && ' PCM'}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Type</p>
                  <p className="font-medium capitalize">{parsedData.propertyType} - For {listingType}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{parsedData.addressLine1}, {parsedData.postcode}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bedrooms</p>
                  <p className="font-medium">{parsedData.bedrooms}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Bathrooms</p>
                  <p className="font-medium">{parsedData.bathrooms}</p>
                </div>
              </div>

              {features.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Features</p>
                  <div className="flex flex-wrap gap-2">
                    {features.map((f, i) => (
                      <Badge key={i} variant="secondary">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {images.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Images ({images.length})</p>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {images.map((img, idx) => (
                      <img
                        key={idx}
                        src={img.preview}
                        alt={`Property ${idx + 1}`}
                        className="h-20 w-20 rounded object-cover flex-shrink-0"
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between pt-4">
                <Button variant="outline" onClick={goBack} data-testid="button-back-step">
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || isUploading}
                  className="bg-gradient-to-r from-purple-600 to-blue-600"
                  data-testid="button-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Listing...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Property Listing
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
