import React, { useState, useEffect, useRef } from 'react';
import {
  Loader2, ArrowLeft, Save, Trash2, Download, CheckCircle2,
  AlertTriangle, Trophy, XCircle, PauseCircle, Flag,
  UserCheck, Tag, CalendarDays, ChevronDown, Pencil, X
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
  'Contacted':        { color: 'bg-violet-100 text-violet-700',   label: 'Contacted'        },
  'Technical Review': { color: 'bg-cyan-100 text-cyan-700',       label: 'Technical Review' },
  'Ready for Offer':  { color: 'bg-teal-100 text-teal-700',       label: 'Ready for Offer'  },
  'Quoted':           { color: 'bg-purple-100 text-purple-700',   label: 'Quoted'           },
  'Negotiating':      { color: 'bg-indigo-100 text-indigo-700',   label: 'Negotiating'      },
  'Won':              { color: 'bg-emerald-100 text-emerald-700', label: 'Won ✓'            },
  'Lost':             { color: 'bg-red-100 text-red-700',         label: 'Lost'             },
  'On Hold':          { color: 'bg-amber-100 text-amber-700',     label: 'On Hold'          },
  'Abandoned':        { color: 'bg-slate-100 text-slate-500',     label: 'Abandoned'        },
};

const Toast = ({ msg, type, onClose }) => (
  <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
    type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
  }`}>
    {type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
    {msg}
  </div>
);

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
      const res = await api.patch(`/enquiries/${id}`, editForm);
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
                    { v: 'New',              icon: Tag,          label: 'New' },
                    { v: 'Contacted',        icon: UserCheck,    label: 'Contacted' },
                    { v: 'Technical Review', icon: CheckCircle2, label: 'Technical Review' },
                    { v: 'Ready for Offer',  icon: CheckCircle2, label: 'Ready for Offer',  cls: 'text-teal-600' },
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {saving && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}

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
    </div>
  );
};

export default EnquiryDetail;
