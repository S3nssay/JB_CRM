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
  Building2, ArrowRight, Trash2, Bed, Bath, CheckCircle,
  FileText, Clock, User, Calendar, Eye, Handshake
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Lettings pipeline — 9 stages from valuation enquiry to move-in
const LETTINGS_PIPELINE_STAGES = [
  { id: 'valuation_enquiry', label: 'Valuation Enquiry', color: 'bg-slate-500', icon: Clock, description: 'Initial rental valuation request', dateKey: 'valuation_enquiry_at', agentKey: 'valuation_enquiry_by_name' },
  { id: 'valuation_booked', label: 'Valuation Booked', color: 'bg-indigo-500', icon: Calendar, description: 'Rental valuation appointment scheduled', dateKey: 'valuation_booked_at', agentKey: 'valuation_booked_by_name' },
  { id: 'valuation_completed', label: 'Valuation Completed', color: 'bg-amber-500', icon: CheckCircle, description: 'Valuation done, rental assessment complete', dateKey: 'valuation_completed_at', agentKey: 'valuation_completed_by_name' },
  { id: 'instruction_signed', label: 'Instruction Signed', color: 'bg-cyan-500', icon: FileText, description: 'Landlord has signed letting agreement', dateKey: 'instruction_signed_at', agentKey: 'instruction_signed_by_name' },
  { id: 'listed', label: 'Listed', color: 'bg-blue-500', icon: Home, description: 'On market, accepting enquiries', dateKey: 'listed_at', agentKey: 'listed_by_name' },
  { id: 'viewings', label: 'Viewings', color: 'bg-violet-500', icon: Eye, description: 'Active viewings with prospective tenants', dateKey: 'viewings_at', agentKey: 'viewings_by_name' },
  { id: 'holding_deposit', label: 'Holding Deposit', color: 'bg-orange-500', icon: PoundSterling, description: 'Holding deposit received, referencing', dateKey: 'holding_deposit_at', agentKey: 'holding_deposit_by_name' },
  { id: 'tenancy_agreed', label: 'Tenancy Agreed', color: 'bg-emerald-500', icon: Handshake, description: 'Tenancy contract signed by all parties', dateKey: 'tenancy_agreed_at', agentKey: 'tenancy_agreed_by_name' },
  { id: 'move_in_complete', label: 'Move-in Complete', color: 'bg-green-600', icon: CheckCircle, description: 'Tenant has moved in, keys handed over', dateKey: 'move_in_complete_at', agentKey: 'move_in_complete_by_name' },
] as const;

interface LettingsProperty {
  id: number;
  title: string;
  address: string;
  address_line1: string;
  postcode: string;
  price: number;
  rent_amount: number | null;
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
  viewings_at: string | null;
  holding_deposit_at: string | null;
  tenancy_agreed_at: string | null;
  move_in_complete_at: string | null;
  // Agent names
  valuation_enquiry_by_name: string | null;
  valuation_booked_by_name: string | null;
  valuation_completed_by_name: string | null;
  instruction_signed_by_name: string | null;
  listed_by_name: string | null;
  viewings_by_name: string | null;
  holding_deposit_by_name: string | null;
  tenancy_agreed_by_name: string | null;
  move_in_complete_by_name: string | null;
}

// Timeline stages for tooltip display
const TIMELINE_STAGES = [
  { id: 'valuation_enquiry', label: 'Val. Enquiry', dateKey: 'valuation_enquiry_at', agentKey: 'valuation_enquiry_by_name' },
  { id: 'valuation_booked', label: 'Val. Booked', dateKey: 'valuation_booked_at', agentKey: 'valuation_booked_by_name' },
  { id: 'valuation_completed', label: 'Val. Completed', dateKey: 'valuation_completed_at', agentKey: 'valuation_completed_by_name' },
  { id: 'instruction_signed', label: 'Instruction', dateKey: 'instruction_signed_at', agentKey: 'instruction_signed_by_name' },
  { id: 'listed', label: 'Listed', dateKey: 'listed_at', agentKey: 'listed_by_name' },
  { id: 'viewings', label: 'Viewings', dateKey: 'viewings_at', agentKey: 'viewings_by_name' },
  { id: 'holding_deposit', label: 'Holding Deposit', dateKey: 'holding_deposit_at', agentKey: 'holding_deposit_by_name' },
  { id: 'tenancy_agreed', label: 'Tenancy Agreed', dateKey: 'tenancy_agreed_at', agentKey: 'tenancy_agreed_by_name' },
  { id: 'move_in_complete', label: 'Move-in Complete', dateKey: 'move_in_complete_at', agentKey: 'move_in_complete_by_name' },
];

