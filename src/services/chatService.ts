import { fetchData } from './http';
import { ChatMessage } from '../types';

export interface UnreadChatCount {
  studentId: string;
  unreadCount: number;
  studentName?: string;
  lastMessage?: string;
  lastMessageTime?: Date;
}

export const chatService = {
  getMessages: async (studentId: string): Promise<ChatMessage[]> => {
    return fetchData<ChatMessage[]>(`/chat/messages/${studentId}`, { skipCache: true });
  },

  sendMessage: async (studentId: string, content: string, senderId?: string): Promise<ChatMessage> => {
    return fetchData<ChatMessage>(`/chat/messages/${studentId}`, {
      method: 'POST',
      body: JSON.stringify({ content, senderId }),
    });
  },

  markAsRead: async (studentId: string): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/chat/read/${studentId}`, {
      method: 'PUT',
    });
  },

  getUnreadCounts: async (): Promise<UnreadChatCount[]> => {
    return fetchData<UnreadChatCount[]>('/chat/unread', { skipCache: true });
  },
};
