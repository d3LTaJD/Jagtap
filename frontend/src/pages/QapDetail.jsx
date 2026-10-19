import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, Download, User as UserIcon, CheckCircle, CheckCircle2,
  Clock, AlertCircle, ArrowLeft, Loader2, PenTool, ShieldCheck,
  Printer, Send, X, AlertTriangle, Stamp, Eye, Save, Plus, Trash2,
  SlidersHorizontal, ChevronDown, ChevronUp, RotateCcw, Sparkles
} from 'lucide-react';
import api from '../api/client';
import { getRoleCode, useAbility } from '../context/AbilityContext';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import AutocompleteSelect from '../components/AutocompleteSelect';

const StatusBadge = ({ status }) => {
  const colors = {
    'GENERATED': 'bg-slate-100 text-slate-700 border-slate-200',
    'UNDER_REVIEW': 'bg-blue-50 text-blue-700 border-blue-200',
    'APPROVED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'REJECTED': 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors[status] || 'bg-slate-50 text-slate-600'}`}>
      {status}
    </span>
  );
};

const QapDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const ability = useAbility();
  
  const [qap, setQap] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showMocPanel, setShowMocPanel] = useState(false);
  
  const currentUser = JSON.parse(localStorage.getItem('user') || sessionStorage.getItem('user') || '{}');
  const [dynamicValues, setDynamicValues] = useState({});
  const [toast, setToast] = useState(null);

  // Form state for all editable QAP fields
  const [formData, setFormData] = useState({
    clientName: '',
    endUser: '',
    projectName: '',
    clientPoNo: '',
    clientPoDate: '',
    qapNumber: '',
    revisionNo: '00',
    qapDate: '',
    valveDetail: {
      valveType: 'BALL VALVES',
      designStandard: 'API 6D 25TH ED.',
      testingStandard: 'API 6D 25TH ED.',
      itemCode: '',
      size: '100MM',
      pressureClass: '300#',
      endConnection: 'BW',
      bodyMoc: 'ASTM A216 Gr. WCC',
      trimMoc: 'ASTM A351 CF8M',
      stemMoc: 'ASTM A479 Gr. 410',
      seatMoc: 'ASTM A182 Gr. F6A',
      fastenerMoc: 'ASTM A193 Gr. B7 / ASTM A194 Gr. 2H',
      pupPieceMoc: 'ASTM A106 Gr. B',
      paintingDft: '120 Micron'
    },
    activities: [],
    formatNo: 'Format No.R/5.2/1 Rev01 Effective From 15-Sept-2022',
    preparedByName: 'QC Engg.',
    approvedByName: 'Incharge Q.C.'
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const populateForm = (qapData) => {
    const vd = qapData.valveDetail || {};
    setFormData({
      clientName: qapData.clientName || qapData.customer?.companyName || '',
      endUser: qapData.endUser || 'M/s. THINK GAS DISTRIBUTION PVT. LTD.',
      projectName: qapData.projectName || 'THINK GAS (AG&P) PROJECT',
      clientPoNo: qapData.clientPoNo || '',
      clientPoDate: qapData.clientPoDate ? qapData.clientPoDate.substring(0, 10) : '',
      qapNumber: qapData.qapNumber || qapData.qapId || '',
      revisionNo: qapData.revisionNo || (qapData.revision !== undefined ? String(qapData.revision).padStart(2, '0') : '00'),
      qapDate: qapData.qapDate ? qapData.qapDate.substring(0, 10) : new Date().toISOString().substring(0, 10),
      valveDetail: {
        valveType: vd.valveType || 'BALL VALVES',
        designStandard: vd.designStandard || 'API 6D 25TH ED.',
        testingStandard: vd.testingStandard || 'API 6D 25TH ED.',
        itemCode: vd.itemCode || '',
        size: vd.size || '100MM',
        pressureClass: vd.pressureClass || '300#',
        endConnection: vd.endConnection || 'BW',
        bodyMoc: vd.bodyMoc || 'ASTM A216 Gr. WCC',
        trimMoc: vd.trimMoc || 'ASTM A351 CF8M',
        stemMoc: vd.stemMoc || 'ASTM A479 Gr. 410',
        seatMoc: vd.seatMoc || 'ASTM A182 Gr. F6A',
        fastenerMoc: vd.fastenerMoc || 'ASTM A193 Gr. B7 / ASTM A194 Gr. 2H',
        pupPieceMoc: vd.pupPieceMoc || 'ASTM A106 Gr. B',
        paintingDft: vd.paintingDft || '120 Micron'
      },
      activities: (qapData.activities || []).map((act, idx) => ({
        _id: act._id || `act-${idx}`,
        srNo: act.srNo || String(idx + 1),
        sectionNo: act.sectionNo || '1',
        sectionTitle: act.sectionTitle || 'RAW MATERIAL (CRITICAL)',
        component: act.component || act.stageOfManufacture || '',
        typeOfCheck: act.typeOfCheck || act.activityName || '',
        quantumOfCheck: act.quantumOfCheck || act.frequency || '100%',
        referenceDocument: act.referenceDocument || '',
        acceptanceNorms: act.acceptanceNorms || act.acceptanceCriteria || '',
        formatOfRecord: act.formatOfRecord || act.recordType || 'Inspection Report',
        inHouseOutSource: act.inHouseOutSource || 'I',
        inspectionPvpl: act.inspectionPvpl || act.inspectionType || 'P',
        inspectionTpi: act.inspectionTpi || 'R'
      })),
      formatNo: qapData.formatNo || 'Format No.R/5.2/1 Rev01 Effective From 15-Sept-2022',
      preparedByName: qapData.preparedByName || 'QC Engg.',
      approvedByName: qapData.approvedByName || 'Incharge Q.C.'
    });
    setIsDirty(false);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qRes = await api.get(`/qaps/${id}`);
        if (qRes.data.data?.qap) {
          const loadedQap = qRes.data.data.qap;
          setQap(loadedQap);
          populateForm(loadedQap);
        }
        
        api.get('/auth/users')
          .then(res => { if (res.data.data?.users) setUsers(res.data.data.users); })
          .catch(err => console.error('Failed to fetch users:', err));

      } catch (err) {
        console.error('Fetch error:', err);
        showToast('Failed to load QAP: ' + (err.response?.data?.message || err.message), 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (qap?.dynamicFields) setDynamicValues(qap.dynamicFields);
  }, [qap]);

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [formData, dynamicValues]);

  // Handle header updates
  const handleHeaderChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // Handle valve details updates
  const handleValveDetailChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      valveDetail: { ...prev.valveDetail, [field]: value }
    }));
    setIsDirty(true);
  };

  // Handle activity updates
  const handleActivityChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.activities];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, activities: updated };
    });
    setIsDirty(true);
  };

  // Add a new row to a specific section or at index
  const handleAddRow = (sectionTitle, sectionNo, insertIndex = null) => {
    setFormData(prev => {
      const updated = [...prev.activities];
      const newSr = String(updated.length + 1);
      const newActivity = {
        _id: `temp-${Date.now()}-${Math.random()}`,
        srNo: newSr,
        sectionNo: sectionNo || '1',
        sectionTitle: sectionTitle || 'RAW MATERIAL (CRITICAL)',
        component: '',
        typeOfCheck: '',
        quantumOfCheck: '100%',
        referenceDocument: '',
        acceptanceNorms: '',
        formatOfRecord: 'Inspection Report',
        inHouseOutSource: 'I',
        inspectionPvpl: 'P',
        inspectionTpi: 'R'
      };

      if (insertIndex !== null && insertIndex >= 0) {
        updated.splice(insertIndex + 1, 0, newActivity);
      } else {
        updated.push(newActivity);
      }

      return { ...prev, activities: updated };
    });
    setIsDirty(true);
    showToast('New inspection stage added');
  };

  // Delete a row
  const handleDeleteRow = (index) => {
    setFormData(prev => {
      const updated = [...prev.activities];
      updated.splice(index, 1);
      return { ...prev, activities: updated };
    });
    setIsDirty(true);
    showToast('Inspection stage removed', 'info');
  };

  // Update section title across all activities in that section
  const handleSectionTitleChange = (oldTitle, newTitle) => {
    setFormData(prev => {
      const updated = prev.activities.map(act => {
        if (act.sectionTitle === oldTitle) {
          return { ...act, sectionTitle: newTitle };
        }
        return act;
      });
      return { ...prev, activities: updated };
    });
    setIsDirty(true);
  };

  // Save all fields to MongoDB backend
  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Clean dynamicValues of any internal Mongoose keys starting with $ or _
      const cleanedDynamic = {};
      if (dynamicValues && typeof dynamicValues === 'object') {
        Object.keys(dynamicValues).forEach(k => {
          if (!k.startsWith('$') && !k.startsWith('_')) {
            cleanedDynamic[k] = dynamicValues[k];
          }
        });
      }

      // Clean activities of any temporary frontend id string like "temp-..."
      const cleanedActivities = (formData.activities || []).map(act => {
        const item = { ...act };
        if (typeof item._id === 'string' && (item._id.startsWith('temp-') || item._id.startsWith('act-'))) {
          delete item._id;
        }
        return item;
      });

      const payload = {
        clientName: formData.clientName,
        endUser: formData.endUser,
        projectName: formData.projectName,
        clientPoNo: formData.clientPoNo,
        clientPoDate: formData.clientPoDate || null,
        qapNumber: formData.qapNumber,
        revisionNo: formData.revisionNo,
        qapDate: formData.qapDate || null,
        valveDetail: formData.valveDetail,
        activities: cleanedActivities,
        formatNo: formData.formatNo,
        preparedByName: formData.preparedByName,
        approvedByName: formData.approvedByName,
        dynamicFields: cleanedDynamic
      };

      const res = await api.patch(`/qaps/${id}`, payload);
      if (res.data?.data?.qap) {
        setQap(res.data.data.qap);
        populateForm(res.data.data.qap);
      }
      setIsDirty(false);
      showToast('All QAP changes saved successfully!');
    } catch (err) {
      console.error('Save error:', err);
      showToast('Failed to save changes: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Discard local changes and reload from original QAP
  const handleDiscardChanges = () => {
    if (!confirm('Discard all unsaved changes and revert to saved data?')) return;
    if (qap) {
      populateForm(qap);
      showToast('Changes discarded', 'info');
    }
  };

  const handleDynamicFieldChange = (fieldName, value) => {
    setDynamicValues(prev => ({ ...prev, [fieldName]: value }));
    setIsDirty(true);
  };

  const handleUpdate = async (update) => {
    setSaving(true);
    try {
      const res = await api.patch(`/qaps/${id}/status`, update);
      setQap(res.data.data.qap);
      populateForm(res.data.data.qap);
      showToast('QAP updated successfully');
    } catch (err) {
      showToast('Update failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Final approve & sign QAP (Director only)
  const handleFinalApprove = async () => {
    if (!confirm('Final approve and digitally sign this QAP? The customer will be able to view it.')) return;
    await handleUpdate({ status: 'APPROVED', approvedBy: currentUser.id || currentUser._id, signedAt: new Date().toISOString() });
  };

  // Send to client
  const handleSendToClient = async () => {
    if (!confirm('Mark this QAP as sent to customer?')) return;
    await handleUpdate({ sentToClient: true, sentAt: new Date().toISOString() });
    showToast('QAP marked as sent to customer');
  };

  // Download official PDF generated by Puppeteer
  const [pdfGenerating, setPdfGenerating] = useState(false);

  const handleDownloadPdf = async () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Would you like to save before downloading the PDF?')) {
        await handleSaveAll();
      }
    }
    setPdfGenerating(true);
    showToast('Generating official Petro Valves QAP PDF...', 'info');
    try {
      const response = await api.get(`/qaps/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = (formData.qapNumber || qap?.qapId || 'QAP').replace(/[\/\\?%*:|"<>]/g, '_');
      a.download = `${safeName}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      showToast('Official QAP PDF downloaded successfully');
    } catch (err) {
      console.error('PDF Download failed', err);
      showToast('Failed to generate PDF: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setPdfGenerating(false);
    }
  };

  const handlePreviewPdf = async () => {
    if (isDirty) {
      if (confirm('You have unsaved changes. Would you like to save before previewing the PDF?')) {
        await handleSaveAll();
      }
    }
    setPdfGenerating(true);
    showToast('Opening PDF preview...', 'info');
    try {
      const response = await api.get(`/qaps/${id}/pdf`, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      showToast('Failed to open PDF preview', 'error');
    } finally {
      setPdfGenerating(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
    </div>
  );

  if (!qap) return <div className="p-8 text-center text-slate-500 font-medium">QAP not found.</div>;

  const canFinalSignOff = ability.can('finalSignOff', 'QAP');
  const vd = formData.valveDetail || {};

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-28">
      {/* Back button and breadcrumb */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back to QAPs</span>
        </div>

        {isDirty && (
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 px-3 py-1 rounded-full text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Unsaved Changes (Press Ctrl+S to save)
          </div>
        )}
      </div>

      {/* Top Action Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black text-slate-900 tracking-tight font-mono">
              {formData.qapNumber || qap.qapId || 'QAP Draft'}
            </h1>
            <StatusBadge status={qap.status} />
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1 flex items-center gap-2">
            <span>Order Ref: {qap.quotation?.quotationId || 'Internal'}</span>
            <span>&bull;</span>
            <span>{formData.activities.length} Inspection Stages</span>
            <span>&bull;</span>
            <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
              Interactive Editable Mode
            </span>
          </p>
        </div>
        
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Prominent Save All Button */}
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-black shadow-md transition-all ${
              isDirty 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 ring-2 ring-emerald-500 ring-offset-2'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {isDirty ? 'Save All Changes' : 'Save QAP'}
          </button>

          {isDirty && (
            <button
              onClick={handleDiscardChanges}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Discard
            </button>
          )}

          {/* Assignment dropdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex items-center overflow-visible">
             <div className="px-2.5 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-500">Assign</div>
             <AutocompleteSelect
               disabled={!canFinalSignOff}
               options={[
                 { value: '', label: 'Unassigned' },
                 ...users.map(u => ({
                   value: u._id,
                   label: `${u.fullName || u.name}`,
                   group: u.department || 'Other'
                 }))
               ]}
               value={qap.assignedTo || ''}
               onChange={v => handleUpdate({ assignedTo: v })}
               placeholder="Assign to..."
               allowClear={false}
               className="w-40"
             />
          </div>

          {/* Status dropdown */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex items-center overflow-visible">
             <div className="px-2.5 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-500">Status</div>
             <AutocompleteSelect
               disabled={!ability.can('editActivities', 'QAP')}
               options={[
                 { value: 'GENERATED', label: 'GENERATED' },
                 { value: 'UNDER_REVIEW', label: 'UNDER REVIEW' },
                 ...(canFinalSignOff ? [
                   { value: 'APPROVED', label: 'APPROVED' },
                   { value: 'REJECTED', label: 'REJECTED' },
                 ] : []),
               ]}
               value={qap.status}
               onChange={v => handleUpdate({ status: v })}
               placeholder="Status..."
               allowClear={false}
               className="w-32"
             />
          </div>

          {/* Final Approve & Sign — Director only */}
          {canFinalSignOff && qap.status === 'UNDER_REVIEW' && (
            <button onClick={handleFinalApprove}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all">
              <Stamp className="w-4 h-4" /> Final Approve
            </button>
          )}

          {ability.can('sendToClient', 'QAP') && (
            <button onClick={handleSendToClient}
              disabled={qap.status !== 'APPROVED'}
              title={qap.status !== 'APPROVED' ? 'QAP must be approved before sending' : ''}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all">
              <Send className="w-3.5 h-3.5" /> Send to Client
            </button>
          )}

          {/* Preview PDF */}
          <button onClick={handlePreviewPdf}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold shadow-xs transition-all">
            <Eye className="w-3.5 h-3.5 text-slate-600" /> Preview
          </button>

          {/* Download Official PDF */}
          <button onClick={handleDownloadPdf}
            disabled={pdfGenerating}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all">
            {pdfGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Official PDF
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : toast.type === 'info' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* OFFICIAL PETRO VALVES QAP 3-BOX HEADER CONTAINER (ALL FIELDS EDITABLE) */}
      <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x-2 divide-slate-900">
          
          {/* Left Box (Manufacturer, Client, End User, Project, PO) */}
          <div className="md:col-span-6 p-4 space-y-2.5 text-xs text-slate-800">
            <div className="text-sm font-black text-slate-950 flex items-center justify-between pb-1 border-b border-slate-200">
              <div>Manufactures: <span className="text-[#0b3b60]">Petro Valves Pvt.Ltd.</span></div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Client &amp; PO Meta</span>
            </div>
            
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-black text-slate-950 shrink-0">END USER :</label>
                <input
                  type="text"
                  value={formData.endUser}
                  onChange={(e) => handleHeaderChange('endUser', e.target.value)}
                  placeholder="e.g. M/s. THINK GAS DISTRIBUTION PVT. LTD."
                  className="flex-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-black text-slate-950 shrink-0">CLIENT :</label>
                <input
                  type="text"
                  value={formData.clientName}
                  onChange={(e) => handleHeaderChange('clientName', e.target.value)}
                  placeholder="e.g. M/s. PLANT TECH INDUSTRIAL SERVICES LIMITED"
                  className="flex-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="w-24 text-[11px] font-black text-slate-950 shrink-0">PROJECT :</label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => handleHeaderChange('projectName', e.target.value)}
                  placeholder="e.g. THINK GAS (AG&P) PROJECT"
                  className="flex-1 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-slate-200">
                <div className="flex items-center gap-1.5">
                  <label className="text-[10px] font-black text-slate-950 shrink-0">CLIENT P.O. No.:</label>
                  <input
                    type="text"
                    value={formData.clientPoNo}
                    onChange={(e) => handleHeaderChange('clientPoNo', e.target.value)}
                    placeholder="e.g. PTIS/HT/2026-27/JULY/47"
                    className="flex-1 min-w-0 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div className="flex items-center gap-1.5 justify-end">
                  <label className="text-[10px] font-black text-slate-950 shrink-0">DT.:</label>
                  <input
                    type="date"
                    value={formData.clientPoDate}
                    onChange={(e) => handleHeaderChange('clientPoDate', e.target.value)}
                    className="bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Middle Box (QAP No, Rev, Dates, Valve Specs) */}
          <div className="md:col-span-4 p-4 text-xs text-slate-800 flex flex-col justify-between space-y-2">
            <div className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
              <label className="text-[11px] font-black text-slate-950 shrink-0">QAP No.:</label>
              <input
                type="text"
                value={formData.qapNumber}
                onChange={(e) => handleHeaderChange('qapNumber', e.target.value)}
                placeholder="PV/QAP/PTISL/P2627041/BV/WCC"
                className="flex-1 bg-brand-50/60 hover:bg-brand-50 focus:bg-white border border-brand-200 focus:border-brand-500 rounded-lg px-2.5 py-1 text-xs font-mono font-black text-brand-900 transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 pb-1.5">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-black text-slate-950 shrink-0">REV No.:</label>
                <input
                  type="text"
                  value={formData.revisionNo}
                  onChange={(e) => handleHeaderChange('revisionNo', e.target.value)}
                  placeholder="00"
                  className="w-16 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-lg px-2 py-1 text-xs font-bold text-center transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="flex items-center gap-1.5 justify-end">
                <label className="text-[10px] font-black text-slate-950 shrink-0">DATED:</label>
                <input
                  type="date"
                  value={formData.qapDate}
                  onChange={(e) => handleHeaderChange('qapDate', e.target.value)}
                  className="bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-brand-500 rounded-lg px-2 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            {/* Valve Details Box */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-black text-slate-900 uppercase shrink-0">VALVES DETAIL :</span>
                <input
                  type="text"
                  value={vd.valveType}
                  onChange={(e) => handleValveDetailChange('valveType', e.target.value)}
                  placeholder="BALL VALVES"
                  className="flex-1 bg-white border border-slate-200 focus:border-brand-500 rounded px-2 py-0.5 text-xs font-black uppercase text-slate-900 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-slate-600 shrink-0">(FOR</span>
                <input
                  type="text"
                  value={vd.designStandard}
                  onChange={(e) => handleValveDetailChange('designStandard', e.target.value)}
                  placeholder="API 6D 25TH ED."
                  className="flex-1 bg-white border border-slate-200 focus:border-brand-500 rounded px-2 py-0.5 text-[11px] font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500 uppercase"
                />
                <span className="text-[10px] font-semibold text-slate-600">)</span>
              </div>

              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                <div>
                  <label className="block text-[8.5px] font-bold text-slate-400 uppercase text-center">Item Code</label>
                  <input
                    type="text"
                    value={vd.itemCode}
                    onChange={(e) => handleValveDetailChange('itemCode', e.target.value)}
                    placeholder="P262704101"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-700 text-center focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-bold text-slate-400 uppercase text-center">Size</label>
                  <input
                    type="text"
                    value={vd.size}
                    onChange={(e) => handleValveDetailChange('size', e.target.value)}
                    placeholder="100MM"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded px-1.5 py-0.5 text-[11px] font-black text-brand-900 text-center focus:outline-none focus:ring-1 focus:ring-brand-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-bold text-slate-400 uppercase text-center">Class</label>
                  <input
                    type="text"
                    value={vd.pressureClass}
                    onChange={(e) => handleValveDetailChange('pressureClass', e.target.value)}
                    placeholder="300#"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded px-1.5 py-0.5 text-[11px] font-black text-brand-900 text-center focus:outline-none focus:ring-1 focus:ring-brand-500 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-[8.5px] font-bold text-slate-400 uppercase text-center">Ends</label>
                  <input
                    type="text"
                    value={vd.endConnection}
                    onChange={(e) => handleValveDetailChange('endConnection', e.target.value)}
                    placeholder="BW"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 rounded px-1.5 py-0.5 text-[11px] font-black text-brand-900 text-center focus:outline-none focus:ring-1 focus:ring-brand-500 uppercase"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Box (Logo & Badge) */}
          <div className="md:col-span-2 p-4 flex flex-col items-center justify-center text-center bg-slate-50/50">
            <img src="/logo.png" onError={(e) => { e.target.style.display = 'none'; }} alt="Petro Valves" className="h-10 object-contain mb-1.5" />
            <div className="text-xs font-black text-[#c0392b] tracking-wider uppercase">Petro Valves Pvt. Ltd.</div>
            <div className="text-[10px] font-bold text-slate-500 mt-1">Quality Assurance</div>
            
            <button
              type="button"
              onClick={() => setShowMocPanel(!showMocPanel)}
              className="mt-3 inline-flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold text-brand-700 bg-brand-50 hover:bg-brand-100 rounded-lg border border-brand-200 transition-all"
            >
              <SlidersHorizontal className="w-3 h-3" />
              {showMocPanel ? 'Hide MOCs' : 'Edit MOC Specs'}
              {showMocPanel ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Collapsible Valve Material MOCs Editor */}
        {showMocPanel && (
          <div className="bg-slate-50/90 border-t-2 border-slate-300 p-4 transition-all animate-in slide-in-from-top-2">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-brand-600" />
                Valve Material of Construction (MOC) Specifications
              </h3>
              <span className="text-[10px] text-slate-500">These grades populate the MOC columns in the Inspection Matrix</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Body / Bonnet / Trunnion MOC</label>
                <input
                  type="text"
                  value={vd.bodyMoc}
                  onChange={(e) => handleValveDetailChange('bodyMoc', e.target.value)}
                  placeholder="ASTM A216 Gr. WCC"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Ball / Trim MOC</label>
                <input
                  type="text"
                  value={vd.trimMoc}
                  onChange={(e) => handleValveDetailChange('trimMoc', e.target.value)}
                  placeholder="ASTM A351 CF8M"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Stem MOC</label>
                <input
                  type="text"
                  value={vd.stemMoc}
                  onChange={(e) => handleValveDetailChange('stemMoc', e.target.value)}
                  placeholder="ASTM A479 Gr. 410"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Seat Holder MOC</label>
                <input
                  type="text"
                  value={vd.seatMoc}
                  onChange={(e) => handleValveDetailChange('seatMoc', e.target.value)}
                  placeholder="ASTM A182 Gr. F6A / Devlon"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Fastener MOC (Stud / Nut)</label>
                <input
                  type="text"
                  value={vd.fastenerMoc}
                  onChange={(e) => handleValveDetailChange('fastenerMoc', e.target.value)}
                  placeholder="ASTM A193 Gr. B7 / A194 Gr. 2H"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Pup Piece MOC</label>
                <input
                  type="text"
                  value={vd.pupPieceMoc}
                  onChange={(e) => handleValveDetailChange('pupPieceMoc', e.target.value)}
                  placeholder="ASTM A106 Gr. B"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Painting / DFT Specification</label>
                <input
                  type="text"
                  value={vd.paintingDft}
                  onChange={(e) => handleValveDetailChange('paintingDft', e.target.value)}
                  placeholder="120 Micron"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-700 mb-0.5">Testing Standard</label>
                <input
                  type="text"
                  value={vd.testingStandard}
                  onChange={(e) => handleValveDetailChange('testingStandard', e.target.value)}
                  placeholder="API 6D / API 598"
                  className="w-full bg-white border border-slate-300 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* Title Banner */}
        <div className="bg-slate-100 border-t-2 border-slate-900 py-1.5 text-center text-sm font-black italic tracking-wider uppercase text-slate-900 font-serif">
          QUALITY ASSURANCE PLAN
        </div>
      </div>

      {/* FULL 10-COLUMN PETRO VALVES INSPECTION & TEST MATRIX (EVERY CELL EDITABLE) */}
      <div className="bg-white rounded-2xl border-2 border-slate-900 shadow-sm overflow-hidden">
        <div className="p-3 sm:p-4 bg-slate-50 border-b-2 border-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-brand-600 shrink-0" />
            <div>
              <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Inspection &amp; Test Matrix
              </h2>
              <div className="text-[11px] text-slate-500 font-medium">
                Click any cell to edit directly. Format No. R/5.2/1 Rev01 &bull; {formData.activities.length} Inspection Stages
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAddRow('RAW MATERIAL (CRITICAL)', '1')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-800 border border-brand-200 rounded-lg text-xs font-bold transition-all shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 text-brand-600" /> Add Inspection Stage
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-black shadow-xs transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save All
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs min-w-[1080px]">
            <thead>
              <tr className="bg-slate-100 text-slate-900 border-b border-slate-900 font-black text-[11px]">
                <th rowSpan="2" className="border-r border-slate-300 px-2 py-2 text-center w-12">Sr. No.</th>
                <th rowSpan="2" className="border-r border-slate-300 px-3 py-2 w-48">COMPONENTS &amp; OPERATIONS</th>
                <th rowSpan="2" className="border-r border-slate-300 px-3 py-2 w-44">TYPE OF CHECK</th>
                <th rowSpan="2" className="border-r border-slate-300 px-2 py-2 text-center w-36">QUANTAM OF CHECK</th>
                <th rowSpan="2" className="border-r border-slate-300 px-3 py-2 w-44">REFERANCE DOCUMENT</th>
                <th rowSpan="2" className="border-r border-slate-300 px-3 py-2 w-48">ACCEPTANCE NORMS</th>
                <th rowSpan="2" className="border-r border-slate-300 px-3 py-2 w-40">FORMAT OF RECORD</th>
                <th rowSpan="2" className="border-r border-slate-300 px-2 py-2 text-center w-20">I / O</th>
                <th colSpan="2" className="px-2 py-1 text-center border-b border-slate-300 w-36">INSPECTION</th>
                <th rowSpan="2" className="px-2 py-2 text-center w-16">ACT</th>
              </tr>
              <tr className="bg-slate-50 text-slate-800 font-black text-[10px] border-b border-slate-900">
                <th className="border-r border-slate-300 px-1 py-1 text-center w-18">PVPL</th>
                <th className="border-r border-slate-300 px-1 py-1 text-center w-18">TPI / CLIENT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {formData.activities && formData.activities.length > 0 ? (
                formData.activities.map((act, idx) => {
                  const isNewSection = idx === 0 || act.sectionTitle !== formData.activities[idx - 1].sectionTitle;
                  return (
                    <React.Fragment key={act._id || idx}>
                      {/* Section Heading Banner with Add Row within section */}
                      {isNewSection && act.sectionTitle && (
                        <tr className="bg-[#0b3b60]/10 text-[#0b3b60] border-y-2 border-slate-400">
                          <td className="px-2 py-1.5 text-center font-black">
                            <input
                              type="text"
                              value={act.sectionNo || ''}
                              onChange={(e) => handleActivityChange(idx, 'sectionNo', e.target.value)}
                              placeholder="#"
                              className="w-8 text-center bg-transparent border-b border-[#0b3b60]/30 font-black focus:outline-none focus:border-[#0b3b60]"
                            />
                          </td>
                          <td colSpan="9" className="px-3 py-1.5 font-black uppercase tracking-wider text-xs">
                            <div className="flex items-center justify-between gap-3">
                              <input
                                type="text"
                                value={act.sectionTitle}
                                onChange={(e) => handleSectionTitleChange(act.sectionTitle, e.target.value)}
                                className="flex-1 bg-transparent border-b border-[#0b3b60]/30 font-black uppercase focus:outline-none focus:border-[#0b3b60]"
                              />
                              <button
                                type="button"
                                onClick={() => handleAddRow(act.sectionTitle, act.sectionNo, idx)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-[#0b3b60] bg-white/70 hover:bg-white px-2 py-0.5 rounded shadow-2xs border border-[#0b3b60]/20"
                              >
                                <Plus className="w-3 h-3" /> Add Stage to Section
                              </button>
                            </div>
                          </td>
                          <td className="px-1 py-1 text-center"></td>
                        </tr>
                      )}

                      <tr className="hover:bg-brand-50/20 transition-colors group">
                        {/* Sr. No. */}
                        <td className="border-r border-slate-200 px-1 py-1 text-center font-mono text-slate-600 font-bold">
                          <input
                            type="text"
                            value={act.srNo || ''}
                            onChange={(e) => handleActivityChange(idx, 'srNo', e.target.value)}
                            className="w-full text-center bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded py-1 text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        </td>

                        {/* Component & Operations */}
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <textarea
                            value={act.component || ''}
                            onChange={(e) => handleActivityChange(idx, 'component', e.target.value)}
                            placeholder="Component name..."
                            rows={act.component?.length > 25 ? 2 : 1}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded px-1.5 py-1 text-xs font-bold text-slate-900 resize-y focus:outline-none focus:ring-1 focus:ring-brand-500 leading-snug"
                          />
                        </td>

                        {/* Type of Check */}
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <textarea
                            value={act.typeOfCheck || ''}
                            onChange={(e) => handleActivityChange(idx, 'typeOfCheck', e.target.value)}
                            placeholder="Check / Test..."
                            rows={act.typeOfCheck?.length > 25 ? 2 : 1}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded px-1.5 py-1 text-xs font-semibold text-slate-800 resize-y focus:outline-none focus:ring-1 focus:ring-brand-500 leading-snug"
                          />
                        </td>

                        {/* Quantum of Check */}
                        <td className="border-r border-slate-200 px-1.5 py-1 text-center">
                          <textarea
                            value={act.quantumOfCheck || ''}
                            onChange={(e) => handleActivityChange(idx, 'quantumOfCheck', e.target.value)}
                            placeholder="Quantum..."
                            rows={1}
                            className="w-full text-center bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded px-1 py-1 text-xs text-slate-700 resize-none focus:outline-none focus:ring-1 focus:ring-brand-500 font-medium"
                          />
                        </td>

                        {/* Reference Document */}
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <textarea
                            value={act.referenceDocument || ''}
                            onChange={(e) => handleActivityChange(idx, 'referenceDocument', e.target.value)}
                            placeholder="Reference standard..."
                            rows={act.referenceDocument?.length > 30 ? 2 : 1}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded px-1.5 py-1 text-xs text-slate-700 resize-y focus:outline-none focus:ring-1 focus:ring-brand-500 leading-snug font-medium"
                          />
                        </td>

                        {/* Acceptance Norms */}
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <textarea
                            value={act.acceptanceNorms || ''}
                            onChange={(e) => handleActivityChange(idx, 'acceptanceNorms', e.target.value)}
                            placeholder="Acceptance criteria..."
                            rows={act.acceptanceNorms?.length > 30 ? 2 : 1}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded px-1.5 py-1 text-xs text-slate-700 resize-y focus:outline-none focus:ring-1 focus:ring-brand-500 leading-snug font-medium"
                          />
                        </td>

                        {/* Format of Record */}
                        <td className="border-r border-slate-200 px-1.5 py-1">
                          <textarea
                            value={act.formatOfRecord || ''}
                            onChange={(e) => handleActivityChange(idx, 'formatOfRecord', e.target.value)}
                            placeholder="Report / Certificate..."
                            rows={act.formatOfRecord?.length > 25 ? 2 : 1}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded px-1.5 py-1 text-xs text-slate-700 resize-y focus:outline-none focus:ring-1 focus:ring-brand-500 leading-snug"
                          />
                        </td>

                        {/* I / O */}
                        <td className="border-r border-slate-200 px-1 py-1 text-center">
                          <select
                            value={act.inHouseOutSource || 'I'}
                            onChange={(e) => handleActivityChange(idx, 'inHouseOutSource', e.target.value)}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded py-1 text-xs font-black text-slate-900 text-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="I">I</option>
                            <option value="O">O</option>
                            <option value="I/O">I/O</option>
                            <option value="Foundry">Foundry</option>
                          </select>
                        </td>

                        {/* PVPL */}
                        <td className="border-r border-slate-200 px-1 py-1 text-center bg-brand-50/20">
                          <select
                            value={act.inspectionPvpl || 'P'}
                            onChange={(e) => handleActivityChange(idx, 'inspectionPvpl', e.target.value)}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded py-1 text-xs font-black text-brand-800 text-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="P">P</option>
                            <option value="P/H">P/H</option>
                            <option value="R">R</option>
                            <option value="W">W</option>
                            <option value="H">H</option>
                            <option value="--">--</option>
                          </select>
                        </td>

                        {/* TPI / CLIENT */}
                        <td className="border-r border-slate-200 px-1 py-1 text-center bg-emerald-50/20">
                          <select
                            value={act.inspectionTpi || 'R'}
                            onChange={(e) => handleActivityChange(idx, 'inspectionTpi', e.target.value)}
                            className="w-full bg-transparent hover:bg-white focus:bg-white border border-transparent hover:border-slate-300 focus:border-brand-500 rounded py-1 text-xs font-black text-emerald-800 text-center cursor-pointer focus:outline-none focus:ring-1 focus:ring-brand-500"
                          >
                            <option value="R">R</option>
                            <option value="W">W</option>
                            <option value="H">H</option>
                            <option value="P">P</option>
                            <option value="W/R">W/R</option>
                            <option value="--">--</option>
                          </select>
                        </td>

                        {/* Actions (Delete / Insert) */}
                        <td className="px-1 py-1 text-center">
                          <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => handleAddRow(act.sectionTitle, act.sectionNo, idx)}
                              title="Insert row below"
                              className="p-1 hover:bg-brand-50 text-slate-400 hover:text-brand-600 rounded transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRow(idx)}
                              title="Delete stage"
                              className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="11" className="p-8 text-center text-slate-400 italic">
                    No inspection activities recorded. Click "+ Add Inspection Stage" above to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Table Toolbar */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={() => handleAddRow('FINAL INSPECTION', '6')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-bold transition-all shadow-2xs"
          >
            <Plus className="w-3.5 h-3.5 text-brand-600" /> + Add Row at Bottom
          </button>

          <span className="text-[11px] font-semibold text-slate-500">
            Total {formData.activities.length} Inspection Activity Rows
          </span>
        </div>

        {/* Official Notes, Remarks & Sign-off Box */}
        <div className="p-4 bg-slate-50 border-t-2 border-slate-900 space-y-3">
          <div className="text-[11px] leading-relaxed text-slate-700">
            <strong>Note:</strong> P - Perform, &nbsp;R - Review :- Doc/MTC/Inspection Reports will be reviewed, &nbsp;H - Hold:- Without completion of this stage further stage shall not be performed, &nbsp;W - Witness:- Test Will be performed in their presence, &nbsp;* - When required by contracts / Customer.
          </div>
          <div className="text-[11px] leading-relaxed text-slate-700">
            <strong>Remark:</strong>
            <div className="pl-3 space-y-0.5 mt-0.5 text-[10.5px]">
              <div>1) For Material Specification refer "Material Specification Sheet" No. R-5.5.2-2 Rev.01 for Respective Material Grade &amp; Approved GAD.</div>
              <div>2) For Pup welding and overlay welding refer WPS/PQR made by Petro Valves Pvt. Limited</div>
              <div>3) For NDT (LPT, UT, RT, MPT, Helium leak test) &amp; Final Testing if QSL Level given by client follow table of API 6D Ann-I.</div>
              <div>4) When Revision / Edition of Standard/documents are not given in QAP then latest edition / Rev. applies after its effectiveness.</div>
              <div>5) ENP, Hydro test, and Painting Refer Procedure of Petro Valves Pvt. Ltd for reference and Acceptance.</div>
            </div>
          </div>

          {/* Footer Editable Sign-offs & Format Line */}
          <div className="pt-3 border-t border-slate-300 grid grid-cols-1 md:grid-cols-4 items-center gap-3 text-xs font-bold text-slate-800">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase shrink-0">Format:</span>
              <input
                type="text"
                value={formData.formatNo}
                onChange={(e) => handleHeaderChange('formatNo', e.target.value)}
                placeholder="Format No.R/5.2/1 Rev01"
                className="flex-1 bg-white border border-slate-200 focus:border-brand-500 rounded px-2 py-1 text-[11px] font-semibold"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase shrink-0">Prepared By:</span>
              <input
                type="text"
                value={formData.preparedByName}
                onChange={(e) => handleHeaderChange('preparedByName', e.target.value)}
                placeholder="QC Engg."
                className="flex-1 bg-white border border-slate-200 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold"
              />
            </div>

            <div className="flex items-center justify-center">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-[#0b3b60] font-black text-[10px] border border-blue-200 shadow-2xs">
                <Stamp className="w-3.5 h-3.5 mr-1.5" /> PETRO VALVES QUALITY CONTROL
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-500 uppercase shrink-0">Approved By:</span>
              <input
                type="text"
                value={formData.approvedByName}
                onChange={(e) => handleHeaderChange('approvedByName', e.target.value)}
                placeholder="Incharge Q.C."
                className="flex-1 bg-white border border-slate-200 focus:border-brand-500 rounded px-2 py-1 text-xs font-bold"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Save Sticky Bar when modified */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900/95 backdrop-blur-md text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border border-slate-700 animate-in slide-in-from-bottom-5">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span className="text-sm font-bold">You have unsaved changes to this QAP</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscardChanges}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-all"
            >
              Discard
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs shadow-md transition-all"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save All Changes
            </button>
          </div>
        </div>
      )}

      {/* Supplementary Verification & Authorization Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Custom QC Fields (Dynamic) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-600" /> Custom QC Fields
              </h2>
              <button onClick={handleSaveAll} disabled={saving || !ability.can('editActivities', 'QAP')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-all">
                {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save Custom Fields
              </button>
            </div>
            <DynamicFormRenderer
              formContext="QAP"
              values={dynamicValues}
              onChange={handleDynamicFieldChange}
              readOnly={!ability.can('editActivities', 'QAP')}
              currentUserRole={currentUser.role}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Approval Workflow */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
               <PenTool className="w-5 h-5 text-brand-600" /> Authorization
            </h2>
            <div className="space-y-6">
               <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-900 uppercase tracking-tight">Prepared By</p>
                    <p className="text-xs text-emerald-700 font-medium mt-1">{formData.preparedByName || qap.preparedBy?.fullName || 'QC Engg.'}</p>
                    <p className="text-[10px] text-emerald-600/60 mt-0.5">
                      {qap.createdAt ? new Date(qap.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Pending'}
                    </p>
                  </div>
               </div>

               <div className={`p-4 rounded-xl border flex items-start gap-3 ${qap.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                  {qap.status === 'APPROVED' ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" /> : <Clock className="w-5 h-5 text-slate-400 mt-0.5" />}
                  <div>
                    <p className={`text-sm font-bold uppercase tracking-tight ${qap.status === 'APPROVED' ? 'text-emerald-900' : 'text-slate-500'}`}>Director Approval</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">{formData.approvedByName || qap.approvedBy?.fullName || 'Pending Review'}</p>
                    {qap.status === 'APPROVED' && <div className="mt-2 inline-flex items-center text-[10px] font-black text-emerald-800 tracking-widest bg-emerald-200/50 px-2 py-0.5 rounded uppercase"><PenTool className="w-3 h-3 mr-1" /> Digitally Signed</div>}
                  </div>
               </div>
            </div>
          </div>
          
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
             <h3 className="font-black uppercase tracking-widest text-[10px] text-blue-100 mb-2">Notice</h3>
             <p className="text-sm font-medium leading-relaxed">System-generated QAPs follow Petro Valves Format No. R/5.2/1 Rev01. Any field modified in this matrix is saved and updated in the official PDF download.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QapDetail;
