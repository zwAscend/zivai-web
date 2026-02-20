import { fetchData } from './http';

export interface NotificationUserLite {
  id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface NotificationItem {
  id: string;
  notifType?: string;
  title?: string;
  message?: string;
  read?: boolean;
  readAt?: string | null;
  priority?: string;
  createdAt?: string;
  recipient?: NotificationUserLite;
}

export const notificationService = {
  getNotifications: async (
    page = 1,
    limit = 20,
    unreadOnly = false,
    recipientId?: string
  ): Promise<NotificationItem[]> => {
    const params = new URLSearchParams();
    if (recipientId) params.set('recipientId', recipientId);
    const query = params.toString();
    const notifications = await fetchData<NotificationItem[]>(`/notifications${query ? `?${query}` : ''}`, {
      skipCache: true,
    });
    const filtered = unreadOnly ? notifications.filter((item) => item?.read === false) : notifications;
    return filtered.slice(Math.max(page - 1, 0) * limit, Math.max(page - 1, 0) * limit + limit);
  },

  markAsRead: async (notificationId: string, recipientId?: string) => {
    const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
    return fetchData(`/notifications/${notificationId}/read${query}`, {
      method: 'PUT'
    });
  },

  markAllAsRead: async (recipientId?: string) => {
    const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
    return fetchData(`/notifications/read-all${query}`, {
      method: 'PUT'
    });
  },

  deleteNotification: async (notificationId: string, recipientId?: string) => {
    const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
    return fetchData(`/notifications/${notificationId}${query}`, {
      method: 'DELETE'
    });
  },

  getUnreadCount: async (recipientId?: string): Promise<number> => {
    const query = recipientId ? `?recipientId=${encodeURIComponent(recipientId)}` : '';
    return fetchData<number>(`/notifications/unread-count${query}`, { skipCache: true });
  }
};
