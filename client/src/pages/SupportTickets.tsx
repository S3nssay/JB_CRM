import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Ticket, MessageSquare, Phone, Mail, AlertCircle, Clock,
  CheckCircle, XCircle, User, Building, Wrench, Send,
  Search, RefreshCw, ArrowLeft,
  MessageCircle, Zap, TrendingUp,
  Users, Home, Loader2, ChevronRight, Star, CircleDot,
  ArrowRight, Hammer, Calendar, PoundSterling, ThumbsUp, ThumbsDown,
  Plus, LayoutGrid, List, History, UserCircle, Briefcase
} from 'lucide-react';

// ==================== CONFIG ====================

const PIPELINE_STAGES = [
  { key: 'open', label: 'Open', color: 'bg-blue-500', icon: AlertCircle },
  { key: 'in_progress', label: 'In Progress', color: 'bg-yellow-500', icon: Clock },
  { key: 'waiting_tenant', label: 'Waiting', color: 'bg-orange-500', icon: User },
  { key: 'resolved', label: 'Resolved', color: 'bg-green-500', icon: CheckCircle },
  { key: 'closed', label: 'Closed', color: 'bg-gray-500', icon: XCircle },
] as const;

type PipelineStatus = typeof PIPELINE_STAGES[number]['key'];

const priorityStyles: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  low: 'bg-green-100 text-green-800 border-green-300'
};

const categoryIcons: Record<string, any> = {
  plumbing: Wrench, electrical: Zap, heating: Home, appliances: Home,
  structural: Building, pest: AlertCircle, exterior: Home, billing: TrendingUp, general: MessageSquare
};

const raisedByConfig: Record<string, { label: string; icon: any; color: string }> = {
  staff: { label: 'Staff', icon: Briefcase, color: 'bg-purple-100 text-purple-800' },
  tenant: { label: 'Tenant', icon: User, color: 'bg-blue-100 text-blue-800' },
  landlord: { label: 'Landlord', icon: UserCircle, color: 'bg-amber-100 text-amber-800' },
};

// ==================== BADGE COMPONENTS ====================

const PriorityBadge = ({ priority }: { priority: string }) => (
  <Badge className={`${priorityStyles[priority] || 'bg-gray-100'} border text-xs`}>
    {priority?.toUpperCase()}
  </Badge>
);

const StatusBadge = ({ status }: { status: string }) => {
  const stage = PIPELINE_STAGES.find(s => s.key === status);
  const Icon = stage?.icon || AlertCircle;
  return (
    <Badge className={`${stage?.color || 'bg-gray-500'} text-white text-xs`}>
      <Icon className="h-3 w-3 mr-1" />
      {status?.replace(/_/g, ' ')}
    </Badge>
  );
};

const CategoryBadge = ({ category }: { category: string }) => {
  const Icon = categoryIcons[category] || MessageSquare;
  return (
    <Badge variant="outline" className="capitalize text-xs">
      <Icon className="h-3 w-3 mr-1" />
      {category}
    </Badge>
  );
};

