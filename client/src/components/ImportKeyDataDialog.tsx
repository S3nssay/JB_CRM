import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { FileUp, Loader2, CheckCircle2, XCircle, AlertTriangle, FileText } from 'lucide-react';

interface StagingRow {
  id: number;
  batchId: string;
  pageNumber: number;
  status: string | null;
  propertyAddress: string | null;
  propertyFirstLine: string | null;
  propertyStreet: string | null;
  postcode: string | null;
  managementFee: string | null;
  managementType: string | null;
  managementPeriodMonths: string | null;
  landlordName: string | null;
  landlordAddress: string | null;
  landlordPhone: string | null;
  landlordMobile: string | null;
  landlordEmail: string | null;
  bankName: string | null;
  bankAccountNo: string | null;
  sortCode: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  tenantMobile: string | null;
  depositAmount: string | null;
  rentAmount: string | null;
  rentFrequency: string | null;
  tenancyStart: string | null;
  tenancyEnd: string | null;
  periodMonths: string | null;
  depositHeldBy: string | null;
  keysGivenToTenant: string | null;
  spareKeysInOffice: string | null;
  asAtDate: string | null;
  checklistJson: string | null;
  createdAt: string | null;
}

interface ImportResult {
  totalPages: number;
  successCount: number;
  errorCount: number;
  landlords: { created: number; existing: number };
  properties: { created: number; existing: number };
  tenants: { created: number; existing: number };
  tenancies: { created: number };
  checklistItems: { created: number };
  errors: Array<{ page: number; message: string }>;
  message: string;
}

