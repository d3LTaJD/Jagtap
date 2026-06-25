import React, { useState, useEffect } from 'react';
import { 
  Shield, PlusCircle, Trash2, Pencil, Copy, Save, 
  X, Loader2, CheckCircle2, AlertTriangle, UserCircle2 
} from 'lucide-react';
import api from '../api/client';
import { getRoleCode } from '../context/AbilityContext';
import AutocompleteSelect from '../components/AutocompleteSelect';

const DEPARTMENTS = ['Sales', 'Design', 'QC', 'Purchase', 'Accounts', 'Production', 'Management', 'Admin'];

const MODULES = [
  { id: 'Enquiry', label: 'Enquiries' },
  { id: 'Quotation', label: 'Quotations' },
  { id: 'QAP', label: 'QAP Documents' },
  { id: 'Inventory', label: 'Inventory (WIP)' },
  { id: 'Customers', label: 'Customers' },
  { id: 'Products', label: 'Products' },
  { id: 'Admin', label: 'Admin Settings' }
];

const ACTIONS = [
  { id: 'view', label: 'View' },
  { id: 'create', label: 'Create' },
  { id: 'edit', label: 'Edit' },
  { id: 'delete', label: 'Delete' },
  { id: 'approve', label: 'Approve' },
  { id: 'assign', label: 'Assign' }
];

const defaultRoleForm = {
  name: '',
  code: '',
  description: '',
  department: 'Sales',
  permissions: {}
};

