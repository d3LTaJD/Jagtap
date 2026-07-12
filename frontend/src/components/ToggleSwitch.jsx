import React from 'react';

const ToggleSwitch = ({ checked, onChange, label, disabled = false, yesLabel = 'Yes', noLabel = 'No' }) => {
  const handleToggle = (e) => {
    e.preventDefault();
    if (disabled) return;
    if (onChange) onChange(!checked);
  };

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-0.5 shadow-inner relative outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500 ${
          checked 
            ? 'bg-emerald-500 hover:bg-emerald-600' 
            : 'bg-rose-500 hover:bg-rose-600'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`w-5 h-5 bg-white rounded-full shadow-md transition-transform duration-200 transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
      {(label || yesLabel || noLabel) && (
        <span 
          onClick={handleToggle}
          className={`text-xs font-black uppercase tracking-wider select-none ${
            disabled ? 'cursor-not-allowed' : 'cursor-pointer'
          } ${
            checked ? 'text-emerald-600' : 'text-rose-600'
          }`}
        >
          {label ? label : (checked ? yesLabel : noLabel)}
        </span>
      )}
    </div>
  );
};

export default ToggleSwitch;
