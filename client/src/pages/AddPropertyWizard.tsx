import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useSearch } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stepper } from '@/components/ui/stepper';
import { Home, Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const STEPS = [
  { key: 'address', label: 'Address' },
  { key: 'details', label: 'Details' },
  { key: 'letting', label: 'Letting & Management' },
  { key: 'review', label: 'Review' },
];
const TYPES = ['flat', 'house', 'studio', 'maisonette', 'bungalow', 'commercial'];
const gbp = (p: string) => (p ? `£${Number(p).toLocaleString()}` : '—');

interface Landlord { id: number; name: string; }

export default function AddPropertyWizard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const preLandlord = new URLSearchParams(searchStr).get('landlordId') || '';
  const [step, setStep] = useState(0);
  const [f, setF] = useState<any>({
    addressLine1: '', addressLine2: '', city: 'London', postcode: '',
    propertyType: 'flat', bedrooms: '1', bathrooms: '1', receptions: '', tenure: 'leasehold',
    title: '', description: '', keyCode: '',
    isManaged: true, landlordId: preLandlord, rentAmount: '', rentPeriod: 'per_month', deposit: '',
    price: '', furnished: 'furnished', managementType: 'full', managementFeeValue: '',
  });
  const set = (k: string, v: any) => setF((s: any) => ({ ...s, [k]: v }));

  const { data: landlords = [] } = useQuery<Landlord[]>({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => { const r = await fetch('/api/crm/landlords', { credentials: 'include' }); return r.ok ? r.json() : []; },
  });

  const toPence = (v: string) => (v ? Math.round(parseFloat(v) * 100) : 0);

  const save = useMutation({
    mutationFn: () => {
      const title = f.title.trim() || `${f.addressLine1}${f.addressLine2 ? ', ' + f.addressLine2 : ''}`.trim();
      const description = f.description.trim() || `${f.bedrooms} bedroom ${f.propertyType} in ${f.city || 'London'}`;
      return apiRequest('/api/crm/properties', 'POST', {
        title, description,
        addressLine1: f.addressLine1.trim(), addressLine2: f.addressLine2 || null, city: f.city || 'London', postcode: f.postcode.trim().toUpperCase(),
        propertyType: f.propertyType, bedrooms: parseInt(f.bedrooms) || 0, bathrooms: parseInt(f.bathrooms) || 0,
        receptions: f.receptions ? parseInt(f.receptions) : null, tenure: f.tenure,
        price: toPence(f.price), rentAmount: toPence(f.rentAmount), rentPeriod: f.rentPeriod, deposit: toPence(f.deposit),
        furnished: f.furnished, keyCode: f.keyCode || null,
        isResidential: f.propertyType !== 'commercial', isRental: true, isManaged: f.isManaged, isListed: false,
        landlordId: f.landlordId ? parseInt(f.landlordId) : null,
        managementType: f.isManaged ? f.managementType : null,
        managementFeeType: f.isManaged && f.managementFeeValue ? 'percentage' : null,
        managementFeeValue: f.isManaged && f.managementFeeValue ? f.managementFeeValue : null,
      });
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/managed-properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      toast({ title: 'Property created', description: f.addressLine1 });
      setLocation(r?.id ? `/crm/managed-property/${r.id}` : '/crm/locator');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const canNext = step === 0 ? (f.addressLine1.trim() && f.postcode.trim()) : true;
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));
  const landlordName = landlords.find((l) => String(l.id) === String(f.landlordId))?.name;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Home className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Property</h1>
          <p className="text-sm text-gray-500">Register a property</p>
        </div>
      </div>

      <Stepper steps={STEPS} current={step} onStepClick={setStep} />

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Address line 1 *</Label><Input value={f.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} placeholder="e.g. Flat B, 34 Ashmore Road" /></div>
              <div className="col-span-2"><Label>Address line 2</Label><Input value={f.addressLine2} onChange={(e) => set('addressLine2', e.target.value)} /></div>
              <div><Label>City / borough</Label><Input value={f.city} onChange={(e) => set('city', e.target.value)} /></div>
              <div><Label>Postcode *</Label><Input value={f.postcode} onChange={(e) => set('postcode', e.target.value)} placeholder="W9 3DF" /></div>
              <div><Label>Key code</Label><Input value={f.keyCode} onChange={(e) => set('keyCode', e.target.value)} /></div>
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Property type</Label>
                <Select value={f.propertyType} onValueChange={(v) => set('propertyType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Tenure</Label>
                <Select value={f.tenure} onValueChange={(v) => set('tenure', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="leasehold">Leasehold</SelectItem><SelectItem value="freehold">Freehold</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Bedrooms</Label><Input type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} /></div>
              <div><Label>Bathrooms</Label><Input type="number" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} /></div>
              <div><Label>Receptions</Label><Input type="number" value={f.receptions} onChange={(e) => set('receptions', e.target.value)} /></div>
              <div><Label>Furnished</Label>
                <Select value={f.furnished} onValueChange={(v) => set('furnished', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="furnished">Furnished</SelectItem><SelectItem value="unfurnished">Unfurnished</SelectItem><SelectItem value="part_furnished">Part furnished</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2"><Label>Title (optional — defaults to the address)</Label><Input value={f.title} onChange={(e) => set('title', e.target.value)} /></div>
              <div className="col-span-2"><Label>Description (optional)</Label><Textarea value={f.description} onChange={(e) => set('description', e.target.value)} /></div>
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="managed" checked={f.isManaged} onChange={(e) => set('isManaged', e.target.checked)} className="h-4 w-4 accent-[#791E75]" />
                <Label htmlFor="managed" className="cursor-pointer">John Barclay managed property</Label>
              </div>
              <div className="col-span-2">
                <Label>Landlord</Label>
                <Select value={f.landlordId || 'none'} onValueChange={(v) => set('landlordId', v === 'none' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Select landlord" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {landlords.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Monthly rent (£)</Label><Input type="number" value={f.rentAmount} onChange={(e) => set('rentAmount', e.target.value)} /></div>
              <div><Label>Deposit (£)</Label><Input type="number" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} /></div>
              {f.isManaged && <div><Label>Management fee (%)</Label><Input type="number" value={f.managementFeeValue} onChange={(e) => set('managementFeeValue', e.target.value)} placeholder="13" /></div>}
              {f.isManaged && <div><Label>Service type</Label>
                <Select value={f.managementType} onValueChange={(v) => set('managementType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="full">Managed</SelectItem><SelectItem value="let_only">Let Only</SelectItem><SelectItem value="tenant_find">Tenant Find</SelectItem></SelectContent>
                </Select>
              </div>}
              <div className="col-span-2"><Label>Asking price / valuation (£)</Label><Input type="number" value={f.price} onChange={(e) => set('price', e.target.value)} placeholder="0 if N/A" /></div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2 text-sm">
              <Row label="Address" value={`${f.addressLine1}${f.addressLine2 ? ', ' + f.addressLine2 : ''}, ${f.postcode}`} />
              <Row label="Type" value={`${f.bedrooms} bed ${f.propertyType} · ${f.tenure}`} />
              {f.rentAmount && <Row label="Rent" value={`${gbp(f.rentAmount)} ${f.rentPeriod === 'per_week' ? 'pw' : 'pcm'}`} />}
              <Row label="Managed" value={f.isManaged ? `Yes — ${f.managementType}${f.managementFeeValue ? ` @ ${f.managementFeeValue}%` : ''}` : 'No'} />
              {landlordName && <Row label="Landlord" value={landlordName} />}
              {f.keyCode && <Row label="Key code" value={f.keyCode} />}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
        {step < STEPS.length - 1 ? (
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={next} disabled={!canNext}>Next <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={() => save.mutate()} disabled={save.isPending || !f.addressLine1.trim() || !f.postcode.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create property
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b py-1.5"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-900 text-right">{value}</span></div>;
}
