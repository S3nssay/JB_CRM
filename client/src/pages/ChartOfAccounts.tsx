import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus, Search, Pencil, Lock, ChevronDown, ChevronRight, BookOpen, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Account {
  id: number;
  account_code: string;
  account_name: string;
  account_type: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  parent_account_id: number | null;
  is_system_account: boolean;
  is_active: boolean;
  description: string | null;
  normal_balance: 'debit' | 'credit';
  default_tax_rate_id: number | null;
  opening_balance: number | null;
  sort_order: number | null;
}

interface AccountFormData {
  account_code: string;
  account_name: string;
  account_type: string;
  parent_account_id: string;
  description: string;
  normal_balance: string;
  default_tax_rate_id: string;
  sort_order: string;
  is_active: boolean;
}

const ACCOUNT_TYPE_GROUPS: { key: Account['account_type']; label: string }[] = [
  { key: 'asset', label: 'Assets' },
  { key: 'liability', label: 'Liabilities' },
  { key: 'equity', label: 'Equity' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'expense', label: 'Expenses' },
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'asset', label: 'Asset' },
  { value: 'liability', label: 'Liability' },
  { value: 'equity', label: 'Equity' },
  { value: 'revenue', label: 'Revenue' },
  { value: 'expense', label: 'Expense' },
];

const EMPTY_FORM: AccountFormData = {
  account_code: '',
  account_name: '',
  account_type: '',
  parent_account_id: '',
  description: '',
  normal_balance: '',
  default_tax_rate_id: '',
  sort_order: '',
  is_active: true,
};

