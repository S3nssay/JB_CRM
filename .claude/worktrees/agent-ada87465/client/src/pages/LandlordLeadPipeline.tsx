import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ArrowLeft, Phone, MapPin, Calendar, PoundSterling,
  User, Home, FileText, CheckCircle, Loader2, Search,
  Building2, Clock, ArrowRight, Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { CallButton, EmailButton } from '@/components/CRMCommunications';

// Workflow stages with metadata
const WORKFLOW_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-500', icon: User, dateKey: 'created_at', agentKey: '' },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-500', icon: Phone, dateKey: 'contacted_at', agentKey: 'contactedByName' },
  { id: 'valuation_scheduled', label: 'Valuation Scheduled', color: 'bg-orange-500', icon: Calendar, dateKey: 'valuation_scheduled_date', agentKey: 'valuationScheduledByName' },
  { id: 'valuation_completed', label: 'Valuation Completed', color: 'bg-amber-500', icon: CheckCircle, dateKey: 'valuation_completed_date', agentKey: 'valuationCompletedByName' },
  { id: 'instruction_signed', label: 'Instruction Signed', color: 'bg-emerald-500', icon: FileText, dateKey: 'instruction_signed_date', agentKey: 'instructionSignedByName' },
  { id: 'listing_preparation', label: 'Listing Prep', color: 'bg-cyan-500', icon: Home, dateKey: 'listing_preparation_at', agentKey: 'listingPreparationByName' },
  { id: 'listed', label: 'Listed', color: 'bg-green-600', icon: Building2, dateKey: 'listed_at', agentKey: 'listedByName' }
] as const;

type WorkflowStage = typeof WORKFLOW_STAGES[number]['id'];

interface LandlordLead {
  id: number;
  full_name: string;
  email: string;
  phone: string;
  inquiry_type: string;
  property_address: string;
  postcode: string;
  property_type: string;
  bedrooms: number;
  message: string;
  timeframe: string;
  status: string;
  workflow_stage: WorkflowStage;
  workflow_updated_at: string;
  valuation_scheduled_date: string;
  valuation_completed_date: string;
  valuation_amount: number;
  instruction_signed_date: string;
  assigned_agent_id: number;
  assignedAgentName: string;
  linked_property_id: number;
  linkedPropertyTitle: string;
  created_at: string;
  notes: string;
  // Workflow tracking
  contacted_at: string | null;
  contactedByName: string | null;
  valuationScheduledByName: string | null;
  valuationCompletedByName: string | null;
  instructionSignedByName: string | null;
  listing_preparation_at: string | null;
  listingPreparationByName: string | null;
  listed_at: string | null;
  listedByName: string | null;
}

