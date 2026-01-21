import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Link as LinkIcon, Search, Loader2, CheckCircle2, XCircle,
  Home, Bed, Bath, Square, MapPin, Image as ImageIcon, FileText,
  Download, AlertCircle, ExternalLink, Building2, Sparkles
} from 'lucide-react';

interface ScrapedProperty {
  title: string;
  address: string;
  price: number;
  priceQualifier?: string;
  description: string;
  features: string[];
  bedrooms: number;
  bathrooms: number;
  sqft: number;
  images: string[];
  propertyType?: string;
  listingType?: 'sale' | 'rental';
  epcRating?: string;
  tenure?: string;
  councilTaxBand?: string;
  portalRef?: string;
}

interface Portal {
  id: string;
  name: string;
  domain: string;
}

export default function PropertyImport() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [url, setUrl] = useState('');
  const [previewData, setPreviewData] = useState<ScrapedProperty | null>(null);
  const [detectedPortal, setDetectedPortal] = useState<string | null>(null);

  // Fetch supported portals
  const { data: portals = [] } = useQuery<Portal[]>({
    queryKey: ['/api/crm/properties/import/portals'],
    queryFn: async () => {
      const res = await fetch('/api/crm/properties/import/portals');
      if (!res.ok) throw new Error('Failed to fetch portals');
      return res.json();
    }
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async (propertyUrl: string) => {
      const res = await fetch('/api/crm/properties/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: propertyUrl })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.scraped) {
        setPreviewData(data.scraped);
        setDetectedPortal(data.portal);
        toast({
          title: 'Property Found',
          description: `Successfully scraped from ${data.portal}`
        });
      } else {
        toast({
          title: 'Scrape Failed',
          description: data.error || 'Could not extract property data from this URL',
          variant: 'destructive'
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to preview property',
        variant: 'destructive'
      });
    }
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (propertyUrl: string) => {
      const res = await fetch('/api/crm/properties/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: propertyUrl })
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success && data.property) {
        toast({
          title: 'Property Imported',
          description: `${data.property.title} has been added to your listings`
        });
        queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
        setLocation(`/crm/managed-property/${data.property.id}`);
      } else {
        toast({
          title: 'Import Failed',
          description: data.error || 'Could not import property',
          variant: 'destructive'
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to import property',
        variant: 'destructive'
      });
    }
  });

  const handlePreview = () => {
    if (!url.trim()) {
      toast({
        title: 'URL Required',
        description: 'Please enter a property URL to import',
        variant: 'destructive'
      });
      return;
    }
    setPreviewData(null);
    setDetectedPortal(null);
    previewMutation.mutate(url.trim());
  };

  const handleImport = () => {
    if (!url.trim()) return;
    importMutation.mutate(url.trim());
  };

  const formatPrice = (price: number, qualifier?: string, listingType?: string) => {
    const formatted = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(price);

    if (listingType === 'rental') {
      return `${formatted} ${qualifier === 'pw' ? 'pw' : 'pcm'}`;
    }
    return formatted;
  };

  const getPortalLogo = (portalId: string) => {
    switch (portalId) {
      case 'rightmove':
        return <span className="text-green-600 font-bold">Rightmove</span>;
      case 'zoopla':
        return <span className="text-purple-600 font-bold">Zoopla</span>;
      case 'onthemarket':
        return <span className="text-orange-600 font-bold">OnTheMarket</span>;
      case 'johnbarclay':
        return <span className="text-blue-600 font-bold">John Barclay</span>;
      default:
        return <span className="font-bold">{portalId}</span>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation('/crm/property-management')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Import Property from URL</h1>
            <p className="text-muted-foreground">
              Scrape property details from major UK property portals
            </p>
          </div>
        </div>

        {/* Supported Portals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Supported Portals
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {portals.map((portal) => (
                <Badge key={portal.id} variant="outline" className="px-4 py-2 text-sm">
                  {getPortalLogo(portal.id)}
                  <span className="text-gray-500 ml-2">{portal.domain}</span>
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* URL Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              Property URL
            </CardTitle>
            <CardDescription>
              Paste a property listing URL from any supported portal
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="https://www.rightmove.co.uk/properties/123456789..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePreview()}
                />
              </div>
              <Button
                onClick={handlePreview}
                disabled={previewMutation.isPending || !url.trim()}
              >
                {previewMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Scraping...</>
                ) : (
                  <><Search className="h-4 w-4 mr-2" />Preview</>
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              The system will automatically detect the portal and extract property details
            </p>
          </CardContent>
        </Card>

        {/* Preview Results */}
        {previewData && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    Preview Results
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    Scraped from {detectedPortal && getPortalLogo(detectedPortal)}
                    {previewData.portalRef && (
                      <Badge variant="outline" className="text-xs">Ref: {previewData.portalRef}</Badge>
                    )}
                  </CardDescription>
                </div>
                <Button
                  onClick={handleImport}
                  disabled={importMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {importMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Importing...</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />Import Property</>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Main Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Images */}
                <div className="md:col-span-1">
                  {previewData.images.length > 0 ? (
                    <div className="space-y-2">
                      <div className="aspect-video rounded-lg overflow-hidden bg-gray-100">
                        <img
                          src={previewData.images[0]}
                          alt={previewData.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-property.jpg';
                          }}
                        />
                      </div>
                      {previewData.images.length > 1 && (
                        <div className="grid grid-cols-4 gap-1">
                          {previewData.images.slice(1, 5).map((img, idx) => (
                            <div key={idx} className="aspect-square rounded overflow-hidden bg-gray-100">
                              <img
                                src={img}
                                alt={`Image ${idx + 2}`}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground text-center">
                        <ImageIcon className="h-3 w-3 inline mr-1" />
                        {previewData.images.length} images found
                      </p>
                    </div>
                  ) : (
                    <div className="aspect-video rounded-lg bg-gray-100 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                        <p className="text-sm">No images found</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Property Details */}
                <div className="md:col-span-2 space-y-4">
                  {/* Title & Price */}
                  <div>
                    <h2 className="text-xl font-semibold">{previewData.title || 'Property'}</h2>
                    <div className="flex items-center gap-2 text-gray-600 mt-1">
                      <MapPin className="h-4 w-4" />
                      <span>{previewData.address}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-2xl font-bold text-green-600">
                      {formatPrice(previewData.price, previewData.priceQualifier, previewData.listingType)}
                    </span>
                    <Badge className={previewData.listingType === 'rental' ? 'bg-blue-500' : 'bg-purple-500'}>
                      {previewData.listingType === 'rental' ? 'To Let' : 'For Sale'}
                    </Badge>
                    {previewData.propertyType && (
                      <Badge variant="outline" className="capitalize">
                        {previewData.propertyType}
                      </Badge>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                      <Bed className="h-5 w-5 text-gray-500" />
                      <span className="font-medium">{previewData.bedrooms}</span>
                      <span className="text-gray-500 text-sm">beds</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                      <Bath className="h-5 w-5 text-gray-500" />
                      <span className="font-medium">{previewData.bathrooms}</span>
                      <span className="text-gray-500 text-sm">baths</span>
                    </div>
                    {previewData.sqft > 0 && (
                      <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                        <Square className="h-5 w-5 text-gray-500" />
                        <span className="font-medium">{previewData.sqft.toLocaleString()}</span>
                        <span className="text-gray-500 text-sm">sq ft</span>
                      </div>
                    )}
                    {previewData.epcRating && (
                      <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                        <span className="text-gray-500 text-sm">EPC</span>
                        <Badge className={
                          ['A', 'B'].includes(previewData.epcRating) ? 'bg-green-500' :
                          ['C', 'D'].includes(previewData.epcRating) ? 'bg-yellow-500' :
                          'bg-orange-500'
                        }>
                          {previewData.epcRating}
                        </Badge>
                      </div>
                    )}
                    {previewData.tenure && (
                      <div className="flex items-center gap-2 bg-gray-100 px-3 py-2 rounded-lg">
                        <Building2 className="h-5 w-5 text-gray-500" />
                        <span className="text-gray-500 text-sm capitalize">{previewData.tenure}</span>
                      </div>
                    )}
                  </div>

                  {/* Features */}
                  {previewData.features.length > 0 && (
                    <div>
                      <h3 className="font-medium mb-2">Key Features</h3>
                      <div className="flex flex-wrap gap-2">
                        {previewData.features.slice(0, 8).map((feature, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {previewData.features.length > 8 && (
                          <Badge variant="secondary" className="text-xs">
                            +{previewData.features.length - 8} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Description */}
              {previewData.description && (
                <div>
                  <h3 className="font-medium mb-2 flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Description
                  </h3>
                  <ScrollArea className="h-32">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {previewData.description}
                    </p>
                  </ScrollArea>
                </div>
              )}

              {/* Warning */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">Review before importing</p>
                  <p className="text-sm text-amber-700">
                    Please verify the scraped data is accurate. Images will be downloaded and stored locally.
                    The original listing URL will not be stored.
                  </p>
                </div>
              </div>

              {/* Source Link */}
              <div className="flex justify-between items-center pt-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  View original listing
                </a>
                <Button
                  variant="outline"
                  onClick={() => {
                    setPreviewData(null);
                    setUrl('');
                  }}
                >
                  Clear & Start Over
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error state */}
        {previewMutation.isError && !previewData && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3 text-red-600">
                <XCircle className="h-6 w-6" />
                <div>
                  <p className="font-medium">Failed to scrape property</p>
                  <p className="text-sm">
                    The URL may be invalid, the page structure may have changed, or the portal may be blocking automated access.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tips for best results</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                Use the full property detail page URL, not search results or map links
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                Make sure the listing is still active and publicly accessible
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                Some portals may have anti-bot protections that could affect scraping
              </li>
              <li className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5" />
                Scraped data should be reviewed and may need manual correction
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
