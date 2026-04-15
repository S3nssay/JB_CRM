import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Shield, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, differenceInDays, isPast, parseISO } from 'date-fns';

interface InsuranceRecord {
  id: number;
  insuranceType: string;
  provider: string;
  policyNumber?: string;
  expiryDate?: string;
  premium?: number;
  excess?: number;
  coverDescription?: string;
  providerPhone?: string;
  providerEmail?: string;
  notes?: string;
}

function expiryBadge(expiryDate?: string) {
  if (!expiryDate) return null;
  const date = parseISO(expiryDate);
  const days = differenceInDays(date, new Date());
  if (isPast(date)) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (days < 30) {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Expires in {days}d</Badge>;
  }
  return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Valid</Badge>;
}

const INSURANCE_TYPES = [
  { value: 'buildings', label: 'Buildings' },
  { value: 'contents', label: 'Contents' },
  { value: 'landlord', label: 'Landlord' },
  { value: 'rent_guarantee', label: 'Rent Guarantee' },
  { value: 'legal_expenses', label: 'Legal Expenses' },
];

const emptyForm = {
  insuranceType: '',
  provider: '',
  policyNumber: '',
  expiryDate: '',
  premium: '',
  excess: '',
  coverDescription: '',
  providerPhone: '',
  providerEmail: '',
  notes: '',
};

interface Props {
  propertyId: number;
}

export default function PropertyInsuranceSection({ propertyId }: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: records = [], isLoading } = useQuery<InsuranceRecord[]>({
    queryKey: [`/api/crm/properties/${propertyId}/insurance`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/insurance`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', `/api/crm/properties/${propertyId}/insurance`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/insurance`] });
      toast({ title: 'Insurance record added' });
      closeDialog();
    },
    onError: () => toast({ title: 'Failed to save insurance record', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest('PUT', `/api/crm/insurance/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/insurance`] });
      toast({ title: 'Insurance record updated' });
      closeDialog();
    },
    onError: () => toast({ title: 'Failed to update insurance record', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/insurance/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/insurance`] });
      toast({ title: 'Insurance record deleted' });
    },
    onError: () => toast({ title: 'Failed to delete insurance record', variant: 'destructive' }),
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(r: InsuranceRecord) {
    setEditingId(r.id);
    setForm({
      insuranceType: r.insuranceType || '',
      provider: r.provider || '',
      policyNumber: r.policyNumber || '',
      expiryDate: r.expiryDate ? r.expiryDate.slice(0, 10) : '',
      premium: r.premium != null ? String(r.premium) : '',
      excess: r.excess != null ? String(r.excess) : '',
      coverDescription: r.coverDescription || '',
      providerPhone: r.providerPhone || '',
      providerEmail: r.providerEmail || '',
      notes: r.notes || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function handleSubmit() {
    const payload = {
      ...form,
      premium: form.premium ? parseFloat(form.premium) : null,
      excess: form.excess ? parseFloat(form.excess) : null,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[#791E75]" />
            Insurance
          </CardTitle>
          <Button size="sm" onClick={openAdd} className="bg-[#791E75] hover:bg-[#60175d]">
            <Plus className="h-4 w-4 mr-1" />
            Add Insurance
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No insurance records yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Policy #</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Premium</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="capitalize">{r.insuranceType?.replace('_', ' ')}</TableCell>
                  <TableCell>{r.provider}</TableCell>
                  <TableCell>{r.policyNumber || '—'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {r.expiryDate ? format(parseISO(r.expiryDate), 'dd MMM yyyy') : '—'}
                      {expiryBadge(r.expiryDate)}
                    </div>
                  </TableCell>
                  <TableCell>{r.premium != null ? `£${r.premium.toLocaleString()}` : '—'}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => deleteMutation.mutate(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Insurance' : 'Add Insurance'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={form.insuranceType} onValueChange={(v) => setForm((f) => ({ ...f, insuranceType: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {INSURANCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Provider</Label>
              <Input value={form.provider} onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Policy Number</Label>
                <Input value={form.policyNumber} onChange={(e) => setForm((f) => ({ ...f, policyNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => setForm((f) => ({ ...f, expiryDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Annual Premium (£)</Label>
                <Input type="number" value={form.premium} onChange={(e) => setForm((f) => ({ ...f, premium: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Excess (£)</Label>
                <Input type="number" value={form.excess} onChange={(e) => setForm((f) => ({ ...f, excess: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Cover Description</Label>
              <Input value={form.coverDescription} onChange={(e) => setForm((f) => ({ ...f, coverDescription: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Provider Phone</Label>
                <Input value={form.providerPhone} onChange={(e) => setForm((f) => ({ ...f, providerPhone: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Provider Email</Label>
                <Input type="email" value={form.providerEmail} onChange={(e) => setForm((f) => ({ ...f, providerEmail: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving || !form.insuranceType || !form.provider} className="bg-[#791E75] hover:bg-[#60175d]">
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
