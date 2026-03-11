import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
    ArrowLeft, ArrowRight, Building, Users, FileText, Shield, Check,
    Upload, MapPin, Home, AlertTriangle, Flame, Zap, Thermometer
} from 'lucide-react';
import { ComplianceChecklist, ComplianceItem, isExpired, expiresWithin, isEpcRatingValid } from '@/components/ComplianceChecklist';

interface PropertyFormData {
    // Property Details
    addressLine1: string;
    addressLine2: string;
    city: string;
    postcode: string;
    propertyType: 'house' | 'flat' | 'maisonette' | 'studio' | 'other';
    bedrooms: number;
    bathrooms: number;
    furnished: 'furnished' | 'part-furnished' | 'unfurnished';

    // Ownership
    ownershipType: 'freehold' | 'leasehold';
    landlordId: number | null;

    // Safety Certificates
    hasGasSafetyCert: boolean;
    gasSafetyCertDate: string;
    gasSafetyCertExpiry: string;

    hasEicr: boolean;
    eicrDate: string;
    eicrExpiry: string;

    hasEpc: boolean;
    epcRating: string;
    epcDate: string;
    epcExpiry: string;

    // Safety Equipment
    hasSmokeAlarms: boolean;
    smokeAlarmsTested: boolean;
    hasCOAlarms: boolean;
    coAlarmsTested: boolean;
    hasFireBlanket: boolean;
    hasFireExtinguisher: boolean;

    // Compliance Checklist
    inventoryCompleted: boolean;
    keysAvailable: boolean;
    utilitiesSetup: boolean;
    councilTaxNotified: boolean;
    insuranceInPlace: boolean;

    notes: string;
}

type WizardStep = 'details' | 'ownership' | 'certificates' | 'safety' | 'checklist';

const steps: { key: WizardStep; label: string; icon: typeof Building }[] = [
    { key: 'details', label: 'Property Details', icon: Building },
    { key: 'ownership', label: 'Ownership', icon: Users },
    { key: 'certificates', label: 'Certificates', icon: FileText },
    { key: 'safety', label: 'Safety Equipment', icon: Shield },
    { key: 'checklist', label: 'Checklist', icon: Check }
];

