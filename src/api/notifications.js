// src/api/notifications.js
import { client } from './client';

export const listNotifications = (limit = 50) =>
    client.get('/api/notifications', { params: { limit } }).then(r => r.data);

export const markNotificationsRead = (ids) =>
    client.post('/api/notifications/read', { ids }).then(r => r.data);
