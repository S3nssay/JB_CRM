import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Loader2, Plus, CheckCircle, Clock, AlertCircle, Calendar,
  ClipboardList, Filter, Search, User, Flag, ChevronsUpDown, X,
} from 'lucide-react';

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
  createdAt?: string;
  updatedAt?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const priorityBadgeConfig: Record<string, { label: string; className: string }> = {
  high:   { label: 'High',   className: 'bg-red-100 text-red-800 border-red-300' },
  medium: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  low:    { label: 'Low',    className: 'bg-green-100 text-green-800 border-green-300' },
};

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending:     { label: 'Pending',     className: 'bg-gray-100 text-gray-800 border-gray-300' },
  in_progress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  completed:   { label: 'Completed',   className: 'bg-green-100 text-green-800 border-green-300' },
};

const taskTypeLabels: Record<string, string> = {
  viewing:              'Viewing',
  call:                 'Call',
  follow_up:            'Follow Up',
  enquiry_response:     'Enquiry Response',
  property_assignment:  'Property Assignment',
  document:             'Document',
  maintenance:          'Maintenance',
  general:              'General',
};

function PriorityBadge({ priority }: { priority: string }) {
  const cfg = priorityBadgeConfig[priority] || { label: priority, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = statusBadgeConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TaskManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    taskType: '',
    priority: '',
    assignedToId: '',
    dueDate: '',
  });
  const [staffPopoverOpen, setStaffPopoverOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: tasks = [], isLoading, isError } = useQuery<Task[]>({
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

  // ── Filtered tasks ─────────────────────────────────────────────────────────

  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
    if (taskTypeFilter !== 'all' && task.taskType !== taskTypeFilter) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const titleMatch = task.title?.toLowerCase().includes(query);
      const descMatch = task.description?.toLowerCase().includes(query);
      if (!titleMatch && !descMatch) return false;
    }
    return true;
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createTaskMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      taskType: string;
      priority: string;
      assignedToId?: number;
      dueDate?: string;
    }) => {
      return apiRequest('/api/crm/tasks', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task created', description: 'The task has been created successfully.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const markCompleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/tasks/${id}`, 'PUT', { status: 'completed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tasks'] });
      toast({ title: 'Task completed', description: 'The task has been marked as completed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function resetForm() {
    setFormData({
      title: '',
      description: '',
      taskType: '',
      priority: '',
      assignedToId: '',
      dueDate: '',
    });
  }

  function handleCreateSubmit() {
    if (!formData.title.trim() || !formData.taskType || !formData.priority) {
      toast({ title: 'Validation error', description: 'Please fill in title, task type, and priority.', variant: 'destructive' });
      return;
    }

    createTaskMutation.mutate({
      title: formData.title.trim(),
      description: formData.description.trim() || undefined,
      taskType: formData.taskType,
      priority: formData.priority,
      assignedToId: formData.assignedToId ? parseInt(formData.assignedToId, 10) : undefined,
      dueDate: formData.dueDate || undefined,
    });
  }

  function isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(dueDate) < today;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Task Manager</h1>
          <p className="text-muted-foreground">Manage and track CRM tasks and follow-ups</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Task
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <ClipboardList className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <Clock className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'pending').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <AlertCircle className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'in_progress').length}</p>
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
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{tasks.filter(t => t.status === 'completed').length}</p>
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
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Task Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="viewing">Viewing</SelectItem>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="follow_up">Follow Up</SelectItem>
                <SelectItem value="enquiry_response">Enquiry Response</SelectItem>
                <SelectItem value="property_assignment">Property Assignment</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="maintenance">Maintenance</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
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
            <ClipboardList className="h-5 w-5" />
            Tasks
            {filteredTasks.length !== tasks.length && (
              <span className="text-sm font-normal text-muted-foreground">
                (showing {filteredTasks.length} of {tasks.length})
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
              <ClipboardList className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">
                {tasks.length === 0 ? 'No tasks yet' : 'No tasks match your filters'}
              </p>
              <p className="text-sm">
                {tasks.length === 0
                  ? 'Create a task to get started.'
                  : 'Try adjusting your filter criteria.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-[250px] truncate">
                      {task.title}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {taskTypeLabels[task.taskType] || task.taskType?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={task.priority} />
                    </TableCell>
                    <TableCell>
                      {task.assignedToName || (task.assignedToId ? (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <User className="h-3 w-3" />
                          {staffMembers.find((s: any) => s.id === task.assignedToId)?.name ||
                           staffMembers.find((s: any) => s.id === task.assignedToId)?.username ||
                           `ID: ${task.assignedToId}`}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      ))}
                    </TableCell>
                    <TableCell>
                      {task.dueDate ? (
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className={isOverdue(task.dueDate) && task.status !== 'completed' ? 'text-red-600 font-medium' : ''}>
                            {new Date(task.dueDate).toLocaleDateString('en-GB')}
                          </span>
                          {isOverdue(task.dueDate) && task.status !== 'completed' && (
                            <Badge className="bg-red-100 text-red-800 border-red-300 border text-xs ml-1">
                              Overdue
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Task</DialogTitle>
            <DialogDescription>
              Create a new task with assignment and due date.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="taskTitle">Title</Label>
              <Input
                id="taskTitle"
                placeholder="e.g. Follow up with tenant about renewal"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="taskDescription">Description</Label>
              <Textarea
                id="taskDescription"
                placeholder="Optional task description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="taskType">Task Type</Label>
                <Select
                  value={formData.taskType}
                  onValueChange={(value) => setFormData({ ...formData, taskType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="viewing">Viewing</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="follow_up">Follow Up</SelectItem>
                    <SelectItem value="enquiry_response">Enquiry Response</SelectItem>
                    <SelectItem value="property_assignment">Property Assignment</SelectItem>
                    <SelectItem value="document">Document</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="taskPriority">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-red-600" />
                        High
                      </div>
                    </SelectItem>
                    <SelectItem value="medium">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-yellow-600" />
                        Medium
                      </div>
                    </SelectItem>
                    <SelectItem value="low">
                      <div className="flex items-center gap-2">
                        <Flag className="h-3 w-3 text-green-600" />
                        Low
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Assigned To</Label>
                <Popover open={staffPopoverOpen} onOpenChange={setStaffPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={staffPopoverOpen}
                      className="w-full justify-between font-normal"
                    >
                      {formData.assignedToId
                        ? staffMembers.find((s: any) => String(s.id) === formData.assignedToId)?.name ||
                          staffMembers.find((s: any) => String(s.id) === formData.assignedToId)?.username ||
                          `User #${formData.assignedToId}`
                        : 'Select staff member...'}
                      {formData.assignedToId ? (
                        <X
                          className="ml-2 h-4 w-4 shrink-0 opacity-50 hover:opacity-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFormData({ ...formData, assignedToId: '' });
                          }}
                        />
                      ) : (
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search staff..." />
                      <CommandList>
                        <CommandEmpty>No staff found.</CommandEmpty>
                        <CommandGroup>
                          {staffMembers.map((staff: any) => (
                            <CommandItem
                              key={staff.id}
                              value={`${staff.name || ''} ${staff.username || ''} ${staff.email || ''}`}
                              onSelect={() => {
                                setFormData({ ...formData, assignedToId: String(staff.id) });
                                setStaffPopoverOpen(false);
                              }}
                            >
                              <User className="mr-2 h-4 w-4 text-muted-foreground" />
                              <div className="flex flex-col">
                                <span>{staff.name || staff.username}</span>
                                {staff.role && (
                                  <span className="text-xs text-muted-foreground capitalize">{staff.role.replace(/_/g, ' ')}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createTaskMutation.isPending}>
              {createTaskMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
