import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { listNotifications, markNotificationsRead } from '@/api/notifications';
import { tokenStore } from '@/lib/token'; // must return the raw JWT string

const NotificationsCtx = createContext(null);

export function NotificationsProvider({ children }) {
    const { user } = useAuth();
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const socketRef = useRef(null);

    // fetch on login
    useEffect(() => {
        let mounted = true;
        if (!user) {
            setItems([]); setUnread(0);
            if (socketRef.current) { socketRef.current.disconnect(); socketRef.current = null; }
            return;
        }
        (async () => {
            try {
                const data = await listNotifications(50);
                if (!mounted) return;
                const list = (data?.notifications || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setItems(list);
                setUnread(list.filter(n => !n.read).length);
            } catch (e) { console.log(e) }
        })();
        return () => { mounted = false; };
    }, [user]);

    // connect socket when we have both user and token
    useEffect(() => {
        if (!user) return;

        const url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        const token = (typeof tokenStore?.get === 'function' && tokenStore.get())
            || localStorage.getItem('accessToken')
            || localStorage.getItem('token');

        if (!token) {
            console.warn('[socket] no token available; skipping connect');
            return;
        }

        const socket = io(url, {
            withCredentials: true,
            auth: { token },                 // 🔑 send JWT to server
            // transports: ['websocket'],    // uncomment if polling is flaky
        });
        socketRef.current = socket;

        socket.on('connect', () => console.info('[socket] connected', socket.id));
        socket.on('connect_error', (err) => console.error('[socket] connect_error', err?.message || err));
        socket.on('disconnect', (reason) => console.debug('[socket] disconnected', reason));

        socket.on('notification:new', (payload) => {
            console.log('new?', payload)
            setItems(prev => {
                const exists = prev.some(x => String(x._id || x.id) === String(payload.id));
                const next = exists
                    ? prev.map(x => (String(x._id || x.id) === String(payload.id) ? { ...x, ...payload } : x))
                    : [{ _id: payload.id, ...payload }, ...prev];
                return next.slice(0, 100);
            });
            setUnread(u => u + 1);
        });

        socket.on('notification:remove', ({ type, postId, actorId }) => {
            setItems(prev => prev.filter(n =>
                !(n.type === type &&
                    String(n.post?._id || n.postId) === String(postId) &&
                    String(n.actor?._id || n.actorId) === String(actorId))
            ));
            // recompute unread
            setUnread((itemsRef.current || []).filter(n => !n.read).length);
        });

        socket.on('notification:count', ({ unread: serverUnread }) => {
            if (typeof serverUnread === 'number') setUnread(serverUnread);
        });

        return () => { socket.disconnect(); socketRef.current = null; };
    }, [user /* optionally add token if your token can change while logged-in */]);

    const itemsRef = useRef(items);
    useEffect(() => { itemsRef.current = items; }, [items]);

    const markAllRead = async () => {
        const ids = items.filter(n => !n.read).map(n => n._id || n.id);
        if (!ids.length) return;
        setItems(prev => prev.map(n => ({ ...n, read: true })));
        setUnread(0);
        try { await markNotificationsRead(ids); } catch { }
    };

    const value = useMemo(() => ({ items, unread, setUnread, markAllRead }), [items, unread]);
    return <NotificationsCtx.Provider value={value}>{children}</NotificationsCtx.Provider>;
}

export function useNotifications() { return useContext(NotificationsCtx); }
