import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Bot, Brain, Settings, MessageSquare, Mail, Phone,
  Target, Clock, Users, Building2, Wrench, TrendingUp,
  Megaphone, Save, RefreshCw, Play, Pause, AlertCircle,
  CheckCircle, Activity, Zap, Shield, ArrowLeft
} from 'lucide-react';

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: any;
  status: 'active' | 'paused' | 'error';
  settings: {
    enabled: boolean;
    responseDelay: number; // seconds
    workingHours: { start: string; end: string };
    workingDays: string[];
    communicationChannels: string[];
    autoEscalate: boolean;
    escalationThreshold: number;
    maxConcurrentTasks: number;
    personality: string;
    tone: string;
    language: string;
    customPrompt: string;
    priorityAreas: string[];
  };
  metrics: {
    tasksCompleted: number;
    avgResponseTime: number;
    successRate: number;
    lastActive: string;
  };
}

const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'supervisor',
    name: 'Supervisor Agent',
    description: 'Oversees all operations, routes tasks, and makes high-level decisions',
    icon: Brain,
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 0,
      workingHours: { start: '00:00', end: '23:59' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      communicationChannels: ['email', 'whatsapp', 'sms', 'phone'],
      autoEscalate: true,
      escalationThreshold: 30,
      maxConcurrentTasks: 50,
      personality: 'professional',
      tone: 'formal',
      language: 'en-GB',
      customPrompt: 'You are the supervisor of John Barclay Estate Agents. Monitor all operations and ensure excellent customer service.',
      priorityAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10']
    },
    metrics: {
      tasksCompleted: 1250,
      avgResponseTime: 2.5,
      successRate: 98.5,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'office-admin',
    name: 'Office Administration Agent',
    description: 'Handles contracts, documents, scheduling, and administrative tasks',
    icon: Users,
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 5,
      workingHours: { start: '09:00', end: '18:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
      communicationChannels: ['email', 'whatsapp'],
      autoEscalate: true,
      escalationThreshold: 60,
      maxConcurrentTasks: 20,
      personality: 'helpful',
      tone: 'professional',
      language: 'en-GB',
      customPrompt: 'You handle administrative tasks for John Barclay Estate Agents. Process contracts, schedule appointments, and manage documents.',
      priorityAreas: []
    },
    metrics: {
      tasksCompleted: 856,
      avgResponseTime: 15.2,
      successRate: 96.8,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'sales',
    name: 'Sales Agent',
    description: 'Handles property valuations, buyer enquiries, and offer negotiations',
    icon: TrendingUp,
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 2,
      workingHours: { start: '08:00', end: '20:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      communicationChannels: ['email', 'whatsapp', 'phone'],
      autoEscalate: true,
      escalationThreshold: 15,
      maxConcurrentTasks: 15,
      personality: 'enthusiastic',
      tone: 'persuasive',
      language: 'en-GB',
      customPrompt: 'You are a sales specialist for John Barclay Estate Agents. Help buyers find their perfect property and assist sellers in achieving the best price.',
      priorityAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8']
    },
    metrics: {
      tasksCompleted: 423,
      avgResponseTime: 8.5,
      successRate: 94.2,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'rental',
    name: 'Rental Agent',
    description: 'Manages tenant matching, viewing scheduling, and tenancy management',
    icon: Building2,
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 3,
      workingHours: { start: '08:00', end: '19:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      communicationChannels: ['email', 'whatsapp', 'phone'],
      autoEscalate: true,
      escalationThreshold: 20,
      maxConcurrentTasks: 15,
      personality: 'friendly',
      tone: 'helpful',
      language: 'en-GB',
      customPrompt: 'You are a lettings specialist for John Barclay Estate Agents. Help tenants find suitable rental properties and assist landlords with property management.',
      priorityAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10']
    },
    metrics: {
      tasksCompleted: 567,
      avgResponseTime: 10.3,
      successRate: 95.7,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'maintenance',
    name: 'Property Maintenance Agent',
    description: 'Handles maintenance tickets, contractor dispatch, and property inspections',
    icon: Wrench,
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 1,
      workingHours: { start: '07:00', end: '22:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      communicationChannels: ['email', 'whatsapp', 'sms', 'phone'],
      autoEscalate: true,
      escalationThreshold: 10,
      maxConcurrentTasks: 30,
      personality: 'efficient',
      tone: 'direct',
      language: 'en-GB',
      customPrompt: 'You handle property maintenance for John Barclay Estate Agents. Respond quickly to repair requests and coordinate with contractors.',
      priorityAreas: []
    },
    metrics: {
      tasksCompleted: 892,
      avgResponseTime: 5.2,
      successRate: 97.3,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'lead-gen-sales',
    name: 'Lead Generation Agent (Sales)',
    description: 'Vendor acquisition, valuation bookings, and market analysis',
    icon: Target,
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 0,
      workingHours: { start: '06:00', end: '22:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      communicationChannels: ['email', 'whatsapp', 'post'],
      autoEscalate: false,
      escalationThreshold: 0,
      maxConcurrentTasks: 100,
      personality: 'proactive',
      tone: 'professional',
      language: 'en-GB',
      customPrompt: 'You generate sales leads for John Barclay Estate Agents. Monitor the market for potential vendors, identify properties that have been listed too long, and reach out with valuation offers.',
      priorityAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10', 'W2']
    },
    metrics: {
      tasksCompleted: 2341,
      avgResponseTime: 0.5,
      successRate: 89.2,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'lead-gen-rentals',
    name: 'Lead Generation Agent (Rentals)',
    description: 'Landlord acquisition, tenant sourcing, and rental valuations',
    icon: Target,
    status: 'active',
    settings: {
      enabled: true,
      responseDelay: 0,
      workingHours: { start: '06:00', end: '22:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
      communicationChannels: ['email', 'whatsapp', 'post'],
      autoEscalate: false,
      escalationThreshold: 0,
      maxConcurrentTasks: 100,
      personality: 'proactive',
      tone: 'professional',
      language: 'en-GB',
      customPrompt: 'You generate rental leads for John Barclay Estate Agents. Find landlords looking for property management and tenants seeking rental properties.',
      priorityAreas: ['W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10']
    },
    metrics: {
      tasksCompleted: 1876,
      avgResponseTime: 0.8,
      successRate: 91.5,
      lastActive: new Date().toISOString()
    }
  },
  {
    id: 'marketing',
    name: 'Marketing Agent',
    description: 'Social media management, content creation, and campaign tracking',
    icon: Megaphone,
    status: 'paused',
    settings: {
      enabled: false,
      responseDelay: 0,
      workingHours: { start: '08:00', end: '20:00' },
      workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      communicationChannels: ['facebook', 'instagram', 'linkedin', 'twitter'],
      autoEscalate: true,
      escalationThreshold: 60,
      maxConcurrentTasks: 25,
      personality: 'creative',
      tone: 'engaging',
      language: 'en-GB',
      customPrompt: 'You manage social media marketing for John Barclay Estate Agents. Create engaging content, respond to social media inquiries, and track campaign performance.',
      priorityAreas: []
    },
    metrics: {
      tasksCompleted: 342,
      avgResponseTime: 12.4,
      successRate: 93.1,
      lastActive: new Date().toISOString()
    }
  }
];

export default function AgentSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<string>('supervisor');
  const [agents, setAgents] = useState<AgentConfig[]>(DEFAULT_AGENTS);

  // Fetch agent settings
  const { data: agentData, isLoading } = useQuery({
    queryKey: ['/api/crm/agents'],
    queryFn: async () => {
      const res = await fetch('/api/crm/agents');
      if (!res.ok) return DEFAULT_AGENTS;
      return res.json();
    }
  });

  const displayAgents = agentData || agents;
  const currentAgent = displayAgents.find((a: AgentConfig) => a.id === selectedAgent) || displayAgents[0];

  const updateAgentSetting = (agentId: string, path: string, value: any) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id !== agentId) return agent;
      const pathParts = path.split('.');
      const newAgent = { ...agent };
      let current: any = newAgent;
      for (let i = 0; i < pathParts.length - 1; i++) {
        current[pathParts[i]] = { ...current[pathParts[i]] };
        current = current[pathParts[i]];
      }
      current[pathParts[pathParts.length - 1]] = value;
      return newAgent;
    }));
  };

  const toggleAgentStatus = (agentId: string) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id !== agentId) return agent;
      const newStatus = agent.status === 'active' ? 'paused' : 'active';
      return {
        ...agent,
        status: newStatus,
        settings: { ...agent.settings, enabled: newStatus === 'active' }
      };
    }));
    toast({
      title: 'Agent status updated',
      description: `Agent has been ${currentAgent.status === 'active' ? 'paused' : 'activated'}.`
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800"><Activity className="h-3 w-3 mr-1" /> Active</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-100 text-yellow-800"><Pause className="h-3 w-3 mr-1" /> Paused</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-4">
          <Link href="/portal">
            <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bot className="h-6 w-6 text-[#791E75]" />
              AI Agent Settings
            </h1>
            <p className="text-gray-500">Configure AI agent behaviors and preferences</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Agent List Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Agents</CardTitle>
            </CardHeader>
            <CardContent className="p-2">
              <div className="space-y-1">
                {displayAgents.map((agent: AgentConfig) => {
                  const Icon = agent.icon;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => setSelectedAgent(agent.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                        selectedAgent === agent.id
                          ? 'bg-[#791E75] text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{agent.name}</p>
                        <p className={`text-xs truncate ${
                          selectedAgent === agent.id ? 'text-white/70' : 'text-gray-500'
                        }`}>
                          {agent.status === 'active' ? 'Running' : 'Paused'}
                        </p>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        agent.status === 'active' ? 'bg-green-400' :
                        agent.status === 'paused' ? 'bg-yellow-400' : 'bg-red-400'
                      }`} />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Agent Configuration */}
        <div className="lg:col-span-3 space-y-6">
          {/* Agent Header */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-[#791E75]/10 rounded-xl">
                    <currentAgent.icon className="h-8 w-8 text-[#791E75]" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-3">
                      {currentAgent.name}
                      {getStatusBadge(currentAgent.status)}
                    </h2>
                    <p className="text-gray-500">{currentAgent.description}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={currentAgent.status === 'active' ? 'outline' : 'default'}
                    onClick={() => toggleAgentStatus(currentAgent.id)}
                  >
                    {currentAgent.status === 'active' ? (
                      <><Pause className="h-4 w-4 mr-2" /> Pause</>
                    ) : (
                      <><Play className="h-4 w-4 mr-2" /> Activate</>
                    )}
                  </Button>
                  <Button>
                    <Save className="h-4 w-4 mr-2" /> Save Changes
                  </Button>
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#791E75]">
                    {currentAgent.metrics.tasksCompleted.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">Tasks Completed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#791E75]">
                    {currentAgent.metrics.avgResponseTime}s
                  </p>
                  <p className="text-xs text-gray-500">Avg Response Time</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-[#791E75]">
                    {currentAgent.metrics.successRate}%
                  </p>
                  <p className="text-xs text-gray-500">Success Rate</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    <Activity className="h-6 w-6 mx-auto" />
                  </p>
                  <p className="text-xs text-gray-500">
                    Active {new Date(currentAgent.metrics.lastActive).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings Sections */}
          <Accordion type="multiple" defaultValue={['general', 'communication', 'behavior']}>
            {/* General Settings */}
            <AccordionItem value="general">
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  General Settings
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Agent Enabled</Label>
                      <Switch
                        checked={currentAgent.settings.enabled}
                        onCheckedChange={(v) => updateAgentSetting(currentAgent.id, 'settings.enabled', v)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Working Hours</Label>
                      <div className="flex gap-2 items-center">
                        <Input
                          type="time"
                          value={currentAgent.settings.workingHours.start}
                          onChange={(e) => updateAgentSetting(currentAgent.id, 'settings.workingHours.start', e.target.value)}
                          className="w-32"
                        />
                        <span>to</span>
                        <Input
                          type="time"
                          value={currentAgent.settings.workingHours.end}
                          onChange={(e) => updateAgentSetting(currentAgent.id, 'settings.workingHours.end', e.target.value)}
                          className="w-32"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Working Days</Label>
                      <div className="flex gap-2 flex-wrap">
                        {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(day => (
                          <Badge
                            key={day}
                            variant={currentAgent.settings.workingDays.includes(day) ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => {
                              const days = currentAgent.settings.workingDays.includes(day)
                                ? currentAgent.settings.workingDays.filter((d: string) => d !== day)
                                : [...currentAgent.settings.workingDays, day];
                              updateAgentSetting(currentAgent.id, 'settings.workingDays', days);
                            }}
                          >
                            {day.charAt(0).toUpperCase() + day.slice(1)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Response Delay (seconds)</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[currentAgent.settings.responseDelay]}
                          onValueChange={([v]) => updateAgentSetting(currentAgent.id, 'settings.responseDelay', v)}
                          max={60}
                          step={1}
                          className="flex-1"
                        />
                        <span className="w-12 text-center">{currentAgent.settings.responseDelay}s</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Max Concurrent Tasks</Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          value={[currentAgent.settings.maxConcurrentTasks]}
                          onValueChange={([v]) => updateAgentSetting(currentAgent.id, 'settings.maxConcurrentTasks', v)}
                          max={100}
                          step={5}
                          className="flex-1"
                        />
                        <span className="w-12 text-center">{currentAgent.settings.maxConcurrentTasks}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-Escalate</Label>
                        <p className="text-xs text-gray-500">Escalate after {currentAgent.settings.escalationThreshold} mins</p>
                      </div>
                      <Switch
                        checked={currentAgent.settings.autoEscalate}
                        onCheckedChange={(v) => updateAgentSetting(currentAgent.id, 'settings.autoEscalate', v)}
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Communication Settings */}
            <AccordionItem value="communication">
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Communication Channels
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { id: 'email', name: 'Email', icon: Mail },
                    { id: 'whatsapp', name: 'WhatsApp', icon: MessageSquare },
                    { id: 'sms', name: 'SMS', icon: MessageSquare },
                    { id: 'phone', name: 'Phone', icon: Phone },
                    { id: 'facebook', name: 'Facebook', icon: MessageSquare },
                    { id: 'instagram', name: 'Instagram', icon: MessageSquare },
                    { id: 'linkedin', name: 'LinkedIn', icon: MessageSquare },
                    { id: 'twitter', name: 'Twitter', icon: MessageSquare },
                    { id: 'post', name: 'Post/Mail', icon: Mail }
                  ].map(channel => {
                    const isEnabled = currentAgent.settings.communicationChannels.includes(channel.id);
                    return (
                      <div
                        key={channel.id}
                        onClick={() => {
                          const channels = isEnabled
                            ? currentAgent.settings.communicationChannels.filter((c: string) => c !== channel.id)
                            : [...currentAgent.settings.communicationChannels, channel.id];
                          updateAgentSetting(currentAgent.id, 'settings.communicationChannels', channels);
                        }}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          isEnabled
                            ? 'border-[#791E75] bg-[#791E75]/5'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <channel.icon className={`h-6 w-6 mx-auto mb-2 ${isEnabled ? 'text-[#791E75]' : 'text-gray-400'}`} />
                        <p className={`text-sm text-center ${isEnabled ? 'font-medium' : 'text-gray-500'}`}>
                          {channel.name}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>

            {/* Behavior Settings */}
            <AccordionItem value="behavior">
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  AI Behavior & Personality
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4">
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Personality Style</Label>
                      <Select
                        value={currentAgent.settings.personality}
                        onValueChange={(v) => updateAgentSetting(currentAgent.id, 'settings.personality', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="helpful">Helpful</SelectItem>
                          <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                          <SelectItem value="efficient">Efficient</SelectItem>
                          <SelectItem value="proactive">Proactive</SelectItem>
                          <SelectItem value="creative">Creative</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Communication Tone</Label>
                      <Select
                        value={currentAgent.settings.tone}
                        onValueChange={(v) => updateAgentSetting(currentAgent.id, 'settings.tone', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="persuasive">Persuasive</SelectItem>
                          <SelectItem value="direct">Direct</SelectItem>
                          <SelectItem value="helpful">Helpful</SelectItem>
                          <SelectItem value="engaging">Engaging</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Language</Label>
                      <Select
                        value={currentAgent.settings.language}
                        onValueChange={(v) => updateAgentSetting(currentAgent.id, 'settings.language', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="en-GB">English (UK)</SelectItem>
                          <SelectItem value="en-US">English (US)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Priority Areas (Postcodes)</Label>
                      <Input
                        placeholder="e.g., W9, W10, NW6"
                        value={currentAgent.settings.priorityAreas.join(', ')}
                        onChange={(e) => {
                          const areas = e.target.value.split(',').map(a => a.trim()).filter(Boolean);
                          updateAgentSetting(currentAgent.id, 'settings.priorityAreas', areas);
                        }}
                      />
                      <p className="text-xs text-gray-500">Comma-separated list of postcode areas</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Custom System Prompt</Label>
                      <Textarea
                        value={currentAgent.settings.customPrompt}
                        onChange={(e) => updateAgentSetting(currentAgent.id, 'settings.customPrompt', e.target.value)}
                        rows={5}
                        placeholder="Enter custom instructions for this agent..."
                      />
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
}
