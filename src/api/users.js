import { client } from './client';
import { tokenStore } from '../lib/token';

export const registerUser = (payload) =>
  client.post('/api/users/register', payload).then(r => r.data);

export const loginUser = async (usernameOrEmail, password) => {
  const { data } = await client.post('/api/users/login', { usernameOrEmail, password });
  tokenStore.set(data.accessToken);
  return data;
};

export const logoutUser = async () => {
  await client.post('/api/users/logout');
  tokenStore.set(null);
};

export const getMe = () =>
  client.get('/api/users/me').then(r => r.data);

export const getPublicProfile = (username) =>
  client.get(`/api/users/profile/${encodeURIComponent(username)}`).then(r => r.data);

export const updateMe = (patch) =>
  client.patch('/api/users/me', patch).then(r => r.data);

export const followUser = (username) =>
  client.post(`/api/users/follow/${encodeURIComponent(username)}`).then(r => r.data);

export const unfollowUser = (username) =>
  client.post(`/api/users/unfollow/${encodeURIComponent(username)}`).then(r => r.data);

export const listFollowers = (username) =>
  client.get(`/api/users/followers/${encodeURIComponent(username)}`).then(r => r.data);

export const listFollowing = (username) =>
  client.get(`/api/users/following/${encodeURIComponent(username)}`).then(r => r.data);

export const uploadAvatar = (file) => {
  const fd = new FormData();
  fd.append('avatar', file);
  return client.post('/api/users/me/avatar', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const uploadCover = (file) => {
  const fd = new FormData();
  fd.append('cover', file);
  return client.post('/api/users/me/cover', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data); // -> { coverUrl }
};

// optional helper to remove cover via PATCH:
export const clearCover = () =>
  client.patch('/api/users/me', { coverUrl: null }).then(r => r.data);