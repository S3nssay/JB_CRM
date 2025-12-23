import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import {
  Globe, Share2, Plus, Search, Settings, RefreshCw,
  CheckCircle, AlertCircle, Clock, Eye, MessageSquare,
  ExternalLink, Home, Building2, BarChart3, TrendingUp,
  Facebook, Instagram, Twitter, Linkedin, Play, Pause,
  Trash2, Edit, MoreVertical, Upload, Zap, ArrowLeft
} from 'lucide-react';

// Portal configuration
const portalConfig = [
  {
    id: 'zoopla',
    name: 'Zoopla',
    logo: '🏠',
    color: 'bg-purple-500',
    connected: true,
    autoSync: true,
    lastSync: '2024-12-15 09:30',
    totalListings: 45,
    totalViews: 12450,
    totalEnquiries: 234
  },
  {
    id: 'rightmove',
    name: 'Rightmove',
    logo: '🏡',
    color: 'bg-green-500',
    connected: true,
    autoSync: true,
    lastSync: '2024-12-15 09:30',
    totalListings: 45,
    totalViews: 10280,
    totalEnquiries: 198
  },
  {
    id: 'propertyfinder',
    name: 'PropertyFinder',
    logo: '🔍',
    color: 'bg-blue-500',
    connected: false,
    autoSync: false,
    lastSync: null,
    totalListings: 0,
    totalViews: 0,
    totalEnquiries: 0
  },
  {
    id: 'onthemarket',
    name: 'OnTheMarket',
    logo: '📍',
    color: 'bg-red-500',
    connected: false,
    autoSync: false,
    lastSync: null,
    totalListings: 0,
    totalViews: 0,
    totalEnquiries: 0
  }
];

// Social media configuration
const socialConfig = [
  {
    id: 'facebook',
    name: 'Facebook',
    icon: Facebook,
    color: 'bg-blue-600',
    connected: true,
    followers: 2450,
    posts: 128
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: Instagram,
    color: 'bg-pink-500',
    connected: true,
    followers: 3120,
    posts: 256
  },
  {
    id: 'twitter',
    name: 'Twitter/X',
    icon: Twitter,
    color: 'bg-black',
    connected: false,
    followers: 0,
    posts: 0
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'bg-blue-700',
    connected: false,
    followers: 0,
    posts: 0
  }
];

