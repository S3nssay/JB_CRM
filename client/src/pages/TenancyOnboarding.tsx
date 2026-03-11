import { useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  UserPlus, CheckCircle2, Clock, AlertCircle, ChevronRight,
  Building2, User, Shield, PoundSterling, FileText, Upload,
  ArrowLeft, ArrowRight, Play, Pause, XCircle, Mail, ChevronsUpDown, Check,
  Loader2, Send, FolderSearch, ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

// Step type definitions matching backend
const STEP_LABELS: Record<string, string> = {
  'register_applicant': 'Register Applicant',
  'collect_documents': 'Collect Documents',
  'verify_documents': 'Verify Documents',
  'allocate_property': 'Allocate Property',
  'landlord_approval': 'Landlord Approval',
  'confirm_start_date': 'Confirm Start Date',
  'sign_contracts': 'Sign Contracts',
  'record_rent': 'Record Rent Details',
  'set_commission': 'Set Commission',
  'upload_certificates': 'Upload Certificates',
  'record_deposit': 'Record Deposit',
  'register_dps': 'Register on DPS',
  'protect_deposit': 'Protect Deposit',
  'verify_deposit_payment': 'Verify Deposit Payment',
  'receive_dps_certificate': 'Receive DPS Certificate',
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  'register_applicant': 'Tenant registered in CRM system as applicant.',
  'collect_documents': 'Tenant uploads ID, references, guarantor docs via portal or CRM.',
  'verify_documents': 'Agent reviews and verifies all uploaded documents.',
  'allocate_property': 'Assign property and landlord to this tenant.',
  'landlord_approval': 'Landlord approves tenancy, move-in date confirmed by tenant.',
  'confirm_start_date': 'Tenancy start date confirmed, tenancy record created.',
  'sign_contracts': 'Tenancy contract and all documents signed by landlord and tenant.',
  'record_rent': 'Rent amount recorded in CRM, including monthly due dates.',
  'set_commission': 'JB commission percentage set on property.',
  'upload_certificates': 'Gas Safety, EICR, EPC certificates and expiry dates uploaded to CRM.',
  'record_deposit': 'Deposit amount and type recorded in CRM.',
  'register_dps': 'Tenant registered on DPS portal.',
  'protect_deposit': 'Deposit protected with DPS. Accounts team pay deposit.',
  'verify_deposit_payment': 'Bank transactions verified, deposit payment confirmed.',
  'receive_dps_certificate': 'DPS certificate received and issued to tenant and JB.',
};

const STEP_ICONS: Record<string, any> = {
  'register_applicant': UserPlus,
  'collect_documents': Upload,
  'verify_documents': ShieldCheck,
  'allocate_property': Building2,
  'landlord_approval': CheckCircle2,
  'confirm_start_date': Clock,
  'sign_contracts': FileText,
  'record_rent': PoundSterling,
  'set_commission': PoundSterling,
  'upload_certificates': Upload,
  'record_deposit': Shield,
  'register_dps': Shield,
  'protect_deposit': Shield,
  'verify_deposit_payment': PoundSterling,
  'receive_dps_certificate': FileText,
};

const STEP_PHASES: Record<string, string> = {
  'register_applicant': 'Prospect',
  'collect_documents': 'Documents',
  'verify_documents': 'Documents',
  'allocate_property': 'Allocation',
  'landlord_approval': 'Allocation',
  'confirm_start_date': 'Tenancy Setup',
  'sign_contracts': 'Tenancy Setup',
  'record_rent': 'Tenancy Setup',
  'set_commission': 'Tenancy Setup',
  'upload_certificates': 'Tenancy Setup',
  'record_deposit': 'Deposit',
  'register_dps': 'Deposit',
  'protect_deposit': 'Deposit',
  'verify_deposit_payment': 'Deposit',
  'receive_dps_certificate': 'Deposit',
};

interface OnboardingStep {
  id: number;
  onboarding_id: number;
  step_type: string;
  step_order: number;
  status: string;
  assigned_to_id: number | null;
  assigned_to_name: string | null;
  completed_at: string | null;
  completed_by_id: number | null;
  completed_by_name: string | null;
  step_data: any;
  notes: string | null;
  notification_sent: boolean;
  notification_sent_at: string | null;
}

interface OnboardingRecord {
  id: number;
  property_id: number | null;
  landlord_id: number | null;
  tenant_id: number;
  tenancy_id: number | null;
  assigned_agent_id: number | null;
  status: string;
  current_step: string;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
  tenant_name: string;
  tenant_email: string;
  tenant_phone: string;
  tenant_status?: string;
  property_address: string | null;
  property_postcode: string | null;
  property_rent?: number;
  management_fee_type?: string;
  management_fee_value?: number;
  landlord_name: string | null;
  landlord_email: string | null;
  landlord_phone?: string;
  agent_name: string;
  agent_email?: string;
  steps_completed?: number;
  steps_total?: number;
  steps?: OnboardingStep[];
}

interface OnboardingSummary {
  summary: {
    total: number;
    in_progress: number;
    completed: number;
    on_hold: number;
    cancelled: number;
  };
  stepStats: Array<{
    step_type: string;
    completed: number;
    in_progress: number;
    pending: number;
    blocked: number;
  }>;
}

type WizardStep = 'details' | 'emergency' | 'verification';

const wizardSteps: { key: WizardStep; label: string }[] = [
  { key: 'details', label: 'Basic Details' },
  { key: 'emergency', label: 'Emergency Contact' },
  { key: 'verification', label: 'Verification' }
];

export default function TenancyOnboarding() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [completeStepDialogOpen, setCompleteStepDialogOpen] = useState(false);
  const [activeStep, setActiveStep] = useState<OnboardingStep | null>(null);
  const [stepNotes, setStepNotes] = useState('');
  const [stepData, setStepData] = useState<Record<string, any>>({});

  // Add Tenant wizard state (same as TenantManagement)
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>('details');
  const [sendVerification, setSendVerification] = useState(true);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    employer: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });

  // Popover states for allocate_property step
  const [propertyOpen, setPropertyOpen] = useState(false);
  const [landlordOpen, setLandlordOpen] = useState(false);

  // Fetch all onboarding pipelines
  const { data: onboardings, isLoading: listLoading } = useQuery<OnboardingRecord[]>({
    queryKey: ['/api/crm/tenancy-onboarding'],
    queryFn: () => apiRequest('/api/crm/tenancy-onboarding'),
  });

  // Fetch selected onboarding detail
  const { data: detail, isLoading: detailLoading } = useQuery<OnboardingRecord>({
    queryKey: ['/api/crm/tenancy-onboarding', selectedId],
    queryFn: () => apiRequest(`/api/crm/tenancy-onboarding/${selectedId}`),
    enabled: !!selectedId,
  });

  // Fetch summary
  const { data: summaryData } = useQuery<OnboardingSummary>({
    queryKey: ['/api/crm/tenancy-onboarding-summary'],
    queryFn: () => apiRequest('/api/crm/tenancy-onboarding-summary'),
  });

  // Fetch properties for allocate_property step
  const { data: propertiesData } = useQuery<any[]>({
    queryKey: ['/api/crm/pm/properties'],
    queryFn: () => apiRequest('/api/crm/pm/properties'),
    enabled: completeStepDialogOpen && activeStep?.step_type === 'allocate_property',
  });

  const { data: landlordsData } = useQuery<any[]>({
    queryKey: ['/api/crm/pm/landlords'],
    queryFn: () => apiRequest('/api/crm/pm/landlords'),
    enabled: completeStepDialogOpen && activeStep?.step_type === 'allocate_property',
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      mobile: '',
      address: '',
      employer: '',
      emergencyContactName: '',
      emergencyContactPhone: ''
    });
  };

  // Step 1: Create tenant via the same endpoint as TenantManagement
  const createTenantMutation = useMutation({
    mutationFn: async (data: typeof formData & { sendVerification: boolean }) => {
      const response = await fetch('/api/crm/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to create tenant');
      return response.json();
    },
    onSuccess: (data) => {
      // Tenant created — now create onboarding pipeline
      createOnboardingMutation.mutate({ tenantId: data.id || data.tenantId });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Step 2: Auto-create onboarding for the new tenant
  const createOnboardingMutation = useMutation({
    mutationFn: (data: { tenantId: number }) =>
      apiRequest('/api/crm/tenancy-onboarding', 'POST', data),
    onSuccess: (result: any) => {
      toast({ title: "Onboarding started", description: "Tenant created and onboarding pipeline started." });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-onboarding-summary'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenants'] });
      setShowAddDialog(false);
      setWizardStep('details');
      setSendVerification(true);
      resetForm();
      setSelectedId(result.id);
    },
    onError: (error: Error) => {
      toast({ title: "Error creating onboarding", description: error.message, variant: "destructive" });
    },
  });

  // Complete step mutation
  const completeStepMutation = useMutation({
    mutationFn: ({ onboardingId, stepId, data }: { onboardingId: number; stepId: number; data: any }) =>
      apiRequest(`/api/crm/tenancy-onboarding/${onboardingId}/steps/${stepId}`, 'PATCH', data),
    onSuccess: () => {
      toast({ title: "Step completed", description: "Step marked as complete. Pipeline advanced." });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-onboarding', selectedId] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-onboarding'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-onboarding-summary'] });
      setCompleteStepDialogOpen(false);
      setActiveStep(null);
      setStepNotes('');
      setStepData({});
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800 text-[11px]">Completed</Badge>;
      case 'in_progress': return <Badge className="bg-blue-100 text-blue-800 text-[11px]">In Progress</Badge>;
      case 'pending': return <Badge className="bg-gray-100 text-gray-600 text-[11px]">Pending</Badge>;
      case 'on_hold': return <Badge className="bg-yellow-100 text-yellow-800 text-[11px]">On Hold</Badge>;
      case 'cancelled': return <Badge className="bg-red-100 text-red-800 text-[11px]">Cancelled</Badge>;
      case 'blocked': return <Badge className="bg-red-100 text-red-800 text-[11px]">Blocked</Badge>;
      case 'skipped': return <Badge className="bg-gray-100 text-gray-500 text-[11px]">Skipped</Badge>;
      case 'applicant': return <Badge className="bg-blue-100 text-blue-800 text-[11px]">Applicant</Badge>;
      case 'active': return <Badge className="bg-green-100 text-green-800 text-[11px]">Active</Badge>;
      default: return <Badge className="text-[11px]">{status}</Badge>;
    }
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in_progress': return <Play className="h-5 w-5 text-blue-500" />;
      case 'blocked': return <AlertCircle className="h-5 w-5 text-red-500" />;
      default: return <Clock className="h-5 w-5 text-gray-300" />;
    }
  };

  const openCompleteDialog = (step: OnboardingStep) => {
    setActiveStep(step);
    setStepNotes(step.notes || '');
    setStepData(step.step_data || {});
    setCompleteStepDialogOpen(true);
  };

  const handleCompleteStep = () => {
    if (!activeStep || !selectedId) return;
    completeStepMutation.mutate({
      onboardingId: selectedId,
      stepId: activeStep.id,
      data: {
        status: 'completed',
        stepData,
        notes: stepNotes,
      },
    });
  };

  // When property is selected in allocate_property, auto-select its landlord
  const handleAllocatePropertySelect = (propertyId: string) => {
    const property = propertiesData?.find((p: any) => String(p.id) === propertyId);
    const landlordId = property?.landlordId || property?.landlord_id;
    setStepData(prev => ({
      ...prev,
      propertyId: parseInt(propertyId),
      landlordId: landlordId ? parseInt(String(landlordId)) : prev.landlordId,
    }));
    setPropertyOpen(false);
  };

  // Render step-specific data fields in complete dialog
  const renderStepDataFields = () => {
    if (!activeStep) return null;

    switch (activeStep.step_type) {
      case 'allocate_property':
        return (
          <div className="space-y-3">
            <div>
              <Label>Property *</Label>
              <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {stepData.propertyId
                      ? (() => {
                          const p = propertiesData?.find((p: any) => p.id === stepData.propertyId);
                          return p ? `${p.address || p.addressLine1 || p.address_line1}${p.postcode ? ', ' + p.postcode : ''}` : `Property #${stepData.propertyId}`;
                        })()
                      : "Select property..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search properties..." />
                    <CommandList>
                      <CommandEmpty>No property found.</CommandEmpty>
                      <CommandGroup>
                        {propertiesData?.map((p: any) => {
                          const label = `${p.address || p.addressLine1 || p.address_line1 || ''}${p.postcode ? ', ' + p.postcode : ''}`;
                          return (
                            <CommandItem key={p.id} value={label} onSelect={() => handleAllocatePropertySelect(String(p.id))}>
                              <Check className={"mr-2 h-4 w-4 " + (stepData.propertyId === p.id ? "opacity-100" : "opacity-0")} />
                              {label}
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Landlord *</Label>
              <Popover open={landlordOpen} onOpenChange={setLandlordOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {stepData.landlordId
                      ? landlordsData?.find((l: any) => l.id === stepData.landlordId)?.name || `Landlord #${stepData.landlordId}`
                      : "Select landlord..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search landlords..." />
                    <CommandList>
                      <CommandEmpty>No landlord found.</CommandEmpty>
                      <CommandGroup>
                        {landlordsData?.map((l: any) => (
                          <CommandItem key={l.id} value={l.name} onSelect={() => { setStepData(prev => ({ ...prev, landlordId: l.id })); setLandlordOpen(false); }}>
                            <Check className={"mr-2 h-4 w-4 " + (stepData.landlordId === l.id ? "opacity-100" : "opacity-0")} />
                            {l.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        );

      case 'confirm_start_date':
        return (
          <div className="space-y-3">
            <div>
              <Label>Start Date</Label>
              <Input type="date" value={stepData.startDate || ''} onChange={(e) => setStepData({ ...stepData, startDate: e.target.value })} />
            </div>
            <div>
              <Label>End Date</Label>
              <Input type="date" value={stepData.endDate || ''} onChange={(e) => setStepData({ ...stepData, endDate: e.target.value })} />
            </div>
            <div>
              <Label>Period (months)</Label>
              <Input type="number" value={stepData.periodMonths || 12} onChange={(e) => setStepData({ ...stepData, periodMonths: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>Monthly Rent ({'\u00A3'})</Label>
              <Input type="number" value={stepData.rentAmount || ''} onChange={(e) => setStepData({ ...stepData, rentAmount: e.target.value })} />
            </div>
            <div>
              <Label>Deposit Amount ({'\u00A3'})</Label>
              <Input type="number" value={stepData.depositAmount || ''} onChange={(e) => setStepData({ ...stepData, depositAmount: e.target.value })} />
            </div>
          </div>
        );

      case 'record_rent':
        return (
          <div className="space-y-3">
            <div>
              <Label>Monthly Rent ({'\u00A3'})</Label>
              <Input type="number" value={stepData.rentAmount || ''} onChange={(e) => setStepData({ ...stepData, rentAmount: e.target.value })} />
            </div>
            <div>
              <Label>Rent Frequency</Label>
              <Select value={stepData.rentFrequency || 'monthly'} onValueChange={(v) => setStepData({ ...stepData, rentFrequency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Rent Due Day</Label>
              <Input type="number" min={1} max={31} value={stepData.rentDueDay || 1} onChange={(e) => setStepData({ ...stepData, rentDueDay: parseInt(e.target.value) })} />
            </div>
          </div>
        );

      case 'set_commission':
        return (
          <div className="space-y-3">
            <div>
              <Label>Commission Type</Label>
              <Select value={stepData.commissionType || 'percentage'} onValueChange={(v) => setStepData({ ...stepData, commissionType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="fixed">Fixed Amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{stepData.commissionType === 'fixed' ? 'Commission Amount (\u00A3)' : 'Commission (%)'}</Label>
              <Input type="number" step="0.1" value={stepData.commissionValue || ''} onChange={(e) => setStepData({ ...stepData, commissionValue: e.target.value })} />
            </div>
          </div>
        );

      case 'record_deposit':
        return (
          <div className="space-y-3">
            <div>
              <Label>Deposit Amount ({'\u00A3'})</Label>
              <Input type="number" value={stepData.depositAmount || ''} onChange={(e) => setStepData({ ...stepData, depositAmount: e.target.value })} />
            </div>
            <div>
              <Label>Deposit Scheme</Label>
              <Select value={stepData.depositScheme || 'DPS'} onValueChange={(v) => setStepData({ ...stepData, depositScheme: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="DPS">DPS (Deposit Protection Service)</SelectItem>
                  <SelectItem value="TDS">TDS (Tenancy Deposit Scheme)</SelectItem>
                  <SelectItem value="MyDeposits">MyDeposits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Deposit Holder Type</Label>
              <Select value={stepData.depositHolderType || 'agency_custodial'} onValueChange={(v) => setStepData({ ...stepData, depositHolderType: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency_custodial">Custodial (DPS)</SelectItem>
                  <SelectItem value="agency_insurance">Held by Agency</SelectItem>
                  <SelectItem value="landlord">Held by Landlord</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'protect_deposit':
        return (
          <div className="space-y-3">
            <div>
              <Label>DPS Certificate Number</Label>
              <Input value={stepData.certificateNumber || ''} onChange={(e) => setStepData({ ...stepData, certificateNumber: e.target.value })} />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // ========================================
  // DETAIL VIEW
  // ========================================
  if (selectedId && detail) {
    const progress = detail.steps ? (detail.steps.filter(s => s.status === 'completed').length / detail.steps.length) * 100 : 0;

    // Group steps by phase
    let currentPhase = '';

    return (
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Tenancy Onboarding</h1>
              <p className="text-sm text-gray-500">
                {detail.tenant_name}
                {detail.property_address ? ` — ${detail.property_address}${detail.property_postcode ? `, ${detail.property_postcode}` : ''}` : ' — Property not yet allocated'}
              </p>
            </div>
          </div>
          {getStatusBadge(detail.status)}
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium">Tenant</p>
              </div>
              <p className="text-sm font-semibold">{detail.tenant_name || 'N/A'}</p>
              <p className="text-xs text-gray-500">{detail.tenant_email}</p>
              {detail.tenant_status && (
                <div className="mt-1">{getStatusBadge(detail.tenant_status)}</div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium">Property</p>
              </div>
              {detail.property_address ? (
                <>
                  <p className="text-sm font-semibold">{detail.property_address}</p>
                  <p className="text-xs text-gray-500">{detail.property_postcode}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Not yet allocated</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium">Landlord</p>
              </div>
              {detail.landlord_name ? (
                <>
                  <p className="text-sm font-semibold">{detail.landlord_name}</p>
                  <p className="text-xs text-gray-500">{detail.landlord_email}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 italic">Not yet allocated</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-gray-400" />
                <p className="text-xs text-gray-500 font-medium">Agent</p>
              </div>
              <p className="text-sm font-semibold">{detail.agent_name || 'Unassigned'}</p>
              <p className="text-xs text-gray-500">{detail.agent_email}</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium">Pipeline Progress</p>
              <p className="text-sm text-gray-500">{Math.round(progress)}% complete</p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-[#791E75] h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
            </div>
          </CardContent>
        </Card>

        {/* Steps Pipeline */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Onboarding Steps</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {detail.steps?.map((step, idx) => {
                const Icon = STEP_ICONS[step.step_type] || Clock;
                const isCurrentStep = step.status === 'in_progress';
                const phase = STEP_PHASES[step.step_type] || '';
                const showPhaseHeader = phase !== currentPhase;
                if (showPhaseHeader) currentPhase = phase;

                return (
                  <div key={step.id}>
                    {showPhaseHeader && (
                      <div className="px-6 py-2 bg-gray-50 border-b">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{phase}</p>
                      </div>
                    )}
                    <div
                      className={`flex items-center gap-4 px-6 py-4 transition-colors ${isCurrentStep ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                    >
                      <div className="flex items-center gap-3 w-8">
                        {getStepStatusIcon(step.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          <p className={`text-sm font-medium ${step.status === 'completed' ? 'text-green-700' : step.status === 'in_progress' ? 'text-blue-700' : 'text-gray-500'}`}>
                            Step {idx + 1}: {STEP_LABELS[step.step_type] || step.step_type}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 ml-6">
                          {STEP_DESCRIPTIONS[step.step_type]}
                        </p>
                        {step.notes && (
                          <p className="text-xs text-gray-600 mt-1 ml-6 italic">Note: {step.notes}</p>
                        )}
                        {step.completed_at && (
                          <p className="text-xs text-green-600 mt-1 ml-6">
                            Completed {format(new Date(step.completed_at), 'dd MMM yyyy HH:mm')}
                            {step.completed_by_name ? ` by ${step.completed_by_name}` : ''}
                          </p>
                        )}
                        {step.notification_sent && (
                          <div className="flex items-center gap-1 mt-1 ml-6">
                            <Mail className="h-3 w-3 text-green-500" />
                            <span className="text-xs text-green-600">Notification sent</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(step.status)}
                        {(step.status === 'in_progress') && (
                          <Button
                            size="sm"
                            className="bg-[#791E75] hover:bg-[#631760] text-white text-xs"
                            onClick={() => openCompleteDialog(step)}
                          >
                            Complete Step
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Complete Step Dialog */}
        <Dialog open={completeStepDialogOpen} onOpenChange={setCompleteStepDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Step: {activeStep ? STEP_LABELS[activeStep.step_type] : ''}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                {activeStep ? STEP_DESCRIPTIONS[activeStep.step_type] : ''}
              </p>

              {renderStepDataFields()}

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={stepNotes}
                  onChange={(e) => setStepNotes(e.target.value)}
                  placeholder="Add any notes about this step..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCompleteStepDialogOpen(false)}>Cancel</Button>
              <Button
                className="bg-[#791E75] hover:bg-[#631760] text-white"
                onClick={handleCompleteStep}
                disabled={completeStepMutation.isPending || (activeStep?.step_type === 'allocate_property' && (!stepData.propertyId || !stepData.landlordId))}
              >
                {completeStepMutation.isPending ? 'Completing...' : 'Mark Complete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ========================================
  // LIST VIEW
  // ========================================
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Tenancy Onboarding</h1>
          <p className="text-sm text-gray-500">Manage new tenancy setup pipelines</p>
        </div>
        <Button className="bg-[#791E75] hover:bg-[#631760] text-white" onClick={() => setShowAddDialog(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Start New Onboarding
        </Button>
      </div>

      {/* Summary Cards */}
      {summaryData?.summary && (
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Play className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryData.summary.in_progress}</p>
                <p className="text-xs text-gray-500">In Progress</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryData.summary.completed}</p>
                <p className="text-xs text-gray-500">Completed</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Pause className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryData.summary.on_hold}</p>
                <p className="text-xs text-gray-500">On Hold</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <Building2 className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{summaryData.summary.total}</p>
                <p className="text-xs text-gray-500">Total</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Onboarding List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Pipelines</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : !onboardings?.length ? (
            <div className="p-8 text-center text-gray-500">
              <UserPlus className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">No onboarding pipelines yet</p>
              <p className="text-xs text-gray-400 mt-1">Click "Start New Onboarding" to begin</p>
            </div>
          ) : (
            <div className="divide-y">
              {onboardings.map((ob) => {
                const progress = ob.steps_total ? ((ob.steps_completed || 0) / ob.steps_total) * 100 : 0;

                return (
                  <div
                    key={ob.id}
                    className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedId(ob.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">
                          {ob.tenant_name || 'Unknown Tenant'}
                        </p>
                        {getStatusBadge(ob.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-1">
                        {ob.property_address ? (
                          <span className="text-xs text-gray-500">
                            <Building2 className="h-3 w-3 inline mr-1" />
                            {ob.property_address}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 italic">
                            <Building2 className="h-3 w-3 inline mr-1" />
                            Property not allocated
                          </span>
                        )}
                        {ob.landlord_name && (
                          <span className="text-xs text-gray-500">
                            <User className="h-3 w-3 inline mr-1" />
                            {ob.landlord_name}
                          </span>
                        )}
                        <span className="text-xs text-gray-500">
                          Step: {STEP_LABELS[ob.current_step] || ob.current_step}
                        </span>
                      </div>
                      <div className="mt-2 w-full bg-gray-200 rounded-full h-1.5">
                        <div className="bg-[#791E75] h-1.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        {ob.steps_completed}/{ob.steps_total} steps completed
                        {ob.created_at && ` \u2022 Started ${format(new Date(ob.created_at), 'dd MMM yyyy')}`}
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-gray-300 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Tenant Wizard Dialog — same as TenantManagement */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setWizardStep('details');
          setSendVerification(true);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Tenant</DialogTitle>
            <DialogDescription>
              Complete the steps below to register a new tenant and start onboarding
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              {wizardSteps.map((step, idx) => {
                const currentIdx = wizardSteps.findIndex(s => s.key === wizardStep);
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-1 ${idx <= currentIdx ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                      idx < currentIdx
                        ? 'bg-primary text-primary-foreground'
                        : idx === currentIdx
                          ? 'bg-primary/20 text-primary border-2 border-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {idx < currentIdx ? <Check className="h-3 w-3" /> : idx + 1}
                    </div>
                    <span className="text-xs hidden sm:inline">{step.label}</span>
                  </div>
                );
              })}
            </div>
            <Progress value={((wizardSteps.findIndex(s => s.key === wizardStep) + 1) / wizardSteps.length) * 100} className="h-2" />
          </div>

          {/* Step 1: Basic Details */}
          {wizardStep === 'details' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter tenant's full name"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Home phone"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile *</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="07xxx xxxxxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Required for WhatsApp verification</p>
                </div>
              </div>
              <div>
                <Label htmlFor="address">Current Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Current address"
                />
              </div>
            </div>
          )}

          {/* Step 2: Emergency Contact */}
          {wizardStep === 'emergency' && (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800">
                  Emergency contact details are important for safety reasons and should be collected for all tenants.
                </p>
              </div>
              <div>
                <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  placeholder="Contact phone number"
                />
              </div>
            </div>
          )}

          {/* Step 3: Verification */}
          {wizardStep === 'verification' && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800">ID Verification</p>
                    <p className="text-sm text-blue-700 mt-1">
                      The tenant will be saved as "applicant". A WhatsApp message will be sent to their mobile with a link to complete ID verification.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="sendVerification"
                    checked={sendVerification}
                    onCheckedChange={(checked) => setSendVerification(checked as boolean)}
                  />
                  <div>
                    <Label htmlFor="sendVerification" className="font-medium">
                      Send WhatsApp verification link
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically send a verification link to {formData.mobile || "the tenant's mobile"}
                    </p>
                  </div>
                </div>

                {!formData.mobile && sendVerification && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    Mobile number is required to send WhatsApp verification. Please go back and add a mobile number.
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Name:</span> {formData.fullName}</p>
                  <p><span className="text-muted-foreground">Email:</span> {formData.email || 'Not provided'}</p>
                  <p><span className="text-muted-foreground">Mobile:</span> {formData.mobile || 'Not provided'}</p>
                  <p><span className="text-muted-foreground">Status:</span> Will be registered as <Badge variant="secondary" className="ml-1">Applicant</Badge></p>
                  {sendVerification && formData.mobile && (
                    <p className="text-green-600 flex items-center gap-1 mt-2">
                      <Send className="h-3 w-3" /> Verification link will be sent via WhatsApp
                    </p>
                  )}
                  <p className="text-[#791E75] flex items-center gap-1 mt-2">
                    <Play className="h-3 w-3" /> Onboarding pipeline will be created automatically
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const currentIdx = wizardSteps.findIndex(s => s.key === wizardStep);
                if (currentIdx === 0) {
                  setShowAddDialog(false);
                  resetForm();
                  setWizardStep('details');
                } else {
                  setWizardStep(wizardSteps[currentIdx - 1].key);
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {wizardStep === 'details' ? 'Cancel' : 'Back'}
            </Button>

            {wizardStep === 'verification' ? (
              <Button
                onClick={() => createTenantMutation.mutate({ ...formData, sendVerification })}
                disabled={!formData.fullName || createTenantMutation.isPending || createOnboardingMutation.isPending || (sendVerification && !formData.mobile)}
                className="bg-gradient-to-r from-[#791E75] to-purple-600"
              >
                {(createTenantMutation.isPending || createOnboardingMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start Onboarding
              </Button>
            ) : (
              <Button
                onClick={() => {
                  const currentIdx = wizardSteps.findIndex(s => s.key === wizardStep);
                  setWizardStep(wizardSteps[currentIdx + 1].key);
                }}
                disabled={wizardStep === 'details' && !formData.fullName}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
