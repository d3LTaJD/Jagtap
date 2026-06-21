import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Shield, LogOut, Save, Loader2, Eye, EyeOff, CheckCircle2, ArrowLeft } from 'lucide-react';
import api from '../api/client';

const ProfileSettings = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [pwSuccessMsg, setPwSuccessMsg] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);

  const [formData, setFormData] = useState({ fullName: '', email: '', mobile: '' });
  const [pwData, setPwData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(stored);
    setFormData({
      fullName: stored.fullName || '',
      email: stored.email || '',
      mobile: stored.mobile || '',
    });
    setLoading(false);
  }, []);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaveLoading(true);
    setSuccessMsg('');
    try {
      const res = await api.patch('/auth/profile', {
        fullName: formData.fullName,
        mobile: formData.mobile,
      });
      const updatedUser = { ...user, fullName: formData.fullName, mobile: formData.mobile };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setUser(updatedUser);
      setSuccessMsg('Profile updated successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (pwData.newPassword !== pwData.confirmPassword) {
      alert('New passwords do not match.');
      return;
    }
    if (pwData.newPassword.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    setPwLoading(true);
    setPwSuccessMsg('');
    try {
      await api.patch('/auth/change-password', {
        currentPassword: pwData.currentPassword,
        newPassword: pwData.newPassword,
      });
      setPwData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPwSuccessMsg('Password changed successfully!');
      setTimeout(() => setPwSuccessMsg(''), 3000);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to change password. Check your current password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.replace('/login');
  };

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const getRoleBadge = (role) => {
    const map = {
      'SUPER_ADMIN': { label: 'Super Admin', cls: 'bg-purple-100 text-purple-700 border-purple-200' },
      'DIRECTOR': { label: 'Director', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
      'DESIGN': { label: 'Design Engineer', cls: 'bg-brand-100 text-brand-700 border-brand-200' },
      'SALES': { label: 'Sales', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    };
    return map[role] || { label: role || 'User', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-brand-600" />
    </div>
  );

  const roleBadge = getRoleBadge(user?.role);

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto animate-in fade-in duration-500">

      {/* Back nav */}
      <div className="mb-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Back</span>
      </div>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 mb-8 pb-8 border-b border-slate-200">
        <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-700 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg shadow-brand-500/25 select-none">
          {getInitials(user?.fullName)}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{user?.fullName || 'Your Name'}</h1>
          <p className="text-sm text-slate-500 mt-1">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full border ${roleBadge.cls}`}>
              <Shield className="w-3 h-3" />
              {roleBadge.label}
            </span>
            {user?.isActive && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Active
              </span>
            )}
          </div>
        </div>
        <div className="sm:ml-auto">
          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Profile Info Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <User className="w-4 h-4 text-brand-600" /> Personal Information
          </h2>
          <p className="text-xs text-slate-500 mb-6">Update your display name and contact details.</p>

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Full Name</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={e => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none"
                placeholder="Your full name"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Email Address</label>
              <div className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="text-sm text-slate-500 font-medium truncate">{formData.email}</span>
                <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">Read only</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="tel"
                  value={formData.mobile}
                  onChange={e => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none"
                  placeholder="10-digit mobile number"
                />
              </div>
            </div>

            {successMsg && (
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {successMsg}
              </div>
            )}

            <button type="submit" disabled={saveLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
              {saveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saveLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Password Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-bold text-slate-900 mb-1 flex items-center gap-2">
            <Lock className="w-4 h-4 text-brand-600" /> Change Password
          </h2>
          <p className="text-xs text-slate-500 mb-6">Choose a strong password (min 8 characters).</p>

          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrentPw ? 'text' : 'password'}
                  required
                  value={pwData.currentPassword}
                  onChange={e => setPwData({ ...pwData, currentPassword: e.target.value })}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none"
                  placeholder="Enter current password"
                />
                <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  required
                  minLength={8}
                  value={pwData.newPassword}
                  onChange={e => setPwData({ ...pwData, newPassword: e.target.value })}
                  className="w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none"
                  placeholder="At least 8 characters"
                />
                <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Strength indicator */}
              {pwData.newPassword && (
                <div className="mt-2 flex gap-1">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                      pwData.newPassword.length >= (i + 1) * 3
                        ? i < 2 ? 'bg-red-400' : i < 3 ? 'bg-amber-400' : 'bg-emerald-500'
                        : 'bg-slate-200'
                    }`} />
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">Confirm New Password</label>
              <input
                type="password"
                required
                value={pwData.confirmPassword}
                onChange={e => setPwData({ ...pwData, confirmPassword: e.target.value })}
                className={`w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-colors outline-none ${
                  pwData.confirmPassword && pwData.confirmPassword !== pwData.newPassword
                    ? 'border-red-300 bg-red-50'
                    : 'border-slate-200'
                }`}
                placeholder="Repeat new password"
              />
              {pwData.confirmPassword && pwData.confirmPassword !== pwData.newPassword && (
                <p className="text-xs text-red-500 mt-1 font-medium">Passwords do not match</p>
              )}
            </div>

            {pwSuccessMsg && (
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> {pwSuccessMsg}
              </div>
            )}

            <button type="submit" disabled={pwLoading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-sm font-bold transition-all shadow-sm disabled:opacity-70 disabled:cursor-not-allowed">
              {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {pwLoading ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>

        {/* Account Info Card */}
        <div className="lg:col-span-2 bg-slate-50 rounded-2xl border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-700 mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-slate-400" /> Account Details
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Role', value: roleBadge.label },
              { label: 'Status', value: user?.isActive ? 'Active' : 'Inactive' },
              { label: 'Verified', value: user?.isVerified ? 'Yes' : 'No' },
              { label: 'User ID', value: user?._id ? String(parseInt(user._id.slice(-4), 16)).padStart(4, '0') : 'N/A' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
                <p className="text-sm font-bold text-slate-800">{value}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProfileSettings;
