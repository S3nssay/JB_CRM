import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ChevronDown, ChevronRight, FileText, CalendarClock, CheckCircle2,
  PoundSterling, Loader2, AlertCircle, Calculator,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

interface VATReturn {
  id: number;
  period_start: string;
  period_end: string;
  box1_vat_due_sales: number;
  box2_vat_due_acquisitions: number;
  box3_total_vat_due: number;
  box4_vat_reclaimed_input: number;
  box5_net_vat_due: number;
  box6_total_sales_ex_vat: number;
  box7_total_purchases_ex_vat: number;
  box8_total_supplies_ex_vat: number;
  box9_total_acquisitions_ex_vat: number;
  status: 'draft' | 'calculated' | 'submitted' | 'paid';
  submitted_at: string | null;
  notes: string | null;
}

const formatCurrency = (pence: number): string => {
  const pounds = pence / 100;
  return `\u00A3${pounds.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatPeriod = (start: string, end: string): string => {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })} - ${e.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}`;
};

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: {
    label: 'Draft',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  },
  calculated: {
    label: 'Calculated',
    className: 'bg-purple-100 text-purple-800 border-purple-300',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-blue-100 text-blue-800 border-blue-300',
  },
  paid: {
    label: 'Paid',
    className: 'bg-green-100 text-green-800 border-green-300',
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.draft;
  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  );
}

