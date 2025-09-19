// src/context/ChatContext.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { ChatsAPI } from '@/api/chat';
import { tokenStore } from '@/lib/token';
import { useAuth } from '@/context/AuthContext';

const ChatCtx = createContext(null);

// --- utils ---------------------------------------------------------------
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const getToken = () =>
    (typeof tokenStore?.get === 'function' && tokenStore.get()) ||
    localStorage.getItem('accessToken') ||
    localStorage.getItem('token') || '';

const asId = (v) => String(v?._id || v || '');

export function ChatProvider({ children }) {
    const { user } = useAuth();
    const userId = asId(user);

    const [conversations, setConversations] = useState([]); // Array
    const [messages, setMessages] = useState(new Map()); // Map<conversationId, Message[]>
    const [typing, setTyping] = useState(new Map()); // Map<conversationId, Set<userId>>
    const [presence, setPresence] = useState(new Map()); // Map<userId, boolean>

    const socketRef = useRef(null);
    const typingTimers = useRef(new Map()); // key: `${convoId}:${userId}` -> timeout

    // Reset everything on logout ------------------------------------------------
    useEffect(() => {
        if (userId) return; // only when logged OUT
        setConversations([]);
        setMessages(new Map());
        setTyping(new Map());
        setPresence(new Map());
        typingTimers.current.forEach((t) => clearTimeout(t));
        typingTimers.current.clear();
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, [userId]);

    // Socket lifecycle ---------------------------------------------------------
    useEffect(() => {
        if (!userId) return;
        const token = getToken();
        if (!token) {
            console.warn('[chat] missing token; not connecting');
            return;
        }

        const socket = io(API_URL, {
            withCredentials: true,
            auth: { token },
            transports: ['websocket'],
        });
        socketRef.current = socket;

        const onConnect = () => {
            // (server should use token to identify and auto-join rooms or we can send joinAll)
            socket.emit('chat:joinAll');
        };

        const onMessageNew = ({ conversationId, message }) => {
            const cid = String(conversationId);
            const realId = asId(message);
            const clientId = message.clientMsgId;

            setMessages((prev) => {
                const arr = prev.get(cid) || [];
                // prefer clientMsgId replacement
                if (clientId) {
                    const i = arr.findIndex((m) => m.clientMsgId && m.clientMsgId === clientId);
                    if (i >= 0) {
                        const next = [...arr];
                        next[i] = message;
                        return new Map(prev).set(cid, next);
                    }
                }
                // de-dupe by real id
                const i2 = arr.findIndex((m) => asId(m) === realId);
                const next = i2 >= 0 ? arr.map((m) => (asId(m) === realId ? message : m)) : [...arr, message];
                return new Map(prev).set(cid, next);
            });

            // update convo list
            setConversations((prev) =>
                prev.map((c) => {
                    if (asId(c) !== cid) return c;
                    const senderId = asId(message.sender);
                    const mine = senderId && senderId === userId;
                    return {
                        ...c,
                        lastMessage: message,
                        updatedAt: message.createdAt || new Date().toISOString(),
                        unread: mine ? c.unread || 0 : (c.unread || 0) + 1,
                    };
                })
            );
        };

        const onTyping = ({ conversationId, userId: from, isTyping }) => {
            const cid = String(conversationId);
            const uid = String(from);
            if (!uid || uid === userId) return; // ignore self
            setTyping((prev) => {
                const tset = new Set(prev.get(cid) || []);
                isTyping ? tset.add(uid) : tset.delete(uid);
                return new Map(prev).set(cid, tset);
            });
            if (isTyping) {
                const key = `${cid}:${uid}`;
                clearTimeout(typingTimers.current.get(key));
                typingTimers.current.set(
                    key,
                    setTimeout(() => {
                        setTyping((prev) => {
                            const tset = new Set(prev.get(cid) || []);
                            tset.delete(uid);
                            return new Map(prev).set(cid, tset);
                        });
                        typingTimers.current.delete(key);
                    }, 5000)
                );
            }
        };

        const onPresenceUpdate = ({ userId: uid, online }) => {
            setPresence((prev) => new Map(prev).set(String(uid), !!online));
        };

        const onPresenceState = ({ onlineUserIds }) => {
            const map = new Map();
            (onlineUserIds || []).forEach((id) => map.set(String(id), true));
            setPresence(map);
        };

        const onConversationUpdated = () => {
            // lightweight refresh for metadata (e.g., invite accept)
            refreshConversations();
        };

        socket.on('connect', onConnect);
        socket.on('message:new', onMessageNew);
        socket.on('typing', onTyping);
        socket.on('presence:update', onPresenceUpdate);
        socket.on('presence:state', onPresenceState);
        socket.on('conversation:updated', onConversationUpdated);
        socket.on('message:read', ({ conversationId, userId: uid, at }) => {
            // You can extend to track per-message read receipts
            void conversationId; void uid; void at; // no-op for now
        });

        socket.on('connect_error', (err) => {
            console.error('[chat] connect_error', err?.message || err);
        });

        socket.on('disconnect', (reason) => {
            console.debug('[chat] disconnected', reason);
        });

        return () => {
            socket.off('connect', onConnect);
            socket.off('message:new', onMessageNew);
            socket.off('typing', onTyping);
            socket.off('presence:update', onPresenceUpdate);
            socket.off('presence:state', onPresenceState);
            socket.off('conversation:updated', onConversationUpdated);
            socket.disconnect();
            socketRef.current = null;
            typingTimers.current.forEach((t) => clearTimeout(t));
            typingTimers.current.clear();
        };
        // re-run if userId changes (login switch) or token rotates in storage
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userId]);

    // Initial conversations ----------------------------------------------------
    const refreshConversations = useCallback(async () => {
        if (!userId) return;
        try {
            const res = await ChatsAPI.listConversations();
            const items = Array.isArray(res) ? res : res?.conversations || [];
            setConversations(items);
        } catch (e) {
            console.error('[chat] load conversations failed', e);
        }
    }, [userId]);

    useEffect(() => { refreshConversations(); }, [refreshConversations]);

    // API methods --------------------------------------------------------------
    const send = useCallback((conversationId, { text = '', attachments = [] } = {}) => {
        const socket = socketRef.current;
        if (!socket || !socket.connected) return Promise.reject(new Error('Socket not connected'));

        const cid = String(conversationId);
        const clientMsgId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const now = new Date().toISOString();

        const optimistic = {
            _id: clientMsgId,
            clientMsgId,
            text: String(text || '').trim(),
            attachments,
            sender: { _id: userId },
            createdAt: now,
            read: false,
        };

        setMessages((prev) => {
            const arr = prev.get(cid) || [];
            return new Map(prev).set(cid, [...arr, optimistic]);
        });

        setConversations((prev) =>
            prev.map((c) => (asId(c) === cid ? { ...c, lastMessage: optimistic, updatedAt: now } : c))
        );

        return new Promise((resolve, reject) => {
            socket.emit('chat:send', { conversationId: cid, text: optimistic.text, attachments, clientMsgId }, (ack) => {
                if (!ack?.ok) {
                    // remove optimistic on failure
                    setMessages((prev) => {
                        const arr = (prev.get(cid) || []).filter((m) => m.clientMsgId !== clientMsgId && asId(m) !== clientMsgId);
                        return new Map(prev).set(cid, arr);
                    });
                    return reject(new Error(ack?.error || 'Send failed'));
                }
                const realId = ack.messageId;
                setMessages((prev) => {
                    const arr = prev.get(cid) || [];
                    const idx = arr.findIndex((m) => m.clientMsgId === clientMsgId || asId(m) === clientMsgId);
                    if (idx < 0) return prev;
                    const next = [...arr];
                    next[idx] = { ...next[idx], _id: realId };
                    return new Map(prev).set(cid, next);
                });
                resolve(realId);
            });
        });
    }, [userId]);

    const indicateTyping = useCallback((conversationId, isTyping) => {
        const socket = socketRef.current;
        if (socket?.connected) socket.emit('chat:typing', { conversationId, isTyping });
    }, []);

    const markRead = useCallback(async (conversationId) => {
        try {
            await ChatsAPI.markRead(conversationId);
            setConversations((prev) => prev.map((c) => (asId(c) === String(conversationId) ? { ...c, unread: 0 } : c)));
            const socket = socketRef.current;
            if (socket?.connected) socket.emit('chat:read', { conversationId });
        } catch (e) {
            console.error('[chat] markRead failed', e);
        }
    }, []);

    const loadHistory = useCallback(async (conversationId) => {
        try {
            const res = await ChatsAPI.listMessages(conversationId);
            const batch = res?.messages || (Array.isArray(res) ? res : []);
            setMessages((prev) => new Map(prev).set(String(conversationId), (batch || []).reverse()));
        } catch (e) {
            console.error('[chat] loadHistory failed', e);
        }
    }, []);

    const startDM = useCallback((userId) => ChatsAPI.startDM?.(userId), []);

    const value = useMemo(
        () => ({
            // state
            conversations,
            setConversations,
            messages,
            setMessages,
            typing,
            presence,
            // actions
            send,
            indicateTyping,
            markRead,
            loadHistory,
            startDM,
            refreshConversations,
        }),
        [conversations, messages, typing, presence, send, indicateTyping, markRead, loadHistory, startDM, refreshConversations]
    );

    return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}

export function useChat() {
    return useContext(ChatCtx);
}
