import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Building2, Phone, Globe, MapPin, Landmark, Receipt,
  CalendarDays, Hash, Settings, Upload, Loader2, Save, Image,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface ChartAccount {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface BusinessSettingsData {
  // Company Information
  company_name: string;
  trading_name: string;
  company_registration_number: string;
  vat_number: string;
  tax_reference: string;

  // Contact Details
  email: string;
  phone: string;
  website: string;

  // Registered Address
  address_line1: string;
  address_line2: string;
  city: string;
  postcode: string;
  country: string;

  // Bank Details
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  bank_sort_code: string;
  bank_iban: string;
  bank_swift: string;

  // VAT Configuration
  vat_registered: boolean;
  vat_scheme: string;
  flat_rate_percentage: number | string;

  // Financial Year
  financial_year_start_month: number;
  accounting_start_date: string;

  // Invoice Numbering
  sales_invoice_prefix: string;
  next_sales_invoice_number: number | string;
  purchase_invoice_prefix: string;
  next_purchase_invoice_number: number | string;
  credit_note_prefix: string;
  next_credit_note_number: number | string;
  journal_entry_prefix: string;
  next_journal_entry_number: number | string;

  // Defaults
  default_payment_terms: number | string;
  default_sales_account_id: number | string;
  default_purchase_account_id: number | string;
  default_bank_account_id: number | string;

  // Logo
  logo_url: string;
}

const defaultSettings: BusinessSettingsData = {
  company_name: '',
  trading_name: '',
  company_registration_number: '',
  vat_number: '',
  tax_reference: '',
  email: '',
  phone: '',
  website: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  country: 'United Kingdom',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
  bank_sort_code: '',
  bank_iban: '',
  bank_swift: '',
  vat_registered: false,
  vat_scheme: 'standard',
  flat_rate_percentage: '',
  financial_year_start_month: 4,
  accounting_start_date: '',
  sales_invoice_prefix: 'JBINV',
  next_sales_invoice_number: 1,
  purchase_invoice_prefix: 'JBPI',
  next_purchase_invoice_number: 1,
  credit_note_prefix: 'JBCN',
  next_credit_note_number: 1,
  journal_entry_prefix: 'JE',
  next_journal_entry_number: 1,
  default_payment_terms: 30,
  default_sales_account_id: '',
  default_purchase_account_id: '',
  default_bank_account_id: '',
  logo_url: '',
};

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export default function BusinessSettings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<BusinessSettingsData>(defaultSettings);

  // Fetch current settings
  const { data: settingsData, isLoading } = useQuery<BusinessSettingsData>({
    queryKey: ['/api/crm/accounting/business-settings'],
  });

  // Fetch chart of accounts for dropdowns
  const { data: revenueAccounts } = useQuery<ChartAccount[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts?type=revenue'],
  });

  const { data: expenseAccounts } = useQuery<ChartAccount[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts?type=expense'],
  });

  const { data: assetAccounts } = useQuery<ChartAccount[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts?type=asset'],
  });

  // Populate form when data loads
  useEffect(() => {
    if (settingsData) {
      setForm({ ...defaultSettings, ...settingsData });
    }
  }, [settingsData]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: BusinessSettingsData) => {
      return apiRequest('/api/crm/accounting/business-settings', 'PUT', data);
    },
    onSuccess: () => {
      toast({
        title: 'Settings saved',
        description: 'Business settings have been updated successfully.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/business-settings'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleChange = (field: keyof BusinessSettingsData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    saveMutation.mutate(form);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('logo', file);

    try {
      const res = await fetch('/api/crm/accounting/business-settings/logo', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to upload logo');
      const data = await res.json();
      handleChange('logo_url', data.logo_url);
      toast({
        title: 'Logo uploaded',
        description: 'Your logo has been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-[#791E75]" />
            Business Settings
          </h1>
          <p className="text-gray-500 mt-1">
            Configure your company details, VAT, invoicing, and defaults.
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-[#791E75] hover:bg-[#691A66]"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5 text-[#791E75]" />
            Company Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                value={form.company_name}
                onChange={(e) => handleChange('company_name', e.target.value)}
                placeholder="John Barclay & Co Ltd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trading_name">Trading Name</Label>
              <Input
                id="trading_name"
                value={form.trading_name}
                onChange={(e) => handleChange('trading_name', e.target.value)}
                placeholder="John Barclay Estate Agents"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_registration_number">Company Registration Number</Label>
              <Input
                id="company_registration_number"
                value={form.company_registration_number}
                onChange={(e) => handleChange('company_registration_number', e.target.value)}
                placeholder="12345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat_number_company">VAT Number</Label>
              <Input
                id="vat_number_company"
                value={form.vat_number}
                onChange={(e) => handleChange('vat_number', e.target.value)}
                placeholder="GB 123 4567 89"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax_reference">Tax Reference</Label>
              <Input
                id="tax_reference"
                value={form.tax_reference}
                onChange={(e) => handleChange('tax_reference', e.target.value)}
                placeholder="1234567890"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5 text-[#791E75]" />
            Contact Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="accounts@johnbarclay.co.uk"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="020 7123 4567"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                value={form.website}
                onChange={(e) => handleChange('website', e.target.value)}
                placeholder="https://www.johnbarclay.co.uk"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Registered Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-[#791E75]" />
            Registered Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address_line1">Address Line 1</Label>
              <Input
                id="address_line1"
                value={form.address_line1}
                onChange={(e) => handleChange('address_line1', e.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="address_line2">Address Line 2</Label>
              <Input
                id="address_line2"
                value={form.address_line2}
                onChange={(e) => handleChange('address_line2', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="London"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="postcode">Postcode</Label>
              <Input
                id="postcode"
                value={form.postcode}
                onChange={(e) => handleChange('postcode', e.target.value)}
                placeholder="SW1A 1AA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={form.country}
                onChange={(e) => handleChange('country', e.target.value)}
                placeholder="United Kingdom"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bank Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Landmark className="h-5 w-5 text-[#791E75]" />
            Bank Details (for Invoices)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bank_name">Bank Name</Label>
              <Input
                id="bank_name"
                value={form.bank_name}
                onChange={(e) => handleChange('bank_name', e.target.value)}
                placeholder="Barclays"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_account_name">Account Name</Label>
              <Input
                id="bank_account_name"
                value={form.bank_account_name}
                onChange={(e) => handleChange('bank_account_name', e.target.value)}
                placeholder="John Barclay & Co Ltd"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_account_number">Account Number</Label>
              <Input
                id="bank_account_number"
                value={form.bank_account_number}
                onChange={(e) => handleChange('bank_account_number', e.target.value)}
                placeholder="12345678"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_sort_code">Sort Code</Label>
              <Input
                id="bank_sort_code"
                value={form.bank_sort_code}
                onChange={(e) => handleChange('bank_sort_code', e.target.value)}
                placeholder="20-00-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_iban">IBAN (optional)</Label>
              <Input
                id="bank_iban"
                value={form.bank_iban}
                onChange={(e) => handleChange('bank_iban', e.target.value)}
                placeholder="GB00 BARC 2000 0012 3456 78"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_swift">SWIFT (optional)</Label>
              <Input
                id="bank_swift"
                value={form.bank_swift}
                onChange={(e) => handleChange('bank_swift', e.target.value)}
                placeholder="BARCGB22"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* VAT Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Receipt className="h-5 w-5 text-[#791E75]" />
            VAT Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="vat_registered">VAT Registered</Label>
                <p className="text-sm text-gray-500">
                  Enable if your business is registered for VAT
                </p>
              </div>
              <Switch
                id="vat_registered"
                checked={form.vat_registered}
                onCheckedChange={(checked) => handleChange('vat_registered', checked)}
              />
            </div>

            {form.vat_registered && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label htmlFor="vat_number_config">VAT Number</Label>
                  <Input
                    id="vat_number_config"
                    value={form.vat_number}
                    onChange={(e) => handleChange('vat_number', e.target.value)}
                    placeholder="GB 123 4567 89"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vat_scheme">VAT Scheme</Label>
                  <Select
                    value={form.vat_scheme}
                    onValueChange={(value) => handleChange('vat_scheme', value)}
                  >
                    <SelectTrigger id="vat_scheme">
                      <SelectValue placeholder="Select VAT scheme" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="flat_rate">Flat Rate</SelectItem>
                      <SelectItem value="cash_accounting">Cash Accounting</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.vat_scheme === 'flat_rate' && (
                  <div className="space-y-2">
                    <Label htmlFor="flat_rate_percentage">Flat Rate Percentage (%)</Label>
                    <Input
                      id="flat_rate_percentage"
                      type="number"
                      step="0.1"
                      value={form.flat_rate_percentage}
                      onChange={(e) => handleChange('flat_rate_percentage', e.target.value)}
                      placeholder="14.5"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Financial Year */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-[#791E75]" />
            Financial Year
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="financial_year_start_month">Financial Year Start Month</Label>
              <Select
                value={String(form.financial_year_start_month)}
                onValueChange={(value) => handleChange('financial_year_start_month', parseInt(value))}
              >
                <SelectTrigger id="financial_year_start_month">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={String(m.value)}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accounting_start_date">Accounting Start Date</Label>
              <Input
                id="accounting_start_date"
                type="date"
                value={form.accounting_start_date}
                onChange={(e) => handleChange('accounting_start_date', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                The date from which the accounting system starts tracking transactions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Numbering */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Hash className="h-5 w-5 text-[#791E75]" />
            Invoice Numbering
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sales_invoice_prefix">Sales Invoice Prefix</Label>
              <Input
                id="sales_invoice_prefix"
                value={form.sales_invoice_prefix}
                onChange={(e) => handleChange('sales_invoice_prefix', e.target.value)}
                placeholder="JBINV"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_sales_invoice_number">Next Sales Invoice Number</Label>
              <Input
                id="next_sales_invoice_number"
                type="number"
                min="1"
                value={form.next_sales_invoice_number}
                onChange={(e) => handleChange('next_sales_invoice_number', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Preview: {form.sales_invoice_prefix}-{String(form.next_sales_invoice_number).padStart(5, '0')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="purchase_invoice_prefix">Purchase Invoice Prefix</Label>
              <Input
                id="purchase_invoice_prefix"
                value={form.purchase_invoice_prefix}
                onChange={(e) => handleChange('purchase_invoice_prefix', e.target.value)}
                placeholder="JBPI"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_purchase_invoice_number">Next Purchase Invoice Number</Label>
              <Input
                id="next_purchase_invoice_number"
                type="number"
                min="1"
                value={form.next_purchase_invoice_number}
                onChange={(e) => handleChange('next_purchase_invoice_number', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Preview: {form.purchase_invoice_prefix}-{String(form.next_purchase_invoice_number).padStart(5, '0')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="credit_note_prefix">Credit Note Prefix</Label>
              <Input
                id="credit_note_prefix"
                value={form.credit_note_prefix}
                onChange={(e) => handleChange('credit_note_prefix', e.target.value)}
                placeholder="JBCN"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_credit_note_number">Next Credit Note Number</Label>
              <Input
                id="next_credit_note_number"
                type="number"
                min="1"
                value={form.next_credit_note_number}
                onChange={(e) => handleChange('next_credit_note_number', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Preview: {form.credit_note_prefix}-{String(form.next_credit_note_number).padStart(5, '0')}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="journal_entry_prefix">Journal Entry Prefix</Label>
              <Input
                id="journal_entry_prefix"
                value={form.journal_entry_prefix}
                onChange={(e) => handleChange('journal_entry_prefix', e.target.value)}
                placeholder="JE"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next_journal_entry_number">Next Journal Entry Number</Label>
              <Input
                id="next_journal_entry_number"
                type="number"
                min="1"
                value={form.next_journal_entry_number}
                onChange={(e) => handleChange('next_journal_entry_number', e.target.value)}
              />
              <p className="text-xs text-gray-500">
                Preview: {form.journal_entry_prefix}-{String(form.next_journal_entry_number).padStart(5, '0')}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Defaults */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings className="h-5 w-5 text-[#791E75]" />
            Defaults
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default_payment_terms">Default Payment Terms (days)</Label>
              <Input
                id="default_payment_terms"
                type="number"
                min="0"
                value={form.default_payment_terms}
                onChange={(e) => handleChange('default_payment_terms', e.target.value)}
                placeholder="30"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_sales_account_id">Default Sales Account</Label>
              <Select
                value={form.default_sales_account_id ? String(form.default_sales_account_id) : ''}
                onValueChange={(value) => handleChange('default_sales_account_id', parseInt(value))}
              >
                <SelectTrigger id="default_sales_account_id">
                  <SelectValue placeholder="Select revenue account" />
                </SelectTrigger>
                <SelectContent>
                  {(revenueAccounts || []).map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_purchase_account_id">Default Purchase Account</Label>
              <Select
                value={form.default_purchase_account_id ? String(form.default_purchase_account_id) : ''}
                onValueChange={(value) => handleChange('default_purchase_account_id', parseInt(value))}
              >
                <SelectTrigger id="default_purchase_account_id">
                  <SelectValue placeholder="Select expense account" />
                </SelectTrigger>
                <SelectContent>
                  {(expenseAccounts || []).map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="default_bank_account_id">Default Bank Account</Label>
              <Select
                value={form.default_bank_account_id ? String(form.default_bank_account_id) : ''}
                onValueChange={(value) => handleChange('default_bank_account_id', parseInt(value))}
              >
                <SelectTrigger id="default_bank_account_id">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {(assetAccounts || []).map((acc) => (
                    <SelectItem key={acc.id} value={String(acc.id)}>
                      {acc.code} - {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Image className="h-5 w-5 text-[#791E75]" />
            Company Logo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            {form.logo_url ? (
              <div className="w-32 h-32 border rounded-lg overflow-hidden bg-gray-50 flex items-center justify-center">
                <img
                  src={form.logo_url}
                  alt="Company logo"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-32 h-32 border-2 border-dashed rounded-lg bg-gray-50 flex items-center justify-center">
                <div className="text-center text-gray-400">
                  <Image className="h-8 w-8 mx-auto mb-1" />
                  <p className="text-xs">No logo</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Logo
              </Button>
              <p className="text-xs text-gray-500">
                Recommended: PNG or SVG, at least 200x200px. Appears on invoices and statements.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save Button */}
      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="bg-[#791E75] hover:bg-[#691A66] px-8"
          size="lg"
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Settings
        </Button>
      </div>
    </div>
  );
}
