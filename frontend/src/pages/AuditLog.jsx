import React, { useState, useEffect, useCallback } from 'react';
import { 
  ClipboardList, Search, Filter, Calendar, User, Database, 
  ChevronRight, ChevronDown, History, AlertCircle, Loader2,
  ArrowRight, Info, Eye, Trash2, ChevronLeft, ShieldCheck,
  Laptop, Globe, KeyRound, CheckCircle2, SlidersHorizontal,
  RefreshCw, X
} from 'lucide-react';
import api from '../api/client';

const MODULE_COLORS = {
  AUTH: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  ENQUIRY: 'bg-blue-100 text-blue-800 border-blue-200',
  QUOTATION: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  DRAWING: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Drawing: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  WORKORDER: 'bg-amber-100 text-amber-800 border-amber-200',
  WorkOrder: 'bg-amber-100 text-amber-800 border-amber-200',
  PURCHASE: 'bg-teal-100 text-teal-800 border-teal-200',
  Purchase: 'bg-teal-100 text-teal-800 border-teal-200',
  BOM: 'bg-sky-100 text-sky-800 border-sky-200',
  QAP: 'bg-violet-100 text-violet-800 border-violet-200',
  PRODUCT: 'bg-orange-100 text-orange-800 border-orange-200',
  CUSTOMER: 'bg-pink-100 text-pink-800 border-pink-200',
  USER: 'bg-slate-100 text-slate-800 border-slate-200',
  TASK: 'bg-amber-100 text-amber-800 border-amber-200',
  SETTINGS: 'bg-rose-100 text-rose-800 border-rose-200',
  MASTER_DATA: 'bg-purple-100 text-purple-800 border-purple-200',
  SYSTEM_AUDIT_LOG: 'bg-slate-100 text-slate-700 border-slate-200'
};

