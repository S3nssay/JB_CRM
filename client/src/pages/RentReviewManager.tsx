import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient as globalQueryClient } from '@/lib/queryClient';
import {
  Plus, Loader2, PoundSterling, Send, CheckCircle, Calendar, FileText,
  AlertCircle, RefreshCw,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface RentReview {
  id: number;
  tenancyId: number;
  propertyId: number;
  currentRent: number;
  proposedRent: number;
  reviewDate: string;
  noticePeriodDays: number;
  status: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(pence: number): string {
  return `\u00A3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const statusBadgeConfig: Record<string, { label: string; variant: string; className: string }> = {
  scheduled:     { label: 'Scheduled',     variant: 'outline', className: 'bg-blue-100 text-blue-800 border-blue-300' },
  notice_sent:   { label: 'Notice Sent',   variant: 'outline', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  accepted:      { label: 'Accepted',      variant: 'outline', className: 'bg-green-100 text-green-800 border-green-300' },
  rejected:      { label: 'Rejected',      variant: 'outline', className: 'bg-red-100 text-red-800 border-red-300' },
  implemented:   { label: 'Implemented',   variant: 'outline', className: 'bg-green-100 text-green-800 border-green-300' },
  cancelled:     { label: 'Cancelled',     variant: 'outline', className: 'bg-gray-100 text-gray-800 border-gray-300' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusBadgeConfig[status] || { label: status, variant: 'outline', className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function RentReviewManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    tenancyId: '',
    propertyId: '',
    currentRent: '',
    proposedRent: '',
    reviewDate: '',
    noticePeriodDays: '',
    notes: '',
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: reviews = [], isLoading, isError } = useQuery<RentReview[]>({
    queryKey: ['/api/crm/rent-reviews'],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createReviewMutation = useMutation({
    mutationFn: async (data: {
      tenancyId: number;
      propertyId: number;
      currentRent: number;
      proposedRent: number;
      reviewDate: string;
      noticePeriodDays: number;
      notes?: string;
    }) => {
      return apiRequest('/api/crm/rent-reviews', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/rent-reviews'] });
      toast({ title: 'Rent review created', description: 'The rent review has been scheduled.' });
      setShowCreateDialog(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const serveNoticeMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/rent-reviews/${id}/serve-notice`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/rent-reviews'] });
      toast({ title: 'Notice served', description: 'The rent review notice has been sent.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const implementMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/rent-reviews/${id}/implement`, 'POST', {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/rent-reviews'] });
      toast({ title: 'Rent review implemented', description: 'The new rent has been applied.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function resetForm() {
    setFormData({
      tenancyId: '',
      propertyId: '',
      currentRent: '',
      proposedRent: '',
      reviewDate: '',
      noticePeriodDays: '',
      notes: '',
    });
  }

  function handleCreateSubmit() {
    const tenancyId = parseInt(formData.tenancyId, 10);
    const propertyId = parseInt(formData.propertyId, 10);
    const currentRent = Math.round(parseFloat(formData.currentRent) * 100);
    const proposedRent = Math.round(parseFloat(formData.proposedRent) * 100);
    const noticePeriodDays = parseInt(formData.noticePeriodDays, 10);

    if (isNaN(tenancyId) || isNaN(propertyId) || isNaN(currentRent) || isNaN(proposedRent) || !formData.reviewDate || isNaN(noticePeriodDays)) {
      toast({ title: 'Validation error', description: 'Please fill in all required fields with valid values.', variant: 'destructive' });
      return;
    }

    createReviewMutation.mutate({
      tenancyId,
      propertyId,
      currentRent,
      proposedRent,
      reviewDate: formData.reviewDate,
      noticePeriodDays,
      notes: formData.notes || undefined,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Rent Reviews</h1>
          <p className="text-muted-foreground">Manage scheduled rent reviews and notices</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Review
        </Button>
      </div>

      {/* Reviews Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PoundSterling className="h-5 w-5" />
            Rent Reviews
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
              Failed to load rent reviews
            </div>
          ) : reviews.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No rent reviews</p>
              <p className="text-sm">Create a rent review to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property ID</TableHead>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Current Rent</TableHead>
                  <TableHead>Proposed Rent</TableHead>
                  <TableHead>Review Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reviews.map((review) => (
                  <TableRow key={review.id}>
                    <TableCell className="font-medium">{review.propertyId}</TableCell>
                    <TableCell>{review.tenancyId}</TableCell>
                    <TableCell>{formatCurrency(review.currentRent)}</TableCell>
                    <TableCell>{formatCurrency(review.proposedRent)}</TableCell>
                    <TableCell>{new Date(review.reviewDate).toLocaleDateString('en-GB')}</TableCell>
                    <TableCell>
                      <StatusBadge status={review.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {review.status === 'scheduled' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => serveNoticeMutation.mutate(review.id)}
                            disabled={serveNoticeMutation.isPending}
                          >
                            {serveNoticeMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <Send className="h-3 w-3 mr-1" />
                            )}
                            Serve Notice
                          </Button>
                        )}
                        {(review.status === 'accepted' || review.status === 'notice_sent') && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => implementMutation.mutate(review.id)}
                            disabled={implementMutation.isPending}
                          >
                            {implementMutation.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : (
                              <CheckCircle className="h-3 w-3 mr-1" />
                            )}
                            Implement
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Review Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Rent Review</DialogTitle>
            <DialogDescription>
              Schedule a new rent review for a tenancy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tenancyId">Tenancy ID</Label>
                <Input
                  id="tenancyId"
                  type="number"
                  placeholder="e.g. 12"
                  value={formData.tenancyId}
                  onChange={(e) => setFormData({ ...formData, tenancyId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="propertyId">Property ID</Label>
                <Input
                  id="propertyId"
                  type="number"
                  placeholder="e.g. 45"
                  value={formData.propertyId}
                  onChange={(e) => setFormData({ ...formData, propertyId: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="currentRent">Current Rent (pounds)</Label>
                <Input
                  id="currentRent"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1500.00"
                  value={formData.currentRent}
                  onChange={(e) => setFormData({ ...formData, currentRent: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposedRent">Proposed Rent (pounds)</Label>
                <Input
                  id="proposedRent"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 1600.00"
                  value={formData.proposedRent}
                  onChange={(e) => setFormData({ ...formData, proposedRent: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reviewDate">Review Date</Label>
                <Input
                  id="reviewDate"
                  type="date"
                  value={formData.reviewDate}
                  onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="noticePeriodDays">Notice Period (days)</Label>
                <Input
                  id="noticePeriodDays"
                  type="number"
                  placeholder="e.g. 30"
                  value={formData.noticePeriodDays}
                  onChange={(e) => setFormData({ ...formData, noticePeriodDays: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes about this rent review..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSubmit} disabled={createReviewMutation.isPending}>
              {createReviewMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
