import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Flame, Save } from 'lucide-react';
import { differenceInDays, isPast, parseISO } from 'date-fns';

interface GasCover {
  provider?: string;
  policyReference?: string;
  expiryDate?: string;
  annualCost?: number;
  providerPhone?: string;
  coversBoiler?: boolean;
  coversHeating?: boolean;
  coversPlumbing?: boolean;
  notes?: string;
}

function expiryBadge(dateStr?: string) {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  const days = differenceInDays(date, new Date());
  if (isPast(date)) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (days < 30) {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Expires in {days}d</Badge>;
  }
  return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Valid</Badge>;
}

const emptyForm: GasCover = {
  provider: '',
  policyReference: '',
  expiryDate: '',
  annualCost: undefined,
  providerPhone: '',
  coversBoiler: false,
  coversHeating: false,
  coversPlumbing: false,
  notes: '',
};

interface Props {
  propertyId: number;
}

export default function GasBoilerCoverSection({ propertyId }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<GasCover>({ ...emptyForm });

  const { data, isLoading } = useQuery<GasCover>({
    queryKey: [`/api/crm/properties/${propertyId}/gas-cover`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/gas-cover`, { credentials: 'include' });
      if (!res.ok) return {} as GasCover;
      return res.json();
    },
    enabled: !!propertyId,
  });

  useEffect(() => {
    if (data) {
      setForm({
        provider: data.provider || '',
        policyReference: data.policyReference || '',
        expiryDate: data.expiryDate ? data.expiryDate.slice(0, 10) : '',
        annualCost: data.annualCost ?? undefined,
        providerPhone: data.providerPhone || '',
        coversBoiler: data.coversBoiler ?? false,
        coversHeating: data.coversHeating ?? false,
        coversPlumbing: data.coversPlumbing ?? false,
        notes: data.notes || '',
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: GasCover) =>
      apiRequest('PUT', `/api/crm/properties/${propertyId}/gas-cover`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/gas-cover`] });
      toast({ title: 'Gas/boiler cover saved' });
    },
    onError: () => toast({ title: 'Failed to save gas/boiler cover', variant: 'destructive' }),
  });

  function setField<K extends keyof GasCover>(key: K, value: GasCover[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5 text-[#791E75]" />
          Gas &amp; Boiler Cover
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Provider</Label>
                <Input
                  value={form.provider || ''}
                  onChange={(e) => setField('provider', e.target.value)}
                  placeholder="e.g. British Gas"
                />
              </div>
              <div className="space-y-2">
                <Label>Policy Reference</Label>
                <Input
                  value={form.policyReference || ''}
                  onChange={(e) => setField('policyReference', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Expiry Date</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="flex-1"
                    value={form.expiryDate || ''}
                    onChange={(e) => setField('expiryDate', e.target.value)}
                  />
                  {expiryBadge(form.expiryDate)}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Annual Cost (£)</Label>
                <Input
                  type="number"
                  value={form.annualCost ?? ''}
                  onChange={(e) => setField('annualCost', e.target.value ? parseFloat(e.target.value) : undefined)}
                />
              </div>
              <div className="space-y-2">
                <Label>Provider Phone</Label>
                <Input
                  value={form.providerPhone || ''}
                  onChange={(e) => setField('providerPhone', e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Coverage Includes</Label>
              <div className="flex flex-wrap gap-6">
                {[
                  { key: 'coversBoiler' as const, label: 'Boiler' },
                  { key: 'coversHeating' as const, label: 'Central Heating' },
                  { key: 'coversPlumbing' as const, label: 'Plumbing' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center space-x-2">
                    <Checkbox
                      id={key}
                      checked={!!form[key]}
                      onCheckedChange={(checked) => setField(key, !!checked)}
                    />
                    <Label htmlFor={key} className="cursor-pointer font-normal">{label}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes || ''}
                onChange={(e) => setField('notes', e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
                className="bg-[#791E75] hover:bg-[#60175d]"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save Gas Cover'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
