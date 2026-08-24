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
  Info
} from 'lucide-react';

/**
 * COMPACT PRICING SPREADSHEET GRID
 * High-performance Excel-like tabular pricing grid for 50-100+ line items with AI Historical Pricing Suggestions.
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
  onExportExcel,
  onOpenImportModal,
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
      const size = String(item.size || item.dynamicFields?.valve_size || '').toLowerCase();
      const pClass = String(item.pressureClass || item.dynamicFields?.valve_class || '').toLowerCase();
      const moc = String(item.materialGrade || item.dynamicFields?.valve_body_moc || '').toLowerCase();
      const match = lineId.includes(query) || desc.includes(query) || size.includes(query) || pClass.includes(query) || moc.includes(query);
      return match ? idx : null;
    }).filter(i => i !== null);
  }, [items, searchTerm]);

  const allFilteredSelected = filteredIndices.length > 0 && filteredIndices.every(idx => selectedIndices.includes(idx));

  return (
    <div className="space-y-3">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Search tag, size, class, MOC..."
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
            className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download pricing schedule as Excel XLSX"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            Export Excel (XLSX)
          </button>
          {!readOnly && (
            <button
              onClick={onOpenImportModal}
              className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-700 text-xs font-bold rounded-xl border border-brand-200 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Upload filled pricing spreadsheet"
            >
              <Upload className="w-3.5 h-3.5 text-brand-600" />
              Import Excel
            </button>
          )}
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-900 text-white">
              <tr>
                {/* Select All Checkbox */}
                <th className="px-3 py-3 w-10 text-center border-r border-slate-800 bg-slate-900 sticky left-0 z-20">
                  <button
                    type="button"
                    onClick={onToggleSelectAll}
                    className="cursor-pointer text-slate-300 hover:text-white"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="w-4 h-4 text-brand-400" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400" />
                    )}
                  </button>
                </th>
                <th className="px-3 py-3 font-bold text-[11px] w-12 text-center border-r border-slate-800">
                  #
                </th>
                <th className="px-3 py-3 font-bold text-[11px] min-w-[240px] max-w-[320px] border-r border-slate-800">
                  Item Description & Technical Specs
                </th>
                <th className="px-3 py-3 font-bold text-[11px] w-20 text-center border-r border-slate-800">
                  Qty
                </th>
                <th className="px-2 py-3 font-bold text-[11px] min-w-[110px] text-center border-r border-slate-800">
                  Base Price (₹)
                </th>
                <th className="px-2 py-3 font-bold text-[11px] min-w-[80px] text-center border-r border-slate-800">
                  Disc %
                </th>
                <th className="px-2 py-3 font-bold text-[11px] min-w-[90px] text-center border-r border-slate-800">
                  NDT (₹)
                </th>
                <th className="px-2 py-3 font-bold text-[11px] min-w-[90px] text-center border-r border-slate-800">
                  Spec Test (₹)
                </th>
                <th className="px-2 py-3 font-bold text-[11px] min-w-[90px] text-center border-r border-slate-800">
                  Spares (₹)
                </th>
                <th className="px-2 py-3 font-bold text-[11px] min-w-[80px] text-center border-r border-slate-800">
                  P&F (₹)
                </th>
                <th className="px-2 py-3 font-bold text-[11px] min-w-[80px] text-center border-r border-slate-800">
                  TPIA (₹)
                </th>
                <th className="px-3 py-3 font-bold text-[11px] min-w-[110px] text-right border-r border-slate-800">
                  Unit Rate (₹)
                </th>
                <th className="px-4 py-3 font-bold text-[11px] min-w-[130px] text-right border-r border-slate-800">
                  Line Total (₹)
                </th>
                {!readOnly && (
                  <th className="px-3 py-3 font-bold text-[11px] w-16 text-center">
                    Actions
                  </th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredIndices.map((idx) => {
                const item = items[idx];
                const isSelected = selectedIndices.includes(idx);
                const lineId = item.lineItemId || (item._id ? `LI-${item._id.toString().slice(-6).toUpperCase()}` : `LI-${String(idx + 1).padStart(5, '0')}`);
                const size = item.size || item.dynamicFields?.valve_size || item.dynamicFields?.size || item.dynamicFields?.size_mm || '-';
                const pClass = item.pressureClass || item.dynamicFields?.valve_class || item.dynamicFields?.class || item.dynamicFields?.pressure_class || '-';
                const moc = item.materialGrade || item.dynamicFields?.valve_body_moc || item.dynamicFields?.valve_moc_body || item.dynamicFields?.body_material || item.dynamicFields?.shellMaterial || '-';

                const unitPrice = Number(item.unitPrice) || 0;
                const discount = Number(item.discountPercent) || 0;
                const ndt = Number(item.ndtCharges) || 0;
                const specTest = Number(item.specialTestingCharges) || 0;
                const spares = Number(item.sparesCharges) || 0;
                const pf = Number(item.pfCharges) || 0;
                const tpia = Number(item.tpiCharges) || 0;
                const qty = Number(item.quantity) || 1;

                const effectiveUnitRate = Math.round(((unitPrice * (1 - discount / 100)) + ndt + specTest + spares + pf + tpia) * 100) / 100;
                const lineTotal = Math.round(effectiveUnitRate * qty * 100) / 100;

                return (
                  <tr 
                    key={idx} 
                    className={`transition-colors group ${isSelected ? 'bg-brand-50/60' : 'hover:bg-slate-50/80'}`}
                  >
                    {/* Row Checkbox */}
                    <td className="px-3 py-2.5 text-center border-r border-slate-200 sticky left-0 z-10 bg-inherit">
                      <button
                        type="button"
                        onClick={() => onToggleSelectItem(idx)}
                        className="cursor-pointer text-slate-400 hover:text-brand-600"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-brand-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300" />
                        )}
                      </button>
                    </td>

                    {/* Sr No & Line ID */}
                    <td className="px-3 py-2.5 text-center font-bold text-slate-600 border-r border-slate-200">
                      <span className="block font-black text-xs text-slate-900">{item.itemNo || idx + 1}</span>
                      <span className="text-[9px] text-slate-400 font-mono">{lineId}</span>
                    </td>

                    {/* Description & Technical Chips */}
                    <td className="px-3 py-2.5 border-r border-slate-200">
                      <div className="font-semibold text-slate-900 leading-snug line-clamp-2" title={item.description}>
                        {item.description}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1 text-[10px]">
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 font-bold rounded">
                          {size}
                        </span>
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 font-bold rounded">
                          {pClass}
                        </span>
                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 font-medium rounded truncate max-w-[140px]">
                          {moc}
                        </span>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="px-3 py-2.5 text-center font-bold text-slate-800 border-r border-slate-200">
                      <span className="text-xs">{item.quantity || 1}</span>
                      <span className="text-[10px] text-slate-400 block font-normal">{item.unit || 'NOS'}</span>
                    </td>

                    {/* Base Unit Price */}
                    <td className="px-1.5 py-2 border-r border-slate-200 relative">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice ?? ''}
                          placeholder="0"
                          onChange={e => onItemFieldChange(idx, 'unitPrice', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded-lg text-xs font-bold text-right outline-none transition-all"
                        />
                      ) : (
                        <span className="font-bold text-right block px-2">₹{unitPrice.toLocaleString('en-IN')}</span>
                      )}

                      {/* AI Historical Price Suggestion Indicator */}
                      {(() => {
                        const suggestion = pricingSuggestions[lineId] || pricingSuggestions[item.lineItemId] || pricingSuggestions[`idx_${idx}`] || pricingSuggestions[idx];
                        if (!suggestion) return null;

                        return (
                          <div className="relative mt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSuggestionIdx(activeSuggestionIdx === idx ? null : idx);
                              }}
                              className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-1.5 py-0.5 rounded cursor-pointer transition-all w-full justify-center shadow-2xs"
                              title={`AI Benchmark: ${suggestion.formattedRange} (Avg: ${suggestion.formattedAvg})`}
                            >
                              <Sparkles className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                              <span className="truncate">{suggestion.formattedRange}</span>
                            </button>

                            {activeSuggestionIdx === idx && (
                              <div 
                                className="absolute left-0 top-full mt-1.5 w-64 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 p-3.5 z-50 animate-in fade-in zoom-in-95 text-left"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800">
                                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                    <span>AI Historical Pricing</span>
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
                                    <span className="text-slate-500 font-medium">Suggested Average:</span>
                                    <span className="font-black text-emerald-600">{suggestion.formattedAvg}</span>
                                  </div>
                                  {suggestion.lastQuotedPrice && (
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="text-slate-400">Last Quoted:</span>
                                      <span className="font-semibold text-slate-600">{suggestion.lastQuotedPrice} ({suggestion.lastQuotedDate})</span>
                                    </div>
                                  )}
                                  <p className="text-[10px] text-slate-500 italic pt-1 leading-tight border-t border-slate-50 mt-1">
                                    {suggestion.recommendationNote}
                                  </p>
                                </div>

                                {!readOnly && (
                                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-col gap-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">1-Click Apply Rate:</span>
                                    <div className="grid grid-cols-3 gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onItemFieldChange(idx, 'unitPrice', suggestion.minPrice);
                                          setActiveSuggestionIdx(null);
                                        }}
                                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer transition-colors text-center"
                                        title={`Apply minimum: ₹${suggestion.minPrice}`}
                                      >
                                        Min
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onItemFieldChange(idx, 'unitPrice', suggestion.avgPrice);
                                          setActiveSuggestionIdx(null);
                                        }}
                                        className="px-1.5 py-1 bg-brand-50 hover:bg-brand-100 text-brand-700 text-[10px] font-bold rounded cursor-pointer transition-colors text-center border border-brand-200"
                                        title={`Apply average: ₹${suggestion.avgPrice}`}
                                      >
                                        Avg
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onItemFieldChange(idx, 'unitPrice', suggestion.maxPrice);
                                          setActiveSuggestionIdx(null);
                                        }}
                                        className="px-1.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold rounded cursor-pointer transition-colors text-center"
                                        title={`Apply maximum: ₹${suggestion.maxPrice}`}
                                      >
                                        Max
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>

                    {/* Discount % */}
                    <td className="px-1.5 py-2 border-r border-slate-200">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.discountPercent ?? ''}
                          placeholder="0"
                          onChange={e => onItemFieldChange(idx, 'discountPercent', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded-lg text-xs font-medium text-right outline-none transition-all"
                        />
                      ) : (
                        <span className="text-right block px-2">{discount}%</span>
                      )}
                    </td>

                    {/* NDT Charges */}
                    <td className="px-1.5 py-2 border-r border-slate-200">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="0"
                          value={item.ndtCharges ?? ''}
                          placeholder="0"
                          onChange={e => onItemFieldChange(idx, 'ndtCharges', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded-lg text-xs font-medium text-right outline-none transition-all"
                        />
                      ) : (
                        <span className="text-right block px-2">₹{ndt}</span>
                      )}
                    </td>

                    {/* Special Testing */}
                    <td className="px-1.5 py-2 border-r border-slate-200">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="0"
                          value={item.specialTestingCharges ?? ''}
                          placeholder="0"
                          onChange={e => onItemFieldChange(idx, 'specialTestingCharges', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded-lg text-xs font-medium text-right outline-none transition-all"
                        />
                      ) : (
                        <span className="text-right block px-2">₹{specTest}</span>
                      )}
                    </td>

                    {/* Spares */}
                    <td className="px-1.5 py-2 border-r border-slate-200">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="0"
                          value={item.sparesCharges ?? ''}
                          placeholder="0"
                          onChange={e => onItemFieldChange(idx, 'sparesCharges', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded-lg text-xs font-medium text-right outline-none transition-all"
                        />
                      ) : (
                        <span className="text-right block px-2">₹{spares}</span>
                      )}
                    </td>

                    {/* P&F */}
                    <td className="px-1.5 py-2 border-r border-slate-200">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="0"
                          value={item.pfCharges ?? ''}
                          placeholder="0"
                          onChange={e => onItemFieldChange(idx, 'pfCharges', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded-lg text-xs font-medium text-right outline-none transition-all"
                        />
                      ) : (
                        <span className="text-right block px-2">₹{pf}</span>
                      )}
                    </td>

                    {/* TPIA */}
                    <td className="px-1.5 py-2 border-r border-slate-200">
                      {!readOnly ? (
                        <input
                          type="number"
                          min="0"
                          value={item.tpiCharges ?? ''}
                          placeholder="0"
                          onChange={e => onItemFieldChange(idx, 'tpiCharges', e.target.value === '' ? 0 : Number(e.target.value))}
                          className="w-full px-2 py-1 bg-slate-50 hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded-lg text-xs font-medium text-right outline-none transition-all"
                        />
                      ) : (
                        <span className="text-right block px-2">₹{tpia}</span>
                      )}
                    </td>

                    {/* Unit Rate (Calculated) */}
                    <td className="px-3 py-2.5 text-right font-bold text-slate-900 border-r border-slate-200">
                      ₹{effectiveUnitRate.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Line Total */}
                    <td className="px-4 py-2.5 text-right font-black text-emerald-700 border-r border-slate-200 text-xs">
                      ₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Actions */}
                    {!readOnly && (
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenCopySpecs(idx)}
                            className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-brand-600 transition-colors"
                            title="Copy specifications to other items"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => onRemoveItem(idx)}
                              className="p-1.5 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-600 transition-colors"
                              title="Delete line item"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
