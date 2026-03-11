import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  Building, PoundSterling, ShieldCheck, AlertTriangle,
  Clock, CalendarClock, ArrowRight, Loader2, ShieldAlert,
  CheckCircle, Wrench, FileText, Banknote, ListTodo,
  ChevronRight, Mail, Upload, ClipboardList, Play,
  Bot, RefreshCw, Zap, CreditCard, ArrowUpDown, ArrowUp, ArrowDown,
  Send, MessageSquare, RotateCcw, X, Eye, Home, Search,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

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
  openMaintenanceTickets: number;
}

interface ActionItem {
  id: string;
  type: string;
  icon: string;
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  entity: string;
  entityType: string;
  entityId: number;
  dueDate: string | null;
  link: string;
}

interface ActionQueueResponse {
  items: ActionItem[];
  counts: { total: number; high: number; medium: number; low: number };
}

interface EndOfTenancyItem {
  id: number;
  propertyAddress: string;
  tenantName: string;
  landlordName: string;
  endDate: string;
  daysRemaining: number;
  checklistTotal: number;
  checklistCompleted: number;
  status: string;
}

interface MaintenanceItem {
  id: number;
  title: string;
  urgency: string;
  status: string;
  propertyAddress: string;
  createdAt: string;
}

interface AgentRun {
  id: number;
  agent_type: string;
  status: 'running' | 'completed' | 'failed';
  triggered_by: string;
  started_at: string;
  completed_at: string | null;
  steps_completed: number;
  steps_total: number;
  log: { step: number; action: string; status: string; message: string; timestamp: string }[];
  payments_matched: number;
  receipts_generated: number;
  receipts_sent: number;
  charges_processed: number;
  statements_generated: number;
  statements_sent: number;
  landlord_payments_prepared: number;
  total_rent_processed: number;
  total_commission: number;
  total_charges: number;
  total_net_payable: number;
  error_count: number;
}

interface PaymentSource {
  goCardlessConfigured: boolean;
  paymentSource: 'gocardless' | 'bank_csv';
  unmatchedBankTransactions: number;
}

// --- Helpers ---

const BRAND = '#791E75';

