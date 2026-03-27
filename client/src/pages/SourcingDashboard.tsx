import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
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
  FileText, CheckCircle, XCircle, Clock, AlertCircle, Plus, Edit, Trash2,
  Pause, Play, Eye, Target, BarChart3, Settings2, Loader2
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

// ── Types ──────────────────────────────────────────────────────────────────

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

interface StageData {
  count: number;
  leads: Lead[];
}

interface PipelineData {
  stages: Record<string, StageData>;
  total: number;
}

interface Approval {
  contactHistoryId: number;
  leadId: number;
  channel: string;
  subject: string;
  content: string;
  pdfUrl: string | null;
  sequenceStep: number;
  propertyAddress: string;
  postcode: string;
  ownerName: string;
  leadSource: string;
  propensityScore: number;
  daysOnMarket: number;
}

interface LeadDetail {
  lead: Lead;
  contactHistory: Array<{
    id: number;
    channel: string;
    subject: string;
    content: string;
    status: string;
    sentAt: string | null;
    approvalStatus: string;
    sequenceStep: number;
  }>;
  propensityScore: {
    score: number;
    factors: Record<string, number>;
  };
}

interface Campaign {
  id: number;
  name: string;
  sourceType: string;
  targetPostcodes: string;
  priceRangeMin: number;
  priceRangeMax: number;
  propertyTypes: string[];
  staleThreshold: number;
  scanFrequency: string;
  isActive: boolean;
  leadsFound: number;
  contacted: number;
  converted: number;
  createdAt: string;
}

interface MetricsData {
  leadsSourcedThisMonth: number;
  outreachSent: number;
  responseRate: number;
  valuationsBooked: number;
}

interface SourceMetric {
  source: string;
  leadsFound: number;
  outreachSent: number;
  responses: number;
  responseRate: number;
  valuations: number;
  instructions: number;
  conversionRate: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

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

function getSourceBadgeClass(source: string) {
  return SOURCE_BADGE_COLORS[source] || 'border-gray-400 text-gray-400';
}

function getSourceLabel(source: string) {
  return SOURCE_LABELS[source] || source.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Pipeline stage configuration: UI name -> API status mapping
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

// ── Campaign form schema ───────────────────────────────────────────────────

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  sourceType: z.string().min(1, 'Source type is required'),
  targetPostcodes: z.string().min(1, 'At least one postcode is required'),
  priceRangeMin: z.coerce.number().min(0).default(0),
  priceRangeMax: z.coerce.number().min(0).default(0),
  propertyTypes: z.array(z.string()).default([]),
  staleThreshold: z.coerce.number().min(1).default(90),
  scanFrequency: z.string().default('daily'),
  isActive: z.boolean().default(true),
});

type CampaignForm = z.infer<typeof campaignSchema>;

const PROPERTY_TYPE_OPTIONS = [
  'Detached', 'Semi-Detached', 'Terraced', 'Flat', 'Maisonette', 'Bungalow',
];

// ── Stats Row ──────────────────────────────────────────────────────────────

