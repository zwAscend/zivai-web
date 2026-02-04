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
    return fetchData<ChatMessage[]>(`/chat/messages/${studentId}`);
  },

  sendMessage: async (studentId: string, content: string): Promise<ChatMessage> => {
    return fetchData<ChatMessage>(`/chat/messages/${studentId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  markAsRead: async (studentId: string): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/chat/read/${studentId}`, {
      method: 'PUT',
    });
  },

  getUnreadCounts: async (): Promise<UnreadChatCount[]> => {
    return fetchData<UnreadChatCount[]>('/chat/unread');
  },
};
