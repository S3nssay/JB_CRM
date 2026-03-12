import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  PoundSterling, Printer, Loader2, AlertTriangle, Clock, CalendarDays,
  TrendingUp, Building2, FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// --- Types ---

interface CreditorEntry {
  id: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  supplier_name: string;
  supplier_type: string;
  total_amount: number;
  amount_paid: number;
  outstanding: number;
  days_overdue: number;
}

interface AgedCreditorsData {
  current: CreditorEntry[];
  days_1_30: CreditorEntry[];
  days_31_60: CreditorEntry[];
  days_61_90: CreditorEntry[];
  over_90: CreditorEntry[];
  total_outstanding: number;
}

// --- Helpers ---

function formatPence(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pounds);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const BRAND = '#791E75';

const AGING_BANDS = [
  { key: 'current', label: 'Current', color: '#16a34a', bgColor: '#f0fdf4', borderColor: '#bbf7d0' },
  { key: 'days_1_30', label: '1-30 Days', color: '#ca8a04', bgColor: '#fefce8', borderColor: '#fef08a' },
  { key: 'days_31_60', label: '31-60 Days', color: '#ea580c', bgColor: '#fff7ed', borderColor: '#fed7aa' },
  { key: 'days_61_90', label: '61-90 Days', color: '#dc2626', bgColor: '#fef2f2', borderColor: '#fecaca' },
  { key: 'over_90', label: '90+ Days', color: '#991b1b', bgColor: '#fef2f2', borderColor: '#fca5a5' },
] as const;

// --- Component ---

