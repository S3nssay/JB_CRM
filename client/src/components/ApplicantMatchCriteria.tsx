import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Users } from 'lucide-react';

interface ApplicantMatchCriteriaProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  formData: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFormData: (updater: (prev: any) => any) => void;
}

export default function ApplicantMatchCriteria({ formData, setFormData }: ApplicantMatchCriteriaProps) {
  const updateField = (field: string, value: unknown) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

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

        {/* Row 1: Letting Type, Ideal Rent Day, Furnished Status */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="lettingType">Letting Type</Label>
            <Select
              value={formData.lettingType || ''}
              onValueChange={(value) => updateField('lettingType', value)}
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

          <div className="space-y-2">
            <Label htmlFor="idealRentDay">Ideal Rent Day (1–31)</Label>
            <Input
              id="idealRentDay"
              type="number"
              min={1}
              max={31}
              value={formData.idealRentDay || ''}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                updateField('idealRentDay', isNaN(val) ? null : Math.min(31, Math.max(1, val)));
              }}
              placeholder="e.g., 1"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="furnished">Furnished Status</Label>
            <Select
              value={formData.furnished || ''}
              onValueChange={(value) => updateField('furnished', value)}
            >
              <SelectTrigger id="furnished">
                <SelectValue placeholder="Select furnished status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fully_furnished">Fully Furnished</SelectItem>
                <SelectItem value="part_furnished">Part Furnished</SelectItem>
                <SelectItem value="unfurnished">Unfurnished</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Applicant Preferences checkboxes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Applicant Preferences</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              { id: 'dssAccepted', label: 'DSS Accepted' },
              { id: 'childrenAccepted', label: 'Children Accepted' },
              { id: 'smokersAccepted', label: 'Smokers Accepted' },
              { id: 'dogsAccepted', label: 'Dogs Accepted' },
              { id: 'catsAccepted', label: 'Cats Accepted' },
              { id: 'parkingAvailable', label: 'Parking Available' },
            ].map(({ id, label }) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={id}
                  checked={formData[id] ?? false}
                  onCheckedChange={(checked) => updateField(id, !!checked)}
                />
                <Label htmlFor={id} className="cursor-pointer text-sm font-normal">{label}</Label>
              </div>
            ))}
          </div>
        </div>

        {/* Row 3: Rent Generation checkboxes */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Rent Generation</Label>
          <div className="flex flex-wrap gap-x-6 gap-y-3">
            {[
              { id: 'generateMultipleRents', label: 'Generate Multiple Rents' },
              { id: 'generateRentsInArrears', label: 'Generate Rents in Arrears' },
            ].map(({ id, label }) => (
              <div key={id} className="flex items-center space-x-2">
                <Checkbox
                  id={id}
                  checked={formData[id] ?? false}
                  onCheckedChange={(checked) => updateField(id, !!checked)}
                />
                <Label htmlFor={id} className="cursor-pointer text-sm font-normal">{label}</Label>
              </div>
            ))}
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
