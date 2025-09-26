// Simple REST client for chat endpoints.
// Keep response shapes consistent with controllers below.
import { client } from "./client";

const enc = encodeURIComponent;

export async function uploadAttachments(files) {
    const fd = new FormData();
    files.forEach((f) => fd.append('files', f)); // field name 'files' matches backend
    const { data } = await client.post('/api/chats/attachments', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
    });
    return data;
}

// keep legacy single if you want
export async function uploadAttachment(file) {
    const fd = new FormData();
    fd.append('file', file);
    const { data } = await client.post('/api/chats/attachment', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        withCredentials: true,
    });
    return data;
}

export const ChatsAPI = {

    async leaveConversation(id) {
        const { data } = await client.post(`/api/chats/conversations/${id}/leave`);
        return data;
    },

    async deleteConversation(id) {
        const { data } = await client.delete(`/api/chats/conversations/${id}`);
        return data;
    },
    uploadAttachments,
    uploadAttachment,
    listConversations: () =>
        client.get("/api/chats/conversations").then((r) => r.data.conversations),

    getConversation: (id) =>
        client.get(`/api/chats/conversations/${enc(id)}`).then((r) => r.data.conversation),

    createConversation: ({ participantIds = [], title = "", isGroup = false } = {}) =>
        client.post("/api/chats/conversations", { participantIds, title, isGroup }).then((r) => r.data.conversation),

    // DM helper (optionally with initial message)
    startDM: (userId, { initialMessage = "" } = {}) =>
        client.post("/api/chats/conversations/dm", { userId, initialMessage }).then((r) => r.data.conversation),

    createRoom: (title, userIds = []) =>
        client.post("/api/chats/conversations", { participantIds: userIds, title, isGroup: true }).then((r) => r.data.conversation),

    invite: (conversationId, userIds = [], message) =>
        client.post(`/api/chats/conversations/${enc(conversationId)}/invite`, { userIds, message }).then((r) => r.data),

    acceptInvite: (conversationId) =>
        client.post(`/api/chats/conversations/${enc(conversationId)}/accept`).then((r) => r.data),

    declineInvite: (conversationId) =>
        client.post(`/api/chats/conversations/${enc(conversationId)}/decline`).then((r) => r.data),

    listMessages: (id, { cursor, limit = 30 } = {}, config = {}) =>
        client.get(`/api/chats/conversations/${enc(id)}/messages`, { params: { cursor, limit }, ...config }).then((r) => r.data),

    sendMessage: (id, payload) =>
        // IMPORTANT: returns the message object directly (controllers send { message }, we unwrap here)
        client.post(`/api/chats/conversations/${enc(id)}/messages`, payload).then((r) => r.data.message),

    markRead: (id) =>
        client.post(`/api/chats/conversations/${enc(id)}/read`).then((r) => r.data),

    softDeleteMessage: (messageId) =>
        client.delete(`/api/chats/messages/${enc(messageId)}`).then((r) => r.data),
};
