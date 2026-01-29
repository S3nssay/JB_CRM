import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users, Plus, Eye, Edit, Trash2, Bell, Search, Phone, Mail,
  ArrowLeft, Loader2, MessageCircle, Calendar, Filter,
  Home, TrendingUp, Instagram, Facebook, MessageSquare,
  UserPlus, PhoneCall, Globe, Building, Star, Clock,
  CheckCircle2, XCircle, AlertCircle, Send, ChevronRight,
  MoreHorizontal, UserCheck, MapPin, Banknote, X, FileText,
  Shield, ShieldCheck, ShieldAlert, CreditCard, FileCheck,
  Upload, Landmark, BadgeCheck
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { queryClient } from '@/lib/queryClient';
import { ScrollArea } from '@/components/ui/scroll-area';

// Types
interface Lead {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  instagramHandle: string | null;
  facebookId: string | null;
  tiktokHandle: string | null;
  twitterHandle: string | null;
  linkedinUrl: string | null;
  source: string;
  sourceDetail: string | null;
  referredBy: string | null;
  leadType: string;
  preferredPropertyType: string | null;
  preferredBedrooms: number | null;
  preferredAreas: string[] | null;
  minBudget: number | null;
  maxBudget: number | null;
  moveInDate: string | null;
  requirements: string | null;
  petsAllowed: boolean | null;
  parkingRequired: boolean | null;
  gardenRequired: boolean | null;
  // KYC Fields
  kycStatus: string | null;
  kycVerifiedAt: string | null;
  kycVerifiedBy: number | null;
  kycNotes: string | null;
  // ID Verification
  idDocumentType: string | null;
  idDocumentUrl: string | null;
  idVerified: boolean | null;
  idVerifiedAt: string | null;
  // Proof of Address
  proofOfAddressType: string | null;
  proofOfAddressUrl: string | null;
  proofOfAddressVerified: boolean | null;
  proofOfAddressVerifiedAt: string | null;
  // Proof of Funds
  proofOfFundsStatus: string | null;
  proofOfFundsType: string | null;
  proofOfFundsUrl: string | null;
  proofOfFundsAmount: number | null;
  proofOfFundsVerified: boolean | null;
  proofOfFundsVerifiedAt: string | null;
  proofOfFundsVerifiedBy: number | null;
  proofOfFundsExpiryDate: string | null;
  proofOfFundsNotes: string | null;
  // Mortgage Details
  hasMortgageAip: boolean | null;
  mortgageBroker: string | null;
  mortgageLender: string | null;
  mortgageAipAmount: number | null;
  mortgageAipExpiryDate: string | null;
  mortgageAipUrl: string | null;
  // Status
  status: string;
  priority: string;
  score: number;
  lostReason: string | null;
  assignedTo: number | null;
  convertedAt: string | null;
  convertedToTenantId: number | null;
  convertedToPropertyId: number | null;
  lastContactedAt: string | null;
  lastActivityAt: string | null;
  nextFollowUpDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface LeadCommunication {
  id: number;
  leadId: number;
  channel: string;
  direction: string;
  type: string;
  subject: string | null;
  content: string;
  summary: string | null;
  propertyId: number | null;
  handledBy: number | null;
  outcome: string | null;
  followUpRequired: boolean;
  followUpDate: string | null;
  createdAt: string;
}

interface LeadPropertyView {
  id: number;
  leadId: number;
  propertyId: number;
  viewedAt: string;
  viewDuration: number | null;
  viewSource: string | null;
  savedToFavorites: boolean;
  requestedViewing: boolean;
  requestedMoreInfo: boolean;
}

interface LeadViewing {
  id: number;
  leadId: number;
  propertyId: number;
  scheduledAt: string;
  duration: number;
  viewingType: string;
  conductedBy: number | null;
  status: string;
  feedback: string | null;
  agentNotes: string | null;
  interested: boolean | null;
}

interface LeadActivity {
  id: number;
  leadId: number;
  activityType: string;
  description: string;
  relatedPropertyId: number | null;
  performedBy: number | null;
  createdAt: string;
}

interface LeadWithDetails extends Lead {
  communications: LeadCommunication[];
  propertyViews: LeadPropertyView[];
  viewings: LeadViewing[];
  activities: LeadActivity[];
}

// Source icons
const sourceIcons: Record<string, React.ReactNode> = {
  website: <Globe className="h-4 w-4" />,
  phone_call: <PhoneCall className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  walk_in: <Users className="h-4 w-4" />,
  referral: <UserPlus className="h-4 w-4" />,
  portal: <Building className="h-4 w-4" />,
  instagram: <Instagram className="h-4 w-4" />,
  facebook: <Facebook className="h-4 w-4" />,
  tiktok: <MessageSquare className="h-4 w-4" />,
};

// Channel icons for communications
const channelIcons: Record<string, React.ReactNode> = {
  phone: <Phone className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  whatsapp: <MessageCircle className="h-4 w-4" />,
  sms: <MessageSquare className="h-4 w-4" />,
  in_person: <Users className="h-4 w-4" />,
  portal_message: <Building className="h-4 w-4" />,
  instagram_dm: <Instagram className="h-4 w-4" />,
  facebook_messenger: <Facebook className="h-4 w-4" />,
  tiktok_dm: <MessageSquare className="h-4 w-4" />,
  twitter_dm: <MessageSquare className="h-4 w-4" />,
  linkedin: <MessageSquare className="h-4 w-4" />,
};

// Status badge styles
const statusStyles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  new: { variant: "default", className: "bg-blue-500" },
  contacted: { variant: "outline", className: "text-blue-600 border-blue-600" },
  qualified: { variant: "default", className: "bg-purple-500" },
  viewing_booked: { variant: "default", className: "bg-amber-500" },
  offer_made: { variant: "default", className: "bg-orange-500" },
  converted: { variant: "default", className: "bg-green-500" },
  lost: { variant: "destructive", className: "" },
  archived: { variant: "secondary", className: "" },
};

