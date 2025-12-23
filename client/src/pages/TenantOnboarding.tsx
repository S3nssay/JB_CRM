import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
    ArrowLeft, ArrowRight, User, FileCheck, Users, Shield,
    Check, Upload, Briefcase, Home, AlertCircle, CreditCard
} from 'lucide-react';

interface TenantFormData {
    // Personal Details
    fullName: string;
    email: string;
    phone: string;
    mobile: string;
    currentAddress: string;
    dateOfBirth: string;
    nationality: string;

    // Employment
    employmentStatus: 'employed' | 'self-employed' | 'student' | 'retired' | 'other';
    employerName: string;
    employerAddress: string;
    jobTitle: string;
    annualIncome: string;

    // Right to Rent
    hasRightToRent: boolean;
    rightToRentDocType: string;
    rightToRentChecked: boolean;

    // References
    previousLandlordName: string;
    previousLandlordContact: string;
    previousLandlordEmail: string;
    bankReferenceName: string;
    bankReferenceAccountNo: string;
    employerReferenceName: string;
    employerReferenceContact: string;

    // Guarantor
    requiresGuarantor: boolean;
    guarantorName: string;
    guarantorEmail: string;
    guarantorPhone: string;
    guarantorAddress: string;
    guarantorRelationship: string;

    // ID Verification
    idDocumentUploaded: boolean;
    proofOfAddressUploaded: boolean;

    // Terms
    agreesToTerms: boolean;
}

type WizardStep = 'personal' | 'employment' | 'right-to-rent' | 'references' | 'guarantor' | 'documents';

const steps: { key: WizardStep; label: string; icon: typeof User }[] = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'employment', label: 'Employment', icon: Briefcase },
    { key: 'right-to-rent', label: 'Right to Rent', icon: Home },
    { key: 'references', label: 'References', icon: Users },
    { key: 'guarantor', label: 'Guarantor', icon: Shield },
    { key: 'documents', label: 'Documents', icon: FileCheck }
];

