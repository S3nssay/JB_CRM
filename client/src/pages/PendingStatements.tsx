import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import {
  FileSpreadsheet, Loader2, CheckCircle, XCircle, Send, ChevronDown, ChevronRight,
  AlertTriangle, Plus,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { formatPence } from '@/lib/utils';

// --- Types ---

interface StatementLineItem {
  description: string;
  amount: number;
  type: string;
}

interface PendingStatement {
  id: number;
  landlordName: string;
  propertyAddress: string;
  period: string;
  totalRent: number;
  netPayable: number;
  attentionNeeded: boolean;
  status: string;
  lineItems: StatementLineItem[];
  managementFees?: number;
  maintenanceDeductions?: number;
  vatOnFees?: number;
}

// --- Component ---

export default function PendingStatements() {
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));

  // Fetch pending statements
  const { data, isLoading, error } = useQuery<{ statements: PendingStatement[] }>({
    queryKey: ['/api/crm/finance/statements/pending'],
  });

  const statements = data?.statements ?? [];

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/crm/finance/statements/${id}/approve`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/finance/statements/pending'] });
      toast({ title: 'Statement approved', description: 'Statement has been approved and is ready to send.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Approval failed', description: err.message, variant: 'destructive' });
    },
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/crm/finance/statements/${id}/send`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/finance/statements/pending'] });
      toast({ title: 'Statement sent', description: 'PDF statement emailed to landlord.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Send failed', description: err.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/crm/finance/statements/${id}/reject`, 'POST'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/finance/statements/pending'] });
      toast({ title: 'Statement rejected', description: 'Statement has been rejected.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Rejection failed', description: err.message, variant: 'destructive' });
    },
  });

  const generateMutation = useMutation({
    mutationFn: (payload: { year: number; month: number }) =>
      apiRequest('/api/crm/finance/statements/generate', 'POST', payload),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/finance/statements/pending'] });
      toast({
        title: 'Statements generated',
        description: `${data.created ?? 0} created, ${data.attentionNeeded ?? 0} need attention.`,
      });
      setGenerateOpen(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    },
  });

  const toggleExpanded = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const months = [
    { value: '1', label: 'January' }, { value: '2', label: 'February' },
    { value: '3', label: 'March' }, { value: '4', label: 'April' },
    { value: '5', label: 'May' }, { value: '6', label: 'June' },
    { value: '7', label: 'July' }, { value: '8', label: 'August' },
    { value: '9', label: 'September' }, { value: '10', label: 'October' },
    { value: '11', label: 'November' }, { value: '12', label: 'December' },
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => String(currentYear - 1 + i));

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-[#791E75]" />
            Pending Statements
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Review and approve landlord statements before sending
          </p>
        </div>
        <Button
          onClick={() => setGenerateOpen(true)}
          className="bg-[#791E75] hover:bg-[#691A65] text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Generate Statements
        </Button>
      </div>

      {/* Loading / Error / Empty */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-8 text-center text-red-600">
            Failed to load statements: {(error as Error).message}
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && statements.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <FileSpreadsheet className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">No pending statements</p>
            <p className="text-gray-400 text-sm mt-1">
              Generate statements for the current period to get started.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Statement Cards */}
      {statements.map((stmt) => (
        <Card key={stmt.id} className="border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base font-semibold">
                  {stmt.propertyAddress}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-0.5">{stmt.landlordName}</p>
                <p className="text-xs text-gray-400 mt-0.5">{stmt.period}</p>
              </div>
              <div className="flex items-center gap-2">
                {stmt.attentionNeeded && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Attention Needed
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={
                    stmt.status === 'approved'
                      ? 'bg-green-50 text-green-700 border-green-300'
                      : stmt.status === 'rejected'
                      ? 'bg-red-50 text-red-700 border-red-300'
                      : 'bg-gray-50 text-gray-600 border-gray-300'
                  }
                >
                  {stmt.status}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Financial Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Rent Collected</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatPence(stmt.totalRent)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Management Fees</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatPence(stmt.managementFees ?? 0)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Maintenance</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatPence(stmt.maintenanceDeductions ?? 0)}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">VAT</p>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{formatPence(stmt.vatOnFees ?? 0)}</p>
              </div>
              <div className="bg-[#791E75]/5 rounded-lg p-3">
                <p className="text-[10px] uppercase tracking-wider text-[#791E75]/60 font-medium">Net Payable</p>
                <p className="text-sm font-bold text-[#791E75] mt-0.5">{formatPence(stmt.netPayable)}</p>
              </div>
            </div>

            {/* Expandable Line Items */}
            {stmt.lineItems && stmt.lineItems.length > 0 && (
              <div>
                <button
                  onClick={() => toggleExpanded(stmt.id)}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {expandedId === stmt.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  {expandedId === stmt.id ? 'Hide' : 'Show'} line items ({stmt.lineItems.length})
                </button>

                {expandedId === stmt.id && (
                  <div className="mt-2 border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gray-50">
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs text-right">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {stmt.lineItems.map((item, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm">{item.description}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs capitalize">
                                {item.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-right font-medium">
                              {formatPence(item.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
              {stmt.status === 'draft' && (
                <>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => approveMutation.mutate(stmt.id)}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => rejectMutation.mutate(stmt.id)}
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Reject
                  </Button>
                </>
              )}
              {stmt.status === 'approved' && (
                <Button
                  size="sm"
                  className="bg-[#791E75] hover:bg-[#691A65] text-white"
                  onClick={() => sendMutation.mutate(stmt.id)}
                  disabled={sendMutation.isPending}
                >
                  {sendMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Send to Landlord
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Generate Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Statements</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-500">
              Generate landlord statements for a specific month. This will create draft statements for all managed properties.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Year</label>
                <Select value={genYear} onValueChange={setGenYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Month</label>
                <Select value={genMonth} onValueChange={setGenMonth}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((m) => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#791E75] hover:bg-[#691A65] text-white"
              onClick={() => generateMutation.mutate({ year: Number(genYear), month: Number(genMonth) })}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
