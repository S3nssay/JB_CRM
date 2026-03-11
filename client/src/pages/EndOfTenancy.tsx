import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  ClipboardList, CheckCircle, Clock, Play, AlertTriangle, Shield,
  Home, User, Phone, Mail, Banknote, Zap, Droplets, Flame,
  Key, FileText, Building, ArrowRight, CircleDot, Calendar, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const EOT_CHECKLIST_ITEMS = [
  'serve_notice', 'tenant_acknowledge_notice', 'schedule_checkout_inspection',
  'checkout_inspection', 'inventory_checkout', 'meter_readings',
  'assess_dilapidations', 'cleaning_assessment', 'deposit_deductions_agreed',
  'deposit_return_initiated', 'key_return', 'final_account',
  'utility_notifications', 'council_tax_notification', 'forwarding_address'
];

const checklistLabels: Record<string, string> = {
  serve_notice: 'Serve Notice to Tenant',
  tenant_acknowledge_notice: 'Tenant Acknowledges Notice',
  schedule_checkout_inspection: 'Schedule Checkout Inspection',
  checkout_inspection: 'Conduct Checkout Inspection',
  inventory_checkout: 'Complete Inventory Checkout Report',
  meter_readings: 'Record Final Meter Readings',
  assess_dilapidations: 'Assess Dilapidations & Damages',
  cleaning_assessment: 'Cleaning Assessment',
  deposit_deductions_agreed: 'Agree Deposit Deductions with Tenant',
  deposit_return_initiated: 'Initiate Deposit Return via Scheme',
  key_return: 'Collect All Keys',
  final_account: 'Produce Final Account / Statement',
  utility_notifications: 'Notify Utility Providers',
  council_tax_notification: 'Notify Council Tax',
  forwarding_address: 'Obtain Forwarding Address',
};

const checklistIcons: Record<string, any> = {
  serve_notice: FileText,
  tenant_acknowledge_notice: User,
  schedule_checkout_inspection: Clock,
  checkout_inspection: ClipboardList,
  inventory_checkout: ClipboardList,
  meter_readings: Zap,
  assess_dilapidations: AlertTriangle,
  cleaning_assessment: Home,
  deposit_deductions_agreed: Banknote,
  deposit_return_initiated: Shield,
  key_return: Key,
  final_account: FileText,
  utility_notifications: Zap,
  council_tax_notification: Building,
  forwarding_address: ArrowRight,
};

const stepCategories: Record<string, string> = {
  serve_notice: 'Notice',
  tenant_acknowledge_notice: 'Notice',
  schedule_checkout_inspection: 'Inspection',
  checkout_inspection: 'Inspection',
  inventory_checkout: 'Inspection',
  meter_readings: 'Utilities',
  assess_dilapidations: 'Financial',
  cleaning_assessment: 'Inspection',
  deposit_deductions_agreed: 'Financial',
  deposit_return_initiated: 'Financial',
  key_return: 'Handover',
  final_account: 'Financial',
  utility_notifications: 'Utilities',
  council_tax_notification: 'Utilities',
  forwarding_address: 'Admin',
};

const categoryColors: Record<string, string> = {
  Notice: 'bg-blue-100 text-blue-800',
  Inspection: 'bg-amber-100 text-amber-800',
  Utilities: 'bg-green-100 text-green-800',
  Financial: 'bg-purple-100 text-purple-800',
  Handover: 'bg-red-100 text-red-800',
  Admin: 'bg-gray-100 text-gray-800',
};

