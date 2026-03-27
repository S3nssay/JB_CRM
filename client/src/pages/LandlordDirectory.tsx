import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search, ChevronRight, ChevronDown, User, Home, Users,
  Receipt, TicketCheck, Building, Phone, Mail, Loader2,
  FileText, MessageCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DirectoryTenant {
  id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status: string | null;
  propertyId: number | null;
  landlordId: number | null;
}

interface DirectoryProperty {
  id: number;
  title: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string | null;
  postcode: string;
  status: string;
  landlordId: number;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  rentPeriod: string | null;
  price: number | null;
  isManaged: boolean | null;
  managementStatus: string | null; // 'occupied', 'dormant', 'void'
  tenants: DirectoryTenant[];
}

interface DirectoryLandlord {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  status: string;
  landlordType: string | null;
  isCorporate: boolean | null;
  companyName: string | null;
  properties: DirectoryProperty[];
}

export default function LandlordDirectory() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'dormant' | 'occupied'>('all');
  const [expandedLandlords, setExpandedLandlords] = useState<Set<number>>(new Set());
  const [expandedProperties, setExpandedProperties] = useState<Set<number>>(new Set());

  const { data: directory = [], isLoading } = useQuery<DirectoryLandlord[]>({
    queryKey: ['/api/crm/landlords/directory'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlords/directory');
      if (!response.ok) throw new Error('Failed to fetch landlord directory');
      return response.json();
    }
  });

  const toggleLandlord = (id: number) => {
    setExpandedLandlords(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleProperty = (id: number) => {
    setExpandedProperties(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleRaiseInvoice = (e: React.MouseEvent, entityType: 'landlord' | 'tenant', entityId: number) => {
    e.stopPropagation();
    setLocation(`/crm/invoices?${entityType}Id=${entityId}&action=create`);
  };

  const handleRaiseTicket = (e: React.MouseEvent, entityType: 'landlord' | 'tenant' | 'property', entityId: number) => {
    e.stopPropagation();
    setLocation(`/crm/support-tickets?${entityType}Id=${entityId}&action=create`);
  };

  const handleGenerateStatement = (e: React.MouseEvent, landlordId: number) => {
    e.stopPropagation();
    setLocation(`/crm/landlords/${landlordId}?tab=statements&action=generate`);
  };

  const handleEmailLandlord = (e: React.MouseEvent, landlordId: number, email: string | null) => {
    e.stopPropagation();
    if (email) {
      setLocation(`/crm/landlords/${landlordId}?tab=communications&action=email`);
    } else {
      toast({ title: 'No email address', description: 'This landlord has no email address on file.', variant: 'destructive' });
    }
  };

  const handleCallLandlord = (e: React.MouseEvent, phone: string | null) => {
    e.stopPropagation();
    if (phone) {
      window.open(`tel:${phone}`, '_self');
    } else {
      toast({ title: 'No phone number', description: 'This landlord has no phone number on file.', variant: 'destructive' });
    }
  };

  const handleWhatsAppLandlord = (e: React.MouseEvent, phone: string | null) => {
    e.stopPropagation();
    if (phone) {
      const cleaned = phone.replace(/\s+/g, '').replace(/^0/, '44');
      window.open(`https://wa.me/${cleaned}`, '_blank');
    } else {
      toast({ title: 'No phone number', description: 'This landlord has no phone number on file.', variant: 'destructive' });
    }
  };

  // Filter directory based on search and status filter
  const filteredDirectory = directory
    .map((landlord) => {
      // If filtering by management status, filter properties within each landlord
      if (statusFilter !== 'all') {
        const filteredProps = landlord.properties.filter(p => p.managementStatus === statusFilter);
        if (filteredProps.length === 0) return null;
        return { ...landlord, properties: filteredProps };
      }
      return landlord;
    })
    .filter((landlord): landlord is DirectoryLandlord => {
      if (!landlord) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      // Search landlord name, email, company
      if (landlord.name?.toLowerCase().includes(term)) return true;
      if (landlord.email?.toLowerCase().includes(term)) return true;
      if (landlord.companyName?.toLowerCase().includes(term)) return true;
      // Search properties
      for (const prop of landlord.properties) {
        if (prop.addressLine1?.toLowerCase().includes(term)) return true;
        if (prop.postcode?.toLowerCase().includes(term)) return true;
        // Search tenants
        for (const tenant of prop.tenants) {
          if (tenant.name?.toLowerCase().includes(term)) return true;
          if (tenant.email?.toLowerCase().includes(term)) return true;
        }
      }
      return false;
    });

  // Stats
  const totalLandlords = directory.length;
  const totalProperties = directory.reduce((sum, l) => sum + l.properties.length, 0);
  const totalTenants = directory.reduce(
    (sum, l) => sum + l.properties.reduce((s, p) => s + p.tenants.length, 0), 0
  );
  const totalDormant = directory.reduce(
    (sum, l) => sum + l.properties.filter(p => p.managementStatus === 'dormant').length, 0
  );

  const expandAll = () => {
    setExpandedLandlords(new Set(filteredDirectory.map(l => l.id)));
    setExpandedProperties(new Set(
      filteredDirectory.flatMap(l => l.properties.map(p => p.id))
    ));
  };

  const collapseAll = () => {
    setExpandedLandlords(new Set());
    setExpandedProperties(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landlord Directory</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hierarchical view of landlords, their properties, and tenants
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <User className="h-4 w-4 text-purple-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalLandlords}</p>
                <p className="text-xs text-gray-500">Landlords</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                <Home className="h-4 w-4 text-blue-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalProperties}</p>
                <p className="text-xs text-gray-500">Properties</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-green-100 flex items-center justify-center">
                <Users className="h-4 w-4 text-green-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalTenants}</p>
                <p className="text-xs text-gray-500">Tenants</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${statusFilter === 'dormant' ? 'ring-2 ring-amber-400 bg-amber-50' : 'hover:bg-amber-50/50'}`}
          onClick={() => setStatusFilter(statusFilter === 'dormant' ? 'all' : 'dormant')}
        >
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                <Home className="h-4 w-4 text-amber-700" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-800">{totalDormant}</p>
                <p className="text-xs text-gray-500">Dormant</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Filter Indicator */}
      {statusFilter !== 'all' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-sm text-amber-800 font-medium">
            Showing {statusFilter === 'dormant' ? 'dormant (vacant)' : 'occupied'} properties only
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs text-amber-700 hover:text-amber-900"
            onClick={() => setStatusFilter('all')}
          >
            Clear filter
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search landlords, properties, or tenants..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tree View */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Directory</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredDirectory.length === 0 ? (
            <p className="text-sm text-gray-500 py-8 text-center">
              {searchTerm ? 'No results found' : 'No landlords found'}
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredDirectory.map((landlord) => (
                <div key={landlord.id} className="py-1">
                  {/* Landlord Row */}
                  <div
                    className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-gray-50 cursor-pointer group"
                    onClick={() => toggleLandlord(landlord.id)}
                  >
                    <button className="flex-shrink-0 p-0.5">
                      {expandedLandlords.has(landlord.id) ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                    <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0">
                      {landlord.isCorporate ? (
                        <Building className="h-3.5 w-3.5 text-purple-700" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-purple-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-sm font-medium text-gray-900 hover:text-[#791E75] hover:underline cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation(`/crm/landlords/${landlord.id}`);
                          }}
                        >
                          {landlord.name}
                        </span>
                        {landlord.isCorporate && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Corporate
                          </Badge>
                        )}
                        <Badge
                          variant={landlord.status === 'active' ? 'default' : 'secondary'}
                          className={`text-[10px] px-1.5 py-0 ${landlord.status === 'active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : ''}`}
                        >
                          {landlord.status}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {landlord.properties.length} {landlord.properties.length === 1 ? 'property' : 'properties'}
                        </span>
                      </div>
                      {(landlord.email || landlord.phone) && (
                        <div className="flex items-center gap-3 mt-0.5">
                          {landlord.email && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Mail className="h-3 w-3" />{landlord.email}
                            </span>
                          )}
                          {(landlord.phone || landlord.mobile) && (
                            <span className="text-xs text-gray-400 flex items-center gap-1">
                              <Phone className="h-3 w-3" />{landlord.mobile || landlord.phone}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs px-2"
                        onClick={(e) => handleGenerateStatement(e, landlord.id)}
                        title="Generate Statement"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Statement
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        onClick={(e) => handleEmailLandlord(e, landlord.id, landlord.email)}
                        title="Email"
                      >
                        <Mail className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        onClick={(e) => handleCallLandlord(e, landlord.mobile || landlord.phone)}
                        title="Call"
                      >
                        <Phone className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 w-7 px-0"
                        onClick={(e) => handleWhatsAppLandlord(e, landlord.mobile || landlord.phone)}
                        title="WhatsApp"
                      >
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Properties (nested under landlord) */}
                  {expandedLandlords.has(landlord.id) && (
                    <div className="ml-6 border-l-2 border-gray-100 pl-4">
                      {landlord.properties.length === 0 ? (
                        <p className="text-xs text-gray-400 py-2 pl-6">No properties</p>
                      ) : (
                        landlord.properties.map((property) => (
                          <div key={property.id} className="py-0.5">
                            {/* Property Row */}
                            <div
                              className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-blue-50/50 cursor-pointer group"
                              onClick={() => toggleProperty(property.id)}
                            >
                              <button className="flex-shrink-0 p-0.5">
                                {property.tenants.length > 0 ? (
                                  expandedProperties.has(property.id) ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                                  )
                                ) : (
                                  <span className="inline-block w-3.5" />
                                )}
                              </button>
                              <div className="h-6 w-6 rounded bg-blue-100 flex items-center justify-center flex-shrink-0">
                                <Home className="h-3 w-3 text-blue-700" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span
                                    className="text-sm text-gray-800 hover:text-[#791E75] hover:underline cursor-pointer truncate"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setLocation(`/crm/properties/${property.id}`);
                                    }}
                                  >
                                    {property.addressLine1}{property.postcode ? `, ${property.postcode}` : ''}
                                  </span>
                                  {property.isManaged && property.managementStatus === 'dormant' ? (
                                    <Badge
                                      variant="secondary"
                                      className="text-[10px] px-1.5 py-0 flex-shrink-0 bg-amber-100 text-amber-800 border border-amber-300"
                                    >
                                      Dormant
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="secondary"
                                      className={`text-[10px] px-1.5 py-0 flex-shrink-0 ${
                                        property.status === 'active' ? 'bg-green-100 text-green-800' :
                                        property.status === 'let' ? 'bg-blue-100 text-blue-800' : ''
                                      }`}
                                    >
                                      {property.managementStatus === 'occupied' ? 'Occupied' : property.status}
                                    </Badge>
                                  )}
                                  {property.propertyType && (
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                      {property.propertyType}
                                    </span>
                                  )}
                                  {property.bedrooms != null && (
                                    <span className="text-xs text-gray-400 flex-shrink-0">
                                      {property.bedrooms} bed
                                    </span>
                                  )}
                                  <span className="text-xs text-gray-400">
                                    {property.tenants.length} {property.tenants.length === 1 ? 'tenant' : 'tenants'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-[11px] px-2"
                                  onClick={(e) => handleRaiseTicket(e, 'property', property.id)}
                                  title="Raise Ticket"
                                >
                                  <TicketCheck className="h-2.5 w-2.5 mr-1" />
                                  Ticket
                                </Button>
                              </div>
                            </div>

                            {/* Tenants (nested under property) */}
                            {expandedProperties.has(property.id) && property.tenants.length > 0 && (
                              <div className="ml-6 border-l-2 border-gray-50 pl-4">
                                {property.tenants.map((tenant) => (
                                  <div
                                    key={tenant.id}
                                    className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-green-50/50 cursor-pointer group"
                                    onClick={() => setLocation(`/crm/tenant/${tenant.id}`)}
                                  >
                                    <span className="inline-block w-3.5 flex-shrink-0" />
                                    <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                                      <Users className="h-3 w-3 text-green-700" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm text-gray-700 hover:text-[#791E75] hover:underline">
                                          {tenant.name || 'Unnamed Tenant'}
                                        </span>
                                        {tenant.status && (
                                          <Badge
                                            variant="secondary"
                                            className={`text-[10px] px-1.5 py-0 ${
                                              tenant.status === 'active' ? 'bg-green-100 text-green-800' : ''
                                            }`}
                                          >
                                            {tenant.status}
                                          </Badge>
                                        )}
                                      </div>
                                      {(tenant.email || tenant.phone || tenant.mobile) && (
                                        <div className="flex items-center gap-3 mt-0.5">
                                          {tenant.email && (
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                              <Mail className="h-2.5 w-2.5" />{tenant.email}
                                            </span>
                                          )}
                                          {(tenant.phone || tenant.mobile) && (
                                            <span className="text-xs text-gray-400 flex items-center gap-1">
                                              <Phone className="h-2.5 w-2.5" />{tenant.mobile || tenant.phone}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[11px] px-2"
                                        onClick={(e) => handleRaiseInvoice(e, 'tenant', tenant.id)}
                                        title="Raise Invoice"
                                      >
                                        <Receipt className="h-2.5 w-2.5 mr-1" />
                                        Invoice
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-6 text-[11px] px-2"
                                        onClick={(e) => handleRaiseTicket(e, 'tenant', tenant.id)}
                                        title="Raise Ticket"
                                      >
                                        <TicketCheck className="h-2.5 w-2.5 mr-1" />
                                        Ticket
                                      </Button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
