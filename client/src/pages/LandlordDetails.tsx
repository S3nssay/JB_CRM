import React, { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
    ArrowLeft, User, Phone, Mail, Building, FileText, CreditCard, Shield, Briefcase,
    Upload, Download, CheckCircle2, AlertCircle, Loader2, Home, Key, Calendar,
    MessageSquare, ExternalLink, Users, Plus, Trash2, Edit, Pencil, Save
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function LandlordDetails() {
    const { id } = useParams();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const { data: landlord, isLoading } = useQuery({
        queryKey: ['landlord', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/landlords/${id}`);
            if (!res.ok) throw new Error("Failed to fetch landlord");
            return res.json();
        }
    });

    // Fetch properties owned by this landlord directly from managed properties
    const { data: properties = [], isLoading: isLoadingProperties } = useQuery({
        queryKey: ['landlord-properties', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/managed-properties`);
            if (!res.ok) return [];
            const allProperties = await res.json();
            // Filter to properties owned by this landlord
            // Compare as numbers to handle type mismatches
            const landlordIdNum = parseInt(id as string, 10);
            return allProperties.filter((p: any) => {
                const propLandlordId = typeof p.landlordId === 'string' ? parseInt(p.landlordId, 10) : p.landlordId;
                return propLandlordId === landlordIdNum;
            });
        }
    });

    // Fetch tenancies for properties owned by this landlord
    const { data: tenancies = [] } = useQuery({
        queryKey: ['landlord-tenancies', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/pm/tenancies?landlordId=${id}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Get the active tenancy (for fetching checklist)
    const activeTenancy = tenancies.find((t: any) => t.status === 'active') || tenancies[0];

    // Fetch checklist/documents for the active tenancy (landlord-related documents)
    const { data: checklist = [], refetch: refetchChecklist } = useQuery({
        queryKey: ['checklist', 'landlord', activeTenancy?.id],
        queryFn: async () => {
            if (!activeTenancy?.id) return [];
            const res = await fetch(`/api/crm/pm/tenancies/${activeTenancy.id}/checklist`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!activeTenancy?.id
    });

    // Fetch beneficial owners for corporate landlords
    const { data: beneficialOwners = [], refetch: refetchBeneficialOwners } = useQuery({
        queryKey: ['beneficial-owners', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/landlords/${id}/beneficial-owners`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Edit landlord state
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editForm, setEditForm] = useState<any>({});

    // Initialize edit form when landlord data is loaded
    React.useEffect(() => {
        if (landlord) {
            setEditForm({
                name: landlord.name || landlord.fullName || '',
                email: landlord.email || '',
                phone: landlord.phone || '',
                mobile: landlord.mobile || '',
                addressLine1: landlord.addressLine1 || landlord.address || '',
                addressLine2: landlord.addressLine2 || '',
                city: landlord.city || '',
                postcode: landlord.postcode || '',
                landlordType: landlord.landlordType || 'individual',
                companyName: landlord.companyName || '',
                companyRegistrationNo: landlord.companyRegistrationNo || landlord.companyRegNo || '',
                companyVatNo: landlord.companyVatNo || '',
                bankName: landlord.bankName || '',
                bankAccountNumber: landlord.bankAccountNumber || '',
                bankSortCode: landlord.bankSortCode || '',
                bankAccountHolderName: landlord.bankAccountHolderName || '',
                status: landlord.status || 'active'
            });
        }
    }, [landlord]);

    // Mutation to update landlord
    const updateLandlordMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch(`/api/crm/landlords/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error("Failed to update landlord");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['landlord', id] });
            setIsEditDialogOpen(false);
            toast({
                title: "Landlord updated",
                description: "The landlord details have been updated successfully."
            });
        },
        onError: () => {
            toast({
                title: "Update failed",
                description: "Failed to update landlord details. Please try again.",
                variant: "destructive"
            });
        }
    });

    const handleSaveLandlord = () => {
        updateLandlordMutation.mutate(editForm);
    };

    // Mutation to update checklist item with document
    const uploadDocMutation = useMutation({
        mutationFn: async ({ checklistId, documentUrl, documentName }: { checklistId: number, documentUrl: string, documentName: string }) => {
            const res = await fetch(`/api/crm/pm/checklist/${checklistId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    documentUrl,
                    documentName,
                    isCompleted: true
                })
            });
            if (!res.ok) throw new Error("Failed to update checklist item");
            return res.json();
        },
        onSuccess: () => {
            refetchChecklist();
            toast({
                title: "Document uploaded",
                description: "The document has been uploaded and linked successfully."
            });
        },
        onError: () => {
            toast({
                title: "Upload failed",
                description: "Failed to save the document. Please try again.",
                variant: "destructive"
            });
        }
    });

    // Handle file upload
    const handleFileUpload = async (file: File, checklistItem: any) => {
        try {
            const formData = new FormData();
            formData.append('document', file);

            const uploadRes = await fetch('/api/crm/upload/document', {
                method: 'POST',
                body: formData
            });

            if (!uploadRes.ok) {
                throw new Error('Failed to upload file');
            }

            const uploadData = await uploadRes.json();

            // Update the checklist item with the document URL
            await uploadDocMutation.mutateAsync({
                checklistId: checklistItem.id,
                documentUrl: uploadData.url,
                documentName: file.name
            });
        } catch (error) {
            toast({
                title: "Upload failed",
                description: "Failed to upload the document. Please try again.",
                variant: "destructive"
            });
        }
    };

    // Trigger file input click
    const triggerFileUpload = (docType: string) => {
        const input = fileInputRefs.current[docType];
        if (input) {
            input.click();
        }
    };

    // Landlord-specific document types - KYC and agreement documents only
    const landlordDocumentTypes = [
        'authorization_to_landlord',
        'terms_and_conditions_to_landlord',
        'information_sheet_to_landlord'
    ];

    // Filter checklist items for landlord-related documents only
    const landlordDocuments = checklist.filter((item: any) =>
        landlordDocumentTypes.includes(item.itemType)
    );

    // Calculate document progress - only landlord documents
    const completedDocs = landlordDocuments.filter((d: any) => d.documentUrl).length;
    const docProgress = landlordDocuments.length > 0 ? Math.round((completedDocs / landlordDocuments.length) * 100) : 0;

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading landlord details...</div>;
    }

    if (!landlord) {
        return <div className="p-8 text-center text-red-500">Landlord not found</div>;
    }

    // Helper function for document labels
    const getDocLabel = (itemType: string) => {
        const labels: Record<string, string> = {
            'authorization_to_landlord': 'Authorization Document',
            'terms_and_conditions_to_landlord': 'Terms & Conditions',
            'information_sheet_to_landlord': 'Information Sheet',
            'gas_safety_certificate': 'Gas Safety Certificate',
            'tenancy_agreement': 'Tenancy Agreement',
            'inventory': 'Inventory Report'
        };
        return labels[itemType] || itemType.replace(/_/g, ' ');
    };

    // Helper function for document icons
    const getDocIcon = (itemType: string) => {
        const icons: Record<string, any> = {
            'authorization_to_landlord': Shield,
            'terms_and_conditions_to_landlord': FileText,
            'information_sheet_to_landlord': FileText,
            'gas_safety_certificate': Shield,
            'tenancy_agreement': FileText,
            'inventory': Home
        };
        return icons[itemType] || FileText;
    };

    // Render a document row with upload/download functionality
    const renderDocumentRow = (docType: string, checklistItem: any) => {
        const IconComponent = getDocIcon(docType);
        const hasDocument = !!checklistItem?.documentUrl;
        const isUploading = uploadDocMutation.isPending;

        return (
            <div
                key={docType}
                className={`flex items-center justify-between p-3 rounded-lg border ${hasDocument ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
            >
                <div className="flex items-center gap-3">
                    <IconComponent className={`h-5 w-5 ${hasDocument ? 'text-green-600' : 'text-muted-foreground'}`} />
                    <div>
                        <span className={`font-medium ${hasDocument ? 'text-green-700' : ''}`}>
                            {getDocLabel(docType)}
                        </span>
                        {checklistItem?.documentName && (
                            <p className="text-xs text-muted-foreground">{checklistItem.documentName}</p>
                        )}
                        {checklistItem?.documentUploadedAt && (
                            <p className="text-xs text-muted-foreground">
                                Uploaded: {format(new Date(checklistItem.documentUploadedAt), 'dd MMM yyyy')}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Hidden file input */}
                    <input
                        type="file"
                        ref={(el) => { fileInputRefs.current[docType] = el; }}
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                        onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file && checklistItem) {
                                handleFileUpload(file, checklistItem);
                            }
                            e.target.value = '';
                        }}
                    />

                    {hasDocument ? (
                        <>
                            {/* Download button */}
                            <a
                                href={checklistItem.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm text-[#791E75] hover:underline"
                            >
                                <Download className="h-4 w-4" />
                                Download
                            </a>
                            {/* Re-upload button */}
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => triggerFileUpload(docType)}
                                disabled={isUploading || !checklistItem}
                            >
                                <Upload className="h-4 w-4" />
                            </Button>
                            {/* Green checkmark */}
                            <CheckCircle2 className="h-5 w-5 text-green-600" />
                        </>
                    ) : (
                        <>
                            {/* Upload button */}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => triggerFileUpload(docType)}
                                disabled={isUploading || !checklistItem}
                                className="gap-1"
                            >
                                {isUploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                Upload
                            </Button>
                            {/* Pending badge */}
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-300 bg-amber-50">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Required
                            </Badge>
                        </>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/crm/properties">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        {landlord.name || landlord.fullName}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        {landlord.landlordType === 'company' || landlord.landlordType === 'corporate' ? <Briefcase className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        <span>ID: {landlord.id}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <Badge variant={landlord.status === 'active' ? 'default' : 'secondary'}>
                            {landlord.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                        <Badge variant="outline">{landlord.landlordType?.toUpperCase() || 'INDIVIDUAL'}</Badge>
                    </div>
                </div>
                <Button onClick={() => setIsEditDialogOpen(true)} variant="outline">
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit Landlord
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Contact & Details */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Phone className="h-5 w-5 text-[#791E75]" />
                                Contact Information
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Email</div>
                                    <div className="text-sm text-muted-foreground break-all">
                                        {landlord.email ? (
                                            <a href={`mailto:${landlord.email}`} className="hover:underline text-[#791E75]">
                                                {landlord.email}
                                            </a>
                                        ) : 'No email provided'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Phone</div>
                                    <div className="text-sm text-muted-foreground">
                                        {landlord.phone || landlord.mobile ? (
                                            <a href={`tel:${landlord.phone || landlord.mobile}`} className="hover:underline text-[#791E75]">
                                                {landlord.phone || landlord.mobile}
                                            </a>
                                        ) : 'No phone provided'}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Address</div>
                                    <div className="text-sm text-muted-foreground">
                                        {landlord.addressLine1 || landlord.address || 'No address provided'}
                                        {landlord.addressLine2 && <br />}
                                        {landlord.addressLine2}
                                        {landlord.city && <br />}
                                        {landlord.city} {landlord.postcode}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {landlord.landlordType === 'company' && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Briefcase className="h-5 w-5 text-[#791E75]" />
                                    Company Details
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="font-medium">Company Name</div>
                                    <div className="text-sm text-muted-foreground">{landlord.companyName}</div>
                                </div>
                                <div>
                                    <div className="font-medium">Registration No</div>
                                    <div className="text-sm text-muted-foreground">{landlord.companyRegistrationNo || landlord.companyRegNo || 'N/A'}</div>
                                </div>
                                {landlord.companyVatNo && (
                                    <div>
                                        <div className="font-medium">VAT Number</div>
                                        <div className="text-sm text-muted-foreground">{landlord.companyVatNo}</div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5 text-[#791E75]" />
                                Bank Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">{landlord.bankName || 'Bank'}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {landlord.bankAccountHolderName && (
                                            <>Account: {landlord.bankAccountHolderName}<br /></>
                                        )}
                                        Acc: ****{landlord.bankAccountNumber ? landlord.bankAccountNumber.slice(-4) : '****'}<br />
                                        Sort: {landlord.bankSortCode || 'Not provided'}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Properties Summary */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Home className="h-5 w-5 text-[#791E75]" />
                                Portfolio Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total Properties</span>
                                <span className="text-lg font-bold text-[#791E75]">{properties.length}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Active Tenancies</span>
                                <span className="text-sm font-medium">
                                    {/* Count properties that have an active tenant */}
                                    {properties.filter((p: any) => p.tenantId).length}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Tabs for Documents, Properties, Tenancies */}
                <div className="lg:col-span-2">
                    <Card className="h-full">
                        <CardContent className="p-0">
                            <Tabs defaultValue="documents" className="w-full">
                                <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
                                    <TabsTrigger
                                        value="documents"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent px-6"
                                    >
                                        <FileText className="h-4 w-4 mr-2" />
                                        Documents
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="properties"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent px-6"
                                    >
                                        <Building className="h-4 w-4 mr-2" />
                                        Properties
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="tenancies"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent px-6"
                                    >
                                        <Key className="h-4 w-4 mr-2" />
                                        Tenancies
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="beneficial-owners"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent px-6"
                                    >
                                        <Users className="h-4 w-4 mr-2" />
                                        Beneficial Owner{beneficialOwners.length !== 1 ? 's' : ''}
                                        {beneficialOwners.length > 0 && (
                                            <Badge variant="secondary" className="ml-2">{beneficialOwners.length}</Badge>
                                        )}
                                    </TabsTrigger>
                                </TabsList>

                                {/* Documents Tab */}
                                <TabsContent value="documents" className="p-6 space-y-6">
                                    {/* Progress summary */}
                                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div>
                                            <h4 className="font-medium">Documents Progress</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {completedDocs} of {landlordDocumentTypes.length} documents uploaded
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-2xl font-bold ${docProgress === 100 ? 'text-green-600' : 'text-[#791E75]'}`}>
                                                {docProgress}%
                                            </div>
                                            <Progress value={docProgress} className="w-24 h-2" />
                                        </div>
                                    </div>

                                    {!activeTenancy ? (
                                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                            <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                            <p>No active tenancies found</p>
                                            <p className="text-sm">Documents are linked to tenancies</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Landlord Documents - KYC and Agreement Documents */}
                                            <div>
                                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                                    <Shield className="h-4 w-4" />
                                                    Landlord KYC & Agreement Documents
                                                </h4>
                                                <div className="space-y-2">
                                                    {landlordDocumentTypes.map(docType => {
                                                        const doc = checklist.find((c: any) => c.itemType === docType);
                                                        return renderDocumentRow(docType, doc);
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </TabsContent>

                                {/* Properties Tab */}
                                <TabsContent value="properties" className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-medium">Owned Properties</h4>
                                        <Badge variant="outline">{properties.length} properties</Badge>
                                    </div>
                                    {isLoadingProperties ? (
                                        <div className="text-center py-4">Loading properties...</div>
                                    ) : properties.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                            <Building className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                            <p>No properties linked to this landlord</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {properties.map((prop: any) => (
                                                <Link key={prop.id} href={`/crm/managed-property/${prop.id}`}>
                                                    <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                                <Building className="h-5 w-5 text-blue-600" />
                                                            </div>
                                                            <div>
                                                                <div className="font-medium">
                                                                    {prop.addressLine1 || prop.propertyAddress || prop.title}
                                                                </div>
                                                                <div className="text-sm text-muted-foreground">
                                                                    {prop.postcode} • {prop.bedrooms || '?'} bed {prop.propertyType || 'property'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {prop.tenantId ? (
                                                                <Badge className="bg-green-100 text-green-700">Occupied</Badge>
                                                            ) : (
                                                                <Badge variant="outline">Vacant</Badge>
                                                            )}
                                                            <ExternalLink className="h-4 w-4 text-muted-foreground" />
                                                        </div>
                                                    </div>
                                                </Link>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Tenancies Tab */}
                                <TabsContent value="tenancies" className="p-6">
                                    <h4 className="font-medium mb-4">Tenancy History</h4>
                                    {tenancies.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                            <Key className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                            <p>No tenancy records found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {tenancies.map((t: any) => (
                                                <div
                                                    key={t.id}
                                                    className={`p-4 rounded-lg border ${t.status === 'active' ? 'bg-green-50 border-green-200' : 'bg-white'}`}
                                                >
                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            {/* Property address as main identifier */}
                                                            <h5 className="font-semibold text-[#791E75] mb-1">
                                                                {t.propertyAddress || 'Unknown Property'}
                                                                {t.postcode && <span className="text-gray-500 font-normal ml-2">{t.postcode}</span>}
                                                            </h5>
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                                                                    {t.status === 'active' ? 'Active Tenancy' : t.status}
                                                                </Badge>
                                                                {t.tenantName && (
                                                                    <span className="text-sm text-muted-foreground">• Tenant: {t.tenantName}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <Link href={`/crm/managed-property/${t.propertyId}`}>
                                                            <Button variant="ghost" size="sm">
                                                                <ExternalLink className="h-4 w-4 mr-1" />
                                                                View Property
                                                            </Button>
                                                        </Link>
                                                    </div>
                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                        <div>
                                                            <span className="text-muted-foreground block">Rent</span>
                                                            <span className="font-medium">£{t.rentAmount?.toLocaleString()}/{t.rentFrequency || 'month'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Deposit</span>
                                                            <span className="font-medium">£{t.depositAmount?.toLocaleString() || '0'}</span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">Start Date</span>
                                                            <span className="font-medium">
                                                                {t.startDate ? format(new Date(t.startDate), 'dd MMM yyyy') : 'Not set'}
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <span className="text-muted-foreground block">End Date</span>
                                                            <span className="font-medium">
                                                                {t.endDate ? format(new Date(t.endDate), 'dd MMM yyyy') : 'Periodic'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Beneficial Owners Tab - For ALL landlords */}
                                <TabsContent value="beneficial-owners" className="p-6">
                                    {/* For individual landlords, show the landlord as the beneficial owner */}
                                    {landlord?.landlordType !== 'corporate' && landlord?.landlordType !== 'company' ? (
                                        <>
                                            <div className="flex justify-between items-center mb-4">
                                                <div>
                                                    <h4 className="font-medium">Beneficial Owner</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        As an individual landlord, this person is the beneficial owner
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="border rounded-lg p-4">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                                                            <User className="h-6 w-6 text-purple-600" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium">{landlord.name || landlord.fullName}</div>
                                                            <div className="text-sm text-muted-foreground">
                                                                100% ownership • Individual Landlord
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <Badge className="bg-green-500">
                                                        <CheckCircle2 className="h-3 w-3 mr-1" />
                                                        Owner Verified
                                                    </Badge>
                                                </div>

                                                <Separator className="my-3" />

                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                    {landlord.email && (
                                                        <div>
                                                            <span className="text-muted-foreground block">Email</span>
                                                            <span>{landlord.email}</span>
                                                        </div>
                                                    )}
                                                    {(landlord.phone || landlord.mobile) && (
                                                        <div>
                                                            <span className="text-muted-foreground block">Phone</span>
                                                            <span>{landlord.phone || landlord.mobile}</span>
                                                        </div>
                                                    )}
                                                    {(landlord.addressLine1 || landlord.address) && (
                                                        <div className="col-span-2">
                                                            <span className="text-muted-foreground block">Address</span>
                                                            <span>
                                                                {landlord.addressLine1 || landlord.address}
                                                                {landlord.city && `, ${landlord.city}`}
                                                                {landlord.postcode && ` ${landlord.postcode}`}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            {/* For corporate/company landlords, show the UBO list */}
                                            <div className="flex justify-between items-center mb-4">
                                                <div>
                                                    <h4 className="font-medium">Beneficial Owners (UBOs)</h4>
                                                    <p className="text-sm text-muted-foreground">
                                                        Persons with 25% or more ownership or significant control
                                                    </p>
                                                </div>
                                                <Button size="sm" onClick={() => {
                                                    // TODO: Open add beneficial owner dialog
                                                    toast({ title: "Coming soon", description: "Add beneficial owner dialog will be implemented" });
                                                }}>
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Add UBO
                                                </Button>
                                            </div>

                                            {beneficialOwners.length === 0 ? (
                                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                                    <Users className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                                    <p>No beneficial owners added</p>
                                                    <p className="text-sm">Add beneficial owners for AML/KYC compliance</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-4">
                                                    {beneficialOwners.map((ubo: any) => (
                                                        <div key={ubo.id} className="border rounded-lg p-4">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="h-12 w-12 bg-purple-100 rounded-full flex items-center justify-center">
                                                                        <User className="h-6 w-6 text-purple-600" />
                                                                    </div>
                                                                    <div>
                                                                        <div className="font-medium">{ubo.fullName}</div>
                                                                        <div className="text-sm text-muted-foreground">
                                                                            {ubo.ownershipPercentage ? `${ubo.ownershipPercentage}% ownership` : 'Ownership % not specified'}
                                                                            {ubo.isTrustee && ' • Trustee'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    {ubo.kycVerified ? (
                                                                        <Badge className="bg-green-500">
                                                                            <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                            KYC Verified
                                                                        </Badge>
                                                                    ) : (
                                                                        <Badge variant="outline" className="text-amber-600 border-amber-600">
                                                                            <AlertCircle className="h-3 w-3 mr-1" />
                                                                            KYC Pending
                                                                        </Badge>
                                                                    )}
                                                                    <Button variant="ghost" size="icon">
                                                                        <Edit className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            </div>

                                                            <Separator className="my-3" />

                                                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                                {ubo.email && (
                                                                    <div>
                                                                        <span className="text-muted-foreground block">Email</span>
                                                                        <span>{ubo.email}</span>
                                                                    </div>
                                                                )}
                                                                {ubo.phone && (
                                                                    <div>
                                                                        <span className="text-muted-foreground block">Phone</span>
                                                                        <span>{ubo.phone}</span>
                                                                    </div>
                                                                )}
                                                                {ubo.nationality && (
                                                                    <div>
                                                                        <span className="text-muted-foreground block">Nationality</span>
                                                                        <span>{ubo.nationality}</span>
                                                                    </div>
                                                                )}
                                                                {ubo.dateOfBirth && (
                                                                    <div>
                                                                        <span className="text-muted-foreground block">Date of Birth</span>
                                                                        <span>{format(new Date(ubo.dateOfBirth), 'dd MMM yyyy')}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            {/* KYC Status Summary */}
                                                            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                                                                <h5 className="text-sm font-medium mb-2">KYC Status</h5>
                                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                                                    <div className="flex items-center gap-1">
                                                                        {ubo.idDocumentUrl ? (
                                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                        ) : (
                                                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                                                        )}
                                                                        <span>ID Document</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        {ubo.proofOfAddressUrl ? (
                                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                        ) : (
                                                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                                                        )}
                                                                        <span>Proof of Address</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        {ubo.pepCheckCompleted ? (
                                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                        ) : (
                                                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                                                        )}
                                                                        <span>PEP Check</span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        {ubo.sanctionsCheckCompleted ? (
                                                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                                                        ) : (
                                                                            <AlertCircle className="h-4 w-4 text-amber-500" />
                                                                        )}
                                                                        <span>Sanctions Check</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Actions Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => landlord.email && window.open(`mailto:${landlord.email}`, '_blank')}>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                        </Button>
                        <Button variant="outline" onClick={() => (landlord.phone || landlord.mobile) && window.open(`tel:${landlord.phone || landlord.mobile}`, '_blank')}>
                            <Phone className="mr-2 h-4 w-4" />
                            Call Landlord
                        </Button>
                        <Button variant="outline">
                            <FileText className="mr-2 h-4 w-4" />
                            Generate Statement
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Edit Landlord Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Landlord</DialogTitle>
                        <DialogDescription>
                            Update the landlord's information below.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6 py-4">
                        {/* Basic Info */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground">Basic Information</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Full Name / Company Name</Label>
                                    <Input
                                        id="name"
                                        value={editForm.name || ''}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="landlordType">Landlord Type</Label>
                                    <Select
                                        value={editForm.landlordType || 'individual'}
                                        onValueChange={(value) => setEditForm({ ...editForm, landlordType: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="individual">Individual</SelectItem>
                                            <SelectItem value="corporate">Corporate</SelectItem>
                                            <SelectItem value="company">Company</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        {/* Contact Info */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground">Contact Information</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email</Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={editForm.email || ''}
                                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input
                                        id="phone"
                                        value={editForm.phone || ''}
                                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="mobile">Mobile</Label>
                                    <Input
                                        id="mobile"
                                        value={editForm.mobile || ''}
                                        onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Address */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground">Address</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2 col-span-2">
                                    <Label htmlFor="addressLine1">Address Line 1</Label>
                                    <Input
                                        id="addressLine1"
                                        value={editForm.addressLine1 || ''}
                                        onChange={(e) => setEditForm({ ...editForm, addressLine1: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2 col-span-2">
                                    <Label htmlFor="addressLine2">Address Line 2</Label>
                                    <Input
                                        id="addressLine2"
                                        value={editForm.addressLine2 || ''}
                                        onChange={(e) => setEditForm({ ...editForm, addressLine2: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="city">City</Label>
                                    <Input
                                        id="city"
                                        value={editForm.city || ''}
                                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="postcode">Postcode</Label>
                                    <Input
                                        id="postcode"
                                        value={editForm.postcode || ''}
                                        onChange={(e) => setEditForm({ ...editForm, postcode: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Company Details - Only show if corporate/company */}
                        {(editForm.landlordType === 'corporate' || editForm.landlordType === 'company') && (
                            <div className="space-y-4">
                                <h4 className="font-medium text-sm text-muted-foreground">Company Details</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="companyName">Company Name</Label>
                                        <Input
                                            id="companyName"
                                            value={editForm.companyName || ''}
                                            onChange={(e) => setEditForm({ ...editForm, companyName: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="companyRegistrationNo">Registration No.</Label>
                                        <Input
                                            id="companyRegistrationNo"
                                            value={editForm.companyRegistrationNo || ''}
                                            onChange={(e) => setEditForm({ ...editForm, companyRegistrationNo: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="companyVatNo">VAT Number</Label>
                                        <Input
                                            id="companyVatNo"
                                            value={editForm.companyVatNo || ''}
                                            onChange={(e) => setEditForm({ ...editForm, companyVatNo: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Bank Details */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground">Bank Details</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="bankName">Bank Name</Label>
                                    <Input
                                        id="bankName"
                                        value={editForm.bankName || ''}
                                        onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankAccountHolderName">Account Holder Name</Label>
                                    <Input
                                        id="bankAccountHolderName"
                                        value={editForm.bankAccountHolderName || ''}
                                        onChange={(e) => setEditForm({ ...editForm, bankAccountHolderName: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankAccountNumber">Account Number</Label>
                                    <Input
                                        id="bankAccountNumber"
                                        value={editForm.bankAccountNumber || ''}
                                        onChange={(e) => setEditForm({ ...editForm, bankAccountNumber: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="bankSortCode">Sort Code</Label>
                                    <Input
                                        id="bankSortCode"
                                        value={editForm.bankSortCode || ''}
                                        onChange={(e) => setEditForm({ ...editForm, bankSortCode: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="space-y-4">
                            <h4 className="font-medium text-sm text-muted-foreground">Status</h4>
                            <div className="space-y-2">
                                <Label htmlFor="status">Landlord Status</Label>
                                <Select
                                    value={editForm.status || 'active'}
                                    onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                                >
                                    <SelectTrigger className="w-48">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSaveLandlord}
                            disabled={updateLandlordMutation.isPending}
                            className="bg-[#791E75] hover:bg-[#5a1657]"
                        >
                            {updateLandlordMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
