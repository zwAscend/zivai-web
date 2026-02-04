import { fetchData } from './http';
import { Subject } from '../types';

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
};
