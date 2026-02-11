import { fetchData } from './http';

export const notificationService = {
  getNotifications: async (page = 1, limit = 20, unreadOnly = false) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      unreadOnly: unreadOnly.toString()
    });

    return fetchData(`/notifications?${params.toString()}`);
  },

  markAsRead: async (notificationId: string) => {
    return fetchData(`/notifications/${notificationId}/read`, {
      method: 'PUT'
    });
  },

  markAllAsRead: async () => {
    return fetchData('/notifications/read-all', {
      method: 'PUT'
    });
  },

  deleteNotification: async (notificationId: string) => {
    return fetchData(`/notifications/${notificationId}`, {
      method: 'DELETE'
    });
  },

  getUnreadCount: async () => {
    return fetchData('/notifications/unread-count', { skipCache: true });
  }
};
