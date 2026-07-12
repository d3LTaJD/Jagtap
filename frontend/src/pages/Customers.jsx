import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Loader2, X, Pencil, ShieldAlert, Trash2 } from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';
import ToggleSwitch from '../components/ToggleSwitch';
import { useAbility } from '../context/AbilityContext';

const Customers = () => {
  const ability = useAbility();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '', customerType: 'Private', primaryContactName: '', designation: '',
    mobileNumber: '', alternateMobile: '', emailAddress: '', alternateEmail: '',
    city: '', state: '', country: 'India', gstin: '', pan: '', paymentTerms: '30 days',
    creditLimit: 0, sourceChannel: '', tags: [], notes: '', isActive: true
  });

  const isFormReadOnly = editingCustomer ? !ability.can('edit', 'Customers') : !ability.can('create', 'Customers');

  const fetchCustomers = async (searchQuery = '') => {
    try {
      const res = await api.get(`/customers?search=${searchQuery}`);
      setCustomers(res.data.data.customers);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchCustomers(search);
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [search]);

  const openNew = () => {
    setEditingCustomer(null);
    setFormData({
      companyName: '', customerType: 'Private', primaryContactName: '', designation: '',
      mobileNumber: '', alternateMobile: '', emailAddress: '', alternateEmail: '',
      city: '', state: '', country: 'India', gstin: '', pan: '', paymentTerms: '30 days',
      creditLimit: 0, sourceChannel: '', tags: [], notes: '', isActive: true
    });
    setShowModal(true);
  };

  const openEdit = (c) => {
    setEditingCustomer(c);
    setFormData({
      companyName: c.companyName || '', customerType: c.customerType || 'Private', 
      primaryContactName: c.primaryContactName || '', designation: c.designation || '',
      mobileNumber: c.mobileNumber || '', alternateMobile: c.alternateMobile || '', 
      emailAddress: c.emailAddress || '', alternateEmail: c.alternateEmail || '',
      city: c.city || '', state: c.state || '', country: c.country || 'India', 
      gstin: c.gstin || '', pan: c.pan || '', paymentTerms: c.paymentTerms || '30 days',
      creditLimit: c.creditLimit || 0, sourceChannel: c.sourceChannel || '',
      tags: c.tags || [], notes: c.notes || '', isActive: c.isActive !== false
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      if (editingCustomer) {
        await api.patch(`/customers/${editingCustomer._id}`, formData);
      } else {
        await api.post('/customers', formData);
      }
      setShowModal(false);
      fetchCustomers(search);
    } catch(err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error saving customer');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (e, customer) => {
    e.stopPropagation();
    if (!window.confirm(`Are you sure you want to delete "${customer.companyName}"? This action cannot be undone.`)) return;
    try {
      await api.delete(`/customers/${customer._id}`);
      fetchCustomers(search);
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || 'Error deleting customer');
    }
  };

  if (loading && !customers.length) return <div className="p-8 flex justify-center min-h-[60vh] items-center"><Loader2 className="animate-spin w-8 h-8 text-brand-600" /></div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer Master</h1>
          <p className="text-sm text-slate-500 mt-1">Manage global database of clients and contacts.</p>
        </div>
        {ability.can('create', 'Customers') && (
          <button onClick={openNew} className="inline-flex items-center px-4 py-2 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-sm shadow-brand-500/30">
            <UserPlus className="w-4 h-4 mr-2" /> Add Customer
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm ring-1 ring-slate-200 flex items-center mb-6">
        <Search className="w-5 h-5 text-slate-400 mr-2" />
        <input 
          type="text" 
          placeholder="Search by company name..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-transparent border-none focus:ring-0 text-sm p-0"
        />
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 uppercase tracking-widest text-slate-500 text-[10px] font-black italic">
              <tr>
                <th className="px-6 py-4">ID</th>
                <th className="px-6 py-4">Company</th>
                <th className="px-6 py-4">Contact</th>
                <th className="px-6 py-4">GSTIN</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {customers.map((c) => (
                <tr key={c._id} onClick={() => openEdit(c)} className="hover:bg-slate-50 transition-colors cursor-pointer group">
                  <td className="px-6 py-4 font-mono text-xs font-bold text-slate-500">{c.customerId || '—'}</td>
                  <td className="px-6 py-4 font-bold text-slate-900">{c.companyName}</td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{c.primaryContactName}</div>
                    <div className="text-[10px] text-slate-500">{c.mobileNumber}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-slate-600">{c.gstin || '—'}</td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{c.customerType || '—'}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-md ${c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {ability.can('edit', 'Customers') && (
                        <button onClick={(e) => { e.stopPropagation(); openEdit(c); }} className="text-slate-400 hover:text-brand-600 p-1.5 hover:bg-brand-50 rounded-lg transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                      )}
                      {ability.can('delete', 'Customers') && (
                        <button onClick={(e) => handleDelete(e, c)} className="text-slate-400 hover:text-red-600 p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && !loading && (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-slate-500 italic">No customers found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-900">
                {editingCustomer ? 'Edit Customer' : 'Create New Customer'}
              </h2>
              <button 
                onClick={() => setShowModal(false)} 
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <form id="customer-form" onSubmit={handleSubmit} className="space-y-6">
                
                {/* --- Company Information --- */}
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100">Company Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Company / Organisation Name *</label>
                    <input type="text" required disabled={isFormReadOnly} value={formData.companyName} onChange={e => setFormData({...formData, companyName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Acme Corp" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Customer Type *</label>
                    <AutocompleteSelect
                      disabled={isFormReadOnly}
                      options={['Government', 'Private', 'Export', 'Trader', 'EPC', 'End User']}
                      value={formData.customerType}
                      onChange={v => setFormData({...formData, customerType: v})}
                      placeholder="Select type..."
                      allowClear={false}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Source Channel *</label>
                    <AutocompleteSelect
                      disabled={isFormReadOnly}
                      options={['IndiaMart', 'OEM', 'Exhibition', 'Reference', 'Email', 'Cold Call', 'Walk-in']}
                      value={formData.sourceChannel}
                      onChange={v => setFormData({...formData, sourceChannel: v})}
                      placeholder="How did you find them?"
                      allowClear={true}
                    />
                  </div>
                </div>

                {/* --- Contact Details --- */}
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mt-6">Contact Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Primary Contact Name *</label>
                    <input type="text" required disabled={isFormReadOnly} value={formData.primaryContactName} onChange={e => setFormData({...formData, primaryContactName: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
                    <input type="text" disabled={isFormReadOnly} value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Purchase Manager" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mobile Number *</label>
                    <input type="text" required disabled={isFormReadOnly} value={formData.mobileNumber} onChange={e => setFormData({...formData, mobileNumber: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="9876543210" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Alternate Mobile</label>
                    <input type="text" disabled={isFormReadOnly} value={formData.alternateMobile} onChange={e => setFormData({...formData, alternateMobile: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="Optional" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                    <input type="email" disabled={isFormReadOnly} value={formData.emailAddress} onChange={e => setFormData({...formData, emailAddress: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="john@acme.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Alternate Email</label>
                    <input type="email" disabled={isFormReadOnly} value={formData.alternateEmail} onChange={e => setFormData({...formData, alternateEmail: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="backup@acme.com" />
                  </div>
                </div>

                {/* --- Address & Tax --- */}
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mt-6">Address & Tax</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>
                    <input type="text" disabled={isFormReadOnly} placeholder=" " value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>
                    <AutocompleteSelect
                      disabled={isFormReadOnly}
                      options={['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Chandigarh','Delhi','Jammu & Kashmir','Ladakh','Puducherry']}
                      value={formData.state}
                      onChange={v => setFormData({...formData, state: v})}
                      placeholder="Select state..."
                      allowClear={true}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>
                    <input type="text" disabled={isFormReadOnly} placeholder=" " value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">GSTIN <span className="text-slate-400 font-normal">(15-char)</span></label>
                    <input type="text" maxLength={15} disabled={isFormReadOnly} value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="27AAACR5055K1ZN" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">PAN <span className="text-slate-400 font-normal">(10-char)</span></label>
                    <input type="text" maxLength={10} disabled={isFormReadOnly} value={formData.pan} onChange={e => setFormData({...formData, pan: e.target.value.toUpperCase()})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="AAACR5055K" />
                  </div>
                </div>

                {/* --- Commercial --- */}
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mt-6">Commercial</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Payment Terms (Default)</label>
                    <AutocompleteSelect
                      disabled={isFormReadOnly}
                      options={['Advance', '30 days', '45 days', '60 days', 'LC', 'Against Delivery']}
                      value={formData.paymentTerms}
                      onChange={v => setFormData({...formData, paymentTerms: v})}
                      placeholder="Select terms..."
                      allowClear={false}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Credit Limit (INR)</label>
                    <input type="number" disabled={isFormReadOnly} value={formData.creditLimit} onChange={e => setFormData({...formData, creditLimit: Number(e.target.value)})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500" placeholder="0" />
                  </div>
                </div>

                {/* --- Tags & Notes --- */}
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100 mt-6">Tags & Notes</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tags <span className="text-slate-400 font-normal">(for CRM filtering)</span></label>
                    <AutocompleteSelect
                      disabled={isFormReadOnly}
                      options={['Hot', 'Strategic', 'Government', 'Export', 'Key Account', 'New Lead']}
                      value={formData.tags?.[0] || ''}
                      onChange={v => {
                        const current = formData.tags || [];
                        if (v && !current.includes(v)) setFormData({...formData, tags: [...current, v]});
                      }}
                      placeholder="Add tags..."
                      allowClear={true}
                    />
                    {formData.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {formData.tags.map(tag => (
                          <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-50 text-brand-700 text-xs font-bold rounded-md border border-brand-200">
                            {tag}
                            {!isFormReadOnly && <button type="button" onClick={() => setFormData({...formData, tags: formData.tags.filter(t => t !== tag)})} className="text-brand-400 hover:text-red-500">&times;</button>}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Internal Notes</label>
                    <textarea rows={3} disabled={isFormReadOnly} value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 resize-none" placeholder="Internal notes only..." />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 mt-4">
                  <span className="text-sm font-medium text-slate-700">Account Status</span>
                  <ToggleSwitch checked={formData.isActive} disabled={isFormReadOnly} onChange={v => setFormData({...formData, isActive: v})} label="Account is Active" />
                </div>
              </form>
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between">
              <div>
                {editingCustomer && ability.can('delete', 'Customers') && (
                  <button 
                    type="button" 
                    onClick={(e) => { handleDelete(e, editingCustomer); setShowModal(false); }} 
                    className="px-4 py-2.5 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-xl transition-colors shadow-sm flex items-center gap-1.5"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shadow-sm">Cancel</button>
                {!isFormReadOnly && (
                  <button type="submit" form="customer-form" disabled={submitLoading} className="px-5 py-2.5 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center">
                    {submitLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Customer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
