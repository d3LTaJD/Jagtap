import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  CalendarDays, List, AlertCircle, Clock, CheckCircle2, Loader2, 
  ChevronLeft, ChevronRight, Plus, X, Trash2, Pencil, Search, 
  Filter, ArrowUpDown, ChevronDown, MoreVertical, Calendar,
  LayoutGrid, Paperclip, FileText
} from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';

const PRIORITY_COLORS = {
  Urgent: 'text-red-700 bg-red-50 border-red-200',
  High: 'text-orange-700 bg-orange-50 border-orange-200',
  Medium: 'text-blue-700 bg-blue-50 border-blue-200',
  Low: 'text-slate-600 bg-slate-50 border-slate-200',
};

const STATUS_COLORS = {
  'To Do': 'bg-slate-100 text-slate-700 border-slate-300',
  'In Progress': 'bg-amber-50 text-amber-700 border-amber-300',
  'Done': 'bg-emerald-50 text-emerald-700 border-emerald-300',
  'Cancelled': 'bg-red-50 text-red-500 border-red-200',
};

const getDownloadUrl = (fileKey) => {
  const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
  const serverBase = apiBase.replace(/\/api\/?$/, '');
  return `${serverBase}/api/files/download-local/${encodeURIComponent(fileKey)}`;
};

const emptyForm = { title: '', description: '', dueDate: '', dueTime: '', priority: 'Medium', assignedTo: '', status: 'To Do', linkedEnquiry: '', attachments: [] };

const Tasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [enquiryOptions, setEnquiryOptions] = useState([]);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  // Filters & Pagination
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ status: '', priority: '', assignedTo: '', search: '' });
  const [sortBy, setSortBy] = useState('dueDate');
  const [sortOrder, setSortOrder] = useState('asc');

  useEffect(() => { fetchTasks(); fetchUsers(); fetchEnquiries(); }, [page, filters, sortBy, sortOrder]);

  const fetchEnquiries = async () => {
    try {
      const res = await api.get('/enquiries?limit=100');
      const list = res.data.data.enquiries || [];
      setEnquiryOptions(list.map(e => ({
        value: e._id,
        label: `${e.enquiryId} - ${e.customerName || e.clientName || 'Customer'} (${e.productCategory || 'Custom'})`
      })));
    } catch (err) {}
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        sortBy,
        sortOrder,
        ...filters
      };
      const res = await api.get('/tasks', { params });
      setTasks(res.data.data.tasks || []);
      setTotal(res.data.total || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get('/auth/users');
      setUsers(res.data.data.users || []);
    } catch (e) { console.error(e); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      if (editingTask) {
        await api.patch(`/tasks/${editingTask._id}`, formData);
      } else {
        await api.post('/tasks', formData);
      }
      setShowModal(false);
      setEditingTask(null);
      setFormData({ ...emptyForm });
      fetchTasks();
      showToast(editingTask ? 'Task updated' : 'Task created');
    } catch (err) {
      showToast(err.response?.data?.message || 'Error saving task', 'error');
    } finally { setSubmitLoading(false); }
  };

  const [uploadingFile, setUploadingFile] = useState(false);

  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    try {
      const uploadedAttachments = [...(formData.attachments || [])];
      for (const file of files) {
        const data = new FormData();
        data.append('file', file);
        data.append('module', 'Task');

        const res = await api.post('/files/upload', data, {
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
      setFormData(prev => ({ ...prev, attachments: uploadedAttachments }));
      showToast('File(s) uploaded');
    } catch (err) {
      console.error(err);
      showToast('Error uploading file', 'error');
    } finally {
      setUploadingFile(false);
      e.target.value = '';
    }
  };

  const removeAttachment = (index) => {
    setFormData(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, idx) => idx !== index)
    }));
  };

  const openEdit = (task) => {
    setEditingTask(task);
    setFormData({
      title: task.title || '', description: task.description || '',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      dueTime: task.dueTime || '', priority: task.priority || 'Medium',
      assignedTo: task.assignedTo?._id || '', status: task.status || 'To Do',
      linkedEnquiry: task.linkedEnquiry?._id || task.linkedEnquiry || '',
      attachments: task.attachments || []
    });
    setShowModal(true);
  };

  const deleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;
    try { await api.delete(`/tasks/${id}`); fetchTasks(); }
    catch (e) { console.error(e); }
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
    setPage(1);
  };

  const userOptions = users.map(u => ({ value: u._id, label: u.fullName || u.name || 'Unknown', group: u.department }));

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <div className="p-2.5 bg-brand-50 rounded-2xl text-brand-600 shadow-sm shadow-brand-500/10">
              <List className="w-7 h-7" />
            </div>
            Task Management
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Create and track independent tasks for your workflow.</p>
        </div>
        
        <button 
          onClick={() => { setEditingTask(null); setFormData({ ...emptyForm }); setShowModal(true); }}
          className="inline-flex items-center px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-sm font-bold shadow-xl shadow-brand-500/30 transition-all active:scale-95"
        >
          <Plus className="w-5 h-5 mr-2" /> New Task
        </button>
      </div>

      {/* Filters & Tools */}
      <div className="bg-white p-4 rounded-[2.5rem] shadow-sm border border-slate-200 mb-8 flex flex-col lg:flex-row items-center gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search tasks..." 
            value={filters.search}
            onChange={e => setFilters(f => ({...f, search: e.target.value}))}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="w-40 shrink-0">
            <AutocompleteSelect 
              options={['To Do', 'In Progress', 'Done', 'Cancelled']} 
              value={filters.status}
              onChange={v => setFilters(f => ({...f, status: v}))}
              placeholder="All Status"
            />
          </div>
          <div className="w-40 shrink-0">
            <AutocompleteSelect 
              options={['Low', 'Medium', 'High', 'Urgent']} 
              value={filters.priority}
              onChange={v => setFilters(f => ({...f, priority: v}))}
              placeholder="All Priority"
            />
          </div>
          <div className="w-48 shrink-0">
            <AutocompleteSelect 
              options={userOptions}
              value={filters.assignedTo}
              onChange={v => setFilters(f => ({...f, assignedTo: v}))}
              placeholder="Assigned To"
            />
          </div>
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <button onClick={() => handleSort('title')} className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                    Task Details <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                   <button onClick={() => handleSort('dueDate')} className="flex items-center gap-1.5 hover:text-slate-600 transition-colors">
                    Due Date <ArrowUpDown className="w-3 h-3" />
                  </button>
                </th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Priority</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned To</th>
                <th className="px-6 py-4 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" />
                  </td>
                </tr>
              ) : tasks.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-20 text-center">
                    <div className="flex flex-col items-center">
                      <LayoutGrid className="w-12 h-12 text-slate-200 mb-4" />
                      <p className="text-lg font-bold text-slate-700">No tasks found</p>
                      <p className="text-sm text-slate-400 mt-1">Try adjusting your filters or create a new task.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                tasks.map(task => (
                  <tr key={task._id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">{task.title}</span>
                        <span className="text-xs text-slate-500 mt-1 line-clamp-1">{task.description || 'No description'}</span>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                           {task.linkedEnquiry && (
                             <Link to={`/app/enquiries/${task.linkedEnquiry._id}`} className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                               #{task.linkedEnquiry.enquiryId}
                             </Link>
                           )}
                           <span className="text-[10px] font-mono text-slate-400">ID: {task.taskId}</span>
                        </div>

                        {task.attachments && task.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {task.attachments.map((att, attIdx) => (
                              <a
                                key={attIdx}
                                href={getDownloadUrl(att.fileKey)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 hover:bg-brand-50 border border-slate-200 hover:border-brand-200 rounded-md text-[11px] font-semibold text-brand-600 transition-all"
                                title="Download attachment"
                              >
                                <Paperclip className="w-3 h-3 text-brand-500" />
                                <span className="max-w-[150px] truncate">{att.originalName || att.fileName}</span>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}
                        </div>
                        {task.dueTime && (
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {task.dueTime}
                          </div>
                        )}
                        {task.status !== 'Done' && task.dueDate && new Date(task.dueDate) < new Date().setHours(0,0,0,0) && (
                          <span className="text-[10px] font-black text-red-500 uppercase mt-1 flex items-center gap-1">
                             <AlertCircle className="w-3 h-3" /> Overdue
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${PRIORITY_COLORS[task.priority] || 'bg-slate-100'}`}>
                        {task.priority}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${STATUS_COLORS[task.status] || 'bg-slate-100'}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-600 uppercase">
                          {task.assignedTo?.name?.[0] || '?'}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-bold text-slate-800 truncate">{task.assignedTo?.name || 'Unassigned'}</span>
                          <span className="text-[10px] text-slate-400 font-medium truncate">{task.assignedTo?.department || 'N/A'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEdit(task)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-all" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteTask(task._id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {total > 20 && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/30">
            <p className="text-xs font-bold text-slate-400">
              Showing <span className="text-slate-900">{tasks.length}</span> of <span className="text-slate-900">{total}</span> tasks
            </p>
            <div className="flex items-center gap-2">
              <button 
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-black text-slate-700 px-2">{page}</span>
              <button 
                disabled={page * 20 >= total}
                onClick={() => setPage(p => p + 1)}
                className="p-2 border border-slate-200 rounded-xl bg-white hover:bg-slate-50 disabled:opacity-40 transition-all shadow-sm"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* New/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300">
            {/* Fixed Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl shrink-0">
              <div>
                <h2 className="text-lg font-black text-slate-900 tracking-tight">{editingTask ? `Edit Task` : 'Create New Task'}</h2>
                {editingTask && <p className="text-xs font-bold text-slate-400 mt-0.5 uppercase tracking-widest">{editingTask.taskId}</p>}
              </div>
              <button onClick={() => { setShowModal(false); setEditingTask(null); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            {/* Form Wrap */}
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Title *</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={200} 
                    value={formData.title} 
                    onChange={e => setFormData({...formData, title: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" 
                    placeholder="What needs to be done?" 
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                  <textarea 
                    maxLength={1000} 
                    value={formData.description} 
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 min-h-[80px] outline-none resize-none" 
                    placeholder="Add more details about this task..." 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Due Date *</label>
                    <input 
                      type="date" 
                      required 
                      value={formData.dueDate} 
                      onChange={e => setFormData({...formData, dueDate: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Due Time</label>
                    <input 
                      type="time" 
                      value={formData.dueTime} 
                      onChange={e => setFormData({...formData, dueTime: e.target.value})}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Priority</label>
                    <AutocompleteSelect 
                      options={['Low','Medium','High','Urgent']} 
                      value={formData.priority} 
                      onChange={v => setFormData({...formData, priority: v})} 
                      placeholder="Select..." 
                      allowClear={false} 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Status</label>
                    <AutocompleteSelect 
                      options={['To Do','In Progress','Done','Cancelled']} 
                      value={formData.status} 
                      onChange={v => setFormData({...formData, status: v})} 
                      placeholder="Select..." 
                      allowClear={false} 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Assign To</label>
                  <AutocompleteSelect 
                    options={userOptions} 
                    value={formData.assignedTo} 
                    onChange={v => setFormData({...formData, assignedTo: v})} 
                    placeholder="Select user..." 
                    allowClear={true} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Link to Enquiry (Optional)</label>
                  <AutocompleteSelect 
                    options={enquiryOptions} 
                    value={formData.linkedEnquiry} 
                    onChange={v => setFormData({...formData, linkedEnquiry: v})} 
                    placeholder="Search & select Enquiry..." 
                    allowClear={true} 
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">File Attachments</label>
                  <div className="flex flex-col gap-2">
                    <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-dashed border-slate-300 hover:border-brand-500 rounded-xl text-xs font-bold text-slate-600 cursor-pointer transition-all">
                      {uploadingFile ? <Loader2 className="w-4 h-4 animate-spin text-brand-500" /> : <Paperclip className="w-4 h-4 text-brand-500" />}
                      <span>{uploadingFile ? 'Uploading file...' : 'Choose File(s) to Upload'}</span>
                      <input type="file" multiple onChange={handleFileUpload} disabled={uploadingFile} className="hidden" />
                    </label>

                    {formData.attachments && formData.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {formData.attachments.map((att, idx) => (
                          <span key={idx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-200/80 text-slate-700 text-xs font-semibold">
                            <FileText className="w-3.5 h-3.5 text-slate-500" />
                            <span className="max-w-[160px] truncate">{att.originalName || att.fileName}</span>
                            <button type="button" onClick={() => removeAttachment(idx)} className="text-slate-400 hover:text-red-600 p-0.5">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Fixed Footer */}
              <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end gap-3 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm">Cancel</button>
                <button 
                  type="submit"
                  disabled={submitLoading} 
                  className="px-6 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-lg shadow-brand-500/30 disabled:opacity-70 flex items-center"
                >
                  {submitLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} 
                  {editingTask ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
