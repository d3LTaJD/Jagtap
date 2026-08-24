import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Layers,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Search,
  Plus,
  RefreshCw,
  Eye,
  Check,
  X,
  Lock,
  Unlock,
  AlertCircle,
  TrendingUp,
  Building2,
  Factory,
  ArrowRight,
  ShieldCheck,
  Calendar,
  Sparkles,
  ChevronRight,
  Tag,
  Scale,
  DollarSign
} from 'lucide-react';
import api from '../api/client';
import { useAbility } from '../context/AbilityContext';

export default function PurchaseAndBom() {
  const ability = useAbility();

  const [activeTab, setActiveTab] = useState('bom'); // 'bom' | 'orders' | 'pi' | 'cpd'
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Data states
  const [boms, setBoms] = useState([]);
  const [requisitions, setRequisitions] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [proformaInvoices, setProformaInvoices] = useState([]);
  const [cpdMatrix, setCpdMatrix] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [vendors, setVendors] = useState([]);

  // Modal states
  const [selectedBom, setSelectedBom] = useState(null);
  const [selectedPi, setSelectedPi] = useState(null);
  const [isGenerateBomModalOpen, setIsGenerateBomModalOpen] = useState(false);
  const [selectedWoForBom, setSelectedWoForBom] = useState('');
  const [isCreatePoModalOpen, setIsCreatePoModalOpen] = useState(false);
  const [selectedPrsForPo, setSelectedPrsForPo] = useState([]);
  const [selectedVendorForPo, setSelectedVendorForPo] = useState('');
  const [piReviewComment, setPiReviewComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Sub-tab & search/filter states for non-technical users
  const [orderSubTab, setOrderSubTab] = useState('pos'); // 'pos' | 'prs'
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [bomRes, prRes, poRes, piRes, cpdRes, woRes, venRes] = await Promise.all([
        api.get('/bom').catch(() => ({ data: { data: { boms: [] } } })),
        api.get('/purchase/requisitions').catch(() => ({ data: { data: { requisitions: [] } } })),
        api.get('/purchase/orders').catch(() => ({ data: { data: { purchaseOrders: [] } } })),
        api.get('/proforma-invoices').catch(() => ({ data: { data: { proformaInvoices: [] } } })),
        api.get('/purchase/cpd-risk-matrix').catch(() => ({ data: { data: { matrix: [] } } })),
        api.get('/work-orders').catch(() => ({ data: { data: { workOrders: [] } } })),
        api.get('/vendors').catch(() => ({ data: { data: { vendors: [] } } }))
      ]);

      setBoms(bomRes.data.data?.boms || []);
      setRequisitions(prRes.data.data?.requisitions || []);
      setPurchaseOrders(poRes.data.data?.purchaseOrders || []);
      setProformaInvoices(piRes.data.data?.proformaInvoices || []);
      setCpdMatrix(cpdRes.data.data?.matrix || []);
      setWorkOrders(woRes.data.data?.workOrders || []);
      setVendors(venRes.data.data?.vendors || []);
    } catch (err) {
      console.error('Failed to fetch Purchase/BOM data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [activeTab]);

  // Handle AI BOM Generation for Work Order
  const handleGenerateBom = async (e) => {
    e.preventDefault();
    if (!selectedWoForBom) return;

    setActionLoading(true);
    try {
      const res = await api.post(`/bom/generate/${selectedWoForBom}`);
      showToast(`BOM ${res.data.data?.bom?.bomId} generated successfully!`);
      setIsGenerateBomModalOpen(false);
      setSelectedWoForBom('');
      await fetchAllData();
    } catch (err) {
      console.error('Failed to generate BOM:', err);
      alert(err.response?.data?.message || 'Failed to generate BOM');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle BOM Confirmation & Atomic PR Generation
  const handleConfirmBom = async (bomId) => {
    setActionLoading(true);
    try {
      const res = await api.post(`/bom/${bomId}/confirm`, {});
      showToast(`BOM confirmed! Generated ${res.data.data?.prs?.length || 0} Purchase Requisitions.`);
      setSelectedBom(null);
      await fetchAllData();
    } catch (err) {
      console.error('Failed to confirm BOM:', err);
      alert(err.response?.data?.message || 'Failed to confirm BOM');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle PO Creation
  const handleCreatePo = async (e) => {
    e.preventDefault();
    if (!selectedVendorForPo || selectedPrsForPo.length === 0) {
      alert('Please select a vendor and at least one Purchase Requisition.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post('/purchase/orders', {
        vendorId: selectedVendorForPo,
        prIds: selectedPrsForPo
      });

      showToast(`PO ${res.data.data?.purchaseOrder?.poId} issued with HIT Number: ${res.data.data?.purchaseOrder?.hitNumber}`);
      setIsCreatePoModalOpen(false);
      setSelectedPrsForPo([]);
      setSelectedVendorForPo('');
      await fetchAllData();
    } catch (err) {
      console.error('Failed to create PO:', err);
      alert(err.response?.data?.message || 'Failed to issue Purchase Order');
    } finally {
      setActionLoading(false);
    }
  };

  // Handle PI Deviation Review
  const handleReviewPiDeviations = async (piId, action) => {
    if (!piReviewComment || piReviewComment.trim().length < 3) {
      alert('Please enter a review reason/justification before submitting.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await api.post(`/proforma-invoices/${piId}/review`, {
        action,
        reviewNotes: piReviewComment.trim()
      });
      showToast(`Invoice deviations successfully ${action === 'ACCEPT_OVERRIDE' ? 'Approved & Overridden' : 'Rejected'}`);
      setSelectedPi(res.data.data?.proformaInvoice || null);
      setPiReviewComment('');
      await fetchAllData();
    } catch (err) {
      console.error('Failed to review deviations:', err);
      alert(err.response?.data?.message || 'Failed to review deviations');
    } finally {
      setActionLoading(false);
    }
  };

  // KPI Calculations
  const stats = {
    boms: boms.length,
    openPrs: requisitions.filter(p => p.status === 'OPEN').length,
    totalPrs: requisitions.length,
    activePos: purchaseOrders.length,
    cleanPis: proformaInvoices.filter(p => p.isCleanMatch || p.reconciliationStatus === 'MATCHED_CLEAN').length,
    unresolvedDeviations: proformaInvoices.filter(p => 
      !p.isCleanMatch && 
      p.reconciliationStatus !== 'MANUALLY_OVERRIDDEN' && 
      p.reconciliationStatus !== 'REJECTED' &&
      p.reconciliationStatus !== 'MATCHED_CLEAN'
    ).length,
    auditedDeviations: proformaInvoices.filter(p => 
      p.reconciliationStatus === 'MANUALLY_OVERRIDDEN' || 
      p.reconciliationStatus === 'REJECTED'
    ).length,
    criticalCpd: cpdMatrix.filter(c => c.riskLevel === 'CRITICAL_RISK').length
  };

  // Filtered lists based on search
  const filteredBoms = boms.filter(b => {
    const q = searchTerm.toLowerCase();
    return !q || 
      b.bomId?.toLowerCase().includes(q) || 
      b.workOrder?.workOrderId?.toLowerCase().includes(q) ||
      b.customer?.companyName?.toLowerCase().includes(q) ||
      b.valveSpecs?.valveType?.toLowerCase().includes(q);
  });

  const filteredPos = purchaseOrders.filter(po => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      po.poId?.toLowerCase().includes(q) ||
      po.hitNumber?.toLowerCase().includes(q) ||
      po.vendor?.name?.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'ALL' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPrs = requisitions.filter(pr => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      pr.prId?.toLowerCase().includes(q) ||
      pr.category?.toLowerCase().includes(q) ||
      pr.items?.some(it => it.partName?.toLowerCase().includes(q));
    const matchesStatus = statusFilter === 'ALL' || pr.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredPis = proformaInvoices.filter(pi => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = !q ||
      pi.piId?.toLowerCase().includes(q) ||
      pi.piNumber?.toLowerCase().includes(q) ||
      pi.hitNumber?.toLowerCase().includes(q) ||
      pi.vendor?.name?.toLowerCase().includes(q);
    
    if (statusFilter === 'NEEDS_ACTION') {
      return matchesSearch && !pi.isCleanMatch && pi.reconciliationStatus !== 'MANUALLY_OVERRIDDEN' && pi.reconciliationStatus !== 'REJECTED';
    }
    if (statusFilter === 'CLEAN') {
      return matchesSearch && (pi.isCleanMatch || pi.reconciliationStatus === 'MATCHED_CLEAN');
    }
    if (statusFilter === 'OVERRIDDEN') {
      return matchesSearch && pi.reconciliationStatus === 'MANUALLY_OVERRIDDEN';
    }
    if (statusFilter === 'REJECTED') {
      return matchesSearch && pi.reconciliationStatus === 'REJECTED';
    }
    return matchesSearch;
  });

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
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Purchase & Materials Management
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Work Order BOMs, material shortage requisitions, purchase orders with HIT traceability & vendor invoice reconciliation.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsGenerateBomModalOpen(true)}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles className="w-4 h-4" /> Create Valve BOM
          </button>

          <button
            onClick={() => setIsCreatePoModalOpen(true)}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Issue Purchase Order
          </button>

          <button
            onClick={fetchAllData}
            className="p-2 text-slate-600 hover:text-slate-900 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Clean, High-Contrast Summary Cards (Calm Cohesive Industrial Styling) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: BOMs */}
        <div 
          onClick={() => setActiveTab('bom')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeTab === 'bom' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Valve BOMs</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{stats.boms}</p>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Component lists</span>
        </div>

        {/* Card 2: Shortage PRs */}
        <div 
          onClick={() => { setActiveTab('orders'); setOrderSubTab('prs'); }}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            stats.openPrs > 0 ? 'border-amber-300 bg-amber-50/30' : 'border-slate-200'
          } ${activeTab === 'orders' && orderSubTab === 'prs' ? 'ring-2 ring-amber-500/30' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Pending PRs</span>
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
              {stats.totalPrs} Total
            </span>
          </div>
          <p className="text-2xl font-black text-amber-950 mt-1.5">{stats.openPrs}</p>
          <span className="text-[10px] text-amber-700 font-medium block mt-0.5">Shortages to procure</span>
        </div>

        {/* Card 3: POs Issued */}
        <div 
          onClick={() => { setActiveTab('orders'); setOrderSubTab('pos'); }}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeTab === 'orders' && orderSubTab === 'pos' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Purchase Orders</span>
            <ShoppingBag className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{stats.activePos}</p>
          <span className="text-[10px] text-indigo-600 font-bold block mt-0.5">HIT Number tracked</span>
        </div>

        {/* Card 4: Action Required PIs */}
        <div 
          onClick={() => { setActiveTab('pi'); setStatusFilter('NEEDS_ACTION'); }}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            stats.unresolvedDeviations > 0 ? 'border-rose-300 bg-rose-50/30' : 'border-slate-200'
          } ${activeTab === 'pi' && statusFilter === 'NEEDS_ACTION' ? 'ring-2 ring-rose-500/30' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-900">Review Invoices</span>
            {stats.unresolvedDeviations > 0 ? (
              <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                Action Needed
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-400">{stats.auditedDeviations} Audited</span>
            )}
          </div>
          <p className="text-2xl font-black text-rose-950 mt-1.5">{stats.unresolvedDeviations}</p>
          <span className="text-[10px] text-rose-700 font-medium block mt-0.5">Deviations detected</span>
        </div>

        {/* Card 5: Clean Invoices */}
        <div 
          onClick={() => { setActiveTab('pi'); setStatusFilter('CLEAN'); }}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            activeTab === 'pi' && statusFilter === 'CLEAN' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Clean Invoices</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-900 mt-1.5">{stats.cleanPis}</p>
          <span className="text-[10px] text-emerald-600 font-medium block mt-0.5">Zero errors / Auto-match</span>
        </div>

        {/* Card 6: CPD Delivery Risks */}
        <div 
          onClick={() => setActiveTab('cpd')}
          className={`p-4 bg-white rounded-2xl border transition-all cursor-pointer hover:shadow-sm ${
            stats.criticalCpd > 0 ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200'
          } ${activeTab === 'cpd' ? 'ring-2 ring-slate-800/20' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">Delivery Risks</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-slate-900 mt-1.5">{stats.criticalCpd}</p>
          <span className="text-[10px] text-slate-500 font-medium block mt-0.5">Customer deadline checks</span>
        </div>
      </div>

      {/* Step-by-Step Workflow Navigation Tabs */}
      <div className="bg-slate-100 p-1.5 rounded-2xl flex flex-wrap gap-1.5 border border-slate-200/80">
        <button
          onClick={() => { setActiveTab('bom'); setSearchTerm(''); setStatusFilter('ALL'); }}
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'bom' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' 
              : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            activeTab === 'bom' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
          }`}>1</span>
          <span>Valve Bill of Materials (BOM)</span>
        </button>

        <button
          onClick={() => { setActiveTab('orders'); setSearchTerm(''); setStatusFilter('ALL'); }}
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'orders' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' 
              : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            activeTab === 'orders' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
          }`}>2</span>
          <span>Shortage PRs & Purchase Orders</span>
        </button>

        <button
          onClick={() => { setActiveTab('pi'); setSearchTerm(''); setStatusFilter('ALL'); }}
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'pi' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' 
              : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            activeTab === 'pi' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
          }`}>3</span>
          <span>Vendor Invoice 2-Way Match</span>
          {stats.unresolvedDeviations > 0 && (
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          )}
        </button>

        <button
          onClick={() => { setActiveTab('cpd'); setSearchTerm(''); setStatusFilter('ALL'); }}
          className={`flex-1 min-w-[180px] py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'cpd' 
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80' 
              : 'text-slate-600 hover:bg-white/60 hover:text-slate-900'
          }`}
        >
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            activeTab === 'cpd' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'
          }`}>4</span>
          <span>Delivery Timeline & Lead Times</span>
        </button>
      </div>

      {/* Global Simple Search & Filter Bar for non-tech users */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by ID, Work Order, Vendor, or Part Name..."
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

        {/* Tab-specific Sub-controls */}
        {activeTab === 'orders' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="p-1 bg-slate-100 rounded-xl flex items-center gap-1 border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setOrderSubTab('pos')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  orderSubTab === 'pos' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Issued Purchase Orders ({purchaseOrders.length})
              </button>
              <button
                onClick={() => setOrderSubTab('prs')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  orderSubTab === 'prs' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Shortage Requisitions ({requisitions.length})
              </button>
            </div>
          </div>
        )}

        {activeTab === 'pi' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-500 font-medium">Filter by Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              <option value="ALL">Show All Invoices ({proformaInvoices.length})</option>
              <option value="NEEDS_ACTION">Action Needed / Deviant ({stats.unresolvedDeviations})</option>
              <option value="CLEAN">Clean 100% Match ({stats.cleanPis})</option>
              <option value="OVERRIDDEN">Manually Approved ({proformaInvoices.filter(p => p.reconciliationStatus === 'MANUALLY_OVERRIDDEN').length})</option>
              <option value="REJECTED">Rejected Invoices ({proformaInvoices.filter(p => p.reconciliationStatus === 'REJECTED').length})</option>
            </select>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: AI BOM REGISTER */}
      {/* ========================================================================= */}
      {activeTab === 'bom' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-black text-slate-900">Valve Bill of Materials (BOM) Register</h3>
              <p className="text-xs text-slate-500 font-medium">
                Component breakdown & inventory shortage calculation per Work Order.
              </p>
            </div>
            <span className="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded-lg border border-slate-200">
              Showing {filteredBoms.length} of {boms.length} BOM(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">BOM Number</th>
                  <th className="py-3 px-4">Linked Work Order</th>
                  <th className="py-3 px-4">Valve Specification</th>
                  <th className="py-3 px-4">Components</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBoms.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No matching BOM records found.
                    </td>
                  </tr>
                ) : (
                  filteredBoms.map(b => (
                    <tr key={b._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-black text-slate-900 text-xs">
                        {b.bomId}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-indigo-600">{b.workOrder?.workOrderId || 'N/A'}</span>
                        <p className="text-[11px] text-slate-500 mt-0.5">{b.customer?.companyName || 'Customer'}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900">
                          {b.valveSpecs?.size} {b.valveSpecs?.pressureClass} {b.valveSpecs?.valveType}
                        </span>
                        <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                          Body: {b.valveSpecs?.bodyMoc} | Standard: {b.valveSpecs?.designStandard}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold border border-slate-200">
                          {b.components?.length || 0} Parts
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {b.status === 'PR_GENERATED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Ready for Procurement
                          </span>
                        ) : b.status === 'CONFIRMED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-blue-50 text-blue-800 border border-blue-200">
                            <Check className="w-3.5 h-3.5 text-blue-600" /> BOM Confirmed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Draft BOM
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-2">
                        <button
                          onClick={() => setSelectedBom(b)}
                          className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs transition-colors cursor-pointer border border-slate-200"
                        >
                          View Breakdown
                        </button>
                        {b.status !== 'PR_GENERATED' && (
                          <button
                            onClick={() => handleConfirmBom(b._id)}
                            disabled={actionLoading}
                            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-xs shadow-xs transition-colors cursor-pointer"
                          >
                            Confirm & Reserve Stock
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PURCHASE ORDERS & REQUISITIONS (SEPARATED SUB-TABS) */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orderSubTab === 'pos' ? (
            /* SUB-TAB 2A: PURCHASE ORDERS */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Purchase Orders Issued to Vendors</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Permanent traceability HIT Number (HIT-YYYY-NNNN) flows through PO, PI, QC & Production.
                  </p>
                </div>
                <span className="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded-lg border border-slate-200">
                  Showing {filteredPos.length} of {purchaseOrders.length} PO(s)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">PO Number</th>
                      <th className="py-3 px-4">HIT Traceability #</th>
                      <th className="py-3 px-4">Vendor</th>
                      <th className="py-3 px-4">Order Value</th>
                      <th className="py-3 px-4">Customer Promised Date</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                          No purchase orders match your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPos.map(po => (
                        <tr key={po._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-black text-slate-900">{po.poId}</td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                              <Tag className="w-3.5 h-3.5 text-indigo-600" /> {po.hitNumber}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-800">{po.vendor?.name || 'Vendor'}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-mono font-bold text-slate-900">₹{(po.grandTotal || 0).toLocaleString()}</span>
                            <span className="block text-[10px] text-slate-500">incl. 18% GST</span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-medium text-slate-800">
                              {po.cpdDate ? new Date(po.cpdDate).toLocaleDateString() : 'N/A'}
                            </span>
                            <span className={`block text-[10px] font-black ${
                              po.cpdRiskLevel === 'CRITICAL_RISK' ? 'text-rose-600 font-bold' :
                              po.cpdRiskLevel === 'MODERATE_RISK' ? 'text-amber-600' : 'text-emerald-700'
                            }`}>
                              {po.cpdRiskLevel === 'CRITICAL_RISK' ? '⚠️ Overdue / At Risk' : '🟢 On Schedule'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {po.status === 'PI_MATCHED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Invoice Reconciled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
                                <ShoppingBag className="w-3.5 h-3.5 text-slate-600" /> Sent to Vendor
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* SUB-TAB 2B: MATERIAL SHORTAGE REQUISITIONS */
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-sm font-black text-slate-900">Material Shortage Requisitions (Pending Purchase)</h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Categorized shortages generated automatically after warehouse stock reservation.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsCreatePoModalOpen(true)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-xs transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Convert to PO
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                      <th className="py-3 px-4">PR Number</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Items to Order</th>
                      <th className="py-3 px-4">Priority</th>
                      <th className="py-3 px-4">Procurement Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPrs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-slate-400 font-medium">
                          No requisitions match your filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPrs.map(pr => (
                        <tr key={pr._id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-black text-slate-900">{pr.prId}</td>
                          <td className="py-3.5 px-4">
                            <span className="font-bold text-slate-800">{pr.category}</span>
                          </td>
                          <td className="py-3.5 px-4">
                            {pr.items?.map((it, idx) => (
                              <div key={idx} className="text-slate-700 font-medium">
                                • {it.partName} ({it.materialGrade}) — <strong className="text-slate-900">{it.quantity} {it.unit}</strong>
                              </div>
                            ))}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-black ${
                              pr.priority === 'URGENT' ? 'bg-rose-100 text-rose-800 border border-rose-200' : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}>
                              {pr.priority}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            {pr.status === 'PO_CREATED' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> PO Issued
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                                <Clock className="w-3.5 h-3.5 text-amber-600" /> Awaiting PO
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PROFORMA INVOICES & 2-WAY RECONCILIATION */}
      {/* ========================================================================= */}
      {activeTab === 'pi' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="text-sm font-black text-slate-900">Vendor Proforma Invoices & 2-Way Matching</h3>
              <p className="text-xs text-slate-500 font-medium">
                Automatic tolerance validation for price (5%), quantity (0%), and promised delivery dates (2 days).
              </p>
            </div>
            <span className="text-xs text-slate-500 font-bold bg-white px-3 py-1 rounded-lg border border-slate-200">
              Showing {filteredPis.length} of {proformaInvoices.length} Invoice(s)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">Invoice Reference</th>
                  <th className="py-3 px-4">Matched PO & HIT Number</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Invoice Amount</th>
                  <th className="py-3 px-4">Reconciliation Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPis.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No vendor invoices match your filter.
                    </td>
                  </tr>
                ) : (
                  filteredPis.map(pi => (
                    <tr key={pi._id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-black text-slate-900 text-xs">{pi.piId}</span>
                        <p className="text-[11px] text-slate-500 font-semibold mt-0.5">Ref: {pi.piNumber}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-bold text-indigo-600">{pi.matchedPo?.poId || 'N/A'}</span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 text-indigo-800 border border-indigo-200 block w-fit mt-0.5">
                          {pi.hitNumber}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{pi.vendor?.name || 'Vendor'}</td>
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900 text-xs">
                        ₹{(pi.grandTotal || 0).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {pi.reconciliationStatus === 'MATCHED_CLEAN' || (pi.isCleanMatch && pi.reconciliationStatus !== 'MANUALLY_OVERRIDDEN') ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Clean Match (0 Dev)
                          </span>
                        ) : pi.reconciliationStatus === 'MANUALLY_OVERRIDDEN' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Manager Approved
                          </span>
                        ) : pi.reconciliationStatus === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border border-slate-300">
                            <X className="w-3.5 h-3.5 text-slate-600" /> Invoice Rejected
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> {pi.deviations?.length || 0} Deviations Detected
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => setSelectedPi(pi)}
                          className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" /> Review & Compare
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CPD PROCUREMENT RISK TIMELINE */}
      {/* ========================================================================= */}
      {activeTab === 'cpd' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Customer Promised Date (CPD) Schedule</h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Calculates the latest safe date to order raw materials and trims to prevent production delays.
              </p>
            </div>
            <div className="text-xs bg-slate-100 px-3 py-1.5 rounded-xl text-slate-700 font-bold border border-slate-200">
              Formula: CPD − (Vendor Lead + QC + Buffer)
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500 text-xs block">1. Vendor Manufacturing & Transit</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">15 Days</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500 text-xs block">2. Inward QC Testing & NDT</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">3 Days</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-500 text-xs block">3. Assembly, Hydro-test & Buffer</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">5 Days</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                  <th className="py-3 px-4">PO & HIT Number</th>
                  <th className="py-3 px-4">Vendor</th>
                  <th className="py-3 px-4">Customer Delivery Deadline (CPD)</th>
                  <th className="py-3 px-4">Total Lead Time</th>
                  <th className="py-3 px-4">Must Order By</th>
                  <th className="py-3 px-4">Schedule Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cpdMatrix.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 font-medium">
                      No active procurement schedules calculated.
                    </td>
                  </tr>
                ) : (
                  cpdMatrix.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                        {item.poId}
                        <span className="block text-[11px] text-indigo-600 font-black">{item.hitNumber}</span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{item.vendorName}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {new Date(item.cpdDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        <strong>{item.leadTimeBreakdown?.totalProcurementLeadDays || 23} Days</strong> ({item.leadTimeBreakdown?.vendorLeadTimeDays || 15}d + {item.leadTimeBreakdown?.qcInspectionDays || 3}d + {item.leadTimeBreakdown?.machiningBufferDays || 5}d)
                      </td>
                      <td className="py-3.5 px-4 font-black text-slate-900 text-xs">
                        {new Date(item.latestProcurementStartDate).toLocaleDateString()}
                      </td>
                      <td className="py-3.5 px-4">
                        {item.riskLevel === 'CRITICAL_RISK' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-50 text-rose-800 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Action Needed (Overdue)
                          </span>
                        ) : item.riskLevel === 'MODERATE_RISK' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" /> Order Soon
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> On Schedule
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* BOM BREAKDOWN MODAL */}
      {selectedBom && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-brand-50 rounded-2xl text-brand-600">
                  <Layers className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    BOM Breakdown: {selectedBom.bomId}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedBom.valveSpecs?.size} {selectedBom.valveSpecs?.pressureClass} {selectedBom.valveSpecs?.valveType} ({selectedBom.valveSpecs?.bodyMoc})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBom(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Part Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Material Grade</th>
                    <th className="py-2.5 px-3 text-center">Required Qty</th>
                    <th className="py-2.5 px-3 text-center">In Stock</th>
                    <th className="py-2.5 px-3 text-center">Shortage (PR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedBom.components?.map((c, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{c.itemNo}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{c.partName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{c.category}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{c.materialGrade}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-900">{c.totalRequiredQty} {c.unit}</td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{c.inStockQty || 0}</td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        {c.shortageQty > 0 ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">
                            {c.shortageQty} {c.unit}
                          </span>
                        ) : (
                          <span className="text-emerald-600">✓ In Stock</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedBom(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close
              </button>
              {selectedBom.status !== 'PR_GENERATED' && (
                <button
                  type="button"
                  onClick={() => handleConfirmBom(selectedBom._id)}
                  disabled={actionLoading}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer"
                >
                  Confirm BOM & Reserve Stock
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PI SIDE-BY-SIDE RECONCILIATION MODAL */}
      {selectedPi && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 space-y-4 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-50 rounded-2xl text-indigo-600">
                  <Scale className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    2-Way Reconciliation: {selectedPi.piNumber} vs {selectedPi.matchedPo?.poId}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Permanent Traceability: <strong>{selectedPi.hitNumber}</strong> | Vendor: {selectedPi.vendor?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPi(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Reconciliation State Banners */}
            {selectedPi.isCleanMatch || selectedPi.reconciliationStatus === 'MATCHED_CLEAN' ? (
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>100% Clean Match — All quantities, rates, and delivery dates conform within configured tolerances. Zero manual intervention required.</span>
              </div>
            ) : selectedPi.reconciliationStatus === 'MANUALLY_OVERRIDDEN' ? (
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-200 text-xs text-indigo-900 space-y-1.5">
                <div className="flex items-center gap-2 font-black text-sm text-indigo-950">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <span>Status: MANUALLY OVERRIDDEN & ACCEPTED</span>
                </div>
                <p className="text-slate-700">
                  Reviewed By: <strong>{selectedPi.reviewedBy?.name || 'Authorized Manager'}</strong> ({selectedPi.reviewedBy?.role || 'PM'}) on {new Date(selectedPi.reviewedAt || Date.now()).toLocaleString()}
                </p>
                <p className="text-slate-800 bg-white/80 p-2.5 rounded-lg border border-indigo-100 font-medium">
                  Justification Reason: <em>"{selectedPi.reviewNotes}"</em>
                </p>
                <p className="text-[11px] text-slate-500 font-medium mt-1">
                  Note: All {selectedPi.deviations?.length || 0} original deviation records remain permanently preserved for procurement audit trail.
                </p>
              </div>
            ) : selectedPi.reconciliationStatus === 'REJECTED' ? (
              <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 space-y-1.5">
                <div className="flex items-center gap-2 font-black text-sm text-rose-950">
                  <X className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Status: PROFORMA INVOICE REJECTED</span>
                </div>
                <p className="text-slate-700">
                  Rejected By: <strong>{selectedPi.reviewedBy?.name || 'Authorized Manager'}</strong> on {new Date(selectedPi.reviewedAt || Date.now()).toLocaleString()}
                </p>
                <p className="text-rose-900 bg-white/80 p-2.5 rounded-lg border border-rose-100 font-medium">
                  Rejection Reason: <em>"{selectedPi.reviewNotes}"</em>
                </p>
              </div>
            ) : (
              /* UNRECONCILED DEVIANT STATE */
              <div className="space-y-4">
                <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 text-xs text-rose-900 space-y-2">
                  <div className="flex items-center gap-2 font-black text-sm">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>{selectedPi.deviations?.length || 0} Deviations Detected:</span>
                  </div>
                  <div className="space-y-1.5 pl-7">
                    {selectedPi.deviations?.map((d, idx) => (
                      <div key={idx} className="p-2.5 bg-white/90 rounded-xl border border-rose-200">
                        <p className="font-bold text-rose-900">• [{d.type}] {d.reason}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">PO Value: <strong>{d.poValue}</strong> | PI Value: <strong className="text-rose-700">{d.piValue}</strong></p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* REVIEW DECISION SECTION (Prominently rendered for unreviewed deviant PIs) */}
                <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-2xl border-2 border-indigo-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" /> Review Decision (Purchase Manager / Director)
                    </h4>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Authorized: SA, DIR, TA, PM
                    </span>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-800 block mb-1">
                      Review Comment / Justification Reason <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={piReviewComment}
                      onChange={(e) => setPiReviewComment(e.target.value)}
                      placeholder="Enter mandatory justification or explanation for overriding or rejecting deviations (e.g. Price variance approved by Director due to raw material surcharge for ASTM A216 WCB)..."
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-inner"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => handleReviewPiDeviations(selectedPi._id, 'REJECT')}
                      disabled={actionLoading}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    >
                      <X className="w-4 h-4 text-rose-600" /> Reject PI
                    </button>
                    <button
                      type="button"
                      onClick={() => handleReviewPiDeviations(selectedPi._id, 'ACCEPT_OVERRIDE')}
                      disabled={actionLoading}
                      className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4 text-white" /> Override & Accept
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-black uppercase text-slate-500 border-b border-slate-200">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">Qty</th>
                    <th className="py-2.5 px-3">Unit Rate</th>
                    <th className="py-2.5 px-3">Total</th>
                    <th className="py-2.5 px-3">Match Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPi.items?.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-500">{it.itemNo}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">{it.description}</td>
                      <td className="py-2.5 px-3 font-mono">{it.quantity} {it.unit}</td>
                      <td className="py-2.5 px-3 font-mono">₹{it.unitRate?.toLocaleString()}</td>
                      <td className="py-2.5 px-3 font-mono font-bold">₹{it.totalAmount?.toLocaleString()}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          it.matchStatus === 'MATCHED' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {it.matchStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-[11px] text-slate-500">
                {selectedPi.reconciliationStatus === 'MANUALLY_OVERRIDDEN' ? (
                  <span className="text-indigo-600 font-bold">Audited & Manually Accepted</span>
                ) : selectedPi.reconciliationStatus === 'REJECTED' ? (
                  <span className="text-rose-600 font-bold">Proforma Invoice Rejected</span>
                ) : selectedPi.isCleanMatch ? (
                  <span className="text-emerald-600 font-bold">Clean 2-Way Match</span>
                ) : (
                  <span className="text-amber-600 font-bold">Awaiting Manager Review Decision</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setSelectedPi(null); setPiReviewComment(''); }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GENERATE BOM MODAL */}
      {isGenerateBomModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Auto-Suggest Bill of Materials</h3>
              <button onClick={() => setIsGenerateBomModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGenerateBom} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select Work Order *</label>
                <select
                  required
                  value={selectedWoForBom}
                  onChange={(e) => setSelectedWoForBom(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="">-- Choose Work Order --</option>
                  {workOrders.map(wo => (
                    <option key={wo._id} value={wo._id}>
                      {wo.workOrderId} ({wo.customer?.companyName || 'Client'})
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-3 bg-brand-50 rounded-xl border border-brand-100 text-xs text-brand-900">
                <p className="font-bold">✨ Deterministic AI Engine</p>
                <p className="text-[11px] text-brand-700 mt-0.5">
                  Applies standard valve component mapping (Body, Bonnet, Wedge, Stem, Seat, Fasteners, Gaskets) & computes warehouse stock shortages automatically.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsGenerateBomModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black shadow-md"
                >
                  Generate AI BOM
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE PURCHASE ORDER MODAL */}
      {isCreatePoModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Issue Purchase Order</h3>
              <button onClick={() => setIsCreatePoModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePo} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">1. Select Vendor *</label>
                <select
                  required
                  value={selectedVendorForPo}
                  onChange={(e) => setSelectedVendorForPo(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold"
                >
                  <option value="">-- Choose Vendor --</option>
                  {vendors.map(v => (
                    <option key={v._id} value={v._id}>
                      {v.name} ({v.vendorType || 'Supplier'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">2. Select Purchase Requisition (Shortage) *</label>
                <div className="max-h-40 overflow-y-auto space-y-1.5 border border-slate-200 rounded-xl p-2 bg-slate-50 text-xs">
                  {requisitions.filter(r => r.status === 'OPEN').length === 0 ? (
                    <p className="text-slate-400 p-2 text-center">No open requisitions available.</p>
                  ) : (
                    requisitions.filter(r => r.status === 'OPEN').map(pr => (
                      <label key={pr._id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedPrsForPo.includes(pr._id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPrsForPo([...selectedPrsForPo, pr._id]);
                            } else {
                              setSelectedPrsForPo(selectedPrsForPo.filter(id => id !== pr._id));
                            }
                          }}
                        />
                        <div>
                          <span className="font-bold text-slate-900">{pr.prId} ({pr.category})</span>
                          <p className="text-[10px] text-slate-500">{pr.items?.length || 0} shortage item(s)</p>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-900">
                <p className="font-bold">🔒 HIT Number Assignment</p>
                <p className="text-[11px] text-indigo-700 mt-0.5">
                  The system will automatically assign a permanent traceability identifier <strong>HIT-YYYY-NNNN</strong> that flows through PO, PI, QC, and Production.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreatePoModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black shadow-md"
                >
                  Issue Purchase Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
