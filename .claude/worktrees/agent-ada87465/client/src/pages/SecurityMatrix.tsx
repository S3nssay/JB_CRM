import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePermissions, SECURITY_CLEARANCE_LABELS } from '@/hooks/use-permissions';
import { ProtectedRoute, ClearanceBadge } from '@/components/ProtectedRoute';
import { DEFAULT_ACCESS_LEVELS, DEFAULT_FEATURE_SECURITY, DEFAULT_ACCESS_LEVEL_PERMISSIONS } from '@shared/schema';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import {
  Shield, Lock, Users, Settings, FileText, Activity,
  ArrowLeft, CheckCircle, XCircle, Edit, Save, AlertTriangle,
  Loader2, Eye, UserCog, Grid3X3, History, BarChart3,
  Crown, Briefcase, Building2, Star, UserCheck, Home, ClipboardList,
  Plus, Trash2, UserPlus, Key, ChevronRight
} from 'lucide-react';

interface SecurityFeature {
  id: number;
  featureKey: string;
  featureName: string;
  description: string;
  requiredClearance: number;
  category: string;
  isEnabled: boolean;
}

interface SecurityUser {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  securityClearance: number;
  accessLevelCode?: string;
  isActive: boolean;
  lastLogin: string | null;
  customPermissions?: CustomPermission[];
}

interface CustomPermission {
  id: number;
  featureKey: string;
  featureName?: string;
  accessGranted: boolean;
  grantedBy: number;
  grantedByName?: string;
  reason?: string;
  expiresAt?: string;
  createdAt: string;
}

interface AccessLevel {
  levelCode: string;
  levelName: string;
  description: string;
  clearanceLevel: number;
  parentLevelCode: string | null;
  color: string;
  icon: string;
  isSystemLevel: boolean;
  canBeAssigned: boolean;
}

interface AuditLogEntry {
  id: number;
  userId: number;
  userName: string;
  action: string;
  targetType: string;
  targetId: number;
  targetName: string;
  oldValue: string;
  newValue: string;
  ipAddress: string;
  createdAt: string;
}

// Clearance level color coding
const getClearanceColor = (level: number) => {
  if (level >= 10) return 'bg-red-100 text-red-800 border-red-200';
  if (level >= 9) return 'bg-purple-100 text-purple-800 border-purple-200';
  if (level >= 7) return 'bg-blue-100 text-blue-800 border-blue-200';
  if (level >= 5) return 'bg-green-100 text-green-800 border-green-200';
  if (level >= 3) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  return 'bg-gray-100 text-gray-800 border-gray-200';
};

const getClearanceBgColor = (level: number) => {
  if (level >= 10) return 'bg-red-500';
  if (level >= 9) return 'bg-purple-500';
  if (level >= 7) return 'bg-blue-500';
  if (level >= 5) return 'bg-green-500';
  if (level >= 3) return 'bg-yellow-500';
  return 'bg-gray-500';
};

// Get icon component for access level
const getAccessLevelIcon = (iconName: string) => {
  const icons: Record<string, any> = {
    Shield, Crown, Briefcase, Building2, Star, UserCheck, Home, ClipboardList, Eye, Lock
  };
  const IconComponent = icons[iconName] || Shield;
  return IconComponent;
};

// Get access level info from defaults
const getAccessLevelInfo = (levelCode: string): AccessLevel | undefined => {
  return DEFAULT_ACCESS_LEVELS.find(l => l.levelCode === levelCode) as AccessLevel | undefined;
};

// Get features for an access level
const getFeaturesForAccessLevel = (levelCode: string): string[] => {
  const permissions = DEFAULT_ACCESS_LEVEL_PERMISSIONS[levelCode as keyof typeof DEFAULT_ACCESS_LEVEL_PERMISSIONS];
  return permissions ? [...permissions] : [];
};

// Check if a level has access to a feature (using levelPermissions or defaults)
const hasLevelAccess = (
  levelCode: string,
  featureKey: string,
  levelPermissions: Record<string, string[]> | undefined
): boolean => {
  if (levelPermissions && levelPermissions[levelCode]) {
    return levelPermissions[levelCode].includes(featureKey);
  }
  // Fall back to defaults
  const defaults = DEFAULT_ACCESS_LEVEL_PERMISSIONS[levelCode as keyof typeof DEFAULT_ACCESS_LEVEL_PERMISSIONS];
  return defaults ? defaults.includes(featureKey as any) : false;
};

