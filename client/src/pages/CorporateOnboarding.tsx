import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useSearch } from 'wouter';
import {
  ArrowLeft, ArrowRight, Globe, Building2, FileText, Users,
  UserCheck, ClipboardCheck, Check, Upload, Plus, Trash2, AlertCircle
} from 'lucide-react';

interface JurisdictionConfig {
  label: string;
  requiresVat: boolean;
  requiresTaxId: boolean;
  taxIdLabel: string;
  requiresSicCode: boolean;
  requiresShareCapital: boolean;
  documents: string[];
  regNumberLabel: string;
}

const JURISDICTIONS: Record<string, JurisdictionConfig> = {
  uk: {
    label: 'United Kingdom',
    requiresVat: true,
    requiresTaxId: false,
    taxIdLabel: '',
    requiresSicCode: true,
    requiresShareCapital: true,
    documents: ['Certificate of Incorporation', 'Memorandum & Articles of Association', 'Latest Annual Return / Confirmation Statement', 'Proof of Registered Address'],
    regNumberLabel: 'Companies House Number'
  },
  bvi: {
    label: 'British Virgin Islands',
    requiresVat: false,
    requiresTaxId: false,
    taxIdLabel: '',
    requiresSicCode: false,
    requiresShareCapital: true,
    documents: ['Certificate of Incorporation', 'Memorandum & Articles of Association', 'Certificate of Good Standing', 'Register of Directors', 'Register of Members/Shareholders'],
    regNumberLabel: 'BVI Company Number'
  },
  jersey: {
    label: 'Jersey',
    requiresVat: false,
    requiresTaxId: true,
    taxIdLabel: 'Jersey Tax Reference',
    requiresSicCode: false,
    requiresShareCapital: true,
    documents: ['Certificate of Incorporation', 'Memorandum & Articles of Association', 'Certificate of Good Standing', 'Annual Return'],
    regNumberLabel: 'JFSC Registration Number'
  },
  guernsey: {
    label: 'Guernsey',
    requiresVat: false,
    requiresTaxId: true,
    taxIdLabel: 'Guernsey Tax Reference',
    requiresSicCode: false,
    requiresShareCapital: true,
    documents: ['Certificate of Incorporation', 'Memorandum & Articles of Association', 'Certificate of Good Standing', 'Annual Validation'],
    regNumberLabel: 'GFSC Registration Number'
  },
  isle_of_man: {
    label: 'Isle of Man',
    requiresVat: true,
    requiresTaxId: true,
    taxIdLabel: 'IoM Tax Reference',
    requiresSicCode: false,
    requiresShareCapital: true,
    documents: ['Certificate of Incorporation', 'Memorandum & Articles of Association', 'Certificate of Good Standing', 'Annual Return'],
    regNumberLabel: 'IoM Company Number'
  },
  cayman: {
    label: 'Cayman Islands',
    requiresVat: false,
    requiresTaxId: false,
    taxIdLabel: '',
    requiresSicCode: false,
    requiresShareCapital: true,
    documents: ['Certificate of Incorporation', 'Memorandum & Articles of Association', 'Certificate of Good Standing', 'Register of Directors', 'Register of Members'],
    regNumberLabel: 'Cayman Company Number'
  },
  usa_delaware: {
    label: 'USA (Delaware)',
    requiresVat: false,
    requiresTaxId: true,
    taxIdLabel: 'EIN (Employer Identification Number)',
    requiresSicCode: false,
    requiresShareCapital: false,
    documents: ['Certificate of Formation', 'Operating Agreement / Bylaws', 'Certificate of Good Standing', 'IRS EIN Letter'],
    regNumberLabel: 'Delaware File Number'
  },
  other: {
    label: 'Other',
    requiresVat: false,
    requiresTaxId: true,
    taxIdLabel: 'Tax Identification Number',
    requiresSicCode: false,
    requiresShareCapital: false,
    documents: ['Certificate of Incorporation', 'Constitutional Documents', 'Certificate of Good Standing', 'Proof of Registered Address'],
    regNumberLabel: 'Company Registration Number'
  }
};

type Phase = 'jurisdiction' | 'corporate_info' | 'documents' | 'bo_collection' | 'bo_wizard' | 'review';

const phases: { key: Phase; label: string; icon: typeof Globe }[] = [
  { key: 'jurisdiction', label: 'Jurisdiction', icon: Globe },
  { key: 'corporate_info', label: 'Corporate Info', icon: Building2 },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'bo_collection', label: 'Owners', icon: Users },
  { key: 'bo_wizard', label: 'Owner Details', icon: UserCheck },
  { key: 'review', label: 'Review', icon: ClipboardCheck }
];

const corporateSubSteps = [
  'Company Name',
  'Registration Number',
  'Registered Address',
  'Correspondence Address',
  'Contact Details',
  'VAT / Tax',
  'SIC Code',
  'Share Capital',
  'Date of Incorporation'
];

const boSubSteps = [
  'Personal Details',
  'Address',
  'Ownership & Role',
  'Identity Document',
  'Proof of Address'
];

