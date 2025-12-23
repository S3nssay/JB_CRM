import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Building2, Users, Home, Wrench, Calendar, BarChart3,
  Settings, LogOut, Plus, Eye, Edit, Trash2, Bell,
  MessageSquare, Share2, DollarSign, TrendingUp,
  FileText, Clock, AlertCircle, CheckCircle, Shield,
  GitBranch, Mic, Globe, Mail, Search, MapPin, Loader2,
  Building, UserCircle, Key, ArrowLeft, User, Gavel
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { PropertyCard, type PropertyCardData } from '@/components/PropertyCard';
import { BulkPropertyOperations } from '@/components/BulkPropertyOperations';
import { queryClient } from '@/lib/queryClient';
import { ScheduleViewingWizard } from '@/components/ScheduleViewingWizard';

// Dashboard widgets - Now clickable for drill-down
const StatsCard = ({ title, value, change, icon: Icon, color, onClick }: any) => (
  <Card
    className={onClick ? 'cursor-pointer hover:shadow-lg transition-shadow hover:ring-2 hover:ring-primary/20' : ''}
    onClick={onClick}
  >
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold mt-2">{value}</p>
          {change && (
            <p className={`text-sm mt-1 ${change > 0 ? 'text-[#791E75]600' : 'text-red-600'}`}>
              {change > 0 ? '+' : ''}{change}% from last month
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
      {onClick && (
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          Click to view details →
        </p>
      )}
    </CardContent>
  </Card>
);

export default function CRMDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [propertySearch, setPropertySearch] = useState('');
  const [propertyFilter, setPropertyFilter] = useState<'all' | 'sale' | 'rental' | 'commercial_sale' | 'commercial_rental'>('all');
  const [showViewingWizard, setShowViewingWizard] = useState(false);

  // Fetch properties from API
  const { data: properties = [], isLoading: loadingProperties, refetch: refetchProperties } = useQuery({
    queryKey: ['/api/crm/properties'],
    queryFn: async () => {
      const response = await fetch('/api/crm/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    }
  });

  // Fetch rental agreements (active tenancies)
  const { data: rentalAgreements = [] } = useQuery({
    queryKey: ['/api/crm/rental-agreements'],
    queryFn: async () => {
      const response = await fetch('/api/crm/rental-agreements');
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch landlords
  const { data: landlords = [] } = useQuery({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlords');
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Calculate property stats
  // Managed properties = properties with isManaged flag set to true
  const managedProperties = properties.filter((p: any) => p.isManaged === true);
  const activeRentalAgreements = rentalAgreements.filter((ra: any) => ra.status === 'active');

  // Listings Filters
  const resSalesProperties = properties.filter((p: any) =>
    p.listingType === 'sale' && (p.propertyCategory === 'residential' || !p.propertyCategory)
  );

  const resLetProperties = properties.filter((p: any) =>
    p.listingType === 'rental' && (p.propertyCategory === 'residential' || !p.propertyCategory) && p.status !== 'let'
  );

  const comSalesProperties = properties.filter((p: any) =>
    p.listingType === 'sale' && p.propertyCategory === 'commercial'
  );

  const comLetProperties = properties.filter((p: any) =>
    p.listingType === 'rental' && p.propertyCategory === 'commercial' && p.status !== 'let'
  );

  // Filter properties
  const filteredProperties = properties.filter((p: any) => {
    const matchesSearch = !propertySearch ||
      p.title?.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.addressLine1?.toLowerCase().includes(propertySearch.toLowerCase());

    const isResidential = p.propertyCategory === 'residential' || !p.propertyCategory;
    const isCommercial = p.propertyCategory === 'commercial';

    let matchesType = false;
    if (propertyFilter === 'all') matchesType = true;
    else if (propertyFilter === 'sale') matchesType = p.listingType === 'sale' && isResidential;
    else if (propertyFilter === 'rental') matchesType = p.listingType === 'rental' && isResidential;
    else if (propertyFilter === 'commercial_sale') matchesType = p.listingType === 'sale' && isCommercial;
    else if (propertyFilter === 'commercial_rental') matchesType = p.listingType === 'rental' && isCommercial;

    const isNotManaged = p.status !== 'let';

    return matchesSearch && matchesType && isNotManaged;
  });

  const handleViewTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setShowTicketDialog(true);
  };

  const handleViewProperty = (propertyId: number, listingType?: string) => {
    // For rental/managed properties, go to managed property card
    if (listingType === 'rental') {
      setLocation(`/crm/managed-property/${propertyId}`);
    } else {
      setLocation(`/property/${propertyId}`);
    }
  };

  const handleEditProperty = (propertyId: number) => {
    setLocation(`/crm/properties/${propertyId}/edit`);
  };

  const handleShareProperty = (property: PropertyCardData) => {
    navigator.clipboard.writeText(`${window.location.origin}/property/${property.id}`);
    toast({
      title: "Link copied",
      description: `Property link for "${property.title}" copied to clipboard.`
    });
  };

  const handleDeleteProperty = async (propertyId: number) => {
    if (!confirm('Are you sure you want to delete this property?')) return;

    try {
      const response = await fetch(`/api/crm/properties/${propertyId}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        toast({ title: 'Property deleted', description: 'The property has been removed.' });
        refetchProperties();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete property', variant: 'destructive' });
    }
  };

  const handleImportProperty = async () => {
    if (!importUrl) return;

    setIsImporting(true);
    try {
      const response = await fetch('/api/crm/properties/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to import');
      }

      toast({
        title: "Import Successful",
        description: "Property has been imported and saved."
      });

      setImportUrl('');
      setShowImportDialog(false);
      refetchProperties();
    } catch (error: any) {
      toast({
        title: "Import Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsImporting(false);
    }
  };

  useEffect(() => {
    // Get user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      // Redirect to login if not authenticated
      setLocation('/crm/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    setLocation('/crm/login');
  };

  if (!user) return null;

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
              <Building2 className="h-8 w-8 text-[#F8B324]600 mr-3" />
              <h1 className="text-xl font-semibold">John Barclay CRM</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">{user?.fullName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-md h-[calc(100vh-4rem)]">
          <nav className="p-4 space-y-2">
            <Button
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('overview')}
            >
              <BarChart3 className="mr-2 h-4 w-4" />
              Overview
            </Button>
            <Button
              variant={activeTab === 'properties' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('properties')}
            >
              <Home className="mr-2 h-4 w-4" />
              Listed Properties
            </Button>
            <Button
              variant={activeTab === 'maintenance' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('maintenance')}
            >
              <Wrench className="mr-2 h-4 w-4" />
              Maintenance
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-[#791E75]"
              onClick={() => setLocation('/crm/sales-progression')}
            >
              <Gavel className="mr-2 h-4 w-4" />
              Sales Progression
            </Button>
            <div className="pt-2 mt-2 border-t">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Property Management
              </p>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setLocation('/crm/landlords')}
              >
                <User className="mr-2 h-4 w-4" />
                Landlords
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setLocation('/crm/tenants')}
              >
                <Users className="mr-2 h-4 w-4" />
                Tenants
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setLocation('/crm/contacts')}
              >
                <Users className="mr-2 h-4 w-4" />
                Contacts (Unified)
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setLocation('/crm/property-management')}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Managed Properties
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setLocation('/crm/rental-agreements')}
              >
                <Key className="mr-2 h-4 w-4" />
                Agreements
              </Button>
            </div>

            {/* Application Links - Split by Category */}
            <div className="pt-2 mt-2 border-t">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Listings
              </p>
              <Button
                variant={activeTab === 'res_sales' ? 'default' : 'ghost'}
                className="w-full justify-start text-sm"
                onClick={() => { setPropertyFilter('sale'); setActiveTab('properties'); }}
              >
                <Home className="mr-2 h-4 w-4" />
                Residential Sales
              </Button>
              <Button
                variant={activeTab === 'res_let' ? 'default' : 'ghost'}
                className="w-full justify-start text-sm"
                onClick={() => { setPropertyFilter('rental'); setActiveTab('properties'); }}
              >
                <Key className="mr-2 h-4 w-4" />
                Residential Lettings
              </Button>
              <Button
                variant={activeTab === 'com_sales' ? 'default' : 'ghost'}
                className="w-full justify-start text-sm"
                onClick={() => { setPropertyFilter('commercial_sale'); setActiveTab('properties'); }}
              >
                <Building className="mr-2 h-4 w-4" />
                Commercial Sales
              </Button>
              <Button
                variant={activeTab === 'com_let' ? 'default' : 'ghost'}
                className="w-full justify-start text-sm"
                onClick={() => { setPropertyFilter('commercial_rental'); setActiveTab('properties'); }}
              >
                <Building2 className="mr-2 h-4 w-4" />
                Commercial Lettings
              </Button>
            </div>

            <Button
              variant={activeTab === 'settings' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>

            {/* Admin Tools - Only show for admin users */}
            {user?.role === 'admin' && (
              <>
                <div className="pt-4 mt-4 border-t">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                    Admin Tools
                  </p>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/crm/users')}
                  >
                    <Shield className="mr-2 h-4 w-4" />
                    User Management
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/crm/workflows')}
                  >
                    <GitBranch className="mr-2 h-4 w-4" />
                    Workflow Management
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/crm/staff')}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Staff Management
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/crm/voice-agent')}
                  >
                    <Mic className="mr-2 h-4 w-4" />
                    Voice Agent
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/crm/integrations')}
                  >
                    <Key className="mr-2 h-4 w-4" />
                    Integration Settings
                  </Button>
                </div>
              </>
            )}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 relative">
          <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Import Property from Website</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Property URL</label>
                  <Input
                    placeholder="https://johnbarclay.co.uk/property/..."
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Paste the full URL from the John Barclay website. The system will scrape details and download images.
                  </p>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
                  <Button onClick={handleImportProperty} disabled={isImporting || !importUrl}>
                    {isImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      'Import Property'
                    )}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Dashboard Overview</h2>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Property
                </Button>
              </div>

              {/* Stats Grid - Managed Properties */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                  Managed Portfolio
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <StatsCard
                    title="Managed Properties"
                    value={String(managedProperties.length)}
                    change={null}
                    icon={Building2}
                    color="bg-[#791E75] text-white"
                    onClick={() => setLocation('/crm/property-management')}
                  />
                  <StatsCard
                    title="Active Tenancies"
                    value={String(activeRentalAgreements.length)}
                    change={null}
                    icon={Key}
                    color="bg-green-600 text-white"
                    onClick={() => setLocation('/crm/rental-agreements')}
                  />
                  <StatsCard
                    title="Total Landlords"
                    value={String(landlords.length)}
                    change={null}
                    icon={Users}
                    color="bg-blue-600 text-white"
                    onClick={() => setLocation('/crm/landlords')}
                  />
                </div>
              </div>

              {/* Stats Grid - Residential Listings */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Home className="h-5 w-5 text-emerald-600" />
                  Residential Listings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <StatsCard
                    title="Residential Sales"
                    value={String(resSalesProperties.length)}
                    change={null}
                    icon={DollarSign}
                    color="bg-emerald-600 text-white"
                    onClick={() => { setPropertyFilter('sale'); setActiveTab('properties'); }}
                  />
                  <StatsCard
                    title="Residential Lettings"
                    value={String(resLetProperties.length)}
                    change={null}
                    icon={Key}
                    color="bg-[#F8B324] text-black"
                    onClick={() => { setPropertyFilter('rental'); setActiveTab('properties'); }}
                  />
                </div>
              </div>

              {/* Stats Grid - Commercial Listings */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Building className="h-5 w-5 text-indigo-600" />
                  Commercial Listings
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <StatsCard
                    title="Commercial Sales"
                    value={String(comSalesProperties.length)}
                    change={null}
                    icon={Building}
                    color="bg-indigo-600 text-white"
                    onClick={() => { setPropertyFilter('commercial_sale'); setActiveTab('properties'); }}
                  />
                  <StatsCard
                    title="Commercial Lettings"
                    value={String(comLetProperties.length)}
                    change={null}
                    icon={Building2}
                    color="bg-indigo-400 text-white"
                    onClick={() => { setPropertyFilter('commercial_rental'); setActiveTab('properties'); }}
                  />
                </div>
              </div>

              {/* Recent Activities - From database */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        Communications
                      </CardTitle>
                      <CardDescription>Email and messages with clients</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setLocation('/crm/communications')}>
                      View All
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="py-6 text-center text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <p>No recent messages</p>
                      <p className="text-sm mt-1">Emails and messages will appear here</p>
                      <Button variant="outline" className="mt-4" onClick={() => setLocation('/crm/communications')}>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Message
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Button
                      className="h-20 flex flex-col"
                      variant="outline"
                      onClick={() => setLocation('/crm/properties/create')}
                    >
                      <Plus className="h-6 w-6 mb-2" />
                      <span className="text-xs">Add Property</span>
                    </Button>
                    <Button
                      className="h-20 flex flex-col"
                      variant="outline"
                      onClick={() => setActiveTab('maintenance')}
                    >
                      <Wrench className="h-6 w-6 mb-2" />
                      <span className="text-xs">New Ticket</span>
                    </Button>
                    <Button
                      className="h-20 flex flex-col"
                      variant="outline"
                      onClick={() => setShowViewingWizard(true)}
                      data-testid="button-schedule-viewing"
                    >
                      <Calendar className="h-6 w-6 mb-2" />
                      <span className="text-xs">Schedule Viewing</span>
                    </Button>
                    <Button
                      className="h-20 flex flex-col"
                      variant="outline"
                      onClick={() => setActiveTab('reports')}
                    >
                      <FileText className="h-6 w-6 mb-2" />
                      <span className="text-xs">Generate Report</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'properties' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center flex-wrap gap-4">
                <h2 className="text-2xl font-bold">Property Management</h2>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowImportDialog(true)}>
                    <Globe className="mr-2 h-4 w-4" />
                    Import from URL
                  </Button>
                  <Button
                    onClick={() => setLocation('/crm/properties/create')}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Property
                  </Button>
                </div>
              </div>

              {/* Admin Bulk Operations */}
              {user?.role === 'admin' && (
                <BulkPropertyOperations onImportComplete={() => refetchProperties()} />
              )}

              {/* Search and Filter */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4">
                    <div className="flex-1 min-w-[200px]">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search properties by title, address, postcode..."
                          value={propertySearch}
                          onChange={(e) => setPropertySearch(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                    </div>
                    <Tabs value={propertyFilter} onValueChange={(v) => setPropertyFilter(v as any)}>
                      <TabsList>
                        <TabsTrigger value="all">All ({properties.length})</TabsTrigger>
                        <TabsTrigger value="sale">
                          Sale ({properties.filter((p: any) => p.listingType === 'sale').length})
                        </TabsTrigger>
                        <TabsTrigger value="rental">
                          Rent ({properties.filter((p: any) => p.listingType === 'rental').length})
                        </TabsTrigger>
                        <TabsTrigger value="commercial">
                          Commercial ({properties.filter((p: any) => p.listingType === 'commercial').length})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                  </div>
                </CardContent>
              </Card>

              {/* Property Cards Grid */}
              {loadingProperties ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                </div>
              ) : filteredProperties.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {properties.length === 0 ? 'No properties yet' : 'No matching properties'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {properties.length === 0
                        ? 'Add your first property to get started'
                        : 'Try adjusting your search or filter criteria'}
                    </p>
                    {properties.length === 0 && (
                      <Button onClick={() => setLocation('/crm/properties/create')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Property
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProperties.map((property: any) => (
                    <PropertyCard
                      key={property.id}
                      property={{
                        id: property.id,
                        title: property.title || `${property.bedrooms} Bed ${property.propertyType} in ${property.area || 'London'}`,
                        addressLine1: property.addressLine1,
                        addressLine2: property.addressLine2,
                        postcode: property.postcode,
                        area: property.area,
                        propertyType: property.propertyType,
                        listingType: property.listingType,
                        price: property.price,
                        bedrooms: property.bedrooms,
                        bathrooms: property.bathrooms,
                        sqft: property.sqft,
                        status: property.status || 'Active',
                        primaryImage: property.primaryImage,
                        createdAt: property.createdAt
                      }}
                      showMap={true}
                      onView={handleViewProperty}
                      onEdit={handleEditProperty}
                      onShare={handleShareProperty}
                      onDelete={user?.role === 'admin' ? handleDeleteProperty : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Maintenance Management</h2>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Ticket
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Open Tickets</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-400">0</div>
                    <p className="text-sm text-gray-600">No data in database</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">In Progress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-400">0</div>
                    <p className="text-sm text-gray-600">No data in database</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Completed Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-gray-400">0</div>
                    <p className="text-sm text-gray-600">No data in database</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Tickets</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="py-8 text-center text-gray-500">
                    <Wrench className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <p>No maintenance tickets</p>
                    <p className="text-sm mt-1">Ticket data will appear here once available in the database</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'staff' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Staff Management</h2>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Staff Member
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Total Staff</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">28</div>
                    <p className="text-sm text-gray-600">Active employees</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Present Today</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#791E75]600">24</div>
                    <p className="text-sm text-gray-600">In office/field</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">On Leave</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#791E75]600">3</div>
                    <p className="text-sm text-gray-600">Holiday/sick</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg">Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-[#791E75]">4.2</div>
                    <p className="text-sm text-gray-600">Average rating</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Department Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      { dept: "Sales", count: 8, performance: 4.3 },
                      { dept: "Lettings", count: 7, performance: 4.1 },
                      { dept: "Maintenance", count: 10, performance: 4.4 },
                      { dept: "Admin", count: 3, performance: 4.0 },
                    ].map((dept) => (
                      <div key={dept.dept} className="p-4 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <h4 className="font-medium">{dept.dept}</h4>
                          <span className="text-sm text-gray-600">{dept.count} staff</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex-1 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-[#F8B324] text-black 600 h-2 rounded-full"
                              style={{ width: `${(dept.performance / 5) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{dept.performance}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>
      </div>

      {/* Ticket Details Dialog */}
      <Dialog open={showTicketDialog} onOpenChange={setShowTicketDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Maintenance Ticket Details</DialogTitle>
          </DialogHeader>
          {selectedTicket && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-sm text-gray-500">{selectedTicket.id}</span>
                  <h3 className="font-semibold text-lg mt-1">{selectedTicket.issue}</h3>
                </div>
                <div className="flex gap-2">
                  <Badge className={
                    selectedTicket.priority === 'Emergency' ? 'bg-red-500' :
                      selectedTicket.priority === 'High' ? 'bg-orange-500' :
                        'bg-yellow-500'
                  }>
                    {selectedTicket.priority}
                  </Badge>
                  <Badge variant="outline">{selectedTicket.status}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Property:</span>
                  <p className="font-medium">{selectedTicket.property}</p>
                </div>
                <div>
                  <span className="text-gray-500">Status:</span>
                  <p className="font-medium">{selectedTicket.status}</p>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">Quick Actions</h4>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toast({
                        title: "Contractor notified",
                        description: "The assigned contractor has been notified of this ticket."
                      });
                    }}
                  >
                    Notify Contractor
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      toast({
                        title: "Status updated",
                        description: "Ticket status has been updated to In Progress."
                      });
                    }}
                  >
                    Mark In Progress
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      toast({
                        title: "Ticket resolved",
                        description: "Ticket has been marked as completed."
                      });
                      setShowTicketDialog(false);
                    }}
                  >
                    Mark Complete
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowTicketDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ScheduleViewingWizard
        isOpen={showViewingWizard}
        onClose={() => setShowViewingWizard(false)}
        onSuccess={() => {
          toast({
            title: "Viewing scheduled",
            description: "The property viewing has been added to the calendar."
          });
        }}
      />
    </div>
  );
}