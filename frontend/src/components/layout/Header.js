import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, SunIcon, MoonIcon, KeyIcon, ArrowRightOnRectangleIcon, UserCircleIcon, XMarkIcon, MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../store/AuthContext';
import { useTheme } from '../../store/ThemeContext';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import Modal from '../common/Modal';
import { playNotificationSound } from '../../utils/notificationSound';

const NOTIF_TYPES = [
  { key: 'follow_up_due',    label: 'Follow-up Reminders' },
  { key: 'task_due',         label: 'Task Due Alerts' },
  { key: 'lead_assigned',    label: 'Lead Assignments' },
  { key: 'quotation_status', label: 'Quotation Status Changes' },
  { key: 'request_updated',  label: 'Request Updates' },
  { key: 'invoice_overdue',  label: 'Overdue Invoice Alerts' },
  { key: 'system',           label: 'System Notifications' },
];

function NotifPrefsModal({ onClose }) {
  const [prefs, setPrefs] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get('/users/me/notification-preferences')
       .then(r => setPrefs(r.data.data || {}))
       .catch(() => {})
       .finally(() => setLoading(false));
  }, []);

  const toggle = (key) => setPrefs(p => ({ ...p, [key]: !p[key] }));

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/users/me/notification-preferences', { preferences: prefs });
      toast.success('Notification preferences saved');
      onClose();
    } catch {
      toast.error('Failed to save preferences');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="py-8 text-center text-slate-400 text-sm">Loading…</div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-gray-400">
        Choose which notifications you want to receive. Disabled types will not appear in your bell or generate toasts.
      </p>
      <div className="space-y-2">
        {NOTIF_TYPES.map(({ key, label }) => {
          const enabled = prefs[key] !== false;
          return (
            <button
              key={key}
              onClick={() => toggle(key)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-navy-700 hover:border-gold-500/50 transition-all"
            >
              <span className="text-sm text-slate-700 dark:text-gray-200">{label}</span>
              <div className={`relative inline-flex h-5 w-9 rounded-full transition-colors duration-200 ${enabled ? 'bg-gold-500' : 'bg-slate-300 dark:bg-navy-600'}`}>
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${enabled ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-navy-800">
        <button className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.newPassword !== form.confirm) return toast.error('New passwords do not match');
    if (form.newPassword.length < 8) return toast.error('Password must be at least 8 characters');
    setLoading(true);
    try {
      await api.post('/users/me/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success('Password changed successfully');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="form-group">
        <label className="label">Current Password</label>
        <input type="password" className="input" required value={form.currentPassword}
          onChange={e => setForm({ ...form, currentPassword: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="label">New Password</label>
        <input type="password" className="input" required minLength={8} value={form.newPassword}
          onChange={e => setForm({ ...form, newPassword: e.target.value })} />
      </div>
      <div className="form-group">
        <label className="label">Confirm New Password</label>
        <input type="password" className="input" required value={form.confirm}
          onChange={e => setForm({ ...form, confirm: e.target.value })} />
      </div>
      <div className="flex justify-end gap-3 pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Change Password'}
        </button>
      </div>
    </form>
  );
}

export default function Header({ title }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notifs, setNotifs] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [showNotifPrefs, setShowNotifPrefs] = useState(false);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef(null);
  const profileRef = useRef(null);
  const navigate = useNavigate();
  // Track which notification ids we've already surfaced, so neither the SSE
  // stream nor the polling fallback double-toasts the same notification.
  const knownIdsRef = useRef(new Set());

  useEffect(() => {
    let es = null;
    let reconnectTimer = null;
    let pollTimer = null;
    let closed = false;
    let backoff = 2000;        // grows on repeated failures, caps at 30s

    // ── Pop-up toast for a single notification ──────────────────────────────
    const showToast = (notif) => {
      playNotificationSound();
      toast.custom(
        (t) => (
          <div
            className={`flex items-start gap-4 w-full bg-white dark:bg-navy-900
              border-2 border-gold-500 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.35)] p-5
              transition-all duration-300
              ${t.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-4 scale-95'}`}
            style={{ minWidth: 360, maxWidth: 460 }}
          >
            {/* Pulsing bell icon */}
            <div className="relative w-14 h-14 rounded-2xl bg-gold-500 flex items-center justify-center flex-shrink-0 shadow-lg">
              <BellIcon className="w-7 h-7 text-navy-950" />
              <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-white dark:border-navy-900 animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-slate-900 dark:text-white leading-snug">{notif.title}</p>
              {notif.body && (
                <p className="text-sm text-slate-600 dark:text-gray-300 mt-1.5 leading-snug">{notif.body}</p>
              )}
              <p className="text-xs text-slate-400 dark:text-gray-500 mt-2 font-medium">Just now</p>
            </div>
            <button
              onClick={() => toast.dismiss(t.id)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 transition-colors flex-shrink-0 mt-0.5 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        ),
        { duration: 8000, position: 'top-right' }
      );
    };

    // Handle one incoming notification (from SSE or polling). Dedupes by id.
    const ingest = (notif, { toastIt }) => {
      if (knownIdsRef.current.has(notif.id)) return;
      knownIdsRef.current.add(notif.id);
      setNotifs(prev => prev.some(n => n.id === notif.id) ? prev : [notif, ...prev].slice(0, 50));
      if (!notif.is_read) setUnread(prev => prev + 1);
      if (toastIt && !notif.is_read) showToast(notif);
    };

    // Full refresh — authoritative list + unread count from the server.
    // `firstLoad` seeds knownIds silently so we don't toast the backlog.
    const refresh = (firstLoad = false) =>
      api.get('/notifications')
        .then(res => {
          const list = res.data.data || [];
          if (firstLoad) {
            list.forEach(n => knownIdsRef.current.add(n.id));
            setNotifs(list);
            setUnread(res.data.unreadCount || 0);
          } else {
            // Toast any genuinely new unread notifications we hadn't seen
            [...list].reverse().forEach(n => {
              if (!knownIdsRef.current.has(n.id)) {
                knownIdsRef.current.add(n.id);
                if (!n.is_read) showToast(n);
              }
            });
            setNotifs(list);
            setUnread(res.data.unreadCount || 0);
          }
        })
        .catch(() => {});

    // ── SSE connection with auto-reconnect ──────────────────────────────────
    const connect = () => {
      const token = localStorage.getItem('access_token');
      if (!token || closed) return;
      const apiBase = process.env.REACT_APP_API_URL || '/api';
      es = new EventSource(`${apiBase}/notifications/stream?token=${encodeURIComponent(token)}`);

      es.addEventListener('init', (e) => {
        try {
          const data = JSON.parse(e.data);
          setUnread(data.unreadCount || 0);
        } catch (_) {}
        backoff = 2000;        // healthy connection → reset backoff
        refresh();             // sync full list in case anything arrived while disconnected
      });

      es.addEventListener('notification', (e) => {
        try { ingest(JSON.parse(e.data), { toastIt: true }); } catch (_) {}
      });

      es.onerror = () => {
        // Connection dropped — close and schedule a reconnect with backoff.
        if (es) { es.close(); es = null; }
        if (closed) return;
        clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          backoff = Math.min(backoff * 1.5, 30000);
          refresh();           // catch anything missed while disconnected
          connect();
        }, backoff);
      };
    };

    refresh(true);             // initial load
    connect();

    // Polling fallback — every 20s reconcile the bell even if SSE is dead.
    pollTimer = setInterval(() => refresh(), 20000);

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      clearInterval(pollTimer);
      if (es) es.close();
    };
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    await api.post('/notifications/mark-all-read');
    setNotifs(notifs.map(n => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleNotifClick = async (notif) => {
    if (!notif.is_read) {
      await api.patch(`/notifications/${notif.id}/read`);
      setNotifs(notifs.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnread(prev => Math.max(0, prev - 1));
    }
    if (notif.link) navigate(notif.link);
    setShowNotifs(false);
  };

  return (
    <>
      <header className="h-16 bg-white dark:bg-navy-950 border-b border-slate-200 dark:border-navy-800 flex items-center justify-between px-6 flex-shrink-0">
        <h1 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h1>

        <div className="flex items-center gap-2">
          {/* Search */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('open-search'))}
            className="hidden md:flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-navy-800 border border-slate-200 dark:border-navy-700 rounded-lg hover:border-gold-500 transition-colors"
            title="Search (⌘K)"
          >
            <MagnifyingGlassIcon className="w-4 h-4" />
            <span>Search...</span>
            <kbd className="ml-1 px-1.5 py-0.5 text-xs bg-slate-200 dark:bg-navy-700 rounded">⌘K</kbd>
          </button>

          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
          </button>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
              className="relative p-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-navy-800 rounded-lg transition-colors"
              aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              <BellIcon className="w-5 h-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-gold-500 text-navy-950 text-xs font-bold rounded-full flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 top-12 w-80 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl z-50">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-navy-700">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</span>
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-xs text-gold-600 dark:text-gold-400 hover:text-gold-500">Mark all read</button>
                  )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifs.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 dark:text-gray-500 text-sm">No notifications</div>
                  ) : notifs.map(n => (
                    <button key={n.id} onClick={() => handleNotifClick(n)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors border-b border-slate-100 dark:border-navy-800 last:border-0 ${!n.is_read ? 'bg-slate-50 dark:bg-navy-800/50' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        {!n.is_read && <div className="w-2 h-2 bg-gold-500 rounded-full mt-1.5 flex-shrink-0" />}
                        <div className={!n.is_read ? '' : 'ml-4'}>
                          <div className="text-xs font-medium text-slate-900 dark:text-white">{n.title}</div>
                          {n.body && <div className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{n.body}</div>}
                          <div className="text-xs text-slate-400 dark:text-gray-600 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
              className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-navy-800 transition-colors"
              aria-label="Account menu"
            >
              <div className="w-8 h-8 rounded-full bg-gold-500 flex items-center justify-center text-navy-950 font-bold text-sm">
                {user?.fullName?.[0]?.toUpperCase()}
              </div>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-52 bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-xl shadow-2xl z-50 py-1">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-navy-800">
                  <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user?.fullName}</div>
                  <div className="text-xs text-slate-500 dark:text-gray-400 truncate">{user?.role}</div>
                </div>
                <button
                  onClick={() => { setShowProfile(false); setShowChangePwd(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                >
                  <KeyIcon className="w-4 h-4" /> Change Password
                </button>
                <button
                  onClick={() => { setShowProfile(false); setShowNotifPrefs(true); }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-50 dark:hover:bg-navy-800 transition-colors"
                >
                  <AdjustmentsHorizontalIcon className="w-4 h-4" /> Notification Preferences
                </button>
                <button
                  onClick={logout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  <ArrowRightOnRectangleIcon className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <Modal isOpen={showChangePwd} onClose={() => setShowChangePwd(false)} title="Change Password" size="sm">
        <ChangePasswordModal onClose={() => setShowChangePwd(false)} />
      </Modal>

      <Modal isOpen={showNotifPrefs} onClose={() => setShowNotifPrefs(false)} title="Notification Preferences" size="sm">
        <NotifPrefsModal onClose={() => setShowNotifPrefs(false)} />
      </Modal>
    </>
  );
}
