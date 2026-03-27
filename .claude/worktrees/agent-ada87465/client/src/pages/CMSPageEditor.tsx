import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  ArrowLeft, Save, Plus, Trash2, GripVertical, Eye, EyeOff,
  FileText, MessageSquare, HelpCircle, Star, Zap, Target
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/use-permissions';

interface ContentBlock {
  id: number;
  pageId: number;
  blockType: string;
  blockKey: string | null;
  content: any;
  displayOrder: number;
  isActive: boolean;
}

interface CmsPage {
  id: number;
  slug: string;
  title: string;
  metaTitle: string | null;
  metaDescription: string | null;
  isPublished: boolean;
  template: string;
  blocks: ContentBlock[];
}

const blockTypeOptions = [
  { value: 'hero', label: 'Hero Section', icon: Zap },
  { value: 'text', label: 'Text Block', icon: FileText },
  { value: 'testimonial', label: 'Testimonial', icon: Star },
  { value: 'faq_item', label: 'FAQ Item', icon: HelpCircle },
  { value: 'benefit', label: 'Benefit', icon: Target },
  { value: 'cta', label: 'Call to Action', icon: MessageSquare },
];

export default function CMSPageEditor() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasMinClearance } = usePermissions();
  const canEdit = hasMinClearance(7);
  const canDelete = hasMinClearance(9);

  const [editingBlock, setEditingBlock] = useState<ContentBlock | null>(null);
  const [showAddBlockDialog, setShowAddBlockDialog] = useState(false);
  const [newBlockType, setNewBlockType] = useState('text');
  const [pageSettings, setPageSettings] = useState({
    title: '',
    metaTitle: '',
    metaDescription: ''
  });

  // Fetch page with blocks
  const { data: page, isLoading } = useQuery<CmsPage>({
    queryKey: ['/api/crm/cms/pages', slug],
    queryFn: async () => {
      const res = await fetch(`/api/crm/cms/pages/${slug}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch page');
      return res.json();
    },
    enabled: !!slug
  });

  useEffect(() => {
    if (page) {
      setPageSettings({
        title: page.title,
        metaTitle: page.metaTitle || '',
        metaDescription: page.metaDescription || ''
      });
    }
  }, [page]);

  // Update page mutation
  const updatePageMutation = useMutation({
    mutationFn: async (data: Partial<CmsPage>) => {
      const res = await fetch(`/api/crm/cms/pages/${page?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data)
      });
      if (!res.ok) throw new Error('Failed to update page');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages', slug] });
      toast({ title: 'Success', description: 'Page updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  });

  // Toggle publish mutation
  const togglePublishMutation = useMutation({
    mutationFn: async (isPublished: boolean) => {
      const res = await fetch(`/api/crm/cms/pages/${page?.id}/publish`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isPublished })
      });
      if (!res.ok) throw new Error('Failed to update publish status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages', slug] });
      toast({ title: 'Success', description: 'Publish status updated' });
    }
  });

  // Add block mutation
  const addBlockMutation = useMutation({
    mutationFn: async (blockData: { blockType: string; content: any }) => {
      const res = await fetch(`/api/crm/cms/pages/${page?.id}/blocks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...blockData,
          displayOrder: (page?.blocks.length || 0) + 1
        })
      });
      if (!res.ok) throw new Error('Failed to add block');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages', slug] });
      setShowAddBlockDialog(false);
      toast({ title: 'Success', description: 'Block added' });
    }
  });

  // Update block mutation
  const updateBlockMutation = useMutation({
    mutationFn: async ({ id, content }: { id: number; content: any }) => {
      const res = await fetch(`/api/crm/cms/blocks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error('Failed to update block');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages', slug] });
      setEditingBlock(null);
      toast({ title: 'Success', description: 'Block updated' });
    }
  });

  // Delete block mutation
  const deleteBlockMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/crm/cms/blocks/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete block');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/cms/pages', slug] });
      toast({ title: 'Success', description: 'Block deleted' });
    }
  });

  const getDefaultContent = (blockType: string) => {
    switch (blockType) {
      case 'hero':
        return { title: '', subtitle: '', ctaText: '', ctaLink: '' };
      case 'text':
        return { heading: '', body: '', alignment: 'left' };
      case 'testimonial':
        return { content: '', author: '', location: '', rating: 5 };
      case 'faq_item':
        return { question: '', answer: '' };
      case 'benefit':
        return { title: '', description: '', icon: '' };
      case 'cta':
        return { heading: '', description: '', buttonText: '', buttonLink: '' };
      default:
        return {};
    }
  };

  const handleAddBlock = () => {
    addBlockMutation.mutate({
      blockType: newBlockType,
      content: getDefaultContent(newBlockType)
    });
  };

  if (isLoading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  if (!page) {
    return <div className="container mx-auto py-6">Page not found</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => setLocation('/crm/cms')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{page.title}</h1>
            <p className="text-sm text-muted-foreground">/{page.slug}</p>
          </div>
          <Badge variant={page.isPublished ? 'default' : 'secondary'}>
            {page.isPublished ? 'Published' : 'Draft'}
          </Badge>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <>
              <Button
                variant="outline"
                onClick={() => togglePublishMutation.mutate(!page.isPublished)}
              >
                {page.isPublished ? (
                  <><EyeOff className="mr-2 h-4 w-4" /> Unpublish</>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" /> Publish</>
                )}
              </Button>
              <Button onClick={() => updatePageMutation.mutate(pageSettings)}>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </Button>
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="content" className="space-y-4">
        <TabsList>
          <TabsTrigger value="content">Content Blocks</TabsTrigger>
          <TabsTrigger value="settings">Page Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="space-y-4">
          {/* Content Blocks */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Content Blocks</CardTitle>
              {canEdit && (
                <Button onClick={() => setShowAddBlockDialog(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Block
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {page.blocks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No content blocks yet. Add your first block to get started.
                </div>
              ) : (
                <div className="space-y-4">
                  {page.blocks.map((block) => (
                    <Card key={block.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="py-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                            <div>
                              <Badge variant="outline" className="mb-2 capitalize">
                                {block.blockType.replace('_', ' ')}
                              </Badge>
                              <div className="text-sm">
                                {renderBlockPreview(block)}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingBlock(block)}
                              >
                                Edit
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500"
                                onClick={() => {
                                  if (confirm('Delete this block?')) {
                                    deleteBlockMutation.mutate(block.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Page Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="pageTitle">Page Title</Label>
                <Input
                  id="pageTitle"
                  value={pageSettings.title}
                  onChange={(e) => setPageSettings({ ...pageSettings, title: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaTitle">SEO Title</Label>
                <Input
                  id="metaTitle"
                  value={pageSettings.metaTitle}
                  onChange={(e) => setPageSettings({ ...pageSettings, metaTitle: e.target.value })}
                  placeholder="Page title for search engines"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaDescription">SEO Description</Label>
                <Textarea
                  id="metaDescription"
                  value={pageSettings.metaDescription}
                  onChange={(e) => setPageSettings({ ...pageSettings, metaDescription: e.target.value })}
                  placeholder="Brief description for search engines"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Block Dialog */}
      <Dialog open={showAddBlockDialog} onOpenChange={setShowAddBlockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Content Block</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Block Type</Label>
              <Select value={newBlockType} onValueChange={setNewBlockType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {blockTypeOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center">
                        <opt.icon className="mr-2 h-4 w-4" />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddBlockDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBlock}>Add Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Block Dialog */}
      {editingBlock && (
        <BlockEditorDialog
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onSave={(content) => updateBlockMutation.mutate({ id: editingBlock.id, content })}
        />
      )}
    </div>
  );
}

function renderBlockPreview(block: ContentBlock) {
  const content = block.content as any;
  switch (block.blockType) {
    case 'hero':
      return content.title || 'No title set';
    case 'text':
      return content.heading || content.body?.substring(0, 50) + '...' || 'Empty text block';
    case 'testimonial':
      return `"${content.content?.substring(0, 40)}..." - ${content.author || 'Unknown'}`;
    case 'faq_item':
      return content.question || 'No question set';
    case 'benefit':
      return content.title || 'No title set';
    case 'cta':
      return content.heading || 'No heading set';
    default:
      return 'Content block';
  }
}

function BlockEditorDialog({
  block,
  onClose,
  onSave
}: {
  block: ContentBlock;
  onClose: () => void;
  onSave: (content: any) => void;
}) {
  const [content, setContent] = useState(block.content);

  const handleSave = () => {
    onSave(content);
  };

  const renderFields = () => {
    switch (block.blockType) {
      case 'hero':
        return (
          <>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={content.title || ''}
                onChange={(e) => setContent({ ...content, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Input
                value={content.subtitle || ''}
                onChange={(e) => setContent({ ...content, subtitle: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CTA Button Text</Label>
              <Input
                value={content.ctaText || ''}
                onChange={(e) => setContent({ ...content, ctaText: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>CTA Link</Label>
              <Input
                value={content.ctaLink || ''}
                onChange={(e) => setContent({ ...content, ctaLink: e.target.value })}
              />
            </div>
          </>
        );
      case 'text':
        return (
          <>
            <div className="space-y-2">
              <Label>Heading</Label>
              <Input
                value={content.heading || ''}
                onChange={(e) => setContent({ ...content, heading: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                value={content.body || ''}
                onChange={(e) => setContent({ ...content, body: e.target.value })}
                rows={6}
              />
            </div>
          </>
        );
      case 'testimonial':
        return (
          <>
            <div className="space-y-2">
              <Label>Content</Label>
              <Textarea
                value={content.content || ''}
                onChange={(e) => setContent({ ...content, content: e.target.value })}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Author Name</Label>
              <Input
                value={content.author || ''}
                onChange={(e) => setContent({ ...content, author: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                value={content.location || ''}
                onChange={(e) => setContent({ ...content, location: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Rating (1-5)</Label>
              <Input
                type="number"
                min="1"
                max="5"
                value={content.rating || 5}
                onChange={(e) => setContent({ ...content, rating: parseInt(e.target.value) })}
              />
            </div>
          </>
        );
      case 'faq_item':
        return (
          <>
            <div className="space-y-2">
              <Label>Question</Label>
              <Input
                value={content.question || ''}
                onChange={(e) => setContent({ ...content, question: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Answer</Label>
              <Textarea
                value={content.answer || ''}
                onChange={(e) => setContent({ ...content, answer: e.target.value })}
                rows={6}
              />
            </div>
          </>
        );
      case 'benefit':
        return (
          <>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={content.title || ''}
                onChange={(e) => setContent({ ...content, title: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={content.description || ''}
                onChange={(e) => setContent({ ...content, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Icon (Lucide icon name)</Label>
              <Input
                value={content.icon || ''}
                onChange={(e) => setContent({ ...content, icon: e.target.value })}
                placeholder="e.g., check, star, shield"
              />
            </div>
          </>
        );
      case 'cta':
        return (
          <>
            <div className="space-y-2">
              <Label>Heading</Label>
              <Input
                value={content.heading || ''}
                onChange={(e) => setContent({ ...content, heading: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={content.description || ''}
                onChange={(e) => setContent({ ...content, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Button Text</Label>
              <Input
                value={content.buttonText || ''}
                onChange={(e) => setContent({ ...content, buttonText: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Button Link</Label>
              <Input
                value={content.buttonLink || ''}
                onChange={(e) => setContent({ ...content, buttonLink: e.target.value })}
              />
            </div>
          </>
        );
      default:
        return <p>Unknown block type</p>;
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="capitalize">
            Edit {block.blockType.replace('_', ' ')} Block
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
          {renderFields()}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
