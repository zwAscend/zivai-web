import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { developmentService, studentService, subjectService } from '../../services/api';
import { DevelopmentPlan, Step, StepType, Student, Subject } from '../../types';
import { useToast } from '@/components/ui/use-toast';
import {
  Bold,
  Bot,
  Code2,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Plus,
  Redo2,
  Search,
  SendHorizontal,
  Settings2,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';

interface DevelopmentViewProps {
  studentId?: string;
}

type AiPlanApproach = 'balanced' | 'practice' | 'intervention';
type NewStepPreset = 'resource' | 'practice';

interface AiPlanStepDraft {
  title: string;
  type: StepType;
  content: string;
}

type PracticeResponseType = 'short-answer' | 'multiple-choice' | 'true-false';

interface PracticeBuilderQuestion {
  id: string;
  prompt: string;
  responseType: PracticeResponseType;
  marks: number;
  expectedAnswer: string;
  options: string[];
  correctOptions: string[];
}

interface PracticeBuilderDraft {
  name: string;
  questions: PracticeBuilderQuestion[];
}

const isValidUuid = (value: string) => /^[0-9a-fA-F-]{36}$/.test(value);

const getStudentPrimarySubjectId = (student: Student | null): string => {
  if (!student?.subjects?.length) return '';
  const first = student.subjects[0];
  return typeof first === 'string' ? first : first.id;
};

const formatStepType = (value?: string) => {
  if (!value) return 'Document';
  return value.charAt(0).toUpperCase() + value.slice(1);
};

const normalizeSkillKey = (value?: string) =>
  (value || '')
    .toLowerCase()
    .replace(/<[^>]+>/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const stripHtml = (value?: string) => (value || '').replace(/<[^>]+>/g, ' ');

const getApproachLabel = (approach: AiPlanApproach): string => {
  if (approach === 'practice') return 'Practice-first';
  if (approach === 'intervention') return 'Intervention';
  return 'Balanced';
};

const getStepTypeForApproach = (approach: AiPlanApproach, index: number): StepType => {
  if (approach === 'practice') {
    const sequence: StepType[] = ['assignment', 'quiz', 'assessment'];
    return sequence[index % sequence.length];
  }
  if (approach === 'intervention') {
    const sequence: StepType[] = ['document', 'document', 'assessment'];
    return sequence[index % sequence.length];
  }
  const sequence: StepType[] = ['document', 'assignment', 'quiz'];
  return sequence[index % sequence.length];
};

const getStepCategoryLabel = (type: StepType): 'Resource' | 'Practice/Assessment' =>
  type === 'document' ? 'Resource' : 'Practice/Assessment';

const isPracticeStepType = (type?: string) => type === 'quiz' || type === 'assignment' || type === 'assessment';

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const decodeHtmlEntities = (value: string) => {
  if (typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const normalizePracticeQuestionOptions = (rawOptions: string[]): string[] =>
  rawOptions.map((option) => option.trim()).filter(Boolean);

const normalizePracticeCorrectOptions = (rawOptions: string[]): string[] =>
  rawOptions.map((option) => option.trim()).filter(Boolean);

const isTrueFalseOptionSet = (options: string[]): boolean => {
  const normalized = options.map((option) => option.trim().toLowerCase()).filter(Boolean);
  return normalized.length === 2 && normalized.includes('true') && normalized.includes('false');
};

const parsePracticeQuestionFromLine = (rawLine: string, index: number): PracticeBuilderQuestion => {
  const baseQuestion: PracticeBuilderQuestion = {
    id: `practice-question-${Date.now()}-${index}`,
    prompt: '',
    responseType: 'short-answer',
    marks: 5,
    expectedAnswer: '',
    options: [],
    correctOptions: [],
  };
  const line = decodeHtmlEntities(String(rawLine || '').replace(/<[^>]+>/g, ' ').trim());
  if (!line) return baseQuestion;

  const marksMatch = line.match(/\((\d+)\s*marks?\)/i);
  const parsedMarks = marksMatch ? Number.parseInt(marksMatch[1], 10) : NaN;
  const marks = Number.isNaN(parsedMarks) ? 5 : Math.max(1, parsedMarks);
  const optionsMatch = line.match(/(?:^|\s)Options:\s*([\s\S]*?)(?=\s+Answer\(s\):|\s+Answer:|\s+Marking guide:|$)/i);
  const answersMatch = line.match(/(?:^|\s)Answer\(s\):\s*([\s\S]*?)(?=\s+Marking guide:|$)/i)
    || line.match(/(?:^|\s)Answer:\s*([\s\S]*?)(?=\s+Marking guide:|$)/i);
  const prompt = line
    .replace(/\s+Options:\s*[\s\S]*$/i, '')
    .replace(/\s+Answer\(s\):\s*[\s\S]*$/i, '')
    .replace(/\s+Answer:\s*[\s\S]*$/i, '')
    .replace(/\s+Marking guide:\s*[\s\S]*$/i, '')
    .replace(/\((\d+)\s*marks?\)/i, '')
    .trim();

  const options = normalizePracticeQuestionOptions(
    (optionsMatch?.[1] || '')
      .split(/[|,;]+/)
      .map((option) => option.trim())
  );
  const answers = normalizePracticeCorrectOptions(
    (answersMatch?.[1] || '')
      .split(/[|,;]+/)
      .map((answer) => answer.trim())
  );

  if (options.length === 0) {
    return {
      ...baseQuestion,
      prompt,
      marks,
      expectedAnswer: answers.join(', '),
    };
  }

  if (isTrueFalseOptionSet(options)) {
    const normalizedAnswers = answers
      .map((answer) => (answer.toLowerCase() === 'true' ? 'True' : answer.toLowerCase() === 'false' ? 'False' : ''))
      .filter(Boolean);
    return {
      ...baseQuestion,
      prompt,
      marks,
      responseType: 'true-false',
      options: ['True', 'False'],
      correctOptions: normalizedAnswers.slice(0, 1),
    };
  }

  const validAnswers = answers.filter((answer) => options.includes(answer));
  return {
    ...baseQuestion,
    prompt,
    marks,
    responseType: 'multiple-choice',
    options,
    correctOptions: validAnswers,
  };
};

const createPracticeQuestion = (index: number, prompt = ''): PracticeBuilderQuestion => ({
  id: `practice-question-${Date.now()}-${index}`,
  prompt,
  responseType: 'short-answer',
  marks: 5,
  expectedAnswer: '',
  options: ['', ''],
  correctOptions: [],
});

const createEmptyPracticeDraft = (name = ''): PracticeBuilderDraft => ({
  name,
  questions: [createPracticeQuestion(1), createPracticeQuestion(2)],
});

const parsePracticeDraftFromStep = (step: Step, fallbackName: string): PracticeBuilderDraft => {
  const rawContent = String(step.content || '');
  const questionMatches = Array.from(rawContent.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi))
    .map((match) => decodeHtmlEntities(match[1].trim()))
    .filter(Boolean);
  const questionLines = questionMatches.length > 0
    ? questionMatches
    : [createPracticeQuestion(1).prompt, createPracticeQuestion(2).prompt];
  const questions = questionLines.map((line, index) => parsePracticeQuestionFromLine(String(line || ''), index + 1));

  return {
    name: step.title || fallbackName,
    questions,
  };
};

const buildPracticeContentFromDraft = (draft: PracticeBuilderDraft): string => {
  const questionItems = draft.questions
    .map((question) => {
      const prompt = question.prompt.trim();
      if (!prompt) return '';
      const marks = Number.isFinite(Number(question.marks)) ? Math.max(1, Number(question.marks)) : 1;
      const promptWithMarks = `${escapeHtml(prompt)} (${marks} marks)`;
      if (question.responseType === 'short-answer') {
        const answer = question.expectedAnswer.trim();
        return `<li>${promptWithMarks}${answer ? ` Answer: ${escapeHtml(answer)}` : ''}</li>`;
      }

      const options = question.responseType === 'true-false'
        ? ['True', 'False']
        : normalizePracticeQuestionOptions(question.options);
      const answers = normalizePracticeCorrectOptions(question.correctOptions).filter((answer) =>
        options.some((option) => option.trim() === answer)
      );
      const optionsText = options.length > 0
        ? ` Options: ${options.map((option) => escapeHtml(option)).join(' | ')}`
        : '';
      const answersText = answers.length > 0
        ? ` Answer(s): ${answers.map((answer) => escapeHtml(answer)).join(' | ')}`
        : '';
      return `<li>${promptWithMarks}${optionsText}${answersText}</li>`;
    })
    .filter(Boolean);
  const questions = questionItems.length > 0 ? questionItems : ['<li>Write question 1 here.</li>'];
  const escapedName = escapeHtml(draft.name.trim());
  return [
    escapedName ? `<p><strong>Practice focus:</strong> ${escapedName}</p>` : '',
    '<p><strong>Questions:</strong></p>',
    `<ol>${questions.join('')}</ol>`,
  ].filter(Boolean).join('');
};

const createNewStepDraft = (order: number, preset: NewStepPreset, subjectName: string): Step => {
  if (preset === 'practice') {
    return {
      title: `${subjectName} Practice ${order}`,
      type: 'quiz',
      content: [
        `<p><strong>Practice focus:</strong> ${subjectName}</p>`,
        '<p><strong>Questions:</strong></p>',
        '<ol>',
        '<li>Write question 1 here.</li>',
        '<li>Write question 2 here.</li>',
        '</ol>',
      ].join(''),
      order,
      link: '',
      additionalResources: [],
    };
  }

  return {
    title: '',
    type: 'document',
    content: '',
    order,
    link: '',
    additionalResources: [],
  };
};

const getStepTitleForApproach = (
  approach: AiPlanApproach,
  topic: string,
  index: number,
  type: StepType
): string => {
  if (type === 'document') {
    return `Resource ${index + 1}: ${topic}`;
  }
  if (approach === 'practice') return `Practice ${index + 1}: ${topic}`;
  if (approach === 'intervention') return `Intervention ${index + 1}: ${topic}`;
  return `Mastery ${index + 1}: ${topic}`;
};

const buildAiPlanStepDrafts = (params: {
  focusTopics: Array<{ name: string; priorityLabel: string }>;
  objective: string;
  guidance: string;
  stepCount: number;
  approach: AiPlanApproach;
}): AiPlanStepDraft[] => {
  const { focusTopics, objective, guidance, stepCount, approach } = params;
  const fallbackObjective = 'Close skill gaps with clear practice and mastery checks.';
  const fallbackGuidance = 'Use scaffolded instruction, examples, and short mastery checks.';
  const selectedTopics = focusTopics.length ? focusTopics : [{ name: 'Core skill', priorityLabel: 'Priority 1' }];
  const steps = Array.from({ length: Math.max(stepCount, 1) }).map((_, index) => {
    const type = getStepTypeForApproach(approach, index);
    const category = getStepCategoryLabel(type);
    const selectedTopic = selectedTopics[index % selectedTopics.length];
    const focusTopic = selectedTopic.name;
    const priorityLabel = selectedTopic.priorityLabel;
    return {
      title: getStepTitleForApproach(approach, focusTopic, index, type),
      type,
      content: [
        `<p><strong>Focus Topic:</strong> ${focusTopic} (${priorityLabel})</p>`,
        `<p><strong>Step Category:</strong> ${category}</p>`,
        `<p><strong>Teacher Objective:</strong> ${objective || fallbackObjective}</p>`,
        `<p><strong>Guidance:</strong> ${guidance || fallbackGuidance}</p>`,
        '<p>Expected outcome: learner demonstrates improved understanding and accuracy on this topic.</p>',
      ].join(''),
    };
  });
  return steps;
};

const getOverallGrade = (overall?: number): string => {
  if (typeof overall !== 'number' || Number.isNaN(overall)) return 'N/A';
  if (overall >= 80) return 'A';
  if (overall >= 70) return 'B';
  if (overall >= 60) return 'C';
  if (overall >= 50) return 'D';
  return 'E';
};

const describeSkillGap = (current: number | null, target: number | null, gap: number): string => {
  if (current === null) {
    return 'No current mastery score captured yet, so this needs a baseline check.';
  }
  if (target === null) {
    return 'Target score is not defined yet; review this area for measurable goals.';
  }
  if (gap >= 30) {
    return 'Large gap detected. Start with foundational reinforcement and guided examples.';
  }
  if (gap >= 15) {
    return 'Moderate gap detected. Use focused practice with feedback loops.';
  }
  if (gap > 0) {
    return 'Small but important gap remains. Use short retrieval and application checks.';
  }
  if (current < 75) {
    return 'Below mastery threshold despite no target gap. Continue targeted reinforcement.';
  }
  return 'Near mastery. Focus on consistency and transfer tasks.';
};

const DevelopmentView: React.FC<DevelopmentViewProps> = ({ studentId: propStudentId }) => {
  const { studentId: paramStudentId } = useParams<{ studentId: string }>();
  const initialStudentId = (propStudentId && propStudentId !== 'undefined')
    ? propStudentId
    : ((paramStudentId && paramStudentId !== 'undefined') ? paramStudentId : '');

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [allStudentDevelopmentPlans, setAllStudentDevelopmentPlans] = useState<DevelopmentPlan[]>([]);
  const [currentDisplayPlan, setCurrentDisplayPlan] = useState<DevelopmentPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPlanSidebarCollapsed, setIsPlanSidebarCollapsed] = useState(false);
  const [isStudentsPanelCollapsed, setIsStudentsPanelCollapsed] = useState(false);

  const [subjectOptions, setSubjectOptions] = useState<Subject[]>([]);
  const [studentsSubjectFilter, setStudentsSubjectFilter] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [isStepWorkspaceOpen, setIsStepWorkspaceOpen] = useState(false);
  const [isStepWorkspaceMaximized, setIsStepWorkspaceMaximized] = useState(false);
  const [isStepAiCollapsed, setIsStepAiCollapsed] = useState(false);
  const [isPersistingPlan, setIsPersistingPlan] = useState(false);
  const [isCriticalSkillsCollapsed, setIsCriticalSkillsCollapsed] = useState(true);
  const [isAddressedSkillsCollapsed, setIsAddressedSkillsCollapsed] = useState(true);
  const [editingStepIndex, setEditingStepIndex] = useState<number | null>(null);
  const [stepWorkspaceDraft, setStepWorkspaceDraft] = useState<Step>({
    title: '',
    type: 'document',
    content: '',
    order: 1,
    link: '',
    additionalResources: [],
  });
  const [practiceWorkspaceDraft, setPracticeWorkspaceDraft] = useState<PracticeBuilderDraft>(
    createEmptyPracticeDraft('')
  );
  const [isPracticePreviewVisible, setIsPracticePreviewVisible] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'assistant' | 'teacher'; content: string }>>([
    { role: 'assistant', content: 'I can help draft or refine this step. Ask me for a clearer activity, quiz, or rubric.' },
  ]);
  const [isStepLinkModalOpen, setIsStepLinkModalOpen] = useState(false);
  const [stepLinkValue, setStepLinkValue] = useState('');
  const [isAiPlanBuilderModalOpen, setIsAiPlanBuilderModalOpen] = useState(false);
  const [isGeneratingAiPlanSteps, setIsGeneratingAiPlanSteps] = useState(false);
  const [aiPlanBuilderObjective, setAiPlanBuilderObjective] = useState('');
  const [aiPlanBuilderPrompt, setAiPlanBuilderPrompt] = useState('');
  const [aiPlanBuilderStepCount, setAiPlanBuilderStepCount] = useState(3);
  const [aiPlanBuilderApproach, setAiPlanBuilderApproach] = useState<AiPlanApproach>('balanced');
  const [aiPlanBuilderSelectedTopicKeys, setAiPlanBuilderSelectedTopicKeys] = useState<string[]>([]);
  const stepEditorRef = useRef<HTMLDivElement | null>(null);
  const aiPromptInputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const { toast } = useToast();

  const getActiveSubjectContext = () => {
    const planSubjectId = currentDisplayPlan?.plan?.subjectId;
    const subjectId = planSubjectId || studentsSubjectFilter || getStudentPrimarySubjectId(selectedStudent);
    const selectedSubjectOption = subjectOptions.find((subject) => subject.id === subjectId);
    const subjectFromStudent = selectedStudent?.subjects?.find((subject) =>
      typeof subject === 'string' ? subject === subjectId : subject.id === subjectId
    );
    const inferredPlanSubjectName = (currentDisplayPlan?.plan?.name || '')
      .replace(/\bdevelopment plan\b/i, '')
      .replace(/\bplan\b/i, '')
      .trim();
    const subjectName =
      selectedSubjectOption?.name ||
      (subjectFromStudent && typeof subjectFromStudent !== 'string' ? subjectFromStudent.name : '') ||
      inferredPlanSubjectName ||
      'Selected subject';

    return { subjectId, subjectName };
  };

  const middleColClass = isStepWorkspaceMaximized
    ? 'lg:col-span-12'
    : isStepWorkspaceOpen
      ? 'lg:col-span-12'
    : isPlanSidebarCollapsed
      ? (isStudentsPanelCollapsed ? 'lg:col-span-12' : 'lg:col-span-9')
      : (isStudentsPanelCollapsed ? 'lg:col-span-9' : 'lg:col-span-6');

  const selectPlanForSubject = (plans: DevelopmentPlan[], subjectId?: string) => {
    const scopedPlans = subjectId
      ? plans.filter((plan) => plan.plan?.subjectId === subjectId)
      : plans;
    return (
      scopedPlans.find((plan) => plan.status === 'Active') ||
      scopedPlans[0] ||
      plans.find((plan) => plan.status === 'Active') ||
      plans[0] ||
      null
    );
  };

  const filteredStudents = useMemo(() => {
    const query = studentSearch.trim().toLowerCase();
    if (!query) return allStudents;
    return allStudents.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return (
        fullName.includes(query) ||
        (student.email || '').toLowerCase().includes(query)
      );
    });
  }, [allStudents, studentSearch]);

  const sortedStepEntries = useMemo(() => {
    if (!currentDisplayPlan?.plan?.steps?.length) {
      return [] as Array<{ step: Step; index: number; order: number }>;
    }
    return currentDisplayPlan.plan.steps
      .map((step, index) => ({ step, index, order: step.order || index + 1 }))
      .sort((a, b) => a.order - b.order);
  }, [currentDisplayPlan]);

  const skillCanvasInsights = useMemo(() => {
    const planSkills = currentDisplayPlan?.plan?.skills || [];
    const skillProgress = currentDisplayPlan?.skillProgress || [];
    const attributeEntries = Object.entries(selectedStudent?.attributes || {});
    const stepCoverageTexts = sortedStepEntries.map(({ step }) => ({
      title: step.title || 'Untitled step',
      text: normalizeSkillKey([step.title, stripHtml(step.content), step.link].filter(Boolean).join(' ')),
    }));

    type SkillInsight = {
      key: string;
      name: string;
      current: number | null;
      target: number | null;
      gap: number;
      source: 'attribute' | 'plan';
      supportingTopics: string[];
    };

    const insights = new Map<string, SkillInsight>();
    const attributeLookup = new Map(
      attributeEntries.map(([name, values]) => [
        normalizeSkillKey(name),
        {
          name,
          current: typeof values?.current === 'number' ? values.current : null,
          target: typeof values?.potential === 'number' ? values.potential : null,
        },
      ])
    );

    const registerInsight = (
      name: string,
      current: number | null,
      target: number | null,
      source: 'attribute' | 'plan'
    ) => {
      const key = normalizeSkillKey(name);
      if (!key) return;

      const safeCurrent = typeof current === 'number' && !Number.isNaN(current) ? current : null;
      const safeTarget = typeof target === 'number' && !Number.isNaN(target) ? target : null;
      const gap = safeCurrent === null || safeTarget === null ? 0 : Math.max(safeTarget - safeCurrent, 0);
      const existing = insights.get(key);

      if (!existing) {
        insights.set(key, {
          key,
          name,
          current: safeCurrent,
          target: safeTarget,
          gap,
          source,
          supportingTopics: [],
        });
        return;
      }

      existing.current = safeCurrent ?? existing.current;
      existing.target = safeTarget ?? existing.target;
      existing.gap = Math.max(existing.gap, gap);
      if (source === 'attribute') {
        existing.source = 'attribute';
      }
    };

    const mergeSupportingTopics = (skillKey: string, topics: string[]) => {
      const insight = insights.get(skillKey);
      if (!insight || !topics.length) return;
      const existingKeys = new Set(insight.supportingTopics.map((topic) => normalizeSkillKey(topic)));
      topics.forEach((topic) => {
        const normalizedTopic = normalizeSkillKey(topic);
        if (!normalizedTopic || existingKeys.has(normalizedTopic)) return;
        existingKeys.add(normalizedTopic);
        insight.supportingTopics.push(topic);
      });
    };

    attributeEntries.forEach(([name, values]) => {
      registerInsight(
        name,
        typeof values?.current === 'number' ? values.current : null,
        typeof values?.potential === 'number' ? values.potential : null,
        'attribute'
      );
    });

    planSkills.forEach((skill) => {
      const progressMatch = skillProgress.find(
        (item) => normalizeSkillKey(item.skill) === normalizeSkillKey(skill.name)
      );
      const attributeMatch = attributeLookup.get(normalizeSkillKey(skill.name));

      registerInsight(
        skill.name,
        progressMatch?.currentScore ?? attributeMatch?.current ?? null,
        progressMatch?.targetScore ?? attributeMatch?.target ?? skill.score ?? null,
        'plan'
      );
      mergeSupportingTopics(
        normalizeSkillKey(skill.name),
        skill.subskills.map((subskill) => subskill.name).filter(Boolean)
      );

      skill.subskills.forEach((subskill) => {
        const subskillAttribute = attributeLookup.get(normalizeSkillKey(subskill.name));
        registerInsight(
          subskill.name,
          subskillAttribute?.current ?? null,
          subskillAttribute?.target ?? subskill.score ?? null,
          'attribute'
        );
      });
    });

    const rankedCriticalSkills = Array.from(insights.values())
      .map((item) => ({
        ...item,
        currentDisplay: item.current === null ? 'N/A' : `${Math.round(item.current)}%`,
        targetDisplay: item.target === null ? 'N/A' : `${Math.round(item.target)}%`,
        gapDisplay: `${Math.round(item.gap)}%`,
        gapSummary: describeSkillGap(item.current, item.target, item.gap),
        priorityScore:
          (item.current === null ? 25 : 100 - item.current) +
          item.gap * 1.5 +
          (item.source === 'attribute' ? 15 : 0),
      }))
      .filter((item) => item.current === null || item.current < 75 || item.gap > 0)
      .sort((a, b) => {
        if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
        const aCurrent = a.current ?? -1;
        const bCurrent = b.current ?? -1;
        return aCurrent - bCurrent;
      });

    const criticalSkills = rankedCriticalSkills.slice(0, 5);
    const criticalSkillKeys = new Set(criticalSkills.map((item) => item.key));
    const addressedSkills: Array<{
      key: string;
      name: string;
      currentDisplay: string;
      targetDisplay: string;
      gapDisplay: string;
      gapSummary: string;
      supportingTopics: string[];
      matchedSteps: string[];
      coverageNote: string;
    }> = [];

    criticalSkills.forEach((skill) => {
      const matchedSteps = stepCoverageTexts
        .filter((entry) => entry.text.includes(skill.key))
        .map((entry) => entry.title);

      if (matchedSteps.length > 0) {
        addressedSkills.push({
          key: skill.key,
          name: skill.name,
          currentDisplay: skill.currentDisplay,
          targetDisplay: skill.targetDisplay,
          gapDisplay: skill.gapDisplay,
          gapSummary: skill.gapSummary,
          supportingTopics: skill.supportingTopics || [],
          matchedSteps,
          coverageNote: `${matchedSteps.length} step${matchedSteps.length > 1 ? 's' : ''} currently target this gap`,
        });
      }
    });

    if (!addressedSkills.length && sortedStepEntries.length > 0) {
      planSkills
        .filter((skill) => criticalSkillKeys.has(normalizeSkillKey(skill.name)))
        .slice(0, 4)
        .forEach((skill) => {
          const insight = criticalSkills.find((item) => item.key === normalizeSkillKey(skill.name));
          addressedSkills.push({
            key: normalizeSkillKey(skill.name),
            name: skill.name,
            currentDisplay: insight?.currentDisplay || 'N/A',
            targetDisplay: insight?.targetDisplay || `${Math.round(skill.score)}%`,
            gapDisplay: insight?.gapDisplay || '0%',
            gapSummary: insight?.gapSummary || 'Tracked in the current development workflow.',
            supportingTopics: skill.subskills.map((subskill) => subskill.name).filter(Boolean),
            matchedSteps: sortedStepEntries.slice(0, 2).map(({ step }) => step.title || 'Untitled step'),
            coverageNote: 'Tracked in the current development workflow',
          });
        });
    }

    return {
      criticalSkills,
      addressedSkills: addressedSkills.slice(0, 4),
      mostCriticalSkill: criticalSkills[0] || null,
    };
  }, [currentDisplayPlan, selectedStudent?.attributes, sortedStepEntries]);

  useEffect(() => {
    setIsStepWorkspaceOpen(false);
    setEditingStepIndex(null);
    setIsStepWorkspaceMaximized(false);
    setIsStepAiCollapsed(false);
  }, [currentDisplayPlan?.id]);

  useEffect(() => {
    setIsCriticalSkillsCollapsed(true);
    setIsAddressedSkillsCollapsed(true);
  }, [currentDisplayPlan?.id]);

  useEffect(() => {
    if (!isStepWorkspaceOpen || !stepEditorRef.current) return;
    if (stepEditorRef.current.innerHTML !== (stepWorkspaceDraft.content || '')) {
      stepEditorRef.current.innerHTML = stepWorkspaceDraft.content || '';
    }
  }, [isStepWorkspaceOpen, stepWorkspaceDraft.content]);

  useEffect(() => {
    if (!aiPromptInputRef.current) return;
    aiPromptInputRef.current.style.height = 'auto';
    aiPromptInputRef.current.style.height = `${aiPromptInputRef.current.scrollHeight}px`;
  }, [aiPrompt]);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const subjects = await subjectService.getTeachingSubjects();
        setSubjectOptions(subjects || []);
      } catch (err) {
        console.error('Failed to load teaching subjects:', err);
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const loadStudents = async () => {
      try {
        const students = await studentService.getStudents(studentsSubjectFilter || undefined);
        setAllStudents(students || []);
      } catch (err) {
        console.error('Failed to fetch students:', err);
      }
    };
    loadStudents();
  }, [studentsSubjectFilter]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const studentData = await studentService.getStudent(initialStudentId);
        setSelectedStudent(studentData);

        const subjectId = studentsSubjectFilter || getStudentPrimarySubjectId(studentData);
        const plansData = await developmentService.getAllPlansForStudent(initialStudentId);
        setAllStudentDevelopmentPlans(plansData);
        setCurrentDisplayPlan(selectPlanForSubject(plansData, subjectId));

        if (!studentsSubjectFilter) {
          const primarySubjectId = getStudentPrimarySubjectId(studentData);
          if (primarySubjectId) {
            setStudentsSubjectFilter(primarySubjectId);
          }
        }
      } catch (err: any) {
        console.error('Error fetching student or development plans:', err);
        setError(err.message || 'Failed to load student development data.');
      } finally {
        setLoading(false);
      }
    };

    if (initialStudentId) {
      if (!isValidUuid(initialStudentId)) {
        setError('Invalid student id in route.');
        setLoading(false);
        return;
      }
      fetchData();
    }
  }, [initialStudentId]);

  const handleStudentSelect = async (newStudentId: string) => {
    setLoading(true);
    setError(null);
    try {
      const studentData = await studentService.getStudent(newStudentId);
      setSelectedStudent(studentData);

      const subjectId = studentsSubjectFilter || getStudentPrimarySubjectId(studentData);
      const plansData = await developmentService.getAllPlansForStudent(newStudentId);
      setAllStudentDevelopmentPlans(plansData);
      setCurrentDisplayPlan(selectPlanForSubject(plansData, subjectId));
    } catch (err: any) {
      console.error('Error fetching student or development plans on select:', err);
      setError(err.message || 'Failed to load data for selected student.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlanCreated = async (studentId: string, newPlan: DevelopmentPlan) => {
    try {
      const updatedPlans = await developmentService.getAllPlansForStudent(studentId);
      setAllStudentDevelopmentPlans(updatedPlans);

      const newPlanItem = updatedPlans.find((plan) =>
        plan.id === newPlan.id || plan.plan.id === newPlan.plan.id
      );
      const { subjectId } = getActiveSubjectContext();
      setCurrentDisplayPlan(newPlanItem || selectPlanForSubject(updatedPlans, subjectId));
      toast.success('Development plan created successfully');
    } catch (err) {
      console.error('Error handling new plan:', err);
      toast.error('Failed to load the new plan');
    }
  };

  const openAiPlanBuilder = () => {
    if (!selectedStudent) {
      toast.error('Select a student first.');
      return;
    }
    if (!currentDisplayPlan) {
      toast.error('Open a development plan before using AI Plan Builder.');
      return;
    }
    const defaultTopicKeys = skillCanvasInsights.criticalSkills.slice(0, 3).map((skill) => skill.key);
    const defaultObjective = skillCanvasInsights.mostCriticalSkill
      ? `Improve ${skillCanvasInsights.mostCriticalSkill.name} and related critical gaps.`
      : '';

    setAiPlanBuilderSelectedTopicKeys(defaultTopicKeys);
    setAiPlanBuilderObjective(defaultObjective);
    setAiPlanBuilderPrompt('');
    setAiPlanBuilderStepCount(3);
    setAiPlanBuilderApproach('balanced');
    setIsAiPlanBuilderModalOpen(true);
  };

  const handleGenerateAiPlanSteps = async () => {
    if (!currentDisplayPlan) return;

    const selectedTopics = skillCanvasInsights.criticalSkills.filter((skill) =>
      aiPlanBuilderSelectedTopicKeys.includes(skill.key)
    );
    if (!selectedTopics.length) {
      toast.error('Select at least one critical topic to guide the AI agent.');
      return;
    }
    const focusTopics = selectedTopics.map((topic) => {
      const rank = skillCanvasInsights.criticalSkills.findIndex((skill) => skill.key === topic.key) + 1;
      return {
        name: topic.name,
        priorityLabel: rank === 1 ? 'Priority 1 (Most critical)' : `Priority ${rank}`,
      };
    });

    const normalizedStepCount = Math.max(1, Math.min(10, aiPlanBuilderStepCount || 1));
    const generatedStepDrafts = buildAiPlanStepDrafts({
      focusTopics,
      objective: aiPlanBuilderObjective.trim(),
      guidance: aiPlanBuilderPrompt.trim(),
      stepCount: normalizedStepCount,
      approach: aiPlanBuilderApproach,
    });

    try {
      setIsGeneratingAiPlanSteps(true);
      setIsPersistingPlan(true);

      let updatedPlan = currentDisplayPlan;
      let nextOrder = (updatedPlan.plan.steps?.length || 0) + 1;

      for (const draft of generatedStepDrafts) {
        updatedPlan = await developmentService.addStudentPlanStep(updatedPlan.id, {
          title: draft.title,
          type: draft.type,
          content: draft.content,
          order: nextOrder,
          link: '',
          additionalResources: [],
        });
        nextOrder += 1;
      }

      syncUpdatedPlanInState(updatedPlan);
      setIsAiPlanBuilderModalOpen(false);
      toast.success(
        `Generated ${generatedStepDrafts.length} AI plan step${generatedStepDrafts.length > 1 ? 's' : ''} (${getApproachLabel(aiPlanBuilderApproach)}).`
      );
    } catch (err) {
      console.error('Failed to generate AI plan steps:', err);
      toast.error('Failed to generate AI plan steps');
    } finally {
      setIsGeneratingAiPlanSteps(false);
      setIsPersistingPlan(false);
    }
  };

  const closeAiPlanBuilderModal = () => {
    if (isGeneratingAiPlanSteps) {
      return;
    }
    setIsAiPlanBuilderModalOpen(false);
  };

  useEffect(() => {
    if (!allStudentDevelopmentPlans.length) {
      setCurrentDisplayPlan(null);
      return;
    }
    const { subjectId } = getActiveSubjectContext();
    setCurrentDisplayPlan((previous) => {
      if (previous) {
        const matchingPlan = allStudentDevelopmentPlans.find((plan) => plan.id === previous.id);
        if (matchingPlan && (!subjectId || matchingPlan.plan?.subjectId === subjectId)) {
          return matchingPlan;
        }
      }
      return selectPlanForSubject(allStudentDevelopmentPlans, subjectId);
    });
  }, [allStudentDevelopmentPlans, selectedStudent, studentsSubjectFilter]);

  const syncUpdatedPlanInState = (updatedPlan: DevelopmentPlan) => {
    setAllStudentDevelopmentPlans((previous) =>
      previous.map((plan) => (plan.id === updatedPlan.id ? updatedPlan : plan))
    );
    setCurrentDisplayPlan((previous) => (previous?.id === updatedPlan.id ? updatedPlan : previous));
  };

  const openStepWorkspace = (index?: number, preset: NewStepPreset = 'resource') => {
    if (!currentDisplayPlan) return;
    if (typeof index === 'number') {
      const step = currentDisplayPlan.plan.steps[index];
      setEditingStepIndex(index);
      setStepWorkspaceDraft({
        ...step,
        type: (step.type || 'document') as Step['type'],
        content: step.content || `<p><strong>${step.title}</strong></p>${step.link ? `<p>${step.link}</p>` : ''}`,
        order: step.order || index + 1,
        link: step.link || '',
        additionalResources: step.additionalResources || [],
      });
      if (isPracticeStepType(step.type)) {
        setPracticeWorkspaceDraft(parsePracticeDraftFromStep(step, step.title || 'Practice step'));
      } else {
        setPracticeWorkspaceDraft(createEmptyPracticeDraft(''));
      }
    } else {
      setEditingStepIndex(null);
      const nextOrder = (currentDisplayPlan.plan.steps?.length || 0) + 1;
      const { subjectName } = getActiveSubjectContext();
      const nextStepDraft = createNewStepDraft(nextOrder, preset, subjectName);
      setStepWorkspaceDraft(nextStepDraft);
      if (preset === 'practice') {
        setPracticeWorkspaceDraft(parsePracticeDraftFromStep(nextStepDraft, `${subjectName} Practice ${nextOrder}`));
      } else {
        setPracticeWorkspaceDraft(createEmptyPracticeDraft(''));
      }
    }
    setIsPracticePreviewVisible(false);
    setIsStepWorkspaceOpen(true);
  };

  const handleWorkspaceStepSelect = (selectedValue: string) => {
    if (selectedValue === '__new') {
      if (editingStepIndex === null) return;
      openStepWorkspace();
      return;
    }
    const selectedIndex = Number(selectedValue);
    if (!Number.isNaN(selectedIndex)) {
      openStepWorkspace(selectedIndex);
    }
  };

  const toggleNewStepWorkspacePreset = (preset: NewStepPreset) => {
    if (editingStepIndex !== null) return;
    openStepWorkspace(undefined, preset);
  };

  const closeStepWorkspace = () => {
    setIsStepWorkspaceOpen(false);
    setEditingStepIndex(null);
    setIsStepWorkspaceMaximized(false);
    setIsPracticePreviewVisible(false);
  };

  const saveStepWorkspace = async () => {
    if (!currentDisplayPlan) return;
    const isPracticeDraft = isPracticeStepType(stepWorkspaceDraft.type);
    const normalizedTitle = isPracticeDraft
      ? practiceWorkspaceDraft.name.trim()
      : stepWorkspaceDraft.title.trim();

    if (!normalizedTitle) {
      toast.error('Step title is required');
      return;
    }

    const normalizedStep: Step = {
      ...stepWorkspaceDraft,
      title: normalizedTitle,
      content: isPracticeDraft
        ? buildPracticeContentFromDraft({
            ...practiceWorkspaceDraft,
            name: normalizedTitle,
          })
        : (stepWorkspaceDraft.content || ''),
      link: isPracticeDraft ? '' : (stepWorkspaceDraft.link || ''),
    };

    try {
      setIsPersistingPlan(true);
      const updatedPlan =
        editingStepIndex === null
          ? await developmentService.addStudentPlanStep(currentDisplayPlan.id, {
              title: normalizedStep.title,
              type: normalizedStep.type,
              content: normalizedStep.content || '',
              link: normalizedStep.link || '',
              order: normalizedStep.order,
              additionalResources: normalizedStep.additionalResources || [],
            })
          : await developmentService.updateStudentPlanStep(
              currentDisplayPlan.id,
              currentDisplayPlan.plan.steps[editingStepIndex].id as string,
              {
                title: normalizedStep.title,
                type: normalizedStep.type,
                content: normalizedStep.content || '',
                link: normalizedStep.link || '',
                order: normalizedStep.order,
                additionalResources: normalizedStep.additionalResources || [],
              }
            );
      syncUpdatedPlanInState(updatedPlan);
      setIsStepWorkspaceOpen(false);
      setEditingStepIndex(null);
      toast.success(editingStepIndex === null ? 'Step added' : 'Step updated');
    } catch (err) {
      console.error('Failed to save step:', err);
      toast.error('Failed to save step');
    } finally {
      setIsPersistingPlan(false);
    }
  };

  const applyStepEditorCommand = (command: string, value?: string) => {
    if (!stepEditorRef.current) return;
    stepEditorRef.current.focus();
    document.execCommand(command, false, value);
    setStepWorkspaceDraft((prev) => ({ ...prev, content: stepEditorRef.current?.innerHTML || '' }));
  };

  const handleStepBlockStyle = (value: string) => {
    if (value === 'bulleted-list') {
      applyStepEditorCommand('insertUnorderedList');
      return;
    }
    if (value === 'numbered-list') {
      applyStepEditorCommand('insertOrderedList');
      return;
    }
    if (value === 'blockquote') {
      applyStepEditorCommand('formatBlock', 'BLOCKQUOTE');
      return;
    }
    if (value === 'code') {
      applyStepEditorCommand('formatBlock', 'PRE');
      return;
    }
    applyStepEditorCommand('formatBlock', value);
  };

  const handleInsertStepLink = () => {
    setStepLinkValue('');
    setIsStepLinkModalOpen(true);
  };

  const handleConfirmStepLink = () => {
    const url = stepLinkValue.trim();
    if (!url) {
      toast({
        title: 'URL required',
        description: 'Please enter a valid URL.',
      });
      return;
    }
    applyStepEditorCommand('createLink', url);
    setIsStepLinkModalOpen(false);
    setStepLinkValue('');
  };

  const handleStepImageSelected = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      applyStepEditorCommand('insertImage', result);
    };
    reader.readAsDataURL(file);
  };

  const handleSendAiPrompt = () => {
    const text = aiPrompt.trim();
    if (!text) return;
    setAiMessages((prev) => [
      ...prev,
      { role: 'teacher', content: text },
      { role: 'assistant', content: 'Suggestion added. Review and save this step if it matches your objective.' },
    ]);
    setStepWorkspaceDraft((prev) => ({
      ...prev,
      content: `${prev.content || ''}<p><strong>AI Suggestion:</strong> ${text}</p>`,
    }));
    setAiPrompt('');
  };

  const deleteStep = async (index: number) => {
    if (!currentDisplayPlan) return;
    const stepId = currentDisplayPlan.plan.steps[index]?.id;
    if (!stepId) {
      toast.error('This step cannot be removed because it has no persisted id yet');
      return;
    }

    try {
      setIsPersistingPlan(true);
      const updatedPlan = await developmentService.deleteStudentPlanStep(currentDisplayPlan.id, stepId);
      syncUpdatedPlanInState(updatedPlan);
      if (editingStepIndex === index) {
        closeStepWorkspace();
      }
      toast.success('Step removed');
    } catch (err) {
      console.error('Failed to delete step:', err);
      toast.error('Failed to delete step');
    } finally {
      setIsPersistingPlan(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-x-0 h-full overflow-hidden p-0">
        <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-2 flex flex-col overflow-hidden">
          <div className="bg-white rounded-lg p-2 mb-2 animate-pulse">
            <div className="mx-auto mb-2 h-10 w-10 rounded-full bg-slate-200" />
            <div className="ml-auto h-3 w-10 rounded bg-slate-200" />
            <div className="mt-1 ml-auto h-6 w-14 rounded bg-slate-200" />
            <div className="mx-auto mt-2 h-4 w-2/3 rounded bg-slate-200" />
            <div className="mx-auto mt-1 h-3 w-4/5 rounded bg-slate-200" />
          </div>
          <div className="bg-white rounded-lg p-2 flex min-h-0 flex-1 flex-col">
            <div className="mx-auto mb-2 h-4 w-24 rounded bg-slate-200 animate-pulse" />
            <div className="min-h-0 flex-1 space-y-2 overflow-hidden">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`growth-skeleton-${index}`} className="h-12 rounded-lg bg-slate-200 animate-pulse" />
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-6 col-span-12 bg-transparent rounded-t-lg rounded-b-none shadow px-3 pt-3 pb-0 overflow-hidden">
          <div className="h-full min-h-0 flex flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                <div className="h-5 w-64 rounded bg-slate-200" />
                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="h-16 rounded-lg bg-slate-100" />
                  <div className="h-16 rounded-lg bg-slate-100" />
                  <div className="h-16 rounded-lg bg-slate-100" />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <div className="h-4 w-32 rounded bg-slate-200" />
                  <div className="h-3 w-36 rounded bg-slate-200" />
                </div>
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="h-6 w-full rounded bg-slate-200" />
                    <div className="mt-2 space-y-1.5">
                      <div className="h-7 rounded-md bg-white" />
                      <div className="h-7 rounded-md bg-white" />
                      <div className="h-7 rounded-md bg-white" />
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                    <div className="h-6 w-full rounded bg-slate-200" />
                    <div className="mt-2 space-y-1.5">
                      <div className="h-10 rounded-md bg-white" />
                      <div className="h-10 rounded-md bg-white" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 animate-pulse">
                <div className="mb-3 flex items-center justify-between">
                  <div className="h-4 w-28 rounded bg-slate-200" />
                  <div className="h-7 w-20 rounded bg-slate-200" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <div key={`workflow-skeleton-${index}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="h-6 w-6 rounded-full bg-slate-200" />
                          <div className="space-y-1">
                            <div className="h-3 w-36 rounded bg-slate-200" />
                            <div className="h-2.5 w-20 rounded bg-slate-200" />
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="h-6 w-6 rounded-md bg-slate-200" />
                          <div className="h-6 w-6 rounded-md bg-slate-200" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="shrink-0 -mx-3 border-t border-slate-200 bg-white px-3 pt-2 pb-0">
              <div className="h-9 w-full rounded-lg bg-slate-200 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-2 overflow-hidden">
          <div className="mb-2 flex items-center justify-between animate-pulse">
            <div className="h-4 w-20 rounded bg-slate-200" />
            <div className="h-4 w-8 rounded bg-slate-200" />
          </div>
          <div className="space-y-2 mb-2">
            <div className="h-9 rounded-md bg-slate-200 animate-pulse" />
            <div className="h-9 rounded-md bg-slate-200 animate-pulse" />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={`student-skeleton-${index}`} className="h-16 rounded bg-slate-200 animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return <div className="flex justify-center items-center h-full text-red-600 text-sm">Error: {error}</div>;
  }

  if (!selectedStudent) {
    return <div className="flex justify-center items-center h-full text-sm">No student found.</div>;
  }

  const fullName = `${selectedStudent.firstName} ${selectedStudent.lastName}`;
  const isPracticeWorkspace = isPracticeStepType(stepWorkspaceDraft.type);
  const canSavePracticeWorkspace =
    practiceWorkspaceDraft.name.trim().length > 0 &&
    practiceWorkspaceDraft.questions.some((question) => question.prompt.trim().length > 0) &&
    practiceWorkspaceDraft.questions
      .filter((question) => question.prompt.trim().length > 0)
      .every((question) => {
        if (question.responseType === 'short-answer') return true;
        const options = question.responseType === 'true-false'
          ? ['True', 'False']
          : normalizePracticeQuestionOptions(question.options);
        const correctOptions = normalizePracticeCorrectOptions(question.correctOptions).filter((answer) =>
          options.some((option) => option.trim() === answer)
        );
        return options.length >= 2 && correctOptions.length > 0;
      });

  return (
    <>
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-x-0 h-full overflow-hidden p-0">
      {!isPlanSidebarCollapsed && !isStepWorkspaceMaximized && !isStepWorkspaceOpen && (
      <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-2 flex flex-col overflow-hidden">
        <div className="mb-2 flex items-center justify-start">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-100"
            onClick={() => setIsPlanSidebarCollapsed(true)}
            aria-label="Collapse growth area panel"
            title="Collapse growth area panel"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="bg-white rounded-lg p-2 mb-2">
          <div className="w-14 h-14 bg-gradient-to-br from-cyan-500 to-blue-700 text-white text-sm font-bold rounded-full flex items-center justify-center mx-auto mb-1">
            {selectedStudent.firstName[0]}{selectedStudent.lastName[0]}
          </div>
          <div className="text-center mb-1">
            <div className="text-gray-600 text-xs">OVR</div>
            <div className="text-lg font-bold">{selectedStudent.overall}</div>
            <div className="text-[11px] font-medium text-slate-600">Grade: {getOverallGrade(selectedStudent.overall)}</div>
          </div>
          <div className="text-center">
            <h2 className="text-sm font-bold mb-0.5">{fullName}</h2>
            <p className="text-gray-600 text-xs">Plan | {currentDisplayPlan?.plan.name || 'Not assigned'}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg p-2 flex min-h-0 flex-1 flex-col">
          <h3 className="font-bold text-center mb-1.5 text-sm">Growth Area</h3>
          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {allStudentDevelopmentPlans.map((planItem) => (
              <button
                key={planItem.id}
                onClick={() => setCurrentDisplayPlan(planItem)}
                className={`w-full p-2 rounded-lg text-sm font-medium transition-all duration-300 flex justify-between items-center ${
                  planItem.id === currentDisplayPlan?.id
                    ? 'bg-cyan-500 text-white'
                    : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                }`}
              >
                <span className="truncate pr-2 text-left">{planItem.plan.name}</span>
                <span className="text-xs bg-green-200 text-green-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {planItem.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      <div
        className={`${
          isStepWorkspaceOpen
            ? (isStepWorkspaceMaximized
                ? 'fixed inset-4 z-40 col-span-12 overflow-hidden p-0'
                : `${middleColClass} relative col-span-12 overflow-hidden p-0`)
            : (isStepWorkspaceMaximized
                ? 'fixed inset-4 z-40 col-span-12 bg-transparent rounded-t-lg rounded-b-none shadow-2xl px-3 pt-3 pb-0 overflow-hidden'
                : `${middleColClass} relative col-span-12 bg-transparent rounded-t-lg rounded-b-none shadow px-3 pt-3 pb-0 overflow-hidden`)
        }`}
      >
        {!isStepWorkspaceOpen &&
        !isStepWorkspaceMaximized &&
        (isPlanSidebarCollapsed || isStudentsPanelCollapsed) ? (
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-h-[32px]">
              {isPlanSidebarCollapsed ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                  onClick={() => setIsPlanSidebarCollapsed(false)}
                  aria-label="Expand growth area panel"
                  title="Expand growth area panel"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                  Growth Area
                </button>
              ) : null}
            </div>
            <div className="min-h-[32px]">
              {isStudentsPanelCollapsed ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-100"
                  onClick={() => setIsStudentsPanelCollapsed(false)}
                  aria-label="Expand students panel"
                  title="Expand students panel"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Students
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        {!currentDisplayPlan ? (
          <div className="flex h-full min-h-[280px] items-center justify-center">
            <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-5 text-center">
              <h2 className="text-base font-semibold text-slate-900">Loading development plan</h2>
              <p className="mt-2 text-sm text-slate-600">
                The workspace will open as soon as the starter plan is available for {fullName}.
              </p>
            </div>
          </div>
        ) : isStepWorkspaceOpen ? (
          <div className="grid h-full min-h-0 grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_56px]">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleStepImageSelected(file);
                  e.currentTarget.value = '';
                }
              }}
            />

            <div className="col-span-full flex min-h-0 overflow-hidden">
              <div className="mx-auto flex h-full min-h-0 w-full max-w-7xl flex-col overflow-hidden">
                <div className="min-h-0 flex-1">
                  <div className="flex h-full min-h-0 max-h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
                    {!isPracticeWorkspace ? (
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={closeStepWorkspace}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Back to plan
                          </button>
                          <button
                            type="button"
                            onClick={saveStepWorkspace}
                            disabled={isPersistingPlan}
                            className="inline-flex items-center gap-1 rounded-md border border-blue-700 bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300 disabled:text-slate-100"
                          >
                            Save step
                          </button>
                          {editingStepIndex === null ? (
                            <button
                              type="button"
                              onClick={() => toggleNewStepWorkspacePreset('practice')}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                            >
                              <Plus className="h-3.5 w-3.5" />
                              Switch to practice step
                            </button>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={editingStepIndex === null ? '__new' : String(editingStepIndex)}
                            onChange={(e) => handleWorkspaceStepSelect(e.target.value)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                          >
                            {sortedStepEntries.map(({ step, index, order }) => (
                              <option key={`${step.title}-${index}`} value={String(index)}>
                                {`Step ${order} (${isPracticeStepType(step.type) ? 'Practice' : 'Resource'}): ${step.title || 'Untitled step'}`}
                              </option>
                            ))}
                            <option value="__new">New step</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => setIsStepWorkspaceMaximized((prev) => !prev)}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                            aria-label={isStepWorkspaceMaximized ? 'Restore editor size' : 'Expand editor size'}
                            title={isStepWorkspaceMaximized ? 'Restore' : 'Expand'}
                          >
                            {isStepWorkspaceMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
                      {isPracticeWorkspace ? (
                        <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-hidden p-3">
                          <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={closeStepWorkspace}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  <ChevronLeft className="h-3.5 w-3.5" />
                                  Back to plan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setIsPracticePreviewVisible((previous) => !previous)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  Preview Practice
                                </button>
                                <button
                                  type="button"
                                  onClick={closeStepWorkspace}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={saveStepWorkspace}
                                  disabled={isPersistingPlan || !canSavePracticeWorkspace}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {editingStepIndex === null ? 'Save Practice' : 'Update Practice'}
                                </button>
                                {editingStepIndex === null ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleNewStepWorkspacePreset('resource')}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                    Switch to resource step
                                  </button>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-2">
                                <select
                                  value={editingStepIndex === null ? '__new' : String(editingStepIndex)}
                                  onChange={(e) => handleWorkspaceStepSelect(e.target.value)}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600"
                                >
                                  {sortedStepEntries.map(({ step, index, order }) => (
                                    <option key={`${step.title}-${index}`} value={String(index)}>
                                      {`Step ${order} (${isPracticeStepType(step.type) ? 'Practice' : 'Resource'}): ${step.title || 'Untitled step'}`}
                                    </option>
                                  ))}
                                  <option value="__new">New step</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => setIsStepWorkspaceMaximized((prev) => !prev)}
                                  className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                  aria-label="Expand practice workspace"
                                  title={isStepWorkspaceMaximized ? 'Restore' : 'Expand'}
                                >
                                  {isStepWorkspaceMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            </div>
                            <div className="relative z-0 min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto p-6">
                              <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Practice Canvas</h2>
                                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                                      {canSavePracticeWorkspace ? 'Configured' : 'Draft'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      <Settings2 className="h-3.5 w-3.5" />
                                      Configure
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPracticeWorkspaceDraft((previous) => ({
                                          ...previous,
                                          questions: [...previous.questions, createPracticeQuestion(previous.questions.length + 1)],
                                        }));
                                      }}
                                      className="text-sm text-blue-600 hover:text-blue-700"
                                    >
                                      + Add practice question
                                    </button>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-4">
                                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    Practice name
                                    <input
                                      value={practiceWorkspaceDraft.name}
                                      onChange={(event) => {
                                        const value = event.target.value;
                                        setPracticeWorkspaceDraft((previous) => ({
                                          ...previous,
                                          name: value,
                                        }));
                                        setStepWorkspaceDraft((previous) => ({ ...previous, title: value }));
                                      }}
                                      placeholder="Enter practice name"
                                      className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
                                    />
                                  </label>
                                </div>

                                {isPracticePreviewVisible ? (
                                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Preview</p>
                                    <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                                      {practiceWorkspaceDraft.questions
                                        .map((question) => question.prompt.trim())
                                        .filter(Boolean)
                                        .map((question, index) => (
                                          <li key={`preview-question-${index}`}>{question}</li>
                                        ))}
                                    </ol>
                                  </div>
                                ) : null}

                                <div className="relative min-h-[220px]">
                                  <div className="space-y-3">
                                    {practiceWorkspaceDraft.questions.map((question, index) => (
                                      <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                          <p className="text-sm font-semibold text-slate-800">Question {index + 1}</p>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setPracticeWorkspaceDraft((previous) => {
                                                if (previous.questions.length <= 1) return previous;
                                                return {
                                                  ...previous,
                                                  questions: previous.questions.filter((existing) => existing.id !== question.id),
                                                };
                                              });
                                            }}
                                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Remove
                                          </button>
                                        </div>
                                        <div className="space-y-3">
                                          <label className="block text-xs text-gray-500">
                                            <textarea
                                              value={question.prompt}
                                              onChange={(event) => {
                                                const value = event.target.value;
                                                setPracticeWorkspaceDraft((previous) => ({
                                                  ...previous,
                                                  questions: previous.questions.map((existing) =>
                                                    existing.id === question.id ? { ...existing, prompt: value } : existing
                                                  ),
                                                }));
                                              }}
                                              className="mt-1 min-h-[88px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                              placeholder="Write the question here..."
                                            />
                                          </label>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <label className="block text-xs text-gray-500">
                                              Response Type
                                              <select
                                                value={question.responseType}
                                                onChange={(event) => {
                                                  const value = event.target.value as PracticeResponseType;
                                                  setPracticeWorkspaceDraft((previous) => ({
                                                    ...previous,
                                                    questions: previous.questions.map((existing) =>
                                                      existing.id === question.id
                                                        ? {
                                                            ...existing,
                                                            responseType: value,
                                                            expectedAnswer: value === 'short-answer' ? existing.expectedAnswer : '',
                                                            options:
                                                              value === 'multiple-choice'
                                                                ? (existing.options.length >= 2 ? existing.options : ['', ''])
                                                                : value === 'true-false'
                                                                  ? ['True', 'False']
                                                                  : [],
                                                            correctOptions:
                                                              value === 'short-answer'
                                                                ? []
                                                                : value === 'true-false'
                                                                  ? normalizePracticeCorrectOptions(existing.correctOptions)
                                                                      .map((answer) =>
                                                                        answer.toLowerCase() === 'true'
                                                                          ? 'True'
                                                                          : answer.toLowerCase() === 'false'
                                                                            ? 'False'
                                                                            : ''
                                                                      )
                                                                      .filter(Boolean)
                                                                      .slice(0, 1)
                                                                  : normalizePracticeCorrectOptions(existing.correctOptions),
                                                          }
                                                        : existing
                                                    ),
                                                  }));
                                                }}
                                                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                              >
                                                <option value="short-answer">Short answer</option>
                                                <option value="multiple-choice">Multiple choice</option>
                                                <option value="true-false">True/False</option>
                                              </select>
                                            </label>
                                            <label className="block text-xs text-gray-500">
                                              Marks
                                              <input
                                                type="number"
                                                min="1"
                                                value={question.marks}
                                                onChange={(event) => {
                                                  const parsed = Number.parseInt(event.target.value, 10);
                                                  const marks = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
                                                  setPracticeWorkspaceDraft((previous) => ({
                                                    ...previous,
                                                    questions: previous.questions.map((existing) =>
                                                      existing.id === question.id ? { ...existing, marks } : existing
                                                    ),
                                                  }));
                                                }}
                                                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                              />
                                            </label>
                                          </div>
                                          {question.responseType === 'short-answer' ? (
                                            <label className="block text-xs text-gray-500">
                                              Correct / expected answer
                                              <textarea
                                                rows={2}
                                                value={question.expectedAnswer}
                                                onChange={(event) => {
                                                  const value = event.target.value;
                                                  setPracticeWorkspaceDraft((previous) => ({
                                                    ...previous,
                                                    questions: previous.questions.map((existing) =>
                                                      existing.id === question.id ? { ...existing, expectedAnswer: value } : existing
                                                    ),
                                                  }));
                                                }}
                                                className="mt-1 min-h-[72px] w-full resize-none overflow-hidden rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                placeholder="Provide the expected answer"
                                              />
                                            </label>
                                          ) : (
                                            <div className="space-y-3">
                                              <div className="flex items-center justify-between">
                                                <label className="text-xs text-gray-500">Options</label>
                                                {question.responseType === 'multiple-choice' ? (
                                                  <button
                                                    type="button"
                                                    onClick={() => {
                                                      setPracticeWorkspaceDraft((previous) => ({
                                                        ...previous,
                                                        questions: previous.questions.map((existing) =>
                                                          existing.id === question.id
                                                            ? { ...existing, options: [...existing.options, ''] }
                                                            : existing
                                                        ),
                                                      }));
                                                    }}
                                                    className="text-xs text-blue-600 hover:text-blue-700"
                                                  >
                                                    + Add option
                                                  </button>
                                                ) : null}
                                              </div>

                                              <div className="space-y-2">
                                                {(question.responseType === 'true-false' ? ['True', 'False'] : (
                                                  question.options.length >= 2 ? question.options : ['', '']
                                                )).map((option, optionIndex) => {
                                                  const normalizedOption = option.trim();
                                                  const isCorrect = normalizePracticeCorrectOptions(question.correctOptions).includes(normalizedOption);
                                                  const disableCorrect = normalizedOption.length === 0;

                                                  return (
                                                    <div key={`${question.id}-option-${optionIndex}`} className="flex items-center gap-2">
                                                      <input
                                                        value={option}
                                                        onChange={(event) => {
                                                          const nextValue = event.target.value;
                                                          setPracticeWorkspaceDraft((previous) => ({
                                                            ...previous,
                                                            questions: previous.questions.map((existing) => {
                                                              if (existing.id !== question.id || existing.responseType === 'true-false') {
                                                                return existing;
                                                              }
                                                              const nextOptions = [...existing.options];
                                                              nextOptions[optionIndex] = nextValue;
                                                              const cleanedOptions = normalizePracticeQuestionOptions(nextOptions);
                                                              const nextCorrectOptions = normalizePracticeCorrectOptions(existing.correctOptions)
                                                                .filter((answer) => cleanedOptions.includes(answer));
                                                              return {
                                                                ...existing,
                                                                options: nextOptions,
                                                                correctOptions: nextCorrectOptions,
                                                              };
                                                            }),
                                                          }));
                                                        }}
                                                        disabled={question.responseType === 'true-false'}
                                                        className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm disabled:bg-slate-50 disabled:text-slate-500"
                                                        placeholder={`Option ${optionIndex + 1}`}
                                                      />
                                                      <button
                                                        type="button"
                                                        onClick={() => {
                                                          setPracticeWorkspaceDraft((previous) => ({
                                                            ...previous,
                                                            questions: previous.questions.map((existing) => {
                                                              if (existing.id !== question.id || !normalizedOption) return existing;
                                                              const current = normalizePracticeCorrectOptions(existing.correctOptions);
                                                              if (existing.responseType === 'true-false') {
                                                                return { ...existing, correctOptions: [normalizedOption] };
                                                              }
                                                              const exists = current.includes(normalizedOption);
                                                              const next = exists
                                                                ? current.filter((answer) => answer !== normalizedOption)
                                                                : [...current, normalizedOption];
                                                              return { ...existing, correctOptions: next };
                                                            }),
                                                          }));
                                                        }}
                                                        disabled={disableCorrect}
                                                        className={`rounded-md border px-2 py-1 text-xs ${
                                                          isCorrect
                                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                            : 'border-gray-200 text-gray-500'
                                                        } disabled:cursor-not-allowed disabled:opacity-50`}
                                                      >
                                                        Correct
                                                      </button>
                                                      {question.responseType === 'multiple-choice' && (
                                                        <button
                                                          type="button"
                                                          onClick={() => {
                                                            setPracticeWorkspaceDraft((previous) => ({
                                                              ...previous,
                                                              questions: previous.questions.map((existing) => {
                                                                if (existing.id !== question.id) return existing;
                                                                if (existing.options.length <= 2) return existing;
                                                                const removedOption = existing.options[optionIndex]?.trim();
                                                                const nextOptions = existing.options.filter((_, idx) => idx !== optionIndex);
                                                                const nextCorrectOptions = normalizePracticeCorrectOptions(existing.correctOptions)
                                                                  .filter((answer) => answer !== removedOption);
                                                                return {
                                                                  ...existing,
                                                                  options: nextOptions,
                                                                  correctOptions: nextCorrectOptions,
                                                                };
                                                              }),
                                                            }));
                                                          }}
                                                          className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-600 hover:bg-rose-100"
                                                        >
                                                          Remove
                                                        </button>
                                                      )}
                                                    </div>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </section>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="relative z-0 min-h-0 min-w-0 flex-1 overflow-y-auto p-3">
                          <div className="rounded-lg border border-slate-200 bg-white">
                    <div className="space-y-3 border-b border-slate-200 p-3">
                      <input
                        value={stepWorkspaceDraft.title}
                        onChange={(e) => {
                          const title = e.target.value;
                          setStepWorkspaceDraft((prev) => ({ ...prev, title }));
                        }}
                        className="w-full rounded-md border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900"
                        placeholder="Step title"
                      />
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <select
                          value={stepWorkspaceDraft.type}
                          onChange={(e) => {
                            const type = e.target.value as Step['type'];
                            setStepWorkspaceDraft((prev) => ({ ...prev, type }));
                          }}
                          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                        >
                          <option value="document">Document</option>
                          <option value="video">Video</option>
                          <option value="assessment">Assessment</option>
                          <option value="assignment">Assignment</option>
                          <option value="quiz">Quiz</option>
                          <option value="discussion">Discussion</option>
                        </select>
                        <input
                          value={stepWorkspaceDraft.link || ''}
                          onChange={(e) => {
                            const link = e.target.value;
                            setStepWorkspaceDraft((prev) => ({ ...prev, link }));
                          }}
                          className="w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
                          placeholder="Optional external link"
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('undo')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Undo"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('redo')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Redo"
                      >
                        <Redo2 className="h-3.5 w-3.5" />
                      </button>
                      <select
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                        onChange={(e) => {
                          handleStepBlockStyle(e.target.value);
                          e.currentTarget.value = 'P';
                        }}
                        defaultValue="P"
                      >
                        <option value="P">Paragraph</option>
                        <option value="H1">Title</option>
                        <option value="H2">Heading</option>
                        <option value="H3">Subheading</option>
                        <option value="blockquote">Block quote</option>
                        <option value="bulleted-list">Bulleted list</option>
                        <option value="numbered-list">Numbered list</option>
                        <option value="code">Code block</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('bold')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Bold"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('italic')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Italic"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('underline')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Underline"
                      >
                        <Underline className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('insertUnorderedList')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Bulleted list"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('insertOrderedList')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Numbered list"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInsertStepLink()}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Insert link"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Insert image"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => applyStepEditorCommand('formatBlock', 'PRE')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        title="Code block"
                      >
                        <Code2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="relative p-3">
                      <div
                        ref={stepEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => {
                          const content = (e.currentTarget as HTMLDivElement).innerHTML;
                          setStepWorkspaceDraft((prev) => ({
                            ...prev,
                            content,
                          }));
                        }}
                        className="min-h-[440px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {!stepWorkspaceDraft.content ? (
                        <span className="pointer-events-none absolute left-6 top-5 text-sm text-slate-400">
                          Start writing step content here...
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                      )}

              {!isStepAiCollapsed ? (
                <button
                  type="button"
                  className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-r border-slate-100 bg-slate-50 transition-colors hover:bg-blue-50 xl:flex"
                  aria-label="Resize AI collaborator panel"
                >
                  <GripVertical className="h-8 w-3 text-slate-400" />
                </button>
              ) : null}

              <aside
                className={`relative z-10 overflow-hidden border-slate-100 bg-slate-50 transition-all duration-200 ${
                  isStepAiCollapsed
                    ? 'flex h-full flex-col items-center gap-2 border-t p-2.5 xl:w-14 xl:border-l xl:border-t-0'
                    : 'flex h-full min-h-0 w-full flex-col border-t p-3 xl:w-80 xl:border-l xl:border-t-0'
                }`}
              >
                {isStepAiCollapsed ? (
                  <>
                    <Bot className="mt-1 h-4 w-4 text-slate-600" />
                    <button
                      type="button"
                      onClick={() => setIsStepAiCollapsed(false)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      aria-label="Expand AI collaborator panel"
                      title="Expand"
                    >
                      <PanelRightOpen className="h-4 w-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-slate-600" />
                        <p className="text-sm font-semibold text-slate-900">AI Collaborator</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsStepAiCollapsed(true)}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Collapse AI collaborator panel"
                        title="Collapse"
                      >
                        <PanelRightClose className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex min-h-0 flex-1 flex-col rounded-md border border-slate-200 bg-white p-2">
                      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {aiMessages.map((msg, idx) => (
                          <div
                            key={`${msg.role}-${idx}`}
                            className={`rounded-md px-2 py-1.5 text-xs ${
                              msg.role === 'assistant' ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {msg.content}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex items-end gap-2 border-t border-slate-200 pt-2">
                        <textarea
                          ref={aiPromptInputRef}
                          rows={2}
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          placeholder="Ask AI to improve this step..."
                          className="min-h-[44px] min-w-0 flex-1 resize-none overflow-hidden rounded-md border border-slate-200 px-2 py-1.5 text-xs leading-5"
                        />
                        <button
                          type="button"
                          onClick={handleSendAiPrompt}
                          className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-100"
                          aria-label="Send message"
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </aside>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-0 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold text-slate-900">{currentDisplayPlan.plan.name}</h1>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Progress</p>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-green-500"
                        style={{ width: `${currentDisplayPlan.currentProgress}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-slate-700">{currentDisplayPlan.currentProgress}%</span>
                  </div>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-center">
                  <p className="text-xs text-slate-500">ETA</p>
                  <p className="text-sm font-semibold text-slate-900">{currentDisplayPlan.plan.eta} Days</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <p className="text-xs text-slate-500">Performance</p>
                  <p className="text-sm font-semibold text-slate-900">{currentDisplayPlan.plan.performance}</p>
                </div>
              </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Skill Canvas</h2>
                <span className="text-xs text-slate-500">
                  {skillCanvasInsights.mostCriticalSkill
                    ? `Most critical: ${skillCanvasInsights.mostCriticalSkill.name}`
                    : 'No critical skill identified'}
                </span>
              </div>
              <div
                className={`grid grid-cols-1 gap-3 xl:grid-cols-2 ${
                  isCriticalSkillsCollapsed && isAddressedSkillsCollapsed ? 'xl:items-stretch' : 'xl:items-start'
                }`}
              >
                <div
                  className={`rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 ${
                    isCriticalSkillsCollapsed && isAddressedSkillsCollapsed ? 'h-full' : 'self-start'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setIsCriticalSkillsCollapsed((prev) => !prev)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Top critical skills needing attention</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-rose-700">
                        {skillCanvasInsights.criticalSkills.length}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 text-slate-500 transition-transform ${
                          isCriticalSkillsCollapsed ? '' : 'rotate-90'
                        }`}
                      />
                    </div>
                  </button>
                  {!isCriticalSkillsCollapsed ? (
                    <div className="mt-2 space-y-1">
                      {skillCanvasInsights.criticalSkills.length ? (
                        skillCanvasInsights.criticalSkills.map((skill, index) => (
                          <div
                            key={skill.key}
                            tabIndex={0}
                            className="group/critical relative rounded-md bg-white px-2.5 py-1.5 transition hover:bg-rose-50/60 focus:outline-none focus:ring-1 focus:ring-rose-200"
                          >
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-slate-900">{skill.name}</p>
                              {index === 0 ? (
                                <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                  Most critical
                                </span>
                              ) : null}
                            </div>
                            <div className="pointer-events-none absolute left-0 top-full z-20 mt-1 hidden w-72 rounded-md border border-rose-200 bg-white p-2 text-[11px] text-slate-600 shadow-lg group-hover/critical:block group-focus-within/critical:block">
                              <p className="text-xs font-semibold text-slate-800">{skill.name}</p>
                              <p className="mt-1">
                                Current: <span className="font-semibold text-slate-800">{skill.currentDisplay}</span> | Target:{' '}
                                <span className="font-semibold text-slate-800">{skill.targetDisplay}</span> | Gap:{' '}
                                <span className="font-semibold text-rose-700">{skill.gapDisplay}</span>
                              </p>
                              <p className="mt-1">{skill.gapSummary}</p>
                              <p className="mt-1">
                                Lacking areas:{' '}
                                <span className="font-medium text-slate-800">
                                  {skill.supportingTopics?.length
                                    ? skill.supportingTopics.slice(0, 3).join(', ')
                                    : 'No sub-skill breakdown available yet.'}
                                </span>
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                          No critical skills identified yet.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div
                  className={`rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 ${
                    isCriticalSkillsCollapsed && isAddressedSkillsCollapsed ? 'h-full' : 'self-start'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setIsAddressedSkillsCollapsed((prev) => !prev)}
                    className="flex w-full items-center justify-between text-left"
                  >
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Critical skills being addressed</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-emerald-700">
                        {skillCanvasInsights.addressedSkills.length}
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 text-slate-500 transition-transform ${
                          isAddressedSkillsCollapsed ? '' : 'rotate-90'
                        }`}
                      />
                    </div>
                  </button>
                  {!isAddressedSkillsCollapsed ? (
                    <div className="mt-2 space-y-1.5">
                      {skillCanvasInsights.addressedSkills.length ? (
                        skillCanvasInsights.addressedSkills.map((skill) => (
                          <div
                            key={skill.key}
                            className="rounded-md bg-white p-2.5 transition hover:bg-emerald-50/40"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-slate-900">{skill.name}</p>
                                <p className="mt-1 text-xs text-slate-500">{skill.coverageNote}</p>
                              </div>
                              <div className="text-right text-xs text-slate-500">
                                <div>
                                  Current:{' '}
                                  <span className="font-semibold text-slate-900">{skill.currentDisplay}</span>
                                </div>
                                <div>
                                  Target:{' '}
                                  <span className="font-semibold text-slate-900">{skill.targetDisplay}</span>
                                </div>
                              </div>
                            </div>
                            {skill.matchedSteps.length ? (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {skill.matchedSteps.map((stepTitle) => (
                                  <span
                                    key={`${skill.key}-${stepTitle}`}
                                    className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700"
                                  >
                                    {stepTitle}
                                  </span>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                          No critical skills are clearly addressed in the current plan yet.
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">Plan Workflow</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openStepWorkspace(undefined, 'resource')}
                    disabled={isPersistingPlan}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Resource Step
                  </button>
                  <button
                    type="button"
                    onClick={() => openStepWorkspace(undefined, 'practice')}
                    disabled={isPersistingPlan}
                    className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Practice Step
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {sortedStepEntries.map(({ step, index, order }) => (
                    <div
                      role="button"
                      tabIndex={0}
                      key={`${step.title}-${index}`}
                      onClick={() => openStepWorkspace(index)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openStepWorkspace(index);
                        }
                      }}
                      className="w-full cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-[11px] font-semibold text-white">
                            {order}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900">{step.title}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                              <span className="rounded-full bg-slate-200 px-2 py-0.5">{formatStepType(step.type as string)}</span>
                              {step.link ? <span className="truncate max-w-[280px]">{step.link}</span> : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              openStepWorkspace(index);
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Edit step"
                            disabled={isPersistingPlan}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              deleteStep(index);
                            }}
                            className="inline-flex items-center justify-center rounded-md border border-rose-200 bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                            aria-label="Delete step"
                            disabled={isPersistingPlan}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            </div>
            <div className="shrink-0 -mx-3 border-t border-slate-200 bg-white px-3 pt-2 pb-0">
              <button
                type="button"
                className="w-full bg-blue-900 text-white py-2 px-2 rounded-lg hover:bg-blue-800 transition-colors text-sm"
                onClick={openAiPlanBuilder}
                disabled={isPersistingPlan || isGeneratingAiPlanSteps}
              >
                AI Plan Builder
              </button>
            </div>
          </div>
        )}
      </div>

      {!isStudentsPanelCollapsed && !isStepWorkspaceMaximized && !isStepWorkspaceOpen && (
      <div className="lg:col-span-3 col-span-12 bg-gray-50 rounded-lg shadow p-2 overflow-y-auto">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-800 px-1">Students</h3>
            <span className="text-xs text-slate-500">{filteredStudents.length}</span>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 shadow-sm hover:bg-slate-100"
            onClick={() => setIsStudentsPanelCollapsed(true)}
            aria-label="Collapse students panel"
            title="Collapse students panel"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2 mb-2">
          <select
            value={studentsSubjectFilter}
            onChange={(e) => setStudentsSubjectFilter(e.target.value)}
            className="w-full rounded-md border border-slate-200 bg-white px-2 py-2 text-xs text-slate-700"
          >
            <option value="">All subjects</option>
            {subjectOptions.map((subject) => (
              <option key={subject.id} value={subject.id}>{subject.name}</option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              placeholder="Search students..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-2 text-xs text-slate-700"
            />
          </div>
        </div>

        <div className="space-y-1">
          {filteredStudents.map((student) => (
            <div
              key={student.id}
              onClick={() => handleStudentSelect(student.id)}
              className={`cursor-pointer bg-white rounded p-2 shadow-sm transition-all duration-300 border ${
                student.id === selectedStudent.id
                  ? 'border-cyan-500 ring-1 ring-cyan-300'
                  : 'hover:shadow-md hover:border-gray-300'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{student.firstName} {student.lastName}</div>
                  <div className="mt-1 flex flex-col gap-1 text-xs sm:flex-row sm:items-center sm:justify-between">
                    <span className="inline-flex items-center text-gray-600">
                      <span className="w-1 h-1 rounded-full bg-blue-500 mr-0.5" />
                      OVR: {student.overall || 'N/A'}
                    </span>
                    <span className="text-gray-500">Engagement: {student.engagement || 'Unknown'}</span>
                  </div>
                </div>
                <div className="ml-1 flex-shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-xs">
                    {student.firstName?.[0]}{student.lastName?.[0]}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      )}
    </div>
    {isStepLinkModalOpen && (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/35 p-4"
        onClick={() => {
          setIsStepLinkModalOpen(false);
          setStepLinkValue('');
        }}
      >
        <div
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3">
            <p className="text-sm font-semibold text-slate-900">Insert link</p>
            <p className="text-xs text-slate-500">Provide the URL for this step content.</p>
          </div>
          <input
            type="url"
            value={stepLinkValue}
            onChange={(event) => setStepLinkValue(event.target.value)}
            placeholder="https://example.com"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
          />
          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setIsStepLinkModalOpen(false);
                setStepLinkValue('');
              }}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmStepLink}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
            >
              Insert
            </button>
          </div>
        </div>
      </div>
    )}
    {isAiPlanBuilderModalOpen && (
      <div
        className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-900/40 p-4"
        onClick={closeAiPlanBuilderModal}
      >
        <div
          className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-3">
            <h3 className="text-base font-semibold text-slate-900">AI Plan Builder</h3>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="block text-xs text-slate-600">
              Number of steps
              <input
                type="number"
                min={1}
                max={10}
                value={aiPlanBuilderStepCount}
                onChange={(event) => setAiPlanBuilderStepCount(Number(event.target.value))}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-600">
              Plan approach
              <select
                value={aiPlanBuilderApproach}
                onChange={(event) => setAiPlanBuilderApproach(event.target.value as AiPlanApproach)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option value="balanced">Balanced</option>
                <option value="practice">Practice-first</option>
                <option value="intervention">Intervention</option>
              </select>
            </label>
          </div>

          <label className="mt-3 block text-xs text-slate-600">
            Objective for this learner
            <input
              value={aiPlanBuilderObjective}
              onChange={(event) => setAiPlanBuilderObjective(event.target.value)}
              placeholder="Example: Raise mastery in linear equations and worded problems."
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-3 block text-xs text-slate-600">
            Critical topic to focus on (priority ordered)
            <select
              multiple
              value={aiPlanBuilderSelectedTopicKeys}
              onChange={(event) => {
                const selectedValues = Array.from(event.target.selectedOptions).map((option) => option.value);
                setAiPlanBuilderSelectedTopicKeys(selectedValues);
              }}
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
              size={Math.min(6, Math.max(4, skillCanvasInsights.criticalSkills.length + 1))}
              disabled={!skillCanvasInsights.criticalSkills.length}
            >
              {skillCanvasInsights.criticalSkills.map((skill, index) => (
                <option key={skill.key} value={skill.key}>
                  {`${index + 1}. ${skill.name}${index === 0 ? ' (Most critical)' : ''}`}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-slate-500">
              Priority 1 indicates the quickest attention required. Use Ctrl/Cmd to select multiple topics.
            </span>
            {aiPlanBuilderSelectedTopicKeys.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {skillCanvasInsights.criticalSkills
                  .filter((skill) => aiPlanBuilderSelectedTopicKeys.includes(skill.key))
                  .map((skill) => {
                    const rank = skillCanvasInsights.criticalSkills.findIndex((item) => item.key === skill.key) + 1;
                    return (
                      <span
                        key={skill.key}
                        className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                      >
                        {`${rank}. ${skill.name}`}
                      </span>
                    );
                  })}
              </div>
            ) : null}
          </label>

          <label className="mt-3 block text-xs text-slate-600">
            Teacher guidance for AI
            <textarea
              rows={4}
              value={aiPlanBuilderPrompt}
              onChange={(event) => setAiPlanBuilderPrompt(event.target.value)}
              placeholder="Share constraints, preferred difficulty, pace, and resource style."
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
            />
          </label>

          <div className="mt-4 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={closeAiPlanBuilderModal}
              disabled={isGeneratingAiPlanSteps}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleGenerateAiPlanSteps}
              disabled={isGeneratingAiPlanSteps || !aiPlanBuilderSelectedTopicKeys.length}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGeneratingAiPlanSteps ? 'Generating...' : 'Generate Plan Steps'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default DevelopmentView;
