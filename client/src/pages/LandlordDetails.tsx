
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Phone, Mail, Building, FileText, CreditCard, Shield, Briefcase } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

export default function LandlordDetails() {
    const { id } = useParams();

    const { data: landlord, isLoading } = useQuery({
        queryKey: ['landlord', id],
        queryFn: async () => {
            const res = await fetch(`/api/crm/landlords/${id}`);
            if (!res.ok) throw new Error("Failed to fetch landlord");
            return res.json();
        }
    });

    // Fetch properties owned by this landlord (via rental agreements usually, or property relationship)
    // Assuming backend endpoint /api/crm/landlords/:id/properties exists or filtering properties
    const { data: properties, isLoading: isLoadingProperties } = useQuery({
        queryKey: ['landlord-properties', id],
        queryFn: async () => {
            // We can filter rental agreements to find properties
            const res = await fetch(`/api/crm/rental-agreements?landlordId=${id}`);
            if (!res.ok) return [];
            const agreements = await res.json();

            // For each agreement, fetch property details
            const propertyPromises = agreements.map(async (agreement: any) => {
                const propRes = await fetch(`/api/crm/properties/${agreement.propertyId}`);
                if (propRes.ok) return propRes.json();
                return null;
            });

            const props = await Promise.all(propertyPromises);
            return props.filter(Boolean);
        }
    });

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading landlord details...</div>;
    }

    if (!landlord) {
        return <div className="p-8 text-center text-red-500">Landlord not found</div>;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/crm/dashboard">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {landlord.fullName}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        {landlord.landlordType === 'company' ? <Briefcase className="h-4 w-4" /> : <User className="h-4 w-4" />}
                        <span>ID: {landlord.id}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <Badge variant={landlord.status === 'active' ? 'default' : 'secondary'}>
                            {landlord.status === 'active' ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                        <Badge variant="outline">{landlord.landlordType?.toUpperCase()}</Badge>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column: Details */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Email</div>
                                    <div className="text-sm text-muted-foreground break-all">{landlord.email || 'No email provided'}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Phone</div>
                                    <div className="text-sm text-muted-foreground">{landlord.phone || landlord.mobile || 'No phone provided'}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Address</div>
                                    <div className="text-sm text-muted-foreground">
                                        {landlord.address || 'No address provided'}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {landlord.landlordType === 'company' && (
                        <Card>
                            <CardHeader>
                                <CardTitle>Company Details</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <div className="font-medium">Company Name</div>
                                    <div className="text-sm text-muted-foreground">{landlord.companyName}</div>
                                </div>
                                <div>
                                    <div className="font-medium">Registration No</div>
                                    <div className="text-sm text-muted-foreground">{landlord.companyRegNo || 'N/A'}</div>
                                </div>
                                <Separator />
                                <div>
                                    <div className="font-medium">Director</div>
                                    <div className="text-sm text-muted-foreground">{landlord.directorName}</div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader>
                            <CardTitle>Financials</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Bank Details</div>
                                    <div className="text-sm text-muted-foreground">
                                        {landlord.bankName}<br />
                                        Acc: ****{landlord.bankAccountNo ? landlord.bankAccountNo.slice(-4) : '****'}<br />
                                        Sort: {landlord.bankSortCode}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Middle/Right: Properties & Documents */}
                <div className="md:col-span-2 space-y-6">
                    {/* Properties List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Owned Properties</CardTitle>
                            <CardDescription>Properties owned or managed by this landlord</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingProperties ? (
                                <div className="text-center py-4">Loading properties...</div>
                            ) : !properties || properties.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">No linked properties found</div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {properties.map((prop: any) => (
                                        <Link key={prop.id} href={`/crm/managed-property/${prop.id}`}>
                                            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                                        <Building className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium">{prop.title}</div>
                                                        <div className="text-sm text-muted-foreground">{prop.addressLine1}, {prop.postcode}</div>
                                                    </div>
                                                </div>
                                                <Badge>{prop.propertyCategory === 'commercial' ? 'Commercial' : 'Residential'}</Badge>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Documents & KYC */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Compliance & KYC</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-center justify-between p-3 border rounded">
                                    <div className="flex items-center gap-2">
                                        <Shield className="h-4 w-4 text-green-600" />
                                        <span className="text-sm">Identity Verification</span>
                                    </div>
                                    <Badge variant="outline">Verified</Badge>
                                </div>
                                <div className="flex items-center justify-between p-3 border rounded">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-blue-600" />
                                        <span className="text-sm">Landlord Agreement</span>
                                    </div>
                                    <Button size="sm" variant="ghost">View</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Actions</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <Button className="w-full" variant="outline">
                                    <Mail className="mr-2 h-4 w-4" /> Send Email
                                </Button>
                                <Button className="w-full" variant="outline">
                                    <FileText className="mr-2 h-4 w-4" /> Generate Statement
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

