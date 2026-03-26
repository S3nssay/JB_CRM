import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Receipt, Loader2, Search, Plus, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { formatPence } from '@/lib/utils';

// --- Types ---

interface TenantInvoice {
  id: number;
  invoiceNumber: string;
  tenantName: string;
  propertyAddress: string;
  amount: number;
  dueDate: string;
  status: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600 border-gray-300',
  sent: 'bg-blue-50 text-blue-700 border-blue-300',
  paid: 'bg-green-50 text-green-700 border-green-300',
  overdue: 'bg-red-50 text-red-700 border-red-300',
};

const PAGE_SIZE = 20;

// --- Component ---

export default function TenantInvoices() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Build query params
  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);

  const { data, isLoading, error } = useQuery<{ invoices: TenantInvoice[] }>({
    queryKey: ['/api/crm/finance/invoices', statusFilter],
    queryFn: () => apiRequest(`/api/crm/finance/invoices?${queryParams.toString()}`),
  });

  const allInvoices = data?.invoices ?? [];

  // Client-side search filter
  const filteredInvoices = useMemo(() => {
    if (!searchTerm.trim()) return allInvoices;
    const term = searchTerm.toLowerCase();
    return allInvoices.filter(
      (inv) =>
        inv.tenantName.toLowerCase().includes(term) ||
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.propertyAddress.toLowerCase().includes(term)
    );
  }, [allInvoices, searchTerm]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / PAGE_SIZE));
  const pagedInvoices = filteredInvoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Generate invoices mutation
  const generateMutation = useMutation({
    mutationFn: () => apiRequest('/api/crm/finance/invoices/generate', 'POST'),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/finance/invoices'] });
      toast({
        title: 'Invoices generated',
        description: `${data.created ?? 0} created, ${data.sent ?? 0} sent.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-[#791E75]" />
            Tenant Invoices
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            View and manage tenant invoices
          </p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          className="bg-[#791E75] hover:bg-[#691A65] text-white"
          disabled={generateMutation.isPending}
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Plus className="h-4 w-4 mr-2" />
          )}
          Generate Invoices
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by tenant, invoice #, or property..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Loading / Error */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-red-600">
            Failed to load invoices: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && !error && filteredInvoices.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <Receipt className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No invoices found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Generate invoices to get started.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Invoices Table */}
      {!isLoading && !error && filteredInvoices.length > 0 && (
        <Card className="border border-gray-200">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="text-xs font-medium">Invoice #</TableHead>
                  <TableHead className="text-xs font-medium">Tenant</TableHead>
                  <TableHead className="text-xs font-medium">Property</TableHead>
                  <TableHead className="text-xs font-medium text-right">Amount</TableHead>
                  <TableHead className="text-xs font-medium">Due Date</TableHead>
                  <TableHead className="text-xs font-medium">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedInvoices.map((inv) => (
                  <TableRow key={inv.id} className="hover:bg-gray-50/50">
                    <TableCell className="text-sm font-medium text-gray-900">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell className="text-sm text-gray-700">{inv.tenantName}</TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                      {inv.propertyAddress}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-right">
                      {formatPence(inv.amount)}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {formatDate(inv.dueDate)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`capitalize text-xs ${STATUS_COLORS[inv.status] || STATUS_COLORS.draft}`}
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredInvoices.length)} of {filteredInvoices.length}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
