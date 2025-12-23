import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Building2, Users, Home, Plus, Eye, Edit, Trash2, Bell,
  Search, Phone, Mail, CreditCard, LogOut, ArrowLeft,
  Loader2, Building, UserCircle, BanknoteIcon, MessageCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryClient } from '@/lib/queryClient';

interface Landlord {
  id: number;
  name: string;
  email: string | null;
  mobile: string | null;
  bankAccountNo: string | null;
  sortCode: string | null;
  isActive: boolean;
  createdAt: string;
  propertyCount?: number;
}

export default function LandlordManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedLandlord, setSelectedLandlord] = useState<Landlord | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    bankAccountNo: '',
    sortCode: ''
  });

  // Fetch landlords
  const { data: landlords = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const response = await fetch('/api/crm/landlords');
      if (!response.ok) throw new Error('Failed to fetch landlords');
      return response.json();
    }
  });

  // Create landlord mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch('/api/crm/landlords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create landlord');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Landlord created successfully' });
      setShowAddDialog(false);
      resetForm();
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create landlord', variant: 'destructive' });
    }
  });

  // Update landlord mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: typeof formData }) => {
      const response = await fetch(`/api/crm/landlords/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update landlord');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Landlord updated successfully' });
      setShowEditDialog(false);
      setSelectedLandlord(null);
      resetForm();
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update landlord', variant: 'destructive' });
    }
  });

  // Delete landlord mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/landlords/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete landlord');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Landlord deleted successfully' });
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete landlord', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({ name: '', email: '', mobile: '', bankAccountNo: '', sortCode: '' });
  };

  const handleEdit = (landlord: Landlord) => {
    setSelectedLandlord(landlord);
    setFormData({
      name: landlord.name || '',
      email: landlord.email || '',
      mobile: landlord.mobile || '',
      bankAccountNo: landlord.bankAccountNo || '',
      sortCode: landlord.sortCode || ''
    });
    setShowEditDialog(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this landlord?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter landlords
  const filteredLandlords = landlords.filter((l: Landlord) =>
    l.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.mobile?.includes(searchTerm)
  );

  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    } else {
      setLocation('/crm/login');
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
    setLocation('/crm/login');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button variant="ghost" size="icon" onClick={() => setLocation('/crm/dashboard')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Building2 className="h-8 w-8 text-[#791E75] ml-2 mr-3" />
              <h1 className="text-xl font-semibold">Landlord Management</h1>
            </div>

            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="icon">
                <Bell className="h-5 w-5" />
              </Button>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-700">{user?.fullName}</span>
                <Button variant="ghost" size="icon" onClick={handleLogout}>
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Landlords</p>
                    <p className="text-2xl font-bold mt-2">{landlords.length}</p>
                  </div>
                  <div className="p-3 rounded-full bg-[#791E75]">
                    <Users className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Active</p>
                    <p className="text-2xl font-bold mt-2">
                      {landlords.filter((l: Landlord) => l.isActive).length}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-green-500">
                    <UserCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">With Bank Details</p>
                    <p className="text-2xl font-bold mt-2">
                      {landlords.filter((l: Landlord) => l.bankAccountNo).length}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-[#F8B324]">
                    <BanknoteIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Companies</p>
                    <p className="text-2xl font-bold mt-2">
                      {landlords.filter((l: Landlord) =>
                        l.name?.toLowerCase().includes('ltd') ||
                        l.name?.toLowerCase().includes('limited')
                      ).length}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-500">
                    <Building className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Add */}
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search landlords by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Landlord
            </Button>
          </div>

          {/* Landlords Table */}
          <Card>
            <CardHeader>
              <CardTitle>Landlords Directory</CardTitle>
              <CardDescription>Manage all landlords and their property portfolios</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                </div>
              ) : filteredLandlords.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No landlords found</h3>
                  <p className="text-gray-500 mb-4">
                    {landlords.length === 0 ? 'Add your first landlord to get started' : 'Try adjusting your search'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Bank Details</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLandlords.map((landlord: Landlord) => (
                      <TableRow key={landlord.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#791E75] flex items-center justify-center text-white font-semibold">
                              {landlord.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{landlord.name}</p>
                              {(landlord.name?.toLowerCase().includes('ltd') ||
                                landlord.name?.toLowerCase().includes('limited')) && (
                                <Badge variant="outline" className="text-xs">Company</Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {landlord.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span>{landlord.email}</span>
                              </div>
                            )}
                            {landlord.mobile && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span>{landlord.mobile}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {landlord.bankAccountNo ? (
                            <div className="space-y-1 text-sm">
                              <div className="flex items-center gap-2">
                                <CreditCard className="h-3 w-3 text-gray-400" />
                                <span>****{landlord.bankAccountNo?.slice(-4)}</span>
                              </div>
                              {landlord.sortCode && (
                                <span className="text-gray-500">{landlord.sortCode}</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Not provided</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={landlord.isActive ? 'bg-green-500' : 'bg-gray-500'}>
                            {landlord.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(landlord)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setLocation(`/crm/landlords/${landlord.id}/properties`)}>
                              <Home className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setLocation(`/crm/communications?landlordId=${landlord.id}`)} title="Communication History">
                              <MessageCircle className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(landlord.id)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
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
        </div>
      </main>

      {/* Add Landlord Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Landlord</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name / Company Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter landlord or company name"
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <Label htmlFor="mobile">Mobile</Label>
              <Input
                id="mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                placeholder="07xxx xxxxxx"
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Bank Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bankAccountNo">Account Number</Label>
                  <Input
                    id="bankAccountNo"
                    value={formData.bankAccountNo}
                    onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                    placeholder="12345678"
                  />
                </div>
                <div>
                  <Label htmlFor="sortCode">Sort Code</Label>
                  <Input
                    id="sortCode"
                    value={formData.sortCode}
                    onChange={(e) => setFormData({ ...formData, sortCode: e.target.value })}
                    placeholder="12-34-56"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(formData)}
              disabled={!formData.name || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Landlord
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Landlord Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Landlord</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Name / Company Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="edit-mobile">Mobile</Label>
              <Input
                id="edit-mobile"
                value={formData.mobile}
                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Bank Details</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-bankAccountNo">Account Number</Label>
                  <Input
                    id="edit-bankAccountNo"
                    value={formData.bankAccountNo}
                    onChange={(e) => setFormData({ ...formData, bankAccountNo: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-sortCode">Sort Code</Label>
                  <Input
                    id="edit-sortCode"
                    value={formData.sortCode}
                    onChange={(e) => setFormData({ ...formData, sortCode: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedLandlord(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedLandlord && updateMutation.mutate({ id: selectedLandlord.id, data: formData })}
              disabled={!formData.name || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
