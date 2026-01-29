import { useState } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, DollarSign,
  User, Home, FileText, CheckCircle, Loader2, Search,
  ChevronRight, Building2, Clock, ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Workflow stages with metadata
const WORKFLOW_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-500', icon: User },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-500', icon: Phone },
  { id: 'valuation_scheduled', label: 'Valuation Scheduled', color: 'bg-orange-500', icon: Calendar },
  { id: 'valuation_completed', label: 'Valuation Completed', color: 'bg-amber-500', icon: CheckCircle },
  { id: 'instruction_signed', label: 'Instruction Signed', color: 'bg-emerald-500', icon: FileText },
  { id: 'listing_preparation', label: 'Listing Prep', color: 'bg-cyan-500', icon: Home },
  { id: 'listed', label: 'Listed', color: 'bg-green-600', icon: Building2 }
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
}

export default function LandlordLeadPipeline() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInquiryType, setSelectedInquiryType] = useState<string>('all');

  // Fetch all landlord leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['/api/crm/landlord-leads'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlord-leads');
      if (!response.ok) throw new Error('Failed to fetch landlord leads');
      return response.json();
    }
  });

  // Fetch pipeline counts
  const { data: pipeline = {} } = useQuery({
    queryKey: ['/api/crm/landlord-leads/pipeline'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlord-leads/pipeline');
      if (!response.ok) throw new Error('Failed to fetch pipeline');
      return response.json();
    }
  });

  // Mutation to update stage
  const updateStageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: number; stage: WorkflowStage }) => {
      const response = await fetch(`/api/crm/landlord-leads/${id}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
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

  // Filter leads
  const filteredLeads = leads.filter((lead: LandlordLead) => {
    const matchesSearch = !searchQuery ||
      lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.postcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.property_address?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = selectedInquiryType === 'all' || lead.inquiry_type === selectedInquiryType;

    return matchesSearch && matchesType;
  });

  // Group leads by workflow stage
  const leadsByStage: Record<WorkflowStage, LandlordLead[]> = {
    new: [],
    contacted: [],
    valuation_scheduled: [],
    valuation_completed: [],
    instruction_signed: [],
    listing_preparation: [],
    listed: []
  };

  filteredLeads.forEach((lead: LandlordLead) => {
    const stage = (lead.workflow_stage || 'new') as WorkflowStage;
    if (leadsByStage[stage]) {
      leadsByStage[stage].push(lead);
    }
  });

  const getNextStage = (currentStage: WorkflowStage): WorkflowStage | null => {
    const currentIndex = WORKFLOW_STAGES.findIndex(s => s.id === currentStage);
    if (currentIndex === -1 || currentIndex >= WORKFLOW_STAGES.length - 1) return null;
    return WORKFLOW_STAGES[currentIndex + 1].id;
  };

  const moveToNextStage = (lead: LandlordLead) => {
    const nextStage = getNextStage(lead.workflow_stage || 'new');
    if (nextStage) {
      updateStageMutation.mutate({ id: lead.id, stage: nextStage });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(amount / 100);
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
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/crm">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <Building2 className="h-8 w-8 text-[#791E75]" />
              <div>
                <h1 className="text-xl font-semibold">Landlord Lead Pipeline</h1>
                <p className="text-sm text-muted-foreground">Track leads from inquiry to listed property</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, postcode..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={selectedInquiryType} onValueChange={setSelectedInquiryType}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Inquiry Type" />
                </SelectTrigger>
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

        {/* Pipeline Stats */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {WORKFLOW_STAGES.map((stage) => {
            const StageIcon = stage.icon;
            const count = pipeline[stage.id] || 0;
            return (
              <Card key={stage.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${stage.color}`} />
                <CardContent className="p-3 text-center">
                  <StageIcon className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                  <div className="text-2xl font-bold">{count}</div>
                  <div className="text-xs text-muted-foreground truncate">{stage.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Kanban Board */}
        <div className="grid grid-cols-7 gap-4 overflow-x-auto">
          {WORKFLOW_STAGES.map((stage) => {
            const StageIcon = stage.icon;
            const stageLeads = leadsByStage[stage.id];
            return (
              <div key={stage.id} className="min-w-[250px]">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${stage.color} text-white`}>
                  <StageIcon className="h-4 w-4" />
                  <span className="font-medium text-sm">{stage.label}</span>
                  <Badge variant="secondary" className="ml-auto bg-white/20 text-white">
                    {stageLeads.length}
                  </Badge>
                </div>
                <div className="bg-gray-100 rounded-b-lg p-2 min-h-[400px] space-y-2">
                  {stageLeads.length === 0 ? (
                    <div className="text-center text-sm text-gray-400 py-8">
                      No leads in this stage
                    </div>
                  ) : (
                    stageLeads.map((lead) => (
                      <Card
                        key={lead.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setLocation(`/crm/landlord-lead/${lead.id}`)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="font-medium text-sm truncate">{lead.full_name}</div>
                            <Badge variant="outline" className="text-xs ml-1 shrink-0">
                              {lead.inquiry_type}
                            </Badge>
                          </div>

                          {lead.property_address && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />
                              <span className="truncate">{lead.property_address}</span>
                            </div>
                          )}

                          {lead.postcode && (
                            <div className="text-xs text-muted-foreground">
                              {lead.postcode}
                            </div>
                          )}

                          {lead.valuation_amount > 0 && (
                            <div className="flex items-center gap-1 text-xs font-medium text-green-600">
                              <DollarSign className="h-3 w-3" />
                              {formatCurrency(lead.valuation_amount)}
                            </div>
                          )}

                          {lead.valuation_scheduled_date && (
                            <div className="flex items-center gap-1 text-xs text-orange-600">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(lead.valuation_scheduled_date), 'dd MMM HH:mm')}
                            </div>
                          )}

                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(lead.created_at), 'dd MMM yyyy')}
                          </div>

                          {stage.id !== 'listed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full text-xs h-7"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveToNextStage(lead);
                              }}
                              disabled={updateStageMutation.isPending}
                            >
                              {updateStageMutation.isPending ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <>
                                  Move Forward <ArrowRight className="h-3 w-3 ml-1" />
                                </>
                              )}
                            </Button>
                          )}

                          {stage.id === 'listed' && lead.linked_property_id && (
                            <Button
                              size="sm"
                              variant="default"
                              className="w-full text-xs h-7 bg-[#791E75] hover:bg-[#5d1759]"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/crm/properties/${lead.linked_property_id}/edit`);
                              }}
                            >
                              <Home className="h-3 w-3 mr-1" /> View Property
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
