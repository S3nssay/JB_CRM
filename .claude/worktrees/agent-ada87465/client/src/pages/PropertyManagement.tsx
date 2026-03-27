import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Wrench, Shield, AlertCircle, CheckCircle, Clock, Calendar, Users, FileText, Plus, Eye, Send, AlertTriangle, Home, Building, User, Phone, Mail, CreditCard, ClipboardCheck, ExternalLink, UserCheck, Upload, Download, FileSpreadsheet, ChevronsUpDown, Check, ThumbsUp, ThumbsDown, Hammer, PoundSterling, MessageCircle, CircleDot, XCircle } from 'lucide-react';
import { Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// Form schemas
const maintenanceFormSchema = z.object({
  propertyId: z.string().min(1, "Property required"),
  category: z.enum(["plumbing", "electrical", "heating", "appliance", "structural", "other"]),
  urgency: z.enum(["emergency", "urgent", "routine", "low"]),
  title: z.string().min(5, "Title required"),
  description: z.string().min(20, "Please provide a detailed description"),
  location: z.string().optional()
});

const certificationFormSchema = z.object({
  propertyId: z.string().min(1, "Property required"),
  certificationType: z.string(),
  certificateNumber: z.string(),
  issuedBy: z.string(),
  issuedByCompany: z.string(),
  inspectionDate: z.string(),
  issueDate: z.string(),
  expiryDate: z.string()
});

// Priority badges
const PriorityBadge = ({ priority }: { priority: string }) => {
  const p = priority || 'routine';
  const variants: { [key: string]: any } = {
    'emergency': { variant: 'destructive', icon: AlertTriangle },
    'high': { variant: 'default', className: 'bg-[#F8B324] text-black 500' },
    'urgent': { variant: 'default', className: 'bg-[#F8B324] text-black 500' },
    'medium': { variant: 'secondary' },
    'routine': { variant: 'secondary' },
    'low': { variant: 'outline' }
  };

  const config = variants[p] || variants.routine;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {p.toUpperCase()}
    </Badge>
  );
};

// Certification status badge
const CertificationStatusBadge = ({ status, daysUntilExpiry }: { status: string; daysUntilExpiry?: number }) => {
  if (status === 'expired') {
    return <Badge variant="destructive">EXPIRED</Badge>;
  }
  if (daysUntilExpiry && daysUntilExpiry <= 7) {
    return <Badge className="bg-red-500">Expiring in {daysUntilExpiry} days</Badge>;
  }
  if (daysUntilExpiry && daysUntilExpiry <= 30) {
    return <Badge className="bg-[#F8B324] text-black 500">Expiring in {daysUntilExpiry} days</Badge>;
  }
  if (daysUntilExpiry && daysUntilExpiry <= 60) {
    return <Badge className="bg-[#F8B324] text-black 500">Expiring in {daysUntilExpiry} days</Badge>;
  }
  return <Badge className="bg-[#791E75] text-white 500">Valid</Badge>;
};

