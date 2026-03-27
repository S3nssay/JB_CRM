import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command';
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import {
  BookOpen,
  Plus,
  Loader2,
  Search,
  Check,
  ChevronsUpDown,
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  XCircle,
  CalendarIcon,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

// --- Types ---

interface JournalEntry {
  id: number;
  entry_number: string;
  entry_date: string;
  description: string;
  source_type: string | null;
  source_id: number | null;
  financial_period_id: number | null;
  status: 'draft' | 'posted' | 'voided';
  posted_at: string | null;
  notes: string | null;
  created_at: string;
}

interface JournalLine {
  id: number;
  account_id: number;
  account_code: string;
  account_name: string;
  description: string | null;
  debit_amount: number;
  credit_amount: number;
  tax_rate_id: number | null;
  tax_amount: number | null;
  property_id: number | null;
  landlord_id: number | null;
  tenant_id: number | null;
}

interface JournalEntryDetail extends JournalEntry {
  lines: JournalLine[];
}

interface ChartAccount {
  id: number;
  code: string;
  name: string;
  type: string;
}

interface NewLine {
  account_id: number | null;
  description: string;
  debit_amount: string;
  credit_amount: string;
  tax_rate_id: number | null;
  tax_amount: string;
  property_id: number | null;
  landlord_id: number | null;
  tenant_id: number | null;
}

// --- Helpers ---

function formatCurrency(pence: number): string {
  return `\u00A3${(pence / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'draft':
      return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Draft</Badge>;
    case 'posted':
      return <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100">Posted</Badge>;
    case 'voided':
      return <Badge variant="destructive">Voided</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getSourceLabel(source_type: string | null): string {
  if (!source_type) return 'Manual';
  const labels: Record<string, string> = {
    manual: 'Manual',
    invoice: 'Invoice',
    payment: 'Payment',
    rent: 'Rent',
    deposit: 'Deposit',
    management_fee: 'Management Fee',
    maintenance: 'Maintenance',
    adjustment: 'Adjustment',
  };
  return labels[source_type] || source_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function emptyLine(): NewLine {
  return {
    account_id: null,
    description: '',
    debit_amount: '',
    credit_amount: '',
    tax_rate_id: null,
    tax_amount: '',
    property_id: null,
    landlord_id: null,
    tenant_id: null,
  };
}

function parsePence(value: string): number {
  const num = parseFloat(value);
  if (isNaN(num) || num < 0) return 0;
  return Math.round(num * 100);
}

// --- Account Combobox ---

function AccountCombobox({
  accounts,
  value,
  onChange,
}: {
  accounts: ChartAccount[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find(a => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-left font-normal h-9 text-sm"
        >
          <span className="truncate">
            {selected ? `${selected.code} - ${selected.name}` : 'Select account...'}
          </span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search accounts..." />
          <CommandList>
            <CommandEmpty>No accounts found.</CommandEmpty>
            <CommandGroup>
              {accounts.map(account => (
                <CommandItem
                  key={account.id}
                  value={`${account.code} ${account.name}`}
                  onSelect={() => {
                    onChange(account.id === value ? null : account.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === account.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="font-mono text-xs mr-2">{account.code}</span>
                  <span className="truncate">{account.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{account.type}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// --- Expandable Row ---

function ExpandableEntryRow({
  entry,
  totalDebits,
  onPost,
  onVoid,
  isPosting,
  isVoiding,
}: {
  entry: JournalEntry;
  totalDebits: number;
  onPost: (id: number) => void;
  onVoid: (id: number) => void;
  isPosting: boolean;
  isVoiding: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const { data: detail, isLoading: detailLoading } = useQuery<JournalEntryDetail>({
    queryKey: [`/api/crm/accounting/journal-entries/${entry.id}`],
    enabled: expanded,
  });

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded(!expanded)}
      >
        <TableCell className="w-8">
          <CollapsibleTrigger asChild onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>
        </TableCell>
        <TableCell className="font-mono text-sm">{entry.entry_number}</TableCell>
        <TableCell>{formatDate(entry.entry_date)}</TableCell>
        <TableCell className="max-w-[300px] truncate">{entry.description}</TableCell>
        <TableCell>{getSourceLabel(entry.source_type)}</TableCell>
        <TableCell>{getStatusBadge(entry.status)}</TableCell>
        <TableCell className="text-right font-mono">{formatCurrency(totalDebits)}</TableCell>
        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-1">
            {entry.status === 'draft' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                onClick={() => onPost(entry.id)}
                disabled={isPosting}
              >
                {isPosting ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                Post
              </Button>
            )}
            {entry.status === 'posted' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-red-700 border-red-300 hover:bg-red-50"
                onClick={() => onVoid(entry.id)}
                disabled={isVoiding}
              >
                {isVoiding ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3 mr-1" />}
                Void
              </Button>
            )}
          </div>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={8} className="p-0 border-b-2 border-purple-100">
            <CollapsibleContent>
              <div className="bg-muted/30 px-6 py-4">
                {detailLoading ? (
                  <div className="flex items-center gap-2 text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading line details...
                  </div>
                ) : detail?.lines && detail.lines.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-foreground">Line Items</h4>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground italic max-w-[400px] truncate">
                          Notes: {entry.notes}
                        </p>
                      )}
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-xs">Account Code</TableHead>
                          <TableHead className="text-xs">Account Name</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs text-right">Debit</TableHead>
                          <TableHead className="text-xs text-right">Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.lines.map(line => (
                          <TableRow key={line.id} className="hover:bg-transparent">
                            <TableCell className="font-mono text-xs py-2">{line.account_code}</TableCell>
                            <TableCell className="text-sm py-2">{line.account_name}</TableCell>
                            <TableCell className="text-sm py-2 text-muted-foreground">
                              {line.description || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm py-2">
                              {line.debit_amount > 0 ? formatCurrency(line.debit_amount) : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-sm py-2">
                              {line.credit_amount > 0 ? formatCurrency(line.credit_amount) : '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="hover:bg-transparent border-t-2">
                          <TableCell colSpan={3} className="text-right text-xs font-semibold py-2">
                            Totals
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold py-2">
                            {formatCurrency(detail.lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0))}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold py-2">
                            {formatCurrency(detail.lines.reduce((sum, l) => sum + (l.credit_amount || 0), 0))}
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                    {entry.posted_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Posted: {formatDate(entry.posted_at)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-2">No line items found.</p>
                )}
              </div>
            </CollapsibleContent>
          </TableCell>
        </TableRow>
      )}
    </Collapsible>
  );
}

// --- Main Component ---

export default function JournalEntries() {
  const { toast } = useToast();

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [fromDateOpen, setFromDateOpen] = useState(false);
  const [toDateOpen, setToDateOpen] = useState(false);

  // Create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [entryDate, setEntryDate] = useState<Date | undefined>(new Date());
  const [entryDateOpen, setEntryDateOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [sourceType, setSourceType] = useState<string>('manual');
  const [lines, setLines] = useState<NewLine[]>([emptyLine(), emptyLine()]);

  // Build query params
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
    if (fromDate) params.append('from_date', format(fromDate, 'yyyy-MM-dd'));
    if (toDate) params.append('to_date', format(toDate, 'yyyy-MM-dd'));
    return params.toString();
  }, [statusFilter, fromDate, toDate]);

  // Fetch journal entries
  const { data: entries = [], isLoading } = useQuery<JournalEntry[]>({
    queryKey: [`/api/crm/accounting/journal-entries${queryParams ? `?${queryParams}` : ''}`],
  });

  // Fetch chart of accounts for the create form
  const { data: accounts = [] } = useQuery<ChartAccount[]>({
    queryKey: ['/api/crm/accounting/chart-of-accounts'],
  });

  // Compute per-entry debit totals from detail queries when expanded.
  // For the main table, we use a placeholder approach: fetch detail on expand.
  // But for the total column in the main listing, we need to get it from the entry list.
  // The API returns the entries but not totals directly, so we show a dash for entries
  // that haven't been expanded yet, or calculate from cached detail data.

  // Actually, we can derive totals from the detail cache if it exists.
  const getEntryTotal = useCallback((entryId: number): number => {
    const cached = queryClient.getQueryData<JournalEntryDetail>(
      [`/api/crm/accounting/journal-entries/${entryId}`]
    );
    if (cached?.lines) {
      return cached.lines.reduce((sum, l) => sum + (l.debit_amount || 0), 0);
    }
    return 0;
  }, []);

  // Filter entries by search text
  const filteredEntries = useMemo(() => {
    if (!searchText.trim()) return entries;
    const lower = searchText.toLowerCase();
    return entries.filter(
      e =>
        e.entry_number?.toLowerCase().includes(lower) ||
        e.description?.toLowerCase().includes(lower) ||
        (e.source_type && e.source_type.toLowerCase().includes(lower))
    );
  }, [entries, searchText]);

  // Create journal entry mutation
  const createMutation = useMutation({
    mutationFn: async (data: {
      entry_date: string;
      description: string;
      source_type: string;
      source_id: number | null;
      notes: string;
      lines: {
        account_id: number;
        description: string;
        debit_amount: number;
        credit_amount: number;
        tax_rate_id: number | null;
        tax_amount: number;
        property_id: number | null;
        landlord_id: number | null;
        tenant_id: number | null;
      }[];
    }) => {
      return apiRequest('/api/crm/accounting/journal-entries', 'POST', data);
    },
    onSuccess: () => {
      toast({ title: 'Journal Entry Created', description: 'The journal entry has been saved as a draft.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/journal-entries'] });
      resetCreateForm();
      setShowCreateDialog(false);
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Post mutation
  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/accounting/journal-entries/${id}/post`, 'PUT');
    },
    onSuccess: () => {
      toast({ title: 'Entry Posted', description: 'The journal entry has been posted to the ledger.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/journal-entries'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Void mutation
  const voidMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest(`/api/crm/accounting/journal-entries/${id}/void`, 'PUT');
    },
    onSuccess: () => {
      toast({ title: 'Entry Voided', description: 'The journal entry has been voided.' });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/accounting/journal-entries'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Line management
  const updateLine = (index: number, field: keyof NewLine, value: any) => {
    setLines(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addLine = () => {
    setLines(prev => [...prev, emptyLine()]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter((_, i) => i !== index));
  };

  // Totals computation for the create form
  const totalDebits = useMemo(() => {
    return lines.reduce((sum, l) => sum + parsePence(l.debit_amount), 0);
  }, [lines]);

  const totalCredits = useMemo(() => {
    return lines.reduce((sum, l) => sum + parsePence(l.credit_amount), 0);
  }, [lines]);

  const difference = totalDebits - totalCredits;
  const isBalanced = totalDebits > 0 && totalCredits > 0 && difference === 0;

  // Validate form
  const canSubmit = useMemo(() => {
    if (!entryDate || !description.trim()) return false;
    if (!isBalanced) return false;
    const validLines = lines.filter(l => l.account_id !== null && (parsePence(l.debit_amount) > 0 || parsePence(l.credit_amount) > 0));
    return validLines.length >= 2;
  }, [entryDate, description, isBalanced, lines]);

  const resetCreateForm = () => {
    setEntryDate(new Date());
    setDescription('');
    setNotes('');
    setSourceType('manual');
    setLines([emptyLine(), emptyLine()]);
  };

  const handleSubmit = () => {
    if (!canSubmit || !entryDate) return;

    const validLines = lines
      .filter(l => l.account_id !== null && (parsePence(l.debit_amount) > 0 || parsePence(l.credit_amount) > 0))
      .map(l => ({
        account_id: l.account_id!,
        description: l.description,
        debit_amount: parsePence(l.debit_amount),
        credit_amount: parsePence(l.credit_amount),
        tax_rate_id: l.tax_rate_id,
        tax_amount: parsePence(l.tax_amount),
        property_id: l.property_id,
        landlord_id: l.landlord_id,
        tenant_id: l.tenant_id,
      }));

    createMutation.mutate({
      entry_date: format(entryDate, 'yyyy-MM-dd'),
      description,
      source_type: sourceType,
      source_id: null,
      notes,
      lines: validLines,
    });
  };

  // Summary stats
  const draftCount = entries.filter(e => e.status === 'draft').length;
  const postedCount = entries.filter(e => e.status === 'posted').length;
  const voidedCount = entries.filter(e => e.status === 'voided').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" style={{ color: '#791E75' }} />
            Journal Entries
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Double-entry accounting journal for all financial transactions
          </p>
        </div>
        <Button
          onClick={() => {
            resetCreateForm();
            setShowCreateDialog(true);
          }}
          style={{ backgroundColor: '#791E75' }}
          className="text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Journal Entry
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Entries</p>
                <p className="text-2xl font-bold">{entries.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Draft</p>
                <p className="text-2xl font-bold text-yellow-600">{draftCount}</p>
              </div>
              <FileText className="h-8 w-8 text-yellow-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Posted</p>
                <p className="text-2xl font-bold text-green-600">{postedCount}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-200" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Voided</p>
                <p className="text-2xl font-bold text-red-600">{voidedCount}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-200" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-end gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by entry number, description..."
                  value={searchText}
                  onChange={e => setSearchText(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="w-[160px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="posted">Posted</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="w-[170px]">
              <Label className="text-xs text-muted-foreground mb-1 block">From Date</Label>
              <Popover open={fromDateOpen} onOpenChange={setFromDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-9',
                      !fromDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fromDate ? format(fromDate, 'dd/MM/yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fromDate}
                    onSelect={d => {
                      setFromDate(d);
                      setFromDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* To Date */}
            <div className="w-[170px]">
              <Label className="text-xs text-muted-foreground mb-1 block">To Date</Label>
              <Popover open={toDateOpen} onOpenChange={setToDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal h-9',
                      !toDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {toDate ? format(toDate, 'dd/MM/yyyy') : 'Select date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={toDate}
                    onSelect={d => {
                      setToDate(d);
                      setToDateOpen(false);
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Clear Filters */}
            {(searchText || statusFilter !== 'all' || fromDate || toDate) && (
              <Button
                variant="ghost"
                size="sm"
                className="h-9"
                onClick={() => {
                  setSearchText('');
                  setStatusFilter('all');
                  setFromDate(undefined);
                  setToDate(undefined);
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Journal Entries Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Loading journal entries...</span>
            </div>
          ) : filteredEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <BookOpen className="h-12 w-12 mb-3 opacity-30" />
              <p className="text-lg font-medium">No journal entries found</p>
              <p className="text-sm">
                {searchText || statusFilter !== 'all' || fromDate || toDate
                  ? 'Try adjusting your filters'
                  : 'Create your first journal entry to get started'}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-[120px]">Entry #</TableHead>
                  <TableHead className="w-[120px]">Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[130px]">Source</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[120px] text-right">Total</TableHead>
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.map(entry => (
                  <ExpandableEntryRow
                    key={entry.id}
                    entry={entry}
                    totalDebits={getEntryTotal(entry.id)}
                    onPost={id => postMutation.mutate(id)}
                    onVoid={id => voidMutation.mutate(id)}
                    isPosting={postMutation.isPending}
                    isVoiding={voidMutation.isPending}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Journal Entry Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-[95vw] w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <BookOpen className="h-5 w-5" style={{ color: '#791E75' }} />
              New Journal Entry
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Header Fields */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Entry Date */}
              <div>
                <Label className="text-sm font-medium">Entry Date *</Label>
                <Popover open={entryDateOpen} onOpenChange={setEntryDateOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal mt-1',
                        !entryDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {entryDate ? format(entryDate, 'dd/MM/yyyy') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={entryDate}
                      onSelect={d => {
                        setEntryDate(d);
                        setEntryDateOpen(false);
                      }}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Source Type */}
              <div>
                <Label className="text-sm font-medium">Source Type</Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="rent">Rent</SelectItem>
                    <SelectItem value="deposit">Deposit</SelectItem>
                    <SelectItem value="management_fee">Management Fee</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Description */}
              <div className="md:col-span-2">
                <Label className="text-sm font-medium">Description *</Label>
                <Input
                  className="mt-1"
                  placeholder="e.g. Rent received for 123 High Street"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <Textarea
                className="mt-1"
                placeholder="Optional additional notes..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Separator />

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Line Items</h3>
                <Button variant="outline" size="sm" onClick={addLine}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Line
                </Button>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[300px]">Account *</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-[140px] text-right">Debit (\u00A3)</TableHead>
                      <TableHead className="w-[140px] text-right">Credit (\u00A3)</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lines.map((line, index) => (
                      <TableRow key={index}>
                        <TableCell className="py-2">
                          <AccountCombobox
                            accounts={accounts}
                            value={line.account_id}
                            onChange={val => updateLine(index, 'account_id', val)}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-9 text-sm"
                            placeholder="Line description"
                            value={line.description}
                            onChange={e => updateLine(index, 'description', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-9 text-sm text-right font-mono"
                            placeholder="0.00"
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.debit_amount}
                            onChange={e => {
                              updateLine(index, 'debit_amount', e.target.value);
                              if (e.target.value && parseFloat(e.target.value) > 0) {
                                updateLine(index, 'credit_amount', '');
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Input
                            className="h-9 text-sm text-right font-mono"
                            placeholder="0.00"
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.credit_amount}
                            onChange={e => {
                              updateLine(index, 'credit_amount', e.target.value);
                              if (e.target.value && parseFloat(e.target.value) > 0) {
                                updateLine(index, 'debit_amount', '');
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell className="py-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => removeLine(index)}
                            disabled={lines.length <= 2}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals Row */}
              <div className="mt-3 flex justify-end">
                <div className="w-[500px] space-y-2">
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded text-sm">
                    <span className="font-medium">Total Debits</span>
                    <span className="font-mono font-semibold">{formatCurrency(totalDebits)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded text-sm">
                    <span className="font-medium">Total Credits</span>
                    <span className="font-mono font-semibold">{formatCurrency(totalCredits)}</span>
                  </div>
                  <div
                    className={cn(
                      'flex items-center justify-between px-4 py-2 rounded text-sm font-semibold',
                      difference === 0 && totalDebits > 0
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {difference === 0 && totalDebits > 0 ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <AlertTriangle className="h-4 w-4" />
                      )}
                      Difference
                    </span>
                    <span className="font-mono">
                      {difference === 0 && totalDebits > 0
                        ? 'Balanced'
                        : formatCurrency(Math.abs(difference))}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              disabled={createMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit || createMutation.isPending}
              style={{ backgroundColor: '#791E75' }}
              className="text-white hover:opacity-90"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <BookOpen className="h-4 w-4 mr-2" />
                  Create Journal Entry
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