interface BeneficialOwnerData {
  fullName: string;
  email: string;
  phone: string;
  mobile: string;
  dateOfBirth: string;
  nationality: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
  ownershipPercentage: string;
  isDirector: boolean;
  isPsc: boolean;
  isTrustee: boolean;
  idDocumentType: string;
  idDocumentNumber: string;
  idDocumentExpiry: string;
  idDocumentUploaded: boolean;
  idDocumentUrl: string;
  proofOfAddressType: string;
  proofOfAddressUploaded: boolean;
  proofOfAddressUrl: string;
}

const emptyBO: BeneficialOwnerData = {
  fullName: '', email: '', phone: '', mobile: '',
  dateOfBirth: '', nationality: '',
  addressLine1: '', addressLine2: '', city: '', postcode: '', country: 'UK',
  ownershipPercentage: '', isDirector: false, isPsc: false, isTrustee: false,
  idDocumentType: 'passport', idDocumentNumber: '', idDocumentExpiry: '',
  idDocumentUploaded: false, idDocumentUrl: '',
  proofOfAddressType: 'utility_bill', proofOfAddressUploaded: false, proofOfAddressUrl: ''
};

interface CorporateFormData {
  jurisdiction: string;
  companyName: string;
  registrationNumber: string;
  registeredAddressLine1: string;
  registeredAddressLine2: string;
  registeredCity: string;
  registeredPostcode: string;
  registeredCountry: string;
  correspondenceSameAsRegistered: boolean;
  correspondenceAddressLine1: string;
  correspondenceAddressLine2: string;
  correspondenceCity: string;
  correspondencePostcode: string;
  correspondenceCountry: string;
  contactEmail: string;
  contactPhone: string;
  vatNumber: string;
  taxId: string;
  sicCode: string;
  shareCapital: string;
  dateOfIncorporation: string;
  documentsChecked: Record<string, boolean>;
  documentsUploaded: Record<string, { url: string; fileName: string }>;
  beneficialOwners: BeneficialOwnerData[];
}