export default function PropertyManagement() {
  const [showMaintenanceDialog, setShowMaintenanceDialog] = useState(false);
  const [showCertificationDialog, setShowCertificationDialog] = useState(false);
  const [showRequestDetailsDialog, setShowRequestDetailsDialog] = useState(false);
  const [showCertDetailsDialog, setShowCertDetailsDialog] = useState(false);
  const [showRenewalDialog, setShowRenewalDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedCertification, setSelectedCertification] = useState<any>(null);
  const [selectedPropertyForMaintenance, setSelectedPropertyForMaintenance] = useState<any>(null);
  const [propertySelectOpen, setPropertySelectOpen] = useState(false);

  // Fetch maintenance requests
  const { data: maintenanceRequests, isLoading: loadingMaintenance } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets'],
    queryFn: async () => {
      const response = await fetch('/api/crm/maintenance/tickets');
      if (!response.ok) throw new Error('Failed to fetch maintenance requests');
      return response.json();
    }
  });

  // Auto-open ticket from URL param (e.g., ?ticket=123 from CRM Dashboard)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ticketId = params.get('ticket');
    if (ticketId && maintenanceRequests) {
      const ticket = maintenanceRequests.find((t: any) => String(t.id) === ticketId);
      if (ticket) {
        setSelectedRequest(ticket);
        setShowRequestDetailsDialog(true);
        // Clean up URL param
        const url = new URL(window.location.href);
        url.searchParams.delete('ticket');
        window.history.replaceState({}, '', url.pathname);
      }
    }
  }, [maintenanceRequests]);

  // Fetch certifications
  const { data: certifications, isLoading: loadingCertifications } = useQuery({
    queryKey: ['/api/crm/certifications'],
    queryFn: async () => {
      const response = await fetch('/api/crm/certifications');
      if (!response.ok) throw new Error('Failed to fetch certifications');
      return response.json();
    }
  });

  // Fetch contractors
  const { data: contractors } = useQuery({
    queryKey: ['/api/crm/contractors'],
    queryFn: async () => {
      const response = await fetch('/api/crm/contractors');
      if (!response.ok) throw new Error('Failed to fetch contractors');
      return response.json();
    }
  });

  // Fetch ticket history when a ticket is selected
  const { data: ticketHistory } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedRequest?.id, 'history'],
    queryFn: async () => {
      if (!selectedRequest?.id) return [];
      const response = await fetch(`/api/crm/maintenance/tickets/${selectedRequest.id}/history`);
      if (!response.ok) throw new Error('Failed to fetch ticket history');
      return response.json();
    },
    enabled: !!selectedRequest?.id && showRequestDetailsDialog
  });

  // Fetch managed properties with comprehensive data (landlord, tenant, agreement)
  const { data: managedProperties, isLoading: loadingProperties } = useQuery({
    queryKey: ['/api/crm/managed-properties'],
    queryFn: async () => {
      const response = await fetch('/api/crm/managed-properties');
      if (!response.ok) throw new Error('Failed to fetch managed properties');
      return response.json();
    }
  });

  // Dialog states for landlord/tenant cards
  const [showLandlordDialog, setShowLandlordDialog] = useState(false);
  const [showTenantDialog, setShowTenantDialog] = useState(false);
  const [showPropertyDetailsDialog, setShowPropertyDetailsDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importResults, setImportResults] = useState<any>(null);
  const [selectedLandlord, setSelectedLandlord] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [selectedManagedProperty, setSelectedManagedProperty] = useState<any>(null);

  // Maintenance form
  const maintenanceForm = useForm({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      propertyId: '',
      category: 'other' as const,
      urgency: 'routine' as const,
      title: '',
      description: '',
      location: ''
    }
  });

  // Certification form
  const certificationForm = useForm({
    resolver: zodResolver(certificationFormSchema),
    defaultValues: {
      propertyId: '',
      certificationType: 'gas_safety',
      certificateNumber: '',
      issuedBy: '',
      issuedByCompany: '',
      inspectionDate: '',
      issueDate: '',
      expiryDate: ''
    }
  });

  // Pre-populate maintenance form when property is selected from table
  useEffect(() => {
    if (selectedPropertyForMaintenance && showMaintenanceDialog) {
      maintenanceForm.setValue('propertyId', String(selectedPropertyForMaintenance.id));
    }
  }, [selectedPropertyForMaintenance, showMaintenanceDialog, maintenanceForm]);

  // Submit maintenance request
  const submitMaintenance = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/crm/maintenance/tickets', 'POST', {
        ...data,
        propertyId: Number(data.propertyId),
      });
    },
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      toast({
        title: "Maintenance request created",
        description: `AI Priority: ${response.aiAssessment?.priority || 'Medium'}. Contractor will be assigned automatically.`
      });
      setShowMaintenanceDialog(false);
      maintenanceForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to create request",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  // Add certification
  const addCertification = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/crm/certifications', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/certifications'] });
      toast({
        title: "Certification added",
        description: "Automatic reminders have been scheduled."
      });
      setShowCertificationDialog(false);
      certificationForm.reset();
    }
  });

  // Assign contractor with notification
  const assignContractor = useMutation({
    mutationFn: async ({ ticketId, contractorId, notify }: { ticketId: number; contractorId: number; notify?: boolean }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/assign-contractor`, 'POST', { contractorId, notify });
    },
    onSuccess: (data: any, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'history'] });
      toast({
        title: "Contractor assigned",
        description: data.notified ? `${data.contractor.companyName} has been notified` : `${data.contractor.companyName} assigned`
      });
      setShowContractorDialog(false);
      setSelectedTicketForContractor(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to assign contractor",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  // Update ticket status
  const updateTicketStatus = useMutation({
    mutationFn: async ({ ticketId, status, notes }: { ticketId: number; status: string; notes?: string }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/status`, 'PATCH', { status, notes });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'history'] });
      const statusLabels: Record<string, string> = {
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'closed': 'Closed'
      };
      toast({
        title: "Status updated",
        description: `Ticket marked as ${statusLabels[variables.status] || variables.status}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update status",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  // Update property marketing status (for PM properties)
  const updatePropertyStatus = useMutation({
    mutationFn: async ({ id, isListedRental, isListedSale }: { id: number; isListedRental?: boolean; isListedSale?: boolean }) => {
      return apiRequest(`/api/crm/pm/properties/${id}`, 'PATCH', { isListedRental, isListedSale });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/managed-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/properties'] });
      toast({
        title: "Property updated",
        description: "Marketing status has been updated."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update property",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    }
  });

  // Contractor selection dialog state
  const [showContractorDialog, setShowContractorDialog] = useState(false);
  const [selectedTicketForContractor, setSelectedTicketForContractor] = useState<any>(null);

  // Enhanced ticket detail state
  const [detailTab, setDetailTab] = useState('overview');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState('');
  const [approvalNotes, setApprovalNotes] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [whatsappMessage, setWhatsappMessage] = useState('');
  const [selectedContractorsForQuote, setSelectedContractorsForQuote] = useState<number[]>([]);
  const [showQuoteRequestDialog, setShowQuoteRequestDialog] = useState(false);

  // Fetch quotes for selected ticket
  const { data: ticketQuotes } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedRequest?.id, 'quotes'],
    queryFn: async () => {
      const response = await fetch(`/api/crm/maintenance/tickets/${selectedRequest.id}/quotes`);
      if (!response.ok) throw new Error('Failed to fetch quotes');
      return response.json();
    },
    enabled: !!selectedRequest?.id && showRequestDetailsDialog
  });

  // Fetch workflow events for selected ticket
  const { data: workflowEvents } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedRequest?.id, 'workflow'],
    queryFn: async () => {
      const response = await fetch(`/api/crm/maintenance/tickets/${selectedRequest.id}/workflow`);
      if (!response.ok) throw new Error('Failed to fetch workflow');
      return response.json();
    },
    enabled: !!selectedRequest?.id && showRequestDetailsDialog
  });

  // Fetch communications for selected ticket
  const { data: ticketComms } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets', selectedRequest?.id, 'communications'],
    queryFn: async () => {
      const response = await fetch(`/api/crm/maintenance/tickets/${selectedRequest.id}/communications`);
      if (!response.ok) throw new Error('Failed to fetch communications');
      return response.json();
    },
    enabled: !!selectedRequest?.id && showRequestDetailsDialog
  });

  // Quote workflow mutations
  const requestQuotesMutation = useMutation({
    mutationFn: async ({ ticketId, contractorIds }: { ticketId: number; contractorIds: number[] }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/request-quotes`, 'POST', { contractorIds });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      toast({ title: "Quote requests sent", description: "Contractors have been notified" });
      setShowQuoteRequestDialog(false);
      setSelectedContractorsForQuote([]);
    },
    onError: (error: any) => {
      toast({ title: "Failed to request quotes", description: error.message, variant: "destructive" });
    }
  });

  const approveQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, approvalNotes, scheduledDate, scheduledTimeSlot }: any) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/approve`, 'POST', {
        approvalNotes, scheduledDate, scheduledTimeSlot
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      toast({ title: "Quote approved", description: "Work has been scheduled" });
      setScheduledDate('');
      setScheduledTimeSlot('');
      setApprovalNotes('');
    },
    onError: (error: any) => {
      toast({ title: "Failed to approve quote", description: error.message, variant: "destructive" });
    }
  });

  const rejectQuoteMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/reject`, 'POST', {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      toast({ title: "Quote rejected" });
    }
  });

  const startWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/start-work`, 'POST', {});
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      toast({ title: "Work started", description: "Contractor marked as working on this job" });
    }
  });

  const completeWorkMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId, completionNotes }: { ticketId: number; quoteId: number; completionNotes: string }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/quotes/${quoteId}/complete`, 'POST', { completionNotes });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'quotes'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets'] });
      toast({ title: "Work completed", description: "Ticket has been marked as resolved" });
      setCompletionNotes('');
    }
  });

  const sendToLandlordMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/send-to-landlord`, 'POST', { quoteId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      toast({ title: "Sent to landlord", description: "Quote details sent to the property landlord for approval" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to send to landlord", description: error.message, variant: "destructive" });
    }
  });

  const createPaymentMutation = useMutation({
    mutationFn: async ({ ticketId, quoteId }: { ticketId: number; quoteId: number }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/create-payment`, 'POST', { quoteId });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      toast({ title: "Payment created", description: "Payment has been recorded for this work" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to create payment", description: error.message, variant: "destructive" });
    }
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async ({ ticketId, message, phoneNumber }: { ticketId: number; message: string; phoneNumber: string }) => {
      return apiRequest(`/api/crm/maintenance/tickets/${ticketId}/send-whatsapp`, 'POST', { message, phoneNumber });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'workflow'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/maintenance/tickets', variables.ticketId, 'history'] });
      toast({ title: "Message sent", description: "WhatsApp message logged" });
      setWhatsappMessage('');
    },
    onError: (error: any) => {
      toast({ title: "Failed to send message", description: error.message, variant: "destructive" });
    }
  });

  // Import managed properties mutation
  const importProperties = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/crm/managed-properties/import', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Import failed');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/managed-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      setImportResults(data);
      toast({
        title: "Import complete",
        description: `Successfully imported ${data.successCount} properties`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error.message || "Please check your CSV file and try again",
        variant: "destructive"
      });
    }
  });

  // Handle import file selection and upload
  const handleImport = async () => {
    if (!importFile) return;
    importProperties.mutate(importFile);
  };

  // Download import template
  const downloadTemplate = () => {
    window.open('/api/crm/managed-properties/template', '_blank');
  };

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const days = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return days;
  };

  // Get maintenance stats
  const getMaintenanceStats = () => {
    if (!maintenanceRequests) return { total: 0, emergency: 0, inProgress: 0, completed: 0 };

    return {
      total: maintenanceRequests.length,
      emergency: maintenanceRequests.filter((r: any) => r.priority === 'emergency').length,
      inProgress: maintenanceRequests.filter((r: any) => r.status === 'in_progress').length,
      completed: maintenanceRequests.filter((r: any) => r.status === 'completed').length
    };
  };

  // Get certification stats
  const getCertificationStats = () => {
    if (!certifications) return { total: 0, expiringSoon: 0, expired: 0 };

    const expiringSoon = certifications.filter((c: any) => {
      const days = getDaysUntilExpiry(c.expiryDate);
      return days > 0 && days <= 30;
    }).length;

    const expired = certifications.filter((c: any) => {
      const days = getDaysUntilExpiry(c.expiryDate);
      return days <= 0;
    }).length;

    return {
      total: certifications.length,
      expiringSoon,
      expired
    };
  };

  const maintenanceStats = getMaintenanceStats();
  const certStats = getCertificationStats();

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Property Management</h1>
        <div className="flex gap-2">
          <Link href="/crm/properties/import">
            <Button variant="outline" className="bg-green-50 border-green-200 text-green-700 hover:bg-green-100">
              <ExternalLink className="h-4 w-4 mr-2" />
              Import from URL
            </Button>
          </Link>
          <Button onClick={() => setShowImportDialog(true)} variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setShowMaintenanceDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Report Maintenance
          </Button>
          <Button onClick={() => setShowCertificationDialog(true)} variant="outline">
            <Shield className="h-4 w-4 mr-2" />
            Add Certification
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Maintenance</p>
                <p className="text-2xl font-bold">{maintenanceStats.total}</p>
                {maintenanceStats.emergency > 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    {maintenanceStats.emergency} Emergency
                  </p>
                )}
              </div>
              <Wrench className="h-8 w-8 text-[#791E75]500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">In Progress</p>
                <p className="text-2xl font-bold">{maintenanceStats.inProgress}</p>
                <Progress value={(maintenanceStats.inProgress / maintenanceStats.total) * 100} className="mt-2" />
              </div>
              <Clock className="h-8 w-8 text-[#F8B324]500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Certifications</p>
                <p className="text-2xl font-bold">{certStats.total}</p>
                {certStats.expired > 0 && (
                  <p className="text-sm text-red-500 mt-1">
                    {certStats.expired} Expired!
                  </p>
                )}
              </div>
              <Shield className="h-8 w-8 text-[#791E75]500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Expiring Soon</p>
                <p className="text-2xl font-bold">{certStats.expiringSoon}</p>
                <p className="text-sm text-[#F8B324]600 mt-1">Next 30 days</p>
              </div>
              <AlertCircle className="h-8 w-8 text-[#F8B324]500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="properties" className="space-y-4">
        <TabsList>
          <TabsTrigger value="properties">
            <Home className="h-4 w-4 mr-2" />
            Managed Properties
          </TabsTrigger>
          <TabsTrigger value="maintenance">
            <Wrench className="h-4 w-4 mr-2" />
            Maintenance Requests
          </TabsTrigger>
          <TabsTrigger value="certifications">
            <Shield className="h-4 w-4 mr-2" />
            Certifications
          </TabsTrigger>
          <TabsTrigger value="contractors">
            <Users className="h-4 w-4 mr-2" />
            Contractors
          </TabsTrigger>
          <TabsTrigger value="inspections">
            <Eye className="h-4 w-4 mr-2" />
            Inspections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-4">
          {loadingProperties ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : managedProperties?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Home className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No managed properties found</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  Managed Properties ({managedProperties?.length || 0})
                </CardTitle>
                <CardDescription>Properties currently under management with landlord, tenant and agreement details</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="w-full">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Property Address</TableHead>
                        <TableHead className="min-w-[150px]">Landlord</TableHead>
                        <TableHead className="min-w-[150px]">Tenant</TableHead>
                        <TableHead className="min-w-[80px]">Checklist</TableHead>
                        <TableHead className="min-w-[100px]">Mgmt Fee</TableHead>
                        <TableHead className="min-w-[100px]">Mgmt Period</TableHead>
                        <TableHead className="min-w-[100px]">Rent</TableHead>
                        <TableHead className="min-w-[100px]">Deposit</TableHead>
                        <TableHead className="min-w-[120px]">Marketing Status</TableHead>
                        <TableHead className="min-w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managedProperties?.map((property: any) => (
                        <TableRow key={property.id} data-testid={`row-managed-property-${property.id}`}>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Link href={`/crm/managed-property/${property.id}`} className="hover:underline cursor-pointer block">
                                <span className="font-medium text-sm text-[#791E75]" data-testid={`text-address-${property.id}`}>
                                  {(() => {
                                    // Format: Unit/Flat, Street Number Street Name, Postcode
                                    const addr = property.propertyAddress || property.address || '';
                                    const line1 = property.addressLine1 || '';
                                    const line2 = property.addressLine2 || '';
                                    const postcode = property.postcode || '';

                                    // Build formatted address
                                    let formatted = '';
                                    if (line1) {
                                      formatted = line1;
                                      if (line2) formatted += `, ${line2}`;
                                    } else {
                                      // Extract from full address - remove postcode and city
                                      formatted = addr
                                        .replace(new RegExp(postcode, 'i'), '')
                                        .replace(/,?\s*(London|UK|United Kingdom)\s*,?/gi, '')
                                        .trim()
                                        .replace(/,\s*$/, '');
                                    }

                                    return formatted || addr;
                                  })()}
                                </span>
                              </Link>

                              {/* Postcode on separate line */}
                              <span className="text-xs font-mono text-gray-600">
                                {property.postcode}
                              </span>

                              {/* Property type with bedrooms */}
                              <span className="text-xs text-muted-foreground" data-testid={`text-property-type-${property.id}`}>
                                {property.bedrooms ? `${property.bedrooms} bed` : ''} {property.propertyType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {property.landlordId ? (
                              <Link href={`/crm/landlords/${property.landlordId}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-1 text-left justify-start"
                                  data-testid={`button-landlord-${property.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-[#791E75]" />
                                    <span className="text-sm font-medium hover:underline">{property.landlordName}</span>
                                  </div>
                                </Button>
                              </Link>
                            ) : (
                              <Badge variant="outline" className="text-xs">No landlord</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {property.tenantId ? (
                              <Link href={`/crm/tenant/${property.tenantId}`}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-auto p-1 text-left justify-start w-full hover:bg-gray-100/50"
                                  data-testid={`button-tenant-${property.id}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <Users className="h-4 w-4 text-green-600" />
                                    <span className="text-sm font-medium text-green-700 hover:underline">
                                      {property.tenantName || 'Active Tenant'}
                                    </span>
                                  </div>
                                </Button>
                              </Link>
                            ) : (
                              <Badge variant="outline" className="text-xs">No tenant</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Link href={`/crm/managed-property/${property.id}?tab=checklist`}>
                              <div className="flex flex-col gap-1 cursor-pointer hover:bg-gray-50 rounded p-1 -m-1" data-testid={`checklist-${property.id}`}>
                                <div className="flex items-center gap-1">
                                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                                  <span className="text-xs" data-testid={`text-checklist-count-${property.id}`}>{property.checklistComplete}/{property.checklistTotal}</span>
                                </div>
                                <Progress value={property.checklistTotal > 0 ? (property.checklistComplete / property.checklistTotal) * 100 : 0} className="h-1.5 w-16" />
                              </div>
                            </Link>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm" data-testid={`text-mgmt-fee-${property.id}`}>
                              {property.managementFeePercent
                                ? `${property.managementFeePercent}%`
                                : property.managementFeeFixed
                                  ? `£${property.managementFeeFixed}`
                                  : '-'
                              }
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs" data-testid={`text-mgmt-period-${property.id}`}>
                              <div>{property.managementPeriod}</div>
                              {property.managementStartDate && (
                                <div className="text-muted-foreground">
                                  {format(new Date(property.managementStartDate), 'dd MMM yy')}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col" data-testid={`text-rent-${property.id}`}>
                              <span className="text-sm font-medium text-[#791E75]">
                                £{property.rentAmount?.toLocaleString()}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {property.rentFrequency || 'Monthly'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col" data-testid={`text-deposit-${property.id}`}>
                              <span className="text-sm">£{property.depositAmount?.toLocaleString()}</span>
                              <span className="text-xs text-muted-foreground">{property.depositHeldBy}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={property.isListedSale ? 'for_sale' : property.isListedRental ? 'for_rent' : 'not_listed'}
                              onValueChange={(value) => {
                                if (value === 'not_listed') {
                                  updatePropertyStatus.mutate({ id: property.id, isListedRental: false, isListedSale: false });
                                } else if (value === 'for_sale') {
                                  updatePropertyStatus.mutate({ id: property.id, isListedRental: false, isListedSale: true });
                                } else if (value === 'for_rent') {
                                  updatePropertyStatus.mutate({ id: property.id, isListedRental: true, isListedSale: false });
                                }
                              }}
                            >
                              <SelectTrigger className="h-8 w-[110px] text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="not_listed">Not Listed</SelectItem>
                                <SelectItem value="for_sale">For Sale</SelectItem>
                                <SelectItem value="for_rent">For Rent</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedManagedProperty(property);
                                  setShowPropertyDetailsDialog(true);
                                }}
                                data-testid={`button-view-details-${property.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setSelectedPropertyForMaintenance(property);
                                  setShowMaintenanceDialog(true);
                                }}
                                data-testid={`button-maintenance-${property.id}`}
                              >
                                <Wrench className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="maintenance" className="space-y-4">
          {loadingMaintenance ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {maintenanceRequests?.map((request: any) => (
                <Card key={request.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{request.title}</CardTitle>
                        <CardDescription>
                          Property: {request.propertyAddress || `#${request.propertyId}`} |
                          Reported: {request.createdAt ? format(new Date(request.createdAt), 'dd MMM yyyy') : 'N/A'}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <PriorityBadge priority={request.urgency || request.priority} />
                        <Badge variant="outline">{request.status}</Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <p className="text-sm">{request.description}</p>

                      {request.aiCategory && (
                        <div className="flex gap-2 items-center text-sm">
                          <Badge variant="secondary">AI: {request.aiCategory}</Badge>
                          {request.aiSuggestedContractor && (
                            <span className="text-gray-500">
                              Suggested: {request.aiSuggestedContractor}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Contractor & Property Manager Info */}
                      <div className="flex flex-wrap gap-4 text-sm border-t pt-3">
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Contractor:</span>
                          {request.assignedContractor ? (
                            <span className="font-medium" data-testid={`text-contractor-${request.id}`}>
                              {request.assignedContractor.companyName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Not assigned</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <UserCheck className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">Manager:</span>
                          {request.propertyManager ? (
                            <span className="font-medium" data-testid={`text-property-manager-${request.id}`}>
                              {request.propertyManager.fullName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground italic">Not assigned</span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="text-sm text-gray-500">
                          {request.location && <span>Location: {request.location}</span>}
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {/* Notify/Assign Contractor button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTicketForContractor(request);
                              setShowContractorDialog(true);
                            }}
                            data-testid={`button-notify-contractor-${request.id}`}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            {request.assignedContractor ? 'Change Contractor' : 'Assign Contractor'}
                          </Button>

                          {/* Status action buttons */}
                          {request.status !== 'in_progress' && request.status !== 'completed' && request.status !== 'closed' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => updateTicketStatus.mutate({ ticketId: request.id, status: 'in_progress' })}
                              disabled={updateTicketStatus.isPending}
                              data-testid={`button-mark-inprogress-${request.id}`}
                            >
                              <Clock className="h-4 w-4 mr-1" />
                              Mark In Progress
                            </Button>
                          )}

                          {request.status !== 'completed' && request.status !== 'closed' && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => updateTicketStatus.mutate({ ticketId: request.id, status: 'completed' })}
                              disabled={updateTicketStatus.isPending}
                              data-testid={`button-mark-complete-${request.id}`}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Mark Complete
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedRequest(request);
                              setShowRequestDetailsDialog(true);
                            }}
                            data-testid={`button-view-ticket-${request.id}`}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View Details
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="certifications" className="space-y-4">
          {loadingCertifications ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {certifications?.map((cert: any) => {
                const daysUntilExpiry = getDaysUntilExpiry(cert.expiryDate);

                return (
                  <Card key={cert.id} className={daysUntilExpiry <= 0 ? 'border-red-500' : ''}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base">
                          {cert.certificationType.replace(/_/g, ' ').toUpperCase()}
                        </CardTitle>
                        <CertificationStatusBadge
                          status={cert.status}
                          daysUntilExpiry={daysUntilExpiry}
                        />
                      </div>
                      <CardDescription>
                        Property: {cert.propertyAddress || `#${cert.propertyId}`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-500">Certificate #:</span> {cert.certificateNumber}
                        </div>
                        <div>
                          <span className="text-gray-500">Issued by:</span> {cert.issuedBy}
                        </div>
                        <div>
                          <span className="text-gray-500">Expires:</span> {' '}
                          <span className={daysUntilExpiry <= 30 ? 'text-red-500 font-semibold' : ''}>
                            {format(new Date(cert.expiryDate), 'dd MMM yyyy')}
                          </span>
                        </div>

                        <div className="flex gap-2 pt-2">
                          {cert.certificateUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedCertification(cert);
                                setShowCertDetailsDialog(true);
                              }}
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          )}
                          {daysUntilExpiry <= 60 && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => {
                                setSelectedCertification(cert);
                                setShowRenewalDialog(true);
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Book Renewal
                            </Button>
                          )}
                        </div>

                        {/* Reminder status */}
                        <div className="pt-2">
                          {cert.firstReminderSent && <Badge variant="outline" className="mr-1">60-day sent</Badge>}
                          {cert.secondReminderSent && <Badge variant="outline" className="mr-1">30-day sent</Badge>}
                          {cert.finalReminderSent && <Badge variant="outline" className="mr-1">7-day sent</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="contractors">
          <Card>
            <CardHeader>
              <CardTitle>Contractor Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {contractors?.map((contractor: any) => (
                  <div key={contractor.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{contractor.companyName}</p>
                        <p className="text-sm text-gray-500">
                          {contractor.contactName} | {contractor.phone}
                        </p>
                        <div className="flex gap-2 mt-2">
                          {contractor.specializations?.map((spec: string) => (
                            <Badge key={spec} variant="secondary">{spec}</Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        {contractor.availableEmergency && (
                          <Badge className="bg-red-500">24/7 Emergency</Badge>
                        )}
                        <p className="text-sm mt-1">
                          Response: {contractor.responseTime || 'Standard'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="inspections">
          <Card>
            <CardHeader>
              <CardTitle>Property Inspections</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Inspection reports will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Maintenance Request Dialog */}
      <Dialog open={showMaintenanceDialog} onOpenChange={(open) => {
        setShowMaintenanceDialog(open);
        if (!open) {
          setSelectedPropertyForMaintenance(null);
          setPropertySelectOpen(false);
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report Maintenance Issue</DialogTitle>
          </DialogHeader>
          <Form {...maintenanceForm}>
            <form onSubmit={maintenanceForm.handleSubmit((data) => submitMaintenance.mutate(data))}
              className="space-y-4">
              <FormField
                control={maintenanceForm.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Property</FormLabel>
                    <Popover open={propertySelectOpen} onOpenChange={setPropertySelectOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={propertySelectOpen}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? (() => {
                                  const prop = managedProperties?.find((p: any) => String(p.id) === field.value);
                                  // Try all possible address field names - addressLine1 for first line, propertyAddress as computed fallback
                                  const addr = prop?.addressLine1 || prop?.propertyAddress || prop?.address || prop?.address_line1;
                                  // Remove postcode from address if present (keep just street address)
                                  if (addr && prop?.postcode) {
                                    return addr.replace(new RegExp(`,?\\s*${prop.postcode}.*$`, 'i'), '').trim();
                                  }
                                  return addr || "Select property...";
                                })()
                              : "Select property..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[350px] p-0">
                        <Command>
                          <CommandInput placeholder="Search properties..." />
                          <CommandList>
                            <CommandEmpty>No property found.</CommandEmpty>
                            <CommandGroup>
                              {managedProperties?.map((property: any) => (
                                <CommandItem
                                  key={property.id}
                                  value={`${property.address || property.addressLine1 || ''} ${property.postcode || ''}`}
                                  onSelect={() => {
                                    field.onChange(String(property.id));
                                    setSelectedPropertyForMaintenance(property);
                                    setPropertySelectOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === String(property.id) ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">
                                      {property.addressLine1 || property.address || property.address_line1 || `Property #${property.id}`}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {property.postcode} {property.landlordName ? `• ${property.landlordName}` : ''}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
                      <FormLabel>Issue Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
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
                    </FormItem>
                  )}
                />
                <FormField
                  control={maintenanceForm.control}
                  name="urgency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Priority</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="emergency">Emergency</SelectItem>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="routine">Routine</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={maintenanceForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issue Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Textarea placeholder="Detailed description of the issue..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={maintenanceForm.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Kitchen, Bathroom, Bedroom 2" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="bg-[#791E75] text-white 50 p-3 rounded-lg text-sm">
                <p className="font-semibold text-[#791E75]800">AI Assistance</p>
                <p className="text-[#791E75]600">Our AI will automatically categorize this issue, assess priority, and suggest the best contractor type.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowMaintenanceDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitMaintenance.isPending}>
                  {submitMaintenance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Request
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Certification Dialog */}
      <Dialog open={showCertificationDialog} onOpenChange={setShowCertificationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Property Certification</DialogTitle>
          </DialogHeader>
          <Form {...certificationForm}>
            <form onSubmit={certificationForm.handleSubmit((data) => addCertification.mutate(data))}
              className="space-y-4">
              <FormField
                control={certificationForm.control}
                name="propertyId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <FormControl>
                      <Input placeholder="Property ID or Address" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={certificationForm.control}
                name="certificationType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certification Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="gas_safety">Gas Safety Certificate</SelectItem>
                        <SelectItem value="electrical_safety">Electrical Safety Certificate</SelectItem>
                        <SelectItem value="epc">Energy Performance Certificate</SelectItem>
                        <SelectItem value="eicr">EICR</SelectItem>
                        <SelectItem value="fire_safety">Fire Safety Certificate</SelectItem>
                        <SelectItem value="legionella">Legionella Risk Assessment</SelectItem>
                        <SelectItem value="asbestos">Asbestos Survey</SelectItem>
                        <SelectItem value="hmo_license">HMO License</SelectItem>
                        <SelectItem value="selective_license">Selective License</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={certificationForm.control}
                name="certificateNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Certificate Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Certificate reference number" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={certificationForm.control}
                name="issuedBy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Issued By</FormLabel>
                    <FormControl>
                      <Input placeholder="Inspector/Engineer name" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={certificationForm.control}
                name="issuedByCompany"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company</FormLabel>
                    <FormControl>
                      <Input placeholder="Inspection company" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-3 gap-2">
                <FormField
                  control={certificationForm.control}
                  name="inspectionDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Inspection Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={certificationForm.control}
                  name="issueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Issue Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={certificationForm.control}
                  name="expiryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expiry Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <div className="bg-[#791E75] text-white 50 p-3 rounded-lg text-sm">
                <p className="font-semibold text-[#791E75]800">Automatic Reminders</p>
                <p className="text-[#791E75]600">We'll automatically send reminders at 60, 30, and 7 days before expiry to landlords, agents, and tenants.</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowCertificationDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addCertification.isPending}>
                  {addCertification.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Certification
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Enhanced Maintenance Request Details Dialog */}
      <Dialog open={showRequestDetailsDialog} onOpenChange={(open) => {
        setShowRequestDetailsDialog(open);
        if (!open) setDetailTab('overview');
      }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Maintenance Ticket #{selectedRequest?.id}</span>
              {selectedRequest && (
                <div className="flex gap-2">
                  <PriorityBadge priority={selectedRequest.urgency || selectedRequest.priority} />
                  <Badge variant="outline">{selectedRequest.status}</Badge>
                </div>
              )}
            </DialogTitle>
            {selectedRequest && (
              <DialogDescription>{selectedRequest.title}</DialogDescription>
            )}
          </DialogHeader>
          {selectedRequest && (
            <Tabs value={detailTab} onValueChange={setDetailTab} className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full grid grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="quotes">
                  Quotes {ticketQuotes?.length > 0 && <Badge variant="secondary" className="ml-1 text-xs h-5">{ticketQuotes.length}</Badge>}
                </TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="communications">Comms</TabsTrigger>
              </TabsList>

              {/* Tab 1: Overview */}
              <TabsContent value="overview" className="flex-1 overflow-auto mt-4">
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Property:</span>
                        <p className="font-medium">{selectedRequest.propertyAddress || `#${selectedRequest.propertyId}`}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Location:</span>
                        <p className="font-medium">{selectedRequest.location || 'Not specified'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Category:</span>
                        <p className="font-medium capitalize">{selectedRequest.category || selectedRequest.issueType || 'N/A'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Reported:</span>
                        <p className="font-medium">{selectedRequest.createdAt ? format(new Date(selectedRequest.createdAt), 'dd MMM yyyy HH:mm') : 'N/A'}</p>
                      </div>
                    </div>

                    <div>
                      <span className="text-gray-500 text-sm">Description:</span>
                      <p className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">{selectedRequest.description}</p>
                    </div>

                    {selectedRequest.tenantName && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-2">Tenant Information</h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Name:</span>
                            <p className="font-medium">{selectedRequest.tenantName}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Phone:</span>
                            <p className="font-medium">{selectedRequest.tenantPhone || 'N/A'}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Email:</span>
                            <p className="font-medium">{selectedRequest.tenantEmail || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {selectedRequest.aiCategory && (
                      <div className="border-t pt-4">
                        <h4 className="font-medium mb-2">AI Assessment</h4>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant="secondary">Category: {selectedRequest.aiCategory}</Badge>
                          {selectedRequest.aiSuggestedContractor && (
                            <Badge variant="outline">Suggested: {selectedRequest.aiSuggestedContractor}</Badge>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Assigned Contractor Section */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Wrench className="h-4 w-4" />
                        Assigned Contractor
                      </h4>
                      {selectedRequest.assignedContractor ? (
                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 rounded-lg p-3">
                          <div>
                            <span className="text-muted-foreground">Company:</span>
                            <p className="font-medium">{selectedRequest.assignedContractor.companyName}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Contact:</span>
                            <p className="font-medium">{selectedRequest.assignedContractor.contactName || 'N/A'}</p>
                          </div>
                          {selectedRequest.assignedContractor.phone && (
                            <div>
                              <span className="text-muted-foreground">Phone:</span>
                              <p className="font-medium">{selectedRequest.assignedContractor.phone}</p>
                            </div>
                          )}
                          {selectedRequest.assignedContractor.email && (
                            <div>
                              <span className="text-muted-foreground">Email:</span>
                              <p className="font-medium">{selectedRequest.assignedContractor.email}</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-sm">No contractor assigned yet</p>
                      )}
                    </div>

                    {/* Property Manager Section */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <UserCheck className="h-4 w-4" />
                        Property Manager
                      </h4>
                      {selectedRequest.propertyManager ? (
                        <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 rounded-lg p-3">
                          <div>
                            <span className="text-muted-foreground">Name:</span>
                            <p className="font-medium">{selectedRequest.propertyManager.fullName}</p>
                          </div>
                          {selectedRequest.propertyManager.phone && (
                            <div>
                              <span className="text-muted-foreground">Phone:</span>
                              <p className="font-medium">{selectedRequest.propertyManager.phone}</p>
                            </div>
                          )}
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Email:</span>
                            <p className="font-medium">{selectedRequest.propertyManager.email || 'N/A'}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-sm">No property manager assigned</p>
                      )}
                    </div>

                    {/* Activity History */}
                    <div className="border-t pt-4">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Activity History
                      </h4>
                      {ticketHistory && ticketHistory.length > 0 ? (
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {ticketHistory.map((update: any, index: number) => (
                            <div key={update.id || index} className="flex gap-3 text-sm p-2 bg-muted/30 rounded-lg">
                              <div className="flex-shrink-0">
                                {update.updateType === 'status_change' && <AlertCircle className="h-4 w-4 text-blue-500" />}
                                {update.updateType === 'assignment' && <UserCheck className="h-4 w-4 text-green-500" />}
                                {update.updateType === 'comment' && <FileText className="h-4 w-4 text-gray-500" />}
                                {update.updateType === 'cost_update' && <PoundSterling className="h-4 w-4 text-purple-500" />}
                              </div>
                              <div className="flex-1">
                                <p className="font-medium">{update.message}</p>
                                <p className="text-muted-foreground text-xs">
                                  {update.userName} - {update.createdAt ? format(new Date(update.createdAt), 'dd MMM yyyy HH:mm') : 'N/A'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-muted-foreground italic text-sm">No activity recorded yet</p>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 2: Quotes & Payment */}
              <TabsContent value="quotes" className="flex-1 overflow-auto mt-4">
                <ScrollArea className="h-[500px] pr-2">
                  <div className="space-y-4">
                    {/* Request Quotes Button */}
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium flex items-center gap-2">
                        <PoundSterling className="h-4 w-4" />
                        Contractor Quotes
                      </h4>
                      <Button
                        size="sm"
                        onClick={() => setShowQuoteRequestDialog(true)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Request Quotes
                      </Button>
                    </div>

                    {/* Quote Request Dialog (inline) */}
                    {showQuoteRequestDialog && (() => {
                      const categoryToSpecs: Record<string, string[]> = {
                        'plumbing': ['plumbing', 'plumbing/gas', 'gas'],
                        'electrical': ['electrical', 'electrician', 'electrician(epcs)'],
                        'heating': ['heating', 'gas', 'plumbing/gas', 'boiler'],
                        'appliance': ['appliance', 'appliance engineer'],
                        'structural': ['structural', 'building', 'handyman', 'handyman/roofer', 'roofing'],
                        'other': ['handyman', 'general'],
                      };
                      const cat = (selectedRequest.category || selectedRequest.aiCategorization || 'other').toLowerCase();
                      const relevantSpecs = categoryToSpecs[cat] || categoryToSpecs['other'];
                      const isMatch = (c: any) => c.specializations?.some((s: string) =>
                        relevantSpecs.some(rs => s.toLowerCase().includes(rs) || rs.includes(s.toLowerCase()))
                      );
                      const matched = contractors?.filter(isMatch) || [];
                      const others = contractors?.filter((c: any) => !isMatch(c)) || [];

                      return (
                        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-center">
                            <p className="text-sm font-medium">Select contractors to request quotes from:</p>
                            <Button variant="ghost" size="sm" onClick={() => {
                              setShowQuoteRequestDialog(false);
                              setSelectedContractorsForQuote([]);
                            }}>Cancel</Button>
                          </div>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {matched.length > 0 && <p className="text-xs font-medium text-green-700">Recommended for {cat}:</p>}
                            {[...matched, ...others].map((c: any) => (
                              <label key={c.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-white ${
                                selectedContractorsForQuote.includes(c.id) ? 'bg-white border-2 border-[#791E75]' : 'border border-gray-200'
                              } ${isMatch(c) ? 'border-green-300' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={selectedContractorsForQuote.includes(c.id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedContractorsForQuote(prev => [...prev, c.id]);
                                    } else {
                                      setSelectedContractorsForQuote(prev => prev.filter(id => id !== c.id));
                                    }
                                  }}
                                  className="rounded"
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{c.companyName}</p>
                                  <div className="flex gap-1 flex-wrap">
                                    {c.specializations?.slice(0, 3).map((s: string) => (
                                      <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                                    ))}
                                  </div>
                                </div>
                              </label>
                            ))}
                          </div>
                          <Button
                            className="w-full"
                            disabled={selectedContractorsForQuote.length === 0 || requestQuotesMutation.isPending}
                            onClick={() => requestQuotesMutation.mutate({
                              ticketId: selectedRequest.id,
                              contractorIds: selectedContractorsForQuote
                            })}
                          >
                            {requestQuotesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Request Quotes from {selectedContractorsForQuote.length} Contractor{selectedContractorsForQuote.length !== 1 ? 's' : ''}
                          </Button>
                        </div>
                      );
                    })()}

                    {/* Quote Cards */}
                    {ticketQuotes && ticketQuotes.length > 0 ? (
                      <div className="space-y-3">
                        {ticketQuotes.map((quote: any) => (
                          <div key={quote.id} className={`bg-white rounded-lg border p-4 ${
                            quote.status === 'quoted' ? 'border-blue-300 shadow-sm' : ''
                          }`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="font-medium">{quote.contractor?.companyName || `Contractor #${quote.contractorId}`}</p>
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

                            {/* Send to Landlord button */}
                            {(quote.status === 'quoted' || quote.status === 'accepted') && (
                              <div className="mb-3">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full border-[#791E75] text-[#791E75] hover:bg-[#791E75]/10"
                                  onClick={() => sendToLandlordMutation.mutate({ ticketId: selectedRequest.id, quoteId: quote.id })}
                                  disabled={sendToLandlordMutation.isPending}
                                >
                                  <Mail className="h-4 w-4 mr-2" />
                                  Send Quote to Landlord
                                </Button>
                              </div>
                            )}

                            {/* Quote Actions */}
                            {quote.status === 'quoted' || quote.status === 'accepted' ? (
                              <div className="space-y-3 border-t pt-3 mt-3">
                                <p className="text-xs text-blue-600 font-medium">Schedule work - tenant will be notified of date only</p>
                                <div className="flex gap-2">
                                  <Input
                                    type="date"
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
                                      ticketId: selectedRequest.id,
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
                                      ticketId: selectedRequest.id,
                                      quoteId: quote.id
                                    })}
                                    disabled={rejectQuoteMutation.isPending}
                                  >
                                    <ThumbsDown className="h-4 w-4 mr-2" />
                                    Reject
                                  </Button>
                                </div>
                              </div>
                            ) : quote.status === 'scheduled' || quote.status === 'approved' ? (
                              <div className="space-y-3 border-t pt-3 mt-3">
                                {/* Create Payment button */}
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => createPaymentMutation.mutate({ ticketId: selectedRequest.id, quoteId: quote.id })}
                                  disabled={createPaymentMutation.isPending}
                                >
                                  <CreditCard className="h-4 w-4 mr-2" />
                                  Create Payment (£{quote.quoteAmount ? (quote.quoteAmount / 100).toFixed(2) : '0.00'})
                                </Button>
                                <Button
                                  className="w-full bg-orange-600 hover:bg-orange-700"
                                  onClick={() => startWorkMutation.mutate({ ticketId: selectedRequest.id, quoteId: quote.id })}
                                  disabled={startWorkMutation.isPending}
                                >
                                  <Hammer className="h-4 w-4 mr-2" />
                                  Mark Work Started
                                </Button>
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
                                    ticketId: selectedRequest.id,
                                    quoteId: quote.id,
                                    completionNotes
                                  })}
                                  disabled={completeWorkMutation.isPending}
                                >
                                  <CheckCircle className="h-4 w-4 mr-2" />
                                  Mark Work Completed
                                </Button>
                                <p className="text-xs text-gray-500">Tenant will be notified that work is complete</p>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : !showQuoteRequestDialog ? (
                      <div className="text-center py-8 text-gray-500">
                        <PoundSterling className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        <p>No quotes yet</p>
                        <p className="text-sm mt-1">Request quotes from contractors to get started</p>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 3: Timeline */}
              <TabsContent value="timeline" className="flex-1 overflow-auto mt-4">
                <ScrollArea className="h-[500px] pr-2">
                  <div className="relative">
                    <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                    <div className="space-y-4">
                      {workflowEvents && workflowEvents.length > 0 ? (
                        workflowEvents.map((event: any) => (
                          <div key={event.id} className="relative pl-10">
                            <div className={`absolute left-2 w-5 h-5 rounded-full flex items-center justify-center ${
                              event.eventType?.includes('completed') ? 'bg-green-500' :
                              event.eventType?.includes('rejected') || event.eventType?.includes('declined') ? 'bg-red-500' :
                              event.eventType?.includes('approved') || event.eventType?.includes('scheduled') ? 'bg-purple-500' :
                              event.eventType?.includes('started') ? 'bg-orange-500' :
                              event.eventType?.includes('quote') || event.eventType?.includes('accepted') ? 'bg-blue-500' :
                              event.eventType?.includes('payment') ? 'bg-emerald-500' :
                              event.eventType?.includes('landlord') ? 'bg-indigo-500' :
                              'bg-gray-400'
                            }`}>
                              {event.eventType?.includes('completed') ? <CheckCircle className="h-3 w-3 text-white" /> :
                               event.eventType?.includes('rejected') ? <XCircle className="h-3 w-3 text-white" /> :
                               event.eventType?.includes('scheduled') ? <Calendar className="h-3 w-3 text-white" /> :
                               event.eventType?.includes('started') ? <Hammer className="h-3 w-3 text-white" /> :
                               event.eventType?.includes('payment') ? <CreditCard className="h-3 w-3 text-white" /> :
                               <CircleDot className="h-3 w-3 text-white" />}
                            </div>
                            <div className="bg-white rounded-lg p-3 shadow-sm border">
                              <div className="flex justify-between items-start">
                                <p className="font-medium text-sm">{event.title}</p>
                                <span className="text-xs text-gray-400">
                                  {event.createdAt ? new Date(event.createdAt).toLocaleString('en-GB', {
                                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                                  }) : ''}
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
                        <div className="pl-10">
                          <div className="relative">
                            <div className="absolute left-[-22px] w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                              <CircleDot className="h-3 w-3 text-white" />
                            </div>
                          </div>
                          <div className="bg-white rounded-lg p-3 shadow-sm border">
                            <p className="font-medium text-sm">Ticket Created</p>
                            <p className="text-xs text-gray-400">{selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString('en-GB') : 'N/A'}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Tab 4: Communications */}
              <TabsContent value="communications" className="flex-1 overflow-hidden mt-4 flex flex-col">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 mb-4">
                  <strong>All messages sent from here go to the tenant.</strong> Contractor communications are handled via the Quotes tab.
                </div>

                <ScrollArea className="flex-1 h-[350px]">
                  <div className="space-y-3">
                    {ticketComms && ticketComms.length > 0 ? (
                      ticketComms.map((comm: any) => (
                        <div
                          key={comm.id}
                          className={`p-3 rounded-lg ${comm.direction === 'inbound' ? 'bg-gray-100 ml-0 mr-12' : 'bg-[#791E75]/10 ml-12 mr-0'}`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {comm.channel === 'whatsapp' && <MessageCircle className="h-3 w-3 text-green-600" />}
                            {comm.channel === 'email' && <Mail className="h-3 w-3 text-blue-600" />}
                            {comm.channel === 'phone' && <Phone className="h-3 w-3 text-gray-600" />}
                            {comm.channel === 'sms' && <MessageCircle className="h-3 w-3 text-purple-600" />}
                            <span className="text-xs text-gray-500 capitalize">{comm.channel || 'message'}</span>
                            <span className="text-xs text-gray-400">
                              {comm.timestamp ? new Date(comm.timestamp).toLocaleString('en-GB') :
                               comm.createdAt ? new Date(comm.createdAt).toLocaleString('en-GB') : ''}
                            </span>
                            {comm.direction === 'outbound' && (
                              <Badge variant="outline" className="text-xs">From Property Management</Badge>
                            )}
                          </div>
                          <p className="text-sm">{comm.content || comm.body}</p>
                        </div>
                      ))
                    ) : (
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
                        ticketId: selectedRequest.id,
                        message: whatsappMessage,
                        phoneNumber: selectedRequest.tenantPhone || ''
                      })}
                      disabled={!whatsappMessage || sendWhatsAppMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <MessageCircle className="h-4 w-4 mr-2" />
                      Send
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Certificate Details Dialog */}
      <Dialog open={showCertDetailsDialog} onOpenChange={setShowCertDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Certificate Details</DialogTitle>
          </DialogHeader>
          {selectedCertification && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-lg">
                  {selectedCertification.certificationType.replace(/_/g, ' ').toUpperCase()}
                </h3>
                <CertificationStatusBadge
                  status={selectedCertification.status}
                  daysUntilExpiry={getDaysUntilExpiry(selectedCertification.expiryDate)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Property:</span>
                  <p className="font-medium">{selectedCertification.propertyAddress || `#${selectedCertification.propertyId}`}</p>
                </div>
                <div>
                  <span className="text-gray-500">Certificate #:</span>
                  <p className="font-medium">{selectedCertification.certificateNumber}</p>
                </div>
                <div>
                  <span className="text-gray-500">Issued By:</span>
                  <p className="font-medium">{selectedCertification.issuedBy}</p>
                </div>
                <div>
                  <span className="text-gray-500">Company:</span>
                  <p className="font-medium">{selectedCertification.issuedByCompany}</p>
                </div>
                <div>
                  <span className="text-gray-500">Inspection Date:</span>
                  <p className="font-medium">{selectedCertification.inspectionDate ? format(new Date(selectedCertification.inspectionDate), 'dd MMM yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Issue Date:</span>
                  <p className="font-medium">{selectedCertification.issueDate ? format(new Date(selectedCertification.issueDate), 'dd MMM yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <span className="text-gray-500">Expiry Date:</span>
                  <p className="font-medium">{selectedCertification.expiryDate ? format(new Date(selectedCertification.expiryDate), 'dd MMM yyyy') : 'N/A'}</p>
                </div>
              </div>

              {selectedCertification.certificateUrl && (
                <div className="border-t pt-4">
                  <Button variant="outline" className="w-full" onClick={() => window.open(selectedCertification.certificateUrl, '_blank')}>
                    <FileText className="h-4 w-4 mr-2" />
                    Open Certificate Document
                  </Button>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowCertDetailsDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Book Renewal Dialog */}
      <Dialog open={showRenewalDialog} onOpenChange={setShowRenewalDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book Certificate Renewal</DialogTitle>
          </DialogHeader>
          {selectedCertification && (
            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  <AlertTriangle className="h-4 w-4 inline mr-2" />
                  This {selectedCertification.certificationType.replace(/_/g, ' ')} expires on{' '}
                  <strong>{format(new Date(selectedCertification.expiryDate), 'dd MMM yyyy')}</strong>
                </p>
              </div>

              <div className="text-sm">
                <p className="text-gray-500 mb-1">Property:</p>
                <p className="font-medium">{selectedCertification.propertyAddress || `#${selectedCertification.propertyId}`}</p>
              </div>

              <div className="text-sm">
                <p className="text-gray-500 mb-1">Previous Inspector:</p>
                <p className="font-medium">{selectedCertification.issuedBy} ({selectedCertification.issuedByCompany})</p>
              </div>

              <div className="border-t pt-4 space-y-3">
                <p className="text-sm font-medium">Quick Actions:</p>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => {
                    toast({
                      title: "Contact request sent",
                      description: `We'll contact ${selectedCertification.issuedByCompany} to schedule a renewal inspection.`
                    });
                    setShowRenewalDialog(false);
                  }}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Contact Previous Inspector
                </Button>
                <Button
                  className="w-full"
                  onClick={() => {
                    toast({
                      title: "Renewal scheduled",
                      description: "A renewal inspection has been added to the calendar."
                    });
                    setShowRenewalDialog(false);
                  }}
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Schedule Renewal Inspection
                </Button>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowRenewalDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Contractor Selection Dialog */}
      <Dialog open={showContractorDialog} onOpenChange={setShowContractorDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-[#791E75]" />
              {selectedTicketForContractor?.assignedContractor ? 'Change Contractor' : 'Assign Contractor'}
            </DialogTitle>
            <DialogDescription>
              Select a contractor and optionally notify them about this ticket
            </DialogDescription>
          </DialogHeader>
          {selectedTicketForContractor && (() => {
            // Map ticket category to contractor specialization keywords
            const categoryToSpecs: Record<string, string[]> = {
              'plumbing': ['plumbing', 'plumbing/gas', 'gas'],
              'electrical': ['electrical', 'electrician', 'electrician(epcs)'],
              'heating': ['heating', 'gas', 'plumbing/gas', 'boiler'],
              'appliance': ['appliance', 'appliance engineer'],
              'structural': ['structural', 'building', 'handyman', 'handyman/roofer', 'roofing'],
              'other': ['handyman', 'general'],
            };
            const ticketCategory = (selectedTicketForContractor.category || selectedTicketForContractor.aiCategorization || 'other').toLowerCase();
            const relevantSpecs = categoryToSpecs[ticketCategory] || categoryToSpecs['other'];

            const isMatch = (contractor: any) => {
              if (!contractor.specializations?.length) return false;
              return contractor.specializations.some((s: string) =>
                relevantSpecs.some(rs => s.toLowerCase().includes(rs) || rs.includes(s.toLowerCase()))
              );
            };

            const matched = contractors?.filter(isMatch) || [];
            const others = contractors?.filter((c: any) => !isMatch(c)) || [];

            return (
              <div className="space-y-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="font-medium">{selectedTicketForContractor.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedTicketForContractor.propertyAddress || `Property #${selectedTicketForContractor.propertyId}`}
                  </p>
                  <Badge variant="secondary" className="mt-1 text-xs">{ticketCategory}</Badge>
                </div>

                {matched.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-green-700">Recommended for {ticketCategory}:</p>
                    {matched.map((contractor: any) => (
                      <div
                        key={contractor.id}
                        className="flex items-center justify-between p-3 border-2 border-green-200 bg-green-50 rounded-lg hover:shadow-md cursor-pointer"
                        onClick={() => {
                          assignContractor.mutate({
                            ticketId: selectedTicketForContractor.id,
                            contractorId: contractor.id,
                            notify: true
                          });
                        }}
                        data-testid={`contractor-option-${contractor.id}`}
                      >
                        <div>
                          <p className="font-medium">{contractor.companyName}</p>
                          <p className="text-sm text-muted-foreground">{contractor.contactName}</p>
                          {contractor.specializations && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {contractor.specializations.map((spec: string) => (
                                <Badge key={spec} variant={relevantSpecs.some(rs => spec.toLowerCase().includes(rs) || rs.includes(spec.toLowerCase())) ? "default" : "outline"} className="text-xs">{spec}</Badge>
                              ))}
                            </div>
                          )}
                          {contractor.emergencyPhone && selectedTicketForContractor.urgency === 'emergency' && (
                            <p className="text-xs text-red-600 mt-1">Emergency: {contractor.emergencyPhone}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              assignContractor.mutate({
                                ticketId: selectedTicketForContractor.id,
                                contractorId: contractor.id,
                                notify: true
                              });
                            }}
                            disabled={assignContractor.isPending}
                            data-testid={`button-assign-notify-${contractor.id}`}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Assign & Notify
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {others.length > 0 && (
                  <details className="group">
                    <summary className="text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
                      Other contractors ({others.length})
                    </summary>
                    <div className="space-y-2 mt-2">
                      {others.map((contractor: any) => (
                        <div
                          key={contractor.id}
                          className="flex items-center justify-between p-2 border rounded-lg hover:shadow-sm cursor-pointer"
                          onClick={() => {
                            assignContractor.mutate({
                              ticketId: selectedTicketForContractor.id,
                              contractorId: contractor.id,
                              notify: true
                            });
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium">{contractor.companyName}</p>
                            {contractor.specializations && (
                              <div className="flex gap-1 mt-1 flex-wrap">
                                {contractor.specializations.slice(0, 2).map((spec: string) => (
                                  <Badge key={spec} variant="outline" className="text-xs">{spec}</Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              assignContractor.mutate({
                                ticketId: selectedTicketForContractor.id,
                                contractorId: contractor.id,
                                notify: true
                              });
                            }}
                            disabled={assignContractor.isPending}
                          >
                            <Send className="h-3 w-3 mr-1" />
                            Assign
                          </Button>
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => {
                    setShowContractorDialog(false);
                    setSelectedTicketForContractor(null);
                  }}>
                    Cancel
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Landlord Details Dialog */}
      <Dialog open={showLandlordDialog} onOpenChange={setShowLandlordDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-[#791E75]" />
              Landlord Details
            </DialogTitle>
            <DialogDescription>Contact and business information</DialogDescription>
          </DialogHeader>
          {selectedLandlord && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold text-lg">{selectedLandlord.name}</h3>
                {selectedLandlord.companyName && (
                  <p className="text-sm text-muted-foreground">{selectedLandlord.companyName}</p>
                )}
              </div>

              <div className="space-y-3">
                {selectedLandlord.email && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Mail className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <a href={`mailto:${selectedLandlord.email}`} className="text-sm font-medium hover:underline text-[#791E75]">
                        {selectedLandlord.email}
                      </a>
                    </div>
                  </div>
                )}

                {selectedLandlord.mobile && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Phone className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Mobile</p>
                      <a href={`tel:${selectedLandlord.mobile}`} className="text-sm font-medium hover:underline text-[#791E75]">
                        {selectedLandlord.mobile}
                      </a>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => selectedLandlord.email && window.open(`mailto:${selectedLandlord.email}`, '_blank')}
                  disabled={!selectedLandlord.email}
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => selectedLandlord.mobile && window.open(`tel:${selectedLandlord.mobile}`, '_blank')}
                  disabled={!selectedLandlord.mobile}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Tenant Details Dialog */}
      <Dialog open={showTenantDialog} onOpenChange={setShowTenantDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-green-600" />
              Tenant Details
            </DialogTitle>
            <DialogDescription>Tenancy information and status</DialogDescription>
          </DialogHeader>
          {selectedTenant && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Tenant ID: {selectedTenant.id}</h3>
                  {selectedTenant.userId && (
                    <p className="text-sm text-muted-foreground">User Account: #{selectedTenant.userId}</p>
                  )}
                </div>
                <Badge variant={selectedTenant.status === 'active' ? 'default' : 'secondary'}>
                  {selectedTenant.status || 'Unknown'}
                </Badge>
              </div>

              <div className="space-y-3">
                {selectedTenant.moveInDate && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Move In Date</p>
                      <p className="text-sm font-medium">
                        {format(new Date(selectedTenant.moveInDate), 'dd MMMM yyyy')}
                      </p>
                    </div>
                  </div>
                )}

                {selectedTenant.moveOutDate && (
                  <div className="flex items-center gap-3 p-3 border rounded-lg">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Move Out Date</p>
                      <p className="text-sm font-medium">
                        {format(new Date(selectedTenant.moveOutDate), 'dd MMMM yyyy')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowTenantDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Property Details Dialog */}
      <Dialog open={showPropertyDetailsDialog} onOpenChange={setShowPropertyDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-[#791E75]" />
              Property Management Details
            </DialogTitle>
            <DialogDescription>{selectedManagedProperty?.propertyAddress}</DialogDescription>
          </DialogHeader>
          {selectedManagedProperty && (
            <div className="space-y-6">
              {/* Property Overview */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Property Type</p>
                    <p className="font-medium">{selectedManagedProperty.bedrooms} bed {selectedManagedProperty.propertyType}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">Monthly Rent</p>
                    <p className="font-medium text-[#791E75]">£{selectedManagedProperty.rentAmount?.toLocaleString()}</p>
                  </CardContent>
                </Card>
              </div>

              <Separator />

              {/* Landlord Section */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Landlord
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Name</p>
                    <p className="font-medium">{selectedManagedProperty.landlordName}</p>
                  </div>
                  {selectedManagedProperty.landlordEmail && (
                    <div>
                      <p className="text-muted-foreground">Email</p>
                      <p className="font-medium">{selectedManagedProperty.landlordEmail}</p>
                    </div>
                  )}
                  {selectedManagedProperty.landlordMobile && (
                    <div>
                      <p className="text-muted-foreground">Phone</p>
                      <p className="font-medium">{selectedManagedProperty.landlordMobile}</p>
                    </div>
                  )}
                  {selectedManagedProperty.landlordCompanyName && (
                    <div>
                      <p className="text-muted-foreground">Company</p>
                      <p className="font-medium">{selectedManagedProperty.landlordCompanyName}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Agreement Details */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Agreement Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Rent Amount</p>
                    <p className="font-medium">£{selectedManagedProperty.rentAmount?.toLocaleString()} {selectedManagedProperty.rentFrequency}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Deposit</p>
                    <p className="font-medium">£{selectedManagedProperty.depositAmount?.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Deposit Held By</p>
                    <p className="font-medium">{selectedManagedProperty.depositHeldBy}</p>
                  </div>
                  {selectedManagedProperty.depositProtectionRef && (
                    <div>
                      <p className="text-muted-foreground">Protection Reference</p>
                      <p className="font-medium">{selectedManagedProperty.depositProtectionRef}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Management Details */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Management Details
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Management Fee</p>
                    <p className="font-medium">
                      {selectedManagedProperty.managementFeePercent
                        ? `${selectedManagedProperty.managementFeePercent}%`
                        : selectedManagedProperty.managementFeeFixed
                          ? `£${selectedManagedProperty.managementFeeFixed}`
                          : 'Not set'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Management Period</p>
                    <p className="font-medium">{selectedManagedProperty.managementPeriod}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Standing Order</p>
                    <p className="font-medium">{selectedManagedProperty.standingOrderSetup ? 'Set up' : 'Not set up'}</p>
                  </div>
                  {selectedManagedProperty.standingOrderRef && (
                    <div>
                      <p className="text-muted-foreground">Standing Order Ref</p>
                      <p className="font-medium">{selectedManagedProperty.standingOrderRef}</p>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Document Checklist */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <ClipboardCheck className="h-4 w-4" />
                  Document Checklist ({selectedManagedProperty.checklistComplete}/{selectedManagedProperty.checklistTotal})
                </h4>
                <Progress
                  value={(selectedManagedProperty.checklistComplete / selectedManagedProperty.checklistTotal) * 100}
                  className="h-2 mb-3"
                />
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    'Tenancy Agreement', 'Notices', 'Guarantor Agreement', 'Standing Order',
                    'Inventory', 'Deposit DPS', 'Deposit TDS', 'Deposit Landlord',
                    'Work Reference', 'Bank Reference', 'Previous Landlord Ref', 'Tenant ID',
                    'Authorization Landlord', 'Terms & Conditions', 'Info Sheet Landlord',
                    'Gas Safety Certificate', 'EPC Certificate'
                  ].map((doc, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded">
                      <div className={`h-3 w-3 rounded-full ${index < selectedManagedProperty.checklistComplete ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-xs">{doc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowPropertyDetailsDialog(false)}>
                  Close
                </Button>
                <Button onClick={() => window.open(`/crm/properties/${selectedManagedProperty.id}`, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Property
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Import Managed Properties Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => {
        setShowImportDialog(open);
        if (!open) {
          setImportFile(null);
          setImportResults(null);
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Import Managed Properties
            </DialogTitle>
            <DialogDescription>
              Upload a CSV file to bulk import managed properties with landlord and tenant information.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Template Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">Download Template</h4>
              <p className="text-sm text-blue-700 mb-3">
                Download the CSV template to see the required format and columns.
              </p>
              <Button variant="outline" onClick={downloadTemplate} className="bg-white">
                <Download className="h-4 w-4 mr-2" />
                Download CSV Template
              </Button>
            </div>

            {/* File Upload */}
            <div className="space-y-3">
              <label className="block text-sm font-medium">Select CSV File</label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setImportFile(file);
                      setImportResults(null);
                    }
                  }}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <Upload className="h-10 w-10 mx-auto text-gray-400 mb-2" />
                  {importFile ? (
                    <p className="text-sm font-medium text-green-600">{importFile.name}</p>
                  ) : (
                    <p className="text-sm text-gray-600">Click to upload or drag and drop</p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">CSV files only</p>
                </label>
              </div>
            </div>

            {/* Import Results */}
            {importResults && (
              <div className={`rounded-lg p-4 ${importResults.errors?.length > 0 ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                <h4 className="font-medium mb-2">
                  {importResults.errors?.length > 0 ? 'Import Completed with Warnings' : 'Import Successful'}
                </h4>
                <div className="text-sm space-y-1">
                  <p className="text-green-700">
                    <CheckCircle className="h-4 w-4 inline mr-1" />
                    {importResults.successCount} properties imported successfully
                  </p>
                  {importResults.errors?.length > 0 && (
                    <div className="mt-2">
                      <p className="text-yellow-700 font-medium">Errors:</p>
                      <ul className="text-xs text-yellow-800 mt-1 space-y-1 max-h-32 overflow-y-auto">
                        {importResults.errors.map((err: any, i: number) => (
                          <li key={i}>Row {err.row}: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                {importResults ? 'Close' : 'Cancel'}
              </Button>
              {!importResults && (
                <Button
                  onClick={handleImport}
                  disabled={!importFile || importProperties.isPending}
                >
                  {importProperties.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Properties
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}