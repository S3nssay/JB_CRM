import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Loader2, RefreshCw, Calendar, AlertCircle, Clock, CheckCircle,
  Bell, Home, Search, Archive, X, ExternalLink, User, Building2,
  PoundSterling, FileText, ChevronRight, Trash2, Filter,
  ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface TenancyRenewal {
  id: number;
  tenancyId: number;
  propertyId: number;
  landlordId?: number;
  tenantId?: number;
  expiryDate: string;
  reminderType: string;
  status: string;
  response?: string;
  tenantResponse?: string;
  notes?: string;
  sentAt?: string;
  acknowledgedAt?: string;
  createdAt?: string;
  // Enriched fields
  propertyAddress?: string;
  tenantName?: string;
  landlordName?: string;
  rentAmount?: string;
  rentFrequency?: string;
  tenancyStatus?: string;
  startDate?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getDaysRemaining(expiryDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function formatRent(amount?: string, frequency?: string): string {
  if (!amount) return '-';
  const num = parseFloat(amount);
  if (isNaN(num)) return '-';
  const formatted = `£${num.toLocaleString('en-GB', { minimumFractionDigits: 0 })}`;
  if (frequency) return `${formatted} / ${frequency}`;
  return formatted;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:      { label: 'Pending',      className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  sent:         { label: 'Sent',         className: 'bg-blue-100 text-blue-800 border-blue-300' },
  acknowledged: { label: 'Acknowledged', className: 'bg-green-100 text-green-800 border-green-300' },
  archived:     { label: 'Archived',     className: 'bg-gray-100 text-gray-500 border-gray-300' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border capitalize`}>{cfg.label}</Badge>;
}

const responseConfig: Record<string, { label: string; className: string }> = {
  renew:     { label: 'Renew',     className: 'bg-green-100 text-green-800 border-green-300' },
  vacate:    { label: 'Vacate',    className: 'bg-red-100 text-red-800 border-red-300' },
  undecided: { label: 'Undecided', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
};

function ResponseBadge({ response }: { response?: string }) {
  if (!response) return <span className="text-muted-foreground text-sm">No response</span>;
  const cfg = responseConfig[response] || { label: response, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

function DaysRemainingBadge({ days }: { days: number }) {
  let className = 'bg-green-100 text-green-800 border-green-300';
  if (days < 0) className = 'bg-red-100 text-red-800 border-red-300';
  else if (days <= 30) className = 'bg-red-100 text-red-800 border-red-300';
  else if (days <= 60) className = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  else if (days <= 90) className = 'bg-blue-100 text-blue-800 border-blue-300';
  return (
    <Badge className={`${className} border`}>
      {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d remaining`}
    </Badge>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TenancyRenewals() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedRenewal, setSelectedRenewal] = useState<TenancyRenewal | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [urgencyFilter, setUrgencyFilter] = useState<string>('all');
  const [showArchiveConfirm, setShowArchiveConfirm] = useState<TenancyRenewal | null>(null);
  const [showBulkArchiveConfirm, setShowBulkArchiveConfirm] = useState(false);
  const [sortColumn, setSortColumn] = useState<string>('expiryDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: renewals = [], isLoading, isError } = useQuery<TenancyRenewal[]>({
    queryKey: ['/api/crm/tenancy-renewals'],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const checkRenewalsMutation = useMutation({
    mutationFn: () => apiRequest('/api/crm/tenancy-renewals/check', 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-renewals'] });
      toast({ title: 'Renewals checked', description: 'Renewal reminders have been updated.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateResponseMutation = useMutation({
    mutationFn: ({ id, tenantResponse }: { id: number; tenantResponse: string }) =>
      apiRequest(`/api/crm/tenancy-renewals/${id}`, 'PUT', { tenantResponse }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-renewals'] });
      toast({ title: 'Response updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      apiRequest(`/api/crm/tenancy-renewals/${id}`, 'PUT', { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-renewals'] });
      toast({ title: 'Status updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const archiveMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/crm/tenancy-renewals/${id}/archive`, 'PUT', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-renewals'] });
      setShowArchiveConfirm(null);
      setSelectedRenewal(null);
      toast({ title: 'Archived', description: 'Renewal reminder has been archived.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: () => apiRequest('/api/crm/tenancy-renewals/bulk-archive', 'POST', {}),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancy-renewals'] });
      setShowBulkArchiveConfirm(false);
      toast({ title: 'Bulk archive complete', description: `${data.archived || 0} old reminders archived.` });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filteredRenewals = renewals.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (urgencyFilter !== 'all') {
      const days = getDaysRemaining(r.expiryDate);
      if (urgencyFilter === 'overdue' && days >= 0) return false;
      if (urgencyFilter === '30' && (days < 0 || days > 30)) return false;
      if (urgencyFilter === '60' && (days < 0 || days > 60)) return false;
      if (urgencyFilter === '90' && (days < 0 || days > 90)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAddress = r.propertyAddress?.toLowerCase().includes(q);
      const matchTenant = r.tenantName?.toLowerCase().includes(q);
      const matchLandlord = r.landlordName?.toLowerCase().includes(q);
      const matchId = String(r.tenancyId).includes(q);
      if (!matchAddress && !matchTenant && !matchLandlord && !matchId) return false;
    }
    return true;
  });

  // ── Sorting ────────────────────────────────────────────────────────────────

  const statusOrder: Record<string, number> = { pending: 0, sent: 1, acknowledged: 2, archived: 3 };
  const reminderOrder: Record<string, number> = { '14_day': 0, '30_day': 1, '60_day': 2, '90_day': 3 };

  const sortedRenewals = [...filteredRenewals].sort((a, b) => {
    let cmp = 0;
    switch (sortColumn) {
      case 'expiryDate':
        cmp = new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        break;
      case 'daysRemaining':
        cmp = getDaysRemaining(a.expiryDate) - getDaysRemaining(b.expiryDate);
        break;
      case 'status':
        cmp = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
        break;
      case 'reminderType':
        cmp = (reminderOrder[a.reminderType] ?? 99) - (reminderOrder[b.reminderType] ?? 99);
        break;
      default:
        cmp = 0;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  function toggleSort(column: string) {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  }

  function SortIcon({ column }: { column: string }) {
    if (sortColumn !== column) return <ArrowUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="h-3.5 w-3.5 ml-1 text-[#791E75]" />
      : <ArrowDown className="h-3.5 w-3.5 ml-1 text-[#791E75]" />;
  }

  // ── Counts ─────────────────────────────────────────────────────────────────

  const overdueCount = renewals.filter(r => getDaysRemaining(r.expiryDate) < 0 && r.status !== 'archived').length;
  const expiring30 = renewals.filter(r => {
    const d = getDaysRemaining(r.expiryDate);
    return d >= 0 && d <= 30 && r.status !== 'archived';
  }).length;

  // ── Detail Panel ───────────────────────────────────────────────────────────

  function DetailPanel({ renewal }: { renewal: TenancyRenewal }) {
    const days = getDaysRemaining(renewal.expiryDate);

    return (
      <div className="space-y-6">
        {/* Urgency banner */}
        {days < 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-medium text-red-800">
              This tenancy expired {Math.abs(days)} days ago
            </span>
          </div>
        )}

        {/* Property */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Building2 className="h-3.5 w-3.5" /> Property
          </h3>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{renewal.propertyAddress || `Property #${renewal.propertyId}`}</p>
            <Link href={`/crm/properties/${renewal.propertyId}/edit`}>
              <Button variant="link" className="h-auto p-0 text-xs text-[#791E75]">
                View property <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Tenancy details */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <FileText className="h-3.5 w-3.5" /> Tenancy Details
          </h3>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Tenancy ID:</span>
                <span className="ml-1 font-medium">{renewal.tenancyId}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-1">
                  <Badge variant="outline" className="capitalize text-xs">{renewal.tenancyStatus || '-'}</Badge>
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Start:</span>
                <span className="ml-1">{formatDate(renewal.startDate)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Expiry:</span>
                <span className="ml-1 font-medium">{formatDate(renewal.expiryDate)}</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-1 text-sm">
              <PoundSterling className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">Rent:</span>
              <span className="font-medium">{formatRent(renewal.rentAmount, renewal.rentFrequency)}</span>
            </div>
            <Link href={`/crm/tenancies/${renewal.tenancyId}`}>
              <Button variant="link" className="h-auto p-0 text-xs text-[#791E75]">
                View full tenancy <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </div>
        </div>

        {/* Tenant */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <User className="h-3.5 w-3.5" /> Tenant
          </h3>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{renewal.tenantName || `Tenant #${renewal.tenantId || '-'}`}</p>
          </div>
        </div>

        {/* Landlord */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <User className="h-3.5 w-3.5" /> Landlord
          </h3>
          <div className="bg-muted/50 rounded-lg p-3">
            <p className="font-medium">{renewal.landlordName || `Landlord #${renewal.landlordId || '-'}`}</p>
            {renewal.landlordId && (
              <Link href={`/crm/landlords/${renewal.landlordId}`}>
                <Button variant="link" className="h-auto p-0 text-xs text-[#791E75]">
                  View landlord <ExternalLink className="h-3 w-3 ml-1" />
                </Button>
              </Link>
            )}
          </div>
        </div>

        {/* Reminder info */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-1">
            <Bell className="h-3.5 w-3.5" /> Reminder
          </h3>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Type:</span>
                <span className="ml-1 capitalize">{renewal.reminderType?.replace(/_/g, ' ')}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-1"><StatusBadge status={renewal.status} /></span>
              </div>
              <div>
                <span className="text-muted-foreground">Created:</span>
                <span className="ml-1">{formatDate(renewal.createdAt)}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Days:</span>
                <span className="ml-1"><DaysRemainingBadge days={days} /></span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Response action */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Tenant Response</h3>
          <Select
            value={renewal.response || renewal.tenantResponse || ''}
            onValueChange={(value) =>
              updateResponseMutation.mutate({ id: renewal.id, tenantResponse: value })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Set tenant response..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="renew">Renew tenancy</SelectItem>
              <SelectItem value="vacate">Tenant vacating</SelectItem>
              <SelectItem value="undecided">Undecided</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status action */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-2">Reminder Status</h3>
          <Select
            value={renewal.status}
            onValueChange={(value) =>
              updateStatusMutation.mutate({ id: renewal.id, status: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="acknowledged">Acknowledged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Separator />

        {/* Archive */}
        <Button
          variant="outline"
          className="w-full text-orange-700 border-orange-300 hover:bg-orange-50"
          onClick={() => setShowArchiveConfirm(renewal)}
        >
          <Archive className="h-4 w-4 mr-2" />
          Archive this reminder
        </Button>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tenancy Renewals</h1>
          <p className="text-muted-foreground">Track upcoming tenancy expirations and renewal decisions</p>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="text-orange-700 border-orange-300 hover:bg-orange-50"
              onClick={() => setShowBulkArchiveConfirm(true)}
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive expired ({overdueCount})
            </Button>
          )}
          <Button
            onClick={() => checkRenewalsMutation.mutate()}
            disabled={checkRenewalsMutation.isPending}
          >
            {checkRenewalsMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Check Renewals
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className={`cursor-pointer transition-colors ${statusFilter === 'pending' ? 'ring-2 ring-[#791E75]' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <Bell className="h-5 w-5 text-yellow-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{renewals.filter(r => r.status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-colors ${statusFilter === 'sent' ? 'ring-2 ring-[#791E75]' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter(statusFilter === 'sent' ? 'all' : 'sent')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Clock className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold">{renewals.filter(r => r.status === 'sent').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-colors ${statusFilter === 'acknowledged' ? 'ring-2 ring-[#791E75]' : 'hover:bg-muted/50'}`}
          onClick={() => setStatusFilter(statusFilter === 'acknowledged' ? 'all' : 'acknowledged')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Acknowledged</p>
                <p className="text-2xl font-bold">{renewals.filter(r => r.status === 'acknowledged').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-colors ${urgencyFilter === '30' ? 'ring-2 ring-[#791E75]' : 'hover:bg-muted/50'}`}
          onClick={() => setUrgencyFilter(urgencyFilter === '30' ? 'all' : '30')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertCircle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Within 30 days</p>
                <p className="text-2xl font-bold">{expiring30}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-colors ${urgencyFilter === 'overdue' ? 'ring-2 ring-[#791E75]' : 'hover:bg-muted/50'}`}
          onClick={() => setUrgencyFilter(urgencyFilter === 'overdue' ? 'all' : 'overdue')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <Trash2 className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold">{overdueCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters Bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search address, tenant, landlord..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="acknowledged">Acknowledged</SelectItem>
          </SelectContent>
        </Select>
        <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
          <SelectTrigger className="w-[160px]">
            <Clock className="h-3.5 w-3.5 mr-1" />
            <SelectValue placeholder="Urgency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All timeframes</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="30">Within 30 days</SelectItem>
            <SelectItem value="60">Within 60 days</SelectItem>
            <SelectItem value="90">Within 90 days</SelectItem>
          </SelectContent>
        </Select>
        {(statusFilter !== 'all' || urgencyFilter !== 'all' || searchQuery) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStatusFilter('all'); setUrgencyFilter('all'); setSearchQuery(''); }}
          >
            <X className="h-3.5 w-3.5 mr-1" /> Clear filters
          </Button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">
          {sortedRenewals.length} of {renewals.length} reminders
        </span>
      </div>

      {/* Renewals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Renewal Reminders
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-12 text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              Failed to load tenancy renewals
            </div>
          ) : sortedRenewals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Home className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No renewal reminders</p>
              <p className="text-sm">
                {renewals.length > 0
                  ? 'Try adjusting your filters.'
                  : 'Click "Check Renewals" to scan for upcoming expirations.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Landlord</TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('expiryDate')}>
                    <div className="flex items-center">Expiry Date<SortIcon column="expiryDate" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('daysRemaining')}>
                    <div className="flex items-center">Time Left<SortIcon column="daysRemaining" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('reminderType')}>
                    <div className="flex items-center">Reminder<SortIcon column="reminderType" /></div>
                  </TableHead>
                  <TableHead className="cursor-pointer select-none hover:text-foreground" onClick={() => toggleSort('status')}>
                    <div className="flex items-center">Status<SortIcon column="status" /></div>
                  </TableHead>
                  <TableHead>Response</TableHead>
                  <TableHead className="w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRenewals.map((renewal) => {
                  const daysRemaining = getDaysRemaining(renewal.expiryDate);
                  return (
                    <TableRow
                      key={renewal.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedRenewal(renewal)}
                    >
                      <TableCell className="font-medium max-w-[200px]">
                        <div className="truncate">{renewal.propertyAddress || `Property #${renewal.propertyId}`}</div>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <div className="truncate">{renewal.tenantName || '-'}</div>
                      </TableCell>
                      <TableCell className="max-w-[140px]">
                        <div className="truncate">{renewal.landlordName || '-'}</div>
                      </TableCell>
                      <TableCell>{formatDate(renewal.expiryDate)}</TableCell>
                      <TableCell>
                        <DaysRemainingBadge days={daysRemaining} />
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-sm">{renewal.reminderType?.replace(/_/g, ' ')}</span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={renewal.status} />
                      </TableCell>
                      <TableCell>
                        <ResponseBadge response={renewal.response || renewal.tenantResponse} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Select
                            value={renewal.response || renewal.tenantResponse || ''}
                            onValueChange={(value) =>
                              updateResponseMutation.mutate({ id: renewal.id, tenantResponse: value })
                            }
                          >
                            <SelectTrigger className="h-8 w-[100px] text-xs">
                              <SelectValue placeholder="Response" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="renew">Renew</SelectItem>
                              <SelectItem value="vacate">Vacate</SelectItem>
                              <SelectItem value="undecided">Undecided</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-orange-600 hover:text-orange-800 hover:bg-orange-50"
                            title="Archive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setShowArchiveConfirm(renewal);
                            }}
                          >
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Sheet */}
      <Sheet open={!!selectedRenewal} onOpenChange={(open) => !open && setSelectedRenewal(null)}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Renewal Details
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4">
            {selectedRenewal && <DetailPanel renewal={selectedRenewal} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Archive Confirm Dialog */}
      <Dialog open={!!showArchiveConfirm} onOpenChange={(open) => !open && setShowArchiveConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Renewal Reminder</DialogTitle>
            <DialogDescription>
              Archive the {showArchiveConfirm?.reminderType?.replace(/_/g, ' ')} reminder for{' '}
              {showArchiveConfirm?.propertyAddress || `Property #${showArchiveConfirm?.propertyId}`}?
              This will hide it from the active list.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveConfirm(null)}>Cancel</Button>
            <Button
              variant="default"
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => showArchiveConfirm && archiveMutation.mutate(showArchiveConfirm.id)}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Archive
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Archive Dialog */}
      <Dialog open={showBulkArchiveConfirm} onOpenChange={setShowBulkArchiveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Archive Expired Reminders</DialogTitle>
            <DialogDescription>
              This will archive all pending reminders for tenancies that expired more than 30 days ago.
              Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkArchiveConfirm(false)}>Cancel</Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700"
              onClick={() => bulkArchiveMutation.mutate()}
              disabled={bulkArchiveMutation.isPending}
            >
              {bulkArchiveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Archive All Expired
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
