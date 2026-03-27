import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CreditCard, Loader2, AlertTriangle, Banknote, AlertCircle,
} from 'lucide-react';

const BRAND = '#791E75';

interface PaymentAllocation {
  id: number;
  payment_date: string;
  amount: number;
  payment_method: string | null;
  payment_reference: string | null;
  allocation_type: string | null;
  allocation_id: number | null;
  bank_account_id: number | null;
  journal_entry_id: number | null;
  notes: string | null;
  created_by_id: number | null;
  created_at: string;
}

function formatPence(pence: number): string {
  const pounds = (pence || 0) / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pounds);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const methodLabels: Record<string, string> = {
  bank_transfer: 'Bank Transfer',
  card: 'Card',
  direct_debit: 'Direct Debit',
  cash: 'Cash',
  cheque: 'Cheque',
};

const typeLabels: Record<string, { label: string; color: string; bgColor: string }> = {
  sales_invoice: { label: 'Sales Invoice', color: '#16a34a', bgColor: '#f0fdf4' },
  purchase_invoice: { label: 'Purchase Invoice', color: '#ea580c', bgColor: '#fff7ed' },
  credit_note: { label: 'Credit Note', color: '#7c3aed', bgColor: '#f5f3ff' },
};

export default function PaymentAllocations() {
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<string>('allocated');

  const queryStr = typeFilter !== 'all'
    ? `/api/crm/accounting/payment-allocations?type=${typeFilter}`
    : '/api/crm/accounting/payment-allocations';

  const { data: allocations = [], isLoading, error } = useQuery<PaymentAllocation[]>({
    queryKey: [queryStr],
  });

  const { data: unallocated = [], isLoading: loadingUnallocated } = useQuery<PaymentAllocation[]>({
    queryKey: ['/api/crm/accounting/unallocated-payments'],
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-destructive font-medium">Failed to load payment allocations</p>
      </div>
    );
  }

  const totalAllocated = allocations
    .filter(a => a.allocation_type && a.allocation_id)
    .reduce((sum, a) => sum + a.amount, 0);
  const totalUnallocated = unallocated.reduce((sum, a) => sum + a.amount, 0);

  const renderTable = (data: PaymentAllocation[], showType: boolean = true) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Method</TableHead>
          <TableHead>Reference</TableHead>
          {showType && <TableHead>Type</TableHead>}
          {showType && <TableHead>Invoice #</TableHead>}
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((alloc) => {
          const typeInfo = alloc.allocation_type ? typeLabels[alloc.allocation_type] : null;
          return (
            <TableRow key={alloc.id}>
              <TableCell className="text-xs">{formatDate(alloc.payment_date)}</TableCell>
              <TableCell className="font-mono text-sm font-semibold">{formatPence(alloc.amount)}</TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {alloc.payment_method ? (methodLabels[alloc.payment_method] || alloc.payment_method) : '-'}
                </Badge>
              </TableCell>
              <TableCell className="text-xs font-mono text-muted-foreground">
                {alloc.payment_reference || '-'}
              </TableCell>
              {showType && (
                <TableCell>
                  {typeInfo ? (
                    <Badge
                      variant="outline"
                      className="text-xs"
                      style={{ color: typeInfo.color, backgroundColor: typeInfo.bgColor, borderColor: typeInfo.color }}
                    >
                      {typeInfo.label}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              )}
              {showType && (
                <TableCell className="text-xs font-mono">{alloc.allocation_id || '-'}</TableCell>
              )}
              <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                {alloc.notes || '-'}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRAND }}>Payment Allocations</h1>
          <p className="text-sm text-muted-foreground mt-1">Track payments against invoices and credit notes</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Payments</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold" style={{ color: BRAND }}>{allocations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Allocated</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{formatPence(totalAllocated)}</div>
          </CardContent>
        </Card>
        <Card className="border-orange-200">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Unallocated</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-orange-600">{formatPence(totalUnallocated)}</div>
            <p className="text-xs text-muted-foreground">{unallocated.length} payment{unallocated.length !== 1 ? 's' : ''}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Allocated / Unallocated */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Payments
              </CardTitle>
              {activeTab === 'allocated' && (
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="sales_invoice">Sales Invoice</SelectItem>
                    <SelectItem value="purchase_invoice">Purchase Invoice</SelectItem>
                    <SelectItem value="credit_note">Credit Note</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <TabsList className="mt-3">
              <TabsTrigger value="allocated" className="gap-1.5">
                <Banknote className="h-3.5 w-3.5" />
                Allocated
                {allocations.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">{allocations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="unallocated" className="gap-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                Unallocated
                {unallocated.length > 0 && (
                  <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-orange-100 text-orange-700">
                    {unallocated.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            <TabsContent value="allocated" className="mt-0">
              {allocations.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <CreditCard className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No payment allocations found</p>
                </div>
              ) : (
                <div className="border rounded-md">
                  {renderTable(allocations)}
                </div>
              )}
            </TabsContent>
            <TabsContent value="unallocated" className="mt-0">
              {loadingUnallocated ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : unallocated.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mb-2 opacity-40" />
                  <p className="text-sm">No unallocated payments</p>
                  <p className="text-xs mt-1">All payments have been matched to invoices</p>
                </div>
              ) : (
                <div className="border rounded-md">
                  {renderTable(unallocated, false)}
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
