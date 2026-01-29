import { useState } from 'react';
import { useLocation, Link, useParams } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  ArrowLeft, Phone, Mail, MapPin, Calendar, DollarSign,
  User, Home, FileText, CheckCircle, Loader2, Building2,
  Clock, Edit, MessageSquare, Send, ChevronRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

// Workflow stages with metadata
const WORKFLOW_STAGES = [
  { id: 'new', label: 'New Lead', color: 'bg-blue-500', textColor: 'text-blue-600', icon: User },
  { id: 'contacted', label: 'Contacted', color: 'bg-purple-500', textColor: 'text-purple-600', icon: Phone },
  { id: 'valuation_scheduled', label: 'Valuation Scheduled', color: 'bg-orange-500', textColor: 'text-orange-600', icon: Calendar },
  { id: 'valuation_completed', label: 'Valuation Completed', color: 'bg-amber-500', textColor: 'text-amber-600', icon: CheckCircle },
  { id: 'instruction_signed', label: 'Instruction Signed', color: 'bg-emerald-500', textColor: 'text-emerald-600', icon: FileText },
  { id: 'listing_preparation', label: 'Listing Prep', color: 'bg-cyan-500', textColor: 'text-cyan-600', icon: Home },
  { id: 'listed', label: 'Listed', color: 'bg-green-600', textColor: 'text-green-600', icon: Building2 }
] as const;

type WorkflowStage = typeof WORKFLOW_STAGES[number]['id'];

