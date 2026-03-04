import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  FileText, Loader2, Download, CheckCircle, PoundSterling, Mail,
  ArrowLeft, Eye, ChevronRight, Search, Building2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

// --- Types ---

interface LandlordStatement {
  id: number;
  periodStart: string;
  periodEnd: string;
  totalRentCollected: number;
  managementFees: number;
  maintenanceDeductions: number;
  vatOnFees: number;
  netPayable: number;
  status: string;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

interface LandlordWithStatement {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  managedPropertyCount: number;
  lastStatement: LandlordStatement | null;
}

interface StatementLineItem {
  id: number;
  description: string;
  lineType: string;
  amount: number;
  transactionDate: string;
}

interface StatementDetail {
  id: number;
  landlordId: number;
  statementPeriodStart: string;
  statementPeriodEnd: string;
  totalRentCollected: number;
  managementFees: number;
  maintenanceDeductions: number;
  vatOnFees: number;
  netPayable: number;
  status: string;
  lineItems: StatementLineItem[];
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB');
}

function getLastCalendarMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
    label: start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }),
  };
}

function getStatusBadge(status: string) {
  const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string; label: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    approved: { variant: 'default', className: 'bg-blue-500 hover:bg-blue-600', label: 'Approved' },
    sent: { variant: 'default', className: 'bg-purple-500 hover:bg-purple-600', label: 'Sent' },
    paid: { variant: 'default', className: 'bg-green-500 hover:bg-green-600', label: 'Paid' },
  };
  const c = config[status] || config.draft;
  return <Badge variant={c.variant} className={c.className}>{c.label}</Badge>;
}

// --- Component ---

