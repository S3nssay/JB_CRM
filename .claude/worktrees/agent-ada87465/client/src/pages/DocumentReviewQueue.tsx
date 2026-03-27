import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CheckCircle, XCircle, AlertCircle, Filter, FileText, Eye, RefreshCw, Shield } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmailAttachment {
  id: number;
  processedEmailId: number;
  originalFilename: string;
  contentType: string;
  fileSize: number;
  storageUrl: string | null;
  documentId: number | null;
  aiDocumentType: string;
  aiEntityType: string;
  aiEntityId: number | null;
  aiConfidence: number;
  reviewStatus: string;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  emailSubject?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const reviewStatusBadgeConfig: Record<string, { label: string; className: string }> = {
  pending:        { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  confirmed:      { label: 'Confirmed',      className: 'bg-green-100 text-green-800 border-green-300' },
  rejected:       { label: 'Rejected',        className: 'bg-red-100 text-red-800 border-red-300' },
  auto_confirmed: { label: 'Auto-Confirmed',  className: 'bg-blue-100 text-blue-800 border-blue-300' },
};

const documentTypeLabels: Record<string, string> = {
  passport:           'Passport',
  driving_licence:    'Driving Licence',
  proof_of_address:   'Proof of Address',
  bank_statement:     'Bank Statement',
  gas_safety:         'Gas Safety',
  epc:                'EPC',
  eicr:               'EICR',
  insurance:          'Insurance',
  tenancy_agreement:  'Tenancy Agreement',
  inventory:          'Inventory',
  invoice:            'Invoice',
  photo:              'Photo',
  other:              'Other',
};

const entityTypeLabels: Record<string, string> = {
  landlord:   'Landlord',
  tenant:     'Tenant',
  property:   'Property',
  contractor: 'Contractor',
};

function ReviewStatusBadge({ status }: { status: string }) {
  const cfg = reviewStatusBadgeConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  let className = '';
  if (pct < 60) {
    className = 'bg-red-100 text-red-800 border-red-300';
  } else if (pct < 80) {
    className = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  } else {
    className = 'bg-green-100 text-green-800 border-green-300';
  }
  return <Badge className={`${className} border`}>{pct}%</Badge>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function DocumentReviewQueue() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [documentTypeFilter, setDocumentTypeFilter] = useState<string>('all');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('all');

  // Re-classify dialog
  const [reclassifyDialogOpen, setReclassifyDialogOpen] = useState(false);
  const [reclassifyTarget, setReclassifyTarget] = useState<EmailAttachment | null>(null);
  const [reclassifyDocType, setReclassifyDocType] = useState<string>('');
  const [reclassifyEntityType, setReclassifyEntityType] = useState<string>('');
  const [reclassifyEntityId, setReclassifyEntityId] = useState<string>('');

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: attachments = [], isLoading, isError } = useQuery<EmailAttachment[]>({
    queryKey: ['/api/crm/email-attachments', { reviewStatus: statusFilter }],
    queryFn: async () => {
      const params = statusFilter !== 'all' ? `?reviewStatus=${statusFilter}` : '';
      const res = await fetch(`/api/crm/email-attachments${params}`);
      if (!res.ok) throw new Error('Failed to fetch email attachments');
      return res.json();
    },
  });

  // ── Filtered attachments ─────────────────────────────────────────────────

  const filteredAttachments = attachments.filter((att) => {
    if (documentTypeFilter !== 'all' && att.aiDocumentType !== documentTypeFilter) return false;
    if (entityTypeFilter !== 'all' && att.aiEntityType !== entityTypeFilter) return false;
    return true;
  });

  // ── Summary counts ───────────────────────────────────────────────────────

  const pendingCount = attachments.filter(a => a.reviewStatus === 'pending').length;
  const confirmedTodayCount = attachments.filter(a => {
    if (a.reviewStatus !== 'confirmed' || !a.reviewedAt) return false;
    const today = new Date().toISOString().split('T')[0];
    return a.reviewedAt.startsWith(today);
  }).length;
  const rejectedCount = attachments.filter(a => a.reviewStatus === 'rejected').length;
  const autoConfirmedCount = attachments.filter(a => a.reviewStatus === 'auto_confirmed').length;

  // ── Mutations ────────────────────────────────────────────────────────────

  const confirmMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('/api/crm/email-attachments/' + id + '/review', 'PATCH', { status: 'confirmed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/email-attachments'] });
      toast({ title: 'Confirmed', description: 'Attachment classification has been confirmed.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('/api/crm/email-attachments/' + id + '/review', 'PATCH', { status: 'rejected' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/email-attachments'] });
      toast({ title: 'Rejected', description: 'Attachment has been rejected.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const reclassifyMutation = useMutation({
    mutationFn: async ({ id, documentType, entityType, entityId }: { id: number; documentType: string; entityType: string; entityId?: number }) => {
      return apiRequest('/api/crm/email-attachments/' + id + '/review', 'PATCH', {
        status: 'confirmed',
        documentType,
        entityType,
        entityId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/email-attachments'] });
      toast({ title: 'Re-classified', description: 'Attachment has been re-classified and confirmed.' });
      setReclassifyDialogOpen(false);
      setReclassifyTarget(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openReclassifyDialog(attachment: EmailAttachment) {
    setReclassifyTarget(attachment);
    setReclassifyDocType(attachment.aiDocumentType || '');
    setReclassifyEntityType(attachment.aiEntityType || '');
    setReclassifyEntityId(attachment.aiEntityId ? String(attachment.aiEntityId) : '');
    setReclassifyDialogOpen(true);
  }

  function handleReclassifySubmit() {
    if (!reclassifyTarget) return;
    if (!reclassifyDocType || !reclassifyEntityType) {
      toast({ title: 'Validation error', description: 'Please select both document type and entity type.', variant: 'destructive' });
      return;
    }
    reclassifyMutation.mutate({
      id: reclassifyTarget.id,
      documentType: reclassifyDocType,
      entityType: reclassifyEntityType,
      entityId: reclassifyEntityId ? parseInt(reclassifyEntityId, 10) : undefined,
    });
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Document Review Queue</h1>
          <p className="text-muted-foreground">Review AI-classified email attachments that need human verification</p>
        </div>
        <Button
          variant="outline"
          onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/crm/email-attachments'] })}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-100">
                <AlertCircle className="h-5 w-5 text-yellow-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pending Review</p>
                <p className="text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Confirmed Today</p>
                <p className="text-2xl font-bold">{confirmedTodayCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <XCircle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold">{rejectedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Shield className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Auto-Confirmed</p>
                <p className="text-2xl font-bold">{autoConfirmedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filters:</span>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Review Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="auto_confirmed">Auto-Confirmed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={documentTypeFilter} onValueChange={setDocumentTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Document Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Document Types</SelectItem>
                {Object.entries(documentTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Entity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entity Types</SelectItem>
                {Object.entries(entityTypeLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Attachments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Email Attachments
            {filteredAttachments.length !== attachments.length && (
              <span className="text-sm font-normal text-muted-foreground">
                (showing {filteredAttachments.length} of {attachments.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : isError ? (
            <div className="flex items-center justify-center py-12 text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              Failed to load email attachments
            </div>
          ) : filteredAttachments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">
                {attachments.length === 0 ? 'No attachments to review' : 'No attachments match your filters'}
              </p>
              <p className="text-sm">
                {attachments.length === 0
                  ? 'All email attachments have been processed.'
                  : 'Try adjusting your filter criteria.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Document Type (AI)</TableHead>
                  <TableHead>Entity Type (AI)</TableHead>
                  <TableHead>Confidence %</TableHead>
                  <TableHead>Source Email Subject</TableHead>
                  <TableHead>Uploaded At</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAttachments.map((att) => (
                  <TableRow key={att.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="truncate" title={att.originalFilename}>{att.originalFilename}</span>
                        <span className="text-xs text-muted-foreground shrink-0">({formatFileSize(att.fileSize)})</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {documentTypeLabels[att.aiDocumentType] || att.aiDocumentType?.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {entityTypeLabels[att.aiEntityType] || att.aiEntityType?.replace(/_/g, ' ')}
                      </Badge>
                      {att.aiEntityId && (
                        <span className="text-xs text-muted-foreground ml-1">#{att.aiEntityId}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge confidence={att.aiConfidence} />
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      <span className="truncate" title={att.emailSubject || ''}>
                        {att.emailSubject || <span className="text-muted-foreground">-</span>}
                      </span>
                    </TableCell>
                    <TableCell>
                      {att.createdAt ? new Date(att.createdAt).toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : '-'}
                    </TableCell>
                    <TableCell>
                      <ReviewStatusBadge status={att.reviewStatus} />
                    </TableCell>
                    <TableCell>
                      {att.reviewStatus === 'pending' && (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => confirmMutation.mutate(att.id)}
                            disabled={confirmMutation.isPending}
                          >
                            {confirmMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-700 border-red-300 hover:bg-red-50"
                            onClick={() => rejectMutation.mutate(att.id)}
                            disabled={rejectMutation.isPending}
                          >
                            {rejectMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <XCircle className="h-3 w-3 mr-1" />
                            )}
                            Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openReclassifyDialog(att)}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Re-classify
                          </Button>
                        </div>
                      )}
                      {att.reviewStatus !== 'pending' && att.storageUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(att.storageUrl!, '_blank')}
                        >
                          <Eye className="h-3 w-3 mr-1" />
                          View
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Re-classify Dialog */}
      <Dialog open={reclassifyDialogOpen} onOpenChange={setReclassifyDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Re-classify Attachment</DialogTitle>
          </DialogHeader>
          {reclassifyTarget && (
            <div className="grid gap-4 py-4">
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="text-sm font-medium">{reclassifyTarget.originalFilename}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  AI suggested: {documentTypeLabels[reclassifyTarget.aiDocumentType] || reclassifyTarget.aiDocumentType} for {entityTypeLabels[reclassifyTarget.aiEntityType] || reclassifyTarget.aiEntityType}
                  {reclassifyTarget.aiEntityId && ` #${reclassifyTarget.aiEntityId}`}
                  {' '}at {Math.round(reclassifyTarget.aiConfidence * 100)}% confidence
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Document Type</label>
                <Select value={reclassifyDocType} onValueChange={setReclassifyDocType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select document type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(documentTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Entity Type</label>
                <Select value={reclassifyEntityType} onValueChange={setReclassifyEntityType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select entity type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(entityTypeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Entity ID <span className="text-muted-foreground font-normal">(optional)</span></label>
                <input
                  type="number"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="e.g. 42"
                  value={reclassifyEntityId}
                  onChange={(e) => setReclassifyEntityId(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReclassifyDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleReclassifySubmit}
              disabled={reclassifyMutation.isPending}
              style={{ backgroundColor: '#791E75' }}
              className="text-white hover:opacity-90"
            >
              {reclassifyMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm Re-classification
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
