import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileSpreadsheet, ChevronDown, ChevronRight, Download, Search } from 'lucide-react';

const formatPence = (pence: number | null | undefined) => {
  if (pence === null || pence === undefined) return '£0.00';
  return `£${(Number(pence) / 100).toFixed(2)}`;
};

interface PropertyRow {
  propertyId: number;
  address: string;
  rentCollected: number;
}

interface LandlordReportRow {
  landlordId: number;
  landlordName: string;
  landlordAddress: string;
  overseasCountry: string;
  taxExemptionCertNo: string | null;
  taxExemptionStart: string | null;
  taxExemptionEnd: string | null;
  properties: PropertyRow[];
  totalRent: number;
  taxRate: number;
  taxDeducted: number;
  netPaid: number;
}

interface ReportData {
  from: string;
  to: string;
  report: LandlordReportRow[];
}

// Default period: 6 April previous year to 5 April this year
const defaultPeriod = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-indexed
  const taxYearStart = month >= 4 ? year : year - 1;
  return {
    from: `${taxYearStart}-04-06`,
    to: `${taxYearStart + 1}-04-05`,
  };
};

export default function HMRCRentReport() {
  const { toast } = useToast();
  const { from: defaultFrom, to: defaultTo } = defaultPeriod();
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [queryFrom, setQueryFrom] = useState(defaultFrom);
  const [queryTo, setQueryTo] = useState(defaultTo);
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching } = useQuery<ReportData>({
    queryKey: ['/api/crm/hmrc-rent-report', queryFrom, queryTo],
    queryFn: () => apiRequest('GET', `/api/crm/hmrc-rent-report?from=${queryFrom}&to=${queryTo}`).then(r => r.json()),
    enabled: !!queryFrom && !!queryTo,
  });

  const report = data?.report || [];

  const grandTotalRent = report.reduce((sum, r) => sum + r.totalRent, 0);
  const grandTaxDeducted = report.reduce((sum, r) => sum + r.taxDeducted, 0);
  const grandNetPaid = report.reduce((sum, r) => sum + r.netPaid, 0);

  const toggleRow = (landlordId: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(landlordId)) next.delete(landlordId);
      else next.add(landlordId);
      return next;
    });
  };

  const handleSearch = () => {
    setQueryFrom(from);
    setQueryTo(to);
  };

  const handleExport = async () => {
    if (!queryFrom || !queryTo) return;
    setExporting(true);
    try {
      const res = await apiRequest('GET', `/api/crm/hmrc-rent-report/export?from=${queryFrom}&to=${queryTo}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HMRC_Rent_Report_${queryFrom}_${queryTo}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Export complete', description: 'Excel file downloaded.' });
    } catch {
      toast({ title: 'Export failed', description: 'Could not download the report.', variant: 'destructive' });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5 text-[#791E75]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900">HMRC Non-Resident Landlord Rent Report</h1>
            <p className="text-sm text-gray-500">Annual NRL1 data — rent collected, tax deducted, net paid</p>
          </div>
        </div>
        <Button
          onClick={handleExport}
          disabled={exporting || report.length === 0}
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
        >
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting...' : 'Export to Excel'}
        </Button>
      </div>

      {/* Date Range Selector */}
      <div className="flex items-end gap-4 p-4 bg-gray-50 border rounded-lg">
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">From (Tax Year Start)</Label>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-44" />
        </div>
        <div>
          <Label className="text-xs text-gray-500 mb-1 block">To (Tax Year End)</Label>
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-44" />
        </div>
        <Button onClick={handleSearch} disabled={isLoading || isFetching} className="bg-[#791E75] hover:bg-[#5e1659] text-white gap-2">
          <Search className="h-4 w-4" />
          {isFetching ? 'Loading...' : 'Generate Report'}
        </Button>
        <p className="text-xs text-gray-400 self-center">UK tax year: 6 April – 5 April</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Rent Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-gray-900">{formatPence(grandTotalRent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Tax Deducted</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-600">{formatPence(grandTaxDeducted)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Net Paid to Landlords</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-700">{formatPence(grandNetPaid)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Table */}
      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              <TableHead className="w-8"></TableHead>
              <TableHead>Landlord Name</TableHead>
              <TableHead>Address / Country</TableHead>
              <TableHead className="text-right">Total Rent</TableHead>
              <TableHead className="text-right">Tax Rate</TableHead>
              <TableHead className="text-right">Tax Deducted</TableHead>
              <TableHead className="text-right">Net Paid</TableHead>
              <TableHead>Exemption</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || isFetching ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">Generating report...</TableCell>
              </TableRow>
            ) : report.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-gray-400">
                  No overseas landlords found or no rent collected in this period.
                </TableCell>
              </TableRow>
            ) : (
              report.map(row => (
                <>
                  <TableRow
                    key={`row-${row.landlordId}`}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => toggleRow(row.landlordId)}
                  >
                    <TableCell>
                      {row.properties.length > 0 && (
                        expandedRows.has(row.landlordId)
                          ? <ChevronDown className="h-4 w-4 text-gray-400" />
                          : <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{row.landlordName}</TableCell>
                    <TableCell>
                      <div className="text-sm text-gray-700">{row.landlordAddress || '—'}</div>
                      {row.overseasCountry && (
                        <div className="text-xs text-gray-400">{row.overseasCountry}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatPence(row.totalRent)}</TableCell>
                    <TableCell className="text-right">{row.taxRate}%</TableCell>
                    <TableCell className="text-right text-red-600">{formatPence(row.taxDeducted)}</TableCell>
                    <TableCell className="text-right text-green-700">{formatPence(row.netPaid)}</TableCell>
                    <TableCell>
                      {row.taxExemptionCertNo ? (
                        <div>
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                            Exempt
                          </span>
                          <p className="text-xs text-gray-400 mt-0.5">{row.taxExemptionCertNo}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">None</span>
                      )}
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(row.landlordId) && row.properties.map(prop => (
                    <TableRow key={`prop-${prop.propertyId}`} className="bg-blue-50/30">
                      <TableCell></TableCell>
                      <TableCell className="text-xs text-gray-400 pl-6">Property</TableCell>
                      <TableCell className="text-xs text-gray-700 font-medium">{prop.address || '—'}</TableCell>
                      <TableCell className="text-right text-xs text-gray-700">{formatPence(prop.rentCollected)}</TableCell>
                      <TableCell className="text-right text-xs text-gray-400">{row.taxRate}%</TableCell>
                      <TableCell className="text-right text-xs text-red-500">{formatPence(Math.round(prop.rentCollected * (row.taxRate / 100)))}</TableCell>
                      <TableCell className="text-right text-xs text-green-600">{formatPence(prop.rentCollected - Math.round(prop.rentCollected * (row.taxRate / 100)))}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  ))}
                </>
              ))
            )}
            {report.length > 0 && (
              <TableRow className="bg-gray-100 font-semibold">
                <TableCell></TableCell>
                <TableCell colSpan={2}>TOTALS</TableCell>
                <TableCell className="text-right">{formatPence(grandTotalRent)}</TableCell>
                <TableCell></TableCell>
                <TableCell className="text-right text-red-700">{formatPence(grandTaxDeducted)}</TableCell>
                <TableCell className="text-right text-green-800">{formatPence(grandNetPaid)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