export default function CorporateOnboarding() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const existingLandlordId = searchParams.get('landlordId');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentPhase, setCurrentPhase] = useState<Phase>('jurisdiction');
  const [corpSubStep, setCorpSubStep] = useState(0);
  const [boIndex, setBoIndex] = useState(0);
  const [boSubStep, setBoSubStep] = useState(0);
  const [prefilled, setPrefilled] = useState(false);

  const [formData, setFormData] = useState<CorporateFormData>({
    jurisdiction: '',
    companyName: '',
    registrationNumber: '',
    registeredAddressLine1: '',
    registeredAddressLine2: '',
    registeredCity: '',
    registeredPostcode: '',
    registeredCountry: '',
    correspondenceSameAsRegistered: true,
    correspondenceAddressLine1: '',
    correspondenceAddressLine2: '',
    correspondenceCity: '',
    correspondencePostcode: '',
    correspondenceCountry: '',
    contactEmail: '',
    contactPhone: '',
    vatNumber: '',
    taxId: '',
    sicCode: '',
    shareCapital: '',
    dateOfIncorporation: '',
    documentsChecked: {},
    documentsUploaded: {},
    beneficialOwners: [{ ...emptyBO }]
  });

  // Load existing landlord data when converting
  const { data: existingLandlord } = useQuery({
    queryKey: ['landlord', existingLandlordId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/landlords/${existingLandlordId}`);
      if (!res.ok) throw new Error('Failed to fetch landlord');
      return res.json();
    },
    enabled: !!existingLandlordId
  });

  // Pre-fill form when existing landlord data loads
  useEffect(() => {
    if (existingLandlord && !prefilled) {
      setPrefilled(true);
      setFormData(prev => ({
        ...prev,
        companyName: existingLandlord.companyName || existingLandlord.name || '',
        registrationNumber: existingLandlord.companyRegistrationNo || '',
        vatNumber: existingLandlord.companyVatNo || '',
        registeredAddressLine1: existingLandlord.companyAddressLine1 || existingLandlord.addressLine1 || '',
        registeredAddressLine2: existingLandlord.companyAddressLine2 || existingLandlord.addressLine2 || '',
        registeredCity: existingLandlord.companyCity || existingLandlord.city || '',
        registeredPostcode: existingLandlord.companyPostcode || existingLandlord.postcode || '',
        contactEmail: existingLandlord.email || '',
        contactPhone: existingLandlord.phone || existingLandlord.mobile || '',
      }));
    }
  }, [existingLandlord, prefilled]);

  const jurisdictionConfig = formData.jurisdiction ? JURISDICTIONS[formData.jurisdiction] : null;
  const phaseIndex = phases.findIndex(p => p.key === currentPhase);
  const progress = ((phaseIndex + 1) / phases.length) * 100;

  const updateField = (field: keyof CorporateFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateBO = (idx: number, field: keyof BeneficialOwnerData, value: any) => {
    setFormData(prev => {
      const bos = [...prev.beneficialOwners];
      bos[idx] = { ...bos[idx], [field]: value };
      return { ...prev, beneficialOwners: bos };
    });
  };

  const addBO = () => {
    setFormData(prev => ({
      ...prev,
      beneficialOwners: [...prev.beneficialOwners, { ...emptyBO }]
    }));
  };

  const removeBO = (idx: number) => {
    if (formData.beneficialOwners.length <= 1) return;
    setFormData(prev => ({
      ...prev,
      beneficialOwners: prev.beneficialOwners.filter((_, i) => i !== idx)
    }));
    if (boIndex >= formData.beneficialOwners.length - 1) {
      setBoIndex(Math.max(0, formData.beneficialOwners.length - 2));
    }
  };

  // File upload handling
  const docFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const boFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploading, setUploading] = useState<string | null>(null);

  const handleDocumentUpload = async (file: File, docName: string) => {
    setUploading(docName);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('document', file);
      const res = await fetch('/api/crm/upload/document', {
        method: 'POST',
        body: uploadFormData,
      });
      if (!res.ok) throw new Error('Failed to upload');
      const data = await res.json();
      setFormData(prev => ({
        ...prev,
        documentsChecked: { ...prev.documentsChecked, [docName]: true },
        documentsUploaded: { ...prev.documentsUploaded, [docName]: { url: data.url, fileName: file.name } },
      }));
      toast({ title: 'Document uploaded', description: `${file.name} uploaded successfully.` });
    } catch {
      toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const handleBODocUpload = async (file: File, idx: number, field: 'idDocumentUrl' | 'proofOfAddressUrl') => {
    const uploadedField = field === 'idDocumentUrl' ? 'idDocumentUploaded' : 'proofOfAddressUploaded';
    const key = `bo-${idx}-${field}`;
    setUploading(key);
    try {
      const uploadFormData = new FormData();
      uploadFormData.append('document', file);
      const res = await fetch('/api/crm/upload/document', {
        method: 'POST',
        body: uploadFormData,
      });
      if (!res.ok) throw new Error('Failed to upload');
      const data = await res.json();
      setFormData(prev => {
        const bos = [...prev.beneficialOwners];
        bos[idx] = { ...bos[idx], [field]: data.url, [uploadedField]: true };
        return { ...prev, beneficialOwners: bos };
      });
      toast({ title: 'Document uploaded', description: `${file.name} uploaded successfully.` });
    } catch {
      toast({ title: 'Upload failed', description: 'Please try again.', variant: 'destructive' });
    } finally {
      setUploading(null);
    }
  };

  const shouldSkipCorpStep = (step: number): boolean => {
    if (!jurisdictionConfig) return false;
    if (step === 5 && !jurisdictionConfig.requiresVat && !jurisdictionConfig.requiresTaxId) return true;
    if (step === 6 && !jurisdictionConfig.requiresSicCode) return true;
    if (step === 7 && !jurisdictionConfig.requiresShareCapital) return true;
    return false;
  };

  const getLastCorpStep = (): number => {
    for (let i = corporateSubSteps.length - 1; i >= 0; i--) {
      if (!shouldSkipCorpStep(i)) return i;
    }
    return 0;
  };

  const goBack = () => {
    switch (currentPhase) {
      case 'jurisdiction':
        setLocation(existingLandlordId ? `/crm/landlords/${existingLandlordId}` : '/crm/landlords');
        break;
      case 'corporate_info':
        if (corpSubStep > 0) {
          let prev = corpSubStep - 1;
          while (prev >= 0 && shouldSkipCorpStep(prev)) prev--;
          if (prev >= 0) { setCorpSubStep(prev); return; }
        }
        setCurrentPhase('jurisdiction');
        break;
      case 'documents':
        setCurrentPhase('corporate_info');
        setCorpSubStep(getLastCorpStep());
        break;
      case 'bo_collection':
        setCurrentPhase('documents');
        break;
      case 'bo_wizard':
        if (boSubStep > 0) {
          setBoSubStep(boSubStep - 1);
        } else if (boIndex > 0) {
          setBoIndex(boIndex - 1);
          setBoSubStep(boSubSteps.length - 1);
        } else {
          setCurrentPhase('bo_collection');
        }
        break;
      case 'review':
        setCurrentPhase('bo_wizard');
        setBoIndex(formData.beneficialOwners.length - 1);
        setBoSubStep(boSubSteps.length - 1);
        break;
    }
  };

  const goNext = () => {
    switch (currentPhase) {
      case 'jurisdiction':
        setCurrentPhase('corporate_info');
        setCorpSubStep(0);
        break;
      case 'corporate_info': {
        let next = corpSubStep + 1;
        while (next < corporateSubSteps.length && shouldSkipCorpStep(next)) next++;
        if (next < corporateSubSteps.length) {
          setCorpSubStep(next);
        } else {
          setCurrentPhase('documents');
        }
        break;
      }
      case 'documents':
        setCurrentPhase('bo_collection');
        break;
      case 'bo_collection':
        setCurrentPhase('bo_wizard');
        setBoIndex(0);
        setBoSubStep(0);
        break;
      case 'bo_wizard':
        if (boSubStep < boSubSteps.length - 1) {
          setBoSubStep(boSubStep + 1);
        } else if (boIndex < formData.beneficialOwners.length - 1) {
          setBoIndex(boIndex + 1);
          setBoSubStep(0);
        } else {
          setCurrentPhase('review');
        }
        break;
    }
  };

  const canProceed = (): boolean => {
    switch (currentPhase) {
      case 'jurisdiction':
        return !!formData.jurisdiction;
      case 'corporate_info':
        if (corpSubStep === 0) return !!formData.companyName;
        if (corpSubStep === 1) return !!formData.registrationNumber;
        if (corpSubStep === 2) return !!formData.registeredAddressLine1 && !!formData.registeredPostcode;
        return true;
      case 'bo_collection':
        return formData.beneficialOwners.length > 0 &&
          formData.beneficialOwners.every(bo => !!bo.fullName);
      case 'bo_wizard': {
        const bo = formData.beneficialOwners[boIndex];
        if (!bo) return true;
        if (boSubStep === 0) return !!bo.fullName;
        return true;
      }
      default:
        return true;
    }
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      let landlordId: number;

      if (existingLandlordId) {
        // Existing landlord: update their details to corporate
        landlordId = parseInt(existingLandlordId);
        const updateRes = await fetch(`/api/crm/landlords/${landlordId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.companyName,
            landlordType: 'company',
            isCorporate: true,
            email: formData.contactEmail,
            phone: formData.contactPhone,
            companyName: formData.companyName,
            companyRegistrationNo: formData.registrationNumber,
            companyVatNo: formData.vatNumber || null,
            companyAddressLine1: formData.registeredAddressLine1,
            companyAddressLine2: formData.registeredAddressLine2,
            companyCity: formData.registeredCity,
            companyPostcode: formData.registeredPostcode,
            addressLine1: formData.correspondenceSameAsRegistered ? formData.registeredAddressLine1 : formData.correspondenceAddressLine1,
            addressLine2: formData.correspondenceSameAsRegistered ? formData.registeredAddressLine2 : formData.correspondenceAddressLine2,
            city: formData.correspondenceSameAsRegistered ? formData.registeredCity : formData.correspondenceCity,
            postcode: formData.correspondenceSameAsRegistered ? formData.registeredPostcode : formData.correspondencePostcode,
          })
        });
        if (!updateRes.ok) throw new Error('Failed to update landlord');
      } else {
        // New landlord: create from scratch
        const landlordRes = await fetch('/api/crm/landlords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: formData.companyName,
            landlordType: 'company',
            isCorporate: true,
            email: formData.contactEmail,
            phone: formData.contactPhone,
            companyName: formData.companyName,
            companyRegistrationNo: formData.registrationNumber,
            companyVatNo: formData.vatNumber || null,
            companyAddressLine1: formData.registeredAddressLine1,
            companyAddressLine2: formData.registeredAddressLine2,
            companyCity: formData.registeredCity,
            companyPostcode: formData.registeredPostcode,
            addressLine1: formData.correspondenceSameAsRegistered ? formData.registeredAddressLine1 : formData.correspondenceAddressLine1,
            addressLine2: formData.correspondenceSameAsRegistered ? formData.registeredAddressLine2 : formData.correspondenceAddressLine2,
            city: formData.correspondenceSameAsRegistered ? formData.registeredCity : formData.correspondenceCity,
            postcode: formData.correspondenceSameAsRegistered ? formData.registeredPostcode : formData.correspondencePostcode,
          })
        });
        if (!landlordRes.ok) throw new Error('Failed to create landlord');
        const landlord = await landlordRes.json();
        landlordId = landlord.id;
      }

      // Step 2: Create corporate owner (API also sets is_corporate=true on landlord)
      const corpRes = await fetch(`/api/crm/landlords/${landlordId}/corporate-owner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          companyName: formData.companyName,
          companyRegistrationNo: formData.registrationNumber,
          companyVatNo: formData.vatNumber || null,
          addressLine1: formData.registeredAddressLine1,
          addressLine2: formData.registeredAddressLine2,
          city: formData.registeredCity,
          postcode: formData.registeredPostcode,
          country: formData.registeredCountry || jurisdictionConfig?.label || 'UK',
          email: formData.contactEmail,
          phone: formData.contactPhone,
        })
      });
      if (!corpRes.ok) throw new Error('Failed to create corporate owner');
      const corpOwner = await corpRes.json();

      // Step 3: Create beneficial owners
      for (const bo of formData.beneficialOwners) {
        const boRes = await fetch(`/api/crm/landlords/${landlordId}/beneficial-owners`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            corporateOwnerId: corpOwner.id,
            fullName: bo.fullName,
            email: bo.email,
            phone: bo.phone,
            mobile: bo.mobile,
            dateOfBirth: bo.dateOfBirth || null,
            nationality: bo.nationality,
            addressLine1: bo.addressLine1,
            addressLine2: bo.addressLine2,
            city: bo.city,
            postcode: bo.postcode,
            country: bo.country,
            ownershipPercentage: bo.ownershipPercentage || null,
            isDirector: bo.isDirector,
            isPsc: bo.isPsc,
            isTrustee: bo.isTrustee,
            idDocumentType: bo.idDocumentType,
            idDocumentNumber: bo.idDocumentNumber,
            idDocumentExpiry: bo.idDocumentExpiry || null,
            proofOfAddressType: bo.proofOfAddressType,
          })
        });
        if (!boRes.ok) throw new Error(`Failed to create beneficial owner: ${bo.fullName}`);
      }

      return { id: landlordId };
    },
    onSuccess: (landlord) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords'] });
      if (existingLandlordId) {
        queryClient.invalidateQueries({ queryKey: ['landlord', existingLandlordId] });
      }
      toast({
        title: 'Success',
        description: existingLandlordId
          ? 'Landlord has been converted to corporate successfully!'
          : 'Corporate landlord has been onboarded successfully!'
      });
      setLocation(`/crm/landlords/${landlord.id}`);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const getSubStepInfo = (): string => {
    if (currentPhase === 'corporate_info') {
      return `Step ${corpSubStep + 1} of ${corporateSubSteps.length}: ${corporateSubSteps[corpSubStep]}`;
    }
    if (currentPhase === 'bo_wizard') {
      return `Owner ${boIndex + 1} of ${formData.beneficialOwners.length} — ${boSubSteps[boSubStep]}`;
    }
    return '';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-background">
      {/* Header */}
      <div className="bg-white dark:bg-card border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => setLocation(existingLandlordId ? `/crm/landlords/${existingLandlordId}` : '/crm/landlords')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-semibold">
                  {existingLandlordId ? 'Convert to Corporate Landlord' : 'Corporate Landlord Onboarding'}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {getSubStepInfo() || (existingLandlordId
                    ? `Converting ${existingLandlord?.name || 'landlord'} to corporate`
                    : 'Complete all phases to register a corporate landlord')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-6">
        {/* Phase Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {phases.map((phase, idx) => (
              <div
                key={phase.key}
                className={`flex items-center gap-2 ${idx <= phaseIndex ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  idx < phaseIndex
                    ? 'bg-primary text-primary-foreground'
                    : idx === phaseIndex
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-muted text-muted-foreground'
                }`}>
                  {idx < phaseIndex ? <Check className="h-4 w-4" /> : idx + 1}
                </div>
                <span className="hidden lg:inline text-sm">{phase.label}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Phase 1: Jurisdiction Selection */}
        {currentPhase === 'jurisdiction' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Jurisdiction of Incorporation
              </CardTitle>
              <CardDescription>
                Select where the company is incorporated. This determines the required documents and information.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Object.entries(JURISDICTIONS).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => updateField('jurisdiction', key)}
                    className={`p-4 rounded-lg border-2 text-left transition-colors ${
                      formData.jurisdiction === key
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {config.documents.length} documents required
                    </p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Phase 2: Corporate Information (serial sub-steps) */}
        {currentPhase === 'corporate_info' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {corporateSubSteps[corpSubStep]}
              </CardTitle>
              <CardDescription>
                Step {corpSubStep + 1} of {corporateSubSteps.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {corpSubStep === 0 && (
                <div>
                  <Label>Company Name *</Label>
                  <Input
                    value={formData.companyName}
                    onChange={e => updateField('companyName', e.target.value)}
                    placeholder="e.g. ABC Properties Ltd"
                    autoFocus
                  />
                </div>
              )}

              {corpSubStep === 1 && (
                <div>
                  <Label>{jurisdictionConfig?.regNumberLabel || 'Registration Number'} *</Label>
                  <Input
                    value={formData.registrationNumber}
                    onChange={e => updateField('registrationNumber', e.target.value)}
                    placeholder="Enter registration number"
                    autoFocus
                  />
                </div>
              )}

              {corpSubStep === 2 && (
                <div className="space-y-3">
                  <div>
                    <Label>Address Line 1 *</Label>
                    <Input value={formData.registeredAddressLine1} onChange={e => updateField('registeredAddressLine1', e.target.value)} placeholder="Street address" />
                  </div>
                  <div>
                    <Label>Address Line 2</Label>
                    <Input value={formData.registeredAddressLine2} onChange={e => updateField('registeredAddressLine2', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>City</Label>
                      <Input value={formData.registeredCity} onChange={e => updateField('registeredCity', e.target.value)} />
                    </div>
                    <div>
                      <Label>Postcode *</Label>
                      <Input value={formData.registeredPostcode} onChange={e => updateField('registeredPostcode', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={formData.registeredCountry} onChange={e => updateField('registeredCountry', e.target.value)} placeholder={jurisdictionConfig?.label || 'Country'} />
                  </div>
                </div>
              )}

              {corpSubStep === 3 && (
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sameAddr"
                      checked={formData.correspondenceSameAsRegistered}
                      onCheckedChange={checked => updateField('correspondenceSameAsRegistered', checked)}
                    />
                    <Label htmlFor="sameAddr">Same as registered address</Label>
                  </div>
                  {!formData.correspondenceSameAsRegistered && (
                    <>
                      <div>
                        <Label>Address Line 1</Label>
                        <Input value={formData.correspondenceAddressLine1} onChange={e => updateField('correspondenceAddressLine1', e.target.value)} />
                      </div>
                      <div>
                        <Label>Address Line 2</Label>
                        <Input value={formData.correspondenceAddressLine2} onChange={e => updateField('correspondenceAddressLine2', e.target.value)} />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label>City</Label>
                          <Input value={formData.correspondenceCity} onChange={e => updateField('correspondenceCity', e.target.value)} />
                        </div>
                        <div>
                          <Label>Postcode</Label>
                          <Input value={formData.correspondencePostcode} onChange={e => updateField('correspondencePostcode', e.target.value)} />
                        </div>
                      </div>
                      <div>
                        <Label>Country</Label>
                        <Input value={formData.correspondenceCountry} onChange={e => updateField('correspondenceCountry', e.target.value)} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {corpSubStep === 4 && (
                <div className="space-y-3">
                  <div>
                    <Label>Contact Email</Label>
                    <Input type="email" value={formData.contactEmail} onChange={e => updateField('contactEmail', e.target.value)} placeholder="company@example.com" />
                  </div>
                  <div>
                    <Label>Contact Phone</Label>
                    <Input value={formData.contactPhone} onChange={e => updateField('contactPhone', e.target.value)} placeholder="020 1234 5678" />
                  </div>
                </div>
              )}

              {corpSubStep === 5 && (
                <div className="space-y-3">
                  {jurisdictionConfig?.requiresVat && (
                    <div>
                      <Label>VAT Number</Label>
                      <Input value={formData.vatNumber} onChange={e => updateField('vatNumber', e.target.value)} placeholder="GB123456789" />
                    </div>
                  )}
                  {jurisdictionConfig?.requiresTaxId && (
                    <div>
                      <Label>{jurisdictionConfig.taxIdLabel}</Label>
                      <Input value={formData.taxId} onChange={e => updateField('taxId', e.target.value)} />
                    </div>
                  )}
                </div>
              )}

              {corpSubStep === 6 && (
                <div>
                  <Label>SIC Code</Label>
                  <Input value={formData.sicCode} onChange={e => updateField('sicCode', e.target.value)} placeholder="e.g. 68100 - Buying and selling of own real estate" />
                  <p className="text-xs text-muted-foreground mt-1">Standard Industrial Classification code</p>
                </div>
              )}

              {corpSubStep === 7 && (
                <div>
                  <Label>Share Capital</Label>
                  <Input value={formData.shareCapital} onChange={e => updateField('shareCapital', e.target.value)} placeholder="e.g. 100 ordinary shares of £1 each" />
                </div>
              )}

              {corpSubStep === 8 && (
                <div>
                  <Label>Date of Incorporation</Label>
                  <Input type="date" value={formData.dateOfIncorporation} onChange={e => updateField('dateOfIncorporation', e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Phase 3: Documents */}
        {currentPhase === 'documents' && jurisdictionConfig && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Required Documents
              </CardTitle>
              <CardDescription>
                The following documents are required for {jurisdictionConfig.label} companies. Check each as uploaded.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {jurisdictionConfig.documents.map((doc) => (
                <div key={doc} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{doc}</p>
                      {formData.documentsUploaded[doc] && (
                        <p className="text-xs text-muted-foreground mt-1">{formData.documentsUploaded[doc].fileName}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={!!formData.documentsChecked[doc]}
                        onCheckedChange={checked => {
                          setFormData(prev => ({
                            ...prev,
                            documentsChecked: { ...prev.documentsChecked, [doc]: !!checked }
                          }));
                        }}
                      />
                      <input
                        type="file"
                        className="hidden"
                        ref={el => { docFileInputRefs.current[doc] = el; }}
                        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) handleDocumentUpload(file, doc);
                          e.target.value = '';
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={uploading === doc}
                        onClick={() => docFileInputRefs.current[doc]?.click()}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {uploading === doc ? 'Uploading...' : formData.documentsUploaded[doc] ? 'Replace' : 'Upload'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Phase 4: BO Collection */}
        {currentPhase === 'bo_collection' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Beneficial Owners
              </CardTitle>
              <CardDescription>
                Add all individuals who own 25% or more of the company, or who exercise significant control.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.beneficialOwners.map((bo, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-sm">Owner {idx + 1}</span>
                    {formData.beneficialOwners.length > 1 && (
                      <Button variant="ghost" size="sm" onClick={() => removeBO(idx)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label>Full Name *</Label>
                      <Input
                        value={bo.fullName}
                        onChange={e => updateBO(idx, 'fullName', e.target.value)}
                        placeholder="Full legal name"
                      />
                    </div>
                    <div>
                      <Label>Ownership %</Label>
                      <Input
                        value={bo.ownershipPercentage}
                        onChange={e => updateBO(idx, 'ownershipPercentage', e.target.value)}
                        placeholder="e.g. 50"
                        type="number"
                        min="0"
                        max="100"
                      />
                    </div>
                    <div className="flex items-end gap-4 pb-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={bo.isDirector}
                          onCheckedChange={checked => updateBO(idx, 'isDirector', checked)}
                        />
                        <Label className="text-sm">Director</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={bo.isPsc}
                          onCheckedChange={checked => updateBO(idx, 'isPsc', checked)}
                        />
                        <Label className="text-sm">PSC</Label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {(() => {
                const total = formData.beneficialOwners.reduce((sum, bo) => sum + (parseFloat(bo.ownershipPercentage) || 0), 0);
                return (
                  <div className={`flex items-center gap-2 p-3 rounded-lg ${
                    total > 100 ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300' :
                    total === 100 ? 'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300' :
                    'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300'
                  }`}>
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm">Total ownership: {total}%{total !== 100 && ' (should total 100%)'}</span>
                  </div>
                );
              })()}

              <Button variant="outline" onClick={addBO} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Add Another Beneficial Owner
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Phase 5: BO Wizard (serial per-owner) */}
        {currentPhase === 'bo_wizard' && formData.beneficialOwners[boIndex] && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="h-5 w-5" />
                {formData.beneficialOwners[boIndex].fullName || `Owner ${boIndex + 1}`} — {boSubSteps[boSubStep]}
              </CardTitle>
              <CardDescription>
                Owner {boIndex + 1} of {formData.beneficialOwners.length} — Step {boSubStep + 1} of {boSubSteps.length}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {boSubStep === 0 && (
                <div className="space-y-3">
                  <div>
                    <Label>Full Name *</Label>
                    <Input value={formData.beneficialOwners[boIndex].fullName} onChange={e => updateBO(boIndex, 'fullName', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Email</Label>
                      <Input type="email" value={formData.beneficialOwners[boIndex].email} onChange={e => updateBO(boIndex, 'email', e.target.value)} />
                    </div>
                    <div>
                      <Label>Phone</Label>
                      <Input value={formData.beneficialOwners[boIndex].phone} onChange={e => updateBO(boIndex, 'phone', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date of Birth</Label>
                      <Input type="date" value={formData.beneficialOwners[boIndex].dateOfBirth} onChange={e => updateBO(boIndex, 'dateOfBirth', e.target.value)} />
                    </div>
                    <div>
                      <Label>Nationality</Label>
                      <Input value={formData.beneficialOwners[boIndex].nationality} onChange={e => updateBO(boIndex, 'nationality', e.target.value)} placeholder="e.g. British" />
                    </div>
                  </div>
                </div>
              )}

              {boSubStep === 1 && (
                <div className="space-y-3">
                  <div>
                    <Label>Address Line 1</Label>
                    <Input value={formData.beneficialOwners[boIndex].addressLine1} onChange={e => updateBO(boIndex, 'addressLine1', e.target.value)} />
                  </div>
                  <div>
                    <Label>Address Line 2</Label>
                    <Input value={formData.beneficialOwners[boIndex].addressLine2} onChange={e => updateBO(boIndex, 'addressLine2', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>City</Label>
                      <Input value={formData.beneficialOwners[boIndex].city} onChange={e => updateBO(boIndex, 'city', e.target.value)} />
                    </div>
                    <div>
                      <Label>Postcode</Label>
                      <Input value={formData.beneficialOwners[boIndex].postcode} onChange={e => updateBO(boIndex, 'postcode', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <Label>Country</Label>
                    <Input value={formData.beneficialOwners[boIndex].country} onChange={e => updateBO(boIndex, 'country', e.target.value)} />
                  </div>
                </div>
              )}

              {boSubStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label>Ownership Percentage</Label>
                    <Input type="number" min="0" max="100" value={formData.beneficialOwners[boIndex].ownershipPercentage} onChange={e => updateBO(boIndex, 'ownershipPercentage', e.target.value)} />
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox checked={formData.beneficialOwners[boIndex].isDirector} onCheckedChange={checked => updateBO(boIndex, 'isDirector', checked)} />
                      <Label>Director of the company</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox checked={formData.beneficialOwners[boIndex].isPsc} onCheckedChange={checked => updateBO(boIndex, 'isPsc', checked)} />
                      <Label>Person with Significant Control (PSC)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox checked={formData.beneficialOwners[boIndex].isTrustee} onCheckedChange={checked => updateBO(boIndex, 'isTrustee', checked)} />
                      <Label>Trustee</Label>
                    </div>
                  </div>
                </div>
              )}

              {boSubStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label>ID Document Type</Label>
                    <Select value={formData.beneficialOwners[boIndex].idDocumentType} onValueChange={v => updateBO(boIndex, 'idDocumentType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="driving_license">Driving Licence</SelectItem>
                        <SelectItem value="national_id">National ID Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Document Number</Label>
                      <Input value={formData.beneficialOwners[boIndex].idDocumentNumber} onChange={e => updateBO(boIndex, 'idDocumentNumber', e.target.value)} />
                    </div>
                    <div>
                      <Label>Expiry Date</Label>
                      <Input type="date" value={formData.beneficialOwners[boIndex].idDocumentExpiry} onChange={e => updateBO(boIndex, 'idDocumentExpiry', e.target.value)} />
                    </div>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Upload ID Document</p>
                        {formData.beneficialOwners[boIndex].idDocumentUrl && (
                          <p className="text-xs text-green-600 mt-1">Document uploaded</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.beneficialOwners[boIndex].idDocumentUploaded}
                          onCheckedChange={checked => updateBO(boIndex, 'idDocumentUploaded', checked)}
                        />
                        <input
                          type="file"
                          className="hidden"
                          ref={el => { boFileInputRefs.current[`id-${boIndex}`] = el; }}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleBODocUpload(file, boIndex, 'idDocumentUrl');
                            e.target.value = '';
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={uploading === `bo-${boIndex}-idDocumentUrl`}
                          onClick={() => boFileInputRefs.current[`id-${boIndex}`]?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading === `bo-${boIndex}-idDocumentUrl` ? 'Uploading...' : formData.beneficialOwners[boIndex].idDocumentUrl ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {boSubStep === 4 && (
                <div className="space-y-4">
                  <div>
                    <Label>Proof of Address Type</Label>
                    <Select value={formData.beneficialOwners[boIndex].proofOfAddressType} onValueChange={v => updateBO(boIndex, 'proofOfAddressType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utility_bill">Utility Bill</SelectItem>
                        <SelectItem value="bank_statement">Bank Statement</SelectItem>
                        <SelectItem value="council_tax">Council Tax Bill</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Must be dated within the last 3 months</p>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">Upload Proof of Address</p>
                        {formData.beneficialOwners[boIndex].proofOfAddressUrl && (
                          <p className="text-xs text-green-600 mt-1">Document uploaded</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={formData.beneficialOwners[boIndex].proofOfAddressUploaded}
                          onCheckedChange={checked => updateBO(boIndex, 'proofOfAddressUploaded', checked)}
                        />
                        <input
                          type="file"
                          className="hidden"
                          ref={el => { boFileInputRefs.current[`poa-${boIndex}`] = el; }}
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleBODocUpload(file, boIndex, 'proofOfAddressUrl');
                            e.target.value = '';
                          }}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={uploading === `bo-${boIndex}-proofOfAddressUrl`}
                          onClick={() => boFileInputRefs.current[`poa-${boIndex}`]?.click()}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          {uploading === `bo-${boIndex}-proofOfAddressUrl` ? 'Uploading...' : formData.beneficialOwners[boIndex].proofOfAddressUrl ? 'Replace' : 'Upload'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Phase 6: Review */}
        {currentPhase === 'review' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Review & Submit
                </CardTitle>
                <CardDescription>Review all details before submitting.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Company Details</h3>
                  <div className="bg-muted/50 rounded-lg p-4 space-y-1 text-sm">
                    <p><span className="text-muted-foreground">Jurisdiction:</span> {jurisdictionConfig?.label}</p>
                    <p><span className="text-muted-foreground">Company Name:</span> {formData.companyName}</p>
                    <p><span className="text-muted-foreground">Registration No:</span> {formData.registrationNumber}</p>
                    {formData.vatNumber && <p><span className="text-muted-foreground">VAT:</span> {formData.vatNumber}</p>}
                    {formData.taxId && <p><span className="text-muted-foreground">Tax ID:</span> {formData.taxId}</p>}
                    <p><span className="text-muted-foreground">Address:</span> {[formData.registeredAddressLine1, formData.registeredCity, formData.registeredPostcode].filter(Boolean).join(', ')}</p>
                    {formData.contactEmail && <p><span className="text-muted-foreground">Email:</span> {formData.contactEmail}</p>}
                    {formData.contactPhone && <p><span className="text-muted-foreground">Phone:</span> {formData.contactPhone}</p>}
                    {formData.dateOfIncorporation && <p><span className="text-muted-foreground">Incorporated:</span> {formData.dateOfIncorporation}</p>}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Documents</h3>
                  <div className="bg-muted/50 rounded-lg p-4 text-sm">
                    {jurisdictionConfig?.documents.map(doc => (
                      <div key={doc} className="flex items-center gap-2 py-1">
                        {formData.documentsChecked[doc] ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                        )}
                        <span>{doc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Beneficial Owners ({formData.beneficialOwners.length})</h3>
                  {formData.beneficialOwners.map((bo, idx) => (
                    <div key={idx} className="bg-muted/50 rounded-lg p-4 text-sm mb-2">
                      <p className="font-medium">{bo.fullName}</p>
                      <div className="grid grid-cols-2 gap-x-4 mt-1">
                        {bo.ownershipPercentage && <p><span className="text-muted-foreground">Ownership:</span> {bo.ownershipPercentage}%</p>}
                        {bo.email && <p><span className="text-muted-foreground">Email:</span> {bo.email}</p>}
                        {bo.nationality && <p><span className="text-muted-foreground">Nationality:</span> {bo.nationality}</p>}
                        <p><span className="text-muted-foreground">Roles:</span> {[bo.isDirector && 'Director', bo.isPsc && 'PSC', bo.isTrustee && 'Trustee'].filter(Boolean).join(', ') || 'None'}</p>
                        <p><span className="text-muted-foreground">ID:</span> {bo.idDocumentUploaded ? 'Uploaded' : 'Pending'}</p>
                        <p><span className="text-muted-foreground">PoA:</span> {bo.proofOfAddressUploaded ? 'Uploaded' : 'Pending'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {currentPhase === 'review' ? (
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending}
              className="bg-gradient-to-r from-green-600 to-emerald-600"
            >
              {submitMutation.isPending ? 'Saving...' : 'Complete Onboarding'}
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
