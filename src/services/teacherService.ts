import { fetchData } from './http';
import { PageResponse } from '../types';

export interface TeacherBasic {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber?: string;
  roles: string[];
}

export interface TeacherSubjectSummary {
  subjectId: string;
  subjectCode?: string;
  subjectName: string;
  classCount: number;
  studentCount: number;
}

export interface TeacherClassSummary {
  classId: string;
  code?: string;
  name: string;
  gradeLevel?: string;
  academicYear?: string;
  subjectCount: number;
  studentCount: number;
}

export interface TeacherAssessmentOverview {
  assignmentId: string;
  assessmentId: string;
  assessmentName: string;
  assessmentType?: string;
  assessmentStatus?: string;
  subjectId: string;
  subjectName: string;
  classId?: string;
  className?: string;
  dueTime?: string | null;
  published: boolean;
  aiEnhanced: boolean;
  attempted: number;
  submitted: number;
  passed: number;
  failed: number;
  averageScore: number;
  passRate: number;
  studentActualMark?: number | null;
  studentExpectedMark?: number | null;
  studentGrade?: string | null;
  studentStatus?: string | null;
}

export interface TeacherStudentSummary {
  studentId: string;
  firstName: string;
  lastName: string;
  email: string;
  overall?: number | null;
  performance?: string | null;
  engagement?: string | null;
  strength?: string | null;
  subjectCount: number;
  classCount: number;
  planStatus?: string | null;
  planProgress?: number | null;
  activePlanName?: string | null;
}

export interface TeacherStudentProfileSummary {
  teacherId: string;
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    overall?: number | null;
    performance?: string | null;
    engagement?: string | null;
    strength?: string | null;
    gradeLevel?: string | null;
  };
  planSummary: {
    totalPlans: number;
    activePlans: number;
    completedPlans: number;
    averageProgress?: number | null;
    latestStatus?: string | null;
    latestPlanName?: string | null;
  };
  assessmentSummary: {
    totalAssigned: number;
    attempted: number;
    reviewed: number;
    averageScore?: number | null;
    latestAssessmentName?: string | null;
    latestDueTime?: string | null;
    latestScore?: number | null;
    latestGrade?: string | null;
  };
}

export interface TeacherDashboardSummary {
  teacherId: string;
  subjectId?: string | null;
  totalStudents: number;
  pendingSubmissions: number;
  reviewedSubmissions: number;
  autoGradedSubmissions: number;
  averageScore: number;
  averageAiConfidence: number;
  unreadNotifications: number;
  criticalAlerts: number;
  masteryRiskCount: number;
  activePlans: number;
}

export interface TeacherPerformanceMisconception {
  id: string;
  title: string;
  summary: string;
  riskLevel: string;
  learnerCount: number;
  averageScore: number;
  studentIds: string[];
}

export interface TeacherPerformanceHeatmapCell {
  studentId: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  score?: number | null;
  intensity: number;
  status: string;
  performance?: string | null;
  engagement?: string | null;
  strength?: string | null;
  className?: string | null;
  activePlanName?: string | null;
  planProgress?: number | null;
  latestAssessmentName?: string | null;
  latestAssessmentScore?: number | null;
  focusArea?: string | null;
  note?: string | null;
}

export interface TeacherPerformanceOverview {
  teacherId: string;
  subjectId?: string | null;
  subjectName?: string | null;
  topicId?: string | null;
  topicName?: string | null;
  assessmentId?: string | null;
  assessmentName?: string | null;
  currentView: 'subject' | 'topic' | 'assessment' | string;
  summary: {
    totalStudents: number;
    studentsWithData: number;
    supportCount: number;
    onTrackCount: number;
    averageScore: number;
    filterLabel?: string | null;
    strongestArea?: string | null;
    weakestArea?: string | null;
  };
  heatmap: {
    columns: number;
    cells: TeacherPerformanceHeatmapCell[];
  };
  misconceptions: TeacherPerformanceMisconception[];
}

