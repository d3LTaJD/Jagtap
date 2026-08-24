import React, { useState } from 'react';
import { 
  Copy, 
  CheckSquare, 
  Square, 
  ShieldCheck, 
  Lock, 
  AlertTriangle, 
  ArrowRight, 
  Layers, 
  Filter,
  CheckCircle2
} from 'lucide-react';

/**
 * SAFE SELECTIVE SPECIFICATION CLONING MODAL
 * Prevents accidental overwrite of intrinsic fields (Size, Class, Quantity, Description)
 * and provides granular category selection with preview before applying.
 */

export const SPEC_CATEGORIES_META = [
  {
    id: 'common_specs',
    label: 'Common Technical Specifications',
    desc: 'Design type, bore, end connections, operating mode, seat type, design/testing standards, design pressures & temperatures',
    fieldsCount: 27
  },
  {
    id: 'testing',
    label: 'Testing & Quality Requirements',
    desc: 'RT, UT, DPT, MPT, NACE MR0175, Fugitive Emission, PMI, Hydro shell/seat, Air seat, DBB testing',
    fieldsCount: 29
  },
  {
    id: 'moc',
    label: 'Material of Construction (MOC)',
    desc: 'Body/Bonnet MOC, Ball/Disc MOC, Stem MOC, Seat Ring MOC, Fasteners Stud & Nuts MOC',
    fieldsCount: 6
  },
  {
    id: 'annexures',
    label: 'API 6D Annexure Requirements',
    desc: 'Annex A through Annex M compliance toggles (Informative & Normative)',
    fieldsCount: 13
  }
];

