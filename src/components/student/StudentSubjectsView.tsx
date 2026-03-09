import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  GripHorizontal,
  MessageCircle,
  PlayCircle,
  Send,
  Target,
  X,
} from 'lucide-react';
import { Subject } from '../../types';
import {
  curriculumService,
  CurriculumTopicWithResources as CurriculumTopicApi,
  CurriculumTopicResource,
} from '../../services/curriculumService';
import {
  studentService,
  StudentPracticeSession,
  StudentPracticeSessionQuestion,
  StudentSubjectOverview,
} from '../../services/studentService';
import { assessmentService } from '../../services/assessmentService';
import { resourceService, ResourceItem } from '../../services/resourceService';
import { normalizeResourceContentType } from '../../constants/resourceContentTypes';
import StudentPracticeRunner, { PracticeQuestion, PracticeRunSummary } from './StudentPracticeRunner';

type PracticeStatus = 'not-started' | 'in-progress' | 'mastered';
type ResourceType = 'video' | 'notes' | 'article';

interface CurriculumResource {
  id: string;
  title: string;
  type: ResourceType;
}

interface CurriculumPractice {
  id: string;
  title: string;
  status: PracticeStatus;
  target: string;
  questionCount: number;
}

interface CurriculumAssessment {
  id: string;
  title: string;
  status: string;
  resourceId?: string | null;
}

interface CurriculumTopic {
  id: string;
  title: string;
  masteryPercent: number;
  questionCount: number;
  learn: CurriculumResource[];
  practice: CurriculumPractice[];
  practiceMaterials: CurriculumResource[];
  assessments: CurriculumAssessment[];
}

type TopicContentItemKind = 'learn' | 'practice' | 'assessment';

interface TopicContentItem {
  id: string;
  title: string;
  kind: TopicContentItemKind;
  resource?: CurriculumResource;
  practice?: CurriculumPractice;
  assessment?: CurriculumAssessment;
}

interface CurriculumUnit {
  id: string;
  code: string;
  title: string;
  summary: string;
  masteryPercent: number;
  topics: CurriculumTopic[];
}

interface StudentSubjectsViewProps {
  studentId: string;
  selectedSubjectId: string;
  subjects: Subject[];
}

type UnitChallengeStage = 'intro' | 'running' | 'completed';
type ChallengeDifficulty = 'easy' | 'medium' | 'hard';

interface ChallengeGenerationConfig {
  questionCount: number;
  difficulty: ChallengeDifficulty;
  questions: PracticeQuestion[];
  sessionId?: string | null;
  isGenerating: boolean;
  error: string | null;
}

interface SubjectsChatMessage {
  id: string;
  sender: 'student' | 'coach';
  text: string;
}

interface SubjectsChatDragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

interface SubjectAssessmentRow {
  id: string;
  name?: string;
  status?: string;
  resourceId?: string | null;
  resource?: string | { id?: string | null } | null;
}

interface LinkedTopicAssessment {
  id: string;
  title: string;
  status: string;
  resourceId: string | null;
}

const DEFAULT_UNIT_CHALLENGE_COUNT = 10;
const DEFAULT_SUBJECT_CHALLENGE_COUNT = 12;
const CRITICAL_TOPIC_MASTERY_THRESHOLD = 50;

const createChallengeGenerationConfig = (questionCount: number): ChallengeGenerationConfig => ({
  questionCount,
  difficulty: 'medium',
  questions: [],
  sessionId: null,
  isGenerating: false,
  error: null,
});

const getPracticeActionLabel = (status: PracticeStatus) => {
  if (status === 'mastered') return 'Review';
  if (status === 'in-progress') return 'Resume';
  return 'Start';
};

const getResourceBadgeClassName = (type: ResourceType) => {
  if (type === 'video') return 'bg-red-100 text-red-700';
  if (type === 'notes') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-700';
};

const getTopicContentItems = (topic: CurriculumTopic): TopicContentItem[] => [
  ...topic.learn.map((resource) => ({
    id: `learn-${resource.id}`,
    title: resource.title,
    kind: 'learn' as const,
    resource,
  })),
  ...topic.practiceMaterials.map((resource) => ({
    id: `learn-${resource.id}`,
    title: resource.title,
    kind: 'learn' as const,
    resource,
  })),
  ...topic.practice.map((practice) => ({
    id: `practice-${practice.id}`,
    title: practice.title,
    kind: 'practice' as const,
    practice,
  })),
  ...topic.assessments.map((assessment) => ({
    id: `assessment-${assessment.id}`,
    title: assessment.title,
    kind: 'assessment' as const,
    assessment,
  })),
];

const getUpNextLabelForContentItem = (item: TopicContentItem) => {
  if (item.kind === 'practice') return 'quiz';
  if (item.kind === 'assessment') return 'practice';
  if (!item.resource) return 'lesson';
  if (item.resource.type === 'video') return 'video';
  if (item.resource.type === 'notes') return 'notes';
  return 'article';
};

const normalizeText = (value: string | null | undefined) => String(value || '').trim().toLowerCase();
const normalizeAssessmentStatus = (value: string | null | undefined) => {
  const normalized = normalizeText(value);
  return normalized === 'active' ? 'published' : (normalized || 'published');
};
const extractAssessmentResourceId = (assessment: SubjectAssessmentRow): string | null => {
  const raw = assessment?.resourceId ?? assessment?.resource;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  return raw?.id || null;
};
const decodeHtmlEntities = (value: string) =>
  value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
const looksLikeHtml = (value: string) => /<([a-z][\w-]*)(\s[^>]*)?>/i.test(value);

const extractPracticeQuestionsFromContentBody = (contentBody: string): string[] => {
  const decoded = decodeHtmlEntities(String(contentBody || '').trim());
  if (!decoded) return [];

  const stripMetadata = (value: string) =>
    value
      .replace(/\s+Options:\s*.*$/i, '')
      .replace(/\s+Answer\(s\):\s*.*$/i, '')
      .replace(/\s+Answer:\s*.*$/i, '')
      .replace(/\s+Marking guide:\s*.*$/i, '')
      .trim();

  const normalizeQuestionLine = (line: string) =>
    stripMetadata(line.replace(/^\s*\d+[).\-\s]*/, '').trim());

  const htmlQuestionLines = (() => {
    if (typeof document === 'undefined' || !looksLikeHtml(decoded)) return [] as string[];
    const parsed = new DOMParser().parseFromString(decoded, 'text/html');
    return Array.from(parsed.querySelectorAll('li'))
      .map((item) => normalizeQuestionLine(item.textContent || ''))
      .filter(Boolean);
  })();

  if (htmlQuestionLines.length > 0) {
    return htmlQuestionLines;
  }

  const plainText =
    typeof document !== 'undefined' && looksLikeHtml(decoded)
      ? new DOMParser().parseFromString(decoded, 'text/html').body.textContent || ''
      : decoded;

  const normalizedText = plainText.replace(/\r\n/g, '\n').trim();
  const questionsSectionMatch = normalizedText.match(/questions?\s*:\s*([\s\S]*)/i);
  const scopedText = (questionsSectionMatch?.[1] || normalizedText).trim();
  const lines = scopedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const numberedLines = lines.filter((line) => /^\d+[).\-\s]/.test(line));
  const candidateLines = numberedLines.length > 0 ? numberedLines : lines;

  return candidateLines
    .map(normalizeQuestionLine)
    .filter(Boolean)
    .filter(
      (line) =>
        !/^topic\s*:/i.test(line) &&
        !/^practice description/i.test(line) &&
        !/^questions?\s*:?\s*$/i.test(line)
    );
};

const getResourceTypeFromItem = (
  resource: Pick<CurriculumTopicResource, 'type' | 'mimeType' | 'contentType' | 'name' | 'originalName'>
): ResourceType => {
  const normalizedType = normalizeText(resource.type);
  const normalizedMime = normalizeText(resource.mimeType);
  const normalizedContentType = normalizeText(resource.contentType);
  const normalizedName = normalizeText(resource.name || resource.originalName);

  if (
    normalizedType.includes('video') ||
    normalizedMime.startsWith('video/') ||
    normalizedContentType.includes('video') ||
    normalizedName.endsWith('.mp4') ||
    normalizedName.endsWith('.mov')
  ) {
    return 'video';
  }

  if (
    normalizedType.includes('document') ||
    normalizedType.includes('notes') ||
    normalizedName.endsWith('.pdf') ||
    normalizedName.endsWith('.doc') ||
    normalizedName.endsWith('.docx') ||
    normalizedName.endsWith('.ppt') ||
    normalizedName.endsWith('.pptx')
  ) {
    return 'notes';
  }

  return 'article';
};

const mapPracticeQuestionFromSession = (question: StudentPracticeSessionQuestion): PracticeQuestion => {
  const normalizedType = String(question.questionType || '').toLowerCase();
  if (normalizedType.includes('multiple') || normalizedType === 'true_false') {
    return {
      id: question.assessmentQuestionId,
      type: question.multipleSelection ? 'multiple' : 'single',
      prompt: question.prompt,
      options: question.options || [],
      correctOptionIndexes: [],
    };
  }
  return {
    id: question.assessmentQuestionId,
    type: 'input',
    prompt: question.prompt,
    placeholder: 'Type your answer',
    acceptedAnswers: [],
  };
};

