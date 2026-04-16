import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Banknote, Download, CheckCircle, Loader2 } from 'lucide-react';

interface PendingPayment {
  landlordId: number;
  landlordName: string;
  bankName: string | null;
  accountNumber: string | null;
  sortCode: string | null;
  amount: number;
  reference: string;
}

function maskAccount(account: string | null): string {
  if (!account) return '—';
  return '****' + account.slice(-4);
}

function formatPence(pence: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);
}

export default function BACSPaymentGeneration() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [downloaded, setDownloaded] = useState(false);

  const { data: payments = [], isLoading } = useQuery<PendingPayment[]>({
    queryKey: ['/api/crm/bacs/pending-payments'],
    queryFn: () => apiRequest('GET', '/api/crm/bacs/pending-payments').then(r => r.json()),
  });

  const selectedPayments = payments.filter(p => selected.has(p.landlordId));
  const totalAmount = selectedPayments.reduce((sum, p) => sum + Number(p.amount), 0);

  const allSelected = payments.length > 0 && selected.size === payments.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(payments.map(p => p.landlordId)));
    }
  }

  function toggleOne(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setDownloaded(false);
  }

  function buildPreview(): string {
    return selectedPayments.map(p => {
      const sc = (p.sortCode || '').replace(/[-\s]/g, '').padEnd(6, '0').slice(0, 6);
      const acc = (p.accountNumber || '').replace(/[-\s]/g, '').padStart(8, '0').slice(0, 8);
      const amt = Math.round(Number(p.amount));
      const name = p.landlordName.slice(0, 18).padEnd(18, ' ');
      const ref = `JBLETTING${p.landlordId}`.slice(0, 18).padEnd(18, ' ');
      return `${sc}${acc}${amt}${name}${ref}`;
    }).join('\r\n');
  }

  function handlePreview() {
    if (selected.size === 0) {
      toast({ title: 'No payments selected', variant: 'destructive' });
      return;
    }
    setPreviewText(buildPreview());
    setPreviewOpen(true);
  }

  async function handleGenerateDownload() {
    if (selected.size === 0) {
      toast({ title: 'No payments selected', variant: 'destructive' });
      return;
    }
    try {
      const resp = await apiRequest('POST', '/api/crm/bacs/generate', {
        paymentIds: Array.from(selected),
      });
      const blob = await resp.blob();
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BACS_${dateStr}.txt`;
      a.click();
      URL.revokeObjectURL(url);
      setDownloaded(true);
      toast({ title: 'BACS file downloaded successfully' });
    } catch (err: any) {
      toast({ title: 'Download failed', description: err.message, variant: 'destructive' });
    }
  }

  const markPaidMutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/crm/bacs/mark-paid', {
        landlordIds: Array.from(selected),
        paymentDate: new Date().toISOString(),
        reference: `BACS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
      }).then(r => r.json()),
    onSuccess: (data) => {
      toast({ title: `${data.transactionsCreated} landlord(s) marked as paid` });
      setSelected(new Set());
      setDownloaded(false);
      queryClient.invalidateQueries({ queryKey: ['/api/crm/bacs/pending-payments'] });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to mark as paid', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Banknote className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">BACS Payment Generation</h1>
          <p className="text-sm text-gray-500">Generate BACS Standard 18 files for landlord payments</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
          <span className="ml-2 text-gray-500">Loading pending payments...</span>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-16 border rounded-lg bg-gray-50">
          <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No pending BACS payments</p>
          <p className="text-sm text-gray-400 mt-1">All landlord balances are settled</p>
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
                  <TableHead>Landlord</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Sort Code</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Reference</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map(p => (
                  <TableRow key={p.landlordId} className={selected.has(p.landlordId) ? 'bg-purple-50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selected.has(p.landlordId)}
                        onCheckedChange={() => toggleOne(p.landlordId)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{p.landlordName}</TableCell>
                    <TableCell className="text-gray-500">{p.bankName || '—'}</TableCell>
                    <TableCell className="font-mono text-sm">{maskAccount(p.accountNumber)}</TableCell>
                    <TableCell className="font-mono text-sm">{p.sortCode || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-green-700">
                      {formatPence(Number(p.amount))}
                    </TableCell>
                    <TableCell className="text-xs text-gray-400">{p.reference}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Summary & Actions */}
          <div className="flex items-center justify-between bg-white border rounded-lg p-4">
            <div>
              <p className="text-sm text-gray-500">
                {selected.size} of {payments.length} selected
              </p>
              {selected.size > 0 && (
                <p className="text-lg font-bold text-gray-900">
                  Total: {formatPence(totalAmount)}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handlePreview} disabled={selected.size === 0}>
                Preview BACS File
              </Button>
              <Button
                variant="outline"
                onClick={handleGenerateDownload}
                disabled={selected.size === 0}
                className="border-[#791E75] text-[#791E75] hover:bg-[#791E75] hover:text-white"
              >
                <Download className="h-4 w-4 mr-1" />
                Generate &amp; Download
              </Button>
              <Button
                onClick={() => markPaidMutation.mutate()}
                disabled={!downloaded || selected.size === 0 || markPaidMutation.isPending}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {markPaidMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                <CheckCircle className="h-4 w-4 mr-1" />
                Mark as Paid
              </Button>
            </div>
          </div>

          {!downloaded && selected.size > 0 && (
            <p className="text-xs text-amber-600 mt-2 text-right">
              Download the BACS file first before marking as paid
            </p>
          )}
        </>
      )}

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>BACS File Preview</DialogTitle>
          </DialogHeader>
          <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-80">
            <pre className="text-green-400 text-xs font-mono whitespace-pre">
              {previewText || '(no data)'}
            </pre>
          </div>
          <p className="text-xs text-gray-400">
            Format: SortCode(6) | AccountNo(8) | AmountPence | Name(18) | Reference(18)
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Close</Button>
            <Button
              onClick={() => { setPreviewOpen(false); handleGenerateDownload(); }}
              className="bg-[#791E75] hover:bg-[#5a1557] text-white"
            >
              <Download className="h-4 w-4 mr-1" />
              Download File
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