const RaisedByBadge = ({ raisedBy }: { raisedBy: string }) => {
  const config = raisedByConfig[raisedBy] || raisedByConfig.staff;
  const Icon = config.icon;
  return (
    <Badge className={`${config.color} text-xs border-0`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
};

const ChannelIcon = ({ channel }: { channel: string }) => {
  switch (channel) {
    case 'whatsapp': return <MessageCircle className="h-4 w-4 text-green-600" />;
    case 'email': return <Mail className="h-4 w-4 text-blue-600" />;
    case 'phone': return <Phone className="h-4 w-4 text-purple-600" />;
    case 'sms': return <MessageSquare className="h-4 w-4 text-orange-600" />;
    default: return <MessageSquare className="h-4 w-4" />;
  }
};

// ==================== MAIN COMPONENT ====================

export default function SupportTickets() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // View mode
  const [viewMode, setViewMode] = useState<'pipeline' | 'list'>('pipeline');

  // State
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRaisedBy, setFilterRaisedBy] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  // Landlord charge state
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDescription, setChargeDescription] = useState('');
  const [chargeInvoiceNumber, setChargeInvoiceNumber] = useState('');

  // Create ticket state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRaisedBy, setCreateRaisedBy] = useState('staff');
  const [createSearch, setCreateSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [selectedLandlordId, setSelectedLandlordId] = useState<number | null>(null);
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedPersonName, setSelectedPersonName] = useState('');
  const [selectedPropertyAddress, setSelectedPropertyAddress] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createPriority, setCreatePriority] = useState('medium');
  const [createSubject, setCreateSubject] = useState('');
  const [createDescription, setCreateDescription] = useState('');

  // ==================== QUERIES ====================

  const { data: ticketsData, isLoading: loadingTickets, refetch: refetchTickets } = useQuery({
    queryKey: ['/api/crm/support-tickets', filterStatus, filterPriority, filterCategory],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== 'all') params.set('status', filterStatus);
      if (filterPriority !== 'all') params.set('priority', filterPriority);
      if (filterCategory !== 'all') params.set('category', filterCategory);
      const res = await fetch(`/api/crm/support-tickets?${params}`);
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json();
    }
  });

  const { data: pipeline = {} } = useQuery({
    queryKey: ['/api/crm/support-tickets/pipeline'],
    queryFn: async () => {
      const res = await fetch('/api/crm/support-tickets/pipeline');
      if (!res.ok) throw new Error('Failed to fetch pipeline');
      return res.json();
    }
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/crm/support-tickets/stats/overview'],
    queryFn: async () => {
      const res = await fetch('/api/crm/support-tickets/stats/overview');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  const { data: contractors } = useQuery({
    queryKey: ['/api/crm/contractors'],
    queryFn: async () => {
      const res = await fetch('/api/crm/contractors');
      if (!res.ok) throw new Error('Failed to fetch contractors');
      return res.json();
    }
  });

  const { data: tenantsData } = useQuery({
    queryKey: ['/api/crm/tenants'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tenants');
      if (!res.ok) throw new Error('Failed to fetch tenants');
      return res.json();
    },
    enabled: isCreateOpen && (createRaisedBy === 'tenant' || createRaisedBy === 'staff')
  });

  const { data: landlordsData } = useQuery({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const res = await fetch('/api/crm/landlords');
      if (!res.ok) throw new Error('Failed to fetch landlords');
      return res.json();
    },
    enabled: isCreateOpen && createRaisedBy === 'landlord'
  });

  const { data: propertiesData } = useQuery({
    queryKey: ['/api/crm/properties-managed'],
    queryFn: async () => {
      const res = await fetch('/api/crm/properties?isManaged=true&limit=500');
      if (!res.ok) throw new Error('Failed to fetch properties');
      return res.json();
    },
    enabled: isCreateOpen && createRaisedBy === 'staff'
  });

  // Quotes for selected ticket
  const { data: quotes, refetch: refetchQuotes } = useQuery({
    queryKey: ['/api/crm/support-tickets/quotes', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      const res = await fetch(`/api/crm/support-tickets/${selectedTicket.id}/quotes`);
      if (!res.ok) throw new Error('Failed to fetch quotes');
      return res.json();
    },
    enabled: !!selectedTicket?.id
  });

  // Workflow events for selected ticket
  const { data: workflowEvents, refetch: refetchWorkflow } = useQuery({
    queryKey: ['/api/crm/support-tickets/workflow', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      const res = await fetch(`/api/crm/support-tickets/${selectedTicket.id}/workflow`);
      if (!res.ok) throw new Error('Failed to fetch workflow');
      return res.json();
    },
    enabled: !!selectedTicket?.id
  });

  // Full history for selected ticket
  const { data: ticketHistory } = useQuery({
    queryKey: ['/api/crm/support-tickets/history', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return [];
      const res = await fetch(`/api/crm/support-tickets/${selectedTicket.id}/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      return res.json();
    },
    enabled: !!selectedTicket?.id
  });

  // Landlord charges for selected ticket
  const { data: chargesData, refetch: refetchCharges } = useQuery({
    queryKey: ['/api/crm/support-tickets/charges', selectedTicket?.id],
    queryFn: async () => {
      if (!selectedTicket?.id) return { charges: [], totalCharged: 0 };
      const res = await fetch(`/api/crm/support-tickets/${selectedTicket.id}/charges`);
      if (!res.ok) throw new Error('Failed to fetch charges');
      return res.json();
    },
    enabled: !!selectedTicket?.id
  });

  // ==================== MUTATIONS ====================

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/crm/support-tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to create ticket');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets/pipeline'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets/stats/overview'] });
      toast({ title: 'Ticket created', description: 'Support ticket has been created successfully.' });
      setIsCreateOpen(false);
      resetCreateForm();
    }
  });

  const updateTicketMutation = useMutation({
    mutationFn: async ({ ticketId, data }: { ticketId: number; data: any }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update ticket');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets/pipeline'] });
      toast({ title: 'Ticket updated' });
    }
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ ticketId, comment, isInternal }: { ticketId: number; comment: string; isInternal: boolean }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment, isInternal, notifyTenant: !isInternal })
      });
      if (!res.ok) throw new Error('Failed to add comment');
      return res.json();
    },
    onSuccess: () => {
      setNewComment('');
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets/history'] });
      toast({ title: 'Comment added' });
    }
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async ({ ticketId, message, phoneNumber }: { ticketId: number; message: string; phoneNumber: string }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/send-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, phoneNumber })
      });
      if (!res.ok) throw new Error('Failed to send WhatsApp');
      return res.json();
    },
    onSuccess: () => {
      setWhatsappMessage('');
      toast({ title: 'WhatsApp sent' });
    }
  });

  const assignContractorMutation = useMutation({
    mutationFn: async ({ ticketId, contractorId }: { ticketId: number; contractorId: number }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contractorId })
      });
      if (!res.ok) throw new Error('Failed to assign contractor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      refetchWorkflow();
      toast({ title: 'Contractor assigned' });
    }
  });

  const approveQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, approvalNotes, scheduledDate, scheduledTimeSlot }: any) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes, scheduledDate, scheduledTimeSlot })
      });
      if (!res.ok) throw new Error('Failed to approve quote');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes(); refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Quote approved' });
      setApprovalNotes(''); setScheduledDate(''); setScheduledTimeSlot('');
    }
  });

  const rejectQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, rejectionReason }: any) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason })
      });
      if (!res.ok) throw new Error('Failed to reject quote');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes(); refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Quote rejected' });
    }
  });

  const startWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/start-work`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to start work');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes(); refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Work started' });
    }
  });

  const completeWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, completionNotes, finalAmount }: any) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionNotes, finalAmount })
      });
      if (!res.ok) throw new Error('Failed to complete work');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes(); refetchWorkflow(); refetchCharges();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Work completed' });
      setCompletionNotes('');
    }
  });

  const chargeLandlordMutation = useMutation({
    mutationFn: async ({ ticketId, amount, description, invoiceNumber }: { ticketId: number; amount: number; description?: string; invoiceNumber?: string }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/charge-landlord`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, description, invoiceNumber })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to charge landlord');
      }
      return res.json();
    },
    onSuccess: () => {
      refetchCharges(); refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets/history'] });
      toast({ title: 'Landlord charged', description: 'The cost has been added to the landlord account.' });
      setChargeAmount(''); setChargeDescription(''); setChargeInvoiceNumber('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // ==================== HELPERS ====================

  const tickets = ticketsData?.tickets || [];

  const filteredTickets = tickets.filter((t: any) => {
    const matchesSearch = !searchQuery ||
      t.ticketNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.landlordName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.propertyAddress?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRaisedBy = filterRaisedBy === 'all' || t.raisedBy === filterRaisedBy;
    return matchesSearch && matchesRaisedBy;
  });

  const ticketsByStatus: Record<PipelineStatus, any[]> = {
    open: [], in_progress: [], waiting_tenant: [], resolved: [], closed: []
  };
  filteredTickets.forEach((t: any) => {
    const status = (t.status || 'open') as PipelineStatus;
    if (ticketsByStatus[status]) ticketsByStatus[status].push(t);
  });

  const tenantSearchResults = (tenantsData || []).filter((t: any) => {
    if (!createSearch || createSearch.length < 2) return false;
    const q = createSearch.toLowerCase();
    return t.fullName?.toLowerCase().includes(q) || t.email?.toLowerCase().includes(q) ||
      t.propertyAddress?.toLowerCase().includes(q) || t.propertyPostcode?.toLowerCase().includes(q);
  }).slice(0, 10);

  const landlordSearchResults = (landlordsData || []).filter((l: any) => {
    if (!createSearch || createSearch.length < 2) return false;
    const q = createSearch.toLowerCase();
    return l.name?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q);
  }).slice(0, 10);

  const propertySearchResults = ((propertiesData as any)?.properties || propertiesData || []).filter((p: any) => {
    if (!createSearch || createSearch.length < 2) return false;
    const q = createSearch.toLowerCase();
    return p.addressLine1?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q) ||
      p.postcode?.toLowerCase().includes(q);
  }).slice(0, 10);

  const resetCreateForm = () => {
    setCreateSearch(''); setSelectedTenantId(null); setSelectedLandlordId(null);
    setSelectedPropertyId(null); setSelectedPersonName(''); setSelectedPropertyAddress('');
    setCreateCategory(''); setCreatePriority('medium'); setCreateSubject(''); setCreateDescription('');
    setCreateRaisedBy('staff');
  };

  const handleCreateTicket = () => {
    if (!selectedPropertyId || !createCategory || !createSubject || !createDescription) {
      toast({ title: 'Missing fields', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }
    createTicketMutation.mutate({
      tenantId: selectedTenantId,
      landlordId: selectedLandlordId,
      propertyId: selectedPropertyId,
      category: createCategory,
      subject: createSubject,
      description: createDescription,
      priority: createPriority,
      raisedBy: createRaisedBy
    });
  };

  const openTicketDetail = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
  };

  // ==================== RENDER ====================

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center">
                <Ticket className="h-6 w-6 text-[#791E75] mr-2" />
                <h1 className="text-xl font-semibold">Support Tickets</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant={viewMode === 'pipeline' ? 'default' : 'ghost'}
                  size="sm"
                  className={`rounded-none ${viewMode === 'pipeline' ? 'bg-[#791E75] hover:bg-[#691a66]' : ''}`}
                  onClick={() => setViewMode('pipeline')}
                >
                  <LayoutGrid className="h-4 w-4 mr-1" />
                  Pipeline
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  className={`rounded-none ${viewMode === 'list' ? 'bg-[#791E75] hover:bg-[#691a66]' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <List className="h-4 w-4 mr-1" />
                  List
                </Button>
              </div>
              <Button size="sm" className="bg-[#791E75] hover:bg-[#691a66]" onClick={() => setIsCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Ticket
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetchTickets()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{stats?.open || 0}</p>
            <p className="text-sm text-gray-500">Open</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{stats?.inProgress || 0}</p>
            <p className="text-sm text-gray-500">In Progress</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{stats?.urgent || 0}</p>
            <p className="text-sm text-gray-500">Urgent</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</p>
            <p className="text-sm text-gray-500">Resolved</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-[#791E75]">{stats?.averageResolutionTime || 'N/A'}</p>
            <p className="text-sm text-gray-500">Avg Resolution</p>
          </CardContent></Card>
          <Card><CardContent className="p-4 text-center">
            <div className="flex items-center justify-center">
              <Star className="h-5 w-5 text-yellow-500 mr-1" />
              <p className="text-2xl font-bold">{stats?.satisfactionRating || 'N/A'}</p>
            </div>
            <p className="text-sm text-gray-500">Satisfaction</p>
          </CardContent></Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search tickets..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
              </div>
              {viewMode === 'list' && (
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="waiting_tenant">Waiting</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="heating">Heating</SelectItem>
                  <SelectItem value="appliances">Appliances</SelectItem>
                  <SelectItem value="structural">Structural</SelectItem>
                  <SelectItem value="pest">Pest Control</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterRaisedBy} onValueChange={setFilterRaisedBy}>
                <SelectTrigger className="w-[150px]"><SelectValue placeholder="Raised By" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sources</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {loadingTickets ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
          </div>
        ) : viewMode === 'pipeline' ? (
          /* ==================== PIPELINE VIEW ==================== */
          <TooltipProvider>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {PIPELINE_STAGES.map((stage) => {
                const StageIcon = stage.icon;
                const stageTickets = ticketsByStatus[stage.key];
                return (
                  <div key={stage.key} className="min-w-[280px] w-[280px] flex-shrink-0">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${stage.color} text-white`}>
                      <StageIcon className="h-4 w-4" />
                      <span className="font-medium text-sm">{stage.label}</span>
                      <Badge variant="secondary" className="ml-auto bg-white/20 text-white">
                        {pipeline[stage.key] || stageTickets.length}
                      </Badge>
                    </div>
                    <div className="bg-gray-50 rounded-b-lg p-2 min-h-[500px] space-y-2">
                      {stageTickets.length === 0 ? (
                        <div className="text-center text-sm text-gray-400 py-8">No tickets</div>
                      ) : (
                        stageTickets.map((ticket: any) => (
                          <Card
                            key={ticket.id}
                            className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                            style={{ borderLeftColor: ticket.priority === 'urgent' ? '#dc2626' : ticket.priority === 'high' ? '#ea580c' : ticket.priority === 'medium' ? '#ca8a04' : '#16a34a' }}
                            onClick={() => openTicketDetail(ticket)}
                          >
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-mono text-xs text-gray-400">#{ticket.ticketNumber}</span>
                                <PriorityBadge priority={ticket.priority} />
                              </div>
                              <p className="font-medium text-sm leading-tight line-clamp-2">{ticket.subject}</p>
                              <div className="flex items-center gap-1 flex-wrap">
                                <CategoryBadge category={ticket.category} />
                                <RaisedByBadge raisedBy={ticket.raisedBy} />
                              </div>
                              {ticket.tenantName && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <User className="h-3 w-3" />
                                  <span className="truncate">{ticket.tenantName}</span>
                                </div>
                              )}
                              {ticket.landlordName && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <UserCircle className="h-3 w-3" />
                                  <span className="truncate">{ticket.landlordName}</span>
                                </div>
                              )}
                              {ticket.propertyAddress && (
                                <div className="flex items-center gap-1 text-xs text-gray-500">
                                  <Building className="h-3 w-3" />
                                  <span className="truncate">{ticket.propertyAddress}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>{new Date(ticket.createdAt).toLocaleDateString('en-GB')}</span>
                                {ticket.contractorName && (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Hammer className="h-3 w-3 text-orange-500" />
                                    </TooltipTrigger>
                                    <TooltipContent>{ticket.contractorName}</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </TooltipProvider>
        ) : (
          /* ==================== LIST VIEW ==================== */
          <Card>
            <CardHeader>
              <CardTitle>Support Tickets</CardTitle>
              <CardDescription>{filteredTickets.length} tickets found</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTickets.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Ticket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No tickets found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((ticket: any) => (
                    <div
                      key={ticket.id}
                      className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => openTicketDetail(ticket)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="font-mono text-sm text-gray-500">#{ticket.ticketNumber}</span>
                            <PriorityBadge priority={ticket.priority} />
                            <StatusBadge status={ticket.status} />
                            <CategoryBadge category={ticket.category} />
                            <RaisedByBadge raisedBy={ticket.raisedBy} />
                          </div>
                          <h3 className="font-medium mb-1">{ticket.subject}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            {ticket.tenantName && (
                              <span className="flex items-center gap-1">
                                <User className="h-4 w-4" /> {ticket.tenantName}
                              </span>
                            )}
                            {ticket.landlordName && (
                              <span className="flex items-center gap-1">
                                <UserCircle className="h-4 w-4" /> {ticket.landlordName}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Building className="h-4 w-4" /> {ticket.propertyAddress}{ticket.propertyPostcode ? `, ${ticket.propertyPostcode}` : ''}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" /> {new Date(ticket.createdAt).toLocaleDateString('en-GB')}
                            </span>
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-gray-400" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ==================== TICKET DETAIL DIALOG ==================== */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono">#{selectedTicket.ticketNumber}</span>
                    <PriorityBadge priority={selectedTicket.priority} />
                    <StatusBadge status={selectedTicket.status} />
                    <RaisedByBadge raisedBy={selectedTicket.raisedBy} />
                  </DialogTitle>
                  <DialogDescription>{selectedTicket.subject}</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="details" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="history">
                      <History className="h-4 w-4 mr-1" />
                      Full History
                    </TabsTrigger>
                    <TabsTrigger value="communications">Comms</TabsTrigger>
                    <TabsTrigger value="costs">
                      <PoundSterling className="h-4 w-4 mr-1" />
                      Costs
                    </TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>

                  {/* ===== DETAILS TAB ===== */}
                  <TabsContent value="details" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          {selectedTicket.tenantName && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <h4 className="font-medium mb-2 flex items-center gap-2"><User className="h-4 w-4" /> Tenant</h4>
                              <p><strong>Name:</strong> {selectedTicket.tenantName}</p>
                              {selectedTicket.tenantPhone && <p><strong>Phone:</strong> {selectedTicket.tenantPhone}</p>}
                              {selectedTicket.tenantEmail && <p><strong>Email:</strong> {selectedTicket.tenantEmail}</p>}
                            </div>
                          )}
                          {selectedTicket.landlordName && (
                            <div className="bg-gray-50 rounded-lg p-4">
                              <h4 className="font-medium mb-2 flex items-center gap-2"><UserCircle className="h-4 w-4" /> Landlord</h4>
                              <p>{selectedTicket.landlordName}</p>
                            </div>
                          )}
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2"><Building className="h-4 w-4" /> Property</h4>
                            <p>{selectedTicket.propertyAddress}</p>
                            {selectedTicket.propertyPostcode && <p>{selectedTicket.propertyPostcode}</p>}
                          </div>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                        </div>

                        {selectedTicket.attachments?.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-2">Photos ({selectedTicket.attachments.length})</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedTicket.attachments.map((url: string, i: number) => (
                                <img key={i} src={url} alt={`Attachment ${i + 1}`} className="w-24 h-24 object-cover rounded" />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Contractor Assignment */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 flex items-center gap-2"><Wrench className="h-4 w-4" /> Contractor Assignment</h4>
                          {selectedTicket.contractorName ? (
                            <div>
                              <p className="font-medium">{selectedTicket.contractorName}</p>
                              <p className="text-xs text-gray-500 mt-1">Contractor reports to property manager only</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-gray-500 mb-2">Assign a contractor to request a quote</p>
                              <Select onValueChange={(v) => assignContractorMutation.mutate({ ticketId: selectedTicket.id, contractorId: Number(v) })}>
                                <SelectTrigger className="w-[300px]"><SelectValue placeholder="Select contractor..." /></SelectTrigger>
                                <SelectContent>
                                  {contractors?.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                      {c.companyName} - {c.specializations?.join(', ')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* ===== WORKFLOW TAB ===== */}
                  <TabsContent value="workflow" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-6">
                        {/* Current Workflow Status */}
                        <div className="bg-gradient-to-r from-[#791E75]/10 to-[#791E75]/5 rounded-lg p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <CircleDot className="h-4 w-4 text-[#791E75]" />
                            Job Status: <span className="capitalize text-[#791E75]">{selectedTicket.workflowStatus?.replace(/_/g, ' ') || 'New'}</span>
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                            {[
                              { key: 'new', label: 'New' },
                              { key: 'contractor_notified', label: 'Awaiting Quote' },
                              { key: 'quote_received', label: 'Quote Review' },
                              { key: 'scheduled', label: 'Scheduled' },
                              { key: 'in_work', label: 'In Progress' },
                              { key: 'completed', label: 'Completed' }
                            ].map((s, idx, arr) => (
                              <div key={s.key} className="flex items-center gap-1">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  selectedTicket.workflowStatus === s.key ? 'bg-[#791E75] text-white' :
                                  arr.findIndex(x => x.key === selectedTicket.workflowStatus) > idx ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-500'
                                }`}>{s.label}</span>
                                {idx < arr.length - 1 && <ArrowRight className="h-3 w-3 text-gray-400" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Quotes */}
                        {quotes && quotes.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-3 flex items-center gap-2"><PoundSterling className="h-4 w-4" /> Contractor Quotes</h4>
                            <div className="space-y-3">
                              {quotes.map((quote: any) => (
                                <div key={quote.id} className={`bg-white rounded-lg border p-4 ${quote.status === 'quoted' ? 'border-blue-300 shadow-sm' : ''}`}>
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="font-medium">{quote.contractor?.companyName}</p>
                                      <p className="text-sm text-gray-500">Quote Ref: Q{quote.id}</p>
                                    </div>
                                    <Badge className={
                                      quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      quote.status === 'quoted' ? 'bg-blue-100 text-blue-800' :
                                      quote.status === 'approved' || quote.status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                                      quote.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                      quote.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      quote.status === 'declined' || quote.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }>{quote.status}</Badge>
                                  </div>
                                  {quote.quoteAmount && <p className="text-2xl font-bold text-[#791E75] mb-2">£{(quote.quoteAmount / 100).toFixed(2)}</p>}
                                  {quote.availableDate && <p className="text-sm text-gray-600 flex items-center gap-1 mb-2"><Calendar className="h-4 w-4" />Available: {new Date(quote.availableDate).toLocaleDateString('en-GB')}</p>}
                                  {quote.scheduledDate && <p className="text-sm text-purple-600 flex items-center gap-1 mb-2"><Calendar className="h-4 w-4" />Scheduled: {new Date(quote.scheduledDate).toLocaleDateString('en-GB')} {quote.scheduledTimeSlot && `(${quote.scheduledTimeSlot})`}</p>}
                                  {quote.contractorResponse && <p className="text-sm bg-gray-50 p-2 rounded mb-3">{quote.contractorResponse}</p>}

                                  {/* Quote Actions */}
                                  {(quote.status === 'quoted' || quote.status === 'accepted') ? (
                                    <div className="space-y-3 border-t pt-3 mt-3">
                                      <div className="flex gap-2">
                                        <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="flex-1" />
                                        <Select value={scheduledTimeSlot} onValueChange={setScheduledTimeSlot}>
                                          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Time slot" /></SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="morning">Morning (9-12)</SelectItem>
                                            <SelectItem value="afternoon">Afternoon (12-5)</SelectItem>
                                            <SelectItem value="all_day">All Day</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Textarea placeholder="Internal notes..." value={approvalNotes} onChange={(e) => setApprovalNotes(e.target.value)} rows={2} />
                                      <div className="flex gap-2">
                                        <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={() => approveQuoteMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id, approvalNotes, scheduledDate, scheduledTimeSlot })} disabled={approveQuoteMutation.isPending}>
                                          <ThumbsUp className="h-4 w-4 mr-2" />Approve & Schedule
                                        </Button>
                                        <Button variant="destructive" onClick={() => rejectQuoteMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id })} disabled={rejectQuoteMutation.isPending}>
                                          <ThumbsDown className="h-4 w-4 mr-2" />Reject
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (quote.status === 'scheduled' || quote.status === 'approved') ? (
                                    <div className="border-t pt-3 mt-3">
                                      <Button className="w-full bg-orange-600 hover:bg-orange-700" onClick={() => startWorkMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id })} disabled={startWorkMutation.isPending}>
                                        <Hammer className="h-4 w-4 mr-2" />Mark Work Started
                                      </Button>
                                    </div>
                                  ) : quote.status === 'in_progress' ? (
                                    <div className="space-y-3 border-t pt-3 mt-3">
                                      <Textarea placeholder="Completion notes..." value={completionNotes} onChange={(e) => setCompletionNotes(e.target.value)} rows={2} />
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <Label className="text-xs text-gray-500">Final Amount (£) - charged to landlord</Label>
                                          <Input type="number" step="0.01" min="0" placeholder={quote.quoteAmount ? (quote.quoteAmount / 100).toFixed(2) : '0.00'} value={chargeAmount} onChange={(e) => setChargeAmount(e.target.value)} />
                                        </div>
                                        <div>
                                          <Label className="text-xs text-gray-500">Invoice Number</Label>
                                          <Input placeholder="Optional" value={chargeInvoiceNumber} onChange={(e) => setChargeInvoiceNumber(e.target.value)} />
                                        </div>
                                      </div>
                                      <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => {
                                        const finalAmt = chargeAmount ? Math.round(parseFloat(chargeAmount) * 100) : (quote.quoteAmount || null);
                                        completeWorkMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id, completionNotes, finalAmount: finalAmt });
                                      }} disabled={completeWorkMutation.isPending}>
                                        <CheckCircle className="h-4 w-4 mr-2" />Mark Complete & Charge Landlord
                                      </Button>
                                      <p className="text-xs text-gray-500">Final amount will be automatically charged to the landlord's property account.</p>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* ===== FULL HISTORY TAB ===== */}
                  <TabsContent value="history" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="relative">
                        <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                        <div className="space-y-4">
                          {ticketHistory && ticketHistory.length > 0 ? (
                            ticketHistory.map((item: any) => (
                              <div key={item.id} className="relative pl-10">
                                <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                                  item.type === 'comment' ? (item.isInternal ? 'bg-gray-400' : 'bg-blue-500') :
                                  item.eventType?.includes('completed') ? 'bg-green-500' :
                                  item.eventType?.includes('rejected') || item.eventType?.includes('declined') ? 'bg-red-500' :
                                  item.eventType?.includes('approved') || item.eventType?.includes('scheduled') ? 'bg-purple-500' :
                                  item.eventType?.includes('quote') || item.eventType?.includes('accepted') ? 'bg-blue-500' :
                                  item.eventType?.includes('created') ? 'bg-[#791E75]' :
                                  'bg-gray-400'
                                }`}>
                                  {item.type === 'comment' ? <MessageSquare className="h-3 w-3 text-white" /> :
                                   item.eventType?.includes('completed') ? <CheckCircle className="h-3 w-3 text-white" /> :
                                   item.eventType?.includes('rejected') ? <XCircle className="h-3 w-3 text-white" /> :
                                   item.eventType?.includes('scheduled') ? <Calendar className="h-3 w-3 text-white" /> :
                                   item.eventType?.includes('started') ? <Hammer className="h-3 w-3 text-white" /> :
                                   <CircleDot className="h-3 w-3 text-white" />}
                                </div>
                                <div className={`rounded-lg p-3 shadow-sm ${item.type === 'comment' && item.isInternal ? 'bg-yellow-50 border border-yellow-200' : 'bg-white'}`}>
                                  <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-sm">
                                        {item.type === 'comment' ? (
                                          <>
                                            {item.userName || 'Unknown'} {item.isInternal && <Badge variant="outline" className="text-xs ml-1">Internal</Badge>}
                                          </>
                                        ) : item.title}
                                      </p>
                                    </div>
                                    <span className="text-xs text-gray-400">
                                      {new Date(item.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  {item.type === 'comment' ? (
                                    <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{item.comment}</p>
                                  ) : (
                                    <>
                                      {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
                                      {item.previousStatus && item.newStatus && (
                                        <div className="flex items-center gap-2 mt-2 text-xs">
                                          <Badge variant="outline">{item.previousStatus.replace(/_/g, ' ')}</Badge>
                                          <ArrowRight className="h-3 w-3" />
                                          <Badge variant="outline">{item.newStatus.replace(/_/g, ' ')}</Badge>
                                        </div>
                                      )}
                                      {item.notificationChannels?.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                          {item.notificationChannels.map((ch: string) => (
                                            <Badge key={ch} variant="outline" className="text-xs capitalize">{ch}</Badge>
                                          ))}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="pl-10">
                              <div className="relative">
                                <div className="absolute left-[-22px] w-5 h-5 rounded-full bg-[#791E75] flex items-center justify-center">
                                  <CircleDot className="h-3 w-3 text-white" />
                                </div>
                              </div>
                              <div className="bg-white rounded-lg p-3 shadow-sm">
                                <p className="font-medium text-sm">Ticket Created</p>
                                <p className="text-xs text-gray-400">{new Date(selectedTicket.createdAt).toLocaleString('en-GB')}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* ===== COMMUNICATIONS TAB ===== */}
                  <TabsContent value="communications" className="mt-4">
                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {selectedTicket.communications?.map((comm: any) => (
                          <div key={comm.id} className={`p-3 rounded-lg ${comm.direction === 'inbound' ? 'bg-gray-100 ml-0 mr-12' : 'bg-[#791E75]/10 ml-12 mr-0'}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <ChannelIcon channel={comm.channel} />
                              <span className="text-xs text-gray-500 capitalize">{comm.channel}</span>
                              <span className="text-xs text-gray-400">{new Date(comm.timestamp).toLocaleString()}</span>
                            </div>
                            <p className="text-sm">{comm.content}</p>
                          </div>
                        )) || <p className="text-center text-gray-500 py-8">No communications yet</p>}
                      </div>
                    </ScrollArea>

                    {selectedTicket.tenantPhone && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-xs text-gray-500 mb-2">Message tenant as John Barclay Property Management</p>
                        <div className="flex gap-2">
                          <Textarea placeholder="Type a message..." value={whatsappMessage} onChange={(e) => setWhatsappMessage(e.target.value)} className="flex-1" rows={2} />
                          <Button onClick={() => sendWhatsAppMutation.mutate({ ticketId: selectedTicket.id, message: whatsappMessage, phoneNumber: selectedTicket.tenantPhone })} disabled={!whatsappMessage || sendWhatsAppMutation.isPending} className="bg-green-600 hover:bg-green-700">
                            <MessageCircle className="h-4 w-4 mr-2" />Send
                          </Button>
                        </div>
                      </div>
                    )}
                  </TabsContent>

                  {/* ===== COSTS TAB ===== */}
                  <TabsContent value="costs" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {/* Total charged summary */}
                        <div className="bg-gradient-to-r from-[#791E75]/10 to-[#791E75]/5 rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium flex items-center gap-2">
                              <PoundSterling className="h-4 w-4 text-[#791E75]" />
                              Total Charged to Landlord
                            </h4>
                            <span className="text-2xl font-bold text-[#791E75]">
                              £{((chargesData?.totalCharged || 0) / 100).toFixed(2)}
                            </span>
                          </div>
                        </div>

                        {/* Existing charges */}
                        {chargesData?.charges?.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-3">Charge History</h4>
                            <div className="space-y-2">
                              {chargesData.charges.map((charge: any) => (
                                <div key={charge.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
                                  <div>
                                    <p className="font-medium text-sm">{charge.description}</p>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                      {charge.landlordName && <span>Landlord: {charge.landlordName}</span>}
                                      {charge.notes && <span>{charge.notes}</span>}
                                      <span>{new Date(charge.createdAt).toLocaleDateString('en-GB')}</span>
                                    </div>
                                  </div>
                                  <span className="text-lg font-bold text-red-600">
                                    £{(charge.amount / 100).toFixed(2)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Quote costs summary */}
                        {quotes && quotes.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-3">Contractor Quotes</h4>
                            <div className="space-y-2">
                              {quotes.map((quote: any) => (
                                <div key={quote.id} className="bg-white rounded-lg border p-3 flex items-center justify-between">
                                  <div>
                                    <p className="text-sm font-medium">{quote.contractor?.companyName}</p>
                                    <Badge className={
                                      quote.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      quote.status === 'approved' ? 'bg-purple-100 text-purple-800' :
                                      'bg-gray-100 text-gray-800'
                                    }>{quote.status}</Badge>
                                  </div>
                                  <div className="text-right">
                                    {quote.finalAmount ? (
                                      <p className="text-lg font-bold">£{(quote.finalAmount / 100).toFixed(2)}</p>
                                    ) : quote.quoteAmount ? (
                                      <p className="text-lg font-bold text-gray-500">£{(quote.quoteAmount / 100).toFixed(2)}</p>
                                    ) : (
                                      <p className="text-sm text-gray-400">No quote yet</p>
                                    )}
                                    {quote.invoiceNumber && <p className="text-xs text-gray-500">Inv: {quote.invoiceNumber}</p>}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Manual charge form */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-3">Add Manual Charge to Landlord</h4>
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <Label className="text-sm">Amount (£)</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={chargeAmount}
                                  onChange={(e) => setChargeAmount(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label className="text-sm">Invoice Number</Label>
                                <Input
                                  placeholder="Optional"
                                  value={chargeInvoiceNumber}
                                  onChange={(e) => setChargeInvoiceNumber(e.target.value)}
                                />
                              </div>
                            </div>
                            <div>
                              <Label className="text-sm">Description</Label>
                              <Input
                                placeholder="e.g. Emergency plumber callout"
                                value={chargeDescription}
                                onChange={(e) => setChargeDescription(e.target.value)}
                              />
                            </div>
                            <Button
                              className="w-full bg-[#791E75] hover:bg-[#691a66]"
                              onClick={() => {
                                const amountPence = Math.round(parseFloat(chargeAmount) * 100);
                                if (!amountPence || amountPence <= 0) {
                                  toast({ title: 'Invalid amount', variant: 'destructive' });
                                  return;
                                }
                                chargeLandlordMutation.mutate({
                                  ticketId: selectedTicket.id,
                                  amount: amountPence,
                                  description: chargeDescription || undefined,
                                  invoiceNumber: chargeInvoiceNumber || undefined
                                });
                              }}
                              disabled={!chargeAmount || chargeLandlordMutation.isPending}
                            >
                              {chargeLandlordMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <PoundSterling className="h-4 w-4 mr-2" />
                              )}
                              Charge to Landlord Account
                            </Button>
                            <p className="text-xs text-gray-500">
                              This will create a deduction on the landlord's property account that appears on their next statement.
                            </p>
                          </div>
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* ===== ACTIONS TAB ===== */}
                  <TabsContent value="actions" className="mt-4">
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium mb-3">Update Status</h4>
                        <div className="flex gap-2 flex-wrap">
                          {PIPELINE_STAGES.map(({ key, label }) => (
                            <Button
                              key={key}
                              variant={selectedTicket.status === key ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, data: { status: key } })}
                              className={selectedTicket.status === key ? 'bg-[#791E75] hover:bg-[#691a66]' : ''}
                            >{label}</Button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium mb-3">Update Priority</h4>
                        <div className="flex gap-2">
                          {['low', 'medium', 'high', 'urgent'].map((p) => (
                            <Button
                              key={p}
                              variant={selectedTicket.priority === p ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, data: { priority: p } })}
                              className="capitalize"
                            >{p}</Button>
                          ))}
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium mb-3">Add Comment</h4>
                        <Textarea placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} className="mb-2" rows={3} />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={isInternalComment} onChange={(e) => setIsInternalComment(e.target.checked)} />
                            Internal note (not visible to tenant)
                          </label>
                          <Button
                            onClick={() => addCommentMutation.mutate({ ticketId: selectedTicket.id, comment: newComment, isInternal: isInternalComment })}
                            disabled={!newComment || addCommentMutation.isPending}
                            size="sm"
                          >
                            <Send className="h-4 w-4 mr-2" />Add Comment
                          </Button>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* ==================== CREATE TICKET DIALOG ==================== */}
        <Dialog open={isCreateOpen} onOpenChange={(open) => { setIsCreateOpen(open); if (!open) resetCreateForm(); }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create Support Ticket</DialogTitle>
              <DialogDescription>Raise a ticket from staff, tenant, or landlord</DialogDescription>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              {/* Raised By Selection */}
              <div>
                <Label className="mb-1.5 block font-medium">Raised By</Label>
                <div className="flex gap-2">
                  {(['staff', 'tenant', 'landlord'] as const).map((role) => {
                    const config = raisedByConfig[role];
                    const Icon = config.icon;
                    return (
                      <Button
                        key={role}
                        variant={createRaisedBy === role ? 'default' : 'outline'}
                        size="sm"
                        className={createRaisedBy === role ? 'bg-[#791E75] hover:bg-[#691a66]' : ''}
                        onClick={() => {
                          setCreateRaisedBy(role);
                          setSelectedTenantId(null); setSelectedLandlordId(null);
                          setSelectedPropertyId(null); setSelectedPersonName('');
                          setSelectedPropertyAddress(''); setCreateSearch('');
                        }}
                      >
                        <Icon className="h-4 w-4 mr-1" />{config.label}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Person / Property Search */}
              <div>
                <Label className="mb-1.5 block font-medium">
                  {createRaisedBy === 'tenant' ? 'Tenant / Property' :
                   createRaisedBy === 'landlord' ? 'Landlord' : 'Property'}
                </Label>
                {(selectedTenantId || selectedLandlordId || selectedPropertyId) ? (
                  <div className="border rounded-lg p-3 bg-gray-50 flex items-center justify-between">
                    <div>
                      {selectedPersonName && <p className="font-medium flex items-center gap-2"><User className="h-4 w-4" />{selectedPersonName}</p>}
                      {selectedPropertyAddress && <p className="text-sm text-gray-500 flex items-center gap-2 mt-1"><Building className="h-4 w-4" />{selectedPropertyAddress}</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => {
                      setSelectedTenantId(null); setSelectedLandlordId(null); setSelectedPropertyId(null);
                      setSelectedPersonName(''); setSelectedPropertyAddress(''); setCreateSearch('');
                    }}>Change</Button>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder={createRaisedBy === 'tenant' ? 'Search tenant name or property...' :
                                   createRaisedBy === 'landlord' ? 'Search landlord name or email...' :
                                   'Search property address...'}
                      value={createSearch}
                      onChange={(e) => setCreateSearch(e.target.value)}
                      className="pl-10"
                    />
                    {/* Tenant search results */}
                    {createRaisedBy === 'tenant' && tenantSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {tenantSearchResults.map((t: any) => (
                          <div key={t.id} className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0" onClick={() => {
                            setSelectedTenantId(t.id); setSelectedPropertyId(t.propertyId);
                            setSelectedPersonName(t.fullName);
                            setSelectedPropertyAddress(t.propertyAddress ? `${t.propertyAddress}${t.propertyPostcode ? ', ' + t.propertyPostcode : ''}` : '');
                            setCreateSearch('');
                          }}>
                            <p className="font-medium text-sm">{t.fullName}</p>
                            {t.propertyAddress && <p className="text-xs text-gray-500">{t.propertyAddress}{t.propertyPostcode ? `, ${t.propertyPostcode}` : ''}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Landlord search results */}
                    {createRaisedBy === 'landlord' && landlordSearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {landlordSearchResults.map((l: any) => (
                          <div key={l.id} className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0" onClick={() => {
                            setSelectedLandlordId(l.id);
                            setSelectedPersonName(l.name);
                            setCreateSearch('');
                          }}>
                            <p className="font-medium text-sm">{l.name}</p>
                            {l.email && <p className="text-xs text-gray-500">{l.email}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Property search for staff */}
                    {createRaisedBy === 'staff' && propertySearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {propertySearchResults.map((p: any) => (
                          <div key={p.id} className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0" onClick={() => {
                            setSelectedPropertyId(p.id);
                            setSelectedPropertyAddress(`${p.addressLine1 || p.address}${p.postcode ? ', ' + p.postcode : ''}`);
                            setCreateSearch('');
                          }}>
                            <p className="font-medium text-sm">{p.addressLine1 || p.address}</p>
                            {p.postcode && <p className="text-xs text-gray-500">{p.postcode}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                    {createSearch.length >= 2 &&
                     ((createRaisedBy === 'tenant' && tenantSearchResults.length === 0) ||
                      (createRaisedBy === 'landlord' && landlordSearchResults.length === 0) ||
                      (createRaisedBy === 'staff' && propertySearchResults.length === 0)) && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg p-3 text-sm text-gray-500">
                        No results found for "{createSearch}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Property for landlord raised tickets */}
              {createRaisedBy === 'landlord' && selectedLandlordId && !selectedPropertyId && (
                <div>
                  <Label className="mb-1.5 block font-medium">Property</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search property address..."
                      value={createSearch}
                      onChange={(e) => setCreateSearch(e.target.value)}
                      className="pl-10"
                    />
                    {propertySearchResults.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {propertySearchResults.map((p: any) => (
                          <div key={p.id} className="p-3 hover:bg-gray-50 cursor-pointer border-b last:border-b-0" onClick={() => {
                            setSelectedPropertyId(p.id);
                            setSelectedPropertyAddress(`${p.addressLine1 || p.address}${p.postcode ? ', ' + p.postcode : ''}`);
                            setCreateSearch('');
                          }}>
                            <p className="font-medium text-sm">{p.addressLine1 || p.address}</p>
                            {p.postcode && <p className="text-xs text-gray-500">{p.postcode}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Category & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-1.5 block font-medium">Category</Label>
                  <Select value={createCategory} onValueChange={setCreateCategory}>
                    <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="plumbing">Plumbing</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="heating">Heating</SelectItem>
                      <SelectItem value="appliances">Appliances</SelectItem>
                      <SelectItem value="structural">Structural</SelectItem>
                      <SelectItem value="pest">Pest Control</SelectItem>
                      <SelectItem value="exterior">Exterior</SelectItem>
                      <SelectItem value="billing">Billing</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="mb-1.5 block font-medium">Priority</Label>
                  <Select value={createPriority} onValueChange={setCreatePriority}>
                    <SelectTrigger><SelectValue placeholder="Select priority" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block font-medium">Subject</Label>
                <Input placeholder="Brief description of the issue" value={createSubject} onChange={(e) => setCreateSubject(e.target.value)} />
              </div>

              <div>
                <Label className="mb-1.5 block font-medium">Description</Label>
                <Textarea placeholder="Full details of the issue..." value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={4} />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetCreateForm(); }}>Cancel</Button>
              <Button
                className="bg-[#791E75] hover:bg-[#691a66]"
                onClick={handleCreateTicket}
                disabled={createTicketMutation.isPending || !selectedPropertyId || !createCategory || !createSubject || !createDescription}
              >
                {createTicketMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Ticket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
