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
    Shield, Check, Upload, AlertCircle, AlertTriangle
} from 'lucide-react';
import { ComplianceChecklist, ComplianceItem } from '@/components/ComplianceChecklist';

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

    // Build compliance items for the final step
    const getComplianceItems = (): ComplianceItem[] => {
        const items: ComplianceItem[] = [];

        // Photo ID - CRITICAL (AML requirement)
        items.push({
            id: 'photo_id',
            label: 'Photo ID Verification (AML/KYC)',
            description: formData.idDocumentUploaded
                ? 'Photo ID uploaded for identity verification'
                : 'No photo ID uploaded - required under Money Laundering Regulations',
            passed: formData.idDocumentUploaded,
            severity: 'critical',
            actionStep: 'documents',
            actionLabel: 'Upload',
            penalty: 'Non-compliant with Money Laundering Regulations 2017',
            legalReference: 'Money Laundering, Terrorist Financing and Transfer of Funds Regulations 2017',
        });

        // Bank Details - CRITICAL
        items.push({
            id: 'bank_details',
            label: 'Bank Account Details',
            description: formData.bankName && formData.accountNumber && formData.sortCode
                ? `Bank: ${formData.bankName} - Account ending ${formData.accountNumber.slice(-4)}`
                : 'Incomplete bank details - required for rent payments to landlord',
            passed: !!(formData.bankName && formData.accountNumber && formData.sortCode),
            severity: 'critical',
            actionStep: 'banking',
            actionLabel: 'Complete',
        });

        // Gas Safety Acknowledgement - CRITICAL
        items.push({
            id: 'gas_safety_ack',
            label: 'Gas Safety Obligation Acknowledged',
            description: formData.understandsGasSafety
                ? 'Landlord understands annual CP12 gas safety check requirement'
                : 'Landlord has not acknowledged gas safety obligations',
            passed: formData.understandsGasSafety,
            severity: 'critical',
            actionStep: 'compliance',
            actionLabel: 'Acknowledge',
            penalty: 'Fine up to £6,000 or imprisonment for non-compliance',
            legalReference: 'Gas Safety (Installation and Use) Regulations 1998',
        });

        // EICR Acknowledgement - CRITICAL
        items.push({
            id: 'eicr_ack',
            label: 'Electrical Safety Obligation Acknowledged',
            description: formData.understandsEicr
                ? 'Landlord understands EICR requirement every 5 years'
                : 'Landlord has not acknowledged electrical safety obligations',
            passed: formData.understandsEicr,
            severity: 'critical',
            actionStep: 'compliance',
            actionLabel: 'Acknowledge',
            penalty: 'Fine up to £30,000',
            legalReference: 'Electrical Safety Standards Regulations 2020',
        });

        // EPC Acknowledgement - CRITICAL
        items.push({
            id: 'epc_ack',
            label: 'EPC Obligation Acknowledged',
            description: formData.understandsEpc
                ? 'Landlord understands minimum EPC rating E (C from 2025) requirement'
                : 'Landlord has not acknowledged EPC obligations',
            passed: formData.understandsEpc,
            severity: 'critical',
            actionStep: 'compliance',
            actionLabel: 'Acknowledge',
            penalty: 'Fine up to £5,000. F/G rated properties cannot be let.',
            legalReference: 'Energy Efficiency (Private Rented Property) Regulations 2015',
        });

        // Deposit Protection Acknowledgement - CRITICAL
        items.push({
            id: 'deposit_ack',
            label: 'Deposit Protection Obligation Acknowledged',
            description: formData.understandsDepositProtection
                ? 'Landlord understands 30-day deposit protection requirement'
                : 'Landlord has not acknowledged deposit protection obligations',
            passed: formData.understandsDepositProtection,
            severity: 'critical',
            actionStep: 'compliance',
            actionLabel: 'Acknowledge',
            penalty: 'Tenant can claim 1-3x deposit amount if not protected within 30 days',
            legalReference: 'Housing Act 2004 - Tenancy Deposit Protection',
        });

        // Terms & Conditions - CRITICAL
        items.push({
            id: 'terms',
            label: 'Management Agreement Terms',
            description: formData.agreesToTerms
                ? 'Landlord has agreed to management terms and conditions'
                : 'Management agreement terms not yet accepted',
            passed: formData.agreesToTerms,
            severity: 'critical',
            actionStep: 'compliance',
            actionLabel: 'Accept',
        });

        // Non-Resident Landlord Tax - WARNING
        if (!formData.isUkResident) {
            items.push({
                id: 'nrl_scheme',
                label: 'Non-Resident Landlord Tax Status',
                description: formData.hasNrlExemption && formData.nrlNumber
                    ? `HMRC NRL exemption number: ${formData.nrlNumber}`
                    : formData.hasNrlExemption
                        ? 'NRL exemption claimed but no approval number provided'
                        : 'Non-UK resident without NRL exemption - basic rate tax must be deducted from rent',
                passed: formData.hasNrlExemption ? !!formData.nrlNumber : true,
                severity: 'warning',
                actionStep: 'tax',
                actionLabel: 'Update',
                legalReference: 'Non-Resident Landlords Scheme (HMRC)',
            });
        }

        // Company Registration - WARNING (for company landlords)
        if (formData.landlordType === 'company') {
            items.push({
                id: 'company_reg',
                label: 'Company Registration Number',
                description: formData.companyRegNumber
                    ? `Companies House registration: ${formData.companyRegNumber}`
                    : 'No company registration number provided - required for corporate landlords',
                passed: !!formData.companyRegNumber,
                severity: 'warning',
                actionStep: 'personal',
                actionLabel: 'Add',
            });
        }

        // Proof of Address - WARNING
        items.push({
            id: 'proof_of_address',
            label: 'Proof of Address',
            description: formData.proofOfAddressUploaded
                ? 'Proof of address document uploaded'
                : 'No proof of address - recommended for AML/KYC compliance',
            passed: formData.proofOfAddressUploaded,
            severity: 'warning',
            actionStep: 'documents',
            actionLabel: 'Upload',
        });

        // Proof of Ownership - WARNING
        items.push({
            id: 'proof_of_ownership',
            label: 'Proof of Property Ownership',
            description: formData.proofOfOwnershipUploaded
                ? 'Proof of ownership document uploaded'
                : 'No proof of ownership - recommended to verify landlord authority',
            passed: formData.proofOfOwnershipUploaded,
            severity: 'warning',
            actionStep: 'documents',
            actionLabel: 'Upload',
        });

        // Contact completeness - INFO
        items.push({
            id: 'contact_info',
            label: 'Complete Contact Details',
            description: formData.phone && formData.address
                ? 'Full contact information provided'
                : 'Incomplete contact details - phone and address recommended',
            passed: !!(formData.phone && formData.address),
            severity: 'info',
            actionStep: 'personal',
            actionLabel: 'Complete',
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
                                            {formData.landlordType === 'company' && !formData.companyRegNumber && (
                                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Required for Companies House verification
                                                </p>
                                            )}
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
                                For rent payments to the landlord. Required for client money regulations.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg p-3 mb-2">
                                <div className="flex gap-2">
                                    <AlertCircle className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Bank details are required to process rent payments to the landlord. Under client money
                                        protection rules, all payments must be routed to a verified bank account.
                                    </p>
                                </div>
                            </div>

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
                                    {formData.accountNumber && formData.accountNumber.length !== 8 && (
                                        <p className="text-xs text-amber-600 mt-1">UK bank account numbers are 8 digits</p>
                                    )}
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
                                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg p-4">
                                        <div className="flex gap-2">
                                            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                                            <div>
                                                <p className="font-medium text-red-800 dark:text-red-200">
                                                    Non-Resident Landlord (NRL) Scheme - Tax Compliance
                                                </p>
                                                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                                                    For landlords who normally live outside the UK, you as the managing agent <strong>must
                                                    deduct basic rate tax from the rent</strong> and pay it to HMRC unless the landlord
                                                    has received HMRC approval to receive rent without tax deducted.
                                                </p>
                                                <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                                                    Failure to deduct tax when required is a criminal offence. You must register with
                                                    HMRC as an agent for this landlord.
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
                                            <Label>NRL Approval Number *</Label>
                                            <Input
                                                value={formData.nrlNumber || ''}
                                                onChange={(e) => updateField('nrlNumber', e.target.value)}
                                                placeholder="Enter NRL approval number"
                                            />
                                            {!formData.nrlNumber && (
                                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> You must record the HMRC approval number to verify the exemption
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {!formData.hasNrlExemption && (
                                        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-3">
                                            <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                                                Action Required: You must deduct 20% basic rate tax from all rent payments
                                                and submit quarterly returns to HMRC using form NRLY.
                                            </p>
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
                                Required identity and ownership verification documents (AML/KYC compliance)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg p-3">
                                <div className="flex gap-2">
                                    <Shield className="h-4 w-4 text-blue-500 flex-shrink-0 mt-0.5" />
                                    <p className="text-sm text-blue-700 dark:text-blue-300">
                                        Under the Money Laundering Regulations 2017, letting agents must verify the identity of
                                        landlords before entering into a business relationship. Photo ID is mandatory.
                                    </p>
                                </div>
                            </div>

                            <div className={`border rounded-lg p-4 ${!formData.idDocumentUploaded ? 'border-red-200 bg-red-50/50 dark:bg-red-950/10' : 'border-green-200 bg-green-50/50 dark:bg-green-950/10'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Photo ID *</p>
                                        <p className="text-sm text-muted-foreground">
                                            Passport, driving licence, or national ID card
                                        </p>
                                        {!formData.idDocumentUploaded && (
                                            <p className="text-xs text-red-600 mt-1">Mandatory under AML regulations</p>
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
                                            <p className="text-xs text-amber-600 mt-1">Recommended for enhanced due diligence</p>
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

                            <div className={`border rounded-lg p-4 ${!formData.proofOfOwnershipUploaded ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10' : 'border-green-200 bg-green-50/50 dark:bg-green-950/10'}`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">Proof of Property Ownership</p>
                                        <p className="text-sm text-muted-foreground">
                                            Title deed, mortgage statement, or land registry document
                                        </p>
                                        {!formData.proofOfOwnershipUploaded && (
                                            <p className="text-xs text-amber-600 mt-1">Recommended to verify landlord authority</p>
                                        )}
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
                    <div className="space-y-6">
                        {/* Compliance Review */}
                        <ComplianceChecklist
                            title="Landlord Compliance Review"
                            subtitle="Review all regulatory obligations before completing onboarding"
                            items={complianceItems}
                            onNavigateToStep={(step) => setCurrentStep(step as WizardStep)}
                            showSummary={true}
                            blockOnCritical={true}
                        />

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
                                    <div className={`flex items-start space-x-3 p-3 border rounded-lg ${formData.understandsGasSafety ? 'bg-green-50/50 border-green-200' : 'bg-red-50/30 border-red-200'}`}>
                                        <Checkbox
                                            id="gasSafety"
                                            checked={formData.understandsGasSafety}
                                            onCheckedChange={(checked) => updateField('understandsGasSafety', checked)}
                                        />
                                        <div>
                                            <Label htmlFor="gasSafety" className="font-medium">Gas Safety Certificate *</Label>
                                            <p className="text-sm text-muted-foreground">
                                                I understand that an annual gas safety check (CP12) is required and must be
                                                provided to tenants within 28 days. Penalty: up to £6,000 fine or imprisonment.
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`flex items-start space-x-3 p-3 border rounded-lg ${formData.understandsEicr ? 'bg-green-50/50 border-green-200' : 'bg-red-50/30 border-red-200'}`}>
                                        <Checkbox
                                            id="eicr"
                                            checked={formData.understandsEicr}
                                            onCheckedChange={(checked) => updateField('understandsEicr', checked)}
                                        />
                                        <div>
                                            <Label htmlFor="eicr" className="font-medium">Electrical Safety (EICR) *</Label>
                                            <p className="text-sm text-muted-foreground">
                                                I understand that an Electrical Installation Condition Report is required
                                                every 5 years and must be provided to tenants. Penalty: up to £30,000 fine.
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`flex items-start space-x-3 p-3 border rounded-lg ${formData.understandsEpc ? 'bg-green-50/50 border-green-200' : 'bg-red-50/30 border-red-200'}`}>
                                        <Checkbox
                                            id="epc"
                                            checked={formData.understandsEpc}
                                            onCheckedChange={(checked) => updateField('understandsEpc', checked)}
                                        />
                                        <div>
                                            <Label htmlFor="epc" className="font-medium">Energy Performance Certificate *</Label>
                                            <p className="text-sm text-muted-foreground">
                                                I understand the property must have a valid EPC with a minimum rating of E
                                                (C from 2025) and be provided to tenants. Penalty: up to £5,000 fine.
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`flex items-start space-x-3 p-3 border rounded-lg ${formData.understandsDepositProtection ? 'bg-green-50/50 border-green-200' : 'bg-red-50/30 border-red-200'}`}>
                                        <Checkbox
                                            id="deposit"
                                            checked={formData.understandsDepositProtection}
                                            onCheckedChange={(checked) => updateField('understandsDepositProtection', checked)}
                                        />
                                        <div>
                                            <Label htmlFor="deposit" className="font-medium">Deposit Protection *</Label>
                                            <p className="text-sm text-muted-foreground">
                                                I understand that tenant deposits must be protected in a government-approved
                                                scheme within 30 days and prescribed information provided.
                                                Penalty: tenant can claim 1-3x the deposit amount.
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`flex items-start space-x-3 p-3 border rounded-lg ${formData.agreesToTerms ? 'bg-primary/5 border-primary/30' : 'bg-red-50/30 border-red-200'}`}>
                                        <Checkbox
                                            id="terms"
                                            checked={formData.agreesToTerms}
                                            onCheckedChange={(checked) => updateField('agreesToTerms', checked)}
                                        />
                                        <div>
                                            <Label htmlFor="terms" className="font-medium">Terms & Conditions *</Label>
                                            <p className="text-sm text-muted-foreground">
                                                I agree to the terms of the management agreement and understand my
                                                responsibilities as a landlord.
                                            </p>
                                        </div>
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
                                    All acknowledgements required
                                </p>
                            )}
                            <Button
                                onClick={() => saveMutation.mutate()}
                                disabled={!canProceed() || saveMutation.isPending}
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
