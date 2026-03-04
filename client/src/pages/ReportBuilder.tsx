import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  FileText, Download, Building2, Users, Shield, Wrench,
  PoundSterling, ClipboardCheck, Key, TrendingUp, Home,
  Loader2, Table, ChevronRight, AlertTriangle,
  Calendar, UserCheck, FileSpreadsheet
} from 'lucide-react';

// ─── Report definitions ─────────────────────────────────────────────

interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  category: 'financial' | 'property' | 'compliance' | 'maintenance' | 'landlord' | 'tenant' | 'performance';
  icon: any;
  frequency: string;
  fetchData: () => Promise<any[]>;
  columns: { key: string; label: string }[];
  transform: (raw: any) => Record<string, any>;
}

const categoryLabels: Record<string, { label: string; color: string }> = {
  financial: { label: 'Financial', color: 'bg-green-100 text-green-800' },
  property: { label: 'Property', color: 'bg-blue-100 text-blue-800' },
  compliance: { label: 'Compliance', color: 'bg-red-100 text-red-800' },
  maintenance: { label: 'Maintenance', color: 'bg-orange-100 text-orange-800' },
  landlord: { label: 'Landlord', color: 'bg-purple-100 text-purple-800' },
  tenant: { label: 'Tenant', color: 'bg-indigo-100 text-indigo-800' },
  performance: { label: 'Performance', color: 'bg-yellow-100 text-yellow-800' },
};

