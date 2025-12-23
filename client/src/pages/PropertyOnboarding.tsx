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

    // Calculate compliance status
    const complianceItems = [
        { name: 'Gas Safety Certificate', valid: formData.hasGasSafetyCert, critical: true },
        { name: 'EICR', valid: formData.hasEicr, critical: true },
        { name: 'EPC', valid: formData.hasEpc, critical: true },
        { name: 'Smoke Alarms', valid: formData.hasSmokeAlarms && formData.smokeAlarmsTested, critical: true },
        { name: 'CO Alarms', valid: formData.hasCOAlarms && formData.coAlarmsTested, critical: true },
        { name: 'Inventory', valid: formData.inventoryCompleted, critical: false },
        { name: 'Insurance', valid: formData.insuranceInPlace, critical: false }
    ];
    const criticalItems = complianceItems.filter(i => i.critical);
    const criticalCompliant = criticalItems.filter(i => i.valid).length;

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
                                                {landlord.fullName}
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
                                            <Label className="text-xs">Expiry Date</Label>
                                            <Input
                                                type="date"
                                                value={formData.gasSafetyCertExpiry}
                                                onChange={(e) => updateField('gasSafetyCertExpiry', e.target.value)}
                                            />
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
                                            <Label className="text-xs">Expiry Date</Label>
                                            <Input
                                                type="date"
                                                value={formData.eicrExpiry}
                                                onChange={(e) => updateField('eicrExpiry', e.target.value)}
                                            />
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
                                            <Label className="text-xs">Rating</Label>
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
                                            <Label className="text-xs">Expiry Date</Label>
                                            <Input
                                                type="date"
                                                value={formData.epcExpiry}
                                                onChange={(e) => updateField('epcExpiry', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {!formData.hasGasSafetyCert || !formData.hasEicr || !formData.hasEpc ? (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-4">
                                    <div className="flex gap-2">
                                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                                        <div>
                                            <p className="font-medium text-amber-800 dark:text-amber-200">Missing Certificates</p>
                                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                                Properties cannot be legally let without valid Gas Safety, EICR, and EPC certificates.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ) : null}
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
                            </div>

                            <div className="border rounded-lg p-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium">Carbon Monoxide Alarms</span>
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
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Check className="h-5 w-5" />
                                Property Checklist
                            </CardTitle>
                            <CardDescription>
                                Pre-tenancy checklist items
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Compliance Summary */}
                            <div className={`p-4 rounded-lg border ${criticalCompliant === criticalItems.length
                                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200'
                                    : 'bg-red-50 dark:bg-red-950/30 border-red-200'
                                }`}>
                                <p className={`font-medium ${criticalCompliant === criticalItems.length ? 'text-green-700' : 'text-red-700'
                                    }`}>
                                    Compliance Status: {criticalCompliant}/{criticalItems.length} critical items complete
                                </p>
                            </div>

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
                        <Button
                            onClick={() => saveMutation.mutate()}
                            disabled={!canProceed() || saveMutation.isPending}
                            className="bg-gradient-to-r from-green-600 to-emerald-600"
                        >
                            {saveMutation.isPending ? 'Saving...' : 'Complete Onboarding'}
                        </Button>
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
