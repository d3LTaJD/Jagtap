import React, { useState, useEffect } from 'react';
import api from '../api/client';
import AutocompleteSelect from './AutocompleteSelect';
import ToggleSwitch from './ToggleSwitch';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import SignatureCanvas from 'react-signature-canvas';
import { MapPin, Eraser } from 'lucide-react';
import { getRoleCode } from '../context/AbilityContext';

/**
 * DynamicFormRenderer
 * 
 * Fetches FieldDefinitions for a given formContext and renders the correct
 * input widget for each field. Handles conditional logic (show/hide).
 *
 * Props:
 *  - formContext: 'Enquiry' | 'Quotation' | 'QAP' | 'Product'
 *  - values: object of current dynamicField values { [fieldName]: value }
 *  - onChange: (fieldName, value) => void
 *  - readOnly: boolean (renders display-only text instead of inputs)
 *  - currentUserRole: string (for role-based visibility)
 */
const DynamicFormRenderer = ({ formContext, values = {}, onChange, readOnly = false, currentUserRole }) => {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);

  // Retrieve primary and secondary roles dynamically
  const user = JSON.parse(sessionStorage.getItem('user') || '{}');
  const primaryRole = currentUserRole || user.role;
  const secondaryRole = user.secondaryRole;
  
  const userRoles = [
    getRoleCode(primaryRole),
    getRoleCode(secondaryRole)
  ].filter(Boolean);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await api.get(`/fields?formContext=${formContext}`);
        setFields(res.data.data.fields);
      } catch (err) {
        console.error('Failed to load dynamic fields', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [formContext]);

  if (loading) return null;
  if (!fields.length) {
    return (
      <div className="p-8 text-center text-slate-400 font-semibold text-xs border border-dashed border-slate-200 rounded-2xl">
        No technical specifications configured for {formContext}.
      </div>
    );
  }

  const getFieldValue = (fieldName) => {
    const rawVal = values[fieldName];
    if (rawVal && typeof rawVal === 'object' && rawVal.hasOwnProperty('value')) {
      return rawVal.value;
    }
    return rawVal;
  };

  // Evaluate conditional logic — returns true if field should be visible
  const isVisible = (field) => {
    // Category boundary check
    if (field.productCategory && values.productCategory) {
      const fCat = field.productCategory;
      const vCat = values.productCategory;
      if (vCat !== 'Custom' && vCat !== 'Multiple' && fCat !== 'Multiple' && fCat !== 'Custom' && fCat !== vCat) {
        return false;
      }
    }
    // Role-based visibility check
    if (field.visibleToRoles?.length) {
      if (!userRoles.length) return false; // Safety: if restricted but no role, hide
      if (!userRoles.some(r => field.visibleToRoles.includes(r))) return false;
    }
    // Conditional logic
    if (field.conditionalLogic?.dependsOnField) {
      const depField = field.conditionalLogic.dependsOnField;
      const reqVal = field.conditionalLogic.requiredValue;
      const controllingValue = String(getFieldValue(depField) || '');

      if (depField === 'productCategory') {
        const lowerVal = controllingValue.toLowerCase();
        if (['custom', 'multiple', 'general', 'tender', ''].includes(lowerVal)) {
          // Flexible categories match any category requirement
        } else if (controllingValue !== reqVal && reqVal !== 'Custom' && reqVal !== 'Multiple') {
          return false;
        }
      } else if (controllingValue !== reqVal) {
        return false;
      }
    }
    return true;
  };

  // Evaluate role-based editability
  const isEditable = (field) => {
    // If the whole form is read-only, everything is read-only
    if (readOnly) return false;
    
    // If specific roles are defined, current user MUST have one of them
    if (field.editableByRoles?.length) {
      if (!userRoles.length) return false;
      return userRoles.some(r => field.editableByRoles.includes(r));
    }
    
    // Default: everyone can edit if form is not read-only
    return true;
  };

  const handle = (fieldName, value) => {
    if (onChange) onChange(fieldName, value);
  };

  // Group fields by groupLabel for section rendering
  const sections = {};
  fields.forEach(f => {
    const group = f.groupLabel || '__default__';
    if (!sections[group]) sections[group] = [];
    sections[group].push(f);
  });

  const isEmpty = (v) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

  const renderInput = (field) => {
    const val = getFieldValue(field.fieldName) ?? '';
    const canEdit = isEditable(field);
    const emptyHighlight = isEmpty(val) ? 'bg-yellow-50 border-yellow-300' : 'bg-slate-50 border-slate-200';
    const baseClass = `w-full px-3.5 py-2.5 border rounded-xl text-sm 
      font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none disabled:bg-slate-100 disabled:text-slate-500 ${emptyHighlight}`;

    const isYesNo = (f) => {
      if (f.fieldType === 'Checkbox (Boolean)') return true;
      if (f.options && f.options.length === 2) {
        const opts = f.options.map(o => String(o).toUpperCase().trim());
        return opts.includes('YES') && opts.includes('NO');
      }
      return false;
    };

    if (isYesNo(field)) {
      let isTrue = false;
      if (field.fieldType === 'Checkbox (Boolean)') {
        isTrue = !!val;
      } else {
        isTrue = String(val).toUpperCase().trim() === 'YES';
      }

      return (
        <ToggleSwitch
          checked={isTrue}
          disabled={!canEdit}
          onChange={(newChecked) => {
            if (field.fieldType === 'Checkbox (Boolean)') {
              handle(field.fieldName, newChecked);
            } else {
              const yesOption = field.options.find(o => String(o).toUpperCase().trim() === 'YES') || 'Yes';
              const noOption = field.options.find(o => String(o).toUpperCase().trim() === 'NO') || 'No';
              handle(field.fieldName, newChecked ? yesOption : noOption);
            }
          }}
        />
      );
    }

    if (!canEdit) {
      if (field.fieldType === 'Rich Text') {
        return <div className={`prose prose-sm max-w-none p-4 border rounded-xl ${isEmpty(val) ? 'bg-yellow-50/80 border-yellow-300' : 'bg-slate-50 border-slate-100'}`} dangerouslySetInnerHTML={{ __html: val }} />;
      }
      if (field.fieldType === 'Signature') {
        return (
          <div className={`p-2 border rounded-xl h-24 flex items-center justify-center ${isEmpty(val) ? 'bg-yellow-50/80 border-yellow-300' : 'bg-slate-50 border-slate-100'}`}>
            {val ? <img src={val} alt="Signature" className="max-h-full object-contain" /> : <span className="text-slate-400 italic">No signature</span>}
          </div>
        );
      }
      
      const getDisplayValue = () => {
        const normalized = (field.options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o);
        const findLabel = (v) => {
          const matched = normalized.find(o => o.value === v);
          return matched ? matched.label : v;
        };
        if (Array.isArray(val)) {
          return val.map(findLabel).join(', ');
        }
        if (val !== undefined && val !== null && val !== '') {
          return findLabel(val);
        }
        return <span className="text-slate-400 italic">—</span>;
      };

      return (
        <div className={`px-3.5 py-2.5 border rounded-xl text-sm text-slate-700 min-h-[40px] flex items-center ${isEmpty(val) ? 'bg-yellow-50/80 border-yellow-300' : 'bg-slate-50 border-slate-100'}`}>
          {getDisplayValue()}
        </div>
      );
    }

    switch (field.fieldType) {
      case 'Text (Short)':
        return (
          <input
            type="text"
            value={val}
            required={field.isRequired}
            placeholder={field.placeholder || ''}
            maxLength={field.validationRules?.maxLength}
            onChange={e => handle(field.fieldName, e.target.value)}
            className={baseClass}
          />
        );

      case 'Text (Long)':
        return (
          <textarea
            value={val}
            required={field.isRequired}
            placeholder={field.placeholder || ''}
            maxLength={field.validationRules?.maxLength}
            rows={3}
            onChange={e => handle(field.fieldName, e.target.value)}
            className={`${baseClass} resize-none`}
          />
        );

      case 'Number':
        return (
          <div className="relative">
            <input
              type="number"
              value={val}
              required={field.isRequired}
              min={field.validationRules?.min}
              max={field.validationRules?.max}
              placeholder={field.placeholder || '0'}
              onChange={e => handle(field.fieldName, e.target.value)}
              className={`${baseClass} ${field.validationRules?.unitLabel ? 'pr-16' : ''}`}
            />
            {field.validationRules?.unitLabel && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
                {field.validationRules.unitLabel}
              </span>
            )}
          </div>
        );

      case 'Dropdown (Single)':
        return (
          <AutocompleteSelect
            options={(field.options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o)}
            value={val}
            onChange={(v) => handle(field.fieldName, v)}
            placeholder={field.placeholder || 'Select...'}
            required={field.isRequired}
            allowClear={!field.isRequired}
          />
        );

      case 'Dropdown (Multi)':
        return (
          <div className="space-y-2">
            {(field.options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o).map(opt => {
              const selected = Array.isArray(val) ? val : [];
              const checked = selected.includes(opt.value);
              return (
                <label key={opt.value} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const next = checked ? selected.filter(v => v !== opt.value) : [...selected, opt.value];
                      handle(field.fieldName, next);
                    }}
                    className="w-4 h-4 rounded text-brand-600 border-slate-300 focus:ring-brand-500"
                  />
                  <span className="text-sm text-slate-700 group-hover:text-slate-900">{opt.label}</span>
                </label>
              );
            })}
          </div>
        );

      case 'Date Picker':
        return (
          <input
            type="date"
            value={val}
            required={field.isRequired}
            onChange={e => handle(field.fieldName, e.target.value)}
            className={baseClass}
          />
        );

      case 'Date + Time':
        return (
          <input
            type="datetime-local"
            value={val}
            required={field.isRequired}
            onChange={e => handle(field.fieldName, e.target.value)}
            className={baseClass}
          />
        );

      case 'Checkbox (Boolean)':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => handle(field.fieldName, !val)}
              className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${val ? 'bg-brand-600' : 'bg-slate-300'}`}
            >
              <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${val ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm text-slate-600">{val ? 'Yes' : 'No'}</span>
          </label>
        );

      case 'Radio Button':
        return (
          <div className="flex flex-wrap gap-3">
            {(field.options || []).map(o => typeof o === 'string' ? { value: o, label: o } : o).map(opt => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.fieldName}
                  value={opt.value}
                  checked={val === opt.value}
                  onChange={() => handle(field.fieldName, opt.value)}
                  className="w-4 h-4 text-brand-600 border-slate-300 focus:ring-brand-500"
                />
                <span className="text-sm text-slate-700">{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'File Upload':
        return (
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Choose File
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.xlsx,.dwg"
                onChange={e => handle(field.fieldName, e.target.files[0]?.name || '')}
              />
            </label>
            {val && <span className="text-xs text-slate-500 truncate max-w-xs">{val}</span>}
          </div>
        );

      case 'Auto-Calculated':
        return (
          <div className="px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 flex items-center gap-2">
            <span>{val || '—'}</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-auto">Auto</span>
          </div>
        );
      
      case 'Rich Text':
        return (
          <div className="bg-white rounded-xl overflow-hidden border border-slate-200">
            <ReactQuill 
              theme="snow" 
              value={val} 
              onChange={v => handle(field.fieldName, v)}
              className="min-h-[150px]"
            />
          </div>
        );

      case 'Signature':
        return (
          <div className="space-y-2">
            <div className="border border-slate-200 rounded-xl bg-white overflow-hidden h-40 relative group">
              {val ? (
                <div className="h-full flex items-center justify-center p-4">
                  <img src={val} alt="Signature" className="max-h-full object-contain" />
                  <button 
                    onClick={() => handle(field.fieldName, '')}
                    className="absolute top-2 right-2 p-1.5 bg-red-50 text-red-600 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Eraser className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <SignatureCanvas 
                  penColor="black"
                  canvasProps={{ className: 'w-full h-full' }}
                  onEnd={(sig) => {
                    // Logic to capture ref and get data URL
                    // Note: In a real app, you'd use a ref. For simplicity here, we'll use a local instance.
                  }}
                  ref={(ref) => {
                    field._sigRef = ref;
                  }}
                />
              )}
              {!val && (
                <button 
                  type="button"
                  onClick={() => {
                    if (field._sigRef) {
                      const dataUrl = field._sigRef.getTrimmedCanvas().toDataURL('image/png');
                      handle(field.fieldName, dataUrl);
                    }
                  }}
                  className="absolute bottom-2 right-2 px-3 py-1.5 bg-brand-600 text-white text-xs font-bold rounded-lg shadow-sm"
                >
                  Save Signature
                </button>
              )}
            </div>
          </div>
        );

      case 'GPS Location':
        return (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition((pos) => {
                    handle(field.fieldName, `${pos.coords.latitude}, ${pos.coords.longitude}`);
                  });
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-brand-700 bg-brand-50 border border-brand-200 rounded-xl hover:bg-brand-100 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Capture Current Location
            </button>
            <span className="text-xs font-mono text-slate-500">{val || 'Not captured'}</span>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={val}
            placeholder={field.placeholder || ''}
            onChange={e => handle(field.fieldName, e.target.value)}
            className={baseClass}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {Object.entries(sections).map(([group, groupFields]) => {
        const visibleFields = groupFields.filter(isVisible);
        if (!visibleFields.length) return null;

        return (
          <div key={group}>
            {group !== '__default__' && (
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 pb-2 border-b border-slate-100">
                {group}
              </h3>
            )}
            <div className="space-y-4">
              {visibleFields.map(field => (
                <div key={field._id}>
                  <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    {field.fieldLabel}
                    {field.isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {renderInput(field)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DynamicFormRenderer;
