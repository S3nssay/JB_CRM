import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
    ArrowLeft,
    Plus,
    Search,
    Phone,
    Mail,
    Star,
    StarOff,
    AlertTriangle,
    Clock,
    Wrench,
    Edit,
    Trash2,
    CheckCircle,
    XCircle,
    Building2,
    User,
    Shield,
    MapPin,
    DollarSign,
    ChevronRight,
    ChevronLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

const SPECIALIZATIONS = [
    { value: 'plumbing', label: 'Plumbing' },
    { value: 'electrical', label: 'Electrical' },
    { value: 'gas', label: 'Gas' },
    { value: 'heating', label: 'Heating/HVAC' },
    { value: 'general', label: 'General Maintenance' },
    { value: 'handyman', label: 'Handyman' },
    { value: 'roofing', label: 'Roofing' },
    { value: 'painting', label: 'Painting/Decorating' },
    { value: 'carpentry', label: 'Carpentry' },
    { value: 'locksmith', label: 'Locksmith' },
    { value: 'cleaning', label: 'Cleaning' },
    { value: 'carpet', label: 'Carpet Cleaning' },
    { value: 'pest_control', label: 'Pest Control' },
    { value: 'appliances', label: 'Appliance Repair' },
    { value: 'removals', label: 'Removals' },
    { value: 'gardening', label: 'Gardening/Landscaping' },
    { value: 'glazing', label: 'Glazing/Windows' },
    { value: 'drainage', label: 'Drainage' },
];

const RESPONSE_TIMES = [
    { value: '1 hour', label: '1 Hour (Emergency)' },
    { value: '4 hours', label: '4 Hours' },
    { value: '24 hours', label: '24 Hours' },
    { value: '48 hours', label: '48 Hours' },
    { value: '1 week', label: '1 Week' },
];

interface Contractor {
    id: number;
    companyName: string;
    contactName: string;
    email: string;
    phone: string;
    emergencyPhone?: string;
    specializations?: string[];
    gasRegistrationNumber?: string;
    electricalCertNumber?: string;
    insuranceExpiryDate?: string;
    serviceAreas?: string[];
    availableEmergency?: boolean;
    responseTime?: string;
    callOutFee?: number;
    hourlyRate?: number;
    rating?: number;
    completedJobs?: number;
    isActive?: boolean;
    preferredContractor?: boolean;
    createdAt?: string;
}

const emptyContractor: Partial<Contractor> = {
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    emergencyPhone: '',
    specializations: [],
    gasRegistrationNumber: '',
    electricalCertNumber: '',
    serviceAreas: [],
    availableEmergency: false,
    responseTime: '24 hours',
    callOutFee: undefined,
    hourlyRate: undefined,
    isActive: true,
    preferredContractor: false,
};