export default function AgedCreditors() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>('current');

  const { data, isLoading, error } = useQuery<AgedCreditorsData>({
    queryKey: ['/api/crm/accounting/reports/aged-creditors'],
  });

  const handlePrint = () => {
    window.print();
  };

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
        <p className="text-destructive font-medium">Failed to load aged creditors report</p>
        <p className="text-sm text-muted-foreground">{(error as Error).message}</p>
      </div>
    );
  }

  if (!data) return null;

  const bandTotals = AGING_BANDS.map((band) => {
    const entries = data[band.key as keyof AgedCreditorsData] as CreditorEntry[];
    const total = entries.reduce((sum, e) => sum + e.outstanding, 0);
    return { ...band, total, count: entries.length };
  });

  const grandTotal = data.total_outstanding;
  const maxBandTotal = Math.max(...bandTotals.map((b) => b.total), 1);

  return (
    <div className="space-y-6 p-6 print:p-0">
      {/* Header */}
      <div className="flex items-center justify-between print:mb-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRAND }}>
            Aged Creditors Report
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Outstanding amounts you owe to suppliers, broken down by aging period
          </p>
        </div>
        <Button onClick={handlePrint} variant="outline" className="print:hidden gap-2">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-2" style={{ borderColor: BRAND }}>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Outstanding
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-xl font-bold" style={{ color: BRAND }}>
              {formatPence(grandTotal)}
            </div>
          </CardContent>
        </Card>
        {bandTotals.map((band) => (
          <Card key={band.key} style={{ borderColor: band.borderColor, borderWidth: '1px' }}>
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {band.label}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="text-lg font-bold" style={{ color: band.color }}>
                {formatPence(band.total)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {band.count} invoice{band.count !== 1 ? 's' : ''}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Aging Distribution Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Aging Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {bandTotals.map((band) => {
              const pct = grandTotal > 0 ? (band.total / grandTotal) * 100 : 0;
              return (
                <div key={band.key} className="flex items-center gap-3">
                  <div className="w-24 text-xs font-medium text-right shrink-0" style={{ color: band.color }}>
                    {band.label}
                  </div>
                  <div className="flex-1 h-7 bg-muted rounded-md overflow-hidden relative">
                    <div
                      className="h-full rounded-md transition-all duration-500"
                      style={{
                        width: `${grandTotal > 0 ? (band.total / maxBandTotal) * 100 : 0}%`,
                        backgroundColor: band.color,
                        minWidth: band.total > 0 ? '2px' : '0px',
                      }}
                    />
                    {band.total > 0 && (
                      <span className="absolute inset-y-0 flex items-center text-xs font-medium px-2"
                        style={{
                          left: grandTotal > 0 ? `${Math.min((band.total / maxBandTotal) * 100, 85)}%` : '0%',
                          color: band.color,
                        }}
                      >
                        {formatPence(band.total)} ({pct.toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Invoice Tables */}
      <Card>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Invoices by Aging Period
              </CardTitle>
            </div>
            <TabsList className="mt-3 print:hidden">
              {AGING_BANDS.map((band) => {
                const entries = data[band.key as keyof AgedCreditorsData] as CreditorEntry[];
                return (
                  <TabsTrigger
                    key={band.key}
                    value={band.key}
                    className="text-xs gap-1.5 data-[state=active]:shadow-sm"
                    style={activeTab === band.key ? { color: band.color, borderBottomColor: band.color } : {}}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: band.color }}
                    />
                    {band.label}
                    {entries.length > 0 && (
                      <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 h-4">
                        {entries.length}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </CardHeader>
          <CardContent className="pt-4">
            {AGING_BANDS.map((band) => {
              const entries = data[band.key as keyof AgedCreditorsData] as CreditorEntry[];
              return (
                <TabsContent key={band.key} value={band.key} className="mt-0">
                  {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm">No invoices in this aging period</p>
                    </div>
                  ) : (
                    <div className="border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs">
                            <TableHead className="font-semibold">Invoice #</TableHead>
                            <TableHead className="font-semibold">Date</TableHead>
                            <TableHead className="font-semibold">Due Date</TableHead>
                            <TableHead className="font-semibold">Supplier</TableHead>
                            <TableHead className="font-semibold">Type</TableHead>
                            <TableHead className="font-semibold text-right">Total</TableHead>
                            <TableHead className="font-semibold text-right">Paid</TableHead>
                            <TableHead className="font-semibold text-right">Outstanding</TableHead>
                            <TableHead className="font-semibold text-right">Days Overdue</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {entries.map((entry) => (
                            <TableRow key={entry.id} className="text-sm">
                              <TableCell className="font-mono text-xs">{entry.invoice_number}</TableCell>
                              <TableCell className="text-xs">{formatDate(entry.invoice_date)}</TableCell>
                              <TableCell className="text-xs">{formatDate(entry.due_date)}</TableCell>
                              <TableCell className="font-medium">{entry.supplier_name}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-[10px]">
                                  {entry.supplier_type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs">
                                {formatPence(entry.total_amount)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                                {formatPence(entry.amount_paid)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold" style={{ color: band.color }}>
                                {formatPence(entry.outstanding)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] font-mono"
                                  style={{
                                    backgroundColor: band.bgColor,
                                    color: band.color,
                                    borderColor: band.borderColor,
                                    borderWidth: '1px',
                                  }}
                                >
                                  {entry.days_overdue} days
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      {/* Section total */}
                      <div
                        className="flex items-center justify-between px-4 py-3 border-t text-sm font-semibold"
                        style={{ backgroundColor: band.bgColor }}
                      >
                        <span style={{ color: band.color }}>
                          {band.label} Total ({entries.length} invoice{entries.length !== 1 ? 's' : ''})
                        </span>
                        <span style={{ color: band.color }}>
                          {formatPence(entries.reduce((sum, e) => sum + e.outstanding, 0))}
                        </span>
                      </div>
                    </div>
                  )}
                </TabsContent>
              );
            })}
          </CardContent>
        </Tabs>
      </Card>

      {/* Print-only: all sections expanded */}
      <div className="hidden print:block space-y-6">
        {AGING_BANDS.map((band) => {
          const entries = data[band.key as keyof AgedCreditorsData] as CreditorEntry[];
          if (entries.length === 0) return null;
          return (
            <div key={band.key}>
              <h3 className="text-sm font-bold mb-2" style={{ color: band.color }}>
                {band.label} ({entries.length} invoice{entries.length !== 1 ? 's' : ''})
              </h3>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1 pr-2">Invoice #</th>
                    <th className="text-left py-1 pr-2">Date</th>
                    <th className="text-left py-1 pr-2">Due Date</th>
                    <th className="text-left py-1 pr-2">Supplier</th>
                    <th className="text-right py-1 pr-2">Total</th>
                    <th className="text-right py-1 pr-2">Paid</th>
                    <th className="text-right py-1 pr-2">Outstanding</th>
                    <th className="text-right py-1">Days</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b border-gray-100">
                      <td className="py-1 pr-2 font-mono">{entry.invoice_number}</td>
                      <td className="py-1 pr-2">{formatDate(entry.invoice_date)}</td>
                      <td className="py-1 pr-2">{formatDate(entry.due_date)}</td>
                      <td className="py-1 pr-2">{entry.supplier_name}</td>
                      <td className="py-1 pr-2 text-right font-mono">{formatPence(entry.total_amount)}</td>
                      <td className="py-1 pr-2 text-right font-mono">{formatPence(entry.amount_paid)}</td>
                      <td className="py-1 pr-2 text-right font-mono font-semibold">{formatPence(entry.outstanding)}</td>
                      <td className="py-1 text-right">{entry.days_overdue}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 font-semibold">
                    <td colSpan={6} className="py-1 pr-2">{band.label} Total</td>
                    <td className="py-1 pr-2 text-right font-mono">
                      {formatPence(entries.reduce((sum, e) => sum + e.outstanding, 0))}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })}
        <div className="border-t-2 pt-2 flex justify-between font-bold text-sm">
          <span>Grand Total Outstanding</span>
          <span>{formatPence(grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
