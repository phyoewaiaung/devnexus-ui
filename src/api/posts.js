// src/api/posts.js
import { client } from './client';

/** Create a post (text, optional image, tags, visibility) */
export const createPost = ({ text, image, tags, visibility }) => {
  const fd = new FormData();
  if (text) fd.append('text', text);
  if (image) fd.append('image', image);
  if (Array.isArray(tags)) fd.append('tags', tags.join(','));
  else if (typeof tags === 'string') fd.append('tags', tags);
  if (visibility) fd.append('visibility', String(visibility).toLowerCase()); // 'public' | 'followers'

  return client
    .post('/api/posts', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true,
    })
    .then((r) => r.data); // { post }
};

/** Delete a post by id */
export const deletePost = (id) =>
  client.delete(`/api/posts/${id}`).then((r) => r.data);

/**
 * Get feed (for-you | following) with optional lang/tag filters.
 * Normalizes likesCount, commentsCount, shareCount for safety.
 */
export const getFeed = (page = 1, limit = 10, opts = {}) => {
  const { type = 'for-you', lang, tag } = opts || {};
  const endpoint =
    type === 'following' ? '/api/posts/feed/following' : '/api/posts/feed';

  const params = { page, limit };
  if (lang) params.lang = Array.isArray(lang) ? lang.join(',') : String(lang);
  if (tag) params.tag = Array.isArray(tag) ? tag.join(',') : String(tag);

  return client
    .get(endpoint, { params, withCredentials: true })
    .then((r) => {
      const {
        posts = [],
        page: respPage = page,
        limit: respLimit = limit,
      } = r.data || {};

      const normalized = posts.map((p) => ({
        ...p,
        likesCount:
          typeof p.likesCount === 'number'
            ? p.likesCount
            : Array.isArray(p.likes)
              ? p.likes.length
              : 0,
        commentsCount: Array.isArray(p.comments) ? p.comments.length : (p.commentsCount ?? 0) || 0,
        shareCount: typeof p.shareCount === 'number' ? p.shareCount : 0,
      }));

      const hasMore = posts.length >= respLimit;
      return { posts: normalized, page: respPage, limit: respLimit, hasMore };
    });
};

/** Get posts by username */
export const getPostsByUser = (username) =>
  client.get(`/api/posts/user/${encodeURIComponent(username)}`).then((r) => r.data);

/** Toggle like */
export const toggleLike = (id) =>
  client.post(`/api/posts/${id}/like`).then((r) => r.data);

/**
 * Add a comment. Supports optional parentId for threaded replies.
 * Usage: addComment(postId, 'hello') or addComment(postId, 'hi', parentId)
 */
export const addComment = (id, text, parentId) =>
  client.post(`/api/posts/${id}/comments`, { text, parentId }).then((r) => r.data);

/** List comments for a post */
export const listComments = (id) =>
  client.get(`/api/posts/${id}/comments`).then((r) => r.data);

/** Get single post detail */
export const getPostById = (id) =>
  client.get(`/api/posts/${id}`).then((r) => r.data); // { post }

export const repost = (id, { text, visibility } = {}) =>
  client.post(`/api/posts/${id}/repost`, { text, visibility }).then(r => r.data);