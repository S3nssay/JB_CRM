import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Banknote, Loader2, PoundSterling, Plus, Trash2, FileText, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const fmt = (p: number | null | undefined) => (p != null ? `£${(p / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '£0.00');
const firstOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const lastOfMonth = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10); };

const PAYMENT_METHODS = ['bank_transfer', 'cheque', 'on_line'];

interface DueRow {
  landlordId: number; landlordName: string; hasBankDetails: boolean; propertyCount: number;
  expectedRent: number; collected: number; fee: number; charges: number; repairs: number; tax: number; bbf: number; net: number;
}

export default function LandlordPaymentsWorkbench() {
  const { toast } = useToast();
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(lastOfMonth());
  const [openLandlord, setOpenLandlord] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('bank_transfer');
  const [showConfirm, setShowConfirm] = useState(false);
  const [generated, setGenerated] = useState<any | null>(null);
  const [showCharge, setShowCharge] = useState(false);
  const [chargeForm, setChargeForm] = useState({ description: '', amountNet: '', amountVat: '0', propertyId: '', chargeDate: new Date().toISOString().slice(0, 10) });

  const dueQ = useQuery<{ landlords: DueRow[] }>({
    queryKey: ['/api/crm/landlord-payments/due', from, to],
    queryFn: async () => {
      const res = await fetch(`/api/crm/landlord-payments/due?from=${from}&to=${to}`, { credentials: 'include' });
      if (!res.ok) return { landlords: [] };
      return res.json();
    },
  });

  const detailQ = useQuery<any>({
    queryKey: ['/api/crm/landlord-payments/detail', openLandlord, from, to],
    queryFn: async () => {
      const res = await fetch(`/api/crm/landlord-payments/${openLandlord}/detail?from=${from}&to=${to}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      return res.json();
    },
    enabled: !!openLandlord,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-payments/due'] });
    if (openLandlord) queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-payments/detail', openLandlord] });
  };

  const genMutation = useMutation({
    mutationFn: () => apiRequest(`/api/crm/landlord-payments/${openLandlord}/generate-statement`, 'POST', { from, to, paymentMethod }),
    onSuccess: (r: any) => { setGenerated(r); setShowConfirm(false); refresh(); toast({ title: `Statement ${r.statementNumber} generated`, description: `Net payable ${fmt(r.netPayable)}` }); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const commitMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/landlord-payments/statements/${id}/commit`, 'POST'),
    onSuccess: () => { toast({ title: 'Committed to ledgers' }); setGenerated((g: any) => ({ ...g, committed: true })); refresh(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const sendMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/landlord-payments/statements/${id}/send`, 'POST'),
    onSuccess: (r: any) => { toast({ title: 'Statement emailed', description: r.to }); setGenerated((g: any) => ({ ...g, sent: true })); },
    onError: (e: any) => toast({ title: 'Email failed', description: e.message, variant: 'destructive' }),
  });
  const payMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/landlord-payments/statements/${id}/pay`, 'POST', { paymentMethod }),
    onSuccess: () => { toast({ title: 'Marked as paid' }); setGenerated((g: any) => ({ ...g, paid: true })); refresh(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const addChargeMutation = useMutation({
    mutationFn: () => apiRequest('/api/crm/landlord-charges', 'POST', {
      landlordId: openLandlord, propertyId: chargeForm.propertyId || null, description: chargeForm.description,
      amountNet: Math.round(parseFloat(chargeForm.amountNet) * 100), amountVat: Math.round(parseFloat(chargeForm.amountVat || '0') * 100),
      chargeDate: chargeForm.chargeDate, onNextStatement: true,
    }),
    onSuccess: () => { toast({ title: 'Charge added to next statement' }); setShowCharge(false); setChargeForm({ description: '', amountNet: '', amountVat: '0', propertyId: '', chargeDate: new Date().toISOString().slice(0, 10) }); refresh(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
  const delChargeMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/landlord-charges/${id}`, 'DELETE'),
    onSuccess: () => { toast({ title: 'Charge removed' }); refresh(); },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const closeDrill = () => { setOpenLandlord(null); setGenerated(null); };
  const d = detailQ.data;
  const rows = dueQ.data?.landlords ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Banknote className="h-6 w-6 text-[#791E75]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Landlord Payments</h1>
            <p className="text-sm text-gray-500">Rent collected → statement → pay landlord (Workflow&nbsp;#2)</p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9" /></div>
          <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9" /></div>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {dueQ.isLoading ? (
            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#791E75]" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-gray-500">No managed landlords found for this period.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Landlord</TableHead>
                  <TableHead className="text-center">Props</TableHead>
                  <TableHead className="text-right">Expected</TableHead>
                  <TableHead className="text-right">Collected</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                  <TableHead className="text-right">Charges</TableHead>
                  <TableHead className="text-right">Net To Pay</TableHead>
                  <TableHead>Bank</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.landlordId} className="cursor-pointer hover:bg-gray-50" onClick={() => { setOpenLandlord(r.landlordId); setGenerated(null); }}>
                    <TableCell className="font-medium">{r.landlordName}</TableCell>
                    <TableCell className="text-center">{r.propertyCount}</TableCell>
                    <TableCell className="text-right text-gray-500">{fmt(r.expectedRent)}</TableCell>
                    <TableCell className="text-right">{fmt(r.collected)}</TableCell>
                    <TableCell className="text-right text-gray-500">{fmt(r.fee)}</TableCell>
                    <TableCell className="text-right text-gray-500">{fmt(r.charges + r.repairs)}</TableCell>
                    <TableCell className="text-right font-semibold">{fmt(r.net)}</TableCell>
                    <TableCell>{r.hasBankDetails ? <Badge className="bg-green-100 text-green-800 border-0 text-xs">On file</Badge> : <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Missing</Badge>}</TableCell>
                    <TableCell className="text-right"><Button size="sm" variant="ghost" className="h-7 gap-1 text-[#791E75]" onClick={(e) => { e.stopPropagation(); setOpenLandlord(r.landlordId); setGenerated(null); }}>Open</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Drill-in dialog */}
      <Dialog open={!!openLandlord} onOpenChange={(o) => !o && closeDrill()}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PoundSterling className="h-5 w-5 text-[#791E75]" /> {d?.landlord?.name ?? 'Landlord'} — Payment</DialogTitle>
            <DialogDescription>Period {from} → {to}</DialogDescription>
          </DialogHeader>

          {detailQ.isLoading || !d ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#791E75]" /></div>
          ) : (
            <div className="space-y-4">
              {/* Collections */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Collections this period</p>
                <Table>
                  <TableHeader><TableRow><TableHead>Property</TableHead><TableHead className="text-right">Collected</TableHead><TableHead className="text-right">Fee</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.properties.map((p: any) => (
                      <TableRow key={p.propertyId}>
                        <TableCell>{p.address}</TableCell>
                        <TableCell className="text-right">{fmt(p.collected)}<span className="text-xs text-gray-400"> / {fmt(p.rentAmount)}</span></TableCell>
                        <TableCell className="text-right text-gray-500">{fmt(p.fee)} <span className="text-xs">({p.feePct}%)</span></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Charges */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-500 uppercase">Charges this period (one-off → next statement)</p>
                  <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setShowCharge(true)}><Plus className="h-3.5 w-3.5" /> Add charge</Button>
                </div>
                {d.charges.length === 0 ? <p className="text-sm text-gray-400">No pending charges.</p> : (
                  <Table>
                    <TableBody>
                      {d.charges.map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell>{c.description}</TableCell>
                          <TableCell className="text-right text-red-600">-{fmt(c.amount)}</TableCell>
                          <TableCell className="text-right w-10"><Button size="icon" variant="ghost" className="h-6 w-6 text-red-500" onClick={() => delChargeMutation.mutate(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-1 text-sm">
                {d.bbf !== 0 && <div className="flex justify-between"><span>Balance brought forward</span><span>{fmt(d.bbf)}</span></div>}
                <div className="flex justify-between"><span>Rent collected</span><span>{fmt(d.collected)}</span></div>
                <div className="flex justify-between text-gray-500"><span>Management fee</span><span>-{fmt(d.fee)}</span></div>
                {d.chargesTotal > 0 && <div className="flex justify-between text-gray-500"><span>Charges</span><span>-{fmt(d.chargesTotal)}</span></div>}
                {d.repairsTotal > 0 && <div className="flex justify-between text-gray-500"><span>Repairs</span><span>-{fmt(d.repairsTotal)}</span></div>}
                {d.tax > 0 && <div className="flex justify-between text-gray-500"><span>NRL tax ({d.taxRate}%)</span><span>-{fmt(d.tax)}</span></div>}
                <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-200 mt-1"><span>Net to landlord</span><span className="text-[#791E75]">{fmt(d.net)}</span></div>
                {!d.landlord.hasBankDetails && <p className="text-xs text-amber-600 flex items-center gap-1 pt-1"><AlertTriangle className="h-3.5 w-3.5" /> No bank details on file for this landlord.</p>}
              </div>

              {/* Actions */}
              {!generated ? (
                <div className="flex items-center justify-end gap-2">
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m} className="capitalize">{m.replace('_', ' ')}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={() => setShowConfirm(true)}><FileText className="h-4 w-4" /> Generate Statement</Button>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-medium text-green-800 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> Statement {generated.statementNumber} — net {fmt(generated.netPayable)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" disabled={generated.committed} onClick={() => commitMutation.mutate(generated.statementId)}>{generated.committed ? 'Committed ✓' : 'Commit to ledgers'}</Button>
                    <Button size="sm" variant="outline" className="gap-1" disabled={generated.sent} onClick={() => sendMutation.mutate(generated.statementId)}><Send className="h-3.5 w-3.5" />{generated.sent ? 'Emailed ✓' : 'Email statement'}</Button>
                    <Button size="sm" className="gap-1 bg-[#791E75] hover:bg-[#5f1759]" disabled={generated.paid} onClick={() => payMutation.mutate(generated.statementId)}><PoundSterling className="h-3.5 w-3.5" />{generated.paid ? 'Paid ✓' : 'Mark paid'}</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm gate */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generate & commit statement?</DialogTitle>
            <DialogDescription>The sum of <b>{fmt(d?.net)}</b> will be recorded as payable to {d?.landlord?.name}. This creates a landlord statement and consumes any pending one-off charges.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={() => genMutation.mutate()} disabled={genMutation.isPending}>{genMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add one-off charge */}
      <Dialog open={showCharge} onOpenChange={setShowCharge}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Record Landlord Charge</DialogTitle>
            <DialogDescription>Adds a one-off charge that lands on the landlord's next statement.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Description *</Label><Input value={chargeForm.description} onChange={(e) => setChargeForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. EICR — 540B Harrow Road" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Net (£) *</Label><Input type="number" step="0.01" value={chargeForm.amountNet} onChange={(e) => setChargeForm((f) => ({ ...f, amountNet: e.target.value }))} /></div>
              <div><Label>VAT (£)</Label><Input type="number" step="0.01" value={chargeForm.amountVat} onChange={(e) => setChargeForm((f) => ({ ...f, amountVat: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Property (optional)</Label>
              <Select value={chargeForm.propertyId || 'none'} onValueChange={(v) => setChargeForm((f) => ({ ...f, propertyId: v === 'none' ? '' : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {(d?.properties ?? []).map((p: any) => <SelectItem key={p.propertyId} value={String(p.propertyId)}>{p.address}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Charge Date</Label><Input type="date" value={chargeForm.chargeDate} onChange={(e) => setChargeForm((f) => ({ ...f, chargeDate: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCharge(false)}>Cancel</Button>
            <Button className="bg-[#791E75] hover:bg-[#5f1759]" onClick={() => addChargeMutation.mutate()} disabled={addChargeMutation.isPending || !chargeForm.description || !chargeForm.amountNet}>Add charge</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
