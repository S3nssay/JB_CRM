import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Plus, CheckCircle, XCircle, ChevronLeft, Building2 } from 'lucide-react';

const formatPence = (pence: number | null | undefined) => {
  if (pence === null || pence === undefined) return '£0.00';
  return `£${(Number(pence) / 100).toFixed(2)}`;
};

interface OverseasLandlord {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  overseas_address: string | null;
  overseas_country: string | null;
  tax_percentage: string | null;
  tax_exemption_certificate_no: string | null;
  tax_exemption_start_date: string | null;
  tax_exemption_end_date: string | null;
  status: string;
}

interface TaxDeduction {
  id: number;
  landlord_id: number;
  property_id: number | null;
  landlord_name: string;
  property_address: string | null;
  tax_period_start: string;
  tax_period_end: string;
  rent_collected: number;
  tax_rate: string;
  tax_deducted: number;
  net_paid_to_landlord: number;
  remitted_to_hmrc: boolean;
  remitted_date: string | null;
  hmrc_reference: string | null;
  notes: string | null;
}

interface Property {
  id: number;
  address: string;
}

export default function OverseasTaxManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedLandlord, setSelectedLandlord] = useState<OverseasLandlord | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remitDialogOpen, setRemitDialogOpen] = useState(false);
  const [remitTarget, setRemitTarget] = useState<TaxDeduction | null>(null);
  const [hmrcRef, setHmrcRef] = useState('');
  const [remittedDate, setRemittedDate] = useState('');

  // Deduction form state
  const [form, setForm] = useState({
    landlordId: '',
    propertyId: '',
    taxPeriodStart: '',
    taxPeriodEnd: '',
    rentCollected: '',
    taxRate: '20',
    taxDeducted: '',
    netPaidToLandlord: '',
    notes: '',
  });

  const { data: landlords = [], isLoading: landlordsLoading } = useQuery<OverseasLandlord[]>({
    queryKey: ['/api/crm/overseas-landlords'],
    queryFn: () => apiRequest('GET', '/api/crm/overseas-landlords').then(r => r.json()),
  });

  const { data: deductions = [], isLoading: deductionsLoading } = useQuery<TaxDeduction[]>({
    queryKey: ['/api/crm/tax-deductions', selectedLandlord?.id],
    queryFn: () => apiRequest('GET', `/api/crm/tax-deductions${selectedLandlord ? `?landlordId=${selectedLandlord.id}` : ''}`).then(r => r.json()),
    enabled: true,
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/crm/properties-list'],
    queryFn: () => apiRequest('GET', '/api/crm/properties').then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/crm/tax-deductions', data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tax-deductions'] });
      toast({ title: 'Deduction recorded' });
      setDialogOpen(false);
      resetForm();
    },
    onError: () => toast({ title: 'Error', description: 'Failed to record deduction.', variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => apiRequest('PUT', `/api/crm/tax-deductions/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tax-deductions'] });
      toast({ title: 'Updated successfully' });
      setRemitDialogOpen(false);
      setRemitTarget(null);
    },
    onError: () => toast({ title: 'Error', description: 'Failed to update.', variant: 'destructive' }),
  });

  const resetForm = () => {
    setForm({ landlordId: '', propertyId: '', taxPeriodStart: '', taxPeriodEnd: '', rentCollected: '', taxRate: '20', taxDeducted: '', netPaidToLandlord: '', notes: '' });
  };

  const handleRentChange = (val: string) => {
    const rent = Number(val) || 0;
    const rate = Number(form.taxRate) || 0;
    const deducted = Math.round(rent * (rate / 100));
    const net = rent - deducted;
    setForm(p => ({ ...p, rentCollected: val, taxDeducted: String(deducted), netPaidToLandlord: String(net) }));
  };

  const handleRateChange = (val: string) => {
    const rent = Number(form.rentCollected) || 0;
    const rate = Number(val) || 0;
    const deducted = Math.round(rent * (rate / 100));
    const net = rent - deducted;
    setForm(p => ({ ...p, taxRate: val, taxDeducted: String(deducted), netPaidToLandlord: String(net) }));
  };

  const handleSubmit = () => {
    createMutation.mutate({
      landlordId: Number(form.landlordId),
      propertyId: form.propertyId ? Number(form.propertyId) : null,
      taxPeriodStart: form.taxPeriodStart,
      taxPeriodEnd: form.taxPeriodEnd,
      rentCollected: Number(form.rentCollected),
      taxRate: form.taxRate,
      taxDeducted: Number(form.taxDeducted),
      netPaidToLandlord: Number(form.netPaidToLandlord),
      notes: form.notes || null,
    });
  };

  const openRemitDialog = (deduction: TaxDeduction) => {
    setRemitTarget(deduction);
    setHmrcRef(deduction.hmrc_reference || '');
    setRemittedDate(deduction.remitted_date?.substring(0, 10) || new Date().toISOString().substring(0, 10));
    setRemitDialogOpen(true);
  };

  const handleMarkRemitted = () => {
    if (!remitTarget) return;
    updateMutation.mutate({
      id: remitTarget.id,
      data: {
        remittedToHmrc: true,
        remittedDate: remittedDate,
        hmrcReference: hmrcRef || null,
      },
    });
  };

  const isExempt = (landlord: OverseasLandlord) => {
    if (!landlord.tax_exemption_certificate_no) return false;
    const now = new Date();
    const start = landlord.tax_exemption_start_date ? new Date(landlord.tax_exemption_start_date) : null;
    const end = landlord.tax_exemption_end_date ? new Date(landlord.tax_exemption_end_date) : null;
    if (start && now < start) return false;
    if (end && now > end) return false;
    return true;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        {selectedLandlord && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedLandlord(null)} className="gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
        )}
        <div className="w-10 h-10 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
          <Globe className="h-5 w-5 text-[#791E75]" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {selectedLandlord ? `${selectedLandlord.name} — Tax Deductions` : 'Overseas Landlord Tax (NRLS)'}
          </h1>
          <p className="text-sm text-gray-500">
            {selectedLandlord
              ? `${selectedLandlord.overseas_country || 'Overseas'} | Tax rate: ${selectedLandlord.tax_percentage || 20}%`
              : 'Non-Resident Landlord Scheme — tax deduction tracking'}
          </p>
        </div>
        {selectedLandlord && (
          <div className="ml-auto">
            <Button
              onClick={() => { setForm(p => ({ ...p, landlordId: String(selectedLandlord.id) })); setDialogOpen(true); }}
              className="bg-[#791E75] hover:bg-[#5e1659] text-white gap-2"
            >
              <Plus className="h-4 w-4" />
              Record Deduction
            </Button>
          </div>
        )}
      </div>

      {!selectedLandlord ? (
        /* Overseas Landlords List */
        <>
          {landlordsLoading ? (
            <p className="text-gray-400 text-sm">Loading overseas landlords...</p>
          ) : landlords.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Globe className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No overseas landlords found.</p>
              <p className="text-xs mt-1">Mark landlords as overseas in the Landlord Management page.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {landlords.map(landlord => (
                <Card
                  key={landlord.id}
                  className="cursor-pointer hover:border-[#791E75] hover:shadow-md transition-all"
                  onClick={() => setSelectedLandlord(landlord)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-gray-400" />
                      {landlord.name}
                    </CardTitle>
                    <p className="text-xs text-gray-500">{landlord.overseas_country || 'Overseas'}</p>
                  </CardHeader>
                  <CardContent className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">Tax Rate</span>
                      <span className="font-medium">{landlord.tax_percentage || 20}%</span>
                    </div>
                    {isExempt(landlord) ? (
                      <div className="flex items-center gap-1 text-green-600 text-xs">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Exempt — Cert: {landlord.tax_exemption_certificate_no}
                      </div>
                    ) : landlord.tax_exemption_certificate_no ? (
                      <div className="flex items-center gap-1 text-amber-600 text-xs">
                        <XCircle className="h-3.5 w-3.5" />
                        Exemption expired
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-gray-400 text-xs">
                        No exemption
                      </div>
                    )}
                    <p className="text-gray-400 text-xs truncate">{landlord.overseas_address || landlord.address || '—'}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        /* Tax Deductions for Selected Landlord */
        <div className="border rounded-lg overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead>Tax Period</TableHead>
                <TableHead>Property</TableHead>
                <TableHead className="text-right">Rent Collected</TableHead>
                <TableHead className="text-right">Tax Rate</TableHead>
                <TableHead className="text-right">Tax Deducted</TableHead>
                <TableHead className="text-right">Net Paid</TableHead>
                <TableHead>Remitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deductionsLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-400">Loading...</TableCell>
                </TableRow>
              ) : deductions.filter(d => d.landlord_id === selectedLandlord.id).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-400">No tax deductions recorded for this landlord</TableCell>
                </TableRow>
              ) : (
                deductions
                  .filter(d => d.landlord_id === selectedLandlord.id)
                  .map(d => (
                    <TableRow key={d.id} className="hover:bg-gray-50">
                      <TableCell className="text-sm">
                        <div>{d.tax_period_start ? new Date(d.tax_period_start).toLocaleDateString('en-GB') : '—'}</div>
                        <div className="text-gray-400 text-xs">to {d.tax_period_end ? new Date(d.tax_period_end).toLocaleDateString('en-GB') : '—'}</div>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">{d.property_address || '—'}</TableCell>
                      <TableCell className="text-right">{formatPence(d.rent_collected)}</TableCell>
                      <TableCell className="text-right">{d.tax_rate}%</TableCell>
                      <TableCell className="text-right text-red-600">{formatPence(d.tax_deducted)}</TableCell>
                      <TableCell className="text-right text-green-700">{formatPence(d.net_paid_to_landlord)}</TableCell>
                      <TableCell>
                        {d.remitted_to_hmrc ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle className="h-3 w-3" /> Remitted
                            </span>
                            {d.remitted_date && <p className="text-xs text-gray-400 mt-0.5">{new Date(d.remitted_date).toLocaleDateString('en-GB')}</p>}
                            {d.hmrc_reference && <p className="text-xs text-gray-400">{d.hmrc_reference}</p>}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3" /> Not Remitted
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {!d.remitted_to_hmrc && (
                          <Button variant="outline" size="sm" onClick={() => openRemitDialog(d)} className="text-xs">
                            Mark Remitted
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Record Deduction Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Tax Deduction</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Overseas Landlord *</Label>
              <Select value={form.landlordId} onValueChange={v => {
                const landlord = landlords.find(l => String(l.id) === v);
                setForm(p => ({ ...p, landlordId: v, taxRate: landlord?.tax_percentage || '20' }));
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select landlord" />
                </SelectTrigger>
                <SelectContent>
                  {landlords.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Property</Label>
              <Select value={form.propertyId} onValueChange={v => setForm(p => ({ ...p, propertyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select property (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No specific property</SelectItem>
                  {properties.map((prop: Property) => (
                    <SelectItem key={prop.id} value={String(prop.id)}>{prop.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Period Start *</Label>
                <Input type="date" value={form.taxPeriodStart} onChange={e => setForm(p => ({ ...p, taxPeriodStart: e.target.value }))} />
              </div>
              <div>
                <Label>Period End *</Label>
                <Input type="date" value={form.taxPeriodEnd} onChange={e => setForm(p => ({ ...p, taxPeriodEnd: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Rent Collected (pence) *</Label>
              <Input type="number" min="0" value={form.rentCollected} onChange={e => handleRentChange(e.target.value)} placeholder="e.g. 150000 for £1,500.00" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Tax Rate (%)</Label>
                <Input type="number" min="0" max="100" value={form.taxRate} onChange={e => handleRateChange(e.target.value)} />
              </div>
              <div>
                <Label>Tax Deducted (pence)</Label>
                <Input type="number" value={form.taxDeducted} readOnly className="bg-gray-50" />
              </div>
              <div>
                <Label>Net Paid (pence)</Label>
                <Input type="number" value={form.netPaidToLandlord} readOnly className="bg-gray-50" />
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={!form.landlordId || !form.taxPeriodStart || !form.taxPeriodEnd || !form.rentCollected || createMutation.isPending}
              className="bg-[#791E75] hover:bg-[#5e1659] text-white"
            >
              Record Deduction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark as Remitted Dialog */}
      <Dialog open={remitDialogOpen} onOpenChange={setRemitDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Mark as Remitted to HMRC</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              Confirm that the tax deduction of {formatPence(remitTarget?.tax_deducted)} has been remitted to HMRC.
            </p>
            <div>
              <Label>Remitted Date</Label>
              <Input type="date" value={remittedDate} onChange={e => setRemittedDate(e.target.value)} />
            </div>
            <div>
              <Label>HMRC Reference (optional)</Label>
              <Input value={hmrcRef} onChange={e => setHmrcRef(e.target.value)} placeholder="HMRC payment reference" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemitDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleMarkRemitted}
              disabled={!remittedDate || updateMutation.isPending}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Confirm Remittance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
