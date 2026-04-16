import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Archive, RotateCcw, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

interface ArchivedRecord {
  id: number;
  entity_type: string;
  entity_id: number;
  archived_date: string;
  archived_by: number | null;
  reason: string | null;
}

interface Candidate {
  id: number;
  [key: string]: any;
}

interface Candidates {
  tenancies: Candidate[];
  leads: Candidate[];
}

export default function ArchiveManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [batchType, setBatchType] = useState<'tenancy' | 'lead'>('tenancy');
  const [batchReason, setBatchReason] = useState('');
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);

  const { data: archives = [], isLoading: archivesLoading } = useQuery<ArchivedRecord[]>({
    queryKey: ['/api/crm/archives'],
    queryFn: () => apiRequest('GET', '/api/crm/archives').then(r => r.json()),
  });

  const { data: candidates, isLoading: candidatesLoading } = useQuery<Candidates>({
    queryKey: ['/api/crm/archives/candidates'],
    queryFn: () => apiRequest('GET', '/api/crm/archives/candidates').then(r => r.json()),
  });

  const restoreMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/crm/archives/${id}`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/archives'] });
      qc.invalidateQueries({ queryKey: ['/api/crm/archives/candidates'] });
      toast({ title: 'Record restored' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const batchArchiveMutation = useMutation({
    mutationFn: (data: { entityType: string; entityIds: number[]; reason: string }) =>
      apiRequest('POST', '/api/crm/archives/batch', data).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/crm/archives'] });
      qc.invalidateQueries({ queryKey: ['/api/crm/archives/candidates'] });
      toast({ title: `${data.archived} records archived` });
      setSelectedIds([]);
      setBatchDialogOpen(false);
      setBatchReason('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const openBatchDialog = (type: 'tenancy' | 'lead') => {
    setBatchType(type);
    setBatchDialogOpen(true);
  };

  const handleBatchArchive = () => {
    if (selectedIds.length === 0) {
      toast({ title: 'Select at least one record', variant: 'destructive' });
      return;
    }
    batchArchiveMutation.mutate({ entityType: batchType, entityIds: selectedIds, reason: batchReason });
  };

  const tenancyCandidates = candidates?.tenancies || [];
  const leadCandidates = candidates?.leads || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Archive className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Archive Management</h1>
          <p className="text-sm text-gray-500">Systematically archive old records and restore them if needed</p>
        </div>
      </div>

      <Tabs defaultValue="candidates">
        <TabsList>
          <TabsTrigger value="candidates">Archive Candidates</TabsTrigger>
          <TabsTrigger value="archived">Archived Records ({archives.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-6 mt-4">
          {/* Tenancy Candidates */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Ended Tenancies (&gt;2 years ago) — {tenancyCandidates.length} found
              </CardTitle>
              {tenancyCandidates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelectedIds(tenancyCandidates.map(t => t.id)); openBatchDialog('tenancy'); }}
                >
                  Archive Selected
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {candidatesLoading ? (
                <div className="p-6 text-center text-gray-400">Loading candidates...</div>
              ) : tenancyCandidates.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No archivable tenancies found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.length === tenancyCandidates.length && tenancyCandidates.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedIds(tenancyCandidates.map(t => t.id));
                            else setSelectedIds([]);
                          }}
                        />
                      </TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Property</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tenancyCandidates.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(t.id)}
                            onCheckedChange={() => toggleSelect(t.id)}
                          />
                        </TableCell>
                        <TableCell>{t.id}</TableCell>
                        <TableCell>{t.property_title || t.address_line1 || '—'}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {t.end_date ? format(new Date(t.end_date), 'dd MMM yyyy') : '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{t.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Lead Candidates */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Inactive Leads (&gt;1 year) — {leadCandidates.length} found
              </CardTitle>
              {leadCandidates.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setSelectedIds(leadCandidates.map(l => l.id)); openBatchDialog('lead'); }}
                >
                  Archive Selected
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-0">
              {candidatesLoading ? (
                <div className="p-6 text-center text-gray-400">Loading candidates...</div>
              ) : leadCandidates.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No archivable leads found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.length === leadCandidates.length && leadCandidates.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedIds(leadCandidates.map(l => l.id));
                            else setSelectedIds([]);
                          }}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Updated</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {leadCandidates.map(l => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(l.id)}
                            onCheckedChange={() => toggleSelect(l.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{l.name}</TableCell>
                        <TableCell className="text-gray-600">{l.email || '—'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{l.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {l.updated_at ? format(new Date(l.updated_at), 'dd MMM yyyy') : '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Archived Records</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {archivesLoading ? (
                <div className="p-6 text-center text-gray-400">Loading...</div>
              ) : archives.length === 0 ? (
                <div className="p-6 text-center text-gray-400">No archived records yet.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Archived Date</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archives.map(record => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">{record.entity_type}</Badge>
                        </TableCell>
                        <TableCell>{record.entity_id}</TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {format(new Date(record.archived_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-gray-600">{record.reason || '—'}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => restoreMutation.mutate(record.id)}
                            title="Restore record"
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Batch Archive Dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Archive {selectedIds.length} {batchType === 'tenancy' ? 'Tenancies' : 'Leads'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-600">
              You are about to archive <strong>{selectedIds.length}</strong> records. This action can be undone from the Archived Records tab.
            </p>
            <div>
              <Label>Reason (optional)</Label>
              <Textarea
                value={batchReason}
                onChange={e => setBatchReason(e.target.value)}
                placeholder="e.g. Routine annual archive of completed tenancies"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#791E75] hover:bg-[#5a1557]"
              onClick={handleBatchArchive}
              disabled={batchArchiveMutation.isPending}
            >
              {batchArchiveMutation.isPending ? 'Archiving...' : 'Archive Records'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
