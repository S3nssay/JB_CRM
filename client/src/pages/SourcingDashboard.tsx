import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import {
  TrendingUp, Send, MessageCircle, Calendar, Search, MapPin, Home, Mail,
  FileText, CheckCircle, XCircle, Clock, AlertCircle, Plus, Edit, Trash2, Pause, Play,
  Eye, Target, BarChart3, Settings2, Loader2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// Types
interface Lead {
  id: number;
  leadSource: string;
  propertyAddress: string;
  postcode: string;
  ownerName: string;
  ownerEmail: string;
  leadScore: number;
  propensityScore: number;
  daysOnMarket: number;
  originalAgent: string;
  status: string;
  contactAttempts: number;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  auctionHouse: string | null;
  auctionResult: string | null;
  createdAt: string;
}

interface LeadDetail {
  lead: Lead;
  contactHistory: Array<{
    id: number;
    channel: string;
    subject: string;
    content: string;
    status: string;
    approvalStatus: string;
    sentAt: string | null;
    createdAt: string;
  }>;
  propensityScore: {
    score: number;
    factors: Record<string, any>;
  };
}

interface PipelineStage {
  count: number;
  leads: Lead[];
}

interface Campaign {
  id: number;
  name: string;
  sourceType: string;
  targetPostcodes: string;
  priceMin: number;
  priceMax: number;
  propertyTypes: string[];
  staleThreshold: number;
  scanFrequency: string;
  active: boolean;
  leadsFound: number;
  contacted: number;
  converted: number;
  createdAt: string;
}

interface MetricsBySource {
  source: string;
  leadsFound: number;
  outreachSent: number;
  responses: number;
  responseRate: number;
  valuations: number;
  instructions: number;
  conversionRate: number;
}

// Helpers
const SOURCE_BADGE_COLORS: Record<string, string> = {
  land_registry: 'border-[#791E75] text-[#791E75]',
  stale_listing: 'border-[#F8B324] text-[#F8B324]',
  auction: 'border-red-500 text-red-500',
  planning: 'border-blue-500 text-blue-500',
  competitor: 'border-gray-500 text-gray-500',
};

const SOURCE_LABELS: Record<string, string> = {
  land_registry: 'Land Registry',
  stale_listing: 'Stale Listing',
  auction: 'Auction',
  planning: 'Planning',
  competitor: 'Competitor',
};

const PIPELINE_STAGES = [
  { key: 'new', label: 'New' },
  { key: 'researching', label: 'Scored' },
  { key: 'ready_to_contact', label: 'Draft Ready' },
  { key: 'awaiting_approval', label: 'Awaiting Approval' },
  { key: 'sent', label: 'Sent' },
  { key: 'responded', label: 'Responded' },
  { key: 'valuation_booked', label: 'Valuation Booked' },
  { key: 'instructed', label: 'Instructed' },
];

function getScoreColor(score: number): string {
  if (score >= 70) return 'bg-green-500';
  if (score >= 40) return 'bg-[#F8B324]';
  return 'bg-gray-400';
}

// Campaign form schema
const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  sourceType: z.string().min(1, 'Source type is required'),
  targetPostcodes: z.string().min(1, 'Target postcodes are required'),
  priceMin: z.number().min(0).default(0),
  priceMax: z.number().min(0).default(0),
  propertyTypes: z.array(z.string()).default([]),
  staleThreshold: z.number().min(1).default(90),
  scanFrequency: z.string().default('daily'),
  active: z.boolean().default(true),
});

type CampaignFormValues = z.infer<typeof campaignSchema>;

