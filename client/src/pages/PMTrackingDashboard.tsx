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
  CheckCircle, ExternalLink, Home, Activity, HeartPulse, Bot,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { formatPence } from '@/lib/utils';

// --- Types ---

interface ComplianceCertEntry {
  propertyId: number;
  propertyAddress: string;
  certificationType: string;
  expiryDate: string;
  landlordName: string;
  urgency: 'expired' | 'expiring_soon';
}

interface ComplianceAlertsData {
  expired: ComplianceCertEntry[];
  expiringSoon: ComplianceCertEntry[];
  totalProperties: number;
  compliantProperties: number;
}

interface PortfolioProperty {
  id: number;
  address: string;
  landlordName: string;
  healthScore: number;
  issues: string[];
}

interface PortfolioHealthData {
  properties: PortfolioProperty[];
  averageScore: number;
  criticalCount: number;
}

interface AgentActivityData {
  byAgent: Record<string, { totalActions: number; topActions: { action: string; count: number }[] }>;
  totalActions: number;
  period: { days: number; from: string; to: string };
}

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
  totalManagedProperties: number;
  dormantProperties: number;
  occupiedProperties: number;
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

  // PM Overview queries
  const { data: complianceAlerts } = useQuery<ComplianceAlertsData>({
    queryKey: ['/api/crm/pm-overview/compliance-alerts'],
    queryFn: () => apiRequest('/api/crm/pm-overview/compliance-alerts'),
  });

  const { data: portfolioHealth } = useQuery<PortfolioHealthData>({
    queryKey: ['/api/crm/pm-overview/portfolio-health'],
    queryFn: () => apiRequest('/api/crm/pm-overview/portfolio-health'),
  });

  const { data: agentActivity } = useQuery<AgentActivityData>({
    queryKey: ['/api/crm/pm-overview/agent-activity'],
    queryFn: () => apiRequest('/api/crm/pm-overview/agent-activity'),
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

      {/* PM Overview Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Compliance Alerts Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" style={{ color: '#791E75' }} />
              Compliance Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {complianceAlerts ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  {complianceAlerts.expired.length > 0 ? (
                    <Badge variant="destructive" className="text-sm">
                      {complianceAlerts.expired.length} Expired
                    </Badge>
                  ) : null}
                  {complianceAlerts.expiringSoon.length > 0 ? (
                    <Badge className="bg-amber-500 hover:bg-amber-600 text-sm">
                      {complianceAlerts.expiringSoon.length} Expiring Soon
                    </Badge>
                  ) : null}
                  {complianceAlerts.expired.length === 0 && complianceAlerts.expiringSoon.length === 0 && (
                    <Badge className="bg-green-600 hover:bg-green-700 text-sm">
                      <CheckCircle className="h-3 w-3 mr-1" /> All Clear
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {complianceAlerts.compliantProperties} of {complianceAlerts.totalProperties} properties fully compliant
                </div>
                {[...complianceAlerts.expired, ...complianceAlerts.expiringSoon].slice(0, 4).map((cert, idx) => (
                  <div key={idx} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                    <div className="truncate flex-1 mr-2">
                      <span className="font-medium">{cert.propertyAddress}</span>
                      <span className="text-muted-foreground ml-1">- {cert.certificationType.replace(/_/g, ' ')}</span>
                    </div>
                    <Badge variant={cert.urgency === 'expired' ? 'destructive' : 'outline'}
                      className={cert.urgency === 'expiring_soon' ? 'border-amber-500 text-amber-700' : ''}>
                      {cert.urgency === 'expired' ? 'Expired' : 'Expiring'}
                    </Badge>
                  </div>
                ))}
              </>
            ) : (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Portfolio Health Overview */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <HeartPulse className="h-5 w-5" style={{ color: '#791E75' }} />
              Portfolio Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {portfolioHealth ? (
              <>
                <div className="flex items-center gap-4 mb-3">
                  <div className={`text-4xl font-bold ${
                    portfolioHealth.averageScore >= 80 ? 'text-green-600' :
                    portfolioHealth.averageScore >= 50 ? 'text-amber-600' : 'text-red-600'
                  }`}>
                    {portfolioHealth.averageScore}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <div>Average Score</div>
                    {portfolioHealth.criticalCount > 0 && (
                      <Badge variant="destructive" className="mt-1">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {portfolioHealth.criticalCount} critical
                      </Badge>
                    )}
                  </div>
                </div>
                {portfolioHealth.properties
                  .filter(p => p.healthScore < 100)
                  .sort((a, b) => a.healthScore - b.healthScore)
                  .slice(0, 5)
                  .map((prop) => (
                    <div key={prop.id} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                      <span className="truncate flex-1 mr-2 font-medium">{prop.address}</span>
                      <span className={`font-bold ${
                        prop.healthScore >= 80 ? 'text-green-600' :
                        prop.healthScore >= 50 ? 'text-amber-600' : 'text-red-600'
                      }`}>
                        {prop.healthScore}
                      </span>
                    </div>
                  ))}
              </>
            ) : (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Agent Activity Summary */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Bot className="h-5 w-5" style={{ color: '#791E75' }} />
              Agent Activity (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {agentActivity ? (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">{agentActivity.totalActions}</span>
                  <span className="text-sm text-muted-foreground">total actions</span>
                </div>
                {Object.entries(agentActivity.byAgent).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No agent activity recorded.</p>
                ) : (
                  Object.entries(agentActivity.byAgent).slice(0, 5).map(([agentType, data]) => (
                    <div key={agentType} className="flex items-center justify-between py-1.5 border-b last:border-0 text-sm">
                      <div>
                        <span className="font-medium capitalize">{agentType.replace(/_/g, ' ')}</span>
                        {data.topActions[0] && (
                          <span className="text-muted-foreground ml-1 text-xs">
                            (top: {data.topActions[0].action})
                          </span>
                        )}
                      </div>
                      <Badge variant="outline">{data.totalActions}</Badge>
                    </div>
                  ))
                )}
              </>
            ) : (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </CardContent>
        </Card>
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

      {/* Managed Properties Overview */}
      {(summary?.dormantProperties ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="flex items-center justify-between py-3 px-4">
            <div className="flex items-center gap-3">
              <Home className="h-5 w-5 text-amber-700" />
              <div>
                <p className="text-sm font-medium">
                  <span className="text-amber-800">{summary?.dormantProperties}</span>
                  <span className="text-muted-foreground"> of {summary?.totalManagedProperties} managed properties are </span>
                  <span className="text-amber-800 font-semibold">dormant</span>
                  <span className="text-muted-foreground"> (vacant, no active tenancy)</span>
                </p>
              </div>
            </div>
            <Link href="/crm/landlord-directory">
              <Button variant="outline" size="sm" className="text-amber-800 border-amber-300 hover:bg-amber-100">
                View Directory <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

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
