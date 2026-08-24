import React, { useState, useEffect } from 'react';
import { 
  CheckSquare, CalendarDays, User, Clock, Plus, 
  Loader2, Pencil, Trash2, CheckCircle2, AlertTriangle, X, Paperclip, FileText,
  ChevronRight, ChevronDown
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

const getDownloadUrl = (fileKey) => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const serverBase = apiBase.replace(/\/api\/?$/, '');
  return `${serverBase}/api/files/download-local/${encodeURIComponent(fileKey)}`;
};

const TaskPanel = ({ enquiryId, readOnly = false }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [userOptions, setUserOptions] = useState([]);
  const [toast, setToast] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [expandedHistory, setExpandedHistory] = useState({});

  const toggleHistory = (taskId) => {
    setExpandedHistory(prev => ({
      ...prev,
      [taskId]: !prev[taskId]
    }));
  };

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', dueTime: '', 
    priority: 'Medium', status: 'To Do', assignedTo: '', attachments: []
  });

  const fetchTasks = async () => {
    try {
      const res = await api.get(`/tasks?linkedEnquiry=${enquiryId}&limit=500`); 
      setTasks(res.data?.data?.tasks || []);
    } catch (err) {
      console.error('Fetch tasks error:', err);
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

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    try {
      const uploadedAttachments = [...(form.attachments || [])];
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('module', 'Task');

        const res = await api.post('/files/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data?.data?.file) {
          const fileMeta = res.data.data.file;
          uploadedAttachments.push({
            fileName: fileMeta.originalName || fileMeta.fileName,
            originalName: fileMeta.originalName || fileMeta.fileName,
            fileKey: fileMeta.fileKey,
            mimeType: fileMeta.mimeType,
            size: fileMeta.size
          });
        }
      }
      setForm(prev => ({ ...prev, attachments: uploadedAttachments }));
      showToast('File(s) uploaded successfully');
    } catch (err) {
      console.error('File upload error:', err);
      showToast('Error uploading file', 'error');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, idx) => idx !== index)
    }));
  };

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
      setForm({ title: '', description: '', dueDate: '', dueTime: '', priority: 'Medium', status: 'To Do', assignedTo: '', attachments: [] });
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
      assignedTo: task.assignedTo?._id || task.assignedTo || '',
      attachments: task.attachments || []
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
    setForm({ title: '', description: '', dueDate: '', dueTime: '', priority: 'Medium', status: 'To Do', assignedTo: '', attachments: [] });
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

  const [filterTab, setFilterTab] = useState('ALL'); // 'ALL', 'ACTIVE', 'COMPLETED'

  const activeTasks = tasks.filter(t => t.status !== 'Done' && t.status !== 'Cancelled');
  const completedTasks = tasks.filter(t => t.status === 'Done');

  const displayedTasks = tasks.filter(t => {
    if (filterTab === 'ACTIVE') return t.status !== 'Done' && t.status !== 'Cancelled';
    if (filterTab === 'COMPLETED') return t.status === 'Done';
    return true;
  });

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
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-brand-600" />
            Related Tasks History
            <span className="bg-brand-50 text-brand-700 font-bold border border-brand-200 px-2.5 py-0.5 rounded-full text-xs">{tasks.length}</span>
          </h3>
          {!readOnly && (
          <button
            onClick={() => { setShowForm(!showForm); if(editingId) cancelForm(); }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> New Task
          </button>
          )}
        </div>

        {tasks.length > 0 && (
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit text-xs font-bold">
            <button
              type="button"
              onClick={() => setFilterTab('ALL')}
              className={`px-3 py-1 rounded-lg transition-all ${filterTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              All ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('ACTIVE')}
              className={`px-3 py-1 rounded-lg transition-all ${filterTab === 'ACTIVE' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Active ({activeTasks.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('COMPLETED')}
              className={`px-3 py-1 rounded-lg transition-all ${filterTab === 'COMPLETED' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Completed ({completedTasks.length})
            </button>
          </div>
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

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">File Attachments</label>
              <div className="flex flex-col gap-2">
                <label className="inline-flex items-center gap-2 px-3.5 py-2 bg-white border border-dashed border-slate-300 hover:border-brand-500 rounded-xl text-xs font-bold text-slate-600 cursor-pointer transition-all shadow-sm">
                  {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin text-brand-500" /> : <Paperclip className="w-4 h-4 text-brand-500" />}
                  <span>{uploadingFile ? 'Uploading file...' : 'Choose File(s) to Upload'}</span>
                  <input type="file" multiple onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
                </label>

                {form.attachments && form.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {form.attachments.map((att, idx) => (
                      <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-700 text-xs font-semibold">
                        <FileText className="w-3.5 h-3.5 text-slate-500" />
                        <span className="max-w-[140px] truncate">{att.originalName || att.fileName}</span>
                        <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-600 p-0.5">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving || uploadingFile} className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold disabled:opacity-60 transition-all flex items-center">
                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null} Save Task
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="py-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand-500" /></div>
      ) : displayedTasks.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
          <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">
            {tasks.length === 0 ? 'No tasks linked to this enquiry.' : `No ${filterTab.toLowerCase()} tasks found.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedTasks.map(task => (
            <div key={task._id} className={`p-4 bg-white rounded-2xl border ${task.status === 'Done' ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-200'} transition-shadow hover:shadow-sm space-y-3`}>
              <div className="flex justify-between items-start">
                <div className="w-full pr-2">
                  <div className="flex items-center gap-2">
                    {task.taskId && <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{task.taskId}</span>}
                    <h4 className={`text-sm font-bold ${task.status === 'Done' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{task.title}</h4>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {!readOnly ? (
                      <select
                        value={task.status}
                        onChange={(e) => markStatus(task._id, e.target.value)}
                        className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded border-0 outline-none cursor-pointer transition-all ${STATUS_COLORS[task.status]}`}
                        title="Click to change status"
                      >
                        {['To Do', 'In Progress', 'Done', 'Cancelled'].map(st => (
                          <option key={st} value={st} className="bg-white text-slate-800 font-bold">{st}</option>
                        ))}
                      </select>
                    ) : (
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>
                        {task.status}
                      </span>
                    )}
                    <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${PRIORITY_COLORS[task.priority]}`}>
                      {task.priority}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      <User className="w-3 h-3" /> Assigned: {task.assignedTo?.name || 'Unassigned'}
                    </span>
                  </div>

                  {/* Proof of Assignment / Creator & Completion Audit Badges */}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] font-medium text-slate-500 bg-slate-50/80 p-2 rounded-xl border border-slate-100">
                    <span className="flex items-center gap-1 text-slate-600">
                      <User className="w-3 h-3 text-slate-400" />
                      Created by <strong className="text-slate-700">{task.createdBy?.name || 'Super Admin'}</strong> on {task.createdAt ? new Date(task.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'N/A'}
                    </span>
                    {task.dueDate && (
                      <span className={`flex items-center gap-1 ${task.status !== 'Done' && new Date(task.dueDate) < new Date().setHours(0,0,0,0) ? 'text-red-500 font-bold' : ''}`}>
                        <CalendarDays className="w-3 h-3" />
                        Due: {new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {task.status === 'Done' && task.completedAt && (
                      <span className="flex items-center gap-1 text-emerald-700 font-bold bg-emerald-100/60 px-2 py-0.5 rounded-lg border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Completed by {task.completedBy?.name || 'Super Admin'} on {new Date(task.completedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  {/* Task Attachments */}
                  {task.attachments && task.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-slate-100">
                      {task.attachments.map((att, attIdx) => (
                        <a
                          key={attIdx}
                          href={getDownloadUrl(att.fileKey)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-lg text-xs font-semibold text-brand-600 transition-all"
                          title="Click to view or download attachment"
                        >
                          <Paperclip className="w-3.5 h-3.5 text-brand-500" />
                          <span className="max-w-[160px] truncate">{att.originalName || att.fileName}</span>
                          {att.size && <span className="text-[10px] text-slate-400 font-mono">({Math.round(att.size / 1024)} KB)</span>}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Collapsible Activity / Audit Trail History */}
                  <div className="mt-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => toggleHistory(task._id)}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-brand-600 transition-colors"
                    >
                      <Clock className="w-3 h-3" />
                      {expandedHistory[task._id] ? 'Hide Activity History' : `View Activity History (${task.history?.length || 1})`}
                      {expandedHistory[task._id] ? <ChevronDown className="w-3 h-3"/> : <ChevronRight className="w-3 h-3"/>}
                    </button>

                    {expandedHistory[task._id] && (
                      <div className="mt-2 space-y-1.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Task Activity Audit Trail</p>
                        {task.history && task.history.length > 0 ? (
                          task.history.map((h, hIdx) => (
                            <div key={hIdx} className="flex items-start justify-between text-[11px] py-1 border-b border-slate-200/60 last:border-0">
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0"></span>
                                <span className="font-semibold text-slate-700">{h.details || h.action}</span>
                                <span className="text-slate-400">by {h.performedByName || 'User'}</span>
                              </div>
                              <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                                {h.timestamp ? new Date(h.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            Created by {task.createdBy?.name || 'Super Admin'} on {new Date(task.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {!readOnly && (
                <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-100 shrink-0">
                  <button 
                    onClick={() => markStatus(task._id, task.status === 'Done' ? 'To Do' : 'Done')} 
                    className={`p-1.5 rounded-md transition-colors ${
                      task.status === 'Done' 
                        ? 'text-emerald-600 hover:text-slate-500 hover:bg-slate-100' 
                        : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`} 
                    title={task.status === 'Done' ? 'Reopen task (Set to To Do)' : 'Mark as Done'}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleEdit(task)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="Edit Task">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(task._id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Delete Task">
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
