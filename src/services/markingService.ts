import { Assessment } from '../types';

export interface MarkingResult {
  marks: number;
  feedback: string;
  criteria: Array<{
    criterion: string;
    score: number;
    comments: string;
  }>;
}

type AssessmentQuestionRecord = {
  id?: string;
  stem?: string;
  text?: string;
  questionTypeCode?: string;
  type?: string;
  points?: number;
  maxMark?: number;
  rubricJson?: Record<string, unknown> | null;
};

type OcrDocument = {
  documentName: string;
  markdown: string;
};

const AI_API_BASE = 'http://localhost:8000/api/v1';
const OCR_ENDPOINT = `${AI_API_BASE}/agents/ocr/general`;
const GRADE_ASSESSMENT_ENDPOINT = `${AI_API_BASE}/grade/assessment`;

const collapseWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const parseAssessmentQuestions = (assessment: Assessment): AssessmentQuestionRecord[] => {
  if (Array.isArray(assessment.questions)) {
    return assessment.questions as AssessmentQuestionRecord[];
  }
  if (typeof assessment.questions === 'string') {
    try {
      const parsed = JSON.parse(assessment.questions);
      return Array.isArray(parsed) ? parsed as AssessmentQuestionRecord[] : [];
    } catch {
      return [];
    }
  }
  return [];
};

const normalizeQuestionType = (question: AssessmentQuestionRecord): string => {
  const value = String(question.questionTypeCode || question.type || '').toLowerCase();
  if (value === 'mcq' || value === 'multiple-choice' || value === 'multiple_choice') return 'multiple_choice';
  if (value === 'true_false' || value === 'true-false') return 'true_false';
  if (value === 'essay') return 'essay';
  return 'short_answer';
};

const buildRubricPayload = (question: AssessmentQuestionRecord) => {
  const rubric = question.rubricJson && typeof question.rubricJson === 'object'
    ? question.rubricJson
    : null;
  const rubricItemsRaw = Array.isArray(rubric?.rubricItems) ? rubric.rubricItems : [];
  const rubricItems = rubricItemsRaw
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item, index) => ({
      index: Number(item.index || index + 1),
      description: String(item.description || item.point || '').trim(),
      marks: Number(item.marks || 1),
      keywords: Array.isArray(item.keywords)
        ? item.keywords.map((keyword) => String(keyword || '').trim()).filter(Boolean)
        : [],
    }))
    .filter((item) => item.description.length > 0);

  const expectedAnswer = typeof rubric?.expectedAnswer === 'string'
    ? rubric.expectedAnswer
    : typeof rubric?.correctAnswer === 'string'
      ? rubric.correctAnswer
      : typeof rubric?.answer === 'string'
        ? rubric.answer
        : '';

  const expectedPoints = Array.isArray(rubric?.markingPoints)
    ? rubric.markingPoints.map((point) => String(point || '').trim()).filter(Boolean)
    : [];

  return {
    rubric_items: rubricItems,
    expected_answer: expectedAnswer || undefined,
    expected_points: expectedPoints,
  };
};

const readTextLikeFile = async (file: File): Promise<OcrDocument[]> => {
  const text = (await file.text()).trim();
  return text ? [{ documentName: file.name, markdown: text }] : [];
};

const extractSubmissionText = async (file: File): Promise<OcrDocument[]> => {
  if (
    file.type === 'text/plain'
    || file.type === 'text/markdown'
    || file.type === 'text/csv'
    || file.type === 'application/json'
  ) {
    return readTextLikeFile(file);
  }

  const formData = new FormData();
  formData.append('files', file, file.name);

  const response = await fetch(OCR_ENDPOINT, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OCR processing failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
  }

  const result = await response.json();
  return Array.isArray(result)
    ? result
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          documentName: typeof item.documentName === 'string' ? item.documentName : file.name,
          markdown: typeof item.markdown === 'string' ? item.markdown : '',
        }))
        .filter((item) => item.markdown.trim().length > 0)
    : [];
};

