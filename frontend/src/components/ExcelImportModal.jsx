import React, { useState } from 'react';
import { 
  Upload, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  ArrowRight,
  Download,
  AlertCircle
} from 'lucide-react';
import api from '../api/client';

/**
 * EXCEL IMPORT & VALIDATION MODAL
 * Includes strict validation report, missing row warnings with partial import protection,
 * and pre-import diff preview.
 */

export default function ExcelImportModal({
  isOpen,
  onClose,
  quotationId,
  onImportSuccess,
  onExportTemplate
}) {
  const [file, setFile] = useState(null);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [validationData, setValidationData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [allowPartialImport, setAllowPartialImport] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = async (e) => {
    const selected = e.target.files[0];
    if (!selected) return;

    setFile(selected);
    setValidationData(null);
    setErrorMessage(null);
    setAllowPartialImport(false);
    setValidating(true);

    const formData = new FormData();
    formData.append('file', selected);

    try {
      const res = await api.post(`/quotations/${quotationId}/validate-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setValidationData(res.data.data);
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!file || !validationData?.isValid) return;

    setImporting(true);
    setErrorMessage(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post(`/quotations/${quotationId}/import-excel`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (onImportSuccess) {
        onImportSuccess(res.data.data.quotation);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.response?.data?.message || err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Import Pricing Spreadsheet (Excel XLSX)</h3>
              <p className="text-xs text-slate-300">
                Update line item prices in bulk with validation and partial-import protection
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white text-sm font-bold p-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Step 1: Upload File */}
          {!validationData ? (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-brand-500 bg-slate-50 hover:bg-brand-50/20 rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all">
                <input 
                  type="file" 
                  accept=".xlsx, .xls" 
                  onChange={handleFileChange}
                  className="hidden" 
                />
                <div className="p-3 bg-white shadow-sm border border-slate-200 rounded-2xl text-brand-600">
                  <Upload className="w-7 h-7" />
                </div>
                <div className="text-center">
                  <span className="text-sm font-bold text-slate-800 block">
                    {file ? file.name : 'Click to select or drag & drop Excel workbook'}
                  </span>
                  <span className="text-xs text-slate-500 mt-1 block">
                    Supports Microsoft Excel files (.xlsx, .xls)
                  </span>
                </div>
              </label>

              {validating && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
                  <span className="w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
                  Validating spreadsheet rows and line IDs against database...
                </div>
              )}

              {errorMessage && (
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
                  <XCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Validation Error:</strong> {errorMessage}
                  </div>
                </div>
              )}

              {/* Template Helper */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600">Need the latest quotation pricing sheet with permanent Line Item IDs?</span>
                <button
                  onClick={onExportTemplate}
                  className="text-brand-600 hover:text-brand-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" /> Download Current Sheet
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Validation Results & Partial Import Warnings */
            <div className="space-y-4">
              {/* Top Status */}
              {validationData.isValid ? (
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                  <div>
                    <h4 className="text-sm font-bold text-emerald-950">Spreadsheet Validated Successfully</h4>
                    <p className="text-xs text-emerald-800">
                      <strong>{validationData.updatedCount} line items</strong> matched strictly by Line Item ID and verified for import.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-3">
                  <XCircle className="w-6 h-6 text-rose-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-950">Validation Failed - Errors Found</h4>
                    <p className="text-xs text-rose-800">
                      Please correct the following issues in your Excel sheet before importing:
                    </p>
                  </div>
                </div>
              )}

              {/* Validation Errors List */}
              {validationData.errors?.length > 0 && (
                <div className="p-3 bg-rose-50/50 rounded-xl border border-rose-200 max-h-36 overflow-y-auto space-y-1">
                  {validationData.errors.map((err, i) => (
                    <div key={i} className="text-xs text-rose-700 flex items-start gap-1.5 font-medium">
                      <span className="text-rose-500 font-bold">•</span>
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Partial Import Protection Alert */}
              {validationData.requiresPartialConfirmation && (
                <div className="p-4 bg-amber-50 rounded-xl border border-amber-300 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-bold text-amber-950 uppercase tracking-wide">
                        Partial Import Detected (Missing Rows Protection)
                      </h5>
                      <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                        Quotation contains <strong>{validationData.totalDbItems} items</strong>, but Excel contains only <strong>{validationData.excelItemsCount} items</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="p-2.5 bg-white/80 rounded-lg border border-amber-200 text-xs">
                    <span className="font-bold text-slate-700 block mb-1">
                      {validationData.missingItemIds.length} Missing Item(s) (will NOT be deleted or modified in database):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {validationData.missingItemIds.map(m => (
                        <span key={m.lineItemId} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-mono font-bold text-[10px]">
                          {m.lineItemId} (#{m.itemNo})
                        </span>
                      ))}
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-amber-950 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={allowPartialImport}
                      onChange={e => setAllowPartialImport(e.target.checked)}
                      className="text-brand-600 focus:ring-brand-500 rounded"
                    />
                    <span>I understand and confirm importing updates for the {validationData.updatedCount} matching items only.</span>
                  </label>
                </div>
              )}

              {/* Warnings List */}
              {validationData.warnings?.length > 0 && !validationData.requiresPartialConfirmation && (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 max-h-24 overflow-y-auto space-y-1">
                  {validationData.warnings.map((w, i) => (
                    <div key={i} className="text-xs text-amber-800 flex items-start gap-1.5 font-medium">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <span>{w}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            Cancel
          </button>

          {validationData && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFile(null);
                  setValidationData(null);
                }}
                className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Choose Another File
              </button>

              <button
                disabled={!validationData.isValid || (validationData.requiresPartialConfirmation && !allowPartialImport) || importing}
                onClick={handleConfirmImport}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                {importing ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Applying Updates...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Apply Pricing to Database
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
