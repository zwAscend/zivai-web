import { fetchData } from './http';
import { Assessment, Result } from '../types';

export const assessmentService = {
  getAssessments: async (): Promise<Assessment[]> => {
    return fetchData<Assessment[]>('/assessments');
  },

  getAssessment: async (id: string): Promise<Assessment> => {
    return fetchData<Assessment>(`/assessments/${id}`);
  },

  getAssessmentWithQuestions: async (id: string): Promise<any> => {
    return fetchData(`/assessments/${id}/with-questions`);
  },

  getAssessmentsBySubjectId: async (subjectId: string): Promise<Assessment[]> => {
    return fetchData<Assessment[]>(`/assessments?subjectId=${subjectId}`);
  },

  createAssessment: async (assessmentData: Omit<Assessment, 'id' | 'createdAt' | 'updatedAt'>): Promise<Assessment> => {
    return fetchData<Assessment>('/assessments', {
      method: 'POST',
      body: JSON.stringify(assessmentData),
    });
  },

  updateAssessment: async (id: string, assessmentData: Partial<Assessment>): Promise<Assessment> => {
    return fetchData<Assessment>(`/assessments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(assessmentData),
    });
  },

  deleteAssessment: async (id: string): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/assessments/${id}`, {
      method: 'DELETE',
    });
  },

  getResults: async (assessmentId: string, studentId?: string): Promise<Result[]> => {
    const url = studentId
      ? `/assessments/${assessmentId}/results?studentId=${studentId}`
      : `/assessments/${assessmentId}/results`;
    return fetchData<Result[]>(url);
  },

  addResult: async (id: string, resultData: Omit<Result, 'id' | 'createdAt' | 'updatedAt' | 'assessment'>): Promise<Result> => {
    return fetchData<Result>(`/assessments/${id}/results`, {
      method: 'POST',
      body: JSON.stringify(resultData),
    });
  },

  updateResult: async (
    assessmentId: string,
    resultId: string,
    resultData: Partial<Result>,
  ): Promise<Result> => {
    return fetchData<Result>(`/assessments/${assessmentId}/results/${resultId}`, {
      method: 'PUT',
      body: JSON.stringify(resultData),
    });
  },
};
