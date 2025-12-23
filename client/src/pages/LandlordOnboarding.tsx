import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
    ArrowLeft, ArrowRight, User, Building, CreditCard, FileText,
    Shield, Check, Upload, AlertCircle
} from 'lucide-react';

interface LandlordFormData {
    // Personal Details
    fullName: string;
    email: string;
    phone: string;
    mobile: string;
    address: string;
    landlordType: 'individual' | 'company';
    companyName?: string;
    companyRegNumber?: string;

    // Bank Details
    bankName: string;
    accountName: string;
    accountNumber: string;
    sortCode: string;

    // Tax Status
    isUkResident: boolean;
    nrlNumber?: string; // Non-Resident Landlord scheme number
    hasNrlExemption: boolean;

    // KYC Documents
    idDocumentUploaded: boolean;
    proofOfAddressUploaded: boolean;
    proofOfOwnershipUploaded: boolean;

    // Compliance Acknowledgement
    understandsGasSafety: boolean;
    understandsEicr: boolean;
    understandsEpc: boolean;
    understandsDepositProtection: boolean;
    agreesToTerms: boolean;
}

type WizardStep = 'personal' | 'banking' | 'tax' | 'documents' | 'compliance';

const steps: { key: WizardStep; label: string; icon: typeof User }[] = [
    { key: 'personal', label: 'Personal Details', icon: User },
    { key: 'banking', label: 'Bank Details', icon: CreditCard },
    { key: 'tax', label: 'Tax Status', icon: Building },
    { key: 'documents', label: 'Documents', icon: FileText },
    { key: 'compliance', label: 'Compliance', icon: Shield }
];

