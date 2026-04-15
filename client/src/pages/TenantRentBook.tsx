import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter,
} from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Receipt, Loader2, ChevronsUpDown, Check, Download, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

interface Tenant {
  id: number;
  name: string;
}

interface RentBookEntry {
  dueDate: string;
  periodTo: string;
  amountDue: number;
  payment: number;
  paymentDate: string | null;
  arrears: number;
  status: 'paid' | 'partial' | 'overdue' | 'pending';
  paymentMethod: string | null;
}

function statusBadge(status: string) {
  switch (status) {
    case 'paid':
      return <Badge className="bg-green-100 text-green-800 border-0 text-xs">Paid</Badge>;
    case 'partial':
      return <Badge className="bg-amber-100 text-amber-800 border-0 text-xs">Partial</Badge>;
    case 'overdue':
      return <Badge className="bg-red-100 text-red-800 border-0 text-xs">Overdue</Badge>;
    default:
      return <Badge variant="secondary" className="text-xs">Pending</Badge>;
  }
}

export default function TenantRentBook() {
  const { toast } = useToast();
  const [tenantId, setTenantId] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tenantOpen, setTenantOpen] = useState(false);

  const { data: tenants = [] } = useQuery<Tenant[]>({
    queryKey: ['/api/crm/tenants'],
    queryFn: async () => {
      const res = await fetch('/api/crm/tenants', { credentials: 'include' });
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : (data.tenants ?? []);
    },
  });

  const queryParams = new URLSearchParams();
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);

  const { data: rentBook = [], isLoading, isFetching } = useQuery<RentBookEntry[]>({
    queryKey: ['/api/crm/tenant-rent-book', tenantId, from, to],
    queryFn: async () => {
      if (!tenantId) return [];
      const res = await fetch(`/api/crm/tenant-rent-book/${tenantId}?${queryParams}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!tenantId,
  });

  const selectedTenant = tenants.find((t) => String(t.id) === tenantId);

  const totalDue = rentBook.reduce((s, r) => s + (r.amountDue ?? 0), 0);
  const totalPaid = rentBook.reduce((s, r) => s + (r.payment ?? 0), 0);
  const outstanding = totalDue - totalPaid;

  const handleEmailRentBook = () => {
    toast({
      title: 'Email Rent Book',
      description: 'This feature will be available in a future update.',
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Rent Book</h1>
          <p className="text-sm text-gray-500">Line-by-line payment history per tenant</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Tenant selector */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Tenant</Label>
              <Popover open={tenantOpen} onOpenChange={setTenantOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between text-sm font-normal"
                  >
                    {selectedTenant ? selectedTenant.name : 'Select tenant...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <Command>
                    <CommandInput placeholder="Search tenant..." />
                    <CommandList>
                      <CommandEmpty>No tenant found.</CommandEmpty>
                      <CommandGroup>
                        {tenants.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={t.name}
                            onSelect={() => {
                              setTenantId(String(t.id));
                              setTenantOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', tenantId === String(t.id) ? 'opacity-100' : 'opacity-0')} />
                            {t.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rent book table */}
      {tenantId ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Rent Book — {selectedTenant?.name}</span>
              <div className="flex items-center gap-2">
                {(isLoading || isFetching) && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEmailRentBook}>
                  <Mail className="h-3.5 w-3.5" />
                  Email Rent Book
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Export to Excel
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            {rentBook.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">
                No rent book entries found for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50">
                      <TableHead className="text-xs font-semibold text-gray-600">Due Date</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Period To</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Amount Due</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Payment</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Payment Date</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Arrears</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Status</TableHead>
                      <TableHead className="text-xs font-semibold text-gray-600">Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentBook.map((row, i) => (
                      <TableRow key={i} className="hover:bg-gray-50 text-sm">
                        <TableCell>{fmtDate(row.dueDate)}</TableCell>
                        <TableCell>{fmtDate(row.periodTo)}</TableCell>
                        <TableCell>{fmt(row.amountDue ?? 0)}</TableCell>
                        <TableCell className="text-green-700">{fmt(row.payment ?? 0)}</TableCell>
                        <TableCell>{fmtDate(row.paymentDate)}</TableCell>
                        <TableCell className={row.arrears > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                          {fmt(row.arrears ?? 0)}
                        </TableCell>
                        <TableCell>{statusBadge(row.status)}</TableCell>
                        <TableCell className="text-xs text-gray-500">{row.paymentMethod ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow className="bg-gray-50 font-medium">
                      <TableCell colSpan={2}>Totals</TableCell>
                      <TableCell>{fmt(totalDue)}</TableCell>
                      <TableCell className="text-green-700">{fmt(totalPaid)}</TableCell>
                      <TableCell />
                      <TableCell className={outstanding > 0 ? 'text-red-600' : 'text-gray-700'}>
                        {fmt(outstanding)}
                      </TableCell>
                      <TableCell colSpan={2} />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Select a tenant to view their rent book</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
