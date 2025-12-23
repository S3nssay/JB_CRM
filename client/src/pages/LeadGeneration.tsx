import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Target, Search, Clock, MapPin, Home, TrendingDown,
  Mail, Phone, Send, Eye, CheckCircle, XCircle,
  AlertTriangle, Calendar, PoundSterling, RefreshCw, Play,
  Pause, Settings, Download, FileText, Building2,
  Timer, Zap, Filter, ChevronDown, ExternalLink
} from 'lucide-react';

interface StaleListing {
  id: number;
  portal: 'zoopla' | 'rightmove';
  portalListingId: string;
  address: string;
  postcode: string;
  price: number;
  propertyType: string;
  bedrooms: number;
  bathrooms: number;
  daysOnMarket: number;
  listedDate: string;
  agentName: string;
  agentPhone?: string;
  lastPriceChange?: string;
  priceHistory: { date: string; price: number }[];
  status: 'new' | 'contacted' | 'responded' | 'declined' | 'converted';
  contactAttempts: number;
  lastContactDate?: string;
  notes?: string;
  estimatedMarketValue: number;
  cashOfferPrice: number;
}

interface CashOffer {
  id: number;
  listingId: number;
  address: string;
  postcode: string;
  marketValue: number;
  offerPrice: number;
  discountPercent: number;
  status: 'draft' | 'sent' | 'viewed' | 'accepted' | 'declined' | 'expired';
  sentDate?: string;
  sentVia: 'post' | 'email' | 'whatsapp';
  responseDate?: string;
  expiryDate: string;
  letterTemplate: string;
}

interface MonitorSettings {
  enabled: boolean;
  portals: string[];
  postcodeAreas: string[];
  minDaysOnMarket: number;
  maxDaysOnMarket: number;
  minPrice: number;
  maxPrice: number;
  propertyTypes: string[];
  autoContact: boolean;
  contactMethod: 'post' | 'email' | 'both';
  cashOfferPercent: number;
  completionDays: number;
  scanFrequency: 'hourly' | 'daily' | 'weekly';
  lastScanTime?: string;
}

// Mock data for stale listings
const MOCK_STALE_LISTINGS: StaleListing[] = [
  {
    id: 1,
    portal: 'zoopla',
    portalListingId: 'ZPL123456',
    address: '45 Maida Vale, London',
    postcode: 'W9 1QE',
    price: 850000,
    propertyType: 'Flat',
    bedrooms: 2,
    bathrooms: 2,
    daysOnMarket: 127,
    listedDate: '2024-08-01',
    agentName: 'Purple Bricks',
    priceHistory: [
      { date: '2024-08-01', price: 925000 },
      { date: '2024-10-15', price: 875000 },
      { date: '2024-11-20', price: 850000 }
    ],
    status: 'new',
    contactAttempts: 0,
    estimatedMarketValue: 820000,
    cashOfferPrice: 697000
  },
  {
    id: 2,
    portal: 'rightmove',
    portalListingId: 'RM789012',
    address: '12 Queens Park Road, London',
    postcode: 'NW6 7SL',
    price: 1250000,
    propertyType: 'House',
    bedrooms: 4,
    bathrooms: 2,
    daysOnMarket: 156,
    listedDate: '2024-07-01',
    agentName: 'Local Agent Ltd',
    agentPhone: '020 7123 4567',
    lastPriceChange: '2024-10-01',
    priceHistory: [
      { date: '2024-07-01', price: 1395000 },
      { date: '2024-08-15', price: 1295000 },
      { date: '2024-10-01', price: 1250000 }
    ],
    status: 'contacted',
    contactAttempts: 1,
    lastContactDate: '2024-11-15',
    estimatedMarketValue: 1180000,
    cashOfferPrice: 1003000
  },
  {
    id: 3,
    portal: 'zoopla',
    portalListingId: 'ZPL345678',
    address: '8 Notting Hill Gate',
    postcode: 'W11 3JE',
    price: 2100000,
    propertyType: 'Flat',
    bedrooms: 3,
    bathrooms: 2,
    daysOnMarket: 203,
    listedDate: '2024-05-15',
    agentName: 'Foxtons',
    priceHistory: [
      { date: '2024-05-15', price: 2450000 },
      { date: '2024-07-01', price: 2300000 },
      { date: '2024-09-01', price: 2100000 }
    ],
    status: 'new',
    contactAttempts: 0,
    estimatedMarketValue: 2000000,
    cashOfferPrice: 1700000
  }
];

