import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  MessageSquare, AlertTriangle, BarChart3, FileText,
  Clock, RefreshCw, ChevronLeft, ChevronRight, CheckCircle2,
  Wrench, Bot, ArrowUpRight, ArrowDownLeft,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// --- Types ---

interface Conversation {
  id: number;
  contact_name: string;
  contact_email?: string;
  contact_phone?: string;
  agent_type: string;
  last_channel: string;
  status: string;
  priority: string;
  last_message_at: string;
  last_message_preview: string;
  assigned_to_id?: number;
  created_at: string;
}

interface TimelineEntry {
  type: 'message' | 'audit';
  timestamp: string;
  data: any;
}

interface Escalation {
  id: number;
  contactName: string;
  priority: string;
  agentType: string;
  reason: string;
  assignedToId?: number;
  escalationAt: string;
  timeWaiting: string;
  waitingMs: number;
}

interface AgentMetric {
  agent_type: string;
  conversation_count: string;
  total_actions: string;
  escalation_count: string;
  avg_duration_ms: string;
  tool_call_count: string;
}

interface ToolUsage {
  tool_name: string;
  usage_count: string;
}

interface AuditEntry {
  id: number;
  conversation_id?: number;
  agent_type: string;
  action: string;
  tool_name?: string;
  tool_input?: any;
  tool_output?: any;
  reasoning?: string;
  duration_ms?: number;
  channel?: string;
  error?: string;
  created_at: string;
}

// --- Helpers ---

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

function channelBadge(channel: string) {
  const colors: Record<string, string> = {
    sms: 'bg-blue-100 text-blue-700',
    whatsapp: 'bg-green-100 text-green-700',
    email: 'bg-purple-100 text-purple-700',
    phone: 'bg-orange-100 text-orange-700',
  };
  return <Badge variant="outline" className={`text-[11px] ${colors[channel] || 'bg-gray-100 text-gray-600'}`}>{channel}</Badge>;
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    pending: 'bg-yellow-100 text-yellow-700',
    resolved: 'bg-green-100 text-green-700',
    closed: 'bg-gray-100 text-gray-600',
  };
  return <Badge variant="outline" className={`text-[11px] ${colors[status] || 'bg-gray-100 text-gray-600'}`}>{status}</Badge>;
}

function priorityBadge(priority: string) {
  const colors: Record<string, string> = {
    urgent: 'bg-red-100 text-red-700 border-red-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    normal: 'bg-gray-100 text-gray-600',
    low: 'bg-gray-50 text-gray-500',
  };
  return <Badge variant="outline" className={`text-[11px] ${colors[priority] || ''}`}>{priority}</Badge>;
}

function actionBadge(action: string) {
  const colors: Record<string, string> = {
    classify: 'bg-indigo-100 text-indigo-700',
    route: 'bg-cyan-100 text-cyan-700',
    tool_call: 'bg-amber-100 text-amber-700',
    respond: 'bg-green-100 text-green-700',
    escalate: 'bg-red-100 text-red-700',
    identify_ai: 'bg-purple-100 text-purple-700',
  };
  return <Badge variant="outline" className={`text-[11px] ${colors[action] || 'bg-gray-100 text-gray-600'}`}>{action}</Badge>;
}

// --- Pagination Component ---

