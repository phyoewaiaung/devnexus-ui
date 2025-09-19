import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { useAuth } from "./AuthContext";
// FIX: correct import
import { ChatsAPI } from "@/api/chat";
import { tokenStore } from "@/lib/token";

const ChatCtx = createContext(null);

export function ChatProvider({ children }) {
    const { user } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [messages, setMessages] = useState(new Map());
    const [typing, setTyping] = useState(new Map());
    const [presence, setPresence] = useState(new Map());
    const socketRef = useRef(null);
    const typingTimers = useRef(new Map());

    // Clear data when user logs out
    useEffect(() => {
        if (!user) {
            setConversations([]);
            setMessages(new Map());
            setTyping(new Map());
            setPresence(new Map());
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            typingTimers.current.forEach((t) => clearTimeout(t));
            typingTimers.current.clear();
            return;
        }
    }, [user]);

    // Connect socket when user is available
    useEffect(() => {
        if (!user) return;

        const url = import.meta.env.VITE_API_URL || "http://localhost:5000";
        const token =
            (typeof tokenStore?.get === "function" && tokenStore.get()) ||
            localStorage.getItem("accessToken") ||
            localStorage.getItem("token");

        if (!token) {
            console.warn("[chat-socket] no token available; skipping connect");
            return;
        }

        const socket = io(url, {
            withCredentials: true,
            auth: { token },
        });
        socketRef.current = socket;

        // Connection events
        socket.on("connect", () => {
            console.info("[chat-socket] connected", socket.id);
            socket.emit("chat:joinAll");
        });

        socket.on("connect_error", (err) => {
            console.error("[chat-socket] connect_error", err?.message || err);
        });

        socket.on("disconnect", (reason) => {
            console.debug("[chat-socket] disconnected", reason);
        });

        // Chat events
        socket.on("message:new", ({ conversationId, message }) => {
            setMessages((prev) => {
                const arr = prev.get(conversationId) || [];
                const realId = String(message._id || message.id);

                // 1) Prefer clientMsgId replacement (handles ack/broadcast races)
                if (message.clientMsgId) {
                    const idxByClient = arr.findIndex(
                        (m) => m.clientMsgId && m.clientMsgId === message.clientMsgId
                    );
                    if (idxByClient >= 0) {
                        const next = [...arr];
                        next[idxByClient] = message; // replace optimistic with server copy
                        return new Map(prev).set(conversationId, next);
                    }
                }

                // 2) Fallback: de-dupe by real id
                const idx = arr.findIndex((m) => String(m._id || m.id) === realId);
                const next =
                    idx >= 0
                        ? arr.map((m) => (String(m._id || m.id) === realId ? message : m))
                        : [...arr, message];

                return new Map(prev).set(conversationId, next);
            });

            // Update conversation metadata
            setConversations((prev) => {
                const senderId = message?.sender?._id || message?.sender;
                const mine = user?._id && senderId && String(senderId) === String(user._id);
                return prev.map((c) => {
                    if (String(c._id) !== String(conversationId)) return c;
                    return {
                        ...c,
                        lastMessage: message,
                        updatedAt: message.createdAt || message.timestamp || new Date().toISOString(),
                        unread: mine ? c.unread || 0 : (c.unread || 0) + 1,
                    };
                });
            });
        });

        socket.on("typing", ({ conversationId, userId, isTyping }) => {
            setTyping((prev) => {
                const tset = new Set(prev.get(conversationId) || []);
                if (isTyping) tset.add(String(userId));
                else tset.delete(String(userId));
                return new Map(prev).set(conversationId, tset);
            });

            if (isTyping) {
                const key = `${conversationId}:${userId}`;
                clearTimeout(typingTimers.current.get(key));
                typingTimers.current.set(
                    key,
                    setTimeout(() => {
                        setTyping((prev) => {
                            const tset = new Set(prev.get(conversationId) || []);
                            tset.delete(String(userId));
                            return new Map(prev).set(conversationId, tset);
                        });
                        typingTimers.current.delete(key);
                    }, 5000)
                );
            }
        });

        socket.on("presence:update", ({ userId, online }) => {
            setPresence((prev) => new Map(prev).set(String(userId), !!online));
        });

        socket.on("presence:state", ({ onlineUserIds }) => {
            const newMap = new Map();
            (onlineUserIds || []).forEach((id) => newMap.set(String(id), true));
            setPresence(newMap);
        });

        socket.on("message:read", ({ conversationId }) => {
            console.log("[chat-socket] messages read in:", conversationId);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
            typingTimers.current.forEach((timer) => clearTimeout(timer));
            typingTimers.current.clear();
        };
    }, [user]);

    // Load conversations when user is available
    useEffect(() => {
        if (!user) return;
        ChatsAPI.listConversations()
            .then(setConversations)
            .catch((err) => console.error("Failed to load conversations:", err));
    }, [user]);

    const value = useMemo(
        () => ({
            conversations,
            setConversations,
            messages,
            setMessages,
            typing,
            presence,

            send: (conversationId, { text = "", attachments = [] } = {}) => {
                const socket = socketRef.current;
                if (!socket || !socket.connected) {
                    return Promise.reject(new Error("Socket not connected"));
                }

                const clientMsgId = `c_${Date.now()}_${Math.random().toString(36).slice(2)}`;
                const now = new Date().toISOString();
                const meId = user?._id;

                // Optimistic message (use clientMsgId as _id to guarantee replacement)
                const optimistic = {
                    _id: clientMsgId,
                    clientMsgId,
                    text,
                    attachments,
                    sender: { _id: meId },
                    createdAt: now,
                    read: false,
                };

                setMessages((prev) => {
                    const arr = prev.get(conversationId) || [];
                    return new Map(prev).set(conversationId, [...arr, optimistic]);
                });

                setConversations((prev) =>
                    prev.map((c) =>
                        String(c._id) === String(conversationId)
                            ? { ...c, lastMessage: optimistic, updatedAt: now }
                            : c
                    )
                );

                return new Promise((resolve, reject) => {
                    socket.emit(
                        "chat:send",
                        { conversationId, text, attachments, clientMsgId },
                        (ack) => {
                            if (!ack?.ok) {
                                // remove optimistic on failure
                                setMessages((prev) => {
                                    const arr = (prev.get(conversationId) || []).filter(
                                        (m) => m._id !== clientMsgId && m.clientMsgId !== clientMsgId
                                    );
                                    return new Map(prev).set(conversationId, arr);
                                });
                                return reject(new Error(ack?.error || "send failed"));
                            }

                            const realId = ack.messageId;

                            // convert optimistic client id -> real id (if still present)
                            setMessages((prev) => {
                                const arr = prev.get(conversationId) || [];
                                const idx = arr.findIndex(
                                    (m) => m._id === clientMsgId || m.clientMsgId === clientMsgId
                                );
                                if (idx < 0) return prev;
                                const next = [...arr];
                                next[idx] = { ...next[idx], _id: realId };
                                return new Map(prev).set(conversationId, next);
                            });

                            resolve(realId);
                        }
                    );
                });
            },

            indicateTyping: (conversationId, isTyping) => {
                const socket = socketRef.current;
                if (socket?.connected) {
                    socket.emit("chat:typing", { conversationId, isTyping });
                }
            },

            markRead: async (conversationId) => {
                try {
                    await ChatsAPI.markRead(conversationId);
                    setConversations((prev) =>
                        prev.map((c) =>
                            String(c._id) === String(conversationId) ? { ...c, unread: 0 } : c
                        )
                    );
                    const socket = socketRef.current;
                    if (socket?.connected) {
                        socket.emit("chat:read", { conversationId });
                    }
                } catch (error) {
                    console.error("Failed to mark as read:", error);
                }
            },

            loadHistory: async (conversationId) => {
                try {
                    const { messages: batch } = await ChatsAPI.listMessages(conversationId);
                    setMessages((prev) =>
                        new Map(prev).set(conversationId, (batch || []).reverse())
                    );
                } catch (error) {
                    console.error("Failed to load history:", error);
                }
            },

            startDM: (userId) => ChatsAPI.startDM(userId),
        }),
        [conversations, messages, typing, presence, user]
    );

    return <ChatCtx.Provider value={value}>{children}</ChatCtx.Provider>;
}

export function useChat() {
    return useContext(ChatCtx);
}