// Priority badge styles
const priorityStyles: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  hot: { variant: "destructive", className: "" },
  warm: { variant: "default", className: "bg-orange-500" },
  medium: { variant: "outline", className: "text-blue-600 border-blue-600" },
  cold: { variant: "secondary", className: "" },
};

export default function LeadManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [showCommunicationDialog, setShowCommunicationDialog] = useState(false);
  const [selectedLead, setSelectedLead] = useState<LeadWithDetails | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  // Form state for new lead
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    mobile: '',
    instagramHandle: '',
    facebookId: '',
    tiktokHandle: '',
    source: 'website',
    sourceDetail: '',
    leadType: 'rental',
    preferredPropertyType: '',
    preferredBedrooms: '',
    minBudget: '',
    maxBudget: '',
    requirements: '',
    notes: ''
  });

  // Form state for logging communication
  const [commFormData, setCommFormData] = useState({
    channel: 'phone',
    direction: 'outbound',
    type: 'follow_up',
    subject: '',
    content: '',
    summary: '',
    outcome: '',
    followUpRequired: false,
    followUpDate: ''
  });

  // Fetch all leads
  const { data: leads = [], isLoading, refetch } = useQuery<Lead[]>({
    queryKey: ['/api/crm/leads'],
    queryFn: async () => {
      const response = await fetch('/api/crm/leads');
      if (!response.ok) throw new Error('Failed to fetch leads');
      return response.json();
    }
  });

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['/api/crm/leads/stats/dashboard'],
    queryFn: async () => {
      const response = await fetch('/api/crm/leads/stats/dashboard');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  // Fetch single lead details when selected
  const { data: leadDetails, isLoading: detailsLoading, refetch: refetchDetails } = useQuery<LeadWithDetails>({
    queryKey: ['/api/crm/leads', selectedLead?.id],
    queryFn: async () => {
      const response = await fetch(`/api/crm/leads/${selectedLead?.id}`);
      if (!response.ok) throw new Error('Failed to fetch lead details');
      return response.json();
    },
    enabled: !!selectedLead?.id && showDetailDialog
  });

  // Create lead mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        ...data,
        preferredBedrooms: data.preferredBedrooms ? parseInt(data.preferredBedrooms) : null,
        minBudget: data.minBudget ? parseInt(data.minBudget) * 100 : null, // Convert to pence
        maxBudget: data.maxBudget ? parseInt(data.maxBudget) * 100 : null,
      };
      const response = await fetch('/api/crm/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to create lead');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Lead created successfully' });
      setShowAddDialog(false);
      resetForm();
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create lead', variant: 'destructive' });
    }
  });

  // Update lead mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<Lead> }) => {
      const response = await fetch(`/api/crm/leads/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update lead');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Lead updated successfully' });
      refetch();
      refetchDetails();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update lead', variant: 'destructive' });
    }
  });

  // Delete lead mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete lead');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Lead deleted successfully' });
      setShowDetailDialog(false);
      setSelectedLead(null);
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete lead', variant: 'destructive' });
    }
  });

  // Log communication mutation
  const logCommunicationMutation = useMutation({
    mutationFn: async ({ leadId, data }: { leadId: number; data: typeof commFormData }) => {
      const payload = {
        ...data,
        followUpDate: data.followUpDate || null
      };
      const response = await fetch(`/api/crm/leads/${leadId}/communications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error('Failed to log communication');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Communication logged successfully' });
      setShowCommunicationDialog(false);
      resetCommForm();
      refetch();
      refetchDetails();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to log communication', variant: 'destructive' });
    }
  });

  // Convert to tenant mutation
  const convertMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const response = await fetch(`/api/crm/leads/${leadId}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to convert lead');
      return response.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: `Lead converted to tenant #${data.tenantId}` });
      setShowDetailDialog(false);
      setSelectedLead(null);
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to convert lead', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      mobile: '',
      instagramHandle: '',
      facebookId: '',
      tiktokHandle: '',
      source: 'website',
      sourceDetail: '',
      leadType: 'rental',
      preferredPropertyType: '',
      preferredBedrooms: '',
      minBudget: '',
      maxBudget: '',
      requirements: '',
      notes: ''
    });
  };

  const resetCommForm = () => {
    setCommFormData({
      channel: 'phone',
      direction: 'outbound',
      type: 'follow_up',
      subject: '',
      content: '',
      summary: '',
      outcome: '',
      followUpRequired: false,
      followUpDate: ''
    });
  };

  // Filter leads
  const filteredLeads = leads.filter((lead: Lead) => {
    const matchesSearch =
      lead.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm) ||
      lead.mobile?.includes(searchTerm);
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    const matchesSource = sourceFilter === 'all' || lead.source === sourceFilter;
    const matchesPriority = priorityFilter === 'all' || lead.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesSource && matchesPriority;
  });

  const openLeadDetail = (lead: Lead) => {
    setSelectedLead(lead as LeadWithDetails);
    setShowDetailDialog(true);
    setActiveTab('overview');
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      setLocation('/crm/login');
    }
  }, []);

  if (!user) return null;

  const formatCurrency = (amount: number | null) => {
    if (!amount) return 'N/A';
    return `£${(amount / 100).toLocaleString()}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatDateTime = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <TrendingUp className="h-8 w-8 text-[#791E75] ml-2 mr-3" />
              <h1 className="text-xl font-semibold">Lead Management</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <span className="text-sm text-gray-700">{user?.fullName}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="space-y-6">
          {/* Stats Cards - Primary: Rental vs Sales */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Rental Leads</p>
                    <p className="text-4xl font-bold mt-2 text-blue-900">{stats?.rental_leads || 0}</p>
                    <p className="text-xs text-blue-600 mt-1">Looking to rent a property</p>
                  </div>
                  <div className="p-4 rounded-full bg-blue-500">
                    <Home className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-green-700 uppercase tracking-wide">Sales Leads</p>
                    <p className="text-4xl font-bold mt-2 text-green-900">{stats?.purchase_leads || 0}</p>
                    <p className="text-xs text-green-600 mt-1">Looking to buy a property</p>
                  </div>
                  <div className="p-4 rounded-full bg-green-500">
                    <Banknote className="h-8 w-8 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Stats Cards - Secondary */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Leads</p>
                    <p className="text-2xl font-bold mt-1">{stats?.total || leads.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-[#791E75]">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">New This Week</p>
                    <p className="text-2xl font-bold mt-1">{stats?.new_this_week || 0}</p>
                  </div>
                  <div className="p-3 rounded-full bg-blue-500">
                    <UserPlus className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Hot Leads</p>
                    <p className="text-2xl font-bold mt-1">{stats?.hot_leads || 0}</p>
                  </div>
                  <div className="p-3 rounded-full bg-red-500">
                    <Star className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Viewings Booked</p>
                    <p className="text-2xl font-bold mt-1">{stats?.viewing_booked || 0}</p>
                  </div>
                  <div className="p-3 rounded-full bg-amber-500">
                    <Calendar className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Converted</p>
                    <p className="text-2xl font-bold mt-1">{stats?.converted || 0}</p>
                  </div>
                  <div className="p-3 rounded-full bg-green-500">
                    <CheckCircle2 className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filters */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="relative flex-1 min-w-[250px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="viewing_booked">Viewing Booked</SelectItem>
                <SelectItem value="offer_made">Offer Made</SelectItem>
                <SelectItem value="converted">Converted</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="website">Website</SelectItem>
                <SelectItem value="phone_call">Phone Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="walk_in">Walk-in</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="portal">Portal</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="tiktok">TikTok</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Lead
            </Button>
          </div>

          {/* Leads Table */}
          <Card>
            <CardHeader>
              <CardTitle>Leads Pipeline</CardTitle>
              <CardDescription>
                {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No leads found</h3>
                  <p className="text-gray-500 mb-4">
                    {leads.length === 0 ? 'Add your first lead to get started' : 'Try adjusting your filters'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead: Lead) => (
                      <TableRow
                        key={lead.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => openLeadDetail(lead)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#791E75] flex items-center justify-center text-white font-semibold">
                              {lead.fullName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{lead.fullName}</p>
                              {lead.preferredAreas && lead.preferredAreas.length > 0 && (
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {lead.preferredAreas.slice(0, 2).join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {lead.email && (
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span className="truncate max-w-[150px]">{lead.email}</span>
                              </div>
                            )}
                            {(lead.mobile || lead.phone) && (
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span>{lead.mobile || lead.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {sourceIcons[lead.source] || <Globe className="h-4 w-4" />}
                            <span className="text-sm capitalize">{lead.source.replace('_', ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {lead.leadType === 'both' ? 'Rent/Buy' : lead.leadType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={priorityStyles[lead.priority]?.variant || 'secondary'}
                            className={priorityStyles[lead.priority]?.className}
                          >
                            {lead.priority.charAt(0).toUpperCase() + lead.priority.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={statusStyles[lead.status]?.variant || 'secondary'}
                            className={statusStyles[lead.status]?.className}
                          >
                            {lead.status.replace('_', ' ').charAt(0).toUpperCase() + lead.status.replace('_', ' ').slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-500">
                            {formatDate(lead.lastContactedAt)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openLeadDetail(lead); }}>
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLead(lead as LeadWithDetails);
                                setShowCommunicationDialog(true);
                              }}>
                                <MessageCircle className="mr-2 h-4 w-4" />
                                Log Communication
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {lead.status !== 'converted' && (
                                <DropdownMenuItem onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Convert this lead to a tenant?')) {
                                    convertMutation.mutate(lead.id);
                                  }
                                }}>
                                  <UserCheck className="mr-2 h-4 w-4" />
                                  Convert to Tenant
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (confirm('Delete this lead?')) {
                                    deleteMutation.mutate(lead.id);
                                  }
                                }}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Lead Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Capture details for a new enquiry
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contact Details */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Contact Details</h3>
            </div>

            <div>
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="Phone number"
              />
            </div>

            <div>
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="Mobile number"
              />
            </div>

            {/* Social Media */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Social Media (for DMs)</h3>
            </div>

            <div>
              <Label htmlFor="instagramHandle">Instagram</Label>
              <Input
                id="instagramHandle"
                value={formData.instagramHandle}
                onChange={(e) => setFormData({ ...formData, instagramHandle: e.target.value })}
                placeholder="@username"
              />
            </div>

            <div>
              <Label htmlFor="facebookId">Facebook</Label>
              <Input
                id="facebookId"
                value={formData.facebookId}
                onChange={(e) => setFormData({ ...formData, facebookId: e.target.value })}
                placeholder="Facebook profile/ID"
              />
            </div>

            <div>
              <Label htmlFor="tiktokHandle">TikTok</Label>
              <Input
                id="tiktokHandle"
                value={formData.tiktokHandle}
                onChange={(e) => setFormData({ ...formData, tiktokHandle: e.target.value })}
                placeholder="@username"
              />
            </div>

            {/* Source Information */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Source Information</h3>
            </div>

            <div>
              <Label htmlFor="source">Source *</Label>
              <Select
                value={formData.source}
                onValueChange={(value) => setFormData({ ...formData, source: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="phone_call">Phone Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="walk_in">Walk-in</SelectItem>
                  <SelectItem value="referral">Referral</SelectItem>
                  <SelectItem value="portal">Portal (Zoopla, etc.)</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="sourceDetail">Source Detail</Label>
              <Input
                id="sourceDetail"
                value={formData.sourceDetail}
                onChange={(e) => setFormData({ ...formData, sourceDetail: e.target.value })}
                placeholder="e.g., Zoopla, Google Ads, specific property"
              />
            </div>

            {/* Requirements */}
            <div className="space-y-4 md:col-span-2">
              <h3 className="font-semibold text-sm text-gray-700 border-b pb-2">Requirements</h3>
            </div>

            <div>
              <Label htmlFor="leadType">Lead Type *</Label>
              <Select
                value={formData.leadType}
                onValueChange={(value) => setFormData({ ...formData, leadType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rental">Looking to Rent</SelectItem>
                  <SelectItem value="purchase">Looking to Buy</SelectItem>
                  <SelectItem value="both">Rent or Buy</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="seller">Seller</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="preferredPropertyType">Property Type</Label>
              <Select
                value={formData.preferredPropertyType}
                onValueChange={(value) => setFormData({ ...formData, preferredPropertyType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat</SelectItem>
                  <SelectItem value="house">House</SelectItem>
                  <SelectItem value="studio">Studio</SelectItem>
                  <SelectItem value="maisonette">Maisonette</SelectItem>
                  <SelectItem value="penthouse">Penthouse</SelectItem>
                  <SelectItem value="any">Any</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="preferredBedrooms">Bedrooms</Label>
              <Input
                id="preferredBedrooms"
                type="number"
                value={formData.preferredBedrooms}
                onChange={(e) => setFormData({ ...formData, preferredBedrooms: e.target.value })}
                placeholder="Number of bedrooms"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="minBudget">Min Budget (£)</Label>
                <Input
                  id="minBudget"
                  type="number"
                  value={formData.minBudget}
                  onChange={(e) => setFormData({ ...formData, minBudget: e.target.value })}
                  placeholder="Min"
                />
              </div>
              <div>
                <Label htmlFor="maxBudget">Max Budget (£)</Label>
                <Input
                  id="maxBudget"
                  type="number"
                  value={formData.maxBudget}
                  onChange={(e) => setFormData({ ...formData, maxBudget: e.target.value })}
                  placeholder="Max"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="requirements">Specific Requirements</Label>
              <Textarea
                id="requirements"
                value={formData.requirements}
                onChange={(e) => setFormData({ ...formData, requirements: e.target.value })}
                placeholder="Any specific requirements or notes..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.fullName || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lead Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={(open) => {
        setShowDetailDialog(open);
        if (!open) setSelectedLead(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-[#791E75] flex items-center justify-center text-white font-semibold text-xl">
                  {selectedLead?.fullName?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <DialogTitle className="text-xl">{selectedLead?.fullName}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant={statusStyles[selectedLead?.status || 'new']?.variant || 'secondary'}
                      className={statusStyles[selectedLead?.status || 'new']?.className}
                    >
                      {selectedLead?.status?.replace('_', ' ')}
                    </Badge>
                    <Badge
                      variant={priorityStyles[selectedLead?.priority || 'medium']?.variant || 'secondary'}
                      className={priorityStyles[selectedLead?.priority || 'medium']?.className}
                    >
                      {selectedLead?.priority}
                    </Badge>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setShowCommunicationDialog(true)}
                >
                  <MessageCircle className="h-4 w-4 mr-2" />
                  Log Communication
                </Button>
                {selectedLead?.status !== 'converted' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm('Convert this lead to a tenant?')) {
                        convertMutation.mutate(selectedLead!.id);
                      }
                    }}
                  >
                    <UserCheck className="h-4 w-4 mr-2" />
                    Convert
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="verification">KYC & Funds</TabsTrigger>
              <TabsTrigger value="communications">Comms</TabsTrigger>
              <TabsTrigger value="properties">Properties</TabsTrigger>
              <TabsTrigger value="viewings">Viewings</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              {detailsLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
                </div>
              ) : (
                <>
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Contact Info */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          {leadDetails?.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span>{leadDetails.email}</span>
                            </div>
                          )}
                          {leadDetails?.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span>{leadDetails.phone}</span>
                            </div>
                          )}
                          {leadDetails?.mobile && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span>{leadDetails.mobile} (Mobile)</span>
                            </div>
                          )}
                          {leadDetails?.instagramHandle && (
                            <div className="flex items-center gap-2">
                              <Instagram className="h-4 w-4 text-gray-400" />
                              <span>{leadDetails.instagramHandle}</span>
                            </div>
                          )}
                          {leadDetails?.facebookId && (
                            <div className="flex items-center gap-2">
                              <Facebook className="h-4 w-4 text-gray-400" />
                              <span>{leadDetails.facebookId}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Source Info */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Lead Source</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            {sourceIcons[leadDetails?.source || 'website']}
                            <span className="capitalize">{leadDetails?.source?.replace('_', ' ')}</span>
                          </div>
                          {leadDetails?.sourceDetail && (
                            <p className="text-gray-500">Detail: {leadDetails.sourceDetail}</p>
                          )}
                          {leadDetails?.referredBy && (
                            <p className="text-gray-500">Referred by: {leadDetails.referredBy}</p>
                          )}
                          <p className="text-gray-500">Created: {formatDate(leadDetails?.createdAt || null)}</p>
                        </CardContent>
                      </Card>

                      {/* Requirements */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Requirements</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <Home className="h-4 w-4 text-gray-400" />
                            <span className="capitalize">
                              {leadDetails?.leadType === 'both' ? 'Rent or Buy' : leadDetails?.leadType}
                            </span>
                          </div>
                          {leadDetails?.preferredPropertyType && (
                            <p>Type: <span className="capitalize">{leadDetails.preferredPropertyType}</span></p>
                          )}
                          {leadDetails?.preferredBedrooms && (
                            <p>Bedrooms: {leadDetails.preferredBedrooms}+</p>
                          )}
                          <div className="flex items-center gap-2">
                            <Banknote className="h-4 w-4 text-gray-400" />
                            <span>
                              {formatCurrency(leadDetails?.minBudget || null)} - {formatCurrency(leadDetails?.maxBudget || null)}
                            </span>
                          </div>
                          {leadDetails?.preferredAreas && leadDetails.preferredAreas.length > 0 && (
                            <div className="flex items-start gap-2">
                              <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                              <span>{leadDetails.preferredAreas.join(', ')}</span>
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {/* Status Management */}
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Status Management</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div>
                            <Label className="text-xs">Status</Label>
                            <Select
                              value={leadDetails?.status || 'new'}
                              onValueChange={(value) => {
                                if (selectedLead) {
                                  updateMutation.mutate({ id: selectedLead.id, data: { status: value } });
                                }
                              }}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="new">New</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="qualified">Qualified</SelectItem>
                                <SelectItem value="viewing_booked">Viewing Booked</SelectItem>
                                <SelectItem value="offer_made">Offer Made</SelectItem>
                                <SelectItem value="converted">Converted</SelectItem>
                                <SelectItem value="lost">Lost</SelectItem>
                                <SelectItem value="archived">Archived</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-xs">Priority</Label>
                            <Select
                              value={leadDetails?.priority || 'medium'}
                              onValueChange={(value) => {
                                if (selectedLead) {
                                  updateMutation.mutate({ id: selectedLead.id, data: { priority: value } });
                                }
                              }}
                            >
                              <SelectTrigger className="mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="hot">Hot</SelectItem>
                                <SelectItem value="warm">Warm</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="cold">Cold</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Notes */}
                    {leadDetails?.notes && (
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm">Notes</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-600">{leadDetails.notes}</p>
                        </CardContent>
                      </Card>
                    )}
                  </TabsContent>

                  {/* KYC & Verification Tab */}
                  <TabsContent value="verification" className="space-y-4">
                    {/* Warning banner if status is serious but KYC incomplete */}
                    {['qualified', 'viewing_booked', 'offer_made'].includes(leadDetails?.status || '') &&
                     (leadDetails?.kycStatus !== 'verified' || leadDetails?.proofOfFundsStatus !== 'verified') && (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                        <div>
                          <p className="font-medium text-amber-800">Verification Required</p>
                          <p className="text-sm text-amber-700">
                            This lead is at a serious stage. KYC and proof of funds should be verified before proceeding with viewings or offers.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* KYC Status Card */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Shield className="h-4 w-4" />
                              KYC Status
                            </CardTitle>
                            <Badge
                              variant={
                                leadDetails?.kycStatus === 'verified' ? 'default' :
                                leadDetails?.kycStatus === 'pending' ? 'outline' :
                                leadDetails?.kycStatus === 'failed' ? 'destructive' :
                                'secondary'
                              }
                              className={leadDetails?.kycStatus === 'verified' ? 'bg-green-500' : ''}
                            >
                              {leadDetails?.kycStatus === 'verified' && <ShieldCheck className="h-3 w-3 mr-1" />}
                              {leadDetails?.kycStatus || 'Not Started'}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* ID Document */}
                          <div className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">ID Document</span>
                              {leadDetails?.idVerified ? (
                                <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
                              ) : (
                                <Badge variant="outline">Not Verified</Badge>
                              )}
                            </div>
                            {leadDetails?.idDocumentType ? (
                              <p className="text-sm text-gray-500 capitalize">{leadDetails.idDocumentType.replace('_', ' ')}</p>
                            ) : (
                              <p className="text-sm text-gray-400">No document uploaded</p>
                            )}
                            {leadDetails?.idDocumentUrl && (
                              <Button variant="link" size="sm" className="p-0 h-auto mt-1">
                                <FileText className="h-3 w-3 mr-1" />
                                View Document
                              </Button>
                            )}
                          </div>

                          {/* Proof of Address */}
                          <div className="border rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Proof of Address</span>
                              {leadDetails?.proofOfAddressVerified ? (
                                <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
                              ) : (
                                <Badge variant="outline">Not Verified</Badge>
                              )}
                            </div>
                            {leadDetails?.proofOfAddressType ? (
                              <p className="text-sm text-gray-500 capitalize">{leadDetails.proofOfAddressType.replace('_', ' ')}</p>
                            ) : (
                              <p className="text-sm text-gray-400">No document uploaded</p>
                            )}
                          </div>

                          {leadDetails?.kycNotes && (
                            <div className="bg-gray-50 rounded p-2">
                              <p className="text-xs text-gray-500">Notes: {leadDetails.kycNotes}</p>
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              // TODO: Open KYC update dialog
                              toast({ title: 'Coming Soon', description: 'KYC verification dialog will be implemented' });
                            }}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Update KYC Documents
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Proof of Funds Card */}
                      <Card>
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              <Landmark className="h-4 w-4" />
                              Proof of Funds
                            </CardTitle>
                            <Badge
                              variant={
                                leadDetails?.proofOfFundsStatus === 'verified' ? 'default' :
                                leadDetails?.proofOfFundsStatus === 'pending_review' ? 'outline' :
                                leadDetails?.proofOfFundsStatus === 'rejected' ? 'destructive' :
                                'secondary'
                              }
                              className={leadDetails?.proofOfFundsStatus === 'verified' ? 'bg-green-500' : ''}
                            >
                              {leadDetails?.proofOfFundsStatus === 'verified' && <BadgeCheck className="h-3 w-3 mr-1" />}
                              {(leadDetails?.proofOfFundsStatus || 'not_provided').replace('_', ' ')}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {leadDetails?.proofOfFundsType ? (
                            <div className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium capitalize">
                                  {leadDetails.proofOfFundsType.replace('_', ' ')}
                                </span>
                                {leadDetails.proofOfFundsVerified && (
                                  <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>
                                )}
                              </div>
                              {leadDetails.proofOfFundsAmount && (
                                <p className="text-lg font-semibold text-green-600">
                                  {formatCurrency(leadDetails.proofOfFundsAmount)}
                                </p>
                              )}
                              {leadDetails.proofOfFundsExpiryDate && (
                                <p className="text-xs text-gray-500">
                                  Expires: {formatDate(leadDetails.proofOfFundsExpiryDate)}
                                </p>
                              )}
                              {leadDetails.proofOfFundsUrl && (
                                <Button variant="link" size="sm" className="p-0 h-auto">
                                  <FileText className="h-3 w-3 mr-1" />
                                  View Document
                                </Button>
                              )}
                            </div>
                          ) : (
                            <div className="text-center py-4 border rounded-lg bg-gray-50">
                              <CreditCard className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                              <p className="text-sm text-gray-500">No proof of funds provided</p>
                            </div>
                          )}

                          {/* Mortgage AIP Section */}
                          <div className="border-t pt-3 mt-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">Mortgage AIP</span>
                              {leadDetails?.hasMortgageAip ? (
                                <Badge className="bg-blue-500">Has AIP</Badge>
                              ) : (
                                <Badge variant="secondary">No AIP</Badge>
                              )}
                            </div>
                            {leadDetails?.hasMortgageAip && (
                              <div className="space-y-1 text-sm">
                                {leadDetails.mortgageLender && (
                                  <p className="text-gray-600">Lender: {leadDetails.mortgageLender}</p>
                                )}
                                {leadDetails.mortgageAipAmount && (
                                  <p className="text-gray-600">Amount: {formatCurrency(leadDetails.mortgageAipAmount)}</p>
                                )}
                                {leadDetails.mortgageBroker && (
                                  <p className="text-gray-500 text-xs">Broker: {leadDetails.mortgageBroker}</p>
                                )}
                                {leadDetails.mortgageAipExpiryDate && (
                                  <p className="text-gray-500 text-xs">Expires: {formatDate(leadDetails.mortgageAipExpiryDate)}</p>
                                )}
                              </div>
                            )}
                          </div>

                          {leadDetails?.proofOfFundsNotes && (
                            <div className="bg-gray-50 rounded p-2">
                              <p className="text-xs text-gray-500">Notes: {leadDetails.proofOfFundsNotes}</p>
                            </div>
                          )}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => {
                              // TODO: Open proof of funds dialog
                              toast({ title: 'Coming Soon', description: 'Proof of funds dialog will be implemented' });
                            }}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Update Proof of Funds
                          </Button>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Verification Actions */}
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedLead && confirm('Mark KYC as verified?')) {
                                updateMutation.mutate({
                                  id: selectedLead.id,
                                  data: {
                                    kycStatus: 'verified',
                                    kycVerifiedAt: new Date().toISOString()
                                  }
                                });
                              }
                            }}
                            disabled={leadDetails?.kycStatus === 'verified'}
                          >
                            <ShieldCheck className="h-4 w-4 mr-2" />
                            Mark KYC Verified
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedLead && confirm('Mark proof of funds as verified?')) {
                                updateMutation.mutate({
                                  id: selectedLead.id,
                                  data: {
                                    proofOfFundsStatus: 'verified',
                                    proofOfFundsVerified: true,
                                    proofOfFundsVerifiedAt: new Date().toISOString()
                                  }
                                });
                              }
                            }}
                            disabled={leadDetails?.proofOfFundsVerified}
                          >
                            <BadgeCheck className="h-4 w-4 mr-2" />
                            Mark Funds Verified
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              if (selectedLead) {
                                updateMutation.mutate({
                                  id: selectedLead.id,
                                  data: {
                                    kycStatus: 'pending'
                                  }
                                });
                              }
                            }}
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Request KYC from Lead
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>

                  {/* Communications Tab */}
                  <TabsContent value="communications" className="space-y-4">
                    {(!leadDetails?.communications || leadDetails.communications.length === 0) ? (
                      <div className="text-center py-8">
                        <MessageCircle className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No communications logged yet</p>
                        <Button
                          variant="outline"
                          className="mt-3"
                          onClick={() => setShowCommunicationDialog(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Log First Communication
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leadDetails.communications.map((comm) => (
                          <Card key={comm.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3">
                                  <div className={`p-2 rounded-full ${comm.direction === 'inbound' ? 'bg-blue-100' : 'bg-green-100'}`}>
                                    {channelIcons[comm.channel] || <MessageCircle className="h-4 w-4" />}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium capitalize">{comm.channel.replace('_', ' ')}</span>
                                      <Badge variant="outline" className="text-xs">
                                        {comm.direction === 'inbound' ? 'Received' : 'Sent'}
                                      </Badge>
                                      <Badge variant="secondary" className="text-xs capitalize">
                                        {comm.type.replace('_', ' ')}
                                      </Badge>
                                    </div>
                                    {comm.subject && (
                                      <p className="text-sm font-medium mt-1">{comm.subject}</p>
                                    )}
                                    <p className="text-sm text-gray-600 mt-1">{comm.content}</p>
                                    {comm.outcome && (
                                      <p className="text-xs text-gray-500 mt-2">
                                        Outcome: <span className="capitalize">{comm.outcome.replace('_', ' ')}</span>
                                      </p>
                                    )}
                                  </div>
                                </div>
                                <span className="text-xs text-gray-400">
                                  {formatDateTime(comm.createdAt)}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Properties Tab */}
                  <TabsContent value="properties" className="space-y-4">
                    {(!leadDetails?.propertyViews || leadDetails.propertyViews.length === 0) ? (
                      <div className="text-center py-8">
                        <Home className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No property views tracked yet</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leadDetails.propertyViews.map((view) => (
                          <Card key={view.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 rounded-full bg-purple-100">
                                    <Home className="h-4 w-4 text-purple-600" />
                                  </div>
                                  <div>
                                    <p className="font-medium">Property #{view.propertyId}</p>
                                    <p className="text-sm text-gray-500">
                                      Viewed via {view.viewSource || 'website'}
                                      {view.viewDuration && ` • ${Math.round(view.viewDuration / 60)} min`}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  {view.savedToFavorites && (
                                    <Badge variant="outline" className="text-xs">
                                      <Star className="h-3 w-3 mr-1" />
                                      Saved
                                    </Badge>
                                  )}
                                  {view.requestedViewing && (
                                    <Badge className="text-xs bg-amber-500">
                                      Viewing Requested
                                    </Badge>
                                  )}
                                  <span className="text-xs text-gray-400">
                                    {formatDateTime(view.viewedAt)}
                                  </span>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Viewings Tab */}
                  <TabsContent value="viewings" className="space-y-4">
                    {(!leadDetails?.viewings || leadDetails.viewings.length === 0) ? (
                      <div className="text-center py-8">
                        <Calendar className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No viewings scheduled</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leadDetails.viewings.map((viewing) => (
                          <Card key={viewing.id}>
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`p-2 rounded-full ${
                                    viewing.status === 'completed' ? 'bg-green-100' :
                                    viewing.status === 'cancelled' ? 'bg-red-100' :
                                    'bg-amber-100'
                                  }`}>
                                    <Calendar className={`h-4 w-4 ${
                                      viewing.status === 'completed' ? 'text-green-600' :
                                      viewing.status === 'cancelled' ? 'text-red-600' :
                                      'text-amber-600'
                                    }`} />
                                  </div>
                                  <div>
                                    <p className="font-medium">Property #{viewing.propertyId}</p>
                                    <p className="text-sm text-gray-500">
                                      {formatDateTime(viewing.scheduledAt)} • {viewing.duration} min • {viewing.viewingType}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={
                                    viewing.status === 'completed' ? 'default' :
                                    viewing.status === 'cancelled' ? 'destructive' :
                                    'outline'
                                  } className={viewing.status === 'completed' ? 'bg-green-500' : ''}>
                                    {viewing.status}
                                  </Badge>
                                  {viewing.interested !== null && (
                                    <Badge variant={viewing.interested ? 'default' : 'secondary'}>
                                      {viewing.interested ? 'Interested' : 'Not Interested'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              {viewing.feedback && (
                                <p className="text-sm text-gray-600 mt-2 pl-11">
                                  Feedback: {viewing.feedback}
                                </p>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Activity Tab */}
                  <TabsContent value="activity" className="space-y-4">
                    {(!leadDetails?.activities || leadDetails.activities.length === 0) ? (
                      <div className="text-center py-8">
                        <Clock className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                        <p className="text-gray-500">No activity recorded</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {leadDetails.activities.map((activity) => (
                          <div key={activity.id} className="flex items-start gap-3 p-3 border-l-2 border-gray-200">
                            <div className="p-1.5 rounded-full bg-gray-100">
                              {activity.activityType === 'created' && <UserPlus className="h-3 w-3" />}
                              {activity.activityType === 'status_change' && <CheckCircle2 className="h-3 w-3" />}
                              {activity.activityType === 'communication' && <MessageCircle className="h-3 w-3" />}
                              {activity.activityType === 'property_viewed' && <Eye className="h-3 w-3" />}
                              {activity.activityType === 'viewing_booked' && <Calendar className="h-3 w-3" />}
                              {activity.activityType === 'note_added' && <Edit className="h-3 w-3" />}
                              {activity.activityType === 'converted' && <UserCheck className="h-3 w-3" />}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm">{activity.description}</p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDateTime(activity.createdAt)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                </>
              )}
            </ScrollArea>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Log Communication Dialog */}
      <Dialog open={showCommunicationDialog} onOpenChange={setShowCommunicationDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Log Communication</DialogTitle>
            <DialogDescription>
              Record a communication with {selectedLead?.fullName}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Channel *</Label>
                <Select
                  value={commFormData.channel}
                  onValueChange={(value) => setCommFormData({ ...commFormData, channel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Phone Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                    <SelectItem value="portal_message">Portal Message</SelectItem>
                    <SelectItem value="instagram_dm">Instagram DM</SelectItem>
                    <SelectItem value="facebook_messenger">Facebook Messenger</SelectItem>
                    <SelectItem value="tiktok_dm">TikTok DM</SelectItem>
                    <SelectItem value="twitter_dm">Twitter DM</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Direction *</Label>
                <Select
                  value={commFormData.direction}
                  onValueChange={(value) => setCommFormData({ ...commFormData, direction: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Outbound (We contacted them)</SelectItem>
                    <SelectItem value="inbound">Inbound (They contacted us)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={commFormData.type}
                  onValueChange={(value) => setCommFormData({ ...commFormData, type: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="enquiry">Enquiry</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="viewing_request">Viewing Request</SelectItem>
                    <SelectItem value="viewing_confirmation">Viewing Confirmation</SelectItem>
                    <SelectItem value="offer">Offer Discussion</SelectItem>
                    <SelectItem value="negotiation">Negotiation</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Outcome</Label>
                <Select
                  value={commFormData.outcome}
                  onValueChange={(value) => setCommFormData({ ...commFormData, outcome: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="successful">Successful</SelectItem>
                    <SelectItem value="no_answer">No Answer</SelectItem>
                    <SelectItem value="voicemail">Voicemail</SelectItem>
                    <SelectItem value="callback_requested">Callback Requested</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {commFormData.channel === 'email' && (
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={commFormData.subject}
                  onChange={(e) => setCommFormData({ ...commFormData, subject: e.target.value })}
                  placeholder="Email subject"
                />
              </div>
            )}

            <div>
              <Label htmlFor="content">Content / Notes *</Label>
              <Textarea
                id="content"
                value={commFormData.content}
                onChange={(e) => setCommFormData({ ...commFormData, content: e.target.value })}
                placeholder="What was discussed..."
                rows={4}
              />
            </div>

            <div>
              <Label htmlFor="summary">Brief Summary</Label>
              <Input
                id="summary"
                value={commFormData.summary}
                onChange={(e) => setCommFormData({ ...commFormData, summary: e.target.value })}
                placeholder="One-line summary"
              />
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={commFormData.followUpRequired}
                  onChange={(e) => setCommFormData({ ...commFormData, followUpRequired: e.target.checked })}
                  className="rounded border-gray-300"
                />
                <span className="text-sm">Follow-up required</span>
              </label>

              {commFormData.followUpRequired && (
                <div className="flex-1">
                  <Input
                    type="date"
                    value={commFormData.followUpDate}
                    onChange={(e) => setCommFormData({ ...commFormData, followUpDate: e.target.value })}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCommunicationDialog(false); resetCommForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (selectedLead) {
                  logCommunicationMutation.mutate({ leadId: selectedLead.id, data: commFormData });
                }
              }}
              disabled={!commFormData.content || logCommunicationMutation.isPending}
            >
              {logCommunicationMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Log Communication
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
