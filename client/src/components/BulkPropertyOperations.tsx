import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Upload, Download, FileSpreadsheet, FileText, AlertCircle,
  CheckCircle, XCircle, Loader2, HelpCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface BulkPropertyOperationsProps {
  onImportComplete?: () => void;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: { row: number; error: string }[];
}

// CSV Template columns
const CSV_COLUMNS = [
  'title', 'addressLine1', 'addressLine2', 'postcode', 'area',
  'propertyType', 'listingType', 'price', 'bedrooms', 'bathrooms',
  'sqft', 'description', 'status', 'features'
];

const SAMPLE_CSV = `title,addressLine1,addressLine2,postcode,area,propertyType,listingType,price,bedrooms,bathrooms,sqft,description,status,features
"2 Bed Flat in Maida Vale","45 Maida Avenue","Flat 2",W9 1QE,Maida Vale,flat,rental,2500,2,1,850,"Beautiful 2 bedroom flat with garden views",active,"garden,parking,modern kitchen"
"3 Bed House in Queens Park","12 Queens Park Road","",NW6 7SL,Queens Park,house,sale,950000,3,2,1200,"Spacious family home with garage",active,"garage,garden,conservatory"`;

export function BulkPropertyOperations({ onImportComplete }: BulkPropertyOperationsProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Download CSV template
  const downloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'property_import_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    toast({
      title: 'Template downloaded',
      description: 'CSV template has been downloaded. Fill it in and upload to import properties.'
    });
  };

  // Handle file selection
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.csv')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a CSV file.',
          variant: 'destructive'
        });
        return;
      }
      setSelectedFile(file);
      setShowImportDialog(true);
    }
  };

  // Parse CSV file
  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const properties: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());

      const property: any = {};
      headers.forEach((header, idx) => {
        let value = values[idx] || '';
        value = value.replace(/^"|"$/g, '');

        // Convert numeric fields
        if (['price', 'bedrooms', 'bathrooms', 'sqft'].includes(header)) {
          property[header] = parseFloat(value) || 0;
        } else if (header === 'features') {
          property[header] = value.split(',').map((f: string) => f.trim()).filter(Boolean);
        } else {
          property[header] = value;
        }
      });

      properties.push(property);
    }

    return properties;
  };

  // Import properties
  const handleImport = async () => {
    if (!selectedFile) return;

    setIsImporting(true);
    setImportProgress(0);
    setImportResult(null);

    try {
      const text = await selectedFile.text();
      const properties = parseCSV(text);

      if (properties.length === 0) {
        throw new Error('No valid properties found in CSV');
      }

      const result: ImportResult = { success: 0, failed: 0, errors: [] };

      for (let i = 0; i < properties.length; i++) {
        try {
          const response = await fetch('/api/crm/properties', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(properties[i])
          });

          if (response.ok) {
            result.success++;
          } else {
            const error = await response.json();
            result.failed++;
            result.errors.push({ row: i + 2, error: error.error || 'Unknown error' });
          }
        } catch (error) {
          result.failed++;
          result.errors.push({ row: i + 2, error: 'Network error' });
        }

        setImportProgress(((i + 1) / properties.length) * 100);
      }

      setImportResult(result);

      if (result.success > 0) {
        toast({
          title: 'Import complete',
          description: `Successfully imported ${result.success} properties. ${result.failed} failed.`
        });
        onImportComplete?.();
      }
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Failed to import properties',
        variant: 'destructive'
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Export properties to CSV
  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);

    try {
      const response = await fetch('/api/crm/properties');
      if (!response.ok) throw new Error('Failed to fetch properties');

      const properties = await response.json();

      if (properties.length === 0) {
        toast({
          title: 'No properties',
          description: 'There are no properties to export.',
          variant: 'destructive'
        });
        return;
      }

      let content: string;
      let filename: string;
      let mimeType: string;

      if (format === 'csv') {
        // Generate CSV
        const headers = CSV_COLUMNS.join(',');
        const rows = properties.map((p: any) =>
          CSV_COLUMNS.map(col => {
            let value = p[col] ?? '';
            if (Array.isArray(value)) value = value.join(';');
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              value = `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        );
        content = [headers, ...rows].join('\n');
        filename = `properties_export_${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        content = JSON.stringify(properties, null, 2);
        filename = `properties_export_${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export complete',
        description: `${properties.length} properties exported to ${format.toUpperCase()}`
      });

      setShowExportDialog(false);
    } catch (error) {
      toast({
        title: 'Export failed',
        description: 'Failed to export properties',
        variant: 'destructive'
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Bulk Operations Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Bulk Operations
            <Badge variant="outline" className="ml-2">Admin Only</Badge>
          </CardTitle>
          <CardDescription>Import or export multiple properties at once</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import CSV
            </Button>

            <Button
              variant="outline"
              onClick={() => setShowExportDialog(true)}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Properties
            </Button>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={downloadTemplate}>
                    <HelpCircle className="h-4 w-4 mr-1" />
                    Download Template
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Download a sample CSV file to see the required format</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardContent>
      </Card>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Properties</DialogTitle>
            <DialogDescription>
              {selectedFile ? `Selected: ${selectedFile.name}` : 'Upload a CSV file to import properties'}
            </DialogDescription>
          </DialogHeader>

          {isImporting ? (
            <div className="py-6">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="h-8 w-8 animate-spin text-[#791E75]" />
              </div>
              <Progress value={importProgress} className="mb-2" />
              <p className="text-sm text-center text-gray-500">
                Importing... {Math.round(importProgress)}%
              </p>
            </div>
          ) : importResult ? (
            <div className="py-4 space-y-4">
              <div className="flex items-center justify-center gap-6">
                <div className="text-center">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-1" />
                  <span className="text-2xl font-bold text-green-600">{importResult.success}</span>
                  <p className="text-xs text-gray-500">Imported</p>
                </div>
                <div className="text-center">
                  <XCircle className="h-8 w-8 text-red-500 mx-auto mb-1" />
                  <span className="text-2xl font-bold text-red-600">{importResult.failed}</span>
                  <p className="text-xs text-gray-500">Failed</p>
                </div>
              </div>

              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-sm font-medium text-red-800 mb-2">Errors:</p>
                  {importResult.errors.slice(0, 5).map((err, i) => (
                    <p key={i} className="text-xs text-red-600">
                      Row {err.row}: {err.error}
                    </p>
                  ))}
                  {importResult.errors.length > 5 && (
                    <p className="text-xs text-red-600 mt-1">
                      ...and {importResult.errors.length - 5} more errors
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="py-4">
              <div className="bg-gray-50 rounded-lg p-4 text-sm">
                <p className="font-medium mb-2">CSV Format Requirements:</p>
                <ul className="list-disc list-inside text-gray-600 space-y-1">
                  <li>First row must be headers</li>
                  <li>Required: title, postcode, propertyType, listingType, price</li>
                  <li>listingType: sale, rental, or commercial</li>
                  <li>Features should be comma-separated</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter>
            {importResult ? (
              <Button onClick={() => {
                setShowImportDialog(false);
                setImportResult(null);
                setSelectedFile(null);
              }}>
                Close
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowImportDialog(false);
                    setSelectedFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={!selectedFile || isImporting}
                >
                  {isImporting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Start Import
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Export Properties</DialogTitle>
            <DialogDescription>
              Choose a format to export all properties
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-14"
              onClick={() => handleExport('csv')}
              disabled={isExporting}
            >
              <FileSpreadsheet className="h-5 w-5 mr-3 text-green-600" />
              <div className="text-left">
                <p className="font-medium">CSV Spreadsheet</p>
                <p className="text-xs text-gray-500">Compatible with Excel, Google Sheets</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-14"
              onClick={() => handleExport('json')}
              disabled={isExporting}
            >
              <FileText className="h-5 w-5 mr-3 text-blue-600" />
              <div className="text-left">
                <p className="font-medium">JSON Data</p>
                <p className="text-xs text-gray-500">For developers and integrations</p>
              </div>
            </Button>
          </div>

          {isExporting && (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-5 w-5 animate-spin text-[#791E75] mr-2" />
              <span className="text-sm">Exporting...</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default BulkPropertyOperations;
