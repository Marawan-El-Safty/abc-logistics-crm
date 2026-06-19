import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { syncOfflineQueue } from '../services/api';
import { useInactivityTimer } from '../hooks/useInactivityTimer';
import InactivityWarning from '../components/InactivityWarning';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWarning, setShowWarning] = useState(false);
  const [settings, setSettings] = useState(null);

  const refreshSettings = useCallback(() => {
    return api.get('/settings')
      .then(res => { setSettings(res.data.data); return res.data.data; })
      .catch(() => null);
  }, []);

  const logout = useCallback(async (reason = 'manual') => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) await api.post('/auth/logout', { refreshToken, reason });
    } catch (_) {}
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
    setShowWarning(false);
  }, []);

  const { reset: resetTimer } = useInactivityTimer({
    enabled: !!user,
    onWarning: useCallback(() => setShowWarning(true), []),
    onTimeout: useCallback(() => logout('timeout'), [logout]),
    warningMinutes: settings?.session?.warningMinutes ?? 25,
    timeoutMinutes: settings?.session?.timeoutMinutes ?? 30,
  });

  const stayLoggedIn = useCallback(() => {
    setShowWarning(false);
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      api.get('/auth/me')
        .then((res) => { setUser(res.data); refreshSettings(); })
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [logout]);

  useEffect(() => {
    const handleOnline = () => syncOfflineQueue();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData } = res.data;
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser(userData);
    refreshSettings();
    return userData;
  };

  const isAdmin = user?.role === 'Admin';
  const isManager = user?.role === 'Sales Manager';
  const isRep = user?.role === 'Sales Rep';
  const isFinance = user?.role === 'Finance';
  const isOperation = user?.role === 'Operation';
  const isViewer = user?.role === 'Viewer';
  const isOwner = user?.tenantRole === 'owner';
  const tenantRole = user?.tenantRole || 'member';
  const canManage = isAdmin || isManager;
  const canAdminTeam = isAdmin || isOwner;

  return (
    <AuthContext.Provider value={{
      user, login, logout, loading,
      isAdmin, isManager, isRep, isFinance, isOperation, isViewer, isOwner,
      tenantRole, canManage, canAdminTeam,
      settings, refreshSettings,
    }}>
      {children}
      {showWarning && (
        <InactivityWarning
          onStayLoggedIn={stayLoggedIn}
          onLogout={() => logout('manual')}
        />
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
