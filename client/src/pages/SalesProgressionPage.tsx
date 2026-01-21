import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
    ArrowLeft,
    BarChart3,
    Search,
    MapPin,
    User,
    Calendar,
    Clock,
    CheckCircle2,
    AlertCircle,
    Gavel,
    FileText,
    Briefcase,
    ChevronRight
} from "lucide-react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger
} from "@/components/ui/tabs";

const STAGES = [
    { id: 'offer_accepted', label: 'Offer Accepted', color: 'bg-blue-500' },
    { id: 'solicitors_instructed', label: 'Solicitors Instructed', color: 'bg-indigo-500' },
    { id: 'searches_requested', label: 'Searches requested', color: 'bg-purple-500' },
    { id: 'searches_received', label: 'Searches Received', color: 'bg-pink-500' },
    { id: 'survey_booked', label: 'Survey Booked', color: 'bg-orange-500' },
    { id: 'survey_completed', label: 'Survey Completed', color: 'bg-amber-500' },
    { id: 'mortgage_offer', label: 'Mortgage Offer', color: 'bg-lime-500' },
    { id: 'exchange_contracts', label: 'Exchange of Contracts', color: 'bg-emerald-500' },
    { id: 'completion', label: 'Completion', color: 'bg-green-600' }
];

export default function SalesProgressionPage() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");

    const { data: properties = [], isLoading } = useQuery({
        queryKey: ["/api/crm/properties"],
        queryFn: async () => {
            const res = await fetch("/api/crm/properties");
            if (!res.ok) throw new Error("Failed to fetch properties");
            return res.json();
        }
    });

    const { data: stats } = useQuery({
        queryKey: ["/api/crm/sales-progression-stats"],
        queryFn: async () => {
            const res = await fetch("/api/crm/sales-progression-stats");
            if (!res.ok) throw new Error("Failed to fetch stats");
            return res.json();
        }
    });

    const salesProperties = properties.filter((p: any) =>
        p.listingType === 'sale' && p.status === 'under_offer'
    );

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
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
                    <h1 className="text-3xl font-bold tracking-tight text-[#791E75]">Sales Progression</h1>
                    <p className="text-muted-foreground">Track property sales from offer acceptance to legal completion.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Analytics
                    </Button>
                    <Button className="bg-[#791E75] hover:bg-[#60175d]">
                        <Gavel className="mr-2 h-4 w-4" />
                        New Instruction
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="border-l-4 border-l-blue-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase">Under Offer</p>
                                <h3 className="text-2xl font-bold mt-1">{stats?.underOffer ?? 0}</h3>
                            </div>
                            <div className="p-2 bg-blue-100 rounded-full">
                                <Clock className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-emerald-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase">Exchanged</p>
                                <h3 className="text-2xl font-bold mt-1">{stats?.exchanged ?? 0}</h3>
                            </div>
                            <div className="p-2 bg-emerald-100 rounded-full">
                                <FileText className="h-6 w-6 text-emerald-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-l-amber-500">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-medium text-muted-foreground uppercase">Completions This Month</p>
                                <h3 className="text-2xl font-bold mt-1">{stats?.targetCompletionsThisMonth ?? 0}</h3>
                            </div>
                            <div className="p-2 bg-amber-100 rounded-full">
                                <Calendar className="h-6 w-6 text-amber-600" />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search property or client..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="space-y-4">
                {salesProperties.map((property: any) => (
                    <Card key={property.id} className="overflow-hidden hover:shadow-md transition-shadow">
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row justify-between gap-6">
                                <div className="flex gap-4">
                                    <div className="h-20 w-20 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
                                        {property.images?.[0] ? (
                                            <img src={property.images[0]} alt="" className="h-full w-full object-cover" />
                                        ) : (
                                            <MapPin className="h-8 w-8 text-muted-foreground" />
                                        )}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-[#791E75]">{property.addressLine1}</h3>
                                        <p className="text-sm text-muted-foreground">{property.postcode}</p>
                                        <div className="flex items-center gap-4 mt-2">
                                            <div className="flex items-center gap-1 text-xs">
                                                <User className="h-3 w-3" />
                                                <span>Buyer: John Doe</span>
                                            </div>
                                            <div className="flex items-center gap-1 text-xs">
                                                <Briefcase className="h-3 w-3" />
                                                <span>Solicitor: Smith & Co</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 max-w-md">
                                    <div className="flex justify-between text-sm font-medium mb-1">
                                        <span>Progress: 45%</span>
                                        <span>Stage: Searches Requested</span>
                                    </div>
                                    <Progress value={45} className="h-2" />
                                    <div className="flex justify-between mt-2">
                                        <span className="text-xs text-muted-foreground">Started: 12 Jan 2024</span>
                                        <span className="text-xs text-amber-600 font-medium">Est. Completion: 15 Mar 2024</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm">Update Status</Button>
                                    <Button variant="outline" size="sm">Documents</Button>
                                    <Button size="sm" className="bg-[#791E75] hover:bg-[#60175d]">View Details</Button>
                                </div>
                            </div>

                            <div className="mt-8 flex items-center justify-between relative">
                                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 -translate-y-1/2 -z-10" />
                                {STAGES.map((stage, idx) => {
                                    const isCurrent = idx === 2;
                                    const isPast = idx < 2;
                                    return (
                                        <div key={stage.id} className="flex flex-col items-center gap-2">
                                            <div className={`
                        h-6 w-6 rounded-full flex items-center justify-center text-[10px] text-white font-bold
                        ${isPast ? 'bg-green-500' : isCurrent ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'}
                      `}>
                                                {isPast ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                                            </div>
                                            <span className={`text-[10px] font-medium text-center hidden md:block max-w-[80px] ${isCurrent ? 'text-blue-600' : isPast ? 'text-green-600' : 'text-gray-400'}`}>
                                                {stage.label}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
