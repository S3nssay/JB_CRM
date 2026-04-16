interface ReportTableProps {
  data: Record<string, any>[];
  reportName?: string;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatHeader(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ReportTable({ data, reportName }: ReportTableProps) {
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p className="text-sm">No records found. Adjust your filters and run the report.</p>
      </div>
    );
  }

  const columns = Object.keys(data[0]);

  return (
    <div>
      <div className="overflow-auto rounded-lg border border-gray-200 max-h-[60vh]">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#791E75] text-white">
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-2 text-left font-medium text-xs whitespace-nowrap"
                >
                  {formatHeader(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
              >
                {columns.map((col) => (
                  <td
                    key={col}
                    className="px-3 py-1.5 text-gray-700 whitespace-nowrap border-b border-gray-100 text-xs"
                  >
                    {formatValue(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-xs text-gray-400 text-right">
        {data.length} record{data.length !== 1 ? 's' : ''}{reportName ? ` — ${reportName}` : ''}
      </div>
    </div>
  );
}
