import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ClipboardCheck, Plus, ChevronDown, ChevronRight, Loader2, History } from 'lucide-react';
import { format } from 'date-fns';
import {
  propertyChecklistGroups,
  propertyChecklistItemKeys,
  propertyChecklistItemCount,
} from '@shared/propertyChecklist';

interface Checklist {
  id: number;
  propertyId: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

interface ChecklistResponse {
  active: Checklist | null;
  history: Checklist[];
}

interface PropertyChecklistCardProps {
  propertyId: number;
}

const completedCount = (cl: Checklist | null): number =>
  cl ? propertyChecklistItemKeys.filter((k) => cl[k]).length : 0;

export default function PropertyChecklistCard({ propertyId }: PropertyChecklistCardProps) {
  const { toast } = useToast();
  const queryKey = [`/api/crm/properties/${propertyId}/checklists`];
  const [showHistory, setShowHistory] = useState(false);
  const [notesDraft, setNotesDraft] = useState<string | null>(null);

  const { data, isLoading } = useQuery<ChecklistResponse>({
    queryKey,
    enabled: !!propertyId,
  });

  const active = data?.active ?? null;
  const history = data?.history ?? [];

  // Update items / notes on the active checklist (optimistic)
  const patchMutation = useMutation({
    mutationFn: (patch: Record<string, unknown>) => {
      if (!active) throw new Error('No active checklist');
      return apiRequest(`/api/crm/properties/${propertyId}/checklists/${active.id}`, 'PATCH', patch);
    },
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData<ChecklistResponse>(queryKey);
      if (prev?.active) {
        queryClient.setQueryData<ChecklistResponse>(queryKey, {
          ...prev,
          active: { ...prev.active, ...patch },
        });
      }
      return { prev };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(queryKey, ctx.prev);
      toast({ title: 'Failed to save checklist', variant: 'destructive' });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  // Rotate into a new tenancy: create a fresh checklist (previous one becomes history)
  const rotateMutation = useMutation({
    mutationFn: () => apiRequest(`/api/crm/properties/${propertyId}/checklists`, 'POST', {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNotesDraft(null);
      toast({ title: 'New tenancy checklist created', description: 'The previous checklist has been kept in history.' });
    },
    onError: () => toast({ title: 'Failed to create new checklist', variant: 'destructive' }),
  });

  const handleRotate = () => {
    const proceed = window.confirm(
      'Start a fresh checklist for a new tenancy?\n\nThe current checklist will be preserved in history (read-only).',
    );
    if (proceed) rotateMutation.mutate();
  };

  const done = completedCount(active);
  const notesValue = notesDraft ?? active?.notes ?? '';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Tenancy Checklist
            </CardTitle>
            <CardDescription>Onboarding checklist for the current tenancy — a fresh one is started each time the property re-lets</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {active && (
              <Badge className={done === propertyChecklistItemCount ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}>
                {done}/{propertyChecklistItemCount} complete
              </Badge>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRotate}
              disabled={rotateMutation.isPending}
              className="border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              {rotateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
              New Tenancy Checklist
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading checklist…
          </div>
        ) : !active ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <ClipboardCheck className="h-8 w-8 mx-auto mb-2 opacity-20" />
            <p className="mb-3">No checklist yet for this property</p>
            <Button type="button" size="sm" onClick={() => rotateMutation.mutate()} disabled={rotateMutation.isPending}>
              <Plus className="h-4 w-4 mr-1" /> Create Checklist
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-xs text-muted-foreground -mt-2">
              Checklist started {format(new Date(active.createdAt), 'dd MMM yyyy')}
            </p>

            {propertyChecklistGroups.map((group) => (
              <div key={group.group} className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{group.group}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {group.items.map((item) => (
                    <label key={item.key} htmlFor={`chk-${active.id}-${item.key}`} className="flex items-center gap-3 cursor-pointer">
                      <Checkbox
                        id={`chk-${active.id}-${item.key}`}
                        checked={!!active[item.key]}
                        onCheckedChange={(checked) => patchMutation.mutate({ [item.key]: checked === true })}
                      />
                      <span className="text-sm">{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Notes</h4>
              <Textarea
                placeholder="Tenant name, notes about this tenancy's checklist…"
                value={notesValue}
                onChange={(e) => setNotesDraft(e.target.value)}
                onBlur={() => {
                  if (notesDraft !== null && notesDraft !== (active.notes ?? '')) {
                    patchMutation.mutate({ notes: notesDraft });
                  }
                  setNotesDraft(null);
                }}
                rows={3}
              />
            </div>

            {history.length > 0 && (
              <div>
                <Separator className="mb-3" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground px-0 hover:bg-transparent"
                  onClick={() => setShowHistory((s) => !s)}
                >
                  {showHistory ? <ChevronDown className="h-4 w-4 mr-1" /> : <ChevronRight className="h-4 w-4 mr-1" />}
                  <History className="h-4 w-4 mr-1" />
                  Previous checklists ({history.length})
                </Button>
                {showHistory && (
                  <div className="mt-3 space-y-2">
                    {history.map((cl) => (
                      <div key={cl.id} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30 text-sm">
                        <span className="text-muted-foreground">
                          Started {format(new Date(cl.createdAt), 'dd MMM yyyy')}
                        </span>
                        <Badge variant="secondary">{completedCount(cl)}/{propertyChecklistItemCount} complete</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
