import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import {
  PoundSterling, TrendingUp, AlertCircle, CheckCircle, Loader2, Mail, Send,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

// --- Types ---

interface RentInvoice {
  id: number;
  amount: number;
  status: 'paid' | 'pending' | 'overdue';
  due_date: string;
  tenant_name: string;
  tenant_email: string;
  property_address: string;
  payment_amount: number | null;
  payment_date: string | null;
  payment_method: string | null;
}

interface MonthlySummary {
  totalInvoices: number;
  paidCount: number;
  pendingCount: number;
  overdueCount: number;
  totalExpected: number;
  totalCollected: number;
  totalOutstanding: number;
}

interface MonthlyData {
  invoices: RentInvoice[];
  summary: MonthlySummary;
}

interface CommissionProperty {
  property_id: number;
  property_address: string;
  management_fee_type: string;
  management_fee_value: number;
  landlord_name: string;
  rent_collected: number;
  commission: number;
}

interface CommissionReport {
  properties: CommissionProperty[];
  totalCommission: number;
}

// --- Helpers ---

const formatGBP = (pence: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
  }).format(pence / 100);
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Paid</Badge>;
    case 'pending':
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Pending</Badge>;
    case 'overdue':
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Overdue</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// --- Component ---

export default function RentCollection() {
  const { toast } = useToast();
  const now = new Date();
  const [year, setYear] = useState<number>(now.getFullYear());
  const [month, setMonth] = useState<number>(now.getMonth() + 1);
  const [dailyDate, setDailyDate] = useState<string>(format(now, 'yyyy-MM-dd'));

  // Monthly data
  const { data: monthlyData, isLoading: isLoadingMonthly } = useQuery<MonthlyData>({
    queryKey: ['/api/crm/pm/rent-collection/monthly', year, month],
    queryFn: () => apiRequest(`/api/crm/pm/rent-collection/monthly?year=${year}&month=${month}`),
  });

  // Daily data
  const { data: dailyInvoices, isLoading: isLoadingDaily } = useQuery<RentInvoice[]>({
    queryKey: ['/api/crm/pm/rent-collection/daily', dailyDate],
    queryFn: () => apiRequest(`/api/crm/pm/rent-collection/daily?date=${dailyDate}`),
  });

  // Commission report
  const { data: commissionData, isLoading: isLoadingCommission } = useQuery<CommissionReport>({
    queryKey: ['/api/crm/pm/rent-collection/commission-report', year, month],
    queryFn: () => apiRequest(`/api/crm/pm/rent-collection/commission-report?year=${year}&month=${month}`),
  });

  const summary = monthlyData?.summary;
  const collectionRate = summary && summary.totalExpected > 0
    ? Math.round((summary.totalCollected / summary.totalExpected) * 100)
    : 0;

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  const renderInvoiceTable = (invoices: RentInvoice[] | undefined, loading: boolean) => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (!invoices || invoices.length === 0) {
      return (
        <div className="text-center py-12 text-muted-foreground">
          No invoices found for this period.
        </div>
      );
    }

    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Due Date</TableHead>
            <TableHead>Property</TableHead>
            <TableHead>Tenant</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment Date</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {invoices.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell>{format(new Date(invoice.due_date), 'dd/MM/yyyy')}</TableCell>
              <TableCell className="max-w-[200px] truncate">{invoice.property_address}</TableCell>
              <TableCell>{invoice.tenant_name}</TableCell>
              <TableCell className="text-right font-medium">{formatGBP(invoice.amount)}</TableCell>
              <TableCell>{statusBadge(invoice.status)}</TableCell>
              <TableCell>
                {invoice.payment_date
                  ? format(new Date(invoice.payment_date), 'dd/MM/yyyy')
                  : '-'}
              </TableCell>
              <TableCell>{invoice.payment_method || '-'}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2"
                    onClick={() => {
                      toast({ title: 'Email Sent', description: 'Rent invoice emailed to ' + invoice.tenant_name });
                    }}
                    title="Email invoice"
                  >
                    <Mail className="h-3 w-3" />
                  </Button>
                  {invoice.status !== 'paid' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 border-red-300 text-red-600 hover:bg-red-50"
                      onClick={() => {
                        toast({ title: 'Chase Sent', description: 'Payment reminder sent to ' + invoice.tenant_name });
                      }}
                      title="Send payment reminder"
                    >
                      <Send className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" style={{ color: '#791E75' }}>
          Rent Collection
        </h1>
        <p className="text-muted-foreground mt-1">
          Track rent payments, view daily collections, and manage commission reports.
        </p>
      </div>

      {/* Month/Year Selector */}
      <div className="flex items-center gap-4">
        <Select value={String(month)} onValueChange={(val) => setMonth(Number(val))}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Month" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((name, idx) => (
              <SelectItem key={idx} value={String(idx + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(val) => setYear(Number(val))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expected</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary ? formatGBP(summary.totalExpected) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.totalInvoices} invoices` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collected</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700">
              {summary ? formatGBP(summary.totalCollected) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.paidCount} paid` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">
              {summary ? formatGBP(summary.totalOutstanding) : '-'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary ? `${summary.pendingCount} pending, ${summary.overdueCount} overdue` : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Collection Rate</CardTitle>
            <TrendingUp className="h-4 w-4" style={{ color: '#791E75' }} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" style={{ color: '#791E75' }}>
              {summary ? `${collectionRate}%` : '-'}
            </div>
            <Progress value={collectionRate} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="monthly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="monthly">Monthly View</TabsTrigger>
          <TabsTrigger value="daily">Daily View</TabsTrigger>
          <TabsTrigger value="commission">Commission Report</TabsTrigger>
        </TabsList>

        {/* Monthly View */}
        <TabsContent value="monthly">
          <Card>
            <CardHeader>
              <CardTitle>Monthly Invoices - {MONTHS[month - 1]} {year}</CardTitle>
            </CardHeader>
            <CardContent>
              {renderInvoiceTable(monthlyData?.invoices, isLoadingMonthly)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Daily View */}
        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <CardTitle>Daily View</CardTitle>
                <Input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                  className="w-[200px]"
                />
              </div>
            </CardHeader>
            <CardContent>
              {renderInvoiceTable(dailyInvoices, isLoadingDaily)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commission Report */}
        <TabsContent value="commission">
          <Card>
            <CardHeader>
              <CardTitle>Commission Report - {MONTHS[month - 1]} {year}</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingCommission ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !commissionData || commissionData.properties.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No commission data found for this period.
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Landlord</TableHead>
                        <TableHead>Fee Type</TableHead>
                        <TableHead className="text-right">Fee Value</TableHead>
                        <TableHead className="text-right">Rent Collected</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {commissionData.properties.map((prop) => (
                        <TableRow key={prop.property_id}>
                          <TableCell className="max-w-[200px] truncate">
                            {prop.property_address}
                          </TableCell>
                          <TableCell>{prop.landlord_name}</TableCell>
                          <TableCell className="capitalize">{prop.management_fee_type}</TableCell>
                          <TableCell className="text-right">
                            {prop.management_fee_type === 'percentage'
                              ? `${prop.management_fee_value}%`
                              : formatGBP(prop.management_fee_value)}
                          </TableCell>
                          <TableCell className="text-right">{formatGBP(prop.rent_collected)}</TableCell>
                          <TableCell className="text-right font-medium">{formatGBP(prop.commission)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Card className="mt-6 border-2" style={{ borderColor: '#791E75' }}>
                    <CardContent className="flex items-center justify-between py-4">
                      <span className="text-lg font-semibold">Total Commission</span>
                      <span className="text-2xl font-bold" style={{ color: '#791E75' }}>
                        {formatGBP(commissionData.totalCommission)}
                      </span>
                    </CardContent>
                  </Card>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
