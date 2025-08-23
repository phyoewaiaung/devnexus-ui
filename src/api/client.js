import axios from 'axios';
import { tokenStore } from '../lib/token';

// Use Vite proxy: baseURL '' means calls like /api/... go to backend via proxy
export const client = axios.create({
  baseURL: '',
  withCredentials: true, // needed for refresh cookie
  headers: { 'Content-Type': 'application/json' },
});

// separate client without auth header for refresh to avoid loops
const refreshClient = axios.create({
  baseURL: '',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Attach Authorization for normal requests
client.interceptors.request.use((config) => {
  const t = tokenStore.get();
  if (t && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

// If 401, try refresh once, then retry original
client.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error?.response?.status;

    if (status === 401 && !original._retry) {
      original._retry = true;
      try {
        const r = await refreshClient.post('/api/users/refresh', {});
        const newAccess = r.data?.accessToken;
        if (newAccess) {
          tokenStore.set(newAccess);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newAccess}`;
          return client(original);
        }
      } catch (e) {
        console.error('Refresh failed:', e);
        // fall through
      }
      tokenStore.set(null);
    }
    return Promise.reject(error);
  }
);
