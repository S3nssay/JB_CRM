import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  FileText, Plus, Loader2, Send, Search, Trash2, Eye,
  PoundSterling, CheckCircle, AlertTriangle, Clock, Ban,
  ChevronDown, ChevronUp, X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// --- Types ---

interface BusinessInvoice {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  customer_type: string;
  customer_id: number | null;
  customer_name: string;
  customer_email: string | null;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  property_id: number | null;
  notes: string | null;
}

interface InvoiceLine {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate_id: number | null;
  tax_rate_name: string | null;
  tax_rate: number | null;
  tax_amount: number;
  account_id: number | null;
  account_code: string | null;
  account_name: string | null;
}

interface InvoiceDetail extends BusinessInvoice {
  customer_address: string | null;
  customer_vat_number: string | null;
  internal_notes: string | null;
  lines: InvoiceLine[];
}

interface TaxRate {
  id: number;
  name: string;
  rate: number;
}

interface ChartAccount {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface LineItemForm {
  description: string;
  quantity: number;
  unit_price: number; // in pounds for display
  tax_rate_id: number | null;
  tax_amount: number; // in pence, auto-calculated
  account_id: number | null;
}

interface CreateInvoiceForm {
  invoice_date: string;
  due_date: string;
  customer_type: string;
  customer_id: number | null;
  customer_name: string;
  customer_email: string;
  customer_address: string;
  customer_vat_number: string;
  property_id: number | null;
  notes: string;
  internal_notes: string;
  lines: LineItemForm[];
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    approved: { variant: 'default', className: 'bg-indigo-500 hover:bg-indigo-600', label: 'Approved' },
    sent: { variant: 'default', className: 'bg-blue-500 hover:bg-blue-600', label: 'Sent' },
    paid: { variant: 'default', className: 'bg-green-600 hover:bg-green-700', label: 'Paid' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    voided: { variant: 'secondary', className: 'opacity-60 line-through', label: 'Voided' },
  };
  const c = config[status] || config.draft;
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

function getCustomerTypeBadge(type: string) {
  const config: Record<string, { className: string; label: string }> = {
    landlord: { className: 'bg-purple-100 text-purple-800', label: 'Landlord' },
    tenant: { className: 'bg-sky-100 text-sky-800', label: 'Tenant' },
    other: { className: 'bg-gray-100 text-gray-800', label: 'Other' },
  };
  const c = config[type] || config.other;
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

function emptyLine(): LineItemForm {
  return { description: '', quantity: 1, unit_price: 0, tax_rate_id: null, tax_amount: 0, account_id: null };
}

function emptyForm(): CreateInvoiceForm {
  return {
    invoice_date: todayISO(),
    due_date: defaultDueDate(),
    customer_type: 'landlord',
    customer_id: null,
    customer_name: '',
    customer_email: '',
    customer_address: '',
    customer_vat_number: '',
    property_id: null,
    notes: '',
    internal_notes: '',
    lines: [emptyLine()],
  };
}

// --- Component ---

export default function BusinessInvoices() {
  const { toast } = useToast();

  // State
  const [statusFilter, setStatusFilter] = useState('all');
  const [customerTypeFilter, setCustomerTypeFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [form, setForm] = useState<CreateInvoiceForm>(emptyForm());

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (customerTypeFilter !== 'all') params.set('customer_type', customerTypeFilter);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    return params.toString();
  }, [statusFilter, customerTypeFilter, fromDate, toDate]);

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery<BusinessInvoice[]>({
    queryKey: ['/api/crm/accounting/business-invoices', queryParams],
    queryFn: async () => {
      const url = queryParams
        ? `/api/crm/accounting/business-invoices?${queryParams}`
        : '/api/crm/accounting/business-invoices';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch invoices');
      return res.json();
    },
  });

  // Fetch single invoice detail
  const { data: invoiceDetail, isLoading: detailLoading } = useQuery<InvoiceDetail>({
    queryKey: ['/api/crm/accounting/business-invoices', selectedInvoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/accounting/business-invoices/${selectedInvoiceId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch invoice detail');
      return res.json();
    },
    enabled: selectedInvoiceId !== null,
  });

  // Fetch tax rates
  const { data: taxRates = [] } = useQuery<TaxRate[]>({
    queryKey: ['/api/crm/accounting/tax-rates'],
  });

  // Fetch revenue accounts
  const { data: revenueAccounts = [] } = useQuery<ChartAccount[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts?type=revenue'],
  });

  // Tax rate lookup map
  const taxRateMap = useMemo(() => new Map(taxRates.map(tr => [tr.id, tr])), [taxRates]);

  // Summary calculations
  const summaryStats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let totalOutstanding = 0;
    let totalOverdue = 0;
    let draftCount = 0;
    let paidThisMonth = 0;

    for (const inv of invoices) {
      const outstanding = inv.total_amount - inv.amount_paid;
      if (inv.status !== 'voided' && inv.status !== 'paid') {
        totalOutstanding += outstanding;
      }
      if (inv.status === 'overdue') {
        totalOverdue += outstanding;
      }
      if (inv.status === 'draft') {
        draftCount++;
      }
      if (inv.status === 'paid') {
        const paidDate = inv.due_date ? new Date(inv.due_date) : null;
        if (paidDate && paidDate >= startOfMonth) {
          paidThisMonth += inv.total_amount;
        }
      }
    }

    return { totalOutstanding, totalOverdue, draftCount, paidThisMonth };
  }, [invoices]);

