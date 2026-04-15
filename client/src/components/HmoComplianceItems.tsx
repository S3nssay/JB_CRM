import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ShieldCheck, Save } from 'lucide-react';
import { format, differenceInDays, isPast, parseISO } from 'date-fns';

interface HmoCompliance {
  fireAlarmNextDue?: string;
  fireEquipmentNextDue?: string;
  fireLightingNextDue?: string;
  hmoLicenceExpiry?: string;
  hmoLicenceNumber?: string;
  maxOccupants?: number;
  notes?: string;
}

function dateBadge(dateStr?: string) {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  const days = differenceInDays(date, new Date());
  if (isPast(date)) {
    return <Badge variant="destructive">Expired</Badge>;
  }
  if (days < 30) {
    return <Badge className="bg-amber-500 hover:bg-amber-600 text-white">Due in {days}d</Badge>;
  }
  return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Valid</Badge>;
}

interface Props {
  propertyId: number;
}

const emptyForm: HmoCompliance = {
  fireAlarmNextDue: '',
  fireEquipmentNextDue: '',
  fireLightingNextDue: '',
  hmoLicenceExpiry: '',
  hmoLicenceNumber: '',
  maxOccupants: undefined,
  notes: '',
};

export default function HmoComplianceItems({ propertyId }: Props) {
  const { toast } = useToast();
  const [form, setForm] = useState<HmoCompliance>({ ...emptyForm });

  const { data, isLoading } = useQuery<HmoCompliance>({
    queryKey: [`/api/crm/properties/${propertyId}/hmo-compliance`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/hmo-compliance`, { credentials: 'include' });
      if (!res.ok) return {} as HmoCompliance;
      return res.json();
    },
    enabled: !!propertyId,
  });

  useEffect(() => {
    if (data) {
      setForm({
        fireAlarmNextDue: data.fireAlarmNextDue ? data.fireAlarmNextDue.slice(0, 10) : '',
        fireEquipmentNextDue: data.fireEquipmentNextDue ? data.fireEquipmentNextDue.slice(0, 10) : '',
        fireLightingNextDue: data.fireLightingNextDue ? data.fireLightingNextDue.slice(0, 10) : '',
        hmoLicenceExpiry: data.hmoLicenceExpiry ? data.hmoLicenceExpiry.slice(0, 10) : '',
        hmoLicenceNumber: data.hmoLicenceNumber || '',
        maxOccupants: data.maxOccupants ?? undefined,
        notes: data.notes || '',
      });
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (payload: HmoCompliance) =>
      apiRequest('PUT', `/api/crm/properties/${propertyId}/hmo-compliance`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/hmo-compliance`] });
      toast({ title: 'HMO compliance saved' });
    },
    onError: () => toast({ title: 'Failed to save HMO compliance', variant: 'destructive' }),
  });

  function handleSave() {
    saveMutation.mutate(form);
  }

  const DateRow = ({ label, field }: { label: string; field: keyof HmoCompliance }) => (
    <div className="space-y-1">
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="flex-1"
          value={(form[field] as string) || ''}
          onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
        />
        {dateBadge(form[field] as string)}
      </div>
    </div>
  );

  return (
    <Card className="border-amber-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-amber-700">
          <ShieldCheck className="h-5 w-5" />
          HMO Compliance
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DateRow label="Fire Alarm Next Due" field="fireAlarmNextDue" />
              <DateRow label="Fire Equipment Next Due" field="fireEquipmentNextDue" />
              <DateRow label="Fire Lighting Next Due" field="fireLightingNextDue" />
            </div>

            <div className="border-t pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">HMO Licence Expiry</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    className="flex-1"
                    value={form.hmoLicenceExpiry || ''}
                    onChange={(e) => setForm((f) => ({ ...f, hmoLicenceExpiry: e.target.value }))}
                  />
                  {dateBadge(form.hmoLicenceExpiry)}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Licence Number</Label>
                <Input
                  value={form.hmoLicenceNumber || ''}
                  onChange={(e) => setForm((f) => ({ ...f, hmoLicenceNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-gray-600">Max Occupants</Label>
                <Input
                  type="number"
                  value={form.maxOccupants ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, maxOccupants: e.target.value ? parseInt(e.target.value) : undefined }))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Notes</Label>
              <Textarea
                value={form.notes || ''}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-[#791E75] hover:bg-[#60175d]"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? 'Saving...' : 'Save HMO Compliance'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
