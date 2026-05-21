import React, { useState, useEffect } from 'react';
import {
  Phone, Mail, Users, MapPin, MessageSquare, StickyNote,
  AlertTriangle, Bell, Plus, Loader2, CalendarDays, Send,
  Trash2, Pencil, CheckCircle2, X, UserCheck, Search, RefreshCw, Clock
} from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';

const FOLLOW_UP_TYPES = [
  { value: 'CALL',       label: 'Phone Call',    icon: Phone },
  { value: 'EMAIL',      label: 'Email',         icon: Mail },
  { value: 'MEETING',    label: 'Meeting',       icon: Users },
  { value: 'SITE_VISIT', label: 'Site Visit',    icon: MapPin },
  { value: 'WHATSAPP',   label: 'WhatsApp',      icon: MessageSquare },
  { value: 'NOTE',       label: 'Note',          icon: StickyNote },
  { value: 'ESCALATION', label: 'Escalation',    icon: AlertTriangle },
  { value: 'REMINDER',   label: 'Reminder',      icon: Bell },
];

const TYPE_COLORS = {
  CALL:       'bg-blue-100 text-blue-700 border-blue-200',
  EMAIL:      'bg-violet-100 text-violet-700 border-violet-200',
  MEETING:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  SITE_VISIT: 'bg-amber-100 text-amber-700 border-amber-200',
  WHATSAPP:   'bg-green-100 text-green-700 border-green-200',
  NOTE:       'bg-slate-100 text-slate-600 border-slate-200',
  ESCALATION: 'bg-red-100 text-red-700 border-red-200',
  REMINDER:   'bg-orange-100 text-orange-700 border-orange-200',
};

const defaultForm = {
  enquiryId: '',
  type: 'CALL',
  notes: '',
  outcome: '',
  followUpDate: new Date().toISOString().slice(0, 16),
  nextFollowUpDate: '',
};

