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
  FileText, XCircle, AlertTriangle, Handshake, EyeOff, Clock, User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// UK industry standard sales pipeline stages
const PIPELINE_STAGES = [
  { id: 'active', label: 'Available', color: 'bg-blue-500', icon: Home, description: 'On market, active marketing', dateKey: 'listed_at', agentKey: 'listed_by_name' },
  { id: 'under_offer', label: 'Under Offer', color: 'bg-orange-500', icon: Tag, description: 'Offer accepted, qualifying buyer', dateKey: 'under_offer_at', agentKey: 'under_offer_by_name' },
  { id: 'sstc', label: 'SSTC', color: 'bg-purple-500', icon: FileText, description: 'Sold Subject to Contract', dateKey: 'sstc_at', agentKey: 'sstc_by_name' },
  { id: 'exchanged', label: 'Exchanged', color: 'bg-emerald-500', icon: Handshake, description: 'Contracts exchanged, legally binding', dateKey: 'exchanged_at', agentKey: 'exchanged_by_name' },
  { id: 'completed', label: 'Completed', color: 'bg-green-600', icon: CheckCircle, description: 'Sale/Let completed', dateKey: 'completed_at', agentKey: 'completed_by_name' },
  { id: 'fallen_through', label: 'Fallen Through', color: 'bg-red-500', icon: AlertTriangle, description: 'Sale collapsed before exchange', dateKey: 'fallen_through_at', agentKey: '' },
  { id: 'withdrawn', label: 'Withdrawn', color: 'bg-gray-500', icon: XCircle, description: 'Taken off market', dateKey: 'withdrawn_at', agentKey: '' },
] as const;

type PipelineStatus = typeof PIPELINE_STAGES[number]['id'];

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
  is_listed: boolean;
  is_marketed: boolean;
  created_at: string;
  updated_at: string;
  images: string[] | null;
  // Workflow dates
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
  listed_by_name: string | null;
  under_offer_by_name: string | null;
  sstc_by_name: string | null;
  exchanged_by_name: string | null;
  completed_by_name: string | null;
}