function BoxRow({ boxNumber, label, value }: { boxNumber: number; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-2 px-4 border-b last:border-b-0">
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold bg-gray-100 text-gray-600 rounded px-2 py-0.5 min-w-[48px] text-center">
          Box {boxNumber}
        </span>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className="text-sm font-medium text-gray-900 tabular-nums">
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function ExpandedReturn({ vatReturn }: { vatReturn: VATReturn }) {
  return (
    <TableRow>
      <TableCell colSpan={6} className="p-0">
        <div className="bg-gray-50 border-t border-b mx-4 my-2 rounded-lg overflow-hidden">
          <div className="bg-white rounded-lg border">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-900">
                VAT Return - 9 Box Format
              </h4>
              <p className="text-xs text-gray-500 mt-0.5">
                Period: {formatPeriod(vatReturn.period_start, vatReturn.period_end)}
              </p>
            </div>

            <div className="divide-y">
              <div className="px-4 py-2 bg-[#791E75]/5">
                <p className="text-xs font-semibold text-[#791E75] uppercase tracking-wide">
                  VAT Due
                </p>
              </div>
              <BoxRow boxNumber={1} label="VAT due in the period on sales and other outputs" value={vatReturn.box1_vat_due_sales} />
              <BoxRow boxNumber={2} label="VAT due in the period on acquisitions of goods from other EC Member States" value={vatReturn.box2_vat_due_acquisitions} />
              <BoxRow boxNumber={3} label="Total VAT due (sum of Box 1 and Box 2)" value={vatReturn.box3_total_vat_due} />

              <div className="px-4 py-2 bg-[#791E75]/5">
                <p className="text-xs font-semibold text-[#791E75] uppercase tracking-wide">
                  VAT Reclaimed
                </p>
              </div>
              <BoxRow boxNumber={4} label="VAT reclaimed in the period on purchases and other inputs" value={vatReturn.box4_vat_reclaimed_input} />
              <BoxRow boxNumber={5} label="Net VAT to be paid to HMRC or reclaimed (Box 3 minus Box 4)" value={vatReturn.box5_net_vat_due} />

              <div className="px-4 py-2 bg-[#791E75]/5">
                <p className="text-xs font-semibold text-[#791E75] uppercase tracking-wide">
                  Totals (excluding VAT)
                </p>
              </div>
              <BoxRow boxNumber={6} label="Total value of sales and all other outputs excluding any VAT" value={vatReturn.box6_total_sales_ex_vat} />
              <BoxRow boxNumber={7} label="Total value of purchases and all other inputs excluding any VAT" value={vatReturn.box7_total_purchases_ex_vat} />
              <BoxRow boxNumber={8} label="Total value of dispatches of goods and related costs (excluding any VAT) to EC Member States" value={vatReturn.box8_total_supplies_ex_vat} />
              <BoxRow boxNumber={9} label="Total value of acquisitions of goods and related costs (excluding any VAT) from EC Member States" value={vatReturn.box9_total_acquisitions_ex_vat} />
            </div>

            {vatReturn.notes && (
              <div className="px-4 py-3 border-t bg-gray-50">
                <p className="text-xs text-gray-500 font-medium mb-1">Notes</p>
                <p className="text-sm text-gray-700">{vatReturn.notes}</p>
              </div>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function VATReturns() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [calculatingId, setCalculatingId] = useState<number | null>(null);

  const { data: vatReturns = [], isLoading, error } = useQuery<VATReturn[]>({
    queryKey: ['/api/crm/accounting/vat-returns'],
  });

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleAutoCalculate = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCalculatingId(id);
    try {
      await apiRequest('POST', `/api/crm/accounting/vat-returns/${id}/calculate`);
      toast({ title: 'VAT return calculated', description: 'Boxes 1-9 have been auto-calculated from posted journal entries.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/vat-returns'] });
    } catch (err) {
      toast({ title: 'Calculation failed', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setCalculatingId(null);
    }
  };

  // Calculate summary values
  const now = new Date();
  const currentYear = now.getFullYear();
  const yearStart = new Date(currentYear, 3, 1); // UK tax year starts April
  const prevYearStart = new Date(currentYear - 1, 3, 1);
  const taxYearStart = now >= yearStart ? yearStart : prevYearStart;

  const sortedReturns = [...vatReturns].sort(
    (a, b) => new Date(b.period_end).getTime() - new Date(a.period_end).getTime()
  );

  const lastSubmitted = sortedReturns.find((r) => r.status === 'submitted' || r.status === 'paid');

  const nextDraft = sortedReturns.find((r) => r.status === 'draft');

  const ytdPaid = vatReturns
    .filter((r) => {
      if (r.status !== 'paid') return false;
      const periodEnd = new Date(r.period_end);
      return periodEnd >= taxYearStart;
    })
    .reduce((sum, r) => sum + r.box5_net_vat_due, 0);

  // Determine next return due date (quarter after last period end)
  const getNextReturnDue = (): string => {
    if (nextDraft) {
      const deadline = new Date(nextDraft.period_end);
      deadline.setMonth(deadline.getMonth() + 1);
      deadline.setDate(7); // MTD deadline is typically 1 month + 7 days after period end
      return formatDate(deadline.toISOString());
    }
    if (sortedReturns.length > 0) {
      const lastEnd = new Date(sortedReturns[0].period_end);
      const nextEnd = new Date(lastEnd);
      nextEnd.setMonth(nextEnd.getMonth() + 3);
      const deadline = new Date(nextEnd);
      deadline.setMonth(deadline.getMonth() + 1);
      deadline.setDate(7);
      return formatDate(deadline.toISOString());
    }
    return '-';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-gray-600">Failed to load VAT returns.</p>
        <p className="text-sm text-gray-400">{(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">VAT Returns</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage quarterly VAT returns and HMRC submissions
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Next Return Due
            </CardTitle>
            <CalendarClock className="h-4 w-4 text-[#791E75]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-gray-900">
              {getNextReturnDue()}
            </div>
            {nextDraft && (
              <p className="text-xs text-gray-500 mt-1">
                {formatPeriod(nextDraft.period_start, nextDraft.period_end)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              Last Submitted
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-[#791E75]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-gray-900">
              {lastSubmitted ? formatDate(lastSubmitted.submitted_at) : '-'}
            </div>
            {lastSubmitted && (
              <p className="text-xs text-gray-500 mt-1">
                {formatPeriod(lastSubmitted.period_start, lastSubmitted.period_end)}
                {' '}&middot;{' '}
                {formatCurrency(lastSubmitted.box5_net_vat_due)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">
              YTD VAT Paid
            </CardTitle>
            <PoundSterling className="h-4 w-4 text-[#791E75]" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-gray-900">
              {formatCurrency(ytdPaid)}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Tax year from {formatDate(taxYearStart.toISOString())}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* VAT Returns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-[#791E75]" />
            VAT Return History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sortedReturns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4">
              <FileText className="h-12 w-12 text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No VAT returns found</p>
              <p className="text-sm text-gray-400 mt-1">
                VAT returns will appear here once created.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Period</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Net VAT Due (Box 5)</TableHead>
                  <TableHead>Date Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedReturns.map((vr) => (
                  <>
                    <TableRow
                      key={vr.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => toggleExpand(vr.id)}
                    >
                      <TableCell className="w-10 px-3">
                        <Button variant="ghost" size="icon" className="h-6 w-6">
                          {expandedId === vr.id ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPeriod(vr.period_start, vr.period_end)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={vr.status} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(vr.box5_net_vat_due)}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {formatDate(vr.submitted_at)}
                      </TableCell>
                      <TableCell className="text-right">
                        {(vr.status === 'draft' || vr.status === 'calculated') && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={calculatingId === vr.id}
                            onClick={(e) => handleAutoCalculate(vr.id, e)}
                          >
                            {calculatingId === vr.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Calculator className="h-3 w-3" />
                            )}
                            {calculatingId === vr.id ? 'Calculating...' : 'Auto-Calculate'}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                    {expandedId === vr.id && (
                      <ExpandedReturn key={`expanded-${vr.id}`} vatReturn={vr} />
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
