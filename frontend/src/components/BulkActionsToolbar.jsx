import React, { useState } from 'react';
import { 
  Zap, 
  ChevronDown, 
  Percent, 
  DollarSign, 
  Trash2, 
  Copy, 
  CheckCircle2, 
  AlertCircle,
  X,
  SlidersHorizontal
} from 'lucide-react';

/**
 * BULK ACTIONS TOOLBAR & CONFIRMATION MODAL
 * Provides unified bulk price adjustments with mandatory pre-execution confirmation.
 */

export const BULK_ACTIONS = [
  { id: 'set_base_rate', label: 'Set Base Unit Price (₹)', icon: DollarSign, inputType: 'number', unit: '₹', desc: 'Sets a uniform base unit rate for all selected line items.' },
  { id: 'adjust_base_rate_pct', label: 'Adjust Base Price (+/- %)', icon: Percent, inputType: 'number', unit: '%', desc: 'Increases or decreases existing base rates by a percentage (e.g. +10% or -5%).' },
  { id: 'adjust_base_rate_amt', label: 'Adjust Base Price (+/- ₹)', icon: DollarSign, inputType: 'number', unit: '₹', desc: 'Adds or subtracts a fixed amount from existing base rates.' },
  { id: 'set_discount', label: 'Set Discount (%)', icon: Percent, inputType: 'number', unit: '%', min: 0, max: 100, desc: 'Applies discount percentage across selected items (0 - 100%).' },
  { id: 'set_ndt', label: 'Set NDT Charges (₹)', icon: SlidersHorizontal, inputType: 'number', unit: '₹', desc: 'Sets uniform NDT charges per valve for selected items.' },
  { id: 'set_special_testing', label: 'Set Special Testing (₹)', icon: SlidersHorizontal, inputType: 'number', unit: '₹', desc: 'Sets special testing surcharge (Helium, cryogenic, etc.) per valve.' },
  { id: 'set_spares', label: 'Set Spares Charges (₹)', icon: SlidersHorizontal, inputType: 'number', unit: '₹', desc: 'Sets spares surcharge per valve.' },
  { id: 'set_pf', label: 'Set P&F Charges (₹)', icon: SlidersHorizontal, inputType: 'number', unit: '₹', desc: 'Sets packaging & forwarding charge per valve.' },
  { id: 'set_tpia', label: 'Set TPIA Charges (₹)', icon: SlidersHorizontal, inputType: 'number', unit: '₹', desc: 'Sets TPIA inspection surcharge per valve.' },
  { id: 'clear_pricing', label: 'Clear All Pricing Values', icon: Trash2, danger: true, desc: 'Resets base rates, discounts, and all surcharges to 0 for selected items.' }
];

export default function BulkActionsToolbar({
  selectedIndices = [],
  totalItemsCount = 0,
  onClearSelection,
  onApplyBulkAction,
  onOpenCopySpecs,
  onApplyAiSuggestedPrices
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeAction, setActiveAction] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  if (selectedIndices.length === 0) return null;

  const handleSelectAction = (action) => {
    setIsMenuOpen(false);
    setActiveAction(action);
    setInputValue(action.id === 'set_discount' ? '5' : '0');
    setShowConfirmModal(true);
  };

  const handleExecute = () => {
    if (!activeAction) return;

    let mappedAction = activeAction.id;
    let adjustType = 'percent';

    if (activeAction.id === 'adjust_base_rate_pct') {
      mappedAction = 'adjust_base_rate';
      adjustType = 'percent';
    } else if (activeAction.id === 'adjust_base_rate_amt') {
      mappedAction = 'adjust_base_rate';
      adjustType = 'amount';
    }

    onApplyBulkAction({
      targetIndices: selectedIndices,
      action: mappedAction,
      value: Number(inputValue) || 0,
      adjustType
    });

    setShowConfirmModal(false);
    setActiveAction(null);
  };

  return (
    <>
      {/* Sticky Floating Bar */}
      <div className="sticky bottom-6 z-30 bg-slate-900 text-white rounded-2xl shadow-2xl border border-slate-700 px-5 py-3 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-3 duration-200">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-brand-400 rounded-full animate-pulse" />
          <span className="text-xs font-bold">
            <strong className="text-brand-300 font-black">{selectedIndices.length}</strong> of {totalItemsCount} item(s) selected
          </span>
          <button
            onClick={onClearSelection}
            className="text-[11px] text-slate-400 hover:text-slate-200 underline font-medium ml-2"
          >
            Clear selection
          </button>
        </div>

        <div className="flex items-center gap-2 relative">
          {onApplyAiSuggestedPrices && (
            <button
              onClick={onApplyAiSuggestedPrices}
              className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-bold rounded-xl border border-amber-500/40 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              title="Auto-fill empty or selected unit prices with AI historical averages"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" /> Auto-Fill AI Rates
            </button>
          )}

          {onOpenCopySpecs && (
            <button
              onClick={() => onOpenCopySpecs(selectedIndices[0] || 0)}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5 text-brand-400" /> Copy Specs
            </button>
          )}

          {/* Bulk Menu Dropdown Button */}
          <div className="relative">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="px-4 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              Bulk Actions
              <ChevronDown className="w-3.5 h-3.5 ml-0.5" />
            </button>

            {isMenuOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-72 bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-4 py-2 border-b border-slate-100 text-[11px] font-black uppercase tracking-wider text-slate-400">
                  Apply to {selectedIndices.length} Selected Item(s)
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                  {BULK_ACTIONS.map(action => (
                    <button
                      key={action.id}
                      onClick={() => handleSelectAction(action)}
                      className={`w-full px-4 py-2 text-left text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                        action.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-brand-50 hover:text-brand-700'
                      }`}
                    >
                      <action.icon className="w-4 h-4 opacity-75" />
                      <span>{action.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation & Input Modal */}
      {showConfirmModal && activeAction && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className={`p-2 rounded-xl ${activeAction.danger ? 'bg-rose-100 text-rose-600' : 'bg-brand-50 text-brand-600'}`}>
                  <activeAction.icon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{activeAction.label}</h4>
                  <p className="text-[11px] text-slate-500">{activeAction.desc}</p>
                </div>
              </div>
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            {/* Value Input */}
            {activeAction.id !== 'clear_pricing' && (
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">Enter Value ({activeAction.unit}):</label>
                <div className="relative">
                  <input
                    type="number"
                    value={inputValue}
                    min={activeAction.min || 0}
                    max={activeAction.max || 10000000}
                    onChange={e => setInputValue(e.target.value)}
                    placeholder={`e.g. ${activeAction.id === 'set_discount' ? '5' : '1000'}`}
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-500 outline-none pr-10"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    {activeAction.unit}
                  </span>
                </div>
              </div>
            )}

            {/* Impact Notice */}
            <div className={`p-3.5 rounded-xl border text-xs ${
              activeAction.danger ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-brand-50/50 border-brand-200 text-brand-900'
            }`}>
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>Confirmation Required:</strong> This action will modify <strong>{selectedIndices.length} line item(s)</strong> simultaneously.
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900"
              >
                Cancel
              </button>
              <button
                onClick={handleExecute}
                className={`px-5 py-2 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all ${
                  activeAction.danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-brand-600 hover:bg-brand-700'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" />
                Apply to {selectedIndices.length} Items
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
