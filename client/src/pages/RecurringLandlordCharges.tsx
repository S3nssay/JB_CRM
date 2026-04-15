import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { RefreshCw, Loader2, Plus, Pencil, Trash2, ChevronsUpDown, Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

const fmt = (p: number | null | undefined) => p != null ? `£${(p / 100).toFixed(2)}` : '-';
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

interface Landlord { id: number; name: string; }
interface Property { id: number; address: string; }

interface RecurringCharge {
  id: number;
  landlordId: number;
  landlordName?: string;
  propertyId?: number;
  propertyAddress?: string;
  description: string;
  frequency: 'monthly' | 'quarterly' | 'annually';
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  nextDueDate: string | null;
  endDate: string | null;
  payeeName: string | null;
  category: string | null;
  isActive: boolean;
}

const FREQUENCIES = ['monthly', 'quarterly', 'annually'] as const;

const frequencyBadge = (freq: string) => {
  const colours: Record<string, string> = {
    monthly: 'bg-blue-100 text-blue-800',
    quarterly: 'bg-purple-100 text-purple-800',
    annually: 'bg-orange-100 text-orange-800',
  };
  return (
    <Badge className={`${colours[freq] ?? 'bg-gray-100 text-gray-800'} border-0 text-xs capitalize`}>
      {freq}
    </Badge>
  );
};

const urgencyBadge = (dateStr: string | null) => {
  if (!dateStr) return <span className="text-gray-400 text-xs">-</span>;
  const due = new Date(dateStr);
  const today = new Date();
  const daysUntil = Math.floor((due.getTime() - today.getTime()) / 86400000);
  const label = fmtDate(dateStr);
  if (daysUntil < 0) return <Badge className="bg-red-100 text-red-800 border-0 text-xs">{label} (Overdue)</Badge>;
  if (daysUntil <= 7) return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">{label} (Soon)</Badge>;
  return <span className="text-sm text-gray-700">{label}</span>;
};

type FormState = {
  landlordId: string;
  propertyId: string;
  description: string;
  frequency: 'monthly' | 'quarterly' | 'annually';
  netAmount: string;
  vatAmount: string;
  grossAmount: string;
  nextDueDate: string;
  endDate: string;
  payeeName: string;
  category: string;
  isActive: boolean;
};

const emptyForm = (): FormState => ({
  landlordId: '',
  propertyId: '',
  description: '',
  frequency: 'monthly',
  netAmount: '',
  vatAmount: '',
  grossAmount: '',
  nextDueDate: '',
  endDate: '',
  payeeName: '',
  category: '',
  isActive: true,
});

export default function RecurringLandlordCharges() {
  const { toast } = useToast();
  const [filterLandlord, setFilterLandlord] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('active');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editCharge, setEditCharge] = useState<RecurringCharge | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [showProcessDialog, setShowProcessDialog] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [landlordOpen, setLandlordOpen] = useState(false);
  const [propOpen, setPropOpen] = useState(false);

  const { data: landlords = [] } = useQuery<Landlord[]>({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const res = await fetch('/api/crm/landlords', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/crm/landlords', form.landlordId, 'properties'],
    queryFn: async () => {
      if (!form.landlordId) return [];
      const res = await fetch(`/api/crm/landlords/${form.landlordId}/properties`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!form.landlordId,
  });

  const queryParams = new URLSearchParams();
  if (filterLandlord) queryParams.set('landlordId', filterLandlord);
  if (filterStatus === 'active') queryParams.set('isActive', 'true');

  const { data: charges = [], isLoading } = useQuery<RecurringCharge[]>({
    queryKey: ['/api/crm/recurring-charges', filterLandlord, filterStatus],
    queryFn: async () => {
      const res = await fetch(`/api/crm/recurring-charges?${queryParams}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const dueCount = charges.filter((c) => {
    if (!c.nextDueDate) return false;
    return new Date(c.nextDueDate) <= new Date();
  }).length;

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (editCharge) {
        return apiRequest(`/api/crm/recurring-charges/${editCharge.id}`, 'PUT', data);
      }
      return apiRequest('/api/crm/recurring-charges', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/recurring-charges'] });
      toast({ title: editCharge ? 'Charge updated' : 'Charge created', description: 'Recurring charge saved successfully.' });
      setShowAddDialog(false);
      setEditCharge(null);
      setForm(emptyForm());
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/recurring-charges/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/recurring-charges'] });
      toast({ title: 'Charge deleted' });
      setDeleteId(null);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const processMutation = useMutation({
    mutationFn: () => apiRequest('/api/crm/recurring-charges/process', 'POST'),
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/recurring-charges'] });
      toast({ title: 'Charges processed', description: `${result?.processed ?? 0} charges processed.` });
      setShowProcessDialog(false);
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleOpenAdd = () => {
    setForm(emptyForm());
    setEditCharge(null);
    setShowAddDialog(true);
  };

  const handleEdit = (charge: RecurringCharge) => {
    setEditCharge(charge);
    setForm({
      landlordId: String(charge.landlordId),
      propertyId: charge.propertyId ? String(charge.propertyId) : '',
      description: charge.description,
      frequency: charge.frequency,
      netAmount: String(charge.netAmount / 100),
      vatAmount: String(charge.vatAmount / 100),
      grossAmount: String(charge.grossAmount / 100),
      nextDueDate: charge.nextDueDate ? charge.nextDueDate.slice(0, 10) : '',
      endDate: charge.endDate ? charge.endDate.slice(0, 10) : '',
      payeeName: charge.payeeName ?? '',
      category: charge.category ?? '',
      isActive: charge.isActive,
    });
    setShowAddDialog(true);
  };

  const handleNetChange = (val: string) => {
    const net = parseFloat(val) || 0;
    const vat = net * 0.2;
    setForm((f) => ({
      ...f,
      netAmount: val,
      vatAmount: vat.toFixed(2),
      grossAmount: (net + vat).toFixed(2),
    }));
  };

  const handleSave = () => {
    const payload = {
      landlordId: parseInt(form.landlordId),
      propertyId: form.propertyId ? parseInt(form.propertyId) : null,
      description: form.description,
      frequency: form.frequency,
      netAmount: Math.round(parseFloat(form.netAmount) * 100),
      vatAmount: Math.round(parseFloat(form.vatAmount) * 100),
      grossAmount: Math.round(parseFloat(form.grossAmount) * 100),
      nextDueDate: form.nextDueDate || null,
      endDate: form.endDate || null,
      payeeName: form.payeeName || null,
      category: form.category || null,
      isActive: form.isActive,
    };
    saveMutation.mutate(payload);
  };

  const selectedFormLandlord = landlords.find((l) => String(l.id) === form.landlordId);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-6 w-6 text-[#791E75]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Recurring Charges</h1>
            <p className="text-sm text-gray-500">Manage scheduled landlord charges</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50"
            onClick={() => setShowProcessDialog(true)}
          >
            <AlertTriangle className="h-4 w-4" />
            Process Due Charges {dueCount > 0 && <Badge className="bg-amber-500 text-white border-0 ml-1">{dueCount}</Badge>}
          </Button>
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5e1759]" onClick={handleOpenAdd}>
            <Plus className="h-4 w-4" />
            Add Charge
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Filter by Landlord</Label>
              <Select value={filterLandlord} onValueChange={setFilterLandlord}>
                <SelectTrigger>
                  <SelectValue placeholder="All landlords" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All landlords</SelectItem>
                  {landlords.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active only</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="px-3 pt-4">
          {isLoading ? (
            <div className="py-12 text-center">
              <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#791E75]" />
            </div>
          ) : charges.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              No recurring charges found.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold text-gray-600">Landlord</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Description</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Frequency</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Net</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">VAT</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Gross</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Next Due</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">End Date</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {charges.map((charge) => (
                    <TableRow key={charge.id} className="hover:bg-gray-50 text-sm">
                      <TableCell className="font-medium">{charge.landlordName ?? `#${charge.landlordId}`}</TableCell>
                      <TableCell>{charge.description}</TableCell>
                      <TableCell>{frequencyBadge(charge.frequency)}</TableCell>
                      <TableCell>{fmt(charge.netAmount)}</TableCell>
                      <TableCell>{fmt(charge.vatAmount)}</TableCell>
                      <TableCell className="font-medium">{fmt(charge.grossAmount)}</TableCell>
                      <TableCell>{urgencyBadge(charge.nextDueDate)}</TableCell>
                      <TableCell>{fmtDate(charge.endDate)}</TableCell>
                      <TableCell>
                        {charge.isActive ? (
                          <Badge className="bg-green-100 text-green-800 border-0 text-xs">Active</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(charge)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => setDeleteId(charge.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => { if (!open) { setShowAddDialog(false); setEditCharge(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCharge ? 'Edit Recurring Charge' : 'Add Recurring Charge'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Landlord */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Landlord *</Label>
              <Popover open={landlordOpen} onOpenChange={setLandlordOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between text-sm font-normal">
                    {selectedFormLandlord ? selectedFormLandlord.name : 'Select landlord...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0">
                  <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                      <CommandEmpty>No landlord found.</CommandEmpty>
                      <CommandGroup>
                        {landlords.map((l) => (
                          <CommandItem key={l.id} value={l.name} onSelect={() => {
                            setForm((f) => ({ ...f, landlordId: String(l.id), propertyId: '' }));
                            setLandlordOpen(false);
                          }}>
                            <Check className={cn('mr-2 h-4 w-4', form.landlordId === String(l.id) ? 'opacity-100' : 'opacity-0')} />
                            {l.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Property */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Property (optional)</Label>
              <Select value={form.propertyId} onValueChange={(v) => setForm((f) => ({ ...f, propertyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All properties</SelectItem>
                  {properties.map((p: Property) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Description *</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Management fee" />
            </div>

            {/* Frequency */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Frequency *</Label>
              <Select value={form.frequency} onValueChange={(v: any) => setForm((f) => ({ ...f, frequency: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => <SelectItem key={f} value={f} className="capitalize">{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Net (£) *</Label>
                <Input type="number" step="0.01" min="0" value={form.netAmount} onChange={(e) => handleNetChange(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">VAT (£) auto 20%</Label>
                <Input type="number" step="0.01" min="0" value={form.vatAmount} onChange={(e) => setForm((f) => ({ ...f, vatAmount: e.target.value, grossAmount: String((parseFloat(form.netAmount) || 0) + (parseFloat(e.target.value) || 0)) }))} placeholder="0.00" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Gross (£)</Label>
                <Input type="number" step="0.01" min="0" value={form.grossAmount} readOnly className="bg-gray-50" />
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Next Due Date</Label>
                <Input type="date" value={form.nextDueDate} onChange={(e) => setForm((f) => ({ ...f, nextDueDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>

            {/* Payee & Category */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Payee Name</Label>
                <Input value={form.payeeName} onChange={(e) => setForm((f) => ({ ...f, payeeName: e.target.value }))} placeholder="Payee" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium text-gray-600">Category</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="e.g. Management" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditCharge(null); }}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5e1759]" onClick={handleSave} disabled={saveMutation.isPending || !form.landlordId || !form.description}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editCharge ? 'Update Charge' : 'Create Charge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={deleteId !== null} onOpenChange={(open) => { if (!open) setDeleteId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Recurring Charge</DialogTitle>
            <DialogDescription>Are you sure you want to delete this recurring charge? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Process due charges dialog */}
      <Dialog open={showProcessDialog} onOpenChange={setShowProcessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Process Due Charges</DialogTitle>
            <DialogDescription>
              This will process all <strong>{dueCount}</strong> charge{dueCount !== 1 ? 's' : ''} that are currently due or overdue.
              Ledger entries will be created and next due dates advanced. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowProcessDialog(false)}>Cancel</Button>
            <Button className="bg-amber-600 hover:bg-amber-700" onClick={() => processMutation.mutate()} disabled={processMutation.isPending}>
              {processMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Process {dueCount} Charge{dueCount !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
