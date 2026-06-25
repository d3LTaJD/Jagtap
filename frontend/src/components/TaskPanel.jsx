import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, CalendarDays, User, Clock, Plus, 
  Loader2, Pencil, Trash2, CheckCircle2, AlertTriangle, X 
} from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from './AutocompleteSelect';

const PRIORITY_COLORS = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-orange-100 text-orange-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low: 'bg-slate-100 text-slate-600'
};

const STATUS_COLORS = {
  'To Do': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Done': 'bg-emerald-100 text-emerald-700',
  'Cancelled': 'bg-red-100 text-red-700'
};

const TaskPanel = ({ enquiryId, readOnly = false }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', dueTime: '', 
    priority: 'Medium', status: 'To Do', assignedTo: ''
  });

  const fetchTasks = async () => {
    try {
      // Assuming GET /api/tasks can filter by linkedEnquiry (Wait, taskController handles this? Actually we should pass search params if supported, or fetch all and filter. We will fetch with search param. taskController handles it if we modify it, but right now it doesn't filter by linkedEnquiry. Let's just fetch all tasks for this enquiry if we can, or we'll filter on frontend for now to be safe.)
      const res = await api.get(`/tasks`); 
      const allTasks = res.data.data.tasks;
      const relatedTasks = allTasks.filter(t => t.linkedEnquiry?._id === enquiryId || t.linkedEnquiry === enquiryId);
      setTasks(relatedTasks);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      const formatted = res.data.data.users.map(u => ({ value: u._id, label: u.name }));
      setUserOptions(formatted);
    } catch (err) {}
  };

  useEffect(() => {
    if (enquiryId) {
      fetchTasks();
      fetchUsers();
    }
  }, [enquiryId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, linkedEnquiry: enquiryId };
      if (editingId) {
        await api.patch(`/tasks/${editingId}`, payload);
      } else {
        await api.post('/tasks', payload);
      }
      setForm({ title: '', description: '', dueDate: '', dueTime: '', priority: 'Medium', status: 'To Do', assignedTo: '' });
      setShowForm(false);
      setEditingId(null);
      fetchTasks();
      showToast(editingId ? 'Task updated' : 'Task created');
    } catch (err) {
      console.error(err);
      showToast('Error saving task', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (task) => {
    setForm({
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : '',
      dueTime: task.dueTime || '',
      priority: task.priority || 'Medium',
      status: task.status || 'To Do',
      assignedTo: task.assignedTo?._id || task.assignedTo || ''
    });
    setEditingId(task._id);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${id}`);
      fetchTasks();
      showToast('Task deleted');
    } catch (err) {
      showToast('Error deleting task', 'error');
    }
  };

  const cancelForm = () => {
    setForm({ title: '', description: '', dueDate: '', dueTime: '', priority: 'Medium', status: 'To Do', assignedTo: '' });
    setEditingId(null);
    setShowForm(false);
  };

  const markStatus = async (id, status) => {
    try {
      await api.patch(`/tasks/${id}`, { status });
      fetchTasks();
      showToast(`Task marked as ${status}`);
    } catch(err) {
      showToast('Error updating status', 'error');
    }
  };

  return (
    <div className="space-y-4">
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-brand-600" />
          Related Tasks
          <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs">{tasks.length}</span>
        </h3>
        {!readOnly && (
        <button
          onClick={() => { setShowForm(!showForm); if(editingId) cancelForm(); }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" /> New Task
        </button>
        )}
      </div>

      {showForm && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4 animate-in slide-in-from-top-2 duration-200">
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest">
              {editingId ? 'Edit Task' : 'Create Task'}
            </h4>
            <button onClick={cancelForm} className="text-slate-400 hover:text-slate-600 p-1"><X className="w-4 h-4"/></button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Title *</label>
              <input required type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none" />
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Due Date *</label>
                <input required type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Assign To</label>
                <AutocompleteSelect options={userOptions} value={form.assignedTo} onChange={v => setForm({...form, assignedTo: v})} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Priority</label>
                <AutocompleteSelect options={['Low','Medium','High','Urgent']} value={form.priority} onChange={v => setForm({...form, priority: v})} allowClear={false} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">Status</label>
                <AutocompleteSelect options={['To Do','In Progress','Done','Cancelled']} value={form.status} onChange={v => setForm({...form, status: v})} allowClear={false} />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-all flex items-center">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Task
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No tasks linked to this enquiry.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => (
            <div key={task._id} className={`p-4 bg-white rounded-2xl border ${task.status === 'Done' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'} transition-shadow hover:shadow-sm`}>
              <div className="flex justify-between items-start">
                <div>
                  <h4 className={`text-sm font-bold ${task.status === 'Done' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</h4>
                  
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>
                      {task.status}
                    </span>
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      <User className="w-3 h-3" /> {task.assignedTo?.name || 'Unassigned'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3 text-xs font-medium text-slate-500">
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 ${task.status !== 'Done' && new Date(task.dueDate) < new Date().setHours(0,0,0,0) ? 'text-red-500 font-bold' : ''}`}>
                        <CalendarDays className="w-3.5 h-3.5" />
                        {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                </div>

                {!readOnly && (
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100">
                  {task.status !== 'Done' && (
                    <button onClick={() => markStatus(task._id, 'Done')} className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-md transition-colors" title="Mark as Done">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => handleEdit(task)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(task._id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskPanel;