function StatsRow() {
  const { data: metrics, isLoading } = useQuery<MetricsData>({
    queryKey: ['/api/crm/sourcing/metrics'],
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
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

  const stats = [
    { label: 'Leads Sourced (This Month)', value: metrics?.leadsSourcedThisMonth ?? 0, icon: TrendingUp, color: 'bg-[#791E75]' },
    { label: 'Outreach Sent', value: metrics?.outreachSent ?? 0, icon: Send, color: 'bg-[#791E75]/80' },
    { label: 'Response Rate', value: `${metrics?.responseRate ?? 0}%`, icon: MessageCircle, color: 'bg-[#F8B324]' },
    { label: 'Valuations Booked', value: metrics?.valuationsBooked ?? 0, icon: Calendar, color: 'bg-[#F8B324]/80' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold mt-1">{stat.value}</p>
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

// ── Propensity Score Badge ─────────────────────────────────────────────────

function PropensityScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-green-100 text-green-700 border-green-300'
    : score >= 40 ? 'bg-[#F8B324]/20 text-[#F8B324] border-[#F8B324]/40'
    : 'bg-gray-100 text-gray-500 border-gray-300';
  return (
    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${color}`}>
      {score}
    </span>
  );
}

// ── Lead Card (Pipeline) ───────────────────────────────────────────────────

function LeadCard({
  lead,
  showApproval,
  approval,
  onApprove,
  onReject,
  onOpenDetail,
  isApproving,
  isRejecting,
}: {
  lead: Lead;
  showApproval: boolean;
  approval?: Approval;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
  onOpenDetail: (lead: Lead) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const contextLine = lead.daysOnMarket > 0
    ? `Listed: ${lead.daysOnMarket} days${lead.originalAgent ? ` (${lead.originalAgent})` : ''}`
    : lead.auctionHouse
    ? `Auction: ${lead.auctionHouse}`
    : `Added: ${new Date(lead.createdAt).toLocaleDateString('en-GB')}`;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow mb-2"
      onClick={() => onOpenDetail(lead)}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between mb-1">
          <Badge variant="outline" className={`text-[10px] ${getSourceBadgeClass(lead.leadSource)}`}>
            {getSourceLabel(lead.leadSource)}
          </Badge>
          <PropensityScoreBadge score={lead.propensityScore || lead.leadScore || 0} />
        </div>
        <p className="font-medium text-sm mt-1 leading-tight">{lead.propertyAddress}</p>
        <p className="text-xs text-muted-foreground">{lead.postcode}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Owner: {lead.ownerName || 'Unknown'}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{contextLine}</p>
        <div className="flex items-center gap-1 mt-1">
          <Mail className="h-3 w-3 text-gray-400" />
          <FileText className="h-3 w-3 text-gray-400" />
        </div>
        {showApproval && approval && (
          <div className="flex gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
            <Button
              size="sm"
              className="flex-1 min-h-[44px] bg-[#791E75] hover:bg-[#791E75]/90 text-white"
              onClick={() => onApprove(approval.contactHistoryId)}
              disabled={isApproving}
            >
              {isApproving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 min-h-[44px] text-red-500 border-red-200 hover:bg-red-50"
              onClick={() => onReject(approval.contactHistoryId)}
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

// ── Lead Detail Sheet ──────────────────────────────────────────────────────

function LeadDetailSheet({
  lead,
  open,
  onClose,
}: {
  lead: Lead | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editedContent, setEditedContent] = useState('');
  const [editedSubject, setEditedSubject] = useState('');
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const { data: detail, isLoading } = useQuery<LeadDetail>({
    queryKey: ['/api/crm/sourcing/leads', lead?.id],
    queryFn: () => apiRequest(`/api/crm/sourcing/leads/${lead!.id}`),
    enabled: !!lead && open,
  });

  const pendingDraft = detail?.contactHistory?.find(
    (c) => c.approvalStatus === 'pending'
  );

  // Initialize edited content when detail loads
  const currentContent = pendingDraft?.content || '';
  const currentSubject = pendingDraft?.subject || '';

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/sourcing/approvals/${id}/approve`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Outreach approved and queued for sending' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/metrics'] });
      onClose();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/crm/sourcing/approvals/${id}/reject`, 'POST', { reason: rejectReason }),
    onSuccess: () => {
      toast({ title: 'Lead rejected and removed from pipeline' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/metrics'] });
      setRejectDialogOpen(false);
      onClose();
    },
  });

  const editMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/crm/sourcing/approvals/${id}/edit`, 'PUT', {
        content: editedContent || currentContent,
        subject: editedSubject || currentSubject,
      }),
    onSuccess: () => {
      toast({ title: 'Draft updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/leads', lead?.id] });
    },
  });

  return (
    <>
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] overflow-y-auto">
          {isLoading ? (
            <div className="space-y-4 pt-6">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : detail ? (
            <>
              <SheetHeader>
                <SheetTitle className="text-lg">{detail.lead.propertyAddress}</SheetTitle>
                <div className="flex items-center gap-2 mt-1">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{detail.lead.postcode}</span>
                  <Badge variant="outline" className={`text-[10px] ${getSourceBadgeClass(detail.lead.leadSource)}`}>
                    {getSourceLabel(detail.lead.leadSource)}
                  </Badge>
                  <PropensityScoreBadge score={detail.propensityScore?.score || detail.lead.propensityScore || 0} />
                </div>
                <p className="text-sm text-muted-foreground">Owner: {detail.lead.ownerName || 'Unknown'}</p>
              </SheetHeader>

              <Separator className="my-4" />

              {/* Property Intel */}
              <div className="mb-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Home className="h-4 w-4" /> Property Intel
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Days on Market:</span>
                    <span className="ml-1 font-medium">{detail.lead.daysOnMarket || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Original Agent:</span>
                    <span className="ml-1 font-medium">{detail.lead.originalAgent || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Contact Attempts:</span>
                    <span className="ml-1 font-medium">{detail.lead.contactAttempts}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <span className="ml-1 font-medium capitalize">{detail.lead.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              </div>

              <Separator className="my-4" />

              {/* Outreach Draft */}
              {pendingDraft && (
                <>
                  <div className="mb-4">
                    <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                      <Mail className="h-4 w-4" /> Outreach Draft
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Channel</Label>
                        <div className="flex items-center gap-1 text-sm">
                          {pendingDraft.channel === 'email' ? <Mail className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                          <span className="capitalize">{pendingDraft.channel}</span>
                        </div>
                      </div>
                      {pendingDraft.subject && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Subject</Label>
                          <Input
                            defaultValue={pendingDraft.subject}
                            onChange={(e) => setEditedSubject(e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs text-muted-foreground">Content</Label>
                        <Textarea
                          defaultValue={pendingDraft.content}
                          onChange={(e) => setEditedContent(e.target.value)}
                          rows={8}
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>
                  <Separator className="my-4" />
                </>
              )}

              {/* Follow-Up Timeline */}
              <div className="mb-4">
                <h4 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" /> Follow-Up Timeline
                </h4>
                <div className="space-y-2">
                  {detail.contactHistory.length > 0 ? detail.contactHistory.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 text-sm">
                      <div className="mt-0.5">
                        {entry.status === 'sent' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : entry.approvalStatus === 'pending' ? (
                          <Clock className="h-4 w-4 text-[#F8B324]" />
                        ) : entry.approvalStatus === 'rejected' ? (
                          <XCircle className="h-4 w-4 text-red-500" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium capitalize">
                          Step {entry.sequenceStep}: {entry.channel}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {entry.sentAt
                            ? `Sent: ${new Date(entry.sentAt).toLocaleDateString('en-GB')}`
                            : `Status: ${entry.approvalStatus}`}
                        </p>
                      </div>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">No contact history yet</p>
                  )}
                </div>
              </div>

              <Separator className="my-4" />

              {/* Action Buttons */}
              <div className="flex flex-col gap-2">
                {pendingDraft && (
                  <>
                    <Button
                      className="min-h-[44px] bg-[#791E75] hover:bg-[#791E75]/90 text-white"
                      onClick={() => approveMutation.mutate(pendingDraft.id)}
                      disabled={approveMutation.isPending}
                    >
                      {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Approve Outreach
                    </Button>
                    <Button
                      variant="outline"
                      className="min-h-[44px]"
                      onClick={() => editMutation.mutate(pendingDraft.id)}
                      disabled={editMutation.isPending}
                    >
                      {editMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Edit className="h-4 w-4 mr-2" />}
                      Edit Draft
                    </Button>
                  </>
                )}
                <Button
                  variant="outline"
                  className="min-h-[44px] text-red-500 border-red-200 hover:bg-red-50"
                  onClick={() => setRejectDialogOpen(true)}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                  Reject Lead
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
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
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => {
                const draftId = detail?.contactHistory?.find(c => c.approvalStatus === 'pending')?.id || lead?.id;
                if (draftId) rejectMutation.mutate(draftId);
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

// ── Pipeline Tab ───────────────────────────────────────────────────────────

function PipelineTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const { data: pipeline, isLoading, isError } = useQuery<PipelineData>({
    queryKey: ['/api/crm/sourcing/leads', searchQuery, sourceFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);
      const qs = params.toString();
      return apiRequest(`/api/crm/sourcing/leads${qs ? `?${qs}` : ''}`);
    },
  });

  const { data: approvals = [] } = useQuery<Approval[]>({
    queryKey: ['/api/crm/sourcing/approvals'],
  });

  const approveMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/sourcing/approvals/${id}/approve`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Outreach approved and queued for sending' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/metrics'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/sourcing/approvals/${id}/reject`, 'POST'),
    onSuccess: () => {
      toast({ title: 'Lead rejected and removed from pipeline' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/leads'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/metrics'] });
    },
  });

  const approvalMap = new Map(approvals.map((a) => [a.leadId, a]));

  const getLeadsForStage = (stageKey: string): Lead[] => {
    if (!pipeline?.stages) return [];

    switch (stageKey) {
      case 'new':
        return pipeline.stages.new?.leads || [];
      case 'researching':
        return pipeline.stages.researching?.leads || [];
      case 'ready_to_contact':
        return pipeline.stages.ready_to_contact?.leads || [];
      case 'awaiting_approval': {
        const contacted = pipeline.stages.contacted?.leads || [];
        return contacted.filter((l) => approvalMap.has(l.id));
      }
      case 'sent': {
        const contacted = pipeline.stages.contacted?.leads || [];
        return contacted.filter((l) => !approvalMap.has(l.id));
      }
      case 'responded':
        return pipeline.stages.responded?.leads || [];
      case 'valuation_booked':
        return (pipeline.stages.meeting_scheduled?.leads || []).concat(
          pipeline.stages.valuation_booked?.leads || []
        );
      case 'instructed':
        return pipeline.stages.instructed?.leads || [];
      default:
        return [];
    }
  };

  if (isError) {
    return (
      <Card className="p-8 text-center">
        <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
        <p className="text-lg font-medium">Unable to load sourcing data</p>
        <p className="text-sm text-muted-foreground mt-1">Check your connection and try again.</p>
      </Card>
    );
  }

  const isEmpty = !isLoading && (!pipeline || pipeline.total === 0);

  return (
    <div>
      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by address, owner, or postcode..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]">
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

      {isEmpty ? (
        <Card className="p-8 text-center">
          <Target className="h-12 w-12 text-[#791E75]/40 mx-auto mb-4" />
          <p className="text-lg font-medium">No sourcing leads yet</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Configure a monitoring campaign to start identifying property opportunities. Charlie will scan market sources and queue leads for your review.
          </p>
        </Card>
      ) : (
        <ScrollArea className="w-full">
          <div className="flex gap-4 pb-4" style={{ minWidth: PIPELINE_STAGES.length * 220 }}>
            {isLoading ? (
              [...Array(8)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[220px]">
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-5 w-8 rounded-full" />
                  </div>
                  {[...Array(3)].map((__, j) => (
                    <Card key={j} className="mb-2">
                      <CardContent className="p-3">
                        <Skeleton className="h-4 w-20 mb-2" />
                        <Skeleton className="h-4 w-full mb-1" />
                        <Skeleton className="h-3 w-3/4" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ))
            ) : (
              PIPELINE_STAGES.map((stage) => {
                const leads = getLeadsForStage(stage.key);
                const isApprovalStage = stage.key === 'awaiting_approval';

                return (
                  <div key={stage.key} className="flex-shrink-0 w-[220px]">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                      <Badge variant="secondary" className="text-xs">
                        {leads.length}
                      </Badge>
                    </div>
                    <div className="space-y-0">
                      {leads.map((lead) => (
                        <LeadCard
                          key={lead.id}
                          lead={lead}
                          showApproval={isApprovalStage}
                          approval={approvalMap.get(lead.id)}
                          onApprove={(id) => approveMutation.mutate(id)}
                          onReject={(id) => rejectMutation.mutate(id)}
                          onOpenDetail={(l) => {
                            setSelectedLead(l);
                            setDetailOpen(true);
                          }}
                          isApproving={approveMutation.isPending}
                          isRejecting={rejectMutation.isPending}
                        />
                      ))}
                      {leads.length === 0 && (
                        <div className="py-4 text-center text-xs text-muted-foreground">
                          No leads
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      )}

      <LeadDetailSheet
        lead={selectedLead}
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setSelectedLead(null);
        }}
      />
    </div>
  );
}

// ── Campaign Dialog ────────────────────────────────────────────────────────

function CampaignDialog({
  open,
  onClose,
  campaign,
}: {
  open: boolean;
  onClose: () => void;
  campaign?: Campaign | null;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: campaign
      ? {
          name: campaign.name,
          sourceType: campaign.sourceType,
          targetPostcodes: campaign.targetPostcodes,
          priceRangeMin: campaign.priceRangeMin,
          priceRangeMax: campaign.priceRangeMax,
          propertyTypes: campaign.propertyTypes || [],
          staleThreshold: campaign.staleThreshold,
          scanFrequency: campaign.scanFrequency,
          isActive: campaign.isActive,
        }
      : {
          name: '',
          sourceType: '',
          targetPostcodes: '',
          priceRangeMin: 0,
          priceRangeMax: 0,
          propertyTypes: [],
          staleThreshold: 90,
          scanFrequency: 'daily',
          isActive: true,
        },
  });

  const createMutation = useMutation({
    mutationFn: (data: CampaignForm) => apiRequest('/api/crm/sourcing/campaigns', 'POST', data),
    onSuccess: () => {
      toast({ title: 'Campaign created. Charlie will begin scanning on the next scheduled run.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
      onClose();
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: CampaignForm) =>
      apiRequest(`/api/crm/sourcing/campaigns/${campaign!.id}`, 'PUT', data),
    onSuccess: () => {
      toast({ title: 'Campaign updated successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
      onClose();
    },
  });

  const onSubmit = (data: CampaignForm) => {
    if (campaign) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const selectedTypes = form.watch('propertyTypes');

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{campaign ? 'Edit Campaign' : 'Create Campaign'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Campaign Name</Label>
            <Input {...form.register('name')} placeholder="e.g. Stale Listings - W8, W11" />
            {form.formState.errors.name && (
              <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div>
            <Label>Source Type</Label>
            <Select
              value={form.watch('sourceType')}
              onValueChange={(v) => form.setValue('sourceType', v)}
            >
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
            {form.formState.errors.sourceType && (
              <p className="text-xs text-red-500 mt-1">{form.formState.errors.sourceType.message}</p>
            )}
          </div>

          <div>
            <Label>Target Postcodes (comma-separated)</Label>
            <Input {...form.register('targetPostcodes')} placeholder="W8, W11, W14" />
            {form.formState.errors.targetPostcodes && (
              <p className="text-xs text-red-500 mt-1">{form.formState.errors.targetPostcodes.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price Range Min (GBP)</Label>
              <Input type="number" {...form.register('priceRangeMin')} placeholder="0" />
            </div>
            <div>
              <Label>Price Range Max (GBP)</Label>
              <Input type="number" {...form.register('priceRangeMax')} placeholder="No limit" />
            </div>
          </div>

          <div>
            <Label>Property Types</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {PROPERTY_TYPE_OPTIONS.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedTypes.includes(type)}
                    onCheckedChange={(checked) => {
                      const current = form.getValues('propertyTypes');
                      form.setValue(
                        'propertyTypes',
                        checked ? [...current, type] : current.filter((t) => t !== type)
                      );
                    }}
                  />
                  <span className="text-sm">{type}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Stale Threshold (days)</Label>
            <Input type="number" {...form.register('staleThreshold')} />
          </div>

          <div>
            <Label>Scan Frequency</Label>
            <Select
              value={form.watch('scanFrequency')}
              onValueChange={(v) => form.setValue('scanFrequency', v)}
            >
              <SelectTrigger>
                <SelectValue />
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
              checked={form.watch('isActive')}
              onCheckedChange={(v) => form.setValue('isActive', v)}
            />
            <Label>Active</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-[#791E75] hover:bg-[#791E75]/90 text-white"
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {campaign ? 'Update Campaign' : 'Create Campaign'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Campaigns Tab ──────────────────────────────────────────────────────────

function CampaignsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingCampaign, setDeletingCampaign] = useState<Campaign | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ['/api/crm/sourcing/campaigns'],
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/crm/sourcing/campaigns/${id}`, 'DELETE'),
    onSuccess: () => {
      toast({ title: 'Campaign deleted successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
      setDeleteDialogOpen(false);
      setDeletingCampaign(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      apiRequest(`/api/crm/sourcing/campaigns/${id}`, 'PUT', { isActive }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sourcing/campaigns'] });
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-5 w-3/4 mb-3" />
              <Skeleton className="h-4 w-1/2 mb-2" />
              <Skeleton className="h-4 w-2/3 mb-2" />
              <Skeleton className="h-4 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div>
        <div className="flex justify-end mb-4">
          <Button
            className="bg-[#791E75] hover:bg-[#791E75]/90 text-white"
            onClick={() => { setEditingCampaign(null); setDialogOpen(true); }}
          >
            <Plus className="h-4 w-4 mr-2" /> Create Campaign
          </Button>
        </div>
        <Card className="p-8 text-center">
          <Settings2 className="h-12 w-12 text-[#791E75]/40 mx-auto mb-4" />
          <p className="text-lg font-medium">No campaigns configured</p>
          <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
            Create a monitoring campaign to define which postcodes, price ranges, and property types Charlie should scan for sourcing opportunities.
          </p>
          <Button
            className="mt-4 bg-[#791E75] hover:bg-[#791E75]/90 text-white"
            onClick={() => { setEditingCampaign(null); setDialogOpen(true); }}
          >
            Create Campaign
          </Button>
        </Card>
        <CampaignDialog
          open={dialogOpen}
          onClose={() => { setDialogOpen(false); setEditingCampaign(null); }}
          campaign={editingCampaign}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          className="bg-[#791E75] hover:bg-[#791E75]/90 text-white"
          onClick={() => { setEditingCampaign(null); setDialogOpen(true); }}
        >
          <Plus className="h-4 w-4 mr-2" /> Create Campaign
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{campaign.name}</h3>
                  <Badge
                    variant={campaign.isActive ? 'default' : 'secondary'}
                    className={campaign.isActive ? 'bg-green-500 text-white mt-1' : 'bg-yellow-100 text-yellow-700 mt-1'}
                  >
                    {campaign.isActive ? 'Active' : 'Paused'}
                  </Badge>
                </div>
                <Badge variant="outline" className={getSourceBadgeClass(campaign.sourceType)}>
                  {getSourceLabel(campaign.sourceType)}
                </Badge>
              </div>
              <div className="space-y-1 text-sm text-muted-foreground mt-3">
                <p><MapPin className="h-3.5 w-3.5 inline mr-1" />Postcodes: {campaign.targetPostcodes}</p>
                <p>Price: {campaign.priceRangeMin > 0 ? `${(campaign.priceRangeMin / 1000).toFixed(0)}k` : '0'} - {campaign.priceRangeMax > 0 ? `${(campaign.priceRangeMax / 1000000).toFixed(1)}m` : 'No limit'}</p>
                <p>Stale threshold: {campaign.staleThreshold} days</p>
                <p>Scan frequency: {campaign.scanFrequency}</p>
              </div>
              <Separator className="my-3" />
              <div className="flex gap-4 text-sm">
                <span>Leads: <strong>{campaign.leadsFound}</strong></span>
                <span>Sent: <strong>{campaign.contacted}</strong></span>
                <span>Won: <strong>{campaign.converted}</strong></span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setEditingCampaign(campaign); setDialogOpen(true); }}
                >
                  <Edit className="h-3.5 w-3.5 mr-1" /> Edit
                </Button>
                <div className="flex items-center gap-1.5">
                  {campaign.isActive ? <Pause className="h-3.5 w-3.5 text-muted-foreground" /> : <Play className="h-3.5 w-3.5 text-muted-foreground" />}
                  <Switch
                    checked={campaign.isActive}
                    onCheckedChange={(checked) =>
                      toggleMutation.mutate({ id: campaign.id, isActive: checked })
                    }
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-500 border-red-200 hover:bg-red-50 ml-auto"
                  onClick={() => {
                    setDeletingCampaign(campaign);
                    setDeleteDialogOpen(true);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <CampaignDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditingCampaign(null); }}
        campaign={editingCampaign}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Campaign</DialogTitle>
            <DialogDescription>
              This will permanently delete the campaign and stop all monitoring. Leads already sourced will remain. Are you sure?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingCampaign && deleteMutation.mutate(deletingCampaign.id)}
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

// ── Performance Tab ────────────────────────────────────────────────────────

function PerformanceTab() {
  const { data: sourceMetrics = [], isLoading } = useQuery<SourceMetric[]>({
    queryKey: ['/api/crm/sourcing/metrics/by-source'],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build funnel data from aggregated metrics
  const totals = sourceMetrics.reduce(
    (acc, m) => ({
      leadsFound: acc.leadsFound + m.leadsFound,
      outreachSent: acc.outreachSent + m.outreachSent,
      responses: acc.responses + m.responses,
      valuations: acc.valuations + m.valuations,
      instructions: acc.instructions + m.instructions,
    }),
    { leadsFound: 0, outreachSent: 0, responses: 0, valuations: 0, instructions: 0 }
  );

  const funnelData = [
    { stage: 'Leads Found', value: totals.leadsFound },
    { stage: 'Outreach Sent', value: totals.outreachSent },
    { stage: 'Responded', value: totals.responses },
    { stage: 'Valuation', value: totals.valuations },
    { stage: 'Instructed', value: totals.instructions },
  ];

  return (
    <div className="space-y-6">
      {/* Source Breakdown Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Source Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sourceMetrics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No performance data available yet. Data will appear once sourcing campaigns are active.
            </p>
          ) : (
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
                {sourceMetrics.map((row) => (
                  <TableRow key={row.source}>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${getSourceBadgeClass(row.source)}`}>
                        {getSourceLabel(row.source)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.leadsFound}</TableCell>
                    <TableCell className="text-right">{row.outreachSent}</TableCell>
                    <TableCell className="text-right">{row.responses}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={row.responseRate} className="h-2 w-16" />
                        <span className="text-xs text-muted-foreground">{row.responseRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{row.valuations}</TableCell>
                    <TableCell className="text-right">{row.instructions}</TableCell>
                    <TableCell className="text-right font-medium">{row.conversionRate}%</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Conversion Funnel Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Target className="h-5 w-5" /> Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          {totals.leadsFound === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No funnel data available yet.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={funnelData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {funnelData.map((_, index) => (
                    <Cell key={index} fill="#791E75" />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────

export default function SourcingDashboard() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Property Sourcing</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage sourcing pipeline, monitor campaigns, and track outreach performance
        </p>
      </div>

      <StatsRow />

      <Tabs defaultValue="pipeline" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="pipeline" className="gap-1.5">
            <Target className="h-4 w-4" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5">
            <Settings2 className="h-4 w-4" /> Campaigns
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5">
            <BarChart3 className="h-4 w-4" /> Performance
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pipeline">
          <PipelineTab />
        </TabsContent>

        <TabsContent value="campaigns">
          <CampaignsTab />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
