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
    Check, Upload, Briefcase, Home, AlertCircle, CreditCard, AlertTriangle
} from 'lucide-react';
import { ComplianceChecklist, ComplianceItem } from '@/components/ComplianceChecklist';

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

type WizardStep = 'personal' | 'employment' | 'right-to-rent' | 'references' | 'guarantor' | 'documents' | 'payment-setup';

const steps: { key: WizardStep; label: string; icon: typeof User }[] = [
    { key: 'personal', label: 'Personal', icon: User },
    { key: 'employment', label: 'Employment', icon: Briefcase },
    { key: 'right-to-rent', label: 'Right to Rent', icon: Home },
    { key: 'references', label: 'References', icon: Users },
    { key: 'guarantor', label: 'Guarantor', icon: Shield },
    { key: 'documents', label: 'Documents', icon: FileCheck },
    { key: 'payment-setup', label: 'Payment', icon: CreditCard }
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
            case 'payment-setup':
                return true; // Payment setup is optional
            default:
                return true;
        }
    };

    const isLastStep = currentStepIndex === steps.length - 1;

    // Build compliance items for the payment-setup (final) step
    const getComplianceItems = (): ComplianceItem[] => {
        const items: ComplianceItem[] = [];

        // Right to Rent - CRITICAL
        items.push({
            id: 'right_to_rent',
            label: 'Right to Rent Verification',
            description: !formData.hasRightToRent
                ? 'Tenant has not confirmed right to rent in the UK'
                : !formData.rightToRentChecked
                    ? 'Right to rent confirmed but document check not completed'
                    : !formData.rightToRentDocType
                        ? 'Right to rent check completed but document type not recorded'
                        : 'Right to rent verified with ' + formData.rightToRentDocType,
            passed: formData.hasRightToRent && formData.rightToRentChecked,
            severity: 'critical',
            actionStep: 'right-to-rent',
            actionLabel: 'Verify',
            penalty: 'Civil penalty up to £3,000 per tenant. Potential criminal prosecution.',
            legalReference: 'Immigration Act 2014 - Right to Rent',
        });

        // Photo ID - CRITICAL
        items.push({
            id: 'photo_id',
            label: 'Photo ID Verification',
            description: formData.idDocumentUploaded
                ? 'Photo ID document uploaded and confirmed'
                : 'No photo ID uploaded - required for identity verification and AML compliance',
            passed: formData.idDocumentUploaded,
            severity: 'critical',
            actionStep: 'documents',
            actionLabel: 'Upload',
            penalty: 'Non-compliant with AML regulations',
            legalReference: 'Money Laundering Regulations 2017',
        });

        // Terms Agreement - CRITICAL
        items.push({
            id: 'terms_agreement',
            label: 'Terms & Conditions Agreement',
            description: formData.agreesToTerms
                ? 'Tenant has agreed to terms and conditions and consented to reference checks'
                : 'Terms not agreed - required before tenancy can proceed',
            passed: formData.agreesToTerms,
            severity: 'critical',
            actionStep: 'documents',
            actionLabel: 'Agree',
        });

        // Proof of Address - WARNING
        items.push({
            id: 'proof_of_address',
            label: 'Proof of Address',
            description: formData.proofOfAddressUploaded
                ? 'Proof of address document uploaded'
                : 'No proof of address uploaded - recommended for KYC compliance',
            passed: formData.proofOfAddressUploaded,
            severity: 'warning',
            actionStep: 'documents',
            actionLabel: 'Upload',
        });

        // Employment Verification - WARNING
        items.push({
            id: 'employment_verification',
            label: 'Employment Details',
            description: formData.employerName && formData.annualIncome
                ? `Employed at ${formData.employerName} - income £${Number(formData.annualIncome).toLocaleString()}`
                : !formData.employerName && !formData.annualIncome
                    ? 'No employment details provided - income affordability cannot be assessed'
                    : !formData.annualIncome
                        ? 'Annual income not provided - affordability check incomplete'
                        : 'Employer name not provided',
            passed: !!(formData.employerName && formData.annualIncome),
            severity: 'warning',
            actionStep: 'employment',
            actionLabel: 'Complete',
        });

        // Previous Landlord Reference - WARNING
        items.push({
            id: 'previous_landlord',
            label: 'Previous Landlord Reference',
            description: formData.previousLandlordName && formData.previousLandlordContact
                ? `Reference from ${formData.previousLandlordName} available`
                : 'No previous landlord reference provided - recommended for tenant screening',
            passed: !!(formData.previousLandlordName && formData.previousLandlordContact),
            severity: 'warning',
            actionStep: 'references',
            actionLabel: 'Add',
        });

        // Guarantor completeness - WARNING (only if required)
        if (formData.requiresGuarantor) {
            items.push({
                id: 'guarantor',
                label: 'Guarantor Details',
                description: formData.guarantorName && formData.guarantorEmail && formData.guarantorAddress
                    ? `Guarantor: ${formData.guarantorName} (${formData.guarantorRelationship || 'relationship not specified'})`
                    : 'Guarantor required but details incomplete - name, email, and address needed',
                passed: !!(formData.guarantorName && formData.guarantorEmail && formData.guarantorAddress),
                severity: 'warning',
                actionStep: 'guarantor',
                actionLabel: 'Complete',
            });
        }

        // Contact details - INFO
        items.push({
            id: 'contact_details',
            label: 'Complete Contact Information',
            description: formData.mobile
                ? 'Mobile number provided for emergency contact'
                : 'No mobile number provided - recommended for urgent communications',
            passed: !!formData.mobile,
            severity: 'info',
            actionStep: 'personal',
            actionLabel: 'Add',
        });

        // Date of Birth - INFO
        items.push({
            id: 'date_of_birth',
            label: 'Date of Birth',
            description: formData.dateOfBirth
                ? 'Date of birth recorded'
                : 'Date of birth not provided - useful for identity verification',
            passed: !!formData.dateOfBirth,
            severity: 'info',
            actionStep: 'personal',
            actionLabel: 'Add',
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

                            {!formData.employerName && !formData.annualIncome && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3">
                                    <div className="flex gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            Employment and income details are needed to assess affordability. Without this, the tenant may fail referencing.
                                        </p>
                                    </div>
                                </div>
                            )}
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
                            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg p-4 mb-4">
                                <div className="flex gap-2">
                                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-red-800 dark:text-red-200">
                                            Mandatory Legal Requirement
                                        </p>
                                        <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                            Under the Immigration Act 2014, landlords must check that tenants have the right to rent
                                            in England before letting a property. Failure to do so can result in a civil penalty
                                            of up to £3,000 per tenant, or criminal prosecution for repeat offences.
                                        </p>
                                        <p className="text-sm text-red-700 dark:text-red-300 mt-2 font-medium">
                                            Both the original document check AND a recorded verification are required.
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
                                <Label>Document Type Used *</Label>
                                <Input
                                    value={formData.rightToRentDocType}
                                    onChange={(e) => updateField('rightToRentDocType', e.target.value)}
                                    placeholder="e.g., British Passport, BRP, Share Code"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                    Record which document was used for the right to rent check
                                </p>
                            </div>

                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="rightToRentChecked"
                                    checked={formData.rightToRentChecked}
                                    onCheckedChange={(checked) => updateField('rightToRentChecked', checked)}
                                />
                                <Label htmlFor="rightToRentChecked" className="font-medium">
                                    Right to rent check completed and documented
                                </Label>
                            </div>

                            {formData.hasRightToRent && !formData.rightToRentChecked && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3">
                                    <div className="flex gap-2">
                                        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-700 dark:text-amber-300">
                                            The tenant has confirmed their right to rent, but the check has not been marked as completed.
                                            You must physically verify the original document and record the check.
                                        </p>
                                    </div>
                                </div>
                            )}
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
                                {!formData.previousLandlordName && (
                                    <p className="text-xs text-amber-600 flex items-center gap-1">
                                        <AlertTriangle className="h-3 w-3" />
                                        Previous landlord reference is strongly recommended for tenant screening
                                    </p>
                                )}
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
                            <div className={`border rounded-lg p-4 ${!formData.idDocumentUploaded ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' : 'border-green-200 bg-green-50/50 dark:bg-green-950/10'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Photo ID *</p>
                                        <p className="text-sm text-muted-foreground">
                                            Passport, driving licence, or national ID
                                        </p>
                                        {!formData.idDocumentUploaded && (
                                            <p className="text-xs text-red-600 mt-1">Required for identity verification and AML compliance</p>
                                        )}
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

                            <div className={`border rounded-lg p-4 ${!formData.proofOfAddressUploaded ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10' : 'border-green-200 bg-green-50/50 dark:bg-green-950/10'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Proof of Address</p>
                                        <p className="text-sm text-muted-foreground">
                                            Utility bill or bank statement (within 3 months)
                                        </p>
                                        {!formData.proofOfAddressUploaded && (
                                            <p className="text-xs text-amber-600 mt-1">Recommended for KYC compliance</p>
                                        )}
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

                {currentStep === 'payment-setup' && (
                    <div className="space-y-6">
                        {/* Compliance Review */}
                        <ComplianceChecklist
                            title="Tenant Compliance Review"
                            subtitle="Review all compliance items before completing onboarding"
                            items={complianceItems}
                            onNavigateToStep={(step) => setCurrentStep(step as WizardStep)}
                            showSummary={true}
                            blockOnCritical={true}
                        />

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" />
                                    Payment Setup
                                </CardTitle>
                                <CardDescription>
                                    Choose how rent payments will be collected (optional - can be set up later)
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="border rounded-lg p-4 cursor-pointer hover:border-primary transition-colors bg-green-50/50">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-green-100 rounded-lg mt-1">
                                            <CreditCard className="h-5 w-5 text-green-600" />
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">Direct Debit (Recommended)</p>
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Recommended</span>
                                            </div>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Set up a Direct Debit mandate via GoCardless. Rent is automatically collected on the due date each month.
                                                The tenant will be redirected to authorise the mandate with their bank.
                                            </p>
                                            <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                                                <li className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Automatic collection on due date</li>
                                                <li className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Protected by Direct Debit Guarantee</li>
                                                <li className="flex items-center gap-1"><Check className="h-3 w-3 text-green-600" /> Reduces arrears risk</li>
                                            </ul>
                                            <p className="text-xs text-muted-foreground mt-3 italic">
                                                Note: Direct Debit setup will be completed after tenant record is created. You can set it up from the Direct Debits management page.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border rounded-lg p-4">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-blue-100 rounded-lg mt-1">
                                            <ArrowRight className="h-5 w-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-semibold">Manual Bank Transfer</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                Tenant pays by standing order or manual bank transfer. Payments are reconciled via bank statement import.
                                            </p>
                                            <div className="mt-3 p-3 bg-muted/50 rounded text-sm">
                                                <p className="font-medium mb-1">Company Bank Details:</p>
                                                <p>Account Name: John Barclay Estates Ltd</p>
                                                <p>Sort Code: XX-XX-XX</p>
                                                <p>Account Number: XXXXXXXX</p>
                                                <p className="text-xs text-muted-foreground mt-1">Reference: Tenant name + property address</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-3 border rounded-lg bg-yellow-50/50 border-yellow-200">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                                        <p className="text-sm text-yellow-800">
                                            This step is optional. Payment setup can be configured later from the tenant's profile or the Direct Debits page.
                                        </p>
                                    </div>
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
                                    Critical items pending
                                </p>
                            )}
                            <Button
                                onClick={() => saveMutation.mutate()}
                                disabled={!canProceed() || saveMutation.isPending || hasCriticalFailures}
                                className="bg-gradient-to-r from-green-600 to-emerald-600"
                            >
                                {saveMutation.isPending ? 'Saving...' : 'Complete Onboarding'}
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
