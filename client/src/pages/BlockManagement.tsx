import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { Building2, Loader2, Plus, Pencil, Trash2, PoundSterling, Send, Users, FileText, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const fmt = (p: number | null | undefined) => (p != null ? `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-');
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
const fmtBps = (b: number | null | undefined) => (b != null ? `${(b / 100).toFixed(2)}%` : '-');

interface Block {
  id: number; name: string; addressLine1: string | null; city: string | null; postcode: string | null;
  freeholderName: string | null; freeholderContact: string | null; managingAgentName: string | null;
  numberOfUnits: number | null; serviceChargeYearEnd: string | null; groundRentAnnualTotal: number | null;
  reserveFundBalance: number | null; insurancePolicyRef: string | null; insuranceExpiry: string | null;
  status: string; notes: string | null; unitCount?: string; outstandingDemands?: string;
}
interface Unit {
  id: number; blockId: number; propertyId: number | null; unitReference: string;
  leaseholderName: string | null; leaseholderContact: string | null; apportionmentBps: number | null;
  groundRentAnnual: number | null; leaseEndDate: string | null; propertyAddress?: string;
}
interface Budget {
  id: number; yearLabel: string; periodStart: string | null; periodEnd: string | null;
  totalBudget: number; reserveContribution: number | null; status: string; notes: string | null;
}
interface Demand {
  id: number; unitId: number | null; budgetId: number | null; demandType: string; description: string | null;
  demandDate: string; dueDate: string | null; amount: number; amountPaid: number; paidDate: string | null;
  status: string; unitReference?: string; leaseholderName?: string;
}
interface BlockDetail extends Block { units: Unit[]; budgets: Budget[]; demands: Demand[]; }

const DEMAND_TYPES = [
  { value: 'service_charge', label: 'Service Charge' },
  { value: 'ground_rent', label: 'Ground Rent' },
  { value: 'reserve_fund', label: 'Reserve Fund' },
  { value: 'major_works', label: 'Major Works' },
  { value: 'admin', label: 'Admin Fee' },
];

const demandStatusBadge = (s: string) => {
  const c: Record<string, string> = {
    issued: 'bg-blue-100 text-blue-800', part_paid: 'bg-amber-100 text-amber-800',
    paid: 'bg-green-100 text-green-800', overdue: 'bg-red-100 text-red-800', cancelled: 'bg-gray-100 text-gray-800',
  };
  return <Badge className={`${c[s] ?? 'bg-gray-100 text-gray-800'} border-0 text-xs capitalize`}>{s.replace('_', ' ')}</Badge>;
};

export default function BlockManagement() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [editingBlock, setEditingBlock] = useState<Block | null>(null);
  const [blockForm, setBlockForm] = useState<any>({});
  const [showUnitDialog, setShowUnitDialog] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState<any>({});
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [budgetForm, setBudgetForm] = useState<any>({});
  const [showDemandDialog, setShowDemandDialog] = useState(false);
  const [demandForm, setDemandForm] = useState<any>({ demandType: 'service_charge' });
  const [showIssueAll, setShowIssueAll] = useState(false);
  const [issueAllForm, setIssueAllForm] = useState<any>({ demandType: 'service_charge' });

  const { data: blocks = [], isLoading } = useQuery<Block[]>({
    queryKey: ['/api/crm/blocks'],
    queryFn: async () => {
      const res = await fetch('/api/crm/blocks', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: detail } = useQuery<BlockDetail>({
    queryKey: ['/api/crm/blocks', selectedId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/blocks/${selectedId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load block');
      return res.json();
    },
    enabled: !!selectedId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/crm/blocks'] });
    if (selectedId) queryClient.invalidateQueries({ queryKey: ['/api/crm/blocks', selectedId] });
  };

  // ── block mutations ──
  const saveBlock = useMutation({
    mutationFn: (p: any) => editingBlock ? apiRequest(`/api/crm/blocks/${editingBlock.id}`, 'PUT', p) : apiRequest('/api/crm/blocks', 'POST', p),
    onSuccess: () => { invalidate(); toast({ title: editingBlock ? 'Block updated' : 'Block created' }); setShowBlockDialog(false); setEditingBlock(null); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const deleteBlock = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/blocks/${id}`, 'DELETE'),
    onSuccess: () => { invalidate(); toast({ title: 'Block deleted' }); setSelectedId(null); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── unit mutations ──
  const saveUnit = useMutation({
    mutationFn: (p: any) => editingUnit ? apiRequest(`/api/crm/blocks/units/${editingUnit.id}`, 'PUT', p) : apiRequest(`/api/crm/blocks/${selectedId}/units`, 'POST', p),
    onSuccess: () => { invalidate(); toast({ title: 'Unit saved' }); setShowUnitDialog(false); setEditingUnit(null); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const deleteUnit = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/blocks/units/${id}`, 'DELETE'),
    onSuccess: () => { invalidate(); toast({ title: 'Unit removed' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── budget mutations ──
  const saveBudget = useMutation({
    mutationFn: (p: any) => apiRequest(`/api/crm/blocks/${selectedId}/budgets`, 'POST', p),
    onSuccess: () => { invalidate(); toast({ title: 'Budget added' }); setShowBudgetDialog(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  // ── demand mutations ──
  const saveDemand = useMutation({
    mutationFn: (p: any) => apiRequest(`/api/crm/blocks/${selectedId}/demands`, 'POST', p),
    onSuccess: () => { invalidate(); toast({ title: 'Demand issued' }); setShowDemandDialog(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const issueAll = useMutation({
    mutationFn: (p: any) => apiRequest(`/api/crm/blocks/${selectedId}/demands/issue-all`, 'POST', p),
    onSuccess: (r: any) => { invalidate(); toast({ title: `Issued ${r?.created ?? 0} demands` }); setShowIssueAll(false); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const payDemand = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) => apiRequest(`/api/crm/blocks/demands/${id}/pay`, 'POST', { amount }),
    onSuccess: () => { invalidate(); toast({ title: 'Payment recorded' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const deleteDemand = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/blocks/demands/${id}`, 'DELETE'),
    onSuccess: () => { invalidate(); toast({ title: 'Demand deleted' }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openAddBlock = () => { setEditingBlock(null); setBlockForm({ status: 'active' }); setShowBlockDialog(true); };
  const openEditBlock = (b: Block) => {
    setEditingBlock(b);
    setBlockForm({
      name: b.name, addressLine1: b.addressLine1 ?? '', city: b.city ?? '', postcode: b.postcode ?? '',
      freeholderName: b.freeholderName ?? '', freeholderContact: b.freeholderContact ?? '',
      managingAgentName: b.managingAgentName ?? '', numberOfUnits: b.numberOfUnits ?? '',
      serviceChargeYearEnd: b.serviceChargeYearEnd ?? '',
      groundRentAnnualTotal: b.groundRentAnnualTotal != null ? b.groundRentAnnualTotal / 100 : '',
      reserveFundBalance: b.reserveFundBalance != null ? b.reserveFundBalance / 100 : '',
      insurancePolicyRef: b.insurancePolicyRef ?? '', insuranceExpiry: b.insuranceExpiry ? b.insuranceExpiry.slice(0, 10) : '',
      status: b.status, notes: b.notes ?? '',
    });
    setShowBlockDialog(true);
  };
  const submitBlock = () => {
    if (!blockForm.name) { toast({ title: 'Block name is required', variant: 'destructive' }); return; }
    saveBlock.mutate({
      ...blockForm,
      numberOfUnits: blockForm.numberOfUnits ? parseInt(blockForm.numberOfUnits) : 0,
      groundRentAnnualTotal: blockForm.groundRentAnnualTotal ? Math.round(parseFloat(blockForm.groundRentAnnualTotal) * 100) : 0,
      reserveFundBalance: blockForm.reserveFundBalance ? Math.round(parseFloat(blockForm.reserveFundBalance) * 100) : 0,
      insuranceExpiry: blockForm.insuranceExpiry || null,
    });
  };

  const openAddUnit = () => { setEditingUnit(null); setUnitForm({}); setShowUnitDialog(true); };
  const openEditUnit = (u: Unit) => {
    setEditingUnit(u);
    setUnitForm({
      unitReference: u.unitReference, leaseholderName: u.leaseholderName ?? '', leaseholderContact: u.leaseholderContact ?? '',
      apportionmentPct: u.apportionmentBps != null ? u.apportionmentBps / 100 : '',
      groundRentAnnual: u.groundRentAnnual != null ? u.groundRentAnnual / 100 : '',
      leaseEndDate: u.leaseEndDate ? u.leaseEndDate.slice(0, 10) : '',
    });
    setShowUnitDialog(true);
  };
  const submitUnit = () => {
    if (!unitForm.unitReference) { toast({ title: 'Unit reference is required', variant: 'destructive' }); return; }
    saveUnit.mutate({
      unitReference: unitForm.unitReference, leaseholderName: unitForm.leaseholderName || null,
      leaseholderContact: unitForm.leaseholderContact || null,
      apportionmentBps: unitForm.apportionmentPct ? Math.round(parseFloat(unitForm.apportionmentPct) * 100) : null,
      groundRentAnnual: unitForm.groundRentAnnual ? Math.round(parseFloat(unitForm.groundRentAnnual) * 100) : 0,
      leaseEndDate: unitForm.leaseEndDate || null,
    });
  };

  const submitBudget = () => {
    if (!budgetForm.yearLabel) { toast({ title: 'Year label is required', variant: 'destructive' }); return; }
    saveBudget.mutate({
      yearLabel: budgetForm.yearLabel, periodStart: budgetForm.periodStart || null, periodEnd: budgetForm.periodEnd || null,
      totalBudget: budgetForm.totalBudget ? Math.round(parseFloat(budgetForm.totalBudget) * 100) : 0,
      reserveContribution: budgetForm.reserveContribution ? Math.round(parseFloat(budgetForm.reserveContribution) * 100) : 0,
      status: budgetForm.status || 'draft', notes: budgetForm.notes || null,
    });
  };

  const submitDemand = () => {
    if (!demandForm.amount || !demandForm.demandDate) { toast({ title: 'Amount and demand date are required', variant: 'destructive' }); return; }
    saveDemand.mutate({
      unitId: demandForm.unitId ? parseInt(demandForm.unitId) : null,
      demandType: demandForm.demandType, description: demandForm.description || null,
      demandDate: demandForm.demandDate, dueDate: demandForm.dueDate || null,
      amount: Math.round(parseFloat(demandForm.amount) * 100),
    });
  };

  const submitIssueAll = () => {
    if (!issueAllForm.totalAmount || !issueAllForm.demandDate) { toast({ title: 'Total amount and demand date are required', variant: 'destructive' }); return; }
    issueAll.mutate({
      demandType: issueAllForm.demandType, description: issueAllForm.description || null,
      demandDate: issueAllForm.demandDate, dueDate: issueAllForm.dueDate || null,
      totalAmount: Math.round(parseFloat(issueAllForm.totalAmount) * 100),
    });
  };

  // ── LIST VIEW ──
  if (!selectedId) {
    return (
      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-[#791E75]" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Block Management</h1>
              <p className="text-sm text-gray-500">Manage blocks of flats: freeholders, leaseholders, service charges & ground rent</p>
            </div>
          </div>
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={openAddBlock}><Plus className="h-4 w-4" /> Add Block</Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#791E75]" /></div>
        ) : blocks.length === 0 ? (
          <Card><CardContent className="text-center py-16 text-gray-500">
            <Building2 className="h-10 w-10 mx-auto mb-2 text-gray-300" />
            <p>No blocks yet. Click "Add Block" to create one.</p>
          </CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {blocks.map((b) => (
              <Card key={b.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedId(b.id)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold text-gray-900">{b.name}</p>
                      <p className="text-xs text-gray-500">{[b.addressLine1, b.city, b.postcode].filter(Boolean).join(', ')}</p>
                    </div>
                    <Badge className={`${b.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} border-0 text-xs capitalize`}>{b.status}</Badge>
                  </div>
                  <div className="flex items-center gap-4 text-sm pt-1">
                    <span className="flex items-center gap-1 text-gray-600"><Users className="h-3.5 w-3.5" /> {b.unitCount ?? 0} units</span>
                    {Number(b.outstandingDemands ?? 0) > 0 && (
                      <span className="flex items-center gap-1 text-red-600 font-medium">{fmt(Number(b.outstandingDemands))} outstanding</span>
                    )}
                  </div>
                  {b.freeholderName && <p className="text-xs text-gray-400">Freeholder: {b.freeholderName}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        <BlockDialog />
      </div>
    );
  }

  // ── DETAIL VIEW ──
  function BlockDialog() {
    return (
      <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBlock ? 'Edit Block' : 'Add Block'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Block Name *</Label><Input value={blockForm.name ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, name: e.target.value }))} placeholder="e.g. Hyde Park Mansions" /></div>
            <div className="col-span-2"><Label>Address Line 1</Label><Input value={blockForm.addressLine1 ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, addressLine1: e.target.value }))} /></div>
            <div><Label>City</Label><Input value={blockForm.city ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, city: e.target.value }))} /></div>
            <div><Label>Postcode</Label><Input value={blockForm.postcode ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, postcode: e.target.value }))} /></div>
            <div><Label>Freeholder</Label><Input value={blockForm.freeholderName ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, freeholderName: e.target.value }))} /></div>
            <div><Label>Freeholder Contact</Label><Input value={blockForm.freeholderContact ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, freeholderContact: e.target.value }))} /></div>
            <div><Label>Managing Agent (if 3rd party)</Label><Input value={blockForm.managingAgentName ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, managingAgentName: e.target.value }))} /></div>
            <div><Label>No. of Units</Label><Input type="number" value={blockForm.numberOfUnits ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, numberOfUnits: e.target.value }))} /></div>
            <div><Label>Service Charge Year End</Label><Input value={blockForm.serviceChargeYearEnd ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, serviceChargeYearEnd: e.target.value }))} placeholder="e.g. 31 March" /></div>
            <div><Label>Ground Rent / yr (£)</Label><Input type="number" step="0.01" value={blockForm.groundRentAnnualTotal ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, groundRentAnnualTotal: e.target.value }))} /></div>
            <div><Label>Reserve Fund (£)</Label><Input type="number" step="0.01" value={blockForm.reserveFundBalance ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, reserveFundBalance: e.target.value }))} /></div>
            <div><Label>Insurance Policy Ref</Label><Input value={blockForm.insurancePolicyRef ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, insurancePolicyRef: e.target.value }))} /></div>
            <div><Label>Insurance Expiry</Label><Input type="date" value={blockForm.insuranceExpiry ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, insuranceExpiry: e.target.value }))} /></div>
            <div>
              <Label>Status</Label>
              <Select value={blockForm.status ?? 'active'} onValueChange={(v) => setBlockForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="inactive">Inactive</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Notes</Label><Textarea value={blockForm.notes ?? ''} onChange={(e) => setBlockForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBlockDialog(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={submitBlock} disabled={saveBlock.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const b = detail;
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)}><ArrowLeft className="h-5 w-5" /></Button>
          <Building2 className="h-6 w-6 text-[#791E75]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{b?.name ?? 'Block'}</h1>
            <p className="text-sm text-gray-500">{b && [b.addressLine1, b.city, b.postcode].filter(Boolean).join(', ')}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-1.5" onClick={() => b && openEditBlock(b)}><Pencil className="h-4 w-4" /> Edit</Button>
          <Button variant="outline" className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50" onClick={() => b && deleteBlock.mutate(b.id)}><Trash2 className="h-4 w-4" /> Delete</Button>
        </div>
      </div>

      {b && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Units</p><p className="text-2xl font-bold">{b.units.length}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Ground Rent / yr</p><p className="text-2xl font-bold">{fmt(b.groundRentAnnualTotal)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Reserve Fund</p><p className="text-2xl font-bold">{fmt(b.reserveFundBalance)}</p></CardContent></Card>
          <Card><CardContent className="p-4"><p className="text-xs text-gray-500">Outstanding Demands</p><p className="text-2xl font-bold text-red-600">{fmt(b.demands.filter((d) => d.status !== 'paid' && d.status !== 'cancelled').reduce((s, d) => s + (d.amount - d.amountPaid), 0))}</p></CardContent></Card>
        </div>
      )}

      <Tabs defaultValue="units">
        <TabsList>
          <TabsTrigger value="units" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Units</TabsTrigger>
          <TabsTrigger value="budgets" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Budgets</TabsTrigger>
          <TabsTrigger value="demands" className="gap-1.5"><PoundSterling className="h-3.5 w-3.5" /> Demands</TabsTrigger>
        </TabsList>

        {/* UNITS */}
        <TabsContent value="units" className="space-y-3">
          <div className="flex justify-end"><Button size="sm" className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={openAddUnit}><Plus className="h-3.5 w-3.5" /> Add Unit</Button></div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Unit</TableHead><TableHead>Leaseholder</TableHead>
                <TableHead className="text-right">Apportionment</TableHead>
                <TableHead className="text-right">Ground Rent</TableHead>
                <TableHead>Lease End</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {!b?.units.length ? <TableRow><TableCell colSpan={6} className="text-center text-gray-400 py-6">No units yet.</TableCell></TableRow>
                  : b.units.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.unitReference}</TableCell>
                      <TableCell>{u.leaseholderName || '-'}<div className="text-xs text-gray-400">{u.leaseholderContact}</div></TableCell>
                      <TableCell className="text-right">{fmtBps(u.apportionmentBps)}</TableCell>
                      <TableCell className="text-right">{fmt(u.groundRentAnnual)}</TableCell>
                      <TableCell>{fmtDate(u.leaseEndDate)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditUnit(u)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteUnit.mutate(u.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* BUDGETS */}
        <TabsContent value="budgets" className="space-y-3">
          <div className="flex justify-end"><Button size="sm" className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={() => { setBudgetForm({ status: 'draft' }); setShowBudgetDialog(true); }}><Plus className="h-3.5 w-3.5" /> Add Budget</Button></div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Year</TableHead><TableHead>Period</TableHead>
                <TableHead className="text-right">Total Budget</TableHead>
                <TableHead className="text-right">Reserve Contribution</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {!b?.budgets.length ? <TableRow><TableCell colSpan={5} className="text-center text-gray-400 py-6">No budgets yet.</TableCell></TableRow>
                  : b.budgets.map((bg) => (
                    <TableRow key={bg.id}>
                      <TableCell className="font-medium">{bg.yearLabel}</TableCell>
                      <TableCell>{fmtDate(bg.periodStart)} – {fmtDate(bg.periodEnd)}</TableCell>
                      <TableCell className="text-right">{fmt(bg.totalBudget)}</TableCell>
                      <TableCell className="text-right">{fmt(bg.reserveContribution)}</TableCell>
                      <TableCell><Badge className="bg-gray-100 text-gray-800 border-0 text-xs capitalize">{bg.status}</Badge></TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* DEMANDS */}
        <TabsContent value="demands" className="space-y-3">
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { setIssueAllForm({ demandType: 'service_charge' }); setShowIssueAll(true); }}><Send className="h-3.5 w-3.5" /> Issue to All Units</Button>
            <Button size="sm" className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={() => { setDemandForm({ demandType: 'service_charge' }); setShowDemandDialog(true); }}><Plus className="h-3.5 w-3.5" /> New Demand</Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Unit</TableHead><TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Paid</TableHead>
                <TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {!b?.demands.length ? <TableRow><TableCell colSpan={8} className="text-center text-gray-400 py-6">No demands issued.</TableCell></TableRow>
                  : b.demands.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{fmtDate(d.demandDate)}</TableCell>
                      <TableCell>{d.unitReference || 'Block-wide'}{d.leaseholderName && <div className="text-xs text-gray-400">{d.leaseholderName}</div>}</TableCell>
                      <TableCell className="capitalize">{d.demandType.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right">{fmt(d.amount)}</TableCell>
                      <TableCell className="text-right">{fmt(d.amountPaid)}</TableCell>
                      <TableCell>{fmtDate(d.dueDate)}</TableCell>
                      <TableCell>{demandStatusBadge(d.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {d.status !== 'paid' && d.status !== 'cancelled' && (
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" title="Record full payment"
                              onClick={() => payDemand.mutate({ id: d.id, amount: d.amount - d.amountPaid })}><PoundSterling className="h-3.5 w-3.5" /></Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => deleteDemand.mutate(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <BlockDialog />

      {/* Unit dialog */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingUnit ? 'Edit Unit' : 'Add Unit'}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Unit Reference *</Label><Input value={unitForm.unitReference ?? ''} onChange={(e) => setUnitForm((f: any) => ({ ...f, unitReference: e.target.value }))} placeholder="e.g. Flat 3" /></div>
            <div><Label>Leaseholder</Label><Input value={unitForm.leaseholderName ?? ''} onChange={(e) => setUnitForm((f: any) => ({ ...f, leaseholderName: e.target.value }))} /></div>
            <div><Label>Contact</Label><Input value={unitForm.leaseholderContact ?? ''} onChange={(e) => setUnitForm((f: any) => ({ ...f, leaseholderContact: e.target.value }))} /></div>
            <div><Label>Apportionment (%)</Label><Input type="number" step="0.01" value={unitForm.apportionmentPct ?? ''} onChange={(e) => setUnitForm((f: any) => ({ ...f, apportionmentPct: e.target.value }))} placeholder="e.g. 12.5" /></div>
            <div><Label>Ground Rent / yr (£)</Label><Input type="number" step="0.01" value={unitForm.groundRentAnnual ?? ''} onChange={(e) => setUnitForm((f: any) => ({ ...f, groundRentAnnual: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Lease End Date</Label><Input type="date" value={unitForm.leaseEndDate ?? ''} onChange={(e) => setUnitForm((f: any) => ({ ...f, leaseEndDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnitDialog(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={submitUnit} disabled={saveUnit.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Budget dialog */}
      <Dialog open={showBudgetDialog} onOpenChange={setShowBudgetDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Add Service-Charge Budget</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Year Label *</Label><Input value={budgetForm.yearLabel ?? ''} onChange={(e) => setBudgetForm((f: any) => ({ ...f, yearLabel: e.target.value }))} placeholder="e.g. 2025/26" /></div>
            <div><Label>Period Start</Label><Input type="date" value={budgetForm.periodStart ?? ''} onChange={(e) => setBudgetForm((f: any) => ({ ...f, periodStart: e.target.value }))} /></div>
            <div><Label>Period End</Label><Input type="date" value={budgetForm.periodEnd ?? ''} onChange={(e) => setBudgetForm((f: any) => ({ ...f, periodEnd: e.target.value }))} /></div>
            <div><Label>Total Budget (£)</Label><Input type="number" step="0.01" value={budgetForm.totalBudget ?? ''} onChange={(e) => setBudgetForm((f: any) => ({ ...f, totalBudget: e.target.value }))} /></div>
            <div><Label>Reserve Contribution (£)</Label><Input type="number" step="0.01" value={budgetForm.reserveContribution ?? ''} onChange={(e) => setBudgetForm((f: any) => ({ ...f, reserveContribution: e.target.value }))} /></div>
            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={budgetForm.status ?? 'draft'} onValueChange={(v) => setBudgetForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="issued">Issued</SelectItem><SelectItem value="closed">Closed</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBudgetDialog(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={submitBudget} disabled={saveBudget.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single demand dialog */}
      <Dialog open={showDemandDialog} onOpenChange={setShowDemandDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New Service-Charge Demand</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Unit</Label>
              <Select value={demandForm.unitId ?? 'none'} onValueChange={(v) => setDemandForm((f: any) => ({ ...f, unitId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="Block-wide" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Block-wide (no specific unit)</SelectItem>
                  {b?.units.map((u) => <SelectItem key={u.id} value={String(u.id)}>{u.unitReference}{u.leaseholderName ? ` — ${u.leaseholderName}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Type</Label>
              <Select value={demandForm.demandType} onValueChange={(v) => setDemandForm((f: any) => ({ ...f, demandType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEMAND_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Amount (£) *</Label><Input type="number" step="0.01" value={demandForm.amount ?? ''} onChange={(e) => setDemandForm((f: any) => ({ ...f, amount: e.target.value }))} /></div>
            <div><Label>Demand Date *</Label><Input type="date" value={demandForm.demandDate ?? ''} onChange={(e) => setDemandForm((f: any) => ({ ...f, demandDate: e.target.value }))} /></div>
            <div><Label>Due Date</Label><Input type="date" value={demandForm.dueDate ?? ''} onChange={(e) => setDemandForm((f: any) => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Description</Label><Input value={demandForm.description ?? ''} onChange={(e) => setDemandForm((f: any) => ({ ...f, description: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDemandDialog(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={submitDemand} disabled={saveDemand.isPending}>Issue Demand</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue-to-all dialog */}
      <Dialog open={showIssueAll} onOpenChange={setShowIssueAll}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Issue Demand to All Units</DialogTitle>
            <DialogDescription>Splits the total across units by their apportionment share (equal split where none is set).</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={issueAllForm.demandType} onValueChange={(v) => setIssueAllForm((f: any) => ({ ...f, demandType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DEMAND_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Total Amount (£) *</Label><Input type="number" step="0.01" value={issueAllForm.totalAmount ?? ''} onChange={(e) => setIssueAllForm((f: any) => ({ ...f, totalAmount: e.target.value }))} /></div>
            <div><Label>Demand Date *</Label><Input type="date" value={issueAllForm.demandDate ?? ''} onChange={(e) => setIssueAllForm((f: any) => ({ ...f, demandDate: e.target.value }))} /></div>
            <div><Label>Due Date</Label><Input type="date" value={issueAllForm.dueDate ?? ''} onChange={(e) => setIssueAllForm((f: any) => ({ ...f, dueDate: e.target.value }))} /></div>
            <div className="col-span-2"><Label>Description</Label><Input value={issueAllForm.description ?? ''} onChange={(e) => setIssueAllForm((f: any) => ({ ...f, description: e.target.value }))} placeholder="e.g. Q1 service charge 2025/26" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowIssueAll(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={submitIssueAll} disabled={issueAll.isPending}>Issue to All</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
