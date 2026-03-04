import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Loader2, Wrench, AlertCircle, CheckCircle, Clock, Calendar, Users, Plus, Send,
  AlertTriangle, Home, Building, User, Phone, Mail, CreditCard, ThumbsUp, ThumbsDown,
  PoundSterling, MessageCircle, CircleDot, XCircle, Search, Filter, ChevronRight,
  ArrowLeft, FileText, MapPin, HardHat, Eye, Hammer, Package, MessageSquare
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from 'date-fns';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useLocation } from 'wouter';

// Form schema for new ticket
const maintenanceFormSchema = z.object({
  propertyId: z.string().min(1, "Property required"),
  category: z.enum(["plumbing", "electrical", "heating", "appliance", "structural", "other"]),
  urgency: z.enum(["emergency", "urgent", "routine", "low"]),
  title: z.string().min(5, "Title required"),
  description: z.string().min(20, "Please provide a detailed description"),
  location: z.string().optional()
});

// Status config
const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  new: { label: 'New', color: 'text-blue-700', bgColor: 'bg-blue-50 border-blue-200' },
  assigned: { label: 'Assigned', color: 'text-purple-700', bgColor: 'bg-purple-50 border-purple-200' },
  in_progress: { label: 'In Progress', color: 'text-yellow-700', bgColor: 'bg-yellow-50 border-yellow-200' },
  awaiting_parts: { label: 'Awaiting Parts', color: 'text-orange-700', bgColor: 'bg-orange-50 border-orange-200' },
  completed: { label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-50 border-green-200' },
  closed: { label: 'Closed', color: 'text-gray-700', bgColor: 'bg-gray-50 border-gray-200' },
};

const urgencyConfig: Record<string, { label: string; color: string; icon: any }> = {
  emergency: { label: 'Emergency', color: 'bg-red-100 text-red-800 border-red-300', icon: AlertCircle },
  urgent: { label: 'Urgent', color: 'bg-orange-100 text-orange-800 border-orange-300', icon: AlertTriangle },
  routine: { label: 'Routine', color: 'bg-blue-100 text-blue-700 border-blue-300', icon: Clock },
  low: { label: 'Low', color: 'bg-gray-100 text-gray-600 border-gray-300', icon: CircleDot },
};

const categoryConfig: Record<string, { label: string; icon: any }> = {
  plumbing: { label: 'Plumbing', icon: Wrench },
  electrical: { label: 'Electrical', icon: AlertCircle },
  heating: { label: 'Heating', icon: Hammer },
  appliance: { label: 'Appliance', icon: Package },
  structural: { label: 'Structural', icon: Building },
  other: { label: 'Other', icon: Wrench },
};

// Pipeline stages
const pipelineStages = [
  { key: 'new', label: 'New' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'awaiting_parts', label: 'Awaiting Parts' },
  { key: 'completed', label: 'Completed' },
  { key: 'closed', label: 'Closed' },
];