export default function LandlordLeadDetails() {
  const params = useParams();
  const leadId = parseInt(params.id as string);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showValuationDialog, setShowValuationDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [valuationAmount, setValuationAmount] = useState('');
  const [valuationNotes, setValuationNotes] = useState('');
  const [propertyTitle, setPropertyTitle] = useState('');

  // Fetch lead details
  const { data: lead, isLoading, error } = useQuery({
    queryKey: ['/api/crm/landlord-leads', leadId],
    queryFn: async () => {
      const response = await fetch(`/api/crm/landlord-leads/${leadId}`);
      if (!response.ok) throw new Error('Failed to fetch lead');
      return response.json();
    }
  });

  // Fetch agents for assignment
  const { data: agents = [] } = useQuery({
    queryKey: ['/api/crm/users'],
    queryFn: async () => {
      const response = await fetch('/api/crm/users');
      if (!response.ok) return [];
      return response.json();
    }
  });

  // Update stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async (stage: WorkflowStage) => {
      const response = await fetch(`/api/crm/landlord-leads/${leadId}/stage`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage })
      });
      if (!response.ok) throw new Error('Failed to update stage');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads', leadId] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads'] });
      toast({ title: 'Stage updated', description: 'Lead workflow stage has been updated.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update stage', variant: 'destructive' });
    }
  });

  // Schedule valuation mutation
  const scheduleValuationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/crm/landlord-leads/${leadId}/schedule-valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduledDate })
      });
      if (!response.ok) throw new Error('Failed to schedule valuation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads', leadId] });
      setShowScheduleDialog(false);
      setScheduledDate('');
      toast({ title: 'Valuation scheduled', description: 'The valuation appointment has been scheduled.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to schedule valuation', variant: 'destructive' });
    }
  });

  // Complete valuation mutation
  const completeValuationMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/crm/landlord-leads/${leadId}/complete-valuation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          valuationAmount: Math.round(parseFloat(valuationAmount) * 100),
          notes: valuationNotes
        })
      });
      if (!response.ok) throw new Error('Failed to complete valuation');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads', leadId] });
      setShowValuationDialog(false);
      setValuationAmount('');
      setValuationNotes('');
      toast({ title: 'Valuation completed', description: 'The valuation has been recorded.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to complete valuation', variant: 'destructive' });
    }
  });

  // Sign instruction mutation
  const signInstructionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/crm/landlord-leads/${leadId}/sign-instruction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to sign instruction');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads', leadId] });
      toast({ title: 'Instruction signed', description: 'The instruction has been recorded.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to sign instruction', variant: 'destructive' });
    }
  });

  // Convert to listing mutation
  const convertToListingMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/crm/landlord-leads/${leadId}/convert-to-listing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyData: { title: propertyTitle }
        })
      });
      if (!response.ok) throw new Error('Failed to convert to listing');
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlord-leads', leadId] });
      setShowConvertDialog(false);
      toast({ title: 'Property created', description: 'The property has been created and listed.' });
      // Navigate to property edit page
      setLocation(`/crm/properties/${data.propertyId}/edit`);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to convert to listing', variant: 'destructive' });
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-6">
          <p className="text-red-600">Failed to load lead details</p>
          <Button className="mt-4" onClick={() => setLocation('/crm/landlord-lead-pipeline')}>
            Back to Pipeline
          </Button>
        </Card>
      </div>
    );
  }

  const currentStageIndex = WORKFLOW_STAGES.findIndex(s => s.id === (lead.workflow_stage || 'new'));
  const currentStage = WORKFLOW_STAGES[currentStageIndex];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      maximumFractionDigits: 0
    }).format(amount / 100);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/crm/landlord-lead-pipeline">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-xl font-semibold">{lead.full_name}</h1>
                <p className="text-sm text-muted-foreground">Landlord Lead #{lead.id}</p>
              </div>
            </div>
            <Badge className={`${currentStage.color} text-white`}>
              {currentStage.label}
            </Badge>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* Workflow Progress */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Workflow Progress</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{currentStage.label}</span>
                <span className="text-muted-foreground">
                  {Math.round((currentStageIndex / (WORKFLOW_STAGES.length - 1)) * 100)}% Complete
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${currentStage.color} transition-all duration-500`}
                  style={{ width: `${(currentStageIndex / (WORKFLOW_STAGES.length - 1)) * 100}%` }}
                />
              </div>
            </div>

            {/* Stage Timeline */}
            <div className="flex justify-between items-center relative mt-6">
              <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-gray-200 -translate-y-1/2" />
              {WORKFLOW_STAGES.map((stage, index) => {
                const isPast = index < currentStageIndex;
                const isCurrent = index === currentStageIndex;
                const StageIcon = stage.icon;
                return (
                  <div key={stage.id} className="relative flex flex-col items-center z-10">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                        isPast
                          ? `${stage.color} border-transparent text-white`
                          : isCurrent
                          ? `bg-white ${stage.color.replace('bg-', 'border-')} ${stage.textColor}`
                          : 'bg-white border-gray-300 text-gray-400'
                      }`}
                    >
                      {isPast ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <StageIcon className="h-4 w-4" />
                      )}
                    </div>
                    <span
                      className={`text-xs mt-2 text-center max-w-[80px] ${
                        isCurrent ? 'font-medium' : 'text-muted-foreground'
                      }`}
                    >
                      {stage.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm">Full Name</Label>
                    <p className="font-medium">{lead.full_name}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm">Inquiry Type</Label>
                    <Badge variant="outline" className="capitalize mt-1">{lead.inquiry_type}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${lead.email}`} className="text-[#791E75] hover:underline">
                      {lead.email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <a href={`tel:${lead.phone}`} className="text-[#791E75] hover:underline">
                      {lead.phone}
                    </a>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Property Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  Property Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {lead.property_address && (
                    <div className="col-span-2">
                      <Label className="text-muted-foreground text-sm">Address</Label>
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{lead.property_address}</p>
                      </div>
                    </div>
                  )}
                  {lead.postcode && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Postcode</Label>
                      <p className="font-medium">{lead.postcode}</p>
                    </div>
                  )}
                  {lead.property_type && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Property Type</Label>
                      <p className="font-medium capitalize">{lead.property_type}</p>
                    </div>
                  )}
                  {lead.bedrooms && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Bedrooms</Label>
                      <p className="font-medium">{lead.bedrooms}</p>
                    </div>
                  )}
                  {lead.timeframe && (
                    <div>
                      <Label className="text-muted-foreground text-sm">Timeframe</Label>
                      <p className="font-medium">{lead.timeframe}</p>
                    </div>
                  )}
                </div>
                {lead.message && (
                  <div>
                    <Label className="text-muted-foreground text-sm">Message</Label>
                    <p className="mt-1 p-3 bg-gray-50 rounded-lg text-sm">{lead.message}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Valuation Info (if applicable) */}
            {(lead.valuation_scheduled_date || lead.valuation_completed_date || lead.valuation_amount) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Valuation Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {lead.valuation_scheduled_date && (
                      <div>
                        <Label className="text-muted-foreground text-sm">Scheduled Date</Label>
                        <p className="font-medium flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          {format(new Date(lead.valuation_scheduled_date), 'dd MMM yyyy HH:mm')}
                        </p>
                      </div>
                    )}
                    {lead.valuation_completed_date && (
                      <div>
                        <Label className="text-muted-foreground text-sm">Completed Date</Label>
                        <p className="font-medium flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          {format(new Date(lead.valuation_completed_date), 'dd MMM yyyy')}
                        </p>
                      </div>
                    )}
                    {lead.valuation_amount > 0 && (
                      <div>
                        <Label className="text-muted-foreground text-sm">Estimated Value</Label>
                        <p className="font-medium text-xl text-green-600">
                          {formatCurrency(lead.valuation_amount)}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notes */}
            {lead.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Notes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{lead.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Stage-specific actions */}
                {lead.workflow_stage === 'new' && (
                  <Button
                    className="w-full"
                    onClick={() => updateStageMutation.mutate('contacted')}
                    disabled={updateStageMutation.isPending}
                  >
                    <Phone className="mr-2 h-4 w-4" />
                    Mark as Contacted
                  </Button>
                )}

                {lead.workflow_stage === 'contacted' && (
                  <Button
                    className="w-full"
                    onClick={() => setShowScheduleDialog(true)}
                  >
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Valuation
                  </Button>
                )}

                {lead.workflow_stage === 'valuation_scheduled' && (
                  <Button
                    className="w-full"
                    onClick={() => setShowValuationDialog(true)}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Complete Valuation
                  </Button>
                )}

                {lead.workflow_stage === 'valuation_completed' && (
                  <Button
                    className="w-full"
                    onClick={() => signInstructionMutation.mutate()}
                    disabled={signInstructionMutation.isPending}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Mark Instruction Signed
                  </Button>
                )}

                {lead.workflow_stage === 'instruction_signed' && (
                  <Button
                    className="w-full"
                    onClick={() => updateStageMutation.mutate('listing_preparation')}
                    disabled={updateStageMutation.isPending}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Start Listing Preparation
                  </Button>
                )}

                {lead.workflow_stage === 'listing_preparation' && (
                  <Button
                    className="w-full bg-[#791E75] hover:bg-[#5d1759]"
                    onClick={() => setShowConvertDialog(true)}
                  >
                    <Building2 className="mr-2 h-4 w-4" />
                    Create Property Listing
                  </Button>
                )}

                {lead.workflow_stage === 'listed' && lead.linked_property_id && (
                  <Button
                    className="w-full bg-[#791E75] hover:bg-[#5d1759]"
                    onClick={() => setLocation(`/crm/properties/${lead.linked_property_id}/edit`)}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    View Property
                  </Button>
                )}

                <hr className="my-2" />

                {/* Contact Actions */}
                <Button variant="outline" className="w-full" asChild>
                  <a href={`mailto:${lead.email}`}>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Email
                  </a>
                </Button>
                <Button variant="outline" className="w-full" asChild>
                  <a href={`tel:${lead.phone}`}>
                    <Phone className="mr-2 h-4 w-4" />
                    Call
                  </a>
                </Button>
              </CardContent>
            </Card>

            {/* Lead Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Lead Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created</span>
                  <span>{format(new Date(lead.created_at), 'dd MMM yyyy')}</span>
                </div>
                {lead.workflow_updated_at && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last Updated</span>
                    <span>{format(new Date(lead.workflow_updated_at), 'dd MMM yyyy')}</span>
                  </div>
                )}
                {lead.assignedAgentName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Assigned To</span>
                    <span>{lead.assignedAgentName}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Schedule Valuation Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Valuation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Date and Time</Label>
              <Input
                type="datetime-local"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => scheduleValuationMutation.mutate()}
              disabled={!scheduledDate || scheduleValuationMutation.isPending}
            >
              {scheduleValuationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Valuation Dialog */}
      <Dialog open={showValuationDialog} onOpenChange={setShowValuationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete Valuation</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Estimated Value (GBP)</Label>
              <Input
                type="number"
                placeholder="e.g. 500000"
                value={valuationAmount}
                onChange={(e) => setValuationAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Any notes about the valuation..."
                value={valuationNotes}
                onChange={(e) => setValuationNotes(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValuationDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => completeValuationMutation.mutate()}
              disabled={completeValuationMutation.isPending}
            >
              {completeValuationMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Complete Valuation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Listing Dialog */}
      <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Property Listing</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              This will create a new property listing from this lead. You can edit the property details after creation.
            </p>
            <div>
              <Label>Property Title</Label>
              <Input
                placeholder={`${lead.property_type || 'Property'} in ${lead.postcode || ''}`}
                value={propertyTitle}
                onChange={(e) => setPropertyTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Leave blank to use default title
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvertDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#791E75] hover:bg-[#5d1759]"
              onClick={() => convertToListingMutation.mutate()}
              disabled={convertToListingMutation.isPending}
            >
              {convertToListingMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Property
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
