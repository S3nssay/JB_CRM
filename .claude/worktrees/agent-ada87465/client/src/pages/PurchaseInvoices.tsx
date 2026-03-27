import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  FileText, Plus, Loader2, Search, PoundSterling, AlertTriangle,
  CheckCircle, Clock, Trash2, ShieldCheck, ReceiptText, ArrowUpDown,
  Calendar, Building, User,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

// --- Types ---

interface PurchaseInvoice {
  id: number;
  invoice_number: string | null;
  supplier_type: string;
  supplier_id: number | null;
  supplier_name: string;
  invoice_date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  amount_paid: number;
  status: string;
  property_id: number | null;
  landlord_id: number | null;
  is_rechargeable: boolean;
  notes: string | null;
}

interface PurchaseInvoiceLine {
  id: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  tax_rate_id: number | null;
  tax_rate_name: string | null;
  tax_rate: number;
  tax_amount: number;
  account_id: number | null;
  account_code: string | null;
  account_name: string | null;
}

interface PurchaseInvoiceDetail extends PurchaseInvoice {
  lines: PurchaseInvoiceLine[];
}

interface ChartOfAccount {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface TaxRate {
  id: number;
  name: string;
  rate: number;
}

interface PropertyOption {
  id: number;
  address: string;
  addressLine1?: string | null;
  postcode?: string | null;
}

interface LandlordOption {
  id: number;
  name: string;
  email?: string | null;
}

interface LineItemForm {
  description: string;
  quantity: number;
  unit_price_display: string; // pounds for display
  tax_rate_id: string;
  account_id: string;
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `\u00a3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function poundsToPence(pounds: string | number): number {
  const val = typeof pounds === 'string' ? parseFloat(pounds) : pounds;
  if (isNaN(val)) return 0;
  return Math.round(val * 100);
}

function penceToPounds(pence: number): string {
  return (pence / 100).toFixed(2);
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    approved: { variant: 'default', className: 'bg-blue-600 hover:bg-blue-700', label: 'Approved' },
    paid: { variant: 'default', className: 'bg-green-600 hover:bg-green-700', label: 'Paid' },
    overdue: { variant: 'destructive', label: 'Overdue' },
    voided: { variant: 'secondary', className: 'opacity-60 line-through', label: 'Voided' },
  };
  const c = config[status] || config.draft;
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
}

const emptyLine: LineItemForm = {
  description: '',
  quantity: 1,
  unit_price_display: '',
  tax_rate_id: '',
  account_id: '',
};

// --- Component ---

export default function PurchaseInvoices() {
  const { toast } = useToast();

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [supplierTypeFilter, setSupplierTypeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [rechargeableFilter, setRechargeableFilter] = useState(false);

  // Dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  // Form state
  const [supplierType, setSupplierType] = useState('contractor');
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierAddress, setSupplierAddress] = useState('');
  const [supplierVatNumber, setSupplierVatNumber] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [dueDate, setDueDate] = useState(defaultDueDate());
  const [propertyId, setPropertyId] = useState('');
  const [landlordId, setLandlordId] = useState('');
  const [isRechargeable, setIsRechargeable] = useState(false);
  const [notes, setNotes] = useState('');
  const [lineItems, setLineItems] = useState<LineItemForm[]>([{ ...emptyLine }]);

  // Sort state
  const [sortField, setSortField] = useState<string>('invoice_date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // --- Queries ---

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (supplierTypeFilter !== 'all') params.set('supplier_type', supplierTypeFilter);
    if (fromDate) params.set('from_date', fromDate);
    if (toDate) params.set('to_date', toDate);
    return params.toString();
  };

  const { data: invoices = [], isLoading } = useQuery<PurchaseInvoice[]>({
    queryKey: ['/api/crm/accounting/purchase-invoices', statusFilter, supplierTypeFilter, fromDate, toDate],
    queryFn: async () => {
      const qs = buildQueryParams();
      const url = `/api/crm/accounting/purchase-invoices${qs ? `?${qs}` : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch purchase invoices');
      return res.json();
    },
  });

  const { data: invoiceDetail, isLoading: detailLoading } = useQuery<PurchaseInvoiceDetail>({
    queryKey: ['/api/crm/accounting/purchase-invoices', selectedInvoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/accounting/purchase-invoices/${selectedInvoiceId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch invoice detail');
      return res.json();
    },
    enabled: !!selectedInvoiceId && showDetailDialog,
  });

  const { data: expenseAccounts = [] } = useQuery<ChartOfAccount[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts', 'expense'],
    queryFn: async () => {
      const res = await fetch('/api/crm/accounting/chart-of-accounts?type=expense', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: taxRates = [] } = useQuery<TaxRate[]>({
    queryKey: ['/api/crm/accounting/tax-rates'],
    queryFn: async () => {
      const res = await fetch('/api/crm/accounting/tax-rates', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: properties = [] } = useQuery<PropertyOption[]>({
    queryKey: ['/api/crm/properties-list-for-pi'],
    queryFn: async () => {
      const res = await fetch('/api/crm/managed-properties', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: landlords = [] } = useQuery<LandlordOption[]>({
    queryKey: ['/api/crm/landlords-list-for-pi'],
    queryFn: async () => {
      const res = await fetch('/api/crm/landlords', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return apiRequest('/api/crm/accounting/purchase-invoices', 'POST', payload);
    },
    onSuccess: () => {
      toast({ title: 'Purchase Invoice Created', description: 'The purchase invoice has been saved.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/purchase-invoices'] });
      resetForm();
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error Creating Invoice', description: error.message, variant: 'destructive' });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/accounting/purchase-invoices/${id}/approve`, 'PUT');
    },
    onSuccess: () => {
      toast({ title: 'Invoice Approved', description: 'The purchase invoice has been approved for payment.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/purchase-invoices'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Approval Failed', description: error.message, variant: 'destructive' });
    },
  });

  // --- Computed ---

  const filteredInvoices = useMemo(() => {
    let result = invoices;

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(inv =>
        (inv.invoice_number && inv.invoice_number.toLowerCase().includes(term)) ||
        inv.supplier_name.toLowerCase().includes(term)
      );
    }

    // Rechargeable filter
    if (rechargeableFilter) {
      result = result.filter(inv => inv.is_rechargeable);
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: any;
      let bVal: any;
      switch (sortField) {
        case 'invoice_number':
          aVal = a.invoice_number || '';
          bVal = b.invoice_number || '';
          break;
        case 'supplier_name':
          aVal = a.supplier_name;
          bVal = b.supplier_name;
          break;
        case 'invoice_date':
          aVal = a.invoice_date;
          bVal = b.invoice_date;
          break;
        case 'due_date':
          aVal = a.due_date;
          bVal = b.due_date;
          break;
        case 'total_amount':
          aVal = a.total_amount;
          bVal = b.total_amount;
          break;
        default:
          aVal = a.invoice_date;
          bVal = b.invoice_date;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [invoices, searchTerm, rechargeableFilter, sortField, sortDir]);

  // Summary calculations
  const summaryStats = useMemo(() => {
    const totalUnpaid = invoices
      .filter(inv => inv.status === 'approved' || inv.status === 'overdue')
      .reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);
    const overdueAmount = invoices
      .filter(inv => inv.status === 'overdue')
      .reduce((sum, inv) => sum + (inv.total_amount - inv.amount_paid), 0);
    const draftCount = invoices.filter(inv => inv.status === 'draft').length;
    const approvedCount = invoices.filter(inv => inv.status === 'approved').length;

    return { totalUnpaid, overdueAmount, draftCount, approvedCount };
  }, [invoices]);

  // --- Line item helpers ---

  function updateLineItem(index: number, field: keyof LineItemForm, value: string | number) {
    setLineItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function addLineItem() {
    setLineItems(prev => [...prev, { ...emptyLine }]);
  }

  function removeLineItem(index: number) {
    setLineItems(prev => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  }

  function getLineTaxAmount(line: LineItemForm): number {
    const qty = line.quantity || 0;
    const unitPricePence = poundsToPence(line.unit_price_display);
    const lineTotal = qty * unitPricePence;
    if (!line.tax_rate_id) return 0;
    const rate = taxRates.find(tr => tr.id === parseInt(line.tax_rate_id));
    if (!rate) return 0;
    return Math.round(lineTotal * rate.rate / 100);
  }

  function getLineTotal(line: LineItemForm): number {
    return (line.quantity || 0) * poundsToPence(line.unit_price_display);
  }

  const formSubtotal = lineItems.reduce((sum, line) => sum + getLineTotal(line), 0);
  const formVatTotal = lineItems.reduce((sum, line) => sum + getLineTaxAmount(line), 0);
  const formGrandTotal = formSubtotal + formVatTotal;

  // --- Form actions ---

  function resetForm() {
    setSupplierType('contractor');
    setSupplierName('');
    setSupplierEmail('');
    setSupplierAddress('');
    setSupplierVatNumber('');
    setInvoiceNumber('');
    setInvoiceDate(todayStr());
    setDueDate(defaultDueDate());
    setPropertyId('');
    setLandlordId('');
    setIsRechargeable(false);
    setNotes('');
    setLineItems([{ ...emptyLine }]);
  }

  function handleCreateSubmit() {
    if (!supplierName.trim()) {
      toast({ title: 'Validation Error', description: 'Supplier name is required.', variant: 'destructive' });
      return;
    }
    if (!invoiceDate) {
      toast({ title: 'Validation Error', description: 'Invoice date is required.', variant: 'destructive' });
      return;
    }
    if (!dueDate) {
      toast({ title: 'Validation Error', description: 'Due date is required.', variant: 'destructive' });
      return;
    }
    if (lineItems.length === 0 || lineItems.every(l => !l.description.trim())) {
      toast({ title: 'Validation Error', description: 'At least one line item with a description is required.', variant: 'destructive' });
      return;
    }

    const payload = {
      invoice_number: invoiceNumber || null,
      supplier_type: supplierType,
      supplier_id: null,
      supplier_name: supplierName,
      supplier_email: supplierEmail || null,
      supplier_address: supplierAddress || null,
      supplier_vat_number: supplierVatNumber || null,
      invoice_date: invoiceDate,
      due_date: dueDate,
      property_id: propertyId ? parseInt(propertyId) : null,
      landlord_id: landlordId ? parseInt(landlordId) : null,
      is_rechargeable: isRechargeable,
      notes: notes || null,
      lines: lineItems
        .filter(l => l.description.trim())
        .map(l => ({
          description: l.description,
          quantity: l.quantity || 1,
          unit_price: poundsToPence(l.unit_price_display),
          tax_rate_id: l.tax_rate_id ? parseInt(l.tax_rate_id) : null,
          tax_amount: getLineTaxAmount(l),
          account_id: l.account_id ? parseInt(l.account_id) : null,
        })),
    };

    createMutation.mutate(payload);
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  }

  function viewInvoice(id: number) {
    setSelectedInvoiceId(id);
    setShowDetailDialog(true);
  }

  // --- Render ---

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <ReceiptText className="h-7 w-7" style={{ color: '#791E75' }} />
            Purchase Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">Manage bills and invoices from suppliers, contractors and utilities</p>
        </div>
        <Button
          onClick={() => { resetForm(); setShowCreateDialog(true); }}
          style={{ backgroundColor: '#791E75' }}
          className="hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" /> New Purchase Invoice
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Unpaid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <PoundSterling className="h-5 w-5 text-amber-600" />
              <span className="text-2xl font-bold">{formatCurrency(summaryStats.totalUnpaid)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Approved & overdue invoices</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Overdue Amount</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold text-red-600">{formatCurrency(summaryStats.overdueAmount)}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Past due date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Draft Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-gray-500" />
              <span className="text-2xl font-bold">{summaryStats.draftCount}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Awaiting approval</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Approved Awaiting Payment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: '#791E75' }} />
              <span className="text-2xl font-bold">{summaryStats.approvedCount}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Ready to pay</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-gray-500 mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Invoice # or supplier name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status */}
            <div className="w-[160px]">
              <Label className="text-xs text-gray-500 mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Supplier Type */}
            <div className="w-[160px]">
              <Label className="text-xs text-gray-500 mb-1 block">Supplier Type</Label>
              <Select value={supplierTypeFilter} onValueChange={setSupplierTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="contractor">Contractor</SelectItem>
                  <SelectItem value="utility">Utility</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
            <div className="w-[150px]">
              <Label className="text-xs text-gray-500 mb-1 block">From Date</Label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="w-[150px]">
              <Label className="text-xs text-gray-500 mb-1 block">To Date</Label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </div>

            {/* Rechargeable toggle */}
            <div className="flex items-center gap-2 pb-1">
              <Switch
                checked={rechargeableFilter}
                onCheckedChange={setRechargeableFilter}
                id="rechargeable-filter"
              />
              <Label htmlFor="rechargeable-filter" className="text-xs text-gray-600 cursor-pointer whitespace-nowrap">
                Rechargeable Only
              </Label>
            </div>

            {/* Clear filters */}
            {(statusFilter !== 'all' || supplierTypeFilter !== 'all' || fromDate || toDate || searchTerm || rechargeableFilter) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStatusFilter('all');
                  setSupplierTypeFilter('all');
                  setFromDate('');
                  setToDate('');
                  setSearchTerm('');
                  setRechargeableFilter(false);
                }}
                className="text-xs"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invoices Table */}
      <Card>
        <CardContent className="pt-0 px-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <ReceiptText className="h-12 w-12 mb-3" />
              <p className="text-lg font-medium">No purchase invoices found</p>
              <p className="text-sm">Create a new purchase invoice or adjust your filters.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('invoice_number')}
                  >
                    <span className="flex items-center gap-1">
                      Invoice # <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('supplier_name')}
                  >
                    <span className="flex items-center gap-1">
                      Supplier <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('invoice_date')}
                  >
                    <span className="flex items-center gap-1">
                      Date <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('due_date')}
                  >
                    <span className="flex items-center gap-1">
                      Due Date <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead
                    className="text-right cursor-pointer hover:bg-gray-50"
                    onClick={() => handleSort('total_amount')}
                  >
                    <span className="flex items-center gap-1 justify-end">
                      Total <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rechargeable</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => viewInvoice(inv.id)}
                  >
                    <TableCell className="font-mono text-sm">
                      {inv.invoice_number || '-'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{inv.supplier_name}</span>
                        <span className="text-xs text-gray-400 ml-2 capitalize">{inv.supplier_type}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(inv.invoice_date)}</TableCell>
                    <TableCell className="text-sm">{formatDate(inv.due_date)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(inv.total_amount)}</TableCell>
                    <TableCell>{getStatusBadge(inv.status)}</TableCell>
                    <TableCell>
                      {inv.is_rechargeable ? (
                        <Badge variant="outline" className="border-amber-500 text-amber-700 bg-amber-50">
                          Rechargeable
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {inv.status === 'draft' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => approveMutation.mutate(inv.id)}
                            disabled={approveMutation.isPending}
                            className="text-green-700 hover:text-green-800 hover:bg-green-50"
                            title="Approve"
                          >
                            {approveMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => viewInvoice(inv.id)}
                          title="View details"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {filteredInvoices.length > 0 && (
            <div className="px-4 py-3 border-t text-xs text-gray-500">
              Showing {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === Detail Dialog === */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" style={{ color: '#791E75' }} />
              Purchase Invoice Details
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : invoiceDetail ? (
            <div className="space-y-6">
              {/* Invoice header info */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Invoice #</Label>
                  <p className="font-mono font-medium">{invoiceDetail.invoice_number || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Status</Label>
                  <div className="mt-0.5">{getStatusBadge(invoiceDetail.status)}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Supplier</Label>
                  <p className="font-medium">{invoiceDetail.supplier_name}</p>
                  <p className="text-xs text-gray-400 capitalize">{invoiceDetail.supplier_type}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Invoice Date</Label>
                  <p>{formatDate(invoiceDetail.invoice_date)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Due Date</Label>
                  <p>{formatDate(invoiceDetail.due_date)}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Rechargeable</Label>
                  <p>{invoiceDetail.is_rechargeable ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {invoiceDetail.notes && (
                <div>
                  <Label className="text-xs text-gray-500">Notes</Label>
                  <p className="text-sm text-gray-700 mt-1">{invoiceDetail.notes}</p>
                </div>
              )}

              <Separator />

              {/* Line items table */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Line Items</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right w-[80px]">Qty</TableHead>
                      <TableHead className="text-right w-[100px]">Unit Price</TableHead>
                      <TableHead className="text-right w-[100px]">Net</TableHead>
                      <TableHead className="w-[100px]">Tax Rate</TableHead>
                      <TableHead className="text-right w-[80px]">VAT</TableHead>
                      <TableHead className="w-[120px]">Account</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoiceDetail.lines && invoiceDetail.lines.map((line) => (
                      <TableRow key={line.id}>
                        <TableCell className="text-sm">{line.description}</TableCell>
                        <TableCell className="text-right text-sm">{line.quantity}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(line.unit_price)}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(line.line_total)}</TableCell>
                        <TableCell className="text-sm text-gray-500">{line.tax_rate_name || '-'}</TableCell>
                        <TableCell className="text-right text-sm">{formatCurrency(line.tax_amount)}</TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {line.account_code ? `${line.account_code} - ${line.account_name}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <Separator />

              {/* Totals */}
              <div className="flex justify-end">
                <div className="w-[280px] space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Subtotal</span>
                    <span>{formatCurrency(invoiceDetail.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">VAT</span>
                    <span>{formatCurrency(invoiceDetail.vat_amount)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(invoiceDetail.total_amount)}</span>
                  </div>
                  {invoiceDetail.amount_paid > 0 && (
                    <>
                      <div className="flex justify-between text-sm text-green-700">
                        <span>Paid</span>
                        <span>{formatCurrency(invoiceDetail.amount_paid)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold">
                        <span>Balance Due</span>
                        <span>{formatCurrency(invoiceDetail.total_amount - invoiceDetail.amount_paid)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              {invoiceDetail.status === 'draft' && (
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      approveMutation.mutate(invoiceDetail.id);
                      setShowDetailDialog(false);
                    }}
                    disabled={approveMutation.isPending}
                    style={{ backgroundColor: '#791E75' }}
                    className="hover:opacity-90"
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-4 w-4 mr-2" />
                    )}
                    Approve Invoice
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 py-8 text-center">Invoice not found.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* === Create Purchase Invoice Dialog === */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" style={{ color: '#791E75' }} />
              New Purchase Invoice
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Supplier Section */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <User className="h-4 w-4" /> Supplier Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Supplier Type *</Label>
                  <Select value={supplierType} onValueChange={setSupplierType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contractor">Contractor</SelectItem>
                      <SelectItem value="utility">Utility Provider</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Supplier Name *</Label>
                  <Input
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    placeholder="e.g. ABC Plumbing Ltd"
                  />
                </div>
                <div>
                  <Label className="text-xs">Supplier Email</Label>
                  <Input
                    type="email"
                    value={supplierEmail}
                    onChange={(e) => setSupplierEmail(e.target.value)}
                    placeholder="accounts@supplier.com"
                  />
                </div>
                <div>
                  <Label className="text-xs">VAT Number</Label>
                  <Input
                    value={supplierVatNumber}
                    onChange={(e) => setSupplierVatNumber(e.target.value)}
                    placeholder="GB 123 4567 89"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Supplier Address</Label>
                  <Input
                    value={supplierAddress}
                    onChange={(e) => setSupplierAddress(e.target.value)}
                    placeholder="Full postal address"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Invoice Details */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" /> Invoice Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Supplier Invoice Number</Label>
                  <Input
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    placeholder="Supplier's reference"
                  />
                </div>
                <div>
                  <Label className="text-xs">Invoice Date *</Label>
                  <Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Due Date *</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </div>

            <Separator />

            {/* Property & Landlord Association */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Building className="h-4 w-4" /> Property & Landlord
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Property</Label>
                  <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.address || `${p.addressLine1 || ''} ${p.postcode || ''}`.trim()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Landlord</Label>
                  <Select value={landlordId} onValueChange={setLandlordId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select landlord (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {landlords.map((l) => (
                        <SelectItem key={l.id} value={String(l.id)}>
                          {l.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-3 mt-4">
                <Switch
                  checked={isRechargeable}
                  onCheckedChange={setIsRechargeable}
                  id="is-rechargeable"
                />
                <Label htmlFor="is-rechargeable" className="text-sm cursor-pointer">
                  Rechargeable to landlord
                </Label>
                {isRechargeable && (
                  <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                    This cost will be passed on to the landlord
                  </span>
                )}
              </div>
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Line Items</h3>
                <Button variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-3 w-3 mr-1" /> Add Line
                </Button>
              </div>

              <div className="space-y-3">
                {/* Column headers */}
                <div className="hidden md:grid md:grid-cols-[1fr_80px_100px_140px_160px_36px] gap-2 px-1">
                  <Label className="text-xs text-gray-500">Description *</Label>
                  <Label className="text-xs text-gray-500">Qty</Label>
                  <Label className="text-xs text-gray-500">Unit Price</Label>
                  <Label className="text-xs text-gray-500">Tax Rate</Label>
                  <Label className="text-xs text-gray-500">Expense Account</Label>
                  <span />
                </div>

                {lineItems.map((line, idx) => (
                  <div key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_80px_100px_140px_160px_36px] gap-2 items-start bg-gray-50 rounded-lg p-2 md:p-1 md:bg-transparent">
                    <div>
                      <Label className="text-xs text-gray-500 md:hidden">Description *</Label>
                      <Input
                        value={line.description}
                        onChange={(e) => updateLineItem(idx, 'description', e.target.value)}
                        placeholder="Work description..."
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 md:hidden">Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={line.quantity}
                        onChange={(e) => updateLineItem(idx, 'quantity', parseFloat(e.target.value) || 0)}
                        className="text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 md:hidden">Unit Price (pounds)</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-gray-400 text-sm">£</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price_display}
                          onChange={(e) => updateLineItem(idx, 'unit_price_display', e.target.value)}
                          className="text-sm pl-7"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 md:hidden">Tax Rate</Label>
                      <Select value={line.tax_rate_id} onValueChange={(val) => updateLineItem(idx, 'tax_rate_id', val)}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="No tax" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No Tax</SelectItem>
                          {taxRates.map((tr) => (
                            <SelectItem key={tr.id} value={String(tr.id)}>
                              {tr.name} ({tr.rate}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500 md:hidden">Expense Account</Label>
                      <Select value={line.account_id} onValueChange={(val) => updateLineItem(idx, 'account_id', val)}>
                        <SelectTrigger className="text-sm">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {expenseAccounts.map((acc) => (
                            <SelectItem key={acc.id} value={String(acc.id)}>
                              {acc.code} - {acc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-center md:mt-0 mt-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(idx)}
                        disabled={lineItems.length <= 1}
                        className="h-8 w-8 text-red-400 hover:text-red-600 hover:bg-red-50"
                        title="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Per-line total visible on mobile */}
                    <div className="md:hidden text-right text-sm text-gray-600 col-span-1">
                      Line total: {formatCurrency(getLineTotal(line))} + {formatCurrency(getLineTaxAmount(line))} VAT
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-[300px] space-y-2 bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Subtotal</span>
                  <span className="font-medium">{formatCurrency(formSubtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">VAT</span>
                  <span className="font-medium">{formatCurrency(formVatTotal)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span style={{ color: '#791E75' }}>{formatCurrency(formGrandTotal)}</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about this invoice..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={createMutation.isPending}
              style={{ backgroundColor: '#791E75' }}
              className="hover:opacity-90"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Save as Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
