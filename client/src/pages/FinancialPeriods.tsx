import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays, Plus, Lock, Wand2, Loader2, AlertTriangle, Calendar,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

const BRAND = '#791E75';

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
  updated_at: string;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
  open: { label: 'Open', color: '#16a34a', bgColor: '#f0fdf4' },
  closed: { label: 'Closed', color: '#dc2626', bgColor: '#fef2f2' },
  locked: { label: 'Locked', color: '#6b7280', bgColor: '#f3f4f6' },
};

export default function FinancialPeriods() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [autoGenDialogOpen, setAutoGenDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [closingId, setClosingId] = useState<number | null>(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    period_type: 'monthly',
    financial_year: new Date().getFullYear().toString(),
  });

  const [autoGenForm, setAutoGenForm] = useState({
    year: new Date().getFullYear().toString(),
    start_month: '4', // UK tax year starts April
  });

  const { data: periods = [], isLoading, error } = useQuery<FinancialPeriod[]>({
    queryKey: ['/api/crm/accounting/financial-periods'],
  });

  const handleCreate = async () => {
    if (!createForm.name || !createForm.start_date || !createForm.end_date) {
      toast({ title: 'Missing fields', description: 'Name, start date, and end date are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await apiRequest('POST', '/api/crm/accounting/financial-periods', {
        name: createForm.name,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        period_type: createForm.period_type,
        financial_year: parseInt(createForm.financial_year) || null,
      });
      toast({ title: 'Period created' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/financial-periods'] });
      setCreateDialogOpen(false);
      setCreateForm({ name: '', start_date: '', end_date: '', period_type: 'monthly', financial_year: new Date().getFullYear().toString() });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoGenerate = async () => {
    setSaving(true);
    try {
      const result = await apiRequest('POST', '/api/crm/accounting/financial-periods/auto-generate', {
        year: parseInt(autoGenForm.year),
        start_month: parseInt(autoGenForm.start_month),
      });
      const data = await result.json();
      toast({ title: 'Periods generated', description: data.message });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/financial-periods'] });
      setAutoGenDialogOpen(false);
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleClose = async (id: number) => {
    setClosingId(id);
    try {
      await apiRequest('POST', `/api/crm/accounting/financial-periods/${id}/close`);
      toast({ title: 'Period closed' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/financial-periods'] });
    } catch (err) {
      toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setClosingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-destructive font-medium">Failed to load financial periods</p>
      </div>
    );
  }

  // Group by financial year
  const years = Array.from(new Set(periods.map(p => p.financial_year).filter(Boolean))).sort((a, b) => (b || 0) - (a || 0));
  const ungrouped = periods.filter(p => !p.financial_year);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: BRAND }}>Financial Periods</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage accounting periods for journal entry posting</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setAutoGenDialogOpen(true)} className="gap-2">
            <Wand2 className="h-4 w-4" /> Auto-Generate FY
          </Button>
          <Button onClick={() => setCreateDialogOpen(true)} className="gap-2" style={{ backgroundColor: BRAND }}>
            <Plus className="h-4 w-4" /> Create Period
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Total Periods</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold" style={{ color: BRAND }}>{periods.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Open</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-green-600">{periods.filter(p => p.status === 'open').length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase">Closed</CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="text-2xl font-bold text-red-600">{periods.filter(p => p.status === 'closed').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Periods Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            All Financial Periods
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {periods.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground">
              <Calendar className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No financial periods defined</p>
              <p className="text-xs mt-1">Use "Auto-Generate FY" to create periods for a financial year</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>FY</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Closed At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periods.map((period) => {
                  const status = statusConfig[period.status] || statusConfig.open;
                  return (
                    <TableRow key={period.id}>
                      <TableCell className="font-medium">{period.name}</TableCell>
                      <TableCell className="text-xs">{formatDate(period.start_date)}</TableCell>
                      <TableCell className="text-xs">{formatDate(period.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize">{period.period_type || 'monthly'}</Badge>
                      </TableCell>
                      <TableCell className="text-xs font-mono">{period.financial_year || '-'}</TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={{ color: status.color, backgroundColor: status.bgColor, borderColor: status.color }}
                        >
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatDate(period.closed_at)}</TableCell>
                      <TableCell className="text-right">
                        {period.status === 'open' && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5 text-xs"
                            disabled={closingId === period.id}
                            onClick={() => handleClose(period.id)}
                          >
                            {closingId === period.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Lock className="h-3 w-3" />
                            )}
                            Close Period
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Period Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Financial Period</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. January 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input type="date" value={createForm.start_date} onChange={(e) => setCreateForm({ ...createForm, start_date: e.target.value })} />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input type="date" value={createForm.end_date} onChange={(e) => setCreateForm({ ...createForm, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Period Type</Label>
              <Select value={createForm.period_type} onValueChange={(v) => setCreateForm({ ...createForm, period_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Financial Year</Label>
              <Input type="number" value={createForm.financial_year} onChange={(e) => setCreateForm({ ...createForm, financial_year: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} style={{ backgroundColor: BRAND }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auto-Generate Dialog */}
      <Dialog open={autoGenDialogOpen} onOpenChange={setAutoGenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Auto-Generate Financial Year</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will create 12 monthly periods for the selected financial year.
          </p>
          <div className="space-y-4">
            <div>
              <Label>Financial Year (start year)</Label>
              <Input type="number" value={autoGenForm.year} onChange={(e) => setAutoGenForm({ ...autoGenForm, year: e.target.value })} />
            </div>
            <div>
              <Label>Starting Month</Label>
              <Select value={autoGenForm.start_month} onValueChange={(v) => setAutoGenForm({ ...autoGenForm, start_month: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">January</SelectItem>
                  <SelectItem value="2">February</SelectItem>
                  <SelectItem value="3">March</SelectItem>
                  <SelectItem value="4">April (UK Tax Year)</SelectItem>
                  <SelectItem value="5">May</SelectItem>
                  <SelectItem value="6">June</SelectItem>
                  <SelectItem value="7">July</SelectItem>
                  <SelectItem value="8">August</SelectItem>
                  <SelectItem value="9">September</SelectItem>
                  <SelectItem value="10">October</SelectItem>
                  <SelectItem value="11">November</SelectItem>
                  <SelectItem value="12">December</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAutoGenDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAutoGenerate} disabled={saving} style={{ backgroundColor: BRAND }}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Generate Periods
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
