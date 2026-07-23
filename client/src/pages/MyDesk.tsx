import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft, Calendar, Mail, MessageSquare, Home, Users,
  Clock, MapPin, Building, CheckCircle, AlertCircle,
  Phone, Send, Inbox, Plus, Play, Check, X, UserPlus,
  ClipboardList, ListTodo, Target, ChevronRight, Eye,
  PhoneCall, MessagesSquare, Plug, RefreshCw, Trash2,
  Loader2, Wrench, FileText, CalendarPlus, BarChart3,
  Reply, Forward, Paperclip, Star, MailPlus, ChevronLeft
} from 'lucide-react';

// Helpers
const formatRelativeTime = (d: string | Date | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
};

const formatTime = (d: string | Date | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
};

const formatDate = (d: string | Date | undefined): string => {
  if (!d) return '';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const priorityColors: Record<string, string> = {
  urgent: 'bg-red-100 text-red-800 border-red-300',
  high: 'bg-orange-100 text-orange-800 border-orange-300',
  normal: 'bg-blue-100 text-blue-800 border-blue-300',
  low: 'bg-gray-100 text-gray-600 border-gray-300',
};

const taskTypeColors: Record<string, string> = {
  viewing: 'bg-blue-50 text-blue-700',
  call: 'bg-green-50 text-green-700',
  follow_up: 'bg-purple-50 text-purple-700',
  enquiry_response: 'bg-amber-50 text-amber-700',
  property_assignment: 'bg-indigo-50 text-indigo-700',
  document: 'bg-gray-50 text-gray-700',
  maintenance: 'bg-red-50 text-red-700',
  general: 'bg-slate-50 text-slate-700',
};

const leadStatusColors: Record<string, string> = {
  new: 'bg-emerald-100 text-emerald-800',
  contacted: 'bg-blue-100 text-blue-800',
  qualified: 'bg-purple-100 text-purple-800',
  viewing_booked: 'bg-indigo-100 text-indigo-800',
  offer_made: 'bg-amber-100 text-amber-800',
  converted: 'bg-green-100 text-green-800',
  lost: 'bg-red-100 text-red-800',
  archived: 'bg-gray-100 text-gray-800',
};

const eventTypeColors: Record<string, string> = {
  viewing: 'bg-blue-100 text-blue-800 border-blue-200',
  valuation: 'bg-purple-100 text-purple-800 border-purple-200',
  meeting: 'bg-green-100 text-green-800 border-green-200',
  internal_meeting: 'bg-teal-100 text-teal-800 border-teal-200',
  client_meeting: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  landlord_meeting: 'bg-amber-100 text-amber-800 border-amber-200',
  inspection: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  maintenance: 'bg-red-100 text-red-800 border-red-200',
  other: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function MyDesk() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('tasks');
  const [showNewTaskDialog, setShowNewTaskDialog] = useState(false);
  const [taskFilter, setTaskFilter] = useState<string>('active');
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignTarget, setAssignTarget] = useState<{ type: 'property' | 'lead'; id: number } | null>(null);

  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    taskType: 'general',
    priority: 'normal',
    assignedToId: '',
    dueDate: '',
    propertyId: '',
    leadId: '',
    notes: '',
  });

  const [connectingM365, setConnectingM365] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<number | null>(null);
  const [showSmtpDialog, setShowSmtpDialog] = useState(false);
  const [connectingSmtp, setConnectingSmtp] = useState(false);
  const [testingSmtp, setTestingSmtp] = useState(false);
  const [smtpTestResult, setSmtpTestResult] = useState<any>(null);
  const [smtpForm, setSmtpForm] = useState({
    smtpHost: '', smtpPort: '587', smtpUser: '', smtpPassword: '', smtpSecure: false,
    imapHost: '', imapPort: '993', imapUser: '', imapPassword: '', imapTls: true,
  });

  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(new Date());

  // Email client state
  const [emailFolder, setEmailFolder] = useState<'inbox' | 'sent'>('inbox');
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [showComposeDialog, setShowComposeDialog] = useState(false);
  const [replyToEmail, setReplyToEmail] = useState<any>(null);
  const [composeForm, setComposeForm] = useState({ to: '', cc: '', subject: '', body: '', fromConnectionId: 0 });
  const [visibleConnectionIds, setVisibleConnectionIds] = useState<Set<number>>(new Set());

  const clearance = (user as any)?.securityClearance || 3;
  const canAssign = clearance >= 7;

  // Handle OAuth callback success/error from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    if (success) {
      toast({ title: 'Email Connected', description: success });
      window.history.replaceState({}, '', window.location.pathname);
    }
    if (error) {
      toast({ title: 'Connection Error', description: error, variant: 'destructive' });
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [toast]);

  // === DATA FETCHING ===

  const { data: stats } = useQuery<any>({
    queryKey: ['/api/crm/my-desk/stats'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-desk/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: myTasks = [], isLoading: loadingTasks } = useQuery<any[]>({
    queryKey: ['/api/crm/tasks/my', taskFilter],
    queryFn: async () => {
      const params = taskFilter === 'active' ? '?status=pending&status=in_progress' : taskFilter === 'completed' ? '?status=completed' : '';
      const res = await fetch(`/api/crm/tasks/my${params ? params.replace('&status=in_progress', '') : ''}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const all = await res.json();
      if (taskFilter === 'active') return all.filter((t: any) => t.status === 'pending' || t.status === 'in_progress');
      if (taskFilter === 'completed') return all.filter((t: any) => t.status === 'completed');
      return all;
    },
  });

  const { data: enquiries = [], isLoading: loadingEnquiries } = useQuery<any[]>({
    queryKey: ['/api/crm/my-desk/enquiries'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-desk/enquiries', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch enquiries');
      return res.json();
    },
  });

  const { data: myLeads = [], isLoading: loadingLeads } = useQuery<any[]>({
    queryKey: ['/api/crm/my-desk/leads'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-desk/leads', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch leads');
      return res.json();
    },
  });

  const { data: portfolio = [], isLoading: loadingPortfolio } = useQuery<any>({
    queryKey: ['/api/crm/my-desk/properties'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-desk/properties', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch portfolio');
      const data = await res.json();
      return data.properties || [];
    },
  });

  const { data: schedule = [], isLoading: loadingSchedule } = useQuery<any[]>({
    queryKey: ['/api/crm/my-desk/schedule'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-desk/schedule', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch schedule');
      return res.json();
    },
  });

  // All calendar events for the month view
  const { data: calendarEvents = [], isLoading: loadingCalEvents } = useQuery<any[]>({
    queryKey: ['/api/crm/calendar-events'],
    queryFn: async () => {
      const res = await fetch('/api/crm/calendar-events', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: commsData } = useQuery<any>({
    queryKey: ['/api/crm/my-desk/communications'],
    queryFn: async () => {
      const res = await fetch('/api/crm/my-desk/communications?limit=15', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch comms');
      return res.json();
    },
  });

  // M365 Email Connection
  const { data: emailStatus } = useQuery<any>({
    queryKey: ['/api/email-integration/status'],
    queryFn: async () => {
      const res = await fetch('/api/email-integration/status', { credentials: 'include' });
      if (!res.ok) return { configured: false, connections: [] };
      return res.json();
    },
    retry: false,
  });

  const { data: emailConnections = [], refetch: refetchEmailConns } = useQuery<any[]>({
    queryKey: ['/api/email-integration/connections'],
    queryFn: async () => {
      const res = await fetch('/api/email-integration/connections', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    retry: false,
  });

  // Initialize visible connections when connections load
  useEffect(() => {
    if (emailConnections.length > 0 && visibleConnectionIds.size === 0) {
      setVisibleConnectionIds(new Set(emailConnections.map((c: any) => c.id)));
    }
  }, [emailConnections]);

  const toggleConnectionVisibility = (connId: number) => {
    setVisibleConnectionIds(prev => {
      const next = new Set(prev);
      if (next.has(connId)) {
        // Don't allow deselecting all - keep at least one
        if (next.size > 1) next.delete(connId);
      } else {
        next.add(connId);
      }
      return next;
    });
    setSelectedEmailId(null);
  };

  // Fetch inbox emails from M365 integration
  const { data: inboxEmails = [], isLoading: loadingInbox } = useQuery<any[]>({
    queryKey: ['/api/email-integration/emails', emailFolder],
    queryFn: async () => {
      const res = await fetch('/api/email-integration/emails?limit=50', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: emailFolder === 'inbox' && emailConnections.length > 0,
    retry: false,
  });

  // Fetch sent emails
  const { data: sentEmails = [], isLoading: loadingSent } = useQuery<any[]>({
    queryKey: ['/api/email-integration/sent'],
    queryFn: async () => {
      const res = await fetch('/api/email-integration/sent?limit=50', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: emailFolder === 'sent' && emailConnections.length > 0,
    retry: false,
  });

  // Filter emails by visible connections
  const filteredInboxEmails = inboxEmails.filter((e: any) => visibleConnectionIds.has(e.connectionId));
  const filteredSentEmails = sentEmails.filter((e: any) => visibleConnectionIds.has(e.connectionId));

  // Fetch selected email detail
  const { data: selectedEmail, isLoading: loadingEmailDetail } = useQuery<any>({
    queryKey: ['/api/email-integration/emails', selectedEmailId],
    queryFn: async () => {
      const res = await fetch(`/api/email-integration/emails/${selectedEmailId}`, { credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!selectedEmailId,
    retry: false,
  });

  const handleConnectM365 = async () => {
    setConnectingM365(true);
    try {
      const res = await fetch('/api/email-integration/oauth/authorize', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to start connection');
      const data = await res.json();
      window.location.href = data.authorizationUrl;
    } catch (err) {
      toast({ title: 'Connection Failed', description: err instanceof Error ? err.message : 'Could not connect', variant: 'destructive' });
      setConnectingM365(false);
    }
  };

  const handleDisconnectM365 = async (id: number) => {
    setDisconnectingId(id);
    try {
      await fetch(`/api/email-integration/connections/${id}`, { method: 'DELETE', credentials: 'include' });
      toast({ title: 'Disconnected', description: 'Email account removed.' });
      refetchEmailConns();
    } catch {
      toast({ title: 'Error', description: 'Failed to disconnect.', variant: 'destructive' });
    } finally {
      setDisconnectingId(null);
    }
  };

  const handleSyncM365 = async (id: number) => {
    try {
      await fetch(`/api/email-integration/connections/${id}/sync`, { method: 'POST', credentials: 'include' });
      toast({ title: 'Sync Started', description: 'Email sync queued.' });
    } catch {
      toast({ title: 'Sync Failed', description: 'Could not start sync.', variant: 'destructive' });
    }
  };

  // SMTP connection handlers
  const handleTestSmtp = async () => {
    setTestingSmtp(true);
    setSmtpTestResult(null);
    try {
      const res = await fetch('/api/email-integration/test-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          smtpHost: smtpForm.smtpHost,
          smtpPort: parseInt(smtpForm.smtpPort) || 587,
          smtpUser: smtpForm.smtpUser,
          smtpPassword: smtpForm.smtpPassword,
          smtpSecure: smtpForm.smtpSecure,
          imapHost: smtpForm.imapHost,
          imapPort: parseInt(smtpForm.imapPort) || 993,
          imapUser: smtpForm.imapUser,
          imapPassword: smtpForm.imapPassword,
          imapTls: smtpForm.imapTls,
        }),
      });
      const result = await res.json();
      setSmtpTestResult(result);
    } catch {
      setSmtpTestResult({ smtp: false, imap: false, smtpError: 'Connection failed', imapError: 'Connection failed' });
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleConnectSmtp = async () => {
    setConnectingSmtp(true);
    try {
      const res = await fetch('/api/email-integration/connect-smtp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          smtpHost: smtpForm.smtpHost,
          smtpPort: parseInt(smtpForm.smtpPort) || 587,
          smtpUser: smtpForm.smtpUser,
          smtpPassword: smtpForm.smtpPassword,
          smtpSecure: smtpForm.smtpSecure,
          imapHost: smtpForm.imapHost,
          imapPort: parseInt(smtpForm.imapPort) || 993,
          imapUser: smtpForm.imapUser,
          imapPassword: smtpForm.imapPassword,
          imapTls: smtpForm.imapTls,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to connect');
      }
      toast({ title: 'Email Connected', description: `Connected ${smtpForm.smtpUser} via SMTP/IMAP` });
      setShowSmtpDialog(false);
      setSmtpForm({ smtpHost: '', smtpPort: '587', smtpUser: '', smtpPassword: '', smtpSecure: false, imapHost: '', imapPort: '993', imapUser: '', imapPassword: '', imapTls: true });
      setSmtpTestResult(null);
      refetchEmailConns();
    } catch (err) {
      toast({ title: 'Connection Failed', description: err instanceof Error ? err.message : 'Could not connect', variant: 'destructive' });
    } finally {
      setConnectingSmtp(false);
    }
  };

  // Send email handler
  const [sendingEmail, setSendingEmail] = useState(false);
  const handleSendEmail = async () => {
    if (!composeForm.to || !composeForm.subject) {
      toast({ title: 'Missing Fields', description: 'To and Subject are required.', variant: 'destructive' });
      return;
    }
    const activeConn = composeForm.fromConnectionId
      ? emailConnections.find((c: any) => c.id === composeForm.fromConnectionId)
      : emailConnections.find((c: any) => c.status === 'active');
    if (!activeConn) {
      toast({ title: 'No Connection', description: 'Connect your email account first.', variant: 'destructive' });
      return;
    }
    setSendingEmail(true);
    try {
      const payload: any = {
        connectionId: activeConn.id,
        to: composeForm.to.split(',').map((e: string) => e.trim()).filter(Boolean),
        cc: composeForm.cc ? composeForm.cc.split(',').map((e: string) => e.trim()).filter(Boolean) : undefined,
        subject: composeForm.subject,
        bodyText: composeForm.body,
        bodyHtml: `<p>${composeForm.body.replace(/\n/g, '<br/>')}</p>`,
      };
      if (replyToEmail) {
        payload.inReplyToMessageId = replyToEmail.internetMessageId || undefined;
      }
      const res = await fetch('/api/email-integration/send-immediate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send');
      }
      toast({ title: 'Email Sent', description: `Sent to ${composeForm.to}` });
      setShowComposeDialog(false);
      setReplyToEmail(null);
      setComposeForm({ to: '', cc: '', subject: '', body: '', fromConnectionId: 0 });
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration/sent'] });
    } catch (err) {
      toast({ title: 'Send Failed', description: err instanceof Error ? err.message : 'Error sending email', variant: 'destructive' });
    } finally {
      setSendingEmail(false);
    }
  };

  const handleReply = (email: any) => {
    setReplyToEmail(email);
    setComposeForm({
      to: email.fromAddress || '',
      cc: '',
      subject: `Re: ${email.subject || ''}`,
      body: `\n\n--- Original Message ---\nFrom: ${email.fromName || email.fromAddress}\nDate: ${formatDate(email.receivedAt)}\nSubject: ${email.subject || ''}\n\n${email.bodyPreview || ''}`,
      fromConnectionId: email.connectionId || 0,
    });
    setShowComposeDialog(true);
  };

  const { data: agentsList = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/users', 'agents'],
    queryFn: async () => {
      const res = await fetch('/api/crm/users?role=agent', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canAssign,
  });

  // === MUTATIONS ===

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('/api/crm/tasks', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/my-desk/stats'] });
      toast({ title: 'Task created' });
      setShowNewTaskDialog(false);
      setNewTask({ title: '', description: '', taskType: 'general', priority: 'normal', assignedToId: '', dueDate: '', propertyId: '', leadId: '', notes: '' });
    },
    onError: (err: any) => toast({ title: 'Failed to create task', description: err.message, variant: 'destructive' }),
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: any) => apiRequest(`/api/crm/tasks/${id}`, 'PATCH', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks/my'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/my-desk/stats'] });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({ type, id, agentId }: { type: string; id: number; agentId: number }) => {
      if (type === 'property') return apiRequest(`/api/crm/properties/${id}/assign`, 'PATCH', { agentId });
      return apiRequest(`/api/crm/leads/${id}/assign`, 'PATCH', { assignedTo: agentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/my-desk/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/my-desk/leads'] });
      toast({ title: 'Assignment updated' });
      setShowAssignDialog(false);
    },
  });

  const handleCreateTask = () => {
    createTaskMutation.mutate({
      title: newTask.title,
      description: newTask.description || undefined,
      taskType: newTask.taskType,
      priority: newTask.priority,
      assignedToId: newTask.assignedToId ? parseInt(newTask.assignedToId) : undefined,
      dueDate: newTask.dueDate || undefined,
      propertyId: newTask.propertyId ? parseInt(newTask.propertyId) : undefined,
      leadId: newTask.leadId ? parseInt(newTask.leadId) : undefined,
      notes: newTask.notes || undefined,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-[#791E75]" />
          My Desk
        </h1>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => setShowNewTaskDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />
            New Task
          </Button>
          <div className="text-sm text-gray-500">
            <span className="font-medium text-gray-700">{(user as any)?.fullName || (user as any)?.username}</span>
            <Badge variant="outline" className="ml-2 text-[10px]">{(user as any)?.accessLevelCode || (user as any)?.role}</Badge>
          </div>
        </div>
      </div>
        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {[
            { label: 'Tasks', value: stats?.pendingTasks, icon: ListTodo, color: 'text-purple-600 bg-purple-100', tab: 'tasks' },
            { label: 'Enquiries', value: stats?.newEnquiries, icon: Inbox, color: 'text-amber-600 bg-amber-100', tab: 'enquiries' },
            { label: 'Leads', value: stats?.activeLeads, icon: Target, color: 'text-green-600 bg-green-100', tab: 'leads' },
            { label: 'Properties', value: portfolio.length, icon: Home, color: 'text-blue-600 bg-blue-100', tab: 'portfolio' },
            { label: "Today", value: stats?.todayEvents, icon: Calendar, color: 'text-indigo-600 bg-indigo-100', tab: 'schedule' },
            { label: 'Viewings', value: stats?.upcomingViewings, icon: Eye, color: 'text-cyan-600 bg-cyan-100', tab: 'schedule' },
            { label: 'Emails', value: stats?.unreadEmails, icon: Mail, color: 'text-red-600 bg-red-100', tab: 'comms' },
            { label: 'WhatsApp', value: stats?.openWhatsappConversations, icon: MessageSquare, color: 'text-emerald-600 bg-emerald-100', tab: 'comms' },
          ].map((stat) => (
            <Card key={stat.label} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab(stat.tab)}>
              <CardContent className="pt-3 pb-3 text-center">
                <stat.icon className={`h-4 w-4 mx-auto mb-1 ${stat.color.split(' ')[0]}`} />
                <p className="text-xl font-bold">{stat.value ?? '-'}</p>
                <p className="text-[10px] text-gray-500">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-semibold text-[#791E75]">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:bg-gray-50" onClick={() => setLocation('/crm/properties/create')}>
                <Plus className="h-5 w-5" />
                <span className="text-xs">Add Property</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:bg-gray-50" onClick={() => setLocation('/crm/support-tickets')}>
                <Wrench className="h-5 w-5" />
                <span className="text-xs">New Ticket</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:bg-gray-50" onClick={() => setLocation('/crm/calendar?new=viewing')}>
                <CalendarPlus className="h-5 w-5" />
                <span className="text-xs">Schedule Viewing</span>
              </Button>
              <Button variant="outline" className="h-auto py-4 flex flex-col gap-2 hover:bg-gray-50" onClick={() => setLocation('/crm/reports')}>
                <FileText className="h-5 w-5" />
                <span className="text-xs">Generate Reports</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="tasks" className="text-xs">Tasks</TabsTrigger>
            <TabsTrigger value="enquiries" className="text-xs">Enquiries</TabsTrigger>
            <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
            <TabsTrigger value="portfolio" className="text-xs">Portfolio</TabsTrigger>
            <TabsTrigger value="schedule" className="text-xs">Schedule</TabsTrigger>
            <TabsTrigger value="comms" className="text-xs">Comms</TabsTrigger>
          </TabsList>

          {/* ========== TASKS TAB ========== */}
          <TabsContent value="tasks">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ListTodo className="h-5 w-5" />
                    Task Queue
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Select value={taskFilter} onValueChange={setTaskFilter}>
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button size="sm" onClick={() => setShowNewTaskDialog(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Add
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingTasks ? (
                  <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#791E75]" /></div>
                ) : myTasks.length === 0 ? (
                  <div className="text-center py-10">
                    <CheckCircle className="h-10 w-10 text-green-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">{taskFilter === 'active' ? 'No pending tasks — nice work!' : 'No tasks found'}</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myTasks.map((task: any) => (
                      <div key={task.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors hover:bg-gray-50 ${task.status === 'in_progress' ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100'}`}>
                        {/* Status toggle */}
                        <div className="flex-shrink-0">
                          {task.status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-500" />
                          ) : task.status === 'in_progress' ? (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateTaskMutation.mutate({ id: task.id, status: 'completed' })}>
                              <Play className="h-4 w-4 text-blue-500" />
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => updateTaskMutation.mutate({ id: task.id, status: 'in_progress' })}>
                              <div className="h-4 w-4 rounded-full border-2 border-gray-300" />
                            </Button>
                          )}
                        </div>
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-sm font-medium ${task.status === 'completed' ? 'line-through text-gray-400' : ''}`}>{task.title}</span>
                            <Badge variant="outline" className={`text-[10px] ${taskTypeColors[task.taskType] || ''}`}>{task.taskType.replace('_', ' ')}</Badge>
                            <Badge variant="outline" className={`text-[10px] ${priorityColors[task.priority] || ''}`}>{task.priority}</Badge>
                          </div>
                          {task.description && <p className="text-xs text-gray-500 truncate">{task.description}</p>}
                          <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-1">
                            {task.dueDate && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> Due {formatDate(task.dueDate)}</span>}
                            {task.assignedByName && <span>From: {task.assignedByName}</span>}
                          </div>
                        </div>
                        {/* Actions */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {task.status !== 'completed' && (
                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => updateTaskMutation.mutate({ id: task.id, status: 'completed' })}>
                              <Check className="h-3 w-3 mr-1" />Done
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== ENQUIRIES TAB ========== */}
          <TabsContent value="enquiries">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Inbox className="h-5 w-5" />
                  New Enquiries ({enquiries.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingEnquiries ? (
                  <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#791E75]" /></div>
                ) : enquiries.length === 0 ? (
                  <div className="text-center py-10">
                    <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No new enquiries</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {enquiries.map((enq: any) => (
                      <div key={`${enq.type}-${enq.id}`} className="p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold">{enq.contactName}</span>
                              <Badge variant="outline" className="text-[10px]">
                                {enq.type === 'property_inquiry' ? enq.inquiryType : enq.enquiryType}
                              </Badge>
                              <Badge variant="secondary" className="text-[10px]">
                                {enq.type === 'property_inquiry' ? 'Property Inquiry' : 'Customer Enquiry'}
                              </Badge>
                            </div>
                            {enq.message && <p className="text-sm text-gray-600 line-clamp-2 mb-2">{enq.message}</p>}
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              {enq.contactEmail && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {enq.contactEmail}</span>}
                              {enq.contactPhone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {enq.contactPhone}</span>}
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatRelativeTime(enq.createdAt)}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 ml-3">
                            {enq.contactPhone && (
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(`tel:${enq.contactPhone}`)}>
                                <PhoneCall className="h-3 w-3 mr-1" />Call
                              </Button>
                            )}
                            {enq.contactPhone && (
                              <Button variant="outline" size="sm" className="h-7 text-xs bg-green-50" onClick={() => window.open(`https://wa.me/${enq.contactPhone.replace(/\D/g, '')}`)}>
                                <MessagesSquare className="h-3 w-3 mr-1" />WhatsApp
                              </Button>
                            )}
                            {enq.contactEmail && (
                              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => window.open(`mailto:${enq.contactEmail}`)}>
                                <Mail className="h-3 w-3 mr-1" />Email
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== LEADS TAB ========== */}
          <TabsContent value="leads">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  My Leads ({myLeads.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingLeads ? (
                  <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#791E75]" /></div>
                ) : myLeads.length === 0 ? (
                  <div className="text-center py-10">
                    <Target className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No leads assigned to you</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myLeads.map((lead: any) => (
                      <div key={lead.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setLocation(`/crm/leads`)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-sm font-semibold">{lead.fullName}</span>
                            <Badge className={`text-[10px] ${leadStatusColors[lead.status] || ''}`}>{lead.status?.replace('_', ' ')}</Badge>
                            {lead.priority && <Badge variant="outline" className={`text-[10px] ${priorityColors[lead.priority] || ''}`}>{lead.priority}</Badge>}
                            {lead.leadType && <Badge variant="outline" className="text-[10px]">{lead.leadType}</Badge>}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.phone}</span>}
                            {lead.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.email}</span>}
                            {(lead.minBudget || lead.maxBudget) && (
                              <span>Budget: {lead.minBudget ? `£${(lead.minBudget / 100).toLocaleString()}` : '?'} - {lead.maxBudget ? `£${(lead.maxBudget / 100).toLocaleString()}` : '?'}</span>
                            )}
                            {lead.nextFollowUpDate && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Follow-up: {formatDate(lead.nextFollowUpDate)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                          {lead.phone && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(`tel:${lead.phone}`)}>
                              <PhoneCall className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          {lead.phone && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, '')}`)}>
                              <MessagesSquare className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                          )}
                          {canAssign && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setAssignTarget({ type: 'lead', id: lead.id }); setShowAssignDialog(true); }}>
                              <UserPlus className="h-3.5 w-3.5 text-purple-600" />
                            </Button>
                          )}
                          <ChevronRight className="h-4 w-4 text-gray-300" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== PORTFOLIO TAB ========== */}
          <TabsContent value="portfolio">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  My Portfolio ({portfolio.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingPortfolio ? (
                  <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#791E75]" /></div>
                ) : portfolio.length === 0 ? (
                  <div className="text-center py-10">
                    <Home className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">No properties assigned to you</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Address</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Price/Rent</TableHead>
                          <TableHead>Role</TableHead>
                          {canAssign && <TableHead>Assign</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {portfolio.map((prop: any) => (
                          <TableRow key={prop.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setLocation(`/crm/properties/${prop.id}/edit`)}>
                            <TableCell>
                              <div className="font-medium text-sm">{prop.addressLine1 || prop.address}</div>
                              <div className="text-xs text-gray-500">{prop.city} {prop.postcode}</div>
                            </TableCell>
                            <TableCell><Badge variant="outline" className="text-xs">{prop.propertyType || 'N/A'}</Badge></TableCell>
                            <TableCell><Badge variant={prop.status === 'active' ? 'default' : 'secondary'} className="text-xs">{prop.status || 'N/A'}</Badge></TableCell>
                            <TableCell className="text-sm">
                              {prop.price ? `£${Number(prop.price).toLocaleString()}` : prop.rentAmount ? `£${Number(prop.rentAmount).toLocaleString()} ${prop.rentPeriod || 'pcm'}` : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={`text-xs ${prop.role === 'admin' ? 'bg-red-50 text-red-700' : prop.role === 'both' ? 'bg-purple-50 text-purple-700' : prop.role === 'agent' ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                                {prop.role === 'admin' ? 'Admin' : prop.role === 'both' ? 'Agent & PM' : prop.role === 'agent' ? 'Agent' : 'PM'}
                              </Badge>
                            </TableCell>
                            {canAssign && (
                              <TableCell onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setAssignTarget({ type: 'property', id: prop.id }); setShowAssignDialog(true); }}>
                                  <UserPlus className="h-3 w-3 mr-1" />Assign
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ========== SCHEDULE TAB ========== */}
          <TabsContent value="schedule">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Mini Calendar */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <CardTitle className="text-sm font-semibold">
                      {calendarDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                    </CardTitle>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                      <div key={d} className="text-center text-[10px] font-medium text-gray-400 py-1">{d}</div>
                    ))}
                  </div>
                  {/* Calendar grid */}
                  <div className="grid grid-cols-7">
                    {(() => {
                      const year = calendarDate.getFullYear();
                      const month = calendarDate.getMonth();
                      const firstDay = new Date(year, month, 1);
                      const lastDay = new Date(year, month + 1, 0);
                      const days: (Date | null)[] = [];
                      for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
                      for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
                      const remaining = 42 - days.length;
                      for (let i = 0; i < remaining; i++) days.push(null);

                      const today = new Date();
                      return days.map((day, idx) => {
                        if (!day) return <div key={`empty-${idx}`} className="h-8" />;
                        const isToday = day.toDateString() === today.toDateString();
                        const isSelected = day.toDateString() === calendarSelectedDate.toDateString();
                        const dayEvents = calendarEvents.filter((e: any) => {
                          const ed = new Date(e.startTime);
                          return ed.getDate() === day.getDate() && ed.getMonth() === day.getMonth() && ed.getFullYear() === day.getFullYear();
                        });
                        return (
                          <button
                            key={day.toISOString()}
                            className={`h-8 w-full flex flex-col items-center justify-center rounded text-xs transition-colors relative
                              ${isSelected ? 'bg-[#791E75] text-white' : isToday ? 'bg-purple-100 text-purple-800 font-bold' : 'hover:bg-gray-100'}
                            `}
                            onClick={() => setCalendarSelectedDate(day)}
                          >
                            {day.getDate()}
                            {dayEvents.length > 0 && (
                              <div className={`absolute bottom-0.5 flex gap-0.5`}>
                                {dayEvents.slice(0, 3).map((_: any, i: number) => (
                                  <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-[#791E75]'}`} />
                                ))}
                              </div>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                  {/* Today button */}
                  <div className="mt-2 flex justify-between items-center">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setCalendarDate(new Date()); setCalendarSelectedDate(new Date()); }}>
                      Today
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setLocation('/crm/calendar')}>
                      <Calendar className="h-3 w-3 mr-1" /> Full Calendar
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Events for selected date */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {calendarSelectedDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </CardTitle>
                    <Button size="sm" className="h-8 text-xs" onClick={() => setLocation('/crm/calendar')}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> New Event
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCalEvents ? (
                    <div className="flex items-center justify-center h-24"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#791E75]" /></div>
                  ) : (() => {
                    const dayEvents = calendarEvents.filter((e: any) => {
                      const ed = new Date(e.startTime);
                      return ed.getDate() === calendarSelectedDate.getDate() && ed.getMonth() === calendarSelectedDate.getMonth() && ed.getFullYear() === calendarSelectedDate.getFullYear();
                    }).sort((a: any, b: any) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

                    return dayEvents.length === 0 ? (
                      <div className="text-center py-10">
                        <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500 text-sm">No events on this day</p>
                        <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => setLocation('/crm/calendar')}>
                          <Plus className="h-3 w-3 mr-1" /> Schedule Something
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayEvents.map((event: any) => (
                          <div
                            key={event.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-md transition-shadow ${eventTypeColors[event.eventType] || eventTypeColors.other}`}
                            onClick={() => setLocation(`/crm/calendar?date=${new Date(event.startTime).toISOString().slice(0, 10)}&eventId=${event.id}`)}
                          >
                            <div className="text-center flex-shrink-0 w-16">
                              <p className="text-sm font-bold">{formatTime(event.startTime)}</p>
                              <p className="text-[10px] text-gray-500">{formatTime(event.endTime)}</p>
                            </div>
                            <div className="h-8 w-px bg-gray-300" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{event.title}</p>
                              <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5 flex-wrap">
                                <Badge variant="outline" className="text-[10px]">{event.eventType?.replace('_', ' ')}</Badge>
                                {event.organizerName && <span className="flex items-center gap-1"><Users className="h-3 w-3" />{event.organizerName}</span>}
                                {event.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location}</span>}
                                {event.propertyAddress && <span className="flex items-center gap-1"><Home className="h-3 w-3" />{event.propertyAddress}</span>}
                              </div>
                              {event.description && <p className="text-xs text-gray-400 truncate mt-1">{event.description}</p>}
                            </div>
                            {event.status && (
                              <Badge variant={event.status === 'confirmed' ? 'default' : 'secondary'} className="text-[10px] flex-shrink-0">
                                {event.status}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ========== COMMS TAB ========== */}
          <TabsContent value="comms">
            <div className="space-y-4">

              {/* Email Connection Status Bar */}
              {emailConnections.length === 0 ? (
                <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-white">
                  <CardContent className="py-6">
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex-shrink-0 w-12 h-12 bg-gray-700 rounded-lg flex items-center justify-center">
                        <Mail className="h-6 w-6 text-white" />
                      </div>
                      <div className="text-center">
                        <h3 className="font-semibold text-base">Connect Your Email</h3>
                        <p className="text-sm text-gray-500 mt-1">Send, receive, and manage emails from your CRM desk. Choose your email provider to get started.</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <Button onClick={handleConnectM365} disabled={connectingM365 || !emailStatus?.configured} className="bg-[#0078d4] hover:bg-[#106ebe] text-white" size="lg">
                          {connectingM365 ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
                          Microsoft 365
                        </Button>
                        <Button onClick={() => setShowSmtpDialog(true)} variant="outline" size="lg">
                          <Wrench className="h-4 w-4 mr-2" />
                          SMTP / IMAP
                        </Button>
                      </div>
                      {!emailStatus?.configured && (
                        <p className="text-xs text-amber-600 text-center">M365 not configured by admin. Use SMTP/IMAP for other email providers.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Connected account bar — click to toggle visibility */}
                  <div className="flex items-center justify-between bg-white border rounded-lg px-4 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {emailConnections.map((conn: any) => {
                        const isVisible = visibleConnectionIds.has(conn.id);
                        return (
                          <button
                            key={conn.id}
                            onClick={() => toggleConnectionVisibility(conn.id)}
                            className={`flex items-center gap-2 px-2 py-1 rounded-md border transition-all ${
                              isVisible
                                ? 'border-blue-300 bg-blue-50 opacity-100'
                                : 'border-gray-200 bg-gray-50 opacity-50'
                            }`}
                            title={isVisible ? `Click to hide ${conn.mailboxUpn}` : `Click to show ${conn.mailboxUpn}`}
                          >
                            <div className={`w-6 h-6 ${conn.provider === 'microsoft' ? 'bg-[#0078d4]' : 'bg-gray-600'} rounded flex items-center justify-center`}>
                              <Mail className="h-3 w-3 text-white" />
                            </div>
                            <div className={`w-2 h-2 rounded-full ${conn.status === 'active' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                            <span className="text-xs font-medium">{conn.mailboxUpn}</span>
                            <Badge variant="outline" className="text-[10px]">{conn.provider === 'smtp' ? 'SMTP' : 'M365'}</Badge>
                            {conn.lastSyncAt && <span className="text-[10px] text-gray-400">Synced {formatRelativeTime(conn.lastSyncAt)}</span>}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => handleSyncM365(emailConnections[0]?.id)} title="Sync now">
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={handleConnectM365} disabled={connectingM365} title="Add M365 account">
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-red-400 hover:text-red-600" onClick={() => handleDisconnectM365(emailConnections[0]?.id)} disabled={disconnectingId !== null} title="Disconnect">
                        {disconnectingId !== null ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>

                  {/* Email Client */}
                  <Card className="min-h-[500px]">
                    {/* Email toolbar */}
                    <div className="flex items-center justify-between border-b px-4 py-2">
                      <div className="flex items-center gap-1">
                        <Button
                          variant={emailFolder === 'inbox' ? 'default' : 'ghost'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => { setEmailFolder('inbox'); setSelectedEmailId(null); }}
                        >
                          <Inbox className="h-3.5 w-3.5 mr-1" /> Inbox
                        </Button>
                        <Button
                          variant={emailFolder === 'sent' ? 'default' : 'ghost'}
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => { setEmailFolder('sent'); setSelectedEmailId(null); }}
                        >
                          <Send className="h-3.5 w-3.5 mr-1" /> Sent
                        </Button>
                      </div>
                      <Button size="sm" className="bg-[#0078d4] hover:bg-[#106ebe] text-white h-8 text-xs" onClick={() => {
                        setReplyToEmail(null);
                        setComposeForm({ to: '', cc: '', subject: '', body: '', fromConnectionId: 0 });
                        setShowComposeDialog(true);
                      }}>
                        <MailPlus className="h-3.5 w-3.5 mr-1" /> Compose
                      </Button>
                    </div>

                    <div className="flex" style={{ minHeight: '450px' }}>
                      {/* Email list panel */}
                      <div className={`${selectedEmailId ? 'hidden md:block md:w-2/5 lg:w-1/3' : 'w-full'} border-r overflow-y-auto`} style={{ maxHeight: '450px' }}>
                        {emailFolder === 'inbox' ? (
                          loadingInbox ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                          ) : filteredInboxEmails.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                              <Inbox className="h-8 w-8 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">No emails yet</p>
                              <p className="text-xs mt-1">{inboxEmails.length > 0 ? 'No emails match the selected mailboxes' : 'Emails will appear here after syncing'}</p>
                            </div>
                          ) : (
                            <div>
                              {filteredInboxEmails.map((email: any) => (
                                <div
                                  key={email.id}
                                  className={`px-4 py-3 border-b cursor-pointer transition-colors hover:bg-gray-50 ${
                                    selectedEmailId === email.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                                  } ${!email.isRead ? 'bg-white' : 'bg-gray-50/50'}`}
                                  onClick={() => {
                                    setSelectedEmailId(email.id);
                                    // Optimistically mark as read in the list cache
                                    if (!email.isRead) {
                                      queryClient.setQueryData(
                                        ['/api/email-integration/emails', emailFolder],
                                        (old: any[] | undefined) =>
                                          old?.map((e: any) => e.id === email.id ? { ...e, isRead: true } : e)
                                      );
                                    }
                                  }}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        {!email.isRead && <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />}
                                        <span className={`text-sm truncate ${!email.isRead ? 'font-semibold' : 'text-gray-700'}`}>
                                          {email.fromName || email.fromAddress}
                                        </span>
                                      </div>
                                      <p className={`text-sm truncate mt-0.5 ${!email.isRead ? 'font-medium text-gray-900' : 'text-gray-600'}`}>
                                        {email.subject || '(No subject)'}
                                      </p>
                                      <p className="text-xs text-gray-400 truncate mt-0.5">{email.bodyPreview}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <span className="text-[10px] text-gray-400">{formatRelativeTime(email.receivedAt)}</span>
                                      <div className="flex gap-1">
                                        {email.hasAttachments && <Paperclip className="h-3 w-3 text-gray-400" />}
                                        {email.importance === 'high' && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        ) : (
                          loadingSent ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                          ) : filteredSentEmails.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                              <Send className="h-8 w-8 mx-auto mb-2 opacity-40" />
                              <p className="text-sm">No sent emails</p>
                            </div>
                          ) : (
                            <div>
                              {filteredSentEmails.map((email: any) => (
                                <div
                                  key={email.id}
                                  className="px-4 py-3 border-b cursor-pointer transition-colors hover:bg-gray-50"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <span className="text-sm text-gray-700 truncate block">
                                        To: {(email.toAddresses || []).join(', ')}
                                      </span>
                                      <p className="text-sm text-gray-600 truncate mt-0.5">{email.subject}</p>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                      <span className="text-[10px] text-gray-400">{formatRelativeTime(email.sentAt || email.createdAt)}</span>
                                      <Badge variant="outline" className={`text-[10px] ${email.status === 'sent' ? 'text-green-600 border-green-300' : email.status === 'failed' ? 'text-red-600 border-red-300' : 'text-gray-500'}`}>
                                        {email.status}
                                      </Badge>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )
                        )}
                      </div>

                      {/* Email reading pane */}
                      {selectedEmailId && (
                        <div className="flex-1 overflow-y-auto" style={{ maxHeight: '450px' }}>
                          {loadingEmailDetail ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                            </div>
                          ) : selectedEmail ? (
                            <div className="p-4">
                              {/* Back button on mobile */}
                              <Button variant="ghost" size="sm" className="md:hidden mb-3 h-7 text-xs" onClick={() => setSelectedEmailId(null)}>
                                <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back to list
                              </Button>

                              {/* Email header */}
                              <div className="mb-4">
                                <h3 className="text-lg font-semibold">{selectedEmail.subject || '(No subject)'}</h3>
                                <div className="flex items-center justify-between mt-2">
                                  <div>
                                    <p className="text-sm font-medium">{selectedEmail.fromName || selectedEmail.fromAddress}</p>
                                    <p className="text-xs text-gray-400">{selectedEmail.fromAddress}</p>
                                  </div>
                                  <span className="text-xs text-gray-400">{formatDate(selectedEmail.receivedAt)} {formatTime(selectedEmail.receivedAt)}</span>
                                </div>
                                {selectedEmail.toAddresses?.length > 0 && (
                                  <p className="text-xs text-gray-500 mt-1">To: {selectedEmail.toAddresses.join(', ')}</p>
                                )}
                                {selectedEmail.ccAddresses?.length > 0 && (
                                  <p className="text-xs text-gray-500">CC: {selectedEmail.ccAddresses.join(', ')}</p>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex gap-2 mb-4 border-y py-2">
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => handleReply(selectedEmail)}>
                                  <Reply className="h-3.5 w-3.5 mr-1" /> Reply
                                </Button>
                                <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => {
                                  setReplyToEmail(null);
                                  setComposeForm({
                                    to: '',
                                    cc: '',
                                    subject: `Fwd: ${selectedEmail.subject || ''}`,
                                    body: `\n\n--- Forwarded Message ---\nFrom: ${selectedEmail.fromName || selectedEmail.fromAddress}\nDate: ${formatDate(selectedEmail.receivedAt)}\nSubject: ${selectedEmail.subject || ''}\n\n${selectedEmail.bodyPreview || ''}`,
                                  });
                                  setShowComposeDialog(true);
                                }}>
                                  <Forward className="h-3.5 w-3.5 mr-1" /> Forward
                                </Button>
                              </div>

                              {/* AI Summary if available */}
                              {selectedEmail.aiSummary && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4">
                                  <p className="text-xs font-semibold text-purple-700 mb-1">AI Summary</p>
                                  <p className="text-sm text-purple-900">{selectedEmail.aiSummary}</p>
                                </div>
                              )}

                              {/* Email body */}
                              <div className="prose prose-sm max-w-none">
                                {selectedEmail.bodyHtml ? (
                                  <div
                                    className="text-sm"
                                    dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }}
                                  />
                                ) : (
                                  <pre className="whitespace-pre-wrap text-sm font-sans text-gray-700">
                                    {selectedEmail.bodyText || selectedEmail.bodyPreview || 'No content'}
                                  </pre>
                                )}
                              </div>

                              {/* Attachments */}
                              {selectedEmail.hasAttachments && selectedEmail.attachments && (
                                <div className="mt-4 border-t pt-3">
                                  <p className="text-xs font-semibold text-gray-600 mb-2 flex items-center gap-1">
                                    <Paperclip className="h-3 w-3" /> Attachments
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {(Array.isArray(selectedEmail.attachments) ? selectedEmail.attachments : []).map((att: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-1 bg-gray-100 rounded px-2 py-1 text-xs">
                                        <FileText className="h-3 w-3 text-gray-500" />
                                        <span>{att.name}</span>
                                        {att.size && <span className="text-gray-400">({Math.round(att.size / 1024)}KB)</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center justify-center py-12 text-gray-400">
                              <p className="text-sm">Email not found</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Empty state for reading pane when no email selected (desktop) */}
                      {!selectedEmailId && emailFolder === 'inbox' && filteredInboxEmails.length > 0 && (
                        <div className="hidden md:flex flex-1 items-center justify-center text-gray-400">
                          <div className="text-center">
                            <Mail className="h-10 w-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">Select an email to read</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                </>
              )}

              {/* WhatsApp Section */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-600" />
                    WhatsApp Conversations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(commsData?.whatsapp?.conversations || []).length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No WhatsApp conversations</p>
                  ) : (
                    <div className="space-y-2">
                      {(commsData?.whatsapp?.conversations || []).slice(0, 8).map((conv: any) => (
                        <div key={conv.id} className="p-2 rounded border border-gray-100 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-xs">{conv.contactName}</span>
                            <div className="flex items-center gap-1">
                              {conv.unreadCount > 0 && <Badge variant="destructive" className="text-[10px]">{conv.unreadCount}</Badge>}
                              <span className="text-[10px] text-gray-400">{formatRelativeTime(conv.lastMessageAt)}</span>
                            </div>
                          </div>
                          {conv.lastMessagePreview && <p className="text-xs text-gray-600 truncate">{conv.lastMessagePreview}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

      {/* ========== NEW TASK DIALOG ========== */}
      <Dialog open={showNewTaskDialog} onOpenChange={setShowNewTaskDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Details..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Type</Label>
                <Select value={newTask.taskType} onValueChange={(v) => setNewTask({ ...newTask, taskType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="viewing">Viewing</SelectItem>
                    <SelectItem value="enquiry_response">Enquiry Response</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="property_assignment">Property Assignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={newTask.priority} onValueChange={(v) => setNewTask({ ...newTask, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Due Date</Label>
              <Input type="datetime-local" value={newTask.dueDate} onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })} />
            </div>
            {canAssign && (
              <div>
                <Label className="text-xs">Assign To (leave blank for self)</Label>
                <Select value={newTask.assignedToId || "self"} onValueChange={(v) => setNewTask({ ...newTask, assignedToId: v === "self" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Myself" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="self">Myself</SelectItem>
                    {agentsList.map((agent: any) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>{agent.fullName || agent.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea value={newTask.notes} onChange={(e) => setNewTask({ ...newTask, notes: e.target.value })} placeholder="Additional notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTaskDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateTask} disabled={!newTask.title || createTaskMutation.isPending}>
              {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== ASSIGN DIALOG (clearance >= 7) ========== */}
      {canAssign && (
        <Dialog open={showAssignDialog} onOpenChange={setShowAssignDialog}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign {assignTarget?.type === 'property' ? 'Property' : 'Lead'}</DialogTitle>
            </DialogHeader>
            <div>
              <Label className="text-xs">Select Agent</Label>
              <Select onValueChange={(v) => {
                if (assignTarget) {
                  assignMutation.mutate({ type: assignTarget.type, id: assignTarget.id, agentId: parseInt(v) });
                }
              }}>
                <SelectTrigger><SelectValue placeholder="Choose agent..." /></SelectTrigger>
                <SelectContent>
                  {agentsList.map((agent: any) => (
                    <SelectItem key={agent.id} value={String(agent.id)}>{agent.fullName || agent.username}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ========== COMPOSE EMAIL DIALOG ========== */}
      <Dialog open={showComposeDialog} onOpenChange={(open) => {
        setShowComposeDialog(open);
        if (!open) { setReplyToEmail(null); setComposeForm({ to: '', cc: '', subject: '', body: '', fromConnectionId: 0 }); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MailPlus className="h-5 w-5" />
              {replyToEmail ? 'Reply' : 'New Email'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {emailConnections.length > 1 && (
              <div>
                <Label className="text-xs font-medium">From</Label>
                <Select
                  value={String(composeForm.fromConnectionId || emailConnections.find((c: any) => c.status === 'active')?.id || '')}
                  onValueChange={(val) => setComposeForm({ ...composeForm, fromConnectionId: Number(val) })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select mailbox" />
                  </SelectTrigger>
                  <SelectContent>
                    {emailConnections.filter((c: any) => c.status === 'active').map((conn: any) => (
                      <SelectItem key={conn.id} value={String(conn.id)}>
                        {conn.mailboxDisplayName || conn.emailAddress || conn.smtpUser || `Connection ${conn.id}`}
                        {conn.provider === 'smtp' ? ' (SMTP)' : ' (M365)'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {emailConnections.length === 1 && (
              <div className="text-xs text-gray-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                From: {emailConnections[0]?.mailboxDisplayName || emailConnections[0]?.emailAddress || emailConnections[0]?.smtpUser}
              </div>
            )}
            <div>
              <Label className="text-xs font-medium">To *</Label>
              <Input
                value={composeForm.to}
                onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                placeholder="recipient@example.com (separate multiple with commas)"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">CC</Label>
              <Input
                value={composeForm.cc}
                onChange={(e) => setComposeForm({ ...composeForm, cc: e.target.value })}
                placeholder="cc@example.com"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Subject *</Label>
              <Input
                value={composeForm.subject}
                onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                placeholder="Email subject"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs font-medium">Message</Label>
              <Textarea
                value={composeForm.body}
                onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                placeholder="Write your message..."
                rows={10}
                className="mt-1 font-sans"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowComposeDialog(false)}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sendingEmail} className="bg-[#0078d4] hover:bg-[#106ebe] text-white">
              {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SMTP/IMAP Connection Dialog */}
      <Dialog open={showSmtpDialog} onOpenChange={setShowSmtpDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connect SMTP / IMAP Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            {/* SMTP Settings */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Outgoing Mail (SMTP)</h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">SMTP Host</Label>
                  <Input value={smtpForm.smtpHost} onChange={(e) => setSmtpForm({ ...smtpForm, smtpHost: e.target.value })} placeholder="smtp.gmail.com" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Port</Label>
                  <Input value={smtpForm.smtpPort} onChange={(e) => setSmtpForm({ ...smtpForm, smtpPort: e.target.value })} placeholder="587" className="mt-1 h-8 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Username / Email</Label>
                <Input value={smtpForm.smtpUser} onChange={(e) => setSmtpForm({ ...smtpForm, smtpUser: e.target.value, imapUser: smtpForm.imapUser || e.target.value })} placeholder="you@example.com" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Password / App Password</Label>
                <Input type="password" value={smtpForm.smtpPassword} onChange={(e) => setSmtpForm({ ...smtpForm, smtpPassword: e.target.value, imapPassword: smtpForm.imapPassword || e.target.value })} placeholder="••••••••" className="mt-1 h-8 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={smtpForm.smtpSecure} onChange={(e) => setSmtpForm({ ...smtpForm, smtpSecure: e.target.checked })} />
                Use SSL (port 465)
              </label>
            </div>

            {/* IMAP Settings */}
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-sm font-semibold text-gray-700">Incoming Mail (IMAP)</h4>
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <Label className="text-xs">IMAP Host</Label>
                  <Input value={smtpForm.imapHost} onChange={(e) => setSmtpForm({ ...smtpForm, imapHost: e.target.value })} placeholder="imap.gmail.com" className="mt-1 h-8 text-sm" />
                </div>
                <div>
                  <Label className="text-xs">Port</Label>
                  <Input value={smtpForm.imapPort} onChange={(e) => setSmtpForm({ ...smtpForm, imapPort: e.target.value })} placeholder="993" className="mt-1 h-8 text-sm" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Username / Email</Label>
                <Input value={smtpForm.imapUser} onChange={(e) => setSmtpForm({ ...smtpForm, imapUser: e.target.value })} placeholder="you@example.com" className="mt-1 h-8 text-sm" />
              </div>
              <div>
                <Label className="text-xs">Password / App Password</Label>
                <Input type="password" value={smtpForm.imapPassword} onChange={(e) => setSmtpForm({ ...smtpForm, imapPassword: e.target.value })} placeholder="••••••••" className="mt-1 h-8 text-sm" />
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={smtpForm.imapTls} onChange={(e) => setSmtpForm({ ...smtpForm, imapTls: e.target.checked })} />
                Use TLS/SSL
              </label>
            </div>

            {/* Test Results */}
            {smtpTestResult && (
              <div className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-sm">
                  {smtpTestResult.smtp ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  <span>SMTP: {smtpTestResult.smtp ? 'Connected' : smtpTestResult.smtpError || 'Failed'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {smtpTestResult.imap ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-red-500" />}
                  <span>IMAP: {smtpTestResult.imap ? 'Connected' : smtpTestResult.imapError || 'Failed'}</span>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4 flex gap-2">
            <Button variant="outline" onClick={handleTestSmtp} disabled={testingSmtp || !smtpForm.smtpHost || !smtpForm.smtpUser}>
              {testingSmtp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
              Test Connection
            </Button>
            <Button onClick={handleConnectSmtp} disabled={connectingSmtp || !smtpForm.smtpHost || !smtpForm.smtpUser || !smtpForm.imapHost}>
              {connectingSmtp ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plug className="h-4 w-4 mr-2" />}
              Connect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