const getPortalStatusBadge = (status: string) => {
  switch (status) {
    case 'active':
      return <Badge className="bg-green-100 text-green-800">Active</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    case 'error':
      return <Badge className="bg-red-100 text-red-800">Error</Badge>;
    case 'inactive':
      return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function PropertySyndication() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('properties');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showConnectDialog, setShowConnectDialog] = useState(false);
  const [selectedPortals, setSelectedPortals] = useState<string[]>([]);
  const [selectedSocial, setSelectedSocial] = useState<string[]>([]);
  const [connectPortalName, setConnectPortalName] = useState('');
  const [connectUsername, setConnectUsername] = useState('');
  const [connectPassword, setConnectPassword] = useState('');

  // Fetch properties from API
  const { data: properties = [], isLoading: loadingProperties } = useQuery({
    queryKey: ['/api/crm/properties'],
    queryFn: async () => {
      const response = await fetch('/api/crm/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    }
  });

  // Fetch portal statuses
  const { data: portalStatuses = [] } = useQuery({
    queryKey: ['/api/crm/portals'],
    queryFn: async () => {
      const response = await fetch('/api/crm/portals');
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Save portal credentials mutation
  const saveCredentialsMutation = useMutation({
    mutationFn: async (data: { portalName: string; username: string; password: string }) => {
      return apiRequest('/api/crm/portals/credentials', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/portals'] });
      toast({
        title: 'Portal connected',
        description: 'Your portal credentials have been saved successfully.'
      });
      setShowConnectDialog(false);
      setConnectPortalName('');
      setConnectUsername('');
      setConnectPassword('');
    },
    onError: () => {
      toast({
        title: 'Connection failed',
        description: 'Failed to save portal credentials. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Test portal connection mutation
  const testConnectionMutation = useMutation({
    mutationFn: async (portalName: string) => {
      return apiRequest(`/api/crm/portals/${portalName}/test`, 'POST', {});
    },
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Connection successful',
          description: result.message || 'Portal login verified!'
        });
      } else {
        toast({
          title: 'Connection failed',
          description: result.message || 'Could not verify portal credentials.',
          variant: 'destructive'
        });
      }
    }
  });

  // Syndicate property mutation
  const syndicateMutation = useMutation({
    mutationFn: async ({ propertyId, portalName }: { propertyId: number; portalName: string }) => {
      return apiRequest(`/api/crm/portals/${portalName}/syndicate/${propertyId}`, 'POST', {});
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      if (result.success) {
        toast({
          title: 'Property published',
          description: `Successfully syndicated to ${result.listingId ? `Listing ID: ${result.listingId}` : 'portal'}`
        });
      } else {
        toast({
          title: 'Syndication failed',
          description: result.message || 'Failed to publish property.',
          variant: 'destructive'
        });
      }
    }
  });

  const handlePublish = async () => {
    if (selectedPortals.length === 0 && selectedSocial.length === 0) {
      toast({
        title: 'No platforms selected',
        description: 'Please select at least one portal or social media platform.',
        variant: 'destructive'
      });
      return;
    }

    // Syndicate to each selected portal
    for (const portalName of selectedPortals) {
      await syndicateMutation.mutateAsync({
        propertyId: selectedProperty.id,
        portalName
      });
    }

    setShowPublishDialog(false);
    setSelectedPortals([]);
    setSelectedSocial([]);
  };

  const handleSyncAll = () => {
    toast({
      title: 'Syncing all portals',
      description: 'Updating all connected portals with latest property data...'
    });
  };

  const handleConnectPortal = () => {
    if (!connectPortalName || !connectUsername || !connectPassword) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all fields.',
        variant: 'destructive'
      });
      return;
    }
    saveCredentialsMutation.mutate({
      portalName: connectPortalName,
      username: connectUsername,
      password: connectPassword
    });
  };

  // Transform properties to include portal status
  const propertiesWithPortalStatus = properties.map((property: any) => ({
    ...property,
    title: property.title || `${property.bedrooms} Bed ${property.propertyType} in ${property.area || 'London'}`,
    address: `${property.addressLine1 || ''}, ${property.postcode || ''}`.trim(),
    portals: portalConfig.map(portal => {
      const status = portalStatuses.find((s: any) =>
        s.propertyId === property.id && s.portalName === portal.id
      );
      return {
        name: portal.id,
        status: status?.status || 'inactive',
        views: status?.views || 0,
        enquiries: status?.enquiries || 0,
        listedAt: status?.listedAt || null,
        error: status?.error
      };
    }),
    socialMedia: []
  }));

  const filteredProperties = propertiesWithPortalStatus.filter((property: any) =>
    property.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    property.address?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/portal">
                <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <Share2 className="h-8 w-8 text-[#791E75] mr-3" />
              <h1 className="text-xl font-semibold">Property Syndication</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={handleSyncAll}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync All
              </Button>
              <Button size="sm" onClick={() => setShowConnectDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Portal
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Listings</p>
                  <p className="text-2xl font-bold">156</p>
                </div>
                <Home className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Portal Views</p>
                  <p className="text-2xl font-bold">22,730</p>
                </div>
                <Eye className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Enquiries</p>
                  <p className="text-2xl font-bold">432</p>
                </div>
                <MessageSquare className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Conversion Rate</p>
                  <p className="text-2xl font-bold">1.9%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="properties">
              <Home className="h-4 w-4 mr-2" />
              Properties
            </TabsTrigger>
            <TabsTrigger value="portals">
              <Globe className="h-4 w-4 mr-2" />
              Portals
            </TabsTrigger>
            <TabsTrigger value="social">
              <Share2 className="h-4 w-4 mr-2" />
              Social Media
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
          </TabsList>

          {/* Properties Tab */}
          <TabsContent value="properties">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Property Listings</CardTitle>
                    <CardDescription>Manage syndication across all platforms</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search properties..."
                        className="pl-9 w-[250px]"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingProperties ? (
                  <div className="flex justify-center items-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                  </div>
                ) : filteredProperties.length === 0 ? (
                  <div className="text-center py-12">
                    <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No properties yet</h3>
                    <p className="text-gray-500 mb-4">Add properties to start syndicating them to portals</p>
                    <Button onClick={() => window.location.href = '/crm/properties/new'}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Property
                    </Button>
                  </div>
                ) : (
                <div className="space-y-4">
                  {filteredProperties.map((property: any) => (
                    <div key={property.id} className="border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-start space-x-4">
                          <div className="w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                            <Building2 className="h-8 w-8 text-gray-400" />
                          </div>
                          <div>
                            <h3 className="font-semibold">{property.title}</h3>
                            <p className="text-sm text-gray-500">{property.address}</p>
                            <p className="text-lg font-bold mt-1">
                              {property.listingType === 'sale'
                                ? `£${property.price.toLocaleString()}`
                                : `£${property.price}/mo`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Dialog open={showPublishDialog && selectedProperty?.id === property.id} onOpenChange={(open) => {
                            setShowPublishDialog(open);
                            if (open) setSelectedProperty(property);
                          }}>
                            <DialogTrigger asChild>
                              <Button size="sm">
                                <Zap className="h-4 w-4 mr-2" />
                                Publish
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md">
                              <DialogHeader>
                                <DialogTitle>Publish Property</DialogTitle>
                                <DialogDescription>
                                  Select platforms to publish "{property.title}"
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label className="text-sm font-medium">Property Portals</Label>
                                  <div className="mt-2 space-y-2">
                                    {portalConfig.filter(p => p.connected).map((portal) => (
                                      <div key={portal.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={portal.id}
                                          checked={selectedPortals.includes(portal.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedPortals([...selectedPortals, portal.id]);
                                            } else {
                                              setSelectedPortals(selectedPortals.filter(p => p !== portal.id));
                                            }
                                          }}
                                        />
                                        <Label htmlFor={portal.id} className="flex items-center">
                                          <span className="mr-2">{portal.logo}</span>
                                          {portal.name}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-sm font-medium">Social Media</Label>
                                  <div className="mt-2 space-y-2">
                                    {socialConfig.filter(s => s.connected).map((social) => (
                                      <div key={social.id} className="flex items-center space-x-2">
                                        <Checkbox
                                          id={social.id}
                                          checked={selectedSocial.includes(social.id)}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedSocial([...selectedSocial, social.id]);
                                            } else {
                                              setSelectedSocial(selectedSocial.filter(s => s !== social.id));
                                            }
                                          }}
                                        />
                                        <Label htmlFor={social.id} className="flex items-center">
                                          <social.icon className="h-4 w-4 mr-2" />
                                          {social.name}
                                        </Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={handlePublish}>
                                  Publish Now
                                </Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Portal Status */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {property.portals.map((portal: any) => (
                          <div key={portal.name} className="bg-gray-50 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <span className="mr-2">
                                  {portalConfig.find(p => p.id === portal.name)?.logo}
                                </span>
                                <span className="font-medium capitalize">{portal.name}</span>
                              </div>
                              {getPortalStatusBadge(portal.status)}
                            </div>
                            {portal.status === 'active' && (
                              <div className="flex items-center justify-between text-sm text-gray-600">
                                <span className="flex items-center">
                                  <Eye className="h-3 w-3 mr-1" />
                                  {portal.views}
                                </span>
                                <span className="flex items-center">
                                  <MessageSquare className="h-3 w-3 mr-1" />
                                  {portal.enquiries}
                                </span>
                              </div>
                            )}
                            {portal.status === 'error' && (
                              <p className="text-xs text-red-600 mt-1">{(portal as any).error}</p>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Social Media Status */}
                      {property.socialMedia.length > 0 && (
                        <div className="mt-3 pt-3 border-t">
                          <p className="text-xs font-medium text-gray-500 mb-2">Social Media</p>
                          <div className="flex space-x-3">
                            {property.socialMedia.map((social: any) => {
                              const config = socialConfig.find(s => s.id === social.platform);
                              const IconComponent = config?.icon || Share2;
                              return (
                                <div key={social.platform} className="flex items-center text-sm">
                                  <IconComponent className="h-4 w-4 mr-1" />
                                  <span>{social.likes} likes</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Portals Tab */}
          <TabsContent value="portals">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {portalConfig.map((portal) => (
                <Card key={portal.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-12 h-12 ${portal.color} rounded-lg flex items-center justify-center text-2xl`}>
                          {portal.logo}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{portal.name}</CardTitle>
                          <CardDescription>
                            {portal.connected ? 'Connected' : 'Not connected'}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge variant={portal.connected ? 'default' : 'outline'}>
                        {portal.connected ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {portal.connected ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-2xl font-bold">{portal.totalListings}</p>
                            <p className="text-xs text-gray-500">Listings</p>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-2xl font-bold">{portal.totalViews.toLocaleString()}</p>
                            <p className="text-xs text-gray-500">Views</p>
                          </div>
                          <div className="text-center p-3 bg-gray-50 rounded-lg">
                            <p className="text-2xl font-bold">{portal.totalEnquiries}</p>
                            <p className="text-xs text-gray-500">Enquiries</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Switch checked={portal.autoSync} />
                            <span className="text-sm">Auto-sync</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            Last sync: {portal.lastSync}
                          </span>
                        </div>

                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm" className="flex-1">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Sync Now
                          </Button>
                          <Button variant="outline" size="sm" className="flex-1">
                            <Settings className="h-4 w-4 mr-2" />
                            Settings
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500 mb-4">
                          Connect your {portal.name} account to start syndicating properties
                        </p>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Connect {portal.name}
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Social Media Tab */}
          <TabsContent value="social">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {socialConfig.map((social) => {
                const IconComponent = social.icon;
                return (
                  <Card key={social.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 ${social.color} rounded-lg flex items-center justify-center`}>
                            <IconComponent className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{social.name}</CardTitle>
                            <CardDescription>
                              {social.connected ? `${social.followers.toLocaleString()} followers` : 'Not connected'}
                            </CardDescription>
                          </div>
                        </div>
                        <Badge variant={social.connected ? 'default' : 'outline'}>
                          {social.connected ? 'Connected' : 'Inactive'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {social.connected ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <p className="text-2xl font-bold">{social.posts}</p>
                              <p className="text-xs text-gray-500">Posts</p>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                              <p className="text-2xl font-bold">{social.followers.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">Followers</p>
                            </div>
                          </div>

                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm" className="flex-1">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              View Profile
                            </Button>
                            <Button variant="outline" size="sm" className="flex-1">
                              <Settings className="h-4 w-4 mr-2" />
                              Settings
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500 mb-4">
                            Connect your {social.name} account to start posting properties
                          </p>
                          <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Connect {social.name}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Auto-posting Settings */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Auto-Posting Settings</CardTitle>
                <CardDescription>
                  Configure automatic social media posting for new properties
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Auto-post new listings</p>
                      <p className="text-sm text-gray-500">Automatically post when a property is listed</p>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Post price reductions</p>
                      <p className="text-sm text-gray-500">Automatically post when a property price is reduced</p>
                    </div>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">Include property images</p>
                      <p className="text-sm text-gray-500">Attach property photos to social media posts</p>
                    </div>
                    <Switch checked={true} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Views by Portal</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {portalConfig.filter(p => p.connected).map((portal) => (
                      <div key={portal.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center">
                            <span className="mr-2">{portal.logo}</span>
                            {portal.name}
                          </span>
                          <span className="font-medium">{portal.totalViews.toLocaleString()}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${portal.color}`}
                            style={{ width: `${(portal.totalViews / 15000) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Enquiries by Portal</CardTitle>
                  <CardDescription>Last 30 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {portalConfig.filter(p => p.connected).map((portal) => (
                      <div key={portal.id} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center">
                            <span className="mr-2">{portal.logo}</span>
                            {portal.name}
                          </span>
                          <span className="font-medium">{portal.totalEnquiries}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${portal.color}`}
                            style={{ width: `${(portal.totalEnquiries / 300) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Top Performing Properties</CardTitle>
                  <CardDescription>By portal enquiries this month</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium">Property</th>
                          <th className="text-left p-3 font-medium">Zoopla</th>
                          <th className="text-left p-3 font-medium">Rightmove</th>
                          <th className="text-left p-3 font-medium">Total Enquiries</th>
                          <th className="text-left p-3 font-medium">Conversion</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredProperties.slice(0, 3).map((property: any) => {
                          const zooplaEnquiries = property.portals.find((p: any) => p.name === 'zoopla')?.enquiries || 0;
                          const rightmoveEnquiries = property.portals.find((p: any) => p.name === 'rightmove')?.enquiries || 0;
                          const total = zooplaEnquiries + rightmoveEnquiries;
                          return (
                            <tr key={property.id} className="border-b hover:bg-gray-50">
                              <td className="p-3">
                                <p className="font-medium">{property.title}</p>
                                <p className="text-sm text-gray-500">{property.address}</p>
                              </td>
                              <td className="p-3">{zooplaEnquiries}</td>
                              <td className="p-3">{rightmoveEnquiries}</td>
                              <td className="p-3 font-bold">{total}</td>
                              <td className="p-3">
                                <Badge variant="outline">
                                  {((total / 20) * 100).toFixed(1)}%
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Connect Portal Dialog */}
      <Dialog open={showConnectDialog} onOpenChange={setShowConnectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect Property Portal</DialogTitle>
            <DialogDescription>
              Enter your API credentials to connect a property portal
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Portal</Label>
              <Select value={connectPortalName} onValueChange={setConnectPortalName}>
                <SelectTrigger>
                  <SelectValue placeholder="Select portal" />
                </SelectTrigger>
                <SelectContent>
                  {portalConfig.map((portal) => (
                    <SelectItem key={portal.id} value={portal.id}>
                      <span className="flex items-center">
                        <span className="mr-2">{portal.logo}</span>
                        {portal.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Username / Email</Label>
              <Input
                placeholder="Enter your Zoopla username"
                value={connectUsername}
                onChange={(e) => setConnectUsername(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                placeholder="Enter your password"
                type="password"
                value={connectPassword}
                onChange={(e) => setConnectPassword(e.target.value)}
              />
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Your credentials are encrypted and stored securely. We use browser automation to publish properties on your behalf.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConnectDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConnectPortal}
              disabled={saveCredentialsMutation.isPending}
            >
              {saveCredentialsMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Connect Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
