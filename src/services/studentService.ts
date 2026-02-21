import { ApiError, fetchData } from './http';
import { Student } from '../types';

export interface StudentTeacher {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  subjectNames: string[];
  classNames: string[];
  homeroomClassNames: string[];
}

export interface StudentChallengeEligibility {
  eligible: boolean;
  reason: string;
  minQuestionsRequired: number;
  availableQuestions: number;
}

export interface StudentSubjectOverviewTopic {
  topicId: string;
  code: string;
  name: string;
  sequenceIndex?: number | null;
  masteryPercent: number;
  questionCount: number;
}

export interface StudentSubjectOverviewUnit {
  unitId: string;
  unitNumber: number;
  code: string;
  title: string;
  topicCount: number;
  questionCount: number;
  masteryPercent: number;
  topics: StudentSubjectOverviewTopic[];
}

export interface StudentSubjectOverview {
  studentId: string;
  subjectId: string;
  subjectName: string;
  topicCount: number;
  unitCount: number;
  totalQuestionCount: number;
  challengeEligibility: StudentChallengeEligibility;
  units: StudentSubjectOverviewUnit[];
}

export interface StudentAssessmentHistoryItem {
  enrollmentId: string;
  assignmentId: string;
  assessmentId: string;
  assessmentName: string;
  assessmentType?: string;
  subjectId?: string;
  subjectName?: string;
  startTime?: string | null;
  dueTime?: string | null;
  published: boolean;
  status: string;
  submissionId?: string | null;
  attemptNumber?: number | null;
  submittedAt?: string | null;
  gradedAt?: string | null;
  score?: number | null;
  maxScore?: number | null;
  expectedMark?: number | null;
  actualMark?: number | null;
  grade?: string | null;
  feedback?: string | null;
}

export interface StudentAssessmentDetail {
  studentId: string;
  assessmentId: string;
  assessmentName: string;
  assessmentType?: string;
  subjectId?: string;
  subjectName?: string;
  description?: string | null;
  maxScore?: number | null;
  latestStatus?: string | null;
  latestDueTime?: string | null;
  latestScore?: number | null;
  latestGrade?: string | null;
  latestFeedback?: string | null;
  history: StudentAssessmentHistoryItem[];
}

export interface StudentAssessmentHistoryFilters {
  status?: string;
  subjectId?: string;
  from?: string;
  to?: string;
}

interface StudentFetchOptions {
  forceRefresh?: boolean;
}

interface EnrollmentSummaryFallbackItem {
  id: string;
  statusCode?: string;
  assignmentId: string;
  assessmentId: string;
  assessmentName: string;
  dueTime?: string | null;
  published: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const tryStudentAssessmentEndpoints = import.meta.env.VITE_ENABLE_STUDENT_ASSESSMENT_ENDPOINTS === 'true';
let supportsStudentAssessmentEndpoints: boolean | null = tryStudentAssessmentEndpoints ? null : false;

const parseTimestamp = (value?: string | null): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const normalizeFallbackStatus = (value?: string | null): string => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'graded' || normalized === 'submitted' || normalized === 'overdue' || normalized === 'pending') {
    return normalized;
  }
  if (normalized === 'reviewed') return 'graded';
  if (normalized === 'assigned' || normalized === 'open') return 'pending';
  return normalized || 'pending';
};

const mapFallbackEnrollmentToHistory = (item: EnrollmentSummaryFallbackItem): StudentAssessmentHistoryItem => ({
  enrollmentId: item.id,
  assignmentId: item.assignmentId,
  assessmentId: item.assessmentId,
  assessmentName: item.assessmentName,
  published: !!item.published,
  dueTime: item.dueTime || null,
  status: normalizeFallbackStatus(item.statusCode),
  submissionId: null,
  attemptNumber: null,
  submittedAt: null,
  gradedAt: null,
  score: null,
  maxScore: null,
  expectedMark: null,
  actualMark: null,
  grade: null,
  feedback: null,
});

const applyHistoryFilters = (
  items: StudentAssessmentHistoryItem[],
  filters: StudentAssessmentHistoryFilters
): StudentAssessmentHistoryItem[] => {
  return items.filter((item) => {
    if (filters.status) {
      const targetStatus = String(filters.status).trim().toLowerCase();
      if (targetStatus && normalizeFallbackStatus(item.status) !== targetStatus) {
        return false;
      }
    }

    const dueTime = parseTimestamp(item.dueTime);
    if (filters.from) {
      const fromTime = parseTimestamp(filters.from);
      if (fromTime && dueTime && dueTime < fromTime) {
        return false;
      }
    }
    if (filters.to) {
      const toTime = parseTimestamp(filters.to);
      if (toTime && dueTime && dueTime > toTime) {
        return false;
      }
    }

    return true;
  });
};

