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
  Building, UserCircle, Key, ArrowLeft, User, Gavel, Lock, UserPlus,
  LayoutGrid, List, Send, HardHat
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PropertyCard, type PropertyCardData } from '@/components/PropertyCard';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  const [propertyViewMode, setPropertyViewMode] = useState<'card' | 'list'>('list');
  const [showViewingWizard, setShowViewingWizard] = useState(false);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<Set<number>>(new Set());
  const [showBulkPublishDialog, setShowBulkPublishDialog] = useState(false);
  const [isBulkPublishing, setIsBulkPublishing] = useState(false);

  // Fetch properties from API
  const { data: properties = [], isLoading: loadingProperties, refetch: refetchProperties } = useQuery({
    queryKey: ['/api/crm/properties'],
    queryFn: async () => {
      const response = await fetch('/api/crm/properties', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    }
  });

  // Fetch managed properties from PM system (separate table)
  const { data: pmManagedProperties = [], error: managedPropertiesError } = useQuery({
    queryKey: ['/api/crm/managed-properties'],
    queryFn: async () => {
      const response = await fetch('/api/crm/managed-properties', { credentials: 'include' });
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to fetch managed properties:', response.status, errorText);
        throw new Error(`Failed to fetch managed properties: ${response.status}`);
      }
      return response.json();
    },
    retry: false
  });

  // Fetch rental agreements (active tenancies)
  const { data: rentalAgreements = [] } = useQuery({
    queryKey: ['/api/crm/rental-agreements'],
    queryFn: async () => {
      const response = await fetch('/api/crm/rental-agreements', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch landlords
  const { data: landlords = [] } = useQuery({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlords', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch tenants
  const { data: tenants = [] } = useQuery({
    queryKey: ['/api/crm/tenants'],
    queryFn: async () => {
      const response = await fetch('/api/crm/tenants', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch landlord leads (contacts with inquiry_type: valuation/selling/letting) to count unread/new ones
  const { data: landlordLeads = [] } = useQuery({
    queryKey: ['/api/crm/landlord-leads'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlord-leads', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Fetch buyer/renter leads to count unread/new ones
  const { data: buyerRenterLeads = [] } = useQuery({
    queryKey: ['/api/crm/leads'],
    queryFn: async () => {
      const response = await fetch('/api/crm/leads', { credentials: 'include' });
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Count new/unread leads (landlord leads use workflow_stage)
  const newLandlordLeadsCount = landlordLeads.filter((l: any) => l.workflow_stage === 'new' || !l.workflow_stage).length;
  const newBuyerRenterLeadsCount = buyerRenterLeads.filter((l: any) => l.status === 'new').length;

  // Calculate property stats
  // Managed properties count - use the PM system data (pm_properties table)
  const managedPropertiesCount = pmManagedProperties.length;
  // Listing properties = properties marked as listings (isListed=true) - these are sales/rentals shown in CRM
  // isPublishedWebsite controls visibility on PUBLIC WEBSITE (separate from CRM display)
  const listingProperties = properties.filter((p: any) => p.isListed === true);
  const activeRentalAgreements = rentalAgreements.filter((ra: any) => ra.status === 'active');

  // Listings Filters - Show all listing properties in CRM
  // isRental: true = rental, false = sale
  // isResidential: true = residential, false = commercial
  const resSalesProperties = listingProperties.filter((p: any) =>
    p.isRental === false && (p.isResidential === true || p.isResidential === undefined)
  );

  const resLetProperties = listingProperties.filter((p: any) =>
    p.isRental === true && (p.isResidential === true || p.isResidential === undefined) && p.status !== 'let'
  );

  const comSalesProperties = listingProperties.filter((p: any) =>
    p.isRental === false && p.isResidential === false
  );

  const comLetProperties = listingProperties.filter((p: any) =>
    p.isRental === true && p.isResidential === false && p.status !== 'let'
  );

  // Filter properties - show all listing properties in CRM
  const filteredProperties = listingProperties.filter((p: any) => {
    const matchesSearch = !propertySearch ||
      p.title?.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(propertySearch.toLowerCase()) ||
      p.addressLine1?.toLowerCase().includes(propertySearch.toLowerCase());

    const isResidentialProp = p.isResidential === true || p.isResidential === undefined;
    const isCommercialProp = p.isResidential === false;

    let matchesType = false;
    if (propertyFilter === 'all') matchesType = true;
    else if (propertyFilter === 'sale') matchesType = p.isRental === false && isResidentialProp;
    else if (propertyFilter === 'rental') matchesType = p.isRental === true && isResidentialProp;
    else if (propertyFilter === 'commercial_sale') matchesType = p.isRental === false && isCommercialProp;
    else if (propertyFilter === 'commercial_rental') matchesType = p.isRental === true && isCommercialProp;

    return matchesSearch && matchesType;
  });

  const handleViewTicket = (ticket: any) => {
    setSelectedTicket(ticket);
    setShowTicketDialog(true);
  };

  const handleViewProperty = (propertyId: number, isRental?: boolean) => {
    // For rental/managed properties, go to managed property card
    if (isRental === true) {
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
        credentials: 'include',
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

  // Property selection handlers
  const togglePropertySelection = (propertyId: number) => {
    setSelectedPropertyIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(propertyId)) {
        newSet.delete(propertyId);
      } else {
        newSet.add(propertyId);
      }
      return newSet;
    });
  };

  const selectAllProperties = () => {
    if (selectedPropertyIds.size === filteredProperties.length) {
      setSelectedPropertyIds(new Set());
    } else {
      setSelectedPropertyIds(new Set(filteredProperties.map((p: any) => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedPropertyIds(new Set());
  };

  // Bulk publish handler
  const handleBulkPublish = async (targets: {
    website?: boolean;
    zoopla?: boolean;
    rightmove?: boolean;
    onTheMarket?: boolean;
    social?: boolean;
  }) => {
    if (selectedPropertyIds.size === 0) return;

    setIsBulkPublishing(true);
    try {
      const response = await fetch('/api/crm/properties/bulk-publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          propertyIds: Array.from(selectedPropertyIds),
          targets
        })
      });

      if (!response.ok) {
        throw new Error('Failed to publish properties');
      }

      const result = await response.json();
      toast({
        title: 'Properties Published',
        description: `Successfully updated ${result.updated} properties.`
      });

      refetchProperties();
      setShowBulkPublishDialog(false);
      clearSelection();
    } catch (error: any) {
      toast({
        title: 'Publish Failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsBulkPublishing(false);
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

  // Show loading state while checking auth instead of returning null
  // This prevents the grey flash when transitioning from login
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#791E75] mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

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
                onClick={() => setLocation('/crm/property-management')}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Managed Properties
              </Button>
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
                onClick={() => setLocation('/crm/contractors')}
              >
                <HardHat className="mr-2 h-4 w-4" />
                Contractors
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
                onClick={() => setLocation('/crm/rental-agreements')}
              >
                <Key className="mr-2 h-4 w-4" />
                Agreements
              </Button>
            </div>

            {/* Leads Section */}
            <div className="pt-2 mt-2 border-t">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-2">
                Leads
              </p>
              <Button
                variant="ghost"
                className="w-full justify-start relative"
                onClick={() => setLocation('/crm/landlord-lead-pipeline')}
              >
                <GitBranch className="mr-2 h-4 w-4" />
                Landlord Pipeline
                {newLandlordLeadsCount > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    {newLandlordLeadsCount > 99 ? '99+' : newLandlordLeadsCount}
                  </span>
                )}
              </Button>
              <Button
                variant="ghost"
                className="w-full justify-start relative"
                onClick={() => setLocation('/crm/leads')}
              >
                <Users className="mr-2 h-4 w-4" />
                Buyer/Renter Leads
                {newBuyerRenterLeadsCount > 0 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
                    {newBuyerRenterLeadsCount > 99 ? '99+' : newBuyerRenterLeadsCount}
                  </span>
                )}
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
              variant="ghost"
              className="w-full justify-start"
              onClick={() => setLocation('/crm/integrations')}
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
                    Integrations
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/crm/security-matrix')}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    Security Matrix
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
                <Button onClick={() => setLocation('/crm/properties/create')}>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatsCard
                    title="Managed Properties"
                    value={String(managedPropertiesCount)}
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
                    icon={User}
                    color="bg-blue-600 text-white"
                    onClick={() => setLocation('/crm/landlords')}
                  />
                  <StatsCard
                    title="Total Tenants"
                    value={String(tenants.length)}
                    change={null}
                    icon={Users}
                    color="bg-teal-600 text-white"
                    onClick={() => setLocation('/crm/tenants')}
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
                  <div className="flex flex-wrap gap-4 items-center">
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
                        <TabsTrigger value="all">All ({listingProperties.length})</TabsTrigger>
                        <TabsTrigger value="sale">
                          Res. Sale ({listingProperties.filter((p: any) => p.isRental === false && p.isResidential !== false).length})
                        </TabsTrigger>
                        <TabsTrigger value="rental">
                          Res. Rent ({listingProperties.filter((p: any) => p.isRental === true && p.isResidential !== false).length})
                        </TabsTrigger>
                        <TabsTrigger value="commercial_sale">
                          Com. Sale ({listingProperties.filter((p: any) => p.isRental === false && p.isResidential === false).length})
                        </TabsTrigger>
                        <TabsTrigger value="commercial_rental">
                          Com. Rent ({listingProperties.filter((p: any) => p.isRental === true && p.isResidential === false).length})
                        </TabsTrigger>
                      </TabsList>
                    </Tabs>
                    {/* View Toggle */}
                    <div className="flex border rounded-md">
                      <Button
                        variant={propertyViewMode === 'card' ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-r-none"
                        onClick={() => setPropertyViewMode('card')}
                        title="Card View"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={propertyViewMode === 'list' ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-l-none"
                        onClick={() => setPropertyViewMode('list')}
                        title="List View"
                      >
                        <List className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Property Display */}
              {loadingProperties ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                </div>
              ) : filteredProperties.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {listingProperties.length === 0 ? 'No listed properties' : 'No matching properties'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {listingProperties.length === 0
                        ? 'Properties need to be marked as "listed" to appear here'
                        : 'Try adjusting your search or filter criteria'}
                    </p>
                    {listingProperties.length === 0 && (
                      <Button onClick={() => setLocation('/crm/properties/create')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Listed Property
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : propertyViewMode === 'list' ? (
                /* List View */
                <>
                  {/* Bulk Actions Bar */}
                  {selectedPropertyIds.size > 0 && (
                    <Card className="mb-4 border-[#791E75] bg-purple-50">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <Badge variant="secondary" className="text-sm">
                              {selectedPropertyIds.size} selected
                            </Badge>
                            <Button variant="ghost" size="sm" onClick={clearSelection}>
                              Clear Selection
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-[#791E75] hover:bg-[#5d1759]"
                              onClick={() => setShowBulkPublishDialog(true)}
                            >
                              <Send className="h-4 w-4 mr-2" />
                              Publish Selected
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardContent className="p-0">
                      <TooltipProvider>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[50px]">
                                <Checkbox
                                  checked={selectedPropertyIds.size === filteredProperties.length && filteredProperties.length > 0}
                                  onCheckedChange={selectAllProperties}
                                />
                              </TableHead>
                              <TableHead className="w-[80px]">ID</TableHead>
                              <TableHead>Property</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Price</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead className="text-center">Publishing Status</TableHead>
                              <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredProperties.map((property: any) => (
                              <TableRow key={property.id} className={selectedPropertyIds.has(property.id) ? 'bg-purple-50' : ''}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedPropertyIds.has(property.id)}
                                    onCheckedChange={() => togglePropertySelection(property.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                                    #{property.id}
                                  </span>
                                </TableCell>
                              <TableCell>
                                <div className="min-w-[200px]">
                                  <div className="font-medium">
                                    {property.title || `${property.bedrooms} Bed ${property.propertyType}`}
                                  </div>
                                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {property.addressLine1 ? `${property.addressLine1}, ` : ''}{property.postcode}
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge className={
                                  property.isRental === false ? 'bg-[#791E75] text-white' :
                                  property.isRental === true ? 'bg-[#F8B324] text-black' :
                                  'bg-purple-600 text-white'
                                }>
                                  {property.isRental === false ? 'Sale' : property.isRental === true ? 'Rent' : 'Commercial'}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-semibold">
                                {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(property.price)}
                                {property.isRental === true && '/mo'}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={
                                  (property.status || 'Active').toLowerCase() === 'active' ? 'bg-green-100 text-green-800' :
                                  (property.status || '').toLowerCase() === 'under offer' ? 'bg-yellow-100 text-yellow-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {property.status || 'Active'}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className={`p-1 rounded ${property.isPublishedWebsite ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <Globe className="h-4 w-4" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Website: {property.isPublishedWebsite ? 'Published' : 'Not Published'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className={`p-1 rounded text-xs font-bold ${property.isPublishedZoopla ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                        Z
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Zoopla: {property.isPublishedZoopla ? 'Published' : 'Not Published'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className={`p-1 rounded text-xs font-bold ${property.isPublishedRightmove ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        R
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Rightmove: {property.isPublishedRightmove ? 'Published' : 'Not Published'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className={`p-1 rounded text-xs font-bold ${property.isPublishedOnTheMarket ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-400'}`}>
                                        O
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>OnTheMarket: {property.isPublishedOnTheMarket ? 'Published' : 'Not Published'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <div className={`p-1 rounded ${property.isPublishedSocial ? 'bg-pink-100 text-pink-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <Share2 className="h-4 w-4" />
                                      </div>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Social Media: {property.isPublishedSocial ? 'Published' : 'Not Published'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  <Button variant="ghost" size="sm" onClick={() => handleViewProperty(property.id, property.isRental)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleEditProperty(property.id)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => handleShareProperty(property)}>
                                    <Share2 className="h-4 w-4" />
                                  </Button>
                                  {user?.role === 'admin' && (
                                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => handleDeleteProperty(property.id)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TooltipProvider>
                  </CardContent>
                </Card>
                </>
              ) : (
                /* Card View */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProperties.map((property: any) => (
                    <div key={property.id} className="relative">
                      {/* Property ID Badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <span className="font-mono text-xs bg-black/70 text-white px-2 py-1 rounded shadow">
                          #{property.id}
                        </span>
                      </div>
                      <PropertyCard
                        property={{
                          id: property.id,
                          title: property.title || `${property.bedrooms} Bed ${property.propertyType} in ${property.area || 'London'}`,
                          addressLine1: property.addressLine1,
                          addressLine2: property.addressLine2,
                          postcode: property.postcode,
                          area: property.area,
                          propertyType: property.propertyType,
                          isRental: property.isRental,
                          price: property.price,
                          bedrooms: property.bedrooms,
                          bathrooms: property.bathrooms,
                          sqft: property.sqft,
                          status: property.status || 'Active',
                          primaryImage: property.primaryImage,
                          createdAt: property.createdAt,
                          isPublishedWebsite: property.isPublishedWebsite,
                          isPublishedZoopla: property.isPublishedZoopla,
                          isPublishedRightmove: property.isPublishedRightmove,
                          isPublishedOnTheMarket: property.isPublishedOnTheMarket,
                          isPublishedSocial: property.isPublishedSocial
                        }}
                        showMap={true}
                        onView={handleViewProperty}
                        onEdit={handleEditProperty}
                        onShare={handleShareProperty}
                        onDelete={user?.role === 'admin' ? handleDeleteProperty : undefined}
                      />
                      {/* Publishing Status Indicators on Card */}
                      <TooltipProvider>
                        <div className="absolute top-12 right-3 flex flex-col gap-1">
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`p-1 rounded shadow-sm ${property.isPublishedWebsite ? 'bg-blue-500 text-white' : 'bg-white/80 text-gray-400'}`}>
                                <Globe className="h-3 w-3" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Website: {property.isPublishedWebsite ? 'Published' : 'Not Published'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`p-1 rounded shadow-sm text-xs font-bold w-6 h-6 flex items-center justify-center ${property.isPublishedZoopla ? 'bg-purple-500 text-white' : 'bg-white/80 text-gray-400'}`}>
                                Z
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Zoopla: {property.isPublishedZoopla ? 'Published' : 'Not Published'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`p-1 rounded shadow-sm text-xs font-bold w-6 h-6 flex items-center justify-center ${property.isPublishedRightmove ? 'bg-green-500 text-white' : 'bg-white/80 text-gray-400'}`}>
                                R
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Rightmove: {property.isPublishedRightmove ? 'Published' : 'Not Published'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`p-1 rounded shadow-sm text-xs font-bold w-6 h-6 flex items-center justify-center ${property.isPublishedOnTheMarket ? 'bg-orange-500 text-white' : 'bg-white/80 text-gray-400'}`}>
                                O
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>OnTheMarket: {property.isPublishedOnTheMarket ? 'Published' : 'Not Published'}</p>
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger>
                              <div className={`p-1 rounded shadow-sm ${property.isPublishedSocial ? 'bg-pink-500 text-white' : 'bg-white/80 text-gray-400'}`}>
                                <Share2 className="h-3 w-3" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Social: {property.isPublishedSocial ? 'Published' : 'Not Published'}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'maintenance' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Maintenance Management</h2>
                <Button onClick={() => setShowTicketDialog(true)}>
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

      {/* Bulk Publish Dialog */}
      <Dialog open={showBulkPublishDialog} onOpenChange={setShowBulkPublishDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Properties</DialogTitle>
            <DialogDescription>
              Select where to publish {selectedPropertyIds.size} selected properties
            </DialogDescription>
          </DialogHeader>
          <BulkPublishForm
            propertyCount={selectedPropertyIds.size}
            onPublish={handleBulkPublish}
            isPublishing={isBulkPublishing}
            onCancel={() => setShowBulkPublishDialog(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Bulk Publish Form Component
function BulkPublishForm({
  propertyCount,
  onPublish,
  isPublishing,
  onCancel
}: {
  propertyCount: number;
  onPublish: (targets: {
    website?: boolean;
    zoopla?: boolean;
    rightmove?: boolean;
    onTheMarket?: boolean;
    social?: boolean;
  }) => void;
  isPublishing: boolean;
  onCancel: () => void;
}) {
  const [targets, setTargets] = useState({
    website: false,
    zoopla: false,
    rightmove: false,
    onTheMarket: false,
    social: false
  });

  const toggleTarget = (key: keyof typeof targets) => {
    setTargets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const hasSelection = Object.values(targets).some(Boolean);

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <Checkbox
            checked={targets.website}
            onCheckedChange={() => toggleTarget('website')}
          />
          <Globe className="h-5 w-5 text-blue-600" />
          <div className="flex-1">
            <div className="font-medium">Website</div>
            <div className="text-xs text-muted-foreground">Publish to johnbarclay.co.uk</div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <Checkbox
            checked={targets.zoopla}
            onCheckedChange={() => toggleTarget('zoopla')}
          />
          <div className="h-5 w-5 bg-purple-600 text-white rounded flex items-center justify-center text-xs font-bold">Z</div>
          <div className="flex-1">
            <div className="font-medium">Zoopla</div>
            <div className="text-xs text-muted-foreground">Publish to Zoopla portal</div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <Checkbox
            checked={targets.rightmove}
            onCheckedChange={() => toggleTarget('rightmove')}
          />
          <div className="h-5 w-5 bg-green-600 text-white rounded flex items-center justify-center text-xs font-bold">R</div>
          <div className="flex-1">
            <div className="font-medium">Rightmove</div>
            <div className="text-xs text-muted-foreground">Publish to Rightmove portal</div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <Checkbox
            checked={targets.onTheMarket}
            onCheckedChange={() => toggleTarget('onTheMarket')}
          />
          <div className="h-5 w-5 bg-orange-600 text-white rounded flex items-center justify-center text-xs font-bold">O</div>
          <div className="flex-1">
            <div className="font-medium">OnTheMarket</div>
            <div className="text-xs text-muted-foreground">Publish to OnTheMarket portal</div>
          </div>
        </label>

        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
          <Checkbox
            checked={targets.social}
            onCheckedChange={() => toggleTarget('social')}
          />
          <Share2 className="h-5 w-5 text-pink-600" />
          <div className="flex-1">
            <div className="font-medium">Social Media</div>
            <div className="text-xs text-muted-foreground">Share to social media channels</div>
          </div>
        </label>
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isPublishing}>
          Cancel
        </Button>
        <Button
          onClick={() => onPublish(targets)}
          disabled={!hasSelection || isPublishing}
          className="bg-[#791E75] hover:bg-[#5d1759]"
        >
          {isPublishing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Publishing...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Publish {propertyCount} Properties
            </>
          )}
        </Button>
      </DialogFooter>
    </div>
  );
}