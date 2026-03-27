import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  ClipboardList, Plus, Camera, CheckCircle, AlertTriangle, Home, Eye,
} from 'lucide-react';
import { format } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { toast } from '@/hooks/use-toast';
import { formatPence } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────

interface InventoryItem {
  id: number;
  inventoryId: number;
  room: string;
  itemName: string;
  description: string;
  conditionCheckIn: string;
  quantity: number;
  conditionCheckOut?: string;
  checkOutNotes?: string;
  damageAssessed?: boolean;
  damageAmount?: number;
}

interface Inventory {
  id: number;
  propertyId: number;
  checkInDate: string;
  checkOutDate?: string;
  status: string;
  clerkName: string;
  clerkCompany?: string;
  overallCondition: string;
  notes?: string;
  items?: InventoryItem[];
}

interface Tenancy {
  id: number;
  propertyId: number;
  propertyAddress?: string;
}

interface DamageSummary {
  items: { itemName: string; room: string; damageAmount: number; checkOutNotes: string }[];
  totalDamage: number;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const ROOM_SUGGESTIONS = [
  'Living Room', 'Kitchen', 'Bedroom 1', 'Bedroom 2', 'Bedroom 3',
  'Bathroom', 'En-suite', 'Hallway', 'Garden', 'Garage', 'Other',
];

const CONDITION_OPTIONS = ['new', 'good', 'fair', 'worn', 'damaged'];
const OVERALL_CONDITION_OPTIONS = ['excellent', 'good', 'fair', 'poor'];

const conditionBadge = (condition: string) => {
  const map: Record<string, string> = {
    new: 'bg-green-100 text-green-800 border-green-300',
    excellent: 'bg-green-100 text-green-800 border-green-300',
    good: 'bg-blue-100 text-blue-800 border-blue-300',
    fair: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    worn: 'bg-orange-100 text-orange-800 border-orange-300',
    poor: 'bg-red-100 text-red-800 border-red-300',
    damaged: 'bg-red-100 text-red-800 border-red-300',
  };
  return map[condition] || 'bg-gray-100 text-gray-700';
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function InventoryTracking() {
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('');
  const [selectedInventory, setSelectedInventory] = useState<Inventory | null>(null);
  const [checkOutMode, setCheckOutMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddItemDialog, setShowAddItemDialog] = useState(false);
  const [addItemRoom, setAddItemRoom] = useState('');

  const [newInventory, setNewInventory] = useState({
    checkInDate: '', clerkName: '', clerkCompany: '', overallCondition: 'good', notes: '',
  });

  const [newItem, setNewItem] = useState({
    room: '', itemName: '', description: '', condition: 'good', quantity: 1,
  });

  const [checkOutEdits, setCheckOutEdits] = useState<Record<number, {
    conditionCheckOut: string; checkOutNotes: string; damageAssessed: boolean; damageAmount: number;
  }>>({});

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: tenancies } = useQuery<Tenancy[]>({
    queryKey: ['/api/crm/pm-dashboard/tenancies?status=active'],
  });

  const properties = useMemo(() =>
    tenancies
      ? Array.from(new Map(tenancies.map((t) => [t.propertyId, t])).values())
      : [],
    [tenancies]
  );

  const { data: inventories, isLoading: inventoriesLoading } = useQuery<Inventory[]>({
    queryKey: [`/api/crm/inventory/${selectedPropertyId}`],
    enabled: !!selectedPropertyId,
  });

  const { data: damageSummary } = useQuery<DamageSummary>({
    queryKey: [`/api/crm/inventory/${selectedInventory?.id}/damage-summary`],
    enabled: !!selectedInventory?.id,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const createInventoryMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest('/api/crm/inventory', 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/inventory/${selectedPropertyId}`] });
      toast({ title: 'Inventory created', description: 'New inventory record has been created.' });
      setShowCreateDialog(false);
      setNewInventory({ checkInDate: '', clerkName: '', clerkCompany: '', overallCondition: 'good', notes: '' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to create inventory.', variant: 'destructive' }),
  });

  const addItemMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequest(`/api/crm/inventory/${selectedInventory?.id}/items`, 'POST', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/inventory/${selectedPropertyId}`] });
      if (selectedInventory) {
        queryClient.invalidateQueries({ queryKey: [`/api/crm/inventory/${selectedInventory.id}/damage-summary`] });
      }
      toast({ title: 'Item added', description: 'Inventory item has been added.' });
      setShowAddItemDialog(false);
      setNewItem({ room: '', itemName: '', description: '', condition: 'good', quantity: 1 });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to add item.', variant: 'destructive' }),
  });

  const checkOutItemMutation = useMutation({
    mutationFn: ({ itemId, payload }: { itemId: number; payload: Record<string, unknown> }) =>
      apiRequest(`/api/crm/inventory/${selectedInventory?.id}/items/${itemId}/checkout`, 'PUT', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/crm/inventory/${selectedPropertyId}`] });
      if (selectedInventory) {
        queryClient.invalidateQueries({ queryKey: [`/api/crm/inventory/${selectedInventory.id}/damage-summary`] });
      }
      toast({ title: 'Check-out saved', description: 'Item check-out details updated.' });
    },
    onError: () => toast({ title: 'Error', description: 'Failed to save check-out.', variant: 'destructive' }),
  });

  // ── Helpers ────────────────────────────────────────────────────────────────

  const handleCreateInventory = () => {
    createInventoryMutation.mutate({
      propertyId: Number(selectedPropertyId),
      checkInDate: newInventory.checkInDate,
      clerkName: newInventory.clerkName,
      clerkCompany: newInventory.clerkCompany,
      overallCondition: newInventory.overallCondition,
      notes: newInventory.notes,
    });
  };

  const handleAddItem = () => {
    addItemMutation.mutate({
      room: newItem.room,
      itemName: newItem.itemName,
      description: newItem.description,
      conditionCheckIn: newItem.condition,
      quantity: newItem.quantity,
    });
  };

  const handleSaveCheckOut = (itemId: number) => {
    const edits = checkOutEdits[itemId];
    if (!edits) return;
    checkOutItemMutation.mutate({
      itemId,
      payload: {
        conditionCheckOut: edits.conditionCheckOut,
        checkOutNotes: edits.checkOutNotes,
        damageAssessed: edits.damageAssessed,
        damageAmount: edits.damageAmount,
      },
    });
  };

  const updateCheckOutEdit = (itemId: number, field: string, value: unknown) => {
    setCheckOutEdits((prev) => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};
    if (selectedInventory?.items) {
      for (const item of selectedInventory.items) {
        if (!groups[item.room]) groups[item.room] = [];
        groups[item.room].push(item);
      }
    }
    return groups;
  }, [selectedInventory?.items]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#791E75' }}>
            <ClipboardList className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Inventory Tracking</h1>
            <p className="text-sm text-muted-foreground">
              Check-in and check-out inventories for tenancy onboarding and offboarding
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Select value={selectedPropertyId} onValueChange={(val) => { setSelectedPropertyId(val); setSelectedInventory(null); setCheckOutMode(false); }}>
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select a property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map((p) => (
                <SelectItem key={p.propertyId} value={String(p.propertyId)}>
                  <div className="flex items-center gap-2">
                    <Home className="h-3 w-3" />
                    {p.propertyAddress || `Property #${p.propertyId}`}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedPropertyId && (
            <Button
              onClick={() => setShowCreateDialog(true)}
              style={{ backgroundColor: '#791E75' }}
              className="text-white hover:opacity-90"
            >
              <Plus className="h-4 w-4 mr-2" /> New Inventory
            </Button>
          )}
        </div>
      </div>

      {!selectedPropertyId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Home className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-1">Select a Property</h3>
            <p className="text-muted-foreground">Choose a managed property above to view or create inventories.</p>
          </CardContent>
        </Card>
      )}

      {selectedPropertyId && !selectedInventory && (
        <Card>
          <CardHeader>
            <CardTitle>Inventories</CardTitle>
          </CardHeader>
          <CardContent>
            {inventoriesLoading ? (
              <p className="text-muted-foreground py-8 text-center">Loading inventories...</p>
            ) : !inventories?.length ? (
              <p className="text-muted-foreground py-8 text-center">No inventories found for this property. Create one to get started.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Check-In Date</TableHead>
                    <TableHead>Check-Out Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clerk</TableHead>
                    <TableHead>Overall Condition</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventories.map((inv) => (
                    <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedInventory(inv); setCheckOutMode(false); }}>
                      <TableCell>{inv.checkInDate ? format(new Date(inv.checkInDate), 'dd MMM yyyy') : '-'}</TableCell>
                      <TableCell>{inv.checkOutDate ? format(new Date(inv.checkOutDate), 'dd MMM yyyy') : '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={inv.status === 'completed' ? 'bg-green-50 text-green-700 border-green-300' : 'bg-blue-50 text-blue-700 border-blue-300'}>
                          {inv.status || 'active'}
                        </Badge>
                      </TableCell>
                      <TableCell>{inv.clerkName}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={conditionBadge(inv.overallCondition)}>
                          {inv.overallCondition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {selectedInventory && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={() => { setSelectedInventory(null); setCheckOutMode(false); }}>
              Back to list
            </Button>
            <div className="flex items-center gap-3">
              <Button
                variant={checkOutMode ? 'default' : 'outline'}
                onClick={() => setCheckOutMode(!checkOutMode)}
                className={checkOutMode ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}
              >
                <Camera className="h-4 w-4 mr-2" />
                {checkOutMode ? 'Exit Check-Out Mode' : 'Check-Out Mode'}
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" style={{ color: '#791E75' }} />
                Inventory #{selectedInventory.id}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Check-In Date</span>
                  <p className="font-medium">{selectedInventory.checkInDate ? format(new Date(selectedInventory.checkInDate), 'dd MMM yyyy') : '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Clerk</span>
                  <p className="font-medium">{selectedInventory.clerkName}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Company</span>
                  <p className="font-medium">{selectedInventory.clerkCompany || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Overall Condition</span>
                  <Badge variant="outline" className={conditionBadge(selectedInventory.overallCondition)}>
                    {selectedInventory.overallCondition}
                  </Badge>
                </div>
              </div>
              {selectedInventory.notes && (
                <p className="mt-4 text-sm text-muted-foreground">{selectedInventory.notes}</p>
              )}
            </CardContent>
          </Card>

          {Object.keys(groupedItems).length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No items recorded yet. Add items by room to build the inventory.
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedItems).map(([room, items]) => (
              <Card key={room}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{room}</CardTitle>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setAddItemRoom(room); setNewItem((prev) => ({ ...prev, room })); setShowAddItemDialog(true); }}
                    >
                      <Plus className="h-3 w-3 mr-1" /> Add Item
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Condition (In)</TableHead>
                        <TableHead>Qty</TableHead>
                        {checkOutMode && (
                          <>
                            <TableHead>Condition (Out)</TableHead>
                            <TableHead>Check-Out Notes</TableHead>
                            <TableHead>Damage?</TableHead>
                            <TableHead>Amount (p)</TableHead>
                            <TableHead></TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const edit = checkOutEdits[item.id] || {
                          conditionCheckOut: item.conditionCheckOut || '',
                          checkOutNotes: item.checkOutNotes || '',
                          damageAssessed: item.damageAssessed || false,
                          damageAmount: item.damageAmount || 0,
                        };
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.itemName}</TableCell>
                            <TableCell className="text-muted-foreground">{item.description || '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={conditionBadge(item.conditionCheckIn)}>
                                {item.conditionCheckIn}
                              </Badge>
                            </TableCell>
                            <TableCell>{item.quantity}</TableCell>
                            {checkOutMode && (
                              <>
                                <TableCell>
                                  <Select
                                    value={edit.conditionCheckOut}
                                    onValueChange={(val) => updateCheckOutEdit(item.id, 'conditionCheckOut', val)}
                                  >
                                    <SelectTrigger className="w-[120px]">
                                      <SelectValue placeholder="Select" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {CONDITION_OPTIONS.map((c) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Input
                                    className="w-[160px]"
                                    placeholder="Notes..."
                                    value={edit.checkOutNotes}
                                    onChange={(e) => updateCheckOutEdit(item.id, 'checkOutNotes', e.target.value)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={edit.damageAssessed}
                                    onChange={(e) => updateCheckOutEdit(item.id, 'damageAssessed', e.target.checked)}
                                    className="h-4 w-4 accent-[#791E75]"
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    className="w-[100px]"
                                    placeholder="0"
                                    value={edit.damageAmount || ''}
                                    onChange={(e) => updateCheckOutEdit(item.id, 'damageAmount', Number(e.target.value))}
                                    disabled={!edit.damageAssessed}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveCheckOut(item.id)}
                                    style={{ backgroundColor: '#791E75' }}
                                    className="text-white hover:opacity-90"
                                    disabled={checkOutItemMutation.isPending}
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" /> Save
                                  </Button>
                                </TableCell>
                              </>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}

          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => { setAddItemRoom(''); setNewItem({ room: '', itemName: '', description: '', condition: 'good', quantity: 1 }); setShowAddItemDialog(true); }}
            >
              <Plus className="h-4 w-4 mr-2" /> Add Item to Room
            </Button>
          </div>

          <Separator />

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                Damage Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!damageSummary?.items?.length ? (
                <p className="text-muted-foreground text-center py-6">No damage recorded for this inventory.</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Room</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {damageSummary.items.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{d.itemName}</TableCell>
                          <TableCell>{d.room}</TableCell>
                          <TableCell className="text-muted-foreground">{d.checkOutNotes || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPence(d.damageAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-end mt-4 p-4 rounded-lg" style={{ backgroundColor: '#791E7510' }}>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Total Damage</p>
                      <p className="text-2xl font-bold" style={{ color: '#791E75' }}>
                        {formatPence(damageSummary.totalDamage || 0)}
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Inventory</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Property</label>
              <Input disabled value={properties.find((p) => String(p.propertyId) === selectedPropertyId)?.propertyAddress || `Property #${selectedPropertyId}`} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Check-In Date</label>
              <Input
                type="date"
                value={newInventory.checkInDate}
                onChange={(e) => setNewInventory((prev) => ({ ...prev, checkInDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Clerk Name</label>
              <Input
                placeholder="Name of inventory clerk"
                value={newInventory.clerkName}
                onChange={(e) => setNewInventory((prev) => ({ ...prev, clerkName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Clerk Company</label>
              <Input
                placeholder="Company (optional)"
                value={newInventory.clerkCompany}
                onChange={(e) => setNewInventory((prev) => ({ ...prev, clerkCompany: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Overall Condition</label>
              <Select
                value={newInventory.overallCondition}
                onValueChange={(val) => setNewInventory((prev) => ({ ...prev, overallCondition: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OVERALL_CONDITION_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Notes</label>
              <Textarea
                placeholder="General notes about the inventory..."
                value={newInventory.notes}
                onChange={(e) => setNewInventory((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button
                onClick={handleCreateInventory}
                disabled={!newInventory.checkInDate || !newInventory.clerkName || createInventoryMutation.isPending}
                style={{ backgroundColor: '#791E75' }}
                className="text-white hover:opacity-90"
              >
                {createInventoryMutation.isPending ? 'Creating...' : 'Create Inventory'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddItemDialog} onOpenChange={setShowAddItemDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Inventory Item</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Room</label>
              <Select
                value={newItem.room}
                onValueChange={(val) => setNewItem((prev) => ({ ...prev, room: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a room" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_SUGGESTIONS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Item Name</label>
              <Input
                placeholder="e.g., Sofa, Dining Table, Curtains"
                value={newItem.itemName}
                onChange={(e) => setNewItem((prev) => ({ ...prev, itemName: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                placeholder="Colour, make, model, distinguishing features..."
                value={newItem.description}
                onChange={(e) => setNewItem((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Condition</label>
              <Select
                value={newItem.condition}
                onValueChange={(val) => setNewItem((prev) => ({ ...prev, condition: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CONDITION_OPTIONS.map((c) => (
                    <SelectItem key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Quantity</label>
              <Input
                type="number"
                min={1}
                value={newItem.quantity}
                onChange={(e) => setNewItem((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowAddItemDialog(false)}>Cancel</Button>
              <Button
                onClick={handleAddItem}
                disabled={!newItem.room || !newItem.itemName || addItemMutation.isPending}
                style={{ backgroundColor: '#791E75' }}
                className="text-white hover:opacity-90"
              >
                {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
