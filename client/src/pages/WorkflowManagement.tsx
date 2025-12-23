import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, FileText, Users, Calendar, Mail, Check, AlertCircle, Clock, ArrowRight, Home, Eye, DollarSign, FileSignature, ArrowLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { ScheduleViewingWizard } from "@/components/ScheduleViewingWizard";

// Workflow stages
const WORKFLOW_STAGES = [
  { id: 'valuation_requested', label: 'Valuation Requested', icon: Home, color: 'bg-gray-500' },
  { id: 'valuation_scheduled', label: 'Valuation Scheduled', icon: Calendar, color: 'bg-[#791E75] text-white 500' },
  { id: 'valuation_completed', label: 'Valuation Complete', icon: Check, color: 'bg-[#791E75] text-white 500' },
  { id: 'instruction_pending', label: 'Awaiting Instruction', icon: FileText, color: 'bg-[#F8B324] text-black 500' },
  { id: 'instruction_signed', label: 'Instructed', icon: FileSignature, color: 'bg-purple-500' },
  { id: 'listing_preparation', label: 'Preparing Listing', icon: FileText, color: 'bg-[#791E75] text-white 500' },
  { id: 'listed', label: 'Listed', icon: Home, color: 'bg-[#791E75] text-white 500' },
  { id: 'viewing_scheduled', label: 'Viewings Active', icon: Eye, color: 'bg-[#791E75] text-white 500' },
  { id: 'offer_received', label: 'Offer Received', icon: DollarSign, color: 'bg-[#F8B324] text-black 500' },
  { id: 'offer_accepted', label: 'Offer Accepted', icon: Check, color: 'bg-[#791E75] text-white 500' },
  { id: 'contracts_preparing', label: 'Preparing Contracts', icon: FileText, color: 'bg-purple-500' },
  { id: 'contracts_sent', label: 'Contracts Sent', icon: Mail, color: 'bg-[#791E75] text-white 500' },
  { id: 'contracts_exchanged', label: 'Exchanged', icon: FileSignature, color: 'bg-[#791E75] text-white 600' },
  { id: 'completed', label: 'Completed', icon: Check, color: 'bg-[#791E75] text-white 700' }
];

// Form schemas
const valuationFormSchema = z.object({
  propertyAddress: z.string().min(5, "Address is required"),
  vendorName: z.string().min(2, "Vendor name is required"),
  vendorEmail: z.string().email("Valid email required"),
  vendorPhone: z.string().min(10, "Phone number required"),
  preferredDate: z.string(),
  notes: z.string().optional()
});

const viewingFormSchema = z.object({
  viewerName: z.string().min(2, "Name is required"),
  viewerEmail: z.string().email("Valid email required"),
  viewerPhone: z.string().min(10, "Phone required"),
  scheduledDate: z.string(),
  appointmentType: z.string(),
  notes: z.string().optional()
});

const offerFormSchema = z.object({
  buyerName: z.string().min(2, "Buyer name required"),
  buyerEmail: z.string().email("Valid email required"),
  buyerPhone: z.string().min(10, "Phone required"),
  offerAmount: z.string().min(1, "Offer amount required"),
  buyerPosition: z.string(),
  proposedCompletionDate: z.string().optional(),
  conditions: z.string().optional()
});