function formatCurrency(val: any): string {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  return `£${num.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(val: any): string {
  if (!val) return '—';
  try {
    return new Date(val).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(val);
  }
}

const reports: ReportDefinition[] = [
  // ── PROPERTY REPORTS ──
  {
    id: 'property-portfolio',
    name: 'Property Portfolio Overview',
    description: 'Complete list of all managed and listed properties with status, type, and value',
    category: 'property',
    icon: Building2,
    frequency: 'Monthly',
    fetchData: () => apiRequest('/api/crm/properties'),
    columns: [
      { key: 'address', label: 'Address' },
      { key: 'postcode', label: 'Postcode' },
      { key: 'propertyType', label: 'Type' },
      { key: 'bedrooms', label: 'Beds' },
      { key: 'status', label: 'Status' },
      { key: 'isManaged', label: 'Managed' },
      { key: 'isListedRental', label: 'Listed Rental' },
      { key: 'isListedSale', label: 'Listed Sale' },
      { key: 'rentAmount', label: 'Rent (pcm)' },
      { key: 'price', label: 'Price' },
    ],
    transform: (p: any) => ({
      address: p.address || [p.address_line1, p.address_line2, p.city].filter(Boolean).join(', '),
      postcode: p.postcode || '—',
      propertyType: p.property_type || p.propertyType || '—',
      bedrooms: p.bedrooms ?? '—',
      status: p.status || '—',
      isManaged: p.is_managed || p.isManaged ? 'Yes' : 'No',
      isListedRental: p.is_listed_rental || p.isListedRental ? 'Yes' : 'No',
      isListedSale: p.is_listed_sale || p.isListedSale ? 'Yes' : 'No',
      rentAmount: formatCurrency(p.rent_amount || p.rentAmount),
      price: formatCurrency(p.price),
    }),
  },
  {
    id: 'vacancy-report',
    name: 'Vacancy & Void Report',
    description: 'Properties currently vacant or not tenanted, with void duration and marketing status',
    category: 'property',
    icon: Home,
    frequency: 'Weekly',
    fetchData: async () => {
      const all = await apiRequest<any[]>('/api/crm/properties');
      return all.filter((p: any) => {
        const managed = p.is_managed || p.isManaged;
        const status = (p.status || '').toLowerCase();
        return managed && (status === 'vacant' || status === 'available' || status === 'void');
      });
    },
    columns: [
      { key: 'address', label: 'Address' },
      { key: 'postcode', label: 'Postcode' },
      { key: 'propertyType', label: 'Type' },
      { key: 'bedrooms', label: 'Beds' },
      { key: 'rentAmount', label: 'Asking Rent' },
      { key: 'status', label: 'Status' },
      { key: 'publishedWebsite', label: 'Website' },
      { key: 'publishedRightmove', label: 'Rightmove' },
      { key: 'publishedZoopla', label: 'Zoopla' },
    ],
    transform: (p: any) => ({
      address: p.address || [p.address_line1, p.address_line2, p.city].filter(Boolean).join(', '),
      postcode: p.postcode || '—',
      propertyType: p.property_type || p.propertyType || '—',
      bedrooms: p.bedrooms ?? '—',
      rentAmount: formatCurrency(p.rent_amount || p.rentAmount),
      status: p.status || '—',
      publishedWebsite: p.is_published_website ? 'Yes' : 'No',
      publishedRightmove: p.is_published_rightmove ? 'Yes' : 'No',
      publishedZoopla: p.is_published_zoopla ? 'Yes' : 'No',
    }),
  },

  // ── FINANCIAL REPORTS ──
  {
    id: 'rent-roll',
    name: 'Rent Roll',
    description: 'All active tenancies with contracted rent, frequency, and management fee details',
    category: 'financial',
    icon: PoundSterling,
    frequency: 'Monthly',
    fetchData: () => apiRequest('/api/crm/pm/tenancies'),
    columns: [
      { key: 'property', label: 'Property' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'landlord', label: 'Landlord' },
      { key: 'startDate', label: 'Start Date' },
      { key: 'endDate', label: 'End Date' },
      { key: 'rentAmount', label: 'Rent Amount' },
      { key: 'rentFrequency', label: 'Frequency' },
      { key: 'status', label: 'Status' },
    ],
    transform: (t: any) => ({
      property: t.propertyAddress || t.property_address || t.property?.address || '—',
      tenant: t.tenantName || t.tenant_name || t.tenant?.name || '—',
      landlord: t.landlordName || t.landlord_name || t.landlord?.name || '—',
      startDate: formatDate(t.startDate || t.start_date),
      endDate: formatDate(t.endDate || t.end_date),
      rentAmount: formatCurrency(t.rentAmount || t.rent_amount),
      rentFrequency: t.rentFrequency || t.rent_frequency || '—',
      status: t.status || '—',
    }),
  },
  {
    id: 'management-fees',
    name: 'Management Fee Income',
    description: 'Revenue from management fees across all managed properties',
    category: 'financial',
    icon: PoundSterling,
    frequency: 'Monthly',
    fetchData: async () => {
      const properties = await apiRequest<any[]>('/api/crm/properties');
      return properties.filter((p: any) => p.is_managed || p.isManaged);
    },
    columns: [
      { key: 'address', label: 'Property' },
      { key: 'landlord', label: 'Landlord' },
      { key: 'rentAmount', label: 'Monthly Rent' },
      { key: 'feeType', label: 'Fee Type' },
      { key: 'feeValue', label: 'Fee Value' },
      { key: 'monthlyFee', label: 'Monthly Fee' },
    ],
    transform: (p: any) => {
      const rent = parseFloat(p.rent_amount || p.rentAmount || '0');
      const feeType = p.management_fee_type || p.managementFeeType || 'percentage';
      const feeValue = parseFloat(p.management_fee_value || p.managementFeeValue || '0');
      const monthlyFee = feeType === 'percentage' ? (rent * feeValue / 100) : feeValue;
      return {
        address: p.address || [p.address_line1, p.address_line2, p.city].filter(Boolean).join(', '),
        landlord: p.landlord_name || p.landlordName || '—',
        rentAmount: formatCurrency(rent),
        feeType: feeType === 'percentage' ? 'Percentage' : 'Fixed',
        feeValue: feeType === 'percentage' ? `${feeValue}%` : formatCurrency(feeValue),
        monthlyFee: formatCurrency(monthlyFee),
      };
    },
  },

  // ── TENANCY REPORTS ──
  {
    id: 'tenancy-expiry',
    name: 'Tenancy Expiry & Renewal',
    description: 'Tenancies approaching end date within the next 90 days — plan renewals or remarketing',
    category: 'tenant',
    icon: Calendar,
    frequency: 'Weekly',
    fetchData: async () => {
      const tenancies = await apiRequest<any[]>('/api/crm/pm/tenancies');
      const now = new Date();
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 90);
      return tenancies.filter((t: any) => {
        const end = new Date(t.endDate || t.end_date);
        return end >= now && end <= cutoff;
      });
    },
    columns: [
      { key: 'property', label: 'Property' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'landlord', label: 'Landlord' },
      { key: 'endDate', label: 'End Date' },
      { key: 'daysRemaining', label: 'Days Left' },
      { key: 'rentAmount', label: 'Current Rent' },
      { key: 'status', label: 'Status' },
    ],
    transform: (t: any) => {
      const end = new Date(t.endDate || t.end_date);
      const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return {
        property: t.propertyAddress || t.property_address || t.property?.address || '—',
        tenant: t.tenantName || t.tenant_name || t.tenant?.name || '—',
        landlord: t.landlordName || t.landlord_name || t.landlord?.name || '—',
        endDate: formatDate(t.endDate || t.end_date),
        daysRemaining: days.toString(),
        rentAmount: formatCurrency(t.rentAmount || t.rent_amount),
        status: t.status || '—',
      };
    },
  },
  {
    id: 'deposit-tracking',
    name: 'Deposit Tracking',
    description: 'All tenant deposits with protection scheme status and certificate numbers',
    category: 'tenant',
    icon: Shield,
    frequency: 'Monthly',
    fetchData: () => apiRequest('/api/crm/pm/tenancies'),
    columns: [
      { key: 'property', label: 'Property' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'depositAmount', label: 'Deposit Amount' },
      { key: 'depositScheme', label: 'Scheme' },
      { key: 'certificateNo', label: 'Certificate No.' },
      { key: 'startDate', label: 'Tenancy Start' },
      { key: 'status', label: 'Status' },
    ],
    transform: (t: any) => ({
      property: t.propertyAddress || t.property_address || t.property?.address || '—',
      tenant: t.tenantName || t.tenant_name || t.tenant?.name || '—',
      depositAmount: formatCurrency(t.depositAmount || t.deposit_amount),
      depositScheme: t.depositScheme || t.deposit_scheme || '—',
      certificateNo: t.depositCertificateNumber || t.deposit_certificate_number || '—',
      startDate: formatDate(t.startDate || t.start_date),
      status: t.status || '—',
    }),
  },
  {
    id: 'tenant-directory',
    name: 'Tenant Directory',
    description: 'Full directory of all tenants with contact details and tenancy status',
    category: 'tenant',
    icon: Users,
    frequency: 'Monthly',
    fetchData: () => apiRequest('/api/crm/tenants'),
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'mobile', label: 'Mobile' },
      { key: 'status', label: 'Status' },
      { key: 'emergencyContact', label: 'Emergency Contact' },
    ],
    transform: (t: any) => ({
      name: t.name || '—',
      email: t.email || '—',
      phone: t.phone || '—',
      mobile: t.mobile || '—',
      status: t.status || '—',
      emergencyContact: t.emergency_contact_name || t.emergencyContactName || '—',
    }),
  },

  // ── LANDLORD REPORTS ──
  {
    id: 'landlord-directory',
    name: 'Landlord Directory',
    description: 'All landlords with contact details, type, bank information, and property count',
    category: 'landlord',
    icon: UserCheck,
    frequency: 'Monthly',
    fetchData: () => apiRequest('/api/crm/landlords'),
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'landlordType', label: 'Type' },
      { key: 'bankName', label: 'Bank' },
      { key: 'hasBankDetails', label: 'Bank Details' },
      { key: 'status', label: 'Status' },
    ],
    transform: (l: any) => ({
      name: l.name || '—',
      email: l.email || '—',
      phone: l.phone || l.mobile || '—',
      landlordType: (l.landlord_type || l.landlordType || 'individual').charAt(0).toUpperCase() +
        (l.landlord_type || l.landlordType || 'individual').slice(1),
      bankName: l.bank_name || l.bankName || '—',
      hasBankDetails: (l.bank_account_number || l.bankAccountNumber) ? 'Yes' : 'No',
      status: l.status || '—',
    }),
  },

  // ── COMPLIANCE REPORTS ──
  {
    id: 'compliance-tracker',
    name: 'Compliance Tracker',
    description: 'Status of all legally required certificates — gas safety, EPC, EICR, and more',
    category: 'compliance',
    icon: ClipboardCheck,
    frequency: 'Weekly',
    fetchData: async () => {
      try {
        const data = await apiRequest<any>('/api/crm/compliance/dashboard');
        // Flatten compliance items from dashboard into a list
        const items: any[] = [];
        if (data?.expiringSoon) items.push(...data.expiringSoon.map((i: any) => ({ ...i, _status: 'Expiring Soon' })));
        if (data?.expired) items.push(...data.expired.map((i: any) => ({ ...i, _status: 'Expired' })));
        if (data?.actionRequired) items.push(...data.actionRequired.map((i: any) => ({ ...i, _status: 'Action Required' })));
        if (data?.compliant) items.push(...data.compliant.map((i: any) => ({ ...i, _status: 'Compliant' })));
        if (items.length > 0) return items;
        // If dashboard returns different format, return as array
        return Array.isArray(data) ? data : [];
      } catch {
        // Fallback to certifications endpoint
        return apiRequest('/api/crm/certifications');
      }
    },
    columns: [
      { key: 'property', label: 'Property' },
      { key: 'type', label: 'Certificate Type' },
      { key: 'expiryDate', label: 'Expiry Date' },
      { key: 'status', label: 'Status' },
    ],
    transform: (c: any) => ({
      property: c.propertyAddress || c.property_address || c.property?.address || '—',
      type: c.requirementName || c.requirement_name || c.type || c.name || '—',
      expiryDate: formatDate(c.expiryDate || c.expiry_date || c.dueDate || c.due_date),
      status: c._status || c.status || '—',
    }),
  },

  // ── MAINTENANCE REPORTS ──
  {
    id: 'maintenance-report',
    name: 'Maintenance & Repairs',
    description: 'All maintenance tickets with status, priority, contractor, and costs',
    category: 'maintenance',
    icon: Wrench,
    frequency: 'Weekly',
    fetchData: async () => {
      try {
        return await apiRequest('/api/crm/maintenance/tickets');
      } catch {
        return await apiRequest('/api/crm/maintenance');
      }
    },
    columns: [
      { key: 'property', label: 'Property' },
      { key: 'title', label: 'Issue' },
      { key: 'priority', label: 'Priority' },
      { key: 'status', label: 'Status' },
      { key: 'contractor', label: 'Contractor' },
      { key: 'reportedDate', label: 'Reported' },
      { key: 'cost', label: 'Cost' },
    ],
    transform: (m: any) => ({
      property: m.propertyAddress || m.property_address || m.property?.address || '—',
      title: m.title || m.description || m.issue || '—',
      priority: m.priority || '—',
      status: m.status || '—',
      contractor: m.contractorName || m.contractor_name || m.contractor || '—',
      reportedDate: formatDate(m.reportedAt || m.reported_at || m.createdAt || m.created_at),
      cost: formatCurrency(m.cost || m.actualCost || m.actual_cost),
    }),
  },

  // ── PERFORMANCE REPORTS ──
  {
    id: 'lead-conversion',
    name: 'Lead & Enquiry Report',
    description: 'All leads with source, status, type, and assigned agent for pipeline analysis',
    category: 'performance',
    icon: TrendingUp,
    frequency: 'Weekly',
    fetchData: () => apiRequest('/api/crm/leads'),
    columns: [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'leadType', label: 'Type' },
      { key: 'source', label: 'Source' },
      { key: 'status', label: 'Status' },
      { key: 'createdAt', label: 'Created' },
    ],
    transform: (l: any) => ({
      name: l.name || '—',
      email: l.email || '—',
      phone: l.phone || l.mobile || '—',
      leadType: l.lead_type || l.leadType || '—',
      source: l.source || '—',
      status: l.status || '—',
      createdAt: formatDate(l.created_at || l.createdAt),
    }),
  },
  {
    id: 'agent-performance',
    name: 'Agent Performance',
    description: 'Agent productivity metrics — listings, viewings, enquiries handled, and revenue',
    category: 'performance',
    icon: Users,
    frequency: 'Monthly',
    fetchData: async () => {
      try {
        return await apiRequest('/api/crm/analytics/agents');
      } catch {
        return await apiRequest('/api/crm/staff');
      }
    },
    columns: [
      { key: 'name', label: 'Agent' },
      { key: 'propertiesListed', label: 'Listed' },
      { key: 'propertiesSold', label: 'Sold' },
      { key: 'viewings', label: 'Viewings' },
      { key: 'enquiries', label: 'Enquiries' },
      { key: 'revenue', label: 'Revenue' },
    ],
    transform: (a: any) => ({
      name: a.name || a.fullName || a.full_name || '—',
      propertiesListed: a.propertiesListed ?? a.properties_listed ?? '—',
      propertiesSold: a.propertiesSold ?? a.properties_sold ?? '—',
      viewings: a.viewingsConducted ?? a.viewings_conducted ?? a.viewings ?? '—',
      enquiries: a.enquiriesHandled ?? a.enquiries_handled ?? a.enquiries ?? '—',
      revenue: a.revenue ? formatCurrency(a.revenue) : '—',
    }),
  },
  {
    id: 'tenancy-checkin-checkout',
    name: 'Tenancy Check-In / Check-Out',
    description: 'Upcoming and recent move-ins and move-outs with checklist completion status',
    category: 'tenant',
    icon: Key,
    frequency: 'Weekly',
    fetchData: async () => {
      const tenancies = await apiRequest<any[]>('/api/crm/pm/tenancies');
      const now = new Date();
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);
      const future30 = new Date();
      future30.setDate(future30.getDate() + 30);
      return tenancies.filter((t: any) => {
        const start = new Date(t.startDate || t.start_date);
        const end = new Date(t.endDate || t.end_date);
        return (start >= past30 && start <= future30) || (end >= past30 && end <= future30);
      });
    },
    columns: [
      { key: 'property', label: 'Property' },
      { key: 'tenant', label: 'Tenant' },
      { key: 'event', label: 'Event' },
      { key: 'date', label: 'Date' },
      { key: 'status', label: 'Status' },
    ],
    transform: (t: any) => {
      const now = new Date();
      const start = new Date(t.startDate || t.start_date);
      const end = new Date(t.endDate || t.end_date);
      const future30 = new Date();
      future30.setDate(future30.getDate() + 30);
      const past30 = new Date();
      past30.setDate(past30.getDate() - 30);

      const isCheckIn = start >= past30 && start <= future30;
      return {
        property: t.propertyAddress || t.property_address || t.property?.address || '—',
        tenant: t.tenantName || t.tenant_name || t.tenant?.name || '—',
        event: isCheckIn ? 'Check-In' : 'Check-Out',
        date: formatDate(isCheckIn ? (t.startDate || t.start_date) : (t.endDate || t.end_date)),
        status: t.status || '—',
      };
    },
  },
];

// ─── CSV export helper ──────────────────────────────────────────────

function downloadCSV(filename: string, columns: { key: string; label: string }[], rows: Record<string, any>[]) {
  const header = columns.map(c => `"${c.label}"`).join(',');
  const body = rows.map(row =>
    columns.map(c => {
      const val = row[c.key] ?? '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  ).join('\n');
  const csv = header + '\n' + body;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── Component ──────────────────────────────────────────────────────

export default function ReportBuilder() {
  const { toast } = useToast();
  const [selectedReport, setSelectedReport] = useState<ReportDefinition | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<Record<string, any>[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const handleGenerateReport = async (report: ReportDefinition) => {
    setSelectedReport(report);
    setLoading(true);
    setReportData(null);
    setError(null);

    try {
      const rawData = await report.fetchData();
      const data = Array.isArray(rawData) ? rawData : [];
      const transformed = data.map(report.transform);
      setReportData(transformed);
      toast({
        title: 'Report generated',
        description: `${report.name}: ${transformed.length} records found.`,
      });
    } catch (err: any) {
      const msg = err?.message || 'Failed to generate report';
      setError(msg);
      toast({
        title: 'Error generating report',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!selectedReport || !reportData) return;
    const filename = `${selectedReport.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCSV(filename, selectedReport.columns, reportData);
    toast({ title: 'Downloaded', description: `${filename} saved.` });
  };

  const filteredReports = categoryFilter === 'all'
    ? reports
    : reports.filter(r => r.category === categoryFilter);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="h-5 w-5 text-[#791E75]" />
          Reports
        </h1>
        <p className="text-sm text-gray-500 mt-1">Generate and download management reports</p>
      </div>

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Label className="text-sm font-medium mr-2">Category:</Label>
          <Button
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setCategoryFilter('all')}
          >
            All Reports
          </Button>
          {Object.entries(categoryLabels).map(([key, { label }]) => (
            <Button
              key={key}
              variant={categoryFilter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCategoryFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Report list (left panel) */}
          <div className="lg:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Available Reports ({filteredReports.length})
            </h2>
            {filteredReports.map((report) => {
              const IconComp = report.icon;
              const isActive = selectedReport?.id === report.id;
              const cat = categoryLabels[report.category];
              return (
                <Card
                  key={report.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${isActive ? 'ring-2 ring-[#791E75] shadow-md' : ''}`}
                  onClick={() => handleGenerateReport(report)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-gray-100 rounded-lg flex-shrink-0">
                        <IconComp className="h-5 w-5 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-sm truncate">{report.name}</h3>
                          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">{report.description}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
                          <span className="text-[10px] text-gray-400">{report.frequency}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Report results (right panel) */}
          <div className="lg:col-span-2">
            {!selectedReport && !loading && (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center py-12">
                  <Table className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">Select a Report</h3>
                  <p className="text-sm text-gray-400 max-w-sm mx-auto">
                    Choose a report from the list to generate it with live data from your CRM.
                    Reports can be downloaded as CSV.
                  </p>
                </CardContent>
              </Card>
            )}

            {loading && (
              <Card className="h-full flex items-center justify-center min-h-[400px]">
                <CardContent className="text-center py-12">
                  <Loader2 className="h-12 w-12 mx-auto text-[#791E75] animate-spin mb-4" />
                  <h3 className="text-lg font-medium text-gray-600">Generating Report...</h3>
                  <p className="text-sm text-gray-400 mt-1">Fetching data from the CRM</p>
                </CardContent>
              </Card>
            )}

            {error && !loading && (
              <Card className="border-red-200">
                <CardContent className="py-12 text-center">
                  <AlertTriangle className="h-12 w-12 mx-auto text-red-400 mb-4" />
                  <h3 className="text-lg font-medium text-red-600 mb-2">Error</h3>
                  <p className="text-sm text-gray-500">{error}</p>
                  <Button
                    variant="outline"
                    className="mt-4"
                    onClick={() => selectedReport && handleGenerateReport(selectedReport)}
                  >
                    Retry
                  </Button>
                </CardContent>
              </Card>
            )}

            {selectedReport && reportData && !loading && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {(() => { const Icon = selectedReport.icon; return <Icon className="h-5 w-5" />; })()}
                        {selectedReport.name}
                      </CardTitle>
                      <CardDescription>
                        {reportData.length} records — Generated {new Date().toLocaleString('en-GB')}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={handleDownload}>
                        <Download className="h-4 w-4 mr-2" />
                        Download CSV
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {reportData.length === 0 ? (
                    <div className="py-12 text-center">
                      <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <p className="text-gray-500">No data found for this report.</p>
                      <p className="text-sm text-gray-400 mt-1">Try adjusting filters or check that data exists in the system.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="text-left p-3 text-xs font-semibold text-gray-600 w-8">#</th>
                            {selectedReport.columns.map(col => (
                              <th key={col.key} className="text-left p-3 text-xs font-semibold text-gray-600 whitespace-nowrap">
                                {col.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.slice(0, 100).map((row, idx) => (
                            <tr key={idx} className="border-b hover:bg-gray-50 last:border-0">
                              <td className="p-3 text-xs text-gray-400">{idx + 1}</td>
                              {selectedReport.columns.map(col => (
                                <td key={col.key} className="p-3 text-xs whitespace-nowrap">
                                  {row[col.key] ?? '—'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {reportData.length > 100 && (
                        <div className="p-3 text-center text-xs text-gray-400 bg-gray-50 border-t">
                          Showing first 100 of {reportData.length} records. Download CSV for full data.
                        </div>
                      )}
                    </div>
                  )}

                  {/* Summary stats */}
                  {reportData.length > 0 && (
                    <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <FileSpreadsheet className="h-3.5 w-3.5" />
                        {reportData.length} total records
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Generated: {new Date().toLocaleDateString('en-GB')}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
    </div>
  );
}