export default function LettingsPropertyPipeline() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [marketedFilter, setMarketedFilter] = useState<string>('all');

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['/api/crm/lettings-pipeline'],
    queryFn: async () => {
      const response = await fetch('/api/crm/lettings-pipeline', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch lettings pipeline');
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
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lettings-pipeline'] });
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

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(price / 100);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { return format(new Date(dateStr), 'dd MMM yyyy HH:mm'); } catch { return null; }
  };

  // Filter properties
  const filteredProperties = properties.filter((p: LettingsProperty) => {
    const matchesSearch = !searchQuery ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMarketed = marketedFilter === 'all' ||
      (marketedFilter === 'marketed' && p.is_marketed !== false) ||
      (marketedFilter === 'not_marketed' && p.is_marketed === false);
    return matchesSearch && matchesMarketed;
  });

  // Group properties by pipeline_stage
  const propertiesByStage: Record<string, LettingsProperty[]> = {};
  LETTINGS_PIPELINE_STAGES.forEach(s => { propertiesByStage[s.id] = []; });

  filteredProperties.forEach((p: LettingsProperty) => {
    let stage = (p.pipeline_stage || p.status || 'listed').toLowerCase();
    // Map legacy status values
    if (['available', 'new', 'active'].includes(stage)) stage = 'listed';
    if (stage === 'let' || stage === 'completed') stage = 'move_in_complete';
    if (propertiesByStage[stage]) {
      propertiesByStage[stage].push(p);
    } else {
      propertiesByStage['listed'].push(p);
    }
  });

  // Progression path for lettings
  const progressionPath = ['valuation_enquiry', 'valuation_booked', 'valuation_completed', 'instruction_signed', 'listed', 'viewings', 'holding_deposit', 'tenancy_agreed', 'move_in_complete'];
  const getNextStatus = (currentStage: string): string | null => {
    let stage = (currentStage || 'listed').toLowerCase();
    if (['available', 'new', 'active'].includes(stage)) stage = 'listed';
    if (stage === 'let' || stage === 'completed') stage = 'move_in_complete';
    const idx = progressionPath.indexOf(stage);
    if (idx === -1 || idx >= progressionPath.length - 1) return null;
    return progressionPath[idx + 1];
  };

  // Get the current stage's date and agent for a property
  const getStageInfo = (property: LettingsProperty, stageId: string) => {
    const stage = LETTINGS_PIPELINE_STAGES.find(s => s.id === stageId);
    if (!stage) return null;
    const dateVal = (property as any)[stage.dateKey];
    const agentVal = (property as any)[stage.agentKey];
    return { date: dateVal, agent: agentVal };
  };

  // Get workflow timeline entries that have dates
  const getTimeline = (property: LettingsProperty) => {
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

  // Empty state
  if (properties.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow-sm border-b">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-4">
                <Link href="/crm"><Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button></Link>
                <Building2 className="h-8 w-8 text-[#791E75]" />
                <div>
                  <h1 className="text-xl font-semibold">Lettings Property Pipeline</h1>
                  <p className="text-sm text-muted-foreground">Track rental properties from valuation enquiry to move-in</p>
                </div>
              </div>
            </div>
          </div>
        </header>
        <main className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
          <Building2 className="h-16 w-16 text-gray-300 mb-4" />
          <h2 className="text-lg font-semibold text-gray-600 mb-2">No rental properties in pipeline</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
            Rental properties appear here when a valuation enquiry is created. Go to Properties to add a new rental listing.
          </p>
          <Link href="/crm/properties">
            <Button variant="outline">Go to Properties</Button>
          </Link>
        </main>
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
                <h1 className="text-xl font-semibold">Lettings Property Pipeline</h1>
                <p className="text-sm text-muted-foreground">Track rental properties from valuation enquiry to move-in</p>
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
        <div className="grid grid-cols-9 gap-2 mb-6">
          {LETTINGS_PIPELINE_STAGES.map((stage) => {
            const StageIcon = stage.icon;
            const count = propertiesByStage[stage.id]?.length || 0;
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

        {/* Kanban Board */}
        <TooltipProvider>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {LETTINGS_PIPELINE_STAGES.map((stage) => {
              const StageIcon = stage.icon;
              const stageProperties = propertiesByStage[stage.id] || [];
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
                        const nextLabel = nextStatus ? LETTINGS_PIPELINE_STAGES.find(s => s.id === nextStatus)?.label : null;
                        const stageInfo = getStageInfo(property, stage.id);
                        const timeline = getTimeline(property);
                        const rentDisplay = property.rent_amount || property.price;
                        return (
                          <Card key={property.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/crm/properties/${property.id}/edit`)}>
                            <CardContent className="p-3 space-y-2">
                              {/* Title */}
                              <div className="flex items-start justify-between gap-1">
                                <div className="font-semibold text-sm truncate flex-1">{property.title || 'Untitled'}</div>
                                <Badge variant="outline" className="text-[10px] shrink-0 border-purple-300 text-purple-700 bg-purple-50">
                                  Rent
                                </Badge>
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

                              {/* Rent - displayed as pcm */}
                              {rentDisplay > 0 && (
                                <div className="flex items-center gap-1 text-xs font-semibold text-green-700">
                                  <PoundSterling className="h-3 w-3" />
                                  {formatPrice(rentDisplay)} pcm
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
