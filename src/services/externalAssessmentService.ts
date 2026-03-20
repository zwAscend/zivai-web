const STUDENT_ASSESSMENT_ENDPOINT = 'http://localhost:8000/api/v1/agents/student/assessment';
export const STUDENT_ASSESSMENT_ACCEPT = '.pdf,.docx,.txt,.md,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,image/png,image/jpeg';
export const STUDENT_ASSESSMENT_FILE_HELPER = 'Upload PDF, DOCX, TXT, Markdown, or image work for OCR-assisted feedback.';

interface AssessmentCriteria {
  criterion: string;
  score: number;
  feedback: string;
}

interface QuestionAssessment {
  max_marks: number;
  awarded_marks: number;
  feedback: string;
  improvement: string;
}

interface AssessmentData {
  is_correct_module: boolean;
  confidence_assessment_score: number;
  total_possible_marks: number;
  marks_achieved: number;
  marks_percentage: number;
  overall_feedback: string;
  strengths: string[];
  improvements: string[];
  criteria: AssessmentCriteria[];
  assessment_details: Record<string, QuestionAssessment>;
  detected_module: string | null;
  mark_consistency_check: string;
  marking_scheme_used: boolean;
}

export interface AssessmentResponseData {
  module: string;
  filename?: string;
  content_type?: string;
  ocr_type?: string;
  markdown: string;
  pages?: number;
  assessment: AssessmentData;
  file_id?: string;
  file_url?: string;
  view_url?: string;
}

export interface AssessmentResponse {
  success: boolean;
  data?: AssessmentResponseData;
  error?: string;
  message?: string;
}

export interface StudentAssessmentQuestionRequest {
  request_context?: {
    question_id?: string;
    assessment_question_id?: string;
    student_id?: string;
    assessment_attempt_id?: string;
  };
  question: {
    text: string;
    subject?: string | null;
    topic?: string | null;
    question_type?: string | null;
    max_marks: number;
  };
  student_answer?: {
    text?: string | null;
  };
  marking_guide?: {
    rubric_items?: Array<{
      index: number;
      description: string;
      marks: number;
      keywords?: string[];
    }>;
    expected_answer?: string | null;
    expected_points?: string[];
  };
  options?: {
    dry_run?: boolean;
    force?: boolean;
    allow_holistic_fallback?: boolean;
  };
}

interface StudentAssessmentRequestOptions {
  moduleName: string;
  textContent?: string;
  file?: File | null;
  requestPayload?: StudentAssessmentQuestionRequest;
}

const buildRequestOptions = (formData: FormData): RequestInit => ({
  method: 'POST',
  body: formData,
  redirect: 'follow',
});

const parseAssessmentResponse = async (response: Response): Promise<AssessmentResponse> => {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Assessment API error: ${response.status} - ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
  }

  const result = await response.json();
  return {
    success: true,
    data: result,
  };
};

const assessSubmission = async ({ moduleName, textContent, file, requestPayload }: StudentAssessmentRequestOptions): Promise<AssessmentResponse> => {
  const formData = new FormData();
  if (moduleName.trim()) {
    formData.append('module', moduleName.trim());
  }
  if (typeof textContent === 'string' && textContent.trim()) {
    formData.append('text', textContent.trim());
  }
  if (file) {
    formData.append('file', file, file.name);
  }
  if (requestPayload) {
    formData.append('request', JSON.stringify(requestPayload));
  }

  try {
    const response = await fetch(STUDENT_ASSESSMENT_ENDPOINT, buildRequestOptions(formData));
    return await parseAssessmentResponse(response);
  } catch (error) {
    console.error('External Assessment Service Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      message: 'Failed to assess submission using external service',
    };
  }
};

export const externalAssessmentService = {
  assessDocument: async (file: File, moduleName: string): Promise<AssessmentResponse> => {
    return assessSubmission({ file, moduleName });
  },

  assessText: async (textContent: string, moduleName: string): Promise<AssessmentResponse> => {
    return assessSubmission({ textContent, moduleName });
  },

  assessQuestionResponse: async (options: {
    moduleName: string;
    responseText?: string;
    file?: File | null;
    requestPayload: StudentAssessmentQuestionRequest;
  }): Promise<AssessmentResponse> => {
    return assessSubmission({
      moduleName: options.moduleName,
      textContent: options.responseText,
      file: options.file,
      requestPayload: options.requestPayload,
    });
  },
};