const mapSubjectOverviewToUnits = (
  subjectName: string,
  overview: StudentSubjectOverview,
  topicsWithResources: CurriculumTopicApi[],
  linkedAssessmentsByTopicId: Map<string, LinkedTopicAssessment[]> = new Map()
): CurriculumUnit[] => {
  const overviewTopicMetrics = new Map<string, { masteryPercent: number; questionCount: number; sequenceIndex?: number | null }>();
  (overview.units || []).forEach((unit) => {
    (unit.topics || []).forEach((topic) => {
      overviewTopicMetrics.set(topic.topicId, {
        masteryPercent: Number(topic.masteryPercent || 0),
        questionCount: Number(topic.questionCount || 0),
        sequenceIndex: topic.sequenceIndex ?? null,
      });
    });
  });

  const fallbackTopicRows: CurriculumTopicApi[] = (overview.units || []).flatMap((unit) =>
    (unit.topics || []).map((topic) => ({
      id: topic.topicId,
      subjectId: overview.subjectId,
      code: topic.code || '',
      name: topic.name || '',
      sequenceIndex: topic.sequenceIndex ?? null,
      resources: [],
    }))
  );

  const canonicalTopicRows = (topicsWithResources.length > 0 ? topicsWithResources : fallbackTopicRows)
    .slice()
    .sort((left, right) => {
      const leftSequence = Number.isFinite(Number(left.sequenceIndex)) ? Number(left.sequenceIndex) : Number.MAX_SAFE_INTEGER;
      const rightSequence = Number.isFinite(Number(right.sequenceIndex)) ? Number(right.sequenceIndex) : Number.MAX_SAFE_INTEGER;
      if (leftSequence !== rightSequence) return leftSequence - rightSequence;
      return String(left.name || '').localeCompare(String(right.name || ''));
    });

  return canonicalTopicRows.map((topicRow, index) => {
    const topicResources = topicRow.resources || [];
    const practiceResources = topicResources.filter(
      (resource) => normalizeResourceContentType(resource.contentType) === 'practice'
    );
    const assessmentResources = topicResources.filter(
      (resource) => normalizeResourceContentType(resource.contentType) === 'assessment_material'
    );
    const learnTopicResources = topicResources.filter((resource) => {
      const normalized = normalizeResourceContentType(resource.contentType);
      return normalized !== 'practice' && normalized !== 'assessment_material';
    });

    const learnResources: CurriculumResource[] = learnTopicResources.map((resource) => ({
      id: resource.id,
      title: resource.name || resource.originalName || 'Learning resource',
      type: getResourceTypeFromItem(resource),
    }));

    const practiceMaterials: CurriculumResource[] = practiceResources.map((resource) => ({
      id: resource.id,
      title: resource.name || resource.originalName || 'Practice material',
      type: getResourceTypeFromItem(resource),
    }));

    const resourceBackedAssessments: CurriculumAssessment[] = assessmentResources.map((resource) => ({
      id: resource.id,
      title: resource.name || resource.originalName || 'Assessment',
      status: normalizeAssessmentStatus(resource.status),
      resourceId: resource.id,
    }));
    const linkedAssessments = linkedAssessmentsByTopicId.get(topicRow.id) || [];
    const assessmentsByKey = new Map<string, CurriculumAssessment>();
    [...linkedAssessments, ...resourceBackedAssessments].forEach((assessment) => {
      const key = assessment.resourceId || assessment.id;
      if (assessmentsByKey.has(key)) return;
      assessmentsByKey.set(key, assessment);
    });
    const assessments = Array.from(assessmentsByKey.values());

    const metrics = overviewTopicMetrics.get(topicRow.id);
    const availableQuestionCount = Math.max(0, Number(metrics?.questionCount || 0));
    const practiceCount = Math.max(0, Math.min(12, availableQuestionCount));
    const mappedTopic: CurriculumTopic = {
      id: topicRow.id,
      title: topicRow.name || `Topic ${index + 1}`,
      masteryPercent: Math.max(0, Math.min(100, Math.round(Number(metrics?.masteryPercent || 0)))),
      questionCount: availableQuestionCount,
      learn: learnResources,
      practice: practiceCount > 0
        ? [
            {
              id: `practice-${topicRow.id}`,
              title: topicRow.name || `Topic ${index + 1}`,
              status: 'not-started',
              target: `Complete ${practiceCount} question${practiceCount === 1 ? '' : 's'}`,
              questionCount: practiceCount,
            },
          ]
        : [],
      practiceMaterials,
      assessments,
    };

    const unitOrder = index + 1;
    const summary = `Covers 1 topic with ${availableQuestionCount} published question${availableQuestionCount === 1 ? '' : 's'}.`;

    return {
      id: `topic-unit-${topicRow.id}`,
      code: `Topic ${unitOrder}`,
      title: mappedTopic.title || `${subjectName} topic ${unitOrder}`,
      summary,
      masteryPercent: mappedTopic.masteryPercent,
      topics: [mappedTopic],
    };
  });
};

const mapAssessmentsByTopic = (
  topicsWithResources: CurriculumTopicApi[],
  subjectAssessments: SubjectAssessmentRow[],
  subjectResources: ResourceItem[] = []
): Map<string, LinkedTopicAssessment[]> => {
  const topicIdsByResourceId = new Map<string, Set<string>>();
  topicsWithResources.forEach((topic) => {
    (topic.resources || []).forEach((resource) => {
      if (!topicIdsByResourceId.has(resource.id)) {
        topicIdsByResourceId.set(resource.id, new Set());
      }
      const topicIds = topicIdsByResourceId.get(resource.id)!;
      topicIds.add(topic.id);
      (resource.topicIds || []).forEach((resourceTopicId) => topicIds.add(resourceTopicId));
    });
  });
  subjectResources.forEach((resource) => {
    if (!resource?.id) return;
    if (!topicIdsByResourceId.has(resource.id)) {
      topicIdsByResourceId.set(resource.id, new Set());
    }
    const topicIds = topicIdsByResourceId.get(resource.id)!;
    (resource.topicIds || []).forEach((resourceTopicId) => topicIds.add(resourceTopicId));
  });

  const mapped = new Map<string, LinkedTopicAssessment[]>();
  subjectAssessments.forEach((assessment) => {
    const resourceId = extractAssessmentResourceId(assessment);
    if (!resourceId) return;
    const topicIds = topicIdsByResourceId.get(resourceId);
    if (!topicIds || topicIds.size === 0) return;

    topicIds.forEach((topicId) => {
      const existing = mapped.get(topicId) || [];
      existing.push({
        id: assessment.id,
        title: assessment.name || 'Assessment',
        status: normalizeAssessmentStatus(assessment.status),
        resourceId,
      });
      mapped.set(topicId, existing);
    });
  });

  return mapped;
};

