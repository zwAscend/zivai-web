import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { DevelopmentPlan, Step } from '../../types';
import {
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle,
  Edit,
  ExternalLink,
  FileText,
  GripHorizontal,
  MessageCircle,
  Send,
  Video,
  X,
} from 'lucide-react';
import StudentPracticeRunner, { PracticeQuestion } from './StudentPracticeRunner';
import { StudentPracticeSession, StudentPracticeSessionQuestion, studentService } from '../../services/studentService';
import { externalAssessmentService } from '../../services/externalAssessmentService';

interface StudentPlanViewProps {
  studentId: string;
  plan: DevelopmentPlan;
  subjectName?: string;
  initialStepIndex?: number;
}

interface PlanChatMessage {
  id: string;
  sender: 'student' | 'coach';
  text: string;
}

interface ChatDragState {
  startX: number;
  startY: number;
  originX: number;
  originY: number;
}

const ALLOWED_RICH_TEXT_TAGS = new Set([
  'p',
  'strong',
  'em',
  'b',
  'i',
  'u',
  'ul',
  'ol',
  'li',
  'br',
  'a',
]);

const decodeHtmlEntities = (value: string) => {
  if (typeof document === 'undefined') return value;
  const textarea = document.createElement('textarea');
  textarea.innerHTML = value;
  return textarea.value;
};

const hasHtmlMarkup = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value);

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};

const stripAssessmentRevealMetadata = (value: string): string => {
  const line = String(value || '').trim();
  if (!line) return '';
  if (!/(?:options:|answer\(s\):|answer:|correct answer\(s\):|expected answer:|marking guide:|rubric:)/i.test(line)) {
    return line;
  }

  return line
    .replace(/\s+options:\s*[\s\S]*$/i, '')
    .replace(/\s+answer\(s\):\s*[\s\S]*$/i, '')
    .replace(/\s+answer:\s*[\s\S]*$/i, '')
    .replace(/\s+correct answer\(s\):\s*[\s\S]*$/i, '')
    .replace(/\s+expected answer:\s*[\s\S]*$/i, '')
    .replace(/\s+marking guide:\s*[\s\S]*$/i, '')
    .replace(/\s+rubric:\s*[\s\S]*$/i, '')
    .trim();
};

