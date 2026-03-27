import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  TrendingUp, TrendingDown, Banknote, ArrowUpRight, ArrowDownRight,
  AlertTriangle, Loader2, FileText, Receipt, CreditCard,
  Gauge, PoundSterling,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';

const BRAND = '#791E75';

interface DashboardData {
  revenue_this_month: number;
  revenue_last_month: number;
  expenses_this_month: number;
  expenses_last_month: number;
  net_profit_this_month: number;
  cash_balance: number;
  outstanding_receivables: number;
  outstanding_payables: number;
  overdue_invoices_count: number;
  pending_approvals_count: number;
  recent_transactions: {
    id: number;
    entry_number: string;
    entry_date: string;
    description: string;
    source_type: string | null;
    status: string;
    total_amount: number;
  }[];
}

function formatPence(pence: number): string {
  const pounds = (pence || 0) / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pounds);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) return null;
  const change = ((current - previous) / Math.abs(previous)) * 100;
  const isPositive = change >= 0;
  return (
    <span className={`text-xs flex items-center gap-0.5 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(change).toFixed(1)}%
    </span>
  );
}

const sourceTypeLabels: Record<string, string> = {
  manual: 'Manual',
  sales_invoice: 'Sales Invoice',
  purchase_invoice: 'Purchase Invoice',
  credit_note: 'Credit Note',
  payment: 'Payment',
  bank_import: 'Bank Import',
  vat_return: 'VAT Return',
  opening_balance: 'Opening Balance',
};

export default function AccountingDashboard() {
  const [, navigate] = useLocation();

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['/api/crm/accounting/dashboard'],
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
        <p className="text-destructive font-medium">Failed to load dashboard</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: BRAND }}>
            <Gauge className="h-6 w-6" />
            Accounting Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Financial overview and key metrics</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/crm/accounting/business-invoices')} className="gap-1.5">
            <FileText className="h-3.5 w-3.5" /> New Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/crm/accounting/purchase-invoices')} className="gap-1.5">
            <Receipt className="h-3.5 w-3.5" /> New Purchase
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/crm/accounting/payment-allocations')} className="gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Record Payment
          </Button>
        </div>
      </div>

      {/* Overdue Alert */}
      {data.overdue_invoices_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-800">
              {data.overdue_invoices_count} overdue invoice{data.overdue_invoices_count !== 1 ? 's' : ''} require attention
            </p>
            <button
              className="text-xs text-red-600 underline hover:no-underline"
              onClick={() => navigate('/crm/accounting/reports/aged-debtors')}
            >
              View aged debtors report
            </button>
          </div>
        </div>
      )}

      {/* Pending Approvals Alert */}
      {data.pending_approvals_count > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              {data.pending_approvals_count} purchase invoice{data.pending_approvals_count !== 1 ? 's' : ''} awaiting approval
            </p>
            <button
              className="text-xs text-amber-600 underline hover:no-underline"
              onClick={() => navigate('/crm/accounting/purchase-invoices')}
            >
              Review purchase invoices
            </button>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Revenue */}
        <Card className="border-l-4" style={{ borderLeftColor: '#16a34a' }}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-green-600" />
              Revenue (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-lg font-bold text-green-700">{formatPence(data.revenue_this_month)}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-muted-foreground">vs last month</span>
              <ChangeIndicator current={data.revenue_this_month} previous={data.revenue_last_month} />
            </div>
          </CardContent>
        </Card>

        {/* Expenses */}
        <Card className="border-l-4" style={{ borderLeftColor: '#dc2626' }}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-red-600" />
              Expenses (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-lg font-bold text-red-700">{formatPence(data.expenses_this_month)}</div>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="text-[10px] text-muted-foreground">vs last month</span>
              <ChangeIndicator current={data.expenses_this_month} previous={data.expenses_last_month} />
            </div>
          </CardContent>
        </Card>

        {/* Net Profit */}
        <Card className="border-l-4" style={{ borderLeftColor: BRAND }}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <PoundSterling className="h-3.5 w-3.5" style={{ color: BRAND }} />
              Net Profit (MTD)
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-lg font-bold" style={{ color: data.net_profit_this_month >= 0 ? '#16a34a' : '#dc2626' }}>
              {formatPence(data.net_profit_this_month)}
            </div>
          </CardContent>
        </Card>

        {/* Cash Balance */}
        <Card className="border-l-4" style={{ borderLeftColor: '#2563eb' }}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Banknote className="h-3.5 w-3.5 text-blue-600" />
              Cash Balance
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-lg font-bold text-blue-700">{formatPence(data.cash_balance)}</div>
          </CardContent>
        </Card>

        {/* Accounts Receivable */}
        <Card className="border-l-4" style={{ borderLeftColor: '#ca8a04' }}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-yellow-600" />
              Receivables
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-lg font-bold text-yellow-700">{formatPence(data.outstanding_receivables)}</div>
            {data.overdue_invoices_count > 0 && (
              <p className="text-[10px] text-red-600 font-medium mt-0.5">{data.overdue_invoices_count} overdue</p>
            )}
          </CardContent>
        </Card>

        {/* Accounts Payable */}
        <Card className="border-l-4" style={{ borderLeftColor: '#ea580c' }}>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ArrowDownRight className="h-3.5 w-3.5 text-orange-600" />
              Payables
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-lg font-bold text-orange-700">{formatPence(data.outstanding_payables)}</div>
            {data.pending_approvals_count > 0 && (
              <p className="text-[10px] text-amber-600 font-medium mt-0.5">{data.pending_approvals_count} pending approval</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Recent Transactions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.recent_transactions.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <FileText className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No recent transactions</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entry #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent_transactions.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell className="font-mono text-xs">{txn.entry_number}</TableCell>
                    <TableCell className="text-xs">{formatDate(txn.entry_date)}</TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{txn.description}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {txn.source_type ? (sourceTypeLabels[txn.source_type] || txn.source_type) : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold">
                      {formatPence(txn.total_amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
