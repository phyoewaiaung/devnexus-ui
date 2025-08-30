// src/lib/client.js
import axios from "axios";
import { tokenStore } from "../lib/token";

export const client = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

const refreshClient = axios.create({
  baseURL: "",
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

export function setupInterceptors(navigate) {
  // attach auth header
  client.interceptors.request.use((config) => {
    const t = tokenStore.get();
    if (t && !config.headers?.Authorization) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${t}`;
    }
    return config;
  });

  // refresh logic
  client.interceptors.response.use(
    (res) => res,
    async (error) => {
      const original = error.config || {};
      const status = error?.response?.status;

      if (status === 401 && !original._retry) {
        original._retry = true;
        try {
          const r = await refreshClient.post("/api/users/refresh", {});
          const newAccess = r.data?.accessToken;
          if (newAccess) {
            tokenStore.set(newAccess);
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${newAccess}`;
            return client(original);
          }
        } catch (e) {
          console.error("Refresh failed:", e);
        }
        tokenStore.set(null);
        navigate("/login", { replace: true }); // 🔑 redirect to login
      }

      return Promise.reject(error);
    }
  );
}
