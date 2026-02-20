import { API_URL, fetchData } from './http';
import { SubmissionPayload } from '../types';

export const submissionService = {
  submitAnswers: async (payload: {
    assessmentId: string;
    assessmentAssignmentId?: string;
    studentId: string;
    submissionType?: string;
    answers: Array<{
      assessmentQuestionId: string;
      studentAnswerText?: string;
      studentAnswerBlob?: unknown;
    }>;
  }) => {
    return fetchData('/submissions/answers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  submitAssignment: async (submissionData: SubmissionPayload): Promise<any> => {
    const formData = new FormData();

    formData.append('assessmentId', submissionData.assessmentId);
    formData.append('studentId', submissionData.studentId);
    formData.append('submissionType', submissionData.submissionType);

    if (submissionData.submissionType === 'file' && submissionData.file) {
      formData.append('file', submissionData.file);
    }

    if (submissionData.submissionType === 'text' && submissionData.textContent) {
      formData.append('textContent', submissionData.textContent);
    }

    if (submissionData.externalAssessmentData) {
      formData.append('externalAssessmentData', JSON.stringify(submissionData.externalAssessmentData));
    }

    if (submissionData.result) {
      formData.append('result', submissionData.result);
    }

    if (submissionData.originalFilename) {
      formData.append('originalFilename', submissionData.originalFilename);
    }
    if (submissionData.fileType) {
      formData.append('fileType', submissionData.fileType);
    }

    try {
      const response = await fetch(`${API_URL}/submissions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to submit assignment`);
      }

      return response.json();
    } catch (error) {
      console.error('Submission error:', error);
      throw error;
    }
  },

  getSubmissionDetails: async (submissionId: string) => {
    return fetchData(`/submissions/${submissionId}`);
  },

  getStudentSubmissions: async (studentId: string) => {
    return fetchData(`/submissions/student/${studentId}`);
  },

  reviewSubmission: async (submissionId: string, reviewData: {
    scoreAdjustment?: number;
    feedbackAdjustment?: string;
    finalScore?: number;
    finalGrade?: string;
  }) => {
    return fetchData(`/submissions/${submissionId}/review`, {
      method: 'PUT',
      body: JSON.stringify(reviewData),
    });
  },

  getPendingSubmissions: async () => {
    return fetchData('/submissions/teacher/pending');
  },

  getGradingStats: async (subjectId?: string, timeframe?: string) => {
    const params = new URLSearchParams();
    if (subjectId) params.append('subjectId', subjectId);
    if (timeframe) params.append('timeframe', timeframe);

    const queryString = params.toString();
    const endpoint = queryString ? `/submissions/stats?${queryString}` : '/submissions/stats';

    return fetchData(endpoint);
  }
};
