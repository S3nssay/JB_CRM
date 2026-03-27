import React, { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, User, Phone, Mail, Calendar, Building, FileText,
  ExternalLink, CheckCircle2, Clock, Home, Upload, Download,
  Key, Loader2, AlertTriangle, Trash2, Banknote, Shield, XCircle
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { ComplianceChecklist, ComplianceItem, isExpired } from "@/components/ComplianceChecklist";

export default function TenancyDetails() {
  const { id } = useParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadingItemId, setUploadingItemId] = useState<number | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const { data: tenancy, isLoading, refetch } = useQuery({
    queryKey: ['tenancy-details', id],
    queryFn: async () => {
      const res = await fetch(`/api/crm/pm/tenancies/${id}`, { credentials: 'include' });
      if (!res.ok) throw new Error("Failed to fetch tenancy");
      return res.json();
    },
    enabled: !!id
  });

  const toggleChecklistItem = async (itemId: number, isCompleted: boolean) => {
    try {
      const res = await fetch(`/api/crm/pm/checklist/${itemId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isCompleted: !isCompleted })
      });
      if (!res.ok) throw new Error('Failed to update');
      refetch();
      toast({
        title: isCompleted ? 'Item unchecked' : 'Item completed',
      });
    } catch {
      toast({ title: 'Error', description: 'Failed to update checklist', variant: 'destructive' });
    }
  };

  const handleChecklistUpload = async (itemId: number, file: File) => {
    setUploadingItemId(itemId);
    try {
      const formData = new FormData();
      formData.append('document', file);
      const uploadRes = await fetch('/api/crm/upload/document', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const { url } = await uploadRes.json();

      const updateRes = await fetch(`/api/crm/pm/checklist/${itemId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentUrl: url,
          documentName: file.name,
          isCompleted: true
        })
      });
      if (!updateRes.ok) throw new Error('Failed to update checklist');
      refetch();
      toast({ title: 'Document uploaded', description: file.name });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploadingItemId(null);
    }
  };

  const handleDocumentUpload = async (file: File, entityType: string, entityId: number, docType: string) => {
    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('document', file);
      const uploadRes = await fetch('/api/crm/upload/document', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadResult = await uploadRes.json();

      const body: any = {
        name: file.name,
        originalName: file.name,
        documentType: docType,
        storageUrl: uploadResult.url,
        mimeType: file.type,
        size: file.size,
        entityType,
        entityId,
      };
      // Set the direct FK based on entity type
      if (entityType === 'property') body.propertyId = entityId;
      if (entityType === 'tenant') body.tenantId = entityId;
      if (entityType === 'landlord') body.landlordId = entityId;
      if (entityType === 'tenancy') body.tenancyId = entityId;

      const docRes = await fetch('/api/crm/documents', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!docRes.ok) throw new Error('Failed to save document record');

      refetch();
      toast({ title: 'Document uploaded', description: file.name });
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const deleteDocument = async (docId: number) => {
    try {
      const res = await fetch(`/api/crm/documents/${docId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Delete failed');
      refetch();
      toast({ title: 'Document deleted' });
    } catch {
      toast({ title: 'Delete failed', variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  if (!tenancy) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Tenancy not found</p>
        <Link href="/crm/rental-agreements">
          <Button variant="outline" className="mt-4">Back to Rental Agreements</Button>
        </Link>
      </div>
    );
  }

  const property = tenancy.property;
  const landlord = tenancy.landlord;
  const tenantData = tenancy.tenant;
  const checklist = tenancy.checklist || [];
  const documents = tenancy.documents || [];

  // Group documents by entity type
  const tenancyDocs = documents.filter((d: any) => d.tenancyId === tenancy.id && !d.propertyId && !d.tenantId && !d.landlordId);
  const propertyDocs = documents.filter((d: any) => d.propertyId === tenancy.propertyId);
  const tenantDocs = documents.filter((d: any) => d.tenantId === tenancy.tenantId);
  const landlordDocs = documents.filter((d: any) => d.landlordId === tenancy.landlordId);

  const checklist_labels: Record<string, string> = {
    'authorization_to_landlord': 'Authorization to Landlord',
    'terms_and_conditions_to_landlord': 'Terms & Conditions to Landlord',
    'information_sheet_to_landlord': 'Information Sheet to Landlord',
    'previous_landlord_reference': 'Previous Landlord Reference',
    'work_reference': 'Work Reference',
    'bank_reference': 'Bank Reference',
    'tenants_id': "Tenant's ID",
    'tenancy_agreement': 'Tenancy Agreement',
    'guarantors_agreement': "Guarantor's Agreement",
    'standing_order': 'Standing Order',
    'inventory': 'Inventory',
    'deposit_protection_dps': 'Deposit Protection (DPS)',
    'deposit_protection_tds': 'Deposit Protection (TDS)',
    'gas_safety_certificate': 'Gas Safety Certificate',
    'electrical_certificate': 'Electrical Certificate (EICR)',
    'epc': 'Energy Performance Certificate',
    'how_to_rent_guide': 'How to Rent Guide',
  };

  const UploadButton = ({ onUpload, label }: { onUpload: (file: File) => void; label?: string }) => (
    <label className="cursor-pointer">
      <input
        type="file"
        className="hidden"
        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
        }}
      />
      <Button variant="outline" size="sm" asChild>
        <span>
          {isUploadingDoc ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          {label || 'Upload'}
        </span>
      </Button>
    </label>
  );

  const DocumentList = ({ docs, emptyText }: { docs: any[]; emptyText: string }) => (
    docs.length === 0 ? (
      <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
        <p>{emptyText}</p>
      </div>
    ) : (
      <div className="space-y-2">
        {docs.map((doc: any) => (
          <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border bg-white">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-[#791E75]" />
              <div>
                <p className="font-medium text-sm">{doc.name || doc.originalName}</p>
                <p className="text-xs text-muted-foreground">
                  {doc.documentType}{doc.createdAt && ` • ${format(new Date(doc.createdAt), 'dd MMM yyyy')}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href={doc.storageUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
              </a>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-500 hover:text-red-700"
                onClick={() => deleteDocument(doc.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    )
  );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            {property?.address || property?.addressLine1 || 'Tenancy Details'}
          </h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={tenancy.status === 'active' ? 'default' : 'secondary'}>
              {tenancy.status === 'active' ? 'Active Tenancy' : tenancy.status}
            </Badge>
            {tenancy.startDate && (
              <span className="text-sm text-muted-foreground">
                {format(new Date(tenancy.startDate), 'dd MMM yyyy')}
                {' - '}
                {tenancy.endDate ? format(new Date(tenancy.endDate), 'dd MMM yyyy') : 'Periodic'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Key Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Banknote className="h-4 w-4" />
              Rent
            </div>
            <p className="text-lg font-bold">
              {tenancy.rentAmount ? `£${Number(tenancy.rentAmount).toLocaleString()}` : 'N/A'}
              <span className="text-sm font-normal text-muted-foreground">/{tenancy.rentFrequency || 'month'}</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Shield className="h-4 w-4" />
              Deposit
            </div>
            <p className="text-lg font-bold">
              {tenancy.depositAmount ? `£${Number(tenancy.depositAmount).toLocaleString()}` : 'N/A'}
            </p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-[#791E75] transition-colors" onClick={() => landlord && (window.location.href = `/crm/landlords/${landlord.id}`)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Building className="h-4 w-4" />
              Landlord
            </div>
            <p className="text-sm font-bold text-[#791E75]">{landlord?.name || 'Unknown'}</p>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-[#791E75] transition-colors" onClick={() => tenantData && (window.location.href = `/crm/tenant/${tenantData.id}`)}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <User className="h-4 w-4" />
              Tenant
            </div>
            <p className="text-sm font-bold text-[#791E75]">{tenantData?.name || 'Unknown'}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card>
        <CardContent className="p-0">
          <Tabs defaultValue="overview">
            <TabsList className="w-full justify-start border-b rounded-none h-auto flex-wrap px-4 pt-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="checklist">Checklist ({checklist.filter((c: any) => c.isCompleted).length}/{checklist.length})</TabsTrigger>
              <TabsTrigger value="property-docs">Property Docs ({propertyDocs.length})</TabsTrigger>
              <TabsTrigger value="tenant-docs">Tenant Docs ({tenantDocs.length})</TabsTrigger>
              <TabsTrigger value="landlord-docs">Landlord Docs ({landlordDocs.length})</TabsTrigger>
              <TabsTrigger value="all-docs">All Documents ({documents.length})</TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="p-6">
              {/* Tenancy Compliance Status Panel */}
              <TenancyCompliancePanel tenancy={tenancy} property={property} tenantData={tenantData} landlord={landlord} checklist={checklist} />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-4">
                  <h4 className="font-semibold">Tenancy Details</h4>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Status</span>
                      <Badge variant={tenancy.status === 'active' ? 'default' : 'secondary'}>{tenancy.status}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Start Date</span>
                      <span>{tenancy.startDate ? format(new Date(tenancy.startDate), 'dd MMM yyyy') : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">End Date</span>
                      <span>{tenancy.endDate ? format(new Date(tenancy.endDate), 'dd MMM yyyy') : 'Periodic'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Period</span>
                      <span>{tenancy.periodMonths ? `${tenancy.periodMonths} months` : 'N/A'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rent</span>
                      <span className="font-medium">£{Number(tenancy.rentAmount || 0).toLocaleString()} / {tenancy.rentFrequency || 'month'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Deposit</span>
                      <span className="font-medium">£{Number(tenancy.depositAmount || 0).toLocaleString()}</span>
                    </div>
                    {tenancy.depositScheme && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Deposit Scheme</span>
                        <span>{tenancy.depositScheme}</span>
                      </div>
                    )}
                    {tenancy.depositCertificateNumber && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Certificate No.</span>
                        <span>{tenancy.depositCertificateNumber}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold">Property</h4>
                  {property && (
                    <div className="space-y-3">
                      <div className="text-sm">
                        <span className="text-muted-foreground block">Address</span>
                        <span>{property.address || `${property.addressLine1 || ''}, ${property.postcode || ''}`}</span>
                      </div>
                      {property.propertyType && (
                        <div className="text-sm">
                          <span className="text-muted-foreground block">Type</span>
                          <span>{property.propertyType}</span>
                        </div>
                      )}
                      {property.bedrooms && (
                        <div className="text-sm">
                          <span className="text-muted-foreground block">Bedrooms</span>
                          <span>{property.bedrooms}</span>
                        </div>
                      )}
                      <Link href={`/crm/managed-property/${property.id}`}>
                        <Button variant="outline" size="sm" className="mt-2">
                          <ExternalLink className="h-4 w-4 mr-1" />
                          View Property
                        </Button>
                      </Link>
                    </div>
                  )}

                  <Separator className="my-4" />

                  <h4 className="font-semibold">Contacts</h4>
                  <div className="space-y-3">
                    {landlord && (
                      <div className="text-sm">
                        <span className="text-muted-foreground block">Landlord</span>
                        <Link href={`/crm/landlords/${landlord.id}`}>
                          <span className="text-[#791E75] hover:underline cursor-pointer">{landlord.name}</span>
                        </Link>
                        {landlord.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{landlord.phone}</div>}
                        {landlord.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{landlord.email}</div>}
                      </div>
                    )}
                    {tenantData && (
                      <div className="text-sm">
                        <span className="text-muted-foreground block">Tenant</span>
                        <Link href={`/crm/tenant/${tenantData.id}`}>
                          <span className="text-[#791E75] hover:underline cursor-pointer">{tenantData.name}</span>
                        </Link>
                        {tenantData.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3 w-3" />{tenantData.phone}</div>}
                        {tenantData.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-3 w-3" />{tenantData.email}</div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* Checklist Tab */}
            <TabsContent value="checklist" className="p-6">
              <h4 className="font-medium mb-4">Tenancy Checklist</h4>
              {checklist.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>No checklist items</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {checklist.map((item: any) => (
                    <div
                      key={item.id}
                      className={`flex items-start gap-3 p-3 rounded-lg border ${
                        item.isCompleted ? 'bg-green-50 border-green-200' :
                        item.requiresDocument && !item.documentUrl ? 'bg-amber-50 border-amber-200' :
                        'bg-white'
                      }`}
                    >
                      <Checkbox
                        checked={item.isCompleted}
                        onCheckedChange={() => toggleChecklistItem(item.id, item.isCompleted)}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                          {checklist_labels[item.itemType] || item.itemType}
                        </p>
                        {item.documentUrl ? (
                          <a
                            href={item.documentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                          >
                            <FileText className="h-3 w-3" />
                            {item.documentName || 'View document'}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                            <AlertTriangle className="h-3 w-3" />
                            Document required
                          </p>
                        )}
                      </div>
                      <label className="cursor-pointer shrink-0">
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleChecklistUpload(item.id, file);
                          }}
                        />
                        {uploadingItemId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#791E75]" />
                        ) : (
                          <Button variant="ghost" size="sm" asChild>
                            <span><Upload className="h-4 w-4" /></span>
                          </Button>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Property Documents Tab */}
            <TabsContent value="property-docs" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Property Documents</h4>
                <UploadButton
                  label="Upload Property Doc"
                  onUpload={(file) => handleDocumentUpload(file, 'property', tenancy.propertyId, 'certificate')}
                />
              </div>
              <DocumentList docs={propertyDocs} emptyText="No property documents" />
            </TabsContent>

            {/* Tenant Documents Tab */}
            <TabsContent value="tenant-docs" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Tenant Documents</h4>
                {tenancy.tenantId && (
                  <UploadButton
                    label="Upload Tenant Doc"
                    onUpload={(file) => handleDocumentUpload(file, 'tenant', tenancy.tenantId, 'reference')}
                  />
                )}
              </div>
              <DocumentList docs={tenantDocs} emptyText="No tenant documents" />
            </TabsContent>

            {/* Landlord Documents Tab */}
            <TabsContent value="landlord-docs" className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium">Landlord Documents</h4>
                {tenancy.landlordId && (
                  <UploadButton
                    label="Upload Landlord Doc"
                    onUpload={(file) => handleDocumentUpload(file, 'landlord', tenancy.landlordId, 'other')}
                  />
                )}
              </div>
              <DocumentList docs={landlordDocs} emptyText="No landlord documents" />
            </TabsContent>

            {/* All Documents Tab */}
            <TabsContent value="all-docs" className="p-6">
              <h4 className="font-medium mb-4">All Related Documents</h4>
              {documents.length === 0 && checklist.filter((c: any) => c.documentUrl).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p>No documents found</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Checklist documents */}
                  {checklist.filter((c: any) => c.documentUrl).length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Checklist Documents
                      </h5>
                      <div className="space-y-2">
                        {checklist.filter((c: any) => c.documentUrl).map((item: any) => (
                          <div key={`cl-${item.id}`} className="flex items-center justify-between p-3 rounded-lg border bg-white">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-green-600" />
                              <div>
                                <p className="font-medium text-sm">{checklist_labels[item.itemType] || item.itemType}</p>
                                <p className="text-xs text-muted-foreground">{item.documentName || 'Document'}</p>
                              </div>
                            </div>
                            <a href={item.documentUrl} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="sm"><Download className="h-4 w-4" /></Button>
                            </a>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Property documents */}
                  {propertyDocs.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        Property Documents
                      </h5>
                      <DocumentList docs={propertyDocs} emptyText="" />
                    </div>
                  )}

                  {/* Tenant documents */}
                  {tenantDocs.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Tenant Documents
                      </h5>
                      <DocumentList docs={tenantDocs} emptyText="" />
                    </div>
                  )}

                  {/* Landlord documents */}
                  {landlordDocs.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <Building className="h-4 w-4" />
                        Landlord Documents
                      </h5>
                      <DocumentList docs={landlordDocs} emptyText="" />
                    </div>
                  )}

                  {/* Tenancy-specific documents */}
                  {tenancyDocs.length > 0 && (
                    <div>
                      <h5 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                        <Key className="h-4 w-4" />
                        Tenancy Documents
                      </h5>
                      <DocumentList docs={tenancyDocs} emptyText="" />
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function TenancyCompliancePanel({ tenancy, property, tenantData, landlord, checklist }: {
  tenancy: any;
  property: any;
  tenantData: any;
  landlord: any;
  checklist: any[];
}) {
  const items: ComplianceItem[] = [];

  // Deposit Protection - CRITICAL
  const depositProtected = !!(tenancy.depositScheme && tenancy.depositCertificateNumber);
  const hasDeposit = tenancy.depositAmount && Number(tenancy.depositAmount) > 0;
  if (hasDeposit) {
    items.push({
      id: 'deposit_protection',
      label: 'Deposit Protection',
      description: depositProtected
        ? `Protected with ${tenancy.depositScheme} - Certificate: ${tenancy.depositCertificateNumber}`
        : tenancy.depositScheme
          ? 'Deposit scheme selected but no certificate number recorded'
          : 'Deposit not protected - must be protected within 30 days of receipt',
      passed: depositProtected,
      severity: 'critical',
      penalty: 'Tenant can claim 1-3x deposit. Cannot serve Section 21 notice.',
      legalReference: 'Housing Act 2004',
    });
  }

  // Tenancy Agreement - CRITICAL
  const hasTenancyAgreement = checklist.some((c: any) => c.itemType === 'tenancy_agreement' && c.isCompleted);
  items.push({
    id: 'tenancy_agreement',
    label: 'Tenancy Agreement Signed',
    description: hasTenancyAgreement
      ? 'Tenancy agreement completed and signed'
      : 'Tenancy agreement not yet completed',
    passed: hasTenancyAgreement,
    severity: 'critical',
  });

  // Gas Safety Certificate - CRITICAL
  const hasGasSafety = checklist.some((c: any) => c.itemType === 'gas_safety_certificate' && c.isCompleted);
  items.push({
    id: 'gas_safety',
    label: 'Gas Safety Certificate Provided to Tenant',
    description: hasGasSafety
      ? 'Gas safety certificate provided to tenant'
      : 'Gas safety certificate must be provided to tenant before move-in',
    passed: hasGasSafety,
    severity: 'critical',
    penalty: 'Fine up to £6,000',
    legalReference: 'Gas Safety (Installation and Use) Regulations 1998',
  });

  // EICR - CRITICAL
  const hasEicr = checklist.some((c: any) => c.itemType === 'electrical_certificate' && c.isCompleted);
  items.push({
    id: 'eicr',
    label: 'EICR Provided to Tenant',
    description: hasEicr
      ? 'Electrical safety report provided to tenant'
      : 'EICR must be provided to tenant within 28 days of tenancy start',
    passed: hasEicr,
    severity: 'critical',
    penalty: 'Fine up to £30,000',
    legalReference: 'Electrical Safety Standards Regulations 2020',
  });

  // EPC - CRITICAL
  const hasEpc = checklist.some((c: any) => c.itemType === 'epc' && c.isCompleted);
  items.push({
    id: 'epc',
    label: 'EPC Provided to Tenant',
    description: hasEpc
      ? 'Energy Performance Certificate provided to tenant'
      : 'EPC must be provided to tenant at or before tenancy start',
    passed: hasEpc,
    severity: 'critical',
    penalty: 'Fine up to £5,000',
    legalReference: 'Energy Efficiency Regulations 2015',
  });

  // How to Rent Guide - CRITICAL
  const hasHowToRent = checklist.some((c: any) => c.itemType === 'how_to_rent_guide' && c.isCompleted);
  items.push({
    id: 'how_to_rent',
    label: 'How to Rent Guide Provided',
    description: hasHowToRent
      ? 'How to Rent guide provided to tenant'
      : 'Must provide government How to Rent guide - required for valid Section 21 notice',
    passed: hasHowToRent,
    severity: 'critical',
    legalReference: 'Deregulation Act 2015',
  });

  // Tenant ID Verified - WARNING
  const hasTenantId = checklist.some((c: any) => c.itemType === 'tenants_id' && c.isCompleted);
  items.push({
    id: 'tenant_id',
    label: 'Tenant ID Verified',
    description: hasTenantId
      ? 'Tenant identity verified and documented'
      : 'Tenant ID not yet verified',
    passed: hasTenantId,
    severity: 'warning',
  });

  // Inventory - WARNING
  const hasInventory = checklist.some((c: any) => c.itemType === 'inventory' && c.isCompleted);
  items.push({
    id: 'inventory',
    label: 'Inventory Completed',
    description: hasInventory
      ? 'Check-in inventory completed and signed'
      : 'Inventory not completed - needed for deposit disputes',
    passed: hasInventory,
    severity: 'warning',
  });

  // Standing Order - INFO
  const hasStandingOrder = checklist.some((c: any) => c.itemType === 'standing_order' && c.isCompleted);
  items.push({
    id: 'standing_order',
    label: 'Rent Payment Setup',
    description: hasStandingOrder
      ? 'Standing order or direct debit confirmed'
      : 'Rent payment method not yet set up',
    passed: hasStandingOrder,
    severity: 'info',
  });

  return (
    <ComplianceChecklist
      title="Tenancy Compliance Status"
      subtitle="Regulatory requirements for this tenancy"
      items={items}
      showSummary={true}
      blockOnCritical={false}
    />
  );
}
