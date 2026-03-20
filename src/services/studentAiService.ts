export interface StudentAiReferenceDocument {
  documentName: string;
  markdown: string;
}

export interface StudentAiMasteryTopic {
  topicId?: string;
  title: string;
  masteryPercent: number;
  questionCount?: number;
  priority?: number;
}

export interface StudentTutorChatMessage {
  role: 'student' | 'assistant';
  text: string;
}

export interface StudentTutorRequest {
  studentId?: string;
  subjectId?: string;
  subjectName?: string;
  unitTitle?: string;
  topicTitle?: string;
  planTitle?: string;
  planStepTitle?: string;
  coachMode?: 'socratic' | 'hint';
  latestMessage: string;
  taskGoal?: string;
  reasoningCanvas?: string;
  messages?: StudentTutorChatMessage[];
  referenceDocuments?: StudentAiReferenceDocument[];
  masteryTopics?: StudentAiMasteryTopic[];
}

export interface StudentTutorResponse {
  reply: string;
  suggestedNextAction?: string;
  followUpQuestion?: string;
}

export interface StudentChallengeQuestion {
  id: string;
  type: 'input' | 'single' | 'multiple';
  prompt: string;
  helpText?: string;
  options: string[];
  acceptedAnswers: string[];
  correctOptionIndexes: number[];
}

export interface StudentChallengeGenerationRequest {
  studentId?: string;
  subjectId?: string;
  subjectName: string;
  mode: 'topic_challenge' | 'subject_challenge';
  unitTitle?: string;
  topicTitle?: string;
  questionCount?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  objective?: string;
  referenceDocuments?: StudentAiReferenceDocument[];
  masteryTopics?: StudentAiMasteryTopic[];
}

export interface StudentChallengeGenerationResponse {
  challengeId: string;
  title: string;
  summary: string;
  coachMessage: string;
  focusTopics: string[];
  questions: StudentChallengeQuestion[];
}

const STUDENT_AI_BASE = 'http://localhost:8000/api/v1/agents/student';
const STUDENT_TUTOR_ENDPOINT = `${STUDENT_AI_BASE}/tutor`;
const STUDENT_CHALLENGE_ENDPOINT = `${STUDENT_AI_BASE}/challenge-generation`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeQuestion = (value: unknown, index: number): StudentChallengeQuestion | null => {
  if (!isRecord(value)) return null;
  const type = value.type === 'multiple' || value.type === 'input' ? value.type : 'single';
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';
  if (!prompt) return null;
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id : `challenge-question-${index + 1}`,
    type,
    prompt,
    helpText: typeof value.helpText === 'string' && value.helpText.trim() ? value.helpText.trim() : undefined,
    options: Array.isArray(value.options) ? value.options.filter((item): item is string => typeof item === 'string' && item.trim().length > 0) : [],
    acceptedAnswers: Array.isArray(value.acceptedAnswers)
      ? value.acceptedAnswers.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : [],
    correctOptionIndexes: Array.isArray(value.correctOptionIndexes)
      ? value.correctOptionIndexes
          .map((item) => (typeof item === 'number' ? item : Number(item)))
          .filter((item) => Number.isInteger(item) && item >= 0)
      : [],
  };
};

const buildError = async (response: Response, prefix: string): Promise<Error> => {
  const errorText = await response.text();
  return new Error(
    `${prefix}: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`
  );
};

export const studentAiService = {
  askTutor: async (payload: StudentTutorRequest): Promise<StudentTutorResponse> => {
    const response = await fetch(STUDENT_TUTOR_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await buildError(response, 'Student tutor request failed');
    }

    const result = await response.json();
    const reply = typeof result?.reply === 'string' ? result.reply.trim() : '';
    if (!reply) {
      throw new Error('Student tutor response did not include a reply.');
    }
    return {
      reply,
      suggestedNextAction:
        typeof result?.suggestedNextAction === 'string' && result.suggestedNextAction.trim()
          ? result.suggestedNextAction.trim()
          : undefined,
      followUpQuestion:
        typeof result?.followUpQuestion === 'string' && result.followUpQuestion.trim()
          ? result.followUpQuestion.trim()
          : undefined,
    };
  },

  generateChallenge: async (
    payload: StudentChallengeGenerationRequest
  ): Promise<StudentChallengeGenerationResponse> => {
    const response = await fetch(STUDENT_CHALLENGE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw await buildError(response, 'Challenge generation failed');
    }

    const result = await response.json();
    const questions = Array.isArray(result?.questions)
      ? result.questions
          .map((item: unknown, index: number) => normalizeQuestion(item, index))
          .filter((item): item is StudentChallengeQuestion => item !== null)
      : [];

    if (!questions.length) {
      throw new Error('Challenge generation did not return any usable questions.');
    }

    return {
      challengeId:
        typeof result?.challengeId === 'string' && result.challengeId.trim()
          ? result.challengeId.trim()
          : `challenge-${Date.now()}`,
      title: typeof result?.title === 'string' && result.title.trim() ? result.title.trim() : payload.subjectName,
      summary: typeof result?.summary === 'string' ? result.summary.trim() : '',
      coachMessage: typeof result?.coachMessage === 'string' ? result.coachMessage.trim() : '',
      focusTopics: Array.isArray(result?.focusTopics)
        ? result.focusTopics.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0)
        : [],
      questions,
    };
  },
};
