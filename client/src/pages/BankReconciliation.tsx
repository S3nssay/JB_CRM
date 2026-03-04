import { useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import {
  Upload, ArrowRightLeft, Check, CheckCircle, XCircle, Search,
  Loader2, RefreshCw, ChevronsUpDown, FileSpreadsheet, Ban,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface BankTransaction {
  id: number;
  bankName: string;
  accountNumber: string | null;
  transactionDate: string;
  description: string | null;
  reference: string | null;
  amount: number;
  balance: number | null;
  transactionType: string;
  matchStatus: string;
  matchedPaymentId: number | null;
  matchedInvoiceId: number | null;
  matchedAt: string | null;
  matchedBy: string | null;
  importBatchId: string | null;
  createdAt: string;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  tenantId: number | null;
  totalAmount: number;
  dueDate: string;
  status: string;
}

const formatCurrency = (pence: number) => `£${(Math.abs(pence) / 100).toFixed(2)}`;
const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function BankReconciliation() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showMatchDialog, setShowMatchDialog] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [importForm, setImportForm] = useState({ bankName: '', accountNumber: '', bankFormat: '' });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeTab, setActiveTab] = useState('unmatched');

  // Queries
  const { data: transactions = [], isLoading } = useQuery<BankTransaction[]>({
    queryKey: ['/api/crm/bank-transactions', activeTab],
    queryFn: async () => {
      const params = activeTab !== 'all' ? `?matchStatus=${activeTab}` : '';
      const res = await fetch(`/api/crm/bank-transactions${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
  });

  const { data: summary = {} } = useQuery<Record<string, { count: number; totalCredits: number; totalDebits: number }>>({
    queryKey: ['/api/crm/bank-transactions/summary'],
    queryFn: async () => {
      const res = await fetch('/api/crm/bank-transactions/summary', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const { data: unpaidInvoices = [] } = useQuery<Invoice[]>({
    queryKey: ['/api/crm/invoices', 'unpaid'],
    queryFn: async () => {
      const [sent, overdue] = await Promise.all([
        fetch('/api/crm/invoices?status=sent', { credentials: 'include' }).then(r => r.json()),
        fetch('/api/crm/invoices?status=overdue', { credentials: 'include' }).then(r => r.json()),
      ]);
      return [...sent, ...overdue];
    },
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('bankName', importForm.bankName);
      if (importForm.accountNumber) formData.append('accountNumber', importForm.accountNumber);
      if (importForm.bankFormat) formData.append('bankFormat', importForm.bankFormat);

      const res = await fetch('/api/crm/bank-transactions/import', {
        method: 'POST', credentials: 'include', body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Import failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Import Successful', description: `${data.imported} transactions imported. ${data.matched} auto-matched, ${data.unmatched} unmatched.` });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/bank-transactions'] });
      setShowImportDialog(false);
      setSelectedFile(null);
      setImportForm({ bankName: '', accountNumber: '', bankFormat: '' });
    },
    onError: (error: Error) => {
      toast({ title: 'Import Error', description: error.message, variant: 'destructive' });
    },
  });

  // Manual match mutation
  const matchMutation = useMutation({
    mutationFn: async ({ txnId, invoiceId }: { txnId: number; invoiceId: number }) => {
      const res = await fetch(`/api/crm/bank-transactions/${txnId}/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify({ invoiceId }),
      });
      if (!res.ok) throw new Error('Match failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Transaction Matched' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/bank-transactions'] });
      setShowMatchDialog(false);
      setSelectedTransaction(null);
      setSelectedInvoiceId(null);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Exclude mutation
  const excludeMutation = useMutation({
    mutationFn: async (txnId: number) => {
      const res = await fetch(`/api/crm/bank-transactions/${txnId}/exclude`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Transaction Excluded' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/bank-transactions'] });
    },
  });

  // Re-reconcile mutation
  const reconcileMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/crm/bank-transactions/reconcile', {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: 'Reconciliation Complete', description: `${data.matched} new matches found.` });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/bank-transactions'] });
    },
  });

  const getMatchBadge = (status: string) => {
    switch (status) {
      case 'auto_matched': return <Badge className="bg-green-100 text-green-800">Auto-Matched</Badge>;
      case 'manually_matched': return <Badge className="bg-blue-100 text-blue-800">Manually Matched</Badge>;
      case 'excluded': return <Badge variant="secondary">Excluded</Badge>;
      default: return <Badge variant="outline">Unmatched</Badge>;
    }
  };

  const totalUnmatched = summary.unmatched?.count || 0;
  const totalMatched = (summary.auto_matched?.count || 0) + (summary.manually_matched?.count || 0);
  const totalExcluded = summary.excluded?.count || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bank Reconciliation</h1>
          <p className="text-muted-foreground">Import bank statements and match payments to invoices</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => reconcileMutation.mutate()} disabled={reconcileMutation.isPending}>
            {reconcileMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
            Auto-Reconcile
          </Button>
          <Button onClick={() => setShowImportDialog(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import Statement
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Unmatched</div>
            <div className="text-2xl font-bold text-orange-600">{totalUnmatched}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Matched</div>
            <div className="text-2xl font-bold text-green-600">{totalMatched}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Excluded</div>
            <div className="text-2xl font-bold text-gray-500">{totalExcluded}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">Unmatched Credits</div>
            <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.unmatched?.totalCredits || 0)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Transactions Table */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="unmatched">Unmatched ({totalUnmatched})</TabsTrigger>
          <TabsTrigger value="auto_matched">Auto-Matched</TabsTrigger>
          <TabsTrigger value="manually_matched">Manual</TabsTrigger>
          <TabsTrigger value="excluded">Excluded</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
        </TabsList>
        <TabsContent value={activeTab}>
          <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
              ) : transactions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No transactions found</p>
                  <p className="text-sm mt-1">Import a bank statement to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Bank</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((txn) => (
                      <TableRow key={txn.id}>
                        <TableCell>{formatDate(txn.transactionDate)}</TableCell>
                        <TableCell>{txn.bankName}</TableCell>
                        <TableCell className="max-w-[300px] truncate">{txn.description || txn.reference || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={txn.transactionType === 'credit' ? 'default' : 'secondary'}>
                            {txn.transactionType}
                          </Badge>
                        </TableCell>
                        <TableCell className={`text-right font-mono ${txn.transactionType === 'credit' ? 'text-green-600' : 'text-red-600'}`}>
                          {txn.transactionType === 'credit' ? '+' : '-'}{formatCurrency(txn.amount)}
                        </TableCell>
                        <TableCell>{getMatchBadge(txn.matchStatus)}</TableCell>
                        <TableCell className="text-right">
                          {txn.matchStatus === 'unmatched' && txn.transactionType === 'credit' && (
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" title="Match to Invoice" onClick={() => { setSelectedTransaction(txn); setShowMatchDialog(true); }}>
                                <ArrowRightLeft className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" title="Exclude" onClick={() => excludeMutation.mutate(txn.id)}>
                                <Ban className="h-4 w-4 text-gray-400" />
                              </Button>
                            </div>
                          )}
                          {txn.matchedInvoiceId && (
                            <span className="text-xs text-muted-foreground">Inv #{txn.matchedInvoiceId}</span>
                          )}
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

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Import Bank Statement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Bank Name</Label>
              <Select value={importForm.bankName} onValueChange={(v) => setImportForm({ ...importForm, bankName: v })}>
                <SelectTrigger><SelectValue placeholder="Select bank" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Barclays">Barclays</SelectItem>
                  <SelectItem value="NatWest">NatWest</SelectItem>
                  <SelectItem value="HSBC">HSBC</SelectItem>
                  <SelectItem value="Lloyds">Lloyds</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account Number (last 4 digits, optional)</Label>
              <Input maxLength={4} placeholder="e.g. 1234" value={importForm.accountNumber} onChange={(e) => setImportForm({ ...importForm, accountNumber: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>CSV File</Label>
              <Input type="file" accept=".csv" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
              <p className="text-xs text-muted-foreground">Supported formats: Barclays, NatWest, HSBC, Lloyds CSV exports</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>Cancel</Button>
            <Button onClick={() => importMutation.mutate()} disabled={importMutation.isPending || !selectedFile || !importForm.bankName}>
              {importMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Import & Reconcile
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual Match Dialog */}
      <Dialog open={showMatchDialog} onOpenChange={(open) => { if (!open) { setShowMatchDialog(false); setSelectedTransaction(null); setSelectedInvoiceId(null); } }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Match Transaction to Invoice</DialogTitle>
          </DialogHeader>
          {selectedTransaction && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                <p className="text-sm font-medium">{selectedTransaction.description}</p>
                <p className="text-lg font-bold text-green-600">+{formatCurrency(selectedTransaction.amount)}</p>
                <p className="text-xs text-muted-foreground">{formatDate(selectedTransaction.transactionDate)} - {selectedTransaction.bankName}</p>
              </div>
              <div className="space-y-2">
                <Label>Select Invoice</Label>
                <Popover open={invoiceOpen} onOpenChange={setInvoiceOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                      {selectedInvoiceId ? unpaidInvoices.find(i => i.id === selectedInvoiceId)?.invoiceNumber || `#${selectedInvoiceId}` : 'Search invoices...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Search by invoice number..." />
                      <CommandList>
                        <CommandEmpty>No invoices found.</CommandEmpty>
                        <CommandGroup>
                          {unpaidInvoices.map((inv) => (
                            <CommandItem key={inv.id} value={inv.invoiceNumber} onSelect={() => { setSelectedInvoiceId(inv.id); setInvoiceOpen(false); }}>
                              <Check className={cn("mr-2 h-4 w-4", selectedInvoiceId === inv.id ? "opacity-100" : "opacity-0")} />
                              <span className="font-mono">{inv.invoiceNumber}</span>
                              <span className="ml-2 text-muted-foreground">{formatCurrency(inv.totalAmount)}</span>
                              <span className="ml-auto text-xs text-muted-foreground">Due {formatDate(inv.dueDate)}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMatchDialog(false); setSelectedTransaction(null); }}>Cancel</Button>
            <Button
              onClick={() => selectedTransaction && selectedInvoiceId && matchMutation.mutate({ txnId: selectedTransaction.id, invoiceId: selectedInvoiceId })}
              disabled={matchMutation.isPending || !selectedInvoiceId}
            >
              {matchMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Match & Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