export interface TeacherAssessmentsOverviewFilters {
  subjectId?: string;
  status?: string;
  studentId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export interface TeacherStudentsSummaryFilters {
  subjectId?: string;
  classId?: string;
  performance?: string;
  planStatus?: string;
  q?: string;
  page?: number;
  size?: number;
}

export interface TeacherPerformanceOverviewFilters {
  subjectId?: string;
  topicId?: string;
  assessmentId?: string;
  classId?: string;
}

export const teacherService = {
  getTeacher: async (teacherId: string): Promise<TeacherBasic> => {
    return fetchData<TeacherBasic>(`/teachers/${teacherId}`, { cacheTtlMs: 5 * 60 * 1000 });
  },

  getMe: async (teacherId: string): Promise<TeacherBasic> => {
    const query = new URLSearchParams({ teacherId });
    return fetchData<TeacherBasic>(`/teachers/me?${query.toString()}`, { cacheTtlMs: 5 * 60 * 1000 });
  },

  getMySubjects: async (teacherId: string): Promise<TeacherSubjectSummary[]> => {
    const query = new URLSearchParams({ teacherId });
    return fetchData<TeacherSubjectSummary[]>(`/teachers/me/subjects?${query.toString()}`, {
      cacheTtlMs: 2 * 60 * 1000,
    });
  },

  getMyClasses: async (teacherId: string, subjectId?: string): Promise<TeacherClassSummary[]> => {
    const query = new URLSearchParams({ teacherId });
    if (subjectId) query.set('subjectId', subjectId);
    return fetchData<TeacherClassSummary[]>(`/teachers/me/classes?${query.toString()}`, {
      cacheTtlMs: 2 * 60 * 1000,
    });
  },

  getAssessmentsOverview: async (
    teacherId: string,
    filters: TeacherAssessmentsOverviewFilters = {}
  ): Promise<TeacherAssessmentOverview[]> => {
    const query = new URLSearchParams();
    if (filters.subjectId) query.set('subjectId', filters.subjectId);
    if (filters.status) query.set('status', filters.status);
    if (filters.studentId) query.set('studentId', filters.studentId);
    if (filters.search) query.set('search', filters.search);
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);

    return fetchData<TeacherAssessmentOverview[]>(
      `/teachers/${teacherId}/assessments/overview${query.toString() ? `?${query.toString()}` : ''}`,
      { cacheTtlMs: 30 * 1000 }
    );
  },

  getStudentsSummary: async (
    teacherId: string,
    filters: TeacherStudentsSummaryFilters = {}
  ): Promise<PageResponse<TeacherStudentSummary>> => {
    const query = new URLSearchParams();
    if (filters.subjectId) query.set('subjectId', filters.subjectId);
    if (filters.classId) query.set('classId', filters.classId);
    if (filters.performance) query.set('performance', filters.performance);
    if (filters.planStatus) query.set('planStatus', filters.planStatus);
    if (filters.q) query.set('q', filters.q);
    query.set('page', String(filters.page ?? 0));
    query.set('size', String(filters.size ?? 20));

    return fetchData<PageResponse<TeacherStudentSummary>>(
      `/teachers/${teacherId}/students/summary?${query.toString()}`,
      { cacheTtlMs: 30 * 1000 }
    );
  },

  getStudentProfileSummary: async (
    teacherId: string,
    studentId: string,
    subjectId?: string
  ): Promise<TeacherStudentProfileSummary> => {
    const query = new URLSearchParams();
    if (subjectId) query.set('subjectId', subjectId);
    return fetchData<TeacherStudentProfileSummary>(
      `/teachers/${teacherId}/students/${studentId}/profile-summary${query.toString() ? `?${query.toString()}` : ''}`,
      { cacheTtlMs: 30 * 1000 }
    );
  },

  getDashboard: async (teacherId: string, subjectId?: string): Promise<TeacherDashboardSummary> => {
    const query = new URLSearchParams();
    if (subjectId) query.set('subjectId', subjectId);
    return fetchData<TeacherDashboardSummary>(
      `/teachers/${teacherId}/dashboard${query.toString() ? `?${query.toString()}` : ''}`,
      { cacheTtlMs: 30 * 1000 }
    );
  },

  getPerformanceOverview: async (
    teacherId: string,
    filters: TeacherPerformanceOverviewFilters = {}
  ): Promise<TeacherPerformanceOverview> => {
    const query = new URLSearchParams();
    if (filters.subjectId) query.set('subjectId', filters.subjectId);
    if (filters.topicId) query.set('topicId', filters.topicId);
    if (filters.assessmentId) query.set('assessmentId', filters.assessmentId);
    if (filters.classId) query.set('classId', filters.classId);

    return fetchData<TeacherPerformanceOverview>(
      `/teachers/${teacherId}/performance/overview${query.toString() ? `?${query.toString()}` : ''}`,
      { cacheTtlMs: 15 * 1000 }
    );
  },
};
