import React, { useState, useEffect } from 'react';
import { FileCheck, Filter, Plus, ChevronRight, CheckCircle2, Loader2, X, Trash2, PlusCircle, Download, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useNavigate, Link } from 'react-router-dom';
import AutocompleteSelect from '../components/AutocompleteSelect';
import { Can, useAbility } from '../context/AbilityContext';

const QuoteStatusBadge = ({ status }) => {
  const colors = {
    'DRAFT': 'bg-slate-100 text-slate-700 ring-slate-600/20',
    'TECH_REVIEW': 'bg-orange-50 text-orange-700 ring-orange-600/20',
    'PENDING_APPROVAL': 'bg-amber-50 text-amber-700 ring-amber-600/20',
    'APPROVED': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    'REJECTED': 'bg-red-50 text-red-700 ring-red-600/20',
  };
  // Fallback map for legacy mixed case
  const normalizedStatus = status ? status.toUpperCase() : 'UNKNOWN';
  const color = colors[normalizedStatus] || 'bg-slate-50 text-slate-700 ring-slate-600/20';
  
  // Pretty print
  const displayMap = {
    'DRAFT': 'Draft',
    'TECH_REVIEW': 'Technical Review',
    'PENDING_APPROVAL': 'Pending Approval',
    'APPROVED': 'Approved',
    'REJECTED': 'Rejected'
  };

  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${color}`}>
      {displayMap[normalizedStatus] || status}
    </span>
  );
};

const Quotations = () => {
  const ability = useAbility();
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [enquiriesForSelect, setEnquiriesForSelect] = useState([]);
  
  const [formData, setFormData] = useState({
    enquiry: '',
    customer: '',
    scopeOfSupply: '',
    status: 'Draft',
    items: [{ description: '', quantity: 1, unitPrice: 0, lineTotalExclGST: 0 }]
  });

  const fetchQuotations = async () => {
    try {
      const [qtRes, enqRes] = await Promise.all([
        api.get('/quotations'),
        api.get('/enquiries')
      ]);
      if (qtRes.data.data?.quotations) setQuotations(qtRes.data.data.quotations);
      if (enqRes.data.data?.enquiries) setEnquiriesForSelect(enqRes.data.data.enquiries);
    } catch (err) {
      console.error('Failed to fetch data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.enquiry) return alert('Please select an Enquiry reference');
    setSubmitLoading(true);
    
    // Auto calculate grand total
    const grandTotal = formData.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
    const payload = {
      ...formData,
      commercialTotals: { grandTotal }
    };
    
    try {
      await api.post('/quotations', payload);
      setShowNewModal(false);
      fetchQuotations();
      setFormData({
        enquiry: '', customer: '', scopeOfSupply: '', status: 'Draft',
        items: [{ description: '', quantity: 1, unitPrice: 0, lineTotalExclGST: 0 }]
      });
    } catch(err) {
      console.error(err);
      alert('Error creating quotation');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEnquirySelect = (e) => {
    const enqId = e.target.value;
    const selected = enquiriesForSelect.find(eq => eq._id === enqId);
    if (selected) {
      const defaultItems = selected.products && selected.products.length > 0
        ? selected.products.map(p => ({
            description: p.description || '',
            productCategory: p.category || selected.productCategory || 'Valves',
            quantity: p.quantity || 1,
            materialGrade: p.dynamicFields?.valve_moc_body?.value || p.dynamicFields?.valve_moc_body || p.dynamicFields?.body_material?.value || p.dynamicFields?.body_material || p.dynamicFields?.moc?.value || p.dynamicFields?.moc || '',
            applicableStandard: p.standardCode || '',
            unitPrice: 0,
            lineTotalExclGST: 0
          }))
        : [{
            description: selected.productDescription || '',
            productCategory: selected.productCategory || 'Valves',
            quantity: selected.quantity || 1,
            materialGrade: selected.dynamicFields?.valve_moc_body?.value || selected.dynamicFields?.valve_moc_body || selected.dynamicFields?.body_material?.value || selected.dynamicFields?.body_material || selected.dynamicFields?.moc?.value || selected.dynamicFields?.moc || '',
            applicableStandard: selected.standardCode || '',
            unitPrice: 0,
            lineTotalExclGST: 0
          }];
      setFormData({
        ...formData,
        enquiry: enqId,
        customer: selected.customer?._id || '',
        scopeOfSupply: selected.productDescription || '',
        items: defaultItems
      });
    } else {
      setFormData({ ...formData, enquiry: enqId, customer: '' });
    }
  };

  const addItem = () => {
    const selectedEnq = enquiriesForSelect.find(eq => eq._id === formData.enquiry);
    const category = selectedEnq?.productCategory || 'Valves';
    setFormData({
      ...formData,
      items: [...formData.items, { description: '', productCategory: category, quantity: 1, unitPrice: 0, lineTotalExclGST: 0 }]
    });
  };
  const removeItem = (idx) => {
    const newItems = [...formData.items];
    newItems.splice(idx, 1);
    setFormData({...formData, items: newItems});
  };
  const updateItem = (idx, field, val) => {
    const newItems = [...formData.items];
    newItems[idx][field] = val;
    if (field === 'quantity' || field === 'unitPrice') {
      newItems[idx].lineTotalExclGST = Number(newItems[idx].quantity) * Number(newItems[idx].unitPrice);
    }
    setFormData({...formData, items: newItems});
  };

  const handleUpdateStatus = async (e, id, newStatus) => {
    e.stopPropagation();
    try {
      await api.patch(`/quotations/${id}/status`, { status: newStatus });
      fetchQuotations();
    } catch(err) {
      console.error(err);
      alert('Error updating status');
    }
  };

  const handleDelete = async (e, id, qtId) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete quotation ${qtId}? This action cannot be undone.`)) return;
    try {
      await api.delete(`/quotations/${id}`);
      fetchQuotations();
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error deleting quotation');
    }
  };

  const handleDownloadPdf = async (e, id, qtId) => {
    e.stopPropagation();
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${qtId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch(err) {
      console.error(err);
      alert('Error downloading PDF');
    }
  };

  useEffect(() => {
    fetchQuotations();
    const interval = setInterval(fetchQuotations, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const createForEnquiryId = params.get('createForEnquiry');
    if (createForEnquiryId && enquiriesForSelect.length > 0) {
      const selected = enquiriesForSelect.find(eq => eq._id === createForEnquiryId);
      if (selected) {
        const defaultItems = selected.products && selected.products.length > 0
          ? selected.products.map(p => ({
              description: p.description || '',
              productCategory: p.category || selected.productCategory || 'Valves',
              quantity: p.quantity || 1,
              materialGrade: p.dynamicFields?.valve_moc_body?.value || p.dynamicFields?.valve_moc_body || p.dynamicFields?.body_material?.value || p.dynamicFields?.body_material || p.dynamicFields?.moc?.value || p.dynamicFields?.moc || '',
              applicableStandard: p.standardCode || '',
              unitPrice: 0,
              lineTotalExclGST: 0
            }))
          : [{
              description: selected.productDescription || '',
              productCategory: selected.productCategory || 'Valves',
              quantity: selected.quantity || 1,
              materialGrade: selected.dynamicFields?.valve_moc_body?.value || selected.dynamicFields?.valve_moc_body || selected.dynamicFields?.body_material?.value || selected.dynamicFields?.body_material || selected.dynamicFields?.moc?.value || selected.dynamicFields?.moc || '',
              applicableStandard: selected.standardCode || '',
              unitPrice: 0,
              lineTotalExclGST: 0
            }];
        setFormData(prev => ({
          ...prev,
          enquiry: createForEnquiryId,
          customer: selected.customer?._id || '',
          scopeOfSupply: selected.productDescription || '',
          items: defaultItems
        }));
        setShowNewModal(true);
      }
    }
  }, [enquiriesForSelect]);

  const formatCurrency = (amount) => {
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  const pendingTechReviews = quotations.filter(q => q.status === 'TECH_REVIEW').length;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quotations & Offers</h1>
          <p className="text-sm text-slate-500 mt-1">Manage technical reviews, commercial pricing, and PDF dispatch.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchQuotations}
            className="p-2 text-slate-500 bg-white border border-slate-200 rounded-xl hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm group"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <Can I="create" a="Quotation">
            <button onClick={() => setShowNewModal(true)} className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium shadow-sm shadow-brand-500/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Create Quote
            </button>
          </Can>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="bg-orange-50 rounded-2xl p-5 border border-orange-100 flex items-start gap-4">
          <div className="p-3 bg-orange-100 rounded-xl text-orange-600">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-orange-900">Technical Reviews</h3>
            <p className="text-sm text-orange-700 mt-1">
              You have {pendingTechReviews} quotation{pendingTechReviews !== 1 ? 's' : ''} waiting for technical specification sign-off.
            </p>
            {pendingTechReviews > 0 && (
              <button className="mt-3 text-sm font-bold text-orange-700 hover:text-orange-800 underline underline-offset-2">Review Now</button>
            )}
          </div>
        </div>
        <div className="bg-emerald-50 rounded-2xl p-5 border border-emerald-100 flex items-start gap-4">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-900">System Status</h3>
            <p className="text-sm text-emerald-700 mt-1">Quotation engine is online and connected to active product schemas.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Quote ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Enquiry Ref</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {quotations.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-6 py-8 text-center text-sm text-slate-500">
                      No quotations found. Click "Create Quote" to generate one from an Enquiry.
                    </td>
                  </tr>
                ) : (
                  quotations.map((qt) => (
                    <tr 
                      key={qt._id} 
                      onClick={() => navigate(`/app/quotations/${qt._id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-600">{qt.quotationId || 'QT-PENDING'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                        {qt.enquiry?.enquiryId ? (
                          <Link
                            to={`/app/enquiries/${qt.enquiry._id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-brand-600 hover:text-brand-700 font-semibold hover:underline"
                          >
                            {qt.enquiry.enquiryId}
                          </Link>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">{qt.customer?.companyName || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-700">
                        {ability.can('viewPricing', 'Quotation') 
                          ? formatCurrency(qt.commercialTotals?.grandTotal || 0)
                          : '—'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap"><QuoteStatusBadge status={qt.status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                        {new Date(qt.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-3">
                        <Can I="edit" a="Quotation">
                          {qt.status === 'DRAFT' && <button onClick={(e) => handleUpdateStatus(e, qt._id, 'TECH_REVIEW')} className="text-brand-600 font-bold hover:underline">Submit Review</button>}
                        </Can>
                        <Can I="approve" a="Quotation">
                          {(qt.status === 'TECH_REVIEW' || qt.status === 'PENDING_APPROVAL') && <button onClick={(e) => handleUpdateStatus(e, qt._id, 'APPROVED')} className="text-emerald-600 font-bold hover:underline">Approve</button>}
                        </Can>
                        <button onClick={(e) => handleDownloadPdf(e, qt._id, qt.quotationId || 'QT')} className="text-slate-400 hover:text-blue-600 p-1 rounded transition-colors inline-block" title="Download PDF">
                          <Download className="w-5 h-5 transition-all" />
                        </button>
                        <Can I="delete" a="Quotation">
                          <button onClick={(e) => handleDelete(e, qt._id, qt.quotationId || 'QT')} className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors inline-block" title="Delete">
                            <Trash2 className="w-5 h-5 transition-all" />
                          </button>
                        </Can>
                        <button className="text-slate-400 hover:text-brand-600 p-1 rounded transition-colors inline-block" title="View Details">
                          <ChevronRight className="w-5 h-5 opacity-0 group-hover:opacity-100 transform -translate-x-2 group-hover:translate-x-0 transition-all" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {/* Create Quote Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Create New Quotation</h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form id="new-quote-form" onSubmit={handleCreateSubmit} className="space-y-8">
                
                <section>
                  <h3 className="text-sm font-bold text-brand-600 uppercase tracking-wider mb-4">Reference Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Select Source Enquiry</label>
                      <AutocompleteSelect
                        options={enquiriesForSelect
                          .filter(eq => eq.status === 'Ready for Offer' || eq._id === formData.enquiry)
                          .map(eq => ({
                            value: eq._id,
                            label: `${eq.enquiryId} - ${eq.customer?.companyName} (${eq.productCategory || eq.coreFields?.productCategory || 'N/A'})`
                          }))}
                        value={formData.enquiry}
                        onChange={v => handleEnquirySelect({ target: { value: v } })}
                        placeholder="-- Select an active Enquiry --"
                        required={true}
                        allowClear={false}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Scope of Supply Description</label>
                      <textarea required value={formData.scopeOfSupply} onChange={e => setFormData({...formData, scopeOfSupply: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 min-h-[80px]" placeholder="Briefly define the scope of mechanical supply..."></textarea>
                    </div>
                  </div>
                </section>

                <hr className="border-slate-100" />

                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-brand-600 uppercase tracking-wider">Commercial Line Items</h3>
                    <button type="button" onClick={addItem} className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors flex items-center">
                      <PlusCircle className="w-3.5 h-3.5 mr-1" /> Add Component
                    </button>
                  </div>
                  
                  <div className="space-y-4">
                    {formData.items.map((item, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex gap-4 items-start">
                        <div className="flex-[3]">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Item Description</label>
                          <input type="text" required value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" placeholder="e.g. Shell & Tube Heat Exchanger..." />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Qty</label>
                          <input type="number" min="1" required value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Unit Price (₹)</label>
                          <input type="number" min="0" required value={item.unitPrice} onChange={e => updateItem(idx, 'unitPrice', e.target.value)} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm" />
                        </div>
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-slate-500 mb-1">Line Total</label>
                          <div className="w-full px-3 py-2 bg-slate-100 border border-transparent rounded-lg text-sm font-bold text-slate-700">
                            ₹{item.lineTotalExclGST.toLocaleString()}
                          </div>
                        </div>
                        <button type="button" onClick={() => removeItem(idx)} disabled={formData.items.length === 1} className="mt-6 p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  
                  <div className="mt-6 p-4 bg-brand-50 border border-brand-100 rounded-xl flex justify-between items-center">
                    <span className="font-bold text-brand-900">Total Calculation (Excl. GST)</span>
                    <span className="text-lg font-black text-brand-700">₹{formData.items.reduce((acc, it) => acc + (it.quantity * it.unitPrice), 0).toLocaleString()}</span>
                  </div>
                </section>
                
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowNewModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="new-quote-form" disabled={submitLoading} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center">
                {submitLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Draft Quote
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
