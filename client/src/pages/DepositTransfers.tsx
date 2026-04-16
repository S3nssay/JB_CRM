import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { ArrowRightLeft, Plus, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DepositTransfer {
  id: number;
  tenancy_id: number;
  tenant_id: number | null;
  direction: string;
  amount: number;
  from_account: string | null;
  to_account: string | null;
  scheme_name: string | null;
  reference: string | null;
  transfer_date: string;
  status: string;
  created_at: string;
  property_title: string | null;
  address_line1: string | null;
  tenant_name: string | null;
}

interface TransferForm {
  tenancyId: string;
  tenantId: string;
  direction: string;
  amount: string;
  fromAccount: string;
  toAccount: string;
  schemeName: string;
  reference: string;
  transferDate: string;
}

const emptyForm: TransferForm = {
  tenancyId: '', tenantId: '', direction: 'out_to_scheme',
  amount: '', fromAccount: '', toAccount: '',
  schemeName: '', reference: '',
  transferDate: new Date().toISOString().split('T')[0],
};

const statusBadge = (status: string) => {
  if (status === 'completed') return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
};

const directionLabel = (direction: string) => {
  if (direction === 'out_to_scheme') return (
    <span className="flex items-center gap-1 text-blue-700">
      <ArrowRightLeft className="h-3.5 w-3.5" /> Out to Scheme
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-green-700">
      <ArrowRightLeft className="h-3.5 w-3.5" /> In from Scheme
    </span>
  );
};

export default function DepositTransfers() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<TransferForm>(emptyForm);
  const [filterTenancyId, setFilterTenancyId] = useState('');

  const queryKey = filterTenancyId
    ? [`/api/crm/deposit-transfers?tenancyId=${filterTenancyId}`]
    : ['/api/crm/deposit-transfers'];

  const { data: transfers = [], isLoading } = useQuery<DepositTransfer[]>({
    queryKey,
    queryFn: () => {
      const url = filterTenancyId
        ? `/api/crm/deposit-transfers?tenancyId=${filterTenancyId}`
        : '/api/crm/deposit-transfers';
      return apiRequest('GET', url).then(r => r.json());
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/crm/deposit-transfers', data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/deposit-transfers'] });
      toast({ title: 'Transfer created' });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest('PUT', `/api/crm/deposit-transfers/${id}`, { status }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/deposit-transfers'] });
      toast({ title: 'Status updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleCreate = () => {
    if (!form.tenancyId || !form.direction || !form.amount || !form.transferDate) {
      toast({ title: 'Tenancy ID, direction, amount and date are required', variant: 'destructive' });
      return;
    }
    createMutation.mutate({
      tenancyId: parseInt(form.tenancyId, 10),
      tenantId: form.tenantId ? parseInt(form.tenantId, 10) : undefined,
      direction: form.direction,
      amount: Math.round(parseFloat(form.amount) * 100), // convert £ to pence
      fromAccount: form.fromAccount || undefined,
      toAccount: form.toAccount || undefined,
      schemeName: form.schemeName || undefined,
      reference: form.reference || undefined,
      transferDate: new Date(form.transferDate).toISOString(),
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-6 w-6 text-[#791E75]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Deposit Transfers</h1>
            <p className="text-sm text-gray-500">Track deposit movements to and from protection schemes</p>
          </div>
        </div>
        <Button onClick={() => setDialogOpen(true)} className="bg-[#791E75] hover:bg-[#5a1557]">
          <Plus className="h-4 w-4 mr-2" /> New Transfer
        </Button>
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-center">
        <Label className="whitespace-nowrap">Filter by Tenancy ID:</Label>
        <Input
          className="max-w-xs"
          type="number"
          value={filterTenancyId}
          onChange={e => setFilterTenancyId(e.target.value)}
          placeholder="Enter tenancy ID..."
        />
        {filterTenancyId && (
          <Button variant="ghost" size="sm" onClick={() => setFilterTenancyId('')}>Clear</Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transfers ({transfers.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-gray-400">Loading...</div>
          ) : transfers.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No deposit transfers found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property / Tenant</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Scheme</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Transfer Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transfers.map(transfer => (
                  <TableRow key={transfer.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">
                          {transfer.property_title || transfer.address_line1 || `Tenancy #${transfer.tenancy_id}`}
                        </p>
                        {transfer.tenant_name && (
                          <p className="text-xs text-gray-400">{transfer.tenant_name}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{directionLabel(transfer.direction)}</TableCell>
                    <TableCell className="font-medium">
                      £{(transfer.amount / 100).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-gray-600">{transfer.scheme_name || '—'}</TableCell>
                    <TableCell className="text-gray-600 text-sm">{transfer.reference || '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(transfer.transfer_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>{statusBadge(transfer.status)}</TableCell>
                    <TableCell className="text-right">
                      {transfer.status === 'pending' && (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="text-green-600 hover:text-green-800"
                            onClick={() => updateStatusMutation.mutate({ id: transfer.id, status: 'completed' })}
                            title="Mark completed"
                          >
                            <CheckCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => updateStatusMutation.mutate({ id: transfer.id, status: 'failed' })}
                            title="Mark failed"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New Deposit Transfer</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div>
              <Label>Tenancy ID <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                value={form.tenancyId}
                onChange={e => setForm(f => ({ ...f, tenancyId: e.target.value }))}
              />
            </div>
            <div>
              <Label>Tenant ID (optional)</Label>
              <Input
                type="number"
                value={form.tenantId}
                onChange={e => setForm(f => ({ ...f, tenantId: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <Label>Direction <span className="text-red-500">*</span></Label>
              <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out_to_scheme">Out to Scheme</SelectItem>
                  <SelectItem value="in_from_scheme">In from Scheme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount (£) <span className="text-red-500">*</span></Label>
              <Input
                type="number"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Transfer Date <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                value={form.transferDate}
                onChange={e => setForm(f => ({ ...f, transferDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>From Account</Label>
              <Input
                value={form.fromAccount}
                onChange={e => setForm(f => ({ ...f, fromAccount: e.target.value }))}
                placeholder="e.g. Client Account"
              />
            </div>
            <div>
              <Label>To Account</Label>
              <Input
                value={form.toAccount}
                onChange={e => setForm(f => ({ ...f, toAccount: e.target.value }))}
                placeholder="e.g. TDS"
              />
            </div>
            <div>
              <Label>Scheme Name</Label>
              <Select value={form.schemeName} onValueChange={v => setForm(f => ({ ...f, schemeName: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scheme..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TDS">TDS</SelectItem>
                  <SelectItem value="DPS">DPS</SelectItem>
                  <SelectItem value="MyDeposits">MyDeposits</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reference</Label>
              <Input
                value={form.reference}
                onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
                placeholder="Scheme reference no."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#791E75] hover:bg-[#5a1557]"
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating...' : 'Create Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
