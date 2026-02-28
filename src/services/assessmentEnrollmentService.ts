import { fetchData } from './http';

export interface AssessmentEnrollmentSummary {
  id: string;
  statusCode: string;
  studentId: string;
  studentFirstName: string;
  studentLastName: string;
  studentEmail: string;
  assignmentId: string;
  assessmentId: string;
  assessmentName: string;
  classId?: string | null;
  className?: string | null;
  dueTime?: string | null;
  published: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface EnrollmentSummaryParams {
  assignmentId?: string;
  studentId?: string;
  classId?: string;
}

export interface CreateAssessmentAssignmentPayload {
  assessmentId: string;
  classId?: string;
  assignedBy: string;
  title?: string;
  instructions?: string;
  startTime?: string | null;
  dueTime?: string | null;
  published?: boolean;
}

export interface AssessmentAssignmentItem {
  id: string;
  assessment?: { id?: string; name?: string };
  classEntity?: { id?: string; name?: string } | null;
  assignedBy?: { id?: string; firstName?: string; lastName?: string } | null;
  title?: string;
  instructions?: string;
  startTime?: string | null;
  dueTime?: string | null;
  published?: boolean;
}

export const assessmentEnrollmentService = {
  getSummary: async (params: EnrollmentSummaryParams = {}): Promise<AssessmentEnrollmentSummary[]> => {
    const query = new URLSearchParams();
    if (params.assignmentId) query.set('assignmentId', params.assignmentId);
    if (params.studentId) query.set('studentId', params.studentId);
    if (params.classId) query.set('classId', params.classId);

    const endpoint = `/assessment-enrollments/summary${query.toString() ? `?${query.toString()}` : ''}`;
    return fetchData<AssessmentEnrollmentSummary[]>(endpoint);
  },

  createAssignment: async (payload: CreateAssessmentAssignmentPayload): Promise<AssessmentAssignmentItem> => {
    return fetchData<AssessmentAssignmentItem>('/assessment-assignments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  enrollStudents: async (assignmentId: string, studentIds: string[], statusCode = 'assigned') => {
    return fetchData(`/assessment-assignments/${assignmentId}/enrollments`, {
      method: 'POST',
      body: JSON.stringify({ studentIds, statusCode }),
    });
  },

  publishAssignment: async (assignmentId: string): Promise<AssessmentAssignmentItem> => {
    return fetchData<AssessmentAssignmentItem>(`/assessment-assignments/${assignmentId}/publish`, {
      method: 'POST',
    });
  },
};
