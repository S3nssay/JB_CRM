import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    Users,
    Search,
    Filter,
    Plus,
    MoreHorizontal,
    Mail,
    Phone,
    Building2,
    ShieldCheck,
    AlertCircle,
    FileText,
    History,
    UserPlus,
    ArrowLeft,
    Wrench
} from "lucide-react";
import { useLocation } from "wouter";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function ContactManagement() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState("all");

    const { data: contacts = [], isLoading } = useQuery({
        queryKey: ["/api/crm/contacts", { type: typeFilter }],
        queryFn: async () => {
            const url = typeFilter === "all"
                ? "/api/crm/contacts"
                : `/api/crm/contacts?contactType=${typeFilter}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch contacts");
            return res.json();
        }
    });

    const filteredContacts = contacts.filter((c: any) => {
        const search = searchTerm.toLowerCase();
        return (
            (c.fullName?.toLowerCase().includes(search)) ||
            (c.name?.toLowerCase().includes(search)) ||
            (c.email?.toLowerCase().includes(search)) ||
            (c.phone?.toLowerCase().includes(search))
        );
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active': return <Badge className="bg-green-100 text-green-800">Active</Badge>;
            case 'onboarding': return <Badge className="bg-blue-100 text-blue-800">Onboarding</Badge>;
            case 'suspended': return <Badge className="bg-red-100 text-red-800">Suspended</Badge>;
            case 'archived': return <Badge className="bg-gray-100 text-gray-800">Archived</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const getKycStatusIcon = (status: string) => {
        switch (status) {
            case 'verified': return <ShieldCheck className="h-4 w-4 text-green-600" aria-label="KYC Verified" />;
            case 'pending': return <AlertCircle className="h-4 w-4 text-amber-500" aria-label="KYC Pending" />;
            case 'rejected': return <AlertCircle className="h-4 w-4 text-red-600" aria-label="KYC Rejected" />;
            default: return <AlertCircle className="h-4 w-4 text-gray-400" aria-label="KYC Not Started" />;
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8">
            <Button
                variant="ghost"
                onClick={() => setLocation("/")}
                className="mb-4"
            >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
            </Button>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Unified Contacts</h1>
                    <p className="text-muted-foreground">Manage all your applicants, landlords, tenants, and contractors in one place.</p>
                </div>
                <Button className="bg-[#791E75] hover:bg-[#60175d]">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add New Contact
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-blue-50/50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-lg">
                            <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-sm text-blue-600 font-medium">Total Contacts</p>
                            <p className="text-2xl font-bold">{contacts.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-purple-50/50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-lg">
                            <Building2 className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                            <p className="text-sm text-purple-600 font-medium">Landlords</p>
                            <p className="text-2xl font-bold">{contacts.filter((c: any) => c.contactType === 'landlord').length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-green-50/50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <Users className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                            <p className="text-sm text-green-600 font-medium">Active Tenants</p>
                            <p className="text-2xl font-bold">{contacts.filter((c: any) => c.contactType === 'tenant' && c.status === 'active').length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-amber-50/50">
                    <CardContent className="p-4 flex items-center gap-4">
                        <div className="p-3 bg-amber-100 rounded-lg">
                            <AlertCircle className="h-6 w-6 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-sm text-amber-600 font-medium">Pending KYC</p>
                            <p className="text-2xl font-bold">{contacts.filter((c: any) => c.kycStatus === 'pending').length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="pb-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search name, email, phone..."
                                className="pl-10"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Select value={typeFilter} onValueChange={setTypeFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <Filter className="mr-2 h-4 w-4" />
                                    <SelectValue placeholder="All Types" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Types</SelectItem>
                                    <SelectItem value="applicant">Applicants</SelectItem>
                                    <SelectItem value="landlord">Landlords</SelectItem>
                                    <SelectItem value="tenant">Tenants</SelectItem>
                                    <SelectItem value="contractor">Contractors</SelectItem>
                                    <SelectItem value="guarantor">Guarantors</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button variant="outline">
                                <FileText className="mr-2 h-4 w-4" />
                                Export
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Contact Name</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>KYC</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Communication</TableHead>
                                    <TableHead>Last Active</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">Loading contacts...</TableCell>
                                    </TableRow>
                                ) : filteredContacts.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">No contacts found.</TableCell>
                                    </TableRow>
                                ) : (
                                    filteredContacts.map((contact: any) => (
                                        <TableRow key={contact.id} className="hover:bg-muted/50 cursor-pointer">
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{contact.fullName}</span>
                                                    {contact.isCompany && (
                                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                                            <Building2 className="h-3 w-3" />
                                                            {contact.companyName}
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="capitalize">{contact.contactType}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    {getKycStatusIcon(contact.kycStatus)}
                                                    <span className="text-xs capitalize text-muted-foreground">{contact.kycStatus}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(contact.status)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Mail className="h-4 w-4 text-blue-500" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                                        <Phone className="h-4 w-4 text-green-500" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-sm">
                                                {contact.lastActive ? new Date(contact.lastActive).toLocaleDateString() : 'Never'}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" className="h-8 w-8 p-0">
                                                            <MoreHorizontal className="h-4 w-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                        <DropdownMenuItem onClick={() => window.location.href = `/crm/contacts/${contact.id}`}>
                                                            View Profile
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                                                        <DropdownMenuItem>KYC Verification</DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem>
                                                            <History className="mr-2 h-4 w-4" />
                                                            History
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem className="text-red-600">Archive</DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
