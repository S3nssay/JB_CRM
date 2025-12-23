import { useState, useEffect } from 'react';
import { Link, useSearch } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Mail, MessageSquare, Phone, Send, Plus, Search, Filter,
  Clock, CheckCircle, AlertCircle, User, Building2, Tag,
  MoreVertical, Reply, Forward, Archive, Trash2, Star,
  FileText, Edit, Copy, Eye, Users, Calendar, BarChart3,
  Smartphone, MessagesSquare, ArrowLeft
} from 'lucide-react';

// Interface for Inbox Item
interface InboxItem {
  id: string;
  source: 'tenant_communication' | 'property_inquiry' | 'general_inquiry';
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  message: string;
  timestamp: string; // ISO string from JSON
  type: string;
  status: string;
  originalId: number;
}

// Mock messages for conversation detail
const mockMessages = [
  {
    id: 1,
    direction: 'inbound',
    channel: 'email',
    content: 'Hi, I saw your listing for the 2 bed flat in Maida Vale. It looks perfect for what I\'m looking for. Could you provide more details about the property?',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
    status: 'read'
  },
  {
    id: 2,
    direction: 'outbound',
    channel: 'email',
    content: 'Hello Sarah, Thank you for your interest! The flat features a modern open-plan kitchen, two spacious bedrooms, and a private balcony. It\'s available from December 1st. Would you like to arrange a viewing?',
    sentAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
    status: 'delivered'
  },
  {
    id: 3,
    direction: 'inbound',
    channel: 'email',
    content: 'Thank you for the property details. When can I schedule a viewing?',
    sentAt: new Date(Date.now() - 1000 * 60 * 30),
    status: 'read'
  }
];

// Mock templates
const mockTemplates = [
  {
    id: 1,
    templateName: 'Viewing Confirmation',
    templateType: 'email',
    subject: 'Your Viewing Appointment Confirmation',
    content: 'Dear {{customer_name}},\n\nYour viewing has been confirmed for {{viewing_date}} at {{viewing_time}}.\n\nProperty: {{property_address}}\n\nPlease arrive 5 minutes early. If you need to reschedule, please contact us.\n\nBest regards,\nJohn Barclay Estate Agents',
    isActive: true
  },
  {
    id: 2,
    templateName: 'Welcome New Tenant',
    templateType: 'email',
    subject: 'Welcome to Your New Home',
    content: 'Dear {{tenant_name}},\n\nWelcome to {{property_address}}!\n\nYour tenancy begins on {{start_date}}. Please find attached your tenancy agreement and inventory.\n\nIf you have any questions, please don\'t hesitate to contact us.\n\nBest regards,\nJohn Barclay Estate Agents',
    isActive: true
  },
  {
    id: 3,
    templateName: 'Rent Reminder',
    templateType: 'sms',
    subject: '',
    content: 'Hi {{tenant_name}}, this is a reminder that your rent of {{rent_amount}} is due on {{due_date}}. Please ensure payment is made on time. - John Barclay',
    isActive: true
  },
  {
    id: 4,
    templateName: 'Maintenance Update',
    templateType: 'whatsapp',
    subject: '',
    content: 'Hi {{tenant_name}}, update on your maintenance request #{{ticket_id}}: {{status_update}}. Expected completion: {{completion_date}}. Contact us if you have questions.',
    isActive: true
  }
];

// Mock campaigns
const mockCampaigns = [
  {
    id: 1,
    name: 'December Newsletter',
    description: 'Monthly property update and market insights',
    campaignType: 'email',
    status: 'sent',
    recipientCount: 1250,
    sentCount: 1248,
    openedCount: 456,
    clickedCount: 89,
    scheduledFor: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
    completedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2)
  },
  {
    id: 2,
    name: 'Rent Reminder - December',
    description: 'Monthly rent payment reminder for all tenants',
    campaignType: 'sms',
    status: 'scheduled',
    recipientCount: 85,
    sentCount: 0,
    openedCount: 0,
    clickedCount: 0,
    scheduledFor: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    completedAt: null
  },
  {
    id: 3,
    name: 'New Property Alert',
    description: 'Alert for buyers registered for Maida Vale properties',
    campaignType: 'email',
    status: 'draft',
    recipientCount: 320,
    sentCount: 0,
    openedCount: 0,
    clickedCount: 0,
    scheduledFor: null,
    completedAt: null
  }
];

