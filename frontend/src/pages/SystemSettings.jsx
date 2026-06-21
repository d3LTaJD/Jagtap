import React, { useState, useEffect } from 'react';
import { 
  Settings, Save, Loader2, AlertCircle, Building2, Mail, Bell, ShieldCheck, 
  CreditCard, Globe, Database, Smartphone, CheckCircle2, X
} from 'lucide-react';
import api from '../api/client';
import AutocompleteSelect from '../components/AutocompleteSelect';

const TABS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'communication', label: 'Email & WhatsApp', icon: Mail },
  { id: 'notifications', label: 'Notification Rules', icon: Bell },
  { id: 'operational', label: 'Operations & Banks', icon: Database },
];

const SystemSettings = () => {
  const [activeTab, setActiveTab] = useState('company');
  const [selectedEmailSubTab, setSelectedEmailSubTab] = useState('info');
  const [settings, setSettings] = useState({
    companyName: '', companyLogo: '', gstin: '', pan: '', registeredAddress: '',
    smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', smtpFromName: '',
    whatsappApiKey: '', firebaseConfig: '', defaultGSTRate: 18,
    quotationValidity: 30, followupReminderDays: 2, escalationThresholdDays: 5,
    quoteAbandonDays: 60, bankName: '', bankAccountNumber: '', ifscCode: '', upiId: '',
    notificationRules: {
      enquiryCreated: { email: true, whatsapp: false },
      quotationApproved: { email: true, whatsapp: true },
      followupDue: { email: true, whatsapp: false },
      taskAssigned: { email: true, whatsapp: false },
      lowInventory: { email: true, whatsapp: false }
    },
    emailAccountsConfig: {
      info: { autoReply: true, subjectTemplate: '', bodyTemplate: '' },
      sales: { autoReply: true, subjectTemplate: '', bodyTemplate: '' },
      support: { autoReply: true, subjectTemplate: '', bodyTemplate: '' }
    }
  });
  const [intervalsString, setIntervalsString] = useState('1, 3, 7');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const toggleAutoReply = (acc) => {
    setSettings(s => ({
      ...s,
      emailAccountsConfig: {
        ...s.emailAccountsConfig,
        [acc]: {
          ...s.emailAccountsConfig[acc],
          autoReply: !s.emailAccountsConfig[acc].autoReply
        }
      }
    }));
  };

  const handleTemplateChange = (acc, field, value) => {
    setSettings(s => ({
      ...s,
      emailAccountsConfig: {
        ...s.emailAccountsConfig,
        [acc]: {
          ...s.emailAccountsConfig[acc],
          [field]: value
        }
      }
    }));
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        if (res.data.data.settings) {
          const s = res.data.data.settings;
          if (s.followupIntervals) {
            setIntervalsString(s.followupIntervals.join(', '));
          }
          // Merge with defaults to ensure nested objects like notificationRules exist
          setSettings(prev => ({
            ...prev,
            ...s,
            notificationRules: {
              ...prev.notificationRules,
              ...(s.notificationRules || {})
            },
            emailAccountsConfig: {
              ...prev.emailAccountsConfig,
              ...(s.emailAccountsConfig || {})
            }
          }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await api.patch('/settings', settings);
      showToast('System settings updated successfully!');
    } catch (err) {
      showToast('Error updating settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleNotification = (key, type) => {
    setSettings(s => ({
      ...s,
      notificationRules: {
        ...s.notificationRules,
        [key]: {
          ...s.notificationRules[key],
          [type]: !s.notificationRules[key][type]
        }
      }
    }));
  };

  if (loading) return (
    <div className="p-8 flex flex-col justify-center min-h-[60vh] items-center space-y-4">
      <Loader2 className="animate-spin w-10 h-10 text-brand-600" />
      <p className="text-slate-500 font-medium animate-pulse">Loading configurations...</p>
    </div>
  );

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto animate-in fade-in duration-500">
      
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border animate-in slide-in-from-top-4 ${
          toast.type === 'error' ? 'bg-red-50 border-red-200 text-red-600' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span className="font-bold text-sm">{toast.msg}</span>
          <button onClick={() => setToast(null)}><X className="w-4 h-4 opacity-50 hover:opacity-100" /></button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3">
            <div className="p-2 bg-brand-100 rounded-xl text-brand-600">
              <Settings className="w-7 h-7" />
            </div>
            System Settings
          </h1>
          <p className="text-slate-500 mt-2 font-medium">Control your company profile, technical integrations, and operational rules.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving} 
          className="group relative inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white text-sm font-black rounded-2xl hover:bg-brand-600 transition-all duration-300 shadow-xl shadow-slate-200 disabled:opacity-50 overflow-hidden"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5 group-hover:scale-110 transition-transform" />}
          <span>Save Changes</span>
          <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
        </button>
      </div>

      {/* Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar Tabs */}
        <div className="lg:col-span-3 space-y-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                activeTab === tab.id 
                ? 'bg-brand-600 text-white shadow-lg shadow-brand-200 translate-x-1' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <tab.icon className={`w-5 h-5 ${activeTab === tab.id ? 'text-white' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          ))}
          
          <div className="mt-8 p-5 bg-slate-50 rounded-3xl border border-slate-200">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">System Info</h4>
            <div className="space-y-2">
              <p className="text-[11px] font-bold text-slate-600 flex justify-between">Version <span className="text-slate-400">v1.2.4</span></p>
              <p className="text-[11px] font-bold text-slate-600 flex justify-between">Environment <span className="text-emerald-600">Production</span></p>
              <p className="text-[11px] font-bold text-slate-600 flex justify-between">Server <span className="text-slate-400">Stable</span></p>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="lg:col-span-9">
          <div className="bg-white rounded-[2.5rem] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
            
            {/* 1. Company Profile */}
            {activeTab === 'company' && (
              <div className="p-8 lg:p-10 space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Company Identity</h2>
                    <p className="text-sm text-slate-500">Legal details and branding assets.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Company Full Name</label>
                    <input 
                      type="text" value={settings.companyName} 
                      onChange={e => setSettings({...settings, companyName: e.target.value})}
                      placeholder="e.g. Petro Valve"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Brand Logo URL</label>
                    <input 
                      type="text" value={settings.companyLogo} 
                      onChange={e => setSettings({...settings, companyLogo: e.target.value})}
                      placeholder="https://..."
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">GSTIN Number</label>
                    <input 
                      type="text" value={settings.gstin} 
                      onChange={e => setSettings({...settings, gstin: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">PAN Card Number</label>
                    <input 
                      type="text" value={settings.pan} 
                      onChange={e => setSettings({...settings, pan: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none" 
                    />
                  </div>
                  <div className="md:col-span-2 space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Registered Address</label>
                    <textarea 
                      value={settings.registeredAddress} 
                      onChange={e => setSettings({...settings, registeredAddress: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 transition-all outline-none resize-none" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* 2. Communication Config */}
            {activeTab === 'communication' && (
              <div className="p-8 lg:p-10 space-y-10 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                    <Mail className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Email Configuration</h2>
                    <p className="text-sm text-slate-500">SMTP details for system-generated emails.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">SMTP Host</label>
                    <input type="text" value={settings.smtpHost} onChange={e => setSettings({...settings, smtpHost: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">SMTP Port</label>
                    <input type="number" value={settings.smtpPort} onChange={e => setSettings({...settings, smtpPort: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">SMTP Username</label>
                    <input type="text" value={settings.smtpUser} onChange={e => setSettings({...settings, smtpUser: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">SMTP Password</label>
                    <input type="password" value={settings.smtpPass} onChange={e => setSettings({...settings, smtpPass: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" placeholder="••••••••" />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-10 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Auto-Acknowledgement Templates</h2>
                      <p className="text-sm text-slate-500">Configure auto-acknowledgement emails sent on receipt per email address.</p>
                    </div>
                  </div>

                  <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
                    {['info', 'sales', 'support'].map(acc => (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => setSelectedEmailSubTab(acc)}
                        className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all ${
                          selectedEmailSubTab === acc
                            ? 'bg-white text-brand-600 shadow-sm'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {acc}@petrovalves.co.in
                      </button>
                    ))}
                  </div>

                  <div className="space-y-6 bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                    <div className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-150 shadow-sm">
                      <div>
                        <h4 className="text-sm font-black text-slate-900">Enable Auto-Acknowledgement</h4>
                        <p className="text-xs text-slate-500">Automatically reply to incoming emails received on this inbox.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleAutoReply(selectedEmailSubTab)}
                        className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shadow-inner ${
                          settings.emailAccountsConfig?.[selectedEmailSubTab]?.autoReply ? 'bg-brand-600' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                          settings.emailAccountsConfig?.[selectedEmailSubTab]?.autoReply ? 'translate-x-6' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Subject Template</label>
                      <input 
                        type="text" 
                        value={settings.emailAccountsConfig?.[selectedEmailSubTab]?.subjectTemplate || ''} 
                        onChange={e => handleTemplateChange(selectedEmailSubTab, 'subjectTemplate', e.target.value)}
                        disabled={!settings.emailAccountsConfig?.[selectedEmailSubTab]?.autoReply}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none disabled:opacity-50 disabled:cursor-not-allowed" 
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Body Template</label>
                      <textarea 
                        rows={6}
                        value={settings.emailAccountsConfig?.[selectedEmailSubTab]?.bodyTemplate || ''} 
                        onChange={e => handleTemplateChange(selectedEmailSubTab, 'bodyTemplate', e.target.value)}
                        disabled={!settings.emailAccountsConfig?.[selectedEmailSubTab]?.autoReply}
                        className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed" 
                      />
                    </div>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-xs text-blue-700 space-y-2">
                      <p className="font-bold flex items-center gap-1.5">
                        <AlertCircle className="w-4 h-4" /> Available Placeholders
                      </p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li><strong>{`{refs}`}</strong>: Replaced by the generated Enquiry ID(s) (e.g. <code>ENQ-2026-06-0001</code>). Only valid in Subject.</li>
                        <li><strong>{`{contactName}`}</strong>: Replaced by the customer's contact name.</li>
                        <li><strong>{`{itemsText}`}</strong>: Replaced by the list of registered products/items in the enquiry.</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">WhatsApp & Cloud</h2>
                      <p className="text-sm text-slate-500">API keys for mobile communication.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">WhatsApp Business API Key</label>
                      <input type="password" value={settings.whatsappApiKey} onChange={e => setSettings({...settings, whatsappApiKey: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" placeholder="Left blank for now" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Firebase FCM Config Key</label>
                      <input type="password" value={settings.firebaseConfig} onChange={e => setSettings({...settings, firebaseConfig: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" placeholder="Left blank for now" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Notification Rules */}
            {activeTab === 'notifications' && (
              <div className="p-8 lg:p-10 space-y-8 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center">
                    <Bell className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Notification Rules</h2>
                    <p className="text-sm text-slate-500">Enable or disable specific system alerts.</p>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-[2rem] border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-12 px-6 py-4 border-b border-slate-200 bg-slate-100/50">
                    <div className="col-span-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Event Trigger</div>
                    <div className="col-span-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Email</div>
                    <div className="col-span-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">WhatsApp</div>
                  </div>
                  
                  <div className="divide-y divide-slate-200">
                    {[
                      { key: 'enquiryCreated', label: 'New Enquiry Created', desc: 'When a lead is submitted.' },
                      { key: 'quotationApproved', label: 'Quotation Approved', desc: 'When Director/Admin signs off.' },
                      { key: 'followupDue', label: 'Follow-up Due', desc: 'Reminder for pending follow-ups.' },
                      { key: 'taskAssigned', label: 'Task Assigned', desc: 'When a new task is given to a user.' },
                      { key: 'lowInventory', label: 'Low Inventory Alert', desc: 'When items fall below threshold.' },
                    ].map(rule => (
                      <div key={rule.key} className="grid grid-cols-12 px-6 py-5 items-center hover:bg-white transition-colors">
                        <div className="col-span-6">
                          <p className="text-sm font-black text-slate-900">{rule.label}</p>
                          <p className="text-xs text-slate-500">{rule.desc}</p>
                        </div>
                        <div className="col-span-3 flex justify-center">
                          <button 
                            type="button"
                            onClick={() => toggleNotification(rule.key, 'email')}
                            className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shadow-inner ${settings.notificationRules?.[rule.key]?.email ? 'bg-brand-600' : 'bg-slate-300'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.notificationRules?.[rule.key]?.email ? 'translate-x-6' : 'translate-x-0'}`} />
                          </button>
                        </div>
                        <div className="col-span-3 flex justify-center">
                          <button 
                            type="button"
                            onClick={() => toggleNotification(rule.key, 'whatsapp')}
                            className={`w-12 h-6 rounded-full transition-all flex items-center px-1 shadow-inner ${settings.notificationRules?.[rule.key]?.whatsapp ? 'bg-emerald-600' : 'bg-slate-300'}`}
                          >
                            <div className={`w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${settings.notificationRules?.[rule.key]?.whatsapp ? 'translate-x-6' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 4. Operational & Banks */}
            {activeTab === 'operational' && (
              <div className="p-8 lg:p-10 space-y-10 animate-in slide-in-from-right-4 duration-300">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center">
                    <Database className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Operational Defaults</h2>
                    <p className="text-sm text-slate-500">Business logic thresholds and tax settings.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Default GST Rate (%)</label>
                    <AutocompleteSelect 
                      options={[{ value: '0', label: '0%' }, { value: '5', label: '5%' }, { value: '12', label: '12%' }, { value: '18', label: '18%' }, { value: '28', label: '28%' }]} 
                      value={String(settings.defaultGSTRate)} 
                      onChange={v => setSettings({...settings, defaultGSTRate: Number(v)})} 
                      placeholder="Select GST rate..." 
                      allowClear={false} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Quotation Validity (days)</label>
                    <input type="number" min="1" value={settings.quotationValidity} onChange={e => setSettings({...settings, quotationValidity: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Follow-up Reminder (days)</label>
                    <input type="number" min="1" value={settings.followupReminderDays} onChange={e => setSettings({...settings, followupReminderDays: Number(e.target.value)})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Follow-up Intervals (days)</label>
                    <input 
                      type="text" 
                      value={intervalsString} 
                      onChange={e => {
                        const val = e.target.value;
                        setIntervalsString(val);
                        const arr = val.split(',')
                          .map(v => parseInt(v.trim(), 10))
                          .filter(v => !isNaN(v) && v >= 0);
                        setSettings(prev => ({...prev, followupIntervals: arr}));
                      }} 
                      placeholder="e.g. 1, 3, 7" 
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" 
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900">Bank Details</h2>
                      <p className="text-sm text-slate-500">Information printed on technical quotations.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Bank Name</label>
                      <input type="text" value={settings.bankName} onChange={e => setSettings({...settings, bankName: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">Account Number</label>
                      <input type="text" value={settings.bankAccountNumber} onChange={e => setSettings({...settings, bankAccountNumber: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">IFSC Code</label>
                      <input type="text" value={settings.ifscCode} onChange={e => setSettings({...settings, ifscCode: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-wider ml-1">UPI ID</label>
                      <input type="text" value={settings.upiId} onChange={e => setSettings({...settings, upiId: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:ring-4 focus:ring-brand-500/10 outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
