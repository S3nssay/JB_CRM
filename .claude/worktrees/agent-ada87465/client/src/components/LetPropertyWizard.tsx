import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import {
    Building2, User, PoundSterling, Calendar,
    ChevronRight, ChevronLeft, Check, Loader2
} from 'lucide-react';

interface LetPropertyWizardProps {
    property: {
        id: number;
        title: string;
        addressLine1?: string;
        postcode?: string;
        price?: number;
    };
    isOpen: boolean;
    onClose: () => void;
}

export function LetPropertyWizard({ property, isOpen, onClose }: LetPropertyWizardProps) {
    const { toast } = useToast();
    const [step, setStep] = useState(1);

    // Form data
    const [formData, setFormData] = useState({
        landlordId: '',
        newLandlordName: '',
        newLandlordEmail: '',
        newLandlordMobile: '',
        tenantName: '',
        tenantEmail: '',
        tenantMobile: '',
        rentAmount: property.price?.toString() || '',
        rentFrequency: 'Monthly',
        depositAmount: '',
        depositHeldBy: 'Agency: Insurance',
        tenancyStart: '',
        tenancyEnd: '',
        managementFee: '10'
    });

    // Fetch existing landlords
    const { data: landlords = [] } = useQuery({
        queryKey: ['/api/crm/landlords'],
        queryFn: async () => {
            const res = await fetch('/api/crm/landlords');
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Create rental agreement mutation
    const createAgreementMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch('/api/crm/rental-agreements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create rental agreement');
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: 'Property Let Successfully',
                description: `${property.title} is now a managed property.`
            });
            queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
            queryClient.invalidateQueries({ queryKey: ['/api/crm/rental-agreements'] });
            onClose();
        },
        onError: () => {
            toast({
                title: 'Error',
                description: 'Failed to create rental agreement',
                variant: 'destructive'
            });
        }
    });

    const handleSubmit = async () => {
        let landlordId = formData.landlordId;

        // If creating new landlord, create first
        if (formData.landlordId === 'new') {
            try {
                const res = await fetch('/api/crm/landlords', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name: formData.newLandlordName,
                        email: formData.newLandlordEmail,
                        mobile: formData.newLandlordMobile,
                        landlordType: 'individual',
                        status: 'active'
                    })
                });
                if (!res.ok) throw new Error('Failed to create landlord');
                const newLandlord = await res.json();
                landlordId = newLandlord.id.toString();
            } catch (error) {
                toast({ title: 'Error', description: 'Failed to create landlord', variant: 'destructive' });
                return;
            }
        }

        // Create the rental agreement
        createAgreementMutation.mutate({
            propertyId: property.id,
            landlordId: parseInt(landlordId),
            rentAmount: parseInt(formData.rentAmount),
            rentFrequency: formData.rentFrequency,
            depositAmount: parseInt(formData.depositAmount),
            depositHeldBy: formData.depositHeldBy,
            tenancyStart: formData.tenancyStart,
            tenancyEnd: formData.tenancyEnd,
            managementFeePercent: formData.managementFee,
            status: 'active'
        });
    };

    const updateField = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const canProceed = () => {
        switch (step) {
            case 1: return formData.landlordId && (formData.landlordId !== 'new' || formData.newLandlordName);
            case 2: return formData.tenantName;
            case 3: return formData.rentAmount && formData.depositAmount && formData.tenancyStart && formData.tenancyEnd;
            default: return true;
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        Let Property
                    </DialogTitle>
                    <DialogDescription>
                        Convert this rental listing to a managed property
                    </DialogDescription>
                </DialogHeader>

                {/* Property Summary */}
                <Card className="bg-gray-50">
                    <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">{property.title}</p>
                                <p className="text-sm text-muted-foreground">{property.postcode}</p>
                            </div>
                            <Badge>Listing</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 py-4">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${step >= s ? 'bg-primary text-white' : 'bg-gray-200 text-gray-600'}`}>
                                {step > s ? <Check className="h-4 w-4" /> : s}
                            </div>
                            {s < 4 && <ChevronRight className="h-4 w-4 text-gray-400" />}
                        </div>
                    ))}
                </div>

                {/* Step 1: Landlord */}
                {step === 1 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" /> Landlord Details
                        </h3>

                        <div className="space-y-3">
                            <Label>Select Landlord</Label>
                            <Select value={formData.landlordId} onValueChange={(v) => updateField('landlordId', v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose existing or create new" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">+ Create New Landlord</SelectItem>
                                    {landlords.map((l: any) => (
                                        <SelectItem key={l.id} value={l.id.toString()}>
                                            {l.name} {l.email && `(${l.email})`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {formData.landlordId === 'new' && (
                                <div className="space-y-3 pt-2 border-t">
                                    <div>
                                        <Label>Landlord Name *</Label>
                                        <Input
                                            value={formData.newLandlordName}
                                            onChange={(e) => updateField('newLandlordName', e.target.value)}
                                            placeholder="Full name"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Email</Label>
                                            <Input
                                                type="email"
                                                value={formData.newLandlordEmail}
                                                onChange={(e) => updateField('newLandlordEmail', e.target.value)}
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                        <div>
                                            <Label>Mobile</Label>
                                            <Input
                                                value={formData.newLandlordMobile}
                                                onChange={(e) => updateField('newLandlordMobile', e.target.value)}
                                                placeholder="07..."
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Step 2: Tenant */}
                {step === 2 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <User className="h-4 w-4" /> Tenant Details
                        </h3>

                        <div className="space-y-3">
                            <div>
                                <Label>Tenant Name *</Label>
                                <Input
                                    value={formData.tenantName}
                                    onChange={(e) => updateField('tenantName', e.target.value)}
                                    placeholder="Tenant or company name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label>Email</Label>
                                    <Input
                                        type="email"
                                        value={formData.tenantEmail}
                                        onChange={(e) => updateField('tenantEmail', e.target.value)}
                                        placeholder="tenant@example.com"
                                    />
                                </div>
                                <div>
                                    <Label>Mobile</Label>
                                    <Input
                                        value={formData.tenantMobile}
                                        onChange={(e) => updateField('tenantMobile', e.target.value)}
                                        placeholder="07..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Financial Details */}
                {step === 3 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <PoundSterling className="h-4 w-4" /> Financial Details
                        </h3>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>Rent Amount (£) *</Label>
                                <Input
                                    type="number"
                                    value={formData.rentAmount}
                                    onChange={(e) => updateField('rentAmount', e.target.value)}
                                    placeholder="1500"
                                />
                            </div>
                            <div>
                                <Label>Frequency</Label>
                                <Select value={formData.rentFrequency} onValueChange={(v) => updateField('rentFrequency', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Monthly">Monthly</SelectItem>
                                        <SelectItem value="Calendar Monthly">Calendar Monthly</SelectItem>
                                        <SelectItem value="Quarterly">Quarterly</SelectItem>
                                        <SelectItem value="Annually">Annually</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Deposit (£) *</Label>
                                <Input
                                    type="number"
                                    value={formData.depositAmount}
                                    onChange={(e) => updateField('depositAmount', e.target.value)}
                                    placeholder="1500"
                                />
                            </div>
                            <div>
                                <Label>Deposit Held By</Label>
                                <Select value={formData.depositHeldBy} onValueChange={(v) => updateField('depositHeldBy', v)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Agency: Insurance">Agency: Insurance</SelectItem>
                                        <SelectItem value="Agency: Custodial">Agency: Custodial</SelectItem>
                                        <SelectItem value="Landlord">Landlord</SelectItem>
                                        <SelectItem value="TDS">TDS</SelectItem>
                                        <SelectItem value="DPS">DPS</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>Tenancy Start *</Label>
                                <Input
                                    type="date"
                                    value={formData.tenancyStart}
                                    onChange={(e) => updateField('tenancyStart', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Tenancy End *</Label>
                                <Input
                                    type="date"
                                    value={formData.tenancyEnd}
                                    onChange={(e) => updateField('tenancyEnd', e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>Management Fee (%)</Label>
                                <Input
                                    type="number"
                                    value={formData.managementFee}
                                    onChange={(e) => updateField('managementFee', e.target.value)}
                                    placeholder="10"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: Confirm */}
                {step === 4 && (
                    <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Check className="h-4 w-4" /> Confirm Details
                        </h3>

                        <Card>
                            <CardContent className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="text-muted-foreground">Property:</div>
                                    <div className="font-medium">{property.title}</div>

                                    <div className="text-muted-foreground">Landlord:</div>
                                    <div className="font-medium">
                                        {formData.landlordId === 'new' ? formData.newLandlordName :
                                            landlords.find((l: any) => l.id.toString() === formData.landlordId)?.name}
                                    </div>

                                    <div className="text-muted-foreground">Tenant:</div>
                                    <div className="font-medium">{formData.tenantName}</div>

                                    <div className="text-muted-foreground">Rent:</div>
                                    <div className="font-medium">£{formData.rentAmount} {formData.rentFrequency}</div>

                                    <div className="text-muted-foreground">Deposit:</div>
                                    <div className="font-medium">£{formData.depositAmount} ({formData.depositHeldBy})</div>

                                    <div className="text-muted-foreground">Term:</div>
                                    <div className="font-medium">{formData.tenancyStart} to {formData.tenancyEnd}</div>

                                    <div className="text-muted-foreground">Fee:</div>
                                    <div className="font-medium">{formData.managementFee}%</div>
                                </div>
                            </CardContent>
                        </Card>

                        <p className="text-sm text-muted-foreground">
                            This will create a rental agreement and convert the listing to a managed property.
                        </p>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        onClick={() => step > 1 ? setStep(step - 1) : onClose()}
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        {step === 1 ? 'Cancel' : 'Back'}
                    </Button>

                    {step < 4 ? (
                        <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
                            Next
                            <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            disabled={createAgreementMutation.isPending}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            {createAgreementMutation.isPending ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4 mr-2" />
                            )}
                            Let Property
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
