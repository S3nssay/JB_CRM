import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
    AlertTriangle, Shield, CheckCircle, Clock, ExternalLink,
    FileText, Home, Users, Building, RefreshCw, ArrowLeft,
    AlertCircle, Info
} from 'lucide-react';
import { useLocation } from 'wouter';

interface ComplianceRequirement {
    id: number;
    code: string;
    name: string;
    description: string;
    category: 'critical' | 'high' | 'recommended';
    appliesToProperty: boolean;
    appliesToLandlord: boolean;
    appliesToTenant: boolean;
    frequencyMonths: number | null;
    reminderDaysBefore: number;
    penaltyDescription: string;
    referenceUrl: string | null;
    sortOrder: number;
    isActive: boolean;
}

interface GroupedRequirements {
    critical: ComplianceRequirement[];
    high: ComplianceRequirement[];
    recommended: ComplianceRequirement[];
}

export default function ComplianceReference() {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState('all');

    const { data: groupedRequirements, isLoading } = useQuery<GroupedRequirements>({
        queryKey: ['/api/crm/compliance/requirements/grouped'],
        queryFn: async () => {
            const response = await fetch('/api/crm/compliance/requirements/grouped');
            if (!response.ok) throw new Error('Failed to fetch requirements');
            return response.json();
        }
    });

    const seedMutation = useMutation({
        mutationFn: async () => {
            const response = await fetch('/api/crm/compliance/requirements/seed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!response.ok) throw new Error('Failed to seed requirements');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/crm/compliance/requirements/grouped'] });
            toast({ title: 'Success', description: 'Compliance requirements have been loaded.' });
        },
        onError: () => {
            toast({ title: 'Error', description: 'Failed to seed requirements.', variant: 'destructive' });
        }
    });

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'critical': return <AlertTriangle className="h-5 w-5 text-red-500" />;
            case 'high': return <AlertCircle className="h-5 w-5 text-orange-500" />;
            case 'recommended': return <Info className="h-5 w-5 text-blue-500" />;
            default: return <Shield className="h-5 w-5" />;
        }
    };

    const getCategoryBadge = (category: string) => {
        switch (category) {
            case 'critical':
                return <Badge variant="destructive">🔴 Critical - Legal Requirement</Badge>;
            case 'high':
                return <Badge className="bg-orange-500">🟠 High Priority</Badge>;
            case 'recommended':
                return <Badge variant="secondary">🟡 Recommended</Badge>;
            default:
                return <Badge variant="outline">{category}</Badge>;
        }
    };

    const getAppliesToBadges = (req: ComplianceRequirement) => {
        const badges = [];
        if (req.appliesToProperty) badges.push(<Badge key="prop" variant="outline" className="text-xs"><Building className="h-3 w-3 mr-1" />Property</Badge>);
        if (req.appliesToLandlord) badges.push(<Badge key="land" variant="outline" className="text-xs"><Users className="h-3 w-3 mr-1" />Landlord</Badge>);
        if (req.appliesToTenant) badges.push(<Badge key="ten" variant="outline" className="text-xs"><Home className="h-3 w-3 mr-1" />Tenant</Badge>);
        return badges;
    };

    const RequirementCard = ({ req }: { req: ComplianceRequirement }) => (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        {getCategoryIcon(req.category)}
                        <div>
                            <CardTitle className="text-lg">{req.name}</CardTitle>
                            <div className="flex gap-2 mt-1 flex-wrap">
                                {getAppliesToBadges(req)}
                            </div>
                        </div>
                    </div>
                    {getCategoryBadge(req.category)}
                </div>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className="text-muted-foreground">{req.description}</p>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {req.frequencyMonths && (
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>Every {req.frequencyMonths} months</span>
                        </div>
                    )}
                    {!req.frequencyMonths && (
                        <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-muted-foreground" />
                            <span>One-time / As needed</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                        <span>Remind {req.reminderDaysBefore} days before</span>
                    </div>
                </div>

                {req.penaltyDescription && (
                    <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg p-3">
                        <p className="text-sm text-red-700 dark:text-red-400">
                            <strong>Penalty:</strong> {req.penaltyDescription}
                        </p>
                    </div>
                )}

                {req.referenceUrl && (
                    <a
                        href={req.referenceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                        <ExternalLink className="h-4 w-4" />
                        Official Gov.uk Reference
                    </a>
                )}
            </CardContent>
        </Card>
    );

    const allRequirements = groupedRequirements
        ? [...(groupedRequirements.critical || []), ...(groupedRequirements.high || []), ...(groupedRequirements.recommended || [])]
        : [];

    const isEmpty = allRequirements.length === 0;

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-background">
            {/* Header */}
            <div className="bg-white dark:bg-card border-b">
                <div className="px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/dashboard')}>
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-semibold flex items-center gap-2">
                                    <Shield className="h-6 w-6 text-primary" />
                                    UK Landlord Compliance Reference
                                </h1>
                                <p className="text-sm text-muted-foreground">
                                    All legal requirements for private landlords in England and Wales
                                </p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            onClick={() => seedMutation.mutate()}
                            disabled={seedMutation.isPending}
                        >
                            <RefreshCw className={`h-4 w-4 mr-2 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
                            Load Requirements
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto p-6">
                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5 text-red-500" />
                                Critical Requirements
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-red-600">{groupedRequirements?.critical?.length || 0}</p>
                            <p className="text-sm text-muted-foreground">Legal requirements with prosecution risk</p>
                        </CardContent>
                    </Card>

                    <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <AlertCircle className="h-5 w-5 text-orange-500" />
                                High Priority
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-orange-600">{groupedRequirements?.high?.length || 0}</p>
                            <p className="text-sm text-muted-foreground">Legal requirements with civil penalties</p>
                        </CardContent>
                    </Card>

                    <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Info className="h-5 w-5 text-blue-500" />
                                Recommended
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-3xl font-bold text-blue-600">{groupedRequirements?.recommended?.length || 0}</p>
                            <p className="text-sm text-muted-foreground">Best practice recommendations</p>
                        </CardContent>
                    </Card>
                </div>

                {isEmpty && !isLoading && (
                    <Card className="text-center py-12">
                        <CardContent>
                            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                            <h3 className="text-lg font-semibold mb-2">No compliance requirements loaded</h3>
                            <p className="text-muted-foreground mb-4">
                                Click "Load Requirements" to populate the UK landlord compliance checklist.
                            </p>
                            <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                                <RefreshCw className={`h-4 w-4 mr-2 ${seedMutation.isPending ? 'animate-spin' : ''}`} />
                                Load UK Compliance Requirements
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {!isEmpty && (
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="all">All ({allRequirements.length})</TabsTrigger>
                            <TabsTrigger value="critical" className="text-red-600">
                                🔴 Critical ({groupedRequirements?.critical?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="high" className="text-orange-600">
                                🟠 High ({groupedRequirements?.high?.length || 0})
                            </TabsTrigger>
                            <TabsTrigger value="recommended" className="text-blue-600">
                                🟡 Recommended ({groupedRequirements?.recommended?.length || 0})
                            </TabsTrigger>
                        </TabsList>

                        <ScrollArea className="h-[calc(100vh-400px)] mt-6">
                            <TabsContent value="all" className="mt-0">
                                {allRequirements.map(req => <RequirementCard key={req.id} req={req} />)}
                            </TabsContent>

                            <TabsContent value="critical" className="mt-0">
                                {groupedRequirements?.critical?.map(req => <RequirementCard key={req.id} req={req} />)}
                            </TabsContent>

                            <TabsContent value="high" className="mt-0">
                                {groupedRequirements?.high?.map(req => <RequirementCard key={req.id} req={req} />)}
                            </TabsContent>

                            <TabsContent value="recommended" className="mt-0">
                                {groupedRequirements?.recommended?.map(req => <RequirementCard key={req.id} req={req} />)}
                            </TabsContent>
                        </ScrollArea>
                    </Tabs>
                )}
            </div>
        </div>
    );
}
