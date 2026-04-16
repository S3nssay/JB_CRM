import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, Unlock, AlertTriangle, Calculator } from 'lucide-react';
import { format } from 'date-fns';

interface FinancialPeriod {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  status: string;
  period_type: string | null;
  financial_year: number | null;
  closed_at: string | null;
  closed_by_id: number | null;
  created_at: string;
}

const statusBadge = (status: string) => {
  if (status === 'locked') return <Badge variant="destructive" className="flex items-center gap-1 w-fit"><Lock className="h-3 w-3" /> Locked</Badge>;
  if (status === 'closed') return <Badge variant="secondary">Closed</Badge>;
  return <Badge className="bg-green-100 text-green-800">Open</Badge>;
};

export default function AccountFinalisation() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: periods = [], isLoading } = useQuery<FinancialPeriod[]>({
    queryKey: ['/api/crm/financial-periods'],
    queryFn: () => apiRequest('GET', '/api/crm/financial-periods').then(r => r.json()),
  });

  const finaliseMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('POST', `/api/crm/financial-periods/${id}/finalise`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/financial-periods'] });
      toast({ title: 'Period locked. No further edits are permitted.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const reopenMutation = useMutation({
    mutationFn: (id: number) =>
      apiRequest('POST', `/api/crm/financial-periods/${id}/reopen`).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['/api/crm/financial-periods'] });
      toast({ title: 'Period reopened.' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const lockedCount = periods.filter(p => p.status === 'locked').length;
  const openCount = periods.filter(p => p.status === 'open').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Calculator className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Account Finalisation</h1>
          <p className="text-sm text-gray-500">Lock financial periods to prevent further edits</p>
        </div>
      </div>

      {lockedCount > 0 && (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800">
            <strong>{lockedCount} period{lockedCount !== 1 ? 's' : ''} locked.</strong> Locked periods cannot be modified. Only an admin can reopen them.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-gray-900">{periods.length}</p>
            <p className="text-sm text-gray-500">Total Periods</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-green-600">{openCount}</p>
            <p className="text-sm text-gray-500">Open</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-2xl font-bold text-red-600">{lockedCount}</p>
            <p className="text-sm text-gray-500">Locked</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Financial Periods</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 text-center text-gray-400">Loading...</div>
          ) : periods.length === 0 ? (
            <div className="p-6 text-center text-gray-400">
              No financial periods found. Create them in the Accounting module.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Financial Year</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map(period => (
                  <TableRow key={period.id} className={period.status === 'locked' ? 'bg-red-50' : ''}>
                    <TableCell className="font-medium">{period.name}</TableCell>
                    <TableCell className="capitalize text-gray-600">{period.period_type || '—'}</TableCell>
                    <TableCell className="text-gray-600">{period.financial_year || '—'}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(period.start_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {format(new Date(period.end_date), 'dd MMM yyyy')}
                    </TableCell>
                    <TableCell>{statusBadge(period.status)}</TableCell>
                    <TableCell className="text-sm text-gray-600">
                      {period.closed_at ? format(new Date(period.closed_at), 'dd MMM yyyy HH:mm') : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {period.status !== 'locked' ? (
                        <Button
                          size="sm"
                          className="bg-[#791E75] hover:bg-[#5a1557]"
                          onClick={() => {
                            if (window.confirm(`Lock period "${period.name}"? This will prevent any edits. You can reopen it later if needed.`)) {
                              finaliseMutation.mutate(period.id);
                            }
                          }}
                          disabled={finaliseMutation.isPending}
                        >
                          <Lock className="h-3.5 w-3.5 mr-1" /> Finalise
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-amber-300 text-amber-700 hover:bg-amber-50"
                          onClick={() => {
                            if (window.confirm(`Reopen period "${period.name}"? This will allow edits again.`)) {
                              reopenMutation.mutate(period.id);
                            }
                          }}
                          disabled={reopenMutation.isPending}
                        >
                          <Unlock className="h-3.5 w-3.5 mr-1" /> Reopen
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-sm text-gray-600">
          <strong>Important:</strong> Locking a financial period prevents all journal entries, invoices, and payments from being created or modified within that period. This is irreversible without admin intervention. Ensure all reconciliation is complete before finalising.
        </AlertDescription>
      </Alert>
    </div>
  );
}
