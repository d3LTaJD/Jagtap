import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileCode2, 
  Search, 
  Filter, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  FileText, 
  Plus, 
  ArrowUpRight, 
  Sparkles, 
  Layers, 
  Eye, 
  Calendar,
  Building2,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  SlidersHorizontal,
  XCircle,
  Truck,
  X
} from 'lucide-react';
import api from '../api/client';
import { useAbility } from '../context/AbilityContext';

export default function Drawings() {
  const navigate = useNavigate();
  const ability = useAbility();

  const [drawings, setDrawings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeQueue, setActiveQueue] = useState('all'); // 'all', 'pending', 'vendor', 'escalated', 'approved'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    vendor: 0,
    escalated: 0,
    approved: 0
  });

  // Create Drawing Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedQuotationId, setSelectedQuotationId] = useState('');
  const [drawingNumber, setDrawingNumber] = useState('');
  const [drawingTitle, setDrawingTitle] = useState('');
  const [drawingType, setDrawingType] = useState('CUSTOMER_GA');
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDrawings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/drawings', {
        params: {
          queue: activeQueue,
          status: statusFilter,
          search: searchTerm
        }
      });
      const list = res.data.data?.drawings || [];
      setDrawings(list);

      // Compute statistics across all drawings
      const allRes = await api.get('/drawings', { params: { queue: 'all' } });
      const allList = allRes.data.data?.drawings || [];
      setStats({
        total: allList.length,
        pending: allList.filter(d => ['PENDING_UPLOAD', 'UNDER_REVIEW', 'REVISION_REQUESTED'].includes(d.status)).length,
        vendor: allList.filter(d => Boolean(d.vendor)).length,
        escalated: allList.filter(d => d.isEscalated).length,
        approved: allList.filter(d => d.status === 'APPROVED').length
      });
    } catch (err) {
      console.error('Failed to load drawings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrerequisites = async () => {
    try {
      const [custRes, quotRes] = await Promise.all([
        api.get('/customers').catch(() => ({ data: { data: { customers: [] } } })),
        api.get('/quotations?status=APPROVED,SENT,PENDING_APPROVAL,all').catch(() => ({ data: { data: { quotations: [] } } }))
      ]);
      setCustomers(custRes.data.data?.customers || []);
      setQuotations(quotRes.data.data?.quotations || []);
    } catch (err) {
      console.error('Failed to load prerequisite data:', err);
    }
  };

  useEffect(() => {
    fetchDrawings();
    fetchPrerequisites();
  }, [activeQueue, statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDrawings();
  };

  const handleCreateDrawing = async (e) => {
    e.preventDefault();
    if (!drawingNumber || !drawingTitle) {
      alert('Please fill in drawing number and title.');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        drawingNumber,
        drawingTitle,
        drawingType,
        customerId: selectedCustomerId || undefined,
        quotationId: selectedQuotationId || undefined
      };

      const res = await api.post('/drawings', payload);
      showToast(`Drawing ${res.data.data?.drawing?.drawingId || drawingNumber} registered successfully!`);
      setIsCreateModalOpen(false);
      setDrawingNumber('');
      setDrawingTitle('');
      setSelectedCustomerId('');
      setSelectedQuotationId('');
      await fetchDrawings();
    } catch (err) {
      console.error('Failed to create drawing:', err);
      alert(err.response?.data?.message || 'Failed to create drawing');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status, isEscalated, activeApprovedRev) => {
    if (isEscalated) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-200">
          <AlertTriangle className="w-3 h-3 text-rose-600" /> ESCALATED TO DIRECTOR
        </span>
      );
    }

    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> APPROVED {activeApprovedRev ? `(${activeApprovedRev.revisionLabel})` : ''}
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            <Clock className="w-3.5 h-3.5 text-blue-600" /> UNDER TDS REVIEW
          </span>
        );
      case 'REVISION_REQUESTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" /> REVISION REQUESTED
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> REJECTED
          </span>
        );
      case 'PENDING_UPLOAD':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" /> PENDING UPLOAD
          </span>
        );
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white rounded-2xl shadow-xl text-xs font-bold animate-in slide-in-from-top-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{toast.msg}</span>
        </div>
      )}

      {/* Clean Industrial Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-slate-900 rounded-xl text-white shadow-xs">
            <FileCode2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              TDS / Drawing Management
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Engineering drawing registers, multi-revision version control, and production gating.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchPrerequisites();
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Register Drawing
          </button>

          <button
            onClick={fetchDrawings}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Calm, High-Contrast Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div 
          onClick={() => setActiveQueue('all')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeQueue === 'all' 
              ? 'border-indigo-500 ring-2 ring-indigo-500/20' 
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">All Drawings</span>
            <FileCode2 className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{stats.total}</p>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Registered sheets</span>
        </div>

        <div 
          onClick={() => setActiveQueue('pending')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeQueue === 'pending' 
              ? 'border-blue-500 ring-2 ring-blue-500/20' 
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">Pending Review</span>
            <Clock className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-950 mt-1.5">{stats.pending}</p>
          <span className="text-[10px] text-blue-600 font-medium block mt-0.5">Awaiting TDS check</span>
        </div>

        <div 
          onClick={() => setActiveQueue('vendor')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeQueue === 'vendor' 
              ? 'border-purple-500 ring-2 ring-purple-500/20' 
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-900">Vendor SLA</span>
            <Truck className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-2xl font-black text-purple-950 mt-1.5">{stats.vendor}</p>
          <span className="text-[10px] text-purple-600 font-medium block mt-0.5">Supplier components</span>
        </div>

        <div 
          onClick={() => setActiveQueue('escalated')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeQueue === 'escalated' 
              ? 'border-rose-500 ring-2 ring-rose-500/20' 
              : stats.escalated > 0 ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">Escalated</span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-black text-rose-950 mt-1.5">{stats.escalated}</p>
          <span className="text-[10px] text-rose-600 font-medium block mt-0.5">Director attention</span>
        </div>

        <div 
          onClick={() => setActiveQueue('approved')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeQueue === 'approved' 
              ? 'border-emerald-500 ring-2 ring-emerald-500/20' 
              : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">Approved</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-950 mt-1.5">{stats.approved}</p>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Ready for production</span>
        </div>
      </div>

      {/* Universal Search & Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            autoComplete="off"
            spellCheck="false"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Drawing ID, Drawing Number, or Title..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Filter by Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="all">All Statuses ({stats.total})</option>
            <option value="PENDING_UPLOAD">Pending Upload</option>
            <option value="UNDER_REVIEW">Under Review</option>
            <option value="APPROVED">Approved ({stats.approved})</option>
            <option value="REVISION_REQUESTED">Revision Requested</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Drawings Register Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-slate-900">Technical Drawings Register</h3>
            <p className="text-xs text-slate-500 font-medium">
              Multi-revision technical specifications and quality approval status.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded-lg border border-slate-200">
            Showing {drawings.length} of {stats.total} Drawing(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Drawing ID & Number</th>
                <th className="py-3 px-4">Title & Type</th>
                <th className="py-3 px-4">Customer & Quotation</th>
                <th className="py-3 px-4">Current Revision</th>
                <th className="py-3 px-4">Status & SLA</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading drawings...
                  </td>
                </tr>
              ) : drawings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    <FileCode2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    No drawing records match your filter criteria.
                  </td>
                </tr>
              ) : (
                drawings.map((dwg) => {
                  const currentRev = dwg.revisions?.[dwg.revisions.length - 1];
                  const hasApprovedRev = Boolean(dwg.activeApprovedRevision);

                  return (
                    <tr 
                      key={dwg._id} 
                      onClick={() => navigate(`/app/drawings/${dwg._id}`)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-slate-900 text-xs block">{dwg.drawingId}</span>
                        <span className="text-[11px] font-mono text-indigo-600 font-bold mt-0.5 block">{dwg.drawingNumber}</span>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-bold text-slate-800 truncate">{dwg.drawingTitle}</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                          {dwg.drawingType?.replace('_', ' ')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800">{dwg.customer?.companyName || 'Unknown Customer'}</p>
                        {dwg.quotation && (
                          <span className="inline-block mt-0.5 text-[11px] font-mono font-medium text-slate-500">
                            {dwg.quotation.quotationId}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          {hasApprovedRev ? (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                              ✓ {dwg.activeApprovedRevision.revisionLabel} Approved
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {currentRev ? currentRev.revisionLabel : 'Rev 00 (Pending)'}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {dwg.revisions?.length || 0} revision(s) recorded
                        </p>
                      </td>

                      <td className="py-3.5 px-4 space-y-1">
                        <div>{getStatusBadge(dwg.status, dwg.isEscalated, dwg.activeApprovedRevision)}</div>
                        {dwg.vendorSlaDeadline && (
                          <p className={`text-[10px] font-bold ${dwg.slaBreached ? 'text-rose-600' : 'text-slate-500'}`}>
                            SLA: {new Date(dwg.vendorSlaDeadline).toLocaleDateString()} {dwg.slaBreached && '(Breached)'}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/app/drawings/${dwg._id}`);
                          }}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-800 font-bold rounded-xl text-xs transition-all cursor-pointer border border-slate-200 inline-flex items-center gap-1 shadow-2xs"
                        >
                          <Eye className="w-3.5 h-3.5" /> Open TDS Sheet
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* REGISTER NEW DRAWING MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full p-6 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-2xl text-white">
                  <FileCode2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Register New Technical Drawing</h3>
                  <p className="text-xs text-slate-500 font-medium">Create a drawing register linked to customer quotation.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDrawing} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Drawing Number *</label>
                  <input
                    type="text"
                    required
                    value={drawingNumber}
                    onChange={(e) => setDrawingNumber(e.target.value)}
                    placeholder="e.g. DWG-LNT-G-300-R0"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Drawing Type</label>
                  <select
                    value={drawingType}
                    onChange={(e) => setDrawingType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-400"
                  >
                    <option value="CUSTOMER_GA">Customer GA Drawing</option>
                    <option value="VENDOR_COMPONENT">Vendor Component Drawing</option>
                    <option value="INTERNAL_GA">Internal GA Drawing</option>
                    <option value="MANUFACTURING_DETAIL">Manufacturing Detail</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Drawing Title *</label>
                <input
                  type="text"
                  required
                  value={drawingTitle}
                  onChange={(e) => setDrawingTitle(e.target.value)}
                  placeholder="e.g. GA Drawing for 150 mm Class 300 Gate Valve"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-slate-400"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Linked Customer</label>
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => setSelectedCustomerId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-400"
                  >
                    <option value="">-- Optional: Select Customer --</option>
                    {customers.map(c => (
                      <option key={c._id} value={c._id}>{c.companyName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Linked Quotation</label>
                  <select
                    value={selectedQuotationId}
                    onChange={(e) => setSelectedQuotationId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-400"
                  >
                    <option value="">-- Optional: Select Quotation --</option>
                    {quotations.map(q => (
                      <option key={q._id} value={q._id}>
                        {q.quotationId} ({q.customer?.companyName || 'Client'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer"
                >
                  Register Drawing
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
