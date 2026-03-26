import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2, ChevronDown, ChevronUp, Check, X, ArrowRightLeft,
  Phone, Mail, Calendar, AlertCircle, Briefcase, Clock
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

const formatGBP = (pence: number) =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  under_review: 'bg-blue-100 text-blue-800 border-blue-300',
  accepted: 'bg-green-100 text-green-800 border-green-300',
  rejected: 'bg-red-100 text-red-800 border-red-300',
  withdrawn: 'bg-gray-100 text-gray-600 border-gray-300',
};

const positionColors: Record<string, string> = {
  cash: 'bg-green-100 text-green-800',
  mortgage_approved: 'bg-blue-100 text-blue-800',
  mortgage_required: 'bg-amber-100 text-amber-800',
  chain: 'bg-orange-100 text-orange-800',
};

interface OffersSectionProps {
  propertyId: number;
}

export default function OffersSection({ propertyId }: OffersSectionProps) {
  const queryClient = useQueryClient();
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; offerId: number | null }>({ open: false, offerId: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [counterDialog, setCounterDialog] = useState<{ open: boolean; offerId: number | null }>({ open: false, offerId: null });
  const [counterAmount, setCounterAmount] = useState('');

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['/api/crm/properties', propertyId, 'offers'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/properties/${propertyId}/offers`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch offers');
      return res.json();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ offerId, body }: { offerId: number; body: Record<string, any> }) => {
      const res = await apiRequest('PATCH', `/api/crm/offers/${offerId}/status`, body);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties', propertyId, 'offers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/offers'] });
    },
  });

  const handleAccept = (offerId: number) => {
    statusMutation.mutate({ offerId, body: { status: 'accepted' } });
  };

  const handleReject = () => {
    if (!rejectDialog.offerId) return;
    statusMutation.mutate({
      offerId: rejectDialog.offerId,
      body: { status: 'rejected', rejectionReason },
    });
    setRejectDialog({ open: false, offerId: null });
    setRejectionReason('');
  };

  const handleCounter = () => {
    if (!counterDialog.offerId || !counterAmount) return;
    const amountPence = Math.round(parseFloat(counterAmount) * 100);
    statusMutation.mutate({
      offerId: counterDialog.offerId,
      body: { status: 'under_review', counterOfferAmount: amountPence },
    });
    setCounterDialog({ open: false, offerId: null });
    setCounterAmount('');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-lg bg-gray-50">
        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No offers received yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">
          Offers ({offers.length})
        </h3>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Offer Amount</TableHead>
            <TableHead>Buyer</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Chain</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {offers.map((offer: any) => (
            <>
              <TableRow
                key={offer.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => setExpandedRow(expandedRow === offer.id ? null : offer.id)}
              >
                <TableCell className="font-semibold">{formatGBP(offer.offerAmount)}</TableCell>
                <TableCell>{offer.buyerName}</TableCell>
                <TableCell>
                  {offer.buyerPosition && (
                    <Badge variant="outline" className={positionColors[offer.buyerPosition] || ''}>
                      {offer.buyerPosition.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  {offer.isInChain ? (
                    <Badge variant="outline" className="bg-orange-50 text-orange-700">Yes</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">No</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {offer.createdAt ? new Date(offer.createdAt).toLocaleDateString('en-GB') : '-'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[offer.status] || ''}>
                    {offer.status?.replace(/_/g, ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {(offer.status === 'pending' || offer.status === 'under_review') && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 px-2"
                          onClick={() => handleAccept(offer.id)}
                          disabled={statusMutation.isPending}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                          onClick={() => setRejectDialog({ open: true, offerId: offer.id })}
                          disabled={statusMutation.isPending}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2"
                          onClick={() => setCounterDialog({ open: true, offerId: offer.id })}
                          disabled={statusMutation.isPending}
                        >
                          <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                          Counter
                        </Button>
                      </>
                    )}
                    {expandedRow === offer.id ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />
                    )}
                  </div>
                </TableCell>
              </TableRow>
              {expandedRow === offer.id && (
                <TableRow key={`${offer.id}-details`}>
                  <TableCell colSpan={7} className="bg-muted/30 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                      {offer.buyerEmail && (
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{offer.buyerEmail}</span>
                        </div>
                      )}
                      {offer.buyerPhone && (
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{offer.buyerPhone}</span>
                        </div>
                      )}
                      {offer.proposedCompletionDate && (
                        <div className="flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Completion: {new Date(offer.proposedCompletionDate).toLocaleDateString('en-GB')}</span>
                        </div>
                      )}
                      {offer.counterOfferAmount && (
                        <div>
                          <span className="text-muted-foreground">Counter: </span>
                          <span className="font-semibold">{formatGBP(offer.counterOfferAmount)}</span>
                        </div>
                      )}
                      {offer.finalAgreedAmount && (
                        <div>
                          <span className="text-muted-foreground">Agreed: </span>
                          <span className="font-semibold text-green-700">{formatGBP(offer.finalAgreedAmount)}</span>
                        </div>
                      )}
                      {offer.conditions && offer.conditions.length > 0 && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Conditions: </span>
                          <span>{offer.conditions.join(', ')}</span>
                        </div>
                      )}
                      {offer.chainDetails && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Chain Details: </span>
                          <span>{offer.chainDetails}</span>
                        </div>
                      )}
                      {offer.rejectionReason && (
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Rejection Reason: </span>
                          <span className="text-red-600">{offer.rejectionReason}</span>
                        </div>
                      )}
                      {/* Lettings-specific fields */}
                      {offer.employmentStatus && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Employment: {offer.employmentStatus}</span>
                        </div>
                      )}
                      {offer.rentalReferences && (
                        <div>
                          <span className="text-muted-foreground">References: </span>
                          <span>{offer.rentalReferences}</span>
                        </div>
                      )}
                      {offer.moveInTimeline && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>Move-in: {offer.moveInTimeline}</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </>
          ))}
        </TableBody>
      </Table>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => { if (!open) setRejectDialog({ open: false, offerId: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Offer</DialogTitle>
            <DialogDescription>Provide a reason for rejecting this offer.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Rejection Reason</Label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, offerId: null })}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectionReason.trim()}>Reject Offer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Counter Dialog */}
      <Dialog open={counterDialog.open} onOpenChange={(open) => { if (!open) setCounterDialog({ open: false, offerId: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Counter Offer</DialogTitle>
            <DialogDescription>Enter the counter offer amount in GBP.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Counter Offer Amount (GBP)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={counterAmount}
              onChange={(e) => setCounterAmount(e.target.value)}
              placeholder="e.g. 350000"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterDialog({ open: false, offerId: null })}>Cancel</Button>
            <Button onClick={handleCounter} disabled={!counterAmount}>Submit Counter</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
