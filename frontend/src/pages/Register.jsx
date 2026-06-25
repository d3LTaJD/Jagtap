import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Database, Lock, Mail, Loader2, AlertCircle, User, Phone } from 'lucide-react';
import api from '../api/client';

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    mobile: '',
    password: ''
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await api.post('/auth/register', formData);
      
      if (response.data.token) {
        sessionStorage.setItem('token', response.data.token);
        sessionStorage.setItem('user', JSON.stringify(response.data.data.user || {}));
        navigate('/app');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 right-0 -m-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-0 left-0 -m-32 w-96 h-96 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/5 p-8 relative z-10 my-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-brand-100 rounded-2xl mb-4">
            <Database className="w-7 h-7 text-brand-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Create an Account</h1>
          <p className="text-sm text-slate-500 mt-2">Join IndusFlow to optimize your workflows</p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900" placeholder="John Doe" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="email" name="email" required value={formData.email} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900" placeholder="john@company.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input type="tel" name="mobile" required value={formData.mobile} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900" placeholder="9876543210" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="password" name="password" required minLength="6" value={formData.password} onChange={handleChange} className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all text-slate-900" placeholder="••••••••" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full relative flex items-center justify-center py-3 px-4 bg-brand-600 hover:bg-brand-700 focus:ring-4 focus:ring-brand-500/20 text-white font-bold rounded-xl text-sm transition-all shadow-sm shadow-brand-500/30 disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create Account'}
          </button>
        </form>
        
        <p className="text-center text-sm text-slate-600 mt-6">
          Already have an account? <Link to="/login" className="font-bold text-brand-600 hover:text-brand-700">Sign in here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