export default function LandlordLeadPipeline() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInquiryType, setSelectedInquiryType] = useState<string>('all');

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['/api/crm/landlord-leads'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlord-leads', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch landlord leads');
      return response.json();
    }
  });

  const { data: pipeline = {} } = useQuery({
    queryKey: ['/api/crm/landlord-leads/pipeline'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlord-leads/pipeline', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch pipeline');
      return response.json();
    }
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: WorkflowStage }) => {
      const response = await fetch(`/api/crm/landlord-leads/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ stage })
      });
      if (!response.ok) throw new Error('Failed to update stage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads/pipeline'] });
      toast({ title: 'Stage updated', description: 'Lead has been moved to the next stage.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update stage', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/landlord-leads/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete lead');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads/pipeline'] });
      toast({ title: 'Lead deleted', description: 'The lead has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete lead', variant: 'destructive' });
    }
  });

  const filteredLeads = leads.filter((lead: LandlordLead) => {
    const matchesSearch = !searchQuery ||
      lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.postcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.property_address?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedInquiryType === 'all' || lead.inquiry_type === selectedInquiryType;
    return matchesSearch && matchesType;
  });

  const leadsByStage: Record<WorkflowStage, LandlordLead[]> = {
    new: [], contacted: [], valuation_scheduled: [], valuation_completed: [],
    instruction_signed: [], listing_preparation: [], listed: []
  };

  filteredLeads.forEach((lead: LandlordLead) => {
    const stage = (lead.workflow_stage || 'new') as WorkflowStage;
    if (leadsByStage[stage]) leadsByStage[stage].push(lead);
  });

  const getNextStage = (currentStage: WorkflowStage): WorkflowStage | null => {
    const idx = WORKFLOW_STAGES.findIndex(s => s.id === currentStage);
    if (idx === -1 || idx >= WORKFLOW_STAGES.length - 1) return null;
    return WORKFLOW_STAGES[idx + 1].id;
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount / 100);

  const formatDateFull = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { return format(new Date(dateStr), 'dd MMM yyyy HH:mm'); } catch { return null; }
  };

  // Get workflow timeline entries that have dates
  const getTimeline = (lead: LandlordLead) => {
    return WORKFLOW_STAGES
      .map(s => ({
        label: s.label,
        date: (lead as any)[s.dateKey] as string | null,
        agent: s.agentKey ? (lead as any)[s.agentKey] as string | null : null,
      }))
      .filter(e => e.date);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/crm"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
              <Building2 className="h-8 w-8 text-[#791E75]" />
              <div>
                <h1 className="text-xl font-semibold">Lead Pipeline</h1>
                <p className="text-sm text-muted-foreground">Track leads from inquiry to listed property</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input placeholder="Search by name, email, postcode..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
              </div>
              <Select value={selectedInquiryType} onValueChange={setSelectedInquiryType}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Inquiry Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="valuation">Valuation</SelectItem>
                  <SelectItem value="selling">Selling</SelectItem>
                  <SelectItem value="letting">Letting</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-7 gap-2 mb-6">
          {WORKFLOW_STAGES.map((stage) => {
            const StageIcon = stage.icon;
            return (
              <Card key={stage.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${stage.color}`} />
                <CardContent className="p-3 text-center">
                  <StageIcon className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                  <div className="text-2xl font-bold">{pipeline[stage.id] || 0}</div>
                  <div className="text-xs text-muted-foreground truncate">{stage.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <TooltipProvider>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {WORKFLOW_STAGES.map((stage) => {
              const StageIcon = stage.icon;
              const stageLeads = leadsByStage[stage.id];
              return (
                <div key={stage.id} className="min-w-[280px] flex-shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${stage.color} text-white`}>
                    <StageIcon className="h-4 w-4" />
                    <span className="font-medium text-sm">{stage.label}</span>
                    <Badge variant="secondary" className="ml-auto bg-white/20 text-white">{stageLeads.length}</Badge>
                  </div>
                  <div className="bg-gray-100 rounded-b-lg p-2 min-h-[400px] space-y-2">
                    {stageLeads.length === 0 ? (
                      <div className="text-center text-sm text-gray-400 py-8">No leads in this stage</div>
                    ) : (
                      stageLeads.map((lead) => {
                        const stageConfig = WORKFLOW_STAGES.find(s => s.id === stage.id);
                        const stageDateVal = stageConfig ? (lead as any)[stageConfig.dateKey] : null;
                        const stageAgentVal = stageConfig?.agentKey ? (lead as any)[stageConfig.agentKey] : null;
                        const timeline = getTimeline(lead);

                        return (
                          <Card key={lead.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/crm/landlord-lead/${lead.id}`)}>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between">
                                <div className="font-medium text-sm truncate">{lead.full_name}</div>
                                <Badge variant="outline" className="text-xs ml-1 shrink-0">{lead.inquiry_type}</Badge>
                              </div>
                              {lead.property_address && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3" /><span className="truncate">{lead.property_address}</span>
                                </div>
                              )}
                              {lead.postcode && <div className="text-xs text-muted-foreground">{lead.postcode}</div>}
                              {lead.valuation_amount > 0 && (
                                <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                                  <PoundSterling className="h-3 w-3" />{formatCurrency(lead.valuation_amount)}
                                </div>
                              )}

                              {/* Quick Call/Email actions */}
                              <div className="flex gap-1">
                                {lead.phone && (
                                  <CallButton phoneNumber={lead.phone} contactName={lead.full_name} entityType="contact" entityId={lead.id} size="sm" showLabel={false} />
                                )}
                                {lead.email && (
                                  <EmailButton email={lead.email} contactName={lead.full_name} entityType="contact" entityId={lead.id} size="sm" showLabel={false} />
                                )}
                              </div>

                              {/* Current stage date + agent */}
                              {stageDateVal && (
                                <div className="bg-gray-50 rounded px-2 py-1 border border-gray-200">
                                  <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span>{formatDateFull(stageDateVal)}</span>
                                  </div>
                                  {stageAgentVal && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                                      <User className="h-3 w-3 shrink-0" />
                                      <span>{stageAgentVal}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Workflow timeline tooltip */}
                              {timeline.length > 1 && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div className="flex items-center gap-1 text-[10px] text-blue-600 cursor-help">
                                      <Clock className="h-3 w-3" />
                                      <span>{timeline.length} stage{timeline.length > 1 ? 's' : ''} recorded</span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent side="bottom" className="max-w-[280px]">
                                    <div className="space-y-1.5 py-1">
                                      <div className="font-semibold text-xs mb-1">Workflow Timeline</div>
                                      {timeline.map((entry, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                          <div className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                                          <div>
                                            <div className="font-medium">{entry.label}</div>
                                            <div className="text-gray-400">{formatDateFull(entry.date)}</div>
                                            {entry.agent && <div className="text-gray-400">by {entry.agent}</div>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <div className="flex gap-1">
                                {stage.id !== 'listed' && (
                                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={(e) => { e.stopPropagation(); const next = getNextStage(lead.workflow_stage || 'new'); if (next) updateStageMutation.mutate({ id: lead.id, stage: next }); }} disabled={updateStageMutation.isPending}>
                                    {updateStageMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <>Move Forward <ArrowRight className="h-3 w-3 ml-1" /></>}
                                  </Button>
                                )}
                                <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this lead?')) deleteMutation.mutate(lead.id); }} disabled={deleteMutation.isPending}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                              {stage.id === 'listed' && lead.linked_property_id && (
                                <Button size="sm" variant="default" className="w-full text-xs h-7 bg-[#791E75] hover:bg-[#5d1759]" onClick={(e) => { e.stopPropagation(); setLocation(`/crm/properties/${lead.linked_property_id}/edit`); }}>
                                  <Home className="h-3 w-3 mr-1" /> View Property
                                </Button>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TooltipProvider>
      </main>
    </div>
  );
}
