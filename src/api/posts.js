import { client } from './client';

export const createPost = ({ text, image, tags }) => {
  const fd = new FormData();
  if (text) fd.append('text', text);
  if (image) fd.append('image', image);
  if (Array.isArray(tags)) fd.append('tags', tags.join(','));
  else if (typeof tags === 'string') fd.append('tags', tags);

  return client
    .post('/api/posts', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true,
    })
    .then(r => r.data); // { post }
};

export const deletePost = (id) =>
  client.delete(`/api/posts/${id}`).then(r => r.data);

export const getFeed = (page = 1, limit = 10) =>
  client.get(`/api/posts/feed`, { params: { page, limit } }).then(r => r.data);

export const getPostsByUser = (username) =>
  client.get(`/api/posts/user/${encodeURIComponent(username)}`).then(r => r.data);

export const toggleLike = (id) =>
  client.post(`/api/posts/${id}/like`).then(r => r.data);

export const addComment = (id, text) =>
  client.post(`/api/posts/${id}/comments`, { text }).then(r => r.data);

export const listComments = (id) =>
  client.get(`/api/posts/${id}/comments`).then(r => r.data);

/* ---------------- NEW: get single post detail ---------------- */
export const getPostById = (id) =>
  client.get(`/api/posts/${id}`).then(r => r.data); // { post }
