import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Search, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface SanctionCheck {
  id: number;
  entity_type: string;
  entity_id: number;
  entity_name: string;
  check_date: string;
  result: string;
  matched_name: string | null;
  list_source: string | null;
  notes: string | null;
}

const resultBadge = (result: string) => {
  if (result === 'clear') return <Badge className="bg-green-100 text-green-800">Clear</Badge>;
  if (result === 'match') return <Badge variant="destructive">Match Found</Badge>;
  return <Badge variant="secondary">Pending</Badge>;
};

export default function AMLSanctionCheck() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const [entityType, setEntityType] = useState<string>('landlord');
  const [entityId, setEntityId] = useState('');
  const [entityName, setEntityName] = useState('');
  const [notes, setNotes] = useState('');
  const [historyEntityType, setHistoryEntityType] = useState('');
  const [historyEntityId, setHistoryEntityId] = useState('');

  const { data: recentChecks = [], isLoading } = useQuery<SanctionCheck[]>({
    queryKey: ['/api/crm/sanction-checks'],
    queryFn: () => apiRequest('GET', '/api/crm/sanction-checks').then(r => r.json()),
  });

  const { data: historyChecks = [], refetch: refetchHistory } = useQuery<SanctionCheck[]>({
    queryKey: ['/api/crm/sanction-checks', historyEntityType, historyEntityId],
    queryFn: () =>
      historyEntityType && historyEntityId
        ? apiRequest('GET', `/api/crm/sanction-checks/${historyEntityType}/${historyEntityId}`).then(r => r.json())
        : Promise.resolve([]),
    enabled: !!(historyEntityType && historyEntityId),
  });

  const runCheckMutation = useMutation({
    mutationFn: (data: { entityType: string; entityId: number; entityName: string; notes: string }) =>
      apiRequest('POST', '/api/crm/sanction-checks', data).then(r => r.json()),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['/api/crm/sanction-checks'] });
      toast({
        title: 'Sanction check completed',
        description: `Result: ${data.result === 'clear' ? 'No matches found (Clear)' : 'Match found — review required'}`,
      });
      setEntityId('');
      setEntityName('');
      setNotes('');
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const handleRunCheck = () => {
    if (!entityId || !entityName) {
      toast({ title: 'Entity ID and name are required', variant: 'destructive' });
      return;
    }
    runCheckMutation.mutate({
      entityType,
      entityId: parseInt(entityId, 10),
      entityName,
      notes,
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AML Sanction Checks</h1>
          <p className="text-sm text-gray-500">HM Treasury consolidated sanctions list screening</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Run Check */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" /> Run Sanction Check
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Entity Type</Label>
              <Select value={entityType} onValueChange={setEntityType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity ID</Label>
              <Input
                type="number"
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
                placeholder="Enter the database ID"
              />
            </div>
            <div>
              <Label>Full Name to Check <span className="text-red-500">*</span></Label>
              <Input
                value={entityName}
                onChange={e => setEntityName(e.target.value)}
                placeholder="e.g. John Smith"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any additional context..."
                rows={2}
              />
            </div>
            <Button
              className="w-full bg-[#791E75] hover:bg-[#5a1557]"
              onClick={handleRunCheck}
              disabled={runCheckMutation.isPending}
            >
              {runCheckMutation.isPending ? 'Running check...' : 'Run Sanction Check'}
            </Button>
            <p className="text-xs text-gray-400 text-center">
              Checks against HM Treasury Consolidated Sanctions List (OFSI)
            </p>
          </CardContent>
        </Card>

        {/* Entity History Lookup */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" /> Check History for Entity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Entity Type</Label>
              <Select value={historyEntityType} onValueChange={setHistoryEntityType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="landlord">Landlord</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Entity ID</Label>
              <Input
                type="number"
                value={historyEntityId}
                onChange={e => setHistoryEntityId(e.target.value)}
                placeholder="Enter the database ID"
              />
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => refetchHistory()}
              disabled={!historyEntityType || !historyEntityId}
            >
              Load History
            </Button>

            {historyChecks.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {historyChecks.map(check => (
                  <div key={check.id} className="flex items-center justify-between text-sm border rounded-lg p-2">
                    <div>
                      <p className="font-medium">{check.entity_name}</p>
                      <p className="text-xs text-gray-400">
                        {format(new Date(check.check_date), 'dd MMM yyyy HH:mm')}
                      </p>
                    </div>
                    {resultBadge(check.result)}
                  </div>
                ))}
              </div>
            )}
            {historyChecks.length === 0 && historyEntityType && historyEntityId && (
              <p className="text-sm text-gray-400 text-center">No checks found for this entity.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Checks Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Checks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-gray-400">Loading...</div>
          ) : recentChecks.length === 0 ? (
            <div className="p-6 text-center text-gray-400">No sanction checks have been run yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name Checked</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentChecks.map(check => (
                  <TableRow key={check.id}>
                    <TableCell className="font-medium">{check.entity_name}</TableCell>
                    <TableCell className="capitalize">{check.entity_type}</TableCell>
                    <TableCell>{check.entity_id}</TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {format(new Date(check.check_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">{check.list_source || 'HM Treasury'}</TableCell>
                    <TableCell>{resultBadge(check.result)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
