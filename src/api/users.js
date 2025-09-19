// src/api/users.js
// Clean user API (no interceptor logic here)
// Uses src/lib/client.js which handles auth headers and refresh.

import { client } from "./client";
import { tokenStore } from "../lib/token";

/* ---------------------------------------
   Auth
--------------------------------------- */
export const registerUser = (payload) =>
  client.post("/api/users/register", payload).then((r) => r.data);

export const loginUser = async (usernameOrEmail, password) => {
  const { data } = await client.post("/api/users/login", { usernameOrEmail, password });
  if (data?.accessToken) {
    // store access token for client interceptor to attach
    if (typeof tokenStore?.set === "function") tokenStore.set(data.accessToken);
    else localStorage.setItem("accessToken", data.accessToken);
  }
  return data;
};

export const logoutUser = async () => {
  await client.post("/api/users/logout"); // clears httpOnly refresh cookie server-side
  if (typeof tokenStore?.set === "function") tokenStore.set(null);
  else localStorage.removeItem("accessToken");
};

// Optional: manual refresh trigger (not required for normal flow)
export const refreshAccessToken = async () => {
  const { data } = await client.post("/api/users/refresh");
  if (data?.accessToken) {
    if (typeof tokenStore?.set === "function") tokenStore.set(data.accessToken);
    else localStorage.setItem("accessToken", data.accessToken);
  }
  return data?.accessToken;
};

// Optional: revoke all sessions (bumps tokenVersion)
export const revokeSessions = () =>
  client.post("/api/users/revoke").then((r) => r.data);

/* ---------------------------------------
   Me / Profile
--------------------------------------- */
export const getMe = () => client.get("/api/users/me").then((r) => r.data);

export const getPublicProfile = (username) =>
  client.get(`/api/users/profile/${encodeURIComponent(username)}`).then((r) => r.data);

export const updateMe = (patch) =>
  client.patch("/api/users/me", patch).then((r) => r.data);

export const updateTheme = (theme) =>
  client.patch("/api/users/me/theme", { theme }).then((r) => r.data);

/* ---------------------------------------
   Social graph
--------------------------------------- */
export const followUser = (username) =>
  client.post(`/api/users/follow/${encodeURIComponent(username)}`).then((r) => r.data);

export const unfollowUser = (username) =>
  client.post(`/api/users/unfollow/${encodeURIComponent(username)}`).then((r) => r.data);

export const listFollowers = (username) =>
  client.get(`/api/users/followers/${encodeURIComponent(username)}`).then((r) => r.data);

export const listFollowing = (username) =>
  client.get(`/api/users/following/${encodeURIComponent(username)}`).then((r) => r.data);

/* ---------------------------------------
   Search
--------------------------------------- */
export const searchUsers = (q) =>
  client.get(`/api/users/search?q=${encodeURIComponent(q || "")}`).then((r) => r.data);

/* ---------------------------------------
   Media uploads (with optional progress)
--------------------------------------- */
export const uploadAvatar = (file, onProgress) => {
  const fd = new FormData();
  fd.append("avatar", file);
  return client
    .post("/api/users/me/avatar", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) =>
        onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
    .then((r) => r.data);
};

export const uploadCover = (file, onProgress) => {
  const fd = new FormData();
  fd.append("cover", file);
  return client
    .post("/api/users/me/cover", fd, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) =>
        onProgress?.(Math.round((e.loaded * 100) / (e.total || 1))),
    })
    .then((r) => r.data); // -> { coverUrl }
};

export const clearCover = () =>
  client.patch("/api/users/me", { coverUrl: null }).then((r) => r.data);

/* ---------------------------------------
   Convenience
--------------------------------------- */
export const isLoggedIn = () => {
  const t =
    (typeof tokenStore?.get === "function" && tokenStore.get()) ||
    localStorage.getItem("accessToken") ||
    localStorage.getItem("token");
  return Boolean(t);
};
