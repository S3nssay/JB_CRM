import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  FileText, Plus, Edit, Trash2, Eye, EyeOff, ExternalLink,
  Image, Users, Settings, Search, MoreVertical, Globe
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';
import { format } from 'date-fns';

interface CmsPage {
  id: number;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: boolean;
  publishedAt: string | null;
  template: string;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

const templateOptions = [
  { value: 'default', label: 'Default' },
  { value: 'team', label: 'Team Page' },
  { value: 'faq', label: 'FAQ Page' },
  { value: 'testimonials', label: 'Testimonials' },
];

export default function CMSManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasMinClearance } = usePermissions();
  const canEdit = hasMinClearance(7);
  const canDelete = hasMinClearance(9);

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newPage, setNewPage] = useState({
    title: '',
    slug: '',
    template: 'default',
    metaTitle: '',
    metaDescription: ''
  });

  // Fetch all CMS pages
  const { data: pages, isLoading } = useQuery<CmsPage[]>({
    queryKey: ['/api/crm/cms/pages'],
    queryFn: async () => {
      const res = await fetch('/api/crm/cms/pages', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch pages');
      return res.json();
    }
  });

  // Create page mutation
  const createPageMutation = useMutation({
    mutationFn: async (pageData: typeof newPage) => {
      const res = await fetch('/api/crm/cms/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(pageData)
      });
      if (!res.ok) throw new Error('Failed to create page');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages'] });
      setShowCreateDialog(false);
      setNewPage({ title: '', slug: '', template: 'default', metaTitle: '', metaDescription: '' });
      toast({ title: 'Success', description: 'Page created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Toggle publish mutation
  const togglePublishMutation = useMutation({
    mutationFn: async ({ id, isPublished }: { id: number; isPublished: boolean }) => {
      const res = await fetch(`/api/crm/cms/pages/${id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPublished })
      });
      if (!res.ok) throw new Error('Failed to update publish status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages'] });
      toast({ title: 'Success', description: 'Page status updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Delete page mutation
  const deletePageMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/cms/pages/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete page');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages'] });
      toast({ title: 'Success', description: 'Page deleted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  const filteredPages = pages?.filter(page =>
    page.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    page.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreatePage = () => {
    if (!newPage.title || !newPage.slug) {
      toast({ title: 'Error', description: 'Title and slug are required', variant: 'destructive' });
      return;
    }
    createPageMutation.mutate(newPage);
  };

  const generateSlug = (title: string) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Content Management</h1>
          <p className="text-muted-foreground">Manage your website pages and content</p>
        </div>
        {canEdit && (
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Page
          </Button>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/crm/cms/team">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Users className="h-5 w-5 mr-2 text-blue-500" />
              <CardTitle className="text-lg">Team Page Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure which staff members appear on the public team page
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/crm/cms/media">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Image className="h-5 w-5 mr-2 text-green-500" />
              <CardTitle className="text-lg">Media Library</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Upload and manage images for your website content
              </p>
            </CardContent>
          </Card>
        </Link>

        <a href="/team" target="_blank" rel="noopener noreferrer">
          <Card className="cursor-pointer hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center space-y-0 pb-2">
              <Globe className="h-5 w-5 mr-2 text-purple-500" />
              <CardTitle className="text-lg">View Live Site</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Preview the public website pages
              </p>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* Pages List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Pages</CardTitle>
              <CardDescription>All website pages managed through the CMS</CardDescription>
            </div>
            <div className="w-72">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pages..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading pages...</div>
          ) : filteredPages?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'No pages match your search' : 'No pages created yet'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPages?.map((page) => (
                  <TableRow key={page.id}>
                    <TableCell className="font-medium">{page.title}</TableCell>
                    <TableCell>
                      <code className="text-sm bg-muted px-2 py-1 rounded">/{page.slug}</code>
                    </TableCell>
                    <TableCell className="capitalize">{page.template}</TableCell>
                    <TableCell>
                      <Badge variant={page.isPublished ? 'default' : 'secondary'}>
                        {page.isPublished ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(page.updatedAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <Link href={`/crm/cms/pages/${page.slug}`}>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Page
                            </DropdownMenuItem>
                          </Link>
                          {canEdit && (
                            <DropdownMenuItem
                              onClick={() => togglePublishMutation.mutate({
                                id: page.id,
                                isPublished: !page.isPublished
                              })}
                            >
                              {page.isPublished ? (
                                <>
                                  <EyeOff className="mr-2 h-4 w-4" />
                                  Unpublish
                                </>
                              ) : (
                                <>
                                  <Eye className="mr-2 h-4 w-4" />
                                  Publish
                                </>
                              )}
                            </DropdownMenuItem>
                          )}
                          <a href={`/${page.slug}`} target="_blank" rel="noopener noreferrer">
                            <DropdownMenuItem>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              View Live
                            </DropdownMenuItem>
                          </a>
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm(`Delete "${page.title}"? This cannot be undone.`)) {
                                  deletePageMutation.mutate(page.id);
                                }
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Page Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Page Title</Label>
              <Input
                id="title"
                value={newPage.title}
                onChange={(e) => {
                  setNewPage({
                    ...newPage,
                    title: e.target.value,
                    slug: newPage.slug || generateSlug(e.target.value)
                  });
                }}
                placeholder="About Us"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug</Label>
              <Input
                id="slug"
                value={newPage.slug}
                onChange={(e) => setNewPage({ ...newPage, slug: e.target.value })}
                placeholder="about-us"
              />
              <p className="text-xs text-muted-foreground">
                The page will be available at: /{newPage.slug || 'slug'}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
              <Select
                value={newPage.template}
                onValueChange={(value) => setNewPage({ ...newPage, template: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select template" />
                </SelectTrigger>
                <SelectContent>
                  {templateOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaTitle">SEO Title (optional)</Label>
              <Input
                id="metaTitle"
                value={newPage.metaTitle}
                onChange={(e) => setNewPage({ ...newPage, metaTitle: e.target.value })}
                placeholder="About Our Team | Company Name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metaDescription">SEO Description (optional)</Label>
              <Input
                id="metaDescription"
                value={newPage.metaDescription}
                onChange={(e) => setNewPage({ ...newPage, metaDescription: e.target.value })}
                placeholder="Learn about our experienced team..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreatePage} disabled={createPageMutation.isPending}>
              {createPageMutation.isPending ? 'Creating...' : 'Create Page'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
