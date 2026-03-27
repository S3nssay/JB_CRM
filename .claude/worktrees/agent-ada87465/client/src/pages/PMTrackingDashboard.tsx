import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Building, PoundSterling, ShieldCheck, AlertTriangle,
  Clock, CalendarClock, ArrowRight, Loader2, ShieldAlert,
  CheckCircle, ExternalLink,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { formatPence } from '@/lib/utils';

// --- Types ---

interface PMSummary {
  activeTenancies: number;
  pendingTenancies: number;
  rentCollectedThisMonth: number;
  rentOutstandingThisMonth: number;
  depositsProtected: number;
  depositsUnprotected: number;
  complianceValid: number;
  complianceExpiring: number;
  complianceExpired: number;
  arrearsCases: number;
  arrearsTotal: number;
  endingSoon: number;
}

interface TenancyRow {
  id: number;
  propertyAddress: string;
  tenantName: string;
  landlordName: string;
  rentAmount: number;
  startDate: string;
  endDate: string;
  commissionPercent: number;
  status: string;
  daysRemaining?: number;
}

// --- Helpers ---

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return format(new Date(dateStr), 'dd MMM yyyy');
  } catch {
    return '-';
  }
}

function getStatusBadge(status: string) {
  const map: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    active: { variant: 'default', className: 'bg-green-600 hover:bg-green-700' },
    pending: { variant: 'secondary', className: 'bg-yellow-500 hover:bg-yellow-600 text-black' },
    ending_soon: { variant: 'default', className: 'bg-orange-500 hover:bg-orange-600' },
    expired: { variant: 'destructive' },
    terminated: { variant: 'destructive' },
  };
  const cfg = map[status] || { variant: 'outline' as const };
  return (
    <Badge variant={cfg.variant} className={cfg.className}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </Badge>
  );
}

// --- Component ---

