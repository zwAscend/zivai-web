import { fetchData } from './http';
import { studentService } from './studentService';

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
  subjectId?: string | null;
  subjectName?: string | null;
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
  subjectId?: string;
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

export interface PublishAssessmentToSubjectParams {
  assessmentId: string;
  subjectId: string;
  assignedBy: string;
  classId?: string;
  title?: string;
  instructions?: string;
  statusCode?: string;
}

export interface PublishAssessmentToSubjectResult {
  assignment: AssessmentAssignmentItem;
  enrolledCount: number;
}

export const assessmentEnrollmentService = {
  getSummary: async (params: EnrollmentSummaryParams = {}): Promise<AssessmentEnrollmentSummary[]> => {
    const query = new URLSearchParams();
    if (params.assignmentId) query.set('assignmentId', params.assignmentId);
    if (params.studentId) query.set('studentId', params.studentId);
    if (params.classId) query.set('classId', params.classId);
    if (params.subjectId) query.set('subjectId', params.subjectId);

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

  publishAssessmentToSubjectStudents: async (
    payload: PublishAssessmentToSubjectParams
  ): Promise<PublishAssessmentToSubjectResult> => {
    const assignment = await assessmentEnrollmentService.createAssignment({
      assessmentId: payload.assessmentId,
      classId: payload.classId,
      assignedBy: payload.assignedBy,
      title: payload.title,
      instructions: payload.instructions,
      published: false,
    });

    const students = await studentService.getStudents(payload.subjectId);
    const studentIds = Array.isArray(students)
      ? students.map((student) => student.id).filter((studentId): studentId is string => !!studentId)
      : [];

    if (assignment?.id && studentIds.length > 0) {
      await assessmentEnrollmentService.enrollStudents(assignment.id, studentIds, payload.statusCode || 'assigned');
    }

    if (!assignment?.id) {
      throw new Error('Assignment was not created correctly for publish.');
    }

    const publishedAssignment = await assessmentEnrollmentService.publishAssignment(assignment.id);
    const enrollmentSummary = await assessmentEnrollmentService.getSummary({ assignmentId: assignment.id });
    return {
      assignment: publishedAssignment,
      enrolledCount: Array.isArray(enrollmentSummary) ? enrollmentSummary.length : studentIds.length,
    };
  },
};
