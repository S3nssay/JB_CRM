import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ClipboardList, Plus, Trash2, Loader2, CheckCircle } from 'lucide-react';

interface Landlord {
  id: number;
  name: string;
}

interface ReceiptRow {
  id: string;
  landlordId: string;
  amount: string;
  reference: string;
  date: string;
}

function newRow(): ReceiptRow {
  return {
    id: Math.random().toString(36).slice(2),
    landlordId: '',
    amount: '',
    reference: '',
    date: new Date().toISOString().slice(0, 10),
  };
}

function formatGBP(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return '£0.00';
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(n);
}

export default function BatchReceiptRecording() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ReceiptRow[]>([newRow()]);
  const [successCount, setSuccessCount] = useState<number | null>(null);

  const { data: landlords = [] } = useQuery<Landlord[]>({
    queryKey: ['/api/crm/landlords'],
    queryFn: () => apiRequest('GET', '/api/crm/landlords').then(r => r.json()),
  });

  const totalAmount = rows.reduce((sum, row) => {
    const n = parseFloat(row.amount);
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  function updateRow(id: string, field: keyof ReceiptRow, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setSuccessCount(null);
  }

  function addRow() {
    setRows(prev => [...prev, newRow()]);
  }

  function removeRow(id: string) {
    if (rows.length === 1) return;
    setRows(prev => prev.filter(r => r.id !== id));
  }

  const recordMutation = useMutation({
    mutationFn: () => {
      const receipts = rows
        .filter(r => r.landlordId && r.amount && parseFloat(r.amount) > 0)
        .map(r => ({
          landlordId: parseInt(r.landlordId),
          amount: Math.round(parseFloat(r.amount) * 100), // convert to pence
          reference: r.reference,
          date: r.date,
        }));

      if (receipts.length === 0) throw new Error('No valid receipts to record');

      return apiRequest('POST', '/api/crm/batch/landlord-receipts', { receipts }).then(r => r.json());
    },
    onSuccess: (data) => {
      setSuccessCount(data.processed);
      toast({ title: `${data.processed} receipt(s) recorded successfully` });
      setRows([newRow()]);
    },
    onError: (err: any) => {
      toast({ title: 'Failed to record receipts', description: err.message, variant: 'destructive' });
    },
  });

  const validRows = rows.filter(r => r.landlordId && r.amount && parseFloat(r.amount) > 0).length;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <ClipboardList className="h-6 w-6 text-[#791E75]" />
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Batch Receipt Recording</h1>
          <p className="text-sm text-gray-500">Record multiple landlord receipts in one operation</p>
        </div>
      </div>

      {successCount !== null && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{successCount} receipt(s) recorded successfully.</span>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden mb-4">
        {/* Header */}
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 bg-gray-50 border-b text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span>Landlord</span>
          <span>Amount (£)</span>
          <span>Reference</span>
          <span>Date</span>
          <span className="w-8" />
        </div>

        {/* Rows */}
        <div className="divide-y">
          {rows.map((row, idx) => (
            <div key={row.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center">
              {/* Landlord selector */}
              <Select value={row.landlordId} onValueChange={val => updateRow(row.id, 'landlordId', val)}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="Select landlord..." />
                </SelectTrigger>
                <SelectContent>
                  {landlords.map(l => (
                    <SelectItem key={l.id} value={String(l.id)}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Amount */}
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={row.amount}
                onChange={e => updateRow(row.id, 'amount', e.target.value)}
                className="h-8 text-sm"
              />

              {/* Reference */}
              <Input
                type="text"
                placeholder="Reference"
                value={row.reference}
                onChange={e => updateRow(row.id, 'reference', e.target.value)}
                className="h-8 text-sm"
              />

              {/* Date */}
              <Input
                type="date"
                value={row.date}
                onChange={e => updateRow(row.id, 'date', e.target.value)}
                className="h-8 text-sm"
              />

              {/* Remove */}
              <button
                onClick={() => removeRow(row.id)}
                disabled={rows.length === 1}
                className="text-gray-300 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-30 transition-colors p-1"
                aria-label="Remove row"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>

        {/* Add row */}
        <div className="px-4 py-2 border-t bg-gray-50">
          <Button variant="ghost" size="sm" onClick={addRow} className="text-[#791E75] hover:text-[#5a1557] hover:bg-purple-50">
            <Plus className="h-4 w-4 mr-1" />
            Add Row
          </Button>
        </div>
      </div>

      {/* Footer: total + submit */}
      <div className="flex items-center justify-between bg-white border rounded-lg p-4">
        <div>
          <p className="text-sm text-gray-500">{validRows} of {rows.length} rows valid</p>
          <p className="text-lg font-bold text-gray-900">
            Total: {new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(totalAmount)}
          </p>
        </div>
        <Button
          onClick={() => recordMutation.mutate()}
          disabled={validRows === 0 || recordMutation.isPending}
          className="bg-[#791E75] hover:bg-[#5a1557] text-white"
        >
          {recordMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          <CheckCircle className="h-4 w-4 mr-1" />
          Record All Receipts
        </Button>
      </div>
    </div>
  );
}
