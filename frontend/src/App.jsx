import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Login from './pages/Login';
import Verify from './pages/Verify';
import SetPassword from './pages/SetPassword';
import AdminUsers from './pages/AdminUsers';
import Dashboard from './pages/Dashboard';
import Enquiries from './pages/Enquiries';
import EnquiryDetail from './pages/EnquiryDetail';
import Quotations from './pages/Quotations';
import QuotationDetail from './pages/QuotationDetail';
import Qaps from './pages/Qaps';
import QapDetail from './pages/QapDetail';
import FollowUpBoard from './pages/FollowUpBoard';

import ProfileSettings from './pages/ProfileSettings';
import FieldBuilder from './pages/FieldBuilder';
import RoleBuilder from './pages/RoleBuilder';
import Customers from './pages/Customers';
import Tasks from './pages/Tasks';
import TodoTasks from './pages/TodoTasks';
import Gallery from './pages/Gallery';
import SystemSettings from './pages/SystemSettings';
import MasterData from './pages/MasterData';
import AuditLog from './pages/AuditLog';
import SystemLogs from './pages/SystemLogs';
import Vendors from './pages/Vendors';
import Products from './pages/Products';
import { AbilityProvider } from './context/AbilityContext';

function App() {
  return (
    <AbilityProvider>
      <BrowserRouter>
        <Routes>
        {/* Redirect root to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        
        {/* Auth */}
        <Route path="/login" element={<Login />} />
        <Route path="/verify" element={<Verify />} />
        <Route path="/set-password" element={<SetPassword />} />
        
        {/* Protected Routes wrapped in DashboardLayout */}
        <Route path="/app" element={<DashboardLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="todos" element={<TodoTasks />} />
          <Route path="enquiries" element={<Enquiries />} />
          <Route path="enquiries/:id" element={<EnquiryDetail />} />
          <Route path="quotations" element={<Quotations />} />
          <Route path="quotations/:id" element={<QuotationDetail />} />
          <Route path="qaps" element={<Qaps />} />
          <Route path="qaps/:id" element={<QapDetail />} />
          <Route path="follow-ups" element={<FollowUpBoard />} />
          <Route path="admin" element={<AdminUsers />} />
          <Route path="profile" element={<ProfileSettings />} />
          <Route path="field-builder" element={<FieldBuilder />} />
          <Route path="role-builder" element={<RoleBuilder />} />
          <Route path="gallery" element={<Gallery />} />
          <Route path="customers" element={<Customers />} />
          <Route path="vendors" element={<Vendors />} />
          <Route path="products" element={<Products />} />
          <Route path="settings" element={<SystemSettings />} />
          <Route path="master-data" element={<MasterData />} />
          <Route path="audit-logs" element={<AuditLog />} />
          <Route path="system-logs" element={<SystemLogs />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
    </AbilityProvider>
  );
}

export default App;
