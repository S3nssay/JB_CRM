import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, Plus, Loader2, Search, Receipt, Ban,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

// --- Types ---

interface CreditNote {
  id: number;
  credit_note_number: string;
  credit_note_date: string;
  original_invoice_id: number | null;
  customer_type: string;
  customer_id: number | null;
  customer_name: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  amount_applied: number;
  status: string;
  reason: string | null;
  notes: string | null;
}

interface CreateCreditNoteData {
  credit_note_date: string;
  original_invoice_id: number | null;
  customer_type: string;
  customer_id: number | null;
  customer_name: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  reason: string;
  notes: string;
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `\u00A3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
    draft: { variant: 'secondary', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200 border-yellow-300', label: 'Draft' },
    approved: { variant: 'default', className: 'bg-blue-500 hover:bg-blue-600', label: 'Approved' },
    applied: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', label: 'Applied' },
    voided: { variant: 'destructive', label: 'Voided' },
  };
  const c = config[status] || config.draft;
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

// --- Component ---

export default function CreditNotes() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const initialFormData: CreateCreditNoteData = {
    credit_note_date: new Date().toISOString().slice(0, 10),
    original_invoice_id: null,
    customer_type: 'tenant',
    customer_id: null,
    customer_name: '',
    subtotal: 0,
    vat_amount: 0,
    total_amount: 0,
    reason: '',
    notes: '',
  };
  const [formData, setFormData] = useState<CreateCreditNoteData>(initialFormData);

  // Fetch credit notes
  const queryUrl = statusFilter === 'all'
    ? '/api/crm/accounting/credit-notes'
    : `/api/crm/accounting/credit-notes?status=${statusFilter}`;

  const { data: creditNotes = [], isLoading } = useQuery<CreditNote[]>({
    queryKey: ['/api/crm/accounting/credit-notes', statusFilter],
    queryFn: () => apiRequest<CreditNote[]>(queryUrl),
  });

  // Create credit note mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateCreditNoteData) => {
      return apiRequest('/api/crm/accounting/credit-notes', 'POST', {
        credit_note_date: data.credit_note_date,
        original_invoice_id: data.original_invoice_id || null,
        customer_type: data.customer_type,
        customer_id: data.customer_id || null,
        customer_name: data.customer_name,
        subtotal: Math.round(data.subtotal * 100),
        vat_amount: Math.round(data.vat_amount * 100),
        total_amount: Math.round(data.total_amount * 100),
        reason: data.reason,
        notes: data.notes,
      });
    },
    onSuccess: () => {
      toast({ title: 'Credit Note Created', description: 'The credit note has been created successfully.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/credit-notes'] });
      setShowCreateDialog(false);
      setFormData(initialFormData);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Filtered credit notes
  const filteredCreditNotes = useMemo(() => {
    if (!searchTerm) return creditNotes;
    const term = searchTerm.toLowerCase();
    return creditNotes.filter(cn =>
      cn.credit_note_number?.toLowerCase().includes(term) ||
      cn.customer_name?.toLowerCase().includes(term) ||
      cn.reason?.toLowerCase().includes(term)
    );
  }, [creditNotes, searchTerm]);

  // Summary stats
  const stats = useMemo(() => {
    const total = creditNotes.length;
    const draftCount = creditNotes.filter(cn => cn.status === 'draft').length;
    const approvedCount = creditNotes.filter(cn => cn.status === 'approved').length;
    const appliedCount = creditNotes.filter(cn => cn.status === 'applied').length;
    const totalValue = creditNotes.reduce((sum, cn) => sum + (cn.total_amount || 0), 0);
    const appliedValue = creditNotes.reduce((sum, cn) => sum + (cn.amount_applied || 0), 0);
    return { total, draftCount, approvedCount, appliedCount, totalValue, appliedValue };
  }, [creditNotes]);

  // Auto-calculate total when subtotal or VAT change
  function updateAmounts(field: 'subtotal' | 'vat_amount', value: number) {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      updated.total_amount = updated.subtotal + updated.vat_amount;
      return updated;
    });
  }

  function resetForm() {
    setFormData(initialFormData);
  }

  function handleSubmit() {
    if (!formData.customer_name.trim()) {
      toast({ title: 'Validation Error', description: 'Customer name is required.', variant: 'destructive' });
      return;
    }
    if (!formData.reason.trim()) {
      toast({ title: 'Validation Error', description: 'Reason is required.', variant: 'destructive' });
      return;
    }
    if (formData.total_amount <= 0) {
      toast({ title: 'Validation Error', description: 'Total amount must be greater than zero.', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>Credit Notes</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage credit notes and refund adjustments</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowCreateDialog(true); }}
          style={{ backgroundColor: '#791E75' }}
          className="hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Credit Note
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Credit Notes</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.draftCount}</p>
              </div>
              <Receipt className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Value</p>
                <p className="text-2xl font-bold">{formatCurrency(stats.totalValue)}</p>
              </div>
              <FileText className="h-8 w-8" style={{ color: '#791E75' }} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Applied</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.appliedValue)}</p>
              </div>
              <Ban className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by CN #, customer name, or reason..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="applied">Applied</SelectItem>
                <SelectItem value="voided">Voided</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Credit Notes Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Credit Notes</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredCreditNotes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No credit notes found</p>
              <p className="text-sm mt-1">
                {searchTerm || statusFilter !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Click "New Credit Note" to create one.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>CN #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Original Invoice</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Applied</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCreditNotes.map(cn => (
                    <TableRow key={cn.id}>
                      <TableCell className="font-mono font-medium text-sm">
                        {cn.credit_note_number || `CN-${cn.id}`}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(cn.credit_note_date)}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{cn.customer_name || '-'}</span>
                          {cn.customer_type && (
                            <span className="text-xs text-muted-foreground ml-1 capitalize">
                              ({cn.customer_type})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm font-mono">
                        {cn.original_invoice_id ? `INV-${cn.original_invoice_id}` : '-'}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {formatCurrency(cn.total_amount)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(cn.amount_applied)}
                      </TableCell>
                      <TableCell>{getStatusBadge(cn.status)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {cn.reason || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Credit Note Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle style={{ color: '#791E75' }}>New Credit Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Date */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cn-date">Credit Note Date</Label>
                <Input
                  id="cn-date"
                  type="date"
                  value={formData.credit_note_date}
                  onChange={e => setFormData(prev => ({ ...prev, credit_note_date: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cn-invoice">Original Invoice ID (optional)</Label>
                <Input
                  id="cn-invoice"
                  type="number"
                  placeholder="e.g. 1042"
                  value={formData.original_invoice_id ?? ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    original_invoice_id: e.target.value ? parseInt(e.target.value) : null,
                  }))}
                />
              </div>
            </div>

            {/* Customer */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cn-customer-type">Customer Type</Label>
                <Select
                  value={formData.customer_type}
                  onValueChange={val => setFormData(prev => ({ ...prev, customer_type: val }))}
                >
                  <SelectTrigger id="cn-customer-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="landlord">Landlord</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="cn-customer-id">Customer ID (optional)</Label>
                <Input
                  id="cn-customer-id"
                  type="number"
                  placeholder="e.g. 15"
                  value={formData.customer_id ?? ''}
                  onChange={e => setFormData(prev => ({
                    ...prev,
                    customer_id: e.target.value ? parseInt(e.target.value) : null,
                  }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cn-customer-name">Customer Name</Label>
              <Input
                id="cn-customer-name"
                placeholder="Full name of the customer"
                value={formData.customer_name}
                onChange={e => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
              />
            </div>

            {/* Amounts */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cn-subtotal">Subtotal (£)</Label>
                <Input
                  id="cn-subtotal"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.subtotal || ''}
                  onChange={e => updateAmounts('subtotal', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cn-vat">VAT (£)</Label>
                <Input
                  id="cn-vat"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formData.vat_amount || ''}
                  onChange={e => updateAmounts('vat_amount', parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cn-total">Total (£)</Label>
                <Input
                  id="cn-total"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.total_amount.toFixed(2)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="cn-reason">Reason</Label>
              <Input
                id="cn-reason"
                placeholder="e.g. Overcharge on management fee"
                value={formData.reason}
                onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="cn-notes">Notes</Label>
              <Textarea
                id="cn-notes"
                placeholder="Additional notes (optional)"
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending}
              style={{ backgroundColor: '#791E75' }}
              className="hover:opacity-90"
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Credit Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
