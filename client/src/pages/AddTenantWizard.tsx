import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Stepper } from '@/components/ui/stepper';
import { Users, Loader2, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const STEPS = [
  { key: 'personal', label: 'Personal' },
  { key: 'employment', label: 'Employment' },
  { key: 'emergency', label: 'Emergency' },
  { key: 'review', label: 'Review' },
];

type Form = {
  fullName: string; email: string; phone: string; mobile: string; address: string;
  employer: string; jobTitle: string; annualIncome: string;
  emergencyContactName: string; emergencyContactPhone: string;
  notes: string; sendVerification: boolean;
};
const empty: Form = {
  fullName: '', email: '', phone: '', mobile: '', address: '',
  employer: '', jobTitle: '', annualIncome: '',
  emergencyContactName: '', emergencyContactPhone: '', notes: '', sendVerification: false,
};

export default function AddTenantWizard() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(empty);
  const set = (k: keyof Form, v: any) => setF((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: () => apiRequest('/api/crm/tenants', 'POST', {
      fullName: f.fullName.trim(), email: f.email || null, phone: f.phone || null, mobile: f.mobile || null, address: f.address || null,
      employer: f.employer || null, jobTitle: f.jobTitle || null, annualIncome: f.annualIncome ? Math.round(parseFloat(f.annualIncome)) : null,
      emergencyContactName: f.emergencyContactName || null, emergencyContactPhone: f.emergencyContactPhone || null,
      notes: f.notes || null, sendVerification: f.sendVerification,
    }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenants'] });
      toast({ title: 'Tenant created', description: f.fullName });
      setLocation(r?.id ? `/crm/tenant/${r.id}` : '/crm/tenants');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const canNext = step === 0 ? f.fullName.trim().length > 0 : true;
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Users className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Add Tenant</h1>
          <p className="text-sm text-gray-500">Register a new tenant (link to a property via tenancy setup later)</p>
        </div>
      </div>

      <Stepper steps={STEPS} current={step} onStepClick={setStep} />

      <Card>
        <CardContent className="p-6 space-y-4">
          {step === 0 && (
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2"><Label>Full name / company *</Label><Input value={f.fullName} onChange={(e) => set('fullName', e.target.value)} placeholder="e.g. 74 UK Property Ltd or Mr Ali Jabr" /></div>
              <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
              <div><Label>Mobile</Label><Input value={f.mobile} onChange={(e) => set('mobile', e.target.value)} /></div>
              <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => set('phone', e.target.value)} /></div>
              <div className="col-span-2"><Label>Previous / correspondence address</Label><Input value={f.address} onChange={(e) => set('address', e.target.value)} /></div>
            </div>
          )}
          {step === 1 && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Employer</Label><Input value={f.employer} onChange={(e) => set('employer', e.target.value)} /></div>
              <div><Label>Job title</Label><Input value={f.jobTitle} onChange={(e) => set('jobTitle', e.target.value)} /></div>
              <div><Label>Annual income (£)</Label><Input type="number" value={f.annualIncome} onChange={(e) => set('annualIncome', e.target.value)} /></div>
              <p className="col-span-2 text-xs text-gray-400">Referencing, right-to-rent and guarantor details can be captured on the tenant record afterwards.</p>
            </div>
          )}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Emergency contact name</Label><Input value={f.emergencyContactName} onChange={(e) => set('emergencyContactName', e.target.value)} /></div>
              <div><Label>Emergency contact phone</Label><Input value={f.emergencyContactPhone} onChange={(e) => set('emergencyContactPhone', e.target.value)} /></div>
              <div className="col-span-2"><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => set('notes', e.target.value)} /></div>
              <div className="col-span-2 flex items-center gap-2">
                <input type="checkbox" id="sv" checked={f.sendVerification} onChange={(e) => set('sendVerification', e.target.checked)} className="h-4 w-4 accent-[#791E75]" />
                <Label htmlFor="sv" className="cursor-pointer">Send ID-verification link via WhatsApp (needs mobile)</Label>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-2 text-sm">
              <Row label="Name" value={f.fullName} />
              {f.email && <Row label="Email" value={f.email} />}
              {(f.mobile || f.phone) && <Row label="Phone" value={f.mobile || f.phone} />}
              {f.employer && <Row label="Employer" value={`${f.employer}${f.jobTitle ? ` — ${f.jobTitle}` : ''}`} />}
              {f.annualIncome && <Row label="Annual income" value={`£${Number(f.annualIncome).toLocaleString()}`} />}
              {f.emergencyContactName && <Row label="Emergency" value={`${f.emergencyContactName} ${f.emergencyContactPhone}`.trim()} />}
              {f.sendVerification && <Row label="ID verification" value="WhatsApp link on create" />}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={back} disabled={step === 0} className="gap-1.5"><ArrowLeft className="h-4 w-4" /> Back</Button>
        {step < STEPS.length - 1 ? (
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={next} disabled={!canNext}>Next <ArrowRight className="h-4 w-4" /></Button>
        ) : (
          <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]" onClick={() => save.mutate()} disabled={save.isPending || !f.fullName.trim()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Create tenant
          </Button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between border-b py-1.5"><span className="text-gray-500">{label}</span><span className="font-medium text-gray-900 text-right">{value}</span></div>;
}