export default function EndOfTenancy() {
  const { toast } = useToast();
  const [selectedTenancyId, setSelectedTenancyId] = useState<number | null>(null);
  const [showStartDialog, setShowStartDialog] = useState(false);
  const [startTenancyId, setStartTenancyId] = useState('');
  const [noticeType, setNoticeType] = useState('tenant_notice');
  const [activeTab, setActiveTab] = useState('checklist');

  // Meter reading state
  const [meterElectric, setMeterElectric] = useState('');
  const [meterGas, setMeterGas] = useState('');
  const [meterWater, setMeterWater] = useState('');

  // Deposit state
  const [depositDeductions, setDepositDeductions] = useState('');
  const [depositDeductionsReason, setDepositDeductionsReason] = useState('');
  const [depositReturnStatus, setDepositReturnStatus] = useState('pending');

  // Checkout state
  const [checkoutDate, setCheckoutDate] = useState('');
  const [checkoutClerk, setCheckoutClerk] = useState('');
  const [forwardingAddress, setForwardingAddress] = useState('');

  // Dilapidations state
  const [dilapidationsAmount, setDilapidationsAmount] = useState('');
  const [dilapidationsNotes, setDilapidationsNotes] = useState('');
  const [cleaningRequired, setCleaningRequired] = useState(false);
  const [cleaningCost, setCleaningCost] = useState('');

  const { data: endingTenancies } = useQuery({
    queryKey: ['/api/crm/pm-dashboard/tenancies', 'ending'],
    queryFn: () => apiRequest('/api/crm/pm-dashboard/tenancies?status=ending'),
  });

  const { data: activeTenancies } = useQuery({
    queryKey: ['/api/crm/pm-dashboard/tenancies', 'active'],
    queryFn: () => apiRequest('/api/crm/pm-dashboard/tenancies?status=active'),
    enabled: showStartDialog,
  });

  const { data: tenancyDetails, isLoading: detailLoading } = useQuery({
    queryKey: ['/api/crm/end-of-tenancy', selectedTenancyId],
    queryFn: () => apiRequest('/api/crm/end-of-tenancy/' + selectedTenancyId),
    enabled: selectedTenancyId !== null,
  });

  const startMutation = useMutation({
    mutationFn: (data: { tenancyId: string | number; noticeType: string }) =>
      apiRequest('/api/crm/end-of-tenancy/' + data.tenancyId + '/start', "POST", { noticeType: data.noticeType }),
    onSuccess: () => {
      toast({ title: 'End of tenancy process started' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm-dashboard/tenancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/end-of-tenancy', selectedTenancyId] });
      setShowStartDialog(false);
      setStartTenancyId('');
    },
    onError: () => {
      toast({ title: 'Failed to start end of tenancy', variant: 'destructive' });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isCompleted }: { id: number; isCompleted: boolean }) =>
      apiRequest('/api/crm/pm/checklist/' + id, "PATCH", { isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/end-of-tenancy', selectedTenancyId] });
    },
    onError: () => {
      toast({ title: 'Failed to update checklist item', variant: 'destructive' });
    },
  });

  const completeMutation = useMutation({
    mutationFn: (tenancyId: number) =>
      apiRequest('/api/crm/end-of-tenancy/' + tenancyId + '/complete', "POST"),
    onSuccess: () => {
      toast({ title: 'Tenancy closed successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm-dashboard/tenancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/end-of-tenancy', selectedTenancyId] });
      setSelectedTenancyId(null);
    },
    onError: (error: any) => {
      toast({ title: error?.message || 'Failed to close tenancy', variant: 'destructive' });
    },
  });

  const metersMutation = useMutation({
    mutationFn: (data: { electric: string; gas: string; water: string }) =>
      apiRequest('/api/crm/end-of-tenancy/' + selectedTenancyId + '/meters', "PATCH", data),
    onSuccess: () => {
      toast({ title: 'Meter readings saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/end-of-tenancy', selectedTenancyId] });
    },
    onError: () => {
      toast({ title: 'Failed to save meter readings', variant: 'destructive' });
    },
  });

  const depositMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/crm/end-of-tenancy/' + selectedTenancyId + '/deposit', "PATCH", data),
    onSuccess: () => {
      toast({ title: 'Deposit details updated' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/end-of-tenancy', selectedTenancyId] });
    },
    onError: () => {
      toast({ title: 'Failed to update deposit', variant: 'destructive' });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('/api/crm/end-of-tenancy/' + selectedTenancyId + '/checkout', "PATCH", data),
    onSuccess: () => {
      toast({ title: 'Checkout details saved' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/end-of-tenancy', selectedTenancyId] });
    },
    onError: () => {
      toast({ title: 'Failed to save checkout details', variant: 'destructive' });
    },
  });

  const checklist = (tenancyDetails?.checklist || []).filter((item: any) =>
    EOT_CHECKLIST_ITEMS.includes(item.item_type)
  );
  const completedCount = checklist.filter((item: any) => item.is_completed).length;
  const totalCount = checklist.length;
  const allComplete = totalCount > 0 && completedCount === totalCount;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const hasChecklist = totalCount > 0;

  const tenancy = tenancyDetails?.tenancy;
  const deposit = tenancyDetails?.depositSummary;

  // Populate form fields when tenancy details load
  useEffect(() => {
    if (tenancy) {
      setMeterElectric(tenancy.final_meter_electric || '');
      setMeterGas(tenancy.final_meter_gas || '');
      setMeterWater(tenancy.final_meter_water || '');
      setCheckoutDate(tenancy.checkout_date ? tenancy.checkout_date.split('T')[0] : '');
      setCheckoutClerk(tenancy.checkout_clerk || '');
      setForwardingAddress(tenancy.forwarding_address || '');
      setDilapidationsAmount(tenancy.dilapidations_amount || '');
      setDilapidationsNotes(tenancy.dilapidations_notes || '');
      setCleaningRequired(tenancy.cleaning_required || false);
      setCleaningCost(tenancy.cleaning_cost || '');
    }
    if (deposit) {
      setDepositDeductions(deposit.depositDeductionsAmount || '');
      setDepositDeductionsReason(deposit.depositDeductionsReason || '');
      setDepositReturnStatus(deposit.depositReturnStatus || 'pending');
    }
  }, [tenancy?.id, deposit?.depositAmount]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-8 w-8" style={{ color: '#791E75' }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
              End of Tenancy
            </h1>
            <p className="text-sm text-muted-foreground">
              15-step checkout process with deposit tracking & DPS integration
            </p>
          </div>
        </div>
        <Button onClick={() => setShowStartDialog(true)} style={{ backgroundColor: '#791E75' }}>
          <Play className="h-4 w-4 mr-2" />
          Start New End of Tenancy
        </Button>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Panel - Ending Tenancies */}
        <div className="col-span-3 space-y-3">
          <h2 className="text-lg font-semibold">Ending Tenancies ({endingTenancies?.length || 0})</h2>
          {endingTenancies && endingTenancies.length > 0 ? (
            endingTenancies.map((t: any) => (
              <Card
                key={t.id}
                className={"cursor-pointer transition-all " + (selectedTenancyId === t.id ? "border-purple-600 ring-2 ring-purple-200" : "hover:border-gray-400")}
                onClick={() => setSelectedTenancyId(t.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <p className="font-medium text-sm leading-tight">{t.property_address}{t.property_postcode ? `, ${t.property_postcode}` : ''}</p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" /> {t.tenant_name}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {t.end_date ? (
                      <Badge variant="secondary" className="text-xs flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Ends {format(new Date(t.end_date), 'dd MMM yyyy')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                        No end date set
                      </Badge>
                    )}
                    {t.notice_type && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {(t.notice_type || '').replace(/_/g, ' ')}
                      </Badge>
                    )}
                  </div>
                  {t.notice_served_date && (
                    <p className="text-xs text-muted-foreground">
                      Notice served: {format(new Date(t.notice_served_date), 'dd MMM yyyy')}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          ) : (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                No ending tenancies. Start one from an active tenancy.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Panel - Checkout Process */}
        <div className="col-span-9">
          {detailLoading && selectedTenancyId ? (
            <Card>
              <CardContent className="p-16 text-center">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground mt-4">Loading tenancy details...</p>
              </CardContent>
            </Card>
          ) : selectedTenancyId && tenancyDetails ? (
            <div className="space-y-4">
              {/* Tenancy Info Strip */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Property</p>
                      <p className="font-medium">{tenancy?.property_address || tenancy?.property_address_line1}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Tenant</p>
                      <p className="font-medium">{tenancy?.tenant_name}</p>
                      {tenancy?.tenant_email && <p className="text-xs text-muted-foreground">{tenancy.tenant_email}</p>}
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Landlord</p>
                      <p className="font-medium">{tenancy?.landlord_name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">End Date</p>
                      <p className="font-medium">
                        {tenancy?.end_date ? format(new Date(tenancy.end_date), 'dd MMM yyyy') : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Deposit</p>
                      <p className="font-medium">
                        {deposit?.depositAmount ? `£${Number(deposit.depositAmount).toLocaleString()}` : 'N/A'}
                        {deposit?.depositScheme && <span className="text-xs text-muted-foreground ml-1">({deposit.depositScheme})</span>}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* If no checklist, show Start Process prompt */}
              {!hasChecklist ? (
                <Card>
                  <CardContent className="p-8 text-center space-y-4">
                    <AlertTriangle className="h-12 w-12 mx-auto text-amber-500" />
                    <div>
                      <h3 className="text-lg font-semibold">End of Tenancy Process Not Started</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        This tenancy is marked as ending but the 15-step checkout process hasn't been initiated yet.
                        Start it now to create the checklist and begin tracking progress.
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Select value={noticeType} onValueChange={setNoticeType}>
                        <SelectTrigger className="w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tenant_notice">Tenant Notice</SelectItem>
                          <SelectItem value="section_21">Section 21 (No-fault)</SelectItem>
                          <SelectItem value="section_8">Section 8 (Grounds)</SelectItem>
                          <SelectItem value="mutual">Mutual Agreement</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={() => startMutation.mutate({ tenancyId: selectedTenancyId, noticeType })}
                        disabled={startMutation.isPending}
                        style={{ backgroundColor: '#791E75' }}
                      >
                        {startMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Start 15-Step Process
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Progress Bar */}
                  <div className="flex items-center gap-4">
                    <Progress value={progressPercent} className="flex-1 h-3" />
                    <span className="text-sm font-medium whitespace-nowrap">{completedCount} / {totalCount} steps</span>
                  </div>

                  {/* Tabs */}
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid grid-cols-4">
                      <TabsTrigger value="checklist">Checklist</TabsTrigger>
                      <TabsTrigger value="deposit">Deposit</TabsTrigger>
                      <TabsTrigger value="meters">Meters & Utilities</TabsTrigger>
                      <TabsTrigger value="checkout">Checkout Details</TabsTrigger>
                    </TabsList>

                    {/* Checklist Tab */}
                    <TabsContent value="checklist">
                      <Card>
                        <CardContent className="p-4 space-y-1">
                          {checklist.map((item: any, index: number) => {
                            const Icon = checklistIcons[item.item_type] || CircleDot;
                            const category = stepCategories[item.item_type] || 'Other';
                            const catColor = categoryColors[category] || 'bg-gray-100 text-gray-800';

                            return (
                              <div
                                key={item.id}
                                className={"flex items-center gap-3 p-3 rounded-lg transition-colors " +
                                  (item.is_completed ? "bg-green-50" : "hover:bg-gray-50")}
                              >
                                <span className="text-xs font-bold text-muted-foreground w-6 text-right">{index + 1}</span>
                                <Checkbox
                                  checked={item.is_completed}
                                  onCheckedChange={(checked: boolean) =>
                                    toggleMutation.mutate({ id: item.id, isCompleted: checked })
                                  }
                                />
                                <Icon className={"h-4 w-4 " + (item.is_completed ? "text-green-600" : "text-gray-400")} />
                                <span className={"flex-1 text-sm " + (item.is_completed ? "line-through text-muted-foreground" : "font-medium")}>
                                  {checklistLabels[item.item_type] || item.item_type}
                                </span>
                                <Badge variant="outline" className={"text-xs " + catColor}>
                                  {category}
                                </Badge>
                                {item.is_completed ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : (
                                  <Clock className="h-4 w-4 text-amber-500" />
                                )}
                                {item.completed_at && (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(item.completed_at), 'dd/MM HH:mm')}
                                  </span>
                                )}
                              </div>
                            );
                          })}

                          <Separator className="my-4" />

                          <Button
                            disabled={!allComplete || completeMutation.isPending}
                            onClick={() => completeMutation.mutate(selectedTenancyId)}
                            className="w-full"
                            style={allComplete ? { backgroundColor: '#791E75' } : {}}
                          >
                            {completeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {allComplete ? 'Close Tenancy' : `Complete all ${totalCount - completedCount} remaining steps to close`}
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Deposit Tab */}
                    <TabsContent value="deposit">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Shield className="h-5 w-5" style={{ color: '#791E75' }} />
                            Deposit Return & Deductions
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Deposit Summary */}
                          <div className="grid grid-cols-3 gap-4">
                            <Card className="bg-blue-50">
                              <CardContent className="p-4 text-center">
                                <p className="text-xs text-muted-foreground">Deposit Held</p>
                                <p className="text-2xl font-bold text-blue-700">
                                  £{deposit?.depositAmount ? Number(deposit.depositAmount).toLocaleString() : '0'}
                                </p>
                                <p className="text-xs text-muted-foreground">{deposit?.depositScheme || 'No scheme'}</p>
                              </CardContent>
                            </Card>
                            <Card className="bg-red-50">
                              <CardContent className="p-4 text-center">
                                <p className="text-xs text-muted-foreground">Deductions</p>
                                <p className="text-2xl font-bold text-red-700">
                                  £{depositDeductions ? Number(depositDeductions).toLocaleString() : '0'}
                                </p>
                              </CardContent>
                            </Card>
                            <Card className="bg-green-50">
                              <CardContent className="p-4 text-center">
                                <p className="text-xs text-muted-foreground">Return to Tenant</p>
                                <p className="text-2xl font-bold text-green-700">
                                  £{deposit?.depositAmount
                                    ? (Number(deposit.depositAmount) - Number(depositDeductions || 0)).toLocaleString()
                                    : '0'}
                                </p>
                              </CardContent>
                            </Card>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Deductions Amount (£)</Label>
                              <Input
                                type="number"
                                value={depositDeductions}
                                onChange={(e) => setDepositDeductions(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <Label>Return Status</Label>
                              <Select value={depositReturnStatus} onValueChange={setDepositReturnStatus}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="agreed">Agreed with Tenant</SelectItem>
                                  <SelectItem value="disputed">Disputed</SelectItem>
                                  <SelectItem value="returned">Returned</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label>Deductions Reason</Label>
                            <Textarea
                              value={depositDeductionsReason}
                              onChange={(e) => setDepositDeductionsReason(e.target.value)}
                              placeholder="Detail the reasons for any deductions (damages, cleaning, unpaid rent, etc.)"
                              rows={3}
                            />
                          </div>

                          <Separator />

                          <h4 className="font-medium">Dilapidations & Cleaning</h4>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Dilapidations Amount (£)</Label>
                              <Input
                                type="number"
                                value={dilapidationsAmount}
                                onChange={(e) => setDilapidationsAmount(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <Label>Cleaning Cost (£)</Label>
                              <Input
                                type="number"
                                value={cleaningCost}
                                onChange={(e) => setCleaningCost(e.target.value)}
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          <div>
                            <Label>Dilapidations Notes</Label>
                            <Textarea
                              value={dilapidationsNotes}
                              onChange={(e) => setDilapidationsNotes(e.target.value)}
                              placeholder="Describe any damages, wear & tear vs. damage, etc."
                              rows={3}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={cleaningRequired}
                              onCheckedChange={(c: boolean) => setCleaningRequired(c)}
                            />
                            <Label>Professional cleaning required</Label>
                          </div>

                          <Button
                            onClick={() => depositMutation.mutate({
                              depositDeductionsAmount: depositDeductions || null,
                              depositDeductionsReason: depositDeductionsReason || null,
                              depositReturnAmount: deposit?.depositAmount
                                ? String(Number(deposit.depositAmount) - Number(depositDeductions || 0))
                                : null,
                              depositReturnStatus,
                              dilapidationsAmount: dilapidationsAmount || null,
                              dilapidationsNotes: dilapidationsNotes || null,
                              cleaningRequired,
                              cleaningCost: cleaningCost || null,
                            })}
                            disabled={depositMutation.isPending}
                            style={{ backgroundColor: '#791E75' }}
                          >
                            {depositMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Deposit Details
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Meters Tab */}
                    <TabsContent value="meters">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Zap className="h-5 w-5" style={{ color: '#791E75' }} />
                            Final Meter Readings
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-3 gap-4">
                            <div>
                              <Label className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-yellow-500" /> Electricity
                              </Label>
                              <Input
                                value={meterElectric}
                                onChange={(e) => setMeterElectric(e.target.value)}
                                placeholder="e.g. 45832"
                              />
                            </div>
                            <div>
                              <Label className="flex items-center gap-2">
                                <Flame className="h-4 w-4 text-orange-500" /> Gas
                              </Label>
                              <Input
                                value={meterGas}
                                onChange={(e) => setMeterGas(e.target.value)}
                                placeholder="e.g. 12456"
                              />
                            </div>
                            <div>
                              <Label className="flex items-center gap-2">
                                <Droplets className="h-4 w-4 text-blue-500" /> Water
                              </Label>
                              <Input
                                value={meterWater}
                                onChange={(e) => setMeterWater(e.target.value)}
                                placeholder="e.g. 00234"
                              />
                            </div>
                          </div>

                          <Button
                            onClick={() => metersMutation.mutate({
                              electric: meterElectric,
                              gas: meterGas,
                              water: meterWater
                            })}
                            disabled={metersMutation.isPending}
                            style={{ backgroundColor: '#791E75' }}
                          >
                            {metersMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Meter Readings
                          </Button>

                          {tenancy?.final_meter_electric && (
                            <div className="bg-green-50 p-3 rounded-lg text-sm">
                              <p className="font-medium text-green-800">Saved readings:</p>
                              <div className="flex gap-6 mt-1 text-green-700">
                                <span>Electric: {tenancy.final_meter_electric}</span>
                                <span>Gas: {tenancy.final_meter_gas}</span>
                                <span>Water: {tenancy.final_meter_water}</span>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </TabsContent>

                    {/* Checkout Details Tab */}
                    <TabsContent value="checkout">
                      <Card>
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-lg">
                            <Home className="h-5 w-5" style={{ color: '#791E75' }} />
                            Checkout Details
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Checkout Date</Label>
                              <Input
                                type="date"
                                value={checkoutDate}
                                onChange={(e) => setCheckoutDate(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label>Checkout Clerk / Inspector</Label>
                              <Input
                                value={checkoutClerk}
                                onChange={(e) => setCheckoutClerk(e.target.value)}
                                placeholder="Name of checkout clerk"
                              />
                            </div>
                          </div>

                          <div>
                            <Label>Forwarding Address</Label>
                            <Textarea
                              value={forwardingAddress}
                              onChange={(e) => setForwardingAddress(e.target.value)}
                              placeholder="Tenant's forwarding address"
                              rows={2}
                            />
                          </div>

                          {tenancyDetails?.openMaintenance?.length > 0 && (
                            <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg">
                              <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                {tenancyDetails.openMaintenance.length} open maintenance ticket(s) for this property
                              </p>
                              <ul className="mt-2 space-y-1">
                                {tenancyDetails.openMaintenance.map((ticket: any) => (
                                  <li key={ticket.id} className="text-xs text-amber-700">
                                    #{ticket.id}: {ticket.title || ticket.description} — {ticket.status}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          <Button
                            onClick={() => checkoutMutation.mutate({
                              checkoutDate: checkoutDate || null,
                              checkoutClerk: checkoutClerk || null,
                              forwardingAddress: forwardingAddress || null,
                            })}
                            disabled={checkoutMutation.isPending}
                            style={{ backgroundColor: '#791E75' }}
                          >
                            {checkoutMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Save Checkout Details
                          </Button>
                        </CardContent>
                      </Card>
                    </TabsContent>
                  </Tabs>
                </>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-16 text-center text-muted-foreground">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p className="text-lg font-medium">Select an ending tenancy</p>
                <p className="text-sm mt-1">Choose a tenancy from the left panel, or start a new end-of-tenancy process.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Start New End of Tenancy Dialog */}
      <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start End of Tenancy Process</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Select Active Tenancy</Label>
              <Select value={startTenancyId} onValueChange={setStartTenancyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a tenancy..." />
                </SelectTrigger>
                <SelectContent>
                  {activeTenancies && activeTenancies.map((t: any) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.property_address} — {t.tenant_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notice Type</Label>
              <Select value={noticeType} onValueChange={setNoticeType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tenant_notice">Tenant Notice</SelectItem>
                  <SelectItem value="section_21">Section 21 (No-fault)</SelectItem>
                  <SelectItem value="section_8">Section 8 (Grounds)</SelectItem>
                  <SelectItem value="mutual">Mutual Agreement</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowStartDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={!startTenancyId || startMutation.isPending}
              onClick={() => startMutation.mutate({ tenancyId: startTenancyId, noticeType })}
              style={{ backgroundColor: '#791E75' }}
            >
              {startMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Start 15-Step Process
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