export default function CopySpecsModal({
  isOpen,
  onClose,
  sourceItem,
  sourceIdx,
  items = [],
  selectedItemIndices = [],
  onApplyCloning
}) {
  const [categories, setCategories] = useState({
    common_specs: true,
    testing: true,
    moc: true,
    annexures: true
  });
  const [targetScope, setTargetScope] = useState('same_type'); // 'all', 'same_type', 'same_size', 'same_class', 'selected'
  const [previewMode, setPreviewMode] = useState(false);

  if (!isOpen || !sourceItem) return null;

  const sourceType = (sourceItem.productCategory || sourceItem.dynamicFields?.valve_type || 'Ball Valve').toLowerCase();
  const sourceSize = (sourceItem.size || sourceItem.dynamicFields?.valve_size || '-').toLowerCase();
  const sourceClass = (sourceItem.pressureClass || sourceItem.dynamicFields?.valve_class || '-').toLowerCase();

  // Compute matching target items
  const matchingIndices = items.map((item, idx) => {
    if (idx === sourceIdx) return null;
    if (targetScope === 'all') return idx;
    if (targetScope === 'same_type') {
      const t = (item.productCategory || item.dynamicFields?.valve_type || '').toLowerCase();
      return t === sourceType ? idx : null;
    }
    if (targetScope === 'same_size') {
      const s = (item.size || item.dynamicFields?.valve_size || '').toLowerCase();
      return s === sourceSize ? idx : null;
    }
    if (targetScope === 'same_class') {
      const c = (item.pressureClass || item.dynamicFields?.valve_class || '').toLowerCase();
      return c === sourceClass ? idx : null;
    }
    if (targetScope === 'selected') {
      return selectedItemIndices.includes(idx) ? idx : null;
    }
    return null;
  }).filter(idx => idx !== null);

  const selectedCategoriesCount = Object.values(categories).filter(Boolean).length;
  const totalFieldsToCopy = SPEC_CATEGORIES_META
    .filter(cat => categories[cat.id])
    .reduce((sum, cat) => sum + cat.fieldsCount, 0);

  const handleToggleCategory = (catId) => {
    setCategories(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleConfirmApply = () => {
    onApplyCloning({
      sourceIndex: sourceIdx,
      targetScope,
      targetIndices: matchingIndices,
      categories
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-600 rounded-xl">
              <Copy className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Selective Specification Cloning</h3>
              <p className="text-xs text-slate-300">
                Safely copy technical specifications from <strong className="text-white">Offer Sr. #{sourceItem.itemNo || sourceIdx + 1}</strong>
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

        {/* Source Item Card */}
        <div className="p-6 space-y-6">
          <div className="p-3.5 bg-brand-50/60 rounded-xl border border-brand-200/80 flex items-center justify-between text-xs">
            <div>
              <span className="px-2 py-0.5 bg-brand-600 text-white rounded font-black text-[10px] uppercase mr-2">
                Source Item #{sourceItem.itemNo || sourceIdx + 1}
              </span>
              <span className="font-bold text-slate-900">{sourceItem.description}</span>
            </div>
            <div className="text-slate-600 font-medium flex gap-3 text-[11px]">
              <span>Size: <strong>{sourceItem.size || '-'}</strong></span>
              <span>Class: <strong>{sourceItem.pressureClass || '-'}</strong></span>
              <span>MOC: <strong>{sourceItem.materialGrade || '-'}</strong></span>
            </div>
          </div>

          {!previewMode ? (
            <>
              {/* Step 1: Select Target Scope */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <Filter className="w-4 h-4 text-brand-600" />
                  1. Target Scope (Where to copy specs)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    targetScope === 'same_type' ? 'bg-brand-50/50 border-brand-500 ring-1 ring-brand-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={targetScope === 'same_type'} 
                      onChange={() => setTargetScope('same_type')}
                      className="mt-0.5 text-brand-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Same Valve Type Only</span>
                      <span className="text-[11px] text-slate-500">Apply to matching {sourceItem.productCategory || 'valves'} ({matchingIndices.length} items)</span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    targetScope === 'same_class' ? 'bg-brand-50/50 border-brand-500 ring-1 ring-brand-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={targetScope === 'same_class'} 
                      onChange={() => setTargetScope('same_class')}
                      className="mt-0.5 text-brand-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Same Pressure Class</span>
                      <span className="text-[11px] text-slate-500">Apply to matching {sourceItem.pressureClass || 'class'} ({matchingIndices.length} items)</span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    targetScope === 'all' ? 'bg-brand-50/50 border-brand-500 ring-1 ring-brand-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={targetScope === 'all'} 
                      onChange={() => setTargetScope('all')}
                      className="mt-0.5 text-brand-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">All Line Items</span>
                      <span className="text-[11px] text-slate-500">Apply to all other {items.length - 1} items</span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    targetScope === 'selected' ? 'bg-brand-50/50 border-brand-500 ring-1 ring-brand-500' : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                  }`}>
                    <input 
                      type="radio" 
                      name="scope" 
                      checked={targetScope === 'selected'} 
                      onChange={() => setTargetScope('selected')}
                      className="mt-0.5 text-brand-600"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Selected Rows Only</span>
                      <span className="text-[11px] text-slate-500">Apply to {selectedItemIndices.length} items checked in table</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Step 2: Choose Categories to Copy */}
              <div className="space-y-2.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-brand-600" />
                    2. Specification Categories to Clone
                  </span>
                  <span className="text-[11px] text-slate-500 font-semibold lowercase">
                    {totalFieldsToCopy} fields selected
                  </span>
                </label>

                <div className="space-y-2">
                  {SPEC_CATEGORIES_META.map(cat => (
                    <div 
                      key={cat.id}
                      onClick={() => handleToggleCategory(cat.id)}
                      className={`p-3 rounded-xl border flex items-start justify-between gap-3 cursor-pointer transition-all ${
                        categories[cat.id] ? 'bg-emerald-50/40 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 text-emerald-600">
                          {categories[cat.id] ? <CheckSquare className="w-4 h-4 text-emerald-600" /> : <Square className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{cat.label}</span>
                          <span className="text-[11px] text-slate-500 leading-relaxed block">{cat.desc}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-black px-2 py-0.5 bg-white border rounded text-slate-600 whitespace-nowrap">
                        {cat.fieldsCount} specs
                      </span>
                    </div>
                  ))}
                </div>

                {/* Protected Intrinsic Properties Notice */}
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
                  <Lock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>Protected Intrinsic Fields:</strong> Size, Class, Quantity, Description, and Line Item ID are <strong>locked</strong> and will never be overwritten.
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* PREVIEW MODE */
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-950">Pre-Execution Confirmation</h4>
                  <p className="text-xs text-emerald-800">
                    Ready to copy <strong>{totalFieldsToCopy} specification parameters</strong> from Item #{sourceItem.itemNo || sourceIdx + 1} to <strong>{matchingIndices.length} target items</strong>.
                  </p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                    <tr>
                      <th className="px-3 py-2 border-b">Sr.</th>
                      <th className="px-3 py-2 border-b">Target Item Description</th>
                      <th className="px-3 py-2 border-b">Size</th>
                      <th className="px-3 py-2 border-b">Class</th>
                      <th className="px-3 py-2 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {matchingIndices.map(idx => {
                      const item = items[idx];
                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-bold text-slate-600">#{item.itemNo || idx + 1}</td>
                          <td className="px-3 py-2 text-slate-800 font-medium truncate max-w-xs">{item.description}</td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{item.size || '-'}</td>
                          <td className="px-3 py-2 font-semibold text-slate-700">{item.pressureClass || '-'}</td>
                          <td className="px-3 py-2">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">
                              Will Update
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {!previewMode ? (
              <button
                disabled={matchingIndices.length === 0 || selectedCategoriesCount === 0}
                onClick={() => setPreviewMode(true)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
              >
                Preview Changes <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  onClick={() => setPreviewMode(false)}
                  className="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
                >
                  Back to Settings
                </button>
                <button
                  onClick={handleConfirmApply}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" /> Apply to {matchingIndices.length} Items
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
