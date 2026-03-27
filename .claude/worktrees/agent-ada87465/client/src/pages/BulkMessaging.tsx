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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Loader2, Plus, Send, Mail, MessageSquare, Phone, Users,
  AlertCircle, Megaphone, UserPlus,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Campaign {
  id: number;
  name: string;
  description?: string;
  campaignType: string;
  templateId?: number;
  status: string;
  recipientCount?: number;
  sentCount?: number;
  createdAt?: string;
  updatedAt?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const statusBadgeConfig: Record<string, { label: string; className: string }> = {
  draft:       { label: 'Draft',       className: 'bg-gray-100 text-gray-800 border-gray-300' },
  scheduled:   { label: 'Scheduled',   className: 'bg-blue-100 text-blue-800 border-blue-300' },
  in_progress: { label: 'In Progress', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  sent:        { label: 'Sent',        className: 'bg-green-100 text-green-800 border-green-300' },
  failed:      { label: 'Failed',      className: 'bg-red-100 text-red-800 border-red-300' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusBadgeConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800 border-gray-300' };
  return <Badge className={`${cfg.className} border`}>{cfg.label}</Badge>;
}

function CampaignTypeIcon({ type }: { type: string }) {
  switch (type) {
    case 'email':
      return <Mail className="h-4 w-4 text-blue-600" />;
    case 'sms':
      return <MessageSquare className="h-4 w-4 text-green-600" />;
    case 'whatsapp':
      return <Phone className="h-4 w-4 text-emerald-600" />;
    default:
      return <Send className="h-4 w-4 text-gray-600" />;
  }
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function BulkMessaging() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddRecipientsDialog, setShowAddRecipientsDialog] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);

  // Campaign form state
  const [campaignForm, setCampaignForm] = useState({
    name: '',
    description: '',
    campaignType: '',
    templateId: '',
  });

  // Recipient form state
  const [recipientForm, setRecipientForm] = useState({
    recipientType: '',
    email: '',
    phone: '',
    name: '',
  });

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: campaigns = [], isLoading, isError } = useQuery<Campaign[]>({
    queryKey: ['/api/crm/campaigns-list'],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createCampaignMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      description?: string;
      campaignType: string;
      templateId?: number;
    }) => {
      return apiRequest('/api/crm/campaigns-create', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/campaigns-list'] });
      toast({ title: 'Campaign created', description: 'The campaign has been created as a draft.' });
      setShowCreateDialog(false);
      resetCampaignForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const addRecipientsMutation = useMutation({
    mutationFn: async ({ campaignId, data }: {
      campaignId: number;
      data: { recipientType: string; email?: string; phone?: string; name?: string };
    }) => {
      return apiRequest(`/api/crm/campaigns/${campaignId}/recipients`, 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/campaigns-list'] });
      toast({ title: 'Recipient added', description: 'The recipient has been added to the campaign.' });
      setShowAddRecipientsDialog(false);
      resetRecipientForm();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function resetCampaignForm() {
    setCampaignForm({ name: '', description: '', campaignType: '', templateId: '' });
  }

  function resetRecipientForm() {
    setRecipientForm({ recipientType: '', email: '', phone: '', name: '' });
  }

  function handleCreateCampaign() {
    if (!campaignForm.name.trim() || !campaignForm.campaignType) {
      toast({ title: 'Validation error', description: 'Please provide a name and campaign type.', variant: 'destructive' });
      return;
    }

    createCampaignMutation.mutate({
      name: campaignForm.name.trim(),
      description: campaignForm.description.trim() || undefined,
      campaignType: campaignForm.campaignType,
      templateId: campaignForm.templateId ? parseInt(campaignForm.templateId, 10) : undefined,
    });
  }

  function handleAddRecipient() {
    if (!recipientForm.recipientType) {
      toast({ title: 'Validation error', description: 'Please select a recipient type.', variant: 'destructive' });
      return;
    }
    if (!selectedCampaignId) return;

    addRecipientsMutation.mutate({
      campaignId: selectedCampaignId,
      data: {
        recipientType: recipientForm.recipientType,
        email: recipientForm.email.trim() || undefined,
        phone: recipientForm.phone.trim() || undefined,
        name: recipientForm.name.trim() || undefined,
      },
    });
  }

  function openAddRecipients(campaignId: number) {
    setSelectedCampaignId(campaignId);
    setShowAddRecipientsDialog(true);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bulk Messaging</h1>
          <p className="text-muted-foreground">Create and manage email, SMS, and WhatsApp campaigns</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Campaign
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gray-100">
                <Megaphone className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Campaigns</p>
                <p className="text-2xl font-bold">{campaigns.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Mail className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.campaignType === 'email').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <MessageSquare className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">SMS</p>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.campaignType === 'sms').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <Phone className="h-5 w-5 text-emerald-700" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">WhatsApp</p>
                <p className="text-2xl font-bold">{campaigns.filter(c => c.campaignType === 'whatsapp').length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Campaigns Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Campaigns
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
              Failed to load campaigns
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Megaphone className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No campaigns yet</p>
              <p className="text-sm">Create a campaign to start sending bulk messages.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Recipients</TableHead>
                  <TableHead>Sent Count</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell className="font-medium">{campaign.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <CampaignTypeIcon type={campaign.campaignType} />
                        <span className="capitalize">{campaign.campaignType}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {campaign.recipientCount ?? 0}
                      </div>
                    </TableCell>
                    <TableCell>{campaign.sentCount ?? 0}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAddRecipients(campaign.id)}
                      >
                        <UserPlus className="h-3 w-3 mr-1" />
                        Add Recipients
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create Campaign</DialogTitle>
            <DialogDescription>
              Set up a new bulk messaging campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaignName">Campaign Name</Label>
              <Input
                id="campaignName"
                placeholder="e.g. March Rent Reminder"
                value={campaignForm.name}
                onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignDescription">Description</Label>
              <Textarea
                id="campaignDescription"
                placeholder="Optional campaign description..."
                value={campaignForm.description}
                onChange={(e) => setCampaignForm({ ...campaignForm, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="campaignType">Campaign Type</Label>
              <Select
                value={campaignForm.campaignType}
                onValueChange={(value) => setCampaignForm({ ...campaignForm, campaignType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email
                    </div>
                  </SelectItem>
                  <SelectItem value="sms">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      SMS
                    </div>
                  </SelectItem>
                  <SelectItem value="whatsapp">
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      WhatsApp
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateId">Template ID (optional)</Label>
              <Input
                id="templateId"
                type="number"
                placeholder="e.g. 5"
                value={campaignForm.templateId}
                onChange={(e) => setCampaignForm({ ...campaignForm, templateId: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCampaign} disabled={createCampaignMutation.isPending}>
              {createCampaignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Recipients Dialog */}
      <Dialog open={showAddRecipientsDialog} onOpenChange={setShowAddRecipientsDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Add Recipient</DialogTitle>
            <DialogDescription>
              Add a recipient to the campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipientType">Recipient Type</Label>
              <Select
                value={recipientForm.recipientType}
                onValueChange={(value) => setRecipientForm({ ...recipientForm, recipientType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="vendor">Vendor</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientName">Name</Label>
              <Input
                id="recipientName"
                placeholder="Recipient name"
                value={recipientForm.name}
                onChange={(e) => setRecipientForm({ ...recipientForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientEmail">Email</Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder="email@example.com"
                value={recipientForm.email}
                onChange={(e) => setRecipientForm({ ...recipientForm, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="recipientPhone">Phone</Label>
              <Input
                id="recipientPhone"
                type="tel"
                placeholder="+44..."
                value={recipientForm.phone}
                onChange={(e) => setRecipientForm({ ...recipientForm, phone: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddRecipientsDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddRecipient} disabled={addRecipientsMutation.isPending}>
              {addRecipientsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Recipient
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
