import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2, ArrowLeft, Save, Trash2, Download, CheckCircle2,
  AlertTriangle, Trophy, XCircle, PauseCircle, Flag,
  UserCheck, Tag, CalendarDays, ChevronDown, Pencil, X, FileCheck
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import AutocompleteSelect from '../components/AutocompleteSelect';
import FollowUpPanel from '../components/FollowUpPanel';
import TaskPanel from '../components/TaskPanel';
import AttachmentManager from '../components/AttachmentManager';

const PRIORITY_CONFIG = {
  Urgent: { color: 'bg-red-100 text-red-700 border-red-200',    dot: 'bg-red-500'   },
  High:   { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  Medium: { color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  Low:    { color: 'bg-slate-100 text-slate-600 border-slate-200',   dot: 'bg-slate-400' },
};

const STATUS_CONFIG = {
  'New':              { color: 'bg-blue-100 text-blue-700',       label: 'New'              },
  'Confirmed':        { color: 'bg-violet-100 text-violet-700',   label: 'Confirmed'        },
  'Contacted':        { color: 'bg-violet-100 text-violet-700',   label: 'Contacted'        },
  'Technical Review': { color: 'bg-cyan-100 text-cyan-700',       label: 'Technical Review' },
  'Ready for Offer':  { color: 'bg-teal-100 text-teal-700',       label: 'Ready for Offer'  },
  'Quoted':           { color: 'bg-purple-100 text-purple-700',   label: 'Quoted'           },
  'Negotiating':      { color: 'bg-indigo-100 text-indigo-700',   label: 'Negotiating'      },
  'Won':              { color: 'bg-emerald-100 text-emerald-700', label: 'Won ✓'            },
  'Lost':             { color: 'bg-red-100 text-red-700',         label: 'Lost'             },
  'On Hold':          { color: 'bg-amber-100 text-amber-700',     label: 'On Hold'          },
  'Abandoned':        { color: 'bg-slate-100 text-slate-500',     label: 'Abandoned'        },
  'Needs Review':     { color: 'bg-rose-100 text-rose-700 border-rose-200', label: 'Needs Review' },
  'Verified':         { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Verified' },
};

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
    type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
  }`}>
    {type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
    {msg}
  </div>
);

const SourceTypeBadge = ({ sourceType }) => {
  const config = {
    'Tender': { bg: 'bg-amber-50', text: 'text-amber-800', ring: 'ring-amber-500/30', icon: '📋' },
    'Direct Enquiry': { bg: 'bg-blue-50', text: 'text-blue-700', ring: 'ring-blue-500/20', icon: '📩' },
    'Follow-up Reply': { bg: 'bg-violet-50', text: 'text-violet-700', ring: 'ring-violet-500/20', icon: '↩️' },
    'Manual Entry': { bg: 'bg-slate-50', text: 'text-slate-600', ring: 'ring-slate-500/20', icon: '✏️' },
  };
  const c = config[sourceType] || config['Direct Enquiry'];
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${c.bg} ${c.text} ${c.ring}`}>
      {c.icon} {sourceType || 'Direct Enquiry'}
    </span>
  );
};

const EnquiryDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [enquiry, setEnquiry]       = useState(null);
  const [users, setUsers]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [dynamicValues, setDynamicValues] = useState({});
  const [toast, setToast]           = useState(null);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editForm, setEditForm]     = useState({});
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const statusRef  = useRef(null);
  const priorityRef = useRef(null);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');
  const [threadEmails, setThreadEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('emails');

  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isHighAuth  = ['SA', 'SUPER_ADMIN', 'DIR', 'DIRECTOR'].includes(currentUser.role);
  const isSales     = ['SALES'].includes(currentUser.role);
  const canEdit     = isHighAuth || isSales || enquiry?.assignedTo?._id === currentUser.id;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e) => {
      if (statusRef.current && !statusRef.current.contains(e.target)) setShowStatusMenu(false);
      if (priorityRef.current && !priorityRef.current.contains(e.target)) setShowPriorityMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const enqRes = await api.get(`/enquiries/${id}`);
        if (enqRes.data.data?.enquiry) setEnquiry(enqRes.data.data.enquiry);
        api.get('/auth/users')
          .then(res => { if (res.data.data?.users) setUsers(res.data.data.users); })
          .catch(() => {});
      } catch (err) {
        console.error('Failed to fetch enquiry', err);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchData();
  }, [id]);

  useEffect(() => {
    if (enquiry?.dynamicFields) setDynamicValues(enquiry.dynamicFields);
  }, [enquiry]);

  useEffect(() => {
    const fetchEmails = async () => {
      setEmailsLoading(true);
      try {
        const res = await api.get(`/enquiries/${id}/thread-emails`);
        if (res.data?.data?.emails) {
          setThreadEmails(res.data.data.emails);
        }
      } catch (err) {
        console.error('Failed to fetch thread emails', err);
      } finally {
        setEmailsLoading(false);
      }
    };
    if (id && enquiry?.threadId) {
      fetchEmails();
    }
  }, [id, enquiry?.threadId]);

  const handleVerifyAndApprove = async () => {
    setSaving(true);
    try {
      const payload = {
        updatedFields: {
          ...dynamicValues,
          productCategory: enquiry.productCategory,
          productDescription: enquiry.productDescription,
          quantity: enquiry.quantity,
          unit: enquiry.unit,
          standardCode: enquiry.standardCode,
          requiredDeliveryWeeks: enquiry.requiredDeliveryWeeks,
          budgetFrom: enquiry.budgetFrom,
          budgetTo: enquiry.budgetTo,
          specialRequirements: enquiry.specialRequirements,
          thirdPartyInspection: enquiry.thirdPartyInspection,
        },
        reviewNotes
      };
      const res = await api.patch(`/enquiries/${id}/verify-approve`, payload);
      setEnquiry(res.data.data.enquiry);
      setShowVerifyModal(false);
      showToast('Enquiry successfully verified and approved!');
    } catch (err) {
      showToast(err.response?.data?.message || 'Verification failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (field, value) => {
    setSaving(true);
    try {
      const res = await api.patch(`/enquiries/${id}`, { [field]: value });
      setEnquiry(res.data.data.enquiry);
      showToast(`${field} updated`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── Status actions ───────────────────────────────────────────────────────
  const markStatus = async (status) => {
    setShowStatusMenu(false);
    await handleUpdate('status', status);
  };

  // ─── Priority actions ─────────────────────────────────────────────────────
  const markPriority = async (priority) => {
    setShowPriorityMenu(false);
    await handleUpdate('priority', priority);
  };

  // ─── Delete / Archive ─────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!confirm(`Archive enquiry ${enquiry.enquiryId}? This action cannot be undone.`)) return;
    setSaving(true);
    try {
      await api.delete(`/enquiries/${id}`);
      showToast('Enquiry archived');
      setTimeout(() => navigate('/app/enquiries'), 1200);
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
      setSaving(false);
    }
  };

  // ─── Export ───────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ['Field', 'Value'],
      ['Enquiry ID', enquiry.enquiryId],
      ['Customer', enquiry.customer?.companyName || ''],
      ['Contact', enquiry.customer?.primaryContactName || ''],
      ['Mobile', enquiry.customer?.mobileNumber || ''],
      ['Email', enquiry.customer?.emailAddress || ''],
      ['Product Category', enquiry.productCategory || ''],
      ['Description', enquiry.productDescription || ''],
      ['Quantity', enquiry.quantity || ''],
      ['Unit', enquiry.unit || ''],
      ['Source Channel', enquiry.sourceChannel || ''],
      ['Status', enquiry.status || ''],
      ['Priority', enquiry.priority || ''],
      ['Assigned To', enquiry.assignedTo?.name || ''],
      ['Created At', new Date(enquiry.createdAt).toLocaleString('en-IN')],
      ...Object.entries(enquiry.dynamicFields || {}).map(([k, v]) => [k, v]),
    ];

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${enquiry.enquiryId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported to CSV');
  };

  // ─── Edit Panel ───────────────────────────────────────────────────────────
  const openEdit = () => {
    setEditForm({
      productCategory:    enquiry.productCategory    || 'Pressure Vessel',
      productDescription: enquiry.productDescription || '',
      quantity:           enquiry.quantity           || 1,
      unit:               enquiry.unit               || 'NOS',
      sourceChannel:      enquiry.sourceChannel      || 'Email',
      sourceType:         enquiry.sourceType         || 'Direct Enquiry',
      tenderNumber:       enquiry.tenderNumber       || '',
      tenderDeadline:     enquiry.tenderDeadline ? new Date(enquiry.tenderDeadline).toISOString().split('T')[0] : '',
      indiaMartLeadId:    enquiry.indiaMartLeadId    || '',
      leadGenuineness:    enquiry.leadGenuineness    || 'Likely Genuine',
      indiaMartContactMethod: enquiry.indiaMartContactMethod || 'Call',
      detailsSharedByLead: enquiry.detailsSharedByLead || false,
      internalNotes:      enquiry.internalNotes      || '',
      standardCode:       enquiry.standardCode       || 'Not specified',
      requiredDeliveryWeeks: enquiry.requiredDeliveryWeeks || '',
      budgetFrom:         enquiry.budgetFrom         || '',
      budgetTo:           enquiry.budgetTo           || '',
      specialRequirements: enquiry.specialRequirements || '',
      thirdPartyInspection: enquiry.thirdPartyInspection || false,
      estimatedValue:     enquiry.estimatedValue     || '',
    });
    setShowEditPanel(true);
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...editForm };
      if (payload.sourceType !== 'Tender') {
        payload.tenderNumber = undefined;
        payload.tenderDeadline = undefined;
      } else if (!payload.tenderDeadline) {
        payload.tenderDeadline = undefined;
      }
      const res = await api.patch(`/enquiries/${id}`, payload);
      setEnquiry(res.data.data.enquiry);
      setShowEditPanel(false);
      showToast('Enquiry updated!');
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveDynamicFields = async () => {
    setSaving(true);
    try {
      const res = await api.patch(`/enquiries/${id}`, { dynamicFields: dynamicValues });
      setEnquiry(res.data.data.enquiry);
      showToast('Custom fields saved');
    } catch (err) {
      showToast('Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
    </div>
  );

  if (!enquiry) return (
    <div className="p-8 text-center text-slate-500">Enquiry not found.</div>
  );

  const statusCfg   = STATUS_CONFIG[enquiry.status]   || STATUS_CONFIG['New'];
  const priorityCfg = PRIORITY_CONFIG[enquiry.priority] || PRIORITY_CONFIG['Medium'];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500 text-slate-900">
      {toast && <Toast {...toast} />}

      {/* Background Processing Progress Banner */}
      {enquiry.processingStatus && ['Pending', 'Processing'].includes(enquiry.processingStatus) && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between shadow-sm animate-pulse">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-brand-500 animate-spin" />
            <div>
              <h3 className="text-sm font-bold text-blue-800">
                {enquiry.processingStatus === 'Pending' ? 'Pending Processing...' : 'AI Processing In Progress...'}
              </h3>
              <p className="text-xs text-blue-600 mt-0.5">
                {enquiry.processingMessage || 'The system is analyzing the enquiry, extracting specifications, and calculating confidence.'}
              </p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 border border-brand-200 px-2.5 py-1 rounded-full shrink-0">
            Background Queue
          </span>
        </div>
      )}

      {/* Warning Banner for Unverified/Needs Review Enquiry */}
      {(enquiry.isUnverified || enquiry.status === 'Needs Review') && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-rose-800 animate-pulse">Unverified Enquiry Extraction</h3>
            <p className="text-xs text-rose-600 mt-1">
              This enquiry was automatically extracted by AI with low confidence (Confidence: {enquiry.extractionConfidence ? `${enquiry.extractionConfidence}%` : 'Low'}). Please verify specifications, edit any incorrect fields, and click "Verify & Approve" to validate this enquiry.
            </p>
            <div className="mt-3">
              <button
                onClick={() => setShowVerifyModal(true)}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-500/20"
              >
                Verify & Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back to List</span>
      </div>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{enquiry.enquiryId}</h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            {enquiry.customer?.companyName || 'Unknown'} • {enquiry.productCategory || 'N/A'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Status Badge + Dropdown */}
            <div className="relative" ref={statusRef}>
              <button
                onClick={() => canEdit && setShowStatusMenu(!showStatusMenu)}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusCfg.color} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {statusCfg.label}
                {canEdit && <ChevronDown className="w-3 h-3" />}
              </button>
              {showStatusMenu && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-xl border border-slate-200 w-44 py-1 animate-in slide-in-from-top-1">
                  {[
                    { v: 'Needs Review',     icon: AlertTriangle, label: 'Needs Review',   cls: 'text-rose-600' },
                    { v: 'New',              icon: Tag,          label: 'New' },
                    { v: 'Confirmed',        icon: UserCheck,    label: 'Confirmed',     cls: 'text-violet-600' },
                    { v: 'Technical Review', icon: CheckCircle2, label: 'Technical Review' },
                    { v: 'Quoted',           icon: Flag,         label: 'Quoted' },
                    { v: 'Negotiating',      icon: Flag,         label: 'Negotiating',  cls: 'text-indigo-600' },
                    { v: 'Won',              icon: Trophy,       label: 'Won ✓',        cls: 'text-emerald-600' },
                    { v: 'Lost',             icon: XCircle,      label: 'Lost',         cls: 'text-red-600' },
                    { v: 'On Hold',          icon: PauseCircle,  label: 'On Hold',      cls: 'text-amber-600' },
                    { v: 'Abandoned',        icon: AlertTriangle, label: 'Abandoned',   cls: 'text-slate-500' },
                  ].map(s => (
                    <button key={s.v} onClick={() => markStatus(s.v)}
                      className={`flex items-center gap-2 w-full px-4 py-2.5 text-sm font-bold hover:bg-slate-50 ${s.cls || 'text-slate-700'} ${enquiry.status === s.v ? 'bg-brand-50' : ''}`}>
                      <s.icon className="w-4 h-4" /> {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Priority Badge + Dropdown */}
            <div className="relative" ref={priorityRef}>
              <button
                onClick={() => canEdit && setShowPriorityMenu(!showPriorityMenu)}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${priorityCfg.color} ${canEdit ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                {enquiry.priority || 'Medium'}
                {canEdit && <ChevronDown className="w-3 h-3" />}
              </button>
              {showPriorityMenu && (
                <div className="absolute top-full mt-1 left-0 z-20 bg-white rounded-xl shadow-xl border border-slate-200 w-36 py-1 animate-in slide-in-from-top-1">
                  {['Urgent', 'High', 'Medium', 'Low'].map(p => (
                    <button key={p} onClick={() => markPriority(p)}
                      className={`flex items-center gap-2.5 w-full px-4 py-2.5 text-sm font-bold hover:bg-slate-50 ${enquiry.priority === p ? 'bg-brand-50 text-brand-700' : 'text-slate-700'}`}>
                      <span className={`w-2 h-2 rounded-full ${PRIORITY_CONFIG[p].dot}`} /> {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Source Type Badge */}
            <SourceTypeBadge sourceType={enquiry.sourceType} />

            {/* Confidence Badge */}
            {enquiry.extractionConfidence !== undefined && (
              <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full border ${
                enquiry.extractionConfidence >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                enquiry.extractionConfidence >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                🎯 AI Confidence: {enquiry.extractionConfidence}%
              </span>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 flex-wrap justify-start sm:justify-end w-full sm:w-auto">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}

          {/* Group 1: Assignment & Creation */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Assign */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center overflow-visible">
              <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-wider">Assign</div>
              <AutocompleteSelect
                disabled={!isHighAuth}
                options={[
                  { value: '', label: 'Unassigned' },
                  ...users.map(u => ({
                    value: u._id,
                    label: `${u.fullName || u.name}`,
                    group: u.department || 'Other'
                  }))
                ]}
                value={enquiry.assignedTo?._id || ''}
                onChange={v => handleUpdate('assignedTo', v)}
                placeholder="Assign to user..."
                allowClear={false}
                className="w-48"
              />
            </div>

            <button
              onClick={() => navigate(`/app/quotations?createForEnquiry=${enquiry._id}`)}
              disabled={!['Confirmed', 'Technical Review', 'Ready for Offer', 'Verified'].includes(enquiry.status)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-sm font-bold transition-all ${
                ['Confirmed', 'Technical Review', 'Ready for Offer', 'Verified'].includes(enquiry.status)
                  ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer'
                  : 'bg-slate-300 cursor-not-allowed opacity-60'
              }`}
              title={!['Confirmed', 'Technical Review', 'Ready for Offer', 'Verified'].includes(enquiry.status) ? "Quotation generation is blocked. Status must be 'Confirmed' or 'Technical Review'." : "Create Quotation"}
            >
              <FileCheck className="w-3.5 h-3.5" /> Create Quotation
            </button>
          </div>

          {/* Group 2: Management Operations */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={openEdit} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}

            <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold transition-all">
              <Download className="w-3.5 h-3.5" /> Export
            </button>

            {isHighAuth && (
              <button onClick={handleDelete} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl text-sm font-bold transition-all">
                <Trash2 className="w-3.5 h-3.5" /> Archive
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Grid ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Core Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-bold mb-5 tracking-tight">Enquiry Details</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6 text-sm">
              {[
                ['Product Category',  enquiry.productCategory],
                ['Description',       enquiry.productDescription],
                ['Quantity',          `${enquiry.quantity} ${enquiry.unit || 'NOS'}`],
                ['Source Channel',    enquiry.sourceChannel],
                ['Source Type',       enquiry.sourceType || 'Direct Enquiry'],
                ...(enquiry.sourceType === 'Tender' ? [
                  ['Tender Number',   enquiry.tenderNumber || '—'],
                  ['Tender Deadline', enquiry.tenderDeadline ? new Date(enquiry.tenderDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—']
                ] : []),
                ...(enquiry.productCategory === 'Piping' ? [
                  ['Valve Type',      enquiry.dynamicFields?.valve_type || '—'],
                  ['Valve Size',      enquiry.dynamicFields?.valve_size ? `${enquiry.dynamicFields.valve_size} mm` : '—'],
                  ['Pressure Class',  enquiry.dynamicFields?.valve_class || '—']
                ] : []),
                ...(enquiry.sourceChannel === 'IndiaMart' ? [
                  ['IndiaMart Lead ID', enquiry.indiaMartLeadId || '—'],
                  ['Lead Genuineness', enquiry.leadGenuineness || '—'],
                  ['Contact Method', enquiry.indiaMartContactMethod || '—'],
                  ['Details Shared?', enquiry.detailsSharedByLead ? 'Yes' : 'No'],
                  ['Days Since Lead', enquiry.createdAt ? Math.floor((Date.now() - new Date(enquiry.createdAt)) / (1000 * 60 * 60 * 24)) + ' days' : '—']
                ] : []),
                ['Standard/Code',     enquiry.standardCode || '—'],
                ['Delivery',          enquiry.requiredDeliveryWeeks ? `${enquiry.requiredDeliveryWeeks} wks` : '—'],
                ['Budget',            enquiry.budgetFrom ? `₹${enquiry.budgetFrom} - ₹${enquiry.budgetTo}` : '—'],
                ['TPI Req.',          enquiry.thirdPartyInspection ? 'Yes' : 'No'],
                ['Special Req.',      enquiry.specialRequirements || '—'],
                ['Created',           new Date(enquiry.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })],
                ['Next Follow-up',    enquiry.nextFollowUpDate ? new Date(enquiry.nextFollowUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—'],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                  <p className="font-semibold text-slate-800">{value || '—'}</p>
                </div>
              ))}
              {enquiry.internalNotes && (
                <div className="col-span-full">
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Internal Notes</p>
                  <p className="font-medium text-slate-700 whitespace-pre-wrap">{enquiry.internalNotes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Individual Products List */}
          {enquiry.products && enquiry.products.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-base font-black text-slate-900 mb-4 tracking-tight flex items-center gap-2">
                <Tag className="w-5 h-5 text-brand-500" />
                Line Items ({enquiry.products.length})
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <th className="pb-3 pr-4 w-10">#</th>
                      <th className="pb-3 pr-4">Product Description</th>
                      <th className="pb-3 pr-4">Category</th>
                      <th className="pb-3 pr-4">Quantity</th>
                      <th className="pb-3 pr-4">Standard</th>
                      {enquiry.isUnverified && <th className="pb-3 text-right">Confidence</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {enquiry.products.map((prod, idx) => (
                      <tr key={prod._id || idx} className="text-slate-700 hover:bg-slate-50/50 transition-colors">
                        <td className="py-3.5 font-bold pr-4 text-slate-400">{idx + 1}</td>
                        <td className="py-3.5 font-semibold pr-4 text-slate-900">{prod.description}</td>
                        <td className="py-3.5 pr-4">
                          <span className="inline-flex items-center rounded-md bg-slate-50 border border-slate-200 px-2 py-0.5 text-xs font-bold text-slate-600">
                            {prod.category || enquiry.productCategory}
                          </span>
                        </td>
                        <td className="py-3.5 font-black pr-4 text-brand-600">{prod.quantity} {prod.unit || 'NOS'}</td>
                        <td className="py-3.5 pr-4 text-slate-500 font-semibold">{prod.standardCode || 'Not specified'}</td>
                        {enquiry.isUnverified && (
                          <td className="py-3.5 text-right font-bold pr-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              (prod.confidence || 100) >= 80 ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                              (prod.confidence || 100) >= 50 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-rose-100 text-rose-700 border border-rose-200'
                            }`}>
                              {prod.confidence || 100}%
                            </span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Customer Info */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-bold mb-5 tracking-tight">Customer Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6 text-sm">
              {[
                ['Company',  enquiry.customer?.companyName],
                ['Contact',  enquiry.customer?.primaryContactName],
                ['Mobile',   enquiry.customer?.mobileNumber],
                ['Email',    enquiry.customer?.emailAddress],
                ['City',     enquiry.customer?.city],
                ['GSTIN',    enquiry.customer?.gstin],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
                  <p className="font-semibold text-slate-800">{value || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Fields */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold tracking-tight">Custom Fields</h2>
              <button onClick={saveDynamicFields} disabled={saving}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-60">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save Fields
              </button>
            </div>
            <DynamicFormRenderer
              formContext="Enquiry"
              values={{ productCategory: enquiry.productCategory, sourceChannel: enquiry.sourceChannel, standardCode: enquiry.standardCode, ...dynamicValues }}
              onChange={(fieldName, value) => setDynamicValues(prev => ({ ...prev, [fieldName]: value }))}
              readOnly={false}
              currentUserRole={currentUser.role}
            />
          </div>
          
          {/* Attachments & Files */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <h2 className="text-base font-bold mb-5 tracking-tight">Attachments & Files</h2>
            <AttachmentManager 
              moduleName="Enquiry"
              entityId={id}
              uploadedFiles={[...(enquiry.attachments || []), ...(enquiry.files || [])]}
              onUploadComplete={(newFile) => {
                 setEnquiry(prev => ({ ...prev, files: [...(prev.files || []), newFile] }));
                 handleUpdate('files', [...(enquiry.files || []).map(f => f._id || f), newFile._id]);
              }}
              readOnly={!canEdit}
            />
          </div>

          {/* Governance & Audit Section (Tabs) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mt-6">
            <div className="flex border-b border-slate-200 bg-slate-50/50">
              {[
                { id: 'emails', label: 'Email Thread' },
                { id: 'ocr', label: 'Extracted OCR Text' },
                { id: 'history', label: 'Review Audit History' },
                { id: 'versions', label: 'Document Versions' }
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  type="button"
                  className={`px-5 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${
                    activeTab === t.id
                      ? 'border-brand-600 text-brand-600 bg-white'
                      : 'border-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* Email Thread Tab */}
              {activeTab === 'emails' && (
                <div className="space-y-4">
                  {emailsLoading && <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto" />}
                  {!emailsLoading && threadEmails.length === 0 && (
                    <p className="text-sm text-slate-400 text-center py-6">No raw email messages archived for this thread.</p>
                  )}
                  {!emailsLoading && threadEmails.map((email, idx) => (
                    <div key={email._id || idx} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="px-5 py-4 bg-slate-100/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-bold text-slate-800">{email.subject}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            From: <span className="font-semibold">{email.sender}</span>
                          </p>
                        </div>
                        <span className="text-xs font-bold text-slate-400">
                          {new Date(email.receivedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </span>
                      </div>
                      <div className="p-5 text-sm text-slate-700 whitespace-pre-wrap font-sans max-h-96 overflow-y-auto bg-white">
                        {email.bodyText || '(No plain text body content)'}
                      </div>
                      {email.attachments && email.attachments.length > 0 && (
                        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2">
                          <span className="text-xs font-black text-slate-400 uppercase tracking-wider shrink-0 mt-1.5">Email Attachments:</span>
                          {email.attachments.map(att => (
                            <a
                              key={att._id}
                              href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/files/download-local/${att.storagePath}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-bold text-slate-700 transition-all"
                            >
                              <Download className="w-3 h-3 text-slate-400" />
                              {att.originalFileName} ({att.attachmentCategory})
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* OCR Extracted Text Tab */}
              {activeTab === 'ocr' && (
                <div className="space-y-4">
                  {(!enquiry.attachmentsList || enquiry.attachmentsList.length === 0) ? (
                    <p className="text-sm text-slate-400 text-center py-6">No parsed attachments found on this enquiry.</p>
                  ) : (
                    enquiry.attachmentsList.map((att, idx) => (
                      <div key={att._id || idx} className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
                        <div className="px-5 py-4 bg-slate-100/50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm font-bold text-slate-800">{att.originalFileName}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">
                              Category: <span className="font-semibold text-brand-600">{att.attachmentCategory}</span> • Owner: <span className="font-semibold text-slate-600">{att.attachmentOwnerType}</span>
                            </p>
                          </div>
                          {att.ocrConfidence !== undefined && (
                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                              att.ocrConfidence >= 80 ? 'bg-emerald-100 text-emerald-700' :
                              att.ocrConfidence >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                            }`}>
                              OCR Conf: {att.ocrConfidence}%
                            </span>
                          )}
                        </div>
                        <div className="p-5">
                          <label className="block text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Extracted Specifications & Text</label>
                          <textarea
                            readOnly
                            rows={6}
                            value={att.extractedText || 'No text extracted or OCR not run for this file type.'}
                            className="w-full p-4 bg-white border border-slate-200 rounded-xl text-sm font-mono focus:outline-none resize-y"
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Audit History Tab */}
              {activeTab === 'history' && (
                <div className="space-y-4">
                  {(!enquiry.reviewHistory || enquiry.reviewHistory.length === 0) ? (
                    <p className="text-sm text-slate-400 text-center py-6">No manual review or verification history recorded.</p>
                  ) : (
                    enquiry.reviewHistory.map((hist, idx) => (
                      <div key={hist._id || idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <span className="text-sm font-bold text-slate-800">
                            Reviewed by {hist.reviewedBy?.fullName || 'System User'}
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">
                            {new Date(hist.reviewedAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-1">Notes / Remarks</p>
                          <p className="text-sm text-slate-700 italic bg-white p-3 rounded-xl border border-slate-100">"{hist.reviewNotes}"</p>
                        </div>
                        {hist.oldValues && Object.keys(hist.newValues || {}).length > 0 && (
                          <div>
                            <p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Specifications Modified</p>
                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                              <div className="grid grid-cols-3 gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider px-4 py-2 bg-slate-50">
                                <span>Specification</span>
                                <span>Original Value</span>
                                <span>Verified Value</span>
                              </div>
                              {Object.keys(hist.newValues).map(key => {
                                const oldVal = typeof hist.oldValues[key] === 'object' ? JSON.stringify(hist.oldValues[key]) : hist.oldValues[key];
                                const newVal = typeof hist.newValues[key] === 'object' ? JSON.stringify(hist.newValues[key]) : hist.newValues[key];
                                return (
                                  <div key={key} className="grid grid-cols-3 gap-2 text-xs px-4 py-2.5 items-center">
                                    <span className="font-bold text-slate-600">{key}</span>
                                    <span className="text-red-500 line-through truncate">{String(oldVal ?? '—')}</span>
                                    <span className="text-emerald-600 font-semibold truncate">{String(newVal ?? '—')}</span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-400">
                          <span>Confidence Before: {hist.confidenceBefore ? `${hist.confidenceBefore}%` : 'N/A'}</span>
                          <span>Confidence After: {hist.confidenceAfter ? `${hist.confidenceAfter}%` : '100%'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Document Versions Tab */}
              {activeTab === 'versions' && (
                <div className="space-y-4">
                  {(!enquiry.attachmentsList || enquiry.attachmentsList.length === 0) ? (
                    <p className="text-sm text-slate-400 text-center py-6">No versioned documents linked to this enquiry.</p>
                  ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden divide-y divide-slate-100">
                      <div className="grid grid-cols-4 gap-2 text-xs font-black text-slate-400 uppercase tracking-wider px-5 py-3 bg-slate-50">
                        <span>Document Name</span>
                        <span>Version / Owner</span>
                        <span>Uploaded At</span>
                        <span className="text-right">Action</span>
                      </div>
                      {enquiry.attachmentsList.map((att, idx) => (
                        <div key={att._id || idx} className="grid grid-cols-4 gap-2 text-xs px-5 py-4 items-center">
                          <div className="truncate font-semibold text-slate-800">
                            {att.originalFileName}
                          </div>
                          <div>
                            <span className="inline-flex items-center rounded-md bg-brand-50 px-2 py-1 text-xs font-bold text-brand-700 ring-1 ring-inset ring-brand-700/10 mr-1.5">
                              v{att.versionNumber || 1}
                            </span>
                            <span className="text-slate-500">{att.attachmentOwnerType}</span>
                          </div>
                          <div className="text-slate-500">
                            {new Date(att.uploadedAt || att.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                          <div className="text-right">
                            <a
                              href={`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/files/download-local/${att.storagePath}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-bold"
                            >
                              <Download className="w-3.5 h-3.5" /> Download
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right — Sidebar Panels */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <TaskPanel enquiryId={id} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <FollowUpPanel enquiryId={id} currentUserRole={currentUser.role} />
          </div>
        </div>
      </div>

      {/* ── Edit Slide-in Panel ─────────────────────────────────────────── */}
      {showEditPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowEditPanel(false)} />
          <div className="relative w-full max-w-lg h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="font-bold text-slate-900 text-lg">Edit Enquiry</h2>
              <button onClick={() => setShowEditPanel(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={saveEdit} className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Product Category</label>
                  <AutocompleteSelect
                    options={['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Piping', 'Structural', 'Custom', 'Multiple']}
                    value={editForm.productCategory}
                    onChange={v => setEditForm(prev => ({ ...prev, productCategory: v }))}
                    placeholder="Select category..."
                    allowClear={false}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Product Description</label>
                  <textarea rows={2} required maxLength="200" value={editForm.productDescription} onChange={e => setEditForm(prev => ({ ...prev, productDescription: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Source Channel</label>
                  <AutocompleteSelect
                    options={['IndiaMart', 'GEM Portal', 'Email', 'WhatsApp', 'Reference', 'Exhibition', 'Verbal/Phone', 'Website', 'Cold Call', 'Walk-in']}
                    value={editForm.sourceChannel}
                    onChange={v => setEditForm(prev => ({ ...prev, sourceChannel: v }))}
                    placeholder="Select source..."
                    allowClear={false}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Source Type</label>
                  <AutocompleteSelect
                    options={['Direct Enquiry', 'Tender', 'Follow-up Reply', 'Manual Entry']}
                    value={editForm.sourceType}
                    onChange={v => setEditForm(prev => ({ ...prev, sourceType: v }))}
                    placeholder="Select source type..."
                    allowClear={false}
                  />
                </div>
                {editForm.sourceType === 'Tender' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tender Number</label>
                      <input type="text" value={editForm.tenderNumber || ''} onChange={e => setEditForm(prev => ({ ...prev, tenderNumber: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Tender Deadline</label>
                      <input type="date" value={editForm.tenderDeadline || ''} onChange={e => setEditForm(prev => ({ ...prev, tenderDeadline: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                    </div>
                  </>
                )}
                {editForm.sourceChannel === 'IndiaMart' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">IndiaMart Lead ID</label>
                      <input type="text" value={editForm.indiaMartLeadId} onChange={e => setEditForm(prev => ({ ...prev, indiaMartLeadId: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Lead Genuineness</label>
                      <AutocompleteSelect
                        options={['Genuine', 'Likely Genuine', 'Suspect', 'Junk']}
                        value={editForm.leadGenuineness}
                        onChange={v => setEditForm(prev => ({ ...prev, leadGenuineness: v }))}
                        placeholder="Select..."
                        allowClear={false}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Contact Method</label>
                      <AutocompleteSelect
                        options={['Call', 'Message', 'Both']}
                        value={editForm.indiaMartContactMethod}
                        onChange={v => setEditForm(prev => ({ ...prev, indiaMartContactMethod: v }))}
                        placeholder="Select..."
                        allowClear={false}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">&nbsp;</label>
                      <label className="flex items-center gap-2 mt-3 cursor-pointer text-sm font-medium text-slate-700">
                        <input type="checkbox" checked={editForm.detailsSharedByLead} onChange={e => setEditForm(prev => ({ ...prev, detailsSharedByLead: e.target.checked }))} className="rounded text-brand-600 focus:ring-brand-500 border-slate-300 w-4 h-4" />
                        Details Shared by Lead?
                      </label>
                    </div>
                  </>
                )}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Standard / Code</label>
                  <AutocompleteSelect
                    options={['ASME', 'IS', 'BS', 'EN', 'API', 'IBR', 'Custom', 'Not specified']}
                    value={editForm.standardCode}
                    onChange={v => setEditForm(prev => ({ ...prev, standardCode: v }))}
                    placeholder="Select standard..."
                    allowClear={false}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Quantity</label>
                  <input type="number" min="1" step="any" value={editForm.quantity} onChange={e => setEditForm(prev => ({ ...prev, quantity: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Unit</label>
                  <AutocompleteSelect
                    options={['NOS', 'SET', 'MT', 'KG', 'M', 'M2', 'Job']}
                    value={editForm.unit}
                    onChange={v => setEditForm(prev => ({ ...prev, unit: v }))}
                    placeholder="Select unit..."
                    allowClear={false}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Delivery Time (Weeks)</label>
                  <input type="number" min="1" value={editForm.requiredDeliveryWeeks} onChange={e => setEditForm(prev => ({ ...prev, requiredDeliveryWeeks: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">TPI Requirement</label>
                  <label className="flex items-center gap-2 mt-3 cursor-pointer text-sm font-medium text-slate-700">
                    <input type="checkbox" checked={editForm.thirdPartyInspection} onChange={e => setEditForm(prev => ({ ...prev, thirdPartyInspection: e.target.checked }))} className="rounded text-brand-600 focus:ring-brand-500 border-slate-300 w-4 h-4" />
                    Inspection needed
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Budget From (₹)</label>
                  <input type="number" value={editForm.budgetFrom} onChange={e => setEditForm(prev => ({ ...prev, budgetFrom: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Budget To (₹)</label>
                  <input type="number" value={editForm.budgetTo} onChange={e => setEditForm(prev => ({ ...prev, budgetTo: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Special Requirements</label>
                  <textarea rows={2} maxLength="400" value={editForm.specialRequirements} onChange={e => setEditForm(prev => ({ ...prev, specialRequirements: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Internal Notes</label>
                <textarea rows={4} value={editForm.internalNotes || ''}
                  onChange={e => setEditForm(prev => ({ ...prev, internalNotes: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
                  placeholder="Internal notes visible to team only..." />
              </div>
            </form>

            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button type="button" onClick={() => setShowEditPanel(false)}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={saveEdit} disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-all">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verify & Approve Modal */}
      {showVerifyModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Verify & Approve Enquiry
              </h2>
              <button
                onClick={() => setShowVerifyModal(false)}
                type="button"
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-500">
                You are about to verify and sign off the automatically extracted specifications for enquiry <span className="font-semibold text-slate-800">{enquiry.enquiryId}</span>. This transitions the status to <span className="font-semibold text-emerald-600">Verified</span>.
              </p>
              
              <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                <p className="text-xs text-amber-800 font-medium leading-relaxed">
                  <strong>Verification Check:</strong> Please ensure all required product specifications (standard code, size, rating, material, etc.) are filled in correctly before verifying.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Review Notes / Remarks</label>
                <textarea
                  rows={3}
                  value={reviewNotes}
                  onChange={e => setReviewNotes(e.target.value)}
                  placeholder="e.g., Checked against drawings, corrected size to 4 inches. Ready for tech review."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 rounded-2xl text-sm outline-none resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button
                onClick={() => setShowVerifyModal(false)}
                type="button"
                className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-sm font-bold shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyAndApprove}
                disabled={saving}
                type="button"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm disabled:opacity-60 transition-all flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Approve & Verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnquiryDetail;
