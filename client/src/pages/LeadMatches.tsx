import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft, Loader2, User, Home, Check, X,
  Bed, MapPin, PoundSterling, Target, CheckCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface LeadMatch {
  id: number;
  lead_id: number;
  property_id: number;
  match_score: number;
  match_reasons: {
    budget_match?: boolean;
    bedroom_match?: boolean;
    area_match?: boolean;
    property_type_match?: boolean;
  };
  status: string;
  created_at: string;
  // Lead info
  lead_name: string;
  lead_email: string;
  lead_phone: string;
  lead_type: string;
  min_budget: number;
  max_budget: number;
  preferred_bedrooms: number;
  // Property info
  property_title: string;
  property_address: string;
  property_postcode: string;
  property_price: number;
  property_rent_amount: number;
  property_bedrooms: number;
  property_type: string;
  property_images: string[];
  is_rental: boolean;
}

interface MatchStats {
  status: string;
  count: number;
}

const STATUS_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'dismissed', label: 'Dismissed' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-blue-100 text-blue-800',
  sent: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  dismissed: 'bg-gray-100 text-gray-600',
};

const formatPrice = (amount: number, isRental: boolean) => {
  const pounds = new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(amount / 100);
  return isRental ? `${pounds} pcm` : pounds;
};

export default function LeadMatches() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data: matches = [], isLoading } = useQuery<LeadMatch[]>({
    queryKey: ['/api/crm/lead-matches', statusFilter],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? `?status=${statusFilter}` : '';
      const response = await fetch(`/api/crm/lead-matches${params}`, { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch matches');
      return response.json();
    }
  });

  const { data: stats = [] } = useQuery<MatchStats[]>({
    queryKey: ['/api/crm/lead-matches/stats'],
    queryFn: async () => {
      const response = await fetch('/api/crm/lead-matches/stats', { credentials: 'include' });
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    }
  });

  const getStatCount = (status: string): number => {
    if (status === 'all') return stats.reduce((sum, s) => sum + s.count, 0);
    return stats.find(s => s.status === status)?.count || 0;
  };

  const approveMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const response = await fetch(`/api/crm/lead-matches/${matchId}/approve`, {
        method: 'PATCH', credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to approve match');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-matches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-matches/stats'] });
      toast({ title: 'Match approved', description: 'Property details sent to lead.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to approve match.', variant: 'destructive' });
    }
  });

  const dismissMutation = useMutation({
    mutationFn: async (matchId: number) => {
      const response = await fetch(`/api/crm/lead-matches/${matchId}/dismiss`, {
        method: 'PATCH', credentials: 'include'
      });
      if (!response.ok) throw new Error('Failed to dismiss match');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-matches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-matches/stats'] });
      toast({ title: 'Match dismissed' });
    }
  });

  const bulkApproveMutation = useMutation({
    mutationFn: async (matchIds: number[]) => {
      const response = await fetch('/api/crm/lead-matches/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ matchIds })
      });
      if (!response.ok) throw new Error('Failed to bulk approve');
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-matches'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/lead-matches/stats'] });
      setSelectedIds(new Set());
      toast({ title: 'Bulk approved', description: `${data.approved} matches approved, ${data.failed} failed.` });
    }
  });

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getScoreColor = (score: number): string => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-blue-100 text-blue-800';
    return 'bg-yellow-100 text-yellow-800';
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
              <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/leads')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Target className="h-8 w-8 text-[#791E75]" />
              <div>
                <h1 className="text-xl font-semibold">Lead Matches</h1>
                <p className="text-sm text-muted-foreground">Buyer and renter leads matched to newly listed properties</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {STATUS_FILTERS.map(filter => (
            <Button
              key={filter.value}
              variant={statusFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              className={statusFilter === filter.value ? 'bg-[#791E75] hover:bg-[#5d1759]' : ''}
              onClick={() => { setStatusFilter(filter.value); setSelectedIds(new Set()); }}
            >
              {filter.label}
              <Badge variant="secondary" className="ml-2 text-xs">
                {getStatCount(filter.value)}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Bulk approve bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg mb-4">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <Button
              size="sm"
              className="bg-[#791E75] hover:bg-[#5d1759]"
              onClick={() => bulkApproveMutation.mutate([...selectedIds])}
              disabled={bulkApproveMutation.isPending}
            >
              {bulkApproveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Approve Selected ({selectedIds.size})
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        )}

        {/* Match cards */}
        {matches.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Target className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No pending matches</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                When properties reach "Listed" in the sales or lettings pipeline, matching leads will appear here for your approval.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const price = match.is_rental ? match.property_rent_amount : match.property_price;
              const reasons = match.match_reasons || {};

              return (
                <Card key={match.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox for pending matches */}
                      {match.status === 'pending' && (
                        <div className="pt-1">
                          <Checkbox
                            checked={selectedIds.has(match.id)}
                            onCheckedChange={() => toggleSelection(match.id)}
                          />
                        </div>
                      )}

                      {/* Main content */}
                      <div className="flex-1 min-w-0">
                        {/* Property section */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Home className="h-4 w-4 text-gray-500" />
                              <span className="font-semibold text-sm">{match.property_title || 'Untitled Property'}</span>
                              <Badge variant="outline" className="text-xs">
                                {match.is_rental ? 'Rental' : 'Sale'}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {match.property_address}{match.property_postcode ? `, ${match.property_postcode}` : ''}
                              </span>
                              {price > 0 && (
                                <span className="flex items-center gap-1 font-medium text-green-600">
                                  <PoundSterling className="h-3 w-3" />
                                  {formatPrice(price, match.is_rental)}
                                </span>
                              )}
                              {match.property_bedrooms > 0 && (
                                <span className="flex items-center gap-1">
                                  <Bed className="h-3 w-3" />
                                  {match.property_bedrooms} bed
                                </span>
                              )}
                              {match.property_type && (
                                <span>{match.property_type}</span>
                              )}
                            </div>
                          </div>

                          {/* Match score */}
                          <Badge className={`text-sm font-semibold px-3 py-1 ${getScoreColor(match.match_score)}`}>
                            {match.match_score}%
                          </Badge>
                        </div>

                        {/* Lead section */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            <span className="font-medium text-gray-700">{match.lead_name}</span>
                          </span>
                          {match.lead_email && <span>{match.lead_email}</span>}
                          {match.lead_phone && <span>{match.lead_phone}</span>}
                          <Badge variant="outline" className="text-xs capitalize">
                            {match.lead_type === 'buyer' ? 'Buyer' : 'Renter'}
                          </Badge>
                        </div>

                        {/* Match reasons + actions row */}
                        <div className="flex items-center justify-between">
                          <div className="flex gap-2">
                            {reasons.budget_match && (
                              <Badge variant="secondary" className="text-xs">Budget match</Badge>
                            )}
                            {reasons.bedroom_match && (
                              <Badge variant="secondary" className="text-xs">Bedroom match</Badge>
                            )}
                            {reasons.area_match && (
                              <Badge variant="secondary" className="text-xs">Area match</Badge>
                            )}
                            {reasons.property_type_match && (
                              <Badge variant="secondary" className="text-xs">Property type match</Badge>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {match.status === 'pending' ? (
                              <>
                                <Button
                                  size="sm"
                                  className="bg-[#791E75] hover:bg-[#5d1759]"
                                  onClick={() => approveMutation.mutate(match.id)}
                                  disabled={approveMutation.isPending}
                                >
                                  {approveMutation.isPending ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                  ) : (
                                    <Check className="h-3 w-3 mr-1" />
                                  )}
                                  Approve & Send Details
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-gray-500 hover:text-gray-700"
                                  onClick={() => dismissMutation.mutate(match.id)}
                                  disabled={dismissMutation.isPending}
                                >
                                  <X className="h-3 w-3 mr-1" />
                                  Dismiss Match
                                </Button>
                              </>
                            ) : (
                              <Badge className={STATUS_COLORS[match.status] || 'bg-gray-100 text-gray-600'}>
                                {match.status.charAt(0).toUpperCase() + match.status.slice(1)}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
