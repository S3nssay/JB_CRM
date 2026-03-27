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
  ArrowLeft, MapPin, PoundSterling, Home, Loader2, Search,
  Building2, ArrowRight, Trash2, Bed, Bath, Tag, CheckCircle,
  FileText, XCircle, AlertTriangle, Handshake, EyeOff, Clock, User,
  Calendar, MoreVertical
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// UK industry standard sales pipeline stages — 9 active stages
const PIPELINE_STAGES = [
  { id: 'valuation_enquiry', label: 'Valuation Enquiry', color: 'bg-slate-500', icon: Clock, description: 'Initial valuation request received', dateKey: 'valuation_enquiry_at', agentKey: 'valuation_enquiry_by_name' },
  { id: 'valuation_booked', label: 'Valuation Booked', color: 'bg-indigo-500', icon: Calendar, description: 'Valuation appointment scheduled', dateKey: 'valuation_booked_at', agentKey: 'valuation_booked_by_name' },
  { id: 'valuation_completed', label: 'Valuation Completed', color: 'bg-amber-500', icon: CheckCircle, description: 'Valuation carried out, report pending', dateKey: 'valuation_completed_at', agentKey: 'valuation_completed_by_name' },
  { id: 'instruction_signed', label: 'Instruction Signed', color: 'bg-cyan-500', icon: FileText, description: 'Vendor has signed agency agreement', dateKey: 'instruction_signed_at', agentKey: 'instruction_signed_by_name' },
  { id: 'listed', label: 'Listed', color: 'bg-blue-500', icon: Home, description: 'On market, active marketing', dateKey: 'listed_at', agentKey: 'listed_by_name' },
  { id: 'under_offer', label: 'Under Offer', color: 'bg-orange-500', icon: Tag, description: 'Offer accepted, qualifying buyer', dateKey: 'under_offer_at', agentKey: 'under_offer_by_name' },
  { id: 'sstc', label: 'SSTC', color: 'bg-purple-500', icon: FileText, description: 'Sold Subject to Contract', dateKey: 'sstc_at', agentKey: 'sstc_by_name' },
  { id: 'exchanged', label: 'Exchanged', color: 'bg-emerald-500', icon: Handshake, description: 'Contracts exchanged, legally binding', dateKey: 'exchanged_at', agentKey: 'exchanged_by_name' },
  { id: 'completed', label: 'Completed', color: 'bg-green-600', icon: CheckCircle, description: 'Sale completed', dateKey: 'completed_at', agentKey: 'completed_by_name' },
] as const;

