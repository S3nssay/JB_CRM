import { useState, useEffect } from 'react';
import { useLocation, Link } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Mail, MessageSquare, Phone, FileSignature, CreditCard,
  Facebook, Instagram, Linkedin, Twitter, Building2, Globe,
  CheckCircle, XCircle, AlertCircle, RefreshCw, Eye, EyeOff,
  Save, TestTube, Settings, Key, Link2, Webhook, Loader2,
  Search, Target, TrendingUp, Calendar, Users, Gavel, Home,
  FileText, Brain, Play, Pause, Shield, Lock, ArrowLeft
} from 'lucide-react';

interface IntegrationConfig {
  id: string;
  name: string;
  category: string;
  status: 'connected' | 'disconnected' | 'error' | 'partial';
  lastTested?: string;
  credentials: Record<string, string>;
  settings: Record<string, any>;
}

// Integration categories and their configurations
const INTEGRATION_CATEGORIES = {
  communication: {
    title: 'Communication',
    description: 'Email, SMS, WhatsApp, and Voice integrations',
    icon: MessageSquare
  },
  contracts: {
    title: 'Contracts & Documents',
    description: 'E-signature and document management',
    icon: FileSignature
  },
  payments: {
    title: 'Payments',
    description: 'Payment processing and invoicing',
    icon: CreditCard
  },
  social: {
    title: 'Social Media',
    description: 'Social media platforms for marketing',
    icon: Globe
  },
  portals: {
    title: 'Property Portals',
    description: 'Zoopla, Rightmove, and other listing sites',
    icon: Building2
  },
  leadgen: {
    title: 'Lead Generation',
    description: 'Proactive lead discovery and monitoring services',
    icon: Target
  }
};

