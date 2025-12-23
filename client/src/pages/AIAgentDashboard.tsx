import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Bot, Play, Pause, RefreshCw, Activity, Clock, CheckCircle,
  AlertTriangle, XCircle, Users, MessageSquare, Zap, TrendingUp,
  ArrowRight, Timer, Inbox, Send, Brain, Settings2, Eye
} from 'lucide-react';

interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  averageResponseTime: number;
  successRate: number;
}

interface Agent {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  isActive: boolean;
  workingHours: { start: string; end: string };
  workingDays: string[];
  personality: string;
  tone: string;
  taskTypes: string[];
  channels: string[];
  metrics: AgentMetrics;
}

interface Task {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  status: string;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

interface QueueStatus {
  queued: {
    urgent: number;
    high: number;
    medium: number;
    low: number;
  };
  active: number;
  completed: number;
  processing: boolean;
}

interface SystemStatus {
  orchestrator: QueueStatus;
  supervisor: {
    totalAgents: number;
    activeAgents: number;
    totalTasksProcessed: number;
    averageResponseTime: number;
    overallSuccessRate: number;
  };
  agents: Record<string, any>;
}

export default function AIAgentDashboard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch system status
  const { data: systemStatus, refetch: refetchStatus } = useQuery<SystemStatus>({
    queryKey: ['/api/crm/ai-agents/status'],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ['/api/crm/ai-agents'],
    refetchInterval: autoRefresh ? 10000 : false,
  });

