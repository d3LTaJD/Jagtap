import React, { useState, useEffect } from 'react';
import { 
  Tag, Plus, Trash2, Save, Loader2, CheckCircle2, AlertTriangle, 
  Shield, AlertCircle, RefreshCw, Check
} from 'lucide-react';
import api from '../api/client';

export default function EditableLineItemsTable({ enquiryId, initialProducts = [], productCategory = 'Valves', onSaveSuccess, readOnly = false }) {
  const [products, setProducts] = useState(initialProducts || []);
  const [masterDataOptions, setMasterDataOptions] = useState({
    valveTypes: [
      'Ball Valve', 'Floating Ball Valve', 'Trunnion Mounted Ball Valve',
      'Gate Valve', 'Wedge Gate Valve', 'Knife Gate Valve',
      'Globe Valve', 'Check Valve', 'Swing Check Valve', 'Lift Check Valve', 'Dual Plate Check Valve',
      'Non Return Valve', 'Butterfly Valve', 'Plug Valve', 'Control Valve', 'Needle Valve',
      'Safety Valve', 'Pressure Relief Valve'
    ],
    sizes: ['15 mm', '20 mm', '25 mm', '32 mm', '40 mm', '50 mm', '65 mm', '80 mm', '100 mm', '125 mm', '150 mm', '200 mm', '250 mm', '300 mm', '350 mm', '400 mm', '450 mm', '500 mm', '600 mm', '700 mm', '800 mm', '900 mm', '1000 mm'],
    classes: ['150#', '300#', '600#', '800#', '900#', '1500#', '2500#'],
    endConnections: ['Flanged RF', 'Flanged RTJ', 'Flanged Flat Face', 'Butt Weld', 'Socket Weld', 'NPT Threaded', 'Wafer', 'Lug'],
    materials: ['ASTM A216 WCB', 'ASTM A105', 'SS316', 'SS316L', 'SS304', 'SS304L', 'ASTM A350 LF2', 'ASTM A352 LCB', 'ASTM A182 F316', 'Duplex F51 (UNS S31803)', 'Super Duplex F53 (UNS S32750)', 'Cast Iron', 'Ductile Iron'],
    standards: ['API 6D', 'API 600', 'API 602', 'API 608', 'ASME B16.34', 'BS 1868', 'BS 1873', 'BS 5351', 'BS 5352', 'EN 12516', 'IS 14846', 'API 598'],
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
            valveTypes: vTypes.length ? Array.from(new Set([...prev.valveTypes, ...vTypes])) : prev.valveTypes,
            materials: mats.length ? Array.from(new Set([...prev.materials, ...mats])) : prev.materials,
            endConnections: conns.length ? Array.from(new Set([...prev.endConnections, ...conns])) : prev.endConnections,
            standards: stds.length ? Array.from(new Set([...prev.standards, ...stds])) : prev.standards
          }));
        }

        if (fieldRes?.data?.data?.fields && Array.isArray(fieldRes.data.data.fields)) {
          const fields = fieldRes.data.data.fields;
          const valveTypeField = fields.find(f => f.fieldName === 'valve_type');
          if (valveTypeField && Array.isArray(valveTypeField.options) && valveTypeField.options.length > 0) {
            setMasterDataOptions(prev => ({
              ...prev,
              valveTypes: Array.from(new Set([...prev.valveTypes, ...valveTypeField.options]))
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
    if (!prod) return '';
    let val = prod.dynamicFields?.[key];
    if (val === undefined || val === null || val === '') {
      if (key === 'valve_size') val = prod.dynamicFields?.size || prod.dynamicFields?.size_mm || prod.dynamicFields?.valveSize;
      else if (key === 'valve_class') val = prod.dynamicFields?.class || prod.dynamicFields?.pressure_class || prod.dynamicFields?.valveClass;
      else if (key === 'valve_type') val = prod.dynamicFields?.type || prod.dynamicFields?.valveType;
      else if (key === 'valve_operating') val = prod.dynamicFields?.operating || prod.dynamicFields?.operation || prod.dynamicFields?.actuation;
      else if (key === 'valve_end_connection') val = prod.dynamicFields?.end_connection || prod.dynamicFields?.endConnection;
      else if (key === 'valve_moc_body') val = prod.dynamicFields?.moc || prod.dynamicFields?.body_material || prod.dynamicFields?.shellMaterial;
    }
    if (val === undefined || val === null || val === '') return '';
    if (typeof val === 'object' && val !== null) {
      if (val.canonicalValue !== undefined && val.canonicalValue !== null) return val.canonicalValue;
      if (val.normalizedValue !== undefined && val.normalizedValue !== null) return val.normalizedValue;
      if (val.value !== undefined && val.value !== null) return val.value;
      return '';
    }
    return String(val);
  };

  const getSelectedOption = (val, options = []) => {
    if (!val) return '';
    const strVal = String(val).trim();
    if (options.includes(strVal)) return strVal;
    
    const ciMatch = options.find(opt => String(opt).toLowerCase() === strVal.toLowerCase());
    if (ciMatch) return ciMatch;

    const clean = strVal.toLowerCase().replace(/\s*(?:mm|inch|inches|in|\"|#)$/, '');
    const found = options.find(opt => 
      String(opt).trim().toLowerCase().replace(/\s*(?:mm|inch|inches|in|\"|#)$/, '') === clean
    );
    return found || strVal;
  };

  const getFieldProvenance = (prod, key) => {
    if (!prod) return 'NOT_FOUND';
    const conf = prod.fieldConfidences?.[key];
    if (conf && conf.provenance) return conf.provenance;
    if (conf && conf.source === 'USER_OVERRIDE') return 'USER_OVERRIDE';
    if (conf && conf.source === 'ENGINEERING_RULE') return 'ENGINEERING_RULE';
    if (conf && conf.source === 'REGEX') return 'CUSTOMER_EXTRACTED';

    const dynObj = prod.dynamicFields?.[key];
    if (typeof dynObj === 'object' && dynObj !== null && dynObj.provenance) {
      return dynObj.provenance;
    }

    if (prod.derivedSpecifications && prod.derivedSpecifications[key]) {
      return 'ENGINEERING_RULE';
    }

    const val = getDynVal(prod, key);
    if (val) return 'CUSTOMER_EXTRACTED';
    return 'NOT_FOUND';
  };

  const getItemValidationState = (prod) => {
    if (!prod) return { state: 'NOT_FOUND', label: 'Not Found', color: 'bg-slate-100 text-slate-700 border-slate-200' };
    if (prod.validation) {
      if (prod.validation.needsManualReview) {
        const reason = prod.validation.reviewReason || '';
        if (reason.includes('CONFLICT')) {
          return { state: 'CONFLICT', label: 'Conflict', color: 'bg-purple-50 text-purple-700 border-purple-200' };
        }
        if (reason.includes('AMBIGUOUS')) {
          return { state: 'AMBIGUOUS', label: 'Ambiguous', color: 'bg-orange-50 text-orange-700 border-orange-200' };
        }
        if (reason.includes('NOT_FOUND') || reason.includes('MISSING')) {
          return { state: 'NOT_FOUND', label: 'Review Required', color: 'bg-amber-50 text-amber-700 border-amber-200' };
        }
        return { state: 'REVIEW_REQUIRED', label: 'Review Required', color: 'bg-amber-50 text-amber-700 border-amber-200' };
      }
      if (prod.validation.isValid) {
        return { state: 'READY', label: 'Ready', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      }
      return { state: 'INVALID', label: 'Invalid', color: 'bg-red-50 text-red-700 border-red-200' };
    }
    const hasSize = !!getDynVal(prod, 'valve_size');
    const hasClass = !!getDynVal(prod, 'valve_class');
    const hasQty = prod.quantity !== null && prod.quantity !== undefined;
    if (hasSize && hasClass && hasQty) {
      return { state: 'READY', label: 'Ready', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
    return { state: 'REVIEW_REQUIRED', label: 'Review Required', color: 'bg-amber-50 text-amber-700 border-amber-200' };
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
      if (!item.fieldConfidences) item.fieldConfidences = {};
      item.fieldConfidences[fieldName] = {
        confidence: 100,
        source: 'USER_OVERRIDE',
        provenance: 'USER_OVERRIDE'
      };
    }

    updated[index] = item;
    setProducts(updated);
    setIsDirty(true);
  };

  const addRow = () => {
    const newIdx = products.length + 1;
    setProducts([
      ...products,
      {
        itemNo: newIdx,
        enquirySrNo: newIdx,
        lineItemId: `LI-${String(newIdx).padStart(3, '0')}`,
        description: '',
        quantity: null,
        unit: 'NOS',
        category: productCategory || 'Valves',
        standardCode: '',
        dynamicFields: {
          valve_type: null,
          valve_size: null,
          valve_class: null,
          valve_end_connection: null,
          valve_moc_body: null
        },
        fieldConfidences: {},
        validation: {
          isValid: false,
          needsManualReview: true,
          reviewReason: 'MISSING_QUANTITY'
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

  // Summary Metrics
  const readyCount = products.filter(p => getItemValidationState(p).state === 'READY').length;
  const reviewCount = products.filter(p => getItemValidationState(p).state === 'REVIEW_REQUIRED' || getItemValidationState(p).state === 'NOT_FOUND').length;
  const conflictCount = products.filter(p => getItemValidationState(p).state === 'CONFLICT').length;
  const invalidCount = products.filter(p => getItemValidationState(p).state === 'INVALID').length;

  const ProvenanceBadge = ({ provenance }) => {
    switch (provenance) {
      case 'CUSTOMER_EXTRACTED':
        return <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">Customer</span>;
      case 'ENGINEERING_RULE':
        return <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Derived</span>;
      case 'USER_OVERRIDE':
        return <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">Manual Override</span>;
      case 'DEFERRED':
        return <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Needs Review</span>;
      default:
        return <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 border border-slate-200">Not Available</span>;
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

      {/* Header with Review Summary */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Tag className="w-5 h-5 text-brand-500" />
            Line Items ({products.length})
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Ready: {readyCount}
            </span>
            {reviewCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Needs Review: {reviewCount}
              </span>
            )}
            {conflictCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
                Conflicts: {conflictCount}
              </span>
            )}
            {invalidCount > 0 && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                Invalid: {invalidCount}
              </span>
            )}
            {isDirty && (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                Unsaved Changes
              </span>
            )}
          </div>
        </div>

        {!readOnly && (
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
              Save All Items
            </button>
          </div>
        )}
      </div>

      {/* Clean Primary Line Items Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider bg-slate-50/50">
              <th className="py-2.5 px-2 w-10 text-center">#</th>
              <th className="py-2.5 px-2 min-w-[80px]">Item ID</th>
              <th className="py-2.5 px-3 min-w-[200px]">Description</th>
              <th className="py-2.5 px-3 min-w-[140px]">Valve Type</th>
              <th className="py-2.5 px-3 min-w-[110px]">Size</th>
              <th className="py-2.5 px-3 min-w-[100px]">Class</th>
              <th className="py-2.5 px-3 min-w-[70px] text-center">Qty</th>
              <th className="py-2.5 px-3 min-w-[130px]">End Conn</th>
              <th className="py-2.5 px-3 min-w-[110px] text-center">Status</th>
              {!readOnly && <th className="py-2.5 px-2 w-10 text-center"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.map((prod, idx) => {
              const lineItemId = prod.lineItemId || `LI-${String(idx + 1).padStart(3, '0')}`;
              const valveType = getDynVal(prod, 'valve_type');
              const size = getDynVal(prod, 'valve_size') || getDynVal(prod, 'size');
              const pClass = getDynVal(prod, 'valve_class') || getDynVal(prod, 'class') || getDynVal(prod, 'pressure_class');
              const endConn = getDynVal(prod, 'valve_end_connection') || getDynVal(prod, 'end_connection');
              const statusInfo = getItemValidationState(prod);

              return (
                <tr key={prod._id || lineItemId || idx} className="hover:bg-slate-50/80 transition-colors">
                  {/* Row # */}
                  <td className="py-2.5 px-2 font-bold text-slate-400 text-center">{prod.itemNo || idx + 1}</td>

                  {/* Line Item ID */}
                  <td className="py-2.5 px-2 font-mono text-[11px] font-bold text-slate-600">{lineItemId}</td>

                  {/* Description */}
                  <td className="py-2.5 px-3">
                    <input
                      type="text"
                      disabled={readOnly}
                      value={prod.description || ''}
                      placeholder="Enter description..."
                      onChange={(e) => updateProductField(idx, 'description', e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    />
                  </td>

                  {/* Valve Type */}
                  <td className="py-2.5 px-3">
                    <select
                      disabled={readOnly}
                      value={getSelectedOption(valveType, masterDataOptions.valveTypes)}
                      onChange={(e) => updateProductField(idx, 'valve_type', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(Not Specified)</option>
                      {valveType && !masterDataOptions.valveTypes.includes(getSelectedOption(valveType, masterDataOptions.valveTypes)) && (
                        <option key={valveType} value={valveType}>{valveType}</option>
                      )}
                      {masterDataOptions.valveTypes.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* Size */}
                  <td className="py-2.5 px-3">
                    <select
                      disabled={readOnly}
                      value={getSelectedOption(size, masterDataOptions.sizes)}
                      onChange={(e) => updateProductField(idx, 'valve_size', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(None)</option>
                      {size && !masterDataOptions.sizes.includes(getSelectedOption(size, masterDataOptions.sizes)) && (
                        <option key={size} value={size}>{size}</option>
                      )}
                      {masterDataOptions.sizes.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* Class */}
                  <td className="py-2.5 px-3">
                    <select
                      disabled={readOnly}
                      value={getSelectedOption(pClass, masterDataOptions.classes)}
                      onChange={(e) => updateProductField(idx, 'valve_class', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(None)</option>
                      {pClass && !masterDataOptions.classes.includes(getSelectedOption(pClass, masterDataOptions.classes)) && (
                        <option key={pClass} value={pClass}>{pClass}</option>
                      )}
                      {masterDataOptions.classes.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* Qty */}
                  <td className="py-2.5 px-3 text-center">
                    <input
                      type="number"
                      disabled={readOnly}
                      min="1"
                      value={prod.quantity !== null && prod.quantity !== undefined ? prod.quantity : ''}
                      placeholder="—"
                      onChange={(e) => {
                        const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        updateProductField(idx, 'quantity', val);
                      }}
                      className="w-16 px-1.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-black text-brand-600 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all text-center"
                    />
                  </td>

                  {/* End Connection */}
                  <td className="py-2.5 px-3">
                    <select
                      disabled={readOnly}
                      value={getSelectedOption(endConn, masterDataOptions.endConnections)}
                      onChange={(e) => updateProductField(idx, 'valve_end_connection', e.target.value)}
                      className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium text-slate-800 focus:bg-white focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all"
                    >
                      <option value="">(Not Specified)</option>
                      {endConn && !masterDataOptions.endConnections.includes(getSelectedOption(endConn, masterDataOptions.endConnections)) && (
                        <option key={endConn} value={endConn}>{endConn}</option>
                      )}
                      {masterDataOptions.endConnections.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  </td>

                  {/* Review Status Badge */}
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </td>

                  {/* Actions */}
                  {!readOnly && (
                    <td className="py-2.5 px-2 text-center">
                      <button
                        type="button"
                        onClick={() => deleteRow(idx)}
                        title="Delete line item"
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
