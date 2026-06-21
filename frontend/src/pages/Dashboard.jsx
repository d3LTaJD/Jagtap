import React, { useState, useEffect } from 'react';
import { Users, FileText, CheckSquare, TrendingUp, IndianRupee, Loader2, Activity, ClipboardList, AlertCircle, RefreshCw, Download, BarChart3, Trophy, TrendingDown, Sparkles, MoreVertical, Phone, Mail, MessageSquare, X, Save, CheckCircle2 } from 'lucide-react';
import { BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend, CartesianGrid } from 'recharts';
import api from '../api/client';

const StatCard = ({ title, value, icon: Icon, trend, colorClass = "brand", loading = false }) => {
  const styles = {
    brand: 'from-indigo-500 to-indigo-600',
    teal: 'from-teal-400 to-teal-500',
    purple: 'from-purple-400 to-purple-500',
    orange: 'from-orange-400 to-orange-500',
  };

  const iconBgStyles = {
    brand: 'bg-indigo-50 text-indigo-500',
    teal: 'bg-teal-50 text-teal-500',
    purple: 'bg-purple-50 text-purple-500',
    orange: 'bg-orange-50 text-orange-500',
  };

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-between relative overflow-hidden group">
      {/* Thick left border */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${styles[colorClass]}`} />

      <div className="flex items-start justify-between mb-2 relative z-10 pl-2">
        <div>
          <h3 className="text-[13px] font-medium text-slate-500 mb-2">{title}</h3>
          {loading ? (
            <div className="h-8 w-24 bg-slate-100 animate-pulse rounded" />
          ) : (
            <p className="text-3xl font-bold text-slate-800 tracking-tight">{value}</p>
          )}
        </div>
        <div className={`p-2.5 rounded-2xl ${iconBgStyles[colorClass]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="pl-2 mt-4">
        {trend && !loading && (
          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-emerald-500">+{trend}%</span>
            <span className="text-slate-400 font-medium">vs last month</span>
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [stats, setStats] = useState({
    activeEnquiries: 0,
    quotationsSent: 0,
    pipelineValue: 0,
    pendingQaps: 0,
    wonCount: 0,
    lostCount: 0,
    wonValue: 0,
    conversionRate: 0,
    byCategory: [],
    timeSeriesData: [],
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [myTasks, setMyTasks] = useState({ enquiries: [], followUps: [], approvals: [] });
  const [pipeline, setPipeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  // mock data removed, using real data from backend
  const canSeeFinancials = ['SA', 'SUPER_ADMIN', 'DIR', 'DIRECTOR', 'ACC', 'ACCOUNTS'].includes(currentUser.role);

  const [showFollowUpModal, setShowFollowUpModal] = useState(false);
  const [selectedEnquiry, setSelectedEnquiry] = useState(null);
  const [followUpData, setFollowUpData] = useState({
    type: 'CALL',
    notes: '',
    outcome: 'Neutral — Still Evaluating',
    nextFollowUpDate: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/stats');
      const s = res.data.data.stats;
      setStats({
        activeEnquiries: s.activeEnquiries ?? 0,
        activeClients: s.activeClients ?? 0,
        quotationsSent: (s.pendingQuotations || 0) + (s.wonQuotations || 0),
        pipelineValue: s.pipelineValue ?? 0,
        pendingQaps: s.pendingQaps ?? 0,
        wonCount: s.wonCount || 0,
        lostCount: s.lostCount || 0,
        wonValue: s.wonValue || 0,
        conversionRate: s.conversionRate || 0,
        byCategory: s.byCategory || [],
        timeSeriesData: s.timeSeriesData || [],
      });
      if (res.data.data.recentActivity) setRecentActivity(res.data.data.recentActivity);
      if (res.data.data.myTasks) setMyTasks(res.data.data.myTasks);

      // Build pipeline funnel from stage counts (keys must match Enquiry schema)
      const stages = [
        { label: 'New Leads', color: 'bg-blue-500', count: s.byStatus?.['New'] || 0 },
        { label: 'Confirmed', color: 'bg-violet-500', count: (s.byStatus?.['Confirmed'] || 0) + (s.byStatus?.['Contacted'] || 0) + (s.byStatus?.['Verified'] || 0) + (s.byStatus?.['Ready for Offer'] || 0) },
        { label: 'Tech Review', color: 'bg-cyan-500', count: s.byStatus?.['Technical Review'] || 0 },
        { label: 'Quotation Sent', color: 'bg-amber-500', count: s.byStatus?.['Quoted'] || s.pendingQuotations || 0 },
        { label: 'Negotiating', color: 'bg-orange-500', count: s.byStatus?.['Negotiating'] || 0 },
        { label: 'Won', color: 'bg-emerald-500', count: s.byStatus?.['Won'] || 0 },
        { label: 'On Hold', color: 'bg-orange-300', count: s.byStatus?.['On Hold'] || 0 },
        { label: 'Lost', color: 'bg-red-400', count: s.byStatus?.['Lost'] || 0 },
      ];
      setPipeline(stages);
    } catch (err) {
      console.error('Failed to load dashboard stats', err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPostpone = async (enquiryId, days) => {
    try {
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + days);

      await api.post('/follow-ups', {
        enquiryId,
        type: 'NOTE',
        notes: `Quick reschedule follow-up by ${days} days from home screen.`,
        outcome: 'Neutral — Still Evaluating',
        nextFollowUpDate: nextDate.toISOString().split('T')[0]
      });

      fetchStats();
    } catch (err) {
      console.error('Failed to postpone follow-up', err);
    }
  };

  const handleLogFollowUpSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!selectedEnquiry || !followUpData.notes) return;

    setSubmitting(true);
    try {
      await api.post('/follow-ups', {
        enquiryId: selectedEnquiry._id,
        type: followUpData.type,
        notes: followUpData.notes,
        outcome: followUpData.outcome,
        nextFollowUpDate: followUpData.nextFollowUpDate || undefined
      });

      setShowFollowUpModal(false);
      setSelectedEnquiry(null);
      setFollowUpData({
        type: 'CALL',
        notes: '',
        outcome: 'Neutral — Still Evaluating',
        nextFollowUpDate: ''
      });
      fetchStats();
    } catch (err) {
      console.error('Failed to save follow-up log', err);
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 60000); // Auto-refresh every 60s
    return () => clearInterval(interval);
  }, []);

  const formatCurrency = (amount) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(1)}Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
    return `₹${amount.toLocaleString('en-IN')}`;
  };

  // Export full report
  const exportReport = () => {
    const headers = ['Stage', 'Count'];
    const rows = pipeline.map(p => [p.label, p.count]);
    rows.push(['', ''], ['Stat', 'Value'],
      ['Active Enquiries', stats.activeEnquiries],
      ['Quotations Sent', stats.quotationsSent],
      ['Pipeline Value', stats.pipelineValue],
      ['Won Count', stats.wonCount],
      ['Lost Count', stats.lostCount],
    );
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dashboard_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-medium text-slate-800 tracking-tight">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, <span className="font-bold text-brand-700">{currentUser.fullName?.split(' ')[0] || 'User'}!</span> <span className="text-2xl">👋</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-2">
            <Sparkles className="w-4 h-4 text-brand-500" />
            <p className="text-[13px] text-slate-500 font-medium">
              <span className="font-bold text-slate-700">AI Insight:</span> You have <span className="text-brand-600 font-bold">{stats.activeEnquiries}</span> hot leads ready for follow-up today
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setLoading(true); window.location.reload(); }}
            className="p-2.5 text-slate-500 bg-white border border-slate-200 rounded-xl hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"
            title="Refresh Dashboard"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={exportReport} className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold shadow-sm shadow-brand-500/30 transition-all">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        <StatCard loading={loading} title="Total Leads" value={stats.activeEnquiries ?? 0} icon={Users} trend="12.5" colorClass="brand" />
        <StatCard loading={loading} title="Active Clients" value={stats.activeClients ?? 0} icon={Users} trend="8.2" colorClass="teal" />
        <StatCard loading={loading} title="Deals in Pipeline" value={stats.pendingQaps ?? 0} icon={Activity} trend="15.3" colorClass="purple" />
        <StatCard loading={loading} title="Total Revenue" value={formatCurrency(stats.pipelineValue ?? 0)} icon={IndianRupee} trend="18.7" colorClass="orange" />
      </div>

      {/* ── KPI Visualizations ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Lead Pipeline Funnel */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-500" /> Lead Pipeline
            </h2>

          </div>

          {loading ? (
            <div className="flex justify-center items-center flex-1 py-10"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
          ) : (
            <div className="flex-1 w-full h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pipeline} layout="vertical" margin={{ top: 5, right: 40, left: 5, bottom: 5 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    width={110}
                    tick={{ fontSize: 12, fontWeight: 600, fill: '#475569' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: '#f1f5f9', radius: 6 }}
                    contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                    formatter={(value) => [value, 'Count']}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28} label={{ position: 'right', fontSize: 13, fontWeight: 700, fill: '#334155' }}>
                    {pipeline.map((entry, index) => {
                      const barColors = ['#6366f1', '#3b82f6', '#06b6d4', '#14b8a6', '#10b981', '#f59e0b', '#f97316', '#ef4444'];
                      return <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />;
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Leads Over Time Chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-500" /> Leads Over Time
            </h2>
            <select className="text-xs border-slate-200 rounded-lg text-slate-600 focus:ring-brand-500 focus:border-brand-500 py-1.5 pl-3 pr-8">
              <option>This Month</option>
              <option>Last Month</option>
              <option>This Year</option>
            </select>
          </div>

          <div style={{ width: '100%', height: 280 }}>
            {stats.timeSeriesData && stats.timeSeriesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={stats.timeSeriesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dx={-10} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    itemStyle={{ color: '#8b5cf6', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="leads" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorLeads)" activeDot={{ r: 6, strokeWidth: 0, fill: '#8b5cf6' }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-sm font-medium">No lead data available for the last 30 days</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Financial Metrics (SA/DIR/ACC only) ── */}
      {canSeeFinancials && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-emerald-700 uppercase tracking-wider">Won This Month</span>
            </div>
            <p className="text-3xl font-black text-emerald-700">{stats.wonCount}</p>
            <p className="text-sm text-emerald-600 mt-1">{formatCurrency(stats.wonValue)} total value</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-500" />
              <span className="text-xs font-black text-red-600 uppercase tracking-wider">Lost This Month</span>
            </div>
            <p className="text-3xl font-black text-red-600">{stats.lostCount}</p>
            <p className="text-sm text-red-500 mt-1">Opportunities not converted</p>
          </div>
          <div className="bg-brand-50 border border-brand-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <span className="text-xs font-black text-brand-700 uppercase tracking-wider">Win Rate</span>
            </div>
            <p className="text-3xl font-black text-brand-700">{stats.conversionRate ? `${stats.conversionRate}%` : (stats.wonCount + stats.lostCount > 0 ? Math.round((stats.wonCount / (stats.wonCount + stats.lostCount)) * 100) + '%' : '—')}</p>
            <p className="text-sm text-brand-600 mt-1">Won / (Won + Lost)</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* My Tasks Widget */}
        <div className="lg:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h2 className="text-lg font-bold text-slate-900 mb-6 tracking-tight flex items-center">
            <ClipboardList className="w-5 h-5 mr-2 text-brand-600" /> My Tasks
          </h2>
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
          ) : (
            <div className="space-y-6">

              {/* Due Follow-ups */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
                  <span>📅 Daily Follow-Up Queue</span>
                  {myTasks.followUps.length > 0 && (
                    <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-black">
                      {myTasks.followUps.length} Action Needed
                    </span>
                  )}
                </h3>
                {myTasks.followUps.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    <CheckCircle2 className="w-6 h-6 text-emerald-550 mx-auto mb-1.5" />
                    <p className="text-xs font-black text-slate-700">All caught up!</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">No enquiries due for follow-up today.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
                    {myTasks.followUps.map(f => {
                      const isOverdue = new Date(f.nextFollowUpDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0);
                      return (
                        <div 
                          key={f._id} 
                          className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                            isOverdue 
                              ? 'bg-rose-50/60 border-rose-100/80 hover:border-rose-200' 
                              : 'bg-indigo-50/40 border-indigo-100/60 hover:border-indigo-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  f.enquiry?.priority === 'Urgent' 
                                    ? 'bg-red-105 bg-red-100 text-red-700' 
                                    : f.enquiry?.priority === 'High' 
                                      ? 'bg-orange-100 text-orange-700' 
                                      : 'bg-slate-100 text-slate-600'
                                }`}>
                                  {f.enquiry?.priority || 'Medium'}
                                </span>
                                <span className="text-xs font-black text-slate-900">{f.enquiry?.enquiryId}</span>
                              </div>
                              <p className="text-xs text-slate-700 font-bold mt-1.5 truncate max-w-[200px]">
                                {f.enquiry?.customer?.companyName || 'Unknown Customer'}
                              </p>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5 truncate">
                                {f.enquiry?.productCategory || 'Unknown Product'}
                              </p>
                            </div>
                            <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl shrink-0 ${
                              isOverdue ? 'bg-rose-105 bg-rose-100 text-rose-700' : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {isOverdue ? 'Overdue' : 'Due Today'}
                            </span>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                setSelectedEnquiry(f.enquiry);
                                setShowFollowUpModal(true);
                              }}
                              className="flex-1 py-1.5 bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700 text-[11px] font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-1"
                            >
                              <Phone className="w-3.5 h-3.5 text-slate-400" /> Log
                            </button>
                            <button
                              onClick={() => handleQuickPostpone(f.enquiry?._id, 2)}
                              className="py-1.5 px-2 bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-500 hover:text-slate-700 text-[11px] font-black rounded-xl transition-all shadow-sm flex items-center justify-center gap-0.5"
                              title="Reschedule +2 Days"
                            >
                              <Calendar className="w-3.5 h-3.5 text-slate-400" /> +2d
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pending Approvals */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Pending Approvals</h3>
                {myTasks.approvals.length === 0 ? (
                  <p className="text-sm text-slate-500">No pending approvals</p>
                ) : (
                  <div className="space-y-2">
                    {myTasks.approvals.map(a => (
                      <div key={a._id} className="p-3 bg-amber-50 border border-amber-100 rounded-xl">
                        <p className="text-sm font-bold text-amber-900">{a.type}: {a.id}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assigned Enquiries */}
              <div>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Action Required Leads</h3>
                {myTasks.enquiries.length === 0 ? (
                  <p className="text-sm text-slate-500">Inbox Zero!</p>
                ) : (
                  <div className="space-y-2">
                    {myTasks.enquiries.map(e => (
                      <div key={e._id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                        <p className="text-sm font-bold text-slate-900">{e.enquiryId}</p>
                        <p className="text-xs text-slate-500 truncate">{e.customer?.companyName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>

        {/* Activity Timeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 lg:p-8">
          <h2 className="text-lg font-bold text-slate-900 mb-6 tracking-tight flex items-center">
            <Activity className="w-5 h-5 mr-2 text-brand-600" /> Recent Follow-Ups
          </h2>

          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
          ) : recentActivity.length === 0 ? (
            <div className="text-center py-12 text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-200 font-medium">No recent activities recorded</div>
          ) : (
            <div className="relative border-l border-slate-200 ml-3 space-y-8 pb-4">
              {recentActivity.map((act, idx) => (
                <div key={idx} className="relative pl-6 sm:pl-8">
                  <span className="absolute -left-3 top-2 w-6 h-6 rounded-full bg-brand-50 border-2 border-brand-200 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-brand-500"></div>
                  </span>
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1 mb-1">
                    <p className="text-sm font-bold text-slate-900">{act.addedBy?.name || 'AI Bot'} <span className="text-slate-500 font-normal">logged a {act.type?.toLowerCase().replace('_', ' ')} on</span> {act.enquiry?.enquiryId ? <span className="text-brand-600">{act.enquiry.enquiryId}</span> : <span className="text-slate-400 italic text-xs">Enquiry</span>}</p>
                    <span className="text-xs text-slate-400">{new Date(act.createdAt).toLocaleDateString('en-GB')}</span>
                  </div>
                  <p className="text-sm text-slate-600 leading-relaxed mb-2 bg-slate-50/50 p-3 rounded-xl border border-slate-100 italic">
                    &ldquo;{(act.notes || '').length > 150 ? (act.notes).slice(0, 150) + '…' : act.notes}&rdquo;
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {act.outcome && <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">{act.outcome}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Follow-Up Modal */}
      {showFollowUpModal && selectedEnquiry && (
        <div className="fixed inset-0 bg-slate-900/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h3 className="text-lg font-black text-slate-900">Log Follow-Up</h3>
                <p className="text-xs text-slate-500 font-medium">Enquiry: <span className="font-bold text-brand-600">{selectedEnquiry.enquiryId}</span></p>
              </div>
              <button 
                onClick={() => { setShowFollowUpModal(false); setSelectedEnquiry(null); }}
                className="p-1.5 text-slate-400 hover:text-slate-600 bg-white border border-slate-200 rounded-xl transition-all shadow-sm"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleLogFollowUpSubmit} className="p-6 space-y-5">
              {/* Method (Type) selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Contact Method</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'CALL', label: 'Call', icon: Phone, colorClass: 'text-blue-600 bg-blue-50 border-blue-200' },
                    { id: 'WHATSAPP', label: 'WhatsApp', icon: MessageSquare, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
                    { id: 'EMAIL', label: 'Email', icon: Mail, colorClass: 'text-amber-600 bg-amber-50 border-amber-200' },
                    { id: 'MEETING', label: 'Meeting', icon: Users, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setFollowUpData({ ...followUpData, type: m.id })}
                      className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all ${
                        followUpData.type === m.id 
                          ? `${m.colorClass} border-2 scale-95 shadow-inner` 
                          : 'border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-600'
                      }`}
                    >
                      <m.icon className="w-5 h-5 mb-1 shrink-0" />
                      <span className="text-[11px] font-black">{m.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Response / Outcome selection */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Response / Outcome</label>
                <select
                  value={followUpData.outcome}
                  onChange={e => setFollowUpData({ ...followUpData, outcome: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none"
                >
                  <option value="Neutral — Still Evaluating">Evaluating / No Decision</option>
                  <option value="Positive — Interested">Interested (Hot)</option>
                  <option value="Positive — Sending TS">Sending Technical Specs</option>
                  <option value="Request for Revision">Revision Requested</option>
                  <option value="Price Negotiation">Price Negotiation</option>
                  <option value="Negative — Not Interested">Not Interested</option>
                  <option value="No Response">No Response</option>
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Summary / Notes</label>
                <textarea
                  required
                  rows={3}
                  value={followUpData.notes}
                  onChange={e => setFollowUpData({ ...followUpData, notes: e.target.value })}
                  placeholder="What was discussed?"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none resize-none"
                />
              </div>

              {/* Reschedule Date */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Next Follow-Up Date</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    min={new Date().toISOString().split('T')[0]}
                    value={followUpData.nextFollowUpDate}
                    onChange={e => setFollowUpData({ ...followUpData, nextFollowUpDate: e.target.value })}
                    className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 3);
                      setFollowUpData({ ...followUpData, nextFollowUpDate: d.toISOString().split('T')[0] });
                    }}
                    className="px-4 py-3 bg-white border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-600 text-xs font-black text-slate-600 transition-all active:scale-95 shadow-sm"
                  >
                    +3 Days
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 font-medium ml-1">Leave blank to let the system auto-schedule a D+3 follow-up.</p>
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setShowFollowUpModal(false); setSelectedEnquiry(null); }}
                  className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-black rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 text-white text-sm font-black rounded-2xl shadow-lg shadow-brand-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  <span>Save Log</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
