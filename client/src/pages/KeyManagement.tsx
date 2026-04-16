import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import {
  Key, Plus, ArrowDownUp, RotateCcw, Trash2, Edit2, ChevronDown, ChevronRight,
  Clock, User, MapPin, AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OutstandingKey {
  id: number;
  key_id: number;
  property_id: number;
  person_name: string;
  person_type: string;
  checkout_date: string;
  expected_return_date: string | null;
  property_address: string;
  key_type?: string;
  key_number?: string;
}

interface PropertyKey {
  id: number;
  property_id: number;
  key_type: string;
  key_number: string | null;
  total_copies: number;
  location: string | null;
  notes: string | null;
}

interface KeyMovement {
  id: number;
  key_id: number;
  action: string;
  person_name: string;
  person_type: string;
  checkout_date: string;
  expected_return_date: string | null;
  return_date: string | null;
  reason: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const KEY_TYPE_LABELS: Record<string, string> = {
  front_door: 'Front Door',
  back_door: 'Back Door',
  communal: 'Communal',
  mailbox: 'Mailbox',
  garage: 'Garage',
  other: 'Other',
};

const KEY_TYPE_COLOURS: Record<string, string> = {
  front_door: 'bg-blue-100 text-blue-800',
  back_door: 'bg-green-100 text-green-800',
  communal: 'bg-purple-100 text-purple-800',
  mailbox: 'bg-yellow-100 text-yellow-800',
  garage: 'bg-orange-100 text-orange-800',
  other: 'bg-gray-100 text-gray-700',
};

const PERSON_TYPE_COLOURS: Record<string, string> = {
  tenant: 'bg-teal-100 text-teal-800',
  landlord: 'bg-indigo-100 text-indigo-800',
  contractor: 'bg-orange-100 text-orange-800',
  agent: 'bg-purple-100 text-purple-800',
  other: 'bg-gray-100 text-gray-700',
};

function fmt(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  try { return format(parseISO(dateStr), 'dd MMM yyyy'); } catch { return dateStr; }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KeyTypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${KEY_TYPE_COLOURS[type] ?? KEY_TYPE_COLOURS.other}`}>
      {KEY_TYPE_LABELS[type] ?? type}
    </span>
  );
}

function PersonTypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PERSON_TYPE_COLOURS[type] ?? PERSON_TYPE_COLOURS.other}`}>
      {type.charAt(0).toUpperCase() + type.slice(1)}
    </span>
  );
}

// ─── Checkout Dialog ──────────────────────────────────────────────────────────