export default function TenantOnboarding() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState<WizardStep>('personal');
    const [formData, setFormData] = useState<TenantFormData>({
        fullName: '',
        email: '',
        phone: '',
        mobile: '',
        currentAddress: '',
        dateOfBirth: '',
        nationality: '',
        employmentStatus: 'employed',
        employerName: '',
        employerAddress: '',
        jobTitle: '',
        annualIncome: '',
        hasRightToRent: true,
        rightToRentDocType: '',
        rightToRentChecked: false,
        previousLandlordName: '',
        previousLandlordContact: '',
        previousLandlordEmail: '',
        bankReferenceName: '',
        bankReferenceAccountNo: '',
        employerReferenceName: '',
        employerReferenceContact: '',
        requiresGuarantor: false,
        guarantorName: '',
        guarantorEmail: '',
        guarantorPhone: '',
        guarantorAddress: '',
        guarantorRelationship: '',
        idDocumentUploaded: false,
        proofOfAddressUploaded: false,
        agreesToTerms: false
    });

    const currentStepIndex = steps.findIndex(s => s.key === currentStep);
    const progress = ((currentStepIndex + 1) / steps.length) * 100;

    const updateField = (field: keyof TenantFormData, value: any) => {
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
            const response = await fetch('/api/crm/tenants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error('Failed to save tenant');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crm/tenants'] });
            toast({ title: 'Success', description: 'Tenant has been onboarded successfully!' });
            setLocation('/crm/tenants');
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to save tenant.', variant: 'destructive' });
        }
    });

    const canProceed = () => {
        switch (currentStep) {
            case 'personal':
                return formData.fullName && formData.email;
            case 'employment':
                return true;
            case 'right-to-rent':
                return formData.hasRightToRent;
            case 'references':
                return true;
            case 'guarantor':
                return !formData.requiresGuarantor || (formData.guarantorName && formData.guarantorEmail);
            case 'documents':
                return formData.idDocumentUploaded && formData.agreesToTerms;
            default:
                return true;
        }
    };

    const isLastStep = currentStepIndex === steps.length - 1;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background">
            {/* Header */}
            <div className="bg-white dark:bg-card border-b">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/tenants')}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-semibold">Tenant Onboarding</h1>
                                <p className="text-sm text-muted-foreground">
                                    Complete all steps to register a new tenant
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
                                className={`flex items-center gap-1 ${idx <= currentStepIndex ? 'text-primary' : 'text-muted-foreground'
                                    }`}
                            >
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${idx < currentStepIndex
                                        ? 'bg-primary text-primary-foreground'
                                        : idx === currentStepIndex
                                            ? 'bg-primary/20 text-primary border-2 border-primary'
                                            : 'bg-muted text-muted-foreground'
                                    }`}>
                                    {idx < currentStepIndex ? <Check className="h-3 w-3" /> : idx + 1}
                                </div>
                                <span className="hidden lg:inline text-xs">{step.label}</span>
                            </div>
                        ))}
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                {/* Step Content */}
                {currentStep === 'personal' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Personal Details
                            </CardTitle>
                            <CardDescription>
                                Enter the tenant's contact information
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <Label>Full Name *</Label>
                                    <Input
                                        value={formData.fullName}
                                        onChange={(e) => updateField('fullName', e.target.value)}
                                        placeholder="Full legal name"
                                    />
                                </div>

                                <div>
                                    <Label>Email *</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label>Mobile</Label>
                                    <Input
                                        value={formData.mobile}
                                        onChange={(e) => updateField('mobile', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label>Date of Birth</Label>
                                    <Input
                                        type="date"
                                        value={formData.dateOfBirth}
                                        onChange={(e) => updateField('dateOfBirth', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label>Nationality</Label>
                                    <Input
                                        value={formData.nationality}
                                        onChange={(e) => updateField('nationality', e.target.value)}
                                    />
                                </div>

                                <div className="col-span-2">
                                    <Label>Current Address</Label>
                                    <Textarea
                                        value={formData.currentAddress}
                                        onChange={(e) => updateField('currentAddress', e.target.value)}
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'employment' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5" />
                                Employment Details
                            </CardTitle>
                            <CardDescription>
                                For income verification and referencing
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Employer Name</Label>
                                <Input
                                    value={formData.employerName}
                                    onChange={(e) => updateField('employerName', e.target.value)}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Job Title</Label>
                                    <Input
                                        value={formData.jobTitle}
                                        onChange={(e) => updateField('jobTitle', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <Label>Annual Income (£)</Label>
                                    <Input
                                        type="number"
                                        value={formData.annualIncome}
                                        onChange={(e) => updateField('annualIncome', e.target.value)}
                                    />
                                </div>
                            </div>

                            <div>
                                <Label>Employer Address</Label>
                                <Textarea
                                    value={formData.employerAddress}
                                    onChange={(e) => updateField('employerAddress', e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'right-to-rent' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Home className="h-5 w-5" />
                                Right to Rent Check
                            </CardTitle>
                            <CardDescription>
                                Legal requirement to verify tenant's right to rent in the UK
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-4 mb-4">
                                <div className="flex gap-2">
                                    <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800 dark:text-amber-200">
                                            Legal Requirement
                                        </p>
                                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                            Landlords must check that tenants have the right to rent in England before
                                            letting a property. Failure to do so can result in fines up to £3,000.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="rightToRent"
                                    checked={formData.hasRightToRent}
                                    onCheckedChange={(checked) => updateField('hasRightToRent', checked)}
                                />
                                <Label htmlFor="rightToRent">
                                    Tenant has confirmed right to rent in the UK
                                </Label>
                            </div>

                            <div>
                                <Label>Document Type Used</Label>
                                <Input
                                    value={formData.rightToRentDocType}
                                    onChange={(e) => updateField('rightToRentDocType', e.target.value)}
                                    placeholder="e.g., British Passport, BRP, Share Code"
                                />
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="rightToRentChecked"
                                    checked={formData.rightToRentChecked}
                                    onCheckedChange={(checked) => updateField('rightToRentChecked', checked)}
                                />
                                <Label htmlFor="rightToRentChecked">
                                    Right to rent check completed and documented
                                </Label>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'references' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="h-5 w-5" />
                                References
                            </CardTitle>
                            <CardDescription>
                                Previous landlord and other references
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <h4 className="font-medium">Previous Landlord</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Name</Label>
                                        <Input
                                            value={formData.previousLandlordName}
                                            onChange={(e) => updateField('previousLandlordName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Phone</Label>
                                        <Input
                                            value={formData.previousLandlordContact}
                                            onChange={(e) => updateField('previousLandlordContact', e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <Label>Email</Label>
                                        <Input
                                            type="email"
                                            value={formData.previousLandlordEmail}
                                            onChange={(e) => updateField('previousLandlordEmail', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="font-medium">Employer Reference</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <Label>Contact Name</Label>
                                        <Input
                                            value={formData.employerReferenceName}
                                            onChange={(e) => updateField('employerReferenceName', e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <Label>Contact Details</Label>
                                        <Input
                                            value={formData.employerReferenceContact}
                                            onChange={(e) => updateField('employerReferenceContact', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'guarantor' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Guarantor Details
                            </CardTitle>
                            <CardDescription>
                                If a guarantor is required for this tenancy
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="requiresGuarantor"
                                    checked={formData.requiresGuarantor}
                                    onCheckedChange={(checked) => updateField('requiresGuarantor', checked)}
                                />
                                <Label htmlFor="requiresGuarantor">
                                    This tenant requires a guarantor
                                </Label>
                            </div>

                            {formData.requiresGuarantor && (
                                <div className="space-y-4 pt-4 border-t">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="col-span-2">
                                            <Label>Guarantor Full Name *</Label>
                                            <Input
                                                value={formData.guarantorName}
                                                onChange={(e) => updateField('guarantorName', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Email *</Label>
                                            <Input
                                                type="email"
                                                value={formData.guarantorEmail}
                                                onChange={(e) => updateField('guarantorEmail', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <Label>Phone</Label>
                                            <Input
                                                value={formData.guarantorPhone}
                                                onChange={(e) => updateField('guarantorPhone', e.target.value)}
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <Label>Address</Label>
                                            <Textarea
                                                value={formData.guarantorAddress}
                                                onChange={(e) => updateField('guarantorAddress', e.target.value)}
                                                rows={2}
                                            />
                                        </div>
                                        <div>
                                            <Label>Relationship to Tenant</Label>
                                            <Input
                                                value={formData.guarantorRelationship}
                                                onChange={(e) => updateField('guarantorRelationship', e.target.value)}
                                                placeholder="e.g., Parent, Relative"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'documents' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileCheck className="h-5 w-5" />
                                Documents & Verification
                            </CardTitle>
                            <CardDescription>
                                Required identification documents
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Photo ID *</p>
                                        <p className="text-sm text-muted-foreground">
                                            Passport, driving licence, or national ID
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={formData.idDocumentUploaded}
                                            onCheckedChange={(checked) => updateField('idDocumentUploaded', checked)}
                                        />
                                        <Button variant="outline" size="sm">
                                            <Upload className="h-4 w-4 mr-2" />
                                            Upload
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Proof of Address</p>
                                        <p className="text-sm text-muted-foreground">
                                            Utility bill or bank statement (within 3 months)
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={formData.proofOfAddressUploaded}
                                            onCheckedChange={(checked) => updateField('proofOfAddressUploaded', checked)}
                                        />
                                        <Button variant="outline" size="sm">
                                            <Upload className="h-4 w-4 mr-2" />
                                            Upload
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-start space-x-3 p-3 border rounded-lg bg-primary/5">
                                <Checkbox
                                    id="terms"
                                    checked={formData.agreesToTerms}
                                    onCheckedChange={(checked) => updateField('agreesToTerms', checked)}
                                />
                                <div>
                                    <Label htmlFor="terms" className="font-medium">Terms & Conditions *</Label>
                                    <p className="text-sm text-muted-foreground">
                                        I confirm all information provided is accurate and I consent to
                                        referencing checks being carried out.
                                    </p>
                                </div>
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
