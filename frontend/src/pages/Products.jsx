import React, { useState, useEffect } from 'react';
import { Search, Plus, Loader2, Edit3, Trash2, X, AlertCircle } from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';
import DynamicFormRenderer from '../components/DynamicFormRenderer';
import { useAbility } from '../context/AbilityContext';

const Products = () => {
  const ability = useAbility();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    name: '', code: '', category: '', type: '', description: '', unit: 'NOS', basePrice: 0, status: 'Active', dynamicFields: {}
  });

  const fetchProducts = async () => {
    try {
      const res = await api.get(`/products?search=${searchTerm}`);
      setProducts(res.data.data.products);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchProducts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const openModal = (product = null) => {
    setError('');
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || '',
        code: product.code || '',
        category: product.category || '',
        type: product.type || '',
        description: product.description || '',
        unit: product.unit || 'NOS',
        basePrice: product.basePrice || 0,
        status: product.status || 'Active',
        dynamicFields: product.dynamicFields || {}
      });
    } else {
      setEditingProduct(null);
      setFormData({ name: '', code: '', category: '', type: '', description: '', unit: 'NOS', basePrice: 0, status: 'Active', dynamicFields: {} });
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true); setError('');
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct._id}`, formData);
      } else {
        await api.post('/products', formData);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err) {
      setError(err.response?.data?.message || 'Error saving product');
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/products/${id}`);
      fetchProducts();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Product Catalog</h1>
          <p className="text-sm text-slate-500 mt-1">Manage standard products, pricing, and specs.</p>
        </div>
        {ability.can('create', 'Products') && (
          <button onClick={() => openModal()} className="inline-flex items-center px-4 py-2.5 bg-brand-600 text-white text-sm font-bold rounded-xl hover:bg-brand-700 transition-all shadow-sm shadow-brand-500/30">
            <Plus className="w-4 h-4 mr-2" /> Add New Product
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm ring-1 ring-slate-200 flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search products by name or SKU..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all"
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 uppercase tracking-widest text-slate-500 text-[10px] font-black italic">
                <tr>
                  <th className="px-6 py-4">Item Code</th>
                  <th className="px-6 py-4">Product Name</th>
                  <th className="px-6 py-4">Category</th>
                  <th className="px-6 py-4">Base Price</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs text-slate-500">{p.code || '-'}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{p.name}</div>
                      {p.dynamicFields && Object.keys(p.dynamicFields).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 max-w-lg">
                          {Object.entries(p.dynamicFields).map(([k, v]) => {
                            if (!v) return null;
                            const formattedKey = k.replace(/([A-Z])/g, ' $1').toUpperCase();
                            return (
                              <span key={k} className="text-[10px] bg-slate-100 border border-slate-200/60 text-slate-600 px-2 py-0.5 rounded-lg font-bold">
                                {formattedKey}: <span className="font-black text-brand-600">{v}</span>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-xs">{p.category || '-'}</td>
                    <td className="px-6 py-4 font-semibold text-slate-700">₹{p.basePrice?.toLocaleString() || '0'} <span className="text-[10px] text-slate-400">/ {p.unit}</span></td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${p.status === 'Active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {ability.can('edit', 'Products') && (
                        <button onClick={() => openModal(p)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex"><Edit3 className="w-4 h-4" /></button>
                      )}
                      {ability.can('delete', 'Products') && (
                        <button onClick={() => handleDelete(p._id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex"><Trash2 className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
                {products.length === 0 && (
                  <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500 italic">No products found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 bg-slate-50/50 rounded-t-2xl shrink-0">
              <h2 className="text-lg font-black text-slate-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium flex items-center"><AlertCircle className="w-4 h-4 mr-2" />{error}</div>}
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Product Name *</label>
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">SKU / Code</label>
                  <input type="text" value={formData.code} onChange={e => setFormData({...formData, code: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none font-mono" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Unit</label>
                  <AutocompleteSelect 
                    options={['NOS', 'SET', 'MT', 'KG', 'M', 'M2', 'Job']} 
                    value={formData.unit} 
                    onChange={v => setFormData({...formData, unit: v})} 
                    allowClear={false} 
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                  <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Base Price (₹)</label>
                  <input type="number" value={formData.basePrice} onChange={e => setFormData({...formData, basePrice: Number(e.target.value)})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Status</label>
                  <AutocompleteSelect 
                    options={['Active', 'Discontinued', 'In Development']} 
                    value={formData.status} 
                    onChange={v => setFormData({...formData, status: v})} 
                    allowClear={false} 
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 min-h-[80px] outline-none resize-none" />
              </div>

              <hr className="border-slate-100" />

              {/* Dynamic Specifications Area */}
              <div>
                <h3 className="text-xs font-black text-brand-600 uppercase tracking-widest mb-3">Specifications / Master Specs</h3>
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                  <DynamicFormRenderer
                    formContext="Product"
                    values={formData.dynamicFields || {}}
                    onChange={(fieldName, value) => {
                      setFormData(prev => ({
                        ...prev,
                        dynamicFields: { ...prev.dynamicFields, [fieldName]: value }
                      }));
                    }}
                    currentUserRole={JSON.parse(localStorage.getItem('user') || '{}').role}
                  />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-white rounded-b-2xl flex justify-end gap-3 shrink-0">
              <button type="button" onClick={() => setShowModal(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all shadow-sm">Cancel</button>
              <button onClick={handleSubmit} disabled={submitLoading} className="px-6 py-2.5 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 rounded-xl transition-all shadow-lg shadow-brand-500/30 flex items-center">
                {submitLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save Product
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
