import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { ChatsAPI } from '@/api/chat';
import { tokenStore } from '@/lib/token';
import { useAuth } from '@/context/AuthContext';

const ChatCtx = createContext(null);

/** ---------------- utils ---------------- */
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const getToken = () =>
    (typeof tokenStore?.get === 'function' && tokenStore.get())
    || localStorage.getItem('accessToken')
    || localStorage.getItem('token')
    || '';

const asId = (v) => String(v?._id || v || '');

/** ---------------- Provider ---------------- */
export function ChatProvider({ children }) {
    const { user } = useAuth();
    const myUserId = asId(user);

    const [conversations, setConversations] = useState([]);        // Array
    const [messages, setMessages] = useState(new Map());           // Map<conversationId, Message[]>
    const [typing, setTyping] = useState(new Map());               // Map<conversationId, Set<userId>>
    const [presence, setPresence] = useState(new Map());           // Map<userId, boolean>

    const socketRef = useRef(null);
    const typingTimers = useRef(new Map()); // key: `${convoId}:${userId}` -> timeout
    const joinedRooms = useRef(new Set()); // Track which conversation rooms we've joined

    /** reset all state on logout */
    useEffect(() => {
        if (myUserId) return; // only when logged OUT
        setConversations([]);
        setMessages(new Map());
        setTyping(new Map());
        setPresence(new Map());
        typingTimers.current.forEach(clearTimeout);
        typingTimers.current.clear();
        joinedRooms.current.clear();
        if (socketRef.current) {
            socketRef.current.disconnect();
            socketRef.current = null;
        }
    }, [myUserId]);

    /** socket lifecycle */
    useEffect(() => {
        if (!myUserId) return;

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
            console.log('[chat] socket connected');
            joinedRooms.current.clear(); // Reset on reconnection
        };

        const onMessageNew = ({ conversationId, message }) => {
            console.log('[chat] message:new received', { conversationId, messageId: message._id, message });
            const cid = String(conversationId);
            const realId = asId(message);
            const clientId = message.clientMsgId;

            setMessages((prev) => {
                const arr = prev.get(cid) || [];
                // Replace optimistic by clientMsgId if present
                if (clientId) {
                    const i = arr.findIndex((m) => m.clientMsgId && m.clientMsgId === clientId);
                    if (i >= 0) {
                        const next = [...arr];
                        next[i] = message;
                        return new Map(prev).set(cid, next);
                    }
                }
                // De-dupe by real id
                const i2 = arr.findIndex((m) => asId(m) === realId);
                const next = i2 >= 0 ? arr.map((m) => (asId(m) === realId ? message : m)) : [...arr, message];
                return new Map(prev).set(cid, next);
            });
            console.log(messages)

            // update conversation preview + unread
            setConversations((prev) =>
                prev.map((c) => {
                    if (asId(c) !== cid) return c;
                    const senderId = asId(message.sender);
                    const mine = senderId && senderId === myUserId;
                    return {
                        ...c,
                        lastMessage: message,
                        updatedAt: message.createdAt || new Date().toISOString(),
                        unread: mine ? c.unread || 0 : (c.unread || 0) + 1,
                    };
                })
            );
        };

        // IMPORTANT: do NOT shadow myUserId; compare against current user id
        const onTyping = ({ conversationId, from, isTyping }) => {
            const cid = String(conversationId);
            const uid = String(from);
            if (!uid || uid === myUserId) return; // ignore self
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
            refreshConversations();
        };

        socket.on('connect', onConnect);
        socket.on('message:new', onMessageNew);
        socket.on('chat:typing', onTyping);
        socket.on('presence:update', onPresenceUpdate);
        socket.on('presence:state', onPresenceState);
        socket.on('conversation:updated', onConversationUpdated);

        socket.on('message:read', (_payload) => {
            // no-op for now (hook up read receipts here if needed)
        });

        socket.on('connect_error', (err) => {
            console.error('[chat] connect_error', err?.message || err);
        });
        socket.on('disconnect', (reason) => {
            console.debug('[chat] disconnected', reason);
            joinedRooms.current.clear(); // Reset on disconnection
        });

        return () => {
            socket.off('connect', onConnect);
            socket.off('message:new', onMessageNew);
            socket.off('chat:typing', onTyping);
            socket.off('presence:update', onPresenceUpdate);
            socket.off('presence:state', onPresenceState);
            socket.off('conversation:updated', onConversationUpdated);
            socket.disconnect();
            socketRef.current = null;
            typingTimers.current.forEach(clearTimeout);
            typingTimers.current.clear();
            joinedRooms.current.clear();
        };
    }, [myUserId]);

    /** conversations list */
    const refreshConversations = useCallback(async () => {
        if (!myUserId) return;
        try {
            const items = await ChatsAPI.listConversations();
            setConversations(Array.isArray(items) ? items : (items?.conversations || []));
        } catch (e) {
            console.error('[chat] load conversations failed', e);
        }
    }, [myUserId]);

    useEffect(() => { refreshConversations(); }, [refreshConversations]);

    /** Helper to ensure we've joined a conversation room */
    const ensureJoinedRoom = useCallback((conversationId) => {
        const socket = socketRef.current;
        if (!socket?.connected) return;

        const roomKey = String(conversationId);
        if (joinedRooms.current.has(roomKey)) return; // Already joined

        console.log('[chat] joining conversation room:', roomKey);
        socket.emit('chat:join', { conversationId: roomKey });
        joinedRooms.current.add(roomKey);
    }, []);

    /** API helpers exposed to consumers */
    const send = useCallback(async (conversationId, { text = '', attachments = [] } = {}) => {
        const cid = String(conversationId);

        // Ensure we're in the room before sending
        ensureJoinedRoom(cid);

        const clientMsgId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
        const now = new Date().toISOString();

        const optimistic = {
            _id: clientMsgId,
            clientMsgId,
            text: String(text || '').trim(),
            attachments,
            sender: { _id: myUserId },
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

        try {
            // NOTE: sendMessage returns the message object (not { message })
            const msg = await ChatsAPI.sendMessage(cid, {
                text: optimistic.text,
                attachments,
                clientMsgId,
            });

            // If API replies before socket echo, reconcile optimistic row
            if (msg?._id) {
                setMessages((prev) => {
                    const arr = prev.get(cid) || [];
                    const idx = arr.findIndex((m) => m.clientMsgId === clientMsgId || asId(m) === clientMsgId);
                    if (idx < 0) return prev; // socket already resolved it
                    const next = [...arr];
                    next[idx] = { ...next[idx], _id: msg._id };
                    return new Map(prev).set(cid, next);
                });
            }
            return msg?._id || true;
        } catch (err) {
            // rollback optimistic if send failed
            setMessages((prev) => {
                const arr = (prev.get(cid) || []).filter((m) => m.clientMsgId !== clientMsgId && asId(m) !== clientMsgId);
                return new Map(prev).set(cid, arr);
            });
            throw err;
        }
    }, [myUserId, ensureJoinedRoom]);

    const indicateTyping = useCallback((conversationId, isTyping) => {
        const socket = socketRef.current;
        if (!socket?.connected) return;

        // Ensure we're in the room before typing
        ensureJoinedRoom(conversationId);

        socket.emit('chat:typing', { conversationId, isTyping }, (ack) => {
            if (!ack?.ok) console.warn('[chat] typing ack failed', ack);
        });
    }, [ensureJoinedRoom]);

    const markRead = useCallback(async (conversationId) => {
        try {
            await ChatsAPI.markRead(conversationId);
            setConversations((prev) => prev.map((c) => (asId(c) === String(conversationId) ? { ...c, unread: 0 } : c)));
            const socket = socketRef.current;
            if (socket?.connected) {
                ensureJoinedRoom(conversationId);
                socket.emit('chat:read', { conversationId });
            }
        } catch (e) {
            console.error('[chat] markRead failed', e);
        }
    }, [ensureJoinedRoom]);

    const loadHistory = useCallback(async (conversationId) => {
        try {
            // Ensure we join the room when loading history
            ensureJoinedRoom(conversationId);

            const res = await ChatsAPI.listMessages(conversationId);
            const batch = res?.messages || (Array.isArray(res) ? res : []);
            // No reverse — we render sorted; just stash raw
            setMessages((prev) => new Map(prev).set(String(conversationId), batch));
        } catch (e) {
            console.error('[chat] loadHistory failed', e);
        }
    }, [ensureJoinedRoom]);

    const startDM = useCallback((uid, opts) => ChatsAPI.startDM?.(uid, opts || {}), []);

    const value = useMemo(
        () => ({
            conversations,
            setConversations,
            messages,
            setMessages,
            typing,
            presence,
            send,
            indicateTyping,
            markRead,
            loadHistory,
            startDM,
            refreshConversations,
            ensureJoinedRoom, // Export this so components can call it
        }),
        [conversations, messages, typing, presence, send, indicateTyping, markRead, loadHistory, startDM, refreshConversations, ensureJoinedRoom]
    );

    return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}

export function useChat() {
    return useContext(ChatCtx);
}