// ===== STATS ROW =====
function StatsRow() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['/api/crm/sourcing/metrics'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/crm/sourcing/metrics');
      return res.json();
    },
  });

  const stats = [
    { label: 'Leads Sourced (This Month)', value: metrics?.leadsSourcedThisMonth ?? 0, icon: TrendingUp, color: 'bg-[#791E75]' },
    { label: 'Outreach Sent', value: metrics?.outreachSent ?? 0, icon: Send, color: 'bg-[#791E75]/80' },
    { label: 'Response Rate', value: metrics?.responseRate != null ? `${metrics.responseRate}%` : '0%', icon: MessageCircle, color: 'bg-[#F8B324]' },
    { label: 'Valuations Booked', value: metrics?.valuationsBooked ?? 0, icon: Calendar, color: 'bg-[#F8B324]/80' },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-8 w-16" />
                </div>
                <Skeleton className="h-12 w-12 rounded-full" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-2">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ===== LEAD CARD =====
function LeadCard({
  lead,
  stageKey,
  onApprove,
  onReject,
  onClick,
  isApproving,
  isRejecting,
}: {
  lead: Lead;
  stageKey: string;
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
  onClick: () => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}) {
  const sourceClass = SOURCE_BADGE_COLORS[lead.leadSource] || 'border-gray-400 text-gray-400';
  const sourceLabel = SOURCE_LABELS[lead.leadSource] || lead.leadSource;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow mb-2"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-1">
          <Badge variant="outline" className={sourceClass}>
            {sourceLabel}
          </Badge>
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${getScoreColor(lead.propensityScore || lead.leadScore || 0)}`}>
            {lead.propensityScore || lead.leadScore || '—'}
          </div>
        </div>
        <p className="font-medium text-sm truncate">{lead.propertyAddress}</p>
        <p className="text-sm text-muted-foreground truncate">Owner: {lead.ownerName}</p>
        <p className="text-xs text-muted-foreground mt-1">
          {lead.daysOnMarket ? `Listed: ${lead.daysOnMarket} days` : ''}
          {lead.originalAgent ? ` (${lead.originalAgent})` : ''}
        </p>
        <div className="flex items-center gap-1 mt-1 text-muted-foreground">
          <Mail className="h-3 w-3" />
          <FileText className="h-3 w-3" />
        </div>
        {stageKey === 'awaiting_approval' && (
          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="flex-1 min-h-[44px] bg-[#791E75] hover:bg-[#791E75]/90 text-white"
              onClick={() => onApprove?.(lead.id)}
              disabled={isApproving}
            >
              {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-h-[44px] text-red-500 border-red-500 hover:bg-red-50"
              onClick={() => onReject?.(lead.id)}
              disabled={isRejecting}
            >
              {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ===== LEAD DETAIL PANEL =====
function LeadDetailPanel({
  leadId,
  open,
  onOpenChange,
}: {
  leadId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState('');
  const [editedSubject, setEditedSubject] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: detail, isLoading } = useQuery<LeadDetail>({
    queryKey: ['/api/crm/sourcing/leads', leadId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/crm/sourcing/leads/${leadId}`);
      return res.json();
    },
    enabled: !!leadId && open,
  });

  // Find the latest pending contact for approval actions
  const pendingContact = detail?.contactHistory?.find(
    (c) => c.approvalStatus === 'pending'
  );

  // Initialize edit fields when detail loads
  const latestDraft = detail?.contactHistory?.[0];
  if (latestDraft && !editedContent) {
    setEditedContent(latestDraft.content || '');
    setEditedSubject(latestDraft.subject || '');
  }

  const approveMutation = useMutation({
    mutationFn: async (contactId: number) => {
      await apiRequest('POST', `/api/crm/sourcing/approvals/${contactId}/approve`);
    },
    onSuccess: () => {
      toast({ title: 'Outreach approved and queued for sending' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing'] });
      onOpenChange(false);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ contactId, reason }: { contactId: number; reason?: string }) => {
      await apiRequest('POST', `/api/crm/sourcing/approvals/${contactId}/reject`, { reason });
    },
    onSuccess: () => {
      toast({ title: 'Lead rejected and removed from pipeline' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing'] });
      onOpenChange(false);
      setShowRejectDialog(false);
    },
  });

  const editMutation = useMutation({
    mutationFn: async ({ contactId, content, subject }: { contactId: number; content: string; subject?: string }) => {
      await apiRequest('PUT', `/api/crm/sourcing/approvals/${contactId}/edit`, { content, subject });
    },
    onSuccess: () => {
      toast({ title: 'Draft updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/leads', leadId] });
    },
  });

  const lead = detail?.lead;
  const sourceClass = lead ? (SOURCE_BADGE_COLORS[lead.leadSource] || 'border-gray-400 text-gray-400') : '';
  const sourceLabel = lead ? (SOURCE_LABELS[lead.leadSource] || lead.leadSource) : '';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 pt-6">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : lead ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{lead.propertyAddress}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={sourceClass}>{sourceLabel}</Badge>
                  <span className="text-sm text-muted-foreground">{lead.postcode}</span>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${getScoreColor(detail?.propensityScore?.score || lead.propensityScore || 0)}`}>
                    {detail?.propensityScore?.score || lead.propensityScore || '—'}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Owner: {lead.ownerName}</p>
              </SheetHeader>

              <Separator className="my-4" />

              {/* Property Intel */}
              <div className="mb-4">
                <h4 className="font-semibold text-sm mb-2">Property Intel</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Days on Market:</span>
                    <span className="ml-2 font-medium">{lead.daysOnMarket || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Original Agent:</span>
                    <span className="ml-2 font-medium">{lead.originalAgent || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact Attempts:</span>
                    <span className="ml-2 font-medium">{lead.contactAttempts}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-2 font-medium capitalize">{lead.status?.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Outreach Draft */}
              <div className="mb-4">
                <h4 className="font-semibold text-sm mb-2">Outreach Draft</h4>
                {latestDraft ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {latestDraft.channel === 'email' ? <Mail className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      <span className="capitalize">{latestDraft.channel}</span>
                      <Badge variant="outline" className="text-xs">
                        {latestDraft.approvalStatus}
                      </Badge>
                    </div>
                    <Input
                      value={editedSubject}
                      onChange={(e) => setEditedSubject(e.target.value)}
                      placeholder="Subject"
                      className="text-sm"
                    />
                    <Textarea
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      rows={8}
                      className="text-sm"
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No outreach draft available.</p>
                )}
              </div>

              <Separator className="my-4" />

              {/* Follow-Up Timeline */}
              <div className="mb-4">
                <h4 className="font-semibold text-sm mb-2">Follow-Up Timeline</h4>
                {detail?.contactHistory && detail.contactHistory.length > 0 ? (
                  <div className="space-y-2">
                    {detail.contactHistory.map((entry, idx) => (
                      <div key={entry.id || idx} className="flex items-start gap-2 text-sm">
                        {entry.status === 'sent' ? (
                          <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                        ) : entry.status === 'pending' ? (
                          <Clock className="h-4 w-4 text-[#F8B324] mt-0.5" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-gray-400 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium capitalize">{entry.channel} - {entry.subject || 'Outreach'}</p>
                          <p className="text-xs text-muted-foreground">
                            {entry.sentAt ? new Date(entry.sentAt).toLocaleDateString() : entry.createdAt ? new Date(entry.createdAt).toLocaleDateString() : 'Scheduled'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No contact history yet.</p>
                )}
              </div>

              <Separator className="my-4" />

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {pendingContact && (
                  <>
                    <Button
                      className="min-h-[44px] bg-[#791E75] hover:bg-[#791E75]/90 text-white"
                      onClick={() => approveMutation.mutate(pendingContact.id)}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Approve Outreach
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => {
                        if (latestDraft) {
                          editMutation.mutate({
                            contactId: latestDraft.id,
                            content: editedContent,
                            subject: editedSubject,
                          });
                        }
                      }}
                      disabled={editMutation.isPending}
                    >
                      {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                      Edit Draft
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px] text-red-500 border-red-500 hover:bg-red-50"
                      onClick={() => setShowRejectDialog(true)}
                      disabled={rejectMutation.isPending}
                    >
                      {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                      Reject Lead
                    </Button>
                  </>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground pt-6">Lead not found.</p>
          )}
        </SheetContent>
      </Sheet>

      {/* Reject Confirmation Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Lead</DialogTitle>
            <DialogDescription>
              This lead will be marked as rejected and removed from the pipeline. You can find it in the rejected filter. Continue?
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for rejection (optional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (pendingContact) {
                  rejectMutation.mutate({ contactId: pendingContact.id, reason: rejectReason });
                }
              }}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Reject Lead
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ===== PIPELINE TAB =====
function PipelineTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const { data: pipeline, isLoading, isError } = useQuery({
    queryKey: ['/api/crm/sourcing/leads', { search: searchQuery, source: sourceFilter }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      const res = await apiRequest('GET', `/api/crm/sourcing/leads?${params.toString()}`);
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (leadId: number) => {
      // Find the contact history entry for approval
      const approvals = await apiRequest('GET', '/api/crm/sourcing/approvals');
      const approvalsData = await approvals.json();
      const approval = approvalsData.find((a: any) => a.leadId === leadId);
      if (approval) {
        await apiRequest('POST', `/api/crm/sourcing/approvals/${approval.contactHistoryId}/approve`);
      }
    },
    onMutate: (leadId) => setApprovingId(leadId),
    onSuccess: () => {
      toast({ title: 'Outreach approved and queued for sending' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing'] });
    },
    onSettled: () => setApprovingId(null),
  });

  const rejectMutation = useMutation({
    mutationFn: async (leadId: number) => {
      const approvals = await apiRequest('GET', '/api/crm/sourcing/approvals');
      const approvalsData = await approvals.json();
      const approval = approvalsData.find((a: any) => a.leadId === leadId);
      if (approval) {
        await apiRequest('POST', `/api/crm/sourcing/approvals/${approval.contactHistoryId}/reject`);
      }
    },
    onMutate: (leadId) => setRejectingId(leadId),
    onSuccess: () => {
      toast({ title: 'Lead rejected and removed from pipeline' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing'] });
    },
    onSettled: () => setRejectingId(null),
  });

  // Map API stages to UI stages
  const getStageLeads = (stageKey: string): Lead[] => {
    if (!pipeline?.stages) return [];
    const stages = pipeline.stages;
    switch (stageKey) {
      case 'new': return stages.new?.leads || [];
      case 'researching': return stages.researching?.leads || [];
      case 'ready_to_contact': return stages.ready_to_contact?.leads || [];
      case 'awaiting_approval': {
        // contacted leads where latest contact has pending approval
        const contacted = stages.contacted?.leads || [];
        return contacted.filter((l: Lead) => l.status === 'contacted');
      }
      case 'sent': {
        // contacted leads that have been approved/sent
        return stages.contacted?.leads?.filter(
          (l: Lead) => l.contactAttempts > 0
        ) || [];
      }
      case 'responded': return stages.responded?.leads || [];
      case 'valuation_booked': return (stages.meeting_scheduled?.leads || []).concat(stages.valuation_booked?.leads || []);
      case 'instructed': return stages.instructed?.leads || [];
      default: return [];
    }
  };

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-lg font-medium">Unable to load sourcing data. Check your connection and try again.</p>
      </Card>
    );
  }

  const hasAnyLeads = pipeline?.total > 0;

  if (!isLoading && !hasAnyLeads) {
    return (
      <Card className="p-8 text-center">
        <Target className="h-12 w-12 text-[#791E75] mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No sourcing leads yet</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Configure a monitoring campaign to start identifying property opportunities. Charlie will scan market sources and queue leads for your review.
        </p>
      </Card>
    );
  }

  return (
    <div>
      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address, owner, postcode..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="land_registry">Land Registry</SelectItem>
            <SelectItem value="stale_listing">Stale Listings</SelectItem>
            <SelectItem value="auction">Auctions</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="competitor">Competitor</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pipeline Columns */}
      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <div key={stage.key} className="flex-shrink-0 w-64">
              <div className="flex items-center gap-2 mb-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-8" />
              </div>
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 w-full mb-2 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ minWidth: `${PIPELINE_STAGES.length * 272}px` }}>
            {PIPELINE_STAGES.map((stage) => {
              const leads = getStageLeads(stage.key);
              return (
                <div key={stage.key} className="flex-shrink-0 w-64">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-sm font-semibold">{stage.label}</h3>
                    <Badge variant="secondary" className="text-xs">{leads.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {leads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        stageKey={stage.key}
                        onApprove={(id) => approveMutation.mutate(id)}
                        onReject={(id) => rejectMutation.mutate(id)}
                        onClick={() => {
                          setSelectedLeadId(lead.id);
                          setDetailOpen(true);
                        }}
                        isApproving={approvingId === lead.id}
                        isRejecting={rejectingId === lead.id}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <LeadDetailPanel
        leadId={selectedLeadId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

// ===== CAMPAIGNS TAB =====
function CampaignsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/crm/sourcing/campaigns'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/crm/sourcing/campaigns');
      return res.json();
    },
  });

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: '',
      sourceType: '',
      targetPostcodes: '',
      priceMin: 0,
      priceMax: 0,
      propertyTypes: [],
      staleThreshold: 90,
      scanFrequency: 'daily',
      active: true,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: CampaignFormValues) => {
      const res = await apiRequest('POST', '/api/crm/sourcing/campaigns', values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Campaign created. Charlie will begin scanning on the next scheduled run.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
      setDialogOpen(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...values }: CampaignFormValues & { id: number }) => {
      const res = await apiRequest('PUT', `/api/crm/sourcing/campaigns/${id}`, values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Campaign updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
      setDialogOpen(false);
      setEditingCampaign(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/crm/sourcing/campaigns/${id}`);
    },
    onSuccess: () => {
      toast({ title: 'Campaign deleted' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
      setDeleteConfirmId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await apiRequest('PUT', `/api/crm/sourcing/campaigns/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
    },
  });

  const openEdit = (campaign: Campaign) => {
    setEditingCampaign(campaign);
    form.reset({
      name: campaign.name,
      sourceType: campaign.sourceType,
      targetPostcodes: campaign.targetPostcodes,
      priceMin: campaign.priceMin,
      priceMax: campaign.priceMax,
      propertyTypes: campaign.propertyTypes || [],
      staleThreshold: campaign.staleThreshold,
      scanFrequency: campaign.scanFrequency,
      active: campaign.active,
    });
    setDialogOpen(true);
  };

  const openCreate = () => {
    setEditingCampaign(null);
    form.reset();
    setDialogOpen(true);
  };

  const onSubmit = (values: CampaignFormValues) => {
    if (editingCampaign) {
      updateMutation.mutate({ ...values, id: editingCampaign.id });
    } else {
      createMutation.mutate(values);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  const PROPERTY_TYPES = ['Flat', 'House', 'Terraced', 'Semi-Detached', 'Detached', 'Bungalow', 'Maisonette', 'Studio'];

  if (!isLoading && campaigns.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Settings2 className="h-12 w-12 text-[#791E75] mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No campaigns configured</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
          Create a monitoring campaign to define which postcodes, price ranges, and property types Charlie should scan for sourcing opportunities.
        </p>
        <Button className="bg-[#791E75] hover:bg-[#791E75]/90 text-white" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Create Campaign
        </Button>
      </Card>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button className="bg-[#791E75] hover:bg-[#791E75]/90 text-white" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" /> Create Campaign
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">{campaign.name}</h3>
                  <Badge variant={campaign.active ? 'default' : 'secondary'} className={campaign.active ? 'bg-green-500' : 'bg-yellow-500'}>
                    {campaign.active ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Source: {SOURCE_LABELS[campaign.sourceType] || campaign.sourceType}</p>
                  <p>Postcodes: {campaign.targetPostcodes}</p>
                  <p>
                    Price: {campaign.priceMin ? `${(campaign.priceMin / 1000).toFixed(0)}k` : '0'} - {campaign.priceMax ? `${(campaign.priceMax / 1000000).toFixed(1)}m` : 'No limit'}
                  </p>
                  <p>Stale threshold: {campaign.staleThreshold} days</p>
                  <p>Scan frequency: {campaign.scanFrequency}</p>
                </div>
                <div className="flex gap-4 mt-3 text-sm">
                  <span>Leads: <strong>{campaign.leadsFound || 0}</strong></span>
                  <span>Sent: <strong>{campaign.contacted || 0}</strong></span>
                  <span>Won: <strong>{campaign.converted || 0}</strong></span>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={() => openEdit(campaign)}>
                    <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <div className="flex items-center gap-2">
                    {campaign.active ? <Pause className="h-3.5 w-3.5 text-muted-foreground" /> : <Play className="h-3.5 w-3.5 text-muted-foreground" />}
                    <Switch
                      checked={campaign.active}
                      onCheckedChange={(checked) => toggleMutation.mutate({ id: campaign.id, active: checked })}
                    />
                  </div>
                  <Button size="sm" variant="outline" className="text-red-500 border-red-500 hover:bg-red-50 ml-auto" onClick={() => setDeleteConfirmId(campaign.id)}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Campaign Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingCampaign(null); form.reset(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCampaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label>Campaign Name</Label>
              <Input {...form.register('name')} placeholder="e.g., Stale Listings W8/W11" />
              {form.formState.errors.name && <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>}
            </div>
            <div>
              <Label>Source Type</Label>
              <Select value={form.watch('sourceType')} onValueChange={(val) => form.setValue('sourceType', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="land_registry">Land Registry</SelectItem>
                  <SelectItem value="stale_listing">Stale Listings</SelectItem>
                  <SelectItem value="auction">Auctions</SelectItem>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="competitor">Competitor</SelectItem>
                </SelectContent>
              </Select>
              {form.formState.errors.sourceType && <p className="text-xs text-red-500 mt-1">{form.formState.errors.sourceType.message}</p>}
            </div>
            <div>
              <Label>Target Postcodes (comma-separated)</Label>
              <Input {...form.register('targetPostcodes')} placeholder="W8, W11, W14" />
              {form.formState.errors.targetPostcodes && <p className="text-xs text-red-500 mt-1">{form.formState.errors.targetPostcodes.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Price Min (GBP)</Label>
                <Input type="number" {...form.register('priceMin', { valueAsNumber: true })} placeholder="0" />
              </div>
              <div>
                <Label>Price Max (GBP)</Label>
                <Input type="number" {...form.register('priceMax', { valueAsNumber: true })} placeholder="0 = no limit" />
              </div>
            </div>
            <div>
              <Label>Property Types</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {PROPERTY_TYPES.map((type) => {
                  const currentTypes = form.watch('propertyTypes') || [];
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <Checkbox
                        checked={currentTypes.includes(type)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            form.setValue('propertyTypes', [...currentTypes, type]);
                          } else {
                            form.setValue('propertyTypes', currentTypes.filter((t) => t !== type));
                          }
                        }}
                      />
                      <span className="text-sm">{type}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Stale Threshold (days)</Label>
              <Input type="number" {...form.register('staleThreshold', { valueAsNumber: true })} placeholder="90" />
            </div>
            <div>
              <Label>Scan Frequency</Label>
              <Select value={form.watch('scanFrequency')} onValueChange={(val) => form.setValue('scanFrequency', val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select frequency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.watch('active')}
                onCheckedChange={(val) => form.setValue('active', val)}
              />
              <Label>Active</Label>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-[#791E75] hover:bg-[#791E75]/90 text-white" disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {editingCampaign ? 'Update Campaign' : 'Create Campaign'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              This will permanently delete the campaign and stop all monitoring. Leads already sourced will remain. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => { if (deleteConfirmId) deleteMutation.mutate(deleteConfirmId); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Delete Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ===== PERFORMANCE TAB =====
function PerformanceTab() {
  const { data: bySource = [], isLoading } = useQuery<MetricsBySource[]>({
    queryKey: ['/api/crm/sourcing/metrics/by-source'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/crm/sourcing/metrics/by-source');
      return res.json();
    },
  });

  // Aggregate for funnel chart
  const funnelData = bySource.length > 0 ? [
    { stage: 'Leads Found', count: bySource.reduce((s, r) => s + r.leadsFound, 0) },
    { stage: 'Outreach Sent', count: bySource.reduce((s, r) => s + r.outreachSent, 0) },
    { stage: 'Responded', count: bySource.reduce((s, r) => s + r.responses, 0) },
    { stage: 'Valuation', count: bySource.reduce((s, r) => s + r.valuations, 0) },
    { stage: 'Instructed', count: bySource.reduce((s, r) => s + r.instructions, 0) },
  ] : [];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-64 w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    );
  }

  if (bySource.length === 0) {
    return (
      <Card className="p-8 text-center">
        <BarChart3 className="h-12 w-12 text-[#791E75] mx-auto mb-4 opacity-50" />
        <h3 className="text-lg font-semibold mb-2">No performance data yet</h3>
        <p className="text-sm text-muted-foreground">Performance metrics will appear once sourcing campaigns generate lead data.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Source Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Source Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Leads Found</TableHead>
                <TableHead className="text-right">Outreach Sent</TableHead>
                <TableHead className="text-right">Responses</TableHead>
                <TableHead>Response Rate</TableHead>
                <TableHead className="text-right">Valuations</TableHead>
                <TableHead className="text-right">Instructions</TableHead>
                <TableHead className="text-right">Conversion</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bySource.map((row) => (
                <TableRow key={row.source}>
                  <TableCell className="font-medium">{SOURCE_LABELS[row.source] || row.source}</TableCell>
                  <TableCell className="text-right">{row.leadsFound}</TableCell>
                  <TableCell className="text-right">{row.outreachSent}</TableCell>
                  <TableCell className="text-right">{row.responses}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={row.responseRate} className="w-16 h-2" />
                      <span className="text-sm">{row.responseRate}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{row.valuations}</TableCell>
                  <TableCell className="text-right">{row.instructions}</TableCell>
                  <TableCell className="text-right">{row.conversionRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Conversion Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Conversion Funnel</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={funnelData}>
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 13 }}
                cursor={{ fill: '#F8B32420' }}
              />
              <Bar dataKey="count" fill="#791E75" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ===== MAIN DASHBOARD =====
export default function SourcingDashboard() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Property Sourcing</h1>
        <p className="text-sm text-muted-foreground">
          Monitor market intelligence, manage outreach pipeline, and track sourcing performance.
        </p>
      </div>

      <StatsRow />

      <Tabs defaultValue="pipeline">
        <TabsList>
          <TabsTrigger value="pipeline">
            <Target className="h-4 w-4 mr-2" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="campaigns">
            <Settings2 className="h-4 w-4 mr-2" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="performance">
            <BarChart3 className="h-4 w-4 mr-2" /> Performance
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipeline" className="mt-4">
          <PipelineTab />
        </TabsContent>
        <TabsContent value="campaigns" className="mt-4">
          <CampaignsTab />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <PerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
