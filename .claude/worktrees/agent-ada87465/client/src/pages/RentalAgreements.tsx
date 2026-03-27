import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Building2, Users, Home, Plus, Eye, Edit, Bell,
  Search, LogOut, ArrowLeft, Loader2, Calendar,
  FileText, PoundSterling, Building, Clock, AlertTriangle,
  ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RentalAgreement {
  id: number;
  propertyId: number;
  landlordId: number;
  rentAmount: number;
  rentFrequency: string;
  managementFeeType?: string | null;
  managementFeeValue?: number | null;
  startDate: string | null;
  endDate: string | null;
  depositAmount?: number | null;
  depositScheme?: string | null;
  depositHolderType?: string | null;
  depositReference?: string | null;
  status: string;
  createdAt: string;
  // Joined data
  propertyTitle?: string;
  propertyAddress?: string;
  postcode?: string;
  landlordName?: string;
}

export default function RentalAgreements() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'ending_soon'>('all');
  const [sortColumn, setSortColumn] = useState<string>('property');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const toggleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Fetch rental agreements
  const { data: agreements = [], isLoading } = useQuery({
    queryKey: ['/api/crm/rental-agreements'],
    queryFn: async () => {
      const response = await fetch('/api/crm/rental-agreements');
      if (!response.ok) throw new Error('Failed to fetch rental agreements');
      return response.json();
    }
  });

  // Calculate stats
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const activeAgreements = agreements.filter((a: RentalAgreement) => {
    if (a.status !== 'active') return false;
    if (!a.endDate) return true;
    return new Date(a.endDate) > now;
  });

  const expiredAgreements = agreements.filter((a: RentalAgreement) => {
    if (a.status === 'expired') return true;
    if (!a.endDate) return false;
    return new Date(a.endDate) <= now;
  });

  const endingSoonAgreements = activeAgreements.filter((a: RentalAgreement) => {
    if (!a.endDate) return false;
    const endDate = new Date(a.endDate);
    return endDate > now && endDate <= thirtyDaysFromNow;
  });

  const totalMonthlyRent = activeAgreements.reduce((sum: number, a: RentalAgreement) => {
    const rent = parseFloat(String(a.rentAmount)) || 0;
    const freq = a.rentFrequency?.toLowerCase() || 'monthly';
    if (freq === 'monthly') return sum + rent;
    if (freq === 'weekly') return sum + (rent * 4.33);
    if (freq === 'quarterly') return sum + (rent / 3);
    if (freq === 'annually' || freq === 'annual') return sum + (rent / 12);
    return sum + rent; // Default to monthly
  }, 0);

  // Calculate total monthly management fees
  const totalMonthlyManagementFee = activeAgreements.reduce((sum: number, a: RentalAgreement) => {
    const rent = parseFloat(String(a.rentAmount)) || 0;
    const feeValue = parseFloat(String(a.managementFeeValue)) || 0;
    const freq = a.rentFrequency?.toLowerCase() || 'monthly';

    // Get monthly rent first
    let monthlyRent = rent;
    if (freq === 'weekly') monthlyRent = rent * 4.33;
    else if (freq === 'quarterly') monthlyRent = rent / 3;
    else if (freq === 'annually' || freq === 'annual') monthlyRent = rent / 12;

    // Calculate fee based on type
    if (a.managementFeeType === 'percentage') {
      return sum + (monthlyRent * feeValue / 100);
    } else if (feeValue > 0) {
      // Fixed fee - assume it's monthly
      return sum + feeValue;
    }
    return sum;
  }, 0);

  // Filter agreements
  const filteredAgreements = agreements.filter((a: RentalAgreement) => {
    const matchesSearch = !searchTerm ||
      a.propertyTitle?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.propertyAddress?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.postcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.landlordName?.toLowerCase().includes(searchTerm.toLowerCase());

    if (statusFilter === 'all') return matchesSearch;
    if (statusFilter === 'active') return matchesSearch && activeAgreements.includes(a);
    if (statusFilter === 'expired') return matchesSearch && expiredAgreements.includes(a);
    if (statusFilter === 'ending_soon') return matchesSearch && endingSoonAgreements.includes(a);
    return matchesSearch;
  }).sort((a: RentalAgreement, b: RentalAgreement) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortColumn) {
      case 'property': {
        const aVal = (a.propertyTitle || a.propertyAddress || '').toLowerCase();
        const bVal = (b.propertyTitle || b.propertyAddress || '').toLowerCase();
        return aVal.localeCompare(bVal) * dir;
      }
      case 'landlord': {
        const aVal = (a.landlordName || '').toLowerCase();
        const bVal = (b.landlordName || '').toLowerCase();
        return aVal.localeCompare(bVal) * dir;
      }
      case 'rent': {
        const aVal = parseFloat(String(a.rentAmount)) || 0;
        const bVal = parseFloat(String(b.rentAmount)) || 0;
        return (aVal - bVal) * dir;
      }
      case 'managementFee': {
        const aVal = parseFloat(String(a.managementFeeValue)) || 0;
        const bVal = parseFloat(String(b.managementFeeValue)) || 0;
        return (aVal - bVal) * dir;
      }
      case 'tenancyPeriod': {
        const aVal = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bVal = b.startDate ? new Date(b.startDate).getTime() : 0;
        return (aVal - bVal) * dir;
      }
      case 'deposit': {
        const aVal = parseFloat(String(a.depositAmount)) || 0;
        const bVal = parseFloat(String(b.depositAmount)) || 0;
        return (aVal - bVal) * dir;
      }
      case 'status': {
        const getStatusOrder = (ag: RentalAgreement) => {
          if (!ag.endDate) return 1;
          const end = new Date(ag.endDate);
          if (end <= now) return 3;
          if (end <= thirtyDaysFromNow) return 2;
          return 1;
        };
        return (getStatusOrder(a) - getStatusOrder(b)) * dir;
      }
      default:
        return 0;
    }
  });

  const formatCurrency = (amount: number | string) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(numAmount || 0);
  };

  const getStatusBadge = (agreement: RentalAgreement) => {
    if (!agreement.endDate) return <Badge className="bg-green-500">Active</Badge>;

    const endDate = new Date(agreement.endDate);
    if (endDate <= now) return <Badge className="bg-red-500">Expired</Badge>;
    if (endDate <= thirtyDaysFromNow) return <Badge className="bg-orange-500">Ending Soon</Badge>;
    return <Badge className="bg-green-500">Active</Badge>;
  };

  const getDaysRemaining = (endDate: string | null) => {
    if (!endDate) return 'No end date';
    const end = new Date(endDate);
    const diffTime = end.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `Expired ${Math.abs(diffDays)} days ago`;
    if (diffDays === 0) return 'Ends today';
    return `${diffDays} days remaining`;
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      setLocation('/crm/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    setLocation('/crm/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <FileText className="h-8 w-8 text-[#791E75] ml-2 mr-3" />
              <h1 className="text-xl font-semibold">Rental Agreements</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">{user?.fullName}</span>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Total Agreements</p>
                    <p className="text-xl font-bold mt-1">{agreements.length}</p>
                  </div>
                  <div className="p-2 rounded-full bg-[#791E75]">
                    <FileText className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Active</p>
                    <p className="text-xl font-bold mt-1">{activeAgreements.length}</p>
                  </div>
                  <div className="p-2 rounded-full bg-green-500">
                    <Home className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Ending Soon</p>
                    <p className="text-xl font-bold mt-1 text-orange-600">{endingSoonAgreements.length}</p>
                  </div>
                  <div className="p-2 rounded-full bg-orange-500">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Expired</p>
                    <p className="text-xl font-bold mt-1 text-red-600">{expiredAgreements.length}</p>
                  </div>
                  <div className="p-2 rounded-full bg-red-500">
                    <Clock className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Monthly Rent</p>
                    <p className="text-xl font-bold mt-1 text-blue-600">
                      {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(totalMonthlyRent)}
                    </p>
                  </div>
                  <div className="p-2 rounded-full bg-blue-500">
                    <PoundSterling className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-600">Mgt Fee Income</p>
                    <p className="text-xl font-bold mt-1 text-green-600">
                      {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(totalMonthlyManagementFee)}
                    </p>
                  </div>
                  <div className="p-2 rounded-full bg-[#F8B324]">
                    <PoundSterling className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by property, postcode, or landlord..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-gray-300 bg-white text-gray-900 placeholder:text-gray-500"
              />
            </div>
            <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <TabsList>
                <TabsTrigger value="all">All ({agreements.length})</TabsTrigger>
                <TabsTrigger value="active">Active ({activeAgreements.length})</TabsTrigger>
                <TabsTrigger value="ending_soon">
                  Ending Soon ({endingSoonAgreements.length})
                </TabsTrigger>
                <TabsTrigger value="expired">Expired ({expiredAgreements.length})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Agreements Table */}
          <Card>
            <CardHeader>
              <CardTitle>Rental Agreements</CardTitle>
              <CardDescription>View and manage all rental agreements between properties and landlords</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                </div>
              ) : filteredAgreements.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No agreements found</h3>
                  <p className="text-gray-500 mb-4">
                    {agreements.length === 0 ? 'No rental agreements in the system' : 'Try adjusting your search or filter'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('property')}>
                        <div className="flex items-center">Property<SortIcon column="property" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('landlord')}>
                        <div className="flex items-center">Landlord<SortIcon column="landlord" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('rent')}>
                        <div className="flex items-center">Rent<SortIcon column="rent" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('managementFee')}>
                        <div className="flex items-center">Management Fee<SortIcon column="managementFee" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('tenancyPeriod')}>
                        <div className="flex items-center">Tenancy Period<SortIcon column="tenancyPeriod" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('deposit')}>
                        <div className="flex items-center">Deposit<SortIcon column="deposit" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer select-none hover:bg-muted/50" onClick={() => toggleSort('status')}>
                        <div className="flex items-center">Status<SortIcon column="status" /></div>
                      </TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAgreements.map((agreement: RentalAgreement) => (
                      <TableRow key={agreement.id}>
                        <TableCell>
                          <div
                            className="cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                            onClick={() => setLocation(`/crm/managed-property/${agreement.propertyId}`)}
                          >
                            <p className="font-medium text-[#791E75] hover:underline">
                              {agreement.propertyTitle || agreement.propertyAddress}
                            </p>
                            <p className="text-sm text-gray-500">{agreement.postcode}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div
                            className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded transition-colors"
                            onClick={() => setLocation(`/crm/landlords/${agreement.landlordId}/properties`)}
                          >
                            <Building className="h-4 w-4 text-gray-400" />
                            <span className="font-medium hover:underline">{agreement.landlordName || 'Unknown'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{formatCurrency(agreement.rentAmount)}</p>
                            <p className="text-sm text-gray-500">{agreement.rentFrequency}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {agreement.managementFeeValue ? (
                            <span>
                              {agreement.managementFeeType === 'percentage'
                                ? `${agreement.managementFeeValue}%`
                                : `£${agreement.managementFeeValue}`}
                            </span>
                          ) : (
                            <span className="text-gray-400">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {agreement.startDate && (
                              <p className="text-sm">
                                Start: {new Date(agreement.startDate).toLocaleDateString('en-GB')}
                              </p>
                            )}
                            {agreement.endDate && (
                              <p className="text-sm">
                                End: {new Date(agreement.endDate).toLocaleDateString('en-GB')}
                              </p>
                            )}
                            <p className="text-xs text-gray-500">
                              {getDaysRemaining(agreement.endDate)}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {agreement.depositAmount ? (
                            <div>
                              <p className="font-medium">{formatCurrency(agreement.depositAmount)}</p>
                              {agreement.depositHolderType && (
                                <p className="text-xs text-gray-500">
                                  Held by: {agreement.depositHolderType === 'agency_custodial' ? 'Agency (Custodial)'
                                    : agreement.depositHolderType === 'agency_insurance' ? 'Agency (Insurance)'
                                    : agreement.depositHolderType === 'landlord' ? 'Landlord'
                                    : agreement.depositHolderType}
                                </p>
                              )}
                              {agreement.depositScheme && (
                                <p className="text-xs text-gray-500">{agreement.depositScheme}</p>
                              )}
                              {agreement.depositReference && (
                                <p className="text-xs text-gray-500">Ref: {agreement.depositReference}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not specified</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(agreement)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLocation(`/crm/managed-property/${agreement.propertyId}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setLocation(`/crm/landlords/${agreement.landlordId}/properties`)}
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
