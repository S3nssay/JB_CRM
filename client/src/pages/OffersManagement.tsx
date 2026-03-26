import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Loader2, ChevronDown, ChevronUp, Check, X, ArrowRightLeft,
  Phone, Mail, Link as LinkIcon, Calendar, AlertCircle
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

export default function OffersManagement() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [propertySearch, setPropertySearch] = useState('');
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; offerId: number | null }>({ open: false, offerId: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [counterDialog, setCounterDialog] = useState<{ open: boolean; offerId: number | null }>({ open: false, offerId: null });
  const [counterAmount, setCounterAmount] = useState('');

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  const queryString = queryParams.toString();

  const { data: offers = [], isLoading } = useQuery({
    queryKey: ['/api/crm/offers', statusFilter],
    queryFn: async () => {
      const res = await fetch(`/api/crm/offers${queryString ? `?${queryString}` : ''}`, { credentials: 'include' });
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

  // Client-side filter for property search
  const filteredOffers = offers.filter((offer: any) => {
    if (!propertySearch) return true;
    const search = propertySearch.toLowerCase();
    return (
      offer.propertyAddress?.toLowerCase().includes(search) ||
      offer.buyerName?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Offers Management</h1>
          <p className="text-muted-foreground">View and manage all property offers</p>
        </div>
        <Badge variant="outline" className="text-sm">
          {filteredOffers.length} offer{filteredOffers.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground">Search</Label>
              <Input
                placeholder="Search by property or buyer name..."
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
              />
            </div>
            <div className="w-[180px]">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="under_review">Under Review</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Offers Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No offers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
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
                {filteredOffers.map((offer: any) => (
                  <>
                    <TableRow
                      key={offer.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setExpandedRow(expandedRow === offer.id ? null : offer.id)}
                    >
                      <TableCell className="font-medium max-w-[200px] truncate">
                        {offer.propertyAddress || `Property #${offer.propertyId}`}
                      </TableCell>
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
                        <TableCell colSpan={8} className="bg-muted/30 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
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
                            {offer.employmentStatus && (
                              <div>
                                <span className="text-muted-foreground">Employment: </span>
                                <span>{offer.employmentStatus}</span>
                              </div>
                            )}
                            {offer.moveInTimeline && (
                              <div>
                                <span className="text-muted-foreground">Move-in: </span>
                                <span>{offer.moveInTimeline}</span>
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
          )}
        </CardContent>
      </Card>

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
