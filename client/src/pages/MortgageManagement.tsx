import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Landmark, Loader2, Plus, Pencil, Trash2, Receipt, CalendarClock, PoundSterling, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const fmt = (p: number | null | undefined) => (p != null ? `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-');
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtRate = (bps: number | null | undefined) => (bps != null ? `${(bps / 100).toFixed(2)}%` : '-');

interface Property { id: number; address?: string; title?: string; }
interface Landlord { id: number; name: string; }

interface Mortgage {
  id: number;
  propertyId: number;
  landlordId: number | null;
  propertyAddress?: string;
  landlordName?: string;
  lenderName: string;
  accountNumber: string | null;
  mortgageType: string;
  monthlyPayment: number;
  interestRateBps: number | null;
  termMonths: number | null;
  startDate: string | null;
  dealExpiryDate: string | null;
  endDate: string | null;
  outstandingBalance: number | null;
  nextPaymentDate: string | null;
  payFromRent: boolean;
  payeeSortCode: string | null;
  payeeAccountNumber: string | null;
  payeeReference: string | null;
  status: string;
  notes: string | null;
}

interface MortgagePayment {
  id: number;
  mortgageId: number;
  dueDate: string;
  amount: number;
  paidDate: string | null;
  status: string;
  paymentMethod: string | null;
  reference: string | null;
  notes: string | null;
}

interface Summary {
  activeCount: string; arrearsCount: string; totalMonthly: string;
  totalOutstanding: string; dealsExpiringSoon: string;
}

const MORTGAGE_TYPES = [
  { value: 'buy_to_let', label: 'Buy-to-Let' },
  { value: 'repayment', label: 'Repayment' },
  { value: 'interest_only', label: 'Interest Only' },
];
const STATUSES = ['active', 'in_arrears', 'redeemed', 'closed'];
const PAYMENT_METHODS = ['bank_transfer', 'direct_debit', 'standing_order', 'on_line'];

const statusBadge = (s: string) => {
  const c: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    in_arrears: 'bg-red-100 text-red-800',
    redeemed: 'bg-blue-100 text-blue-800',
    closed: 'bg-gray-100 text-gray-800',
  };
  return <Badge className={`${c[s] ?? 'bg-gray-100 text-gray-800'} border-0 text-xs capitalize`}>{s.replace('_', ' ')}</Badge>;
};

type FormState = {
  propertyId: string; landlordId: string; lenderName: string; accountNumber: string;
  mortgageType: string; monthlyPayment: string; interestRatePct: string; termMonths: string;
  startDate: string; dealExpiryDate: string; endDate: string; outstandingBalance: string;
  nextPaymentDate: string; payFromRent: boolean; payeeSortCode: string; payeeAccountNumber: string;
  payeeReference: string; status: string; notes: string;
};

const emptyForm = (): FormState => ({
  propertyId: '', landlordId: '', lenderName: '', accountNumber: '', mortgageType: 'buy_to_let',
  monthlyPayment: '', interestRatePct: '', termMonths: '', startDate: '', dealExpiryDate: '',
  endDate: '', outstandingBalance: '', nextPaymentDate: '', payFromRent: false, payeeSortCode: '',
  payeeAccountNumber: '', payeeReference: '', status: 'active', notes: '',
});

export default function MortgageManagement() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('active');
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<Mortgage | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [paymentsFor, setPaymentsFor] = useState<Mortgage | null>(null);
  const [payForm, setPayForm] = useState({ dueDate: '', amount: '', paidDate: '', paymentMethod: 'bank_transfer', reference: '' });

  const { data: summary } = useQuery<Summary>({
    queryKey: ['/api/crm/mortgages/summary'],
    queryFn: async () => {
      const res = await fetch('/api/crm/mortgages/summary', { credentials: 'include' });
      if (!res.ok) return {} as Summary;
      return res.json();
    },
  });

  const { data: mortgages = [], isLoading } = useQuery<Mortgage[]>({
    queryKey: ['/api/crm/mortgages', statusFilter],
    queryFn: async () => {
      const qs = statusFilter && statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const res = await fetch(`/api/crm/mortgages${qs}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: upcoming = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/mortgages/upcoming'],
    queryFn: async () => {
      const res = await fetch('/api/crm/mortgages/upcoming?days=45', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/crm/properties'],
    queryFn: async () => {
      const res = await fetch('/api/crm/properties', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.properties ?? []);
    },
  });

  const { data: landlords = [] } = useQuery<Landlord[]>({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const res = await fetch('/api/crm/landlords', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: payments = [] } = useQuery<MortgagePayment[]>({
    queryKey: ['/api/crm/mortgages', paymentsFor?.id, 'payments'],
    queryFn: async () => {
      if (!paymentsFor) return [];
      const res = await fetch(`/api/crm/mortgages/${paymentsFor.id}/payments`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!paymentsFor,
  });

  const propAddress = (id: number) => {
    const p = properties.find((x) => x.id === id);
    return p?.address || p?.title || `Property #${id}`;
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/crm/mortgages'] });
    queryClient.invalidateQueries({ queryKey: ['/api/crm/mortgages/summary'] });
    queryClient.invalidateQueries({ queryKey: ['/api/crm/mortgages/upcoming'] });
  };

  const saveMutation = useMutation({
    mutationFn: async (payload: any) =>
      editing ? apiRequest(`/api/crm/mortgages/${editing.id}`, 'PUT', payload) : apiRequest('/api/crm/mortgages', 'POST', payload),
    onSuccess: () => {
      invalidateAll();
      toast({ title: editing ? 'Mortgage updated' : 'Mortgage created' });
      setShowDialog(false); setEditing(null); setForm(emptyForm());
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/mortgages/${id}`, 'DELETE'),
    onSuccess: () => { invalidateAll(); toast({ title: 'Mortgage deleted' }); setDeleteId(null); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => apiRequest(`/api/crm/mortgages/${paymentsFor!.id}/payments`, 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/mortgages', paymentsFor?.id, 'payments'] });
      invalidateAll();
      toast({ title: 'Payment recorded' });
      setPayForm({ dueDate: '', amount: '', paidDate: '', paymentMethod: 'bank_transfer', reference: '' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openAdd = () => { setForm(emptyForm()); setEditing(null); setShowDialog(true); };
  const openEdit = (m: Mortgage) => {
    setEditing(m);
    setForm({
      propertyId: String(m.propertyId), landlordId: m.landlordId ? String(m.landlordId) : '',
      lenderName: m.lenderName, accountNumber: m.accountNumber ?? '', mortgageType: m.mortgageType,
      monthlyPayment: m.monthlyPayment ? String(m.monthlyPayment / 100) : '',
      interestRatePct: m.interestRateBps != null ? String(m.interestRateBps / 100) : '',
      termMonths: m.termMonths != null ? String(m.termMonths) : '',
      startDate: m.startDate ? m.startDate.slice(0, 10) : '',
      dealExpiryDate: m.dealExpiryDate ? m.dealExpiryDate.slice(0, 10) : '',
      endDate: m.endDate ? m.endDate.slice(0, 10) : '',
      outstandingBalance: m.outstandingBalance != null ? String(m.outstandingBalance / 100) : '',
      nextPaymentDate: m.nextPaymentDate ? m.nextPaymentDate.slice(0, 10) : '',
      payFromRent: m.payFromRent, payeeSortCode: m.payeeSortCode ?? '',
      payeeAccountNumber: m.payeeAccountNumber ?? '', payeeReference: m.payeeReference ?? '',
      status: m.status, notes: m.notes ?? '',
    });
    setShowDialog(true);
  };

  const handleSave = () => {
    if (!form.propertyId || !form.lenderName) {
      toast({ title: 'Property and lender are required', variant: 'destructive' });
      return;
    }
    saveMutation.mutate({
      propertyId: parseInt(form.propertyId),
      landlordId: form.landlordId ? parseInt(form.landlordId) : null,
      lenderName: form.lenderName,
      accountNumber: form.accountNumber || null,
      mortgageType: form.mortgageType,
      monthlyPayment: form.monthlyPayment ? Math.round(parseFloat(form.monthlyPayment) * 100) : 0,
      interestRateBps: form.interestRatePct ? Math.round(parseFloat(form.interestRatePct) * 100) : null,
      termMonths: form.termMonths ? parseInt(form.termMonths) : null,
      startDate: form.startDate || null,
      dealExpiryDate: form.dealExpiryDate || null,
      endDate: form.endDate || null,
      outstandingBalance: form.outstandingBalance ? Math.round(parseFloat(form.outstandingBalance) * 100) : null,
      nextPaymentDate: form.nextPaymentDate || null,
      payFromRent: form.payFromRent,
      payeeSortCode: form.payeeSortCode || null,
      payeeAccountNumber: form.payeeAccountNumber || null,
      payeeReference: form.payeeReference || null,
      status: form.status,
      notes: form.notes || null,
    });
  };

  const handleRecordPayment = () => {
    if (!payForm.amount || !payForm.dueDate) {
      toast({ title: 'Due date and amount are required', variant: 'destructive' });
      return;
    }
    recordPaymentMutation.mutate({
      dueDate: payForm.dueDate,
      amount: Math.round(parseFloat(payForm.amount) * 100),
      paidDate: payForm.paidDate || null,
      status: payForm.paidDate ? 'paid' : 'scheduled',
      paymentMethod: payForm.paymentMethod,
      reference: payForm.reference || null,
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="h-6 w-6 text-[#791E75]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mortgage Management</h1>
            <p className="text-sm text-gray-500">Track landlord buy-to-let mortgages and pay lenders from collected rent</p>
          </div>
        </div>
        <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f175d]" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add Mortgage
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Active</p>
          <p className="text-2xl font-bold text-gray-900">{summary?.activeCount ?? '0'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Monthly Commitment</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(Number(summary?.totalMonthly ?? 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Total Outstanding</p>
          <p className="text-2xl font-bold text-gray-900">{fmt(Number(summary?.totalOutstanding ?? 0))}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">Deals Expiring (90d)</p>
          <p className="text-2xl font-bold text-amber-600">{summary?.dealsExpiringSoon ?? '0'}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-gray-500">In Arrears</p>
          <p className="text-2xl font-bold text-red-600">{summary?.arrearsCount ?? '0'}</p>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="mortgages">
        <TabsList>
          <TabsTrigger value="mortgages">Mortgages</TabsTrigger>
          <TabsTrigger value="upcoming" className="gap-1.5">
            <CalendarClock className="h-3.5 w-3.5" /> Upcoming ({upcoming.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mortgages" className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#791E75]" /></div>
              ) : mortgages.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Landmark className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>No mortgages recorded. Click "Add Mortgage" to start.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Lender</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Monthly</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead>Next Payment</TableHead>
                      <TableHead>Pay From Rent</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mortgages.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.propertyAddress || propAddress(m.propertyId)}</TableCell>
                        <TableCell>{m.lenderName}<div className="text-xs text-gray-400">{m.accountNumber}</div></TableCell>
                        <TableCell className="capitalize">{m.mortgageType.replace('_', ' ')}</TableCell>
                        <TableCell className="text-right">{fmt(m.monthlyPayment)}</TableCell>
                        <TableCell className="text-right">{fmtRate(m.interestRateBps)}</TableCell>
                        <TableCell className="text-right">{fmt(m.outstandingBalance)}</TableCell>
                        <TableCell>{fmtDate(m.nextPaymentDate)}</TableCell>
                        <TableCell>{m.payFromRent ? <Badge className="bg-[#791E75] text-white border-0 text-xs">Yes</Badge> : <span className="text-gray-400 text-xs">No</span>}</TableCell>
                        <TableCell>{statusBadge(m.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Payments" onClick={() => setPaymentsFor(m)}><Receipt className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Delete" onClick={() => setDeleteId(m.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upcoming">
          <Card>
            <CardContent className="p-0">
              {upcoming.length === 0 ? (
                <div className="text-center py-16 text-gray-500">No payments due in the next 45 days.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Lender</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcoming.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell>{fmtDate(u.dueDate)}</TableCell>
                        <TableCell>{u.propertyAddress}</TableCell>
                        <TableCell>{u.lenderName}</TableCell>
                        <TableCell className="text-right">{fmt(u.amount)}</TableCell>
                        <TableCell>{u.status === 'overdue'
                          ? <Badge className="bg-red-100 text-red-800 border-0 text-xs">Overdue</Badge>
                          : <Badge className="bg-blue-100 text-blue-800 border-0 text-xs">Scheduled</Badge>}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add / Edit dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Mortgage' : 'Add Mortgage'}</DialogTitle>
            <DialogDescription>Buy-to-let mortgage linked to a managed property.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Property *</Label>
              <Select value={form.propertyId} onValueChange={(v) => setForm((f) => ({ ...f, propertyId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.address || p.title || `Property #${p.id}`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Landlord</Label>
              <Select value={form.landlordId || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, landlordId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Select landlord" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {landlords.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Lender *</Label><Input value={form.lenderName} onChange={(e) => setForm((f) => ({ ...f, lenderName: e.target.value }))} placeholder="e.g. Bank of Scotland" /></div>
            <div><Label>Account Number</Label><Input value={form.accountNumber} onChange={(e) => setForm((f) => ({ ...f, accountNumber: e.target.value }))} /></div>
            <div>
              <Label>Type</Label>
              <Select value={form.mortgageType} onValueChange={(v) => setForm((f) => ({ ...f, mortgageType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{MORTGAGE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Monthly Payment (£)</Label><Input type="number" step="0.01" value={form.monthlyPayment} onChange={(e) => setForm((f) => ({ ...f, monthlyPayment: e.target.value }))} /></div>
            <div><Label>Interest Rate (%)</Label><Input type="number" step="0.01" value={form.interestRatePct} onChange={(e) => setForm((f) => ({ ...f, interestRatePct: e.target.value }))} /></div>
            <div><Label>Outstanding Balance (£)</Label><Input type="number" step="0.01" value={form.outstandingBalance} onChange={(e) => setForm((f) => ({ ...f, outstandingBalance: e.target.value }))} /></div>
            <div><Label>Term (months)</Label><Input type="number" value={form.termMonths} onChange={(e) => setForm((f) => ({ ...f, termMonths: e.target.value }))} /></div>
            <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} /></div>
            <div><Label>Deal Expiry</Label><Input type="date" value={form.dealExpiryDate} onChange={(e) => setForm((f) => ({ ...f, dealExpiryDate: e.target.value }))} /></div>
            <div><Label>Next Payment Date</Label><Input type="date" value={form.nextPaymentDate} onChange={(e) => setForm((f) => ({ ...f, nextPaymentDate: e.target.value }))} /></div>
            <div><Label>End / Redemption</Label><Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} /></div>
            <div><Label>Payee Sort Code</Label><Input value={form.payeeSortCode} onChange={(e) => setForm((f) => ({ ...f, payeeSortCode: e.target.value }))} placeholder="00-00-00" /></div>
            <div><Label>Payee Account No.</Label><Input value={form.payeeAccountNumber} onChange={(e) => setForm((f) => ({ ...f, payeeAccountNumber: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Payee Reference</Label><Input value={form.payeeReference} onChange={(e) => setForm((f) => ({ ...f, payeeReference: e.target.value }))} /></div>
            <div className="col-span-2 flex items-center gap-2 pt-1">
              <Checkbox id="payFromRent" checked={form.payFromRent} onCheckedChange={(v) => setForm((f) => ({ ...f, payFromRent: v === true }))} />
              <Label htmlFor="payFromRent" className="cursor-pointer">Agency pays this mortgage from collected rent</Label>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payments dialog */}
      <Dialog open={!!paymentsFor} onOpenChange={(o) => !o && setPaymentsFor(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Receipt className="h-5 w-5 text-[#791E75]" /> Mortgage Payments</DialogTitle>
            <DialogDescription>{paymentsFor?.lenderName} — {paymentsFor?.propertyAddress || (paymentsFor && propAddress(paymentsFor.propertyId))}</DialogDescription>
          </DialogHeader>

          <div className="bg-gray-50 rounded-lg p-3 grid grid-cols-4 gap-2 items-end">
            <div><Label className="text-xs">Due Date *</Label><Input type="date" value={payForm.dueDate} onChange={(e) => setPayForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
            <div><Label className="text-xs">Amount (£) *</Label><Input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label className="text-xs">Paid Date</Label><Input type="date" value={payForm.paidDate} onChange={(e) => setPayForm((f) => ({ ...f, paidDate: e.target.value }))} /></div>
            <div>
              <Label className="text-xs">Method</Label>
              <Select value={payForm.paymentMethod} onValueChange={(v) => setPayForm((f) => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-4 flex justify-end">
              <Button size="sm" className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={handleRecordPayment} disabled={recordPaymentMutation.isPending}>
                <PoundSterling className="h-3.5 w-3.5" /> Record Payment
              </Button>
            </div>
          </div>

          {payForm.paidDate && (
            <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Recording as paid will roll the next payment date forward one month.</p>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Due</TableHead><TableHead>Paid</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Method</TableHead><TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-6">No payments recorded yet.</TableCell></TableRow>
              ) : payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{fmtDate(p.dueDate)}</TableCell>
                  <TableCell>{fmtDate(p.paidDate)}</TableCell>
                  <TableCell className="text-right">{fmt(p.amount)}</TableCell>
                  <TableCell className="capitalize">{p.paymentMethod?.replace('_', ' ') || '-'}</TableCell>
                  <TableCell>
                    <Badge className={`${p.status === 'paid' ? 'bg-green-100 text-green-800' : p.status === 'overdue' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'} border-0 text-xs capitalize`}>{p.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Delete mortgage?</DialogTitle>
            <DialogDescription>This removes the mortgage and all its payment history. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
