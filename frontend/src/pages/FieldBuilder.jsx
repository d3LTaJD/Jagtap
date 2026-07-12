import React, { useState, useEffect, useRef } from 'react';
import {
  Settings2, PlusCircle, Trash2, Pencil, GripVertical, Save,
  ChevronDown, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, RotateCcw, X
} from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';

const FORM_CONTEXTS = ['Enquiry', 'Quotation', 'QAP', 'Product'];

const FIELD_TYPES = [
  'Text (Short)', 'Text (Long)', 'Number', 'Dropdown (Single)',
  'Dropdown (Multi)', 'Date Picker', 'Date + Time', 'File Upload',
  'Checkbox (Boolean)', 'Radio Button', 'Lookup / Reference', 'Auto-Calculated',
  'Rich Text', 'Signature', 'GPS Location'
];



const FIELD_TYPE_ICONS = {
  'Text (Short)': 'Aa',
  'Text (Long)': '¶',
  'Number': '#',
  'Dropdown (Single)': '▽',
  'Dropdown (Multi)': '☑',
  'Date Picker': '📅',
  'Date + Time': '🕐',
  'File Upload': '📎',
  'Checkbox (Boolean)': '◉',
  'Radio Button': '⊙',
  'Lookup / Reference': '🔗',
  'Auto-Calculated': 'ƒ',
  'Rich Text': 'RT',
  'Signature': '✍️',
  'GPS Location': '📍',
};

const defaultForm = {
  fieldLabel: '', fieldName: '', fieldType: 'Text (Short)', placeholder: '',
  isRequired: false, options: [], groupLabel: '',
  validationRules: { min: '', max: '', maxLength: '', unitLabel: '' },
  conditionalLogic: { dependsOnField: '', requiredValue: '' },
  visibleToRoles: [],
  editableByRoles: [],
};