export default function ChartOfAccounts() {
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(ACCOUNT_TYPE_GROUPS.map((g) => g.key))
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [form, setForm] = useState<AccountFormData>(EMPTY_FORM);

  // --- Queries ---
  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts'],
  });

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      return apiRequest('/api/crm/accounting/chart-of-accounts', 'POST', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/chart-of-accounts'] });
      toast({ title: 'Account created', description: 'The account has been added successfully.' });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      return apiRequest(`/api/crm/accounting/chart-of-accounts/${id}`, 'PUT', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/chart-of-accounts'] });
      toast({ title: 'Account updated', description: 'The account has been updated successfully.' });
      closeDialog();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // --- Filtering ---
  const filteredAccounts = useMemo(() => {
    return accounts.filter((account) => {
      if (!showInactive && !account.is_active) return false;
      if (typeFilter !== 'all' && account.account_type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = account.account_name.toLowerCase().includes(q);
        const matchesCode = account.account_code.toLowerCase().includes(q);
        if (!matchesName && !matchesCode) return false;
      }
      return true;
    });
  }, [accounts, showInactive, typeFilter, searchQuery]);

  const groupedAccounts = useMemo(() => {
    const groups: Record<string, Account[]> = {};
    for (const group of ACCOUNT_TYPE_GROUPS) {
      groups[group.key] = [];
    }
    for (const account of filteredAccounts) {
      if (groups[account.account_type]) {
        groups[account.account_type].push(account);
      }
    }
    // Sort each group by sort_order then code
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const orderA = a.sort_order ?? 9999;
        const orderB = b.sort_order ?? 9999;
        if (orderA !== orderB) return orderA - orderB;
        return a.account_code.localeCompare(b.account_code);
      });
    }
    return groups;
  }, [filteredAccounts]);

  // Which groups to display based on type filter
  const visibleGroups = useMemo(() => {
    if (typeFilter !== 'all') {
      return ACCOUNT_TYPE_GROUPS.filter((g) => g.key === typeFilter);
    }
    return ACCOUNT_TYPE_GROUPS;
  }, [typeFilter]);

  // --- Dialog helpers ---
  function openCreateDialog() {
    setEditingAccount(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(account: Account) {
    setEditingAccount(account);
    setForm({
      account_code: account.account_code,
      account_name: account.account_name,
      account_type: account.account_type,
      parent_account_id: account.parent_account_id ? String(account.parent_account_id) : '',
      description: account.description ?? '',
      normal_balance: account.normal_balance,
      default_tax_rate_id: account.default_tax_rate_id ? String(account.default_tax_rate_id) : '',
      sort_order: account.sort_order != null ? String(account.sort_order) : '',
      is_active: account.is_active,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingAccount(null);
    setForm(EMPTY_FORM);
  }

  function toggleGroup(key: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function handleSubmit() {
    if (!form.account_code.trim() || !form.account_name.trim() || !form.account_type || !form.normal_balance) {
      toast({ title: 'Validation error', description: 'Please fill in all required fields.', variant: 'destructive' });
      return;
    }

    const payload: Record<string, unknown> = {
      account_code: form.account_code.trim(),
      account_name: form.account_name.trim(),
      account_type: form.account_type,
      normal_balance: form.normal_balance,
      description: form.description.trim() || null,
      parent_account_id: form.parent_account_id ? Number(form.parent_account_id) : null,
      default_tax_rate_id: form.default_tax_rate_id ? Number(form.default_tax_rate_id) : null,
      sort_order: form.sort_order ? Number(form.sort_order) : null,
    };

    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, data: { ...payload, is_active: form.is_active } });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Potential parent accounts for the dropdown (exclude the editing account itself)
  const parentOptions = useMemo(() => {
    return accounts
      .filter((a) => a.is_active && (!editingAccount || a.id !== editingAccount.id))
      .sort((a, b) => a.account_code.localeCompare(b.account_code));
  }, [accounts, editingAccount]);

  // Total count for the header
  const totalActive = accounts.filter((a) => a.is_active).length;
  const totalInactive = accounts.filter((a) => !a.is_active).length;

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#791E75' }}>
            <BookOpen className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chart of Accounts</h1>
            <p className="text-sm text-gray-500">
              {totalActive} active account{totalActive !== 1 ? 's' : ''}
              {totalInactive > 0 && ` \u00B7 ${totalInactive} inactive`}
            </p>
          </div>
        </div>
        <Button
          onClick={openCreateDialog}
          style={{ backgroundColor: '#791E75' }}
          className="hover:opacity-90 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by account name or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="w-[180px]">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <Label htmlFor="show-inactive" className="text-sm text-gray-600 cursor-pointer">
                Show inactive
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredAccounts.length === 0 && (
        <Card>
          <CardContent className="py-16 text-center">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No accounts found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery || typeFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Get started by adding your first account.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Grouped Account Tables */}
      {!isLoading && filteredAccounts.length > 0 && (
        <div className="space-y-3">
          {visibleGroups.map((group) => {
            const groupAccounts = groupedAccounts[group.key] || [];
            const isExpanded = expandedGroups.has(group.key);

            if (groupAccounts.length === 0 && (searchQuery || typeFilter !== 'all')) {
              return null;
            }

            return (
              <Collapsible
                key={group.key}
                open={isExpanded}
                onOpenChange={() => toggleGroup(group.key)}
              >
                <Card>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer select-none hover:bg-gray-50 transition-colors py-3 px-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-400" />
                          )}
                          <CardTitle className="text-base font-semibold text-gray-800">
                            {group.label}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs font-normal">
                            {groupAccounts.length}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {groupAccounts.length === 0 ? (
                      <CardContent className="py-8 text-center text-sm text-gray-400">
                        No accounts in this category.
                      </CardContent>
                    ) : (
                      <CardContent className="p-0">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-gray-50/50">
                              <TableHead className="w-[120px] pl-6">Code</TableHead>
                              <TableHead>Account Name</TableHead>
                              <TableHead className="w-[120px]">Type</TableHead>
                              <TableHead className="w-[130px]">Normal Balance</TableHead>
                              <TableHead className="w-[100px]">Status</TableHead>
                              <TableHead className="w-[80px] text-right pr-6">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {groupAccounts.map((account) => (
                              <TableRow key={account.id} className={!account.is_active ? 'opacity-50' : ''}>
                                <TableCell className="pl-6 font-mono text-sm font-medium">
                                  {account.account_code}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900">{account.account_name}</span>
                                    {account.is_system_account && (
                                      <Lock className="h-3.5 w-3.5 text-gray-400" />
                                    )}
                                  </div>
                                  {account.description && (
                                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                      {account.description}
                                    </p>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-gray-600 capitalize">
                                    {account.account_type}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  <span className="text-sm text-gray-600 capitalize">
                                    {account.normal_balance}
                                  </span>
                                </TableCell>
                                <TableCell>
                                  {account.is_active ? (
                                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-0 text-xs">
                                      Active
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="text-xs">
                                      Inactive
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(account)}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Pencil className="h-4 w-4 text-gray-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </CardContent>
                    )}
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-[540px]">
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? 'Edit Account' : 'Add New Account'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Account Code + Name row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_code">
                  Account Code <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="account_code"
                  placeholder="e.g. 1000"
                  value={form.account_code}
                  onChange={(e) => setForm((prev) => ({ ...prev, account_code: e.target.value }))}
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="account_name">
                  Account Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="account_name"
                  placeholder="e.g. Cash at Bank"
                  value={form.account_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, account_name: e.target.value }))}
                />
              </div>
            </div>

            {/* Type + Normal Balance */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="account_type">
                  Account Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.account_type}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, account_type: v }))}
                >
                  <SelectTrigger id="account_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="normal_balance">
                  Normal Balance <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={form.normal_balance}
                  onValueChange={(v) => setForm((prev) => ({ ...prev, normal_balance: v }))}
                >
                  <SelectTrigger id="normal_balance">
                    <SelectValue placeholder="Select balance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Parent Account */}
            <div className="space-y-2">
              <Label htmlFor="parent_account">Parent Account</Label>
              <Select
                value={form.parent_account_id}
                onValueChange={(v) => setForm((prev) => ({ ...prev, parent_account_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger id="parent_account">
                  <SelectValue placeholder="None (top-level account)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None (top-level account)</SelectItem>
                  {parentOptions.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.account_code} - {a.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sort Order + Tax Rate */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sort_order">Sort Order</Label>
                <Input
                  id="sort_order"
                  type="number"
                  placeholder="e.g. 10"
                  value={form.sort_order}
                  onChange={(e) => setForm((prev) => ({ ...prev, sort_order: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tax_rate">Default Tax Rate ID</Label>
                <Input
                  id="tax_rate"
                  type="number"
                  placeholder="Optional"
                  value={form.default_tax_rate_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, default_tax_rate_id: e.target.value }))}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Brief description of this account..."
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Active toggle (edit mode only) */}
            {editingAccount && (
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <Label className="text-sm font-medium">Active Status</Label>
                  <p className="text-xs text-gray-500">Inactive accounts are hidden from transaction forms.</p>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm((prev) => ({ ...prev, is_active: v }))}
                />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog} disabled={isSaving}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving}
              style={{ backgroundColor: '#791E75' }}
              className="hover:opacity-90 text-white"
            >
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingAccount ? 'Save Changes' : 'Create Account'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
