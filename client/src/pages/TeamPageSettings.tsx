import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  ArrowLeft, Save, Eye, EyeOff, User, Upload, ExternalLink
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

interface TeamMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  profileId: number | null;
  jobTitle: string | null;
  department: string | null;
  publicDisplayName: string | null;
  publicBio: string | null;
  publicPhoto: string | null;
  publicJobTitle: string | null;
  publicDisplayOrder: number | null;
  showOnTeamPage: boolean | null;
}

export default function TeamPageSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasMinClearance } = usePermissions();
  const canEdit = hasMinClearance(7);

  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [editForm, setEditForm] = useState({
    publicDisplayName: '',
    publicBio: '',
    publicPhoto: '',
    publicJobTitle: '',
    publicDisplayOrder: 100,
    showOnTeamPage: false
  });

  // Fetch team members
  const { data: members, isLoading } = useQuery<TeamMember[]>({
    queryKey: ['/api/crm/cms/team'],
    queryFn: async () => {
      const res = await fetch('/api/crm/cms/team', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch team members');
      return res.json();
    }
  });

  // Update public profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: number; data: typeof editForm }) => {
      const res = await fetch(`/api/crm/staff/${userId}/public-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update profile');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/team'] });
      setEditingMember(null);
      toast({ title: 'Success', description: 'Profile updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Toggle visibility mutation
  const toggleVisibilityMutation = useMutation({
    mutationFn: async ({ userId, showOnTeamPage }: { userId: number; showOnTeamPage: boolean }) => {
      const res = await fetch(`/api/crm/staff/${userId}/public-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ showOnTeamPage })
      });
      if (!res.ok) throw new Error('Failed to update visibility');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/team'] });
      toast({ title: 'Success', description: 'Visibility updated' });
    }
  });

  const handleEditMember = (member: TeamMember) => {
    setEditForm({
      publicDisplayName: member.publicDisplayName || '',
      publicBio: member.publicBio || '',
      publicPhoto: member.publicPhoto || '',
      publicJobTitle: member.publicJobTitle || member.jobTitle || '',
      publicDisplayOrder: member.publicDisplayOrder || 100,
      showOnTeamPage: member.showOnTeamPage || false
    });
    setEditingMember(member);
  };

  const handleSaveProfile = () => {
    if (!editingMember) return;
    updateProfileMutation.mutate({
      userId: editingMember.id,
      data: editForm
    });
  };

  const visibleMembers = members?.filter(m => m.showOnTeamPage) || [];
  const hiddenMembers = members?.filter(m => !m.showOnTeamPage) || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Link href="/crm/cms">
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to CMS
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Team Page Settings</h1>
            <p className="text-muted-foreground">Configure staff visibility on the public team page</p>
          </div>
        </div>
        <a href="/team" target="_blank" rel="noopener noreferrer">
          <Button variant="outline">
            <ExternalLink className="mr-2 h-4 w-4" />
            View Team Page
          </Button>
        </a>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{members?.length || 0}</div>
            <p className="text-sm text-muted-foreground">Total Staff Members</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{visibleMembers.length}</div>
            <p className="text-sm text-muted-foreground">Visible on Team Page</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-gray-400">{hiddenMembers.length}</div>
            <p className="text-sm text-muted-foreground">Hidden from Team Page</p>
          </CardContent>
        </Card>
      </div>

      {/* Visible Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-green-500" />
            Visible on Team Page
          </CardTitle>
          <CardDescription>
            These staff members will appear on the public team page
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : visibleMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No staff members are visible on the team page yet
            </div>
          ) : (
            <div className="space-y-4">
              {visibleMembers
                .sort((a, b) => (a.publicDisplayOrder || 100) - (b.publicDisplayOrder || 100))
                .map((member) => (
                  <StaffCard
                    key={member.id}
                    member={member}
                    onEdit={() => handleEditMember(member)}
                    onToggleVisibility={() =>
                      toggleVisibilityMutation.mutate({
                        userId: member.id,
                        showOnTeamPage: false
                      })
                    }
                    canEdit={canEdit}
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Hidden Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-gray-400" />
            Not Visible on Team Page
          </CardTitle>
          <CardDescription>
            These staff members are hidden from the public team page
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4 text-muted-foreground">Loading...</div>
          ) : hiddenMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              All staff members are visible on the team page
            </div>
          ) : (
            <div className="space-y-4">
              {hiddenMembers.map((member) => (
                <StaffCard
                  key={member.id}
                  member={member}
                  onEdit={() => handleEditMember(member)}
                  onToggleVisibility={() =>
                    toggleVisibilityMutation.mutate({
                      userId: member.id,
                      showOnTeamPage: true
                    })
                  }
                  canEdit={canEdit}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Edit Public Profile: {editingMember?.fullName}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20">
                <AvatarImage src={editForm.publicPhoto} />
                <AvatarFallback className="text-2xl">
                  {editingMember?.fullName?.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <Label htmlFor="publicPhoto">Photo URL</Label>
                <Input
                  id="publicPhoto"
                  value={editForm.publicPhoto}
                  onChange={(e) => setEditForm({ ...editForm, publicPhoto: e.target.value })}
                  placeholder="https://example.com/photo.jpg or /uploads/cms/..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload images via the Media Library, then paste the URL here
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="publicDisplayName">Display Name</Label>
                <Input
                  id="publicDisplayName"
                  value={editForm.publicDisplayName}
                  onChange={(e) => setEditForm({ ...editForm, publicDisplayName: e.target.value })}
                  placeholder={editingMember?.fullName || 'Name to display'}
                />
                <p className="text-xs text-muted-foreground">
                  Leave empty to use their full name
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="publicJobTitle">Job Title</Label>
                <Input
                  id="publicJobTitle"
                  value={editForm.publicJobTitle}
                  onChange={(e) => setEditForm({ ...editForm, publicJobTitle: e.target.value })}
                  placeholder={editingMember?.jobTitle || 'Job title to display'}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="publicBio">Biography</Label>
              <Textarea
                id="publicBio"
                value={editForm.publicBio}
                onChange={(e) => setEditForm({ ...editForm, publicBio: e.target.value })}
                placeholder="A short biography for the team page..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {editForm.publicBio.length}/500 characters recommended
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayOrder">Display Order</Label>
                <Input
                  id="displayOrder"
                  type="number"
                  value={editForm.publicDisplayOrder}
                  onChange={(e) => setEditForm({ ...editForm, publicDisplayOrder: parseInt(e.target.value) || 100 })}
                />
                <p className="text-xs text-muted-foreground">
                  Lower numbers appear first
                </p>
              </div>

              <div className="space-y-2">
                <Label>Visibility</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={editForm.showOnTeamPage}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, showOnTeamPage: checked })}
                  />
                  <span className="text-sm">
                    {editForm.showOnTeamPage ? 'Visible on team page' : 'Hidden from team page'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMember(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveProfile} disabled={updateProfileMutation.isPending}>
              <Save className="mr-2 h-4 w-4" />
              {updateProfileMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StaffCard({
  member,
  onEdit,
  onToggleVisibility,
  canEdit
}: {
  member: TeamMember;
  onEdit: () => void;
  onToggleVisibility: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="flex items-center gap-4 p-4 border rounded-lg">
      <Avatar className="h-14 w-14">
        <AvatarImage src={member.publicPhoto || undefined} />
        <AvatarFallback>
          {member.fullName?.split(' ').map(n => n[0]).join('')}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">
            {member.publicDisplayName || member.fullName}
          </span>
          {member.publicDisplayOrder && (
            <Badge variant="outline" className="text-xs">
              Order: {member.publicDisplayOrder}
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {member.publicJobTitle || member.jobTitle || 'No title set'}
        </p>
        {member.publicBio && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
            {member.publicBio}
          </p>
        )}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleVisibility}
          >
            {member.showOnTeamPage ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
