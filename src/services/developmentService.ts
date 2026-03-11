import { fetchData } from './http';
import { DevelopmentPlan, StudentAttributes, SubjectAttribute, Plan, PlanStatus, PageResponse } from '../types';

export interface MasterySignalsSummary {
  totalStudents: number;
  excellent: number;
  good: number;
  average: number;
  needsImprovement: number;
  averageOverall: number;
}

export interface StudentStreakSummary {
  studentId: string;
  streakDays: number;
  streakWeeks: number;
  level: number;
  progressToNextWeek: number;
  activeToday: boolean;
  lastActiveDate?: string | null;
}

export interface UpdateStudentPlanPayload {
  planId?: string;
  subjectId?: string;
  currentProgress?: number;
  status?: string;
  current?: boolean;
  startDate?: string;
  completionDate?: string;
  name?: string;
  description?: string;
  progress?: number;
  potentialOverall?: number;
  eta?: number;
  performance?: string;
  skills?: Array<{
    name: string;
    score?: number;
    subskills?: Array<{
      name: string;
      score?: number;
      color?: string;
    }>;
  }>;
  steps?: Array<{
    title: string;
    type: string;
    content?: string;
    link?: string;
    order?: number;
    additionalResources?: string[];
  }>;
}

export interface StudentPlanStepPayload {
  title: string;
  type: string;
  content?: string;
  link?: string;
  order?: number;
  additionalResources?: string[];
}

export const developmentService = {
  getSubjectAttributes: async (subjectId: string): Promise<SubjectAttribute[]> => {
    return fetchData<SubjectAttribute[]>(`/development/attributes/subject/${subjectId}`, { cacheTtlMs: 10 * 60 * 1000 });
  },

  createSubjectAttribute: async (attributeData: Omit<SubjectAttribute, 'id' | 'createdAt' | 'updatedAt'>): Promise<SubjectAttribute> => {
    return fetchData<SubjectAttribute>('/development/attributes/subject', {
      method: 'POST',
      body: JSON.stringify(attributeData),
    });
  },

  getStudentAttributes: async (studentId: string, subjectId: string): Promise<StudentAttributes> => {
    return fetchData<StudentAttributes>(`/development/attributes/student/${studentId}/subject/${subjectId}`, { cacheTtlMs: 60 * 1000 });
  },

  updateStudentAttributes: async (studentId: string, attributes: Array<{ attributeId: string; current: number; potential: number }>): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/development/attributes/student/${studentId}`, {
      method: 'PUT',
      body: JSON.stringify(attributes),
    });
  },

  getSubjectPlans: async (subjectId: string): Promise<Plan[]> => {
    return fetchData<Plan[]>(`/development/plans/subject/${subjectId}`, { cacheTtlMs: 5 * 60 * 1000 });
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
    return fetchData<DevelopmentPlan>(`/development/plans/student/${studentId}/subject/${subjectId}`, { cacheTtlMs: 60 * 1000 });
  },

  getAllPlansForStudent: async (
    studentId: string,
    status?: string,
    options?: {
      forceRefresh?: boolean;
    }
  ): Promise<DevelopmentPlan[]> => {
    if (!studentId || studentId === 'undefined') {
      return [];
    }
    const query = status ? `?status=${encodeURIComponent(status)}` : '';
    return fetchData<DevelopmentPlan[]>(`/development/plans/student/${studentId}${query}`, {
      cacheTtlMs: 60 * 1000,
      forceRefresh: !!options?.forceRefresh,
    });
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

  deleteStudentPlan: async (studentPlanId: string): Promise<{ message: string }> => {
    return fetchData<{ message: string }>(`/development/plans/student-plan/${studentPlanId}`, {
      method: 'DELETE',
    });
  },

  updateStudentPlan: async (studentPlanId: string, payload: UpdateStudentPlanPayload): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student-plan/${studentPlanId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  addStudentPlanStep: async (studentPlanId: string, payload: StudentPlanStepPayload): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student-plan/${studentPlanId}/steps`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateStudentPlanStep: async (studentPlanId: string, stepId: string, payload: StudentPlanStepPayload): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student-plan/${studentPlanId}/steps/${stepId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  deleteStudentPlanStep: async (studentPlanId: string, stepId: string): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student-plan/${studentPlanId}/steps/${stepId}`, {
      method: 'DELETE',
    });
  },

  reorderStudentPlanSteps: async (studentPlanId: string, stepIds: string[]): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student-plan/${studentPlanId}/steps/reorder`, {
      method: 'PUT',
      body: JSON.stringify({ stepIds }),
    });
  },

  publishStudentPlan: async (studentPlanId: string): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student-plan/${studentPlanId}/publish`, {
      method: 'POST',
    });
  },

  unpublishStudentPlan: async (studentPlanId: string): Promise<DevelopmentPlan> => {
    return fetchData<DevelopmentPlan>(`/development/plans/student-plan/${studentPlanId}/unpublish`, {
      method: 'POST',
    });
  },

  getPublishedStudentPlans: async (studentId: string, subjectId?: string): Promise<DevelopmentPlan[]> => {
    const query = subjectId ? `?subjectId=${encodeURIComponent(subjectId)}` : '';
    return fetchData<DevelopmentPlan[]>(`/students/${studentId}/development-plans${query}`, {
      cacheTtlMs: 60 * 1000,
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

  getMasterySignalsSummary: async (params?: {
    subjectId?: string;
    classId?: string;
    classSubjectId?: string;
  }): Promise<MasterySignalsSummary> => {
    const searchParams = new URLSearchParams();
    if (params?.subjectId) searchParams.set('subjectId', params.subjectId);
    if (params?.classId) searchParams.set('classId', params.classId);
    if (params?.classSubjectId) searchParams.set('classSubjectId', params.classSubjectId);
    const query = searchParams.toString();
    return fetchData<MasterySignalsSummary>(`/development/mastery-signals${query ? `?${query}` : ''}`, { cacheTtlMs: 60 * 1000 });
  },

  getStudentMasterySignalsSummary: async (studentId: string, subjectId?: string): Promise<MasterySignalsSummary> => {
    const searchParams = new URLSearchParams();
    if (subjectId) searchParams.set('subjectId', subjectId);
    const query = searchParams.toString();
    return fetchData<MasterySignalsSummary>(
      `/development/mastery-signals/student/${studentId}${query ? `?${query}` : ''}`,
      { cacheTtlMs: 60 * 1000 }
    );
  },

  getStudentStreak: async (studentId: string): Promise<StudentStreakSummary> => {
    return fetchData<StudentStreakSummary>(`/development/streaks/student/${studentId}`, {
      cacheTtlMs: 60 * 1000,
      forceRefresh: true,
    });
  },

  touchStudentStreak: async (studentId: string): Promise<StudentStreakSummary> => {
    return fetchData<StudentStreakSummary>(`/development/streaks/student/${studentId}/touch`, {
      method: 'POST',
    });
  },
};
