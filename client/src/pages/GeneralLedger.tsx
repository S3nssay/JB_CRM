import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  BookOpen, ChevronsUpDown, Check, Filter, Loader2,
  TrendingUp, TrendingDown, Scale, FileSpreadsheet,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface ChartAccount {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface LedgerEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  entry_description: string;
  status: string;
  account_code: string;
  account_name: string;
  account_type: string;
  normal_balance: string;
  description: string;
  debit_amount: number;
  credit_amount: number;
  property_id: number | null;
  landlord_id: number | null;
  tenant_id: number | null;
}

interface MonthGroup {
  label: string;
  sortKey: string;
  entries: LedgerEntry[];
  totalDebits: number;
  totalCredits: number;
  startIndex: number;
}

const BRAND_COLOR = '#791E75';

function formatPence(pence: number): string {
  const pounds = Math.abs(pence) / 100;
  const formatted = new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pounds);
  return `\u00A3${formatted}`;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function getMonthLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  } catch {
    return 'Unknown';
  }
}

function getMonthSortKey(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  } catch {
    return '0000-00';
  }
}

export default function GeneralLedger() {
  const { toast } = useToast();

  const [accountOpen, setAccountOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const [appliedAccountId, setAppliedAccountId] = useState<number | null>(null);
  const [appliedFromDate, setAppliedFromDate] = useState('');
  const [appliedToDate, setAppliedToDate] = useState('');

  const { data: accounts = [] } = useQuery<ChartAccount[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts'],
    queryFn: () => apiRequest<ChartAccount[]>('/api/crm/accounting/chart-of-accounts'),
  });

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === appliedAccountId) || null,
    [accounts, appliedAccountId],
  );

  const queryParams = useMemo(() => {
    if (!appliedAccountId) return null;
    const params = new URLSearchParams();
    params.set('account_id', String(appliedAccountId));
    if (appliedFromDate) params.set('from_date', appliedFromDate);
    if (appliedToDate) params.set('to_date', appliedToDate);
    return params.toString();
  }, [appliedAccountId, appliedFromDate, appliedToDate]);

  const {
    data: entries = [],
    isLoading: entriesLoading,
    isError,
  } = useQuery<LedgerEntry[]>({
    queryKey: ['/api/crm/accounting/general-ledger', queryParams],
    queryFn: () =>
      apiRequest<LedgerEntry[]>(`/api/crm/accounting/general-ledger?${queryParams}`),
    enabled: !!queryParams,
  });

  const sortedEntries = useMemo(
    () =>
      [...entries].sort(
        (a, b) => new Date(a.entry_date).getTime() - new Date(b.entry_date).getTime(),
      ),
    [entries],
  );

  const totalDebits = useMemo(
    () => sortedEntries.reduce((sum, e) => sum + (e.debit_amount || 0), 0),
    [sortedEntries],
  );

  const totalCredits = useMemo(
    () => sortedEntries.reduce((sum, e) => sum + (e.credit_amount || 0), 0),
    [sortedEntries],
  );

  const netBalance = useMemo(() => {
    if (!selectedAccount) return totalDebits - totalCredits;
    return selectedAccount.type === 'asset' || selectedAccount.type === 'expense'
      ? totalDebits - totalCredits
      : totalCredits - totalDebits;
  }, [totalDebits, totalCredits, selectedAccount]);

  const runningBalances = useMemo(() => {
    const balances: number[] = [];
    let running = 0;
    const normalBalance = sortedEntries.length > 0 ? sortedEntries[0].normal_balance : 'debit';
    for (const entry of sortedEntries) {
      if (normalBalance === 'debit') {
        running += (entry.debit_amount || 0) - (entry.credit_amount || 0);
      } else {
        running += (entry.credit_amount || 0) - (entry.debit_amount || 0);
      }
      balances.push(running);
    }
    return balances;
  }, [sortedEntries]);

  const monthGroups = useMemo(() => {
    const groupMap = new Map<string, MonthGroup>();
    let currentIndex = 0;
    for (const entry of sortedEntries) {
      const label = getMonthLabel(entry.entry_date);
      const sortKey = getMonthSortKey(entry.entry_date);
      if (!groupMap.has(label)) {
        groupMap.set(label, {
          label,
          sortKey,
          entries: [],
          totalDebits: 0,
          totalCredits: 0,
          startIndex: currentIndex,
        });
      }
      const group = groupMap.get(label)!;
      group.entries.push(entry);
      group.totalDebits += entry.debit_amount || 0;
      group.totalCredits += entry.credit_amount || 0;
      currentIndex++;
    }
    return Array.from(groupMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [sortedEntries]);

  function handleApplyFilters() {
    if (!selectedAccountId) {
      toast({
        title: 'No account selected',
        description: 'Please select an account to view its ledger.',
        variant: 'destructive',
      });
      return;
    }
    setAppliedAccountId(selectedAccountId);
    setAppliedFromDate(fromDate);
    setAppliedToDate(toDate);
  }

  const displayAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: BRAND_COLOR }}
        >
          <BookOpen className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">General Ledger</h1>
          <p className="text-sm text-muted-foreground">
            View account transaction history and running balances
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-end gap-4">
            {/* Account Selector */}
            <div className="flex-1 min-w-[280px]">
              <Label className="mb-2 block text-sm font-medium">Account</Label>
              <Popover open={accountOpen} onOpenChange={setAccountOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={accountOpen}
                    className="w-full justify-between font-normal"
                  >
                    {displayAccount
                      ? `${displayAccount.code} - ${displayAccount.name}`
                      : 'Select account...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search by code or name..." />
                    <CommandList>
                      <CommandEmpty>No accounts found.</CommandEmpty>
                      <CommandGroup>
                        {accounts.map((account) => (
                          <CommandItem
                            key={account.id}
                            value={`${account.code} ${account.name}`}
                            onSelect={() => {
                              setSelectedAccountId(account.id);
                              setAccountOpen(false);
                            }}
                          >
                            <Check
                              className={cn(
                                'mr-2 h-4 w-4',
                                selectedAccountId === account.id
                                  ? 'opacity-100'
                                  : 'opacity-0',
                              )}
                            />
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {account.code} - {account.name}
                              </span>
                              <span className="text-xs text-muted-foreground capitalize">
                                {account.type}
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* From Date */}
            <div className="min-w-[160px]">
              <Label className="mb-2 block text-sm font-medium">From Date</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            {/* To Date */}
            <div className="min-w-[160px]">
              <Label className="mb-2 block text-sm font-medium">To Date</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            {/* Apply Button */}
            <Button
              onClick={handleApplyFilters}
              style={{ backgroundColor: BRAND_COLOR }}
              className="hover:opacity-90"
            >
              <Filter className="mr-2 h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* No account selected message */}
      {!appliedAccountId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <FileSpreadsheet className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">
              Select an account to view its ledger
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Choose an account from the dropdown above and click Apply Filters
            </p>
          </CardContent>
        </Card>
      )}

      {/* Content when account is selected */}
      {appliedAccountId && (
        <>
          {/* Account Header */}
          {selectedAccount && (
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold" style={{ color: BRAND_COLOR }}>
                {selectedAccount.code} - {selectedAccount.name}
              </h2>
              <span className="text-sm text-muted-foreground capitalize">
                ({selectedAccount.type} account)
              </span>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Debits
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {formatPence(totalDebits)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Credits
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatPence(totalCredits)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Balance
                </CardTitle>
                <Scale className="h-4 w-4" style={{ color: BRAND_COLOR }} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: BRAND_COLOR }}>
                  {netBalance < 0 ? '-' : ''}
                  {formatPence(Math.abs(netBalance))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Loading State */}
          {entriesLoading && (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="ml-3 text-muted-foreground">Loading ledger entries...</span>
              </CardContent>
            </Card>
          )}

          {/* Error State */}
          {isError && !entriesLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <p className="text-destructive font-medium">
                  Failed to load ledger entries. Please try again.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {!entriesLoading && !isError && sortedEntries.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground font-medium">
                  No entries found for the selected account and date range.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Main Ledger Table */}
          {!entriesLoading && !isError && sortedEntries.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[110px]">Date</TableHead>
                        <TableHead className="w-[100px]">Entry #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right w-[130px]">Debit (&pound;)</TableHead>
                        <TableHead className="text-right w-[130px]">Credit (&pound;)</TableHead>
                        <TableHead className="text-right w-[140px]">Running Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {monthGroups.map((group) => (
                        <MonthGroupRows
                          key={group.sortKey}
                          group={group}
                          runningBalances={runningBalances}
                        />
                      ))}

                      {/* Grand Total Footer Row */}
                      <TableRow
                        className="border-t-2 font-bold"
                        style={{ backgroundColor: `${BRAND_COLOR}10` }}
                      >
                        <TableCell colSpan={3} className="font-bold" style={{ color: BRAND_COLOR }}>
                          Grand Total
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {totalDebits > 0 ? formatPence(totalDebits) : ''}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {totalCredits > 0 ? formatPence(totalCredits) : ''}
                        </TableCell>
                        <TableCell className="text-right font-bold" style={{ color: BRAND_COLOR }}>
                          {netBalance < 0 ? '-' : ''}
                          {formatPence(Math.abs(netBalance))}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function MonthGroupRows({
  group,
  runningBalances,
}: {
  group: MonthGroup;
  runningBalances: number[];
}) {
  return (
    <>
      {/* Month Header Row */}
      <TableRow className="bg-muted/60 hover:bg-muted/60">
        <TableCell
          colSpan={6}
          className="font-semibold text-sm py-2"
          style={{ color: BRAND_COLOR }}
        >
          {group.label}
        </TableCell>
      </TableRow>

      {/* Entry Rows */}
      {group.entries.map((entry, idx) => {
        const globalIdx = group.startIndex + idx;
        const isEvenRow = idx % 2 === 0;
        const balance = runningBalances[globalIdx] ?? 0;

        return (
          <TableRow
            key={`${entry.id}-${globalIdx}`}
            className={cn(isEvenRow ? 'bg-background' : 'bg-muted/20')}
          >
            <TableCell className="text-sm">{formatDate(entry.entry_date)}</TableCell>
            <TableCell className="text-sm font-mono">{entry.entry_number}</TableCell>
            <TableCell className="text-sm">
              {entry.description || entry.entry_description}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {entry.debit_amount > 0 ? formatPence(entry.debit_amount) : ''}
            </TableCell>
            <TableCell className="text-right text-sm tabular-nums">
              {entry.credit_amount > 0 ? formatPence(entry.credit_amount) : ''}
            </TableCell>
            <TableCell className="text-right text-sm font-medium tabular-nums">
              {balance < 0 ? '-' : ''}
              {formatPence(Math.abs(balance))}
            </TableCell>
          </TableRow>
        );
      })}

      {/* Month Subtotal Row */}
      <TableRow className="border-t bg-muted/40 hover:bg-muted/40">
        <TableCell colSpan={3} className="text-sm font-semibold text-muted-foreground">
          Subtotal - {group.label}
        </TableCell>
        <TableCell className="text-right text-sm font-semibold">
          {group.totalDebits > 0 ? formatPence(group.totalDebits) : ''}
        </TableCell>
        <TableCell className="text-right text-sm font-semibold">
          {group.totalCredits > 0 ? formatPence(group.totalCredits) : ''}
        </TableCell>
        <TableCell />
      </TableRow>
    </>
  );
}