export default function WorkflowManagement() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<any>(null);
  const [showValuationDialog, setShowValuationDialog] = useState(false);
  const [showViewingDialog, setShowViewingDialog] = useState(false);
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [showContractDialog, setShowContractDialog] = useState(false);
  
  // Fetch workflows
  const { data: workflows, isLoading } = useQuery({
    queryKey: ['/api/crm/workflows'],
    queryFn: async () => {
      const response = await fetch('/api/crm/workflows');
      if (!response.ok) throw new Error('Failed to fetch workflows');
      return response.json();
    }
  });
  
  // Fetch customer enquiries
  const { data: enquiries } = useQuery({
    queryKey: ['/api/crm/enquiries'],
    queryFn: async () => {
      const response = await fetch('/api/crm/enquiries');
      if (!response.ok) throw new Error('Failed to fetch enquiries');
      return response.json();
    }
  });
  
  // Progress workflow mutation
  const progressWorkflow = useMutation({
    mutationFn: async ({ workflowId, nextStage }: any) => {
      return apiRequest(
        `/api/crm/workflows/${workflowId}/progress`, 
        'POST',
        { nextStage }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/workflows'] });
      toast({ title: "Workflow progressed successfully" });
    }
  });
  
  // Start valuation form
  const valuationForm = useForm({
    resolver: zodResolver(valuationFormSchema),
    defaultValues: {
      propertyAddress: '',
      vendorName: '',
      vendorEmail: '',
      vendorPhone: '',
      preferredDate: '',
      notes: ''
    }
  });
  
  // Schedule viewing form
  const viewingForm = useForm({
    resolver: zodResolver(viewingFormSchema),
    defaultValues: {
      viewerName: '',
      viewerEmail: '',
      viewerPhone: '',
      scheduledDate: '',
      appointmentType: 'in_person',
      notes: ''
    }
  });
  
  // Submit offer form
  const offerForm = useForm({
    resolver: zodResolver(offerFormSchema),
    defaultValues: {
      buyerName: '',
      buyerEmail: '',
      buyerPhone: '',
      offerAmount: '',
      buyerPosition: 'mortgage_required',
      proposedCompletionDate: '',
      conditions: ''
    }
  });
  
  // Start new valuation
  const startValuation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(
        '/api/crm/workflows/valuation', 
        'POST',
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/workflows'] });
      toast({ title: "Valuation request created" });
      setShowValuationDialog(false);
      valuationForm.reset();
    }
  });
  
  // Schedule viewing
  const scheduleViewing = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(
        `/api/crm/viewings`, 
        'POST',
        {
          ...data,
          propertyId: selectedWorkflow?.propertyId
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/workflows'] });
      toast({ title: "Viewing scheduled successfully" });
      setShowViewingDialog(false);
      viewingForm.reset();
    }
  });
  
  // Submit offer
  const submitOffer = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest(
        `/api/crm/offers`, 
        'POST',
        {
          ...data,
          propertyId: selectedWorkflow?.propertyId,
          workflowId: selectedWorkflow?.id
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/workflows'] });
      toast({ title: "Offer submitted successfully" });
      setShowOfferDialog(false);
      offerForm.reset();
    }
  });
  
  // Send contracts via DocuSign
  const sendContracts = useMutation({
    mutationFn: async (workflowId: number) => {
      return apiRequest(
        `/api/crm/workflows/${workflowId}/contracts`, 
        'POST',
        {}
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/workflows'] });
      toast({ title: "Contracts sent via DocuSign" });
      setShowContractDialog(false);
    }
  });
  
  // Get current stage info
  const getCurrentStageInfo = (stage: string) => {
    return WORKFLOW_STAGES.find(s => s.id === stage) || WORKFLOW_STAGES[0];
  };
  
  // Calculate progress percentage
  const getProgressPercentage = (currentStage: string) => {
    const currentIndex = WORKFLOW_STAGES.findIndex(s => s.id === currentStage);
    if (currentIndex === -1) return 0;
    return Math.round((currentIndex / (WORKFLOW_STAGES.length - 1)) * 100);
  };
  
  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/portal">
            <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Property Workflow Management</h1>
        </div>
        <Button onClick={() => setShowValuationDialog(true)}>
          Start New Valuation
        </Button>
      </div>
      
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Active Workflows</TabsTrigger>
          <TabsTrigger value="enquiries">Customer Enquiries</TabsTrigger>
          <TabsTrigger value="viewings">Viewings</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="contracts">Contracts</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows?.map((workflow: any) => {
                const stageInfo = getCurrentStageInfo(workflow.currentStage);
                const progress = getProgressPercentage(workflow.currentStage);
                
                return (
                  <Card key={workflow.id} className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => setSelectedWorkflow(workflow)}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">
                          {workflow.propertyAddress || `Workflow #${workflow.id}`}
                        </CardTitle>
                        <Badge className={stageInfo.color}>
                          {stageInfo.label}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-[#791E75] text-white 600 h-2 rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        
                        {/* Workflow details */}
                        <div className="text-sm space-y-1">
                          {workflow.valuationAmount && (
                            <p>Valuation: £{(workflow.valuationAmount / 100).toLocaleString()}</p>
                          )}
                          {workflow.askingPrice && (
                            <p>Asking: £{(workflow.askingPrice / 100).toLocaleString()}</p>
                          )}
                          <p className="text-gray-500">
                            Started: {format(new Date(workflow.createdAt), 'dd MMM yyyy')}
                          </p>
                        </div>
                        
                        {/* Quick stats */}
                        <div className="flex justify-between text-sm">
                          <span className="flex items-center gap-1">
                            <Eye className="h-4 w-4" />
                            {workflow.totalViewings || 0} viewings
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {workflow.totalOffers || 0} offers
                          </span>
                        </div>
                        
                        {/* Action buttons based on stage */}
                        <div className="flex gap-2 mt-4">
                          {workflow.currentStage === 'valuation_requested' && (
                            <Button size="sm" onClick={(e) => {
                              e.stopPropagation();
                              progressWorkflow.mutate({ 
                                workflowId: workflow.id, 
                                nextStage: 'valuation_scheduled' 
                              });
                            }}>
                              Schedule Valuation
                            </Button>
                          )}
                          {workflow.currentStage === 'valuation_scheduled' && (
                            <Button size="sm" onClick={(e) => {
                              e.stopPropagation();
                              progressWorkflow.mutate({ 
                                workflowId: workflow.id, 
                                nextStage: 'valuation_completed' 
                              });
                            }}>
                              Complete Valuation
                            </Button>
                          )}
                          {workflow.currentStage === 'listed' && (
                            <Button size="sm" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkflow(workflow);
                              setShowViewingDialog(true);
                            }}>
                              Schedule Viewing
                            </Button>
                          )}
                          {workflow.currentStage === 'offer_accepted' && (
                            <Button size="sm" onClick={(e) => {
                              e.stopPropagation();
                              setSelectedWorkflow(workflow);
                              setShowContractDialog(true);
                            }}>
                              Send Contracts
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="enquiries" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Customer Enquiries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {enquiries?.map((enquiry: any) => (
                  <div key={enquiry.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{enquiry.customerName}</p>
                        <p className="text-sm text-gray-500">{enquiry.customerEmail}</p>
                        <p className="text-sm mt-1">{enquiry.message}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={
                          enquiry.leadTemperature === 'hot' ? 'destructive' :
                          enquiry.leadTemperature === 'warm' ? 'default' : 'secondary'
                        }>
                          {enquiry.leadTemperature} lead
                        </Badge>
                        <p className="text-sm text-gray-500 mt-1">
                          Score: {enquiry.leadScore}/100
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline">
                        <Mail className="h-4 w-4 mr-1" />
                        Send Properties
                      </Button>
                      <Button size="sm">
                        <Calendar className="h-4 w-4 mr-1" />
                        Book Viewing
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="viewings">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Viewings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Viewing appointments will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="offers">
          <Card>
            <CardHeader>
              <CardTitle>Property Offers</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">Offers will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="contracts">
          <Card>
            <CardHeader>
              <CardTitle>Contract Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500">DocuSign contracts will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Valuation Dialog */}
      <Dialog open={showValuationDialog} onOpenChange={setShowValuationDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Start New Valuation</DialogTitle>
          </DialogHeader>
          <Form {...valuationForm}>
            <form onSubmit={valuationForm.handleSubmit((data) => startValuation.mutate(data))} 
                  className="space-y-4">
              <FormField
                control={valuationForm.control}
                name="propertyAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Address</FormLabel>
                    <FormControl>
                      <Input placeholder="123 High Street, London" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={valuationForm.control}
                name="vendorName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Smith" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={valuationForm.control}
                name="vendorEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="john@example.com" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={valuationForm.control}
                name="vendorPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="07700900000" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={valuationForm.control}
                name="preferredDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Preferred Date</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={valuationForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any additional notes..." {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setShowValuationDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={startValuation.isPending}>
                  {startValuation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Start Valuation
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Contract Dialog */}
      <Dialog open={showContractDialog} onOpenChange={setShowContractDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Contracts via DocuSign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>This will generate and send the following documents:</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>Sales Contract</li>
              <li>Property Information Form</li>
              <li>Fixtures & Fittings Form</li>
              <li>Memorandum of Sale</li>
            </ul>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowContractDialog(false)}>
                Cancel
              </Button>
              <Button onClick={() => selectedWorkflow && sendContracts.mutate(selectedWorkflow.id)}
                      disabled={sendContracts.isPending}>
                {sendContracts.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Send Contracts
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScheduleViewingWizard
        isOpen={showViewingDialog}
        onClose={() => setShowViewingDialog(false)}
        preselectedPropertyId={selectedWorkflow?.propertyId}
        onSuccess={() => {
          setShowViewingDialog(false);
          queryClient.invalidateQueries({ queryKey: ['/api/crm/workflows'] });
          toast({
            title: "Viewing Scheduled",
            description: "The viewing has been added to the calendar."
          });
        }}
      />
    </div>
  );
}