const TERMINAL_STAGES = [
  { id: 'fallen_through', label: 'Fallen Through', color: 'bg-red-500', icon: AlertTriangle, dateKey: 'fallen_through_at' },
  { id: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-500', icon: XCircle, dateKey: 'withdrawn_at' },
] as const;

interface PipelineProperty {
  id: number;
  title: string;
  address: string;
  address_line1: string;
  postcode: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  property_type: string;
  is_rental: boolean;
  is_residential: boolean;
  status: string;
  pipeline_stage: string;
  is_listed: boolean;
  is_marketed: boolean;
  created_at: string;
  updated_at: string;
  images: string[] | null;
  // Workflow dates
  valuation_enquiry_at: string | null;
  valuation_booked_at: string | null;
  valuation_completed_at: string | null;
  instruction_signed_at: string | null;
  listed_at: string | null;
  under_offer_at: string | null;
  sstc_at: string | null;
  exchanged_at: string | null;
  completed_at: string | null;
  fallen_through_at: string | null;
  withdrawn_at: string | null;
  valuation_date: string | null;
  valuation_amount: number | null;
  // Agent names
  valuation_enquiry_by_name: string | null;
  valuation_booked_by_name: string | null;
  valuation_completed_by_name: string | null;
  instruction_signed_by_name: string | null;
  listed_by_name: string | null;
  under_offer_by_name: string | null;
  sstc_by_name: string | null;
  exchanged_by_name: string | null;
  completed_by_name: string | null;
}

// All pipeline stage date/agent pairs for timeline display
const TIMELINE_STAGES = [
  { id: 'valuation_enquiry', label: 'Val. Enquiry', dateKey: 'valuation_enquiry_at', agentKey: 'valuation_enquiry_by_name' },
  { id: 'valuation_booked', label: 'Val. Booked', dateKey: 'valuation_booked_at', agentKey: 'valuation_booked_by_name' },
  { id: 'valuation_completed', label: 'Val. Completed', dateKey: 'valuation_completed_at', agentKey: 'valuation_completed_by_name' },
  { id: 'instruction_signed', label: 'Instruction', dateKey: 'instruction_signed_at', agentKey: 'instruction_signed_by_name' },
  { id: 'listed', label: 'Listed', dateKey: 'listed_at', agentKey: 'listed_by_name' },
  { id: 'under_offer', label: 'Under Offer', dateKey: 'under_offer_at', agentKey: 'under_offer_by_name' },
  { id: 'sstc', label: 'SSTC', dateKey: 'sstc_at', agentKey: 'sstc_by_name' },
  { id: 'exchanged', label: 'Exchanged', dateKey: 'exchanged_at', agentKey: 'exchanged_by_name' },
  { id: 'completed', label: 'Completed', dateKey: 'completed_at', agentKey: 'completed_by_name' },
];

export default function PropertyPipeline() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [marketedFilter, setMarketedFilter] = useState<string>('all');
  const [showTerminal, setShowTerminal] = useState(false);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['/api/crm/property-pipeline'],
    queryFn: async () => {
      const response = await fetch('/api/crm/property-pipeline', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch properties');
      return response.json();
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const response = await fetch(`/api/crm/property-pipeline/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update status');
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/property-pipeline'] });
      if (data?.matchCount > 0) {
        toast({ title: 'Status updated', description: `Property moved. ${data.matchCount} lead${data.matchCount > 1 ? 's' : ''} matched!` });
      } else {
        toast({ title: 'Status updated', description: 'Property has been moved.' });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update status', variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/properties/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to delete property');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/property-pipeline'] });
      toast({ title: 'Property deleted', description: 'The property has been removed.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete property', variant: 'destructive' });
    }
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(price / 100);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { return format(new Date(dateStr), 'dd MMM yyyy HH:mm'); } catch { return null; }
  };

  // Filter properties — sales only (no listing type filter needed)
  const filteredProperties = properties.filter((p: PipelineProperty) => {
    const matchesSearch = !searchQuery ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMarketed = marketedFilter === 'all' ||
      (marketedFilter === 'marketed' && p.is_marketed !== false) ||
      (marketedFilter === 'not_marketed' && p.is_marketed === false);
    return matchesSearch && matchesMarketed;
  });

  // Group properties by pipeline_stage — normalize variations
  const propertiesByStatus: Record<string, PipelineProperty[]> = {};
  PIPELINE_STAGES.forEach(s => { propertiesByStatus[s.id] = []; });
  // Also track terminal counts
  const terminalProperties: Record<string, PipelineProperty[]> = { fallen_through: [], withdrawn: [] };

  filteredProperties.forEach((p: PipelineProperty) => {
    let stage = (p.pipeline_stage || p.status || 'listed').toLowerCase();
    // Map legacy status values
    if (['available', 'new', 'active'].includes(stage)) stage = 'listed';
    if (stage === 'sold' || stage === 'let') stage = 'completed';
    if (stage === 'exchange') stage = 'exchanged';
    // Terminal stages go to separate tracking
    if (stage === 'fallen_through' || stage === 'withdrawn') {
      terminalProperties[stage].push(p);
    } else if (propertiesByStatus[stage]) {
      propertiesByStatus[stage].push(p);
    } else {
      propertiesByStatus['listed'].push(p);
    }
  });

  const terminalCount = terminalProperties.fallen_through.length + terminalProperties.withdrawn.length;

  // Next stage logic — full 9-stage progression
  const progressionPath = ['valuation_enquiry', 'valuation_booked', 'valuation_completed', 'instruction_signed', 'listed', 'under_offer', 'sstc', 'exchanged', 'completed'];
  const getNextStatus = (currentStage: string): string | null => {
    let stage = (currentStage || 'listed').toLowerCase();
    if (['available', 'new', 'active'].includes(stage)) stage = 'listed';
    if (stage === 'exchange') stage = 'exchanged';
    const idx = progressionPath.indexOf(stage);
    if (idx === -1 || idx >= progressionPath.length - 1) return null;
    return progressionPath[idx + 1];
  };

  // Get the current stage's date and agent for a property
  const getStageInfo = (property: PipelineProperty, stageId: string) => {
    const stage = PIPELINE_STAGES.find(s => s.id === stageId);
    if (!stage) return null;
    const dateVal = (property as any)[stage.dateKey];
    const agentVal = (property as any)[stage.agentKey];
    return { date: dateVal, agent: agentVal };
  };

  // Get workflow timeline entries that have dates
  const getTimeline = (property: PipelineProperty) => {
    return TIMELINE_STAGES
      .map(s => ({
        label: s.label,
        date: (property as any)[s.dateKey] as string | null,
        agent: (property as any)[s.agentKey] as string | null,
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
                <h1 className="text-xl font-semibold">Sales Property Pipeline</h1>
                <p className="text-sm text-muted-foreground">Track properties from valuation enquiry to completion</p>
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
                  <Input placeholder="Search by title, address, postcode..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
                </div>
              </div>
              <Select value={marketedFilter} onValueChange={setMarketedFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Marketing" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Marketing</SelectItem>
                  <SelectItem value="marketed">Marketed</SelectItem>
                  <SelectItem value="not_marketed">Not Marketed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Stats */}
        <div className="grid grid-cols-9 gap-2 mb-4">
          {PIPELINE_STAGES.map((stage) => {
            const StageIcon = stage.icon;
            const count = propertiesByStatus[stage.id]?.length || 0;
            return (
              <Card key={stage.id} className="relative overflow-hidden">
                <div className={`absolute top-0 left-0 right-0 h-1 ${stage.color}`} />
                <CardContent className="p-3 text-center">
                  <StageIcon className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                  <div className="text-xl font-semibold">{count}</div>
                  <div className="text-xs text-muted-foreground truncate">{stage.label}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Terminal stages summary */}
        {terminalCount > 0 && (
          <div className="mb-6 flex items-center gap-3">
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setShowTerminal(!showTerminal)}>
              <AlertTriangle className="h-3 w-3 mr-1 text-red-500" />
              {terminalProperties.fallen_through.length} fallen through
              <span className="mx-1">/</span>
              <XCircle className="h-3 w-3 mr-1 text-gray-500" />
              {terminalProperties.withdrawn.length} withdrawn
              <span className="ml-1 text-muted-foreground">{showTerminal ? '(hide)' : '(show)'}</span>
            </Button>
          </div>
        )}

        {/* Terminal properties list */}
        {showTerminal && terminalCount > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-4">
            {TERMINAL_STAGES.map(ts => {
              const TIcon = ts.icon;
              const props = terminalProperties[ts.id] || [];
              if (props.length === 0) return null;
              return (
                <div key={ts.id}>
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${ts.color} text-white`}>
                    <TIcon className="h-4 w-4" />
                    <span className="font-medium text-sm">{ts.label}</span>
                    <Badge variant="secondary" className="ml-auto bg-white/20 text-white">{props.length}</Badge>
                  </div>
                  <div className="bg-gray-100 rounded-b-lg p-2 space-y-2">
                    {props.map(property => (
                      <Card key={property.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/crm/properties/${property.id}/edit`)}>
                        <CardContent className="p-3 flex items-center justify-between">
                          <div>
                            <div className="font-medium text-sm">{property.title || 'Untitled'}</div>
                            <div className="text-xs text-muted-foreground">{property.address_line1 || property.address} {property.postcode}</div>
                          </div>
                          <Button size="sm" variant="outline" className="text-xs h-7 text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: property.id, status: 'listed' }); }}>
                            <Home className="h-3 w-3 mr-1" /> Re-list
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Kanban Board */}
        <TooltipProvider>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => {
              const StageIcon = stage.icon;
              const stageProperties = propertiesByStatus[stage.id] || [];
              return (
                <div key={stage.id} className="min-w-[280px] flex-shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${stage.color} text-white`}>
                    <StageIcon className="h-4 w-4" />
                    <span className="font-semibold text-sm">{stage.label}</span>
                    <Badge variant="secondary" className="ml-auto bg-white/20 text-white">{stageProperties.length}</Badge>
                  </div>
                  <div className="bg-gray-100 rounded-b-lg p-2 min-h-[400px] space-y-2">
                    {stageProperties.length === 0 ? (
                      <div className="text-center text-sm text-gray-400 py-8">No properties</div>
                    ) : (
                      stageProperties.map((property) => {
                        const currentStage = (property.pipeline_stage || property.status || 'listed').toLowerCase();
                        const nextStatus = getNextStatus(currentStage);
                        const nextLabel = nextStatus ? PIPELINE_STAGES.find(s => s.id === nextStatus)?.label : null;
                        const stageInfo = getStageInfo(property, stage.id);
                        const timeline = getTimeline(property);
                        const isTerminalCandidate = !['completed', 'fallen_through', 'withdrawn'].includes(stage.id);
                        return (
                          <Card key={property.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/crm/properties/${property.id}/edit`)}>
                            <CardContent className="p-3 space-y-2">
                              {/* Title */}
                              <div className="flex items-start justify-between gap-1">
                                <div className="font-semibold text-sm truncate flex-1">{property.title || 'Untitled'}</div>
                                {property.is_marketed === false && (
                                  <Badge variant="outline" className="text-[10px] shrink-0 border-gray-300 text-gray-500 bg-gray-50">
                                    <EyeOff className="h-2.5 w-2.5 mr-0.5" /> Off
                                  </Badge>
                                )}
                              </div>

                              {/* Address */}
                              {(property.address_line1 || property.address) && (
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <MapPin className="h-3 w-3 shrink-0" />
                                  <span className="truncate">{property.address_line1 || property.address}</span>
                                </div>
                              )}
                              {property.postcode && (
                                <div className="text-xs text-muted-foreground pl-4">{property.postcode}</div>
                              )}

                              {/* Price */}
                              {property.price > 0 && (
                                <div className="flex items-center gap-1 text-xs font-semibold text-green-700">
                                  <PoundSterling className="h-3 w-3" />
                                  {formatPrice(property.price)}
                                </div>
                              )}

                              {/* Beds / Baths / Type */}
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                {property.bedrooms > 0 && <span className="flex items-center gap-1"><Bed className="h-3 w-3" /> {property.bedrooms}</span>}
                                {property.bathrooms > 0 && <span className="flex items-center gap-1"><Bath className="h-3 w-3" /> {property.bathrooms}</span>}
                                {property.property_type && <span className="capitalize">{property.property_type}</span>}
                              </div>

                              {/* Current stage date + agent */}
                              {stageInfo?.date && (
                                <div className="bg-gray-50 rounded px-2 py-1 border border-gray-200">
                                  <div className="flex items-center gap-1 text-[11px] text-gray-600">
                                    <Clock className="h-3 w-3 shrink-0" />
                                    <span>{formatDate(stageInfo.date)}</span>
                                  </div>
                                  {stageInfo.agent && (
                                    <div className="flex items-center gap-1 text-[11px] text-gray-500 mt-0.5">
                                      <User className="h-3 w-3 shrink-0" />
                                      <span>{stageInfo.agent}</span>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Workflow timeline (tooltip with full history) */}
                              {timeline.length > 0 && (
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
                                            <div className="text-gray-400">{formatDate(entry.date)}</div>
                                            {entry.agent && <div className="text-gray-400">by {entry.agent}</div>}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              )}

                              <div className="text-[10px] text-muted-foreground">#{property.id}</div>

                              {/* Actions */}
                              <div className="flex gap-1">
                                {nextLabel && (
                                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: property.id, status: nextStatus! }); }} disabled={updateStatusMutation.isPending}>
                                    {updateStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{nextLabel} <ArrowRight className="h-3 w-3 ml-1" /></>}
                                  </Button>
                                )}
                                {/* Terminal actions: Fallen Through / Withdrawn */}
                                {isTerminalCandidate && (
                                  <>
                                    <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50" title="Mark as fallen through" onClick={(e) => { e.stopPropagation(); if (confirm('Mark as Fallen Through? This will move the property out of the active pipeline.')) updateStatusMutation.mutate({ id: property.id, status: 'fallen_through' }); }}>
                                      <AlertTriangle className="h-3 w-3" />
                                    </Button>
                                    <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-gray-500 hover:text-gray-700 hover:bg-gray-50" title="Withdraw property" onClick={(e) => { e.stopPropagation(); if (confirm('Withdraw Property? This property will be removed from active marketing.')) updateStatusMutation.mutate({ id: property.id, status: 'withdrawn' }); }}>
                                      <XCircle className="h-3 w-3" />
                                    </Button>
                                  </>
                                )}
                                <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); if (confirm('Delete this property?')) deleteMutation.mutate(property.id); }} disabled={deleteMutation.isPending}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
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