const splitSubmissionIntoAnswers = (submissionText: string, questionCount: number): string[] => {
  const normalized = submissionText.replace(/\r\n/g, '\n').trim();
  if (!normalized || questionCount <= 1) {
    return Array.from({ length: Math.max(1, questionCount) }, () => normalized);
  }

  const markers = Array.from({ length: questionCount }, (_, index) => {
    const pattern = new RegExp(`(?:^|\\n)\\s*(?:question\\s*)?${index + 1}[\\).:\\-]\\s*`, 'i');
    const match = pattern.exec(normalized);
    return match ? { index, position: match.index } : null;
  }).filter((marker): marker is { index: number; position: number } => marker !== null);

  if (markers.length < 2) {
    return Array.from({ length: questionCount }, () => normalized);
  }

  const answers = Array.from({ length: questionCount }, () => normalized);
  for (let index = 0; index < markers.length; index += 1) {
    const current = markers[index];
    const next = markers[index + 1];
    const segment = normalized
      .slice(current.position, next?.position)
      .replace(new RegExp(`^\\s*(?:question\\s*)?${current.index + 1}[\\).:\\-]\\s*`, 'i'), '')
      .trim();
    if (segment) {
      answers[current.index] = segment;
    }
  }
  return answers;
};

const mapObjectiveSelectionToText = (answerText: string, question: AssessmentQuestionRecord): string => {
  const rubric = question.rubricJson && typeof question.rubricJson === 'object'
    ? question.rubricJson
    : null;
  const options = Array.isArray(rubric?.options)
    ? rubric.options.map((option) => String(option || '').trim()).filter(Boolean)
    : [];
  const trimmed = collapseWhitespace(answerText);
  if (!trimmed) return '';
  const letterMatch = trimmed.match(/^[A-D]$/i);
  if (letterMatch) {
    const optionIndex = letterMatch[0].toUpperCase().charCodeAt(0) - 65;
    return options[optionIndex] || trimmed;
  }
  return trimmed;
};

export const markingService = {
  async markDocument(file: File, assessment: Assessment, studentId?: string): Promise<MarkingResult> {
    const questions = parseAssessmentQuestions(assessment);
    if (questions.length === 0) {
      throw new Error('The selected assessment has no question structure to mark against.');
    }

    const extractedDocuments = await extractSubmissionText(file);
    const combinedSubmissionText = extractedDocuments
      .map((document) => String(document.markdown || '').trim())
      .filter(Boolean)
      .join('\n\n');

    if (!combinedSubmissionText) {
      throw new Error('No readable answer text was extracted from the uploaded submission.');
    }

    const answerSegments = splitSubmissionIntoAnswers(combinedSubmissionText, questions.length);
    const payload = {
      request_context: {
        assessment_attempt_id: assessment.id,
        student_id: studentId || null,
      },
      questions: questions.map((question, index) => {
        const questionType = normalizeQuestionType(question);
        const rawAnswer = answerSegments[index] || combinedSubmissionText;
        const answerText = questionType === 'multiple_choice' || questionType === 'true_false'
          ? mapObjectiveSelectionToText(rawAnswer, question)
          : collapseWhitespace(rawAnswer);

        return {
          request_context: {
            assessment_attempt_id: assessment.id,
            question_id: question.id || `q-${index + 1}`,
            student_id: studentId || null,
          },
          question: {
            text: String(question.stem || question.text || `Question ${index + 1}`).trim(),
            subject: '',
            topic: '',
            question_type: questionType,
            max_marks: Number(question.maxMark || question.points || 1),
          },
          student_answer: {
            text: answerText,
          },
          marking_guide: buildRubricPayload(question),
        };
      }),
      options: {
        dry_run: false,
        force: false,
        allow_holistic_fallback: true,
      },
    };

    const response = await fetch(GRADE_ASSESSMENT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`AI marking failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const body = await response.json();
    const result = body?.result;
    if (!result || typeof result !== 'object') {
      throw new Error('AI marking returned an invalid response.');
    }

    const totalScore = Number(result.total_score || 0);
    const maxScore = Number(result.max_score || 0);
    const marks = maxScore > 0 ? Number(((totalScore / maxScore) * 100).toFixed(2)) : 0;
    const questionResults = Array.isArray(result.question_results) ? result.question_results : [];

    const criteria = questionResults
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item, index) => {
        const questionMax = Number(item.max_score || 0);
        const questionScore = Number(item.score_awarded || 0);
        return {
          criterion: `Question ${index + 1}`,
          score: questionMax > 0 ? Number(((questionScore / questionMax) * 100).toFixed(2)) : 0,
          comments: typeof item.feedback_text === 'string'
            ? item.feedback_text
            : 'Marked against the available marking guide.',
        };
      });

    const feedback = questionResults
      .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
      .map((item, index) => {
        const text = typeof item.feedback_text === 'string' ? item.feedback_text.trim() : '';
        return text ? `Q${index + 1}: ${text}` : '';
      })
      .filter(Boolean)
      .join('\n\n');

    return {
      marks,
      feedback: feedback || 'Marked successfully.',
      criteria,
    };
  },
};

export default markingService;
