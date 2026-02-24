import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import StudentPracticeRunner, { buildMockPracticeQuestions } from './StudentPracticeRunner';

interface StudentPlanViewProps {
  plan: DevelopmentPlan;
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

const getStepLessonContent = (step: Step) => {
  const topic = step.title;

  if (step.type === 'document') {
    return {
      intro: `This lesson introduces ${topic.toLowerCase()} and explains how to apply it in worked examples.`,
      sections: [
        {
          heading: 'What you will learn in this lesson',
          paragraphs: [
            `You will build a clear understanding of ${topic.toLowerCase()} and when to use it in classwork or assessments.`,
            'You should be able to explain the concept in your own words and identify it in practical examples.',
          ],
        },
        {
          heading: 'Core explanation',
          paragraphs: [
            `Start by reading each concept slowly, then summarize each key point before moving on to the next one.`,
            'As you read, note definitions, rules, and common mistakes to avoid.',
          ],
        },
      ],
    };
  }

  if (step.type === 'assignment') {
    return {
      intro: `This task is focused on applying ${topic.toLowerCase()} through guided problem solving.`,
      sections: [
        {
          heading: 'How to approach this task',
          paragraphs: [
            'Break each question into smaller parts and write your reasoning for every step.',
            'Do not jump to a final answer without showing method, assumptions, and checks.',
          ],
        },
        {
          heading: 'Submission quality checklist',
          paragraphs: [
            'Show full working, include units/labels where needed, and verify final results.',
            'Review your answer and explain why your method is valid.',
          ],
        },
      ],
    };
  }

  if (step.type === 'quiz') {
    return {
      intro: `This quiz checks mastery of ${topic.toLowerCase()} with timed practice items.`,
      sections: [
        {
          heading: 'Before you start',
          paragraphs: [
            'Review your notes and recall key formulas, rules, or definitions.',
            'Focus on accuracy first, then speed.',
          ],
        },
        {
          heading: 'After each attempt',
          paragraphs: [
            'Identify exactly where errors happened and classify the mistake type.',
            'Retry similar items until your method is consistent.',
          ],
        },
      ],
    };
  }

  if (step.type === 'discussion') {
    return {
      intro: `This discussion step helps you strengthen reasoning for ${topic.toLowerCase()}.`,
      sections: [
        {
          heading: 'Discussion focus',
          paragraphs: [
            'State your position clearly, then support it with evidence from your work.',
            'Compare alternative approaches and explain which is more reliable.',
          ],
        },
        {
          heading: 'Reflection prompt',
          paragraphs: [
            'What changed in your understanding after this discussion?',
            'Which misconception did you correct and how will you avoid it next time?',
          ],
        },
      ],
    };
  }

  return {
    intro: `This learning step helps you progress through ${topic.toLowerCase()}.`,
    sections: [
      {
        heading: 'Learning goal',
        paragraphs: [
          'Engage with the material actively and write down key takeaways.',
          'Translate the concept into your own words to confirm understanding.',
        ],
      },
    ],
  };
};

const StudentPlanView: React.FC<StudentPlanViewProps> = ({ plan, initialStepIndex }) => {
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

  const selectedStep = sortedSteps[selectedStepIndex] || null;
  const nextStep = selectedStepIndex < totalSteps - 1 ? sortedSteps[selectedStepIndex + 1] : null;
  const selectedStepLesson = useMemo(
    () => (selectedStep ? getStepLessonContent(selectedStep) : null),
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
  }, [plan.id]);

  useEffect(() => () => {
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
  }, [isChatOpen, chatPosition?.x, chatPosition?.y]);

  const selectedStepIsPractice = Boolean(selectedStep && isPracticeStep(selectedStep.type));
  const showUpNextFooter = !selectedStepIsPractice || Boolean(completedPracticeSteps[selectedStepIndex]);

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
              <h2 className="text-lg font-bold text-slate-900 truncate">{plan.plan.name}</h2>
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
                onClick={() => setSelectedStepIndex(index)}
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
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{selectedStep?.title || plan.plan.name}</h1>
          </div>
        </header>

        <div className="p-6 pb-28 space-y-6 bg-white">
          {selectedStep && selectedStepLesson && !isPracticeStep(selectedStep.type) && (
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
                <p className="text-base text-slate-700">{selectedStepLesson.intro}</p>

                {selectedStep.type === 'document' && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 flex items-center justify-center">
                    <svg width="200" height="170" viewBox="0 0 200 170" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M100 18V152" stroke="#A855F7" strokeWidth="2" strokeDasharray="5 4" />
                      <path d="M100 18L90 28M100 18L110 28" stroke="#A855F7" strokeWidth="2" />
                      <path d="M100 152L90 142M100 152L110 142" stroke="#A855F7" strokeWidth="2" />
                      <path d="M65 63L100 28L135 63L122 140H78L65 63Z" stroke="#22C55E" strokeWidth="2.5" />
                    </svg>
                  </div>
                )}

                {selectedStepLesson.sections.map((section) => (
                  <div key={section.heading} className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">{section.heading}</h3>
                    {section.paragraphs.map((paragraph) => (
                      <p key={paragraph} className="text-base leading-relaxed text-slate-800">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                ))}
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

          {selectedStep && isPracticeStep(selectedStep.type) && (
            <StudentPracticeRunner
              key={`${plan.id}-${selectedStepIndex}`}
              title={selectedStep.title}
              subtitle="Practice questions are delivered one at a time. Check each answer before moving on."
              questions={buildMockPracticeQuestions(selectedStep.title, selectedStep.type === 'assignment' ? 'assignment' : 'quiz')}
              fixedFooterStyle={{
                left: 'calc(var(--student-plan-footer-left) - 3px)',
                right: 'calc(var(--student-plan-footer-right) - 3px)',
              }}
              onComplete={() =>
                setCompletedPracticeSteps((previous) => ({
                  ...previous,
                  [selectedStepIndex]: true,
                }))
              }
            />
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
