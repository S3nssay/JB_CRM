import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Settings, Loader2, Trash2, RotateCcw, FileText, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '-';

interface Landlord { id: number; name: string; }
interface MaintenanceLog {
  id: number;
  action: string;
  targetId: string;
  reason: string | null;
  performedBy: string | null;
  createdAt: string;
  success: boolean;
}

type ActionType = 'delete-charge' | 'reverse-invoice' | 'redraw-statement' | null;

export default function AccountMaintenance() {
  const { toast } = useToast();
  const [activeAction, setActiveAction] = useState<ActionType>(null);

  // Delete charge state
  const [deleteTransactionId, setDeleteTransactionId] = useState('');

  // Reverse invoice state
  const [reverseInvoiceId, setReverseInvoiceId] = useState('');
  const [reverseReason, setReverseReason] = useState('');

  // Redraw statement state
  const [redrawLandlordId, setRedrawLandlordId] = useState('');

  const { data: landlords = [] } = useQuery<Landlord[]>({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const res = await fetch('/api/crm/landlords', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: auditLog = [], isLoading: logLoading } = useQuery<MaintenanceLog[]>({
    queryKey: ['/api/crm/account-maintenance/log'],
    queryFn: async () => {
      const res = await fetch('/api/crm/account-maintenance/log', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const maintenanceMutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string; payload: any }) =>
      apiRequest(`/api/crm/account-maintenance/${action}`, 'POST', payload),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/account-maintenance/log'] });
      const labels: Record<string, string> = {
        'delete-charge': 'Charge deleted',
        'reverse-invoice': 'Invoice reversed',
        'redraw-statement': 'Statement regenerated',
      };
      toast({ title: labels[action] ?? 'Action completed', description: 'The maintenance action was applied successfully.' });
      setActiveAction(null);
      setDeleteTransactionId('');
      setReverseInvoiceId('');
      setReverseReason('');
      setRedrawLandlordId('');
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleDeleteCharge = () => {
    if (!deleteTransactionId.trim()) return;
    maintenanceMutation.mutate({ action: 'delete-charge', payload: { transactionId: deleteTransactionId.trim() } });
  };

  const handleReverseInvoice = () => {
    if (!reverseInvoiceId.trim()) return;
    maintenanceMutation.mutate({ action: 'reverse-invoice', payload: { invoiceId: reverseInvoiceId.trim(), reason: reverseReason.trim() } });
  };

  const handleRedrawStatement = () => {
    if (!redrawLandlordId) return;
    maintenanceMutation.mutate({ action: 'redraw-statement', payload: { landlordId: parseInt(redrawLandlordId) } });
  };

  const isWorking = maintenanceMutation.isPending;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Maintenance</h1>
          <p className="text-sm text-gray-500">Admin-only correction and override tools</p>
        </div>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          These tools make irreversible changes to financial records. All actions are logged in the audit trail below. Use with caution.
        </p>
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Delete charge card */}
        <Card className="border-red-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              <CardTitle className="text-base">Delete Property Charge</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Permanently removes a charge transaction from the ledger. Enter the transaction ID to proceed.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setActiveAction('delete-charge')}
            >
              Open Tool
            </Button>
          </CardContent>
        </Card>

        {/* Reverse invoice card */}
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              <CardTitle className="text-base">Reverse Invoice</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Creates an equal-and-opposite offsetting entry against an existing invoice. Requires a reason.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full border-amber-200 text-amber-700 hover:bg-amber-50"
              onClick={() => setActiveAction('reverse-invoice')}
            >
              Open Tool
            </Button>
          </CardContent>
        </Card>

        {/* Redraw statement card */}
        <Card className="border-blue-200">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <CardTitle className="text-base">Re-draw Landlord Statement</CardTitle>
            </div>
            <CardDescription className="text-xs">
              Regenerates the latest statement for a landlord, recalculating all figures from source transactions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="w-full border-blue-200 text-blue-700 hover:bg-blue-50"
              onClick={() => setActiveAction('redraw-statement')}
            >
              Open Tool
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Audit log */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Maintenance Actions</CardTitle>
        </CardHeader>
        <CardContent className="px-3">
          {logLoading ? (
            <div className="py-8 text-center">
              <Loader2 className="h-5 w-5 animate-spin mx-auto text-gray-400" />
            </div>
          ) : auditLog.length === 0 ? (
            <div className="py-8 text-center text-gray-400 text-sm">No maintenance actions recorded yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    <TableHead className="text-xs font-semibold text-gray-600">Date/Time</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Action</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Target ID</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Reason</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Performed By</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-600">Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog.map((entry) => (
                    <TableRow key={entry.id} className="text-sm hover:bg-gray-50">
                      <TableCell className="text-xs text-gray-500">{fmtDate(entry.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{entry.action.replace(/-/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{entry.targetId}</TableCell>
                      <TableCell className="text-xs text-gray-500 max-w-xs truncate">{entry.reason ?? '-'}</TableCell>
                      <TableCell className="text-xs">{entry.performedBy ?? '-'}</TableCell>
                      <TableCell>
                        {entry.success ? (
                          <Badge className="bg-green-100 text-green-800 border-0 text-xs">Success</Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-0 text-xs">Failed</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Charge Dialog */}
      <Dialog open={activeAction === 'delete-charge'} onOpenChange={(open) => { if (!open) setActiveAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-500" />
              Delete Property Charge
            </DialogTitle>
            <DialogDescription>
              This will permanently remove the charge transaction. This action cannot be undone and will be logged.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Transaction ID *</Label>
              <Input
                value={deleteTransactionId}
                onChange={(e) => setDeleteTransactionId(e.target.value)}
                placeholder="Enter transaction ID to delete"
                className="font-mono"
              />
            </div>
            <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
              Warning: Deleting a charge will permanently remove it from the ledger and cannot be reversed.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={handleDeleteCharge}
              disabled={isWorking || !deleteTransactionId.trim()}
            >
              {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Invoice Dialog */}
      <Dialog open={activeAction === 'reverse-invoice'} onOpenChange={(open) => { if (!open) setActiveAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-amber-500" />
              Reverse Invoice
            </DialogTitle>
            <DialogDescription>
              Creates an equal-and-opposite offsetting entry. The original invoice remains; a credit note is generated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Invoice ID *</Label>
              <Input
                value={reverseInvoiceId}
                onChange={(e) => setReverseInvoiceId(e.target.value)}
                placeholder="Enter invoice ID"
                className="font-mono"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Reason *</Label>
              <Textarea
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Explain why this invoice is being reversed..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700"
              onClick={handleReverseInvoice}
              disabled={isWorking || !reverseInvoiceId.trim() || !reverseReason.trim()}
            >
              {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reverse Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redraw Statement Dialog */}
      <Dialog open={activeAction === 'redraw-statement'} onOpenChange={(open) => { if (!open) setActiveAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-500" />
              Re-draw Landlord Statement
            </DialogTitle>
            <DialogDescription>
              Regenerates the latest statement for the selected landlord from source transactions.
              The previous statement PDF will be overwritten.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Landlord *</Label>
              <Select value={redrawLandlordId} onValueChange={setRedrawLandlordId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select landlord..." />
                </SelectTrigger>
                <SelectContent>
                  {landlords.map((l) => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveAction(null)}>Cancel</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={handleRedrawStatement}
              disabled={isWorking || !redrawLandlordId}
            >
              {isWorking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Regenerate Statement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
