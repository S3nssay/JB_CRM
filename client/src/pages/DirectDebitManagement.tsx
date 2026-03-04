import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  CreditCard, Plus, Loader2, Check, ChevronsUpDown, XCircle,
  CheckCircle, Clock, AlertTriangle, Banknote,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface GocardlessMandate {
  id: number;
  tenantId: number;
  tenancyId: number | null;
  propertyId: number | null;
  gocardlessMandateId: string | null;
  gocardlessCustomerId: string | null;
  status: string;
  reference: string | null;
  bankName: string | null;
  accountHolderName: string | null;
  accountNumberEnding: string | null;
  redirectFlowUrl: string | null;
  createdAt: string;
}

interface GocardlessPayment {
  id: number;
  mandateId: number;
  invoiceId: number | null;
  gocardlessPaymentId: string | null;
  amount: number;
  description: string | null;
  chargeDate: string | null;
  status: string;
  failureReason: string | null;
  paidOutAt: string | null;
  createdAt: string;
}

interface TenantOption {
  id: number;
  name: string;
  email: string | null;
}

const formatCurrency = (pence: number) => `£${(pence / 100).toFixed(2)}`;
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function DirectDebitManagement() {
  const { toast } = useToast();
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  const [showPaymentsDialog, setShowPaymentsDialog] = useState(false);
  const [selectedMandate, setSelectedMandate] = useState<GocardlessMandate | null>(null);
  const [selectedTenantId, setSelectedTenantId] = useState<number | null>(null);
  const [tenantOpen, setTenantOpen] = useState(false);

  // Check if URL has setup=success param
  const urlParams = new URLSearchParams(window.location.search);
  const setupStatus = urlParams.get('setup');

  // Queries
  const { data: gcConfig } = useQuery<{ configured: boolean }>({
    queryKey: ['/api/crm/gocardless/config'],
    queryFn: async () => {
      const res = await fetch('/api/crm/gocardless/config', { credentials: 'include' });
      if (!res.ok) return { configured: false };
      return res.json();
    },
  });

  const { data: mandates = [], isLoading } = useQuery<GocardlessMandate[]>({
    queryKey: ['/api/crm/gocardless/mandates'],
    queryFn: async () => {
      const res = await fetch('/api/crm/gocardless/mandates', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: mandatePayments = [] } = useQuery<GocardlessPayment[]>({
    queryKey: ['/api/crm/gocardless/mandates', selectedMandate?.id, 'payments'],
    queryFn: async () => {
      if (!selectedMandate) return [];
      const res = await fetch(`/api/crm/gocardless/mandates/${selectedMandate.id}/payments`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!selectedMandate,
  });

  const { data: tenants = [] } = useQuery<TenantOption[]>({
    queryKey: ['/api/crm/tenants'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tenants', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Setup mandate mutation
  const setupMandateMutation = useMutation({
    mutationFn: async (tenantId: number) => {
      const res = await fetch('/api/crm/gocardless/setup-mandate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tenantId, description: 'Monthly rent Direct Debit' }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to set up mandate');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Redirect Flow Created', description: 'Share the setup link with the tenant.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/gocardless/mandates'] });
      setShowSetupDialog(false);
      setSelectedTenantId(null);
      // Open redirect URL in new tab for admin to share
      if (data.redirectUrl) {
        window.open(data.redirectUrl, '_blank');
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Cancel mandate mutation
  const cancelMandateMutation = useMutation({
    mutationFn: async (mandateId: number) => {
      const res = await fetch(`/api/crm/gocardless/mandates/${mandateId}`, {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to cancel mandate');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Mandate Cancelled' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/gocardless/mandates'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { className: string; icon: typeof CheckCircle }> = {
      active: { className: 'bg-green-100 text-green-800', icon: CheckCircle },
      pending_submission: { className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      submitted: { className: 'bg-blue-100 text-blue-800', icon: Clock },
      failed: { className: 'bg-red-100 text-red-800', icon: XCircle },
      cancelled: { className: 'bg-gray-100 text-gray-800', icon: XCircle },
      expired: { className: 'bg-gray-100 text-gray-800', icon: AlertTriangle },
    };
    const style = styles[status] || styles.pending_submission;
    const Icon = style.icon;
    return <Badge className={style.className}><Icon className="h-3 w-3 mr-1" />{status.replace(/_/g, ' ')}</Badge>;
  };

  const tenantMap = new Map(tenants.map(t => [t.id, t.name]));
  const activeMandates = mandates.filter(m => m.status === 'active');
  const pendingMandates = mandates.filter(m => m.status === 'pending_submission' || m.status === 'submitted');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Direct Debit Management</h1>
          <p className="text-muted-foreground">Manage GoCardless Direct Debit mandates for tenants</p>
        </div>
        <Button onClick={() => setShowSetupDialog(true)} disabled={!gcConfig?.configured}>
          <Plus className="h-4 w-4 mr-2" />
          Setup New Mandate
        </Button>
      </div>

      {!gcConfig?.configured && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="font-medium text-yellow-800">GoCardless Not Configured</p>
                <p className="text-sm text-yellow-700">Set GOCARDLESS_ACCESS_TOKEN in your environment variables to enable Direct Debit.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {setupStatus === 'success' && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="font-medium text-green-800">Direct Debit mandate set up successfully!</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg"><CheckCircle className="h-5 w-5 text-green-600" /></div>
              <div>
                <div className="text-sm text-muted-foreground">Active Mandates</div>
                <div className="text-2xl font-bold">{activeMandates.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg"><Clock className="h-5 w-5 text-yellow-600" /></div>
              <div>
                <div className="text-sm text-muted-foreground">Pending Setup</div>
                <div className="text-2xl font-bold">{pendingMandates.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><CreditCard className="h-5 w-5 text-blue-600" /></div>
              <div>
                <div className="text-sm text-muted-foreground">Total Mandates</div>
                <div className="text-2xl font-bold">{mandates.length}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mandates Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Mandates</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : mandates.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No Direct Debit mandates yet</p>
              <p className="text-sm mt-1">Set up a mandate for a tenant to start collecting rent automatically</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mandates.map((mandate) => (
                  <TableRow key={mandate.id}>
                    <TableCell className="font-medium">{tenantMap.get(mandate.tenantId) || `Tenant #${mandate.tenantId}`}</TableCell>
                    <TableCell className="font-mono text-sm">{mandate.reference || mandate.gocardlessMandateId || '-'}</TableCell>
                    <TableCell>{mandate.bankName || '-'}</TableCell>
                    <TableCell>{mandate.accountNumberEnding ? `****${mandate.accountNumberEnding}` : '-'}</TableCell>
                    <TableCell>{getStatusBadge(mandate.status)}</TableCell>
                    <TableCell>{formatDate(mandate.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {mandate.status === 'active' && (
                          <>
                            <Button variant="ghost" size="sm" title="View Payments" onClick={() => { setSelectedMandate(mandate); setShowPaymentsDialog(true); }}>
                              <Banknote className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" title="Cancel Mandate" onClick={() => {
                              if (confirm('Are you sure you want to cancel this Direct Debit mandate?')) {
                                cancelMandateMutation.mutate(mandate.id);
                              }
                            }}>
                              <XCircle className="h-4 w-4 text-red-500" />
                            </Button>
                          </>
                        )}
                        {mandate.status === 'pending_submission' && mandate.redirectFlowUrl && (
                          <Button variant="ghost" size="sm" title="Copy Setup Link" onClick={() => {
                            navigator.clipboard.writeText(mandate.redirectFlowUrl!);
                            toast({ title: 'Link Copied', description: 'Share this with the tenant to complete DD setup.' });
                          }}>
                            <CreditCard className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Setup Mandate Dialog */}
      <Dialog open={showSetupDialog} onOpenChange={setShowSetupDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Setup Direct Debit Mandate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This creates a GoCardless redirect flow. The tenant will be directed to their bank to authorise the Direct Debit.
            </p>
            <div className="space-y-2">
              <Label>Select Tenant</Label>
              <Popover open={tenantOpen} onOpenChange={setTenantOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedTenantId ? tenantMap.get(selectedTenantId) || `#${selectedTenantId}` : 'Search tenants...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0">
                  <Command>
                    <CommandInput placeholder="Search by tenant name..." />
                    <CommandList>
                      <CommandEmpty>No tenants found.</CommandEmpty>
                      <CommandGroup>
                        {tenants.map((t) => (
                          <CommandItem key={t.id} value={t.name || ''} onSelect={() => { setSelectedTenantId(t.id); setTenantOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedTenantId === t.id ? "opacity-100" : "opacity-0")} />
                            {t.name}
                            {t.email && <span className="ml-2 text-xs text-muted-foreground">{t.email}</span>}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSetupDialog(false)}>Cancel</Button>
            <Button onClick={() => selectedTenantId && setupMandateMutation.mutate(selectedTenantId)} disabled={setupMandateMutation.isPending || !selectedTenantId}>
              {setupMandateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Setup Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payments History Dialog */}
      <Dialog open={showPaymentsDialog} onOpenChange={(open) => { if (!open) { setShowPaymentsDialog(false); setSelectedMandate(null); } }}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>DD Payment History</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedMandate && (
              <div className="bg-muted/50 rounded-lg p-3 mb-4 space-y-1">
                <p className="text-sm font-medium">Tenant: {tenantMap.get(selectedMandate.tenantId) || `#${selectedMandate.tenantId}`}</p>
                <p className="text-xs text-muted-foreground">Mandate: {selectedMandate.reference || selectedMandate.gocardlessMandateId}</p>
              </div>
            )}
            {mandatePayments.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">No payments collected yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mandatePayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{formatDate(p.chargeDate || p.createdAt)}</TableCell>
                      <TableCell>{p.description || '-'}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(p.amount)}</TableCell>
                      <TableCell>{getStatusBadge(p.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
