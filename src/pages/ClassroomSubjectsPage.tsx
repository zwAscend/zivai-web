import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignJustify,
  AlertCircle,
  ArrowUp,
  ArrowLeft,
  Bold,
  Bot,
  CheckCircle2,
  Code2,
  Copy,
  GripVertical,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  MessageSquare,
  Minimize2,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Settings2,
  Plus,
  Pencil,
  Printer,
  Redo2,
  RefreshCw,
  Save,
  Search,
  SendHorizontal,
  Share2,
  Table,
  Trash2,
  Underline,
  Undo2,
} from 'lucide-react';
import ClassroomLayout from '../components/classroom/ClassroomLayout';
import {
  assessmentEnrollmentService,
  assessmentService,
  schoolService,
  subjectService,
} from '../services/api';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';
import { curriculumService, CurriculumTopicWithResources } from '../services/curriculumService';
import { ResourceItem, resourceService } from '../services/resourceService';
import { normalizeResourceContentType } from '../constants/resourceContentTypes';

type TeachingSubject = {
  id: string;
  code?: string;
  name: string;
  grades?: string[];
};

type FormLevel = 'Form 3' | 'Form 4';
type TopicContentType = 'resource' | 'practice' | 'assessment';
type WorkspaceView = 'overview' | 'missing';
type ClassroomWorkspaceNavView = 'my-subjects' | 'subject';
type EditorBlockStyle =
  | 'Paragraph'
  | 'Title'
  | 'Heading'
  | 'Subheading'
  | 'Block quote'
  | 'Bulleted list'
  | 'Numbered list'
  | 'Lettered list'
  | 'Code block';
