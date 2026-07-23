import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ShieldAlert, Loader2, RefreshCw, ScanSearch, FileCheck2, ExternalLink, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

const PARTY_TYPES = [
  { key: 'landlord', label: 'Landlords' },
  { key: 'tenant', label: 'Tenants' },
  { key: 'applicant', label: 'Applicants' },
  { key: 'contractor', label: 'Contractors' },
];

const statusBadge = (s: string) => {
  const c: Record<string, string> = {
    match: 'bg-red-100 text-red-800', potential_match: 'bg-amber-100 text-amber-800',
    error: 'bg-gray-200 text-gray-700', clear: 'bg-green-100 text-green-800',
  };
  return <Badge className={`${c[s] ?? 'bg-gray-100 text-gray-800'} border-0 text-xs capitalize`}>{s.replace('_', ' ')}</Badge>;
};

const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

export default function SanctionScreening() {
  const { toast } = useToast();
  const [types, setTypes] = useState<string[]>(['landlord', 'tenant', 'applicant', 'contractor']);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);

  const statusQ = useQuery<any>({
    queryKey: ['/api/crm/sanctions/provider-status'],
    queryFn: async () => {
      const res = await fetch('/api/crm/sanctions/provider-status', { credentials: 'include' });
      if (!res.ok) return {};
      return res.json();
    },
  });

  const runsQ = useQuery<any[]>({
    queryKey: ['/api/crm/sanctions/runs'],
    queryFn: async () => {
      const res = await fetch('/api/crm/sanctions/runs', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const resultsQ = useQuery<any[]>({
    queryKey: ['/api/crm/sanctions/runs', activeRunId, 'results'],
    queryFn: async () => {
      const res = await fetch(`/api/crm/sanctions/runs/${activeRunId}/results`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeRunId,
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('/api/crm/sanctions/refresh', 'POST'),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sanctions/provider-status'] });
      toast({ title: 'Sanctions data refreshed', description: `${r.entryCount?.toLocaleString?.() ?? r.entryCount} entries loaded` });
    },
    onError: (e: any) => toast({ title: 'Refresh failed', description: e.message, variant: 'destructive' }),
  });

  const provider = statusQ.data?.providerConfigured ? 'provider' : 'csv';
  const screenMutation = useMutation({
    mutationFn: () => apiRequest('/api/crm/sanctions/screen', 'POST', { provider, partyTypes: types, autoGenerateProof: true }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/crm/sanctions/runs'] });
      setActiveRunId(r.runId);
      toast({ title: 'Screening complete', description: `${r.totalChecked} checked · ${r.matches} matches · ${r.potential} potential` });
    },
    onError: (e: any) => toast({ title: 'Screening failed', description: e.message, variant: 'destructive' }),
  });

  const toggleType = (k: string) => setTypes((t) => t.includes(k) ? t.filter((x) => x !== k) : [...t, k]);
  const st = statusQ.data ?? {};
  const runs = runsQ.data ?? [];
  const results = resultsQ.data ?? [];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center gap-3">
        <ShieldAlert className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">AML Sanction Screening</h1>
          <p className="text-sm text-gray-500">Automated sanctions checks for landlords, tenants, applicants & contractors</p>
        </div>
      </div>

      {/* Data source + controls */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-gray-800">Screening data source</p>
                {st.providerConfigured ? (
                  <p className="text-xs text-gray-500 mt-0.5">Live provider API configured{st.provider ? ` (${st.provider})` : ''} — real-time checks.</p>
                ) : st.activeList ? (
                  <p className="text-xs text-gray-500 mt-0.5">Automated list: <b>{st.activeList.name}</b> — {st.activeList.entryCount?.toLocaleString?.()} entries, updated {fmtDate(st.activeList.importedAt)}.</p>
                ) : (
                  <p className="text-xs text-amber-600 mt-0.5">No sanctions data loaded yet — click "Refresh sanctions data".</p>
                )}
                <p className="text-[11px] text-gray-400 mt-0.5 break-all">Feed: {st.feedUrl}</p>
              </div>
              <Button variant="outline" className="gap-1.5" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
                {refreshMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh sanctions data
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-gray-800 mb-2">Run screening</p>
              <div className="flex flex-wrap items-center gap-4">
                {PARTY_TYPES.map((p) => (
                  <label key={p.key} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={types.includes(p.key)} onCheckedChange={() => toggleType(p.key)} /> {p.label}
                  </label>
                ))}
                <Button className="gap-1.5 bg-[#791E75] hover:bg-[#5f1759] ml-auto" onClick={() => screenMutation.mutate()} disabled={screenMutation.isPending || types.length === 0}>
                  {screenMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />} Screen selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm font-semibold text-gray-800 mb-2">Recent runs</p>
            {runsQ.isLoading ? <Loader2 className="h-5 w-5 animate-spin text-[#791E75]" /> : runs.length === 0 ? (
              <p className="text-sm text-gray-400">No screening runs yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {runs.map((r) => (
                  <button key={r.id} onClick={() => setActiveRunId(r.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm transition ${activeRunId === r.id ? 'bg-[#791E75] text-white' : 'hover:bg-gray-100'}`}>
                    <div className="flex items-center justify-between">
                      <span>{fmtDate(r.runAt)}</span>
                      {r.totalMatches > 0 ? <Badge className="bg-red-500 text-white border-0 text-[10px]">{r.totalMatches} match</Badge>
                        : r.totalPotential > 0 ? <Badge className="bg-amber-500 text-white border-0 text-[10px]">{r.totalPotential} review</Badge>
                        : <CheckCircle2 className={`h-4 w-4 ${activeRunId === r.id ? 'text-white' : 'text-green-500'}`} />}
                    </div>
                    <div className={`text-xs ${activeRunId === r.id ? 'text-white/70' : 'text-gray-400'}`}>{r.totalChecked} checked · {r.provider}</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Results */}
      {activeRunId && (
        <Card>
          <CardContent className="p-0">
            <div className="px-5 py-3 border-b flex items-center justify-between">
              <p className="text-sm font-semibold text-gray-800">Run #{activeRunId} — flagged results</p>
              <span className="text-xs text-gray-400">Only matches / potential matches shown</span>
            </div>
            {resultsQ.isLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-[#791E75]" /></div>
            ) : results.length === 0 ? (
              <div className="text-center py-12 text-green-700 flex flex-col items-center gap-2"><CheckCircle2 className="h-8 w-8" /> No sanctions matches — all parties clear.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Party</TableHead><TableHead>Type</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Score</TableHead>
                    <TableHead>Matched list entry</TableHead><TableHead>Proof</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.partyName}</TableCell>
                      <TableCell className="capitalize">{r.partyType}</TableCell>
                      <TableCell>{statusBadge(r.matchStatus)}</TableCell>
                      <TableCell className="text-right">{r.matchScore ?? '-'}</TableCell>
                      <TableCell className="text-sm text-gray-600">{r.matchedName || '-'}</TableCell>
                      <TableCell>
                        {r.proofDocumentUrl ? (
                          <a href={r.proofDocumentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#791E75] text-sm hover:underline">
                            <FileCheck2 className="h-3.5 w-3.5" /> Proof <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : <span className="text-gray-300">-</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
