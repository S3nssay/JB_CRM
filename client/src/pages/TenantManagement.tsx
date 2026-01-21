import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Building2, Users, Home, Plus, Eye, Edit, Trash2, Bell,
  Search, Phone, Mail, LogOut, ArrowLeft, ArrowRight, Check,
  Loader2, UserCircle, Key, Calendar, FileText, MessageCircle,
  Shield, ShieldCheck, ShieldAlert, Send, RefreshCw
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queryClient } from '@/lib/queryClient';

interface Tenant {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  employer: string | null;
  employerAddress: string | null;
  employerPhone: string | null;
  jobTitle: string | null;
  annualIncome: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  status: string;
  notes: string | null;
  idVerified: boolean | null;
  idVerificationStatus: 'unverified' | 'pending' | 'verified' | 'failed' | null;
  idVerificationDate: string | null;
  createdAt: string;
  updatedAt: string;
}

type WizardStep = 'details' | 'emergency' | 'verification';

const wizardSteps: { key: WizardStep; label: string }[] = [
  { key: 'details', label: 'Basic Details' },
  { key: 'emergency', label: 'Emergency Contact' },
  { key: 'verification', label: 'Verification' }
];

export default function TenantManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [wizardStep, setWizardStep] = useState<WizardStep>('details');
  const [sendVerification, setSendVerification] = useState(true);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    mobile: '',
    address: '',
    employer: '',
    emergencyContactName: '',
    emergencyContactPhone: ''
  });

  // Fetch tenants (users with role 'tenant')
  const { data: tenants = [], isLoading, refetch } = useQuery({
    queryKey: ['/api/crm/tenants'],
    queryFn: async () => {
      const response = await fetch('/api/crm/tenants');
      if (!response.ok) throw new Error('Failed to fetch tenants');
      return response.json();
    }
  });

  // Create tenant mutation
  const createMutation = useMutation({
    mutationFn: async (data: typeof formData & { sendVerification: boolean }) => {
      const response = await fetch('/api/crm/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to create tenant');
      return response.json();
    },
    onSuccess: (data) => {
      const message = data.verificationSent
        ? 'Tenant created and verification link sent via WhatsApp!'
        : data.verificationError
          ? `Tenant created but verification failed: ${data.verificationError}`
          : sendVerification && formData.mobile
            ? 'Tenant created. Verification link will be sent.'
            : 'Tenant created successfully';
      toast({ title: 'Success', description: message });
      setShowAddDialog(false);
      resetForm();
      setWizardStep('details');
      setSendVerification(true);
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create tenant', variant: 'destructive' });
    }
  });

  // Resend verification mutation
  const resendVerificationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/tenants/${id}/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to resend verification');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Verification link sent via WhatsApp' });
      refetch();
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Mark verified mutation
  const markVerifiedMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/tenants/${id}/mark-verified`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (!response.ok) throw new Error('Failed to mark as verified');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Tenant marked as verified' });
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to mark as verified', variant: 'destructive' });
    }
  });

  // Update tenant mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<typeof formData> }) => {
      const response = await fetch(`/api/crm/tenants/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update tenant');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Tenant updated successfully' });
      setShowEditDialog(false);
      setSelectedTenant(null);
      resetForm();
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update tenant', variant: 'destructive' });
    }
  });

  // Delete tenant mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/tenants/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete tenant');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Tenant deleted successfully' });
      refetch();
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete tenant', variant: 'destructive' });
    }
  });

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      phone: '',
      mobile: '',
      address: '',
      employer: '',
      emergencyContactName: '',
      emergencyContactPhone: ''
    });
  };

  const handleEdit = (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setFormData({
      fullName: tenant.fullName || '',
      email: tenant.email || '',
      phone: tenant.phone || '',
      mobile: tenant.mobile || '',
      address: tenant.address || '',
      employer: tenant.employer || '',
      emergencyContactName: tenant.emergencyContactName || '',
      emergencyContactPhone: tenant.emergencyContactPhone || ''
    });
    setShowEditDialog(true);
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this tenant?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filter tenants
  const filteredTenants = tenants.filter((t: Tenant) =>
    t.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.phone?.includes(searchTerm)
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
              <Users className="h-8 w-8 text-[#791E75] ml-2 mr-3" />
              <h1 className="text-xl font-semibold">Tenant Management</h1>
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
                    <p className="text-sm font-medium text-gray-600">Total Tenants</p>
                    <p className="text-2xl font-bold mt-2">{tenants.length}</p>
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
                    <p className="text-sm font-medium text-gray-600">Active Tenants</p>
                    <p className="text-2xl font-bold mt-2">
                      {tenants.filter((t: Tenant) => t.status === 'active').length}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-green-500">
                    <Key className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">With Portal Access</p>
                    <p className="text-2xl font-bold mt-2">
                      {tenants.filter((t: Tenant) => t.email).length}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-[#F8B324]">
                    <UserCircle className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">New This Month</p>
                    <p className="text-2xl font-bold mt-2">
                      {tenants.filter((t: Tenant) => {
                        const created = new Date(t.createdAt);
                        const now = new Date();
                        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
                      }).length}
                    </p>
                  </div>
                  <div className="p-3 rounded-full bg-purple-500">
                    <Calendar className="h-6 w-6 text-white" />
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
                placeholder="Search tenants by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Tenant
            </Button>
          </div>

          {/* Tenants Table */}
          <Card>
            <CardHeader>
              <CardTitle>Tenants Directory</CardTitle>
              <CardDescription>Manage all tenants and their property assignments</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center items-center h-64">
                  <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
                </div>
              ) : filteredTenants.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No tenants found</h3>
                  <p className="text-gray-500 mb-4">
                    {tenants.length === 0 ? 'Add your first tenant to get started' : 'Try adjusting your search'}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>ID Verification</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((tenant: Tenant) => (
                      <TableRow key={tenant.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#791E75] flex items-center justify-center text-white font-semibold">
                              {tenant.fullName?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium">{tenant.fullName}</p>
                              {tenant.address && (
                                <p className="text-sm text-gray-500">{tenant.address}</p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {tenant.email && (
                              <div className="flex items-center gap-2 text-sm">
                                <Mail className="h-3 w-3 text-gray-400" />
                                <span>{tenant.email}</span>
                              </div>
                            )}
                            {(tenant.phone || tenant.mobile) && (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="h-3 w-3 text-gray-400" />
                                <span>{tenant.mobile || tenant.phone}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {tenant.idVerificationStatus === 'verified' ? (
                              <Badge className="bg-green-500 flex items-center gap-1">
                                <ShieldCheck className="h-3 w-3" />
                                Verified
                              </Badge>
                            ) : tenant.idVerificationStatus === 'pending' ? (
                              <Badge variant="outline" className="text-amber-600 border-amber-600 flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                Pending
                              </Badge>
                            ) : tenant.idVerificationStatus === 'failed' ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3" />
                                Failed
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <Shield className="h-3 w-3" />
                                Unverified
                              </Badge>
                            )}
                            {tenant.idVerificationStatus !== 'verified' && tenant.mobile && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => resendVerificationMutation.mutate(tenant.id)}
                                disabled={resendVerificationMutation.isPending}
                                title="Send verification link"
                              >
                                <Send className="h-3 w-3" />
                              </Button>
                            )}
                            {tenant.idVerificationStatus !== 'verified' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() => markVerifiedMutation.mutate(tenant.id)}
                                disabled={markVerifiedMutation.isPending}
                                title="Mark as verified manually"
                              >
                                <Check className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={tenant.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}>
                            {tenant.status === 'active' ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(tenant.createdAt).toLocaleDateString('en-GB')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(tenant)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Link href={`/crm/communications?tenantId=${tenant.id}`}>
                              <Button variant="ghost" size="icon" title="Communication History">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" onClick={() => setLocation(`/crm/tenants/${tenant.id}/tickets`)}>
                              <FileText className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(tenant.id)}>
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

      {/* Add Tenant Wizard Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) {
          setWizardStep('details');
          setSendVerification(true);
          resetForm();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Tenant</DialogTitle>
            <DialogDescription>
              Complete the steps below to add a new tenant
            </DialogDescription>
          </DialogHeader>

          {/* Progress Steps */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              {wizardSteps.map((step, idx) => {
                const currentIdx = wizardSteps.findIndex(s => s.key === wizardStep);
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-1 ${idx <= currentIdx ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                      idx < currentIdx
                        ? 'bg-primary text-primary-foreground'
                        : idx === currentIdx
                          ? 'bg-primary/20 text-primary border-2 border-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}>
                      {idx < currentIdx ? <Check className="h-3 w-3" /> : idx + 1}
                    </div>
                    <span className="text-xs hidden sm:inline">{step.label}</span>
                  </div>
                );
              })}
            </div>
            <Progress value={((wizardSteps.findIndex(s => s.key === wizardStep) + 1) / wizardSteps.length) * 100} className="h-2" />
          </div>

          {/* Step 1: Basic Details */}
          {wizardStep === 'details' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="Enter tenant's full name"
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="Home phone"
                  />
                </div>
                <div>
                  <Label htmlFor="mobile">Mobile *</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="07xxx xxxxxx"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Required for WhatsApp verification</p>
                </div>
              </div>
              <div>
                <Label htmlFor="address">Current Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Current address"
                />
              </div>
            </div>
          )}

          {/* Step 2: Emergency Contact */}
          {wizardStep === 'emergency' && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-lg p-4">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  Emergency contact details are important for safety reasons and should be collected for all tenants.
                </p>
              </div>
              <div>
                <Label htmlFor="emergencyContactName">Emergency Contact Name</Label>
                <Input
                  id="emergencyContactName"
                  value={formData.emergencyContactName}
                  onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  placeholder="Contact name"
                />
              </div>
              <div>
                <Label htmlFor="emergencyContactPhone">Emergency Contact Phone</Label>
                <Input
                  id="emergencyContactPhone"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  placeholder="Contact phone number"
                />
              </div>
            </div>
          )}

          {/* Step 3: Verification */}
          {wizardStep === 'verification' && (
            <div className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 rounded-lg p-4">
                <div className="flex gap-2">
                  <Shield className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-800 dark:text-blue-200">
                      ID Verification
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      The tenant will be saved as "unverified". A WhatsApp message will be sent to their mobile with a link to complete ID verification.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="sendVerification"
                    checked={sendVerification}
                    onCheckedChange={(checked) => setSendVerification(checked as boolean)}
                  />
                  <div>
                    <Label htmlFor="sendVerification" className="font-medium">
                      Send WhatsApp verification link
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically send a verification link to {formData.mobile || 'the tenant\'s mobile'}
                    </p>
                  </div>
                </div>

                {!formData.mobile && sendVerification && (
                  <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                    Mobile number is required to send WhatsApp verification. Please go back and add a mobile number.
                  </div>
                )}
              </div>

              <div className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                <h4 className="font-medium mb-2">Summary</h4>
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Name:</span> {formData.fullName}</p>
                  <p><span className="text-muted-foreground">Email:</span> {formData.email || 'Not provided'}</p>
                  <p><span className="text-muted-foreground">Mobile:</span> {formData.mobile || 'Not provided'}</p>
                  <p><span className="text-muted-foreground">Status:</span> Will be saved as <Badge variant="secondary" className="ml-1">Unverified</Badge></p>
                  {sendVerification && formData.mobile && (
                    <p className="text-green-600 dark:text-green-400 flex items-center gap-1 mt-2">
                      <Send className="h-3 w-3" /> Verification link will be sent via WhatsApp
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => {
                const currentIdx = wizardSteps.findIndex(s => s.key === wizardStep);
                if (currentIdx === 0) {
                  setShowAddDialog(false);
                  resetForm();
                  setWizardStep('details');
                } else {
                  setWizardStep(wizardSteps[currentIdx - 1].key);
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {wizardStep === 'details' ? 'Cancel' : 'Back'}
            </Button>

            {wizardStep === 'verification' ? (
              <Button
                onClick={() => createMutation.mutate({ ...formData, sendVerification })}
                disabled={!formData.fullName || createMutation.isPending || (sendVerification && !formData.mobile)}
                className="bg-gradient-to-r from-[#791E75] to-purple-600"
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Tenant
              </Button>
            ) : (
              <Button
                onClick={() => {
                  const currentIdx = wizardSteps.findIndex(s => s.key === wizardStep);
                  setWizardStep(wizardSteps[currentIdx + 1].key);
                }}
                disabled={wizardStep === 'details' && !formData.fullName}
              >
                Next
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Tenant Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Tenant</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-fullName">Full Name *</Label>
              <Input
                id="edit-fullName"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit-phone">Phone</Label>
                <Input
                  id="edit-phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
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
            </div>
            <div>
              <Label htmlFor="edit-address">Address</Label>
              <Input
                id="edit-address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Emergency Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="edit-emergencyContactName">Name</Label>
                  <Input
                    id="edit-emergencyContactName"
                    value={formData.emergencyContactName}
                    onChange={(e) => setFormData({ ...formData, emergencyContactName: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="edit-emergencyContactPhone">Phone</Label>
                  <Input
                    id="edit-emergencyContactPhone"
                    value={formData.emergencyContactPhone}
                    onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowEditDialog(false); setSelectedTenant(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                selectedTenant && updateMutation.mutate({ id: selectedTenant.id, data: formData });
              }}
              disabled={!formData.fullName || updateMutation.isPending}
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