export default function SecurityMatrix() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin } = usePermissions();

  const [editingFeature, setEditingFeature] = useState<SecurityFeature | null>(null);
  const [editingUser, setEditingUser] = useState<SecurityUser | null>(null);
  const [newClearance, setNewClearance] = useState<number>(3);
  const [selectedAccessLevel, setSelectedAccessLevel] = useState<string>('');
  const [showUserDetailDialog, setShowUserDetailDialog] = useState(false);
  const [selectedUserForDetail, setSelectedUserForDetail] = useState<SecurityUser | null>(null);
  const [showAddPermissionDialog, setShowAddPermissionDialog] = useState(false);
  const [newPermissionFeature, setNewPermissionFeature] = useState<string>('');
  const [newPermissionGranted, setNewPermissionGranted] = useState<boolean>(true);
  const [newPermissionReason, setNewPermissionReason] = useState<string>('');
  const [showCreateUserDialog, setShowCreateUserDialog] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    username: '',
    email: '',
    fullName: '',
    password: '',
    accessLevelCode: 'sales_lettings_negotiator'
  });

  // Fetch security features
  const { data: features, isLoading: loadingFeatures } = useQuery({
    queryKey: ['/api/crm/security/features'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/features', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch features');
      return res.json();
    }
  });

  // Fetch security users
  const { data: securityUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ['/api/crm/security/users'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/users', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    }
  });

  // Fetch security roles
  const { data: rolesData, isLoading: loadingRoles } = useQuery({
    queryKey: ['/api/crm/security/roles'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/roles', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    }
  });

  // Fetch audit log
  const { data: auditLog, isLoading: loadingAudit } = useQuery({
    queryKey: ['/api/crm/security/audit-log'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/audit-log?limit=50', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch audit log');
      return res.json();
    }
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['/api/crm/security/stats'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/stats', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    }
  });

  // Fetch access levels
  const { data: accessLevels } = useQuery({
    queryKey: ['/api/crm/security/access-levels'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/access-levels', { credentials: 'include' });
      if (!res.ok) {
        // Return default access levels if API doesn't exist yet
        return DEFAULT_ACCESS_LEVELS;
      }
      const data = await res.json();
      return data.length > 0 ? data : DEFAULT_ACCESS_LEVELS;
    }
  });

  // Fetch access level permissions (which levels have access to which features)
  const { data: levelPermissions } = useQuery({
    queryKey: ['/api/crm/security/level-permissions'],
    queryFn: async () => {
      const res = await fetch('/api/crm/security/level-permissions', { credentials: 'include' });
      if (!res.ok) {
        // Build from defaults if API doesn't exist
        const permissions: Record<string, string[]> = {};
        Object.entries(DEFAULT_ACCESS_LEVEL_PERMISSIONS).forEach(([levelCode, featureKeys]) => {
          permissions[levelCode] = [...featureKeys];
        });
        return permissions;
      }
      return res.json();
    }
  });

  // Fetch single user detail with custom permissions
  const { data: userDetail, refetch: refetchUserDetail } = useQuery({
    queryKey: ['/api/crm/security/users', selectedUserForDetail?.id],
    queryFn: async () => {
      if (!selectedUserForDetail?.id) return null;
      const res = await fetch(`/api/crm/security/users/${selectedUserForDetail.id}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch user details');
      return res.json();
    },
    enabled: !!selectedUserForDetail?.id
  });

  // Update feature clearance mutation
  const updateFeatureMutation = useMutation({
    mutationFn: async ({ id, requiredClearance, isEnabled }: { id: number; requiredClearance?: number; isEnabled?: boolean }) => {
      const res = await fetch(`/api/crm/security/features/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ requiredClearance, isEnabled })
      });
      if (!res.ok) throw new Error('Failed to update feature');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/features'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/audit-log'] });
      toast({ title: 'Feature updated', description: 'Security settings have been updated.' });
      setEditingFeature(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Toggle level permission mutation (individual access per level)
  const toggleLevelPermissionMutation = useMutation({
    mutationFn: async ({ levelCode, featureKey, hasAccess }: { levelCode: string; featureKey: string; hasAccess: boolean }) => {
      const res = await fetch('/api/crm/security/level-permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ levelCode, featureKey, hasAccess })
      });
      if (!res.ok) throw new Error('Failed to update permission');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/level-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/audit-log'] });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Update user clearance mutation
  const updateUserClearanceMutation = useMutation({
    mutationFn: async ({ id, securityClearance }: { id: number; securityClearance: number }) => {
      const res = await fetch(`/api/crm/security/users/${id}/clearance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ securityClearance })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/audit-log'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/stats'] });
      toast({ title: 'User updated', description: 'Security clearance has been updated.' });
      setEditingUser(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Update user access level mutation
  const updateUserAccessLevelMutation = useMutation({
    mutationFn: async ({ id, accessLevelCode }: { id: number; accessLevelCode: string }) => {
      const res = await fetch(`/api/crm/security/users/${id}/access-level`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accessLevelCode })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update access level');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/audit-log'] });
      toast({ title: 'Access level updated', description: 'User access level has been changed.' });
      setShowUserDetailDialog(false);
      setSelectedUserForDetail(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Add custom permission mutation
  const addCustomPermissionMutation = useMutation({
    mutationFn: async ({ userId, featureKey, accessGranted, reason }: { userId: number; featureKey: string; accessGranted: boolean; reason: string }) => {
      const res = await fetch(`/api/crm/security/users/${userId}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ featureKey, accessGranted, reason })
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to add permission');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/audit-log'] });
      refetchUserDetail();
      toast({ title: 'Permission added', description: 'Custom permission has been applied.' });
      setShowAddPermissionDialog(false);
      setNewPermissionFeature('');
      setNewPermissionReason('');
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Remove custom permission mutation
  const removeCustomPermissionMutation = useMutation({
    mutationFn: async ({ userId, featureKey }: { userId: number; featureKey: string }) => {
      const res = await fetch(`/api/crm/security/users/${userId}/permissions/${featureKey}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to remove permission');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/audit-log'] });
      refetchUserDetail();
      toast({ title: 'Permission removed', description: 'Custom permission has been removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUserForm) => {
      const res = await fetch('/api/crm/security/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(userData)
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create user');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/stats'] });
      toast({ title: 'User created', description: 'New user has been created with the selected access level.' });
      setShowCreateUserDialog(false);
      setNewUserForm({
        username: '',
        email: '',
        fullName: '',
        password: '',
        accessLevelCode: 'sales_lettings_negotiator'
      });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/crm/security/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned an unexpected response');
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/stats'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/audit-log'] });
      toast({ title: 'User deleted', description: 'User has been removed from the system.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Group features by category
  const featuresByCategory = features?.reduce((acc: Record<string, SecurityFeature[]>, feature: SecurityFeature) => {
    if (!acc[feature.category]) acc[feature.category] = [];
    acc[feature.category].push(feature);
    return acc;
  }, {}) || {};

  return (
    <ProtectedRoute requiredClearance={10} featureKey="security_matrix" showAccessDenied>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/portal">
                <Button variant="ghost" size="icon">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <Shield className="h-6 w-6 text-[#791E75]" />
                  Security Matrix
                </h1>
                <p className="text-gray-500">Manage security clearance levels and feature access</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/crm/security/initialize', {
                      method: 'POST',
                      credentials: 'include'
                    });
                    if (res.ok) {
                      toast({ title: 'Success', description: 'Security settings initialized' });
                      queryClient.invalidateQueries({ queryKey: ['/api/crm/security'] });
                    } else {
                      throw new Error('Failed to initialize');
                    }
                  } catch (error) {
                    toast({ title: 'Error', description: 'Failed to initialize security settings', variant: 'destructive' });
                  }
                }}
              >
                <Settings className="h-4 w-4 mr-1" />
                Initialize
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch('/api/crm/security/seed-staff', {
                      method: 'POST',
                      credentials: 'include'
                    });
                    if (res.ok) {
                      const data = await res.json();
                      toast({
                        title: 'Staff Created',
                        description: `${data.results.length} staff members set up. Default password: JohnBarclay2024!`
                      });
                      queryClient.invalidateQueries({ queryKey: ['/api/crm/security/users'] });
                    } else {
                      throw new Error('Failed to seed staff');
                    }
                  } catch (error) {
                    toast({ title: 'Error', description: 'Failed to seed staff users', variant: 'destructive' });
                  }
                }}
              >
                <UserPlus className="h-4 w-4 mr-1" />
                Seed Staff
              </Button>
              <ClearanceBadge />
              <Badge className="bg-red-600 text-white">
                <Lock className="h-3 w-3 mr-1" /> Admin Only
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Users</p>
                  <p className="text-2xl font-bold">{securityUsers?.length || 0}</p>
                </div>
                <Users className="h-8 w-8 text-[#791E75]" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Protected Features</p>
                  <p className="text-2xl font-bold">{features?.length || 0}</p>
                </div>
                <Shield className="h-8 w-8 text-[#791E75]" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Admin Users</p>
                  <p className="text-2xl font-bold">
                    {securityUsers?.filter((u: SecurityUser) => u.securityClearance >= 10).length || 0}
                  </p>
                </div>
                <UserCog className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recent Changes</p>
                  <p className="text-2xl font-bold">{stats?.recentActivityCount || 0}</p>
                  <p className="text-xs text-muted-foreground">Last 7 days</p>
                </div>
                <Activity className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="matrix" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="matrix" className="flex items-center gap-2">
              <Grid3X3 className="h-4 w-4" />
              Access Matrix
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Audit Log
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      User Access Management
                    </CardTitle>
                    <CardDescription>
                      Assign access levels and manage custom permissions for individual users
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowCreateUserDialog(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Access Level</TableHead>
                        <TableHead>Clearance</TableHead>
                        <TableHead>Custom Permissions</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {securityUsers?.map((user: SecurityUser) => {
                        const accessLevel = getAccessLevelInfo(user.accessLevelCode || '') ||
                          (accessLevels || DEFAULT_ACCESS_LEVELS).find((l: AccessLevel) => l.clearanceLevel === user.securityClearance);
                        const IconComponent = accessLevel ? getAccessLevelIcon(accessLevel.icon) : Shield;

                        return (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{user.fullName}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{user.username}</span>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={user.accessLevelCode || ''}
                                onValueChange={(value) => {
                                  const level = DEFAULT_ACCESS_LEVELS.find(l => l.levelCode === value);
                                  if (level) {
                                    updateUserAccessLevelMutation.mutate({
                                      id: user.id,
                                      accessLevelCode: value
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue>
                                    {accessLevel ? (
                                      <div className="flex items-center gap-2">
                                        <div
                                          className="w-5 h-5 rounded flex items-center justify-center text-white"
                                          style={{ backgroundColor: accessLevel.color }}
                                        >
                                          <IconComponent className="h-3 w-3" />
                                        </div>
                                        <span className="text-sm">{accessLevel.levelName}</span>
                                      </div>
                                    ) : (
                                      <span className="text-muted-foreground">Select level...</span>
                                    )}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {DEFAULT_ACCESS_LEVELS.filter(l => l.canBeAssigned).map((level) => {
                                    const LevelIcon = getAccessLevelIcon(level.icon);
                                    return (
                                      <SelectItem key={level.levelCode} value={level.levelCode}>
                                        <div className="flex items-center gap-2">
                                          <div
                                            className="w-5 h-5 rounded flex items-center justify-center text-white"
                                            style={{ backgroundColor: level.color }}
                                          >
                                            <LevelIcon className="h-3 w-3" />
                                          </div>
                                          <span>{level.levelName}</span>
                                          <Badge variant="outline" className="ml-auto text-xs">
                                            L{level.clearanceLevel}
                                          </Badge>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge className={getClearanceColor(user.securityClearance)}>
                                Level {user.securityClearance}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {user.customPermissions && user.customPermissions.length > 0 ? (
                                <div className="flex items-center gap-1">
                                  <Badge className="bg-purple-100 text-purple-800">
                                    {user.customPermissions.filter(p => p.accessGranted).length} granted
                                  </Badge>
                                  {user.customPermissions.filter(p => !p.accessGranted).length > 0 && (
                                    <Badge variant="outline" className="text-red-600">
                                      {user.customPermissions.filter(p => !p.accessGranted).length} revoked
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {user.isActive ? (
                                <Badge className="bg-green-100 text-green-800">Active</Badge>
                              ) : (
                                <Badge variant="outline" className="text-gray-500">Inactive</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    setSelectedUserForDetail(user);
                                    setSelectedAccessLevel(user.accessLevelCode || '');
                                    setShowUserDetailDialog(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete user "${user.username}" (${user.fullName})?`)) {
                                      deleteUserMutation.mutate(user.id);
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Access Matrix Tab */}
          <TabsContent value="matrix" className="space-y-4">
            {/* Access Levels Header Row */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Grid3X3 className="h-5 w-5" />
                  Feature Access Matrix
                </CardTitle>
                <CardDescription>
                  Click any cell to toggle feature access for that access level. Features are grouped by category.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Access Levels Legend */}
                <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted rounded-lg">
                  {(accessLevels || DEFAULT_ACCESS_LEVELS)
                    .filter((level: AccessLevel) => level.canBeAssigned)
                    .map((level: AccessLevel) => {
                      const IconComponent = getAccessLevelIcon(level.icon);
                      const usersAtLevel = securityUsers?.filter((u: SecurityUser) =>
                        u.accessLevelCode === level.levelCode || u.securityClearance === level.clearanceLevel
                      ).length || 0;
                      return (
                        <div
                          key={level.levelCode}
                          className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-md border shadow-sm"
                          title={level.description}
                        >
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-white"
                            style={{ backgroundColor: level.color }}
                          >
                            <IconComponent className="h-3.5 w-3.5" />
                          </div>
                          <span className="text-sm font-medium">{level.levelName}</span>
                          <Badge variant="outline" className="text-xs">L{level.clearanceLevel}</Badge>
                          {usersAtLevel > 0 && (
                            <Badge className="text-xs bg-blue-100 text-blue-800">{usersAtLevel}</Badge>
                          )}
                        </div>
                      );
                    })}
                </div>
              </CardContent>
            </Card>

            {/* Feature Matrix by Category */}
            {loadingFeatures ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              Object.entries(featuresByCategory).map(([category, categoryFeatures]) => {
                const categoryLabel = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                const accessLevelsList = (accessLevels || DEFAULT_ACCESS_LEVELS).filter((l: AccessLevel) => l.canBeAssigned);

                return (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg capitalize flex items-center gap-2">
                        <FileText className="h-5 w-5 text-[#791E75]" />
                        {categoryLabel}
                        <Badge variant="outline" className="ml-2">
                          {(categoryFeatures as SecurityFeature[]).length} features
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-muted/50 border-b">
                              <th className="sticky left-0 bg-muted/50 text-left p-3 min-w-[220px] font-medium text-sm">
                                Feature
                              </th>
                              {accessLevelsList.map((level: AccessLevel) => {
                                const IconComponent = getAccessLevelIcon(level.icon);
                                return (
                                  <th
                                    key={level.levelCode}
                                    className="p-2 w-[70px] text-center"
                                  >
                                    <div className="flex flex-col items-center justify-center gap-1">
                                      <div
                                        className="w-7 h-7 rounded flex items-center justify-center text-white mx-auto"
                                        style={{ backgroundColor: level.color }}
                                        title={level.levelName}
                                      >
                                        <IconComponent className="h-4 w-4" />
                                      </div>
                                      <span className="text-[10px] text-muted-foreground leading-tight whitespace-nowrap">
                                        {level.levelName.split(' ')[0]}
                                      </span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {(categoryFeatures as SecurityFeature[]).map((feature) => (
                              <tr key={feature.id} className="border-b hover:bg-muted/30">
                                <td className="sticky left-0 bg-white p-3 text-sm">
                                  <div>
                                    <span className="font-medium">{feature.featureName}</span>
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                      {feature.description}
                                    </p>
                                  </div>
                                </td>
                                {accessLevelsList.map((level: AccessLevel) => {
                                  const hasAccess = hasLevelAccess(level.levelCode, feature.featureKey, levelPermissions);
                                  return (
                                    <td key={level.levelCode} className="p-2 text-center w-[70px]">
                                      <button
                                        onClick={() => {
                                          // Toggle individual access for this level
                                          toggleLevelPermissionMutation.mutate({
                                            levelCode: level.levelCode,
                                            featureKey: feature.featureKey,
                                            hasAccess: !hasAccess
                                          });
                                        }}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110 mx-auto"
                                        title={hasAccess
                                          ? `${level.levelName} has access. Click to revoke.`
                                          : `${level.levelName} has no access. Click to grant.`
                                        }
                                      >
                                        {hasAccess ? (
                                          <CheckCircle className="h-5 w-5 text-green-500" />
                                        ) : (
                                          <XCircle className="h-5 w-5 text-red-300 hover:text-red-500" />
                                        )}
                                      </button>
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}

            {/* Legend */}
            <Card>
              <CardContent className="py-3">
                <div className="flex flex-wrap items-center gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span>Has access (click to revoke)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-red-300" />
                    <span>No access (click to grant)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Security Audit Log
                </CardTitle>
                <CardDescription>
                  History of all security-related changes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAudit ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin" />
                  </div>
                ) : auditLog?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No audit log entries yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {auditLog?.map((entry: AuditLogEntry) => (
                      <div key={entry.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        <div className={`p-2 rounded-full ${
                          entry.action === 'clearance_change' ? 'bg-purple-100' :
                          entry.action === 'feature_access_change' ? 'bg-blue-100' :
                          'bg-gray-100'
                        }`}>
                          {entry.action === 'clearance_change' ? (
                            <UserCog className="h-4 w-4 text-purple-600" />
                          ) : (
                            <Settings className="h-4 w-4 text-blue-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-medium">
                              {entry.action === 'clearance_change' ? 'User Clearance Changed' : 'Feature Access Changed'}
                            </p>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(entry.createdAt), 'dd MMM yyyy HH:mm')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">{entry.userName}</span> changed{' '}
                            <span className="font-medium">{entry.targetName}</span>
                          </p>
                          {entry.oldValue && entry.newValue && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <Badge variant="outline" className="bg-red-50">
                                {JSON.parse(entry.oldValue).requiredClearance ?? JSON.parse(entry.oldValue).securityClearance}
                              </Badge>
                              <span>→</span>
                              <Badge variant="outline" className="bg-green-50">
                                {JSON.parse(entry.newValue).requiredClearance ?? JSON.parse(entry.newValue).securityClearance}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Feature Dialog */}
        <Dialog open={!!editingFeature} onOpenChange={() => setEditingFeature(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Feature Security</DialogTitle>
              <DialogDescription>
                Change the security clearance required for {editingFeature?.featureName}
              </DialogDescription>
            </DialogHeader>
            {editingFeature && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Required Clearance Level</Label>
                  <Select
                    value={newClearance.toString()}
                    onValueChange={(v) => setNewClearance(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SECURITY_CLEARANCE_LABELS).map(([level, label]) => (
                        <SelectItem key={level} value={level}>
                          Level {level} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <p className="font-medium">Feature Enabled</p>
                    <p className="text-sm text-muted-foreground">Allow access to this feature</p>
                  </div>
                  <Switch
                    checked={editingFeature.isEnabled}
                    onCheckedChange={(checked) =>
                      setEditingFeature({ ...editingFeature, isEnabled: checked })
                    }
                  />
                </div>

                {newClearance !== editingFeature.requiredClearance && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="text-sm font-medium">Clearance Change Warning</p>
                    </div>
                    <p className="text-sm text-yellow-700 mt-1">
                      Changing from Level {editingFeature.requiredClearance} to Level {newClearance} will{' '}
                      {newClearance > editingFeature.requiredClearance ? 'restrict' : 'expand'} access to this feature.
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingFeature(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingFeature) {
                    updateFeatureMutation.mutate({
                      id: editingFeature.id,
                      requiredClearance: newClearance,
                      isEnabled: editingFeature.isEnabled
                    });
                  }
                }}
                disabled={updateFeatureMutation.isPending}
              >
                {updateFeatureMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit User Clearance Dialog */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Clearance</DialogTitle>
              <DialogDescription>
                Change the security clearance level for {editingUser?.fullName}
              </DialogDescription>
            </DialogHeader>
            {editingUser && (
              <div className="space-y-4 py-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-medium">{editingUser.fullName}</p>
                  <p className="text-sm text-muted-foreground">{editingUser.email}</p>
                  <Badge variant="outline" className="mt-2 capitalize">
                    {editingUser.role.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <div className="space-y-2">
                  <Label>Security Clearance Level</Label>
                  <Select
                    value={newClearance.toString()}
                    onValueChange={(v) => setNewClearance(parseInt(v))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(SECURITY_CLEARANCE_LABELS).map(([level, label]) => (
                        <SelectItem key={level} value={level}>
                          Level {level} - {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {newClearance !== editingUser.securityClearance && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center gap-2 text-yellow-800">
                      <AlertTriangle className="h-4 w-4" />
                      <p className="text-sm font-medium">Clearance Change</p>
                    </div>
                    <p className="text-sm text-yellow-700 mt-1">
                      Changing from Level {editingUser.securityClearance} ({SECURITY_CLEARANCE_LABELS[editingUser.securityClearance as keyof typeof SECURITY_CLEARANCE_LABELS]}) to Level {newClearance} ({SECURITY_CLEARANCE_LABELS[newClearance as keyof typeof SECURITY_CLEARANCE_LABELS]})
                    </p>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (editingUser) {
                    updateUserClearanceMutation.mutate({
                      id: editingUser.id,
                      securityClearance: newClearance
                    });
                  }
                }}
                disabled={updateUserClearanceMutation.isPending}
              >
                {updateUserClearanceMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* User Detail & Access Level Dialog */}
        <Dialog open={showUserDetailDialog} onOpenChange={(open) => {
          if (!open) {
            setShowUserDetailDialog(false);
            setSelectedUserForDetail(null);
            setSelectedAccessLevel('');
          }
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Manage User Access
              </DialogTitle>
              <DialogDescription>
                Configure access level and custom permissions for {selectedUserForDetail?.fullName}
              </DialogDescription>
            </DialogHeader>
            {selectedUserForDetail && (
              <div className="space-y-6 py-4">
                {/* User Info */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#791E75] flex items-center justify-center text-white font-semibold text-lg">
                      {selectedUserForDetail.fullName?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{selectedUserForDetail.fullName}</p>
                      <p className="text-sm text-muted-foreground">{selectedUserForDetail.email}</p>
                    </div>
                  </div>
                </div>

                {/* Access Level Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold">Access Level</Label>
                  <p className="text-sm text-muted-foreground">
                    Select an access level to define the base permissions for this user
                  </p>
                  <Select
                    value={selectedAccessLevel}
                    onValueChange={setSelectedAccessLevel}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select access level..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(accessLevels || DEFAULT_ACCESS_LEVELS)
                        .filter((level: AccessLevel) => level.canBeAssigned)
                        .map((level: AccessLevel) => {
                          const IconComponent = getAccessLevelIcon(level.icon);
                          return (
                            <SelectItem key={level.levelCode} value={level.levelCode}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-5 h-5 rounded flex items-center justify-center text-white"
                                  style={{ backgroundColor: level.color }}
                                >
                                  <IconComponent className="h-3 w-3" />
                                </div>
                                <span>{level.levelName}</span>
                                <span className="text-muted-foreground text-xs">(Level {level.clearanceLevel})</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                  {selectedAccessLevel && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        {getAccessLevelInfo(selectedAccessLevel)?.description}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">
                        Grants access to {getFeaturesForAccessLevel(selectedAccessLevel).length} features
                      </p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Custom Permissions */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label className="text-base font-semibold">Custom Permissions</Label>
                      <p className="text-sm text-muted-foreground">
                        Grant or revoke specific permissions beyond the base access level
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowAddPermissionDialog(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Override
                    </Button>
                  </div>

                  {userDetail?.customPermissions && userDetail.customPermissions.length > 0 ? (
                    <div className="space-y-2">
                      {userDetail.customPermissions.map((perm: CustomPermission) => {
                        const feature = DEFAULT_FEATURE_SECURITY.find(f => f.featureKey === perm.featureKey);
                        return (
                          <div
                            key={perm.id}
                            className={`flex items-center justify-between p-3 border rounded-lg ${
                              perm.accessGranted ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              {perm.accessGranted ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                              <div>
                                <p className="font-medium text-sm">
                                  {feature?.featureName || perm.featureKey}
                                </p>
                                {perm.reason && (
                                  <p className="text-xs text-muted-foreground">{perm.reason}</p>
                                )}
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => {
                                if (selectedUserForDetail) {
                                  removeCustomPermissionMutation.mutate({
                                    userId: selectedUserForDetail.id,
                                    featureKey: perm.featureKey
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground border rounded-lg">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No custom permissions applied</p>
                      <p className="text-xs">User has only base access level permissions</p>
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowUserDetailDialog(false);
                setSelectedUserForDetail(null);
                setSelectedAccessLevel('');
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedUserForDetail && selectedAccessLevel) {
                    updateUserAccessLevelMutation.mutate({
                      id: selectedUserForDetail.id,
                      accessLevelCode: selectedAccessLevel
                    });
                  }
                }}
                disabled={updateUserAccessLevelMutation.isPending || !selectedAccessLevel}
              >
                {updateUserAccessLevelMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Add Custom Permission Dialog */}
        <Dialog open={showAddPermissionDialog} onOpenChange={setShowAddPermissionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Custom Permission</DialogTitle>
              <DialogDescription>
                Grant or revoke a specific permission for {selectedUserForDetail?.fullName}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Feature</Label>
                <Select
                  value={newPermissionFeature}
                  onValueChange={setNewPermissionFeature}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a feature..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_FEATURE_SECURITY.map(feature => (
                      <SelectItem key={feature.featureKey} value={feature.featureKey}>
                        <div className="flex flex-col">
                          <span>{feature.featureName}</span>
                          <span className="text-xs text-muted-foreground">{feature.category}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">Grant Access</p>
                  <p className="text-sm text-muted-foreground">
                    {newPermissionGranted ? 'User will be given access to this feature' : 'User will be denied access to this feature'}
                  </p>
                </div>
                <Switch
                  checked={newPermissionGranted}
                  onCheckedChange={setNewPermissionGranted}
                />
              </div>

              <div className="space-y-2">
                <Label>Reason (Optional)</Label>
                <Textarea
                  placeholder="Why is this permission being added/removed?"
                  value={newPermissionReason}
                  onChange={(e) => setNewPermissionReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowAddPermissionDialog(false);
                setNewPermissionFeature('');
                setNewPermissionReason('');
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (selectedUserForDetail && newPermissionFeature) {
                    addCustomPermissionMutation.mutate({
                      userId: selectedUserForDetail.id,
                      featureKey: newPermissionFeature,
                      accessGranted: newPermissionGranted,
                      reason: newPermissionReason
                    });
                  }
                }}
                disabled={addCustomPermissionMutation.isPending || !newPermissionFeature}
              >
                {addCustomPermissionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Add Permission
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Create User Dialog */}
        <Dialog open={showCreateUserDialog} onOpenChange={setShowCreateUserDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Create New User
              </DialogTitle>
              <DialogDescription>
                Add a new user to the system with an assigned access level
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username</Label>
                  <Input
                    placeholder="username"
                    value={newUserForm.username}
                    onChange={(e) => setNewUserForm({ ...newUserForm, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="user@johnbarclay.co.uk"
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  placeholder="Full Name"
                  value={newUserForm.fullName}
                  onChange={(e) => setNewUserForm({ ...newUserForm, fullName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Password</Label>
                <Input
                  type="password"
                  placeholder="Initial password"
                  value={newUserForm.password}
                  onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select
                  value={newUserForm.accessLevelCode}
                  onValueChange={(value) => setNewUserForm({ ...newUserForm, accessLevelCode: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select access level..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(accessLevels || DEFAULT_ACCESS_LEVELS)
                      .filter((level: AccessLevel) => level.canBeAssigned)
                      .map((level: AccessLevel) => {
                        const IconComponent = getAccessLevelIcon(level.icon);
                        return (
                          <SelectItem key={level.levelCode} value={level.levelCode}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-5 h-5 rounded flex items-center justify-center text-white"
                                style={{ backgroundColor: level.color }}
                              >
                                <IconComponent className="h-3 w-3" />
                              </div>
                              <span>{level.levelName}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
                {newUserForm.accessLevelCode && (
                  <p className="text-xs text-muted-foreground">
                    {getAccessLevelInfo(newUserForm.accessLevelCode)?.description}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setShowCreateUserDialog(false);
                setNewUserForm({
                  username: '',
                  email: '',
                  fullName: '',
                  password: '',
                  accessLevelCode: 'sales_lettings_negotiator'
                });
              }}>
                Cancel
              </Button>
              <Button
                onClick={() => createUserMutation.mutate(newUserForm)}
                disabled={createUserMutation.isPending || !newUserForm.username || !newUserForm.email || !newUserForm.fullName || !newUserForm.password}
              >
                {createUserMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4 mr-2" />
                )}
                Create User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProtectedRoute>
  );
}
