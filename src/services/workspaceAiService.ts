export interface WorkspaceReferenceDocument {
  documentName: string;
  markdown: string;
  file_id?: string;
  file_url?: string;
  view_url?: string;
  pages?: number;
}

export interface TeacherResourceGenerationRequest {
  subjectName?: string;
  topicTitle: string;
  unitTitle?: string;
  gradeLevel?: string;
  contentType: 'resource' | 'practice';
  title?: string;
  objective?: string;
  teacherPrompt?: string;
  existingContent?: string;
  variant?: boolean;
  relatedRecords?: string[];
  referenceDocuments?: WorkspaceReferenceDocument[];
}

export interface TeacherResourceGenerationResponse {
  title: string;
  contentHtml: string;
  summary?: string;
  teacherMessage?: string;
  sourceDocumentsUsed?: string[];
  referenceFallbackUsed?: boolean;
}

export type WorkspacePracticeQuestionType = 'multiple-choice' | 'short-answer';

export interface TeacherPracticeGenerationQuestion {
  prompt: string;
  type: WorkspacePracticeQuestionType;
  marks: number;
  options: string[];
  correctAnswers: string[];
  correctAnswer: string;
  markingGuide: string;
}

export interface TeacherPracticeGenerationRequest {
  subjectName?: string;
  topicTitle: string;
  unitTitle?: string;
  gradeLevel?: string;
  title?: string;
  objective?: string;
  teacherPrompt?: string;
  description?: string;
  practiceType?: 'quiz' | 'assignment' | 'test' | 'project' | 'exam';
  difficulty?: 'easy' | 'medium' | 'hard';
  questionTypeMode?: 'multiple_choice' | 'structured' | 'mixed';
  numberOfQuestions?: number;
  variant?: boolean;
  relatedRecords?: string[];
  existingQuestions?: TeacherPracticeGenerationQuestion[];
  referenceDocuments?: WorkspaceReferenceDocument[];
}

export interface TeacherPracticeGenerationResponse {
  title: string;
  description: string;
  practiceType?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  numberOfQuestions: number;
  questions: TeacherPracticeGenerationQuestion[];
  summary?: string;
  teacherMessage?: string;
  sourceDocumentsUsed?: string[];
  referenceFallbackUsed?: boolean;
}

export const WORKSPACE_REFERENCE_ACCEPT =
  '.pdf,.docx,.txt,.md,.csv,.json,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown,text/csv,application/json,image/png,image/jpeg';
export const WORKSPACE_REFERENCE_HELPER =
  'Attach PDF, DOCX, TXT, Markdown, CSV, JSON, or image references when needed.';

const AI_API_BASE = 'http://localhost:8000/api/v1/agents';
const OCR_ENDPOINT = `${AI_API_BASE}/ocr/general`;
const RESOURCE_GENERATION_ENDPOINT = `${AI_API_BASE}/teacher/resource-generation`;
const PRACTICE_GENERATION_ENDPOINT = `${AI_API_BASE}/teacher/practice-generation`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const workspaceAiService = {
  processDocumentsWithOCR: async (files: File[]): Promise<WorkspaceReferenceDocument[]> => {
    if (!files.length) return [];

    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file, file.name);
    });

    const response = await fetch(OCR_ENDPOINT, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `OCR processing failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const result = await response.json();
    return Array.isArray(result)
      ? result
          .filter(isRecord)
          .map((item) => ({
            documentName: typeof item.documentName === 'string' ? item.documentName : 'Attachment',
            markdown: typeof item.markdown === 'string' ? item.markdown : '',
            file_id: typeof item.file_id === 'string' ? item.file_id : undefined,
            file_url: typeof item.file_url === 'string' ? item.file_url : undefined,
            view_url: typeof item.view_url === 'string' ? item.view_url : undefined,
            pages: typeof item.pages === 'number' ? item.pages : undefined,
          }))
          .filter((item: WorkspaceReferenceDocument) => item.markdown.trim().length > 0)
      : [];
  },

  generateTeacherResource: async (
    payload: TeacherResourceGenerationRequest
  ): Promise<TeacherResourceGenerationResponse> => {
    const response = await fetch(RESOURCE_GENERATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Resource generation failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const result = await response.json();
    return {
      title: typeof result?.title === 'string' ? result.title : '',
      contentHtml: typeof result?.contentHtml === 'string' ? result.contentHtml : '',
      summary: typeof result?.summary === 'string' ? result.summary : undefined,
      teacherMessage: typeof result?.teacherMessage === 'string' ? result.teacherMessage : undefined,
      sourceDocumentsUsed: Array.isArray(result?.sourceDocumentsUsed)
        ? result.sourceDocumentsUsed.filter((value: unknown) => typeof value === 'string')
        : [],
      referenceFallbackUsed: Boolean(result?.referenceFallbackUsed),
    };
  },

  generateTeacherPractice: async (
    payload: TeacherPracticeGenerationRequest
  ): Promise<TeacherPracticeGenerationResponse> => {
    const response = await fetch(PRACTICE_GENERATION_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Practice generation failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
      );
    }

    const result = await response.json();
    const questions = Array.isArray(result?.questions)
      ? result.questions
          .filter((item: unknown) => typeof item === 'object' && item !== null)
          .map((item: Record<string, unknown>) => ({
            prompt: typeof item.prompt === 'string' ? item.prompt : '',
            type: item?.type === 'multiple-choice' ? 'multiple-choice' : 'short-answer',
            marks: typeof item?.marks === 'number' ? item.marks : Number(item?.marks) || 1,
            options: Array.isArray(item?.options)
              ? item.options.filter((value: unknown) => typeof value === 'string')
              : [],
            correctAnswers: Array.isArray(item?.correctAnswers)
              ? item.correctAnswers.filter((value: unknown) => typeof value === 'string')
              : [],
            correctAnswer: typeof item?.correctAnswer === 'string' ? item.correctAnswer : '',
            markingGuide: typeof item?.markingGuide === 'string' ? item.markingGuide : '',
          }))
          .filter((item: TeacherPracticeGenerationQuestion) => item.prompt.trim().length > 0)
      : [];

    return {
      title: typeof result?.title === 'string' ? result.title : '',
      description: typeof result?.description === 'string' ? result.description : '',
      practiceType: typeof result?.practiceType === 'string' ? result.practiceType : undefined,
      difficulty: result?.difficulty === 'easy' || result?.difficulty === 'hard' ? result.difficulty : 'medium',
      numberOfQuestions:
        typeof result?.numberOfQuestions === 'number'
          ? result.numberOfQuestions
          : questions.length,
      questions,
      summary: typeof result?.summary === 'string' ? result.summary : undefined,
      teacherMessage: typeof result?.teacherMessage === 'string' ? result.teacherMessage : undefined,
      sourceDocumentsUsed: Array.isArray(result?.sourceDocumentsUsed)
        ? result.sourceDocumentsUsed.filter((value: unknown) => typeof value === 'string')
        : [],
      referenceFallbackUsed: Boolean(result?.referenceFallbackUsed),
    };
  },
};