const getChannelIcon = (channel: string) => {
  switch (channel) {
    case 'email': return <Mail className="h-4 w-4" />;
    case 'sms': return <Smartphone className="h-4 w-4" />;
    case 'whatsapp': return <MessagesSquare className="h-4 w-4" />;
    case 'phone': return <Phone className="h-4 w-4" />;
    default: return <MessageSquare className="h-4 w-4" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'open': return 'bg-blue-100 text-blue-800';
    case 'pending': return 'bg-yellow-100 text-yellow-800';
    case 'resolved': return 'bg-green-100 text-green-800';
    case 'closed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'bg-red-100 text-red-800';
    case 'high': return 'bg-orange-100 text-orange-800';
    case 'normal': return 'bg-blue-100 text-blue-800';
    case 'low': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const formatTimeAgo = (date: Date | string) => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!d) return '';
  const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export default function CommunicationHub() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const searchString = useSearch();

  const [activeTab, setActiveTab] = useState('inbox');
  const [selectedConversation, setSelectedConversation] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterChannel, setFilterChannel] = useState('all');
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterLandlord, setFilterLandlord] = useState('all');
  const [filterTenant, setFilterTenant] = useState('all');
  const [replyText, setReplyText] = useState('');

  // Read URL params for initial filters
  useEffect(() => {
    const params = new URLSearchParams(searchString);
    const propertyId = params.get('propertyId');
    const landlordId = params.get('landlordId');
    const tenantId = params.get('tenantId');

    if (propertyId) setFilterProperty(propertyId);
    if (landlordId) setFilterLandlord(landlordId);
    if (tenantId) setFilterTenant(tenantId);
  }, [searchString]);

  // Fetch real inbox data
  const { data: inboxItems = [], isLoading } = useQuery<InboxItem[]>({
    queryKey: ['inbox'],
    queryFn: async () => {
      const res = await fetch('/api/crm/inbox');
      if (!res.ok) throw new Error('Failed to fetch inbox');
      return res.json();
    }
  });

  // Fetch properties for filter dropdown
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ['/api/properties'],
  });

  // Template dialog state
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [templateForm, setTemplateForm] = useState({
    templateName: '',
    templateType: 'email',
    subject: '',
    content: ''
  });

  // Campaign dialog state
  const [showCampaignDialog, setShowCampaignDialog] = useState(false);
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    campaignType: 'email',
    targetAudience: 'all',
    subject: '',
    content: '',
    scheduleDate: '',
    scheduleTime: ''
  });

  // Filter conversations
  const filteredConversations = inboxItems.filter(conv => {
    const matchesSearch = searchQuery === '' ||
      conv.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conv.message.toLowerCase().includes(searchQuery.toLowerCase());

    // Status filter mapping (real statuses vs filter options)
    const matchesStatus = filterStatus === 'all' || conv.status === filterStatus;

    // Channel filter
    const matchesChannel = filterChannel === 'all' || conv.source.includes(filterChannel) || conv.type === filterChannel;

    // Context filters
    // Note: We might need to enhance backend to return propertyId/tenantId to filter properly here
    // For now we assume matches if all is selected or if we implement basic string matching
    const matchesProperty = filterProperty === 'all'; // Placeholder until backend returns property context

    return matchesSearch && matchesStatus && matchesChannel && matchesProperty;
  });

  const handleSendReply = () => {
    if (!replyText.trim()) return;

    toast({
      title: 'Message sent',
      description: 'Your reply has been sent successfully.'
    });
    setReplyText('');
  };

  const handleSaveTemplate = () => {
    toast({
      title: editingTemplate ? 'Template updated' : 'Template created',
      description: `Template "${templateForm.templateName}" has been saved.`
    });
    setShowTemplateDialog(false);
    setEditingTemplate(null);
    setTemplateForm({
      templateName: '',
      templateType: 'email',
      subject: '',
      content: ''
    });
  };

  const handleCreateCampaign = () => {
    toast({
      title: 'Campaign created',
      description: `Campaign "${campaignForm.name}" has been created.`
    });
    setShowCampaignDialog(false);
    setCampaignForm({
      name: '',
      description: '',
      campaignType: 'email',
      targetAudience: 'all',
      subject: '',
      content: '',
      scheduleDate: '',
      scheduleTime: ''
    });
  };

  const openEditTemplate = (template: any) => {
    setEditingTemplate(template);
    setTemplateForm({
      templateName: template.templateName,
      templateType: template.templateType,
      subject: template.subject,
      content: template.content
    });
    setShowTemplateDialog(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/portal">
                <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <MessageSquare className="h-8 w-8 text-[#791E75] mr-3" />
              <h1 className="text-xl font-semibold">Communication Hub</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm">
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                New Message
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Unread Messages</p>
                  <p className="text-2xl font-bold">12</p>
                </div>
                <Mail className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Open Conversations</p>
                  <p className="text-2xl font-bold">28</p>
                </div>
                <MessageSquare className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Response Time</p>
                  <p className="text-2xl font-bold">2.4h</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Campaigns Sent</p>
                  <p className="text-2xl font-bold">5</p>
                </div>
                <Send className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="inbox">
              <Mail className="h-4 w-4 mr-2" />
              Inbox
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="campaigns">
              <Send className="h-4 w-4 mr-2" />
              Campaigns
            </TabsTrigger>
          </TabsList>

          {/* Inbox Tab */}
          <TabsContent value="inbox">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Conversation List */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Conversations</CardTitle>
                    <Badge variant="secondary">{filteredConversations.length}</Badge>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search conversations..."
                        className="pl-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex space-x-2">
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={filterChannel} onValueChange={setFilterChannel}>
                        <SelectTrigger className="w-[120px]">
                          <SelectValue placeholder="Channel" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Channels</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="sms">SMS</SelectItem>
                          <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Select value={filterProperty} onValueChange={setFilterProperty}>
                      <SelectTrigger className="w-full">
                        <Building2 className="h-4 w-4 mr-2" />
                        <SelectValue placeholder="Filter by Property" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Properties</SelectItem>
                        {properties.slice(0, 50).map((property: any) => (
                          <SelectItem key={property.id} value={property.title || property.addressLine1}>
                            {property.title || property.addressLine1}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y max-h-[600px] overflow-y-auto">
                    {filteredConversations.map((conversation) => (
                      <div
                        key={conversation.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 ${selectedConversation?.id === conversation.id ? 'bg-blue-50' : ''
                          }`}
                        onClick={() => setSelectedConversation(conversation)}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User className="h-4 w-4 text-gray-500" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{conversation.contactName}</p>
                              <div className="flex items-center space-x-1 text-xs text-gray-500">
                                {getChannelIcon(conversation.type)}
                                <span>{formatTimeAgo(conversation.timestamp)}</span>
                              </div>
                            </div>
                          </div>
                          {/* Unread count placeholder */}
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                          {conversation.message}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-1">
                            <Badge variant="outline" className={getStatusColor(conversation.status)}>
                              {conversation.status}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {conversation.source.replace('_', ' ')}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Conversation Detail */}
              <Card className="lg:col-span-2">
                {selectedConversation ? (
                  <>
                    <CardHeader className="border-b">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User className="h-5 w-5 text-gray-500" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{selectedConversation.contactName}</CardTitle>
                            <CardDescription>
                              {selectedConversation.contactEmail} | {selectedConversation.contactPhone}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Button variant="ghost" size="icon">
                            <Star className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <Archive className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {selectedConversation.propertyTitle && (
                        <div className="flex items-center mt-2 text-sm text-gray-600">
                          <Building2 className="h-4 w-4 mr-1" />
                          {selectedConversation.propertyTitle}
                        </div>
                      )}
                      {/* Detail View Tags Placeholder */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {selectedConversation.source}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      {/* Messages */}
                      <div className="h-[400px] overflow-y-auto p-4 space-y-4">
                        {mockMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                          >
                            <div
                              className={`max-w-[80%] p-3 rounded-lg ${message.direction === 'outbound'
                                ? 'bg-blue-500 text-white'
                                : 'bg-gray-100 text-gray-800'
                                }`}
                            >
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              <div className={`flex items-center justify-end mt-1 space-x-1 text-xs ${message.direction === 'outbound' ? 'text-blue-100' : 'text-gray-500'
                                }`}>
                                <span>{formatTimeAgo(message.sentAt)}</span>
                                {message.direction === 'outbound' && (
                                  <CheckCircle className="h-3 w-3" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Reply Box */}
                      <div className="border-t p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Button variant="ghost" size="sm">
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Smartphone className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <MessagesSquare className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex space-x-2">
                          <Textarea
                            placeholder="Type your reply..."
                            className="flex-1 resize-none"
                            rows={3}
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                          />
                        </div>
                        <div className="flex justify-end mt-2">
                          <Button onClick={handleSendReply}>
                            <Send className="h-4 w-4 mr-2" />
                            Send Reply
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <CardContent className="flex items-center justify-center h-[600px]">
                    <div className="text-center text-gray-500">
                      <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to view messages</p>
                    </div>
                  </CardContent>
                )}
              </Card>
            </div>
          </TabsContent>

          {/* Templates Tab */}
          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Communication Templates</CardTitle>
                    <CardDescription>
                      Create and manage reusable message templates for email, SMS, and WhatsApp
                    </CardDescription>
                  </div>
                  <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
                    <DialogTrigger asChild>
                      <Button onClick={() => {
                        setEditingTemplate(null);
                        setTemplateForm({
                          templateName: '',
                          templateType: 'email',
                          subject: '',
                          content: ''
                        });
                      }}>
                        <Plus className="h-4 w-4 mr-2" />
                        New Template
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>
                          {editingTemplate ? 'Edit Template' : 'Create New Template'}
                        </DialogTitle>
                        <DialogDescription>
                          Use placeholders like {'{{customer_name}}'} for dynamic content
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input
                              placeholder="e.g., Viewing Confirmation"
                              value={templateForm.templateName}
                              onChange={(e) => setTemplateForm({ ...templateForm, templateName: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Channel</Label>
                            <Select
                              value={templateForm.templateType}
                              onValueChange={(value) => setTemplateForm({ ...templateForm, templateType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {templateForm.templateType === 'email' && (
                          <div className="space-y-2">
                            <Label>Subject Line</Label>
                            <Input
                              placeholder="Email subject"
                              value={templateForm.subject}
                              onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Message Content</Label>
                          <Textarea
                            placeholder="Write your message content here..."
                            className="min-h-[200px]"
                            value={templateForm.content}
                            onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })}
                          />
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg">
                          <p className="text-sm font-medium mb-2">Available Placeholders:</p>
                          <div className="flex flex-wrap gap-2">
                            {['{{customer_name}}', '{{property_address}}', '{{viewing_date}}', '{{viewing_time}}', '{{rent_amount}}', '{{due_date}}'].map((placeholder) => (
                              <Badge key={placeholder} variant="outline" className="text-xs cursor-pointer hover:bg-gray-100">
                                {placeholder}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                          Cancel
                        </Button>
                        <Button onClick={handleSaveTemplate}>
                          {editingTemplate ? 'Update Template' : 'Create Template'}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {mockTemplates.map((template) => (
                    <Card key={template.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            {getChannelIcon(template.templateType)}
                            <span className="font-medium">{template.templateName}</span>
                          </div>
                          <Badge variant={template.isActive ? 'default' : 'secondary'}>
                            {template.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {template.subject && (
                          <p className="text-sm text-gray-600 mb-2">
                            <strong>Subject:</strong> {template.subject}
                          </p>
                        )}
                        <p className="text-sm text-gray-500 line-clamp-3 mb-3">
                          {template.content}
                        </p>
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEditTemplate(template)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Campaigns Tab */}
          <TabsContent value="campaigns">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Bulk Messaging Campaigns</CardTitle>
                    <CardDescription>
                      Create and manage bulk messaging campaigns for tenants, buyers, and landlords
                    </CardDescription>
                  </div>
                  <Dialog open={showCampaignDialog} onOpenChange={setShowCampaignDialog}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        New Campaign
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Create New Campaign</DialogTitle>
                        <DialogDescription>
                          Send bulk messages to your contacts
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Campaign Name</Label>
                            <Input
                              placeholder="e.g., December Newsletter"
                              value={campaignForm.name}
                              onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Channel</Label>
                            <Select
                              value={campaignForm.campaignType}
                              onValueChange={(value) => setCampaignForm({ ...campaignForm, campaignType: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="email">Email</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Description</Label>
                          <Input
                            placeholder="Brief description of this campaign"
                            value={campaignForm.description}
                            onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Target Audience</Label>
                          <Select
                            value={campaignForm.targetAudience}
                            onValueChange={(value) => setCampaignForm({ ...campaignForm, targetAudience: value })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Contacts</SelectItem>
                              <SelectItem value="tenants">All Tenants</SelectItem>
                              <SelectItem value="landlords">All Landlords</SelectItem>
                              <SelectItem value="buyers">Registered Buyers</SelectItem>
                              <SelectItem value="custom">Custom Selection</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {campaignForm.campaignType === 'email' && (
                          <div className="space-y-2">
                            <Label>Subject Line</Label>
                            <Input
                              placeholder="Email subject"
                              value={campaignForm.subject}
                              onChange={(e) => setCampaignForm({ ...campaignForm, subject: e.target.value })}
                            />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Message Content</Label>
                          <Textarea
                            placeholder="Write your campaign message..."
                            className="min-h-[150px]"
                            value={campaignForm.content}
                            onChange={(e) => setCampaignForm({ ...campaignForm, content: e.target.value })}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Schedule Date</Label>
                            <Input
                              type="date"
                              value={campaignForm.scheduleDate}
                              onChange={(e) => setCampaignForm({ ...campaignForm, scheduleDate: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Schedule Time</Label>
                            <Input
                              type="time"
                              value={campaignForm.scheduleTime}
                              onChange={(e) => setCampaignForm({ ...campaignForm, scheduleTime: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCampaignDialog(false)}>
                          Cancel
                        </Button>
                        <Button variant="outline">
                          Save as Draft
                        </Button>
                        <Button onClick={handleCreateCampaign}>
                          Create Campaign
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="text-left p-4 font-medium">Campaign</th>
                        <th className="text-left p-4 font-medium">Type</th>
                        <th className="text-left p-4 font-medium">Status</th>
                        <th className="text-left p-4 font-medium">Recipients</th>
                        <th className="text-left p-4 font-medium">Performance</th>
                        <th className="text-left p-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockCampaigns.map((campaign) => (
                        <tr key={campaign.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <div>
                              <p className="font-medium">{campaign.name}</p>
                              <p className="text-sm text-gray-500">{campaign.description}</p>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-2">
                              {getChannelIcon(campaign.campaignType)}
                              <span className="capitalize">{campaign.campaignType}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <Badge className={
                              campaign.status === 'sent' ? 'bg-green-100 text-green-800' :
                                campaign.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                                  'bg-gray-100 text-gray-800'
                            }>
                              {campaign.status}
                            </Badge>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center space-x-1">
                              <Users className="h-4 w-4 text-gray-400" />
                              <span>{campaign.recipientCount}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            {campaign.status === 'sent' ? (
                              <div className="text-sm">
                                <p>
                                  <span className="text-green-600">{campaign.openedCount}</span> opened
                                  ({Math.round((campaign.openedCount / campaign.sentCount) * 100)}%)
                                </p>
                                <p>
                                  <span className="text-blue-600">{campaign.clickedCount}</span> clicked
                                  ({Math.round((campaign.clickedCount / campaign.sentCount) * 100)}%)
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="p-4">
                            <div className="flex space-x-2">
                              <Button variant="ghost" size="sm">
                                <Eye className="h-4 w-4" />
                              </Button>
                              {campaign.status === 'draft' && (
                                <>
                                  <Button variant="ghost" size="sm">
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm">
                                    <Send className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              {campaign.status === 'sent' && (
                                <Button variant="ghost" size="sm">
                                  <BarChart3 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