export default function IntegrationsSettings() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [editingIntegration, setEditingIntegration] = useState<string | null>(null);
  const [testingIntegration, setTestingIntegration] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Check admin authorization
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      // Only allow admin role
      if (parsedUser.role === 'admin') {
        setIsAuthorized(true);
      } else {
        toast({
          title: 'Access Denied',
          description: 'Admin privileges required to access Integration Settings.',
          variant: 'destructive'
        });
        setLocation('/crm/dashboard');
      }
    } else {
      setLocation('/crm/login');
    }
  }, []);

  // Fetch integration settings
  const { data: integrations, isLoading } = useQuery({
    queryKey: ['/api/crm/integrations'],
    queryFn: async () => {
      const res = await fetch('/api/crm/integrations');
      if (!res.ok) throw new Error('Failed to fetch integrations');
      return res.json();
    }
  });

  // Save integration settings
  const saveMutation = useMutation({
    mutationFn: async (data: { integrationId: string; credentials: Record<string, string>; settings: Record<string, any> }) => {
      const res = await fetch(`/api/crm/integrations/${data.integrationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to save integration');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/integrations'] });
      toast({ title: 'Integration saved', description: 'Settings have been updated successfully.' });
      setEditingIntegration(null);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save integration settings.', variant: 'destructive' });
    }
  });

  // Test integration connection
  const testMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      setTestingIntegration(integrationId);
      const res = await fetch(`/api/crm/integrations/${integrationId}/test`, {
        method: 'POST'
      });
      if (!res.ok) throw new Error('Test failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/integrations'] });
      toast({
        title: data.success ? 'Connection successful' : 'Connection failed',
        description: data.message,
        variant: data.success ? 'default' : 'destructive'
      });
      setTestingIntegration(null);
    },
    onError: () => {
      toast({ title: 'Test failed', description: 'Could not test the integration.', variant: 'destructive' });
      setTestingIntegration(null);
    }
  });

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> Connected</Badge>;
      case 'disconnected':
        return <Badge variant="outline" className="text-gray-500"><XCircle className="h-3 w-3 mr-1" /> Not Connected</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800"><AlertCircle className="h-3 w-3 mr-1" /> Error</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-100 text-yellow-800"><AlertCircle className="h-3 w-3 mr-1" /> Partial</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Default integrations structure
  const defaultIntegrations: IntegrationConfig[] = [
    // Communication
    {
      id: 'twilio',
      name: 'Twilio (SMS/WhatsApp/Voice)',
      category: 'communication',
      status: 'connected',
      credentials: {
        accountSid: process.env.TWILIO_ACCOUNT_SID || '',
        authToken: '',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
        whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER || ''
      },
      settings: {
        smsEnabled: true,
        whatsappEnabled: true,
        voiceEnabled: true,
        webhookUrl: 'https://johnbarclay.uk/api/webhooks/twilio'
      }
    },
    {
      id: 'email',
      name: 'Email (SMTP/IMAP)',
      category: 'communication',
      status: 'connected',
      credentials: {
        smtpHost: '',
        smtpPort: '587',
        smtpUser: '',
        smtpPassword: '',
        imapHost: '',
        imapPort: '993',
        imapUser: '',
        imapPassword: ''
      },
      settings: {
        fromAddress: 'John Barclay <admin@johnbarclay.uk>',
        autoResponse: true
      }
    },
    // Contracts
    {
      id: 'docusign',
      name: 'DocuSign',
      category: 'contracts',
      status: 'disconnected',
      credentials: {
        integrationKey: '',
        accountId: '',
        userId: '',
        privateKeyPath: ''
      },
      settings: {
        environment: 'sandbox',
        webhookUrl: 'https://johnbarclay.uk/api/webhooks/docusign',
        autoReminders: true,
        reminderDays: 3
      }
    },
    // Payments
    {
      id: 'stripe',
      name: 'Stripe',
      category: 'payments',
      status: 'disconnected',
      credentials: {
        secretKey: '',
        publishableKey: '',
        webhookSecret: ''
      },
      settings: {
        environment: 'test',
        currency: 'GBP',
        webhookUrl: 'https://johnbarclay.uk/api/webhooks/stripe'
      }
    },
    // Social Media
    {
      id: 'facebook',
      name: 'Facebook & Instagram',
      category: 'social',
      status: 'disconnected',
      credentials: {
        appId: '',
        appSecret: '',
        pageAccessToken: '',
        instagramBusinessId: ''
      },
      settings: {
        webhookUrl: 'https://johnbarclay.uk/api/webhooks/facebook',
        verifyToken: '',
        autoReply: true
      }
    },
    {
      id: 'linkedin',
      name: 'LinkedIn',
      category: 'social',
      status: 'disconnected',
      credentials: {
        clientId: '',
        clientSecret: '',
        accessToken: '',
        companyId: ''
      },
      settings: {
        autoPost: false,
        postFrequency: 'daily'
      }
    },
    {
      id: 'twitter',
      name: 'Twitter/X',
      category: 'social',
      status: 'disconnected',
      credentials: {
        apiKey: '',
        apiSecret: '',
        accessToken: '',
        accessSecret: '',
        bearerToken: ''
      },
      settings: {
        autoPost: false,
        monitorMentions: true
      }
    },
    // Property Portals
    {
      id: 'zoopla',
      name: 'Zoopla',
      category: 'portals',
      status: 'disconnected',
      credentials: {
        username: '',
        password: '',
        apiKey: '',
        branchId: ''
      },
      settings: {
        autoSync: true,
        syncFrequency: 'hourly',
        useApi: false // false = browser automation
      }
    },
    {
      id: 'rightmove',
      name: 'Rightmove',
      category: 'portals',
      status: 'disconnected',
      credentials: {
        username: '',
        password: '',
        networkId: '',
        branchId: ''
      },
      settings: {
        autoSync: true,
        syncFrequency: 'hourly',
        useApi: false
      }
    },
    // Lead Generation
    {
      id: 'land_registry',
      name: 'UK Land Registry',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {
        apiKey: '',
        username: '',
        password: ''
      },
      settings: {
        enabled: false,
        frequency: 'daily',
        postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
        minTransactionValue: 200000,
        maxTransactionValue: 5000000,
        trackNewPurchases: true,
        trackProbate: true,
        autoCreateLeads: true
      }
    },
    {
      id: 'planning_portals',
      name: 'Planning Permission Portals',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {
        westminsterApiKey: '',
        rbkcApiKey: '',
        brentApiKey: ''
      },
      settings: {
        enabled: false,
        frequency: 'daily',
        councils: ['Westminster', 'Kensington and Chelsea', 'Brent'],
        trackChangeOfUse: true,
        trackNewDevelopments: true,
        trackExtensions: false,
        autoCreateLeads: true
      }
    },
    {
      id: 'portal_monitoring',
      name: 'Portal Monitoring (Competitor Intel)',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {
        zooplaUsername: '',
        zooplaPassword: '',
        rightmoveUsername: '',
        rightmovePassword: ''
      },
      settings: {
        enabled: false,
        frequency: 'hourly',
        monitorPriceReductions: true,
        monitorExpiredListings: true,
        monitorStaleListings: true,
        staleDaysThreshold: 90,
        postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
        autoCreateLeads: true
      }
    },
    {
      id: 'auction_monitoring',
      name: 'Auction House Monitoring',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {
        allsopApiKey: '',
        savillsApiKey: '',
        auctionHouseLondonKey: ''
      },
      settings: {
        enabled: false,
        frequency: 'daily',
        auctionHouses: ['Allsop', 'Savills', 'Auction House London', 'Network Auctions'],
        trackFailedLots: true,
        trackSuccessfulBuyers: true,
        postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
        autoCreateLeads: true
      }
    },
    {
      id: 'social_listening',
      name: 'Social Media Listening',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {
        twitterBearerToken: '',
        facebookAccessToken: '',
        nextdoorApiKey: ''
      },
      settings: {
        enabled: false,
        frequency: 'every_2_hours',
        platforms: ['twitter', 'facebook', 'nextdoor'],
        keywords: ['selling house', 'recommend estate agent', 'moving from London'],
        postcodeAreas: ['W2', 'W9', 'W10', 'W11', 'NW6', 'NW8', 'NW10'],
        autoCreateLeads: true,
        autoReply: false
      }
    },
    {
      id: 'compliance_monitoring',
      name: 'Landlord Compliance Tracking',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {
        epcApiKey: '',
        gasSafeApiKey: ''
      },
      settings: {
        enabled: false,
        frequency: 'daily',
        trackEPC: true,
        trackGasSafety: true,
        trackEICR: true,
        reminderDays: 60,
        autoSendReminders: false,
        autoCreateLeads: true
      }
    },
    {
      id: 'propensity_scoring',
      name: 'AI Propensity Scoring',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {
        openaiApiKey: '',
        customModelEndpoint: ''
      },
      settings: {
        enabled: false,
        frequency: 'weekly',
        minPropensityScore: 70,
        factors: ['ownership_duration', 'market_trends', 'life_events', 'property_type'],
        autoCreateLeads: true,
        useOpenAI: true
      }
    },
    {
      id: 'seasonal_campaigns',
      name: 'Seasonal Campaign Automation',
      category: 'leadgen',
      status: 'disconnected',
      credentials: {},
      settings: {
        enabled: false,
        campaigns: {
          newYear: { enabled: true, startMonth: 1, startDay: 1, duration: 14 },
          spring: { enabled: true, startMonth: 3, startDay: 1, duration: 30 },
          backToSchool: { enabled: true, startMonth: 7, startDay: 15, duration: 30 },
          christmas: { enabled: true, startMonth: 11, startDay: 15, duration: 30 }
        },
        defaultTargetAudience: 'potential_sellers',
        autoSend: false
      }
    }
  ];

  const displayIntegrations = integrations || defaultIntegrations;

  const renderCredentialField = (
    integrationId: string,
    key: string,
    value: string,
    isSecret: boolean = false
  ) => {
    const fieldKey = `${integrationId}-${key}`;
    const isHidden = isSecret && !showSecrets[fieldKey];

    return (
      <div key={key} className="space-y-2">
        <Label htmlFor={fieldKey} className="text-sm capitalize">
          {key.replace(/([A-Z])/g, ' $1').trim()}
        </Label>
        <div className="flex gap-2">
          <Input
            id={fieldKey}
            type={isHidden ? 'password' : 'text'}
            value={value}
            placeholder={isSecret ? '••••••••••••' : `Enter ${key}`}
            className="flex-1"
            disabled={editingIntegration !== integrationId}
          />
          {isSecret && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => toggleSecret(fieldKey)}
            >
              {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderIntegrationCard = (integration: IntegrationConfig) => {
    const isEditing = editingIntegration === integration.id;
    const isTesting = testingIntegration === integration.id;

    return (
      <Card key={integration.id} className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-lg">{integration.name}</CardTitle>
              {getStatusBadge(integration.status)}
            </div>
            <div className="flex gap-2">
              {integration.id === 'docusign' && integration.status !== 'connected' && (
                <Button
                  className="bg-[#791E75] hover:bg-[#60175d]"
                  size="sm"
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/crm/docusign/auth');
                      const data = await res.json();
                      if (data.url) window.open(data.url, '_blank', 'width=600,height=600');
                    } catch (e) {
                      toast({ title: 'Error', description: 'Failed to start DocuSign login', variant: 'destructive' });
                    }
                  }}
                >
                  <Link2 className="h-4 w-4 mr-1" />
                  Connect DocuSign
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => testMutation.mutate(integration.id)}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4 mr-1" />
                )}
                Test
              </Button>
              <Button
                variant={isEditing ? 'default' : 'outline'}
                size="sm"
                onClick={() => setEditingIntegration(isEditing ? null : integration.id)}
              >
                {isEditing ? <Save className="h-4 w-4 mr-1" /> : <Settings className="h-4 w-4 mr-1" />}
                {isEditing ? 'Save' : 'Configure'}
              </Button>
            </div>
          </div>
          {integration.lastTested && (
            <CardDescription>
              Last tested: {new Date(integration.lastTested).toLocaleString()}
            </CardDescription>
          )}
        </CardHeader>

        {isEditing && (
          <CardContent className="space-y-6">
            {/* Credentials Section */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Key className="h-4 w-4" /> API Credentials
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(integration.credentials).map(([key, value]) =>
                  renderCredentialField(
                    integration.id,
                    key,
                    value,
                    key.toLowerCase().includes('secret') ||
                    key.toLowerCase().includes('password') ||
                    key.toLowerCase().includes('token') ||
                    key.toLowerCase().includes('key')
                  )
                )}
              </div>
            </div>

            {/* Settings Section */}
            <div>
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Settings className="h-4 w-4" /> Settings
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(integration.settings).map(([key, value]) => {
                  if (typeof value === 'boolean') {
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <Label className="text-sm capitalize">
                          {key.replace(/([A-Z])/g, ' $1').trim()}
                        </Label>
                        <Switch checked={value} />
                      </div>
                    );
                  }
                  if (key === 'environment') {
                    return (
                      <div key={key} className="space-y-2">
                        <Label className="text-sm">Environment</Label>
                        <Select defaultValue={value}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sandbox">Sandbox/Test</SelectItem>
                            <SelectItem value="production">Production</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  if (key === 'syncFrequency') {
                    return (
                      <div key={key} className="space-y-2">
                        <Label className="text-sm">Sync Frequency</Label>
                        <Select defaultValue={value}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="realtime">Real-time</SelectItem>
                            <SelectItem value="hourly">Hourly</SelectItem>
                            <SelectItem value="daily">Daily</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }
                  return (
                    <div key={key} className="space-y-2">
                      <Label className="text-sm capitalize">
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </Label>
                      <Input value={value} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Webhook Info */}
            {integration.settings.webhookUrl && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                  <Webhook className="h-4 w-4" /> Webhook URL
                </h4>
                <code className="text-xs bg-white px-3 py-2 rounded border block">
                  {integration.settings.webhookUrl}
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  Configure this URL in your {integration.name} dashboard to receive real-time updates.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>
    );
  };

  if (!isAuthorized || isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/portal">
              <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Shield className="h-6 w-6 text-[#791E75]" />
                Integration Settings
              </h1>
              <p className="text-gray-500">Configure external services and API connections</p>
            </div>
          </div>
          <Badge className="bg-[#791E75] text-white">
            <Lock className="h-3 w-3 mr-1" /> Admin Only
          </Badge>
        </div>
      </div>

      {/* Status Overview */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {Object.entries(INTEGRATION_CATEGORIES).map(([key, category]) => {
              const categoryIntegrations = displayIntegrations.filter(
                (i: IntegrationConfig) => i.category === key
              );
              const connected = categoryIntegrations.filter(
                (i: IntegrationConfig) => i.status === 'connected'
              ).length;
              const total = categoryIntegrations.length;
              const Icon = category.icon;

              return (
                <div key={key} className="text-center p-3 rounded-lg bg-gray-50">
                  <Icon className="h-6 w-6 mx-auto mb-2 text-[#791E75]" />
                  <p className="text-sm font-medium">{category.title}</p>
                  <p className="text-xs text-gray-500">
                    {connected}/{total} connected
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Integration Tabs */}
      <Tabs defaultValue="communication">
        <TabsList className="mb-4">
          {Object.entries(INTEGRATION_CATEGORIES).map(([key, category]) => (
            <TabsTrigger key={key} value={key} className="flex items-center gap-2">
              <category.icon className="h-4 w-4" />
              {category.title}
            </TabsTrigger>
          ))}
        </TabsList>

        {Object.entries(INTEGRATION_CATEGORIES).map(([key, category]) => (
          <TabsContent key={key} value={key}>
            <div className="mb-4">
              <h2 className="text-lg font-semibold">{category.title}</h2>
              <p className="text-sm text-gray-500">{category.description}</p>
            </div>
            {displayIntegrations
              .filter((i: IntegrationConfig) => i.category === key)
              .map((integration: IntegrationConfig) => renderIntegrationCard(integration))}
          </TabsContent>
        ))}
      </Tabs>

      {/* Help Section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-lg">Need Help?</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Documentation</h4>
              <p className="text-sm text-gray-500 mb-2">
                View the full integration requirements document for API setup instructions.
              </p>
              <Button variant="outline" size="sm">View Docs</Button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Webhook Setup</h4>
              <p className="text-sm text-gray-500 mb-2">
                All webhooks use the base URL: <code className="text-xs">https://johnbarclay.uk</code>
              </p>
              <Button variant="outline" size="sm">View Endpoints</Button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium mb-2">Support</h4>
              <p className="text-sm text-gray-500 mb-2">
                Need help setting up an integration? Contact technical support.
              </p>
              <Button variant="outline" size="sm">Get Help</Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
