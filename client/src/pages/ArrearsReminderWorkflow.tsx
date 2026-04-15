import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card, CardContent, CardHeader, CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
  Loader2, AlertCircle, CheckSquare, Square, Send, Settings, PoundSterling,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArrearsConfig {
  id: number;
  tier: number;
  tierLabel: string;
  daysThreshold: number;
  templateId?: number;
  sendEmail: boolean;
  sendSms: boolean;
  sendLetter: boolean;
}

interface ArrearsTenant {
  tenant_id: number;
  tenant_name: string;
  email: string;
  phone: string;
  property_address: string;
  arrears_balance: number;
  days_overdue: number;
  dunning_level: number;
  last_reminder_sent?: string;
}

interface LetterTemplate {
  id: number;
  name: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getTierBadge(dunningLevel: number) {
  switch (dunningLevel) {
    case 1:
      return <Badge className="bg-green-100 text-green-800 border border-green-200 text-[11px]">Tier 1</Badge>;
    case 2:
      return <Badge className="bg-amber-100 text-amber-800 border border-amber-200 text-[11px]">Tier 2</Badge>;
    case 3:
      return <Badge className="bg-red-100 text-red-800 border border-red-200 text-[11px]">Tier 3</Badge>;
    default:
      return <Badge variant="outline" className="text-[11px]">—</Badge>;
  }
}

function getRowClass(dunningLevel: number): string {
  switch (dunningLevel) {
    case 1: return 'bg-green-50/40 hover:bg-green-50';
    case 2: return 'bg-amber-50/40 hover:bg-amber-50';
    case 3: return 'bg-red-50/40 hover:bg-red-50';
    default: return '';
  }
}

const DEFAULT_TIERS: ArrearsConfig[] = [
  { id: 1, tier: 1, tierLabel: '1st Reminder', daysThreshold: 7, sendEmail: true, sendSms: false, sendLetter: false },
  { id: 2, tier: 2, tierLabel: '2nd Reminder', daysThreshold: 14, sendEmail: true, sendSms: true, sendLetter: false },
  { id: 3, tier: 3, tierLabel: '3rd Reminder', daysThreshold: 21, sendEmail: true, sendSms: true, sendLetter: true },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function TierConfigCard({
  config,
  templates,
  onSave,
  isSaving,
}: {
  config: ArrearsConfig;
  templates: LetterTemplate[];
  onSave: (updated: ArrearsConfig) => void;
  isSaving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(config);

  function handleSave() {
    onSave(draft);
    setEditing(false);
  }

  const tierColor = config.tier === 1 ? 'border-green-200' : config.tier === 2 ? 'border-amber-200' : 'border-red-200';
  const tierHeaderColor = config.tier === 1 ? 'text-green-700' : config.tier === 2 ? 'text-amber-700' : 'text-red-700';

  return (
    <Card className={`border-2 ${tierColor}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className={`text-sm font-semibold ${tierHeaderColor}`}>
            {config.tierLabel}
          </CardTitle>
          {!editing && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-gray-500 hover:text-[#791E75]"
              onClick={() => { setDraft(config); setEditing(true); }}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {editing ? (
          <>
            <div>
              <Label className="text-xs mb-1 block">Trigger after (days overdue)</Label>
              <Input
                type="number"
                min={1}
                value={draft.daysThreshold}
                onChange={(e) => setDraft({ ...draft, daysThreshold: parseInt(e.target.value, 10) || 0 })}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">Template</Label>
              <Select
                value={draft.templateId?.toString() || ''}
                onValueChange={(v) => setDraft({ ...draft, templateId: v ? parseInt(v, 10) : undefined })}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Switch checked={draft.sendEmail} onCheckedChange={(v) => setDraft({ ...draft, sendEmail: v })} className="scale-90" />
                <span className="text-xs text-gray-600">Email</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={draft.sendSms} onCheckedChange={(v) => setDraft({ ...draft, sendSms: v })} className="scale-90" />
                <span className="text-xs text-gray-600">SMS</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={draft.sendLetter} onCheckedChange={(v) => setDraft({ ...draft, sendLetter: v })} className="scale-90" />
                <span className="text-xs text-gray-600">Letter</span>
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button size="sm" className="h-7 text-xs flex-1 bg-[#791E75] hover:bg-[#5e1659] text-white" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-600">
              <span className="font-medium">Trigger:</span> {config.daysThreshold} days overdue
            </p>
            <div className="flex gap-1 flex-wrap">
              {config.sendEmail && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Email</Badge>}
              {config.sendSms && <Badge variant="outline" className="text-[10px] px-1.5 py-0">SMS</Badge>}
              {config.sendLetter && <Badge variant="outline" className="text-[10px] px-1.5 py-0">Letter</Badge>}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ArrearsReminderWorkflow() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedTier, setSelectedTier] = useState<string>('1');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: configItems = DEFAULT_TIERS, isLoading: configLoading } = useQuery<ArrearsConfig[]>({
    queryKey: ['/api/crm/arrears-reminder-config'],
  });

  const { data: tenants = [], isLoading: tenantsLoading } = useQuery<ArrearsTenant[]>({
    queryKey: ['/api/crm/arrears-tenants'],
  });

  const { data: templates = [] } = useQuery<LetterTemplate[]>({
    queryKey: ['/api/crm/letter-templates'],
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const updateConfigMutation = useMutation({
    mutationFn: (config: ArrearsConfig) =>
      apiRequest(`/api/crm/arrears-reminder-config/${config.id}`, 'PUT', config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/arrears-reminder-config'] });
      toast({ title: 'Config saved', description: 'Reminder configuration updated.' });
    },
    onError: (err: Error) =>
      toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const sendRemindersMutation = useMutation({
    mutationFn: (data: { tenantIds: number[]; tier: number }) =>
      apiRequest('/api/crm/arrears-send-batch', 'POST', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/arrears-tenants'] });
      toast({ title: 'Reminders sent', description: `Reminders dispatched to ${selectedIds.size} tenant(s).` });
      setSelectedIds(new Set());
      setShowConfirmDialog(false);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
      setShowConfirmDialog(false);
    },
  });

  // ── Handlers ───────────────────────────────────────────────────────────────

  function toggleSelect(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelectedIds(new Set(tenants.map((t) => t.tenant_id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  function handleSendReminders() {
    if (selectedIds.size === 0) {
      toast({ title: 'No tenants selected', description: 'Select at least one tenant.', variant: 'destructive' });
      return;
    }
    setShowConfirmDialog(true);
  }

  function confirmSend() {
    sendRemindersMutation.mutate({
      tenantIds: Array.from(selectedIds),
      tier: parseInt(selectedTier, 10),
    });
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalArrears = tenants.reduce((sum, t) => sum + t.arrears_balance, 0);
  const tier1Count = tenants.filter((t) => t.dunning_level === 1).length;
  const tier2Count = tenants.filter((t) => t.dunning_level === 2).length;
  const tier3Count = tenants.filter((t) => t.dunning_level === 3).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Arrears Reminder Workflow</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure tiered reminder rules and send batch reminders to tenants in arrears
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <PoundSterling className="h-4 w-4 text-[#791E75]" />
              <p className="text-xs text-gray-500">Total Arrears</p>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{formatCurrency(totalArrears)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
              <p className="text-xs text-gray-500">Tier 1</p>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{tier1Count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <p className="text-xs text-gray-500">Tier 2</p>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{tier2Count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
              <p className="text-xs text-gray-500">Tier 3</p>
            </div>
            <p className="text-xl font-bold text-gray-900 mt-1">{tier3Count}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Configuration */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Reminder Tiers</h2>
        {configLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading configuration...
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {(configItems.length > 0 ? configItems : DEFAULT_TIERS).map((cfg) => (
              <TierConfigCard
                key={cfg.id}
                config={cfg}
                templates={templates}
                onSave={(updated) => updateConfigMutation.mutate(updated)}
                isSaving={updateConfigMutation.isPending}
              />
            ))}
          </div>
        )}
      </div>

      {/* Tenants in Arrears Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Tenants in Arrears
              {tenants.length > 0 && (
                <Badge variant="outline" className="text-xs ml-1">{tenants.length}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={selectAll}>
                <CheckSquare className="h-3.5 w-3.5 mr-1" />
                Select All
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={deselectAll}>
                <Square className="h-3.5 w-3.5 mr-1" />
                Deselect All
              </Button>
              <Select value={selectedTier} onValueChange={setSelectedTier}>
                <SelectTrigger className="h-7 text-xs w-[110px]">
                  <SelectValue placeholder="Tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Tier 1</SelectItem>
                  <SelectItem value="2">Tier 2</SelectItem>
                  <SelectItem value="3">Tier 3</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size="sm"
                className="h-7 text-xs bg-[#791E75] hover:bg-[#5e1659] text-white"
                onClick={handleSendReminders}
                disabled={selectedIds.size === 0 || sendRemindersMutation.isPending}
              >
                {sendRemindersMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5 mr-1" />
                )}
                Send Reminders ({selectedIds.size})
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {tenantsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[#791E75]" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tenants currently in arrears</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>Tenant</TableHead>
                  <TableHead>Property</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead className="text-right">Days Overdue</TableHead>
                  <TableHead>Last Reminder</TableHead>
                  <TableHead>Tier</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.tenant_id} className={getRowClass(t.dunning_level)}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(t.tenant_id)}
                        onCheckedChange={() => toggleSelect(t.tenant_id)}
                      />
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-sm">{t.tenant_name}</p>
                      <p className="text-xs text-gray-500">{t.email}</p>
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 max-w-[200px] truncate">
                      {t.property_address}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {formatCurrency(t.arrears_balance)}
                    </TableCell>
                    <TableCell className="text-right text-sm text-gray-700">
                      {t.days_overdue}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500">
                      {formatDate(t.last_reminder_sent)}
                    </TableCell>
                    <TableCell>
                      {getTierBadge(t.dunning_level)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Tier {selectedTier} Reminders?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            You are about to send <strong>Tier {selectedTier}</strong> reminders to{' '}
            <strong>{selectedIds.size}</strong> tenant{selectedIds.size !== 1 ? 's' : ''}.
            This will dispatch reminders via the channels configured for this tier.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#791E75] hover:bg-[#5e1659] text-white"
              onClick={confirmSend}
              disabled={sendRemindersMutation.isPending}
            >
              {sendRemindersMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm &amp; Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