const redactAssessmentRevealContent = (value: string): string => {
  const input = String(value || '').trim();
  if (!input) return '';

  if (typeof document === 'undefined' || !hasHtmlMarkup(input)) {
    return input
      .split('\n')
      .map((line) => stripAssessmentRevealMetadata(line))
      .filter(Boolean)
      .join('\n');
  }

  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${input}</div>`, 'text/html');
  const container = parsed.body.firstElementChild as HTMLElement | null;
  if (!container) return input;

  container.querySelectorAll('li, p').forEach((element) => {
    const originalText = String(element.textContent || '').trim();
    if (!originalText) return;

    const cleaned = stripAssessmentRevealMetadata(originalText);
    if (!cleaned) {
      element.remove();
      return;
    }
    if (cleaned !== originalText) {
      element.textContent = cleaned;
    }
  });

  return container.innerHTML.trim();
};

const sanitizeRichHtml = (value: string) => {
  if (typeof document === 'undefined') return value;
  const parser = new DOMParser();
  const parsed = parser.parseFromString(`<div>${value}</div>`, 'text/html');
  const container = parsed.body.firstElementChild as HTMLElement | null;
  if (!container) return '';

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const tagName = element.tagName.toLowerCase();

      if (!ALLOWED_RICH_TEXT_TAGS.has(tagName)) {
        const parent = element.parentNode;
        if (parent) {
          while (element.firstChild) {
            parent.insertBefore(element.firstChild, element);
          }
          parent.removeChild(element);
        }
        return;
      }

      Array.from(element.attributes).forEach((attribute) => {
        const attrName = attribute.name.toLowerCase();
        const attrValue = attribute.value.trim();
        const isAllowedAnchorAttribute =
          tagName === 'a' && (attrName === 'href' || attrName === 'target' || attrName === 'rel');

        if (!isAllowedAnchorAttribute) {
          element.removeAttribute(attribute.name);
          return;
        }

        if (attrName === 'href' && !/^(https?:|mailto:)/i.test(attrValue)) {
          element.removeAttribute(attribute.name);
        }
      });

      if (tagName === 'a') {
        const href = element.getAttribute('href');
        if (href && !element.getAttribute('target')) {
          element.setAttribute('target', '_blank');
        }
        if (href && !element.getAttribute('rel')) {
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }
    }

    Array.from(node.childNodes).forEach(sanitizeNode);
  };

  Array.from(container.childNodes).forEach(sanitizeNode);
  return container.innerHTML;
};

const renderLessonText = (value: string, className: string) => {
  const decoded = decodeHtmlEntities(String(value || '').trim());
  const redacted = redactAssessmentRevealContent(decoded);
  if (!redacted) return null;
  if (hasHtmlMarkup(redacted)) {
    return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(redacted) }} />;
  }
  return <p className={className}>{redacted}</p>;
};

const getStepIcon = (type: string) => {
  switch (type) {
    case 'video':
      return <Video className="w-4 h-4" />;
    case 'document':
      return <FileText className="w-4 h-4" />;
    case 'assignment':
      return <Edit className="w-4 h-4" />;
    case 'quiz':
      return <BookOpen className="w-4 h-4" />;
    default:
      return <BookOpen className="w-4 h-4" />;
  }
};

const getProgressColor = (progress: number) => {
  if (progress >= 80) return 'bg-green-500';
  if (progress >= 60) return 'bg-blue-600';
  if (progress >= 40) return 'bg-blue-500';
  return 'bg-blue-400';
};

const getStepTagColor = (type: string) => {
  switch (type) {
    case 'video':
      return 'bg-red-100 text-red-700';
    case 'document':
      return 'bg-blue-100 text-blue-700';
    case 'assignment':
      return 'bg-purple-100 text-purple-700';
    case 'quiz':
      return 'bg-yellow-100 text-yellow-700';
    case 'discussion':
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

const isPracticeStep = (type: string) => type === 'assignment' || type === 'quiz';

const getNextStepLabel = (type: string) => {
  switch (type) {
    case 'quiz':
      return 'quiz';
    case 'document':
      return 'notes';
    case 'assignment':
      return 'article';
    case 'discussion':
      return 'article';
    case 'video':
      return 'notes';
    default:
      return 'next step';
  }
};

const getStepPublishedContent = (step: Step) => decodeHtmlEntities(String(step.content || '').trim());

const mapPracticeQuestion = (question: StudentPracticeSessionQuestion): PracticeQuestion => {
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

const StudentPlanView: React.FC<StudentPlanViewProps> = ({ studentId, plan, subjectName, initialStepIndex }) => {
  const sortedSteps = useMemo(
    () => plan.plan.steps?.slice().sort((a, b) => (a.order || 0) - (b.order || 0)) || [],
    [plan.plan.steps]
  );

  const totalSteps = sortedSteps.length;
  const safeProgress = Math.max(0, Math.min(100, plan.currentProgress || 0));
  const completedStepsCount = Math.floor((safeProgress / 100) * totalSteps);
  const currentStepIndex = Math.min(completedStepsCount, Math.max(totalSteps - 1, 0));

  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [completedPracticeSteps, setCompletedPracticeSteps] = useState<Record<number, boolean>>({});
  const [completedStepIds, setCompletedStepIds] = useState<string[]>([]);
  const [practiceSessionsByStep, setPracticeSessionsByStep] = useState<Record<number, StudentPracticeSession>>({});
  const [practiceSessionError, setPracticeSessionError] = useState<string | null>(null);
  const [isPracticeSessionLoading, setIsPracticeSessionLoading] = useState(false);
  const [isStepContentTransitionLoading, setIsStepContentTransitionLoading] = useState(false);
  const [manualPracticeAnswerText, setManualPracticeAnswerText] = useState('');
  const [manualPracticeImageFile, setManualPracticeImageFile] = useState<File | null>(null);
  const [manualPracticeFeedback, setManualPracticeFeedback] = useState<string | null>(null);
  const [manualPracticeError, setManualPracticeError] = useState<string | null>(null);
  const [isManualPracticeAssessing, setIsManualPracticeAssessing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<PlanChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'coach',
      text: 'Need help with this plan step? Ask a question and I will guide you.',
    },
  ]);
  const [chatPosition, setChatPosition] = useState<{ x: number; y: number } | null>(null);
  const chatFloatingRef = useRef<HTMLDivElement | null>(null);
  const chatDragStateRef = useRef<ChatDragState | null>(null);
  const chatDragCleanupRef = useRef<(() => void) | null>(null);
  const stepLoadingTimeoutRef = useRef<number | null>(null);

  const selectedStep = sortedSteps[selectedStepIndex] || null;
  const selectedStepId = selectedStep?.id ? String(selectedStep.id) : null;
  const nextStep = selectedStepIndex < totalSteps - 1 ? sortedSteps[selectedStepIndex + 1] : null;
  const selectedPracticeSession = practiceSessionsByStep[selectedStepIndex] || null;
  const selectedPracticeQuestions = useMemo(
    () => (selectedPracticeSession?.questions || []).map(mapPracticeQuestion),
    [selectedPracticeSession?.questions]
  );
  const selectedStepContent = useMemo(
    () => (selectedStep ? getStepPublishedContent(selectedStep) : ''),
    [selectedStep]
  );
  const sidebarDesktopWidth = isSidebarCollapsed ? 'md:w-[88px]' : 'md:w-[340px]';
  const contentDesktopOffset = isSidebarCollapsed ? 'md:ml-[88px]' : 'md:ml-[340px]';
  const desktopSidebarWidthPx = isSidebarCollapsed ? 88 : 340;
  const desktopContainerInset = 'max(1rem, calc((100vw - 1400px)/2 + 1rem))';

  useEffect(() => {
    if (selectedStepIndex > sortedSteps.length - 1) {
      setSelectedStepIndex(Math.max(sortedSteps.length - 1, 0));
    }
  }, [selectedStepIndex, sortedSteps.length]);

  useEffect(() => {
    if (typeof initialStepIndex === 'number') {
      setSelectedStepIndex(Math.max(0, Math.min(initialStepIndex, Math.max(sortedSteps.length - 1, 0))));
      return;
    }
    setSelectedStepIndex(currentStepIndex);
  }, [plan.id, currentStepIndex, initialStepIndex, sortedSteps.length]);

  useEffect(() => {
    setCompletedPracticeSteps({});
    const initialCompleted = sortedSteps
      .slice(0, completedStepsCount)
      .map((step) => (step.id ? String(step.id) : ''))
      .filter(Boolean);
    setCompletedStepIds(initialCompleted);
    setPracticeSessionsByStep({});
    setPracticeSessionError(null);
    setIsPracticeSessionLoading(false);
    setManualPracticeAnswerText('');
    setManualPracticeImageFile(null);
    setManualPracticeFeedback(null);
    setManualPracticeError(null);
    setIsManualPracticeAssessing(false);
    setIsStepContentTransitionLoading(false);
    if (stepLoadingTimeoutRef.current) {
      window.clearTimeout(stepLoadingTimeoutRef.current);
      stepLoadingTimeoutRef.current = null;
    }
    setIsChatOpen(false);
    setChatInput('');
    setChatMessages([
      {
        id: 'welcome-1',
        sender: 'coach',
        text: 'Need help with this plan step? Ask a question and I will guide you.',
      },
    ]);
    setChatPosition(null);
  }, [plan.id, completedStepsCount, sortedSteps]);

  useEffect(() => () => {
    if (stepLoadingTimeoutRef.current) {
      window.clearTimeout(stepLoadingTimeoutRef.current);
      stepLoadingTimeoutRef.current = null;
    }
    if (chatDragCleanupRef.current) {
      chatDragCleanupRef.current();
    }
  }, []);

  const sendChatMessage = () => {
    const message = chatInput.trim();
    if (!message) return;

    const studentMessage: PlanChatMessage = {
      id: `student-${Date.now()}`,
      sender: 'student',
      text: message,
    };

    const coachReply: PlanChatMessage = {
      id: `coach-${Date.now() + 1}`,
      sender: 'coach',
      text: `Good question. Focus on "${selectedStep?.title || 'this step'}", then explain your reasoning before moving to the next activity.`,
    };

    setChatMessages((previous) => [...previous, studentMessage, coachReply]);
    setChatInput('');
  };

  const persistRuntimeProgress = useCallback(async (nextCompletedStepIds: string[], nextActiveStepId?: string | null) => {
    if (!studentId || !plan.id) return;
    try {
      await studentService.updatePlanRuntimeProgress(studentId, plan.id, {
        completedStepIds: nextCompletedStepIds,
        activeStepId: nextActiveStepId || undefined,
        status: 'active',
      });
    } catch {
      // Non-blocking; next interaction will retry.
    }
  }, [plan.id, studentId]);

  useEffect(() => {
    const loadPracticeSession = async () => {
      if (!selectedStep || !isPracticeStep(selectedStep.type)) {
        setPracticeSessionError(null);
        setIsPracticeSessionLoading(false);
        return;
      }
      if (practiceSessionsByStep[selectedStepIndex]) {
        return;
      }
      if (!plan.plan?.subjectId) {
        setPracticeSessionError('Subject context is missing for this plan step.');
        return;
      }

      try {
        setIsPracticeSessionLoading(true);
        setPracticeSessionError(null);
        const session = await studentService.startPracticeSession(studentId, plan.plan.subjectId, {
          mode: 'topic_practice',
          title: selectedStep.title,
        });
        setPracticeSessionsByStep((previous) => ({
          ...previous,
          [selectedStepIndex]: session,
        }));
      } catch (error: unknown) {
        setPracticeSessionError(getErrorMessage(error, 'Failed to load practice session.'));
      } finally {
        setIsPracticeSessionLoading(false);
      }
    };

    void loadPracticeSession();
  }, [
    studentId,
    plan.plan?.subjectId,
    selectedStep,
    selectedStepId,
    selectedStepIndex,
    practiceSessionsByStep,
  ]);

  useEffect(() => {
    if (!selectedStepId) return;
    void persistRuntimeProgress(completedStepIds, selectedStepId);
  }, [completedStepIds, persistRuntimeProgress, selectedStepId]);

  useEffect(() => {
    if (!selectedStepId) {
      setIsStepContentTransitionLoading(false);
      return;
    }
    setIsStepContentTransitionLoading(true);
    if (stepLoadingTimeoutRef.current) {
      window.clearTimeout(stepLoadingTimeoutRef.current);
    }
    stepLoadingTimeoutRef.current = window.setTimeout(() => {
      setIsStepContentTransitionLoading(false);
      stepLoadingTimeoutRef.current = null;
    }, 220);
  }, [selectedStepId]);

  useEffect(() => {
    setManualPracticeAnswerText('');
    setManualPracticeImageFile(null);
    setManualPracticeFeedback(null);
    setManualPracticeError(null);
    setIsManualPracticeAssessing(false);
  }, [selectedStepId]);

  const clampChatPosition = (x: number, y: number) => {
    const floatingNode = chatFloatingRef.current;
    if (!floatingNode) return { x, y };
    const margin = 8;
    const width = floatingNode.offsetWidth;
    const height = floatingNode.offsetHeight;

    return {
      x: Math.min(Math.max(margin, x), window.innerWidth - width - margin),
      y: Math.min(Math.max(margin, y), window.innerHeight - height - margin),
    };
  };

  const setChatOpenWithAnchor = (nextOpen: boolean) => {
    if (nextOpen === isChatOpen) return;

    const floatingNode = chatFloatingRef.current;
    const previousRect = floatingNode?.getBoundingClientRect() || null;

    setIsChatOpen(nextOpen);

    if (!previousRect) return;

    window.requestAnimationFrame(() => {
      const updatedNode = chatFloatingRef.current;
      if (!updatedNode) return;
      const nextRect = updatedNode.getBoundingClientRect();

      setChatPosition((previous) => {
        const base = previous || { x: previousRect.left, y: previousRect.top };
        return clampChatPosition(
          base.x + (previousRect.width - nextRect.width),
          base.y + (previousRect.height - nextRect.height)
        );
      });
    });
  };

  const startChatDrag = (event: React.PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const floatingNode = chatFloatingRef.current;
    if (!floatingNode) return;

    const rect = floatingNode.getBoundingClientRect();
    const initialPosition = chatPosition || { x: rect.left, y: rect.top };

    if (!chatPosition) {
      setChatPosition(initialPosition);
    }

    chatDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: initialPosition.x,
      originY: initialPosition.y,
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!chatDragStateRef.current) return;
      const nextX = chatDragStateRef.current.originX + (moveEvent.clientX - chatDragStateRef.current.startX);
      const nextY = chatDragStateRef.current.originY + (moveEvent.clientY - chatDragStateRef.current.startY);
      setChatPosition(clampChatPosition(nextX, nextY));
    };

    const cleanup = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      chatDragStateRef.current = null;
      chatDragCleanupRef.current = null;
    };

    const handlePointerEnd = () => {
      cleanup();
    };

    if (chatDragCleanupRef.current) {
      chatDragCleanupRef.current();
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    chatDragCleanupRef.current = cleanup;
  };

  useEffect(() => {
    if (!chatPosition) return;

    const keepChatInViewport = () => {
      setChatPosition((previous) => {
        if (!previous) return previous;
        const clamped = clampChatPosition(previous.x, previous.y);
        if (clamped.x === previous.x && clamped.y === previous.y) return previous;
        return clamped;
      });
    };

    const frameId = window.requestAnimationFrame(keepChatInViewport);
    const handleResize = () => window.requestAnimationFrame(keepChatInViewport);
    window.addEventListener('resize', handleResize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isChatOpen, chatPosition]);

  const assessOpenResponseWithAi = async (
    responseText?: string,
    imageFile?: File | null
  ): Promise<{ feedback: string; correct: boolean }> => {
    const normalizedText = (responseText || '').trim();
    const candidateImage = imageFile || null;
    if (!normalizedText && !candidateImage) {
      throw new Error('Enter a response or upload an image before requesting AI feedback.');
    }

    const moduleName = selectedStep?.title?.trim() || subjectName?.trim() || 'Practice step';
    const assessmentResult = candidateImage
      ? await externalAssessmentService.assessDocument(candidateImage, moduleName)
      : await externalAssessmentService.assessText(normalizedText, moduleName);

    if (!assessmentResult.success || !assessmentResult.data?.assessment) {
      throw new Error(assessmentResult.error || assessmentResult.message || 'AI assessment is unavailable right now.');
    }

    const assessment = assessmentResult.data.assessment;
    const safePercentage = Number.isFinite(Number(assessment.marks_percentage))
      ? Math.max(0, Math.min(100, Number(assessment.marks_percentage)))
      : null;
    const summaryParts: string[] = [];
    if (safePercentage !== null) {
      summaryParts.push(`AI score: ${Math.round(safePercentage)}% (${assessment.marks_achieved}/${assessment.total_possible_marks}).`);
    }
    if (assessment.overall_feedback) {
      summaryParts.push(assessment.overall_feedback);
    }
    if (assessment.strengths?.length) {
      summaryParts.push(`Strengths: ${assessment.strengths.slice(0, 2).join('; ')}.`);
    }
    if (assessment.improvements?.length) {
      summaryParts.push(`Next steps: ${assessment.improvements.slice(0, 2).join('; ')}.`);
    }
    const feedback = summaryParts.join(' ').trim() || 'AI feedback generated.';
    return {
      feedback,
      correct: safePercentage === null ? true : safePercentage >= 50,
    };
  };

  const markCurrentPracticeStepComplete = async () => {
    setCompletedPracticeSteps((previous) => ({
      ...previous,
      [selectedStepIndex]: true,
    }));
    if (selectedStepId) {
      const nextCompletedStepIds = Array.from(new Set([...completedStepIds, selectedStepId]));
      setCompletedStepIds(nextCompletedStepIds);
      await persistRuntimeProgress(nextCompletedStepIds, selectedStepId);
    }
  };

  const handleManualPracticeAssess = async () => {
    if (isManualPracticeAssessing) return;
    try {
      setIsManualPracticeAssessing(true);
      setManualPracticeError(null);
      const result = await assessOpenResponseWithAi(manualPracticeAnswerText, manualPracticeImageFile);
      setManualPracticeFeedback(result.feedback);
    } catch (error: unknown) {
      setManualPracticeFeedback(null);
      setManualPracticeError(getErrorMessage(error, 'Unable to assess your response right now.'));
    } finally {
      setIsManualPracticeAssessing(false);
    }
  };

  const selectedStepIsPractice = Boolean(selectedStep && isPracticeStep(selectedStep.type));
  const showUpNextFooter = !selectedStepIsPractice || Boolean(completedPracticeSteps[selectedStepIndex]);
  const sidebarTitle = subjectName?.trim() || 'Subject';
  const mainHeaderTitle = selectedStep?.title?.trim() || sidebarTitle;

  return (
    <motion.div
      className="bg-white rounded-xl md:relative"
      style={{
        ['--student-plan-footer-left' as string]: `calc(${desktopContainerInset} + ${desktopSidebarWidthPx}px)`,
        ['--student-plan-footer-right' as string]: desktopContainerInset,
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      <aside className={`border-b border-slate-200 md:border-b-0 bg-slate-50 flex flex-col min-h-[760px] md:fixed md:top-[calc(var(--student-header-offset)+0.75rem)] md:left-[max(1rem,calc((100vw-1400px)/2+1rem))] md:h-auto md:max-h-[calc(100vh-var(--student-header-offset)-1.5rem)] md:min-h-0 md:z-20 md:overflow-visible md:will-change-[width] md:transition-[width] md:duration-300 md:ease-in-out ${sidebarDesktopWidth}`}>
        <button
          type="button"
          onClick={() => setIsSidebarCollapsed((prev) => !prev)}
          className="hidden md:inline-flex absolute top-1/2 -translate-y-1/2 -right-4 z-30 h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm hover:bg-slate-50"
          aria-label={isSidebarCollapsed ? 'Expand steps panel' : 'Collapse steps panel'}
        >
          {isSidebarCollapsed ? (
            <ChevronsRight className="w-4 h-4 transition-transform duration-200 ease-out" />
          ) : (
            <ChevronsLeft className="w-4 h-4 transition-transform duration-200 ease-out" />
          )}
        </button>

        <div className="border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <div
              className={`min-w-0 overflow-hidden transition-[max-width,max-height,opacity,transform] duration-200 ease-out ${
                isSidebarCollapsed
                  ? 'max-w-0 max-h-0 opacity-0 -translate-x-1'
                  : 'max-w-[240px] max-h-16 opacity-100 translate-x-0'
              }`}
            >
              <h2 className="text-lg font-bold text-slate-900 truncate">{sidebarTitle}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{totalSteps} steps</p>
            </div>
          </div>
          <div
            className={`mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden transition-opacity duration-200 ease-out ${
              isSidebarCollapsed ? 'opacity-0' : 'opacity-100'
            }`}
          >
            <div className={`${getProgressColor(safeProgress)} h-1.5`} style={{ width: `${safeProgress}%` }} />
          </div>
        </div>

        <div className="md:overflow-y-auto">
          {sortedSteps.map((step, index) => {
            const isCompleted = index < completedStepsCount;
            const isCurrent = index === currentStepIndex;
            const isSelected = index === selectedStepIndex;

            return (
              <button
                key={`${step.title}-${index}`}
                type="button"
                onClick={() => {
                  setSelectedStepIndex(index);
                }}
                title={`Step ${index + 1}: ${step.title}`}
                className={`relative w-full min-h-[72px] transition border-b border-slate-200 ${
                  isSelected
                    ? 'bg-blue-50 border-l-4 border-l-blue-600 pl-3'
                    : 'bg-transparent hover:bg-slate-100'
                } ${isSidebarCollapsed ? 'px-2 py-3 flex justify-center' : 'text-left px-4 py-3'}`}
              >
                <div className={`flex items-start transition-all duration-200 ease-out ${isSidebarCollapsed ? 'justify-center gap-0' : 'gap-3'}`}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-700'
                        : isCurrent
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                  </div>
                  <div
                    className={`min-w-0 overflow-hidden transition-[max-width,max-height,opacity,transform] duration-200 ease-out ${
                      isSidebarCollapsed
                        ? 'max-w-0 max-h-0 opacity-0 -translate-x-1'
                        : 'max-w-[240px] max-h-16 opacity-100 translate-x-0'
                    }`}
                  >
                    <p className="text-[11px] uppercase tracking-wide text-slate-400 font-semibold">Step {index + 1}</p>
                    <p className="text-sm font-semibold text-slate-800 truncate">{step.title}</p>
                    <p className="text-xs text-slate-500 capitalize">
                      {isCompleted ? 'Completed' : isCurrent ? 'In progress' : 'Not started'} • {step.type}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <div className={`min-w-0 flex flex-col min-h-[760px] border border-slate-200 md:border-l md:border-l-slate-200 md:border-r md:border-r-slate-200 bg-white md:will-change-[margin] md:transition-[margin] md:duration-300 md:ease-in-out ${contentDesktopOffset}`}>
        <header className="px-6 py-5 border-b border-slate-200 bg-white">
          <div className="flex justify-center text-center">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{mainHeaderTitle}</h1>
          </div>
        </header>

        <div className="p-6 pb-28 space-y-6 bg-white">
          {isStepContentTransitionLoading && (
            <section className="space-y-6 animate-pulse">
              <div className="flex flex-wrap items-center gap-2">
                <div className="h-6 w-28 rounded-md bg-slate-200" />
                <div className="h-4 w-24 rounded-md bg-slate-200" />
              </div>
              <div className="space-y-3">
                <div className="h-6 w-2/3 rounded-md bg-slate-200" />
                <div className="h-4 w-full rounded-md bg-slate-200" />
                <div className="h-4 w-5/6 rounded-md bg-slate-200" />
                <div className="h-4 w-4/6 rounded-md bg-slate-200" />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
                <div className="h-4 w-32 rounded-md bg-slate-200" />
                <div className="h-20 w-full rounded-md bg-slate-200" />
                <div className="h-4 w-40 rounded-md bg-slate-200" />
              </div>
            </section>
          )}

          {!isStepContentTransitionLoading && selectedStep && !isPracticeStep(selectedStep.type) && (
            <section className="space-y-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md ${getStepTagColor(selectedStep.type)}`}>
                  {getStepIcon(selectedStep.type)}
                  <span className="capitalize">{selectedStep.type}</span>
                </span>
                <span className="text-xs text-slate-500">
                  {selectedStepIndex < completedStepsCount
                    ? 'Completed'
                    : selectedStepIndex === currentStepIndex
                      ? 'In progress'
                      : 'Not started'}
                </span>
              </div>

              <div className="space-y-5">
                {selectedStepContent
                  ? renderLessonText(selectedStepContent, 'text-base text-slate-700 leading-relaxed')
                  : <p className="text-base text-slate-500">No content has been published for this step yet.</p>}
              </div>

              {selectedStep.link && (
                <a
                  href={selectedStep.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open activity content
                </a>
              )}

              {selectedStep.additionalResources && selectedStep.additionalResources.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedStep.additionalResources.map((resource, resourceIndex) => (
                    <span key={`${resource}-${resourceIndex}`} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {resource}
                    </span>
                  ))}
                </div>
              )}
            </section>
          )}

          {!isStepContentTransitionLoading && selectedStep && isPracticeStep(selectedStep.type) && (
            <>
              {isPracticeSessionLoading ? (
                <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3 animate-pulse">
                  <div className="h-5 w-40 rounded-md bg-slate-200" />
                  <div className="h-4 w-3/4 rounded-md bg-slate-200" />
                  <div className="h-28 w-full rounded-md bg-slate-200" />
                  <div className="h-10 w-36 rounded-md bg-slate-200" />
                </div>
              ) : practiceSessionError ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
                  {practiceSessionError}
                </div>
              ) : selectedPracticeSession && selectedPracticeQuestions.length > 0 ? (
                <StudentPracticeRunner
                  key={`${selectedPracticeSession.sessionId}`}
                  title={selectedStep.title}
                  subtitle="Practice questions are delivered one at a time. Check each answer before moving on."
                  questions={selectedPracticeQuestions}
                  fixedFooterStyle={{
                    left: 'calc(var(--student-plan-footer-left) - 3px)',
                    right: 'calc(var(--student-plan-footer-right) - 3px)',
                  }}
                  onSubmitAnswer={async ({ question, studentAnswerText, selectedOptions, skipped }) => {
                    const result = await studentService.submitPracticeAnswer(studentId, selectedPracticeSession.sessionId, {
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
                  onAssessOpenResponse={async ({ studentAnswerText, uploadFile }) => {
                    try {
                      return await assessOpenResponseWithAi(studentAnswerText, uploadFile);
                    } catch (error: unknown) {
                      return {
                        feedback: getErrorMessage(error, 'AI feedback is unavailable right now.'),
                      };
                    }
                  }}
                  onCompleteSession={async () => {
                    await studentService.completePracticeSession(studentId, selectedPracticeSession.sessionId);
                  }}
                  onComplete={markCurrentPracticeStepComplete}
                />
              ) : (
                <section className="space-y-5">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-700">
                    No objective practice questions are published for this step yet. You can still submit your work for AI feedback below.
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-slate-800">Practice task prompt</p>
                      {selectedStepContent
                        ? renderLessonText(selectedStepContent, 'text-base text-slate-700 leading-relaxed')
                        : <p className="text-sm text-slate-500">No prompt text has been published for this step yet.</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700" htmlFor="manual-practice-answer">
                        Your response
                      </label>
                      <textarea
                        id="manual-practice-answer"
                        rows={6}
                        value={manualPracticeAnswerText}
                        onChange={(event) => setManualPracticeAnswerText(event.target.value)}
                        placeholder="Type your answer or explanation..."
                        className="mt-2 w-full resize-y rounded-lg border border-slate-300 bg-white px-4 py-3 text-base text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => {
                            const file = event.target.files?.[0] || null;
                            setManualPracticeImageFile(file);
                            event.currentTarget.value = '';
                          }}
                        />
                        {manualPracticeImageFile ? `Image attached: ${manualPracticeImageFile.name}` : 'Upload answer image (optional)'}
                      </label>
                      {manualPracticeImageFile && (
                        <button
                          type="button"
                          onClick={() => setManualPracticeImageFile(null)}
                          className="inline-flex items-center rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                        >
                          Remove image
                        </button>
                      )}
                    </div>

                    {manualPracticeError && (
                      <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                        {manualPracticeError}
                      </div>
                    )}

                    {manualPracticeFeedback && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                        {manualPracticeFeedback}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void handleManualPracticeAssess()}
                        disabled={isManualPracticeAssessing}
                        className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isManualPracticeAssessing ? 'Assessing...' : 'Get AI feedback'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void markCurrentPracticeStepComplete()}
                        disabled={!manualPracticeFeedback}
                        className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                      >
                        Complete step
                      </button>
                    </div>
                  </div>
                </section>
              )}
            </>
          )}
        </div>

      </div>

      <div
        ref={chatFloatingRef}
        className="fixed z-40"
        style={
          chatPosition
            ? { left: `${chatPosition.x}px`, top: `${chatPosition.y}px` }
            : {
                right: 'calc(var(--student-plan-footer-right) + 1rem)',
                bottom: '6rem',
              }
        }
      >
        <div className="flex flex-col items-end gap-3">
          {isChatOpen && (
            <div className="w-[460px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">Plan Chat</p>
                <div className="inline-flex items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={startChatDrag}
                    className="inline-flex h-7 w-7 cursor-grab items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
                    aria-label="Drag plan chat window"
                    title="Drag"
                  >
                    <GripHorizontal className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setChatOpenWithAnchor(false)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                    aria-label="Close plan chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="h-[300px] max-h-[52vh] space-y-2 overflow-y-auto px-3 py-3">
                {chatMessages.map((message) => (
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
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        sendChatMessage();
                      }
                    }}
                    placeholder="Type a message..."
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={sendChatMessage}
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
              onPointerDown={startChatDrag}
              className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 active:cursor-grabbing"
              aria-label="Drag chat button"
              title="Drag"
            >
              <GripHorizontal className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setChatOpenWithAnchor(!isChatOpen)}
              className="inline-flex items-center gap-2 rounded-md bg-white px-1.5 py-1 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <MessageCircle className="h-4 w-4" />
              {isChatOpen ? 'Hide chat' : 'Open chat'}
            </button>
          </div>
        </div>
      </div>

      {showUpNextFooter && (
        <>
          <div
            className="hidden md:block fixed bottom-0 z-30"
            style={{
              left: 'calc(var(--student-plan-footer-left) - 3px)',
              right: 'calc(var(--student-plan-footer-right) - 3px)',
            }}
          >
            <footer className="border-t border-l border-r border-slate-200 bg-white px-6 py-4">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedStepId) {
                      if (nextStep) setSelectedStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
                      return;
                    }
                    const nextCompletedStepIds = Array.from(new Set([...completedStepIds, selectedStepId]));
                    setCompletedStepIds(nextCompletedStepIds);
                    void persistRuntimeProgress(nextCompletedStepIds, nextStep?.id ? String(nextStep.id) : null);
                    if (nextStep) setSelectedStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
                  }}
                  disabled={!nextStep}
                  className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {nextStep ? `Up next: ${getNextStepLabel(nextStep.type)}` : 'Plan complete'}
                </button>
              </div>
            </footer>
          </div>

          <div className="md:hidden border-t border-slate-200 bg-white px-6 py-4">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (!selectedStepId) {
                    if (nextStep) setSelectedStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
                    return;
                  }
                  const nextCompletedStepIds = Array.from(new Set([...completedStepIds, selectedStepId]));
                  setCompletedStepIds(nextCompletedStepIds);
                  void persistRuntimeProgress(nextCompletedStepIds, nextStep?.id ? String(nextStep.id) : null);
                  if (nextStep) setSelectedStepIndex((prev) => Math.min(prev + 1, totalSteps - 1));
                }}
                disabled={!nextStep}
                className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
              >
                {nextStep ? `Up next: ${getNextStepLabel(nextStep.type)}` : 'Plan complete'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
};

export default StudentPlanView;
