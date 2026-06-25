import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ClipboardCheck, Download, User as UserIcon, CheckCircle, CheckCircle2,
  Clock, AlertCircle, ArrowLeft, Loader2, PenTool, ShieldCheck,
  Printer, Send, X, AlertTriangle, Stamp
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
  const [updateLoading, setUpdateLoading] = useState(false);
  
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [dynamicValues, setDynamicValues] = useState({});
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qRes = await api.get(`/qaps/${id}`);
        if (qRes.data.data?.qap) setQap(qRes.data.data.qap);
        
        // Side data fetch
        api.get('/auth/users')
          .then(res => { if (res.data.data?.users) setUsers(res.data.data.users); })
          .catch(err => console.error('Failed to fetch users:', err));

      } catch (err) {
        console.error('Fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  useEffect(() => {
    if (qap?.dynamicFields) setDynamicValues(qap.dynamicFields);
  }, [qap]);

  const handleDynamicFieldChange = (fieldName, value) => {
    setDynamicValues(prev => ({ ...prev, [fieldName]: value }));
  };

  const saveDynamicFields = async () => {
    setUpdateLoading(true);
    try {
      const res = await api.patch(`/qaps/${id}/status`, { dynamicFields: dynamicValues });
      setQap(res.data.data.qap);
    } catch (err) { alert('Failed to save: ' + (err.response?.data?.message || err.message)); }
    finally { setUpdateLoading(false); }
  };

  const handleUpdate = async (update) => {
    setUpdateLoading(true);
    try {
      const res = await api.patch(`/qaps/${id}/status`, update);
      setQap(res.data.data.qap);
      showToast('QAP updated');
    } catch (err) {
      showToast('Update failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  // Final approve & sign QAP (Director only)
  const handleFinalApprove = async () => {
    if (!confirm('Final approve and digitally sign this QAP? The customer will be able to view it.')) return;
    await handleUpdate({ status: 'APPROVED', approvedBy: currentUser.id || currentUser._id, signedAt: new Date().toISOString() });
  };

  // Send to client (generate share link / mark sent)
  const handleSendToClient = async () => {
    if (!confirm('Mark this QAP as sent to customer?')) return;
    await handleUpdate({ sentToClient: true, sentAt: new Date().toISOString() });
    showToast('QAP marked as sent to customer');
  };

  // Print PDF
  const handlePrint = () => window.print();


  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
    </div>
  );

  if (!qap) return <div className="p-8 text-center text-slate-500 font-medium">QAP not found.</div>;

  const userRoleCode = getRoleCode(currentUser.role);
  const userSecRoleCode = getRoleCode(currentUser.secondaryRole);
  const userRoles = [userRoleCode, userSecRoleCode].filter(Boolean);
  const canFinalSignOff = ability.can('finalSignOff', 'QAP');
  const canApproveChecklist = ability.can('approveChecklist', 'QAP');
  
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back to List</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{qap.qapId || 'QAP Draft'}</h1>
              <StatusBadge status={qap.status} />
            </div>
            <p className="text-sm text-slate-500 font-medium mt-1">Order Ref: {qap.quotation?.quotationId || 'Internal'}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {updateLoading && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center overflow-visible">
             <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-500">Assign</div>
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
               placeholder="Assign to user..."
               allowClear={false}
               className="w-48"
             />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex items-center overflow-visible">
             <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-xs font-bold text-slate-500">Status</div>
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
               placeholder="Select status..."
               allowClear={false}
               className="w-40"
             />
          </div>

          {/* Final Approve & Sign — Director only */}
          {canFinalSignOff && qap.status === 'UNDER_REVIEW' && (
            <button onClick={handleFinalApprove}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all">
              <Stamp className="w-4 h-4" /> Final Approve & Sign
            </button>
          )}

          {ability.can('sendToClient', 'QAP') && (
            <button onClick={handleSendToClient}
              disabled={qap.status !== 'APPROVED'}
              title={qap.status !== 'APPROVED' ? 'QAP must be approved before sending' : ''}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all">
              <Send className="w-4 h-4" /> Send to Client
            </button>
          )}

          {ability.can('downloadPdf', 'QAP') && (
            <button onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all">
              <Printer className="w-4 h-4" /> Print PDF
            </button>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Inspection Matrix */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
               <ClipboardCheck className="w-5 h-5 text-brand-600" /> Inspection & Test Matrix
            </h2>
            <div className="overflow-x-auto border border-slate-100 rounded-xl">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Act No.</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Activity Name</th>
                    <th className="px-4 py-3 text-left text-[10px] font-black text-slate-500 uppercase tracking-widest">Ref Doc</th>
                    <th className="px-4 py-3 text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">Inspection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 bg-white">
                  {qap.activities?.map((act, idx) => (
                    <tr key={idx} className="text-sm">
                      <td className="px-4 py-4 text-slate-500 font-mono">{act.activityNo}</td>
                      <td className="px-4 py-4 text-slate-900 font-bold">{act.activityName}</td>
                      <td className="px-4 py-4 text-slate-600 font-medium">{act.referenceDocument}</td>
                      <td className="px-4 py-4 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-black text-[10px] border border-slate-200">
                          {act.inspectionType}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {!qap.activities?.length && (
                    <tr><td colSpan="4" className="p-8 text-center text-slate-400 italic">No inspection activities mapped yet.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Verification */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
               <ShieldCheck className="w-5 h-5 text-brand-600" /> Documentation Requirements
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {qap.documents?.map((doc, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <span className="text-sm font-bold text-slate-700">{doc.documentType}</span>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-wider bg-white px-2 py-1 rounded shadow-xs border border-slate-100">{doc.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom QC Fields (Dynamic) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-brand-600" /> Custom QC Fields
              </h2>
              <button onClick={saveDynamicFields} disabled={updateLoading || !ability.can('editActivities', 'QAP')} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-bold transition-all">
                {updateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                Save Fields
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
                    <p className="text-xs text-emerald-700 font-medium mt-1">Jagadeesh (Design Eng.)</p>
                    <p className="text-[10px] text-emerald-600/60 mt-0.5">Jan 12, 2026</p>
                  </div>
               </div>

               <div className={`p-4 rounded-xl border flex items-start gap-3 ${qap.status === 'APPROVED' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-200'}`}>
                  {qap.status === 'APPROVED' ? <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5" /> : <Clock className="w-5 h-5 text-slate-400 mt-0.5" />}
                  <div>
                    <p className={`text-sm font-bold uppercase tracking-tight ${qap.status === 'APPROVED' ? 'text-emerald-900' : 'text-slate-500'}`}>Director Approval</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">{qap.approvedBy?.fullName || 'Pending Review'}</p>
                    {qap.status === 'APPROVED' && <div className="mt-2 inline-flex items-center text-[10px] font-black text-emerald-800 tracking-widest bg-emerald-200/50 px-2 py-0.5 rounded uppercase"><PenTool className="w-3 h-3 mr-1" /> Digitally Signed</div>}
                  </div>
               </div>
            </div>
          </div>
          
          <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
             <h3 className="font-black uppercase tracking-widest text-[10px] text-blue-100 mb-2">Notice</h3>
             <p className="text-sm font-medium leading-relaxed">System-generated QAPs are based on ASME Section VIII Division 1 requirements. All manual overrides must be logged.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QapDetail;
