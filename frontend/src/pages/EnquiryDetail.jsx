import React, { useState, useEffect, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Loader2, ArrowLeft, Save, Trash2, Download, CheckCircle2,
  AlertTriangle, Trophy, XCircle, PauseCircle, Flag,
  UserCheck, Tag, CalendarDays, ChevronDown, Pencil, X, FileCheck
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { getRoleCode, useAbility } from '../context/AbilityContext';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import AutocompleteSelect from '../components/AutocompleteSelect';
import ToggleSwitch from '../components/ToggleSwitch';
import FollowUpPanel from '../components/FollowUpPanel';
import TaskPanel from '../components/TaskPanel';
import AttachmentManager from '../components/AttachmentManager';
import TenderIntelligencePanel from '../components/TenderIntelligencePanel';
import EditableLineItemsTable from '../components/EditableLineItemsTable';
import EmailThreadViewer from '../components/EmailThreadViewer';
import { formatSizeToMm, formatTextToMm } from '../utils/valveFormatter';

const renderVal = (val) => {
  if (val && typeof val === 'object' && val.value !== undefined) {
    return val.value;
  }
  return val;
};

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

const formatFieldName = (key) => {
  if (!key) return '';
  return key
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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

  // Editable Customer Info state
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    companyName: '',
    primaryContactName: '',
    mobileNumber: '',
    emailAddress: '',
    city: '',
    gstin: ''
  });

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const userRoleCode = getRoleCode(currentUser.role);
  const userSecRoleCode = getRoleCode(currentUser.secondaryRole);
  const userRoles = [userRoleCode, userSecRoleCode].filter(Boolean);

  const [creatingQuotation, setCreatingQuotation] = useState(false);
  
  const ability = useAbility();
  const canEdit = ability.can('edit', 'Enquiry');
  const canDelete = ability.can('delete', 'Enquiry');
  const canAssign = ability.can('assign', 'Enquiry');
  const canSetPriority = ability.can('setPriority', 'Enquiry');
  const canMarkStatus = ability.can('markStatus', 'Enquiry');
  const canExport = ability.can('export', 'Enquiry');
  const isReadOnly = !canEdit;

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleDirectCreateQuotation = async () => {
    if (!enquiry || ['Lost', 'Abandoned'].includes(enquiry.status)) return;
    setCreatingQuotation(true);
    try {
      const res = await api.post('/quotations', { enquiry: enquiry._id });
      if (res.data?.data?.quotation?._id) {
        showToast('Quotation created! Redirecting to quote editor...');
        navigate(`/app/quotations/${res.data.data.quotation._id}`);
      } else {
        showToast('Failed to retrieve created quotation', 'error');
      }
    } catch (err) {
      console.error('Direct quotation creation error:', err);
      showToast(err.response?.data?.message || 'Error creating quotation', 'error');
    } finally {
      setCreatingQuotation(false);
    }
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
    if (enquiry) {
      if (enquiry.dynamicFields) setDynamicValues(enquiry.dynamicFields);
      setCustomerForm({
        companyName: enquiry.senderCompany || enquiry.customer?.companyName || '',
        primaryContactName: enquiry.customer?.primaryContactName || '',
        mobileNumber: enquiry.customer?.mobileNumber || '',
        emailAddress: enquiry.customer?.emailAddress || '',
        city: enquiry.customer?.city || '',
        gstin: enquiry.customer?.gstin || ''
      });
    }
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
      const cleanValue = (value === '' && ['assignedTo', 'customer', 'createdBy'].includes(field)) ? null : value;
      const res = await api.patch(`/enquiries/${id}`, { [field]: cleanValue });
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

  // ─── Export Excel XLSX ───────────────────────────────────────────────────
  const handleExport = () => {
    try {
      const overviewRows = [
        ['Field', 'Value'],
        ['Enquiry ID', enquiry.enquiryId],
        ['Customer', enquiry.customer?.companyName || enquiry.senderCompany || ''],
        ['Contact', enquiry.customer?.primaryContactName || enquiry.contactPerson || ''],
        ['Mobile', enquiry.customer?.mobileNumber || enquiry.contactMobile || ''],
        ['Email', enquiry.customer?.emailAddress || enquiry.contactEmail || ''],
        ['Product Category', enquiry.productCategory || ''],
        ['Description', enquiry.productDescription || ''],
        ['Total Quantity', enquiry.quantity || ''],
        ['Unit', enquiry.unit || ''],
        ['Source Channel', enquiry.sourceChannel || ''],
        ['Source Type', enquiry.sourceType || ''],
        ['Status', enquiry.status || ''],
        ['Priority', enquiry.priority || ''],
        ['Assigned To', enquiry.assignedTo?.name || enquiry.assignedTo?.fullName || 'Unassigned'],
        ['Created At', new Date(enquiry.createdAt).toLocaleString('en-IN')],
        ...Object.entries(enquiry.dynamicFields || {}).map(([k, v]) => [formatFieldName(k), renderVal(v) || ''])
      ];

      const wb = XLSX.utils.book_new();
      const wsOverview = XLSX.utils.aoa_to_sheet(overviewRows);
      XLSX.utils.book_append_sheet(wb, wsOverview, 'Enquiry Overview');

      if (enquiry.products && enquiry.products.length > 0) {
        const lineItemRows = enquiry.products.map((item, idx) => {
          const df = item.dynamicFields || {};
          return {
            'Sr No': idx + 1,
            'Description': item.description || '',
            'Quantity': item.quantity || 1,
            'Unit': item.unit || 'NOS',
            'Valve Type': df.valve_type || df.product_type || '',
            'Size (mm)': df.valve_size || df.size || '',
            'Pressure Class': df.valve_class || df.class || '',
            'Body MOC': df.body_moc || df.body_material || '',
            'Trim / Ball MOC': df.trim_moc || df.ball_moc || '',
            'Stem MOC': df.stem_moc || '',
            'Seat MOC': df.seat_moc || '',
            'End Connection': df.end_connection || ''
          };
        });
        const wsLineItems = XLSX.utils.json_to_sheet(lineItemRows);
        XLSX.utils.book_append_sheet(wb, wsLineItems, 'Line Items');
      }

      XLSX.writeFile(wb, `${enquiry.enquiryId}.xlsx`);
      showToast('Exported to Excel (.xlsx)');
    } catch (err) {
      console.error('[Export XLSX Error]', err);
      showToast('Export to Excel failed', 'error');
    }
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
      clientName:         enquiry.clientName         || '',
      pmcConsultant:      enquiry.pmcConsultant      || '',
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

  const saveCustomerInfo = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        senderCompany: customerForm.companyName,
        customerData: {
          companyName: customerForm.companyName,
          primaryContactName: customerForm.primaryContactName,
          mobileNumber: customerForm.mobileNumber,
          emailAddress: customerForm.emailAddress,
          city: customerForm.city,
          gstin: customerForm.gstin
        }
      };
      const res = await api.patch(`/enquiries/${id}`, payload);
      if (res.data?.data?.enquiry) {
        setEnquiry(res.data.data.enquiry);
        setIsEditingCustomer(false);
        showToast('Customer information updated successfully!');
      }
    } catch (err) {
      console.error('[EnquiryDetail] Save customer error:', err);
      showToast(err.response?.data?.message || 'Failed to update customer info', 'error');
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
            {canEdit && (
              <div className="mt-3">
                <button
                  onClick={() => setShowVerifyModal(true)}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-500/20"
                >
                  Verify & Approve
                </button>
              </div>
            )}
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
            {enquiry.senderCompany || enquiry.customer?.companyName || 'Unknown'} • {enquiry.productCategory || 'N/A'}
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            {/* Status Badge + Dropdown */}
            <div className="relative" ref={statusRef}>
              <button
                onClick={() => canMarkStatus && setShowStatusMenu(!showStatusMenu)}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusCfg.color} ${canMarkStatus ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                {statusCfg.label}
                {canMarkStatus && <ChevronDown className="w-3 h-3" />}
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
                onClick={() => canSetPriority && setShowPriorityMenu(!showPriorityMenu)}
                className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${priorityCfg.color} ${canSetPriority ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${priorityCfg.dot}`} />
                {enquiry.priority || 'Medium'}
                {canSetPriority && <ChevronDown className="w-3 h-3" />}
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
                disabled={!canAssign}
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

            {ability.can('create', 'Quotation') && (
            <button
              onClick={handleDirectCreateQuotation}
              disabled={creatingQuotation || ['Lost', 'Abandoned'].includes(enquiry.status)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-white rounded-xl text-sm font-bold transition-all ${
                !['Lost', 'Abandoned'].includes(enquiry.status)
                  ? 'bg-emerald-600 hover:bg-emerald-700 cursor-pointer shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-300 cursor-not-allowed opacity-60'
              }`}
              title={['Lost', 'Abandoned'].includes(enquiry.status) ? "Quotation generation is disabled for Lost or Abandoned enquiries." : "Create Quotation for this enquiry"}
            >
              {creatingQuotation ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileCheck className="w-3.5 h-3.5" />}
              {creatingQuotation ? 'Generating Quote...' : 'Create Quotation'}
            </button>
            )}
          </div>

          {/* Group 2: Management Operations */}
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={openEdit} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </button>
            )}

            {canExport && (
              <button onClick={handleExport} className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-sm font-bold transition-all">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            )}

            {canDelete && (
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
                ['Description',       formatTextToMm(enquiry.productDescription)],
                ['Total Quantity',    (() => {
                  const totalQty = enquiry.products && enquiry.products.length > 0
                    ? enquiry.products.reduce((sum, p) => sum + (p.quantity || 0), 0)
                    : enquiry.quantity;
                  return `${totalQty} ${enquiry.unit || 'NOS'}`;
                })()],
                ['Line Items',        enquiry.products?.length ? `${enquiry.products.length} Items` : '1 Item'],
                ['Standard/Code',     (() => {
                  const allStds = new Set();
                  if (enquiry.standardCode && enquiry.standardCode !== 'Not specified') {
                    enquiry.standardCode.split(',').map(s => s.trim()).filter(Boolean).forEach(s => allStds.add(s));
                  }
                  if (enquiry.products && enquiry.products.length > 0) {
                    enquiry.products.forEach(p => {
                      if (p.standardCode && p.standardCode !== 'Not specified') {
                        p.standardCode.split(',').map(s => s.trim()).filter(Boolean).forEach(s => allStds.add(s));
                      }
                    });
                  }
                  return allStds.size > 0 ? [...allStds].join(', ') : '—';
                })()],
                ...(enquiry.clientName ? [['Client / Owner', enquiry.clientName]] : []),
                ...(enquiry.pmcConsultant ? [['PMC / Consultant', enquiry.pmcConsultant]] : []),
                ['Source Channel',    enquiry.sourceChannel],
                ['Source Type',       enquiry.sourceType || 'Direct Enquiry'],
                ...(enquiry.sourceType === 'Tender' ? [
                  ['Tender Number',   enquiry.tenderNumber || '—'],
                  ['Tender Deadline', enquiry.tenderDeadline ? new Date(enquiry.tenderDeadline).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—']
                ] : []),
                ...(enquiry.productCategory === 'Valves' ? [
                  ['Valve Type',      (() => {
                    const types = new Set();
                    const enqVal = renderVal(enquiry.dynamicFields?.valve_type);
                    if (enqVal) types.add(enqVal);
                    if (enquiry.products && enquiry.products.length > 0) {
                      enquiry.products.forEach(p => {
                        const v = renderVal(p.dynamicFields?.valve_type);
                        if (v) types.add(v);
                      });
                    }
                    return types.size > 0 ? [...types].join(', ') : '—';
                  })()],
                  ['Valve Size',      (() => {
                    const sizes = new Set();
                    const enqVal = renderVal(enquiry.dynamicFields?.valve_size);
                    if (enqVal) sizes.add(formatSizeToMm(enqVal));
                    if (enquiry.products && enquiry.products.length > 0) {
                      enquiry.products.forEach(p => {
                        const v = renderVal(p.dynamicFields?.valve_size);
                        if (v) sizes.add(formatSizeToMm(v));
                      });
                    }
                    return sizes.size > 0 ? [...sizes].join(', ') : '—';
                  })()],
                  ['Pressure Class',  (() => {
                    const classes = new Set();
                    const enqVal = renderVal(enquiry.dynamicFields?.valve_class);
                    if (enqVal) classes.add(enqVal);
                    if (enquiry.products && enquiry.products.length > 0) {
                      enquiry.products.forEach(p => {
                        const v = renderVal(p.dynamicFields?.valve_class);
                        if (v) classes.add(v);
                      });
                    }
                    return classes.size > 0 ? [...classes].join(', ') : '—';
                  })()]
                ] : []),
                ...(enquiry.sourceChannel === 'IndiaMart' ? [
                  ['IndiaMart Lead ID', enquiry.indiaMartLeadId || '—'],
                  ['Lead Genuineness', enquiry.leadGenuineness || '—'],
                  ['Contact Method', enquiry.indiaMartContactMethod || '—'],
                  ['Details Shared?', enquiry.detailsSharedByLead ? 'Yes' : 'No'],
                  ['Days Since Lead', enquiry.createdAt ? Math.floor((Date.now() - new Date(enquiry.createdAt)) / (1000 * 60 * 60 * 24)) + ' days' : '—']
                ] : []),
                ['Budget',            enquiry.budgetFrom ? `₹${enquiry.budgetFrom} - ₹${enquiry.budgetTo}` : '—'],
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

          {/* Interactive Line Items Spreadsheet Table */}
          <EditableLineItemsTable 
            enquiryId={id} 
            initialProducts={enquiry.products} 
            productCategory={enquiry.productCategory} 
            onSaveSuccess={(updated) => setEnquiry(updated)} 
          />


          {/* Customer Info Card (Editable) */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between gap-4 mb-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-bold tracking-tight text-slate-900">Customer Information</h2>
              {canEdit && (
                !isEditingCustomer ? (
                  <button
                    type="button"
                    onClick={() => setIsEditingCustomer(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Edit Customer Info
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingCustomer(false)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={saveCustomerInfo}
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold transition-all shadow-sm shadow-brand-500/20"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Save
                    </button>
                  </div>
                )
              )}
            </div>

            {!isEditingCustomer ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-6 text-sm">
                {[
                  ['Company',  enquiry.senderCompany || enquiry.customer?.companyName],
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
            ) : (
              <form onSubmit={saveCustomerInfo} className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Company Name</label>
                  <input
                    type="text"
                    value={customerForm.companyName}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Enter company name..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Contact Person</label>
                  <input
                    type="text"
                    value={customerForm.primaryContactName}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, primaryContactName: e.target.value }))}
                    placeholder="Enter contact person name..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={customerForm.mobileNumber}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, mobileNumber: e.target.value }))}
                    placeholder="Enter mobile number..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">Email Address</label>
                  <input
                    type="email"
                    value={customerForm.emailAddress}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, emailAddress: e.target.value }))}
                    placeholder="Enter email address..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">City</label>
                  <input
                    type="text"
                    value={customerForm.city}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Enter city..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                  />
                </div>

                <div>
                  <label className="block text-slate-500 font-bold uppercase tracking-wider mb-1">GSTIN</label>
                  <input
                    type="text"
                    value={customerForm.gstin}
                    onChange={(e) => setCustomerForm(prev => ({ ...prev, gstin: e.target.value }))}
                    placeholder="Enter GSTIN..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all uppercase"
                  />
                </div>
              </form>
            )}
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
                <div>
                  {emailsLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-brand-600 mx-auto py-6" />
                  ) : (
                    <EmailThreadViewer emails={threadEmails} primaryEmail={enquiry.rawEmail} />
                  )}
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
            <TaskPanel enquiryId={id} readOnly={isReadOnly} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <FollowUpPanel enquiryId={id} currentUserRole={currentUser.role} readOnly={isReadOnly} />
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
                    options={['Pressure Vessel', 'Heat Exchanger', 'Storage Tank', 'Valves', 'Structural', 'Custom', 'Multiple']}
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
                    <div className="flex flex-col gap-1.5 mt-1.5">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Details Shared by Lead?</span>
                      <ToggleSwitch checked={editForm.detailsSharedByLead} onChange={v => setEditForm(prev => ({ ...prev, detailsSharedByLead: v }))} />
                    </div>
                  </>
                )}


                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Quantity</label>
                  <input type="number" min="1" step="any" placeholder=" " value={editForm.quantity} onChange={e => setEditForm(prev => ({ ...prev, quantity: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
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
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Budget From (₹)</label>
                  <input type="number" placeholder=" " value={editForm.budgetFrom} onChange={e => setEditForm(prev => ({ ...prev, budgetFrom: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Budget To (₹)</label>
                  <input type="number" placeholder=" " value={editForm.budgetTo} onChange={e => setEditForm(prev => ({ ...prev, budgetTo: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Special Requirements</label>
                  <textarea rows={2} maxLength="400" placeholder=" " value={editForm.specialRequirements} onChange={e => setEditForm(prev => ({ ...prev, specialRequirements: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Client / Owner Name</label>
                  <input type="text" value={editForm.clientName || ''} onChange={e => setEditForm(prev => ({ ...prev, clientName: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">PMC / Consultant Name</label>
                  <input type="text" value={editForm.pmcConsultant || ''} onChange={e => setEditForm(prev => ({ ...prev, pmcConsultant: e.target.value }))} className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
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
