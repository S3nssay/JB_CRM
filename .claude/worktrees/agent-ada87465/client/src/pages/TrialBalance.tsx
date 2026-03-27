import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  CheckCircle, XCircle, Printer, Loader2, Scale, PoundSterling,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// --- Types ---

interface TrialBalanceAccount {
  id: number;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: 'debit' | 'credit';
  total_debits: number;
  total_credits: number;
  balance: number;
}

interface TrialBalanceTotals {
  debits: number;
  credits: number;
  balanced: boolean;
}

interface TrialBalanceResponse {
  accounts: TrialBalanceAccount[];
  totals: TrialBalanceTotals;
}

// --- Constants ---

const ACCOUNT_TYPE_ORDER: string[] = ['Assets', 'Liabilities', 'Equity', 'Revenue', 'Expenses'];

const ACCOUNT_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Assets: { bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200' },
  Liabilities: { bg: 'bg-red-50', text: 'text-red-800', border: 'border-red-200' },
  Equity: { bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200' },
  Revenue: { bg: 'bg-green-50', text: 'text-green-800', border: 'border-green-200' },
  Expenses: { bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200' },
};

// --- Helpers ---

function formatCurrency(pence: number): string {
  const pounds = Math.abs(pence) / 100;
  return `\u00A3${pounds.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

function todayISO(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function getDebitAmount(account: TrialBalanceAccount): number {
  if (account.normal_balance === 'debit') {
    return account.balance >= 0 ? account.balance : 0;
  }
  // Credit-normal account with a negative balance means it's actually a debit
  return account.balance < 0 ? Math.abs(account.balance) : 0;
}

function getCreditAmount(account: TrialBalanceAccount): number {
  if (account.normal_balance === 'credit') {
    return account.balance >= 0 ? account.balance : 0;
  }
  // Debit-normal account with a negative balance means it's actually a credit
  return account.balance < 0 ? Math.abs(account.balance) : 0;
}

// --- Component ---

export default function TrialBalance() {
  const { toast } = useToast();
  const [asOfDate, setAsOfDate] = useState<string>(todayISO());

  const { data, isLoading, isError, error } = useQuery<TrialBalanceResponse>({
    queryKey: ['/api/crm/accounting/trial-balance', asOfDate],
    queryFn: () => apiRequest<TrialBalanceResponse>(
      `/api/crm/accounting/trial-balance?as_of_date=${asOfDate}`
    ),
  });

  const accounts = data?.accounts ?? [];
  const totals = data?.totals ?? { debits: 0, credits: 0, balanced: true };

  // Group accounts by type
  const grouped: Record<string, TrialBalanceAccount[]> = {};
  for (const acct of accounts) {
    const type = acct.account_type;
    if (!grouped[type]) grouped[type] = [];
    grouped[type].push(acct);
  }

  // Order groups by the predefined order, then any remaining types
  const orderedTypes = [
    ...ACCOUNT_TYPE_ORDER.filter(t => grouped[t]),
    ...Object.keys(grouped).filter(t => !ACCOUNT_TYPE_ORDER.includes(t)),
  ];

  // Compute subtotals per group
  function groupSubtotals(accts: TrialBalanceAccount[]) {
    let debits = 0;
    let credits = 0;
    for (const a of accts) {
      debits += getDebitAmount(a);
      credits += getCreditAmount(a);
    }
    return { debits, credits };
  }

  const difference = Math.abs(totals.debits - totals.credits);

  function handlePrint() {
    window.print();
  }

  if (isError) {
    toast({
      title: 'Error loading trial balance',
      description: (error as Error)?.message || 'Failed to fetch trial balance data.',
      variant: 'destructive',
    });
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 print:p-2 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Scale className="h-7 w-7" style={{ color: '#791E75' }} />
            Trial Balance
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Double-entry accounting verification report
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="as-of-date" className="text-sm font-medium whitespace-nowrap">
              As of Date
            </Label>
            <Input
              id="as-of-date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
              className="w-44"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="flex items-center gap-2"
          >
            <Printer className="h-4 w-4" />
            Print / Export
          </Button>
        </div>
      </div>

      {/* Balance Status Indicator */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg border ${
        totals.balanced
          ? 'bg-green-50 border-green-200 text-green-800'
          : 'bg-red-50 border-red-200 text-red-800'
      }`}>
        {totals.balanced ? (
          <>
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="font-semibold">Balanced</span>
            <span className="text-sm ml-1">
              — Total debits equal total credits as of {formatDate(asOfDate)}
            </span>
          </>
        ) : (
          <>
            <XCircle className="h-5 w-5 text-red-600" />
            <span className="font-semibold">Out of Balance</span>
            <span className="text-sm ml-1">
              — Discrepancy of {formatCurrency(difference)} as of {formatDate(asOfDate)}
            </span>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 print:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <ArrowUpRight className="h-4 w-4 text-blue-600" />
              Total Debits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : formatCurrency(totals.debits)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <ArrowDownRight className="h-4 w-4 text-emerald-600" />
              Total Credits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">
              {isLoading ? '...' : formatCurrency(totals.credits)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500 flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-gray-500" />
              Difference
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${
              difference === 0 ? 'text-green-700' : 'text-red-700'
            }`}>
              {isLoading ? '...' : formatCurrency(difference)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trial Balance Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold">
            Account Balances
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              <span className="ml-3 text-gray-500">Loading trial balance...</span>
            </div>
          ) : accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <Scale className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-lg font-medium">No account data</p>
              <p className="text-sm">No transactions have been recorded for the selected date.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="w-[140px] font-semibold text-gray-700">
                      Account Code
                    </TableHead>
                    <TableHead className="font-semibold text-gray-700">
                      Account Name
                    </TableHead>
                    <TableHead className="text-right w-[180px] font-semibold text-gray-700">
                      Debit Balance
                    </TableHead>
                    <TableHead className="text-right w-[180px] font-semibold text-gray-700">
                      Credit Balance
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orderedTypes.map((type) => {
                    const groupAccounts = grouped[type];
                    const colors = ACCOUNT_TYPE_COLORS[type] || {
                      bg: 'bg-gray-50', text: 'text-gray-800', border: 'border-gray-200',
                    };
                    const sub = groupSubtotals(groupAccounts);

                    return (
                      <GroupSection
                        key={type}
                        type={type}
                        accounts={groupAccounts}
                        subtotals={sub}
                        colors={colors}
                      />
                    );
                  })}

                  {/* Grand Total Row */}
                  <TableRow className="border-t-2 border-gray-900">
                    <TableCell colSpan={2} className="font-bold text-gray-900 text-base py-3">
                      Grand Total
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900 text-base py-3 tabular-nums">
                      {formatCurrency(totals.debits)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-gray-900 text-base py-3 tabular-nums">
                      {formatCurrency(totals.credits)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Footer */}
      <div className="hidden print:block text-center text-xs text-gray-400 mt-6 border-t pt-3">
        Trial Balance as of {formatDate(asOfDate)} — Generated {new Date().toLocaleString('en-GB')}
      </div>
    </div>
  );
}

// --- Group Section Sub-Component ---

interface GroupSectionProps {
  type: string;
  accounts: TrialBalanceAccount[];
  subtotals: { debits: number; credits: number };
  colors: { bg: string; text: string; border: string };
}

function GroupSection({ type, accounts, subtotals, colors }: GroupSectionProps) {
  return (
    <>
      {/* Group Header Row */}
      <TableRow className={`${colors.bg} ${colors.border} border-l-4`}>
        <TableCell colSpan={4} className={`font-bold ${colors.text} py-2 text-sm uppercase tracking-wide`}>
          {type}
        </TableCell>
      </TableRow>

      {/* Account Rows */}
      {accounts.map((account) => {
        const debit = getDebitAmount(account);
        const credit = getCreditAmount(account);

        return (
          <TableRow key={account.id} className="hover:bg-gray-50 transition-colors">
            <TableCell className="font-mono text-sm text-gray-600 pl-6">
              {account.account_code}
            </TableCell>
            <TableCell className="text-gray-800">
              {account.account_name}
            </TableCell>
            <TableCell className="text-right tabular-nums text-gray-700">
              {debit > 0 ? formatCurrency(debit) : ''}
            </TableCell>
            <TableCell className="text-right tabular-nums text-gray-700">
              {credit > 0 ? formatCurrency(credit) : ''}
            </TableCell>
          </TableRow>
        );
      })}

      {/* Subtotal Row */}
      <TableRow className="border-b-2 border-gray-200">
        <TableCell />
        <TableCell className={`text-right text-sm font-semibold ${colors.text} italic`}>
          Subtotal — {type}
        </TableCell>
        <TableCell className={`text-right font-semibold tabular-nums ${colors.text}`}>
          {subtotals.debits > 0 ? formatCurrency(subtotals.debits) : ''}
        </TableCell>
        <TableCell className={`text-right font-semibold tabular-nums ${colors.text}`}>
          {subtotals.credits > 0 ? formatCurrency(subtotals.credits) : ''}
        </TableCell>
      </TableRow>
    </>
  );
}
