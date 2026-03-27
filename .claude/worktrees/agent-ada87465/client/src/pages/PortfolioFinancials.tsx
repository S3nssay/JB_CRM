import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  TrendingUp, TrendingDown, PoundSterling, Plus, Loader2,
  BarChart3, ArrowUpRight, ArrowDownRight, Filter,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { formatPence } from '@/lib/utils';

// --- Types ---

interface PortfolioSummary {
  totalIncome: number; // pence
  totalExpenses: number; // pence
  netProfit: number; // pence
  properties: PropertyFinancial[];
}

interface PropertyFinancial {
  propertyId: number;
  address: string;
  income: number; // pence
  expenses: number; // pence
  netProfit: number; // pence
}

interface CreateTransactionData {
  propertyId: number | null;
  transactionType: 'income' | 'expense';
  category: string;
  amount: number; // entered in pounds, converted to pence on submit
  description: string;
  date: string;
}

// --- Helpers ---

// --- Component ---

export default function PortfolioFinancials() {
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [formData, setFormData] = useState<CreateTransactionData>({
    propertyId: null,
    transactionType: 'income',
    category: 'rent',
    amount: 0,
    description: '',
    date: '',
  });

  // Build query string for date range
  function buildQueryString(): string {
    const params = new URLSearchParams();
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  const queryString = buildQueryString();

  // Fetch portfolio summary
  const { data: summary, isLoading } = useQuery<PortfolioSummary>({
    queryKey: ['/api/crm/financials/portfolio-summary', dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch(`/api/crm/financials/portfolio-summary${queryString}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to fetch portfolio summary');
      return response.json();
    },
  });

  // Create transaction mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTransactionData) => {
      const response = await fetch('/api/crm/property-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          amount: Math.round(data.amount * 100), // convert pounds to pence
        }),
      });
      if (!response.ok) throw new Error('Failed to create transaction');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Transaction Added', description: 'The transaction has been recorded.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/financials/portfolio-summary'] });
      setShowAddDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  function resetForm() {
    setFormData({
      propertyId: null,
      transactionType: 'income',
      category: 'rent',
      amount: 0,
      description: '',
      date: '',
    });
  }

  function handleCreateTransaction() {
    if (!formData.date) {
      toast({ title: 'Validation Error', description: 'Date is required.', variant: 'destructive' });
      return;
    }
    if (formData.amount <= 0) {
      toast({ title: 'Validation Error', description: 'Amount must be greater than zero.', variant: 'destructive' });
      return;
    }
    if (!formData.propertyId) {
      toast({ title: 'Validation Error', description: 'Property ID is required.', variant: 'destructive' });
      return;
    }
    createMutation.mutate(formData);
  }

  const incomeCategories = [
    { value: 'rent', label: 'Rent' },
    { value: 'deposit', label: 'Deposit' },
    { value: 'service_charge', label: 'Service Charge' },
    { value: 'insurance_claim', label: 'Insurance Claim' },
    { value: 'other_income', label: 'Other Income' },
  ];

  const expenseCategories = [
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'insurance', label: 'Insurance' },
    { value: 'management_fee', label: 'Management Fee' },
    { value: 'legal', label: 'Legal Fees' },
    { value: 'tax', label: 'Tax' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'service_charge', label: 'Service Charge' },
    { value: 'other_expense', label: 'Other Expense' },
  ];

  const categories = formData.transactionType === 'income' ? incomeCategories : expenseCategories;
  const properties = summary?.properties ?? [];
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpenses = summary?.totalExpenses ?? 0;
  const netProfit = summary?.netProfit ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Portfolio Financials</h1>
          <p className="text-muted-foreground">Overview of income, expenses, and profitability across your portfolio.</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Transaction
        </Button>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Date Range Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[180px]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[180px]"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Income</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatPence(totalIncome)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Expenses</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {formatPence(totalExpenses)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Profit</CardTitle>
            {netProfit >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatPence(netProfit)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Property Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle>Property Breakdown</CardTitle>
          <CardDescription>Income and expenses per property in the portfolio.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No financial data</p>
              <p className="text-sm">Add transactions to see your portfolio breakdown.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property ID</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead className="text-right">Income</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {properties.map((property) => (
                  <TableRow key={property.propertyId}>
                    <TableCell className="font-medium">{property.propertyId}</TableCell>
                    <TableCell>{property.address || '-'}</TableCell>
                    <TableCell className="text-right font-mono text-green-600">
                      {formatPence(property.income)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-red-600">
                      {formatPence(property.expenses)}
                    </TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${property.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatPence(property.netProfit)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals Row */}
                <TableRow className="bg-muted/50 font-semibold">
                  <TableCell colSpan={2}>Total</TableCell>
                  <TableCell className="text-right font-mono text-green-600">
                    {formatPence(totalIncome)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {formatPence(totalExpenses)}
                  </TableCell>
                  <TableCell className={`text-right font-mono ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatPence(netProfit)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Transaction Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Transaction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="propertyId">Property ID</Label>
              <Input
                id="propertyId"
                type="number"
                placeholder="Enter property ID"
                value={formData.propertyId ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    propertyId: e.target.value ? parseInt(e.target.value, 10) : null,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="transactionType">Transaction Type</Label>
              <Select
                value={formData.transactionType}
                onValueChange={(value: 'income' | 'expense') => {
                  const defaultCategory = value === 'income' ? 'rent' : 'maintenance';
                  setFormData({ ...formData, transactionType: value, category: defaultCategory });
                }}
              >
                <SelectTrigger id="transactionType">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger id="category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (£)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={formData.amount || ''}
                onChange={(e) =>
                  setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Transaction description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateTransaction} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
