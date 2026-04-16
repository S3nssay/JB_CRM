import { useQuery } from '@tanstack/react-query';
import { differenceInDays, parseISO, format } from 'date-fns';
import { BarChart3, Home, CheckCircle2, XCircle, TrendingUp, RefreshCw, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VoidProperty {
  address: string;
  landlordName: string;
  vacantSince: string;
}

interface OccupancyStats {
  totalManaged: number;
  occupied: number;
  vacant: number;
  occupancyRate: number;
  voidProperties: VoidProperty[];
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  colour,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  colour: string;
}) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 flex items-start gap-4`}>
      <div className={`p-3 rounded-xl ${colour}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-3xl font-bold text-gray-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Occupancy Ring ───────────────────────────────────────────────────────────

function OccupancyRing({ rate }: { rate: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (rate / 100) * circumference;
  const colour = rate >= 90 ? '#16a34a' : rate >= 70 ? '#d97706' : '#dc2626';

  return (
    <div className="flex flex-col items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Track */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="#f3f4f6"
          strokeWidth="14"
        />
        {/* Progress */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="14"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="70" y="65" textAnchor="middle" fontSize="22" fontWeight="700" fill="#111827">
          {rate.toFixed(1)}%
        </text>
        <text x="70" y="83" textAnchor="middle" fontSize="11" fill="#6b7280">
          Occupancy
        </text>
      </svg>
      <p className="text-xs text-gray-500 mt-1">
        {rate >= 90 ? 'Excellent' : rate >= 70 ? 'Good' : 'Low'} portfolio performance
      </p>
    </div>
  );
}

// ─── Void Properties Table ────────────────────────────────────────────────────

function VoidPropertiesTable({ voids }: { voids: VoidProperty[] }) {
  const sorted = [...voids].sort((a, b) => {
    const daysA = differenceInDays(new Date(), parseISO(a.vacantSince));
    const daysB = differenceInDays(new Date(), parseISO(b.vacantSince));
    return daysB - daysA; // longest first
  });

  if (sorted.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-400" />
        <p className="text-sm font-medium text-green-600">All managed properties are occupied</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50 text-left">
            <th className="px-3 py-2.5 font-medium text-gray-600">Address</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Landlord</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Vacant Since</th>
            <th className="px-3 py-2.5 font-medium text-gray-600">Days Vacant</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {sorted.map((v, i) => {
            const daysVacant = differenceInDays(new Date(), parseISO(v.vacantSince));
            const urgency = daysVacant >= 60 ? 'text-red-600 font-semibold' : daysVacant >= 30 ? 'text-amber-600 font-medium' : 'text-gray-700';
            return (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-3 py-3">
                  <div className="flex items-start gap-2">
                    <MapPin className="h-3.5 w-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                    <span className="font-medium">{v.address}</span>
                  </div>
                </td>
                <td className="px-3 py-3 text-gray-600">{v.landlordName}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1.5 text-gray-600">
                    <Calendar className="h-3.5 w-3.5 text-gray-400" />
                    {(() => {
                      try { return format(parseISO(v.vacantSince), 'dd MMM yyyy'); }
                      catch { return v.vacantSince; }
                    })()}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className={urgency}>
                    {daysVacant} day{daysVacant !== 1 ? 's' : ''}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OccupancyCalculator() {
  const { data, isLoading, isError, refetch, isFetching } = useQuery<OccupancyStats>({
    queryKey: ['occupancy-stats'],
    queryFn: () => apiRequest('GET', '/api/crm/occupancy-stats').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#791E75]/10 rounded-xl">
            <BarChart3 className="h-6 w-6 text-[#791E75]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Occupancy Dashboard</h1>
            <p className="text-sm text-gray-500">Portfolio vacancy and occupancy overview</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="h-6 w-6 animate-spin mr-3" />
          Loading occupancy data...
        </div>
      )}

      {isError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <XCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
          <p className="text-sm text-red-700 font-medium">Failed to load occupancy data</p>
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
            Try Again
          </Button>
        </div>
      )}

      {data && (
        <>
          {/* Stat cards + ring */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-start">
            <div className="lg:col-span-1">
              <StatCard
                label="Total Managed"
                value={data.totalManaged}
                sub="Properties under management"
                icon={Home}
                colour="bg-gray-100 text-gray-700"
              />
            </div>
            <div className="lg:col-span-1">
              <StatCard
                label="Occupied"
                value={data.occupied}
                sub="Active tenancies"
                icon={CheckCircle2}
                colour="bg-green-100 text-green-700"
              />
            </div>
            <div className="lg:col-span-1">
              <StatCard
                label="Vacant"
                value={data.vacant}
                sub="Currently void"
                icon={XCircle}
                colour="bg-red-100 text-red-700"
              />
            </div>
            <div className="lg:col-span-1">
              <StatCard
                label="Occupancy Rate"
                value={`${data.occupancyRate.toFixed(1)}%`}
                sub={data.occupancyRate >= 90 ? 'Excellent' : data.occupancyRate >= 70 ? 'Good' : 'Needs attention'}
                icon={TrendingUp}
                colour="bg-[#791E75]/10 text-[#791E75]"
              />
            </div>
            <div className="lg:col-span-1 flex justify-center bg-white rounded-xl border shadow-sm p-4">
              <OccupancyRing rate={data.occupancyRate} />
            </div>
          </div>

          {/* Progress bar */}
          <div className="bg-white rounded-xl border shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">Portfolio Occupancy</p>
              <p className="text-sm font-semibold text-gray-900">{data.occupied} / {data.totalManaged} properties</p>
            </div>
            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${Math.min(data.occupancyRate, 100)}%`,
                  backgroundColor: data.occupancyRate >= 90 ? '#16a34a' : data.occupancyRate >= 70 ? '#d97706' : '#dc2626',
                }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-gray-400">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Void properties */}
          <div className="bg-white rounded-xl border shadow-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-gray-800">Void Properties</h2>
                <p className="text-xs text-gray-500 mt-0.5">Sorted by days vacant — longest first</p>
              </div>
              {data.voidProperties.length > 0 && (
                <span className="inline-flex items-center gap-1.5 bg-red-50 text-red-700 text-xs font-semibold px-3 py-1 rounded-full border border-red-200">
                  <XCircle className="h-3.5 w-3.5" />
                  {data.voidProperties.length} void{data.voidProperties.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="p-5">
              <VoidPropertiesTable voids={data.voidProperties} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
