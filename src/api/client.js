// src/lib/client.js
import axios from "axios";
import { tokenStore } from "../lib/token";

// Base URL
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Primary client for all API calls
export const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// Separate client for refresh calls only (no auth header mutation side-effects)
const refreshClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- Interceptors ---------------------------------------------------------
let interceptorsInstalled = false;
let refreshPromise = null; // de-duplicate concurrent refreshes

const getToken = () =>
  (typeof tokenStore?.get === "function" && tokenStore.get()) ||
  localStorage.getItem("accessToken") ||
  localStorage.getItem("token") ||
  "";

const setToken = (token) => {
  if (typeof tokenStore?.set === "function") tokenStore.set(token);
  else localStorage.setItem("accessToken", token || "");
};

const clearToken = () => {
  if (typeof tokenStore?.set === "function") tokenStore.set(null);
  else localStorage.removeItem("accessToken");
};

// call this once at app bootstrap, pass your router's navigate
export function setupInterceptors(navigate) {
  if (interceptorsInstalled) return;
  interceptorsInstalled = true;

  // Attach Authorization header
  client.interceptors.request.use((config) => {
    const t = getToken();
    if (t && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${t}`;
    }
    return config;
  });

  // Helper: should we attempt refresh?
  const shouldAttemptRefresh = (status, url, alreadyRetried) => {
    if (alreadyRetried) return false;
    if (!(status === 401 || status === 403)) return false;
    const isAuthEndpoint = /\/api\/users\/(login|register|refresh|logout|revoke)$/.test(String(url || ""));
    return !isAuthEndpoint;
  };

  // Refresh on 401/403, retry original once
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error?.config || {};
      const status = error?.response?.status;
      if (!status) return Promise.reject(error); // network or CORS error

      if (!shouldAttemptRefresh(status, original.url, original._retry)) {
        return Promise.reject(error);
      }

      original._retry = true;

      try {
        // De-duplicate concurrent refresh requests
        if (!refreshPromise) {
          refreshPromise = refreshClient.post("/api/users/refresh");
        }
        const r = await refreshPromise.finally(() => {
          refreshPromise = null;
        });

        const newAccess = r?.data?.accessToken;
        if (!newAccess) throw new Error("No access token from refresh");

        setToken(newAccess);
        // Update default auth header for subsequent requests
        client.defaults.headers.common.Authorization = `Bearer ${newAccess}`;
        // Retry the original request with the new token
        original.headers = original.headers || {};
        original.headers.Authorization = `Bearer ${newAccess}`;
        return client(original);
      } catch (refreshErr) {
        // If refresh failed with 401, go to login
        const refreshStatus = refreshErr?.response?.status;
        clearToken();
        if (refreshStatus === 401) {
          try { navigate("/login", { replace: true }); } catch { }
        } else if (status === 401 || status === 403) {
          // Optional: also redirect if original was auth-related
          try { navigate("/login", { replace: true }); } catch { }
        }
        return Promise.reject(refreshErr);
      }
    }
  );
}
