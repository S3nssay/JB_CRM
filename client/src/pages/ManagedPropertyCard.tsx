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
    Phone, Mail, CreditCard, Home
} from 'lucide-react';

interface ChecklistItem {
    id: string;
    label: string;
    checked: boolean;
    category: 'financial' | 'legal' | 'tenant' | 'property' | 'deposit' | 'keys';
}

export default function ManagedPropertyCard() {
    const { id } = useParams<{ id: string }>();
    const [, setLocation] = useLocation();

    // Fetch property details
    const { data: property, isLoading: propertyLoading } = useQuery({
        queryKey: ['/api/crm/properties', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/properties/${id}`);
            if (!res.ok) throw new Error('Failed to fetch property');
            return res.json();
        }
    });

    // Fetch rental agreement for this property
    const { data: rentalAgreement } = useQuery({
        queryKey: ['/api/crm/rental-agreements', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/rental-agreements?propertyId=${id}`);
            if (!res.ok) return null;
            const data = await res.json();
            return data[0] || null;
        }
    });

    // Fetch landlord details
    const { data: landlord } = useQuery({
        queryKey: ['/api/crm/landlords', rentalAgreement?.landlordId],
        queryFn: async () => {
            if (!rentalAgreement?.landlordId) return null;
            const res = await fetch(`/api/crm/landlords/${rentalAgreement.landlordId}`);
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!rentalAgreement?.landlordId
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

    // Property checklist state (would normally come from DB)
    const [checklist, setChecklist] = useState<ChecklistItem[]>([
        // Financial
        { id: 'deposit_rent', label: 'Deposit & Rent Collected', checked: false, category: 'financial' },
        { id: 'standing_order', label: 'Standing Order Set Up', checked: false, category: 'financial' },

        // Legal Documents
        { id: 'tenancy_agreement', label: 'Tenancy Agreement Signed', checked: false, category: 'legal' },
        { id: 'guarantors_agreement', label: 'Guarantors Agreement', checked: false, category: 'legal' },
        { id: 'notices', label: 'Notices Served', checked: false, category: 'legal' },
        { id: 'auth_landlord', label: 'Authorization to L/L', checked: false, category: 'legal' },
        { id: 'terms_landlord', label: 'Terms & Conditions to L/L', checked: false, category: 'legal' },
        { id: 'info_sheet', label: 'Information Sheet to L/L', checked: false, category: 'legal' },

        // Tenant Verification
        { id: 'tenant_id', label: "Tenant's ID Verified", checked: false, category: 'tenant' },
        { id: 'prev_landlord_ref', label: 'Previous L/L Reference', checked: false, category: 'tenant' },
        { id: 'bank_ref', label: 'Bank Reference', checked: false, category: 'tenant' },
        { id: 'work_ref', label: 'Work Reference', checked: false, category: 'tenant' },

        // Property Items
        { id: 'inventory', label: 'Inventory Complete', checked: false, category: 'property' },
        { id: 'gas_safety', label: 'Gas Safety Certificate', checked: false, category: 'property' },

        // Deposit Protection
        { id: 'deposit_tds', label: 'Deposit Protection (TDS)', checked: false, category: 'deposit' },
        { id: 'deposit_dps', label: 'Deposit Protection (DPS)', checked: false, category: 'deposit' },
        { id: 'deposit_landlord', label: 'Deposit Held by Landlord', checked: false, category: 'deposit' },

        // Keys
        { id: 'keys_office', label: 'Spare Keys in Office', checked: false, category: 'keys' },
        { id: 'keys_tenant', label: 'Keys Given to Tenant', checked: false, category: 'keys' },
    ]);

    const toggleCheck = (itemId: string) => {
        setChecklist(prev => prev.map(item =>
            item.id === itemId ? { ...item, checked: !item.checked } : item
        ));
    };

    const getChecklistByCategory = (category: string) =>
        checklist.filter(item => item.category === category);

    const completedCount = checklist.filter(c => c.checked).length;
    const completionPercent = Math.round((completedCount / checklist.length) * 100);

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
            <div className="mb-8">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-primary" />
                    {property?.title || property?.addressLine1 || 'Property Details'}
                </h1>
                <p className="text-muted-foreground mt-1">
                    {property?.postcode} • {property?.city}
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column - Summary Cards */}
                <div className="space-y-6">
                    {/* Rent & Deposit Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <PoundSterling className="h-5 w-5 text-green-600" />
                                Financial Summary
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Monthly Rent</span>
                                <span className="text-2xl font-bold text-green-600">
                                    £{rentalAgreement?.rentAmount?.toLocaleString() || property?.price?.toLocaleString() || '0'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Deposit Held</span>
                                <span className="text-xl font-semibold">
                                    £{rentalAgreement?.depositAmount?.toLocaleString() || '0'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Deposit Held By</span>
                                <Badge variant="outline">
                                    {rentalAgreement?.depositHeldBy || 'Not specified'}
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Management Fee</span>
                                <Badge className="bg-blue-100 text-blue-800">
                                    {rentalAgreement?.managementFeePercent || '0'}%
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Tenancy Dates Card */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Calendar className="h-5 w-5 text-blue-600" />
                                Tenancy Period
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Start Date</span>
                                <span className="font-medium">
                                    {rentalAgreement?.tenancyStart
                                        ? new Date(rentalAgreement.tenancyStart).toLocaleDateString('en-GB')
                                        : 'Not set'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">End Date</span>
                                <span className="font-medium">
                                    {rentalAgreement?.tenancyEnd
                                        ? new Date(rentalAgreement.tenancyEnd).toLocaleDateString('en-GB')
                                        : 'Not set'}
                                </span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-muted-foreground">Status</span>
                                <Badge className={
                                    rentalAgreement?.status === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                }>
                                    {rentalAgreement?.status || 'Unknown'}
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
                                {landlord?.name || 'Not assigned'}
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
                            <Tabs defaultValue="financial" className="w-full">
                                <TabsList className="grid grid-cols-6 w-full mb-4">
                                    <TabsTrigger value="financial" className="text-xs">Financial</TabsTrigger>
                                    <TabsTrigger value="legal" className="text-xs">Legal</TabsTrigger>
                                    <TabsTrigger value="tenant" className="text-xs">Tenant</TabsTrigger>
                                    <TabsTrigger value="property" className="text-xs">Property</TabsTrigger>
                                    <TabsTrigger value="deposit" className="text-xs">Deposit</TabsTrigger>
                                    <TabsTrigger value="keys" className="text-xs">Keys</TabsTrigger>
                                    <TabsTrigger value="maintenance" className="text-xs">Maintenance</TabsTrigger>
                                    <TabsTrigger value="communication" className="text-xs">History</TabsTrigger>
                                </TabsList>

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

                                {['financial', 'legal', 'tenant', 'property', 'deposit', 'keys'].map(category => (
                                    <TabsContent key={category} value={category} className="space-y-3">
                                        {getChecklistByCategory(category).map(item => (
                                            <div
                                                key={item.id}
                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer
                          ${item.checked ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                                onClick={() => toggleCheck(item.id)}
                                            >
                                                <Checkbox
                                                    checked={item.checked}
                                                    onCheckedChange={() => toggleCheck(item.id)}
                                                />
                                                <span className={item.checked ? 'line-through text-muted-foreground' : ''}>
                                                    {item.label}
                                                </span>
                                                {item.checked && (
                                                    <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto" />
                                                )}
                                            </div>
                                        ))}
                                    </TabsContent>
                                ))}
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
