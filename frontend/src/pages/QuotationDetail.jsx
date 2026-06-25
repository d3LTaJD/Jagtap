import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FileText, Download, User as UserIcon, CheckCircle, CheckCircle2,
  Clock, AlertCircle, ArrowLeft, Loader2, IndianRupee,
  Send, GitBranch, Printer, Lock, X, AlertTriangle, Save, File,
  Edit, Sliders, Shield, FileSpreadsheet, Settings, HelpCircle
} from 'lucide-react';
import api from '../api/client';
import { getRoleCode, useAbility } from '../context/AbilityContext';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import AutocompleteSelect from '../components/AutocompleteSelect';
import AttachmentManager from '../components/AttachmentManager';
import EmailComposerModal from '../components/EmailComposerModal';

const StatusBadge = ({ status }) => {
  const colors = {
    'DRAFT': 'bg-slate-100 text-slate-700 border-slate-200',
    'TECH_REVIEW': 'bg-blue-50 text-blue-700 border-blue-200',
    'PENDING_APPROVAL': 'bg-amber-50 text-amber-700 border-amber-200',
    'APPROVED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'REJECTED': 'bg-red-50 text-red-700 border-red-200',
  };
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colors[status] || 'bg-slate-50 text-slate-600'}`}>
      {status}
    </span>
  );
};

const QuotationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const ability = useAbility();
  const [quotation, setQuotation] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updateLoading, setUpdateLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [showRevisionPanel, setShowRevisionPanel] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [revisionNote, setRevisionNote] = useState('');
  
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const [activeTab, setActiveTab] = useState('technical'); // 'technical' | 'pricing' | 'commercial'
  const [activeItemIndex, setActiveItemIndex] = useState(null); // for item specs drawer

  // Local state for editable parts
  const [items, setItems] = useState([]);
  const [techFields, setTechFields] = useState({
    manufacturerName: '',
    originOfGoods: '',
    weightDimensions: '',
    technicalDocuments: '',
    deliveryTimeHeader: ''
  });
  const [commFields, setCommFields] = useState({
    priceBasis: '',
    packingForwardingTerms: '',
    freightTerms: '',
    taxDutyTerms: '',
    validityTerms: '',
    tpiTerms: '',
    transitInsurance: '',
    guaranteeTerms: '',
    paymentTerms: '',
    deliverySchedule: ''
  });

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qRes = await api.get(`/quotations/${id}`);
        if (qRes.data.data?.quotation) {
          const q = qRes.data.data.quotation;
          setQuotation(q);
          const populatedItems = (q.items || []).map(item => ({
            ...item,
            productCategory: item.productCategory || q.enquiry?.productCategory || 'Piping'
          }));
          setItems(populatedItems);
          setTechFields({
            manufacturerName: q.manufacturerName || 'M/s. PETRO VALVES PVT LTD',
            originOfGoods: q.originOfGoods || 'INDIA',
            weightDimensions: q.weightDimensions || 'This details given at the time of dispatch',
            technicalDocuments: q.technicalDocuments || 'This is share after receiving of techno-commercial order',
            deliveryTimeHeader: q.deliveryTimeHeader || 'Provided in COMMERCIAL PART - III'
          });
          setCommFields({
            priceBasis: q.priceBasis || 'Ex Works Ahmedabad.',
            packingForwardingTerms: q.packingForwardingTerms || 'Extra as given in Price Part - II, If required in wooden box then charge extra',
            freightTerms: q.freightTerms || 'Extra at actual to your account.',
            taxDutyTerms: q.taxDutyTerms || 'Extra at actual to your account (18% GST default)',
            validityTerms: q.validityTerms || 'Three Month from the date of Quote',
            tpiTerms: q.tpiTerms || 'We will offer valves to your nominated TPIA agency. Charges towards TPIA fees will be to your account.',
            transitInsurance: q.transitInsurance || 'In your scope only.',
            guaranteeTerms: q.guaranteeTerms || '12 months from the date of commissioning or 18 months from the date of dispatch',
            paymentTerms: q.paymentTerms || '10% Advance along with PO & balance payment 90% against Proforma Invoice before dispatch.',
            deliverySchedule: q.deliverySchedule || ''
          });
        }
        
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

  const handleItemPricingChange = (idx, field, val) => {
    const newItems = [...items];
    newItems[idx][field] = Number(val) || 0;
    
    // Recalculate line total excl GST
    const unitPrice = newItems[idx].unitPrice || 0;
    const ndt = newItems[idx].ndtCharges || 0;
    const spec = newItems[idx].specialTestingCharges || 0;
    const spares = newItems[idx].sparesCharges || 0;
    const cert = newItems[idx].cert32Charges || 0;
    const pf = newItems[idx].pfCharges || 0;
    const tpi = newItems[idx].tpiCharges || 0;
    const discount = newItems[idx].discountPercent || 0;

    const unitRateBeforeDiscount = unitPrice + ndt + spec + spares + cert + pf + tpi;
    const unitRate = unitRateBeforeDiscount * (1 - discount / 100);
    newItems[idx].lineTotalExclGST = unitRate * (newItems[idx].quantity || 1);
    
    setItems(newItems);
  };

  const calculateTotals = () => {
    let subtotal = 0;
    items.forEach(item => {
      const unitPrice = Number(item.unitPrice || 0);
      const ndt = Number(item.ndtCharges || 0);
      const spec = Number(item.specialTestingCharges || 0);
      const spares = Number(item.sparesCharges || 0);
      const cert = Number(item.cert32Charges || 0);
      const pf = Number(item.pfCharges || 0);
      const tpi = Number(item.tpiCharges || 0);
      const discount = Number(item.discountPercent || 0);

      const unitRate = (unitPrice + ndt + spec + spares + cert + pf + tpi) * (1 - discount / 100);
      subtotal += unitRate * Number(item.quantity || 1);
    });

    const gst = subtotal * 0.18;
    const grand = subtotal + gst;
    return { subtotal, gst, grand };
  };

  const saveAllDetails = async () => {
    setUpdateLoading(true);
    const { subtotal } = calculateTotals();
    const payload = {
      items,
      ...techFields,
      ...commFields,
      commercialTotals: {
        subtotalExclGST: subtotal,
        totalGST: subtotal * 0.18,
        grandTotal: subtotal
      }
    };
    try {
      const res = await api.patch(`/quotations/${id}/status`, payload);
      setQuotation(res.data.data.quotation);
      showToast('Quotation details saved successfully!');
    } catch (err) {
      showToast('Failed to save details: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleUpdate = async (update) => {
    setUpdateLoading(true);
    try {
      const res = await api.patch(`/quotations/${id}/status`, update);
      setQuotation(res.data.data.quotation);
      showToast('Quotation updated successfully!');
    } catch (err) {
      showToast('Update failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!confirm('Approve this quotation? This will mark it as officially approved.')) return;
    await handleUpdate({ status: 'APPROVED', approvedBy: currentUser.id || currentUser._id });
  };

  const handleGeneratePdf = async () => {
    setUpdateLoading(true);
    try {
      showToast('Generating official modern PDF...', 'success');
      const res = await api.post(`/quotations/${id}/generate-pdf`);
      setQuotation(res.data.data.quotation);
      showToast('Official PDF generated and attached!', 'success');
    } catch (err) {
      showToast('Generation failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = prompt('Enter rejection reason (optional):');
    await handleUpdate({ status: 'REJECTED', rejectionReason: reason || '' });
  };

  const handleSaveRevision = async () => {
    if (!revisionNote.trim()) return;
    setUpdateLoading(true);
    try {
      const existing = quotation.revisionNotes || [];
      const newNote = { note: revisionNote, addedBy: currentUser.name, addedAt: new Date().toISOString() };
      const res = await api.patch(`/quotations/${id}/status`, { revisionNotes: [...existing, newNote] });
      setQuotation(res.data.data.quotation);
      setRevisionNote('');
      setShowRevisionPanel(false);
      showToast('Revision note added');
    } catch (err) {
      showToast('Failed to save revision', 'error');
    } finally {
      setUpdateLoading(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-600 animate-spin" />
    </div>
  );

  if (!quotation) return <div className="p-8 text-center text-slate-500 font-medium">Quotation not found.</div>;

  const userRoleCode = getRoleCode(currentUser.role);
  const userSecRoleCode = getRoleCode(currentUser.secondaryRole);
  const userRoles = [userRoleCode, userSecRoleCode].filter(Boolean);
  const isDirector = ability.can('approve', 'Quotation');
  const canSeePricing = ability.can('viewPricing', 'Quotation');
  const isApproved = quotation.status === 'APPROVED';
  
  const { subtotal, gst, grand } = calculateTotals();

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back to List</span>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{quotation.quotationId || 'Draft'}</h1>
            <StatusBadge status={quotation.status} />
          </div>
          <p className="text-sm text-slate-500 font-medium mt-1">Ref Enquiry: {quotation.enquiry?.enquiryId || 'N/A'}</p>
        </div>
        
        <div className="flex items-center gap-3 flex-wrap">
          {updateLoading && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}
          
          <button onClick={saveAllDetails} disabled={updateLoading || isApproved || (!ability.can('editTechnical', 'Quotation') && !ability.can('editCommercial', 'Quotation'))}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-50">
            <Save className="w-4 h-4" /> Save Quotation
          </button>

          {isDirector && quotation.status === 'PENDING_APPROVAL' && (
            <>
              <button onClick={handleApprove}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold shadow-sm transition-all">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
              <button onClick={handleReject}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-sm font-bold transition-all">
                <X className="w-4 h-4" /> Reject
              </button>
            </>
          )}

          <button onClick={() => setShowRevisionPanel(p => !p)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
            <GitBranch className="w-4 h-4" /> Revision
          </button>

          <button onClick={() => setShowEmailModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all">
            <Send className="w-4 h-4 text-brand-600" /> Email
          </button>

          <button onClick={handleGeneratePdf} disabled={updateLoading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-xl text-sm font-bold shadow-sm transition-all disabled:opacity-60">
            {updateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate PDF
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 bg-brand-900 text-white`}>
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          {toast.msg}
        </div>
      )}

      {showRevisionPanel && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3 mb-4">
          <h4 className="text-xs font-black text-amber-700 uppercase tracking-widest">Add Revision Note</h4>
          <textarea
            value={revisionNote}
            onChange={e => setRevisionNote(e.target.value)}
            rows={3}
            placeholder="Describe the change or revision reason..."
            className="w-full px-3.5 py-2.5 bg-white border border-amber-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-400/30 focus:border-amber-400 outline-none resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowRevisionPanel(false)} className="px-4 py-1.5 border border-slate-200 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSaveRevision} disabled={updateLoading} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold">
              {updateLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Save Revision'}
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('technical')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'technical'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" /> Technical Part-I
          </div>
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'pricing'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <IndianRupee className="w-4 h-4" /> Price Part-II & Checklist
          </div>
        </button>
        <button
          onClick={() => setActiveTab('commercial')}
          className={`pb-4 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'commercial'
              ? 'border-brand-600 text-brand-600'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4" /> Commercial Part-III
          </div>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          
          {/* TAB 1: PRICING & SPECIFICATIONS CHECKLIST */}
          {activeTab === 'pricing' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Quotation Line Items</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Specify basic pricing, NDT charges, special tests, and view dynamic specifications.</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.map((item, idx) => {
                    const unitPrice = item.unitPrice || 0;
                    const ndt = item.ndtCharges || 0;
                    const spec = item.specialTestingCharges || 0;
                    const spares = item.sparesCharges || 0;
                    const cert = item.cert32Charges || 0;
                    const pf = item.pfCharges || 0;
                    const tpi = item.tpiCharges || 0;
                    const discount = item.discountPercent || 0;

                    const unitRate = (unitPrice + ndt + spec + spares + cert + pf + tpi) * (1 - discount / 100);
                    const totalRate = unitRate * (item.quantity || 1);

                    return (
                      <div key={idx} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 space-y-4 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-600"></div>
                        <div className="flex justify-between items-start gap-4">
                          <div>
                            <span className="px-2 py-0.5 bg-brand-100 text-brand-700 text-[10px] font-black rounded uppercase">Item {item.itemNo || idx + 1}</span>
                            <h3 className="font-bold text-slate-800 text-sm mt-1">{item.description}</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Category: {item.productCategory} · MOC: {item.materialGrade || 'N/A'}</p>
                          </div>
                          <button
                            onClick={() => setActiveItemIndex(idx)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all shadow-sm"
                          >
                            <Sliders className="w-3.5 h-3.5 text-brand-600" /> {ability.can('editTechnical', 'Quotation') ? 'Edit Checklist Specs' : 'View Checklist Specs'}
                          </button>
                        </div>

                        {canSeePricing && (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Quantity</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.quantity}
                                  onChange={e => handleItemPricingChange(idx, 'quantity', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Base Unit Price</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.unitPrice}
                                  onChange={e => handleItemPricingChange(idx, 'unitPrice', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">NDT Charges</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.ndtCharges}
                                  onChange={e => handleItemPricingChange(idx, 'ndtCharges', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Special Testing</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.specialTestingCharges}
                                  onChange={e => handleItemPricingChange(idx, 'specialTestingCharges', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Spares Charges</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.sparesCharges}
                                  onChange={e => handleItemPricingChange(idx, 'sparesCharges', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">P&F Charges</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.pfCharges}
                                  onChange={e => handleItemPricingChange(idx, 'pfCharges', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">TPIA Charges</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.tpiCharges}
                                  onChange={e => handleItemPricingChange(idx, 'tpiCharges', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Discount %</label>
                                <input
                                  type="number"
                                  disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                                  value={item.discountPercent}
                                  onChange={e => handleItemPricingChange(idx, 'discountPercent', e.target.value)}
                                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                                />
                              </div>
                            </div>

                            <div className="flex justify-between items-center pt-2 border-t border-slate-100 text-xs">
                              <span className="text-slate-500 font-medium">Calculated Unit Rate: <strong>₹{Math.round(unitRate).toLocaleString()}</strong></span>
                              <span className="font-bold text-slate-900">Line Total: ₹{Math.round(totalRate).toLocaleString()}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TECHNICAL PART-I */}
          {activeTab === 'technical' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Technical Part - I Details</h2>
                <p className="text-xs text-slate-500 mt-0.5">Define general technical cover page settings printed on Page 1 of the official quotation.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Manufacturer Name</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                    value={techFields.manufacturerName}
                    onChange={e => setTechFields({ ...techFields, manufacturerName: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Origin of Goods</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                    value={techFields.originOfGoods}
                    onChange={e => setTechFields({ ...techFields, originOfGoods: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Estimated Weight & Dimensions</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                    value={techFields.weightDimensions}
                    onChange={e => setTechFields({ ...techFields, weightDimensions: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Technical Documents & Drawings Rules</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                    value={techFields.technicalDocuments}
                    onChange={e => setTechFields({ ...techFields, technicalDocuments: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Delivery Basis Header Summary</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editTechnical', 'Quotation')}
                    value={techFields.deliveryTimeHeader}
                    onChange={e => setTechFields({ ...techFields, deliveryTimeHeader: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: COMMERCIAL PART-III */}
          {activeTab === 'commercial' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Commercial Part - III (Terms & Conditions)</h2>
                <p className="text-xs text-slate-500 mt-0.5">Customise commercial clauses and legal boundaries shown on Page 4 of the quotation.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Price Basis</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.priceBasis}
                    onChange={e => setCommFields({ ...commFields, priceBasis: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Packing & Forwarding Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.packingForwardingTerms}
                    onChange={e => setCommFields({ ...commFields, packingForwardingTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Freight Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.freightTerms}
                    onChange={e => setCommFields({ ...commFields, freightTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Tax & Duty Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.taxDutyTerms}
                    onChange={e => setCommFields({ ...commFields, taxDutyTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Payment Terms</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.paymentTerms}
                    onChange={e => setCommFields({ ...commFields, paymentTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Validity Terms</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.validityTerms}
                    onChange={e => setCommFields({ ...commFields, validityTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Third Party Inspection (TPIA) Terms</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.tpiTerms}
                    onChange={e => setCommFields({ ...commFields, tpiTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Transit Insurance</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.transitInsurance}
                    onChange={e => setCommFields({ ...commFields, transitInsurance: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Guarantee / Warranty Period</label>
                  <input
                    type="text"
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.guaranteeTerms}
                    onChange={e => setCommFields({ ...commFields, guaranteeTerms: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Delivery Schedule / Timeline</label>
                  <textarea
                    rows={2}
                    disabled={isApproved || !ability.can('editCommercial', 'Quotation')}
                    value={commFields.deliverySchedule}
                    onChange={e => setCommFields({ ...commFields, deliverySchedule: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 outline-none resize-none"
                    placeholder="e.g. Within 12 weeks from receipt of technically clear order..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Attachments & Files */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 mt-6">
            <h2 className="text-lg font-bold text-slate-900 mb-5 flex items-center gap-2">
              <File className="w-5 h-5 text-brand-600" /> Attachments & Files
            </h2>
            <AttachmentManager 
              moduleName="Quotation"
              entityId={id}
              uploadedFiles={[...(quotation.attachments || []), ...(quotation.files || [])]}
              onUploadComplete={(newFile) => {
                 setQuotation(prev => ({ ...prev, files: [...(prev.files || []), newFile] }));
                 handleUpdate({ files: [...(quotation.files || []).map(f => f._id || f), newFile._id] });
              }}
              readOnly={isApproved}
            />
          </div>
        </div>

        {/* SIDE PANEL */}
        <div className="space-y-6">
          {/* Commercial Summary */}
          {canSeePricing ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-full opacity-50 -mr-10 -mt-10"></div>
              <h2 className="text-lg font-bold text-slate-900 mb-6 relative z-10 flex items-center gap-2">
                 <IndianRupee className="w-5 h-5 text-brand-600" /> Commercial Summary
              </h2>
              <div className="space-y-4 relative z-10">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Subtotal (Excl. GST)</span>
                  <span className="font-bold text-slate-900">₹{Math.round(subtotal).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-500 font-medium">Estimated GST (18%)</span>
                  <span className="font-bold text-slate-900">₹{Math.round(gst).toLocaleString()}</span>
                </div>
                <hr className="border-slate-100" />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-slate-900 font-black uppercase tracking-tight">Grand Total</span>
                  <span className="text-xl font-black text-brand-600">₹{Math.round(grand).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 flex items-center gap-3 text-slate-500">
              <Lock className="w-5 h-5" />
              <div>
                <p className="text-sm font-bold text-slate-700">Pricing Hidden</p>
                <p className="text-xs">Pricing details are visible to Accounts, Sales, and Directors only.</p>
              </div>
            </div>
          )}

          {/* Revision History */}
          {(quotation.revisionNotes?.length > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
              <h3 className="text-xs font-black text-amber-700 uppercase tracking-widest mb-3">Revision History</h3>
              <div className="space-y-3">
                {quotation.revisionNotes.map((rn, i) => (
                  <div key={i} className="bg-white rounded-xl p-3 border border-amber-100">
                    <p className="text-sm font-medium text-slate-700">{rn.note}</p>
                    <p className="text-xs text-slate-400 mt-1">{rn.addedBy} · {new Date(rn.addedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Workflow Status */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6">
            <h2 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6">Workflow Progress</h2>
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.preparedBy ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Quotation Prepared</p>
                  <p className="text-xs text-slate-500">{quotation.preparedBy?.fullName || 'Pending'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.technicalReviewBy ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-400'}`}>
                  {quotation.technicalReviewBy ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Technical Review</p>
                  <p className="text-xs text-slate-500">{quotation.technicalReviewBy?.fullName || 'Pending'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${quotation.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : quotation.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-400'}`}>
                  {quotation.status === 'APPROVED' ? <CheckCircle className="w-5 h-5" /> : quotation.status === 'REJECTED' ? <AlertCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Director Approval</p>
                  <p className="text-xs text-slate-500">{quotation.approvedBy?.fullName || 'Final Step'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SPECIFICATIONS DRAWER */}
      {activeItemIndex !== null && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Contract Checklist Specifications</h3>
                <p className="text-xs text-slate-500 mt-0.5">Item {activeItemIndex + 1}: {items[activeItemIndex]?.description}</p>
              </div>
              <button
                onClick={() => setActiveItemIndex(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <DynamicFormRenderer
                formContext="Quotation"
                values={{
                  productCategory: items[activeItemIndex]?.productCategory || quotation?.enquiry?.productCategory || 'Piping',
                  ...(items[activeItemIndex]?.dynamicFields || {})
                }}
                onChange={(fieldName, value) => {
                  const newItems = [...items];
                  if (!newItems[activeItemIndex].productCategory) {
                    newItems[activeItemIndex].productCategory = quotation?.enquiry?.productCategory || 'Piping';
                  }
                  if (!newItems[activeItemIndex].dynamicFields) {
                    newItems[activeItemIndex].dynamicFields = {};
                  }
                  newItems[activeItemIndex].dynamicFields[fieldName] = value;
                  setItems(newItems);
                }}
                readOnly={isApproved || !ability.can('editTechnical', 'Quotation')}
                currentUserRole={currentUser.role}
              />
            </div>

            <div className="p-6 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={() => setActiveItemIndex(null)}
                className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Close & Keep Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <EmailComposerModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        defaultTo={quotation.customer?.emailAddress || ''}
        defaultSubject={`Quotation # ${quotation.quotationId}`}
        availableFiles={quotation.files || []}
        onSendSuccess={() => showToast('Email message dispatched successfully!', 'success')}
      />
    </div>
  );
};

export default QuotationDetail;
