import React, { useState, useEffect } from 'react';
import { 
  History, 
  X, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  User, 
  FileText, 
  ChevronDown, 
  ChevronRight, 
  Plus, 
  Loader2,
  Clock,
  Sparkles
} from 'lucide-react';
import api from '../api/client';
import RevisionDiffViewer from './RevisionDiffViewer';

export default function RevisionHistoryModal({
  isOpen,
  onClose,
  quotationId,
  currentQuotation,
  onRevisionCreated
}) {
  const [loading, setLoading] = useState(true);
  const [historyData, setHistoryData] = useState(null);
  const [liveDiffData, setLiveDiffData] = useState(null);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [showLiveDiff, setShowLiveDiff] = useState(true);
  
  // Manual milestone note state
  const [showAddNote, setShowAddNote] = useState(false);
  const [manualNote, setManualNote] = useState('');
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && quotationId) {
      fetchData();
    }
  }, [isOpen, quotationId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [histRes, diffRes] = await Promise.all([
        api.get(`/quotations/${quotationId}/revisions`),
        api.get(`/quotations/${quotationId}/diff-since-last-sent`)
      ]);
      setHistoryData(histRes.data?.data || {});
      setLiveDiffData(diffRes.data?.data || {});
    } catch (err) {
      console.error('Failed to load revision history:', err);
      setError(err.response?.data?.message || 'Failed to load revision timeline');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManualMilestone = async (e) => {
    e.preventDefault();
    if (!manualNote.trim()) {
      setError('Please provide a reason or note for this revision milestone.');
      return;
    }

    setCreatingMilestone(true);
    setError('');
    try {
      const res = await api.post(`/quotations/${quotationId}/create-revision`, {
        revisionReason: manualNote
      });
      setManualNote('');
      setShowAddNote(false);
      await fetchData();
      if (onRevisionCreated) {
        onRevisionCreated(res.data?.data?.quotation);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create revision milestone');
    } finally {
      setCreatingMilestone(false);
    }
  };

  if (!isOpen) return null;

  const revisions = historyData?.revisions || [];
  const hasLiveChanges = liveDiffData?.diffResult?.hasChanges;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                Revision History & Change Timeline
                <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 font-black rounded-lg">
                  {historyData?.currentRevisionLabel || 'Rev 00'}
                </span>
              </h2>
              <p className="text-xs text-slate-500">Track all sent customer milestones, revision notes, and post-dispatch diffs.</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-slate-400 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-brand-600" />
              <p className="text-xs">Loading revision timeline...</p>
            </div>
          ) : (
            <>
              {/* Live Working Draft Section (If changes exist since last sent milestone) */}
              <div className="p-4 bg-gradient-to-r from-amber-50/80 to-amber-50/30 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-200 text-amber-900 text-[10px] font-black rounded uppercase tracking-wider">
                        Current Working Draft
                      </span>
                      {hasLiveChanges ? (
                        <span className="text-xs font-bold text-amber-900 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          {liveDiffData.diffResult.totalChangeCount} modification(s) since {liveDiffData.currentRevisionLabel}
                        </span>
                      ) : (
                        <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Matches last sent {liveDiffData?.currentRevisionLabel || 'Rev 00'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600">
                      {liveDiffData?.lastSentAt 
                        ? `Last emailed to ${liveDiffData.lastSentTo || 'client'} on ${new Date(liveDiffData.lastSentAt).toLocaleString('en-IN')}`
                        : 'Quotation has not been emailed to the customer yet.'
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowLiveDiff(!showLiveDiff)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 border border-amber-200 text-amber-900 font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-1"
                    >
                      {showLiveDiff ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {showLiveDiff ? 'Hide Working Diff' : 'View Working Diff'}
                    </button>
                  </div>
                </div>

                {showLiveDiff && (
                  <div className="pt-2 border-t border-amber-200/50">
                    <RevisionDiffViewer diffResult={liveDiffData?.diffResult} />
                  </div>
                )}
              </div>

              {/* Action Bar: Create Manual Revision Milestone with Note */}
              {!showAddNote ? (
                <div className="flex items-center justify-between pt-2">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    Formal Revision Milestones ({revisions.length})
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddNote(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Milestone Note
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCreateManualMilestone} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                      Record Formal Revision Milestone ({liveDiffData?.nextRevisionLabel || 'Rev 01'})
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddNote(false)}
                      className="text-xs text-slate-400 hover:text-slate-600"
                    >
                      Cancel
                    </button>
                  </div>
                  <textarea
                    rows={2}
                    value={manualNote}
                    onChange={e => setManualNote(e.target.value)}
                    placeholder="Describe the reason for revision or negotiated changes (e.g. Revised prices per email negotiation)..."
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                    required
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAddNote(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={creatingMilestone}
                      className="px-4 py-1.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {creatingMilestone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      Save Milestone
                    </button>
                  </div>
                </form>
              )}

              {/* Timeline List of Revisions */}
              {revisions.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs space-y-2">
                  <Clock className="w-8 h-8 mx-auto text-slate-300" />
                  <p className="font-medium text-slate-600">No Sent Milestones Recorded Yet</p>
                  <p>When you email this quotation to the client, a formal immutable revision milestone will be logged automatically.</p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:top-4 before:bottom-4 before:left-5 before:w-0.5 before:bg-slate-200">
                  {revisions.slice().reverse().map((rev, revIdx) => {
                    const isExpanded = expandedIndex === revIdx;
                    return (
                      <div key={revIdx} className="relative pl-12">
                        {/* Timeline Pin */}
                        <div className={`absolute left-3 top-3 -translate-x-1/2 w-5 h-5 rounded-full border-2 bg-white flex items-center justify-center shadow-xs ${
                          rev.isSentToCustomer ? 'border-emerald-500 text-emerald-600' : 'border-brand-500 text-brand-600'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${rev.isSentToCustomer ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                        </div>

                        {/* Card */}
                        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2.5 py-1 bg-slate-900 text-white font-black text-xs rounded-lg">
                                {rev.revisionLabel || `Rev ${String(rev.revisionNumber).padStart(2, '0')}`}
                              </span>
                              {rev.isSentToCustomer ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-md border border-emerald-200">
                                  <Send className="w-3 h-3" /> Emailed to {rev.sentToEmail || 'Customer'}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-md border border-slate-200">
                                  Internal Milestone
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-3 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {new Date(rev.createdAt || rev.sentAt).toLocaleDateString('en-IN', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {rev.createdByName || rev.createdBy?.fullName || 'Sales Engineer'}
                              </span>
                            </div>
                          </div>

                          {/* Revision Note / Reason */}
                          {rev.revisionReason && (
                            <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-700">
                              <span className="font-bold text-slate-500 text-[10px] uppercase tracking-wider block mb-0.5">
                                Revision Note / Justification:
                              </span>
                              <p className="font-medium">{rev.revisionReason}</p>
                            </div>
                          )}

                          {/* Expandable Changes Log */}
                          {rev.summaryTextList && rev.summaryTextList.length > 0 && (
                            <div className="pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setExpandedIndex(isExpanded ? -1 : revIdx)}
                                className="text-xs font-bold text-brand-600 hover:text-brand-700 flex items-center gap-1 cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                {isExpanded ? 'Hide' : 'View'} changes captured in this revision ({rev.summaryTextList.length})
                              </button>

                              {isExpanded && (
                                <div className="mt-3 space-y-1.5 pl-2 border-l-2 border-brand-200">
                                  {rev.summaryTextList.map((text, stIdx) => (
                                    <p key={stIdx} className="text-xs text-slate-600 flex items-center gap-1.5">
                                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 shrink-0" />
                                      {text}
                                    </p>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            Close Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
