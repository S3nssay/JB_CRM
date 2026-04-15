import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import {
  Loader2, Plus, Pencil, Trash2, Eye, FileText, FileDown,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES = ['All', 'Landlord', 'Tenant', 'Applicant', 'General', 'Arrears'] as const;
type Category = (typeof CATEGORIES)[number];

const AVAILABLE_MERGE_FIELDS = [
  { field: '{{tenant_name}}', description: 'Full name of the tenant' },
  { field: '{{landlord_name}}', description: 'Full name of the landlord' },
  { field: '{{property_address}}', description: 'Full property address' },
  { field: '{{tenancy_start_date}}', description: 'Tenancy start date' },
  { field: '{{tenancy_end_date}}', description: 'Tenancy end date' },
  { field: '{{rent_amount}}', description: 'Monthly rent amount' },
  { field: '{{arrears_balance}}', description: 'Current arrears balance' },
  { field: '{{days_overdue}}', description: 'Days payment is overdue' },
  { field: '{{today_date}}', description: "Today's date" },
  { field: '{{agent_name}}', description: 'Assigned agent name' },
  { field: '{{company_name}}', description: 'Company name' },
  { field: '{{company_phone}}', description: 'Company phone number' },
  { field: '{{company_email}}', description: 'Company email address' },
];

const CATEGORY_BADGE: Record<string, string> = {
  Landlord: 'bg-blue-100 text-blue-800 border-blue-200',
  Tenant: 'bg-green-100 text-green-800 border-green-200',
  Applicant: 'bg-purple-100 text-purple-800 border-purple-200',
  General: 'bg-gray-100 text-gray-800 border-gray-200',
  Arrears: 'bg-red-100 text-red-800 border-red-200',
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface LetterTemplate {
  id: number;
  name: string;
  category: string;
  subject?: string;
  body: string;
  mergeFields?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface TemplateForm {
  name: string;
  category: string;
  subject: string;
  body: string;
  isActive: boolean;
}

const EMPTY_FORM: TemplateForm = {
  name: '',
  category: 'General',
  subject: '',
  body: '',
  isActive: true,
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function LetterTemplateManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeCategory, setActiveCategory] = useState<Category>('All');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<LetterTemplate | null>(null);
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [tenancyId, setTenancyId] = useState('');
  const [generatingAst, setGeneratingAst] = useState(false);
  const [previewingId, setPreviewingId] = useState<number | null>(null);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: templates = [], isLoading } = useQuery<LetterTemplate[]>({
    queryKey: ['/api/crm/letter-templates'],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: (data: TemplateForm) =>
      apiRequest('/api/crm/letter-templates', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/letter-templates'] });
      toast({ title: 'Template created', description: 'Letter template saved successfully.' });
      closeDialog();
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: TemplateForm }) =>
      apiRequest(`/api/crm/letter-templates/${id}`, 'PUT', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/letter-templates'] });
      toast({ title: 'Template updated', description: 'Letter template updated successfully.' });
      closeDialog();
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest(`/api/crm/letter-templates/${id}`, 'DELETE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/letter-templates'] });
      toast({ title: 'Template deleted' });
      setShowDeleteDialog(false);
      setDeletingId(null);
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function openCreate() {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setShowTemplateDialog(true);
  }

  function openEdit(t: LetterTemplate) {
    setEditingTemplate(t);
    setForm({
      name: t.name,
      category: t.category,
      subject: t.subject || '',
      body: t.body,
      isActive: t.isActive,
    });
    setShowTemplateDialog(true);
  }

  function closeDialog() {
    setShowTemplateDialog(false);
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
  }

  function handleSave() {
    if (!form.name.trim()) {
      toast({ title: 'Validation error', description: 'Template name is required.', variant: 'destructive' });
      return;
    }
    if (!form.body.trim()) {
      toast({ title: 'Validation error', description: 'Template body is required.', variant: 'destructive' });
      return;
    }
    if (editingTemplate) {
      updateMutation.mutate({ id: editingTemplate.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  }

  async function handlePreview(id: number) {
    setPreviewingId(id);
    try {
      const resp = await fetch(`/api/crm/letter-templates/${id}/generate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!resp.ok) throw new Error('Failed to generate preview');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      toast({ title: 'Preview failed', description: err.message, variant: 'destructive' });
    } finally {
      setPreviewingId(null);
    }
  }

  async function handleGenerateAst() {
    if (!tenancyId.trim()) {
      toast({ title: 'Tenancy ID required', description: 'Enter a tenancy ID to generate the agreement.', variant: 'destructive' });
      return;
    }
    setGeneratingAst(true);
    try {
      const resp = await fetch('/api/crm/tenancy-agreement/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenancyId: parseInt(tenancyId, 10) }),
      });
      if (!resp.ok) throw new Error('Failed to generate tenancy agreement');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err: any) {
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setGeneratingAst(false);
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const filtered = templates.filter(
    (t) => activeCategory === 'All' || t.category === activeCategory,
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Letter Templates</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage letter templates for landlords, tenants, and applicants
          </p>
        </div>
        <Button onClick={openCreate} className="bg-[#791E75] hover:bg-[#5e1659] text-white">
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      {/* Generate Tenancy Agreement Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileDown className="h-4 w-4 text-[#791E75]" />
            Generate Tenancy Agreement (AST)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-xs">
              <Label htmlFor="tenancy-id" className="text-sm mb-1.5 block">Tenancy ID</Label>
              <Input
                id="tenancy-id"
                placeholder="e.g. 42"
                value={tenancyId}
                onChange={(e) => setTenancyId(e.target.value)}
                type="number"
              />
            </div>
            <Button
              onClick={handleGenerateAst}
              disabled={generatingAst}
              variant="outline"
              className="border-[#791E75] text-[#791E75] hover:bg-[#791E75]/5"
            >
              {generatingAst ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-2" />
              )}
              Generate PDF
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Templates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Category Tabs */}
          <div className="px-6 pb-3">
            <Tabs value={activeCategory} onValueChange={(v) => setActiveCategory(v as Category)}>
              <TabsList className="h-8">
                {CATEGORIES.map((c) => (
                  <TabsTrigger key={c} value={c} className="text-xs px-3 h-7">
                    {c}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No templates in this category</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Merge Fields</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`text-[11px] ${CATEGORY_BADGE[t.category] || CATEGORY_BADGE['General']}`}
                      >
                        {t.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {t.mergeFields?.length ?? 0} field{(t.mergeFields?.length ?? 0) !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell>
                      {t.isActive ? (
                        <Badge className="bg-green-100 text-green-800 border border-green-200 text-[11px]">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[11px] text-gray-500">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-gray-500 hover:text-[#791E75]"
                          onClick={() => handlePreview(t.id)}
                          disabled={previewingId === t.id}
                        >
                          {previewingId === t.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-gray-500 hover:text-[#791E75]"
                          onClick={() => openEdit(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-gray-500 hover:text-red-600"
                          onClick={() => { setDeletingId(t.id); setShowDeleteDialog(true); }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* Create / Edit Dialog */}
      <Dialog open={showTemplateDialog} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'Add Letter Template'}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-2">
            {/* Form fields */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="tpl-name" className="text-sm mb-1.5 block">Template Name *</Label>
                  <Input
                    id="tpl-name"
                    placeholder="e.g. First Arrears Reminder"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Category *</Label>
                  <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-3 pb-1">
                  <Label className="text-sm">Active</Label>
                  <Switch
                    checked={form.isActive}
                    onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="tpl-subject" className="text-sm mb-1.5 block">Subject (for emails)</Label>
                <Input
                  id="tpl-subject"
                  placeholder="e.g. Important: Rent Arrears Notice"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="tpl-body" className="text-sm mb-1.5 block">Body (HTML supported) *</Label>
                <Textarea
                  id="tpl-body"
                  placeholder="Dear {{tenant_name}},&#10;&#10;We are writing to inform you..."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </div>

            {/* Merge fields reference panel */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Available Merge Fields</p>
              <div className="border rounded-lg divide-y max-h-[420px] overflow-y-auto bg-gray-50">
                {AVAILABLE_MERGE_FIELDS.map((mf) => (
                  <div key={mf.field} className="px-3 py-2">
                    <p className="text-[11px] font-mono text-[#791E75] font-medium">{mf.field}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5">{mf.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>Cancel</Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="bg-[#791E75] hover:bg-[#5e1659] text-white"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            This action cannot be undone. The template will be permanently deleted.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
