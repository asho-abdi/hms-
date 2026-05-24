import axios from 'axios';
import {
  getAccessToken,
  setAccessToken,
  clearAccessToken,
  migrateLegacyToken,
} from '../utils/tokenStorage.js';

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  timeout: 30000,
});

let refreshPromise = null;

function applyAuthHeader(token) {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common.Authorization;
  }
}

export function setAuthToken(token) {
  setAccessToken(token);
  applyAuthHeader(token);
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api
      .post('/auth/refresh')
      .then(({ data }) => {
        if (data?.token) {
          setAuthToken(data.token);
          return data;
        }
        throw new Error('No token in refresh response');
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export function clearSession() {
  clearAccessToken();
  applyAuthHeader(null);
}

const initial = migrateLegacyToken();
if (initial) applyAuthHeader(initial);

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (err) => {
    const original = err.config;
    const status = err.response?.status;
    const url = original?.url || '';

    if (
      status === 401 &&
      !original?._retry &&
      !url.includes('/auth/login') &&
      !url.includes('/auth/refresh')
    ) {
      original._retry = true;
      try {
        await refreshAccessToken();
        return api(original);
      } catch {
        clearSession();
        if (!window.location.pathname.startsWith('/login')) {
          window.location.assign('/login');
        }
      }
    }

    return Promise.reject(err);
  }
);

export default api;
