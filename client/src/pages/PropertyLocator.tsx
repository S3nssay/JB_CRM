import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Search, MapPin, User, Users, Key, PoundSterling, Home, Loader2, ExternalLink,
  Pencil, ShieldCheck, CalendarClock, Building2,
} from 'lucide-react';

// KeyData-familiar property locator: search + status filters on the left, a live
// preview panel on the right (rent, service type, landlord, tenant, key code) — so
// staff can find and eyeball a property without navigating away on every click.

interface ManagedProperty {
  id: number; propertyAddress: string; postcode: string; propertyType: string;
  bedrooms: number; bathrooms: number; managementStatus: string; isListed: boolean;
  status: string; landlordId: number | null; landlordName: string; landlordEmail: string | null;
  landlordMobile: string | null; managementFeePercent: string | null; managementPeriod: string | null;
  serviceType: string; keyCode: string | null; propCode: string | null; imageUrl: string | null;
  tenancyId: number | null; tenantId: number | null; tenantName: string | null;
  rentAmount: number | null; rentFrequency: string; depositAmount: number | null;
  depositHeldBy: string | null; tenancyStart: string | null; tenancyEnd: string | null;
  checklistComplete: number; checklistTotal: number;
}

const money = (pence: number | null | undefined) =>
  pence != null ? `£${(pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—';
const freqLabel = (f: string) => (f === 'weekly' ? 'Weekly' : f === 'quarterly' ? 'Quarterly' : f === 'annually' ? 'Annually' : 'Calendar Monthly');
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

type PropStatus = 'let' | 'vacant' | 'dormant' | 'marketed';
type StatusFilter = 'all' | PropStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'let', label: 'Let' },
  { key: 'vacant', label: 'Vacant' },
  { key: 'marketed', label: 'Marketed' },
  { key: 'dormant', label: 'Dormant' },
];

function statusOf(p: ManagedProperty): PropStatus {
  if (p.managementStatus === 'dormant') return 'dormant';
  if (p.tenantId) return 'let';
  if (p.isListed) return 'marketed';
  return 'vacant';
}

const statusBadge = (s: StatusFilter) => {
  const map: Record<string, string> = {
    let: 'bg-green-100 text-green-800', vacant: 'bg-amber-100 text-amber-800',
    marketed: 'bg-blue-100 text-blue-800', dormant: 'bg-gray-200 text-gray-700',
  };
  const label: Record<string, string> = { let: 'Let', vacant: 'Vacant', marketed: 'Marketed', dormant: 'Dormant' };
  return <Badge className={`${map[s] ?? 'bg-gray-100 text-gray-800'} border-0 text-[10px]`}>{label[s] ?? s}</Badge>;
};

export default function PropertyLocator() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [serviceType, setServiceType] = useState('all');
  const [landlord, setLandlord] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: properties = [], isLoading } = useQuery<ManagedProperty[]>({
    queryKey: ['/api/crm/managed-properties'],
    queryFn: async () => {
      const res = await fetch('/api/crm/managed-properties', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const landlordOptions = useMemo(() => {
    const seen = new Map<number, string>();
    properties.forEach((p) => { if (p.landlordId) seen.set(p.landlordId, p.landlordName); });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [properties]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return properties.filter((p) => {
      if (status !== 'all' && statusOf(p) !== status) return false;
      if (serviceType !== 'all' && p.serviceType !== serviceType) return false;
      if (landlord !== 'all' && String(p.landlordId) !== landlord) return false;
      if (q) {
        const hay = [p.propertyAddress, p.postcode, p.keyCode, p.propCode, p.landlordName, p.tenantName]
          .filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [properties, search, status, serviceType, landlord]);

  const counts = useMemo(() => {
    const c: Record<PropStatus, number> = { let: 0, vacant: 0, dormant: 0, marketed: 0 };
    properties.forEach((p) => { c[statusOf(p)]++; });
    return c;
  }, [properties]);

  const selected = filtered.find((p) => p.id === selectedId) || (filtered.length ? filtered[0] : null);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <MapPin className="h-6 w-6 text-[#791E75]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Property Locator</h1>
            <p className="text-sm text-gray-500">
              {properties.length} properties · {counts.let} let · {counts.vacant} vacant{counts.dormant ? ` · ${counts.dormant} dormant` : ''}
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <Input className="pl-9" placeholder="Locate by address, postcode, key-code, landlord or tenant…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button key={f.key} onClick={() => setStatus(f.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${status === f.key ? 'bg-[#791E75] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label}{f.key !== 'all' && counts[f.key as keyof typeof counts] != null ? ` (${counts[f.key as keyof typeof counts]})` : ''}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <Select value={serviceType} onValueChange={setServiceType}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Service type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All service types</SelectItem>
              <SelectItem value="Managed">Managed</SelectItem>
              <SelectItem value="Let Only">Let Only</SelectItem>
              <SelectItem value="Tenant Find">Tenant Find</SelectItem>
            </SelectContent>
          </Select>
          <Select value={landlord} onValueChange={setLandlord}>
            <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Landlord" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All landlords</SelectItem>
              {landlordOptions.map((l) => <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Master-detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* List */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#791E75]" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500 text-sm">No properties match.</div>
            ) : (
              <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
                <div className="divide-y">
                  {filtered.map((p) => {
                    const s = statusOf(p);
                    const active = selected?.id === p.id;
                    return (
                      <button key={p.id} onClick={() => setSelectedId(p.id)}
                        className={`w-full text-left px-3 py-2.5 transition ${active ? 'bg-[#791E75]/8 border-l-2 border-[#791E75]' : 'hover:bg-gray-50 border-l-2 border-transparent'}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${active ? 'text-[#791E75]' : 'text-gray-900'}`}>{p.propertyAddress}</p>
                            <p className="text-xs text-gray-500 truncate">{p.postcode}{p.tenantName ? ` · ${p.tenantName}` : ''}</p>
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            {statusBadge(s)}
                            {p.keyCode && <span className="text-[10px] font-mono text-gray-400">Key {p.keyCode}</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Preview panel */}
        <Card className="lg:col-span-3">
          <CardContent className="p-0">
            {!selected ? (
              <div className="text-center py-24 text-gray-400"><Home className="h-10 w-10 mx-auto mb-2 opacity-30" />Select a property to preview</div>
            ) : (
              <div>
                {/* Header with photo */}
                <div className="flex gap-4 p-4 border-b">
                  <div className="h-24 w-32 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden flex items-center justify-center">
                    {selected.imageUrl ? <img src={selected.imageUrl} alt="" className="h-full w-full object-cover" /> : <Home className="h-8 w-8 text-gray-300" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900 truncate">{selected.propertyAddress}</h2>
                      {statusBadge(statusOf(selected))}
                    </div>
                    <p className="text-sm text-gray-500">{selected.postcode}</p>
                    <p className="text-sm text-gray-700 mt-1">
                      {selected.bedrooms ? `${selected.bedrooms} bed ` : ''}{selected.propertyType}
                      {selected.rentAmount ? <span className="font-semibold"> · {money(selected.rentAmount)} {freqLabel(selected.rentFrequency)}</span> : ''}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1.5 text-xs text-gray-500">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {selected.serviceType}</span>
                      {selected.keyCode && <span className="flex items-center gap-1"><Key className="h-3 w-3" /> Key {selected.keyCode}</span>}
                      {selected.propCode && <span>Ref {selected.propCode}</span>}
                    </div>
                  </div>
                </div>

                {/* Key facts grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 border-b">
                  <Fact icon={<PoundSterling className="h-3.5 w-3.5" />} label="Rent" value={selected.rentAmount ? `${money(selected.rentAmount)} ${freqLabel(selected.rentFrequency)}` : '—'} />
                  <Fact icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Deposit" value={selected.depositAmount ? `${money(selected.depositAmount)}` : '—'} sub={selected.depositHeldBy || undefined} />
                  <Fact icon={<Building2 className="h-3.5 w-3.5" />} label="Service" value={selected.serviceType} sub={selected.managementFeePercent ? `Fee ${selected.managementFeePercent}%` : undefined} />
                  <Fact icon={<CalendarClock className="h-3.5 w-3.5" />} label="Tenancy" value={selected.tenancyStart ? `${fmtDate(selected.tenancyStart)}` : '—'} sub={selected.tenancyEnd ? `to ${fmtDate(selected.tenancyEnd)}` : undefined} />
                  <Fact icon={<Key className="h-3.5 w-3.5" />} label="Key code" value={selected.keyCode || '—'} />
                  <Fact icon={<Home className="h-3.5 w-3.5" />} label="Checklist" value={`${selected.checklistComplete}/${selected.checklistTotal}`} />
                </div>

                {/* Landlord + Tenant */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 border-b">
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1 flex items-center gap-1"><User className="h-3 w-3" /> Landlord</p>
                    {selected.landlordId ? (
                      <>
                        <Link href={`/crm/landlords/${selected.landlordId}`} className="text-sm font-medium text-[#791E75] hover:underline">{selected.landlordName}</Link>
                        <p className="text-xs text-gray-500">{selected.landlordMobile || selected.landlordEmail || ''}</p>
                      </>
                    ) : <p className="text-sm text-gray-400">Not assigned</p>}
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[11px] font-semibold text-gray-400 uppercase mb-1 flex items-center gap-1"><Users className="h-3 w-3" /> Tenant</p>
                    {selected.tenantId ? (
                      <Link href={`/crm/tenant/${selected.tenantId}`} className="text-sm font-medium text-green-700 hover:underline">{selected.tenantName || 'Active tenant'}</Link>
                    ) : <p className="text-sm text-gray-400">Vacant</p>}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 p-4">
                  <Link href={`/crm/managed-property/${selected.id}`}>
                    <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759]"><ExternalLink className="h-4 w-4" /> Open full record</Button>
                  </Link>
                  <Link href={`/crm/properties/${selected.id}/edit`}>
                    <Button variant="outline" className="gap-1.5"><Pencil className="h-4 w-4" /> Edit property</Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase flex items-center gap-1">{icon}{label}</p>
      <p className="text-sm font-semibold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}
