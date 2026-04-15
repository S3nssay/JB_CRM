import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { BookOpen, Loader2, ChevronsUpDown, Check, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

const fmt = (p: number) => `£${(p / 100).toFixed(2)}`;
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

interface Landlord {
  id: number;
  name: string;
}

interface Property {
  id: number;
  address: string;
}

const TABS = [
  { value: 'payment', label: 'Payment' },
  { value: 'charges', label: 'Charges & Credits' },
  { value: 'collections', label: 'Collections' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'reserve', label: 'Reserve' },
  { value: 'audit', label: 'Audit' },
  { value: 'commission', label: 'Commission' },
] as const;

export default function LandlordLedger() {
  const [landlordId, setLandlordId] = useState<string>('');
  const [propertyId, setPropertyId] = useState<string>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activeTab, setActiveTab] = useState<string>('payment');
  const [landlordOpen, setLandlordOpen] = useState(false);

  const { data: landlords = [] } = useQuery<Landlord[]>({
    queryKey: ['/api/crm/landlords'],
    queryFn: async () => {
      const res = await fetch('/api/crm/landlords', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ['/api/crm/landlords', landlordId, 'properties'],
    queryFn: async () => {
      if (!landlordId) return [];
      const res = await fetch(`/api/crm/landlords/${landlordId}/properties`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!landlordId,
  });

  const queryParams = new URLSearchParams({ view: activeTab });
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);
  if (propertyId) queryParams.set('propertyId', propertyId);

  const { data: ledger = [], isLoading, isFetching } = useQuery<any[]>({
    queryKey: ['/api/crm/landlord-ledger', landlordId, activeTab, from, to, propertyId],
    queryFn: async () => {
      if (!landlordId) return [];
      const res = await fetch(`/api/crm/landlord-ledger/${landlordId}?${queryParams}`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!landlordId,
  });

  const selectedLandlord = landlords.find((l) => String(l.id) === landlordId);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <BookOpen className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Landlord Ledger</h1>
          <p className="text-sm text-gray-500">Detailed financial activity per landlord</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Landlord selector */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Landlord</Label>
              <Popover open={landlordOpen} onOpenChange={setLandlordOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between text-sm font-normal"
                  >
                    {selectedLandlord ? selectedLandlord.name : 'Select landlord...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0">
                  <Command>
                    <CommandInput placeholder="Search landlord..." />
                    <CommandList>
                      <CommandEmpty>No landlord found.</CommandEmpty>
                      <CommandGroup>
                        {landlords.map((l) => (
                          <CommandItem
                            key={l.id}
                            value={l.name}
                            onSelect={() => {
                              setLandlordId(String(l.id));
                              setPropertyId('');
                              setLandlordOpen(false);
                            }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', landlordId === String(l.id) ? 'opacity-100' : 'opacity-0')} />
                            {l.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Property filter */}
            <div className="space-y-1">
              <Label className="text-xs font-medium text-gray-600">Property (optional)</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="All properties" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All properties</SelectItem>
                  {properties.map((p: Property) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.address}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date range */}
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

      {/* Ledger tabs */}
      {landlordId ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Ledger for {selectedLandlord?.name}</span>
              {(isLoading || isFetching) && <Loader2 className="h-4 w-4 animate-spin text-gray-400" />}
              <Button variant="outline" size="sm" className="ml-auto gap-1.5">
                <Download className="h-3.5 w-3.5" />
                Export
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-4 flex-wrap h-auto gap-1">
                {TABS.map((t) => (
                  <TabsTrigger key={t.value} value={t.value} className="text-xs">
                    {t.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Payment tab */}
              <TabsContent value="payment">
                <LedgerTable
                  data={ledger}
                  columns={['Date', 'Description', 'Amount', 'Reference', 'Property', 'Balance']}
                  renderRow={(row: any) => (
                    <>
                      <TableCell>{fmtDate(row.date)}</TableCell>
                      <TableCell>{row.description ?? '-'}</TableCell>
                      <TableCell className={row.amount < 0 ? 'text-red-600' : 'text-green-700'}>{fmt(row.amount ?? 0)}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{row.reference ?? '-'}</TableCell>
                      <TableCell className="text-xs">{row.property ?? '-'}</TableCell>
                      <TableCell className="font-medium">{fmt(row.balance ?? 0)}</TableCell>
                    </>
                  )}
                />
              </TabsContent>

              {/* Charges & Credits tab */}
              <TabsContent value="charges">
                <LedgerTable
                  data={ledger}
                  columns={['Date', 'Description', 'Net', 'VAT', 'Gross', 'Reference', 'Property']}
                  renderRow={(row: any) => (
                    <>
                      <TableCell>{fmtDate(row.date)}</TableCell>
                      <TableCell>{row.description ?? '-'}</TableCell>
                      <TableCell>{fmt(row.net ?? 0)}</TableCell>
                      <TableCell>{fmt(row.vat ?? 0)}</TableCell>
                      <TableCell className="font-medium">{fmt(row.gross ?? 0)}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{row.reference ?? '-'}</TableCell>
                      <TableCell className="text-xs">{row.property ?? '-'}</TableCell>
                    </>
                  )}
                />
              </TabsContent>

              {/* Collections tab */}
              <TabsContent value="collections">
                <LedgerTable
                  data={ledger}
                  columns={['Date', 'Property', 'Tenant', 'Rent Due', 'Rent Paid', 'Method']}
                  renderRow={(row: any) => (
                    <>
                      <TableCell>{fmtDate(row.date)}</TableCell>
                      <TableCell className="text-xs">{row.property ?? '-'}</TableCell>
                      <TableCell>{row.tenant ?? '-'}</TableCell>
                      <TableCell>{fmt(row.rentDue ?? 0)}</TableCell>
                      <TableCell className="text-green-700">{fmt(row.rentPaid ?? 0)}</TableCell>
                      <TableCell>
                        {row.method ? (
                          <Badge variant="outline" className="text-xs">{row.method}</Badge>
                        ) : '-'}
                      </TableCell>
                    </>
                  )}
                />
              </TabsContent>

              {/* Repairs tab */}
              <TabsContent value="repairs">
                <LedgerTable
                  data={ledger}
                  columns={['Date', 'Description', 'Amount', 'Property', 'Contractor']}
                  renderRow={(row: any) => (
                    <>
                      <TableCell>{fmtDate(row.date)}</TableCell>
                      <TableCell>{row.description ?? '-'}</TableCell>
                      <TableCell className="text-red-600">{fmt(row.amount ?? 0)}</TableCell>
                      <TableCell className="text-xs">{row.property ?? '-'}</TableCell>
                      <TableCell>{row.contractor ?? '-'}</TableCell>
                    </>
                  )}
                />
              </TabsContent>

              {/* Reserve tab */}
              <TabsContent value="reserve">
                <LedgerTable
                  data={ledger}
                  columns={['Date', 'Type', 'Amount', 'Balance', 'Description']}
                  renderRow={(row: any) => (
                    <>
                      <TableCell>{fmtDate(row.date)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">{row.type ?? '-'}</Badge>
                      </TableCell>
                      <TableCell className={row.amount < 0 ? 'text-red-600' : 'text-green-700'}>{fmt(row.amount ?? 0)}</TableCell>
                      <TableCell className="font-medium">{fmt(row.balance ?? 0)}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{row.description ?? '-'}</TableCell>
                    </>
                  )}
                />
              </TabsContent>

              {/* Audit tab */}
              <TabsContent value="audit">
                <LedgerTable
                  data={ledger}
                  columns={['Date', 'Type', 'Description', 'Amount', 'Reference', 'Reconciled']}
                  renderRow={(row: any) => (
                    <>
                      <TableCell>{fmtDate(row.date)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{row.type ?? '-'}</Badge>
                      </TableCell>
                      <TableCell>{row.description ?? '-'}</TableCell>
                      <TableCell>{fmt(row.amount ?? 0)}</TableCell>
                      <TableCell className="text-gray-500 text-xs">{row.reference ?? '-'}</TableCell>
                      <TableCell>
                        {row.reconciled ? (
                          <Badge className="bg-green-100 text-green-800 text-xs border-0">Reconciled</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">Pending</Badge>
                        )}
                      </TableCell>
                    </>
                  )}
                />
              </TabsContent>

              {/* Commission tab */}
              <TabsContent value="commission">
                <LedgerTable
                  data={ledger}
                  columns={['Property', 'Rent Collected', 'Commission %', 'Fee Amount', 'VAT', 'Gross']}
                  renderRow={(row: any) => (
                    <>
                      <TableCell className="text-xs">{row.property ?? '-'}</TableCell>
                      <TableCell>{fmt(row.rentCollected ?? 0)}</TableCell>
                      <TableCell>{row.commissionRate != null ? `${row.commissionRate}%` : '-'}</TableCell>
                      <TableCell>{fmt(row.feeAmount ?? 0)}</TableCell>
                      <TableCell>{fmt(row.vat ?? 0)}</TableCell>
                      <TableCell className="font-medium">{fmt(row.gross ?? 0)}</TableCell>
                    </>
                  )}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-gray-400">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>Select a landlord to view their ledger</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LedgerTable({
  data,
  columns,
  renderRow,
}: {
  data: any[];
  columns: string[];
  renderRow: (row: any) => React.ReactNode;
}) {
  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-gray-400 text-sm">
        No records found for the selected filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50">
            {columns.map((c) => (
              <TableHead key={c} className="text-xs font-semibold text-gray-600 whitespace-nowrap">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, i) => (
            <TableRow key={i} className="hover:bg-gray-50 text-sm">
              {renderRow(row)}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