export default function PropertyOnboarding() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState<WizardStep>('details');
    const [formData, setFormData] = useState<PropertyFormData>({
        addressLine1: '',
        addressLine2: '',
        city: 'London',
        postcode: '',
        propertyType: 'flat',
        bedrooms: 1,
        bathrooms: 1,
        furnished: 'unfurnished',
        ownershipType: 'leasehold',
        landlordId: null,
        hasGasSafetyCert: false,
        gasSafetyCertDate: '',
        gasSafetyCertExpiry: '',
        hasEicr: false,
        eicrDate: '',
        eicrExpiry: '',
        hasEpc: false,
        epcRating: '',
        epcDate: '',
        epcExpiry: '',
        hasSmokeAlarms: false,
        smokeAlarmsTested: false,
        hasCOAlarms: false,
        coAlarmsTested: false,
        hasFireBlanket: false,
        hasFireExtinguisher: false,
        inventoryCompleted: false,
        keysAvailable: false,
        utilitiesSetup: false,
        councilTaxNotified: false,
        insuranceInPlace: false,
        notes: ''
    });

    const { data: landlords } = useQuery<any[]>({
        queryKey: ['/api/crm/landlords'],
        queryFn: async () => {
            const response = await fetch('/api/crm/landlords');
            if (!response.ok) throw new Error('Failed to fetch landlords');
            return response.json();
        }
    });

    const currentStepIndex = steps.findIndex(s => s.key === currentStep);
    const progress = ((currentStepIndex + 1) / steps.length) * 100;

    const updateField = (field: keyof PropertyFormData, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const goBack = () => {
        if (currentStepIndex > 0) {
            setCurrentStep(steps[currentStepIndex - 1].key);
        }
    };

    const goNext = () => {
        if (currentStepIndex < steps.length - 1) {
            setCurrentStep(steps[currentStepIndex + 1].key);
        }
    };

    const saveMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/crm/properties', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error('Failed to save property');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
            toast({ title: 'Success', description: 'Property has been onboarded successfully!' });
            setLocation('/crm/property-management');
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to save property.', variant: 'destructive' });
        }
    });

    const canProceed = () => {
        switch (currentStep) {
            case 'details':
                return formData.addressLine1 && formData.postcode;
            case 'ownership':
                return true;
            case 'certificates':
                return true;
            case 'safety':
                return formData.hasSmokeAlarms;
            case 'checklist':
                return true;
            default:
                return true;
        }
    };

    const isLastStep = currentStepIndex === steps.length - 1;

    // Build compliance items for the review
    const getComplianceItems = (): ComplianceItem[] => {
        const items: ComplianceItem[] = [];

        // Gas Safety - CRITICAL
        const gasValid = formData.hasGasSafetyCert && formData.gasSafetyCertExpiry && !isExpired(formData.gasSafetyCertExpiry);
        items.push({
            id: 'gas_safety',
            label: 'Gas Safety Certificate (CP12)',
            description: !formData.hasGasSafetyCert
                ? 'No gas safety certificate provided'
                : !formData.gasSafetyCertExpiry
                    ? 'Certificate provided but no expiry date set'
                    : isExpired(formData.gasSafetyCertExpiry)
                        ? 'Certificate has expired'
                        : expiresWithin(formData.gasSafetyCertExpiry, 30)
                            ? 'Certificate expires within 30 days - renewal needed soon'
                            : 'Valid gas safety certificate on file',
            passed: gasValid,
            severity: 'critical',
            actionStep: 'certificates',
            actionLabel: 'Add Certificate',
            penalty: 'Fine up to £6,000 or 6 months imprisonment',
            legalReference: 'Gas Safety (Installation and Use) Regulations 1998',
        });

        // EICR - CRITICAL
        const eicrValid = formData.hasEicr && formData.eicrExpiry && !isExpired(formData.eicrExpiry);
        items.push({
            id: 'eicr',
            label: 'Electrical Safety (EICR)',
            description: !formData.hasEicr
                ? 'No EICR report provided'
                : !formData.eicrExpiry
                    ? 'EICR provided but no expiry date set'
                    : isExpired(formData.eicrExpiry)
                        ? 'EICR has expired'
                        : expiresWithin(formData.eicrExpiry, 60)
                            ? 'EICR expires within 60 days - renewal needed soon'
                            : 'Valid EICR on file',
            passed: eicrValid,
            severity: 'critical',
            actionStep: 'certificates',
            actionLabel: 'Add EICR',
            penalty: 'Fine up to £30,000',
            legalReference: 'Electrical Safety Standards in the Private Rented Sector (England) Regulations 2020',
        });

        // EPC - CRITICAL
        const epcValid = formData.hasEpc && formData.epcRating && isEpcRatingValid(formData.epcRating) && formData.epcExpiry && !isExpired(formData.epcExpiry);
        items.push({
            id: 'epc',
            label: 'Energy Performance Certificate (EPC)',
            description: !formData.hasEpc
                ? 'No EPC provided'
                : !formData.epcRating
                    ? 'EPC provided but no rating selected'
                    : !isEpcRatingValid(formData.epcRating)
                        ? `EPC rating ${formData.epcRating} is below minimum E - property cannot be let`
                        : !formData.epcExpiry
                            ? 'EPC provided but no expiry date set'
                            : isExpired(formData.epcExpiry)
                                ? 'EPC has expired'
                                : 'Valid EPC on file (rating ' + formData.epcRating + ')',
            passed: epcValid,
            severity: 'critical',
            actionStep: 'certificates',
            actionLabel: 'Add EPC',
            penalty: 'Fine up to £5,000. Properties rated F or G cannot be let.',
            legalReference: 'Energy Efficiency (Private Rented Property) Regulations 2015',
        });

        // Smoke Alarms - CRITICAL
        items.push({
            id: 'smoke_alarms',
            label: 'Smoke Alarms (every floor)',
            description: !formData.hasSmokeAlarms
                ? 'Smoke alarms not confirmed on every floor'
                : !formData.smokeAlarmsTested
                    ? 'Smoke alarms installed but not confirmed as tested'
                    : 'Smoke alarms installed and tested on every floor',
            passed: formData.hasSmokeAlarms && formData.smokeAlarmsTested,
            severity: 'critical',
            actionStep: 'safety',
            actionLabel: 'Fix',
            penalty: 'Fine up to £5,000',
            legalReference: 'Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022',
        });

        // CO Alarms - CRITICAL
        items.push({
            id: 'co_alarms',
            label: 'Carbon Monoxide Alarms',
            description: !formData.hasCOAlarms
                ? 'CO alarms not confirmed in rooms with combustion appliances'
                : !formData.coAlarmsTested
                    ? 'CO alarms installed but not confirmed as tested'
                    : 'CO alarms installed and tested',
            passed: formData.hasCOAlarms && formData.coAlarmsTested,
            severity: 'critical',
            actionStep: 'safety',
            actionLabel: 'Fix',
            penalty: 'Fine up to £5,000',
            legalReference: 'Smoke and Carbon Monoxide Alarm (Amendment) Regulations 2022',
        });

        // Landlord Assignment - WARNING
        items.push({
            id: 'landlord_assigned',
            label: 'Landlord Assigned',
            description: formData.landlordId
                ? 'Landlord has been assigned to this property'
                : 'No landlord assigned - required for management',
            passed: !!formData.landlordId,
            severity: 'warning',
            actionStep: 'ownership',
            actionLabel: 'Assign',
        });

        // Inventory - WARNING
        items.push({
            id: 'inventory',
            label: 'Inventory Completed',
            description: formData.inventoryCompleted
                ? 'Full property inventory completed with photos'
                : 'Inventory not yet completed - required before tenant moves in',
            passed: formData.inventoryCompleted,
            severity: 'warning',
            actionStep: 'checklist',
            actionLabel: 'Complete',
        });

        // Insurance - WARNING
        items.push({
            id: 'insurance',
            label: 'Landlord Insurance',
            description: formData.insuranceInPlace
                ? 'Buildings and contents insurance confirmed'
                : 'No landlord insurance confirmed - strongly recommended',
            passed: formData.insuranceInPlace,
            severity: 'warning',
            actionStep: 'checklist',
            actionLabel: 'Confirm',
        });

        // Keys - INFO
        items.push({
            id: 'keys',
            label: 'Keys Available',
            description: formData.keysAvailable
                ? 'All key sets ready for handover'
                : 'Keys not yet confirmed as available',
            passed: formData.keysAvailable,
            severity: 'info',
            actionStep: 'checklist',
            actionLabel: 'Confirm',
        });

        // Utilities - INFO
        items.push({
            id: 'utilities',
            label: 'Utilities Setup',
            description: formData.utilitiesSetup
                ? 'Gas, electric, water arrangements confirmed'
                : 'Utility arrangements not yet confirmed',
            passed: formData.utilitiesSetup,
            severity: 'info',
            actionStep: 'checklist',
            actionLabel: 'Confirm',
        });

        // Council Tax - INFO
        items.push({
            id: 'council_tax',
            label: 'Council Tax Notification',
            description: formData.councilTaxNotified
                ? 'Council informed of tenancy change'
                : 'Council not yet notified of change',
            passed: formData.councilTaxNotified,
            severity: 'info',
            actionStep: 'checklist',
            actionLabel: 'Confirm',
        });

        return items;
    };

    const complianceItems = getComplianceItems();
    const hasCriticalFailures = complianceItems.some(i => i.severity === 'critical' && !i.passed);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background">
            {/* Header */}
            <div className="bg-white dark:bg-card border-b">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/property-management')}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-semibold">Property Onboarding</h1>
                                <p className="text-sm text-muted-foreground">
                                    Complete all steps to add a managed property
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto p-6">
                {/* Progress */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                        {steps.map((step, idx) => (
                            <div
                                key={step.key}
                                className={`flex items-center gap-2 ${idx <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
                                    }`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${idx < currentStepIndex
                                        ? 'bg-primary text-primary-foreground'
                                        : idx === currentStepIndex
                                            ? 'bg-primary/20 text-primary border-2 border-primary'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {idx < currentStepIndex ? <Check className="h-4 w-4" /> : idx + 1}
                                </div>
                                <span className="hidden md:inline text-sm">{step.label}</span>
                            </div>
                        ))}
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                {/* Step Content */}
                {currentStep === 'details' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                Property Details
                            </CardTitle>
                            <CardDescription>
                                Enter the property address and basic details
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Address Line 1 *</Label>
                                <Input
                                    value={formData.addressLine1}
                                    onChange={(e) => updateField('addressLine1', e.target.value)}
                                    placeholder="Flat 1, 123 Main Street"
                                />
                            </div>

                            <div>
                                <Label>Address Line 2</Label>
                                <Input
                                    value={formData.addressLine2}
                                    onChange={(e) => updateField('addressLine2', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>City</Label>
                                    <Input
                                        value={formData.city}
                                        onChange={(e) => updateField('city', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Postcode *</Label>
                                    <Input
                                        value={formData.postcode}
                                        onChange={(e) => updateField('postcode', e.target.value)}
                                        placeholder="W10 5AA"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Property Type</Label>
                                    <Select value={formData.propertyType} onValueChange={(v) => updateField('propertyType', v)}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="house">House</SelectItem>
                                            <SelectItem value="flat">Flat</SelectItem>
                                            <SelectItem value="maisonette">Maisonette</SelectItem>
                                            <SelectItem value="studio">Studio</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Bedrooms</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={formData.bedrooms}
                                        onChange={(e) => updateField('bedrooms', parseInt(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <Label>Bathrooms</Label>
                                    <Input
                                        type="number"
                                        min={1}
                                        value={formData.bathrooms}
                                        onChange={(e) => updateField('bathrooms', parseInt(e.target.value))}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Furnishing</Label>
                                <Select value={formData.furnished} onValueChange={(v) => updateField('furnished', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="furnished">Furnished</SelectItem>
                                        <SelectItem value="part-furnished">Part-furnished</SelectItem>
                                        <SelectItem value="unfurnished">Unfurnished</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'ownership' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                Ownership
                            </CardTitle>
                            <CardDescription>
                                Property ownership and landlord assignment
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Ownership Type</Label>
                                <Select value={formData.ownershipType} onValueChange={(v) => updateField('ownershipType', v)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="freehold">Freehold</SelectItem>
                                        <SelectItem value="leasehold">Leasehold</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div>
                                <Label>Assign to Landlord</Label>
                                <Select
                                    value={formData.landlordId?.toString() || ''}
                                    onValueChange={(v) => updateField('landlordId', v ? parseInt(v) : null)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select existing landlord or create new" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {landlords?.map((landlord: any) => (
                                            <SelectItem key={landlord.id} value={landlord.id.toString()}>
                                                {landlord.name || landlord.fullName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground mt-1">
                                    <a href="/crm/onboarding/landlord" className="text-primary hover:underline">
                                        + Add new landlord
                                    </a>
                                </p>
                            </div>

                            {!formData.landlordId && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3">
                                    <div className="flex gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            A landlord must be assigned for proper management, compliance tracking, and rent payments.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'certificates' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                Safety Certificates
                            </CardTitle>
                            <CardDescription>
                                Legal requirements for rental properties
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Gas Safety */}
                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Flame className="h-5 w-5 text-orange-500" />
                                        <span className="font-medium">Gas Safety Certificate (CP12)</span>
                                    </div>
                                    <Checkbox
                                        checked={formData.hasGasSafetyCert}
                                        onCheckedChange={(checked) => updateField('hasGasSafetyCert', checked)}
                                    />
                                </div>
                                {formData.hasGasSafetyCert && (
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <Label className="text-xs">Issue Date</Label>
                                            <Input
                                                type="date"
                                                value={formData.gasSafetyCertDate}
                                                onChange={(e) => updateField('gasSafetyCertDate', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Expiry Date *</Label>
                                            <Input
                                                type="date"
                                                value={formData.gasSafetyCertExpiry}
                                                onChange={(e) => updateField('gasSafetyCertExpiry', e.target.value)}
                                            />
                                            {formData.gasSafetyCertExpiry && isExpired(formData.gasSafetyCertExpiry) && (
                                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Expired - renewal required before letting
                                                </p>
                                            )}
                                            {formData.gasSafetyCertExpiry && !isExpired(formData.gasSafetyCertExpiry) && expiresWithin(formData.gasSafetyCertExpiry, 30) && (
                                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Expires within 30 days
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* EICR */}
                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Zap className="h-5 w-5 text-yellow-500" />
                                        <span className="font-medium">EICR (Electrical)</span>
                                    </div>
                                    <Checkbox
                                        checked={formData.hasEicr}
                                        onCheckedChange={(checked) => updateField('hasEicr', checked)}
                                    />
                                </div>
                                {formData.hasEicr && (
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div>
                                            <Label className="text-xs">Issue Date</Label>
                                            <Input
                                                type="date"
                                                value={formData.eicrDate}
                                                onChange={(e) => updateField('eicrDate', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Expiry Date *</Label>
                                            <Input
                                                type="date"
                                                value={formData.eicrExpiry}
                                                onChange={(e) => updateField('eicrExpiry', e.target.value)}
                                            />
                                            {formData.eicrExpiry && isExpired(formData.eicrExpiry) && (
                                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Expired - renewal required
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* EPC */}
                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Thermometer className="h-5 w-5 text-green-500" />
                                        <span className="font-medium">EPC</span>
                                    </div>
                                    <Checkbox
                                        checked={formData.hasEpc}
                                        onCheckedChange={(checked) => updateField('hasEpc', checked)}
                                    />
                                </div>
                                {formData.hasEpc && (
                                    <div className="grid grid-cols-3 gap-4 pt-2">
                                        <div>
                                            <Label className="text-xs">Rating *</Label>
                                            <Select value={formData.epcRating} onValueChange={(v) => updateField('epcRating', v)}>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(r => (
                                                        <SelectItem key={r} value={r}>{r}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {formData.epcRating && !isEpcRatingValid(formData.epcRating) && (
                                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Rating {formData.epcRating} below minimum E - cannot let
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <Label className="text-xs">Issue Date</Label>
                                            <Input
                                                type="date"
                                                value={formData.epcDate}
                                                onChange={(e) => updateField('epcDate', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label className="text-xs">Expiry Date *</Label>
                                            <Input
                                                type="date"
                                                value={formData.epcExpiry}
                                                onChange={(e) => updateField('epcExpiry', e.target.value)}
                                            />
                                            {formData.epcExpiry && isExpired(formData.epcExpiry) && (
                                                <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Expired - new EPC required
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {(!formData.hasGasSafetyCert || !formData.hasEicr || !formData.hasEpc) && (
                                <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg p-4">
                                    <div className="flex gap-2">
                                        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-red-800 dark:text-red-200">Missing Certificates</p>
                                            <p className="text-sm text-red-700 dark:text-red-300">
                                                Properties cannot be legally let without valid Gas Safety, EICR, and EPC certificates.
                                                You may continue but the property will be flagged as non-compliant.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'safety' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Safety Equipment
                            </CardTitle>
                            <CardDescription>
                                Required safety equipment for the property
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Smoke Alarms (every floor) *</span>
                                    <Checkbox
                                        checked={formData.hasSmokeAlarms}
                                        onCheckedChange={(checked) => updateField('hasSmokeAlarms', checked)}
                                    />
                                </div>
                                {formData.hasSmokeAlarms && (
                                    <div className="flex items-center space-x-2 pl-4">
                                        <Checkbox
                                            checked={formData.smokeAlarmsTested}
                                            onCheckedChange={(checked) => updateField('smokeAlarmsTested', checked)}
                                        />
                                        <Label className="text-sm">Tested and working</Label>
                                    </div>
                                )}
                                {!formData.hasSmokeAlarms && (
                                    <p className="text-xs text-red-600 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Legally required on every floor since Oct 2015. Fine up to £5,000.
                                    </p>
                                )}
                            </div>

                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Carbon Monoxide Alarms *</span>
                                    <Checkbox
                                        checked={formData.hasCOAlarms}
                                        onCheckedChange={(checked) => updateField('hasCOAlarms', checked)}
                                    />
                                </div>
                                {formData.hasCOAlarms && (
                                    <div className="flex items-center space-x-2 pl-4">
                                        <Checkbox
                                            checked={formData.coAlarmsTested}
                                            onCheckedChange={(checked) => updateField('coAlarmsTested', checked)}
                                        />
                                        <Label className="text-sm">Tested and working</Label>
                                    </div>
                                )}
                                {!formData.hasCOAlarms && (
                                    <p className="text-xs text-red-600 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" /> Required in rooms with combustion appliances since Oct 2022. Fine up to £5,000.
                                    </p>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                                    <Checkbox
                                        checked={formData.hasFireBlanket}
                                        onCheckedChange={(checked) => updateField('hasFireBlanket', checked)}
                                    />
                                    <Label>Fire Blanket (kitchen)</Label>
                                </div>
                                <div className="flex items-center space-x-2 p-3 border rounded-lg">
                                    <Checkbox
                                        checked={formData.hasFireExtinguisher}
                                        onCheckedChange={(checked) => updateField('hasFireExtinguisher', checked)}
                                    />
                                    <Label>Fire Extinguisher</Label>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'checklist' && (
                    <div className="space-y-6">
                        {/* Compliance Review */}
                        <ComplianceChecklist
                            title="Regulatory Compliance Review"
                            subtitle="All critical items must pass before the property can be legally let"
                            items={complianceItems}
                            onNavigateToStep={(step) => setCurrentStep(step as WizardStep)}
                            showSummary={true}
                            blockOnCritical={true}
                        />

                        {/* Additional checklist items */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Check className="h-5 w-5" />
                                    Pre-Tenancy Checklist
                                </CardTitle>
                                <CardDescription>
                                    Additional items for property readiness
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-3">
                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                        <Checkbox
                                            checked={formData.inventoryCompleted}
                                            onCheckedChange={(checked) => updateField('inventoryCompleted', checked)}
                                        />
                                        <div>
                                            <Label className="font-medium">Inventory Completed</Label>
                                            <p className="text-sm text-muted-foreground">Full inventory with photos</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                        <Checkbox
                                            checked={formData.keysAvailable}
                                            onCheckedChange={(checked) => updateField('keysAvailable', checked)}
                                        />
                                        <div>
                                            <Label className="font-medium">Keys Available</Label>
                                            <p className="text-sm text-muted-foreground">All sets of keys ready</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                        <Checkbox
                                            checked={formData.utilitiesSetup}
                                            onCheckedChange={(checked) => updateField('utilitiesSetup', checked)}
                                        />
                                        <div>
                                            <Label className="font-medium">Utilities Setup</Label>
                                            <p className="text-sm text-muted-foreground">Gas, electric, water arrangements</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                        <Checkbox
                                            checked={formData.councilTaxNotified}
                                            onCheckedChange={(checked) => updateField('councilTaxNotified', checked)}
                                        />
                                        <div>
                                            <Label className="font-medium">Council Tax Notified</Label>
                                            <p className="text-sm text-muted-foreground">Council informed of change</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-3 p-3 border rounded-lg">
                                        <Checkbox
                                            checked={formData.insuranceInPlace}
                                            onCheckedChange={(checked) => updateField('insuranceInPlace', checked)}
                                        />
                                        <div>
                                            <Label className="font-medium">Landlord Insurance</Label>
                                            <p className="text-sm text-muted-foreground">Buildings and contents insurance</p>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <Label>Notes</Label>
                                    <Textarea
                                        value={formData.notes}
                                        onChange={(e) => updateField('notes', e.target.value)}
                                        rows={3}
                                        placeholder="Any additional notes about the property..."
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Navigation */}
                <div className="flex justify-between mt-6">
                    <Button
                        variant="outline"
                        onClick={goBack}
                        disabled={currentStepIndex === 0}
                    >
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back
                    </Button>

                    {isLastStep ? (
                        <div className="flex items-center gap-3">
                            {hasCriticalFailures && (
                                <p className="text-sm text-red-600 flex items-center gap-1">
                                    <AlertTriangle className="h-4 w-4" />
                                    Critical compliance items pending
                                </p>
                            )}
                            <Button
                                onClick={() => saveMutation.mutate()}
                                disabled={!canProceed() || saveMutation.isPending}
                                className={hasCriticalFailures
                                    ? "bg-gradient-to-r from-amber-600 to-orange-600"
                                    : "bg-gradient-to-r from-green-600 to-emerald-600"
                                }
                            >
                                {saveMutation.isPending
                                    ? 'Saving...'
                                    : hasCriticalFailures
                                        ? 'Save with Warnings'
                                        : 'Complete Onboarding'
                                }
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={goNext} disabled={!canProceed()}>
                            Next
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
