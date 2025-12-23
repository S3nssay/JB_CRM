import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3, TrendingUp, TrendingDown, Home, Users, DollarSign,
  Calendar, Clock, CheckCircle, Eye, Phone, Mail, ArrowUpRight,
  ArrowDownRight, Building2, Wrench, FileText, Download, RefreshCw, ArrowLeft,
  MessageSquare, Activity
} from 'lucide-react';

// Simple chart components using divs
const BarChartSimple = ({ data, title }: { data: { label: string; value: number; color?: string }[]; title: string }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-gray-600">{title}</h4>}
      {data.map((item, index) => (
        <div key={index} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{item.label}</span>
            <span className="font-medium">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${item.color || 'bg-blue-500'}`}
              style={{ width: `${Math.min((item.value / maxValue) * 100, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

const LineChartSimple = ({ data, title }: { data: { label: string; value: number }[]; title: string }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-gray-600">{title}</h4>}
      <div className="flex items-end justify-between h-32 gap-1">
        {data.map((item, index) => (
          <div key={index} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-blue-500 rounded-t"
              style={{ height: `${((item.value - minValue) / range) * 100}%`, minHeight: '4px' }}
            />
            <span className="text-xs text-gray-500 mt-1">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const DonutChart = ({ data, title }: { data: { label: string; value: number; color: string }[]; title: string }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercent = 0;

  return (
    <div className="space-y-3">
      {title && <h4 className="text-sm font-medium text-gray-600">{title}</h4>}
      <div className="flex items-center gap-4">
        <div className="relative w-24 h-24">
          <svg viewBox="0 0 36 36" className="w-24 h-24 transform -rotate-90">
            {data.map((item, index) => {
              const percent = total > 0 ? (item.value / total) * 100 : 0;
              const strokeDasharray = `${percent} ${100 - percent}`;
              const strokeDashoffset = -cumulativePercent;
              cumulativePercent += percent;

              return (
                <circle
                  key={index}
                  cx="18"
                  cy="18"
                  r="15.9155"
                  fill="none"
                  stroke={item.color}
                  strokeWidth="3"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold">{total}</span>
          </div>
        </div>
        <div className="flex-1 space-y-1">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between text-sm">
              <div className="flex items-center">
                <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
              </div>
              <span className="font-medium">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// KPI Card Component
const KPICard = ({ title, value, change, changeType, icon: Icon, subtitle, isLoading }: {
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: any;
  subtitle?: string;
  isLoading?: boolean;
}) => (
  <Card>
    <CardContent className="p-6">
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {change !== undefined && (
              <div className={`flex items-center mt-1 text-sm ${changeType === 'increase' ? 'text-green-600' :
                changeType === 'decrease' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                {changeType === 'increase' ? (
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                ) : changeType === 'decrease' ? (
                  <ArrowDownRight className="h-4 w-4 mr-1" />
                ) : null}
                {change > 0 ? '+' : ''}{change}% from last month
              </div>
            )}
            {subtitle && (
              <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            )}
          </div>
          <div className="p-3 rounded-full bg-gray-100">
            <Icon className="h-6 w-6 text-gray-600" />
          </div>
        </div>
      )}
    </CardContent>
  </Card>
);

// Agent Leaderboard Component
const AgentLeaderboard = ({ agents, isLoading }: { agents: any[]; isLoading: boolean }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Agent Leaderboard</CardTitle>
        <CardDescription>Top performing agents this month</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {agents.slice(0, 5).map((agent, index) => (
              <div key={agent.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-200 text-gray-700' :
                      index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                    }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-gray-500">{agent.department || 'Agent'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold">{(agent.metrics?.propertiesSold || 0) + (agent.metrics?.propertiesListed || 0)} deals</p>
                  <p className="text-sm text-green-600">£{(agent.metrics?.revenue || 0).toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  // Fetch KPIs from backend
  const { data: kpis, isLoading: kpisLoading, refetch: refetchKpis } = useQuery({
    queryKey: ['/api/crm/analytics/kpis', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/crm/analytics/kpis?period=${timeRange}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      return res.json();
    }
  });

  // Fetch property analytics
  const { data: propertyAnalytics, isLoading: propertiesLoading } = useQuery({
    queryKey: ['/api/crm/analytics/properties', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/crm/analytics/properties?period=${timeRange}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch property analytics');
      return res.json();
    }
  });

  // Fetch agent analytics
  const { data: agentAnalytics, isLoading: agentsLoading } = useQuery({
    queryKey: ['/api/crm/analytics/agents', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/crm/analytics/agents?period=${timeRange}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch agent analytics');
      return res.json();
    }
  });

  // Fetch communication analytics
  const { data: commAnalytics, isLoading: commLoading } = useQuery({
    queryKey: ['/api/crm/analytics/communications', timeRange],
    queryFn: async () => {
      const res = await fetch(`/api/crm/analytics/communications?period=${timeRange}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch communication analytics');
      return res.json();
    }
  });

  // Fetch portal analytics
  const { data: portalAnalytics, isLoading: portalsLoading } = useQuery({
    queryKey: ['/api/crm/analytics/portals'],
    queryFn: async () => {
      const res = await fetch('/api/crm/analytics/portals', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch portal analytics');
      return res.json();
    }
  });

  // Fetch maintenance tickets
  const { data: maintenanceTickets, isLoading: ticketsLoading } = useQuery({
    queryKey: ['/api/crm/maintenance/tickets'],
    queryFn: async () => {
      const res = await fetch('/api/crm/maintenance/tickets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tickets');
      return res.json();
    }
  });

  // Process property status data for donut chart
  const propertyStatusData = propertyAnalytics ? propertyAnalytics.map((item: any) => ({
    label: item.group.charAt(0).toUpperCase() + item.group.slice(1),
    value: item.count,
    color: item.group === 'active' ? '#22c55e' :
      item.group === 'under_offer' ? '#f59e0b' :
        item.group === 'sold' ? '#3b82f6' :
          item.group === 'let' ? '#8b5cf6' :
            '#ef4444'
  })) : [];

  // Process maintenance tickets for category chart
  const maintenanceByCategory = maintenanceTickets ?
    Object.entries(
      (maintenanceTickets as any[]).reduce((acc: any, ticket: any) => {
        const category = ticket.category || 'general';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {})
    ).map(([category, count]) => ({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      value: count as number,
      color: category === 'plumbing' ? 'bg-blue-500' :
        category === 'electrical' ? 'bg-yellow-500' :
          category === 'heating' ? 'bg-red-500' :
            category === 'appliance' ? 'bg-purple-500' :
              'bg-gray-500'
    })) : [];

  // Process ticket status for donut chart
  const ticketStatusData = maintenanceTickets ?
    Object.entries(
      (maintenanceTickets as any[]).reduce((acc: any, ticket: any) => {
        const status = ticket.status || 'open';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {})
    ).map(([status, count]) => ({
      label: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      value: count as number,
      color: status === 'open' ? '#ef4444' :
        status === 'in_progress' ? '#f59e0b' :
          status === 'completed' || status === 'resolved' ? '#22c55e' :
            '#6b7280'
    })) : [];

  const handleRefresh = () => {
    refetchKpis();
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `£${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `£${(value / 1000).toFixed(0)}K`;
    return `£${value.toLocaleString()}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/portal">
                <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <BarChart3 className="h-8 w-8 text-[#791E75] mr-3" />
              <h1 className="text-xl font-semibold">Analytics Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last 7 days</SelectItem>
                  <SelectItem value="month">Last 30 days</SelectItem>
                  <SelectItem value="quarter">Last 90 days</SelectItem>
                  <SelectItem value="year">Last 12 months</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button size="sm">
                <Download className="h-4 w-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* KPI Cards - Row 1 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Total Revenue"
            value={formatCurrency(kpis?.revenue?.estimatedCommission || 0)}
            icon={DollarSign}
            subtitle="Estimated Commission"
            isLoading={kpisLoading}
          />
          <KPICard
            title="Properties Listed"
            value={kpis?.properties?.total || 0}
            icon={Home}
            subtitle={`${kpis?.properties?.active || 0} active`}
            isLoading={kpisLoading}
          />
          <KPICard
            title="Deals Closed"
            value={(kpis?.properties?.sold || 0) + (kpis?.properties?.let || 0)}
            icon={CheckCircle}
            subtitle={`${kpis?.properties?.sold || 0} sold, ${kpis?.properties?.let || 0} let`}
            isLoading={kpisLoading}
          />
          <KPICard
            title="Avg Days on Market"
            value={kpis?.performance?.averageDaysOnMarket || '-'}
            icon={Clock}
            subtitle="Lower is better"
            isLoading={kpisLoading}
          />
        </div>

        {/* KPI Cards - Row 2 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <KPICard
            title="Active Properties"
            value={kpis?.properties?.active || 0}
            icon={Eye}
            subtitle="Currently listed"
            isLoading={kpisLoading}
          />
          <KPICard
            title="Total Interactions"
            value={commAnalytics?.totals?.totalInteractions || 0}
            icon={MessageSquare}
            subtitle="All channels"
            isLoading={commLoading}
          />
          <KPICard
            title="Open Tickets"
            value={maintenanceTickets?.filter((t: any) => t.status === 'open' || t.status === 'in_progress').length || 0}
            icon={Wrench}
            subtitle="Requires attention"
            isLoading={ticketsLoading}
          />
          <KPICard
            title="Response Rate"
            value={`${commAnalytics?.totals?.responseRate || 0}%`}
            icon={Phone}
            subtitle={commAnalytics?.totals?.avgResponseTime || 'Avg response time'}
            isLoading={commLoading}
          />
        </div>


        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="properties">Properties</TabsTrigger>
            <TabsTrigger value="agents">Agents</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Property Status */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Property Portfolio</CardTitle>
                  <CardDescription>Current portfolio breakdown by status</CardDescription>
                </CardHeader>
                <CardContent>
                  {propertiesLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <div className="grid grid-cols-2 gap-6">
                      <DonutChart data={propertyStatusData} title="" />
                      <div className="space-y-4">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <p className="text-sm text-green-600">Active Listings</p>
                          <p className="text-2xl font-bold text-green-700">{kpis?.properties?.active || 0}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-lg">
                          <p className="text-sm text-blue-600">Sold/Let</p>
                          <p className="text-2xl font-bold text-blue-700">{(kpis?.properties?.sold || 0) + (kpis?.properties?.let || 0)}</p>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <p className="text-sm text-gray-600">Total Portfolio</p>
                          <p className="text-2xl font-bold text-gray-700">{kpis?.properties?.total || 0}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Communication Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Communications</CardTitle>
                  <CardDescription>Channel performance</CardDescription>
                </CardHeader>
                <CardContent>
                  {commLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <Phone className="h-5 w-5 text-blue-500 mr-3" />
                          <span className="text-sm">Phone Calls</span>
                        </div>
                        <span className="font-bold">{commAnalytics?.phone?.totalCalls || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <MessageSquare className="h-5 w-5 text-green-500 mr-3" />
                          <span className="text-sm">WhatsApp</span>
                        </div>
                        <span className="font-bold">{commAnalytics?.whatsapp?.totalMessages || 0}</span>
                      </div>
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center">
                          <Mail className="h-5 w-5 text-purple-500 mr-3" />
                          <span className="text-sm">Emails</span>
                        </div>
                        <span className="font-bold">{commAnalytics?.email?.sent || 0}</span>
                      </div>
                      <div className="pt-3 border-t">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500">Response Rate</span>
                          <span className="font-medium text-green-600">{commAnalytics?.totals?.responseRate || 94}%</span>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Agent Leaderboard */}
              <div className="lg:col-span-2">
                <AgentLeaderboard agents={agentAnalytics || []} isLoading={agentsLoading} />
              </div>

              {/* Portal Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Portal Performance</CardTitle>
                  <CardDescription>Syndication metrics</CardDescription>
                </CardHeader>
                <CardContent>
                  {portalsLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <div className="space-y-3">
                      {(portalAnalytics || []).map((portal: any, index: number) => (
                        <div key={index} className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-medium">{portal.portal}</span>
                            <Badge variant={portal.isActive ? 'default' : 'secondary'}>
                              {portal.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <div className="flex justify-between text-sm text-gray-500">
                            <span>{portal.metrics?.totalListings || 0} listings</span>
                            <span>{portal.metrics?.totalViews || 0} views</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Properties Tab */}
          <TabsContent value="properties">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Properties by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {propertiesLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <BarChartSimple
                      data={(propertyAnalytics || []).map((item: any) => ({
                        label: item.group?.charAt(0).toUpperCase() + item.group?.slice(1) || 'Unknown',
                        value: item.count,
                        color: item.group === 'active' ? 'bg-green-500' :
                          item.group === 'sold' ? 'bg-blue-500' :
                            item.group === 'let' ? 'bg-purple-500' :
                              'bg-gray-500'
                      }))}
                      title=""
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Average Price by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {propertiesLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <BarChartSimple
                      data={(propertyAnalytics || []).map((item: any) => ({
                        label: item.group?.charAt(0).toUpperCase() + item.group?.slice(1) || 'Unknown',
                        value: Math.round((item.averagePrice || 0) / 100),
                        color: 'bg-blue-500'
                      }))}
                      title=""
                    />
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Portfolio Summary</CardTitle>
                  <CardDescription>Complete property breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium">Status</th>
                          <th className="text-left p-3 font-medium">Count</th>
                          <th className="text-left p-3 font-medium">Total Value</th>
                          <th className="text-left p-3 font-medium">Avg Price</th>
                          <th className="text-left p-3 font-medium">Avg Bedrooms</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(propertyAnalytics || []).map((item: any, index: number) => (
                          <tr key={index} className="border-b hover:bg-gray-50">
                            <td className="p-3">
                              <Badge variant={item.group === 'active' ? 'default' : 'secondary'}>
                                {item.group?.charAt(0).toUpperCase() + item.group?.slice(1)}
                              </Badge>
                            </td>
                            <td className="p-3 font-medium">{item.count}</td>
                            <td className="p-3">{formatCurrency(item.totalValue / 100)}</td>
                            <td className="p-3">{formatCurrency(item.averagePrice / 100)}</td>
                            <td className="p-3">{item.avgBedrooms?.toFixed(1) || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <AgentLeaderboard agents={agentAnalytics || []} isLoading={agentsLoading} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Team Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Active Agents</span>
                        <span className="text-sm font-bold">{agentAnalytics?.length || 0}</span>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Avg Deals per Agent</span>
                        <span className="text-sm font-bold">
                          {agentAnalytics?.length > 0
                            ? (agentAnalytics.reduce((sum: number, a: any) =>
                              sum + (a.metrics?.propertiesSold || 0), 0) / agentAnalytics.length).toFixed(1)
                            : '0'}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Avg Response Time</span>
                        <span className="text-sm font-bold">
                          {agentAnalytics?.length > 0
                            ? Math.round(agentAnalytics.reduce((sum: number, a: any) =>
                              sum + (a.metrics?.avgResponseTime || 0), 0) / agentAnalytics.length) + 'min'
                            : '-'}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Avg Customer Rating</span>
                        <span className="text-sm font-bold">
                          {agentAnalytics?.length > 0
                            ? (agentAnalytics.reduce((sum: number, a: any) =>
                              sum + parseFloat(a.metrics?.customerRating || '0'), 0) / agentAnalytics.length).toFixed(1) + '/5'
                            : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-lg">Agent Activity</CardTitle>
                  <CardDescription>Performance breakdown by agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="text-left p-3 font-medium">Agent</th>
                          <th className="text-left p-3 font-medium">Department</th>
                          <th className="text-left p-3 font-medium">Listed</th>
                          <th className="text-left p-3 font-medium">Sold</th>
                          <th className="text-left p-3 font-medium">Viewings</th>
                          <th className="text-left p-3 font-medium">Enquiries</th>
                          <th className="text-left p-3 font-medium">Revenue</th>
                          <th className="text-left p-3 font-medium">Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(agentAnalytics || []).map((agent: any, index: number) => (
                          <tr key={agent.id || index} className="border-b hover:bg-gray-50">
                            <td className="p-3 font-medium">{agent.name}</td>
                            <td className="p-3">{agent.department || '-'}</td>
                            <td className="p-3">{agent.metrics?.propertiesListed || 0}</td>
                            <td className="p-3">{agent.metrics?.propertiesSold || 0}</td>
                            <td className="p-3">{agent.metrics?.viewingsConducted || 0}</td>
                            <td className="p-3">{agent.metrics?.enquiriesHandled || 0}</td>
                            <td className="p-3 text-green-600 font-medium">
                              £{(agent.metrics?.revenue || 0).toLocaleString()}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline">{agent.metrics?.customerRating || '-'}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Maintenance Tab */}
          <TabsContent value="maintenance">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tickets by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <BarChartSimple data={maintenanceByCategory} title="" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ticket Status</CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <DonutChart data={ticketStatusData} title="" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ticket Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-red-50 rounded-lg">
                      <p className="text-sm text-red-600">Open</p>
                      <p className="text-2xl font-bold text-red-700">
                        {maintenanceTickets?.filter((t: any) => t.status === 'open').length || 0}
                      </p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-600">In Progress</p>
                      <p className="text-2xl font-bold text-yellow-700">
                        {maintenanceTickets?.filter((t: any) => t.status === 'in_progress').length || 0}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Completed</p>
                      <p className="text-2xl font-bold text-green-700">
                        {maintenanceTickets?.filter((t: any) => t.status === 'completed' || t.status === 'resolved').length || 0}
                      </p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Total</p>
                      <p className="text-2xl font-bold text-gray-700">
                        {maintenanceTickets?.length || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Priority Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  {ticketsLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <div className="space-y-3">
                      {['emergency', 'high', 'medium', 'low'].map((priority) => {
                        const count = maintenanceTickets?.filter((t: any) => t.priority === priority).length || 0;
                        const total = maintenanceTickets?.length || 1;
                        return (
                          <div key={priority} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="capitalize">{priority}</span>
                              <span className="font-medium">{count}</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${priority === 'emergency' ? 'bg-red-500' :
                                  priority === 'high' ? 'bg-orange-500' :
                                    priority === 'medium' ? 'bg-yellow-500' :
                                      'bg-green-500'
                                  }`}
                                style={{ width: `${(count / total) * 100}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Financial Tab */}
          <TabsContent value="financial">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle className="text-lg">Financial Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-600">Total Sales Value</p>
                      <p className="text-2xl font-bold text-blue-700">
                        {formatCurrency((kpis?.revenue?.totalSalesValue || 0) / 100)}
                      </p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <p className="text-sm text-green-600">Est. Commission</p>
                      <p className="text-2xl font-bold text-green-700">
                        {formatCurrency((kpis?.revenue?.estimatedCommission || 0) / 100)}
                      </p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <p className="text-sm text-purple-600">Avg Property Price</p>
                      <p className="text-2xl font-bold text-purple-700">
                        {formatCurrency((kpis?.revenue?.avgPropertyPrice || kpis?.properties?.averagePrice || 0) / 100)}
                      </p>
                    </div>
                    <div className="p-4 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-yellow-600">Properties Sold</p>
                      <p className="text-2xl font-bold text-yellow-700">
                        {kpis?.properties?.sold || 0}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Revenue by Property Type</CardTitle>
                </CardHeader>
                <CardContent>
                  {propertiesLoading ? (
                    <Skeleton className="h-48 w-full" />
                  ) : (
                    <BarChartSimple
                      data={(propertyAnalytics || [])
                        .filter((item: any) => item.group === 'sold' || item.group === 'let')
                        .map((item: any) => ({
                          label: item.group === 'sold' ? 'Sales' : 'Lettings',
                          value: Math.round(item.totalValue / 100),
                          color: item.group === 'sold' ? 'bg-blue-500' : 'bg-green-500'
                        }))}
                      title=""
                    />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Portfolio Value</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {(propertyAnalytics || []).map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm capitalize">{item.group}</span>
                        <span className="text-sm font-medium">{formatCurrency(item.totalValue / 100)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