export default function LandlordStatements() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLandlordId, setSelectedLandlordId] = useState<number | null>(null);
  const [selectedStatementId, setSelectedStatementId] = useState<number | null>(null);

  const lastMonth = useMemo(() => getLastCalendarMonth(), []);

  // Fetch all landlords with their latest statement
  const { data: landlords = [], isLoading } = useQuery<LandlordWithStatement[]>({
    queryKey: ['/api/crm/landlords-with-statements'],
  });

  // Fetch statement history for selected landlord
  const { data: statementHistory = [], isLoading: historyLoading } = useQuery<any[]>({
    queryKey: ['/api/crm/landlords', selectedLandlordId, 'statements'],
    queryFn: async () => {
      if (!selectedLandlordId) return [];
      const res = await fetch(`/api/crm/landlords/${selectedLandlordId}/statements`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch statements');
      return res.json();
    },
    enabled: !!selectedLandlordId,
  });

  // Fetch statement detail
  const { data: statementDetail, isLoading: detailLoading } = useQuery<StatementDetail>({
    queryKey: ['/api/crm/statements', selectedStatementId],
    queryFn: async () => {
      if (!selectedStatementId) return null;
      const res = await fetch(`/api/crm/statements/${selectedStatementId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch statement');
      return res.json();
    },
    enabled: !!selectedStatementId,
  });

  // Generate statement mutation
  const generateMutation = useMutation({
    mutationFn: async (landlordId: number) => {
      const res = await fetch('/api/crm/statements/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          landlordId,
          periodStart: lastMonth.periodStart,
          periodEnd: lastMonth.periodEnd,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to generate statement' }));
        throw new Error(err.error || 'Failed to generate statement');
      }
      return res.json();
    },
    onSuccess: (_data, landlordId) => {
      const landlord = landlords.find(l => l.id === landlordId);
      toast({ title: 'Statement Generated', description: `Statement for ${lastMonth.label} created for ${landlord?.name || 'landlord'}.` });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords-with-statements'] });
      if (selectedLandlordId === landlordId) {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords', landlordId, 'statements'] });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Send statement email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (statementId: number) => {
      const res = await fetch(`/api/crm/statements/${statementId}/send-email`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to send email' }));
        throw new Error(err.error || 'Failed to send email');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Email Queued', description: data.message || 'Statement email has been queued for delivery.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords-with-statements'] });
      if (selectedLandlordId) {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords', selectedLandlordId, 'statements'] });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Approve statement mutation
  const approveMutation = useMutation({
    mutationFn: async (statementId: number) => {
      const res = await fetch(`/api/crm/statements/${statementId}/approve`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to approve statement');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Statement Approved' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords-with-statements'] });
      if (selectedLandlordId) {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords', selectedLandlordId, 'statements'] });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Mark paid mutation
  const markPaidMutation = useMutation({
    mutationFn: async (statementId: number) => {
      const res = await fetch(`/api/crm/statements/${statementId}/mark-paid`, {
        method: 'PUT',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to mark statement as paid');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Marked as Paid' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords-with-statements'] });
      if (selectedLandlordId) {
        queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords', selectedLandlordId, 'statements'] });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Export CSV
  async function handleExportCSV(statementId?: number) {
    try {
      const url = statementId
        ? `/api/crm/export/statements?statementId=${statementId}`
        : `/api/crm/export/statements`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to export');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = window.URL.createObjectURL(blob);
      a.download = `statements-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      toast({ title: 'Export Complete' });
    } catch (error: any) {
      toast({ title: 'Export Failed', description: error.message, variant: 'destructive' });
    }
  }

  // Filter landlords by search
  const filteredLandlords = useMemo(() => {
    if (!searchTerm.trim()) return landlords;
    const term = searchTerm.toLowerCase();
    return landlords.filter(l =>
      l.name.toLowerCase().includes(term) ||
      (l.email && l.email.toLowerCase().includes(term))
    );
  }, [landlords, searchTerm]);

  // Summary stats
  const stats = useMemo(() => {
    const total = landlords.length;
    const withStatements = landlords.filter(l => l.lastStatement).length;
    const draft = landlords.filter(l => l.lastStatement?.status === 'draft').length;
    const approved = landlords.filter(l => l.lastStatement?.status === 'approved').length;
    const sent = landlords.filter(l => l.lastStatement?.status === 'sent').length;
    const paid = landlords.filter(l => l.lastStatement?.status === 'paid').length;
    const totalPayable = landlords.reduce((sum, l) => sum + (l.lastStatement?.netPayable || 0), 0);
    return { total, withStatements, draft, approved, sent, paid, totalPayable };
  }, [landlords]);

  const selectedLandlord = landlords.find(l => l.id === selectedLandlordId);

  // --- Statement Detail View ---
  if (selectedStatementId && statementDetail) {
    return (
      <div className="p-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => setSelectedStatementId(null)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to {selectedLandlord?.name || 'Statements'}
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Statement Detail</h1>
            <p className="text-muted-foreground">
              {formatDate(statementDetail.statementPeriodStart)} — {formatDate(statementDetail.statementPeriodEnd)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge(statementDetail.status)}
            {statementDetail.status === 'draft' && (
              <Button size="sm" onClick={() => approveMutation.mutate(statementDetail.id)} disabled={approveMutation.isPending}>
                <CheckCircle className="h-4 w-4 mr-1" /> Approve
              </Button>
            )}
            {(statementDetail.status === 'approved' || statementDetail.status === 'draft') && (
              <Button size="sm" variant="outline" onClick={() => sendEmailMutation.mutate(statementDetail.id)} disabled={sendEmailMutation.isPending}>
                <Mail className="h-4 w-4 mr-1" /> Email to Landlord
              </Button>
            )}
            {statementDetail.status === 'sent' && (
              <Button size="sm" onClick={() => markPaidMutation.mutate(statementDetail.id)} disabled={markPaidMutation.isPending}>
                <PoundSterling className="h-4 w-4 mr-1" /> Mark Paid
              </Button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Rent Collected</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(statementDetail.totalRentCollected)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Management Fees</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-orange-600">{formatCurrency(statementDetail.managementFees)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">VAT on Fees</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-orange-500">{formatCurrency(statementDetail.vatOnFees)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Maintenance</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-red-600">{formatCurrency(statementDetail.maintenanceDeductions)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Net Payable</CardTitle></CardHeader>
            <CardContent><div className="text-xl font-bold text-purple-700">{formatCurrency(statementDetail.netPayable)}</div></CardContent>
          </Card>
        </div>

        {/* Line Items */}
        <Card>
          <CardHeader><CardTitle>Line Items</CardTitle></CardHeader>
          <CardContent className="p-0">
            {detailLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : !statementDetail.lineItems || statementDetail.lineItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4" />
                <p className="text-sm">No line items.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementDetail.lineItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{formatDate(item.transactionDate)}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="capitalize">{item.lineType?.replace(/_/g, ' ')}</TableCell>
                      <TableCell className={`text-right font-mono ${item.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.amount < 0 ? '-' : ''}{formatCurrency(Math.abs(item.amount))}
                      </TableCell>
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

  // --- Landlord Statement History View ---
  if (selectedLandlordId) {
    return (
      <div className="p-6 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => { setSelectedLandlordId(null); setSelectedStatementId(null); }}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to All Landlords
        </Button>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{selectedLandlord?.name}</h1>
            <p className="text-muted-foreground">
              {selectedLandlord?.email || 'No email'} · {selectedLandlord?.managedPropertyCount} managed {selectedLandlord?.managedPropertyCount === 1 ? 'property' : 'properties'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => generateMutation.mutate(selectedLandlordId)}
              disabled={generateMutation.isPending}
            >
              {generateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PoundSterling className="h-4 w-4 mr-2" />}
              Generate ({lastMonth.label})
            </Button>
            <Button variant="outline" onClick={() => handleExportCSV()}>
              <Download className="h-4 w-4 mr-2" /> Export CSV
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle>Statement History</CardTitle></CardHeader>
          <CardContent className="p-0">
            {historyLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : statementHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mb-4" />
                <p className="text-lg font-medium">No statements yet</p>
                <p className="text-sm">Generate a statement to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Rent</TableHead>
                    <TableHead className="text-right">Fees</TableHead>
                    <TableHead className="text-right">Maintenance</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statementHistory.map((stmt: any) => (
                    <TableRow key={stmt.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStatementId(stmt.id)}>
                      <TableCell className="font-medium">
                        {formatDate(stmt.statementPeriodStart)} — {formatDate(stmt.statementPeriodEnd)}
                        <ChevronRight className="h-4 w-4 text-muted-foreground inline ml-1" />
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(stmt.totalRentCollected)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(stmt.managementFees)}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(stmt.maintenanceDeductions)}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">{formatCurrency(stmt.netPayable)}</TableCell>
                      <TableCell>{getStatusBadge(stmt.status)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          {stmt.status === 'draft' && (
                            <Button variant="ghost" size="sm" title="Approve" onClick={() => approveMutation.mutate(stmt.id)} disabled={approveMutation.isPending}>
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                          )}
                          {(stmt.status === 'approved' || stmt.status === 'draft') && (
                            <Button variant="ghost" size="sm" title="Email to Landlord" onClick={() => sendEmailMutation.mutate(stmt.id)} disabled={sendEmailMutation.isPending}>
                              <Mail className="h-4 w-4" />
                            </Button>
                          )}
                          {stmt.status === 'sent' && (
                            <Button variant="ghost" size="sm" title="Mark Paid" onClick={() => markPaidMutation.mutate(stmt.id)} disabled={markPaidMutation.isPending}>
                              <PoundSterling className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" title="View Detail" onClick={() => setSelectedStatementId(stmt.id)}>
                            <Eye className="h-4 w-4" />
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
      </div>
    );
  }

  // --- Main View: All Landlords ---
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Landlord Statements</h1>
          <p className="text-muted-foreground">Generate and email monthly statements for all landlords. Default period: {lastMonth.label}.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleExportCSV()}>
            <Download className="h-4 w-4 mr-2" /> Export All
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Total Landlords</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Draft</p>
            <p className="text-2xl font-bold text-gray-600">{stats.draft}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Approved</p>
            <p className="text-2xl font-bold text-blue-600">{stats.approved}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Sent</p>
            <p className="text-2xl font-bold text-purple-600">{stats.sent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Paid</p>
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-xs font-medium text-muted-foreground">Total Payable</p>
            <p className="text-2xl font-bold text-purple-700">{formatCurrency(stats.totalPayable)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search landlords..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Landlords Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
          ) : filteredLandlords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Building2 className="h-12 w-12 mb-4" />
              <p className="text-lg font-medium">No landlords with managed properties</p>
              <p className="text-sm">Add properties and assign landlords to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Landlord</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Properties</TableHead>
                  <TableHead>Last Statement</TableHead>
                  <TableHead className="text-right">Net Payable</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLandlords.map((landlord) => (
                  <TableRow
                    key={landlord.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedLandlordId(landlord.id)}
                  >
                    <TableCell className="font-medium">
                      {landlord.name}
                      <ChevronRight className="h-4 w-4 text-muted-foreground inline ml-1" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{landlord.email || '-'}</TableCell>
                    <TableCell className="text-center">{landlord.managedPropertyCount}</TableCell>
                    <TableCell>
                      {landlord.lastStatement
                        ? `${formatDate(landlord.lastStatement.periodStart)} — ${formatDate(landlord.lastStatement.periodEnd)}`
                        : <span className="text-muted-foreground">None</span>
                      }
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {landlord.lastStatement
                        ? formatCurrency(landlord.lastStatement.netPayable)
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      {landlord.lastStatement
                        ? getStatusBadge(landlord.lastStatement.status)
                        : <Badge variant="outline">No Statement</Badge>
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          title={`Generate for ${lastMonth.label}`}
                          onClick={() => generateMutation.mutate(landlord.id)}
                          disabled={generateMutation.isPending}
                        >
                          <PoundSterling className="h-4 w-4" />
                        </Button>
                        {landlord.lastStatement && ['draft', 'approved'].includes(landlord.lastStatement.status) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Email Statement"
                            onClick={() => sendEmailMutation.mutate(landlord.lastStatement!.id)}
                            disabled={sendEmailMutation.isPending}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View History"
                          onClick={() => setSelectedLandlordId(landlord.id)}
                        >
                          <Eye className="h-4 w-4" />
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
    </div>
  );
}
