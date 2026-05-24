import { createContext, useContext, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import api, { setAuthToken, clearSession, refreshAccessToken } from '../api/client.js';
import { getAccessToken, getAccessTokenExpiryMs } from '../utils/tokenStorage.js';
import { ROLES } from '../constants/roles.js';

const AuthContext = createContext(null);

const REFRESH_BEFORE_MS = 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const expiryTimerRef = useRef(null);

  const clearExpiryTimer = useCallback(() => {
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
  }, []);

  const scheduleTokenRefresh = useCallback(() => {
    clearExpiryTimer();
    const token = getAccessToken();
    const expMs = getAccessTokenExpiryMs(token);
    if (!expMs) return;

    const delay = Math.max(expMs - Date.now() - REFRESH_BEFORE_MS, 5000);
    expiryTimerRef.current = setTimeout(async () => {
      try {
        const data = await refreshAccessToken();
        setUser(data.user);
        scheduleTokenRefresh();
      } catch {
        clearSession();
        setUser(null);
      }
    }, delay);
  }, [clearExpiryTimer]);

  const logout = useCallback(async () => {
    clearExpiryTimer();
    try {
      await api.post('/auth/logout');
    } catch {
      /* still clear local session */
    }
    clearSession();
    setUser(null);
    setLoading(false);
  }, [clearExpiryTimer]);

  const refreshUser = useCallback(async () => {
    const tokenAtStart = getAccessToken();
    if (!tokenAtStart) {
      setUser(null);
      setLoading(false);
      return;
    }
    setAuthToken(tokenAtStart);
    try {
      const { data } = await api.get('/auth/me');
      if (getAccessToken() !== tokenAtStart) return;
      setUser(data.user);
      scheduleTokenRefresh();
    } catch {
      try {
        const data = await refreshAccessToken();
        setUser(data.user);
        scheduleTokenRefresh();
      } catch {
        clearSession();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, [scheduleTokenRefresh]);

  useEffect(() => {
    refreshUser();
    return () => clearExpiryTimer();
  }, [refreshUser, clearExpiryTimer]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      setAuthToken(data.token);
      setUser(data.user);
      scheduleTokenRefresh();
      return data.user;
    },
    [scheduleTokenRefresh]
  );

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      isRole: (...roles) => user && roles.includes(user.role),
    }),
    [user, loading, logout, refreshUser, login]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function dashboardPathForRole(role) {
  switch (role) {
    case ROLES.ADMIN:
      return '/dashboard/admin';
    case ROLES.DOCTOR:
      return '/dashboard/doctor';
    case ROLES.RECEPTIONIST:
      return '/dashboard/reception';
    case ROLES.LAB:
      return '/dashboard/lab';
    default:
      return '/login';
  }
}
