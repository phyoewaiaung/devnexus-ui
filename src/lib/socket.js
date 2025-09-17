// src/lib/socket.js
import { io } from "socket.io-client";

let socket = null;

export function createSocket(getAccessToken) {
    if (socket?.connected || socket?.connecting) return socket;

    const API_ROOT = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/+$/, '');
    const token = getAccessToken?.();

    socket = io(API_ROOT, {
        withCredentials: true,
        transports: ["websocket"],
        autoConnect: !!token,
        auth: token ? { token } : undefined,
    });

    // allow hot token refresh
    socket.updateAuth = () => {
        const t = getAccessToken?.();
        socket.auth = t ? { token: t } : {};
        if (!socket.connected) socket.connect();
    };

    // auto-join conversation rooms on connect
    socket.on("connect", () => socket.emit("chat:joinAll", () => { }));

    return socket;
}

export function getSocket() {
    return socket;
}
