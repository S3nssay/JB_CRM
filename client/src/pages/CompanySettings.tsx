import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Building2, MapPin, Landmark, FileText, Palette, Loader2 } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

export default function CompanySettings() {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['/api/crm/company-settings'],
    queryFn: () => apiRequest('/api/crm/company-settings'),
  });

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
        <TabsList className="grid w-full grid-cols-5">
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
      </Tabs>
    </div>
  );
}
