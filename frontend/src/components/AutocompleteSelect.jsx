import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, X, Check, Search } from 'lucide-react';

/**
 * AutocompleteSelect — A searchable, filterable dropdown with optional group headers.
 *
 * Props:
 *  - options: Array of { value, label, group? } OR Array of strings
 *  - value: currently selected value (string)
 *  - onChange: (value: string) => void
 *  - placeholder: string to show when nothing is selected
 *  - className: extra classNames for the outer wrapper
 *  - required: boolean — for form validation
 *  - disabled: boolean
 *  - name: string — hidden input name for forms
 *  - allowClear: boolean — show a clear (×) button when a value is selected
 */
const AutocompleteSelect = ({
  options = [],
  value,
  onChange,
  placeholder = 'Select...',
  className = '',
  required = false,
  disabled = false,
  name,
  allowClear = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Normalise options to { value, label, group? } format
  const normalised = useMemo(() =>
    options
      .map(opt =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      )
      .filter(opt => opt && opt.value !== undefined && opt.value !== null)
      .map(opt => ({ ...opt, label: opt.label || String(opt.value) }))
    , [options]);

  // Filter based on search text
  const filtered = useMemo(() => {
    const q = (search || '').toLowerCase();
    return normalised.filter(opt =>
      (opt.label || '').toLowerCase().includes(q)
    );
  }, [normalised, search]);

  // Build grouped structure for rendering
  const groupedFiltered = useMemo(() => {
    const hasGroups = filtered.some(opt => opt.group);
    if (!hasGroups) return null;

    const groups = {};
    const ungrouped = [];
    filtered.forEach(opt => {
      if (opt.group) {
        if (!groups[opt.group]) groups[opt.group] = [];
        groups[opt.group].push(opt);
      } else {
        ungrouped.push(opt);
      }
    });
    return { groups, ungrouped };
  }, [filtered]);

  // Flat list for keyboard navigation (group headers are not selectable)
  const flatFiltered = filtered;

  // Derive displayed label from selected value
  const selectedOption = normalised.find(o => o.value === value);
  const displayLabel = selectedOption ? selectedOption.label : '';

  // Calculate dropdown position using fixed positioning (viewport-relative)
  const updatePosition = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const dropdownHeight = 264; // Search input (40px) + options list max-height (224px)
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;

      if (spaceBelow < dropdownHeight && spaceAbove > spaceBelow) {
        // Open upwards
        setDropdownPos({
          bottom: (window.innerHeight - rect.top) + 4,
          left: rect.left,
          width: rect.width,
        });
      } else {
        // Open downwards
        setDropdownPos({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      }
    }
  }, []);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        // Also check if clicking inside the portal dropdown
        const portal = document.getElementById('autocomplete-portal');
        if (portal && portal.contains(e.target)) return;
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Update position on resize/scroll when open (using capture phase for nested scroll containers)
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true); // Capture phase captures scroll on any scrollable parent (like the modal)
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  // Reset highlight when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex, isOpen]);

  const selectOption = useCallback((val) => {
    onChange(val);
    setIsOpen(false);
    setSearch('');
  }, [onChange]);

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex(i => Math.min(i + 1, flatFiltered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (flatFiltered[highlightedIndex]) selectOption(flatFiltered[highlightedIndex].value);
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearch('');
        break;
      case 'Tab':
        setIsOpen(false);
        setSearch('');
        break;
      default:
        break;
    }
  };

  const handleOpen = () => {
    if (disabled) return;
    setIsOpen(true);
    updatePosition();
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  // Render option items (handles both grouped and flat)
  const renderOptions = () => {
    if (flatFiltered.length === 0) {
      return (
        <li className="px-3 py-3 text-sm text-slate-400 text-center italic">
          No matching options
        </li>
      );
    }

    if (groupedFiltered) {
      const items = [];
      let flatIdx = 0;

      // Ungrouped items first
      if (groupedFiltered.ungrouped.length > 0) {
        groupedFiltered.ungrouped.forEach(opt => {
          const idx = flatFiltered.indexOf(opt);
          items.push(renderOptionItem(opt, idx));
          flatIdx++;
        });
      }

      // Grouped items
      Object.entries(groupedFiltered.groups).forEach(([groupName, groupOpts]) => {
        items.push(
          <li key={`group-${groupName}`} className="px-3 py-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 border-t border-b border-slate-100 mt-1 first:mt-0 sticky top-0">
            {groupName}
          </li>
        );
        groupOpts.forEach(opt => {
          const idx = flatFiltered.indexOf(opt);
          items.push(renderOptionItem(opt, idx));
          flatIdx++;
        });
      });

      return items;
    }

    return flatFiltered.map((opt, idx) => renderOptionItem(opt, idx));
  };

  const renderOptionItem = (opt, idx) => {
    const isSelected = opt.value === value;
    const isHighlighted = idx === highlightedIndex;
    return (
      <li
        key={opt.value + '-' + idx}
        role="option"
        aria-selected={isSelected}
        onMouseEnter={() => setHighlightedIndex(idx)}
        onClick={() => selectOption(opt.value)}
        className={`
          flex items-center justify-between gap-2 px-3 py-2 text-sm cursor-pointer transition-colors
          ${isHighlighted ? 'bg-brand-50 text-brand-700' : 'text-slate-700 hover:bg-slate-50'}
          ${isSelected ? 'font-semibold' : ''}
        `}
      >
        <span className="truncate">{opt.label}</span>
        {isSelected && <Check className="w-4 h-4 text-brand-600 flex-shrink-0" />}
      </li>
    );
  };

  // Portal container for dropdown
  const getPortalContainer = () => {
    let portal = document.getElementById('autocomplete-portal');
    if (!portal) {
      portal = document.createElement('div');
      portal.id = 'autocomplete-portal';
      document.body.appendChild(portal);
    }
    return portal;
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden input for form validation */}
      {name && (
        <input
          type="hidden"
          name={name}
          value={value || ''}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left
          bg-slate-50 border border-slate-200 rounded-xl text-sm
          focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500
          transition-all
          ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'cursor-pointer hover:border-slate-300'}
          ${isOpen ? 'ring-2 ring-brand-500/20 border-brand-500' : ''}
        `}
      >
        <span className={value ? 'text-slate-900 font-medium truncate' : 'text-slate-400 truncate'}>
          {displayLabel || placeholder}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              onClick={handleClear}
              className="p-0.5 hover:bg-slate-200 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {/* Dropdown Panel — rendered via Portal to avoid overflow:hidden clipping */}
      {isOpen && createPortal(
        <div
          style={{
            position: 'fixed',
            top: dropdownPos.top !== undefined ? dropdownPos.top : 'auto',
            bottom: dropdownPos.bottom !== undefined ? dropdownPos.bottom : 'auto',
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="bg-white border border-slate-200 rounded-xl shadow-lg shadow-slate-200/50 overflow-hidden"
        >
          {/* Search Input */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
            <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Type to search..."
              autoComplete="off"
            />
          </div>

          {/* Options List */}
          <ul
            ref={listRef}
            className="max-h-56 overflow-y-auto py-1 scrollbar-thin"
            role="listbox"
          >
            {renderOptions()}
          </ul>
        </div>,
        getPortalContainer()
      )}
    </div>
  );
};

export default AutocompleteSelect;
