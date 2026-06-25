import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Menu, Bell, Search, Check, Loader2, FileText, Users, ClipboardList, X, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { getRoleDisplayName } from '../context/AbilityContext';

const TYPE_ICON = {
  Enquiry:   FileText,
  Customer:  Users,
  Quotation: ClipboardList,
};

const TYPE_COLOR = {
  Enquiry:   'text-blue-600 bg-blue-50',
  Customer:  'text-emerald-600 bg-emerald-50',
  Quotation: 'text-purple-600 bg-purple-50',
};

const Navbar = ({ onMenuClick }) => {
  const [notifications, setNotifications] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Search state
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef(null);
  const searchTimeout = useRef(null);

  const navigate = useNavigate();
  const currentUser = JSON.parse(sessionStorage.getItem('user') || '{}');

  const getInitials = (name) => {
    if (!name) return 'U';
    return name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  };

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data.notifications);
    } catch (err) { console.error('Failed to fetch notifications'); }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  // Close notification dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setShowDropdown(false);
      if (searchRef.current && !searchRef.current.contains(event.target)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  const doSearch = useCallback(async (q) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data.data.results || []);
    } catch (err) {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setShowSearch(true);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSearchSelect = (result) => {
    setQuery('');
    setSearchResults([]);
    setShowSearch(false);
    navigate(result.link);
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(notifications.map(n => n._id === id ? { ...n, is_read: true } : n));
    } catch (err) {}
  };

  const markAllAsRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    } catch (err) {}
  };

  const handleNotificationClick = (notif) => {
    markAsRead(notif._id);
    setShowDropdown(false);
    const id = notif.related_id;
    if (notif.type?.includes('TASK')) {
      navigate('/app/tasks');
    } else if (notif.type?.includes('ENQUIRY') || notif.type?.includes('FOLLOWUP') || notif.type?.includes('FOLLOW_UP') || notif.type?.includes('REMINDER') || notif.type?.includes('ESCALATION') || notif.type?.includes('URGENT')) {
      navigate(id ? `/app/enquiries/${id}` : '/app/enquiries');
    } else if (notif.type?.includes('QUOTE') || notif.type?.includes('QUOTATION')) {
      navigate(id ? `/app/quotations/${id}` : '/app/quotations');
    } else if (notif.type?.includes('QAP')) {
      navigate(id ? `/app/qaps/${id}` : '/app/qaps');
    } else {
      navigate('/app');
    }
  };

  return (
    <header className="glass-panel h-16 flex flex-col justify-center px-4 sm:px-6 lg:px-8 z-20 shrink-0 shadow-sm relative">
      <div className="flex items-center justify-between w-full h-full">
        <div className="flex items-center gap-4">
          <button onClick={onMenuClick} className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"><Menu className="w-6 h-6" /></button>

          {/* Global Search / AI Prompt */}
          <div ref={searchRef} className="relative hidden sm:block">
            <div className={`flex items-center bg-white px-4 py-2.5 rounded-xl border border-slate-200 transition-all shadow-sm w-[400px] ${showSearch ? 'border-brand-400 ring-4 ring-brand-500/10' : 'hover:border-slate-300 focus-within:border-brand-400 focus-within:ring-4 focus-within:ring-brand-500/10'}`}>
              <Sparkles className={`w-4 h-4 shrink-0 transition-colors ${showSearch || query ? 'text-brand-500' : 'text-slate-400'}`} />
              <input
                type="text"
                value={query}
                onChange={handleSearchChange}
                onFocus={() => { setShowSearch(true); if (query.length >= 2) doSearch(query); }}
                placeholder="AI Search anything..."
                className="bg-transparent border-none outline-none focus:ring-0 text-sm ml-3 w-full text-slate-700 placeholder:text-slate-400 font-medium"
              />
              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded ml-2 shrink-0">
                <span>⌘</span><span>K</span>
              </div>
              {query && (
                <button onClick={() => { setQuery(''); setSearchResults([]); setShowSearch(false); }} className="text-slate-400 hover:text-slate-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showSearch && (query.length >= 2) && (
              <div className="absolute top-full mt-2 left-0 w-96 bg-white rounded-xl shadow-xl border border-slate-200 overflow-hidden z-50 animate-in slide-in-from-top-1 duration-150">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-slate-400 text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Searching…
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-8 text-center text-sm text-slate-400">No results found for "{query}"</div>
                ) : (
                  <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                    {searchResults.map((r, i) => {
                      const Icon = TYPE_ICON[r.type] || FileText;
                      return (
                        <button
                          key={i}
                          onClick={() => handleSearchSelect(r)}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-slate-50 text-left transition-colors"
                        >
                          <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${TYPE_COLOR[r.type]}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold text-slate-900 truncate">{r.title}</p>
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{r.type}</span>
                            </div>
                            <p className="text-xs text-slate-500 truncate mt-0.5">{r.subtitle}</p>
                          </div>
                          {r.status && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full shrink-0 self-center">{r.status}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 relative">
          {/* Notification Bell */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="relative p-2 text-slate-400 hover:text-brand-600 hover:bg-slate-50 rounded-full transition-colors animate-in"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white font-extrabold text-[9px] h-4.5 min-w-[18px] rounded-full flex items-center justify-center border border-white shadow-sm px-1 transform translate-x-1 -translate-y-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <h3 className="font-bold text-slate-800">Notifications</h3>
                  {unreadCount > 0 && (
                    <button onClick={markAllAsRead} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Mark all as read</button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                      <Bell className="w-8 h-8 text-slate-200 mb-2" />
                      <p className="text-sm">You have no notifications</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {notifications.map(n => (
                        <div
                          key={n._id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${!n.is_read ? 'bg-brand-50/30' : ''}`}
                        >
                          <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${!n.is_read ? 'bg-brand-500' : 'bg-transparent'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm tracking-tight ${!n.is_read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>{n.title}</p>
                            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                            <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-wider">{new Date(n.created_at).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Profile Block */}
          <div className="flex items-center gap-3 ml-2 pl-4 border-l border-slate-200">
            <div className="hidden md:block text-right">
              <p className="text-sm font-bold text-slate-900 leading-tight">{currentUser.fullName || 'My Profile'}</p>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5 uppercase tracking-wider">{getRoleDisplayName(currentUser.role)}</p>
            </div>
            <div className="relative p-[2px] rounded-full bg-gradient-to-tr from-brand-500 to-violet-500 hover:shadow-lg hover:shadow-brand-500/20 transition-all cursor-pointer group">
              <div
                onClick={() => navigate('/app/profile')}
                className="h-10 w-10 bg-white text-slate-800 rounded-full flex items-center justify-center font-black text-sm select-none shadow-inner overflow-hidden"
              >
                {getInitials(currentUser.fullName)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