export default function ContractorManagement() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [specializationFilter, setSpecializationFilter] = useState<string>("all");
    const [showWizard, setShowWizard] = useState(false);
    const [wizardStep, setWizardStep] = useState(1);
    const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
    const [formData, setFormData] = useState<Partial<Contractor>>(emptyContractor);
    const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: contractors = [], isLoading } = useQuery({
        queryKey: ["/api/crm/contractors"],
        queryFn: async () => {
            const res = await fetch("/api/crm/contractors");
            if (!res.ok) throw new Error("Failed to fetch contractors");
            return res.json();
        }
    });

    const createMutation = useMutation({
        mutationFn: async (data: Partial<Contractor>) => {
            const res = await fetch("/api/crm/contractors", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to create contractor");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/crm/contractors"] });
            toast({ title: "Contractor added successfully" });
            closeWizard();
        },
        onError: () => {
            toast({ title: "Failed to add contractor", variant: "destructive" });
        }
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: number; data: Partial<Contractor> }) => {
            const res = await fetch(`/api/crm/contractors/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to update contractor");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/crm/contractors"] });
            toast({ title: "Contractor updated successfully" });
            closeWizard();
        },
        onError: () => {
            toast({ title: "Failed to update contractor", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: number) => {
            const res = await fetch(`/api/crm/contractors/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) throw new Error("Failed to delete contractor");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/crm/contractors"] });
            toast({ title: "Contractor deleted successfully" });
            setDeleteConfirmId(null);
        },
        onError: () => {
            toast({ title: "Failed to delete contractor", variant: "destructive" });
        }
    });

    const closeWizard = () => {
        setShowWizard(false);
        setWizardStep(1);
        setEditingContractor(null);
        setFormData(emptyContractor);
    };

    const openCreateWizard = () => {
        setFormData(emptyContractor);
        setEditingContractor(null);
        setWizardStep(1);
        setShowWizard(true);
    };

    const openEditWizard = (contractor: Contractor) => {
        setFormData(contractor);
        setEditingContractor(contractor);
        setWizardStep(1);
        setShowWizard(true);
    };

    const handleSave = () => {
        if (editingContractor) {
            updateMutation.mutate({ id: editingContractor.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    const toggleSpecialization = (spec: string) => {
        const current = formData.specializations || [];
        if (current.includes(spec)) {
            setFormData({ ...formData, specializations: current.filter(s => s !== spec) });
        } else {
            setFormData({ ...formData, specializations: [...current, spec] });
        }
    };

    const filteredContractors = contractors.filter((c: Contractor) => {
        const matchesSearch =
            c.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.contactName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesSpecialization = specializationFilter === "all" ||
            c.specializations?.includes(specializationFilter);

        return matchesSearch && matchesSpecialization;
    });

    const getSpecLabel = (spec: string) => {
        return SPECIALIZATIONS.find(s => s.value === spec)?.label || spec;
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <Button
                variant="ghost"
                className="mb-4"
                onClick={() => setLocation("/crm")}
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Button>

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-[#791E75]">Contractor Management</h1>
                    <p className="text-muted-foreground">Manage your approved contractors and vendors</p>
                </div>
                <Button onClick={openCreateWizard} className="bg-[#791E75] hover:bg-[#60175d]">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contractor
                </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Contractors</p>
                                <h3 className="text-2xl font-bold">{contractors.length}</h3>
                            </div>
                            <Building2 className="h-8 w-8 text-[#791E75]" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Active</p>
                                <h3 className="text-2xl font-bold text-green-600">
                                    {contractors.filter((c: Contractor) => c.isActive !== false).length}
                                </h3>
                            </div>
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Emergency Available</p>
                                <h3 className="text-2xl font-bold text-orange-600">
                                    {contractors.filter((c: Contractor) => c.availableEmergency).length}
                                </h3>
                            </div>
                            <AlertTriangle className="h-8 w-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Preferred</p>
                                <h3 className="text-2xl font-bold text-amber-600">
                                    {contractors.filter((c: Contractor) => c.preferredContractor).length}
                                </h3>
                            </div>
                            <Star className="h-8 w-8 text-amber-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search contractors..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <Select value={specializationFilter} onValueChange={setSpecializationFilter}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by trade" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Trades</SelectItem>
                        {SPECIALIZATIONS.map(spec => (
                            <SelectItem key={spec.value} value={spec.value}>{spec.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Contractor List */}
            {isLoading ? (
                <div className="text-center py-12 text-muted-foreground">Loading contractors...</div>
            ) : filteredContractors.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No contractors found</h3>
                        <p className="text-muted-foreground mb-4">
                            {searchTerm || specializationFilter !== "all"
                                ? "Try adjusting your filters"
                                : "Get started by adding your first contractor"}
                        </p>
                        {!searchTerm && specializationFilter === "all" && (
                            <Button onClick={openCreateWizard} className="bg-[#791E75] hover:bg-[#60175d]">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Contractor
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4">
                    {filteredContractors.map((contractor: Contractor) => (
                        <Card key={contractor.id} className="hover:shadow-md transition-shadow">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4">
                                        <div className="h-12 w-12 rounded-full bg-[#791E75]/10 flex items-center justify-center">
                                            <Building2 className="h-6 w-6 text-[#791E75]" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-lg">{contractor.companyName}</h3>
                                                {contractor.preferredContractor && (
                                                    <Badge className="bg-amber-100 text-amber-800">
                                                        <Star className="h-3 w-3 mr-1" /> Preferred
                                                    </Badge>
                                                )}
                                                {contractor.availableEmergency && (
                                                    <Badge className="bg-orange-100 text-orange-800">
                                                        <AlertTriangle className="h-3 w-3 mr-1" /> Emergency
                                                    </Badge>
                                                )}
                                                {contractor.isActive === false && (
                                                    <Badge variant="secondary">Inactive</Badge>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground flex items-center gap-1">
                                                <User className="h-3 w-3" /> {contractor.contactName}
                                            </p>
                                            <div className="flex items-center gap-4 mt-2 text-sm">
                                                <span className="flex items-center gap-1">
                                                    <Phone className="h-3 w-3" /> {contractor.phone}
                                                </span>
                                                {contractor.email && (
                                                    <span className="flex items-center gap-1">
                                                        <Mail className="h-3 w-3" /> {contractor.email}
                                                    </span>
                                                )}
                                                {contractor.responseTime && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {contractor.responseTime}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap gap-1 mt-3">
                                                {contractor.specializations?.map(spec => (
                                                    <Badge key={spec} variant="outline" className="text-xs">
                                                        {getSpecLabel(spec)}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {contractor.hourlyRate && (
                                            <span className="text-sm text-muted-foreground mr-4">
                                                £{contractor.hourlyRate}/hr
                                            </span>
                                        )}
                                        <Button variant="outline" size="sm" onClick={() => openEditWizard(contractor)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="text-red-600 hover:text-red-700"
                                            onClick={() => setDeleteConfirmId(contractor.id)}
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Onboarding Wizard Dialog */}
            <Dialog open={showWizard} onOpenChange={(open) => !open && closeWizard()}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            {editingContractor ? "Edit Contractor" : "Add New Contractor"}
                        </DialogTitle>
                        <DialogDescription>
                            Step {wizardStep} of 4: {
                                wizardStep === 1 ? "Basic Information" :
                                wizardStep === 2 ? "Trade & Specializations" :
                                wizardStep === 3 ? "Certifications & Insurance" :
                                "Availability & Pricing"
                            }
                        </DialogDescription>
                    </DialogHeader>

                    {/* Progress indicator */}
                    <div className="flex gap-2 mb-6">
                        {[1, 2, 3, 4].map(step => (
                            <div
                                key={step}
                                className={`h-2 flex-1 rounded-full ${
                                    step <= wizardStep ? 'bg-[#791E75]' : 'bg-gray-200'
                                }`}
                            />
                        ))}
                    </div>

                    {/* Step 1: Basic Information */}
                    {wizardStep === 1 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="companyName">Company Name *</Label>
                                    <Input
                                        id="companyName"
                                        value={formData.companyName || ''}
                                        onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                                        placeholder="e.g. ABC Plumbing Ltd"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contactName">Contact Name *</Label>
                                    <Input
                                        id="contactName"
                                        value={formData.contactName || ''}
                                        onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                                        placeholder="e.g. John Smith"
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email *</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={formData.email || ''}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="john@abcplumbing.co.uk"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone *</Label>
                                    <Input
                                        id="phone"
                                        value={formData.phone || ''}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+44 7XXX XXXXXX"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="emergencyPhone">Emergency Phone (if different)</Label>
                                <Input
                                    id="emergencyPhone"
                                    value={formData.emergencyPhone || ''}
                                    onChange={(e) => setFormData({ ...formData, emergencyPhone: e.target.value })}
                                    placeholder="24/7 emergency contact"
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Trade & Specializations */}
                    {wizardStep === 2 && (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Specializations *</Label>
                                <p className="text-sm text-muted-foreground">Select all trades this contractor can handle</p>
                                <div className="grid grid-cols-3 gap-2 mt-2">
                                    {SPECIALIZATIONS.map(spec => (
                                        <div
                                            key={spec.value}
                                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                                                formData.specializations?.includes(spec.value)
                                                    ? 'border-[#791E75] bg-[#791E75]/10'
                                                    : 'border-gray-200 hover:border-gray-300'
                                            }`}
                                            onClick={() => toggleSpecialization(spec.value)}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Checkbox
                                                    checked={formData.specializations?.includes(spec.value)}
                                                    className="pointer-events-none"
                                                />
                                                <span className="text-sm">{spec.label}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Certifications & Insurance */}
                    {wizardStep === 3 && (
                        <div className="space-y-4">
                            <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start gap-2">
                                    <Shield className="h-5 w-5 text-amber-600 mt-0.5" />
                                    <div>
                                        <p className="font-medium text-amber-800">Important</p>
                                        <p className="text-sm text-amber-700">
                                            Ensure all certifications are valid and up to date before onboarding contractors.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {formData.specializations?.includes('gas') && (
                                <div className="space-y-2">
                                    <Label htmlFor="gasRegistrationNumber">Gas Safe Registration Number</Label>
                                    <Input
                                        id="gasRegistrationNumber"
                                        value={formData.gasRegistrationNumber || ''}
                                        onChange={(e) => setFormData({ ...formData, gasRegistrationNumber: e.target.value })}
                                        placeholder="e.g. 123456"
                                    />
                                </div>
                            )}

                            {formData.specializations?.includes('electrical') && (
                                <div className="space-y-2">
                                    <Label htmlFor="electricalCertNumber">Electrical Certification Number</Label>
                                    <Input
                                        id="electricalCertNumber"
                                        value={formData.electricalCertNumber || ''}
                                        onChange={(e) => setFormData({ ...formData, electricalCertNumber: e.target.value })}
                                        placeholder="NICEIC/ELECSA number"
                                    />
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="insuranceExpiryDate">Public Liability Insurance Expiry</Label>
                                <Input
                                    id="insuranceExpiryDate"
                                    type="date"
                                    value={formData.insuranceExpiryDate ? new Date(formData.insuranceExpiryDate).toISOString().split('T')[0] : ''}
                                    onChange={(e) => setFormData({ ...formData, insuranceExpiryDate: e.target.value })}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Availability & Pricing */}
                    {wizardStep === 4 && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Response Time</Label>
                                    <Select
                                        value={formData.responseTime || '24 hours'}
                                        onValueChange={(value) => setFormData({ ...formData, responseTime: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {RESPONSE_TIMES.map(rt => (
                                                <SelectItem key={rt.value} value={rt.value}>{rt.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>&nbsp;</Label>
                                    <div className="flex items-center gap-2 h-10">
                                        <Checkbox
                                            id="availableEmergency"
                                            checked={formData.availableEmergency || false}
                                            onCheckedChange={(checked) => setFormData({ ...formData, availableEmergency: checked as boolean })}
                                        />
                                        <Label htmlFor="availableEmergency" className="font-normal cursor-pointer">
                                            Available for emergencies (24/7)
                                        </Label>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="callOutFee">Call-out Fee (£)</Label>
                                    <Input
                                        id="callOutFee"
                                        type="number"
                                        value={formData.callOutFee || ''}
                                        onChange={(e) => setFormData({ ...formData, callOutFee: e.target.value ? parseInt(e.target.value) : undefined })}
                                        placeholder="e.g. 50"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="hourlyRate">Hourly Rate (£)</Label>
                                    <Input
                                        id="hourlyRate"
                                        type="number"
                                        value={formData.hourlyRate || ''}
                                        onChange={(e) => setFormData({ ...formData, hourlyRate: e.target.value ? parseInt(e.target.value) : undefined })}
                                        placeholder="e.g. 45"
                                    />
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-4 border-t">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="preferredContractor"
                                        checked={formData.preferredContractor || false}
                                        onCheckedChange={(checked) => setFormData({ ...formData, preferredContractor: checked as boolean })}
                                    />
                                    <Label htmlFor="preferredContractor" className="font-normal cursor-pointer">
                                        Mark as Preferred Contractor
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="isActive"
                                        checked={formData.isActive !== false}
                                        onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked as boolean })}
                                    />
                                    <Label htmlFor="isActive" className="font-normal cursor-pointer">
                                        Active
                                    </Label>
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex justify-between mt-6">
                        <div>
                            {wizardStep > 1 && (
                                <Button variant="outline" onClick={() => setWizardStep(wizardStep - 1)}>
                                    <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={closeWizard}>Cancel</Button>
                            {wizardStep < 4 ? (
                                <Button
                                    onClick={() => setWizardStep(wizardStep + 1)}
                                    className="bg-[#791E75] hover:bg-[#60175d]"
                                    disabled={
                                        (wizardStep === 1 && (!formData.companyName || !formData.contactName || !formData.email || !formData.phone)) ||
                                        (wizardStep === 2 && (!formData.specializations || formData.specializations.length === 0))
                                    }
                                >
                                    Next <ChevronRight className="h-4 w-4 ml-1" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleSave}
                                    className="bg-[#791E75] hover:bg-[#60175d]"
                                    disabled={createMutation.isPending || updateMutation.isPending}
                                >
                                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Contractor"}
                                </Button>
                            )}
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation */}
            <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Contractor?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the contractor from your records.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-red-600 hover:bg-red-700"
                            onClick={() => deleteConfirmId && deleteMutation.mutate(deleteConfirmId)}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
