import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CheckCircle, Clock, AlertCircle, Filter, Search, Mail, AlertTriangle, Timer, User } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Task {
  id: number;
  title: string;
  description?: string;
  taskType: string;
  priority: string;
  status: string;
  assignedToId?: number;
  assignedToName?: string;
  dueDate?: string;
  slaDeadline?: string;
  sourceEmailId?: number;
  sourceTicketId?: number;
  sourceLeadId?: number;
  createdAt?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const priorityBadgeConfig: Record<string, { label: string; className: string }> = {
  urgent: { label: 'Urgent', className: 'bg-purple-100 text-purple-800 border-purple-300' },
  high:   { label: 'High',   className: 'bg-red-100 text-red-800 border-red-300' },
  normal: { label: 'Normal', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  low:    { label: 'Low',    className: 'bg-green-100 text-green-800 border-green-300' },
};

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending:     { label: 'Pending',     className: 'bg-gray-100 text-gray-800 border-gray-300' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  completed:   { label: 'Completed',   className: 'bg-green-100 text-green-800 border-green-300' },
};

const taskTypeLabels: Record<string, string> = {
  email_review:       'Email Review',
  enquiry_response:   'Enquiry Response',
  contractor_review:  'Contractor Review',
  maintenance:        'Maintenance',
  viewing:            'Viewing',
  general:            'General',
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = priorityBadgeConfig[priority] || { label: priority, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusBadgeConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

function getSlaStatus(slaDeadline?: string): 'overdue' | 'warning' | 'ok' | 'none' {
  if (!slaDeadline) return 'none';
  const now = new Date();
  const deadline = new Date(slaDeadline);
  if (deadline < now) return 'overdue';
  const diffMs = deadline.getTime() - now.getTime();
  const oneHourMs = 60 * 60 * 1000;
  if (diffMs < oneHourMs) return 'warning';
  return 'ok';
}

function formatSlaDeadline(slaDeadline?: string): string {
  if (!slaDeadline) return '-';
  const deadline = new Date(slaDeadline);
  const now = new Date();
  const diffMs = deadline.getTime() - now.getTime();
  const absDiffMs = Math.abs(diffMs);

  const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

  const timeStr = deadline.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  if (diffMs < 0) {
    if (hours > 0) return `${timeStr} (${hours}h ${minutes}m overdue)`;
    return `${timeStr} (${minutes}m overdue)`;
  }
  if (hours > 0) return `${timeStr} (${hours}h ${minutes}m left)`;
  return `${timeStr} (${minutes}m left)`;
}

function isCompletedToday(task: Task): boolean {
  if (task.status !== 'completed') return false;
  if (!task.createdAt) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const taskDate = new Date(task.createdAt);
  taskDate.setHours(0, 0, 0, 0);
  return taskDate.getTime() === today.getTime();
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EmailTaskQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reassign dialog
  const [reassignDialogOpen, setReassignDialogOpen] = useState(false);
  const [reassignTaskId, setReassignTaskId] = useState<number | null>(null);
  const [reassignToId, setReassignToId] = useState<string>('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: allTasks = [], isLoading, isError } = useQuery<Task[]>({
    queryKey: ['/api/crm/tasks'],
  });

  const { data: staffMembers = [] } = useQuery<any[]>({
    queryKey: ['/api/crm/staff', { status: 'active' }],
    queryFn: async () => {
      const res = await fetch('/api/crm/staff?status=active');
      if (!res.ok) throw new Error('Failed to fetch staff');
      return res.json();
    },
  });

  // Only email-sourced tasks (those with sourceEmailId)
  const emailTasks = allTasks.filter((t) => t.sourceEmailId != null);

  // ── Filtered & sorted tasks ──────────────────────────────────────────────

  const filteredTasks = emailTasks
    .filter((task) => {
      if (statusFilter !== 'all' && task.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      if (taskTypeFilter !== 'all' && task.taskType !== taskTypeFilter) return false;
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned') {
          if (task.assignedToId != null) return false;
        } else {
          if (String(task.assignedToId) !== assigneeFilter) return false;
        }
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const titleMatch = task.title?.toLowerCase().includes(query);
        const descMatch = task.description?.toLowerCase().includes(query);
        if (!titleMatch && !descMatch) return false;
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by SLA deadline ascending (most urgent first), tasks without SLA go to the end
      if (!a.slaDeadline && !b.slaDeadline) return 0;
      if (!a.slaDeadline) return 1;
      if (!b.slaDeadline) return -1;
      return new Date(a.slaDeadline).getTime() - new Date(b.slaDeadline).getTime();
    });

  // ── Summary stats ────────────────────────────────────────────────────────

  const totalQueue = emailTasks.filter((t) => t.status !== 'completed').length;
  const overdueSla = emailTasks.filter(
    (t) => t.status !== 'completed' && getSlaStatus(t.slaDeadline) === 'overdue'
  ).length;
  const dueWithinOneHour = emailTasks.filter(
    (t) => t.status !== 'completed' && getSlaStatus(t.slaDeadline) === 'warning'
  ).length;
  const completedToday = emailTasks.filter(isCompletedToday).length;

  // ── Mutations ────────────────────────────────────────────────────────────

  const markCompleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/tasks/${id}`, 'PATCH', { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task completed', description: 'The task has been marked as completed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const reassignMutation = useMutation({
    mutationFn: async ({ id, assignedToId }: { id: number; assignedToId: number }) => {
      return apiRequest(`/api/crm/tasks/${id}`, 'PATCH', { assignedToId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task reassigned', description: 'The task has been reassigned successfully.' });
      setReassignDialogOpen(false);
      setReassignTaskId(null);
      setReassignToId('');
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleOpenReassign(taskId: number) {
    setReassignTaskId(taskId);
    setReassignToId('');
    setReassignDialogOpen(true);
  }

  function handleReassignSubmit() {
    if (!reassignTaskId || !reassignToId) {
      toast({ title: 'Validation error', description: 'Please select a staff member.', variant: 'destructive' });
      return;
    }
    reassignMutation.mutate({ id: reassignTaskId, assignedToId: parseInt(reassignToId, 10) });
  }

  function getAssigneeName(task: Task): string {
    if (task.assignedToName) return task.assignedToName;
    if (task.assignedToId) {
      const staff = staffMembers.find((s: any) => s.id === task.assignedToId);
      return staff?.name || staff?.username || `ID: ${task.assignedToId}`;
    }
    return 'Unassigned';
  }

  function getSourceLabel(task: Task): string {
    if (task.sourceEmailId) return `Email #${task.sourceEmailId}`;
    if (task.sourceTicketId) return `Ticket #${task.sourceTicketId}`;
    if (task.sourceLeadId) return `Lead #${task.sourceLeadId}`;
    return '-';
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>Email Task Queue</h1>
          <p className="text-muted-foreground">Manage email-generated tasks with SLA tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5" style={{ color: '#791E75' }} />
          <span className="text-sm text-muted-foreground">{emailTasks.length} email tasks total</span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ backgroundColor: '#791E7515' }}>
                <Mail className="h-5 w-5" style={{ color: '#791E75' }} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Queue</p>
                <p className="text-2xl font-bold">{totalQueue}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Overdue SLA</p>
                <p className="text-2xl font-bold text-red-600">{overdueSla}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100">
                <Timer className="h-5 w-5 text-amber-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Due Within 1hr</p>
                <p className="text-2xl font-bold text-amber-600">{dueWithinOneHour}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Completed Today</p>
                <p className="text-2xl font-bold text-green-600">{completedToday}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Task Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="email_review">Email Review</SelectItem>
                <SelectItem value="enquiry_response">Enquiry Response</SelectItem>
                <SelectItem value="contractor_review">Contractor Review</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="viewing">Viewing</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {staffMembers.map((staff: any) => (
                  <SelectItem key={staff.id} value={String(staff.id)}>
                    {staff.name || staff.username}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search email tasks..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tasks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" style={{ color: '#791E75' }} />
            Email Tasks
            {filteredTasks.length !== emailTasks.length && (
              <span className="text-sm font-normal text-muted-foreground">
                (showing {filteredTasks.length} of {emailTasks.length})
              </span>
            )}
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
              Failed to load tasks
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">
                {emailTasks.length === 0 ? 'No email tasks yet' : 'No tasks match your filters'}
              </p>
              <p className="text-sm">
                {emailTasks.length === 0
                  ? 'Email-generated tasks will appear here when created.'
                  : 'Try adjusting your filter criteria.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Priority</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>SLA Deadline</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => {
                  const slaStatus = getSlaStatus(task.slaDeadline);
                  const isOverdue = slaStatus === 'overdue' && task.status !== 'completed';
                  const isWarning = slaStatus === 'warning' && task.status !== 'completed';

                  return (
                    <TableRow
                      key={task.id}
                      className={isOverdue ? 'border-l-4 border-l-red-500' : ''}
                    >
                      <TableCell>
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell className="font-medium max-w-[250px] truncate">
                        {task.title}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {taskTypeLabels[task.taskType] || task.taskType?.replace(/_/g, ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          <span className={task.assignedToId ? '' : 'text-muted-foreground'}>
                            {getAssigneeName(task)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {task.slaDeadline ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span
                              className={
                                task.status === 'completed'
                                  ? 'text-muted-foreground'
                                  : isOverdue
                                  ? 'text-red-600 font-semibold'
                                  : isWarning
                                  ? 'text-amber-600 font-medium'
                                  : 'text-green-600'
                              }
                            >
                              {formatSlaDeadline(task.slaDeadline)}
                            </span>
                            {isOverdue && (
                              <Badge className="bg-red-100 text-red-800 border-red-300 border text-xs ml-1">
                                Overdue
                              </Badge>
                            )}
                            {isWarning && (
                              <Badge className="bg-amber-100 text-amber-800 border-amber-300 border text-xs ml-1">
                                Due Soon
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {task.sourceEmailId ? (
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{getSourceLabel(task)}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {task.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markCompleteMutation.mutate(task.id)}
                              disabled={markCompleteMutation.isPending}
                            >
                              {markCompleteMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <CheckCircle className="h-3 w-3 mr-1" />
                              )}
                              Complete
                            </Button>
                          )}
                          {task.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReassign(task.id)}
                            >
                              <User className="h-3 w-3 mr-1" />
                              Reassign
                            </Button>
                          )}
                          {task.sourceEmailId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                            >
                              <a href={`/email/${task.sourceEmailId}`}>
                                <Mail className="h-3 w-3 mr-1" />
                                View Email
                              </a>
                            </Button>
                          )}
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

      {/* Reassign Dialog */}
      <Dialog open={reassignDialogOpen} onOpenChange={setReassignDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reassign Task</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Assign To</label>
              <Select value={reassignToId} onValueChange={setReassignToId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member..." />
                </SelectTrigger>
                <SelectContent>
                  {staffMembers.map((staff: any) => (
                    <SelectItem key={staff.id} value={String(staff.id)}>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-muted-foreground" />
                        {staff.name || staff.username}
                        {staff.role && (
                          <span className="text-xs text-muted-foreground capitalize">
                            ({staff.role.replace(/_/g, ' ')})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReassignSubmit}
              disabled={reassignMutation.isPending || !reassignToId}
              style={{ backgroundColor: '#791E75' }}
            >
              {reassignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Reassign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
