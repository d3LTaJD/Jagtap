import React, { useState, useEffect } from 'react';
import {
  Factory,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  Layers,
  Building2,
  FileText,
  FileCode2,
  RefreshCw,
  Plus,
  ArrowRight,
  ShieldCheck,
  Package,
  X,
  AlertCircle,
  Calendar,
  Send,
  Eye,
  Tag
} from 'lucide-react';
import api from '../api/client';
import { useAbility } from '../context/AbilityContext';

export default function WorkOrders() {
  const ability = useAbility();

  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'PENDING_DRAWING_APPROVAL' | 'RELEASED' | 'IN_PRODUCTION'
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals state
  const [selectedWo, setSelectedWo] = useState(null);
  const [gateBlockedModal, setGateBlockedModal] = useState(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Form creation states
  const [customers, setCustomers] = useState([]);
  const [quotations, setQuotations] = useState([]);
  const [drawings, setDrawings] = useState([]);

  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedQuotationId, setSelectedQuotationId] = useState('');
  const [selectedDrawingId, setSelectedDrawingId] = useState('');
  const [selectedRevisionNo, setSelectedRevisionNo] = useState('');
  const [targetDeliveryDate, setTargetDeliveryDate] = useState('');
  const [productionNotes, setProductionNotes] = useState('');
  const [previewItems, setPreviewItems] = useState([]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchWorkOrders = async () => {
    setLoading(true);
    try {
      const res = await api.get('/work-orders', {
        params: { status: 'all' }
      });
      setWorkOrders(res.data.data?.workOrders || []);
    } catch (err) {
      console.error('Failed to load work orders:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCreationFormData = async () => {
    try {
      const [custRes, quotRes, dwgRes] = await Promise.all([
        api.get('/customers').catch(() => ({ data: { data: { customers: [] } } })),
        api.get('/quotations?status=APPROVED,SENT,PENDING_APPROVAL,all').catch(() => ({ data: { data: { quotations: [] } } })),
        api.get('/drawings').catch(() => ({ data: { data: { drawings: [] } } }))
      ]);

      setCustomers(custRes.data.data?.customers || []);
      setQuotations(quotRes.data.data?.quotations || []);
      setDrawings(dwgRes.data.data?.drawings || []);
    } catch (err) {
      console.error('Failed to load form prerequisites:', err);
    }
  };

  useEffect(() => {
    fetchWorkOrders();
    fetchCreationFormData();
  }, []);

  // Handle Quotation Selection in Create Form
  const handleQuotationChange = (qId) => {
    setSelectedQuotationId(qId);
    const quot = quotations.find(q => q._id === qId);
    if (quot) {
      if (quot.customer?._id || quot.customer) {
        setSelectedCustomerId(quot.customer._id || quot.customer);
      }
      // Auto-match linked drawing
      const matchedDwg = drawings.find(d => d.quotation?._id === qId || d.quotation === qId);
      if (matchedDwg) {
        setSelectedDrawingId(matchedDwg._id);
        const lastRev = matchedDwg.revisions?.[matchedDwg.revisions.length - 1];
        setSelectedRevisionNo(lastRev ? String(lastRev.revisionNumber) : '0');
      }
      // Populate items
      setPreviewItems((quot.items || []).map((it, idx) => ({
        itemNo: idx + 1,
        description: it.description,
        size: it.dynamicFields?.valve_size || it.size || '',
        pressureClass: it.dynamicFields?.valve_class || it.pressureClass || '',
        valveType: it.dynamicFields?.valve_type || it.productCategory || '',
        materialGrade: it.dynamicFields?.valve_body_moc || it.materialGrade || '',
        endConnection: it.dynamicFields?.valve_end_connection || 'Flanged RF',
        quantity: it.quantity || 1,
        unit: it.unit || 'NOS'
      })));
    }
  };

  // Handle Drawing Selection in Create Form
  const handleDrawingChange = (dwgId) => {
    setSelectedDrawingId(dwgId);
    const dwg = drawings.find(d => d._id === dwgId);
    if (dwg) {
      if (dwg.quotation?._id || dwg.quotation) {
        setSelectedQuotationId(dwg.quotation._id || dwg.quotation);
      }
      if (dwg.customer?._id || dwg.customer) {
        setSelectedCustomerId(dwg.customer._id || dwg.customer);
      }
      const lastRev = dwg.revisions?.[dwg.revisions.length - 1];
      setSelectedRevisionNo(lastRev ? String(lastRev.revisionNumber) : '0');
    }
  };

  const handleCreateWorkOrder = async (e) => {
    e.preventDefault();
    if (!selectedQuotationId || !selectedDrawingId) {
      alert('Please select both a Quotation and a Linked Drawing.');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        quotationId: selectedQuotationId,
        customerId: selectedCustomerId,
        drawingId: selectedDrawingId,
        selectedRevisionNumber: selectedRevisionNo !== '' ? Number(selectedRevisionNo) : undefined,
        items: previewItems,
        targetDeliveryDate,
        productionNotes
      };

      const res = await api.post('/work-orders', payload);
      showToast(`Work Order ${res.data.data?.workOrder?.workOrderId} drafted successfully!`);
      setIsCreateModalOpen(false);
      resetCreateForm();
      await fetchWorkOrders();
    } catch (err) {
      console.error('Failed to create work order:', err);
      alert(err.response?.data?.message || 'Failed to create work order');
    } finally {
      setActionLoading(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedCustomerId('');
    setSelectedQuotationId('');
    setSelectedDrawingId('');
    setSelectedRevisionNo('');
    setTargetDeliveryDate('');
    setProductionNotes('');
    setPreviewItems([]);
  };

  // Release Work Order (Hard Gate Verification)
  const handleReleaseWorkOrder = async (wo) => {
    const targetRevLabel = wo.approvedDrawingLabel || wo.drawing?.activeApprovedRevision?.revisionLabel || 'Rev 00';

    setActionLoading(true);
    try {
      const res = await api.post(`/work-orders/${wo._id}/release`, {
        releaseNotes: `Manual release to shop floor against drawing revision ${targetRevLabel}.`
      });

      showToast(`Work Order ${wo.workOrderId} RELEASED to production floor!`);
      await fetchWorkOrders();
    } catch (err) {
      console.error('Work order release failed:', err);
      const is403 = err.response?.status === 403;
      const errorMsg = err.response?.data?.message || 'The linked drawing must be approved by TDS before this Work Order can be released.';

      setGateBlockedModal({
        title: 'Production Release Blocked',
        message: errorMsg,
        status: is403 ? 'HTTP 403 Forbidden' : 'Release Rejected',
        drawingStatus: wo.drawing?.status || 'UNDER_REVIEW',
        revisionLabel: targetRevLabel,
        workOrderId: wo.workOrderId
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Safe date helper to prevent "Invalid Date"
  const formatReleaseDate = (wo) => {
    if (wo.releasedAt && !isNaN(new Date(wo.releasedAt).getTime())) {
      return new Date(wo.releasedAt).toLocaleDateString();
    }
    if (wo.updatedAt && !isNaN(new Date(wo.updatedAt).getTime())) {
      return new Date(wo.updatedAt).toLocaleDateString();
    }
    return 'On Shop Floor';
  };

  // Stats calculation
  const stats = {
    total: workOrders.length,
    pending: workOrders.filter(w => w.status === 'PENDING_DRAWING_APPROVAL').length,
    released: workOrders.filter(w => ['RELEASED', 'COMPLETED'].includes(w.status)).length,
    production: workOrders.filter(w => w.status === 'IN_PRODUCTION').length
  };

  // Search & Status filtering
  const filteredWorkOrders = workOrders.filter(wo => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      wo.workOrderId?.toLowerCase().includes(q) ||
      wo.customer?.companyName?.toLowerCase().includes(q) ||
      wo.quotation?.quotationId?.toLowerCase().includes(q) ||
      wo.drawing?.drawingId?.toLowerCase().includes(q);

    let matchesStatus = true;
    if (statusFilter === 'PENDING_DRAWING_APPROVAL') {
      matchesStatus = wo.status === 'PENDING_DRAWING_APPROVAL';
    } else if (statusFilter === 'RELEASED') {
      matchesStatus = ['RELEASED', 'COMPLETED'].includes(wo.status);
    } else if (statusFilter === 'IN_PRODUCTION') {
      matchesStatus = wo.status === 'IN_PRODUCTION';
    }

    return matchesSearch && matchesStatus;
  });

  const selectedDrawingObj = drawings.find(d => d._id === selectedDrawingId);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in">
      {/* Toast */}
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
            <Factory className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Work Orders & Production Gating
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Strict engineering drawing approval gating before releasing jobs to the factory floor.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              fetchCreationFormData();
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Create Work Order
          </button>

          <button
            onClick={fetchWorkOrders}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Calm, High-Contrast Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div 
          onClick={() => setStatusFilter('all')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            statusFilter === 'all' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Work Orders</span>
            <Factory className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{stats.total}</p>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Production jobs</span>
        </div>

        <div 
          onClick={() => setStatusFilter('PENDING_DRAWING_APPROVAL')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            stats.pending > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
          } ${statusFilter === 'PENDING_DRAWING_APPROVAL' ? 'ring-2 ring-amber-500/30' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Pending Approval</span>
            <Lock className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-2xl font-black text-amber-950 mt-1.5">{stats.pending}</p>
          <span className="text-[10px] text-amber-700 font-medium block mt-0.5">Gated by drawing review</span>
        </div>

        <div 
          onClick={() => setStatusFilter('RELEASED')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            statusFilter === 'RELEASED' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Released to Floor</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-1.5">{stats.released}</p>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Drawing snapshot locked</span>
        </div>

        <div 
          onClick={() => setStatusFilter('IN_PRODUCTION')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            statusFilter === 'IN_PRODUCTION' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">In Production</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{stats.production}</p>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Active machining & assembly</span>
        </div>
      </div>

      {/* Simple Helpful Policy Guidance Box */}
      <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xs flex items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-slate-800 rounded-xl text-emerald-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="font-black text-sm block">Authoritative Hard Drawing Gate (Zero Manual Override)</span>
            <p className="text-slate-300 font-medium mt-0.5">
              Production Work Orders cannot be released until the technical drawing is approved by TDS and frozen into an immutable revision snapshot.
            </p>
          </div>
        </div>
      </div>

      {/* Universal Search and Filter Bar */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Work Order #, Customer, Quotation, or Drawing #..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium">Filter by Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          >
            <option value="all">Show All Work Orders ({workOrders.length})</option>
            <option value="PENDING_DRAWING_APPROVAL">Pending Drawing Approval ({stats.pending})</option>
            <option value="RELEASED">Released to Floor ({stats.released})</option>
            <option value="IN_PRODUCTION">In Production ({stats.production})</option>
          </select>
        </div>
      </div>

      {/* Work Orders Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-sm font-black text-slate-900">Work Orders Register</h3>
            <p className="text-xs text-slate-500 font-medium">
              Approved revision snapshots locked immutably upon release.
            </p>
          </div>
          <span className="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded-lg border border-slate-200">
            Showing {filteredWorkOrders.length} of {workOrders.length} Order(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                <th className="py-3 px-4">Work Order ID</th>
                <th className="py-3 px-4">Customer & Quotation</th>
                <th className="py-3 px-4">Linked Drawing</th>
                <th className="py-3 px-4">Approved Snapshot</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Production Gate & Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500 mb-2" />
                    Loading work orders...
                  </td>
                </tr>
              ) : filteredWorkOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                    No work orders match your search.
                  </td>
                </tr>
              ) : (
                filteredWorkOrders.map((wo) => {
                  const targetRevLabel = wo.approvedDrawingLabel || wo.drawing?.activeApprovedRevision?.revisionLabel || 'Rev 00';
                  const isDrawingApproved = wo.drawing?.status === 'APPROVED' && Boolean(wo.drawing?.activeApprovedRevision);
                  const isReleased = ['RELEASED', 'IN_PRODUCTION', 'COMPLETED'].includes(wo.status);

                  return (
                    <tr key={wo._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-slate-900 text-xs">{wo.workOrderId}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {wo.items?.length || 0} valve item(s)
                        </p>
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-800">{wo.customer?.companyName || 'Customer'}</p>
                        {wo.quotation && (
                          <span className="text-[11px] font-mono text-indigo-600 block mt-0.5">
                            {wo.quotation.quotationId}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {wo.drawing ? (
                          <div>
                            <span className="font-mono font-bold text-slate-800">{wo.drawing.drawingId}</span>
                            <div className="mt-1">
                              {isDrawingApproved ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  ✓ Drawing: {targetRevLabel} — APPROVED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-amber-50 text-amber-800 border border-amber-200">
                                  ⌛ Drawing: {targetRevLabel} — UNDER REVIEW
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-rose-600 font-bold">No Drawing Linked</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isReleased || wo.frozenRevisionSnapshot ? (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              {wo.approvedDrawingLabel || wo.frozenRevisionSnapshot?.revisionLabel || 'Rev 00'}
                            </span>
                            <span className="block text-[10px] text-slate-500 mt-0.5 font-medium">Locked Snapshot</span>
                          </div>
                        ) : isDrawingApproved ? (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Ready: {wo.drawing?.activeApprovedRevision?.revisionLabel || 'Rev 00'}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-medium italic">Pending Approval</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        {isReleased ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Released to Floor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Lock className="w-3.5 h-3.5 text-amber-600" /> Gate Locked
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedWo(wo)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200 inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-slate-600" /> View Details
                        </button>

                        {isReleased ? (
                          <span className="text-[11px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                            Released on {formatReleaseDate(wo)}
                          </span>
                        ) : isDrawingApproved ? (
                          <button
                            onClick={() => handleReleaseWorkOrder(wo)}
                            disabled={actionLoading}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs transition-all cursor-pointer inline-flex items-center gap-1"
                          >
                            <Unlock className="w-3.5 h-3.5" /> Release to Floor
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReleaseWorkOrder(wo)}
                            disabled={actionLoading}
                            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-all cursor-pointer inline-flex items-center gap-1"
                            title="Drawing approval strictly required before release"
                          >
                            <Lock className="w-3.5 h-3.5 text-rose-600" /> Gate Locked
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* WORK ORDER DETAILS MODAL */}
      {selectedWo && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-2xl text-white">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Work Order: {selectedWo.workOrderId}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Customer: <strong>{selectedWo.customer?.companyName}</strong> | Quotation: <strong>{selectedWo.quotation?.quotationId}</strong>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWo(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawing Snapshot Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Immutable Drawing Snapshot</span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 block">
                  {selectedWo.drawing?.drawingId} ({selectedWo.approvedDrawingLabel || selectedWo.frozenRevisionSnapshot?.revisionLabel || 'Rev 00'})
                </span>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Snapshot Hash / Title: {selectedWo.drawing?.drawingTitle || 'Standard Engineering Drawing'}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full font-black bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs">
                ✓ Approved & Locked
              </span>
            </div>

            {/* Line Items Table */}
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-slate-800">Valve Production Line Items</h4>
              <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Specs (Size / Class / MOC)</th>
                      <th className="py-2.5 px-3 text-right">Quantity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedWo.items?.map((it, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{it.itemNo || idx + 1}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">{it.description}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-medium">
                          {it.size} {it.pressureClass} {it.materialGrade} {it.endConnection}
                        </td>
                        <td className="py-2.5 px-3 text-right font-black text-slate-900">
                          {it.quantity} {it.unit || 'NOS'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-xs text-slate-500">
                Status: <strong className="text-emerald-700">{selectedWo.status}</strong> (Released: {formatReleaseDate(selectedWo)})
              </div>
              <button
                type="button"
                onClick={() => setSelectedWo(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE WORK ORDER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-900 rounded-2xl text-white">
                  <Factory className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">Create Production Work Order</h3>
                  <p className="text-xs text-slate-500 font-medium">Draft a shop floor Work Order linked to quotation and technical drawing.</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWorkOrder} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">1. Select Quotation *</label>
                  <select
                    required
                    value={selectedQuotationId}
                    onChange={(e) => handleQuotationChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-400"
                  >
                    <option value="">-- Choose Quotation --</option>
                    {quotations.map(q => (
                      <option key={q._id} value={q._id}>
                        {q.quotationId} ({q.customer?.companyName || 'Customer'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">2. Linked Technical Drawing *</label>
                  <select
                    required
                    value={selectedDrawingId}
                    onChange={(e) => handleDrawingChange(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-400"
                  >
                    <option value="">-- Choose Drawing --</option>
                    {drawings.map(d => (
                      <option key={d._id} value={d._id}>
                        {d.drawingId} - {d.drawingTitle} [{d.status}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Drawing Revision & Status Inspector */}
              {selectedDrawingObj && (
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
                      Drawing Status & Revision Version:
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                      selectedDrawingObj.status === 'APPROVED' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {selectedDrawingObj.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">Select Drawing Revision</label>
                      <select
                        value={selectedRevisionNo}
                        onChange={(e) => setSelectedRevisionNo(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      >
                        {selectedDrawingObj.revisions?.map(r => (
                          <option key={r.revisionNumber} value={r.revisionNumber}>
                            {r.revisionLabel} — {r.status}
                          </option>
                        ))}
                        {(!selectedDrawingObj.revisions || selectedDrawingObj.revisions.length === 0) && (
                          <option value="0">Rev 00 (Pending Upload)</option>
                        )}
                      </select>
                    </div>

                    <div className="flex flex-col justify-center text-xs font-medium text-slate-500">
                      <span>Drawing No: <strong className="text-slate-800">{selectedDrawingObj.drawingNumber}</strong></span>
                      <span>Active Approved: <strong className="text-emerald-700">{selectedDrawingObj.activeApprovedRevision?.revisionLabel || 'None'}</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Line Items Preview */}
              {previewItems.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Production Line Items ({previewItems.length})</label>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-3 max-h-36 overflow-y-auto space-y-2 text-xs">
                    {previewItems.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between border-b border-slate-200 pb-1.5 last:border-b-0">
                        <div>
                          <p className="font-bold text-slate-800">Item #{it.itemNo}: {it.description}</p>
                          <p className="text-[11px] text-slate-500">
                            {it.size} | {it.pressureClass} | {it.materialGrade} | {it.endConnection}
                          </p>
                        </div>
                        <span className="font-bold text-slate-700">{it.quantity} {it.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Target Delivery Date</label>
                  <input
                    type="date"
                    value={targetDeliveryDate}
                    onChange={(e) => setTargetDeliveryDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:bg-white focus:border-slate-400"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Production Notes</label>
                  <input
                    type="text"
                    value={productionNotes}
                    onChange={(e) => setProductionNotes(e.target.value)}
                    placeholder="e.g. Special Hydro-test holding time required."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:bg-white focus:border-slate-400"
                  />
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
                  Draft Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* HARD GATE BLOCKED POPUP MODAL */}
      {gateBlockedModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in zoom-in-95 border-2 border-rose-500/30">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-rose-100 rounded-2xl text-rose-600 shrink-0">
                <Lock className="w-7 h-7 text-rose-600" />
              </div>
              <div>
                <h3 className="text-lg font-black text-rose-900 tracking-tight">{gateBlockedModal.title}</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                  {gateBlockedModal.status}
                </span>
              </div>
            </div>

            <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 space-y-2 text-xs">
              <p className="font-bold text-rose-900 leading-relaxed">
                {gateBlockedModal.message}
              </p>
              <div className="pt-2 border-t border-rose-200/60 text-[11px] text-rose-700 space-y-1">
                <p>• <strong>Work Order ID:</strong> {gateBlockedModal.workOrderId}</p>
                <p>• <strong>Drawing Status:</strong> <span className="uppercase font-bold">{gateBlockedModal.drawingStatus}</span></p>
                <p>• <strong>Drawing Revision:</strong> {gateBlockedModal.revisionLabel}</p>
                <p>• <strong>Hard Gate Policy:</strong> Zero override across all user roles (Super Admin, Director, Admin).</p>
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <button
                type="button"
                onClick={() => setGateBlockedModal(null)}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
