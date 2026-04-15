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
import { Textarea } from '@/components/ui/textarea';
import { Flame, Plus, Pencil, Trash2 } from 'lucide-react';
import { format, differenceInDays, isPast, parseISO } from 'date-fns';

interface BoilerRecord {
  id: number;
  make?: string;
  model?: string;
  fuelType?: string;
  serialNumber?: string;
  installationDate?: string;
  lastServiceDate?: string;
  nextServiceDue?: string;
  warrantyExpiry?: string;
  location?: string;
  notes?: string;
}

function dateBadge(dateStr?: string, label?: string) {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  const days = differenceInDays(date, new Date());
  if (isPast(date)) {
    return <Badge variant="destructive">{label || 'Overdue'}</Badge>;
  }
  if (days < 30) {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Due in {days}d</Badge>;
  }
  return <Badge variant="default" className="bg-green-600 hover:bg-green-700">OK</Badge>;
}

const FUEL_TYPES = ['gas', 'oil', 'electric', 'lpg', 'biomass', 'heat_pump', 'other'];

const emptyForm = {
  make: '',
  model: '',
  fuelType: '',
  serialNumber: '',
  installationDate: '',
  lastServiceDate: '',
  nextServiceDue: '',
  warrantyExpiry: '',
  location: '',
  notes: '',
};

interface Props {
  propertyId: number;
}

export default function BoilerInformationSection({ propertyId }: Props) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const { data: boilers = [], isLoading } = useQuery<BoilerRecord[]>({
    queryKey: [`/api/crm/properties/${propertyId}/boilers`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/boilers`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!propertyId,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest('POST', `/api/crm/properties/${propertyId}/boilers`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/boilers`] });
      toast({ title: 'Boiler added' });
      closeDialog();
    },
    onError: () => toast({ title: 'Failed to save boiler', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest('PUT', `/api/crm/boilers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/boilers`] });
      toast({ title: 'Boiler updated' });
      closeDialog();
    },
    onError: () => toast({ title: 'Failed to update boiler', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/boilers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/boilers`] });
      toast({ title: 'Boiler deleted' });
    },
    onError: () => toast({ title: 'Failed to delete boiler', variant: 'destructive' }),
  });

  function openAdd() {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  }

  function openEdit(b: BoilerRecord) {
    setEditingId(b.id);
    setForm({
      make: b.make || '',
      model: b.model || '',
      fuelType: b.fuelType || '',
      serialNumber: b.serialNumber || '',
      installationDate: b.installationDate ? b.installationDate.slice(0, 10) : '',
      lastServiceDate: b.lastServiceDate ? b.lastServiceDate.slice(0, 10) : '',
      nextServiceDue: b.nextServiceDue ? b.nextServiceDue.slice(0, 10) : '',
      warrantyExpiry: b.warrantyExpiry ? b.warrantyExpiry.slice(0, 10) : '',
      location: b.location || '',
      notes: b.notes || '',
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
  }

  function handleSubmit() {
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-[#791E75]" />
            Boiler Information
          </CardTitle>
          <Button size="sm" onClick={openAdd} className="bg-[#791E75] hover:bg-[#60175d]">
            <Plus className="h-4 w-4 mr-1" />
            Add Boiler
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : boilers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No boiler records yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {boilers.map((b) => (
              <div key={b.id} className="border rounded-lg p-4 space-y-3 relative">
                <div className="absolute top-3 right-3 flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => deleteMutation.mutate(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <p className="font-semibold text-sm">{[b.make, b.model].filter(Boolean).join(' ') || 'Unknown Boiler'}</p>
                  {b.fuelType && (
                    <Badge variant="outline" className="mt-1 capitalize text-xs">
                      {b.fuelType.replace('_', ' ')}
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                  {b.serialNumber && <div><span className="font-medium">Serial:</span> {b.serialNumber}</div>}
                  {b.location && <div><span className="font-medium">Location:</span> {b.location}</div>}
                  {b.installationDate && (
                    <div><span className="font-medium">Installed:</span> {format(parseISO(b.installationDate), 'dd MMM yyyy')}</div>
                  )}
                  {b.lastServiceDate && (
                    <div><span className="font-medium">Last Service:</span> {format(parseISO(b.lastServiceDate), 'dd MMM yyyy')}</div>
                  )}
                </div>
                {b.nextServiceDue && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">Next Service: {format(parseISO(b.nextServiceDue), 'dd MMM yyyy')}</span>
                    {dateBadge(b.nextServiceDue, 'Overdue')}
                  </div>
                )}
                {b.warrantyExpiry && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-600">Warranty: {format(parseISO(b.warrantyExpiry), 'dd MMM yyyy')}</span>
                    {dateBadge(b.warrantyExpiry, 'Expired')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Boiler' : 'Add Boiler'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Make</Label>
                <Input value={form.make} onChange={(e) => setForm((f) => ({ ...f, make: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fuel Type</Label>
              <Select value={form.fuelType} onValueChange={(v) => setForm((f) => ({ ...f, fuelType: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fuel type" />
                </SelectTrigger>
                <SelectContent>
                  {FUEL_TYPES.map((t) => (
                    <SelectItem key={t} value={t} className="capitalize">{t.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Serial Number</Label>
                <Input value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Kitchen cupboard" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Installation Date</Label>
                <Input type="date" value={form.installationDate} onChange={(e) => setForm((f) => ({ ...f, installationDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Last Service Date</Label>
                <Input type="date" value={form.lastServiceDate} onChange={(e) => setForm((f) => ({ ...f, lastServiceDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Next Service Due</Label>
                <Input type="date" value={form.nextServiceDue} onChange={(e) => setForm((f) => ({ ...f, nextServiceDue: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Warranty Expiry</Label>
                <Input type="date" value={form.warrantyExpiry} onChange={(e) => setForm((f) => ({ ...f, warrantyExpiry: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={isSaving} className="bg-[#791E75] hover:bg-[#60175d]">
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
