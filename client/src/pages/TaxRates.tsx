import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Percent, Plus, Pencil, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const BRAND = '#791E75';

interface TaxRate {
  id: number;
  name: string;
  rate: string;
  tax_type: string | null;
  is_default: boolean;
  is_active: boolean;
  description: string | null;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  updated_at: string;
}

interface TaxRateForm {
  name: string;
  rate: string;
  tax_type: string;
  is_default: boolean;
  description: string;
  effective_from: string;
  effective_to: string;
}

const emptyForm: TaxRateForm = {
  name: '',
  rate: '',
  tax_type: 'vat',
  is_default: false,
  description: '',
  effective_from: '',
  effective_to: '',
};

export default function TaxRates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<TaxRateForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  const { data: taxRates = [], isLoading, error } = useQuery<TaxRate[]>({
    queryKey: ['/api/crm/accounting/tax-rates'],
  });

  const handleCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const handleEdit = (rate: TaxRate) => {
    setEditingId(rate.id);
    setForm({
      name: rate.name,
      rate: rate.rate,
      tax_type: rate.tax_type || 'vat',
      is_default: rate.is_default,
      description: rate.description || '',
      effective_from: rate.effective_from ? rate.effective_from.split('T')[0] : '',
      effective_to: rate.effective_to ? rate.effective_to.split('T')[0] : '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.rate) {
      toast({ title: 'Missing fields', description: 'Name and rate are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name,
        rate: form.rate,
        tax_type: form.tax_type || null,
        is_default: form.is_default,
        description: form.description || null,
        effective_from: form.effective_from || null,
        effective_to: form.effective_to || null,
      };
      if (editingId) {
        await apiRequest('PUT', `/api/crm/accounting/tax-rates/${editingId}`, body);
        toast({ title: 'Tax rate updated' });
      } else {
        await apiRequest('POST', '/api/crm/accounting/tax-rates', body);
        toast({ title: 'Tax rate created' });
      }
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/tax-rates'] });
      setDialogOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/crm/accounting/tax-rates/${id}`);
      toast({ title: 'Tax rate deactivated' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/tax-rates'] });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-destructive font-medium">Failed to load tax rates</p>
      </div>
    );
  }

  const activeRates = taxRates.filter(r => r.is_active);
  const inactiveRates = taxRates.filter(r => !r.is_active);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRAND }}>Tax Rates</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage VAT and tax rates for invoices and journal entries</p>
        </div>
        <Button onClick={handleCreate} className="gap-2" style={{ backgroundColor: BRAND }}>
          <Plus className="h-4 w-4" /> Add Tax Rate
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Active Tax Rates ({activeRates.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeRates.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Percent className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No active tax rates</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Default</TableHead>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Effective To</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeRates.map((rate) => (
                  <TableRow key={rate.id}>
                    <TableCell className="font-medium">{rate.name}</TableCell>
                    <TableCell className="font-mono">{parseFloat(rate.rate).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">
                        {rate.tax_type || 'other'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {rate.is_default && (
                        <Badge className="text-xs" style={{ backgroundColor: BRAND }}>Default</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rate.effective_from ? new Date(rate.effective_from).toLocaleDateString('en-GB') : '-'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rate.effective_to ? new Date(rate.effective_to).toLocaleDateString('en-GB') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(rate)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeactivate(rate.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {inactiveRates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Inactive Tax Rates ({inactiveRates.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveRates.map((rate) => (
                  <TableRow key={rate.id} className="opacity-50">
                    <TableCell>{rate.name}</TableCell>
                    <TableCell className="font-mono">{parseFloat(rate.rate).toFixed(2)}%</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{rate.tax_type || 'other'}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Tax Rate' : 'Create Tax Rate'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Standard VAT" />
            </div>
            <div>
              <Label>Rate (%) *</Label>
              <Input type="number" step="0.01" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} placeholder="e.g. 20.00" />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={form.tax_type} onValueChange={(v) => setForm({ ...form, tax_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vat">VAT</SelectItem>
                  <SelectItem value="corporation">Corporation Tax</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_default} onCheckedChange={(v) => setForm({ ...form, is_default: v })} />
              <Label>Set as default tax rate</Label>
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Effective From</Label>
                <Input type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
              </div>
              <div>
                <Label>Effective To</Label>
                <Input type="date" value={form.effective_to} onChange={(e) => setForm({ ...form, effective_to: e.target.value })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} style={{ backgroundColor: BRAND }}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
