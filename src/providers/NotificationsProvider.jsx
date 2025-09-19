// NotificationsProvider.jsx
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { listNotifications, markNotificationsRead } from '@/api/notifications';
import { tokenStore } from '@/lib/token';
import { useAuth } from '@/context/AuthContext';

const NotificationsContext = createContext(null);

export function NotificationsProvider({ children }) {
    const { user } = useAuth();

    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);

    // Presence: keep a Set for O(1) membership and cheap copies
    const [onlineUsers, setOnlineUsers] = useState(() => new Set());

    const socketRef = useRef(null);

    // Reset state when user logs out
    useEffect(() => {
        if (!user) {
            setItems([]);
            setUnread(0);
            setOnlineUsers(new Set());
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        }
    }, [user]);

    // Fetch notifications on login
    useEffect(() => {
        if (!user) return;
        let isMounted = true;

        (async () => {
            try {
                const data = await listNotifications(50);
                if (!isMounted) return;
                const notifications = (data?.notifications || [])
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setItems(notifications);
                setUnread(notifications.filter(n => !n.read).length);
            } catch (error) {
                console.error('Failed to fetch notifications:', error);
            }
        })();

        return () => { isMounted = false; };
    }, [user]);

    // Socket connection management + presence handlers
    useEffect(() => {
        if (!user) return;

        const getToken = () =>
            (tokenStore?.get?.() || localStorage.getItem('accessToken') || localStorage.getItem('token'));

        const token = getToken();
        if (!token) {
            console.warn('[socket] No token available, skipping connection');
            return;
        }

        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const socket = io(apiUrl, {
            withCredentials: true,
            auth: { token },
            path: '/socket.io/', // match server
        });

        socketRef.current = socket;

        // Connection events
        socket.on('connect', () => {
            console.info('[socket] Connected:', socket.id);
        });

        socket.on('connect_error', (error) => {
            console.error('[socket] Connection error:', error?.message || error);
        });

        socket.on('disconnect', (reason) => {
            console.debug('[socket] Disconnected:', reason);
            // On a hard disconnect, we clear presence; on automatic reconnection
            // server will emit fresh `online:users` to repopulate.
            setOnlineUsers(new Set());
        });

        // --- Notifications ---
        socket.on('notification:new', (notification) => {
            setItems(prev => {
                const id = String(notification.id || notification._id);
                const exists = prev.some(item => String(item._id || item.id) === id);
                const merged = exists
                    ? prev.map(item => (String(item._id || item.id) === id ? { ...item, ...notification } : item))
                    : [{ _id: id, ...notification }, ...prev];

                return merged.slice(0, 100);
            });

            // optimistic bump; server will correct via notification:count shortly
            setUnread(prev => prev + 1);
        });

        socket.on('notification:remove', ({ type, postId, actorId }) => {
            setItems(prev => {
                const filtered = prev.filter(notification => {
                    const matchesType = notification.type === type;
                    const matchesPost = String(notification.post?._id || notification.postId) === String(postId);
                    const matchesActor = String(notification.actor?._id || notification.actorId) === String(actorId);
                    return !(matchesType && matchesPost && matchesActor);
                });
                setUnread(filtered.filter(n => !n.read).length);
                return filtered;
            });
        });

        socket.on('notification:count', ({ unread: serverUnread }) => {
            if (typeof serverUnread === 'number') setUnread(serverUnread);
        });

        // --- Presence (online users) ---
        // Bulk replace: server emits the full list on connect & after changes
        socket.on('online:users', ({ users }) => {
            if (Array.isArray(users)) {
                setOnlineUsers(new Set(users.map(String)));
            }
        });

        // Optional incremental events (safe to listen; no harm if server doesn’t send)
        socket.on('presence:user:online', ({ userId }) => {
            if (!userId) return;
            setOnlineUsers(prev => {
                const next = new Set(prev);
                next.add(String(userId));
                return next;
            });
        });

        socket.on('presence:user:offline', ({ userId }) => {
            if (!userId) return;
            setOnlineUsers(prev => {
                if (!prev.has(String(userId))) return prev;
                const next = new Set(prev);
                next.delete(String(userId));
                return next;
            });
        });

        // Cleanup
        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user]);

    const markAllRead = async () => {
        const unreadItems = items.filter(n => !n.read);
        const unreadIds = unreadItems.map(n => n._id || n.id);
        if (!unreadIds.length) return;

        // Optimistic UI
        setItems(prev => prev.map(item => ({ ...item, read: true })));
        setUnread(0);

        try {
            await markNotificationsRead(unreadIds);
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
            // optionally refetch or revert
        }
    };

    // Presence helpers exposed to consumers
    const isOnline = (userId) => onlineUsers.has(String(userId))

    const contextValue = useMemo(() => ({
        items,
        unread,
        markAllRead,
        // presence
        onlineUsers,         // Set<string>
        isOnline,            // (id) => boolean
    }), [items, unread, onlineUsers, isOnline]);

    return (
        <NotificationsContext.Provider value={contextValue}>
            {children}
        </NotificationsContext.Provider>
    );
}

export function useNotifications() {
    const ctx = useContext(NotificationsContext);
    if (!ctx) throw new Error('useNotifications must be used within a NotificationsProvider');
    return ctx;
}
