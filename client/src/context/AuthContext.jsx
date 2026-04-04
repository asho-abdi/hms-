import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import api, { setAuthToken } from '../api/client.js';
import { ROLES } from '../constants/roles.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setAuthToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('hms_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    setAuthToken(token);
    try {
      const { data } = await api.get('/auth/me');
      setUser(data.user);
    } catch {
      setAuthToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAuthToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      refreshUser,
      isRole: (...roles) => user && roles.includes(user.role),
    }),
    [user, loading, logout, refreshUser]
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
