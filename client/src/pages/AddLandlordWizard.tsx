import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Stepper } from '@/components/ui/stepper';
import { User, Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const STEPS = [
  { key: 'details', label: 'Details' },
  { key: 'bank', label: 'Bank' },
  { key: 'company', label: 'Company / Tax' },
  { key: 'review', label: 'Review' },
];

type Form = {
  name: string; landlordType: string; email: string; phone: string; mobile: string; addressLine1: string;
  bankName: string; bankAccountNumber: string; bankSortCode: string; bankAccountHolderName: string;
  companyName: string; companyRegNo: string; isOverseas: boolean; taxPercentage: string; taxExemptionCertificateNo: string;
  notes: string;
};
const empty: Form = {
  name: '', landlordType: 'individual', email: '', phone: '', mobile: '', addressLine1: '',
  bankName: '', bankAccountNumber: '', bankSortCode: '', bankAccountHolderName: '',
  companyName: '', companyRegNo: '', isOverseas: false, taxPercentage: '', taxExemptionCertificateNo: '', notes: '',
};

export default function AddLandlordWizard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(empty);
  const set = (k: keyof Form, v: any) => setF((s) => ({ ...s, [k]: v }));
  const isCompany = f.landlordType === 'company';

  const save = useMutation({
    mutationFn: () => apiRequest('/api/crm/landlords', 'POST', {
      name: f.name.trim(), landlordType: f.landlordType,
      email: f.email || null, phone: f.phone || null, mobile: f.mobile || null, addressLine1: f.addressLine1 || null,
      bankName: f.bankName || null, bankAccountNumber: f.bankAccountNumber || null,
      bankSortCode: f.bankSortCode || null, bankAccountHolderName: f.bankAccountHolderName || null,
      companyName: isCompany ? f.companyName || null : null, companyRegNo: isCompany ? f.companyRegNo || null : null,
      isOverseas: f.isOverseas, taxPercentage: f.taxPercentage || null, taxExemptionCertificateNo: f.taxExemptionCertificateNo || null,
      notes: f.notes || null,
    }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords'] });
      toast({ title: 'Landlord created', description: f.name });
      setLocation(r?.id ? `/crm/landlords/${r.id}` : '/crm/landlord-directory');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const canNext = step === 0 ? f.name.trim().length > 0 : true;
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <User className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Landlord</h1>
          <p className="text-sm text-gray-500">Register a new landlord</p>
        </div>
      </div>

      <Stepper steps={STEPS} current={step} onStepClick={setStep} />

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <Label>Landlord type</Label>
                <Select value={f.landlordType} onValueChange={(v) => set('landlordType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="company">Company</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>{isCompany ? 'Contact / trading name *' : 'Full name *'}</Label>
                <Input value={f.name} onChange={(e) => set('name', e.target.value)} placeholder={isCompany ? 'e.g. Haab Mortgage' : 'e.g. Mr Moydul Hoque'} />
              </div>
              <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div><Label>Mobile</Label><Input value={f.mobile} onChange={(e) => set('mobile', e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              <div className="col-span-2"><Label>Address</Label><Input value={f.addressLine1} onChange={(e) => set('addressLine1', e.target.value)} /></div>
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Bank name</Label><Input value={f.bankName} onChange={(e) => set('bankName', e.target.value)} placeholder="e.g. Bank of Scotland" /></div>
              <div><Label>Sort code</Label><Input value={f.bankSortCode} onChange={(e) => set('bankSortCode', e.target.value)} placeholder="00-00-00" /></div>
              <div><Label>Account number</Label><Input value={f.bankAccountNumber} onChange={(e) => set('bankAccountNumber', e.target.value)} /></div>
              <div className="col-span-2"><Label>Account holder name</Label><Input value={f.bankAccountHolderName} onChange={(e) => set('bankAccountHolderName', e.target.value)} /></div>
              <p className="col-span-2 text-xs text-gray-400">Used for landlord statement payouts. You can add this later too.</p>
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              {isCompany && <>
                <div><Label>Company name</Label><Input value={f.companyName} onChange={(e) => set('companyName', e.target.value)} /></div>
                <div><Label>Company reg. no</Label><Input value={f.companyRegNo} onChange={(e) => set('companyRegNo', e.target.value)} /></div>
              </>}
              <div className="col-span-2 flex items-center gap-2 pt-1">
                <input type="checkbox" id="overseas" checked={f.isOverseas} onChange={(e) => set('isOverseas', e.target.checked)} className="h-4 w-4 accent-[#791E75]" />
                <Label htmlFor="overseas" className="cursor-pointer">Non-resident / overseas landlord (NRL tax)</Label>
              </div>
              {f.isOverseas && <>
                <div><Label>Tax %</Label><Input type="number" value={f.taxPercentage} onChange={(e) => set('taxPercentage', e.target.value)} placeholder="20" /></div>
                <div><Label>NRL exemption cert. no</Label><Input value={f.taxExemptionCertificateNo} onChange={(e) => set('taxExemptionCertificateNo', e.target.value)} /></div>
              </>}
              <div className="col-span-2"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2 text-sm">
              <Row label="Type" value={isCompany ? 'Company' : 'Individual'} />
              <Row label="Name" value={f.name} />
              {f.email && <Row label="Email" value={f.email} />}
              {(f.mobile || f.phone) && <Row label="Phone" value={f.mobile || f.phone} />}
              {f.addressLine1 && <Row label="Address" value={f.addressLine1} />}
              {(f.bankName || f.bankAccountNumber) && <Row label="Bank" value={`${f.bankName} ${f.bankSortCode} ${f.bankAccountNumber}`.trim()} />}
              {isCompany && f.companyName && <Row label="Company" value={`${f.companyName} ${f.companyRegNo}`.trim()} />}
              {f.isOverseas && <Row label="Overseas" value={`Yes${f.taxPercentage ? ` — ${f.taxPercentage}% tax` : ''}`} />}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
        {step < STEPS.length - 1 ? (
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={next} disabled={!canNext}>Next <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={() => save.mutate()} disabled={save.isPending || !f.name.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create landlord
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b py-1.5"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-900 text-right">{value}</span></div>;
}
