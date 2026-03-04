import { useState, useMemo } from 'react';
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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, Plus, Download, RefreshCw, Loader2, Send, ChevronsUpDown, Check,
  PoundSterling, CheckCircle, ArrowRightLeft, Search, AlertTriangle, Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// --- Types ---

interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceType: string;
  propertyId: number | null;
  tenantId: number | null;
  landlordId: number | null;
  amount: number;
  vatAmount: number | null;
  totalAmount: number;
  dueDate: string;
  paidDate: string | null;
  status: string;
  paymentId: number | null;
  notes: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface InvoiceLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  vatRate: number;
}

interface CreateInvoiceData {
  invoiceType: string;
  amount: number;
  dueDate: string;
  tenantId: number | null;
  propertyId: number | null;
  notes: string;
  lineItems: InvoiceLineItem[];
}

interface TenantOption {
  id: number;
  name: string;
  email: string | null;
}

interface PropertyOption {
  id: number;
  address: string;
  addressLine1: string | null;
  postcode: string | null;
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    sent: { variant: 'default', className: 'bg-blue-500 hover:bg-blue-600', label: 'Sent' },
    paid: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', label: 'Paid' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    cancelled: { variant: 'secondary', className: 'opacity-60', label: 'Cancelled' },
  };
  const c = config[status] || config.draft;
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

// --- Component ---