interface ImportKeyDataDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImportKeyDataDialog({ open, onOpenChange }: ImportKeyDataDialogProps) {
  const [step, setStep] = useState<'upload' | 'review' | 'result'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [stagingRows, setStagingRows] = useState<StagingRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [parseErrors, setParseErrors] = useState<Array<{ page: number; message: string }>>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Step 1: Parse PDF → staging
  const parseMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await fetch('/api/crm/import-key-data/parse', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Parse failed');
      }
      return response.json();
    },
    onSuccess: async (data: { batchId: string; totalPages: number; parseErrors: Array<{ page: number; message: string }> }) => {
      setBatchId(data.batchId);
      setParseErrors(data.parseErrors || []);

      // Fetch staging rows
      const response = await fetch(`/api/crm/import-key-data/staging/${data.batchId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        const rows: StagingRow[] = await response.json();
        setStagingRows(rows);
        // Select all rows by default
        setSelectedIds(new Set(rows.map(r => r.id)));
        setStep('review');
      }

      toast({
        title: 'PDF parsed successfully',
        description: `${data.totalPages} pages parsed. Review the data below.`
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Parse failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  // Step 3: Import selected rows
  const importMutation = useMutation({
    mutationFn: async (rowIds: number[]) => {
      const response = await fetch('/api/crm/import-key-data/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIds }),
        credentials: 'include'
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Import failed');
      }
      return response.json() as Promise<ImportResult>;
    },
    onSuccess: (data) => {
      setImportResult(data);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['/api/crm/properties'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/landlords'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenants'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/tenancies'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/rental-agreements'] });
      queryClient.invalidateQueries({ queryKey: ['/api/crm/managed-properties'] });
      toast({
        title: 'Import complete',
        description: `${data.successCount} of ${data.totalPages} rows imported successfully.`
      });

      // Cleanup staging batch
      if (batchId) {
        fetch(`/api/crm/import-key-data/staging/${batchId}`, {
          method: 'DELETE',
          credentials: 'include'
        }).catch(() => {});
      }
    },
    onError: (error: Error) => {
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive'
      });
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== 'application/pdf') {
        toast({
          title: 'Invalid file',
          description: 'Please select a PDF file.',
          variant: 'destructive'
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleParse = () => {
    if (selectedFile) {
      parseMutation.mutate(selectedFile);
    }
  };

  const handleImport = () => {
    if (selectedIds.size > 0) {
      importMutation.mutate(Array.from(selectedIds));
    }
  };

  const toggleRow = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === stagingRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(stagingRows.map(r => r.id)));
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setImportResult(null);
    setStagingRows([]);
    setSelectedIds(new Set());
    setBatchId(null);
    setParseErrors([]);
    setStep('upload');
    if (fileInputRef.current) fileInputRef.current.value = '';
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`max-h-[90vh] overflow-y-auto ${step === 'review' ? 'max-w-6xl' : 'max-w-lg'}`}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5 text-[#791E75]" />
            Import Key Data
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload the managed property list PDF to parse and review data before importing.'}
            {step === 'review' && `${stagingRows.length} records parsed. Select rows to import.`}
            {step === 'result' && 'Import complete. See results below.'}
          </DialogDescription>
        </DialogHeader>

        {/* ===================== STEP 1: UPLOAD ===================== */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert className="bg-blue-50 border-blue-200">
              <FileText className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800">
                This imports data from the Property List PDF. Each page represents one property/tenancy record.
                Data will be parsed into a staging table for review before import.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <label className="text-sm font-medium">Select PDF File</label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileChange}
                  className="flex-1 text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-[#791E75] file:text-white hover:file:bg-[#5a1658] file:cursor-pointer cursor-pointer border rounded-md"
                />
              </div>
              {selectedFile && (
                <p className="text-xs text-muted-foreground">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(0)} KB)
                </p>
              )}
            </div>

            <Button
              onClick={handleParse}
              disabled={!selectedFile || parseMutation.isPending}
              className="w-full bg-[#791E75] hover:bg-[#5a1658]"
            >
              {parseMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing PDF... This may take a moment
                </>
              ) : (
                <>
                  <FileUp className="mr-2 h-4 w-4" />
                  Parse PDF
                </>
              )}
            </Button>
          </div>
        )}

        {/* ===================== STEP 2: REVIEW TABLE ===================== */}
        {step === 'review' && (
          <div className="space-y-4">
            {parseErrors.length > 0 && (
              <Alert className="bg-yellow-50 border-yellow-200">
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-sm text-yellow-800">
                  {parseErrors.length} pages had parse warnings. Check the data carefully.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedIds.size} of {stagingRows.length} rows selected
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={toggleAll}>
                  {selectedIds.size === stagingRows.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
            </div>

            <div className="border rounded-md overflow-auto max-h-[55vh] relative">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gray-50 shadow-sm">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === stagingRows.length && stagingRows.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </TableHead>
                    <TableHead className="w-10">#</TableHead>
                    <TableHead className="min-w-[200px]">Property Address</TableHead>
                    <TableHead className="min-w-[150px]">Landlord</TableHead>
                    <TableHead className="min-w-[150px]">Tenant</TableHead>
                    <TableHead className="w-20">Rent</TableHead>
                    <TableHead className="w-20">Deposit</TableHead>
                    <TableHead className="w-24">Start</TableHead>
                    <TableHead className="w-24">End</TableHead>
                    <TableHead className="w-16">Fee%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stagingRows.map((row) => (
                    <TableRow
                      key={row.id}
                      className={`cursor-pointer ${selectedIds.has(row.id) ? 'bg-purple-50' : ''}`}
                      onClick={() => toggleRow(row.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onCheckedChange={() => toggleRow(row.id)}
                        />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{row.pageNumber}</TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{row.propertyAddress || row.propertyStreet || row.propertyFirstLine || '—'}</div>
                        <div className="text-xs text-muted-foreground">{row.postcode || ''}</div>
                      </TableCell>
                      <TableCell className="text-sm">{row.landlordName || '—'}</TableCell>
                      <TableCell className="text-sm">{row.tenantName || '—'}</TableCell>
                      <TableCell className="text-sm">{row.rentAmount ? `£${row.rentAmount}` : '—'}</TableCell>
                      <TableCell className="text-sm">{row.depositAmount ? `£${row.depositAmount}` : '—'}</TableCell>
                      <TableCell className="text-xs">{row.tenancyStart || '—'}</TableCell>
                      <TableCell className="text-xs">{row.tenancyEnd || '—'}</TableCell>
                      <TableCell className="text-sm">{row.managementFee ? `${row.managementFee}%` : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('upload')} className="flex-1">
                Back
              </Button>
              <Button
                onClick={handleImport}
                disabled={selectedIds.size === 0 || importMutation.isPending}
                className="flex-1 bg-[#791E75] hover:bg-[#5a1658]"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing {selectedIds.size} rows...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    Import Selected ({selectedIds.size})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ===================== STEP 3: RESULTS ===================== */}
        {step === 'result' && importResult && (
          <div className="space-y-3 pt-2">
            <div className={`flex items-center gap-2 p-3 rounded-lg ${
              importResult.errorCount === 0 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'
            }`}>
              {importResult.errorCount === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              <span className="text-sm font-medium">{importResult.message}</span>
            </div>

            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Import Details</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Rows:</span>
                  <span className="font-medium">{importResult.totalPages}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Successful:</span>
                  <span className="font-medium text-green-600">{importResult.successCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Landlords:</span>
                  <span className="font-medium">
                    {importResult.landlords.created} new, {importResult.landlords.existing} existing
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Properties:</span>
                  <span className="font-medium">
                    {importResult.properties.created} new, {importResult.properties.existing} existing
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tenants:</span>
                  <span className="font-medium">
                    {importResult.tenants.created} new, {importResult.tenants.existing} existing
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tenancies:</span>
                  <span className="font-medium">{importResult.tenancies.created} created</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-gray-600">Checklist Items:</span>
                  <span className="font-medium">{importResult.checklistItems.created} created</span>
                </div>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="bg-red-50 rounded-lg p-3 space-y-2">
                <h4 className="text-sm font-semibold text-red-700 flex items-center gap-1">
                  <XCircle className="h-4 w-4" />
                  Errors ({importResult.errors.length})
                </h4>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {importResult.errors.map((err, idx) => (
                    <p key={idx} className="text-xs text-red-600">
                      Page {err.page}: {err.message}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleClose} className="w-full bg-[#791E75] hover:bg-[#5a1658]">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