const fetchFallbackAssessmentHistory = async (
  studentId: string,
  filters: StudentAssessmentHistoryFilters,
  options: StudentFetchOptions
): Promise<StudentAssessmentHistoryItem[]> => {
  const query = new URLSearchParams();
  query.set('studentId', studentId);
  const endpoint = `/assessment-enrollments/summary?${query.toString()}`;

  try {
    const fallbackSummary = await fetchData<EnrollmentSummaryFallbackItem[]>(endpoint, {
      cacheTtlMs: 30 * 1000,
      forceRefresh: !!options.forceRefresh,
    });

    const mapped = fallbackSummary.map(mapFallbackEnrollmentToHistory);
    return applyHistoryFilters(mapped, filters);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
};

export const studentService = {
  getStudents: async (subjectId?: string): Promise<Student[]> => {
    const endpoint = subjectId ? `/students?subjectId=${subjectId}` : '/students';
    return fetchData(endpoint, { cacheTtlMs: 60 * 1000 });
  },

  getStudent: async (id: string): Promise<Student> => {
    if (!id || id === 'undefined') {
      throw new Error('Student id is required');
    }
    return fetchData<Student>(`/students/${id}`, { cacheTtlMs: 5 * 60 * 1000 });
  },

  getTeachers: async (id: string): Promise<StudentTeacher[]> => {
    if (!id || id === 'undefined') {
      throw new Error('Student id is required');
    }
    return fetchData<StudentTeacher[]>(`/students/${id}/teachers`, { cacheTtlMs: 5 * 60 * 1000 });
  },

  getSubjectOverview: async (studentId: string, subjectId: string): Promise<StudentSubjectOverview> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    if (!subjectId || subjectId === 'undefined') {
      throw new Error('Subject id is required');
    }
    return fetchData<StudentSubjectOverview>(
      `/students/${studentId}/subjects/${subjectId}/overview`,
      { cacheTtlMs: 2 * 60 * 1000 }
    );
  },

  getAssessmentHistory: async (
    studentId: string,
    filters: StudentAssessmentHistoryFilters = {},
    options: StudentFetchOptions = {}
  ): Promise<StudentAssessmentHistoryItem[]> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }

    const query = new URLSearchParams();
    if (filters.status) query.set('status', filters.status);
    if (filters.subjectId) query.set('subjectId', filters.subjectId);
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);
    const endpoint = `/students/${studentId}/assessments${query.toString() ? `?${query.toString()}` : ''}`;

    if (supportsStudentAssessmentEndpoints !== false) {
      try {
        const result = await fetchData<StudentAssessmentHistoryItem[]>(endpoint, {
          cacheTtlMs: 30 * 1000,
          forceRefresh: !!options.forceRefresh,
        });
        supportsStudentAssessmentEndpoints = true;
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          supportsStudentAssessmentEndpoints = false;
        } else {
          throw error;
        }
      }
    }

    return fetchFallbackAssessmentHistory(studentId, filters, options);
  },

  getAssessmentDetail: async (
    studentId: string,
    assessmentId: string,
    options: StudentFetchOptions = {}
  ): Promise<StudentAssessmentDetail> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    if (!assessmentId || assessmentId === 'undefined') {
      throw new Error('Assessment id is required');
    }

    if (supportsStudentAssessmentEndpoints !== false) {
      try {
        const result = await fetchData<StudentAssessmentDetail>(`/students/${studentId}/assessments/${assessmentId}`, {
          cacheTtlMs: 60 * 1000,
          forceRefresh: !!options.forceRefresh,
        });
        supportsStudentAssessmentEndpoints = true;
        return result;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          supportsStudentAssessmentEndpoints = false;
        } else {
          throw error;
        }
      }
    }

    const history = await studentService.getAssessmentHistory(studentId, {}, options);
    const assessmentHistory = history.filter((item) => item.assessmentId === assessmentId);
    const latest = assessmentHistory[0];

    return {
      studentId,
      assessmentId,
      assessmentName: latest?.assessmentName || 'Assessment',
      assessmentType: latest?.assessmentType || undefined,
      subjectId: latest?.subjectId || undefined,
      subjectName: latest?.subjectName || undefined,
      description: null,
      maxScore: latest?.maxScore ?? null,
      latestStatus: latest?.status || null,
      latestDueTime: latest?.dueTime || null,
      latestScore: latest?.score ?? latest?.actualMark ?? null,
      latestGrade: latest?.grade || null,
      latestFeedback: latest?.feedback || null,
      history: assessmentHistory,
    };
  },

  createStudent: async (studentData: Partial<Student>): Promise<Student> => {
    return fetchData<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  },

  updateStudent: async (id: string, studentData: Partial<Student>): Promise<Student> => {
    return fetchData<Student>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  },

  deleteStudent(id: string): Promise<{ message: string }> {
    return fetchData(`/students/${id}`, {
      method: 'DELETE',
    });
  }
};
