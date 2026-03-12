import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Receipt, Printer, TrendingUp, TrendingDown, Scale } from 'lucide-react';

interface TaxRateSummary {
  tax_rate_name: string;
  tax_rate: string;
  output_vat: number;
  input_vat: number;
}

interface TaxReportData {
  rates: TaxRateSummary[];
  total_output_vat: number;
  total_input_vat: number;
  net_vat_due: number;
}

function formatAmount(pence: number): string {
  const pounds = (pence || 0) / 100;
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pounds);
}

export default function TaxReports() {
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), today.getMonth() >= 3 ? 3 : -9, 1);
  const [fromDate, setFromDate] = useState(yearStart.toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(today.toISOString().split('T')[0]);

  const queryStr = `/api/crm/accounting/reports/tax?from_date=${fromDate}&to_date=${toDate}`;
  const { data, isLoading } = useQuery<TaxReportData>({ queryKey: [queryStr] });

  const setPreset = (preset: string) => {
    const now = new Date();
    let start: Date, end: Date;
    switch (preset) {
      case 'thisMonth':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'thisQuarter': {
        const qm = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), qm, 1);
        end = now;
        break;
      }
      case 'thisYear':
        start = new Date(now.getFullYear(), now.getMonth() >= 3 ? 3 : -9, 1);
        end = now;
        break;
      case 'lastYear': {
        const ly = now.getMonth() >= 3 ? now.getFullYear() - 1 : now.getFullYear() - 2;
        start = new Date(ly, 3, 1);
        end = new Date(ly + 1, 2, 31);
        break;
      }
      default:
        return;
    }
    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tax Summary Report</h1>
          <p className="text-sm text-gray-500 mt-1">VAT analysis by tax rate</p>
        </div>
        <Button variant="outline" onClick={() => window.print()} className="gap-2">
          <Printer className="h-4 w-4" /> Print
        </Button>
      </div>

      {/* Date Range */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <Label className="text-xs text-gray-500">From</Label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-40" />
            </div>
            <div>
              <Label className="text-xs text-gray-500">To</Label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-40" />
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPreset('thisMonth')}>This Month</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('thisQuarter')}>This Quarter</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('thisYear')}>This Year</Button>
              <Button variant="outline" size="sm" onClick={() => setPreset('lastYear')}>Last Year</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Output VAT (Sales)</p>
                  <p className="text-xl font-bold text-gray-900">{formatAmount(data.total_output_vat)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <TrendingDown className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Input VAT (Purchases)</p>
                  <p className="text-xl font-bold text-gray-900">{formatAmount(data.total_input_vat)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-50">
                  <Scale className="h-5 w-5" style={{ color: '#791E75' }} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Net VAT Due</p>
                  <p className={`text-xl font-bold ${data.net_vat_due >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatAmount(Math.abs(data.net_vat_due))}
                    <span className="text-xs font-normal ml-1">{data.net_vat_due >= 0 ? 'payable' : 'reclaimable'}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tax Breakdown Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5" style={{ color: '#791E75' }} />
            VAT Breakdown by Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading tax data...</div>
          ) : !data || data.rates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No VAT transactions found for this period</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tax Rate</TableHead>
                  <TableHead>Rate %</TableHead>
                  <TableHead className="text-right">Output VAT (£)</TableHead>
                  <TableHead className="text-right">Input VAT (£)</TableHead>
                  <TableHead className="text-right">Net (£)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rates.map((rate, i) => {
                  const net = parseInt(String(rate.output_vat)) - parseInt(String(rate.input_vat));
                  return (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{rate.tax_rate_name || 'Unknown'}</TableCell>
                      <TableCell>{rate.tax_rate}%</TableCell>
                      <TableCell className="text-right">{formatAmount(parseInt(String(rate.output_vat)))}</TableCell>
                      <TableCell className="text-right">{formatAmount(parseInt(String(rate.input_vat)))}</TableCell>
                      <TableCell className={`text-right font-medium ${net >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatAmount(Math.abs(net))}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Totals Row */}
                <TableRow className="border-t-2 font-bold bg-gray-50">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right">{formatAmount(data.total_output_vat)}</TableCell>
                  <TableCell className="text-right">{formatAmount(data.total_input_vat)}</TableCell>
                  <TableCell className={`text-right ${data.net_vat_due >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatAmount(Math.abs(data.net_vat_due))}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
