import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, CheckSquare, Settings, X, Database, Wrench, Shield, CalendarDays, Image, ClipboardList, Sparkles } from 'lucide-react';
import { useAbility } from '../context/AbilityContext';

const Sidebar = ({ onClose }) => {
  const ability = useAbility();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, path: '/app', show: true },
    { label: 'Calendar', icon: CalendarDays, path: '/app/tasks', show: true },
    { label: 'To-Dos', icon: CheckSquare, path: '/app/todos', show: true },
    { label: 'Customers', icon: Database, path: '/app/customers', show: ability.can('view', 'Customers') },
    { label: 'Vendors', icon: Database, path: '/app/vendors', show: ability.can('view', 'Admin') },
    { label: 'Products', icon: Database, path: '/app/products', show: ability.can('view', 'Products') },
    { label: 'Gallery & Files', icon: Image, path: '/app/gallery', show: ability.can('view', 'Enquiry') },
    { label: 'Enquiries', icon: Users, path: '/app/enquiries', show: ability.can('view', 'Enquiry') },
    { label: 'Quotations', icon: FileText, path: '/app/quotations', show: ability.can('view', 'Quotation') },
    { label: 'Quality Assurance', icon: CheckSquare, path: '/app/qaps', show: ability.can('view', 'QAP') },
  ];

  if (ability.can('view', 'Admin')) {
    navItems.push({ label: 'Master Data', icon: Database, path: '/app/master-data', show: true });
    navItems.push({ label: 'Field Builder', icon: Wrench, path: '/app/field-builder', show: true });
    navItems.push({ label: 'Role Builder', icon: Shield, path: '/app/role-builder', show: true });
    navItems.push({ label: 'Audit Logs', icon: ClipboardList, path: '/app/audit-logs', show: true });
    navItems.push({ label: 'User Management', icon: Users, path: '/app/admin', show: true });
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
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600 shadow-sm shadow-brand-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <span className="text-slate-900">Petro Valve <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-500 to-violet-500">AI</span></span>
        </NavLink>
        <button onClick={onClose} className="p-1 -mr-2 text-slate-400 hover:text-slate-600 rounded-md">
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleNavItems.map((item) => (
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
        ))}
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