export default function LandlordOnboarding() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [currentStep, setCurrentStep] = useState<WizardStep>('personal');
    const [formData, setFormData] = useState<LandlordFormData>({
        fullName: '',
        email: '',
        phone: '',
        mobile: '',
        address: '',
        landlordType: 'individual',
        bankName: '',
        accountName: '',
        accountNumber: '',
        sortCode: '',
        isUkResident: true,
        hasNrlExemption: false,
        idDocumentUploaded: false,
        proofOfAddressUploaded: false,
        proofOfOwnershipUploaded: false,
        understandsGasSafety: false,
        understandsEicr: false,
        understandsEpc: false,
        understandsDepositProtection: false,
        agreesToTerms: false
    });

    const currentStepIndex = steps.findIndex(s => s.key === currentStep);
    const progress = ((currentStepIndex + 1) / steps.length) * 100;

    const updateField = (field: keyof LandlordFormData, value: any) => {
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
            const response = await fetch('/api/crm/landlords', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error('Failed to save landlord');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords'] });
            toast({ title: 'Success', description: 'Landlord has been onboarded successfully!' });
            setLocation('/crm/landlords');
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to save landlord.', variant: 'destructive' });
        }
    });

    const canProceed = () => {
        switch (currentStep) {
            case 'personal':
                return formData.fullName && formData.email;
            case 'banking':
                return formData.bankName && formData.accountNumber && formData.sortCode;
            case 'tax':
                return true;
            case 'documents':
                return formData.idDocumentUploaded;
            case 'compliance':
                return formData.understandsGasSafety && formData.understandsEicr &&
                    formData.understandsEpc && formData.understandsDepositProtection &&
                    formData.agreesToTerms;
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
                            <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/landlords')}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-semibold">Landlord Onboarding</h1>
                                <p className="text-sm text-muted-foreground">
                                    Complete all steps to register a new landlord
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
                {currentStep === 'personal' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5" />
                                Personal Details
                            </CardTitle>
                            <CardDescription>
                                Enter the landlord's contact information
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <Label>Landlord Type</Label>
                                    <Select
                                        value={formData.landlordType}
                                        onValueChange={(v) => updateField('landlordType', v)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="individual">Individual</SelectItem>
                                            <SelectItem value="company">Company / Corporate</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {formData.landlordType === 'company' && (
                                    <>
                                        <div>
                                            <Label>Company Name *</Label>
                                            <Input
                                                value={formData.companyName || ''}
                                                onChange={(e) => updateField('companyName', e.target.value)}
                                                placeholder="ABC Properties Ltd"
                                            />
                                        </div>
                                        <div>
                                            <Label>Company Reg Number</Label>
                                            <Input
                                                value={formData.companyRegNumber || ''}
                                                onChange={(e) => updateField('companyRegNumber', e.target.value)}
                                                placeholder="12345678"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="col-span-2">
                                    <Label>Full Name *</Label>
                                    <Input
                                        value={formData.fullName}
                                        onChange={(e) => updateField('fullName', e.target.value)}
                                        placeholder="John Smith"
                                    />
                                </div>

                                <div>
                                    <Label>Email *</Label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => updateField('email', e.target.value)}
                                        placeholder="john@example.com"
                                    />
                                </div>

                                <div>
                                    <Label>Phone</Label>
                                    <Input
                                        value={formData.phone}
                                        onChange={(e) => updateField('phone', e.target.value)}
                                        placeholder="020 1234 5678"
                                    />
                                </div>

                                <div>
                                    <Label>Mobile</Label>
                                    <Input
                                        value={formData.mobile}
                                        onChange={(e) => updateField('mobile', e.target.value)}
                                        placeholder="07123 456789"
                                    />
                                </div>

                                <div className="col-span-2">
                                    <Label>Address</Label>
                                    <Textarea
                                        value={formData.address}
                                        onChange={(e) => updateField('address', e.target.value)}
                                        placeholder="Full postal address"
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'banking' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                Bank Details
                            </CardTitle>
                            <CardDescription>
                                For rent payments to the landlord
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label>Bank Name *</Label>
                                <Input
                                    value={formData.bankName}
                                    onChange={(e) => updateField('bankName', e.target.value)}
                                    placeholder="Barclays, HSBC, etc."
                                />
                            </div>

                            <div>
                                <Label>Account Name</Label>
                                <Input
                                    value={formData.accountName}
                                    onChange={(e) => updateField('accountName', e.target.value)}
                                    placeholder="Name as it appears on account"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Account Number *</Label>
                                    <Input
                                        value={formData.accountNumber}
                                        onChange={(e) => updateField('accountNumber', e.target.value)}
                                        placeholder="12345678"
                                        maxLength={8}
                                    />
                                </div>

                                <div>
                                    <Label>Sort Code *</Label>
                                    <Input
                                        value={formData.sortCode}
                                        onChange={(e) => updateField('sortCode', e.target.value)}
                                        placeholder="12-34-56"
                                    />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'tax' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building className="h-5 w-5" />
                                Tax Status
                            </CardTitle>
                            <CardDescription>
                                Non-resident landlord scheme details
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center space-x-2">
                                <Checkbox
                                    id="ukResident"
                                    checked={formData.isUkResident}
                                    onCheckedChange={(checked) => updateField('isUkResident', checked)}
                                />
                                <Label htmlFor="ukResident">Landlord is a UK tax resident</Label>
                            </div>

                            {!formData.isUkResident && (
                                <>
                                    <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-4">
                                        <div className="flex gap-2">
                                            <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-amber-800 dark:text-amber-200">
                                                    Non-Resident Landlord Scheme
                                                </p>
                                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                                                    For landlords who normally live outside the UK, tax must be deducted from rent
                                                    unless they have HMRC approval to receive rent without tax deducted.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="nrlExemption"
                                            checked={formData.hasNrlExemption}
                                            onCheckedChange={(checked) => updateField('hasNrlExemption', checked)}
                                        />
                                        <Label htmlFor="nrlExemption">
                                            Has HMRC approval to receive rent without tax deducted
                                        </Label>
                                    </div>

                                    {formData.hasNrlExemption && (
                                        <div>
                                            <Label>NRL Approval Number</Label>
                                            <Input
                                                value={formData.nrlNumber || ''}
                                                onChange={(e) => updateField('nrlNumber', e.target.value)}
                                                placeholder="Enter NRL approval number"
                                            />
                                        </div>
                                    )}
                                </>
                            )}
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'documents' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText className="h-5 w-5" />
                                KYC Documents
                            </CardTitle>
                            <CardDescription>
                                Required identity and ownership verification documents
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Photo ID *</p>
                                        <p className="text-sm text-muted-foreground">
                                            Passport, driving licence, or national ID card
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

                            <div className="border rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Proof of Property Ownership</p>
                                        <p className="text-sm text-muted-foreground">
                                            Title deed, mortgage statement, or land registry document
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Checkbox
                                            checked={formData.proofOfOwnershipUploaded}
                                            onCheckedChange={(checked) => updateField('proofOfOwnershipUploaded', checked)}
                                        />
                                        <Button variant="outline" size="sm">
                                            <Upload className="h-4 w-4 mr-2" />
                                            Upload
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {currentStep === 'compliance' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Shield className="h-5 w-5" />
                                Compliance Acknowledgement
                            </CardTitle>
                            <CardDescription>
                                Confirm understanding of legal requirements
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-3">
                                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                                    <Checkbox
                                        id="gasSafety"
                                        checked={formData.understandsGasSafety}
                                        onCheckedChange={(checked) => updateField('understandsGasSafety', checked)}
                                    />
                                    <div>
                                        <Label htmlFor="gasSafety" className="font-medium">Gas Safety Certificate</Label>
                                        <p className="text-sm text-muted-foreground">
                                            I understand that an annual gas safety check (CP12) is required and must be
                                            provided to tenants within 28 days.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                                    <Checkbox
                                        id="eicr"
                                        checked={formData.understandsEicr}
                                        onCheckedChange={(checked) => updateField('understandsEicr', checked)}
                                    />
                                    <div>
                                        <Label htmlFor="eicr" className="font-medium">Electrical Safety (EICR)</Label>
                                        <p className="text-sm text-muted-foreground">
                                            I understand that an Electrical Installation Condition Report is required
                                            every 5 years and must be provided to tenants.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                                    <Checkbox
                                        id="epc"
                                        checked={formData.understandsEpc}
                                        onCheckedChange={(checked) => updateField('understandsEpc', checked)}
                                    />
                                    <div>
                                        <Label htmlFor="epc" className="font-medium">Energy Performance Certificate</Label>
                                        <p className="text-sm text-muted-foreground">
                                            I understand the property must have a valid EPC with a minimum rating of E
                                            (C from 2025) and be provided to tenants.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 border rounded-lg">
                                    <Checkbox
                                        id="deposit"
                                        checked={formData.understandsDepositProtection}
                                        onCheckedChange={(checked) => updateField('understandsDepositProtection', checked)}
                                    />
                                    <div>
                                        <Label htmlFor="deposit" className="font-medium">Deposit Protection</Label>
                                        <p className="text-sm text-muted-foreground">
                                            I understand that tenant deposits must be protected in a government-approved
                                            scheme within 30 days and prescribed information provided.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start space-x-3 p-3 border rounded-lg bg-primary/5">
                                    <Checkbox
                                        id="terms"
                                        checked={formData.agreesToTerms}
                                        onCheckedChange={(checked) => updateField('agreesToTerms', checked)}
                                    />
                                    <div>
                                        <Label htmlFor="terms" className="font-medium">Terms & Conditions</Label>
                                        <p className="text-sm text-muted-foreground">
                                            I agree to the terms of the management agreement and understand my
                                            responsibilities as a landlord.
                                        </p>
                                    </div>
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
