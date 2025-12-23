import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Wrench, Shield, AlertCircle, CheckCircle, Clock, Calendar, Users, FileText, Plus, Eye, Send, AlertTriangle, Home, ArrowLeft, Building, User, Phone, Mail, CreditCard, ClipboardCheck, ExternalLink, UserCheck } from 'lucide-react';
import { Link } from 'wouter';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

// Form schemas
const maintenanceFormSchema = z.object({
  propertyId: z.string().min(1, "Property required"),
  tenantName: z.string().min(2, "Tenant name required"),
  tenantEmail: z.string().email("Valid email required"),
  tenantPhone: z.string().min(10, "Phone required"),
  issueType: z.string(),
  priority: z.string(),
  title: z.string().min(5, "Title required"),
  description: z.string().min(10, "Description required"),
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
  const variants: { [key: string]: any } = {
    'emergency': { variant: 'destructive', icon: AlertTriangle },
    'high': { variant: 'default', className: 'bg-[#F8B324] text-black 500' },
    'medium': { variant: 'secondary' },
    'low': { variant: 'outline' }
  };

  const config = variants[priority] || variants.medium;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={config.className}>
      {Icon && <Icon className="h-3 w-3 mr-1" />}
      {priority.toUpperCase()}
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

  // Fetch maintenance requests
  const { data: maintenanceRequests, isLoading: loadingMaintenance } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets'],
    queryFn: async () => {
      const response = await fetch('/api/crm/maintenance/tickets');
      if (!response.ok) throw new Error('Failed to fetch maintenance requests');
      return response.json();
    }
  });

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
  const [selectedLandlord, setSelectedLandlord] = useState<any>(null);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [selectedManagedProperty, setSelectedManagedProperty] = useState<any>(null);

  // Maintenance form
  const maintenanceForm = useForm({
    resolver: zodResolver(maintenanceFormSchema),
    defaultValues: {
      propertyId: '',
      tenantName: '',
      tenantEmail: '',
      tenantPhone: '',
      issueType: 'other',
      priority: 'medium',
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

  // Submit maintenance request
  const submitMaintenance = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('/api/crm/maintenance/tickets', 'POST', data);
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

  // Update property status
  const updatePropertyStatus = useMutation({
    mutationFn: async ({ id, status, listingType }: { id: number; status: string; listingType?: string }) => {
      return apiRequest(`/api/crm/properties/${id}`, 'PATCH', { status, listingType });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/managed-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
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
        <div className="flex items-center gap-4">
          <Link href="/portal">
            <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Property Management</h1>
        </div>
        <div className="flex gap-2">
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
                        <TableHead className="min-w-[120px]">Marketing</TableHead>
                        <TableHead className="min-w-[80px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {managedProperties?.map((property: any) => (
                        <TableRow key={property.id} data-testid={`row-managed-property-${property.id}`}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Link href={`/crm/managed-property/${property.id}`} className="hover:underline cursor-pointer block">
                                <span className="font-medium text-sm text-[#791E75]" data-testid={`text-address-${property.id}`}>{property.propertyAddress}</span>
                              </Link>

                              {/* Custom Property ID: Postcode + Door Number */}
                              <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1 rounded w-fit">
                                {(() => {
                                  const doorNo = property.propertyAddress?.match(/^(\d+)/)?.[1];
                                  const postcodePart = property.postcode?.split(' ')[0];
                                  return `${postcodePart || 'UNK'}${doorNo ? '-' + doorNo : ''}`;
                                })()}
                              </span>

                              <span className="text-xs text-muted-foreground" data-testid={`text-property-type-${property.id}`}>
                                {property.bedrooms} bed {property.propertyType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-auto p-1 text-left justify-start"
                              onClick={() => {
                                setSelectedLandlord({
                                  id: property.landlordId,
                                  name: property.landlordName,
                                  email: property.landlordEmail,
                                  mobile: property.landlordMobile,
                                  companyName: property.landlordCompanyName
                                });
                                setShowLandlordDialog(true);
                              }}
                              data-testid={`button-landlord-${property.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-[#791E75]" />
                                <span className="text-sm font-medium hover:underline">{property.landlordName}</span>
                              </div>
                            </Button>
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
                            <div className="flex flex-col gap-1" data-testid={`checklist-${property.id}`}>
                              <div className="flex items-center gap-1">
                                <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs" data-testid={`text-checklist-count-${property.id}`}>{property.checklistComplete}/{property.checklistTotal}</span>
                              </div>
                              <Progress value={property.checklistTotal > 0 ? (property.checklistComplete / property.checklistTotal) * 100 : 0} className="h-1.5 w-16" />
                            </div>
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
                              defaultValue={property.status === 'let' ? 'not_listed' : (property.listingType === 'sale' ? 'for_sale' : 'for_rent')}
                              onValueChange={(value) => {
                                if (value === 'not_listed') {
                                  updatePropertyStatus.mutate({ id: property.id, status: 'let' });
                                } else if (value === 'for_sale') {
                                  updatePropertyStatus.mutate({ id: property.id, status: 'available', listingType: 'sale' });
                                } else if (value === 'for_rent') {
                                  updatePropertyStatus.mutate({ id: property.id, status: 'available', listingType: 'rental' });
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
                                onClick={() => setShowMaintenanceDialog(true)}
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
                          Reported: {format(new Date(request.reportedAt), 'dd MMM yyyy')}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <PriorityBadge priority={request.priority} />
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
      <Dialog open={showMaintenanceDialog} onOpenChange={setShowMaintenanceDialog}>
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
                  <FormItem>
                    <FormLabel>Property</FormLabel>
                    <FormControl>
                      <Input placeholder="Property ID or Address" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={maintenanceForm.control}
                  name="issueType"
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
                          <SelectItem value="pest">Pest Control</SelectItem>
                          <SelectItem value="cleaning">Cleaning</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={maintenanceForm.control}
                  name="priority"
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
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
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

      {/* Maintenance Request Details Dialog */}
      <Dialog open={showRequestDetailsDialog} onOpenChange={setShowRequestDetailsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Maintenance Request Details</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-lg">{selectedRequest.title}</h3>
                <div className="flex gap-2">
                  <PriorityBadge priority={selectedRequest.priority} />
                  <Badge variant="outline">{selectedRequest.status}</Badge>
                </div>
              </div>

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
                  <span className="text-gray-500">Issue Type:</span>
                  <p className="font-medium capitalize">{selectedRequest.issueType}</p>
                </div>
                <div>
                  <span className="text-gray-500">Reported:</span>
                  <p className="font-medium">{selectedRequest.reportedAt ? format(new Date(selectedRequest.reportedAt), 'dd MMM yyyy HH:mm') : 'N/A'}</p>
                </div>
              </div>

              <div>
                <span className="text-gray-500 text-sm">Description:</span>
                <p className="mt-1 p-3 bg-gray-50 rounded-lg">{selectedRequest.description}</p>
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
                      <p className="font-medium">{selectedRequest.tenantPhone}</p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-gray-500">Email:</span>
                      <p className="font-medium">{selectedRequest.tenantEmail}</p>
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
                  <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 rounded-lg p-3" data-testid="section-contractor-details">
                    <div>
                      <span className="text-muted-foreground">Company:</span>
                      <p className="font-medium" data-testid="text-dialog-contractor-company">{selectedRequest.assignedContractor.companyName}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Contact:</span>
                      <p className="font-medium" data-testid="text-dialog-contractor-contact">{selectedRequest.assignedContractor.contactName || 'N/A'}</p>
                    </div>
                    {selectedRequest.assignedContractor.phone && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium" data-testid="text-dialog-contractor-phone">{selectedRequest.assignedContractor.phone}</p>
                      </div>
                    )}
                    {selectedRequest.assignedContractor.email && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <p className="font-medium" data-testid="text-dialog-contractor-email">{selectedRequest.assignedContractor.email}</p>
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
                  <div className="grid grid-cols-2 gap-4 text-sm bg-muted/50 rounded-lg p-3" data-testid="section-property-manager-details">
                    <div>
                      <span className="text-muted-foreground">Name:</span>
                      <p className="font-medium" data-testid="text-dialog-manager-name">{selectedRequest.propertyManager.fullName}</p>
                    </div>
                    {selectedRequest.propertyManager.phone && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <p className="font-medium" data-testid="text-dialog-manager-phone">{selectedRequest.propertyManager.phone}</p>
                      </div>
                    )}
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium" data-testid="text-dialog-manager-email">{selectedRequest.propertyManager.email || 'N/A'}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-sm">No property manager assigned</p>
                )}
              </div>

              {/* Status History / Audit Trail */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Activity History
                </h4>
                {ticketHistory && ticketHistory.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto" data-testid="section-ticket-history">
                    {ticketHistory.map((update: any, index: number) => (
                      <div
                        key={update.id || index}
                        className="flex gap-3 text-sm p-2 bg-muted/30 rounded-lg"
                        data-testid={`history-item-${update.id || index}`}
                      >
                        <div className="flex-shrink-0">
                          {update.updateType === 'status_change' && <AlertCircle className="h-4 w-4 text-blue-500" />}
                          {update.updateType === 'assignment' && <UserCheck className="h-4 w-4 text-green-500" />}
                          {update.updateType === 'comment' && <FileText className="h-4 w-4 text-gray-500" />}
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

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowRequestDetailsDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
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
          {selectedTicketForContractor && (
            <div className="space-y-4">
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedTicketForContractor.title}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTicketForContractor.propertyAddress || `Property #${selectedTicketForContractor.propertyId}`}
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">Select Contractor:</p>
                {contractors?.map((contractor: any) => (
                  <div
                    key={contractor.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover-elevate cursor-pointer"
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
                        <div className="flex gap-1 mt-1">
                          {contractor.specializations.slice(0, 2).map((spec: string) => (
                            <Badge key={spec} variant="outline" className="text-xs">{spec}</Badge>
                          ))}
                        </div>
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

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => {
                  setShowContractorDialog(false);
                  setSelectedTicketForContractor(null);
                }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
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
                <Button onClick={() => window.open(`/property/${selectedManagedProperty.id}`, '_blank')}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View Property
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}