function Pagination({ page, total, limit, onPageChange }: { page: number; total: number; limit: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between mt-3 text-sm text-gray-500">
      <span>{total} total</span>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span>Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// --- Main Component ---

export default function AgentMonitoringDashboard() {
  // Filter state
  const [convFilters, setConvFilters] = useState({ page: 1, channel: '', agentType: '', status: '', dateFrom: '', dateTo: '' });
  const [auditFilters, setAuditFilters] = useState({ page: 1, agentType: '', action: '', dateFrom: '', dateTo: '' });
  const [metricsDateFrom, setMetricsDateFrom] = useState('');
  const [metricsDateTo, setMetricsDateTo] = useState('');

  // Thread dialog
  const [threadConvId, setThreadConvId] = useState<number | null>(null);
  const [expandedAudit, setExpandedAudit] = useState<number | null>(null);

  // Build query params
  const convParams = new URLSearchParams();
  convParams.set('page', String(convFilters.page));
  convParams.set('limit', '20');
  if (convFilters.channel) convParams.set('channel', convFilters.channel);
  if (convFilters.agentType) convParams.set('agentType', convFilters.agentType);
  if (convFilters.status) convParams.set('status', convFilters.status);
  if (convFilters.dateFrom) convParams.set('dateFrom', convFilters.dateFrom);
  if (convFilters.dateTo) convParams.set('dateTo', convFilters.dateTo);

  const auditParams = new URLSearchParams();
  auditParams.set('page', String(auditFilters.page));
  auditParams.set('limit', '50');
  if (auditFilters.agentType) auditParams.set('agentType', auditFilters.agentType);
  if (auditFilters.action) auditParams.set('action', auditFilters.action);
  if (auditFilters.dateFrom) auditParams.set('dateFrom', auditFilters.dateFrom);
  if (auditFilters.dateTo) auditParams.set('dateTo', auditFilters.dateTo);

  const metricsParams = new URLSearchParams();
  if (metricsDateFrom) metricsParams.set('dateFrom', metricsDateFrom);
  if (metricsDateTo) metricsParams.set('dateTo', metricsDateTo);

  // Queries
  const conversationsQuery = useQuery<{ conversations: Conversation[]; total: number; page: number; limit: number }>({
    queryKey: ['/api/crm/agent-monitoring/conversations', convParams.toString()],
    queryFn: () => apiRequest('GET', `/api/crm/agent-monitoring/conversations?${convParams.toString()}`).then(r => r.json()),
  });

  const escalationsQuery = useQuery<{ escalations: Escalation[]; count: number }>({
    queryKey: ['/api/crm/agent-monitoring/escalations'],
    queryFn: () => apiRequest('GET', '/api/crm/agent-monitoring/escalations').then(r => r.json()),
    refetchInterval: 30000,
  });

  const metricsQuery = useQuery<{ agents: AgentMetric[]; topTools: ToolUsage[]; period: { from: string; to: string } }>({
    queryKey: ['/api/crm/agent-monitoring/metrics', metricsParams.toString()],
    queryFn: () => apiRequest('GET', `/api/crm/agent-monitoring/metrics?${metricsParams.toString()}`).then(r => r.json()),
  });

  const auditQuery = useQuery<{ entries: AuditEntry[]; total: number; page: number; limit: number }>({
    queryKey: ['/api/crm/agent-monitoring/audit-log', auditParams.toString()],
    queryFn: () => apiRequest('GET', `/api/crm/agent-monitoring/audit-log?${auditParams.toString()}`).then(r => r.json()),
  });

  const threadQuery = useQuery<{ conversation: any; timeline: TimelineEntry[] }>({
    queryKey: ['/api/crm/agent-monitoring/conversations', threadConvId, 'thread'],
    queryFn: () => apiRequest('GET', `/api/crm/agent-monitoring/conversations/${threadConvId}/thread`).then(r => r.json()),
    enabled: !!threadConvId,
  });

  // Summary cards data
  const totalConversations = conversationsQuery.data?.total || 0;
  const activeEscalations = escalationsQuery.data?.count || 0;
  const avgResponseTime = metricsQuery.data?.agents
    ? (metricsQuery.data.agents.reduce((sum, a) => sum + parseFloat(a.avg_duration_ms || '0'), 0) /
      Math.max(1, metricsQuery.data.agents.length)).toFixed(0)
    : '0';
  const totalActions = metricsQuery.data?.agents
    ? metricsQuery.data.agents.reduce((sum, a) => sum + parseInt(a.total_actions || '0'), 0)
    : 0;

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agent Monitoring</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor AI agent conversations, escalations, and performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          conversationsQuery.refetch();
          escalationsQuery.refetch();
          metricsQuery.refetch();
          auditQuery.refetch();
        }}>
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#791E75]/10 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-[#791E75]" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Conversations</p>
              <p className="text-xl font-bold">{totalConversations}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Escalations</p>
              <p className="text-xl font-bold">{activeEscalations}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Avg Response</p>
              <p className="text-xl font-bold">{avgResponseTime}ms</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total Actions</p>
              <p className="text-xl font-bold">{totalActions}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations"><MessageSquare className="h-4 w-4 mr-1.5" /> Conversations</TabsTrigger>
          <TabsTrigger value="escalations"><AlertTriangle className="h-4 w-4 mr-1.5" /> Escalations</TabsTrigger>
          <TabsTrigger value="metrics"><BarChart3 className="h-4 w-4 mr-1.5" /> Metrics</TabsTrigger>
          <TabsTrigger value="audit"><FileText className="h-4 w-4 mr-1.5" /> Audit Log</TabsTrigger>
        </TabsList>

        {/* ---- Conversations Tab ---- */}
        <TabsContent value="conversations" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={convFilters.channel} onValueChange={(v) => setConvFilters(f => ({ ...f, channel: v === 'all' ? '' : v, page: 1 }))}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Channel" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="phone">Phone</SelectItem>
              </SelectContent>
            </Select>
            <Select value={convFilters.agentType} onValueChange={(v) => setConvFilters(f => ({ ...f, agentType: v === 'all' ? '' : v, page: 1 }))}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Agent Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="rental">Lettings</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="office_admin">Admin</SelectItem>
                <SelectItem value="arrears">Arrears</SelectItem>
              </SelectContent>
            </Select>
            <Select value={convFilters.status} onValueChange={(v) => setConvFilters(f => ({ ...f, status: v === 'all' ? '' : v, page: 1 }))}>
              <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-[150px]" placeholder="From" value={convFilters.dateFrom}
              onChange={(e) => setConvFilters(f => ({ ...f, dateFrom: e.target.value, page: 1 }))} />
            <Input type="date" className="w-[150px]" placeholder="To" value={convFilters.dateTo}
              onChange={(e) => setConvFilters(f => ({ ...f, dateTo: e.target.value, page: 1 }))} />
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Message</TableHead>
                  <TableHead>Last Activity</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversationsQuery.data?.conversations?.map((conv) => (
                  <TableRow key={conv.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setThreadConvId(conv.id)}>
                    <TableCell className="font-medium">{conv.contact_name || 'Unknown'}</TableCell>
                    <TableCell>{conv.agent_type || '-'}</TableCell>
                    <TableCell>{channelBadge(conv.last_channel || 'unknown')}</TableCell>
                    <TableCell>{statusBadge(conv.status)}</TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-gray-500">{conv.last_message_preview || '-'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{formatDateTime(conv.last_message_at)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setThreadConvId(conv.id); }}>
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(!conversationsQuery.data?.conversations?.length) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                      {conversationsQuery.isLoading ? 'Loading...' : 'No conversations found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {conversationsQuery.data && (
              <div className="px-4 pb-3">
                <Pagination page={convFilters.page} total={conversationsQuery.data.total} limit={20}
                  onPageChange={(p) => setConvFilters(f => ({ ...f, page: p }))} />
              </div>
            )}
          </Card>
        </TabsContent>

        {/* ---- Escalations Tab ---- */}
        <TabsContent value="escalations" className="space-y-4">
          {escalationsQuery.data?.escalations?.length === 0 ? (
            <Card>
              <CardContent className="p-12 flex flex-col items-center text-center">
                <CheckCircle2 className="h-12 w-12 text-green-400 mb-3" />
                <h3 className="text-lg font-medium text-gray-700">No pending escalations</h3>
                <p className="text-sm text-gray-400 mt-1">All agent conversations are running smoothly</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Agent</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Urgency</TableHead>
                    <TableHead>Waiting</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalationsQuery.data?.escalations?.map((esc) => (
                    <TableRow key={esc.id}>
                      <TableCell className="font-medium">{esc.contactName}</TableCell>
                      <TableCell>{esc.agentType || '-'}</TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm">{esc.reason}</TableCell>
                      <TableCell>{priorityBadge(esc.priority)}</TableCell>
                      <TableCell className="text-sm font-medium">
                        <span className={esc.priority === 'urgent' ? 'text-red-600' : 'text-orange-600'}>
                          {esc.timeWaiting}
                        </span>
                      </TableCell>
                      <TableCell>{esc.assignedToId ? `Staff #${esc.assignedToId}` : <span className="text-gray-400">Unassigned</span>}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => setThreadConvId(esc.id)}>
                          View Thread
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ---- Metrics Tab ---- */}
        <TabsContent value="metrics" className="space-y-4">
          {/* Date filter */}
          <div className="flex gap-3 items-center">
            <span className="text-sm text-gray-500">Period:</span>
            <Input type="date" className="w-[150px]" value={metricsDateFrom}
              onChange={(e) => setMetricsDateFrom(e.target.value)} />
            <span className="text-sm text-gray-400">to</span>
            <Input type="date" className="w-[150px]" value={metricsDateTo}
              onChange={(e) => setMetricsDateTo(e.target.value)} />
          </div>

          {/* Per-agent cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {metricsQuery.data?.agents?.map((agent) => {
              const convCount = parseInt(agent.conversation_count || '0');
              const escCount = parseInt(agent.escalation_count || '0');
              const escRate = convCount > 0 ? ((escCount / convCount) * 100).toFixed(1) : '0.0';
              const avgMs = parseFloat(agent.avg_duration_ms || '0').toFixed(0);
              const toolCalls = parseInt(agent.tool_call_count || '0');

              return (
                <Card key={agent.agent_type}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Bot className="h-4 w-4 text-[#791E75]" />
                      {agent.agent_type}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Conversations</span>
                      <span className="font-medium">{convCount}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Escalation Rate</span>
                      <span className={`font-medium ${parseFloat(escRate) > 20 ? 'text-red-600' : 'text-green-600'}`}>{escRate}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Avg Response</span>
                      <span className="font-medium">{avgMs}ms</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Tool Calls</span>
                      <span className="font-medium">{toolCalls}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total Actions</span>
                      <span className="font-medium">{parseInt(agent.total_actions || '0')}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {(!metricsQuery.data?.agents?.length) && (
              <div className="col-span-full text-center py-8 text-gray-400">
                {metricsQuery.isLoading ? 'Loading metrics...' : 'No agent metrics available'}
              </div>
            )}
          </div>

          {/* Top Tools */}
          {metricsQuery.data?.topTools?.length ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Wrench className="h-4 w-4" /> Top Tools Used
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {metricsQuery.data.topTools.map((tool) => {
                    const maxCount = parseInt(metricsQuery.data!.topTools[0]?.usage_count || '1');
                    const count = parseInt(tool.usage_count || '0');
                    const pct = Math.max(5, (count / maxCount) * 100);
                    return (
                      <div key={tool.tool_name} className="flex items-center gap-3">
                        <span className="text-sm w-[200px] truncate text-gray-600">{tool.tool_name}</span>
                        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                          <div className="h-full bg-[#791E75]/20 rounded" style={{ width: `${pct}%` }}>
                            <span className="text-[11px] text-[#791E75] font-medium pl-2 leading-5">{count}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        {/* ---- Audit Log Tab ---- */}
        <TabsContent value="audit" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select value={auditFilters.agentType} onValueChange={(v) => setAuditFilters(f => ({ ...f, agentType: v === 'all' ? '' : v, page: 1 }))}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Agent Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                <SelectItem value="supervisor">Supervisor</SelectItem>
                <SelectItem value="sales">Sales</SelectItem>
                <SelectItem value="rental">Lettings</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="office_admin">Admin</SelectItem>
                <SelectItem value="arrears">Arrears</SelectItem>
              </SelectContent>
            </Select>
            <Select value={auditFilters.action} onValueChange={(v) => setAuditFilters(f => ({ ...f, action: v === 'all' ? '' : v, page: 1 }))}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Action" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="classify">Classify</SelectItem>
                <SelectItem value="route">Route</SelectItem>
                <SelectItem value="tool_call">Tool Call</SelectItem>
                <SelectItem value="respond">Respond</SelectItem>
                <SelectItem value="escalate">Escalate</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" className="w-[150px]" value={auditFilters.dateFrom}
              onChange={(e) => setAuditFilters(f => ({ ...f, dateFrom: e.target.value, page: 1 }))} />
            <Input type="date" className="w-[150px]" value={auditFilters.dateTo}
              onChange={(e) => setAuditFilters(f => ({ ...f, dateTo: e.target.value, page: 1 }))} />
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Agent</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Channel</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Reasoning</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditQuery.data?.entries?.map((entry) => (
                  <>
                    <TableRow key={entry.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setExpandedAudit(expandedAudit === entry.id ? null : entry.id)}>
                      <TableCell className="text-sm text-gray-500">{formatDateTime(entry.created_at)}</TableCell>
                      <TableCell>{entry.agent_type}</TableCell>
                      <TableCell>{actionBadge(entry.action)}</TableCell>
                      <TableCell className="text-sm">{entry.tool_name || '-'}</TableCell>
                      <TableCell>{entry.channel ? channelBadge(entry.channel) : '-'}</TableCell>
                      <TableCell className="text-sm">{entry.duration_ms ? `${entry.duration_ms}ms` : '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-gray-500">{entry.reasoning || '-'}</TableCell>
                    </TableRow>
                    {expandedAudit === entry.id && (entry.tool_input || entry.tool_output || entry.error) && (
                      <TableRow key={`${entry.id}-detail`}>
                        <TableCell colSpan={7} className="bg-gray-50 p-4">
                          <div className="space-y-2 text-sm">
                            {entry.tool_input && (
                              <div>
                                <span className="font-medium text-gray-600">Tool Input:</span>
                                <pre className="mt-1 p-2 bg-white rounded border text-xs overflow-auto max-h-[200px]">
                                  {typeof entry.tool_input === 'string' ? entry.tool_input : JSON.stringify(entry.tool_input, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.tool_output && (
                              <div>
                                <span className="font-medium text-gray-600">Tool Output:</span>
                                <pre className="mt-1 p-2 bg-white rounded border text-xs overflow-auto max-h-[200px]">
                                  {typeof entry.tool_output === 'string' ? entry.tool_output : JSON.stringify(entry.tool_output, null, 2)}
                                </pre>
                              </div>
                            )}
                            {entry.error && (
                              <div>
                                <span className="font-medium text-red-600">Error:</span>
                                <pre className="mt-1 p-2 bg-red-50 rounded border border-red-200 text-xs text-red-700">{entry.error}</pre>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
                {(!auditQuery.data?.entries?.length) && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-400">
                      {auditQuery.isLoading ? 'Loading...' : 'No audit log entries found'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {auditQuery.data && (
              <div className="px-4 pb-3">
                <Pagination page={auditFilters.page} total={auditQuery.data.total} limit={50}
                  onPageChange={(p) => setAuditFilters(f => ({ ...f, page: p }))} />
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* ---- Thread Dialog ---- */}
      <Dialog open={!!threadConvId} onOpenChange={(open) => { if (!open) setThreadConvId(null); }}>
        <DialogContent className="max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversation Thread
              {threadQuery.data?.conversation && (
                <span className="text-sm font-normal text-gray-500 ml-2">
                  {threadQuery.data.conversation.contact_name} -- {threadQuery.data.conversation.agent_type}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-3 py-2">
              {threadQuery.data?.timeline?.map((entry, idx) => {
                if (entry.type === 'message') {
                  const msg = entry.data;
                  const isInbound = msg.direction === 'inbound';
                  return (
                    <div key={`msg-${idx}`} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[80%] rounded-lg p-3 ${isInbound ? 'bg-gray-100 text-gray-800' : 'bg-[#791E75] text-white'}`}>
                        <div className="flex items-center gap-1.5 mb-1">
                          {isInbound ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          <span className="text-[11px] opacity-75">
                            {msg.channel} -- {formatDateTime(entry.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                } else {
                  const audit = entry.data;
                  return (
                    <div key={`audit-${idx}`} className="mx-4">
                      <div className="bg-gray-50 border border-gray-200 rounded p-2.5 text-xs">
                        <div className="flex items-center gap-2 text-gray-500">
                          <Bot className="h-3 w-3" />
                          <span className="font-medium">{audit.agent_type}</span>
                          {actionBadge(audit.action)}
                          {audit.tool_name && <span className="text-gray-400">{audit.tool_name}</span>}
                          <span className="ml-auto text-gray-400">{formatDateTime(entry.timestamp)}</span>
                        </div>
                        {audit.reasoning && <p className="mt-1 text-gray-600">{audit.reasoning}</p>}
                        {audit.tool_input && (
                          <pre className="mt-1 p-1.5 bg-white rounded text-[10px] overflow-auto max-h-[100px]">
                            {typeof audit.tool_input === 'string' ? audit.tool_input : JSON.stringify(audit.tool_input, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                }
              })}
              {threadQuery.isLoading && <p className="text-center text-gray-400 py-4">Loading thread...</p>}
              {!threadQuery.isLoading && !threadQuery.data?.timeline?.length && (
                <p className="text-center text-gray-400 py-4">No messages or audit entries</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