export default function InvoiceManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [formData, setFormData] = useState<CreateInvoiceData>({
    invoiceType: 'rent',
    amount: 0,
    dueDate: '',
    tenantId: null,
    propertyId: null,
    notes: '',
    lineItems: [{ description: '', quantity: 1, unitAmount: 0, vatRate: 0 }],
  });
  const [tenantOpen, setTenantOpen] = useState(false);
  const [propertyOpen, setPropertyOpen] = useState(false);

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ['/api/crm/invoices'],
  });

  // Fetch tenants for combobox
  const { data: tenants = [] } = useQuery<TenantOption[]>({
    queryKey: ['/api/crm/tenants-list'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tenants', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Fetch properties for combobox
  const { data: properties = [] } = useQuery<PropertyOption[]>({
    queryKey: ['/api/crm/properties-list'],
    queryFn: async () => {
      const res = await fetch('/api/crm/managed-properties', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const tenantMap = useMemo(() => new Map(tenants.map(t => [t.id, t.name])), [tenants]);
  const propertyMap = useMemo(() => {
    return new Map(properties.map(p => [p.id, p.addressLine1 || p.address || `Property #${p.id}`]));
  }, [properties]);

  // Create invoice mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateInvoiceData) => {
      const lineItems = data.lineItems.filter(li => li.description.trim()).map(li => ({
        description: li.description,
        quantity: li.quantity,
        unitAmount: Math.round(li.unitAmount * 100),
        totalAmount: Math.round(li.quantity * li.unitAmount * 100),
        vatRate: li.vatRate,
      }));
      const subtotal = lineItems.reduce((sum, li) => sum + li.totalAmount, 0);
      const vatTotal = lineItems.reduce((sum, li) => sum + Math.round(li.totalAmount * li.vatRate / 100), 0);
      const totalAmount = subtotal + vatTotal;
      const res = await fetch('/api/crm/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          invoiceType: data.invoiceType,
          dueDate: data.dueDate,
          tenantId: data.tenantId,
          propertyId: data.propertyId,
          notes: data.notes,
          lineItems,
          amount: subtotal,
          vatAmount: vatTotal,
          totalAmount,
          invoiceNumber: `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(Math.floor(Math.random() * 9999)).padStart(4, '0')}`,
        }),
      });
      if (!res.ok) throw new Error('Failed to create invoice');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Invoice Created' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/invoices'] });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Generate rent invoices mutation
  const generateRentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/invoices/generate-rent', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to generate rent invoices');
      return res.json();
    },
    onSuccess: (data) => {
      const count = data.generated ?? 0;
      const emails = data.emailsQueued ?? 0;
      toast({
        title: 'Rent Invoices Generated',
        description: count > 0
          ? `${count} invoice(s) created. ${emails > 0 ? `${emails} email(s) queued.` : ''}`
          : 'No invoices due in the next 7 days.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/invoices'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark paid dialog state
  const [paymentDialogInvoice, setPaymentDialogInvoice] = useState<Invoice | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    paymentMethod: 'bank_transfer',
    reference: '',
    notes: '',
    paidAt: new Date().toISOString().slice(0, 10),
  });

  // Mark paid mutation (uses reconciliation engine)
  const markPaidMutation = useMutation({
    mutationFn: async ({ invoiceId, data }: { invoiceId: number; data: typeof paymentForm }) => {
      const res = await fetch(`/api/crm/invoices/${invoiceId}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          paymentMethod: data.paymentMethod,
          reference: data.reference || undefined,
          notes: data.notes || undefined,
          paidAt: data.paidAt ? new Date(data.paidAt).toISOString() : undefined,
        }),
      });
      if (!res.ok) throw new Error('Failed to record payment');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Payment Recorded', description: `Invoice marked as paid${data.arrearsCleared ? '. Arrears cleared.' : ''}${data.transactionCreated ? ' Transaction logged.' : ''}` });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/invoices'] });
      setPaymentDialogInvoice(null);
      setPaymentForm({ paymentMethod: 'bank_transfer', reference: '', notes: '', paidAt: new Date().toISOString().slice(0, 10) });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (invoiceId: number) => {
      const res = await fetch(`/api/crm/invoices/${invoiceId}/send-email`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to send email' }));
        throw new Error(err.error || 'Failed to send email');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Email Queued', description: data.message || 'Invoice email queued for delivery.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/invoices'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Reconcile payments mutation
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/invoices/reconcile', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to reconcile payments');
      return res.json();
    },
    onSuccess: (data) => {
      if (data.reconciled > 0) {
        toast({
          title: 'Payments Reconciled',
          description: `${data.reconciled} invoice(s) matched to payments (${formatCurrency(data.totalReconciled)}). ${data.outstanding} still outstanding.`,
        });
      } else {
        toast({
          title: 'No Matches Found',
          description: `${data.outstanding} invoice(s) still outstanding. No matching payments found.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/crm/invoices'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function resetForm() {
    setFormData({ invoiceType: 'rent', amount: 0, dueDate: '', tenantId: null, propertyId: null, notes: '', lineItems: [{ description: '', quantity: 1, unitAmount: 0, vatRate: 0 }] });
  }

  function handleCreate() {
    if (!formData.dueDate) {
      toast({ title: 'Validation Error', description: 'Due date is required.', variant: 'destructive' });
      return;
    }
    const validItems = formData.lineItems.filter(li => li.description.trim());
    if (validItems.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one line item with a description is required.', variant: 'destructive' });
      return;
    }
    const total = validItems.reduce((sum, li) => sum + li.quantity * li.unitAmount, 0);
    if (total <= 0) {
      toast({ title: 'Validation Error', description: 'Total amount must be greater than zero.', variant: 'destructive' });
      return;
    }
    createMutation.mutate({ ...formData, amount: total });
  }

  async function handleExportCSV() {
    try {
      const res = await fetch('/api/crm/export/invoices', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `invoices-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Export Complete' });
    } catch (error: any) {
      toast({ title: 'Export Failed', description: error.message, variant: 'destructive' });
    }
  }

  // Filter and stats
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Tab filter
    switch (activeTab) {
      case 'outstanding': filtered = filtered.filter(i => ['draft', 'sent', 'overdue'].includes(i.status)); break;
      case 'overdue': filtered = filtered.filter(i => i.status === 'overdue'); break;
      case 'paid': filtered = filtered.filter(i => i.status === 'paid'); break;
    }

    // Search filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(i =>
        i.invoiceNumber.toLowerCase().includes(term) ||
        (i.tenantId && tenantMap.get(i.tenantId)?.toLowerCase().includes(term)) ||
        (i.propertyId && propertyMap.get(i.propertyId)?.toLowerCase().includes(term))
      );
    }

    return filtered;
  }, [invoices, activeTab, searchTerm, tenantMap, propertyMap]);

  const stats = useMemo(() => {
    const outstanding = invoices.filter(i => ['draft', 'sent', 'overdue'].includes(i.status));
    const overdue = invoices.filter(i => i.status === 'overdue');
    const paid = invoices.filter(i => i.status === 'paid');
    return {
      totalOutstanding: outstanding.reduce((sum, i) => sum + i.totalAmount, 0),
      outstandingCount: outstanding.length,
      overdueCount: overdue.length,
      overdueAmount: overdue.reduce((sum, i) => sum + i.totalAmount, 0),
      paidCount: paid.length,
      paidAmount: paid.reduce((sum, i) => sum + i.totalAmount, 0),
    };
  }, [invoices]);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Management</h1>
          <p className="text-muted-foreground">Create, send, and track invoices. Reconcile payments automatically.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => reconcileMutation.mutate()}
            disabled={reconcileMutation.isPending}
          >
            {reconcileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRightLeft className="h-4 w-4 mr-2" />}
            Reconcile Payments
          </Button>
          <Button
            variant="outline"
            onClick={() => generateRentMutation.mutate()}
            disabled={generateRentMutation.isPending}
          >
            {generateRentMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Generate Rent Invoices
          </Button>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Invoice
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Total Outstanding</p>
            <p className="text-2xl font-bold text-orange-600">{formatCurrency(stats.totalOutstanding)}</p>
            <p className="text-xs text-muted-foreground">{stats.outstandingCount} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" /> Overdue
            </p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(stats.overdueAmount)}</p>
            <p className="text-xs text-muted-foreground">{stats.overdueCount} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(stats.paidAmount)}</p>
            <p className="text-xs text-muted-foreground">{stats.paidCount} invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Total Invoices</p>
            <p className="text-2xl font-bold">{invoices.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by invoice #, tenant, or property..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabs + Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All ({invoices.length})</TabsTrigger>
          <TabsTrigger value="outstanding">Outstanding ({stats.outstandingCount})</TabsTrigger>
          <TabsTrigger value="overdue">Overdue ({stats.overdueCount})</TabsTrigger>
          <TabsTrigger value="paid">Paid ({stats.paidCount})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4" />
                  <p className="text-lg font-medium">No invoices found</p>
                  <p className="text-sm">
                    {activeTab === 'all'
                      ? 'Create your first invoice or generate rent invoices.'
                      : `No ${activeTab} invoices at the moment.`}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((invoice) => {
                      const isOverdue = invoice.status !== 'paid' && invoice.status !== 'cancelled' && invoice.dueDate && new Date(invoice.dueDate) < new Date();
                      return (
                        <TableRow key={invoice.id} className={isOverdue && invoice.status !== 'overdue' ? 'bg-red-50' : ''}>
                          <TableCell className="font-medium font-mono">{invoice.invoiceNumber}</TableCell>
                          <TableCell className="capitalize">{invoice.invoiceType?.replace(/_/g, ' ')}</TableCell>
                          <TableCell>{invoice.propertyId ? (propertyMap.get(invoice.propertyId) || `#${invoice.propertyId}`) : '-'}</TableCell>
                          <TableCell>{invoice.tenantId ? (tenantMap.get(invoice.tenantId) || `#${invoice.tenantId}`) : '-'}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{formatCurrency(invoice.totalAmount)}</TableCell>
                          <TableCell className={isOverdue ? 'text-red-600 font-medium' : ''}>{formatDate(invoice.dueDate)}</TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Mark as Paid"
                                    onClick={() => setPaymentDialogInvoice(invoice)}
                                  >
                                    <CheckCircle className="h-4 w-4 text-green-600" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    title="Send Invoice Email"
                                    onClick={() => sendEmailMutation.mutate(invoice.id)}
                                    disabled={sendEmailMutation.isPending}
                                  >
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {invoice.status === 'paid' && invoice.paidDate && (
                                <span className="text-xs text-muted-foreground">
                                  Paid {formatDate(invoice.paidDate)}
                                </span>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Invoice Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceType">Invoice Type</Label>
              <Select
                value={formData.invoiceType}
                onValueChange={(value) => setFormData({ ...formData, invoiceType: value })}
              >
                <SelectTrigger id="invoiceType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="management_fee">Management Fee</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label>Line Items</Label>
              <div className="space-y-2 border rounded-md p-3 bg-gray-50">
                {formData.lineItems.map((item, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      {idx === 0 && <span className="text-xs text-gray-500 mb-1 block">Description</span>}
                      <Input
                        placeholder="e.g. Monthly rent"
                        value={item.description}
                        onChange={(e) => {
                          const items = [...formData.lineItems];
                          items[idx] = { ...items[idx], description: e.target.value };
                          setFormData({ ...formData, lineItems: items });
                        }}
                      />
                    </div>
                    <div className="col-span-2">
                      {idx === 0 && <span className="text-xs text-gray-500 mb-1 block">Qty</span>}
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => {
                          const items = [...formData.lineItems];
                          items[idx] = { ...items[idx], quantity: parseInt(e.target.value) || 1 };
                          setFormData({ ...formData, lineItems: items });
                        }}
                      />
                    </div>
                    <div className="col-span-3">
                      {idx === 0 && <span className="text-xs text-gray-500 mb-1 block">Unit Price (£)</span>}
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={item.unitAmount || ''}
                        onChange={(e) => {
                          const items = [...formData.lineItems];
                          items[idx] = { ...items[idx], unitAmount: parseFloat(e.target.value) || 0 };
                          setFormData({ ...formData, lineItems: items });
                        }}
                      />
                    </div>
                    <div className="col-span-2 flex items-center gap-1">
                      <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                        £{(item.quantity * item.unitAmount).toFixed(2)}
                      </span>
                      {formData.lineItems.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-500"
                          onClick={() => {
                            const items = formData.lineItems.filter((_, i) => i !== idx);
                            setFormData({ ...formData, lineItems: items });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => setFormData({ ...formData, lineItems: [...formData.lineItems, { description: '', quantity: 1, unitAmount: 0, vatRate: 0 }] })}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Line
                </Button>
                <div className="flex justify-end pt-2 border-t mt-2">
                  <span className="text-sm font-semibold">
                    Total: £{formData.lineItems.reduce((sum, li) => sum + li.quantity * li.unitAmount, 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dueDate">Due Date</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Tenant</Label>
              <Popover open={tenantOpen} onOpenChange={setTenantOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={tenantOpen} className="w-full justify-between font-normal">
                    {formData.tenantId
                      ? tenantMap.get(formData.tenantId) || `Tenant #${formData.tenantId}`
                      : 'Search tenant...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by name or email..." />
                    <CommandList>
                      <CommandEmpty>No tenants found.</CommandEmpty>
                      <CommandGroup>
                        {tenants.map((tenant) => (
                          <CommandItem
                            key={tenant.id}
                            value={`${tenant.name} ${tenant.email || ''}`}
                            onSelect={() => {
                              setFormData({ ...formData, tenantId: tenant.id });
                              setTenantOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.tenantId === tenant.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{tenant.name}</span>
                              {tenant.email && <span className="text-xs text-muted-foreground">{tenant.email}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Property</Label>
              <Popover open={propertyOpen} onOpenChange={setPropertyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={propertyOpen} className="w-full justify-between font-normal">
                    {formData.propertyId
                      ? propertyMap.get(formData.propertyId) || `Property #${formData.propertyId}`
                      : 'Search property...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by address..." />
                    <CommandList>
                      <CommandEmpty>No properties found.</CommandEmpty>
                      <CommandGroup>
                        {properties.map((property) => (
                          <CommandItem
                            key={property.id}
                            value={`${property.addressLine1 || ''} ${property.address || ''} ${property.postcode || ''}`}
                            onSelect={() => {
                              setFormData({ ...formData, propertyId: property.id });
                              setPropertyOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", formData.propertyId === property.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{property.addressLine1 || property.address || `Property #${property.id}`}</span>
                              {property.postcode && <span className="text-xs text-muted-foreground">{property.postcode}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Paid Dialog */}
      <Dialog open={!!paymentDialogInvoice} onOpenChange={(open) => !open && setPaymentDialogInvoice(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {paymentDialogInvoice && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">Invoice: {paymentDialogInvoice.invoiceNumber}</p>
                <p className="text-lg font-bold">{formatCurrency(paymentDialogInvoice.totalAmount)}</p>
                <p className="text-xs text-muted-foreground">Due: {formatDate(paymentDialogInvoice.dueDate)}</p>
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentForm.paymentMethod} onValueChange={(v) => setPaymentForm({ ...paymentForm, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="direct_debit">Direct Debit</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Payment Date</Label>
                <Input type="date" value={paymentForm.paidAt} onChange={(e) => setPaymentForm({ ...paymentForm, paidAt: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Reference (optional)</Label>
                <Input placeholder="e.g. bank reference number" value={paymentForm.reference} onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea placeholder="Any additional notes..." value={paymentForm.notes} onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogInvoice(null)}>Cancel</Button>
            <Button
              onClick={() => paymentDialogInvoice && markPaidMutation.mutate({ invoiceId: paymentDialogInvoice.id, data: paymentForm })}
              disabled={markPaidMutation.isPending}
            >
              {markPaidMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