function formatCurrency(pence: number): string {
  return `\u00A3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try { return format(new Date(dateStr), 'dd MMM yyyy'); } catch { return '-'; }
}

function getActionIcon(icon: string) {
  const cls = 'h-4 w-4';
  switch (icon) {
    case 'pound': return <PoundSterling className={cls} />;
    case 'shield': return <ShieldCheck className={cls} />;
    case 'certificate': return <ShieldAlert className={cls} />;
    case 'calendar': return <CalendarClock className={cls} />;
    case 'wrench': return <Wrench className={cls} />;
    case 'file': return <FileText className={cls} />;
    case 'bank': return <Banknote className={cls} />;
    case 'task': return <ListTodo className={cls} />;
    default: return <ClipboardList className={cls} />;
  }
}

function getPriorityBadge(priority: string) {
  switch (priority) {
    case 'high': return <Badge variant="destructive" className="text-xs">Urgent</Badge>;
    case 'medium': return <Badge variant="secondary" className="bg-yellow-500 text-black text-xs">Medium</Badge>;
    default: return <Badge variant="outline" className="text-xs">Low</Badge>;
  }
}

function getUrgencyBadge(urgency: string) {
  switch (urgency) {
    case 'emergency': return <Badge variant="destructive">Emergency</Badge>;
    case 'urgent': return <Badge className="bg-orange-500 hover:bg-orange-600">Urgent</Badge>;
    case 'routine': return <Badge variant="secondary">Routine</Badge>;
    default: return <Badge variant="outline">Low</Badge>;
  }
}

function getMaintenanceStatusBadge(status: string) {
  const map: Record<string, string> = {
    new: 'bg-blue-500', assigned: 'bg-purple-500', in_progress: 'bg-yellow-500 text-black',
    awaiting_parts: 'bg-orange-500', completed: 'bg-green-600', closed: 'bg-gray-500'
  };
  return (
    <Badge className={map[status] || ''}>
      {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
    </Badge>
  );
}

// --- Rent Processing Agent Component ---

function RentProcessingAgent() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: paymentSource } = useQuery<PaymentSource>({
    queryKey: ['/api/crm/pm/rent-agent/payment-source'],
  });

  const { data: latestRun, isLoading: runLoading } = useQuery<AgentRun>({
    queryKey: ['/api/crm/pm/rent-agent/latest'],
    refetchInterval: (query) => {
      const data = query.state.data as AgentRun | undefined;
      return data?.status === 'running' ? 2000 : false;
    },
  });

  const { data: runHistory = [] } = useQuery<AgentRun[]>({
    queryKey: ['/api/crm/pm/rent-agent/history'],
  });

  const runAgent = useMutation({
    mutationFn: () => apiRequest('/api/crm/pm/rent-agent/run', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Agent started', description: 'Rent processing agent is running...' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/rent-agent'] });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const importCSV = useMutation({
    mutationFn: (csvContent: string) =>
      apiRequest('/api/crm/pm/rent-agent/import-csv', {
        method: 'POST',
        body: JSON.stringify({ csvContent, bankName: 'Client Account' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (data: any) => {
      toast({ title: 'CSV Imported', description: `${data.imported} transactions imported, ${data.duplicates} duplicates skipped` });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/rent-agent'] });
    },
    onError: (err: any) => {
      toast({ title: 'Import Error', description: err.message, variant: 'destructive' });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      importCSV.mutate(content);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const isRunning = latestRun?.status === 'running';
  const progressPercent = latestRun ? Math.round((latestRun.steps_completed / Math.max(latestRun.steps_total, 1)) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Agent Control Panel */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: `${BRAND}15` }}>
                <Bot className="h-6 w-6" style={{ color: BRAND }} />
              </div>
              <div>
                <CardTitle>Rent Processing Agent</CardTitle>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Automated: Match payments → Receipts → Charges → Statements → Pay landlords
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Payment source indicator */}
              <Badge variant="outline" className="gap-1.5 py-1">
                {paymentSource?.goCardlessConfigured
                  ? <><CreditCard className="h-3.5 w-3.5 text-green-600" /> GoCardless</>
                  : <><Banknote className="h-3.5 w-3.5 text-orange-500" /> Bank CSV</>
                }
              </Badge>

              {/* CSV Upload (only if not GoCardless) */}
              {!paymentSource?.goCardlessConfigured && (
                <>
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                    disabled={importCSV.isPending}>
                    <Upload className="h-4 w-4 mr-1.5" />
                    {importCSV.isPending ? 'Importing...' : 'Upload Bank CSV'}
                  </Button>
                </>
              )}

              {/* Run Agent Button */}
              <Button size="sm" style={{ backgroundColor: BRAND }} onClick={() => runAgent.mutate()}
                disabled={isRunning || runAgent.isPending}>
                {isRunning ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Running...</>
                ) : (
                  <><Play className="h-4 w-4 mr-1.5" /> Run Agent</>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Running progress */}
        {isRunning && latestRun && (
          <CardContent className="pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Step {latestRun.steps_completed} of {latestRun.steps_total}</span>
                <span className="font-medium">{progressPercent}%</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              {latestRun.log && latestRun.log.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {latestRun.log[latestRun.log.length - 1]?.message}
                </p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Latest Run Results */}
      {latestRun && latestRun.status !== 'running' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Latest Run Results</CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={latestRun.status === 'completed' ? 'default' : 'destructive'}
                  className={latestRun.status === 'completed' ? 'bg-green-600' : ''}>
                  {latestRun.status === 'completed' ? <CheckCircle className="h-3 w-3 mr-1" /> : <AlertTriangle className="h-3 w-3 mr-1" />}
                  {latestRun.status}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {latestRun.completed_at ? formatDate(latestRun.completed_at) : formatDate(latestRun.started_at)}
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
              {[
                { label: 'Payments Matched', value: latestRun.payments_matched, icon: <Zap className="h-4 w-4" /> },
                { label: 'Receipts Generated', value: latestRun.receipts_generated, icon: <FileText className="h-4 w-4" /> },
                { label: 'Receipts Emailed', value: latestRun.receipts_sent, icon: <Mail className="h-4 w-4" /> },
                { label: 'Charges Processed', value: latestRun.charges_processed, icon: <Wrench className="h-4 w-4" /> },
                { label: 'Statements Generated', value: latestRun.statements_generated, icon: <FileText className="h-4 w-4" /> },
                { label: 'Statements Emailed', value: latestRun.statements_sent, icon: <Mail className="h-4 w-4" /> },
                { label: 'Payments Prepared', value: latestRun.landlord_payments_prepared, icon: <Banknote className="h-4 w-4" /> },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-3 rounded-lg border">
                  <div className="text-muted-foreground mb-1">{stat.icon}</div>
                  <p className="text-xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Financial Summary */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Card className="border-green-200 bg-green-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-green-700">Rent Processed</p>
                  <p className="text-lg font-bold text-green-800">
                    {formatCurrency(latestRun.total_rent_processed)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-purple-200 bg-purple-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-purple-700">JB Commission</p>
                  <p className="text-lg font-bold text-purple-800">
                    {formatCurrency(latestRun.total_commission)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-orange-700">Charges</p>
                  <p className="text-lg font-bold text-orange-800">
                    {formatCurrency(latestRun.total_charges)}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-blue-700">Net to Landlords</p>
                  <p className="text-lg font-bold text-blue-800">
                    {formatCurrency(latestRun.total_net_payable)}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Errors */}
            {latestRun.error_count > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
                <p className="text-sm font-medium text-red-700">{latestRun.error_count} error(s) during processing</p>
                {latestRun.log?.filter(l => l.status === 'error').map((err, i) => (
                  <p key={i} className="text-xs text-red-600 mt-1">{err.message}</p>
                ))}
              </div>
            )}

            {/* Step Log */}
            {latestRun.log && latestRun.log.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm font-medium mb-2">Execution Log</p>
                {latestRun.log.map((entry, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs py-1 border-b last:border-0">
                    <span className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      entry.status === 'success' ? 'bg-green-500' :
                      entry.status === 'error' ? 'bg-red-500' :
                      entry.status === 'skipped' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`} />
                    <span className="text-muted-foreground flex-shrink-0 w-16">
                      Step {entry.step}
                    </span>
                    <span className="flex-grow">{entry.message}</span>
                    <span className="text-muted-foreground flex-shrink-0">
                      {new Date(entry.timestamp).toLocaleTimeString('en-GB')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Run History */}
      {runHistory.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Run History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Matched</TableHead>
                  <TableHead className="text-right">Receipts</TableHead>
                  <TableHead className="text-right">Statements</TableHead>
                  <TableHead className="text-right">Rent Processed</TableHead>
                  <TableHead className="text-right">Net to Landlords</TableHead>
                  <TableHead className="text-right">Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runHistory.slice(0, 10).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-sm">{formatDate(run.started_at)}</TableCell>
                    <TableCell>
                      <Badge variant={run.status === 'completed' ? 'default' : run.status === 'running' ? 'secondary' : 'destructive'}
                        className={run.status === 'completed' ? 'bg-green-600' : run.status === 'running' ? 'bg-blue-500' : ''}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{run.payments_matched}</TableCell>
                    <TableCell className="text-right">{run.receipts_sent}</TableCell>
                    <TableCell className="text-right">{run.statements_sent}</TableCell>
                    <TableCell className="text-right">{formatCurrency(run.total_rent_processed)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(run.total_net_payable)}</TableCell>
                    <TableCell className="text-right">
                      {run.error_count > 0 ? (
                        <Badge variant="destructive" className="text-xs">{run.error_count}</Badge>
                      ) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Link href="/crm/rent-collection">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <PoundSterling className="h-5 w-5 mx-auto mb-2" style={{ color: BRAND }} />
              <p className="text-sm font-medium">Rent Collection</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/crm/bank-reconciliation">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <Banknote className="h-5 w-5 mx-auto mb-2" style={{ color: BRAND }} />
              <p className="text-sm font-medium">Bank Reconciliation</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/crm/statements">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <FileText className="h-5 w-5 mx-auto mb-2" style={{ color: BRAND }} />
              <p className="text-sm font-medium">Landlord Statements</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/crm/invoices">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4 text-center">
              <ClipboardList className="h-5 w-5 mx-auto mb-2" style={{ color: BRAND }} />
              <p className="text-sm font-medium">Tenant Invoices</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

// --- Agent Control Panel (for Action Queue) ---

function AgentControlPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const runRentAgent = useMutation({
    mutationFn: () => apiRequest('/api/crm/pm/rent-agent/run', { method: 'POST' }),
    onSuccess: () => {
      toast({ title: 'Rent Processing Agent started' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm/rent-agent'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const { data: latestRuns = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/pm/agent-runs-all'],
    queryFn: () => apiRequest('/api/crm/pm/rent-agent/history'),
  });

  const lastRentRun = latestRuns.find((r: any) => r.agent_type === 'rent_processing');

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#791E7515' }}>
              <Bot className="h-6 w-6" style={{ color: '#791E75' }} />
            </div>
            <div>
              <CardTitle className="text-base">PM Agents</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Manually invoke property management agents
              </p>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Start of Tenancy Agent */}
          <Card className="border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="font-medium text-sm">Start of Tenancy</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Onboarding, deposit protection, contract setup
              </p>
              <Link href="/crm/tenancy-onboarding">
                <Button size="sm" variant="outline" className="w-full">
                  <Play className="h-3.5 w-3.5 mr-1.5" /> Open Pipeline
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Rent Processing Agent */}
          <Card className="border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <PoundSterling className="h-5 w-5 text-purple-600" />
                <p className="font-medium text-sm">Rent Processing</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Match payments, receipts, statements, pay landlords
              </p>
              <Button size="sm" className="w-full" style={{ backgroundColor: '#791E75' }}
                onClick={() => runRentAgent.mutate()}
                disabled={runRentAgent.isPending}>
                {runRentAgent.isPending ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Running...</>
                ) : (
                  <><Play className="h-3.5 w-3.5 mr-1.5" /> Run Agent</>
                )}
              </Button>
              {lastRentRun && (
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  Last: {lastRentRun.status === 'completed' ? '✓' : '✗'} {new Date(lastRentRun.started_at).toLocaleDateString('en-GB')}
                </p>
              )}
            </CardContent>
          </Card>

          {/* End of Tenancy Agent */}
          <Card className="border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <ClipboardList className="h-5 w-5 text-orange-600" />
                <p className="font-medium text-sm">End of Tenancy</p>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Checkout, deposit return, final account, close tenancy
              </p>
              <Link href="/crm/end-of-tenancy">
                <Button size="sm" variant="outline" className="w-full">
                  <Play className="h-3.5 w-3.5 mr-1.5" /> Open Workflow
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}

// --- Message Router Component ---

