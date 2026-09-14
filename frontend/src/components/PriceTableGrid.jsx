import React, { useState, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Search, 
  Trash2, 
  Copy, 
  CheckSquare, 
  Square,
  Sparkles,
  DollarSign,
  ArrowUpDown,
  X,
  TrendingUp,
  Info,
  Plus,
  Sliders,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

/**
 * PRICE PART – II MATRIX TABLE
 * Exactly matches Zoho WorkDrive Offer Formates.xlsx -> Price Part-II format.
 * Format No. R/5.1.3.5/2 Rev04.
 * Items across columns, specifications/pricing down rows.
 * NDT, TPIA, and Special Testing are common for all, NOT separate per-item charge additions.
 */

export default function PriceTableGrid({
  items = [],
  pricingSuggestions = {},
  selectedIndices = [],
  onToggleSelectAll,
  onToggleSelectItem,
  onItemFieldChange,
  onRemoveItem,
  onOpenCopySpecs,
  onOpenSpecsModal,
  onExportExcel,
  onOpenImportModal,
  onAddItem,
  priceFields = {},
  onPriceFieldsChange,
  pricing = {},
  readOnly = false
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeSuggestionIdx, setActiveSuggestionIdx] = useState(null);

  // Filtered items based on search query
  const filteredIndices = useMemo(() => {
    if (!searchTerm) return items.map((_, i) => i);
    const query = searchTerm.toLowerCase();
    return items.map((item, idx) => {
      const lineId = String(item.lineItemId || '').toLowerCase();
      const desc = String(item.description || '').toLowerCase();
      const vType = String(item.dynamicFields?.valve_type || item.productCategory || '').toLowerCase();
      const size = String(item.size || item.dynamicFields?.valve_size || '').toLowerCase();
      const pClass = String(item.pressureClass || item.dynamicFields?.valve_class || '').toLowerCase();
      const moc = String(item.materialGrade || item.dynamicFields?.valve_body_moc || '').toLowerCase();
      const match = lineId.includes(query) || desc.includes(query) || vType.includes(query) || size.includes(query) || pClass.includes(query) || moc.includes(query);
      return match ? idx : null;
    }).filter(i => i !== null);
  }, [items, searchTerm]);

  const allFilteredSelected = filteredIndices.length > 0 && filteredIndices.every(idx => selectedIndices.includes(idx));

  return (
    <div className="space-y-6">
      {/* Top Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search tag, size, class, valve type..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-brand-500 outline-none"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
          <span className="text-[11px] text-slate-500 font-bold whitespace-nowrap">
            Showing {filteredIndices.length} of {items.length} items
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            onClick={onExportExcel}
            className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Download Price Part-II matrix in exact Offer Formates.xlsx format"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Export Offer Formates (XLSX)
          </button>
          {!readOnly && (
            <>
              <button
                onClick={onOpenImportModal}
                className="px-3.5 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl border border-brand-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="Upload filled pricing spreadsheet"
              >
                <Upload className="w-3.5 h-3.5 text-brand-600" />
                Import Excel
              </button>
              {onAddItem && (
                <button
                  onClick={onAddItem}
                  className="px-3.5 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Valve Column
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Main Matrix Schedule Table (Zoho WorkDrive Format: Offer Formates.xlsx -> Price Part-II) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Title Banner */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-widest font-black text-brand-400">PRICE PART – II</span>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">Format No. R/5.1.3.5/2 Rev04</span>
            </div>
            <p className="text-xs text-slate-300 mt-1 font-medium">
              • {priceFields?.pricePartNotice || 'We offer our Valves as below, considering Contract Review Check (Format No. R/5.1.3.5/2 Rev04).'}
            </p>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-400">Common Charges: </span>
            <span className="text-xs font-bold text-amber-300">NDT, TPIA & Spec Test apply quotation-level</span>
          </div>
        </div>

        {/* Matrix Grid */}
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse text-xs">
            <tbody>
              {/* ROW 6: Enquiry Sr. NO. */}
              <tr className="border-b border-slate-200 bg-slate-100/75">
                <th className="px-4 py-3 font-bold text-slate-800 text-xs min-w-[280px] max-w-[320px] sticky left-0 z-20 bg-slate-100 border-r border-slate-200">
                  Enquiry Sr. NO.
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const isSelected = selectedIndices.includes(idx);
                  return (
                    <td key={`sr-${idx}`} className="px-4 py-2.5 text-center min-w-[160px] border-r border-slate-200 bg-inherit font-bold text-slate-900">
                      <div className="flex items-center justify-center gap-2">
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={() => onToggleSelectItem(idx)}
                            className="cursor-pointer text-slate-400 hover:text-brand-600"
                            title="Select line item"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-brand-600" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-slate-300" />
                            )}
                          </button>
                        )}
                        {!readOnly ? (
                          <input
                            type="number"
                            value={item.enquirySrNo || item.itemNo || idx + 1}
                            onChange={e => onItemFieldChange(idx, 'enquirySrNo', Number(e.target.value) || (idx + 1))}
                            className="w-14 text-center py-0.5 bg-white border border-slate-300 rounded font-bold text-xs focus:border-brand-500 outline-none"
                          />
                        ) : (
                          <span>{item.enquirySrNo || item.itemNo || idx + 1}</span>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>

              {/* ROW 7: Valve Type */}
              <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                <th className="px-4 py-2.5 font-bold text-slate-700 text-xs sticky left-0 z-20 bg-white border-r border-slate-200">
                  Valve Type
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const vType = item.dynamicFields?.valve_type || item.productCategory || 'Ball Valve';
                  return (
                    <td key={`type-${idx}`} className="px-3 py-2 text-center border-r border-slate-200 font-semibold text-slate-800">
                      {!readOnly ? (
                        <input
                          type="text"
                          value={vType}
                          onChange={e => onItemFieldChange(idx, 'productCategory', e.target.value)}
                          className="w-full text-center py-1 bg-transparent hover:bg-slate-50 focus:bg-white border border-transparent hover:border-slate-200 focus:border-brand-500 rounded text-xs font-semibold outline-none"
                        />
                      ) : (
                        <span>{vType}</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 8: Size in MM */}
              <tr className="border-b border-slate-200 bg-slate-50/30 hover:bg-slate-50/60">
                <th className="px-4 py-2.5 font-bold text-slate-700 text-xs sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
                  Size in MM
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const size = item.size || item.dynamicFields?.valve_size || item.dynamicFields?.size || '-';
                  return (
                    <td key={`sz-${idx}`} className="px-3 py-2 text-center border-r border-slate-200 font-bold text-slate-800">
                      {!readOnly ? (
                        <input
                          type="text"
                          value={size}
                          onChange={e => onItemFieldChange(idx, 'size', e.target.value)}
                          className="w-full text-center py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-brand-500 rounded text-xs font-bold outline-none"
                        />
                      ) : (
                        <span>{size}</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 9: Class */}
              <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                <th className="px-4 py-2.5 font-bold text-slate-700 text-xs sticky left-0 z-20 bg-white border-r border-slate-200">
                  Class
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const pClass = item.pressureClass || item.dynamicFields?.valve_class || item.dynamicFields?.class || '-';
                  return (
                    <td key={`cl-${idx}`} className="px-3 py-2 text-center border-r border-slate-200 font-bold text-slate-800">
                      {!readOnly ? (
                        <input
                          type="text"
                          value={pClass}
                          onChange={e => onItemFieldChange(idx, 'pressureClass', e.target.value)}
                          className="w-full text-center py-1 bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-200 focus:border-brand-500 rounded text-xs font-bold outline-none"
                        />
                      ) : (
                        <span>{pClass}</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 10: Quantity */}
              <tr className="border-b border-slate-200 bg-slate-50/30 hover:bg-slate-50/60">
                <th className="px-4 py-2.5 font-bold text-slate-700 text-xs sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
                  Quantity
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const qty = item.quantity || 1;
                  return (
                    <td key={`qty-${idx}`} className="px-3 py-2 text-center border-r border-slate-200 font-bold text-slate-900">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="1"
                          value={qty}
                          onChange={e => onItemFieldChange(idx, 'quantity', Number(e.target.value) || 1)}
                          className="w-20 text-center py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:border-brand-500 outline-none"
                        />
                      ) : (
                        <span>{qty} {item.unit || 'NOS'}</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 11: Unit Price (Highlight Yellow / Editable) */}
              <tr className="border-b-2 border-amber-300 bg-amber-50/40 hover:bg-amber-50/70">
                <th className="px-4 py-3 font-bold text-slate-900 text-xs sticky left-0 z-20 bg-amber-100/90 border-r border-amber-200">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-amber-950">Unit Price (₹)</span>
                    <span className="text-[10px] text-amber-700 bg-amber-200/80 px-1.5 py-0.2 rounded font-bold">Base Price</span>
                  </div>
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const lineId = item.lineItemId || `idx_${idx}`;
                  const unitPrice = Number(item.unitPrice) || 0;
                  const suggestion = pricingSuggestions[lineId] || pricingSuggestions[item.lineItemId] || pricingSuggestions[`idx_${idx}`] || pricingSuggestions[idx];

                  return (
                    <td key={`price-${idx}`} className="px-3 py-2.5 text-center border-r border-amber-200 relative bg-inherit">
                      {!readOnly ? (
                        <div className="space-y-1">
                          <div className="relative">
                            <span className="absolute left-2.5 top-2 text-slate-400 font-bold text-xs">₹</span>
                            <input
                              type="number"
                              min="0"
                              value={item.unitPrice ?? ''}
                              placeholder="0"
                              onChange={e => onItemFieldChange(idx, 'unitPrice', e.target.value === '' ? 0 : Number(e.target.value))}
                              className="w-full pl-6 pr-2 py-1.5 bg-white border border-amber-300 hover:border-amber-400 focus:border-brand-600 rounded-xl text-xs font-black text-right text-slate-900 shadow-2xs outline-none transition-all"
                            />
                          </div>

                          {/* AI Price Benchmark Pill */}
                          {suggestion && (
                            <div className="relative">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSuggestionIdx(activeSuggestionIdx === idx ? null : idx);
                                }}
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded-full cursor-pointer transition-all w-full justify-center"
                                title={`AI Benchmark: ${suggestion.formattedRange}`}
                              >
                                <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                                <span>{suggestion.formattedAvg || suggestion.formattedRange}</span>
                              </button>

                              {activeSuggestionIdx === idx && (
                                <div 
                                  className="absolute left-0 top-full mt-1.5 w-64 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 animate-in fade-in zoom-in-95 text-left"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                                    <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                      <span>AI Benchmark Price</span>
                                    </div>
                                    <button 
                                      type="button" 
                                      onClick={() => setActiveSuggestionIdx(null)}
                                      className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="space-y-1.5 text-[11px]">
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-500 font-medium">Historical Range:</span>
                                      <span className="font-black text-slate-900">{suggestion.formattedRange}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-slate-500 font-medium">Suggested Avg:</span>
                                      <span className="font-black text-emerald-600">{suggestion.formattedAvg}</span>
                                    </div>
                                    <div className="mt-2 pt-2 border-t border-slate-100 grid grid-cols-3 gap-1">
                                      <button
                                        type="button"
                                        onClick={() => { onItemFieldChange(idx, 'unitPrice', suggestion.minPrice); setActiveSuggestionIdx(null); }}
                                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer text-center"
                                      >
                                        Min
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { onItemFieldChange(idx, 'unitPrice', suggestion.avgPrice); setActiveSuggestionIdx(null); }}
                                        className="px-1.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[10px] font-bold rounded cursor-pointer text-center border border-brand-200"
                                      >
                                        Avg
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => { onItemFieldChange(idx, 'unitPrice', suggestion.maxPrice); setActiveSuggestionIdx(null); }}
                                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer text-center"
                                      >
                                        Max
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="font-black text-slate-900 text-sm">₹{unitPrice.toLocaleString('en-IN')}</span>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 12: Any NDT Requirement Clause */}
              <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                <th className="px-4 py-3 text-slate-700 text-[11px] leading-snug sticky left-0 z-20 bg-white border-r border-slate-200">
                  <div className="font-bold text-slate-800">Any NDT Requirement</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    (i.e. RT,UT,MPT) then <strong>charges will be Extra at actual to your account.</strong>
                  </div>
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  let ndtStr = item.ndtRequirement || item.dynamicFields?.ndt_requirement || item.dynamicFields?.ndt_applicable;
                  if (!ndtStr || String(ndtStr).trim() === '' || String(ndtStr).trim() === '-') {
                    const rt = String(item.dynamicFields?.valve_test_rt || item.dynamicFields?.test_rt || '').toLowerCase();
                    const ut = String(item.dynamicFields?.valve_test_ut || item.dynamicFields?.test_ut || '').toLowerCase();
                    const mpt = String(item.dynamicFields?.valve_test_mpt || item.dynamicFields?.test_mpt || '').toLowerCase();
                    const dpt = String(item.dynamicFields?.valve_test_dpt || item.dynamicFields?.test_dpt || '').toLowerCase();
                    const parts = [];
                    if (rt.includes('yes') || rt.includes('applicable')) parts.push('RT');
                    if (ut.includes('yes') || ut.includes('applicable')) parts.push('UT');
                    if (mpt.includes('yes') || mpt.includes('applicable')) parts.push('MPT');
                    if (dpt.includes('yes') || dpt.includes('applicable')) parts.push('DPT');

                    if (parts.length > 0) {
                      ndtStr = `${parts.join(', ')} Applicable`;
                    } else {
                      const sz = Number(String(item.size || item.dynamicFields?.valve_size || '').replace(/\D/g, '')) || 0;
                      const cl = String(item.pressureClass || item.dynamicFields?.valve_class || '').trim();
                      if (cl === '800' || (sz > 0 && sz <= 40)) {
                        ndtStr = 'UT Applicable';
                      } else {
                        ndtStr = 'RT Applicable';
                      }
                    }
                  }

                  return (
                    <td key={`ndt-${idx}`} className="px-3 py-2.5 text-center border-r border-slate-200">
                      {readOnly ? (
                        <span className="inline-block px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-[11px] font-bold border border-blue-200/80">
                          {ndtStr}
                        </span>
                      ) : (
                        <select
                          value={ndtStr}
                          onChange={(e) => {
                            const val = e.target.value;
                            onItemFieldChange?.(idx, 'ndtRequirement', val);
                            const updatedDyn = { ...(item.dynamicFields || {}), ndt_applicable: val, ndt_requirement: val };
                            onItemFieldChange?.(idx, 'dynamicFields', updatedDyn);
                          }}
                          className="px-2 py-1 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg text-[11px] font-bold text-slate-800 focus:ring-1 focus:ring-brand-500 cursor-pointer text-center"
                          title="Select NDT Requirement"
                        >
                          <option value="UT Applicable">UT Applicable</option>
                          <option value="RT Applicable">RT Applicable</option>
                          <option value="MPT Applicable">MPT Applicable</option>
                          <option value="DPT Applicable">DPT Applicable</option>
                          <option value="UT & RT Applicable">UT & RT Applicable</option>
                          <option value="Extra at actual">Extra at actual</option>
                          <option value="Not Applicable">Not Applicable</option>
                        </select>
                      )}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 13: Special Testing Requirement Clause (Merged common row across all item columns) */}
              <tr className="border-b border-slate-200 bg-slate-50/40 hover:bg-slate-50/70">
                <th className="px-4 py-3 text-slate-700 text-[11px] leading-snug sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
                  <div className="font-bold text-slate-800">If any Special Testing Requirement</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    (i.e. Helium, Nitrogen, Vaccum, IGC, PMI, NACE, Paint) then <strong>charges will be Extra at actual to your account.</strong>
                  </div>
                </th>
                <td colSpan={filteredIndices.length} className="px-4 py-3 text-left border-r border-slate-200">
                  <div className="flex items-center justify-start gap-2">
                    <span className="px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-800">
                      ₹ {pricing?.specialTestingAmount || 0}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      (Common lump sum for entire quotation)
                    </span>
                  </div>
                </td>
              </tr>

              {/* ROW 14: Spares, Manday required */}
              <tr className="border-b border-slate-200 hover:bg-slate-50/50">
                <th className="px-4 py-3 text-slate-700 text-[11px] leading-snug sticky left-0 z-20 bg-white border-r border-slate-200">
                  <div className="font-bold text-slate-800">Spares, Manday required</div>
                  <div className="text-[10px] text-slate-500 font-normal">
                    then <strong>charges will be Extra at actual to your account.</strong>
                  </div>
                </th>
                {filteredIndices.map((idx) => {
                  const sparesVal = (pricing?.sparesAmount !== undefined && pricing?.sparesAmount !== null) 
                    ? pricing.sparesAmount 
                    : (priceFields?.sparesCharges || 0);
                  return (
                    <td key={`spares-${idx}`} className="px-3 py-2.5 text-center border-r border-slate-200 font-medium text-xs">
                      <span className={sparesVal > 0 ? "text-slate-950 font-bold" : "text-slate-500 font-semibold"}>
                        ₹ {sparesVal.toLocaleString('en-IN')}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* ROW 15: Unit Rate */}
              <tr className="border-b border-slate-200 bg-slate-100/80 font-bold text-slate-900">
                <th className="px-4 py-3 text-slate-900 text-xs sticky left-0 z-20 bg-slate-100 border-r border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-slate-950">Unit Rate</span>
                    <span className="text-[10px] text-slate-500 font-normal">= Unit Price</span>
                  </div>
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const unitPrice = Number(item.unitPrice) || 0;
                  const discount = Number(item.discountPercent) || 0;
                  const unitRate = Math.round(unitPrice * (1 - discount / 100));

                  return (
                    <td key={`rate-${idx}`} className="px-3 py-2.5 text-center border-r border-slate-200 font-black text-slate-900 text-xs">
                      ₹{unitRate.toLocaleString('en-IN')}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 16: Total Rate */}
              <tr className="border-b border-slate-300 bg-emerald-50/40 font-bold text-emerald-950">
                <th className="px-4 py-3 text-emerald-950 text-xs sticky left-0 z-20 bg-emerald-100/90 border-r border-emerald-200">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-emerald-950">Total Rate (Excl. GST)</span>
                    <span className="text-[10px] text-emerald-700 font-bold">Qty × Rate</span>
                  </div>
                </th>
                {filteredIndices.map((idx) => {
                  const item = items[idx];
                  const unitPrice = Number(item.unitPrice) || 0;
                  const discount = Number(item.discountPercent) || 0;
                  const qty = Number(item.quantity) || 1;
                  const unitRate = Math.round(unitPrice * (1 - discount / 100));
                  const totalRate = unitRate * qty;

                  return (
                    <td key={`tot-${idx}`} className="px-3 py-2.5 text-center border-r border-emerald-200 font-black text-emerald-700 text-sm">
                      ₹{totalRate.toLocaleString('en-IN')}
                    </td>
                  );
                })}
              </tr>

              {/* ROW 17: Item Actions */}
              {!readOnly && (
                <tr className="bg-slate-50 text-xs border-b border-slate-300">
                  <th className="px-4 py-2 text-slate-500 text-[11px] sticky left-0 z-20 bg-slate-50 border-r border-slate-200">
                    Item Actions
                  </th>
                  {filteredIndices.map((idx) => (
                    <td key={`act-${idx}`} className="px-3 py-2 text-center border-r border-slate-200">
                      <div className="flex items-center justify-center gap-1.5">
                        {onOpenSpecsModal && (
                          <button
                            type="button"
                            onClick={() => onOpenSpecsModal(idx)}
                            className="p-1.5 hover:bg-brand-50 text-slate-500 hover:text-brand-600 rounded-lg transition-all cursor-pointer"
                            title="Edit Technical Specifications"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onOpenCopySpecs && (
                          <button
                            type="button"
                            onClick={() => onOpenCopySpecs(idx)}
                            className="p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 rounded-lg transition-all cursor-pointer"
                            title="Clone specs to other items"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {items.length > 1 && onRemoveItem && (
                          <button
                            type="button"
                            onClick={() => onRemoveItem(idx)}
                            className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-all cursor-pointer"
                            title="Delete Line Item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              )}

              {/* COMMERCIAL SUMMARY ROWS DIRECTLY MATCHING PRICE PART-II FORMAT (LEFT ALIGNED) */}
              <tr className="border-b border-slate-200 bg-slate-50/90 font-semibold text-slate-800 text-xs">
                <th className="px-4 py-2.5 text-left text-slate-800 text-xs sticky left-0 z-20 bg-slate-100 border-r border-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Extra for 3.2 Certificataton Charges.</span>
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">{pricing?.cert32Percent ?? 5}%</span>
                  </div>
                </th>
                <td colSpan={filteredIndices.length} className="px-4 py-2.5 text-left border-r border-slate-200">
                  <div className="flex items-center justify-start gap-2">
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-2xs">
                      ₹{Math.round(pricing?.cert32Amount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-slate-50/90 font-semibold text-slate-800 text-xs">
                <th className="px-4 py-2.5 text-left text-slate-800 text-xs sticky left-0 z-20 bg-slate-100 border-r border-slate-200">
                  <div className="flex items-center justify-between">
                    <span>Extra for Packing &amp; Forwarding Charges</span>
                    <span className="px-1.5 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-bold">{pricing?.pfPercent ?? 5}%</span>
                  </div>
                </th>
                <td colSpan={filteredIndices.length} className="px-4 py-2.5 text-left border-r border-slate-200">
                  <div className="flex items-center justify-start gap-2">
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-2xs">
                      ₹{Math.round(pricing?.pfAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-white font-semibold text-slate-800 text-xs">
                <th className="px-4 py-2.5 text-left text-slate-800 text-xs sticky left-0 z-20 bg-white border-r border-slate-200">
                  Third Party Inspection (TPIA) required then charges will be Extra to your account.
                </th>
                <td colSpan={filteredIndices.length} className="px-4 py-2.5 text-left border-r border-slate-200">
                  <div className="flex items-center justify-start gap-2">
                    <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-2xs">
                      ₹{Math.round(pricing?.tpiAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>

              {(pricing?.ndtAmount > 0 || (priceFields?.ndtCharges || 0) > 0) && (
                <tr className="border-b border-slate-200 bg-white font-semibold text-slate-800 text-xs">
                  <th className="px-4 py-2.5 text-left text-slate-800 text-xs sticky left-0 z-20 bg-white border-r border-slate-200">
                    Any NDT Requirement Charges (Common across all items)
                  </th>
                  <td colSpan={filteredIndices.length} className="px-4 py-2.5 text-left border-r border-slate-200">
                    <div className="flex items-center justify-start gap-2">
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-2xs">
                        ₹{Math.round(pricing?.ndtAmount || priceFields?.ndtCharges || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {(pricing?.specialTestingAmount > 0 || (priceFields?.specialTestingCharges || 0) > 0) && (
                <tr className="border-b border-slate-200 bg-white font-semibold text-slate-800 text-xs">
                  <th className="px-4 py-2.5 text-left text-slate-800 text-xs sticky left-0 z-20 bg-white border-r border-slate-200">
                    Special Testing Requirement Charges (Common across all items)
                  </th>
                  <td colSpan={filteredIndices.length} className="px-4 py-2.5 text-left border-r border-slate-200">
                    <div className="flex items-center justify-start gap-2">
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-2xs">
                        ₹{Math.round(pricing?.specialTestingAmount || priceFields?.specialTestingCharges || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              {(pricing?.sparesAmount > 0 || (priceFields?.sparesCharges || 0) > 0) && (
                <tr className="border-b border-slate-200 bg-white font-semibold text-slate-800 text-xs">
                  <th className="px-4 py-2.5 text-left text-slate-800 text-xs sticky left-0 z-20 bg-white border-r border-slate-200">
                    Spares, Manday required charges (Common across all items)
                  </th>
                  <td colSpan={filteredIndices.length} className="px-4 py-2.5 text-left border-r border-slate-200">
                    <div className="flex items-center justify-start gap-2">
                      <span className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 shadow-2xs">
                        ₹{Math.round(pricing?.sparesAmount || priceFields?.sparesCharges || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </td>
                </tr>
              )}

              <tr className="border-b border-slate-200 bg-slate-100 font-bold text-slate-900 text-xs">
                <th className="px-4 py-3 text-left text-slate-900 text-xs sticky left-0 z-20 bg-slate-100 border-r border-slate-200">
                  Grand Total (Inc. TPI, P&amp;F, Certi., etc.)
                </th>
                <td colSpan={filteredIndices.length} className="px-4 py-3 text-left border-r border-slate-200">
                  <div className="flex items-center justify-start gap-2">
                    <span className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-black shadow-xs">
                      ₹{Math.round(pricing?.grandTotalBeforeGST || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>

              <tr className="border-b border-slate-200 bg-white font-bold text-slate-800 text-xs">
                <th className="px-4 py-2.5 text-left text-slate-800 text-xs sticky left-0 z-20 bg-white border-r border-slate-200">
                  {pricing?.gstRate ?? 18}%GST
                </th>
                <td colSpan={filteredIndices.length} className="px-4 py-2.5 text-left border-r border-slate-200">
                  <div className="flex items-center justify-start gap-2">
                    <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 shadow-2xs">
                      ₹{Math.round(pricing?.gstAmount || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>

              <tr className="bg-emerald-100/90 font-black text-emerald-950 text-sm">
                <th className="px-4 py-3.5 text-left text-emerald-950 text-sm sticky left-0 z-20 bg-emerald-100 border-r border-emerald-300">
                  Grand Total With GST
                </th>
                <td colSpan={filteredIndices.length} className="px-4 py-3.5 text-left border-r border-emerald-300">
                  <div className="flex items-center justify-start gap-2">
                    <span className="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-sm font-black shadow-xs">
                      ₹{Math.round(pricing?.grandTotalWithGST || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Quotation-Level Common Charges & Commercial Clauses Panel */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Quotation Common Charges & Commercial Terms
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              These charges apply once across the entire quotation (Common for all items, not charged separately per valve).
            </p>
          </div>
          <div className="px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-800 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-amber-600" />
            Standard Terms Aligned with Price Part-II
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* TPIA Inspection Charges */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600">
              Third Party Inspection (TPIA) Charges (₹)
            </label>
            <input
              type="number"
              min="0"
              disabled={readOnly}
              value={priceFields?.tpiCharges !== undefined && priceFields?.tpiCharges !== null ? priceFields.tpiCharges : ''}
              placeholder="0 (Extra at actual)"
              onChange={e => onPriceFieldsChange?.({ ...priceFields, tpiCharges: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-brand-500 outline-none"
            />
            <span className="text-[10px] text-slate-400 block">Default: Extra at actual to client</span>
          </div>

          {/* Special Testing Charges */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600">
              Special Testing Charges (Common ₹)
            </label>
            <input
              type="number"
              min="0"
              disabled={readOnly}
              value={priceFields?.specialTestingCharges !== undefined && priceFields?.specialTestingCharges !== null ? priceFields.specialTestingCharges : ''}
              placeholder="0 (Extra at actual)"
              onChange={e => onPriceFieldsChange?.({ ...priceFields, specialTestingCharges: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-brand-500 outline-none"
            />
            <span className="text-[10px] text-slate-400 block">Helium, N2, Vacuum, IGC, PMI, NACE</span>
          </div>

          {/* Any NDT Requirement Charges */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600">
              NDT Requirement Charges (Common ₹)
            </label>
            <input
              type="number"
              min="0"
              disabled={readOnly}
              value={priceFields?.ndtCharges !== undefined && priceFields?.ndtCharges !== null ? priceFields.ndtCharges : ''}
              placeholder="0 (Extra at actual)"
              onChange={e => onPriceFieldsChange?.({ ...priceFields, ndtCharges: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-brand-500 outline-none"
            />
            <span className="text-[10px] text-slate-400 block">RT, UT, MPT (Extra at actual)</span>
          </div>

          {/* Spares & Manday Charges */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-600">
              Spares / Manday Charges (Common ₹)
            </label>
            <input
              type="number"
              min="0"
              disabled={readOnly}
              value={priceFields?.sparesCharges !== undefined && priceFields?.sparesCharges !== null ? priceFields.sparesCharges : ''}
              placeholder="0 (Extra at actual)"
              onChange={e => onPriceFieldsChange?.({ ...priceFields, sparesCharges: e.target.value === '' ? '' : Math.max(0, Number(e.target.value)) })}
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:border-brand-500 outline-none"
            />
            <span className="text-[10px] text-slate-400 block">Valve / Actuator Spares & Mandays</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* 3.2 Certification */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">3.2 Certification Charges</label>
              <span className="text-[10px] text-slate-400">Default: 5% of Subtotal</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                disabled={readOnly}
                value={priceFields?.cert32Percent ?? 5}
                onChange={e => onPriceFieldsChange?.({ ...priceFields, cert32Percent: Number(e.target.value) || 0 })}
                className="w-16 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-right outline-none"
              />
              <span className="text-xs font-bold text-slate-600">%</span>
            </div>
          </div>

          {/* P&F Charges */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">Packing & Forwarding (P&F)</label>
              <span className="text-[10px] text-slate-400">Default: 5% of Subtotal</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                disabled={readOnly}
                value={priceFields?.pfPercent ?? 5}
                onChange={e => onPriceFieldsChange?.({ ...priceFields, pfPercent: Number(e.target.value) || 0 })}
                className="w-16 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-right outline-none"
              />
              <span className="text-xs font-bold text-slate-600">%</span>
            </div>
          </div>

          {/* GST */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700">GST Rate</label>
              <span className="text-[10px] text-slate-400">Standard GST</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                max="100"
                disabled={readOnly}
                value={priceFields?.gstRate ?? 18}
                onChange={e => onPriceFieldsChange?.({ ...priceFields, gstRate: Number(e.target.value) || 0 })}
                className="w-16 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-right outline-none"
              />
              <span className="text-xs font-bold text-slate-600">%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