function CheckoutDialog({
  keyRecord,
  open,
  onClose,
}: {
  keyRecord: PropertyKey;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    person_name: '',
    person_type: 'tenant',
    reason: '',
    expected_return_date: '',
  });

  const mutation = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/crm/key-movements', {
        key_id: keyRecord.id,
        property_id: keyRecord.property_id,
        action: 'checkout',
        person_name: form.person_name,
        person_type: form.person_type,
        reason: form.reason || null,
        expected_return_date: form.expected_return_date || null,
        checkout_date: new Date().toISOString(),
      }),
    onSuccess: () => {
      toast({ title: 'Key checked out successfully' });
      qc.invalidateQueries({ queryKey: ['outstanding-keys'] });
      qc.invalidateQueries({ queryKey: ['key-movements', keyRecord.property_id] });
      onClose();
      setForm({ person_name: '', person_type: 'tenant', reason: '', expected_return_date: '' });
    },
    onError: () => toast({ title: 'Failed to check out key', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check Out Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Person Name *</Label>
            <Input
              value={form.person_name}
              onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label>Person Type *</Label>
            <Select value={form.person_type} onValueChange={v => setForm(f => ({ ...f, person_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="tenant">Tenant</SelectItem>
                <SelectItem value="landlord">Landlord</SelectItem>
                <SelectItem value="contractor">Contractor</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reason</Label>
            <Input
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              placeholder="Optional"
            />
          </div>
          <div>
            <Label>Expected Return Date</Label>
            <Input
              type="date"
              value={form.expected_return_date}
              onChange={e => setForm(f => ({ ...f, expected_return_date: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.person_name || mutation.isPending}
            className="bg-[#791E75] hover:bg-[#5f1860] text-white"
          >
            Check Out
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Add/Edit Key Dialog ─────────────────────────────────────────────────────

function AddKeyDialog({
  propertyId,
  editKey,
  open,
  onClose,
}: {
  propertyId: number;
  editKey?: PropertyKey;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    key_type: editKey?.key_type ?? 'front_door',
    key_number: editKey?.key_number ?? '',
    total_copies: editKey?.total_copies ?? 1,
    location: editKey?.location ?? '',
    notes: editKey?.notes ?? '',
  });

  const mutation = useMutation({
    mutationFn: () => {
      const body = {
        key_type: form.key_type,
        key_number: form.key_number || null,
        total_copies: Number(form.total_copies),
        location: form.location || null,
        notes: form.notes || null,
      };
      if (editKey) {
        return apiRequest('PUT', `/api/crm/keys/${editKey.id}`, body);
      }
      return apiRequest('POST', `/api/crm/properties/${propertyId}/keys`, body);
    },
    onSuccess: () => {
      toast({ title: editKey ? 'Key updated' : 'Key added' });
      qc.invalidateQueries({ queryKey: ['property-keys', propertyId] });
      onClose();
    },
    onError: () => toast({ title: 'Failed to save key', variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editKey ? 'Edit Key' : 'Add Key'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Key Type *</Label>
            <Select value={form.key_type} onValueChange={v => setForm(f => ({ ...f, key_type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(KEY_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Key Number / Reference</Label>
            <Input
              value={form.key_number}
              onChange={e => setForm(f => ({ ...f, key_number: e.target.value }))}
              placeholder="e.g. K001"
            />
          </div>
          <div>
            <Label>Total Copies</Label>
            <Input
              type="number"
              min={1}
              value={form.total_copies}
              onChange={e => setForm(f => ({ ...f, total_copies: parseInt(e.target.value) || 1 }))}
            />
          </div>
          <div>
            <Label>Location / Cabinet</Label>
            <Input
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Cabinet A, Drawer 3"
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Any additional notes"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="bg-[#791E75] hover:bg-[#5f1860] text-white"
          >
            {editKey ? 'Save Changes' : 'Add Key'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Key Movement History Dialog ─────────────────────────────────────────────

function MovementHistoryDialog({
  keyId,
  propertyId,
  open,
  onClose,
}: {
  keyId: number;
  propertyId: number;
  open: boolean;
  onClose: () => void;
}) {
  const { data: movements = [] } = useQuery<KeyMovement[]>({
    queryKey: ['key-movements', propertyId],
    queryFn: () => apiRequest('GET', `/api/crm/properties/${propertyId}/key-movements`).then(r => r.json()),
    enabled: open,
  });

  const keyMovements = movements.filter(m => m.key_id === keyId);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Key Movement History</DialogTitle>
        </DialogHeader>
        <div className="max-h-96 overflow-y-auto space-y-2 py-2">
          {keyMovements.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">No movement history</p>
          ) : (
            keyMovements.map(m => (
              <div key={m.id} className="border rounded-lg p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${m.action === 'checkout' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                      {m.action === 'checkout' ? 'Checked Out' : 'Returned'}
                    </span>
                    <PersonTypeBadge type={m.person_type} />
                  </div>
                  <span className="text-xs text-gray-400">{fmt(m.checkout_date)}</span>
                </div>
                <p className="text-sm font-medium">{m.person_name}</p>
                {m.reason && <p className="text-xs text-gray-500">{m.reason}</p>}
                {m.return_date && (
                  <p className="text-xs text-green-600">Returned: {fmt(m.return_date)}</p>
                )}
                {!m.return_date && m.expected_return_date && (
                  <p className="text-xs text-amber-600">Expected return: {fmt(m.expected_return_date)}</p>
                )}
              </div>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Property Key Register ────────────────────────────────────────────────────

function PropertyKeyRegister() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [propertySearch, setPropertySearch] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState<number | null>(null);
  const [selectedPropertyAddress, setSelectedPropertyAddress] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editKey, setEditKey] = useState<PropertyKey | undefined>();
  const [checkoutKey, setCheckoutKey] = useState<PropertyKey | undefined>();
  const [historyKey, setHistoryKey] = useState<PropertyKey | undefined>();

  // Search properties
  const { data: properties = [] } = useQuery<any[]>({
    queryKey: ['properties-search', propertySearch],
    queryFn: () =>
      apiRequest('GET', `/api/crm/properties?search=${encodeURIComponent(propertySearch)}&isManaged=true`).then(r => r.json()),
    enabled: propertySearch.length >= 2,
  });

  // Keys for selected property
  const { data: keys = [] } = useQuery<PropertyKey[]>({
    queryKey: ['property-keys', selectedPropertyId],
    queryFn: () =>
      apiRequest('GET', `/api/crm/properties/${selectedPropertyId}/keys`).then(r => r.json()),
    enabled: !!selectedPropertyId,
  });

  const deleteKey = useMutation({
    mutationFn: (keyId: number) => apiRequest('DELETE', `/api/crm/keys/${keyId}`),
    onSuccess: () => {
      toast({ title: 'Key deleted' });
      qc.invalidateQueries({ queryKey: ['property-keys', selectedPropertyId] });
    },
    onError: () => toast({ title: 'Failed to delete key', variant: 'destructive' }),
  });

  return (
    <div className="space-y-4">
      {/* Property selector */}
      <div className="relative">
        <Label className="mb-1.5 block">Search Property</Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input
            className="pl-9"
            placeholder="Type address to search managed properties..."
            value={selectedPropertyAddress || propertySearch}
            onChange={e => {
              setPropertySearch(e.target.value);
              setSelectedPropertyId(null);
              setSelectedPropertyAddress('');
            }}
          />
        </div>
        {!selectedPropertyId && propertySearch.length >= 2 && properties.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {properties.map((p: any) => (
              <button
                key={p.id}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm border-b last:border-0"
                onClick={() => {
                  setSelectedPropertyId(p.id);
                  const addr = [p.address, p.address_line1, p.city].filter(Boolean).join(', ');
                  setSelectedPropertyAddress(addr);
                  setPropertySearch('');
                }}
              >
                {[p.address, p.address_line1, p.city].filter(Boolean).join(', ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedPropertyId && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">{selectedPropertyAddress}</p>
            <Button
              size="sm"
              onClick={() => setShowAddDialog(true)}
              className="bg-[#791E75] hover:bg-[#5f1860] text-white"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Key
            </Button>
          </div>

          {keys.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No keys registered for this property</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left">
                    <th className="px-3 py-2.5 font-medium text-gray-600">Type</th>
                    <th className="px-3 py-2.5 font-medium text-gray-600">Key #</th>
                    <th className="px-3 py-2.5 font-medium text-gray-600">Copies</th>
                    <th className="px-3 py-2.5 font-medium text-gray-600">Location</th>
                    <th className="px-3 py-2.5 font-medium text-gray-600">Notes</th>
                    <th className="px-3 py-2.5 font-medium text-gray-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {keys.map(k => (
                    <tr key={k.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5"><KeyTypeBadge type={k.key_type} /></td>
                      <td className="px-3 py-2.5 font-mono">{k.key_number ?? '—'}</td>
                      <td className="px-3 py-2.5">{k.total_copies}</td>
                      <td className="px-3 py-2.5 text-gray-600">{k.location ?? '—'}</td>
                      <td className="px-3 py-2.5 text-gray-500 max-w-[160px] truncate">{k.notes ?? '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setCheckoutKey(k)}
                            className="h-7 text-xs"
                          >
                            <ArrowDownUp className="h-3 w-3 mr-1" /> Check Out
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setHistoryKey(k)}
                            className="h-7 text-xs"
                          >
                            <Clock className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditKey(k)}
                            className="h-7 text-xs"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => deleteKey.mutate(k.id)}
                            className="h-7 text-xs text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      {showAddDialog && selectedPropertyId && (
        <AddKeyDialog
          propertyId={selectedPropertyId}
          open={showAddDialog}
          onClose={() => setShowAddDialog(false)}
        />
      )}
      {editKey && selectedPropertyId && (
        <AddKeyDialog
          propertyId={selectedPropertyId}
          editKey={editKey}
          open={!!editKey}
          onClose={() => setEditKey(undefined)}
        />
      )}
      {checkoutKey && (
        <CheckoutDialog
          keyRecord={checkoutKey}
          open={!!checkoutKey}
          onClose={() => setCheckoutKey(undefined)}
        />
      )}
      {historyKey && selectedPropertyId && (
        <MovementHistoryDialog
          keyId={historyKey.id}
          propertyId={selectedPropertyId}
          open={!!historyKey}
          onClose={() => setHistoryKey(undefined)}
        />
      )}
    </div>
  );
}

// ─── Outstanding Keys Section ─────────────────────────────────────────────────

function OutstandingKeysSection() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: outstanding = [], isLoading } = useQuery<OutstandingKey[]>({
    queryKey: ['outstanding-keys'],
    queryFn: () => apiRequest('GET', '/api/crm/keys/outstanding').then(r => r.json()),
    refetchInterval: 60_000,
  });

  const returnKey = useMutation({
    mutationFn: (movement: OutstandingKey) =>
      apiRequest('POST', '/api/crm/key-movements', {
        key_id: movement.key_id,
        property_id: movement.property_id,
        action: 'return',
        person_name: movement.person_name,
        person_type: movement.person_type,
        return_date: new Date().toISOString(),
        checkout_date: movement.checkout_date,
      }),
    onSuccess: () => {
      toast({ title: 'Key marked as returned' });
      qc.invalidateQueries({ queryKey: ['outstanding-keys'] });
    },
    onError: () => toast({ title: 'Failed to return key', variant: 'destructive' }),
  });

  const isOverdue = (expectedReturn: string | null) => {
    if (!expectedReturn) return false;
    return new Date(expectedReturn) < new Date();
  };

  if (isLoading) {
    return <div className="text-sm text-gray-400 py-6 text-center">Loading outstanding keys...</div>;
  }

  if (outstanding.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">All keys are currently in the office</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-3 py-2.5 font-medium text-gray-600">Property</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Key</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Person</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Type</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Checked Out</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Expected Return</th>
            <th className="px-3 py-2.5 font-medium text-gray-600"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {outstanding.map(o => (
            <tr key={o.id} className={`hover:bg-gray-50 ${isOverdue(o.expected_return_date) ? 'bg-red-50' : ''}`}>
              <td className="px-3 py-2.5 max-w-[200px]">
                <div className="truncate font-medium">{o.property_address}</div>
              </td>
              <td className="px-3 py-2.5">
                {o.key_type ? <KeyTypeBadge type={o.key_type} /> : <span className="text-gray-400 text-xs">Key #{o.key_id}</span>}
              </td>
              <td className="px-3 py-2.5">
                <div className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-gray-400" />
                  {o.person_name}
                </div>
              </td>
              <td className="px-3 py-2.5">
                <PersonTypeBadge type={o.person_type} />
              </td>
              <td className="px-3 py-2.5 text-gray-600">{fmt(o.checkout_date)}</td>
              <td className="px-3 py-2.5">
                {o.expected_return_date ? (
                  <div className={`flex items-center gap-1 ${isOverdue(o.expected_return_date) ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {isOverdue(o.expected_return_date) && <AlertCircle className="h-3.5 w-3.5" />}
                    {fmt(o.expected_return_date)}
                  </div>
                ) : (
                  <span className="text-gray-400">—</span>
                )}
              </td>
              <td className="px-3 py-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => returnKey.mutate(o)}
                  disabled={returnKey.isPending}
                  className="h-7 text-xs text-green-700 border-green-200 hover:bg-green-50"
                >
                  <RotateCcw className="h-3 w-3 mr-1" /> Return
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function KeyManagement() {
  const [tab, setTab] = useState<'outstanding' | 'register'>('outstanding');

  const { data: outstanding = [] } = useQuery<OutstandingKey[]>({
    queryKey: ['outstanding-keys'],
    queryFn: () => apiRequest('GET', '/api/crm/keys/outstanding').then(r => r.json()),
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#791E75]/10 rounded-xl">
            <Key className="h-6 w-6 text-[#791E75]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Key Management</h1>
            <p className="text-sm text-gray-500">Track physical key custody and movements</p>
          </div>
        </div>
        {outstanding.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">
              {outstanding.length} key{outstanding.length !== 1 ? 's' : ''} currently out
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('outstanding')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'outstanding' ? 'bg-white text-[#791E75] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Outstanding Keys
          {outstanding.length > 0 && (
            <span className="ml-2 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
              {outstanding.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab('register')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'register' ? 'bg-white text-[#791E75] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Key Register
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        {tab === 'outstanding' ? (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-4">Keys Currently Checked Out</h2>
            <OutstandingKeysSection />
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-4">Property Key Register</h2>
            <PropertyKeyRegister />
          </>
        )}
      </div>
    </div>
  );
}