interface RoutedMessageItem {
  id: number;
  source: string;
  subject: string;
  body: string;
  sender_email: string;
  sender_name: string;
  agent_type: string;
  confidence: number;
  matched_keywords: string[];
  reasoning: string;
  suggested_action: string;
  status: string;
  created_at: string;
  actioned_at: string;
  agent_run_id: number;
}

function MessageRouterPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [messageText, setMessageText] = useState('');
  const [messageSubject, setMessageSubject] = useState('');
  const [classifyResult, setClassifyResult] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);

  const { data: routedHistory = [] } = useQuery<RoutedMessageItem[]>({
    queryKey: ['/api/crm/message-router/history'],
    queryFn: () => apiRequest('/api/crm/message-router/history?limit=20'),
    enabled: showHistory,
  });

  const classifyMutation = useMutation({
    mutationFn: (data: { subject: string; body: string }) =>
      apiRequest('/api/crm/message-router/classify', {
        method: 'POST',
        body: JSON.stringify({ subject: data.subject, body: data.body, source: 'manual' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (data: any) => {
      setClassifyResult(data.classification);
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const routeMutation = useMutation({
    mutationFn: (data: { subject: string; body: string; autoExecute: boolean }) =>
      apiRequest('/api/crm/message-router/route', {
        method: 'POST',
        body: JSON.stringify({
          message: { subject: data.subject, body: data.body, source: 'manual' },
          autoExecute: data.autoExecute,
        }),
        headers: { 'Content-Type': 'application/json' },
      }),
    onSuccess: (data: any) => {
      toast({
        title: data.autoExecuted ? 'Message routed & agent executed' : 'Message routed',
        description: `Classified as: ${data.classification.agent.replace(/_/g, ' ')}`,
      });
      setClassifyResult(null);
      setMessageText('');
      setMessageSubject('');
      queryClient.invalidateQueries({ queryKey: ['/api/crm/message-router/history'] });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const getAgentColor = (agent: string) => {
    switch (agent) {
      case 'start_of_tenancy': return 'bg-green-100 text-green-800';
      case 'rent_processing': return 'bg-purple-100 text-purple-800';
      case 'end_of_tenancy': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) return <Badge className="bg-green-600 text-xs">High ({Math.round(confidence * 100)}%)</Badge>;
    if (confidence >= 0.4) return <Badge className="bg-yellow-500 text-black text-xs">Medium ({Math.round(confidence * 100)}%)</Badge>;
    return <Badge variant="destructive" className="text-xs">Low ({Math.round(confidence * 100)}%)</Badge>;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#791E7515' }}>
              <MessageSquare className="h-5 w-5" style={{ color: '#791E75' }} />
            </div>
            <div>
              <CardTitle className="text-base">Message Router</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Paste a message to classify and route to the appropriate PM agent
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? 'Hide History' : 'View History'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {/* Message Input */}
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Subject (optional)"
            value={messageSubject}
            onChange={(e) => setMessageSubject(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
          />
          <Textarea
            placeholder="Paste or type the message content here..."
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            rows={3}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline"
              onClick={() => classifyMutation.mutate({ subject: messageSubject, body: messageText })}
              disabled={!messageText.trim() || classifyMutation.isPending}>
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              {classifyMutation.isPending ? 'Classifying...' : 'Preview Classification'}
            </Button>
            <Button size="sm" style={{ backgroundColor: '#791E75' }}
              onClick={() => routeMutation.mutate({ subject: messageSubject, body: messageText, autoExecute: false })}
              disabled={!messageText.trim() || routeMutation.isPending}>
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Route Message
            </Button>
            <Button size="sm" variant="secondary"
              onClick={() => routeMutation.mutate({ subject: messageSubject, body: messageText, autoExecute: true })}
              disabled={!messageText.trim() || routeMutation.isPending}>
              <Zap className="h-3.5 w-3.5 mr-1.5" />
              Route & Execute
            </Button>
          </div>
        </div>

        {/* Classification Preview */}
        {classifyResult && (
          <Card className="border-dashed">
            <CardContent className="p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Badge className={getAgentColor(classifyResult.agent)}>
                    {classifyResult.agent.replace(/_/g, ' ')}
                  </Badge>
                  {getConfidenceBadge(classifyResult.confidence)}
                </div>
                <Button variant="ghost" size="sm" onClick={() => setClassifyResult(null)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{classifyResult.reasoning}</p>
              <p className="text-xs font-medium mt-1">{classifyResult.suggestedAction}</p>
              {classifyResult.matchedKeywords.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {classifyResult.matchedKeywords.map((kw: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{kw}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Routed Message History */}
        {showHistory && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium mb-2">Recent Routed Messages</p>
            {routedHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No messages routed yet</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {routedHistory.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3 p-2 rounded border text-xs">
                    <Badge className={`${getAgentColor(msg.agent_type)} flex-shrink-0 text-xs`}>
                      {msg.agent_type.replace(/_/g, ' ')}
                    </Badge>
                    <div className="flex-grow min-w-0">
                      <p className="font-medium truncate">{msg.subject || msg.body.substring(0, 60)}</p>
                      <p className="text-muted-foreground">{msg.reasoning}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <Badge variant={msg.status === 'actioned' ? 'default' : msg.status === 'dismissed' ? 'secondary' : 'outline'}
                        className={msg.status === 'actioned' ? 'bg-green-600 text-xs' : 'text-xs'}>
                        {msg.status}
                      </Badge>
                      <p className="text-muted-foreground mt-0.5">
                        {new Date(msg.created_at).toLocaleDateString('en-GB')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- Property Progress Component ---

interface PropertyProgress {
  id: number;
  address: string;
  postcode: string;
  property_type: string;
  bedrooms: number;
  landlord_name: string | null;
  tenancy_id: number | null;
  tenancy_status: string | null;
  tenancy_start: string | null;
  tenancy_end: string | null;
  rent_amount: number | null;
  rent_frequency: string | null;
  deposit_amount: number | null;
  deposit_certificate_number: string | null;
  tenant_name: string | null;
  days_until_end: number | null;
  deposit_status: 'none' | 'protected' | 'unprotected';
  compliance_valid: number;
  compliance_expired: number;
  compliance_expiring: number;
  open_maintenance: number;
  rent_collected: number;
  rent_outstanding: number;
  arrears_amount: number;
}

function getProgressScore(p: PropertyProgress): { score: number; total: number; issues: string[] } {
  let score = 0;
  const total = 6;
  const issues: string[] = [];

  // 1. Has active tenancy
  if (p.tenancy_status === 'active') { score++; }
  else { issues.push(p.tenancy_status === 'pending' ? 'Tenancy pending' : 'No active tenancy'); }

  // 2. Deposit protected
  if (p.deposit_status === 'protected' || p.deposit_status === 'none') { score++; }
  else { issues.push('Deposit unprotected'); }

  // 3. Compliance OK
  if (p.compliance_expired === 0 && p.compliance_expiring === 0) { score++; }
  else { issues.push(p.compliance_expired > 0 ? `${p.compliance_expired} expired cert(s)` : `${p.compliance_expiring} expiring cert(s)`); }

  // 4. No arrears
  if (p.arrears_amount === 0 || Number(p.arrears_amount) === 0) { score++; }
  else { issues.push(`Arrears: £${(Number(p.arrears_amount) / 100).toFixed(0)}`); }

  // 5. No open maintenance
  if (p.open_maintenance === 0) { score++; }
  else { issues.push(`${p.open_maintenance} open ticket(s)`); }

  // 6. Rent collected
  if (Number(p.rent_outstanding) === 0) { score++; }
  else { issues.push('Rent outstanding'); }

  return { score, total, issues };
}

function PropertyProgressTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIssues, setFilterIssues] = useState(false);

  const { data: properties = [], isLoading } = useQuery<PropertyProgress[]>({
    queryKey: ['/api/crm/pm-command-centre/property-progress'],
  });

  const filtered = properties.filter((p) => {
    const matchesSearch = !searchTerm ||
      p.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tenant_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.landlord_name?.toLowerCase().includes(searchTerm.toLowerCase());

    if (filterIssues) {
      const { score, total } = getProgressScore(p);
      return matchesSearch && score < total;
    }
    return matchesSearch;
  });

  const issueCount = properties.filter(p => {
    const { score, total } = getProgressScore(p);
    return score < total;
  }).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{properties.length}</p>
            <p className="text-xs text-muted-foreground">Managed Properties</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all ${!filterIssues ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
          onClick={() => setFilterIssues(false)}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {properties.filter(p => getProgressScore(p).score === getProgressScore(p).total).length}
            </p>
            <p className="text-xs text-muted-foreground">All Clear</p>
          </CardContent>
        </Card>
        <Card className={`cursor-pointer transition-all ${filterIssues ? 'ring-2 ring-red-500' : 'hover:shadow-md'}`}
          onClick={() => setFilterIssues(true)}>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{issueCount}</p>
            <p className="text-xs text-muted-foreground">Need Attention</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">
              {properties.length > 0
                ? Math.round(properties.reduce((sum, p) => sum + (getProgressScore(p).score / getProgressScore(p).total) * 100, 0) / properties.length)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Avg Health</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by address, tenant, landlord..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Property table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              {filterIssues ? 'Properties Needing Attention' : 'All Managed Properties'}
              <span className="text-sm font-normal text-muted-foreground ml-2">({filtered.length})</span>
            </CardTitle>
            {filterIssues && (
              <Button variant="ghost" size="sm" onClick={() => setFilterIssues(false)}>Show all</Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-green-700">
                {filterIssues ? 'All properties are in good shape!' : 'No managed properties found'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-center">Health</TableHead>
                    <TableHead className="text-center">Tenancy</TableHead>
                    <TableHead className="text-center">Deposit</TableHead>
                    <TableHead className="text-center">Compliance</TableHead>
                    <TableHead className="text-center">Rent</TableHead>
                    <TableHead className="text-center">Maintenance</TableHead>
                    <TableHead>Issues</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const { score, total, issues } = getProgressScore(p);
                    const pct = Math.round((score / total) * 100);
                    const progressColor = pct === 100 ? 'bg-green-500' : pct >= 67 ? 'bg-yellow-500' : 'bg-red-500';

                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{p.address || 'Unknown'}</p>
                            <p className="text-xs text-muted-foreground">{p.postcode}</p>
                            {p.landlord_name && (
                              <p className="text-xs text-muted-foreground">LL: {p.landlord_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.tenant_name ? (
                            <p className="text-sm">{p.tenant_name}</p>
                          ) : (
                            <span className="text-xs text-gray-400">Vacant</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-1">
                            <div className="w-12 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div className={`h-full rounded-full ${progressColor}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-xs font-medium">{score}/{total}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {p.tenancy_status === 'active' ? (
                            <Badge className="bg-green-600 text-xs">Active</Badge>
                          ) : p.tenancy_status === 'pending' ? (
                            <Badge className="bg-yellow-500 text-black text-xs">Pending</Badge>
                          ) : p.tenancy_status === 'ending' ? (
                            <Badge variant="destructive" className="text-xs">
                              {p.days_until_end != null ? `${p.days_until_end}d` : 'Ending'}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">None</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {p.deposit_status === 'protected' ? (
                            <ShieldCheck className="h-4 w-4 text-green-600 mx-auto" />
                          ) : p.deposit_status === 'unprotected' ? (
                            <ShieldAlert className="h-4 w-4 text-red-600 mx-auto" />
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {p.compliance_expired > 0 ? (
                            <Badge variant="destructive" className="text-xs">{p.compliance_expired} expired</Badge>
                          ) : p.compliance_expiring > 0 ? (
                            <Badge className="bg-yellow-500 text-black text-xs">{p.compliance_expiring} expiring</Badge>
                          ) : p.compliance_valid > 0 ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {Number(p.rent_outstanding) > 0 ? (
                            <Badge variant="destructive" className="text-xs">Outstanding</Badge>
                          ) : Number(p.rent_collected) > 0 ? (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {p.open_maintenance > 0 ? (
                            <Badge className="bg-orange-500 text-xs">{p.open_maintenance} open</Badge>
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                          )}
                        </TableCell>
                        <TableCell>
                          {issues.length > 0 ? (
                            <div className="space-y-0.5">
                              {issues.map((issue, i) => (
                                <p key={i} className="text-xs text-red-600">{issue}</p>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-green-600">All clear</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/crm/managed-property/${p.id}`}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// --- Rent Lifecycle Types & Component ---

interface RentLifecycleProperty {
  property_id: number;
  property_name: string;
  postcode: string;
  management_fee_type: string | null;
  management_fee_value: string | null;
  landlord_id: number | null;
  landlord_name: string | null;
  landlord_email: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  bank_sort_code: string | null;
  bank_account_holder_name: string | null;
  tenant_name: string | null;
  rent_amount: number | null;
  rent_frequency: string | null;
  invoice_id: number | null;
  invoice_status: string | null;
  invoice_amount: number | null;
  invoice_paid_date: string | null;
  bank_transaction_id: number | null;
  bank_transaction_date: string | null;
  bank_transaction_amount: number | null;
  bank_transaction_description: string | null;
  bank_match_status: string | null;
  maintenance_charges: number;
  maintenance_ticket_count: number;
  statement_id: number | null;
  statement_status: string | null;
  statement_rent: number | null;
  statement_commission: number | null;
  statement_vat: number | null;
  statement_maintenance: number | null;
  statement_other: number | null;
  statement_net: number | null;
  statement_sent_at: string | null;
  statement_paid_at: string | null;
  statement_payment_ref: string | null;
  mandate_id: number | null;
  mandate_status: string | null;
}

function StepIndicator({ step, label, done, active, warn }: {
  step: number; label: string; done: boolean; active?: boolean; warn?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
        done ? 'bg-green-600 border-green-600 text-white' :
        warn ? 'bg-amber-500 border-amber-500 text-white' :
        active ? 'border-[#791E75] text-[#791E75] bg-purple-50' :
        'border-gray-300 text-gray-400 bg-white'
      }`}>
        {done ? '✓' : step}
      </div>
      <span className={`text-[10px] text-center leading-tight ${done ? 'text-green-700 font-medium' : warn ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
        {label}
      </span>
    </div>
  );
}

function StepConnector({ done }: { done: boolean }) {
  return (
    <div className={`flex-1 h-0.5 mt-3 min-w-[12px] ${done ? 'bg-green-500' : 'bg-gray-200'}`} />
  );
}

function RentLifecycleTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: properties = [], isLoading } = useQuery<RentLifecycleProperty[]>({
    queryKey: ['/api/crm/pm-command-centre/rent-lifecycle'],
  });

  const generateStatementMutation = useMutation({
    mutationFn: async (landlordId: number) => {
      return apiRequest('POST', '/api/crm/finance/statements/generate', { landlordId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm-command-centre/rent-lifecycle'] });
      toast({ title: 'Statement generated' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const sendStatementMutation = useMutation({
    mutationFn: async (statementId: number) => {
      return apiRequest('POST', `/api/crm/finance/statements/${statementId}/send-email`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/pm-command-centre/rent-lifecycle'] });
      toast({ title: 'Statement emailed to landlord' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  });

  const filtered = properties.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      p.property_name?.toLowerCase().includes(term) ||
      p.postcode?.toLowerCase().includes(term) ||
      p.landlord_name?.toLowerCase().includes(term) ||
      p.tenant_name?.toLowerCase().includes(term)
    );
  });

  // Summary counts
  const rentReceived = filtered.filter(p => p.invoice_status === 'paid' || p.bank_transaction_id).length;
  const statementsGenerated = filtered.filter(p => p.statement_id).length;
  const statementsSent = filtered.filter(p => p.statement_sent_at).length;
  const paymentsMade = filtered.filter(p => p.statement_paid_at).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Properties</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{rentReceived}</p>
            <p className="text-xs text-muted-foreground">Rent Received</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-600">{statementsGenerated}</p>
            <p className="text-xs text-muted-foreground">Statements</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-purple-600">{statementsSent}</p>
            <p className="text-xs text-muted-foreground">Emailed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{paymentsMade}</p>
            <p className="text-xs text-muted-foreground">Paid Out</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search by property, landlord, tenant..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Property lifecycle cards */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-gray-500">No managed properties found</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const expanded = expandedId === p.property_id;
            const rentPence = p.rent_amount || 0;

            // Calculate lifecycle steps
            const step1Done = !!p.bank_account_number; // Bank account configured
            const step2Done = p.invoice_status === 'paid' || !!p.bank_transaction_id; // Rent received
            const step3Done = true; // Maintenance check always "done" (it's a review step)
            const step3Warn = p.maintenance_charges > 0;
            const step4Done = !!p.statement_id; // Statement generated
            const step5Done = !!p.statement_sent_at; // Statement emailed
            const step6Done = !!p.statement_paid_at; // Payment made

            const feeType = p.management_fee_type || 'percentage';
            const feeValue = Number(p.management_fee_value) || 0;
            const commissionCalc = feeType === 'percentage'
              ? `${feeValue}% of rent`
              : formatCurrency(feeValue);

            return (
              <Card key={p.property_id} className="overflow-hidden">
                {/* Header row with lifecycle steps */}
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : p.property_id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Property info */}
                    <div className="min-w-[200px]">
                      <p className="font-semibold text-sm">{p.property_name || 'Unknown Property'}</p>
                      <p className="text-xs text-muted-foreground">{p.postcode}</p>
                      {p.tenant_name && <p className="text-xs text-muted-foreground mt-0.5">Tenant: {p.tenant_name}</p>}
                      {p.landlord_name && <p className="text-xs text-muted-foreground">LL: {p.landlord_name}</p>}
                      {rentPence > 0 && (
                        <p className="text-xs font-medium mt-1" style={{ color: BRAND }}>
                          {formatCurrency(rentPence)}/{p.rent_frequency || 'month'}
                        </p>
                      )}
                    </div>

                    {/* Lifecycle steps */}
                    <div className="flex-1 flex items-start justify-center gap-0">
                      <StepIndicator step={1} label="Bank Acct" done={step1Done} />
                      <StepConnector done={step1Done && step2Done} />
                      <StepIndicator step={2} label="Rent Recd" done={step2Done} active={step1Done && !step2Done} />
                      <StepConnector done={step2Done} />
                      <StepIndicator step={3} label="Maint." done={step3Done} warn={step3Warn} />
                      <StepConnector done={step3Done && step4Done} />
                      <StepIndicator step={4} label="Statement" done={step4Done} active={step2Done && !step4Done} />
                      <StepConnector done={step4Done && step5Done} />
                      <StepIndicator step={5} label="Emailed" done={step5Done} active={step4Done && !step5Done} />
                      <StepConnector done={step5Done && step6Done} />
                      <StepIndicator step={6} label="Paid" done={step6Done} active={step5Done && !step6Done} />
                    </div>

                    {/* Expand arrow */}
                    <ChevronRight className={`h-5 w-5 text-gray-400 transition-transform mt-2 ${expanded ? 'rotate-90' : ''}`} />
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t bg-gray-50 p-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Column 1: Bank & Receipt */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Bank Account</h4>
                          {p.bank_account_number ? (
                            <div className="bg-white rounded-lg p-3 border text-sm space-y-1">
                              <p><span className="text-muted-foreground">Bank:</span> {p.bank_name || '-'}</p>
                              <p><span className="text-muted-foreground">Acc:</span> ****{p.bank_account_number}</p>
                              <p><span className="text-muted-foreground">Sort:</span> {p.bank_sort_code || '-'}</p>
                              <p><span className="text-muted-foreground">Name:</span> {p.bank_account_holder_name || '-'}</p>
                            </div>
                          ) : (
                            <div className="bg-red-50 rounded-lg p-3 border border-red-200 text-sm text-red-700">
                              <AlertTriangle className="h-4 w-4 inline mr-1" />
                              No bank account on file for landlord
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Tenant Receipt</h4>
                          {p.bank_transaction_id ? (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-sm">
                              <CheckCircle className="h-4 w-4 inline mr-1 text-green-600" />
                              Payment matched: {formatCurrency(p.bank_transaction_amount || 0)}
                              <p className="text-xs text-muted-foreground mt-1">
                                {p.bank_transaction_date ? formatDate(p.bank_transaction_date) : ''}
                                {p.bank_transaction_description ? ` — ${p.bank_transaction_description}` : ''}
                              </p>
                            </div>
                          ) : p.invoice_status === 'paid' ? (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-sm">
                              <CheckCircle className="h-4 w-4 inline mr-1 text-green-600" />
                              Invoice paid {p.invoice_paid_date ? formatDate(p.invoice_paid_date) : ''}
                            </div>
                          ) : p.invoice_id ? (
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
                              <Clock className="h-4 w-4 inline mr-1 text-amber-600" />
                              Invoice {p.invoice_status} — {formatCurrency(p.invoice_amount || 0)}
                            </div>
                          ) : (
                            <div className="bg-gray-100 rounded-lg p-3 border text-sm text-gray-500">
                              No rent invoice this month
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Column 2: Maintenance & Statement */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Maintenance Charges</h4>
                          {p.maintenance_charges > 0 ? (
                            <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 text-sm">
                              <Wrench className="h-4 w-4 inline mr-1 text-amber-600" />
                              {p.maintenance_ticket_count} ticket{p.maintenance_ticket_count !== 1 ? 's' : ''}: {formatCurrency(p.maintenance_charges)}
                            </div>
                          ) : (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-sm">
                              <CheckCircle className="h-4 w-4 inline mr-1 text-green-600" />
                              No maintenance charges this month
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Landlord Statement</h4>
                          {p.statement_id ? (
                            <div className="bg-white rounded-lg p-3 border text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Rent Collected</span>
                                <span className="font-medium text-green-700">+{formatCurrency(p.statement_rent || 0)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">JB Commission</span>
                                <span className="font-medium text-red-600">-{formatCurrency(p.statement_commission || 0)}</span>
                              </div>
                              {(p.statement_vat || 0) > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">VAT on fees</span>
                                  <span className="font-medium text-red-600">-{formatCurrency(p.statement_vat || 0)}</span>
                                </div>
                              )}
                              {(p.statement_maintenance || 0) > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Maintenance</span>
                                  <span className="font-medium text-red-600">-{formatCurrency(p.statement_maintenance || 0)}</span>
                                </div>
                              )}
                              {(p.statement_other || 0) > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Other deductions</span>
                                  <span className="font-medium text-red-600">-{formatCurrency(p.statement_other || 0)}</span>
                                </div>
                              )}
                              <div className="border-t pt-1 flex justify-between font-semibold">
                                <span>Net Payable</span>
                                <span style={{ color: BRAND }}>{formatCurrency(p.statement_net || 0)}</span>
                              </div>
                              <div className="pt-1">
                                <Badge className={
                                  p.statement_status === 'paid' ? 'bg-green-600' :
                                  p.statement_status === 'sent' ? 'bg-blue-600' :
                                  p.statement_status === 'approved' ? 'bg-purple-600' :
                                  'bg-gray-500'
                                }>
                                  {(p.statement_status || '').replace(/\b\w/g, c => c.toUpperCase())}
                                </Badge>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-100 rounded-lg p-3 border text-sm space-y-2">
                              <p className="text-gray-500">No statement generated yet</p>
                              {step2Done && p.landlord_id && (
                                <Button
                                  size="sm"
                                  style={{ backgroundColor: BRAND }}
                                  onClick={(e) => { e.stopPropagation(); generateStatementMutation.mutate(p.landlord_id!); }}
                                  disabled={generateStatementMutation.isPending}
                                >
                                  {generateStatementMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <FileText className="h-3 w-3 mr-1" />
                                  )}
                                  Generate Statement
                                </Button>
                              )}
                              <div className="text-xs text-muted-foreground">
                                <p>Commission: {commissionCalc}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Column 3: Email & Payment */}
                      <div className="space-y-3">
                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Email Statement</h4>
                          {p.statement_sent_at ? (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-sm">
                              <Mail className="h-4 w-4 inline mr-1 text-green-600" />
                              Sent {formatDate(p.statement_sent_at)}
                              {p.landlord_email && (
                                <p className="text-xs text-muted-foreground mt-1">To: {p.landlord_email}</p>
                              )}
                            </div>
                          ) : p.statement_id ? (
                            <div className="bg-white rounded-lg p-3 border text-sm space-y-2">
                              <p className="text-gray-500">Statement ready to send</p>
                              {p.landlord_email && (
                                <p className="text-xs text-muted-foreground">To: {p.landlord_email}</p>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => { e.stopPropagation(); sendStatementMutation.mutate(p.statement_id!); }}
                                disabled={sendStatementMutation.isPending}
                              >
                                {sendStatementMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Send className="h-3 w-3 mr-1" />
                                )}
                                Email Statement
                              </Button>
                            </div>
                          ) : (
                            <div className="bg-gray-100 rounded-lg p-3 border text-sm text-gray-500">
                              Generate statement first
                            </div>
                          )}
                        </div>

                        <div>
                          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Payment to Landlord</h4>
                          {p.statement_paid_at ? (
                            <div className="bg-green-50 rounded-lg p-3 border border-green-200 text-sm">
                              <CreditCard className="h-4 w-4 inline mr-1 text-green-600" />
                              Paid {formatDate(p.statement_paid_at)}
                              {p.statement_payment_ref && (
                                <p className="text-xs text-muted-foreground mt-1">Ref: {p.statement_payment_ref}</p>
                              )}
                            </div>
                          ) : p.statement_id && p.statement_status === 'sent' ? (
                            <div className="bg-white rounded-lg p-3 border text-sm space-y-2">
                              <p className="text-muted-foreground">Ready for payment</p>
                              <p className="font-semibold" style={{ color: BRAND }}>
                                {formatCurrency(p.statement_net || 0)}
                              </p>
                              {p.mandate_id ? (
                                <Badge className="bg-green-600">GoCardless Active</Badge>
                              ) : (
                                <Badge variant="outline">Manual Transfer</Badge>
                              )}
                            </div>
                          ) : (
                            <div className="bg-gray-100 rounded-lg p-3 border text-sm text-gray-500">
                              {p.statement_id ? 'Send statement first' : 'Awaiting statement'}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- KPI Card ---

function KPICard({ title, value, subtitle, icon, link, alert }: {
  title: string; value: string | number; subtitle?: string; icon: React.ReactNode;
  link: string; alert?: { text: string; variant: 'destructive' | 'warning' | 'success' };
}) {
  return (
    <Link href={link}>
      <Card className="cursor-pointer hover:shadow-md transition-shadow group">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {icon}
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{value}</div>
          {alert && alert.variant === 'destructive' && (
            <Badge variant="destructive" className="mt-1 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />{alert.text}
            </Badge>
          )}
          {alert && alert.variant === 'warning' && (
            <Badge variant="secondary" className="mt-1 bg-yellow-500 text-black text-xs">{alert.text}</Badge>
          )}
          {alert && alert.variant === 'success' && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />{alert.text}
            </p>
          )}
          {subtitle && !alert && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
          <div className="flex items-center mt-2 text-xs text-muted-foreground group-hover:text-purple-700 transition-colors">
            View details <ChevronRight className="h-3 w-3 ml-1" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

// --- Component ---

export default function PMTrackingDashboard() {
  const [activeTab, setActiveTab] = useState('action_queue');
  const [actionSortBy, setActionSortBy] = useState<'priority' | 'due'>('priority');
  const [actionSortDir, setActionSortDir] = useState<'asc' | 'desc'>('asc');

  const toggleActionSort = (col: 'priority' | 'due') => {
    if (actionSortBy === col) {
      setActionSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setActionSortBy(col);
      setActionSortDir('asc');
    }
  };

  const priorityOrder = { high: 0, medium: 1, low: 2 };

  const sortedActionItems = (items: ActionItem[]) => {
    return [...items].sort((a, b) => {
      let cmp = 0;
      if (actionSortBy === 'priority') {
        cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
      } else {
        const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        cmp = da - db;
      }
      return actionSortDir === 'asc' ? cmp : -cmp;
    });
  };

  const SortIcon = ({ col }: { col: 'priority' | 'due' }) => {
    if (actionSortBy !== col) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return actionSortDir === 'asc'
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  // Summary KPIs
  const { data: summary, isLoading: summaryLoading } = useQuery<PMSummary>({
    queryKey: ['/api/crm/pm-command-centre/summary'],
  });

  // Action Queue
  const { data: actionQueue, isLoading: actionsLoading } = useQuery<ActionQueueResponse>({
    queryKey: ['/api/crm/pm-command-centre/action-queue'],
    enabled: activeTab === 'action_queue',
  });

  // End of Tenancy - tenancies with status 'ending' or ending within 90 days
  const { data: endOfTenancyItems = [], isLoading: eotLoading } = useQuery<any[]>({
    queryKey: ['/api/crm/pm-dashboard/tenancies', 'ending'],
    queryFn: () => apiRequest('/api/crm/pm-dashboard/tenancies?status=ending'),
    enabled: activeTab === 'end_of_tenancy',
  });

  // Active tenancies ending soon
  const { data: endingSoonItems = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/pm-dashboard/tenancies', 'ending_soon_eot'],
    queryFn: () => apiRequest('/api/crm/pm-dashboard/tenancies?status=active'),
    enabled: activeTab === 'end_of_tenancy',
  });

  // Maintenance tickets
  const { data: maintenanceTickets = [], isLoading: maintenanceLoading } = useQuery<any[]>({
    queryKey: ['/api/crm/maintenance-summary'],
    queryFn: () => apiRequest('/api/crm/maintenance/tickets'),
    enabled: activeTab === 'maintenance',
  });

  const rentTotal = (summary?.rentCollectedThisMonth ?? 0) + (summary?.rentOutstandingThisMonth ?? 0);
  const rentProgress = rentTotal > 0 ? Math.round(((summary?.rentCollectedThisMonth ?? 0) / rentTotal) * 100) : 0;

  if (summaryLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: BRAND }} />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRAND }}>PM Command Centre</h1>
          <p className="text-muted-foreground mt-1">
            Manage all property management tasks, workflows, and communications
          </p>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        <KPICard
          title="Active Tenancies"
          value={summary?.activeTenancies ?? 0}
          icon={<Building className="h-4 w-4 text-muted-foreground" />}
          link="/crm/rental-agreements"
          alert={(summary?.pendingTenancies ?? 0) > 0 ? { text: `${summary?.pendingTenancies} pending`, variant: 'warning' } : undefined}
        />
        <KPICard
          title="Rent Collection"
          value={formatCurrency(summary?.rentCollectedThisMonth ?? 0)}
          icon={<PoundSterling className="h-4 w-4 text-muted-foreground" />}
          link="/crm/rent-collection"
          subtitle={`${formatCurrency(summary?.rentOutstandingThisMonth ?? 0)} outstanding (${rentProgress}%)`}
        />
        <KPICard
          title="Deposits"
          value={summary?.depositsProtected ?? 0}
          icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
          link="/crm/deposit-management"
          alert={(summary?.depositsUnprotected ?? 0) > 0
            ? { text: `${summary?.depositsUnprotected} unprotected`, variant: 'destructive' }
            : { text: 'All protected', variant: 'success' }}
        />
        <KPICard
          title="Compliance"
          value={`${summary?.complianceValid ?? 0} valid`}
          icon={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
          link="/crm/compliance-calendar"
          alert={(summary?.complianceExpired ?? 0) > 0
            ? { text: `${summary?.complianceExpired} expired`, variant: 'destructive' }
            : (summary?.complianceExpiring ?? 0) > 0
              ? { text: `${summary?.complianceExpiring} expiring`, variant: 'warning' }
              : undefined}
        />
        <KPICard
          title="Arrears"
          value={summary?.arrearsCases ?? 0}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          link="/crm/arrears"
          subtitle={`${formatCurrency(summary?.arrearsTotal ?? 0)} outstanding`}
        />
        <KPICard
          title="Maintenance"
          value={summary?.openMaintenanceTickets ?? 0}
          icon={<Wrench className="h-4 w-4 text-muted-foreground" />}
          link="/crm/maintenance"
          subtitle="open tickets"
        />
        <KPICard
          title="Ending Soon"
          value={summary?.endingSoon ?? 0}
          icon={<CalendarClock className="h-4 w-4 text-muted-foreground" />}
          link="/crm/tenancy-expiry-calendar"
          subtitle="within 90 days"
        />
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="action_queue" className="gap-1.5">
            <ListTodo className="h-4 w-4" />
            Action Queue
            {actionQueue && actionQueue.counts.high > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs h-5 px-1.5">{actionQueue.counts.high}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="property_progress" className="gap-1.5">
            <Home className="h-4 w-4" />
            Property Progress
          </TabsTrigger>
          <TabsTrigger value="start_of_tenancy" className="gap-1.5">
            <CheckCircle className="h-4 w-4" />
            Start of Tenancy
          </TabsTrigger>
          <TabsTrigger value="rent_lifecycle" className="gap-1.5">
            <Banknote className="h-4 w-4" />
            Rent Lifecycle
          </TabsTrigger>
          <TabsTrigger value="rent_processing" className="gap-1.5">
            <PoundSterling className="h-4 w-4" />
            Rent Processing
          </TabsTrigger>
          <TabsTrigger value="end_of_tenancy" className="gap-1.5">
            <ClipboardList className="h-4 w-4" />
            End of Tenancy
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="gap-1.5">
            <Wrench className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="communications" className="gap-1.5">
            <Mail className="h-4 w-4" />
            Communications
          </TabsTrigger>
        </TabsList>

        {/* ======= TAB 1: ACTION QUEUE ======= */}
        <TabsContent value="action_queue">
          {/* Agent Control Panel */}
          <AgentControlPanel />

          {/* Message Router */}
          <div className="mb-4">
            <MessageRouterPanel />
          </div>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Action Queue</CardTitle>
                {actionQueue && (
                  <div className="flex gap-2 text-sm">
                    <Badge variant="destructive">{actionQueue.counts.high} urgent</Badge>
                    <Badge variant="secondary" className="bg-yellow-500 text-black">{actionQueue.counts.medium} medium</Badge>
                    <Badge variant="outline">{actionQueue.counts.low} low</Badge>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {actionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !actionQueue || actionQueue.items.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-medium text-green-700">All clear!</p>
                  <p className="text-muted-foreground">No urgent actions required right now.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleActionSort('priority')}>
                        <span className="flex items-center">Priority<SortIcon col="priority" /></span>
                      </TableHead>
                      <TableHead>Action Required</TableHead>
                      <TableHead>Property / Entity</TableHead>
                      <TableHead className="cursor-pointer select-none" onClick={() => toggleActionSort('due')}>
                        <span className="flex items-center">Due<SortIcon col="due" /></span>
                      </TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedActionItems(actionQueue.items).map((item) => (
                      <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50">
                        <TableCell>
                          <div className={`p-1.5 rounded ${
                            item.priority === 'high' ? 'bg-red-100 text-red-600'
                            : item.priority === 'medium' ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-500'
                          }`}>
                            {getActionIcon(item.icon)}
                          </div>
                        </TableCell>
                        <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{item.entity}</TableCell>
                        <TableCell className="text-sm">{item.dueDate ? formatDate(item.dueDate) : '-'}</TableCell>
                        <TableCell>
                          <Link href={item.link}>
                            <Button variant="ghost" size="sm">
                              <ArrowRight className="h-4 w-4" />
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

        {/* ======= TAB: PROPERTY PROGRESS ======= */}
        <TabsContent value="property_progress">
          <PropertyProgressTab />
        </TabsContent>

        {/* ======= TAB 2: START OF TENANCY ======= */}
        <TabsContent value="start_of_tenancy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Tenancy Onboarding</CardTitle>
                <Link href="/crm/tenancy-onboarding">
                  <Button size="sm" style={{ backgroundColor: BRAND }}>
                    Manage All <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Manage new tenancy setup — referencing, deposits, contract signing, inventory, and move-in.
              </p>
              <Link href="/crm/tenancy-onboarding">
                <Button variant="outline">
                  Open Tenancy Onboarding <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= RENT LIFECYCLE ======= */}
        <TabsContent value="rent_lifecycle">
          <RentLifecycleTab />
        </TabsContent>

        {/* ======= TAB 3: RENT PROCESSING AGENT ======= */}
        <TabsContent value="rent_processing">
          <RentProcessingAgent />
        </TabsContent>

        {/* ======= TAB 3: END OF TENANCY ======= */}
        <TabsContent value="end_of_tenancy">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>End of Tenancy Workflows</CardTitle>
                <Link href="/crm/end-of-tenancy">
                  <Button size="sm" style={{ backgroundColor: BRAND }}>
                    Manage All <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {eotLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Active end-of-tenancy processes */}
                  {endOfTenancyItems.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3">Active End-of-Tenancy Processes</h3>
                      <div className="space-y-3">
                        {endOfTenancyItems.map((t: any) => (
                          <Card key={t.id} className="border-l-4 border-l-orange-500">
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="font-medium">{t.property_address || t.propertyAddress || 'Unknown property'}</p>
                                  <p className="text-sm text-muted-foreground">
                                    Tenant: {t.tenant_name || t.tenantName || 'Unknown'} | Ends: {formatDate(t.end_date || t.endDate)}
                                  </p>
                                </div>
                                <Link href={`/crm/end-of-tenancy`}>
                                  <Button variant="outline" size="sm">
                                    Continue <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                  </Button>
                                </Link>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tenancies ending soon that need action */}
                  <div>
                    <h3 className="font-semibold mb-3">Tenancies Ending Soon (Action Needed)</h3>
                    {endingSoonItems.filter((t: any) => {
                      const end = new Date(t.end_date || t.endDate);
                      const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                      return days <= 90 && days > 0;
                    }).length === 0 ? (
                      <p className="text-muted-foreground text-center py-6">No tenancies requiring action in the next 90 days.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Property</TableHead>
                            <TableHead>Tenant</TableHead>
                            <TableHead>End Date</TableHead>
                            <TableHead>Days Left</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {endingSoonItems
                            .filter((t: any) => {
                              const end = new Date(t.end_date || t.endDate);
                              const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              return days <= 90 && days > 0;
                            })
                            .sort((a: any, b: any) => new Date(a.end_date || a.endDate).getTime() - new Date(b.end_date || b.endDate).getTime())
                            .slice(0, 20)
                            .map((t: any) => {
                              const days = Math.ceil((new Date(t.end_date || t.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                              return (
                                <TableRow key={t.id}>
                                  <TableCell className="font-medium">{t.property_address || t.propertyAddress}</TableCell>
                                  <TableCell>{t.tenant_name || t.tenantName}</TableCell>
                                  <TableCell>{formatDate(t.end_date || t.endDate)}</TableCell>
                                  <TableCell>
                                    <Badge variant={days <= 30 ? 'destructive' : days <= 60 ? 'secondary' : 'outline'}
                                      className={days <= 30 ? '' : days <= 60 ? 'bg-yellow-500 text-black' : ''}>
                                      <Clock className="h-3 w-3 mr-1" />{days} days
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Link href="/crm/end-of-tenancy">
                                      <Button variant="outline" size="sm">
                                        Start Process <ArrowRight className="h-3.5 w-3.5 ml-1" />
                                      </Button>
                                    </Link>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 15-step Checklist Reference */}
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">End-of-Tenancy Checklist (15 Steps)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                {[
                  { n: 1, label: 'Serve Notice', icon: '📋' },
                  { n: 2, label: 'Book Checkout Inspection', icon: '🔍' },
                  { n: 3, label: 'Inventory Checkout', icon: '📦' },
                  { n: 4, label: 'Meter Readings', icon: '⚡' },
                  { n: 5, label: 'Review Tenant Rent Account', icon: '💰' },
                  { n: 6, label: 'Tenant Utility Evidence', icon: '📄' },
                  { n: 7, label: 'Key Return', icon: '🔑' },
                  { n: 8, label: 'Assess Losses / DPS Claim', icon: '📊' },
                  { n: 9, label: 'Submit DPS Claim', icon: '📨' },
                  { n: 10, label: 'DPS Funds Release', icon: '🏦' },
                  { n: 11, label: 'Deposit Return to Landlord', icon: '💳' },
                  { n: 12, label: 'Final Account', icon: '📑' },
                  { n: 13, label: 'Utility Notifications', icon: '📬' },
                  { n: 14, label: 'Council Tax Notification', icon: '🏛️' },
                  { n: 15, label: 'Forwarding Address', icon: '📫' },
                ].map((step) => (
                  <div key={step.n} className="flex items-center gap-2 p-2 rounded border">
                    <span className="text-xs font-bold text-muted-foreground w-5">{step.n}</span>
                    <span>{step.icon}</span>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= TAB 4: MAINTENANCE ======= */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Maintenance Overview</CardTitle>
                <Link href="/crm/maintenance">
                  <Button size="sm" style={{ backgroundColor: BRAND }}>
                    Manage Tickets <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {maintenanceLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : maintenanceTickets.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                  <p className="text-lg font-medium text-green-700">No open tickets</p>
                  <p className="text-muted-foreground">All maintenance requests have been resolved.</p>
                </div>
              ) : (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {['emergency', 'urgent', 'routine', 'low'].map(urgency => {
                      const count = maintenanceTickets.filter((t: any) => t.urgency === urgency && !['completed', 'closed'].includes(t.status)).length;
                      const color = urgency === 'emergency' ? 'bg-red-100 text-red-700 border-red-200'
                        : urgency === 'urgent' ? 'bg-orange-100 text-orange-700 border-orange-200'
                        : urgency === 'routine' ? 'bg-blue-100 text-blue-700 border-blue-200'
                        : 'bg-gray-100 text-gray-600 border-gray-200';
                      return (
                        <Card key={urgency} className={`border ${color}`}>
                          <CardContent className="p-4 text-center">
                            <p className="text-2xl font-bold">{count}</p>
                            <p className="text-sm font-medium capitalize">{urgency}</p>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {/* Recent open tickets */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticket</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Urgency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {maintenanceTickets
                        .filter((t: any) => !['completed', 'closed'].includes(t.status))
                        .slice(0, 15)
                        .map((t: any) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell className="text-sm">{t.property_address || t.propertyAddress || '-'}</TableCell>
                            <TableCell>{getUrgencyBadge(t.urgency)}</TableCell>
                            <TableCell>{getMaintenanceStatusBadge(t.status)}</TableCell>
                            <TableCell className="text-sm">{formatDate(t.created_at || t.createdAt)}</TableCell>
                            <TableCell>
                              <Link href="/crm/maintenance">
                                <Button variant="ghost" size="sm"><ArrowRight className="h-4 w-4" /></Button>
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ======= TAB 5: COMMUNICATIONS ======= */}
        <TabsContent value="communications">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>PM Communications</CardTitle>
                <div className="flex gap-2">
                  <Link href="/crm/inbox/lettings"><Button variant="outline" size="sm">Lettings Inbox</Button></Link>
                  <Link href="/crm/inbox/maintenance"><Button variant="outline" size="sm">Maintenance Inbox</Button></Link>
                  <Link href="/crm/inbox/admin"><Button variant="outline" size="sm">Admin Inbox</Button></Link>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Lettings', category: 'lettings', color: 'purple', link: '/crm/inbox/lettings' },
                  { label: 'Maintenance', category: 'maintenance', color: 'orange', link: '/crm/inbox/maintenance' },
                  { label: 'Admin', category: 'admin', color: 'gray', link: '/crm/inbox/admin' },
                ].map((inbox) => (
                  <Link key={inbox.category} href={inbox.link}>
                    <Card className="cursor-pointer hover:shadow-md transition-shadow h-full">
                      <CardContent className="p-6 text-center">
                        <Mail className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                        <p className="font-semibold">{inbox.label} Inbox</p>
                        <p className="text-xs text-muted-foreground mt-1">View emails and communications</p>
                        <Button variant="outline" size="sm" className="mt-3">
                          Open <ArrowRight className="h-3.5 w-3.5 ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>

              <div className="mt-6 border-t pt-6">
                <p className="text-muted-foreground text-center">
                  All property management communications are accessible through the department inboxes above.
                  Emails related to specific properties, tenancies, and tenants can be found in each inbox.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