const FieldBuilder = () => {
  const [activeContext, setActiveContext] = useState('Enquiry');
  const [fields, setFields] = useState([]);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPanel, setShowPanel] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [optionInput, setOptionInput] = useState('');
  const [dragIdx, setDragIdx] = useState(null);
  const [orderChanged, setOrderChanged] = useState(false);
  const dragOverIdx = useRef(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchFieldsAndRoles = async () => {
    setLoading(true);
    try {
      const [fieldsRes, rolesRes] = await Promise.all([
        api.get(`/fields?formContext=${activeContext}`),
        api.get('/roles')
      ]);
      setFields(fieldsRes.data.data.fields);
      setAvailableRoles(rolesRes.data.data.roles);
      setOrderChanged(false);
    } catch (err) {
      showToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFieldsAndRoles(); }, [activeContext]);

  // === Drag to reorder ===
  const handleDragStart = (idx) => setDragIdx(idx);
  const handleDragOver = (e, idx) => {
    e.preventDefault();
    dragOverIdx.current = idx;
  };
  const handleDrop = () => {
    if (dragIdx === null || dragOverIdx.current === null) return;
    const reordered = [...fields];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(dragOverIdx.current, 0, moved);
    setFields(reordered);
    setOrderChanged(true);
    setDragIdx(null);
    dragOverIdx.current = null;
  };

  const saveOrder = async () => {
    setSaving(true);
    try {
      await api.patch('/fields/reorder', {
        orderedIds: fields.map((f, i) => ({ id: f._id, displayOrder: i }))
      });
      showToast('Order saved!');
      setOrderChanged(false);
    } catch (err) {
      showToast('Failed to save order', 'error');
    } finally {
      setSaving(false);
    }
  };

  // === Opening Add/Edit panel ===
  const openAdd = () => {
    setEditingField(null);
    setForm({ ...defaultForm });
    setOptionInput('');
    setShowPanel(true);
  };

  const openEdit = (field) => {
    setEditingField(field);
    setForm({
      fieldLabel: field.fieldLabel,
      fieldName: field.fieldName,
      fieldType: field.fieldType,
      placeholder: field.placeholder || '',
      isRequired: field.isRequired,
      options: [...(field.options || [])],
      groupLabel: field.groupLabel || '',
      validationRules: { ...{ min: '', max: '', maxLength: '', unitLabel: '' }, ...field.validationRules },
      conditionalLogic: { ...{ dependsOnField: '', requiredValue: '' }, ...field.conditionalLogic },
      visibleToRoles: [...(field.visibleToRoles || [])],
      editableByRoles: [...(field.editableByRoles || [])],
    });
    setOptionInput('');
    setShowPanel(true);
  };

  // Auto-generate fieldName from label
  const handleLabelChange = (val) => {
    const name = val.charAt(0).toLowerCase() + val.replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()).slice(1).replace(/[^a-zA-Z0-9]/g, '');
    setForm(f => ({ ...f, fieldLabel: val, ...(editingField ? {} : { fieldName: name }) }));
  };

  const addOption = () => {
    if (!optionInput.trim()) return;
    setForm(f => ({ ...f, options: [...f.options, optionInput.trim()] }));
    setOptionInput('');
  };

  const removeOption = (opt) => setForm(f => ({ ...f, options: f.options.filter(o => o !== opt) }));

  const toggleVisibleRole = (role) => {
    setForm(f => ({
      ...f,
      visibleToRoles: f.visibleToRoles.includes(role)
        ? f.visibleToRoles.filter(r => r !== role)
        : [...f.visibleToRoles, role]
    }));
  };

  const toggleEditableRole = (role) => {
    setForm(f => ({
      ...f,
      editableByRoles: f.editableByRoles.includes(role)
        ? f.editableByRoles.filter(r => r !== role)
        : [...f.editableByRoles, role]
    }));
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        formContext: activeContext,
        validationRules: {
          min: form.validationRules.min !== '' ? Number(form.validationRules.min) : undefined,
          max: form.validationRules.max !== '' ? Number(form.validationRules.max) : undefined,
          maxLength: form.validationRules.maxLength !== '' ? Number(form.validationRules.maxLength) : undefined,
          unitLabel: form.validationRules.unitLabel || undefined,
        },
        conditionalLogic: form.conditionalLogic.dependsOnField ? form.conditionalLogic : {},
      };

      if (editingField) {
        await api.patch(`/fields/${editingField._id}`, payload);
        showToast('Field updated!');
      } else {
        await api.post('/fields', payload);
        showToast('Field created!');
      }
      setShowPanel(false);
      fetchFieldsAndRoles();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (field) => {
    if (!confirm(`Remove "${field.fieldLabel}" from ${activeContext} forms?\n\nHistorical data will be preserved.`)) return;
    try {
      await api.delete(`/fields/${field._id}`);
      showToast('Field removed (soft-deleted). Historical data safe.');
      fetchFieldsAndRoles();
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const needsOptions = ['Dropdown (Single)', 'Dropdown (Multi)', 'Radio Button'].includes(form.fieldType);
  const needsValidation = ['Number', 'Text (Short)', 'Text (Long)'].includes(form.fieldType);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-brand-600" /> Field Builder
          </h1>
          <p className="text-sm text-slate-500 mt-1">Configure custom fields for any form — no code required.</p>
        </div>
        <div className="flex gap-2">
          {orderChanged && (
            <button onClick={saveOrder} disabled={saving} className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm">
              <Save className="w-4 h-4" /> Save Order
            </button>
          )}
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-brand-500/25">
            <PlusCircle className="w-4 h-4" /> Add Field
          </button>
        </div>
      </div>

      {/* Context Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl mb-6 w-fit">
        {FORM_CONTEXTS.map(ctx => (
          <button
            key={ctx}
            onClick={() => setActiveContext(ctx)}
            className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
              activeContext === ctx
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {ctx}
          </button>
        ))}
      </div>

      {/* Field List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-4">
          <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest"></div>
          <div className="col-span-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Field Label</div>
          <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Type</div>
          <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">Group</div>
          <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Req.</div>
          <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cond.</div>
          <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">Roles</div>
          <div className="col-span-1 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-brand-500" />
          </div>
        ) : fields.length === 0 ? (
          <div className="py-16 text-center">
            <Settings2 className="w-10 h-10 text-slate-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-500">No fields defined for {activeContext} yet.</p>
            <button onClick={openAdd} className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold">
              <PlusCircle className="w-4 h-4" /> Add Your First Field
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {fields.map((field, idx) => (
              <div
                key={field._id}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={handleDrop}
                className={`grid grid-cols-12 gap-4 items-center px-6 py-4 hover:bg-slate-50/80 transition-colors ${dragIdx === idx ? 'opacity-40' : ''}`}
              >
                <div className="col-span-1 text-slate-300 cursor-grab active:cursor-grabbing">
                  <GripVertical className="w-4 h-4" />
                </div>
                <div className="col-span-4">
                  <p className="text-sm font-bold text-slate-900">{field.fieldLabel}</p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">{field.fieldName}</p>
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                    <span>{FIELD_TYPE_ICONS[field.fieldType] || '?'}</span>
                    <span className="truncate max-w-[80px]">{(field.fieldType || 'Unknown').replace(' (Single)', '').replace(' (Boolean)', '').replace(' (Multi)', ' Multi').replace(' (Long)', ' Long').replace(' (Short)', '')}</span>
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-xs text-slate-500 truncate">{field.groupLabel || '—'}</span>
                </div>
                <div className="col-span-1">
                  {field.isRequired
                    ? <span className="w-2 h-2 rounded-full bg-red-400 inline-block" title="Required" />
                    : <span className="w-2 h-2 rounded-full bg-slate-200 inline-block" title="Optional" />
                  }
                </div>
                <div className="col-span-1">
                  {field.conditionalLogic?.dependsOnField
                    ? <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase">Yes</span>
                    : <span className="text-[10px] text-slate-400">—</span>
                  }
                </div>
                <div className="col-span-1 flex items-center gap-1.5 text-slate-400">
                  {field.visibleToRoles?.length > 0 && <Eye className="w-3.5 h-3.5 text-brand-500" title={`Visible to: ${field.visibleToRoles.join(', ')}`} />}
                  {field.editableByRoles?.length > 0 && <Save className="w-3.5 h-3.5 text-emerald-500" title={`Editable by: ${field.editableByRoles.join(', ')}`} />}
                  {!field.visibleToRoles?.length && !field.editableByRoles?.length && <span className="text-[10px]">—</span>}
                </div>
                <div className="col-span-1 flex items-center justify-end gap-2">
                  <button onClick={() => openEdit(field)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(field)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Drag hint */}
      {fields.length > 1 && (
        <p className="text-xs text-slate-400 font-medium mt-3 text-center">
          ⠿ Drag rows to reorder, then click <strong>Save Order</strong>
        </p>
      )}

      {/* Add/Edit Slide-in Panel */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          <div className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-slate-50">
              <h2 className="font-bold text-slate-900 text-base">
                {editingField ? 'Edit Field' : `New Field — ${activeContext}`}
              </h2>
              <button onClick={() => setShowPanel(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Panel Form */}
            <form onSubmit={submitForm} className="flex-1 overflow-y-auto p-6 space-y-5">

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Field Label *</label>
                <input
                  type="text" required value={form.fieldLabel}
                  onChange={e => handleLabelChange(e.target.value)}
                  placeholder="e.g. ASME Section"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1 font-mono">key: {form.fieldName || '...'}</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Field Type *</label>
                <AutocompleteSelect
                  options={FIELD_TYPES}
                  value={form.fieldType}
                  onChange={v => setForm(f => ({ ...f, fieldType: v, options: [] }))}
                  placeholder="Select field type..."
                  allowClear={false}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Placeholder Text</label>
                <input
                  type="text" value={form.placeholder}
                  onChange={e => setForm(f => ({ ...f, placeholder: e.target.value }))}
                  placeholder="Hint shown inside the field"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Section Group</label>
                <input
                  type="text" value={form.groupLabel}
                  onChange={e => setForm(f => ({ ...f, groupLabel: e.target.value }))}
                  placeholder="e.g. Technical Specs"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                />
              </div>

              {/* Options for dropdowns/radio */}
              {needsOptions && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Options</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text" value={optionInput}
                      onChange={e => setOptionInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                      placeholder="Type option, press Enter"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500"
                    />
                    <button type="button" onClick={addOption} className="px-3 py-2 bg-brand-600 text-white rounded-lg text-sm font-bold hover:bg-brand-700">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.options.map(opt => (
                      <span key={opt} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold text-slate-700">
                        {opt}
                        <button type="button" onClick={() => removeOption(opt)} className="text-slate-400 hover:text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation Rules */}
              {needsValidation && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Validation Rules</label>
                  <div className="grid grid-cols-2 gap-2">
                    {form.fieldType === 'Number' && (
                      <>
                        <input type="number" placeholder="Min" value={form.validationRules.min} onChange={e => setForm(f => ({ ...f, validationRules: { ...f.validationRules, min: e.target.value } }))} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" />
                        <input type="number" placeholder="Max" value={form.validationRules.max} onChange={e => setForm(f => ({ ...f, validationRules: { ...f.validationRules, max: e.target.value } }))} className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" />
                        <input type="text" placeholder="Unit (e.g. kg)" value={form.validationRules.unitLabel} onChange={e => setForm(f => ({ ...f, validationRules: { ...f.validationRules, unitLabel: e.target.value } }))} className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" />
                      </>
                    )}
                    {(form.fieldType === 'Text (Short)' || form.fieldType === 'Text (Long)') && (
                      <input type="number" placeholder="Max characters" value={form.validationRules.maxLength} onChange={e => setForm(f => ({ ...f, validationRules: { ...f.validationRules, maxLength: e.target.value } }))} className="col-span-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none" />
                    )}
                  </div>
                </div>
              )}

              {/* Conditional Logic */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Conditional Logic</label>
                <div className="space-y-2">
                  <AutocompleteSelect
                    options={[
                      { value: '', label: 'Always visible' },
                      ...fields.filter(f => f._id !== editingField?._id).map(f => ({ value: f.fieldName, label: `${f.fieldLabel} (${f.fieldName})` }))
                    ]}
                    value={form.conditionalLogic.dependsOnField}
                    onChange={v => setForm(f => ({ ...f, conditionalLogic: { ...f.conditionalLogic, dependsOnField: v } }))}
                    placeholder="Always visible"
                    allowClear={true}
                  />
                  {form.conditionalLogic.dependsOnField && (
                    <input
                      type="text"
                      placeholder="Show when value equals..."
                      value={form.conditionalLogic.requiredValue}
                      onChange={e => setForm(f => ({ ...f, conditionalLogic: { ...f.conditionalLogic, requiredValue: e.target.value } }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Visible to Roles */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Visible To Roles <span className="text-slate-400 font-medium normal-case">(empty = all roles)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map(role => (
                    <button
                      key={role.code} type="button"
                      onClick={() => toggleVisibleRole(role.code)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        form.visibleToRoles.includes(role.code)
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-brand-300'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Editable by Roles */}
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                  Editable By Roles <span className="text-slate-400 font-medium normal-case">(empty = everyone)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableRoles.map(role => (
                    <button
                      key={role.code} type="button"
                      onClick={() => toggleEditableRole(role.code)}
                      className={`px-3 py-1 rounded-full text-xs font-bold border transition-all ${
                        form.editableByRoles?.includes(role.code)
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Required toggle */}
              <div className="flex items-center justify-between py-3 border-t border-slate-100">
                <div>
                  <p className="text-sm font-bold text-slate-700">Required Field</p>
                  <p className="text-xs text-slate-500">Form cannot be submitted without this value</p>
                </div>
                <div
                  onClick={() => setForm(f => ({ ...f, isRequired: !f.isRequired }))}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 cursor-pointer ${form.isRequired ? 'bg-brand-600' : 'bg-slate-300'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${form.isRequired ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </div>

            </form>

            {/* Panel Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex gap-3">
              <button type="button" onClick={() => setShowPanel(false)} className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-100 transition-colors">
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={saving || !form.fieldLabel || !form.fieldType}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingField ? 'Update Field' : 'Create Field'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FieldBuilder;