const ACTION_COLORS = {
  CREATE: 'text-emerald-500 bg-emerald-50 border-emerald-100',
  UPDATE: 'text-amber-500 bg-amber-50 border-amber-100',
  DELETE: 'text-rose-500 bg-rose-50 border-rose-100',
  LOGIN: 'text-blue-500 bg-blue-50 border-blue-100',
  LOGOUT: 'text-slate-500 bg-slate-50 border-slate-100',
  STATUS_CHANGE: 'text-violet-500 bg-violet-50 border-violet-100',
  ASSIGNMENT: 'text-pink-500 bg-pink-50 border-pink-100',
  PASSWORD_CHANGE: 'text-purple-500 bg-purple-50 border-purple-100',
  REVIEW_PI_DEVIATIONS: 'text-cyan-500 bg-cyan-50 border-cyan-100',
  GENERATE_BOM: 'text-teal-500 bg-teal-50 border-teal-100',
  UPDATE_LINE_ITEMS: 'text-amber-500 bg-amber-50 border-amber-100',
  CREATE_PO: 'text-indigo-500 bg-indigo-50 border-indigo-100',
  RELEASE: 'text-emerald-500 bg-emerald-50 border-emerald-100',
  APPROVE: 'text-green-500 bg-green-50 border-green-100',
  TOGGLE_USER_STATUS: 'text-orange-500 bg-orange-50 border-orange-100',
};

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'ENQUIRY', label: 'Enquiries' },
  { value: 'QUOTATION', label: 'Quotations' },
  { value: 'DRAWING', label: 'Drawings' },
  { value: 'WORKORDER', label: 'Work Orders' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'BOM', label: 'BOM' },
  { value: 'QAP', label: 'QAP' },
  { value: 'CUSTOMER', label: 'Customers' },
  { value: 'PRODUCT', label: 'Products' },
  { value: 'USER', label: 'Users' },
  { value: 'AUTH', label: 'Authentication & Security' },
  { value: 'SETTINGS', label: 'Settings' },
  { value: 'MASTER_DATA', label: 'Master Data' },
];

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'CREATE', label: 'Create' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'LOGIN', label: 'Login' },
  { value: 'LOGOUT', label: 'Logout' },
  { value: 'STATUS_CHANGE', label: 'Status Change' },
  { value: 'ASSIGNMENT', label: 'Assignment' },
  { value: 'PASSWORD_CHANGE', label: 'Password Change' },
  { value: 'APPROVE', label: 'Approve' },
  { value: 'RELEASE', label: 'Release' },
  { value: 'CREATE_PO', label: 'Create PO' },
  { value: 'GENERATE_BOM', label: 'Generate BOM' },
  { value: 'REVIEW_PI_DEVIATIONS', label: 'Review PI Deviations' },
  { value: 'TOGGLE_USER_STATUS', label: 'Toggle User Status' },
];

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [expandedLog, setExpandedLog] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);
  const [users, setUsers] = useState([]);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    module: '',
    user: '',
    action: '',
    datePreset: 'all',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    setSelectedLogs([]);
  }, [logs]);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data?.data?.users || []);
    } catch (err) {
      console.error('Failed to fetch users for audit filter:', err);
    }
  };

  const fetchLogs = useCallback(async (targetPage = page, targetLimit = limit) => {
    setLoading(true);
    try {
      const params = {
        page: targetPage,
        limit: targetLimit
      };

      if (filters.module) params.module = filters.module;
      if (filters.user) params.user = filters.user;
      if (filters.action) params.action = filters.action;
      if (searchQuery.trim()) params.q = searchQuery.trim();

      // Date range filtering
      if (filters.datePreset === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        params.startDate = today.toISOString();
      } else if (filters.datePreset === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        params.startDate = d.toISOString();
      } else if (filters.datePreset === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        params.startDate = d.toISOString();
      } else if (filters.datePreset === 'custom') {
        if (filters.startDate) params.startDate = filters.startDate;
        if (filters.endDate) params.endDate = filters.endDate;
      }

      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/admin/logs?${query}`);
      const data = res.data?.data;

      if (data) {
        setLogs(data.logs || []);
        setTotalCount(data.total ?? (data.logs || []).length);
        setTotalPages(data.pages || 1);
        setPage(data.page || targetPage);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, limit, filters, searchQuery]);

  useEffect(() => {
    fetchUsers();
  }, []);

  // Fetch when filters or search changes (resetting page to 1)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLogs(1, limit);
    }, 250);
    return () => clearTimeout(timer);
  }, [filters, searchQuery, limit]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchLogs(newPage, limit);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleSelectLog = (id) => {
    setSelectedLogs(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLogs.length === logs.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(logs.map(log => log._id));
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedLogs.length) return;
    if (!window.confirm(`Are you sure you want to permanently delete the ${selectedLogs.length} selected audit log(s)?`)) {
      return;
    }
    setLoading(true);
    try {
      await api.delete('/admin/logs', { data: { ids: selectedLogs } });
      setSelectedLogs([]);
      fetchLogs(page, limit);
    } catch (err) {
      console.error('Failed to delete logs:', err);
      alert('Error: Failed to delete selected audit logs');
      setLoading(false);
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getUserName = (log) => {
    if (log.user_id && typeof log.user_id === 'object') {
      return log.user_id.name || log.user_id.fullName || log.user_id.email || 'User';
    }
    return 'System / Bot';
  };

  const getUserRole = (log) => {
    if (log.user_id && typeof log.user_id === 'object') {
      return log.user_id.role || '';
    }
    return '';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatIp = (ip) => {
    if (!ip || ip === 'Not recorded') return 'Not recorded';
    if (ip === '::1' || ip === '127.0.0.1') return '::1 (Localhost)';
    return ip;
  };

  const renderDiff = (log) => {
    const { action, previousState, newState, details, resourceName } = log;

    // 1. Specialized UI for LOGIN actions
    if (action === 'LOGIN') {
      return (
        <div className="bg-white rounded-xl border border-blue-100 p-4 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0 mt-0.5">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">User Session Authenticated</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Secure login verified via credential hash. Session token established for IP: <span className="font-mono font-bold text-slate-700">{formatIp(log.ipAddress)}</span>.
            </p>
            {log.userAgent && (
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1.5 truncate max-w-xl">
                <Laptop className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{log.userAgent}</span>
              </p>
            )}
          </div>
        </div>
      );
    }

    // 2. Specialized UI for PASSWORD_CHANGE
    if (action === 'PASSWORD_CHANGE') {
      return (
        <div className="bg-white rounded-xl border border-purple-100 p-4 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600 shrink-0 mt-0.5">
            <KeyRound className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Credentials Updated</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Password was successfully changed and hashed with bcrypt. Previous sessions invalidated.
            </p>
          </div>
        </div>
      );
    }

    // 3. CREATE action — display created state
    if ((action === 'CREATE' || (!previousState && newState)) && newState) {
      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <p className="text-[11px] font-black text-emerald-700 uppercase tracking-wider">Created Record Data</p>
          </div>
          <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl text-xs overflow-auto max-h-72 scrollbar-thin font-mono leading-relaxed shadow-inner">
            {JSON.stringify(newState, null, 2)}
          </pre>
        </div>
      );
    }

    // 4. DELETE action
    if (action === 'DELETE') {
      return (
        <div className="bg-white rounded-xl border border-rose-100 p-4 shadow-sm flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 shrink-0 mt-0.5">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-rose-800">Permanent Record Deletion</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Entity <span className="font-bold text-slate-700 font-mono">{resourceName || log.related_id || 'N/A'}</span> was permanently removed from database by {getUserName(log)}.
            </p>
            {previousState && (
              <div className="mt-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Archived Snapshot Prior to Deletion:</p>
                <pre className="bg-slate-50 text-slate-600 p-3 rounded-lg text-xs overflow-auto max-h-48 border border-slate-200 font-mono">
                  {JSON.stringify(previousState, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 5. UPDATE action — side-by-side field diff
    const prevKeys = Object.keys(previousState || {});
    const nextKeys = Object.keys(newState || {});

    if (prevKeys.length === 0 && nextKeys.length === 0) {
      return (
        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center">
          <p className="text-xs text-slate-500 font-medium">{details || 'Action completed successfully.'}</p>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[11px] font-black text-rose-600 uppercase tracking-wider flex items-center gap-1.5">
            <span>←</span> Previous Value
          </p>
          <div className="bg-rose-50/70 border border-rose-100 p-4 rounded-xl overflow-auto max-h-64 scrollbar-thin">
            {prevKeys.length === 0 ? (
              <p className="text-xs text-rose-400 italic">Empty</p>
            ) : (
              prevKeys.map(key => (
                <div key={key} className="mb-2 text-xs border-b border-rose-100/60 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-bold text-rose-800">{key}:</span>{' '}
                  <span className="text-rose-700 font-mono break-all">{JSON.stringify(previousState[key])}</span>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-black text-emerald-600 uppercase tracking-wider flex items-center gap-1.5">
            <span>→</span> Updated Value
          </p>
          <div className="bg-emerald-50/70 border border-emerald-100 p-4 rounded-xl overflow-auto max-h-64 scrollbar-thin">
            {nextKeys.length === 0 ? (
              <p className="text-xs text-emerald-400 italic">Empty</p>
            ) : (
              nextKeys.map(key => (
                <div key={key} className="mb-2 text-xs border-b border-emerald-100/60 pb-1.5 last:border-0 last:pb-0">
                  <span className="font-bold text-emerald-800">{key}:</span>{' '}
                  <span className="text-emerald-700 font-mono break-all">{JSON.stringify(newState[key])}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  const startLogIndex = totalCount === 0 ? 0 : (page - 1) * limit + 1;
  const endLogIndex = Math.min(page * limit, totalCount);

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 border border-brand-100 rounded-xl text-brand-600">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">System Audit Log</h1>
                <span className="text-xs font-bold px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full border border-slate-200">
                  {totalCount} Total Events
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">
                Comprehensive, traceable record of all workflow transactions, user activity, and data changes.
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2.5">
          {selectedLogs.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="px-3.5 py-2 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 hover:bg-rose-100 transition-all shadow-sm flex items-center gap-2 font-bold text-xs"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              Delete Selected ({selectedLogs.length})
            </button>
          )}
          <button 
            onClick={() => fetchLogs(page, limit)}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-1.5 font-bold text-xs"
            title="Refresh logs"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-brand-600' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Control Center */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          
          {/* Search Query */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search keyword, ID, IP, user..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 transition-all"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Module Filter */}
          <div className="relative">
            <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              name="module" 
              value={filters.module} 
              onChange={handleFilterChange}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 transition-all cursor-pointer"
            >
              {MODULE_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* User Filter */}
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              name="user" 
              value={filters.user} 
              onChange={handleFilterChange}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 transition-all cursor-pointer"
            >
              <option value="">All Users</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Action Filter */}
          <div className="relative">
            <SlidersHorizontal className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              name="action" 
              value={filters.action} 
              onChange={handleFilterChange}
              className="w-full pl-10 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold appearance-none outline-none focus:bg-white focus:ring-4 focus:ring-brand-500/10 focus:border-brand-400 transition-all cursor-pointer"
            >
              {ACTION_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Date Filter & Limit Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">Timeframe:</span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'today', label: 'Today' },
              { id: 'week', label: 'Past 7 Days' },
              { id: 'month', label: 'Past 30 Days' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => setFilters(f => ({ ...f, datePreset: preset.id }))}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  filters.datePreset === preset.id
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-bold text-xs">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold outline-none cursor-pointer"
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Select All & Status Banner */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm mb-4">
        <label className="flex items-center gap-2.5 cursor-pointer select-none">
          <input 
            type="checkbox"
            checked={logs.length > 0 && selectedLogs.length === logs.length}
            onChange={toggleSelectAll}
            className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          />
          <span>Select All on this page ({logs.length} items)</span>
        </label>
        
        <div className="flex items-center gap-4">
          {selectedLogs.length > 0 && (
            <span className="text-rose-600 font-bold">{selectedLogs.length} selected</span>
          )}
          <span className="text-slate-400 font-medium">
            Showing <strong className="text-slate-700">{startLogIndex}</strong> - <strong className="text-slate-700">{endLogIndex}</strong> of <strong className="text-slate-700">{totalCount}</strong>
          </span>
        </div>
      </div>

      {/* Logs List */}
      <div className="space-y-3">
        {loading && !logs.length ? (
          <div className="flex flex-col items-center justify-center py-24 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Loader2 className="w-9 h-9 animate-spin text-brand-600 mb-3" />
            <p className="text-sm font-bold text-slate-700">Loading audit records...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <Info className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-700">No activity logs found</p>
            <p className="text-xs text-slate-500 mt-1">Try broadening your search term or adjusting filters.</p>
          </div>
        ) : (
          logs.map(log => (
            <div 
              key={log._id} 
              className={`bg-white rounded-xl border transition-all duration-150 overflow-hidden shadow-sm ${
                expandedLog === log._id 
                  ? 'border-brand-400 ring-4 ring-brand-500/10' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div 
                className="px-5 py-3.5 flex items-center gap-4 cursor-pointer select-none"
                onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
              >
                {/* Select Box */}
                <div 
                  className="shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input 
                    type="checkbox"
                    checked={selectedLogs.includes(log._id)}
                    onChange={() => toggleSelectLog(log._id)}
                    className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </div>

                {/* Action Badge & Module */}
                <div className="flex-1 flex flex-col md:flex-row md:items-center gap-3 min-w-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border shrink-0 ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                      {log.module}
                    </span>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border shrink-0 ${ACTION_COLORS[log.action] || 'text-slate-600 bg-slate-50 border-slate-200'}`}>
                      {log.action?.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-slate-700 font-semibold truncate">
                      {log.details || `Action on ${log.resourceName || 'Resource'}`}
                    </p>
                  </div>

                  {/* Meta: User & Date */}
                  <div className="flex items-center gap-5 text-xs text-slate-400 shrink-0 font-medium">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-700 font-bold">{getUserName(log)}</span>
                      {getUserRole(log) && (
                        <span className="text-[10px] text-slate-400 font-bold">({getUserRole(log)})</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(log.timestamp)}</span>
                    </div>

                    <div className="text-slate-400 p-0.5">
                      {expandedLog === log._id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Card Details */}
              {expandedLog === log._id && (
                <div className="px-6 pb-6 pt-3 bg-slate-50/80 border-t border-slate-100 animate-in slide-in-from-top-2 duration-150">
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Resource Entity</p>
                      <p className="text-xs font-mono font-bold text-slate-800 truncate">
                        {log.resourceName || log.related_id || 'System Entity'}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">IP Address</p>
                      <p className="text-xs font-mono font-bold text-slate-800 flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        {formatIp(log.ipAddress)}
                      </p>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Client Device</p>
                      <p className="text-xs font-medium text-slate-600 truncate" title={log.userAgent}>
                        {log.userAgent || 'Web Browser'}
                      </p>
                    </div>
                  </div>

                  {/* Render Diff or Activity Body */}
                  {renderDiff(log)}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white px-5 py-3 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-medium text-slate-500">
            Page <strong className="text-slate-800">{page}</strong> of <strong className="text-slate-800">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Prev
            </button>

            {/* Quick page buttons */}
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p = i + 1;
                if (totalPages > 5 && page > 3) {
                  p = page - 2 + i;
                  if (p > totalPages) p = totalPages - 4 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => handlePageChange(p)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      page === p 
                        ? 'bg-brand-600 text-white shadow-sm' 
                        : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLog;
