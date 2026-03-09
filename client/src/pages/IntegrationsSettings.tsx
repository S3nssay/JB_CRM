import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, FEATURE_CLEARANCE } from '@/hooks/use-permissions';
import { ClearanceBadge } from '@/components/ProtectedRoute';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Brain, MessageSquare, Phone, Building2, Globe, Megaphone,
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff,
  Save, TestTube, Loader2, Shield, Lock, ArrowLeft,
  CreditCard, Banknote, Mail, MapPin, FileSignature, Settings,
  MessageCircle, Facebook, Linkedin, Twitter,
  Inbox, Trash2, RefreshCw, Plus, Pencil
} from 'lucide-react';

interface EnvVariable {
  key: string;
  label: string;
  secret: boolean;
}

interface EnvSection {
  title: string;
  variables: EnvVariable[];
}

interface EnvSettings {
  sections: Record<string, EnvSection>;
  values: Record<string, string>;
  configured: Record<string, boolean>;
}

// Section icons and descriptions
const SECTION_CONFIG: Record<string, { icon: any; description: string; color: string }> = {
  ai: {
    icon: Brain,
    description: 'OpenAI, Gemini, Claude and other AI API keys',
    color: 'text-purple-600'
  },
  twilio: {
    icon: Phone,
    description: 'SMS and Voice call capabilities via Twilio',
    color: 'text-blue-600'
  },
  whatsapp: {
    icon: MessageCircle,
    description: 'WhatsApp Business API for messaging and chatbot',
    color: 'text-green-600'
  },
  social: {
    icon: Globe,
    description: 'Facebook, Instagram, LinkedIn, Twitter/X credentials',
    color: 'text-pink-600'
  },
  portals: {
    icon: Building2,
    description: 'Zoopla, Rightmove, OnTheMarket, PrimeLocation',
    color: 'text-orange-600'
  },
  advertisers: {
    icon: Megaphone,
    description: 'Google Ads, Meta Ads, Taboola, Outbrain',
    color: 'text-red-600'
  },
  payments: {
    icon: CreditCard,
    description: 'Stripe payment processing credentials',
    color: 'text-indigo-600'
  },
  gocardless: {
    icon: Banknote,
    description: 'GoCardless Direct Debit for recurring rent collection',
    color: 'text-emerald-600'
  },
  documents: {
    icon: FileSignature,
    description: 'DocuSign electronic signature integration',
    color: 'text-yellow-600'
  },
  maps: {
    icon: MapPin,
    description: 'Google Maps and address lookup APIs',
    color: 'text-teal-600'
  },
  email: {
    icon: Mail,
    description: 'SMTP/IMAP email service configuration',
    color: 'text-cyan-600'
  },
  general: {
    icon: Settings,
    description: 'Base URL and encryption settings',
    color: 'text-gray-600'
  },
  mailboxes: {
    icon: Inbox,
    description: 'Department email inboxes (Sales, Lettings, Maintenance)',
    color: 'text-violet-600'
  }
};

