import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportFilters, FilterDef } from '@/components/ReportFilters';
import { ReportTable } from '@/components/ReportTable';
import { FileSpreadsheet, ChevronRight, BarChart3 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface ReportMeta {
  id: string;
  name: string;
  endpoint: string;
  filters: FilterDef[];
}

interface TabMeta {
  id: string;
  label: string;
  reports: ReportMeta[];
}

interface ReportIndexResponse {
  tabs: TabMeta[];
}

function buildQueryString(filterValues: Record<string, string>): string {
  const params = new URLSearchParams();
  Object.entries(filterValues).forEach(([k, v]) => {
    if (v) params.set(k, v);
  });
  return params.toString() ? '?' + params.toString() : '';
}

function ReportPane({ report }: { report: ReportMeta }) {
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [runKey, setRunKey] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = buildQueryString(filterValues);
      const res = await apiRequest('GET', `${report.endpoint}${qs}`);
      const json = await res.json();
      setReportData(json.data || []);
      setRunKey(Date.now().toString());
    } catch (err: any) {
      setError(err.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const exportReport = async () => {
    try {
      const qs = buildQueryString({ ...filterValues, format: 'xlsx' });
      const res = await fetch(`${report.endpoint}${qs ? qs + '&format=xlsx' : '?format=xlsx'}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\s+/g, '_')}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.message || 'Export failed');
    }
  };

  return (
    <div>
      <ReportFilters
        filters={report.filters}
        values={filterValues}
        onChange={setFilterValues}
        onRun={runReport}
        onExport={exportReport}
        loading={loading}
      />
      {error && (
        <div className="text-red-600 text-sm mb-3 p-2 bg-red-50 rounded border border-red-200">
          {error}
        </div>
      )}
      {runKey ? (
        <ReportTable data={reportData} reportName={report.name} />
      ) : (
        <div className="text-center py-16 text-gray-300 border border-dashed border-gray-200 rounded-lg">
          <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm text-gray-400">Click "Run Report" to load data</p>
        </div>
      )}
    </div>
  );
}

function TabPane({ tab }: { tab: TabMeta }) {
  const [selectedReport, setSelectedReport] = useState<ReportMeta | null>(null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Report list */}
      <div className="lg:col-span-1">
        <div className="space-y-1">
          {tab.reports.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm text-left transition-all ${
                selectedReport?.id === report.id
                  ? 'bg-[#791E75] text-white shadow-sm'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                <span>{report.name}</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {/* Report content */}
      <div className="lg:col-span-3">
        {selectedReport ? (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">{selectedReport.name}</CardTitle>
                  {selectedReport.filters.length > 0 && (
                    <CardDescription className="text-xs mt-0.5">
                      Set your filters then click Run Report
                    </CardDescription>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {tab.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ReportPane report={selectedReport} />
            </CardContent>
          </Card>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-300 border border-dashed border-gray-200 rounded-lg min-h-[300px]">
            <div className="text-center">
              <FileSpreadsheet className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm text-gray-400">Select a report from the list</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReportCenter() {
  const { data: index, isLoading } = useQuery<ReportIndexResponse>({
    queryKey: ['/api/crm/reports/index'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/crm/reports/index');
      return res.json();
    },
  });

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-8 w-8 rounded-lg bg-[#791E75] flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Report Center</h1>
        </div>
        <p className="text-gray-500 text-sm ml-11">
          Pre-built reports across property, landlords, tenants, applicants, general, and accounting — with Excel export.
        </p>
      </div>

      {isLoading ? (
        <div className="text-center py-20 text-gray-400 text-sm">Loading reports...</div>
      ) : index?.tabs ? (
        <Tabs defaultValue={index.tabs[0]?.id}>
          <TabsList className="mb-6 bg-gray-100 p-1">
            {index.tabs.map((tab) => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                className="data-[state=active]:bg-[#791E75] data-[state=active]:text-white text-sm px-4"
              >
                {tab.label}
                <Badge variant="secondary" className="ml-1.5 text-[10px] h-4 px-1.5 bg-white/20 text-inherit">
                  {tab.reports.length}
                </Badge>
              </TabsTrigger>
            ))}
          </TabsList>

          {index.tabs.map((tab) => (
            <TabsContent key={tab.id} value={tab.id}>
              <TabPane tab={tab} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="text-center py-20 text-gray-400 text-sm">Failed to load report index.</div>
      )}
    </div>
  );
}
