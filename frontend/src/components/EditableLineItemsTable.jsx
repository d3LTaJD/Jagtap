import React, { useState, useEffect } from 'react';
import { Tag, Plus, Trash2, Save, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import api from '../api/client';

export default function EditableLineItemsTable({ enquiryId, initialProducts = [], productCategory = 'Valves', onSaveSuccess }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [masterDataOptions, setMasterDataOptions] = useState({
    valveTypes: ['Ball Valve', 'Gate Valve', 'Globe Valve', 'Check Valve', 'Butterfly Valve', 'Plug Valve', 'Control Valve', 'Needle Valve', 'Safety Valve'],
    sizes: ['15 mm', '20 mm', '25 mm', '32 mm', '40 mm', '50 mm', '65 mm', '80 mm', '100 mm', '125 mm', '150 mm', '200 mm', '250 mm', '300 mm', '350 mm', '400 mm', '450 mm', '500 mm', '600 mm', '700 mm', '800 mm', '900 mm', '1000 mm'],
    classes: ['150#', '300#', '600#', '800#', '900#', '1500#', '2500#'],
    endConnections: ['Flanged', 'Butt Weld', 'Socket Weld', 'NPT Threaded', 'Ring Type Joint', 'Raised Face', 'Flat Face', 'Wafer', 'Lug'],
    materials: ['ASTM A216 WCB', 'ASTM A105', 'SS316', 'SS316L', 'SS304', 'SS304L', 'ASTM A350 LF2', 'ASTM A352 LCB', 'ASTM A182 F316', 'Duplex F51 (UNS S31803)', 'Super Duplex F53 (UNS S32750)', 'Cast Iron', 'Ductile Iron'],
    standards: ['API 6D', 'API 600', 'API 602', 'API 608', 'ASME B16.34', 'BS 5351', 'EN 12516', 'IS 14846', 'IBR'],
    categories: ['Valves', 'Actuators', 'Fittings', 'Flanges', 'Pipes', 'Instrumentation']
  });

  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    setProducts(initialProducts || []);
  }, [initialProducts]);

  // Fetch options dynamically from Master Data & Fields API
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [masterRes, fieldRes] = await Promise.all([
          api.get('/master-data').catch(() => null),
          api.get('/fields').catch(() => null)
        ]);

        if (masterRes?.data?.data?.categories && Array.isArray(masterRes.data.data.categories)) {
          const categories = masterRes.data.data.categories;

          const getCategoryItems = (catName) => {
            const cat = categories.find(c => c.name?.toLowerCase().includes(catName.toLowerCase()));
            if (cat && Array.isArray(cat.items) && cat.items.length > 0) {
              return cat.items.map(i => i.value || i.label).filter(Boolean);
            }
            return [];
          };

          const vTypes = getCategoryItems('Valve');
          const mats = getCategoryItems('Material');
          const conns = getCategoryItems('End');
          const stds = getCategoryItems('Standard');

          setMasterDataOptions(prev => ({
            ...prev,
            valveTypes: vTypes.length ? vTypes : prev.valveTypes,
            materials: mats.length ? mats : prev.materials,
            endConnections: conns.length ? conns : prev.endConnections,
            standards: stds.length ? stds : prev.standards
          }));
        }

        if (fieldRes?.data?.data?.fields && Array.isArray(fieldRes.data.data.fields)) {
          const fields = fieldRes.data.data.fields;
          const valveTypeField = fields.find(f => f.fieldName === 'valve_type');
          if (valveTypeField && Array.isArray(valveTypeField.options) && valveTypeField.options.length > 0) {
            setMasterDataOptions(prev => ({
              ...prev,
              valveTypes: valveTypeField.options
            }));
          }
        }
      } catch (err) {
        console.warn('[EditableLineItemsTable] MasterData fetch warning:', err.message);
      }
    };
    fetchMasterData();
  }, []);

  const getDynVal = (prod, key) => {
    const val = prod.dynamicFields?.[key];
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'object' && val !== null) {
      if (val.canonicalValue !== undefined && val.canonicalValue !== null) return val.canonicalValue;
      if (val.normalizedValue !== undefined && val.normalizedValue !== null) return val.normalizedValue;
      if (val.value !== undefined && val.value !== null) return val.value;
      return '';
    }
    return String(val);
  };

  const updateProductField = (index, fieldName, newValue) => {
    const updated = [...products];
    const item = { ...updated[index] };

    if (['description', 'quantity', 'unit', 'category', 'standardCode'].includes(fieldName)) {
      item[fieldName] = newValue;
    } else {
      if (!item.dynamicFields) item.dynamicFields = {};
      item.dynamicFields = {
        ...item.dynamicFields,
        [fieldName]: newValue || null
      };
    }

    updated[index] = item;
    setProducts(updated);
    setIsDirty(true);
  };

  const addRow = () => {
    setProducts([
      ...products,
      {
        description: '',
        quantity: 1,
        unit: 'NOS',
        category: productCategory || 'Valves',
        standardCode: '',
        dynamicFields: {
          valve_type: null,
          valve_size: null,
          valve_class: null,
          valve_end_connection: null,
          valve_moc_body: null
        }
      }
    ]);
    setIsDirty(true);
  };

  const deleteRow = (index) => {
    const updated = products.filter((_, idx) => idx !== index);
    setProducts(updated);
    setIsDirty(true);
  };

  const saveLineItems = async () => {
    if (!enquiryId) return;
    setSaving(true);
    try {
      const res = await api.patch(`/enquiries/${enquiryId}/products`, { products });
      if (res.data?.status === 'success') {
        setIsDirty(false);
        setToast({ msg: 'Line items updated successfully!', type: 'success' });
        if (onSaveSuccess) onSaveSuccess(res.data.data.enquiry);
      }
    } catch (err) {
      console.error('[EditableLineItemsTable] Save error:', err);
      setToast({ msg: err.response?.data?.message || 'Failed to save line items', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl text-sm font-bold animate-in slide-in-from-top-2 ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
        }`}>
          {toast.type === 'error' ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}

      {/* Header with dirty indicator and Save button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
        <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Tag className="w-5 h-5 text-brand-500" />
          Line Items ({products.length})
          <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Total Rows Extracted: {products.length}/{products.length}
          </span>
          {isDirty && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 animate-pulse">
              Unsaved Changes
            </span>
          )}
        </h2>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Line Item
          </button>

          <button
            type="button"
            onClick={saveLineItems}
            disabled={saving || !isDirty}
            className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm ${
              isDirty
                ? 'bg-brand-600 hover:bg-brand-700 text-white shadow-brand-500/20'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Line Items
          </button>
        </div>
      </div>

      {/* Spreadsheet-like Line Item Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
              <th className="py-2.5 px-2 w-10 text-center">#</th>
              <th className="py-2.5 px-3 min-w-[220px]">Description</th>
              <th className="py-2.5 px-3 min-w-[130px]">Valve Type</th>
              <th className="py-2.5 px-3 min-w-[100px]">Size</th>
              <th className="py-2.5 px-3 min-w-[100px]">Class</th>
              <th className="py-2.5 px-3 min-w-[130px]">End Connection</th>
              <th className="py-2.5 px-3 min-w-[140px]">MOC</th>
              <th className="py-2.5 px-3 min-w-[110px]">Category</th>
              <th className="py-2.5 px-3 min-w-[80px]">Qty</th>
              <th className="py-2.5 px-3 min-w-[110px]">Standard</th>
              <th className="py-2.5 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((prod, idx) => {
              const valveType = getDynVal(prod, 'valve_type');
              const size = getDynVal(prod, 'valve_size') || getDynVal(prod, 'size');
              const pClass = getDynVal(prod, 'valve_class') || getDynVal(prod, 'class') || getDynVal(prod, 'pressure_class');
              const endConn = getDynVal(prod, 'valve_end_connection') || getDynVal(prod, 'end_connection') || getDynVal(prod, 'endConnection') || getDynVal(prod, 'valve_ends');
              const moc = getDynVal(prod, 'valve_moc_body') || getDynVal(prod, 'material') || getDynVal(prod, 'moc') || getDynVal(prod, 'shellMaterial') || getDynVal(prod, 'materialGrade');

              return (
                <tr key={prod._id || idx} className="hover:bg-slate-50/80 transition-colors">
                  {/* Row # */}
                  <td className="py-2 px-2 font-bold text-slate-400 text-center">{idx + 1}</td>

                  {/* Description Input & Normalized Attribute Chips */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={prod.description || ''}
                      placeholder="Enter product description..."
                      onChange={(e) => updateProductField(idx, 'description', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    />
                    <div className="flex flex-wrap items-center gap-1 mt-1">
                      {valveType && <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">Type: {valveType}</span>}
                      {size && <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">Size: {size}</span>}
                      {pClass && <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-100">Class: {pClass}</span>}
                      {endConn && <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">End: {endConn}</span>}
                      {moc && <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono">MOC: {moc}</span>}
                    </div>
                  </td>

                  {/* Valve Type Dropdown + Provenance Badge */}
                  <td className="py-2 px-2">
                    <select
                      value={valveType}
                      onChange={(e) => updateProductField(idx, 'valve_type', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(blank)</option>
                      {masterDataOptions.valveTypes.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {prod.fieldConfidences?.valve_type && (
                      <div className="flex items-center gap-1 text-[9px] font-bold mt-0.5">
                        <span className={prod.fieldConfidences.valve_type.source === 'REGEX' ? 'text-emerald-600 font-extrabold' : 'text-blue-600'}>
                          {prod.fieldConfidences.valve_type.confidence}% [{prod.fieldConfidences.valve_type.source}]
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Size Dropdown / Input + Provenance Badge */}
                  <td className="py-2 px-2">
                    <select
                      value={size}
                      onChange={(e) => updateProductField(idx, 'valve_size', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(blank)</option>
                      {masterDataOptions.sizes.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {prod.fieldConfidences?.valve_size && (
                      <div className="flex items-center gap-1 text-[9px] font-bold mt-0.5">
                        <span className={prod.fieldConfidences.valve_size.source === 'REGEX' ? 'text-emerald-600 font-extrabold' : 'text-blue-600'}>
                          {prod.fieldConfidences.valve_size.confidence}% [{prod.fieldConfidences.valve_size.source}]
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Class Dropdown + Provenance Badge */}
                  <td className="py-2 px-2">
                    <select
                      value={pClass}
                      onChange={(e) => updateProductField(idx, 'valve_class', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(blank)</option>
                      {masterDataOptions.classes.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    {prod.fieldConfidences?.valve_class && (
                      <div className="flex items-center gap-1 text-[9px] font-bold mt-0.5">
                        <span className={prod.fieldConfidences.valve_class.source === 'REGEX' ? 'text-emerald-600 font-extrabold' : 'text-blue-600'}>
                          {prod.fieldConfidences.valve_class.confidence}% [{prod.fieldConfidences.valve_class.source}]
                        </span>
                      </div>
                    )}
                  </td>

                  {/* End Connection Dropdown */}
                  <td className="py-2 px-2">
                    <select
                      value={endConn}
                      onChange={(e) => updateProductField(idx, 'valve_end_connection', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(blank)</option>
                      {masterDataOptions.endConnections.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* MOC Dropdown */}
                  <td className="py-2 px-2">
                    <select
                      value={moc}
                      onChange={(e) => updateProductField(idx, 'valve_moc_body', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(blank)</option>
                      {masterDataOptions.materials.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* Category Dropdown */}
                  <td className="py-2 px-2">
                    <select
                      value={prod.category || productCategory || 'Valves'}
                      onChange={(e) => updateProductField(idx, 'category', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-700 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      {masterDataOptions.categories.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* Qty Input */}
                  <td className="py-2 px-2">
                    <input
                      type="number"
                      min="1"
                      value={prod.quantity || 1}
                      onChange={(e) => updateProductField(idx, 'quantity', parseInt(e.target.value, 10) || 1)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-black text-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-center"
                    />
                  </td>

                  {/* Standard Input */}
                  <td className="py-2 px-2">
                    <input
                      type="text"
                      value={prod.standardCode || ''}
                      placeholder="e.g. API 6D"
                      onChange={(e) => updateProductField(idx, 'standardCode', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    />
                  </td>

                  {/* Delete Button */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => deleteRow(idx)}
                      title="Delete line item"
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
