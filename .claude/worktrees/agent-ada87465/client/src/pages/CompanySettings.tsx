import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Settings, Building2, MapPin, Landmark, FileText, Palette, Loader2, Phone, Mail, Share2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function CompanySettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/crm/company-settings'],
    queryFn: () => apiRequest('/api/crm/company-settings'),
  });

  const { data: socialCreds } = useQuery({
    queryKey: ['/api/crm/social-credentials'],
    queryFn: () => apiRequest('/api/crm/social-credentials'),
  });

  const togglePasswordVisibility = (platform: string) => {
    setShowPasswords(prev => ({ ...prev, [platform]: !prev[platform] }));
  };

  const testConnection = async (platform: string) => {
    setTestingPlatform(platform);
    setTestResults(prev => ({ ...prev, [platform]: undefined as any }));
    try {
      const result = await apiRequest(`/api/crm/social-credentials/test/${platform}`, 'POST');
      setTestResults(prev => ({ ...prev, [platform]: { success: result.success, message: result.message } }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [platform]: { success: false, message: err.message || 'Connection test failed' } }));
    } finally {
      setTestingPlatform(null);
    }
  };

  useEffect(() => {
    if (settings) {
      setForm(settings);
      setHasChanges(false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: (data: Record<string, any>) =>
      apiRequest('/api/crm/company-settings', "PUT", data),
    onSuccess: () => {
      toast({ title: 'Settings saved successfully' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/company-settings'] });
      setHasChanges(false);
    },
    onError: () => {
      toast({ title: 'Failed to save settings', variant: 'destructive' });
    },
  });

  const updateField = (field: string, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const Field = ({ label, field, type = 'text', placeholder = '', className = '' }: { label: string; field: string; type?: string; placeholder?: string; className?: string }) => (
    <div className={`space-y-1.5 ${className}`}>
      <Label htmlFor={field} className="text-sm font-medium">{label}</Label>
      <Input
        id={field}
        type={type}
        value={form[field] || ''}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const TextareaField = ({ label, field, placeholder = '', rows = 3 }: { label: string; field: string; placeholder?: string; rows?: number }) => (
    <div className="space-y-1.5">
      <Label htmlFor={field} className="text-sm font-medium">{label}</Label>
      <Textarea
        id={field}
        value={form[field] || ''}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
        rows={rows}
      />
    </div>
  );

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8" style={{ color: '#791E75' }} />
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
              Company Settings
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your business details, branding, and document settings
            </p>
          </div>
        </div>
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          style={hasChanges ? { backgroundColor: '#791E75' } : {}}
        >
          {saveMutation.isPending ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      <Tabs defaultValue="company" className="space-y-4">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="company" className="flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />Company
          </TabsTrigger>
          <TabsTrigger value="address" className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />Address
          </TabsTrigger>
          <TabsTrigger value="bank" className="flex items-center gap-1.5">
            <Landmark className="h-3.5 w-3.5" />Bank Details
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />Invoices & Quotes
          </TabsTrigger>
          <TabsTrigger value="branding" className="flex items-center gap-1.5">
            <Palette className="h-3.5 w-3.5" />Branding
          </TabsTrigger>
          <TabsTrigger value="communications" className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5" />Communications
          </TabsTrigger>
          <TabsTrigger value="social" className="flex items-center gap-1.5">
            <Share2 className="h-3.5 w-3.5" />Social & Portals
          </TabsTrigger>
        </TabsList>

        {/* Company Details Tab */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Company Name" field="company_name" placeholder="John Barclay Estate & Management Agents" />
                <Field label="Trading Name" field="trading_name" placeholder="John Barclay" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Field label="Company Registration No." field="company_registration_number" placeholder="12345678" />
                <Field label="VAT Number" field="vat_number" placeholder="GB 123 4567 89" />
                <Field label="Tax Reference" field="tax_reference" placeholder="1234567890" />
              </div>
              <Separator />
              <div className="grid grid-cols-3 gap-4">
                <Field label="Email" field="email" type="email" placeholder="info@johnbarclay.co.uk" />
                <Field label="Phone" field="phone" placeholder="+44 20 1234 5678" />
                <Field label="Website" field="website" placeholder="https://johnbarclay.co.uk" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Address Tab */}
        <TabsContent value="address">
          <Card>
            <CardHeader>
              <CardTitle>Registered Address</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Address Line 1" field="address_line1" placeholder="123 High Street" />
              <Field label="Address Line 2" field="address_line2" placeholder="Suite 4" />
              <div className="grid grid-cols-3 gap-4">
                <Field label="City" field="city" placeholder="London" />
                <Field label="Postcode" field="postcode" placeholder="W1A 1AA" />
                <Field label="Country" field="country" placeholder="United Kingdom" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Bank Details Tab */}
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Bank Details</CardTitle>
              <p className="text-sm text-muted-foreground">These details appear on invoices and statements</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Bank Name" field="bank_name" placeholder="Barclays Bank" />
                <Field label="Account Name" field="bank_account_name" placeholder="John Barclay Ltd" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account Number" field="bank_account_number" placeholder="12345678" />
                <Field label="Sort Code" field="bank_sort_code" placeholder="20-00-00" />
              </div>
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <Field label="IBAN" field="bank_iban" placeholder="GB29 NWBK 6016 1331 9268 19" />
                <Field label="SWIFT/BIC" field="bank_swift" placeholder="BARCGB22" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Invoice & Quote Settings Tab */}
        <TabsContent value="documents">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Invoice Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Invoice Prefix" field="invoice_prefix" placeholder="INV" />
                  <Field label="Next Invoice Number" field="invoice_next_number" type="number" placeholder="1" />
                  <Field label="Payment Terms (days)" field="invoice_payment_terms_days" type="number" placeholder="30" />
                </div>
                <TextareaField label="Default Invoice Footer" field="invoice_footer_text" placeholder="Payment is due within 30 days of invoice date..." />
                <TextareaField label="Default Invoice Notes" field="invoice_notes" placeholder="Thank you for your business..." />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quote Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <Field label="Quote Prefix" field="quote_prefix" placeholder="QTE" />
                  <Field label="Next Quote Number" field="quote_next_number" type="number" placeholder="1" />
                  <Field label="Quote Validity (days)" field="quote_validity_days" type="number" placeholder="30" />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Branding Tab */}
        <TabsContent value="branding">
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <p className="text-sm text-muted-foreground">Customize the appearance of your documents and portal</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Field label="Logo URL" field="logo_url" placeholder="https://..." />
              {form.logo_url && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="text-xs text-muted-foreground mb-2">Preview:</p>
                  <img src={form.logo_url} alt="Company logo" className="max-h-20 object-contain" />
                </div>
              )}
              <Separator />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Primary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.primary_color || '#791E75'}
                      onChange={(e) => updateField('primary_color', e.target.value)}
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.primary_color || '#791E75'}
                      onChange={(e) => updateField('primary_color', e.target.value)}
                      placeholder="#791E75"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Secondary Color</Label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.secondary_color || '#D4A04F'}
                      onChange={(e) => updateField('secondary_color', e.target.value)}
                      className="h-10 w-14 rounded border cursor-pointer"
                    />
                    <Input
                      value={form.secondary_color || '#D4A04F'}
                      onChange={(e) => updateField('secondary_color', e.target.value)}
                      placeholder="#D4A04F"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Communications Tab */}
        <TabsContent value="communications">
          <div className="space-y-4">
            {/* Call Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Call Settings</CardTitle>
                <p className="text-sm text-muted-foreground">Configure how agents make outbound calls from the CRM</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Call Mode</Label>
                  <Select value={form.call_mode || 'phone'} onValueChange={(v) => updateField('call_mode', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="phone">
                        <div className="flex flex-col">
                          <span>Phone Bridge</span>
                          <span className="text-xs text-muted-foreground">Twilio calls agent's phone, then bridges to customer</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="browser">
                        <div className="flex flex-col">
                          <span>Browser Softphone</span>
                          <span className="text-xs text-muted-foreground">Agents call directly from the browser using WebRTC</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.call_mode === 'browser'
                      ? 'Agents will make calls directly in the browser. Requires a headset and Twilio TwiML App SID configured in Integration Settings.'
                      : 'When an agent clicks "Call", Twilio will ring their mobile/desk phone first, then connect to the customer.'}
                  </p>
                </div>

                <Separator />

                <Field label="Default Caller ID" field="default_caller_id" placeholder="+442046345656" />
                <p className="text-xs text-muted-foreground -mt-2">
                  The phone number shown to customers when agents call. Must be a verified Twilio number.
                </p>

                {form.call_mode === 'browser' && (
                  <>
                    <Separator />
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <p className="text-sm text-amber-800 font-medium">Browser Calling Requirements</p>
                      <ul className="text-xs text-amber-700 mt-1 space-y-1 list-disc list-inside">
                        <li>TWILIO_TWIML_APP_SID must be set in Integration Settings</li>
                        <li>TWILIO_API_KEY and TWILIO_API_SECRET must be configured</li>
                        <li>Agents need a headset or microphone for calls</li>
                        <li>HTTPS is required for browser microphone access</li>
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Email Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Settings</CardTitle>
                <p className="text-sm text-muted-foreground">Choose how emails are sent from the CRM</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Email Provider</Label>
                  <Select value={form.email_mode || 'smtp'} onValueChange={(v) => updateField('email_mode', v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="smtp">
                        <div className="flex flex-col">
                          <span>SMTP (Company Email Server)</span>
                          <span className="text-xs text-muted-foreground">Send via mail.johnbarclay.uk</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="microsoft365">
                        <div className="flex flex-col">
                          <span>Microsoft 365</span>
                          <span className="text-xs text-muted-foreground">Send via agent's connected M365 mailbox</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.email_mode === 'microsoft365'
                      ? 'Emails will be sent from the agent\'s connected Microsoft 365 account. Agents must connect their M365 mailbox on the My Desk page. Falls back to SMTP if no M365 connection.'
                      : 'All emails are sent via the company SMTP server (mail.johnbarclay.uk). Configure SMTP credentials in Integration Settings.'}
                  </p>
                </div>

                {form.email_mode === 'microsoft365' && (
                  <>
                    <Separator />
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-sm text-blue-800 font-medium">Microsoft 365 Setup</p>
                      <ul className="text-xs text-blue-700 mt-1 space-y-1 list-disc list-inside">
                        <li>Microsoft Client ID, Secret, and Tenant ID must be set in Integration Settings</li>
                        <li>Each agent must connect their M365 mailbox via My Desk</li>
                        <li>If an agent hasn't connected M365, emails will fall back to SMTP</li>
                      </ul>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Social Media & Portals Tab */}
        <TabsContent value="social">
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-amber-800 font-medium">Environment Configuration</p>
              <p className="text-xs text-amber-700 mt-1">
                Social media and portal credentials are stored securely in the server environment variables (.env file).
                To update credentials, edit the .env file and restart the server.
              </p>
            </div>

            {[
              { key: 'facebook', label: 'Facebook', icon: '📘', color: '#1877F2', description: 'maintenance@johnbarclay.co.uk' },
              { key: 'instagram', label: 'Instagram', icon: '📷', color: '#E4405F', description: 'Content publishing & engagement' },
              { key: 'twitter', label: 'X / Twitter', icon: '𝕏', color: '#000000', description: 'News & updates' },
              { key: 'google_business', label: 'Google Business', icon: '📍', color: '#4285F4', description: 'Business profile & reviews' },
              { key: 'zoopla', label: 'Zoopla Pro', icon: '🏠', color: '#7B2D8E', description: 'Property portal syndication' },
            ].map((platform) => {
              const creds = socialCreds?.[platform.key];
              const testResult = testResults[platform.key];
              const isTesting = testingPlatform === platform.key;

              return (
                <Card key={platform.key}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold"
                          style={{ backgroundColor: platform.color }}
                        >
                          {platform.icon}
                        </div>
                        <div>
                          <h3 className="font-semibold">{platform.label}</h3>
                          <p className="text-xs text-muted-foreground">{platform.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {creds?.configured ? (
                          <Badge variant="outline" className="border-green-300 text-green-700 bg-green-50">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Configured
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-red-300 text-red-700 bg-red-50">
                            <XCircle className="h-3 w-3 mr-1" /> Not Configured
                          </Badge>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testConnection(platform.key)}
                          disabled={!creds?.configured || isTesting}
                        >
                          {isTesting ? (
                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testing...</>
                          ) : (
                            'Test Connection'
                          )}
                        </Button>
                      </div>
                    </div>

                    {creds?.configured && (
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Username / Email</Label>
                          <Input value={creds.username || ''} readOnly className="bg-gray-50 text-sm" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Password</Label>
                          <div className="flex gap-2">
                            <Input
                              type={showPasswords[platform.key] ? 'text' : 'password'}
                              value={creds.password || ''}
                              readOnly
                              className="bg-gray-50 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => togglePasswordVisibility(platform.key)}
                              className="shrink-0"
                            >
                              {showPasswords[platform.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {testResult && (
                      <div className={`mt-3 p-2 rounded text-sm ${testResult.success ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                        {testResult.success ? <CheckCircle2 className="h-4 w-4 inline mr-1" /> : <XCircle className="h-4 w-4 inline mr-1" />}
                        {testResult.message}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
