import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HandCoins, Plus, Pencil, Trash2, Filter } from 'lucide-react';

const formatPence = (pence: number | null | undefined) => {
  if (pence === null || pence === undefined) return '£0.00';
  return `£${(Number(pence) / 100).toFixed(2)}`;
};

const statusColor = (status: string) => {
  switch (status) {
    case 'received': return 'bg-green-100 text-green-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'cancelled': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-700';
  }
};

interface LHAPayment {
  id: number;
  tenant_id: number;
  tenancy_id: number | null;
  tenant_name: string;
  payment_date: string;
  total_amount: number;
  split_to_rent: number;
  split_to_tenant: number;
  reference: string | null;
  status: string;
  notes: string | null;
}

interface Tenant {
  id: number;
  name: string;
}

export default function LHABenefitManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [filterTenantId, setFilterTenantId] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<LHAPayment | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state
  const [form, setForm] = useState({
    tenantId: '',
    tenancyId: '',
    paymentDate: '',
    totalAmount: '',
    splitToRent: '',
    splitToTenant: '',
    reference: '',
    status: 'received',
    notes: '',
  });

  const { data: payments = [], isLoading } = useQuery<LHAPayment[]>({
    queryKey: ['/api/crm/lha-benefits', filterTenantId],
    queryFn: () => apiRequest('GET', `/api/crm/lha-benefits${filterTenantId ? `?tenantId=${filterTenantId}` : ''}`).then(r => r.json()),
  });

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/crm/tenants-list'],
    queryFn: () => apiRequest('GET', '/api/crm/tenants').then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/crm/lha-benefits', data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lha-benefits'] });
      toast({ title: 'Payment recorded', description: 'LHA benefit payment has been recorded.' });
      closeDialog();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/crm/lha-benefits/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lha-benefits'] });
      toast({ title: 'Payment updated' });
      closeDialog();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update payment.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/lha-benefits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lha-benefits'] });
      toast({ title: 'Payment deleted' });
      setDeleteId(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to delete payment.', variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditingPayment(null);
    setForm({ tenantId: '', tenancyId: '', paymentDate: '', totalAmount: '', splitToRent: '', splitToTenant: '', reference: '', status: 'received', notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (payment: LHAPayment) => {
    setEditingPayment(payment);
    setForm({
      tenantId: String(payment.tenant_id),
      tenancyId: payment.tenancy_id ? String(payment.tenancy_id) : '',
      paymentDate: payment.payment_date?.substring(0, 10) || '',
      totalAmount: String(payment.total_amount),
      splitToRent: String(payment.split_to_rent),
      splitToTenant: String(payment.split_to_tenant),
      reference: payment.reference || '',
      status: payment.status,
      notes: payment.notes || '',
    });
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingPayment(null);
  };

  const handleTotalAmountChange = (val: string) => {
    setForm(prev => {
      const total = Number(val) || 0;
      const toRent = Number(prev.splitToRent) || 0;
      const remainder = Math.max(0, total - toRent);
      return { ...prev, totalAmount: val, splitToTenant: String(remainder) };
    });
  };

  const handleSplitToRentChange = (val: string) => {
    setForm(prev => {
      const total = Number(prev.totalAmount) || 0;
      const toRent = Number(val) || 0;
      const remainder = Math.max(0, total - toRent);
      return { ...prev, splitToRent: val, splitToTenant: String(remainder) };
    });
  };

  const handleSubmit = () => {
    const payload = {
      tenantId: Number(form.tenantId),
      tenancyId: form.tenancyId ? Number(form.tenancyId) : null,
      paymentDate: form.paymentDate,
      totalAmount: Number(form.totalAmount),
      splitToRent: Number(form.splitToRent),
      splitToTenant: Number(form.splitToTenant),
      reference: form.reference || null,
      status: form.status,
      notes: form.notes || null,
    };
    if (editingPayment) {
      updateMutation.mutate({ id: editingPayment.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Summary stats
  const totalReceived = payments.reduce((sum, p) => sum + Number(p.total_amount), 0);
  const totalToRent = payments.reduce((sum, p) => sum + Number(p.split_to_rent), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
            <HandCoins className="h-5 w-5 text-[#791E75]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">LHA Benefit Payments</h1>
            <p className="text-sm text-gray-500">Track Local Housing Allowance payments and rent splits</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#791E75] hover:bg-[#5e1659] text-white gap-2">
          <Plus className="h-4 w-4" />
          Add Payment
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Benefits Received</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{formatPence(totalReceived)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Applied to Rent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-[#791E75]">{formatPence(totalToRent)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <Select value={filterTenantId} onValueChange={setFilterTenantId}>
          <SelectTrigger className="w-60">
            <SelectValue placeholder="Filter by tenant" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Tenants</SelectItem>
            {tenants.map((t: Tenant) => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filterTenantId && (
          <Button variant="ghost" size="sm" onClick={() => setFilterTenantId('')}>Clear</Button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead>Tenant</TableHead>
              <TableHead>Payment Date</TableHead>
              <TableHead className="text-right">Total Amount</TableHead>
              <TableHead className="text-right">Split to Rent</TableHead>
              <TableHead className="text-right">Split to Tenant</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">Loading...</TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">No LHA benefit payments recorded</TableCell>
              </TableRow>
            ) : (
              payments.map(payment => (
                <TableRow key={payment.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium">{payment.tenant_name || '—'}</TableCell>
                  <TableCell>{payment.payment_date ? new Date(payment.payment_date).toLocaleDateString('en-GB') : '—'}</TableCell>
                  <TableCell className="text-right">{formatPence(payment.total_amount)}</TableCell>
                  <TableCell className="text-right text-green-700">{formatPence(payment.split_to_rent)}</TableCell>
                  <TableCell className="text-right text-blue-700">{formatPence(payment.split_to_tenant)}</TableCell>
                  <TableCell className="text-gray-500">{payment.reference || '—'}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(payment.status)}`}>
                      {payment.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(payment)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(payment.id)} className="text-red-500 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingPayment ? 'Edit LHA Payment' : 'Add LHA Benefit Payment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Tenant *</Label>
              <Select value={form.tenantId} onValueChange={v => setForm(p => ({ ...p, tenantId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t: Tenant) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Payment Date *</Label>
              <Input type="date" value={form.paymentDate} onChange={e => setForm(p => ({ ...p, paymentDate: e.target.value }))} />
            </div>
            <div>
              <Label>Total Amount (pence) *</Label>
              <Input type="number" min="0" value={form.totalAmount} onChange={e => handleTotalAmountChange(e.target.value)} placeholder="e.g. 90000 for £900.00" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Split to Rent (pence)</Label>
                <Input type="number" min="0" value={form.splitToRent} onChange={e => handleSplitToRentChange(e.target.value)} />
              </div>
              <div>
                <Label>Split to Tenant (pence)</Label>
                <Input type="number" min="0" value={form.splitToTenant} onChange={e => setForm(p => ({ ...p, splitToTenant: e.target.value }))} readOnly className="bg-gray-50" />
              </div>
            </div>
            <div>
              <Label>Reference</Label>
              <Input value={form.reference} onChange={e => setForm(p => ({ ...p, reference: e.target.value }))} placeholder="DWP/council reference" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(p => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="received">Received</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.tenantId || !form.paymentDate || !form.totalAmount || createMutation.isPending || updateMutation.isPending}
              className="bg-[#791E75] hover:bg-[#5e1659] text-white"
            >
              {editingPayment ? 'Save Changes' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Payment</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">Are you sure you want to delete this LHA benefit payment? This action cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deleteId !== null && deleteMutation.mutate(deleteId)}
              disabled={deleteMutation.isPending}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
