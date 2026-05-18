import React, { useState, useEffect } from 'react';
import { Database, Plus, X, Pencil, Trash2, Loader2, Save, ChevronRight, GripVertical, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../api/client';

const emptyCategory = { name: '', description: '', items: [] };

const MasterData = () => {
  const [categories, setCategories] = useState([]);
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...emptyCategory });
  const [itemInput, setItemInput] = useState({ value: '', label: '' });
  const [expanded, setExpanded] = useState(null);

  const flash = (msg, type = 'success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [catRes, fieldRes] = await Promise.all([
        api.get('/master-data'),
        api.get('/fields').catch(() => ({ data: { data: { fields: [] } } })),
      ]);
      setCategories(catRes.data.data.categories || []);
      setFields(fieldRes.data.data.fields || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ ...emptyCategory }); setShowModal(true); };

  const openEdit = (cat) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || '', items: [...(cat.items || [])] });
    setShowModal(true);
  };

  const addItem = () => {
    if (!itemInput.label.trim() || !itemInput.value.trim()) {
      flash('Both Code and Name are required', 'error');
      return;
    }
    const codeExists = form.items.some(i => i.value.toLowerCase() === itemInput.value.trim().toLowerCase());
    if (codeExists) {
      flash('This Code already exists in this category', 'error');
      return;
    }
    setForm(f => ({ ...f, items: [...f.items, { label: itemInput.label.trim(), value: itemInput.value.trim().toUpperCase(), description: '', sortOrder: f.items.length, isActive: true }] }));
    setItemInput({ value: '', label: '' });
  };

  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const toggleItemActive = (idx) => {
    setForm(f => ({ ...f, items: f.items.map((item, i) => i === idx ? { ...item, isActive: !item.isActive } : item) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/master-data/${editing._id}`, form);
        flash('Category updated!');
      } else {
        await api.post('/master-data', form);
        flash('Category created!');
      }
      setShowModal(false);
      fetchAll();
    } catch (err) {
      flash(err.response?.data?.message || 'Error saving', 'error');
    } finally { setSaving(false); }
  };

  const handleDelete = async (cat) => {
    if (!confirm(`Archive "${cat.name}"? It can be restored later.`)) return;
    try { await api.delete(`/master-data/${cat._id}`); flash('Category archived'); fetchAll(); }
    catch { flash('Delete failed', 'error'); }
  };



  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />} {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Database className="w-6 h-6 text-brand-600" /> Master Data
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage lookup tables, dropdown options, and reference data across modules.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-brand-500/25">
          <Plus className="w-4 h-4" /> New Category
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
      ) : categories.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <Database className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-700">No Master Data Yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-6">Create categories like "Material Types", "Welding Processes", etc.</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold"><Plus className="w-4 h-4" /> Create First Category</button>
        </div>
      ) : (
        <div className="space-y-4">
          {categories.map(cat => (
            <div key={cat._id} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-md">
              {/* Category Header */}
              <div className="px-6 py-4 flex items-center gap-4 cursor-pointer" onClick={() => setExpanded(expanded === cat._id ? null : cat._id)}>
                <ChevronRight className={`w-5 h-5 text-slate-400 transition-transform ${expanded === cat._id ? 'rotate-90' : ''}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-slate-900">{cat.name}</h3>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{cat.items?.filter(i => i.isActive).length || 0} items</span>
                  </div>
                  {cat.description && <p className="text-xs text-slate-500 mt-0.5 truncate">{cat.description}</p>}
                </div>

                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <button onClick={() => openEdit(cat)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(cat)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Expanded Items */}
              {expanded === cat._id && (
                <div className="border-t border-slate-100 bg-slate-50/50">
                  {/* Items Table */}
                  <div className="px-6 py-2">
                    <div className="grid grid-cols-12 gap-2 py-2 border-b border-slate-200">
                      <div className="col-span-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Code</div>
                      <div className="col-span-7 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</div>
                      <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Status</div>
                    </div>
                    {(cat.items || []).length === 0 ? (
                      <p className="text-sm text-slate-400 text-center py-6">No items yet. Edit this category to add items.</p>
                    ) : (cat.items || []).map((item, idx) => (
                      <div key={item._id || idx} className={`grid grid-cols-12 gap-2 py-2.5 border-b border-slate-50 ${!item.isActive ? 'opacity-40' : ''}`}>
                        <div className="col-span-3 self-center">
                          <p className="text-sm font-mono font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded inline-block">{item.value}</p>
                        </div>
                        <div className="col-span-7 text-sm font-bold text-slate-800 self-center">{item.label}</div>
                        <div className="col-span-2 text-right self-center">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-500'}`}>{item.isActive ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">{editing ? `Edit — ${editing.name}` : 'New Master Data Category'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Category Name *</label>
                  <input type="text" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. VALVE TYPE" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Optional description" className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none" />
                </div>
              </div>



              {/* Items */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Entries ({form.items.length})</label>
                <div className="flex gap-2 mb-3">
                  <input type="text" value={itemInput.value} onChange={e => setItemInput({ ...itemInput, value: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} placeholder="Code (e.g. BV)" className="w-1/3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20 font-mono" />
                  <input type="text" value={itemInput.label} onChange={e => setItemInput({ ...itemInput, label: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} placeholder="Name (e.g. Ball Valve)" className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20" />
                  <button type="button" onClick={addItem} className="px-4 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700 shadow-sm shrink-0">Add</button>
                </div>
                {form.items.length > 0 && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                    {form.items.map((item, idx) => (
                      <div key={idx} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-50 last:border-0 ${!item.isActive ? 'opacity-40 bg-slate-50' : ''}`}>
                        <GripVertical className="w-3.5 h-3.5 text-slate-300 cursor-move" />
                        <div className="w-24 shrink-0">
                          <p className="text-sm font-bold font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-center truncate">{item.value}</p>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-slate-800 truncate">{item.label}</p>
                        </div>
                        <button type="button" onClick={() => toggleItemActive(idx)} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'} w-16 text-center`}>{item.isActive ? 'Active' : 'Inactive'}</button>
                        <button type="button" onClick={() => removeItem(idx)} className="p-1 text-slate-400 hover:text-red-500 ml-1"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-sm">Cancel</button>
                <button type="submit" disabled={saving} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl shadow-sm disabled:opacity-70 flex items-center gap-2">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} <Save className="w-4 h-4" /> {editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default MasterData;
