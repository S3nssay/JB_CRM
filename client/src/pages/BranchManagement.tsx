import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit2, PowerOff, Building2 } from 'lucide-react';

interface Branch {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  manager_id: number | null;
  is_active: boolean;
  created_at: string;
}

interface BranchForm {
  name: string;
  address: string;
  phone: string;
  email: string;
}

const emptyForm: BranchForm = { name: '', address: '', phone: '', email: '' };

export default function BranchManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['/api/crm/branches'],
    queryFn: () => apiRequest('GET', '/api/crm/branches').then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (data: BranchForm) => apiRequest('POST', '/api/crm/branches', data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/branches'] });
      toast({ title: 'Branch created' });
      setDialogOpen(false);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<BranchForm> }) =>
      apiRequest('PUT', `/api/crm/branches/${id}`, data).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/branches'] });
      toast({ title: 'Branch updated' });
      setDialogOpen(false);
      setEditBranch(null);
      setForm(emptyForm);
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/branches/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/branches'] });
      toast({ title: 'Branch deactivated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const openCreate = () => {
    setEditBranch(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (branch: Branch) => {
    setEditBranch(branch);
    setForm({
      name: branch.name,
      address: branch.address || '',
      phone: branch.phone || '',
      email: branch.email || '',
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      toast({ title: 'Name is required', variant: 'destructive' });
      return;
    }
    if (editBranch) {
      updateMutation.mutate({ id: editBranch.id, data: form });
    } else {
      createMutation.mutate(form);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-6 w-6 text-[#791E75]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Branch Management</h1>
            <p className="text-sm text-gray-500">Manage office branches across your organisation</p>
          </div>
        </div>
        <Button onClick={openCreate} className="bg-[#791E75] hover:bg-[#5a1557]">
          <Plus className="h-4 w-4 mr-2" /> New Branch
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Branches ({branches.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-gray-400">Loading...</div>
          ) : branches.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No branches found. Create your first branch.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map(branch => (
                  <TableRow key={branch.id}>
                    <TableCell className="font-medium">{branch.name}</TableCell>
                    <TableCell className="text-gray-600">{branch.address || '—'}</TableCell>
                    <TableCell className="text-gray-600">{branch.phone || '—'}</TableCell>
                    <TableCell className="text-gray-600">{branch.email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={branch.is_active ? 'default' : 'secondary'}>
                        {branch.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(branch)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        {branch.is_active && (
                          <Button
                            variant="ghost" size="sm"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => deactivateMutation.mutate(branch.id)}
                          >
                            <PowerOff className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editBranch ? 'Edit Branch' : 'New Branch'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Maida Vale Office"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Full postal address"
              />
            </div>
            <div>
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="020 7000 0000"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                placeholder="branch@johnbarclay.co.uk"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#791E75] hover:bg-[#5a1557]"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editBranch ? 'Save Changes' : 'Create Branch'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
