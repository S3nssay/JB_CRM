import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, X, Tag } from 'lucide-react';

interface ContactTag {
  id: number;
  name: string;
  color: string;
  category: string | null;
}

interface TagManagerProps {
  entityType: 'tenant' | 'landlord' | 'lead' | 'contact';
  entityId: number;
}

const tagColorMap: Record<string, string> = {
  default: 'bg-gray-100 text-gray-800 border-gray-300',
  red: 'bg-red-100 text-red-800 border-red-300',
  orange: 'bg-orange-100 text-orange-800 border-orange-300',
  yellow: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  green: 'bg-green-100 text-green-800 border-green-300',
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  pink: 'bg-pink-100 text-pink-800 border-pink-300',
};

export default function TagManager({ entityType, entityId }: TagManagerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('default');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: entityTags = [] } = useQuery<ContactTag[]>({
    queryKey: ['/api/crm/tags/by-entity', entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/crm/tags/by-entity?entityType=${entityType}&entityId=${entityId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json();
    },
    enabled: !!entityId,
  });

  const { data: allTags = [] } = useQuery<ContactTag[]>({
    queryKey: ['/api/crm/tags'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tags', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch tags');
      return res.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const res = await fetch('/api/crm/tags/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tagId, entityType, entityId }),
      });
      if (!res.ok) throw new Error('Failed to assign tag');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tags/by-entity', entityType, entityId] });
      setShowPicker(false);
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (tagId: number) => {
      const res = await fetch('/api/crm/tags/unassign', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ tagId, entityType, entityId }),
      });
      if (!res.ok) throw new Error('Failed to remove tag');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tags/by-entity', entityType, entityId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newTagName, color: newTagColor }),
      });
      if (!res.ok) throw new Error('Failed to create tag');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tags'] });
      toast({ title: 'Tag created' });
      setShowCreate(false);
      setNewTagName('');
      setNewTagColor('default');
    },
  });

  const assignedTagIds = new Set(entityTags.map(t => t.id));
  const availableTags = allTags.filter(t => !assignedTagIds.has(t.id));

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entityTags.map(tag => (
        <Badge
          key={tag.id}
          variant="outline"
          className={`${tagColorMap[tag.color || 'default']} cursor-pointer group`}
        >
          <Tag className="h-3 w-3 mr-1" />
          {tag.name}
          <button
            onClick={() => removeMutation.mutate(tag.id)}
            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <div className="relative">
        <Button variant="ghost" size="sm" onClick={() => setShowPicker(!showPicker)} className="h-6 w-6 p-0">
          <Plus className="h-4 w-4" />
        </Button>

        {showPicker && (
          <div className="absolute z-50 mt-1 w-48 bg-white border rounded-md shadow-lg p-2">
            {availableTags.length > 0 ? (
              availableTags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => assignMutation.mutate(tag.id)}
                  className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded flex items-center gap-2"
                >
                  <span className={`w-3 h-3 rounded-full ${tagColorMap[tag.color || 'default']?.split(' ')[0]}`} />
                  {tag.name}
                </button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground p-2">No more tags available</p>
            )}
            <hr className="my-1" />
            <button
              onClick={() => { setShowPicker(false); setShowCreate(true); }}
              className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded text-blue-600"
            >
              + Create new tag
            </button>
          </div>
        )}
      </div>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Create Tag</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Tag name"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <Select value={newTagColor} onValueChange={setNewTagColor}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(tagColorMap).map(color => (
                  <SelectItem key={color} value={color}>
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${tagColorMap[color].split(' ')[0]}`} />
                      {color}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!newTagName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