type AiChatMessage = {
  id: string;
  role: 'teacher' | 'assistant';
  text: string;
};
type WorkspaceOperationFeedback = {
  status: 'loading' | 'success' | 'error';
  title: string;
  message: string;
};
type SelectionActionType = 'change' | 'different' | 'chat';
type AssessmentQuestionType = 'short-answer' | 'multiple-choice';
type AssessmentQuestion = {
  id: string;
  prompt: string;
  type: AssessmentQuestionType;
  marks: number;
  options: string;
};
type WorkspaceAssessment = {
  id: string;
  name: string;
  description?: string;
  assessmentType?: string;
  visibility?: string;
  timeLimitMin?: number | null;
  attemptsAllowed?: number | null;
  maxScore?: number | null;
  weightPct?: number | null;
  status?: string;
  resourceId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TopicCoverage = {
  id: string;
  title: string;
  unit: string;
  form: FormLevel;
  masteryPercent: number;
  resourcesCount: number;
  practicesCount: number;
  assessmentsCount: number;
  updatedAtLabel: string;
  materials: Record<TopicContentType, string[]>;
};

const TOPIC_TEMPLATES: Record<string, TopicCoverage[]> = {
  'computer science': [
    {
      id: 'cs-f3-1',
      title: 'Computer Systems Fundamentals',
      unit: 'Systems and Architecture',
      form: 'Form 3',
      masteryPercent: 52,
      resourcesCount: 2,
      practicesCount: 1,
      assessmentsCount: 0,
      updatedAtLabel: 'Updated 2 days ago',
      materials: {
        resource: ['CPU architecture summary notes', 'Input/output devices slide deck'],
        practice: ['System components matching practice'],
        assessment: [],
      },
    },
    {
      id: 'cs-f3-2',
      title: 'Data Representation',
      unit: 'Systems and Architecture',
      form: 'Form 3',
      masteryPercent: 46,
      resourcesCount: 1,
      practicesCount: 0,
      assessmentsCount: 0,
      updatedAtLabel: 'Updated 6 days ago',
      materials: {
        resource: ['Binary and hexadecimal conversion guide'],
        practice: [],
        assessment: [],
      },
    },
    {
      id: 'cs-f3-3',
      title: 'Algorithm Design Basics',
      unit: 'Programming Foundations',
      form: 'Form 3',
      masteryPercent: 58,
      resourcesCount: 2,
      practicesCount: 2,
      assessmentsCount: 1,
      updatedAtLabel: 'Updated yesterday',
      materials: {
        resource: ['Flowchart notation reference', 'Pseudocode writing checklist'],
        practice: ['Flowchart correction drill', 'Pseudocode starter set'],
        assessment: ['Algorithm design mini test'],
      },
    },
    {
      id: 'cs-f4-1',
      title: 'Structured Programming',
      unit: 'Programming and Problem Solving',
      form: 'Form 4',
      masteryPercent: 63,
      resourcesCount: 1,
      practicesCount: 2,
      assessmentsCount: 1,
      updatedAtLabel: 'Updated 3 days ago',
      materials: {
        resource: ['Control structures notes'],
        practice: ['Loop trace worksheet', 'Function design challenge'],
        assessment: ['Structured programming quiz'],
      },
    },
    {
      id: 'cs-f4-2',
      title: 'Database Concepts',
      unit: 'Data Management',
      form: 'Form 4',
      masteryPercent: 41,
      resourcesCount: 0,
      practicesCount: 1,
      assessmentsCount: 0,
      updatedAtLabel: 'Never updated',
      materials: {
        resource: [],
        practice: ['Entity-relationship diagram task'],
        assessment: [],
      },
    },
    {
      id: 'cs-f4-3',
      title: 'Computer Networks and Security',
      unit: 'Networks and Security',
      form: 'Form 4',
      masteryPercent: 37,
      resourcesCount: 0,
      practicesCount: 0,
      assessmentsCount: 0,
      updatedAtLabel: 'Never updated',
      materials: {
        resource: [],
        practice: [],
        assessment: [],
      },
    },
  ],
  mathematics: [
    {
      id: 'math-f3-1',
      title: 'Functions and Graphs',
      unit: 'Algebra',
      form: 'Form 3',
      masteryPercent: 68,
      resourcesCount: 2,
      practicesCount: 2,
      assessmentsCount: 1,
      updatedAtLabel: 'Updated today',
      materials: {
        resource: ['Graph transformations notes', 'Function vocabulary card'],
        practice: ['Graph plotting drill', 'Function matching practice'],
        assessment: ['Functions checkpoint'],
      },
    },
    {
      id: 'math-f4-1',
      title: 'Trigonometric Identities',
      unit: 'Trigonometry',
      form: 'Form 4',
      masteryPercent: 49,
      resourcesCount: 1,
      practicesCount: 0,
      assessmentsCount: 0,
      updatedAtLabel: 'Updated 5 days ago',
      materials: {
        resource: ['Identity simplification examples'],
        practice: [],
        assessment: [],
      },
    },
  ],
  'english language': [
    {
      id: 'eng-f3-1',
      title: 'Comprehension Strategies',
      unit: 'Reading',
      form: 'Form 3',
      masteryPercent: 61,
      resourcesCount: 2,
      practicesCount: 1,
      assessmentsCount: 1,
      updatedAtLabel: 'Updated 4 days ago',
      materials: {
        resource: ['Inference question guide', 'Skimming/scanning handout'],
        practice: ['Comprehension passage set A'],
        assessment: ['Reading comprehension test'],
      },
    },
    {
      id: 'eng-f4-1',
      title: 'Argumentative Writing',
      unit: 'Writing',
      form: 'Form 4',
      masteryPercent: 54,
      resourcesCount: 1,
      practicesCount: 1,
      assessmentsCount: 0,
      updatedAtLabel: 'Updated 7 days ago',
      materials: {
        resource: ['Essay structure template'],
        practice: ['Argument planning worksheet'],
        assessment: [],
      },
    },
  ],
  physics: [
    {
      id: 'phy-f3-1',
      title: 'Forces and Motion',
      unit: 'Mechanics',
      form: 'Form 3',
      masteryPercent: 57,
      resourcesCount: 2,
      practicesCount: 1,
      assessmentsCount: 1,
      updatedAtLabel: 'Updated yesterday',
      materials: {
        resource: ['Newton laws summary', 'Motion graph notes'],
        practice: ['Kinematics calculations worksheet'],
        assessment: ['Mechanics topic test'],
      },
    },
    {
      id: 'phy-f4-1',
      title: 'Electricity and Circuits',
      unit: 'Electricity',
      form: 'Form 4',
      masteryPercent: 43,
      resourcesCount: 1,
      practicesCount: 0,
      assessmentsCount: 0,
      updatedAtLabel: 'Never updated',
      materials: {
        resource: ['Circuit symbols chart'],
        practice: [],
        assessment: [],
      },
    },
  ],
};

const getTopicMissingTypes = (topic: TopicCoverage): TopicContentType[] => {
  const missing: TopicContentType[] = [];
  if (topic.resourcesCount === 0) missing.push('resource');
  if (topic.assessmentsCount === 0) missing.push('assessment');
  return missing;
};

const toTopicCoverageStatus = (topic: TopicCoverage) => {
  const missing = getTopicMissingTypes(topic);
  if (missing.length === 0) return 'Complete';
  if (missing.length === 1) return `Missing ${getTopicContentLabelLower(missing[0], true)}`;
  return 'Missing multiple';
};

const TOPIC_CONTENT_LABELS: Record<TopicContentType, string> = {
  resource: 'Resources',
  practice: 'Practices',
  assessment: 'Practices',
};
const TOPIC_CONTENT_SINGULAR_LABELS: Record<TopicContentType, string> = {
  resource: 'Resource',
  practice: 'Practice',
  assessment: 'Practice',
};

const getTopicContentLabel = (type: TopicContentType, singular = false) =>
  singular ? TOPIC_CONTENT_SINGULAR_LABELS[type] : TOPIC_CONTENT_LABELS[type];

const getTopicContentLabelLower = (type: TopicContentType, singular = false) =>
  getTopicContentLabel(type, singular).toLowerCase();

const WORKSPACE_CONTENT_TYPES: TopicContentType[] = ['resource', 'assessment'];
const normalizeWorkspaceTab = (type: TopicContentType): TopicContentType =>
  type === 'practice' ? 'assessment' : type;

const getMaterialDraftKey = (topicId: string, type: TopicContentType, item: string) =>
  `${topicId}::${type}::${item}`;

const toTitleCase = (value: string) =>
  value
    .split(' ')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');

const toEditorHtml = (value: string) => {
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(value);
  const hasHtmlEntities = /&(?:[a-zA-Z]+|#\d+);/.test(value);
  if (hasHtmlTags || hasHtmlEntities) return value;

  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />');
};

const normalizeEditorContent = (value: string) => {
  let normalized = value;
  for (let index = 0; index < 5; index += 1) {
    const decoded = normalized.replace(/&amp;([a-zA-Z#0-9]+;)/g, '&$1');
    if (decoded === normalized) {
      break;
    }
    normalized = decoded;
  }
  return normalized;
};

const buildSeedMaterialDraft = (_topicTitle: string, _itemTitle: string, _type: TopicContentType) => '';

const buildAiGeneratedDraft = ({
  topicTitle,
  itemTitle,
  type,
  gradeLevel,
  objective,
  prompt,
  variant,
}: {
  topicTitle: string;
  itemTitle: string;
  type: TopicContentType;
  gradeLevel: string;
  objective: string;
  prompt: string;
  variant: boolean;
}) => {
  const title = itemTitle || `${toTitleCase(type)} draft`;
  const objectiveLine = objective || `Build mastery on ${topicTitle}`;
  const promptLine = prompt || 'Use clear teacher-ready wording and concise learner instructions.';
  const variantLine = variant ? 'Alternative version with a different activity structure.' : 'Primary version.';

  if (type === 'assessment') {
    return `${title}

Grade level: ${gradeLevel}
Objective: ${objectiveLine}
${variantLine}

Practice brief:
- Design 5 items: 2 recall, 2 application, 1 reasoning.
- Focus topic: ${topicTitle}.

Items:
1. Recall question on core definition.
2. Recall question on key components.
3. Application scenario question.
4. Data/diagram interpretation question.
5. Reasoning question with justification.

Marking guide:
- Allocate marks for method and accuracy.
- Provide model responses and common error notes.

AI direction used:
${promptLine}`;
  }

  if (type === 'practice') {
    return `${title}

Grade level: ${gradeLevel}
Objective: ${objectiveLine}
${variantLine}

Practice flow:
1. Retrieval warm-up (3 mins)
2. Guided practice with scaffold
3. Independent practice set
4. Reflection check

Teacher checks:
- Watch for misconceptions tied to ${topicTitle}.
- Use quick verbal prompts for correction.

AI direction used:
${promptLine}`;
  }

  return `${title}

Grade level: ${gradeLevel}
Objective: ${objectiveLine}
${variantLine}

Lesson content:
- Hook: introduce why ${topicTitle} matters.
- Teach: concise explanation + worked example.
- Guided step: one co-created example.
- Independent step: one short task.
- Exit check: one prompt.

Differentiation:
- Support: vocabulary bank + sentence starters.
- Extension: transfer challenge task.

AI direction used:
${promptLine}`;
};

const inferTopicForm = (
  topic: Pick<CurriculumTopicWithResources, 'name' | 'description' | 'objectives' | 'code'>,
  subjectGrades: string[] = []
): FormLevel => {
  const haystack = `${topic.code || ''} ${topic.name || ''} ${topic.description || ''} ${topic.objectives || ''}`.toLowerCase();
  if (haystack.includes('form 3')) return 'Form 3';
  if (haystack.includes('form 4')) return 'Form 4';

  const normalizedGrades = subjectGrades.map((grade) => grade.trim().toLowerCase());
  if (normalizedGrades.includes('form 3')) return 'Form 3';
  return 'Form 4';
};

const toWorkspaceUnitLabel = (topic: Pick<CurriculumTopicWithResources, 'code' | 'name'>) => {
  const code = topic.code?.trim();
  if (code && code.includes('-')) {
    return toTitleCase(code.split('-')[0].replace(/_/g, ' '));
  }
  const name = topic.name?.trim();
  if (!name) return 'Curriculum';
  const firstWord = name.split(/\s+/)[0];
  return firstWord ? `${toTitleCase(firstWord)} strand` : 'Curriculum';
};

const extractAssessmentResourceId = (assessment: any): string | null => {
  const raw = assessment?.resourceId ?? assessment?.resource;
  if (!raw) return null;
  if (typeof raw === 'string') return raw;
  return raw?.id || null;
};

const formatUpdatedAtLabel = (timestamps: Array<string | undefined | null>) => {
  const validTimes = timestamps
    .map((value) => (value ? new Date(value).getTime() : Number.NaN))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => b - a);

  if (validTimes.length === 0) return 'Never updated';

  const latest = validTimes[0];
  const diffMs = Date.now() - latest;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Updated today';
  if (diffDays === 1) return 'Updated yesterday';
  return `Updated ${diffDays} days ago`;
};

const buildAssessmentResourceContent = (
  topicTitle: string,
  assessmentName: string,
  assessmentDescription: string,
  questions: AssessmentQuestion[]
) => {
  const questionLines = questions.length
    ? questions
        .map((question, index) => {
          const options = question.type === 'multiple-choice' && question.options.trim()
            ? ` Options: ${question.options}`
            : '';
          return `${index + 1}. ${question.prompt || 'Untitled question'} (${question.marks} marks)${options}`;
        })
        .join('\n')
    : 'No questions yet.';

  return `${assessmentName}

Topic: ${topicTitle}

${assessmentDescription || 'Practice description pending.'}

Questions:
${questionLines}`;
};

const ClassroomSubjectsPage: React.FC = () => {
  const { selectedSubject, setSelectedSubject } = useAuth();

  const [subjects, setSubjects] = useState<TeachingSubject[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [topics, setTopics] = useState<TopicCoverage[]>([]);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [activeSchoolId, setActiveSchoolId] = useState('');
  const [materialRecordIds, setMaterialRecordIds] = useState<Record<string, string>>({});
  const [assessmentResourceIds, setAssessmentResourceIds] = useState<Record<string, string>>({});
  const [resourceDetailsCache, setResourceDetailsCache] = useState<Record<string, ResourceItem>>({});
  const [assessmentDetailsCache, setAssessmentDetailsCache] = useState<Record<string, any>>({});
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [view, setView] = useState<WorkspaceView>('overview');
  const [workspaceNavView, setWorkspaceNavView] = useState<ClassroomWorkspaceNavView>('subject');

  const [topicQuery, setTopicQuery] = useState('');
  const [formFilter, setFormFilter] = useState<'all' | FormLevel>('all');
  const [coverageFilter, setCoverageFilter] = useState<'all' | 'complete' | 'missing'>('all');
  const [isTopicWorkspaceOpen, setIsTopicWorkspaceOpen] = useState(false);
  const [isTopicContentCollapsed, setIsTopicContentCollapsed] = useState(false);
  const [isStudioExpanded, setIsStudioExpanded] = useState(false);
  const [isAiCollaboratorExpanded, setIsAiCollaboratorExpanded] = useState(false);
  const [isAiConfigOpen, setIsAiConfigOpen] = useState(false);
  const [isMaterialConfigOpen, setIsMaterialConfigOpen] = useState(false);
  const [isAssessmentConfigOpen, setIsAssessmentConfigOpen] = useState(false);
  const [isAssessmentConfigured, setIsAssessmentConfigured] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<TopicContentType>('resource');
  const [selectedWorkspaceItem, setSelectedWorkspaceItem] = useState('');
  const [materialDrafts, setMaterialDrafts] = useState<Record<string, string>>({});
  const [editorBlockStyle, setEditorBlockStyle] = useState<EditorBlockStyle>('Paragraph');
  const [editorTitle, setEditorTitle] = useState('');
  const [editorBody, setEditorBody] = useState('');
  const [aiGradeLevel, setAiGradeLevel] = useState('Form 4');
  const [aiObjective, setAiObjective] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [assessmentName, setAssessmentName] = useState('');
  const [assessmentType, setAssessmentType] = useState<'quiz' | 'assignment' | 'test' | 'project' | 'exam'>('quiz');
  const [assessmentDescription, setAssessmentDescription] = useState('');
  const [assessmentMaxScore, setAssessmentMaxScore] = useState('100');
  const [assessmentWeight, setAssessmentWeight] = useState('0');
  const [assessmentTimeLimit, setAssessmentTimeLimit] = useState('0');
  const [assessmentAttempts, setAssessmentAttempts] = useState('1');
  const [assessmentStatus, setAssessmentStatus] = useState<'draft' | 'published' | 'archived'>('draft');
  const [assessmentVisibility, setAssessmentVisibility] = useState<'private' | 'public'>('private');
  const [assessmentQuestions, setAssessmentQuestions] = useState<AssessmentQuestion[]>([]);
  const [assessmentAiPrompt, setAssessmentAiPrompt] = useState('');
  const [assessmentAiLogs, setAssessmentAiLogs] = useState<string[]>([]);
  const [assessmentAttachedFileName, setAssessmentAttachedFileName] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [workspaceOperationFeedback, setWorkspaceOperationFeedback] = useState<WorkspaceOperationFeedback | null>(null);
  const editorSurfaceRef = useRef<HTMLDivElement | null>(null);
  const editorOverlayHostRef = useRef<HTMLDivElement | null>(null);
  const editorImageInputRef = useRef<HTMLInputElement | null>(null);
  const aiChatInputRef = useRef<HTMLTextAreaElement | null>(null);
  const assessmentAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const [selectionActionOverlay, setSelectionActionOverlay] = useState<{ top: number; left: number; text: string } | null>(null);
  const [selectionActionHint, setSelectionActionHint] = useState<string | null>(null);

  const refreshWorkspaceData = React.useCallback(async () => {
    if (!selectedSubjectId) return;
    const current = subjects.find((subject) => subject.id === selectedSubjectId);
    if (!current) return;

    try {
      setWorkspaceLoading(true);
      setWorkspaceError(null);

      const [topicRows, subjectResources, subjectAssessments] = await Promise.all([
        curriculumService.listTopicsWithResources(current.id).catch(() => []),
        resourceService.listBySubject(current.id).catch(() => []),
        assessmentService.getAssessmentsBySubjectId(current.id).catch(() => []),
      ]);

      const subjectGrades = current.grades || [];
      const resourcesByTopicId = new Map<string, ResourceItem[]>();
      const resourceById = new Map<string, ResourceItem>();
      subjectResources.forEach((resource) => {
        resourceById.set(resource.id, resource);
        (resource.topicIds || []).forEach((topicId) => {
          const existing = resourcesByTopicId.get(topicId) || [];
          existing.push(resource);
          resourcesByTopicId.set(topicId, existing);
        });
      });

      const assessmentsByTopicId = new Map<string, WorkspaceAssessment[]>();
      const nextAssessmentResourceIds: Record<string, string> = {};
      (Array.isArray(subjectAssessments) ? subjectAssessments : []).forEach((assessment: any) => {
        const resourceId = extractAssessmentResourceId(assessment);
        if (!resourceId) return;
        nextAssessmentResourceIds[assessment.id] = resourceId;
        const linkedResource = resourceById.get(resourceId);
        const topicIds = linkedResource?.topicIds || [];
        topicIds.forEach((topicId) => {
          const existing = assessmentsByTopicId.get(topicId) || [];
          existing.push({
            id: assessment.id,
            name: assessment.name,
            description: assessment.description,
            assessmentType: assessment.assessmentType,
            visibility: assessment.visibility,
            timeLimitMin: assessment.timeLimitMin,
            attemptsAllowed: assessment.attemptsAllowed,
            maxScore: assessment.maxScore,
            weightPct: assessment.weightPct,
            status: assessment.status,
            resourceId,
            createdAt: assessment.createdAt,
            updatedAt: assessment.updatedAt,
          });
          assessmentsByTopicId.set(topicId, existing);
        });
      });

      const nextMaterialRecordIds: Record<string, string> = {};
      const nextTopics = topicRows.map((topic) => {
        const topicResources = resourcesByTopicId.get(topic.id) || [];
        const lessonResources = topicResources.filter((resource) => {
          const normalizedType = normalizeResourceContentType(resource.contentType);
          return normalizedType === 'lesson_plan' || normalizedType === 'notes';
        });
        const practiceResources = topicResources.filter(
          (resource) => normalizeResourceContentType(resource.contentType) === 'practice'
        );
        const topicAssessments = assessmentsByTopicId.get(topic.id) || [];

        lessonResources.forEach((resource) => {
          nextMaterialRecordIds[getMaterialDraftKey(topic.id, 'resource', resource.name)] = resource.id;
        });
        practiceResources.forEach((resource) => {
          nextMaterialRecordIds[getMaterialDraftKey(topic.id, 'practice', resource.name)] = resource.id;
        });
        topicAssessments.forEach((assessment) => {
          nextMaterialRecordIds[getMaterialDraftKey(topic.id, 'assessment', assessment.name)] = assessment.id;
        });

        return {
          id: topic.id,
          title: topic.name,
          unit: toWorkspaceUnitLabel(topic),
          form: inferTopicForm(topic, subjectGrades),
          masteryPercent: 0,
          resourcesCount: lessonResources.length,
          practicesCount: practiceResources.length,
          assessmentsCount: topicAssessments.length,
          updatedAtLabel: formatUpdatedAtLabel([
            ...topicResources.map((resource) => resource.updatedAt || resource.createdAt),
            ...topicAssessments.map((assessment) => assessment.updatedAt || assessment.createdAt),
          ]),
          materials: {
            resource: lessonResources.map((resource) => resource.name),
            practice: practiceResources.map((resource) => resource.name),
            assessment: topicAssessments.map((assessment) => assessment.name),
          },
        } as TopicCoverage;
      });

      setTopics(nextTopics);
      setMaterialRecordIds(nextMaterialRecordIds);
      setAssessmentResourceIds(nextAssessmentResourceIds);
      setSelectedTopicId((previous) => {
        if (previous && nextTopics.some((topic) => topic.id === previous)) return previous;
        return nextTopics[0]?.id || '';
      });
    } catch (error: any) {
      setTopics([]);
      setWorkspaceError(error?.message || 'Unable to load the workspace right now.');
      setSelectedTopicId('');
    } finally {
      setWorkspaceLoading(false);
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    const loadSubjects = async () => {
      try {
        const data = await subjectService.getTeachingSubjects();
        const normalized = (Array.isArray(data) ? data : []).map((subject: any) => ({
          id: subject.id,
          code: subject.code || '',
          name: subject.name,
          grades: Array.isArray(subject.grades) ? subject.grades : [],
        }));
        setSubjects(normalized);
      } catch {
        setSubjects([]);
      }
    };
    loadSubjects();
  }, []);

  useEffect(() => {
    const loadSchools = async () => {
      try {
        const schools = await schoolService.getSchools();
        if (schools[0]?.id) {
          setActiveSchoolId(schools[0].id);
        }
      } catch {
        setActiveSchoolId('');
      }
    };
    loadSchools();
  }, []);

  useEffect(() => {
    if (!subjects.length) {
      setSelectedSubjectId('');
      return;
    }

    const selectedId = selectedSubject?.id;
    if (selectedId && subjects.some((subject) => subject.id === selectedId)) {
      setSelectedSubjectId(selectedId);
      return;
    }

    setSelectedSubjectId(subjects[0].id);
  }, [selectedSubject?.id, subjects]);

  useEffect(() => {
    if (!selectedSubjectId) return;
    const current = subjects.find((subject) => subject.id === selectedSubjectId);
    if (!current) return;

    const nextSelectedSubject = {
      id: current.id,
      code: current.code || '',
      name: current.name,
    };
    if (
      selectedSubject?.id !== nextSelectedSubject.id ||
      selectedSubject?.code !== nextSelectedSubject.code ||
      selectedSubject?.name !== nextSelectedSubject.name
    ) {
      setSelectedSubject(nextSelectedSubject);
    }
    setIsTopicWorkspaceOpen(false);
    setIsTopicContentCollapsed(false);
    setIsStudioExpanded(false);
    setIsAiCollaboratorExpanded(false);
    setIsAiConfigOpen(false);
    setIsMaterialConfigOpen(false);
    setIsAssessmentConfigOpen(false);
    setIsAssessmentConfigured(false);
    setSelectionActionOverlay(null);
    setSelectionActionHint(null);
    setWorkspaceTab('resource');
    setSelectedWorkspaceItem('');
    setTopics([]);
    setSelectedTopicId('');
    setMaterialDrafts({});
    setMaterialRecordIds({});
    setAssessmentResourceIds({});
    setResourceDetailsCache({});
    setAssessmentDetailsCache({});
    setEditorBlockStyle('Paragraph');
    setEditorTitle('');
    setEditorBody('');
    setAiGradeLevel('Form 4');
    setAiObjective('');
    setAiPrompt('');
    setAiChatInput('');
    setAiMessages([]);
    setAssessmentName('');
    setAssessmentType('quiz');
    setAssessmentDescription('');
    setAssessmentMaxScore('100');
    setAssessmentWeight('0');
    setAssessmentTimeLimit('0');
    setAssessmentAttempts('1');
    setAssessmentStatus('draft');
    setAssessmentVisibility('private');
    setAssessmentQuestions([]);
    setAssessmentAiPrompt('');
    setAssessmentAiLogs([]);
    setAssessmentAttachedFileName('');
    void refreshWorkspaceData();
  }, [
    refreshWorkspaceData,
    selectedSubject?.code,
    selectedSubject?.id,
    selectedSubject?.name,
    selectedSubjectId,
    setSelectedSubject,
    subjects,
  ]);

  const filteredTopics = useMemo(() => {
    const query = topicQuery.trim().toLowerCase();
    return topics.filter((topic) => {
      const matchesQuery =
        !query ||
        topic.title.toLowerCase().includes(query) ||
        topic.unit.toLowerCase().includes(query);
      const matchesForm = formFilter === 'all' || topic.form === formFilter;
      const hasMissing = getTopicMissingTypes(topic).length > 0;
      const matchesCoverage =
        coverageFilter === 'all' ||
        (coverageFilter === 'complete' && !hasMissing) ||
        (coverageFilter === 'missing' && hasMissing);
      return matchesQuery && matchesForm && matchesCoverage;
    });
  }, [coverageFilter, formFilter, topicQuery, topics]);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) || null,
    [selectedTopicId, topics]
  );

  useEffect(() => {
    if (workspaceTab === 'practice') {
      setWorkspaceTab('assessment');
    }
  }, [workspaceTab]);

  useEffect(() => {
    if (!selectedTopic) {
      setSelectedWorkspaceItem('');
      return;
    }

    const items = selectedTopic.materials[workspaceTab];
    setSelectedWorkspaceItem((current) => (current && items.includes(current) ? current : items[0] || ''));
  }, [selectedTopic, workspaceTab]);

  const selectedMaterialKey = useMemo(() => {
    if (!selectedTopic || !selectedWorkspaceItem) return '';
    return getMaterialDraftKey(selectedTopic.id, workspaceTab, selectedWorkspaceItem);
  }, [selectedTopic, selectedWorkspaceItem, workspaceTab]);

  useEffect(() => {
    if (!selectedTopic || !selectedWorkspaceItem || !selectedMaterialKey) {
      setEditorTitle('');
      setEditorBody('');
      if (workspaceTab === 'assessment') {
        setIsAssessmentConfigured(false);
      }
      return;
    }

    if (workspaceTab === 'assessment') {
      return;
    }

    const persistedId = materialRecordIds[selectedMaterialKey];
    const cachedBody = materialDrafts[selectedMaterialKey];
    if (cachedBody !== undefined) {
      setEditorTitle(selectedWorkspaceItem);
      setEditorBody(cachedBody);
      return;
    }

    if (!persistedId) {
      const fallback = buildSeedMaterialDraft(selectedTopic.title, selectedWorkspaceItem, workspaceTab);
      setMaterialDrafts((previous) => (
        previous[selectedMaterialKey] === fallback ? previous : { ...previous, [selectedMaterialKey]: fallback }
      ));
      setEditorTitle(selectedWorkspaceItem);
      setEditorBody(fallback);
      return;
    }

    const cachedResource = resourceDetailsCache[persistedId];
    if (cachedResource?.contentBody != null) {
      const body = cachedResource.contentBody || buildSeedMaterialDraft(selectedTopic.title, selectedWorkspaceItem, workspaceTab);
      setMaterialDrafts((previous) => (
        previous[selectedMaterialKey] === body ? previous : { ...previous, [selectedMaterialKey]: body }
      ));
      setEditorTitle(cachedResource.name || selectedWorkspaceItem);
      setEditorBody(body);
      return;
    }

    let cancelled = false;
    const loadResource = async () => {
      try {
        const detail = await resourceService.get(persistedId);
        if (cancelled) return;
        const body = detail.contentBody || buildSeedMaterialDraft(selectedTopic.title, selectedWorkspaceItem, workspaceTab);
        setResourceDetailsCache((previous) => ({ ...previous, [persistedId]: detail }));
        setMaterialDrafts((previous) => (
          previous[selectedMaterialKey] === body ? previous : { ...previous, [selectedMaterialKey]: body }
        ));
        setEditorTitle(detail.name || selectedWorkspaceItem);
        setEditorBody(body);
      } catch {
        if (cancelled) return;
        const fallback = buildSeedMaterialDraft(selectedTopic.title, selectedWorkspaceItem, workspaceTab);
        setMaterialDrafts((previous) => (
          previous[selectedMaterialKey] === fallback ? previous : { ...previous, [selectedMaterialKey]: fallback }
        ));
        setEditorTitle(selectedWorkspaceItem);
        setEditorBody(fallback);
      }
    };

    void loadResource();
    return () => {
      cancelled = true;
    };
  }, [
    materialDrafts,
    materialRecordIds,
    resourceDetailsCache,
    selectedMaterialKey,
    selectedTopic,
    selectedWorkspaceItem,
    workspaceTab,
  ]);

  useEffect(() => {
    if (workspaceTab !== 'assessment' || !selectedTopic || !selectedWorkspaceItem || !selectedMaterialKey) {
      return;
    }

    const persistedId = materialRecordIds[selectedMaterialKey];
    if (!persistedId) {
      setAssessmentName(selectedWorkspaceItem);
      setAssessmentDescription('');
      setAssessmentQuestions([]);
      setIsAssessmentConfigured(false);
      return;
    }

    const cachedAssessment = assessmentDetailsCache[persistedId];
    if (cachedAssessment) {
      setAssessmentName(cachedAssessment.name || selectedWorkspaceItem);
      setAssessmentType((cachedAssessment.assessmentType || 'quiz') as typeof assessmentType);
      setAssessmentDescription(cachedAssessment.description || '');
      setAssessmentMaxScore(String(cachedAssessment.maxScore ?? 100));
      setAssessmentWeight(String(cachedAssessment.weightPct ?? 0));
      setAssessmentTimeLimit(String(cachedAssessment.timeLimitMin ?? 0));
      setAssessmentAttempts(String(cachedAssessment.attemptsAllowed ?? 1));
      setAssessmentStatus((cachedAssessment.status || 'draft') as typeof assessmentStatus);
      setAssessmentVisibility((cachedAssessment.visibility || 'private') as typeof assessmentVisibility);
      setAssessmentQuestions(
        (cachedAssessment.questions || []).map((question: any) => ({
          id: question.id || question.questionId || `${persistedId}-${question.sequenceIndex || 0}`,
          prompt: question.stem || '',
          type: question.questionTypeCode === 'multiple_choice' ? 'multiple-choice' : 'short-answer',
          marks: Number(question.maxMark || question.points || 1),
          options: Array.isArray(question.rubricJson?.options) ? question.rubricJson.options.join(', ') : '',
        }))
      );
      setIsAssessmentConfigured(true);
      return;
    }

    let cancelled = false;
    const loadAssessment = async () => {
      try {
        const detail = await assessmentService.getAssessmentWithQuestions(persistedId);
        if (cancelled) return;
        setAssessmentDetailsCache((previous) => ({ ...previous, [persistedId]: detail }));
        setAssessmentName(detail.name || selectedWorkspaceItem);
        setAssessmentType((detail.assessmentType || 'quiz') as typeof assessmentType);
        setAssessmentDescription(detail.description || '');
        setAssessmentMaxScore(String(detail.maxScore ?? 100));
        setAssessmentWeight(String(detail.weightPct ?? 0));
        setAssessmentTimeLimit(String(detail.timeLimitMin ?? 0));
        setAssessmentAttempts(String(detail.attemptsAllowed ?? 1));
        setAssessmentStatus((detail.status || 'draft') as typeof assessmentStatus);
        setAssessmentVisibility((detail.visibility || 'private') as typeof assessmentVisibility);
        setAssessmentQuestions(
          (detail.questions || []).map((question: any) => ({
            id: question.id || question.questionId || `${persistedId}-${question.sequenceIndex || 0}`,
            prompt: question.stem || '',
            type: question.questionTypeCode === 'multiple_choice' ? 'multiple-choice' : 'short-answer',
            marks: Number(question.maxMark || question.points || 1),
            options: Array.isArray(question.rubricJson?.options) ? question.rubricJson.options.join(', ') : '',
          }))
        );
        setIsAssessmentConfigured(true);
      } catch {
        if (!cancelled) {
          setAssessmentName(selectedWorkspaceItem);
          setAssessmentQuestions([]);
          setIsAssessmentConfigured(false);
        }
      }
    };

    void loadAssessment();
    return () => {
      cancelled = true;
    };
  }, [
    assessmentDetailsCache,
    materialRecordIds,
    selectedMaterialKey,
    selectedTopic,
    selectedWorkspaceItem,
    workspaceTab,
  ]);

  useEffect(() => {
    if (!editorSurfaceRef.current) return;
    const nextHtml = toEditorHtml(editorBody);
    if (editorSurfaceRef.current.innerHTML !== nextHtml) {
      editorSurfaceRef.current.innerHTML = nextHtml;
    }
  }, [editorBody]);

  useEffect(() => {
    if (!aiChatInputRef.current) return;
    aiChatInputRef.current.style.height = 'auto';
    aiChatInputRef.current.style.height = `${Math.min(aiChatInputRef.current.scrollHeight, 160)}px`;
  }, [aiChatInput]);

  const isEditorBodyEmpty = useMemo(() => {
    const plain = editorBody
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .trim();
    return plain.length === 0;
  }, [editorBody]);

  const groupedTopics = useMemo(() => {
    return filteredTopics.reduce<Record<string, TopicCoverage[]>>((acc, topic) => {
      if (!acc[topic.unit]) acc[topic.unit] = [];
      acc[topic.unit].push(topic);
      return acc;
    }, {});
  }, [filteredTopics]);

  const missingRows = useMemo(() => {
    return filteredTopics.flatMap((topic) =>
      getTopicMissingTypes(topic).map((missingType) => ({
        topicId: topic.id,
        topicTitle: topic.title,
        unit: topic.unit,
        form: topic.form,
        missingType,
      }))
    );
  }, [filteredTopics]);

  const openMissingItemComposer = (topicId: string, missingType: TopicContentType) => {
    setSelectedTopicId(topicId);
    setView('overview');
    openTopicWorkspace(topicId, missingType);
  };

  const openTopicWorkspace = (topicId: string, tab: TopicContentType = 'resource') => {
    const topic = topics.find((topicItem) => topicItem.id === topicId);
    const normalizedTab = normalizeWorkspaceTab(tab);
    setSelectedTopicId(topicId);
    setIsStudioExpanded(false);
    setIsTopicContentCollapsed(false);
    setIsAiCollaboratorExpanded(false);
    setIsAiConfigOpen(false);
    setIsMaterialConfigOpen(false);
    setIsAssessmentConfigOpen(false);
    setSelectionActionOverlay(null);
    setSelectionActionHint(null);
    setWorkspaceTab(normalizedTab);
    setSelectedWorkspaceItem('');
    if (topic) {
      setAiGradeLevel(topic.form);
      setAiObjective(topic.title);
      if (normalizedTab === 'assessment') {
        setIsAssessmentConfigured(topic.assessmentsCount > 0);
        setAssessmentQuestions([]);
      }
    }
    setIsTopicWorkspaceOpen(true);
  };

  const ensureWorkspaceContext = () => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser?.id) {
      setToastMessage('You need to be logged in to continue.');
      return null;
    }
    if (!activeSchoolId) {
      setToastMessage('School context is not available yet.');
      return null;
    }
    if (!selectedSubjectId || !selectedTopic) {
      setToastMessage('Select a subject topic first.');
      return null;
    }
    return { currentUserId: currentUser.id, schoolId: activeSchoolId };
  };

  const createOrUpdateWorkspaceResource = async (
    mode: 'draft' | 'published',
    overrides?: {
      title?: string;
      body?: string;
      type?: TopicContentType;
      existingId?: string | null;
      skipRefresh?: boolean;
      skipFeedback?: boolean;
    }
  ) => {
    if (!selectedTopic) return null;
    const context = ensureWorkspaceContext();
    if (!context) return null;

    const effectiveType = overrides?.type || workspaceTab;
    const contentTitle = (overrides?.title || editorTitle || selectedWorkspaceItem || '').trim();
    if (!contentTitle) {
      setToastMessage(`Enter a ${getTopicContentLabelLower(effectiveType, true)} title first.`);
      return null;
    }

    const contentBody = (overrides?.body ?? editorBody).trim();
    if (effectiveType !== 'assessment' && !contentBody) {
      setToastMessage(`Add content to this ${getTopicContentLabelLower(effectiveType, true)} before saving.`);
      return null;
    }

    const contentType = effectiveType === 'practice'
      ? 'practice'
      : effectiveType === 'assessment'
        ? 'assessment_material'
        : 'lesson_plan';
    const draftKey = getMaterialDraftKey(selectedTopic.id, effectiveType, contentTitle);
    const existingId = overrides?.existingId || materialRecordIds[draftKey] || null;
    const materialLabel = getTopicContentLabelLower(effectiveType, true);
    const payload = {
      schoolId: context.schoolId,
      subjectId: selectedSubjectId,
      uploadedBy: context.currentUserId,
      name: contentTitle,
      originalName: contentTitle,
      mimeType: 'text/html',
      resType: 'content',
      sizeBytes: new Blob([contentBody || '']).size,
      contentType,
      contentBody,
      status: mode,
      topicIds: [selectedTopic.id],
      tags: [selectedTopic.form, effectiveType].filter(Boolean),
    };

    if (!overrides?.skipFeedback) {
      setWorkspaceOperationFeedback({
        status: 'loading',
        title: `${existingId ? 'Updating' : 'Creating'} ${materialLabel}`,
        message: mode === 'published'
          ? `Publishing "${contentTitle}"...`
          : `Saving "${contentTitle}" as draft...`,
      });
    }

    try {
      const saved = existingId
        ? await resourceService.update(existingId, payload)
        : await resourceService.create(payload);

      const savedId = saved.id || existingId;
      if (savedId) {
        setMaterialRecordIds((previous) => ({
          ...previous,
          [draftKey]: savedId,
        }));
        setResourceDetailsCache((previous) => ({
          ...previous,
          [savedId]: {
            ...(previous[savedId] || {}),
            ...saved,
            id: savedId,
            name: contentTitle,
            contentBody,
            topicIds: [selectedTopic.id],
            contentType,
          },
        }));
        setMaterialDrafts((previous) => ({ ...previous, [draftKey]: contentBody }));
      }

      if (!overrides?.skipRefresh) {
        await refreshWorkspaceData();
      }

      if (!overrides?.skipFeedback) {
        const resultVerb = existingId ? 'updated' : mode === 'published' ? 'published' : 'created';
        setWorkspaceOperationFeedback({
          status: 'success',
          title: `${toTitleCase(materialLabel)} ${resultVerb}`,
          message: `"${contentTitle}" was ${resultVerb} successfully.`,
        });
      }
      return savedId || null;
    } catch (error: any) {
      if (!overrides?.skipFeedback) {
        setWorkspaceOperationFeedback({
          status: 'error',
          title: `Failed to ${mode === 'published' ? 'publish' : 'save'} ${materialLabel}`,
          message: error?.message || 'Please try again.',
        });
      }
      throw error;
    }
  };

  const persistAssessmentWorkspace = async () => {
    if (!selectedTopic) return null;
    const context = ensureWorkspaceContext();
    if (!context) return null;
    if (!assessmentName.trim()) {
      setToastMessage('Enter a practice name before saving.');
      return null;
    }

    const selectedKey = selectedMaterialKey || getMaterialDraftKey(selectedTopic.id, 'assessment', assessmentName.trim());
    const existingAssessmentId = materialRecordIds[selectedKey] || null;
    const existingResourceId = existingAssessmentId ? assessmentResourceIds[existingAssessmentId] || null : null;
    setWorkspaceOperationFeedback({
      status: 'loading',
      title: `${existingAssessmentId ? 'Updating' : 'Creating'} practice`,
      message: `Processing "${assessmentName.trim()}"...`,
    });

    try {
      const resourceId = await createOrUpdateWorkspaceResource(
        assessmentStatus === 'published' ? 'published' : 'draft',
        {
          title: assessmentName.trim(),
          body: buildAssessmentResourceContent(selectedTopic.title, assessmentName.trim(), assessmentDescription, assessmentQuestions),
          type: 'assessment',
          existingId: existingResourceId,
          skipRefresh: true,
          skipFeedback: true,
        }
      );
      if (!resourceId) return null;

      const payload = {
        schoolId: context.schoolId,
        subjectId: selectedSubjectId,
        name: assessmentName.trim(),
        description: assessmentDescription.trim(),
        assessmentType,
        visibility: assessmentVisibility,
        timeLimitMin: Number(assessmentTimeLimit) || null,
        attemptsAllowed: Number(assessmentAttempts) || 1,
        maxScore: Number(assessmentMaxScore) || 100,
        weightPct: Number(assessmentWeight) || 0,
        resourceId,
        aiEnhanced: assessmentAiLogs.length > 0,
        status: assessmentStatus,
        createdBy: context.currentUserId,
        lastModifiedBy: context.currentUserId,
        questions: assessmentQuestions.map((question, index) => ({
          stem: question.prompt,
          questionTypeCode: question.type === 'multiple-choice' ? 'multiple_choice' : 'short_answer',
          maxMark: question.marks,
          difficulty: 2,
          rubricJson: {
            options: question.type === 'multiple-choice'
              ? question.options.split(',').map((option) => option.trim()).filter(Boolean)
              : [],
          },
          sequenceIndex: index + 1,
          points: question.marks,
        })),
      };

      const savedAssessment = existingAssessmentId
        ? await assessmentService.updateAssessment(existingAssessmentId, payload as any)
        : await assessmentService.createAssessment(payload as any);

      const savedAssessmentId = savedAssessment?.id || existingAssessmentId;
      if (savedAssessmentId) {
        setAssessmentResourceIds((previous) => ({ ...previous, [savedAssessmentId]: resourceId }));
        if (assessmentStatus === 'published') {
          await assessmentEnrollmentService.publishAssessmentToSubjectStudents({
            assessmentId: savedAssessmentId,
            subjectId: selectedSubjectId,
            assignedBy: context.currentUserId,
            title: assessmentName.trim(),
            instructions: assessmentDescription.trim() || undefined,
            statusCode: 'assigned',
          });
        }
      }

      await refreshWorkspaceData();
      setWorkspaceOperationFeedback({
        status: 'success',
        title: assessmentStatus === 'published' ? 'Practice published' : 'Practice saved',
        message: assessmentStatus === 'published'
          ? `"${assessmentName.trim()}" is now available to students.`
          : `"${assessmentName.trim()}" was saved as draft.`,
      });
      return savedAssessmentId || null;
    } catch (error: any) {
      setWorkspaceOperationFeedback({
        status: 'error',
        title: 'Practice save failed',
        message: error?.message || 'Please try again.',
      });
      throw error;
    }
  };

  const handleQuickCreate = (type: TopicContentType) => {
    if (!selectedTopic) return;
    openTopicWorkspace(selectedTopic.id, type);
  };

  const handleCreateWorkspaceItem = () => {
    if (!selectedTopic) return;
    setSelectedWorkspaceItem('');
    setSelectionActionOverlay(null);
    setSelectionActionHint(null);
    if (workspaceTab === 'assessment') {
      setAssessmentName('');
      setAssessmentType('quiz');
      setAssessmentDescription('');
      setAssessmentMaxScore('100');
      setAssessmentWeight('0');
      setAssessmentTimeLimit('0');
      setAssessmentAttempts('1');
      setAssessmentStatus('draft');
      setAssessmentVisibility('private');
      setAssessmentQuestions([]);
      setAssessmentAiPrompt('');
      setAssessmentAiLogs([]);
      setAssessmentAttachedFileName('');
      setIsAssessmentConfigured(false);
      setToastMessage('Start creating a new practice on the canvas.');
      return;
    }

    setEditorTitle('');
    setEditorBody('');
    setToastMessage(`Start creating a new ${getTopicContentLabelLower(workspaceTab, true)}.`);
  };

  const handleMarkItemUpdated = (type: TopicContentType, item: string) => {
    if (!selectedTopic) return;
    setTopics((previous) =>
      previous.map((topic) => (topic.id === selectedTopic.id ? { ...topic, updatedAtLabel: 'Updated just now' } : topic))
    );
    setToastMessage(`Marked "${item}" in ${TOPIC_CONTENT_LABELS[type]} as updated.`);
  };

  const handleDuplicateWorkspaceItem = async (item: string) => {
    if (!selectedTopic) return;

    const existingNames = new Set(selectedTopic.materials[workspaceTab]);
    let duplicateName = `${item} (Copy)`;
    let suffix = 2;
    while (existingNames.has(duplicateName)) {
      duplicateName = `${item} (Copy ${suffix})`;
      suffix += 1;
    }

    const sourceKey = getMaterialDraftKey(selectedTopic.id, workspaceTab, item);
    const sourceId = materialRecordIds[sourceKey];
    try {
      if (workspaceTab === 'assessment' && sourceId) {
        const assessmentDetail = await assessmentService.getAssessmentWithQuestions(sourceId);
        const sourceResourceId = assessmentResourceIds[sourceId] || assessmentDetail.resourceId || null;
        let duplicatedResourceId: string | null = null;
        if (sourceResourceId) {
          const sourceResource = await resourceService.get(sourceResourceId);
          duplicatedResourceId = await createOrUpdateWorkspaceResource('draft', {
            title: duplicateName,
            body: sourceResource.contentBody || buildAssessmentResourceContent(selectedTopic.title, duplicateName, assessmentDetail.description || '', []),
            type: 'assessment',
          });
        }
        const duplicatedAssessment = await assessmentService.createAssessment({
          schoolId: activeSchoolId,
          subjectId: selectedSubjectId,
          name: duplicateName,
          description: assessmentDetail.description || '',
          assessmentType: assessmentDetail.assessmentType || 'quiz',
          visibility: assessmentDetail.visibility || 'private',
          timeLimitMin: assessmentDetail.timeLimitMin,
          attemptsAllowed: assessmentDetail.attemptsAllowed,
          maxScore: assessmentDetail.maxScore || 100,
          weightPct: assessmentDetail.weightPct || 0,
          resourceId: duplicatedResourceId,
          aiEnhanced: assessmentDetail.aiEnhanced || false,
          status: 'draft',
          createdBy: authService.getCurrentUser()?.id,
          lastModifiedBy: authService.getCurrentUser()?.id,
          questions: (assessmentDetail.questions || []).map((question: any, index: number) => ({
            stem: question.stem,
            questionTypeCode: question.questionTypeCode,
            maxMark: question.maxMark,
            difficulty: question.difficulty,
            rubricJson: question.rubricJson,
            sequenceIndex: index + 1,
            points: question.points,
          })),
        } as any);
        if (duplicatedAssessment?.id && duplicatedResourceId) {
          setAssessmentResourceIds((previous) => ({ ...previous, [duplicatedAssessment.id]: duplicatedResourceId }));
        }
      } else {
        const sourceBody =
          materialDrafts[sourceKey] || buildSeedMaterialDraft(selectedTopic.title, item, workspaceTab);
        const duplicatedId = await createOrUpdateWorkspaceResource('draft', {
          title: duplicateName,
          body: sourceBody,
          type: workspaceTab,
        });
        if (!duplicatedId) return;
      }
      await refreshWorkspaceData();
      setSelectedWorkspaceItem(duplicateName);
      setEditorTitle(duplicateName);
      setToastMessage(`Duplicated "${item}" as "${duplicateName}".`);
    } catch (error: any) {
      setToastMessage(error?.message || `Failed to duplicate "${item}".`);
    }
  };

  const handleDeleteWorkspaceItem = async (item: string) => {
    if (!selectedTopic) return;
    const confirmed = window.confirm(`Delete "${item}" from ${TOPIC_CONTENT_LABELS[workspaceTab]}?`);
    if (!confirmed) return;

    const deleteKey = getMaterialDraftKey(selectedTopic.id, workspaceTab, item);
    const recordId = materialRecordIds[deleteKey];
    try {
      if (workspaceTab === 'assessment' && recordId) {
        await assessmentService.deleteAssessment(recordId);
        const linkedResourceId = assessmentResourceIds[recordId];
        if (linkedResourceId) {
          await resourceService.delete(linkedResourceId);
        }
      } else if (recordId) {
        await resourceService.delete(recordId);
      }
      setMaterialDrafts((previous) => {
        const next = { ...previous };
        delete next[deleteKey];
        return next;
      });
      await refreshWorkspaceData();
      if (selectedWorkspaceItem === item) {
        setSelectedWorkspaceItem('');
        setEditorTitle('');
        setEditorBody('');
        setSelectionActionOverlay(null);
        setSelectionActionHint(null);
      }
      setToastMessage(`Deleted "${item}" from ${TOPIC_CONTENT_LABELS[workspaceTab]}.`);
    } catch (error: any) {
      setToastMessage(error?.message || `Failed to delete "${item}".`);
    }
  };

  const handleEditorBodyChange = (nextBody: string) => {
    const normalizedBody = normalizeEditorContent(nextBody);
    setEditorBody(normalizedBody);
    if (!selectedMaterialKey) return;
    setMaterialDrafts((previous) => ({
      ...previous,
      [selectedMaterialKey]: normalizedBody,
    }));
  };

  const applyEditorStateFromDom = () => {
    if (!editorSurfaceRef.current) return;
    handleEditorBodyChange(editorSurfaceRef.current.innerHTML);
  };

  const captureEditorSelection = () => {
    if (!editorSurfaceRef.current) {
      setSelectionActionOverlay(null);
      return;
    }
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      setSelectionActionOverlay(null);
      return;
    }

    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const rootNode =
      container.nodeType === Node.TEXT_NODE ? container.parentNode : container;
    const selectedText = selection.toString().replace(/\s+/g, ' ').trim();

    if (rootNode && editorSurfaceRef.current.contains(rootNode)) {
      savedSelectionRef.current = range.cloneRange();
      if (!range.collapsed && selectedText.length > 0 && editorOverlayHostRef.current) {
        const hostRect = editorOverlayHostRef.current.getBoundingClientRect();
        const rangeRect = range.getBoundingClientRect();
        if (rangeRect.width > 0 || rangeRect.height > 0) {
          const railWidth = 44;
          const left = Math.max(
            8,
            Math.min(
              rangeRect.right - hostRect.left + 10,
              hostRect.width - railWidth - 8
            )
          );
          const top = Math.max(
            8,
            Math.min(
              rangeRect.top - hostRect.top + (rangeRect.height > 0 ? rangeRect.height / 2 - 22 : 0),
              Math.max(8, hostRect.height - 88)
            )
          );
          setSelectionActionOverlay({
            top,
            left,
            text: selectedText,
          });
          return;
        }
      }
    }

    setSelectionActionOverlay(null);
    setSelectionActionHint(null);
  };

  const restoreEditorSelection = () => {
    const selection = window.getSelection();
    if (!selection || !savedSelectionRef.current) return;
    selection.removeAllRanges();
    selection.addRange(savedSelectionRef.current);
  };

  const preserveEditorSelectionOnMouseDown = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    captureEditorSelection();
  };

  const handleSelectionAction = (action: SelectionActionType) => {
    if (!selectionActionOverlay?.text) return;
    const excerpt = selectionActionOverlay.text;
    setIsAiCollaboratorExpanded(true);

    if (action === 'change') {
      setAiPrompt(`Make targeted edits to this highlighted section while preserving meaning:\n"${excerpt}"`);
      setToastMessage('Selection sent to AI: Make changes.');
      return;
    }

    if (action === 'different') {
      setAiPrompt(`Rewrite this highlighted section using a different approach:\n"${excerpt}"`);
      setToastMessage('Selection sent to AI: Try differently.');
      return;
    }

    setAiChatInput(`Help me improve this selected section: "${excerpt}"`);
    setToastMessage('Selection sent to AI assistant chat.');
  };

  const executeEditorCommand = (command: string, value?: string) => {
    if (!editorSurfaceRef.current) return;
    editorSurfaceRef.current.focus();
    restoreEditorSelection();
    document.execCommand(command, false, value);
    captureEditorSelection();
    applyEditorStateFromDom();
  };

  const handleInsertLink = () => {
    const url = window.prompt('Enter link URL');
    if (!url) return;
    executeEditorCommand('createLink', url);
  };

  const handleOpenImagePicker = () => {
    if (!editorImageInputRef.current) return;
    editorImageInputRef.current.value = '';
    editorImageInputRef.current.click();
  };

  const handleInsertImageFromPicker = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToastMessage('Please select a valid image file.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setToastMessage('Failed to load selected image.');
        return;
      }
      const safeAlt = file.name.replace(/"/g, '');
      const imageHtml = `<p><img src="${reader.result}" alt="${safeAlt}" style="max-width:100%;height:auto;border-radius:8px;" /></p><p><br /></p>`;
      executeEditorCommand('insertHTML', imageHtml);
      setToastMessage(`Inserted image "${file.name}".`);
    };
    reader.onerror = () => {
      setToastMessage('Failed to load selected image.');
    };
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const handleInsertTable = () => {
    const rows = Number(window.prompt('Rows', '2') || '2');
    const cols = Number(window.prompt('Columns', '2') || '2');
    if (!rows || !cols || rows < 1 || cols < 1) return;

    const bodyRows = Array.from({ length: rows })
      .map(
        () =>
          `<tr>${Array.from({ length: cols })
            .map(() => '<td style="border:1px solid #cbd5e1;padding:6px;">&nbsp;</td>')
            .join('')}</tr>`
      )
      .join('');
    const tableHtml = `<table style="border-collapse:collapse;width:100%;margin:8px 0;">${bodyRows}</table><p><br /></p>`;
    executeEditorCommand('insertHTML', tableHtml);
  };

  const handleEditorBlockStyleChange = (style: EditorBlockStyle) => {
    setEditorBlockStyle(style);

    if (style === 'Bulleted list') {
      executeEditorCommand('insertUnorderedList');
      return;
    }
    if (style === 'Numbered list') {
      executeEditorCommand('insertOrderedList');
      return;
    }
    if (style === 'Lettered list') {
      executeEditorCommand('insertOrderedList');
      const selection = window.getSelection();
      const node = selection?.anchorNode || null;
      const element = node instanceof Element ? node : node?.parentNode instanceof Element ? node.parentNode : null;
      const listNode = element?.closest('ol');
      if (listNode) {
        (listNode as HTMLOListElement).style.listStyleType = 'lower-alpha';
      }
      applyEditorStateFromDom();
      return;
    }
    if (style === 'Code block') {
      executeEditorCommand('formatBlock', 'pre');
      return;
    }

    const blockMap: Record<Exclude<EditorBlockStyle, 'Bulleted list' | 'Numbered list' | 'Lettered list' | 'Code block'>, string> = {
      Paragraph: 'p',
      Title: 'h1',
      Heading: 'h2',
      Subheading: 'h3',
      'Block quote': 'blockquote',
    };
    executeEditorCommand('formatBlock', blockMap[style as keyof typeof blockMap]);
  };

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      executeEditorCommand('insertHTML', '&nbsp;&nbsp;&nbsp;&nbsp;');
    }
  };

  const ensureActiveWorkspaceItem = () => {
    if (!selectedTopic) return null;
    if (selectedWorkspaceItem) return selectedWorkspaceItem;

    const autoTitle = editorTitle.trim() || `${toTitleCase(workspaceTab)} draft ${selectedTopic.materials[workspaceTab].length + 1}`;
    setTopics((previous) =>
      previous.map((topic) => {
        if (topic.id !== selectedTopic.id) return topic;
        return {
          ...topic,
          resourcesCount: workspaceTab === 'resource' ? topic.resourcesCount + 1 : topic.resourcesCount,
          practicesCount: workspaceTab === 'practice' ? topic.practicesCount + 1 : topic.practicesCount,
          assessmentsCount: workspaceTab === 'assessment' ? topic.assessmentsCount + 1 : topic.assessmentsCount,
          updatedAtLabel: 'Updated just now',
          materials: {
            ...topic.materials,
            [workspaceTab]: [autoTitle, ...topic.materials[workspaceTab]],
          },
        };
      })
    );
    setSelectedWorkspaceItem(autoTitle);
    return autoTitle;
  };

  const handleSaveMaterialDraft = () => {
    if (!selectedTopic) {
      setToastMessage('Select a topic first.');
      return;
    }

    const activeItem = selectedWorkspaceItem || ensureActiveWorkspaceItem();
    if (!activeItem) {
      setToastMessage('Enter a title to create a new draft.');
      return;
    }

    const oldTitle = activeItem;
    const nextTitle = editorTitle.trim() || oldTitle;
    const oldKey = getMaterialDraftKey(selectedTopic.id, workspaceTab, oldTitle);
    const nextKey = getMaterialDraftKey(selectedTopic.id, workspaceTab, nextTitle);
    const nextBody = editorBody.trim() || materialDrafts[oldKey] || buildSeedMaterialDraft(selectedTopic.title, nextTitle, workspaceTab);

    const persist = async () => {
      try {
        const existingId = materialRecordIds[oldKey] || null;
        const savedId = await createOrUpdateWorkspaceResource('draft', {
          title: nextTitle,
          body: nextBody,
          type: workspaceTab,
          existingId,
        });
        if (!savedId) return;
        setMaterialDrafts((previous) => {
          const next = { ...previous };
          if (oldKey !== nextKey) delete next[oldKey];
          next[nextKey] = nextBody;
          return next;
        });
        setSelectedWorkspaceItem(nextTitle);
        setEditorTitle(nextTitle);
        setEditorBody(nextBody);
        setToastMessage(`Saved "${nextTitle}" in ${TOPIC_CONTENT_LABELS[workspaceTab]}.`);
      } catch (error: any) {
        setToastMessage(error?.message || `Failed to save "${nextTitle}".`);
      }
    };
    void persist();
  };

  const handlePublishMaterial = () => {
    if (!selectedTopic) {
      setToastMessage('Select a topic first.');
      return;
    }

    const activeItem = selectedWorkspaceItem || ensureActiveWorkspaceItem();
    if (!activeItem) {
      setToastMessage('Select or create a material item first.');
      return;
    }

    const oldTitle = activeItem;
    const nextTitle = editorTitle.trim() || oldTitle;
    const oldKey = getMaterialDraftKey(selectedTopic.id, workspaceTab, oldTitle);
    const nextKey = getMaterialDraftKey(selectedTopic.id, workspaceTab, nextTitle);
    const nextBody = editorBody.trim() || materialDrafts[oldKey] || buildSeedMaterialDraft(selectedTopic.title, nextTitle, workspaceTab);

    const persist = async () => {
      try {
        const existingId = materialRecordIds[oldKey] || null;
        const savedId = await createOrUpdateWorkspaceResource('published', {
          title: nextTitle,
          body: nextBody,
          type: workspaceTab,
          existingId,
        });
        if (!savedId) return;
        setMaterialDrafts((previous) => {
          const next = { ...previous };
          if (oldKey !== nextKey) delete next[oldKey];
          next[nextKey] = nextBody;
          return next;
        });
        setSelectedWorkspaceItem(nextTitle);
        setEditorTitle(nextTitle);
        setEditorBody(nextBody);
        setToastMessage(`Published "${nextTitle}" in ${TOPIC_CONTENT_LABELS[workspaceTab]}.`);
      } catch (error: any) {
        setToastMessage(error?.message || `Failed to publish "${nextTitle}".`);
      }
    };
    void persist();
  };

  const handleGenerateWithAi = (variant = false, teacherPrompt?: string) => {
    if (!selectedTopic) return;
    const activeTitle = ensureActiveWorkspaceItem();
    if (!activeTitle) return;

    const generatedBody = buildAiGeneratedDraft({
      topicTitle: selectedTopic.title,
      itemTitle: activeTitle,
      type: workspaceTab,
      gradeLevel: aiGradeLevel,
      objective: aiObjective,
      prompt: aiPrompt,
      variant,
    });

    const key = getMaterialDraftKey(selectedTopic.id, workspaceTab, activeTitle);
    setMaterialDrafts((previous) => ({
      ...previous,
      [key]: generatedBody,
    }));
    setEditorTitle(activeTitle);
    setEditorBody(generatedBody);

    setAiMessages((previous) => [
      ...previous,
      {
        id: `teacher-generate-${Date.now()}`,
        role: 'teacher',
        text:
          teacherPrompt ||
          (variant ? 'Try a different version for this draft.' : 'Generate a first draft for this item.'),
      },
      {
        id: `assistant-generate-${Date.now()}`,
        role: 'assistant',
        text: variant
          ? 'I created an alternative version with a different structure and pacing.'
          : `Draft ready for "${activeTitle}". Review and edit before publishing.`,
      },
    ]);
    setToastMessage(variant ? 'Generated an alternative AI draft.' : 'Generated AI draft.');
  };

  const handleSendAiMessage = () => {
    const message = aiChatInput.trim();
    const direction = aiPrompt.trim();
    const normalized = message.toLowerCase();

    if (!message && !direction) {
      setToastMessage('Type a message or add AI direction before sending.');
      return;
    }

    if (!message && direction) {
      handleGenerateWithAi(false, `Generate draft with this AI direction: ${direction}`);
      setAiChatInput('');
      return;
    }

    if (normalized.includes('try something different') || normalized.includes('alternative version')) {
      handleGenerateWithAi(true, message);
      setAiChatInput('');
      return;
    }

    if (normalized.includes('generate') || normalized.includes('draft') || normalized.includes('create')) {
      handleGenerateWithAi(false, message);
      setAiChatInput('');
      return;
    }

    setAiMessages((previous) => [
      ...previous,
      { id: `teacher-chat-${Date.now()}`, role: 'teacher', text: message },
      {
        id: `assistant-chat-${Date.now()}`,
        role: 'assistant',
        text: `Suggested next step: refine "${selectedWorkspaceItem || `${toTitleCase(workspaceTab)} draft`}" to align with ${aiObjective || selectedTopic?.title || 'the topic goal'} and then run "Generate draft" again.`,
      },
    ]);
    setAiChatInput('');
  };

  const handleAssessmentAiGenerate = () => {
    const prompt = assessmentAiPrompt.trim();
    if (!prompt) {
      setToastMessage('Enter a prompt for AI collaborator.');
      return;
    }

    setAssessmentAiLogs((previous) => [
      ...previous,
      `Prompt: ${prompt}`,
      'AI generated a draft suggestion for the practice canvas.',
    ]);
    setAssessmentAiPrompt('');
  };

  const handleAssessmentAttachFile = () => {
    assessmentAttachmentInputRef.current?.click();
  };

  const handleAssessmentAttachmentChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAssessmentAttachedFileName(file.name);
    setAssessmentAiLogs((previous) => [...previous, `Attached file: ${file.name}`]);
    event.target.value = '';
  };

  const handleAddAssessmentQuestion = () => {
    setAssessmentQuestions((previous) => [
      ...previous,
      {
        id: `q-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        prompt: '',
        type: 'short-answer',
        marks: 1,
        options: '',
      },
    ]);
  };

  const handleUpdateAssessmentQuestion = (
    questionId: string,
    patch: Partial<AssessmentQuestion>
  ) => {
    setAssessmentQuestions((previous) =>
      previous.map((question) =>
        question.id === questionId ? { ...question, ...patch } : question
      )
    );
  };

  const handleRemoveAssessmentQuestion = (questionId: string) => {
    setAssessmentQuestions((previous) =>
      previous.filter((question) => question.id !== questionId)
    );
  };

  const handlePrintWorkspace = () => {
    const printableTitle =
      editorTitle.trim() ||
      selectedWorkspaceItem ||
      `${toTitleCase(workspaceTab)} draft`;
    const printableHtml = (
      editorSurfaceRef.current?.innerHTML ||
      toEditorHtml(editorBody)
    ).trim();

    if (!printableHtml) {
      setToastMessage('Nothing to print yet.');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
    if (!printWindow) {
      setToastMessage('Unable to open print preview.');
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${printableTitle}</title>
          <style>
            body {
              margin: 28px;
              font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
              color: #0f172a;
              line-height: 1.6;
            }
            h1 {
              margin: 0 0 16px;
              font-size: 22px;
              line-height: 1.3;
            }
            p {
              margin: 0 0 10px;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            td, th {
              border: 1px solid #cbd5e1;
              padding: 6px;
            }
            img {
              max-width: 100%;
              height: auto;
            }
          </style>
        </head>
        <body>
          <h1>${printableTitle}</h1>
          <div>${printableHtml}</div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 120);
  };

  const handleShareWorkspace = async () => {
    const shareData = {
      title: `${selectedTopic?.title || 'Topic'} Workspace`,
      text: `Review this draft from ${TOPIC_CONTENT_LABELS[workspaceTab]}.`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // fall through to clipboard fallback
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      setToastMessage('Workspace link copied to clipboard.');
    } catch {
      setToastMessage('Unable to share right now.');
    }
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timeoutId = window.setTimeout(() => setToastMessage(null), 2600);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  useEffect(() => {
    if (!workspaceOperationFeedback || workspaceOperationFeedback.status === 'loading') return;
    const timeoutId = window.setTimeout(() => setWorkspaceOperationFeedback(null), 4200);
    return () => window.clearTimeout(timeoutId);
  }, [workspaceOperationFeedback]);

  useEffect(() => {
    const handleSelectionChange = () => {
      captureEditorSelection();
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  const isPracticeConfigured = Boolean(
    editorTitle.trim() || selectedWorkspaceItem || editorBody.trim()
  );
  const isWorkspaceActionLoading = workspaceOperationFeedback?.status === 'loading';

  return (
    <ClassroomLayout
      showStudentProfileTab={false}
      classroomWorkspaceNav
      activeClassroomAction={workspaceNavView === 'my-subjects' ? 'classroom-my-subjects' : 'classroom-subject'}
      onClassroomMySubjects={() => {
        setWorkspaceNavView('my-subjects');
        setIsTopicWorkspaceOpen(false);
      }}
      onClassroomSubject={() => setWorkspaceNavView('subject')}
    >
      <div className="space-y-5">
        {workspaceOperationFeedback && (
          <div
            className={`fixed right-6 top-24 z-50 w-[min(420px,calc(100vw-2rem))] rounded-md border px-3 py-2 shadow-lg ${
              workspaceOperationFeedback.status === 'loading'
                ? 'border-blue-200 bg-blue-50'
                : workspaceOperationFeedback.status === 'success'
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-rose-200 bg-rose-50'
            }`}
          >
            <div className="flex items-start gap-2">
              {workspaceOperationFeedback.status === 'loading' ? (
                <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-blue-700" />
              ) : workspaceOperationFeedback.status === 'success' ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-700" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 text-rose-700" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    workspaceOperationFeedback.status === 'loading'
                      ? 'text-blue-800'
                      : workspaceOperationFeedback.status === 'success'
                        ? 'text-emerald-800'
                        : 'text-rose-800'
                  }`}
                >
                  {workspaceOperationFeedback.title}
                </p>
                <p
                  className={`text-xs ${
                    workspaceOperationFeedback.status === 'loading'
                      ? 'text-blue-700'
                      : workspaceOperationFeedback.status === 'success'
                        ? 'text-emerald-700'
                        : 'text-rose-700'
                  }`}
                >
                  {workspaceOperationFeedback.message}
                </p>
              </div>
            </div>
          </div>
        )}
        {toastMessage && (
          <div className={`fixed right-6 z-50 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-lg ${workspaceOperationFeedback ? 'top-44' : 'top-24'}`}>
            {toastMessage}
          </div>
        )}

        {workspaceNavView === 'my-subjects' ? (
          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">My Subjects</h2>
                <p className="text-sm text-slate-500">Subjects currently assigned to you for teaching.</p>
              </div>
            </div>

            {subjects.length === 0 ? (
              <p className="text-sm text-slate-500">No assigned subjects found.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {subjects.map((subject) => {
                  const isSelected = selectedSubjectId === subject.id;
                  return (
                    <div
                      key={subject.id}
                      className={`rounded-lg border p-4 ${isSelected ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}
                    >
                      <p className="text-xs text-slate-500">{subject.code || 'SUBJECT'}</p>
                      <h3 className="mt-1 text-sm font-semibold text-slate-900">{subject.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(subject.grades && subject.grades.length > 0 ? subject.grades : ['All forms']).map((grade) => (
                          <span key={`${subject.id}-${grade}`} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {grade}
                          </span>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubjectId(subject.id);
                          setWorkspaceNavView('subject');
                          setView('overview');
                          setIsTopicWorkspaceOpen(false);
                        }}
                        className="mt-3 inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Open Subject Workspace
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
        {workspaceError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {workspaceError}
          </div>
        )}

        {workspaceLoading && !isTopicWorkspaceOpen && (
          <div className="space-y-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <div className="h-10 w-full rounded-md bg-slate-200 sm:w-72 animate-pulse" />
                  <div className="h-10 w-full rounded-md bg-slate-200 sm:w-52 animate-pulse" />
                  <div className="h-10 w-full rounded-md bg-slate-200 sm:w-36 animate-pulse" />
                  <div className="h-10 w-full rounded-md bg-slate-200 sm:w-40 animate-pulse" />
                </div>
                <div className="h-9 w-56 rounded-md bg-slate-200 animate-pulse" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.5fr_1fr]">
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, unitIndex) => (
                    <div key={`unit-skeleton-${unitIndex}`} className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                        <div className="h-4 w-36 rounded bg-slate-200 animate-pulse" />
                        <div className="h-3 w-16 rounded bg-slate-200 animate-pulse" />
                      </div>
                      <div className="divide-y divide-slate-100">
                        {Array.from({ length: 2 }).map((_, topicIndex) => (
                          <div key={`topic-skeleton-${unitIndex}-${topicIndex}`} className="px-3 py-3">
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 space-y-2">
                                <div className="h-4 w-64 rounded bg-slate-200 animate-pulse" />
                                <div className="h-3 w-40 rounded bg-slate-200 animate-pulse" />
                              </div>
                              <div className="grid grid-cols-3 gap-2">
                                <div className="h-7 w-14 rounded bg-slate-200 animate-pulse" />
                                <div className="h-7 w-14 rounded bg-slate-200 animate-pulse" />
                                <div className="h-7 w-14 rounded bg-slate-200 animate-pulse" />
                              </div>
                            </div>
                            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 animate-pulse" />
                            <div className="mt-2 h-3 w-52 rounded bg-slate-200 animate-pulse" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded bg-slate-200 animate-pulse" />
                  <div className="h-6 w-56 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-slate-200 animate-pulse" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="h-16 rounded-md bg-slate-200 animate-pulse" />
                  <div className="h-16 rounded-md bg-slate-200 animate-pulse" />
                  <div className="h-16 rounded-md bg-slate-200 animate-pulse" />
                </div>
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, itemIndex) => (
                    <div key={`content-skeleton-${itemIndex}`} className="rounded-md border border-slate-200 p-2">
                      <div className="h-3 w-28 rounded bg-slate-200 animate-pulse" />
                      <div className="mt-2 h-3 w-full rounded bg-slate-200 animate-pulse" />
                      <div className="mt-1 h-3 w-4/5 rounded bg-slate-200 animate-pulse" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {isAssessmentConfigOpen && (
          <div
            className="fixed inset-0 z-[64] flex items-center justify-center bg-slate-900/35 p-4"
            onClick={() => setIsAssessmentConfigOpen(false)}
          >
            <div
              className="w-full max-w-3xl rounded-lg border border-slate-200 bg-white p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Practice Configuration</p>
                <button
                  type="button"
                  onClick={() => setIsAssessmentConfigOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-gray-500">Subject</label>
                    <select
                      value={selectedSubjectId}
                      onChange={(event) => setSelectedSubjectId(event.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    >
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Practice Type</label>
                    <select
                      value={assessmentType}
                      onChange={(event) => setAssessmentType(event.target.value as typeof assessmentType)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="quiz">Quiz</option>
                      <option value="assignment">Assignment</option>
                      <option value="test">Test</option>
                      <option value="project">Project</option>
                      <option value="exam">Exam</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Description</label>
                  <textarea
                    value={assessmentDescription}
                    onChange={(event) => setAssessmentDescription(event.target.value)}
                    className="min-h-[100px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    placeholder="Define the outcome and scope for learners"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="text-xs text-gray-500">Max Score</label>
                    <input
                      type="number"
                      min="1"
                      value={assessmentMaxScore}
                      onChange={(event) => setAssessmentMaxScore(event.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Weight %</label>
                    <input
                      type="number"
                      min="0"
                      value={assessmentWeight}
                      onChange={(event) => setAssessmentWeight(event.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Time Limit (min)</label>
                    <input
                      type="number"
                      min="0"
                      value={assessmentTimeLimit}
                      onChange={(event) => setAssessmentTimeLimit(event.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Attempts Allowed</label>
                    <input
                      type="number"
                      min="1"
                      value={assessmentAttempts}
                      onChange={(event) => setAssessmentAttempts(event.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-xs text-gray-500">Status</label>
                    <select
                      value={assessmentStatus}
                      onChange={(event) => setAssessmentStatus(event.target.value as typeof assessmentStatus)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="published">Published</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Visibility</label>
                    <select
                      value={assessmentVisibility}
                      onChange={(event) => setAssessmentVisibility(event.target.value as typeof assessmentVisibility)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAssessmentConfigOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAssessmentConfigured(true);
                    setIsAssessmentConfigOpen(false);
                    setToastMessage('Practice configuration saved.');
                  }}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Save configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {isMaterialConfigOpen && selectedTopic && (
          <div
            className="fixed inset-0 z-[63] flex items-center justify-center bg-slate-900/35 p-4"
            onClick={() => setIsMaterialConfigOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">Material Configuration</p>
                <button
                  type="button"
                  onClick={() => setIsMaterialConfigOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Content type
                  <input
                    readOnly
                    value={TOPIC_CONTENT_LABELS[workspaceTab]}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Topic
                  <input
                    readOnly
                    value={selectedTopic.title}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                  />
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Material title
                  <input
                    value={editorTitle}
                    onChange={(event) => setEditorTitle(event.target.value)}
                    placeholder={`Title for ${getTopicContentLabelLower(workspaceTab, true)}`}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsMaterialConfigOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsMaterialConfigOpen(false);
                    setToastMessage('Material configuration saved.');
                  }}
                  className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  Save configuration
                </button>
              </div>
            </div>
          </div>
        )}

        {isAiConfigOpen && (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/35 p-4"
            onClick={() => setIsAiConfigOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">AI Collaborator Settings</p>
                <button
                  type="button"
                  onClick={() => setIsAiConfigOpen(false)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-600">
                  Grade level
                  <select
                    value={aiGradeLevel}
                    onChange={(event) => setAiGradeLevel(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="Form 3">Form 3</option>
                    <option value="Form 4">Form 4</option>
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600">
                  Learning objective
                  <input
                    value={aiObjective}
                    onChange={(event) => setAiObjective(event.target.value)}
                    placeholder="e.g. Explain database normalization"
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs"
                  />
                </label>
              </div>
            </div>
          </div>
        )}

        {!isTopicWorkspaceOpen && !workspaceLoading && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
                <div className="relative w-full sm:w-72">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    value={topicQuery}
                    onChange={(event) => setTopicQuery(event.target.value)}
                    placeholder="Search topic or unit"
                    className="w-full rounded-md border border-slate-200 py-2 pl-9 pr-3 text-sm"
                  />
                </div>
                <select
                  value={selectedSubjectId}
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  className="w-full sm:w-auto min-w-[190px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code ? `${subject.code}: ${subject.name}` : subject.name}
                    </option>
                  ))}
                </select>
                <select
                  value={formFilter}
                  onChange={(event) => setFormFilter(event.target.value as 'all' | FormLevel)}
                  className="w-full sm:w-auto min-w-[120px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="all">All forms</option>
                  <option value="Form 3">Form 3</option>
                  <option value="Form 4">Form 4</option>
                </select>
                <select
                  value={coverageFilter}
                  onChange={(event) => setCoverageFilter(event.target.value as 'all' | 'complete' | 'missing')}
                  className="w-full sm:w-auto min-w-[150px] rounded-md border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="all">All coverage</option>
                  <option value="complete">Complete only</option>
                  <option value="missing">Missing material</option>
                </select>
              </div>
              <div className="inline-flex rounded-md border border-slate-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setView('overview')}
                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                    view === 'overview' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Topic overview
                </button>
                <button
                  type="button"
                  onClick={() => setView('missing')}
                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                    view === 'missing' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  Missing material
                </button>
              </div>
            </div>
          </div>
        )}

        {!isTopicWorkspaceOpen && !workspaceLoading && (
          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-5">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              {view === 'overview' ? (
                <div className="space-y-4">
                  {Object.entries(groupedTopics).length === 0 && (
                    <p className="text-sm text-slate-500">No topics match the current filters.</p>
                  )}
                  {Object.entries(groupedTopics).map(([unit, unitTopics]) => (
                    <div key={unit} className="rounded-lg border border-slate-200 overflow-hidden">
                      <div className="flex items-center justify-between bg-slate-50 px-3 py-2">
                        <div className="text-sm font-semibold text-slate-800">{unit}</div>
                        <div className="text-xs text-slate-500">{unitTopics.length} topics</div>
                      </div>
                      <div className="divide-y divide-slate-100">
                        {unitTopics.map((topic) => {
                          const missingTypes = getTopicMissingTypes(topic);
                          const isSelected = selectedTopicId === topic.id;
                          return (
                            <button
                              key={topic.id}
                              onClick={() => setSelectedTopicId(topic.id)}
                              className={`w-full px-3 py-3 text-left hover:bg-slate-50 transition-colors ${
                                isSelected ? 'bg-blue-50' : 'bg-white'
                              }`}
                            >
                              <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-900 truncate">{topic.title}</p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                    <span className="rounded-full bg-slate-100 px-2 py-0.5">{topic.form}</span>
                                    <span>{topic.updatedAtLabel}</span>
                                    <span className="font-medium">{toTopicCoverageStatus(topic)}</span>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                                  <span className="relative group inline-flex justify-center">
                                    <span className="rounded-md border border-slate-200 px-2 py-1">R: {topic.resourcesCount}</span>
                                    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                      Resources: {topic.resourcesCount}
                                    </span>
                                  </span>
                                  <span className="relative group inline-flex justify-center">
                                    <span className="rounded-md border border-slate-200 px-2 py-1">P: {topic.assessmentsCount}</span>
                                    <span className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-2 py-1 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                                      Practices: {topic.assessmentsCount}
                                    </span>
                                  </span>
                                </div>
                              </div>
                              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    topic.masteryPercent >= 70
                                      ? 'bg-emerald-500'
                                      : topic.masteryPercent >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-rose-500'
                                  }`}
                                  style={{ width: `${topic.masteryPercent}%` }}
                                />
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                Mastery {topic.masteryPercent}% {missingTypes.length ? `• Missing ${missingTypes.map((type) => getTopicContentLabelLower(type, true)).join(', ')}` : ''}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {missingRows.length === 0 ? (
                    <p className="text-sm text-slate-500">No missing material found for the current filters.</p>
                  ) : (
                    missingRows.map((row) => (
                      <div key={`${row.topicId}-${row.missingType}`} className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-900">{row.topicTitle}</p>
                            <p className="text-xs text-slate-600">{row.unit} • {row.form}</p>
                            <p className="text-xs text-amber-700 mt-1">Missing {getTopicContentLabelLower(row.missingType, true)}</p>
                          </div>
                          <button
                            onClick={() => openMissingItemComposer(row.topicId, row.missingType)}
                            className="px-3 py-1.5 rounded-md text-xs font-medium bg-white border border-amber-200 text-amber-800 hover:bg-amber-100"
                          >
                            Add missing material
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm space-y-4">
              {selectedTopic ? (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-2 min-w-0">
                      <p className="text-xs text-slate-500">{selectedTopic.unit} • {selectedTopic.form}</p>
                      <h3 className="text-lg font-semibold text-slate-900">{selectedTopic.title}</h3>
                      <p className="text-xs text-slate-500 mt-1">{selectedTopic.updatedAtLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openTopicWorkspace(selectedTopic.id, 'resource')}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      Open topic workspace
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`rounded-md border p-2 ${selectedTopic.resourcesCount === 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                      <p className="text-slate-500">Resources</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedTopic.resourcesCount}</p>
                    </div>
                    <div className={`rounded-md border p-2 ${selectedTopic.assessmentsCount === 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-slate-50'}`}>
                      <p className="text-slate-500">Practices</p>
                      <p className="text-sm font-semibold text-slate-900">{selectedTopic.assessmentsCount}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Topic content</p>
                    {WORKSPACE_CONTENT_TYPES.map((type) => (
                      <div key={type} className="rounded-md border border-slate-200 p-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-slate-700">{getTopicContentLabel(type, true)}</p>
                          <button
                            onClick={() => handleQuickCreate(type)}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            {type === 'assessment' ? 'Create' : 'Add'}
                          </button>
                        </div>
                        <ul className="mt-1 space-y-1">
                          {selectedTopic.materials[type].length ? (
                            selectedTopic.materials[type].map((item) => (
                              <li key={item} className="text-xs text-slate-600 truncate">• {item}</li>
                            ))
                          ) : (
                            <li className="text-xs text-slate-400">No items yet.</li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>

                </>
              ) : (
                <p className="text-sm text-slate-500">Select a topic to view content and manage materials.</p>
              )}
            </div>
          </div>
        )}

        {isTopicWorkspaceOpen && selectedTopic && (
          <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs text-slate-500">{selectedTopic.unit} • {selectedTopic.form}</p>
                <h3 className="text-lg font-semibold text-slate-900">{selectedTopic.title}</h3>
                <p className="text-xs text-slate-500">Topic workspace with content navigation and create/update actions</p>
              </div>
              <button
                type="button"
                  onClick={() => {
                    setIsStudioExpanded(false);
                    setIsTopicContentCollapsed(false);
                    setIsAiCollaboratorExpanded(false);
                    setSelectionActionOverlay(null);
                    setSelectionActionHint(null);
                    setIsMaterialConfigOpen(false);
                    setIsAssessmentConfigOpen(false);
                    setIsTopicWorkspaceOpen(false);
                  }}
                className="inline-flex items-center gap-1 self-start rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to topic overview
              </button>
            </div>

            {isStudioExpanded && <div className="fixed inset-0 z-40 bg-slate-900/35" />}
            <div
              className={`${
                isStudioExpanded
                  ? 'fixed inset-4 z-50 rounded-lg border border-slate-200 bg-white shadow-2xl overflow-hidden'
                  : ''
              }`}
            >
              <div className={isStudioExpanded ? 'h-full overflow-y-auto' : ''}>
                <div
                  className={
                    isStudioExpanded
                      ? 'grid grid-cols-1'
                      : `grid grid-cols-1 ${isTopicContentCollapsed ? 'lg:grid-cols-[72px_1fr]' : 'lg:grid-cols-[280px_1fr]'}`
                  }
                >
              {!isStudioExpanded && (
                <aside
                  className={`border-b border-slate-200 bg-slate-50 transition-all duration-200 lg:border-b-0 lg:border-r ${
                    isTopicContentCollapsed ? 'p-2' : 'p-3'
                  }`}
                >
                  <div className={`mb-2 flex items-center ${isTopicContentCollapsed ? 'justify-center' : 'justify-between'} gap-2`}>
                    {!isTopicContentCollapsed && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Topic content</p>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsTopicContentCollapsed((previous) => !previous)}
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      aria-label={isTopicContentCollapsed ? 'Expand topic content panel' : 'Collapse topic content panel'}
                      title={isTopicContentCollapsed ? 'Expand' : 'Collapse'}
                    >
                      {isTopicContentCollapsed ? (
                        <PanelRightOpen className="h-4 w-4" />
                      ) : (
                        <PanelRightClose className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {isTopicContentCollapsed ? (
                    <div className="space-y-1">
                      {WORKSPACE_CONTENT_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setWorkspaceTab(type)}
                          className={`w-full rounded-md border px-2 py-2 text-center text-[11px] font-semibold transition-colors ${
                            workspaceTab === type
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                          }`}
                          title={`${TOPIC_CONTENT_LABELS[type]} (${selectedTopic.materials[type].length})`}
                        >
                          {TOPIC_CONTENT_LABELS[type].charAt(0)}: {selectedTopic.materials[type].length}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border border-slate-200 bg-white p-2">
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Content types
                        </p>
                        <div className="space-y-1">
                          {WORKSPACE_CONTENT_TYPES.map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setWorkspaceTab(type)}
                              className={`w-full rounded-md border px-3 py-2 text-left text-xs font-semibold transition-colors ${
                                workspaceTab === type
                                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {TOPIC_CONTENT_LABELS[type]} ({selectedTopic.materials[type].length})
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-2">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            {TOPIC_CONTENT_LABELS[workspaceTab]} records
                          </p>
                          <button
                            type="button"
                            onClick={handleCreateWorkspaceItem}
                            disabled={isWorkspaceActionLoading}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-blue-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isWorkspaceActionLoading ? (
                              <>
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Working...
                              </>
                            ) : (
                              <>
                                <Plus className="h-3 w-3" />
                                {workspaceTab === 'assessment' ? 'Create' : 'Add'}
                              </>
                            )}
                          </button>
                        </div>
                        <div className="max-h-56 space-y-1 overflow-y-auto">
                          {selectedTopic.materials[workspaceTab].length > 0 ? (
                            selectedTopic.materials[workspaceTab].map((item) => (
                              <div
                                key={`${workspaceTab}-${item}`}
                                className={`flex items-center gap-1 rounded-md border p-1 ${
                                  selectedWorkspaceItem === item
                                    ? 'border-blue-200 bg-blue-50/40'
                                    : 'border-slate-200 bg-slate-50'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedWorkspaceItem(item)}
                                  className={`flex-1 rounded-md px-3 py-2 text-left text-xs ${
                                    selectedWorkspaceItem === item
                                      ? 'bg-blue-50 text-blue-700'
                                      : 'bg-white text-slate-600 hover:bg-slate-100'
                                  }`}
                                >
                                  {item}
                                </button>
                                <div className="flex items-center gap-0 rounded-md border border-slate-200">
                                  <button
                                    type="button"
                                    onClick={() => handleMarkItemUpdated(workspaceTab, item)}
                                    className="inline-flex items-center justify-center rounded-md p-2 text-blue-600 hover:text-blue-700"
                                    aria-label="Update record"
                                    title="Update"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateWorkspaceItem(item)}
                                    className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:text-slate-700"
                                    aria-label="Duplicate record"
                                    title="Duplicate"
                                  >
                                    <Copy className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteWorkspaceItem(item)}
                                    className="inline-flex items-center justify-center rounded-md p-2 text-rose-600 hover:text-rose-700"
                                    aria-label="Delete record"
                                    title="Delete"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-xs text-slate-500">
                              No {TOPIC_CONTENT_LABELS[workspaceTab].toLowerCase()} yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </aside>
              )}

              <div
                className={`grid grid-cols-1 gap-4 p-4 ${
                  isAiCollaboratorExpanded
                    ? 'xl:grid-cols-[minmax(0,1fr)_340px]'
                    : 'xl:grid-cols-[minmax(0,1fr)_56px]'
                }`}
              >
                {workspaceTab === 'assessment' ? (
                  <div className="col-span-full min-h-0 overflow-hidden">
                    <div className="mx-auto flex h-full max-w-7xl min-h-0 flex-col overflow-hidden">
                      <div className="min-h-0 flex-1">
                        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setToastMessage('Practice preview is in progress (UI preview).')}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Preview Practice
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsAssessmentConfigOpen(false);
                                  setIsTopicContentCollapsed(false);
                                  setIsTopicWorkspaceOpen(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      const savedAssessmentId = await persistAssessmentWorkspace();
                                      if (!savedAssessmentId) return;
                                      setIsAssessmentConfigured(true);
                                      setToastMessage(
                                        assessmentStatus === 'published'
                                          ? `Practice "${assessmentName.trim()}" published to students.`
                                          : `Practice "${assessmentName.trim()}" saved.`
                                      );
                                    } catch (error: any) {
                                      setToastMessage(error?.message || 'Failed to create practice.');
                                    }
                                  })();
                                }}
                                disabled={isWorkspaceActionLoading}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isWorkspaceActionLoading ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  'Create Practice'
                                )}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsStudioExpanded((previous) => !previous)}
                              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                              aria-label={isStudioExpanded ? 'Collapse practice workspace' : 'Expand practice workspace'}
                              title={isStudioExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isStudioExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>

                          <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
                            <div className="relative z-0 min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto p-6">
                              <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                                      Practice Canvas
                                    </h2>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                        isAssessmentConfigured
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {isAssessmentConfigured ? 'Configured' : 'Not configured'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => setIsAssessmentConfigOpen(true)}
                                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      <Settings2 className="h-3.5 w-3.5" />
                                      Configure
                                    </button>
                                      <button
                                        type="button"
                                        onClick={handleAddAssessmentQuestion}
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
                                      value={assessmentName}
                                      onChange={(event) => setAssessmentName(event.target.value)}
                                      placeholder="Enter practice name"
                                      className="mt-2 w-full rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900"
                                    />
                                  </label>
                                </div>
                                {assessmentQuestions.length === 0 ? (
                                  <div className="rounded-lg border border-dashed border-gray-300 p-6 text-sm text-gray-500">
                                    No practice questions yet. Add a question or ask AI collaborator to draft on the canvas.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {assessmentQuestions.map((question, index) => (
                                      <div key={question.id} className="rounded-lg border border-slate-200 bg-white p-4">
                                        <div className="mb-3 flex items-center justify-between gap-2">
                                          <p className="text-sm font-semibold text-slate-800">Question {index + 1}</p>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveAssessmentQuestion(question.id)}
                                            className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-100"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                            Remove
                                          </button>
                                        </div>
                                        <div className="space-y-3">
                                          <label className="block text-xs text-gray-500">
                                            Prompt
                                            <textarea
                                              value={question.prompt}
                                              onChange={(event) =>
                                                handleUpdateAssessmentQuestion(question.id, {
                                                  prompt: event.target.value,
                                                })
                                              }
                                              className="mt-1 min-h-[88px] w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                              placeholder="Write the question prompt here..."
                                            />
                                          </label>
                                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                            <label className="block text-xs text-gray-500">
                                              Response Type
                                              <select
                                                value={question.type}
                                                onChange={(event) =>
                                                  handleUpdateAssessmentQuestion(question.id, {
                                                    type: event.target.value as AssessmentQuestionType,
                                                  })
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                              >
                                                <option value="short-answer">Short answer</option>
                                                <option value="multiple-choice">Multiple choice</option>
                                              </select>
                                            </label>
                                            <label className="block text-xs text-gray-500">
                                              Marks
                                              <input
                                                type="number"
                                                min="1"
                                                value={question.marks}
                                                onChange={(event) =>
                                                  handleUpdateAssessmentQuestion(question.id, {
                                                    marks: Number(event.target.value) || 1,
                                                  })
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                              />
                                            </label>
                                          </div>
                                          {question.type === 'multiple-choice' && (
                                            <label className="block text-xs text-gray-500">
                                              Options (comma-separated)
                                              <input
                                                value={question.options}
                                                onChange={(event) =>
                                                  handleUpdateAssessmentQuestion(question.id, {
                                                    options: event.target.value,
                                                  })
                                                }
                                                className="mt-1 w-full rounded-md border border-gray-200 px-3 py-2 text-sm"
                                                placeholder="e.g. Option A, Option B, Option C, Option D"
                                              />
                                            </label>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </section>
                            </div>

                            <button
                              type="button"
                              className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-r border-slate-100 bg-slate-50 transition-colors hover:bg-blue-50 xl:flex"
                              aria-label="Resize AI collaborator panel"
                            >
                              <GripVertical className="h-8 w-3 text-slate-400" />
                            </button>

                            <aside
                              className={`relative z-10 overflow-hidden border-slate-100 bg-slate-50 transition-all duration-200 ${
                                isAiCollaboratorExpanded
                                  ? 'flex h-full flex-col gap-3 border-t bg-gradient-to-b from-slate-50 via-white to-slate-50 p-3 xl:border-l xl:border-t-0'
                                  : 'flex h-full flex-col items-center gap-2 border-t p-2.5 xl:border-l xl:border-t-0'
                              }`}
                              style={{ width: isAiCollaboratorExpanded ? 360 : 64 }}
                            >
                              {isAiCollaboratorExpanded ? (
                                <>
                                  <div className="rounded-xl border border-slate-200 bg-white/90 p-3 shadow-sm">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                                          <Bot className="h-4 w-4" />
                                        </span>
                                        <div className="min-w-0">
                                          <p className="truncate text-sm font-semibold text-slate-800">AI Collaborator</p>
                                          <p className="text-[11px] text-slate-500">Practice drafting assistant</p>
                                        </div>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => setIsAiCollaboratorExpanded(false)}
                                        className="rounded-md border border-slate-200 bg-white p-2 text-slate-600 hover:border-slate-300 hover:text-slate-800"
                                        aria-label="Collapse AI collaborator panel"
                                      >
                                        <Minimize2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="mb-2 flex items-center justify-between">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversation</p>
                                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                                        Canvas
                                      </span>
                                    </div>
                                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                      {assessmentAiLogs.length === 0 && (
                                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                                          Prompts and AI completion summaries will appear here.
                                        </div>
                                      )}
                                      {assessmentAiLogs.map((entry, index) => {
                                        const isPrompt = entry.startsWith('Prompt:');
                                        return (
                                          <div key={`${entry}-${index}`} className={`flex ${isPrompt ? 'justify-end' : 'justify-start'}`}>
                                            <div
                                              className={`max-w-[92%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                                                isPrompt
                                                  ? 'bg-blue-600 text-white'
                                                  : 'border border-slate-200 bg-slate-50 text-slate-700'
                                              }`}
                                            >
                                              {isPrompt ? entry.replace(/^Prompt:\s*/, '') : entry}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  <div className="mt-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="relative">
                                      <textarea
                                        value={assessmentAiPrompt}
                                        onChange={(event) => setAssessmentAiPrompt(event.target.value)}
                                        className="min-h-[130px] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 pb-12 pr-16 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                        placeholder="Prompt AI here. Use @ to attach library references."
                                      />
                                      <button
                                        type="button"
                                        onClick={handleAssessmentAiGenerate}
                                        className="absolute bottom-2 right-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                                        aria-label="Generate on canvas"
                                        disabled={!assessmentAiPrompt.trim()}
                                      >
                                        <ArrowUp className="h-4 w-4" />
                                      </button>
                                    </div>

                                    <input
                                      ref={assessmentAttachmentInputRef}
                                      type="file"
                                      className="hidden"
                                      accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                                      onChange={handleAssessmentAttachmentChange}
                                    />

                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={handleAssessmentAttachFile}
                                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-200 hover:text-blue-700"
                                        >
                                          <Paperclip className="h-3.5 w-3.5" />
                                          Attach file
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setIsAiConfigOpen(true)}
                                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-blue-200 hover:text-blue-700"
                                        >
                                          <Settings2 className="h-3.5 w-3.5" />
                                          Configure
                                        </button>
                                      </div>
                                      <span className="text-[11px] text-slate-500">Tip: type @ to attach reference</span>
                                    </div>
                                    {assessmentAttachedFileName && (
                                      <p className="mt-2 truncate rounded-md bg-blue-50 px-2 py-1 text-[11px] text-blue-700">
                                        Attached: {assessmentAttachedFileName}
                                      </p>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <Bot className="mt-1 h-4 w-4 text-slate-600" />
                                  <button
                                    type="button"
                                    onClick={() => setIsAiCollaboratorExpanded(true)}
                                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                    aria-label="Expand AI collaborator panel"
                                  >
                                    <PanelRightOpen className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </aside>
                          </div>

                        </div>
                      </div>
                    </div>
                  </div>
                ) : workspaceTab === 'practice' ? (
                  <div className="col-span-full min-h-0 overflow-hidden">
                    <div className="mx-auto flex h-full max-w-7xl min-h-0 flex-col overflow-hidden">
                      <div className="min-h-0 flex-1">
                        <div className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={handleSaveMaterialDraft}
                                disabled={isWorkspaceActionLoading}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isWorkspaceActionLoading ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  'Save draft'
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsMaterialConfigOpen(false);
                                  setIsTopicContentCollapsed(false);
                                  setIsTopicWorkspaceOpen(false);
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  void (async () => {
                                    try {
                                      const savedPracticeId = await createOrUpdateWorkspaceResource('published', {
                                        type: 'practice',
                                      });
                                      if (!savedPracticeId) return;
                                      setToastMessage(
                                        `Practice "${(editorTitle.trim() || selectedWorkspaceItem || 'Draft').trim()}" published.`
                                      );
                                    } catch (error: any) {
                                      setToastMessage(error?.message || 'Failed to create practice.');
                                    }
                                  })();
                                }}
                                disabled={isWorkspaceActionLoading}
                                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {isWorkspaceActionLoading ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Processing...
                                  </>
                                ) : (
                                  'Create Practice'
                                )}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsStudioExpanded((previous) => !previous)}
                              className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                              aria-label={isStudioExpanded ? 'Collapse practice workspace' : 'Expand practice workspace'}
                              title={isStudioExpanded ? 'Collapse' : 'Expand'}
                            >
                              {isStudioExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                            </button>
                          </div>

                          <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
                            <div className="relative z-0 min-h-0 min-w-0 flex-1 space-y-6 overflow-y-auto p-6">
                              <section className="space-y-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
                                      Practice Canvas
                                    </h2>
                                    <span
                                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                        isPracticeConfigured
                                          ? 'bg-emerald-100 text-emerald-700'
                                          : 'bg-amber-100 text-amber-700'
                                      }`}
                                    >
                                      {isPracticeConfigured ? 'Configured' : 'Not configured'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <button
                                      type="button"
                                      onClick={() => setIsMaterialConfigOpen(true)}
                                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                                    >
                                      <Settings2 className="h-3.5 w-3.5" />
                                      Configure
                                    </button>
                                  </div>
                                </div>

                                <div className="rounded-lg border border-slate-200 bg-white p-4">
                                  <div className="space-y-3">
                                    <input
                                      value={editorTitle}
                                      onChange={(event) => setEditorTitle(event.target.value)}
                                      placeholder="Title for practice"
                                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900"
                                    />
                                    <div ref={editorOverlayHostRef} className="relative">
                                      <div
                                        ref={editorSurfaceRef}
                                        contentEditable
                                        suppressContentEditableWarning
                                        onFocus={captureEditorSelection}
                                        onKeyUp={captureEditorSelection}
                                        onKeyDown={handleEditorKeyDown}
                                        onMouseUp={captureEditorSelection}
                                        onInput={(event) =>
                                          handleEditorBodyChange((event.target as HTMLDivElement).innerHTML)
                                        }
                                        className="min-h-[440px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                      {isEditorBodyEmpty && (
                                        <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">
                                          Start writing practice content here...
                                        </span>
                                      )}
                                      {selectionActionOverlay && (
                                        <div
                                          className="absolute z-20"
                                          style={{ top: selectionActionOverlay.top, left: selectionActionOverlay.left }}
                                        >
                                          <div className="relative flex items-center">
                                            <div className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-md">
                                              <button
                                                type="button"
                                                onMouseDown={preserveEditorSelectionOnMouseDown}
                                                onMouseEnter={() => setSelectionActionHint('Make changes to this')}
                                                onMouseLeave={() => setSelectionActionHint(null)}
                                                onClick={() => handleSelectionAction('change')}
                                                className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100"
                                                aria-label="Make changes to highlighted text"
                                                title="Make changes"
                                              >
                                                <Pencil className="h-4 w-4" />
                                              </button>
                                              <button
                                                type="button"
                                                onMouseDown={preserveEditorSelectionOnMouseDown}
                                                onMouseEnter={() => setSelectionActionHint('Try something different')}
                                                onMouseLeave={() => setSelectionActionHint(null)}
                                                onClick={() => handleSelectionAction('different')}
                                                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                                aria-label="Try something different on highlighted text"
                                                title="Try differently"
                                              >
                                                <RefreshCw className="h-4 w-4" />
                                              </button>
                                              <button
                                                type="button"
                                                onMouseDown={preserveEditorSelectionOnMouseDown}
                                                onMouseEnter={() => setSelectionActionHint('Ask AI collaborator')}
                                                onMouseLeave={() => setSelectionActionHint(null)}
                                                onClick={() => handleSelectionAction('chat')}
                                                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                                aria-label="Ask AI collaborator about highlighted text"
                                                title="Ask AI"
                                              >
                                                <MessageSquare className="h-4 w-4" />
                                              </button>
                                            </div>
                                            {selectionActionHint && (
                                              <div className="ml-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-md">
                                                {selectionActionHint}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </section>
                            </div>

                            <button
                              type="button"
                              className="hidden w-2 shrink-0 cursor-col-resize items-center justify-center border-l border-r border-slate-100 bg-slate-50 transition-colors hover:bg-blue-50 xl:flex"
                              aria-label="Resize AI collaborator panel"
                            >
                              <GripVertical className="h-8 w-3 text-slate-400" />
                            </button>

                            <aside
                              className={`relative z-10 overflow-hidden border-slate-100 bg-slate-50 transition-all duration-200 ${
                                isAiCollaboratorExpanded
                                  ? 'flex h-full flex-col p-3'
                                  : 'flex h-full flex-col items-center gap-2 border-t p-2.5 xl:border-l xl:border-t-0'
                              }`}
                              style={{ width: isAiCollaboratorExpanded ? 340 : 64 }}
                            >
                              {isAiCollaboratorExpanded ? (
                                <div className="flex h-full min-h-0 flex-col rounded-md border border-slate-200 bg-white p-2">
                                  <div className="mb-3 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-slate-900">AI Collaborator</p>
                                      <Bot className="h-4 w-4 text-slate-600" />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setIsAiCollaboratorExpanded((previous) => {
                                          const next = !previous;
                                          if (!next) setIsAiConfigOpen(false);
                                          return next;
                                        })
                                      }
                                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                      aria-label="Collapse AI collaborator"
                                      title="Collapse"
                                    >
                                      <PanelRightClose className="h-4 w-4" />
                                    </button>
                                  </div>

                                  <div className="mb-2 flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                      Assistant chat
                                    </p>
                                  </div>

                                  <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                                    {aiMessages.map((message) => (
                                      <div
                                        key={message.id}
                                        className={`rounded-md px-2 py-1.5 text-xs ${
                                          message.role === 'assistant'
                                            ? 'bg-slate-100 text-slate-700'
                                            : 'bg-blue-50 text-blue-800'
                                        }`}
                                      >
                                        {message.text}
                                      </div>
                                    ))}
                                  </div>

                                  <div className="mt-2 space-y-3">
                                    <div className="relative">
                                      <textarea
                                        ref={aiChatInputRef}
                                        value={aiChatInput}
                                        onChange={(event) => setAiChatInput(event.target.value)}
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter' && !event.shiftKey) {
                                            event.preventDefault();
                                            handleSendAiMessage();
                                          }
                                        }}
                                        placeholder="Prompt AI here. Use @ to attach library references."
                                        className="min-h-[120px] w-full resize-none rounded-md border border-slate-200 px-3 py-2 pb-12 pr-16 text-sm"
                                      />
                                      <button
                                        type="button"
                                        onClick={handleSendAiMessage}
                                        className="absolute right-2 bottom-2 inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-blue-600 px-3 text-white hover:bg-blue-700 disabled:opacity-60"
                                        aria-label="Generate on canvas"
                                      >
                                        <SendHorizontal className="h-4 w-4" />
                                      </button>
                                    </div>

                                    <div className="flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          type="button"
                                          onClick={() => setIsAiConfigOpen(true)}
                                          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-blue-700"
                                        >
                                          <Settings2 className="h-3.5 w-3.5" />
                                          Configure
                                        </button>
                                      </div>
                                      <span className="text-[11px] text-slate-500">Type @ to attach reference</span>
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <Bot className="mt-1 h-4 w-4 text-slate-600" />
                                  <button
                                    type="button"
                                    onClick={() => setIsAiCollaboratorExpanded(true)}
                                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                    aria-label="Expand AI collaborator panel"
                                  >
                                    <PanelRightOpen className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </aside>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                <div className="col-span-full flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveMaterialDraft}
                      disabled={isWorkspaceActionLoading}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isWorkspaceActionLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5" />
                      )}
                      {isWorkspaceActionLoading ? 'Processing...' : 'Save draft'}
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintWorkspace}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void handleShareWorkspace();
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsMaterialConfigOpen(true)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      Configure
                    </button>
                    <button
                      type="button"
                      onClick={handlePublishMaterial}
                      disabled={isWorkspaceActionLoading}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isWorkspaceActionLoading ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <ArrowUp className="h-3.5 w-3.5" />
                      )}
                      {isWorkspaceActionLoading ? 'Processing...' : 'Publish'}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsStudioExpanded((previous) => !previous)}
                    className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                    aria-label={isStudioExpanded ? 'Collapse editor workspace' : 'Expand editor workspace'}
                    title={isStudioExpanded ? 'Collapse' : 'Expand'}
                  >
                    {isStudioExpanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                  </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white">
                  <input
                    ref={editorImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleInsertImageFromPicker}
                    className="hidden"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('undo')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Undo"
                        title="Undo"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('redo')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Redo"
                        title="Redo"
                      >
                        <Redo2 className="h-3.5 w-3.5" />
                      </button>
                      <span className="mx-1 h-5 w-px bg-slate-200" />
                      <select
                        value={editorBlockStyle}
                        onMouseDown={captureEditorSelection}
                        onChange={(event) => handleEditorBlockStyleChange(event.target.value as EditorBlockStyle)}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                      >
                        <option>Paragraph</option>
                        <option>Title</option>
                        <option>Heading</option>
                        <option>Subheading</option>
                        <option>Block quote</option>
                        <option>Bulleted list</option>
                        <option>Numbered list</option>
                        <option>Lettered list</option>
                        <option>Code block</option>
                      </select>
                      <span className="mx-1 h-5 w-px bg-slate-200" />
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('bold')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Bold"
                        title="Bold"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('italic')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Italic"
                        title="Italic"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('underline')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Underline"
                        title="Underline"
                      >
                        <Underline className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('formatBlock', 'pre')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Code block"
                        title="Code block"
                      >
                        <Code2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={handleInsertLink}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Insert link"
                        title="Insert link"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={handleOpenImagePicker}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Insert image"
                        title="Insert image"
                      >
                        <ImagePlus className="h-3.5 w-3.5" />
                      </button>
                      <span className="mx-1 h-5 w-px bg-slate-200" />
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('insertUnorderedList')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Bulleted list"
                        title="Bulleted list"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('insertOrderedList')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Numbered list"
                        title="Numbered list"
                      >
                        <ListOrdered className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={() => executeEditorCommand('justifyFull')}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Justify"
                        title="Justify"
                      >
                        <AlignJustify className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onMouseDown={preserveEditorSelectionOnMouseDown}
                        onClick={handleInsertTable}
                        className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                        aria-label="Insert table"
                        title="Insert table"
                      >
                        <Table className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600">
                        {TOPIC_CONTENT_LABELS[workspaceTab]}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-3">
                    <input
                      value={editorTitle}
                      onChange={(event) => setEditorTitle(event.target.value)}
                      placeholder={`Title for ${getTopicContentLabelLower(workspaceTab, true)}`}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-base font-semibold text-slate-900"
                    />
                    <div ref={editorOverlayHostRef} className="relative">
                      <div
                        ref={editorSurfaceRef}
                        contentEditable
                        suppressContentEditableWarning
                        onFocus={captureEditorSelection}
                        onKeyUp={captureEditorSelection}
                        onKeyDown={handleEditorKeyDown}
                        onMouseUp={captureEditorSelection}
                        onInput={(event) =>
                          handleEditorBodyChange((event.target as HTMLDivElement).innerHTML)
                        }
                        className="min-h-[440px] w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {isEditorBodyEmpty && (
                        <span className="pointer-events-none absolute left-3 top-2 text-sm text-slate-400">
                          Start writing {getTopicContentLabelLower(workspaceTab, true)} content here...
                        </span>
                      )}
                      {selectionActionOverlay && (
                        <div
                          className="absolute z-20"
                          style={{ top: selectionActionOverlay.top, left: selectionActionOverlay.left }}
                        >
                          <div className="relative flex items-center">
                            <div className="flex flex-col gap-1 rounded-md border border-slate-200 bg-white p-1 shadow-md">
                              <button
                                type="button"
                                onMouseDown={preserveEditorSelectionOnMouseDown}
                                onMouseEnter={() => setSelectionActionHint('Make changes to this')}
                                onMouseLeave={() => setSelectionActionHint(null)}
                                onClick={() => handleSelectionAction('change')}
                                className="inline-flex items-center justify-center rounded-md border border-blue-200 bg-blue-50 p-1.5 text-blue-700 hover:bg-blue-100"
                                aria-label="Make changes to highlighted text"
                                title="Make changes"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onMouseDown={preserveEditorSelectionOnMouseDown}
                                onMouseEnter={() => setSelectionActionHint('Try something different')}
                                onMouseLeave={() => setSelectionActionHint(null)}
                                onClick={() => handleSelectionAction('different')}
                                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                aria-label="Try something different on highlighted text"
                                title="Try differently"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onMouseDown={preserveEditorSelectionOnMouseDown}
                                onMouseEnter={() => setSelectionActionHint('Ask AI collaborator')}
                                onMouseLeave={() => setSelectionActionHint(null)}
                                onClick={() => handleSelectionAction('chat')}
                                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                                aria-label="Ask AI collaborator about highlighted text"
                                title="Ask AI"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                            </div>
                            {selectionActionHint && (
                              <div className="ml-2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-md">
                                {selectionActionHint}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <aside
                  className={`rounded-lg border border-slate-200 bg-slate-50 ${
                    isAiCollaboratorExpanded ? 'flex h-full flex-col p-3' : 'p-1.5'
                  }`}
                >
                  <div
                    className={`${
                      isAiCollaboratorExpanded
                        ? 'mb-3 flex items-center justify-between'
                        : 'mb-0.5 flex flex-col items-center gap-1.5'
                    }`}
                  >
                    {isAiCollaboratorExpanded ? (
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">AI Collaborator</p>
                        <Bot className="h-4 w-4 text-slate-600" />
                      </div>
                    ) : (
                      <Bot className="h-4 w-4 text-slate-600" />
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setIsAiCollaboratorExpanded((previous) => {
                          const next = !previous;
                          if (!next) setIsAiConfigOpen(false);
                          return next;
                        })
                      }
                      className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
                      aria-label={isAiCollaboratorExpanded ? 'Collapse AI collaborator' : 'Expand AI collaborator'}
                      title={isAiCollaboratorExpanded ? 'Collapse' : 'Expand'}
                    >
                      {isAiCollaboratorExpanded ? (
                        <PanelRightClose className="h-4 w-4" />
                      ) : (
                        <PanelRightOpen className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {isAiCollaboratorExpanded ? (
                    <div className="flex h-full min-h-0 flex-col rounded-md border border-slate-200 bg-white p-2">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Assistant chat
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsAiConfigOpen(true)}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                        >
                          <Settings2 className="h-3.5 w-3.5" />
                          Configure
                        </button>
                      </div>

                      <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                        {aiMessages.map((message) => (
                          <div
                            key={message.id}
                            className={`rounded-md px-2 py-1.5 text-xs ${
                              message.role === 'assistant'
                                ? 'bg-slate-100 text-slate-700'
                                : 'bg-blue-50 text-blue-800'
                            }`}
                          >
                            {message.text}
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 flex items-end gap-2">
                        <textarea
                          ref={aiChatInputRef}
                          value={aiChatInput}
                          onChange={(event) => setAiChatInput(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              handleSendAiMessage();
                            }
                          }}
                          placeholder="Ask the AI assistant or type 'generate draft'..."
                          rows={1}
                          className="min-h-[32px] max-h-40 min-w-0 flex-1 resize-none overflow-y-auto rounded-md border border-slate-200 px-2 py-1.5 text-xs leading-5"
                        />
                        <button
                          type="button"
                          onClick={handleSendAiMessage}
                          className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1.5 text-slate-700 hover:bg-slate-100"
                          aria-label="Send message"
                        >
                          <SendHorizontal className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : null}
                </aside>
                  </>
                )}
              </div>
            </div>
            </div>
          </div>
          </div>
        )}
          </>
        )}
      </div>
    </ClassroomLayout>
  );
};

export default ClassroomSubjectsPage;
