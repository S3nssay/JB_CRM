import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface ContractorInvoice {
  invoiceId: number;
  contractorName: string;
  invoiceNumber: string;
  description: string;
  amount: number;
  date: string;
  dueDate: string;
  status: string;
}

function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

export default function ContractorBatchPayments() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [paymentMethod, setPaymentMethod] = useState('bacs');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: invoices = [], isLoading } = useQuery<ContractorInvoice[]>({
    queryKey: ['/api/crm/batch/contractor-invoices'],
    queryFn: () => apiRequest('GET', '/api/crm/batch/contractor-invoices').then(r => r.json()),
  });

  const selectedInvoices = invoices.filter(inv => selected.has(inv.invoiceId));
  const totalAmount = selectedInvoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
  const allSelected = invoices.length > 0 && selected.size === invoices.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(invoices.map(inv => inv.invoiceId)));
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const payMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/crm/batch/contractor-pay', {
        invoiceIds: Array.from(selected),
        paymentDate,
        paymentMethod,
      }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: `${data.invoicesPaid} invoice(s) marked as paid` });
      setSelected(new Set());
      setConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/batch/contractor-invoices'] });
    },
    onError: (err: any) => {
      toast({ title: 'Payment failed', description: err.message, variant: 'destructive' });
      setConfirmOpen(false);
    },
  });

  function isOverdue(dueDate: string): boolean {
    return !!dueDate && new Date(dueDate) < new Date();
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Contractor Batch Payments</h1>
          <p className="text-sm text-gray-500">Process multiple approved contractor invoices at once</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
          <span className="ml-2 text-gray-500">Loading invoices...</span>
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-gray-50">
          <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No approved invoices pending payment</p>
          <p className="text-sm text-gray-400 mt-1">All contractor invoices are settled</p>
        </div>
      ) : (
        <>
          <div className="border rounded-lg overflow-hidden mb-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-10">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map(inv => (
                  <TableRow key={inv.invoiceId} className={selected.has(inv.invoiceId) ? 'bg-purple-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(inv.invoiceId)}
                        onCheckedChange={() => toggleOne(inv.invoiceId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{inv.contractorName}</TableCell>
                    <TableCell className="font-mono text-sm text-gray-500">{inv.invoiceNumber}</TableCell>
                    <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">
                      {inv.description || '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatPence(Number(inv.amount))}
                    </TableCell>
                    <TableCell className="text-sm">{formatDate(inv.date)}</TableCell>
                    <TableCell className="text-sm">
                      <span className={isOverdue(inv.dueDate) ? 'text-red-600 font-medium flex items-center gap-1' : ''}>
                        {isOverdue(inv.dueDate) && <AlertCircle className="h-3.5 w-3.5" />}
                        {formatDate(inv.dueDate)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Payment settings & actions */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end justify-between">
              <div className="flex gap-4 items-end flex-wrap">
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="w-40 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bacs">BACS</SelectItem>
                      <SelectItem value="faster_payment">Faster Payment</SelectItem>
                      <SelectItem value="chaps">CHAPS</SelectItem>
                      <SelectItem value="cheque">Cheque</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-500 mb-1 block">Payment Date</Label>
                  <Input
                    type="date"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                    className="w-40 bg-white"
                  />
                </div>
                <div className="text-sm text-gray-500">
                  <span className="font-medium text-gray-700">{selected.size}</span> of {invoices.length} selected
                </div>
              </div>
              <div className="flex items-center gap-3">
                {selected.size > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-gray-500">Total to pay</p>
                    <p className="text-lg font-bold text-gray-900">{formatPence(totalAmount)}</p>
                  </div>
                )}
                <Button
                  onClick={() => setConfirmOpen(true)}
                  disabled={selected.size === 0}
                  className="bg-[#791E75] hover:bg-[#5a1557] text-white"
                >
                  Process Batch Payment
                </Button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Confirmation dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Batch Payment</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to mark <strong>{selected.size}</strong> invoice(s) as paid
              via <strong>{paymentMethod.toUpperCase()}</strong> totalling{' '}
              <strong>{formatPence(totalAmount)}</strong> on{' '}
              <strong>{new Date(paymentDate).toLocaleDateString('en-GB')}</strong>.
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={payMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => payMutation.mutate()}
              disabled={payMutation.isPending}
              className="bg-[#791E75] hover:bg-[#5a1557] text-white"
            >
              {payMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Confirm Payment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
