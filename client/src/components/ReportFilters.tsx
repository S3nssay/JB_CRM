import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search } from 'lucide-react';

export interface FilterDef {
  name: string;
  type: 'date' | 'select' | 'text';
  label: string;
  options?: string[];
}

interface ReportFiltersProps {
  filters: FilterDef[];
  values: Record<string, string>;
  onChange: (values: Record<string, string>) => void;
  onRun: () => void;
  onExport: () => void;
  loading?: boolean;
}

export function ReportFilters({
  filters,
  values,
  onChange,
  onRun,
  onExport,
  loading = false,
}: ReportFiltersProps) {
  const handleChange = (name: string, value: string) => {
    onChange({ ...values, [name]: value });
  };

  if (filters.length === 0) {
    return (
      <div className="flex items-center gap-2 mb-4">
        <Button onClick={onRun} disabled={loading} size="sm" className="bg-[#791E75] hover:bg-[#5d1659] text-white">
          <Search className="h-3.5 w-3.5 mr-1.5" />
          {loading ? 'Loading...' : 'Run Report'}
        </Button>
        <Button onClick={onExport} disabled={loading} variant="outline" size="sm">
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export Excel
        </Button>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
      <div className="flex flex-wrap gap-4 items-end">
        {filters.map((filter) => (
          <div key={filter.name} className="flex flex-col gap-1 min-w-[140px]">
            <Label className="text-xs text-gray-500">{filter.label}</Label>
            {filter.type === 'date' && (
              <Input
                type="date"
                value={values[filter.name] || ''}
                onChange={(e) => handleChange(filter.name, e.target.value)}
                className="h-8 text-sm"
              />
            )}
            {filter.type === 'select' && filter.options && (
              <Select
                value={values[filter.name] || filter.options[0]}
                onValueChange={(v) => handleChange(filter.name, v)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filter.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt.replace(/_/g, ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {filter.type === 'text' && (
              <Input
                type="text"
                value={values[filter.name] || ''}
                onChange={(e) => handleChange(filter.name, e.target.value)}
                className="h-8 text-sm"
              />
            )}
          </div>
        ))}
        <div className="flex gap-2 items-end">
          <Button
            onClick={onRun}
            disabled={loading}
            size="sm"
            className="bg-[#791E75] hover:bg-[#5d1659] text-white h-8"
          >
            <Search className="h-3.5 w-3.5 mr-1.5" />
            {loading ? 'Loading...' : 'Run Report'}
          </Button>
          <Button onClick={onExport} disabled={loading} variant="outline" size="sm" className="h-8">
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Export Excel
          </Button>
        </div>
      </div>
    </div>
  );
}
