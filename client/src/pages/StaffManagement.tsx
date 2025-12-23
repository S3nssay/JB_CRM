import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, Link } from 'wouter';
import { format } from 'date-fns';
import {
  Users, Plus, Search, Filter, Eye, Edit, Trash2, Phone, Mail,
  Building2, Calendar, Clock, Award, UserCheck, UserX, Briefcase,
  GraduationCap, AlertTriangle, CheckCircle, XCircle, Loader2,
  Shield, Settings, UserPlus, Key, ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface StaffMember {
  id: number;
  username: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: string;
  department: string | null;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
  profile: {
    employeeId: string;
    jobTitle: string;
    employmentType: string;
    startDate: string;
    baseSalary: number | null;
    commissionRate: string | null;
    workingDays: string[];
    skills: string[];
    emergencyContact: string | null;
    emergencyContactPhone: string | null;
    performanceRating: string | null;
  } | null;
}

interface EstateAgencyRole {
  id: number;
  roleCode: string;
  roleName: string;
  description: string | null;
  department: string;
  reportsTo: string | null;
  requiredQualifications: string[] | null;
  compensationType: string | null;
  isActive: boolean;
}

interface RoleAssignment {
  id: number;
  userId: number;
  roleId: number;
  roleName: string;
  roleCode: string;
  department: string;
  isPrimaryRole: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  notes: string | null;
  isActive: boolean;
}

const departmentOptions = [
  { value: 'sales', label: 'Sales' },
  { value: 'lettings', label: 'Lettings' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'admin', label: 'Administration' },
  { value: 'management', label: 'Management' },
];

const roleOptions = [
  { value: 'admin', label: 'Administrator' },
  { value: 'agent', label: 'Estate Agent' },
  { value: 'maintenance_staff', label: 'Maintenance Staff' },
];

const employmentTypeOptions = [
  { value: 'full_time', label: 'Full Time' },
  { value: 'part_time', label: 'Part Time' },
  { value: 'contractor', label: 'Contractor' },
];

export default function StaffManagement() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showRoleAssignDialog, setShowRoleAssignDialog] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  // Fetch staff
  const { data: staff, isLoading } = useQuery<StaffMember[]>({
    queryKey: ['/api/crm/staff', departmentFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (departmentFilter !== 'all') params.append('department', departmentFilter);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      const response = await fetch(`/api/crm/staff?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch staff');
      return response.json();
    }
  });

  // Fetch estate agency roles
  const { data: roles } = useQuery<EstateAgencyRole[]>({
    queryKey: ['/api/crm/roles'],
    queryFn: async () => {
      const response = await fetch('/api/crm/roles');
      if (!response.ok) throw new Error('Failed to fetch roles');
      return response.json();
    }
  });

  // Fetch role assignments for selected staff
  const { data: staffRoleAssignments, refetch: refetchStaffRoles } = useQuery<RoleAssignment[]>({
    queryKey: ['/api/crm/staff', selectedStaff?.id, 'roles'],
    queryFn: async () => {
      if (!selectedStaff) return [];
      const response = await fetch(`/api/crm/staff/${selectedStaff.id}/roles`);
      if (!response.ok) throw new Error('Failed to fetch role assignments');
      return response.json();
    },
    enabled: !!selectedStaff
  });

  // Initialize roles mutation
  const initializeRolesMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/crm/roles/initialize', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to initialize roles');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/roles'] });
      toast({ title: 'Success', description: 'Estate agency roles initialized' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Assign role mutation
  const assignRoleMutation = useMutation({
    mutationFn: async ({ userId, roleId, isPrimaryRole }: { userId: number; roleId: number; isPrimaryRole: boolean }) => {
      const response = await fetch(`/api/crm/staff/${userId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId, isPrimaryRole })
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to assign role');
      }
      return response.json();
    },
    onSuccess: () => {
      refetchStaffRoles();
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff'] });
      setShowRoleAssignDialog(false);
      setSelectedRoleId('');
      toast({ title: 'Success', description: 'Role assigned successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Remove role assignment mutation
  const removeRoleAssignmentMutation = useMutation({
    mutationFn: async ({ userId, assignmentId }: { userId: number; assignmentId: number }) => {
      const response = await fetch(`/api/crm/staff/${userId}/roles/${assignmentId}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to remove role');
      return response.json();
    },
    onSuccess: () => {
      refetchStaffRoles();
      toast({ title: 'Success', description: 'Role removed' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Add staff mutation
  const addStaffMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/crm/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create staff member');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff'] });
      setShowAddDialog(false);
      toast({ title: 'Success', description: 'Staff member added successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Update staff mutation
  const updateStaffMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/crm/staff/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) throw new Error('Failed to update staff member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff'] });
      setShowEditDialog(false);
      toast({ title: 'Success', description: 'Staff member updated successfully' });
    }
  });

  // Delete/deactivate staff mutation
  const deleteStaffMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/crm/staff/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to deactivate staff member');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/staff'] });
      toast({ title: 'Success', description: 'Staff member deactivated' });
    }
  });

  // Filter staff by search term
  const filteredStaff = staff?.filter(s =>
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Stats
  const totalStaff = staff?.length || 0;
  const activeStaff = staff?.filter(s => s.isActive).length || 0;
  const byDepartment = staff?.reduce((acc, s) => {
    const dept = s.department || 'unassigned';
    acc[dept] = (acc[dept] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  const addForm = useForm({
    defaultValues: {
      username: '',
      password: '',
      email: '',
      fullName: '',
      phone: '',
      role: 'agent',
      department: 'sales',
      jobTitle: '',
      employmentType: 'full_time',
      startDate: new Date().toISOString().split('T')[0],
      baseSalary: '',
      commissionRate: '',
      emergencyContact: '',
      emergencyContactPhone: '',
    }
  });

  const handleAddStaff = (data: any) => {
    addStaffMutation.mutate({
      ...data,
      baseSalary: data.baseSalary ? parseFloat(data.baseSalary) : null,
      commissionRate: data.commissionRate ? parseFloat(data.commissionRate) : null,
    });
  };

  const handleViewProfile = (member: StaffMember) => {
    setSelectedStaff(member);
    setShowProfileDialog(true);
  };

  const handleEditStaff = (member: StaffMember) => {
    setSelectedStaff(member);
    setShowEditDialog(true);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-purple-500';
      case 'agent': return 'bg-blue-500';
      case 'maintenance_staff': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/portal">
              <Button variant="ghost" size="icon" data-testid="button-back-to-portal">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Staff Management</h1>
              <p className="text-gray-500">Manage your team members, attendance, and performance</p>
            </div>
          </div>
          <Button onClick={() => setShowAddDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Staff Member
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total Staff</p>
                  <p className="text-2xl font-bold">{totalStaff}</p>
                </div>
                <Users className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Active</p>
                  <p className="text-2xl font-bold text-green-600">{activeStaff}</p>
                </div>
                <UserCheck className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Inactive</p>
                  <p className="text-2xl font-bold text-red-600">{totalStaff - activeStaff}</p>
                </div>
                <UserX className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Departments</p>
                  <p className="text-2xl font-bold">{Object.keys(byDepartment).length}</p>
                </div>
                <Building2 className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="list" className="space-y-4">
          <TabsList>
            <TabsTrigger value="list">Staff List</TabsTrigger>
            <TabsTrigger value="departments">By Department</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
            <TabsTrigger value="leave">Leave Requests</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="space-y-4">
            {/* Filters */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Search staff..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Departments</SelectItem>
                      {departmentOptions.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Staff Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="text-center p-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No staff members found</p>
                    <Button variant="outline" className="mt-4" onClick={() => setShowAddDialog(true)}>
                      Add First Staff Member
                    </Button>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Staff Member</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Login</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStaff.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar>
                                <AvatarFallback className="bg-[#791E75] text-white">
                                  {getInitials(member.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="font-medium">{member.fullName}</p>
                                <p className="text-sm text-gray-500">
                                  {member.profile?.employeeId || member.username}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getRoleBadgeColor(member.role)}>
                              {member.role.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="capitalize">{member.department || 'Unassigned'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-gray-400" />
                                {member.email}
                              </div>
                              {member.phone && (
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <Phone className="h-3 w-3 text-gray-400" />
                                  {member.phone}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {member.isActive ? (
                              <Badge className="bg-green-500">Active</Badge>
                            ) : (
                              <Badge variant="secondary">Inactive</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {member.lastLogin
                              ? format(new Date(member.lastLogin), 'dd MMM yyyy HH:mm')
                              : 'Never'}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewProfile(member)}
                                title="View Profile"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditStaff(member)}
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (confirm('Are you sure you want to deactivate this staff member?')) {
                                    deleteStaffMutation.mutate(member.id);
                                  }
                                }}
                                title="Deactivate"
                              >
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
          </TabsContent>

          <TabsContent value="departments" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(byDepartment).map(([dept, count]) => (
                <Card key={dept}>
                  <CardHeader>
                    <CardTitle className="capitalize">{dept}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-3xl font-bold">{count}</span>
                      <span className="text-gray-500">staff members</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {filteredStaff
                        .filter(s => (s.department || 'unassigned') === dept)
                        .slice(0, 3)
                        .map(s => (
                          <div key={s.id} className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="bg-[#791E75] text-white text-xs">
                                {getInitials(s.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{s.fullName}</span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Roles & Permissions Tab */}
          <TabsContent value="roles" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Estate Agency Roles
                  </CardTitle>
                  {(!roles || roles.length === 0) && (
                    <Button
                      onClick={() => initializeRolesMutation.mutate()}
                      disabled={initializeRolesMutation.isPending}
                    >
                      {initializeRolesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      <Settings className="h-4 w-4 mr-2" />
                      Initialize Default Roles
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {!roles || roles.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>No roles configured yet.</p>
                    <p className="text-sm">Click "Initialize Default Roles" to set up the standard estate agency roles.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {roles.map((role) => (
                      <Card key={role.id} className="bg-gray-50">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-semibold">{role.roleName}</h3>
                              <Badge variant="outline" className="mt-1 capitalize">{role.department}</Badge>
                            </div>
                            <Key className="h-5 w-5 text-[#791E75]" />
                          </div>
                          {role.description && (
                            <p className="text-sm text-gray-600 mt-2 line-clamp-2">{role.description}</p>
                          )}
                          {role.requiredQualifications && role.requiredQualifications.length > 0 && (
                            <div className="mt-3">
                              <p className="text-xs text-gray-500 mb-1">Required Qualifications:</p>
                              <div className="flex flex-wrap gap-1">
                                {role.requiredQualifications.map((qual, idx) => (
                                  <Badge key={idx} variant="secondary" className="text-xs">{qual}</Badge>
                                ))}
                              </div>
                            </div>
                          )}
                          {role.reportsTo && (
                            <p className="text-xs text-gray-500 mt-2">
                              Reports to: <span className="capitalize">{role.reportsTo.replace('_', ' ')}</span>
                            </p>
                          )}
                          <p className="text-xs text-gray-400 mt-2">
                            Compensation: <span className="capitalize">{role.compensationType?.replace('_', ' + ') || 'N/A'}</span>
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Staff Role Assignments */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Staff Role Assignments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">
                  Click on a staff member in the Staff List tab to assign roles and permissions.
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Member</TableHead>
                      <TableHead>Assigned Role</TableHead>
                      <TableHead>Department</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.slice(0, 10).map((member) => (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">{member.fullName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">System Role: {member.role}</Badge>
                        </TableCell>
                        <TableCell className="capitalize">{member.department || 'Unassigned'}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedStaff(member);
                              setShowRoleAssignDialog(true);
                            }}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            Assign Role
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500 text-center py-8">No pending leave requests</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Add Staff Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Staff Member</DialogTitle>
          </DialogHeader>
          <Form {...addForm}>
            <form onSubmit={addForm.handleSubmit(handleAddStaff)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={addForm.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email *</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="john@example.com" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username *</FormLabel>
                      <FormControl>
                        <Input placeholder="jsmith" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Password *</FormLabel>
                      <FormControl>
                        <Input type="password" placeholder="********" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+44 7700 900000" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roleOptions.map(r => (
                            <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departmentOptions.map(d => (
                            <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Senior Agent" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="employmentType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employmentTypeOptions.map(e => (
                            <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="baseSalary"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Salary (Annual)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="35000" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={addForm.control}
                  name="commissionRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Commission Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" placeholder="1.5" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Emergency Contact</h4>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={addForm.control}
                    name="emergencyContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane Smith" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={addForm.control}
                    name="emergencyContactPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl>
                          <Input placeholder="+44 7700 900000" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={addStaffMutation.isPending}>
                  {addStaffMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Staff Member
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Staff Profile Dialog */}
      <Dialog open={showProfileDialog} onOpenChange={setShowProfileDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Staff Profile</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-6">
              {/* Header */}
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-[#791E75] text-white text-xl">
                    {getInitials(selectedStaff.fullName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h2 className="text-xl font-bold">{selectedStaff.fullName}</h2>
                  <p className="text-gray-500">
                    {selectedStaff.profile?.jobTitle || selectedStaff.role}
                  </p>
                  <div className="flex gap-2 mt-2">
                    <Badge className={getRoleBadgeColor(selectedStaff.role)}>
                      {selectedStaff.role.replace('_', ' ')}
                    </Badge>
                    {selectedStaff.isActive ? (
                      <Badge className="bg-green-500">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Inactive</Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">Contact Information</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>{selectedStaff.email}</span>
                    </div>
                    {selectedStaff.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <span>{selectedStaff.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold border-b pb-2">Employment Details</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Employee ID:</span>
                      <span className="font-medium">{selectedStaff.profile?.employeeId || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Department:</span>
                      <span className="font-medium capitalize">{selectedStaff.department || 'Unassigned'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Employment Type:</span>
                      <span className="font-medium capitalize">
                        {selectedStaff.profile?.employmentType?.replace('_', ' ') || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Start Date:</span>
                      <span className="font-medium">
                        {selectedStaff.profile?.startDate
                          ? format(new Date(selectedStaff.profile.startDate), 'dd MMM yyyy')
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedStaff.profile?.emergencyContact && (
                  <div className="space-y-4 col-span-2">
                    <h3 className="font-semibold border-b pb-2">Emergency Contact</h3>
                    <div className="flex gap-8">
                      <div>
                        <span className="text-gray-500">Name: </span>
                        <span className="font-medium">{selectedStaff.profile.emergencyContact}</span>
                      </div>
                      {selectedStaff.profile.emergencyContactPhone && (
                        <div>
                          <span className="text-gray-500">Phone: </span>
                          <span className="font-medium">{selectedStaff.profile.emergencyContactPhone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedStaff.profile?.skills && selectedStaff.profile.skills.length > 0 && (
                  <div className="space-y-4 col-span-2">
                    <h3 className="font-semibold border-b pb-2">Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedStaff.profile.skills.map((skill, idx) => (
                        <Badge key={idx} variant="outline">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowProfileDialog(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  setShowProfileDialog(false);
                  handleEditStaff(selectedStaff);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Profile
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Staff Dialog - Similar to Add but with pre-filled data */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Staff Member</DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Full Name</label>
                  <Input defaultValue={selectedStaff.fullName} id="edit-fullName" />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input defaultValue={selectedStaff.email} id="edit-email" />
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input defaultValue={selectedStaff.phone || ''} id="edit-phone" />
                </div>
                <div>
                  <label className="text-sm font-medium">Department</label>
                  <Select defaultValue={selectedStaff.department || 'sales'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentOptions.map(d => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium">Status</label>
                  <Select defaultValue={selectedStaff.isActive ? 'active' : 'inactive'}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={() => {
                  const fullName = (document.getElementById('edit-fullName') as HTMLInputElement)?.value;
                  const email = (document.getElementById('edit-email') as HTMLInputElement)?.value;
                  const phone = (document.getElementById('edit-phone') as HTMLInputElement)?.value;
                  updateStaffMutation.mutate({
                    id: selectedStaff.id,
                    data: { fullName, email, phone }
                  });
                }}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Role Assignment Dialog */}
      <Dialog open={showRoleAssignDialog} onOpenChange={setShowRoleAssignDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-[#791E75]" />
              Assign Role - {selectedStaff?.fullName}
            </DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-6">
              {/* Current Role Assignments */}
              <div>
                <h3 className="font-semibold mb-3">Current Role Assignments</h3>
                {staffRoleAssignments && staffRoleAssignments.length > 0 ? (
                  <div className="space-y-2">
                    {staffRoleAssignments.map((assignment) => (
                      <div
                        key={assignment.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Key className="h-4 w-4 text-[#791E75]" />
                          <div>
                            <p className="font-medium">{assignment.roleName}</p>
                            <p className="text-xs text-gray-500 capitalize">{assignment.department}</p>
                          </div>
                          {assignment.isPrimaryRole && (
                            <Badge className="bg-[#791E75]">Primary</Badge>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm('Remove this role assignment?')) {
                              removeRoleAssignmentMutation.mutate({
                                userId: selectedStaff.id,
                                assignmentId: assignment.id
                              });
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg text-center">
                    No roles assigned yet
                  </p>
                )}
              </div>

              {/* Assign New Role */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Assign New Role</h3>
                {roles && roles.length > 0 ? (
                  <div className="space-y-4">
                    <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role to assign..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            <div className="flex items-center gap-2">
                              <span>{role.roleName}</span>
                              <Badge variant="outline" className="text-xs capitalize">{role.department}</Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedRoleId && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-800">
                          <strong>Selected:</strong>{' '}
                          {roles.find(r => r.id.toString() === selectedRoleId)?.roleName}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                          {roles.find(r => r.id.toString() === selectedRoleId)?.description}
                        </p>
                      </div>
                    )}

                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRoleAssignDialog(false);
                          setSelectedRoleId('');
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => {
                          if (selectedRoleId) {
                            assignRoleMutation.mutate({
                              userId: selectedStaff.id,
                              roleId: parseInt(selectedRoleId),
                              isPrimaryRole: !staffRoleAssignments || staffRoleAssignments.length === 0
                            });
                          }
                        }}
                        disabled={!selectedRoleId || assignRoleMutation.isPending}
                      >
                        {assignRoleMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <Shield className="h-4 w-4 mr-2" />
                        Assign Role
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500 mb-2">No roles available.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => initializeRolesMutation.mutate()}
                      disabled={initializeRolesMutation.isPending}
                    >
                      Initialize Default Roles
                    </Button>
                  </div>
                )}
              </div>

              {/* Role Info */}
              <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                <p className="font-medium mb-2">About Estate Agency Roles:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Branch Manager</strong> - Full access to all branch operations</li>
                  <li><strong>Sales Negotiator</strong> - Manages property sales and viewings</li>
                  <li><strong>Lettings Negotiator</strong> - Handles rental enquiries and tenancies</li>
                  <li><strong>Property Manager</strong> - Manages maintenance and landlord relations</li>
                  <li><strong>Branch Administrator</strong> - Front desk and compliance tasks</li>
                  <li><strong>Mortgage Advisor</strong> - Financial services (CeMAP required)</li>
                </ul>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
