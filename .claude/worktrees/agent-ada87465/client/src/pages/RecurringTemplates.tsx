import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Loader2, Search, Pencil, Trash2, Play, Pause,
  RefreshCw, CalendarClock, PoundSterling, FileText,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

// --- Types ---

interface LineItem {
  description: string;
  amount: number; // pence
}

interface RecurringTemplate {
  id: number;
  template_name: string;
  customer_type: string;
  customer_id: number | null;
  customer_name: string;
  frequency: 'monthly' | 'quarterly' | 'annually';
  day_of_month: number;
  line_items: LineItem[];
  subtotal: number;
  vat_amount: number;
  total_amount: number;
  property_id: number | null;
  account_id: number | null;
  tax_rate_id: number | null;
  next_generation_date: string | null;
  last_generated_date: string | null;
  is_active: boolean;
  notes: string | null;
}

interface TemplateFormData {
  template_name: string;
  customer_type: string;
  customer_id: number | null;
  customer_name: string;
  frequency: 'monthly' | 'quarterly' | 'annually';
  day_of_month: number;
  line_items: LineItem[];
  property_id: number | null;
  account_id: number | null;
  tax_rate_id: number | null;
  next_generation_date: string;
  notes: string;
  is_active?: boolean;
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `\u00A3${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function frequencyLabel(freq: string): string {
  switch (freq) {
    case 'monthly': return 'Monthly';
    case 'quarterly': return 'Quarterly';
    case 'annually': return 'Annually';
    default: return freq;
  }
}

const emptyForm: TemplateFormData = {
  template_name: '',
  customer_type: 'tenant',
  customer_id: null,
  customer_name: '',
  frequency: 'monthly',
  day_of_month: 1,
  line_items: [{ description: '', amount: 0 }],
  property_id: null,
  account_id: null,
  tax_rate_id: null,
  next_generation_date: '',
  notes: '',
};

// --- Component ---

export default function RecurringTemplates() {
  const { toast } = useToast();
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RecurringTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>({ ...emptyForm });

  // --- Queries ---

  const { data: templates = [], isLoading } = useQuery<RecurringTemplate[]>({
    queryKey: ['/api/crm/accounting/recurring-templates', showActiveOnly],
    queryFn: async () => {
      const url = showActiveOnly
        ? '/api/crm/accounting/recurring-templates?active=true'
        : '/api/crm/accounting/recurring-templates';
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load recurring templates');
      return res.json();
    },
  });

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (data: TemplateFormData) => {
      const lineItems = data.line_items
        .filter(li => li.description.trim())
        .map(li => ({
          description: li.description,
          amount: Math.round(li.amount * 100),
        }));
      const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
      const vatAmount = 0; // VAT calculated server-side or set explicitly
      const totalAmount = subtotal + vatAmount;

      return apiRequest('/api/crm/accounting/recurring-templates', 'POST', {
        template_name: data.template_name,
        customer_type: data.customer_type,
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        frequency: data.frequency,
        day_of_month: data.day_of_month,
        line_items: lineItems,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        property_id: data.property_id,
        account_id: data.account_id,
        tax_rate_id: data.tax_rate_id,
        next_generation_date: data.next_generation_date || null,
        notes: data.notes || null,
      });
    },
    onSuccess: () => {
      toast({ title: 'Template Created', description: 'Recurring invoice template has been created.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/recurring-templates'] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: TemplateFormData }) => {
      const lineItems = data.line_items
        .filter(li => li.description.trim())
        .map(li => ({
          description: li.description,
          amount: Math.round(li.amount * 100),
        }));
      const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
      const vatAmount = 0;
      const totalAmount = subtotal + vatAmount;

      return apiRequest(`/api/crm/accounting/recurring-templates/${id}`, 'PUT', {
        template_name: data.template_name,
        customer_type: data.customer_type,
        customer_id: data.customer_id,
        customer_name: data.customer_name,
        frequency: data.frequency,
        day_of_month: data.day_of_month,
        line_items: lineItems,
        subtotal,
        vat_amount: vatAmount,
        total_amount: totalAmount,
        property_id: data.property_id,
        account_id: data.account_id,
        tax_rate_id: data.tax_rate_id,
        next_generation_date: data.next_generation_date || null,
        notes: data.notes || null,
        is_active: data.is_active ?? true,
      });
    },
    onSuccess: () => {
      toast({ title: 'Template Updated', description: 'Recurring invoice template has been updated.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/recurring-templates'] });
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: number; is_active: boolean }) => {
      return apiRequest(`/api/crm/accounting/recurring-templates/${id}`, 'PUT', { is_active });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: variables.is_active ? 'Template Activated' : 'Template Paused',
        description: variables.is_active
          ? 'This template will generate invoices on schedule.'
          : 'This template has been paused and will not generate invoices.',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/recurring-templates'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // --- Handlers ---

  function closeDialog() {
    setShowDialog(false);
    setEditingTemplate(null);
    setFormData({ ...emptyForm });
  }

  function openCreateDialog() {
    setEditingTemplate(null);
    setFormData({ ...emptyForm });
    setShowDialog(true);
  }

  function openEditDialog(template: RecurringTemplate) {
    setEditingTemplate(template);
    setFormData({
      template_name: template.template_name,
      customer_type: template.customer_type,
      customer_id: template.customer_id,
      customer_name: template.customer_name,
      frequency: template.frequency,
      day_of_month: template.day_of_month,
      line_items: (template.line_items || []).map(li => ({
        description: li.description,
        amount: li.amount / 100, // convert pence back to pounds for editing
      })),
      property_id: template.property_id,
      account_id: template.account_id,
      tax_rate_id: template.tax_rate_id,
      next_generation_date: template.next_generation_date
        ? template.next_generation_date.slice(0, 10)
        : '',
      notes: template.notes || '',
      is_active: template.is_active,
    });
    setShowDialog(true);
  }

  function handleSubmit() {
    if (!formData.template_name.trim()) {
      toast({ title: 'Validation Error', description: 'Template name is required.', variant: 'destructive' });
      return;
    }
    if (!formData.customer_name.trim()) {
      toast({ title: 'Validation Error', description: 'Customer name is required.', variant: 'destructive' });
      return;
    }
    const validItems = formData.line_items.filter(li => li.description.trim());
    if (validItems.length === 0) {
      toast({ title: 'Validation Error', description: 'At least one line item is required.', variant: 'destructive' });
      return;
    }

    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  }

  function addLineItem() {
    setFormData(prev => ({
      ...prev,
      line_items: [...prev.line_items, { description: '', amount: 0 }],
    }));
  }

  function removeLineItem(index: number) {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== index),
    }));
  }

  function updateLineItem(index: number, field: keyof LineItem, value: string | number) {
    setFormData(prev => ({
      ...prev,
      line_items: prev.line_items.map((li, i) =>
        i === index ? { ...li, [field]: value } : li
      ),
    }));
  }

  // --- Computed ---

  const filteredTemplates = useMemo(() => {
    if (!searchTerm.trim()) return templates;
    const term = searchTerm.toLowerCase();
    return templates.filter(t =>
      t.template_name.toLowerCase().includes(term) ||
      t.customer_name.toLowerCase().includes(term) ||
      t.frequency.toLowerCase().includes(term)
    );
  }, [templates, searchTerm]);

  const formTotal = useMemo(() => {
    return formData.line_items.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);
  }, [formData.line_items]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // --- Render ---

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#791E75' }}>
            Recurring Invoice Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage templates that automatically generate invoices on a schedule
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          style={{ backgroundColor: '#791E75' }}
          className="hover:opacity-90"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="active-toggle" className="text-sm text-muted-foreground">
                Active only
              </Label>
              <Switch
                id="active-toggle"
                checked={showActiveOnly}
                onCheckedChange={setShowActiveOnly}
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading templates...</span>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CalendarClock className="w-10 h-10 mb-3 opacity-40" />
              <p className="font-medium">No recurring templates found</p>
              <p className="text-sm mt-1">
                {showActiveOnly
                  ? 'No active templates. Toggle the filter to see all templates.'
                  : 'Create your first recurring invoice template to get started.'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Template Name</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Next Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map(template => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        {template.template_name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="text-sm">{template.customer_name}</span>
                        <span className="text-xs text-muted-foreground ml-1 capitalize">
                          ({template.customer_type})
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{frequencyLabel(template.frequency)}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {template.day_of_month}{ordinalSuffix(template.day_of_month)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatCurrency(template.total_amount)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDate(template.next_generation_date)}
                    </TableCell>
                    <TableCell>
                      {template.is_active ? (
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block" />
                          Active
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-gray-500">
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1.5 inline-block" />
                          Paused
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(template)}
                          title="Edit template"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            toggleActiveMutation.mutate({
                              id: template.id,
                              is_active: !template.is_active,
                            })
                          }
                          title={template.is_active ? 'Pause template' : 'Activate template'}
                          disabled={toggleActiveMutation.isPending}
                        >
                          {template.is_active ? (
                            <Pause className="w-4 h-4 text-amber-600" />
                          ) : (
                            <Play className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {!isLoading && templates.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#791E75' }}>
                {templates.filter(t => t.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Monthly Recurring
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" style={{ color: '#791E75' }}>
                {formatCurrency(
                  templates
                    .filter(t => t.is_active)
                    .reduce((sum, t) => {
                      if (t.frequency === 'monthly') return sum + t.total_amount;
                      if (t.frequency === 'quarterly') return sum + Math.round(t.total_amount / 3);
                      if (t.frequency === 'annually') return sum + Math.round(t.total_amount / 12);
                      return sum;
                    }, 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">estimated monthly total</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Paused Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-400">
                {templates.filter(t => !t.is_active).length}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Recurring Template' : 'New Recurring Template'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Template Name */}
            <div className="space-y-1">
              <Label htmlFor="template_name">Template Name *</Label>
              <Input
                id="template_name"
                placeholder="e.g. Monthly Management Fee - 123 High Street"
                value={formData.template_name}
                onChange={e => setFormData(prev => ({ ...prev, template_name: e.target.value }))}
              />
            </div>

            {/* Customer Details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="customer_type">Customer Type</Label>
                <Select
                  value={formData.customer_type}
                  onValueChange={val => setFormData(prev => ({ ...prev, customer_type: val }))}
                >
                  <SelectTrigger id="customer_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tenant">Tenant</SelectItem>
                    <SelectItem value="landlord">Landlord</SelectItem>
                    <SelectItem value="vendor">Vendor</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="customer_name">Customer Name *</Label>
                <Input
                  id="customer_name"
                  placeholder="Customer name"
                  value={formData.customer_name}
                  onChange={e => setFormData(prev => ({ ...prev, customer_name: e.target.value }))}
                />
              </div>
            </div>

            {/* Frequency & Day */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="frequency">Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(val: 'monthly' | 'quarterly' | 'annually') =>
                    setFormData(prev => ({ ...prev, frequency: val }))
                  }
                >
                  <SelectTrigger id="frequency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annually">Annually</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="day_of_month">Day of Month</Label>
                <Input
                  id="day_of_month"
                  type="number"
                  min={1}
                  max={28}
                  value={formData.day_of_month}
                  onChange={e =>
                    setFormData(prev => ({
                      ...prev,
                      day_of_month: Math.max(1, Math.min(28, parseInt(e.target.value) || 1)),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">Max 28 to avoid month-end issues</p>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <Label>Line Items</Label>
              <div className="space-y-2">
                {formData.line_items.map((li, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder="Description"
                      value={li.description}
                      onChange={e => updateLineItem(idx, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <div className="relative w-32">
                      <PoundSterling className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={li.amount || ''}
                        onChange={e => updateLineItem(idx, 'amount', parseFloat(e.target.value) || 0)}
                        className="pl-7"
                      />
                    </div>
                    {formData.line_items.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(idx)}
                        className="shrink-0"
                      >
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={addLineItem}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Line Item
              </Button>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3">
              <span className="text-sm font-medium">Total Amount</span>
              <span className="text-lg font-bold" style={{ color: '#791E75' }}>
                {`\u00A3${formTotal.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              </span>
            </div>

            {/* Next Generation Date */}
            <div className="space-y-1">
              <Label htmlFor="next_generation_date">Next Generation Date</Label>
              <Input
                id="next_generation_date"
                type="date"
                value={formData.next_generation_date}
                onChange={e => setFormData(prev => ({ ...prev, next_generation_date: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                When should the first (or next) invoice be generated?
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes about this template..."
                value={formData.notes}
                onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Active toggle (edit mode only) */}
            {editingTemplate && (
              <div className="flex items-center justify-between border rounded-lg px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Template Status</p>
                  <p className="text-xs text-muted-foreground">
                    {formData.is_active
                      ? 'This template will generate invoices automatically.'
                      : 'This template is paused and will not generate invoices.'}
                  </p>
                </div>
                <Switch
                  checked={formData.is_active ?? true}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, is_active: checked }))
                  }
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              style={{ backgroundColor: '#791E75' }}
              className="hover:opacity-90"
            >
              {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Utility ---

function ordinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