  // Fetch recent tasks
  const { data: recentTasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/crm/ai-agents/tasks'],
    refetchInterval: autoRefresh ? 5000 : false,
  });

  // Fetch queue status
  const { data: queueStatus } = useQuery<QueueStatus>({
    queryKey: ['/api/crm/ai-agents/queue'],
    refetchInterval: autoRefresh ? 3000 : false,
  });

  // Control mutation
  const controlMutation = useMutation({
    mutationFn: async (action: 'start' | 'stop') => {
      const res = await fetch('/api/crm/ai-agents/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error('Failed to control agent system');
      return res.json();
    },
    onSuccess: (_, action) => {
      toast({
        title: action === 'start' ? 'System Started' : 'System Stopped',
        description: `Agent system has been ${action === 'start' ? 'started' : 'stopped'}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/ai-agents'] });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'pending': return 'bg-gray-100 text-gray-800';
      case 'escalated': return 'bg-red-100 text-red-800';
      case 'awaiting_response': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-blue-500 text-white';
      case 'low': return 'bg-gray-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const totalQueuedTasks = queueStatus
    ? queueStatus.queued.urgent + queueStatus.queued.high + queueStatus.queued.medium + queueStatus.queued.low
    : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#791E75] text-white py-6">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Brain className="h-8 w-8" />
                AI Agent System
              </h1>
              <p className="text-white/80 mt-1">Multi-agent orchestration dashboard</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="bg-white/10 border-white/30 text-white hover:bg-white/20"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
              </Button>
              {queueStatus?.processing ? (
                <Button
                  variant="destructive"
                  onClick={() => controlMutation.mutate('stop')}
                  disabled={controlMutation.isPending}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Stop System
                </Button>
              ) : (
                <Button
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => controlMutation.mutate('start')}
                  disabled={controlMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start System
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className={`p-3 rounded-lg ${queueStatus?.processing ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <Activity className={`h-6 w-6 ${queueStatus?.processing ? 'text-green-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queueStatus?.processing ? 'Running' : 'Stopped'}</p>
                  <p className="text-sm text-gray-500">System Status</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {systemStatus?.supervisor?.activeAgents || 0}/{systemStatus?.supervisor?.totalAgents || 0}
                  </p>
                  <p className="text-sm text-gray-500">Active Agents</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Inbox className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalQueuedTasks}</p>
                  <p className="text-sm text-gray-500">Queued Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-100 rounded-lg">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{queueStatus?.completed || 0}</p>
                  <p className="text-sm text-gray-500">Completed</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <TrendingUp className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {systemStatus?.supervisor?.overallSuccessRate?.toFixed(1) || 0}%
                  </p>
                  <p className="text-sm text-gray-500">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue Status */}
        {queueStatus && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-[#791E75]" />
                Task Queue Status
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-3xl font-bold text-red-600">{queueStatus.queued.urgent}</p>
                  <p className="text-sm text-gray-600">Urgent</p>
                </div>
                <div className="text-center p-4 bg-orange-50 rounded-lg">
                  <p className="text-3xl font-bold text-orange-600">{queueStatus.queued.high}</p>
                  <p className="text-sm text-gray-600">High</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-3xl font-bold text-blue-600">{queueStatus.queued.medium}</p>
                  <p className="text-sm text-gray-600">Medium</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-3xl font-bold text-gray-600">{queueStatus.queued.low}</p>
                  <p className="text-sm text-gray-600">Low</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Active Tasks: {queueStatus.active}</span>
                  <span>Total Completed: {queueStatus.completed}</span>
                </div>
                <Progress
                  value={queueStatus.completed > 0
                    ? (queueStatus.completed / (queueStatus.completed + totalQueuedTasks + queueStatus.active)) * 100
                    : 0}
                  className="h-2"
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="agents" className="space-y-6">
          <TabsList>
            <TabsTrigger value="agents" className="gap-2">
              <Bot className="h-4 w-4" />
              Agents ({agents.length})
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              Recent Tasks ({recentTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="agents">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map(agent => (
                <Card
                  key={agent.id}
                  className={`cursor-pointer transition-all hover:shadow-lg ${
                    agent.isActive ? 'border-green-300' : 'border-gray-200 opacity-75'
                  }`}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${agent.isActive ? 'bg-green-100' : 'bg-gray-100'}`}>
                          <Bot className={`h-5 w-5 ${agent.isActive ? 'text-green-600' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{agent.name}</CardTitle>
                          <Badge variant={agent.isActive ? 'default' : 'secondary'} className="mt-1">
                            {agent.isActive ? 'Active' : 'Offline'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{agent.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Tasks Completed</p>
                        <p className="font-semibold">{agent.metrics.tasksCompleted}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Success Rate</p>
                        <p className="font-semibold">{agent.metrics.successRate.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Avg Response</p>
                        <p className="font-semibold">{(agent.metrics.averageResponseTime / 1000).toFixed(1)}s</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Channels</p>
                        <p className="font-semibold">{agent.channels.length}</p>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1">
                      {agent.channels.slice(0, 3).map(channel => (
                        <Badge key={channel} variant="outline" className="text-xs">
                          {channel}
                        </Badge>
                      ))}
                      {agent.channels.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{agent.channels.length - 3}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tasks</CardTitle>
                <CardDescription>Latest tasks processed by the agent system</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTasks.slice(0, 20).map(task => (
                      <TableRow key={task.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            <p className="text-xs text-gray-500 truncate max-w-xs">{task.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{task.type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={getPriorityColor(task.priority)}>{task.priority}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{task.assignedTo.replace(/_/g, ' ')}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(task.status)}>{task.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-500">
                          {new Date(task.updatedAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                    {recentTasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          No tasks yet. Start the system to begin processing.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Agent Detail Dialog */}
      <Dialog open={!!selectedAgent} onOpenChange={() => setSelectedAgent(null)}>
        <DialogContent className="max-w-2xl">
          {selectedAgent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Bot className="h-6 w-6 text-[#791E75]" />
                  {selectedAgent.name}
                </DialogTitle>
                <DialogDescription>{selectedAgent.description}</DialogDescription>
              </DialogHeader>

              <div className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold mb-2">Status</h4>
                    <Badge variant={selectedAgent.isActive ? 'default' : 'secondary'}>
                      {selectedAgent.isActive ? 'Active' : 'Offline'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Personality</h4>
                    <p className="text-sm text-gray-600">{selectedAgent.personality}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Working Hours</h4>
                  <p className="text-sm text-gray-600">
                    {selectedAgent.workingHours.start} - {selectedAgent.workingHours.end}
                  </p>
                  <div className="flex gap-1 mt-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
                      <Badge
                        key={day}
                        variant={selectedAgent.workingDays.includes(day.toLowerCase()) ? 'default' : 'outline'}
                        className="text-xs"
                      >
                        {day}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Task Types</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgent.taskTypes.map(type => (
                      <Badge key={type} variant="outline" className="text-xs">
                        {type.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Communication Channels</h4>
                  <div className="flex flex-wrap gap-1">
                    {selectedAgent.channels.map(channel => (
                      <Badge key={channel} variant="secondary" className="text-xs">
                        {channel}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-[#791E75]">{selectedAgent.metrics.tasksCompleted}</p>
                    <p className="text-xs text-gray-500">Completed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-500">{selectedAgent.metrics.tasksFailed}</p>
                    <p className="text-xs text-gray-500">Failed</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-500">
                      {(selectedAgent.metrics.averageResponseTime / 1000).toFixed(1)}s
                    </p>
                    <p className="text-xs text-gray-500">Avg Response</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-500">
                      {selectedAgent.metrics.successRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">Success Rate</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
