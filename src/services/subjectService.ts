import { fetchData } from './http';
import { Subject } from '../types';

export interface SubjectPayload {
  code: string;
  name: string;
  examBoardCode?: string;
  description?: string;
  grades?: string[];
  subjectAttributes?: unknown;
  active?: boolean;
}

export interface UpdateSubjectPayload {
  code?: string;
  name?: string;
  examBoardCode?: string;
  description?: string;
  grades?: string[];
  subjectAttributes?: unknown;
  active?: boolean;
}

export const subjectService = {
  getSubjects: async (): Promise<Subject[]> => {
    return fetchData<Subject[]>('/subjects');
  },

  getSubjectById: async (id: string): Promise<Subject> => {
    return fetchData<Subject>(`/subjects/${id}`);
  },

  getTeachingSubjects: async (): Promise<Subject[]> => {
    return fetchData<Subject[]>('/subjects/teaching');
  },

  createSubject: async (payload: SubjectPayload): Promise<Subject> => {
    return fetchData<Subject>('/subjects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSubject: async (id: string, payload: UpdateSubjectPayload): Promise<Subject> => {
    return fetchData<Subject>(`/subjects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteSubject: async (id: string): Promise<void> => {
    await fetchData<void>(`/subjects/${id}`, {
      method: 'DELETE',
    });
  },
};
