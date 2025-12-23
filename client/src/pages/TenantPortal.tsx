import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Plus,
  Ticket,
  MessageSquare,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Home,
  FileText,
  Calendar,
  DollarSign,
  Wrench,
  Phone,
  Mail,
  User,
  LogOut,
  Star,
  Send,
  Shield,
  ClipboardList,
  KeyRound,
  Sparkles,
  BookOpen
} from "lucide-react";
import { tenantTerms, tenantFees, type TenantTerm } from '@shared/lettingServiceTerms';

const ticketSchema = z.object({
  category: z.enum(["maintenance", "billing", "general_inquiry", "complaint", "emergency"]),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().min(20, "Please provide more details (at least 20 characters)"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
});

const commentSchema = z.object({
  comment: z.string().min(1, "Comment cannot be empty"),
});

type TicketForm = z.infer<typeof ticketSchema>;
type CommentForm = z.infer<typeof commentSchema>;

interface Ticket {
  id: number;
  ticketNumber: string;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  resolution?: string;
  satisfactionRating?: number;
  comments?: Comment[];
}

interface Comment {
  id: number;
  comment: string;
  userId: number;
  userFullName: string;
  isInternal: boolean;
  createdAt: string;
}

export default function TenantPortal() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    } else {
      setLocation("/login");
    }
  }, [setLocation]);

  const ticketForm = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      category: "general_inquiry",
      subject: "",
      description: "",
      priority: "medium",
    },
  });

  const commentForm = useForm<CommentForm>({
    resolver: zodResolver(commentSchema),
    defaultValues: {
      comment: "",
    },
  });

  // Fetch tickets
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["/api/tenant/tickets"],
    enabled: !!user,
  });

  // Fetch property details
  const { data: propertyDetails } = useQuery({
    queryKey: ["/api/tenant/property"],
    enabled: !!user,
  });

  // Create ticket mutation
  const createTicketMutation = useMutation({
    mutationFn: (data: TicketForm) =>
      apiRequest("/api/tenant/tickets", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      toast({ title: "Success", description: "Support ticket created successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/tickets"] });
      setIsNewTicketOpen(false);
      ticketForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create ticket",
      });
    },
  });

  // Add comment mutation
  const addCommentMutation = useMutation({
    mutationFn: ({ ticketId, comment }: { ticketId: number; comment: string }) =>
      apiRequest(`/api/tenant/tickets/${ticketId}/comments`, {
        method: "POST",
        body: JSON.stringify({ comment }),
      }),
    onSuccess: () => {
      toast({ title: "Success", description: "Comment added" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/tickets"] });
      commentForm.reset();
    },
    onError: (error: any) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to add comment",
      });
    },
  });

  // Rate satisfaction mutation
  const rateSatisfactionMutation = useMutation({
    mutationFn: ({ ticketId, rating }: { ticketId: number; rating: number }) =>
      apiRequest(`/api/tenant/tickets/${ticketId}/satisfaction`, {
        method: "POST",
        body: JSON.stringify({ rating }),
      }),
    onSuccess: () => {
      toast({ title: "Success", description: "Thank you for your feedback!" });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/tickets"] });
    },
  });

  const handleCreateTicket = (values: TicketForm) => {
    createTicketMutation.mutate(values);
  };

  const handleAddComment = (values: CommentForm) => {
    if (selectedTicket) {
      addCommentMutation.mutate({
        ticketId: selectedTicket.id,
        comment: values.comment,
      });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("user");
    setLocation("/login");
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "destructive";
      case "high":
        return "orange";
      case "medium":
        return "blue";
      case "low":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open":
        return <AlertCircle className="h-4 w-4" />;
      case "in_progress":
        return <Clock className="h-4 w-4" />;
      case "resolved":
        return <CheckCircle className="h-4 w-4" />;
      case "closed":
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "maintenance":
        return <Wrench className="h-4 w-4" />;
      case "billing":
        return <DollarSign className="h-4 w-4" />;
      case "complaint":
        return <AlertCircle className="h-4 w-4" />;
      case "emergency":
        return <Phone className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTermIcon = (termId: string) => {
    switch (termId) {
      case "cleaning":
        return <Sparkles className="h-5 w-5 text-[#791E75]" />;
      case "contracts":
        return <FileText className="h-5 w-5 text-[#791E75]" />;
      case "deposits":
        return <Shield className="h-5 w-5 text-[#791E75]" />;
      case "inventory":
        return <ClipboardList className="h-5 w-5 text-[#791E75]" />;
      case "check-in-out":
        return <KeyRound className="h-5 w-5 text-[#791E75]" />;
      case "management":
        return <Wrench className="h-5 w-5 text-[#791E75]" />;
      default:
        return <BookOpen className="h-5 w-5 text-[#791E75]" />;
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Home className="h-8 w-8 text-[#791E75]600" />
              <h1 className="text-xl font-bold">Tenant Portal</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Welcome, <strong>{user.fullName || user.username}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                data-testid="button-logout"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Property Info Card */}
        {propertyDetails && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Your Property</CardTitle>
              <CardDescription>Current rental property details</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <Home className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Address</p>
                    <p className="font-medium" data-testid="text-property-address">
                      {propertyDetails.address}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Lease End</p>
                    <p className="font-medium" data-testid="text-lease-end">
                      {new Date(propertyDetails.leaseEnd).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <div>
                    <p className="text-sm text-gray-500">Emergency Contact</p>
                    <p className="font-medium" data-testid="text-emergency-contact">
                      07XXX XXXXXX
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Support Tickets */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Support Tickets</CardTitle>
                <CardDescription>Manage your support requests</CardDescription>
              </div>
              <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-new-ticket">
                    <Plus className="h-4 w-4 mr-2" />
                    New Ticket
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[525px]">
                  <DialogHeader>
                    <DialogTitle>Create Support Ticket</DialogTitle>
                    <DialogDescription>
                      Describe your issue and we'll help you as soon as possible
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...ticketForm}>
                    <form onSubmit={ticketForm.handleSubmit(handleCreateTicket)} className="space-y-4">
                      <FormField
                        control={ticketForm.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-category">
                                  <SelectValue placeholder="Select a category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="maintenance">Maintenance Issue</SelectItem>
                                <SelectItem value="billing">Billing Inquiry</SelectItem>
                                <SelectItem value="general_inquiry">General Question</SelectItem>
                                <SelectItem value="complaint">Complaint</SelectItem>
                                <SelectItem value="emergency">Emergency</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={ticketForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                            >
                              <FormControl>
                                <SelectTrigger data-testid="select-priority">
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">Low</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={ticketForm.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject</FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="Brief description of the issue"
                                data-testid="input-subject"
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={ticketForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Description</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Please provide detailed information about your issue..."
                                className="min-h-[120px]"
                                data-testid="textarea-description"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <DialogFooter>
                        <Button
                          type="submit"
                          disabled={createTicketMutation.isPending}
                          data-testid="button-submit-ticket"
                        >
                          {createTicketMutation.isPending ? "Creating..." : "Create Ticket"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All Tickets</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="space-y-4 mt-4">
                {isLoading ? (
                  <p>Loading tickets...</p>
                ) : tickets.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      No support tickets yet. Click "New Ticket" to create one.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((ticket: Ticket) => (
                      <Card
                        key={ticket.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedTicket(ticket)}
                        data-testid={`card-ticket-${ticket.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div className="space-y-2">
                              <div className="flex items-center space-x-2">
                                {getCategoryIcon(ticket.category)}
                                <h3 className="font-semibold">{ticket.subject}</h3>
                                <Badge variant={getPriorityColor(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                              <p className="text-sm text-gray-600 line-clamp-2">
                                {ticket.description}
                              </p>
                              <div className="flex items-center space-x-4 text-xs text-gray-500">
                                <span>#{ticket.ticketNumber}</span>
                                <span>{new Date(ticket.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getStatusIcon(ticket.status)}
                              <Badge variant="outline">{ticket.status}</Badge>
                            </div>
                          </div>

                          {/* Satisfaction Rating for resolved tickets */}
                          {ticket.status === "resolved" && !ticket.satisfactionRating && (
                            <div className="mt-4 p-3 bg-[#791E75] text-white 50 rounded-lg">
                              <p className="text-sm font-medium mb-2">How was your experience?</p>
                              <div className="flex space-x-1">
                                {[1, 2, 3, 4, 5].map((rating) => (
                                  <Button
                                    key={rating}
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      rateSatisfactionMutation.mutate({
                                        ticketId: ticket.id,
                                        rating,
                                      });
                                    }}
                                    data-testid={`button-rating-${rating}`}
                                  >
                                    <Star
                                      className={`h-5 w-5 ${
                                        rating <= (ticket.satisfactionRating || 0)
                                          ? "text-[#F8B324]500 fill-yellow-500"
                                          : "text-gray-300"
                                      }`}
                                    />
                                  </Button>
                                ))}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="open" className="space-y-4 mt-4">
                {tickets
                  .filter((t: Ticket) => t.status === "open" || t.status === "in_progress")
                  .map((ticket: Ticket) => (
                    <Card
                      key={ticket.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              {getCategoryIcon(ticket.category)}
                              <h3 className="font-semibold">{ticket.subject}</h3>
                              <Badge variant={getPriorityColor(ticket.priority)}>
                                {ticket.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {ticket.description}
                            </p>
                          </div>
                          <Badge variant="outline">{ticket.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>

              <TabsContent value="resolved" className="space-y-4 mt-4">
                {tickets
                  .filter((t: Ticket) => t.status === "resolved" || t.status === "closed")
                  .map((ticket: Ticket) => (
                    <Card
                      key={ticket.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              {getCategoryIcon(ticket.category)}
                              <h3 className="font-semibold">{ticket.subject}</h3>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-2">
                              {ticket.description}
                            </p>
                          </div>
                          <Badge variant="outline">{ticket.status}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Terms & Conditions Section */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-[#791E75]" />
              Tenant Terms & Conditions
            </CardTitle>
            <CardDescription>Important information about your tenancy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tenantTerms.map((term: TenantTerm) => (
                <Card key={term.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1">{getTermIcon(term.id)}</div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-2">{term.title}</h4>
                        <p className="text-sm text-gray-600 mb-2">{term.description}</p>
                        {term.details && (
                          <ul className="text-sm text-gray-600 space-y-1 mt-2">
                            {term.details.map((detail, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <CheckCircle className="h-3 w-3 mt-1 text-green-500 flex-shrink-0" />
                                <span>{detail}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {term.pricing && (
                          <p className="text-sm font-medium text-[#791E75] mt-2">{term.pricing}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Tenant Fees */}
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-[#791E75]" />
                Tenant Fees
              </h4>
              <div className="space-y-2">
                {tenantFees.map((fee, idx) => (
                  <div key={idx} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700">{fee.name}</span>
                    <span className="font-semibold text-[#791E75]">£{fee.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={() => setSelectedTicket(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          {selectedTicket && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center space-x-2">
                  <Ticket className="h-5 w-5" />
                  <span>Ticket #{selectedTicket.ticketNumber}</span>
                </DialogTitle>
                <DialogDescription>
                  Created on {new Date(selectedTicket.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Category</p>
                    <div className="flex items-center space-x-2">
                      {getCategoryIcon(selectedTicket.category)}
                      <span className="font-medium capitalize">
                        {selectedTicket.category.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Priority</p>
                    <Badge variant={getPriorityColor(selectedTicket.priority)}>
                      {selectedTicket.priority}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(selectedTicket.status)}
                      <span className="font-medium capitalize">
                        {selectedTicket.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                  {selectedTicket.satisfactionRating && (
                    <div>
                      <p className="text-sm text-gray-500">Your Rating</p>
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${
                              star <= selectedTicket.satisfactionRating!
                                ? "text-[#F8B324]500 fill-yellow-500"
                                : "text-gray-300"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold mb-2">{selectedTicket.subject}</h3>
                  <p className="text-gray-700">{selectedTicket.description}</p>
                </div>

                {selectedTicket.resolution && (
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Resolution:</strong> {selectedTicket.resolution}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Comments Section */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-4">Comments</h4>
                  <ScrollArea className="h-[200px] mb-4">
                    <div className="space-y-3">
                      {selectedTicket.comments?.map((comment) => (
                        <div
                          key={comment.id}
                          className={`p-3 rounded-lg ${
                            comment.isInternal
                              ? "bg-[#F8B324] text-black 50 border border-yellow-200"
                              : "bg-gray-50"
                          }`}
                          data-testid={`comment-${comment.id}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">
                              {comment.userFullName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700">{comment.comment}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>

                  {selectedTicket.status !== "closed" && (
                    <Form {...commentForm}>
                      <form onSubmit={commentForm.handleSubmit(handleAddComment)} className="space-y-3">
                        <FormField
                          control={commentForm.control}
                          name="comment"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Textarea
                                  placeholder="Add a comment..."
                                  className="min-h-[80px]"
                                  data-testid="textarea-comment"
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <Button
                          type="submit"
                          size="sm"
                          disabled={addCommentMutation.isPending}
                          data-testid="button-add-comment"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {addCommentMutation.isPending ? "Sending..." : "Send Comment"}
                        </Button>
                      </form>
                    </Form>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}