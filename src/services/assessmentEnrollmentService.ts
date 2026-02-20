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

export const assessmentEnrollmentService = {
  getSummary: async (params: EnrollmentSummaryParams = {}): Promise<AssessmentEnrollmentSummary[]> => {
    const query = new URLSearchParams();
    if (params.assignmentId) query.set('assignmentId', params.assignmentId);
    if (params.studentId) query.set('studentId', params.studentId);
    if (params.classId) query.set('classId', params.classId);

    const endpoint = `/assessment-enrollments/summary${query.toString() ? `?${query.toString()}` : ''}`;
    return fetchData<AssessmentEnrollmentSummary[]>(endpoint);
  },
};