const DEFAULT_SETTINGS: MonitorSettings = {
  enabled: true,
  portals: ['zoopla', 'rightmove'],
  postcodeAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10', 'W2'],
  minDaysOnMarket: 90,
  maxDaysOnMarket: 365,
  minPrice: 200000,
  maxPrice: 5000000,
  propertyTypes: ['house', 'flat', 'maisonette'],
  autoContact: false,
  contactMethod: 'post',
  cashOfferPercent: 85,
  completionDays: 7,
  scanFrequency: 'daily',
  lastScanTime: new Date().toISOString()
};

export default function LeadGeneration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<MonitorSettings>(DEFAULT_SETTINGS);
  const [selectedListing, setSelectedListing] = useState<StaleListing | null>(null);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);

  // Fetch stale listings
  const { data: staleListings = MOCK_STALE_LISTINGS, isLoading } = useQuery({
    queryKey: ['/api/crm/lead-generation/stale-listings'],
    queryFn: async () => {
      const res = await fetch('/api/crm/lead-generation/stale-listings');
      if (!res.ok) return MOCK_STALE_LISTINGS;
      return res.json();
    }
  });

  // Run manual scan
  const scanMutation = useMutation({
    mutationFn: async () => {
      setIsScanning(true);
      setScanProgress(0);

      // Simulate scanning progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 500));
        setScanProgress(i);
      }

      const res = await fetch('/api/crm/lead-generation/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });

      return res.json();
    },
    onSuccess: (data) => {
      setIsScanning(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-generation/stale-listings'] });
      toast({
        title: 'Scan complete',
        description: `Found ${data?.newListings || 0} new stale listings.`
      });
    },
    onError: () => {
      setIsScanning(false);
      toast({ title: 'Scan failed', variant: 'destructive' });
    }
  });

  // Send cash offer
  const sendOfferMutation = useMutation({
    mutationFn: async (data: { listingId: number; method: string }) => {
      const res = await fetch('/api/crm/lead-generation/send-offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-generation/stale-listings'] });
      toast({ title: 'Offer sent', description: 'Cash offer has been sent to the property owner.' });
      setShowOfferDialog(false);
      setSelectedListing(null);
    }
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge className="bg-blue-100 text-blue-800">New</Badge>;
      case 'contacted':
        return <Badge className="bg-yellow-100 text-yellow-800">Contacted</Badge>;
      case 'responded':
        return <Badge className="bg-purple-100 text-purple-800">Responded</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800">Declined</Badge>;
      case 'converted':
        return <Badge className="bg-green-100 text-green-800">Converted</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDaysColor = (days: number) => {
    if (days < 90) return 'text-green-600';
    if (days < 180) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Target className="h-6 w-6 text-[#791E75]" />
            Lead Generation - Stale Listing Monitor
          </h1>
          <p className="text-gray-500">
            Monitor Zoopla & Rightmove for properties on market 90+ days and send cash offers
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowSettingsDialog(true)}
          >
            <Settings className="h-4 w-4 mr-2" /> Settings
          </Button>
          <Button
            onClick={() => scanMutation.mutate()}
            disabled={isScanning}
          >
            {isScanning ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Search className="h-4 w-4 mr-2" />
            )}
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>
      </div>

      {/* Scanning Progress */}
      {isScanning && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <RefreshCw className="h-5 w-5 animate-spin text-[#791E75]" />
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">
                  Scanning {settings.portals.join(' & ')} for stale listings...
                </p>
                <Progress value={scanProgress} className="h-2" />
              </div>
              <span className="text-sm text-gray-500">{scanProgress}%</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Search className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{staleListings.length}</p>
                <p className="text-xs text-gray-500">Stale Listings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Mail className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {staleListings.filter((l: StaleListing) => l.status === 'contacted').length}
                </p>
                <p className="text-xs text-gray-500">Contacted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {staleListings.filter((l: StaleListing) => l.status === 'responded').length}
                </p>
                <p className="text-xs text-gray-500">Responded</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {staleListings.filter((l: StaleListing) => l.status === 'converted').length}
                </p>
                <p className="text-xs text-gray-500">Converted</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#791E75]/10 rounded-lg">
                <PoundSterling className="h-5 w-5 text-[#791E75]" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {formatCurrency(
                    staleListings.reduce((sum: number, l: StaleListing) => sum + l.cashOfferPrice, 0)
                  )}
                </p>
                <p className="text-xs text-gray-500">Total Offer Value</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cash Offer Banner */}
      <Card className="mb-6 bg-gradient-to-r from-[#791E75] to-purple-700 text-white">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <Zap className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold">Cash Buyer Program</h3>
                <p className="text-white/80">
                  Offer {settings.cashOfferPercent}% of market value with {settings.completionDays}-day completion
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-white/80">Average Savings per Property</p>
              <p className="text-3xl font-bold">
                {formatCurrency(
                  staleListings.reduce((sum: number, l: StaleListing) =>
                    sum + (l.estimatedMarketValue - l.cashOfferPrice), 0
                  ) / (staleListings.length || 1)
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listings Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Stale Listings ({staleListings.length})</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-1" /> Filter
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-1" /> Export
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Property</TableHead>
                <TableHead>Portal</TableHead>
                <TableHead>Listed Price</TableHead>
                <TableHead>Days on Market</TableHead>
                <TableHead>Cash Offer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {staleListings.map((listing: StaleListing) => (
                <TableRow key={listing.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{listing.address}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> {listing.postcode}
                        <span className="mx-1">•</span>
                        <Home className="h-3 w-3" /> {listing.bedrooms} bed {listing.propertyType}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {listing.portal}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold">{formatCurrency(listing.price)}</p>
                      {listing.priceHistory.length > 1 && (
                        <p className="text-xs text-red-500 flex items-center gap-1">
                          <TrendingDown className="h-3 w-3" />
                          {formatCurrency(listing.priceHistory[0].price - listing.price)} reduced
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`font-bold ${getDaysColor(listing.daysOnMarket)}`}>
                      <Timer className="h-4 w-4 inline mr-1" />
                      {listing.daysOnMarket} days
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-green-600">
                        {formatCurrency(listing.cashOfferPrice)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {settings.cashOfferPercent}% of {formatCurrency(listing.estimatedMarketValue)}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(listing.status)}
                    {listing.contactAttempts > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        {listing.contactAttempts} contact(s)
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://www.${listing.portal}.co.uk/property/${listing.portalListingId}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedListing(listing);
                          setShowOfferDialog(true);
                        }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Send Offer Dialog */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Send Cash Offer</DialogTitle>
            <DialogDescription>
              Send a cash offer letter to the property owner
            </DialogDescription>
          </DialogHeader>

          {selectedListing && (
            <div className="space-y-6">
              {/* Property Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">{selectedListing.address}</h4>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Listed Price</p>
                    <p className="font-semibold">{formatCurrency(selectedListing.price)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Market Value</p>
                    <p className="font-semibold">{formatCurrency(selectedListing.estimatedMarketValue)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Cash Offer ({settings.cashOfferPercent}%)</p>
                    <p className="font-semibold text-green-600">{formatCurrency(selectedListing.cashOfferPrice)}</p>
                  </div>
                </div>
              </div>

              {/* Offer Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Contact Method</Label>
                  <Select defaultValue="post">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="post">Post (Letter)</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Completion Days</Label>
                  <Select defaultValue={settings.completionDays.toString()}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="28">28 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Letter Preview */}
              <div className="space-y-2">
                <Label>Letter Preview</Label>
                <div className="border rounded-lg p-4 bg-white text-sm space-y-4 max-h-64 overflow-y-auto">
                  <p><strong>John Barclay Estate & Management</strong><br />
                  123 High Street, London W9 1AB<br />
                  Tel: 020 7123 4567</p>

                  <p>Dear Property Owner,</p>

                  <p>Re: {selectedListing.address}, {selectedListing.postcode}</p>

                  <p>We notice your property has been on the market for {selectedListing.daysOnMarket} days.
                  We understand that selling a property can be stressful, especially when it takes longer than expected.</p>

                  <p><strong>We would like to make you a cash offer of {formatCurrency(selectedListing.cashOfferPrice)}</strong>
                  for your property, with completion in just {settings.completionDays} days.</p>

                  <p><strong>Our offer includes:</strong></p>
                  <ul className="list-disc list-inside">
                    <li>Cash payment - no mortgage delays</li>
                    <li>Completion in {settings.completionDays} days</li>
                    <li>No estate agent fees for you to pay</li>
                    <li>We cover all legal costs</li>
                    <li>No viewings or property chains</li>
                  </ul>

                  <p>This offer represents {settings.cashOfferPercent}% of the current market value, reflecting the speed
                  and certainty of a cash transaction.</p>

                  <p>If you would like to discuss this offer, please contact us at your earliest convenience.</p>

                  <p>Yours sincerely,<br />
                  <strong>John Barclay</strong><br />
                  Director</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Additional Notes (Internal)</Label>
                <Textarea placeholder="Add any notes about this offer..." />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedListing && sendOfferMutation.mutate({
                listingId: selectedListing.id,
                method: 'post'
              })}
            >
              <Send className="h-4 w-4 mr-2" /> Send Offer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Monitor Settings</DialogTitle>
            <DialogDescription>
              Configure stale listing monitoring parameters
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Enable/Disable */}
            <div className="flex items-center justify-between">
              <div>
                <Label>Enable Automatic Monitoring</Label>
                <p className="text-sm text-gray-500">Automatically scan portals for stale listings</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => setSettings(prev => ({ ...prev, enabled: v }))}
              />
            </div>

            {/* Portals */}
            <div className="space-y-2">
              <Label>Property Portals</Label>
              <div className="flex gap-4">
                {['zoopla', 'rightmove'].map(portal => (
                  <label key={portal} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={settings.portals.includes(portal)}
                      onChange={(e) => {
                        setSettings(prev => ({
                          ...prev,
                          portals: e.target.checked
                            ? [...prev.portals, portal]
                            : prev.portals.filter(p => p !== portal)
                        }));
                      }}
                      className="rounded"
                    />
                    <span className="capitalize">{portal}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Postcode Areas */}
            <div className="space-y-2">
              <Label>Postcode Areas</Label>
              <Input
                value={settings.postcodeAreas.join(', ')}
                onChange={(e) => setSettings(prev => ({
                  ...prev,
                  postcodeAreas: e.target.value.split(',').map(p => p.trim()).filter(Boolean)
                }))}
                placeholder="e.g., W9, W10, NW6"
              />
            </div>

            {/* Days on Market */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Days on Market</Label>
                <Input
                  type="number"
                  value={settings.minDaysOnMarket}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    minDaysOnMarket: parseInt(e.target.value) || 90
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Days on Market</Label>
                <Input
                  type="number"
                  value={settings.maxDaysOnMarket}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    maxDaysOnMarket: parseInt(e.target.value) || 365
                  }))}
                />
              </div>
            </div>

            {/* Price Range */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Price</Label>
                <Input
                  type="number"
                  value={settings.minPrice}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    minPrice: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum Price</Label>
                <Input
                  type="number"
                  value={settings.maxPrice}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    maxPrice: parseInt(e.target.value) || 5000000
                  }))}
                />
              </div>
            </div>

            {/* Cash Offer Settings */}
            <div className="border-t pt-4">
              <h4 className="font-semibold mb-4">Cash Offer Settings</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Cash Offer Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      value={settings.cashOfferPercent}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        cashOfferPercent: parseInt(e.target.value) || 85
                      }))}
                      className="w-24"
                    />
                    <span>% of market value</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Completion Days</Label>
                  <Select
                    value={settings.completionDays.toString()}
                    onValueChange={(v) => setSettings(prev => ({
                      ...prev,
                      completionDays: parseInt(v)
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">7 days</SelectItem>
                      <SelectItem value="14">14 days</SelectItem>
                      <SelectItem value="21">21 days</SelectItem>
                      <SelectItem value="28">28 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Auto Contact */}
            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label>Auto-Contact Sellers</Label>
                <p className="text-sm text-gray-500">Automatically send offers to new stale listings</p>
              </div>
              <Switch
                checked={settings.autoContact}
                onCheckedChange={(v) => setSettings(prev => ({ ...prev, autoContact: v }))}
              />
            </div>

            {settings.autoContact && (
              <div className="space-y-2">
                <Label>Contact Method</Label>
                <Select
                  value={settings.contactMethod}
                  onValueChange={(v: 'post' | 'email' | 'both') => setSettings(prev => ({
                    ...prev,
                    contactMethod: v
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="post">Post Only</SelectItem>
                    <SelectItem value="email">Email Only</SelectItem>
                    <SelectItem value="both">Both Post & Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Scan Frequency */}
            <div className="space-y-2">
              <Label>Scan Frequency</Label>
              <Select
                value={settings.scanFrequency}
                onValueChange={(v: 'hourly' | 'daily' | 'weekly') => setSettings(prev => ({
                  ...prev,
                  scanFrequency: v
                }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hourly">Hourly</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettingsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={() => {
              toast({ title: 'Settings saved' });
              setShowSettingsDialog(false);
            }}>
              Save Settings
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
