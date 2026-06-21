import React, { useState } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import { useAbility } from '../context/AbilityContext';

const DashboardLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();
  const ability = useAbility();

  const token = localStorage.getItem('token');

  React.useEffect(() => {
    const checkAuth = () => {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        window.location.replace('/login');
      }
    };

    checkAuth();
    window.addEventListener('pageshow', checkAuth);
    window.addEventListener('storage', checkAuth);

    return () => {
      window.removeEventListener('pageshow', checkAuth);
      window.removeEventListener('storage', checkAuth);
    };
  }, []);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Guard specific routes
  const path = location.pathname.toLowerCase();

  const adminPaths = [
    '/app/admin',
    '/app/field-builder',
    '/app/role-builder',
    '/app/settings',
    '/app/master-data',
    '/app/audit-logs',
    '/app/system-logs'
  ];

  if (adminPaths.some(p => path.includes(p)) && !ability.can('view', 'Admin')) {
    return <Navigate to="/app" replace />;
  }

  if ((path.includes('/app/tasks') || path.includes('/app/todos') || path.includes('/app/follow-ups')) && !ability.can('view', 'Enquiry')) {
    return <Navigate to="/app" replace />;
  }

  if (path.includes('/app/customers') && !ability.can('view', 'Customers')) {
    return <Navigate to="/app" replace />;
  }

  if (path.includes('/app/products') && !ability.can('view', 'Products')) {
    return <Navigate to="/app" replace />;
  }

  if (path.includes('/app/vendors') && !ability.can('view', 'Admin')) {
    return <Navigate to="/app" replace />;
  }

  if (path.includes('/app/enquiries') && !ability.can('view', 'Enquiry')) {
    return <Navigate to="/app" replace />;
  }

  if (path.includes('/app/quotations') && !ability.can('view', 'Quotation')) {
    return <Navigate to="/app" replace />;
  }

  if (path.includes('/app/qaps') && !ability.can('view', 'QAP')) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="flex h-screen bg-[#ebf0f7] overflow-hidden text-slate-900 relative z-0">
      {/* Background Mesh Gradients to match the airy AI theme */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-br from-indigo-100/60 via-purple-100/30 to-transparent pointer-events-none -z-10" />
      <div className="absolute -top-40 right-0 w-[1000px] h-[700px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-200/50 via-blue-50/20 to-transparent pointer-events-none -z-10 blur-3xl rounded-full" />
      <div className="absolute top-20 left-1/4 w-[800px] h-[500px] bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-200/40 via-transparent to-transparent pointer-events-none -z-10 blur-3xl rounded-full" />
      {/* Off-canvas Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 z-20 bg-black/20 backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar Drawer */}
      <div className={`fixed inset-y-0 left-0 z-30 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar onClose={() => setIsSidebarOpen(false)} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto outline-none">
          {/* Outlet renders the matched child route */}
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