const RoleBuilder = () => {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(defaultRoleForm);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await api.get('/roles');
      setRoles(res.data.data.roles);
    } catch (err) {
      showToast('Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRoles(); }, []);

  const openAdd = () => {
    setEditingRole(null);
    setForm({ ...defaultRoleForm, permissions: {} });
    setShowPanel(true);
  };

  const openEdit = (role) => {
    setEditingRole(role);
    setForm({
      name: role.name,
      code: role.code,
      description: role.description || '',
      department: role.department || 'Sales',
      permissions: role.permissions || {}
    });
    setShowPanel(true);
  };

  const openClone = (role) => {
    setEditingRole(null); // It's a new role
    setForm({
      name: `${role.name} (Copy)`,
      code: `${role.code}_COPY`,
      description: role.description || '',
      department: role.department || 'Sales',
      permissions: JSON.parse(JSON.stringify(role.permissions || {}))
    });
    setShowPanel(true);
    showToast('Role settings cloned. Ready to save as new.', 'success');
  };

  const handleNameChange = (val) => {
    if (!editingRole) {
      // Auto-generate code for new roles
      const code = val.toUpperCase().replace(/[^A-Z0-9]/g, '_');
      setForm(f => ({ ...f, name: val, code }));
    } else {
      setForm(f => ({ ...f, name: val }));
    }
  };

  const togglePermission = (modId, actId) => {
    setForm(f => {
      const currentMod = f.permissions[modId] || {};
      const currentValue = currentMod[actId] || false;
      return {
        ...f,
        permissions: {
          ...f.permissions,
          [modId]: {
            ...currentMod,
            [actId]: !currentValue
          }
        }
      };
    });
  };

  const toggleModuleAll = (modId, isAllChecked) => {
    setForm(f => {
      const newMod = {};
      ACTIONS.forEach(act => { newMod[act.id] = !isAllChecked; });
      return {
        ...f,
        permissions: { ...f.permissions, [modId]: newMod }
      };
    });
  };

  const isModuleAllChecked = (modId) => {
    const modPerms = form.permissions[modId] || {};
    return ACTIONS.every(act => modPerms[act.id] === true);
  };

  const submitForm = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingRole) {
        await api.patch(`/roles/${editingRole._id}`, form);
        showToast('Role updated successfully!');
      } else {
        await api.post('/roles', form);
        showToast('New role created!');
      }
      setShowPanel(false);
      fetchRoles();
    } catch (err) {
      showToast(err.response?.data?.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role) => {
    if (!confirm(`Are you sure you want to delete the role "${role.name}"?\nUsers assigned this role will lose their permissions.`)) return;
    try {
      await api.delete(`/roles/${role._id}`);
      showToast('Role deleted successfully');
      fetchRoles();
    } catch (err) {
      showToast(err.response?.data?.message || 'Delete failed', 'error');
    }
  };

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
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
            <Shield className="w-6 h-6 text-brand-600" /> Role Builder
          </h1>
          <p className="text-sm text-slate-500 mt-1">Manage dynamic roles and their granular access permissions.</p>
        </div>
        <button onClick={openAdd} className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm shadow-brand-500/25">
          <PlusCircle className="w-4 h-4" /> Create Role
        </button>
      </div>

      {/* Role Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-brand-500" />
        </div>
      ) : roles.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 py-16 text-center">
          <Shield className="w-12 h-12 text-slate-200 mx-auto mb-4" />
          <p className="text-base font-bold text-slate-700">No roles defined</p>
          <p className="text-sm text-slate-500 mt-1 mb-6">Create the first dynamic role to get started.</p>
          <button onClick={openAdd} className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl text-sm font-bold">
            <PlusCircle className="w-4 h-4" /> Create Role
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roles.map(role => (
            <div key={role._id} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-50 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110" />
              
              <div className="flex justify-between items-start mb-4">
                <div className="p-2.5 bg-slate-50 text-brand-600 rounded-xl">
                  <UserCircle2 className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openClone(role)} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="Clone Role">
                    <Copy className="w-4 h-4" />
                  </button>
                  <button onClick={() => openEdit(role)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg" title="Edit Role">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {getRoleCode(role.code) !== 'SA' && (
                    <button onClick={() => handleDelete(role)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Delete Role">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">{role.name}</h3>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] font-mono font-black text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">{role.code}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 bg-brand-50 px-2 py-0.5 rounded-md">{role.department}</span>
                </div>
              </div>

              <p className="text-sm text-slate-500 mt-4 line-clamp-2 min-h-[40px]">
                {role.description || 'No description provided.'}
              </p>

            </div>
          ))}
        </div>
      )}

      {/* Slide-in Panel (Wide for Matrix) */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setShowPanel(false)} />
          <div className="relative w-full max-w-4xl h-full bg-slate-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 bg-white">
              <h2 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-500" />
                {editingRole ? `Edit Role: ${editingRole.name}` : 'Create New Role'}
              </h2>
              <button onClick={() => setShowPanel(false)} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={submitForm} className="flex-1 overflow-y-auto p-6 space-y-8">
              
              {/* Basic Info Section */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Basic Details</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Role Name *</label>
                    <input
                      type="text" required value={form.name} autoFocus
                      onChange={e => handleNameChange(e.target.value)}
                      placeholder="e.g. Regional Sales Manager"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">System Code *</label>
                    <input
                      type="text" required value={form.code}
                      onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }))}
                      placeholder="e.g. RS_MANAGER"
                      readOnly={!!editingRole && getRoleCode(editingRole.code) === 'SA'}
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none ${!!editingRole && getRoleCode(editingRole.code) === 'SA' ? 'opacity-60 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Department</label>
                    <AutocompleteSelect
                      options={DEPARTMENTS}
                      value={form.department}
                      onChange={v => setForm(f => ({ ...f, department: v }))}
                      placeholder="Select department..."
                      allowClear={false}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Description</label>
                    <input
                      type="text" value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Brief description of this role's duties"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Advanced Permission Matrix */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Permission Matrix</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Toggle precise actions across system modules.</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr>
                        <th className="px-5 py-3 border-b border-r border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest font-black text-slate-400 w-1/4">Module</th>
                        {ACTIONS.map(act => (
                          <th key={act.id} className="px-3 py-3 border-b border-slate-100 bg-slate-50 text-[10px] uppercase tracking-widest font-black text-slate-400 text-center w-[12%]">
                            {act.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {MODULES.map(mod => {
                        const allChecked = isModuleAllChecked(mod.id);
                        return (
                          <tr key={mod.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-5 py-3 border-r border-slate-100">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-700">{mod.label}</span>
                                <button
                                  type="button"
                                  onClick={() => toggleModuleAll(mod.id, allChecked)}
                                  className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${allChecked ? 'bg-brand-100 text-brand-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                >
                                  {allChecked ? 'NONE' : 'ALL'}
                                </button>
                              </div>
                            </td>
                            {ACTIONS.map(act => {
                              const isChecked = form.permissions[mod.id]?.[act.id] || false;
                              return (
                                <td key={act.id} className="px-3 py-3 text-center">
                                  <label className="inline-flex items-center justify-center cursor-pointer p-2 rounded-full hover:bg-slate-100 transition-colors group">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => togglePermission(mod.id, act.id)}
                                      className="sr-only"
                                    />
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
                                      isChecked 
                                        ? 'bg-brand-600 border-brand-600 text-white' 
                                        : 'bg-white border-slate-300 text-transparent group-hover:border-brand-400'
                                    }`}>
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </div>
                                  </label>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </form>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-200 bg-white flex justify-end gap-3">
              <button type="button" onClick={() => setShowPanel(false)} className="px-5 py-2.5 border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={submitForm}
                disabled={saving || !form.name || !form.code}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingRole ? 'Update Role' : 'Create Role'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default RoleBuilder;