export default function IntegrationsSettings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [testingSection, setTestingSection] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('mailboxes');

  // Use proper permissions hook for auth check
  const { user, isLoading: authLoading, hasMinClearance, getClearanceLabel } = usePermissions();
  const requiredClearance = FEATURE_CLEARANCE.integrations; // Level 9 (Branch Manager+)

  // Check authorization based on security clearance
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLocation('/crm/login');
      return;
    }

    if (!hasMinClearance(requiredClearance)) {
      toast({
        title: 'Access Denied',
        description: `Integrations requires Management level clearance (Level 9). Your current level: ${getClearanceLabel()}.`,
        variant: 'destructive'
      });
      setLocation('/crm/dashboard');
    }
  }, [authLoading, user, hasMinClearance, requiredClearance, toast, setLocation, getClearanceLabel]);

  // Fetch environment settings
  const { data: envSettings, isLoading } = useQuery<EnvSettings>({
    queryKey: ['/api/crm/env-settings'],
    queryFn: async () => {
      const res = await fetch('/api/crm/env-settings', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    }
  });

  // Initialize form values when data loads
  useEffect(() => {
    if (envSettings?.values) {
      setFormValues(envSettings.values);
    }
  }, [envSettings]);

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async (values: Record<string, string>) => {
      const res = await fetch('/api/crm/env-settings', {
        credentials: 'include',
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values })
      });
      if (!res.ok) throw new Error('Failed to save settings');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/env-settings'] });
      toast({
        title: 'Settings Saved',
        description: data.message || 'Your integration settings have been saved.'
      });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Test section mutation - auto-saves before testing
  const testMutation = useMutation({
    mutationFn: async (section: string) => {
      setTestingSection(section);
      // Auto-save current form values first so the test picks them up
      if (hasChanges) {
        const saveRes = await fetch('/api/crm/env-settings', {
          credentials: 'include',
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ values: formValues })
        });
        if (saveRes.ok) {
          setHasChanges(false);
          queryClient.invalidateQueries({ queryKey: ['/api/crm/env-settings'] });
        }
      }
      const res = await fetch(`/api/crm/env-settings/test/${section}`, {
        credentials: 'include',
        method: 'POST'
      });
      if (!res.ok) throw new Error('Test failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.success ? 'Connection Successful' : 'Connection Failed',
        description: data.message,
        variant: data.success ? 'default' : 'destructive'
      });
      setTestingSection(null);
    },
    onError: () => {
      toast({
        title: 'Test Failed',
        description: 'Could not test the integration.',
        variant: 'destructive'
      });
      setTestingSection(null);
    }
  });

  // ---- Department Mailboxes ----
  interface SystemMailbox {
    id: number;
    provider: string;
    mailboxUpn: string;
    mailboxCategory: string;
    mailboxDisplayName: string;
    status: string;
    lastSyncAt: string | null;
    errorCount: number;
    lastError: string | null;
    syncEnabled: boolean;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
  }

  interface MailboxForm {
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    imapHost: string;
    imapPort: number;
    imapUser: string;
    imapPassword: string;
    displayName: string;
  }

  const MAILBOX_DEFAULTS: Record<string, { email: string; displayName: string; color: string; description: string }> = {
    sales: {
      email: 'sales@johnbarclay.uk',
      displayName: 'Sales Enquiries',
      color: 'text-blue-600',
      description: 'Property enquiries, viewing requests, offers',
    },
    lettings: {
      email: 'lettings@johnbarclay.uk',
      displayName: 'Lettings Enquiries',
      color: 'text-purple-600',
      description: 'Rental enquiries, viewing requests, landlord comms',
    },
    maintenance: {
      email: 'maintenance@johnbarclay.uk',
      displayName: 'Maintenance Requests',
      color: 'text-orange-600',
      description: 'Repair requests, contractor responses',
    },
    admin: {
      email: 'admin@johnbarclay.uk',
      displayName: 'Admin / General',
      color: 'text-gray-600',
      description: 'General enquiries, admin correspondence',
    },
  };

  const [mailboxDialog, setMailboxDialog] = useState<string | null>(null);
  const [isEditingMailbox, setIsEditingMailbox] = useState(false); // category being configured
  const [mailboxForm, setMailboxForm] = useState<MailboxForm>({
    smtpHost: 'mail.johnbarclay.uk',
    smtpPort: 465,
    smtpUser: '',
    smtpPassword: '',
    imapHost: 'mail.johnbarclay.uk',
    imapPort: 993,
    imapUser: '',
    imapPassword: '',
    displayName: '',
  });
  const [showMailboxPassword, setShowMailboxPassword] = useState(false);
  const [syncingCategory, setSyncingCategory] = useState<string | null>(null);

  const { data: systemMailboxes = [], isLoading: mailboxesLoading } = useQuery<SystemMailbox[]>({
    queryKey: ['/api/email-integration/system-mailboxes'],
    queryFn: async () => {
      const res = await fetch('/api/email-integration/system-mailboxes', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const createMailboxMutation = useMutation({
    mutationFn: async ({ category, form }: { category: string; form: MailboxForm }) => {
      const res = await fetch('/api/email-integration/system-mailbox', {
        credentials: 'include',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: form.smtpPort,
          smtpUser: form.smtpUser,
          smtpPassword: form.smtpPassword,
          smtpSecure: true,
          imapHost: form.imapHost,
          imapPort: form.imapPort,
          imapUser: form.imapUser,
          imapPassword: form.imapPassword,
          imapTls: true,
          category,
          displayName: form.displayName,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const err = JSON.parse(text);
          throw new Error(err.error || 'Failed to create mailbox');
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
            throw new Error(`Server error (${res.status})`);
          }
          throw parseErr;
        }
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration/system-mailboxes'] });
      toast({ title: 'Mailbox Connected', description: `${data.category} mailbox is now active (${data.mailboxUpn})` });
      setMailboxDialog(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Connection Failed', description: error.message, variant: 'destructive' });
    },
  });


  const updateMailboxMutation = useMutation({
    mutationFn: async ({ category, form }: { category: string; form: MailboxForm }) => {
      const res = await fetch(`/api/email-integration/system-mailbox/${category}`, {
        credentials: 'include',
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          smtpHost: form.smtpHost,
          smtpPort: form.smtpPort,
          smtpUser: form.smtpUser,
          smtpPassword: form.smtpPassword,
          smtpSecure: true,
          imapHost: form.imapHost,
          imapPort: form.imapPort,
          imapUser: form.imapUser,
          imapPassword: form.imapPassword,
          imapTls: true,
          displayName: form.displayName,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        try {
          const err = JSON.parse(text);
          throw new Error(err.error || 'Failed to update mailbox');
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
            throw new Error(`Server error (${res.status})`);
          }
          throw parseErr;
        }
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration/system-mailboxes'] });
      toast({ title: 'Mailbox Updated', description: `${data.category} mailbox credentials updated (${data.mailboxUpn})` });
      setMailboxDialog(null);
      setIsEditingMailbox(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    },
  });

  const deleteMailboxMutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await fetch(`/api/email-integration/system-mailbox/${category}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete mailbox');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration/system-mailboxes'] });
      toast({ title: 'Mailbox Removed', description: 'Department mailbox has been disconnected.' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const syncMailboxMutation = useMutation({
    mutationFn: async (category: string) => {
      setSyncingCategory(category);
      const res = await fetch(`/api/email-integration/system-mailboxes/${category}/sync`, { method: 'POST', credentials: 'include' });
      if (!res.ok) throw new Error('Sync failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/email-integration/system-mailboxes'] });
      toast({ title: 'Sync Complete', description: `Fetched ${data.newEmails || 0} new emails.` });
      setSyncingCategory(null);
    },
    onError: () => {
      toast({ title: 'Sync Failed', description: 'Could not sync mailbox.', variant: 'destructive' });
      setSyncingCategory(null);
    },
  });

  const openMailboxSetup = (category: string) => {
    const defaults = MAILBOX_DEFAULTS[category];
    setMailboxForm({
      smtpHost: 'mail.johnbarclay.uk',
      smtpPort: 465,
      smtpUser: defaults.email,
      smtpPassword: '',
      imapHost: 'mail.johnbarclay.uk',
      imapPort: 993,
      imapUser: defaults.email,
      imapPassword: '',
      displayName: defaults.displayName,
    });
    setShowMailboxPassword(false);
    setIsEditingMailbox(false);
    setMailboxDialog(category);
  };

  const openMailboxEdit = (category: string) => {
    const mailbox = getMailbox(category);
    const defaults = MAILBOX_DEFAULTS[category];
    setMailboxForm({
      smtpHost: mailbox?.smtpHost || 'mail.johnbarclay.uk',
      smtpPort: mailbox?.smtpPort || 465,
      smtpUser: mailbox?.mailboxUpn || defaults.email,
      smtpPassword: '', // Must re-enter password
      imapHost: mailbox?.imapHost || 'mail.johnbarclay.uk',
      imapPort: mailbox?.imapPort || 993,
      imapUser: mailbox?.mailboxUpn || defaults.email,
      imapPassword: '', // Must re-enter password
      displayName: mailbox?.mailboxDisplayName || defaults.displayName,
    });
    setShowMailboxPassword(false);
    setIsEditingMailbox(true);
    setMailboxDialog(category);
  };


  const getMailbox = (category: string) => systemMailboxes.find((m) => m.mailboxCategory === category);

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleInputChange = (key: string, value: string) => {
    setFormValues(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(formValues);
  };

  const getSectionStatus = (sectionKey: string): 'connected' | 'partial' | 'disconnected' => {
    if (!envSettings?.configured || !envSettings?.sections) return 'disconnected';

    const section = envSettings.sections[sectionKey];
    if (!section) return 'disconnected';

    const configuredCount = section.variables.filter(v => envSettings.configured[v.key]).length;
    const totalCount = section.variables.length;

    if (configuredCount === 0) return 'disconnected';
    if (configuredCount === totalCount) return 'connected';
    return 'partial';
  };

  const getStatusBadge = (status: 'connected' | 'partial' | 'disconnected') => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Connected</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" /> Partial</Badge>;
      case 'disconnected':
        return <Badge variant="outline" className="text-gray-500"><XCircle className="h-3 w-3 mr-1" /> Not Connected</Badge>;
    }
  };

  const renderVariableField = (variable: EnvVariable) => {
    const isHidden = variable.secret && !showSecrets[variable.key];
    const value = formValues[variable.key] || '';
    const isConfigured = envSettings?.configured?.[variable.key];

    return (
      <div key={variable.key} className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={variable.key} className="text-sm font-medium">
            {variable.label}
          </Label>
          {isConfigured && (
            <Badge variant="outline" className="text-xs text-green-600 border-green-200">
              Configured
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Input
            id={variable.key}
            type={isHidden ? 'password' : 'text'}
            value={value}
            onChange={(e) => handleInputChange(variable.key, e.target.value)}
            placeholder={variable.secret ? '••••••••' : `Enter ${variable.label}`}
            className="flex-1 font-mono text-sm"
          />
          {variable.secret && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleSecret(variable.key)}
              type="button"
            >
              {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderSection = (sectionKey: string, section: EnvSection) => {
    const config = SECTION_CONFIG[sectionKey] || {
      icon: Settings,
      description: section.title,
      color: 'text-gray-600'
    };
    const Icon = config.icon;
    const status = getSectionStatus(sectionKey);
    const isTesting = testingSection === sectionKey;

    return (
      <Card key={sectionKey}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gray-100 ${config.color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg">{section.title}</CardTitle>
                <CardDescription className="text-sm">
                  {config.description}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(status)}
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMutation.mutate(sectionKey)}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-1" />
                )}
                Test
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.variables.map(variable => renderVariableField(variable))}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Show loading while checking auth or fetching data
  if (authLoading || isLoading || !user || !hasMinClearance(requiredClearance)) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  const sections = envSettings?.sections || {};

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="h-6 w-6 text-[#791E75]" />
                Integration Settings
              </h1>
              <p className="text-gray-500">Configure API keys and credentials for external services</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ClearanceBadge />
            <Badge className="bg-[#791E75] text-white">
              <Lock className="h-3 w-3 mr-1" /> Management Access
            </Badge>
            {hasChanges && (
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="bg-[#791E75] hover:bg-[#60175d]"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status Overview */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {/* Mailboxes quick-access card */}
            <button
              onClick={() => setActiveTab('mailboxes')}
              className={`text-center p-3 rounded-lg transition-colors ${
                activeTab === 'mailboxes' ? 'bg-[#791E75]/10 ring-2 ring-[#791E75]' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <Inbox className="h-6 w-6 mx-auto mb-2 text-violet-600" />
              <p className="text-sm font-medium truncate">Mailboxes</p>
              <div className="mt-1">
                {systemMailboxes.length === 3 ? (
                  <span className="text-xs text-green-600">All Connected</span>
                ) : systemMailboxes.length > 0 ? (
                  <span className="text-xs text-yellow-600">{systemMailboxes.length}/3</span>
                ) : (
                  <span className="text-xs text-gray-400">Not Set</span>
                )}
              </div>
            </button>
            {Object.entries(sections).slice(0, 6).map(([key, section]) => {
              const config = SECTION_CONFIG[key];
              if (!config) return null;
              const Icon = config.icon;
              const status = getSectionStatus(key);

              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`text-center p-3 rounded-lg transition-colors ${
                    activeTab === key ? 'bg-[#791E75]/10 ring-2 ring-[#791E75]' : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <Icon className={`h-6 w-6 mx-auto mb-2 ${config.color}`} />
                  <p className="text-sm font-medium truncate">{section.title}</p>
                  <div className="mt-1">
                    {status === 'connected' && (
                      <span className="text-xs text-green-600">Connected</span>
                    )}
                    {status === 'partial' && (
                      <span className="text-xs text-yellow-600">Partial</span>
                    )}
                    {status === 'disconnected' && (
                      <span className="text-xs text-gray-400">Not Set</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for all sections */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          {/* Department Mailboxes tab first */}
          <TabsTrigger value="mailboxes" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            <span className="hidden sm:inline">Dept Mailboxes</span>
          </TabsTrigger>
          {Object.entries(sections).map(([key, section]) => {
            const config = SECTION_CONFIG[key];
            if (!config) return null;
            const Icon = config.icon;

            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{section.title}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Department Mailboxes Tab Content */}
        <TabsContent value="mailboxes" className="space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-100 text-violet-600">
                    <Inbox className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Department Email Inboxes</CardTitle>
                    <CardDescription>
                      Configure shared email inboxes for Sales, Lettings, and Maintenance departments.
                      Each inbox is monitored by AI for auto-routing and ticket creation.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(['sales', 'lettings', 'maintenance', 'admin'] as const).map((category) => {
                  const defaults = MAILBOX_DEFAULTS[category];
                  const mailbox = getMailbox(category);
                  const isConnected = mailbox && mailbox.status === 'active';
                  const hasError = mailbox && mailbox.errorCount > 0;

                  return (
                    <div
                      key={category}
                      className={`border rounded-lg p-4 ${
                        isConnected
                          ? hasError
                            ? 'border-yellow-300 bg-yellow-50'
                            : 'border-green-300 bg-green-50'
                          : 'border-gray-200 bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Mail className={`h-5 w-5 ${defaults.color}`} />
                          <div>
                            <h4 className="font-medium capitalize">{category} Inbox</h4>
                            <p className="text-sm text-gray-500">{defaults.email} — {defaults.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {isConnected ? (
                            <>
                              {hasError ? (
                                <Badge className="bg-yellow-100 text-yellow-800">
                                  <AlertCircle className="h-3 w-3 mr-1" />
                                  Errors ({mailbox.errorCount})
                                </Badge>
                              ) : (
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Connected
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openMailboxEdit(category)}
                                title="Edit mailbox settings"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => syncMailboxMutation.mutate(category)}
                                disabled={syncingCategory === category}
                              >
                                {syncingCategory === category ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  if (confirm(`Remove ${category} mailbox? This will disconnect ${defaults.email}.`)) {
                                    deleteMailboxMutation.mutate(category);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Badge variant="outline" className="text-gray-500">
                                <XCircle className="h-3 w-3 mr-1" />
                                Not Configured
                              </Badge>
                              <Button
                                size="sm"
                                className="bg-[#791E75] hover:bg-[#60175d]"
                                onClick={() => openMailboxSetup(category)}
                              >
                                <Plus className="h-4 w-4 mr-1" />
                                Connect
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      {isConnected && mailbox.lastSyncAt && (
                        <p className="text-xs text-gray-500 mt-2">
                          Last synced: {new Date(mailbox.lastSyncAt).toLocaleString()}
                          {mailbox.lastError && (
                            <span className="text-yellow-700 ml-2">Last error: {mailbox.lastError}</span>
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Server info */}
          <Card className="bg-violet-50 border-violet-200">
            <CardContent className="pt-4">
              <h4 className="font-medium text-violet-900 mb-2">Email Server Configuration</h4>
              <ul className="text-sm text-violet-800 space-y-1">
                <li>Server: <span className="font-mono">mail.johnbarclay.uk</span></li>
                <li>IMAP: Port 993 (SSL/TLS)</li>
                <li>SMTP: Port 465 (SSL/TLS)</li>
                <li>AI monitoring is automatic — emails are analysed for routing, ticket creation, and auto-replies.</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mailbox Setup Dialog */}
        <Dialog open={!!mailboxDialog} onOpenChange={(open) => !open && setMailboxDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="capitalize">
                {isEditingMailbox ? 'Edit' : 'Connect'} {mailboxDialog} Mailbox
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input
                  value={mailboxForm.displayName}
                  onChange={(e) => setMailboxForm((f) => ({ ...f, displayName: e.target.value }))}
                  placeholder="e.g. Sales Enquiries"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input
                    value={mailboxForm.smtpHost}
                    onChange={(e) => setMailboxForm((f) => ({ ...f, smtpHost: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input
                    type="number"
                    value={mailboxForm.smtpPort}
                    onChange={(e) => setMailboxForm((f) => ({ ...f, smtpPort: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Email Address (SMTP & IMAP Username)</Label>
                <Input
                  value={mailboxForm.smtpUser}
                  onChange={(e) =>
                    setMailboxForm((f) => ({
                      ...f,
                      smtpUser: e.target.value,
                      imapUser: e.target.value,
                    }))
                  }
                  placeholder="sales@johnbarclay.uk"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Password</Label>
                <div className="flex gap-2">
                  <Input
                    type={showMailboxPassword ? 'text' : 'password'}
                    value={mailboxForm.smtpPassword}
                    onChange={(e) =>
                      setMailboxForm((f) => ({
                        ...f,
                        smtpPassword: e.target.value,
                        imapPassword: e.target.value,
                      }))
                    }
                    placeholder="••••••••"
                    className="flex-1 font-mono text-sm"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setShowMailboxPassword(!showMailboxPassword)}
                  >
                    {showMailboxPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>IMAP Host</Label>
                  <Input
                    value={mailboxForm.imapHost}
                    onChange={(e) => setMailboxForm((f) => ({ ...f, imapHost: e.target.value }))}
                    className="font-mono text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label>IMAP Port</Label>
                  <Input
                    type="number"
                    value={mailboxForm.imapPort}
                    onChange={(e) => setMailboxForm((f) => ({ ...f, imapPort: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500">
                {isEditingMailbox ? "Re-enter the password to update credentials. The connection will be tested before saving." : "The connection will be tested before saving. SMTP and IMAP use the same credentials by default."}
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMailboxDialog(null)}>
                Cancel
              </Button>
              <Button
                className="bg-[#791E75] hover:bg-[#60175d]"
                disabled={(isEditingMailbox ? updateMailboxMutation.isPending : createMailboxMutation.isPending) || !mailboxForm.smtpUser || !mailboxForm.smtpPassword}
                onClick={() => {
                  if (mailboxDialog) {
                    if (isEditingMailbox) {
                      updateMailboxMutation.mutate({ category: mailboxDialog, form: mailboxForm });
                    } else {
                      createMailboxMutation.mutate({ category: mailboxDialog, form: mailboxForm });
                    }
                  }
                }}
              >
                {(isEditingMailbox ? updateMailboxMutation.isPending : createMailboxMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-2" />
                )}
                {isEditingMailbox ? 'Test & Save' : 'Test & Connect'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {Object.entries(sections).map(([key, section]) => (
          <TabsContent key={key} value={key} className="space-y-4">
            {renderSection(key, section)}

            {/* Section-specific help text */}
            {key === 'twilio' && (
              <Card className="bg-blue-50 border-blue-200">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-blue-900 mb-2">Twilio Setup Guide</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>1. Create a Twilio account at twilio.com</li>
                    <li>2. Get your Account SID and Auth Token from the Console Dashboard</li>
                    <li>3. Purchase a phone number with SMS and Voice capabilities</li>
                    <li>4. Configure webhook URLs to point to your server endpoints</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {key === 'whatsapp' && (
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-green-900 mb-2">WhatsApp Business Setup</h4>
                  <ul className="text-sm text-green-800 space-y-1">
                    <li>1. You can use Twilio for WhatsApp (simpler) or Meta Business directly</li>
                    <li>2. For Twilio: Enable WhatsApp sandbox in the Twilio Console</li>
                    <li>3. For Meta: Create a Meta Business account and WhatsApp Business app</li>
                    <li>4. Set up webhook URL for receiving messages and status updates</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {key === 'portals' && (
              <Card className="bg-orange-50 border-orange-200">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-orange-900 mb-2">Property Portal Integration</h4>
                  <ul className="text-sm text-orange-800 space-y-1">
                    <li>1. Contact each portal for API access (Zoopla, Rightmove, etc.)</li>
                    <li>2. Zoopla requires a ZooplaPro Software account for API access</li>
                    <li>3. Rightmove uses the Real Time Datafeed (RTDF) system</li>
                    <li>4. If no API is available, browser automation can be used with login credentials</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {key === 'social' && (
              <Card className="bg-pink-50 border-pink-200">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-pink-900 mb-2">Social Media Integration</h4>
                  <ul className="text-sm text-pink-800 space-y-1">
                    <li>1. Facebook/Instagram: Create a Meta Developer App</li>
                    <li>2. LinkedIn: Register your app in the LinkedIn Developer Portal</li>
                    <li>3. Twitter/X: Apply for developer access and create an app</li>
                    <li>4. Each platform has different OAuth flows and token requirements</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {key === 'advertisers' && (
              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-red-900 mb-2">Advertising Platforms</h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>1. Google Ads: Apply for API access in your Google Ads account</li>
                    <li>2. Meta Ads: Use the same credentials as Facebook integration</li>
                    <li>3. Taboola/Outbrain: Contact their partner teams for API access</li>
                    <li>4. Most platforms require OAuth authentication for full access</li>
                  </ul>
                </CardContent>
              </Card>
            )}

            {key === 'gocardless' && (
              <Card className="bg-emerald-50 border-emerald-200">
                <CardContent className="pt-4">
                  <h4 className="font-medium text-emerald-900 mb-2">GoCardless Direct Debit Setup</h4>
                  <ul className="text-sm text-emerald-800 space-y-1">
                    <li>1. Create a GoCardless account at gocardless.com</li>
                    <li>2. Go to Developers &gt; API Keys and create an access token</li>
                    <li>3. Use "sandbox" environment for testing, "live" for production</li>
                    <li>4. Set up a webhook endpoint pointing to your server's /api/crm/gocardless/webhooks URL</li>
                    <li>5. Copy the webhook secret from GoCardless dashboard</li>
                  </ul>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Floating Save Button for Mobile */}
      {hasChanges && (
        <div className="fixed bottom-4 right-4 md:hidden">
          <Button
            onClick={handleSave}
            disabled={saveMutation.isPending}
            size="lg"
            className="bg-[#791E75] hover:bg-[#60175d] shadow-lg"
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}

      {/* Help Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Security Notes</h4>
              <p className="text-sm text-gray-500">
                All API keys and secrets are stored securely in the server's .env file.
                Sensitive values are masked in the UI and never exposed to the client.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Restart Required</h4>
              <p className="text-sm text-gray-500">
                Some changes may require a server restart to take full effect.
                The server attempts to apply changes immediately where possible.
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Testing Connections</h4>
              <p className="text-sm text-gray-500">
                Use the "Test" button on each section to verify your credentials
                are working correctly before going live.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
