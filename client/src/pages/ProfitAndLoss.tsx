import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Printer, Loader2, TrendingUp, TrendingDown, DollarSign, Calendar,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// --- Types ---

interface AccountLine {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  total_debits: number;
  total_credits: number;
  balance: number;
}

interface ProfitAndLossData {
  revenue: AccountLine[];
  expenses: AccountLine[];
  total_revenue: number;
  total_expenses: number;
  net_profit: number;
}

// --- Helpers ---

function formatPence(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pounds);
}

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getPresetRange(preset: string): { from: string; to: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  switch (preset) {
    case 'this_month': {
      const from = new Date(year, month, 1);
      const to = new Date(year, month + 1, 0);
      return { from: formatDate(from), to: formatDate(to) };
    }
    case 'this_quarter': {
      const qStart = Math.floor(month / 3) * 3;
      const from = new Date(year, qStart, 1);
      const to = new Date(year, qStart + 3, 0);
      return { from: formatDate(from), to: formatDate(to) };
    }
    case 'this_year': {
      const from = new Date(year, 0, 1);
      const to = new Date(year, 11, 31);
      return { from: formatDate(from), to: formatDate(to) };
    }
    case 'last_year': {
      const from = new Date(year - 1, 0, 1);
      const to = new Date(year - 1, 11, 31);
      return { from: formatDate(from), to: formatDate(to) };
    }
    default:
      return { from: formatDate(new Date(year, month, 1)), to: formatDate(now) };
  }
}

// --- Component ---

export default function ProfitAndLoss() {
  const { toast } = useToast();

  const defaultRange = getPresetRange('this_month');
  const [fromDate, setFromDate] = useState(defaultRange.from);
  const [toDate, setToDate] = useState(defaultRange.to);
  const [activePreset, setActivePreset] = useState<string>('this_month');

  const { data, isLoading, isError } = useQuery<ProfitAndLossData>({
    queryKey: ['/api/crm/accounting/reports/profit-and-loss', fromDate, toDate],
    queryFn: () =>
      apiRequest<ProfitAndLossData>(
        `/api/crm/accounting/reports/profit-and-loss?from_date=${fromDate}&to_date=${toDate}`
      ),
    enabled: !!fromDate && !!toDate,
  });

  const netIsProfit = useMemo(() => (data?.net_profit ?? 0) >= 0, [data]);

  function applyPreset(preset: string) {
    const range = getPresetRange(preset);
    setFromDate(range.from);
    setToDate(range.to);
    setActivePreset(preset);
  }

  function handlePrint() {
    window.print();
  }

  const presets = [
    { key: 'this_month', label: 'This Month' },
    { key: 'this_quarter', label: 'This Quarter' },
    { key: 'this_year', label: 'This Year' },
    { key: 'last_year', label: 'Last Year' },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
            Profit & Loss
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Income statement for the selected period
          </p>
        </div>
        <Button variant="outline" onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#791E75' }}>
          John Barclay Property Management
        </h1>
        <h2 className="text-lg font-semibold mt-1">Profit & Loss Statement</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Period: {fromDate} to {toDate}
        </p>
      </div>

      {/* Date range controls */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from_date" className="text-sm font-medium">
                From Date
              </Label>
              <Input
                id="from_date"
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setActivePreset('');
                }}
                className="w-44"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to_date" className="text-sm font-medium">
                To Date
              </Label>
              <Input
                id="to_date"
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setActivePreset('');
                }}
                className="w-44"
              />
            </div>
            <Separator orientation="vertical" className="h-9 hidden sm:block" />
            <div className="flex gap-2 flex-wrap">
              {presets.map((p) => (
                <Button
                  key={p.key}
                  size="sm"
                  variant={activePreset === p.key ? 'default' : 'outline'}
                  onClick={() => applyPreset(p.key)}
                  className="gap-1.5"
                  style={
                    activePreset === p.key
                      ? { backgroundColor: '#791E75', borderColor: '#791E75' }
                      : {}
                  }
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#791E75' }} />
          <span className="ml-3 text-muted-foreground">Loading report...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8 text-center">
            <p className="text-red-600 font-medium">
              Failed to load the Profit & Loss report. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Report content */}
      {data && !isLoading && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-700">
                  {formatPence(data.total_revenue)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-600" />
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-700">
                  {formatPence(data.total_expenses)}
                </p>
              </CardContent>
            </Card>

            <Card
              className={
                netIsProfit
                  ? 'border-green-200 bg-green-50'
                  : 'border-red-200 bg-red-50'
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <DollarSign
                    className={`h-4 w-4 ${netIsProfit ? 'text-green-600' : 'text-red-600'}`}
                  />
                  Net {netIsProfit ? 'Profit' : 'Loss'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    netIsProfit ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatPence(data.net_profit)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle
                className="text-lg font-semibold flex items-center gap-2"
                style={{ color: '#791E75' }}
              >
                <TrendingUp className="h-5 w-5" />
                Revenue
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-28">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right w-40">Amount (£)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.revenue.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        No revenue accounts for this period
                      </TableCell>
                    </TableRow>
                  )}
                  {data.revenue.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {line.account_code}
                      </TableCell>
                      <TableCell>{line.account_name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPence(line.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Subtotal */}
                  <TableRow className="bg-green-50 border-t-2 border-green-200">
                    <TableCell />
                    <TableCell className="font-bold text-green-800">Total Revenue</TableCell>
                    <TableCell className="text-right font-bold text-green-800">
                      {formatPence(data.total_revenue)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Expenses section */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle
                className="text-lg font-semibold flex items-center gap-2"
                style={{ color: '#791E75' }}
              >
                <TrendingDown className="h-5 w-5" />
                Expenses
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-28">Code</TableHead>
                    <TableHead>Account Name</TableHead>
                    <TableHead className="text-right w-40">Amount (£)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.expenses.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                        No expense accounts for this period
                      </TableCell>
                    </TableRow>
                  )}
                  {data.expenses.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="font-mono text-sm text-muted-foreground">
                        {line.account_code}
                      </TableCell>
                      <TableCell>{line.account_name}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatPence(line.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Subtotal */}
                  <TableRow className="bg-red-50 border-t-2 border-red-200">
                    <TableCell />
                    <TableCell className="font-bold text-red-800">Total Expenses</TableCell>
                    <TableCell className="text-right font-bold text-red-800">
                      {formatPence(data.total_expenses)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Net Profit/Loss bottom row */}
          <Card
            className={`border-2 ${
              netIsProfit ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50'
            }`}
          >
            <CardContent className="py-6">
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold" style={{ color: '#791E75' }}>
                  Net {netIsProfit ? 'Profit' : 'Loss'}
                </span>
                <span
                  className={`text-3xl font-bold ${
                    netIsProfit ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {formatPence(data.net_profit)}
                </span>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
