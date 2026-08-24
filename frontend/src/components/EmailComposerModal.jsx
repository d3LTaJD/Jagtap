import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  X, 
  Send, 
  Paperclip, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  History, 
  ChevronDown, 
  ChevronRight,
  Sparkles
} from 'lucide-react';
import api from '../api/client';
import RevisionDiffViewer from './RevisionDiffViewer';

const EmailComposerModal = ({ 
  isOpen, 
  onClose, 
  defaultTo = '', 
  defaultSubject = '', 
  availableFiles = [], 
  quotationId = null,
  onSendSuccess 
}) => {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [bodyText, setBodyText] = useState('');
  const [revisionNote, setRevisionNote] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingDiff, setCheckingDiff] = useState(false);
  const [diffInfo, setDiffInfo] = useState(null);
  const [showDiffPreview, setShowDiffPreview] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setSubject(defaultSubject);
      setRevisionNote('');
      setSuccess(false);
      setError('');

      if (quotationId) {
        checkDiff();
      }
    }
  }, [isOpen, quotationId, defaultTo, defaultSubject]);

  const checkDiff = async () => {
    setCheckingDiff(true);
    try {
      const res = await api.get(`/quotations/${quotationId}/diff-since-last-sent`);
      setDiffInfo(res.data?.data || null);
    } catch (err) {
      console.error('Failed to load quotation diff for email composer:', err);
    } finally {
      setCheckingDiff(false);
    }
  };

  // Smart attachment sorting and pre-selection
  useEffect(() => {
    if (availableFiles && availableFiles.length > 0) {
      // Find latest generated PDF
      let latestPdfId = null;
      let latestPdfTime = 0;

      availableFiles.forEach(file => {
        if (!file) return;
        const name = (file.originalName || file.fileName || '').toLowerCase();
        if (name.endsWith('.pdf')) {
          const time = file.createdAt ? new Date(file.createdAt).getTime() : 0;
          if (time >= latestPdfTime) {
            latestPdfTime = time;
            latestPdfId = file._id;
          }
        }
      });

      // Default selection: select only the latest PDF, plus any non-PDF documents
      const defaults = [];
      if (latestPdfId) defaults.push(latestPdfId);
      
      // Also include any non-PDF documents if uploaded
      availableFiles.forEach(file => {
        if (!file || file._id === latestPdfId) return;
        const name = (file.originalName || file.fileName || '').toLowerCase();
        if (!name.endsWith('.pdf')) {
          defaults.push(file._id);
        }
      });

      setSelectedFiles(defaults);
    }
  }, [availableFiles]);

  if (!isOpen) return null;

  const toggleFile = (fileId) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) ? prev.filter(id => id !== fileId) : [...prev, fileId]
    );
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!to || !subject) {
      setError('Recipient and Subject are required');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      if (quotationId) {
        // Send through Quotation revision dispatch endpoint
        const res = await api.post(`/quotations/${quotationId}/send-email`, {
          to,
          subject,
          bodyText,
          revisionNote,
          attachmentIds: selectedFiles
        });
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
          if (onSendSuccess) onSendSuccess(res.data?.data?.quotation);
        }, 2000);
      } else {
        // Generic email endpoint
        await api.post('/email/send', {
          to,
          subject,
          bodyText,
          attachmentIds: selectedFiles
        });
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          onClose();
          if (onSendSuccess) onSendSuccess();
        }, 2000);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send email');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = diffInfo?.diffResult?.hasChanges;
  const isFirstSend = diffInfo?.isFirstSend;
  const targetRevLabel = diffInfo?.nextRevisionLabel || 'Rev 00';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Send Quotation to Client
                {quotationId && (
                  <span className="text-[11px] px-2 py-0.5 bg-brand-100 text-brand-700 font-black rounded-lg">
                    {targetRevLabel}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-500">Official email dispatch with PDF attachments and automatic revision tracking.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="p-12 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Quotation Email Dispatched!</h3>
              <p className="text-slate-500 mt-2 text-sm">Recorded as <strong>{targetRevLabel}</strong> milestone and sent to {to}</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex flex-col flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Revision Milestone Banner */}
            {quotationId && diffInfo && (
              <div className={`p-4 rounded-2xl border text-xs space-y-2.5 ${
                isFirstSend 
                  ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950' 
                  : hasChanges 
                  ? 'bg-amber-50/80 border-amber-200 text-amber-950' 
                  : 'bg-slate-50 border-slate-200 text-slate-700'
              }`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 font-bold">
                    <Sparkles className={`w-4 h-4 ${hasChanges ? 'text-amber-600' : 'text-indigo-600'}`} />
                    <span>
                      {isFirstSend 
                        ? 'First Official Dispatch (Rev 00 Baseline Milestone)' 
                        : hasChanges 
                        ? `Modifications detected since ${diffInfo.currentRevisionLabel} → Sending creates ${diffInfo.nextRevisionLabel}`
                        : `Re-sending ${diffInfo.currentRevisionLabel} (No changes made)`}
                    </span>
                  </div>

                  {hasChanges && (
                    <button
                      type="button"
                      onClick={() => setShowDiffPreview(!showDiffPreview)}
                      className="text-[11px] font-bold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                    >
                      {showDiffPreview ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      {showDiffPreview ? 'Hide Changes' : 'View Changes'}
                    </button>
                  )}
                </div>

                {hasChanges && showDiffPreview && (
                  <div className="pt-2 border-t border-amber-200/60 max-h-48 overflow-y-auto">
                    <RevisionDiffViewer diffResult={diffInfo.diffResult} />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">To Recipient</label>
                <input
                  type="email"
                  value={to}
                  onChange={e => setTo(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  placeholder="client@petroleum.com"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  placeholder="Quotation / Offer Submission"
                  required
                />
              </div>

              {/* Revision Note / Reason for this milestone */}
              {quotationId && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                    Revision Note / Reason {hasChanges && <span className="text-amber-600 font-black">(Recommended)</span>}
                  </label>
                  <input
                    type="text"
                    value={revisionNote}
                    onChange={e => setRevisionNote(e.target.value)}
                    className="w-full px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    placeholder={isFirstSend ? "Initial official quotation offer" : "e.g. Revised prices and delivery schedule per client discussion"}
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Message Body</label>
                <textarea
                  value={bodyText}
                  onChange={e => setBodyText(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all resize-none"
                  placeholder="Dear Sir / Madam, Please find enclosed our formal quotation offer..."
                />
              </div>

              {availableFiles.length > 0 && (() => {
                // Find latest PDF
                let latestPdfId = null;
                let latestPdfTime = 0;
                availableFiles.forEach(f => {
                  if (!f) return;
                  const name = (f.originalName || f.fileName || '').toLowerCase();
                  if (name.endsWith('.pdf')) {
                    const time = f.createdAt ? new Date(f.createdAt).getTime() : 0;
                    if (time >= latestPdfTime) {
                      latestPdfTime = time;
                      latestPdfId = f._id;
                    }
                  }
                });

                return (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-1.5"><Paperclip className="w-3.5 h-3.5" /> Attachments to Include</span>
                      <span className="text-[10px] text-slate-400 font-normal">{selectedFiles.length} of {availableFiles.length} selected</span>
                    </label>
                    <div className="flex flex-col gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-2xl border border-slate-200">
                      {availableFiles.map(file => {
                        if (!file) return null;
                        const fileName = file.originalName || file.fileName || 'document.pdf';
                        const fileSize = file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : '';
                        const isLatestPdf = file._id === latestPdfId && fileName.toLowerCase().endsWith('.pdf');
                        const isSelected = selectedFiles.includes(file._id);

                        // Extract revision
                        const revMatch = fileName.match(/_Rev(\d+)/i) || fileName.match(/Rev\s*(\d+)/i);
                        const revLabel = revMatch ? `Rev ${revMatch[1].padStart(2, '0')}` : (file.revisionNumber !== undefined ? `Rev ${String(file.revisionNumber).padStart(2, '0')}` : null);

                        return (
                          <label 
                            key={file._id} 
                            className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                              isSelected 
                                ? (isLatestPdf ? 'bg-emerald-50/70 border-emerald-300 shadow-xs' : 'bg-white border-slate-300 shadow-xs') 
                                : 'bg-white/50 border-slate-200 opacity-75 hover:opacity-100 hover:bg-white'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-brand-600 rounded border-slate-300 focus:ring-brand-500 cursor-pointer"
                              checked={isSelected}
                              onChange={() => toggleFile(file._id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 justify-between">
                                <span className="font-bold text-slate-800 text-xs truncate" title={fileName}>
                                  {fileName}
                                </span>
                                <span className="text-[10px] text-slate-400 bg-white px-2 py-0.5 rounded border border-slate-100 uppercase font-mono shrink-0">
                                  {file.mimeType?.split('/')[1] || 'PDF'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mt-1 flex-wrap">
                                {revLabel && (
                                  <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-black rounded">
                                    {revLabel}
                                  </span>
                                )}
                                {isLatestPdf ? (
                                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-md border border-emerald-300">
                                    ★ Latest Generated PDF
                                  </span>
                                ) : revLabel ? (
                                  <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 text-[9px] font-medium rounded border border-amber-200">
                                    Previous Version
                                  </span>
                                ) : null}

                                <span className="text-[10px] text-slate-400">
                                  {fileSize}
                                </span>

                                {file.createdAt && (
                                  <span className="text-[10px] text-slate-400">
                                    • {new Date(file.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="pt-4 mt-2 border-t border-slate-100 flex justify-end gap-3">
              <button 
                type="button" 
                onClick={onClose}
                className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button 
                type="submit" 
                disabled={loading || checkingDiff}
                className="inline-flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm shadow-brand-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {quotationId ? `Send & Record ${targetRevLabel}` : 'Send Email'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default EmailComposerModal;