export default function MaintenanceTasks() {
  const [, setLocation] = useLocation();
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState('overview');
  const [showNewTicketDialog, setShowNewTicketDialog] = useState(false);
  const [showQuoteRequestDialog, setShowQuoteRequestDialog] = useState(false);
  const [selectedContractorsForQuote, setSelectedContractorsForQuote] = useState<number[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form states
  const [newComment, setNewComment] = useState('');
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Check URL for ticket param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get('ticket');
    if (ticketId) {
      setSelectedTicketId(Number(ticketId));
    }
  }, []);

  // ==================== QUERIES ====================

  const { data: ticketsData, isLoading: ticketsLoading } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets'],
    queryFn: async () => {
      const res = await apiRequest('/api/crm/maintenance/tickets');
      return res;
    }
  });

  const tickets = Array.isArray(ticketsData) ? ticketsData : (ticketsData as any)?.tickets || [];

  const { data: properties } = useQuery({
    queryKey: ['/api/crm/properties'],
    queryFn: async () => {
      const res = await apiRequest('/api/crm/properties');
      return Array.isArray(res) ? res : (res as any)?.properties || [];
    }
  });

  const { data: contractors } = useQuery({
    queryKey: ['/api/crm/contractors'],
    queryFn: async () => apiRequest('/api/crm/contractors')
  });

  const selectedTicket = tickets.find((t: any) => t.id === selectedTicketId);

  const { data: ticketHistory } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'history'],
    queryFn: async () => apiRequest(`/api/crm/maintenance/tickets/${selectedTicketId}/history`),
    enabled: !!selectedTicketId
  });

  const { data: ticketQuotes } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'quotes'],
    queryFn: async () => apiRequest(`/api/crm/maintenance/tickets/${selectedTicketId}/quotes`),
    enabled: !!selectedTicketId
  });

  const { data: workflowEvents } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'workflow'],
    queryFn: async () => apiRequest(`/api/crm/maintenance/tickets/${selectedTicketId}/workflow`),
    enabled: !!selectedTicketId
  });

  const { data: ticketComms } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'communications'],
    queryFn: async () => apiRequest(`/api/crm/maintenance/tickets/${selectedTicketId}/communications`),
    enabled: !!selectedTicketId
  });

  // ==================== MUTATIONS ====================

  const maintenanceForm = useForm<z.infer<typeof maintenanceFormSchema>>({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: { propertyId: '', category: 'plumbing', urgency: 'routine', title: '', description: '', location: '' }
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('/api/crm/maintenance/tickets', 'POST', {
      ...data, propertyId: Number(data.propertyId)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      setShowNewTicketDialog(false);
      maintenanceForm.reset();
      toast({ title: 'Ticket created', description: 'Maintenance ticket has been created successfully.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create ticket', variant: 'destructive' })
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: number; status: string; notes?: string }) =>
      apiRequest(`/api/crm/maintenance/tickets/${id}/status`, 'PATCH', { status, notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'history'] });
      toast({ title: 'Status updated' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' })
  });

  const assignContractorMutation = useMutation({
    mutationFn: async ({ ticketId, contractorId }: { ticketId: number; contractorId: number }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/assign-contractor`, 'POST', { contractorId, notify: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'history'] });
      toast({ title: 'Contractor assigned' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to assign contractor', variant: 'destructive' })
  });

  const requestQuotesMutation = useMutation({
    mutationFn: async ({ ticketId, contractorIds }: { ticketId: number; contractorIds: number[] }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/request-quotes`, 'POST', { contractorIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'workflow'] });
      setShowQuoteRequestDialog(false);
      setSelectedContractorsForQuote([]);
      toast({ title: 'Quotes requested', description: 'Contractors have been notified.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to request quotes', variant: 'destructive' })
  });

  const approveQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/approve`, 'POST', {
        approvalNotes, scheduledDate, scheduledTimeSlot
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'workflow'] });
      setApprovalNotes('');
      setScheduledDate('');
      setScheduledTimeSlot('');
      toast({ title: 'Quote approved' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to approve quote', variant: 'destructive' })
  });

  const rejectQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/reject`, 'POST', { rejectionReason: 'Rejected by manager' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'quotes'] });
      toast({ title: 'Quote rejected' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to reject quote', variant: 'destructive' })
  });

  const startWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/start-work`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      toast({ title: 'Work started' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to start work', variant: 'destructive' })
  });

  const completeWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/complete`, 'POST', { completionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      setCompletionNotes('');
      toast({ title: 'Work completed' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to complete work', variant: 'destructive' })
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async ({ ticketId, message, phoneNumber }: { ticketId: number; message: string; phoneNumber: string }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/send-whatsapp`, 'POST', { message, phoneNumber }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'communications'] });
      setWhatsappMessage('');
      toast({ title: 'Message sent' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to send message', variant: 'destructive' })
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ ticketId, comment, isInternal }: { ticketId: number; comment: string; isInternal: boolean }) =>
      apiRequest(`/api/crm/maintenance/tickets/${ticketId}/status`, 'PATCH', {
        status: selectedTicket?.status,
        notes: `${isInternal ? '[INTERNAL] ' : ''}${comment}`
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', selectedTicketId, 'history'] });
      setNewComment('');
      setIsInternalComment(false);
      toast({ title: 'Comment added' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to add comment', variant: 'destructive' })
  });

  // ==================== FILTER LOGIC ====================

  const filteredTickets = tickets.filter((t: any) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (urgencyFilter !== 'all' && t.urgency !== urgencyFilter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        t.title?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.propertyAddress?.toLowerCase().includes(q) ||
        t.contractorName?.toLowerCase().includes(q) ||
        String(t.id).includes(q)
      );
    }
    return true;
  });

  // Stats
  const stats = {
    new: tickets.filter((t: any) => t.status === 'new').length,
    assigned: tickets.filter((t: any) => t.status === 'assigned').length,
    in_progress: tickets.filter((t: any) => t.status === 'in_progress').length,
    awaiting_parts: tickets.filter((t: any) => t.status === 'awaiting_parts').length,
    completed: tickets.filter((t: any) => t.status === 'completed').length,
    closed: tickets.filter((t: any) => t.status === 'closed').length,
  };

  // Current pipeline stage index
  const currentStageIndex = selectedTicket ? pipelineStages.findIndex(s => s.key === selectedTicket.status) : -1;

  // ==================== RENDER ====================

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation('/crm/properties')} className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Maintenance Tasks</h1>
            <p className="text-sm text-gray-500">{tickets.length} total tickets</p>
          </div>
        </div>
        <Button onClick={() => setShowNewTicketDialog(true)} className="bg-[#791E75] hover:bg-[#631860]">
          <Plus className="h-4 w-4 mr-2" />
          New Ticket
        </Button>
      </header>

      {/* Stats Bar */}
      <div className="bg-white border-b border-gray-200 px-6 py-2 flex gap-3 flex-shrink-0 overflow-x-auto">
        {Object.entries(stats).map(([key, count]) => {
          const cfg = statusConfig[key];
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? 'all' : key)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                statusFilter === key ? 'ring-2 ring-[#791E75] ring-offset-1' : '',
                cfg?.bgColor || 'bg-gray-50 border-gray-200'
              )}
            >
              <span className={cn("font-bold text-sm", cfg?.color)}>{count}</span>
              <span className={cfg?.color}>{cfg?.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main split view */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Task List */}
        <div className={cn(
          "border-r border-gray-200 bg-white flex flex-col transition-all",
          selectedTicketId ? "w-[380px]" : "w-full max-w-2xl mx-auto"
        )}>
          {/* Filters */}
          <div className="p-3 border-b border-gray-100 space-y-2 flex-shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Urgency</SelectItem>
                  <SelectItem value="emergency">Emergency</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="routine">Routine</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="heating">Heating</SelectItem>
                  <SelectItem value="appliance">Appliance</SelectItem>
                  <SelectItem value="structural">Structural</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Ticket list */}
          <ScrollArea className="flex-1">
            {ticketsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : filteredTickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                <Wrench className="h-10 w-10 mb-3" />
                <p className="text-sm font-medium">No tickets found</p>
                <p className="text-xs mt-1">Create a new ticket to get started</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredTickets.map((ticket: any) => {
                  const urg = urgencyConfig[ticket.urgency] || urgencyConfig.routine;
                  const stat = statusConfig[ticket.status] || statusConfig.new;
                  const cat = categoryConfig[ticket.category] || categoryConfig.other;
                  const CatIcon = cat.icon;
                  return (
                    <button
                      key={ticket.id}
                      onClick={() => { setSelectedTicketId(ticket.id); setDetailTab('overview'); }}
                      className={cn(
                        "w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors",
                        selectedTicketId === ticket.id && "bg-purple-50 border-l-3 border-l-[#791E75]"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">#{ticket.id}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", urg.color)}>
                              {urg.label}
                            </Badge>
                            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 border", stat.bgColor, stat.color)}>
                              {stat.label}
                            </Badge>
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate">{ticket.title}</p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <CatIcon className="h-3 w-3" />
                              {cat.label}
                            </span>
                            {ticket.propertyAddress && (
                              <span className="flex items-center gap-1 truncate">
                                <MapPin className="h-3 w-3" />
                                {ticket.propertyAddress}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {ticket.contractorName && (
                              <span className="flex items-center gap-1">
                                <HardHat className="h-3 w-3" />
                                {ticket.contractorName}
                              </span>
                            )}
                            {ticket.createdAt && (
                              <span>{formatDistanceToNow(new Date(ticket.createdAt), { addSuffix: true })}</span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0 mt-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right: Detail Panel */}
        {selectedTicketId && selectedTicket ? (
          <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
            {/* Detail Header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-gray-400">#{selectedTicket.id}</span>
                    <Badge variant="outline" className={cn("text-xs", urgencyConfig[selectedTicket.urgency]?.color)}>
                      {urgencyConfig[selectedTicket.urgency]?.label || selectedTicket.urgency}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs border", statusConfig[selectedTicket.status]?.bgColor, statusConfig[selectedTicket.status]?.color)}>
                      {statusConfig[selectedTicket.status]?.label || selectedTicket.status}
                    </Badge>
                  </div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedTicket.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {selectedTicket.propertyAddress && `${selectedTicket.propertyAddress}`}
                    {selectedTicket.propertyPostcode && `, ${selectedTicket.propertyPostcode}`}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedTicketId(null)}>
                  <XCircle className="h-4 w-4" />
                </Button>
              </div>

              {/* Workflow Pipeline */}
              <div className="flex items-center gap-1 mt-4">
                {pipelineStages.map((stage, i) => {
                  const isActive = stage.key === selectedTicket.status;
                  const isPast = i < currentStageIndex;
                  return (
                    <div key={stage.key} className="flex items-center flex-1">
                      <div className={cn(
                        "flex-1 h-2 rounded-full transition-all",
                        isPast ? "bg-[#791E75]" : isActive ? "bg-[#791E75]" : "bg-gray-200"
                      )} />
                      {i < pipelineStages.length - 1 && <div className="w-1" />}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                {pipelineStages.map((stage, i) => {
                  const isActive = stage.key === selectedTicket.status;
                  return (
                    <span key={stage.key} className={cn("text-[10px]", isActive ? "text-[#791E75] font-semibold" : "text-gray-400")}>
                      {stage.label}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-3 justify-start bg-transparent border-b border-gray-200 rounded-none p-0 h-auto">
                <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">
                  Overview
                </TabsTrigger>
                <TabsTrigger value="workflow" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">
                  Workflow
                </TabsTrigger>
                <TabsTrigger value="comments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">
                  Comments
                </TabsTrigger>
                <TabsTrigger value="quotes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">
                  Quotes & Costs
                </TabsTrigger>
                <TabsTrigger value="messages" className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2 text-sm">
                  Messages
                </TabsTrigger>
              </TabsList>

              {/* ========== OVERVIEW TAB ========== */}
              <TabsContent value="overview" className="flex-1 overflow-auto px-6 py-4 mt-0">
                <div className="grid grid-cols-2 gap-4">
                  {/* Ticket Details */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold text-gray-700">Ticket Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Category</span>
                        <span className="font-medium capitalize">{selectedTicket.category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Urgency</span>
                        <Badge variant="outline" className={cn("text-xs", urgencyConfig[selectedTicket.urgency]?.color)}>
                          {urgencyConfig[selectedTicket.urgency]?.label}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Created</span>
                        <span>{selectedTicket.createdAt ? format(new Date(selectedTicket.createdAt), 'dd MMM yyyy HH:mm') : 'N/A'}</span>
                      </div>
                      {selectedTicket.estimatedCost && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Estimated Cost</span>
                          <span className="font-medium">£{(selectedTicket.estimatedCost / 100).toFixed(2)}</span>
                        </div>
                      )}
                      {selectedTicket.actualCost && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Actual Cost</span>
                          <span className="font-medium">£{(selectedTicket.actualCost / 100).toFixed(2)}</span>
                        </div>
                      )}
                      <Separator />
                      <div>
                        <span className="text-gray-500 block mb-1">Description</span>
                        <p className="text-gray-800 whitespace-pre-wrap">{selectedTicket.description}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Property & Tenant */}
                  <div className="space-y-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700">Property</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-1">
                        <p className="font-medium">{selectedTicket.propertyAddress || 'N/A'}</p>
                        <p className="text-gray-500">{selectedTicket.propertyPostcode}</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700">Tenant</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm space-y-2">
                        {selectedTicket.tenantName ? (
                          <>
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-gray-400" />
                              <span>{selectedTicket.tenantName}</span>
                            </div>
                            {selectedTicket.tenantPhone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-3.5 w-3.5 text-gray-400" />
                                <span>{selectedTicket.tenantPhone}</span>
                              </div>
                            )}
                            {selectedTicket.tenantEmail && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-3.5 w-3.5 text-gray-400" />
                                <span>{selectedTicket.tenantEmail}</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <p className="text-gray-400 italic">No tenant assigned</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-gray-700">Assigned Contractor</CardTitle>
                      </CardHeader>
                      <CardContent className="text-sm">
                        {selectedTicket.contractorName ? (
                          <div className="flex items-center gap-2">
                            <HardHat className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium">{selectedTicket.contractorName}</span>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-gray-400 italic text-xs">No contractor assigned</p>
                            <Select onValueChange={(v) => assignContractorMutation.mutate({ ticketId: selectedTicket.id, contractorId: Number(v) })}>
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Assign contractor..." />
                              </SelectTrigger>
                              <SelectContent>
                                {(contractors || []).map((c: any) => (
                                  <SelectItem key={c.id} value={String(c.id)}>
                                    {c.companyName || c.contactName}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {/* Quick Actions */}
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {selectedTicket.status === 'new' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'assigned' })}>
                          Mark Assigned
                        </Button>
                      )}
                      {selectedTicket.status === 'assigned' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'in_progress' })}>
                          Start Work
                        </Button>
                      )}
                      {selectedTicket.status === 'in_progress' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'awaiting_parts' })}>
                            Awaiting Parts
                          </Button>
                          <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'completed' })}>
                            <CheckCircle className="h-3.5 w-3.5 mr-1" />
                            Mark Complete
                          </Button>
                        </>
                      )}
                      {selectedTicket.status === 'awaiting_parts' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'in_progress' })}>
                          Resume Work
                        </Button>
                      )}
                      {selectedTicket.status === 'completed' && (
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: 'closed' })}>
                          Close Ticket
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========== WORKFLOW TAB ========== */}
              <TabsContent value="workflow" className="flex-1 overflow-auto px-6 py-4 mt-0">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">Workflow Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!workflowEvents || (Array.isArray(workflowEvents) && workflowEvents.length === 0) ? (
                      <div className="text-center py-8 text-gray-400">
                        <Clock className="h-8 w-8 mx-auto mb-2" />
                        <p className="text-sm">No workflow events yet</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200" />
                        <div className="space-y-4">
                          {(Array.isArray(workflowEvents) ? workflowEvents : []).map((event: any, i: number) => {
                            const eventIcons: Record<string, { icon: any; color: string }> = {
                              ticket_created: { icon: Plus, color: 'bg-blue-500' },
                              contractor_notified: { icon: Send, color: 'bg-purple-500' },
                              contractor_accepted: { icon: ThumbsUp, color: 'bg-green-500' },
                              contractor_declined: { icon: ThumbsDown, color: 'bg-red-500' },
                              quote_received: { icon: PoundSterling, color: 'bg-blue-500' },
                              quote_approved: { icon: CheckCircle, color: 'bg-green-500' },
                              quote_rejected: { icon: XCircle, color: 'bg-red-500' },
                              work_scheduled: { icon: Calendar, color: 'bg-purple-500' },
                              work_started: { icon: Hammer, color: 'bg-yellow-500' },
                              work_completed: { icon: CheckCircle, color: 'bg-green-600' },
                              status_change: { icon: CircleDot, color: 'bg-gray-500' },
                              assignment: { icon: Users, color: 'bg-purple-500' },
                            };
                            const cfg = eventIcons[event.eventType] || eventIcons.status_change || { icon: CircleDot, color: 'bg-gray-500' };
                            const Icon = cfg.icon;
                            return (
                              <div key={event.id || i} className="relative flex gap-3 pl-1">
                                <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white flex-shrink-0 z-10", cfg.color)}>
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="flex-1 pb-2">
                                  <p className="text-sm font-medium text-gray-900">{event.title || event.eventType?.replace(/_/g, ' ')}</p>
                                  {event.description && <p className="text-xs text-gray-500 mt-0.5">{event.description}</p>}
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[10px] text-gray-400">
                                      {event.createdAt ? format(new Date(event.createdAt), 'dd MMM yyyy HH:mm') : ''}
                                    </span>
                                    {event.triggeredBy && (
                                      <Badge variant="outline" className="text-[10px] py-0">{event.triggeredBy}</Badge>
                                    )}
                                    {event.notificationChannels?.map((ch: string) => (
                                      <Badge key={ch} variant="outline" className="text-[10px] py-0 bg-green-50 text-green-600">{ch}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Status Change Actions */}
                <Card className="mt-4">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold text-gray-700">Update Status</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {pipelineStages.map((stage) => {
                        const isActive = stage.key === selectedTicket.status;
                        return (
                          <Button
                            key={stage.key}
                            size="sm"
                            variant={isActive ? "default" : "outline"}
                            className={isActive ? "bg-[#791E75]" : ""}
                            disabled={isActive}
                            onClick={() => updateStatusMutation.mutate({ id: selectedTicket.id, status: stage.key })}
                          >
                            {stage.label}
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ========== COMMENTS TAB ========== */}
              <TabsContent value="comments" className="flex-1 flex flex-col overflow-hidden mt-0">
                <ScrollArea className="flex-1 px-6 py-4">
                  {!ticketHistory || (Array.isArray(ticketHistory) && ticketHistory.length === 0) ? (
                    <div className="text-center py-8 text-gray-400">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No comments yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(Array.isArray(ticketHistory) ? ticketHistory : []).map((update: any, i: number) => {
                        const isStatusChange = update.updateType === 'status_change';
                        const isInternal = update.isInternal || update.message?.startsWith('[INTERNAL]');
                        return (
                          <div key={update.id || i} className={cn(
                            "rounded-lg p-3 border",
                            isStatusChange ? "bg-gray-50 border-gray-200" : isInternal ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-200"
                          )}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-700">{update.userName || 'System'}</span>
                                {isInternal && <Badge variant="outline" className="text-[10px] py-0 bg-yellow-100 text-yellow-700">Internal</Badge>}
                                {isStatusChange && (
                                  <Badge variant="outline" className="text-[10px] py-0">
                                    {update.previousStatus} → {update.newStatus}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-gray-400">
                                {update.createdAt ? format(new Date(update.createdAt), 'dd MMM HH:mm') : ''}
                              </span>
                            </div>
                            {update.message && (
                              <p className="text-sm text-gray-600">{update.message.replace('[INTERNAL] ', '')}</p>
                            )}
                          </div>
                        );
                      })}
                      <div ref={commentsEndRef} />
                    </div>
                  )}
                </ScrollArea>
                {/* Add comment form */}
                <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox
                      id="internal"
                      checked={isInternalComment}
                      onCheckedChange={(v) => setIsInternalComment(!!v)}
                    />
                    <label htmlFor="internal" className="text-xs text-gray-500">Internal note (not visible to tenant)</label>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && newComment.trim()) {
                          addCommentMutation.mutate({ ticketId: selectedTicket.id, comment: newComment, isInternal: isInternalComment });
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      disabled={!newComment.trim() || addCommentMutation.isPending}
                      onClick={() => addCommentMutation.mutate({ ticketId: selectedTicket.id, comment: newComment, isInternal: isInternalComment })}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>

              {/* ========== QUOTES TAB ========== */}
              <TabsContent value="quotes" className="flex-1 overflow-auto px-6 py-4 mt-0">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <PoundSterling className="h-4 w-4" />
                    Contractor Quotes
                  </h3>
                  <Button size="sm" variant="outline" onClick={() => setShowQuoteRequestDialog(true)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Request Quotes
                  </Button>
                </div>

                {!ticketQuotes || (Array.isArray(ticketQuotes) && ticketQuotes.length === 0) ? (
                  <Card>
                    <CardContent className="py-8 text-center text-gray-400">
                      <PoundSterling className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No quotes yet</p>
                      <p className="text-xs mt-1">Request quotes from contractors to get started</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {(Array.isArray(ticketQuotes) ? ticketQuotes : []).map((quote: any) => {
                      const quoteStatusColors: Record<string, string> = {
                        pending: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                        quoted: 'bg-blue-50 border-blue-200 text-blue-700',
                        accepted: 'bg-blue-50 border-blue-200 text-blue-700',
                        approved: 'bg-green-50 border-green-200 text-green-700',
                        rejected: 'bg-red-50 border-red-200 text-red-700',
                        scheduled: 'bg-purple-50 border-purple-200 text-purple-700',
                        in_progress: 'bg-yellow-50 border-yellow-200 text-yellow-700',
                        completed: 'bg-green-50 border-green-200 text-green-700',
                        cancelled: 'bg-gray-50 border-gray-200 text-gray-500',
                      };
                      return (
                        <Card key={quote.id}>
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <HardHat className="h-4 w-4 text-gray-400" />
                                  <span className="text-sm font-medium">{quote.contractorName || `Contractor #${quote.contractorId}`}</span>
                                  <Badge variant="outline" className={cn("text-xs", quoteStatusColors[quote.status] || '')}>
                                    {quote.status?.replace(/_/g, ' ')}
                                  </Badge>
                                </div>
                                {quote.quoteDescription && (
                                  <p className="text-xs text-gray-500 mt-1">{quote.quoteDescription}</p>
                                )}
                                {quote.estimatedDuration && (
                                  <p className="text-xs text-gray-500 mt-1">Duration: {quote.estimatedDuration}</p>
                                )}
                                {quote.scheduledDate && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    Scheduled: {format(new Date(quote.scheduledDate), 'dd MMM yyyy')}
                                    {quote.scheduledTimeSlot && ` (${quote.scheduledTimeSlot})`}
                                  </p>
                                )}
                              </div>
                              {quote.quoteAmount && (
                                <div className="text-right">
                                  <p className="text-lg font-bold text-gray-900">£{(quote.quoteAmount / 100).toFixed(2)}</p>
                                  {quote.finalAmount && quote.finalAmount !== quote.quoteAmount && (
                                    <p className="text-xs text-gray-500">Final: £{(quote.finalAmount / 100).toFixed(2)}</p>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Actions based on status */}
                            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                              {(quote.status === 'pending' || quote.status === 'quoted' || quote.status === 'accepted') && (
                                <>
                                  <div className="flex-1 space-y-2">
                                    <Input
                                      type="date"
                                      placeholder="Schedule date"
                                      value={scheduledDate}
                                      onChange={(e) => setScheduledDate(e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                    <Input
                                      placeholder="Approval notes..."
                                      value={approvalNotes}
                                      onChange={(e) => setApprovalNotes(e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8"
                                      onClick={() => approveQuoteMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id })}>
                                      <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Approve
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-red-600 border-red-200 h-8"
                                      onClick={() => rejectQuoteMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id })}>
                                      <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Reject
                                    </Button>
                                  </div>
                                </>
                              )}
                              {(quote.status === 'approved' || quote.status === 'scheduled') && (
                                <Button size="sm" className="bg-yellow-600 hover:bg-yellow-700 text-white"
                                  onClick={() => startWorkMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id })}>
                                  <Hammer className="h-3.5 w-3.5 mr-1" /> Start Work
                                </Button>
                              )}
                              {quote.status === 'in_progress' && (
                                <div className="flex gap-2 items-end flex-1">
                                  <Input
                                    placeholder="Completion notes..."
                                    value={completionNotes}
                                    onChange={(e) => setCompletionNotes(e.target.value)}
                                    className="flex-1 h-8 text-xs"
                                  />
                                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => completeWorkMutation.mutate({ ticketId: selectedTicket.id, quoteId: quote.id })}>
                                    <CheckCircle className="h-3.5 w-3.5 mr-1" /> Complete
                                  </Button>
                                </div>
                              )}
                              {quote.status === 'completed' && (
                                <div className="flex items-center gap-2 text-green-600">
                                  <CheckCircle className="h-4 w-4" />
                                  <span className="text-sm font-medium">Work completed</span>
                                  {quote.completionNotes && (
                                    <span className="text-xs text-gray-500">— {quote.completionNotes}</span>
                                  )}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </TabsContent>

              {/* ========== MESSAGES TAB ========== */}
              <TabsContent value="messages" className="flex-1 flex flex-col overflow-hidden mt-0">
                <ScrollArea className="flex-1 px-6 py-4">
                  {!ticketComms || (Array.isArray(ticketComms) && ticketComms.length === 0) ? (
                    <div className="text-center py-8 text-gray-400">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2" />
                      <p className="text-sm">No messages yet</p>
                      <p className="text-xs mt-1">Send a WhatsApp message to the tenant</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(Array.isArray(ticketComms) ? ticketComms : []).map((msg: any, i: number) => {
                        const isOutbound = msg.direction === 'outbound';
                        const channelIcons: Record<string, any> = {
                          whatsapp: MessageCircle,
                          email: Mail,
                          phone: Phone,
                          sms: MessageSquare,
                        };
                        const ChannelIcon = channelIcons[msg.channel] || MessageCircle;
                        return (
                          <div key={msg.id || i} className={cn("flex", isOutbound ? "justify-end" : "justify-start")}>
                            <div className={cn(
                              "max-w-[75%] rounded-lg px-4 py-2.5 shadow-sm",
                              isOutbound ? "bg-[#791E75] text-white" : "bg-white border border-gray-200"
                            )}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <ChannelIcon className={cn("h-3 w-3", isOutbound ? "text-purple-200" : "text-gray-400")} />
                                <span className={cn("text-[10px] font-medium", isOutbound ? "text-purple-200" : "text-gray-400")}>
                                  {msg.channel || 'message'} • {isOutbound ? 'Sent' : 'Received'}
                                </span>
                              </div>
                              <p className={cn("text-sm", isOutbound ? "text-white" : "text-gray-800")}>{msg.content || msg.message}</p>
                              <p className={cn("text-[10px] mt-1", isOutbound ? "text-purple-200" : "text-gray-400")}>
                                {msg.timestamp || msg.createdAt ? format(new Date(msg.timestamp || msg.createdAt), 'dd MMM HH:mm') : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>
                {/* Send message form */}
                <div className="border-t border-gray-200 bg-white p-4 flex-shrink-0">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Type a WhatsApp message..."
                      value={whatsappMessage}
                      onChange={(e) => setWhatsappMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && whatsappMessage.trim() && selectedTicket.tenantPhone) {
                          sendWhatsAppMutation.mutate({
                            ticketId: selectedTicket.id,
                            message: whatsappMessage,
                            phoneNumber: selectedTicket.tenantPhone
                          });
                        }
                      }}
                      className="flex-1"
                    />
                    <Button
                      size="sm"
                      disabled={!whatsappMessage.trim() || !selectedTicket.tenantPhone || sendWhatsAppMutation.isPending}
                      onClick={() => sendWhatsAppMutation.mutate({
                        ticketId: selectedTicket.id,
                        message: whatsappMessage,
                        phoneNumber: selectedTicket.tenantPhone
                      })}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {!selectedTicket.tenantPhone && (
                    <p className="text-xs text-red-500 mt-1">No phone number available for this tenant</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          !selectedTicketId && tickets.length > 0 && (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-lg font-medium text-gray-500">Select a ticket</p>
                <p className="text-sm">Choose a maintenance ticket from the list to view details</p>
              </div>
            </div>
          )
        )}
      </div>

      {/* ========== NEW TICKET DIALOG ========== */}
      <Dialog open={showNewTicketDialog} onOpenChange={setShowNewTicketDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Maintenance Ticket</DialogTitle>
          </DialogHeader>
          <Form {...maintenanceForm}>
            <form onSubmit={maintenanceForm.handleSubmit((data) => createTicketMutation.mutate(data))} className="space-y-4">
              <FormField
                control={maintenanceForm.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(properties || []).map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.addressLine1 || p.address} {p.postcode && `- ${p.postcode}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={maintenanceForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="heating">Heating</SelectItem>
                          <SelectItem value="appliance">Appliance</SelectItem>
                          <SelectItem value="structural">Structural</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={maintenanceForm.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Urgency</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="routine">Routine</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={maintenanceForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input placeholder="Brief description of the issue" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={maintenanceForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Detailed description of the maintenance issue..." rows={4} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={maintenanceForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location in Property (optional)</FormLabel>
                    <FormControl><Input placeholder="e.g. Kitchen, Bathroom, Bedroom 2" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowNewTicketDialog(false)}>Cancel</Button>
                <Button type="submit" disabled={createTicketMutation.isPending} className="bg-[#791E75] hover:bg-[#631860]">
                  {createTicketMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  Create Ticket
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ========== QUOTE REQUEST DIALOG ========== */}
      <Dialog open={showQuoteRequestDialog} onOpenChange={setShowQuoteRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Quotes from Contractors</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {(contractors || []).map((c: any) => (
              <label key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                <Checkbox
                  checked={selectedContractorsForQuote.includes(c.id)}
                  onCheckedChange={(checked) => {
                    setSelectedContractorsForQuote(prev =>
                      checked ? [...prev, c.id] : prev.filter(id => id !== c.id)
                    );
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{c.companyName || c.contactName}</p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    {c.specializations && <span>{c.specializations.join(', ')}</span>}
                    {c.hourlyRate && <span>£{c.hourlyRate}/hr</span>}
                    {c.rating && <span>Rating: {c.rating}/5</span>}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowQuoteRequestDialog(false)}>Cancel</Button>
            <Button
              disabled={selectedContractorsForQuote.length === 0 || requestQuotesMutation.isPending}
              onClick={() => requestQuotesMutation.mutate({ ticketId: selectedTicket!.id, contractorIds: selectedContractorsForQuote })}
              className="bg-[#791E75] hover:bg-[#631860]"
            >
              {requestQuotesMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Request from {selectedContractorsForQuote.length} contractor{selectedContractorsForQuote.length !== 1 ? 's' : ''}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
