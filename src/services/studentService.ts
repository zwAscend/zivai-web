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

export interface StudentActivityFeedItem {
  id: string;
  activityType: string;
  sourceId: string;
  title: string;
  subjectId?: string | null;
  subjectName?: string | null;
  occurredAt?: string | null;
  level?: string | null;
  progressPercent?: number | null;
  correctCount?: number | null;
  totalCount?: number | null;
  score?: number | null;
  maxScore?: number | null;
  timeMinutes?: number | null;
}

export interface StudentActivityFeedFilters {
  subjectId?: string;
  from?: string;
  to?: string;
  limit?: number;
}

export interface StartStudentPracticeSessionPayload {
  topicId?: string;
  questionCount?: number;
  mode?: 'topic_practice' | 'topic_challenge' | 'subject_challenge';
  title?: string;
}

export interface StudentPracticeSessionQuestion {
  assessmentQuestionId: string;
  questionId: string;
  topicId?: string | null;
  topicName?: string | null;
  prompt: string;
  questionType: string;
  maxScore?: number | null;
  options: string[];
  multipleSelection: boolean;
}

export interface StudentPracticeSession {
  sessionId: string;
  assessmentId: string;
  assignmentId: string;
  enrollmentId: string;
  subjectId: string;
  subjectName: string;
  topicId?: string | null;
  topicName?: string | null;
  mode: string;
  title: string;
  status: string;
  startedAt?: string | null;
  submittedAt?: string | null;
  questionCount?: number | null;
  answeredCount?: number | null;
  correctCount?: number | null;
  score?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  durationMinutes?: number | null;
  questions: StudentPracticeSessionQuestion[];
}

export interface StudentPracticeAnswerPayload {
  assessmentQuestionId: string;
  studentAnswerText?: string;
  selectedOptions?: string[];
  skipped?: boolean;
}

export interface StudentPracticeAnswerResult {
  sessionId: string;
  answerId: string;
  assessmentQuestionId: string;
  correct: boolean;
  skipped: boolean;
  score?: number | null;
  maxScore?: number | null;
  feedback?: string | null;
  gradedAt?: string | null;
  answeredCount?: number | null;
  totalQuestions?: number | null;
  correctCount?: number | null;
  sessionScore?: number | null;
  sessionMaxScore?: number | null;
  sessionPercentage?: number | null;
  completed: boolean;
}

export interface StudentPlanRuntimeProgressPayload {
  completedStepIds?: string[];
  activeStepId?: string;
  status?: string;
}

export interface StudentPlanRuntimeProgressResult {
  studentPlanId: string;
  studentId: string;
  activeStepId?: string | null;
  completedStepIds: string[];
  totalSteps: number;
  completedSteps: number;
  currentProgress: number;
  status: string;
  updatedAt?: string | null;
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
  subjectId?: string | null;
  subjectName?: string | null;
  dueTime?: string | null;
  published: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const tryStudentAssessmentEndpoints = import.meta.env.VITE_ENABLE_STUDENT_ASSESSMENT_ENDPOINTS !== 'false';
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
  subjectId: item.subjectId || undefined,
  subjectName: item.subjectName || undefined,
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
    if (filters.subjectId) {
      if (!item.subjectId || item.subjectId !== filters.subjectId) {
        return false;
      }
    }

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
  if (filters.subjectId) {
    query.set('subjectId', filters.subjectId);
  }
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

  getActivityFeed: async (
    studentId: string,
    filters: StudentActivityFeedFilters = {},
    options: StudentFetchOptions = {}
  ): Promise<StudentActivityFeedItem[]> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }

    const query = new URLSearchParams();
    if (filters.subjectId) query.set('subjectId', filters.subjectId);
    if (filters.from) query.set('from', filters.from);
    if (filters.to) query.set('to', filters.to);
    if (typeof filters.limit === 'number') query.set('limit', String(filters.limit));

    const endpoint = `/students/${studentId}/activity-feed${query.toString() ? `?${query.toString()}` : ''}`;
    return fetchData<StudentActivityFeedItem[]>(endpoint, {
      cacheTtlMs: 30 * 1000,
      forceRefresh: !!options.forceRefresh,
    });
  },

  startPracticeSession: async (
    studentId: string,
    subjectId: string,
    payload: StartStudentPracticeSessionPayload = {}
  ): Promise<StudentPracticeSession> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    if (!subjectId || subjectId === 'undefined') {
      throw new Error('Subject id is required');
    }
    return fetchData<StudentPracticeSession>(`/students/${studentId}/subjects/${subjectId}/practice-sessions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  submitPracticeAnswer: async (
    studentId: string,
    sessionId: string,
    payload: StudentPracticeAnswerPayload
  ): Promise<StudentPracticeAnswerResult> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    if (!sessionId || sessionId === 'undefined') {
      throw new Error('Practice session id is required');
    }
    return fetchData<StudentPracticeAnswerResult>(`/students/${studentId}/practice-sessions/${sessionId}/answers`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  completePracticeSession: async (studentId: string, sessionId: string): Promise<StudentPracticeSession> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    if (!sessionId || sessionId === 'undefined') {
      throw new Error('Practice session id is required');
    }
    return fetchData<StudentPracticeSession>(`/students/${studentId}/practice-sessions/${sessionId}/complete`, {
      method: 'POST',
    });
  },

  getPracticeSessionHistory: async (
    studentId: string,
    subjectId?: string,
    limit?: number
  ): Promise<StudentPracticeSession[]> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    const query = new URLSearchParams();
    if (subjectId) query.set('subjectId', subjectId);
    if (typeof limit === 'number') query.set('limit', String(limit));
    const endpoint = `/students/${studentId}/practice-sessions/history${query.toString() ? `?${query.toString()}` : ''}`;
    return fetchData<StudentPracticeSession[]>(endpoint, { cacheTtlMs: 30 * 1000 });
  },

  updatePlanRuntimeProgress: async (
    studentId: string,
    studentPlanId: string,
    payload: StudentPlanRuntimeProgressPayload
  ): Promise<StudentPlanRuntimeProgressResult> => {
    if (!studentId || studentId === 'undefined') {
      throw new Error('Student id is required');
    }
    if (!studentPlanId || studentPlanId === 'undefined') {
      throw new Error('Student plan id is required');
    }
    return fetchData<StudentPlanRuntimeProgressResult>(`/students/${studentId}/plans/${studentPlanId}/runtime`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
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
