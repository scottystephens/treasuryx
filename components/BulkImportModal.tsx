'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  Download,
  FileText,
  AlertCircle,
  CheckCircle,
  X,
  RefreshCw,
  Eye,
  AlertTriangle,
} from 'lucide-react';
import { useTenant } from '@/lib/tenant-context';
import { toast } from 'sonner';

interface BulkImportProps {
  type: 'entities' | 'accounts';
  onSuccess?: () => void;
  onClose?: () => void;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

interface ImportResults {
  total: number;
  imported: number;
  skipped: number;
  errors: Array<{ row: number; entity_name?: string; account_name?: string; error: string }>;
}

export function BulkImportModal({ type, onSuccess, onClose }: BulkImportProps) {
  const { currentTenant } = useTenant();
  const [file, setFile] = useState<File | null>(null);
  const [csvData, setCsvData] = useState<string>('');
  const [step, setStep] = useState<'upload' | 'validate' | 'preview' | 'import' | 'results'>('upload');
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [loading, setLoading] = useState(false);

  const templateUrl = `/templates/${type}-template.csv`;
  const apiEndpoint = `/api/${type}/bulk-import`;

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(selectedFile);

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvData(content);
    };
    reader.readAsText(selectedFile);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (!droppedFile) return;

    if (!droppedFile.name.endsWith('.csv')) {
      toast.error('Please select a CSV file');
      return;
    }

    setFile(droppedFile);

    // Read file content
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setCsvData(content);
    };
    reader.readAsText(droppedFile);
  }, []);

  const handleValidate = async () => {
    if (!csvData || !currentTenant) return;

    setLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          csvData,
          mode: 'validate',
        }),
      });

      const data = await response.json();

      if (data.success && data.validation.valid) {
        setPreviewData(data.preview || []);
        setStep('preview');
        toast.success(`Validation successful! ${data.validation.rowCount} ${type} ready to import.`);
      } else {
        setValidationErrors(data.validation?.errors || []);
        setStep('validate');
        toast.error(`Validation failed. ${data.validation?.errors?.length || 0} errors found.`);
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate CSV file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!csvData || !currentTenant) return;

    setLoading(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: currentTenant.id,
          csvData,
          mode: 'import',
        }),
      });

      const data = await response.json();

      if (data.success) {
        setImportResults(data.results);
        setStep('results');
        
        if (data.results.imported > 0) {
          toast.success(`Successfully imported ${data.results.imported} ${type}!`);
          if (onSuccess) onSuccess();
        }
        
        if (data.results.errors.length > 0) {
          toast.warning(`${data.results.errors.length} ${type} failed to import. See details below.`);
        }
      } else {
        toast.error(data.error || 'Failed to import data');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import data');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setCsvData('');
    setStep('upload');
    setValidationErrors([]);
    setPreviewData([]);
    setImportResults(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold capitalize">Bulk Import {type}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Import multiple {type} from a CSV file
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div className="space-y-6">
              {/* Download Template */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900">Need a template?</h3>
                    <p className="text-sm text-blue-700 mt-1">
                      Download our CSV template with example data and instructions.
                    </p>
                    <div className="flex gap-2 mt-3">
                      <a href={templateUrl} download>
                        <Button size="sm" variant="outline" className="gap-2">
                          <Download className="h-4 w-4" />
                          Download Template
                        </Button>
                      </a>
                      <a href="/templates/README.md" download>
                        <Button size="sm" variant="ghost" className="gap-2">
                          <FileText className="h-4 w-4" />
                          View Instructions
                        </Button>
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload Area */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-semibold mb-2">Drop CSV file here or click to browse</p>
                <p className="text-sm text-muted-foreground">
                  Accepts .csv files only
                </p>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {file && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-900">{file.name}</p>
                        <p className="text-sm text-green-700">
                          {(file.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <Button
                      onClick={handleValidate}
                      disabled={loading}
                      className="gap-2"
                    >
                      {loading ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" />
                          Validate & Preview
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step: Validation Errors */}
          {step === 'validate' && validationErrors.length > 0 && (
            <div className="space-y-6">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900">
                      Validation Failed - {validationErrors.length} Error{validationErrors.length !== 1 ? 's' : ''}
                    </h3>
                    <p className="text-sm text-red-700 mt-1">
                      Please fix the following errors in your CSV file and try again.
                    </p>
                  </div>
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Row</th>
                      <th className="px-4 py-3 text-left font-semibold">Field</th>
                      <th className="px-4 py-3 text-left font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationErrors.map((error, index) => (
                      <tr key={index} className="border-t">
                        <td className="px-4 py-3">
                          <Badge variant="outline">{error.row}</Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{error.field}</td>
                        <td className="px-4 py-3 text-red-700">{error.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3">
                <Button onClick={handleReset} variant="outline">
                  Upload New File
                </Button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div className="space-y-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-green-900">Validation Successful!</h3>
                    <p className="text-sm text-green-700 mt-1">
                      All data looks good. Preview the first 5 rows below.
                    </p>
                  </div>
                </div>
              </div>

              {previewData.length > 0 && (
                <div className="border rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        {Object.keys(previewData[0]).map((key) => (
                          <th key={key} className="px-4 py-3 text-left font-semibold text-xs uppercase">
                            {key.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-t">
                          {Object.values(row).map((value: any, i) => (
                            <td key={i} className="px-4 py-3">{value || '-'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleReset} variant="outline">
                  Cancel
                </Button>
                <Button
                  onClick={handleImport}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Import Now
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Step: Results */}
          {step === 'results' && importResults && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="p-4 bg-blue-50 border-blue-200">
                  <p className="text-sm text-blue-600 font-medium">Total</p>
                  <p className="text-3xl font-bold text-blue-900">{importResults.total}</p>
                </Card>
                <Card className="p-4 bg-green-50 border-green-200">
                  <p className="text-sm text-green-600 font-medium">Imported</p>
                  <p className="text-3xl font-bold text-green-900">{importResults.imported}</p>
                </Card>
                <Card className="p-4 bg-red-50 border-red-200">
                  <p className="text-sm text-red-600 font-medium">Failed</p>
                  <p className="text-3xl font-bold text-red-900">
                    {importResults.errors.length + importResults.skipped}
                  </p>
                </Card>
              </div>

              {/* Errors */}
              {importResults.errors.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h3 className="font-semibold">Import Errors</h3>
                  </div>
                  <div className="max-h-64 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold">Row</th>
                          <th className="px-4 py-3 text-left font-semibold">Name</th>
                          <th className="px-4 py-3 text-left font-semibold">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importResults.errors.map((error, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-4 py-3">
                              <Badge variant="outline">{error.row}</Badge>
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {error.entity_name || error.account_name || '-'}
                            </td>
                            <td className="px-4 py-3 text-red-700">{error.error}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button onClick={handleReset} variant="outline">
                  Import Another File
                </Button>
                <Button onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

