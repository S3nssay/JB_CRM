import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertTriangle, Loader2, PoundSterling, Clock, Users, ShieldAlert,
  Send, XCircle, Play,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// --- Types ---

interface ArrearsSummary {
  totalOutstanding: number; // pence
  activeCases: number;
  avgDaysOverdue: number;
  criticalCases: number;
}

interface ArrearsCase {
  id: number;
  tenantId: number;
  propertyId: number;
  amount: number; // pence
  daysOverdue: number;
  dunningLevel: number; // 1-5
  lastReminderDate: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function getDunningBadge(level: number) {
  const config: Record<number, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
    1: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', label: 'Level 1' },
    2: { variant: 'default', className: 'bg-yellow-500 hover:bg-yellow-600 text-black', label: 'Level 2' },
    3: { variant: 'default', className: 'bg-orange-500 hover:bg-orange-600', label: 'Level 3' },
    4: { variant: 'default', className: 'bg-red-500 hover:bg-red-600', label: 'Level 4' },
    5: { variant: 'destructive', label: 'Level 5' },
  };
  const c = config[level] || config[1];
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
    active: { variant: 'destructive', label: 'Active' },
    resolved: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', label: 'Resolved' },
    written_off: { variant: 'secondary', label: 'Written Off' },
    payment_plan: { variant: 'default', className: 'bg-blue-500 hover:bg-blue-600', label: 'Payment Plan' },
  };
  const c = config[status] || { variant: 'secondary' as const, label: status };
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

// --- Component ---

export default function ArrearsTracker() {
  const { toast } = useToast();
  const [confirmWriteOff, setConfirmWriteOff] = useState<ArrearsCase | null>(null);

  // Fetch summary
  const { data: summary, isLoading: summaryLoading } = useQuery<ArrearsSummary>({
    queryKey: ['/api/crm/arrears/summary'],
  });

  // Fetch arrears cases
  const { data: arrearsCases = [], isLoading: casesLoading } = useQuery<ArrearsCase[]>({
    queryKey: ['/api/crm/arrears'],
  });

  // Run detection mutation
  const detectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/crm/arrears/detect', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to run arrears detection');
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: 'Detection Complete',
        description: `${data.newCases ?? 0} new arrears case(s) detected.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/arrears'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/arrears/summary'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async (arrearsId: number) => {
      const response = await fetch(`/api/crm/arrears/${arrearsId}/remind`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to send reminder');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Reminder Sent', description: 'The arrears reminder has been sent.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/arrears'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Write off mutation
  const writeOffMutation = useMutation({
    mutationFn: async (arrearsId: number) => {
      const response = await fetch(`/api/crm/arrears/${arrearsId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'written_off' }),
      });
      if (!response.ok) throw new Error('Failed to write off arrears');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Written Off', description: 'The arrears case has been written off.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/arrears'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/arrears/summary'] });
      setConfirmWriteOff(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const isLoading = summaryLoading || casesLoading;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Arrears Tracker</h1>
          <p className="text-muted-foreground">Monitor and manage tenant arrears across your portfolio.</p>
        </div>
        <Button
          onClick={() => detectMutation.mutate()}
          disabled={detectMutation.isPending}
        >
          {detectMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-2" />
          )}
          Run Detection
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">
                {formatCurrency(summary?.totalOutstanding ?? 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">{summary?.activeCases ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Days Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold">{summary?.avgDaysOverdue ?? 0}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Critical Cases</CardTitle>
            <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {summaryLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{summary?.criticalCases ?? 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Arrears Table */}
      <Card>
        <CardHeader>
          <CardTitle>Arrears Cases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {casesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : arrearsCases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No arrears cases</p>
              <p className="text-sm">Run detection to identify overdue payments.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant ID</TableHead>
                  <TableHead>Property ID</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Days Overdue</TableHead>
                  <TableHead>Dunning Level</TableHead>
                  <TableHead>Last Reminder</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arrearsCases.map((arrearsCase) => (
                  <TableRow key={arrearsCase.id}>
                    <TableCell>{arrearsCase.tenantId}</TableCell>
                    <TableCell>{arrearsCase.propertyId}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(arrearsCase.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={arrearsCase.daysOverdue > 60 ? 'text-red-600 font-semibold' : ''}>
                        {arrearsCase.daysOverdue}
                      </span>
                    </TableCell>
                    <TableCell>{getDunningBadge(arrearsCase.dunningLevel)}</TableCell>
                    <TableCell>{formatDate(arrearsCase.lastReminderDate)}</TableCell>
                    <TableCell>{getStatusBadge(arrearsCase.status)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Send Reminder"
                          onClick={() => sendReminderMutation.mutate(arrearsCase.id)}
                          disabled={sendReminderMutation.isPending || arrearsCase.status !== 'active'}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Write Off"
                          onClick={() => setConfirmWriteOff(arrearsCase)}
                          disabled={arrearsCase.status !== 'active'}
                        >
                          <XCircle className="h-4 w-4" />
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

      {/* Write Off Confirmation Dialog */}
      <Dialog open={!!confirmWriteOff} onOpenChange={() => setConfirmWriteOff(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Confirm Write Off</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to write off this arrears case?
            </p>
            {confirmWriteOff && (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tenant ID:</span>
                  <span className="font-medium">{confirmWriteOff.tenantId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Property ID:</span>
                  <span className="font-medium">{confirmWriteOff.propertyId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium font-mono">{formatCurrency(confirmWriteOff.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Days Overdue:</span>
                  <span className="font-medium">{confirmWriteOff.daysOverdue}</span>
                </div>
              </div>
            )}
            <p className="mt-4 text-sm text-destructive font-medium">
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmWriteOff(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmWriteOff && writeOffMutation.mutate(confirmWriteOff.id)}
              disabled={writeOffMutation.isPending}
            >
              {writeOffMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Write Off
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
