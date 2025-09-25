// src/api/search.js
import { client } from "./client";

/** Safely unwrap axios responses that might be { data: ... } or { data: { data: ... } } */
const unwrap = (res) => (res?.data?.data ?? res?.data ?? res);

/** Normalize to always return arrays so callers can rely on lengths */
const normalizeSuggest = (raw) => {
    const root = raw?.data || raw?.result || raw || {};
    return {
        users: Array.isArray(root.users) ? root.users : [],
        posts: Array.isArray(root.posts) ? root.posts : [],
        languages: Array.isArray(root.languages) ? root.languages : [],
        tags: Array.isArray(root.tags) ? root.tags : [],
    };
};

/**
 * GET /api/search/suggest?q=
 * @param {string} q
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function searchSuggest(q, options = {}) {
    const term = String(q || "").trim();
    if (term.length < 2) return { users: [], posts: [], languages: [], tags: [] };

    const params = new URLSearchParams({ q: term }).toString();
    const res = await client.get(`/api/search/suggest?${params}`, {
        signal: options.signal, // Axios v1 supports AbortSignal
    });
    return normalizeSuggest(unwrap(res));
}

/**
 * GET /api/search?q=&...opts
 * @param {string} q
 * @param {object} [opts] e.g. { limit: 20 }
 * @param {{ signal?: AbortSignal }} [options]
 */
export async function searchAll(q, opts = {}, options = {}) {
    const params = new URLSearchParams({ q: String(q || "").trim(), ...opts }).toString();
    const res = await client.get(`/api/search?${params}`, {
        signal: options.signal,
    });
    return unwrap(res);
}
