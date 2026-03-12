import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Printer, Loader2, CheckCircle2, AlertTriangle, Calendar,
  PoundSterling, TrendingUp, Scale, Landmark, Wallet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// --- Types ---

interface AccountRow {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  balance: number; // pence
}

interface BalanceSheetData {
  assets: AccountRow[];
  liabilities: AccountRow[];
  equity: AccountRow[];
  total_assets: number; // pence
  total_liabilities: number; // pence
  total_equity: number; // pence
  balanced: boolean;
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `\u00a3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function todayISO(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

// --- Component ---

export default function BalanceSheet() {
  const { toast } = useToast();
  const [asOfDate, setAsOfDate] = useState(todayISO());

  const { data, isLoading, isError, error } = useQuery<BalanceSheetData>({
    queryKey: ['/api/crm/accounting/reports/balance-sheet', asOfDate],
    queryFn: () =>
      apiRequest<BalanceSheetData>(
        `/api/crm/accounting/reports/balance-sheet?as_of_date=${asOfDate}`
      ),
  });

  function handlePrint() {
    window.print();
  }

  // --- Section Table ---

  function renderAccountTable(
    title: string,
    icon: React.ReactNode,
    accounts: AccountRow[],
    total: number,
    colorClass: string,
    bgClass: string,
    borderClass: string,
  ) {
    return (
      <div className="mb-6">
        <div className={`flex items-center gap-2 px-4 py-3 rounded-t-lg ${bgClass} ${borderClass} border border-b-0`}>
          {icon}
          <h3 className={`text-lg font-semibold ${colorClass}`}>{title}</h3>
          <span className={`ml-auto text-lg font-bold ${colorClass}`}>
            {formatCurrency(total)}
          </span>
        </div>
        <div className={`border ${borderClass} rounded-b-lg overflow-hidden`}>
          <Table>
            <TableHeader>
              <TableRow className={bgClass}>
                <TableHead className="w-[120px]">Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead className="text-right w-[160px]">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No accounts found
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {accounts.map((acct) => (
                    <TableRow key={acct.id}>
                      <TableCell className="font-mono text-sm">{acct.account_code}</TableCell>
                      <TableCell>{acct.account_name}</TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(acct.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className={`${bgClass} font-semibold`}>
                    <TableCell />
                    <TableCell className={colorClass}>Total {title}</TableCell>
                    <TableCell className={`text-right font-mono ${colorClass}`}>
                      {formatCurrency(total)}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  // --- Render ---

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 print:p-0 print:max-w-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
            Balance Sheet
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Statement of financial position
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="as-of-date" className="text-sm whitespace-nowrap">
              As of Date
            </Label>
            <Input
              id="as-of-date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-[170px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center mb-8">
        <h1 className="text-2xl font-bold">John Barclay Property Management</h1>
        <h2 className="text-xl mt-1">Balance Sheet</h2>
        <p className="text-sm text-muted-foreground mt-1">
          As of {new Date(asOfDate + 'T00:00:00').toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <span className="ml-3 text-muted-foreground">Loading balance sheet...</span>
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <span>Failed to load balance sheet: {(error as Error)?.message || 'Unknown error'}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Data */}
      {data && (
        <>
          {/* Balance Indicator */}
          <div className="flex items-center gap-3 print:mb-4">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              As of {new Date(asOfDate + 'T00:00:00').toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
            <div className="ml-auto">
              {data.balanced ? (
                <Badge className="bg-emerald-100 text-emerald-700 border-emerald-300 hover:bg-emerald-100">
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Balanced
                </Badge>
              ) : (
                <Badge className="bg-red-100 text-red-700 border-red-300 hover:bg-red-100">
                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                  Out of Balance
                </Badge>
              )}
            </div>
          </div>

          {/* Account Sections */}
          {renderAccountTable(
            'Assets',
            <Landmark className="h-5 w-5 text-blue-600" />,
            data.assets,
            data.total_assets,
            'text-blue-700',
            'bg-blue-50',
            'border-blue-200',
          )}

          {renderAccountTable(
            'Liabilities',
            <Wallet className="h-5 w-5 text-amber-600" />,
            data.liabilities,
            data.total_liabilities,
            'text-amber-700',
            'bg-amber-50',
            'border-amber-200',
          )}

          {renderAccountTable(
            'Equity',
            <TrendingUp className="h-5 w-5 text-emerald-600" />,
            data.equity,
            data.total_equity,
            'text-emerald-700',
            'bg-emerald-50',
            'border-emerald-200',
          )}

          {/* Accounting Equation */}
          <Card className="border-2" style={{ borderColor: '#791E75' }}>
            <CardContent className="pt-6 pb-6">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Total Assets
                  </span>
                  <span className="text-xl font-bold text-blue-700">
                    {formatCurrency(data.total_assets)}
                  </span>
                </div>
                <span className="text-2xl font-bold text-muted-foreground">=</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Total Liabilities
                  </span>
                  <span className="text-xl font-bold text-amber-700">
                    {formatCurrency(data.total_liabilities)}
                  </span>
                </div>
                <span className="text-2xl font-bold text-muted-foreground">+</span>
                <div className="flex flex-col items-center">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Total Equity
                  </span>
                  <span className="text-xl font-bold text-emerald-700">
                    {formatCurrency(data.total_equity)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-blue-500" />
                  Total Assets
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(data.total_assets)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.assets.length} account{data.assets.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card className="border-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-amber-500" />
                  Total Liabilities
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-700">
                  {formatCurrency(data.total_liabilities)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.liabilities.length} account{data.liabilities.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Total Equity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-700">
                  {formatCurrency(data.total_equity)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.equity.length} account{data.equity.length !== 1 ? 's' : ''}
                </p>
              </CardContent>
            </Card>

            <Card style={{ borderColor: '#791E75' }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Scale className="h-4 w-4" style={{ color: '#791E75' }} />
                  Net Worth
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold" style={{ color: '#791E75' }}>
                  {formatCurrency(data.total_assets - data.total_liabilities)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Assets minus Liabilities
                </p>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
