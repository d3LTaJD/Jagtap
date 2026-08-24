import React, { createContext, useContext, useState, useEffect } from 'react';
import { AbilityBuilder, Ability } from '@casl/ability';
import { createContextualCan } from '@casl/react';
import api from '../api/client';

export const AbilityContext = createContext();
export const Can = createContextualCan(AbilityContext.Consumer);

// Role group map matching backend aliases
const roleGroupMap = {
  'SA': ['SA', 'SUPER_ADMIN', 'SUPERADMIN', 'super_admin', 'superadmin'],
  'DIR': ['DIR', 'DIRECTOR', 'director'],
  'TA': ['TA', 'TECHNICAL_AUTHORITY', 'TECHNICALAUTHORITY', 'technical_authority', 'technicalauthority'],
  'PM': ['PM', 'PURCHASE_MANAGER', 'PURCHASEMANAGER', 'purchase_manager', 'purchasemanager'],
  'SALES': ['SALES', 'SALES_EXECUTIVE', 'SALESEXECUTIVE', 'sales_executive', 'salesexecutive'],
  'DE': ['DE', 'DESIGN_ENGINEER', 'DESIGNENGINEER', 'design_engineer', 'designengineer'],
  'QCE': ['QCE', 'QC_ENGINEER', 'QCENGINEER', 'qc_engineer', 'qcengineer'],
  'QCS': ['QCS', 'QC_SUPERVISOR', 'QCSUPERVISOR', 'qc_supervisor', 'qcsupervisor'],
  'ACC': ['ACC', 'ACCOUNTS', 'accounts'],
  'MGR': ['MGR', 'MANAGEMENT_VIEWER', 'MANAGEMENTVIEWER', 'management_viewer', 'managementviewer', 'manager']
};

const getRoleCode = (role) => {
  if (!role) return '';
  const normalized = role.toUpperCase().trim();
  for (const [shortCode, aliases] of Object.entries(roleGroupMap)) {
    if (shortCode === normalized || aliases.some(a => a.toUpperCase() === normalized)) {
      return shortCode;
    }
  }
  return normalized;
};

const ROLE_DISPLAY_NAMES = {
  'SA': 'Administrator',
  'DIR': 'Director',
  'TA': 'Technical Authority',
  'PM': 'Purchase Manager',
  'SALES': 'Sales Executive',
  'DE': 'Design Engineer',
  'QCE': 'QC Engineer',
  'QCS': 'QC Supervisor',
  'ACC': 'Accounts',
  'MGR': 'Management'
};

export const getRoleDisplayName = (role) => {
  const code = getRoleCode(role);
  return ROLE_DISPLAY_NAMES[code] || role || 'User';
};

export { getRoleCode };

const defineAbilitiesFor = (user) => {
  const { can, rules } = new AbilityBuilder(Ability);

  const roleCode = user ? getRoleCode(user.role) : '';
  if (user && roleCode === 'SA') {
    can('manage', 'all');
  } else if (user && user.permissions) {
    // Map existing permissions to CASL
    // user.permissions format: { Enquiry: { view: true, edit: false, ... }, Quotation: { ... } }
    Object.entries(user.permissions).forEach(([module, actions]) => {
      Object.entries(actions).forEach(([action, allowed]) => {
        if (allowed) {
          can(action, module);
        }
      });
    });
  }

  return new Ability(rules);
};

export const AbilityProvider = ({ children }) => {
  const [ability, setAbility] = useState(() => {
    const userStr = sessionStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        return defineAbilitiesFor(user);
      } catch (e) {
        console.error("Error parsing user from sessionStorage:", e);
      }
    }
    return new Ability();
  });

  useEffect(() => {
    const fetchLatestPermissions = async () => {
      const token = sessionStorage.getItem('token');
      if (!token) return;
      try {
        const res = await api.get('/auth/me');
        if (res.data && res.data.user) {
          const user = res.data.user;
          sessionStorage.setItem('user', JSON.stringify(user));
          setAbility(defineAbilitiesFor(user));
        }
      } catch (err) {
        console.error("Failed to automatically refresh user permissions", err);
      }
    };

    // Refresh immediately on mount to catch any changes made while offline/closed
    if (sessionStorage.getItem('token')) {
      fetchLatestPermissions();
    }

    // Auto-refresh every 5 minutes (300000 ms)
    const intervalId = setInterval(fetchLatestPermissions, 300000);
    
    // Listen for storage changes (for login/logout)
    const handleStorage = () => {
      const userStr = sessionStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        setAbility(defineAbilitiesFor(user));
      } else {
        setAbility(new Ability());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <AbilityContext.Provider value={ability}>
      {children}
    </AbilityContext.Provider>
  );
};

export const useAbility = () => useContext(AbilityContext);
