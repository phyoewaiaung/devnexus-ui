import { client } from './client';

export const ChatsAPI = {
    listConversations: () => client.get("/api/chats/conversations").then(r => r.data.conversations),
    getConversation: (id) => client.get(`/api/chats/conversations/${id}`).then(r => r.data.conversation),
    listMessages: (id, cursor) =>
        client.get(`/api/chats/conversations/${id}/messages`, { params: { cursor, limit: 30 } })
            .then(r => r.data),
    sendMessage: (id, payload) => client.post(`/api/chats/conversations/${id}/messages`, payload).then(r => r.data.message),
    markRead: (id) => client.post(`/api/chats/conversations/${id}/read`).then(r => r.data),
    startDM: (userId) => client.post(`/api/chats/conversations`, { participantIds: [userId], isGroup: false }).then(r => r.data.conversation),
};
