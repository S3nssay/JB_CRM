import React, { useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowLeft, User, Phone, Mail, MessageSquare, Calendar, Building,
    FileText, ExternalLink, CheckCircle2, Clock, Home, Upload, Download,
    Briefcase, CreditCard, UserCheck, Shield, Key, AlertCircle, Loader2
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function TenantDetails() {
    const { id } = useParams();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const { data: tenant, isLoading } = useQuery({
        queryKey: ['tenant', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/tenants/${id}`);
            if (!res.ok) throw new Error("Failed to fetch tenant");
            return res.json();
        }
    });

    const { data: communications, isLoading: isLoadingComms } = useQuery({
        queryKey: ['communications', 'tenant', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/communications?tenantId=${id}`);
            if (!res.ok) throw new Error("Failed to fetch communications");
            return res.json();
        },
        initialData: []
    });

    // Fetch tenancies for this tenant
    const { data: tenancies = [] } = useQuery({
        queryKey: ['tenancies', 'tenant', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/pm/tenancies?tenantId=${id}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    // Get the active/most recent tenancy
    const activeTenancy = tenancies.find((t: any) => t.status === 'active') || tenancies[0];

    // Fetch checklist/documents for the active tenancy
    const { data: checklist = [], refetch: refetchChecklist } = useQuery({
        queryKey: ['checklist', 'tenancy', activeTenancy?.id],
        queryFn: async () => {
            if (!activeTenancy?.id) return [];
            const res = await fetch(`/api/crm/pm/tenancies/${activeTenancy.id}/checklist`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!activeTenancy?.id
    });

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

    // Group checklist items by category for display
    const documentItems = checklist.filter((item: any) =>
        ['previous_landlord_reference', 'work_reference', 'bank_reference', 'tenants_id',
            'tenancy_agreement', 'guarantors_agreement', 'standing_order', 'inventory'].includes(item.itemType)
    );

    // Only count as completed if document is uploaded
    const completedDocs = documentItems.filter((d: any) => d.documentUrl).length;
    const docProgress = documentItems.length > 0 ? Math.round((completedDocs / documentItems.length) * 100) : 0;

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading tenant details...</div>;
    }

    if (!tenant) {
        return <div className="p-8 text-center text-red-500">Tenant not found</div>;
    }

    // Helper function for document labels
    const getDocLabel = (itemType: string) => {
        const labels: Record<string, string> = {
            'previous_landlord_reference': 'Previous Landlord Reference',
            'work_reference': 'Work/Employment Reference',
            'bank_reference': 'Bank Reference',
            'tenants_id': 'Tenant ID Verification',
            'tenancy_agreement': 'Tenancy Agreement',
            'guarantors_agreement': 'Guarantor Agreement',
            'standing_order': 'Standing Order Setup',
            'inventory': 'Inventory',
            'deposit_protection_dps': 'Deposit Protection (DPS)',
            'deposit_protection_tds': 'Deposit Protection (TDS)'
        };
        return labels[itemType] || itemType.replace(/_/g, ' ');
    };

    // Helper function for document icons
    const getDocIcon = (itemType: string) => {
        const icons: Record<string, any> = {
            'previous_landlord_reference': Home,
            'work_reference': Briefcase,
            'bank_reference': CreditCard,
            'tenants_id': UserCheck,
            'tenancy_agreement': FileText,
            'guarantors_agreement': Shield,
            'standing_order': CreditCard,
            'inventory': FileText
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
                            // Reset the input so the same file can be selected again
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
                        {tenant.name || tenant.fullName}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>ID: {tenant.id}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                            {tenant.status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
                        {tenant.idVerified && (
                            <>
                                <Separator orientation="vertical" className="h-4" />
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                    <CheckCircle2 className="h-3 w-3 mr-1" />
                                    ID Verified
                                </Badge>
                            </>
                        )}
                    </div>
                </div>
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
                                        {tenant.email ? (
                                            <a href={`mailto:${tenant.email}`} className="hover:underline text-[#791E75]">
                                                {tenant.email}
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
                                        {tenant.mobile || tenant.phone ? (
                                            <a href={`tel:${tenant.mobile || tenant.phone}`} className="hover:underline text-[#791E75]">
                                                {tenant.mobile || tenant.phone}
                                            </a>
                                        ) : 'No phone provided'}
                                    </div>
                                </div>
                            </div>
                            {tenant.emergencyContactName && (
                                <div className="flex items-start gap-3 pt-2 border-t">
                                    <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <div className="font-medium">Emergency Contact</div>
                                        <div className="text-sm text-muted-foreground">
                                            {tenant.emergencyContactName}
                                            {tenant.emergencyContactRelationship && ` (${tenant.emergencyContactRelationship})`}
                                        </div>
                                        {tenant.emergencyContactPhone && (
                                            <a href={`tel:${tenant.emergencyContactPhone}`} className="text-sm hover:underline text-[#791E75]">
                                                {tenant.emergencyContactPhone}
                                            </a>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Briefcase className="h-5 w-5 text-[#791E75]" />
                                Employment & Address
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {tenant.employer ? (
                                <div className="flex items-start gap-3">
                                    <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <div className="font-medium">Employer</div>
                                        <div className="text-sm text-muted-foreground">{tenant.employer}</div>
                                        {tenant.jobTitle && (
                                            <div className="text-sm text-muted-foreground">{tenant.jobTitle}</div>
                                        )}
                                        {tenant.annualIncome && (
                                            <div className="text-sm font-medium text-green-600">
                                                £{Number(tenant.annualIncome).toLocaleString()} p.a.
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-sm text-muted-foreground">No employment details</div>
                            )}
                            {(tenant.address || tenant.addressLine1) && (
                                <div className="flex items-start gap-3 pt-2 border-t">
                                    <Home className="h-5 w-5 text-muted-foreground mt-0.5" />
                                    <div>
                                        <div className="font-medium">Current Address</div>
                                        <div className="text-sm text-muted-foreground">
                                            {tenant.addressLine1 || tenant.address}
                                            {tenant.addressLine2 && <br />}
                                            {tenant.addressLine2}
                                            {tenant.city && <br />}
                                            {tenant.city} {tenant.postcode}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Current Tenancy Summary */}
                    {activeTenancy && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Key className="h-5 w-5 text-[#791E75]" />
                                    Current Tenancy
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Property</span>
                                    <Link href={`/crm/managed-property/${activeTenancy.propertyId}`}>
                                        <span className="text-sm font-medium text-[#791E75] hover:underline">
                                            View Property
                                        </span>
                                    </Link>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Rent</span>
                                    <span className="text-sm font-medium">
                                        £{activeTenancy.rentAmount?.toLocaleString()}/{activeTenancy.rentFrequency || 'month'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Start Date</span>
                                    <span className="text-sm font-medium">
                                        {activeTenancy.startDate ? format(new Date(activeTenancy.startDate), 'dd MMM yyyy') : 'Not set'}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Status</span>
                                    <Badge variant={activeTenancy.status === 'active' ? 'default' : 'secondary'}>
                                        {activeTenancy.status}
                                    </Badge>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Right Column: Tabs for Documents, Communications, History */}
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
                                        Documents & References
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="communications"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent px-6"
                                    >
                                        <MessageSquare className="h-4 w-4 mr-2" />
                                        Communications
                                    </TabsTrigger>
                                    <TabsTrigger
                                        value="tenancies"
                                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#791E75] data-[state=active]:bg-transparent px-6"
                                    >
                                        <Calendar className="h-4 w-4 mr-2" />
                                        Tenancy History
                                    </TabsTrigger>
                                </TabsList>

                                {/* Documents Tab */}
                                <TabsContent value="documents" className="p-6 space-y-6">
                                    {/* Progress summary */}
                                    <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                        <div>
                                            <h4 className="font-medium">Documents Progress</h4>
                                            <p className="text-sm text-muted-foreground">
                                                {completedDocs} of {documentItems.length} documents uploaded
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
                                            <p>No active tenancy found</p>
                                            <p className="text-sm">Documents are linked to tenancies</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Reference Documents */}
                                            <div>
                                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                                    <UserCheck className="h-4 w-4" />
                                                    References & Verification
                                                </h4>
                                                <div className="space-y-2">
                                                    {['previous_landlord_reference', 'work_reference', 'bank_reference', 'tenants_id'].map(docType => {
                                                        const doc = checklist.find((c: any) => c.itemType === docType);
                                                        return renderDocumentRow(docType, doc);
                                                    })}
                                                </div>
                                            </div>

                                            {/* Legal Documents */}
                                            <div>
                                                <h4 className="font-medium mb-3 flex items-center gap-2">
                                                    <FileText className="h-4 w-4" />
                                                    Legal Documents
                                                </h4>
                                                <div className="space-y-2">
                                                    {['tenancy_agreement', 'guarantors_agreement', 'inventory'].map(docType => {
                                                        const doc = checklist.find((c: any) => c.itemType === docType);
                                                        return renderDocumentRow(docType, doc);
                                                    })}
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    {/* ID Document */}
                                    {tenant.idDocumentUrl && (
                                        <div>
                                            <h4 className="font-medium mb-3 flex items-center gap-2">
                                                <Shield className="h-4 w-4" />
                                                ID Document
                                            </h4>
                                            <div className="p-3 rounded-lg border bg-green-50 border-green-200">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                                                        <span className="font-medium text-green-700">ID Uploaded & Verified</span>
                                                    </div>
                                                    <a
                                                        href={tenant.idDocumentUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-sm text-[#791E75] hover:underline"
                                                    >
                                                        <Download className="h-4 w-4" />
                                                        Download
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Communications Tab */}
                                <TabsContent value="communications" className="p-6">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-medium">Communication History</h4>
                                        <Button size="sm">
                                            <MessageSquare className="mr-2 h-4 w-4" />
                                            Log Communication
                                        </Button>
                                    </div>
                                    {isLoadingComms ? (
                                        <div className="text-center py-4">Loading history...</div>
                                    ) : communications.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                            <p>No communication history found</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {communications.map((comm: any) => (
                                                <div key={comm.id} className="flex gap-4">
                                                    <div className={`mt-0.5 rounded-full p-2 h-fit ${comm.type === 'sms' ? 'bg-blue-100 text-blue-600' :
                                                        comm.type === 'email' ? 'bg-yellow-100 text-yellow-600' :
                                                            'bg-gray-100 text-gray-600'
                                                        }`}>
                                                        {comm.type === 'sms' ? <Phone className="h-4 w-4" /> :
                                                            comm.type === 'email' ? <Mail className="h-4 w-4" /> :
                                                                <MessageSquare className="h-4 w-4" />}
                                                    </div>
                                                    <div className="flex-1 space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <p className="text-sm font-medium">
                                                                {comm.direction === 'outbound' ? 'Sent' : 'Received'} {comm.type.toUpperCase()}
                                                            </p>
                                                            <span className="text-xs text-muted-foreground">
                                                                {format(new Date(comm.createdAt), 'PPP p')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-600 bg-gray-50/50 p-3 rounded-md">
                                                            {comm.content}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </TabsContent>

                                {/* Tenancy History Tab */}
                                <TabsContent value="tenancies" className="p-6">
                                    <h4 className="font-medium mb-4">Tenancy History</h4>
                                    {tenancies.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-20" />
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
                                                        <Badge variant={t.status === 'active' ? 'default' : 'secondary'}>
                                                            {t.status === 'active' ? 'Current Tenancy' : t.status}
                                                        </Badge>
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
                            </Tabs>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