  // Filtered invoices (search only; status/customerType/dates are handled server-side)
  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return invoices;
    const term = searchTerm.toLowerCase();
    return invoices.filter(inv =>
      inv.invoice_number?.toLowerCase().includes(term) ||
      inv.customer_name?.toLowerCase().includes(term) ||
      inv.customer_email?.toLowerCase().includes(term)
    );
  }, [invoices, searchTerm]);

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (data: CreateInvoiceForm) => {
      const lines = data.lines
        .filter(l => l.description.trim())
        .map(l => ({
          description: l.description,
          quantity: l.quantity,
          unit_price: Math.round(l.unit_price * 100),
          tax_rate_id: l.tax_rate_id,
          tax_amount: l.tax_amount,
          account_id: l.account_id,
        }));
      return apiRequest('/api/crm/accounting/business-invoices', 'POST', {
        invoice_date: data.invoice_date,
        due_date: data.due_date,
        customer_type: data.customer_type,
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        customer_email: data.customer_email,
        customer_address: data.customer_address,
        customer_vat_number: data.customer_vat_number,
        property_id: data.property_id,
        notes: data.notes,
        internal_notes: data.internal_notes,
        lines,
      });
    },
    onSuccess: () => {
      toast({ title: 'Invoice created', description: 'New sales invoice has been created as a draft.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/business-invoices'] });
      setShowCreateSheet(false);
      setForm(emptyForm());
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/crm/accounting/business-invoices/${id}/approve`, 'PUT'),
    onSuccess: () => {
      toast({ title: 'Invoice approved' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/business-invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/crm/accounting/business-invoices/${id}/send`, 'PUT'),
    onSuccess: () => {
      toast({ title: 'Invoice sent', description: 'Invoice has been sent to the customer.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/business-invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const voidMutation = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/crm/accounting/business-invoices/${id}/void`, 'PUT'),
    onSuccess: () => {
      toast({ title: 'Invoice voided' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/business-invoices'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // --- Line item helpers ---

  const recalcLineTaxAmount = useCallback((line: LineItemForm): number => {
    if (!line.tax_rate_id) return 0;
    const tr = taxRateMap.get(line.tax_rate_id);
    if (!tr) return 0;
    const lineTotalPence = Math.round(line.quantity * line.unit_price * 100);
    return Math.round(lineTotalPence * tr.rate / 100);
  }, [taxRateMap]);

  const updateLine = useCallback((index: number, field: keyof LineItemForm, value: any) => {
    setForm(prev => {
      const lines = [...prev.lines];
      const line = { ...lines[index], [field]: value };
      // Recalculate tax when quantity, price, or tax rate changes
      if (field === 'quantity' || field === 'unit_price' || field === 'tax_rate_id') {
        line.tax_amount = recalcLineTaxAmount(line);
      }
      lines[index] = line;
      return { ...prev, lines };
    });
  }, [recalcLineTaxAmount]);

  const addLine = useCallback(() => {
    setForm(prev => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  }, []);

  const removeLine = useCallback((index: number) => {
    setForm(prev => {
      if (prev.lines.length <= 1) return prev;
      const lines = prev.lines.filter((_, i) => i !== index);
      return { ...prev, lines };
    });
  }, []);

  // Form totals (in pence)
  const formTotals = useMemo(() => {
    const validLines = form.lines.filter(l => l.description.trim());
    const subtotal = validLines.reduce((sum, l) => sum + Math.round(l.quantity * l.unit_price * 100), 0);
    const vat = validLines.reduce((sum, l) => sum + l.tax_amount, 0);
    return { subtotal, vat, total: subtotal + vat };
  }, [form.lines]);

  // --- Handlers ---

  const handleCreate = () => {
    if (!form.customer_name.trim()) {
      toast({ title: 'Validation', description: 'Customer name is required.', variant: 'destructive' });
      return;
    }
    if (form.lines.filter(l => l.description.trim()).length === 0) {
      toast({ title: 'Validation', description: 'At least one line item is required.', variant: 'destructive' });
      return;
    }
    createMutation.mutate(form);
  };

  const openDetail = (id: number) => {
    setSelectedInvoiceId(id);
    setShowDetailDialog(true);
  };

  const toggleRow = (id: number) => {
    setExpandedRow(prev => (prev === id ? null : id));
  };

  // --- Render ---

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" style={{ color: '#791E75' }} />
            Sales Invoices
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create and manage sales invoices for landlords, tenants, and other customers
          </p>
        </div>
        <Button onClick={() => { setForm(emptyForm()); setShowCreateSheet(true); }} style={{ backgroundColor: '#791E75' }} className="hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" />
          New Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#791E75' }}>
              {formatCurrency(summaryStats.totalOutstanding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(summaryStats.totalOverdue)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Draft Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              {summaryStats.draftCount}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(summaryStats.paidThisMonth)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Invoice #, customer name or email..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Customer Type</Label>
              <Select value={customerTypeFilter} onValueChange={setCustomerTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground mb-1 block">From Date</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-muted-foreground mb-1 block">To Date</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            {(statusFilter !== 'all' || customerTypeFilter !== 'all' || fromDate || toDate || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setStatusFilter('all'); setCustomerTypeFilter('all'); setFromDate(''); setToDate(''); setSearchTerm(''); }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin mr-2" style={{ color: '#791E75' }} />
              <span className="text-muted-foreground">Loading invoices...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium">No invoices found</p>
              <p className="text-sm">Create your first invoice or adjust your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map(inv => {
                  const outstanding = inv.total_amount - inv.amount_paid;
                  const isExpanded = expandedRow === inv.id;
                  return (
                    <>
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleRow(inv.id)}
                      >
                        <TableCell className="w-[40px] px-2">
                          {isExpanded
                            ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          }
                        </TableCell>
                        <TableCell className="font-medium">{inv.invoice_number || '-'}</TableCell>
                        <TableCell>{formatDate(inv.invoice_date)}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-sm">{inv.customer_name}</span>
                            <span>{getCustomerTypeBadge(inv.customer_type)}</span>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(inv.due_date)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(inv.amount_paid)}</TableCell>
                        <TableCell className={cn('text-right font-medium', outstanding > 0 && inv.status === 'overdue' ? 'text-red-600' : '')}>
                          {formatCurrency(outstanding)}
                        </TableCell>
                        <TableCell>{getStatusBadge(inv.status)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(inv.id)} title="View details">
                              <Eye className="h-4 w-4" />
                            </Button>
                            {inv.status === 'draft' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-indigo-600 hover:text-indigo-700"
                                onClick={() => approveMutation.mutate(inv.id)}
                                disabled={approveMutation.isPending}
                                title="Approve"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                            )}
                            {(inv.status === 'approved' || inv.status === 'draft') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-blue-600 hover:text-blue-700"
                                onClick={() => sendMutation.mutate(inv.id)}
                                disabled={sendMutation.isPending}
                                title="Send"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {inv.status !== 'voided' && inv.status !== 'paid' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                onClick={() => voidMutation.mutate(inv.id)}
                                disabled={voidMutation.isPending}
                                title="Void"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow key={`${inv.id}-expanded`}>
                          <TableCell colSpan={10} className="bg-muted/30 p-0">
                            <InlineInvoiceDetail invoiceId={inv.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invoice Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: '#791E75' }} />
              Invoice Detail
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: '#791E75' }} />
            </div>
          ) : invoiceDetail ? (
            <InvoiceDetailContent invoice={invoiceDetail} />
          ) : (
            <p className="text-center py-8 text-muted-foreground">Invoice not found.</p>
          )}
          <DialogFooter>
            {invoiceDetail && invoiceDetail.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => { approveMutation.mutate(invoiceDetail.id); setShowDetailDialog(false); }}
                disabled={approveMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
            )}
            {invoiceDetail && (invoiceDetail.status === 'approved' || invoiceDetail.status === 'draft') && (
              <Button
                onClick={() => { sendMutation.mutate(invoiceDetail.id); setShowDetailDialog(false); }}
                disabled={sendMutation.isPending}
                style={{ backgroundColor: '#791E75' }}
                className="hover:opacity-90"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Invoice
              </Button>
            )}
            {invoiceDetail && invoiceDetail.status !== 'voided' && invoiceDetail.status !== 'paid' && (
              <Button
                variant="destructive"
                onClick={() => { voidMutation.mutate(invoiceDetail.id); setShowDetailDialog(false); }}
                disabled={voidMutation.isPending}
              >
                <Ban className="h-4 w-4 mr-2" />
                Void
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Invoice Sheet */}
      <Sheet open={showCreateSheet} onOpenChange={setShowCreateSheet}>
        <SheetContent side="right" className="w-full sm:max-w-2xl lg:max-w-3xl p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" style={{ color: '#791E75' }} />
              New Sales Invoice
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-140px)]">
            <div className="px-6 py-6 space-y-6">
              {/* Customer Section */}
              <div>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">Customer</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Customer Type</Label>
                    <Select value={form.customer_type} onValueChange={v => setForm(prev => ({ ...prev, customer_type: v }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="landlord">Landlord</SelectItem>
                        <SelectItem value="tenant">Tenant</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Customer Name <span className="text-red-500">*</span></Label>
                    <Input
                      value={form.customer_name}
                      onChange={e => setForm(prev => ({ ...prev, customer_name: e.target.value }))}
                      placeholder="Enter customer name"
                    />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={form.customer_email}
                      onChange={e => setForm(prev => ({ ...prev, customer_email: e.target.value }))}
                      placeholder="customer@example.com"
                    />
                  </div>
                  <div>
                    <Label>VAT Number</Label>
                    <Input
                      value={form.customer_vat_number}
                      onChange={e => setForm(prev => ({ ...prev, customer_vat_number: e.target.value }))}
                      placeholder="GB123456789"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Address</Label>
                    <Textarea
                      value={form.customer_address}
                      onChange={e => setForm(prev => ({ ...prev, customer_address: e.target.value }))}
                      placeholder="Full billing address"
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Invoice Details */}
              <div>
                <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-3">Invoice Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Invoice Date</Label>
                    <Input
                      type="date"
                      value={form.invoice_date}
                      onChange={e => setForm(prev => ({ ...prev, invoice_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Due Date</Label>
                    <Input
                      type="date"
                      value={form.due_date}
                      onChange={e => setForm(prev => ({ ...prev, due_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Property ID (optional)</Label>
                    <Input
                      type="number"
                      value={form.property_id ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, property_id: e.target.value ? parseInt(e.target.value) : null }))}
                      placeholder="Property reference"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Line Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Line Items</h3>
                  <Button variant="outline" size="sm" onClick={addLine}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </div>
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="min-w-[200px]">Description</TableHead>
                        <TableHead className="w-[80px]">Qty</TableHead>
                        <TableHead className="w-[120px]">Unit Price</TableHead>
                        <TableHead className="w-[150px]">Tax Rate</TableHead>
                        <TableHead className="w-[100px] text-right">Tax</TableHead>
                        <TableHead className="w-[120px] text-right">Line Total</TableHead>
                        <TableHead className="w-[150px]">Account</TableHead>
                        <TableHead className="w-[40px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.lines.map((line, idx) => {
                        const lineTotalPence = Math.round(line.quantity * line.unit_price * 100);
                        return (
                          <TableRow key={idx}>
                            <TableCell className="p-1">
                              <Input
                                value={line.description}
                                onChange={e => updateLine(idx, 'description', e.target.value)}
                                placeholder="Description"
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input
                                type="number"
                                min={1}
                                step={1}
                                value={line.quantity}
                                onChange={e => updateLine(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                className="h-9"
                              />
                            </TableCell>
                            <TableCell className="p-1">
                              <div className="relative">
                                <PoundSterling className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                                <Input
                                  type="number"
                                  min={0}
                                  step={0.01}
                                  value={line.unit_price || ''}
                                  onChange={e => updateLine(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                                  className="h-9 pl-7"
                                  placeholder="0.00"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="p-1">
                              <Select
                                value={line.tax_rate_id?.toString() ?? 'none'}
                                onValueChange={v => updateLine(idx, 'tax_rate_id', v === 'none' ? null : parseInt(v))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="No tax" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No tax</SelectItem>
                                  {taxRates.map(tr => (
                                    <SelectItem key={tr.id} value={tr.id.toString()}>
                                      {tr.name} ({tr.rate}%)
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1 text-right text-sm">
                              {formatCurrency(line.tax_amount)}
                            </TableCell>
                            <TableCell className="p-1 text-right text-sm font-medium">
                              {formatCurrency(lineTotalPence + line.tax_amount)}
                            </TableCell>
                            <TableCell className="p-1">
                              <Select
                                value={line.account_id?.toString() ?? 'none'}
                                onValueChange={v => updateLine(idx, 'account_id', v === 'none' ? null : parseInt(v))}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue placeholder="Account" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">No account</SelectItem>
                                  {revenueAccounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.id.toString()}>
                                      {acc.code} - {acc.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="p-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500 hover:text-red-600"
                                onClick={() => removeLine(idx)}
                                disabled={form.lines.length <= 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Totals */}
                <div className="flex justify-end mt-4">
                  <div className="w-[280px] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">{formatCurrency(formTotals.subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">VAT</span>
                      <span className="font-medium">{formatCurrency(formTotals.vat)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between text-base font-bold">
                      <span>Total</span>
                      <span style={{ color: '#791E75' }}>{formatCurrency(formTotals.total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Notes (visible on invoice)</Label>
                  <Textarea
                    value={form.notes}
                    onChange={e => setForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Payment terms, bank details, etc."
                    rows={3}
                  />
                </div>
                <div>
                  <Label>Internal Notes (not on invoice)</Label>
                  <Textarea
                    value={form.internal_notes}
                    onChange={e => setForm(prev => ({ ...prev, internal_notes: e.target.value }))}
                    placeholder="Internal reference notes..."
                    rows={3}
                  />
                </div>
              </div>

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-2 pb-4">
                <Button variant="outline" onClick={() => setShowCreateSheet(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={createMutation.isPending}
                  style={{ backgroundColor: '#791E75' }}
                  className="hover:opacity-90"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Invoice
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// --- Sub-components ---

function InlineInvoiceDetail({ invoiceId }: { invoiceId: number }) {
  const { data: detail, isLoading } = useQuery<InvoiceDetail>({
    queryKey: ['/api/crm/accounting/business-invoices', invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/accounting/business-invoices/${invoiceId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin mr-2" style={{ color: '#791E75' }} />
        <span className="text-sm text-muted-foreground">Loading details...</span>
      </div>
    );
  }

  if (!detail) {
    return <div className="text-center py-6 text-muted-foreground text-sm">Could not load invoice details.</div>;
  }

  return (
    <div className="p-4">
      <InvoiceDetailContent invoice={detail} compact />
    </div>
  );
}

function InvoiceDetailContent({ invoice, compact = false }: { invoice: InvoiceDetail; compact?: boolean }) {
  const lines = invoice.lines || [];
  const outstanding = invoice.total_amount - invoice.amount_paid;

  return (
    <div className={cn('space-y-4', compact && 'space-y-3')}>
      {/* Customer & Invoice Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Customer</h4>
          <div className="text-sm space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{invoice.customer_name}</span>
              {getCustomerTypeBadge(invoice.customer_type)}
            </div>
            {invoice.customer_email && (
              <div className="text-muted-foreground">{invoice.customer_email}</div>
            )}
            {invoice.customer_address && (
              <div className="text-muted-foreground whitespace-pre-line">{invoice.customer_address}</div>
            )}
            {invoice.customer_vat_number && (
              <div className="text-muted-foreground">VAT: {invoice.customer_vat_number}</div>
            )}
          </div>
        </div>
        <div className="space-y-2">
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Invoice</h4>
          <div className="text-sm space-y-1">
            <div><span className="text-muted-foreground">Number:</span> <span className="font-medium">{invoice.invoice_number || '-'}</span></div>
            <div><span className="text-muted-foreground">Date:</span> {formatDate(invoice.invoice_date)}</div>
            <div><span className="text-muted-foreground">Due:</span> {formatDate(invoice.due_date)}</div>
            <div><span className="text-muted-foreground">Status:</span> {getStatusBadge(invoice.status)}</div>
            {invoice.property_id && (
              <div><span className="text-muted-foreground">Property ID:</span> {invoice.property_id}</div>
            )}
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      {lines.length > 0 && (
        <div>
          <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">Line Items</h4>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[60px] text-right">Qty</TableHead>
                  <TableHead className="w-[100px] text-right">Unit Price</TableHead>
                  <TableHead className="w-[120px]">Tax Rate</TableHead>
                  <TableHead className="w-[90px] text-right">Tax</TableHead>
                  <TableHead className="w-[100px] text-right">Total</TableHead>
                  {!compact && <TableHead className="w-[130px]">Account</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm">{line.description}</TableCell>
                    <TableCell className="text-sm text-right">{line.quantity}</TableCell>
                    <TableCell className="text-sm text-right">{formatCurrency(line.unit_price)}</TableCell>
                    <TableCell className="text-sm">
                      {line.tax_rate_name ? `${line.tax_rate_name} (${line.tax_rate}%)` : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-right">{formatCurrency(line.tax_amount)}</TableCell>
                    <TableCell className="text-sm text-right font-medium">{formatCurrency(line.line_total + line.tax_amount)}</TableCell>
                    {!compact && (
                      <TableCell className="text-sm text-muted-foreground">
                        {line.account_code ? `${line.account_code} - ${line.account_name}` : '-'}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-[280px] space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">VAT</span>
            <span>{formatCurrency(invoice.vat_amount)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{formatCurrency(invoice.total_amount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paid</span>
            <span className="text-green-600">{formatCurrency(invoice.amount_paid)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Outstanding</span>
            <span className={outstanding > 0 ? 'text-red-600' : 'text-green-600'}>{formatCurrency(outstanding)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {(invoice.notes || invoice.internal_notes) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {invoice.notes && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Notes</h4>
              <p className="text-sm whitespace-pre-line bg-muted/30 rounded p-3">{invoice.notes}</p>
            </div>
          )}
          {invoice.internal_notes && (
            <div>
              <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-1">Internal Notes</h4>
              <p className="text-sm whitespace-pre-line bg-amber-50 rounded p-3 border border-amber-100">{invoice.internal_notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
