
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User, Phone, Mail, MessageSquare, Calendar, Building } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

export default function TenantDetails() {
    const { id } = useParams();

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

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading tenant details...</div>;
    }

    if (!tenant) {
        return <div className="p-8 text-center text-red-500">Tenant not found</div>;
    }

    return (
        <div className="space-y-6 p-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link href="/crm/properties">
                    <Button variant="outline" size="icon">
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">
                        {tenant.firstName} {tenant.lastName}
                    </h1>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span>ID: {tenant.id}</span>
                        <Separator orientation="vertical" className="h-4" />
                        <Badge variant={tenant.status === 'active' ? 'default' : 'secondary'}>
                            {tenant.status?.toUpperCase() || 'UNKNOWN'}
                        </Badge>
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
                                    <div className="text-sm text-muted-foreground break-all">{tenant.email || 'No email provided'}</div>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Phone</div>
                                    <div className="text-sm text-muted-foreground">{tenant.phone || 'No phone provided'}</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Tenancy Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-start gap-3">
                                <Building className="h-5 w-5 text-muted-foreground mt-0.5" />
                                <div>
                                    <div className="font-medium">Property ID</div>
                                    <Link href={`/crm/managed-property/${tenant.propertyId}`}>
                                        <div className="text-sm text-blue-600 hover:underline cursor-pointer">
                                            View Property (ID: {tenant.propertyId})
                                        </div>
                                    </Link>
                                </div>
                            </div>

                            {/* Add more tenancy details here if we fetch agreements */}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Communication History */}
                <div className="md:col-span-2">
                    <Card className="h-full flex flex-col">
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Communication History</CardTitle>
                                <CardDescription>Records of SMS, Emails, and Notes</CardDescription>
                            </div>
                            <Button size="sm">
                                <MessageSquare className="mr-2 h-4 w-4" />
                                Log Communication
                            </Button>
                        </CardHeader>
                        <CardContent className="flex-1">
                            {isLoadingComms ? (
                                <div className="text-center py-4">Loading history...</div>
                            ) : communications.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                                    <p>No communication history found</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
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
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
