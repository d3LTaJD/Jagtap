import React, { useState, useEffect } from 'react';
import {
  Phone, Mail, Users, MapPin, MessageSquare, StickyNote,
  AlertTriangle, Bell, Plus, Loader2, ChevronDown, ChevronRight,
  CalendarDays, Send, Trash2, Pencil, CheckCircle2, X, UserCheck
} from 'lucide-react';
import api from '../api/client';

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
  CALL:       'bg-blue-100 text-blue-700',
  EMAIL:      'bg-violet-100 text-violet-700',
  MEETING:    'bg-emerald-100 text-emerald-700',
  SITE_VISIT: 'bg-amber-100 text-amber-700',
  WHATSAPP:   'bg-green-100 text-green-700',
  NOTE:       'bg-slate-100 text-slate-600',
  ESCALATION: 'bg-red-100 text-red-700',
  REMINDER:   'bg-orange-100 text-orange-700',
};

const defaultForm = {
  type: 'CALL',
  notes: '',
  outcome: '',
  followUpDate: new Date().toISOString().slice(0, 16),
  nextFollowUpDate: '',
};

const FollowUpPanel = ({ enquiryId, currentUserRole }) => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState(null);

  const isHighAuth = ['SA', 'SUPER_ADMIN', 'DIR', 'DIRECTOR'].includes(currentUserRole);
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/follow-ups?enquiryId=${enquiryId}`);
      setEntries(res.data.data.followUps);
    } catch (err) {
      showToast('Failed to load follow-ups', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (enquiryId) fetchEntries(); }, [enquiryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.nextFollowUpDate && new Date(form.nextFollowUpDate) < new Date(form.followUpDate)) {
      showToast('Next follow-up reminder cannot be before the follow-up date', 'error');
      return;
    }
    if (form.nextFollowUpDate && new Date(form.nextFollowUpDate) < new Date(Date.now() - 60000)) {
      showToast('Next follow-up reminder date cannot be in the past', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, enquiryId };
      if (editingId) {
        await api.patch(`/follow-ups/${editingId}`, payload);
        showToast('Follow-up updated!');
        setEditingId(null);
      } else {
        await api.post('/follow-ups', payload);
        showToast('Follow-up added!');
      }
      setForm(defaultForm);
      setShowForm(false);
      fetchEntries();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (entry) => {
    setForm({
      type: entry.type,
      notes: entry.notes,
      outcome: entry.outcome || '',
      followUpDate: entry.followUpDate ? entry.followUpDate.slice(0, 16) : new Date().toISOString().slice(0, 16),
      nextFollowUpDate: entry.nextFollowUpDate ? entry.nextFollowUpDate.slice(0, 16) : '',
    });
    setEditingId(entry._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this follow-up entry?')) return;
    try {
      await api.delete(`/follow-ups/${id}`);
      showToast('Deleted');
      fetchEntries();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  const cancelForm = () => {
    setForm(defaultForm);
    setEditingId(null);
    setShowForm(false);
  };

  // Find next upcoming follow-up
  const upcoming = entries.find(e => e.nextFollowUpDate && new Date(e.nextFollowUpDate) > new Date());
  const nextDueDate = upcoming ? new Date(upcoming.nextFollowUpDate) : null;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-base font-bold text-slate-800">Follow-up Log</h3>
          {nextDueDate && (
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
              nextDueDate < new Date() 
                ? 'bg-red-100 text-red-700' 
                : (nextDueDate - new Date()) < 86400000 * 2
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-emerald-100 text-emerald-700'
            }`}>
              <CalendarDays className="w-3 h-3" />
              {nextDueDate < new Date() ? 'Overdue: ' : 'Next: '}
              {nextDueDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
        <button
          onClick={() => { setShowForm(!showForm); if (editingId) cancelForm(); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Entry
        </button>
      </div>

      {/* Add / Edit Form */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
            {editingId ? 'Edit Entry' : 'New Follow-up Entry'}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type Row */}
            <div className="flex flex-wrap gap-2">
              {FOLLOW_UP_TYPES.map(t => (
                <button
                  key={t.value} type="button"
                  onClick={() => setForm(f => ({ ...f, type: t.value }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                    form.type === t.value
                      ? TYPE_COLORS[t.value] + ' border-current'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-400'
                  }`}
                >
                  <t.icon className="w-3 h-3" /> {t.label}
                </button>
              ))}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Notes / Summary *</label>
              <textarea
                required value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="What happened? What was discussed?"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none resize-none"
              />
            </div>

            {/* Outcome */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Outcome / Result</label>
              <input
                type="text" value={form.outcome}
                onChange={e => setForm(f => ({ ...f, outcome: e.target.value }))}
                placeholder="e.g. Customer interested, will send drawing"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Follow-up Date</label>
                <input
                  type="datetime-local" value={form.followUpDate}
                  onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Next Follow-up Reminder
                </label>
                <input
                  type="datetime-local" value={form.nextFollowUpDate}
                  onChange={e => setForm(f => ({ ...f, nextFollowUpDate: e.target.value }))}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button type="button" onClick={cancelForm} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-all">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {editingId ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Follow-up Log */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
        </div>
      ) : entries.length === 0 ? (
        <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No follow-ups recorded yet.</p>
          <p className="text-xs mt-1">Add the first entry to start tracking communication.</p>
        </div>
      ) : (
        <div className="relative space-y-0">
          {/* Timeline line */}
          <div className="absolute left-5 top-6 bottom-6 w-px bg-slate-200" />
          
          {entries.map((entry, idx) => {
            const TypeObj = FOLLOW_UP_TYPES.find(t => t.value === entry.type) || FOLLOW_UP_TYPES[5];
            const isOwn = entry.addedBy?._id === currentUser.id || entry.addedBy?._id === currentUser._id;
            const canEdit = isOwn || isHighAuth;
            const isOverdue = entry.nextFollowUpDate && new Date(entry.nextFollowUpDate) < new Date();

            return (
              <div key={entry._id} className="flex gap-4 relative pb-5">
                {/* Icon */}
                <div className={`relative z-10 mt-0.5 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${TYPE_COLORS[entry.type]}`}>
                  <TypeObj.icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className="flex-1 bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-sm transition-shadow">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${TYPE_COLORS[entry.type]}`}>
                        {TypeObj.label}
                      </span>
                      {entry.isEscalation && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">ESCALATED</span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canEdit && (
                        <>
                          <button onClick={() => handleEdit(entry)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(entry._id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-sm text-slate-800 font-medium mt-2 leading-relaxed">{entry.notes}</p>

                  {entry.outcome && (
                    <div className="mt-2 flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-emerald-700 font-medium">{entry.outcome}</p>
                    </div>
                  )}

                  {/* Next follow-up reminder */}
                  {entry.nextFollowUpDate && (
                    <div className={`mt-2 inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full ${
                      isOverdue ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      <CalendarDays className="w-3 h-3" />
                      {isOverdue ? 'Overdue: ' : 'Follow up by: '}
                      {new Date(entry.nextFollowUpDate).toLocaleString('en-IN', { 
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                      })}
                    </div>
                  )}

                  {/* Meta */}
                  <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-xs text-slate-400 font-medium">
                      <UserCheck className="w-3 h-3" />
                      {entry.addedBy?.name || 'Unknown'}
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <CalendarDays className="w-3 h-3" />
                      {new Date(entry.followUpDate || entry.createdAt).toLocaleDateString('en-IN', { 
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FollowUpPanel;
