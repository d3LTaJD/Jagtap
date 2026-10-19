import React, { useState, useEffect } from 'react';
import { PenTool, Search, Download, Loader2, Plus, X, RefreshCw } from 'lucide-react';
import api from '../api/client';
import { useNavigate } from 'react-router-dom';
import AutocompleteSelect from '../components/AutocompleteSelect';
import { Can } from '../context/AbilityContext';

const QapStatusBadge = ({ status }) => {
  const norm = (status || '').toUpperCase();
  const colors = {
    'GENERATED': 'bg-blue-50 text-blue-700 ring-blue-600/20',
    'UNDER_REVIEW': 'bg-amber-50 text-amber-700 ring-amber-600/20',
    'QC REVIEW': 'bg-amber-50 text-amber-700 ring-amber-600/20',
    'DRAFT': 'bg-slate-100 text-slate-700 ring-slate-600/20',
    'PENDING DIRECTOR APPROVAL': 'bg-purple-50 text-purple-700 ring-purple-600/20',
    'APPROVED': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    'ACCEPTED': 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    'SENT TO CLIENT': 'bg-emerald-100 text-emerald-800 ring-emerald-600/30',
    'REVISED': 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
    'REJECTED': 'bg-rose-50 text-rose-700 ring-rose-600/20',
  };
  const color = colors[norm] || 'bg-slate-50 text-slate-700 ring-slate-600/20';
  return (
    <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${color}`}>
      {status || 'Generated'}
    </span>
  );
};

const Qaps = () => {
  const navigate = useNavigate();
  const [qaps, setQaps] = useState([]);
  const [quotationsForSelect, setQuotationsForSelect] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedQapId, setSelectedQapId] = useState(null);
  const [selectedQuote, setSelectedQuote] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);

  const fetchQaps = async () => {
    try {
      const [qapRes, qtRes] = await Promise.all([
        api.get('/qaps'),
        api.get('/quotations')
      ]);
      if (qapRes.data.data?.qaps) setQaps(qapRes.data.data.qaps);
      
      // Approved/Accepted/Sent/Active quotes can have QAPs generated
      if (qtRes.data.data?.quotations) {
        const allQuotes = qtRes.data.data.quotations;
        const eligible = allQuotes.filter(q => {
          const s = (q.status || '').toUpperCase();
          return ['APPROVED', 'ACCEPTED', 'ORDER_CONFIRMED', 'PO_RECEIVED', 'SENT'].includes(s);
        });
        setQuotationsForSelect(eligible.length > 0 ? eligible : allQuotes);
      }
    } catch (err) {
      console.error('Failed to fetch QAPs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQap = async (e) => {
    e.preventDefault();
    if (!selectedQuote) return alert('Please select a Quotation');
    setSubmitLoading(true);
    try {
      const res = await api.post('/qaps', { quotationId: selectedQuote });
      setShowNewModal(false);
      setSelectedQuote('');
      await fetchQaps();
      const newQapId = res.data?.data?.qap?._id;
      if (newQapId) {
        navigate(`/app/qaps/${newQapId}`);
      }
    } catch(err) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Error generating QAP';
      alert(`Error generating QAP: ${msg}`);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSignQap = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      alert('Digital signature applied successfully! (Mocked)');
      setShowSignatureModal(false);
    } finally {
      setSubmitLoading(false);
    }
  };

  useEffect(() => {
    fetchQaps();
    const interval = setInterval(fetchQaps, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const filteredQaps = qaps.filter(qap => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const qapId = (qap.qapId || '').toLowerCase();
    const cust = (qap.customer?.companyName || '').toLowerCase();
    const quote = (qap.quotation?.quotationId || '').toLowerCase();
    const status = (qap.status || '').toLowerCase();
    return qapId.includes(term) || cust.includes(term) || quote.includes(term) || status.includes(term);
  });

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Quality Assurance Plans (QAP)</h1>
          <p className="text-sm text-slate-500 mt-1">ASME auto-populated checklists, QC steps, and final digital signatures.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto flex-1 max-w-sm">
            <button 
              onClick={fetchQaps}
              className="p-2 text-slate-500 bg-white border border-slate-200 rounded-xl hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm group"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input 
                type="text" 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search QAPs..." 
                className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all" 
              />
            </div>
          </div>
          <Can I="generateDraft" a="QAP">
            <button onClick={() => setShowNewModal(true)} className="inline-flex items-center justify-center px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium shadow-sm shadow-brand-500/30 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Generate QAP
            </button>
          </Can>
        </div>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64 bg-white">
              <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">QAP ID</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Quote Ref</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Date Created</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {filteredQaps.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-sm text-slate-500">
                      {searchTerm ? 'No matching QAPs found.' : 'No QAPs found. QAPs are automatically generated from accepted Quotations.'}
                    </td>
                  </tr>
                ) : (
                  filteredQaps.map((qap) => (
                    <tr 
                      key={qap._id} 
                      onClick={() => navigate(`/app/qaps/${qap._id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-brand-600">{qap.qapId || 'QAP-PENDING'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 font-semibold">{qap.customer?.companyName || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">{qap.quotation?.quotationId || 'Unknown'}</td>
                      <td className="px-6 py-4 whitespace-nowrap"><QapStatusBadge status={qap.status} /></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-medium">
                        {new Date(qap.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Can I="digitalSignature" a="QAP">
                          {qap.status === 'Pending Director Approval' && (
                            <button onClick={(e) => { e.stopPropagation(); setSelectedQapId(qap._id); setShowSignatureModal(true); }} className="inline-flex items-center px-3 py-1.5 bg-brand-50 text-brand-700 hover:bg-brand-100 rounded-lg transition-colors border border-brand-200 shadow-sm">
                              <PenTool className="w-3.5 h-3.5 mr-1.5" />
                              Sign
                            </button>
                          )}
                        </Can>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const token = localStorage.getItem('token') || sessionStorage.getItem('token');
                            window.open(`/api/qaps/${qap._id}/pdf?token=${token}`, '_blank');
                          }}
                          className="inline-flex items-center px-3 py-1.5 bg-white text-slate-600 hover:text-brand-600 hover:bg-slate-50 rounded-lg border border-slate-200 shadow-sm transition-colors"
                          title="Download QAP PDF"
                        >
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          PDF
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

      {/* Generate QAP Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Generate Quality Assurance Plan</h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <form id="new-qap-form" onSubmit={handleGenerateQap} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Approved Quotation</label>
                  <AutocompleteSelect
                    options={quotationsForSelect.map(qt => {
                      const custName = qt.customer?.companyName || qt.customerName || (typeof qt.customer === 'string' ? qt.customer : 'Client');
                      const quoteCode = qt.quotationId || 'QT';
                      const statusStr = qt.status || 'Active';
                      return {
                        value: qt._id,
                        label: `${quoteCode} - ${custName} (${statusStr})`
                      };
                    })}
                    value={selectedQuote}
                    onChange={v => setSelectedQuote(v)}
                    placeholder="-- Select Quotation --"
                    required={true}
                    allowClear={false}
                  />
                  <p className="text-xs text-slate-500 mt-2">The system will automatically extract drawing references and applicable standards to generate the base inspection matrix.</p>
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowNewModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Cancel</button>
              <button type="submit" form="new-qap-form" disabled={submitLoading} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center">
                {submitLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Generate QAP Matrix
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signature Modal Capture UI */}
      {showSignatureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Apply Digital Signature</h2>
              <button onClick={() => setShowSignatureModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-600 mb-4">You are securely authorising the QAP Document. Please draw your signature below or load your saved e-stamp.</p>
              <div className="w-full h-40 bg-slate-50 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center relative cursor-crosshair">
                <span className="text-slate-400 font-medium select-none pointer-events-none absolute italic opacity-50">Sign Here...</span>
                <PenTool className="w-6 h-6 text-slate-300 absolute bottom-4 right-4 pointer-events-none" />
              </div>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
              <button type="button" onClick={() => setShowSignatureModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Cancel</button>
              <button onClick={handleSignQap} disabled={submitLoading} className="px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center">
                {submitLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Authorize & Seal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Qaps;
