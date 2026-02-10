import { fetchData } from './http';

export type AiTutorSession = {
  id: string;
  studentId: string;
  studentName?: string | null;
  subjectId: string;
  subjectName?: string | null;
  status?: string | null;
  lastMessageAt?: string | null;
  createdAt?: string | null;
};

export type AiTutorMessage = {
  id: string;
  sessionId: string;
  senderId?: string | null;
  senderRole: 'student' | 'tutor' | 'system';
  contentType: 'text' | 'voice' | 'content';
  content?: string | null;
  transcript?: string | null;
  audioUrl?: string | null;
  contentPayload?: Record<string, unknown> | null;
  ts: string;
};

export type CreateAiTutorMessagePayload = {
  sessionId: string;
  senderId?: string;
  senderRole?: 'student' | 'tutor' | 'system';
  contentType?: 'text' | 'voice' | 'content';
  content?: string;
  transcript?: string;
  audioUrl?: string;
  contentPayload?: Record<string, unknown>;
  autoReply?: boolean;
};

export const aiTutorService = {
  getOrCreateSession: (studentId: string, subjectId: string, createdBy?: string) =>
    fetchData<AiTutorSession>('/ai-tutor/sessions', {
      method: 'POST',
      body: JSON.stringify({ studentId, subjectId, createdBy }),
    }),
  listSessions: (studentId: string) =>
    fetchData<AiTutorSession[]>(`/ai-tutor/sessions?studentId=${studentId}`),
  listMessages: (sessionId: string) =>
    fetchData<AiTutorMessage[]>(`/ai-tutor/messages?sessionId=${sessionId}`),
  sendMessage: (payload: CreateAiTutorMessagePayload) =>
    fetchData<AiTutorMessage>('/ai-tutor/messages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
