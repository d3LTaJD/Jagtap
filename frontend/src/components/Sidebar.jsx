import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CheckSquare, Settings, X, Database, Wrench, Shield, CalendarDays, Image, ClipboardList, Sparkles, ChevronRight, Package, Truck, FileCode2, Factory, ShoppingBag } from 'lucide-react';
import { useAbility, getRoleCode } from '../context/AbilityContext';
import logoImg from '../logo.png';

const Sidebar = ({ onClose }) => {
  const ability = useAbility();
  const location = useLocation();

  const showCustomers = ability.can('view', 'Customers');
  const showVendors = ability.can('view', 'Admin');
  const showProducts = ability.can('view', 'Products');
  const showDbGroup = showCustomers || showVendors || showProducts;
  const isDbActive = ['/app/customers', '/app/vendors', '/app/products'].includes(location.pathname);

  const [isDbDropdownOpen, setIsDbDropdownOpen] = useState(isDbActive);

  useEffect(() => {
    if (isDbActive) {
      setIsDbDropdownOpen(true);
    }
  }, [location.pathname, isDbActive]);

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/app', show: true },
    { label: 'Calendar', icon: CalendarDays, path: '/app/tasks', show: ability.can('view', 'Enquiry') },
    { label: 'To-Dos', icon: CheckSquare, path: '/app/todos', show: ability.can('view', 'Enquiry') },
    { type: 'group', label: 'Database', icon: Database, show: showDbGroup },
    { label: 'Gallery & Files', icon: Image, path: '/app/gallery', show: ability.can('view', 'Enquiry') },
    { label: 'Enquiries', icon: Users, path: '/app/enquiries', show: ability.can('view', 'Enquiry') },
    { label: 'Quotations', icon: FileText, path: '/app/quotations', show: ability.can('view', 'Quotation') },
    { label: 'TDS / Drawings', icon: FileCode2, path: '/app/drawings', show: ability.can('view', 'Drawing') || ability.can('view', 'Quotation') },
    { label: 'Work Orders', icon: Factory, path: '/app/work-orders', show: ability.can('view', 'WorkOrder') || ability.can('view', 'Quotation') },
    { label: 'Purchase & BOM', icon: ShoppingBag, path: '/app/purchase', show: ability.can('view', 'Quotation') || ability.can('view', 'BOM') || ability.can('view', 'Purchase') },
    { label: 'Quality Assurance', icon: CheckSquare, path: '/app/qaps', show: ability.can('view', 'QAP') },
    { label: 'Follow-Up Board', icon: ClipboardList, path: '/app/follow-ups', show: ability.can('view', 'FollowUp') },
  ];

  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');
  const userRoleCode = getRoleCode(currentUser.role);
  const userSecRoleCode = getRoleCode(currentUser.secondaryRole);
  const userRoles = [userRoleCode, userSecRoleCode].filter(Boolean);

  const isSA = userRoles.includes('SA');
  const isDIR = userRoles.includes('DIR');
  const isTA = userRoles.includes('TA');

  if (ability.can('masterDataWrite', 'Admin')) {
    navItems.push({ label: 'Master Data', icon: Database, path: '/app/master-data', show: true });
  }
  if (ability.can('fieldBuilder', 'Admin')) {
    navItems.push({ label: 'Field Builder', icon: Wrench, path: '/app/field-builder', show: true });
  }
  if (ability.can('roleManageWrite', 'Admin')) {
    navItems.push({ label: 'Role Builder', icon: Shield, path: '/app/role-builder', show: true });
  }
  if (ability.can('auditLogView', 'Admin')) {
    navItems.push({ label: 'Audit Logs', icon: ClipboardList, path: '/app/audit-logs', show: true });
    navItems.push({ label: 'System Logs', icon: ClipboardList, path: '/app/system-logs', show: true });
  }
  if (ability.can('userManageRead', 'Admin')) {
    navItems.push({ label: 'User Management', icon: Users, path: '/app/admin', show: true });
  }
  if (ability.can('settingsRead', 'Admin')) {
    navItems.push({ label: 'Settings', icon: Settings, path: '/app/settings', show: true });
  }

  const visibleNavItems = navItems.filter(item => item.show);

  return (
    <div className="flex flex-col h-full bg-white text-slate-700">
      <div className="h-16 flex items-center justify-between px-6 border-b border-slate-100">
        <NavLink
          to="/"
          className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity"
          title="Go to Home"
        >
          <img src={logoImg} alt="Logo" className="h-10 w-auto max-w-[140px] object-contain" />
          <span className="text-slate-900">Petro Valve <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-violet-500">AI</span></span>
        </NavLink>
        <button onClick={onClose} className="p-1 -mr-2 text-slate-400 hover:text-slate-600 rounded-md">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item, idx) => {
          if (item.type === 'group') {
            return (
              <React.Fragment key={`group-${idx}`}>
                <button
                  type="button"
                  onClick={() => setIsDbDropdownOpen(!isDbDropdownOpen)}
                  className={`
                    w-full relative flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group outline-none
                    ${isDbActive 
                      ? 'text-brand-700 bg-brand-50/50 font-bold' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }
                  `}
                >
                  <div className="flex items-center gap-3">
                    <Database className={`w-5 h-5 ${isDbActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}`} />
                    <span>Database</span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isDbDropdownOpen ? 'rotate-90' : ''}`} />
                </button>

                {isDbDropdownOpen && (
                  <div className="pl-6 mt-1 space-y-1 border-l border-slate-100 ml-5 animate-in slide-in-from-top-1 duration-150">
                    {showCustomers && (
                      <NavLink
                        to="/app/customers"
                        onClick={onClose}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200
                          ${isActive 
                            ? 'text-brand-700 bg-brand-50/70 font-bold' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                      >
                        {({ isActive }) => (
                          <>
                            <Users className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                            Customers
                          </>
                        )}
                      </NavLink>
                    )}
                    {showVendors && (
                      <NavLink
                        to="/app/vendors"
                        onClick={onClose}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200
                          ${isActive 
                            ? 'text-brand-700 bg-brand-50/70 font-bold' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                      >
                        {({ isActive }) => (
                          <>
                            <Truck className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                            Vendors
                          </>
                        )}
                      </NavLink>
                    )}
                    {showProducts && (
                      <NavLink
                        to="/app/products"
                        onClick={onClose}
                        className={({ isActive }) => `
                          flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200
                          ${isActive 
                            ? 'text-brand-700 bg-brand-50/70 font-bold' 
                            : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                          }
                        `}
                      >
                        {({ isActive }) => (
                          <>
                            <Package className={`w-4 h-4 ${isActive ? 'text-brand-600' : 'text-slate-400'}`} />
                            Products
                          </>
                        )}
                      </NavLink>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          }

          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/app'}
              onClick={onClose}
              className={({ isActive }) => `
                relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 overflow-hidden group
                ${isActive 
                  ? 'text-brand-700 bg-brand-50 shadow-sm font-bold' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
            >
              {({ isActive }) => (
                <>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-brand-600' : 'text-slate-400 group-hover:text-slate-600 transition-colors'}`} />
                  {item.label}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-slate-100">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-r from-brand-500/5 to-violet-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <p className="text-xs font-semibold text-slate-700">Intan Networks</p>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft"></span>
            <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">Powered by AI</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
