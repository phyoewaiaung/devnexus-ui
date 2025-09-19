import { client } from "./client";

const enc = encodeURIComponent;

export const ChatsAPI = {
    /* -------------------- Conversations -------------------- */
    listConversations: () =>
        client.get("/api/chats/conversations").then((r) => r.data.conversations),

    getConversation: (id) =>
        client.get(`/api/chats/conversations/${enc(id)}`).then((r) => r.data.conversation),

    createConversation: ({ participantIds = [], title = "", isGroup = false } = {}) =>
        client
            .post("/api/chats/conversations", { participantIds, title, isGroup })
            .then((r) => r.data.conversation),

    // Convenience: start a 1:1 DM
    startDM: (userId) =>
        client
            .post("/api/chats/conversations", { participantIds: [userId], isGroup: false })
            .then((r) => r.data.conversation),

    // Convenience: create a group room (others will be invited and must accept)
    createRoom: (title, userIds = []) =>
        client
            .post("/api/chats/conversations", { participantIds: userIds, title, isGroup: true })
            .then((r) => r.data.conversation),

    /* -------------------- Invitations ---------------------- */
    invite: (conversationId, userIds = []) =>
        client
            .post(`/api/chats/conversations/${enc(conversationId)}/invite`, { userIds })
            .then((r) => r.data),

    acceptInvite: (conversationId) =>
        client.post(`/api/chats/conversations/${enc(conversationId)}/accept`).then((r) => r.data),

    declineInvite: (conversationId) =>
        client.post(`/api/chats/conversations/${enc(conversationId)}/decline`).then((r) => r.data),

    /* -------------------- Messages ------------------------- */
    listMessages: (id, { cursor, limit = 30 } = {}, config = {}) =>
        client
            .get(`/api/chats/conversations/${enc(id)}/messages`, {
                params: { cursor, limit },
                ...config, // allow AbortSignal or custom headers
            })
            .then((r) => r.data), // -> { messages, nextCursor }

    sendMessage: (id, payload) =>
        client
            .post(`/api/chats/conversations/${enc(id)}/messages`, payload)
            .then((r) => r.data.message),

    markRead: (id) =>
        client.post(`/api/chats/conversations/${enc(id)}/read`).then((r) => r.data),

    // Me-only soft delete of a message
    softDeleteMessage: (messageId) =>
        client.delete(`/api/chats/messages/${enc(messageId)}`).then((r) => r.data),
};
