import React from 'react';
import { 
  ArrowRight, 
  PlusCircle, 
  MinusCircle, 
  Edit3, 
  TrendingDown, 
  TrendingUp, 
  FileText, 
  CheckCircle2 
} from 'lucide-react';

export default function RevisionDiffViewer({ diffResult }) {
  if (!diffResult || (!diffResult.hasChanges && !diffResult.isInitial)) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center text-slate-500 text-xs flex items-center justify-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        <span>No modifications detected compared to the reference snapshot.</span>
      </div>
    );
  }

  if (diffResult.isInitial) {
    return (
      <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs">
        <p className="font-bold">Initial Proposal Dispatch (Rev 00)</p>
        <p className="mt-1 text-indigo-600">This is the base baseline offer. Sending it will establish the initial customer milestone snapshot.</p>
      </div>
    );
  }

  const { itemDiffs = [], termsDiffs = [], totalsDiff } = diffResult;

  return (
    <div className="space-y-4 text-xs">
      {/* Financial Variance Header Card */}
      {totalsDiff && (
        <div className="p-3.5 bg-slate-900 text-white rounded-xl flex items-center justify-between shadow-sm">
          <div>
            <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Grand Total Variance</span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-slate-400 line-through">{totalsDiff.oldGrandTotal}</span>
              <ArrowRight className="w-3 h-3 text-slate-500" />
              <span className="font-black text-sm text-white">{totalsDiff.newGrandTotal}</span>
            </div>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black ${
              totalsDiff.diffAmount < 0 
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {totalsDiff.diffAmount < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
              {totalsDiff.formattedDiff}
            </span>
          </div>
        </div>
      )}

      {/* Line Item Changes */}
      {itemDiffs.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <Edit3 className="w-3.5 h-3.5 text-brand-600" /> Line Item Modifications ({itemDiffs.length})
          </h4>

          <div className="space-y-2">
            {itemDiffs.map((diff, i) => {
              if (diff.type === 'ITEM_ADDED') {
                return (
                  <div key={i} className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2 text-emerald-900">
                    <PlusCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Item #{diff.itemNo}: {diff.description}</p>
                      <p className="text-[11px] text-emerald-700 mt-0.5">{diff.details}</p>
                    </div>
                  </div>
                );
              }

              if (diff.type === 'ITEM_REMOVED') {
                return (
                  <div key={i} className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-900">
                    <MinusCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold line-through">Item #{diff.itemNo}: {diff.description}</p>
                      <p className="text-[11px] text-rose-700 mt-0.5">{diff.details}</p>
                    </div>
                  </div>
                );
              }

              return (
                <div key={i} className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">Item #{diff.itemNo}: {diff.description}</span>
                    <span className="text-[10px] px-2 py-0.5 bg-amber-200/60 text-amber-900 font-bold rounded">
                      {diff.changes.length} change(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-amber-200/50">
                    {diff.changes.map((change, ci) => (
                      <div key={ci} className="bg-white/80 p-2 rounded-lg border border-amber-100 flex flex-col justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">{change.label}</span>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-rose-600 font-semibold line-through">{String(change.oldVal || '-')}</span>
                          <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-emerald-700 font-bold">{String(change.newVal || '-')}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Commercial Terms Changes */}
      {termsDiffs.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wider text-[10px]">
            <FileText className="w-3.5 h-3.5 text-brand-600" /> Commercial Terms Modifications ({termsDiffs.length})
          </h4>

          <div className="space-y-2">
            {termsDiffs.map((diff, i) => (
              <div key={i} className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl space-y-1">
                <span className="font-bold text-indigo-950">{diff.label}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                  <div className="p-2 bg-white/90 rounded-lg border border-indigo-100 text-rose-700">
                    <span className="text-[10px] block font-bold text-slate-400 uppercase">Previous Terms</span>
                    <p className="line-through mt-0.5">{diff.oldVal}</p>
                  </div>
                  <div className="p-2 bg-white/90 rounded-lg border border-indigo-100 text-emerald-800">
                    <span className="text-[10px] block font-bold text-emerald-600 uppercase">Updated Terms</span>
                    <p className="font-medium mt-0.5">{diff.newVal}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
