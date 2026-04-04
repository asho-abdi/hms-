import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('hms_token');
      delete api.defaults.headers.common.Authorization;
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(err);
  }
);

export function setAuthToken(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
    localStorage.setItem('hms_token', token);
  } else {
    delete api.defaults.headers.common.Authorization;
    localStorage.removeItem('hms_token');
  }
}

const existing = localStorage.getItem('hms_token');
if (existing) {
  api.defaults.headers.common.Authorization = `Bearer ${existing}`;
}

export default api;
