import { client } from './client';

export const createPost = (text) =>
  client.post('/api/posts', { text }).then(r => r.data);

export const deletePost = (id) =>
  client.delete(`/api/posts/${id}`).then(r => r.data);

export const getFeed = (page=1, limit=10) =>
  client.get(`/api/posts/feed`, { params: { page, limit } }).then(r => r.data);

export const getPostsByUser = (username) =>
  client.get(`/api/posts/user/${encodeURIComponent(username)}`).then(r => r.data);

export const toggleLike = (id) =>
  client.post(`/api/posts/${id}/like`).then(r => r.data);

export const addComment = (id, text) =>
  client.post(`/api/posts/${id}/comments`, { text }).then(r => r.data);

export const listComments = (id) =>
  client.get(`/api/posts/${id}/comments`).then(r => r.data);
