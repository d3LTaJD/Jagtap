import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Search, Filter, Calendar, User, Database, 
  ChevronRight, ChevronDown, History, AlertCircle, Loader2,
  ArrowRight, Info, Eye, Trash2
} from 'lucide-react';
import api from '../api/client';

const MODULE_COLORS = {
  AUTH: 'bg-cyan-100 text-cyan-700',
  ENQUIRY: 'bg-blue-100 text-blue-700',
  QUOTATION: 'bg-emerald-100 text-emerald-700',
  QAP: 'bg-violet-100 text-violet-700',
  PRODUCT: 'bg-orange-100 text-orange-700',
  CUSTOMER: 'bg-pink-100 text-pink-700',
  USER: 'bg-slate-100 text-slate-700',
  TASK: 'bg-amber-100 text-amber-700',
  SETTINGS: 'bg-red-100 text-red-700',
  MASTER_DATA: 'bg-indigo-100 text-indigo-700',
};

const ACTION_COLORS = {
  CREATE: 'text-emerald-500',
  UPDATE: 'text-amber-500',
  DELETE: 'text-red-500',
  LOGIN: 'text-blue-500',
  LOGOUT: 'text-slate-500',
  STATUS_CHANGE: 'text-violet-500',
  ASSIGNMENT: 'text-pink-500',
  TOGGLE_USER_STATUS: 'text-orange-500',
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null);
  const [filters, setFilters] = useState({ module: '', user: '', action: '' });
  const [users, setUsers] = useState([]);
  const [selectedLogs, setSelectedLogs] = useState([]);

  useEffect(() => {
    setSelectedLogs([]);
  }, [logs]);

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
      fetchLogs();
    } catch (err) {
      console.error('Failed to delete logs:', err);
      alert('Error: Failed to delete selected audit logs');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchUsers();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.module) params.module = filters.module;
      if (filters.user) params.user = filters.user;
      if (filters.action) params.action = filters.action;

      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/admin/logs?${query}`);
      setLogs(res.data.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data.users || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleFilterChange = (e) => {
    setFilters(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  useEffect(() => {
    const timer = setTimeout(() => fetchLogs(), 300);
    return () => clearTimeout(timer);
  }, [filters]);

  // Helper: get user name from populated user_id or fallback
  const getUserName = (log) => {
    if (log.user_id && typeof log.user_id === 'object') {
      return log.user_id.name || 'Unknown';
    }
    return 'System';
  };

  // Helper: format date from the `timestamp` field
  const formatDate = (log) => {
    const d = log.timestamp;
    if (!d) return 'N/A';
    const date = new Date(d);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleString();
  };

  const renderDiff = (prev, next) => {
    if (!prev && !next) return (
      <p className="text-sm text-slate-400 italic py-4 text-center">No diff data recorded for this entry.</p>
    );
    
    // CREATE action — only show newState
    if (!prev && next) {
      return (
        <div className="space-y-2">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Created Data</p>
          <pre className="bg-slate-900 text-emerald-300 p-4 rounded-xl text-xs overflow-auto max-h-60 scrollbar-thin">
            {JSON.stringify(next, null, 2)}
          </pre>
        </div>
      );
    }

    // UPDATE — side-by-side diff
    const prevKeys = Object.keys(prev || {});
    const nextKeys = Object.keys(next || {});

    if (prevKeys.length === 0 && nextKeys.length === 0) {
      return <p className="text-sm text-slate-400 italic py-4 text-center">No fields changed.</p>;
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
            ← Previous Value
          </p>
          <div className="bg-red-50 border border-red-100 p-4 rounded-xl overflow-auto max-h-60">
             {prevKeys.length === 0 ? (
               <p className="text-xs text-red-400 italic">Empty</p>
             ) : (
               prevKeys.map(key => (
                 <div key={key} className="mb-1.5 text-xs">
                   <span className="font-bold text-red-700">{key}:</span>{' '}
                   <span className="text-red-600 font-mono">{JSON.stringify(prev[key])}</span>
                 </div>
               ))
             )}
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
            → New Value
          </p>
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl overflow-auto max-h-60">
             {nextKeys.length === 0 ? (
               <p className="text-xs text-emerald-400 italic">Empty</p>
             ) : (
               nextKeys.map(key => (
                 <div key={key} className="mb-1.5 text-xs">
                   <span className="font-bold text-emerald-700">{key}:</span>{' '}
                   <span className="text-emerald-600 font-mono">{JSON.stringify(next[key])}</span>
                 </div>
               ))
             )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <ClipboardList className="w-7 h-7" />
            </div>
            System Audit Log
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Traceable record of every system action and data change.</p>
        </div>
        
        <div className="flex gap-2">
          {selectedLogs.length > 0 && (
            <button 
              onClick={handleDeleteSelected}
              className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 hover:bg-rose-100 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
            >
              <Trash2 className="w-4 h-4 text-rose-600" />
              Delete Selected ({selectedLogs.length})
            </button>
          )}
          <button 
            onClick={fetchLogs}
            className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            title="Refresh logs"
          >
            <History className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-[2rem] shadow-sm border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            name="module" 
            value={filters.module} 
            onChange={handleFilterChange}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-brand-500/10"
          >
            <option value="">All Modules</option>
            {Object.keys(MODULE_COLORS).map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="relative">
          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            name="user" 
            value={filters.user} 
            onChange={handleFilterChange}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-brand-500/10"
          >
            <option value="">All Users</option>
            {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        </div>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <select 
            name="action" 
            value={filters.action} 
            onChange={handleFilterChange}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-brand-500/10"
          >
            <option value="">All Actions</option>
            {['CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGNMENT', 'LOGIN', 'TOGGLE_USER_STATUS'].map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Log List */}
      <div className="space-y-3">
        {loading && !logs.length ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-200 shadow-sm">
            <Info className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-lg font-bold text-slate-700">No activity logs found</p>
            <p className="text-sm text-slate-500 mt-1">Try adjusting your filters or perform some actions first.</p>
          </div>
        ) : (
          <>
            {/* Select All Checkbar */}
            <div className="flex items-center justify-between px-6 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-500 shadow-sm mb-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input 
                  type="checkbox"
                  checked={logs.length > 0 && selectedLogs.length === logs.length}
                  onChange={toggleSelectAll}
                  className="w-4.5 h-4.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                />
                <span>Select All ({logs.length} logs)</span>
              </label>
              {selectedLogs.length > 0 && (
                <span className="text-brand-600">{selectedLogs.length} selected</span>
              )}
            </div>

            {logs.map(log => (
              <div 
                key={log._id} 
                className={`bg-white rounded-[1.5rem] border transition-all duration-200 overflow-hidden ${
                  expandedLog === log._id ? 'border-slate-400 ring-4 ring-slate-100' : 'border-slate-200 hover:border-slate-300'
                } mb-3`}
              >
                <div 
                  className="px-6 py-4 flex flex-row items-center gap-4 cursor-pointer"
                  onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                >
                  {/* Checkbox */}
                  <div 
                    className="shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input 
                      type="checkbox"
                      checked={selectedLogs.includes(log._id)}
                      onChange={() => toggleSelectLog(log._id)}
                      className="w-4.5 h-4.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
                    />
                  </div>

                  <div className="flex-1 flex flex-col md:flex-row md:items-center gap-4 min-w-0">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className={`p-2.5 rounded-xl bg-slate-50 shrink-0 ${ACTION_COLORS[log.action] || 'text-slate-400'}`}>
                        <History className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md shrink-0 ${MODULE_COLORS[log.module] || 'bg-slate-100 text-slate-600'}`}>
                            {log.module}
                          </span>
                          <span className="text-sm font-black text-slate-900">{log.action?.replace(/_/g, ' ')}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                          {log.details || `Modified ${log.resourceName || 'Resource'}`}
                        </p>
                      </div>
                    </div>

                <div className="flex items-center gap-6 text-xs font-bold text-slate-400 shrink-0">
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    <span className="text-slate-700">{getUserName(log)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDate(log)}</span>
                  </div>
                  <div className="p-1 text-slate-300">
                    {expandedLog === log._id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>
              </div>
              </div>

              {/* Expansion content */}
              {expandedLog === log._id && (
                <div className="px-6 pb-6 pt-2 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-2">
                   <div className="mb-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Resource</p>
                        <p className="text-xs font-mono text-slate-700 truncate">{log.resourceName || log.related_id || 'N/A'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">IP Address</p>
                        <p className="text-xs font-mono text-slate-700">{log.ipAddress || 'Not recorded'}</p>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase mb-1">User Agent</p>
                        <p className="text-xs font-medium text-slate-500 truncate" title={log.userAgent}>{log.userAgent || 'Not recorded'}</p>
                      </div>
                   </div>

                   {/* Data Diff */}
                   {renderDiff(log.previousState, log.newState)}
                </div>
              )}
            </div>
          ))}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditLog;
