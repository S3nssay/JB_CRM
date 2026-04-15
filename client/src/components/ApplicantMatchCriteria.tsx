import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Save, Loader2 } from 'lucide-react';

interface ListingCriteria {
  id?: number;
  property_id?: number;
  dss_accepted?: boolean;
  children_accepted?: boolean;
  smokers_accepted?: boolean;
  dogs_accepted?: boolean;
  cats_accepted?: boolean;
  parking_available?: boolean;
  letting_type?: string;
}

interface ApplicantMatchCriteriaProps {
  propertyId: number;
}

export default function ApplicantMatchCriteria({ propertyId }: ApplicantMatchCriteriaProps) {
  const { toast } = useToast();

  const { data: criteria, isLoading } = useQuery<ListingCriteria | null>({
    queryKey: [`/api/crm/properties/${propertyId}/listing-criteria`],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/listing-criteria`, { credentials: 'include' });
      if (!res.ok) return null;
      const json = await res.json();
      // API may return null/empty object when no record exists yet
      return json || null;
    },
    enabled: !!propertyId,
  });

  const [local, setLocal] = useState<ListingCriteria>({});

  useEffect(() => {
    if (criteria) {
      setLocal(criteria);
    }
  }, [criteria]);

  const saveMutation = useMutation({
    mutationFn: async (data: ListingCriteria) => {
      return apiRequest(`/api/crm/properties/${propertyId}/listing-criteria`, 'PUT', {
        dssAccepted: data.dss_accepted ?? false,
        childrenAccepted: data.children_accepted ?? false,
        smokersAccepted: data.smokers_accepted ?? false,
        dogsAccepted: data.dogs_accepted ?? false,
        catsAccepted: data.cats_accepted ?? false,
        parkingAvailable: data.parking_available ?? false,
        lettingType: data.letting_type ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/properties/${propertyId}/listing-criteria`] });
      toast({ title: 'Applicant criteria saved' });
    },
    onError: (err: any) => {
      toast({ title: 'Failed to save', description: err.message || 'Could not save criteria.', variant: 'destructive' });
    },
  });

  const updateField = (field: keyof ListingCriteria, value: unknown) => {
    setLocal(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-[#791E75]" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Applicant Match Criteria
        </CardTitle>
        <CardDescription>Set applicant preferences and letting terms for this property</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">

        {/* Letting Type */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lettingType">Letting Type</Label>
            <Select
              value={local.letting_type || ''}
              onValueChange={(value) => updateField('letting_type', value || null)}
            >
              <SelectTrigger id="lettingType">
                <SelectValue placeholder="Select letting type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="long_term">Long Term</SelectItem>
                <SelectItem value="short_term">Short Term</SelectItem>
                <SelectItem value="commercial">Commercial</SelectItem>
                <SelectItem value="student">Student</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Applicant Preferences checkboxes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Applicant Preferences</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              { id: 'dss_accepted' as keyof ListingCriteria, label: 'DSS Accepted' },
              { id: 'children_accepted' as keyof ListingCriteria, label: 'Children Accepted' },
              { id: 'smokers_accepted' as keyof ListingCriteria, label: 'Smokers Accepted' },
              { id: 'dogs_accepted' as keyof ListingCriteria, label: 'Dogs Accepted' },
              { id: 'cats_accepted' as keyof ListingCriteria, label: 'Cats Accepted' },
              { id: 'parking_available' as keyof ListingCriteria, label: 'Parking Available' },
            ].map(({ id, label }) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={id}
                  checked={(local[id] as boolean) ?? false}
                  onCheckedChange={(checked) => updateField(id, !!checked)}
                />
                <Label htmlFor={id} className="cursor-pointer text-sm font-normal">{label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            className="bg-[#791E75] hover:bg-[#60175d]"
            disabled={saveMutation.isPending}
            onClick={() => saveMutation.mutate(local)}
          >
            {saveMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-1" /> Save Criteria</>
            )}
          </Button>
        </div>

      </CardContent>
    </Card>
  );
}