export default function PMTrackingDashboard() {
  const [activeTab, setActiveTab] = useState('active');

  const { data: summary, isLoading: summaryLoading } = useQuery<PMSummary>({
    queryKey: ['/api/crm/pm-dashboard/summary'],
  });

  const { data: activeTenancies = [], isLoading: tenanciesLoading } = useQuery<TenancyRow[]>({
    queryKey: ['/api/crm/pm-dashboard/tenancies', 'active'],
    queryFn: () => apiRequest('/api/crm/pm-dashboard/tenancies?status=active'),
  });

  const { data: endingSoonTenancies = [], isLoading: endingSoonLoading } = useQuery<TenancyRow[]>({
    queryKey: ['/api/crm/pm-dashboard/tenancies', 'ending_soon'],
    queryFn: () => apiRequest('/api/crm/pm-dashboard/tenancies?status=ending_soon'),
    enabled: activeTab === 'ending_soon',
  });

  const rentTotal = (summary?.rentCollectedThisMonth ?? 0) + (summary?.rentOutstandingThisMonth ?? 0);
  const rentProgress = rentTotal > 0 ? Math.round(((summary?.rentCollectedThisMonth ?? 0) / rentTotal) * 100) : 0;

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#791E75' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>Property Management Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bird's eye view of all managed properties, tenancies, and compliance
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Tenancies</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.activeTenancies ?? 0}</div>
            {(summary?.pendingTenancies ?? 0) > 0 && (
              <Badge variant="secondary" className="mt-1 bg-yellow-500 text-black text-xs">
                {summary?.pendingTenancies} pending
              </Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rent Collection</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatPence(summary?.rentCollectedThisMonth ?? 0)}</div>
            <Progress value={rentProgress} className="mt-2 h-2" />
            <p className="text-xs text-muted-foreground mt-1">
              {formatPence(summary?.rentOutstandingThisMonth ?? 0)} outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Deposit Protection</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.depositsProtected ?? 0}</div>
            {(summary?.depositsUnprotected ?? 0) > 0 && (
              <Badge variant="destructive" className="mt-1 text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {summary?.depositsUnprotected} unprotected
              </Badge>
            )}
            {(summary?.depositsUnprotected ?? 0) === 0 && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> All protected
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-green-600">{summary?.complianceValid ?? 0}</span>
              <span className="text-muted-foreground">/</span>
              {(summary?.complianceExpiring ?? 0) > 0 && (
                <span className="text-lg font-semibold text-yellow-600">{summary?.complianceExpiring}</span>
              )}
              {(summary?.complianceExpired ?? 0) > 0 && (
                <span className="text-lg font-semibold text-red-600">{summary?.complianceExpired}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valid / Expiring / Expired
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Arrears</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.arrearsCases ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatPence(summary?.arrearsTotal ?? 0)} outstanding
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ending Soon</CardTitle>
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.endingSoon ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Within 90 days</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Tenancies</TabsTrigger>
          <TabsTrigger value="ending_soon">Ending Soon</TabsTrigger>
          <TabsTrigger value="rent">Rent Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="deposits">Deposits</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          <Card>
            <CardHeader>
              <CardTitle>Active Tenancies</CardTitle>
            </CardHeader>
            <CardContent>
              {tenanciesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : activeTenancies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active tenancies found.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Landlord</TableHead>
                      <TableHead className="text-right">Rent</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Commission %</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeTenancies.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <Link href={`/crm/tenancies/${t.id}`}>
                            <span className="font-medium hover:underline" style={{ color: '#791E75' }}>
                              {t.propertyAddress}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>{t.tenantName}</TableCell>
                        <TableCell>{t.landlordName}</TableCell>
                        <TableCell className="text-right">{formatPence(t.rentAmount)}</TableCell>
                        <TableCell>{formatDate(t.startDate)}</TableCell>
                        <TableCell>{formatDate(t.endDate)}</TableCell>
                        <TableCell className="text-right">{t.commissionPercent}%</TableCell>
                        <TableCell>{getStatusBadge(t.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ending_soon">
          <Card>
            <CardHeader>
              <CardTitle>Tenancies Ending Within 90 Days</CardTitle>
            </CardHeader>
            <CardContent>
              {endingSoonLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : endingSoonTenancies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No tenancies ending soon.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Property</TableHead>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Landlord</TableHead>
                      <TableHead className="text-right">Rent</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Days Remaining</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {endingSoonTenancies.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Link href={`/crm/tenancies/${t.id}`}>
                            <span className="font-medium hover:underline" style={{ color: '#791E75' }}>
                              {t.propertyAddress}
                            </span>
                          </Link>
                        </TableCell>
                        <TableCell>{t.tenantName}</TableCell>
                        <TableCell>{t.landlordName}</TableCell>
                        <TableCell className="text-right">{formatPence(t.rentAmount)}</TableCell>
                        <TableCell>{formatDate(t.endDate)}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              (t.daysRemaining ?? 0) <= 30
                                ? 'destructive'
                                : (t.daysRemaining ?? 0) <= 60
                                  ? 'secondary'
                                  : 'outline'
                            }
                            className={
                              (t.daysRemaining ?? 0) <= 30
                                ? ''
                                : (t.daysRemaining ?? 0) <= 60
                                  ? 'bg-yellow-500 text-black'
                                  : ''
                            }
                          >
                            <Clock className="h-3 w-3 mr-1" />
                            {t.daysRemaining ?? '-'} days
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Link href={`/crm/tenancies/${t.id}`}>
                            <Button variant="outline" size="sm">
                              Start End of Tenancy
                              <ArrowRight className="h-3.5 w-3.5 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rent">
          <Card>
            <CardHeader>
              <CardTitle>Rent Overview</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <PoundSterling className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">View full rent collection details and history.</p>
              <Link href="/crm/rent-collection">
                <Button style={{ backgroundColor: '#791E75' }} className="hover:opacity-90">
                  Go to Rent Collection
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance">
          <Card>
            <CardHeader>
              <CardTitle>Compliance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <ShieldAlert className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">View compliance certificates, expiry dates, and upcoming renewals.</p>
              <Link href="/crm/compliance-calendar">
                <Button style={{ backgroundColor: '#791E75' }} className="hover:opacity-90">
                  Go to Compliance Calendar
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deposits">
          <Card>
            <CardHeader>
              <CardTitle>Deposit Management</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
              <ShieldCheck className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">Manage tenant deposits, protection status, and returns.</p>
              <Link href="/crm/deposit-management">
                <Button style={{ backgroundColor: '#791E75' }} className="hover:opacity-90">
                  Go to Deposit Management
                  <ExternalLink className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
