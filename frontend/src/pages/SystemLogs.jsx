import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, Search, Filter, Calendar, User, Database, 
  ChevronRight, ChevronDown, History, AlertCircle, Loader2,
  Info, Eye, Sparkles, Activity, ShieldAlert
} from 'lucide-react';
import api from '../api/client';

const EVENT_TYPE_COLORS = {
  INGESTION: 'bg-blue-100 text-blue-700 border-blue-200',
  OCR: 'bg-purple-100 text-purple-700 border-purple-200',
  AI_EXTRACTION: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  QUEUE_EXECUTION: 'bg-amber-100 text-amber-700 border-amber-200',
  STATUS_TRANSITION: 'bg-violet-100 text-violet-700 border-violet-200',
  VERIFICATION: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FILE_UPLOAD: 'bg-slate-100 text-slate-700 border-slate-200',
  QUOTATION_GENERATION: 'bg-rose-100 text-rose-700 border-rose-200',
  SYSTEM: 'bg-indigo-100 text-indigo-700 border-indigo-200'
};

const SystemLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null);
  
  // Health & DLQ state
  const [health, setHealth] = useState(null);
  const [failedJobs, setFailedJobs] = useState([]);
  const [fetchingHealth, setFetchingHealth] = useState(true);
  const [fetchingFailed, setFetchingFailed] = useState(true);
  const [retryingJobId, setRetryingJobId] = useState(null);

  // Filters
  const [eventType, setEventType] = useState('');
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (eventType) params.append('eventType', eventType);
      if (entityType) params.append('entityType', entityType);
      params.append('page', page);
      params.append('limit', 20);

      const res = await api.get(`/admin/system-logs?${params.toString()}`);
      if (res.data?.data) {
        setLogs(res.data.data.logs || []);
        setTotalPages(res.data.data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to fetch system logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueHealth = async () => {
    setFetchingHealth(true);
    try {
      const res = await api.get('/admin/queue-health');
      if (res.data?.data) {
        setHealth(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch queue health:', err);
    } finally {
      setFetchingHealth(false);
    }
  };

  const fetchFailedJobs = async () => {
    setFetchingFailed(true);
    try {
      const res = await api.get('/admin/queue-jobs?status=Failed');
      if (res.data?.data) {
        setFailedJobs(res.data.data.jobs || []);
      }
    } catch (err) {
      console.error('Failed to fetch failed jobs:', err);
    } finally {
      setFetchingFailed(false);
    }
  };

  const handleRetryJob = async (jobId) => {
    setRetryingJobId(jobId);
    try {
      await api.post(`/admin/queue-jobs/${jobId}/retry`);
      // Refresh data
      fetchFailedJobs();
      fetchQueueHealth();
      fetchLogs();
    } catch (err) {
      console.error('Failed to retry job:', err);
      alert('Error: Failed to queue job for retry');
    } finally {
      setRetryingJobId(null);
    }
  };

  const triggerAllFetches = () => {
    setPage(1);
    fetchLogs();
    fetchQueueHealth();
    fetchFailedJobs();
  };

  useEffect(() => {
    fetchLogs();
  }, [eventType, entityType, page]);

  useEffect(() => {
    fetchQueueHealth();
    fetchFailedJobs();
  }, []);

  const formatDate = (log) => {
    const d = log.timestamp || log.createdAt;
    if (!d) return 'N/A';
    return new Date(d).toLocaleString('en-IN');
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500 text-slate-900">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
              <ClipboardList className="w-7 h-7" />
            </div>
            Infrastructure System Logs
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Observability and tracking of background queues, OCR parser, and AI extractions.</p>
        </div>
        
        <button 
          onClick={triggerAllFetches}
          className="p-2.5 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 font-bold text-sm"
        >
          <History className={`w-4 h-4 ${loading || fetchingHealth || fetchingFailed ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Queue Health Dashboard section */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Queue Depth</span>
          <span className="text-2xl font-black text-slate-950 mt-2">
            {fetchingHealth ? '...' : (health?.queueDepth ?? 0)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">OCR Backlog</span>
          <span className="text-2xl font-black text-slate-950 mt-2">
            {fetchingHealth ? '...' : (health?.ocrBacklog ?? 0)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">AI Backlog</span>
          <span className="text-2xl font-black text-slate-950 mt-2">
            {fetchingHealth ? '...' : (health?.aiBacklog ?? 0)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-rose-200 bg-rose-50/10 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-500">Failed Jobs</span>
          <span className="text-2xl font-black text-rose-600 mt-2">
            {fetchingHealth ? '...' : (health?.failedJobs ?? 0)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Retries</span>
          <span className="text-2xl font-black text-slate-950 mt-2">
            {fetchingHealth ? '...' : (health?.retryCount ?? 0)}
          </span>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Avg Processing</span>
          <span className="text-2xl font-black text-slate-950 mt-2">
            {fetchingHealth ? '...' : health?.averageProcessingTime ? `${(health.averageProcessingTime / 1000).toFixed(1)}s` : '0s'}
          </span>
        </div>
      </div>

      {/* Dead Letter Queue (Failed Jobs) */}
      <div className="mb-8 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
          Dead Letter Queue (Failed Jobs)
        </h2>
        
        {fetchingFailed ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-6 h-6 animate-spin text-rose-500" />
          </div>
        ) : failedJobs.length === 0 ? (
          <div className="p-4 text-center bg-slate-50 rounded-2xl border border-slate-100">
            <p className="text-sm font-semibold text-slate-500">No failed background jobs currently in the DLQ.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {failedJobs.map(job => (
              <div 
                key={job._id} 
                className="bg-rose-50/10 border border-rose-100 rounded-2xl p-5 shadow-inner flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-black rounded uppercase tracking-wider">
                      {job.queueName}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">Job ID: {job._id}</span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 mt-2.5 break-all max-h-16 overflow-y-auto">
                    Payload: <span className="font-mono text-xs font-normal text-slate-600">{JSON.stringify(job.payload || job.data)}</span>
                  </p>
                  <p className="text-xs font-semibold text-rose-600 mt-1.5 flex items-start gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="break-words">
                      Error: {job.lastError || (job.errorLogs?.[job.errorLogs.length - 1]?.message) || 'Unknown permanent failure'}
                    </span>
                  </p>
                </div>
                <button
                  disabled={retryingJobId === job._id}
                  onClick={() => handleRetryJob(job._id)}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black shadow-sm transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                >
                  {retryingJobId === job._id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <History className="w-3.5 h-3.5" />
                  )}
                  Retry Job
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Audit Logs Filters */}
      <div className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter Event Type</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              value={eventType} 
              onChange={(e) => { setEventType(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-brand-500/10"
            >
              <option value="">All Event Types</option>
              {Object.keys(EVENT_TYPE_COLORS).map(type => (
                <option key={type} value={type}>{type.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Filter Target Component</label>
          <div className="relative">
            <Database className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <select 
              value={entityType} 
              onChange={(e) => { setEntityType(e.target.value); setPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold appearance-none outline-none focus:ring-4 focus:ring-brand-500/10"
            >
              <option value="">All Target Entities</option>
              {['EmailMessage', 'Attachment', 'Enquiry', 'Quotation', 'QueueJob'].map(entity => (
                <option key={entity} value={entity}>{entity}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
          <Activity className="w-5 h-5 text-slate-500" />
          System Audit Logs Trace
        </h2>

        {loading && !logs.length ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-brand-600" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <Info className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-lg font-bold text-slate-700">No system audit logs found</p>
            <p className="text-sm text-slate-500 mt-1">Try relaxing your filters or run some background parsing tasks.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map(log => (
              <div 
                key={log._id} 
                className={`bg-white rounded-2xl border transition-all duration-200 overflow-hidden ${
                  expandedLog === log._id ? 'border-brand-500 ring-4 ring-brand-500/10' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Log Summary Row */}
                <div 
                  onClick={() => setExpandedLog(expandedLog === log._id ? null : log._id)}
                  className="px-6 py-4.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shrink-0 ${EVENT_TYPE_COLORS[log.eventType] || 'bg-slate-100 text-slate-600'}`}>
                      {log.eventType?.replace(/_/g, ' ')}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {log.action}
                      </p>
                      <p className="text-xs text-slate-400 mt-1 font-semibold flex items-center gap-1.5">
                        <span>Component: <strong className="text-slate-600">{log.entityType}</strong></span>
                        <span>•</span>
                        <span>ID: <strong className="text-slate-500 font-mono">{log.entityId}</strong></span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-xs text-slate-400 shrink-0 self-start lg:self-center font-bold">
                    {log.performedBy && (
                      <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                        <User className="w-3.5 h-3.5" />
                        <span>{log.performedBy.name || log.performedBy.fullName}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 font-bold">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{formatDate(log)}</span>
                    </div>
                    <div>
                      {expandedLog === log._id ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                </div>

                {/* Log Detailed JSON Inspector */}
                {expandedLog === log._id && (
                  <div className="px-6 pb-6 pt-3 bg-slate-50 border-t border-slate-100 animate-in slide-in-from-top-1">
                    <div className="mb-4 flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                        Execution Metadata JSON
                      </span>
                    </div>
                    <pre className="bg-slate-950 text-brand-400 p-4 rounded-xl text-xs overflow-auto max-h-80 font-mono scrollbar-thin shadow-inner leading-relaxed">
                      {JSON.stringify(log.metadata || {}, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ))}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(page - 1)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm font-bold text-slate-500 px-4">
                  Page {page} of {totalPages}
                </span>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold disabled:opacity-50 hover:bg-slate-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SystemLogs;