const FollowUpBoard = () => {
  const [followUps, setFollowUps] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('ALL');
  
  // Modals state
  const [showNewModal, setShowNewModal] = useState(false);
  const [showActionModal, setShowActionModal] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState(defaultForm);
  const [actionData, setActionData] = useState({ outcome: '', nextFollowUpDate: '' });
  
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const isHighAuth = ['SA', 'SUPER_ADMIN', 'DIR', 'DIRECTOR'].includes(currentUser.role);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [fuRes, enqRes] = await Promise.all([
        api.get('/follow-ups'),
        api.get('/enquiries')
      ]);
      setFollowUps(fuRes.data.data.followUps || []);
      setEnquiries(enqRes.data.data.enquiries || []);
    } catch (err) {
      showToast('Failed to load board data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.enquiryId) return showToast('Please select an Enquiry reference', 'error');
    if (!formData.notes) return showToast('Notes are required', 'error');

    setSaving(true);
    try {
      await api.post('/follow-ups', formData);
      showToast('Follow-up reminder scheduled!');
      setShowNewModal(false);
      setFormData(defaultForm);
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create follow-up', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleActionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFollowUp) return;

    setSaving(true);
    try {
      const payload = {
        outcome: actionData.outcome || undefined,
        nextFollowUpDate: actionData.nextFollowUpDate || undefined
      };
      await api.patch(`/follow-ups/${selectedFollowUp._id}`, payload);
      showToast('Follow-up updated successfully!');
      setShowActionModal(false);
      setSelectedFollowUp(null);
      setActionData({ outcome: '', nextFollowUpDate: '' });
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Action failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to permanently delete this follow-up?')) return;
    try {
      await api.delete(`/follow-ups/${id}`);
      showToast('Follow-up deleted');
      if (showActionModal) {
        setShowActionModal(false);
        setSelectedFollowUp(null);
      }
      fetchData();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  // Helper to check if a date is today
  const isToday = (dateString) => {
    if (!dateString) return false;
    const d = new Date(dateString);
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  // Filter follow-ups
  const filteredFollowUps = followUps.filter(fu => {
    // Type check
    if (selectedType !== 'ALL' && fu.type !== selectedType) return false;
    
    // Search check
    const query = searchQuery.toLowerCase();
    const notesMatch = fu.notes?.toLowerCase().includes(query);
    const outcomeMatch = fu.outcome?.toLowerCase().includes(query);
    const enqRefMatch = fu.enquiry?.enquiryId?.toLowerCase().includes(query);
    const customerMatch = fu.enquiry?.customer?.companyName?.toLowerCase().includes(query);
    
    return notesMatch || outcomeMatch || enqRefMatch || customerMatch;
  });

  // Distribute into Columns
  const columns = {
    OVERDUE: [],
    TODAY: [],
    UPCOMING: [],
    COMPLETED: []
  };

  filteredFollowUps.forEach(fu => {
    if (fu.outcome) {
      columns.COMPLETED.push(fu);
    } else {
      const d = new Date(fu.nextFollowUpDate);
      const now = new Date();
      if (d < now && !isToday(fu.nextFollowUpDate)) {
        columns.OVERDUE.push(fu);
      } else if (isToday(fu.nextFollowUpDate)) {
        columns.TODAY.push(fu);
      } else {
        columns.UPCOMING.push(fu);
      }
    }
  });

  const renderCard = (fu) => {
    const TypeObj = FOLLOW_UP_TYPES.find(t => t.value === fu.type) || FOLLOW_UP_TYPES[5];
    const isOverdue = fu.nextFollowUpDate && new Date(fu.nextFollowUpDate) < new Date() && !fu.outcome && !isToday(fu.nextFollowUpDate);
    const isOwn = fu.addedBy?._id === currentUser.id || fu.addedBy?._id === currentUser._id;
    const canManage = isOwn || isHighAuth;

    return (
      <div
        key={fu._id}
        onClick={() => {
          if (canManage) {
            setSelectedFollowUp(fu);
            setActionData({
              outcome: fu.outcome || '',
              nextFollowUpDate: fu.nextFollowUpDate ? fu.nextFollowUpDate.slice(0, 16) : ''
            });
            setShowActionModal(true);
          }
        }}
        className={`group p-4 bg-white/70 backdrop-blur-md rounded-2xl border border-slate-200 hover:border-brand-300 hover:shadow-md transition-all cursor-pointer relative overflow-hidden`}
      >
        {/* Priority stripe indicator */}
        {fu.enquiry?.priority === 'HIGH' && (
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-red-500" />
        )}
        {fu.enquiry?.priority === 'MEDIUM' && (
          <div className="absolute top-0 left-0 bottom-0 w-1 bg-amber-500" />
        )}

        <div className="flex items-start justify-between gap-2">
          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${TYPE_COLORS[fu.type]}`}>
            {TypeObj.label}
          </span>
          <span className="text-[10px] font-bold text-slate-400">
            {fu.enquiry?.enquiryId}
          </span>
        </div>

        <p className="text-xs text-slate-900 font-bold mt-2 leading-relaxed line-clamp-2">
          {fu.notes}
        </p>

        {fu.outcome && (
          <div className="mt-2.5 p-2 bg-emerald-50 rounded-xl border border-emerald-100 flex items-start gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-emerald-800 font-medium line-clamp-2">{fu.outcome}</p>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2">
          <div className="font-semibold text-slate-500 truncate max-w-[120px]">
            {fu.enquiry?.customer?.companyName || 'No Client'}
          </div>
          
          {fu.nextFollowUpDate && !fu.outcome && (
            <div className={`flex items-center gap-1 font-bold ${
              isOverdue ? 'text-red-600' : isToday(fu.nextFollowUpDate) ? 'text-orange-600' : 'text-slate-500'
            }`}>
              <CalendarDays className="w-3 h-3" />
              {new Date(fu.nextFollowUpDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500 h-[calc(100vh-4rem)] flex flex-col">
      {/* Toast Alert */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Follow-Up Board</h1>
          <p className="text-sm text-slate-500 mt-1">Track active customer outreach tasks, record responses, and manage schedules.</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button 
            onClick={fetchData}
            className="p-2.5 text-slate-500 bg-white border border-slate-200 rounded-xl hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm"
            title="Refresh Board"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewModal(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium shadow-sm shadow-brand-500/30 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule Follow-Up
          </button>
        </div>
      </div>

      {/* Filter and Search Section */}
      <div className="bg-white/60 backdrop-blur-md border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row items-center gap-4">
        {/* Search */}
        <div className="relative w-full md:flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 transition-all"
            placeholder="Search notes, company, or enquiry ref..."
          />
        </div>

        {/* Type selector */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          <button
            onClick={() => setSelectedType('ALL')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
              selectedType === 'ALL'
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            All Types
          </button>
          {FOLLOW_UP_TYPES.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.value}
                onClick={() => setSelectedType(t.value)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold transition-all border ${
                  selectedType === t.value
                    ? TYPE_COLORS[t.value] + ' border-current'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Kanban Layout columns */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-4 overflow-hidden min-h-0">
          {/* Overdue column */}
          <div className="flex flex-col bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3 bg-red-50/80 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-bold text-red-900 tracking-wider">OVERDUE</span>
              </div>
              <span className="text-[10px] font-black bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                {columns.OVERDUE.length}
              </span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin">
              {columns.OVERDUE.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">No overdue reminders</div>
              ) : (
                columns.OVERDUE.map(renderCard)
              )}
            </div>
          </div>

          {/* Today column */}
          <div className="flex flex-col bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3 bg-orange-50/80 border-b border-orange-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-xs font-bold text-orange-900 tracking-wider">DUE TODAY</span>
              </div>
              <span className="text-[10px] font-black bg-orange-100 text-orange-800 px-2 py-0.5 rounded-full">
                {columns.TODAY.length}
              </span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin">
              {columns.TODAY.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">No follow-ups due today</div>
              ) : (
                columns.TODAY.map(renderCard)
              )}
            </div>
          </div>

          {/* Upcoming column */}
          <div className="flex flex-col bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-blue-600" />
                <span className="text-xs font-bold text-blue-900 tracking-wider">UPCOMING</span>
              </div>
              <span className="text-[10px] font-black bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                {columns.UPCOMING.length}
              </span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin">
              {columns.UPCOMING.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">No upcoming followups</div>
              ) : (
                columns.UPCOMING.map(renderCard)
              )}
            </div>
          </div>

          {/* Completed column */}
          <div className="flex flex-col bg-slate-50/50 border border-slate-200 rounded-2xl overflow-hidden">
            <div className="p-3 bg-emerald-50/80 border-b border-emerald-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-emerald-900 tracking-wider">COMPLETED</span>
              </div>
              <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                {columns.COMPLETED.length}
              </span>
            </div>
            <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin">
              {columns.COMPLETED.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs italic">No resolved records yet</div>
              ) : (
                columns.COMPLETED.map(renderCard)
              )}
            </div>
          </div>
        </div>
      )}

      {/* New FollowUp Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-base font-bold text-slate-900">Schedule New Follow-Up</h2>
              <button onClick={() => setShowNewModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit}>
              <div className="p-6 space-y-4">
                {/* Enquiry select */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Select Enquiry Reference *</label>
                  <AutocompleteSelect
                    options={enquiries.map(e => ({
                      value: e._id,
                      label: `${e.enquiryId} - ${e.customer?.companyName || 'No Company'} (${e.coreFields?.productCategory || 'N/A'})`
                    }))}
                    value={formData.enquiryId}
                    onChange={v => setFormData({ ...formData, enquiryId: v })}
                    placeholder="Search and select enquiry..."
                    required={true}
                    allowClear={false}
                  />
                </div>

                {/* Type Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Follow-up Mode</label>
                  <div className="flex flex-wrap gap-2">
                    {FOLLOW_UP_TYPES.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, type: t.value })}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                          formData.type === t.value
                            ? TYPE_COLORS[t.value] + ' border-current'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                        }`}
                      >
                        <t.icon className="w-3 h-3" />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Notes / Description *</label>
                  <textarea
                    required
                    rows={3}
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 outline-none resize-none"
                    placeholder="State the objective of this reminder..."
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Activity Date</label>
                    <input
                      type="datetime-local"
                      value={formData.followUpDate}
                      onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Next Follow-up Reminder</label>
                    <input
                      type="datetime-local"
                      value={formData.nextFollowUpDate}
                      onChange={e => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end gap-3">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-sm disabled:opacity-70 flex items-center">
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Schedule Reminder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Action/Update Modal */}
      {showActionModal && selectedFollowUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900">Manage Reminders</h2>
                <p className="text-xs text-slate-400 font-semibold mt-0.5">Enquiry Ref: {selectedFollowUp.enquiry?.enquiryId}</p>
              </div>
              <button onClick={() => { setShowActionModal(false); setSelectedFollowUp(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleActionSubmit}>
              <div className="p-6 space-y-4">
                {/* Reference Details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Scheduled task</span>
                    <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${TYPE_COLORS[selectedFollowUp.type]}`}>
                      {selectedFollowUp.type}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-slate-800">{selectedFollowUp.notes}</p>
                  <p className="text-[10px] text-slate-400 font-medium">Scheduled by: {selectedFollowUp.addedBy?.name || 'System'}</p>
                </div>

                {/* Outcome Input */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Record Outcome / Response</label>
                  <input
                    type="text"
                    value={actionData.outcome}
                    onChange={e => setActionData({ ...actionData, outcome: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 outline-none"
                    placeholder="e.g. Call completed, customer requested call back next week"
                  />
                  <span className="text-[10px] text-slate-400 font-medium mt-1 block">Adding an outcome will mark this reminder card as COMPLETED.</span>
                </div>

                {/* Reschedule Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Reschedule / Move Reminder Date</label>
                  <input
                    type="datetime-local"
                    value={actionData.nextFollowUpDate}
                    onChange={e => setActionData({ ...actionData, nextFollowUpDate: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/10 focus:border-brand-500 outline-none"
                  />
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDelete(selectedFollowUp._id)}
                  className="px-4 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors inline-flex items-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowActionModal(false); setSelectedFollowUp(null); }} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Cancel</button>
                  <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-sm disabled:opacity-70 flex items-center">
                    {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Update
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpBoard;
