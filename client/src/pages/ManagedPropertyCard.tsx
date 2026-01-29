import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    ArrowLeft, Building2, User, FileText, PoundSterling,
    Calendar, Shield, CheckCircle2, AlertTriangle, Key,
    Phone, Mail, CreditCard, Home, Pencil, Upload, ExternalLink,
    Loader2, FileUp
} from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
    id: number;
    itemType: string;
    label: string;
    isCompleted: boolean;
    category: 'financial' | 'legal' | 'tenant' | 'property' | 'deposit' | 'keys';
    workflow: 'onboarding' | 'vacating' | 'renewal' | 'general';
    requiresDocument: boolean;
    documentUrl?: string;
    documentName?: string;
    notes?: string;
    completedAt?: string;
}

export default function ManagedPropertyCard() {
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editTenancyDialogOpen, setEditTenancyDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState({
        address: '',
        postcode: '',
        city: '',
        propertyType: '',
        bedrooms: '',
        bathrooms: '',
        managementFeeValue: '',
        status: ''
    });
    const [tenancyForm, setTenancyForm] = useState({
        tenantId: '',
        rentAmount: '',
        rentFrequency: 'monthly',
        rentDueDay: '1',
        depositAmount: '',
        depositScheme: '',
        startDate: '',
        endDate: '',
        status: 'active'
    });
    const [editingTenancyId, setEditingTenancyId] = useState<number | null>(null);
    const [saving, setSaving] = useState(false);

    // Fetch property details
    const { data: property, isLoading: propertyLoading } = useQuery({
        queryKey: ['/api/crm/properties', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/properties/${id}`);
            if (!res.ok) throw new Error('Failed to fetch property');
            return res.json();
        }
    });

    // Fetch ALL tenancies for this property (using pm/tenancies endpoint)
    const { data: allTenancies = [], refetch: refetchTenancy } = useQuery({
        queryKey: ['/api/crm/pm/tenancies', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/pm/tenancies?propertyId=${id}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Current/active tenancy is the first one (most recent by createdAt)
    const tenancy = allTenancies.find((t: any) => t.status === 'active') || allTenancies[0] || null;

    // Fetch tenant details if there's a tenancy with a tenant
    const { data: tenant } = useQuery({
        queryKey: ['/api/crm/tenants', tenancy?.tenantId],
        queryFn: async () => {
            if (!tenancy?.tenantId) return null;
            const res = await fetch(`/api/crm/tenants/${tenancy.tenantId}`);
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!tenancy?.tenantId
    });

    // Fetch all tenants for dropdown
    const { data: allTenants = [] } = useQuery({
        queryKey: ['/api/crm/tenants'],
        queryFn: async () => {
            const res = await fetch('/api/crm/tenants');
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Keep rentalAgreement for backwards compatibility (some components may use it)
    const rentalAgreement = tenancy;

    // Fetch landlord details - use property.landlordId directly (not from rental agreement)
    const { data: landlord } = useQuery({
        queryKey: ['/api/crm/landlords', property?.landlordId],
        queryFn: async () => {
            if (!property?.landlordId) return null;
            const res = await fetch(`/api/crm/landlords/${property.landlordId}`);
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!property?.landlordId
    });

    // Fetch maintenance tickets
    const { data: maintenanceTickets } = useQuery({
        queryKey: ['/api/crm/maintenance', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/maintenance?propertyId=${id}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Fetch checklist from database (based on active tenancy)
    const { data: checklist = [], refetch: refetchChecklist } = useQuery({
        queryKey: ['/api/crm/pm/tenancies', tenancy?.id, 'checklist'],
        queryFn: async () => {
            if (!tenancy?.id) return [];
            const res = await fetch(`/api/crm/pm/tenancies/${tenancy.id}/checklist`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!tenancy?.id
    });

    // State for document upload
    const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useState<HTMLInputElement | null>(null);

    // Toggle checklist item completion
    const toggleCheck = async (item: ChecklistItem) => {
        try {
            const res = await fetch(`/api/crm/pm/checklist/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ isCompleted: !item.isCompleted })
            });
            if (!res.ok) throw new Error('Failed to update');
            refetchChecklist();
            toast({
                title: item.isCompleted ? 'Item unchecked' : 'Item completed',
                description: item.label
            });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update checklist item', variant: 'destructive' });
        }
    };

    // Handle file upload for checklist item
    const handleFileUpload = async (itemId: number, file: File) => {
        setUploadingItemId(itemId);
        try {
            // Create form data for upload
            const formData = new FormData();
            formData.append('file', file);
            formData.append('folder', 'checklist');

            // Upload file
            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });
            if (!uploadRes.ok) throw new Error('Upload failed');
            const { url } = await uploadRes.json();

            // Update checklist item with document URL
            const updateRes = await fetch(`/api/crm/pm/checklist/${itemId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentUrl: url,
                    documentName: file.name,
                    isCompleted: true // Auto-complete when document is uploaded
                })
            });
            if (!updateRes.ok) throw new Error('Failed to update checklist');

            refetchChecklist();
            toast({ title: 'Document uploaded', description: `${file.name} has been uploaded and item marked complete` });
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to upload document', variant: 'destructive' });
        } finally {
            setUploadingItemId(null);
            setSelectedFile(null);
        }
    };

    const getChecklistByCategory = (category: string) =>
        checklist.filter((item: ChecklistItem) => item.category === category);

    // Workflow order for grouping checklist items
    const workflowOrder = ['onboarding', 'compliance', 'general', 'vacating', 'renewal'] as const;
    const workflowLabels: Record<string, string> = {
        'onboarding': 'Onboarding',
        'compliance': 'Compliance',
        'general': 'General / Ongoing',
        'vacating': 'Vacating',
        'renewal': 'Renewal'
    };

    // Group checklist items by workflow
    const getChecklistByWorkflow = () => {
        const grouped: Record<string, ChecklistItem[]> = {};
        workflowOrder.forEach(wf => { grouped[wf] = []; });

        checklist.forEach((item: ChecklistItem) => {
            const workflow = item.workflow || 'general';
            if (!grouped[workflow]) grouped[workflow] = [];
            grouped[workflow].push(item);
        });

        return grouped;
    };

    // Check if item is truly complete (has document if required)
    const isItemTrulyComplete = (item: ChecklistItem) => {
        if (item.requiresDocument && !item.documentUrl) {
            return false; // Requires document but none uploaded
        }
        return item.isCompleted;
    };

    const completedCount = checklist.filter((c: ChecklistItem) => isItemTrulyComplete(c)).length;
    const completionPercent = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

    // Open edit dialog and populate form
    const openEditDialog = () => {
        if (property) {
            setEditForm({
                address: property.title || property.addressLine1 || '',
                postcode: property.postcode || '',
                city: property.city || '',
                propertyType: property.propertyType || 'flat',
                bedrooms: property.bedrooms?.toString() || '',
                bathrooms: property.bathrooms?.toString() || '',
                managementFeeValue: property.managementFeeValue?.toString() || '',
                status: property.status || 'active'
            });
            setEditDialogOpen(true);
        }
    };

    // Open edit tenancy dialog and populate form
    const openEditTenancyDialog = (tenancyToEdit?: any) => {
        const t = tenancyToEdit || tenancy;
        if (t) {
            setEditingTenancyId(t.id);
            setTenancyForm({
                tenantId: t.tenantId?.toString() || 'none',
                rentAmount: t.rentAmount?.toString() || '',
                rentFrequency: t.rentFrequency || 'monthly',
                rentDueDay: t.rentDueDay?.toString() || '1',
                depositAmount: t.depositAmount?.toString() || '',
                depositScheme: t.depositScheme || 'not_specified',
                startDate: t.startDate ? new Date(t.startDate).toISOString().split('T')[0] : '',
                endDate: t.endDate ? new Date(t.endDate).toISOString().split('T')[0] : '',
                status: t.status || 'active'
            });
        }
        setEditTenancyDialogOpen(true);
    };

    // Save tenancy updates
    const saveTenancy = async () => {
        if (!editingTenancyId) return;
        setSaving(true);
        try {
            // Handle special select values
            const tenantId = tenancyForm.tenantId && tenancyForm.tenantId !== 'none'
                ? parseInt(tenancyForm.tenantId)
                : null;
            const depositScheme = tenancyForm.depositScheme && tenancyForm.depositScheme !== 'not_specified'
                ? tenancyForm.depositScheme
                : null;

            const res = await fetch(`/api/crm/pm/tenancies/${editingTenancyId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tenantId,
                    rentAmount: tenancyForm.rentAmount || null,
                    rentFrequency: tenancyForm.rentFrequency,
                    rentDueDay: parseInt(tenancyForm.rentDueDay) || 1,
                    depositAmount: tenancyForm.depositAmount || null,
                    depositScheme,
                    startDate: tenancyForm.startDate ? new Date(tenancyForm.startDate) : null,
                    endDate: tenancyForm.endDate ? new Date(tenancyForm.endDate) : null,
                    status: tenancyForm.status
                })
            });
            if (!res.ok) throw new Error('Failed to update tenancy');

            await refetchTenancy();
            await queryClient.invalidateQueries({ queryKey: ['/api/crm/tenants'] });
            toast({ title: 'Success', description: 'Tenancy updated successfully' });
            setEditTenancyDialogOpen(false);
            setEditingTenancyId(null);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update tenancy', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    // Save property updates
    const saveProperty = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/crm/properties/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: editForm.address,
                    postcode: editForm.postcode,
                    city: editForm.city,
                    propertyType: editForm.propertyType,
                    bedrooms: parseInt(editForm.bedrooms) || null,
                    bathrooms: parseInt(editForm.bathrooms) || null,
                    managementFeeValue: parseFloat(editForm.managementFeeValue) || null,
                    status: editForm.status
                })
            });
            if (!res.ok) throw new Error('Failed to update property');

            await queryClient.invalidateQueries({ queryKey: ['/api/crm/properties', id] });
            toast({ title: 'Success', description: 'Property updated successfully' });
            setEditDialogOpen(false);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to update property', variant: 'destructive' });
        } finally {
            setSaving(false);
        }
    };

    if (propertyLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="ghost" onClick={() => setLocation('/crm')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Dashboard
                </Button>
                <Badge variant="secondary" className="text-sm">
                    Managed Property
                </Badge>
            </div>

            {/* Property Title */}
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Building2 className="h-8 w-8 text-primary" />
                        {property?.title || property?.addressLine1 || 'Property Details'}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {property?.postcode} • {property?.city}
                    </p>
                </div>
                <Button onClick={openEditDialog} variant="outline">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Property
                </Button>
            </div>

            {/* Edit Property Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Edit Property</DialogTitle>
                        <DialogDescription>
                            Update the property details below
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="address">Address</Label>
                            <Input
                                id="address"
                                value={editForm.address}
                                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="postcode">Postcode</Label>
                                <Input
                                    id="postcode"
                                    value={editForm.postcode}
                                    onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="city">City</Label>
                                <Input
                                    id="city"
                                    value={editForm.city}
                                    onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="propertyType">Property Type</Label>
                                <Select
                                    value={editForm.propertyType}
                                    onValueChange={(value) => setEditForm({ ...editForm, propertyType: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="flat">Flat</SelectItem>
                                        <SelectItem value="house">House</SelectItem>
                                        <SelectItem value="maisonette">Maisonette</SelectItem>
                                        <SelectItem value="studio">Studio</SelectItem>
                                        <SelectItem value="bungalow">Bungalow</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="status">Status</Label>
                                <Select
                                    value={editForm.status}
                                    onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="void">Void</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="bedrooms">Bedrooms</Label>
                                <Input
                                    id="bedrooms"
                                    type="number"
                                    value={editForm.bedrooms}
                                    onChange={(e) => setEditForm({ ...editForm, bedrooms: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="bathrooms">Bathrooms</Label>
                                <Input
                                    id="bathrooms"
                                    type="number"
                                    value={editForm.bathrooms}
                                    onChange={(e) => setEditForm({ ...editForm, bathrooms: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="managementFee">Mgmt Fee %</Label>
                                <Input
                                    id="managementFee"
                                    type="number"
                                    step="0.5"
                                    value={editForm.managementFeeValue}
                                    onChange={(e) => setEditForm({ ...editForm, managementFeeValue: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveProperty} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Tenancy Dialog */}
            <Dialog open={editTenancyDialogOpen} onOpenChange={setEditTenancyDialogOpen}>
                <DialogContent className="sm:max-w-[600px]">
                    <DialogHeader>
                        <DialogTitle>Edit Tenancy</DialogTitle>
                        <DialogDescription>
                            Update tenant assignment, rent, deposit, and tenancy dates
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                        {/* Tenant Selection */}
                        <div className="grid gap-2">
                            <Label htmlFor="tenantId">Tenant</Label>
                            <Select
                                value={tenancyForm.tenantId}
                                onValueChange={(value) => setTenancyForm({ ...tenancyForm, tenantId: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a tenant" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">No tenant (Void)</SelectItem>
                                    {allTenants.map((t: any) => (
                                        <SelectItem key={t.id} value={t.id.toString()}>
                                            {t.fullName} {t.email ? `(${t.email})` : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Rent Details */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="rentAmount">Rent Amount (£)</Label>
                                <Input
                                    id="rentAmount"
                                    type="number"
                                    step="0.01"
                                    value={tenancyForm.rentAmount}
                                    onChange={(e) => setTenancyForm({ ...tenancyForm, rentAmount: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="rentFrequency">Frequency</Label>
                                <Select
                                    value={tenancyForm.rentFrequency}
                                    onValueChange={(value) => setTenancyForm({ ...tenancyForm, rentFrequency: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="weekly">Weekly</SelectItem>
                                        <SelectItem value="monthly">Monthly</SelectItem>
                                        <SelectItem value="quarterly">Quarterly</SelectItem>
                                        <SelectItem value="annually">Annually</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="rentDueDay">Due Day</Label>
                                <Input
                                    id="rentDueDay"
                                    type="number"
                                    min="1"
                                    max="28"
                                    value={tenancyForm.rentDueDay}
                                    onChange={(e) => setTenancyForm({ ...tenancyForm, rentDueDay: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Deposit Details */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="depositAmount">Deposit Amount (£)</Label>
                                <Input
                                    id="depositAmount"
                                    type="number"
                                    step="0.01"
                                    value={tenancyForm.depositAmount}
                                    onChange={(e) => setTenancyForm({ ...tenancyForm, depositAmount: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="depositScheme">Deposit Scheme</Label>
                                <Select
                                    value={tenancyForm.depositScheme}
                                    onValueChange={(value) => setTenancyForm({ ...tenancyForm, depositScheme: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select scheme" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="not_specified">Not specified</SelectItem>
                                        <SelectItem value="dps">DPS (Deposit Protection Service)</SelectItem>
                                        <SelectItem value="tds">TDS (Tenancy Deposit Scheme)</SelectItem>
                                        <SelectItem value="mydeposits">MyDeposits</SelectItem>
                                        <SelectItem value="landlord">Held by Landlord</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Tenancy Dates */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="startDate">Start Date</Label>
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={tenancyForm.startDate}
                                    onChange={(e) => setTenancyForm({ ...tenancyForm, startDate: e.target.value })}
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="endDate">End Date</Label>
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={tenancyForm.endDate}
                                    onChange={(e) => setTenancyForm({ ...tenancyForm, endDate: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* Tenancy Status */}
                        <div className="grid gap-2">
                            <Label htmlFor="tenancyStatus">Tenancy Status</Label>
                            <Select
                                value={tenancyForm.status}
                                onValueChange={(value) => setTenancyForm({ ...tenancyForm, status: value })}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="ended">Ended</SelectItem>
                                    <SelectItem value="terminated">Terminated</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditTenancyDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={saveTenancy} disabled={saving}>
                            {saving ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Summary Cards */}
                <div className="space-y-6">
                    {/* Tenant Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <Key className="h-5 w-5 text-amber-600" />
                                Tenant Details
                            </CardTitle>
                            {tenancy && (
                                <Button variant="ghost" size="sm" onClick={openEditTenancyDialog}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {tenant ? (
                                <>
                                    <div className="font-semibold text-lg">
                                        {tenant.fullName}
                                    </div>
                                    {tenant.mobile && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="h-4 w-4 text-muted-foreground" />
                                            {tenant.mobile}
                                        </div>
                                    )}
                                    {tenant.email && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="h-4 w-4 text-muted-foreground" />
                                            {tenant.email}
                                        </div>
                                    )}
                                    {tenant.employer && (
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Building2 className="h-4 w-4" />
                                            {tenant.employer}
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-muted-foreground text-center py-4">
                                    <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                    <p>No tenant assigned</p>
                                    {tenancy && (
                                        <Button variant="link" size="sm" onClick={openEditTenancyDialog}>
                                            Assign tenant
                                        </Button>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Rent & Deposit Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <PoundSterling className="h-5 w-5 text-green-600" />
                                Financial Summary
                            </CardTitle>
                            {tenancy && (
                                <Button variant="ghost" size="sm" onClick={openEditTenancyDialog}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Monthly Rent</span>
                                <span className="text-2xl font-bold text-green-600">
                                    £{tenancy?.rentAmount?.toLocaleString() || property?.price?.toLocaleString() || '0'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Deposit Held</span>
                                <span className="text-xl font-semibold">
                                    £{tenancy?.depositAmount?.toLocaleString() || '0'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Deposit Scheme</span>
                                <Badge variant="outline">
                                    {tenancy?.depositScheme?.toUpperCase() || 'Not specified'}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Management Fee</span>
                                <Badge className="bg-blue-100 text-blue-800">
                                    {property?.managementFeeValue || '0'}%
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tenancy Dates Card */}
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                Tenancy Period
                            </CardTitle>
                            {tenancy && (
                                <Button variant="ghost" size="sm" onClick={openEditTenancyDialog}>
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Start Date</span>
                                <span className="font-medium">
                                    {tenancy?.startDate
                                        ? new Date(tenancy.startDate).toLocaleDateString('en-GB')
                                        : 'Not set'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">End Date</span>
                                <span className="font-medium">
                                    {tenancy?.endDate
                                        ? new Date(tenancy.endDate).toLocaleDateString('en-GB')
                                        : 'Not set'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Rent Due Day</span>
                                <span className="font-medium">
                                    {tenancy?.rentDueDay ? `${tenancy.rentDueDay}${tenancy.rentDueDay === 1 ? 'st' : tenancy.rentDueDay === 2 ? 'nd' : tenancy.rentDueDay === 3 ? 'rd' : 'th'} of month` : 'Not set'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Status</span>
                                <Badge className={
                                    tenancy?.status === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                }>
                                    {tenancy?.status || 'Unknown'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Landlord Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User className="h-5 w-5 text-purple-600" />
                                Landlord Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="font-semibold text-lg">
                                {landlord?.fullName || 'Not assigned'}
                            </div>
                            {landlord?.mobile && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    {landlord.mobile}
                                </div>
                            )}
                            {landlord?.email && (
                                <div className="flex items-center gap-2 text-sm">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    {landlord.email}
                                </div>
                            )}
                            {landlord?.bankName && (
                                <div className="flex items-center gap-2 text-sm">
                                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                                    {landlord.bankName} - ****{landlord.bankAccountNo?.slice(-4)}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column - Checklist */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5 text-orange-600" />
                                        Property Checklist
                                    </CardTitle>
                                    <CardDescription>
                                        {completedCount} of {checklist.length} items completed
                                    </CardDescription>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold text-primary">{completionPercent}%</div>
                                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary transition-all duration-300"
                                            style={{ width: `${completionPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="tenancy-history" className="w-full">
                                <TabsList className="grid grid-cols-5 w-full mb-4">
                                    <TabsTrigger value="tenancy-history" className="text-xs">Tenancy History</TabsTrigger>
                                    <TabsTrigger value="financial" className="text-xs">Checklist</TabsTrigger>
                                    <TabsTrigger value="maintenance" className="text-xs">Maintenance</TabsTrigger>
                                    <TabsTrigger value="documents" className="text-xs">Documents</TabsTrigger>
                                    <TabsTrigger value="communication" className="text-xs">History</TabsTrigger>
                                </TabsList>

                                {/* Tenancy History Tab */}
                                <TabsContent value="tenancy-history" className="space-y-3">
                                    {allTenancies.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
                                            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No tenancy records found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {allTenancies.map((t: any, index: number) => (
                                                <div key={t.id} className={`p-4 border rounded-lg ${t.status === 'active' ? 'bg-green-50 border-green-200' : 'bg-white'}`}>
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div className="flex items-center gap-2">
                                                            <Badge className={t.status === 'active' ? 'bg-green-500' : t.status === 'ended' ? 'bg-gray-500' : 'bg-amber-500'}>
                                                                {t.status === 'active' ? 'Current' : t.status?.charAt(0).toUpperCase() + t.status?.slice(1)}
                                                            </Badge>
                                                            {index === 0 && t.status === 'active' && (
                                                                <span className="text-xs text-green-600 font-medium">Active Tenancy</span>
                                                            )}
                                                        </div>
                                                        <Button variant="ghost" size="sm" onClick={() => openEditTenancyDialog(t)}>
                                                            <Pencil className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-muted-foreground block">Tenant</span>
                                                            <span className="font-medium">
                                                                {allTenants.find((tenant: any) => tenant.id === t.tenantId)?.fullName || 'Void/Not assigned'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Rent</span>
                                                            <span className="font-medium">£{t.rentAmount?.toLocaleString() || '0'}/{t.rentFrequency || 'month'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Deposit</span>
                                                            <span className="font-medium">£{t.depositAmount?.toLocaleString() || '0'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Scheme</span>
                                                            <span className="font-medium">{t.depositScheme?.toUpperCase() || 'N/A'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Start Date</span>
                                                            <span className="font-medium">
                                                                {t.startDate ? new Date(t.startDate).toLocaleDateString('en-GB') : 'Not set'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">End Date</span>
                                                            <span className="font-medium">
                                                                {t.endDate ? new Date(t.endDate).toLocaleDateString('en-GB') : 'Periodic'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Due Day</span>
                                                            <span className="font-medium">{t.rentDueDay || 1}st of month</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Created</span>
                                                            <span className="font-medium">
                                                                {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : 'Unknown'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {t.notes && (
                                                        <div className="mt-3 pt-3 border-t">
                                                            <span className="text-muted-foreground text-sm">Notes: </span>
                                                            <span className="text-sm">{t.notes}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Documents Tab */}
                                <TabsContent value="documents" className="space-y-3">
                                    <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
                                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p>No documents uploaded yet</p>
                                        <Button variant="link" size="sm">Upload Document</Button>
                                    </div>
                                </TabsContent>

                                {/* Maintenance Tab */}
                                <TabsContent value="maintenance" className="space-y-3">
                                    {maintenanceTickets?.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
                                            <p>No maintenance tickets found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {maintenanceTickets?.map((ticket: any) => (
                                                <div key={ticket.id} className="p-3 border rounded-lg bg-white flex justify-between items-center">
                                                    <div>
                                                        <p className="font-medium text-sm">{ticket.title}</p>
                                                        <p className="text-xs text-muted-foreground">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                                                    </div>
                                                    <Badge variant={ticket.status === 'completed' ? 'default' : 'outline'}>{ticket.status}</Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Communication Tab */}
                                <TabsContent value="communication" className="space-y-3">
                                    <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
                                        <p>No communication history found</p>
                                        <Button variant="link" size="sm">View All Communications</Button>
                                    </div>
                                </TabsContent>

                                {/* Checklist Tab - grouped by workflow */}
                                <TabsContent value="financial" className="space-y-6">
                                    {checklist.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
                                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                            <p>No checklist items found</p>
                                            <p className="text-sm">Checklist items are created when a tenancy is set up</p>
                                        </div>
                                    ) : (
                                        <>
                                            {workflowOrder.map(workflow => {
                                                const items = getChecklistByWorkflow()[workflow];
                                                if (!items || items.length === 0) return null;

                                                const workflowComplete = items.filter(i => isItemTrulyComplete(i)).length;
                                                const workflowTotal = items.length;

                                                return (
                                                    <div key={workflow} className="space-y-3">
                                                        {/* Workflow section header */}
                                                        <div className="flex items-center justify-between border-b pb-2">
                                                            <h4 className={`font-semibold text-sm ${
                                                                workflow === 'onboarding' ? 'text-blue-700' :
                                                                workflow === 'vacating' ? 'text-orange-700' :
                                                                workflow === 'compliance' ? 'text-red-700' :
                                                                workflow === 'renewal' ? 'text-purple-700' :
                                                                'text-gray-700'
                                                            }`}>
                                                                {workflowLabels[workflow]}
                                                            </h4>
                                                            <span className="text-xs text-muted-foreground">
                                                                {workflowComplete}/{workflowTotal} complete
                                                            </span>
                                                        </div>

                                                        {/* Items in this workflow */}
                                                        {items.map((item: ChecklistItem) => {
                                                            const trulyComplete = isItemTrulyComplete(item);
                                                            const needsDocument = item.requiresDocument && !item.documentUrl;

                                                            return (
                                                                <div
                                                                    key={item.id}
                                                                    className={`p-3 rounded-lg border transition-colors
                                                                        ${trulyComplete ? 'bg-green-50 border-green-200' :
                                                                          needsDocument && item.isCompleted ? 'bg-amber-50 border-amber-200' :
                                                                          'bg-white border-gray-200 hover:bg-gray-50'}`}
                                                                >
                                                                    <div className="flex items-center gap-3">
                                                                        <Checkbox
                                                                            checked={item.isCompleted}
                                                                            onCheckedChange={() => toggleCheck(item)}
                                                                        />
                                                                        <div className="flex-1 min-w-0">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <span className={trulyComplete ? 'line-through text-muted-foreground' : 'font-medium'}>
                                                                                    {item.label}
                                                                                </span>
                                                                                <Badge variant="outline" className="text-xs capitalize">
                                                                                    {item.category}
                                                                                </Badge>
                                                                            </div>
                                                                            {item.documentUrl ? (
                                                                                <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
                                                                                    <FileText className="h-3 w-3" />
                                                                                    <a
                                                                                        href={item.documentUrl}
                                                                                        target="_blank"
                                                                                        rel="noopener noreferrer"
                                                                                        className="text-blue-600 hover:underline flex items-center gap-1"
                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                    >
                                                                                        {item.documentName || 'View document'}
                                                                                        <ExternalLink className="h-3 w-3" />
                                                                                    </a>
                                                                                </div>
                                                                            ) : needsDocument && (
                                                                                <div className="mt-1 text-xs text-amber-600 flex items-center gap-1">
                                                                                    <AlertTriangle className="h-3 w-3" />
                                                                                    Document required
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <div className="flex items-center gap-2">
                                                                            {item.requiresDocument && (
                                                                                <label className="cursor-pointer">
                                                                                    <input
                                                                                        type="file"
                                                                                        className="hidden"
                                                                                        onChange={(e) => {
                                                                                            const file = e.target.files?.[0];
                                                                                            if (file) handleFileUpload(item.id, file);
                                                                                        }}
                                                                                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                                                                    />
                                                                                    {uploadingItemId === item.id ? (
                                                                                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                                                                    ) : (
                                                                                        <Button variant="ghost" size="sm" asChild>
                                                                                            <span>
                                                                                                <Upload className="h-4 w-4 mr-1" />
                                                                                                Upload
                                                                                            </span>
                                                                                        </Button>
                                                                                    )}
                                                                                </label>
                                                                            )}
                                                                            {trulyComplete && (
                                                                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            })}
                                        </>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="mt-6">
                        <CardHeader>
                            <CardTitle className="text-lg">Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <Button variant="outline" className="h-20 flex-col gap-2">
                                    <Shield className="h-5 w-5" />
                                    <span className="text-xs">Compliance</span>
                                </Button>
                                <Button variant="outline" className="h-20 flex-col gap-2">
                                    <FileText className="h-5 w-5" />
                                    <span className="text-xs">Documents</span>
                                </Button>
                                <Button variant="outline" className="h-20 flex-col gap-2">
                                    <PoundSterling className="h-5 w-5" />
                                    <span className="text-xs">Payments</span>
                                </Button>
                                <Button variant="outline" className="h-20 flex-col gap-2">
                                    <Home className="h-5 w-5" />
                                    <span className="text-xs">Maintenance</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
