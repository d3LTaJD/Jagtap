import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Loader2, AlertCircle, ShieldCheck, History, X, Clock, Trash2 } from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';
import { useAbility } from '../context/AbilityContext';

const ActivityLogModal = ({ user, onClose }) => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get(`/admin/users/${user._id}/logs`);
        setLogs(res.data.data.logs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [user._id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Activity Log</h2>
            <p className="text-xs text-slate-500 font-medium">{user.name} ({user.role})</p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin w-6 h-6 text-brand-600" /></div>
          ) : logs.length === 0 ? (
            <p className="text-center py-12 text-slate-400 italic">No activity recorded yet.</p>
          ) : (
            <div className="space-y-6">
              {logs.map((log, idx) => (
                <div key={idx} className="flex gap-4 relative">
                  {idx !== logs.length - 1 && <div className="absolute left-[15px] top-8 bottom-[-24px] w-px bg-slate-100"></div>}
                  <div className="mt-1 w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0 relative z-10">
                    <Clock className="w-4 h-4 text-slate-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-black text-brand-600 uppercase tracking-widest">{log.action}</span>
                      <span className="text-[10px] text-slate-400 font-bold">• {new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-slate-700 font-medium">{log.details}</p>
                    <span className="inline-block mt-2 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">{log.module}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Close</button>
        </div>
      </div>
    </div>
  );
};

const AdminUsers = () => {
  const ability = useAbility();
  const canWrite = ability.can('userManageWrite', 'Admin');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [resetLoading, setResetLoading] = useState(null);
  const [selectedUserForLogs, setSelectedUserForLogs] = useState(null);
  const [formData, setFormData] = useState({
    name: '', displayName: '', mobile_number: '', email: '',
    role: '', secondaryRole: '', department: ''
  });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [availableRoles, setAvailableRoles] = useState([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.data.users);
    } catch (err) {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    // Fetch dynamic roles
    api.get('/roles').then(res => {
      const roles = res.data.data.roles;
      setAvailableRoles(roles);
      if (roles.length > 0) {
        setFormData(f => ({ ...f, role: roles[0].code }));
      }
    }).catch(() => {}).finally(() => setRolesLoading(false));
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      await api.post('/admin/users', formData);
      setSuccessMsg('User created successfully and OTP/Invite generated.');
    setFormData({
        name: '', displayName: '', mobile_number: '', email: '',
        role: 'SALES', secondaryRole: '', department: ''
      });
      setShowCreate(false);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating user');
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (id) => {
    try {
      await api.patch(`/admin/users/${id}`);
      fetchUsers();
    } catch (err) {}
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccessMsg('');
    try {
      await api.put(`/admin/users/${editingUser._id}`, {
        name: editingUser.name,
        displayName: editingUser.displayName,
        email: editingUser.email,
        department: editingUser.department,
        role: editingUser.role,
        secondaryRole: editingUser.secondaryRole
      });
      setSuccessMsg('User details updated successfully.');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating user');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Are you sure you want to generate a new password reset link for ${user.name}?`)) return;
    setResetLoading(user._id); setError(''); setSuccessMsg('');
    try {
      const res = await api.post(`/admin/users/${user._id}/reset-password`);
      setSuccessMsg(`Reset link generated for ${user.name}: ${res.data.data.token}`); // Showing token for dev mode
    } catch (err) {
      setError(err.response?.data?.message || 'Error generating reset link');
    } finally {
      setResetLoading(null);
    }
  };

  const handleDeleteUser = async (user) => {
    if (!window.confirm(`CRITICAL WARNING: Are you sure you want to PERMANENTLY delete the user "${user.name}"?\n\nThis action cannot be undone.`)) return;
    
    setError(''); setSuccessMsg('');
    try {
      await api.delete(`/admin/users/${user._id}`);
      setSuccessMsg(`User ${user.name} has been permanently deleted.`);
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.message || 'Error deleting user');
    }
  };

  if (loading && !users.length) return <div className="p-8 flex justify-center min-h-[60vh] items-center"><Loader2 className="animate-spin w-8 h-8 text-brand-600" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">Manage system access, roles, and track audit trails.</p>
        </div>
        {canWrite && (
          <button onClick={() => setShowCreate(!showCreate)} className="inline-flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-sm shadow-brand-500/30">
            <UserPlus className="w-4 h-4 mr-2" /> Add New User
          </button>
        )}
      </div>

      {(error || successMsg) && (
        <div className={`p-4 rounded-xl flex items-start text-sm ${error ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          <AlertCircle className="w-5 h-5 mr-3 flex-shrink-0" />
          <p>{error || successMsg}</p>
        </div>
      )}

      {showCreate && (
        <div className="bg-white p-6 rounded-2xl shadow-sm ring-1 ring-slate-200 animate-in slide-in-from-top-4 duration-300">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-brand-600" /> Create New Account
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Ramesh Kumar" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Display Name <span className="text-slate-400 font-normal">(Short — shown in header)</span></label>
              <input type="text" value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Ramesh" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number</label>
              <input type="text" required value={formData.mobile_number} onChange={e => setFormData({...formData, mobile_number: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="9876543210" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="jane@company.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">System Role</label>
              <AutocompleteSelect
                options={rolesLoading ? [{ value: '', label: 'Loading roles...' }] : availableRoles.map(role => ({ value: role.code, label: `${role.name} (${role.code})` }))}
                value={formData.role}
                onChange={v => setFormData({...formData, role: v})}
                placeholder="Select role..."
                allowClear={false}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Secondary Role <span className="text-slate-400 font-normal">(Optional — adds permissions)</span>
              </label>
              <AutocompleteSelect
                options={[{ value: '', label: '— None —' }, ...(!rolesLoading ? availableRoles.filter(r => r.code !== formData.role).map(role => ({ value: role.code, label: `${role.name} (${role.code})` })) : [])]}
                value={formData.secondaryRole}
                onChange={v => setFormData({...formData, secondaryRole: v})}
                placeholder="— None —"
                allowClear={true}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
              <AutocompleteSelect
                options={[{ value: '', label: '— Select Department —' }, ...['Sales','Design','QC','Purchase','Accounts','Production','Management','Admin'].map(d => d)]}
                value={formData.department}
                onChange={v => setFormData({...formData, department: v})}
                placeholder="— Select Department —"
                allowClear={true}
              />
            </div>
            <div className="md:col-span-2 flex items-center justify-end pt-2">
              <div className="space-x-3">
                <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-sm">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-bold text-white bg-brand-600 rounded-lg hover:bg-brand-700 transition-colors shadow-sm">Save & Send 24h OTP</button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 uppercase tracking-widest text-slate-500 text-[10px] font-black italic">
            <tr>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Department</th>
              <th className="px-6 py-4 text-center">Status</th>
              <th className="px-6 py-4">Last Login</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs ring-1 ring-brand-100 mr-3">
                        {user.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{user.name}</div>
                        <div className="text-slate-500 text-[10px] font-medium tracking-tight">
                          <span className="font-mono text-brand-600">{user.userId || '—'}</span> • {user.mobile_number} • {user.email || 'No email'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200 ring-inset uppercase tracking-widest">
                      <Shield className="w-3 h-3 mr-1" /> {user.role}
                    </span>
                    {user.secondaryRole && <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-violet-50 text-violet-600 ring-1 ring-violet-200 ring-inset uppercase">+{user.secondaryRole}</span>}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs text-slate-500 font-medium">{user.department || '—'}</span>
                  </td>
                   <td className="px-6 py-4 text-center">
                    <button 
                      disabled={!canWrite}
                      onClick={() => toggleStatus(user._id)} 
                      className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md transition-colors ${!canWrite ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : user.is_active ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-700 hover:bg-red-100'}`}
                    >
                      {user.is_active ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-xs font-semibold text-slate-500">
                    {user.last_login ? new Date(user.last_login).toLocaleString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canWrite && (
                        <>
                          <button 
                            onClick={() => handleResetPassword(user)}
                            disabled={resetLoading === user._id}
                            title="Force Password Reset"
                            className="inline-flex items-center px-2.5 py-1.5 bg-orange-50 text-orange-600 hover:text-orange-700 hover:bg-orange-100 rounded-lg border border-orange-200 transition-all font-bold text-xs disabled:opacity-50"
                          >
                            {resetLoading === user._id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5 mr-1" />}
                            Reset
                          </button>
                          <button 
                            onClick={() => setEditingUser({...user, secondaryRole: user.secondaryRole || '', displayName: user.displayName || ''})}
                            className="inline-flex items-center px-3 py-1.5 bg-blue-50 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded-lg border border-blue-200 transition-all font-bold text-xs"
                          >
                            Edit
                          </button>
                        </>
                      )}
                      <button 
                        onClick={() => setSelectedUserForLogs(user)}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-50 text-slate-600 hover:text-brand-600 hover:bg-brand-50 rounded-lg border border-slate-200 transition-all font-bold text-xs"
                      >
                        <History className="w-3.5 h-3.5 mr-1.5" />
                        Logs
                      </button>
                      {canWrite && (
                        <button 
                          onClick={() => handleDeleteUser(user)}
                          title="Delete User"
                          className="inline-flex items-center px-2 py-1.5 bg-red-50 text-red-600 hover:text-red-700 hover:bg-red-100 rounded-lg border border-red-200 transition-all font-bold text-xs ml-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500 italic">No users found in the system.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedUserForLogs && (
        <ActivityLogModal user={selectedUserForLogs} onClose={() => setSelectedUserForLogs(null)} />
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">Edit User: {editingUser.name}</h2>
              <button onClick={() => setEditingUser(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {editingUser.userId && (
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">User ID</span>
                  <span className="font-mono text-sm font-bold text-brand-600">{editingUser.userId}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                  <input type="text" required value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Display Name <span className="text-slate-400 font-normal">(Short)</span></label>
                  <input type="text" value={editingUser.displayName || ''} onChange={e => setEditingUser({...editingUser, displayName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email *</label>
                  <input type="email" required value={editingUser.email || ''} onChange={e => setEditingUser({...editingUser, email: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">System Role</label>
                  <AutocompleteSelect
                    options={rolesLoading ? [] : availableRoles.map(role => ({ value: role.code, label: `${role.name} (${role.code})` }))}
                    value={editingUser.role}
                    onChange={v => setEditingUser({...editingUser, role: v})}
                    allowClear={false}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Secondary Role</label>
                  <AutocompleteSelect
                    options={[{ value: '', label: '— None —' }, ...(!rolesLoading ? availableRoles.filter(r => r.code !== editingUser.role).map(role => ({ value: role.code, label: `${role.name} (${role.code})` })) : [])]}
                    value={editingUser.secondaryRole}
                    onChange={v => setEditingUser({...editingUser, secondaryRole: v})}
                    allowClear={true}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                  <AutocompleteSelect
                    options={[{ value: '', label: '— Select Department —' }, ...['Sales','Design','QC','Purchase','Accounts','Production','Management','Admin'].map(d => d)]}
                    value={editingUser.department}
                    onChange={v => setEditingUser({...editingUser, department: v})}
                    allowClear={true}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button type="button" onClick={() => setEditingUser(null)} className="px-4 py-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all">Cancel</button>
                <button type="submit" disabled={loading} className="px-5 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all flex items-center">
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminUsers;
