import { fetchData } from './http';
import { DevelopmentPlan, StudentAttributes, SubjectAttribute, Plan, PlanStatus, PageResponse } from '../types';

export const developmentService = {
  getSubjectAttributes: async (subjectId: string): Promise<SubjectAttribute[]> => {
    return fetchData<SubjectAttribute[]>(`/development/attributes/subject/${subjectId}`);
  },

  createSubjectAttribute: async (attributeData: Omit<SubjectAttribute, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubjectAttribute> => {
    return fetchData<SubjectAttribute>('/development/attributes/subject', {
      method: 'POST',
      body: JSON.stringify(attributeData),
    });
  },

  getStudentAttributes: async (studentId: string, subjectId: string): Promise<StudentAttributes> => {
    return fetchData<StudentAttributes>(`/development/attributes/student/${studentId}/subject/${subjectId}`);
  },

  updateStudentAttributes: async (studentId: string, attributes: Array<{ attributeId: string; current: number; potential: number }>): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/development/attributes/student/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(attributes),
    });
  },

  getSubjectPlans: async (subjectId: string): Promise<Plan[]> => {
    return fetchData<Plan[]>(`/development/plans/subject/${subjectId}`);
  },

  createSubjectPlan: async (planData: Omit<Plan, 'id' | 'createdAt' | 'updatedAt'>): Promise<Plan> => {
    return fetchData<Plan>('/development/plans/subject', {
      method: 'POST',
      body: JSON.stringify(planData),
    });
  },

  getStudentPlan: async (studentId: string, subjectId: string): Promise<DevelopmentPlan> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    return fetchData<DevelopmentPlan>(`/development/plans/student/${studentId}/subject/${subjectId}`);
  },

  getAllPlansForStudent: async (studentId: string, status?: string): Promise<DevelopmentPlan[]> => {
    if (!studentId || studentId === 'undefined') {
      return [];
    }
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchData<DevelopmentPlan[]>(`/development/plans/student/${studentId}${query}`);
  },

  assignPlanToStudent: async (studentId: string, planId: string, subjectId?: string): Promise<DevelopmentPlan> => {
    const requestBody: { planId: string; subjectId?: string } = { planId };

    if (subjectId) {
      requestBody.subjectId = subjectId;
    }

    return fetchData<DevelopmentPlan>(`/development/plans/student/${studentId}/assign`, {
      method: 'POST',
      body: JSON.stringify(requestBody),
    });
  },

  updatePlanProgress: async (
    studentId: string,
    planId: string,
    progressData: {
      currentProgress?: number;
      status?: PlanStatus;
      skillProgress?: Array<{ skill: string; currentScore: number }>;
    }
  ): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student/${studentId}/${planId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(progressData),
    });
  },

  listStudentPlans: async (params?: {
    subjectId?: string;
    classId?: string;
    classSubjectId?: string;
    status?: string;
    page?: number;
    size?: number;
  }): Promise<PageResponse<DevelopmentPlan>> => {
    const searchParams = new URLSearchParams();
    if (params?.subjectId) searchParams.set('subjectId', params.subjectId);
    if (params?.classId) searchParams.set('classId', params.classId);
    if (params?.classSubjectId) searchParams.set('classSubjectId', params.classSubjectId);
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page !== undefined) searchParams.set('page', String(params.page));
    if (params?.size !== undefined) searchParams.set('size', String(params.size));

    const query = searchParams.toString();
    return fetchData<PageResponse<DevelopmentPlan>>(`/development/plans${query ? `?${query}` : ''}`);
  },
};