const StudentSubjectsView: React.FC<StudentSubjectsViewProps> = ({ studentId, selectedSubjectId, subjects }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSubjectOverviewActive, setIsSubjectOverviewActive] = useState(false);
  const [selectedUnitIndex, setSelectedUnitIndex] = useState(0);
  const [backendUnits, setBackendUnits] = useState<CurriculumUnit[]>([]);
  const [subjectOverview, setSubjectOverview] = useState<StudentSubjectOverview | null>(null);
  const [isCurriculumLoading, setIsCurriculumLoading] = useState(false);
  const [, setCurriculumError] = useState<string | null>(null);
  const [practiceStatusOverrides, setPracticeStatusOverrides] = useState<Record<string, PracticeStatus>>({});
  const [collapsedTopicIds, setCollapsedTopicIds] = useState<Record<string, boolean>>({});
  const [detailState, setDetailState] = useState<{ unitId: string; topicId: string; contentItemId: string } | null>(null);
  const [detailPracticeSession, setDetailPracticeSession] = useState<StudentPracticeSession | null>(null);
  const [detailPracticeLoading, setDetailPracticeLoading] = useState(false);
  const [detailPracticeError, setDetailPracticeError] = useState<string | null>(null);
  const [resourceBodyById, setResourceBodyById] = useState<Record<string, string>>({});
  const [resourceBodyLoadingById, setResourceBodyLoadingById] = useState<Record<string, boolean>>({});
  const [resourceBodyErrorById, setResourceBodyErrorById] = useState<Record<string, string>>({});
  const [unitChallengeState, setUnitChallengeState] = useState<{
    unitId: string;
    stage: UnitChallengeStage;
    summary?: PracticeRunSummary | null;
  } | null>(null);
  const [subjectChallengeState, setSubjectChallengeState] = useState<{
    stage: UnitChallengeStage;
    summary?: PracticeRunSummary | null;
  } | null>(null);
  const [unitChallengeStep, setUnitChallengeStep] = useState<1 | 2>(1);
  const [subjectChallengeStep, setSubjectChallengeStep] = useState<1 | 2>(1);
  const [unitChallengeConfigByUnitId, setUnitChallengeConfigByUnitId] = useState<Record<string, ChallengeGenerationConfig>>({});
  const [subjectChallengeConfigBySubjectId, setSubjectChallengeConfigBySubjectId] = useState<Record<string, ChallengeGenerationConfig>>({});
  const [isSubjectsChatOpen, setIsSubjectsChatOpen] = useState(false);
  const [subjectsChatInput, setSubjectsChatInput] = useState('');
  const [subjectsChatMessages, setSubjectsChatMessages] = useState<SubjectsChatMessage[]>([
    {
      id: 'subjects-chat-welcome',
      sender: 'coach',
      text: 'Need help on this topic? Ask a question and I will guide your next step.',
    },
  ]);
  const [subjectsChatPosition, setSubjectsChatPosition] = useState<{ x: number; y: number } | null>(null);
  const subjectsChatFloatingRef = useRef<HTMLDivElement | null>(null);
  const subjectsChatDragStateRef = useRef<SubjectsChatDragState | null>(null);
  const subjectsChatDragCleanupRef = useRef<(() => void) | null>(null);

  const activeSubject = useMemo(() => {
    if (subjects.length === 0) return null;
    if (selectedSubjectId === 'all') return subjects[0];
    return subjects.find((subject) => subject.id === selectedSubjectId) || subjects[0];
  }, [selectedSubjectId, subjects]);

  const units = useMemo(() => backendUnits, [backendUnits]);

  const selectedUnit = units[selectedUnitIndex] || units[0];
  const nextUnit = selectedUnitIndex < units.length - 1 ? units[selectedUnitIndex + 1] : null;
  const sidebarDesktopWidth = isSidebarCollapsed ? 'xl:w-[88px]' : 'xl:w-[320px]';
  const contentDesktopOffset = isSidebarCollapsed ? 'xl:ml-[88px]' : 'xl:ml-[320px]';
  const desktopSidebarWidthPx = isSidebarCollapsed ? 88 : 320;
  const desktopContainerInset = 'max(1rem, calc((100vw - 1400px)/2 + 1rem))';
  const activeUnitChallenge = unitChallengeState && unitChallengeState.unitId === selectedUnit?.id ? unitChallengeState : null;
  const isUnitChallengeActive = Boolean(activeUnitChallenge);
  const isUnitChallengeRunning = activeUnitChallenge?.stage === 'running';
  const isSubjectChallengeActive = Boolean(subjectChallengeState);
  const isSubjectChallengeRunning = subjectChallengeState?.stage === 'running';
  const activeUnitChallengeStep: 1 | 2 = isUnitChallengeRunning ? 2 : unitChallengeStep;
  const activeSubjectChallengeStep: 1 | 2 = isSubjectChallengeRunning ? 2 : subjectChallengeStep;
  const selectedUnitChallengeConfig = selectedUnit
    ? unitChallengeConfigByUnitId[selectedUnit.id] || createChallengeGenerationConfig(DEFAULT_UNIT_CHALLENGE_COUNT)
    : createChallengeGenerationConfig(DEFAULT_UNIT_CHALLENGE_COUNT);
  const selectedSubjectChallengeConfig = activeSubject
    ? subjectChallengeConfigBySubjectId[activeSubject.id] || createChallengeGenerationConfig(DEFAULT_SUBJECT_CHALLENGE_COUNT)
    : createChallengeGenerationConfig(DEFAULT_SUBJECT_CHALLENGE_COUNT);
  const unitChallengeQuestionTotal = selectedUnitChallengeConfig.questions.length > 0
    ? selectedUnitChallengeConfig.questions.length
    : selectedUnitChallengeConfig.questionCount;
  const subjectChallengeQuestionTotal = selectedSubjectChallengeConfig.questions.length > 0
    ? selectedSubjectChallengeConfig.questions.length
    : selectedSubjectChallengeConfig.questionCount;
  const unitChallengeEstimatedMinutes = Math.max(15, unitChallengeQuestionTotal * 2);
  const subjectChallengeEstimatedMinutes = Math.max(20, subjectChallengeQuestionTotal * 2);
  const subjectChallengeEligibility = subjectOverview?.challengeEligibility || null;
  const isSubjectChallengeEligible = subjectChallengeEligibility ? subjectChallengeEligibility.eligible : true;
  const subjectChallengeBlockedReason = !isSubjectChallengeEligible
    ? subjectChallengeEligibility?.reason || 'Subject challenge is currently unavailable.'
    : null;
  const shouldShowSubjectsChat = !isUnitChallengeActive && !isSubjectChallengeActive && Boolean(detailState);

  useEffect(() => {
    const loadCurriculum = async () => {
      if (!activeSubject?.id || !studentId) {
        setBackendUnits([]);
        setSubjectOverview(null);
        setCurriculumError(null);
        return;
      }

      setIsCurriculumLoading(true);
      setCurriculumError(null);

      try {
        const [overview, topics, subjectAssessments, subjectResources] = await Promise.all([
          studentService.getSubjectOverview(studentId, activeSubject.id).catch(() => null),
          curriculumService.listTopicsWithResources(activeSubject.id).catch(() => []),
          assessmentService.getAssessmentsBySubjectId(activeSubject.id)
            .then((rows) => (Array.isArray(rows) ? (rows as unknown as SubjectAssessmentRow[]) : []))
            .catch(() => []),
          resourceService.listBySubject(activeSubject.id).catch(() => []),
        ]);

        if (!overview) {
          setSubjectOverview(null);
          setBackendUnits([]);
          setCurriculumError('Unable to load subject overview from backend right now.');
          return;
        }

        const linkedAssessmentsByTopicId = mapAssessmentsByTopic(topics, subjectAssessments, subjectResources);
        const mappedUnits = mapSubjectOverviewToUnits(activeSubject.name, overview, topics, linkedAssessmentsByTopicId);
        setSubjectOverview(overview);
        setBackendUnits(mappedUnits);

        if (mappedUnits.length === 0) {
          setCurriculumError('No teacher-published curriculum found yet.');
        } else if (!overview.challengeEligibility?.eligible) {
          setCurriculumError(overview.challengeEligibility.reason || null);
        } else {
          setCurriculumError(null);
        }
      } catch (loadError: any) {
        setBackendUnits([]);
        setSubjectOverview(null);
        setCurriculumError(loadError?.message || 'Unable to load curriculum from backend right now.');
      } finally {
        setIsCurriculumLoading(false);
      }
    };

    void loadCurriculum();
  }, [activeSubject?.id, activeSubject?.name, studentId]);

  useEffect(() => {
    setSelectedUnitIndex(0);
    setDetailState(null);
    setDetailPracticeSession(null);
    setDetailPracticeLoading(false);
    setDetailPracticeError(null);
    setPracticeStatusOverrides({});
    setCollapsedTopicIds({});
    setSubjectOverview(null);
    setUnitChallengeState(null);
    setSubjectChallengeState(null);
    setUnitChallengeStep(1);
    setSubjectChallengeStep(1);
    setUnitChallengeConfigByUnitId({});
    setSubjectChallengeConfigBySubjectId({});
    setIsSubjectOverviewActive(false);
    setIsSubjectsChatOpen(false);
    setSubjectsChatInput('');
    setSubjectsChatPosition(null);
    setSubjectsChatMessages([
      {
        id: 'subjects-chat-welcome',
        sender: 'coach',
        text: 'Need help on this topic? Ask a question and I will guide your next step.',
      },
    ]);
  }, [activeSubject?.id]);

  useEffect(() => () => {
    if (subjectsChatDragCleanupRef.current) {
      subjectsChatDragCleanupRef.current();
    }
  }, []);

  useEffect(() => {
    if (!detailState) return;
    if (detailState.unitId !== selectedUnit?.id) {
      setDetailState(null);
    }
  }, [selectedUnit?.id]);

  useEffect(() => {
    if (!unitChallengeState || !selectedUnit?.id) return;
    if (unitChallengeState.unitId !== selectedUnit.id) {
      setUnitChallengeState(null);
    }
  }, [selectedUnit?.id, unitChallengeState]);

  const allTopics = useMemo(
    () => units.flatMap((unit) => unit.topics),
    [units]
  );

  const masteredTopics = allTopics.filter((topic) => topic.masteryPercent >= 80).length;
  const inProgressTopics = allTopics.filter((topic) => topic.masteryPercent >= 50 && topic.masteryPercent < 80).length;
  const overallCoverage = allTopics.length > 0
    ? Math.round(allTopics.reduce((sum, topic) => sum + topic.masteryPercent, 0) / allTopics.length)
    : 0;

  const getPracticeStatus = (practice: CurriculumPractice): PracticeStatus => (
    practiceStatusOverrides[practice.id] || practice.status
  );

  const hasTopicBeenAttempted = (topic: CurriculumTopic): boolean => {
    if (topic.masteryPercent > 0) return true;
    return topic.practice.some((practice) => getPracticeStatus(practice) !== 'not-started');
  };

  const updateUnitChallengeConfig = (updater: (current: ChallengeGenerationConfig) => ChallengeGenerationConfig) => {
    if (!selectedUnit) return;
    setUnitChallengeConfigByUnitId((previous) => {
      const current = previous[selectedUnit.id] || createChallengeGenerationConfig(DEFAULT_UNIT_CHALLENGE_COUNT);
      return {
        ...previous,
        [selectedUnit.id]: updater(current),
      };
    });
  };

  const updateSubjectChallengeConfig = (updater: (current: ChallengeGenerationConfig) => ChallengeGenerationConfig) => {
    if (!activeSubject) return;
    setSubjectChallengeConfigBySubjectId((previous) => {
      const current = previous[activeSubject.id] || createChallengeGenerationConfig(DEFAULT_SUBJECT_CHALLENGE_COUNT);
      return {
        ...previous,
        [activeSubject.id]: updater(current),
      };
    });
  };

  const generateUnitChallengeWithAi = async () => {
    if (!activeSubject || !selectedUnit) return;

    const currentConfig = selectedUnitChallengeConfig;
    updateUnitChallengeConfig((current) => ({ ...current, isGenerating: true, error: null }));

    try {
      const session = await studentService.startPracticeSession(studentId, activeSubject.id, {
        topicId: selectedUnit.topics[0]?.id,
        questionCount: currentConfig.questionCount,
        mode: 'topic_challenge',
        title: `${selectedUnit.code}: ${selectedUnit.title} topic challenge`,
      });
      const practiceQuestions = (session.questions || []).map(mapPracticeQuestionFromSession);

      updateUnitChallengeConfig((current) => ({
        ...current,
        questions: practiceQuestions,
        sessionId: session.sessionId,
        isGenerating: false,
        error: null,
      }));
    } catch (error) {
      updateUnitChallengeConfig((current) => ({
        ...current,
        questions: [],
        sessionId: null,
        isGenerating: false,
        error: 'Unable to prepare challenge questions right now. Please retry.',
      }));
    }
  };

  const generateSubjectChallengeWithAi = async () => {
    if (!activeSubject) return;
    if (!isSubjectChallengeEligible) {
      updateSubjectChallengeConfig((current) => ({
        ...current,
        error: subjectChallengeBlockedReason || 'Subject challenge is currently unavailable.',
      }));
      return;
    }

    const currentConfig = selectedSubjectChallengeConfig;
    updateSubjectChallengeConfig((current) => ({ ...current, isGenerating: true, error: null }));

    try {
      const session = await studentService.startPracticeSession(studentId, activeSubject.id, {
        questionCount: currentConfig.questionCount,
        mode: 'subject_challenge',
        title: `${activeSubject.name} subject challenge`,
      });
      const practiceQuestions = (session.questions || []).map(mapPracticeQuestionFromSession);

      updateSubjectChallengeConfig((current) => ({
        ...current,
        questions: practiceQuestions,
        sessionId: session.sessionId,
        isGenerating: false,
        error: null,
      }));
    } catch (error) {
      updateSubjectChallengeConfig((current) => ({
        ...current,
        questions: [],
        sessionId: null,
        isGenerating: false,
        error: 'Unable to prepare challenge questions right now. Please retry.',
      }));
    }
  };

  const openSubjectOverview = () => {
    setDetailState(null);
    setUnitChallengeState(null);
    setSubjectChallengeState(null);
    setIsSubjectOverviewActive(true);
  };

  const openUnitPage = (unit: CurriculumUnit) => {
    const unitIndex = units.findIndex((currentUnit) => currentUnit.id === unit.id);
    if (unitIndex >= 0) setSelectedUnitIndex(unitIndex);
    setDetailState(null);
    setUnitChallengeState(null);
    setSubjectChallengeState(null);
    setIsSubjectOverviewActive(false);
  };

  const openPractice = (unit: CurriculumUnit, topic: CurriculumTopic, practice: CurriculumPractice) => {
    const effectiveStatus = getPracticeStatus(practice);
    if (effectiveStatus !== 'mastered') {
      setPracticeStatusOverrides((previous) => ({ ...previous, [practice.id]: 'in-progress' }));
    }
    const items = getTopicContentItems(topic);
    const practiceItem = items.find((item) => item.kind === 'practice' && item.practice?.id === practice.id);
    if (practiceItem) {
      setUnitChallengeState(null);
      setSubjectChallengeState(null);
      setIsSubjectOverviewActive(false);
      setDetailState({
        unitId: unit.id,
        topicId: topic.id,
        contentItemId: practiceItem.id,
      });
    }
  };

  const openTopicDetail = (unit: CurriculumUnit, topic: CurriculumTopic, preferredContentItemId?: string) => {
    const items = getTopicContentItems(topic);
    if (items.length === 0) return;
    const selectedContentItemId = preferredContentItemId && items.some((item) => item.id === preferredContentItemId)
      ? preferredContentItemId
      : items[0].id;

    const unitIndex = units.findIndex((currentUnit) => currentUnit.id === unit.id);
    if (unitIndex >= 0) setSelectedUnitIndex(unitIndex);

    setUnitChallengeState(null);
    setSubjectChallengeState(null);
    setIsSubjectOverviewActive(false);
    setDetailState({
      unitId: unit.id,
      topicId: topic.id,
      contentItemId: selectedContentItemId,
    });
  };

  const toggleTopicCollapsed = (topicId: string) => {
    setCollapsedTopicIds((previous) => ({
      ...previous,
      [topicId]: !previous[topicId],
    }));
  };

  const sendSubjectsChatMessage = () => {
    const message = subjectsChatInput.trim();
    if (!message) return;

    const studentMessage: SubjectsChatMessage = {
      id: `subjects-student-${Date.now()}`,
      sender: 'student',
      text: message,
    };

    const focusLabel = detailTopic?.title || selectedUnit?.title || activeSubject?.name || 'this topic';
    const coachReply: SubjectsChatMessage = {
      id: `subjects-coach-${Date.now() + 1}`,
      sender: 'coach',
      text: `Focus on "${focusLabel}". Review one example, then attempt one practice item and explain each step.`,
    };

    setSubjectsChatMessages((previous) => [...previous, studentMessage, coachReply]);
    setSubjectsChatInput('');
  };

  const clampSubjectsChatPosition = (x: number, y: number) => {
    const floatingNode = subjectsChatFloatingRef.current;
    if (!floatingNode) return { x, y };

    const margin = 8;
    const width = floatingNode.offsetWidth;
    const height = floatingNode.offsetHeight;

    return {
      x: Math.min(Math.max(margin, x), window.innerWidth - width - margin),
      y: Math.min(Math.max(margin, y), window.innerHeight - height - margin),
    };
  };

  const setSubjectsChatOpenWithAnchor = (nextOpen: boolean) => {
    if (nextOpen === isSubjectsChatOpen) return;

    const floatingNode = subjectsChatFloatingRef.current;
    const previousRect = floatingNode?.getBoundingClientRect() || null;

    setIsSubjectsChatOpen(nextOpen);

    if (!previousRect) return;

    window.requestAnimationFrame(() => {
      const updatedNode = subjectsChatFloatingRef.current;
      if (!updatedNode) return;
      const nextRect = updatedNode.getBoundingClientRect();

      setSubjectsChatPosition((previous) => {
        const base = previous || { x: previousRect.left, y: previousRect.top };
        return clampSubjectsChatPosition(
          base.x + (previousRect.width - nextRect.width),
          base.y + (previousRect.height - nextRect.height)
        );
      });
    });
  };

  const startSubjectsChatDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const floatingNode = subjectsChatFloatingRef.current;
    if (!floatingNode) return;

    const rect = floatingNode.getBoundingClientRect();
    const initialPosition = subjectsChatPosition || { x: rect.left, y: rect.top };

    if (!subjectsChatPosition) {
      setSubjectsChatPosition(initialPosition);
    }

    subjectsChatDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: initialPosition.x,
      originY: initialPosition.y,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!subjectsChatDragStateRef.current) return;
      const nextX = subjectsChatDragStateRef.current.originX + (moveEvent.clientX - subjectsChatDragStateRef.current.startX);
      const nextY = subjectsChatDragStateRef.current.originY + (moveEvent.clientY - subjectsChatDragStateRef.current.startY);
      setSubjectsChatPosition(clampSubjectsChatPosition(nextX, nextY));
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      subjectsChatDragStateRef.current = null;
      subjectsChatDragCleanupRef.current = null;
    };

    const handlePointerEnd = () => {
      cleanup();
    };

    if (subjectsChatDragCleanupRef.current) {
      subjectsChatDragCleanupRef.current();
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    subjectsChatDragCleanupRef.current = cleanup;
  };

  useEffect(() => {
    if (!subjectsChatPosition) return;

    const keepSubjectsChatInViewport = () => {
      setSubjectsChatPosition((previous) => {
        if (!previous) return previous;
        const clamped = clampSubjectsChatPosition(previous.x, previous.y);
        if (clamped.x === previous.x && clamped.y === previous.y) return previous;
        return clamped;
      });
    };

    const frameId = window.requestAnimationFrame(keepSubjectsChatInViewport);
    const handleResize = () => window.requestAnimationFrame(keepSubjectsChatInViewport);
    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isSubjectsChatOpen, subjectsChatPosition?.x, subjectsChatPosition?.y]);

  const openUnitChallenge = () => {
    setIsSidebarCollapsed(false);
    setIsSubjectOverviewActive(false);
    setSubjectChallengeState(null);
    setUnitChallengeStep(1);
    setDetailState(null);
    setUnitChallengeState({
      unitId: selectedUnit.id,
      stage: 'intro',
      summary: null,
    });
  };

  const startUnitChallenge = () => {
    if (!selectedUnitChallengeConfig.questions.length || !selectedUnitChallengeConfig.sessionId) {
      updateUnitChallengeConfig((current) => ({
        ...current,
        error: 'Prepare challenge questions before you start.',
      }));
      return;
    }
    setUnitChallengeState({
      unitId: selectedUnit.id,
      stage: 'running',
      summary: null,
    });
    setUnitChallengeStep(2);
  };

  const exitUnitChallenge = () => {
    setUnitChallengeState(null);
  };

  const completeUnitChallenge = (summary: PracticeRunSummary) => {
    setUnitChallengeState({
      unitId: selectedUnit.id,
      stage: 'completed',
      summary,
    });
    setUnitChallengeStep(2);
  };

  const openSubjectChallenge = () => {
    if (!isSubjectChallengeEligible) {
      updateSubjectChallengeConfig((current) => ({
        ...current,
        error: subjectChallengeBlockedReason || 'Subject challenge is currently unavailable.',
      }));
      setIsSubjectOverviewActive(true);
      return;
    }
    setIsSidebarCollapsed(false);
    setDetailState(null);
    setUnitChallengeState(null);
    setIsSubjectOverviewActive(true);
    setSubjectChallengeStep(1);
    setSubjectChallengeState({
      stage: 'intro',
      summary: null,
    });
  };

  const startSubjectChallenge = () => {
    if (!isSubjectChallengeEligible) {
      updateSubjectChallengeConfig((current) => ({
        ...current,
        error: subjectChallengeBlockedReason || 'Subject challenge is currently unavailable.',
      }));
      return;
    }
    if (!selectedSubjectChallengeConfig.questions.length || !selectedSubjectChallengeConfig.sessionId) {
      updateSubjectChallengeConfig((current) => ({
        ...current,
        error: 'Prepare challenge questions before you start.',
      }));
      return;
    }
    setSubjectChallengeState({
      stage: 'running',
      summary: null,
    });
    setSubjectChallengeStep(2);
  };

  const exitSubjectChallenge = () => {
    setSubjectChallengeState(null);
  };

  const completeSubjectChallenge = (summary: PracticeRunSummary) => {
    setSubjectChallengeState({
      stage: 'completed',
      summary,
    });
    setSubjectChallengeStep(2);
  };

  const openUnitChallengeStep = (step: 1 | 2) => {
    if (isUnitChallengeRunning) return;
    if (step === 2 && (selectedUnitChallengeConfig.questions.length === 0 || !selectedUnitChallengeConfig.sessionId)) {
      updateUnitChallengeConfig((current) => ({
        ...current,
        error: 'Prepare challenge questions in Step 1 before attempting Step 2.',
      }));
      return;
    }
    setUnitChallengeStep(step);
  };

  const openSubjectChallengeStep = (step: 1 | 2) => {
    if (isSubjectChallengeRunning) return;
    if (step === 2 && (selectedSubjectChallengeConfig.questions.length === 0 || !selectedSubjectChallengeConfig.sessionId)) {
      updateSubjectChallengeConfig((current) => ({
        ...current,
        error: 'Prepare challenge questions in Step 1 before attempting Step 2.',
      }));
      return;
    }
    setSubjectChallengeStep(step);
  };

  const detailUnit = detailState ? units.find((unit) => unit.id === detailState.unitId) || null : null;
  const detailTopic = detailUnit
    ? detailUnit.topics.find((topic) => topic.id === detailState?.topicId) || null
    : null;
  const detailItems = detailTopic ? getTopicContentItems(detailTopic) : [];
  const selectedDetailItem =
    detailItems.find((item) => item.id === detailState?.contentItemId) || detailItems[0] || null;
  const selectedDetailResourceId =
    selectedDetailItem?.kind === 'learn'
      ? selectedDetailItem.resource?.id || null
      : selectedDetailItem?.kind === 'assessment'
        ? selectedDetailItem.assessment?.resourceId || selectedDetailItem.assessment?.id || null
        : null;
  const isDetailPracticeView = Boolean(
    selectedDetailItem &&
    selectedDetailItem.kind === 'practice' &&
    selectedDetailItem.practice
  );
  const detailPracticeQuestions = useMemo(
    () => (detailPracticeSession?.questions || []).map(mapPracticeQuestionFromSession),
    [detailPracticeSession?.questions]
  );
  const selectedDetailItemIndex = selectedDetailItem
    ? detailItems.findIndex((item) => item.id === selectedDetailItem.id)
    : -1;
  const nextDetailItem =
    selectedDetailItemIndex >= 0 && selectedDetailItemIndex < detailItems.length - 1
      ? detailItems[selectedDetailItemIndex + 1]
      : null;
  const selectedResourceBody = selectedDetailResourceId ? resourceBodyById[selectedDetailResourceId] : null;
  const selectedResourceBodyLoading = selectedDetailResourceId ? Boolean(resourceBodyLoadingById[selectedDetailResourceId]) : false;
  const selectedResourceBodyError = selectedDetailResourceId ? resourceBodyErrorById[selectedDetailResourceId] || null : null;
  const normalizedSelectedResourceBody = selectedResourceBody ? decodeHtmlEntities(selectedResourceBody).trim() : '';
  const selectedResourceBodyHasHtml = looksLikeHtml(normalizedSelectedResourceBody);
  const selectedAssessmentQuestions = useMemo(
    () => extractPracticeQuestionsFromContentBody(selectedResourceBody || ''),
    [selectedResourceBody]
  );

  useEffect(() => {
    const loadSelectedResourceBody = async () => {
      if (!selectedDetailResourceId) return;
      if (resourceBodyById[selectedDetailResourceId] !== undefined) return;
      if (resourceBodyLoadingById[selectedDetailResourceId]) return;

      try {
        setResourceBodyLoadingById((previous) => ({ ...previous, [selectedDetailResourceId]: true }));
        setResourceBodyErrorById((previous) => {
          if (!previous[selectedDetailResourceId]) return previous;
          const next = { ...previous };
          delete next[selectedDetailResourceId];
          return next;
        });
        const resource = await resourceService.get(selectedDetailResourceId);
        setResourceBodyById((previous) => ({
          ...previous,
          [selectedDetailResourceId]: typeof resource.contentBody === 'string' ? resource.contentBody : '',
        }));
      } catch (error: any) {
        setResourceBodyErrorById((previous) => ({
          ...previous,
          [selectedDetailResourceId]: error?.message || 'Failed to load content.',
        }));
      } finally {
        setResourceBodyLoadingById((previous) => ({ ...previous, [selectedDetailResourceId]: false }));
      }
    };

    void loadSelectedResourceBody();
  }, [selectedDetailResourceId, resourceBodyById, resourceBodyLoadingById]);

  useEffect(() => {
    const loadDetailPracticeSession = async () => {
      if (!activeSubject || !detailTopic || !selectedDetailItem || selectedDetailItem.kind !== 'practice' || !selectedDetailItem.practice) {
        setDetailPracticeSession(null);
        setDetailPracticeLoading(false);
        setDetailPracticeError(null);
        return;
      }

      const requestedQuestionCount = Math.max(
        0,
        Math.min(40, Number(selectedDetailItem.practice.questionCount || detailTopic.questionCount || 0))
      );
      if (requestedQuestionCount <= 0) {
        setDetailPracticeSession(null);
        setDetailPracticeLoading(false);
        setDetailPracticeError('No published questions are available for this practice session.');
        return;
      }

      try {
        setDetailPracticeLoading(true);
        setDetailPracticeError(null);
        const session = await studentService.startPracticeSession(studentId, activeSubject.id, {
          topicId: detailTopic.id,
          questionCount: requestedQuestionCount,
          mode: 'topic_practice',
          title: selectedDetailItem.practice.title,
        });
        setDetailPracticeSession(session);
      } catch (error: any) {
        setDetailPracticeSession(null);
        setDetailPracticeError(error?.message || 'Failed to start practice session.');
      } finally {
        setDetailPracticeLoading(false);
      }
    };

    void loadDetailPracticeSession();
  }, [
    studentId,
    activeSubject,
    detailTopic,
    selectedDetailItem?.id,
    selectedDetailItem?.kind,
  ]);

  if (!activeSubject) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        Select a subject to load curriculum.
      </div>
    );
  }

  if (isCurriculumLoading) {
    return (
      <div className="bg-white rounded-xl overflow-hidden">
        <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-r border-slate-200 bg-slate-50 min-h-[760px] p-4 space-y-3">
            <div className="rounded-md border border-slate-200 bg-white p-4 space-y-3">
              <div className="h-10 w-10 rounded-lg bg-slate-200 animate-pulse" />
              <div className="h-4 w-3/4 rounded-md bg-slate-200 animate-pulse" />
              <div className="h-3 w-1/2 rounded-md bg-slate-200 animate-pulse" />
              <div className="h-1.5 w-full rounded-full bg-slate-200 animate-pulse" />
            </div>

            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="rounded-md border border-slate-200 bg-white p-3 space-y-2">
                <div className="h-3 w-16 rounded-md bg-slate-200 animate-pulse" />
                <div className="h-4 w-5/6 rounded-md bg-slate-200 animate-pulse" />
                <div className="h-3 w-20 rounded-md bg-slate-200 animate-pulse" />
              </div>
            ))}
          </aside>

          <section className="min-w-0 border border-slate-200 bg-white">
            <header className="px-6 py-5 border-b border-slate-200 space-y-4">
              <div className="h-8 w-2/3 rounded-md bg-slate-200 animate-pulse" />
              <div className="h-4 w-4/5 rounded-md bg-slate-200 animate-pulse" />
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
                    <div className="h-3 w-20 rounded-md bg-slate-200 animate-pulse" />
                    <div className="h-5 w-24 rounded-md bg-slate-200 animate-pulse" />
                  </div>
                ))}
              </div>
            </header>

            <div className="p-6 pb-28 space-y-4">
              {Array.from({ length: 2 }).map((_, sectionIndex) => (
                <section key={sectionIndex} className="border border-slate-200 rounded-lg p-5 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="h-7 w-2/5 rounded-md bg-slate-200 animate-pulse" />
                    <div className="h-7 w-28 rounded-md bg-slate-200 animate-pulse" />
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded-md bg-slate-200 animate-pulse" />
                      {Array.from({ length: 2 }).map((__, rowIndex) => (
                        <div key={rowIndex} className="h-10 w-full rounded-md bg-slate-200 animate-pulse" />
                      ))}
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 w-20 rounded-md bg-slate-200 animate-pulse" />
                      {Array.from({ length: 2 }).map((__, rowIndex) => (
                        <div key={rowIndex} className="h-16 w-full rounded-md bg-slate-200 animate-pulse" />
                      ))}
                    </div>
                  </div>
                </section>
              ))}

              <section className="border border-slate-200 rounded-lg p-5 bg-slate-50 space-y-3">
                <div className="h-5 w-40 rounded-md bg-slate-200 animate-pulse" />
                <div className="h-4 w-3/5 rounded-md bg-slate-200 animate-pulse" />
                <div className="h-9 w-44 rounded-md bg-slate-200 animate-pulse" />
              </section>
            </div>
          </section>
        </div>
      </div>
    );
  }

  if (units.length === 0 || !selectedUnit) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
        No curriculum topics available yet.
      </div>
    );
  }

  return (
    <motion.div
      className="bg-white rounded-xl overflow-visible"
      style={{
        ['--subjects-footer-left' as string]: `calc(${desktopContainerInset} + ${desktopSidebarWidthPx}px)`,
        ['--subjects-footer-right' as string]: desktopContainerInset,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {detailUnit && detailTopic && selectedDetailItem ? (
        <>
          <div className="grid grid-cols-1">
            <aside className={`relative border-r border-slate-200 bg-slate-50 flex flex-col min-h-[760px] xl:fixed xl:top-[calc(var(--student-header-offset)+0.75rem)] xl:left-[max(1rem,calc((100vw-1400px)/2+1rem))] xl:h-auto xl:max-h-[calc(100vh-var(--student-header-offset)-1.5rem)] xl:min-h-0 xl:z-20 xl:overflow-visible xl:will-change-[width] xl:transition-[width] xl:duration-300 xl:ease-in-out ${sidebarDesktopWidth}`}>
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="hidden xl:inline-flex absolute top-1/2 -translate-y-1/2 -right-4 z-30 h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                aria-label={isSidebarCollapsed ? 'Expand topics panel' : 'Collapse topics panel'}
              >
                {isSidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
              </button>

              <div className="border-b border-slate-200 px-5 py-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setDetailState(null)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to topic overview
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div
                    className={`min-w-0 overflow-hidden transition-[max-width,max-height,opacity,transform] duration-200 ease-out ${
                      isSidebarCollapsed ? 'max-w-0 max-h-0 opacity-0 -translate-x-1' : 'max-w-[240px] max-h-20 opacity-100 translate-x-0'
                    }`}
                  >
                    <h2 className="text-lg font-bold text-slate-900 truncate">{activeSubject.name}</h2>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{detailUnit.code}: {detailTopic.title}</p>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {detailItems.map((item, index) => {
                  const isSelected = selectedDetailItem.id === item.id;
                  const practiceStatus = item.practice ? getPracticeStatus(item.practice) : null;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDetailState((previous) => (previous ? { ...previous, contentItemId: item.id } : previous))}
                      title={item.title}
                      className={`w-full border-b border-slate-200 transition ${
                        isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-3' : 'hover:bg-slate-100'
                      } ${isSidebarCollapsed ? 'px-2 py-3 min-h-[72px] flex items-center justify-center' : 'px-4 py-3 text-left min-h-[78px]'}`}
                    >
                      {isSidebarCollapsed ? (
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                          {index + 1}
                        </span>
                      ) : (
                        <div>
                          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Item {index + 1}</p>
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.title}</p>
                          <p className="text-xs text-slate-500 mt-0.5 capitalize">
                            {item.kind === 'practice'
                              ? `${practiceStatus || 'not-started'} • quiz`
                              : item.kind === 'assessment'
                                ? `${item.assessment?.status || 'published'} • practice`
                                : `${item.resource?.type || 'notes'} • learn`}
                          </p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className={`min-w-0 rounded-none border border-slate-200 bg-white overflow-hidden xl:will-change-[margin] xl:transition-[margin] xl:duration-300 xl:ease-in-out ${contentDesktopOffset} flex flex-col min-h-[calc(100vh-var(--student-header-offset)-1.5rem)]`}>
              <header className="px-6 py-5 border-b border-slate-200">
                <h1 className="text-3xl font-bold text-slate-900">{selectedDetailItem.title}</h1>
                <p className="text-sm text-slate-500 mt-1">{detailUnit.code}: {detailTopic.title}</p>
              </header>

              <div className={isDetailPracticeView ? 'p-0' : 'flex-1 p-6 pb-6 space-y-6'}>
                {selectedDetailItem.kind === 'practice' && selectedDetailItem.practice ? (
                  detailPracticeLoading ? (
                    <div className="px-6 py-6 pb-8">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Loading practice session...
                      </div>
                    </div>
                  ) : detailPracticeError ? (
                    <div className="px-6 py-6 pb-8">
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {detailPracticeError}
                      </div>
                    </div>
                  ) : detailPracticeSession && detailPracticeQuestions.length > 0 ? (
                    <StudentPracticeRunner
                      key={detailPracticeSession.sessionId}
                      title={selectedDetailItem.practice.title}
                      subtitle="Practice questions run on a dedicated screen and are answered one by one."
                      questions={detailPracticeQuestions}
                      contentWrapperClassName="px-6 py-6 pb-8 space-y-6 md:pb-12"
                      fixedFooterStyle={{
                        left: 'var(--subjects-footer-left)',
                        right: 'var(--subjects-footer-right)',
                        bottom: '0.75rem',
                      }}
                      onSubmitAnswer={async ({ question, studentAnswerText, selectedOptions, skipped }) => {
                        const result = await studentService.submitPracticeAnswer(studentId, detailPracticeSession.sessionId, {
                          assessmentQuestionId: question.id,
                          studentAnswerText,
                          selectedOptions,
                          skipped,
                        });
                        return {
                          correct: result.correct,
                          skipped: result.skipped,
                          completed: result.completed,
                          feedback: result.feedback || null,
                        };
                      }}
                      onCompleteSession={async () => {
                        await studentService.completePracticeSession(studentId, detailPracticeSession.sessionId);
                      }}
                      onComplete={async () => {
                        setPracticeStatusOverrides((previous) => ({
                          ...previous,
                          [selectedDetailItem.practice!.id]: 'mastered',
                        }));
                      }}
                    />
                  ) : (
                    <div className="px-6 py-6 pb-8">
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                        No practice questions are available for this topic yet.
                      </div>
                    </div>
                  )
                ) : selectedDetailItem.kind === 'assessment' && selectedDetailItem.assessment ? (
                  <section className="space-y-6 max-w-4xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-amber-100 text-amber-700">
                        <FileText className="w-4 h-4" />
                        Practice
                      </span>
                      <span className="text-xs text-slate-500 capitalize">
                        Status: {selectedDetailItem.assessment.status || 'published'}
                      </span>
                    </div>

                    {selectedResourceBodyLoading ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Loading content...
                      </div>
                    ) : selectedResourceBodyError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {selectedResourceBodyError}
                      </div>
                    ) : selectedAssessmentQuestions.length > 0 ? (
                      <ol className="rounded-lg bg-white p-5 list-decimal pl-6 space-y-3 text-slate-800 leading-relaxed">
                        {selectedAssessmentQuestions.map((question, index) => (
                          <li key={`${selectedDetailItem.assessment?.id || 'assessment'}-${index}`}>
                            {question}
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                        No published questions are available for this practice yet.
                      </div>
                    )}
                  </section>
                ) : (
                  <section className="space-y-6">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${getResourceBadgeClassName(selectedDetailItem.resource?.type || 'notes')}`}>
                        {selectedDetailItem.resource?.type === 'video' ? <PlayCircle className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        <span className="capitalize">{selectedDetailItem.resource?.type || 'notes'}</span>
                      </span>
                      <span className="text-xs text-slate-500">Learning material</span>
                    </div>

                    {selectedDetailItem.resource?.type === 'video' && (
                      <div className="aspect-video w-full max-w-4xl rounded-lg border border-slate-200 bg-slate-900 text-white flex items-center justify-center">
                        <div className="text-center">
                          <PlayCircle className="w-10 h-10 mx-auto mb-2 text-blue-300" />
                          <p className="text-sm font-medium">{selectedDetailItem.title}</p>
                        </div>
                      </div>
                    )}

                    {selectedResourceBodyLoading ? (
                      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                        Loading content...
                      </div>
                    ) : selectedResourceBodyError ? (
                      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                        {selectedResourceBodyError}
                      </div>
                    ) : normalizedSelectedResourceBody ? (
                      selectedResourceBodyHasHtml ? (
                        <article
                          className="rounded-lg bg-white p-5 text-slate-800 leading-relaxed space-y-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6"
                          dangerouslySetInnerHTML={{ __html: normalizedSelectedResourceBody }}
                        />
                      ) : (
                        <article className="rounded-lg bg-white p-5 text-slate-800 leading-relaxed whitespace-pre-wrap">
                          {normalizedSelectedResourceBody}
                        </article>
                      )
                    ) : (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                        No published content body is available for this resource yet.
                      </div>
                    )}
                  </section>
                )}
              </div>
            </section>
          </div>

          {selectedDetailItem.kind !== 'practice' && (
            <>
              <div
                className="hidden xl:block fixed bottom-0 z-30"
                style={{
                  left: 'calc(var(--subjects-footer-left) - 1px)',
                  right: 'calc(var(--subjects-footer-right) - 1px)',
                }}
              >
                <footer className="box-border border border-b-0 border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_16px_-12px_rgba(15,23,42,0.35)]">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!nextDetailItem) return;
                        setDetailState((previous) =>
                          previous ? { ...previous, contentItemId: nextDetailItem.id } : previous
                        );
                      }}
                      disabled={!nextDetailItem}
                      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                      {nextDetailItem ? `Up next: ${getUpNextLabelForContentItem(nextDetailItem)}` : 'Topic complete'}
                    </button>
                  </div>
                </footer>
              </div>

              <div className="xl:hidden border-t border-slate-200 bg-white px-6 py-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (!nextDetailItem) return;
                      setDetailState((previous) =>
                        previous ? { ...previous, contentItemId: nextDetailItem.id } : previous
                      );
                    }}
                    disabled={!nextDetailItem}
                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    {nextDetailItem ? `Up next: ${getUpNextLabelForContentItem(nextDetailItem)}` : 'Topic complete'}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1">
            <aside className={`relative border-r border-slate-200 bg-slate-50 flex flex-col min-h-[760px] xl:fixed xl:top-[calc(var(--student-header-offset)+0.75rem)] xl:left-[max(1rem,calc((100vw-1400px)/2+1rem))] xl:h-auto xl:max-h-[calc(100vh-var(--student-header-offset)-1.5rem)] xl:min-h-0 xl:z-20 xl:overflow-visible xl:will-change-[width] xl:transition-[width] xl:duration-300 xl:ease-in-out ${sidebarDesktopWidth}`}>
              {!isUnitChallengeActive && !isSubjectChallengeActive && (
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className="hidden xl:inline-flex absolute top-1/2 -translate-y-1/2 -right-4 z-30 h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
                  aria-label={isSidebarCollapsed ? 'Expand topics panel' : 'Collapse topics panel'}
                >
                  {isSidebarCollapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
                </button>
              )}

              {isUnitChallengeActive ? (
                <>
                  <div className="border-b border-slate-200 px-5 py-4 space-y-3">
                    <button
                      type="button"
                      onClick={exitUnitChallenge}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to topic page
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-slate-900 truncate">Topic test</h2>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{selectedUnit.code}: {selectedUnit.title}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => openUnitChallengeStep(1)}
                        className={`w-full border-b border-slate-200 px-3 py-2 text-left transition ${
                          activeUnitChallengeStep === 1 ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-2' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Step 1</p>
                        <p className="text-sm font-semibold text-slate-800">Generate challenge</p>
                        <p className="text-xs text-slate-500">Choose question count and prepare challenge.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => openUnitChallengeStep(2)}
                        className={`w-full px-3 py-2 text-left transition ${
                          activeUnitChallengeStep === 2 ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-2' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Step 2</p>
                        <p className="text-sm font-semibold text-slate-800">Attempt challenge</p>
                        <p className="text-xs text-slate-500">
                          {isUnitChallengeRunning
                            ? 'In progress'
                            : activeUnitChallenge?.stage === 'completed'
                              ? 'Completed'
                              : selectedUnitChallengeConfig.questions.length > 0
                                ? 'Ready'
                                : 'Locked until generated'}
                        </p>
                      </button>
                    </div>
                  </div>
                </>
              ) : isSubjectChallengeActive ? (
                <>
                  <div className="border-b border-slate-200 px-5 py-4 space-y-3">
                    <button
                      type="button"
                      onClick={exitSubjectChallenge}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-blue-700"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to subject overview
                    </button>

                    <div className="flex items-center gap-3">
                      <div className="min-w-0">
                        <h2 className="text-xl font-bold text-slate-900 truncate">Subject challenge</h2>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{activeSubject.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <div className="rounded-md border border-slate-200 bg-white overflow-hidden">
                      <button
                        type="button"
                        onClick={() => openSubjectChallengeStep(1)}
                        className={`w-full border-b border-slate-200 px-3 py-2 text-left transition ${
                          activeSubjectChallengeStep === 1 ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-2' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Step 1</p>
                        <p className="text-sm font-semibold text-slate-800">Generate challenge</p>
                        <p className="text-xs text-slate-500">Choose question count and prepare challenge.</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => openSubjectChallengeStep(2)}
                        className={`w-full px-3 py-2 text-left transition ${
                          activeSubjectChallengeStep === 2 ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-2' : 'hover:bg-slate-50'
                        }`}
                      >
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Step 2</p>
                        <p className="text-sm font-semibold text-slate-800">Attempt challenge</p>
                        <p className="text-xs text-slate-500">
                          {isSubjectChallengeRunning
                            ? 'In progress'
                            : subjectChallengeState?.stage === 'completed'
                              ? 'Completed'
                              : selectedSubjectChallengeConfig.questions.length > 0
                                ? 'Ready'
                                : 'Locked until generated'}
                        </p>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`border-b border-slate-200 px-5 py-4 ${
                    isSubjectOverviewActive ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-3' : ''
                  }`}>
                    <button
                      type="button"
                      onClick={openSubjectOverview}
                      className="w-full text-left"
                      title={`Open ${activeSubject.name} overview`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <BookOpen className="w-5 h-5" />
                        </div>
                        <div
                          className={`min-w-0 overflow-hidden transition-[max-width,max-height,opacity,transform] duration-200 ease-out ${
                            isSidebarCollapsed ? 'max-w-0 max-h-0 opacity-0 -translate-x-1' : 'max-w-[240px] max-h-16 opacity-100 translate-x-0'
                          }`}
                        >
                          <h2 className="text-xl font-bold text-slate-900 truncate">{activeSubject.name}</h2>
                          <p className="text-xs text-slate-500 mt-0.5">{allTopics.length} topics in curriculum</p>
                        </div>
                      </div>
                    </button>
                    <div className={`mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden transition-opacity duration-200 ${isSidebarCollapsed ? 'opacity-0' : 'opacity-100'}`}>
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${Math.max(0, Math.min(100, overallCoverage))}%` }} />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    {units.map((unit, index) => {
                      const isSelected = !isSubjectOverviewActive && selectedUnit.id === unit.id;
                      return (
                        <button
                          key={unit.id}
                          type="button"
                          onClick={() => openUnitPage(unit)}
                          title={`${unit.code}: ${unit.title}`}
                          className={`w-full border-b border-slate-200 transition ${
                            isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-3' : 'hover:bg-slate-100'
                          } ${isSidebarCollapsed ? 'px-2 py-3 min-h-[72px] flex items-center justify-center' : 'px-4 py-3 text-left min-h-[84px]'}`}
                        >
                          {isSidebarCollapsed ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                              {index + 1}
                            </span>
                          ) : (
                            <div>
                              <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">{unit.code}</p>
                              <p className="text-sm font-semibold text-slate-800 truncate">{unit.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{unit.masteryPercent}% mastery</p>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

            </aside>

            <section className={`min-w-0 rounded-none border border-slate-200 bg-white overflow-hidden xl:will-change-[margin] xl:transition-[margin] xl:duration-300 xl:ease-in-out ${contentDesktopOffset} flex flex-col ${
              isUnitChallengeActive || isSubjectChallengeActive || !isSubjectOverviewActive
                ? 'min-h-[calc(100vh-var(--student-header-offset)-1.5rem)]'
                : ''
            }`}>
              {!isUnitChallengeActive && !isSubjectChallengeActive && !isSubjectOverviewActive && (
                <header className="px-6 py-5 border-b border-slate-200">
                  <h1 className="text-3xl font-bold text-slate-900">{selectedUnit.code}: {selectedUnit.title}</h1>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-[11px] uppercase font-semibold tracking-wide text-emerald-700">Mastered</p>
                      <p className="text-lg font-semibold text-emerald-800">{masteredTopics} topics</p>
                    </div>
                    <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                      <p className="text-[11px] uppercase font-semibold tracking-wide text-blue-700">In Progress</p>
                      <p className="text-lg font-semibold text-blue-800">{inProgressTopics} topics</p>
                    </div>
                  </div>
                </header>
              )}

              {isSubjectChallengeActive ? (
                activeSubjectChallengeStep === 1 && !isSubjectChallengeRunning ? (
                  <div className="p-6 pb-24 space-y-4">
                    <div className="rounded-md border border-slate-200 bg-white p-3 space-y-3">
                      <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Challenge builder</p>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Questions</label>
                        <input
                          type="number"
                          min={6}
                          max={40}
                          value={selectedSubjectChallengeConfig.questionCount}
                          onChange={(event) => {
                            const parsed = Number.parseInt(event.target.value, 10);
                            const nextCount = Number.isNaN(parsed) ? DEFAULT_SUBJECT_CHALLENGE_COUNT : Math.max(6, Math.min(40, parsed));
                            updateSubjectChallengeConfig((current) => ({ ...current, questionCount: nextCount }));
                          }}
                          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={generateSubjectChallengeWithAi}
                        disabled={selectedSubjectChallengeConfig.isGenerating || !isSubjectChallengeEligible}
                        className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        {selectedSubjectChallengeConfig.isGenerating ? 'Preparing...' : 'Prepare challenge'}
                      </button>
                      {!isSubjectChallengeEligible && (
                        <p className="text-xs text-amber-700">
                          {subjectChallengeBlockedReason}
                        </p>
                      )}
                      {selectedSubjectChallengeConfig.questions.length > 0 && (
                        <p className="text-xs text-emerald-700">
                          {selectedSubjectChallengeConfig.questions.length} questions ready.
                        </p>
                      )}
                      {selectedSubjectChallengeConfig.error && (
                        <p className="text-xs text-amber-700">{selectedSubjectChallengeConfig.error}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={isSubjectChallengeRunning ? '' : 'p-6 pb-24'}>
                    {subjectChallengeState?.stage === 'running' ? (
                      <StudentPracticeRunner
                        title={`${activeSubject.name} subject challenge`}
                        subtitle="Subject challenge"
                        questions={selectedSubjectChallengeConfig.questions}
                        contentWrapperClassName="px-6 py-6 pb-8 space-y-6 md:pb-12"
                        fixedFooterStyle={{
                          left: 'var(--subjects-footer-left)',
                          right: 'var(--subjects-footer-right)',
                          bottom: '0.75rem',
                        }}
                        onSubmitAnswer={async ({ question, studentAnswerText, selectedOptions, skipped }) => {
                          const sessionId = selectedSubjectChallengeConfig.sessionId;
                          if (!sessionId) {
                            throw new Error('Challenge session is unavailable.');
                          }
                          const result = await studentService.submitPracticeAnswer(studentId, sessionId, {
                            assessmentQuestionId: question.id,
                            studentAnswerText,
                            selectedOptions,
                            skipped,
                          });
                          return {
                            correct: result.correct,
                            skipped: result.skipped,
                            completed: result.completed,
                            feedback: result.feedback || null,
                          };
                        }}
                        onCompleteSession={async () => {
                          const sessionId = selectedSubjectChallengeConfig.sessionId;
                          if (!sessionId) return;
                          await studentService.completePracticeSession(studentId, sessionId);
                        }}
                        onComplete={completeSubjectChallenge}
                      />
                    ) : (
                      <section className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="bg-slate-900 px-6 py-10 text-center text-white">
                          <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Step 2 of 2</p>
                          <h3 className="mt-3 text-4xl font-bold">Attempt subject challenge</h3>
                          <p className="mt-3 text-lg text-blue-100">
                            {!isSubjectChallengeEligible
                              ? `${subjectChallengeBlockedReason}`
                              : selectedSubjectChallengeConfig.questions.length > 0
                              ? `Your challenge is ready. Test your skills across all topics in ${activeSubject.name}.`
                              : `Return to Step 1 and prepare questions first.`}
                          </p>
                          <p className="mt-4 text-xl font-semibold">
                            {subjectChallengeQuestionTotal} questions • {subjectChallengeEstimatedMinutes}-{subjectChallengeEstimatedMinutes + 5} minutes
                          </p>
                        </div>
                      </section>
                    )}
                  </div>
                )
              ) : isSubjectOverviewActive && !isUnitChallengeActive ? (
                <div className="p-6 pb-10 space-y-4">
                  <section className="rounded-lg border border-slate-200 bg-slate-50 px-5 py-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Subject overview</p>
                    <h1 className="mt-2 text-3xl font-bold text-slate-900">{activeSubject.name}</h1>
                    <p className="mt-2 text-sm text-slate-600">
                      Browse all topics. Click a topic for the in-depth topic page and jump directly into activities.
                    </p>
                  </section>

                  {units.map((unit) => {
                    const isCurrentUnit = selectedUnit.id === unit.id;
                    return (
                      <section
                        key={unit.id}
                        className={`rounded-lg border p-5 ${
                          isCurrentUnit ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
                          <button
                            type="button"
                            onClick={() => openUnitPage(unit)}
                            className="text-left text-2xl font-semibold text-slate-900 hover:text-blue-700"
                          >
                            {unit.code}: {unit.title}
                          </button>
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                            <Target className="h-3.5 w-3.5" />
                            Topic mastery: {unit.masteryPercent}%
                          </span>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-x-10 gap-y-2 lg:grid-cols-2">
                          {unit.topics.map((topic) => (
                            <button
                              key={topic.id}
                              type="button"
                              onClick={() => openTopicDetail(unit, topic)}
                              className="inline-flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-base text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                            >
                              <span className="truncate">{topic.title}</span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
                            </button>
                          ))}
                        </div>
                      </section>
                    );
                  })}

                  <section className="rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <div className="flex items-center text-slate-700 font-semibold">
                      Subject challenge
                    </div>
                    <p className="text-sm text-slate-600 mt-2">Take one challenge that spans all units in this subject.</p>
                    {!isSubjectChallengeEligible && (
                      <p className="mt-2 text-xs text-amber-700">{subjectChallengeBlockedReason}</p>
                    )}
                    <button
                      type="button"
                      onClick={openSubjectChallenge}
                      disabled={!isSubjectChallengeEligible}
                      className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ChevronRight className="w-4 h-4" />
                      Start subject challenge
                    </button>
                  </section>
                </div>
              ) : (
                <div className={isUnitChallengeActive ? (isUnitChallengeRunning ? '' : 'flex-1 p-6 pb-24') : 'flex-1 p-6 pb-28 flex flex-col'}>
                  {isUnitChallengeActive ? (
                    activeUnitChallengeStep === 1 && !isUnitChallengeRunning ? (
                      <div className="space-y-4">
                        <div className="rounded-md border border-slate-200 bg-white p-3 space-y-3">
                          <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Challenge builder</p>
                          <div>
                            <label className="text-xs font-semibold text-slate-600">Questions</label>
                            <input
                              type="number"
                              min={4}
                              max={30}
                              value={selectedUnitChallengeConfig.questionCount}
                              onChange={(event) => {
                                const parsed = Number.parseInt(event.target.value, 10);
                                const nextCount = Number.isNaN(parsed) ? DEFAULT_UNIT_CHALLENGE_COUNT : Math.max(4, Math.min(30, parsed));
                                updateUnitChallengeConfig((current) => ({ ...current, questionCount: nextCount }));
                              }}
                              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm text-slate-700"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={generateUnitChallengeWithAi}
                            disabled={selectedUnitChallengeConfig.isGenerating}
                            className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                          >
                            {selectedUnitChallengeConfig.isGenerating ? 'Preparing...' : 'Prepare challenge'}
                          </button>
                          {selectedUnitChallengeConfig.questions.length > 0 && (
                            <p className="text-xs text-emerald-700">
                              {selectedUnitChallengeConfig.questions.length} questions ready.
                            </p>
                          )}
                          {selectedUnitChallengeConfig.error && (
                            <p className="text-xs text-amber-700">{selectedUnitChallengeConfig.error}</p>
                          )}
                        </div>
                      </div>
                    ) : activeUnitChallenge?.stage === 'running' ? (
                      <StudentPracticeRunner
                        title={`${selectedUnit.code}: ${selectedUnit.title}`}
                        subtitle="Topic challenge"
                        questions={selectedUnitChallengeConfig.questions}
                        contentWrapperClassName="px-6 py-6 pb-8 space-y-6 md:pb-12"
                        fixedFooterStyle={{
                          left: 'var(--subjects-footer-left)',
                          right: 'var(--subjects-footer-right)',
                          bottom: '0.75rem',
                        }}
                        onSubmitAnswer={async ({ question, studentAnswerText, selectedOptions, skipped }) => {
                          const sessionId = selectedUnitChallengeConfig.sessionId;
                          if (!sessionId) {
                            throw new Error('Challenge session is unavailable.');
                          }
                          const result = await studentService.submitPracticeAnswer(studentId, sessionId, {
                            assessmentQuestionId: question.id,
                            studentAnswerText,
                            selectedOptions,
                            skipped,
                          });
                          return {
                            correct: result.correct,
                            skipped: result.skipped,
                            completed: result.completed,
                            feedback: result.feedback || null,
                          };
                        }}
                        onCompleteSession={async () => {
                          const sessionId = selectedUnitChallengeConfig.sessionId;
                          if (!sessionId) return;
                          await studentService.completePracticeSession(studentId, sessionId);
                        }}
                        onComplete={completeUnitChallenge}
                      />
                    ) : (
                      <section className="overflow-hidden rounded-lg border border-slate-200">
                        <div className="bg-slate-900 px-6 py-10 text-center text-white">
                          <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Step 2 of 2</p>
                          <h3 className="mt-3 text-4xl font-bold">Attempt topic challenge</h3>
                          <p className="mt-3 text-lg text-blue-100">
                            {selectedUnitChallengeConfig.questions.length > 0
                              ? 'Your challenge is ready. Test your skills across this topic area.'
                              : 'Return to Step 1 and prepare questions first.'}
                          </p>
                          <p className="mt-4 text-xl font-semibold">
                            {unitChallengeQuestionTotal} questions • {unitChallengeEstimatedMinutes}-{unitChallengeEstimatedMinutes + 5} minutes
                          </p>
                        </div>
                      </section>
                    )
                  ) : (
                    <>
                      <div className="space-y-4">
                        {selectedUnit.topics.map((topic) => {
                        const isTopicCollapsed = Boolean(collapsedTopicIds[topic.id]);
                        const isCriticalTopic =
                          hasTopicBeenAttempted(topic) && topic.masteryPercent < CRITICAL_TOPIC_MASTERY_THRESHOLD;

                        return (
                        <section
                          key={topic.id}
                          className={`border rounded-lg p-5 space-y-4 ${
                            isCriticalTopic ? 'border-red-300 bg-red-50/30' : 'border-slate-200'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => toggleTopicCollapsed(topic.id)}
                              className="text-left text-2xl font-semibold text-slate-900 hover:text-blue-700"
                              aria-expanded={!isTopicCollapsed}
                            >
                              {topic.title}
                            </button>
                            <div className="flex items-center gap-2">
                              {isCriticalTopic && (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md border border-red-200 bg-red-100 text-red-700">
                                  Critical topic
                                </span>
                              )}
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-slate-100 text-slate-700">
                                <Target className="w-3.5 h-3.5" />
                                {topic.masteryPercent}% mastery
                              </span>
                              <button
                                type="button"
                                onClick={() => openTopicDetail(selectedUnit, topic)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                Open topic
                                <ChevronRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {!isTopicCollapsed && (
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Learn</p>
                              <div className="space-y-2">
                                {topic.learn.length > 0 ? topic.learn.map((resource) => (
                                  <button
                                    key={resource.id}
                                    type="button"
                                    onClick={() => openTopicDetail(selectedUnit, topic, `learn-${resource.id}`)}
                                    className="w-full flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      <PlayCircle className="w-4 h-4 text-slate-500 shrink-0" />
                                      <span className="truncate">{resource.title}</span>
                                    </span>
                                    <span className="text-xs text-slate-400 capitalize shrink-0">{resource.type}</span>
                                  </button>
                                )) : (
                                  <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                    No published learning resources yet.
                                  </p>
                                )}
                              </div>
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-slate-700 mb-2">Practice</p>
                              <div className="space-y-2">
                                {topic.practiceMaterials.map((material) => (
                                  <button
                                    key={material.id}
                                    type="button"
                                    onClick={() => openTopicDetail(selectedUnit, topic, `learn-${material.id}`)}
                                    className="w-full flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                                  >
                                    <span className="flex items-center gap-2 min-w-0">
                                      <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                                      <span className="truncate">{material.title}</span>
                                    </span>
                                    <span className="text-xs text-slate-400 shrink-0">teacher material</span>
                                  </button>
                                ))}
                                {topic.practice.map((practice) => {
                                  const practiceStatus = getPracticeStatus(practice);
                                  const isPracticeAvailable = practice.questionCount > 0;
                                  return (
                                  <div key={practice.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3">
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => openPractice(selectedUnit, topic, practice)}
                                        className={`text-left text-sm font-semibold ${
                                          isPracticeAvailable ? 'text-slate-800 hover:text-blue-700' : 'text-slate-500 cursor-not-allowed'
                                        }`}
                                        disabled={!isPracticeAvailable}
                                      >
                                        {practice.title}
                                      </button>
                                      <p className="text-xs text-slate-500 mt-0.5">{practice.target}</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openPractice(selectedUnit, topic, practice)}
                                      disabled={!isPracticeAvailable}
                                      className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                                        !isPracticeAvailable
                                          ? 'border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                                          : practiceStatus === 'mastered'
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : practiceStatus === 'in-progress'
                                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                                            : 'border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                      }`}
                                    >
                                      {isPracticeAvailable ? getPracticeActionLabel(practiceStatus) : 'Unavailable'}
                                    </button>
                                  </div>
                                  );
                                })}
                                {topic.assessments.map((assessment) => (
                                  <div key={assessment.id} className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-start justify-between gap-3">
                                    <div>
                                      <button
                                        type="button"
                                        onClick={() => openTopicDetail(selectedUnit, topic, `assessment-${assessment.id}`)}
                                        className="text-left text-sm font-semibold text-slate-800 hover:text-blue-700"
                                      >
                                        {assessment.title}
                                      </button>
                                      <p className="text-xs text-slate-500 mt-0.5 capitalize">
                                        Published teacher practice • {assessment.status || 'published'}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => openTopicDetail(selectedUnit, topic, `assessment-${assessment.id}`)}
                                      className="text-xs font-semibold px-3 py-1.5 rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                    >
                                      Open
                                    </button>
                                  </div>
                                ))}
                                {topic.practiceMaterials.length === 0 && topic.practice.length === 0 && topic.assessments.length === 0 && (
                                  <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                    No published practice items yet.
                                  </p>
                                )}
                              </div>
                            </div>

                          </div>
                          )}
                        </section>
                      )})}
                      </div>

                      <div className="mt-4 xl:mt-auto border border-slate-200 rounded-lg p-5 bg-slate-50">
                        <div className="flex items-center text-slate-700 font-semibold">
                          Topic challenge
                        </div>
                        <p className="text-sm text-slate-600 mt-2">Test your understanding across this topic area.</p>
                        <button
                          type="button"
                          onClick={openUnitChallenge}
                          className="mt-3 inline-flex items-center gap-2 rounded-md border border-slate-300 bg-white text-slate-700 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
                        >
                          <ChevronRight className="w-4 h-4" />
                          Start topic challenge
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>
          </div>

          {!isUnitChallengeActive && !isSubjectChallengeActive && !isSubjectOverviewActive && (
            <>
              <div
                className="hidden xl:block fixed bottom-0 z-30"
                style={{
                  left: 'calc(var(--subjects-footer-left) - 1px)',
                  right: 'calc(var(--subjects-footer-right) - 1px)',
                }}
              >
                <footer className="box-border border border-b-0 border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_16px_-12px_rgba(15,23,42,0.35)]">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (nextUnit) setSelectedUnitIndex((previous) => Math.min(previous + 1, units.length - 1));
                      }}
                      disabled={!nextUnit}
                      className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                      {nextUnit ? `Up next: ${nextUnit.title.toLowerCase()}` : 'Topic complete'}
                    </button>
                  </div>
                </footer>
              </div>

              <div className="xl:hidden border-t border-slate-200 bg-white px-6 py-4">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (nextUnit) setSelectedUnitIndex((previous) => Math.min(previous + 1, units.length - 1));
                    }}
                    disabled={!nextUnit}
                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    {nextUnit ? `Up next: ${nextUnit.title.toLowerCase()}` : 'Topic complete'}
                  </button>
                </div>
              </div>
            </>
          )}

          {isUnitChallengeActive && !isUnitChallengeRunning && (
            <>
              <div
                className="hidden xl:block fixed bottom-0 z-30"
                style={{
                  left: 'calc(var(--subjects-footer-left) - 1px)',
                  right: 'calc(var(--subjects-footer-right) - 1px)',
                }}
              >
                <footer className="box-border border border-b-0 border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_16px_-12px_rgba(15,23,42,0.35)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {activeUnitChallenge?.stage === 'completed' && activeUnitChallenge.summary ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                        Topic challenge complete: {activeUnitChallenge.summary.correct}/{activeUnitChallenge.summary.total} correct.
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={exitUnitChallenge}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Back to topic
                      </button>
                      <button
                        type="button"
                        onClick={startUnitChallenge}
                        disabled={selectedUnitChallengeConfig.questions.length === 0 || !selectedUnitChallengeConfig.sessionId || selectedUnitChallengeConfig.isGenerating}
                        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                      >
                        {activeUnitChallenge?.stage === 'completed' ? 'Retake challenge' : "Let's go"}
                      </button>
                    </div>
                  </div>
                </footer>
              </div>

              <div className="xl:hidden border-t border-slate-200 bg-white px-6 py-4">
                {activeUnitChallenge?.stage === 'completed' && activeUnitChallenge.summary ? (
                  <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                    Topic challenge complete: {activeUnitChallenge.summary.correct}/{activeUnitChallenge.summary.total} correct.
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={exitUnitChallenge}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to topic
                  </button>
                  <button
                    type="button"
                    onClick={startUnitChallenge}
                    disabled={selectedUnitChallengeConfig.questions.length === 0 || !selectedUnitChallengeConfig.sessionId || selectedUnitChallengeConfig.isGenerating}
                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    {activeUnitChallenge?.stage === 'completed' ? 'Retake challenge' : "Let's go"}
                  </button>
                </div>
              </div>
            </>
          )}

          {isSubjectChallengeActive && !isSubjectChallengeRunning && (
            <>
              <div
                className="hidden xl:block fixed bottom-0 z-30"
                style={{
                  left: 'calc(var(--subjects-footer-left) - 1px)',
                  right: 'calc(var(--subjects-footer-right) - 1px)',
                }}
              >
                <footer className="box-border border border-b-0 border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_16px_-12px_rgba(15,23,42,0.35)]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    {subjectChallengeState?.stage === 'completed' && subjectChallengeState.summary ? (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                        Subject challenge complete: {subjectChallengeState.summary.correct}/{subjectChallengeState.summary.total} correct.
                      </div>
                    ) : (
                      <div />
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={exitSubjectChallenge}
                        className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Back to overview
                      </button>
                      <button
                        type="button"
                        onClick={startSubjectChallenge}
                        disabled={selectedSubjectChallengeConfig.questions.length === 0 || !selectedSubjectChallengeConfig.sessionId || selectedSubjectChallengeConfig.isGenerating}
                        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                      >
                        {subjectChallengeState?.stage === 'completed' ? 'Retake challenge' : "Let's go"}
                      </button>
                    </div>
                  </div>
                </footer>
              </div>

              <div className="xl:hidden border-t border-slate-200 bg-white px-6 py-4">
                {subjectChallengeState?.stage === 'completed' && subjectChallengeState.summary ? (
                  <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
                    Subject challenge complete: {subjectChallengeState.summary.correct}/{subjectChallengeState.summary.total} correct.
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={exitSubjectChallenge}
                    className="inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Back to overview
                  </button>
                  <button
                    type="button"
                    onClick={startSubjectChallenge}
                    disabled={selectedSubjectChallengeConfig.questions.length === 0 || !selectedSubjectChallengeConfig.sessionId || selectedSubjectChallengeConfig.isGenerating}
                    className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    {subjectChallengeState?.stage === 'completed' ? 'Retake challenge' : "Let's go"}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {shouldShowSubjectsChat && (
        <div
          ref={subjectsChatFloatingRef}
          className="fixed z-40"
          style={
            subjectsChatPosition
              ? { left: `${subjectsChatPosition.x}px`, top: `${subjectsChatPosition.y}px` }
              : {
                  right: 'calc(var(--subjects-footer-right) + 1rem)',
                  bottom: '6rem',
                }
          }
        >
          <div className="flex flex-col items-end gap-3">
            {isSubjectsChatOpen && (
              <div className="w-[460px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <p className="text-sm font-semibold text-slate-800">Topic Chat</p>
                  <div className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onPointerDown={startSubjectsChatDrag}
                      className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                      aria-label="Drag topic chat window"
                      title="Drag"
                    >
                      <GripHorizontal className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubjectsChatOpenWithAnchor(false)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                      aria-label="Close topic chat"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="h-[300px] max-h-[52vh] space-y-2 overflow-y-auto px-3 py-3">
                  {subjectsChatMessages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.sender === 'student' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-lg px-3 py-2 text-sm ${
                          message.sender === 'student'
                            ? 'bg-blue-600 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        {message.text}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-slate-200 p-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={subjectsChatInput}
                      onChange={(event) => setSubjectsChatInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendSubjectsChatMessage();
                        }
                      }}
                      placeholder="Ask about this topic..."
                      className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={sendSubjectsChatMessage}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700"
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2 shadow-sm">
              <button
                type="button"
                onPointerDown={startSubjectsChatDrag}
                className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                aria-label="Drag topic chat button"
                title="Drag"
              >
                <GripHorizontal className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setSubjectsChatOpenWithAnchor(!isSubjectsChatOpen)}
                className="inline-flex items-center gap-2 rounded-md bg-white px-1.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                <MessageCircle className="h-4 w-4" />
                {isSubjectsChatOpen ? 'Hide chat' : 'Open chat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default StudentSubjectsView;