// All pipeline stage date/agent pairs for timeline display
const TIMELINE_STAGES = [
  { id: 'active', label: 'Listed', dateKey: 'listed_at', agentKey: 'listed_by_name' },
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
  const [listingTypeFilter, setListingTypeFilter] = useState<string>('all');
  const [marketedFilter, setMarketedFilter] = useState<string>('all');

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/property-pipeline'] });
      toast({ title: 'Status updated', description: 'Property has been moved.' });
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

  const formatDateShort = (dateStr: string | null) => {
    if (!dateStr) return null;
    try { return format(new Date(dateStr), 'dd MMM yy'); } catch { return null; }
  };

  // Filter properties
  const filteredProperties = properties.filter((p: PipelineProperty) => {
    const matchesSearch = !searchQuery ||
      p.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.address?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.postcode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = listingTypeFilter === 'all' ||
      (listingTypeFilter === 'sale' && !p.is_rental) ||
      (listingTypeFilter === 'rental' && p.is_rental);
    const matchesMarketed = marketedFilter === 'all' ||
      (marketedFilter === 'marketed' && p.is_marketed !== false) ||
      (marketedFilter === 'not_marketed' && p.is_marketed === false);
    return matchesSearch && matchesType && matchesMarketed;
  });

  // Group properties by status — normalize variations
  const propertiesByStatus: Record<string, PipelineProperty[]> = {};
  PIPELINE_STAGES.forEach(s => { propertiesByStatus[s.id] = []; });

  filteredProperties.forEach((p: PipelineProperty) => {
    let status = (p.status || 'active').toLowerCase();
    if (['available', 'new', ''].includes(status)) status = 'active';
    if (status === 'sold' || status === 'let') status = 'completed';
    if (status === 'exchange') status = 'exchanged';
    if (propertiesByStatus[status]) {
      propertiesByStatus[status].push(p);
    } else {
      propertiesByStatus['active'].push(p);
    }
  });

  // Next stage logic
  const progressionPath = ['active', 'under_offer', 'sstc', 'exchanged', 'completed'];
  const getNextStatus = (currentStatus: string): string | null => {
    let status = (currentStatus || 'active').toLowerCase();
    if (['available', 'new', ''].includes(status)) status = 'active';
    if (status === 'exchange') status = 'exchanged';
    const idx = progressionPath.indexOf(status);
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
                <h1 className="text-xl font-semibold">Property Pipeline</h1>
                <p className="text-sm text-muted-foreground">Track properties from listing to completion</p>
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
              <Select value={listingTypeFilter} onValueChange={setListingTypeFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Listing Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="sale">Sales</SelectItem>
                  <SelectItem value="rental">Lettings</SelectItem>
                </SelectContent>
              </Select>
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
        <div className="grid grid-cols-7 gap-2 mb-6">
          {PIPELINE_STAGES.map((stage) => {
            const StageIcon = stage.icon;
            const count = propertiesByStatus[stage.id]?.length || 0;
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
        <TooltipProvider>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {PIPELINE_STAGES.map((stage) => {
              const StageIcon = stage.icon;
              const stageProperties = propertiesByStatus[stage.id] || [];
              return (
                <div key={stage.id} className="min-w-[280px] flex-shrink-0">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-t-lg ${stage.color} text-white`}>
                    <StageIcon className="h-4 w-4" />
                    <span className="font-medium text-sm">{stage.label}</span>
                    <Badge variant="secondary" className="ml-auto bg-white/20 text-white">{stageProperties.length}</Badge>
                  </div>
                  <div className="bg-gray-100 rounded-b-lg p-2 min-h-[400px] space-y-2">
                    {stageProperties.length === 0 ? (
                      <div className="text-center text-sm text-gray-400 py-8">No properties</div>
                    ) : (
                      stageProperties.map((property) => {
                        const nextStatus = getNextStatus(property.status);
                        const nextLabel = nextStatus ? PIPELINE_STAGES.find(s => s.id === nextStatus)?.label : null;
                        const stageInfo = getStageInfo(property, stage.id);
                        const timeline = getTimeline(property);
                        return (
                          <Card key={property.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setLocation(`/crm/properties/${property.id}/edit`)}>
                            <CardContent className="p-3 space-y-2">
                              {/* Title + type badge */}
                              <div className="flex items-start justify-between gap-1">
                                <div className="font-medium text-sm truncate flex-1">{property.title || 'Untitled'}</div>
                                <Badge variant="outline" className={`text-[10px] shrink-0 ${property.is_rental ? 'border-purple-300 text-purple-700 bg-purple-50' : 'border-amber-300 text-amber-700 bg-amber-50'}`}>
                                  {property.is_rental ? 'Rent' : 'Sale'}
                                </Badge>
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
                                  {property.is_rental && <span className="font-normal text-muted-foreground">/mo</span>}
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
                                {nextLabel && stage.id !== 'fallen_through' && stage.id !== 'withdrawn' && (
                                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: property.id, status: nextStatus! }); }} disabled={updateStatusMutation.isPending}>
                                    {updateStatusMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <>{nextLabel} <ArrowRight className="h-3 w-3 ml-1" /></>}
                                  </Button>
                                )}
                                {['under_offer', 'sstc'].includes(stage.id) && (
                                  <Button size="sm" variant="outline" className="text-xs h-7 px-2 text-orange-500 hover:text-orange-700 hover:bg-orange-50" title="Mark as fallen through" onClick={(e) => { e.stopPropagation(); if (confirm('Mark as fallen through?')) updateStatusMutation.mutate({ id: property.id, status: 'fallen_through' }); }}>
                                    <AlertTriangle className="h-3 w-3" />
                                  </Button>
                                )}
                                {['fallen_through', 'withdrawn'].includes(stage.id) && (
                                  <Button size="sm" variant="outline" className="flex-1 text-xs h-7 text-blue-600 hover:bg-blue-50" onClick={(e) => { e.stopPropagation(); updateStatusMutation.mutate({ id: property.id, status: 'active' }); }}>
                                    <Home className="h-3 w-3 mr-1" /> Re-list
                                  </Button>
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
