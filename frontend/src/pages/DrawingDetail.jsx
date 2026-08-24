import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  FileCode2,
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Clock,
  RefreshCw,
  FileText,
  Download,
  Building2,
  Shield,
  Layers,
  Sparkles,
  ChevronRight,
  UserCheck,
  XCircle,
  Eye,
  Check,
  X,
  Lock,
  Send,
  HelpCircle,
  Truck
} from 'lucide-react';
import api from '../api/client';
import { useAbility, getRoleCode } from '../context/AbilityContext';

export default function DrawingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const ability = useAbility();

  const [drawing, setDrawing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('specs'); // 'specs', 'checklist', 'revisions', 'sla'
  const [selectedRevisionIdx, setSelectedRevisionIdx] = useState(0);

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadComments, setUploadComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [approvalComments, setApprovalComments] = useState('');

  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const [checklistData, setChecklistData] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDrawing = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/drawings/${id}`);
      const data = res.data.data?.drawing;
      setDrawing(data);

      if (data?.revisions?.length > 0) {
        const lastIdx = data.revisions.length - 1;
        setSelectedRevisionIdx(lastIdx);
        const activeChecklist = data.revisions[lastIdx]?.tdsChecklist?.length > 0
          ? data.revisions[lastIdx].tdsChecklist
          : (data.revisions.find(r => r.tdsChecklist?.length > 0)?.tdsChecklist || []);
        setChecklistData(activeChecklist);
      }
    } catch (err) {
      console.error('Failed to load drawing:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDrawing();
  }, [id]);

  const currentRevision = drawing?.revisions?.[selectedRevisionIdx];

  const handleRevisionSelect = (idx) => {
    setSelectedRevisionIdx(idx);
    const rev = drawing?.revisions?.[idx];
    const activeChecklist = rev?.tdsChecklist?.length > 0
      ? rev.tdsChecklist
      : (drawing?.revisions?.find(r => r.tdsChecklist?.length > 0)?.tdsChecklist || []);
    setChecklistData(activeChecklist);
  };

  const handleUploadNewRevision = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setActionLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('comments', uploadComments);

      await api.post(`/drawings/${id}/revisions`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      showToast('New drawing revision uploaded successfully!');
      setIsUploadModalOpen(false);
      setUploadFile(null);
      setUploadComments('');
      await fetchDrawing();
    } catch (err) {
      console.error('Failed to upload revision:', err);
      alert(err.response?.data?.message || 'Failed to upload revision');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveChecklist = async () => {
    if (!currentRevision) return;
    setActionLoading(true);
    try {
      await api.patch(`/drawings/${id}/checklist`, {
        revisionNumber: currentRevision.revisionNumber,
        checklist: checklistData
      });
      showToast('TDS Technical Checklist saved successfully!');
      await fetchDrawing();
    } catch (err) {
      console.error('Failed to save checklist:', err);
      alert(err.response?.data?.message || 'Failed to save checklist');
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveDrawing = async () => {
    if (!currentRevision) return;
    setActionLoading(true);
    try {
      await api.post(`/drawings/${id}/approve`, {
        revisionNumber: currentRevision.revisionNumber,
        comments: approvalComments
      });
      showToast(`Drawing approved (${currentRevision.revisionLabel})! Production Work Order gate is unlocked.`);
      setIsApproveModalOpen(false);
      setApprovalComments('');
      await fetchDrawing();
    } catch (err) {
      console.error('Failed to approve drawing:', err);
      alert(err.response?.data?.message || 'Failed to approve drawing');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectDrawing = async () => {
    if (!currentRevision || !rejectReason.trim()) {
      alert('Please provide a mandatory reason for revision request.');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/drawings/${id}/reject`, {
        revisionNumber: currentRevision.revisionNumber,
        reason: rejectReason,
        decision: 'REVISION_REQUESTED'
      });
      showToast('Revision requested with feedback.');
      setIsRejectModalOpen(false);
      setRejectReason('');
      await fetchDrawing();
    } catch (err) {
      console.error('Failed to request revision:', err);
      alert(err.response?.data?.message || 'Failed to request revision');
    } finally {
      setActionLoading(false);
    }
  };

  const handleEscalateToDirector = async () => {
    if (!window.confirm('Are you sure you want to escalate this drawing delay directly to the Director?')) return;
    try {
      await api.post(`/drawings/${id}/escalate`, {
        reason: 'Manual delay escalation triggered by TDS engineer'
      });
      showToast('Drawing delay successfully escalated to Director!');
      await fetchDrawing();
    } catch (err) {
      console.error('Failed to escalate drawing:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-500 mb-3" />
        Loading drawing details...
      </div>
    );
  }

  if (!drawing) {
    return (
      <div className="p-12 text-center text-slate-400 font-medium">
        <FileCode2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        Drawing not found.
      </div>
    );
  }

  const isApproved = drawing.status === 'APPROVED';

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl text-xs font-bold animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Breadcrumb & Navigation */}
      <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
        <button 
          onClick={() => navigate('/app/drawings')} 
          className="hover:text-brand-600 flex items-center gap-1 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Drawings
        </button>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-800 font-mono">{drawing.drawingId}</span>
      </div>

      {/* Main Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3.5 bg-brand-50 rounded-2xl text-brand-600 border border-brand-100 shadow-2xs shrink-0">
            <FileCode2 className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight font-mono">{drawing.drawingId}</h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200">
                {drawing.drawingNumber}
              </span>
              {isApproved ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> APPROVED ({drawing.activeApprovedRevision?.revisionLabel})
                </span>
              ) : drawing.isEscalated ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                  <AlertTriangle className="w-3 h-3 text-rose-600" /> ESCALATED
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                  <Clock className="w-3 h-3 text-blue-600" /> {drawing.status?.replace('_', ' ')}
                </span>
              )}
            </div>

            <p className="text-sm font-semibold text-slate-700 mt-1">{drawing.drawingTitle}</p>

            <div className="flex items-center gap-4 mt-2 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> {drawing.customer?.companyName}
              </span>
              {drawing.quotation && (
                <span className="flex items-center gap-1.5 font-mono text-brand-600">
                  <FileText className="w-3.5 h-3.5" /> Quotation: {drawing.quotation.quotationId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer shadow-2xs"
          >
            <Upload className="w-3.5 h-3.5" /> Upload Revision
          </button>

          {!isApproved && (
            <>
              <button
                onClick={() => setIsRejectModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200 transition-all cursor-pointer shadow-2xs"
              >
                <XCircle className="w-3.5 h-3.5 text-amber-600" /> Request Revision
              </button>

              <button
                onClick={() => setIsApproveModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md transition-all cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" /> Approve Drawing
              </button>
            </>
          )}

          {!drawing.isEscalated && (
            <button
              onClick={handleEscalateToDirector}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
              title="Escalate delay to Director"
            >
              <AlertTriangle className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Revision Switcher Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-3 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-400 uppercase tracking-wider px-2">Revisions:</span>
          {drawing.revisions?.map((rev, idx) => {
            const isSelected = selectedRevisionIdx === idx;
            const isRevApproved = rev.status === 'APPROVED';

            return (
              <button
                key={rev.revisionNumber}
                onClick={() => handleRevisionSelect(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-brand-600 text-white shadow-xs'
                    : isRevApproved
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span>{rev.revisionLabel}</span>
                {isRevApproved && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
              </button>
            );
          })}
          {drawing.revisions?.length === 0 && (
            <span className="text-xs font-medium text-slate-400 italic">No revisions uploaded yet.</span>
          )}
        </div>

        {currentRevision?.fileUrl && (
          <a
            href={currentRevision.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-brand-600 hover:text-brand-800 px-3 py-1 bg-brand-50 rounded-xl transition-colors shrink-0"
          >
            <Download className="w-3.5 h-3.5" /> View / Download ({currentRevision.fileName})
          </a>
        )}
      </div>

      {/* Tabs Switcher */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('specs')}
          className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'specs' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> 1. AI Specifications Matrix
          </div>
        </button>
        <button
          onClick={() => setActiveTab('checklist')}
          className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'checklist' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> 2. TDS Technical Checklist ({checklistData.filter(c => c.status === 'PASS').length}/{checklistData.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('revisions')}
          className={`pb-3 text-xs font-bold border-b-2 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === 'revisions' ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4" /> 3. Revision History Timeline
          </div>
        </button>
      </div>

      {/* TAB 1: AI SPECIFICATIONS MATRIX */}
      {activeTab === 'specs' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Extracted Drawing Specifications ({currentRevision?.revisionLabel || 'Rev 00'})</h3>
                <p className="text-xs text-slate-500">Parameters extracted from technical drawing and verified against quotation requirements.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-400">Valve Type</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {currentRevision?.extractedParameters?.valveType?.value || drawing.requirements?.valveType || 'Ball Valve'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-400">Nominal Size (NPS / DN)</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {currentRevision?.extractedParameters?.size?.value || drawing.requirements?.size || '100 mm (4")'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-400">Pressure Class</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {currentRevision?.extractedParameters?.pressureClass?.value || drawing.requirements?.pressureClass || 'Class 150'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-400">Body Material (MOC)</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {currentRevision?.extractedParameters?.bodyMaterial?.value || drawing.requirements?.material || 'ASTM A216 WCB'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-400">Design Standard</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {currentRevision?.extractedParameters?.designStandard?.value || drawing.requirements?.designStandard || 'API 6D / ASME B16.34'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-[11px] font-bold uppercase text-slate-400">End Connection</p>
                <p className="text-sm font-bold text-slate-800 mt-1">
                  {currentRevision?.extractedParameters?.endConnection?.value || drawing.requirements?.endConnection || 'Flanged RF'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: TDS TECHNICAL CHECKLIST */}
      {activeTab === 'checklist' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">TDS Technical Verification Checklist</h3>
                <p className="text-xs text-slate-500">Validate compliance before official drawing sign-off.</p>
              </div>

              <button
                onClick={handleSaveChecklist}
                disabled={actionLoading}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                Save Checklist Changes
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-3 px-4">Check Category & Description</th>
                    <th className="py-3 px-4">Expected (Quotation)</th>
                    <th className="py-3 px-4">Actual (Drawing)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {checklistData.map((item, idx) => (
                    <tr key={item.code} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <span className="text-[10px] uppercase font-bold text-brand-600 block">{item.category}</span>
                        {item.checkName}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">{item.expectedValue || '-'}</td>
                      <td className="py-3 px-4 text-slate-800 font-bold">{item.actualValue || '-'}</td>
                      <td className="py-3 px-4">
                        <select
                          value={item.status}
                          onChange={(e) => {
                            const updated = [...checklistData];
                            updated[idx].status = e.target.value;
                            setChecklistData(updated);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold border outline-none cursor-pointer ${
                            item.status === 'PASS' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                              : item.status === 'FAIL' 
                                ? 'bg-rose-50 text-rose-800 border-rose-300' 
                                : 'bg-slate-50 text-slate-700 border-slate-300'
                          }`}
                        >
                          <option value="PASS">✓ PASS</option>
                          <option value="FAIL">✗ FAIL</option>
                          <option value="PENDING">⌛ PENDING</option>
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <input
                          type="text"
                          value={item.remarks || ''}
                          placeholder="Add verification notes..."
                          onChange={(e) => {
                            const updated = [...checklistData];
                            updated[idx].remarks = e.target.value;
                            setChecklistData(updated);
                          }}
                          className="w-full px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:bg-white focus:border-brand-500"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MULTI-REVISION HISTORY TIMELINE */}
      {activeTab === 'revisions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Multi-Revision History & Immutability Trail</h3>
            <p className="text-xs text-slate-500">Every revision is timestamped and archived. Production uses the latest approved revision only.</p>

            <div className="relative border-l-2 border-slate-200 ml-4 pl-6 space-y-6 my-6">
              {drawing.revisions?.map((rev, idx) => {
                const isApprovedRev = rev.status === 'APPROVED';
                return (
                  <div key={rev.revisionNumber} className="relative">
                    <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 bg-white ${
                      isApprovedRev ? 'border-emerald-500 bg-emerald-50' : 'border-brand-500'
                    }`} />
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-slate-900">{rev.revisionLabel}</span>
                          {isApprovedRev && (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded">
                              ✓ ACTIVE APPROVED REVISION (USED FOR W/O RELEASE)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400 font-medium">
                          {new Date(rev.submittedAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 font-medium">{rev.comments || 'No revision notes recorded.'}</p>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs text-slate-500">
                        <span>Submitted by: {rev.submittedBy?.name || 'Customer / Inbound Bot'}</span>
                        <a 
                          href={rev.fileUrl} 
                          target="_blank" 
                          rel="noreferrer"
                          className="font-bold text-brand-600 hover:text-brand-800"
                        >
                          Download {rev.fileName}
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* UPLOAD REVISION MODAL */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-bold text-slate-900">Upload New Drawing Revision</h3>
            <p className="text-xs text-slate-500">Upload engineering drawing (.pdf, .dwg, .dxf) for TDS review.</p>

            <form onSubmit={handleUploadNewRevision} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Drawing File (.pdf, .dwg, .dxf)</label>
                <input
                  type="file"
                  required
                  accept=".pdf,.dwg,.dxf"
                  onChange={(e) => setUploadFile(e.target.files[0])}
                  className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Revision Comments & Changes</label>
                <textarea
                  rows={3}
                  value={uploadComments}
                  onChange={(e) => setUploadComments(e.target.value)}
                  placeholder="e.g. Corrected flange thickness and updated face-to-face dimensions."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
                >
                  Upload & Submit for Review
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* APPROVE DRAWING MODAL */}
      {isApproveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900">Approve Technical Drawing</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Approving revision <strong>{currentRevision?.revisionLabel}</strong> will freeze this version as the official technical baseline and <strong>unlock the production Work Order release gate</strong>.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Approval Notes (Optional)</label>
              <textarea
                rows={2}
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder="e.g. Dimensions and MOC fully verified against client RFQ."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsApproveModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveDrawing}
                disabled={actionLoading}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Confirm Approval & Unlock Gate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT / REQUEST REVISION MODAL */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95">
            <h3 className="text-lg font-black text-slate-900">Request Drawing Revision</h3>
            <p className="text-xs text-slate-600">Provide detailed feedback explaining what parameters must be corrected.</p>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Mandatory Feedback Reason *</label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Flange standard should be ASME B16.5 Class 300, not Class 150."
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:bg-white focus:border-brand-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectDrawing}
                disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
              >
                Submit Revision Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
