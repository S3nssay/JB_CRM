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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Ticket, MessageSquare, Phone, Mail, AlertCircle, Clock,
  CheckCircle, XCircle, User, Building, Wrench, Send,
  Filter, Search, MoreVertical, RefreshCw, ArrowLeft,
  MessageCircle, Image, Paperclip, Zap, TrendingUp,
  Users, Home, Loader2, ChevronRight, Star, CircleDot,
  ArrowRight, Hammer, Calendar, DollarSign, FileCheck, ThumbsUp, ThumbsDown
} from 'lucide-react';

// Channel icons
const ChannelIcon = ({ channel }: { channel: string }) => {
  switch (channel) {
    case 'whatsapp':
      return <MessageCircle className="h-4 w-4 text-green-600" />;
    case 'email':
      return <Mail className="h-4 w-4 text-blue-600" />;
    case 'phone':
      return <Phone className="h-4 w-4 text-purple-600" />;
    case 'sms':
      return <MessageSquare className="h-4 w-4 text-orange-600" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
};

// Priority badge
const PriorityBadge = ({ priority }: { priority: string }) => {
  const styles: Record<string, string> = {
    urgent: 'bg-red-100 text-red-800 border-red-300',
    high: 'bg-orange-100 text-orange-800 border-orange-300',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    low: 'bg-green-100 text-green-800 border-green-300'
  };
  return (
    <Badge className={`${styles[priority] || 'bg-gray-100'} border`}>
      {priority.toUpperCase()}
    </Badge>
  );
};

// Status badge
const StatusBadge = ({ status }: { status: string }) => {
  const config: Record<string, { color: string; icon: any }> = {
    open: { color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
    in_progress: { color: 'bg-yellow-100 text-yellow-800', icon: Clock },
    waiting_tenant: { color: 'bg-orange-100 text-orange-800', icon: User },
    resolved: { color: 'bg-green-100 text-green-800', icon: CheckCircle },
    closed: { color: 'bg-gray-100 text-gray-800', icon: XCircle }
  };
  const { color, icon: Icon } = config[status] || { color: 'bg-gray-100', icon: AlertCircle };
  return (
    <Badge className={color}>
      <Icon className="h-3 w-3 mr-1" />
      {status.replace('_', ' ')}
    </Badge>
  );
};

// Category badge
const CategoryBadge = ({ category }: { category: string }) => {
  const icons: Record<string, any> = {
    plumbing: Wrench,
    electrical: Zap,
    heating: Home,
    appliances: Home,
    structural: Building,
    pest: AlertCircle,
    exterior: Home,
    billing: TrendingUp,
    general: MessageSquare
  };
  const Icon = icons[category] || MessageSquare;
  return (
    <Badge variant="outline" className="capitalize">
      <Icon className="h-3 w-3 mr-1" />
      {category}
    </Badge>
  );
};

export default function SupportTickets() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // State
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  // Fetch tickets
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

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/crm/support-tickets/stats/overview'],
    queryFn: async () => {
      const res = await fetch('/api/crm/support-tickets/stats/overview');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  // Fetch contractors
  const { data: contractors } = useQuery({
    queryKey: ['/api/crm/contractors'],
    queryFn: async () => {
      const res = await fetch('/api/crm/contractors');
      if (!res.ok) throw new Error('Failed to fetch contractors');
      return res.json();
    }
  });

  // Fetch quotes for selected ticket
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

  // Fetch workflow events for selected ticket
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

  // Update ticket mutation
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
      toast({ title: 'Ticket updated', description: 'The ticket has been updated successfully.' });
    }
  });

  // Add comment mutation
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
      toast({ title: 'Comment added', description: 'Your comment has been added to the ticket.' });
    }
  });

  // Send WhatsApp mutation
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
      toast({ title: 'WhatsApp sent', description: 'Message sent to tenant successfully.' });
    }
  });

  // Assign contractor mutation
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
      toast({ title: 'Contractor assigned', description: 'The contractor has been notified.' });
    }
  });

  // Approve quote mutation
  const approveQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, approvalNotes, scheduledDate, scheduledTimeSlot }: {
      ticketId: number; quoteId: number; approvalNotes?: string; scheduledDate?: string; scheduledTimeSlot?: string
    }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvalNotes, scheduledDate, scheduledTimeSlot })
      });
      if (!res.ok) throw new Error('Failed to approve quote');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes();
      refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Quote approved', description: 'The contractor has been notified.' });
      setApprovalNotes('');
      setScheduledDate('');
      setScheduledTimeSlot('');
    }
  });

  // Reject quote mutation
  const rejectQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, rejectionReason }: { ticketId: number; quoteId: number; rejectionReason?: string }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rejectionReason })
      });
      if (!res.ok) throw new Error('Failed to reject quote');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes();
      refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Quote rejected', description: 'The ticket can be reassigned to another contractor.' });
    }
  });

  // Start work mutation
  const startWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/start-work`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to start work');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes();
      refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Work started', description: 'Contractor has started work on this job.' });
    }
  });

  // Complete work mutation
  const completeWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, completionNotes, finalAmount }: {
      ticketId: number; quoteId: number; completionNotes?: string; finalAmount?: number
    }) => {
      const res = await fetch(`/api/crm/support-tickets/${ticketId}/quotes/${quoteId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completionNotes, finalAmount })
      });
      if (!res.ok) throw new Error('Failed to complete work');
      return res.json();
    },
    onSuccess: () => {
      refetchQuotes();
      refetchWorkflow();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/support-tickets'] });
      toast({ title: 'Work completed', description: 'The job has been marked as complete.' });
      setCompletionNotes('');
    }
  });

  const tickets = ticketsData?.tickets || [];

  // Filter tickets by search
  const filteredTickets = tickets.filter((t: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.ticketNumber?.toLowerCase().includes(query) ||
      t.subject?.toLowerCase().includes(query) ||
      t.tenantName?.toLowerCase().includes(query) ||
      t.propertyAddress?.toLowerCase().includes(query)
    );
  });

  const openTicketDetail = (ticket: any) => {
    setSelectedTicket(ticket);
    setIsDetailOpen(true);
  };

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
                <h1 className="text-xl font-semibold">Tenant Support Tickets</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => refetchTickets()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{stats?.open || 0}</p>
              <p className="text-sm text-gray-500">Open</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-600">{stats?.inProgress || 0}</p>
              <p className="text-sm text-gray-500">In Progress</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-600">{stats?.urgent || 0}</p>
              <p className="text-sm text-gray-500">Urgent</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</p>
              <p className="text-sm text-gray-500">Resolved</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-[#791E75]">{stats?.averageResolutionTime || 'N/A'}</p>
              <p className="text-sm text-gray-500">Avg Resolution</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-500 mr-1" />
                <p className="text-2xl font-bold">{stats?.satisfactionRating || 'N/A'}</p>
              </div>
              <p className="text-sm text-gray-500">Satisfaction</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search tickets..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="waiting_tenant">Waiting Tenant</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
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
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <Card>
          <CardHeader>
            <CardTitle>Support Tickets</CardTitle>
            <CardDescription>
              {filteredTickets.length} tickets found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTickets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
              </div>
            ) : filteredTickets.length === 0 ? (
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
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-mono text-sm text-gray-500">#{ticket.ticketNumber}</span>
                          <PriorityBadge priority={ticket.priority} />
                          <StatusBadge status={ticket.status} />
                          <CategoryBadge category={ticket.category} />
                        </div>
                        <h3 className="font-medium mb-1">{ticket.subject}</h3>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {ticket.tenantName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Building className="h-4 w-4" />
                            {ticket.propertyAddress}, {ticket.propertyPostcode}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {new Date(ticket.createdAt).toLocaleDateString()}
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

        {/* Ticket Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
            {selectedTicket && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <span className="font-mono">#{selectedTicket.ticketNumber}</span>
                    <PriorityBadge priority={selectedTicket.priority} />
                    <StatusBadge status={selectedTicket.status} />
                  </DialogTitle>
                  <DialogDescription className="flex items-center gap-2">
                    <span>{selectedTicket.subject}</span>
                    <Badge variant="outline" className="text-xs bg-[#791E75]/10 text-[#791E75] border-[#791E75]/30">
                      Property Manager Controlled
                    </Badge>
                  </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="details" className="mt-4">
                  <TabsList>
                    <TabsTrigger value="details">Details</TabsTrigger>
                    <TabsTrigger value="workflow">Workflow</TabsTrigger>
                    <TabsTrigger value="communications">Communications</TabsTrigger>
                    <TabsTrigger value="actions">Actions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="details" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-4">
                        {/* Ticket Info */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <User className="h-4 w-4" /> Tenant Details
                            </h4>
                            <p><strong>Name:</strong> {selectedTicket.tenantName}</p>
                            <p><strong>Phone:</strong> {selectedTicket.tenantPhone}</p>
                            <p><strong>Email:</strong> {selectedTicket.tenantEmail}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Building className="h-4 w-4" /> Property
                            </h4>
                            <p>{selectedTicket.propertyAddress}</p>
                            <p>{selectedTicket.propertyPostcode}</p>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="whitespace-pre-wrap">{selectedTicket.description}</p>
                        </div>

                        {/* Attachments */}
                        {selectedTicket.attachments?.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-2 flex items-center gap-2">
                              <Image className="h-4 w-4" /> Photos ({selectedTicket.attachments.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedTicket.attachments.map((url: string, i: number) => (
                                <img key={i} src={url} alt={`Attachment ${i + 1}`} className="w-24 h-24 object-cover rounded" />
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Contractor Assignment - PM Controlled */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <Wrench className="h-4 w-4" /> Contractor Assignment
                          </h4>
                          {selectedTicket.contractorName ? (
                            <div>
                              <p className="font-medium">{selectedTicket.contractorName}</p>
                              <p className="text-xs text-gray-500 mt-1">Contractor reports to you only - no direct tenant contact</p>
                            </div>
                          ) : (
                            <div>
                              <p className="text-gray-500 mb-2">Select a contractor to request a quote</p>
                              <Select onValueChange={(v) => assignContractorMutation.mutate({ ticketId: selectedTicket.id, contractorId: Number(v) })}>
                                <SelectTrigger className="w-[300px]">
                                  <SelectValue placeholder="Request quote from contractor..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {contractors?.map((c: any) => (
                                    <SelectItem key={c.id} value={c.id.toString()}>
                                      {c.companyName} - {c.specializations?.join(', ')}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <p className="text-xs text-gray-500 mt-2">Contractor will send quote to you. Tenant will not be contacted.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  {/* Workflow Tab - Shows job lifecycle from quote to completion */}
                  <TabsContent value="workflow" className="mt-4">
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-6">
                        {/* Property Manager Workflow Notice */}
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                          <strong>Property Manager Workflow:</strong> You control all communications. Tenant and contractor do not communicate directly.
                          Tenant is notified only at: Ticket Received, Work Scheduled, Work Completed.
                        </div>

                        {/* Current Workflow Status */}
                        <div className="bg-gradient-to-r from-[#791E75]/10 to-[#791E75]/5 rounded-lg p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <CircleDot className="h-4 w-4 text-[#791E75]" />
                            Job Status: <span className="capitalize text-[#791E75]">{selectedTicket.workflowStatus?.replace(/_/g, ' ') || 'New'}</span>
                          </h4>
                          <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                            {[
                              { key: 'new', label: 'New Request' },
                              { key: 'contractor_notified', label: 'Awaiting Quote' },
                              { key: 'quote_received', label: 'Quote Review' },
                              { key: 'scheduled', label: 'Work Scheduled' },
                              { key: 'in_work', label: 'Work In Progress' },
                              { key: 'completed', label: 'Completed' }
                            ].map((status, idx, arr) => (
                              <div key={status.key} className="flex items-center gap-1">
                                <span className={`px-2 py-1 rounded text-xs ${
                                  selectedTicket.workflowStatus === status.key ? 'bg-[#791E75] text-white' :
                                  arr.findIndex(s => s.key === selectedTicket.workflowStatus) > idx ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-500'
                                }`}>
                                  {status.label}
                                </span>
                                {idx < arr.length - 1 && <ArrowRight className="h-3 w-3 text-gray-400" />}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Active Quote Card */}
                        {quotes && quotes.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4">
                            <h4 className="font-medium mb-3 flex items-center gap-2">
                              <DollarSign className="h-4 w-4" />
                              Contractor Quotes
                            </h4>
                            <div className="space-y-3">
                              {quotes.map((quote: any) => (
                                <div key={quote.id} className={`bg-white rounded-lg border p-4 ${
                                  quote.status === 'quoted' ? 'border-blue-300 shadow-sm' : ''
                                }`}>
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <p className="font-medium">{quote.contractor?.companyName}</p>
                                      <p className="text-sm text-gray-500">Quote Ref: Q{quote.id}</p>
                                    </div>
                                    <Badge className={
                                      quote.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                      quote.status === 'quoted' ? 'bg-blue-100 text-blue-800' :
                                      quote.status === 'accepted' ? 'bg-green-100 text-green-800' :
                                      quote.status === 'approved' || quote.status === 'scheduled' ? 'bg-purple-100 text-purple-800' :
                                      quote.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
                                      quote.status === 'completed' ? 'bg-green-100 text-green-800' :
                                      quote.status === 'declined' || quote.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }>
                                      {quote.status}
                                    </Badge>
                                  </div>

                                  {quote.quoteAmount && (
                                    <p className="text-2xl font-bold text-[#791E75] mb-2">
                                      £{(quote.quoteAmount / 100).toFixed(2)}
                                    </p>
                                  )}

                                  {quote.availableDate && (
                                    <p className="text-sm text-gray-600 flex items-center gap-1 mb-2">
                                      <Calendar className="h-4 w-4" />
                                      Available: {new Date(quote.availableDate).toLocaleDateString('en-GB')}
                                    </p>
                                  )}

                                  {quote.scheduledDate && (
                                    <p className="text-sm text-purple-600 flex items-center gap-1 mb-2">
                                      <Calendar className="h-4 w-4" />
                                      Scheduled: {new Date(quote.scheduledDate).toLocaleDateString('en-GB')} {quote.scheduledTimeSlot && `(${quote.scheduledTimeSlot})`}
                                    </p>
                                  )}

                                  {quote.contractorResponse && (
                                    <p className="text-sm bg-gray-50 p-2 rounded mb-3">{quote.contractorResponse}</p>
                                  )}

                                  {/* Quote Actions - PM Controlled */}
                                  {quote.status === 'quoted' || quote.status === 'accepted' ? (
                                    <div className="space-y-3 border-t pt-3 mt-3">
                                      <p className="text-xs text-blue-600 font-medium">Schedule work - tenant will be notified of date only</p>
                                      <div className="flex gap-2">
                                        <Input
                                          type="date"
                                          placeholder="Schedule date"
                                          value={scheduledDate}
                                          onChange={(e) => setScheduledDate(e.target.value)}
                                          className="flex-1"
                                        />
                                        <Select value={scheduledTimeSlot} onValueChange={setScheduledTimeSlot}>
                                          <SelectTrigger className="w-[150px]">
                                            <SelectValue placeholder="Time slot" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="morning">Morning (9-12)</SelectItem>
                                            <SelectItem value="afternoon">Afternoon (12-5)</SelectItem>
                                            <SelectItem value="all_day">All Day</SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <Textarea
                                        placeholder="Internal notes (not sent to tenant)"
                                        value={approvalNotes}
                                        onChange={(e) => setApprovalNotes(e.target.value)}
                                        rows={2}
                                      />
                                      <div className="flex gap-2">
                                        <Button
                                          className="flex-1 bg-green-600 hover:bg-green-700"
                                          onClick={() => approveQuoteMutation.mutate({
                                            ticketId: selectedTicket.id,
                                            quoteId: quote.id,
                                            approvalNotes,
                                            scheduledDate,
                                            scheduledTimeSlot
                                          })}
                                          disabled={approveQuoteMutation.isPending}
                                        >
                                          <ThumbsUp className="h-4 w-4 mr-2" />
                                          Approve & Schedule
                                        </Button>
                                        <Button
                                          variant="destructive"
                                          onClick={() => rejectQuoteMutation.mutate({
                                            ticketId: selectedTicket.id,
                                            quoteId: quote.id
                                          })}
                                          disabled={rejectQuoteMutation.isPending}
                                        >
                                          <ThumbsDown className="h-4 w-4 mr-2" />
                                          Reject
                                        </Button>
                                      </div>
                                      <p className="text-xs text-gray-500">Notifications: Tenant notified of scheduled date. Contractor instructed to contact you for access.</p>
                                    </div>
                                  ) : quote.status === 'scheduled' || quote.status === 'approved' ? (
                                    <div className="border-t pt-3 mt-3">
                                      <Button
                                        className="w-full bg-orange-600 hover:bg-orange-700"
                                        onClick={() => startWorkMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id })}
                                        disabled={startWorkMutation.isPending}
                                      >
                                        <Hammer className="h-4 w-4 mr-2" />
                                        Mark Work Started
                                      </Button>
                                      <p className="text-xs text-gray-500 mt-2">Internal tracking only - tenant not notified when work starts</p>
                                    </div>
                                  ) : quote.status === 'in_progress' ? (
                                    <div className="space-y-3 border-t pt-3 mt-3">
                                      <Textarea
                                        placeholder="Completion notes (shared with tenant)..."
                                        value={completionNotes}
                                        onChange={(e) => setCompletionNotes(e.target.value)}
                                        rows={2}
                                      />
                                      <Button
                                        className="w-full bg-green-600 hover:bg-green-700"
                                        onClick={() => completeWorkMutation.mutate({
                                          ticketId: selectedTicket.id,
                                          quoteId: quote.id,
                                          completionNotes
                                        })}
                                        disabled={completeWorkMutation.isPending}
                                      >
                                        <CheckCircle className="h-4 w-4 mr-2" />
                                        Mark Work Completed
                                      </Button>
                                      <p className="text-xs text-gray-500">Tenant will be notified that work is complete (from John Barclay Property Management)</p>
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Workflow Timeline */}
                        <div className="bg-gray-50 rounded-lg p-4">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Timeline
                          </h4>
                          <div className="relative">
                            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                            <div className="space-y-4">
                              {workflowEvents && workflowEvents.length > 0 ? (
                                workflowEvents.map((event: any, idx: number) => (
                                  <div key={event.id} className="relative pl-10">
                                    <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                                      event.eventType.includes('completed') ? 'bg-green-500' :
                                      event.eventType.includes('rejected') || event.eventType.includes('declined') ? 'bg-red-500' :
                                      event.eventType.includes('approved') || event.eventType.includes('scheduled') ? 'bg-purple-500' :
                                      event.eventType.includes('quote') || event.eventType.includes('accepted') ? 'bg-blue-500' :
                                      'bg-gray-400'
                                    }`}>
                                      {event.eventType.includes('completed') ? <CheckCircle className="h-3 w-3 text-white" /> :
                                       event.eventType.includes('rejected') ? <XCircle className="h-3 w-3 text-white" /> :
                                       event.eventType.includes('scheduled') ? <Calendar className="h-3 w-3 text-white" /> :
                                       event.eventType.includes('started') ? <Hammer className="h-3 w-3 text-white" /> :
                                       <CircleDot className="h-3 w-3 text-white" />}
                                    </div>
                                    <div className="bg-white rounded-lg p-3 shadow-sm">
                                      <div className="flex justify-between items-start">
                                        <p className="font-medium text-sm">{event.title}</p>
                                        <span className="text-xs text-gray-400">
                                          {new Date(event.createdAt).toLocaleString('en-GB', {
                                            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                          })}
                                        </span>
                                      </div>
                                      {event.description && (
                                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                                      )}
                                      {event.notificationChannels?.length > 0 && (
                                        <div className="flex gap-1 mt-2">
                                          {event.notificationChannels.map((ch: string) => (
                                            <Badge key={ch} variant="outline" className="text-xs capitalize">{ch}</Badge>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="pl-10 text-sm text-gray-500">
                                  <div className="relative">
                                    <div className="absolute left-[-22px] w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
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
                        </div>
                      </div>
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="communications" className="mt-4">
                    {/* PM-centric notice */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
                      <strong>All messages sent from here go to the tenant.</strong> Contractor communications are handled via the Workflow tab.
                    </div>

                    <ScrollArea className="h-[350px]">
                      <div className="space-y-3">
                        {selectedTicket.communications?.map((comm: any) => (
                          <div
                            key={comm.id}
                            className={`p-3 rounded-lg ${comm.direction === 'inbound' ? 'bg-gray-100 ml-0 mr-12' : 'bg-[#791E75]/10 ml-12 mr-0'}`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <ChannelIcon channel={comm.channel} />
                              <span className="text-xs text-gray-500 capitalize">{comm.channel}</span>
                              <span className="text-xs text-gray-400">{new Date(comm.timestamp).toLocaleString()}</span>
                              {comm.direction === 'outbound' && (
                                <Badge variant="outline" className="text-xs">From Property Management</Badge>
                              )}
                            </div>
                            <p className="text-sm">{comm.content}</p>
                          </div>
                        )) || (
                          <p className="text-center text-gray-500 py-8">No communications yet</p>
                        )}
                      </div>
                    </ScrollArea>

                    {/* Send WhatsApp to Tenant */}
                    <div className="mt-4 pt-4 border-t">
                      <p className="text-xs text-gray-500 mb-2">Message tenant directly as John Barclay Property Management</p>
                      <div className="flex gap-2">
                        <Textarea
                          placeholder="Type a message to tenant..."
                          value={whatsappMessage}
                          onChange={(e) => setWhatsappMessage(e.target.value)}
                          className="flex-1"
                          rows={2}
                        />
                        <Button
                          onClick={() => sendWhatsAppMutation.mutate({
                            ticketId: selectedTicket.id,
                            message: whatsappMessage,
                            phoneNumber: selectedTicket.tenantPhone
                          })}
                          disabled={!whatsappMessage || sendWhatsAppMutation.isPending}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Send to Tenant
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="actions" className="mt-4">
                    <div className="space-y-4">
                      {/* Update Status */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium mb-3">Update Status</h4>
                        <div className="flex gap-2 flex-wrap">
                          {['open', 'in_progress', 'waiting_tenant', 'resolved', 'closed'].map((status) => (
                            <Button
                              key={status}
                              variant={selectedTicket.status === status ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, data: { status } })}
                              className="capitalize"
                            >
                              {status.replace('_', ' ')}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Update Priority */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium mb-3">Update Priority</h4>
                        <div className="flex gap-2">
                          {['low', 'medium', 'high', 'urgent'].map((priority) => (
                            <Button
                              key={priority}
                              variant={selectedTicket.priority === priority ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => updateTicketMutation.mutate({ ticketId: selectedTicket.id, data: { priority } })}
                              className="capitalize"
                            >
                              {priority}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* Add Comment */}
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h4 className="font-medium mb-3">Add Comment</h4>
                        <Textarea
                          placeholder="Add a comment..."
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          className="mb-2"
                          rows={3}
                        />
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={isInternalComment}
                              onChange={(e) => setIsInternalComment(e.target.checked)}
                            />
                            Internal note (not visible to tenant)
                          </label>
                          <Button
                            onClick={() => addCommentMutation.mutate({
                              ticketId: selectedTicket.id,
                              comment: newComment,
                              isInternal: isInternalComment
                            })}
                            disabled={!newComment || addCommentMutation.isPending}
                            size="sm"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Add Comment
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
      </main>
    </div>
  );
}
